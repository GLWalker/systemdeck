<?php
/**
 * SystemDeck - BlockInspector
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/modules/Inspectors/BlockInspector.php
 * @license GPL-2.0-or-later
 *
 * Live inspector for Gutenberg blocks and metadata
 */
declare(strict_types=1);

namespace SystemDeck\Modules\Inspectors;

if (!defined('ABSPATH')) {
    exit;
}

class BlockInspector
{
    public static function init(): void
    {
        // Currently just a placeholder for potential backend-side inspection logic.
        // Most inspection happens in JS via get_block_definitions() in RetailController.
    }
}
