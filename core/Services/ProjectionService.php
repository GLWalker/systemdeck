<?php
/**
 * ProjectionService — Unified workspace projection sync for SystemDeck widgets.
 *
 * Extracted from Notes::sync_pin_projection() and Vault::sync_vault_projection()
 * which are structurally identical — both:
 *   1. Check if scope matches the projected value → remove if not
 *   2. Resolve the effective workspace key through the same storage law used by
 *      layout/pin persistence
 *   3. Read any existing projection position for that effective workspace key
 *   4. Delete + insert into sd_items
 *
 * The differences (widget_prefix, icon, title, settings shape) are parameterized.
 *
 * @package SystemDeck\Core\Services
 */

namespace SystemDeck\Core\Services;

use SystemDeck\Core\Context;
use SystemDeck\Core\StorageEngine;

if (!defined('ABSPATH')) {
    exit;
}

final class ProjectionService
{
    /**
     * Sync a generic pinned item into sd_items for a workspace.
     *
     * Used by contract-governed metric pins so they follow the same workspace
     * audience law as Notes/Vault projections without introducing a second
     * persistence path.
     *
     * @param string               $pin_id        Stable pin/widget identifier.
     * @param string               $workspace_id  Target workspace key.
     * @param array<string,mixed>  $settings      Pin settings payload.
     * @param array<string,int>    $position      Grid position payload.
     */
    public static function sync_pin(
        string $pin_id,
        string $workspace_id,
        array $settings,
        array $position = ['x' => 0, 'y' => 0, 'w' => 1, 'h' => 1]
    ): void {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $pin_id = sanitize_key($pin_id);
        if ($pin_id === '' || $workspace_id === '') {
            return;
        }

        $user_id = (int) get_current_user_id();
        $context = new Context($user_id, $workspace_id);
        $effective_workspace_id = StorageEngine::resolve_item_workspace_key_for_context($context, 'pins');
        if ($effective_workspace_id === '') {
            $effective_workspace_id = $workspace_id;
        }

        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT position FROM $table_items WHERE widget_id = %s AND workspace_id = %s",
            $pin_id,
            $effective_workspace_id
        ));

        $resolved_position = $existing && is_string($existing->position) && $existing->position !== ''
            ? $existing->position
            : wp_json_encode([
                'x' => (int) ($position['x'] ?? 0),
                'y' => (int) ($position['y'] ?? 0),
                'w' => (int) ($position['w'] ?? 1),
                'h' => (int) ($position['h'] ?? 1),
            ]);

        $settings_json = wp_json_encode($settings);

        $wpdb->delete(
            $table_items,
            [
                'widget_id' => $pin_id,
                'workspace_id' => $effective_workspace_id,
            ],
            ['%s', '%s']
        );

        $wpdb->insert(
            $table_items,
            [
                'workspace_id' => $effective_workspace_id,
                'widget_id' => $pin_id,
                'settings' => $settings_json,
                'position' => $resolved_position,
                'is_pinned' => 1,
                'item_order' => 0,
            ],
            ['%s', '%s', '%s', '%s', '%d', '%d']
        );
    }

    /**
     * Sync a projection into sd_items for a workspace.
     *
     * If scope does not match $projected_val or workspace_id is empty, any
     * existing projection is removed. Otherwise the projection is upserted.
     *
     * @param int    $object_id      Post ID being projected.
     * @param string $scope          Current scope value (e.g. 'pinned', 'shared', 'private').
     * @param string $workspace_id   Target workspace key (empty = remove).
     * @param string $widget_prefix  Prefix for widget_id (e.g. 'note', 'vault'). Final ID = "{prefix}.{object_id}".
     * @param array  $settings       Settings payload for sd_items.settings JSON column.
     * @param string $projected_val  Scope value that triggers projection (e.g. 'pinned' for Notes, 'shared' for Vault).
     */
    public static function sync(
        int $object_id,
        string $scope,
        string $workspace_id,
        string $widget_prefix,
        array $settings,
        string $projected_val
    ): void {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $widget_id   = $widget_prefix . '.' . $object_id;

        // Not projected: remove any existing projection and return.
        if ($scope !== $projected_val || empty($workspace_id)) {
            $wpdb->delete($table_items, ['widget_id' => $widget_id], ['%s']);
            return;
        }

        // Resolve the effective workspace key using the same persistence law as
        // layout/pin storage. Shared owner-only workspaces stay user-local for
        // non-owner projections; collaborative workspaces remain workspace-wide.
        $user_id = (int) get_current_user_id();
        $context = new Context($user_id, $workspace_id);
        $effective_workspace_id = StorageEngine::resolve_item_workspace_key_for_context($context, 'pins');
        if ($effective_workspace_id === '') {
            $effective_workspace_id = $workspace_id;
        }

        // Read existing projection.
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT position, workspace_id FROM $table_items WHERE widget_id = %s AND workspace_id = %s",
            $widget_id,
            $effective_workspace_id
        ));

        $existing_pos = $existing ? $existing->position : null;

        $position = $existing_pos ?: json_encode(['x' => 0, 'y' => 0, 'w' => 1, 'h' => 8]);

        // Settings must be a JSON string.
        $settings_json = is_string($settings) ? $settings : json_encode($settings);

        // Hard-delete any stale projections, then insert cleanly.
        $wpdb->delete($table_items, ['widget_id' => $widget_id], ['%s']);

        error_log('[PROJECTION] creating pin for object ' . $object_id);

        $wpdb->insert(
            $table_items,
            [
                'workspace_id' => $effective_workspace_id,
                'widget_id'    => $widget_id,
                'settings'     => $settings_json,
                'position'     => $position,
                'is_pinned'    => 1,
                'item_order'   => 0,
            ],
            ['%s', '%s', '%s', '%s', '%d', '%d']
        );
    }

    /**
     * Remove all projections for an object.
     *
     * @param int    $object_id     Post ID.
     * @param string $widget_prefix Prefix (e.g. 'note', 'vault').
     */
    public static function remove(int $object_id, string $widget_prefix): void
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $widget_id   = $widget_prefix . '.' . $object_id;
        $wpdb->delete($table_items, ['widget_id' => $widget_id], ['%s']);
    }

    /**
     * Remove all projections for a workspace, optionally filtered by widget prefix.
     *
     * @param string $workspace_id         Workspace to purge.
     * @param string $widget_prefix_pattern Optional LIKE pattern (e.g. 'note.%'). Empty = all.
     */
    public static function purge_workspace(string $workspace_id, string $widget_prefix_pattern = ''): void
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';

        if ($widget_prefix_pattern !== '') {
            $wpdb->query($wpdb->prepare(
                "DELETE FROM $table_items WHERE workspace_id = %s AND widget_id LIKE %s",
                $workspace_id,
                $widget_prefix_pattern
            ));
        } else {
            $wpdb->delete($table_items, ['workspace_id' => $workspace_id], ['%s']);
        }
    }

    /**
     * Delete orphaned sd_items where the underlying CPT post has been trashed/deleted.
     * Extracts the core ID using SUBSTRING_INDEX from the 'widget_id' format (e.g. 'note.455').
     *
     * @return int Number of orphaned records purged.
     */
    public static function sweep_orphaned_projections(): int
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        
        $sql = "
            DELETE items FROM {$table_items} items
            LEFT JOIN {$wpdb->posts} p 
                   ON p.ID = CAST(SUBSTRING_INDEX(items.widget_id, '.', -1) AS UNSIGNED)
            WHERE (items.widget_id LIKE 'note.%' OR items.widget_id LIKE 'vault.%')
              AND p.ID IS NULL
        ";

        $deleted_cells = $wpdb->query($sql);
        return is_numeric($deleted_cells) ? (int) $deleted_cells : 0;
    }
}
