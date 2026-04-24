<?php
/**
 * SystemDeck Editor Controller
 * Manages the "Editor Mode" (FSE/Block Editor) logic and sidebar registration.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class EditorController
{

    public static function init(): void
    {
        add_action('enqueue_block_editor_assets', [self::class, 'enqueue_editor_shell']);
        add_action('enqueue_block_assets', [self::class, 'enqueue_canvas_engine']);
    }

    public static function enqueue_editor_shell(): void
    {
        if (!is_admin()) {
            return;
        }

        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if ($screen && method_exists($screen, 'is_block_editor') && !$screen->is_block_editor()) {
            return;
        }

        $script_path = SYSTEMDECK_PATH . 'assets/js/sd-fse-sidebar.js';
        if (!file_exists($script_path)) {
            return;
        }

        wp_enqueue_script(
            'sd-fse-sidebar',
            SYSTEMDECK_URL . 'assets/js/sd-fse-sidebar.js',
            ['wp-plugins', 'wp-element', 'wp-components', 'wp-data', 'wp-edit-post', 'wp-edit-site', 'wp-editor'],
            SYSTEMDECK_VERSION . '.' . filemtime($script_path),
            true
        );

        wp_localize_script('sd-fse-sidebar', 'sd_editor_vars', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'export_nonce' => wp_create_nonce('systemdeck_runtime'),
            'telemetry' => class_exists('\SystemDeck\Core\Telemetry')
                ? \SystemDeck\Core\Telemetry::get_raw_metrics()
                : null,
        ]);
    }

    public static function enqueue_canvas_engine(): void
    {
        if (!is_admin()) {
            return;
        }

        $inspector_path = SYSTEMDECK_PATH . 'assets/js/sd-inspector-engine.js';
        if (file_exists($inspector_path)) {
            wp_enqueue_script(
                'sd-inspector-engine',
                SYSTEMDECK_URL . 'assets/js/sd-inspector-engine.js',
                [],
                SYSTEMDECK_VERSION . '.' . filemtime($inspector_path),
                true
            );
        }

        if (file_exists(SYSTEMDECK_PATH . 'assets/css/sd-editor-overrides.css')) {
            wp_enqueue_style(
                'sd-editor-overrides',
                SYSTEMDECK_URL . 'assets/css/sd-editor-overrides.css',
                ['wp-components'],
                SYSTEMDECK_VERSION
            );
        }

        if (class_exists('\SystemDeck\Core\Assets') && wp_style_is('sd-editor-overrides', 'enqueued')) {
            wp_add_inline_style('sd-editor-overrides', Assets::get_dynamic_css());
        }
    }
}
