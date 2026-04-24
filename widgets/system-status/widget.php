<?php
/**
 * System Telemetrics (Ported from Beta)
 * PHP and server environment details widget.
 */
declare(strict_types=1);

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

class SystemStatus extends BaseWidget
{
    public const ID = 'core.system-status';
    public const TITLE = 'System Telemetrics';
    public const ICON = 'dashicons-heart';
    public const VISIBILITY_POLICY = 'hidden';

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js' => ['app.js'],
        ];
    }

    protected static function output(array $context): void
    {
        $workspace_id = class_exists('\\SystemDeck\\Core\\Registry')
            ? \SystemDeck\Core\Registry::resolve_workspace_id((string) ($context['workspace_id'] ?? 'default'))
            : sanitize_key((string) ($context['workspace_id'] ?? 'default'));
        if ($workspace_id === '') {
            $workspace_id = 'default';
        }

        echo '<div class="sd-status-wrapper sd-system-status-widget" data-workspace-id="' . esc_attr($workspace_id) . '">';
        echo '<div id="sd-system-diagnostics-grid" class="sd-status-grid">';
        echo '<div class="sd-system-status-loading">Loading telemetry...</div>';
        echo '</div>';
        echo '</div>';
    }
}
