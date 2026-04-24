<?php

/**
 * SystemDeck – Dashboard Tunnel (Universal Drop-In)
 *
 * A clean-room iframe environment that can render ANY WordPress
 * dashboard widget (PHP or React-based) without admin chrome,
 * padding artifacts, or lifecycle breakage.
 */

declare(strict_types=1);

namespace SystemDeck\Modules;

use SystemDeck\Core\Services\RegistryService;

if (!defined('ABSPATH')) {
    exit;
}

final class DashboardTunnel
{
    private static function is_debug_mode(): bool
    {
        return isset($_GET['sd_tunnel_debug']) && (string) $_GET['sd_tunnel_debug'] === '1';
    }

    private static function get_widget_profile(string $widget_id): array
    {
        $profile = [
            'name' => 'default',
            'scripts' => [],
            'styles' => [],
            'required_globals' => [],
            'events' => ['wp-dashboard-ready'],
            'hidden_toggles' => ['%widget_id%-hide'],
            'required_selectors' => [],
        ];

        $snapshot_widget = self::resolve_snapshot_widget_definition($widget_id);
        $snapshot_context = is_array($snapshot_widget['context_contract'] ?? null) ? $snapshot_widget['context_contract'] : [];

        if (strpos($widget_id, 'wpseo') === 0) {
            $profile['name'] = 'yoast';
            $profile['scripts'] = [
                'yoast-seo-admin-global',
                'yoast-seo-dashboard-widget',
                'yoast-seo-wincher-dashboard-widget',
            ];
            $profile['styles'] = [
                'yoast-seo-admin-global',
                'yoast-seo-wp-dashboard',
                'yoast-seo-monorepo',
            ];
            $profile['required_globals'] = [
                'wpseoDashboardWidgetL10n' => [
                    'feed_header' => 'Latest',
                    'feed_footer' => '',
                    'wp_version' => '6.0',
                    'php_version' => '8.0',
                ],
                'wpseoAdminGlobalL10n' => [
                    'isRtl' => '0',
                    'wincher_is_logged_in' => '0',
                ],
                'wpseoWincherDashboardWidgetL10n' => [
                    'wincher_is_logged_in' => '0',
                    'wincher_website_id' => '',
                ],
            ];
            $profile['events'] = ['wp-dashboard-ready', 'yoast:ready'];
            $profile['required_selectors'] = [
                '#yoast-seo-dashboard-widget',
                '#yoast-seo-wincher-dashboard-widget',
            ];
        }

        $snapshot_assets = self::resolve_snapshot_asset_handles($widget_id);
        if (!empty($snapshot_assets['scripts'])) {
            $profile['scripts'] = array_values(array_unique(array_merge($profile['scripts'], $snapshot_assets['scripts'])));
        }
        if (!empty($snapshot_assets['styles'])) {
            $profile['styles'] = array_values(array_unique(array_merge($profile['styles'], $snapshot_assets['styles'])));
        }

        if (!empty($snapshot_context['required_globals']) && is_array($snapshot_context['required_globals'])) {
            $profile['required_globals'] = array_merge($profile['required_globals'], $snapshot_context['required_globals']);
        }
        if (!empty($snapshot_context['events']) && is_array($snapshot_context['events'])) {
            $profile['events'] = array_values(array_unique(array_merge($profile['events'], array_map('strval', $snapshot_context['events']))));
        }
        if (!empty($snapshot_context['required_selectors']) && is_array($snapshot_context['required_selectors'])) {
            $profile['required_selectors'] = array_values(array_unique(array_merge($profile['required_selectors'], array_map('strval', $snapshot_context['required_selectors']))));
        }
        if (!empty($snapshot_context['hidden_toggles']) && is_array($snapshot_context['hidden_toggles'])) {
            $profile['hidden_toggles'] = array_values(array_unique(array_merge($profile['hidden_toggles'], array_map('strval', $snapshot_context['hidden_toggles']))));
        }

        return $profile;
    }

    /**
     * Locate a widget definition in snapshot by canonical key or source_id.
     *
     * @return array<string,mixed>|null
     */
    private static function resolve_snapshot_widget_definition(string $widget_id): ?array
    {
        if (!class_exists(RegistryService::class)) {
            return null;
        }

        $snapshot = RegistryService::get_snapshot();
        $widgets = (array) ($snapshot['widgets'] ?? []);
        if (empty($widgets)) {
            return null;
        }

        // Common runtime key for discovered/dashboard widgets.
        $candidates = [
            'dashboard.' . sanitize_key($widget_id),
            'discovered.' . sanitize_key($widget_id),
            sanitize_text_field($widget_id),
        ];

        foreach ($candidates as $key) {
            if (isset($widgets[$key]) && is_array($widgets[$key])) {
                return $widgets[$key];
            }
        }

        foreach ($widgets as $w) {
            if (!is_array($w)) {
                continue;
            }
            if ((string) ($w['source_id'] ?? '') === $widget_id || (string) ($w['id'] ?? '') === $widget_id) {
                return $w;
            }
        }

        return null;
    }

