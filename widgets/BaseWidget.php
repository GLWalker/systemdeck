<?php
declare(strict_types=1);

namespace SystemDeck\Widgets;

abstract class BaseWidget
{
    /** REQUIRED */
    public const ID = '';
    public const TITLE = '';

    /** OPTIONAL */
    public const ICON = 'dashicons-admin-generic';
    public const CONTEXT = 'normal';

    /**
     * Optional asset declaration
     * Example:
     * [
     *   'css' => ['style.css'],
     *   'js'  => ['app.js']
     * ]
     */
    public static function assets(): array
    {
        return [];
    }

    /**
     * Widgets can opt into the native WordPress media stack.
     */
    public static function requires_wp_media(): bool
    {
        return false;
    }

    /**
     * FINAL render wrapper
     * Ensures consistent execution & error handling
     */
    final public static function render(array $context = []): void
    {
        try {
            static::output($context);
        } catch (\Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                echo '<pre>Widget Error (' . esc_html(static::ID) . '): '
                    . esc_html($e->getMessage()) . '</pre>';
            } else {
                echo '<!-- Widget render failed -->';
            }
        }
    }

    /**
     * ACTUAL widget output
     * Widgets implement ONLY this
     */
    abstract protected static function output(array $context): void;
}
