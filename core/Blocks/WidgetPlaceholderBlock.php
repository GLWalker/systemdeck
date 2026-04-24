<?php
declare(strict_types=1);

namespace SystemDeck\Core\Blocks;

if (!defined('ABSPATH')) {
    exit;
}

final class WidgetPlaceholderBlock
{
    public const BLOCK_NAME = 'systemdeck/widgets';

    public static function init(): void
    {
        add_action('init', [self::class, 'register_block']);
        add_action('save_post_systemdeck_canvas', [self::class, 'backfill_widget_column_spans'], 20, 3);
    }

    public static function register_block(): void
    {
        if (!function_exists('register_block_type')) {
            return;
        }

        wp_register_script(
            'sd-widget-placeholder-block',
            SYSTEMDECK_URL . 'assets/js/sd-widget-placeholder-block.js',
            ['wp-blocks', 'wp-element', 'wp-components', 'wp-i18n', 'wp-block-editor'],
            SYSTEMDECK_VERSION,
            true
        );
        $block_args = [
            'api_version' => 3,
            'title' => __('SystemDeck Widgets', 'systemdeck'),
            'description' => __('SystemDeck widget block that resolves to live runtime output.', 'systemdeck'),
            'category' => 'widgets',
            'icon' => 'screenoptions',
            'parent' => ['systemdeck/canvas-grid'],
            'editor_script' => 'sd-widget-placeholder-block',
            'attributes' => [
                'widgetId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'sdItemId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'title' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'columnSpan' => [
                    'type' => 'number',
                    'default' => 2,
                ],
                'rowSpan' => [
                    'type' => 'number',
                    'default' => 1,
                ],
                'gridX' => [
                    'type' => 'number',
                    'default' => 0,
                ],
                'gridY' => [
                    'type' => 'number',
                    'default' => 0,
                ],
            ],
            'supports' => [
                'html' => false,
                'align' => true,
                'spacing' => [
                    'margin' => true,
                    'padding' => true,
                ],
                'typography' => [
                    'fontSize' => true,
                    'lineHeight' => true,
                ],
                'color' => [
                    'text' => true,
                    'background' => true,
                    'link' => true,
                ],
            ],
            'render_callback' => [self::class, 'render'],
        ];

        register_block_type(self::BLOCK_NAME, $block_args);

        add_action('enqueue_block_editor_assets', [self::class, 'inject_editor_widget_data']);
    }

    /**
     * @param array<string,mixed> $attributes
     */
    public static function render(array $attributes): string
    {
        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($attributes['widgetId'] ?? ''));
        $title = sanitize_text_field((string) ($attributes['title'] ?? ''));
        if ($title === '' && $widget_id !== '') {
            $title = ucwords(str_replace(['_', '.', '-'], ' ', $widget_id));
        }
        if ($title === '') {
            $title = __('SystemDeck Widget', 'systemdeck');
        }
        $column_span = isset($attributes['columnSpan']) ? (int) $attributes['columnSpan'] : 2;
        $column_span = max(1, min(4, $column_span));

        if (self::is_block_editor_context()) {
            return self::render_wrapper(
                $widget_id,
                sprintf(
                    '<div class="sd-widget-placeholder-block__meta"><strong>%1$s</strong><small>%2$s</small></div>',
                    esc_html($title),
                    esc_html($widget_id !== '' ? $widget_id : __('Select a widget in block settings.', 'systemdeck'))
                ),
                $column_span,
                $attributes
            );
        }

        if ($widget_id === '') {
            return self::render_wrapper(
                '',
                sprintf(
                    '<div class="sd-widget-placeholder-block__meta"><strong>%1$s</strong><small>%2$s</small></div>',
                    esc_html($title),
                    esc_html__('Set widget ID in block settings.', 'systemdeck')
                ),
                $column_span,
                $attributes
            );
        }

        $html = self::render_widget_by_id($widget_id);
        if ($html === '') {
            return self::render_wrapper(
                $widget_id,
                sprintf(
                    '<div class="sd-widget-placeholder-block__meta"><strong>%1$s</strong><small>%2$s</small></div>',
                    esc_html($title),
                    esc_html__('Widget unavailable. Keep or remove this block manually.', 'systemdeck')
                ),
                $column_span,
                $attributes
            );
        }

