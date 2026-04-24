<?php
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

final class WidgetAjaxController
{
    public static function handle_save_widget_data(): void { AjaxHandler::handle_save_widget_data(); }
    public static function handle_get_widget_data(): void { AjaxHandler::handle_get_widget_data(); }
    public static function handle_render_widget(): void { AjaxHandler::handle_render_widget(); }
    public static function handle_resolve_widget(): void { AjaxHandler::handle_resolve_widget(); }
}

