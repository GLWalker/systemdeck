<?php
declare(strict_types=1);

namespace SystemDeck\Pins;

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

        return '';
    }

    /**
     * @param array<string,mixed> $context
     */
    private static function render_open_pin_manager(array $context): string
    {
        $instance_id = sanitize_html_class((string) ($context['instance_id'] ?? ''));
        $workspace_id = sanitize_key((string) ($context['workspace_id'] ?? ''));

        ob_start();
        ?>
        <article
            class="postbox sd-pin"
            tabindex="0"
            data-pin-id="core_open_pin_manager"
            data-pin-instance-id="<?php echo esc_attr($instance_id); ?>"
            data-pin-workspace-id="<?php echo esc_attr($workspace_id); ?>"
            data-pin-action="open_pin_manager"
            data-pin-root="1"
        >
            <div class="inside">
                <div class="sd-pin-content default">
                    <div class="sd-pin-meta">
                        <span class="sd-pin-label"><?php echo esc_html__('Pin Manager', 'systemdeck'); ?></span>
                        <span class="sd-pin-value"><?php echo esc_html__('Open Screen Options', 'systemdeck'); ?></span>
                    </div>
                </div>
            </div>
        </article>
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
