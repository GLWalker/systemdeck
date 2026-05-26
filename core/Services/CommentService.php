<?php

/**
 * SystemDeck - CommentService
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Services/CommentService.php
 * @license GPL-2.0-or-later
 *
 * Comment Management Service (Security & Rendering)
 */

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class CommentService
{
    /**
     * Build a shallow-threaded comment tree for a given post.
     *
     * Shallow-threaded means: top-level comments contain direct replies,
     * but replies-to-replies are flattened into the nearest top-level parent.
     *
     * @param int $post_id WordPress post ID.
     * @return array Indexed array of top-level comments, each with a 'replies' array.
     */
    public static function get_comment_tree(int $post_id): array
    {
        $comments = get_comments([
            'post_id' => $post_id,
            'status'  => 'approve',
            'order'   => 'ASC',
            'orderby' => 'comment_date_gmt',
        ]);

        $comment_tree = [];
        $replies      = [];

        foreach ($comments as $comment) {
            $formatted = [
                'id'        => $comment->comment_ID,
                'author'    => $comment->comment_author,
                'content'   => wpautop(wp_kses_post($comment->comment_content)),
                'date'      => human_time_diff(strtotime($comment->comment_date), current_time('timestamp')) . ' ' . __('ago', 'systemdeck'),
                'avatar'    => get_avatar_url($comment->user_id, ['size' => 44]),
                'parent_id' => (int) $comment->comment_parent,
                'replies'   => [],
            ];

            if ($comment->comment_parent == 0) {
                $comment_tree[$comment->comment_ID] = $formatted;
            } else {
                $replies[] = $formatted;
            }
        }

        // Shallow depth: any replies to replies attach to the nearest top-level parent.
        foreach ($replies as $reply) {
            $parent_id = $reply['parent_id'];
            if (isset($comment_tree[$parent_id])) {
                $comment_tree[$parent_id]['replies'][] = $reply;
            } else {
                // If the direct parent isn't at top level, find top level parent or append to end.
                $found = false;
                foreach ($comment_tree as &$top_comment) {
                    foreach ($top_comment['replies'] as $existing_reply) {
                        if ($existing_reply['id'] == $parent_id) {
                            $top_comment['replies'][] = $reply;
                            $found = true;
                            break 2;
                        }
                    }
                }
                if (!$found) {
                    $comment_tree[$reply['id']] = $reply;
                }
            }
        }

        return array_values($comment_tree);
    }

    /**
     * Render nested comment thread HTML from a comment tree payload.
     *
     * @param array $comments Tree from get_comment_tree().
     * @return string
     */
    public static function render_comment_tree_html(array $comments): string
    {
        if (empty($comments)) {
            return '<p class="description sd-comments-empty">' . esc_html__('No comments yet.', 'systemdeck') . '</p>';
        }

        $html = '<ol class="comment-list sd-thread-list">';
        foreach ($comments as $comment) {
            if (!is_array($comment)) {
                continue;
            }
            $html .= self::render_comment_node_html($comment, false);
        }
        $html .= '</ol>';
        return $html;
    }

    /**
     * Count all nodes in a threaded comment array.
     *
     * @param array $comments
     * @return int
     */
    public static function count_comment_nodes(array $comments): int
    {
        $count = 0;
        foreach ($comments as $comment) {
            if (!is_array($comment)) {
                continue;
            }
            $count++;
            $replies = isset($comment['replies']) && is_array($comment['replies']) ? $comment['replies'] : [];
            if (!empty($replies)) {
                $count += self::count_comment_nodes($replies);
            }
        }
        return $count;
    }

    /**
     * Insert a comment with access verification.
     *
     * Uses ObjectAccessGate to verify the user can comment on the target post
     * before inserting. This makes it impossible to write a comment endpoint
     * that forgets the access check.
     *
     * @param int    $post_id    Target post ID.
     * @param string $content    Comment content (will be sanitized).
     * @param int    $user_id    Commenting user ID.
     * @param int    $parent_id  Parent comment ID (0 for top-level).
     * @param string $post_type  Expected CPT slug for access check.
     * @param string $scope_key  Meta key storing scope value.
     * @param string $ws_key     Meta key storing workspace_id.
     * @param string $shared_val Scope value indicating projection (e.g. 'pinned', 'shared').
     * @return int Inserted comment ID.
     * @throws \Exception On access denied, missing fields, or insert failure.
     */
    public static function add_comment(
        int $post_id,
        string $content,
        int $user_id,
        int $parent_id,
        string $post_type,
        string $scope_key,
        string $ws_key,
        string $shared_val
    ): int {
        if (!$post_id || !$content || !$user_id) {
            throw new \Exception(__('Missing required fields', 'systemdeck'));
        }

        // Access gate — throws on denial.
        $access = ObjectAccessGate::resolve($post_id, $post_type, $user_id, $scope_key, $ws_key, $shared_val);
        if (!$access['can_comment']) {
            throw new \Exception(__('You do not have permission to comment on this item.', 'systemdeck'));
        }

        $comment_id = wp_insert_comment([
            'comment_post_ID' => $post_id,
            'comment_content' => sanitize_textarea_field($content),
            'user_id'         => $user_id,
            'comment_author'  => wp_get_current_user()->display_name,
            'comment_approved' => 1,
            'comment_parent'  => $parent_id,
        ]);

        if (!$comment_id) {
            throw new \Exception(__('Failed to add comment', 'systemdeck'));
        }

        return (int) $comment_id;
    }

    private static function render_comment_node_html(array $comment, bool $is_reply): string
    {
        $wrapper_class = $is_reply
            ? 'sd-thread-item sd-thread-comment sd-thread-reply'
            : 'sd-thread-item sd-thread-comment';

        $avatar = esc_url((string) ($comment['avatar'] ?? ''));
        $author = esc_html((string) ($comment['author'] ?? 'User'));
        $date = esc_html((string) ($comment['date'] ?? ''));
        $content = wp_kses_post((string) ($comment['content'] ?? ''));
        $comment_id = (int) ($comment['id'] ?? 0);
        $reply_btn = $comment_id <= 0
            ? ''
            : '<button class="button-link button-small sd-reply-btn" data-id="' . esc_attr((string) $comment_id) . '">' . esc_html__('Reply', 'systemdeck') . '</button>';

        $html = '<li class="' . esc_attr($wrapper_class) . '" data-comment-id="' . esc_attr((string) $comment_id) . '">';
        $html .= '<div class="sd-thread-row">';
        $html .= '<img class="sd-thread-avatar avatar" src="' . $avatar . '" alt="' . $author . '" width="44" height="44">';
        $html .= '<div class="sd-thread-main">';
        $html .= '<div class="sd-thread-head comment-meta">';
        $html .= '<span class="sd-thread-author">' . $author . '</span>';
        $html .= '<span class="sd-thread-time sd-note-comment-date">' . $date . '</span>';
        $html .= '</div>';
        $html .= '<div class="sd-thread-body sd-thread-content comment-content">' . $content . '</div>';
        if ($reply_btn !== '') {
            $html .= '<div class="sd-thread-actions">' . $reply_btn . '</div>';
        }
        $html .= '</div>';
        $html .= '</div>';

        $replies = isset($comment['replies']) && is_array($comment['replies']) ? $comment['replies'] : [];
        if (!empty($replies)) {
            $html .= '<ol class="sd-thread-children sd-thread-replies">';
            foreach ($replies as $reply) {
                if (!is_array($reply)) {
                    continue;
                }
                $html .= self::render_comment_node_html($reply, true);
            }
            $html .= '</ol>';
        }

        $html .= '</li>';
        return $html;
    }
}
