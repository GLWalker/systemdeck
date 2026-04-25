<?php
declare(strict_types=1);

namespace SystemDeck\Core\Services;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

final class WorkspaceStateService
{
    public static function handle_save_layout(): void { AjaxHandler::handle_save_layout(); }
    public static function handle_persist_workspace_state(): void { WidgetStateService::handle_persist_workspace_state(); }
    public static function handle_get_workspace_pins(): void { AjaxHandler::handle_get_workspace_pins(); }
    public static function handle_save_workspace_pins(): void { AjaxHandler::handle_save_workspace_pins(); }
    public static function handle_toggle_workspace_widget_block(): void { WidgetStateService::handle_toggle_workspace_widget_block(); }
    public static function handle_sync_workspace_widget_list(): void { WidgetStateService::handle_sync_workspace_widget_list(); }
    public static function handle_set_widget_block_width(): void { WidgetStateService::handle_set_widget_block_width(); }
    public static function handle_set_widget_ui_state(): void { WidgetStateService::handle_set_widget_ui_state(); }
    public static function handle_sync_layout_to_editor(): void { AjaxHandler::handle_sync_layout_to_editor(); }
}
