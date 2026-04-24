<?php

/**
 * Plugin Name: SystemDeck
 * Plugin URI:  https://systemdeck.dev
 * Description: High-performance runtime shell for WordPress. Connects wp-admin to a unified React workspace.
 * Version:     3.3.1
 * Author:      SystemDeck
 * Text Domain: systemdeck
 * Domain Path: /languages
 * License:     GPL-2.0-or-later
 * Requires PHP: 8.0
 */

defined('ABSPATH') || exit;

// Constants
define('SYSTEMDECK_VERSION', '3.3.1');
define('SYSTEMDECK_MIN_WP', '6.7');
define('SYSTEMDECK_MIN_PHP', '8.0');
define('SYSTEMDECK_PATH', plugin_dir_path(__FILE__));
define('SYSTEMDECK_URL', plugin_dir_url(__FILE__));

if (!defined('SYSTEMDECK_HYDRATION_DIAGNOSTICS_ENABLED')) {
    define('SYSTEMDECK_HYDRATION_DIAGNOSTICS_ENABLED', false);
}

if (file_exists(SYSTEMDECK_PATH . 'core/Autoloader.php')) {
    require_once SYSTEMDECK_PATH . 'core/Autoloader.php';
    \SystemDeck\Core\Autoloader::register();
}


if (defined('WP_CLI') && WP_CLI && file_exists(SYSTEMDECK_PATH . 'devtools/cli-registry.php')) {
    require_once SYSTEMDECK_PATH . 'devtools/cli-registry.php';
}

// SAFETY CHECKS

if (version_compare(PHP_VERSION, SYSTEMDECK_MIN_PHP, '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__('SystemDeck requires PHP 8.0 or higher.', 'systemdeck');
        echo '</p></div>';
    });
    return;
}

if (version_compare(get_bloginfo('version'), SYSTEMDECK_MIN_WP, '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__('SystemDeck requires WordPress 6.7 or higher.', 'systemdeck');
        echo '</p></div>';
    });
    return;
}

add_action('admin_head', function () {
    if (!class_exists('\SystemDeck\Core\Schema')) {
        return;
    }

    echo \SystemDeck\Core\Schema::to_style_tag('fresh');
});

/**
 * PHASE 1: INFRASTRUCTURE (Universal / Always On)
 * Hooked early to 'init' to ensure routes are registered before permission gates.
 * This fixes the "too early" translation error while keeping registration un-gated.
 */
add_action('init', 'systemdeck_register_infrastructure', 5);

function systemdeck_load_app_provider_modules(): void
{
    $widgets_dir = SYSTEMDECK_PATH . 'widgets/';
    if (is_dir($widgets_dir)) {
        $provider_files = glob($widgets_dir . '*/widget.php');
        if (is_array($provider_files)) {
            foreach ($provider_files as $provider_file) {
                if (is_string($provider_file) && file_exists($provider_file)) {
                    require_once $provider_file;
                }
            }
        }
    }

    /**
     * Allow external providers to load their app modules before AJAX/actions init.
     */
    do_action('systemdeck_load_app_providers');
}

function systemdeck_register_infrastructure(): void
{
    // Ensure app/widget modules with external AJAX hooks are loaded before AjaxHandler::init().
    systemdeck_load_app_provider_modules();

    // Canvas Repository (V3 Alpha Step 1: CPT registration)
    if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
        \SystemDeck\Core\Services\CanvasRepository::init();
    }

    // Block Contract (V3 Alpha)
    if (class_exists('\\SystemDeck\\Core\\Blocks\\WidgetPlaceholderBlock')) {
        \SystemDeck\Core\Blocks\WidgetPlaceholderBlock::init();
    }
    if (class_exists('\\SystemDeck\\Core\\Blocks\\CanvasGridBlock')) {
        \SystemDeck\Core\Blocks\CanvasGridBlock::init();
    }

    // AJAX Handler (Core Gateway)
    if (class_exists('\\SystemDeck\\Core\\AjaxHandler')) {
        \SystemDeck\Core\AjaxHandler::init();
    }

    if (class_exists('\\SystemDeck\\Core\\Rest\\WidgetPreviewRoute')) {
        \SystemDeck\Core\Rest\WidgetPreviewRoute::init();
    }

    // Dashboard Tunnel (Widget iframes)
    if (class_exists('\\SystemDeck\\Modules\\DashboardTunnel')) {
        \SystemDeck\Modules\DashboardTunnel::init();
    }

    // System Screen (Command Center)
    if (class_exists('\\SystemDeck\\Modules\\SystemScreen')) {
        \SystemDeck\Modules\SystemScreen::init();
    }

    // HUD Atlas Admin Page
    if (class_exists('\\SystemDeck\\Modules\\HudAtlasPage')) {
        \SystemDeck\Modules\HudAtlasPage::init();
    }

    // Assets Engine (Color Tokens)
    if (class_exists('\\SystemDeck\\Core\\Assets')) {
        \SystemDeck\Core\Assets::init();
    }

    if (class_exists('\\SystemDeck\\Core\\Logo')) {
        \SystemDeck\Core\Logo::init();
    }

    if (class_exists('\\SystemDeck\\Core\\StorageEngine')) {
        \SystemDeck\Core\StorageEngine::init();
    }

    // RC Directive Phase 2: Check if Registry Snapshot needs refresh
    do_action('system_deck_init');
    // Note: RegistryService::get_snapshot() handles refresh internally on read
    if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
        \SystemDeck\Core\Services\RegistryService::get_snapshot();
    } elseif (class_exists('\\SystemDeck\\Core\\Registry')) {
        \SystemDeck\Core\Registry::get_snapshot();
    }

    // Deterministic widget preloading from snapshot
    if (class_exists('\\SystemDeck\\Core\\CanvasEngine')) {
        \SystemDeck\Core\CanvasEngine::init();
    }

}

function systemdeck_rebuild_snapshot_now(): void
{
    if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
        \SystemDeck\Core\Services\RegistryService::build_snapshot();
        if (method_exists('\\SystemDeck\\Core\\Services\\RegistryService', 'refresh_discovered_widget_cache')) {
            \SystemDeck\Core\Services\RegistryService::refresh_discovered_widget_cache();
        }
    }
}

function systemdeck_schedule_snapshot_rebuild(): void
{
    update_option('sd_registry_rebuild_needed', 1, false);
}

