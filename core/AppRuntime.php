<?php
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

final class AppRuntime
{
    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_registered_apps(): array
    {
        $apps = apply_filters('systemdeck_register_apps', []);
        if (!is_array($apps)) {
            return [];
        }

        $normalized = [];
        foreach ($apps as $app) {
            if (!is_array($app)) {
                continue;
            }

            $id = sanitize_key((string) ($app['id'] ?? ''));
            $root_widget_id = sanitize_text_field((string) (
                $app['root_widget_id']
                ?? (is_array($app['widgets'] ?? null) ? ($app['widgets']['root_widget_id'] ?? '') : '')
            ));
            if ($id === '' || $root_widget_id === '') {
                continue;
            }

            $workspace_id = sanitize_key((string) (
                $app['workspace_id']
                ?? (is_array($app['workspace'] ?? null) ? ($app['workspace']['id'] ?? '') : '')
            ));
            if ($workspace_id === '') {
                continue;
            }

            $entry = 'tools';
            if (isset($app['entry']) && is_string($app['entry'])) {
                $entry = sanitize_key($app['entry']);
            } elseif (is_array($app['entry'] ?? null)) {
                $show_tools_link = !empty($app['entry']['show_tools_link']);
                $entry = $show_tools_link ? 'tools' : 'app';
            }

            $seed_widgets = [];
            if (is_array($app['widgets'] ?? null) && is_array($app['widgets']['seed'] ?? null)) {
                foreach ((array) $app['widgets']['seed'] as $seed_widget_id) {
                    $candidate = sanitize_text_field((string) $seed_widget_id);
                    if ($candidate !== '') {
                        $seed_widgets[] = $candidate;
                    }
                }
            }

            $allowlist_widgets = [];
            if (is_array($app['widgets'] ?? null) && is_array($app['widgets']['allowlist'] ?? null)) {
                foreach ((array) $app['widgets']['allowlist'] as $allow_widget_id) {
                    $candidate = sanitize_text_field((string) $allow_widget_id);
                    if ($candidate !== '') {
                        $allowlist_widgets[] = $candidate;
                    }
                }
            }

            $seed_widgets[] = $root_widget_id;
            $seed_widgets = array_values(array_unique($seed_widgets));
            $allowlist_widgets = array_values(array_unique(array_merge($allowlist_widgets, $seed_widgets)));

            $normalized[$id] = [
                'id' => $id,
                'title' => sanitize_text_field((string) ($app['title'] ?? $id)),
                'workspace_id' => $workspace_id,
                'root_widget_id' => $root_widget_id,
                'menu_icon' => sanitize_html_class((string) (
                    $app['menu_icon']
                    ?? (string) ($app['icon'] ?? 'dashicons-screenoptions')
                )),
                'entry' => $entry !== '' ? $entry : 'tools',
                'seed_widget_ids' => $seed_widgets,
                'allowlist_widget_ids' => $allowlist_widgets,
            ];
        }

        return $normalized;
    }

    /**
     * @param array<string,array<string,mixed>> $workspaces
     */
    public static function preload_registered_app_assets(array $workspaces): void
    {
        if (empty($workspaces)) {
            return;
        }

        $apps = self::get_registered_apps();
        if (empty($apps)) {
            return;
        }

        $widget_ids = [];
        foreach ($apps as $app) {
            $workspace_id = sanitize_key((string) ($app['workspace_id'] ?? ''));
            if ($workspace_id === '' || !isset($workspaces[$workspace_id]) || !is_array($workspaces[$workspace_id])) {
                continue;
            }

            foreach ((array) ($app['seed_widget_ids'] ?? []) as $widget_id) {
                $candidate = sanitize_text_field((string) $widget_id);
                if ($candidate === '') {
                    continue;
                }
                $widget_ids[$candidate] = $candidate;
            }
        }

        foreach ($widget_ids as $widget_id) {
            \SystemDeck\Core\Registry::enqueue_widget_assets((string) $widget_id);
        }

        /**
         * Allow app providers to enqueue additional runtime dependencies that are
         * not part of root widget assets.
         */
        do_action('systemdeck_app_preload_assets', $widget_ids, $workspaces, $apps);
    }

    public static function get_app(string $app_id): ?array
    {
        $normalized_id = sanitize_key($app_id);
        if ($normalized_id === '') {
            return null;
        }

        $apps = self::get_registered_apps();
        return is_array($apps[$normalized_id] ?? null) ? $apps[$normalized_id] : null;
    }

    /**
     * @return array<int,string>
     */
    public static function get_seed_widget_ids(string $app_id): array
    {
        $app = self::get_app($app_id);
        if (!$app) {
            return [];
        }
        return array_values((array) ($app['seed_widget_ids'] ?? []));
    }

    /**
     * @return array<int,string>
     */
    public static function get_allowlist_widget_ids(string $app_id): array
    {
        $app = self::get_app($app_id);
        if (!$app) {
            return [];
        }
        return array_values((array) ($app['allowlist_widget_ids'] ?? []));
    }
}
