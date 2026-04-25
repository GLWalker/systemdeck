<?php
/**
 * SystemDeck Canvas Repository
 * V3 Alpha Step 1: CPT registration only.
 */
declare(strict_types=1);

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class CanvasRepository
{
    public const CPT = 'systemdeck_canvas';
    public const META_TEMPLATE = '_sd_canvas_template';
    public const META_WORKSPACE = '_sd_workspace_id';
    public const META_STATUS = '_sd_canvas_status';
    public const META_VERSION = '_sd_canvas_version';
    public const META_ACCESS_ROLE = '_sd_canvas_access_role';
    public const META_PUBLIC = '_sd_canvas_public';
    public const META_LOCKED = '_sd_canvas_locked';
    public const META_COLLABORATION_MODE = '_sd_canvas_collaboration_mode';
    public const META_AUDIENCE_SCOPE = '_sd_canvas_audience_scope';
    public const META_TARGET_USER_IDS = '_sd_canvas_target_user_ids';
    public const META_SHOW_TOP_LEVEL_MENU = '_sd_canvas_show_top_level_menu';
    public const META_MENU_ICON = '_sd_canvas_menu_icon';
    public const META_IS_APP_WORKSPACE = '_sd_canvas_is_app_workspace';
    public const META_APP_ID = '_sd_canvas_app_id';

    public static function init(): void
    {
        add_action('init', [self::class, 'register_cpt'], 9);
        add_action('init', [self::class, 'register_meta'], 10);
        add_action('init', [self::class, 'register_templates'], 11);
        add_action('save_post_' . self::CPT, [self::class, 'sync_workspace_layout_from_canvas'], 20, 3);
        add_action('before_delete_post', [self::class, 'handle_native_cpt_deletion']);
        add_action('wp_trash_post', [self::class, 'handle_native_cpt_trash']);
        add_action('untrash_post', [self::class, 'handle_native_cpt_untrash']);
        // Canvas posts are mutated frequently by the picker. Revisions add
        // DB overhead with no recovery value for machine-managed content.
        add_filter('wp_revisions_to_keep', [self::class, 'revisions_to_keep_for_canvas'], 10, 2);
    }

    public static function revisions_to_keep_for_canvas(int $num, \WP_Post $post): int
    {
        return $post->post_type === self::CPT ? 0 : $num;
    }

    public static function register_cpt(): void
    {
        if (post_type_exists(self::CPT)) {
            return;
        }

        register_post_type(self::CPT, [
            'labels' => [
                'name' => __('SystemDeck Canvases', 'systemdeck'),
                'singular_name' => __('SystemDeck Canvas', 'systemdeck'),
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => false,
            'show_in_admin_bar' => false,
            'show_in_rest' => true,
            'supports' => ['title', 'editor'],
            'capability_type' => 'post',
            'map_meta_cap' => true,
            'menu_icon' => 'dashicons-layout',
        ]);
    }

    public static function register_templates(): void
    {
        if (!function_exists('register_block_template')) {
            return;
        }

        $template_path = SYSTEMDECK_PATH . 'templates/single-systemdeck_canvas.html';
        if (!file_exists($template_path)) {
            return;
        }

        register_block_template('systemdeck//single-systemdeck_canvas', [
            'title' => __('SystemDeck Canvas Template', 'systemdeck'),
            'description' => __('Default SystemDeck canvas template.', 'systemdeck'),
            'content' => (string) file_get_contents($template_path),
            'post_types' => [self::CPT],
            'plugin' => 'systemdeck',
        ]);
    }

    public static function register_meta(): void
    {
        register_post_meta(self::CPT, self::META_TEMPLATE, [
            'type' => 'string',
            'single' => true,
            'default' => 'default',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_WORKSPACE, [
            'type' => 'string',
            'single' => true,
            'default' => 'default',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_STATUS, [
            'type' => 'string',
            'single' => true,
            'default' => 'draft',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_VERSION, [
            'type' => 'string',
            'single' => true,
            'default' => '3.0.0-alpha',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_ACCESS_ROLE, [
            'type' => 'string',
            'single' => true,
            'default' => 'administrator',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_PUBLIC, [
            'type' => 'boolean',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_LOCKED, [
            'type' => 'boolean',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_COLLABORATION_MODE, [
            'type' => 'string',
            'single' => true,
            'default' => 'owner_only',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_AUDIENCE_SCOPE, [
            'type' => 'string',
            'single' => true,
            'default' => 'global',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_TARGET_USER_IDS, [
            'type' => 'string',
            'single' => true,
            'default' => '[]',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_SHOW_TOP_LEVEL_MENU, [
            'type' => 'boolean',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_MENU_ICON, [
            'type' => 'string',
            'single' => true,
            'default' => 'dashicons-screenoptions',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_IS_APP_WORKSPACE, [
            'type' => 'boolean',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);

        register_post_meta(self::CPT, self::META_APP_ID, [
            'type' => 'string',
            'single' => true,
            'default' => '',
            'show_in_rest' => true,
            'auth_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
        ]);
    }

    /**
     * Resolve a workspace to a canvas definition.
     * Contract target for V3 view-plane loader.
     *
     * @return array<string,mixed>
     */
    public static function resolve_for_workspace(string $workspace_id, int $user_id = 0): array
    {
        $workspace_id = sanitize_key($workspace_id ?: 'default');

        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }

        $canvas_id = self::lookup_canvas_id_for_workspace($workspace_id, $user_id);
        if ($canvas_id <= 0) {
            return self::empty_canvas_payload($workspace_id);
        }

        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== self::CPT) {
            return self::empty_canvas_payload($workspace_id);
        }

        return [
            'id' => (int) $post->ID,
            'workspace_id' => $workspace_id,
            'slug' => (string) $post->post_name,
            'title' => (string) $post->post_title,
            'status' => (string) get_post_meta($post->ID, self::META_STATUS, true),
            'template' => (string) get_post_meta($post->ID, self::META_TEMPLATE, true),
            'version' => (string) get_post_meta($post->ID, self::META_VERSION, true),
            'content' => (string) $post->post_content,
            'updated_gmt' => (string) $post->post_modified_gmt,
        ];
    }

    public static function seed_default_canvas(int $user_id = 0): int
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return 0;
        }

        $existing = self::lookup_canvas_id_for_workspace('default', $user_id);
        if ($existing > 0) {
            self::attach_canvas_to_workspace_meta($user_id, 'default', $existing);
            return $existing;
        }

        $post_id = wp_insert_post([
            'post_type' => self::CPT,
            'post_status' => 'publish',
            'post_title' => 'Main Workspace Canvas',
            'post_name' => 'main-workspace-canvas',
            'post_content' => self::default_canvas_content(),
        ], true);

        if (is_wp_error($post_id) || (int) $post_id <= 0) {
            return 0;
        }

        update_post_meta((int) $post_id, self::META_WORKSPACE, 'default');
        update_post_meta((int) $post_id, self::META_TEMPLATE, 'default');
        update_post_meta((int) $post_id, self::META_STATUS, 'active');
        update_post_meta((int) $post_id, self::META_VERSION, '3.0.0-alpha');
        update_post_meta((int) $post_id, self::META_PUBLIC, false);
        update_post_meta((int) $post_id, self::META_LOCKED, false);
        update_post_meta((int) $post_id, self::META_COLLABORATION_MODE, 'owner_only');
        update_post_meta((int) $post_id, self::META_AUDIENCE_SCOPE, 'global');
        update_post_meta((int) $post_id, self::META_TARGET_USER_IDS, '[]');
        update_post_meta((int) $post_id, self::META_SHOW_TOP_LEVEL_MENU, false);
        update_post_meta((int) $post_id, self::META_MENU_ICON, 'dashicons-screenoptions');
        update_post_meta((int) $post_id, self::META_IS_APP_WORKSPACE, false);
        update_post_meta((int) $post_id, self::META_APP_ID, '');

        self::attach_canvas_to_workspace_meta($user_id, 'default', (int) $post_id);

        return (int) $post_id;
    }

    public static function ensure_canvas_for_workspace(string $workspace_id, int $user_id = 0, string $workspace_name = ''): int
    {
        $workspace_id = sanitize_key($workspace_id ?: 'default');
        if ($workspace_id === '') {
            $workspace_id = 'default';
        }

        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return 0;
        }

        if ($workspace_id === 'default') {
            return self::seed_default_canvas($user_id);
        }

        $existing = self::lookup_canvas_id_for_workspace($workspace_id, $user_id);
        if ($existing > 0) {
            self::attach_canvas_to_workspace_meta($user_id, $workspace_id, $existing);
            return $existing;
        }

        $title = trim($workspace_name) !== ''
            ? sanitize_text_field($workspace_name)
            : ucfirst($workspace_id);

        $post_id = wp_insert_post([
            'post_type' => self::CPT,
            'post_status' => 'publish',
            'post_title' => $title,
            'post_name' => sanitize_title($workspace_id . '-canvas'),
            'post_content' => self::default_canvas_content(),
        ], true);

        if (is_wp_error($post_id) || (int) $post_id <= 0) {
            return 0;
        }

        update_post_meta((int) $post_id, self::META_WORKSPACE, $workspace_id);
        update_post_meta((int) $post_id, self::META_TEMPLATE, 'default');
        update_post_meta((int) $post_id, self::META_STATUS, 'active');
        update_post_meta((int) $post_id, self::META_VERSION, '3.0.0-alpha');
        update_post_meta((int) $post_id, self::META_ACCESS_ROLE, 'administrator');
        update_post_meta((int) $post_id, self::META_PUBLIC, false);
        update_post_meta((int) $post_id, self::META_LOCKED, false);
        update_post_meta((int) $post_id, self::META_SHOW_TOP_LEVEL_MENU, false);
        update_post_meta((int) $post_id, self::META_MENU_ICON, 'dashicons-screenoptions');
        update_post_meta((int) $post_id, self::META_IS_APP_WORKSPACE, false);
        update_post_meta((int) $post_id, self::META_APP_ID, '');

        self::attach_canvas_to_workspace_meta($user_id, $workspace_id, (int) $post_id);

        return (int) $post_id;
    }

    /**
     * Enrich workspace rows with canonical CPT metadata for cards and policy UI.
     *
     * @param array<string,array<string,mixed>> $workspaces
     * @return array<string,array<string,mixed>>
     */
    public static function enrich_workspaces_with_canvas_data(array $workspaces, int $user_id = 0): array
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0 || empty($workspaces)) {
            return $workspaces;
        }

        foreach ($workspaces as $workspace_id => $workspace) {
            if (!is_array($workspace)) {
                continue;
            }

            $canvas_id = (int) ($workspace['canvas_id'] ?? 0);
            if ($canvas_id <= 0) {
                $canvas_id = self::lookup_canvas_id_for_workspace((string) $workspace_id, $user_id);
            }

            $workspaces[$workspace_id]['canvas_id'] = $canvas_id;
            $workspaces[$workspace_id]['access_role'] = 'administrator';

            if ($canvas_id <= 0) {
                continue;
            }

            $post = get_post($canvas_id);
            if (!$post || $post->post_type !== self::CPT) {
                continue;
            }

            $author = get_userdata((int) $post->post_author);
            $workspaces[$workspace_id]['cpt_post_id'] = (int) $post->ID;
            $workspaces[$workspace_id]['cpt_author_id'] = (int) $post->post_author;
            $workspaces[$workspace_id]['cpt_author_name'] = $author ? (string) $author->display_name : '';
            $workspaces[$workspace_id]['cpt_created'] = (string) $post->post_date;
            $workspaces[$workspace_id]['cpt_modified'] = (string) $post->post_modified;
            $workspaces[$workspace_id]['cpt_post_status'] = (string) $post->post_status;
            $post_title = self::normalize_workspace_title((string) ($post->post_title ?: ''));
            $workspaces[$workspace_id]['name'] = (string) ($post_title ?: ($workspaces[$workspace_id]['name'] ?? ''));
            $workspaces[$workspace_id]['title'] = (string) ($post_title ?: ($workspaces[$workspace_id]['title'] ?? ''));
            $workspaces[$workspace_id]['access_role'] = (string) (get_post_meta($post->ID, self::META_ACCESS_ROLE, true) ?: 'administrator');
            $workspaces[$workspace_id]['is_public'] = (bool) get_post_meta($post->ID, self::META_PUBLIC, true);
            $workspaces[$workspace_id]['is_locked'] = (bool) get_post_meta($post->ID, self::META_LOCKED, true);
            $workspaces[$workspace_id]['collaboration_mode'] = self::normalize_collaboration_mode(
                (string) get_post_meta($post->ID, self::META_COLLABORATION_MODE, true)
            );
            $workspaces[$workspace_id]['audience_scope'] = self::normalize_audience_scope(
                (string) get_post_meta($post->ID, self::META_AUDIENCE_SCOPE, true)
            );
            $workspaces[$workspace_id]['target_user_ids'] = self::get_workspace_target_user_ids((string) $workspace_id, $user_id);
            $workspaces[$workspace_id]['target_user_logins'] = self::get_workspace_target_user_logins((string) $workspace_id, $user_id);
            $workspaces[$workspace_id]['shared_menu_only'] = (bool) ($workspaces[$workspace_id]['is_public'] && $workspaces[$workspace_id]['is_locked']);
            $show_top_level_menu_meta_exists = metadata_exists('post', (int) $post->ID, self::META_SHOW_TOP_LEVEL_MENU);
            $menu_icon_meta_exists = metadata_exists('post', (int) $post->ID, self::META_MENU_ICON);
            $is_app_meta_exists = metadata_exists('post', (int) $post->ID, self::META_IS_APP_WORKSPACE);
            $app_id_meta_exists = metadata_exists('post', (int) $post->ID, self::META_APP_ID);

            $legacy_show_top_level = !empty($workspaces[$workspace_id]['show_top_level_menu']);
            $legacy_menu_icon = sanitize_html_class((string) ($workspaces[$workspace_id]['menu_icon'] ?? ''));
            $legacy_is_app = !empty($workspaces[$workspace_id]['is_app_workspace']) || !empty($workspaces[$workspace_id]['app_id']);
            $legacy_app_id = sanitize_key((string) ($workspaces[$workspace_id]['app_id'] ?? ''));

            $workspaces[$workspace_id]['show_top_level_menu'] = $show_top_level_menu_meta_exists
                ? (bool) get_post_meta($post->ID, self::META_SHOW_TOP_LEVEL_MENU, true)
                : $legacy_show_top_level;
            $menu_icon = $menu_icon_meta_exists
                ? sanitize_html_class((string) get_post_meta($post->ID, self::META_MENU_ICON, true))
                : $legacy_menu_icon;
            $workspaces[$workspace_id]['menu_icon'] = $menu_icon !== '' ? $menu_icon : 'dashicons-screenoptions';
            $workspaces[$workspace_id]['is_app_workspace'] = $is_app_meta_exists
                ? (bool) get_post_meta($post->ID, self::META_IS_APP_WORKSPACE, true)
                : $legacy_is_app;
            $workspaces[$workspace_id]['app_id'] = $app_id_meta_exists
                ? sanitize_key((string) get_post_meta($post->ID, self::META_APP_ID, true))
                : $legacy_app_id;

            // CPT post status is authoritative for visibility; avoid stale user-meta archive flags.
            if ((string) $post->post_status === 'publish') {
                $workspaces[$workspace_id]['archived'] = false;
                unset($workspaces[$workspace_id]['archived_at'], $workspaces[$workspace_id]['archived_by']);
            } else {
                $workspaces[$workspace_id]['archived'] = true;
            }
        }

        return $workspaces;
    }

    public static function set_workspace_access_role(string $workspace_id, string $role, int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        $allowed = ['administrator', 'editor', 'author', 'contributor', 'subscriber'];
        $normalized = sanitize_key($role ?: 'administrator');
        if (!in_array($normalized, $allowed, true)) {
            $normalized = 'administrator';
        }

        $current = sanitize_key((string) get_post_meta($canvas_id, self::META_ACCESS_ROLE, true));
        if ($current === '') {
            $current = 'administrator';
        }

        if ($current === $normalized) {
            return true;
        }

        return false !== update_post_meta($canvas_id, self::META_ACCESS_ROLE, $normalized);
    }

    public static function set_workspace_visibility(string $workspace_id, bool $is_public, bool $is_locked, int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        $ok_public = update_post_meta($canvas_id, self::META_PUBLIC, $is_public ? '1' : '0');
        $ok_locked = update_post_meta($canvas_id, self::META_LOCKED, $is_locked ? '1' : '0');
        return (bool) ($ok_public || $ok_locked);
    }

    public static function get_workspace_collaboration_mode(string $workspace_id, int $user_id = 0): string
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return 'owner_only';
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return 'owner_only';
        }

        return self::normalize_collaboration_mode(
            (string) get_post_meta($canvas_id, self::META_COLLABORATION_MODE, true)
        );
    }

    public static function set_workspace_collaboration_mode(string $workspace_id, string $mode, int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        return (bool) update_post_meta(
            $canvas_id,
            self::META_COLLABORATION_MODE,
            self::normalize_collaboration_mode($mode)
        );
    }

    public static function get_workspace_audience_scope(string $workspace_id, int $user_id = 0): string
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return 'global';
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return 'global';
        }

        return self::normalize_audience_scope(
            (string) get_post_meta($canvas_id, self::META_AUDIENCE_SCOPE, true)
        );
    }

    public static function set_workspace_audience(string $workspace_id, string $scope, array $target_user_ids = [], int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        $scope = self::normalize_audience_scope($scope);
        $target_user_ids = self::normalize_target_user_ids($target_user_ids);

        $ok_scope = update_post_meta($canvas_id, self::META_AUDIENCE_SCOPE, $scope);
        $ok_targets = update_post_meta($canvas_id, self::META_TARGET_USER_IDS, wp_json_encode($target_user_ids));

        return (bool) ($ok_scope || $ok_targets);
    }

    public static function set_workspace_app_menu(string $workspace_id, bool $show_top_level_menu, string $menu_icon = '', int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        $icon = sanitize_html_class($menu_icon);
        if ($icon === '') {
            $icon = 'dashicons-screenoptions';
        }

        $target_visible = $show_top_level_menu ? '1' : '0';
        $current_visible = (string) get_post_meta($canvas_id, self::META_SHOW_TOP_LEVEL_MENU, true);
        $current_icon = sanitize_html_class((string) get_post_meta($canvas_id, self::META_MENU_ICON, true));

        $ok_visible = ($current_visible === $target_visible)
            ? true
            : (bool) update_post_meta($canvas_id, self::META_SHOW_TOP_LEVEL_MENU, $target_visible);
        $ok_icon = ($current_icon === $icon)
            ? true
            : (bool) update_post_meta($canvas_id, self::META_MENU_ICON, $icon);
        return (bool) ($ok_visible && $ok_icon);
    }

    public static function set_workspace_app_identity(string $workspace_id, bool $is_app_workspace, string $app_id = '', int $user_id = 0): bool
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return false;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return false;
        }

        $normalized_app_id = sanitize_key($app_id);
        $ok_app = update_post_meta($canvas_id, self::META_IS_APP_WORKSPACE, $is_app_workspace ? '1' : '0');
        $ok_id = update_post_meta($canvas_id, self::META_APP_ID, $normalized_app_id);
        return (bool) ($ok_app || $ok_id);
    }

    public static function get_workspace_target_user_ids(string $workspace_id, int $user_id = 0): array
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return [];
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id <= 0) {
            return [];
        }

        $raw = get_post_meta($canvas_id, self::META_TARGET_USER_IDS, true);
        if (is_array($raw)) {
            return self::normalize_target_user_ids($raw);
        }

        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        return self::normalize_target_user_ids($decoded);
    }

    public static function get_workspace_target_user_logins(string $workspace_id, int $user_id = 0): array
    {
        $ids = self::get_workspace_target_user_ids($workspace_id, $user_id);
        if (empty($ids)) {
            return [];
        }

        $logins = [];
        foreach ($ids as $target_user_id) {
            $user = get_userdata((int) $target_user_id);
            if ($user instanceof \WP_User && !empty($user->user_login)) {
                $logins[] = (string) $user->user_login;
            }
        }

        return array_values(array_unique(array_filter($logins)));
    }

    public static function normalize_collaboration_mode(string $mode): string
    {
        $mode = sanitize_key($mode ?: 'owner_only');
        return $mode === 'collaborative' ? 'collaborative' : 'owner_only';
    }

    public static function normalize_audience_scope(string $scope): string
    {
        $scope = sanitize_key($scope ?: 'global');
        return $scope === 'targeted_users' ? 'targeted_users' : 'global';
    }

    public static function normalize_target_user_ids(array $target_user_ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', $target_user_ids), static function ($user_id) {
            return $user_id > 0;
        })));
    }

    public static function delete_canvas_for_workspace(string $workspace_id, int $user_id = 0): void
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return;
        }

        $canvas_id = self::lookup_canvas_id_for_workspace(sanitize_key($workspace_id), $user_id);
        if ($canvas_id > 0) {
            wp_delete_post($canvas_id, true);
        }
    }

    public static function handle_native_cpt_deletion(int $post_id): void
    {
        $post = get_post($post_id);
        if (!$post || $post->post_type !== self::CPT) {
            return;
        }

        $workspace_id = sanitize_key((string) get_post_meta($post_id, self::META_WORKSPACE, true));
        if ($workspace_id === '') {
            $workspace_id = 'default';
        }

        $owner_id = (int) $post->post_author;
        if ($owner_id > 0) {
            self::remove_workspace_from_user_meta($owner_id, $workspace_id);
        }

        self::delete_workspace_items($workspace_id, $post_id);
    }

    public static function handle_native_cpt_trash(int $post_id): void
    {
        self::sync_native_cpt_archive_state($post_id, true);
    }

    public static function handle_native_cpt_untrash(int $post_id): void
    {
        self::sync_native_cpt_archive_state($post_id, false);
    }

    /**
     * @return array<string,mixed>
     */
    public static function insert_predefined_block(string $workspace_id, string $block_key, int $user_id = 0): array
    {
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return ['success' => false, 'message' => 'Unable to resolve user context.'];
        }

        $workspace_id = sanitize_key($workspace_id ?: 'default');
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($workspaces) || !isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            return ['success' => false, 'message' => 'Workspace not found.'];
        }

        $canvas_id = self::ensure_canvas_for_workspace($workspace_id, $user_id, (string) ($workspaces[$workspace_id]['name'] ?? ''));
        if ($canvas_id <= 0) {
            return ['success' => false, 'message' => 'Canvas could not be created for workspace.'];
        }

        $catalog = self::predefined_blocks_catalog();
        if (!isset($catalog[$block_key])) {
            return ['success' => false, 'message' => 'Unknown predefined block key.'];
        }

        $post = get_post($canvas_id);
        if (!$post || $post->post_type !== self::CPT) {
            return ['success' => false, 'message' => 'Canvas not found.'];
        }

        $snippet = (string) ($catalog[$block_key]['content'] ?? '');
        if ($snippet === '') {
            return ['success' => false, 'message' => 'Predefined block content is empty.'];
        }

        $content = (string) $post->post_content;
        $needs_break = $content !== '' && !str_ends_with($content, "\n");
        $content .= ($needs_break ? "\n" : '') . $snippet . "\n";

        $updated = wp_update_post([
            'ID' => $canvas_id,
            'post_content' => $content,
        ], true);

        if (is_wp_error($updated) || (int) $updated <= 0) {
            return ['success' => false, 'message' => 'Failed to update canvas content.'];
        }

        return [
            'success' => true,
            'message' => (string) ($catalog[$block_key]['label'] ?? 'Inserted'),
            'canvas_id' => $canvas_id,
            'workspace_id' => $workspace_id,
            'block_key' => $block_key,
        ];
    }

    /**
     * Build runtime layout items from canvas post_content blocks.
     *
     * @return array<string,array<string,mixed>>
     */
    public static function extract_runtime_blocks_from_content(string $content): array
    {
        if ($content === '' || !function_exists('parse_blocks')) {
            return [];
        }

        $parsed = parse_blocks($content);
        if (!is_array($parsed) || empty($parsed)) {
            return [];
        }

        $items = [];
        self::collect_runtime_blocks($parsed, '0', $items);
        return $items;
    }

    private static function lookup_canvas_id_for_workspace(string $workspace_id, int $user_id): int
    {
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (is_array($workspaces) && isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            $candidate = (int) ($workspaces[$workspace_id]['canvas_id'] ?? 0);
            if ($candidate > 0) {
                return $candidate;
            }
        }

        $query = get_posts([
            'post_type' => self::CPT,
            'post_status' => ['publish', 'draft', 'private'],
            'numberposts' => 1,
            'fields' => 'ids',
            'meta_key' => self::META_WORKSPACE,
            'meta_value' => $workspace_id,
            'orderby' => 'ID',
            'order' => 'ASC',
        ]);

        return empty($query) ? 0 : (int) $query[0];
    }

    private static function attach_canvas_to_workspace_meta(int $user_id, string $workspace_id, int $canvas_id): void
    {
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($workspaces)) {
            $workspaces = [];
        }

        if (!isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            $workspaces[$workspace_id] = [
                'id' => $workspace_id,
                'name' => ($workspace_id === 'default') ? 'Main Workspace' : ucfirst($workspace_id),
                'created' => current_time('mysql'),
                'order' => 0,
                'widgets' => [],
            ];
        }

        $workspaces[$workspace_id]['canvas_id'] = $canvas_id;
        update_user_meta($user_id, 'sd_workspaces', $workspaces);
    }

    /**
     * @return array<string,mixed>
     */
    private static function empty_canvas_payload(string $workspace_id): array
    {
        return [
            'id' => 0,
            'workspace_id' => $workspace_id,
            'slug' => '',
            'title' => '',
            'status' => '',
            'template' => '',
            'version' => '',
            'content' => '',
            'updated_gmt' => '',
        ];
    }

    private static function default_canvas_content(): string
    {
        return <<<HTML
<!-- wp:group {"anchor":"sd-canvas-root","className":"sd-canvas-shell","layout":{"type":"default"}} -->
<div id="sd-canvas-root" class="wp-block-group sd-canvas-shell">
  <!-- wp:systemdeck/canvas-grid {"lock":{"move":true,"remove":true}} -->
  <div class="wp-block-systemdeck-canvas-grid sd-canvas-grid-host" data-sd-grid-host="1"></div>
  <!-- /wp:systemdeck/canvas-grid -->
</div>
<!-- /wp:group -->
HTML;
    }

    private static function normalize_workspace_title(string $title): string
    {
        $title = trim($title);
        if ($title === '') {
            return '';
        }

        // Backward-compat: legacy canvas post titles often ended with " Canvas".
        return (string) preg_replace('/\s+Canvas$/i', '', $title);
    }

    /**
     * @return array<string,array<string,string>>
     */
    private static function predefined_blocks_catalog(): array
    {
        return [
            'hook_workspace_header' => [
                'label' => 'Site Health Widget',
                'content' => '<!-- wp:systemdeck/widgets {"widgetId":"dashboard_site_health","title":"Site Health"} /-->',
            ],
            'hook_workspace_footer' => [
                'label' => 'Activity Widget',
                'content' => '<!-- wp:systemdeck/widgets {"widgetId":"dashboard_activity","title":"Activity"} /-->',
            ],
            'widget_site_health' => [
                'label' => 'Site Health Widget',
                'content' => '<!-- wp:systemdeck/widgets {"widgetId":"dashboard_site_health","title":"Site Health"} /-->',
            ],
            'widget_activity' => [
                'label' => 'Activity Widget',
                'content' => '<!-- wp:systemdeck/widgets {"widgetId":"dashboard_activity","title":"Activity"} /-->',
            ],
            'region_secondary' => [
                'label' => 'Secondary Canvas Region',
                'content' => '<!-- wp:group {"className":"sd-canvas-region","layout":{"type":"constrained"}} --><div class="wp-block-group sd-canvas-region"></div><!-- /wp:group -->',
            ],
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @param array<string,array<string,mixed>> $items
     */
    private static function collect_runtime_blocks(array $blocks, string $path, array &$items): void
    {
        foreach ($blocks as $index => $block) {
            if (!is_array($block)) {
                continue;
            }

            $next_path = $path . '_' . (string) $index;
            $name = (string) ($block['blockName'] ?? '');
            $attrs = (is_array($block['attrs'] ?? null)) ? $block['attrs'] : [];
            $inner = (is_array($block['innerBlocks'] ?? null)) ? $block['innerBlocks'] : [];

            if (
                $name === ''
                || $name === 'core/group'
                || $name === 'core/row'
                || $name === 'core/columns'
                || $name === 'core/column'
                || $name === 'core/grid'
                || $name === 'systemdeck/canvas-grid'
            ) {
                if (!empty($inner)) {
                    self::collect_runtime_blocks($inner, $next_path, $items);
                }
                continue;
            }

            $seed = sanitize_key((string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''));
            if ($seed === '') {
                $seed = sanitize_key(str_replace('/', '_', $name) . '_' . $next_path);
            }
            if ($seed === '') {
                continue;
            }

            $id = 'sd_canvas_' . $seed;
            $title = sanitize_text_field((string) (($attrs['metadata']['name'] ?? '') ?: self::title_from_block_name($name)));

            if ($name === 'systemdeck/widgets') {
                $widget_id = \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id((string) ($attrs['widgetId'] ?? ''));
                $label = sanitize_text_field((string) ($attrs['title'] ?? ''));
                $column_span = isset($attrs['columnSpan']) ? (int) $attrs['columnSpan'] : 2;
                $column_span = self::map_width_to_four($column_span);
                $row_span = isset($attrs['rowSpan']) ? (int) $attrs['rowSpan'] : 1;
                $row_span = max(1, min(12, $row_span));
                $grid_x = isset($attrs['gridX']) ? (int) $attrs['gridX'] : 0;
                $grid_x = max(0, $grid_x);
                $grid_y = isset($attrs['gridY']) ? (int) $attrs['gridY'] : count($items) * 2;
                $grid_y = max(0, $grid_y);
                if ($label === '' && $widget_id !== '') {
                    $label = self::resolve_widget_label($widget_id);
                }
                if ($label === '') {
                    $label = $title;
                }
                $items[$id] = [
                    'i' => $id,
                    'id' => $id,
                    'type' => 'block_widget_placeholder',
                    'title' => $title,
                    'x' => $grid_x,
                    'y' => $grid_y,
                    'w' => $column_span,
                    'h' => $row_span,
                    'settings' => [
                        'source' => 'canvas',
                        'blockName' => $name,
                        'sdItemId' => (string) ($attrs['sdItemId'] ?? $attrs['anchor'] ?? ''),
                        'widgetId' => $widget_id,
                        'label' => $label,
                    ],
                ];
            } else {
                $html = function_exists('render_block') ? (string) render_block($block) : '';
                if (trim((string) wp_strip_all_tags($html)) === '') {
                    if (!empty($inner)) {
                        self::collect_runtime_blocks($inner, $next_path, $items);
                    }
                    continue;
                }
                $layout_attrs = is_array($attrs['layout'] ?? null) ? $attrs['layout'] : [];
                $style = is_array($attrs['style'] ?? null) ? $attrs['style'] : [];
                $style_layout = is_array($style['layout'] ?? null) ? $style['layout'] : [];
                $column_span = (int) ($attrs['columnSpan'] ?? $layout_attrs['columnSpan'] ?? $style_layout['columnSpan'] ?? 4);
                $column_span = self::map_width_to_four($column_span);
                $row_span = (int) ($attrs['rowSpan'] ?? $layout_attrs['rowSpan'] ?? $style_layout['rowSpan'] ?? 1);
                $row_span = max(1, min(12, $row_span));
                $items[$id] = [
                    'i' => $id,
                    'id' => $id,
                    'type' => 'block_html',
                    'title' => $title,
                    'x' => 0,
                    'y' => count($items) * 2,
                    'w' => $column_span,
                    'h' => $row_span,
                    'settings' => [
                        'source' => 'canvas',
                        'blockName' => $name,
                        'html' => $html,
                    ],
                ];
            }

            if (!empty($inner)) {
                self::collect_runtime_blocks($inner, $next_path, $items);
            }
        }
    }

    private static function title_from_block_name(string $name): string
    {
        $tail = $name;
        if (str_contains($name, '/')) {
            $parts = explode('/', $name);
            $tail = (string) end($parts);
        }
        return ucwords(str_replace(['-', '_'], ' ', $tail));
    }

    private static function sanitize_widget_id(string $widget_id): string
    {
        return \SystemDeck\Core\Services\WidgetRuntimeBridge::sanitize_widget_id($widget_id);
    }

    private static function resolve_widget_label(string $widget_id): string
    {
        $snapshot = class_exists('\\SystemDeck\\Core\\Services\\RegistryService')
            ? \SystemDeck\Core\Services\RegistryService::get_snapshot()
            : \SystemDeck\Core\Registry::get_snapshot();
        $definitions = (array) ($snapshot['widgets'] ?? []);

        if (isset($definitions[$widget_id]) && is_array($definitions[$widget_id])) {
            return (string) ($definitions[$widget_id]['title'] ?? $widget_id);
        }

        $alt = str_replace('_', '.', $widget_id);
        if (isset($definitions[$alt]) && is_array($definitions[$alt])) {
            return (string) ($definitions[$alt]['title'] ?? $alt);
        }

        return $widget_id;
    }

    public static function sync_workspace_layout_from_canvas(int $post_id, \WP_Post $post, bool $update): void
    {
        if (wp_is_post_autosave($post_id) || wp_is_post_revision($post_id)) {
            return;
        }
        if ($post->post_type !== self::CPT) {
            return;
        }

        $workspace_id = sanitize_key((string) get_post_meta($post_id, self::META_WORKSPACE, true));
        if ($workspace_id === '') {
            $workspace_id = 'default';
        }

        self::sync_workspace_title_to_user_meta((int) $post->post_author, $workspace_id, (string) $post->post_title);

        $normalized_content = self::normalize_canvas_grid_block((string) $post->post_content);
        if ($normalized_content !== (string) $post->post_content) {
            remove_action('save_post_' . self::CPT, [self::class, 'sync_workspace_layout_from_canvas'], 20);
            wp_update_post([
                'ID' => $post_id,
                'post_content' => $normalized_content,
            ]);
            add_action('save_post_' . self::CPT, [self::class, 'sync_workspace_layout_from_canvas'], 20, 3);
            $post->post_content = $normalized_content;
        }

        $items = self::extract_runtime_blocks_from_content((string) $post->post_content);

        $layout = [];
        $cursor_y = 0;
        foreach ($items as $runtime_id => $runtime_item) {
            $h = max(1, (int) ($runtime_item['h'] ?? 1));
            $layout[] = [
                'id' => $runtime_id,
                'type' => (string) ($runtime_item['type'] ?? 'block_html'),
                'settings' => (array) ($runtime_item['settings'] ?? []),
                'x' => (int) ($runtime_item['x'] ?? 0),
                'y' => $cursor_y,
                'w' => self::map_width_to_four((int) ($runtime_item['w'] ?? 2)),
                'h' => $h,
            ];
            $cursor_y += $h;
        }

        $user_id = (int) $post->post_author;
        if ($user_id <= 0) {
            $user_id = (int) get_current_user_id();
        }
        if ($user_id <= 0) {
            return;
        }

        $context = new \SystemDeck\Core\Context($user_id, $workspace_id);
        \SystemDeck\Core\StorageEngine::save('layout', $layout, $context);
    }

    private static function sync_native_cpt_archive_state(int $post_id, bool $archived): void
    {
        $post = get_post($post_id);
        if (!$post || $post->post_type !== self::CPT) {
            return;
        }

        $workspace_id = sanitize_key((string) get_post_meta($post_id, self::META_WORKSPACE, true));
        if ($workspace_id === '') {
            return;
        }

        $owner_id = (int) $post->post_author;
        if ($owner_id <= 0) {
            return;
        }

        $workspaces = get_user_meta($owner_id, 'sd_workspaces', true);
        if (!is_array($workspaces) || !isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            return;
        }

        if ($archived) {
            $workspaces[$workspace_id]['archived'] = true;
            $workspaces[$workspace_id]['archived_at'] = current_time('mysql');
        } else {
            $workspaces[$workspace_id]['archived'] = false;
            unset($workspaces[$workspace_id]['archived_at'], $workspaces[$workspace_id]['archived_by']);
        }

        update_user_meta($owner_id, 'sd_workspaces', $workspaces);
    }

    private static function sync_workspace_title_to_user_meta(int $user_id, string $workspace_id, string $post_title): void
    {
        if ($user_id <= 0 || $workspace_id === '') {
            return;
        }

        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($workspaces) || !isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
            return;
        }

        $normalized = sanitize_text_field(trim(preg_replace('/\s+Canvas$/', '', $post_title) ?? $post_title));
        if ($normalized === '') {
            return;
        }

        if (($workspaces[$workspace_id]['name'] ?? '') === $normalized) {
            return;
        }

        $workspaces[$workspace_id]['name'] = $normalized;
        update_user_meta($user_id, 'sd_workspaces', $workspaces);
    }

    private static function remove_workspace_from_user_meta(int $user_id, string $workspace_id): void
    {
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($workspaces)) {
            return;
        }

        if (isset($workspaces[$workspace_id])) {
            unset($workspaces[$workspace_id]);
            update_user_meta($user_id, 'sd_workspaces', $workspaces);
        }

        delete_user_meta($user_id, 'sd_workspace_' . sanitize_title($workspace_id));
    }

    private static function delete_workspace_items(string $workspace_id, int $canvas_id): void
    {
        global $wpdb;
        $table_items = $wpdb->prefix . 'sd_items';

        $keys = array_values(array_filter(array_unique([
            sanitize_key($workspace_id),
            (string) (int) $canvas_id,
        ])));

        foreach ($keys as $workspace_key) {
            $wpdb->delete($table_items, ['workspace_id' => $workspace_key], ['%s']);
        }
    }

    private static function normalize_canvas_grid_block(string $content): string
    {
        if ($content === '') {
            return $content;
        }

        $updated = str_replace(
            ['<!-- wp:grid ', '<!-- /wp:grid -->', 'wp-block-grid', '"layout":{"type":"constrained"}'],
            ['<!-- wp:systemdeck/canvas-grid ', '<!-- /wp:systemdeck/canvas-grid -->', 'wp-block-systemdeck-canvas-grid', '"layout":{"type":"default"}'],
            $content
        );
        $updated = str_replace('sd-canvas-shell__grid', 'sd-canvas-grid-host', $updated);

        if (strpos($updated, '<!-- wp:systemdeck/canvas-grid') === false) {
            $updated = preg_replace(
                '/(<!-- wp:group [^>]*sd-canvas-shell[^>]*-->\\s*<div[^>]*sd-canvas-shell[^>]*>)/',
                "$1\n<!-- wp:systemdeck/canvas-grid {\"lock\":{\"move\":true,\"remove\":true}} -->\n<div class=\"wp-block-systemdeck-canvas-grid sd-canvas-grid-host\" data-sd-grid-host=\"1\"></div>\n<!-- /wp:systemdeck/canvas-grid -->",
                $updated,
                1
            ) ?: $updated;
        }

        if (function_exists('parse_blocks') && function_exists('serialize_blocks')) {
            $blocks = parse_blocks($updated);
            if (is_array($blocks) && !empty($blocks)) {
                $blocks = self::normalize_canvas_structure($blocks, false);
                $updated = serialize_blocks($blocks);
            }
        }

        return $updated;
    }

    /**
     * @param array<int,array<string,mixed>> $blocks
     * @return array<int,array<string,mixed>>
     */
    private static function normalize_canvas_structure(array $blocks, bool $in_canvas_grid): array
    {
        $out = [];
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }
            $name = (string) ($block['blockName'] ?? '');
            $inner = is_array($block['innerBlocks'] ?? null) ? $block['innerBlocks'] : [];
            $child_in_grid = $in_canvas_grid || $name === 'systemdeck/canvas-grid';
            if (!empty($inner)) {
                $block['innerBlocks'] = self::normalize_canvas_structure($inner, $child_in_grid);
            }

            if (
                $in_canvas_grid
                && ($name === 'core/row' || $name === 'core/group' || $name === 'core/columns' || $name === 'core/column')
            ) {
                foreach ((array) ($block['innerBlocks'] ?? []) as $child) {
                    if (is_array($child)) {
                        $out[] = $child;
                    }
                }
                continue;
            }

            $out[] = $block;
        }

        return $out;
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

}