function systemdeck_maybe_run_scheduled_snapshot_rebuild(): void
{
    $needs = (int) get_option('sd_registry_rebuild_needed', 0);
    if ($needs !== 1) {
        return;
    }
    delete_option('sd_registry_rebuild_needed');
    systemdeck_rebuild_snapshot_now();
}

function systemdeck_rebuild_snapshot_on_change($plugin = '', $network_wide = false): void
{
    systemdeck_schedule_snapshot_rebuild();
}

function systemdeck_rebuild_snapshot_on_theme_switch($new_name = '', $new_theme = null, $old_theme = null): void
{
    systemdeck_schedule_snapshot_rebuild();
}

function systemdeck_rebuild_snapshot_on_upgrade($upgrader_object = null, $options = []): void
{
    if (!is_array($options)) {
        return;
    }
    $type = $options['type'] ?? '';
    if ($type === 'plugin' || $type === 'theme') {
        systemdeck_schedule_snapshot_rebuild();
    }
}

add_action('activated_plugin', 'systemdeck_rebuild_snapshot_on_change', 10, 2);
add_action('deactivated_plugin', 'systemdeck_rebuild_snapshot_on_change', 10, 2);
add_action('switch_theme', 'systemdeck_rebuild_snapshot_on_theme_switch', 10, 3);
add_action('upgrader_process_complete', 'systemdeck_rebuild_snapshot_on_upgrade', 10, 2);
add_action('admin_init', 'systemdeck_maybe_run_scheduled_snapshot_rebuild', 1);

/**
 * Plugin Activation Hook
 * Build the Registry Snapshot on activation
 */
register_activation_hook(__FILE__, 'systemdeck_on_activation');

function systemdeck_on_activation(): void
{
    // Create database tables
    if (class_exists('\\SystemDeck\\Core\\StorageEngine')) {
        \SystemDeck\Core\StorageEngine::create_tables();
    }

    // Build the Registry Snapshot (The Mailbox)
    // Run after table creation to avoid activation-time SQL warnings.
    if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
        \SystemDeck\Core\Services\RegistryService::build_snapshot();
    }

    update_option('sd_registry_rebuild_needed', 0, false);
}
// Permissions (Keep this for the safety check)
function systemdeck_user_can_boot(): bool
{
    if (!is_user_logged_in()) {
        return false;
    }
    $user = wp_get_current_user();
    if (!$user || !$user->exists()) {
        return false;
    }

    $can_boot = systemdeck_user_can('shell_access');
    $can_boot = (bool) apply_filters('systemdeck_user_can_boot', $can_boot, $user->ID);
    return $can_boot;
}

function systemdeck_get_access_policy_defaults(): array
{
    return [
        'shell_roles' => ['administrator'],
        'workspace_view_roles' => ['administrator'],
        'workspace_manage_roles' => ['administrator'],
    ];
}

function systemdeck_sanitize_access_policy(array $policy): array
{
    $defaults = systemdeck_get_access_policy_defaults();
    $allowed_roles = ['administrator', 'editor', 'author', 'contributor', 'subscriber'];
    $clean = $defaults;

    foreach ($defaults as $key => $default_value) {
        $incoming = $policy[$key] ?? $default_value;
        if (!is_array($incoming)) {
            $incoming = $default_value;
        }
        $roles = array_values(array_unique(array_filter(array_map('sanitize_key', $incoming), static function ($role) use ($allowed_roles) {
            return in_array($role, $allowed_roles, true);
        })));
        $clean[$key] = !empty($roles) ? $roles : $default_value;
    }

    return $clean;
}

function systemdeck_get_access_policy(): array
{
    $stored = get_option('sd_access_policy', []);
    if (!is_array($stored)) {
        $stored = [];
    }
    return systemdeck_sanitize_access_policy($stored);
}

function systemdeck_role_rank(string $role): int
{
    $rank = [
        'subscriber' => 1,
        'contributor' => 2,
        'author' => 3,
        'editor' => 4,
        'administrator' => 5,
    ];
    return $rank[$role] ?? 0;
}

function systemdeck_user_rank(int $user_id): int
{
    $user = get_userdata($user_id);
    if (!$user) {
        return 0;
    }
    $max = 0;
    foreach ((array) $user->roles as $role) {
        $max = max($max, systemdeck_role_rank((string) $role));
    }
    return $max;
}

function systemdeck_user_matches_roles(int $user_id, array $roles): bool
{
    $user = get_userdata($user_id);
    if (!$user) {
        return false;
    }
    $user_roles = (array) $user->roles;
    foreach ($roles as $role) {
        if (in_array($role, $user_roles, true)) {
            return true;
        }
    }
    return false;
}

function systemdeck_user_meets_workspace_access(int $user_id, string $workspace_id, string $permission = 'workspace_view'): bool
{
    if ($workspace_id === '' || $workspace_id === 'default') {
        return true;
    }
    if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
        return true;
    }
    $canvas_post = systemdeck_get_canvas_post_by_workspace($workspace_id);
    if (!$canvas_post) {
        return true;
    }
    $canvas_id = (int) $canvas_post->ID;
    $owner_id = (int) $canvas_post->post_author;
    $is_owner = ($owner_id > 0 && $owner_id === $user_id);

    if ($is_owner) {
        return true;
    }

    // Private always means owner-only (+ admin handled by caller).
    $is_public = (bool) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_PUBLIC, true);
    if (!$is_public) {
        return false;
    }

    $audience_scope = \SystemDeck\Core\Services\CanvasRepository::normalize_audience_scope(
        (string) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_AUDIENCE_SCOPE, true)
    );
    if ($audience_scope === 'targeted_users') {
        $target_user_ids = \SystemDeck\Core\Services\CanvasRepository::get_workspace_target_user_ids($workspace_id, $owner_id > 0 ? $owner_id : $user_id);
        if (!in_array($user_id, $target_user_ids, true)) {
            return false;
        }
    }

    // Public + locked means view-only for non-owner.
    $is_locked = (bool) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_LOCKED, true);
    if ($is_locked && in_array($permission, ['workspace_manage', 'workspace_delete', 'workspace_edit'], true)) {
        return false;
    }

    $required = (string) get_post_meta($canvas_id, \SystemDeck\Core\Services\CanvasRepository::META_ACCESS_ROLE, true);
    if ($required === '' || $required === 'all')
        $required = 'administrator';
    return systemdeck_user_rank($user_id) >= systemdeck_role_rank($required);
}

