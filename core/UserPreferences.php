<?php
/**
 * SystemDeck User Preferences
 * Manages user-specific settings like Incognito Mode.
 *
 * @package SystemDeck
 */

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class UserPreferences
{
    /**
     * Initialize User Preferences.
     */
    public static function init(): void
    {
        // Settings are now managed exclusively in the SystemDeck Command Center (Tools tab).
        // No WordPress user profile hooks are needed anymore.
    }

    /**
     * Check if Incognito Mode is enabled for the current user.
     */
    public static function is_incognito_active(): bool
    {
        if (!is_user_logged_in()) {
            return false;
        }
        return get_user_meta(get_current_user_id(), 'sd_incognito_mode', true) === 'true';
    }

    /**
     * Get the default dock state for the current user.
     */
    public static function get_default_dock(): string
    {
        if (!is_user_logged_in()) {
            return 'standard-dock';
        }
        return get_user_meta(get_current_user_id(), 'sd_default_dock', true) ?: 'standard-dock';
    }
}
