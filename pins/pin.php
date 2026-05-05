<?php
/**
 * SystemDeck - pin.php
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/pins/pin.php
 * @license GPL-2.0-or-later
 *
 * Core Pin Registration and Rendering Authority
 */
declare(strict_types=1);

namespace SystemDeck\Pins;

use SystemDeck\Core\Services\PinRegistry;

if (!defined('ABSPATH')) {
    exit;
}

final class BasePinRuntime
{
    /**
     * @return array<int,array<string,mixed>>
     */
    public static function definitions(): array
    {
        return [
            [
                'id' => 'core_open_pin_manager',
                'label' => 'Pin Manager',
                'type' => 'control',
                'source' => [
                    'kind' => 'core',
                    'authority' => 'systemdeck',
                    'id' => 'core_open_pin_manager',
                ],
                'category' => 'tools',
                'renderer' => 'dom',
                'description' => 'Open Screen Options so you can manage widgets and workspace tools.',
                'icon' => 'dashicons-screenoptions',
                'tags' => ['tools', 'workspace'],
                'pin_safe' => true,
                'defaults' => [
                    'size' => '2x1',
                    'design_template' => 'default',
                ],
                'meta' => [
                    'pin_kind' => 'platform_control_pin',
                    'action' => 'open_pin_manager',
                    'value_label' => 'Open',
                ],
            ],
        ];
    }

    /**
     * @return array{js:array<int,string>,css:array<int,string>}
     */
    public static function asset_handles(string $pin_id): array
    {
        $pin_id = self::sanitize_pin_id($pin_id);
        if ($pin_id === '') {
            return ['js' => [], 'css' => []];
        }

        return [
            'js' => ['sd-pin-base-runtime'],
            'css' => [],
        ];
    }

    /**
     * @param array<string,mixed> $context
     */
    public static function render(string $pin_id, array $context = []): string
    {
        $pin_id = self::sanitize_pin_id($pin_id);
        if ($pin_id === '') {
            return '';
        }

        if ($pin_id === 'core_open_pin_manager') {
            return self::render_open_pin_manager($context);
        }

        if (str_starts_with($pin_id, 'metric_')) {
            return self::render_generic_metric($pin_id, $context);
        }

        return '';
    }

    /**
     * @param array<string,mixed> $context
     */
    private static function render_open_pin_manager(array $context): string
    {
        $instance_id = sanitize_html_class((string) ($context['instance_id'] ?? ''));

        ob_start();
        ?>
                <div class="sd-media-wrap">
                    <div class="sd-media-figure">
                        <span class="sd-pin-icon dashicons dashicons-screenoptions"></span>
                    </div>
                    <div class="sd-media-content">
                        <div class="sd-pin-label" id="sd-pin-title-<?php echo esc_attr($instance_id); ?>">
                            <?php echo esc_html__('System', 'systemdeck'); ?>
                        </div>
                        <h4 class="sd-pin-title"><?php echo esc_html__('Pin Manager', 'systemdeck'); ?></h4>
                        <div class="sd-pin-meta">
                            <span class="sd-pin-description"><?php echo esc_html__('Manage Workspace Pins', 'systemdeck'); ?></span>
                        </div>
                    </div>
                </div>
        <?php

        return (string) ob_get_clean();
    }

    /**
     * @param array<string,mixed> $context
     */
    private static function render_generic_metric(string $pin_id, array $context): string
    {
        $definition = PinRegistry::get_definition($pin_id);
        if (!$definition) {
            return '';
        }

        $instance_id = sanitize_html_class((string) ($context['instance_id'] ?? $pin_id));
        $label = $definition['label'] ?? 'Metric';
        $icon = $definition['icon'] ?? 'dashicons-admin-generic';
        $category = ucfirst($definition['category'] ?? 'System');

        ob_start();
        ?>
                <div class="sd-media-wrap">
                    <div class="sd-media-figure">
                        <span class="sd-pin-icon dashicons <?php echo esc_attr($icon); ?>"></span>
                    </div>
                    <div class="sd-media-content">
                        <div class="sd-pin-label" id="sd-pin-title-<?php echo esc_attr($instance_id); ?>">
                            <?php echo esc_html($category); ?>
                        </div>
                        <h4 class="sd-pin-title"><?php echo esc_html($label); ?></h4>
                        <div class="sd-pin-value" aria-live="polite">
                            <!-- JS will populate this -->
                        </div>
                    </div>
                </div>
        <?php

        return (string) ob_get_clean();
    }

    private static function sanitize_pin_id(string $pin_id): string
    {
        $pin_id = trim($pin_id);
        if ($pin_id === '') {
            return '';
        }

        return (string) preg_replace('/[^a-zA-Z0-9._-]/', '', $pin_id);
    }
}
