<?php
/**
 * SystemDeck - ModuleBootstrap
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Services/ModuleBootstrap.php
 * @license GPL-2.0-or-later
 *
 * Module Bootstrapping Service (Early Initialization)
 */
namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * ModuleBootstrap
 * Handles early registration of core-integrated modules (Notes, Vault)
 * to ensure CPTs and hooks are available at the start of the WordPress lifecycle.
 * CPT registration: init:0 via ModuleBootstrap
 * Widget asset loading: widget assets() / runtime loader
 * Widget UI output: widget output()
 * AJAX/admin/meta/lifecycle hooks: ModuleBootstrap only, unless truly local and non-global
 */
class ModuleBootstrap
{
    private static bool $has_run = false;

    public static function run(): void
    {
        if (self::$has_run) {
            return;
        }
        self::$has_run = true;
        // 1. Notes Module Bootstrapping
        if (file_exists(SYSTEMDECK_PATH . 'widgets/notes/widget.php')) {
            require_once SYSTEMDECK_PATH . 'widgets/notes/widget.php';

            // Register CPT at the earliest possible init priority
            add_action('init', [\SystemDeck\Widgets\Notes::class, 'register_cpt'], 0);

            // Admin UI & Meta Hooks
            add_filter('manage_sd_note_posts_columns', [\SystemDeck\Widgets\Notes::class, 'manage_admin_columns']);
            add_action('manage_sd_note_posts_custom_column', [\SystemDeck\Widgets\Notes::class, 'render_admin_columns'], 10, 2);
            add_action('add_meta_boxes', [\SystemDeck\Widgets\Notes::class, 'add_meta_boxes']);
            add_action('save_post_sd_note', [\SystemDeck\Widgets\Notes::class, 'save_meta_boxes']);

            // Lifecycle Hooks
            add_action('systemdeck_purge_workspace', [\SystemDeck\Widgets\Notes::class, 'handle_workspace_purge']);
            add_action('before_delete_post', [\SystemDeck\Widgets\Notes::class, 'handle_workspace_deletion']);

            // AJAX Handlers
            add_action('wp_ajax_sd_get_notes', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_get_notes']);
            add_action('wp_ajax_sd_save_note', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_save_note']);
            add_action('wp_ajax_sd_delete_note', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_delete_note']);
            add_action('wp_ajax_sd_toggle_note_sticky', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_toggle_note_sticky']);
            add_action('wp_ajax_sd_get_read_note', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_get_read_note']);
            add_action('wp_ajax_sd_get_note_comments', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_get_note_comments']);
            add_action('wp_ajax_sd_add_note_comment', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_add_note_comment']);
            add_action('wp_ajax_sd_save_note_tasks', [\SystemDeck\Widgets\Notes::class, 'handle_ajax_save_note_tasks']);

            // Dashboard & Admin Cleanup
            add_filter('dashboard_recent_comments_query_args', [\SystemDeck\Widgets\Notes::class, 'exclude_from_recent_comments']);
            add_filter('comments_clauses', [\SystemDeck\Widgets\Notes::class, 'exclude_from_admin_sql']);
        }

        // 2. Vault Module Bootstrapping
        if (file_exists(SYSTEMDECK_PATH . 'widgets/vault/widget.php')) {
            require_once SYSTEMDECK_PATH . 'widgets/vault/widget.php';

            // Register CPT and internal security handlers at priority 0
            add_action('init', [\SystemDeck\Widgets\Vault::class, 'register_vault'], 0);

            // Admin UI & Meta Hooks
            add_filter('manage_sd_vault_file_posts_columns', [\SystemDeck\Widgets\Vault::class, 'manage_admin_columns']);
            add_action('manage_sd_vault_file_posts_custom_column', [\SystemDeck\Widgets\Vault::class, 'render_admin_columns'], 10, 2);
            add_action('add_meta_boxes', [\SystemDeck\Widgets\Vault::class, 'add_meta_boxes']);
            add_action('save_post_sd_vault_file', [\SystemDeck\Widgets\Vault::class, 'save_meta_boxes']);

            // AJAX Handlers
            \SystemDeck\Widgets\Vault::register_ajax_hooks();

            // Dashboard & Admin Cleanup
            add_filter('dashboard_recent_comments_query_args', [\SystemDeck\Widgets\Vault::class, 'exclude_from_recent_comments']);
            add_filter('comments_clauses', [\SystemDeck\Widgets\Vault::class, 'exclude_from_admin_sql']);
        }

        // Global Comment Auto-Approval for internal post types
        // Registered before systemdeck_bootstrap to allow overrides.
        add_filter('pre_comment_approved', [static::class, 'auto_approve_internal_comments'], 10, 2);

        /**
         * Allow third-party modules or extensions to bootstrap early.
         * Useful for registering CPTs that need to be available at init:0.
         *
         * Example:
         * add_action('systemdeck_bootstrap', function() {
         *     register_post_type('third_party_cpt', [...]);
         * });
         */
        do_action('systemdeck_bootstrap');
    }

    /**
     * Automatically approves comments for SystemDeck internal post types (Notes, Vault)
     * to bypass site-wide moderation settings for internal workspace communication.
     */
    public static function auto_approve_internal_comments($approved, $commentdata): int|string
    {
        if (!is_array($commentdata)) {
            return $approved;
        }

        $post_id = absint($commentdata['comment_post_ID'] ?? 0);
        if (!$post_id) {
            return $approved;
        }

        $post_type = get_post_type($post_id);
        if (in_array($post_type, ['sd_note', 'sd_vault_file'], true)) {
            return 1; // Force 'approved' status
        }

        return $approved;
    }
}
