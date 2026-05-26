<?php
/**
 * WP-CLI command: explicit registry snapshot build.
 */

declare(strict_types=1);

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

if (!class_exists('\\SystemDeck\\Core\\Services\\RegistryService')) {
    return;
}

\WP_CLI::add_command('systemdeck registry:build', function () {
    $snapshot = \SystemDeck\Core\Services\RegistryService::build_snapshot();
    $count = count($snapshot['widgets'] ?? []);
    \WP_CLI::success("SystemDeck registry snapshot built ({$count} widgets).");
});
