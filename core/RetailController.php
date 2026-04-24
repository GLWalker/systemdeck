<?php
/**
 * SystemDeck Retail Controller
 * Manages the "Retail Mode" (Frontend) logic and rendering.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class RetailController
{
    public static function init(): void
    {
        // 0. AJAX Bridge (Active for all)
        add_action('wp_ajax_sd_export_theme_json', [self::class, 'handle_export_theme_json']);

        if (is_admin())
            return;

        // Ensure preview parameter persists through server-side redirects
        add_filter('wp_redirect', [self::class, 'intercept_preview_redirect']);
        add_filter('redirect_post_location', [self::class, 'intercept_preview_redirect']);

        // 1. Preview iframe mode (sd_preview=1)
        if (isset($_GET['sd_preview'])) {
            // Clean the iframe (no admin bar, no shell, no drawer recursion)
            add_action('init', [self::class, 'clean_preview_mode']);

            // Phase 3: Intercept Theme JSON to swap styles
            if (!empty($_GET['sd_style'])) {
                add_filter('wp_theme_json_data_theme', [self::class, 'inject_variation']);
            }

            // Directly hook the inspector engine enqueue on wp_enqueue_scripts.
            // We do this HERE (not inside clean_preview_mode) because wp_enqueue_scripts
            // fires AFTER init, so it's safe to register from init context.
            if (isset($_GET['sd_inspect'])) {
                add_action('wp_enqueue_scripts', [self::class, 'enqueue_inspector_engine'], 5);
            }

            // Stop — no retail shell scripts should load in the preview iframe
            return;
        }

        // 2. Normal frontend (NOT preview iframe)
        // enqueue_frontend_assets (priority 10) registers sd-retail-system FIRST.
        // enqueue_assets (priority 15) then localizes sd_retail_vars onto it.
        // Order matters — wp_localize_script requires the handle to already be registered.
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_frontend_assets'], 10);
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_assets'], 15);

        // 3. Initialize Retail Modules
        if (class_exists('\\SystemDeck\\Modules\\Inspectors\\BlockInspector')) {
            \SystemDeck\Modules\Inspectors\BlockInspector::init();
        }
    }

    /**
     * Enqueue the Inspector Engine (The Magic Mouse) inside the preview iframe.
     * Called on wp_enqueue_scripts when sd_preview=1&sd_inspect=1.
     */
    public static function enqueue_inspector_engine(): void
    {
        // No user capability check needed here — the iframe won't be opened by
        // non-admins because only admins can open Visual Mode. The Inception Guard
        // in systemdeck.php also blocks the main shell from loading in the iframe.

        $settings = [];
        if (class_exists('\WP_Theme_JSON_Resolver')) {
            $settings = \WP_Theme_JSON_Resolver::get_theme_data()->get_settings();
        }

        wp_enqueue_script(
            'sd-inspector-engine',
            SYSTEMDECK_URL . 'assets/js/sd-inspector-engine.js',
            [], // No jQuery dependency — the engine is pure vanilla JS
            SYSTEMDECK_VERSION . '.' . filemtime(SYSTEMDECK_PATH . 'assets/js/sd-inspector-engine.js'),
            true  // Load in footer
        );

        wp_localize_script('sd-inspector-engine', 'sd_env', [
            'blockDefinitions' => self::get_block_definitions(),
            'layout' => $settings['layout'] ?? [],
            'spacing' => $settings['spacing'] ?? [],
            'isEditor' => false,
            'debug' => true,
        ]);
    }

    /**
     * Render the floating Visual Mode trigger on the frontend.
     * Stub kept for hook symmetry with clean_preview_mode's remove_action calls.
     */
    public static function render_floating_menu(): void
    {
        // The sd-visual-trigger is injected via sd-retail-system.js into the SD header bar.
        // This method is a no-op stub kept so remove_action('wp_footer',...) in
        // clean_preview_mode has a matching hook to remove if ever re-added.
    }

    /**
     * render_shell stub — kept for clean_preview_mode hook symmetry.
     */
    public static function render_shell(): void
    {
        // No-op stub.
    }



    /**
     * Inject a specific style variation into the current page load.
     * This happens entirely in memory - no database writes needed.
     */
    public static function inject_variation($theme_json)
    {
        $slug = sanitize_text_field($_GET['sd_style']);

        if (class_exists('WP_Theme_JSON_Resolver')) {
            $variations = \WP_Theme_JSON_Resolver::get_style_variations();
            foreach ($variations as $v) {
                if (($v['slug'] ?? sanitize_title($v['title'])) === $slug) {
                    $theme_json->update_with($v);
                    break;
                }
            }
        }
        return $theme_json;
    }

    /**
     * clean_preview_mode
     * Ensures the iframe is clean (No Admin Bar, No Drawer).
     */
    public static function clean_preview_mode(): void
    {
        // Safe check: inside 'init' hook, pluggable functions are available
        if (!current_user_can('manage_options'))
            return;

        // Hide Admin Bar
        add_filter('show_admin_bar', '__return_false');

        // Prevent Drawer from loading inside itself
        remove_action('wp_footer', [self::class, 'render_shell'], 20);
        remove_action('wp_footer', [self::class, 'render_floating_menu']);

        // Enqueue the Inspector Engine (The Magic Mouse) - Only if specifically requested
        if (isset($_GET['sd_inspect'])) {
            add_action('wp_enqueue_scripts', function () {
                $settings = [];
                if (class_exists('\WP_Theme_JSON_Resolver')) {
                    $settings = \WP_Theme_JSON_Resolver::get_theme_data()->get_settings();
                }

                wp_enqueue_script(
                    'sd-inspector-engine',
                    SYSTEMDECK_URL . 'assets/js/sd-inspector-engine.js',
                    [],
                    SYSTEMDECK_VERSION,
                    true
                );

                wp_localize_script('sd-inspector-engine', 'sd_env', [
                    'blockDefinitions' => self::get_block_definitions(),
                    'layout' => $settings['layout'] ?? [],
                    'spacing' => $settings['spacing'] ?? [],
                    'isEditor' => false,
                    'debug' => true,
                ]);
            });
        }

        // Add class for CSS targeting
        add_filter('body_class', function ($classes) {
            $classes[] = 'sd-is-preview';
            return $classes;
        });
    }

    public static function enqueue_frontend_assets(): void
    {
        if (!current_user_can('edit_theme_options')) {
            return;
        }

        // 1. The Frontend Overlay (Vanilla JS)
        wp_enqueue_script(
            'sd-retail-system',
            SYSTEMDECK_URL . 'assets/js/sd-retail-system.js',
            [],
            SYSTEMDECK_VERSION,
            true
        );

        // 2. The Inspector HUD (React)
        $asset_file = @include(SYSTEMDECK_PATH . 'assets/js/sd-inspector-hud.asset.php');
        // Fallback if build asset file missing (dev mode)
        $deps = $asset_file['dependencies'] ?? ['wp-element', 'wp-components', 'wp-i18n'];

        wp_enqueue_script(
            'sd-inspector-hud',
            SYSTEMDECK_URL . 'assets/js/sd-inspector-hud.js',
            $deps,
            SYSTEMDECK_VERSION,
            true
        );
    }

    public static function enqueue_assets(): void
    {
        if (!current_user_can('manage_options'))
            return;

        $user_id = get_current_user_id();
        $variations = [];
        if (class_exists('\WP_Theme_JSON_Resolver')) {
            $vars = \WP_Theme_JSON_Resolver::get_style_variations();
            foreach ($vars as $key => $var) {
                $slug = $var['slug'] ?? (isset($var['title']) ? sanitize_title($var['title']) : (string) $key);
                $title = $var['title'] ?? ucfirst($slug);
                $variations[] = ['title' => $title, 'slug' => $slug];
            }
        }

        // sd-retail-system is already registered by enqueue_frontend_assets() at priority 10.
        // wp_localize_script attaches sd_retail_vars as an inline script before it.
        wp_localize_script('sd-retail-system', 'sd_retail_vars', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'router_url' => home_url('/'),
            'nonce' => wp_create_nonce('systemdeck_runtime'),
            'action' => 'systemdeck_runtime',
            'export_nonce' => wp_create_nonce('systemdeck_runtime'),
            'site_url' => home_url('/'),
            'blockDefinitions' => self::get_block_definitions(),
            'variations' => $variations,
            'admin_url' => admin_url(),
            'debug' => true,
        ]);

        // Styles
        wp_enqueue_style('wp-components');
        wp_enqueue_style('systemdeck-shell');
    }

    /**
     * handle_export_theme_json
     * Streams sanitized telemetry as a theme-variation.json download.
     */
    public static function handle_export_theme_json(): void
    {
        if (!current_user_can('edit_theme_options')) {
            wp_die('Unauthorized');
        }

        // Verify Nonce
        if (!isset($_GET['nonce']) || !wp_verify_nonce($_GET['nonce'], 'systemdeck_runtime')) {
            wp_die('Security check failed.');
        }

        // Placeholder for telemetry retrieval
        $data = ['version' => 3, 'comment' => 'Export not yet fully implemented in rebirth'];

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="theme-variation.json"');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * get_block_definitions
     * Harvests lightweight block metadata for the Inspector Engine.
     */
    public static function get_block_definitions(): array
    {
        if (!class_exists('\WP_Block_Type_Registry'))
            return [];

        $registry = \WP_Block_Type_Registry::get_instance()->get_all_registered();
        $definitions = [];

        foreach ($registry as $name => $block_type) {
            $definitions[$name] = [
                'name' => $name,
                'title' => $block_type->title ?? $name,
                'selectors' => $block_type->selectors ?? null,
                'supports' => $block_type->supports ?? null,
                'experimentalSelector' => $block_type->supports['__experimentalSelector'] ?? $block_type->{'__experimentalSelector'} ?? null
            ];
        }

        return $definitions;
    }

    /**
     * intercept_preview_redirect
     * Ensures that if we are in a preview session, any redirect carries the flag forward.
     */
    public static function intercept_preview_redirect($location)
    {
        if (!isset($_GET['sd_preview']) && !isset($_SERVER['HTTP_REFERER'])) {
            return $location;
        }

        $is_preview = isset($_GET['sd_preview']) || (isset($_SERVER['HTTP_REFERER']) && strpos($_SERVER['HTTP_REFERER'], 'sd_preview=1') !== false);

        if ($is_preview) {
            $location = add_query_arg('sd_preview', '1', $location);

            // Carry style variation if present in current request or referer
            $style = $_GET['sd_style'] ?? null;
            if (!$style && isset($_SERVER['HTTP_REFERER'])) {
                parse_str(parse_url($_SERVER['HTTP_REFERER'], PHP_URL_QUERY) ?? '', $ref_params);
                $style = $ref_params['sd_style'] ?? null;
            }

            if ($style) {
                $location = add_query_arg('sd_style', sanitize_text_field($style), $location);
            }
        }

        return $location;
    }
}
