<?php
/**
 * Registry Service (Mailbox Authority)
 *
 * BUILD-TIME ONLY
 * - Scans widgets
 * - Builds snapshot
 * - Writes mailbox
 *
 * RUNTIME MUST NEVER SCAN
 */
declare(strict_types=1);

namespace SystemDeck\Core\Services;

use SystemDeck\Core\StorageEngine;

if (!defined('ABSPATH')) {
    exit;
}

final class RegistryService
{
    private const OPTION_KEY = 'sd_registry_snapshot';
    private const CONTRACT_VERSION = 2;
    // Empty by default: include all registered dashboard widgets (core + third-party).
    // Integrators may still constrain this via `systemdeck_dashboard_widget_allowlist`.
    private const DASHBOARD_WIDGET_ALLOWLIST_DEFAULT = [];
    private const ALLOWED_VISIBILITY_POLICIES = ['global', 'app_scoped', 'app_root_only', 'hidden'];
    /** @var array<string,string>|null */
    private static ?array $dashboard_plugin_widget_provider_cache = null;

    /**
     * ============================
     * SNAPSHOT READER (RUNTIME)
     * ============================
     */
    public static function get_snapshot(): array
    {
        $snapshot = get_option(self::OPTION_KEY, false);

        if (!is_array($snapshot)) {
            if (self::can_refresh_snapshot_now()) {
                return self::build_snapshot();
            }
            return [
                'generated_at' => 0,
                'version' => SYSTEMDECK_VERSION,
                'checksum' => '',
                'widgets' => [],
            ];
        }

        if (self::needs_refresh($snapshot)) {
            if (self::can_refresh_snapshot_now()) {
                return self::build_snapshot();
            }
            return $snapshot;
        }

        return $snapshot;
    }

