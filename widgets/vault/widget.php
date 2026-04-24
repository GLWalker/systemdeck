<?php

/**
 * SystemDeck Vault Module
 * A secure drag-and-drop file manager widget for workspaces.
 */

declare(strict_types=1);

namespace SystemDeck\Widgets;

use SystemDeck\Core\VaultManager;

if (!defined('ABSPATH')) {
    exit;
}

class Vault extends BaseWidget
{
    private const STATE_SCHEMA_VERSION = '2026-03-26-vault-first';
    public const ID = 'core.vault';
    public const TITLE = 'File Vault';
    public const ICON = 'dashicons-portfolio';

    private const CPT = 'sd_vault_file';
    private const STORAGE_MODE_META_KEY = '_sd_vault_storage_mode';
    private const VAULT_PATH_META_KEY = '_sd_vault_vault_path';
    private const ATTACHMENT_ID_META_KEY = '_sd_vault_wp_attachment_id';
    private const IS_PUBLIC_META_KEY = '_sd_vault_is_public';
    private const ORIGIN_META_KEY = '_sd_vault_origin';
    private const ORIGIN_WORKSPACE_ID_META_KEY = '_sd_vault_origin_workspace_id';
    private const ORIGIN_WORKSPACE_NAME_META_KEY = '_sd_vault_origin_workspace_name';
    private const WORKSPACE_NAME_META_KEY = '_sd_vault_workspace_name';
    private const MIDI_ACTIVE_DERIVATIVE_META_KEY = '_sd_midi_derivative_json';
    private const MIDI_GENERATED_DERIVATIVE_META_KEY = '_sd_midi_generated_derivative_json';
    private const MIDI_SOURCE_HASH_META_KEY = '_sd_midi_source_hash';
    private const MIDI_DERIVATIVE_HASH_META_KEY = '_sd_midi_derivative_hash';
    private const MIDI_DERIVATIVE_VERSION_META_KEY = '_sd_midi_derivative_version';
    private const MIDI_PARSER_VERSION_META_KEY = '_sd_midi_parser_version';
    private const MIDI_IS_MODIFIED_META_KEY = '_sd_midi_is_modified';
    private const MIDI_LAST_GENERATED_AT_META_KEY = '_sd_midi_last_generated_at';
    private const MIDI_LAST_MODIFIED_AT_META_KEY = '_sd_midi_last_modified_at';
    private const MIDI_LAST_REBUILT_AT_META_KEY = '_sd_midi_last_rebuilt_at';

    private static int $vault_private_upload_scope_depth = 0;

    public static function assets(): array
    {
        return [
            'css' => ['style.css', 'sd-vault-media.css', 'sd-player-style'],
            'js' => ['sd-audio-engine', 'sd-player-app', 'app.js']
        ];
    }

    public static function requires_wp_media(): bool
    {
        return true;
    }

    public static function register_vault(): void
    {
        // Boot the security directory watcher and stream handler
        if (class_exists(VaultManager::class)) {
            VaultManager::init();
        }

        register_post_type(self::CPT, [
            'label' => __('SystemDeck Vault File', 'systemdeck'),
            'public' => false,
            'show_ui' => true, // Allowed for debug
            'show_in_menu' => false,
            'menu_icon' => self::ICON,
            'capability_type' => 'post',
            'supports' => ['title', 'editor', 'author', 'excerpt', 'comments'],
            'map_meta_cap' => true,
            'can_export' => true
        ]);

        self::maybe_normalize_existing_items();

        add_filter('manage_sd_vault_file_posts_columns', [self::class, 'manage_admin_columns']);
        add_action('manage_sd_vault_file_posts_custom_column', [self::class, 'render_admin_columns'], 10, 2);
        add_action('add_meta_boxes', [self::class, 'add_meta_boxes']);
        add_action('save_post_sd_vault_file', [self::class, 'save_meta_boxes']);
        add_action('wp_ajax_sd_core_vault_ajax_upload_file', [self::class, 'handle_ajax_upload_file']);
        add_action('wp_ajax_sd_core_vault_ajax_link_attachment', [self::class, 'handle_ajax_link_attachment']);
        add_action('wp_ajax_sd_core_vault_ajax_get_files', [self::class, 'handle_ajax_get_files']);
        add_action('wp_ajax_sd_core_vault_ajax_delete_file', [self::class, 'handle_ajax_delete_file']);
        add_action('wp_ajax_sd_core_vault_ajax_import_from_media_library', [self::class, 'handle_ajax_import_from_media_library']);
        add_action('wp_ajax_sd_core_vault_ajax_export_to_media_library', [self::class, 'handle_ajax_export_to_media_library']);
        add_action('wp_ajax_sd_core_vault_ajax_make_private', [self::class, 'handle_ajax_make_private']);
        add_action('wp_ajax_sd_core_vault_ajax_get_file_comments', [self::class, 'handle_ajax_get_file_comments']);
        add_action('wp_ajax_sd_core_vault_ajax_add_file_comment', [self::class, 'handle_ajax_add_file_comment']);
        add_action('wp_ajax_sd_toggle_vault_sticky', [self::class, 'handle_ajax_toggle_vault_sticky']);
        add_action('wp_ajax_sd_core_vault_ajax_get_file_details', [self::class, 'handle_ajax_get_file_details']);
        add_action('wp_ajax_sd_core_vault_ajax_save_file_details', [self::class, 'handle_ajax_save_file_details']);
        add_action('wp_ajax_sd_core_vault_ajax_get_midi_editor_payload', [self::class, 'handle_ajax_get_midi_editor_payload']);
        add_action('wp_ajax_sd_core_vault_ajax_validate_midi_derivative', [self::class, 'handle_ajax_validate_midi_derivative']);
        add_action('wp_ajax_sd_core_vault_ajax_save_midi_derivative', [self::class, 'handle_ajax_save_midi_derivative']);
        add_action('wp_ajax_sd_core_vault_ajax_rebuild_midi_derivative', [self::class, 'handle_ajax_rebuild_midi_derivative']);
    }

    private static function maybe_normalize_existing_items(): void
    {
        $option_key = 'sd_vault_state_schema_version';
        if ((string) get_option($option_key) === self::STATE_SCHEMA_VERSION) {
            return;
        }

        $query = new \WP_Query([
            'post_type' => self::CPT,
            'post_status' => ['publish', 'private', 'inherit'],
            'posts_per_page' => -1,
            'fields' => 'ids',
            'no_found_rows' => true,
        ]);

        foreach ((array) $query->posts as $post_id) {
            self::normalize_file_state((int) $post_id);
        }

        update_option($option_key, self::STATE_SCHEMA_VERSION, false);
    }

    private static function check_vault_nonce()
    {
        // F-13 FIX: Standardize on single nonce action. The legacy secondary nonce
        // weakened CSRF protection by allowing one action's token to validate another.
        if (!check_ajax_referer('systemdeck_runtime', '_ajax_nonce', false)) {
            wp_send_json_error('Security check failed');
        }
    }

