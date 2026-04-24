<?php
declare(strict_types=1);
/**
 * SystemDeck Assets Manager
 *
 * Handles stylesheet/script registration, dynamic CSS generation, and cache management.
 */

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class Assets
{
    // Cache key is derived from SYSTEMDECK_VERSION at runtime — no manual bump needed.
    // See get_cache_key() below.

    /**
     * WP admin colour scheme definitions.
     * Values extracted directly from wp-admin/css/colors/{scheme}/colors.css
     * and the battle-tested systemdeck-shell reference.
     * Keys: menu-bg, menu-text, menu-highlight-bg, menu-highlight-text,
     *       submenu-bg, submenu-text, submenu-focus, icon-base, icon-focus
     */
    public static array $schemes = [
        'fresh' => [
            'menu-bg' => '#1d2327',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#2271b1',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#2c3338',
            'submenu-text' => '#c3c4c7',
            'submenu-focus' => '#72aee6',
            'icon-base' => '#a7aaad',
            'icon-focus' => '#72aee6',
        ],
        'light' => [
            'menu-bg' => '#e5e5e5',
            'menu-text' => '#333',
            'menu-highlight-bg' => '#888',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#f1f1f1',
            'submenu-text' => '#686868',
            'submenu-focus' => '#04a4cc',
            'icon-base' => '#999',
            'icon-focus' => '#333',
        ],
        'modern' => [
            'menu-bg' => '#1e1e1e',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#3858e9',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#2f2f2f',
            'submenu-text' => '#bbbbbb',
            'submenu-focus' => '#7b90ff',
            'icon-base' => '#f3f1f1',
            'icon-focus' => '#fff',
        ],
        'blue' => [
            'menu-bg' => '#52accc',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#096484',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#4796b3',
            'submenu-text' => '#e2ecf1',
            'submenu-focus' => '#fff',
            'icon-base' => '#e5f8ff',
            'icon-focus' => '#fff',
        ],
        'midnight' => [
            'menu-bg' => '#363b3f',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#e14d43',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#25282b',
            'submenu-text' => '#c3c4c5',
            'submenu-focus' => '#e14d43',
            'icon-base' => '#f1f2f3',
            'icon-focus' => '#fff',
        ],
        'sunrise' => [
            'menu-bg' => '#cf4944',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#dd823b',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#b43c38',
            'submenu-text' => '#f1c8c7',
            'submenu-focus' => '#fff',
            'icon-base' => '#f3f1f1',
            'icon-focus' => '#fff',
        ],
        'ectoplasm' => [
            'menu-bg' => '#523f6d',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#a3b745',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#413256',
            'submenu-text' => '#cbc5d3',
            'submenu-focus' => '#a3b745',
            'icon-base' => '#ece6f6',
            'icon-focus' => '#fff',
        ],
        'ocean' => [
            'menu-bg' => '#738e96',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#9ebaa0',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#627b83',
            'submenu-text' => '#d5dddf',
            'submenu-focus' => '#fff',
            'icon-base' => '#f2fcff',
            'icon-focus' => '#fff',
        ],
        'coffee' => [
            'menu-bg' => '#59524c',
            'menu-text' => '#fff',
            'menu-highlight-bg' => '#c7a589',
            'menu-highlight-text' => '#fff',
            'submenu-bg' => '#46403c',
            'submenu-text' => '#cdcbc9',
            'submenu-focus' => '#c7a589',
            'icon-base' => '#f3f2f1',
            'icon-focus' => '#fff',
        ],
    ];

    public static function init(): void
    {
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_frontend_assets']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_admin_assets']);
        add_action('updated_user_meta', [self::class, 'detect_color_change'], 10, 4);
        add_action('admin_bar_menu', [self::class, 'register_admin_bar'], 999);
    }

    // ── Cache key ─────────────────────────────────────────────────────────────

    private static function get_cache_key(int $user_id): string
    {
        return 'sd_css_' . SYSTEMDECK_VERSION . '_' . $user_id;
    }

    private static function get_transient_key(int $user_id): string
    {
        // Transient keys are limited to 172 chars; version + user ID is fine.
        return 'sd_css_' . md5(SYSTEMDECK_VERSION) . '_' . $user_id;
    }

    // ── Stylesheet registration ────────────────────────────────────────────────

    /**
     * Core stylesheet registration map (shell → common → screen-meta chain).
     * Widget block CSS is registered in the block files themselves and attaches
     * to sd-common so it loads later in the chain.
     */
    public static function get_core_styles(): array
    {
        return [
            [
                // Shell must be registered first — sd-common depends on it.
                'handle' => 'systemdeck-shell',
                'path' => 'assets/css/systemdeck-shell.css',
                'deps' => ['dashicons'],
            ],
            [
                'handle' => 'sd-common',
                'path' => 'assets/css/common.css',
                'deps' => ['systemdeck-shell'],
            ],
            [
                'handle' => 'sd-grid',
                'path' => 'assets/css/grid.css',
                'deps' => ['sd-common', 'dashicons'],
            ],
            [
                'handle' => 'sd-legacy-common',
                'path' => 'assets/css/sd-common.css',
                // Load order: shell → common → grid → legacy
                'deps' => ['sd-grid', 'dashicons'],
            ],
            [
                'handle' => 'sd-screen-meta',
                'path' => 'assets/css/sd-screen-meta.css',
                'deps' => ['sd-legacy-common', 'dashicons'],
            ],
        ];
    }

    /**
     * Register shared non-widget assets.
     */
    public static function register_all(): void
    {
        foreach (self::get_core_styles() as $style) {
            wp_register_style($style['handle'], SYSTEMDECK_URL . $style['path'], $style['deps'], SYSTEMDECK_VERSION);
        }

        $modern_args = ['strategy' => 'defer', 'in_footer' => true];
        wp_register_script('sd-scanner-js', SYSTEMDECK_URL . 'assets/js/sd-scanner.js', ['jquery'], SYSTEMDECK_VERSION, $modern_args);

        $telemetry_stream_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/TelemetryStreamEngine.js') ?: SYSTEMDECK_VERSION);
        wp_register_script('sd-telemetry-stream-engine', SYSTEMDECK_URL . 'assets/js/runtime/TelemetryStreamEngine.js', [], $telemetry_stream_ver, true);

        $telemetry_intelligence_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/telemetry-intelligence-engine.js') ?: SYSTEMDECK_VERSION);
        wp_register_script('sd-telemetry-intelligence-engine', SYSTEMDECK_URL . 'assets/js/runtime/telemetry-intelligence-engine.js', ['sd-telemetry-stream-engine'], $telemetry_intelligence_ver, true);

        $self_healing_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/self-healing-engine.js') ?: SYSTEMDECK_VERSION);
        wp_register_script('sd-self-healing-engine', SYSTEMDECK_URL . 'assets/js/runtime/self-healing-engine.js', ['sd-telemetry-intelligence-engine'], $self_healing_ver, true);

        $pixi_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/vendor/pixi/pixi.min.js') ?: SYSTEMDECK_VERSION);
        $motion_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/vendor/pixi/motion.min.js') ?: SYSTEMDECK_VERSION);
        $pixi_mount_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/sd-pixi-mount.js') ?: SYSTEMDECK_VERSION);
        $pixi_hud_engine_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/pixi-hud-engine.js') ?: SYSTEMDECK_VERSION);
        $metric_pin_renderers_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/MetricPinRenderers.js') ?: SYSTEMDECK_VERSION);
        $widget_asset_loader_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/runtime/widget-asset-loader.js') ?: SYSTEMDECK_VERSION);
        $pin_runtime_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'pins/pin.js') ?: SYSTEMDECK_VERSION);
        $time_monitor_pixi_scene_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'widgets/time-monitor/pixi-scene.js') ?: SYSTEMDECK_VERSION);
        wp_register_script('sd-pixi-vendor', SYSTEMDECK_URL . 'assets/vendor/pixi/pixi.min.js', [], $pixi_ver, true);
        wp_register_script('sd-motion-vendor', SYSTEMDECK_URL . 'assets/vendor/pixi/motion.min.js', [], $motion_ver, true);
        wp_register_script('sd-pixi-mount', SYSTEMDECK_URL . 'assets/js/sd-pixi-mount.js', ['sd-pixi-vendor', 'sd-motion-vendor'], $pixi_mount_ver, true);
        wp_register_script('sd-pixi-hud-engine', SYSTEMDECK_URL . 'assets/js/runtime/pixi-hud-engine.js', ['sd-pixi-mount'], $pixi_hud_engine_ver, true);
        wp_register_script('sd-metric-pin-renderers', SYSTEMDECK_URL . 'assets/js/runtime/MetricPinRenderers.js', ['sd-pixi-hud-engine'], $metric_pin_renderers_ver, true);
        wp_register_script('sd-widget-asset-loader', SYSTEMDECK_URL . 'assets/js/runtime/widget-asset-loader.js', [], $widget_asset_loader_ver, true);
        wp_register_script('sd-pin-base-runtime', SYSTEMDECK_URL . 'pins/pin.js', [], $pin_runtime_ver, true);
        wp_register_script('sd-time-monitor-pixi-scene', SYSTEMDECK_URL . 'widgets/time-monitor/pixi-scene.js', ['sd-pixi-hud-engine'], $time_monitor_pixi_scene_ver, true);
    }

    /**
     * Build a sanitized, ordered manifest of assets required by the provided widgets.
     *
     * @param array<int, string> $active_widgets
     * @return array<int, array<string, mixed>>
     */
    public static function build_widget_asset_manifest(array $active_widgets): array
    {
        if (empty($active_widgets)) {
            return [];
        }

        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : ['widgets' => []];
        $definitions = (array) ($snapshot['widgets'] ?? []);

        $requested_script_handles = [];
        $requested_style_handles = [];

        foreach ($active_widgets as $widget_id) {
            $widget_id = (string) $widget_id;
            if ($widget_id === '' || !isset($definitions[$widget_id]) || !is_array($definitions[$widget_id])) {
                continue;
            }
            $definition = $definitions[$widget_id];
            $assets = is_array($definition['assets'] ?? null) ? $definition['assets'] : [];
            $folder = str_replace('core.', '', $widget_id);

            foreach ((array) ($assets['js'] ?? []) as $js) {
                $js = (string) $js;
                if ($js === '') {
                    continue;
                }
                $js_handle = $js;
                if (
                    preg_match('/\.(js)(\?.*)?$/i', $js) === 1 &&
                    !str_contains($js, '/') &&
                    !str_contains($js, '\\')
                ) {
                    $js_handle = 'sd-widget-' . $folder . '-' . sanitize_key(basename($js, '.js'));
                }
                if (wp_script_is($js_handle, 'registered') || wp_script_is($js_handle, 'enqueued')) {
                    $requested_script_handles[$js_handle] = true;
                }
            }

            foreach ((array) ($assets['css'] ?? []) as $css) {
                $css = (string) $css;
                if ($css === '') {
                    continue;
                }
                $css_handle = $css;
                if (
                    preg_match('/\.(css)(\?.*)?$/i', $css) === 1 &&
                    !str_contains($css, '/') &&
                    !str_contains($css, '\\')
                ) {
                    $css_handle = 'sd-widget-' . $folder . '-' . sanitize_key(basename($css, '.css'));
                }
                if (wp_style_is($css_handle, 'registered') || wp_style_is($css_handle, 'enqueued')) {
                    $requested_style_handles[$css_handle] = true;
                }
            }
        }

        $ordered_script_handles = self::resolve_dependency_order(array_keys($requested_script_handles), 'js');
        $ordered_style_handles = self::resolve_dependency_order(array_keys($requested_style_handles), 'css');

        $manifest = [];
        foreach ($ordered_style_handles as $handle) {
            $entry = self::resolve_registered_asset_entry($handle, 'css');
            if ($entry !== null) {
                $manifest[] = $entry;
            }
        }
        foreach ($ordered_script_handles as $handle) {
            $entry = self::resolve_registered_asset_entry($handle, 'js');
            if ($entry !== null) {
                $manifest[] = $entry;
            }
        }

        return $manifest;
    }

    /**
     * Build a sanitized, ordered manifest of assets required by pin runtime handles.
     *
     * @param array<int, string> $script_handles
     * @param array<int, string> $style_handles
     * @return array<int, array<string, mixed>>
     */
    public static function build_pin_asset_manifest(array $script_handles, array $style_handles = []): array
    {
        if (empty($script_handles) && empty($style_handles)) {
            return [];
        }

        $requested_script_handles = [];
        $requested_style_handles = [];

        foreach ($script_handles as $handle) {
            $handle = (string) $handle;
            if ($handle === '') {
                continue;
            }
            if (wp_script_is($handle, 'registered') || wp_script_is($handle, 'enqueued')) {
                $requested_script_handles[$handle] = true;
            }
        }

        foreach ($style_handles as $handle) {
            $handle = (string) $handle;
            if ($handle === '') {
                continue;
            }
            if (wp_style_is($handle, 'registered') || wp_style_is($handle, 'enqueued')) {
                $requested_style_handles[$handle] = true;
            }
        }

        $ordered_script_handles = self::resolve_dependency_order(array_keys($requested_script_handles), 'js');
        $ordered_style_handles = self::resolve_dependency_order(array_keys($requested_style_handles), 'css');

        $manifest = [];
        foreach ($ordered_style_handles as $handle) {
            $entry = self::resolve_registered_asset_entry($handle, 'css');
            if ($entry !== null) {
                $manifest[] = $entry;
            }
        }
        foreach ($ordered_script_handles as $handle) {
            $entry = self::resolve_registered_asset_entry($handle, 'js');
            if ($entry !== null) {
                $manifest[] = $entry;
            }
        }

        return $manifest;
    }

    /**
     * Resolve dependency order using WP-registered dependencies only.
     *
     * @param array<int, string> $handles
     * @param 'js'|'css' $kind
     * @return array<int, string>
     */
    private static function resolve_dependency_order(array $handles, string $kind): array
    {
        $registry = $kind === 'css' ? wp_styles() : wp_scripts();
        if (!$registry || !is_object($registry) || !isset($registry->registered) || !is_array($registry->registered)) {
            return array_values(array_unique(array_map('strval', $handles)));
        }

        $ordered = [];
        $visiting = [];
        $visited = [];

        $visit = function (string $handle) use (&$visit, &$ordered, &$visiting, &$visited, $registry): void {
            if ($handle === '' || isset($visited[$handle])) {
                return;
            }
            if (isset($visiting[$handle])) {
                return;
            }
            if (!isset($registry->registered[$handle])) {
                return;
            }

            $visiting[$handle] = true;
            $deps = (array) ($registry->registered[$handle]->deps ?? []);
            foreach ($deps as $dep) {
                $visit((string) $dep);
            }
            unset($visiting[$handle]);

            $visited[$handle] = true;
            $ordered[] = $handle;
        };

        foreach ($handles as $handle) {
            $visit((string) $handle);
        }

        return array_values(array_unique($ordered));
    }

    /**
     * @param 'js'|'css' $kind
     * @return array<string, mixed>|null
     */
    private static function resolve_registered_asset_entry(string $handle, string $kind): ?array
    {
        $registry = $kind === 'css' ? wp_styles() : wp_scripts();
        if (!$registry || !isset($registry->registered[$handle])) {
            return null;
        }

        $dependency = $registry->registered[$handle];
        $src = self::resolve_registry_src((string) ($dependency->src ?? ''), $kind);
        if ($src === '') {
            return null;
        }

        $version = isset($dependency->ver) ? (string) $dependency->ver : '';
        if ($version !== '') {
            $src = add_query_arg('ver', $version, $src);
        }

        return [
            'handle' => $handle,
            'src' => $src,
            'deps' => array_values(array_map('strval', (array) ($dependency->deps ?? []))),
            'ver' => $version,
            'required' => true,
            'type' => $kind,
        ];
    }

    /**
     * @param 'js'|'css' $kind
     */
    private static function resolve_registry_src(string $src, string $kind): string
    {
        $src = trim($src);
        if ($src === '') {
            return '';
        }
        if (str_starts_with($src, 'http://') || str_starts_with($src, 'https://') || str_starts_with($src, '//')) {
            return $src;
        }

        $registry = $kind === 'css' ? wp_styles() : wp_scripts();
        $base = is_object($registry) && isset($registry->base_url) ? (string) $registry->base_url : '';
        if ($base === '') {
            $base = site_url('/');
        }

        return rtrim($base, '/') . '/' . ltrim($src, '/');
    }

    // ── Admin / Frontend enqueue ───────────────────────────────────────────────

    public static function enqueue_admin_assets(): void
    {
        if (isset($_GET['sd_embed'])) {
            return;
        }

        // Do not inject SystemDeck shell/common admin styles into block editor
        // contexts. WordPress manages editor iframe assets separately and will
        // warn when classic admin styles are pushed through the wrong channel.
        $is_block_editor_context = false;
        if (is_admin() && function_exists('get_current_screen')) {
            $screen = get_current_screen();
            $is_block_editor_context = (bool) ($screen && method_exists($screen, 'is_block_editor') && $screen->is_block_editor());
        }
        if ($is_block_editor_context) {
            return;
        }

        if (function_exists('wp_enqueue_code_editor')) {
            wp_enqueue_code_editor(['file' => 'note.php']);
            wp_enqueue_style('wp-codemirror');
            wp_enqueue_style('code-editor');
        }
        wp_enqueue_script('wp-tinymce');
        wp_enqueue_script('wp-editor');

        self::register_all();

        foreach (self::get_core_styles() as $style) {
            wp_enqueue_style($style['handle']);
        }
        wp_enqueue_style('wp-components');

        wp_add_inline_style('systemdeck-shell', self::get_dynamic_css());
    }

    public static function enqueue_frontend_assets(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        self::enqueue_admin_assets();
    }

    // ── Cache management ──────────────────────────────────────────────────────

    public static function detect_color_change($meta_id, $object_id, $meta_key, $meta_value): void
    {
        if ($meta_key === 'admin_color') {
            self::clear_css_cache((int) $object_id);
        }
    }

    public static function clear_css_cache(int $user_id): void
    {
        // Delete both layers: transient (cross-request persistence) and object cache (in-request).
        delete_transient(self::get_transient_key($user_id));
        wp_cache_delete(self::get_cache_key($user_id), 'system_deck');
    }

    // ── Dynamic CSS — public entry point ──────────────────────────────────────

    public static function get_dynamic_css(): string
    {
        $user_id = get_current_user_id();
        $cache_key = self::get_cache_key($user_id);
        $cache_group = 'system_deck';

        // 1. Object cache (in-memory, cleared on color change).
        $cached = wp_cache_get($cache_key, $cache_group);
        if ($cached !== false) {
            return (string) $cached;
        }

        // 2. Transient (cross-request, keyed to plugin version).
        $transient_key = self::get_transient_key($user_id);
        $cached = get_transient($transient_key);
        if ($cached !== false) {
            wp_cache_set($cache_key, $cached, $cache_group, HOUR_IN_SECONDS);
            return (string) $cached;
        }

        // 3. Generate fresh CSS.
        $css = self::build_dynamic_css($user_id);

        wp_cache_set($cache_key, $css, $cache_group, HOUR_IN_SECONDS);
        set_transient($transient_key, $css, DAY_IN_SECONDS);
        return $css;
    }

    /**
     * Orchestrates all CSS sections.
     * PHP outputs the per-user scheme values — nothing more.
     * Scheme data is extracted from WP's actual color CSS files (see $schemes).
     */
    private static function build_dynamic_css(int $user_id): string
    {
        $scheme = get_user_option('admin_color') ?: 'fresh';
        $colors = self::$schemes[$scheme] ?? self::$schemes['fresh'];

        $primary = self::resolve_primary_color($colors);
        $secondary = self::resolve_secondary_color($colors);
        $primaryRamp = self::build_color_ramp($primary, 12.0);
        $secondaryRamp = self::build_color_ramp($secondary, 12.0);
        $buttonText = self::resolve_button_text_color($primary);

        $css = "/**\n * SystemDeck Scheme Tokens — User: {$user_id} | Scheme: {$scheme}\n */\n\n";
        $css .= self::get_root_vars($primaryRamp, $secondaryRamp, $buttonText, $user_id, $scheme);
        $css .= self::get_shell_vars($colors, $primaryRamp, $secondaryRamp, $buttonText, $user_id, $scheme);
        $css .= self::get_bridge_vars($colors, $primaryRamp, $secondaryRamp, $buttonText);
        // Dark mode is CSS-only — no PHP vars. See sd-common.css.
        return $css;
    }

    /**
     * Static SD tokens on #systemdeck + only the WP-admin compat props on :root.
     * Everything lives on the shell. The four --wp-admin-theme-color vars stay
     * on :root solely because @wordpress/components looks for them there.
     */
    private static function get_root_vars(
        array $primaryRamp,
        array $secondaryRamp,
        string $buttonText,
        int $user_id,
        string $scheme
    ): string {
        $primary = $primaryRamp['base'];
        $primaryRgb = self::hex_to_rgb($primary);
        $secondary = $secondaryRamp['base'];
        $scope = ':is(:root, #systemdeck, #sd-canvas-root, .sd-canvas-shell, .sd-widget-block-host, .editor-styles-wrapper)';

        // ── Shared runtime scopes (shell + canvas + editor bridge) ───────────
        $css = "{$scope} {\n";
        $css .= "    --sd-success: #00a32a;\n";
        $css .= "    --sd-success-rgb: 0, 163, 42;\n";
        $css .= "    --sd-info: #72aee6;\n";
        $css .= "    --sd-info-rgb: 114, 174, 230;\n";
        $css .= "    --sd-warning: #dba617;\n";
        $css .= "    --sd-warning-rgb: 219, 166, 23;\n";
        $css .= "    --sd-error: #d63638;\n";
        $css .= "    --sd-error-rgb: 214, 54, 56;\n";
        $css .= "    --sd-body-background: #f0f0f1;\n";

        $css .= "    --sd-card-bg: #ffffff;\n";
        $css .= "    --sd-surface-subtle: #f6f7f7;\n";
        $css .= "    --sd-card-header-bg: #f6f7f7;\n";
        $css .= "    --sd-border: #c3c4c7;\n";
        $css .= "    --sd-border-light: #dcdcde;\n";
        $css .= "    --sd-border-dark: #8c8f94;\n";
        $css .= "    --sd-border-subtle: color-mix(in srgb, var(--sd-border) 62%, transparent);\n";
        $css .= "    --sd-text: #3c434a;\n";
        $css .= "    --sd-text-muted: #646970;\n";
        $css .= "    --sd-heading-color: #1d2327;\n";
        $css .= "    --sd-box-shadow: rgba(0, 0, 0, 0.05);\n";
        $css .= "    --sd-widget-shadow: rgba(0, 0, 0, 0.045);\n";
        $css .= "    --sd-widget-shadow-strong: rgba(0, 0, 0, 0.065);\n";
        $css .= "    --sd-widget-inset: color-mix(in srgb, var(--sd-card-bg) 76%, var(--sd-heading-color) 24%);\n";
        $css .= "    --sd-widget-inset-border: color-mix(in srgb, var(--sd-border) 72%, var(--sd-heading-color) 28%);\n";
        $css .= "    --sd-input-bg: #ffffff;\n";
        $css .= "    --sd-input-text: #2c3338;\n";
        $css .= "    --sd-input-border: #8c8f94;\n";
        $css .= "    --sd-input-border-focus: {$primary};\n";
        $css .= "    --sd-focus-ring: color-mix(in srgb, {$primary} 35%, transparent);\n";
        $css .= "    --sd-button-color: {$primary};\n";
        $css .= "    --sd-button-color-hover: {$primaryRamp['strong']};\n";
        $css .= "    --sd-btn-primary-text: {$buttonText};\n";
        $css .= "    --sd-toggle-track-off: #dcdcde;\n";
        $css .= "    --sd-toggle-border-off: #8c8f94;\n";
        $css .= "    --sd-toggle-thumb-off: #50575e;\n";
        $css .= "    --sd-toggle-thumb: #ffffff;\n";
        $css .= "    --sd-toggle-thumb-shadow: rgba(0, 0, 0, 0.04);\n";
        $css .= "    --sd-notification-color: var(--sd-warning);\n";
        $css .= "    --sd-color-accent: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-primary: {$primary};\n";
        $css .= "    --sd-color-primary-soft: {$primaryRamp['soft']};\n";
        $css .= "    --sd-color-primary-strong: {$primaryRamp['strong']};\n";
        $css .= "    --sd-color-secondary: {$secondary};\n";
        $css .= "    --sd-color-secondary-soft: {$secondaryRamp['soft']};\n";
        $css .= "    --sd-color-secondary-strong: {$secondaryRamp['strong']};\n";
        $css .= "    --sd-color-surface-canvas: var(--sd-body-background);\n";
        $css .= "    --sd-color-surface-panel: var(--sd-card-bg);\n";
        $css .= "    --sd-color-surface-panel-soft: var(--sd-surface-subtle);\n";
        $css .= "    --sd-color-border-strong: var(--sd-border);\n";
        $css .= "    --sd-color-grid: var(--sd-border-light);\n";
        $css .= "    --sd-color-grid-strong: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-text-primary: var(--sd-text);\n";
        $css .= "    --sd-color-text-secondary: var(--sd-text-muted);\n";
        $css .= "    --sd-color-text-muted: var(--sd-text-muted);\n";
        $css .= "    --sd-color-source-server: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-source-wordpress: var(--sd-link);\n";
        $css .= "    --sd-color-source-browser: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-state-normal: var(--sd-info);\n";
        $css .= "    --sd-color-state-success: var(--sd-success);\n";
        $css .= "    --sd-color-state-warning: var(--sd-warning);\n";
        $css .= "    --sd-color-state-critical: var(--sd-error);\n";
        $css .= "    --sd-color-glow-low: var(--sd-info);\n";
        $css .= "    --sd-color-glow-mid: var(--sd-color-primary-strong);\n";
        $css .= "    --sd-color-glow-high: var(--sd-error);\n";
        $css .= apply_filters('sd_dynamic_css_extra_root', '', $scheme, $user_id);
        $css .= "}\n\n";

        // ── :root — vars @wordpress/components reads globally ────────────────
        $css .= ":root {\n";
        $css .= "    --wp-admin-theme-color: {$primary};\n";
        $css .= "    --wp-admin-theme-color--rgb: {$primaryRgb};\n";
        $css .= "    --wp-admin-theme-color-darker-10: {$primaryRamp['strong']};\n";
        $css .= "    --wp-admin-theme-color-darker-10--rgb: " . self::hex_to_rgb($primaryRamp['strong']) . ";\n";
        $css .= "    --wp-admin-theme-color-darker-20: color-mix(in srgb, {$primary} 80%, #000 20%);\n";
        $css .= "    --wp-admin-border-width-focus: 1.5px;\n";
        $css .= "    --wp-components-color-accent: {$primary};\n";
        $css .= "    --wp-components-color-accent-darker-10: {$primaryRamp['strong']};\n";
        $css .= "    --sd-color-primary: {$primary};\n";
        $css .= "    --sd-color-primary-soft: {$primaryRamp['soft']};\n";
        $css .= "    --sd-color-primary-strong: {$primaryRamp['strong']};\n";
        $css .= "    --sd-color-secondary: {$secondary};\n";
        $css .= "    --sd-color-secondary-soft: {$secondaryRamp['soft']};\n";
        $css .= "    --sd-color-secondary-strong: {$secondaryRamp['strong']};\n";
        $css .= "    --sd-color-surface-canvas: var(--sd-body-background);\n";
        $css .= "    --sd-color-surface-panel: var(--sd-card-bg);\n";
        $css .= "    --sd-color-surface-panel-soft: var(--sd-surface-subtle);\n";
        $css .= "    --sd-color-border-strong: var(--sd-border);\n";
        $css .= "    --sd-color-grid: var(--sd-border-light);\n";
        $css .= "    --sd-color-grid-strong: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-text-primary: var(--sd-text);\n";
        $css .= "    --sd-color-text-secondary: var(--sd-text-muted);\n";
        $css .= "    --sd-color-text-muted: var(--sd-text-muted);\n";
        $css .= "    --sd-color-source-server: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-source-wordpress: var(--sd-link);\n";
        $css .= "    --sd-color-source-browser: var(--sd-highlight-color);\n";
        $css .= "    --sd-color-state-normal: var(--sd-info);\n";
        $css .= "    --sd-color-state-success: var(--sd-success);\n";
        $css .= "    --sd-color-state-warning: var(--sd-warning);\n";
        $css .= "    --sd-color-state-critical: var(--sd-error);\n";
        $css .= "    --sd-color-glow-low: var(--sd-info);\n";
        $css .= "    --sd-color-glow-mid: var(--sd-color-primary-strong);\n";
        $css .= "    --sd-color-glow-high: var(--sd-error);\n";
        $css .= "}\n\n";

        return $css;
    }

    /**
     * :is(#systemdeck, #sd-canvas-root) block.
     * Outputs every scheme variable the CSS references.
     * Values are exact hex values from WP's color scheme CSS files (see $schemes).
     */
    private static function get_shell_vars(array $colors, array $primaryRamp, array $secondaryRamp, string $buttonText, int $user_id, string $scheme): string
    {
        $scope = ':is(#systemdeck, #sd-canvas-root, .sd-canvas-shell, .sd-widget-block-host, .editor-styles-wrapper)';
        $css = "/** SystemDeck Colors | Scheme: {$scheme} */\n";
        $css .= "{$scope} {\n";
        $css .= "  --sd-menu-background: {$colors['menu-bg']};\n";
        $css .= "  --sd-menu-text: {$colors['menu-text']};\n";
        $css .= "  --sd-menu-highlight-background: {$colors['menu-highlight-bg']};\n";
        $css .= "  --sd-menu-highlight-text: {$colors['menu-highlight-text']};\n";
        $css .= "  --sd-menu-highlight-icon: {$colors['icon-focus']};\n";
        $css .= "  --sd-menu-current-background: {$colors['menu-highlight-bg']};\n";
        $css .= "  --sd-menu-current-text: {$colors['menu-highlight-text']};\n";
        $css .= "  --sd-menu-current-icon: {$colors['menu-highlight-text']};\n";
        $css .= "  --sd-menu-submenu-background: {$colors['submenu-bg']};\n";
        $css .= "  --sd-menu-submenu-text: {$colors['submenu-text']};\n";
        $css .= "  --sd-menu-submenu-focus-text: {$colors['submenu-focus']};\n";
        $css .= "  --sd-menu-icon: {$colors['icon-base']};\n";
        $css .= "  --sd-link: {$primaryRamp['base']};\n";
        $css .= "  --sd-link-focus: {$colors['submenu-focus']};\n";
        $css .= "  --sd-highlight-color: {$colors['menu-highlight-bg']};\n";
        $css .= "  --sd-notification-color: var(--sd-warning);\n";
        $css .= "  --sd-color-accent: var(--sd-highlight-color);\n";
        $css .= "  --sd-color-primary: {$primaryRamp['base']};\n";
        $css .= "  --sd-color-primary-soft: {$primaryRamp['soft']};\n";
        $css .= "  --sd-color-primary-strong: {$primaryRamp['strong']};\n";
        $css .= "  --sd-color-secondary: {$secondaryRamp['base']};\n";
        $css .= "  --sd-color-secondary-soft: {$secondaryRamp['soft']};\n";
        $css .= "  --sd-color-secondary-strong: {$secondaryRamp['strong']};\n";
        $css .= "  --sd-btn-primary-text: {$buttonText};\n";
        $css .= apply_filters('sd_dynamic_css_extra', '', $scheme, $user_id);
        $css .= "}\n\n";
        return $css;
    }

    /**
     * Bridge block for editor iframes / widget-block hosts.
     * These contexts have no #systemdeck ancestor.
     */
    private static function get_bridge_vars(array $colors, array $primaryRamp, array $secondaryRamp, string $buttonText): string
    {
        $css = "/** Editor iframe / widget-block host bridge */\n";
        $css .= ".sd-widget-block-host, .editor-styles-wrapper {\n";
        $css .= "  --sd-menu-background: {$colors['menu-bg']};\n";
        $css .= "  --sd-menu-text: {$colors['menu-text']};\n";
        $css .= "  --sd-highlight-color: {$colors['menu-highlight-bg']};\n";
        $css .= "  --sd-notification-color: var(--sd-warning);\n";
        $css .= "  --sd-color-accent: var(--sd-highlight-color);\n";
        $css .= "  --sd-color-primary: {$primaryRamp['base']};\n";
        $css .= "  --sd-color-primary-soft: {$primaryRamp['soft']};\n";
        $css .= "  --sd-color-primary-strong: {$primaryRamp['strong']};\n";
        $css .= "  --sd-color-secondary: {$secondaryRamp['base']};\n";
        $css .= "  --sd-color-secondary-soft: {$secondaryRamp['soft']};\n";
        $css .= "  --sd-color-secondary-strong: {$secondaryRamp['strong']};\n";
        $css .= "  --sd-btn-primary-text: {$buttonText};\n";
        $css .= "  --sd-link: {$primaryRamp['base']};\n";
        $css .= "  --sd-link-focus: {$colors['submenu-focus']};\n";
        $css .= "}\n\n";
        return $css;
    }

    /**
     * Resolve the base primary action color for the active scheme.
     */
    private static function resolve_primary_color(array $colors): string
    {
        return $colors['menu-highlight-bg'];
    }

    /**
     * Resolve the base secondary scheme color for the active scheme.
     */
    private static function resolve_secondary_color(array $colors): string
    {
        return $colors['menu-bg'];
    }

    private static function build_color_ramp(string $color, float $step = 12.0): array
    {
        if (class_exists('SystemDeck\\Core\\Color')) {
            $palette = (new \SystemDeck\Core\Color($color))->createPalette(3, $step);
            return [
                'strong' => $palette[0] ?? self::darken_hex($color, 10),
                'base' => $palette[1] ?? $color,
                'soft' => $palette[2] ?? self::lighten_hex($color, 10),
            ];
        }

        return [
            'strong' => self::darken_hex($color, 10),
            'base' => $color,
            'soft' => self::lighten_hex($color, 10),
        ];
    }

    /**
     * Resolve a readable text color for a solid background using the shared
     * PHP color utility.
     */
    private static function resolve_button_text_color(string $background): string
    {
        if (class_exists('SystemDeck\\Core\\Color')) {
            return (new \SystemDeck\Core\Color($background))->readable_text_color($background);
        }

        return '#ffffff';
    }

    private static function lighten_hex(string $hex, int $percent): string
    {
        $percent = max(0, min(100, $percent));
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        $factor = $percent / 100;
        $r = (int) round(hexdec(substr($hex, 0, 2)) + (255 - hexdec(substr($hex, 0, 2))) * $factor);
        $g = (int) round(hexdec(substr($hex, 2, 2)) + (255 - hexdec(substr($hex, 2, 2))) * $factor);
        $b = (int) round(hexdec(substr($hex, 4, 2)) + (255 - hexdec(substr($hex, 4, 2))) * $factor);

        return sprintf('#%02x%02x%02x', $r, $g, $b);
    }

    // ── Admin bar ─────────────────────────────────────────────────────────────

    public static function register_admin_bar($wp_admin_bar): void
    {
        $wp_admin_bar->add_node([
            'id' => 'system-deck-toggle',
            'title' => '<span class="ab-icon dashicons-admin-generic"></span>
            <span class="ab-label">SystemDeck</span>',
            'href' => '#',
            'meta' => ['title' => __('Toggle SystemDeck', 'systemdeck'), 'onclick' => 'return false;'],
        ]);
    }

    // ── Color helpers ─────────────────────────────────────────────────────────

    /**
     * Convert hex to comma-separated RGB string for use in CSS custom properties.
     */
    private static function hex_to_rgb(string $hex): string
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        return hexdec(substr($hex, 0, 2)) . ', '
            . hexdec(substr($hex, 2, 2)) . ', '
            . hexdec(substr($hex, 4, 2));
    }

    /**
     * Darken a hex color by a percentage — fallback when Color::createPalette is unavailable.
     */
    private static function darken_hex(string $hex, int $percent): string
    {
        $percent = max(0, min(100, $percent));
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        $factor = 1 - ($percent / 100);
        $r = (int) round(hexdec(substr($hex, 0, 2)) * $factor);
        $g = (int) round(hexdec(substr($hex, 2, 2)) * $factor);
        $b = (int) round(hexdec(substr($hex, 4, 2)) * $factor);
        return sprintf('#%02x%02x%02x', $r, $g, $b);
    }
}
