<?php
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Core\Services\WorkspaceService;
use SystemDeck\Core\Services\WorkspaceStateService;

if (!defined('ABSPATH')) {
    exit;
}

final class WorkspaceAjaxController
{
    public static function handle_export_workspaces(): void { WorkspaceService::handle_export_workspaces(); }
    public static function handle_import_workspaces(): void { WorkspaceService::handle_import_workspaces(); }
    public static function handle_create_workspace(): void { WorkspaceService::handle_create_workspace(); }
    public static function handle_delete_workspace(): void { WorkspaceService::handle_delete_workspace(); }
    public static function handle_rename_workspace(): void { WorkspaceService::handle_rename_workspace(); }
    public static function handle_reorder_workspaces(): void { WorkspaceService::handle_reorder_workspaces(); }
    public static function handle_publish_workspace_template(): void { WorkspaceService::handle_publish_workspace_template(); }
    public static function handle_reset_workspace_to_source(): void { WorkspaceService::handle_reset_workspace_to_source(); }
    public static function handle_check_workspace_update(): void { WorkspaceService::handle_check_workspace_update(); }
    public static function handle_set_workspace_access_role(): void { WorkspaceService::handle_set_workspace_access_role(); }
    public static function handle_set_workspace_visibility(): void { WorkspaceService::handle_set_workspace_visibility(); }
    public static function handle_set_workspace_collaboration_mode(): void { WorkspaceService::handle_set_workspace_collaboration_mode(); }
    public static function handle_set_workspace_audience(): void { WorkspaceService::handle_set_workspace_audience(); }
    public static function handle_get_workspace_audience_candidates(): void { WorkspaceService::handle_get_workspace_audience_candidates(); }
    public static function handle_set_workspace_app_menu(): void { WorkspaceService::handle_set_workspace_app_menu(); }
    public static function handle_get_workspace_editor_url(): void { WorkspaceService::handle_get_workspace_editor_url(); }

    public static function handle_save_layout(): void { WorkspaceStateService::handle_save_layout(); }
    public static function handle_persist_workspace_state(): void { WorkspaceStateService::handle_persist_workspace_state(); }
    public static function handle_get_workspace_pins(): void { WorkspaceStateService::handle_get_workspace_pins(); }
    public static function handle_save_workspace_pins(): void { WorkspaceStateService::handle_save_workspace_pins(); }
    public static function handle_toggle_workspace_widget_block(): void { WorkspaceStateService::handle_toggle_workspace_widget_block(); }
    public static function handle_set_widget_block_width(): void { WorkspaceStateService::handle_set_widget_block_width(); }
    public static function handle_set_widget_ui_state(): void { WorkspaceStateService::handle_set_widget_ui_state(); }
    public static function handle_sync_layout_to_editor(): void { WorkspaceStateService::handle_sync_layout_to_editor(); }
}