        return self::render_wrapper($widget_id, $html, $column_span, $attributes);
    }

    public static function inject_editor_widget_data(): void
    {
        if (!is_admin() || !function_exists('get_current_screen')) {
            return;
        }

        $screen = get_current_screen();
        if (!$screen || (string) ($screen->post_type ?? '') !== 'systemdeck_canvas') {
            return;
        }

        $payload = [
            'postType' => 'systemdeck_canvas',
            'options' => self::get_editor_widget_options(),
        ];

        wp_add_inline_script(
            'sd-widget-placeholder-block',
            'window.SYSTEMDECK_WIDGET_SLOT_DATA = ' . wp_json_encode($payload) . ';',
            'before'
        );

    }

    /**
     * @return array<int,array{id:string,label:string,origin:string,originLabel:string,renderMode:string,renderLabel:string}>
     */
    private static function get_editor_widget_options(): array
    {
        $user_id = (int) get_current_user_id();
        $workspace_id = 'default';
        $post_id = (int) ($_GET['post'] ?? 0);
        if ($post_id > 0) {
            $workspace_meta = get_post_meta($post_id, \SystemDeck\Core\Services\CanvasRepository::META_WORKSPACE, true);
            if (is_string($workspace_meta) && $workspace_meta !== '') {
                $workspace_id = sanitize_key($workspace_meta);
            }
        }

        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        $workspace_widgets = [];
        if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspace_widgets = array_values(array_filter((array) ($workspaces[$workspace_id]['widgets'] ?? []), 'is_string'));
        }

        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : \SystemDeck\Core\Registry::get_snapshot();
        $definitions = (array) ($snapshot['widgets'] ?? []);

        $enablement = get_user_meta($user_id, 'sd_registry_enablement', true);
        $enabled = is_array($enablement) ? array_values(array_filter($enablement, 'is_string')) : array_keys($definitions);

        $allowed_ids = array_values(array_intersect(array_keys($definitions), $enabled));

        $options = [];
        foreach ($allowed_ids as $widget_id) {
            $definition = $definitions[$widget_id] ?? null;
            if (!is_array($definition)) {
                continue;
            }
            $options[] = [
                'id' => (string) $widget_id,
                'label' => (string) ($definition['title'] ?? $widget_id),
                'origin' => (string) ($definition['origin'] ?? 'external'),
                'originLabel' => self::editor_widget_origin_label((string) ($definition['origin'] ?? 'external')),
                'renderMode' => (string) ($definition['render_mode'] ?? ''),
                'renderLabel' => self::editor_widget_render_label(
                    (string) ($definition['origin'] ?? 'external'),
                    (string) ($definition['render_mode'] ?? '')
                ),
            ];
        }

        return $options;
    }

    private static function editor_widget_origin_label(string $origin): string
    {
        return match ($origin) {
            'core' => 'Core',
            'dashboard', 'discovered' => 'Dashboard',
            default => 'Third Party',
        };
    }

    private static function editor_widget_render_label(string $origin, string $render_mode): string
    {
        if ($origin === 'core') {
            return 'Native Widget';
        }

        if ($origin === 'dashboard' || $origin === 'discovered') {
            return 'Dashboard Widget';
        }

        return match ($render_mode) {
            'php' => 'PHP Widget',
            'plugin_tunnel' => 'Plugin Tunnel',
            'react_hosted' => 'React Hosted',
            'tunnel' => 'Tunnel Widget',
            default => 'Third Party Widget',
        };
    }

    /**
     * @param array<string,mixed> $attributes
     */
    private static function render_wrapper(string $widget_id, string $inner_html, int $column_span = 2, array $attributes = []): string
    {
        $column_span = max(1, min(4, $column_span));
        $grid_x = isset($attributes['gridX']) ? max(0, (int) $attributes['gridX']) : 0;
        $grid_y = isset($attributes['gridY']) ? max(0, (int) $attributes['gridY']) : 0;
        $row_span = isset($attributes['rowSpan']) ? max(1, (int) $attributes['rowSpan']) : 1;
        if (function_exists('get_block_wrapper_attributes')) {
            $wrapper = get_block_wrapper_attributes([
                'class' => 'sd-widget-block-host sd-col-span-' . $column_span,
                'data-sd-widget-id' => $widget_id,
                'data-sd-col-span' => (string) $column_span,
                'data-sd-row-span' => (string) $row_span,
                'data-sd-grid-x' => (string) $grid_x,
                'data-sd-grid-y' => (string) $grid_y,
            ]);
            return sprintf(
                '<div %1$s>%2$s</div>',
                $wrapper,
                $inner_html
            );
        }

        return sprintf(
            '<div class="sd-widget-block-host sd-col-span-%3$d" data-sd-widget-id="%1$s" data-sd-col-span="%3$d" data-sd-row-span="%4$d" data-sd-grid-x="%5$d" data-sd-grid-y="%6$d">%2$s</div>',
            esc_attr($widget_id),
            $inner_html,
            $column_span,
            $row_span,
            $grid_x,
            $grid_y
        );
    }

    private static function is_block_editor_context(): bool
    {
        if (defined('REST_REQUEST') && REST_REQUEST) {
            return true;
        }

        if (!is_admin() || !function_exists('get_current_screen')) {
            return false;
        }

        $screen = get_current_screen();
        return (bool) ($screen && method_exists($screen, 'is_block_editor') && $screen->is_block_editor());
    }

    public static function backfill_widget_column_spans(int $post_id, \WP_Post $post, bool $update): void
    {
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }
        if (!current_user_can('edit_post', $post_id) || !function_exists('parse_blocks') || !function_exists('serialize_blocks')) {
            return;
        }

        $content = (string) $post->post_content;
        if ($content === '' || strpos($content, 'wp:systemdeck/widgets') === false) {
            return;
        }

        $workspace_id = (string) get_post_meta($post_id, \SystemDeck\Core\Services\CanvasRepository::META_WORKSPACE, true);
        $workspace_id = class_exists('\\SystemDeck\\Core\\Registry')
            ? \SystemDeck\Core\Registry::resolve_workspace_id($workspace_id !== '' ? $workspace_id : 'default')
            : ($workspace_id !== '' ? sanitize_key($workspace_id) : 'default');
        $layout_map = self::layout_width_map_for_workspace($workspace_id);

        $changed = false;
        $blocks = parse_blocks($content);
        if (!is_array($blocks) || empty($blocks)) {
            return;
        }

        self::backfill_blocks_recursive($blocks, '0', $layout_map, $changed);
        if (!$changed) {
            return;
        }

        remove_action('save_post_systemdeck_canvas', [self::class, 'backfill_widget_column_spans'], 20);
        wp_update_post([
            'ID' => $post_id,
            'post_content' => serialize_blocks($blocks),
        ]);
        add_action('save_post_systemdeck_canvas', [self::class, 'backfill_widget_column_spans'], 20, 3);
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @param array<string,int> $layout_map
     */
    private static function backfill_blocks_recursive(array &$blocks, string $path, array $layout_map, bool &$changed): void
    {
        foreach ($blocks as $index => &$block) {
            if (!is_array($block)) {
                continue;
            }

            $next_path = $path . '_' . (string) $index;
            $name = (string) ($block['blockName'] ?? '');
            $attrs = is_array($block['attrs'] ?? null) ? $block['attrs'] : [];

            if ($name === self::BLOCK_NAME && !isset($attrs['columnSpan'])) {
                $runtime_id = self::runtime_id_from_block($name, $attrs, $next_path);
                $span = $layout_map[$runtime_id] ?? 2;
                $attrs['columnSpan'] = max(1, min(4, self::map_width_to_four((int) $span)));
                $block['attrs'] = $attrs;
                $changed = true;
            }

            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                self::backfill_blocks_recursive($block['innerBlocks'], $next_path, $layout_map, $changed);
            }
        }
    }

    /**
     * @return array<string,int>
     */
    private static function layout_width_map_for_workspace(string $workspace_id): array
    {
        $user_id = (int) get_current_user_id();
        $context = new \SystemDeck\Core\Context($user_id, $workspace_id);
        $layout = \SystemDeck\Core\StorageEngine::get('layout', $context);
        if (!is_array($layout)) {
            return [];
        }

        $map = [];
        foreach ($layout as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = sanitize_key((string) ($item['i'] ?? $item['id'] ?? ''));
            if ($id === '') {
                continue;
            }
            $w = (int) ($item['w'] ?? 0);
            if ($w > 0) {
                $map[$id] = self::map_width_to_four($w);
            }
        }

        return $map;
    }

    private static function map_width_to_four(int $width): int
    {
        if ($width <= 0) {
            return 2;
        }
        // Canonical desktop widget width is 1..6.
        // Preserve legacy widths by proportionally mapping old 12-col values.
        if ($width <= 6) {
            return max(1, min(6, $width));
        }
        if ($width <= 12) {
            return max(1, min(6, (int) round(($width / 12) * 6)));
        }
        return 6;
    }

    /**
     * @param array<string,mixed> $attrs
     */
    private static function runtime_id_from_block(string $name, array $attrs, string $path): string
    {
        $seed = sanitize_key((string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''));
        if ($seed === '') {
            $seed = sanitize_key(str_replace('/', '_', $name) . '_' . $path);
        }
        return 'sd_canvas_' . $seed;
    }
}