    /**
     * Read inferred tunnel assets from the registry snapshot for this widget.
     *
     * @return array{scripts:array<int,string>,styles:array<int,string>}
     */
    private static function resolve_snapshot_asset_handles(string $widget_id): array
    {
        $result = ['scripts' => [], 'styles' => []];

        if (!class_exists(RegistryService::class)) {
            return $result;
        }

        $snapshot = RegistryService::get_snapshot();
        $widgets = (array) ($snapshot['widgets'] ?? []);
        if (empty($widgets)) {
            return $result;
        }

        $def = self::resolve_snapshot_widget_definition($widget_id);

        if (!is_array($def) || empty($def['tunnel_assets']) || !is_array($def['tunnel_assets'])) {
            return $result;
        }

        foreach ((array) ($def['tunnel_assets']['scripts'] ?? []) as $asset) {
            $h = is_array($asset) ? (string) ($asset['handle'] ?? '') : '';
            if ($h !== '') {
                $result['scripts'][] = $h;
            }
        }
        foreach ((array) ($def['tunnel_assets']['styles'] ?? []) as $asset) {
            $h = is_array($asset) ? (string) ($asset['handle'] ?? '') : '';
            if ($h !== '') {
                $result['styles'][] = $h;
            }
        }

        $result['scripts'] = array_values(array_unique($result['scripts']));
        $result['styles'] = array_values(array_unique($result['styles']));

        return $result;
    }

