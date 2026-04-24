<?php
declare(strict_types=1);

/**
 * SystemDeck Time Monitor
 * Pixi-first core widget bootstrap.
 */

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

final class TimeMonitor extends BaseWidget
{
    public const ID = 'core.time-monitor';
    public const TITLE = 'Time Monitor';
    public const ICON = 'dashicons-clock';

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js' => ['sd-telemetry-stream-engine', 'sd-time-monitor-pixi-scene', 'app.js'],
        ];
    }

    protected static function output(array $context): void
    {
        $widget_id = (string) self::read([
            $context,
        ], 'resolved_id', self::ID);
        if ($widget_id === '') {
            $widget_id = self::ID;
        }

        $source_id = (string) self::read([
            $context,
        ], 'source_id', $widget_id);
        if ($source_id === '') {
            $source_id = $widget_id;
        }

        $mount_id = (string) self::read([
            $context,
        ], 'item_id', '');
        if ($mount_id === '') {
            $mount_id = 'sd-time-monitor-' . wp_generate_uuid4();
        }

        $tz_server = (string) self::read([
            $context,
        ], 'tz_server', 'UTC');
        $tz_wp = (string) self::read([
            $context,
        ], 'tz_wp', '');
        if ($tz_wp === '') {
            $tz_wp = wp_timezone_string();
            if ($tz_wp === '') {
                $tz_wp = 'WP Local';
            }
        }
        $tz_browser = (string) self::read([
            $context,
        ], 'tz_browser', 'Browser');

        $ping_ms = self::read([
            $context,
        ], 'ping_ms', '');

        $summary = sprintf(
            __('Time Monitor ready. Please refresh browser. Server timezone %1$s. WordPress timezone %2$s. Browser timezone %3$s.', 'systemdeck'),
            $tz_server !== '' ? $tz_server : 'UTC',
            $tz_wp !== '' ? $tz_wp : 'WP Local',
            $tz_browser !== '' ? $tz_browser : 'Browser'
        );
        ?>
        <div
            id="<?php echo esc_attr($mount_id); ?>"
            class="sd-time-monitor-module"
            data-widget="time-monitor"
            data-widget-id="<?php echo esc_attr($widget_id); ?>"
            data-source-id="<?php echo esc_attr($source_id); ?>"
            data-renderer="pixi"
            data-pixi-enabled="1"
            data-tz-server="<?php echo esc_attr($tz_server); ?>"
            data-tz-wp="<?php echo esc_attr($tz_wp); ?>"
            data-tz-browser="<?php echo esc_attr($tz_browser); ?>"
            data-ping-ms="<?php echo esc_attr((string) $ping_ms); ?>"
            data-ping-status="idle">
            <div
                class="sd-pixi-surface sd-time-monitor__pixi-stage"
                data-widget-id="time-monitor"
                data-role="pixi-stage"
                aria-hidden="true"></div>

            <div
                class="sd-time-monitor__fallback"
                data-role="fallback">
                <?php esc_html_e('Time Monitor ready. Please refresh browser.', 'systemdeck'); ?>
            </div>

            <div
                class="screen-reader-text"
                data-role="status"
                aria-live="polite">
                <?php echo esc_html($summary); ?>
            </div>

            <button
                type="button"
                class="sd-time-monitor__ping-button screen-reader-text"
                data-role="ping-button">
                <?php esc_html_e('Ping', 'systemdeck'); ?>
            </button>
        </div>
        <?php
    }

    /**
     * @param array<int, mixed> $sources
     * @return mixed
     */
    private static function read(array $sources, string $key, mixed $fallback = ''): mixed
    {
        foreach ($sources as $source) {
            if (is_array($source) && array_key_exists($key, $source)) {
                return $source[$key];
            }
            if (is_object($source) && isset($source->{$key})) {
                return $source->{$key};
            }
        }

        return $fallback;
    }
}