    public static function handle_ajax_upload_file()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_upload_file($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_link_attachment()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_link_attachment($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_get_files()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_get_files($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_delete_file()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_delete_file($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_import_from_media_library()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_import_from_media_library($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_export_to_media_library()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_export_to_media_library($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_make_private()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_make_private($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_get_file_details()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_get_file_details($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_save_file_details()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_save_file_details($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_get_midi_editor_payload()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_get_midi_editor_payload($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_validate_midi_derivative()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_validate_midi_derivative($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_save_midi_derivative()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_save_midi_derivative($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_rebuild_midi_derivative()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_rebuild_midi_derivative($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_get_file_comments()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_get_file_comments($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_add_file_comment()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_add_file_comment($_POST));
        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public static function handle_ajax_toggle_vault_sticky()
    {
        self::check_vault_nonce();
        try {
            wp_send_json_success(self::ajax_toggle_vault_sticky($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['message' => $e->getMessage()]);
        }
    }

    public static function manage_admin_columns($columns)
    {
        $columns['sd_vault_scope'] = __('Workspace', 'systemdeck');
        $columns['sd_vault_file_path'] = __('Physical Path', 'systemdeck');
        return $columns;
    }

    public static function render_admin_columns($column, $post_id)
    {
        switch ($column) {
            case 'sd_vault_scope':
                $scope = get_post_meta($post_id, '_sd_vault_scope', true);
                $scope = self::normalize_scope_value((string) $scope);
                if ($scope === 'pinned') {
                    $ws_id = get_post_meta($post_id, '_sd_vault_workspace_id', true);
                    echo '<b>Pinned</b> (ID: ' . esc_html($ws_id) . ')';
                } else {
                    echo 'Private';
                }
                break;
            case 'sd_vault_file_path':
                $path = get_post_meta($post_id, '_sd_attached_file', true);
                echo '<code>' . esc_html($path) . '</code>';
                break;
        }
    }

    public static function add_meta_boxes()
    {
        add_meta_box('sd_vault_meta_box', __('Vault File Details', 'systemdeck'), [self::class, 'render_file_meta_box'], self::CPT, 'normal', 'high');
    }

    public static function render_file_meta_box($post)
    {
        wp_nonce_field('sd_vault_meta_nonce', 'sd_vault_meta_nonce_val');
        $path = get_post_meta($post->ID, '_sd_attached_file', true);
        $mime = get_post_meta($post->ID, '_sd_vault_mime_type', true);
        $size = get_post_meta($post->ID, '_sd_vault_file_size', true);

        echo '<p><strong>File Path (Relative to Vault):</strong><br><code>' . esc_html($path) . '</code></p>';
        echo '<p><strong>MIME Type:</strong> ' . esc_html($mime) . '</p>';
        echo '<p><strong>Size:</strong> ' . esc_html(size_format((int)$size)) . '</p>';

        $scope = self::normalize_scope_value((string) get_post_meta($post->ID, '_sd_vault_scope', true));
        echo '<p><strong>Workspace Assignment:</strong><br/>';
        echo '<label><input type="radio" name="sd_vault_scope" value="private" ' . checked($scope, 'private', false) . '/> Private (Not pinned)</label><br/>';
        echo '<label><input type="radio" name="sd_vault_scope" value="pinned" ' . checked($scope, 'pinned', false) . '/> Pin to Workspace</label></p>';
    }

    public static function save_meta_boxes($post_id)
    {
        if (!isset($_POST['sd_vault_meta_nonce_val']) || !wp_verify_nonce($_POST['sd_vault_meta_nonce_val'], 'sd_vault_meta_nonce')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        $scope = self::normalize_scope_value(empty($_POST['sd_vault_scope']) ? 'private' : sanitize_text_field((string) $_POST['sd_vault_scope']));
        update_post_meta($post_id, '_sd_vault_scope', $scope);
    }

    protected static function output(array $context): void
    {
        $workspace_id = (string)($context['workspace_id'] ?? '');
?>
        <div class="sd-vault-wrapper" id="sd-vault-widget" data-workspace-id="<?php echo esc_attr($workspace_id); ?>">

            <div class="sd-vault-recent">
                <div class="sd-toolbar">
                    <input type="file" id="sd-vault-file-input" class="sd-hidden" />
                    <button type="button" class="button button-small button-primary" id="sd-vault-upload-file">
                        <span class="dashicons dashicons-upload sd-button-icon" aria-hidden="true"></span>
                        <?php _e('Upload to Vault', 'systemdeck'); ?>
                    </button>
                    <button type="button" class="button button-small" id="sd-vault-open-media">
                        <span class="dashicons dashicons-admin-media sd-button-icon" aria-hidden="true"></span>
                        <?php _e('Add from Media Library', 'systemdeck'); ?>
                    </button>
                </div>

                <table class="wp-list-table widefat fixed striped sd-vault-table" id="sd-vault-table" style="display:none;">
                    <thead>
                        <tr>
                            <th scope="col" class="column-sticky"><span class="dashicons dashicons-admin-post" aria-hidden="true"></span></th>
                            <th scope="col" class="column-title"><?php _e('Title', 'systemdeck'); ?></th>
                            <th scope="col" class="column-workspace"><?php _e('Workspace', 'systemdeck'); ?></th>
                            <th scope="col" class="column-size"><?php _e('Size', 'systemdeck'); ?></th>
                            <th scope="col" class="column-comments"><span class="dashicons dashicons-admin-comments" title="Comments" aria-hidden="true"></span></th>
                            <th scope="col" class="column-date"><?php _e('Date', 'systemdeck'); ?></th>
                        </tr>
                    </thead>
                    <tbody id="sd-vault-list">
                        <tr class="loading-text">
                            <td colspan="6"><?php _e('Loading files...', 'systemdeck'); ?></td>
                        </tr>
                    </tbody>
                </table>

                <div class="sd-vault-empty-state" id="sd-vault-empty-state" style="display:none;">
                    <?php _e('No files found in your vault.', 'systemdeck'); ?>
                </div>

                <div class="tablenav bottom sd-pagination sd-vault-pagination" id="sd-vault-pagination" style="display:none;">
                    <div class="alignleft actions">
                        <span class="displaying-num" id="sd-vault-total-count"></span>
                    </div>
                    <div class="tablenav-pages">
                        <span class="pagination-links">
                            <button type="button" class="button button-small" id="sd-vault-prev" disabled>&lsaquo;</button>
                            <span class="paging-input">
                                <span id="sd-vault-current-page">1</span> <?php _e('of', 'systemdeck'); ?> <span id="sd-vault-total-pages">1</span>
                            </span>
                            <button type="button" class="button button-small" id="sd-vault-next" disabled>&rsaquo;</button>
                        </span>
                    </div>
                </div>
            </div>

            <!-- File Details/Edit Modal -->
            <div id="sd-vault-details-modal" class="sd-vault-details-shell-modal" style="display:none;">

                <div tabindex="0" class="media-modal wp-core-ui" role="dialog" aria-labelledby="media-frame-title">

                    <div class="media-modal-content" role="document">
                        <div class="edit-attachment-frame media-frame mode-select hide-menu hide-router hide-toolbar">
                            <div class="edit-media-header">
                                <button type="button" class="left dashicons" id="sd-vault-details-prev" disabled>
                                    <span class="screen-reader-text"><?php _e('Edit previous vault item', 'systemdeck'); ?></span>
                                </button>

                                <button type="button" class="right dashicons" id="sd-vault-details-next" disabled>
                                    <span class="screen-reader-text"><?php _e('Edit next vault item', 'systemdeck'); ?></span>
                                </button>

                                <button type="button" class="media-modal-close" id="sd-vault-details-close">
                                    <span class="media-modal-icon" aria-hidden="true"></span>
                                    <span class="screen-reader-text"><?php _e('Close dialog', 'systemdeck'); ?></span>
                                </button>

                            </div>

                            <div class="media-frame-title">
                                <h1 id="sd-vault-details-modal-title"><?php _e('Attachment details', 'systemdeck'); ?></h1>
                            </div>

                            <div class="media-frame-content">

                                <div id="sd-vault-attachment-details" class="attachment-details save-ready">

                                    <div class="attachment-media-view portrait" id="sd-vault-details-media-view">

                                        <h2 class="screen-reader-text"><?php _e('Attachment Preview', 'systemdeck'); ?></h2>

                                        <div class="thumbnail" id="sd-vault-details-preview-shell">
                                            <div class="attachment-actions" id="sd-vault-details-preview-actions" style="display:none;"></div>

                                        </div>

                                    </div>

                                    <div class="attachment-info">
                                        <span class="settings-save-status" role="status">
                                            <span class="spinner"></span>
                                            <span class="saved"><?php esc_html_e('Saved.', 'systemdeck'); ?></span>
                                        </span>
                                        <div class="details">
                                            <h2 class="screen-reader-text"><?php _e('Details', 'systemdeck'); ?></h2>
                                            <span id="sd-vault-priority-badge" class="sd-status-badge is-low" style="display:none;"></span>
                                            <div class="uploaded"><strong><?php _e('Uploaded on:', 'systemdeck'); ?></strong> <span id="sd-vault-details-uploaded"></span></div>
                                            <div class="uploaded-by word-wrap-break-word">
                                                <strong><?php _e('Uploaded by:', 'systemdeck'); ?></strong>
                                                <span id="sd-vault-details-author"></span>
                                            </div>
                                            <div class="uploaded-to">
                                                <strong><?php _e('Uploaded to:', 'systemdeck'); ?></strong>
                                                <span id="sd-vault-details-workspace"></span>
                                            </div>
                                            <div class="status">
                                                <strong><?php _e('Status:', 'systemdeck'); ?></strong>
                                                <span id="sd-vault-details-status"></span>
                                            </div>
                                            <div class="filename"><strong><?php _e('File name:', 'systemdeck'); ?></strong> <span id="sd-vault-details-filename"></span></div>
                                            <div class="file-type"><strong><?php _e('File type:', 'systemdeck'); ?></strong> <span id="sd-vault-details-filetype"></span></div>
                                            <div class="file-size"><strong><?php _e('File size:', 'systemdeck'); ?></strong> <span id="sd-vault-details-filesize"></span></div>
                                            <div class="dimensions" id="sd-vault-details-dimensions-row" style="display:none;"><strong><?php _e('Dimensions:', 'systemdeck'); ?></strong> <span id="sd-vault-details-dimensions"></span></div>
                                            <div class="file-length" id="sd-vault-details-length-row" style="display:none;"><strong><?php _e('Length:', 'systemdeck'); ?></strong> <span id="sd-vault-details-length"></span></div>
                                            <div class="bitrate" id="sd-vault-details-bitrate-row" style="display:none;"><strong><?php _e('Bitrate:', 'systemdeck'); ?></strong> <span id="sd-vault-details-bitrate"></span></div>
                                            <div class="compat-meta"></div>
                                        </div>

                                        <div class="settings">
                                            <input type="hidden" id="sd-vault-details-id" value="">

                                            <span class="setting alt-text has-description" data-setting="alt" id="sd-vault-details-alt-setting">
                                                <label for="sd-vault-details-alt-text" class="name"><?php _e('Alternative Text', 'systemdeck'); ?></label>
                                                <textarea id="sd-vault-details-alt-text" aria-describedby="sd-vault-alt-text-description"></textarea>
                                            </span>
                                            <p class="description" id="sd-vault-alt-text-description"><?php _e('Describe the purpose of the file when relevant. Leave empty if decorative or not applicable.', 'systemdeck'); ?></p>

                                            <span class="setting" data-setting="title">
                                                <label for="sd-vault-details-title" class="name"><?php _e('Title', 'systemdeck'); ?></label>
                                                <input type="text" id="sd-vault-details-title">
                                            </span>

                                            <span class="setting" data-setting="artist" id="sd-vault-details-artist-setting" style="display:none;">
                                                <label for="sd-vault-details-artist" class="name"><?php _e('Artist', 'systemdeck'); ?></label>
                                                <input type="text" id="sd-vault-details-artist">
                                            </span>

                                            <span class="setting" data-setting="album" id="sd-vault-details-album-setting" style="display:none;">
                                                <label for="sd-vault-details-album" class="name"><?php _e('Album', 'systemdeck'); ?></label>
                                                <input type="text" id="sd-vault-details-album">
                                            </span>

                                            <span class="setting" data-setting="caption">
                                                <label for="sd-vault-details-caption" class="name"><?php _e('Caption', 'systemdeck'); ?></label>
                                                <textarea id="sd-vault-details-caption"></textarea>
                                            </span>

                                            <span class="setting" data-setting="description">
                                                <label for="sd-vault-details-description" class="name"><?php _e('Description', 'systemdeck'); ?></label>
                                                <textarea id="sd-vault-details-description"></textarea>
                                            </span>

                                            <span class="setting" data-setting="url">
                                                <label for="sd-vault-details-copy-link" class="name"><?php _e('File URL:', 'systemdeck'); ?></label>
                                                <input type="text" class="attachment-details-copy-link" id="sd-vault-details-copy-link" readonly>
                                                <span class="copy-to-clipboard-container">
                                                    <button type="button" class="button button-small copy-attachment-url" data-clipboard-target="#sd-vault-details-copy-link"><?php _e('Copy URL to clipboard', 'systemdeck'); ?></button>
                                                    <span class="success hidden" aria-hidden="true"><?php _e('Copied!', 'systemdeck'); ?></span>
                                                </span>
                                            </span>

                                            <div class="attachment-compat">
                                                <div class="compat-item" id="sd-vault-details-extension">
                                                    <div class="label" aria-hidden="true"></div>
                                                    <div class="field">
                                                        <div class="sd-vault-media-extension">
                                                            <span class="setting" data-setting="pin">
                                                                <label class="name" for="sd-vault-details-is-shared"><?php _e('Pin File', 'systemdeck'); ?></label>
                                                                <span class="value">
                                                                    <label class="sd-checkbox-label">
                                                                        <input type="checkbox" id="sd-vault-details-is-shared" value="1">
                                                                        <?php _e('Pin this file into the active workspace', 'systemdeck'); ?>
                                                                    </label>
                                                                </span>
                                                            </span>

                                                            <span class="setting" id="sd-vault-details-priority-wrap" style="display:none;">
                                                                <span class="name"><?php _e('Priority', 'systemdeck'); ?></span>
                                                                <span class="value sd-vault-priority-options">
                                                                    <label><input type="radio" name="sd_vault_priority" value="urgent"> <?php _e('Urgent', 'systemdeck'); ?></label>
                                                                    <label><input type="radio" name="sd_vault_priority" value="high"> <?php _e('High', 'systemdeck'); ?></label>
                                                                    <label><input type="radio" name="sd_vault_priority" value="moderate"> <?php _e('Moderate', 'systemdeck'); ?></label>
                                                                    <label><input type="radio" name="sd_vault_priority" value="low" checked> <?php _e('Low', 'systemdeck'); ?></label>
                                                                </span>
                                                            </span>

                                                            <p class="description" id="sd-vault-details-readonly-note" style="display:none;"><?php _e('This file is currently public. Use Media Library for attachment field edits; Vault controls remain available below.', 'systemdeck'); ?></p>

                                                            <div class="sd-vault-details-save-row">
                                                                <button type="button" class="button button-primary" id="sd-vault-save-details"><?php _e('Update', 'systemdeck'); ?></button>
                                                            </div>

                                                            <div class="sd-vault-media-comments">
                                                                <div class="sd-vault-media-comments-heading"><?php _e('Comments', 'systemdeck'); ?></div>
                                                                <div id="sd-vault-details-comments-list">
                                                                    <p style="padding:15px; color:#646970;"><?php _e('Loading discussion...', 'systemdeck'); ?></p>
                                                                </div>
                                                                <div class="sd-vault-comment-form" style="margin-top: 12px;">
                                                                    <textarea id="sd-vault-details-new-comment" class="widefat" rows="4" placeholder="<?php esc_attr_e('Write a comment...', 'systemdeck'); ?>"></textarea>
                                                                    <input type="hidden" id="sd-vault-details-parent-comment" value="0">
                                                                    <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                                                                        <button type="button" class="button button-primary" id="sd-vault-details-save-comment"><?php _e('Post Comment', 'systemdeck'); ?></button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="actions">
                                            <a class="view-attachment" href="#" id="sd-vault-open-public-link" style="display:none;"><?php _e('View media file', 'systemdeck'); ?></a>
                                            <span class="links-separator" id="sd-vault-open-public-sep" style="display:none;">|</span>
                                            <a href="#" id="sd-vault-open-media-details" style="display:none;"><?php _e('Edit more details', 'systemdeck'); ?></a>
                                            <span class="links-separator" id="sd-vault-open-media-sep" style="display:none;">|</span>
                                            <a href="#" id="sd-vault-download-details" download style="display:none;"><?php _e('Download file', 'systemdeck'); ?></a>
                                            <span class="links-separator" id="sd-vault-download-sep" style="display:none;">|</span>
                                            <button type="button" class="button-link delete-attachment" id="sd-vault-delete-details" style="display:none;"><?php _e('Delete permanently', 'systemdeck'); ?></button>
                                            <span class="links-separator" id="sd-vault-export-sep" style="display:none;">|</span>
                                            <button type="button" class="button-link" id="sd-vault-export-details" style="display:none;"><?php _e('Publish to Media Library', 'systemdeck'); ?></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="media-modal-backdrop"></div>
            </div>

            <div id="sd-vault-comments-modal" class="sd-modal-overlay sd-note-view-modal sd-vault-context" style="display:none;">
                <div class="components-modal__frame components-modal" role="dialog" tabindex="-1">
                    <div class="components-modal__content" role="document">
                        <div class="components-modal__header">
                            <div class="components-modal__header-heading-container">
                                <h1 id="sd-vault-comment-file-title" class="components-modal__header-heading"></h1>
                            </div>

                            <div class="sd-vault-comments-modal-header-actions">
                                <span id="sd-vault-comment-file-urgency" class="sd-status-badge is-low sd-hidden"></span>
                                <button type="button" class="components-button has-icon" id="sd-vault-comments-close" aria-label="<?php esc_attr_e('Close dialog', 'systemdeck'); ?>">
                                    <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="sd-vault-comments-modal-body">
                            <div class="sd-vault-read-layout">
                                <div id="sd-vault-read-preview" class="sd-vault-read-preview"></div>
                                <div id="sd-vault-read-meta" class="sd-vault-read-meta"></div>
                            </div>

                            <input type="hidden" id="sd-vault-comment-file-id" value="">

                            <div class="sd-vault-comments-section">
                                <h4><?php _e('Discussion', 'systemdeck'); ?></h4>
                                <div id="sd-vault-comments-list"></div>

                                <div class="sd-vault-comment-form">
                                    <div class="textarea-wrap">
                                        <textarea id="sd-vault-new-comment" class="widefat" rows="4" placeholder="<?php esc_attr_e('Write a comment...', 'systemdeck'); ?>"></textarea>
                                    </div>
                                    <input type="hidden" id="sd-vault-parent-comment" value="0">
                                    <p class="submit">
                                        <button type="button" class="button button-primary" id="sd-vault-save-comment"><?php _e('Post Comment', 'systemdeck'); ?></button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
<?php
    }

    private static function resolve_workspace_name(string $workspace_id): string
    {
        $workspace_id = sanitize_text_field($workspace_id);
        if ($workspace_id === '') {
            return '';
        }

        $bootstrap = function_exists('systemdeck_boot_payload') ? systemdeck_boot_payload() : [];
        $workspaces = is_array($bootstrap['workspaces'] ?? null) ? $bootstrap['workspaces'] : [];
        if (isset($workspaces[$workspace_id]) && is_array($workspaces[$workspace_id])) {
            return sanitize_text_field((string) ($workspaces[$workspace_id]['name'] ?? $workspaces[$workspace_id]['title'] ?? $workspace_id));
        }

        foreach ($workspaces as $workspace) {
            if (!is_array($workspace)) {
                continue;
            }
            if ((string) ($workspace['id'] ?? '') === $workspace_id) {
                return sanitize_text_field((string) ($workspace['name'] ?? $workspace['title'] ?? $workspace_id));
            }
        }

        return $workspace_id;
    }

    public static function filter_upload_dir($dirs)
    {
        $user_id = max(0, (int) get_current_user_id());
        $custom_dir = '/systemdeck-vault/' . $user_id;
        $dirs['subdir'] = '';
        $dirs['path']   = $dirs['basedir'] . $custom_dir;
        $dirs['url']    = $dirs['baseurl'] . $custom_dir;
        return $dirs;
    }

    private static function begin_vault_private_upload_scope(): void
    {
        if (self::$vault_private_upload_scope_depth === 0) {
            add_filter('intermediate_image_sizes_advanced', [self::class, 'suppress_private_image_subsizes'], 9999, 3);
            add_filter('big_image_size_threshold', [self::class, 'disable_private_big_image_scaling'], 9999, 4);
        }

        self::$vault_private_upload_scope_depth++;
    }

    private static function end_vault_private_upload_scope(): void
    {
        if (self::$vault_private_upload_scope_depth <= 0) {
            self::$vault_private_upload_scope_depth = 0;
            return;
        }

        self::$vault_private_upload_scope_depth--;
        if (self::$vault_private_upload_scope_depth === 0) {
            remove_filter('intermediate_image_sizes_advanced', [self::class, 'suppress_private_image_subsizes'], 9999);
            remove_filter('big_image_size_threshold', [self::class, 'disable_private_big_image_scaling'], 9999);
        }
    }

    private static function is_vault_private_upload_scope_active(): bool
    {
        return self::$vault_private_upload_scope_depth > 0;
    }

    public static function suppress_private_image_subsizes($new_sizes, $image_meta = [], $attachment_id = 0)
    {
        if (!self::is_vault_private_upload_scope_active()) {
            return $new_sizes;
        }

        return [];
    }

    public static function disable_private_big_image_scaling($threshold, $imagesize = [], $file = '', $attachment_id = 0)
    {
        if (!self::is_vault_private_upload_scope_active()) {
            return $threshold;
        }

        return false;
    }

    private static function normalize_storage_mode_value(string $storage_mode): string
    {
        return $storage_mode === 'media_public' ? 'media_public' : 'vault_private';
    }

    private static function normalize_origin_value(string $origin): string
    {
        return $origin === 'media' ? 'media' : 'vault';
    }

    private static function normalize_scope_value(string $scope): string
    {
        $scope = strtolower(trim($scope));
        return $scope === 'pinned' ? 'pinned' : 'private';
    }

    private static function get_scope_value(int $post_id): string
    {
        return self::normalize_scope_value((string) get_post_meta($post_id, '_sd_vault_scope', true));
    }

    private static function get_vault_path_value(int $post_id): string
    {
        $vault_path = (string) get_post_meta($post_id, self::VAULT_PATH_META_KEY, true);
        if ($vault_path === '') {
            $vault_path = (string) get_post_meta($post_id, '_sd_attached_file', true);
        }

        return VaultManager::normalize_vault_relative_path($vault_path);
    }

    private static function set_vault_path_value(int $post_id, string $vault_path): void
    {
        $vault_path = VaultManager::normalize_vault_relative_path($vault_path);
        if ($vault_path === '') {
            delete_post_meta($post_id, self::VAULT_PATH_META_KEY);
            delete_post_meta($post_id, '_sd_attached_file');
            return;
        }

        update_post_meta($post_id, self::VAULT_PATH_META_KEY, $vault_path);
        update_post_meta($post_id, '_sd_attached_file', $vault_path);
    }

    private static function get_storage_mode(int $post_id): string
    {
        return self::normalize_storage_mode_value((string) get_post_meta($post_id, self::STORAGE_MODE_META_KEY, true));
    }

    private static function get_origin(int $post_id): string
    {
        return self::normalize_origin_value((string) get_post_meta($post_id, self::ORIGIN_META_KEY, true));
    }

    private static function is_public_item(int $post_id): bool
    {
        return (bool) get_post_meta($post_id, self::IS_PUBLIC_META_KEY, true);
    }

    /**
     * Normalize legacy/hybrid records into explicit state so runtime/UI do not
     * infer authority from attachment presence or path shape.
     */
    private static function normalize_file_state(int $post_id): array
    {
        $attachment_id = self::get_linked_attachment_id($post_id);
        $vault_path = self::get_vault_path_value($post_id);
        $storage_mode = (string) get_post_meta($post_id, self::STORAGE_MODE_META_KEY, true);
        $origin = (string) get_post_meta($post_id, self::ORIGIN_META_KEY, true);
        $is_public_meta = get_post_meta($post_id, self::IS_PUBLIC_META_KEY, true);

        if ($storage_mode === '') {
            $storage_mode = ($attachment_id > 0 && $vault_path === '') ? 'media_public' : 'vault_private';
        }
        $storage_mode = self::normalize_storage_mode_value($storage_mode);

        if ($origin === '') {
            $origin = ($attachment_id > 0 && $vault_path === '') ? 'media' : 'vault';
        }
        $origin = self::normalize_origin_value($origin);

        $is_public = $is_public_meta === '' ? ($storage_mode === 'media_public') : (bool) $is_public_meta;

        update_post_meta($post_id, self::STORAGE_MODE_META_KEY, $storage_mode);
        update_post_meta($post_id, self::IS_PUBLIC_META_KEY, $is_public ? '1' : '0');
        update_post_meta($post_id, self::ORIGIN_META_KEY, $origin);
        self::set_vault_path_value($post_id, $vault_path);

        return [
            'storage_mode' => $storage_mode,
            'vault_path' => $vault_path,
            'attachment_id' => $attachment_id,
            'is_public' => $is_public,
            'origin' => $origin,
        ];
    }

    private static function build_private_stream_url(int $post_id): string
    {
        return site_url('?sd_vault_stream=' . $post_id);
    }

    private static function get_vault_absolute_path(int $post_id): string
    {
        return VaultManager::resolve_absolute_path(self::get_vault_path_value($post_id));
    }

    private static function maybe_delete_managed_public_attachment(int $post_id): void
    {
        $attachment_id = self::get_linked_attachment_id($post_id);
        if ($attachment_id <= 0) {
            return;
        }

        if (self::get_origin($post_id) !== 'vault') {
            return;
        }

        wp_delete_attachment($attachment_id, true);
        delete_post_meta($post_id, self::ATTACHMENT_ID_META_KEY);
    }

    private static function is_midi_file(string $mime, string $filename): bool
    {
        $mime_lc = strtolower($mime);
        $name_lc = strtolower($filename);
        return strpos($mime_lc, 'midi') !== false
            || str_ends_with($name_lc, '.mid')
            || str_ends_with($name_lc, '.midi');
    }

    private static function find_existing_midi_derivative(
        string $source_hash,
        string $parser_version,
        string $derivative_version
    ): ?array {
        if ($source_hash === '' || $parser_version === '' || $derivative_version === '') {
            return null;
        }

        $query = new \WP_Query([
            'post_type' => self::CPT,
            'post_status' => ['publish', 'private', 'inherit'],
            'posts_per_page' => 1,
            'fields' => 'ids',
            'meta_query' => [
                [
                    'key' => self::MIDI_SOURCE_HASH_META_KEY,
                    'value' => $source_hash,
                ],
                [
                    'key' => self::MIDI_PARSER_VERSION_META_KEY,
                    'value' => $parser_version,
                ],
                [
                    'key' => self::MIDI_DERIVATIVE_VERSION_META_KEY,
                    'value' => $derivative_version,
                ],
            ],
        ]);

        $post_id = isset($query->posts[0]) ? (int) $query->posts[0] : 0;
        if (!$post_id) {
            return null;
        }

        $json = self::get_generated_midi_json($post_id);
        if ($json === '') {
            return null;
        }

        return [
            'json' => $json,
            'source_hash' => (string) get_post_meta($post_id, self::MIDI_SOURCE_HASH_META_KEY, true),
            'derivative_hash' => (string) get_post_meta($post_id, self::MIDI_DERIVATIVE_HASH_META_KEY, true),
            'derivative_version' => (string) get_post_meta($post_id, self::MIDI_DERIVATIVE_VERSION_META_KEY, true),
            'parser_version' => (string) get_post_meta($post_id, self::MIDI_PARSER_VERSION_META_KEY, true),
        ];
    }

    private static function current_midi_timestamp(): string
    {
        return (string) current_time('mysql');
    }

    private static function get_generated_midi_json(int $post_id): string
    {
        $generated = (string) get_post_meta($post_id, self::MIDI_GENERATED_DERIVATIVE_META_KEY, true);
        if ($generated !== '') {
            return $generated;
        }
        return (string) get_post_meta($post_id, self::MIDI_ACTIVE_DERIVATIVE_META_KEY, true);
    }

    private static function get_active_midi_json(int $post_id): string
    {
        $active = (string) get_post_meta($post_id, self::MIDI_ACTIVE_DERIVATIVE_META_KEY, true);
        if ($active !== '') {
            return $active;
        }
        return self::get_generated_midi_json($post_id);
    }

    private static function decode_midi_derivative_json(string $json): ?array
    {
        if ($json === '') {
            return null;
        }

        $decoded = json_decode($json, true);
        if (!is_array($decoded) || ($decoded['schema'] ?? '') !== 'systemdeck-midi-derivative') {
            return null;
        }

        return $decoded;
    }

    private static function encode_midi_derivative_json(array $derivative): string
    {
        return (string) wp_json_encode($derivative, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    private static function count_midi_notes(array $derivative): int
    {
        $summary_count = intval($derivative['summary']['noteCount'] ?? 0);
        if ($summary_count > 0) {
            return $summary_count;
        }

        $count = 0;
        foreach (($derivative['tracks'] ?? []) as $track) {
            $count += count(is_array($track['notes'] ?? null) ? $track['notes'] : []);
        }
        return $count;
    }

    private static function build_midi_summary(?array $active, ?array $generated, int $post_id): array
    {
        $primary = $active ?: $generated ?: [];
        return [
            'source_hash' => (string) get_post_meta($post_id, self::MIDI_SOURCE_HASH_META_KEY, true),
            'derivative_hash' => (string) get_post_meta($post_id, self::MIDI_DERIVATIVE_HASH_META_KEY, true),
            'parser_version' => (string) get_post_meta($post_id, self::MIDI_PARSER_VERSION_META_KEY, true),
            'derivative_version' => (string) get_post_meta($post_id, self::MIDI_DERIVATIVE_VERSION_META_KEY, true),
            'track_count' => intval($primary['summary']['trackCount'] ?? count(is_array($primary['tracks'] ?? null) ? $primary['tracks'] : [])),
            'duration' => floatval($primary['summary']['duration'] ?? $primary['playback']['duration'] ?? 0),
            'note_count' => self::count_midi_notes($primary),
            'is_modified' => get_post_meta($post_id, self::MIDI_IS_MODIFIED_META_KEY, true) === '1',
            'last_generated_at' => (string) get_post_meta($post_id, self::MIDI_LAST_GENERATED_AT_META_KEY, true),
            'last_modified_at' => (string) get_post_meta($post_id, self::MIDI_LAST_MODIFIED_AT_META_KEY, true),
            'last_rebuilt_at' => (string) get_post_meta($post_id, self::MIDI_LAST_REBUILT_AT_META_KEY, true),
            'has_generated' => is_array($generated),
            'has_active' => is_array($active),
        ];
    }

    private static function read_midi_editor_payload(int $post_id): ?array
    {
        $active_json = self::get_active_midi_json($post_id);
        $generated_json = self::get_generated_midi_json($post_id);
        $active = self::decode_midi_derivative_json($active_json);
        $generated = self::decode_midi_derivative_json($generated_json);

        if (!is_array($active) && !is_array($generated)) {
            return null;
        }

        $active = is_array($active) ? $active : $generated;
        $generated = is_array($generated) ? $generated : $active;
        $active_json = is_string($active_json) && $active_json !== '' ? $active_json : self::encode_midi_derivative_json($active);
        $generated_json = is_string($generated_json) && $generated_json !== '' ? $generated_json : self::encode_midi_derivative_json($generated);

        return [
            'active_derivative' => $active,
            'active_json' => $active_json,
            'generated_derivative' => $generated,
            'generated_json' => $generated_json,
            'summary' => self::build_midi_summary($active, $generated, $post_id),
        ];
    }

    private static function persist_midi_derivative_pair(
        int $post_id,
        array $generated_derivative,
        array $active_derivative,
        bool $is_modified,
        array $meta = [],
        array $timestamps = []
    ): void {
        $generated_json = self::encode_midi_derivative_json($generated_derivative);
        $active_json = self::encode_midi_derivative_json($active_derivative);

        if ($generated_json === '' || $active_json === '') {
            return;
        }

        $source_hash = sanitize_text_field((string) ($meta['source_hash'] ?? $active_derivative['source']['hash'] ?? $generated_derivative['source']['hash'] ?? ''));
        $parser_version = sanitize_text_field((string) ($meta['parser_version'] ?? $active_derivative['parser']['version'] ?? $generated_derivative['parser']['version'] ?? ''));
        $derivative_version = sanitize_text_field((string) ($meta['derivative_version'] ?? $active_derivative['version'] ?? $generated_derivative['version'] ?? ''));

        update_post_meta($post_id, self::MIDI_GENERATED_DERIVATIVE_META_KEY, $generated_json);
        update_post_meta($post_id, self::MIDI_ACTIVE_DERIVATIVE_META_KEY, $active_json);
        update_post_meta($post_id, self::MIDI_SOURCE_HASH_META_KEY, $source_hash);
        update_post_meta($post_id, self::MIDI_DERIVATIVE_HASH_META_KEY, hash('sha256', $active_json));
        update_post_meta($post_id, self::MIDI_DERIVATIVE_VERSION_META_KEY, $derivative_version);
        update_post_meta($post_id, self::MIDI_PARSER_VERSION_META_KEY, $parser_version);
        update_post_meta($post_id, self::MIDI_IS_MODIFIED_META_KEY, $is_modified ? '1' : '0');

        if (!empty($timestamps['generated_at'])) {
            update_post_meta($post_id, self::MIDI_LAST_GENERATED_AT_META_KEY, sanitize_text_field((string) $timestamps['generated_at']));
        }
        if (!empty($timestamps['modified_at'])) {
            update_post_meta($post_id, self::MIDI_LAST_MODIFIED_AT_META_KEY, sanitize_text_field((string) $timestamps['modified_at']));
        } elseif ($is_modified === false) {
            delete_post_meta($post_id, self::MIDI_LAST_MODIFIED_AT_META_KEY);
        }
        if (!empty($timestamps['rebuilt_at'])) {
            update_post_meta($post_id, self::MIDI_LAST_REBUILT_AT_META_KEY, sanitize_text_field((string) $timestamps['rebuilt_at']));
        }
    }

    private static function get_editable_file_post(int $post_id): \WP_Post
    {
        return \SystemDeck\Core\Services\ObjectAccessGate::require_author($post_id, self::CPT, get_current_user_id());
    }

    private static function persist_midi_derivative_from_request(int $post_id, array $request): void
    {
        $derivative_json = isset($request['sd_midi_derivative'])
            ? wp_unslash((string) $request['sd_midi_derivative'])
            : '';
        $source_hash = sanitize_text_field((string) ($request['sd_midi_source_hash'] ?? ''));
        $parser_version = sanitize_text_field((string) ($request['sd_midi_parser_version'] ?? ''));
        $derivative_version = sanitize_text_field((string) ($request['sd_midi_derivative_version'] ?? ''));

        if ($source_hash !== '' && $parser_version !== '' && $derivative_version !== '') {
            $existing = self::find_existing_midi_derivative(
                $source_hash,
                $parser_version,
                $derivative_version
            );
            if ($existing && !empty($existing['json'])) {
                $existing_derivative = self::decode_midi_derivative_json((string) $existing['json']);
                if (is_array($existing_derivative)) {
                    $timestamp = self::current_midi_timestamp();
                    self::persist_midi_derivative_pair(
                        $post_id,
                        $existing_derivative,
                        $existing_derivative,
                        false,
                        [
                            'source_hash' => $existing['source_hash'],
                            'parser_version' => $existing['parser_version'],
                            'derivative_version' => $existing['derivative_version'],
                        ],
                        [
                            'generated_at' => $timestamp,
                            'rebuilt_at' => $timestamp,
                        ]
                    );
                }
                return;
            }
        }

        if ($derivative_json === '') {
            return;
        }

        $decoded = json_decode($derivative_json, true);
        if (!is_array($decoded)) {
            return;
        }

        if (($decoded['schema'] ?? '') !== 'systemdeck-midi-derivative') {
            return;
        }

        if ($source_hash === '') {
            $source_hash = sanitize_text_field((string) ($decoded['source']['hash'] ?? ''));
        }
        if ($parser_version === '') {
            $parser_version = sanitize_text_field((string) ($decoded['parser']['version'] ?? ''));
        }
        if ($derivative_version === '') {
            $derivative_version = sanitize_text_field((string) ($decoded['version'] ?? ''));
        }

        $normalized_json = wp_json_encode($decoded, JSON_UNESCAPED_SLASHES);
        if (!is_string($normalized_json) || $normalized_json === '') {
            return;
        }

        $timestamp = self::current_midi_timestamp();
        self::persist_midi_derivative_pair(
            $post_id,
            $decoded,
            $decoded,
            false,
            [
                'source_hash' => $source_hash,
                'parser_version' => $parser_version,
                'derivative_version' => $derivative_version,
            ],
            [
                'generated_at' => $timestamp,
                'rebuilt_at' => $timestamp,
            ]
        );
    }

    public static function ajax_upload_file($request): array
    {
        if (empty($_FILES['vault_file'])) {
            throw new \Exception('No file payload detected.');
        }

        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        self::begin_vault_private_upload_scope();
        add_filter('upload_dir', [self::class, 'filter_upload_dir']);
        try {
            $file_info = wp_handle_upload($_FILES['vault_file'], ['test_form' => false]);
        } finally {
            remove_filter('upload_dir', [self::class, 'filter_upload_dir']);
            self::end_vault_private_upload_scope();
        }

        if (isset($file_info['error'])) {
            throw new \Exception($file_info['error']);
        }

        $user_id = get_current_user_id();
        $workspace_id = sanitize_key($_POST['workspace_id'] ?? '');
        $workspace_name = sanitize_text_field((string) ($_POST['workspace_name'] ?? self::resolve_workspace_name($workspace_id)));
        $is_shared = !empty($_POST['is_shared']) ? 1 : 0;
        $scope = $is_shared ? 'pinned' : 'private';
        $priority = sanitize_key($_POST['priority'] ?? 'low');
        $vault_relative_path = VaultManager::normalize_vault_relative_path($user_id . '/' . wp_basename((string) $file_info['file']));

        $post_data = [
            'post_title' => sanitize_file_name($_FILES['vault_file']['name']),
            'post_mime_type' => $file_info['type'],
            'post_status' => $scope === 'pinned' ? 'publish' : 'private',
            'post_type' => self::CPT,
            'post_author' => $user_id
        ];

        $post_id = wp_insert_post($post_data);
        if (is_wp_error($post_id)) {
            @unlink($file_info['file']);
            throw new \Exception($post_id->get_error_message());
        }

        self::set_vault_path_value($post_id, $vault_relative_path);
        delete_post_meta($post_id, '_sd_attachment_metadata');
        update_post_meta($post_id, '_sd_vault_file_size', filesize($file_info['file']));
        update_post_meta($post_id, '_sd_vault_mime_type', $file_info['type']);
        update_post_meta($post_id, self::STORAGE_MODE_META_KEY, 'vault_private');
        update_post_meta($post_id, self::IS_PUBLIC_META_KEY, '0');
        update_post_meta($post_id, self::ORIGIN_META_KEY, 'vault');
        delete_post_meta($post_id, self::ATTACHMENT_ID_META_KEY);
        update_post_meta($post_id, '_sd_vault_scope', $scope);
        update_post_meta($post_id, '_sd_vault_priority', $priority);
        update_post_meta($post_id, '_sd_vault_sticky', '0');
        update_post_meta($post_id, '_sd_vault_storage_driver', 'vault_private');
        update_post_meta($post_id, '_sd_vault_original_filename', sanitize_file_name($_FILES['vault_file']['name']));
        if ($workspace_id !== '') {
            update_post_meta($post_id, self::ORIGIN_WORKSPACE_ID_META_KEY, $workspace_id);
        }
        if ($workspace_name !== '') {
            update_post_meta($post_id, self::ORIGIN_WORKSPACE_NAME_META_KEY, $workspace_name);
        }

        if (self::is_midi_file((string) $file_info['type'], (string) ($_FILES['vault_file']['name'] ?? ''))) {
            self::persist_midi_derivative_from_request($post_id, $_POST);
        }

        if ($scope === 'pinned' && $workspace_id) {
            update_post_meta($post_id, '_sd_vault_workspace_id', $workspace_id);
            update_post_meta($post_id, self::WORKSPACE_NAME_META_KEY, $workspace_name !== '' ? $workspace_name : self::resolve_workspace_name($workspace_id));
            self::sync_vault_projection($post_id, 'pinned', $workspace_id);
        } else {
            delete_post_meta($post_id, self::WORKSPACE_NAME_META_KEY);
        }

        return [
            'id' => $post_id,
            'name' => $post_data['post_title'],
            'storage_mode' => 'vault_private',
        ];
    }

    private static function get_linked_attachment_id(int $post_id): int
    {
        return max(0, (int) get_post_meta($post_id, self::ATTACHMENT_ID_META_KEY, true));
    }

    private static function get_attachment_edit_url(int $attachment_id): string
    {
        if ($attachment_id <= 0) {
            return '';
        }

        return admin_url('post.php?post=' . $attachment_id . '&action=edit');
    }

    private static function build_vault_file_payload(int $post_id): array
    {
        $state = self::normalize_file_state($post_id);
        $author_id = (int) get_post_field('post_author', $post_id);
        $author_name = $author_id > 0 ? (string) get_the_author_meta('display_name', $author_id) : '';
        $author_url = '';
        if ($author_id > 0) {
            $author_url = $author_id === get_current_user_id()
                ? admin_url('profile.php')
                : (string) get_edit_user_link($author_id);
        }
        $linked_attachment_id = (int) $state['attachment_id'];
        $storage_mode = (string) $state['storage_mode'];
        $vault_path = (string) $state['vault_path'];
        $is_public = (bool) $state['is_public'];
        $origin = (string) $state['origin'];
        $scope = self::get_scope_value($post_id);
        $workspace_id = (string) get_post_meta($post_id, '_sd_vault_workspace_id', true);
        $workspace_name = (string) (get_post_meta($post_id, self::WORKSPACE_NAME_META_KEY, true) ?: self::resolve_workspace_name($workspace_id));
        $origin_workspace_name = (string) get_post_meta($post_id, self::ORIGIN_WORKSPACE_NAME_META_KEY, true);
        $priority = (string) (get_post_meta($post_id, '_sd_vault_priority', true) ?: 'low');
        $is_sticky = (int) get_post_meta($post_id, '_sd_vault_sticky', true) === 1;
        $vault_caption = (string) get_post_meta($post_id, '_sd_vault_attachment_caption', true);
        $vault_alt_text = (string) get_post_meta($post_id, '_sd_vault_alt_text', true);
        $vault_artist = (string) get_post_meta($post_id, '_sd_vault_attachment_artist', true);
        $vault_album = (string) get_post_meta($post_id, '_sd_vault_attachment_album', true);
        $mime = (string) get_post_meta($post_id, '_sd_vault_mime_type', true);
        $size_bytes = (int) get_post_meta($post_id, '_sd_vault_file_size', true);
        $stream_url = self::build_private_stream_url($post_id);
        $edit_url = '';
        $attachment = null;
        $artist = $vault_artist;
        $album = $vault_album;

        if ($linked_attachment_id > 0) {
            $attachment_post = get_post($linked_attachment_id);
            if ($attachment_post && $attachment_post->post_type === 'attachment') {
                $attachment = function_exists('wp_prepare_attachment_for_js')
                    ? wp_prepare_attachment_for_js($linked_attachment_id)
                    : null;
                $edit_url = self::get_attachment_edit_url($linked_attachment_id);
                if ($storage_mode === 'media_public') {
                    $stream_url = (string) wp_get_attachment_url($linked_attachment_id);
                    $mime = (string) get_post_mime_type($linked_attachment_id);
                    $title = get_the_title($linked_attachment_id);
                    $content = (string) $attachment_post->post_content;
                    $caption = (string) $attachment_post->post_excerpt;
                    $artist = (string) (($attachment['artist'] ?? $attachment['meta']['artist'] ?? '') ?: $vault_artist);
                    $album = (string) (($attachment['album'] ?? $attachment['meta']['album'] ?? '') ?: $vault_album);
                    $size_path = get_attached_file($linked_attachment_id);
                    $size_bytes = ($size_path && is_file($size_path)) ? (int) filesize($size_path) : $size_bytes;
                } else {
                    $title = get_the_title($post_id);
                    $content = (string) get_post_field('post_content', $post_id);
                    $caption = $vault_caption;
                }
            } else {
                $linked_attachment_id = 0;
                $storage_mode = 'vault_private';
                $is_public = false;
                update_post_meta($post_id, self::STORAGE_MODE_META_KEY, $storage_mode);
                update_post_meta($post_id, self::IS_PUBLIC_META_KEY, '0');
                delete_post_meta($post_id, self::ATTACHMENT_ID_META_KEY);
                $title = get_the_title($post_id);
                $content = (string) get_post_field('post_content', $post_id);
                $caption = $vault_caption;
            }
        } else {
            $title = get_the_title($post_id);
            $content = (string) get_post_field('post_content', $post_id);
            $caption = $vault_caption;
        }

        $payload = [
            'id' => $post_id,
            'attachment_id' => $linked_attachment_id,
            'storage_mode' => $storage_mode,
            'vault_path' => $vault_path,
            'is_public' => $is_public,
            'origin' => $origin,
            'title' => $title,
            'full_title' => $title,
            'description' => $content,
            'caption' => $caption,
            'alt_text' => $vault_alt_text,
            'artist' => $artist,
            'album' => $album,
            'mime' => $mime,
            'size' => $size_bytes > 0 ? size_format($size_bytes) : '',
            'date' => get_the_date('Y/m/d \a\t g:i a', $post_id),
            'modified' => get_the_modified_date('Y/m/d \a\t g:i a', $post_id),
            'is_modified' => get_post_field('post_modified_gmt', $post_id) !== get_post_field('post_date_gmt', $post_id),
            'scope' => $scope,
            'priority' => $priority,
            'is_sticky' => $is_sticky,
            'workspace_id' => $workspace_id,
            'workspace_name' => $workspace_name,
            'origin_workspace_name' => $origin_workspace_name,
            'status_label' => $storage_mode === 'media_public' ? 'Public' : 'Private',
            'author_name' => $author_name,
            'author_url' => $author_url,
            'is_pinned' => $scope === 'pinned',
            'stream_url' => $stream_url,
            'edit_url' => $edit_url,
            'comment_count' => (int) get_comments_number($post_id),
        ];

        if (is_array($attachment)) {
            $payload['attachment'] = $attachment;
        }

        return $payload;
    }

    public static function ajax_link_attachment($request): array
    {
        $attachment_id = max(0, (int) ($request['attachment_id'] ?? 0));
        if ($attachment_id <= 0) {
            throw new \Exception('Invalid attachment.');
        }

        $attachment = get_post($attachment_id);
        if (!$attachment || $attachment->post_type !== 'attachment' || !current_user_can('upload_files')) {
            throw new \Exception('Attachment unavailable.');
        }

        $workspace_id = sanitize_key((string) ($request['workspace_id'] ?? ''));
        $workspace_name = sanitize_text_field((string) ($request['workspace_name'] ?? self::resolve_workspace_name($workspace_id)));
        $is_shared = !empty($request['is_shared']);
        $scope = $is_shared ? 'pinned' : 'private';
        $priority = sanitize_key((string) ($request['priority'] ?? 'low'));
        $user_id = get_current_user_id();
        $attached_file = get_attached_file($attachment_id);

        if (!$attached_file || !is_file($attached_file)) {
            throw new \Exception('Attachment file missing.');
        }

        $existing = get_posts([
            'post_type' => self::CPT,
            'post_status' => ['publish', 'private', 'inherit'],
            'author' => $user_id,
            'posts_per_page' => 1,
            'fields' => 'ids',
            'meta_query' => [
                [
                    'key' => self::ATTACHMENT_ID_META_KEY,
                    'value' => $attachment_id,
                    'compare' => '=',
                ],
            ],
        ]);

        $title = get_the_title($attachment_id);
        $description = (string) $attachment->post_content;
        $mime = (string) get_post_mime_type($attachment_id);
        $size_bytes = ($attached_file && is_file($attached_file)) ? (int) filesize($attached_file) : 0;
        $source_filename = wp_basename((string) $attached_file);
        $attachment_details = function_exists('wp_prepare_attachment_for_js')
            ? wp_prepare_attachment_for_js($attachment_id)
            : null;
        $attachment_artist = is_array($attachment_details)
            ? (string) ($attachment_details['artist'] ?? $attachment_details['meta']['artist'] ?? '')
            : '';
        $attachment_album = is_array($attachment_details)
            ? (string) ($attachment_details['album'] ?? $attachment_details['meta']['album'] ?? '')
            : '';

        $user_vault_dir = VaultManager::ensure_user_vault_exists($user_id);
        $target_filename = wp_unique_filename($user_vault_dir, $source_filename);
        $target_path = trailingslashit($user_vault_dir) . $target_filename;
        if (!copy($attached_file, $target_path)) {
            throw new \Exception('Unable to create private Vault copy.');
        }
        $vault_relative_path = VaultManager::normalize_vault_relative_path($user_id . '/' . $target_filename);

        if (!empty($existing[0])) {
            $post_id = (int) $existing[0];
            $existing_private_path = self::get_vault_absolute_path($post_id);
            if ($existing_private_path && is_file($existing_private_path) && $existing_private_path !== $target_path) {
                @unlink($existing_private_path);
            }
            wp_update_post([
                'ID' => $post_id,
                'post_title' => $title,
                'post_content' => $description,
                'post_status' => $scope === 'pinned' ? 'publish' : 'private',
            ]);
        } else {
            $post_id = wp_insert_post([
                'post_title' => $title,
                'post_content' => $description,
                'post_mime_type' => $mime,
                'post_status' => $scope === 'pinned' ? 'publish' : 'private',
                'post_type' => self::CPT,
                'post_author' => $user_id,
            ]);
            if (is_wp_error($post_id)) {
                @unlink($target_path);
                throw new \Exception($post_id->get_error_message());
            }
        }

        self::set_vault_path_value($post_id, $vault_relative_path);
        update_post_meta($post_id, self::ATTACHMENT_ID_META_KEY, $attachment_id);
        update_post_meta($post_id, self::STORAGE_MODE_META_KEY, 'vault_private');
        update_post_meta($post_id, self::IS_PUBLIC_META_KEY, '0');
        update_post_meta($post_id, self::ORIGIN_META_KEY, 'media');
        update_post_meta($post_id, '_sd_vault_storage_driver', 'vault_private');
        update_post_meta($post_id, '_sd_vault_mime_type', $mime);
        update_post_meta($post_id, '_sd_vault_file_size', $size_bytes);
        update_post_meta($post_id, '_sd_vault_original_filename', $source_filename);
        update_post_meta($post_id, '_sd_vault_scope', $scope);
        update_post_meta($post_id, '_sd_vault_priority', $priority);
        if (get_post_meta($post_id, '_sd_vault_sticky', true) === '') {
            update_post_meta($post_id, '_sd_vault_sticky', '0');
        }
        update_post_meta($post_id, '_sd_vault_attachment_caption', (string) $attachment->post_excerpt);
        update_post_meta($post_id, '_sd_vault_attachment_description', $description);
        update_post_meta($post_id, '_sd_vault_alt_text', (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true));
        update_post_meta($post_id, '_sd_vault_attachment_artist', $attachment_artist);
        update_post_meta($post_id, '_sd_vault_attachment_album', $attachment_album);
        update_post_meta($post_id, '_sd_vault_last_media_sync', (string) current_time('mysql'));
        update_post_meta($post_id, '_sd_vault_media_sync_direction', 'linked');

        if ($workspace_id !== '') {
            if (!get_post_meta($post_id, self::ORIGIN_WORKSPACE_ID_META_KEY, true)) {
                update_post_meta($post_id, self::ORIGIN_WORKSPACE_ID_META_KEY, $workspace_id);
            }
            if (!get_post_meta($post_id, self::ORIGIN_WORKSPACE_NAME_META_KEY, true) && $workspace_name !== '') {
                update_post_meta($post_id, self::ORIGIN_WORKSPACE_NAME_META_KEY, $workspace_name);
            }
        }

        if ($scope === 'pinned' && $workspace_id !== '') {
            update_post_meta($post_id, '_sd_vault_workspace_id', $workspace_id);
            update_post_meta($post_id, self::WORKSPACE_NAME_META_KEY, $workspace_name !== '' ? $workspace_name : self::resolve_workspace_name($workspace_id));
            self::sync_vault_projection($post_id, 'pinned', $workspace_id);
        } else {
            delete_post_meta($post_id, '_sd_vault_workspace_id');
            delete_post_meta($post_id, self::WORKSPACE_NAME_META_KEY);
            self::sync_vault_projection($post_id, 'private', '');
        }

        return [
            'id' => $post_id,
            'attachment_id' => $attachment_id,
            'edit_url' => self::get_attachment_edit_url($attachment_id),
            'storage_mode' => 'vault_private',
        ];
    }

    public static function ajax_get_files($request): array
    {
        $user_id = (int) get_current_user_id();
        $limit = isset($request['limit']) ? max(1, intval($request['limit'])) : 5;
        $paged = isset($request['paged']) ? max(1, intval($request['paged'])) : 1;

        $args = [
            'post_type' => self::CPT,
            'author' => $user_id,
            'posts_per_page' => 200,
            'post_status' => ['publish', 'private', 'inherit'],
            'orderby' => 'post_modified',
            'order' => 'DESC',
        ];

        $query = new \WP_Query($args);
        $files = [];

        while ($query->have_posts()) {
            $query->the_post();
            $id = get_the_ID();
            if (get_post_meta($id, '_sd_vault_sticky', true) === '') {
                update_post_meta($id, '_sd_vault_sticky', '0');
            }
            $payload = self::build_vault_file_payload($id);
            $payload['_sort_modified_ts'] = (int) get_post_modified_time('U', true, $id);
            $files[] = $payload;
        }
        wp_reset_postdata();

        usort($files, static function (array $a, array $b): int {
            $stickyA = !empty($a['is_sticky']) ? 1 : 0;
            $stickyB = !empty($b['is_sticky']) ? 1 : 0;
            if ($stickyA !== $stickyB) {
                return $stickyB <=> $stickyA;
            }
            $modifiedA = (int) ($a['_sort_modified_ts'] ?? 0);
            $modifiedB = (int) ($b['_sort_modified_ts'] ?? 0);
            return $modifiedB <=> $modifiedA;
        });
        foreach ($files as &$file) {
            unset($file['_sort_modified_ts']);
        }
        unset($file);

        $total = count($files);
        $max_pages = max(1, (int) ceil($total / $limit));
        $paged = min($paged, $max_pages);
        $offset = ($paged - 1) * $limit;

        return [
            'files' => array_slice($files, $offset, $limit),
            'total' => $total,
            'max_pages' => $max_pages,
            'paged' => $paged,
        ];
    }

    public static function ajax_delete_file($request): array
    {
        $id = intval($request['id'] ?? 0);
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $absolute_path = self::get_vault_absolute_path($id);
        if ($absolute_path && file_exists($absolute_path)) {
            @unlink($absolute_path);
        }

        self::maybe_delete_managed_public_attachment($id);
        self::sync_vault_projection($id, 'private', '');
        wp_delete_post($id, true);
        return ['status' => 'success'];
    }

    public static function ajax_get_file_details($request): array
    {
        $id = intval($request['id'] ?? 0);
        self::get_scope_value($id);

        // Access gate — delegates to core ObjectAccessGate.
        // Throws 'Access denied' for non-authors unless scope='pinned' + workspace access.
        \SystemDeck\Core\Services\ObjectAccessGate::resolve(
            $id,
            self::CPT,
            get_current_user_id(),
            '_sd_vault_scope',
            '_sd_vault_workspace_id',
            'pinned'
        );

        $result = self::build_vault_file_payload($id);
        $midi = self::read_midi_editor_payload($id);
        $result['published_date'] = get_the_date('Y/m/d H:i', $id);
        if (is_array($midi)) {
            $result['midi_derivative'] = $midi['active_derivative'];
            $result['midi_derivative_meta'] = $midi['summary'];
        }
        return $result;
    }

    public static function ajax_save_file_details($request): array
    {
        $id = intval($request['id'] ?? 0);
        if (!$id) throw new \Exception('Invalid dynamic ID');

        // Author-only write gate — delegates to core ObjectAccessGate.
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $title = sanitize_text_field($request['title'] ?? '');
        $caption = isset($request['caption']) ? wp_kses_post(wp_unslash((string) $request['caption'])) : '';
        $description = isset($request['description']) ? wp_kses_post(wp_unslash((string) $request['description'])) : '';
        $alt_text = sanitize_text_field((string) ($request['alt_text'] ?? ''));
        $artist = sanitize_text_field((string) ($request['artist'] ?? ''));
        $album = sanitize_text_field((string) ($request['album'] ?? ''));
        $scope = self::normalize_scope_value(sanitize_text_field((string) ($request['scope'] ?? 'private')));
        $workspace_id = sanitize_text_field($request['workspace_id'] ?? '');
        $workspace_name = sanitize_text_field((string) ($request['workspace_name'] ?? self::resolve_workspace_name($workspace_id)));
        $priority = sanitize_key($request['priority'] ?? 'low');
        $storage_mode = self::get_storage_mode($id);

        if ($storage_mode !== 'media_public') {
            wp_update_post([
                'ID' => $id,
                'post_title' => $title,
                'post_content' => $description,
            ]);
        }

        update_post_meta($id, '_sd_vault_scope', $scope);
        update_post_meta($id, '_sd_vault_priority', $priority);
        update_post_meta($id, '_sd_vault_attachment_caption', $caption);
        update_post_meta($id, '_sd_vault_alt_text', $alt_text);
        update_post_meta($id, '_sd_vault_attachment_artist', $artist);
        update_post_meta($id, '_sd_vault_attachment_album', $album);
        if ($scope === 'pinned' && $workspace_id) {
            // Workspace write gate — delegates to core ObjectAccessGate.
            \SystemDeck\Core\Services\ObjectAccessGate::require_workspace_write(get_current_user_id(), $workspace_id);
            update_post_meta($id, '_sd_vault_workspace_id', $workspace_id);
            update_post_meta($id, self::WORKSPACE_NAME_META_KEY, $workspace_name !== '' ? $workspace_name : self::resolve_workspace_name($workspace_id));
            if (!get_post_meta($id, self::ORIGIN_WORKSPACE_ID_META_KEY, true)) {
                update_post_meta($id, self::ORIGIN_WORKSPACE_ID_META_KEY, $workspace_id);
            }
            if (!get_post_meta($id, self::ORIGIN_WORKSPACE_NAME_META_KEY, true) && $workspace_name !== '') {
                update_post_meta($id, self::ORIGIN_WORKSPACE_NAME_META_KEY, $workspace_name);
            }
        } else {
            delete_post_meta($id, '_sd_vault_workspace_id');
            delete_post_meta($id, self::WORKSPACE_NAME_META_KEY);
        }

        self::sync_vault_projection($id, $scope, $workspace_id);

        return ['status' => 'success'];
    }

    public static function ajax_get_midi_editor_payload($request): array
    {
        $id = intval($request['id'] ?? 0);
        $post = self::get_editable_file_post($id);
        $mime = (string) get_post_meta($id, '_sd_vault_mime_type', true);

        if (!self::is_midi_file($mime, (string) $post->post_title)) {
            throw new \Exception('This file is not MIDI.');
        }

        $payload = self::read_midi_editor_payload($id);
        if (is_array($payload)) {
            return $payload;
        }

        return [
            'active_derivative' => null,
            'active_json' => '',
            'generated_derivative' => null,
            'generated_json' => '',
            'summary' => self::build_midi_summary(null, null, $id),
        ];
    }

    public static function ajax_validate_midi_derivative($request): array
    {
        $id = intval($request['id'] ?? 0);
        self::get_editable_file_post($id);

        $json = isset($request['json']) ? wp_unslash((string) $request['json']) : '';
        $decoded = self::decode_midi_derivative_json($json);
        if (!is_array($decoded)) {
            throw new \Exception('Invalid MIDI derivative JSON.');
        }

        return [
            'valid' => true,
            'pretty_json' => self::encode_midi_derivative_json($decoded),
            'summary' => self::build_midi_summary($decoded, $decoded, $id),
        ];
    }

    public static function ajax_save_midi_derivative($request): array
    {
        $id = intval($request['id'] ?? 0);
        self::get_editable_file_post($id);

        $json = isset($request['json']) ? wp_unslash((string) $request['json']) : '';
        $active = self::decode_midi_derivative_json($json);
        if (!is_array($active)) {
            throw new \Exception('Invalid MIDI derivative JSON.');
        }

        $generated_json = self::get_generated_midi_json($id);
        $generated = self::decode_midi_derivative_json($generated_json);
        if (!is_array($generated)) {
            $generated = $active;
        }

        $active_json = self::encode_midi_derivative_json($active);
        $normalized_generated_json = self::encode_midi_derivative_json($generated);
        $is_modified = $active_json !== $normalized_generated_json;
        $timestamp = self::current_midi_timestamp();

        self::persist_midi_derivative_pair(
            $id,
            $generated,
            $active,
            $is_modified,
            [],
            [
                'modified_at' => $is_modified ? $timestamp : '',
            ]
        );

        return self::ajax_get_midi_editor_payload(['id' => $id]);
    }

    public static function ajax_rebuild_midi_derivative($request): array
    {
        $id = intval($request['id'] ?? 0);
        self::get_editable_file_post($id);

        $json = isset($request['json']) ? wp_unslash((string) $request['json']) : '';
        $generated = self::decode_midi_derivative_json($json);
        if (!is_array($generated)) {
            throw new \Exception('Invalid rebuilt MIDI derivative JSON.');
        }

        $replace_active = !empty($request['replace_active']);
        $current = self::read_midi_editor_payload($id);
        $active = $replace_active || !is_array($current['active_derivative'] ?? null)
            ? $generated
            : $current['active_derivative'];
        $generated_json = self::encode_midi_derivative_json($generated);
        $active_json = self::encode_midi_derivative_json($active);
        $timestamp = self::current_midi_timestamp();

        self::persist_midi_derivative_pair(
            $id,
            $generated,
            $active,
            $generated_json !== $active_json,
            [],
            [
                'generated_at' => $timestamp,
                'rebuilt_at' => $timestamp,
            ]
        );

        return self::ajax_get_midi_editor_payload(['id' => $id]);
    }

    /**
     * Sync vault projection — delegates to core ProjectionService.
     * Builds vault-specific settings payload (MIME-based icon), then calls shared sync.
     */
    private static function sync_vault_projection(int $file_id, string $scope, string $workspace_id): void
    {
        $scope = self::normalize_scope_value($scope);
        $post = get_post($file_id);
        $title = $post ? $post->post_title : __('File', 'systemdeck');
        if (mb_strlen($title) > 20) {
            $title = mb_substr($title, 0, 17) . '...';
        }

        $icon = 'dashicons-media-default';
        $mime = get_post_meta($file_id, '_sd_vault_mime_type', true);
        if (strpos($mime, 'image/') === 0) $icon = 'dashicons-format-image';
        elseif (strpos($mime, 'pdf') !== false) $icon = 'dashicons-media-document';
        elseif (strpos($mime, 'audio/') === 0 || strpos($mime, 'midi') !== false) $icon = 'dashicons-media-audio';
        elseif (strpos($mime, 'video/') === 0) $icon = 'dashicons-media-video';
        elseif (strpos($mime, 'text/') === 0) $icon = 'dashicons-editor-alignleft';

        $stream_url = self::build_private_stream_url($file_id);
        $payload = [
            'type' => 'vault',
            'object_id' => $file_id,
            'workspace_id' => $workspace_id,
            'title' => $title,
            'data' => [
                'file_type' => (string) $mime,
                'url' => $stream_url,
            ],
            'grid_span' => '1x1',
            'renderer' => 'vault',
        ];
        error_log('[VAULT PROJECTION] sync start: ' . wp_json_encode([
            'id' => $file_id,
            'scope' => $scope,
            'workspace_id' => $workspace_id,
            'payload' => $payload,
        ]));

        $settings = [
            'fileId'       => $file_id,
            'type'         => 'vault',
            'pin_kind'     => 'pinned_file',
            'label'        => $title,
            'title'        => $title,
            'icon'         => $icon,
            'grid_span'    => '1x1',
            'size'         => '1x1',
            'renderer'     => 'vault',
            'design_template' => 'default',
            'sticky_level' => get_post_meta($file_id, '_sd_vault_priority', true) ?: 'low',
            'data'         => [
                'fileId' => $file_id,
                'type' => 'vault',
                'pin_kind' => 'pinned_file',
                'label' => $title,
                'icon' => $icon,
                'file_type' => (string) $mime,
                'url' => $stream_url,
                'sticky_level' => get_post_meta($file_id, '_sd_vault_priority', true) ?: 'low',
            ],
        ];

        \SystemDeck\Core\Services\ProjectionService::sync(
            $file_id,
            $scope,
            $workspace_id,
            'vault',
            $settings,
            'pinned'
        );
        error_log('[VAULT PROJECTION] sync complete');
    }

    public static function ajax_export_to_media_library($request): array
    {
        $id = intval($request['id'] ?? 0);
        $post = \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        self::normalize_file_state($id);
        $linked_attachment_id = self::get_linked_attachment_id($id);
        if ($linked_attachment_id > 0) {
            update_post_meta($id, self::STORAGE_MODE_META_KEY, 'media_public');
            update_post_meta($id, self::IS_PUBLIC_META_KEY, '1');
            update_post_meta($id, '_sd_vault_storage_driver', 'media_public');
            return [
                'status' => 'success',
                'attachment_id' => $linked_attachment_id,
                'edit_url' => self::get_attachment_edit_url($linked_attachment_id),
                'linked' => true,
            ];
        }

        $absolute_path = self::get_vault_absolute_path($id);
        if (!$absolute_path) {
            throw new \Exception('File missing physically');
        }

        if (!file_exists($absolute_path)) {
            throw new \Exception('Source file missing');
        }

        $target_dir = wp_upload_dir();
        $target_file = wp_unique_filename($target_dir['path'], basename($absolute_path));
        $target_path = $target_dir['path'] . '/' . $target_file;

        if (!copy($absolute_path, $target_path)) {
            throw new \Exception('Disk copy failed');
        }

        $new_post = [
            'post_mime_type' => $post->post_mime_type,
            'post_title'     => $post->post_title,
            'post_status'    => 'inherit',
            'post_type'      => 'attachment',
            'post_author'    => get_current_user_id()
        ];

        require_once(ABSPATH . 'wp-admin/includes/image.php');

        $attach_id = wp_insert_attachment($new_post, $target_path);
        if (!is_wp_error($attach_id)) {
            $attach_data = wp_generate_attachment_metadata($attach_id, $target_path);
            wp_update_attachment_metadata($attach_id, $attach_data);
        } else {
            @unlink($target_path);
            throw new \Exception('Attachment creation failed: ' . $attach_id->get_error_message());
        }

        update_post_meta($id, self::ATTACHMENT_ID_META_KEY, $attach_id);
        update_post_meta($id, self::STORAGE_MODE_META_KEY, 'media_public');
        update_post_meta($id, self::IS_PUBLIC_META_KEY, '1');
        update_post_meta($id, '_sd_vault_storage_driver', 'media_public');
        update_post_meta($id, '_sd_vault_last_media_sync', (string) current_time('mysql'));
        update_post_meta($id, '_sd_vault_media_sync_direction', 'published');

        return [
            'status' => 'success',
            'attachment_id' => $attach_id,
            'edit_url' => self::get_attachment_edit_url($attach_id),
            'linked' => false,
        ];
    }

    public static function ajax_import_from_media_library($request): array
    {
        return self::ajax_link_attachment($request);
    }

    public static function ajax_make_private($request): array
    {
        $id = intval($request['id'] ?? 0);
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $state = self::normalize_file_state($id);
        if ((string) $state['vault_path'] === '') {
            throw new \Exception('Private Vault copy is missing.');
        }

        self::maybe_delete_managed_public_attachment($id);
        update_post_meta($id, self::STORAGE_MODE_META_KEY, 'vault_private');
        update_post_meta($id, self::IS_PUBLIC_META_KEY, '0');
        update_post_meta($id, '_sd_vault_storage_driver', 'vault_private');
        update_post_meta($id, '_sd_vault_last_media_sync', (string) current_time('mysql'));
        update_post_meta($id, '_sd_vault_media_sync_direction', 'returned_private');

        return [
            'status' => 'success',
            'storage_mode' => 'vault_private',
            'is_public' => false,
        ];
    }

    public static function ajax_get_file_comments($request): array
    {
        $file_id = intval($request['file_id'] ?? 0);
        if (!$file_id) throw new \Exception('Invalid file ID');
        self::get_scope_value($file_id);

        // Access gate — delegates to core ObjectAccessGate.
        \SystemDeck\Core\Services\ObjectAccessGate::resolve(
            $file_id,
            self::CPT,
            get_current_user_id(),
            '_sd_vault_scope',
            '_sd_vault_workspace_id',
            'pinned'
        );

        return ['comments' => \SystemDeck\Core\Services\CommentService::get_comment_tree($file_id)];
    }

    public static function ajax_add_file_comment($request): array
    {
        $file_id   = intval($request['file_id'] ?? 0);
        $content   = $request['content'] ?? '';
        $user_id   = get_current_user_id();
        $parent_id = intval($request['parent_id'] ?? 0);
        self::get_scope_value($file_id);

        $comment_id = \SystemDeck\Core\Services\CommentService::add_comment(
            $file_id,
            $content,
            $user_id,
            $parent_id,
            self::CPT,
            '_sd_vault_scope',
            '_sd_vault_workspace_id',
            'pinned'
        );

        return ['status' => 'success', 'comment_id' => $comment_id];
    }

    public static function ajax_toggle_vault_sticky($request): array
    {
        $item_id = max(0, (int) ($request['id'] ?? 0));
        if ($item_id <= 0) {
            throw new \Exception('invalid_id');
        }
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($item_id, self::CPT, get_current_user_id());

        $current = (int) get_post_meta($item_id, '_sd_vault_sticky', true);
        $next = $current === 1 ? 0 : 1;
        update_post_meta($item_id, '_sd_vault_sticky', (string) $next);

        return [
            'id' => $item_id,
            'is_sticky' => $next === 1,
        ];
    }
}

add_action('init', [Vault::class, 'register_vault']);