    /* =========================================================
     * BOOTSTRAP
     * ======================================================= */

    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_page'], 999);
        add_action('admin_init', [self::class, 'prepare_context'], 1);
        // Added: Server-side body class filter for guaranteed Context
        add_filter('admin_body_class', [self::class, 'force_dashboard_classes']);
        add_action('admin_enqueue_scripts', [self::class, 'asset_firewall'], 9999);
    }

    /* =========================================================
     * PAGE REGISTRATION
     * ======================================================= */

    public static function register_page(): void
    {
        add_submenu_page(
            'options.php',         // Stable parent (hidden via empty string menu title)
            'SystemDeck Widget Tunnel',
            '',                    // Hidden menu title
            'read',                // Changed from manage_options to bypass early 403 (checked in render)
            'sd-dashboard-tunnel',
            [self::class, 'render']
        );
    }

    /* =========================================================
     * DASHBOARD CONTEXT (NON-NEGOTIABLE)
     * ======================================================= */

    public static function force_dashboard_classes($classes)
    {
        if (($_GET['page'] ?? '') !== 'sd-dashboard-tunnel') {
            return $classes;
        }
        $admin_color = sanitize_html_class((string) (get_user_option('admin_color') ?: 'fresh'));
        return trim("$classes index-php dashboard wp-admin wp-core-ui admin-color-$admin_color");
    }

    public static function prepare_context(): void
    {
        if (($_GET['page'] ?? '') !== 'sd-dashboard-tunnel') {
            return;
        }

        if (!defined('IFRAME_REQUEST')) {
            define('IFRAME_REQUEST', true);
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

        // Dashboard widgets expect the native dashboard load lifecycle.
        // This restores the working beta behavior for core/admin dashboard widgets.
        do_action('load-index.php');
    }

    /* =========================================================
     * ASSET FIREWALL + CLEAN ROOM + REACT SHIM
     * ======================================================= */

    public static function asset_firewall(): void
    {
        static $simulating_dashboard_enqueue = false;

        if (($_GET['page'] ?? '') !== 'sd-dashboard-tunnel') {
            return;
        }

        // Prevent recursive self-execution when we simulate dashboard enqueue hooks.
        // Without this, the nested call re-registers admin_head bootstrap and causes
        // duplicate init/log/mount cycles inside the iframe.
        if ($simulating_dashboard_enqueue) {
            return;
        }

        // Some third-party dashboard widgets enqueue assets only when the
        // hook suffix is literally "index.php". Tunnel runs under admin.php,
        // so we simulate that pass once to preserve native widget styling.
        if (!$simulating_dashboard_enqueue) {
            $simulating_dashboard_enqueue = true;
            $original_pagenow = $GLOBALS['pagenow'] ?? null;
            $original_hook_suffix = $GLOBALS['hook_suffix'] ?? null;
            $original_current_screen = $GLOBALS['current_screen'] ?? null;

            $GLOBALS['pagenow'] = 'index.php';
            $GLOBALS['hook_suffix'] = 'index.php';

            // Ensure plugins reading get_current_screen() during enqueue see a
            // canonical dashboard screen context.
            if (function_exists('set_current_screen')) {
                set_current_screen('dashboard');
            }
            if (function_exists('get_current_screen')) {
                $screen = get_current_screen();
                if (is_object($screen)) {
                    $screen->id = 'dashboard';
                    $screen->base = 'dashboard';
                    $screen->parent_base = 'index';
                }
                $GLOBALS['current_screen'] = $screen;
            }

            do_action('admin_enqueue_scripts', 'index.php');
            do_action('admin_print_styles-index.php');
            do_action('admin_print_scripts-index.php');

            $GLOBALS['pagenow'] = $original_pagenow;
            $GLOBALS['hook_suffix'] = $original_hook_suffix;
            $GLOBALS['current_screen'] = $original_current_screen;
            $simulating_dashboard_enqueue = false;
        }

        // Prevent SystemDeck recursion
        $sd_scripts = ['sd-deck-js', 'sd-workspace-react', 'sd-system-js', 'sd-scanner-js'];
        foreach ($sd_scripts as $handle) {
            wp_deregister_script($handle);
            wp_dequeue_script($handle);
        }

        $sd_styles = ['sd-core', 'sd-common', 'sd-grid', 'sd-legacy-common', 'sd-screen-meta', 'systemdeck-shell', 'systemdeck-runtime-style'];
        foreach ($sd_styles as $handle) {
            wp_deregister_style($handle);
            wp_dequeue_style($handle);
        }

        // Kill admin chrome
        wp_deregister_script('admin-bar');
        wp_dequeue_script('admin-bar');
        wp_deregister_style('admin-bar');
        wp_dequeue_style('admin-bar');
        remove_action('wp_head', '_admin_bar_bump_cb');

        $widget_id = sanitize_text_field($_GET['widget'] ?? '');
        $profile = self::get_widget_profile($widget_id);
        $debug_mode = self::is_debug_mode();

        // Ensure React/API Core is present for the Shim
        wp_enqueue_script('wp-element');
        wp_enqueue_script('wp-api-fetch');
        wp_enqueue_script('wp-data');
        wp_enqueue_script('jquery');
        // Core dashboard widgets (notably "WordPress Events and News") rely on
        // wp-admin/js/dashboard(.min).js to replace the JS-required fallback UI.
        // In tunnel context, some WP routes can leave this handle unregistered;
        // provide a defensive registration fallback and then enqueue.
        $dashboard_script = wp_scripts()->query('dashboard', 'registered');
        if (!$dashboard_script) {
            wp_register_script(
                'dashboard',
                admin_url('js/dashboard.min.js'),
                ['jquery', 'hoverIntent', 'common'],
                get_bloginfo('version'),
                true
            );
        }
        wp_enqueue_script('dashboard');
        if ($widget_id === 'dashboard_primary') {
            // In tunneled context we intentionally suppress the Community Events
            // block. dashboard.js still invokes `get-community-events` via
            // wp.ajax, which can emit 403 noise in console. Short-circuit only
            // this action for this widget to keep console clean.
            wp_add_inline_script(
                'dashboard',
                "(function(){
                    if (!window.wp || !window.wp.ajax || typeof window.wp.ajax.post !== 'function' || !window.jQuery) return;
                    var originalPost = window.wp.ajax.post;
                    window.wp.ajax.post = function(action, data){
                        if (action === 'get-community-events') {
                            return window.jQuery.Deferred().resolve({
                                location: {},
                                events: []
                            }).promise();
                        }
                        return originalPost.apply(this, arguments);
                    };
                })();",
                'before'
            );
        }

        // Canonical WP admin style baseline for shared widget markup.
        // Keep this minimal/intentional (do not enqueue full admin chrome).
        wp_enqueue_style('dashicons');
        wp_enqueue_style('common');
        wp_enqueue_style('forms');
        wp_enqueue_style('buttons');
        wp_enqueue_style('list-tables');
        wp_enqueue_style('dashboard');

        $tunnel_blocked_style_handles = [
            'sd-core',
            'sd-common',
            'sd-grid',
            'sd-legacy-common',
            'sd-screen-meta',
            'systemdeck-shell',
            'systemdeck-runtime-style',
        ];
        $tunnel_blocked_script_handles = [
            'sd-deck-js',
            'sd-workspace-react',
            'sd-system-js',
            'sd-scanner-js',
            'systemdeck-runtime',
        ];

        foreach ((array) ($profile['scripts'] ?? []) as $handle) {
            $handle = (string) $handle;
            if ($handle === '' || in_array($handle, $tunnel_blocked_script_handles, true)) {
                continue;
            }
            wp_enqueue_script($handle);
            if ($debug_mode && !wp_script_is($handle, 'enqueued')) {
                error_log('[SystemDeck Tunnel] Script failed to enqueue: ' . $handle . ' for ' . $widget_id);
            }
        }
        foreach ((array) ($profile['styles'] ?? []) as $handle) {
            $handle = (string) $handle;
            if ($handle === '' || in_array($handle, $tunnel_blocked_style_handles, true)) {
                continue;
            }
            wp_enqueue_style($handle);
            if ($debug_mode && !wp_style_is($handle, 'enqueued')) {
                error_log('[SystemDeck Tunnel] Style failed to enqueue: ' . $handle . ' for ' . $widget_id);
            }
        }

        $tunnel_debug_assets = [];
        if ($debug_mode) {
            $styles_obj = wp_styles();
            $scripts_obj = wp_scripts();
            $style_queue = is_array($styles_obj->queue ?? null) ? $styles_obj->queue : [];
            $script_queue = is_array($scripts_obj->queue ?? null) ? $scripts_obj->queue : [];
            $style_rows = [];
            $script_rows = [];

            foreach ($style_queue as $handle) {
                $registered = $styles_obj->registered[$handle] ?? null;
                $style_rows[] = [
                    'handle' => $handle,
                    'src' => is_object($registered) ? (string) ($registered->src ?? '') : '',
                    'deps' => is_object($registered) ? array_values((array) ($registered->deps ?? [])) : [],
                ];
            }
            foreach ($script_queue as $handle) {
                $registered = $scripts_obj->registered[$handle] ?? null;
                $script_rows[] = [
                    'handle' => $handle,
                    'src' => is_object($registered) ? (string) ($registered->src ?? '') : '',
                    'deps' => is_object($registered) ? array_values((array) ($registered->deps ?? [])) : [],
                ];
            }

            $tunnel_debug_assets = [
                'widget' => $widget_id,
                'style_queue' => $style_rows,
                'script_queue' => $script_rows,
                'blocked_styles' => $tunnel_blocked_style_handles,
                'blocked_scripts' => $tunnel_blocked_script_handles,
            ];
        }

        // Required globals & Shim (Yoast, AIOSEO, Jetpack, Woo)
        add_action('admin_head', static function () use ($widget_id, $profile, $debug_mode, $tunnel_debug_assets) {
            $runtime_nonce = wp_create_nonce('systemdeck_runtime');
            $rest_nonce = wp_create_nonce('wp_rest');
            $api_root = esc_url_raw(rest_url());
            $user_id = get_current_user_id();
            $profile_globals = (array) ($profile['required_globals'] ?? []);
            $profile_events = array_values(array_unique((array) ($profile['events'] ?? [])));
            $profile_selectors = array_values((array) ($profile['required_selectors'] ?? []));
            ?>
            <script>
                // 1. GLOBAL ENVIRONMENT SHIM
                window.ajaxurl = "<?php echo esc_url(admin_url('admin-ajax.php')); ?>";
                window.SystemDeckSecurity = Object.assign({}, window.SystemDeckSecurity || {}, {
                    nonce: "<?php echo esc_js($runtime_nonce); ?>",
                    action: "systemdeck_runtime",
                    ajaxurl: "<?php echo esc_url(admin_url('admin-ajax.php')); ?>",
                    routerUrl: "<?php echo esc_url(home_url('/')); ?>"
                });

                // Explicitly set nonce on the global that legacy widgets check
                window.wpApiSettings = {
                    root: "<?php echo $api_root; ?>",
                    nonce: "<?php echo $rest_nonce; ?>"
                };

                // Polyfill userSettings
                window.userSettings = { "url": "/", "uid": "<?php echo $user_id; ?>", "time": "<?php echo time(); ?>" };

                <?php if ($debug_mode) : ?>
                window.__SD_TUNNEL_ASSET_DEBUG = <?php echo wp_json_encode($tunnel_debug_assets); ?>;
                try {
                    var targetConsole = (window.parent && window.parent !== window && window.parent.console)
                        ? window.parent.console
                        : console;
                    targetConsole.groupCollapsed('[SD Tunnel Debug] Asset Queue');
                    targetConsole.log('Widget:', window.__SD_TUNNEL_ASSET_DEBUG.widget);
                    targetConsole.table(window.__SD_TUNNEL_ASSET_DEBUG.style_queue || []);
                    targetConsole.table(window.__SD_TUNNEL_ASSET_DEBUG.script_queue || []);
                    targetConsole.log('Blocked style handles:', window.__SD_TUNNEL_ASSET_DEBUG.blocked_styles || []);
                    targetConsole.log('Blocked script handles:', window.__SD_TUNNEL_ASSET_DEBUG.blocked_scripts || []);
                    targetConsole.groupEnd();
                    targetConsole.log('[SD Tunnel Debug] style_queue_json', JSON.stringify(window.__SD_TUNNEL_ASSET_DEBUG.style_queue || []));
                    targetConsole.log('[SD Tunnel Debug] script_queue_json', JSON.stringify(window.__SD_TUNNEL_ASSET_DEBUG.script_queue || []));
                } catch (e) {}
                <?php endif; ?>

                // 2. PROFILE FALLBACK GLOBALS
                ( function () {
                    var profileGlobals = <?php echo wp_json_encode($profile_globals); ?> || {};
                    Object.keys( profileGlobals ).forEach( function ( globalName ) {
                        if ( typeof window[ globalName ] === 'undefined' ) {
                            window[ globalName ] = profileGlobals[ globalName ];
                        }
                    } );
                } )();

                // 3. UNIVERSAL REACT LIFECYCLE BRIDGE (Enhanced)
                ( function () {
                    if ( window.__SD_TUNNEL_BOOTSTRAP_DONE__ ) {
                        return;
                    }
                    window.__SD_TUNNEL_BOOTSTRAP_DONE__ = true;

                    var reactReady = false;
                    var initStarted = false;
                    var observerStarted = false;
                    var debug = <?php echo $debug_mode ? 'true' : 'false'; ?>;
                    var profileName = <?php echo wp_json_encode((string) ($profile['name'] ?? 'default')); ?>;
                    var widgetId = <?php echo wp_json_encode($widget_id); ?>;
                    var profileEvents = <?php echo wp_json_encode($profile_events); ?> || [];
                    var requiredSelectors = <?php echo wp_json_encode($profile_selectors); ?> || [];

                    function log( msg ) {
                        if ( debug ) console.log( '[SD Tunnel] ' + msg );
                    }

                    // 1. Setup API Fetch immediately
                    function setupApiFetch() {
                        if ( window.wp && window.wp.apiFetch ) {
                            try {
                                window.wp.apiFetch.use( window.wp.apiFetch.createRootURLMiddleware( "<?php echo $api_root; ?>" ) );
                                window.wp.apiFetch.use( window.wp.apiFetch.createNonceMiddleware( "<?php echo $rest_nonce; ?>" ) );
                                log( 'API Fetch configured' );
                                return true;
                            } catch ( e ) {
                                log( 'API Fetch setup failed: ' + e.message );
                                return false;
                            }
                        }
                        return false;
                    }

                    // 2. Initialize WordPress data stores
                    function initDataStores() {
                        if ( !window.wp || !window.wp.data ) {
                            log( 'wp.data not available yet' );
                            return false;
                        }

                        try {
                            var store = wp.data.select( 'core' );
                            var dispatch = wp.data.dispatch( 'core' );

                            // Get or set current user
                            var user = store.getCurrentUser();
                            if ( user && user.id ) {
                                log( 'User already loaded: ' + user.id );
                            } else {
                                // Inject user data
                                dispatch.receiveCurrentUser( {
                                    id: <?php echo $user_id; ?>,
                                    name: '<?php echo esc_js(wp_get_current_user()->display_name); ?>'
                                } );
                                log( 'User data injected' );
                            }

                            // Set permissions
                            dispatch.receiveUserPermission( 'read', true );
                            dispatch.receiveUserPermission( 'edit', true );

                            return true;
                        } catch ( e ) {
                            log( 'Data store init failed: ' + e.message );
                            return false;
                        }
                    }

                    // 3. Trigger React mount
                    function triggerReactMount() {
                        if ( reactReady ) return;

                        log( 'Triggering React mount...' );
                        log( 'Profile=' + profileName + ' widget=' + widgetId );

                        // Dispatch readiness events
                        profileEvents.forEach( function ( evtName ) {
                            try {
                                window.dispatchEvent( new Event( evtName ) );
                                document.dispatchEvent( new Event( evtName ) );
                                log( 'Dispatched event: ' + evtName );
                            } catch ( e ) {
                                log( 'Failed event: ' + evtName + ' (' + e.message + ')' );
                            }
                        } );

                        // Trigger jQuery ready for legacy widgets
                        if ( window.jQuery ) {
                            try {
                                jQuery( document ).trigger( 'ready' );
                            } catch ( e ) { }
                        }

                        reactReady = true;
                        log( 'React mount complete' );
                    }

                    // 4. Main initialization
                    function initialize() {
                        if ( initStarted ) {
                            return;
                        }
                        initStarted = true;
                        log( 'Initializing...' );

                        // Setup API
                        setupApiFetch();

                        // Init data stores
                        initDataStores();

                        // Trigger mount
                        setTimeout( triggerReactMount, 100 );
                    }

                    // 5. Watch for DOM changes and React mount points
                    var observer = new MutationObserver( function ( mutations ) {
                        // Try to init data stores on any DOM change
                        if ( !reactReady && window.wp && window.wp.data ) {
                            initDataStores();
                        }

                        // Look for React mount points
                        mutations.forEach( function ( mutation ) {
                            mutation.addedNodes.forEach( function ( node ) {
                                if ( node.nodeType === 1 && node.id ) {
                                    var id = node.id.toLowerCase();
                                    if ( id.indexOf( 'dashboard' ) !== -1 ||
                                        id.indexOf( 'widget' ) !== -1 ||
                                        id.indexOf( 'seo' ) !== -1 ) {
                                        log( 'Mount point detected: ' + node.id );
                                        if ( !reactReady ) {
                                            setTimeout( initialize, 50 );
                                        }
                                    }
                                }
                            } );
                        } );
                    } );

                    // 6. Start observing
                    function startObserver() {
                        if ( observerStarted ) {
                            return;
                        }
                        if ( document.body ) {
                            observerStarted = true;
                            observer.observe( document.body, { childList: true, subtree: true } );
                            log( 'Observer started' );
                        }
                    }

                    // 7. Initialize on DOM ready
                    if ( document.readyState === 'loading' ) {
                        document.addEventListener( 'DOMContentLoaded', function () {
                            log( 'DOM Ready' );
                            startObserver();
                            initialize();
                        } );
                    } else {
                        log( 'DOM already ready' );
                        startObserver();
                        initialize();
                    }

                    // 8. Fallback: Force init after window load
                    window.addEventListener( 'load', function () {
                        log( 'Window loaded' );
                        if ( !reactReady ) {
                            setTimeout( initialize, 200 );
                        }
                    } );

                    // 9. Final fallback after 2 seconds
                    setTimeout( function () {
                        if ( !reactReady ) {
                            log( 'Fallback initialization' );
                            initialize();
                        }
                    }, 2000 );

                    // 10. Diagnostic pass for tricky widgets
                    if ( debug ) {
                        setTimeout( function () {
                            requiredSelectors.forEach( function ( selector ) {
                                if ( !document.querySelector( selector ) ) {
                                    console.warn( '[SD Tunnel] Missing required selector for profile ' + profileName + ': ' + selector );
                                } else {
                                    log( 'Selector present: ' + selector );
                                }
                            } );
                        }, 900 );
                    }
                } )();
            </script>

            <link rel="stylesheet"
                href="<?php echo esc_url(SYSTEMDECK_URL . 'assets/css/sd-tunnel-overrides.css?v=' . filemtime(SYSTEMDECK_PATH . 'assets/css/sd-tunnel-overrides.css')); ?>"
                type="text/css" media="all" />
            <?php
        }, 999);

        // Universal iframe auto-resize (content-aware) and bulletproof Dark Mode sync
        wp_add_inline_script('common', "
            (function () {
                // Instantly sync theme from parent window or localStorage
                var syncTheme = function() {
                    try {
                        var theme = null;
                        var parentDeck = window.parent.document.getElementById('systemdeck');
                        if (parentDeck) {
                            theme = parentDeck.getAttribute('data-theme');
                        }
                        if (!theme) {
                            theme = localStorage.getItem('sd_theme');
                        }
                        if (theme && document.documentElement.getAttribute('data-theme') !== theme) {
                            document.documentElement.setAttribute('data-theme', theme);
                        }
                    } catch(e) {}
                };

                // Run immediately
                syncTheme();

                // Listen for theme changes from parent explicitly
                window.addEventListener('message', function(e) {
                    if (e.data && e.data.command === 'sd_theme_changed') {
                        document.documentElement.setAttribute('data-theme', e.data.data.theme);
                    }
                });

                // Observe height and continually enforce theme
                var target = document.querySelector('.sd-tunnel-content') || document.body;
                if (!target || !window.ResizeObserver) return;
                var ro = new ResizeObserver(function () {
                    syncTheme(); // Re-inforce theme on layout shifts incase of remount or WP JS mutation
                    try {
                        if (window.frameElement) {
                            window.frameElement.style.height = target.scrollHeight + 'px';
                        }
                    } catch(e){}
                });
                ro.observe(target);
            })();
        ");

        // Force all links to open in parent window (not in iframe)
        wp_add_inline_script('common', "
            (function () {
                // Set target on existing links
                function setLinkTargets() {
                    document.querySelectorAll('a').forEach(function(link) {
                        // Skip anchors (same-page links)
                        var href = link.getAttribute('href');
                        if (!href || href.charAt(0) === '#') return;

                        // Force open in parent window
                        link.setAttribute('target', '_top');
                    });
                }

                // Run on load
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', setLinkTargets);
                } else {
                    setLinkTargets();
                }

                // Watch for dynamically added links (React widgets)
                if (window.MutationObserver) {
                    var observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            mutation.addedNodes.forEach(function(node) {
                                if (node.nodeType === 1) { // Element node
                                    if (node.tagName === 'A') {
                                        var href = node.getAttribute('href');
                                        if (href && href.charAt(0) !== '#') {
                                            node.setAttribute('target', '_top');
                                        }
                                    }
                                    // Check children
                                    node.querySelectorAll && node.querySelectorAll('a').forEach(function(link) {
                                        var href = link.getAttribute('href');
                                        if (href && href.charAt(0) !== '#') {
                                            link.setAttribute('target', '_top');
                                        }
                                    });
                                }
                            });
                        });
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            })();
        ");
    }

    /* =========================================================
     * RENDER ANY DASHBOARD WIDGET
     * ======================================================= */

    public static function render(): void
    {
        // 1. LOCAL SECURITY GATE
        if (!current_user_can('read')) {
            wp_die('<h1>403 Forbidden</h1><p>SystemDeck: Unauthorized access (Tunnel Gate).</p>', 403);
        }

        $widget_id = sanitize_text_field($_GET['widget'] ?? '');
        $nonce = sanitize_text_field($_GET['nonce'] ?? $_GET['sd_nonce'] ?? '');

        // 2. NONCE AUTHORITY (single runtime authority)
        $valid_runtime = wp_verify_nonce($nonce, 'systemdeck_runtime');

        if (!$widget_id || !$valid_runtime) {
            wp_die('<h1>403 Forbidden</h1><p>SystemDeck: Invalid security token (Nonce Authority violation).</p>', 403);
        }

        // Accept canonical IDs and normalize to the real dashboard source ID.
        // This protects third-party widgets whose raw meta box key differs from
        // sanitized registry/runtime IDs.
        $widget_id = self::normalize_requested_widget_id($widget_id);

        if (!function_exists('wp_dashboard_setup')) {
            require_once ABSPATH . 'wp-admin/includes/dashboard.php';
        }

        wp_dashboard_setup();

        global $wp_meta_boxes;
        if (!self::is_widget_available_to_current_user($widget_id, $wp_meta_boxes)) {
            wp_die('<h1>403 Forbidden</h1><p>SystemDeck: Widget unavailable for current user.</p>', 403);
        }

        // Some widgets gate data-fetch on Screen Options checkboxes.
        $profile = self::get_widget_profile($widget_id);
        $widget_box = self::find_widget_box_config($widget_id, $wp_meta_boxes);
        $widget_title = is_array($widget_box) ? (string) ($widget_box['title'] ?? '') : '';
        if ($widget_title === '') {
            $widget_title = ucwords(str_replace(['_', '-'], ' ', $widget_id));
        }
        $toggles = (array) ($profile['hidden_toggles'] ?? ['%widget_id%-hide']);
        foreach ($toggles as $toggle_pattern) {
            $toggle_id = str_replace('%widget_id%', $widget_id, (string) $toggle_pattern);
            if ($toggle_id !== '') {
                echo '<input type="checkbox" id="' . esc_attr($toggle_id) . '" checked="checked" style="display:none" aria-hidden="true" />';
            }
        }

        // --- ID IMPERSONATION ---
        // Wrapper must match Widget ID for React mounting
        echo '<div class="sd-tunnel-content meta-box-sortables">';
        echo '<div id="' . esc_attr($widget_id) . '" class="postbox ' . esc_attr($widget_id) . '">';
        echo '<div class="postbox-header">';
        echo '<h2 class="hndle ui-sortable-handle">' . esc_html($widget_title) . '</h2>';
        echo '<div class="handle-actions hide-if-no-js">';
        echo '<button type="button" class="handle-order-higher" aria-disabled="true" aria-describedby="' . esc_attr($widget_id . '-handle-order-higher-description') . '">';
        echo '<span class="screen-reader-text">' . esc_html__('Move up') . '</span><span class="order-higher-indicator" aria-hidden="true"></span>';
        echo '</button>';
        echo '<span class="hidden" id="' . esc_attr($widget_id . '-handle-order-higher-description') . '">' . esc_html(sprintf(__('Move %s box up'), $widget_title)) . '</span>';
        echo '<button type="button" class="handle-order-lower" aria-disabled="true" aria-describedby="' . esc_attr($widget_id . '-handle-order-lower-description') . '">';
        echo '<span class="screen-reader-text">' . esc_html__('Move down') . '</span><span class="order-lower-indicator" aria-hidden="true"></span>';
        echo '</button>';
        echo '<span class="hidden" id="' . esc_attr($widget_id . '-handle-order-lower-description') . '">' . esc_html(sprintf(__('Move %s box down'), $widget_title)) . '</span>';
        echo '<button type="button" class="handlediv" aria-expanded="true">';
        echo '<span class="screen-reader-text">' . esc_html(sprintf(__('Toggle panel: %s'), $widget_title)) . '</span><span class="toggle-indicator" aria-hidden="true"></span>';
        echo '</button>';
        echo '</div>';
        echo '</div>';
        echo '<div class="inside">';

        if (!self::render_widget($widget_id)) {
            echo '<div style="padding:16px;text-align:center;color:#777">';
            echo esc_html__('Widget unavailable', 'systemdeck');
            echo '</div>';
        }

        echo '</div></div></div>'; // Close inside, postbox, tunnel
    }

    public static function render_widget(string $widget_id): bool
    {
        global $wp_meta_boxes;
        $rendered = false;
        $matched_widget_id = self::find_available_widget_id($widget_id, $wp_meta_boxes) ?? $widget_id;

        // 1. MAIN RENDER
        foreach ((array) $wp_meta_boxes as $contexts) {
            foreach ((array) $contexts as $priorities) {
                foreach ((array) $priorities as $widgets) {
                    if (!isset($widgets[$matched_widget_id]))
                        continue;

                    $callback = $widgets[$matched_widget_id]['callback'] ?? null;
                    $args = $widgets[$matched_widget_id]['args'] ?? [];

                    ob_start();
                    if (is_callable($callback)) {
                        call_user_func($callback, null, ['id' => $matched_widget_id, 'args' => $args]);
                        $rendered = true;
                    }
                    $output = ob_get_clean();

                    // UNIVERSAL REACT MOUNT POINT DETECTION
                    // Check if output is empty or minimal (likely React widget)
                    $trimmed = trim(strip_tags($output));
                    $is_likely_react = empty($trimmed) || strlen($trimmed) < 50;

                    // Create mount point if needed
                    if ($is_likely_react) {
                        // Generate a mount point ID based on widget ID
                        $mount_id = $matched_widget_id;

                        // Check if output already has this ID
                        if (strpos($output, 'id="' . $mount_id . '"') === false) {
                            // Add mount point div
                            echo '<div id="' . esc_attr($mount_id) . '" class="react-mount-point"></div>';
                        }
                    }

                    // Output the widget content
                    echo $output;

                    // Break out of loops once found
                    break 3;
                }
            }
        }

        // 2. CLUSTER RENDER (Siblings for Complex Widgets)
        // This helps widgets that depend on multiple dashboard widgets being present
        if ($rendered) {
            // Check if this is a plugin that uses multiple widgets
            $cluster_prefixes = ['wpseo', 'aioseo', 'jetpack'];
            $needs_cluster = false;
            $prefix_used = '';

            foreach ($cluster_prefixes as $prefix) {
                if (strpos($widget_id, $prefix) === 0) {
                    $needs_cluster = true;
                    $prefix_used = $prefix;
                    break;
                }
            }

            if ($needs_cluster) {
                // ... (rest of cluster logic)
            }
        }

        return $rendered;
    }

    private static function is_widget_available_to_current_user(string $widget_id, $meta_boxes): bool
    {
        return self::find_available_widget_id($widget_id, $meta_boxes) !== null;
    }

    private static function find_available_widget_id(string $widget_id, $meta_boxes): ?string
    {
        $target_raw = trim((string) $widget_id);
        if ($target_raw === '') {
            return null;
        }
        $target_key = sanitize_key($target_raw);

        foreach ((array) $meta_boxes as $contexts) {
            foreach ((array) $contexts as $priorities) {
                foreach ((array) $priorities as $widgets) {
                    if (!is_array($widgets)) {
                        continue;
                    }

                    if (isset($widgets[$target_raw])) {
                        return $target_raw;
                    }

                    foreach (array_keys($widgets) as $candidate_id) {
                        $candidate_raw = (string) $candidate_id;
                        if ($candidate_raw === '') {
                            continue;
                        }
                        if (sanitize_key($candidate_raw) === $target_key) {
                            return $candidate_raw;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Resolve the full widget box config (title/callback/args) for the requested ID.
     *
     * @return array<string,mixed>|null
     */
    private static function find_widget_box_config(string $widget_id, $meta_boxes): ?array
    {
        $matched_id = self::find_available_widget_id($widget_id, $meta_boxes);
        if ($matched_id === null) {
            return null;
        }

        foreach ((array) $meta_boxes as $contexts) {
            foreach ((array) $contexts as $priorities) {
                foreach ((array) $priorities as $widgets) {
                    if (isset($widgets[$matched_id]) && is_array($widgets[$matched_id])) {
                        return $widgets[$matched_id];
                    }
                }
            }
        }

        return null;
    }

    private static function normalize_requested_widget_id(string $widget_id): string
    {
        $raw = trim((string) $widget_id);
        if ($raw === '') {
            return '';
        }

        // Allow canonical forms through query string.
        if (str_starts_with($raw, 'dashboard.')) {
            $raw = substr($raw, strlen('dashboard.'));
        } elseif (str_starts_with($raw, 'discovered.')) {
            $raw = substr($raw, strlen('discovered.'));
        }

        // If snapshot has a definition, source_id is the best runtime key.
        $def = self::resolve_snapshot_widget_definition($raw);
        if (is_array($def) && !empty($def['source_id'])) {
            return (string) $def['source_id'];
        }

        return $raw;
    }

    /* =========================================================
     * PUBLIC HELPER – IFRAME SHELL
     * ======================================================= */

    public static function iframe(string $widget_id): void
    {
        $args = [
            'page' => 'sd-dashboard-tunnel',
            'widget' => $widget_id,
            'nonce' => wp_create_nonce('systemdeck_runtime'),
            'sd_block_boot' => 1,
        ];
        if (isset($_GET['sd_tunnel_debug']) && (string) $_GET['sd_tunnel_debug'] === '1') {
            $args['sd_tunnel_debug'] = '1';
        }

        $url = add_query_arg($args, admin_url('admin.php'));

        echo '<div class="sd-widget-proxy" style="width:100%;">';
        echo '<iframe
            src="' . esc_url($url) . '"
            frameborder="0"
            scrolling="no"
            loading="lazy"
            style="
                width:100%;
                min-height:12px;
                height: auto !important;
                border:0;
                background:transparent;
                overflow:hidden;
                margin: 0 auto;
            "
        ></iframe>';
        echo '</div>';
    }
}