    /**
     * ============================
     * SNAPSHOT BUILDER (BUILD STEP)
     * ============================
     */
    public static function build_snapshot(): array
    {
        $snapshot = [
            'generated_at' => time(),
            'version' => SYSTEMDECK_VERSION,
            'checksum' => md5(SYSTEMDECK_VERSION . time()),
            'contract_version' => self::CONTRACT_VERSION,
            'widgets' => [],
        ];

        /**
         * --------------------------------
         * CORE WIDGET SCAN
         * --------------------------------
         */
        $widgets_dir = SYSTEMDECK_PATH . 'widgets/';

        if (is_dir($widgets_dir)) {
            $folders = glob($widgets_dir . '*', GLOB_ONLYDIR);

            foreach ($folders as $folder) {
                $folder_name = basename($folder);
                $widget_file = $folder . '/widget.php';

                if (!file_exists($widget_file)) {
                    continue;
                }

                require_once $widget_file;

                $class = self::folder_to_class_name($folder_name);

                if (!class_exists($class)) {
                    continue;
                }

                // RC Directive: Detect BaseWidget contract
                $is_base_widget = is_subclass_of($class, '\\SystemDeck\\Widgets\\BaseWidget');

                $widget_id = ($is_base_widget && defined("$class::ID") && !empty(constant("$class::ID")))
                    ? constant("$class::ID")
                    : 'core.' . $folder_name;

                $snapshot['widgets'][$widget_id] = [
                    'id' => $widget_id,
                    'title' => self::extract_widget_title($class, $folder_name),
                    'icon' => ($is_base_widget && defined("$class::ICON")) ? constant("$class::ICON") : 'dashicons-admin-generic',
                    'origin' => 'core',
                    'provider_type' => 'core',
                    'provider_name' => 'SystemDeck',
                    'file' => $widget_file,
                    'class' => $class,
                    'assets' => ($is_base_widget && method_exists($class, 'assets')) ? $class::assets() : self::detect_assets($folder),
                    'render_callback' => [$class, 'render'],
                    'app_id' => ($is_base_widget && defined("$class::APP_ID")) ? sanitize_key((string) constant("$class::APP_ID")) : '',
                    'visibility_policy' => ($is_base_widget && defined("$class::VISIBILITY_POLICY"))
                        ? self::normalize_visibility_policy((string) constant("$class::VISIBILITY_POLICY"))
                        : 'global',
                    'seed_on_app_provision' => ($is_base_widget && defined("$class::SEED_ON_APP_PROVISION"))
                        ? (bool) constant("$class::SEED_ON_APP_PROVISION")
                        : false,
                ];
            }
        }

        /**
         * --------------------------------
         * DISCOVERED / LEGACY WIDGETS
         * --------------------------------
         */
        if (class_exists(StorageEngine::class)) {
            $discovered = StorageEngine::get_discovered_widgets();
            $plugin_providers = self::discover_dashboard_widget_plugin_providers();

            foreach ($discovered as $dw) {
                // Canonicalize scanner-sourced dashboard widgets to dashboard.*
                // so rebuilds remain idempotent and do not flip between
                // discovered.* and dashboard.* namespaces across runs.
                $source_id = (string) ($dw['id'] ?? '');
                $widget_id = 'dashboard.' . sanitize_key($source_id);
                $provider_name = $plugin_providers[sanitize_key($source_id)] ?? '';

                $snapshot['widgets'][$widget_id] = [
                    'id' => $widget_id,
                    'title' => $dw['title'] ?: $source_id,
                    'origin' => 'dashboard',
                    'provider_type' => $provider_name !== '' ? 'plugin' : 'core',
                    'provider_name' => $provider_name,
                    'is_legacy' => true,
                    'source_id' => $source_id,
                    'render_callback' => ['SystemDeck\Core\Registry', 'render_discovered_widget_callback'],
                    'app_id' => '',
                    'visibility_policy' => 'global',
                    'seed_on_app_provision' => false,
                ];
            }
        }

        /**
         * --------------------------------
         * DASHBOARD WIDGET DISCOVERY (BUILD STEP)
         * --------------------------------
         */
        $plugin_providers = self::discover_dashboard_widget_plugin_providers();
        foreach (self::discover_dashboard_widgets() as $dw) {
            $widget_id = 'dashboard.' . sanitize_key($dw['id']);
            $provider_name = $plugin_providers[sanitize_key((string) $dw['id'])] ?? '';
            $snapshot['widgets'][$widget_id] = [
                'id' => $widget_id,
                'title' => $dw['title'],
                'origin' => 'dashboard',
                'provider_type' => $provider_name !== '' ? 'plugin' : 'core',
                'provider_name' => $provider_name,
                'is_legacy' => true,
                'source_id' => $dw['id'],
                'tunnel_assets' => $dw['assets'] ?? ['scripts' => [], 'styles' => []],
                'render_callback' => ['SystemDeck\Core\Registry', 'render_discovered_widget_callback'],
                'app_id' => '',
                'visibility_policy' => 'global',
                'seed_on_app_provision' => false,
            ];
        }

        /**
         * --------------------------------
         * DEDUPE DISCOVERED VS DASHBOARD BY SOURCE ID
         * --------------------------------
         *
         * If both entries exist for the same source widget, keep dashboard.*
         * and drop discovered.* to prevent duplicate picker/registry rows.
         */
        $dashboard_sources = [];
        foreach (($snapshot['widgets'] ?? []) as $def) {
            if (!is_array($def) || (($def['origin'] ?? '') !== 'dashboard')) {
                continue;
            }
            $src = sanitize_key((string) ($def['source_id'] ?? ''));
            if ($src !== '') {
                $dashboard_sources[$src] = true;
            }
        }
        if (!empty($dashboard_sources)) {
            foreach (array_keys((array) ($snapshot['widgets'] ?? [])) as $wid) {
                $def = $snapshot['widgets'][$wid] ?? null;
                if (!is_array($def) || (($def['origin'] ?? '') !== 'discovered')) {
                    continue;
                }
                $src = sanitize_key((string) ($def['source_id'] ?? ''));
                if ($src !== '' && isset($dashboard_sources[$src])) {
                    unset($snapshot['widgets'][$wid]);
                }
            }
        }

        /**
         * --------------------------------
         * ADDON / EXTERNAL PROVIDERS (BUILD STEP)
         * --------------------------------
         *
         * Contract:
         * add_filter('systemdeck_registry_collect', function(array $defs, array $context) { ... return $defs; }, 10, 2);
         *
         * Supported widget fields:
         * id, title, origin, suite, render_mode, source_id, class, file, assets, tunnel_assets,
         * context_contract, capability, nonce_scope, version_constraints, render_callback, is_legacy.
         */
        $external_defs = apply_filters('systemdeck_registry_collect', [], [
            'contract_version' => self::CONTRACT_VERSION,
            'systemdeck_version' => SYSTEMDECK_VERSION,
            'generated_at' => $snapshot['generated_at'],
        ]);

        if (is_array($external_defs)) {
            foreach ($external_defs as $def) {
                if (!is_array($def)) {
                    continue;
                }
                $normalized = self::normalize_external_widget_definition($def);
                if ($normalized === null) {
                    continue;
                }

                // External definitions are authoritative for their own IDs.
                $snapshot['widgets'][$normalized['id']] = $normalized;
            }
        }

        update_option(self::OPTION_KEY, $snapshot, false);

        return $snapshot;
    }