function systemdeck_get_canvas_post_by_workspace(string $workspace_id): ?WP_Post
{
    $workspace_id = sanitize_key($workspace_id);
    if ($workspace_id === '' || $workspace_id === 'default') {
        return null;
    }
    if (!class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
        return null;
    }
    $posts = get_posts([
        'post_type' => \SystemDeck\Core\Services\CanvasRepository::CPT,
        'post_status' => ['publish', 'private', 'draft', 'pending'],
        'posts_per_page' => 1,
        'meta_query' => [
            [
                'key' => \SystemDeck\Core\Services\CanvasRepository::META_WORKSPACE,
                'value' => $workspace_id,
                'compare' => '=',
            ]
        ],
        'orderby' => 'ID',
        'order' => 'DESC',
        'no_found_rows' => true,
    ]);
    return (!empty($posts) && $posts[0] instanceof \WP_Post) ? $posts[0] : null;
}

function systemdeck_get_shared_workspaces_for_user(int $user_id): array
{
    if ($user_id <= 0 || !class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
        return [];
    }
    $posts = get_posts([
        'post_type' => \SystemDeck\Core\Services\CanvasRepository::CPT,
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'meta_query' => [
            [
                'key' => \SystemDeck\Core\Services\CanvasRepository::META_PUBLIC,
                'value' => '1',
                'compare' => '=',
            ]
        ],
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
    ]);
    if (empty($posts)) {
        return [];
    }
    $shared = [];
    foreach ($posts as $post) {
        if (!$post instanceof \WP_Post) {
            continue;
        }
        if ((int) $post->post_author === $user_id) {
            continue;
        }
        $workspace_id = sanitize_key((string) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_WORKSPACE, true));
        if ($workspace_id === '' || $workspace_id === 'default') {
            continue;
        }
        if (!systemdeck_user_meets_workspace_access($user_id, $workspace_id, 'workspace_view')) {
            continue;
        }
        $author = get_userdata((int) $post->post_author);
        $is_locked = (bool) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_LOCKED, true);
        $runtime_items = \SystemDeck\Core\Services\CanvasRepository::extract_runtime_blocks_from_content((string) $post->post_content);
        $workspace_widgets = [];
        foreach ($runtime_items as $runtime_item) {
            if (($runtime_item['type'] ?? '') !== 'block_widget_placeholder') {
                continue;
            }
            $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($runtime_item['settings']['widgetId'] ?? '')));
            if ($candidate !== '') {
                $workspace_widgets[] = $candidate;
            }
        }
        $workspace_widgets = array_values(array_unique($workspace_widgets));
        $shared[$workspace_id] = [
            'id' => $workspace_id,
            'name' => (string) ($post->post_title ?: __('Untitled Workspace', 'systemdeck')),
            'title' => (string) ($post->post_title ?: __('Untitled Workspace', 'systemdeck')),
            'created' => (string) $post->post_date,
            'widgets' => $workspace_widgets,
            'available' => $workspace_widgets,
            'shared' => true,
            'shared_incoming' => true,
            'shared_menu_only' => $is_locked,
            'canvas_id' => (int) $post->ID,
            'cpt_post_id' => (int) $post->ID,
            'cpt_author_id' => (int) $post->post_author,
            'cpt_author_name' => $author ? (string) $author->display_name : '',
            'cpt_created' => (string) $post->post_date,
            'cpt_modified' => (string) $post->post_modified,
            'cpt_post_status' => (string) $post->post_status,
            'is_public' => true,
            'is_locked' => $is_locked,
            'collaboration_mode' => \SystemDeck\Core\Services\CanvasRepository::normalize_collaboration_mode(
                (string) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_COLLABORATION_MODE, true)
            ),
            'audience_scope' => \SystemDeck\Core\Services\CanvasRepository::normalize_audience_scope(
                (string) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_AUDIENCE_SCOPE, true)
            ),
            'target_user_ids' => \SystemDeck\Core\Services\CanvasRepository::get_workspace_target_user_ids($workspace_id, (int) $post->post_author),
            'target_user_logins' => \SystemDeck\Core\Services\CanvasRepository::get_workspace_target_user_logins($workspace_id, (int) $post->post_author),
            'access_role' => (string) (get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_ACCESS_ROLE, true) ?: 'administrator'),
            'show_top_level_menu' => (bool) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_SHOW_TOP_LEVEL_MENU, true),
            'menu_icon' => (string) (sanitize_html_class((string) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_MENU_ICON, true)) ?: 'dashicons-screenoptions'),
            'is_app_workspace' => (bool) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_IS_APP_WORKSPACE, true),
            'app_id' => sanitize_key((string) get_post_meta($post->ID, \SystemDeck\Core\Services\CanvasRepository::META_APP_ID, true)),
            'archived' => false,
        ];
    }
    return $shared;
}

function systemdeck_user_can(string $permission, string $workspace_id = ''): bool
{
    if (!is_user_logged_in()) {
        return false;
    }
    $user_id = (int) get_current_user_id();
    if ($user_id <= 0) {
        return false;
    }
    if (user_can($user_id, 'manage_options')) {
        return true;
    }

    $map = [
        'shell_access' => 'shell_roles',
        'workspace_view' => 'workspace_view_roles',
        'workspace_manage' => 'workspace_manage_roles',
        'workspace_create' => 'workspace_manage_roles',
        'workspace_delete' => 'workspace_manage_roles',
        'workspace_edit' => 'workspace_manage_roles',
    ];
    $key = $map[$permission] ?? 'shell_roles';
    $policy = systemdeck_get_access_policy();
    $allowed = systemdeck_user_matches_roles($user_id, (array) ($policy[$key] ?? []));

    if ($workspace_id !== '' && in_array($permission, ['workspace_view', 'workspace_manage', 'workspace_delete', 'workspace_edit'], true)) {
        $workspace_allowed = systemdeck_user_meets_workspace_access($user_id, sanitize_key($workspace_id), $permission);
        $allowed = $allowed && $workspace_allowed;
    }

    return (bool) apply_filters('systemdeck_user_can', $allowed, $permission, $workspace_id, $user_id);
}

class SystemDeck_Assets
{

