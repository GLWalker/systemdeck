<?php
/**
 * SystemDeck - Autoloader
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/core/Autoloader.php
 * @license GPL-2.0-or-later
 *
 * Namespace-aware PSR-4 Autoloader
 */

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

final class Autoloader
{
    /**
     * Namespace prefix.
     */
    private string $namespace_prefix = 'SystemDeck\\';

    /**
     * Map of namespaces to base directories.
     */
    private array $namespace_map = [];

    /**
     * Register the autoloader.
     */
    public static function register(): void
    {
        $loader = new self();
        spl_autoload_register([$loader, 'autoload']);
    }

    /**
     * Constructor.
     */
    private function __construct()
    {
        $this->namespace_map['SystemDeck\\Core\\'] = SYSTEMDECK_PATH . 'core/';
        $this->namespace_map['SystemDeck\\Modules\\'] = SYSTEMDECK_PATH . 'modules/';
        $this->namespace_map['SystemDeck\\Widgets\\'] = SYSTEMDECK_PATH . 'widgets/';
    }

    /**
     * Autoload classes.
     *
     * @param string $class Fully qualified class name.
     */
    private function autoload(string $class): void
    {
        foreach ($this->namespace_map as $prefix => $base_dir) {
            $len = strlen($prefix);
            if (strncmp($prefix, $class, $len) !== 0) {
                continue;
            }

            $relative_class = substr($class, $len);
            $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

            if (file_exists($file)) {
                require_once $file;
                return;
            }
        }
    }
}
