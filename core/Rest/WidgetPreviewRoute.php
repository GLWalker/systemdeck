<?php
declare(strict_types=1);

namespace SystemDeck\Core\Rest;

if (!defined('ABSPATH')) {
    exit;
}

final class WidgetPreviewRoute
{
    public static function init(): void
    {
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void
    {
        register_rest_route('systemdeck/v1', '/widget-preview', [
            'methods' => \WP_REST_Server::READABLE,
            'permission_callback' => static function (): bool {
                return current_user_can('read');
            },
            'args' => [
                'widget_id' => [
                    'type' => 'string',
                    'required' => true,
                    'sanitize_callback' => static function ($value): string {
                        return \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) $value);
                    },
                ],
            ],
            'callback' => [self::class, 'handle_preview'],
        ]);
    }

    public static function handle_preview(\WP_REST_Request $request): \WP_REST_Response
    {
        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) $request->get_param('widget_id'));
        if ($widget_id === '') {
            return new \WP_REST_Response(['success' => false, 'message' => 'Missing widget ID'], 400);
        }

        $resolved = \SystemDeck\Core\Services\WidgetRuntimeBridge::resolve($widget_id);
        $origin = (string) ($resolved['origin'] ?? 'external');
        $source_id = (string) ($resolved['source_id'] ?? $widget_id);

        // Dashboard/discovered widgets often require full admin widget boot context.
        // In editor preview, use tunnel iframe for deterministic rendering parity.
        if (in_array($origin, ['dashboard', 'discovered', 'external'], true) && class_exists('\\SystemDeck\\Modules\\DashboardTunnel')) {
            ob_start();
            \SystemDeck\Modules\DashboardTunnel::iframe($source_id);
            $iframe_html = (string) ob_get_clean();
            if (trim($iframe_html) !== '') {
                return new \WP_REST_Response([
                    'success' => true,
                    'html' => $iframe_html,
                    'resolved_id' => (string) (($resolved['resolved_id'] ?? '') ?: ''),
                    'source_id' => $source_id,
                    'assets' => ['css' => [], 'js' => []],
                ], 200);
            }
        }

        $result = \SystemDeck\Core\Services\WidgetRuntimeBridge::render($widget_id);
        $html = (string) ($result['html'] ?? '');
        if (!(bool) ($result['rendered'] ?? false) || $html === '') {
            return new \WP_REST_Response([
                'success' => false,
                'message' => "Widget '{$widget_id}' not found or produced no output",
                'resolved_id' => (string) (($result['resolved']['resolved_id'] ?? '') ?: ''),
                'source_id' => (string) (($result['resolved']['source_id'] ?? '') ?: ''),
                'error' => (string) ($result['error'] ?? 'widget_render_empty'),
            ], 404);
        }

        return new \WP_REST_Response([
            'success' => true,
            'html' => $html,
            'resolved_id' => (string) (($result['resolved']['resolved_id'] ?? '') ?: ''),
            'source_id' => (string) (($result['resolved']['source_id'] ?? '') ?: ''),
            'assets' => self::resolve_widget_assets((string) (($result['resolved']['resolved_id'] ?? '') ?: '')),
        ], 200);
    }

    /**
     * @return array{css:array<int,string>,js:array<int,string>}
     */
    private static function resolve_widget_assets(string $widget_id): array
    {
        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : \SystemDeck\Core\Registry::get_snapshot();
        $definitions = (array) ($snapshot['widgets'] ?? []);
        $definition = (isset($definitions[$widget_id]) && is_array($definitions[$widget_id])) ? $definitions[$widget_id] : null;
        if (!is_array($definition) || ($definition['origin'] ?? '') !== 'core') {
            return ['css' => [], 'js' => []];
        }

        $folder = str_replace('core.', '', $widget_id);
        $css = [];
        foreach ((array) (($definition['assets']['css'] ?? [])) as $file) {
            $url = self::resolve_asset_url((string) $file, 'style', $folder);
            if ($url !== '') {
                $css[] = $url;
            }
        }

        $js = [];
        foreach ((array) (($definition['assets']['js'] ?? [])) as $file) {
            $url = self::resolve_asset_url((string) $file, 'script', $folder);
            if ($url !== '') {
                $js[] = $url;
            }
        }

        return ['css' => $css, 'js' => $js];
    }

    private static function resolve_asset_url(string $asset, string $type, string $folder): string
    {
        $asset = trim($asset);
        if ($asset === '') {
            return '';
        }

        $registry = $type === 'style' ? wp_styles() : wp_scripts();
        if (isset($registry->registered[$asset]) && !empty($registry->registered[$asset]->src)) {
            return self::normalize_registered_src((string) $registry->registered[$asset]->src);
        }

        if (wp_http_validate_url($asset)) {
            return $asset;
        }

        if ($asset[0] === '/') {
            return home_url($asset);
        }

        $relative = ltrim($asset, '/');
        $file_path = SYSTEMDECK_PATH . 'widgets/' . $folder . '/' . $relative;
        if (is_file($file_path)) {
            return trailingslashit(SYSTEMDECK_URL . 'widgets/' . $folder) . $relative;
        }

        return '';
    }

    private static function normalize_registered_src(string $src): string
    {
        $src = trim($src);
        if ($src === '') {
            return '';
        }

        if (wp_http_validate_url($src)) {
            return $src;
        }

        if ($src[0] === '/') {
            return home_url($src);
        }

        return home_url('/' . ltrim($src, '/'));
    }
}
