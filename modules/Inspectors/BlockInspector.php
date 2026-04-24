<?php
/**
 * SystemDeck Block Inspector Module
 * Backend logic for the Inspector Tool.
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
