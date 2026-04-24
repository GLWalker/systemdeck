<?php

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Bridge between WordPress PHP and the React Canvas Runtime.
 * Responsible for core init, asset loading, and rendering the root container.
 */
class CanvasEngine
{
    private Router $router;

    public function __construct()
    {
        $this->router = new Router();
    }

    /**
     * Static initializer for deterministic widget loading.
     * Loads widget classes from the registry snapshot only.
     */
    public static function init(): void
    {
        $instance = new self();
        $instance->load_widgets_from_snapshot();
    }

    /**
     * Run the engine hooks.
     * Called by systemdeck.php.
     */
    public function run(): void
    {
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
    }



    /**
     * Load widgets from registry snapshot file references.
     * This intentionally avoids runtime directory scanning.
     */
    private function load_widgets_from_snapshot(): void
    {
        if (!class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
            return;
        }

        $snapshot = \SystemDeck\Core\Services\RegistryService::get_snapshot();
        $widgets = $snapshot['widgets'] ?? [];

        foreach ($widgets as $widget) {
            $file = $widget['file'] ?? '';

            if (!is_string($file) || $file === '') {
                continue;
            }

            if (file_exists($file)) {
                require_once $file;
            }
        }
    }



    /**
     * Enqueue React assets.
     */
    public function enqueue_assets(): void
    {
        if ($this->is_block_editor_screen()) {
            return;
        }

        if (function_exists('systemdeck_user_can_boot') && !systemdeck_user_can_boot()) {
            return;
        }

        if (class_exists(Assets::class)) {
            Assets::register_all();
        }

        wp_enqueue_script('sd-widget-asset-loader');

        $build_dir = SYSTEMDECK_PATH . 'assets/runtime/';
        $build_url = SYSTEMDECK_URL . 'assets/runtime/';
        $asset_file = $build_dir . 'systemdeck-runtime.asset.php';

        if (!file_exists($asset_file)) {
            return;
        }

        $assets = require $asset_file;

        wp_enqueue_script(
            'systemdeck-runtime',
            $build_url . 'systemdeck-runtime.js',
            $assets['dependencies'],
            $assets['version'],
            true
        );

        wp_enqueue_style(
            'systemdeck-runtime',
            $build_url . 'systemdeck-runtime.css',
            ['wp-components', 'sd-screen-meta', 'dashicons'],
            $assets['version']
        );

        wp_enqueue_script('sd-pixi-mount');
        wp_enqueue_script('sd-pixi-hud-engine');
        wp_enqueue_script('sd-metric-pin-renderers');

        if (file_exists($build_dir . 'style-systemdeck-runtime.css')) {
            wp_enqueue_style(
                'systemdeck-runtime-style',
                $build_url . 'style-systemdeck-runtime.css',
                ['systemdeck-runtime'],
                $assets['version']
            );
        }
    }

    private function is_block_editor_screen(): bool
    {
        if (!is_admin() || !function_exists('get_current_screen')) {
            return false;
        }

        $screen = get_current_screen();

        return (bool) (
            $screen &&
            method_exists($screen, 'is_block_editor') &&
            $screen->is_block_editor()
        );
    }

    /**
     * Render the canvas root container.
     */
    public function render_root(): void
    {
        echo '<div id="sd-canvas-root"></div>';
    }
}
