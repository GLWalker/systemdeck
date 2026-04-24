<?php
/**
 * Telemetry Engine
 * Collects server and WordPress environment data.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class Telemetry
{
    private const RUNTIME_CACHE_TTL = 5;

    /**
     * Get All System Diagnostics (Unified)
     * Philosophy: Safe execution on any host environment.
     */
    public static function get_headless_config(): array
    {
        // Attempt to retrieve harvested theme data for the editor
        $user_id = get_current_user_id();

        // 1. Try Retail Context (Standard Harvest Location)
        if (class_exists('SystemDeck\Core\Context') && class_exists('SystemDeck\Core\StorageEngine')) {
            $context = new Context($user_id, 'retail');
            $data = StorageEngine::get('telemetry', $context);
            if (!empty($data)) {
                return $data;
            }

            // 2. If missing, try to harvest immediately
            if (class_exists('SystemDeck\Core\Harvester')) {
                return Harvester::harvest($context);
            }
        }

        // 3. Fallback to basic metrics
        return self::get_raw_metrics();
    }

    public static function get_all_metrics(): array
    {
        $raw = self::get_raw_metrics();
        $timestamp = isset($raw['timestamp']) ? (int) $raw['timestamp'] : time();

        $memory_limit_bytes = self::to_bytes((string) ($raw['memory_limit'] ?? '0'));
        $memory_pct = $memory_limit_bytes > 0
            ? (float) (($raw['memory_bytes'] ?? 0) / $memory_limit_bytes) * 100
            : 0.0;

        return [
            self::metric('load_time_wp', 'WP Load Time', (float) ($raw['load_time_wp'] ?? 0.0), 's', self::threshold_status((float) ($raw['load_time_wp'] ?? 0.0), 1.0, 2.0), 'stable', $timestamp),
            self::metric('load_time_srv', 'Server Load Time', (float) ($raw['load_time_srv'] ?? 0.0), 's', self::threshold_status((float) ($raw['load_time_srv'] ?? 0.0), 1.0, 2.0), 'stable', $timestamp),
            self::metric('db_queries', 'DB Queries', (int) ($raw['db_queries'] ?? 0), 'count', self::threshold_status((float) ($raw['db_queries'] ?? 0), 80.0, 150.0), 'stable', $timestamp),
            self::metric('memory_usage', 'Memory Usage', round($memory_pct, 2), '%', self::threshold_status($memory_pct, 75.0, 90.0), 'stable', $timestamp),
            self::metric('server_time', 'Server Time', (int) ($raw['server_time'] ?? $timestamp), 'unix', 'normal', 'stable', $timestamp),
            self::metric('wp_time', 'WP Time', (int) ($raw['wp_time'] ?? $timestamp), 'unix', 'normal', 'stable', $timestamp),
            self::metric('uptime', 'Server Uptime', (string) ($raw['uptime'] ?? 'N/A'), 'text', 'normal', 'stable', $timestamp),
            self::metric('db_size_bytes', 'DB Size', (int) ($raw['db_size_bytes'] ?? 0), 'bytes', 'normal', 'stable', $timestamp),
            self::metric('db_autoload_bytes', 'Autoload Size', (int) ($raw['db_autoload_bytes'] ?? 0), 'bytes', self::threshold_status((float) ($raw['db_autoload_bytes'] ?? 0), 800000.0, 1048576.0), 'stable', $timestamp),
            self::metric('plugins_active', 'Active Plugins', (int) ($raw['plugins_active'] ?? 0), 'count', 'normal', 'stable', $timestamp),
            self::metric('plugins_total', 'Total Plugins', (int) ($raw['plugins_total'] ?? 0), 'count', 'normal', 'stable', $timestamp),
            self::metric('themes_total', 'Total Themes', (int) ($raw['themes_total'] ?? 0), 'count', 'normal', 'stable', $timestamp),
            self::metric('wp_debug', 'WP Debug', !empty($raw['wp_debug']), 'boolean', !empty($raw['wp_debug']) ? 'warning' : 'normal', 'stable', $timestamp),
            self::metric('php_version', 'PHP Version', (string) ($raw['php_version'] ?? 'unknown'), 'text', 'normal', 'stable', $timestamp),
            self::metric('wp_version', 'WP Version', (string) ($raw['wp_version'] ?? 'unknown'), 'text', 'normal', 'stable', $timestamp),
            self::metric('ip_user', 'User IP', (string) ($raw['ip_user'] ?? '0.0.0.0'), 'text', 'normal', 'stable', $timestamp),
            self::metric('geo_location', 'Geo Location', (string) ($raw['geo_location'] ?? 'unknown'), 'text', 'normal', 'stable', $timestamp),
        ];
    }

    /**
     * @param int|float|string|bool $value
     * @return array<string,mixed>
     */
    private static function metric(string $id, string $label, $value, string $unit, string $status, string $trend, int $timestamp): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'value' => $value,
            'unit' => $unit,
            'status' => $status,
            'trend' => $trend,
            'timestamp' => $timestamp,
        ];
    }

    private static function threshold_status(float $value, float $warning, float $critical): string
    {
        if ($value >= $critical) {
            return 'critical';
        }
        if ($value >= $warning) {
            return 'warning';
        }
        return 'normal';
    }

    private static function to_bytes(string $raw): int
    {
        $value = trim($raw);
        if ($value === '' || $value === '-1') {
            return 0;
        }

        $unit = strtolower(substr($value, -1));
        $numeric = (float) $value;
        switch ($unit) {
            case 'g':
                return (int) ($numeric * 1024 * 1024 * 1024);
            case 'm':
                return (int) ($numeric * 1024 * 1024);
            case 'k':
                return (int) ($numeric * 1024);
            default:
                return (int) $numeric;
        }
    }

    public static function get_runtime_metrics(bool $fresh = false): array
    {
        $cache_key = 'sd_runtime_telemetry_v1';

        if (!$fresh) {
            $cached = get_transient($cache_key);
            if (is_array($cached) && !empty($cached)) {
                return $cached;
            }
        }

        $metrics = self::build_runtime_metrics();
        set_transient($cache_key, $metrics, self::RUNTIME_CACHE_TTL);

        return $metrics;
    }

    /**
     * Get Raw System Metrics (Full Spectrum)
     * Returns unformatted data for JS visualization (Graphs, Clocks, Status Bars).
     * * @return array Full system telemetry in raw JSON-ready format.
     */
    public static function get_raw_metrics(): array
    {
        return self::build_runtime_metrics();
    }

    private static function build_runtime_metrics(): array
    {
        global $wpdb, $wp_version;

        // 1. TIMING & LOAD
        $start_micro = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);
        $times = self::get_time_diagnostics(); // Uses internal helper
        $wp_load = function_exists('timer_stop') ? timer_stop(0, 4) : 0;

        // 2. MEMORY
        $mem_bytes = memory_get_peak_usage(true);
        $mem_limit = ini_get('memory_limit');

        // 3. DATABASE (Raw Counts)
        $queries = get_num_queries();
        $table_count = $wpdb->get_var("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "'");
        $db_size = $wpdb->get_var("SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "'");

        // Autoload size check
        $autoload_bytes = 0;
        if ($wpdb->get_var("SHOW TABLES LIKE '$wpdb->options'") === $wpdb->options) {
            $autoload_bytes = (int) $wpdb->get_var("SELECT SUM(LENGTH(option_value)) FROM $wpdb->options WHERE autoload = 'yes'");
        }

        // 4. WP INTERNALS (Counts)
        if (!function_exists('get_plugins'))
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', []);
        $all_themes = wp_get_themes();

        // 5. ASSETS (Real-time Counts)
        $scripts = self::get_assets_data('scripts');
        $styles = self::get_assets_data('styles');

        // 6. HARDWARE & DISK
        $hw = self::get_server_hardware();
        $disk_total = @disk_total_space(ABSPATH) ?: 0;
        $disk_free = @disk_free_space(ABSPATH) ?: 0;
        $uploads_dir = wp_upload_dir();

        // 7. ENVIRONMENT
        $debug_mode = (defined('WP_DEBUG') && WP_DEBUG);
        $ssl = is_ssl();

        return [
            // --- TIME ---
            'timestamp' => time(),
            'server_time' => $times['server_ts'] ?? time(), // Fallback if helper changes
            'wp_time' => $times['wp_ts'] ?? current_time('timestamp'),
            'uptime' => $times['uptime'] ?? 'N/A',
            'load_time_wp' => (float) $wp_load,
            'load_time_srv' => (float) number_format(microtime(true) - $start_micro, 4),

            // --- RESOURCES ---
            'memory_bytes' => $mem_bytes,
            'memory_limit' => $mem_limit,
            'cpu_model' => $hw['cpu'] ?? 'Unknown',
            'cpu_cores' => $hw['cores'] ?? 1,
            'cpu_temp' => $hw['temp'] ?? 'N/A',
            'disk_total' => $disk_total,
            'disk_used' => $disk_total - $disk_free,
            'disk_free' => $disk_free,

            // --- DATABASE ---
            'db_queries' => $queries,
            'db_tables' => (int) $table_count,
            'db_size_bytes' => (int) $db_size,
            'db_autoload_bytes' => $autoload_bytes,
            'db_version' => $wpdb->db_version(),

            // --- WORDPRESS ---
            'wp_version' => $wp_version,
            'wp_debug' => $debug_mode,
            'is_ssl' => $ssl,
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',

            // --- COUNTS ---
            'plugins_total' => count($all_plugins),
            'plugins_active' => count($active_plugins),
            'themes_total' => count($all_themes),
            'scripts_total' => $scripts['counts']['registered'],
            'scripts_enqueued' => $scripts['counts']['enqueued'],
            'styles_total' => $styles['counts']['registered'],
            'styles_enqueued' => $styles['counts']['enqueued'],

            // --- NETWORK ---
            // Avoid DNS resolution in runtime path to prevent slow first paint.
            'ip_server' => sanitize_text_field((string) ($_SERVER['SERVER_ADDR'] ?? '127.0.0.1')),
            'ip_user' => self::get_real_ip(),
            'geo_location' => self::get_geo_location(),
            'host_name' => gethostname(),
        ];
    }


    private static function get_time_diagnostics(): array
    {
        global $wpdb;
        $now_server = time();
        $now_wp = (int) current_time('timestamp');
        $db_time = 'Unknown';
        $latency = 0;
        $uptime_readable = 'N/A';

        if ($wpdb) {
            $start = microtime(true);
            $db_res = $wpdb->get_row("SELECT NOW() as t");
            $end = microtime(true);
            $latency = round(($end - $start) * 1000, 2);
            $db_time = $db_res ? $db_res->t : 'Error';
        }

        if (@is_readable('/proc/uptime')) {
            $u = @file_get_contents('/proc/uptime');
            if ($u) {
                $parts = explode(' ', trim($u));
                $uptime_sec = (int) $parts[0];
                $dtF = new \DateTime('@0');
                $dtT = new \DateTime("@$uptime_sec");
                $uptime_readable = $dtF->diff($dtT)->format('%ad %hh %im');
            }
        }

        return [
            'db_time' => $db_time,
            'tz_server' => date_default_timezone_get(),
            'tz_wp' => get_option('timezone_string') ?: 'WP Offset',
            'uptime' => $uptime_readable,
            'wp_ts' => $now_wp,
        ];
    }

    private static function get_real_ip(): string
    {
        $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
        foreach ($keys as $key) {
            if (!empty($_SERVER[$key])) {
                $list = explode(',', $_SERVER[$key]);
                $ip = trim(end($list));
                if (filter_var($ip, FILTER_VALIDATE_IP))
                    return $ip;
            }
        }
        return '0.0.0.0';
    }

    private static function get_geo_location(): string
    {
        $headers = ['HTTP_CF_IPCOUNTRY', 'GEOIP_COUNTRY_CODE', 'HTTP_X_COUNTRY_CODE', 'HTTP_X_GEOIP_COUNTRY'];
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                return strtoupper(sanitize_text_field($_SERVER[$header]));
            }
        }
        return 'Local/Unknown';
    }

    private static function get_uploads_size(): string
    {
        $uploads_dir = wp_upload_dir()['basedir'] ?? ABSPATH . 'wp-content/uploads';
        if (!is_dir($uploads_dir) || !function_exists('exec') || ini_get('safe_mode')) {
            return 'N/A';
        }
        $size = trim(@exec("du -sh " . escapeshellarg($uploads_dir) . " 2>/dev/null | awk '{print $1}'"));
        return !empty($size) ? esc_html($size) : 'N/A';
    }

    private static function get_disk_usage(): string
    {
        $path = ABSPATH;
        $total = @disk_total_space($path);
        $free = @disk_free_space($path);
        if ($total === false || $free === false)
            return 'Unknown';
        $used = $total - $free;
        $percent = $total > 0 ? round(($used / $total) * 100) : 0;
        return size_format((int) $used) . ' / ' . size_format((int) $total) . " ({$percent}%)";
    }

    private static function get_server_hardware(): array
    {
        $cpu = 'Unknown';
        $cores = 0;
        $temp = 'N/A';
        if (@is_readable('/proc/cpuinfo')) {
            $cpuinfo = @file_get_contents('/proc/cpuinfo');
            preg_match_all('/^model name\s+:\s+(.*)$/m', $cpuinfo, $matches);
            if (!empty($matches[1][0])) {
                $cpu = $matches[1][0];
                $cores = count($matches[1]);
            }
        }
        if (@is_readable('/sys/class/thermal/thermal_zone0/temp')) {
            $t = @file_get_contents('/sys/class/thermal/thermal_zone0/temp');
            $temp = round((int) $t / 1000) . '&deg;C';
        }
        return ['cpu' => $cpu, 'cores' => $cores, 'temp' => $temp];
    }

    private static function get_cache_path(): string
    {
        if (defined('WP_CACHE') && WP_CACHE) {
            if (defined('WPFC_CACHE_DIR'))
                return 'WPFC: ' . WPFC_CACHE_DIR;
            if (defined('WPSC_CACHE_DIR'))
                return 'WP Super Cache: ' . WPSC_CACHE_DIR;
            if (class_exists('\WpLscIsu') || defined('LSCWP_DIR'))
                return 'LiteSpeed: .../cache/litespeed';
            if (defined('W3TC'))
                return 'W3TC: wp-content/cache/';
            return 'Advanced Caching Detected';
        }
        return 'None/Unknown';
    }

    private static function safe_timer_stop(): string
    {
        if (!function_exists('timer_stop'))
            return '0.000';
        return (string) timer_stop(0, 3);
    }

    private static function get_assets_data(string $type = 'scripts'): array
    {
        $wp_obj = ($type === 'scripts') ? wp_scripts() : wp_styles();
        // Force dependency resolution
        if (!empty($wp_obj->queue)) {
            $wp_obj->all_deps($wp_obj->queue);
        }
        $done = $wp_obj->done ?? [];
        $todo = $wp_obj->to_do ?? [];
        $active_handles = array_unique(array_merge($done, $todo));
        $registered_list = $wp_obj->registered;
        $enqueued_count = 0;
        foreach ($registered_list as $handle => $data) {
            if (in_array($handle, $active_handles, true))
                $enqueued_count++;
        }
        return [
            'counts' => [
                'registered' => count($registered_list),
                'enqueued' => $enqueued_count
            ]
        ];
    }
}
