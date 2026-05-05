<?php
/**
 * SystemDeck - NotesAjaxController
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Ajax/NotesAjaxController.php
 * @license GPL-2.0-or-later
 *
 * AJAX Controller for Notes operations
 */
declare(strict_types=1);

namespace SystemDeck\Core\Ajax;

use SystemDeck\Core\AjaxHandler;

if (!defined('ABSPATH')) {
    exit;
}

final class NotesAjaxController
{
    public static function handle_get_notes(): void { AjaxHandler::handle_get_notes(); }
    public static function handle_get_all_notes(): void { AjaxHandler::handle_get_all_notes(); }
    public static function handle_get_read_note(): void { AjaxHandler::handle_get_read_note(); }
    public static function handle_save_note(): void { AjaxHandler::handle_save_note(); }
    public static function handle_delete_note(): void { AjaxHandler::handle_delete_note(); }
    public static function handle_pin_note(): void { AjaxHandler::handle_pin_note(); }
    public static function handle_get_note_comments(): void { AjaxHandler::handle_get_note_comments(); }
    public static function handle_add_note_comment(): void { AjaxHandler::handle_add_note_comment(); }
    public static function handle_toggle_note_sticky(): void { AjaxHandler::handle_toggle_note_sticky(); }
}

