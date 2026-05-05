<?php
/**
 * SystemDeck - PinRuntimeBridge
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Services/PinRuntimeBridge.php
 * @license GPL-2.0-or-later
 *
 * Pin Runtime Interface (Asset & State Injection)
 */
declare(strict_types=1);

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class PinRuntimeBridge
{
    /**
     * @var array<string,string>|null
     */
    private static ?array $runtime_class_index = null;

    /**
     * @return array{requested_id:string,resolved_id:string,definition:array<string,mixed>|null}
     */
    public static function resolve(string $pin_id): array
    {
        $requested_id = self::sanitize_pin_id($pin_id);
        $definition = $requested_id !== '' ? PinRegistry::get_definition($requested_id) : null;

        // Handle prefixed projections (note.123, vault.456) where the specific ID isn't registered
        if ($definition === null && $requested_id !== '') {
            if (str_starts_with($requested_id, 'note.')) {
                $definition = PinRegistry::get_definition('pinned_note');
            } elseif (str_starts_with($requested_id, 'vault.')) {
                $definition = PinRegistry::get_definition('pinned_file');
            }
        }

        return [
            'requested_id' => $requested_id,
            'resolved_id' => is_array($definition) ? (string) ($definition['id'] ?? $requested_id) : $requested_id,
            'definition' => is_array($definition) ? $definition : null,
        ];
    }

    /**
     * @param array<string,mixed> $context
     * @return array{html:string,rendered:bool,error:string,resolved:array<string,mixed>,assets_manifest:array<int,array<string,mixed>>,renderer:string}
     */
    public static function render(string $pin_id, array $context = []): array
    {
        $resolved = self::resolve($pin_id);
        if ($resolved['requested_id'] === '' || !is_array($resolved['definition'])) {
            return [
                'html' => '',
                'rendered' => false,
                'error' => 'missing_pin_definition',
                'resolved' => $resolved,
                'assets_manifest' => [],
                'renderer' => 'dom',
            ];
        }

        $base_pin_file = trailingslashit((string) SYSTEMDECK_PATH) . 'pins/pin.php';
        if (file_exists($base_pin_file)) {
            require_once $base_pin_file;
        }

        if (class_exists('\\SystemDeck\\Core\\Assets')) {
            \SystemDeck\Core\Assets::register_all();
        }

        $renderer = sanitize_key((string) ($resolved['definition']['renderer'] ?? 'dom')) ?: 'dom';
        $runtime_class = self::resolve_runtime_class($resolved);

        $asset_handles = ['js' => [], 'css' => []];
        if ($runtime_class !== '' && class_exists($runtime_class)) {
            if (method_exists($runtime_class, 'pin_asset_handles')) {
                $asset_handles = (array) $runtime_class::pin_asset_handles((string) $resolved['requested_id']);
            } elseif (method_exists($runtime_class, 'asset_handles')) {
                $asset_handles = (array) $runtime_class::asset_handles((string) $resolved['resolved_id']);
            }
        } elseif (class_exists('\\SystemDeck\\Pins\\BasePinRuntime') && method_exists('\\SystemDeck\\Pins\\BasePinRuntime', 'asset_handles')) {
            $asset_handles = (array) \SystemDeck\Pins\BasePinRuntime::asset_handles((string) $resolved['resolved_id']);
        }

        $assets_manifest = class_exists('\\SystemDeck\\Core\\Assets')
            ? \SystemDeck\Core\Assets::build_pin_asset_manifest(
                is_array($asset_handles['js'] ?? null) ? $asset_handles['js'] : [],
                is_array($asset_handles['css'] ?? null) ? $asset_handles['css'] : []
            )
            : [];

        $html = '';
        if ($runtime_class !== '' && class_exists($runtime_class)) {
            if (method_exists($runtime_class, 'pin_render')) {
                $html = (string) $runtime_class::pin_render((string) $resolved['requested_id'], $context);
            } elseif (method_exists($runtime_class, 'render')) {
                $html = (string) $runtime_class::render((string) $resolved['resolved_id'], $context);
            }
        } elseif (class_exists('\\SystemDeck\\Pins\\BasePinRuntime') && method_exists('\\SystemDeck\\Pins\\BasePinRuntime', 'render')) {
            $html = (string) \SystemDeck\Pins\BasePinRuntime::render((string) $resolved['resolved_id'], $context);
        }

        if (trim($html) === '') {
            return [
                'html' => '',
                'rendered' => false,
                'error' => 'pin_render_empty',
                'resolved' => $resolved,
                'assets_manifest' => $assets_manifest,
                'renderer' => $renderer,
            ];
        }

        return [
            'html' => $html,
            'rendered' => true,
            'error' => '',
            'resolved' => $resolved,
            'assets_manifest' => $assets_manifest,
            'renderer' => $renderer,
        ];
    }

    public static function sanitize_pin_id($pin_id): string
    {
        $id = is_scalar($pin_id) ? (string) $pin_id : '';
        $id = wp_unslash($id);
        $id = strtolower(trim($id));
        return (string) preg_replace('/[^a-z0-9._-]/', '', $id);
    }

    /**
     * @param array<string,mixed> $resolved
     */
    private static function resolve_runtime_class(array $resolved): string
    {
        $definition = is_array($resolved['definition'] ?? null) ? $resolved['definition'] : [];
        $meta = is_array($definition['meta'] ?? null) ? $definition['meta'] : [];
        $from_meta = (string) ($meta['runtime_class'] ?? '');
        if ($from_meta !== '' && class_exists($from_meta)) {
            return $from_meta;
        }

        $index = self::build_runtime_class_index();
        $id = (string) ($resolved['resolved_id'] ?? '');
        if ($id !== '' && isset($index[$id])) {
            return $index[$id];
        }

        // Handle prefixed projections (note.123, vault.456)
        if (str_starts_with($id, 'note.')) {
            return isset($index['pinned_note']) ? $index['pinned_note'] : '\\SystemDeck\\Widgets\\Notes';
        }
        if (str_starts_with($id, 'vault.')) {
            return isset($index['pinned_file']) ? $index['pinned_file'] : '\\SystemDeck\\Widgets\\Vault';
        }

        return '';
    }

    /**
     * @return array<string,string>
     */
    private static function build_runtime_class_index(): array
    {
        if (is_array(self::$runtime_class_index)) {
            return self::$runtime_class_index;
        }

        $indexed = [];
        $base_dir = trailingslashit((string) SYSTEMDECK_PATH) . 'pins';
        if (!is_dir($base_dir)) {
            self::$runtime_class_index = $indexed;
            return $indexed;
        }

        $folders = glob($base_dir . '/*', GLOB_ONLYDIR) ?: [];
        foreach ($folders as $folder_path) {
            $folder_name = basename((string) $folder_path);
            if ($folder_name === '' || $folder_name === '.' || $folder_name === '..') {
                continue;
            }

            $pin_file = trailingslashit((string) $folder_path) . 'pin.php';
            if (!file_exists($pin_file)) {
                continue;
            }

            require_once $pin_file;

            $runtime_class = '\\SystemDeck\\Pins\\' . self::folder_to_runtime_namespace($folder_name) . '\\PinRuntime';
            if (!class_exists($runtime_class) || !method_exists($runtime_class, 'definitions')) {
                continue;
            }

            $definitions = $runtime_class::definitions();
            if (!is_array($definitions)) {
                continue;
            }

            foreach ($definitions as $definition) {
                if (!is_array($definition)) {
                    continue;
                }
                $id = self::sanitize_pin_id((string) ($definition['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $indexed[$id] = $runtime_class;
            }
        }

        self::$runtime_class_index = $indexed;
        return $indexed;
    }

    private static function folder_to_runtime_namespace(string $folder_name): string
    {
        $parts = preg_split('/[^a-zA-Z0-9]+/', $folder_name) ?: [];
        $segments = array_filter(array_map(static fn(string $part): string => ucfirst(strtolower($part)), $parts));
        return implode('', $segments) ?: 'Pin';
    }
}
