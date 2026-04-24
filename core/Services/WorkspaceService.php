<?php
declare(strict_types=1);

namespace SystemDeck\Core\Services;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

final class WorkspaceService
{
    public static function handle_export_workspaces(): void { AjaxHandler::handle_export_workspaces(); }
    public static function handle_import_workspaces(): void { AjaxHandler::handle_import_workspaces(); }
    public static function handle_create_workspace(): void { AjaxHandler::handle_create_workspace(); }
    public static function handle_delete_workspace(): void { AjaxHandler::handle_delete_workspace(); }
    public static function handle_rename_workspace(): void { AjaxHandler::handle_rename_workspace(); }
    public static function handle_reorder_workspaces(): void { AjaxHandler::handle_reorder_workspaces(); }
    public static function handle_publish_workspace_template(): void { AjaxHandler::handle_publish_workspace_template(); }
    public static function handle_reset_workspace_to_source(): void { AjaxHandler::handle_reset_workspace_to_source(); }
    public static function handle_check_workspace_update(): void { AjaxHandler::handle_check_workspace_update(); }
    public static function handle_set_workspace_access_role(): void { AjaxHandler::handle_set_workspace_access_role(); }
    public static function handle_set_workspace_visibility(): void { AjaxHandler::handle_set_workspace_visibility(); }
    public static function handle_set_workspace_collaboration_mode(): void { AjaxHandler::handle_set_workspace_collaboration_mode(); }
    public static function handle_set_workspace_audience(): void { AjaxHandler::handle_set_workspace_audience(); }
    public static function handle_get_workspace_audience_candidates(): void { AjaxHandler::handle_get_workspace_audience_candidates(); }
    public static function handle_set_workspace_app_menu(): void { AjaxHandler::handle_set_workspace_app_menu(); }
    public static function handle_get_workspace_editor_url(): void { AjaxHandler::handle_get_workspace_editor_url(); }
}

