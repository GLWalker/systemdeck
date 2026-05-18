<?php
/**
 * SystemDeck - MediaAjaxController
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Ajax/MediaAjaxController.php
 */
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Core\AjaxHandler;
use SystemDeck\Core\VaultManager;

if (!defined('ABSPATH')) {
    exit;
}

class MediaAjaxController
{
    /**
     * Handle the sd_player_get_playlist AJAX request.
     * Normalizes all playable sources (Built-in, Vault, Media Library) into a unified contract.
     */
    public static function handle_get_playlist(): void
    {
        AjaxHandler::verify_request('workspace_view');

        $playlist = [
            'items'  => [],
            'groups' => [
                'builtin' => [],
                'vault'   => [],
                'media'   => []
            ],
            // Backward compatibility keys
            'vault' => [],
            'media' => []
        ];

        // 1. Built-in Tracks (SystemDeck Synthetic Engine)
        $builtins = [
            'metal'   => 'Heavy Metal',
            'oldies'  => 'Oldies',
            'country' => 'Country / Western',
            'hiphop'  => 'Hip Hop',
            'spicy'   => 'Spicy'
        ];

        foreach ($builtins as $id => $title) {
            $item = [
                'id'       => "builtin:{$id}",
                'title'    => $title,
                'source'   => $id,
                'url'      => '',
                'type'     => 'builtin',
                'mime'     => 'application/systemdeck+builtin',
                'origin'   => 'builtin',
                'metadata' => [
                    'builtinId' => $id,
                    'songId'    => $id,
                    'engine'    => 'systemdeck'
                ]
            ];
            $playlist['items'][] = $item;
            $playlist['groups']['builtin'][] = $item;
        }

        // 2. Vault Items
        $current_user_id = get_current_user_id();
        $vault_query = new \WP_Query([
            'post_type'      => 'sd_vault_file',
            'posts_per_page' => 100,
            'post_status'    => ['publish', 'private', 'inherit'],
            'author'         => $current_user_id,
            'no_found_rows'  => true,
            'update_post_term_cache' => false,
        ]);

        if ($vault_query->have_posts()) {
            foreach ($vault_query->posts as $post) {
                $mime = (string)get_post_meta($post->ID, '_sd_vault_mime_type', true);
                if (!$mime) {
                    $mime = (string)get_post_mime_type($post->ID);
                }
                
                $title = $post->post_title ?: 'Untitled Vault Track';
                $is_midi = str_contains($mime, 'midi') || preg_match('/\.(mid|midi)$/i', $title);
                $is_audio = str_contains($mime, 'audio/');
                $has_audio_ext = preg_match('/\.(mp3|wav|m4a|ogg|flac)$/i', $title);

                if (!$is_audio && !$is_midi && !$has_audio_ext) {
                    continue;
                }

                $url = site_url('?sd_vault_stream=' . $post->ID);
                $type = VaultManager::detect_media_type($mime, (string) get_post_meta($post->ID, '_sd_vault_original_filename', true));
                $artwork_url = (string) get_post_meta($post->ID, '_sd_vault_artwork_url', true);
                $artwork_attachment_id = max(0, (int) get_post_meta($post->ID, '_sd_vault_artwork_attachment_id', true));
                $duration = (float) get_post_meta($post->ID, '_sd_vault_duration', true);
                $linked_attachment_id = max(0, (int) get_post_meta($post->ID, '_sd_vault_wp_attachment_id', true));

                $metadata = array_filter([
                    'id' => $post->ID,
                    'vaultId' => $post->ID,
                    'attachmentId' => $linked_attachment_id ?: null,
                    'midiDerivative' => get_post_meta($post->ID, '_sd_midi_derivative_json', true),
                    'derivativeUrl' => get_post_meta($post->ID, '_sd_midi_derivative_url', true),
                    'originalUrl' => $url,
                    'sourceFile' => basename((string) get_post_meta($post->ID, '_sd_vault_vault_path', true)),
                    'filename' => (string) get_post_meta($post->ID, '_sd_vault_original_filename', true),
                    'extension' => strtolower((string) pathinfo((string) get_post_meta($post->ID, '_sd_vault_original_filename', true), PATHINFO_EXTENSION)),
                    'duration' => $duration > 0 ? $duration : null,
                    'artworkAttachmentId' => $artwork_attachment_id > 0 ? $artwork_attachment_id : null,
                    'artwork' => $artwork_url !== '' ? $artwork_url : null,
                    'artworkUrl' => $artwork_url !== '' ? $artwork_url : null,
                    'thumbnail' => $artwork_url !== '' ? $artwork_url : null,
                    'cover' => $artwork_url !== '' ? $artwork_url : null,
                    'origin' => 'vault',
                    'authority' => (string) get_post_meta($post->ID, '_sd_vault_authority', true),
                ], static function ($value) {
                    return $value !== null && $value !== '';
                });

                $item = [
                    'id'       => $post->ID,
                    'title'    => $title,
                    'source'   => $url,
                    'url'      => $url,
                    'artwork'  => $artwork_url !== '' ? $artwork_url : null,
                    'artworkUrl' => $artwork_url !== '' ? $artwork_url : null,
                    'thumbnail' => $artwork_url !== '' ? $artwork_url : null,
                    'cover' => $artwork_url !== '' ? $artwork_url : null,
                    'attachment_id' => $linked_attachment_id ?: null,
                    'linked_attachment_id' => $linked_attachment_id ?: null,
                    'linked_vault_id' => $post->ID,
                    'duration' => $duration,
                    'type'     => $type,
                    'mime'     => $mime,
                    'origin'   => 'vault',
                    'metadata' => $metadata
                ];
                $playlist['items'][] = $item;
                $playlist['groups']['vault'][] = $item;
                $playlist['vault'][] = $item; // Compat
            }
        }

        // 3. Media Library Items
        $media_query = new \WP_Query([
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => 50,
            'post_mime_type' => ['audio', 'audio/midi', 'audio/x-midi'],
            'no_found_rows'  => true,
        ]);

        if ($media_query->have_posts()) {
            foreach ($media_query->posts as $post) {
                $item = VaultManager::build_attachment_media_payload((int) $post->ID);
                if (!$item) {
                    continue;
                }
                $item['origin'] = 'media';
                $playlist['items'][] = $item;
                $playlist['groups']['media'][] = $item;
                $playlist['media'][] = $item; // Compat
            }
        }

        wp_send_json_success($playlist);
    }
}
