<?php
declare(strict_types=1);

namespace SystemDeck\Core\Blocks;

if (!defined('ABSPATH')) {
    exit;
}

final class CanvasGridBlock
{
    public const BLOCK_NAME = 'systemdeck/canvas-grid';

    public static function init(): void
    {
        add_action('init', [self::class, 'register_block']);
    }

    public static function register_block(): void
    {
        if (!function_exists('register_block_type')) {
            return;
        }

        wp_register_script(
            'sd-canvas-grid-block',
            SYSTEMDECK_URL . 'assets/js/sd-canvas-grid-block.js',
            ['wp-blocks', 'wp-element', 'wp-block-editor', 'wp-i18n'],
            SYSTEMDECK_VERSION,
            true
        );

        register_block_type(self::BLOCK_NAME, [
            'api_version' => 3,
            'title' => __('SystemDeck Canvas Grid', 'systemdeck'),
            'description' => __('Hidden SystemDeck canvas grid host.', 'systemdeck'),
            'category' => 'design',
            'icon' => 'screenoptions',
            'editor_script' => 'sd-canvas-grid-block',
            'supports' => [
                'html' => false,
                'inserter' => false,
                'reusable' => false,
                'multiple' => false,
            ],
            'render_callback' => [self::class, 'render'],
        ]);
    }

    /**
     * @param array<string,mixed> $attributes
     */
    public static function render(array $attributes, string $content): string
    {
        if (function_exists('get_block_wrapper_attributes')) {
            $wrapper = get_block_wrapper_attributes([
                'class' => 'sd-canvas-grid-host',
                'data-sd-grid-host' => '1',
            ]);

            return sprintf('<div %1$s>%2$s</div>', $wrapper, $content);
        }

        return sprintf('<div class="sd-canvas-grid-host" data-sd-grid-host="1">%s</div>', $content);
    }
}