    /**
     * Boot the System.
     * Hooked into 'init' to wait for User Session.
     */
    public static function run(): void
    {
        // Infrastructure is already registered at the top level (Phase 1).

        // 7. Text Domain
        load_plugin_textdomain('systemdeck', false, dirname(plugin_basename(__DIR__)) . '/languages');

        // ---------------------------------------------------------
        // PHASE 2: UI SHELL GATE (Permission & Context Checks)
        // ---------------------------------------------------------

        // Prevent recursive boot in scanner iframe (The Inception Guard)
        if (
            (isset($_GET['sd_block_boot']) && $_GET['sd_block_boot'] === '1') ||
            (isset($_GET['sd_inspect']) && $_GET['sd_inspect'] === '1')
        ) {
            return;
        }

        if (function_exists('systemdeck_user_can_boot')) {
            $can_boot = systemdeck_user_can_boot();
            if (!$can_boot) {
                return;
            }
        }

        // ---------------------------------------------------------
        // PHASE 3: SHELL BOOT (Assets, Context, Canvas Engine)
        // ---------------------------------------------------------

        // Initialize Context
        if (class_exists('\\SystemDeck\\Core\\Context')) {
            // Context initialization if needed
        }

        // Register Shell Assets (Rebirth)
        add_action('enqueue_block_editor_assets', [self::class, 'register_assets']);
        add_action('wp_enqueue_scripts', [self::class, 'register_assets']);
        add_action('admin_enqueue_scripts', [self::class, 'register_assets']);

        // Canvas Engine (Runtime)
        if (class_exists('SystemDeck\Core\CanvasEngine')) {
            $canvas = new \SystemDeck\Core\CanvasEngine();
            $canvas->run();
        }

        // User Preferences
        if (class_exists('\\SystemDeck\\Core\\UserPreferences')) {
            \SystemDeck\Core\UserPreferences::init();
        }

        // Editor Controller (Gutenberg)
        if (class_exists('\\SystemDeck\\Core\\EditorController')) {
            \SystemDeck\Core\EditorController::init();
        }

        // Retail Controller is initialized independently at the bottom of
        // systemdeck.php (priority 5) so it runs even when the Inception Guard
        // fires — do NOT re-initialize here to avoid double hook registration.
    }

