<?php
/**
 * SystemDeck AJAX Handler
 * Handles legacy AJAX requests and bridges them to the new architecture.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

use SystemDeck\Core\Ajax\NotesAjaxController;
use SystemDeck\Core\Ajax\SystemAjaxController;
use SystemDeck\Core\Ajax\WidgetAjaxController;
use SystemDeck\Core\Ajax\WorkspaceAjaxController;
use SystemDeck\Core\Harvester;

class AjaxHandler
{
    private const WORKSPACE_EXPORT_SCHEMA_VERSION = '2.0';
    private const THEME_JSON_SCHEMA_VERSION = 3;
    private const ALLOWED_VISIBILITY_POLICIES = ['global', 'app_scoped', 'app_root_only', 'hidden'];
    private const USER_WORKSPACES_META_KEY = 'sd_workspaces';
    private const EXPORT_WORKSPACES_FILENAME = 'systemdeck-export.json';
    private static array $external_actions = [];
    private const WIDGET_UI_STATE_META_KEY = 'sd_widget_ui_state';
    private const WIDGET_UI_STATE_SCHEMA_VERSION = 1;
    private const WIDGET_UI_STATE_ALLOWED_FIELDS = ['collapsed', 'width', 'x', 'y'];

    private static function sanitize_mixed($value)
    {
        if (is_array($value)) {
            return array_map([self::class, 'sanitize_mixed'], $value);
        }
        if (is_string($value)) {
            return sanitize_text_field($value);
        }
        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
            return $value;
        }
        return sanitize_text_field((string) $value);
    }

    public static function normalize_workspace_id($value, bool $allow_empty = false): string
    {
        $raw = is_string($value) ? trim($value) : '';
        if ($raw === '') {
            return $allow_empty ? '' : 'default';
        }

        if (class_exists('\\SystemDeck\\Core\\Registry')) {
            $normalized = \SystemDeck\Core\Registry::resolve_workspace_id($raw);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        $normalized = sanitize_key($raw);
        if ($normalized !== '') {
            return $normalized;
        }

        return $allow_empty ? '' : 'default';
    }

    public static function normalize_visibility_policy(string $policy): string
    {
        $normalized = sanitize_key($policy);
        if (!in_array($normalized, self::ALLOWED_VISIBILITY_POLICIES, true)) {
            return 'global';
        }
        return $normalized;
    }

    public static function post_string(string $key, string $default = ''): string
    {
        $value = $_POST[$key] ?? null;
        if (is_array($value) || $value === null) {
            return $default;
        }

        return sanitize_text_field(wp_unslash((string) $value));
    }

    public static function post_key(string $key, string $default = ''): string
    {
        $value = $_POST[$key] ?? null;
        if (is_array($value) || $value === null) {
            return $default;
        }

        return sanitize_key(wp_unslash((string) $value));
    }

    public static function post_bool(string $key, bool $default = false): bool
    {
        if (!array_key_exists($key, $_POST)) {
            return $default;
        }

        $value = $_POST[$key];
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return ((int) $value) !== 0;
        }
        if (is_array($value)) {
            return $default;
        }

        $normalized = strtolower(trim(wp_unslash((string) $value)));
        if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off', ''], true)) {
            return false;
        }

        return $default;
    }

    public static function post_int(string $key, int $default = 0): int
    {
        if (!array_key_exists($key, $_POST)) {
            return $default;
        }

        $value = $_POST[$key];
        if (is_array($value)) {
            return $default;
        }

        return (int) wp_unslash((string) $value);
    }

    public static function post_json_array(string $key): array
    {
        return self::decode_json_array_from_post($key);
    }

    /**
     * Normalize widget UI state into the v1 envelope:
     * { _v: 1, workspaces: { [workspace_id]: { [widget_instance_id]: { collapsed?, width?, x?, y? } } } }
     *
     * Accepts both canonical and legacy flat workspace maps as input.
     *
     * @param mixed $raw
     * @return array{_v:int,workspaces:array<string,array<string,array<string,mixed>>>}
     */
    public static function normalize_widget_ui_state($raw): array
    {
        $normalized = [
            '_v' => self::WIDGET_UI_STATE_SCHEMA_VERSION,
            'workspaces' => [],
        ];

        if (!is_array($raw)) {
            return $normalized;
        }

        $candidate_workspaces = [];
        if (isset($raw['workspaces']) && is_array($raw['workspaces'])) {
            $candidate_workspaces = $raw['workspaces'];
        } else {
            // Legacy shape upgrade: top-level map of workspace_id => widget map.
            $candidate_workspaces = $raw;
        }

        foreach ($candidate_workspaces as $workspace_key => $workspace_state) {
            $workspace_id = self::normalize_workspace_id((string) $workspace_key, true);
            if ($workspace_id === '' || !is_array($workspace_state)) {
                continue;
            }

            foreach ($workspace_state as $widget_key => $widget_state) {
                $widget_id = trim((string) $widget_key);
                if ($widget_id === '' || !is_array($widget_state)) {
                    continue;
                }

                $entry = [];

                if (array_key_exists('collapsed', $widget_state)) {
                    $collapsed_raw = $widget_state['collapsed'];
                    $collapsed = false;
                    if (is_bool($collapsed_raw)) {
                        $collapsed = $collapsed_raw;
                    } elseif (is_numeric($collapsed_raw)) {
                        $collapsed = ((int) $collapsed_raw) !== 0;
                    } elseif (is_string($collapsed_raw)) {
                        $collapsed = in_array(strtolower(trim($collapsed_raw)), ['1', 'true', 'yes', 'on'], true);
                    }
                    $entry['collapsed'] = $collapsed;
                }

                if (array_key_exists('width', $widget_state)) {
                    $raw_width = (int) $widget_state['width'];
                    if ($raw_width > 0) {
                        $entry['width'] = self::normalize_widget_width($raw_width);
                    }
                }

                if (array_key_exists('x', $widget_state)) {
                    $entry['x'] = max(0, (int) $widget_state['x']);
                }

                if (array_key_exists('y', $widget_state)) {
                    $entry['y'] = max(0, (int) $widget_state['y']);
                }

                // Strict allowlist: only collapsed + width + x + y are retained.
                $entry = array_intersect_key($entry, array_flip(self::WIDGET_UI_STATE_ALLOWED_FIELDS));

                if (!empty($entry)) {
                    if (!isset($normalized['workspaces'][$workspace_id])) {
                        $normalized['workspaces'][$workspace_id] = [];
                    }
                    $normalized['workspaces'][$workspace_id][$widget_id] = $entry;
                }
            }
        }

        return $normalized;
    }

    /**
     * @return array{_v:int,workspaces:array<string,array<string,array<string,mixed>>>}
     */
    public static function get_normalized_widget_ui_state_for_user(int $user_id, bool $persist_upgrade = true): array
    {
        $raw = get_user_meta($user_id, self::WIDGET_UI_STATE_META_KEY, true);
        $normalized = self::normalize_widget_ui_state($raw);
        if ($persist_upgrade) {
            update_user_meta($user_id, self::WIDGET_UI_STATE_META_KEY, $normalized);
        }
        return $normalized;
    }

    /**
     * @param array{_v:int,workspaces:array<string,array<string,array<string,mixed>>>} $state
     */
    private static function save_normalized_widget_ui_state_for_user(int $user_id, array $state): void
    {
        update_user_meta($user_id, self::WIDGET_UI_STATE_META_KEY, self::normalize_widget_ui_state($state));
    }

    /**
     * @param string[] $active_widget_instance_ids
     */
    private static function prune_workspace_widget_ui_state_for_user(int $user_id, string $workspace_id, array $active_widget_instance_ids): void
    {
        $workspace_id = self::normalize_workspace_id($workspace_id);
        if ($workspace_id === '') {
            return;
        }

        $state = self::get_normalized_widget_ui_state_for_user($user_id, false);
        $workspace_state = $state['workspaces'][$workspace_id] ?? null;
        if (!is_array($workspace_state)) {
            return;
        }

        $active_lookup = [];
        foreach ($active_widget_instance_ids as $id) {
            $candidate = trim((string) $id);
            if ($candidate !== '') {
                $active_lookup[$candidate] = true;
            }
        }
        if (empty($active_lookup)) {
            unset($state['workspaces'][$workspace_id]);
            self::save_normalized_widget_ui_state_for_user($user_id, $state);
            return;
        }

        $pruned = [];
        foreach ($workspace_state as $widget_instance_id => $entry) {
            if (isset($active_lookup[(string) $widget_instance_id]) && is_array($entry) && !empty($entry)) {
                $pruned[(string) $widget_instance_id] = $entry;
            }
        }

        if (empty($pruned)) {
            unset($state['workspaces'][$workspace_id]);
        } else {
            $state['workspaces'][$workspace_id] = $pruned;
        }

        self::save_normalized_widget_ui_state_for_user($user_id, $state);
    }

    public static function decode_json_array_from_post(string $key): array
    {
        if (!array_key_exists($key, $_POST)) {
            return [];
        }

        $value = $_POST[$key];
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode(wp_unslash((string) $value), true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @return array<string,mixed>
     */
    public static function get_user_workspaces(int $user_id): array
    {
        if ($user_id <= 0) {
            return [];
        }

        $workspaces = get_user_meta($user_id, self::USER_WORKSPACES_META_KEY, true);
        return is_array($workspaces) ? $workspaces : [];
    }

    public static function save_user_workspaces(int $user_id, array $workspaces): bool
    {
        if ($user_id <= 0) {
            return false;
        }

        update_user_meta($user_id, self::USER_WORKSPACES_META_KEY, $workspaces);
        return true;
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function sanitize_layout_item(array $item, int $fallback_index = 0): ?array
    {
        $id = sanitize_key((string) ($item['id'] ?? $item['i'] ?? ''));
        if ($id === '') {
            return null;
        }

        return [
            'id' => $id,
            'type' => sanitize_key((string) ($item['type'] ?? 'widget')) ?: 'widget',
            'settings' => is_array($item['settings'] ?? null) ? $item['settings'] : [],
            'x' => (int) ($item['x'] ?? 0),
            'y' => (int) ($item['y'] ?? $fallback_index),
            'w' => (int) ($item['w'] ?? 4),
            'h' => (int) ($item['h'] ?? 4),
        ];
    }

    /**
     * @param array<string,mixed> $pin
     * @return array<string,mixed>|null
     */
    private static function normalize_pin_record(array $pin, int $fallback_index = 0): ?array
    {
        $id = sanitize_key((string) ($pin['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $settings = is_array($pin['settings'] ?? null) ? $pin['settings'] : [];
        $data = is_array($pin['data'] ?? null) ? $pin['data'] : [];

        $raw_type = strtolower((string) ($pin['type'] ?? $settings['type'] ?? $data['type'] ?? 'system.status'));
        $type = (string) preg_replace('/[^a-z0-9._-]/', '', $raw_type);
        if ($type === '' || $type === 'pin') {
            $type = 'system.status';
        }

        $allowed_grid_spans = ['1x1', '2x1', '3x1', '4x1', '1x2', '2x2', '3x2'];
        $requested_size = sanitize_key((string) ($pin['size'] ?? $settings['grid_span'] ?? $settings['size'] ?? $settings['span'] ?? ''));
        $requested_width = max(1, min(4, (int) ($pin['w'] ?? 1)));
        $requested_height = max(1, min(2, (int) ($pin['h'] ?? 1)));

        if (in_array($requested_size, $allowed_grid_spans, true)) {
            $size_parts = explode('x', $requested_size);
            $requested_width = max(1, min(4, (int) ($size_parts[0] ?? 1)));
            $requested_height = max(1, min(2, (int) ($size_parts[1] ?? 1)));
        } else {
            $candidate_size = $requested_width . 'x' . $requested_height;
            $requested_size = in_array($candidate_size, $allowed_grid_spans, true) ? $candidate_size : '1x1';
            $size_parts = explode('x', $requested_size);
            $requested_width = max(1, min(4, (int) ($size_parts[0] ?? 1)));
            $requested_height = max(1, min(2, (int) ($size_parts[1] ?? 1)));
        }

        $renderer = sanitize_key((string) ($pin['renderer'] ?? $settings['renderer'] ?? 'dom'));
        if ($renderer === '') {
            $renderer = 'dom';
        }

        $design_template = sanitize_key((string) ($pin['design_template'] ?? $settings['design_template'] ?? 'default'));
        if ($design_template === '') {
            $design_template = 'default';
        }

        $title = sanitize_text_field((string) ($pin['title'] ?? $settings['label'] ?? $data['label'] ?? ('Pin ' . ($fallback_index + 1))));
        if ($title === '') {
            $title = 'Pin ' . ($fallback_index + 1);
        }

        $metric_key = strtolower((string) ($data['metric_key'] ?? $settings['metric_key'] ?? ''));
        $metric_key = (string) preg_replace('/[^a-z0-9._-]/', '', $metric_key);
        $source_widget = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($data['source_widget'] ?? $settings['source_widget'] ?? ''));
        $icon = sanitize_html_class((string) ($data['icon'] ?? $settings['icon'] ?? 'dashicons-admin-generic'));
        $sticky_level = sanitize_key((string) ($data['sticky_level'] ?? $data['pin_level'] ?? $settings['sticky_level'] ?? $settings['pin_level'] ?? 'low'));
        $pin_kind = sanitize_key((string) ($data['pin_kind'] ?? $settings['pin_kind'] ?? ''));

        if ($type === 'note') {
            $pin_kind = 'pinned_note';
        } elseif ($type === 'vault') {
            $pin_kind = 'pinned_file';
        }

        $normalized_data = is_array($data) ? self::sanitize_mixed($data) : [];
        $normalized_data['label'] = $title;
        $normalized_data['metric_key'] = $metric_key;
        $normalized_data['metric_family'] = sanitize_text_field((string) ($data['metric_family'] ?? $settings['metric_family'] ?? ''));
        $normalized_data['metric_authority'] = sanitize_text_field((string) ($data['metric_authority'] ?? $settings['metric_authority'] ?? ''));
        $normalized_data['metric_mode'] = sanitize_text_field((string) ($data['metric_mode'] ?? $settings['metric_mode'] ?? ''));
        $normalized_data['category'] = sanitize_key((string) ($data['category'] ?? $settings['category'] ?? ''));
        $normalized_data['description'] = sanitize_text_field((string) ($data['description'] ?? $settings['description'] ?? ''));
        $normalized_data['source_widget'] = $source_widget;
        $normalized_data['icon'] = $icon;
        $normalized_data['sticky_level'] = $sticky_level;
        $normalized_data['pin_kind'] = $pin_kind;
        $normalized_data['value_label'] = sanitize_text_field((string) ($data['value_label'] ?? $settings['value_label'] ?? ''));
        $normalized_data['action'] = sanitize_key((string) ($data['action'] ?? $settings['action'] ?? ''));
        $normalized_data['workspace_id'] = self::normalize_workspace_id((string) ($data['workspace_id'] ?? $settings['workspace_id'] ?? ''), true);
        $normalized_data['pin_definition_id'] = (string) preg_replace('/[^a-z0-9._-]/', '', strtolower((string) ($data['pin_definition_id'] ?? $settings['pin_definition_id'] ?? '')));
        $normalized_data['pin_source_kind'] = sanitize_key((string) ($data['pin_source_kind'] ?? $settings['pin_source_kind'] ?? ''));
        $normalized_data['pin_source_authority'] = sanitize_key((string) ($data['pin_source_authority'] ?? $settings['pin_source_authority'] ?? ''));
        $normalized_data['pin_source_id'] = (string) preg_replace('/[^a-z0-9._-]/', '', strtolower((string) ($data['pin_source_id'] ?? $settings['pin_source_id'] ?? '')));
        if (!array_key_exists('value', $normalized_data)) {
            $normalized_data['value'] = sanitize_text_field((string) ($settings['value'] ?? ''));
        }

        if ($type === 'note') {
            $normalized_data['type'] = 'note';
            $normalized_data['noteId'] = (int) ($normalized_data['noteId'] ?? $settings['noteId'] ?? 0);
        } elseif ($type === 'vault') {
            $normalized_data['type'] = 'vault';
            $normalized_data['fileId'] = (int) ($normalized_data['fileId'] ?? $settings['fileId'] ?? 0);
        }

        $settings = is_array($pin['settings'] ?? null) ? $pin['settings'] : [];
        $normalized_settings = [
            'label' => $title,
            'value' => sanitize_text_field((string) ($normalized_data['value'] ?? '')),
            'value_label' => sanitize_text_field((string) ($normalized_data['value_label'] ?? '')),
            'icon' => $icon,
            'source_widget' => $source_widget,
            'metric_key' => $metric_key,
            'metric_family' => sanitize_text_field((string) ($normalized_data['metric_family'] ?? '')),
            'metric_authority' => sanitize_text_field((string) ($normalized_data['metric_authority'] ?? '')),
            'metric_mode' => sanitize_text_field((string) ($normalized_data['metric_mode'] ?? '')),
            'category' => sanitize_key((string) ($normalized_data['category'] ?? '')),
            'description' => sanitize_text_field((string) ($normalized_data['description'] ?? '')),
            'pin_definition_id' => (string) ($normalized_data['pin_definition_id'] ?? ''),
            'pin_source_kind' => sanitize_key((string) ($normalized_data['pin_source_kind'] ?? '')),
            'pin_source_authority' => sanitize_key((string) ($normalized_data['pin_source_authority'] ?? '')),
            'pin_source_id' => (string) ($normalized_data['pin_source_id'] ?? ''),
            'action' => sanitize_key((string) ($normalized_data['action'] ?? '')),
            'workspace_id' => self::normalize_workspace_id((string) ($normalized_data['workspace_id'] ?? ''), true),
            'grid_span' => $requested_size,
            'renderer' => $renderer,
            'design_template' => $design_template,
            'pin_kind' => $pin_kind,
            'sticky_level' => $sticky_level,
        ];

        if ($type === 'note') {
            $normalized_settings['type'] = 'note';
            $normalized_settings['noteId'] = (int) ($normalized_data['noteId'] ?? $settings['noteId'] ?? 0);
            $normalized_settings['pin_kind'] = 'pinned_note';
        } elseif ($type === 'vault') {
            $normalized_settings['type'] = 'vault';
            $normalized_settings['fileId'] = (int) ($normalized_data['fileId'] ?? $settings['fileId'] ?? 0);
            $normalized_settings['pin_kind'] = 'pinned_file';
        }

        return [
            'id' => $id,
            'type' => $type,
            'size' => $requested_size,
            'renderer' => $renderer,
            'title' => $title,
            'data' => $normalized_data,
            'design_template' => $design_template,
            'settings' => $normalized_settings,
            'x' => (int) ($pin['x'] ?? 0),
            'y' => (int) ($pin['y'] ?? $fallback_index),
            'w' => $requested_width,
            'h' => $requested_height,
            'is_pinned' => 1,
        ];
    }

    /**
     * @param array<string,mixed> $pin
     * @param array<string,mixed> $existing_pin
     * @return array<string,mixed>|null
     */
    public static function sanitize_pin_item(array $pin, array $existing_pin, int $current_user_id): ?array
    {
        $normalized = self::normalize_pin_record($pin);
        if ($normalized === null) {
            return null;
        }

        $existing_settings = is_array($existing_pin['settings'] ?? null) ? $existing_pin['settings'] : [];
        $normalized['settings']['author_id'] = isset($existing_settings['author_id'])
            ? (int) $existing_settings['author_id']
            : $current_user_id;
        $normalized['data']['author_id'] = (int) $normalized['settings']['author_id'];

        return $normalized;
    }

    /**
     * @param array<string,mixed> $workspace
     * @return array<string,mixed>
     */
    public static function normalize_workspace_record(array $workspace, string $workspace_id): array
    {
        $widgets = is_array($workspace['widgets'] ?? null) ? $workspace['widgets'] : [];
        $widgets = array_values(array_unique(array_filter(array_map('sanitize_key', $widgets))));

        return [
            'id' => $workspace_id,
            'name' => sanitize_text_field((string) ($workspace['name'] ?? $workspace['title'] ?? 'Imported')),
            'widgets' => $widgets,
            'created' => sanitize_text_field((string) ($workspace['created'] ?? current_time('mysql'))),
            'order' => (int) ($workspace['order'] ?? 0),
            'shared' => !empty($workspace['shared']),
            'pinned' => !empty($workspace['pinned']),
            'source_workspace_id' => sanitize_text_field((string) ($workspace['source_workspace_id'] ?? '')),
            'source_version_at_clone' => (int) ($workspace['source_version_at_clone'] ?? 0),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public static function get_workspace_record_for_user(int $user_id, string $workspace_id): array
    {
        if ($user_id <= 0 || $workspace_id === '') {
            return [];
        }

        $workspaces = self::get_user_workspaces($user_id);

        $record = $workspaces[$workspace_id] ?? null;
        return is_array($record) ? $record : [];
    }

    public static function is_widget_active_for_workspace(array $workspace_record, string $widget_id): bool
    {
        if ($widget_id === '') {
            return false;
        }
        $widgets = is_array($workspace_record['widgets'] ?? null) ? $workspace_record['widgets'] : [];
        return in_array($widget_id, array_map('strval', $widgets), true);
    }

    /**
     * @return array{allowed:bool,message:string}
     */
    public static function evaluate_widget_toggle_policy(array $widget_def, array $workspace_record, string $widget_id): array
    {
        $policy = self::normalize_visibility_policy((string) ($widget_def['visibility_policy'] ?? 'global'));
        $widget_app_id = sanitize_key((string) ($widget_def['app_id'] ?? ''));
        $workspace_app_id = sanitize_key((string) ($workspace_record['app_id'] ?? ''));
        $is_app_workspace = !empty($workspace_record['is_app_workspace']);
        $is_matching_app_workspace = $is_app_workspace && $workspace_app_id !== '' && $widget_app_id !== '' && $workspace_app_id === $widget_app_id;
        $is_active = self::is_widget_active_for_workspace($workspace_record, $widget_id);

        if ($policy === 'global') {
            return ['allowed' => true, 'message' => ''];
        }

        if ($policy === 'hidden') {
            if ($is_active) {
                return ['allowed' => true, 'message' => ''];
            }
            return ['allowed' => false, 'message' => 'This widget is hidden and cannot be added from picker flows.'];
        }

        if ($policy === 'app_scoped') {
            if ($is_matching_app_workspace || $is_active) {
                return ['allowed' => true, 'message' => ''];
            }
            return ['allowed' => false, 'message' => 'This widget is app-scoped and unavailable in this workspace.'];
        }

        // app_root_only
        if (!$is_matching_app_workspace) {
            return ['allowed' => false, 'message' => 'This app root widget is only available in its app workspace.'];
        }

        if (class_exists('\\SystemDeck\\Core\\AppRuntime') && $workspace_app_id !== '') {
            $allowlist = \SystemDeck\Core\AppRuntime::get_allowlist_widget_ids($workspace_app_id);
            if (!empty($allowlist) && !in_array($widget_id, $allowlist, true)) {
                return ['allowed' => false, 'message' => 'This app root widget is not allowlisted for this app workspace.'];
            }
        }

        return ['allowed' => true, 'message' => ''];
    }

    public static function init(): void
    {
        $routes = [
            'ping_latency' => [SystemAjaxController::class, 'handle_ping_latency'],
            'clear_cache' => [SystemAjaxController::class, 'handle_clear_cache'],
            'sweep_orphans' => [SystemAjaxController::class, 'handle_sweep_orphans'],
            'purge_widgets' => [SystemAjaxController::class, 'handle_purge_widgets'],
            'save_widget_data' => [WidgetAjaxController::class, 'handle_save_widget_data'],
            'get_widget_data' => [WidgetAjaxController::class, 'handle_get_widget_data'],
            'get_telemetry' => [SystemAjaxController::class, 'handle_get_telemetry'],
            'render_pin' => [SystemAjaxController::class, 'handle_render_pin'],
            'get_pin_safe_metrics' => [SystemAjaxController::class, 'handle_get_pin_safe_metrics'],
            'create_registry_pin' => [SystemAjaxController::class, 'handle_create_registry_pin'],
            'create_metric_pin' => [SystemAjaxController::class, 'handle_create_metric_pin'],
            'export_workspaces' => [WorkspaceAjaxController::class, 'handle_export_workspaces'],
            'import_workspaces' => [WorkspaceAjaxController::class, 'handle_import_workspaces'],
            'get_harvest' => [SystemAjaxController::class, 'handle_get_harvest'],
            'save_layout' => [WorkspaceAjaxController::class, 'handle_save_layout'],
            'persist_workspace_state' => [WorkspaceAjaxController::class, 'handle_persist_workspace_state'],
            'render_widget' => [WidgetAjaxController::class, 'handle_render_widget'],
            'resolve_widget' => [WidgetAjaxController::class, 'handle_resolve_widget'],
            'get_workspace_pins' => [WorkspaceAjaxController::class, 'handle_get_workspace_pins'],
            'save_workspace_pins' => [WorkspaceAjaxController::class, 'handle_save_workspace_pins'],
            'toggle_workspace_widget_block' => [WorkspaceAjaxController::class, 'handle_toggle_workspace_widget_block'],
            'sync_workspace_widget_list' => [WorkspaceAjaxController::class, 'handle_sync_workspace_widget_list'],
            'set_widget_block_width' => [WorkspaceAjaxController::class, 'handle_set_widget_block_width'],
            'set_widget_ui_state' => [WorkspaceAjaxController::class, 'handle_set_widget_ui_state'],
            'sync_layout_to_editor' => [WorkspaceAjaxController::class, 'handle_sync_layout_to_editor'],
            'save_widget_selection' => [SystemAjaxController::class, 'handle_save_widget_selection'],
            'save_registry_state' => [SystemAjaxController::class, 'handle_save_registry_state'],
            'get_access_policy' => [SystemAjaxController::class, 'handle_get_access_policy'],
            'save_access_policy' => [SystemAjaxController::class, 'handle_save_access_policy'],
            'create_workspace' => [WorkspaceAjaxController::class, 'handle_create_workspace'],
            'delete_workspace' => [WorkspaceAjaxController::class, 'handle_delete_workspace'],
            'rename_workspace' => [WorkspaceAjaxController::class, 'handle_rename_workspace'],
            'reorder_workspaces' => [WorkspaceAjaxController::class, 'handle_reorder_workspaces'],
            'publish_workspace_template' => [WorkspaceAjaxController::class, 'handle_publish_workspace_template'],
            'reset_workspace_to_source' => [WorkspaceAjaxController::class, 'handle_reset_workspace_to_source'],
            'check_workspace_update' => [WorkspaceAjaxController::class, 'handle_check_workspace_update'],
            'get_workspace_editor_url' => [WorkspaceAjaxController::class, 'handle_get_workspace_editor_url'],
            'set_workspace_access_role' => [WorkspaceAjaxController::class, 'handle_set_workspace_access_role'],
            'set_workspace_visibility' => [WorkspaceAjaxController::class, 'handle_set_workspace_visibility'],
            'set_workspace_collaboration_mode' => [WorkspaceAjaxController::class, 'handle_set_workspace_collaboration_mode'],
            'set_workspace_audience' => [WorkspaceAjaxController::class, 'handle_set_workspace_audience'],
            'get_workspace_audience_candidates' => [WorkspaceAjaxController::class, 'handle_get_workspace_audience_candidates'],
            'set_workspace_app_menu' => [WorkspaceAjaxController::class, 'handle_set_workspace_app_menu'],
            'get_notes' => [NotesAjaxController::class, 'handle_get_notes'],
            'get_all_notes' => [NotesAjaxController::class, 'handle_get_all_notes'],
            'get_read_note' => [NotesAjaxController::class, 'handle_get_read_note'],
            'save_note' => [NotesAjaxController::class, 'handle_save_note'],
            'delete_note' => [NotesAjaxController::class, 'handle_delete_note'],
            'pin_note' => [NotesAjaxController::class, 'handle_pin_note'],
            'toggle_note_sticky' => [NotesAjaxController::class, 'handle_toggle_note_sticky'],
            'get_note_comments' => [NotesAjaxController::class, 'handle_get_note_comments'],
            'add_note_comment' => [NotesAjaxController::class, 'handle_add_note_comment'],
            'rebuild_registry_snapshot' => [SystemAjaxController::class, 'handle_rebuild_registry_snapshot'],
            'get_discovered_widgets' => [SystemAjaxController::class, 'handle_get_discovered_widgets'],
            'reset_systemdeck' => [SystemAjaxController::class, 'handle_reset_systemdeck'],
            'save_user_preferences' => [SystemAjaxController::class, 'handle_save_user_preferences'],
        ];

        foreach ($routes as $action => $callback) {
            add_action("wp_ajax_sd_{$action}", $callback);
        }
        self::audit_permission_map_parity(array_keys($routes));

        // Third parties may register secure SystemDeck AJAX actions here.
        do_action('systemdeck_register_ajax_actions', self::class);
    }

    /**
     * Helper for third-party widgets to register secure SystemDeck AJAX actions.
     */
    public static function register_external_action(string $action, callable $callback, string $capability = 'manage_options', bool $require_nonce = true): void
    {
        $action = sanitize_key($action);
        if ($action === '') {
            return;
        }

        if (isset(self::$external_actions[$action])) {
            return;
        }

        self::$external_actions[$action] = true;

        add_action("wp_ajax_sd_{$action}", static function () use ($callback, $capability, $require_nonce): void {
            self::verify_request($capability, $require_nonce);
            call_user_func($callback);
        });
    }

    public static function verify_request(string $capability = 'manage_options', bool $require_nonce = true): void
    {
        // Canonical runtime nonce key is `nonce`, with WordPress AJAX key
        // fallbacks accepted for compatibility with upstream/request wrappers.
        $nonce = self::post_string('nonce');
        if ($nonce === '') {
            $nonce = self::post_string('_ajax_nonce');
        }
        if ($nonce === '') {
            $nonce = self::post_string('_wpnonce');
        }
        $action = 'systemdeck_runtime';
        $action_name = self::post_string('action');
        $workspace_id = self::normalize_workspace_id(
            self::post_string('workspace_id'),
            true
        );

        $allowed = false;
        $normalized_action = str_starts_with($action_name, 'sd_') ? substr($action_name, 3) : $action_name;
        $is_external_action = isset(self::$external_actions[sanitize_key($normalized_action)]);
        $permission = 'none';

        if (function_exists('systemdeck_user_can') && !$is_external_action) {
            $permission = self::permission_for_ajax_action($action_name);
            if ($permission === 'deny') {
                wp_send_json_error([
                    'message' => 'Unauthorized (Unmapped AJAX action)',
                    'code' => 'unmapped_ajax_action',
                ], 403);
            }
            if ($permission === 'workspace_view') {
                $allowed = self::user_can_view_workspace((int) get_current_user_id(), $workspace_id);
            }
            if (!$allowed) {
                $allowed = systemdeck_user_can($permission, $workspace_id);
            }
        }
        if (!$allowed) {
            $allowed = current_user_can($capability);
        }
        if (!$allowed) {
            wp_send_json_error(['message' => 'Unauthorized (Permission Denied)', 'code' => 'unauthorized'], 403);
        }

        if ($require_nonce) {
            $valid_nonce = wp_verify_nonce($nonce, $action);
            if (!$valid_nonce) {
                wp_send_json_error(['message' => 'Invalid security token (Nonce Authority Violation)', 'code' => 'nonce_failure'], 403);
            }
        }
    }

    private static function user_can_view_workspace(int $user_id, string $workspace_id): bool
    {
        if (!function_exists('systemdeck_user_meets_workspace_access')) {
            return false;
        }

        return systemdeck_user_meets_workspace_access($user_id, $workspace_id, 'workspace_view');
    }

    private static function permission_for_ajax_action(string $action): string
    {
        $normalized = str_starts_with($action, 'sd_') ? substr($action, 3) : $action;
        $map = self::ajax_permission_map();
        return $map[$normalized] ?? 'deny';
    }

    /**
     * @return array<string,string>
     */
    private static function ajax_permission_map(): array
    {
        return [
            'ping_latency' => 'shell_access',
            'create_workspace' => 'workspace_create',
            'delete_workspace' => 'workspace_delete',
            'rename_workspace' => 'workspace_edit',
            'reorder_workspaces' => 'workspace_edit',
            'save_widget_data' => 'workspace_manage',
            'get_widget_data' => 'workspace_view',
            'get_telemetry' => 'workspace_view',
            'render_pin' => 'workspace_view',
            'get_pin_safe_metrics' => 'workspace_view',
            'create_registry_pin' => 'workspace_edit',
            'create_metric_pin' => 'workspace_edit',
            'export_workspaces' => 'workspace_manage',
            'import_workspaces' => 'workspace_manage',
            'get_harvest' => 'workspace_view',
            'clear_cache' => 'workspace_manage',
            'sweep_orphans' => 'workspace_manage',
            'purge_widgets' => 'workspace_manage',
            'save_layout' => 'workspace_edit',
            'save_workspace_pins' => 'workspace_edit',
            'persist_workspace_state' => 'workspace_edit',
            'toggle_workspace_widget_block' => 'workspace_edit',
            'set_widget_block_width' => 'workspace_edit',
            'set_widget_ui_state' => 'workspace_edit',
            'sync_layout_to_editor' => 'workspace_edit',
            'get_workspace_editor_url' => 'workspace_edit',
            'set_workspace_access_role' => 'workspace_manage',
            'set_workspace_visibility' => 'workspace_manage',
            'set_workspace_collaboration_mode' => 'workspace_manage',
            'set_workspace_audience' => 'workspace_manage',
            'get_workspace_audience_candidates' => 'workspace_manage',
            'set_workspace_app_menu' => 'workspace_manage',
            'publish_workspace_template' => 'workspace_manage',
            'reset_workspace_to_source' => 'workspace_manage',
            'check_workspace_update' => 'workspace_view',
            'render_widget' => 'workspace_view',
            'resolve_widget' => 'workspace_view',
            'get_workspace_pins' => 'workspace_view',
            'toggle_workspace_widget_block' => 'workspace_edit',
            'sync_workspace_widget_list' => 'workspace_edit',
            'save_widget_selection' => 'workspace_manage',
            'save_registry_state' => 'workspace_manage',
            'get_access_policy' => 'workspace_manage',
            'save_access_policy' => 'workspace_manage',
            'get_notes' => 'workspace_manage',
            'get_all_notes' => 'workspace_manage',
            'get_read_note' => 'workspace_view',
            'save_note' => 'workspace_manage',
            'delete_note' => 'workspace_manage',
            'pin_note' => 'workspace_manage',
            'toggle_note_sticky' => 'workspace_manage',
            'get_note_comments' => 'workspace_view',
            'add_note_comment' => 'workspace_view',
            'rebuild_registry_snapshot' => 'workspace_manage',
            'get_discovered_widgets' => 'workspace_manage',
            'reset_systemdeck' => 'workspace_manage',
            'save_user_preferences' => 'workspace_manage',
        ];
    }

    /**
     * @param array<int,string> $registered_actions
     */
    private static function audit_permission_map_parity(array $registered_actions): void
    {
        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }

        $map = self::ajax_permission_map();
        foreach ($registered_actions as $action) {
            if (!isset($map[$action])) {
                error_log('SystemDeck: Missing AJAX permission mapping for action "' . $action . '".');
            }
        }
    }

    /* ==========================================================================
       1. SYSTEM UTILITIES
       ========================================================================== */

    public static function handle_ping_latency(): void
    {
        self::verify_request();

        wp_send_json_success(['ts' => microtime(true)]);
    }

    public static function handle_sweep_orphans(): void
    {
        self::verify_request('manage_options');
        
        if (!class_exists('\\SystemDeck\\Core\\Services\\ProjectionService')) {
            wp_send_json_error(['message' => 'ProjectionService not available'], 500);
        }

        $purged_count = \SystemDeck\Core\Services\ProjectionService::sweep_orphaned_projections();
        $orphaned_workspaces_removed = 0;

        // True orphan sweep: remove app workspaces whose app is no longer registered.
        if (class_exists('\\SystemDeck\\Core\\AppRuntime')) {
            $apps = \SystemDeck\Core\AppRuntime::get_registered_apps();
            $active_app_ids = [];
            $active_workspace_ids = [];
            foreach ((array) $apps as $app) {
                if (!is_array($app)) {
                    continue;
                }
                $aid = sanitize_key((string) ($app['id'] ?? ''));
                $wid = sanitize_key((string) ($app['workspace_id'] ?? ''));
                if ($aid !== '') {
                    $active_app_ids[$aid] = true;
                }
                if ($wid !== '') {
                    $active_workspace_ids[$wid] = true;
                }
            }

            $user_ids = get_users(['fields' => 'ID']);
            foreach ((array) $user_ids as $uid_raw) {
                $uid = (int) $uid_raw;
                if ($uid <= 0) {
                    continue;
                }
                $workspaces = self::get_user_workspaces($uid);
                if (!is_array($workspaces) || empty($workspaces)) {
                    continue;
                }

                foreach ($workspaces as $workspace_id => $ws) {
                    $workspace_id = sanitize_key((string) $workspace_id);
                    if ($workspace_id === '' || !is_array($ws)) {
                        continue;
                    }

                    $is_app_workspace = !empty($ws['is_app_workspace']);
                    $app_id = sanitize_key((string) ($ws['app_id'] ?? ''));
                    if (!$is_app_workspace && $app_id === '') {
                        continue;
                    }

                    $is_active_by_workspace = isset($active_workspace_ids[$workspace_id]);
                    $is_active_by_app_id = ($app_id !== '' && isset($active_app_ids[$app_id]));
                    if ($is_active_by_workspace || $is_active_by_app_id) {
                        continue;
                    }

                    $owner_id = self::get_workspace_owner_id($workspace_id, $uid);
                    $canvas_id = (int) ($ws['canvas_id'] ?? 0);
                    if ($canvas_id <= 0 && class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
                        $resolved = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, (int) $owner_id);
                        $canvas_id = (int) ($resolved['id'] ?? 0);
                    }

                    if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
                        \SystemDeck\Core\Services\CanvasRepository::delete_canvas_for_workspace($workspace_id, (int) $owner_id);
                    }
                    self::purge_workspace_for_all_users($workspace_id, $canvas_id);
                    $orphaned_workspaces_removed++;
                }
            }
        }

        wp_send_json_success([
            'message' => sprintf(
                'Swept %d orphaned projections and removed %d orphaned app workspaces.',
                $purged_count,
                $orphaned_workspaces_removed
            ),
            'purged' => $purged_count,
            'orphaned_workspaces_removed' => $orphaned_workspaces_removed,
        ]);
    }

    public static function handle_clear_cache(): void
    {
        self::verify_request();

        $type = self::post_string('type', 'all');
        $cleared = [];

        if ($type === 'object' || $type === 'all_sitewide') {
            if (!current_user_can('manage_options')) {
                wp_send_json_error([
                    'message' => 'Only administrators may flush sitewide object cache.',
                    'code' => 'object_cache_forbidden',
                ], 403);
            }
            wp_cache_flush();
            $cleared[] = 'Object Cache';
        }

        // "all" is SystemDeck-scoped by default.
        if ($type === 'all' || $type === 'all_sitewide' || $type === 'transients') {
            global $wpdb;
            $wpdb->query("DELETE FROM $wpdb->options WHERE option_name LIKE '_transient_sd_%' OR option_name LIKE '_transient_timeout_sd_%'");
            $cleared[] = 'SystemDeck Transients';
        }

        if ($type === 'all' || $type === 'all_sitewide' || $type === 'css') {
            if (class_exists('\\SystemDeck\\Core\\Assets')) {
                \SystemDeck\Core\Assets::clear_css_cache((int) get_current_user_id());
            }
            $cleared[] = 'CSS Cache';
        }

        wp_send_json_success(['message' => 'Cleared: ' . implode(', ', $cleared)]);
    }

    /**
     * AJAX: Purge discovered/dashboard widget entries so registry returns to core-only
     * until the user runs rebuild/scanner again.
     */
    public static function handle_purge_widgets(): void
    {
        self::verify_request();

        global $wpdb;

        $table = $wpdb->prefix . 'sd_discovered_widgets';
        $table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
        $purged_table_rows = 0;
        if ($table_exists === $table) {
            $purged_table_rows = (int) $wpdb->query("DELETE FROM $table");
        }

        $snapshot_key = 'sd_registry_snapshot';
        $snapshot = get_option($snapshot_key, []);
        $purged_snapshot_rows = 0;
        if (is_array($snapshot) && is_array($snapshot['widgets'] ?? null)) {
            foreach (array_keys($snapshot['widgets']) as $wid) {
                $def = $snapshot['widgets'][$wid] ?? null;
                if (!is_array($def)) {
                    continue;
                }
                $origin = sanitize_key((string) ($def['origin'] ?? ''));
                if ($origin === 'dashboard' || $origin === 'discovered') {
                    unset($snapshot['widgets'][$wid]);
                    $purged_snapshot_rows++;
                }
            }
            update_option($snapshot_key, $snapshot, false);
        }

        // Keep registry enablement valid for current user after purge.
        $user_id = (int) get_current_user_id();
        $enablement = get_user_meta($user_id, 'sd_registry_enablement', true);
        if (is_array($enablement)) {
            $widgets = is_array($snapshot['widgets'] ?? null) ? $snapshot['widgets'] : [];
            $allowed = array_fill_keys(array_keys($widgets), true);
            $clean = [];
            foreach ($enablement as $id) {
                $id = sanitize_text_field((string) $id);
                if ($id !== '' && isset($allowed[$id])) {
                    $clean[] = $id;
                }
            }
            update_user_meta($user_id, 'sd_registry_enablement', array_values(array_unique($clean)));
        }

        wp_send_json_success([
            'message' => 'Purged discovered widgets. Registry is now core-only until rebuild/scan.',
            'purged_table_rows' => $purged_table_rows,
            'purged_snapshot_rows' => $purged_snapshot_rows,
            'next_step' => 'Run Rebuild Registry Snapshot or Widget Scanner to repopulate.',
        ]);
    }

    /* ==========================================================================
       2. GENERIC WIDGET DATA STORE
       ========================================================================== */

    public static function handle_save_widget_data(): void
    {
        self::verify_request();
        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($_POST['widget_id'] ?? ''));
        $key = sanitize_text_field($_POST['key'] ?? '');
        $value = self::sanitize_mixed($_POST['value'] ?? null);

        if (!$widget_id || !$key)
            wp_send_json_error(['message' => 'Missing params']);

        $user_id = (int) get_current_user_id();
        $context = new Context($user_id, 'global');

        // Simple storage using existing StorageEngine
        $data = StorageEngine::get("widget_data_{$widget_id}", $context) ?: [];
        if (!is_array($data))
            $data = [];

        // We should sanitise value. For now, basic recursion or just allow text/array.
        // Let's assume text for safety or implement deep sanitize if needed.
        // For simplicity in this port:
        $data[$key] = $value;

        StorageEngine::save("widget_data_{$widget_id}", $data, $context);
        wp_send_json_success(['message' => 'Saved']);
    }

    public static function handle_get_widget_data(): void
    {
        self::verify_request();
        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($_POST['widget_id'] ?? ''));
        $key = sanitize_text_field($_POST['key'] ?? '');

        if (!$widget_id)
            wp_send_json_error(['message' => 'Missing widget_id']);

        $user_id = (int) get_current_user_id();
        $context = new Context($user_id, 'global');
        $data = StorageEngine::get("widget_data_{$widget_id}", $context) ?: [];

        if ($key) {
            wp_send_json_success(['value' => $data[$key] ?? null]);
        } else {
            wp_send_json_success(['data' => $data]);
        }
    }

    public static function handle_get_telemetry(): void
    {
        self::verify_request('read', false);

        if (!class_exists('\\SystemDeck\\Core\\Telemetry')) {
            wp_send_json_error(['message' => 'Telemetry unavailable'], 500);
        }

        $mode = self::post_key('mode', 'runtime');

        if ($mode === 'full') {
            wp_send_json_success([
                'mode' => 'full',
                'data' => \SystemDeck\Core\Telemetry::get_all_metrics(),
            ]);
        }

        wp_send_json_success([
            'mode' => 'runtime',
            'raw' => \SystemDeck\Core\Telemetry::get_runtime_metrics(),
        ]);
    }

    public static function handle_get_pin_safe_metrics(): void
    {
        self::verify_request('read', false);

        if (!class_exists('\\SystemDeck\\Core\\Services\\MetricRegistry')) {
            wp_send_json_error([
                'message' => 'Metric registry unavailable',
                'code' => 'metric_registry_unavailable',
            ], 500);
        }

        if (!class_exists('\\SystemDeck\\Core\\Services\\PinRegistry')) {
            wp_send_json_error([
                'message' => 'Pin registry unavailable',
                'code' => 'pin_registry_unavailable',
            ], 500);
        }

        $metrics = \SystemDeck\Core\Services\MetricRegistry::get_pin_safe();
        $pin_definitions = \SystemDeck\Core\Services\PinRegistry::get_pin_safe_indexed();
        $grouped = [
            'core' => [],
            'wp.metrics' => [],
            'third_party' => [],
        ];

        foreach ($metrics as $metric) {
            $family = (string) ($metric['family'] ?? '');
            if (!isset($grouped[$family])) {
                $grouped[$family] = [];
            }
            $grouped[$family][] = $metric;
        }

        wp_send_json_success([
            'metrics' => $metrics,
            'pin_definitions' => $pin_definitions,
            'grouped' => $grouped,
        ]);
    }

    public static function handle_create_registry_pin(): void
    {
        self::verify_request();

        if (!class_exists('\\SystemDeck\\Core\\Services\\PinRegistry')) {
            wp_send_json_error([
                'message' => 'Pin registry unavailable',
                'code' => 'pin_registry_unavailable',
            ], 500);
        }

        if (!class_exists('\\SystemDeck\\Core\\Services\\ProjectionService')) {
            wp_send_json_error([
                'message' => 'Projection service unavailable',
                'code' => 'projection_service_unavailable',
            ], 500);
        }

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');
        $definition_id = (string) preg_replace('/[^a-z0-9._-]/', '', strtolower((string) ($_POST['definition_id'] ?? '')));
        if ($definition_id === '') {
            wp_send_json_error([
                'message' => 'Missing pin definition id',
                'code' => 'missing_pin_definition_id',
            ], 400);
        }

        $current_user_id = (int) get_current_user_id();
        $pin_definition = \SystemDeck\Core\Services\PinRegistry::build_pin_payload($definition_id, $current_user_id);
        if (!is_array($pin_definition)) {
            wp_send_json_error([
                'message' => 'Pin definition is unavailable for pinning',
                'code' => 'pin_definition_unavailable',
            ], 404);
        }

        self::emit_created_pin_response($workspace_id, $pin_definition, $current_user_id, 'registry_pin_definition_unavailable');
    }

    public static function handle_create_metric_pin(): void
    {
        self::verify_request();

        if (!class_exists('\\SystemDeck\\Core\\Services\\MetricRegistry')) {
            wp_send_json_error([
                'message' => 'Metric registry unavailable',
                'code' => 'metric_registry_unavailable',
            ], 500);
        }

        if (!class_exists('\\SystemDeck\\Core\\Services\\ProjectionService')) {
            wp_send_json_error([
                'message' => 'Projection service unavailable',
                'code' => 'projection_service_unavailable',
            ], 500);
        }

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');
        $metric_key = sanitize_text_field((string) ($_POST['metric_key'] ?? ''));
        if ($metric_key === '') {
            wp_send_json_error([
                'message' => 'Missing metric key',
                'code' => 'missing_metric_key',
            ], 400);
        }

        $current_user_id = (int) get_current_user_id();
        $pin_definition = \SystemDeck\Core\Services\MetricRegistry::build_pin_definition($metric_key, $current_user_id);
        if (!is_array($pin_definition)) {
            wp_send_json_error([
                'message' => 'Metric is unavailable for pinning',
                'code' => 'metric_not_pin_safe',
            ], 404);
        }

        self::emit_created_pin_response($workspace_id, $pin_definition, $current_user_id, 'metric_pin_definition_unavailable');
    }

    /**
     * @param array<string,mixed> $pin_definition
     */
    private static function emit_created_pin_response(string $workspace_id, array $pin_definition, int $current_user_id, string $definition_error_code): void
    {
        $pin_id = (string) preg_replace('/[^a-z0-9._-]/', '', strtolower((string) ($pin_definition['id'] ?? '')));
        $settings = is_array($pin_definition['settings'] ?? null) ? $pin_definition['settings'] : [];
        $position = [
            'x' => 0,
            'y' => 0,
            'w' => (int) ($pin_definition['w'] ?? 1),
            'h' => (int) ($pin_definition['h'] ?? 1),
        ];

        if ($pin_id === '' || empty($settings)) {
            wp_send_json_error([
                'message' => 'Pin definition unavailable',
                'code' => $definition_error_code,
            ], 500);
        }

        \SystemDeck\Core\Services\ProjectionService::sync_pin(
            $pin_id,
            $workspace_id,
            $settings,
            $position
        );

        $normalized_pin = self::normalize_pin_record($pin_definition);

        if ($normalized_pin === null) {
            wp_send_json_error([
                'message' => 'Failed to normalize created pin',
                'code' => 'pin_normalize_failed',
            ], 500);
        }

        $normalized_pin['settings']['author_id'] = $current_user_id;
        $normalized_pin['data']['author_id'] = $current_user_id;

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'pin' => $normalized_pin,
        ]);
    }

    public static function handle_save_layout(): void
    {
        self::verify_request();
        $persisted = self::persist_workspace_state_from_request(false);
        if (!$persisted['success']) {
            wp_send_json_error(['message' => $persisted['message']], 500);
        }
        wp_send_json_success(['message' => 'Layout saved']);
    }

    public static function handle_persist_workspace_state(): void
    {
        self::verify_request();

        $persisted = self::persist_workspace_state_from_request(true);
        if (!$persisted['success']) {
            wp_send_json_error(['message' => $persisted['message']], 500);
        }

        wp_send_json_success([
            'message' => 'Workspace state saved',
            'workspace_id' => $persisted['workspace_id'],
            'widget_count' => $persisted['widget_count'],
            'enablement_count' => $persisted['enablement_count'],
        ]);
    }

    /* ==========================================================================
       3. WORKSPACE IMPORT/EXPORT
       ========================================================================== */

    public static function handle_export_workspaces(): void
    {
        self::verify_request();

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);

        $export = ['version' => self::WORKSPACE_EXPORT_SCHEMA_VERSION, 'workspaces' => $workspaces, 'configs' => []];
        foreach ($workspaces as $ws) {
            if (!is_array($ws)) {
                continue;
            }
            $id = sanitize_key((string) ($ws['id'] ?? ''));
            if ($id === '') {
                continue;
            }
            $ctx = new Context($user_id, sanitize_title($id));
            $export['configs'][$id] = [
                'layout' => StorageEngine::get('layout', $ctx),
                'pins' => StorageEngine::get('pins', $ctx)
            ];
        }

        $json = wp_json_encode($export, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            wp_send_json_error([
                'message' => 'Could not encode workspace export.',
                'code' => 'export_encoding_failed',
            ], 500);
        }

        header('Content-Type: application/json; charset=' . get_option('blog_charset'));
        header('Content-Disposition: attachment; filename="' . self::EXPORT_WORKSPACES_FILENAME . '"');
        echo $json;
        wp_die();
    }

    public static function handle_import_workspaces(): void
    {
        self::verify_request();
        if (!array_key_exists('data', $_POST)) {
            wp_send_json_error([
                'message' => 'Malformed import payload.',
                'code' => 'invalid_import_payload',
            ], 400);
        }
        $data = self::decode_json_array_from_post('data');

        $workspaces = $data['workspaces'] ?? null;
        $configs = $data['configs'] ?? [];
        if (!is_array($workspaces)) {
            wp_send_json_error([
                'message' => 'Import payload must include a workspaces array.',
                'code' => 'invalid_import_workspaces',
            ], 400);
        }
        if (!is_array($configs)) {
            wp_send_json_error([
                'message' => 'Import payload configs must be an array.',
                'code' => 'invalid_import_configs',
            ], 400);
        }

        $max_import = 50;
        if (count($workspaces) > $max_import) {
            wp_send_json_error([
                'message' => "Import limited to {$max_import} workspaces per operation.",
                'code' => 'import_limit_exceeded',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $current = self::get_user_workspaces($user_id);

        $count = 0;
        foreach ($workspaces as $id => $ws) {
            $id = sanitize_key($id);
            if ($id === '' || isset($current[$id])) {
                continue;
            }

            if (!is_array($ws)) {
                continue;
            }
            $sanitized_ws = self::normalize_workspace_record($ws, $id);

            $current[$id] = $sanitized_ws;
            $count++;

            if (isset($configs[$id]) && is_array($configs[$id])) {
                $ctx = new Context($user_id, sanitize_title($id));
                if (isset($configs[$id]['layout']) && is_array($configs[$id]['layout'])) {
                    $layout = array_slice($configs[$id]['layout'], 0, 200);
                    StorageEngine::save('layout', $layout, $ctx);
                }
                if (isset($configs[$id]['pins']) && is_array($configs[$id]['pins'])) {
                    $pins = array_slice($configs[$id]['pins'], 0, 200);
                    StorageEngine::save('pins', $pins, $ctx);
                }
            }
        }

        self::save_user_workspaces($user_id, $current);
        wp_send_json_success(['message' => "Imported {$count} workspaces"]);
    }

    /* ==========================================================================
       4. RETAIL HARVESTER (Legacy Support)
       ========================================================================== */
    public static function handle_get_harvest(): void
    {
        self::verify_request();
        $context = new Context((int) get_current_user_id(), 'retail');
        // Check legacy Harvester existence
        if (class_exists('\\SystemDeck\\Core\\Harvester')) {
            $data = \SystemDeck\Core\Harvester::harvest($context);
            wp_send_json_success($data);
        } else {
            wp_send_json_error('Harvester missing');
        }

    }

    public static function handle_render_widget(): void
    {
        // Rendering widgets in runtime should respect logged-in user/session even outside strict admin-only flows.
        self::verify_request('read', false);

        // 0. Ensure Admin Screen context (fixes strpos null deprecated error)
        if (is_admin() && !function_exists('get_current_screen')) {
            require_once ABSPATH . 'wp-admin/includes/screen.php';
        }
        if (function_exists('set_current_screen')) {
            set_current_screen('dashboard');
        }

        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($_POST['widget_id'] ?? ''));

        // JS often sends the string "undefined" if variables are missing
        if ($widget_id === 'undefined') {
            wp_send_json_error(['message' => 'Widget ID is undefined (Client Error)']);
        }

        if (!$widget_id) {
            wp_send_json_error(['message' => 'Missing widget ID']);
        }

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');

        // Render should not hard-fail on workspace ACL mismatch here.
        // Access is already gated by the AJAX gateway; blocking here has
        // produced false-positive 403s for third-party dashboard widgets.

        $result = \SystemDeck\Core\Services\WidgetRuntimeBridge::render($widget_id, [
            'workspace_id' => $workspace_id,
            'user_id' => (int) get_current_user_id(),
        ]);
        $html = (string) ($result['html'] ?? '');
        if (!(bool) ($result['rendered'] ?? false) || $html === '') {
            $resolved = (array) ($result['resolved'] ?? []);
            wp_send_json_error([
                'message' => "Widget '{$widget_id}' not found or produced no output",
                'resolved_id' => (string) ($resolved['resolved_id'] ?? ''),
                'source_id' => (string) ($resolved['source_id'] ?? ''),
                'error' => (string) ($result['error'] ?? 'widget_render_empty'),
            ]);
        }

        wp_send_json_success([
            'html' => $html,
            'resolved_id' => (string) (($result['resolved']['resolved_id'] ?? '') ?: ''),
            'source_id' => (string) (($result['resolved']['source_id'] ?? '') ?: ''),
            'assets_manifest' => is_array($result['assets_manifest'] ?? null) ? array_values($result['assets_manifest']) : [],
        ]);
    }

    public static function handle_render_pin(): void
    {
        self::verify_request('read', false);

        $pin_id = \SystemDeck\Core\Services\PinRuntimeBridge::sanitize_pin_id((string) ($_POST['pin_id'] ?? ''));
        if ($pin_id === '' || $pin_id === 'undefined') {
            wp_send_json_error(['message' => 'Missing pin ID']);
        }

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');
        $instance_id = sanitize_key((string) ($_POST['instance_id'] ?? $pin_id));

        $result = \SystemDeck\Core\Services\PinRuntimeBridge::render($pin_id, [
            'workspace_id' => $workspace_id,
            'instance_id' => $instance_id,
            'user_id' => (int) get_current_user_id(),
        ]);

        $html = (string) ($result['html'] ?? '');
        if (!(bool) ($result['rendered'] ?? false) || $html === '') {
            wp_send_json_error([
                'message' => "Pin '{$pin_id}' not found or produced no output",
                'resolved_id' => (string) (($result['resolved']['resolved_id'] ?? '') ?: ''),
                'error' => (string) ($result['error'] ?? 'pin_render_empty'),
            ]);
        }

        wp_send_json_success([
            'html' => $html,
            'resolved_id' => (string) (($result['resolved']['resolved_id'] ?? '') ?: ''),
            'renderer' => (string) (($result['renderer'] ?? '') ?: 'dom'),
            'assets_manifest' => is_array($result['assets_manifest'] ?? null) ? array_values($result['assets_manifest']) : [],
        ]);
    }

    public static function handle_get_workspace_pins(): void
    {
        self::verify_request('read', false);

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');
        $user_id      = (int) get_current_user_id();
        $context      = new Context($user_id, $workspace_id);
        $pins         = StorageEngine::get('pins', $context) ?: [];

        // Apply per-user ordering preference (pin content stays canonical/shared).
        $order_key    = 'sd_pref_pin_order_' . sanitize_key($workspace_id);
        $saved_order  = get_user_meta($user_id, $order_key, true);
        if (is_array($saved_order) && !empty($saved_order)) {
            $ordered_map = [];
            foreach ($pins as $pin) {
                $pid = sanitize_key((string) ($pin['id'] ?? ''));
                if ($pid !== '') {
                    $ordered_map[$pid] = $pin;
                }
            }
            $reordered = [];
            foreach ($saved_order as $pid) {
                if (isset($ordered_map[$pid])) {
                    $reordered[] = $ordered_map[$pid];
                    unset($ordered_map[$pid]);
                }
            }
            // Append any pins not yet in user's order (newly added by others)
            foreach ($ordered_map as $pin) {
                $reordered[] = $pin;
            }
            $pins = $reordered;
        }

        $normalized_pins = [];
        foreach ($pins as $index => $pin) {
            if (!is_array($pin)) {
                continue;
            }
            $normalized_pin = self::normalize_pin_record($pin, (int) $index);
            if ($normalized_pin === null) {
                continue;
            }
            if (isset($pin['settings']['author_id'])) {
                $author_id = (int) $pin['settings']['author_id'];
                $normalized_pin['settings']['author_id'] = $author_id;
                $normalized_pin['data']['author_id'] = $author_id;
            }
            $normalized_pins[] = $normalized_pin;
        }

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'pins'         => $normalized_pins,
        ]);
    }

    public static function handle_save_workspace_pins(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));
        $pins = self::decode_json_array_from_post('pins');
        if (!array_key_exists('pins', $_POST)) {
            wp_send_json_error([
                'message' => 'Invalid pins payload.',
                'code' => 'invalid_pins_payload',
            ], 400);
        }

        $normalized = [];
        $current_user_id = (int) get_current_user_id();
        $context = new Context($current_user_id, $workspace_id);
        
        $existing_pins = StorageEngine::get('pins', $context) ?: [];
        $existing_pins_map = [];
        foreach ($existing_pins as $ep) {
            $ep_id = sanitize_key((string) ($ep['id'] ?? ''));
            if ($ep_id !== '') {
                $existing_pins_map[$ep_id] = $ep;
            }
        }

        $incoming_ids = [];
        foreach ($pins as $pin) {
            if (!is_array($pin)) {
                continue;
            }
            $id = sanitize_key((string) ($pin['id'] ?? ''));
            if ($id === '') {
                continue;
            }
            $incoming_ids[$id] = true;
            $sanitized_pin = self::sanitize_pin_item($pin, $existing_pins_map[$id] ?? [], $current_user_id);
            if ($sanitized_pin !== null) {
                $normalized[] = $sanitized_pin;
            }
        }

        $owner_id = self::get_workspace_owner_id($workspace_id, $current_user_id);
        $is_shared_non_owner = ($owner_id > 0 && $owner_id !== $current_user_id);
        
        if ($is_shared_non_owner) {
            foreach ($existing_pins_map as $ep_id => $ep) {
                if (!isset($incoming_ids[$ep_id])) {
                    $ep_author = (int) ($ep['settings']['author_id'] ?? 0);
                    if ($ep_author !== $current_user_id) {
                        $normalized[] = $ep;
                    }
                }
            }
        }

        $saved = StorageEngine::save('pins', $normalized, $context);
        if (!$saved) {
            wp_send_json_error([
                'message' => 'Could not persist pins.',
                'code' => 'pin_persist_failed',
            ], 500);
        }

        // Persist per-user pin ordering preference separately (does not affect shared canonical order).
        $pin_order = array_values(array_map(fn($p) => (string) ($p['id'] ?? ''), $normalized));
        $pin_order = array_filter($pin_order);
        update_user_meta($current_user_id, 'sd_pref_pin_order_' . sanitize_key($workspace_id), array_values($pin_order));

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'count'        => count($normalized),
        ]);
    }

    public static function handle_resolve_widget(): void
    {
        self::verify_request('read', false);

        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($_POST['widget_id'] ?? ''));
        if ($widget_id === '' || $widget_id === 'undefined') {
            wp_send_json_error(['message' => 'Missing widget ID'], 400);
        }

        $resolved = \SystemDeck\Core\Services\WidgetRuntimeBridge::resolve($widget_id);
        wp_send_json_success([
            'requested_id' => (string) ($resolved['requested_id'] ?? ''),
            'resolved_id' => (string) ($resolved['resolved_id'] ?? ''),
            'source_id' => (string) ($resolved['source_id'] ?? ''),
            'title' => (string) ($resolved['title'] ?? ''),
            'origin' => (string) ($resolved['origin'] ?? ''),
            'found' => is_array($resolved['definition'] ?? null),
        ]);
    }

    public static function handle_toggle_workspace_widget_block(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');
        $requested_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($_POST['widget_id'] ?? ''));
        if ($requested_widget_id === '') {
            wp_send_json_error(['message' => 'Missing widget ID'], 400);
        }
        $resolved = \SystemDeck\Core\Services\WidgetRuntimeBridge::resolve($requested_widget_id);
        $widget_id = (string) ($resolved['resolved_id'] ?? $requested_widget_id);
        if ($widget_id === '') {
            $widget_id = $requested_widget_id;
        }

        $snapshot = class_exists('\\SystemDeck\\Core\\Registry')
            ? \SystemDeck\Core\Registry::get_snapshot()
            : ['widgets' => []];
        $definitions = is_array($snapshot['widgets'] ?? null) ? $snapshot['widgets'] : [];
        $widget_def = is_array($definitions[$widget_id] ?? null) ? $definitions[$widget_id] : [];
        $workspace_record = self::get_workspace_record_for_user((int) get_current_user_id(), $workspace_id);
        if (!empty($widget_def)) {
            $policy_check = self::evaluate_widget_toggle_policy($widget_def, $workspace_record, $widget_id);
            if (empty($policy_check['allowed'])) {
                wp_send_json_error(['message' => (string) ($policy_check['message'] ?? 'Widget is not allowed in this workspace.')], 403);
            }
        }

        $user_id = (int) get_current_user_id();
        $owner_id = self::get_workspace_owner_id($workspace_id, $user_id);
        $is_shared_non_owner = ($owner_id > 0 && $owner_id !== $user_id);
        $is_collaborative = self::is_collaborative_workspace($workspace_id, $owner_id > 0 ? $owner_id : $user_id);

        if ($is_shared_non_owner && !$is_collaborative) {
            $context = new Context($user_id, $workspace_id);
            $overlay = self::get_shared_workspace_overlay($user_id, $workspace_id);
            $hidden_base_widgets = array_values((array) ($overlay['hidden_base_widgets'] ?? []));
            $hidden_lookup = array_fill_keys($hidden_base_widgets, true);

            $local_items_raw = StorageEngine::get('layout', $context);
            $local_items = self::index_layout_items(is_array($local_items_raw) ? $local_items_raw : []);
            $base_runtime_items = self::get_base_runtime_items_for_workspace($workspace_id, $owner_id);
            $base_widget_ids = [];
            foreach ($base_runtime_items as $base_item_id => $base_item) {
                $base_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($base_item['settings']['widgetId'] ?? '')));
                if ($base_widget_id !== '') {
                    $base_widget_ids[$base_widget_id] = $base_item_id;
                }
            }

            $operation = 'removed';
            $local_item_id = '';
            foreach ($local_items as $item_id => $item) {
                $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($item['settings']['widgetId'] ?? '')));
                $source = (string) (($item['settings']['source'] ?? '') ?: '');
                if ($candidate === $widget_id && $source === 'overlay') {
                    $local_item_id = $item_id;
                    break;
                }
            }

            if ($local_item_id !== '') {
                unset($local_items[$local_item_id]);
            } elseif (isset($hidden_lookup[$widget_id])) {
                $operation = 'added';
                $hidden_base_widgets = array_values(array_filter($hidden_base_widgets, static function ($candidate) use ($widget_id) {
                    return $candidate !== $widget_id;
                }));
            } elseif (isset($base_widget_ids[$widget_id])) {
                $hidden_base_widgets[] = $widget_id;
                $hidden_base_widgets = array_values(array_unique($hidden_base_widgets));
                unset($local_items[$base_widget_ids[$widget_id]]);
            } else {
                $operation = 'added';
                $widget_title = sanitize_text_field((string) ($resolved['title'] ?? ''));
                if ($widget_title === '') {
                    $widget_title = sanitize_text_field(ucwords(str_replace(['.', '_', '-'], ' ', $widget_id)));
                }
                $position = self::next_overlay_widget_position($local_items);
                $overlay_id = 'sd_local_' . sanitize_key(str_replace(['.', '-'], '_', $widget_id));
                $local_items[$overlay_id] = [
                    'i' => $overlay_id,
                    'id' => $overlay_id,
                    'type' => 'block_widget_placeholder',
                    'title' => $widget_title,
                    'x' => $position['x'],
                    'y' => $position['y'],
                    'w' => $position['w'],
                    'h' => $position['h'],
                    'settings' => [
                        'source' => 'overlay',
                        'blockName' => 'systemdeck/widgets',
                        'widgetId' => $widget_id,
                        'label' => $widget_title,
                    ],
                ];
            }

            $overlay['hidden_base_widgets'] = $hidden_base_widgets;
            self::save_shared_workspace_overlay($user_id, $workspace_id, $overlay);
            StorageEngine::save('layout', array_values($local_items), $context);

            $view = self::build_shared_workspace_overlay_view($workspace_id, $user_id, $owner_id);
            $workspace_widget_ids = $view['workspace_widgets'];
            $layout_items = $view['layout_items'];
            $active_widget_instance_ids = [];
            foreach ((array) $layout_items as $layout_item) {
                if (!is_array($layout_item)) {
                    continue;
                }
                if ((string) ($layout_item['type'] ?? '') !== 'block_widget_placeholder') {
                    continue;
                }
                $instance_id = trim((string) ($layout_item['i'] ?? $layout_item['id'] ?? ''));
                if ($instance_id !== '') {
                    $active_widget_instance_ids[] = $instance_id;
                }
            }
            if (!empty($active_widget_instance_ids)) {
                self::prune_workspace_widget_ui_state_for_user($user_id, $workspace_id, $active_widget_instance_ids);
            }

            $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
            if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
                $workspaces[$workspace_id]['widgets'] = $workspace_widget_ids;
                $workspaces[$workspace_id]['available'] = $workspace_widget_ids;
                update_user_meta($user_id, 'sd_workspaces', $workspaces);
            }

            wp_send_json_success([
                'message' => $operation === 'added' ? 'Widget block added.' : 'Widget block removed.',
                'operation' => $operation,
                'canvas_id' => 0,
                'widget_id' => $widget_id,
                'workspace_widgets' => $workspace_widget_ids,
                'layout_items' => $layout_items,
            ]);
        }

        $context = new Context($user_id, $workspace_id);
        $canvas_id = (int) ($workspace_record['canvas_id'] ?? 0);
        if ($canvas_id <= 0) {
            $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id);
        }
        if ($canvas_id <= 0) {
            wp_send_json_error(['message' => 'Unable to resolve workspace canvas'], 500);
        }

        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== \SystemDeck\Core\Services\CanvasRepository::CPT) {
            wp_send_json_error(['message' => 'Canvas not found'], 404);
        }

        $content = (string) $post->post_content;
        $layout_items = self::index_layout_items((array) StorageEngine::get('layout', $context));
        if (empty($layout_items)) {
            $layout_items = self::index_layout_items(array_values(\SystemDeck\Core\Services\CanvasRepository::extract_runtime_blocks_from_content($content)));
        }
        $target_alt = str_replace('.', '_', $widget_id);
        $found = false;
        $pattern = '/<!--\s+wp:systemdeck\/widgets\s+\{[^}]*"widgetId":"(?:'
            . preg_quote($widget_id, '/')
            . '|'
            . preg_quote($target_alt, '/')
            . ')"[^}]*\}\s+\/-->\s*/';
        $updated_content = preg_replace($pattern, '', $content, 1, $count);
        if (is_string($updated_content) && $count > 0) {
            $content = $updated_content;
            $found = true;
            foreach ($layout_items as $item_id => $item) {
                $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($item['settings']['widgetId'] ?? '')));
                if ($candidate === $widget_id) {
                    unset($layout_items[$item_id]);
                }
            }
        }

        $operation = 'removed';
        if (!$found) {
            $operation = 'added';
            $widget_title = sanitize_text_field((string) ($resolved['title'] ?? ''));
            if ($widget_title === '') {
                $widget_title = sanitize_text_field(ucwords(str_replace(['.', '_', '-'], ' ', $widget_id)));
            }
            $instance_seed = sanitize_key('w_' . wp_generate_uuid4());
            if ($instance_seed === '') {
                $instance_seed = sanitize_key('w_' . md5($widget_id . '|' . microtime(true)));
            }
            if ($instance_seed === '') {
                $instance_seed = 'w_' . substr(md5((string) mt_rand()), 0, 12);
            }
            $position = self::next_overlay_widget_position($layout_items);
            $snippet = sprintf(
                '<!-- wp:systemdeck/widgets {"widgetId":"%1$s","title":"%2$s","sdItemId":"%3$s","columnSpan":%4$d,"rowSpan":%5$d,"gridX":%6$d,"gridY":%7$d} /-->',
                $widget_id,
                $widget_title,
                $instance_seed,
                (int) ($position['w'] ?? 2),
                (int) ($position['h'] ?? 1),
                (int) ($position['x'] ?? 0),
                (int) ($position['y'] ?? 0)
            );
            if (strpos($content, '<!-- /wp:systemdeck/canvas-grid -->') !== false) {
                $content = str_replace(
                    '<!-- /wp:systemdeck/canvas-grid -->',
                    $snippet . "\n<!-- /wp:systemdeck/canvas-grid -->",
                    $content
                );
            } else {
                $content = rtrim($content) . "\n" . $snippet . "\n";
            }

            $runtime_id = 'sd_canvas_' . $instance_seed;
            $layout_items[$runtime_id] = [
                'i' => $runtime_id,
                'id' => $runtime_id,
                'type' => 'block_widget_placeholder',
                'title' => $widget_title,
                'x' => (int) ($position['x'] ?? 0),
                'y' => (int) ($position['y'] ?? 0),
                'w' => self::normalize_widget_width((int) ($position['w'] ?? 2)),
                'h' => max(1, (int) ($position['h'] ?? 1)),
                'settings' => [
                    'source' => 'canvas',
                    'blockName' => 'systemdeck/widgets',
                    'sdItemId' => $instance_seed,
                    'widgetId' => $widget_id,
                    'label' => $widget_title,
                ],
            ];
        }

        // Normalize any legacy core/grid wrapper after block insert/remove.
        if (strpos($content, '<!-- wp:grid ') !== false || strpos($content, '<!-- /wp:grid -->') !== false) {
            $content = str_replace(
                ['<!-- wp:grid ', '<!-- /wp:grid -->', 'wp-block-grid'],
                ['<!-- wp:systemdeck/canvas-grid ', '<!-- /wp:systemdeck/canvas-grid -->', 'wp-block-systemdeck-canvas-grid'],
                $content
            );
            $content = str_replace('sd-canvas-shell__grid', 'sd-canvas-grid-host', $content);
        }

        if (strpos($content, '<!-- wp:systemdeck/canvas-grid') === false) {
            $content = preg_replace(
                '/(<!-- wp:group [^>]*sd-canvas-shell[^>]*-->\\s*<div[^>]*sd-canvas-shell[^>]*>)/',
                "$1\n<!-- wp:systemdeck/canvas-grid {\"lock\":{\"move\":true,\"remove\":true}} -->\n<div class=\"wp-block-systemdeck-canvas-grid sd-canvas-grid-host\" data-sd-grid-host=\"1\"></div>\n<!-- /wp:systemdeck/canvas-grid -->",
                $content,
                1
            ) ?: $content;
        }

        // Write directly to wp_posts to bypass the full WordPress post save
        // pipeline. wp_update_post fires pre_post_update, sanitize_post,
        // wp_after_insert_post, and every save_post listener — none of which
        // are needed for a machine-managed content column update. We only
        // touch post_content and post_modified, then invalidate the cache.
        global $wpdb;
        $now     = current_time('mysql');
        $now_gmt = current_time('mysql', 1);
        $rows_affected = $wpdb->update(
            $wpdb->posts,
            [
                'post_content'      => $content,
                'post_modified'     => $now,
                'post_modified_gmt' => $now_gmt,
            ],
            ['ID' => $canvas_id],
            ['%s', '%s', '%s'],
            ['%d']
        );

        if ($rows_affected === false) {
            wp_send_json_error(['message' => 'Could not update canvas content'], 500);
        }

        // Invalidate the object cache so get_post() returns fresh data.
        clean_post_cache($canvas_id);

        StorageEngine::save('layout', array_values($layout_items), $context);
        $workspace_widget_ids = self::collect_workspace_widget_ids($layout_items);

        // Only prune stale UI state on remove — nothing to prune on add.
        if ($operation === 'removed') {
            $active_widget_instance_ids = [];
            foreach ($layout_items as $item) {
                if (($item['type'] ?? '') === 'block_widget_placeholder') {
                    $instance_id = trim((string) ($item['i'] ?? $item['id'] ?? ''));
                    if ($instance_id !== '') {
                        $active_widget_instance_ids[] = $instance_id;
                    }
                }
            }
            if (!empty($active_widget_instance_ids)) {
                self::prune_workspace_widget_ui_state_for_user($user_id, $workspace_id, $active_widget_instance_ids);
            }
        }

        $workspaces = self::get_user_workspaces($user_id);
        if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['widgets'] = $workspace_widget_ids;
            $workspaces[$workspace_id]['available'] = $workspace_widget_ids;
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => $operation === 'added' ? 'Widget block added.' : 'Widget block removed.',
            'operation' => $operation,
            'canvas_id' => $canvas_id,
            'widget_id' => $widget_id,
            'workspace_widgets' => $workspace_widget_ids,
            'layout_items' => $layout_items,
        ]);
    }

    /**
     * Batch-sync the workspace widget list from the Widget Picker modal close.
     *
     * Accepts the full desired widget_ids array, reconciles it against the
     * current post_content in a single pass, and writes once. This replaces
     * the per-click toggle pattern with one write per modal session.
     */
    public static function handle_sync_workspace_widget_list(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? 'default');

        $raw_ids = $_POST['widget_ids'] ?? '';
        if (is_string($raw_ids)) {
            $raw_ids = json_decode(stripslashes($raw_ids), true) ?: [];
        }
        if (!is_array($raw_ids)) {
            $raw_ids = [];
        }

        $desired_ids = [];
        foreach ($raw_ids as $raw_id) {
            $sid = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) $raw_id);
            if ($sid !== '') {
                $desired_ids[] = $sid;
            }
        }
        $desired_ids = array_values(array_unique($desired_ids));

        $user_id         = (int) get_current_user_id();
        $workspace_record = self::get_workspace_record_for_user($user_id, $workspace_id);
        $owner_id        = self::get_workspace_owner_id($workspace_id, $user_id);
        $is_shared_non_owner = ($owner_id > 0 && $owner_id !== $user_id);
        $is_collaborative = self::is_collaborative_workspace($workspace_id, $owner_id > 0 ? $owner_id : $user_id);

        if ($is_shared_non_owner && !$is_collaborative) {
            $snapshot = class_exists('\\SystemDeck\\Core\\Registry')
                ? \SystemDeck\Core\Registry::get_snapshot()
                : ['widgets' => []];
            $definitions = is_array($snapshot['widgets'] ?? null) ? $snapshot['widgets'] : [];

            $context = new Context($user_id, $workspace_id);
            $overlay = self::get_shared_workspace_overlay($user_id, $workspace_id);
            $hidden_base_widgets = array_values((array) ($overlay['hidden_base_widgets'] ?? []));
            $hidden_lookup = array_fill_keys($hidden_base_widgets, true);

            $local_items_raw = StorageEngine::get('layout', $context);
            $local_items = self::index_layout_items(is_array($local_items_raw) ? $local_items_raw : []);
            $base_runtime_items = self::get_base_runtime_items_for_workspace($workspace_id, $owner_id);
            $base_widget_ids = [];
            foreach ($base_runtime_items as $base_item_id => $base_item) {
                $base_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($base_item['settings']['widgetId'] ?? '')));
                if ($base_widget_id !== '') {
                    $base_widget_ids[$base_widget_id] = $base_item_id;
                }
            }

            $current_view = self::build_shared_workspace_overlay_view($workspace_id, $user_id, $owner_id);
            $current_ids = array_values((array) ($current_view['workspace_widgets'] ?? []));
            $current_set = array_fill_keys($current_ids, true);
            $desired_set = array_fill_keys($desired_ids, true);
            $to_add = array_diff_key($desired_set, $current_set);
            $to_remove = array_diff_key($current_set, $desired_set);

            foreach (array_keys($to_add) as $widget_id) {
                $widget_def = is_array($definitions[$widget_id] ?? null) ? $definitions[$widget_id] : [];
                if (!empty($widget_def)) {
                    $policy_check = self::evaluate_widget_toggle_policy($widget_def, $workspace_record, $widget_id);
                    if (empty($policy_check['allowed'])) {
                        unset($to_add[$widget_id]);
                    }
                }
            }

            foreach (array_keys($to_remove) as $widget_id) {
                if (isset($base_widget_ids[$widget_id]) && !isset($hidden_lookup[$widget_id])) {
                    $hidden_base_widgets[] = $widget_id;
                    $hidden_base_widgets = array_values(array_unique($hidden_base_widgets));
                    unset($local_items[$base_widget_ids[$widget_id]]);
                } else {
                    foreach ($local_items as $item_id => $item) {
                        $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($item['settings']['widgetId'] ?? '')));
                        $source = (string) (($item['settings']['source'] ?? '') ?: '');
                        if ($candidate === $widget_id && $source === 'overlay') {
                            unset($local_items[$item_id]);
                            break;
                        }
                    }
                }
            }

            foreach (array_keys($to_add) as $widget_id) {
                if (isset($hidden_lookup[$widget_id])) {
                    $hidden_base_widgets = array_values(array_filter($hidden_base_widgets, static function ($candidate) use ($widget_id) {
                        return $candidate !== $widget_id;
                    }));
                    unset($hidden_lookup[$widget_id]);
                    continue;
                }
                if (isset($base_widget_ids[$widget_id])) {
                    continue;
                }

                $resolved = \SystemDeck\Core\Services\WidgetRuntimeBridge::resolve($widget_id);
                $widget_title = sanitize_text_field((string) ($resolved['title'] ?? ''));
                if ($widget_title === '') {
                    $widget_title = sanitize_text_field(ucwords(str_replace(['.', '_', '-'], ' ', $widget_id)));
                }
                $position = self::next_overlay_widget_position($local_items);
                $overlay_id = 'sd_local_' . sanitize_key(str_replace(['.', '-'], '_', $widget_id));
                $local_items[$overlay_id] = [
                    'i' => $overlay_id,
                    'id' => $overlay_id,
                    'type' => 'block_widget_placeholder',
                    'title' => $widget_title,
                    'x' => $position['x'],
                    'y' => $position['y'],
                    'w' => $position['w'],
                    'h' => $position['h'],
                    'settings' => [
                        'source' => 'overlay',
                        'blockName' => 'systemdeck/widgets',
                        'widgetId' => $widget_id,
                        'label' => $widget_title,
                    ],
                ];
            }

            $overlay['hidden_base_widgets'] = $hidden_base_widgets;
            self::save_shared_workspace_overlay($user_id, $workspace_id, $overlay);
            StorageEngine::save('layout', array_values($local_items), $context);

            $view = self::build_shared_workspace_overlay_view($workspace_id, $user_id, $owner_id);
            $workspace_widget_ids = $view['workspace_widgets'];
            $layout_items = $view['layout_items'];
            if (!empty($to_remove)) {
                $active_widget_instance_ids = [];
                foreach ((array) $layout_items as $layout_item) {
                    if (!is_array($layout_item)) {
                        continue;
                    }
                    if ((string) ($layout_item['type'] ?? '') !== 'block_widget_placeholder') {
                        continue;
                    }
                    $instance_id = trim((string) ($layout_item['i'] ?? $layout_item['id'] ?? ''));
                    if ($instance_id !== '') {
                        $active_widget_instance_ids[] = $instance_id;
                    }
                }
                if (!empty($active_widget_instance_ids)) {
                    self::prune_workspace_widget_ui_state_for_user($user_id, $workspace_id, $active_widget_instance_ids);
                }
            }

            $workspaces = self::get_user_workspaces($user_id);
            if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
                $workspaces[$workspace_id]['widgets'] = $workspace_widget_ids;
                $workspaces[$workspace_id]['available'] = $workspace_widget_ids;
                self::save_user_workspaces($user_id, $workspaces);
            }

            wp_send_json_success([
                'message' => 'Widget list synced.',
                'operation' => 'sync',
                'canvas_id' => 0,
                'widget_ids_added' => array_keys($to_add),
                'widget_ids_removed' => array_keys($to_remove),
                'workspace_widgets' => $workspace_widget_ids,
                'layout_items' => $layout_items,
            ]);
        }

        $canvas_id       = (int) ($workspace_record['canvas_id'] ?? 0);
        if ($canvas_id <= 0) {
            $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id);
        }
        if ($canvas_id <= 0) {
            wp_send_json_error(['message' => 'Unable to resolve workspace canvas'], 500);
        }

        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== \SystemDeck\Core\Services\CanvasRepository::CPT) {
            wp_send_json_error(['message' => 'Canvas not found'], 404);
        }

        $context     = new Context($user_id, $workspace_id);
        $content     = (string) $post->post_content;
        $layout_items = self::index_layout_items(
            (array) StorageEngine::get('layout', $context)
        );
        if (empty($layout_items)) {
            $layout_items = self::index_layout_items(array_values(
                \SystemDeck\Core\Services\CanvasRepository::extract_runtime_blocks_from_content($content)
            ));
        }

        // Determine current widget IDs from layout.
        $current_ids = [];
        foreach ($layout_items as $item) {
            $wid = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id(
                (string) ($item['settings']['widgetId'] ?? '')
            );
            if ($wid !== '') {
                $current_ids[] = $wid;
            }
        }

        $current_set = array_flip(array_unique($current_ids));
        $desired_set = array_flip($desired_ids);
        $to_add      = array_diff_key($desired_set, $current_set);
        $to_remove   = array_diff_key($current_set, $desired_set);

        $snapshot = class_exists('\\SystemDeck\\Core\\Registry')
            ? \SystemDeck\Core\Registry::get_snapshot()
            : ['widgets' => []];
        $definitions = is_array($snapshot['widgets'] ?? null) ? $snapshot['widgets'] : [];
        foreach (array_keys($to_add) as $widget_id) {
            $widget_def = is_array($definitions[$widget_id] ?? null) ? $definitions[$widget_id] : [];
            if (!empty($widget_def)) {
                $policy_check = self::evaluate_widget_toggle_policy($widget_def, $workspace_record, $widget_id);
                if (empty($policy_check['allowed'])) {
                    unset($to_add[$widget_id]);
                }
            }
        }

        // Early return — nothing changed.
        if (empty($to_add) && empty($to_remove)) {
            $workspace_widget_ids = self::collect_workspace_widget_ids($layout_items);
            wp_send_json_success([
                'message'           => 'No changes.',
                'operation'         => 'noop',
                'canvas_id'         => $canvas_id,
                'workspace_widgets' => $workspace_widget_ids,
                'layout_items'      => $layout_items,
            ]);
        }

        // Apply removes.
        foreach (array_keys($to_remove) as $widget_id) {
            $target_alt = str_replace('.', '_', $widget_id);
            $pattern    = '/<!--\s+wp:systemdeck\/widgets\s+\{[^}]*"widgetId":"(?:'
                . preg_quote($widget_id, '/')
                . '|'
                . preg_quote($target_alt, '/')
                . ')"[^}]*\}\s+\/-->\s*/';
            $updated = preg_replace($pattern, '', $content, 1, $count);
            if (is_string($updated) && $count > 0) {
                $content = $updated;
                foreach ($layout_items as $item_id => $item) {
                    $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id(
                        (string) ($item['settings']['widgetId'] ?? '')
                    );
                    if ($candidate === $widget_id) {
                        unset($layout_items[$item_id]);
                        break;
                    }
                }
            }
        }

        // Apply adds.
        foreach (array_keys($to_add) as $widget_id) {
            $resolved     = \SystemDeck\Core\Services\WidgetRuntimeBridge::resolve($widget_id);
            $widget_title = sanitize_text_field((string) ($resolved['title'] ?? ''));
            if ($widget_title === '') {
                $widget_title = sanitize_text_field(ucwords(str_replace(['.', '_', '-'], ' ', $widget_id)));
            }
            $instance_seed = sanitize_key('w_' . wp_generate_uuid4());
            if ($instance_seed === '') {
                $instance_seed = 'w_' . substr(md5($widget_id . microtime(true)), 0, 12);
            }
            $position = self::next_overlay_widget_position($layout_items);
            $snippet  = sprintf(
                '<!-- wp:systemdeck/widgets {"widgetId":"%1$s","title":"%2$s","sdItemId":"%3$s","columnSpan":%4$d,"rowSpan":%5$d,"gridX":%6$d,"gridY":%7$d} /-->',
                $widget_id,
                $widget_title,
                $instance_seed,
                (int) ($position['w'] ?? 2),
                (int) ($position['h'] ?? 1),
                (int) ($position['x'] ?? 0),
                (int) ($position['y'] ?? 0)
            );
            if (strpos($content, '<!-- /wp:systemdeck/canvas-grid -->') !== false) {
                $content = str_replace(
                    '<!-- /wp:systemdeck/canvas-grid -->',
                    $snippet . "\n<!-- /wp:systemdeck/canvas-grid -->",
                    $content
                );
            } else {
                $content = rtrim($content) . "\n" . $snippet . "\n";
            }
            $runtime_id            = 'sd_canvas_' . $instance_seed;
            $layout_items[$runtime_id] = [
                'i'        => $runtime_id,
                'id'       => $runtime_id,
                'type'     => 'block_widget_placeholder',
                'title'    => $widget_title,
                'x'        => (int) ($position['x'] ?? 0),
                'y'        => (int) ($position['y'] ?? 0),
                'w'        => self::normalize_widget_width((int) ($position['w'] ?? 2)),
                'h'        => max(1, (int) ($position['h'] ?? 1)),
                'settings' => [
                    'source'    => 'canvas',
                    'blockName' => 'systemdeck/widgets',
                    'sdItemId'  => $instance_seed,
                    'widgetId'  => $widget_id,
                    'label'     => $widget_title,
                ],
            ];
        }

        // Normalize any legacy grid wrappers.
        if (strpos($content, '<!-- wp:grid ') !== false) {
            $content = str_replace(
                ['<!-- wp:grid ', '<!-- /wp:grid -->', 'wp-block-grid'],
                ['<!-- wp:systemdeck/canvas-grid ', '<!-- /wp:systemdeck/canvas-grid -->', 'wp-block-systemdeck-canvas-grid'],
                $content
            );
            $content = str_replace('sd-canvas-shell__grid', 'sd-canvas-grid-host', $content);
        }
        if (strpos($content, '<!-- wp:systemdeck/canvas-grid') === false) {
            $content = preg_replace(
                '/(<!-- wp:group [^>]*sd-canvas-shell[^>]*-->\s*<div[^>]*sd-canvas-shell[^>]*>)/',
                "$1\n<!-- wp:systemdeck/canvas-grid {\"lock\":{\"move\":true,\"remove\":true}} -->\n<div class=\"wp-block-systemdeck-canvas-grid sd-canvas-grid-host\" data-sd-grid-host=\"1\"></div>\n<!-- /wp:systemdeck/canvas-grid -->",
                $content,
                1
            ) ?: $content;
        }

        // Single direct DB write — bypasses wp_update_post machinery.
        global $wpdb;
        $now     = current_time('mysql');
        $now_gmt = current_time('mysql', 1);
        $rows_affected = $wpdb->update(
            $wpdb->posts,
            [
                'post_content'      => $content,
                'post_modified'     => $now,
                'post_modified_gmt' => $now_gmt,
            ],
            ['ID' => $canvas_id],
            ['%s', '%s', '%s'],
            ['%d']
        );

        if ($rows_affected === false) {
            wp_send_json_error(['message' => 'Could not update canvas content'], 500);
        }
        clean_post_cache($canvas_id);

        StorageEngine::save('layout', array_values($layout_items), $context);
        $workspace_widget_ids = self::collect_workspace_widget_ids($layout_items);

        // Prune stale UI state only when widgets were removed.
        if (!empty($to_remove)) {
            $active_instance_ids = [];
            foreach ($layout_items as $item) {
                if (($item['type'] ?? '') === 'block_widget_placeholder') {
                    $iid = trim((string) ($item['i'] ?? $item['id'] ?? ''));
                    if ($iid !== '') {
                        $active_instance_ids[] = $iid;
                    }
                }
            }
            if (!empty($active_instance_ids)) {
                self::prune_workspace_widget_ui_state_for_user($user_id, $workspace_id, $active_instance_ids);
            }
        }

        $workspaces = self::get_user_workspaces($user_id);
        if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['widgets']    = $workspace_widget_ids;
            $workspaces[$workspace_id]['available']  = $workspace_widget_ids;
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message'            => 'Widget list synced.',
            'operation'          => 'sync',
            'canvas_id'          => $canvas_id,
            'widget_ids_added'   => array_keys($to_add),
            'widget_ids_removed' => array_keys($to_remove),
            'workspace_widgets'  => $workspace_widget_ids,
            'layout_items'       => $layout_items,
        ]);
    }

    public static function handle_set_widget_block_width(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));
        $item_id = trim(self::post_string('item_id'));
        $column_span = self::normalize_widget_width(self::post_int('column_span', 2));
        if ($item_id === '') {
            wp_send_json_error([
                'message' => 'Missing item_id.',
                'code' => 'missing_item_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $owner_id = self::get_workspace_owner_id($workspace_id, $user_id);
        $is_shared_non_owner = ($owner_id > 0 && $owner_id !== $user_id);
        $is_collaborative = self::is_collaborative_workspace($workspace_id, $owner_id > 0 ? $owner_id : $user_id);

        if ($is_shared_non_owner && !$is_collaborative) {
            $context = new Context($user_id, $workspace_id);
            $items = StorageEngine::get('layout', $context);
            if (!is_array($items)) {
                $items = [];
            }

            $updated = false;
            foreach ($items as &$item) {
                if (!is_array($item)) {
                    continue;
                }
                $candidate_id = sanitize_key((string) ($item['id'] ?? $item['i'] ?? ''));
                if ($candidate_id !== $item_id) {
                    continue;
                }
                $item['w'] = $column_span;
                $updated = true;
                break;
            }
            unset($item);

            if (!$updated) {
                wp_send_json_error(['message' => 'Widget block not found for width update'], 404);
            }

            $saved = StorageEngine::save('layout', array_values($items), $context);
            if (!$saved) {
                wp_send_json_error(['message' => 'Could not persist local widget width'], 500);
            }

            wp_send_json_success([
                'workspace_id' => $workspace_id,
                'item_id' => $item_id,
                'column_span' => $column_span,
                'canvas_id' => 0,
                'local_only' => true,
            ]);
        }

        $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id);
        if ($canvas_id <= 0) {
            wp_send_json_error(['message' => 'Unable to resolve workspace canvas'], 500);
        }

        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== \SystemDeck\Core\Services\CanvasRepository::CPT) {
            wp_send_json_error(['message' => 'Canvas not found'], 404);
        }
        if (!function_exists('parse_blocks') || !function_exists('serialize_blocks')) {
            wp_send_json_error(['message' => 'Block parser unavailable'], 500);
        }

        $blocks = parse_blocks((string) $post->post_content);
        if (!is_array($blocks)) {
            wp_send_json_error(['message' => 'Canvas parse failed'], 500);
        }

        $updated = false;
        self::update_widget_block_width_recursive($blocks, '0', $item_id, $column_span, $updated);
        if (!$updated) {
            wp_send_json_error(['message' => 'Widget block not found for width update'], 404);
        }

        $saved = wp_update_post([
            'ID' => $canvas_id,
            'post_content' => serialize_blocks($blocks),
        ], true);
        if (is_wp_error($saved) || (int) $saved <= 0) {
            wp_send_json_error(['message' => 'Could not persist widget width'], 500);
        }

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'item_id' => $item_id,
            'column_span' => $column_span,
            'canvas_id' => $canvas_id,
        ]);
    }

    public static function handle_set_widget_ui_state(): void
    {
        self::verify_request();

        $user_id = (int) get_current_user_id();
        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));
        $widget_id = self::post_string('widget_id');
        $collapsed_raw = self::post_string('collapsed');
        $width_raw = self::post_int('width', 0);
        $has_x = array_key_exists('x', $_POST);
        $has_y = array_key_exists('y', $_POST);
        $x_raw = $has_x ? self::post_int('x', 0) : 0;
        $y_raw = $has_y ? self::post_int('y', 0) : 0;

        $widget_id = trim($widget_id);
        if ($widget_id === '') {
            wp_send_json_error([
                'message' => 'Missing widget_id.',
                'code' => 'missing_widget_id',
            ], 400);
        }

        $has_collapsed = ($collapsed_raw !== '');
        $collapsed = in_array(strtolower((string) $collapsed_raw), ['1', 'true', 'yes', 'on'], true);
        $has_width = ($width_raw > 0);
        $width = $has_width ? self::normalize_widget_width($width_raw) : 0;
        $x = max(0, $x_raw);
        $y = max(0, $y_raw);

        if (!$has_collapsed && !$has_width && !$has_x && !$has_y) {
            wp_send_json_error([
                'message' => 'Missing ui state payload.',
                'code' => 'missing_ui_state_payload',
            ], 400);
        }

        $state = self::get_normalized_widget_ui_state_for_user($user_id, false);
        if (!isset($state['workspaces'][$workspace_id]) || !is_array($state['workspaces'][$workspace_id])) {
            $state['workspaces'][$workspace_id] = [];
        }
        if (!isset($state['workspaces'][$workspace_id][$widget_id]) || !is_array($state['workspaces'][$workspace_id][$widget_id])) {
            $state['workspaces'][$workspace_id][$widget_id] = [];
        }

        if ($has_collapsed) {
            $state['workspaces'][$workspace_id][$widget_id]['collapsed'] = $collapsed;
        }
        if ($has_width) {
            $state['workspaces'][$workspace_id][$widget_id]['width'] = $width;
        }
        if ($has_x) {
            $state['workspaces'][$workspace_id][$widget_id]['x'] = $x;
        }
        if ($has_y) {
            $state['workspaces'][$workspace_id][$widget_id]['y'] = $y;
        }
        self::save_normalized_widget_ui_state_for_user($user_id, $state);

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'widget_id' => $widget_id,
            'collapsed' => $has_collapsed ? $collapsed : null,
            'width' => $has_width ? $width : null,
            'x' => $has_x ? $x : null,
            'y' => $has_y ? $y : null,
        ]);
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     */
    private static function update_widget_block_width_recursive(array &$blocks, string $path, string $item_id, int $column_span, bool &$updated): void
    {
        foreach ($blocks as $index => &$block) {
            if (!is_array($block)) {
                continue;
            }

            $next_path = $path . '_' . (string) $index;
            $name = (string) ($block['blockName'] ?? '');
            $attrs = is_array($block['attrs'] ?? null) ? $block['attrs'] : [];
            $seed = sanitize_key((string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''));
            if ($seed === '') {
                $seed = sanitize_key(str_replace('/', '_', $name) . '_' . $next_path);
            }
            $runtime_id = 'sd_canvas_' . $seed;

            if ($name === 'systemdeck/widgets' && $runtime_id === $item_id) {
                $attrs['columnSpan'] = $column_span;
                $block['attrs'] = $attrs;
                $updated = true;
                return;
            }

            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                self::update_widget_block_width_recursive($block['innerBlocks'], $next_path, $item_id, $column_span, $updated);
                if ($updated) {
                    return;
                }
            }
        }
    }

    public static function handle_sync_layout_to_editor(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));
        $layout_items = self::decode_json_array_from_post('layout');
        if (!array_key_exists('layout', $_POST)) {
            wp_send_json_error([
                'message' => 'Invalid layout payload.',
                'code' => 'invalid_layout_payload',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $context = new Context($user_id, $workspace_id);
        $sanitized_layout = [];
        foreach (array_values($layout_items) as $idx => $item) {
            if (!is_array($item)) {
                continue;
            }
            $sanitized_item = self::sanitize_layout_item($item, $idx);
            if ($sanitized_item !== null) {
                $sanitized_layout[] = $sanitized_item;
            }
        }
        \SystemDeck\Core\StorageEngine::save('layout', $sanitized_layout, $context);

        $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id);
        if ($canvas_id <= 0) {
            wp_send_json_error(['message' => 'Unable to resolve workspace canvas'], 500);
        }
        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== \SystemDeck\Core\Services\CanvasRepository::CPT) {
            wp_send_json_error(['message' => 'Canvas not found'], 404);
        }
        if (!function_exists('parse_blocks') || !function_exists('serialize_blocks')) {
            wp_send_json_error(['message' => 'Block parser unavailable'], 500);
        }

        $layout_map = [];
        $widget_queue_map = [];
        foreach ($sanitized_layout as $idx => $item) {
            $id = sanitize_key((string) ($item['id'] ?? ''));
            $layout_map[$id] = [
                'w' => self::normalize_widget_width((int) ($item['w'] ?? 2)),
                'h' => max(1, min(12, (int) ($item['h'] ?? 1))),
                'x' => max(0, (int) ($item['x'] ?? 0)),
                'y' => max(0, (int) ($item['y'] ?? ($idx * 2))),
            ];
            $settings = is_array($item['settings'] ?? null) ? $item['settings'] : [];
            $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($settings['widgetId'] ?? ''));
            if ($widget_id !== '') {
                $widget_queue_map[$widget_id][] = $layout_map[$id];
            }
        }

        $blocks = parse_blocks((string) $post->post_content);
        if (!is_array($blocks)) {
            wp_send_json_error(['message' => 'Canvas parse failed'], 500);
        }
        $changed = false;
        self::sync_canvas_block_spatial_and_order($blocks, '0', $layout_map, $widget_queue_map, $changed);
        if ($changed) {
            remove_action(
                'save_post_' . \SystemDeck\Core\Services\CanvasRepository::CPT,
                [\SystemDeck\Core\Services\CanvasRepository::class, 'sync_workspace_layout_from_canvas'],
                20
            );
            wp_update_post([
                'ID' => $canvas_id,
                'post_content' => serialize_blocks($blocks),
            ]);
            add_action(
                'save_post_' . \SystemDeck\Core\Services\CanvasRepository::CPT,
                [\SystemDeck\Core\Services\CanvasRepository::class, 'sync_workspace_layout_from_canvas'],
                20,
                3
            );
        }

        wp_send_json_success([
            'message' => 'Editor layout synced from workspace.',
            'canvas_id' => $canvas_id,
            'count' => count($layout_map),
        ]);
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @param array<string,array{w:int,h:int,x:int,y:int}> $layout_map
     * @param array<string,array<int,array{w:int,h:int,x:int,y:int}>> $widget_queue_map
     */
    private static function sync_canvas_block_spatial_and_order(array &$blocks, string $path, array $layout_map, array &$widget_queue_map, bool &$changed): void
    {
        $widget_slots = [];
        foreach ($blocks as $index => &$block) {
            if (!is_array($block)) {
                continue;
            }
            $next_path = $path . '_' . (string) $index;
            $name = (string) ($block['blockName'] ?? '');
            $attrs = is_array($block['attrs'] ?? null) ? $block['attrs'] : [];
            $seed = sanitize_key((string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''));
            if ($seed === '') {
                $seed = sanitize_key(str_replace('/', '_', $name) . '_' . $next_path);
            }
            $runtime_id = 'sd_canvas_' . $seed;

            if ($name === 'systemdeck/widgets') {
                $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($attrs['widgetId'] ?? ''));
                $spatial = $layout_map[$runtime_id] ?? null;
                if (!is_array($spatial) && $widget_id !== '' && !empty($widget_queue_map[$widget_id])) {
                    $spatial = array_shift($widget_queue_map[$widget_id]);
                }
                if (!is_array($spatial)) {
                    $spatial = null;
                }
            }

            if ($name === 'systemdeck/widgets' && is_array($spatial ?? null)) {
                $attrs['columnSpan'] = $spatial['w'];
                $attrs['rowSpan'] = $spatial['h'];
                $attrs['gridX'] = $spatial['x'];
                $attrs['gridY'] = $spatial['y'];
                $block['attrs'] = $attrs;
                $changed = true;
                $widget_slots[] = [
                    'index' => $index,
                    'runtime_id' => $runtime_id,
                    'x' => (int) $spatial['x'],
                    'y' => (int) $spatial['y'],
                    'block' => $block,
                ];
            }

            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                self::sync_canvas_block_spatial_and_order($block['innerBlocks'], $next_path, $layout_map, $widget_queue_map, $changed);
            }
        }

        // Reorder widget blocks inside the same parent by saved spatial order
        // while leaving non-widget blocks in place.
        if (count($widget_slots) > 1) {
            $sorted = $widget_slots;
            usort($sorted, static function ($a, $b): int {
                if ($a['y'] === $b['y']) {
                    return $a['x'] <=> $b['x'];
                }
                return $a['y'] <=> $b['y'];
            });

            foreach ($widget_slots as $slot_idx => $slot) {
                $target_index = (int) $slot['index'];
                $replacement = $sorted[$slot_idx]['block'] ?? null;
                if (is_array($replacement) && isset($blocks[$target_index])) {
                    $blocks[$target_index] = $replacement;
                }
            }
            $changed = true;
        }
    }

    /**
     * Persist workspace layout + workspace metadata + optional registry enablement atomically.
     *
     * @return array{success:bool,message:string,workspace_id:string,widget_count:int,enablement_count:int}
     */
    private static function persist_workspace_state_from_request(bool $include_enablement): array
    {
        $user_id = (int) get_current_user_id();
        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));
        if (!array_key_exists('layout', $_POST)) {
            return [
                'success' => false,
                'message' => 'Invalid layout payload',
                'workspace_id' => $workspace_id,
                'widget_count' => 0,
                'enablement_count' => 0,
            ];
        }
        $layout_data = self::decode_json_array_from_post('layout');

        $items = [];
        foreach ($layout_data as $key => $props) {
            if (!is_array($props)) {
                continue;
            }
            $props['id'] = $props['id'] ?? $props['i'] ?? (is_string($key) ? $key : '');
            $sanitized_item = self::sanitize_layout_item($props, is_int($key) ? $key : 0);
            if ($sanitized_item !== null) {
                $items[] = $sanitized_item;
            }
        }

        $owner_id = self::get_workspace_owner_id($workspace_id, $user_id);
        $is_shared_non_owner = ($owner_id > 0 && $owner_id !== $user_id);
        $is_collaborative = self::is_collaborative_workspace($workspace_id, $owner_id > 0 ? $owner_id : $user_id);
        if ($is_shared_non_owner && !$is_collaborative) {
            $hidden_base_widgets = self::get_hidden_base_widget_ids($user_id, $workspace_id);
            $hidden_lookup = array_fill_keys($hidden_base_widgets, true);
            // Shared workspace guard: non-owner cannot remove owner/base widgets.
            $owner_context = new Context($owner_id, $workspace_id);
            $owner_items = StorageEngine::get('layout', $owner_context);
            if (is_array($owner_items) && !empty($owner_items)) {
                $incoming_by_id = [];
                foreach ($items as $it) {
                    $incoming_by_id[(string) ($it['id'] ?? '')] = true;
                }
                foreach ($owner_items as $owner_item) {
                    $owner_id_item = (string) ($owner_item['id'] ?? '');
                    $owner_settings = is_array($owner_item['settings'] ?? null) ? $owner_item['settings'] : [];
                    $owner_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($owner_settings['widgetId'] ?? ''));
                    if ($owner_widget_id !== '' && isset($hidden_lookup[$owner_widget_id])) {
                        continue;
                    }
                    if ($owner_id_item === '' || isset($incoming_by_id[$owner_id_item])) {
                        continue;
                    }
                    $items[] = [
                        'id' => $owner_id_item,
                        'type' => (string) ($owner_item['type'] ?? 'widget'),
                        'settings' => (array) ($owner_item['settings'] ?? []),
                        'x' => (int) ($owner_item['x'] ?? 0),
                        'y' => (int) ($owner_item['y'] ?? 0),
                        'w' => (int) ($owner_item['w'] ?? 4),
                        'h' => (int) ($owner_item['h'] ?? 4),
                    ];
                }
            }
        }

        $context = new Context($user_id, $workspace_id);
        $result = StorageEngine::save('layout', $items, $context);
        if (!$result) {
            return [
                'success' => false,
                'message' => 'Save failed',
                'workspace_id' => $workspace_id,
                'widget_count' => 0,
                'enablement_count' => 0,
            ];
        }

        // Only workspace owner updates canonical CPT block spatial attrs.
        if (!$is_shared_non_owner) {
            self::sync_widget_block_spatial_attrs($workspace_id, $items, $user_id);
        }

        $widget_ids = [];
        foreach ($items as $item) {
            $item_type = (string) ($item['type'] ?? 'widget');
            if ($item_type === 'widget' && !empty($item['id'])) {
                $widget_ids[] = (string) $item['id'];
            } elseif ($item_type === 'block_widget_placeholder') {
                $settings = is_array($item['settings'] ?? null) ? $item['settings'] : [];
                $slot_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($settings['widgetId'] ?? ''));
                if ($slot_widget_id !== '') {
                    $widget_ids[] = $slot_widget_id;
                }
            }
        }
        $widget_ids = array_values(array_unique($widget_ids));

        $workspaces = self::get_user_workspaces($user_id);
        if (isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['widgets'] = $widget_ids;
            $workspaces[$workspace_id]['available'] = $widget_ids;
            if (empty($workspaces[$workspace_id]['created'])) {
                $workspaces[$workspace_id]['created'] = current_time('mysql');
            }
            self::save_user_workspaces($user_id, $workspaces);
        }

        $enablement_count = 0;
        if ($include_enablement) {
            $enablement = self::decode_json_array_from_post('registry_enablement');
            $clean = array_map('sanitize_text_field', $enablement);

            $clean = array_values(array_unique($clean));
            update_user_meta($user_id, 'sd_registry_enablement', $clean);
            $enablement_count = count($clean);
        }

        return [
            'success' => true,
            'message' => 'ok',
            'workspace_id' => $workspace_id,
            'widget_count' => count($widget_ids),
            'enablement_count' => $enablement_count,
        ];
    }

    private static function get_workspace_owner_id(string $workspace_id, int $fallback_user_id): int
    {
        if ($workspace_id === '' || $workspace_id === 'default') {
            return $fallback_user_id;
        }
        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            return $fallback_user_id;
        }
        $posts = get_posts([
            'post_type' => \SystemDeck\Core\Services\CanvasRepository::CPT,
            'post_status' => ['publish', 'private', 'draft', 'pending'],
            'posts_per_page' => 1,
            'meta_query' => [
                [
                    'key' => \SystemDeck\Core\Services\CanvasRepository::META_WORKSPACE,
                    'value' => sanitize_key($workspace_id),
                    'compare' => '=',
                ]
            ],
            'orderby' => 'ID',
            'order' => 'DESC',
            'no_found_rows' => true,
        ]);
        if (empty($posts) || !($posts[0] instanceof \WP_Post)) {
            return $fallback_user_id;
        }
        $post = $posts[0];
        $owner = (int) $post->post_author;
        return $owner > 0 ? $owner : $fallback_user_id;
    }

    public static function get_shared_workspace_overlay(int $user_id, string $workspace_id): array
    {
        if ($user_id <= 0 || $workspace_id === '') {
            return [
                'hidden_base_widgets' => [],
            ];
        }

        $context = new Context($user_id, $workspace_id);
        $overlay = StorageEngine::get('shared_overlay', $context);
        if (!is_array($overlay)) {
            $overlay = [];
        }

        $hidden = $overlay['hidden_base_widgets'] ?? [];
        if (!is_array($hidden)) {
            $hidden = [];
        }

        $overlay['hidden_base_widgets'] = array_values(array_unique(array_filter(array_map(
            ['\\SystemDeck\\Core\\Services\\WidgetRuntimeBridge', 'sanitize_widget_id'],
            $hidden
        ))));

        return $overlay;
    }

    public static function save_shared_workspace_overlay(int $user_id, string $workspace_id, array $overlay): bool
    {
        if ($user_id <= 0 || $workspace_id === '') {
            return false;
        }

        $context = new Context($user_id, $workspace_id);
        return StorageEngine::save('shared_overlay', $overlay, $context);
    }

    public static function get_hidden_base_widget_ids(int $user_id, string $workspace_id): array
    {
        $overlay = self::get_shared_workspace_overlay($user_id, $workspace_id);
        return array_values((array) ($overlay['hidden_base_widgets'] ?? []));
    }

    private static function is_collaborative_workspace(string $workspace_id, int $user_id = 0): bool
    {
        if ($workspace_id === '' || $workspace_id === 'default' || !class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            return false;
        }

        return \SystemDeck\Core\Services\CanvasRepository::get_workspace_collaboration_mode($workspace_id, $user_id) === 'collaborative';
    }

    private static function is_app_workspace(string $workspace_id, int $user_id = 0): bool
    {
        if ($workspace_id === '' || $workspace_id === 'default' || !class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            return false;
        }

        $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, $user_id);
        $canvas_id = (int) ($canvas['id'] ?? 0);
        if ($canvas_id <= 0) {
            return false;
        }

        $is_app = (bool) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_IS_APP_WORKSPACE, true);
        $app_id = sanitize_key((string) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_APP_ID, true));
        return $is_app || $app_id !== '';
    }

    private static function purge_workspace_for_all_users(string $workspace_id, int $canvas_id = 0): void
    {
        $workspace_id = sanitize_key($workspace_id);
        if ($workspace_id === '') {
            return;
        }

        foreach (get_users(['fields' => 'ID']) as $uid) {
            $user_id = (int) $uid;
            if ($user_id <= 0) {
                continue;
            }

            $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
            if (is_array($workspaces) && isset($workspaces[$workspace_id])) {
                unset($workspaces[$workspace_id]);
                update_user_meta($user_id, 'sd_workspaces', $workspaces);
            }

            delete_user_meta($user_id, 'sd_workspace_' . sanitize_title($workspace_id));
        }

        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $table_state = $wpdb->prefix . 'sd_context_state';

        $keys = [sanitize_key($workspace_id)];
        if ($canvas_id > 0) {
            $keys[] = (string) $canvas_id;
        }

        foreach (get_users(['fields' => 'ID']) as $uid) {
            $user_id = (int) $uid;
            if ($user_id <= 0) {
                continue;
            }
            $keys[] = sprintf('u%d_ws_%s', $user_id, $workspace_id);
        }

        $keys = array_values(array_unique(array_filter($keys)));
        foreach ($keys as $workspace_key) {
            $wpdb->delete($table_items, ['workspace_id' => $workspace_key], ['%s']);
        }

        $wpdb->delete($table_state, ['workspace_id' => $workspace_id], ['%s']);

        /**
         * SystemDeck: Notify widgets to cleanup workspace-bound artifacts.
         * Used for cleaning up sticky note projections and metadata.
         */
        do_action('systemdeck_purge_workspace', $workspace_id);
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    private static function get_base_runtime_items_for_workspace(string $workspace_id, int $owner_id): array
    {
        $canvas_payload = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, $owner_id);
        return \SystemDeck\Core\Services\CanvasRepository::extract_runtime_blocks_from_content((string) ($canvas_payload['content'] ?? ''));
    }

    /**
     * @param array<int,array<string,mixed>> $items
     * @return array<string,array<string,mixed>>
     */
    private static function index_layout_items(array $items): array
    {
        $indexed = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = sanitize_key((string) ($item['id'] ?? $item['i'] ?? ''));
            if ($id === '') {
                continue;
            }
            $settings = is_array($item['settings'] ?? null) ? $item['settings'] : [];
            $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($settings['widgetId'] ?? ''));
            if ($widget_id !== '') {
                $item['type'] = 'block_widget_placeholder';
                $item['settings'] = $settings;
            }
            $item['id'] = $id;
            $item['i'] = $id;
            $indexed[$id] = $item;
        }

        return $indexed;
    }

    /**
     * @param array<string,array<string,mixed>> $layout_items
     * @return array<int,string>
     */
    private static function collect_workspace_widget_ids(array $layout_items): array
    {
        $workspace_widget_ids = [];
        foreach ($layout_items as $item) {
            if (($item['type'] ?? '') !== 'block_widget_placeholder') {
                continue;
            }
            $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($item['settings']['widgetId'] ?? '')));
            if ($candidate !== '') {
                $workspace_widget_ids[] = $candidate;
            }
        }

        return array_values(array_unique($workspace_widget_ids));
    }

    /**
     * @param array<string,array<string,mixed>> $layout_items
     */
    private static function next_overlay_widget_position(array $layout_items): array
    {
        $max_y = 0;
        foreach ($layout_items as $item) {
            $max_y = max($max_y, (int) ($item['y'] ?? 0) + (int) ($item['h'] ?? 1));
        }

        return [
            'x' => 0,
            'y' => $max_y,
            'w' => 2,
            'h' => 1,
        ];
    }

    /**
     * @return array{layout_items:array<string,array<string,mixed>>,workspace_widgets:array<int,string>}
     */
    private static function build_shared_workspace_overlay_view(string $workspace_id, int $user_id, int $owner_id): array
    {
        $context = new Context($user_id, $workspace_id);
        $local_items = StorageEngine::get('layout', $context);
        $local_index = self::index_layout_items(is_array($local_items) ? $local_items : []);

        $hidden_base_widgets = self::get_hidden_base_widget_ids($user_id, $workspace_id);
        $hidden_lookup = array_fill_keys($hidden_base_widgets, true);

        $base_runtime_items = self::get_base_runtime_items_for_workspace($workspace_id, $owner_id);
        foreach ($base_runtime_items as $base_item_id => $base_item) {
            $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($base_item['settings']['widgetId'] ?? '')));
            if ($widget_id !== '' && isset($hidden_lookup[$widget_id])) {
                unset($local_index[$base_item_id]);
                continue;
            }

            if (!isset($local_index[$base_item_id])) {
                $local_index[$base_item_id] = [
                    'i' => $base_item_id,
                    'id' => $base_item_id,
                    'type' => (string) ($base_item['type'] ?? 'block_widget_placeholder'),
                    'title' => (string) ($base_item['title'] ?? 'Widget'),
                    'x' => (int) ($base_item['x'] ?? 0),
                    'y' => (int) ($base_item['y'] ?? 0),
                    'w' => (int) ($base_item['w'] ?? 2),
                    'h' => (int) ($base_item['h'] ?? 1),
                    'settings' => (array) ($base_item['settings'] ?? []),
                ];
            }
        }

        return [
            'layout_items' => $local_index,
            'workspace_widgets' => self::collect_workspace_widget_ids($local_index),
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private static function sync_widget_block_spatial_attrs(string $workspace_id, array $items, int $user_id): void
    {
        $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id);
        if ($canvas_id <= 0) {
            return;
        }
        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== \SystemDeck\Core\Services\CanvasRepository::CPT) {
            return;
        }
        if (!function_exists('parse_blocks') || !function_exists('serialize_blocks')) {
            return;
        }

        $map = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $item_id = sanitize_key((string) ($item['id'] ?? ''));
            $type = (string) ($item['type'] ?? '');
            if ($item_id === '' || $type !== 'block_widget_placeholder') {
                continue;
            }
            $map[$item_id] = [
                'w' => self::normalize_widget_width((int) ($item['w'] ?? 2)),
                'h' => max(1, min(12, (int) ($item['h'] ?? 1))),
                'x' => max(0, (int) ($item['x'] ?? 0)),
                'y' => max(0, (int) ($item['y'] ?? 0)),
            ];
        }

        if (empty($map)) {
            return;
        }

        $blocks = parse_blocks((string) $post->post_content);
        if (!is_array($blocks)) {
            return;
        }

        $changed = false;
        self::sync_widget_block_spatial_recursive($blocks, '0', $map, $changed);
        if (!$changed) {
            return;
        }

        remove_action(
            'save_post_' . \SystemDeck\Core\Services\CanvasRepository::CPT,
            [\SystemDeck\Core\Services\CanvasRepository::class, 'sync_workspace_layout_from_canvas'],
            20
        );
        wp_update_post([
            'ID' => $canvas_id,
            'post_content' => serialize_blocks($blocks),
        ]);
        add_action(
            'save_post_' . \SystemDeck\Core\Services\CanvasRepository::CPT,
            [\SystemDeck\Core\Services\CanvasRepository::class, 'sync_workspace_layout_from_canvas'],
            20,
            3
        );
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @param array<string,array{w:int,h:int,x:int,y:int}> $map
     */
    private static function sync_widget_block_spatial_recursive(array &$blocks, string $path, array $map, bool &$changed): void
    {
        foreach ($blocks as $index => &$block) {
            if (!is_array($block)) {
                continue;
            }
            $next_path = $path . '_' . (string) $index;
            $name = (string) ($block['blockName'] ?? '');
            $attrs = is_array($block['attrs'] ?? null) ? $block['attrs'] : [];
            $seed = sanitize_key((string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''));
            if ($seed === '') {
                $seed = sanitize_key(str_replace('/', '_', $name) . '_' . $next_path);
            }
            $runtime_id = 'sd_canvas_' . $seed;

            if ($name === 'systemdeck/widgets' && isset($map[$runtime_id])) {
                $spatial = $map[$runtime_id];
                $attrs['columnSpan'] = $spatial['w'];
                $attrs['rowSpan'] = $spatial['h'];
                $attrs['gridX'] = $spatial['x'];
                $attrs['gridY'] = $spatial['y'];
                $block['attrs'] = $attrs;
                $changed = true;
            }

            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                self::sync_widget_block_spatial_recursive($block['innerBlocks'], $next_path, $map, $changed);
            }
        }
    }

    /* ==========================================================================
       5. NOTES WIDGET HANDLERS
       ========================================================================== */

    public static function handle_get_notes(): void
    {
        self::verify_request();
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            $res = \SystemDeck\Widgets\Notes::ajax_get_notes($_POST);
            wp_send_json_success($res);
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_get_all_notes(): void
    {
        self::verify_request();
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            $res = \SystemDeck\Widgets\Notes::ajax_get_all_notes($_POST);
            wp_send_json_success($res);
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_get_read_note(): void
    {
        self::verify_request('read', false);
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_get_read_note($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error(['error' => $e->getMessage()]);
            }
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_save_note(): void
    {
        self::verify_request();
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_save_note($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error(['error' => $e->getMessage()]);
            }
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_delete_note(): void
    {
        self::verify_request();
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_delete_note($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error(['error' => $e->getMessage()]);
            }
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_pin_note(): void
    {
        self::verify_request();
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_pin_note($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error(['error' => $e->getMessage()]);
            }
        }
        wp_send_json_error(['message' => 'Notes module missing']);
    }

    public static function handle_toggle_note_sticky(): void
    {
        self::verify_request();

        if (!isset($_POST['note_id'])) {
            wp_send_json_error(['message' => 'Missing note_id'], 400);
        }

        $note_id = intval($_POST['note_id']);

        if (!$note_id) {
            wp_send_json_error(['message' => 'Invalid note_id'], 400);
        }

        $post = get_post($note_id);

        if (!$post || $post->post_type !== 'sd_note') {
            wp_send_json_error(['message' => 'Invalid note'], 404);
        }

        // Author-only rule (SystemDeck contract)
        if (intval($post->post_author) !== get_current_user_id()) {
            wp_send_json_error(['message' => 'Unauthorized'], 403);
        }

        $meta_key = '_sd_note_is_sticky';
        $current  = get_post_meta($note_id, $meta_key, true);
        $new      = ($current == 1) ? 0 : 1;

        update_post_meta($note_id, $meta_key, $new);

        wp_send_json_success([
            'note_id'  => $note_id,
            'is_sticky' => (bool)$new,
        ]);
    }

    public static function handle_get_note_comments(): void
    {
        self::verify_request('read', false);
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_get_note_comments($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error([
                    'message' => $e->getMessage(),
                    'code' => 'note_comments_failed',
                ], 400);
            }
        }
        wp_send_json_error([
            'message' => 'Notes module missing.',
            'code' => 'notes_module_missing',
        ], 500);
    }

    public static function handle_add_note_comment(): void
    {
        self::verify_request('read', true);
        if (class_exists('\\SystemDeck\\Widgets\\Notes')) {
            try {
                $res = \SystemDeck\Widgets\Notes::ajax_add_note_comment($_POST);
                wp_send_json_success($res);
            } catch (\Exception $e) {
                wp_send_json_error([
                    'message' => $e->getMessage(),
                    'code' => 'note_comment_create_failed',
                ], 400);
            }
        }
        wp_send_json_error([
            'message' => 'Notes module missing.',
            'code' => 'notes_module_missing',
        ], 500);
    }

    /* ==========================================================================
       5. EXPORT THEME JSON (Retail Mode)
       ========================================================================== */

    /**
     * AJAX: Export Theme JSON
     */
    public static function handle_export_theme_json(): void
    {
        // 1. Security & Permissions
        if (!current_user_can('edit_theme_options')) {
            wp_die('Permission denied', 403);
        }

        // Validate nonce - note: we check 'nonce' param as passed from JS
        if (!check_ajax_referer('systemdeck_runtime', 'nonce', false)) {
            wp_die('Security check failed', 403);
        }

        // 2. Retrieve the "Universal Harvester" Data
        $user_id = get_current_user_id();
        $telemetry = StorageEngine::get('telemetry', new Context($user_id, 'retail', 'global', 'global'));

        if (!$telemetry || empty($telemetry['settings'])) {
            wp_die('No telemetry found. Please load the Inspector first.', 404);
        }

        // 3. Construct Payload (Schema v3)
        $export = [
            '$schema' => 'https://schemas.wp.org/trunk/theme.json',
            'version' => self::THEME_JSON_SCHEMA_VERSION,
            'title' => ($telemetry['theme'] ?? 'Theme') . ' (SystemDeck Variation)',
            'settings' => self::clean_for_export($telemetry['settings']),
            'styles' => self::clean_for_export($telemetry['styles']),
            'customTemplates' => $telemetry['customTemplates'] ?? [],
            'templateParts' => $telemetry['templateParts'] ?? []
        ];

        // 4. Force Download
        $filename = 'theme-variation-' . date('Y-m-d-His') . '.json';

        header('Content-Description: File Transfer');
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');

        echo json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Sanitizer for export
     */
    private static function clean_for_export($array)
    {
        if (!is_array($array)) {
            return $array;
        }

        foreach ($array as $key => &$value) {
            if ($key === 'rgb' || $key === 'refId') {
                unset($array[$key]);
            } elseif (is_array($value)) {
                $value = self::clean_for_export($value);
            }
        }
        return $array;
    }

    // ==========================================================================
    //    5. COMMAND CENTER: Scanner & Workspace CRUD
    // ==========================================================================


    /**
     * AJAX: Create Workspace
     */
    public static function handle_create_workspace(): void
    {
        self::verify_request();

        $name = self::post_string('name');
        if (empty($name)) {
            wp_send_json_error([
                'message' => 'Workspace name is required.',
                'code' => 'missing_workspace_name',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);

        $id = 'ws_' . str_replace('-', '', wp_generate_uuid4());
        $max_order = 0;
        foreach ($workspaces as $ws) {
            if (is_array($ws) && isset($ws['order']) && $ws['order'] > $max_order) {
                $max_order = (int) $ws['order'];
            }
        }

        $workspaces[$id] = self::normalize_workspace_record([
            'id' => $id,
            'name' => $name,
            'widgets' => [],
            'created' => current_time('mysql'),
            'order' => $max_order + 1,
            'shared' => false,
            'pinned' => false,
            'source_workspace_id' => '',
            'source_version_at_clone' => 0
        ], $id);

        self::save_user_workspaces($user_id, $workspaces);

        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($id, $user_id, $name);
            if ($canvas_id > 0) {
                $workspaces = self::get_user_workspaces($user_id) ?: $workspaces;
            }
            $workspaces = \SystemDeck\Core\Services\CanvasRepository::enrich_workspaces_with_canvas_data($workspaces, $user_id);
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => 'Workspace created.',
            'workspace' => $workspaces[$id]
        ]);
    }

    /**
     * AJAX: Delete Workspace
     */
    public static function handle_delete_workspace(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);

        if (!isset($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }

        // F-08 FIX: Only the workspace owner (or admin) may delete a workspace.
        // Without this, a shared-workspace recipient could trigger purge_workspace_for_all_users()
        // and destroy the workspace for everyone including the original owner.
        $owner_id = self::get_workspace_owner_id($workspace_id, $user_id);
        if ($owner_id !== $user_id && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only the workspace owner can delete this workspace.'], 403);
        }

        $is_admin = current_user_can('manage_options');
        $policy = function_exists('systemdeck_get_access_policy') ? systemdeck_get_access_policy() : [];
        $delete_mode = (string) ($policy['workspace_delete_mode'] ?? 'soft_for_non_admin');

        $soft_delete = (!$is_admin && $delete_mode === 'soft_for_non_admin');
        if ($soft_delete) {
            $workspaces[$workspace_id]['archived'] = true;
            $workspaces[$workspace_id]['archived_at'] = current_time('mysql');
            $workspaces[$workspace_id]['archived_by'] = $user_id;
            self::save_user_workspaces($user_id, $workspaces);

            if (!empty($workspaces[$workspace_id]['canvas_id'])) {
                wp_update_post([
                    'ID' => (int) $workspaces[$workspace_id]['canvas_id'],
                    'post_status' => 'draft',
                ]);
            }

            wp_send_json_success(['message' => 'Workspace archived (drafted for admin review).']);
        }

        unset($workspaces[$workspace_id]);
        self::save_user_workspaces($user_id, $workspaces);
        $canvas_id = 0;
        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, (int) $user_id);
            $canvas_id = (int) ($canvas['id'] ?? 0);
        }
        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            \SystemDeck\Core\Services\CanvasRepository::delete_canvas_for_workspace($workspace_id, (int) $user_id);
        }
        self::purge_workspace_for_all_users($workspace_id, $canvas_id);

        wp_send_json_success(['message' => 'Workspace deleted.']);
    }

    /**
     * AJAX: Rename Workspace
     */
    public static function handle_rename_workspace(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        $new_name = self::post_string('name');

        if (empty($new_name)) {
            wp_send_json_error([
                'message' => 'New name is required.',
                'code' => 'missing_workspace_name',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);

        if (!isset($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }

        // F-09 FIX: Only the workspace owner (or admin) may rename a workspace.
        // Without this, a shared-workspace recipient could rename the canonical canvas post
        // for all users.
        $owner_id = self::get_workspace_owner_id($workspace_id, $user_id);
        if ($owner_id !== $user_id && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only the workspace owner can rename this workspace.'], 403);
        }

        if (is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['name'] = $new_name;
        } else {
            // Handle legacy format if strictly string? Unlikely given create structure.
            $workspaces[$workspace_id]['name'] = $new_name;
        }

        self::save_user_workspaces($user_id, $workspaces);

        if (
            class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')
            && !empty($workspaces[$workspace_id]['canvas_id'])
        ) {
            wp_update_post([
                'ID' => (int) $workspaces[$workspace_id]['canvas_id'],
                'post_title' => $new_name,
            ]);
            $workspaces = \SystemDeck\Core\Services\CanvasRepository::enrich_workspaces_with_canvas_data($workspaces, $user_id);
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => 'Workspace renamed.',
            'workspace' => $workspaces[$workspace_id] ?? null,
        ]);
    }

    /**
     * AJAX: Reorder Workspaces
     */
    public static function handle_reorder_workspaces(): void
    {
        self::verify_request();

        $order_list = self::decode_json_array_from_post('order');
        if (empty($order_list) && isset($_POST['order']) && is_array($_POST['order'])) {
            $order_list = $_POST['order'];
        }

        if (empty($order_list) || !is_array($order_list)) {
            wp_send_json_error([
                'message' => 'Invalid order data.',
                'code' => 'invalid_order_data',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        $dirty = false;

        // $order_list is expected to be array of IDs in order
        foreach ($order_list as $index => $id) {
            $id = sanitize_key((string) $id);
            if (isset($workspaces[$id])) {
                $workspaces[$id]['order'] = $index;
                $dirty = true;
            }
        }

        if ($dirty) {
            self::save_user_workspaces($user_id, $workspaces);
            wp_send_json_success(['message' => 'Workspaces reordered.']);
        } else {
            wp_send_json_success(['message' => 'No changes made.']);
        }
    }

    /**
     * AJAX: Publish current workspace as a shared template (author action).
     */
    public static function handle_publish_workspace_template(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        if (!isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }

        $workspace = $workspaces[$workspace_id];
        $template_id = 'tpl_' . $user_id . '_' . sanitize_key($workspace_id);

        $context = new Context($user_id, $workspace_id);
        $layout = [];
        $pins = [];
        if (class_exists('\\SystemDeck\\Core\\StorageEngine')) {
            $layout = \SystemDeck\Core\StorageEngine::get('layout', $context) ?: [];
            $pins = \SystemDeck\Core\StorageEngine::get('pins', $context) ?: [];
        }

        $templates = self::get_workspace_templates();
        $existing = $templates[$template_id] ?? [];
        $version = (int) ($existing['version'] ?? 0) + 1;

        $templates[$template_id] = [
            'template_id' => $template_id,
            'author_id' => $user_id,
            'workspace_id' => $workspace_id,
            'workspace_name' => sanitize_text_field((string) ($workspace['name'] ?? $workspace_id)),
            'layout' => is_array($layout) ? array_values($layout) : [],
            'pins' => is_array($pins) ? array_values($pins) : [],
            'widgets' => is_array($workspace['widgets'] ?? null) ? array_values($workspace['widgets']) : [],
            'available' => is_array($workspace['available'] ?? null) ? array_values($workspace['available']) : [],
            'version' => $version,
            'updated_at' => current_time('mysql'),
        ];
        self::save_workspace_templates($templates);

        $workspaces[$workspace_id]['shared'] = true;
        $workspaces[$workspace_id]['source_workspace_id'] = $template_id;
        $workspaces[$workspace_id]['source_version_at_clone'] = $version;
        self::save_user_workspaces($user_id, $workspaces);

        wp_send_json_success([
            'message' => 'Workspace template published.',
            'template_id' => $template_id,
            'version' => $version,
        ]);
    }

    /**
     * AJAX: Reset a user workspace to latest shared source template.
     * This is user-scoped and does not mutate other users.
     */
    public static function handle_reset_workspace_to_source(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        if (!isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }

        $source_id = sanitize_text_field((string) ($workspaces[$workspace_id]['source_workspace_id'] ?? ''));
        if ($source_id === '') {
            wp_send_json_error(['message' => 'Workspace has no shared source.'], 400);
        }

        $templates = self::get_workspace_templates();
        $template = $templates[$source_id] ?? null;
        if (!is_array($template)) {
            wp_send_json_error(['message' => 'Source template missing.'], 404);
        }

        $context = new Context($user_id, $workspace_id);
        $layout = is_array($template['layout'] ?? null) ? array_values($template['layout']) : [];
        $pins = is_array($template['pins'] ?? null) ? array_values($template['pins']) : [];

        if (class_exists('\\SystemDeck\\Core\\StorageEngine')) {
            \SystemDeck\Core\StorageEngine::save('layout', $layout, $context);
            \SystemDeck\Core\StorageEngine::save('pins', $pins, $context);
        }

        $workspaces[$workspace_id]['widgets'] = is_array($template['widgets'] ?? null) ? array_values($template['widgets']) : [];
        $workspaces[$workspace_id]['available'] = is_array($template['available'] ?? null)
            ? array_values($template['available'])
            : (is_array($template['widgets'] ?? null) ? array_values($template['widgets']) : []);
        $workspaces[$workspace_id]['source_version_at_clone'] = (int) ($template['version'] ?? 1);
        self::save_user_workspaces($user_id, $workspaces);

        wp_send_json_success([
            'message' => 'Workspace reset to source template.',
            'source_workspace_id' => $source_id,
            'version' => (int) ($template['version'] ?? 1),
        ]);
    }

    /**
     * AJAX: Check whether a workspace has a newer shared template version available.
     */
    public static function handle_check_workspace_update(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        if (!isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }

        $source_id = sanitize_text_field((string) ($workspaces[$workspace_id]['source_workspace_id'] ?? ''));
        if ($source_id === '') {
            wp_send_json_success([
                'has_update' => false,
                'version_current' => 0,
                'version_latest' => 0,
            ]);
        }

        $templates = self::get_workspace_templates();
        $template = $templates[$source_id] ?? null;
        if (!is_array($template)) {
            wp_send_json_success([
                'has_update' => false,
                'version_current' => (int) ($workspaces[$workspace_id]['source_version_at_clone'] ?? 0),
                'version_latest' => 0,
            ]);
        }

        $current = (int) ($workspaces[$workspace_id]['source_version_at_clone'] ?? 0);
        $latest = (int) ($template['version'] ?? 0);

        wp_send_json_success([
            'has_update' => $latest > $current,
            'version_current' => $current,
            'version_latest' => $latest,
            'source_workspace_id' => $source_id,
            'updated_at' => (string) ($template['updated_at'] ?? ''),
        ]);
    }

    /**
     * AJAX: Set workspace access role (CPT-backed).
     */
    public static function handle_set_workspace_access_role(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        $role = self::post_string('access_role', 'administrator');
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository unavailable.'], 500);
        }
        if (self::is_app_workspace($workspace_id, (int) $user_id) && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        $ok = \SystemDeck\Core\Services\CanvasRepository::set_workspace_access_role($workspace_id, $role, (int) $user_id);
        if (!$ok) {
            wp_send_json_error(['message' => 'Could not update access role.'], 500);
        }

        $workspaces = self::get_user_workspaces($user_id);
        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $workspaces = \SystemDeck\Core\Services\CanvasRepository::enrich_workspaces_with_canvas_data($workspaces, $user_id);
        }
        if (is_array($workspaces) && !empty($workspaces)) {
            self::save_user_workspaces($user_id, $workspaces);
        }

        $canonical_access_role = sanitize_key((string) ($workspaces[$workspace_id]['access_role'] ?? ''));
        if ($canonical_access_role === '') {
            $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, $user_id);
            $canvas_id = (int) ($canvas['id'] ?? 0);
            if ($canvas_id > 0) {
                $canonical_access_role = sanitize_key(
                    (string) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_ACCESS_ROLE, true)
                );
            }
        }
        if ($canonical_access_role === '') {
            $canonical_access_role = 'administrator';
        }

        wp_send_json_success([
            'message' => 'Workspace access updated.',
            'workspace_id' => $workspace_id,
            'access_role' => $canonical_access_role,
        ]);
    }

    /**
     * AJAX: Set workspace visibility + lock (CPT-backed).
     */
    public static function handle_set_workspace_visibility(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        $is_public = self::post_bool('is_public', false);
        $is_locked = self::post_bool('is_locked', false);
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository unavailable.'], 500);
        }
        if (self::is_app_workspace($workspace_id, (int) $user_id) && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        // Locking is admin-only. Non-admin users can toggle public visibility but cannot change lock state.
        if (!current_user_can('manage_options')) {
            $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, (int) $user_id);
            $canvas_id = (int) ($canvas['id'] ?? 0);
            if ($canvas_id > 0) {
                $is_locked = (bool) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_LOCKED, true);
            } else {
                $is_locked = false;
            }
        }

        $ok = \SystemDeck\Core\Services\CanvasRepository::set_workspace_visibility($workspace_id, $is_public, $is_locked, (int) $user_id);
        if (!$ok) {
            wp_send_json_error(['message' => 'Could not update workspace visibility.'], 500);
        }
        $collaboration_mode = \SystemDeck\Core\Services\CanvasRepository::get_workspace_collaboration_mode($workspace_id, (int) $user_id);
        if (!$is_public || $is_locked) {
            $collaboration_mode = 'owner_only';
            \SystemDeck\Core\Services\CanvasRepository::set_workspace_collaboration_mode($workspace_id, $collaboration_mode, (int) $user_id);
        }

        $workspaces = self::get_user_workspaces($user_id);
        if (isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['is_public'] = $is_public;
            $workspaces[$workspace_id]['is_locked'] = $is_locked;
            $workspaces[$workspace_id]['collaboration_mode'] = $collaboration_mode;
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => 'Workspace visibility updated.',
            'workspace_id' => $workspace_id,
            'is_public' => $is_public,
            'is_locked' => $is_locked,
            'collaboration_mode' => $collaboration_mode,
        ]);
    }

    /**
     * AJAX: Set workspace collaboration mode (CPT-backed).
     */
    public static function handle_set_workspace_collaboration_mode(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        $mode = self::post_string('collaboration_mode', 'owner_only');
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        $user_id = (int) get_current_user_id();
        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository unavailable.'], 500);
        }
        if (self::is_app_workspace($workspace_id, $user_id) && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        $normalized_mode = \SystemDeck\Core\Services\CanvasRepository::normalize_collaboration_mode($mode);
        $ok = \SystemDeck\Core\Services\CanvasRepository::set_workspace_collaboration_mode($workspace_id, $normalized_mode, $user_id);
        if (!$ok) {
            wp_send_json_error(['message' => 'Could not update collaboration mode.'], 500);
        }
        if ($normalized_mode === 'collaborative') {
            \SystemDeck\Core\Services\CanvasRepository::set_workspace_visibility($workspace_id, true, false, $user_id);
        }

        $workspaces = self::get_user_workspaces($user_id);
        if (isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['collaboration_mode'] = $normalized_mode;
            if ($normalized_mode === 'collaborative') {
                $workspaces[$workspace_id]['is_public'] = true;
                $workspaces[$workspace_id]['is_locked'] = false;
                $workspaces[$workspace_id]['shared_menu_only'] = false;
            }
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => 'Workspace collaboration mode updated.',
            'workspace_id' => $workspace_id,
            'collaboration_mode' => $normalized_mode,
            'is_public' => $normalized_mode === 'collaborative' ? true : null,
            'is_locked' => $normalized_mode === 'collaborative' ? false : null,
        ]);
    }

    /**
     * AJAX: Set workspace audience scope and targeted users.
     */
    public static function handle_set_workspace_audience(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        $audience_scope = self::post_string('audience_scope', 'global');
        $raw_usernames = self::post_string('target_usernames');
        $raw_target_user_ids = self::decode_json_array_from_post('target_user_ids');
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }

        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository unavailable.'], 500);
        }

        $user_id = (int) get_current_user_id();
        if (self::is_app_workspace($workspace_id, $user_id) && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        $scope = \SystemDeck\Core\Services\CanvasRepository::normalize_audience_scope($audience_scope);
        $target_user_ids = [];
        $target_user_logins = [];

        if ($scope === 'targeted_users') {
            if (is_array($raw_target_user_ids) && !empty($raw_target_user_ids)) {
                $target_user_ids = \SystemDeck\Core\Services\CanvasRepository::normalize_target_user_ids($raw_target_user_ids);
                foreach ($target_user_ids as $target_user_id) {
                    $user = get_userdata((int) $target_user_id);
                    if (!$user instanceof \WP_User) {
                        wp_send_json_error(['message' => sprintf('Unknown user id: %d', (int) $target_user_id)], 400);
                    }
                    $target_user_logins[] = (string) $user->user_login;
                }
            } else {
            $usernames = preg_split('/[\s,]+/', (string) $raw_usernames) ?: [];
            foreach ($usernames as $username) {
                $username = sanitize_user($username, true);
                if ($username === '') {
                    continue;
                }
                $user = get_user_by('login', $username);
                if (!$user instanceof \WP_User) {
                    wp_send_json_error(['message' => sprintf('Unknown username: %s', $username)], 400);
                }
                $target_user_ids[] = (int) $user->ID;
                $target_user_logins[] = (string) $user->user_login;
            }
            }
        }

        $ok = \SystemDeck\Core\Services\CanvasRepository::set_workspace_audience($workspace_id, $scope, $target_user_ids, $user_id);
        if (!$ok) {
            wp_send_json_error(['message' => 'Could not update workspace audience.'], 500);
        }

        $target_user_ids = \SystemDeck\Core\Services\CanvasRepository::normalize_target_user_ids($target_user_ids);
        $target_user_logins = array_values(array_unique(array_filter($target_user_logins)));

        $workspaces = self::get_user_workspaces($user_id);
        if (isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id]['audience_scope'] = $scope;
            $workspaces[$workspace_id]['target_user_ids'] = $target_user_ids;
            $workspaces[$workspace_id]['target_user_logins'] = $target_user_logins;
            self::save_user_workspaces($user_id, $workspaces);
        }

        wp_send_json_success([
            'message' => 'Workspace audience updated.',
            'workspace_id' => $workspace_id,
            'audience_scope' => $scope,
            'target_user_ids' => $target_user_ids,
            'target_user_logins' => $target_user_logins,
        ]);
    }

    /**
     * AJAX: Set app workspace top-level menu exposure.
     */
    public static function handle_set_workspace_app_menu(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id'), true);
        if ($workspace_id === '') {
            wp_send_json_error([
                'message' => 'Missing workspace_id.',
                'code' => 'missing_workspace_id',
            ], 400);
        }
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        $show_top_level_menu = self::post_bool('show_top_level_menu', false);
        $menu_icon = sanitize_html_class(self::post_string('menu_icon'));
        if ($menu_icon === '') {
            $menu_icon = 'dashicons-screenoptions';
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        if (!isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            wp_send_json_error([
                'message' => 'Workspace not found.',
                'code' => 'workspace_not_found',
            ], 404);
        }
        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository unavailable.'], 500);
        }
        $ok = \SystemDeck\Core\Services\CanvasRepository::set_workspace_app_menu(
            $workspace_id,
            $show_top_level_menu,
            $menu_icon,
            $user_id
        );
        if (!$ok) {
            wp_send_json_error(['message' => 'Could not update app menu settings.'], 500);
        }
        \SystemDeck\Core\Services\CanvasRepository::set_workspace_app_identity(
            $workspace_id,
            true,
            (string) ($workspaces[$workspace_id]['app_id'] ?? ''),
            $user_id
        );

        $workspaces[$workspace_id]['show_top_level_menu'] = $show_top_level_menu;
        $workspaces[$workspace_id]['menu_icon'] = $menu_icon;
        $workspaces = \SystemDeck\Core\Services\CanvasRepository::enrich_workspaces_with_canvas_data($workspaces, $user_id);
        self::save_user_workspaces($user_id, $workspaces);

        wp_send_json_success([
            'message' => 'App menu settings updated.',
            'workspace_id' => $workspace_id,
            'show_top_level_menu' => $show_top_level_menu,
            'menu_icon' => $menu_icon,
            'workspace' => $workspaces[$workspace_id],
        ]);
    }

    /**
     * AJAX: Return eligible user candidates for targeted workspace audience.
     */
    public static function handle_get_workspace_audience_candidates(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id($_POST['workspace_id'] ?? '', true);
        $query = sanitize_user(wp_unslash((string) ($_POST['q'] ?? '')), true);
        $role_override = sanitize_key((string) ($_POST['access_role'] ?? ''));
        if ($workspace_id === '') {
            wp_send_json_error(['message' => 'Missing workspace_id.'], 400);
        }
        if (self::is_app_workspace($workspace_id, (int) get_current_user_id()) && !current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Only administrators can edit app settings.'], 403);
        }

        $required_role = 'administrator';
        if ($role_override !== '') {
            $required_role = $role_override;
        } elseif (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, (int) get_current_user_id());
            $canvas_id = (int) ($canvas['id'] ?? 0);
            if ($canvas_id > 0) {
                $required_role = sanitize_key((string) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_ACCESS_ROLE, true) ?: 'administrator');
            }
        }

        $candidates = [];
        foreach (get_users() as $user) {
            if (!$user instanceof \WP_User) {
                continue;
            }
            $user_rank = 0;
            foreach ((array) $user->roles as $role) {
                if (function_exists('systemdeck_role_rank')) {
                    $user_rank = max($user_rank, systemdeck_role_rank((string) $role));
                }
            }
            $required_rank = function_exists('systemdeck_role_rank') ? systemdeck_role_rank($required_role) : 0;
            if ($user_rank < $required_rank) {
                continue;
            }
            if ($query !== '' && stripos((string) $user->user_login, $query) === false && stripos((string) $user->display_name, $query) === false) {
                continue;
            }
            $candidates[] = [
                'id' => (int) $user->ID,
                'login' => (string) $user->user_login,
                'label' => trim(sprintf('%s (%s)', (string) $user->user_login, (string) $user->display_name)),
            ];
        }

        usort($candidates, static function (array $a, array $b): int {
            return strcasecmp((string) ($a['login'] ?? ''), (string) ($b['login'] ?? ''));
        });

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'candidates' => array_slice($candidates, 0, 50),
        ]);
    }

    public static function handle_get_workspace_editor_url(): void
    {
        self::verify_request();

        $workspace_id = self::normalize_workspace_id(self::post_string('workspace_id', 'default'));

        if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            wp_send_json_error(['message' => 'Canvas repository is unavailable.'], 500);
        }

        $user_id = (int) get_current_user_id();
        $workspaces = self::get_user_workspaces($user_id);
        $workspace_name = '';
        if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $workspace_name = (string) ($workspaces[$workspace_id]['name'] ?? '');
        }

        $canvas_id = \SystemDeck\Core\Services\CanvasRepository::ensure_canvas_for_workspace($workspace_id, $user_id, $workspace_name);
        if ($canvas_id <= 0) {
            wp_send_json_error(['message' => 'Could not resolve workspace canvas.'], 404);
        }

        wp_send_json_success([
            'workspace_id' => $workspace_id,
            'canvas_id' => $canvas_id,
            'edit_url' => admin_url('post.php?post=' . (int) $canvas_id . '&action=edit'),
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    private static function get_workspace_templates(): array
    {
        $templates = get_option('sd_workspace_templates', []);
        return is_array($templates) ? $templates : [];
    }

    private static function save_workspace_templates(array $templates): void
    {
        update_option('sd_workspace_templates', $templates, false);
    }

    /**
     * AJAX: Save Scanned Widget Selection
     */
    public static function handle_save_widget_selection(): void
    {
        self::verify_request();

        global $wpdb;

        $widgets = $_POST['widgets'] ?? [];
        if (!is_array($widgets)) {
            wp_send_json_error(['message' => 'Invalid widget data.']);
        }

        $table = $wpdb->prefix . 'sd_discovered_widgets';
        $count = 0;

        foreach ($widgets as $widget) {
            $raw_id = sanitize_text_field((string) ($widget['id'] ?? ''));
            // Scanner rows may use canonical IDs (dashboard.foo / discovered.foo).
            // Persist source widget ID only.
            if (str_starts_with($raw_id, 'dashboard.')) {
                $raw_id = substr($raw_id, strlen('dashboard.'));
            } elseif (str_starts_with($raw_id, 'discovered.')) {
                $raw_id = substr($raw_id, strlen('discovered.'));
            }

            $id = sanitize_key($raw_id);
            $title = sanitize_text_field($widget['title'] ?? '');

            if (!$id || !$title)
                continue;

            $wpdb->query($wpdb->prepare(
                "INSERT INTO $table (widget_id, title, origin)
                 VALUES (%s, %s, %s)
                 ON DUPLICATE KEY UPDATE title = VALUES(title)",
                $id,
                $title,
                'deep_scan'
            ));
            $count++;
        }

        wp_send_json_success(['count' => $count]);
    }

    /**
     * AJAX: Save Global Registry Enablement
     */
    public static function handle_save_registry_state(): void
    {
        self::verify_request();

        $user_id = get_current_user_id();
        $enablement = $_POST['enablement'] ?? [];

        if (!is_array($enablement)) {
            wp_send_json_error(['message' => 'Invalid enablement data.']);
        }

        // Sanitize IDs (Preserve dots for canonical IDs)
        $clean = array_map('sanitize_text_field', $enablement);

        $clean = array_values(array_unique($clean));

        update_user_meta($user_id, 'sd_registry_enablement', $clean);

        wp_send_json_success(['message' => 'Registry state saved.']);
    }



    public static function handle_get_access_policy(): void
    {
        self::verify_request();
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized (Permission Denied)', 'code' => 'unauthorized'], 403);
        }

        if (!function_exists('systemdeck_get_access_policy')) {
            wp_send_json_error(['message' => 'Access policy service unavailable.'], 500);
        }

        wp_send_json_success([
            'policy' => systemdeck_get_access_policy(),
        ]);
    }

    public static function handle_save_access_policy(): void
    {
        self::verify_request();
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized (Permission Denied)', 'code' => 'unauthorized'], 403);
        }

        if (!function_exists('systemdeck_sanitize_access_policy')) {
            wp_send_json_error(['message' => 'Access policy service unavailable.'], 500);
        }

        $raw = $_POST['policy'] ?? [];
        if (is_string($raw)) {
            $decoded = json_decode(wp_unslash($raw), true);
            if (is_array($decoded)) {
                $raw = $decoded;
            }
        }
        if (!is_array($raw)) {
            $raw = [];
        }

        $policy = systemdeck_sanitize_access_policy($raw);
        update_option('sd_access_policy', $policy, false);

        wp_send_json_success([
            'message' => 'Access policy saved.',
            'policy' => $policy,
        ]);
    }

    public static function handle_save_user_preferences(): void
    {
        // F-05 FIX: Use centralized verify_request() instead of manual inline auth.
        // This ensures the SystemDeck access policy check (systemdeck_user_can) is enforced.
        self::verify_request('read', true);

        $user_id = get_current_user_id();

        if (isset($_POST['incognito_mode'])) {
            $incognito_mode = sanitize_text_field($_POST['incognito_mode']);
            if ($incognito_mode === 'true') {
                update_user_meta($user_id, 'sd_incognito_mode', 'true');
            } else {
                delete_user_meta($user_id, 'sd_incognito_mode');
            }
        }

        if (isset($_POST['default_dock'])) {
            $allowed = [
                'standard-dock',
                'full-dock',
                'left-dock',
                'right-dock',
                'base-dock',
                'left-base-dock',
                'right-base-dock',
                'min-dock'
            ];
            $default_dock = sanitize_text_field($_POST['default_dock']);
            if (in_array($default_dock, $allowed, true)) {
                update_user_meta($user_id, 'sd_default_dock', $default_dock);
            }
        }

        if (isset($_POST['audio_master_volume'])) {
            $audio_master_volume = (float) $_POST['audio_master_volume'];
            if (!is_finite($audio_master_volume)) {
                $audio_master_volume = 1.0;
            }
            $audio_master_volume = max(0, min(1, $audio_master_volume));
            update_user_meta($user_id, 'sd_audio_master_volume', (string) $audio_master_volume);
        }

        wp_send_json_success(['message' => 'Preferences saved.']);
    }

    /**
     * AJAX: Rebuild the Registry Snapshot (The Mailbox)
     */
    public static function handle_rebuild_registry_snapshot(): void
    {
        self::verify_request();

        if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
            $snapshot = \SystemDeck\Core\Services\RegistryService::build_snapshot();
            $snapshot_widgets = (array) ($snapshot['widgets'] ?? []);
            $snapshot_count = count($snapshot_widgets);

            $scanner_cache_count = 0;
            if (method_exists('\\SystemDeck\\Core\\Services\\RegistryService', 'refresh_discovered_widget_cache')) {
                $scanner_cache_count = (int) \SystemDeck\Core\Services\RegistryService::refresh_discovered_widget_cache();
            }

            $live_dashboard_count = $scanner_cache_count;

            $requested_missing = [];
            $requested_widget_ids = $_POST['requested_widget_ids'] ?? [];
            if (is_array($requested_widget_ids) && !empty($requested_widget_ids)) {
                $present = [];
                foreach ($snapshot_widgets as $wid => $def) {
                    $wid = (string) $wid;
                    if ($wid !== '') {
                        $present[$wid] = true;
                    }
                    $source_id = sanitize_key((string) ($def['source_id'] ?? ''));
                    if ($source_id !== '') {
                        $present['dashboard.' . $source_id] = true;
                        $present['discovered.' . $source_id] = true;
                    }
                }

                foreach ($requested_widget_ids as $candidate) {
                    $candidate = sanitize_text_field((string) $candidate);
                    if ($candidate === '') {
                        continue;
                    }
                    if (!isset($present[$candidate])) {
                        $requested_missing[] = $candidate;
                    }
                }
            }

            wp_send_json_success([
                'message' => 'Registry snapshot + scanner cache rebuilt successfully.',
                'count' => $snapshot_count,
                'snapshot_widget_count' => $snapshot_count,
                'live_dashboard_widget_count' => $live_dashboard_count,
                'scanner_cache_refresh_count' => $scanner_cache_count,
                'requested_missing_ids' => array_values(array_unique($requested_missing)),
            ]);
        }

        wp_send_json_error(['message' => 'RegistryService class missing.']);
    }

    public static function handle_get_discovered_widgets(): void
    {
        self::verify_request();

        // Return scanner feed:
        // 1) discovered/dashboard items already in snapshot
        // 2) live dashboard widgets (unfiltered) for scanner capture
        if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
            $snapshot = \SystemDeck\Core\Services\RegistryService::get_snapshot();
            $discovered = [];
            $seen = [];
            $seen_source = [];

            foreach (($snapshot['widgets'] ?? []) as $id => $w) {
                if (($w['origin'] ?? '') === 'dashboard' || ($w['origin'] ?? '') === 'discovered') {
                    $source_id = '';
                    if (!empty($w['source_id'])) {
                        $source_id = sanitize_key((string) $w['source_id']);
                    } else {
                        $fallback = (string) ($w['id'] ?? '');
                        $source_id = sanitize_key((string) str_replace(['dashboard.', 'discovered.'], '', $fallback));
                    }
                    // Skip malformed legacy discovered rows created from canonical IDs.
                    if (($w['origin'] ?? '') === 'discovered' && str_starts_with($source_id, 'dashboard')) {
                        continue;
                    }
                    if ($source_id !== '' && isset($seen_source[$source_id])) {
                        continue;
                    }

                    $row = [
                        'id' => (string) ($w['id'] ?? ''),
                        'title' => (string) ($w['title'] ?? '')
                    ];
                    $discovered[] = $row;
                    $seen[(string) $row['id']] = true;
                    if ($source_id !== '') {
                        $seen_source[$source_id] = true;
                    }
                }
            }

            // Scanner should be able to capture third-party dashboard widgets
            // even when runtime snapshot allowlist excludes them.
            if (method_exists('\\SystemDeck\\Core\\Services\\RegistryService', 'discover_dashboard_widgets_for_scanner')) {
                $live_dashboard = \SystemDeck\Core\Services\RegistryService::discover_dashboard_widgets_for_scanner();
                foreach ($live_dashboard as $dw) {
                    $raw_id = isset($dw['id']) ? sanitize_key((string) $dw['id']) : '';
                    if ($raw_id === '') {
                        continue;
                    }
                    $canonical_id = 'dashboard.' . $raw_id;
                    if (isset($seen[$canonical_id])) {
                        continue;
                    }
                    if (isset($seen_source[$raw_id])) {
                        continue;
                    }
                    $row = [
                        'id' => $canonical_id,
                        'title' => (string) ($dw['title'] ?? $raw_id),
                    ];
                    $discovered[] = $row;
                    $seen[$canonical_id] = true;
                    $seen_source[$raw_id] = true;
                }
            }

            // Fallback: parse active plugin source for wp_add_dashboard_widget().
            // Generic safety net for plugins that register widgets only in full
            // dashboard page lifecycles and skip registration in AJAX context.
            $plugin_candidate_index = [];
            if (method_exists('\\SystemDeck\\Core\\Services\\RegistryService', 'discover_dashboard_widget_candidates_from_active_plugins')) {
                $plugin_candidates = \SystemDeck\Core\Services\RegistryService::discover_dashboard_widget_candidates_from_active_plugins();
                foreach ($plugin_candidates as $dw) {
                    $raw_id = isset($dw['id']) ? sanitize_key((string) $dw['id']) : '';
                    if ($raw_id === '') {
                        continue;
                    }
                    $plugin_candidate_index[$raw_id] = true;
                    $canonical_id = 'dashboard.' . $raw_id;
                    if (isset($seen[$canonical_id]) || isset($seen_source[$raw_id])) {
                        continue;
                    }
                    $row = [
                        'id' => $canonical_id,
                        'title' => (string) ($dw['title'] ?? $raw_id),
                    ];
                    $discovered[] = $row;
                    $seen[$canonical_id] = true;
                    $seen_source[$raw_id] = true;
                }
            }

            // Settings/meta fallback is useful, but those stores can keep stale IDs
            // after plugin deactivation/removal. Only admit settings candidates
            // when corroborated by currently active plugin-source candidates.
            if (method_exists('\\SystemDeck\\Core\\Services\\RegistryService', 'discover_dashboard_widget_candidates_from_settings')) {
                $candidate_widgets = \SystemDeck\Core\Services\RegistryService::discover_dashboard_widget_candidates_from_settings();
                foreach ($candidate_widgets as $dw) {
                    $raw_id = isset($dw['id']) ? sanitize_key((string) $dw['id']) : '';
                    if ($raw_id === '') {
                        continue;
                    }
                    if (!isset($plugin_candidate_index[$raw_id])) {
                        continue;
                    }
                    $canonical_id = 'dashboard.' . $raw_id;
                    if (isset($seen[$canonical_id]) || isset($seen_source[$raw_id])) {
                        continue;
                    }
                    $row = [
                        'id' => $canonical_id,
                        'title' => (string) ($dw['title'] ?? $raw_id),
                    ];
                    $discovered[] = $row;
                    $seen[$canonical_id] = true;
                    $seen_source[$raw_id] = true;
                }
            }

            wp_send_json_success(['widgets' => $discovered]);
        }

        wp_send_json_error(['message' => 'Registry missing.']);
    }

    /**
     * AJAX: Reset SystemDeck runtime data only (does not touch WooCommerce or non-SystemDeck tables).
     */
    public static function handle_reset_systemdeck(): void
    {
        self::verify_request();

        global $wpdb;
        $user_id = get_current_user_id();
        $table_items = $wpdb->prefix . 'sd_items';
        $table_state = $wpdb->prefix . 'sd_context_state';

        // Capture user workspaces + linked canvas IDs before deleting meta.
        $user_workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($user_workspaces)) {
            $user_workspaces = [];
        }

        $linked_canvas_ids = [];
        $workspace_keys = [];
        foreach ($user_workspaces as $ws) {
            if (!is_array($ws)) {
                continue;
            }

            $workspace_slug = sanitize_key((string) ($ws['id'] ?? ''));
            if ($workspace_slug !== '') {
                $workspace_keys[] = $workspace_slug;
            }

            if (!empty($ws['canvas_id'])) {
                $canvas_id = (int) $ws['canvas_id'];
                if ($canvas_id > 0) {
                    $linked_canvas_ids[] = $canvas_id;
                    $workspace_keys[] = (string) $canvas_id;
                }
            }
        }
        $linked_canvas_ids = array_values(array_unique(array_filter($linked_canvas_ids)));
        $workspace_keys = array_values(array_unique(array_filter($workspace_keys)));

        // Remove only this user's workspace item rows.
        if (!empty($workspace_keys)) {
            $placeholders = implode(',', array_fill(0, count($workspace_keys), '%s'));
            $wpdb->query(
                $wpdb->prepare(
                    "DELETE FROM $table_items WHERE workspace_id IN ($placeholders)",
                    ...$workspace_keys
                )
            );
        }

        // Remove user-scoped context state only.
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM $table_state WHERE user_id = %d",
                $user_id
            )
        );

        // Clear SystemDeck user-scoped state/meta.
        delete_user_meta($user_id, 'sd_workspaces');
        delete_user_meta($user_id, 'sd_registry_enablement');
        delete_user_meta($user_id, 'sd_active_proxy_widgets');
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key LIKE %s",
                $user_id,
                $wpdb->esc_like('sd_workspace_') . '%'
            )
        );

        // Remove only this user's linked canvas posts.
        foreach ($linked_canvas_ids as $canvas_id) {
            wp_delete_post((int) $canvas_id, true);
        }

        // Rebuild baseline for this user only.
        if (class_exists('\\SystemDeck\\Core\\StorageEngine')) {
            \SystemDeck\Core\StorageEngine::create_tables();
        }
        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            \SystemDeck\Core\Services\CanvasRepository::seed_default_canvas((int) $user_id);
        }

        wp_send_json_success(['message' => 'SystemDeck user reset complete.']);
    }

    private static function normalize_widget_width(int $width): int
    {
        if ($width <= 0) {
            return 2;
        }
        // Canonical desktop widget width is 1..6.
        return max(1, min(6, $width));
    }
}
