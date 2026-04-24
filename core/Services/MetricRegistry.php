<?php
declare(strict_types=1);

namespace SystemDeck\Core\Services;

use SystemDeck\Core\Telemetry;

if (!defined('ABSPATH')) {
    exit;
}

final class MetricRegistry
{
    /**
     * @return array<int,array<string,mixed>>
     */
    public static function get_all(): array
    {
        return array_values(array_merge(
            self::build_core_metrics(),
            self::build_wordpress_metrics(),
            self::build_third_party_metrics(),
        ));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function get_by_family(string $family): array
    {
        $normalized_family = self::normalize_family($family);
        if ($normalized_family === '') {
            return [];
        }

        return array_values(array_filter(
            self::get_all(),
            static fn(array $metric): bool => (string) ($metric['family'] ?? '') === $normalized_family
        ));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function get_pin_safe(): array
    {
        return array_values(array_filter(
            self::get_all(),
            static function (array $metric): bool {
                return !empty($metric['pin_safe'])
                    && (string) ($metric['key'] ?? '') !== ''
                    && (string) ($metric['label'] ?? '') !== ''
                    && (string) ($metric['category'] ?? '') !== '';
            }
        ));
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_all_indexed(): array
    {
        $indexed = [];
        foreach (self::get_all() as $metric) {
            $key = (string) ($metric['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $indexed[$key] = $metric;
        }

        return $indexed;
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_pin_safe_indexed(): array
    {
        $indexed = [];
        foreach (self::get_pin_safe() as $metric) {
            $key = (string) ($metric['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $indexed[$key] = $metric;
        }

        return $indexed;
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function get_metric(string $key): ?array
    {
        $normalized_key = trim($key);
        if ($normalized_key === '') {
            return null;
        }

        $indexed = self::get_all_indexed();
        return $indexed[$normalized_key] ?? null;
    }

    /**
     * Bridge to PinRegistry for metric-backed pin definitions.
     *
     * MetricRegistry remains the authority for metric rows, live values, analysis,
     * and pin-safe eligibility. PinRegistry owns the pin-definition semantics and
     * the runtime pin payload assembly.
     *
     * @return array<string,mixed>|null
     */
    public static function build_pin_definition(string $key, int $author_id = 0): ?array
    {
        $metric = self::get_metric($key);
        if (!is_array($metric) || empty($metric['pin_safe'])) {
            return null;
        }

        if (!class_exists(PinRegistry::class)) {
            return null;
        }

        return PinRegistry::build_metric_pin_payload($metric, $author_id);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function build_core_metrics(): array
    {
        $definitions = [
            'timestamp' => ['key' => 'core.sample_timestamp', 'category' => 'time', 'description' => 'Current SystemDeck telemetry sample timestamp.', 'pin_safe' => false],
            'load_time_wp' => ['key' => 'core.wp_load_time', 'category' => 'performance', 'description' => 'WordPress bootstrap runtime for the current sample.', 'pin_safe' => true],
            'load_time_srv' => ['key' => 'core.server_load_time', 'category' => 'performance', 'description' => 'Server request runtime for the current sample.', 'pin_safe' => true],
            'db_queries' => ['key' => 'core.db_queries', 'category' => 'database', 'description' => 'Database queries executed in the current sample.', 'pin_safe' => true],
            'memory_usage' => ['key' => 'core.memory_usage', 'category' => 'performance', 'description' => 'Current PHP memory usage as a percentage of the configured limit.', 'pin_safe' => true],
            'server_time' => ['key' => 'core.server_time', 'category' => 'time', 'description' => 'Current server-side clock reading.', 'pin_safe' => true],
            'wp_time' => ['key' => 'core.wp_local_time', 'category' => 'time', 'description' => 'Current WordPress-local time reading.', 'pin_safe' => true],
            'uptime' => ['key' => 'core.server_uptime', 'category' => 'hardware', 'description' => 'Reported server uptime sample.', 'pin_safe' => true],
            'db_size_bytes' => ['key' => 'core.db_size', 'category' => 'database', 'description' => 'Approximate database footprint monitored by SystemDeck.', 'pin_safe' => true],
            'db_autoload_bytes' => ['key' => 'core.db_autoload_size', 'category' => 'database', 'description' => 'Autoloaded options payload size.', 'pin_safe' => true],
            'plugins_active' => ['key' => 'core.plugins_active', 'category' => 'wp-core', 'description' => 'Number of active plugins.', 'pin_safe' => true],
            'plugins_total' => ['key' => 'core.plugins_total', 'category' => 'wp-core', 'description' => 'Total installed plugin count.', 'pin_safe' => false],
            'themes_total' => ['key' => 'core.themes_total', 'category' => 'wp-core', 'description' => 'Total installed theme count.', 'pin_safe' => false],
            'wp_debug' => ['key' => 'core.wp_debug_mode', 'category' => 'security', 'description' => 'Current WordPress debug mode state.', 'pin_safe' => true],
            'php_version' => ['key' => 'core.php_runtime_version', 'category' => 'env', 'description' => 'PHP runtime version sampled by SystemDeck.', 'pin_safe' => false],
            'wp_version' => ['key' => 'core.wp_runtime_version', 'category' => 'env', 'description' => 'WordPress core version sampled by SystemDeck.', 'pin_safe' => false],
            'ip_user' => ['key' => 'core.client_ip', 'category' => 'network', 'description' => 'Current client IP sample.', 'pin_safe' => false],
            'geo_location' => ['key' => 'core.client_geo', 'category' => 'network', 'description' => 'Current client geolocation sample.', 'pin_safe' => false],
        ];

        $metrics = [];
        foreach (Telemetry::get_all_metrics() as $metric) {
            $id = (string) ($metric['id'] ?? '');
            if ($id === '' || !isset($definitions[$id])) {
                continue;
            }

            $definition = $definitions[$id];
            $metrics[] = self::build_metric([
                'key' => $definition['key'],
                'source_key' => $id,
                'label' => (string) ($metric['label'] ?? $definition['key']),
                'value' => $metric['value'] ?? null,
                'unit' => self::normalize_unit((string) ($metric['unit'] ?? '')),
                'family' => 'core',
                'authority' => 'systemdeck',
                'mode' => self::resolve_core_mode($definition['key']),
                'status' => self::normalize_status((string) ($metric['status'] ?? 'normal')),
                'trend' => self::normalize_trend((string) ($metric['trend'] ?? 'stable')),
                'timestamp' => (int) ($metric['timestamp'] ?? time()),
                'category' => (string) $definition['category'],
                'description' => (string) $definition['description'],
                'pin_safe' => (bool) $definition['pin_safe'],
            ]);
        }

        return $metrics;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function build_wordpress_metrics(): array
    {
        global $wpdb, $wp_version;

        $timestamp = time();
        $health = self::read_site_health_status();
        $plugin_updates = 0;
        $theme_updates = 0;
        $core_update_available = false;

        $plugin_update_data = get_site_transient('update_plugins');
        if (is_object($plugin_update_data) && !empty($plugin_update_data->response) && is_array($plugin_update_data->response)) {
            $plugin_updates = count($plugin_update_data->response);
        }

        $theme_update_data = get_site_transient('update_themes');
        if (is_object($theme_update_data) && !empty($theme_update_data->response) && is_array($theme_update_data->response)) {
            $theme_updates = count($theme_update_data->response);
        }

        $core_update_data = get_site_transient('update_core');
        if (is_object($core_update_data) && !empty($core_update_data->updates) && is_array($core_update_data->updates)) {
            foreach ($core_update_data->updates as $update) {
                if (is_object($update) && isset($update->response) && $update->response === 'upgrade') {
                    $core_update_available = true;
                    break;
                }
            }
        }

        $metrics = [
            self::build_metric([
                'key' => 'wp.metrics.health.status',
                'label' => 'Site Health Status',
                'value' => (string) ($health['status'] ?? 'good'),
                'unit' => 'text',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => self::normalize_wp_health_status((string) ($health['status'] ?? 'good')),
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'health',
                'description' => 'Current WordPress Site Health summary status.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.health.critical_issues',
                'label' => 'Critical Site Health Issues',
                'value' => (int) ($health['critical'] ?? 0),
                'unit' => 'count',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => ((int) ($health['critical'] ?? 0)) > 0 ? 'error' : 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'health',
                'description' => 'Critical issues reported by WordPress Site Health.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.health.recommended_issues',
                'label' => 'Recommended Site Health Issues',
                'value' => (int) ($health['recommended'] ?? 0),
                'unit' => 'count',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => ((int) ($health['recommended'] ?? 0)) > 0 ? 'warn' : 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'health',
                'description' => 'Recommended improvements reported by WordPress Site Health.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.env.php_version',
                'label' => 'PHP Version',
                'value' => (string) phpversion(),
                'unit' => 'text',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'env',
                'description' => 'PHP runtime version reported by WordPress core.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.env.wp_time',
                'label' => 'WP Local Time',
                'value' => (int) current_time('timestamp'),
                'unit' => 'unix',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'env',
                'description' => 'Current WordPress-local time snapshot.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.env.db_version',
                'label' => 'Database Version',
                'value' => is_object($wpdb) ? (string) $wpdb->db_version() : 'unknown',
                'unit' => 'text',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'env',
                'description' => 'Database engine version reported by WordPress.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.env.wp_version',
                'label' => 'WordPress Version',
                'value' => (string) $wp_version,
                'unit' => 'text',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'env',
                'description' => 'WordPress core version reported by the application.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.updates.plugin_updates',
                'label' => 'Plugin Updates',
                'value' => $plugin_updates,
                'unit' => 'count',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => $plugin_updates > 0 ? 'warn' : 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'updates',
                'description' => 'Plugin updates currently available through WordPress core.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.updates.theme_updates',
                'label' => 'Theme Updates',
                'value' => $theme_updates,
                'unit' => 'count',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => $theme_updates > 0 ? 'warn' : 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'updates',
                'description' => 'Theme updates currently available through WordPress core.',
                'pin_safe' => true,
            ]),
            self::build_metric([
                'key' => 'wp.metrics.updates.core_update_available',
                'label' => 'Core Update Available',
                'value' => $core_update_available,
                'unit' => 'boolean',
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => $core_update_available ? 'warn' : 'ok',
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => 'updates',
                'description' => 'Whether WordPress core currently reports an available update.',
                'pin_safe' => true,
            ]),
        ];

        return array_merge($metrics, self::build_wordpress_debug_metrics($timestamp));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function build_third_party_metrics(): array
    {
        return [];
    }

    /**
     * Expand pin-safe WordPress metrics from the Site Health Info inventory.
     *
     * This intentionally selects only scalar, non-sensitive values that map
     * cleanly into the metric taxonomy. Raw debug blobs and private fields stay
     * out of the metric registry.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function build_wordpress_debug_metrics(int $timestamp): array
    {
        $debug = self::get_wordpress_debug_data();
        if ($debug === []) {
            return [];
        }

        $definitions = [
            [
                'section' => 'wp-core',
                'field' => 'site_language',
                'key' => 'wp.metrics.core.site_language',
                'label' => 'Site Language',
                'unit' => 'text',
                'category' => 'core',
                'description' => 'Primary site language reported by WordPress.',
            ],
            [
                'section' => 'wp-core',
                'field' => 'timezone',
                'key' => 'wp.metrics.core.timezone',
                'label' => 'Timezone',
                'unit' => 'text',
                'category' => 'core',
                'description' => 'Timezone configured in WordPress settings.',
            ],
            [
                'section' => 'wp-core',
                'field' => 'https_status',
                'key' => 'wp.metrics.core.https_enabled',
                'label' => 'HTTPS Enabled',
                'unit' => 'boolean',
                'category' => 'security',
                'description' => 'Whether the site is currently using HTTPS.',
                'status_from_bool' => static fn(bool $value): string => $value ? 'ok' : 'warn',
            ],
            [
                'section' => 'wp-core',
                'field' => 'multisite',
                'key' => 'wp.metrics.core.multisite',
                'label' => 'Multisite Enabled',
                'unit' => 'boolean',
                'category' => 'core',
                'description' => 'Whether this WordPress installation is multisite.',
            ],
            [
                'section' => 'wp-core',
                'field' => 'user_registration',
                'key' => 'wp.metrics.core.user_registration',
                'label' => 'User Registration Open',
                'unit' => 'boolean',
                'category' => 'core',
                'description' => 'Whether anyone can register on this site.',
            ],
            [
                'section' => 'wp-core',
                'field' => 'blog_public',
                'key' => 'wp.metrics.core.search_engine_visibility',
                'label' => 'Search Engine Visibility',
                'unit' => 'boolean',
                'category' => 'core',
                'description' => 'Whether WordPress is allowing search engine indexing.',
                'transform' => static fn($value): bool => !self::coerce_debug_bool($value),
                'status_from_bool' => static fn(bool $value): string => $value ? 'ok' : 'warn',
            ],
            [
                'section' => 'wp-core',
                'field' => 'environment_type',
                'key' => 'wp.metrics.core.environment_type',
                'label' => 'Environment Type',
                'unit' => 'text',
                'category' => 'env',
                'description' => 'WordPress environment type configuration.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'server_architecture',
                'key' => 'wp.metrics.server.architecture',
                'label' => 'Server Architecture',
                'unit' => 'text',
                'category' => 'env',
                'description' => 'Server architecture reported by Site Health.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'httpd_software',
                'key' => 'wp.metrics.server.web_server',
                'label' => 'Web Server',
                'unit' => 'text',
                'category' => 'env',
                'description' => 'Web server software reported by the current request.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'php_sapi',
                'key' => 'wp.metrics.server.php_sapi',
                'label' => 'PHP SAPI',
                'unit' => 'text',
                'category' => 'env',
                'description' => 'PHP server API reported by Site Health.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'max_input_variables',
                'key' => 'wp.metrics.server.max_input_vars',
                'label' => 'PHP Max Input Vars',
                'unit' => 'count',
                'category' => 'env',
                'description' => 'PHP max_input_vars setting.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'memory_limit',
                'key' => 'wp.metrics.server.php_memory_limit',
                'label' => 'PHP Memory Limit',
                'unit' => 'bytes',
                'category' => 'env',
                'description' => 'PHP memory limit reported to Site Health.',
                'transform' => static fn($value): int => self::parse_size_to_bytes((string) $value),
            ],
            [
                'section' => 'wp-server',
                'field' => 'upload_max_filesize',
                'key' => 'wp.metrics.media.upload_max_filesize',
                'label' => 'Upload Max Filesize',
                'unit' => 'bytes',
                'category' => 'media',
                'description' => 'Maximum upload filesize accepted by PHP.',
                'transform' => static fn($value): int => self::parse_size_to_bytes((string) $value),
            ],
            [
                'section' => 'wp-server',
                'field' => 'imagick_availability',
                'key' => 'wp.metrics.media.imagick_available',
                'label' => 'Imagick Available',
                'unit' => 'boolean',
                'category' => 'media',
                'description' => 'Whether the Imagick library is available.',
            ],
            [
                'section' => 'wp-server',
                'field' => 'pretty_permalinks',
                'key' => 'wp.metrics.core.pretty_permalinks',
                'label' => 'Pretty Permalinks',
                'unit' => 'boolean',
                'category' => 'core',
                'description' => 'Whether pretty permalinks are supported.',
            ],
            [
                'section' => 'wp-constants',
                'field' => 'WP_MEMORY_LIMIT',
                'key' => 'wp.metrics.constants.wp_memory_limit',
                'label' => 'WP Memory Limit',
                'unit' => 'bytes',
                'category' => 'env',
                'description' => 'WordPress frontend memory limit constant.',
                'transform' => static fn($value): int => self::parse_size_to_bytes((string) $value),
            ],
            [
                'section' => 'wp-constants',
                'field' => 'WP_MAX_MEMORY_LIMIT',
                'key' => 'wp.metrics.constants.wp_max_memory_limit',
                'label' => 'WP Max Memory Limit',
                'unit' => 'bytes',
                'category' => 'env',
                'description' => 'WordPress admin memory limit constant.',
                'transform' => static fn($value): int => self::parse_size_to_bytes((string) $value),
            ],
            [
                'section' => 'wp-constants',
                'field' => 'WP_CACHE',
                'key' => 'wp.metrics.constants.wp_cache',
                'label' => 'WP Cache Enabled',
                'unit' => 'boolean',
                'category' => 'performance',
                'description' => 'Whether WP_CACHE is enabled.',
            ],
            [
                'section' => 'wp-constants',
                'field' => 'SCRIPT_DEBUG',
                'key' => 'wp.metrics.constants.script_debug',
                'label' => 'Script Debug',
                'unit' => 'boolean',
                'category' => 'env',
                'description' => 'Whether SCRIPT_DEBUG is enabled.',
                'status_from_bool' => static fn(bool $value): string => $value ? 'warn' : 'ok',
            ],
            [
                'section' => 'wp-constants',
                'field' => 'WP_ENVIRONMENT_TYPE',
                'key' => 'wp.metrics.constants.environment_type',
                'label' => 'WP Environment Constant',
                'unit' => 'text',
                'category' => 'env',
                'description' => 'WP_ENVIRONMENT_TYPE constant value.',
            ],
            [
                'section' => 'wp-database',
                'field' => 'extension',
                'key' => 'wp.metrics.database.extension',
                'label' => 'Database Extension',
                'unit' => 'text',
                'category' => 'database',
                'description' => 'Database extension used by WordPress.',
            ],
            [
                'section' => 'wp-database',
                'field' => 'server_version',
                'key' => 'wp.metrics.database.server_version',
                'label' => 'Database Server Version',
                'unit' => 'text',
                'category' => 'database',
                'description' => 'Database server version reported by Site Health.',
            ],
            [
                'section' => 'wp-database',
                'field' => 'client_version',
                'key' => 'wp.metrics.database.client_version',
                'label' => 'Database Client Version',
                'unit' => 'text',
                'category' => 'database',
                'description' => 'Database client version reported by Site Health.',
            ],
            [
                'section' => 'wp-database',
                'field' => 'max_allowed_packet',
                'key' => 'wp.metrics.database.max_allowed_packet',
                'label' => 'Max Allowed Packet',
                'unit' => 'bytes',
                'category' => 'database',
                'description' => 'MySQL max_allowed_packet value.',
                'transform' => static fn($value): int => self::parse_size_to_bytes((string) $value),
            ],
            [
                'section' => 'wp-active-theme',
                'field' => 'name',
                'key' => 'wp.metrics.theme.active_name',
                'label' => 'Active Theme',
                'unit' => 'text',
                'category' => 'theme',
                'description' => 'Currently active WordPress theme.',
            ],
        ];

        $metrics = [];
        foreach ($definitions as $definition) {
            $raw_value = self::get_wordpress_debug_field($debug, (string) $definition['section'], (string) $definition['field']);
            if ($raw_value === null || $raw_value === '') {
                continue;
            }

            $unit = (string) ($definition['unit'] ?? 'text');
            $value = isset($definition['transform']) && is_callable($definition['transform'])
                ? $definition['transform']($raw_value)
                : self::normalize_debug_value($raw_value, $unit);

            if ($value === null || $value === '') {
                continue;
            }

            $status = 'ok';
            if ($unit === 'boolean') {
                $bool_value = (bool) $value;
                $status = isset($definition['status_from_bool']) && is_callable($definition['status_from_bool'])
                    ? (string) $definition['status_from_bool']($bool_value)
                    : 'ok';
            }

            $metrics[] = self::build_metric([
                'key' => (string) $definition['key'],
                'label' => (string) $definition['label'],
                'value' => $value,
                'unit' => $unit,
                'family' => 'wp.metrics',
                'authority' => 'wordpress',
                'mode' => 'snapshot',
                'status' => $status,
                'trend' => 'stable',
                'timestamp' => $timestamp,
                'category' => (string) ($definition['category'] ?? 'general'),
                'description' => (string) ($definition['description'] ?? ''),
                'pin_safe' => true,
            ]);
        }

        return $metrics;
    }

    /**
     * @param array<string,mixed> $metric
     * @return array<string,mixed>
     */
    private static function build_metric(array $metric): array
    {
        $normalized = [
            'key' => (string) ($metric['key'] ?? ''),
            'label' => (string) ($metric['label'] ?? ''),
            'source_key' => sanitize_key((string) ($metric['source_key'] ?? '')),
            'value' => $metric['value'] ?? null,
            'unit' => (string) ($metric['unit'] ?? 'text'),
            'family' => self::normalize_family((string) ($metric['family'] ?? '')),
            'authority' => self::normalize_authority((string) ($metric['authority'] ?? 'systemdeck')),
            'mode' => self::normalize_mode((string) ($metric['mode'] ?? 'snapshot')),
            'status' => self::normalize_status((string) ($metric['status'] ?? 'ok')),
            'trend' => self::normalize_trend((string) ($metric['trend'] ?? 'stable')),
            'timestamp' => (int) ($metric['timestamp'] ?? time()),
            'category' => sanitize_key((string) ($metric['category'] ?? 'general')) ?: 'general',
            'description' => sanitize_text_field((string) ($metric['description'] ?? '')),
            'pin_safe' => (bool) ($metric['pin_safe'] ?? false),
        ];

        $normalized['display_value'] = self::format_display_value($normalized);
        $normalized['icon'] = self::icon_for_metric($normalized);
        $normalized['analysis'] = self::build_analysis($normalized);

        return $normalized;
    }

    /**
     * @return array<string,mixed>
     */
    private static function read_site_health_status(): array
    {
        $raw = get_transient('health-check-site-status-result');
        if (!is_string($raw) || $raw === '') {
            return [
                'status' => 'good',
                'critical' => 0,
                'recommended' => 0,
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'status' => 'good',
                'critical' => 0,
                'recommended' => 0,
            ];
        }

        return [
            'status' => sanitize_key((string) ($decoded['status'] ?? 'good')) ?: 'good',
            'critical' => (int) ($decoded['critical'] ?? 0),
            'recommended' => (int) ($decoded['recommended'] ?? 0),
        ];
    }

    private static function resolve_core_mode(string $key): string
    {
        return str_starts_with($key, 'core.') ? 'live' : 'snapshot';
    }

    private static function normalize_unit(string $unit): string
    {
        $normalized = strtolower(trim($unit));
        return match ($normalized) {
            's' => 'seconds',
            'unix' => 'unix',
            'count' => 'count',
            '%', 'percent' => 'percent',
            'boolean' => 'boolean',
            'bytes' => 'bytes',
            'text' => 'text',
            default => $normalized !== '' ? $normalized : 'text',
        };
    }

    private static function normalize_family(string $family): string
    {
        $normalized = strtolower(trim($family));
        return match ($normalized) {
            'core' => 'core',
            'wp.metrics', 'wp' => 'wp.metrics',
            'third_party', 'third-party' => 'third_party',
            default => '',
        };
    }

    private static function normalize_authority(string $authority): string
    {
        $normalized = strtolower(trim($authority));
        return match ($normalized) {
            'systemdeck', 'wordpress', 'third_party', 'derived' => $normalized,
            'external' => 'third_party',
            default => 'systemdeck',
        };
    }

    private static function normalize_mode(string $mode): string
    {
        $normalized = strtolower(trim($mode));
        return in_array($normalized, ['live', 'sampled', 'snapshot', 'derived'], true) ? $normalized : 'snapshot';
    }

    private static function normalize_status(string $status): string
    {
        $normalized = strtolower(trim($status));
        return match ($normalized) {
            'normal', 'ok', 'good', 'ready', 'synced' => 'ok',
            'warning', 'warn', 'recommended', 'offset' => 'warn',
            'critical', 'error', 'failed' => 'error',
            default => 'ok',
        };
    }

    private static function normalize_wp_health_status(string $status): string
    {
        return self::normalize_status($status);
    }

    private static function normalize_trend(string $trend): string
    {
        $normalized = strtolower(trim($trend));
        return in_array($normalized, ['up', 'down', 'stable'], true) ? $normalized : 'stable';
    }

    /**
     * @return array<string,mixed>
     */
    private static function get_wordpress_debug_data(): array
    {
        static $debug_data = null;
        if (is_array($debug_data)) {
            return $debug_data;
        }

        if (!class_exists('\\WP_Debug_Data')) {
            $path = ABSPATH . 'wp-admin/includes/class-wp-debug-data.php';
            if (is_readable($path)) {
                require_once $path;
            }
        }

        if (!class_exists('\\WP_Debug_Data') || !is_callable(['\\WP_Debug_Data', 'debug_data'])) {
            $debug_data = [];
            return $debug_data;
        }

        try {
            $loaded = \WP_Debug_Data::debug_data();
            $debug_data = is_array($loaded) ? $loaded : [];
        } catch (\Throwable $e) {
            $debug_data = [];
        }

        return $debug_data;
    }

    /**
     * @param array<string,mixed> $debug_data
     * @return string|int|float|bool|null
     */
    private static function get_wordpress_debug_field(array $debug_data, string $section, string $field)
    {
        $fields = $debug_data[$section]['fields'] ?? null;
        if (!is_array($fields) || !is_array($fields[$field] ?? null)) {
            return null;
        }

        $entry = $fields[$field];
        $raw = $entry['debug'] ?? $entry['value'] ?? null;
        return is_scalar($raw) ? $raw : null;
    }

    /**
     * @param string|int|float|bool $value
     * @return string|int|float|bool|null
     */
    private static function normalize_debug_value($value, string $unit)
    {
        if ($unit === 'boolean') {
            return self::coerce_debug_bool($value);
        }

        if ($unit === 'count') {
            return (int) $value;
        }

        if ($unit === 'bytes') {
            return self::parse_size_to_bytes((string) $value);
        }

        return is_scalar($value) ? (string) $value : null;
    }

    /**
     * @param string|int|float|bool $value
     */
    private static function coerce_debug_bool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value !== 0;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'enabled', 'open', 'on', 'good'], true);
    }

    private static function parse_size_to_bytes(string $raw): int
    {
        $value = trim($raw);
        if ($value === '' || $value === '0') {
            return 0;
        }

        if (ctype_digit($value)) {
            return (int) $value;
        }

        $unit = strtolower(substr($value, -1));
        $numeric = (float) $value;

        return match ($unit) {
            'g' => (int) round($numeric * 1024 * 1024 * 1024),
            'm' => (int) round($numeric * 1024 * 1024),
            'k' => (int) round($numeric * 1024),
            default => (int) round($numeric),
        };
    }

    /**
     * @param array<string,mixed> $metric
     */
    private static function format_display_value(array $metric): string
    {
        $unit = (string) ($metric['unit'] ?? 'text');
        $value = $metric['value'] ?? null;

        if ($value === null || $value === '') {
            return '';
        }

        if ($unit === 'boolean') {
            return !empty($value) ? 'Yes' : 'No';
        }

        if ($unit === 'bytes') {
            $numeric = (float) $value;
            if ($numeric >= 1073741824) {
                return number_format($numeric / 1073741824, 2) . ' GB';
            }
            if ($numeric >= 1048576) {
                return number_format($numeric / 1048576, 2) . ' MB';
            }
            if ($numeric >= 1024) {
                return number_format($numeric / 1024, 1) . ' KB';
            }

            return (string) ((int) round($numeric)) . ' B';
        }

        if ($unit === 'seconds') {
            return (string) $value . 's';
        }

        if ($unit === 'percent') {
            return (string) $value . '%';
        }

        if ($unit === 'unix') {
            $epoch = (int) $value;
            if ($epoch <= 0) {
                return '';
            }

            return function_exists('wp_date')
                ? wp_date('H:i:s', $epoch)
                : date('H:i:s', $epoch);
        }

        return is_scalar($value) ? (string) $value : '';
    }

    /**
     * @param array<string,mixed> $metric
     */
    private static function icon_for_metric(array $metric): string
    {
        $family = (string) ($metric['family'] ?? '');
        $category = (string) ($metric['category'] ?? '');

        if ($family === 'wp.metrics') {
            return 'dashicons-wordpress';
        }

        return match ($category) {
            'time' => 'dashicons-clock',
            'performance' => 'dashicons-chart-area',
            'database' => 'dashicons-database',
            'health' => 'dashicons-heart',
            'env' => 'dashicons-admin-tools',
            'updates' => 'dashicons-update',
            'security' => 'dashicons-shield',
            'network' => 'dashicons-admin-site-alt3',
            'hardware' => 'dashicons-admin-generic',
            'wp-core' => 'dashicons-wordpress',
            default => 'dashicons-admin-generic',
        };
    }

    /**
     * @param array<string,mixed> $metric
     * @return array<string,mixed>
     */
    private static function build_analysis(array $metric): array
    {
        $status = (string) ($metric['status'] ?? 'ok');

        return [
            'status' => $status,
            'severity' => $status === 'error' ? 3 : ($status === 'warn' ? 2 : 1),
            'trend' => (string) ($metric['trend'] ?? 'stable'),
            'state_label' => (string) ($metric['label'] ?? $status),
            'emphasis' => $status === 'error' ? 'high' : ($status === 'warn' ? 'medium' : 'low'),
        ];
    }
}
