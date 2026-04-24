<?php

/**
 * MenuEngine.php
 *
 * Generates the SystemDeck admin menu structure.
 *
 * PHP Version: 8+
 *
 * @package   SystemDeck\Core
 * @author    SystemDeck Dev Team
 * @license   GPL-2.0+
 *
 * ------------------------------------------------------------------------
 * USAGE NOTES & HOOKING GUIDE
 * ------------------------------------------------------------------------
 *
 * This class builds and renders the left navigation menu for SystemDeck.
 * The menu consists of:
 *   1. The immutable "System" link (always present, triggers config)
 *   2. Dynamic Workspaces (fetched from user meta)
 *   3. Optional external items via filter `sd_menu_items`
 *   4. Collapse button to fold/unfold the menu
 *
 * HOOKS & EXTENSIONS:
 *
 * 1. Filter `sd_menu_items`
 *    Allows adding, removing, or modifying menu items before render.
 *    Example usage:
 *      add_filter('sd_menu_items', function($items) {
 *          $items[] = [
 *              'id'       => 'sd-menu-custom',
 *              'title'    => 'Custom Plugin',
 *              'icon'     => 'dashicons-admin-generic',
 *              'href'     => '#custom-plugin',
 *              'current'  => false,
 *              'submenu'  => [
 *                  [
 *                      'title' => 'Subpage 1',
 *                      'href'  => '#custom-sub1',
 *                      'current' => false,
 *                      'data' => ['plugin' => 'custom-plugin']
 *                  ]
 *              ]
 *          ];
 *          return $items;
 *      });
 *
 * 2. Workspaces
 *    - Stored in user meta: `sd_workspaces`
 *    - Each workspace may have:
 *        - name (string) : Display name
 *        - id (string)   : Unique identifier (used for anchors)
 *        - order (int)   : Sort order
 *    - Legacy support: workspace key may be used as fallback
 *
 * 3. React Integration
 *    - React can read menu item data attributes (`data-workspace`, etc.)
 *    - Can dynamically inject additional menu items at runtime
 *    - Recommended approach: React listens for `sd_menu_items` filter data
 *
 * 4. Data Attributes
 *    - Main items: use `'data' => ['key' => 'value']` array
 *    - Rendered as `data-key="value"` on <a> links
 *    - Useful for JavaScript interactions, React hydration, or plugins
 *
 * 5. HTML & CSS Classes
 *    - Main wrapper: `<div id="sd-menuwrap"><ul id="sd-menu">...</ul></div>`
 *    - Top items: `<li class="menu-top wp-has-submenu">`
 *    - Submenus: `<ul class="wp-submenu wp-submenu-wrap">`
 *    - Submenu headers: `<li class="wp-submenu-head">`
 *    - Collapse button: `<li id="sd-collapse-menu"><button id="sd-collapse-button">...</button></li>`
 *
 * 6. Rendering Notes
 *    - `render()` handles the entire output
 *    - `render_item()` outputs a single <li> + optional submenu
 *    - `render_collapse_button()` adds the fold/unfold button
 *    - Safe escaping is used via `esc_attr()` and `esc_html()`
 *
 * 7. Extensibility Summary
 *    - Filters: `sd_menu_items` (before render)
 *    - Data Attributes: passed to links for JS hooks
 *    - React: can hydrate or add menu items dynamically
 *    - PHP Plugins: hook into `sd_menu_items` to append/remove items
 *
 * 8. Example Menu Structure
 *    [
 *      [
 *        'id' => 'sd-menu-system',
 *        'title' => 'System',
 *        'icon' => 'dashicons-networking',
 *        'href' => '#system',
 *        'current' => false,
 *        'submenu' => []
 *      ],
 *      [
 *        'id' => 'sd-menu-workspaces',
 *        'title' => 'Workspaces',
 *        'icon' => 'dashicons-archive',
 *        'href' => '#',
 *        'current' => false,
 *        'submenu' => [
 *          [
 *            'title' => 'Default',
 *            'href' => '#workspace-default',
 *            'current' => false,
 *            'data' => ['workspace' => 'default', 'name' => 'Default']
 *          ]
 *        ]
 *      ]
 *    ]
 *
 * ------------------------------------------------------------------------
 */

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class MenuEngine
{
    private $menu_items = [];

    public function __construct()
    {
        $this->build_menu_structure();
    }

    private function build_menu_structure(): void
    {
        $items = [];

        // --- SYSTEM LINK (Immutable) ---
        $items[] = [
            'id' => 'sd-menu-system',
            'title' => __('System', 'systemdeck'),
            'icon' => 'dashicons-networking',
            'href' => '#system',
            'current' => false,
            'submenu' => [],
        ];

        // --- WORKSPACES (Dynamic from UserMeta) ---
        $workspaces = get_user_meta(get_current_user_id(), 'sd_workspaces', true) ?: ['Default' => []];
        $workspace_subs = [];

        uasort($workspaces, function ($a, $b) {
            $order_a = is_array($a) ? ($a['order'] ?? 0) : 0;
            $order_b = is_array($b) ? ($b['order'] ?? 0) : 0;
            return $order_a - $order_b;
        });

        foreach ($workspaces as $key => $data) {
            $is_new_format = is_array($data) && isset($data['name']);
            if (is_array($data) && (!empty($data['is_app_workspace']) || !empty($data['app_id']))) {
                continue;
            }
            $title = $is_new_format ? $data['name'] : $key;
            $id = $is_new_format ? ($data['id'] ?? $key) : $key;
            $id_slug = sanitize_title($id);
            $workspace_subs[] = [
                'title' => $title,
                'href' => '#workspace-' . $id_slug,
                'current' => false,
                'data' => ['workspace_id' => $id, 'workspace_name' => $title],
            ];
        }

        $items[] = [
            'id' => 'sd-menu-workspaces',
            'title' => __('Workspaces', 'systemdeck'),
            'icon' => 'dashicons-archive',
            'href' => '#',
            'current' => false,
            'submenu' => $workspace_subs,
        ];

        // --- FILTER for Plugins & External Devs ---
        $this->menu_items = apply_filters('sd_menu_items', $items);
    }

    public function render(): void
    {
        echo '<div id="sd-menuwrap"><ul id="sd-menu">';

        foreach ($this->menu_items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $this->render_item($item);
        }

        $this->render_collapse_button();

        echo '</ul></div>';

        // --- React / JS hook: expose menu as JSON ---
        echo '<script id="sd-menu-data" type="application/json">'
            . wp_json_encode($this->menu_items)
            . '</script>';
    }

    private function render_item(array $item): void
    {
        $has_submenu = !empty($item['submenu']);
        $id_attr = isset($item['id']) ? ' id="' . esc_attr($item['id']) . '"' : '';
        $li_class = $has_submenu ? 'menu-top wp-has-submenu' : 'menu-top';

        echo '<li class="' . $li_class . '"' . $id_attr . '>';

        // Link + data attrs
        $data_attr = $this->render_data_attrs($item['data'] ?? []);
        echo '<a href="' . esc_url($item['href']) . '" class="menu-top"' . $data_attr . '>';
        echo '<div class="wp-menu-image dashicons-before ' . esc_attr($item['icon']) . '"><br></div>';
        echo '<div class="wp-menu-name">' . esc_html($item['title']) . '</div>';
        echo '</a>';

        if ($has_submenu) {
            echo '<ul class="wp-submenu wp-submenu-wrap">';
            echo '<li class="wp-submenu-head">' . esc_html($item['title']) . '</li>';
            foreach ($item['submenu'] as $sub) {
                echo '<li><a href="' . esc_url($sub['href']) . '"'
                    . $this->render_data_attrs($sub['data'] ?? []) . '>'
                    . esc_html($sub['title']) . '</a></li>';
            }
            echo '</ul>';
        }

        echo '</li>';
    }

    private function render_data_attrs(array $data): string
    {
        $out = '';
        foreach ($data as $k => $v) {
            $out .= ' data-' . esc_attr($k) . '="' . esc_attr($v) . '"';
        }
        return $out;
    }

    private function render_collapse_button(): void
    {
        echo '<li id="sd-collapse-menu">'
            . '<button type="button" id="sd-collapse-button" aria-expanded="true">'
            . '<span class="collapse-button-icon"></span>'
            . '<span class="collapse-button-label">' . __('Collapse Menu', 'systemdeck') . '</span>'
            . '</button></li>';
    }
}
