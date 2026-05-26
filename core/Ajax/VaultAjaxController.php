<?php
/**
 * SystemDeck - VaultAjaxController
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Ajax/VaultAjaxController.php
 * @license GPL-2.0-or-later
 *
 * AJAX Controller for Vault operations
 */
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Widgets\Vault;

if (!defined('ABSPATH')) {
    exit;
}

final class VaultAjaxController
{
    public static function handle_ajax_upload_file(): void { Vault::handle_ajax_upload_file(); }
    public static function handle_ajax_link_attachment(): void { Vault::handle_ajax_link_attachment(); }
    public static function handle_ajax_get_files(): void { Vault::handle_ajax_get_files(); }
    public static function handle_ajax_delete_file(): void { Vault::handle_ajax_delete_file(); }
    public static function handle_ajax_import_from_media_library(): void { Vault::handle_ajax_import_from_media_library(); }
    public static function handle_ajax_export_to_media_library(): void { Vault::handle_ajax_export_to_media_library(); }
    public static function handle_ajax_make_private(): void { Vault::handle_ajax_make_private(); }
    public static function handle_ajax_get_file_details(): void { Vault::handle_ajax_get_file_details(); }
    public static function handle_ajax_save_file_details(): void { Vault::handle_ajax_save_file_details(); }
    public static function handle_ajax_get_midi_editor_payload(): void { Vault::handle_ajax_get_midi_editor_payload(); }
    public static function handle_ajax_validate_midi_derivative(): void { Vault::handle_ajax_validate_midi_derivative(); }
    public static function handle_ajax_save_midi_derivative(): void { Vault::handle_ajax_save_midi_derivative(); }
    public static function handle_ajax_rebuild_midi_derivative(): void { Vault::handle_ajax_rebuild_midi_derivative(); }
    public static function handle_ajax_get_file_comments(): void { Vault::handle_ajax_get_file_comments(); }
    public static function handle_ajax_add_file_comment(): void { Vault::handle_ajax_add_file_comment(); }
    public static function handle_ajax_attach_existing_vault_file(): void { Vault::handle_ajax_attach_existing_vault_file(); }
    public static function handle_ajax_toggle_vault_sticky(): void { Vault::handle_ajax_toggle_vault_sticky(); }

    // Phase 2F Authority Actions
    public static function handle_ajax_copy_from_media_library(): void { Vault::handle_ajax_copy_from_media_library(); }
    public static function handle_ajax_publish_to_vault(): void { Vault::handle_ajax_publish_to_vault(); }
    public static function handle_ajax_copy_to_media_library(): void { Vault::handle_ajax_copy_to_media_library(); }
    public static function handle_ajax_publish_to_media_library(): void { Vault::handle_ajax_publish_to_media_library(); }
    public static function handle_ajax_pin_to_workspace(): void { Vault::handle_ajax_pin_to_workspace(); }
    public static function handle_ajax_unpin_from_workspace(): void { Vault::handle_ajax_unpin_from_workspace(); }
    public static function handle_ajax_get_pinned_workspaces(): void { Vault::handle_ajax_get_pinned_workspaces(); }
    public static function handle_ajax_share_to_workspace(): void { Vault::handle_ajax_share_to_workspace(); }
    public static function handle_ajax_unshare_from_workspace(): void { Vault::handle_ajax_unshare_from_workspace(); }
    public static function handle_ajax_get_share_state(): void { Vault::handle_ajax_get_share_state(); }
}
