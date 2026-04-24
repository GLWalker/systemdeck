<?php
/**
 * ObjectAccessGate — Centralized single-object authorization for SystemDeck widgets.
 *
 * Extracted from Notes::resolve_sticky_access() and Vault's inline access checks
 * which implemented the same three-step pattern:
 *   1. Is the user the post_author? → full access
 *   2. Is the scope "shared/pinned" AND does the user meet workspace access? → view+comment
 *   3. Otherwise → denied
 *
 * @package SystemDeck\Core\Services
 */

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class ObjectAccessGate
{
    /**
     * Resolve access for a single CPT object by ID.
     *
     * Authors get full access (view, edit, comment).
     * Non-authors get view+comment only if the object's scope matches $shared_val
     * AND the user meets workspace access on the object's workspace.
     * Private-scoped objects are author-only.
     *
     * @param int    $object_id   Post ID.
     * @param string $post_type   Expected CPT slug.
     * @param int    $user_id     Requesting user ID.
     * @param string $scope_key   Meta key storing scope (e.g. '_sd_note_scope', '_sd_vault_scope').
     * @param string $ws_key      Meta key storing workspace_id (e.g. '_sd_note_workspace_id').
     * @param string $shared_val  Scope value indicating projection (e.g. 'pinned' for Notes, 'shared' for Vault).
     * @return array{can_view: bool, can_edit: bool, can_comment: bool, is_author: bool, scope: string, workspace_id: string, post: \WP_Post}
     * @throws \Exception If the object is not found or access is denied.
     */
    public static function resolve(
        int $object_id,
        string $post_type,
        int $user_id,
        string $scope_key,
        string $ws_key,
        string $shared_val
    ): array {
        $post = get_post($object_id);
        if (!$post || $post->post_type !== $post_type) {
            throw new \Exception(__('Object not found', 'systemdeck'));
        }

        $scope        = (string) get_post_meta($object_id, $scope_key, true);
        $author_id    = (int) $post->post_author;
        $workspace_id = (string) get_post_meta($object_id, $ws_key, true);
        $is_author    = ($author_id === $user_id);

        $can_view    = false;
        $can_edit    = false;
        $can_comment = false;

        if ($is_author) {
            $can_view    = true;
            $can_edit    = true;
            $can_comment = true;
        } elseif ($scope === $shared_val) {
            // Non-author access only on projected objects, gated by workspace membership.
            if (function_exists('systemdeck_user_meets_workspace_access')
                && systemdeck_user_meets_workspace_access($user_id, $workspace_id)
            ) {
                $can_view    = true;
                $can_comment = true;
            }
        }

        if (!$can_view) {
            throw new \Exception(__('Access denied', 'systemdeck'));
        }

        return [
            'can_view'     => $can_view,
            'can_edit'     => $can_edit,
            'can_comment'  => $can_comment,
            'is_author'    => $is_author,
            'scope'        => $scope,
            'workspace_id' => $workspace_id,
            'post'         => $post,
        ];
    }

    /**
     * Assert author-only access for write/delete operations.
     *
     * @param int    $object_id Post ID.
     * @param string $post_type Expected CPT slug.
     * @param int    $user_id   Requesting user ID.
     * @return \WP_Post The verified post object.
     * @throws \Exception If not found or user is not the author.
     */
    public static function require_author(int $object_id, string $post_type, int $user_id): \WP_Post
    {
        $post = get_post($object_id);
        if (!$post || $post->post_type !== $post_type) {
            throw new \Exception(__('Object not found', 'systemdeck'));
        }

        if ((int) $post->post_author !== $user_id) {
            throw new \Exception(__('Permission denied', 'systemdeck'));
        }

        return $post;
    }

    /**
     * Verify workspace write access before projection/share operations.
     *
     * @param int    $user_id      Requesting user ID.
     * @param string $workspace_id Target workspace ID.
     * @throws \Exception If user lacks workspace_edit access.
     */
    public static function require_workspace_write(int $user_id, string $workspace_id): void
    {
        if (empty($workspace_id)) {
            return; // No workspace = no check needed (personal scope).
        }

        if (function_exists('systemdeck_user_meets_workspace_access')
            && !systemdeck_user_meets_workspace_access($user_id, $workspace_id, 'workspace_edit')
        ) {
            throw new \Exception(__('You do not have access to this workspace.', 'systemdeck'));
        }
    }
}
