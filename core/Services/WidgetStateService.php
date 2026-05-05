<?php
/**
 * SystemDeck - WidgetStateService
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Services/WidgetStateService.php
 * @license GPL-2.0-or-later
 *
 * Widget State Persistence (Database Sync)
 */
declare(strict_types=1);

namespace SystemDeck\Core\Services;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Widget-scoped workspace mutation facade.
 *
 * This keeps widget state entry points grouped while preserving existing
 * AjaxHandler behavior contracts.
 */
final class WidgetStateService
{
    public static function handle_persist_workspace_state(): void
    {
        AjaxHandler::handle_persist_workspace_state();
    }

    public static function handle_toggle_workspace_widget_block(): void
    {
        AjaxHandler::handle_toggle_workspace_widget_block();
    }

    public static function handle_sync_workspace_widget_list(): void
    {
        AjaxHandler::handle_sync_workspace_widget_list();
    }

    public static function handle_set_widget_block_width(): void
    {
        AjaxHandler::handle_set_widget_block_width();
    }

    public static function handle_set_widget_ui_state(): void
    {
        AjaxHandler::handle_set_widget_ui_state();
    }
}

