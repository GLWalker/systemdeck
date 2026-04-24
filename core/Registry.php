<?php
/**
 * SystemDeck Registry (Runtime Reader)
 *
 * PURE READ-ONLY SERVICE
 * - Reads from RegistryService Snapshot
 * - Hydrates Workspaces
 * - No Scanning Allowed
 */
declare(strict_types=1);

namespace SystemDeck\Core;

use SystemDeck\Core\Services\RegistryService;

if (!defined('ABSPATH')) {
    exit;
}

class Registry
{
    private const ALLOWED_VISIBILITY_POLICIES = ['global', 'app_scoped', 'app_root_only', 'hidden'];
    private static ?Registry $instance = null;


    public static function instance(): Registry
    {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Get Snapshot (Delegates to Service)
     */
    public static function get_snapshot(): array
    {
        if (class_exists(RegistryService::class)) {
            return RegistryService::get_snapshot();
        }
        return ['widgets' => []];
    }

    /**
     * Enqueue Assets (Delegates to Service)
     */
    public static function enqueue_widget_assets(string $widget_id): void
    {
        if (class_exists(RegistryService::class)) {
            RegistryService::enqueue_widget_assets($widget_id);
        }
    }

    /**
     * Normalize incoming workspace IDs to the canonical runtime form.
     */
    public static function resolve_workspace_id(string $id): string
    {
        $normalized = sanitize_key($id);
        if ($normalized === '' || $normalized === 'system_main' || $normalized === 'dashboard') {
            return 'default';
        }

        return $normalized;
    }



    /**
     * Dynamic Workspace Lookup (User Meta First)
     */
    public function get_workspace(string $id): ?array
    {
        $user_id = get_current_user_id();
        $target_slug = sanitize_title($id);

        if ($id === 'system')
            return null;

        // 1. Alias Mapping
        if ($target_slug === 'system_main' || $target_slug === 'default' || $target_slug === 'dashboard' || empty($target_slug)) {
            $target_slug = 'default';
        }

        // 2. Fetch User Workspaces
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        // Normalize Default if missing
        if (empty($workspaces) || !is_array($workspaces)) {
            $workspaces = ['default' => ['id' => 'default', 'name' => 'Default']];
        }

        $found_data = null;
        $found_key = null;

        foreach ($workspaces as $key => $data) {
            $is_new = is_array($data) && isset($data['name']);
            $name = $is_new ? $data['name'] : $key;
            $ws_id = $is_new ? ($data['id'] ?? $key) : $key;

            if (sanitize_title($ws_id) === $target_slug || sanitize_title($name) === $target_slug) {
                $found_data = $data;
                $found_key = $key;
                break;
            }
        }

        // 3. Fallback to Default
        if (!$found_data) {
            if ($target_slug === 'default') {
                $found_data = ['id' => 'default', 'name' => 'Default'];
                $found_key = 'default';
            } else {
                return null;
            }
        }

        $is_new = is_array($found_data) && isset($found_data['name']);
        $real_title = $is_new ? $found_data['name'] : $found_key;
        $real_id = $is_new ? ($found_data['id'] ?? $found_key) : $found_key;
        $real_slug = sanitize_title($real_id);

        $context = new Context((int) $user_id, $real_slug);
        $saved_layout = StorageEngine::get('layout', $context);

        if (!$saved_layout) {
            $legacy_slug = sanitize_title($real_title);
            $legacy_context = new Context((int) $user_id, $legacy_slug);
            $saved_layout = StorageEngine::get('layout', $legacy_context);
        }

        if (empty($saved_layout) || !is_array($saved_layout)) {
            $saved_layout = [];
        }

        return [
            'id' => $real_id,
            'title' => $real_title,
            'layout' => $saved_layout,
            'widgets' => is_array($found_data['widgets'] ?? null) ? array_values($found_data['widgets']) : [],
            'is_app_workspace' => !empty($found_data['is_app_workspace']),
            'app_id' => sanitize_key((string) ($found_data['app_id'] ?? '')),
        ];
    }

    /**
     * Centralized Hydration logic (Mailbox Aware)
     */
    public function hydrate_manifest(string $id): array
    {
        $user_id = get_current_user_id();
        $slug = sanitize_title($id);

        // 1. Base Configuration
        $workspace = $this->get_workspace($id);
        if (!$workspace) {
            return [];
        }

        // 2. Fetch User State
        $context = new Context((int) $user_id, $workspace['id']);
        $pins = StorageEngine::get('pins', $context) ?: [];
        $layout = StorageEngine::get('layout', $context);

        // Map layout for fast lookup
        $active_map = [];
        if (is_array($layout)) {
            foreach ($layout as $item) {
                if (!is_array($item)) {
                    continue;
                }

                if (isset($item['type'], $item['id']) && $item['type'] === 'widget') {
                    $active_map[(string) $item['id']] = $item;
                    continue;
                }

                if (($item['type'] ?? '') === 'block_widget_placeholder') {
                    $widget_id = (string) (($item['settings']['widgetId'] ?? ''));
                    if ($widget_id !== '') {
                        $active_map[$widget_id] = $item;
                    }
                }
            }
        }

        // 3. Read The Mailbox (Snapshot)
        $snapshot = self::get_snapshot();
        $definitions = $snapshot['widgets'] ?? [];

        // 4. Registry Enablement Check
        // RC Directive: Allow 'disable all' vs empty default
        $registry_enablement = get_user_meta($user_id, 'sd_registry_enablement', true);
        $show_all = ($registry_enablement === '' || $registry_enablement === false);
        $registry_enablement = is_array($registry_enablement) ? $registry_enablement : [];

        $is_app_workspace = !empty($workspace['is_app_workspace']);
        $workspace_app_id = sanitize_key((string) ($workspace['app_id'] ?? ''));
        $allowlist_lookup = [];
        if ($is_app_workspace && $workspace_app_id !== '' && class_exists('\\SystemDeck\\Core\\AppRuntime')) {
            $allowlist = \SystemDeck\Core\AppRuntime::get_allowlist_widget_ids($workspace_app_id);
            if (!empty($allowlist)) {
                $allowlist_lookup = array_fill_keys($allowlist, true);
            }
        }

        $hydrated_widgets = [];

        foreach ($definitions as $wid => $def) {
            $widget_app_id = sanitize_key((string) ($def['app_id'] ?? ''));
            $visibility_policy = self::normalize_visibility_policy((string) ($def['visibility_policy'] ?? 'global'));

            // Is enabled in registry?
            $is_enabled = $show_all || (is_array($registry_enablement) && in_array($wid, $registry_enablement));

            // Is active in layout?
            $is_active = isset($active_map[$wid]);
            $is_matching_app_workspace = $is_app_workspace && $workspace_app_id !== '' && $workspace_app_id === $widget_app_id;
            $is_allowlisted = !empty($allowlist_lookup[$wid]);
            $is_picker_visible = false;
            $include_in_manifest = true;

            if ($visibility_policy === 'global') {
                $is_picker_visible = $is_enabled;
                $include_in_manifest = $is_enabled || $is_active;
            } elseif ($visibility_policy === 'app_scoped') {
                $is_picker_visible = $is_enabled && $is_matching_app_workspace;
                $include_in_manifest = ($is_enabled && $is_matching_app_workspace) || $is_active;
            } elseif ($visibility_policy === 'app_root_only') {
                $is_picker_visible = false;
                $include_in_manifest =
                    ($is_enabled && $is_matching_app_workspace && ($is_active || $is_allowlisted)) ||
                    $is_active;
            } elseif ($visibility_policy === 'hidden') {
                $is_picker_visible = false;
                $include_in_manifest = $is_active;
            }

            if (!$include_in_manifest) {
                continue;
            }

            $hydrated_widgets[] = [
                'id' => $wid,
                'title' => $def['title'],
                'origin' => $def['origin'],
                'is_active' => $is_active,
                'is_enabled' => $is_enabled,
                'is_picker_visible' => $is_picker_visible,
                'is_app_root' => $visibility_policy === 'app_root_only',
                'is_app_scoped' => $visibility_policy === 'app_scoped',
                'visibility_policy' => $visibility_policy,
                'app_id' => $widget_app_id,
                // Only include layout props if active
                'x' => $is_active ? ($active_map[$wid]['x'] ?? 0) : 0,
                'y' => $is_active ? ($active_map[$wid]['y'] ?? 0) : 0,
                'w' => $is_active ? ($active_map[$wid]['w'] ?? 4) : 4,
                'h' => $is_active ? ($active_map[$wid]['h'] ?? 4) : 4,
            ];
        }

        return [
            'id' => $workspace['id'],
            'title' => $workspace['title'],
            'widgets' => $hydrated_widgets,
            'pins' => $pins
        ];
    }

    private static function normalize_visibility_policy(string $policy): string
    {
        $normalized = sanitize_key($policy);
        if (!in_array($normalized, self::ALLOWED_VISIBILITY_POLICIES, true)) {
            return 'global';
        }
        return $normalized;
    }

    /**
     * Callback renderer for discovered widgets
     */
    public static function render_discovered_widget_callback(array $args): void
    {
        $widget_id = $args['id'] ?? '';

        if (empty($widget_id)) {
            return;
        }

        $real_id = str_replace(['discovered.', 'dashboard.'], '', $widget_id);

        if (class_exists('\\SystemDeck\\Modules\\DashboardTunnel')) {
            \SystemDeck\Modules\DashboardTunnel::render_widget($real_id);
        }
    }
}
