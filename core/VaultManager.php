<?php
/**
 * SystemDeck - VaultManager
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/VaultManager.php
 * @license GPL-2.0-or-later
 *
 * Private Storage and Media Management Authority
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

final class VaultManager
{
    private const VAULT_DIR_NAME = 'systemdeck-vault';

    public static function init(): void
    {
        // Intercept download requests before WP fully loads templates
        add_action('parse_request', [self::class, 'handle_secure_stream']);
        
        // Ensure directory exists securely
        self::ensure_vault_exists();
    }

    public static function get_vault_path(): string
    {
        $upload_dir = wp_upload_dir(null, false);
        return trailingslashit($upload_dir['basedir']) . self::VAULT_DIR_NAME;
    }

    public static function get_user_vault_path(int $user_id): string
    {
        $user_id = max(0, $user_id);
        return trailingslashit(self::get_vault_path()) . $user_id;
    }

    public static function ensure_user_vault_exists(int $user_id): string
    {
        $path = self::get_user_vault_path($user_id);
        if (!is_dir($path)) {
            wp_mkdir_p($path);
        }

        $index = trailingslashit($path) . 'index.php';
        if (!file_exists($index)) {
            file_put_contents($index, "<?php\n// Silence is golden.");
        }

        return $path;
    }

    public static function normalize_vault_relative_path(string $path): string
    {
        $path = ltrim(str_replace('\\', '/', $path), '/');
        $parts = array_values(array_filter(explode('/', $path), static function ($part) {
            return $part !== '' && $part !== '.' && $part !== '..';
        }));

        return implode('/', $parts);
    }

    public static function resolve_absolute_path(string $vault_path): string
    {
        $relative = self::normalize_vault_relative_path($vault_path);
        if ($relative === '') {
            return '';
        }

        return trailingslashit(self::get_vault_path()) . $relative;
    }

    private static function ensure_vault_exists(): void
    {
        $path = self::get_vault_path();
        if (!is_dir($path)) {
            wp_mkdir_p($path);
        }

        $htaccess = trailingslashit($path) . '.htaccess';
        if (!file_exists($htaccess)) {
            // Block all direct web access to this folder
            $rules = "Order Allow,Deny\nDeny from all\n<FilesMatch \"\.(jpeg|jpg|png|gif|webp|svg|pdf)$\">\nDeny from all\n</FilesMatch>";
            file_put_contents($htaccess, $rules);
        }
        
        $index = trailingslashit($path) . 'index.php';
        if (!file_exists($index)) {
            file_put_contents($index, "<?php\n// Silence is golden.");
        }
    }

    public static function handle_secure_stream(\WP $wp): void
    {
        if (empty($_GET['sd_vault_stream'])) {
            return;
        }

        $file_id = intval($_GET['sd_vault_stream']);
        if ($file_id <= 0) {
            wp_die('Invalid file reference', 'SystemDeck Vault', 400);
        }

        $post = get_post($file_id);
        if (!$post || $post->post_type !== 'sd_vault_file') {
            wp_die('File not found', 'SystemDeck Vault', 404);
        }

        $user_id = get_current_user_id();
        $author_id = (int) $post->post_author;
        
        // Permission Check: Same rules as Notes
        if ($author_id !== $user_id) {
            $ws_id = get_post_meta($file_id, '_sd_vault_workspace_id', true);
            $scope = get_post_meta($file_id, '_sd_vault_scope', true);
            
            if ($scope !== 'pinned' || !function_exists('systemdeck_user_meets_workspace_access') || !systemdeck_user_meets_workspace_access($user_id, $ws_id)) {
                // Return a single pixel transparent gif if requested as image block to prevent broken icons
                if (isset($_GET['thumbnail'])) {
                    header('Content-Type: image/gif');
                    echo base64_decode('R0lGODlhAQABAJAAAP8AAAAAACH5BAUQAAAALAAAAAABAAEAAAICBAEAOw==');
                    exit;
                }
                wp_die('Access denied securely', 'SystemDeck Vault', 403);
            }
        }

        $storage_mode = (string) get_post_meta($file_id, '_sd_vault_storage_mode', true);
        $vault_path = (string) (get_post_meta($file_id, '_sd_vault_vault_path', true) ?: get_post_meta($file_id, '_sd_attached_file', true));
        if ($storage_mode === 'media_public' && $vault_path === '') {
            $attachment_id = (int) get_post_meta($file_id, '_sd_vault_wp_attachment_id', true);
            $attachment_url = $attachment_id > 0 ? wp_get_attachment_url($attachment_id) : '';
            if ($attachment_url) {
                wp_safe_redirect($attachment_url);
                exit;
            }
        }

        if ($vault_path === '') {
            wp_die('Physical path missing', 'SystemDeck Vault', 404);
        }

        $absolute_path = self::resolve_absolute_path($vault_path);
        
        if ($absolute_path === '' || !file_exists($absolute_path)) {
            wp_die('Physical file missing from disk', 'SystemDeck Vault', 404);
        }

        $mime = $post->post_mime_type ?: 'application/octet-stream';
        $size = filesize($absolute_path);

        if (defined('SYSTEMDECK_DEBUG_AUDIO') && SYSTEMDECK_DEBUG_AUDIO) {
            error_log(sprintf(
                "[Vault Stream Audit] ID: %d, Path: %s, Mime: %s, Size: %d, Range: %s",
                $vault_id,
                $absolute_path,
                $mime,
                $size,
                $_SERVER['HTTP_RANGE'] ?? 'none'
            ));
        }

        // Standard stream headers
        header('Content-Type: ' . $mime);
        header('Accept-Ranges: bytes');
        
        // Security headers
        header('X-Content-Type-Options: nosniff');
        if (function_exists('header_remove')) {
            header_remove('X-Frame-Options');
        }
        if (isset($_GET['download'])) {
            header('X-Frame-Options: DENY');
        } else {
            header('X-Frame-Options: SAMEORIGIN');
        }
        header('Cache-Control: private, max-age=31536000');
        
        // Handle Range requests (essential for seeking in Chrome/Safari)
        if (isset($_SERVER['HTTP_RANGE'])) {
            $range = $_SERVER['HTTP_RANGE'];
            if (preg_match('/bytes=(\d+)-(\d+)?/', $range, $matches)) {
                $start = intval($matches[1]);
                $end = isset($matches[2]) ? intval($matches[2]) : $size - 1;
                
                header('HTTP/1.1 206 Partial Content');
                header("Content-Range: bytes $start-$end/$size");
                header('Content-Length: ' . ($end - $start + 1));
                
                $fp = fopen($absolute_path, 'rb');
                fseek($fp, $start);
                
                while (ob_get_level()) ob_end_clean();
                
                // Stream in chunks to avoid memory limits
                $buffer = 8192;
                $bytes_to_read = $end - $start + 1;
                while (!feof($fp) && $bytes_to_read > 0) {
                    $chunk_size = min($buffer, $bytes_to_read);
                    echo fread($fp, $chunk_size);
                    $bytes_to_read -= $chunk_size;
                    flush();
                }
                
                fclose($fp);
                exit;
            }
        }

        header('Content-Length: ' . $size);

        // For downloads vs inline viewing
        if (isset($_GET['download'])) {
            header('Content-Disposition: attachment; filename="' . basename($absolute_path) . '"');
        } else {
            header('Content-Disposition: inline; filename="' . basename($absolute_path) . '"');
        }

        // Clean out any output buffers before streaming
        while (ob_get_level()) {
            ob_end_clean();
        }

        readfile($absolute_path);
        exit;
    }
}
