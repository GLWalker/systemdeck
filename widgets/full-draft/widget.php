<?php
/**
 * SystemDeck - widget.php
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/full-draft/widget.php
 * @license GPL-2.0-or-later
 *
 * Full Draft Widget (Distraction-free Writing)
 */
declare(strict_types=1);

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

class FullDraft extends BaseWidget
{
    public const ID = 'core.full-draft';
    public const TITLE = 'Full Draft';
    public const ICON = 'dashicons-edit-page';
    public const CONTEXT = 'normal';

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js'  => ['app.js']
        ];
    }

    protected static function output(array $context): void
    {
        // Start at the posts list, but the JS will handle the tunnel logic
        $admin_url = admin_url('edit.php');
        ?>
        <div class="sd-full-draft-widget" data-admin-url="<?php echo esc_attr($admin_url); ?>">
            <div class="sd-full-draft-loading">
                <span class="dashicons dashicons-update-alt"></span> Initialize Secure Tunnel...
            </div>
            <div class="sd-full-draft-iframe-container">
                <!-- Iframe injected via JS to ensure isolation and control -->
            </div>
        </div>
        <?php
    }

    /**
     * Natively inject the UI stripper CSS into the WordPress admin head
     * when the tunnel is active, eliminating any flash of unstyled content.
     */
    public static function inject_tunnel_css(): void
    {
        if (isset($_GET['sd_full_draft']) && $_GET['sd_full_draft'] === '1') {
            ?>
            <style id="sd-full-draft-overrides">
                /* Strip Admin Chrome & SystemDeck Shell */
                #adminmenumain, #wpadminbar, #adminmenuback, #adminmenuwrap, #wpfooter, #contextual-help-link-wrap { display: none !important; }
                #sd-app, #sd-header-bar, #sd-visual-workspace, .sd-shell-container { display: none !important; }
                #wpcontent { margin-left: 0 !important; }
                #wpbody { padding-top: 0 !important; padding-bottom: 0 !important; }
                html.wp-toolbar { padding-top: 0 !important; }
                #wpbody-content { padding-bottom: 16px !important; }
                
                /* Fix Native WP Mobile Breakpoint Layouts */
                p.search-box { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; margin-bottom: 12px !important; }
                p.search-box input[name="s"] { width: 100% !important; flex: 1 !important; margin-bottom: 0 !important; }
                p.search-box input[type="submit"] { margin-bottom: 0 !important; margin-left: 8px !important; }
                .tablenav .actions { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; }
                .tablenav .actions select, .tablenav .actions input[type="submit"] { margin: 0 !important; display: inline-block !important; }
                
                /* Auto-sizing and scrollbar prevention */
                html, body, #wpwrap { 
                    overflow: hidden !important; 
                    height: max-content !important; 
                    min-height: 0 !important;
                    background: transparent !important;
                }
                
                /* Gutenberg specific overrides */
                body.block-editor-page { background: #fff !important; }
                .interface-interface-skeleton { top: 0 !important; left: 0 !important; }
                .edit-post-header { top: 0 !important; }
                
                /* Notices and updates that break layout */
                .update-nag, .notice { margin-left: 0 !important; }
            </style>
            <?php
        }
    }
}

// Hook into admin_head to deliver the CSS natively from the server
add_action('admin_head', ['SystemDeck\\Widgets\\FullDraft', 'inject_tunnel_css'], 1);
