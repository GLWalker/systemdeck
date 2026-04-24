<?php
declare(strict_types=1);

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class WidgetRuntimeBridge
{
    /**
     * @return array{
     *   requested_id:string,
     *   resolved_id:string,
     *   source_id:string,
     *   title:string,
     *   origin:string,
     *   class:string,
     *   render_callback:mixed,
     *   callback:mixed,
     *   definition:array<string,mixed>|null
     * }
     */
    public static function resolve(string $widget_id): array
    {
        $requested_id = self::sanitize_widget_id($widget_id);
        $resolved_id = self::normalize_widget_id_alias($requested_id);

        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : \SystemDeck\Core\Registry::get_snapshot();
        $definitions = (array) ($snapshot['widgets'] ?? []);

        $definition = (isset($definitions[$resolved_id]) && is_array($definitions[$resolved_id]))
            ? $definitions[$resolved_id]
            : null;

        $source_id = $resolved_id;
        $origin = (string) ($definition['origin'] ?? 'external');
        if (($origin === 'dashboard' || $origin === 'discovered') && !empty($definition['source_id'])) {
            $source_id = sanitize_text_field((string) $definition['source_id']);
        }

        return [
            'requested_id' => $requested_id,
            'resolved_id' => $resolved_id,
            'source_id' => $source_id,
            'title' => (string) ($definition['title'] ?? $resolved_id),
            'origin' => $origin,
            'class' => (string) ($definition['class'] ?? ''),
            'render_callback' => $definition['render_callback'] ?? null,
            'callback' => $definition['callback'] ?? null,
            'definition' => $definition,
        ];
    }

    /**
     * @return array{html:string,rendered:bool,error:string,resolved:array<string,mixed>,assets_manifest:array<int,array<string,mixed>>}
     */
    public static function render(string $widget_id, array $context = []): array
    {
        $resolved = self::resolve($widget_id);
        if ($resolved['requested_id'] === '' || !is_array($resolved['definition'])) {
            return [
                'html' => '',
                'rendered' => false,
                'error' => 'missing_widget_definition',
                'resolved' => $resolved,
                'assets_manifest' => [],
            ];
        }

        if (class_exists('\\SystemDeck\\Core\\Assets')) {
            \SystemDeck\Core\Assets::register_all();
        }
        \SystemDeck\Core\Registry::enqueue_widget_assets((string) $resolved['resolved_id']);
        $assets_manifest = class_exists('\\SystemDeck\\Core\\Assets')
            ? \SystemDeck\Core\Assets::build_widget_asset_manifest([(string) $resolved['resolved_id']])
            : [];

        // Capture any dashboard boot noise before the widget itself renders so JSON responses stay clean.
        ob_start();
        self::prepare_dashboard_context($resolved);
        ob_end_clean();

        ob_start();
        $rendered = false;

        $class = (string) ($resolved['class'] ?? '');
        if ($class !== '' && class_exists($class) && is_subclass_of($class, '\\SystemDeck\\Widgets\\BaseWidget')) {
            $class::render($context);
            $rendered = true;
        } elseif (isset($resolved['render_callback']) && is_callable($resolved['render_callback'])) {
            call_user_func($resolved['render_callback']);
            $rendered = true;
        } elseif (isset($resolved['callback']) && is_callable($resolved['callback'])) {
            call_user_func($resolved['callback']);
            $rendered = true;
        }

        if (!$rendered && class_exists('\\SystemDeck\\Modules\\DashboardTunnel')) {
            $rendered = \SystemDeck\Modules\DashboardTunnel::render_widget((string) $resolved['source_id']);
        }

        $html = (string) ob_get_clean();
        if (!$rendered && trim($html) === '') {
            return [
                'html' => '',
                'rendered' => false,
                'error' => 'widget_render_empty',
                'resolved' => $resolved,
                'assets_manifest' => $assets_manifest,
            ];
        }

        return [
            'html' => $html,
            'rendered' => true,
            'error' => '',
            'resolved' => $resolved,
            'assets_manifest' => $assets_manifest,
        ];
    }

    /**
     * @param array<string,mixed> $resolved
     */
    private static function prepare_dashboard_context(array $resolved): void
    {
        $origin = (string) ($resolved['origin'] ?? 'external');
        if ($origin !== 'external' && $origin !== 'dashboard' && $origin !== 'discovered') {
            return;
        }

        if (!function_exists('get_current_screen') && file_exists(ABSPATH . 'wp-admin/includes/screen.php')) {
            require_once ABSPATH . 'wp-admin/includes/screen.php';
        }
        if (!function_exists('wp_dashboard_setup') && file_exists(ABSPATH . 'wp-admin/includes/dashboard.php')) {
            require_once ABSPATH . 'wp-admin/includes/dashboard.php';
        }
        if (function_exists('set_current_screen')) {
            set_current_screen('dashboard');
        }
        if (function_exists('wp_dashboard_setup')) {
            global $wp_meta_boxes;
            if (empty($wp_meta_boxes)) {
                wp_dashboard_setup();
            }
        }
    }

    private static function normalize_widget_id_alias(string $widget_id): string
    {
        if ($widget_id === '' || !str_contains($widget_id, '_')) {
            return $widget_id;
        }

        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : \SystemDeck\Core\Registry::get_snapshot();
        $definitions = (array) ($snapshot['widgets'] ?? []);

        if (isset($definitions[$widget_id])) {
            return $widget_id;
        }

        $candidate = str_replace('_', '.', $widget_id);
        if (isset($definitions[$candidate])) {
            return $candidate;
        }

        return $widget_id;
    }

    public static function sanitize_widget_id(string $widget_id): string
    {
        $widget_id = trim($widget_id);
        if ($widget_id === '') {
            return '';
        }

        return (string) preg_replace('/[^a-zA-Z0-9._-]/', '', $widget_id);
    }
}