    public static function register_assets(): void
    {
        if (isset($_GET['sd_embed']))
            return;

        $is_block_editor_context = false;
        if (is_admin() && function_exists('get_current_screen')) {
            $screen = get_current_screen();
            $is_block_editor_context = (bool) ($screen && method_exists($screen, 'is_block_editor') && $screen->is_block_editor());
        }

        // 1. Register Shell Assets (Updated Paths)
        $tone_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/vendor/tone.min.js') ?: SYSTEMDECK_VERSION);
        $tonejs_midi_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/vendor/tonejs-midi.min.js') ?: SYSTEMDECK_VERSION);
        $audio_engine_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'assets/js/sd-audio-engine.js') ?: SYSTEMDECK_VERSION);
        $player_style_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'widgets/player/style.css') ?: SYSTEMDECK_VERSION);
        $player_app_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'widgets/player/app.js') ?: SYSTEMDECK_VERSION);

        wp_register_script('tone', SYSTEMDECK_URL . 'assets/vendor/tone.min.js', [], $tone_ver, true);
        wp_register_script('sd-tonejs-midi', SYSTEMDECK_URL . 'assets/vendor/tonejs-midi.min.js', [], $tonejs_midi_ver, true);
        wp_register_script('sd-audio-engine', SYSTEMDECK_URL . 'assets/js/sd-audio-engine.js', [], $audio_engine_ver, true);
        wp_register_style('sd-player-style', SYSTEMDECK_URL . 'widgets/player/style.css', ['sd-legacy-common'], $player_style_ver);
        wp_register_script('sd-player-app', SYSTEMDECK_URL . 'widgets/player/app.js', ['jquery', 'sd-audio-engine'], $player_app_ver, true);
        wp_add_inline_script(
            'sd-audio-engine',
            'window.SYSTEMDECK_AUDIO_ASSETS = Object.assign({}, window.SYSTEMDECK_AUDIO_ASSETS || {}, ' . wp_json_encode([
                'toneUrl' => SYSTEMDECK_URL . 'assets/vendor/tone.min.js',
                'midiUrl' => SYSTEMDECK_URL . 'assets/vendor/tonejs-midi.min.js',
                'toneVersion' => $tone_ver,
                'midiVersion' => $tonejs_midi_ver,
            ]) . ');',
            'before'
        );
        wp_register_style('systemdeck-shell', SYSTEMDECK_URL . 'assets/css/systemdeck-shell.css', ['dashicons'], SYSTEMDECK_VERSION);
        wp_register_script('systemdeck-shell', SYSTEMDECK_URL . 'assets/js/systemdeck-shell.js', ['jquery'], SYSTEMDECK_VERSION, true);

        // Build Payload
        $user_id = get_current_user_id();
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        // Cleanup: ensure every workspace is valid and has an ID
        $cleaned_workspaces = [];
        foreach ($workspaces as $id => $ws) {
            if (!is_array($ws)) {
                // Handle legacy string-only workspaces if they exist
                $ws = ['id' => sanitize_title($ws), 'name' => $ws];
            }

            $ws_id = $ws['id'] ?? (is_string($id) ? $id : 'ws_' . uniqid());
            $ws['id'] = $ws_id;

            if (empty($ws['name']) && empty($ws['title'])) {
                $ws['name'] = ($ws_id === 'default') ? 'Main Workspace' : 'Untitled Workspace';
            }

            if (empty($ws['created'])) {
                $ws['created'] = current_time('mysql');
            }

            if (!isset($ws['widgets']) || !is_array($ws['widgets'])) {
                $ws['widgets'] = [];
            }
            if (!isset($ws['shared'])) {
                $ws['shared'] = false;
            }
            if (!isset($ws['pinned'])) {
                $ws['pinned'] = false;
            }
            if (!isset($ws['source_workspace_id'])) {
                $ws['source_workspace_id'] = '';
            }
            if (!isset($ws['source_version_at_clone'])) {
                $ws['source_version_at_clone'] = 0;
            }

            // Map 'widgets' (PHP side) to 'available' (JS side)
            $ws['available'] = $ws['widgets'] ?? [];

            $cleaned_workspaces[$ws_id] = $ws;
        }
        $workspaces = $cleaned_workspaces;
        update_user_meta($user_id, 'sd_workspaces', $workspaces);

        if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
            $workspaces = \SystemDeck\Core\Services\CanvasRepository::enrich_workspaces_with_canvas_data($workspaces, (int) $user_id);
            update_user_meta($user_id, 'sd_workspaces', $workspaces);
        }

        // Include shared (public) workspaces from other owners in runtime state.
        $shared_workspaces = systemdeck_get_shared_workspaces_for_user((int) $user_id);
        if (!empty($shared_workspaces)) {
            foreach ($shared_workspaces as $shared_id => $shared_ws) {
                if (!isset($workspaces[$shared_id])) {
                    $workspaces[$shared_id] = $shared_ws;
                }
            }
        }

        $visible_workspaces = array_filter($workspaces, static function ($ws) use ($user_id) {
            if (!is_array($ws)) {
                return false;
            }

            $workspace_id = sanitize_key((string) ($ws['id'] ?? ''));
            $owner_id = (int) ($ws['cpt_author_id'] ?? 0);
            if (
                $workspace_id !== '' &&
                $workspace_id !== 'default' &&
                $owner_id > 0 &&
                $owner_id !== (int) $user_id &&
                !systemdeck_user_meets_workspace_access((int) $user_id, $workspace_id, 'workspace_view')
            ) {
                return false;
            }

            // CPT status is the source of truth when available.
            if (isset($ws['cpt_post_status']) && $ws['cpt_post_status'] !== '') {
                $status = (string) $ws['cpt_post_status'];
                if ($owner_id > 0 && $owner_id === (int) $user_id) {
                    return $status !== 'trash';
                }
                return $status === 'publish';
            }

            // Legacy fallback for workspaces without a mapped canvas.
            return empty($ws['archived']);
        });

        // Sort by saved order field so drag-and-drop arrangement persists on reload.
        uasort($visible_workspaces, static function ($a, $b) {
            $orderA = (int) ($a['order'] ?? PHP_INT_MAX);
            $orderB = (int) ($b['order'] ?? PHP_INT_MAX);
            return $orderA <=> $orderB;
        });

        // Hydrate Initial Layout for visible workspaces
        $initial_layouts = [];
        if (class_exists('SystemDeck\Core\StorageEngine') && class_exists('SystemDeck\Core\Context')) {
            try {
                foreach ($visible_workspaces as $ws_id => $ws_data) {
                    $context = new \SystemDeck\Core\Context(get_current_user_id(), $ws_id);
                    $items = \SystemDeck\Core\StorageEngine::get('layout', $context);
                    $hidden_lookup = [];
                    $is_shared_overlay = !empty($ws_data['shared_incoming']) && (($ws_data['collaboration_mode'] ?? 'owner_only') !== 'collaborative');
                    if ($is_shared_overlay && class_exists('\\SystemDeck\\Core\\AjaxHandler')) {
                        $hidden_widget_ids = \SystemDeck\Core\AjaxHandler::get_hidden_base_widget_ids((int) get_current_user_id(), (string) $ws_id);
                        $hidden_lookup = array_fill_keys($hidden_widget_ids, true);
                    }

                    $layout_data = [];
                    if ($items && is_array($items)) {
                        foreach ($items as $item) {
                            if (empty($item['id']) || $item['id'] === 'undefined')
                                continue;
                            $item_id = (string) $item['id'];
                            $settings = (array) ($item['settings'] ?? []);
                            $slot_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($settings['widgetId'] ?? ''));
                            $candidate = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($settings['widgetId'] ?? ''));
                            if ($candidate !== '' && isset($hidden_lookup[$candidate])) {
                                continue;
                            }
                            if (!isset($settings['source']) && str_starts_with($item_id, 'sd_canvas_')) {
                                $settings['source'] = 'canvas';
                            }
                            $item_type = !empty($item['type']) ? (string) $item['type'] : 'widget';
                            if ($slot_widget_id !== '') {
                                $item_type = 'block_widget_placeholder';
                            }
                            $layout_data[$item['id']] = [
                                'i' => $item['id'],
                                'id' => $item['id'],
                                'type' => $item_type,
                                'title' => (string) ($item['title'] ?? ''),
                                'x' => (int) ($item['x'] ?? 0),
                                'y' => (int) ($item['y'] ?? 0),
                                'w' => (int) ($item['w'] ?? 4),
                                'h' => (int) ($item['h'] ?? 4),
                                'settings' => $settings
                            ];
                        }
                    }

                    // Merge CPT canvas blocks into runtime layout so Gutenberg-edited blocks appear in canvas mode.
                    if (class_exists('\\SystemDeck\\Core\\Services\\CanvasRepository')) {
                        $canvas_payload = \SystemDeck\Core\Services\CanvasRepository::resolve_for_workspace((string) $ws_id, (int) get_current_user_id());
                        $canvas_items = \SystemDeck\Core\Services\CanvasRepository::extract_runtime_blocks_from_content((string) ($canvas_payload['content'] ?? ''));

                        $max_y = 0;
                        foreach ($layout_data as $existing_item) {
                            $max_y = max($max_y, (int) ($existing_item['y'] ?? 0) + (int) ($existing_item['h'] ?? 4));
                        }

                        $canvas_ids = array_keys($canvas_items);
                        foreach ($layout_data as $existing_id => $existing_item) {
                            $source = (string) (($existing_item['settings']['source'] ?? '') ?: '');
                            if ($source === 'canvas' && !in_array($existing_id, $canvas_ids, true)) {
                                unset($layout_data[$existing_id]);
                            }
                        }

                        foreach ($canvas_items as $canvas_id => $canvas_item) {
                            $canvas_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($canvas_item['settings']['widgetId'] ?? '')));
                            if ($canvas_widget_id !== '' && isset($hidden_lookup[$canvas_widget_id])) {
                                unset($layout_data[$canvas_id]);
                                continue;
                            }
                            if (isset($layout_data[$canvas_id])) {
                                $layout_data[$canvas_id]['type'] = (string) ($canvas_item['type'] ?? $layout_data[$canvas_id]['type']);
                                $layout_data[$canvas_id]['title'] = (string) ($canvas_item['title'] ?? $layout_data[$canvas_id]['title']);
                                $layout_data[$canvas_id]['settings'] = array_merge(
                                    (array) ($layout_data[$canvas_id]['settings'] ?? []),
                                    (array) ($canvas_item['settings'] ?? [])
                                );
                                continue;
                            }

                            $layout_data[$canvas_id] = [
                                'i' => $canvas_id,
                                'id' => $canvas_id,
                                'type' => (string) ($canvas_item['type'] ?? 'block_html'),
                                'title' => (string) ($canvas_item['title'] ?? 'Block'),
                                'x' => (int) ($canvas_item['x'] ?? 0),
                                'y' => (int) ($canvas_item['y'] ?? $max_y),
                                'w' => (int) ($canvas_item['w'] ?? 2),
                                'h' => (int) ($canvas_item['h'] ?? 1),
                                'settings' => (array) ($canvas_item['settings'] ?? ['source' => 'canvas']),
                            ];
                            $max_y = max(
                                $max_y,
                                (int) ($layout_data[$canvas_id]['y'] ?? 0) + (int) ($layout_data[$canvas_id]['h'] ?? 1)
                            );
                        }
                    }

                    if (
                        !empty($ws_data['is_app_workspace']) &&
                        !empty($ws_data['app_id']) &&
                        class_exists('\\SystemDeck\\Core\\AppRuntime')
                    ) {
                        $seed_widget_ids = \SystemDeck\Core\AppRuntime::get_seed_widget_ids((string) $ws_data['app_id']);
                        if (!empty($seed_widget_ids)) {
                            $max_y = 0;
                            $present_widget_ids = [];
                            foreach ($layout_data as $existing_item) {
                                $max_y = max($max_y, (int) ($existing_item['y'] ?? 0) + (int) ($existing_item['h'] ?? 4));
                                $existing_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) (($existing_item['settings']['widgetId'] ?? '') ?: ($existing_item['id'] ?? '')));
                                if ($existing_widget_id !== '') {
                                    $present_widget_ids[$existing_widget_id] = true;
                                }
                            }

                            foreach ($seed_widget_ids as $index => $seed_widget_id) {
                                $seed_widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) $seed_widget_id);
                                if ($seed_widget_id === '' || isset($present_widget_ids[$seed_widget_id])) {
                                    continue;
                                }

                                $item_id = sprintf('sd_app_%s_%d', sanitize_title($seed_widget_id), $index + 1);
                                $layout_data[$item_id] = [
                                    'i' => $item_id,
                                    'id' => $item_id,
                                    'type' => 'block_widget_placeholder',
                                    'title' => '',
                                    'x' => 0,
                                    'y' => $max_y,
                                    'w' => 4,
                                    'h' => 8,
                                    'settings' => [
                                        'widgetId' => $seed_widget_id,
                                        'source' => 'app_seed',
                                    ],
                                ];
                                $present_widget_ids[$seed_widget_id] = true;
                                $max_y += 8;
                            }
                        }
                    }
                    $initial_layouts[$ws_id] = $layout_data;
                }
            } catch (\Exception $e) {
            }
        }

        // RC Directive Phase 2: Use Registry Snapshot (The Mailbox)
        if (class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
            $registry_snapshot = \SystemDeck\Core\Services\RegistryService::get_snapshot();
        } elseif (class_exists('\\SystemDeck\\Core\\Registry')) {
            $registry_snapshot = \SystemDeck\Core\Registry::get_snapshot();
        } else {
            $registry_snapshot = ['widgets' => []];
        }

        $registry_enablement = get_user_meta($user_id, 'sd_registry_enablement', true);
        // RC Directive: Handle "all disabled" vs "first run"
        // If meta is false or doesn't exist, we enable everything by default.
        // If it's an array (even empty), it's a valid user selection.
        if ($registry_enablement === '' || $registry_enablement === false) {
            if (!empty($registry_snapshot['widgets'])) {
                $registry_enablement = array_keys($registry_snapshot['widgets']);
            } else {
                $registry_enablement = [];
            }
        }
        // Ensure sequential array for JSON
        $registry_enablement = array_values(array_unique((array) $registry_enablement));
        if (class_exists('\\SystemDeck\\Core\\AjaxHandler')) {
            $widget_ui_state = \SystemDeck\Core\AjaxHandler::get_normalized_widget_ui_state_for_user($user_id, true);
        } else {
            $widget_ui_state = ['_v' => 1, 'workspaces' => []];
        }
        $hydration_diagnostics_enabled = defined('SYSTEMDECK_HYDRATION_DIAGNOSTICS_ENABLED') && SYSTEMDECK_HYDRATION_DIAGNOSTICS_ENABLED;
        $registered_apps = class_exists('\\SystemDeck\\Core\\AppRuntime')
            ? \SystemDeck\Core\AppRuntime::get_registered_apps()
            : [];

        $config = [
            'siteUrl' => get_site_url(),
            'ajaxurl' => admin_url('admin-ajax.php'),
            'routerUrl' => get_site_url() . '/',
            'nonce' => wp_create_nonce('systemdeck_runtime'),
            'version' => SYSTEMDECK_VERSION,
            'user' => [
                'id' => get_current_user_id(),
                'name' => wp_get_current_user()->display_name,
                'can_manage_options' => current_user_can('manage_options'),
                'can_view_workspaces' => systemdeck_user_can('workspace_view'),
                'can_manage_workspaces' => systemdeck_user_can('workspace_manage'),
                'access_policy_role_options' => array_values(array_filter(array_keys((array) wp_roles()->roles), static function ($role) {
                    return $role !== 'administrator';
                })),
                'sd_incognito_mode' => get_user_meta(get_current_user_id(), 'sd_incognito_mode', true) === 'true',
                'sd_default_dock' => get_user_meta(get_current_user_id(), 'sd_default_dock', true) ?: 'standard-dock',
                'sd_audio_master_volume' => max(0, min(1, (float) (get_user_meta(get_current_user_id(), 'sd_audio_master_volume', true) ?: 1))),
            ],
            'workspaces' => $visible_workspaces,
            'theme_json' => class_exists('WP_Theme_JSON_Resolver')
                ? \WP_Theme_JSON_Resolver::get_merged_data()->get_raw_data()
                : [],
            'initialLayouts' => $initial_layouts,
            'registry_enablement' => $registry_enablement,
            'widget_ui_state' => $widget_ui_state,
            'hydration_diagnostics_enabled' => $hydration_diagnostics_enabled,
            'registry_snapshot' => self::get_frontend_registry_snapshot($registry_snapshot),
            'apps' => array_values($registered_apps),
            'logoSvg' => class_exists('\\SystemDeck\\Core\\Logo')
                ? \SystemDeck\Core\Logo::render_svg()
                : '',
        ];

        $security_script = 'window.SystemDeckSecurity = Object.assign({}, window.SystemDeckSecurity || {}, {' .
            " nonce: '" . esc_js($config['nonce']) . "'," .
            " action: 'systemdeck_runtime'," .
            " ajaxurl: '" . esc_js($config['ajaxurl']) . "'," .
            " routerUrl: '" . esc_js($config['routerUrl']) . "'" .
            ' });' . "\n" .
            "window.ajaxurl = window.ajaxurl || '" . esc_js($config['ajaxurl']) . "';";

        if (!$is_block_editor_context) {
            $json_payload = wp_json_encode([
                'config' => $config,
                'shell_html' => self::get_deck_template()
            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE) ?: '{}';

            $injector_script = $security_script . "\n" .
                'window.SYSTEMDECK_BOOTSTRAP = ' . $json_payload . ';' . "\n" .
                'window.SYSTEMDECK_STATE = window.SYSTEMDECK_BOOTSTRAP;' . "\n" .
                'window.sd_vars = window.SYSTEMDECK_STATE.config;' . "\n" .
                'window.SYSTEMDECK_ENV = Object.assign({}, window.SYSTEMDECK_ENV || {}, {' . "\n" .
                '    ajax_url: window.SYSTEMDECK_STATE.config.ajaxurl,' . "\n" .
                '    nonces: Object.assign({}, (window.SYSTEMDECK_ENV && window.SYSTEMDECK_ENV.nonces) || {}, { systemdeck_runtime: window.SYSTEMDECK_STATE.config.nonce }),' . "\n" .
                '    audio: {' . "\n" .
                '        masterVolume: Number(window.SYSTEMDECK_STATE.config.user.sd_audio_master_volume || 1)' . "\n" .
                '    }' . "\n" .
                '});' . "\n" .
                '(function() {' . "\n" .
                '    if (document.getElementById("systemdeck")) return;' . "\n\n" .
                '    var div = document.createElement("div");' . "\n" .
                '    div.innerHTML = window.SYSTEMDECK_BOOTSTRAP.shell_html;' . "\n" .
                '    var shell = div.firstElementChild;' . "\n\n" .
                '    function inject() {' . "\n" .
                '        if (!document.body.contains(shell)) {' . "\n" .
                '            document.body.appendChild(shell);' . "\n" .
                '        }' . "\n" .
                '    }' . "\n\n" .
                '    if (document.readyState === "loading") {' . "\n" .
                '        document.addEventListener("DOMContentLoaded", inject);' . "\n" .
                '    } else {' . "\n" .
                '        inject();' . "\n" .
                '    }' . "\n" .
                '})();';

            wp_add_inline_script('systemdeck-shell', $injector_script, 'before');

            // Ensure shared core styles are registered/enqueued on frontend + admin.
            if (class_exists('\\SystemDeck\\Core\\Assets')) {
                \SystemDeck\Core\Assets::register_all();
                wp_enqueue_style('sd-common');
                wp_enqueue_style('sd-screen-meta');
            }
            // Keep component styling parity between wp-admin and frontend shell.
            if (wp_style_is('wp-components', 'registered')) {
                wp_enqueue_style('wp-components');
            }

            // Enqueue runtime style bundles here as well so frontend shell surfaces
            // do not depend on CanvasEngine enqueue timing for component parity.
            $build_dir = SYSTEMDECK_PATH . 'assets/runtime/';
            $build_url = SYSTEMDECK_URL . 'assets/runtime/';
            $asset_file = $build_dir . 'systemdeck-runtime.asset.php';
            if (file_exists($asset_file)) {
                $build_assets = require $asset_file;

                if (file_exists($build_dir . 'systemdeck-runtime.css')) {
                    wp_enqueue_style(
                        'systemdeck-runtime',
                        $build_url . 'systemdeck-runtime.css',
                        ['wp-components', 'sd-common', 'sd-screen-meta', 'dashicons'],
                        $build_assets['version']
                    );
                }

                if (file_exists($build_dir . 'style-systemdeck-runtime.css')) {
                    wp_enqueue_style(
                        'systemdeck-runtime-style',
                        $build_url . 'style-systemdeck-runtime.css',
                        ['systemdeck-runtime'],
                        $build_assets['version']
                    );
                }
            }

            // Enqueue Shell
            wp_enqueue_style('systemdeck-shell');
            wp_enqueue_script('systemdeck-shell');

            // Widget and app assets should load after core/runtime/shell assets so
            // widget styles remain the final override layer.
            if (!empty($registry_snapshot['widgets']) && is_array($registry_snapshot['widgets'])) {
                $preload_widget_ids = [];

                foreach ((array) $initial_layouts as $layout_items) {
                    foreach ((array) $layout_items as $layout_item) {
                        if (!is_array($layout_item)) {
                            continue;
                        }
                        $settings = (array) ($layout_item['settings'] ?? []);
                        $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id(
                            (string) (($settings['widgetId'] ?? '') ?: ($layout_item['id'] ?? ''))
                        );
                        if ($widget_id !== '') {
                            $preload_widget_ids[$widget_id] = true;
                        }
                    }
                }

                foreach ($registry_snapshot['widgets'] as $widget_id => $widget_def) {
                    if (
                        !is_array($widget_def) ||
                        ($widget_def['origin'] ?? '') !== 'core' ||
                        empty($preload_widget_ids[(string) $widget_id])
                    ) {
                        continue;
                    }
                    \SystemDeck\Core\Registry::enqueue_widget_assets((string) $widget_id);
                }
            }

            // Generic app runtime preload:
            // pre-enqueue root widget assets for registered app workspaces so app
            // runtimes are available before AJAX widget mount.
            if (class_exists('\\SystemDeck\\Core\\AppRuntime')) {
                \SystemDeck\Core\AppRuntime::preload_registered_app_assets($workspaces);
            }

        }
    }

    private static function get_deck_template(): string
    {
        ob_start();
        // Define variables needed for the template
        $admin_color = get_user_option('admin_color');
        // Default dock position, can be customized via user meta or options
        $default_dock = get_user_meta(get_current_user_id(), 'sd_default_dock', true);
        if (empty($default_dock)) {
            $default_dock = 'standard-dock';
        }
        $incognito_mode = get_user_meta(get_current_user_id(), 'sd_incognito_mode', true) === 'true';
        $theme_str = 'light';
        ?>

        <div id="systemdeck" role="dialog" aria-hidden="true"
            class="sd-closed wp-core-ui admin-color-<?php echo esc_attr($admin_color); ?> <?php echo esc_attr($default_dock); ?><?php echo $incognito_mode ? ' incognito' : ''; ?>"
            data-initial-theme="<?php echo esc_attr($theme_str); ?>" data-theme="<?php echo esc_attr($theme_str); ?>"
            data-default-dock="<?php echo esc_attr($default_dock); ?>"
            data-incognito="<?php echo $incognito_mode ? 'true' : 'false'; ?>">

            <!-- ================= HEADER BAR ================= -->
            <header id="sd-header-bar" class="nojq">
                <!-- Drawer Icon: Minimize Dock -->
                <button type="button" class="sd-drawer-icon sd-btn-icon"
                    title="<?php esc_attr_e('Minimize Dock', 'systemdeck'); ?>">
                    <?php
                    echo class_exists('\\SystemDeck\\Core\\Logo')
                        ? \SystemDeck\Core\Logo::render_svg(28, 'display:block;object-fit:contain;')
                        : '';
                    ?>
                </button>

                <!-- Left: Workspace Title -->
                <div class="sd-header-left">
                    <h2 id="sd-workspace-title">SystemDeck</h2>
                </div>

                <!-- Right: Controls -->
                <div class="sd-header-right">
                    <!-- Dock Buttons -->
                    <div class="sd-dock-controls">
                        <button type="button" data-dock="left-dock" class="sd-btn-icon"
                            title="<?php esc_attr_e('Dock Left', 'systemdeck'); ?>">
                            <span class="dashicons dashicons-arrow-left-alt"></span>
                        </button>
                        <button type="button" data-dock="base-dock" class="sd-btn-icon"
                            title="<?php esc_attr_e('Dock Base', 'systemdeck'); ?>">
                            <span class="dashicons dashicons-minus"></span>
                        </button>
                        <button type="button" data-dock="right-dock" class="sd-btn-icon"
                            title="<?php esc_attr_e('Dock Right', 'systemdeck'); ?>">
                            <span class="dashicons dashicons-arrow-right-alt"></span>
                        </button>
                        <button type="button" data-dock="standard-dock" class="sd-btn-icon"
                            title="<?php esc_attr_e('Standard Dock', 'systemdeck'); ?>">
                            <span class="dashicons dashicons-randomize"></span>
                        </button>
                        <button type="button" data-dock="full-dock" class="sd-btn-icon"
                            title="<?php esc_attr_e('Full Screen', 'systemdeck'); ?>">
                            <span class="dashicons dashicons-fullscreen-alt"></span>
                        </button>
                    </div>

                    <!-- Close Button -->
                    <button type="button" id="sd-close-button" class="sd-btn-icon"
                        title="<?php esc_attr_e('Close', 'systemdeck'); ?>">
                        <span class="dashicons dashicons-no"></span>
                    </button>
                </div>
            </header>

            <!-- ================= MAIN WRAP ================= -->
            <div id="sd-wrap">

                <!-- ================= MENU ASIDE ================= -->
                <aside id="sd-menumain" role="navigation">
                    <?php
                    // Manual Render because we are in Phase 2
                    if (class_exists('SystemDeck\Core\MenuEngine')) {
                        try {
                            $menu_engine = new \SystemDeck\Core\MenuEngine();
                            $menu_engine->render();
                        } catch (\Exception $e) {
                            error_log('SystemDeck MenuEngine Error: ' . $e->getMessage());
                            echo '';
                        }
                    } elseif (file_exists(SYSTEMDECK_PATH . 'core/MenuEngine.php')) {
                        require_once SYSTEMDECK_PATH . 'core/MenuEngine.php';
                        if (class_exists('SystemDeck\Core\MenuEngine')) {
                            (new \SystemDeck\Core\MenuEngine())->render();
                        }
                    }
                    ?>
                </aside>

                <!-- ================= WORKSPACE CONTENT ================= -->
                <section id="sd-workspace-content">
                    <div id="sd-workspacewrap">
                        <!-- Dynamic workspace content loads here -->
                        <?php
                        if (class_exists('SystemDeck\Core\CanvasEngine')) {
                            (new \SystemDeck\Core\CanvasEngine())->render_root();
                        }
                        ?>
                    </div>
                </section>

            </div>
        </div>
        <?php

        return ob_get_clean();
    }

    /**
     * Emergency fallback CSS generation in case Assets.php is unavailable.
     * Ensures the shell renders with basic styles.
     */

    private static function get_frontend_registry_snapshot(array $snapshot): array
    {
        $widgets = [];

        foreach ((array) ($snapshot['widgets'] ?? []) as $widget_id => $widget_def) {
            if (!is_array($widget_def)) {
                continue;
            }

            $widgets[(string) $widget_id] = [
                'id' => (string) ($widget_def['id'] ?? $widget_id),
                'title' => (string) ($widget_def['title'] ?? ''),
                'icon' => (string) ($widget_def['icon'] ?? ''),
                'origin' => (string) ($widget_def['origin'] ?? ''),
                'source_id' => (string) ($widget_def['source_id'] ?? ''),
                'is_legacy' => !empty($widget_def['is_legacy']),
                'app_id' => (string) ($widget_def['app_id'] ?? ''),
                'visibility_policy' => (string) ($widget_def['visibility_policy'] ?? 'global'),
                'seed_on_app_provision' => !empty($widget_def['seed_on_app_provision']),
            ];
        }

        return [
            'generated_at' => (int) ($snapshot['generated_at'] ?? 0),
            'version' => (string) ($snapshot['version'] ?? ''),
            'checksum' => (string) ($snapshot['checksum'] ?? ''),
            'contract_version' => (int) ($snapshot['contract_version'] ?? 0),
            'widgets' => $widgets,
        ];
    }
}

// ─── RETAIL CONTROLLER ────────────────────────────────────────────────────────
// Must run independently of SystemDeck_Assets::run() so that the preview iframe
// (sd_preview=1&sd_inspect=1) can register the inspector engine even when the
// Inception Guard in run() returns early.
add_action('init', function () {
    if (class_exists('\\SystemDeck\\Core\\RetailController')) {
        \SystemDeck\Core\RetailController::init();
    }
}, 5); // Priority 5 = before SystemDeck_Assets::run() at priority 10

// Wait for init
add_action('init', ['SystemDeck_Assets', 'run']);