    /**
     * ============================
     * REFRESH LOGIC
     * ============================
     */
    private static function needs_refresh($snapshot): bool
    {
        if (!is_array($snapshot) || empty($snapshot['version'])) {
            return true;
        }

        if ((int) ($snapshot['contract_version'] ?? 0) < self::CONTRACT_VERSION) {
            return true;
        }

        if ($snapshot['version'] !== SYSTEMDECK_VERSION) {
            return true;
        }

        $generated_at = (int) ($snapshot['generated_at'] ?? 0);
        if ($generated_at <= 0) {
            return true;
        }

        $widgets_dir = SYSTEMDECK_PATH . 'widgets/';
        if (is_dir($widgets_dir)) {
            $folders = glob($widgets_dir . '*', GLOB_ONLYDIR) ?: [];
            foreach ($folders as $folder) {
                $widget_file = $folder . '/widget.php';
                if (is_file($widget_file) && (int) @filemtime($widget_file) > $generated_at) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function can_refresh_snapshot_now(): bool
    {
        if (!is_admin()) {
            return false;
        }

        if (did_action('admin_init') <= 0) {
            return false;
        }

        return true;
    }

    /**
     * ============================
     * ASSET ENQUEUE (RUNTIME SAFE)
     * ============================
     */
    public static function enqueue_widget_assets(string $widget_id): void
    {
        $snapshot = self::get_snapshot();

        if (!isset($snapshot['widgets'][$widget_id])) {
            return;
        }

        $widget = $snapshot['widgets'][$widget_id];

        if (($widget['origin'] ?? '') !== 'core') {
            return;
        }

        self::enqueue_widget_runtime_dependencies($widget);

        if (empty($widget['assets'])) {
            return;
        }

        $folder = str_replace('core.', '', $widget_id);
        $base = SYSTEMDECK_URL . 'widgets/' . $folder . '/';
        $style_deps = [];
        foreach (['systemdeck-shell', 'systemdeck-runtime-style', 'systemdeck-runtime', 'sd-common'] as $dep) {
            if (wp_style_is($dep, 'registered') || wp_style_is($dep, 'enqueued')) {
                $style_deps[] = $dep;
            }
        }

        foreach ($widget['assets']['css'] ?? [] as $css) {
            $css = (string) $css;
            if ($css === '') {
                continue;
            }
            if (wp_style_is($css, 'registered')) {
                $css_handle = $css;
                wp_enqueue_style($css);
            } elseif (self::looks_like_handle_token($css)) {
                // Handle tokens (e.g. sd-player-style) must be registered upstream.
                continue;
            } else {
                $css_handle = 'sd-widget-' . $folder . '-' . sanitize_key(basename($css, '.css'));
                wp_enqueue_style(
                    $css_handle,
                    $base . $css,
                    $style_deps,
                    SYSTEMDECK_VERSION
                );
            }

            if ($widget_id === 'core.vault' && $css_handle === 'sd-widget-vault-sd-vault-media') {
                wp_add_inline_style(
                    $css_handle,
                    '#sd-vault-details-modal{--sd-vault-mejs-controls-url:url("' . esc_url_raw(includes_url('js/mediaelement/mejs-controls.svg')) . '");}'
                );
            }
        }

        foreach ($widget['assets']['js'] ?? [] as $js) {
            $js = (string) $js;
            if ($js === '') {
                continue;
            }
            if (wp_script_is($js, 'registered')) {
                wp_enqueue_script($js);
            } elseif (self::looks_like_handle_token($js)) {
                // Handle tokens (e.g. sd-telemetry-stream-engine) must be registered upstream.
                continue;
            } else {
                $js_handle = 'sd-widget-' . $folder . '-' . sanitize_key(basename($js, '.js'));
                wp_enqueue_script(
                    $js_handle,
                    $base . $js,
                    ['jquery'],
                    SYSTEMDECK_VERSION,
                    true
                );
            }
        }
    }

    /**
     * Enqueue widget-level runtime dependencies that cannot be expressed as
     * simple script/style handles.
     *
     * @param array<string,mixed> $widget
     */
    private static function enqueue_widget_runtime_dependencies(array $widget): void
    {
        $class = (string) ($widget['class'] ?? '');
        if (
            $class === '' ||
            !class_exists($class) ||
            !is_subclass_of($class, '\\SystemDeck\\Widgets\\BaseWidget') ||
            !method_exists($class, 'requires_wp_media') ||
            !$class::requires_wp_media()
        ) {
            return;
        }

        if (function_exists('wp_enqueue_media')) {
            wp_enqueue_media();
        }

        if (wp_script_is('media-grid', 'registered')) {
            wp_enqueue_script('media-grid');
        }

        if (wp_script_is('media', 'registered')) {
            wp_enqueue_script('media');
        }

        if (wp_style_is('wp-mediaelement', 'registered')) {
            wp_enqueue_style('wp-mediaelement');
        }

        if (wp_script_is('wp-mediaelement', 'registered')) {
            wp_enqueue_script('wp-mediaelement');
        }

        if (wp_script_is('mediaelement-vimeo', 'registered')) {
            wp_enqueue_script('mediaelement-vimeo');
        }

        if (wp_style_is('sd-player-style', 'registered')) {
            wp_enqueue_style('sd-player-style');
        }

        if (wp_script_is('sd-player-app', 'registered')) {
            wp_enqueue_script('sd-player-app');
        }
    }

    private static function looks_like_handle_token(string $asset): bool
    {
        $asset = trim($asset);
        if ($asset === '') {
            return false;
        }

        // Paths/URLs are file references, not handles.
        if (str_contains($asset, '/') || str_contains($asset, '\\') || str_starts_with($asset, 'http://') || str_starts_with($asset, 'https://')) {
            return false;
        }

        // Extension-bearing tokens (style.css, app.js) are file references.
        if ((bool) preg_match('/\.(css|js)(\?.*)?$/i', $asset)) {
            return false;
        }

        return true;
    }

    /**
     * ============================
     * HELPERS (PRIVATE)
     * ============================
     */
    private static function folder_to_class_name(string $folder_name): string
    {
        $parts = explode('-', $folder_name);
        $base = implode('', array_map('ucfirst', $parts));

        $with = '\\SystemDeck\\Widgets\\' . $base . 'Widget';
        $plain = '\\SystemDeck\\Widgets\\' . $base;

        return class_exists($with) ? $with : $plain;
    }

    private static function extract_widget_title(string $class, string $folder_name): string
    {
        if (defined("$class::TITLE")) {
            return constant("$class::TITLE");
        }

        return ucwords(str_replace('-', ' ', $folder_name));
    }

    private static function detect_assets(string $folder): array
    {
        $assets = ['css' => [], 'js' => []];

        if (file_exists($folder . '/style.css')) {
            $assets['css'][] = 'style.css';
        }

        if (file_exists($folder . '/app.js')) {
            $assets['js'][] = 'app.js';
        }

        return $assets;
    }

    /**
     * Collect current dashboard meta boxes as discoverable widgets.
     * Runs only during explicit snapshot build.
     *
     * @return array<int, array{id:string,title:string,assets:array{scripts:array<int, array<string,mixed>>,styles:array<int, array<string,mixed>>}}>
     */
    private static function discover_dashboard_widgets(bool $apply_allowlist = true): array
    {
        $allowlist = self::get_dashboard_widget_allowlist();
        $has_allowlist = !empty($allowlist);

        if (!is_admin()) {
            return [];
        }

        if (!function_exists('wp_dashboard_setup')) {
            require_once ABSPATH . 'wp-admin/includes/dashboard.php';
        }
        if (!class_exists('WP_Screen') && file_exists(ABSPATH . 'wp-admin/includes/class-wp-screen.php')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
        }
        if (!function_exists('set_current_screen')) {
            require_once ABSPATH . 'wp-admin/includes/screen.php';
        }

        global $pagenow, $typenow, $title, $current_screen;
        $pagenow = 'index.php';
        $typenow = '';
        $title = 'Dashboard';

        if (function_exists('set_current_screen')) {
            set_current_screen('dashboard');
        }
        if (is_object($current_screen)) {
            $current_screen->id = 'dashboard';
            $current_screen->base = 'dashboard';
        }

        // Some plugins register dashboard widgets on these hooks.
        do_action('admin_init');
        do_action('load-index.php');

        wp_dashboard_setup();

        $script_pool = self::collect_enqueued_assets('script');
        $style_pool = self::collect_enqueued_assets('style');

        global $wp_meta_boxes;
        $results = [];
        $dashboard = $wp_meta_boxes['dashboard'] ?? [];

        foreach ((array) $dashboard as $contexts) {
            foreach ((array) $contexts as $widgets) {
                foreach ((array) $widgets as $widget_id => $def) {
                    if (!is_string($widget_id) || $widget_id === '') {
                        continue;
                    }
                    // Default behavior: allow all discovered dashboard widgets.
                    // Optional allowlist can still be provided via filter to constrain output.
                    if ($apply_allowlist && $has_allowlist && !isset($allowlist[$widget_id])) {
                        continue;
                    }
                    $title = is_array($def) ? (string) ($def['title'] ?? '') : '';
                    if ($title === '') {
                        $title = $widget_id;
                    }
                    $results[$widget_id] = [
                        'id' => $widget_id,
                        'title' => wp_strip_all_tags($title),
                        'assets' => self::infer_widget_assets($widget_id, $script_pool, $style_pool),
                    ];
                }
            }
        }

        return array_values($results);
    }

    /**
     * Scanner-only feed: expose all currently registered dashboard widgets,
     * bypassing the runtime allowlist used by snapshot construction.
     *
     * @return array<int, array{id:string,title:string,assets:array{scripts:array<int, array<string,mixed>>,styles:array<int, array<string,mixed>>}}>
     */
    public static function discover_dashboard_widgets_for_scanner(): array
    {
        return self::discover_dashboard_widgets(false);
    }

    /**
     * Refresh scanner cache table with current dashboard widget candidates.
     * This keeps Discovery Scanner inventory current after plugin/theme changes
     * without requiring a manual scan step.
     */
    public static function refresh_discovered_widget_cache(): int
    {
        global $wpdb;

        if (!isset($wpdb) || !is_object($wpdb)) {
            return 0;
        }

        $table = $wpdb->prefix . 'sd_discovered_widgets';
        $exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
        if ($exists !== $table) {
            return 0;
        }

        $rows = [];

        // Source A: current snapshot (already rebuilt by caller in most flows).
        $snapshot = self::get_snapshot();
        foreach ((array) ($snapshot['widgets'] ?? []) as $wid => $def) {
            $wid = (string) $wid;
            if (str_starts_with($wid, 'dashboard.')) {
                $source_id = substr($wid, strlen('dashboard.'));
            } elseif (str_starts_with($wid, 'discovered.')) {
                $source_id = substr($wid, strlen('discovered.'));
            } else {
                continue;
            }

            $source_id = sanitize_key($source_id);
            if ($source_id === '' || str_starts_with($source_id, 'sd_')) {
                continue;
            }

            $title = sanitize_text_field((string) ($def['title'] ?? $source_id));
            if ($title === '') {
                $title = $source_id;
            }

            $rows[$source_id] = [
                'id' => $source_id,
                'title' => $title,
                'origin' => 'auto_scan',
            ];
        }

        // Source B/C fallback candidates (settings + active plugin source parse).
        // Important: settings can retain stale IDs after plugin removal, so only
        // admit settings-derived candidates when corroborated by plugin-source
        // evidence from currently active plugins.
        $plugin_candidates = self::discover_dashboard_widget_candidates_from_active_plugins();
        $plugin_candidate_index = [];
        foreach ((array) $plugin_candidates as $candidate) {
            $pid = sanitize_key((string) ($candidate['id'] ?? ''));
            if ($pid !== '') {
                $plugin_candidate_index[$pid] = true;
            }
        }

        foreach ((array) $plugin_candidates as $candidate) {
            $source_id = sanitize_key((string) ($candidate['id'] ?? ''));
            if ($source_id === '' || str_starts_with($source_id, 'sd_')) {
                continue;
            }
            if (isset($rows[$source_id])) {
                continue;
            }

            $title = sanitize_text_field((string) ($candidate['title'] ?? $source_id));
            if ($title === '') {
                $title = $source_id;
            }

            $rows[$source_id] = [
                'id' => $source_id,
                'title' => $title,
                'origin' => 'auto_scan',
            ];
        }

        $settings_candidates = self::discover_dashboard_widget_candidates_from_settings();
        foreach ((array) $settings_candidates as $candidate) {
            $source_id = sanitize_key((string) ($candidate['id'] ?? ''));
            if ($source_id === '' || str_starts_with($source_id, 'sd_')) {
                continue;
            }
            if (isset($rows[$source_id])) {
                continue;
            }
            if (!isset($plugin_candidate_index[$source_id])) {
                continue;
            }

            $title = sanitize_text_field((string) ($candidate['title'] ?? $source_id));
            if ($title === '') {
                $title = $source_id;
            }

            $rows[$source_id] = [
                'id' => $source_id,
                'title' => $title,
                'origin' => 'auto_scan',
            ];
        }

        $count = 0;
        foreach ($rows as $row) {
            $wpdb->query(
                $wpdb->prepare(
                    "INSERT INTO $table (widget_id, title, origin)
                     VALUES (%s, %s, %s)
                     ON DUPLICATE KEY UPDATE title = VALUES(title), origin = VALUES(origin)",
                    (string) $row['id'],
                    (string) $row['title'],
                    (string) $row['origin']
                )
            );
            $count++;
        }

        // Prune stale discovery-cache rows that are no longer part of current
        // discovery result (e.g., plugin was deactivated/deleted and left
        // persistent dashboard setting IDs behind).
        $current_ids = array_keys($rows);
        if (empty($current_ids)) {
            $wpdb->query("DELETE FROM $table WHERE origin IN ('auto_scan','deep_scan')");
        } else {
            $placeholders = implode(',', array_fill(0, count($current_ids), '%s'));
            $params = array_merge($current_ids);
            $query = "DELETE FROM $table WHERE origin IN ('auto_scan','deep_scan') AND widget_id NOT IN ($placeholders)";
            $wpdb->query($wpdb->prepare($query, ...$params));
        }

        return $count;
    }

    /**
     * Scanner fallback feed:
     * Collect dashboard widget IDs from persistent WP dashboard settings even
     * when a plugin conditionally skips live registration in this request.
     *
     * @return array<int, array{id:string,title:string}>
     */
    public static function discover_dashboard_widget_candidates_from_settings(): array
    {
        $ids = [];

        // Global dashboard widget options frequently keep widget IDs as keys.
        $widget_options = get_option('dashboard_widget_options', []);
        if (is_array($widget_options)) {
            foreach (array_keys($widget_options) as $k) {
                $id = sanitize_key((string) $k);
                if ($id !== '') {
                    $ids[$id] = true;
                }
            }
        }

        // Per-user dashboard ordering often references widget IDs even when hidden.
        $order_raw = get_user_meta(get_current_user_id(), 'meta-box-order_dashboard', true);
        $parsed = [];
        if (is_string($order_raw) && $order_raw !== '') {
            parse_str($order_raw, $parsed);
        } elseif (is_array($order_raw)) {
            // Some installs/plugins may persist this value as structured array.
            $parsed = $order_raw;
        }
        if (is_array($parsed)) {
            $queue = array_values($parsed);
            while (!empty($queue)) {
                $value = array_shift($queue);
                if (is_array($value)) {
                    foreach ($value as $nested) {
                        $queue[] = $nested;
                    }
                    continue;
                }
                if (!is_scalar($value)) {
                    continue;
                }
                foreach (explode(',', (string) $value) as $part) {
                    $id = sanitize_key(trim((string) $part));
                    if ($id !== '') {
                        $ids[$id] = true;
                    }
                }
            }
        }

        // Closed widgets list is another useful source of existing IDs.
        $closed = get_user_meta(get_current_user_id(), 'closedpostboxes_dashboard', true);
        if (is_array($closed)) {
            foreach ($closed as $part) {
                $id = sanitize_key((string) $part);
                if ($id !== '') {
                    $ids[$id] = true;
                }
            }
        }

        $rows = [];
        foreach (array_keys($ids) as $id) {
            if ($id === '' || str_starts_with($id, 'sd_')) {
                continue;
            }

            $title = ucwords(str_replace(['-', '_'], ' ', $id));
            $rows[] = [
                'id' => $id,
                'title' => $title,
            ];
        }

        return $rows;
    }

    /**
     * Scanner fallback feed:
     * Parse active plugin PHP source for `wp_add_dashboard_widget()` calls to
     * recover dashboard widget IDs even when runtime conditions prevent widget
     * registration in the current request.
     *
     * @return array<int, array{id:string,title:string}>
     */
    public static function discover_dashboard_widget_candidates_from_active_plugins(): array
    {
        $rows = [];
        foreach (array_keys(self::discover_dashboard_widget_plugin_providers()) as $id) {
            if ($id === '' || str_starts_with($id, 'sd_')) {
                continue;
            }
            $rows[] = [
                'id' => $id,
                'title' => ucwords(str_replace(['-', '_'], ' ', $id)),
                'provider_name' => '',
            ];
        }

        return $rows;
    }

    /**
     * @return array<string,string>
     */
    private static function discover_dashboard_widget_plugin_providers(): array
    {
        if (is_array(self::$dashboard_plugin_widget_provider_cache)) {
            return self::$dashboard_plugin_widget_provider_cache;
        }

        if (!function_exists('get_option')) {
            return self::$dashboard_plugin_widget_provider_cache = [];
        }

        if (!function_exists('get_plugin_data')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $active = (array) get_option('active_plugins', []);
        if (is_multisite() && function_exists('get_site_option')) {
            $network = (array) get_site_option('active_sitewide_plugins', []);
            foreach (array_keys($network) as $plugin_file) {
                if (!in_array($plugin_file, $active, true)) {
                    $active[] = $plugin_file;
                }
            }
        }

        $providers = [];
        $pattern = '/wp_add_dashboard_widget\s*\(\s*[\'"]([^\'"]+)[\'"]/i';

        foreach ($active as $plugin_file) {
            $plugin_file = (string) $plugin_file;
            if ($plugin_file === '') {
                continue;
            }

            $plugin_path = WP_PLUGIN_DIR . '/' . $plugin_file;
            if (!file_exists($plugin_path)) {
                continue;
            }

            $plugin_data = get_plugin_data($plugin_path, false, false);
            $plugin_name = sanitize_text_field((string) ($plugin_data['Name'] ?? ''));
            if ($plugin_name === '') {
                $plugin_name = sanitize_text_field((string) basename(dirname($plugin_file)));
            }

            $plugin_root = dirname($plugin_path);
            if (!is_dir($plugin_root)) {
                continue;
            }

            try {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($plugin_root, \FilesystemIterator::SKIP_DOTS)
                );
            } catch (\Throwable $e) {
                continue;
            }

            foreach ($iterator as $fileInfo) {
                /** @var \SplFileInfo $fileInfo */
                $path = $fileInfo->getPathname();
                if (!is_string($path) || substr($path, -4) !== '.php') {
                    continue;
                }
                if (strpos($path, '/vendor/') !== false || strpos($path, '/node_modules/') !== false) {
                    continue;
                }
                if ($fileInfo->getSize() > 512000) {
                    continue;
                }

                $contents = @file_get_contents($path);
                if (!is_string($contents) || $contents === '') {
                    continue;
                }

                if (preg_match_all($pattern, $contents, $matches)) {
                    foreach ((array) ($matches[1] ?? []) as $rawId) {
                        $id = sanitize_key((string) $rawId);
                        if ($id !== '' && !isset($providers[$id])) {
                            $providers[$id] = $plugin_name;
                        }
                    }
                }
            }
        }

        self::$dashboard_plugin_widget_provider_cache = $providers;
        return self::$dashboard_plugin_widget_provider_cache;
    }

    /**
     * @return array<string,bool>
     */
    private static function get_dashboard_widget_allowlist(): array
    {
        $raw = apply_filters(
            'systemdeck_dashboard_widget_allowlist',
            self::DASHBOARD_WIDGET_ALLOWLIST_DEFAULT
        );

        if (!is_array($raw)) {
            return [];
        }

        $normalized = [];
        foreach ($raw as $candidate) {
            $id = sanitize_key((string) $candidate);
            if ($id === '') {
                continue;
            }
            $normalized[$id] = true;
        }

        return $normalized;
    }

    /**
     * Capture enqueued assets at dashboard discovery time (build-step only).
     *
     * @param string $kind 'script'|'style'
     * @return array<int, array<string,mixed>>
     */
    private static function collect_enqueued_assets(string $kind): array
    {
        $registry = ($kind === 'style') ? wp_styles() : wp_scripts();
        if (!is_object($registry) || empty($registry->queue) || !is_array($registry->queue)) {
            return [];
        }

        $assets = [];
        foreach ($registry->queue as $handle) {
            if (!is_string($handle) || $handle === '') {
                continue;
            }

            $entry = $registry->registered[$handle] ?? null;
            if (!is_object($entry)) {
                continue;
            }

            $src = is_string($entry->src ?? null) ? $entry->src : '';
            if ($src === '') {
                continue;
            }

            // Keep third-party/plugin assets only; omit wp core/admin bundles.
            if (strpos($src, '/wp-includes/') !== false || strpos($src, '/wp-admin/') !== false) {
                continue;
            }

            $assets[] = [
                'handle' => $handle,
                'src' => $src,
                'deps' => is_array($entry->deps ?? null) ? array_values($entry->deps) : [],
            ];
        }

        return $assets;
    }

    /**
     * Infer likely widget-specific assets from available dashboard asset pools.
     *
     * @param array<int, array<string,mixed>> $script_pool
     * @param array<int, array<string,mixed>> $style_pool
     * @return array{scripts:array<int, array<string,mixed>>,styles:array<int, array<string,mixed>>}
     */
    private static function infer_widget_assets(string $widget_id, array $script_pool, array $style_pool): array
    {
        $tokens = preg_split('/[^a-z0-9]+/i', strtolower($widget_id)) ?: [];
        $tokens = array_values(array_filter($tokens, static function ($t) {
            return is_string($t) && strlen($t) >= 3;
        }));

        // Normalize common aliases so wpseo widgets can match yoast handles and vice versa.
        if (in_array('wpseo', $tokens, true) && !in_array('yoast', $tokens, true)) {
            $tokens[] = 'yoast';
            $tokens[] = 'seo';
        }
        if (in_array('yoast', $tokens, true) && !in_array('wpseo', $tokens, true)) {
            $tokens[] = 'wpseo';
        }

        $match_assets = static function (array $pool) use ($tokens): array {
            $matched = [];
            foreach ($pool as $asset) {
                $haystack = strtolower((string) ($asset['handle'] ?? '') . ' ' . (string) ($asset['src'] ?? ''));
                foreach ($tokens as $token) {
                    if (strpos($haystack, $token) !== false) {
                        $matched[] = $asset;
                        break;
                    }
                }
            }
            return $matched;
        };

        return [
            'scripts' => $match_assets($script_pool),
            'styles' => $match_assets($style_pool),
        ];
    }

    /**
     * Normalize and validate external/addon widget definitions.
     *
     * @param array<string,mixed> $def
     * @return array<string,mixed>|null
     */
    private static function normalize_external_widget_definition(array $def): ?array
    {
        $id = sanitize_text_field((string) ($def['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $title = sanitize_text_field((string) ($def['title'] ?? $id));
        $origin = sanitize_key((string) ($def['origin'] ?? 'addon'));
        $suite = sanitize_text_field((string) ($def['suite'] ?? 'external'));
        $render_mode = sanitize_key((string) ($def['render_mode'] ?? 'tunnel'));

        $allowed_render_modes = ['php', 'tunnel', 'plugin_tunnel', 'react_hosted'];
        if (!in_array($render_mode, $allowed_render_modes, true)) {
            $render_mode = 'tunnel';
        }

        $normalized = [
            'id' => $id,
            'title' => $title,
            'origin' => $origin,
            'provider_type' => sanitize_key((string) ($def['provider_type'] ?? '')),
            'provider_name' => sanitize_text_field((string) ($def['provider_name'] ?? '')),
            'suite' => $suite,
            'render_mode' => $render_mode,
            'source_id' => sanitize_text_field((string) ($def['source_id'] ?? '')),
            'is_legacy' => (bool) ($def['is_legacy'] ?? false),
            'capability' => sanitize_text_field((string) ($def['capability'] ?? 'manage_options')),
            'nonce_scope' => sanitize_text_field((string) ($def['nonce_scope'] ?? 'systemdeck_runtime')),
            'assets' => self::normalize_assets_contract($def['assets'] ?? []),
            'tunnel_assets' => self::normalize_tunnel_assets_contract($def['tunnel_assets'] ?? []),
            'context_contract' => self::normalize_context_contract($def['context_contract'] ?? []),
            'version_constraints' => is_array($def['version_constraints'] ?? null) ? $def['version_constraints'] : [],
            'app_id' => sanitize_key((string) ($def['app_id'] ?? '')),
            'visibility_policy' => self::normalize_visibility_policy((string) ($def['visibility_policy'] ?? 'global')),
            'seed_on_app_provision' => (bool) ($def['seed_on_app_provision'] ?? false),
        ];

        if (!empty($def['class']) && is_string($def['class'])) {
            $normalized['class'] = ltrim($def['class'], '\\');
        }

        if (!empty($def['file']) && is_string($def['file'])) {
            $normalized['file'] = $def['file'];
        }

        if (!empty($def['render_callback']) && is_array($def['render_callback']) && count($def['render_callback']) === 2) {
            $normalized['render_callback'] = $def['render_callback'];
        }
        if (!empty($def['callback']) && is_array($def['callback']) && count($def['callback']) === 2) {
            $normalized['callback'] = $def['callback'];
        }

        return $normalized;
    }

    /**
     * @param mixed $assets
     * @return array{css:array<int,string>,js:array<int,string>}
     */
    private static function normalize_assets_contract($assets): array
    {
        if (!is_array($assets)) {
            return ['css' => [], 'js' => []];
        }

        $css = array_values(array_filter(array_map('strval', (array) ($assets['css'] ?? []))));
        $js = array_values(array_filter(array_map('strval', (array) ($assets['js'] ?? []))));

        return ['css' => $css, 'js' => $js];
    }

    /**
     * @param mixed $assets
     * @return array{scripts:array<int,array<string,mixed>>,styles:array<int,array<string,mixed>>}
     */
    private static function normalize_tunnel_assets_contract($assets): array
    {
        if (!is_array($assets)) {
            return ['scripts' => [], 'styles' => []];
        }

        $normalize_list = static function ($list): array {
            if (!is_array($list)) {
                return [];
            }
            $out = [];
            foreach ($list as $item) {
                if (is_string($item) && $item !== '') {
                    $out[] = ['handle' => sanitize_text_field($item)];
                    continue;
                }
                if (!is_array($item)) {
                    continue;
                }
                $handle = sanitize_text_field((string) ($item['handle'] ?? ''));
                if ($handle === '') {
                    continue;
                }
                $out[] = [
                    'handle' => $handle,
                    'src' => isset($item['src']) ? (string) $item['src'] : '',
                    'deps' => is_array($item['deps'] ?? null) ? array_values($item['deps']) : [],
                ];
            }
            return $out;
        };

        return [
            'scripts' => $normalize_list($assets['scripts'] ?? []),
            'styles' => $normalize_list($assets['styles'] ?? []),
        ];
    }

    /**
     * @param mixed $contract
     * @return array{required_globals:array<string,mixed>,events:array<int,string>,required_selectors:array<int,string>,hidden_toggles:array<int,string>}
     */
    private static function normalize_context_contract($contract): array
    {
        if (!is_array($contract)) {
            return [
                'required_globals' => [],
                'events' => [],
                'required_selectors' => [],
                'hidden_toggles' => [],
            ];
        }

        return [
            'required_globals' => is_array($contract['required_globals'] ?? null) ? $contract['required_globals'] : [],
            'events' => array_values(array_filter(array_map('strval', (array) ($contract['events'] ?? [])))),
            'required_selectors' => array_values(array_filter(array_map('strval', (array) ($contract['required_selectors'] ?? [])))),
            'hidden_toggles' => array_values(array_filter(array_map('strval', (array) ($contract['hidden_toggles'] ?? [])))),
        ];
    }

    private static function normalize_visibility_policy(string $policy): string
    {
        $normalized = sanitize_key($policy);
        if (!in_array($normalized, self::ALLOWED_VISIBILITY_POLICIES, true)) {
            return 'global';
        }
        return $normalized;
    }
}
