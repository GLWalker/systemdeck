<?php

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

    private const CPT = 'sd_note';

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js' => ['app.js']
        ];
    }

    public static function register_cpt(): void
    {
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
        add_filter('manage_sd_note_posts_columns', [self::class, 'manage_admin_columns']);
        add_action('manage_sd_note_posts_custom_column', [self::class, 'render_admin_columns'], 10, 2);
        add_action('add_meta_boxes', [self::class, 'add_meta_boxes']);
        add_action('save_post_sd_note', [self::class, 'save_meta_boxes']);
        add_action('systemdeck_purge_workspace', [self::class, 'handle_workspace_purge']);
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
        if ($pin_ws) {
            $pin_ws_nm = get_post($pin_ws) ? get_the_title($pin_ws) : 'Unknown';
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
        <div class="sd-notes-widget" id="sd-notes-widget">
            <div class="sd-toolbar">

                <button type="button" class="button button-small button-primary" id="sd-note-new">
                    <?php _e('New Note', 'systemdeck'); ?>
                </button>

                <button type="button" class="button button-small sd-context-filter-btn" id="sd-note-context-filter"
                    title="<?php esc_attr_e('Show notes for this page only', 'systemdeck'); ?>">
                    <span class="dashicons dashicons-filter sd-button-icon"></span>
                    <?php _e('This Page', 'systemdeck'); ?>
                </button>
            </div>

            <table class="wp-list-table widefat fixed striped sd-notes-table" id="sd-notes-table" style="display:none;">
                <thead>
                    <tr>
                        <th scope="col" class="column-sticky"><span class="dashicons dashicons-admin-post"></span></th>
                        <th scope="col" class="column-title"><?php _e('Title', 'systemdeck'); ?></th>
                        <th scope="col" class="column-workspace"><?php _e('Workspace', 'systemdeck'); ?></th>
                        <th scope="col" class="column-context"><?php _e('URL Context', 'systemdeck'); ?></th>
                        <th scope="col" class="column-comments"><span class="dashicons dashicons-admin-comments"
                                title="Comments"></span></th>
                        <th scope="col" class="column-date"><?php _e('Date', 'systemdeck'); ?></th>
                    </tr>
                </thead>
                <tbody id="sd-notes-list">
                    <tr class="loading-text">
                        <td colspan="6" class="sd-loading-td"><?php _e('Loading...', 'systemdeck'); ?></td>
                    </tr>
                </tbody>
            </table>

            <div class="sd-empty-state" id="sd-notes-empty-state" style="display:none;">
                <?php _e('No notes found.', 'systemdeck'); ?>
            </div>

            <div class="tablenav bottom sd-pagination sd-notes-pagination" id="sd-notes-pagination" style="display:none;">
                <div class="alignleft actions">
                    <span class="displaying-num" id="sd-notes-total-count"></span>
                </div>
                <div class="tablenav-pages">
                    <span class="pagination-links">
                        <button type="button" class="button button-small" id="sd-notes-prev" disabled>&lsaquo;</button>
                        <span class="paging-input">
                            <span id="sd-notes-current-page">1</span> <?php _e('of', 'systemdeck'); ?> <span
                                id="sd-notes-total-pages">1</span>
                        </span>
                        <button type="button" class="button button-small" id="sd-notes-next" disabled>&rsaquo;</button>
                    </span>
                </div>
            </div>

            <!-- Note Edit/Create Modal -->
            <div id="sd-note-edit-modal" class="sd-modal-overlay sd-note-view-modal" style="display:none;">
                <div class="components-modal__frame components-modal" role="dialog" tabindex="-1">
                    <div class="components-modal__content" role="document">
                        <div class="components-modal__header">
                            <div class="components-modal__header-heading-container">
                                <h1 id="sd-note-edit-modal-heading" class="components-modal__header-heading">
                                    <?php _e('Edit Note', 'systemdeck'); ?></h1>
                            </div>
                            <span id="sd-note-edit-urgency"></span>
                            <button type="button" class="components-button has-icon sd-modal-close"
                                data-closes="sd-note-edit-modal"
                                aria-label="<?php esc_attr_e('Close dialog', 'systemdeck'); ?>">
                                <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                    aria-hidden="true" focusable="false">
                                    <path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z">
                                    </path>
                                </svg>
                            </button>
                        </div>
                        <div class="sd-modal-body">
                            <div id="sd-note-form-container">
                                <input type="hidden" id="sd-note-id" value="">
                                <input type="hidden" id="sd-note-excerpt" value="">
                                <input type="hidden" id="sd-note-context" value="">

                                <div class="sd-notes-form-header">
                                    <div class="sd-notes-tools-left">
                                        <a href="#" id="sd-note-visit-link" target="_blank" class="button-link sd-visit-link"
                                            title="<?php esc_attr_e('Visit original URL', 'systemdeck'); ?>">
                                            <span class="dashicons dashicons-external"></span>
                                            <?php _e('Visit', 'systemdeck'); ?>
                                        </a>
                                        <button type="button" class="button-link delete" id="sd-note-delete">
                                            <?php _e('Delete', 'systemdeck'); ?>
                                        </button>
                                    </div>
                                    <div class="sd-notes-tools-right">
                                        <label title="<?php esc_attr_e('Capture current page URL with note', 'systemdeck'); ?>">
                                            <input type="checkbox" id="sd-note-capture" value="1">
                                            <?php _e('Capture URL', 'systemdeck'); ?>
                                        </label>
                                        <label title="<?php esc_attr_e('Enable code editor mode', 'systemdeck'); ?>">
                                            <input type="checkbox" id="sd-note-is-code" value="1">
                                            <?php _e('Is Code', 'systemdeck'); ?>
                                        </label>
                                    </div>
                                </div>

                                <div class="input-text-wrap" id="sd-note-title-wrap">
                                    <label for="sd-note-title"
                                        class="screen-reader-text"><?php _e('Title', 'systemdeck'); ?></label>
                                    <input type="text" id="sd-note-title" class="widefat"
                                        placeholder="<?php esc_attr_e('Title', 'systemdeck'); ?>" autocomplete="off">
                                </div>
                                <div class="textarea-wrap" id="sd-note-content-wrapper">
                                    <label for="sd-note-content"
                                        class="screen-reader-text"><?php _e('Content', 'systemdeck'); ?></label>
                                    <textarea id="sd-note-content" class="widefat"
                                        placeholder="<?php esc_attr_e('Type your note here...', 'systemdeck'); ?>"
                                        rows="8"></textarea>
                                </div>

                                <div id="sd-note-code-wrapper">
                                    <div class="description sd-code-label">
                                        <?php _e('SOURCE CODE', 'systemdeck'); ?>
                                    </div>
                                    <div class="textarea-wrap sd-code-container">
                                        <textarea id="sd-note-code-content" dir="ltr" class="wp-editor-area widefat" rows="15"
                                            cols="70"></textarea>
                                    </div>
                                </div>

                                <div class="sd-notes-form-footer">
                                    <div class="sd-note-sticky-controls">
                                        <label
                                            title="<?php esc_attr_e('Pin this note to the workspace board', 'systemdeck'); ?>">
                                            <input type="checkbox" id="sd-note-is-projected" value="1">
                                            <?php _e('Pin Note', 'systemdeck'); ?>
                                        </label>

                                        <div id="sd-note-sticky-level-wrap" class="sd-sticky-levels">
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
                                        <button type="button" class="button button-primary" id="sd-note-save">
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
            <div id="sd-note-read-modal" class="sd-modal-overlay sd-note-view-modal" style="display:none;">
                <div class="components-modal__frame components-modal" role="dialog" tabindex="-1">
                    <div class="components-modal__content" role="document">
                        <div class="components-modal__header">
                            <div class="components-modal__header-heading-container">
                                <h1 id="sd-note-read-title" class="components-modal__header-heading"></h1>
                                <div class="sd-note-author-date">
                                    <?php _e('By', 'systemdeck'); ?> <span id="sd-note-read-author"></span> &bull; <span
                                        id="sd-note-read-date"></span>
                                </div>
                            </div>

                            <div class="sd-modal-header-actions">
                                <span id="sd-note-read-urgency"></span>
                                <button type="button" class="components-button has-icon sd-modal-close"
                                    data-closes="sd-note-read-modal"
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
                            <div id="sd-note-read-content" class="sd-note-content-render"></div>

                            <div id="sd-note-read-url-bar">
                                <a id="sd-note-read-visit-url" href="#" target="_blank" rel="noopener">
                                    <span
                                        class="dashicons dashicons-external"></span><?php _e('Visit captured URL', 'systemdeck'); ?>
                                </a>
                            </div>

                            <div class="sd-note-comments-section">
                                <h4 class="sd-comments-heading"><?php _e('Discussion', 'systemdeck'); ?></h4>
                                <div id="sd-note-comments-list"></div>

                                <div class="sd-note-comment-form" id="sd-note-comment-form-container">
                                    <div class="textarea-wrap">
                                        <label for="sd-note-new-comment"
                                            class="screen-reader-text"><?php _e('Write a comment...', 'systemdeck'); ?></label>
                                        <textarea id="sd-note-new-comment" class="widefat" rows="4"
                                            placeholder="<?php esc_attr_e('Write a comment...', 'systemdeck'); ?>"></textarea>
                                    </div>
                                    <input type="hidden" id="sd-note-parent-comment" value="0">
                                    <p class="submit">
                                        <button id="sd-note-save-comment"
                                            class="button button-primary"><?php _e('Post Comment', 'systemdeck'); ?></button>
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
                [
                    'key' => '_sd_note_is_sticky',
                    'compare' => 'EXISTS',
                ],
                [
                    'key' => '_sd_note_is_sticky',
                    'compare' => 'NOT EXISTS',
                ],
            ],
            'orderby' => [
                'meta_value_num' => 'DESC',
                'date'           => 'DESC',
            ],
        ];

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
                // Internal sort keys — stripped before JSON response
                '_sort_ts' => (int) get_the_time('U'),
                '_is_sticky' => (int) get_post_meta($id, '_sd_note_is_sticky', true),
                // Public client field
                'is_sticky' => get_post_meta($id, '_sd_note_is_sticky', true) === '1',
                'date' => get_the_time('Y/m/d \a\t g:i a'),
                'modified' => get_the_modified_date('Y/m/d \a\t g:i a'),
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

        // PHP sort — guaranteed sticky-on-top, not dependent on DB join behaviour.
        // Rule: sticky=1 before sticky=0/unset; within each group: newest date-added first.
        usort($notes, static function (array $a, array $b): int {
            if ($a['_is_sticky'] !== $b['_is_sticky']) {
                return $b['_is_sticky'] - $a['_is_sticky']; // 1 before 0
            }
            return $b['_sort_ts'] - $a['_sort_ts']; // newer first within same group
        });

        // Strip internal sort keys before sending to client
        $notes = array_map(static function (array $n): array {
            unset($n['_sort_ts'], $n['_is_sticky']);
            return $n;
        }, $notes);

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

        if (is_wp_error($result)) {
            throw new \Exception($result->get_error_message());
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
            'grid_span' => '1x1',
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

    public static function ajax_pin_note($request): array
    {
        $id = intval($request['id'] ?? 0);
        \SystemDeck\Core\Services\ObjectAccessGate::require_author($id, self::CPT, get_current_user_id());

        $current = get_post_meta($id, '_sd_is_pinned', true);
        if ($current) {
            delete_post_meta($id, '_sd_is_pinned');
        } else {
            update_post_meta($id, '_sd_is_pinned', 1);
        }
        return ['status' => 'success'];
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

    public static function ajax_get_all_notes($request): array
    {
        $user_id = get_current_user_id();

        // Cache workspace titles for the context display
        static $workspace_titles = null;
        if ($workspace_titles === null) {
            $workspace_titles = [];
            $canvases = get_posts([
                'post_type' => 'systemdeck_canvas',
                'posts_per_page' => -1,
                'post_status' => 'any'
            ]);
            foreach ($canvases as $canvas) {
                $ws_id = get_post_meta($canvas->ID, '_sd_workspace_id', true);
                if ($ws_id) {
                    $workspace_titles[$ws_id] = $canvas->post_title;
                }
            }
        }

        $args = [
            'post_type' => self::CPT,
            'post_status' => ['publish', 'private'],
            'posts_per_page' => -1,
            'author' => $user_id,
            'meta_query' => [
                'relation' => 'OR',
                'pinned_clause' => [
                    'key' => '_sd_is_pinned',
                    'compare' => 'EXISTS'
                ],
                'not_pinned_clause' => [
                    'key' => '_sd_is_pinned',
                    'compare' => 'NOT EXISTS'
                ]
            ],
            'orderby' => [
                'pinned_clause' => 'DESC',
                'post_modified' => 'DESC'
            ]
        ];

        $query = new \WP_Query($args);

        $notes = [];
        while ($query->have_posts()) {
            $query->the_post();
            $id = get_the_ID();
            $ws_id = get_post_meta($id, '_sd_note_workspace_id', true);

            $title = get_the_title() ?: __('(Untitled)', 'systemdeck');
            if (mb_strlen($title) > 16) {
                $title = mb_substr($title, 0, 13) . '...';
            }

            $notes[] = [
                'is_author' => true,
                'id' => $id,
                'title' => $title,
                'content' => get_the_content(),
                'excerpt' => get_the_excerpt(),
                'date' => get_the_modified_date('M j'),
                'is_pinned' => (bool) get_post_meta($id, '_sd_is_pinned', true),
                'is_code' => (bool) get_post_meta($id, '_sd_note_is_code', true),
                'code_content' => get_post_meta($id, '_sd_note_code_content', true),
                'context' => get_post_meta($id, '_sd_note_context', true),
                'author_id' => (int) get_the_author_meta('ID'),
                'author_name' => get_the_author(),
                'scope' => self::normalize_scope(get_post_meta($id, '_sd_note_scope', true) ?: 'private'),
                'sticky_level' => get_post_meta($id, '_sd_note_sticky_level', true) ?: 'low',
                'workspace_id' => $ws_id,
                'workspace_title' => $workspace_titles[$ws_id] ?? '',
                'origin_workspace_name' => get_post_meta($id, '_sd_note_origin_workspace_name', true) ?: ''
            ];
        }
        wp_reset_postdata();
        return ['notes' => $notes];
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
        \SystemDeck\Core\Services\ProjectionService::purge_workspace((string) $post_id, 'note.%');
    }
}

add_action('init', [Notes::class, 'register_cpt']);
add_action('before_delete_post', [Notes::class, 'handle_workspace_deletion']);
