<?php
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

final class SystemAjaxController
{
    public static function handle_ping_latency(): void { AjaxHandler::handle_ping_latency(); }
    public static function handle_clear_cache(): void { AjaxHandler::handle_clear_cache(); }
    public static function handle_sweep_orphans(): void { AjaxHandler::handle_sweep_orphans(); }
    public static function handle_purge_widgets(): void { AjaxHandler::handle_purge_widgets(); }
    public static function handle_get_telemetry(): void { AjaxHandler::handle_get_telemetry(); }
    public static function handle_render_pin(): void { AjaxHandler::handle_render_pin(); }
    public static function handle_get_pin_safe_metrics(): void { AjaxHandler::handle_get_pin_safe_metrics(); }
    public static function handle_create_registry_pin(): void { AjaxHandler::handle_create_registry_pin(); }
    public static function handle_create_metric_pin(): void { AjaxHandler::handle_create_metric_pin(); }
    public static function handle_get_harvest(): void { AjaxHandler::handle_get_harvest(); }
    public static function handle_save_widget_selection(): void { AjaxHandler::handle_save_widget_selection(); }
    public static function handle_save_registry_state(): void { AjaxHandler::handle_save_registry_state(); }
    public static function handle_get_access_policy(): void { AjaxHandler::handle_get_access_policy(); }
    public static function handle_save_access_policy(): void { AjaxHandler::handle_save_access_policy(); }
    public static function handle_rebuild_registry_snapshot(): void { AjaxHandler::handle_rebuild_registry_snapshot(); }
    public static function handle_get_discovered_widgets(): void { AjaxHandler::handle_get_discovered_widgets(); }
    public static function handle_reset_systemdeck(): void { AjaxHandler::handle_reset_systemdeck(); }
    public static function handle_save_user_preferences(): void { AjaxHandler::handle_save_user_preferences(); }
}
