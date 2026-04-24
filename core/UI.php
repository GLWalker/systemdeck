<?php
/**
 * SystemDeck UI Components
 * Standardized reusable UI elements for widgets and the shell.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class UI
{
    /**
     * Render a Standard Widget Pin Item (Row)
     * Matches the "Gold Standard" markup for consistency.
     *
     * @param string $key        Unique ID for the item (within the widget context).
     * @param string $label      The user-facing label/title.
     * @param string $value      (Optional) Value to display on the right. Can contain HTML.
     * @param string $icon       (Optional) Dashicon class (e.g., 'dashicons-heart') or raw SVG string.
     * @param array  $pin_data   (Optional) Custom data for the pin JSON. If provided, must include 'id'.
     *                           If not provided, a default metric-style blob is generated.
     * @param bool   $is_pinned  (Check state) Is this item currently pinned?
     */
    public static function render_pin_item(
        string $key,
        string $label,
        string $value = '',
        string $icon = '',
        array $pin_data = [],
        bool $is_pinned = false
    ): void {
        // 1. Prepare Classes & ID
        $item_classes = ['sd-pin-item'];
        if ($is_pinned) {
            $item_classes[] = 'pinned';
        }
        $class_str = esc_attr(implode(' ', $item_classes));

        // 2. Prepare Icon HTML
        $icon_html = '';
        if (!empty($icon)) {
            if (strpos(trim($icon), '<svg') === 0) {
                $icon_html = '<span class="sd-stat-icon custom-svg">' . $icon . '</span>';
            } else {
                $icon_html = '<span class="dashicons ' . esc_attr($icon) . ' sd-stat-icon"></span>';
            }
        }

        // 3. Prepare Pin Data
        if (empty($pin_data['id'])) {
            $pin_data['id'] = 'metric_' . $key;
        }
        $pin_data = wp_parse_args($pin_data, [
            'type' => 'metric',
            'label' => $label,
            'value' => strip_tags($value),
            'icon' => $icon
        ]);
        $json_attr = esc_attr(json_encode($pin_data));

        // 4. Determine Toggle Icon
        $toggle_icon = $is_pinned ? 'dashicons-yes' : 'dashicons-admin-post';

        // 5. Output HTML
        echo "<div class=\"{$class_str}\" data-key=\"" . esc_attr($key) . "\">";

        echo '<span class="sd-stat-label">';
        echo $icon_html;
        echo esc_html($label);
        echo '</span>';

        echo '<span class="sd-stat-value">' . wp_kses_post($value) . '</span>';

        echo '<div class="sd-stat-actions">';
        echo "<span class=\"dashicons {$toggle_icon} sd-pin-toggle\" title=\"Toggle Pin\" data-pin-json=\"{$json_attr}\"></span>";
        echo '</div>';

        echo '</div>';
    }

    /**
     * Render a Pinned Item (for the ribbon/grid)
     */
    public static function render_pinned_item(array $pin_data): void
    {
        $id = esc_attr($pin_data['id'] ?? uniqid('pin_'));
        $type = esc_attr($pin_data['type'] ?? 'metric');
        $w = (int) ($pin_data['w'] ?? 1);
        $h = (int) ($pin_data['h'] ?? 1);
        $icon = $pin_data['icon'] ?? '';
        $label = $pin_data['label'] ?? '';
        $value = $pin_data['value'] ?? '';
        $html = $pin_data['html'] ?? '';

        $style = "grid-column: span {$w}; grid-row: span {$h};";

        echo "<div class=\"sd-pinned-item\" id=\"pin-{$id}\" data-id=\"{$id}\" style=\"{$style}\">";
        echo '<span class="dashicons dashicons-dismiss sd-pin-remove" title="Unpin" data-id="' . $id . '"></span>';

        if (!empty($html)) {
            echo '<div class="sd-pin-content custom">';
            echo wp_kses_post($html);
            echo '</div>';
        } else {
            echo '<div class="sd-pin-content default">';

            if (!empty($icon)) {
                if (strpos(trim($icon), '<svg') === 0) {
                    echo '<span class="sd-pin-icon custom">' . $icon . '</span>';
                } else {
                    echo '<span class="dashicons ' . esc_attr($icon) . ' sd-pin-icon"></span>';
                }
            }

            echo '<div class="sd-pin-meta">';
            echo '<span class="sd-pin-label">' . esc_html($label) . '</span>';
            echo '<span class="sd-pin-value">' . wp_kses_post($value) . '</span>';
            echo '</div>';

            echo '</div>';
        }

        echo '</div>';
    }
}
