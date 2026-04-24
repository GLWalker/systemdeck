<?php
/**
 * SystemDeck DB Tables Browser
 * Shows SystemDeck table inventory and sample rows for quick diagnostics.
 */
declare(strict_types=1);

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

class DbTablesBrowser extends BaseWidget
{
    public const ID = 'core.db-tables-browser';
    public const TITLE = 'SystemDeck DB Browser';
    public const ICON = 'dashicons-database-view';

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
        ];
    }

    protected static function output(array $context): void
    {
        global $wpdb;

        $prefix = $wpdb->prefix . 'sd_';
        $like = $wpdb->esc_like($prefix) . '%';
        $tables = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $like)) ?: [];

        echo '<div class="sd-db-browser-summary">';
        echo '<p>';
        echo '<strong>Prefix:</strong> <code>' . esc_html($prefix) . '</code>';
        echo '<span class="sd-db-browser-sep">|</span>';
        echo '<strong>Tables:</strong> ' . esc_html((string) count($tables));
        echo '</p>';
        echo '</div>';

        if (empty($tables)) {
            echo '<div class="sd-empty-state">No SystemDeck tables found.</div>';
            return;
        }

        echo '<div class="sd-db-browser-table-wrap">';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th scope="col">Table</th><th scope="col">Rows</th><th scope="col">Columns</th></tr></thead>';
        echo '<tbody>';

        foreach ($tables as $table) {
            $table_safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $table);
            if (!$table_safe) {
                continue;
            }

            $row_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$table_safe}`");
            $columns = $wpdb->get_results("SHOW COLUMNS FROM `{$table_safe}`", ARRAY_A) ?: [];
            $column_count = count($columns);

            echo '<tr>';
            echo '<td><code>' . esc_html($table_safe) . '</code></td>';
            echo '<td>' . esc_html((string) $row_count) . '</td>';
            echo '<td>' . esc_html((string) $column_count) . '</td>';
            echo '</tr>';
        }

        echo '</tbody></table></div>';

        foreach ($tables as $table) {
            $table_safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $table);
            if (!$table_safe) {
                continue;
            }

            $columns = $wpdb->get_results("SHOW COLUMNS FROM `{$table_safe}`", ARRAY_A) ?: [];
            $column_names = array_values(array_map(static function (array $col): string {
                return (string) ($col['Field'] ?? '');
            }, $columns));

            $sample_rows = $wpdb->get_results("SELECT * FROM `{$table_safe}` ORDER BY 1 DESC LIMIT 10", ARRAY_A) ?: [];

            echo '<details class="sd-db-browser-details">';
            echo '<summary><code>' . esc_html($table_safe) . '</code> sample (10 newest rows)</summary>';

            if (empty($sample_rows)) {
                echo '<div class="sd-empty-state">No rows.</div>';
                echo '</details>';
                continue;
            }

            echo '<div class="sd-db-browser-table-wrap">';
            echo '<table class="wp-list-table widefat fixed striped">';
            echo '<thead><tr>';
            foreach ($column_names as $name) {
                echo '<th scope="col">' . esc_html($name) . '</th>';
            }
            echo '</tr></thead><tbody>';

            foreach ($sample_rows as $row) {
                echo '<tr>';
                foreach ($column_names as $name) {
                    $value = $row[$name] ?? '';
                    if (is_array($value) || is_object($value)) {
                        $value = wp_json_encode($value);
                    }
                    $value = (string) $value;
                    if (strlen($value) > 120) {
                        $value = substr($value, 0, 117) . '...';
                    }
                    echo '<td><code>' . esc_html($value) . '</code></td>';
                }
                echo '</tr>';
            }

            echo '</tbody></table></div>';
            echo '</details>';
        }
    }
}

