<?php
/**
 * SystemDeck StorageEngine
 * Core controller for high-performance state persistence.
 * Status: PATCHED (Fixes Data Loss Bug)
 */

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class StorageEngine
{
    private static array $write_buffer = [];

    /**
     * Save data based on intent and context.
     */
    public static function save(string $key, array $data, Context $context): bool
    {
        $intent = self::resolve_intent($key);

        if ($intent === 'workspace') {
            return self::persist_workspace($data, $context);
        }

        if ($intent === 'state' || $intent === 'telemetry') {
            return self::buffer_write($key, $data, $context);
        }

        return self::persist($intent, $key, $data, $context);
    }

    /**
     * Get data based on intent and context.
     */
    public static function get(string $key, Context $context)
    {
        $intent = self::resolve_intent($key);

        $buffered = self::buffer_read($key, $context);
        if ($buffered !== null) {
            return $buffered;
        }

        if ($intent === 'items') {
            return self::fetch_items($key, $context);
        }

        return self::fetch_cascading($intent, $key, $context);
    }

    /**
     * Fetch items with strict filtering.
     * Fix: Ensures 'layout' only returns unpinned widgets, and 'pins' only returns pinned ones.
     */
    private static function fetch_items(string $key, Context $context): ?array
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $workspace_key = self::resolve_items_workspace_key($context, $key);
        if ($workspace_key === '') {
            return null;
        }

        // Strict Filtering
        $where = '';
        if ($key === 'pins') {
            $where = ' AND is_pinned = 1';
        } elseif ($key === 'layout') {
            $where = ' AND is_pinned = 0';
        }

        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT widget_id as id, settings, position, is_pinned, item_order FROM $table_items WHERE workspace_id = %s $where ORDER BY item_order ASC",
            $workspace_key
        ), ARRAY_A);

        if (empty($results)) {
            return null;
        }

        return array_map(function ($item) {
            $item['settings'] = json_decode($item['settings'], true) ?: [];
            $pos = json_decode($item['position'], true) ?: [];
            $item['is_pinned'] = (bool) $item['is_pinned'];
            $item['type'] = $item['is_pinned'] ? ($item['settings']['type'] ?? 'pin') : 'widget';
            $item['order'] = (int) $item['item_order'];

            // Flatten position into top-level for unified API
            $item['x'] = (int) ($pos['x'] ?? 0);
            $item['y'] = (int) ($pos['y'] ?? 0);
            $item['w'] = (int) ($pos['w'] ?? 4);
            $item['h'] = (int) ($pos['h'] ?? 4);
            unset($item['position']);

            return $item;
        }, $results);
    }

    public static function get_discovered_widgets(): array
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_discovered_widgets';
        // Activation safety: table may not exist yet on first pass.
        $exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
        if ($exists !== $table) {
            return [];
        }
        return $wpdb->get_results("SELECT widget_id as id, title, origin FROM $table", ARRAY_A) ?: [];
    }

    private static function resolve_intent(string $key): string
    {
        if ($key === 'workspace') {
            return 'workspace';
        }
        if (in_array($key, ['layout', 'items', 'pins'])) {
            return 'items';
        }
        if (str_starts_with($key, 'pref_')) {
            return 'pref';
        }
        if ($key === 'telemetry') {
            return 'telemetry';
        }
        return 'state';
    }

    private static function buffer_write(string $key, array $data, Context $context): bool
    {
        $sig = $context->get_signature() . '_' . $key;
        self::$write_buffer[$sig] = ['context' => $context, 'key' => $key, 'data' => $data];
        return set_transient('sd_buffer_' . $sig, $data, 30);
    }

    private static function buffer_read(string $key, Context $context)
    {
        $sig = $context->get_signature() . '_' . $key;
        if (isset(self::$write_buffer[$sig]))
            return self::$write_buffer[$sig]['data'];
        return get_transient('sd_buffer_' . $sig) ?: null;
    }

    private static function persist(string $intent, string $key, array $data, Context $context): bool
    {
        global $wpdb;

        if ($intent === 'pref') {
            return (bool) update_user_meta($context->user_id, 'sd_' . $key, $data);
        }

        // FIX: Pass $key to persist_items to enable targeted deletion
        if ($intent === 'items') {
            return self::persist_items($key, $data, $context);
        }

        if ($intent === 'state' || $intent === 'telemetry') {
            return self::persist_state($key, $data, $context);
        }

        return false;
    }

    /**
     * Atomic Workspace Persistence (RC Directive Phase 3)
     * Saves the entire workspace object (layout, allow_list, meta) to user meta.
     */
    private static function persist_workspace(array $data, Context $context): bool
    {
        $user_id = $context->user_id;
        $ws_id = $data['id'] ?? $context->workspace_id;
        $meta_key = 'sd_workspace_' . sanitize_title($ws_id);

        return (bool) update_user_meta($user_id, $meta_key, $data);
    }

    private static function persist_state(string $key, array $data, Context $context): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_context_state';

        if ($key === 'telemetry') {
            $column = 'telemetry_snapshot';
            $json_data = json_encode($data);
        } else {
            $column = 'active_overlay_state';
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT active_overlay_state FROM $table
                 WHERE user_id = %d AND workspace_id = %s AND context_type = %s AND context_id = %s AND viewport = %s",
                $context->user_id,
                $context->workspace_id,
                $context->context_type,
                $context->context_id,
                $context->viewport
            ));
            $state = $existing ? json_decode($existing, true) : [];
            $state[$key] = $data;
            $json_data = json_encode($state);
        }

        return (bool) $wpdb->query($wpdb->prepare(
            "INSERT INTO $table (user_id, workspace_id, context_type, context_id, viewport, $column)
             VALUES (%d, %s, %s, %s, %s, %s)
             ON DUPLICATE KEY UPDATE $column = VALUES($column), updated_at = CURRENT_TIMESTAMP",
            $context->user_id,
            $context->workspace_id,
            $context->context_type,
            $context->context_id,
            $context->viewport,
            $json_data
        ));
    }

    /**
     * Persist Items with Smart Deletion (Fixes Data Loss)
     */
    private static function persist_items(string $key, array $items, Context $context): bool
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $workspace_key = self::resolve_items_workspace_key($context, $key);
        if ($workspace_key === '') {
            return false;
        }

        // FIX: Only delete the items we are about to replace
        $delete_where = ['workspace_id' => $workspace_key];
        $delete_format = ['%s'];

        if ($key === 'pins') {
            $delete_where['is_pinned'] = 1;
            $delete_format[] = '%d';
        } elseif ($key === 'layout') {
            $delete_where['is_pinned'] = 0;
            $delete_format[] = '%d';
        }
        // If key is 'items', we might mean "everything", so we leave filters off (dangerous but flexible)

        $wpdb->delete($table_items, $delete_where, $delete_format);

        // Dedup and Insert new items
        $processed_ids = [];
        $order = 0;
        foreach ($items as $item) {
            $wid = $item['id'] ?? '';
            if (!$wid || in_array($wid, $processed_ids))
                continue;
            $processed_ids[] = $wid;

            $is_pinned = (int) ($item['is_pinned'] ?? ($key === 'pins' ? 1 : 0));

            $wpdb->query($wpdb->prepare(
                "INSERT INTO $table_items (workspace_id, widget_id, settings, position, is_pinned, item_order)
                 VALUES (%s, %s, %s, %s, %d, %d)
                 ON DUPLICATE KEY UPDATE settings = VALUES(settings), position = VALUES(position), is_pinned = VALUES(is_pinned), item_order = VALUES(item_order)",
                $workspace_key,
                $wid,
                json_encode($item['settings'] ?? []),
                json_encode([
                    'x' => (int) ($item['x'] ?? 0),
                    'y' => (int) ($item['y'] ?? 0),
                    'w' => (int) ($item['w'] ?? 4),
                    'h' => (int) ($item['h'] ?? 4),
                ]),
                $is_pinned,
                $order++
            ));
        }

        return true;
    }

    private static function fetch_cascading(string $intent, string $key, Context $context)
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_context_state';
        $column = ($key === 'telemetry') ? 'telemetry_snapshot' : 'active_overlay_state';

        $hierarchy = [
            ['type' => 'post', 'id' => (string) get_the_ID()],
            ['type' => 'template', 'id' => self::detect_template_context()],
            ['type' => 'global', 'id' => 'global']
        ];

        foreach ($hierarchy as $layer) {
            $row = $wpdb->get_var($wpdb->prepare(
                "SELECT $column FROM $table
                 WHERE user_id = %d AND workspace_id = %s AND context_type = %s AND context_id = %s AND viewport IN (%s, 'all')
                 ORDER BY (viewport = %s) DESC, updated_at DESC LIMIT 1",
                $context->user_id,
                $context->workspace_id,
                $layer['type'],
                $layer['id'],
                $context->viewport,
                $context->viewport
            ));

            if ($row)
                return json_decode($row, true);
        }
        return null;
    }

    private static function detect_template_context(): string
    {
        if (is_front_page())
            return 'front-page';
        if (is_single())
            return 'single-' . get_post_type();
        if (is_page())
            return 'page';
        if (is_archive())
            return 'archive';
        if (is_search())
            return 'search';
        return 'default-template';
    }

    public static function flush(): void
    {
        if (empty(self::$write_buffer))
            return;
        foreach (self::$write_buffer as $sig => $buffer) {
            self::persist(self::resolve_intent($buffer['key']), $buffer['key'], $buffer['data'], $buffer['context']);
            delete_transient('sd_buffer_' . $sig);
        }
        self::$write_buffer = [];
    }

    public static function init(): void
    {
        global $wpdb;
        add_action('shutdown', [self::class, 'flush']);

        // Ensure Schema Parity (Manual Migration for item_order)
        $table_items = $wpdb->prefix . 'sd_items';
        $column = $wpdb->get_results($wpdb->prepare("SHOW COLUMNS FROM $table_items LIKE %s", 'item_order'));
        if (empty($column)) {
            $wpdb->query("ALTER TABLE $table_items ADD COLUMN item_order int(11) DEFAULT 0 NOT NULL");
        }
        self::migrate_items_workspace_column();
        self::migrate_legacy_workspace_item_keys();

        $current_version = get_option('sd_db_version', '0');
        if (version_compare($current_version, SYSTEMDECK_VERSION, '<')) { // Changed SD_VERSION to SYSTEMDECK_VERSION constant in new plugin
            self::create_tables();
            update_option('sd_db_version', SYSTEMDECK_VERSION);
        }
    }

    public static function create_tables(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset_collate = $wpdb->get_charset_collate();

        $table_items = $wpdb->prefix . 'sd_items';
        $sql_items = "CREATE TABLE $table_items (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            workspace_id varchar(191) NOT NULL,
            widget_id varchar(100) NOT NULL,
            settings longtext NOT NULL,
            position longtext NOT NULL,
            is_pinned tinyint(1) DEFAULT 0 NOT NULL,
            item_order int(11) DEFAULT 0 NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY ws_widget (workspace_id, widget_id),
            KEY workspace_id (workspace_id)
        ) $charset_collate;";

        $table_state = $wpdb->prefix . 'sd_context_state';
        $sql_state = "CREATE TABLE $table_state (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            workspace_id varchar(100) NOT NULL,
            context_type varchar(50) NOT NULL,
            context_id varchar(100) NOT NULL,
            viewport varchar(50) NOT NULL,
            active_overlay_state longtext,
            telemetry_snapshot longtext,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY context_signature (user_id, workspace_id, context_type, context_id, viewport)
        ) $charset_collate;";

        $table_discovered = $wpdb->prefix . 'sd_discovered_widgets';
        $sql_discovered = "CREATE TABLE $table_discovered (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            widget_id varchar(100) NOT NULL,
            title varchar(255) NOT NULL,
            origin varchar(50) DEFAULT 'deep_scan' NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY widget_id (widget_id)
        ) $charset_collate;";

        dbDelta($sql_items);
        dbDelta($sql_state);
        dbDelta($sql_discovered);
    }

    private static function migrate_items_workspace_column(): void
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';
        $column = $wpdb->get_row($wpdb->prepare("SHOW COLUMNS FROM $table_items LIKE %s", 'workspace_id'), ARRAY_A);
        if (!is_array($column)) {
            return;
        }

        $type = strtolower((string) ($column['Type'] ?? ''));
        if (str_starts_with($type, 'varchar(')) {
            return;
        }

        $wpdb->query("ALTER TABLE $table_items MODIFY workspace_id varchar(191) NOT NULL");
    }

    private static function resolve_items_workspace_key(Context $context, string $key = 'items'): string
    {
        $workspace_id = sanitize_key($context->workspace_id);
        if ($workspace_id === '') {
            return '';
        }

        // Shared non-owner overlays must remain user-local for layout/items.
        // Pins in collaborative workspaces remain canonical (shared surface).
        // Pins in owner-only workspaces follow the same user-local rule as layouts.
        if (function_exists('systemdeck_get_canvas_post_by_workspace')) {
            $canvas_post = systemdeck_get_canvas_post_by_workspace($workspace_id);
            if ($canvas_post instanceof \WP_Post) {
                $owner_id = (int) $canvas_post->post_author;
                $user_id = (int) $context->user_id;
                $is_public = (bool) get_post_meta($canvas_post->ID, \SystemDeck\Core\Services\CanvasRepository::META_PUBLIC, true);
                $collaboration_mode = \SystemDeck\Core\Services\CanvasRepository::normalize_collaboration_mode(
                    (string) get_post_meta($canvas_post->ID, \SystemDeck\Core\Services\CanvasRepository::META_COLLABORATION_MODE, true)
                );
                if (
                    $is_public
                    && $collaboration_mode !== 'collaborative'
                    && $owner_id > 0
                    && $user_id > 0
                    && $owner_id !== $user_id
                ) {
                    return sprintf('u%d_ws_%s', $user_id, $workspace_id);
                }
            }
        }

        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_id, (int) $context->user_id);
            $canvas_id = (int) ($canvas['id'] ?? 0);
            if ($canvas_id > 0) {
                return (string) $canvas_id;
            }
        }

        return $workspace_id;
    }

    /**
     * Public resolver for item workspace keys.
     *
     * Projection and other infrastructure-level item writers must use the same
     * workspace-key law as layout and pin persistence.
     */
    public static function resolve_item_workspace_key_for_context(Context $context, string $key = 'items'): string
    {
        return self::resolve_items_workspace_key($context, $key);
    }

    private static function migrate_legacy_workspace_item_keys(): void
    {
        global $wpdb;

        $migration_version = get_option('sd_items_workspace_key_migration_version', '0');
        if (version_compare($migration_version, SYSTEMDECK_VERSION, '>=')) {
            return;
        }

        $table_items = $wpdb->prefix . 'sd_items';
        $table_workspaces = $wpdb->prefix . 'sd_workspaces';
        $has_legacy = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_workspaces));
        if ($has_legacy !== $table_workspaces) {
            update_option('sd_items_workspace_key_migration_version', SYSTEMDECK_VERSION, false);
            return;
        }

        $rows = $wpdb->get_results(
            "SELECT i.id AS item_row_id, w.slug AS workspace_slug, w.user_id AS owner_user_id
             FROM {$table_items} i
             INNER JOIN {$table_workspaces} w ON w.id = i.workspace_id",
            ARRAY_A
        );

        if (empty($rows)) {
            update_option('sd_items_workspace_key_migration_version', SYSTEMDECK_VERSION, false);
            return;
        }

        foreach ($rows as $row) {
            $workspace_slug = sanitize_key((string) ($row['workspace_slug'] ?? ''));
            $owner_user_id = (int) ($row['owner_user_id'] ?? 0);
            $item_row_id = (int) ($row['item_row_id'] ?? 0);
            if ($workspace_slug === '' || $item_row_id <= 0) {
                continue;
            }

            $new_workspace_key = $workspace_slug;
            if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository') && $owner_user_id > 0) {
                $canvas = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace($workspace_slug, $owner_user_id);
                $canvas_id = (int) ($canvas['id'] ?? 0);
                if ($canvas_id > 0) {
                    $new_workspace_key = (string) $canvas_id;
                }
            }

            $wpdb->update(
                $table_items,
                ['workspace_id' => $new_workspace_key],
                ['id' => $item_row_id],
                ['%s'],
                ['%d']
            );
        }

        update_option('sd_items_workspace_key_migration_version', SYSTEMDECK_VERSION, false);
    }
}
