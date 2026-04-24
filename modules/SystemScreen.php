<?php
/**
 * SystemDeck Command Center scanner page.
 */

declare(strict_types=1);

namespace SystemDeck\Modules;

if (!defined('ABSPATH')) {
    exit;
}

class SystemScreen
{
    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_menu']);
    }

    /**
     * Register the hidden scanner page used by the command center flow.
     */
    public static function register_menu(): void
    {
        $hook = add_submenu_page(
            'index.php',          // Stable admin context
            'SystemDeck',
            null,                 // Hidden from menu
            'read',
            'systemdeck',
            [self::class, 'render_page']
        );

        add_action('admin_enqueue_scripts', function ($current_hook) use ($hook) {
            if ($current_hook === $hook) {
                self::enqueue_assets();
            }
        });
    }

    /**
     * Enqueue scripts and styles.
     */
    public static function enqueue_assets(): void
    {
        if (class_exists('\\SystemDeck\\Core\\Assets')) {
            \SystemDeck\Core\Assets::register_all();
        }

        wp_enqueue_script('sd-scanner-js');
        wp_enqueue_style('sd-legacy-common');
        wp_enqueue_style('sd-screen-meta');

        wp_localize_script('sd-scanner-js', 'sdScannerVars', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('systemdeck_runtime'),
            'action' => 'systemdeck_runtime',
            'routerUrl' => home_url('/'),
        ]);
    }

    /**
     * Render scanner controls.
     */
    public static function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('<h1>403 Forbidden</h1><p>SystemDeck: Unauthorized access.</p>', 403);
        }

        if (isset($_GET['sd_embed'])) {
            echo '<style>
                #wpadminbar, #adminmenumain, #wpfooter, .update-nag, .notice, .wp-heading-inline, .wp-header-end { display: none !important; }
                html, body, #wpwrap, #wpcontent, #wpbody, #wpbody-content { height: 100vh !important; margin: 0 !important; padding: 0 !important; overflow: auto !important; background: #fff !important; }
                html.wp-toolbar { padding-top: 0 !important; }
                .wrap { margin: 0 !important; padding: 0 !important; }
                .card { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
                .sd-command-center { margin: 0 !important; padding: 0 !important; }
            </style>';
        }

        $nonce_field = wp_nonce_field('systemdeck_runtime', 'sd_nonce', true, false);

        ?>
        <div class="wrap sd-command-center">
            <h1 class="wp-heading-inline">Widget Scanner</h1>
            <hr class="wp-header-end">

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2>Deep Scan</h2>
                <p>Perform a deep scan of the WordPress dashboard to discover available widgets for your SystemDeck.</p>

                <div class="sd-scanner-controls">
                    <button type="button" id="sd-start-scan" class="button button-primary button-hero">
                        Start Scan
                    </button>
                    <span class="spinner"></span>
                </div>

                <div id="sd-scan-results" style="margin-top: 20px; display: none;">
                    <h3>Discovered Widgets</h3>
                    <form id="sd-scan-form">
                        <?php echo $nonce_field; ?>
                        <div id="sd-scan-list" class="sd-checkbox-grid"></div>
                        <p class="submit">
                            <button type="submit" class="button button-primary">Save Selection</button>
                        </p>
                    </form>
                </div>

                <!-- Hidden offscreen iframe mount -->
                <div id="sd-scanner-frame-wrap"
                    style="position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden;"></div>
            </div>
        </div><!-- .wrap -->

        <style>
            .sd-checkbox-grid label {
                display: block;
                padding: 8px 4px;
                border-bottom: 1px solid #eee;
            }

            .sd-checkbox-grid label:hover {
                background: #f7f7f7;
            }
        </style>

        <?php
    }
}
