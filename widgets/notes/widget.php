<?php
/**
 * SystemDeck - widget.php
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/notes/widget.php
 * @license GPL-2.0-or-later
 *
 * Notes Widget (Collaboration & Task Management)
 */

/**
 * SystemDeck Notes Module
 * A quick-access notepad widget for the workspace.
 */

declare(strict_types=1);

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

class Notes extends BaseWidget
{
    public const ID = 'core.notes';
    public const TITLE = 'Notes';
    public const ICON = 'dashicons-edit-page';
    public const DEFAULT_WIDTH = 3;
    public const PIN_ID = 'pinned_note';

    private const CPT = 'sd_note';

    private static function check_notes_nonce(): void
    {
        // Use check_ajax_referer with 'systemdeck_runtime' which is the canonical nonce action
        // It automatically looks for 'nonce' or '_ajax_nonce' in $_POST
        if (!check_ajax_referer('systemdeck_runtime', 'nonce', false) && !check_ajax_referer('systemdeck_runtime', '_ajax_nonce', false)) {
            wp_send_json_error(['error' => 'Security check failed']);
        }
    }

    public static function handle_ajax_get_notes()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_get_notes($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_save_note()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_save_note($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_delete_note()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_delete_note($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_toggle_note_sticky()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_toggle_note_sticky($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_get_read_note()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_get_read_note($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_get_note_comments()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_get_note_comments($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_add_note_comment()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_add_note_comment($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function handle_ajax_save_note_tasks()
    {
        self::check_notes_nonce();
        try {
            wp_send_json_success(self::ajax_save_note_tasks($_POST));
        } catch (\Exception $e) {
            wp_send_json_error(['error' => $e->getMessage()]);
        }
    }

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js' => ['app.js']
        ];
    }

    /**
     * ============================
     * PIN RUNTIME (Consolidated)
     * ============================
     */

    public static function pin_definitions(): array
    {
        return [
            [
                'id' => self::PIN_ID,
                'label' => 'Pinned Note',
                'type' => 'custom',
                'source' => [
                    'kind' => 'widget',
                    'authority' => 'systemdeck',
                    'id' => self::ID,
                ],
                'category' => 'notes',
                'renderer' => 'dom',
                'description' => 'A specific note pinned to your workspace.',
                'icon' => 'dashicons-paperclip',
                'tags' => ['notes', 'pinned'],
                'pin_safe' => true,
                'defaults' => [
                    'size' => '2x1',
                    'design_template' => 'default',
                ],
            ],
        ];
    }

    public static function pin_asset_handles(string $pin_id): array
    {
        return [
            'js' => ['sd-pin-base-runtime'],
            'css' => [],
        ];
    }

    public static function pin_render(string $pin_id, array $context = []): string
    {
        // $pin_id is likely "note.123"
        $parts = explode('.', $pin_id);
        $note_id = intval(end($parts));
        if (!$note_id) {
            return '';
        }

        $note = get_post($note_id);
        if (!$note || $note->post_type !== self::CPT) {
            return '';
        }

        $instance_id = sanitize_html_class((string) ($context['instance_id'] ?? $pin_id));
        $workspace_id = sanitize_key((string) ($context['workspace_id'] ?? ''));
        $level = get_post_meta($note_id, '_sd_note_sticky_level', true) ?: 'low';
        
        $status_map = [
            'low'      => 'is-low',
            'medium'   => 'is-moderate',
            'high'     => 'is-high',
            'urgent'   => 'is-urgent',
        ];
        $status_class = $status_map[$level] ?? 'is-low';

        ob_start();
        ?>
        <article class="postbox sd-pin <?php echo esc_attr($status_class); ?>" 
                 data-pin-action="open_note" 
                 data-note-id="<?php echo esc_attr((string)$note_id); ?>"
                 data-workspace-id="<?php echo esc_attr($workspace_id); ?>">
            <div class="sd-media-wrap">
                <div class="sd-media-figure">
                    <span class="sd-pin-icon dashicons dashicons-edit"></span>
                </div>
                <div class="sd-media-content">
                    <div class="sd-pin-label" id="sd-pin-title-<?php echo esc_attr($instance_id); ?>">
                        <?php echo esc_html__('Note', 'systemdeck'); ?>
                    </div>
                    <h4 class="sd-pin-title"><?php echo esc_html($note->post_title); ?></h4>
                    <div class="sd-pin-meta">
                        <span class="sd-pin-description">
                            <?php echo esc_html(wp_trim_words($note->post_content, 12)); ?>
                        </span>
                    </div>
                </div>
            </div>
        </article>
        <?php
        return (string) ob_get_clean();
    }

    public static function register_cpt(): void
    {
        if (post_type_exists(self::CPT)) {
            return;
        }

        register_post_type(self::CPT, [
            'label' => __('SystemDeck Note', 'systemdeck'),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => false,
            'menu_icon' => self::ICON,
            'capability_type' => 'post',
            'supports' => ['title', 'editor', 'author', 'excerpt', 'comments'], // Added comments
            'map_meta_cap' => true,
            'can_export' => true
        ]);
    }

    public static function exclude_from_recent_comments(array $args): array
    {
        // To exclude our internal notes, we must explicitly tell the query
        // to only include all other registered post types.
        $post_types = get_post_types([], 'names');

        if (isset($post_types[self::CPT])) {
            unset($post_types[self::CPT]);
        }

        $args['post_type'] = array_values($post_types);

        return $args;
    }

    public static function exclude_from_admin_sql(array $clauses): array
    {
        if (is_admin()) {
            global $pagenow;
            // Filter on Dashboard and Main Comments list
            if ($pagenow === 'index.php' || $pagenow === 'edit-comments.php') {
                global $wpdb;
                // If the query hasn't joined posts, join it so we can check post_type
                if (strpos($clauses['join'], "{$wpdb->posts}") === false) {
                    $clauses['join'] .= " JOIN {$wpdb->posts} ON {$wpdb->comments}.comment_post_ID = {$wpdb->posts}.ID";
                }
                $clauses['where'] .= " AND {$wpdb->posts}.post_type != '" . self::CPT . "'";
            }
        }
        return $clauses;
    }

    public static function manage_admin_columns($columns)
    {
        $columns['sd_note_status'] = __('Status', 'systemdeck');
        $columns['sd_note_origin'] = __('Origin Workspace', 'systemdeck');
        $columns['sd_note_workspace'] = __('Workspace', 'systemdeck');
        $columns['sd_note_context'] = __('URL Context', 'systemdeck');
        $columns['sd_note_type'] = __('Type', 'systemdeck');
        return $columns;
    }

    public static function render_admin_columns($column, $post_id)
    {
        switch ($column) {
            case 'sd_note_status':
                $scope = get_post_meta($post_id, '_sd_note_scope', true) ?: 'private';
                $is_sticky = (bool) get_post_meta($post_id, '_sd_note_is_sticky', true);
                $parts = [];
                if ($is_sticky)
                    $parts[] = '<b>Sticky</b>';
                if ($scope === 'pinned')
                    $parts[] = '<b class="sd-note-workspace-pinned">Pinned</b>';
                else
                    $parts[] = '<span class="sd-note-workspace-private">Private</span>';
                echo implode(' &bull; ', $parts);
                break;
            case 'sd_note_origin':
                $origin = get_post_meta($post_id, '_sd_note_origin_workspace_name', true)
                    ?: get_post_meta($post_id, '_sd_note_workspace_name', true)
                    ?: '&mdash;';
                echo esc_html($origin);
                break;
            case 'sd_note_workspace':
                $scope = get_post_meta($post_id, '_sd_note_scope', true);
                $level = get_post_meta($post_id, '_sd_note_sticky_level', true) ?: 'low';
                $ws_name = get_post_meta($post_id, '_sd_note_workspace_name', true);
                if ($scope === 'pinned' && $ws_name) {
                    echo esc_html($ws_name) . '<br/><small>' . esc_html(ucfirst($level)) . '</small>';
                } else {
                    echo '&mdash;';
                }
                break;
            case 'sd_note_context':
                $url = get_post_meta($post_id, '_sd_note_context', true);
                echo !empty($url) ? esc_url($url) : '&mdash;';
                break;
            case 'sd_note_type':
                $is_code = get_post_meta($post_id, '_sd_note_is_code', true);
                echo $is_code ? 'Code Snippet' : 'Standard Text';
                break;
        }
    }

    public static function add_meta_boxes()
    {
        add_meta_box('sd_note_context_box', __('Capture URL Context', 'systemdeck'), [self::class, 'render_context_meta_box'], self::CPT, 'normal', 'high');
        add_meta_box('sd_note_code_box', __('Code Area', 'systemdeck'), [self::class, 'render_code_meta_box'], self::CPT, 'normal', 'high');
        add_meta_box('sd_note_workspace_box', __('Workspace Options', 'systemdeck'), [self::class, 'render_workspace_meta_box'], self::CPT, 'side', 'default');
    }

    public static function render_context_meta_box($post)
    {
        wp_nonce_field('sd_note_meta_nonce', 'sd_note_meta_nonce_val');
        $context = get_post_meta($post->ID, '_sd_note_context', true);
        echo '<p>';
        if (!empty($context)) {
            echo '<strong>Current Link:</strong> <a href="' . esc_url($context) . '" target="_blank">' . esc_html($context) . '</a><br/><br/>';
        }
        echo '<input type="url" name="sd_note_context" class="widefat" placeholder="https://example.com" value="' . esc_attr($context) . '" /></p>';
    }

    public static function render_workspace_meta_box($post)
    {
        $scope = get_post_meta($post->ID, '_sd_note_scope', true) ?: 'private';
        $is_sticky = (bool) get_post_meta($post->ID, '_sd_note_is_sticky', true);
        $level = get_post_meta($post->ID, '_sd_note_sticky_level', true) ?: 'low';
        $pin_ws_id = get_post_meta($post->ID, '_sd_note_workspace_id', true);
        $pin_ws_nm = get_post_meta($post->ID, '_sd_note_workspace_name', true);
        $origin_nm = get_post_meta($post->ID, '_sd_note_origin_workspace_name', true)
            ?: $pin_ws_nm ?: '';

        // Sticky ordering flag
        echo '<p><strong>List Ordering:</strong><br/>';
        echo '<label><input type="checkbox" name="sd_note_is_sticky" value="1" ' . checked($is_sticky, true, false) . '/> Sticky (rises to top of list)</label></p>';

        // Pin state — workspace projection
        echo '<p><strong>Pinboard State:</strong><br/>';
        echo '<label><input type="radio" name="sd_note_scope" value="private" ' . checked($scope, 'private', false) . '/> Private (no workspace projection)</label><br/>';
        echo '<label><input type="radio" name="sd_note_scope" value="pinned" ' . checked($scope, 'pinned', false) . '/> Pinned to Workspace</label></p>';

        if ($origin_nm) {
            echo '<p class="sd-meta-block-status"><strong>Origin Workspace:</strong><br/><span>' . esc_html($origin_nm) . '</span></p>';
        }
        if ($pin_ws_id) {
            $pin_ws_nm = get_post($pin_ws_id) ? get_the_title($pin_ws_id) : 'Unknown';
            echo '<p class="sd-meta-block-status"><strong>Pinned To:</strong><br/><span>' . esc_html($pin_ws_nm) . '</span></p>';
        }

        echo '<p><strong>Priority (when pinned):</strong><br/>';
        $priorities = ['urgent' => 'Urgent', 'high' => 'High', 'moderate' => 'Moderate', 'low' => 'Low'];
        foreach ($priorities as $val => $label) {
            echo '<label><input type="radio" name="sd_note_sticky_level" value="' . esc_attr($val) . '" ' . checked($level, $val, false) . '/> ' . esc_html($label) . '</label><br/>';
        }
        echo '</p>';
    }

    public static function render_code_meta_box($post)
    {
        $is_code = get_post_meta($post->ID, '_sd_note_is_code', true);
        $code_content = get_post_meta($post->ID, '_sd_note_code_content', true);

        echo '<p><label><input type="checkbox" name="sd_note_is_code" value="1" ' . checked($is_code, 1, false) . '/> Enable Code Mode</label></p>';
        echo '<p><textarea name="sd_note_code_content" class="widefat" rows="10" dir="ltr">' . esc_textarea($code_content) . '</textarea></p>';
    }

    public static function save_meta_boxes($post_id)
    {
        if (!isset($_POST['sd_note_meta_nonce_val']) || !wp_verify_nonce($_POST['sd_note_meta_nonce_val'], 'sd_note_meta_nonce')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        /**
         * Note: Per the SystemDeck contract, only the author typically edits a note.
         * Admin overrides here are permitted for maintenance purposes (Option A).
         */

        if (isset($_POST['sd_note_context'])) {
            update_post_meta($post_id, '_sd_note_context', sanitize_text_field($_POST['sd_note_context']));
        }

        // Sticky = ordering only
        $is_sticky = isset($_POST['sd_note_is_sticky']) ? 1 : 0;
        update_post_meta($post_id, '_sd_note_is_sticky', $is_sticky);

        // Scope: private | pinned
        $scope = in_array($_POST['sd_note_scope'] ?? '', ['pinned', 'private'], true)
            ? sanitize_key($_POST['sd_note_scope'])
            : 'private';
        update_post_meta($post_id, '_sd_note_scope', $scope);

        if (isset($_POST['sd_note_sticky_level'])) {
            update_post_meta($post_id, '_sd_note_sticky_level', sanitize_key($_POST['sd_note_sticky_level']));
        }

        $is_code = isset($_POST['sd_note_is_code']) ? 1 : 0;
        update_post_meta($post_id, '_sd_note_is_code', $is_code);

        if (isset($_POST['sd_note_code_content'])) {
            // Note: Since code snippets can contain HTML/PHP, use wp_unslash without sanitizing.
            update_post_meta($post_id, '_sd_note_code_content', wp_unslash($_POST['sd_note_code_content']));
        }
    }

    protected static function output(array $context): void
    {
        ?>
        <div class="sd-notes-widget">
            <div class="sd-toolbar">

                <button type="button" class="button button-small button-primary sd-note-new">
                    <?php _e('New Note', 'systemdeck'); ?>
                </button>

                <button type="button" class="button button-small sd-context-filter-btn sd-note-context-filter"
                    title="<?php esc_attr_e('Show notes for this page only', 'systemdeck'); ?>">
                    <span class="dashicons dashicons-filter sd-button-icon"></span>
                    <?php _e('This Page', 'systemdeck'); ?>
                </button>
            </div>

            <div class="sd-table-container">
                <table class="wp-list-table widefat fixed striped sd-notes-table" style="display:none;">
                    <thead>
                        <tr>
                            <th scope="col" class="column-sticky"><span class="dashicons dashicons-admin-post"></span></th>
                            <th scope="col" class="column-title"><?php _e('Title', 'systemdeck'); ?></th>
                            <th scope="col" class="column-comments"><span class="dashicons dashicons-admin-comments"
                                    title="Comments"></span></th>
                            <th scope="col" class="column-date"><?php _e('Date', 'systemdeck'); ?></th>
                        </tr>
                    </thead>
                    <tbody class="sd-notes-list">
                        <tr class="loading-text">
                            <td colspan="4" class="sd-loading-td"><?php _e('Loading...', 'systemdeck'); ?></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="sd-empty-state sd-notes-empty-state" style="display:none;">
                <?php _e('No notes found.', 'systemdeck'); ?>
            </div>

            <div class="tablenav bottom sd-pagination sd-notes-pagination" style="display:none;">
                <div class="alignleft actions">
                    <span class="displaying-num sd-notes-total-count"></span>
                </div>
                <div class="tablenav-pages">
                    <span class="pagination-links">
                        <button type="button" class="button button-small sd-notes-prev" disabled>&lsaquo;</button>
                        <span class="paging-input">
                            <span class="sd-notes-current-page">1</span> <?php _e('of', 'systemdeck'); ?> <span
                                class="sd-notes-total-pages">1</span>
                        </span>
                        <button type="button" class="button button-small sd-notes-next" disabled>&rsaquo;</button>
                    </span>
                </div>
            </div>

            <!-- Note Edit/Create Modal -->
            <div class="sd-modal-overlay sd-note-view-modal sd-note-edit-modal" style="display:none;">
                <div class="components-modal__frame components-modal" role="dialog" tabindex="-1">
                    <div class="components-modal__content" role="document">
                        <div class="components-modal__header">
                            <div class="components-modal__header-heading-container">
                                <h1 class="components-modal__header-heading sd-note-edit-modal-heading">
                                    <?php _e('Edit Note', 'systemdeck'); ?>
                                </h1>
                            </div>
                            <span class="sd-note-edit-urgency"></span>
                            <button type="button" class="components-button has-icon sd-modal-close"
                                aria-label="<?php esc_attr_e('Close dialog', 'systemdeck'); ?>">
                                <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                    aria-hidden="true" focusable="false">
                                    <path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z">
                                    </path>
                                </svg>
                            </button>
                        </div>
                        <div class="sd-modal-body">
                            <div class="sd-note-form-container">
                                <input type="hidden" class="sd-note-id" value="">
                                <input type="hidden" class="sd-note-excerpt" value="">
                                <input type="hidden" class="sd-note-context" value="">

                                <div class="sd-notes-form-header">
                                    <div class="sd-notes-tools-left">
                                        <a href="#" target="_blank" class="button-link sd-visit-link sd-note-visit-link"
                                            title="<?php esc_attr_e('Visit original URL', 'systemdeck'); ?>">
                                            <span class="dashicons dashicons-external"></span>
                                            <?php _e('Visit', 'systemdeck'); ?>
                                        </a>
                                        <button type="button" class="button-link delete sd-note-delete">
                                            <?php _e('Delete', 'systemdeck'); ?>
                                        </button>
                                    </div>
                                    <div class="sd-notes-tools-right">
                                        <label title="<?php esc_attr_e('Capture current page URL with note', 'systemdeck'); ?>">
                                            <input type="checkbox" class="sd-note-capture" value="1">
                                            <?php _e('Capture URL', 'systemdeck'); ?>
                                        </label>
                                        <label title="<?php esc_attr_e('Enable code editor mode', 'systemdeck'); ?>">
                                            <input type="checkbox" class="sd-note-is-code" value="1">
                                            <?php _e('Is Code', 'systemdeck'); ?>
                                        </label>
                                    </div>
                                </div>

                                <div class="input-text-wrap sd-note-title-wrap">
                                    <label class="screen-reader-text"><?php _e('Title', 'systemdeck'); ?></label>
                                    <input type="text" class="widefat sd-note-title"
                                        placeholder="<?php esc_attr_e('Title', 'systemdeck'); ?>" autocomplete="off">
                                </div>
                                <div class="textarea-wrap sd-note-content-wrapper">
                                    <label class="screen-reader-text"><?php _e('Content', 'systemdeck'); ?></label>
                                    <textarea class="widefat sd-note-content"
                                        placeholder="<?php esc_attr_e('Type your note here...', 'systemdeck'); ?>"
                                        rows="8"></textarea>
                                </div>

                                <div class="sd-note-code-wrapper">
                                    <div class="description sd-code-label">
                                        <?php _e('SOURCE CODE', 'systemdeck'); ?>
                                    </div>
                                    <div class="textarea-wrap sd-code-container">
                                        <textarea dir="ltr" class="wp-editor-area widefat sd-note-code-content" rows="15"
                                            cols="70"></textarea>
                                    </div>
                                </div>

                                <div class="sd-notes-form-footer">
                                    <div class="sd-note-sticky-controls">
                                        <label
                                            title="<?php esc_attr_e('Pin this note to the workspace board', 'systemdeck'); ?>">
                                            <input type="checkbox" class="sd-note-is-projected" value="1">
                                            <?php _e('Pin Note', 'systemdeck'); ?>
                                        </label>
                                        <div class="sd-sticky-levels sd-note-sticky-level-wrap">
                                            <label><input type="radio" name="sd_note_level" value="urgent">
                                                <?php _e('Urgent', 'systemdeck'); ?></label>
                                            <label><input type="radio" name="sd_note_level" value="high">
                                                <?php _e('High', 'systemdeck'); ?></label>
                                            <label><input type="radio" name="sd_note_level" value="moderate">
                                                <?php _e('Moderate', 'systemdeck'); ?></label>
                                            <label><input type="radio" name="sd_note_level" value="low" checked>
                                                <?php _e('Low', 'systemdeck'); ?></label>
                                        </div>
                                    </div>

                                    <p class="submit">
                                        <span class="spinner"></span>
                                        <button type="button" class="button button-primary sd-note-save">
                                            <?php _e('Save Note', 'systemdeck'); ?>
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Note Read-Only Modal -->
            <div class="sd-modal-overlay sd-note-view-modal sd-note-read-modal" style="display:none;">
                <div class="components-modal__frame components-modal" role="dialog" tabindex="-1">
                    <div class="components-modal__content" role="document">
                        <div class="components-modal__header">
                            <div class="components-modal__header-heading-container">
                                <h1 class="components-modal__header-heading sd-note-read-title"></h1>
                                <div class="sd-note-author-date">
                                    <?php _e('By', 'systemdeck'); ?> <span class="sd-note-read-author"></span> &bull; <span
                                        class="sd-note-read-date"></span>
                                </div>
                            </div>

                            <div class="sd-modal-header-actions">
                                <span class="sd-note-read-urgency"></span>
                                <button type="button" class="components-button has-icon sd-modal-close"
                                    aria-label="<?php esc_attr_e('Close dialog', 'systemdeck'); ?>">
                                    <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                        aria-hidden="true" focusable="false">
                                        <path
                                            d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z">
                                        </path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="sd-modal-body">
                            <div class="sd-note-content-render sd-note-read-content"></div>
                            <div class="sd-note-read-url-bar">
                                <a class="sd-note-read-visit-url" href="#" target="_blank" rel="noopener">
                                    <span
                                        class="dashicons dashicons-external"></span><?php _e('Visit captured URL', 'systemdeck'); ?>
                                </a>
                            </div>

                            <div class="sd-note-comments-section">
                                <h4 class="sd-comments-heading"><?php _e('Discussion', 'systemdeck'); ?></h4>
                                <div class="sd-note-comments-list"></div>

                                <div class="sd-note-comment-form sd-note-comment-form-container">
                                    <div class="textarea-wrap">
                                        <label
                                            class="screen-reader-text"><?php _e('Write a comment...', 'systemdeck'); ?></label>
                                        <textarea class="widefat sd-note-new-comment" rows="4"
                                            placeholder="<?php esc_attr_e('Write a comment...', 'systemdeck'); ?>"></textarea>
                                    </div>
                                    <input type="hidden" class="sd-note-parent-comment" value="0">
                                    <p class="submit">
                                        <button
                                            class="button button-primary sd-note-save-comment"><?php _e('Post Comment', 'systemdeck'); ?></button>
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

    public static function ajax_get_notes($request): array
    {
        $user_id = get_current_user_id();
        $limit = isset($request['limit']) ? intval($request['limit']) : 5;
        $workspace_id = sanitize_key($request['workspace_id'] ?? '');
        $context_url = $request['context'] ?? '';
        $paged = isset($request['paged']) ? max(1, intval($request['paged'])) : 1;

        $args = [
            'post_type' => self::CPT,
            'post_status' => ['publish', 'private'],
            'posts_per_page' => $limit,
            'paged' => $paged,
            'author' => $user_id,
            'meta_query' => [
                'relation' => 'OR',
                'sticky_clause' => [
                    'key' => '_sd_note_is_sticky',
                    'compare' => 'EXISTS',
                    'type' => 'NUMERIC',
                ],
                'no_sticky_clause' => [
                    'key' => '_sd_note_is_sticky',
                    'compare' => 'NOT EXISTS',
                ],
            ],
            'orderby' => [
                'sticky_clause' => 'DESC',
                'date' => 'DESC',
            ],
        ];

        if (!empty($workspace_id)) {
            $args['meta_query'] = [
                'relation' => 'AND',
                $args['meta_query'],
                [
                    'relation' => 'OR',
                    [
                        'key' => '_sd_note_workspace_id',
                        'value' => $workspace_id,
                        'compare' => '='
                    ],
                    [
                        'key' => '_sd_note_workspace_id',
                        'compare' => 'NOT EXISTS'
                    ]
                ]
            ];
        }

        if (!empty($context_url)) {
            $args['meta_query'] = [
                'relation' => 'AND',
                $args['meta_query'],
                [
                    'key' => '_sd_note_context',
                    'value' => $context_url,
                    'compare' => 'LIKE'
                ]
            ];
        }

        $query = new \WP_Query($args);

        $user_workspaces = get_user_meta($user_id, 'sd_workspaces', true);
        if (!is_array($user_workspaces)) {
            $user_workspaces = [];
        }

        $notes = [];
        while ($query->have_posts()) {
            $query->the_post();
            $id = get_the_ID();
            $ws_id = get_post_meta($id, '_sd_note_workspace_id', true);

            $ws_name = '';
            if (!empty($ws_id) && isset($user_workspaces[$ws_id]['name'])) {
                $ws_name = sanitize_text_field($user_workspaces[$ws_id]['name']);
            }
            if (empty($ws_name)) {
                $ws_name = get_post_meta($id, '_sd_note_workspace_name', true) ?: (is_admin() && !wp_doing_ajax() ? 'Admin' : 'Personal');
            }

            $title = get_the_title() ?: __('(Untitled)', 'systemdeck');
            $display_title = mb_strlen($title) > 16 ? mb_substr($title, 0, 13) . '...' : $title;

            $notes[] = [
                'is_author' => true,
                'id' => $id,
                'title' => $display_title,
                'full_title' => $title,
                'content' => get_the_content(),
                'excerpt' => get_the_excerpt(),

                // Public client field
                'is_sticky' => get_post_meta($id, '_sd_note_is_sticky', true) === '1',
                'date' => get_the_time('m/d/Y'),
                'modified' => get_the_modified_date('m/d/Y'),
                'is_modified' => (get_the_time('U') !== get_the_modified_time('U')),
                'is_pinned' => (bool) get_post_meta($id, '_sd_is_pinned', true),
                'is_code' => (bool) get_post_meta($id, '_sd_note_is_code', true),
                'code_content' => get_post_meta($id, '_sd_note_code_content', true),
                'context' => get_post_meta($id, '_sd_note_context', true),
                'author_id' => (int) get_the_author_meta('ID'),
                'author_name' => get_the_author(),
                'scope' => self::normalize_scope(get_post_meta($id, '_sd_note_scope', true) ?: 'private'),
                'sticky_level' => get_post_meta($id, '_sd_note_sticky_level', true) ?: 'low',
                'workspace_id' => $ws_id,
                'workspace_name' => $ws_name,
                'origin_workspace_name' => get_post_meta($id, '_sd_note_origin_workspace_name', true) ?: '',
                'comment_count' => (int) get_comments_number($id)
            ];
        }
        $max_pages = $query->max_num_pages;
        $total = $query->found_posts;
        wp_reset_postdata();

        return [
            'notes' => $notes,
            'max_pages' => $max_pages,
            'total' => $total
        ];
    }

    public static function ajax_save_note($request): array
    {
        $id = intval($request['id'] ?? 0);
        $title = sanitize_text_field($request['title'] ?? '');
        $content = wp_kses_post($request['content'] ?? '');
        $code_content = $request['code_content'] ?? '';
        $excerpt = sanitize_text_field($request['excerpt'] ?? '');

        if (!$title && !$content && !$code_content) {
            throw new \Exception(__('Empty note', 'systemdeck'));
        }

        // scope: pinned | private (sent from JS). Normalize legacy values defensively.
        $raw_scope = $request['scope'] ?? '';
        $scope = self::normalize_scope($raw_scope);
        $is_sticky = !empty($request['is_sticky']) ? 1 : 0; // ordering only
        $workspace_id = sanitize_key($request['workspace_id'] ?? '');

        // A pinned note requires a workspace
        if ($scope === 'pinned' && empty($workspace_id)) {
            throw new \Exception(__('A pinned note requires a workspace. Please select one.', 'systemdeck'));
        }

        // Workspace write gate — delegates to core ObjectAccessGate.
        if ($scope === 'pinned' && !empty($workspace_id)) {
            \SystemDeck\Core\Services\ObjectAccessGate::require_workspace_write(get_current_user_id(), $workspace_id);
        }

        $post_data = [
            'post_title' => $title,
            'post_content' => $content,
            'post_excerpt' => $excerpt,
            // Pinned notes are published so workspace members can load them; private notes stay private
            'post_status' => ($scope === 'pinned') ? 'publish' : 'private',
            'post_type' => self::CPT
        ];

        if ($id > 0) {
            \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());
            $post_data['ID'] = $id;
            $result = wp_update_post($post_data);
        } else {
            $post_data['post_author'] = get_current_user_id();
            $result = wp_insert_post($post_data);
        }

        if (!$result || is_wp_error($result)) {
            throw new \Exception(is_wp_error($result) ? $result->get_error_message() : __('Failed to save note', 'systemdeck'));
        }

        update_post_meta($result, '_sd_note_is_code', !empty($request['is_code']) ? 1 : 0);
        $code_content = $request['code_content'] ?? '';
        if (!current_user_can('unfiltered_html')) {
            $code_content = wp_kses_post($code_content);
        }
        update_post_meta($result, '_sd_note_code_content', $code_content);
        update_post_meta($result, '_sd_note_context', sanitize_text_field($request['context'] ?? ''));

        // Sticky = list ordering only. Guarantee meta exists for normalized sorting.
        if (!metadata_exists('post', $result, '_sd_note_is_sticky')) {
            update_post_meta($result, '_sd_note_is_sticky', 0);
        }
        update_post_meta($result, '_sd_note_is_sticky', $is_sticky);

        // Scope and pin metadata
        update_post_meta($result, '_sd_note_scope', $scope);
        update_post_meta($result, '_sd_note_sticky_level', sanitize_key($request['sticky_level'] ?? 'low'));

        $workspace_name = sanitize_text_field($request['workspace_name'] ?? '');

        // Preserve origin workspace on first save (never overwrite origin once set)
        $existing_origin = get_post_meta($result, '_sd_note_origin_workspace_name', true);
        if (empty($existing_origin) && !empty($workspace_name)) {
            update_post_meta($result, '_sd_note_origin_workspace_name', $workspace_name);
        }

        if ($scope === 'pinned') {
            // Update the live pinned destination
            update_post_meta($result, '_sd_note_workspace_id', $workspace_id);
            update_post_meta($result, '_sd_note_workspace_name', $workspace_name);
        } else {
            // Clear live pin destination when not pinned
            delete_post_meta($result, '_sd_note_workspace_id');
            delete_post_meta($result, '_sd_note_workspace_name');
        }

        // Drive workspace projection off PINNED state only
        self::sync_pin_projection($result, $scope, $workspace_id);

        return ['id' => $result];
    }

    /**
     * Sync workspace pin projection — delegates to core ProjectionService.
     * Builds note-specific settings payload, then calls the shared sync.
     */
    private static function sync_pin_projection(int $note_id, string $scope, string $workspace_id): void
    {
        $note = get_post($note_id);
        $title = $note ? $note->post_title : __('Note', 'systemdeck');
        if (mb_strlen($title) > 16) {
            $title = mb_substr($title, 0, 13) . '...';
        }

        $settings = [
            'noteId' => $note_id,
            'type' => 'note',
            'pin_kind' => 'pinned_note',
            'label' => $title,
            'title' => $title,
            'icon' => 'dashicons-paperclip',
            'grid_span' => '2x1',
            'size' => '2x1',
            'renderer' => 'dom',
            'design_template' => 'default',
            'pin_level' => get_post_meta($note_id, '_sd_note_sticky_level', true) ?: 'low',
            'data' => [
                'noteId' => $note_id,
                'type' => 'note',
                'pin_kind' => 'pinned_note',
                'label' => $title,
                'icon' => 'dashicons-paperclip',
                'sticky_level' => get_post_meta($note_id, '_sd_note_sticky_level', true) ?: 'low',
            ],
        ];

        \SystemDeck\Core\Services\ProjectionService::sync(
            $note_id,
            $scope,
            $workspace_id,
            'note',
            $settings,
            'pinned'
        );
    }

    /**
     * Migrate legacy scope values to the canonical model.
     * sticky → pinned (was old projection term)
     * personal → private (was old private term)
     * Everything else unknown → private
     */
    private static function normalize_scope(string $scope): string
    {
        $scope = sanitize_key($scope);
        if ($scope === 'sticky')
            return 'pinned';
        if ($scope === 'personal')
            return 'private';
        if (in_array($scope, ['pinned', 'private'], true))
            return $scope;
        return 'private'; // safe default
    }

    /**
     * Reusable permission resolver — delegates to core ObjectAccessGate.
     * Returns a compat-shaped array so existing callers don't break.
     */
    private static function resolve_sticky_access(int $note_id, int $user_id): array
    {
        $access = \SystemDeck\Core\Services\ObjectAccessGate::resolve(
            $note_id,
            self::CPT,
            $user_id,
            '_sd_note_scope',
            '_sd_note_workspace_id',
            'pinned'
        );

        return [
            'can_edit' => $access['can_edit'],
            'can_comment' => $access['can_comment'],
            'scope' => self::normalize_scope($access['scope'] ?: 'private'),
            'workspace_id' => $access['workspace_id'],
            'post' => $access['post'],
        ];
    }

    public static function ajax_toggle_note_sticky($request): array
    {
        $id = intval($request['note_id'] ?? 0);
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $current = get_post_meta($id, '_sd_note_is_sticky', true);
        $next = ($current === '1') ? 0 : 1;
        update_post_meta($id, '_sd_note_is_sticky', (string)$next);

        return [
            'id' => $id,
            'is_sticky' => $next === 1
        ];
    }

    public static function ajax_delete_note($request): array
    {
        $id = intval($request['id'] ?? 0);
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        // Remove any pin projection before deleting
        self::sync_pin_projection($id, 'private', '');
        wp_delete_post($id, true);
        return ['status' => 'success'];
    }

    public static function ajax_get_read_note($request): array
    {
        $id = intval($request['id'] ?? 0);
        $user_id = get_current_user_id();

        $access = self::resolve_sticky_access($id, $user_id);
        $post = $access['post'];

        $title = $post->post_title ?: __('(Untitled)', 'systemdeck');
        if (mb_strlen($title) > 16) {
            $title = mb_substr($title, 0, 13) . '...';
        }

        return [
            'note' => [
                'id' => $id,
                'title' => $title,
                'content' => apply_filters('the_content', $post->post_content),
                'date' => get_the_modified_date('M j', $post),
                'author_name' => get_the_author_meta('display_name', $post->post_author),
                'sticky_level' => get_post_meta($id, '_sd_note_sticky_level', true) ?: 'low',
                'is_code' => (bool) get_post_meta($id, '_sd_note_is_code', true),
                'code_content' => get_post_meta($id, '_sd_note_code_content', true),
                'context' => get_post_meta($id, '_sd_note_context', true) ?: '',
                'can_edit' => $access['can_edit'],
                'can_comment' => $access['can_comment']
            ]
        ];
    }

    /**
     * Handle Cleanup for Workspace Deletion (Priority Task 4 & 12)
     */
    public static function handle_workspace_purge(string $workspace_id): void
    {
        global $wpdb;

        // Find all notes bound to this workspace
        $notes = get_posts([
            'post_type' => self::CPT,
            'posts_per_page' => -1,
            'meta_query' => [
                [
                    'key' => '_sd_note_workspace_id',
                    'value' => $workspace_id
                ]
            ],
            'fields' => 'ids'
        ]);

        if (empty($notes)) {
            return;
        }

        foreach ($notes as $note_id) {
            // Remove pin projection — workspace is gone
            self::sync_pin_projection($note_id, 'private', '');

            // Downgrade note: clear scope to private, keep origin workspace snapshot intact
            update_post_meta($note_id, '_sd_note_scope', 'private');
            delete_post_meta($note_id, '_sd_note_workspace_id');
            delete_post_meta($note_id, '_sd_note_workspace_name');

            wp_update_post([
                'ID' => $note_id,
                'post_status' => 'private'
            ]);
        }
    }


    public static function ajax_get_note_comments($request): array
    {
        $note_id = intval($request['note_id'] ?? 0);
        $user_id = get_current_user_id();

        // Access gate — throws on denial.
        self::resolve_sticky_access($note_id, $user_id);

        return ['comments' => \SystemDeck\Core\Services\CommentService::get_comment_tree($note_id)];
    }

    public static function ajax_add_note_comment($request): array
    {
        $note_id = intval($request['note_id'] ?? 0);
        $content = $request['content'] ?? '';
        $user_id = get_current_user_id();
        $parent_id = intval($request['parent_id'] ?? 0);

        $comment_id = \SystemDeck\Core\Services\CommentService::add_comment(
            $note_id,
            $content,
            $user_id,
            $parent_id,
            self::CPT,
            '_sd_note_scope',
            '_sd_note_workspace_id',
            'pinned'
        );

        return ['status' => 'success', 'comment_id' => $comment_id];
    }
    public static function ajax_save_note_tasks($request): array
    {
        $id = intval($request['id'] ?? 0);
        $content = $request['content'] ?? '';

        if (!$id) {
            throw new \Exception(__('Invalid note ID', 'systemdeck'));
        }

        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $result = wp_update_post([
            'ID' => $id,
            'post_content' => $content
        ]);

        if (is_wp_error($result) || !$result) {
            throw new \Exception(__('Failed to save tasks', 'systemdeck'));
        }

        return ['status' => 'success'];
    }

    public static function handle_workspace_deletion($post_id): void
    {
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'systemdeck_canvas')
            return;

        $workspace_id = get_post_meta($post_id, '_sd_workspace_id', true);
        if (!$workspace_id)
            return;

        $notes = get_posts([
            'post_type' => self::CPT,
            'meta_key' => '_sd_note_workspace_id',
            'meta_value' => $workspace_id,
            'posts_per_page' => -1,
            'fields' => 'ids',
            'post_status' => 'any'
        ]);

        foreach ($notes as $note_id) {
            self::sync_pin_projection($note_id, 'private', '');
            update_post_meta($note_id, '_sd_note_scope', 'private');
            delete_post_meta($note_id, '_sd_note_workspace_id');
            delete_post_meta($note_id, '_sd_note_workspace_name');
            wp_update_post([
                'ID' => $note_id,
                'post_status' => 'private'
            ]);
        }

        // Clean up any remaining note projections via ProjectionService.
        \SystemDeck\Core\Services\ProjectionService::purge_workspace($workspace_id, 'note.%');
    }
}
