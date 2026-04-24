<?php

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class ThemeUtilities
 *
 * Provides helper methods to extract theme data (colors, fonts, etc.)
 * from WordPress's Global Settings (theme.json).
 */
class ThemeUtilities
{
    public static function get_theme_data(string $type = 'all'): array
    {
        if (!function_exists('wp_get_global_settings'))
            return [];

        $settings = wp_get_global_settings();
        $data = ['fonts' => [], 'colors' => [], 'gradients' => [], 'shadows' => [], 'duotones' => []];

        // FONTS
        if ($type === 'fonts' || $type === 'all') {
            $fonts = $settings['typography']['fontFamilies']['theme'] ?? [];
            foreach ($fonts as $f) {
                $slug = $f['slug'] ?? sanitize_title($f['name']);
                $data['fonts'][$slug] = [
                    'name' => $f['name'] ?? 'Unknown',
                    'family' => $f['fontFamily'] ?? ''
                ];
            }
        }

        // DUOTONES
        if ($type === 'duotones' || $type === 'all') {
            $duotones = $settings['color']['duotone']['theme'] ?? [];
            foreach ($duotones as $d) {
                $slug = $d['slug'] ?? sanitize_title($d['name']);
                $data['duotones'][$slug] = [
                    'name' => $d['name'] ?? 'Unknown',
                    'colors' => $d['colors'] ?? []
                ];
            }
        }

        // COLORS & GRADIENTS
        if ($type === 'colors' || $type === 'gradients' || $type === 'all') {
            // Colors: Default + Theme
            $colors = [];
            $default_palette_enabled = $settings['color']['defaultPalette'] ?? true;
            if ($default_palette_enabled) {
                foreach (($settings['color']['palette']['default'] ?? []) as $c) {
                    $slug = $c['slug'] ?? sanitize_title($c['name']);
                    $colors[$slug] = ['name' => $c['name'] ?? 'Unknown', 'color' => $c['color'] ?? '#000000', 'origin' => 'default'];
                }
            }
            foreach (($settings['color']['palette']['theme'] ?? []) as $c) {
                $slug = $c['slug'] ?? sanitize_title($c['name']);
                $colors[$slug] = ['name' => $c['name'] ?? 'Unknown', 'color' => $c['color'] ?? '#000000', 'origin' => 'theme'];
            }
            $data['colors'] = $colors;

            // Gradients: Default + Theme
            $gradients = [];
            $default_gradients_enabled = $settings['color']['defaultGradients'] ?? true;
            if ($default_gradients_enabled) {
                foreach (($settings['color']['gradients']['default'] ?? []) as $g) {
                    $slug = $g['slug'] ?? sanitize_title($g['name']);
                    $gradients[$slug] = ['name' => $g['name'] ?? 'Unknown', 'gradient' => $g['gradient'] ?? '', 'origin' => 'default'];
                }
            }
            foreach (($settings['color']['gradients']['theme'] ?? []) as $g) {
                $slug = $g['slug'] ?? sanitize_title($g['name']);
                $gradients[$slug] = ['name' => $g['name'] ?? 'Unknown', 'gradient' => $g['gradient'] ?? '', 'origin' => 'theme'];
            }
            $data['gradients'] = $gradients;
        }

        // SHADOWS
        if ($type === 'shadows' || $type === 'all') {
            // 1. Core WP Default Shadows
            $core_shadows = [
                'natural' => ['name' => 'Natural', 'slug' => 'natural', 'shadow' => '6px 6px 9px rgba(0, 0, 0, 0.2)'],
                'deep' => ['name' => 'Deep', 'slug' => 'deep', 'shadow' => '12px 12px 50px rgba(0, 0, 0, 0.4)'],
                'sharp' => ['name' => 'Sharp', 'slug' => 'sharp', 'shadow' => '6px 6px 0px rgba(0, 0, 0, 0.2)'],
                'outlined' => ['name' => 'Outlined', 'slug' => 'outlined', 'shadow' => '6px 6px 0px 2px rgba(255, 255, 255, 1), 6px 6px 0px 4px rgba(0, 0, 0, 1)'],
                'crisp' => ['name' => 'Crisp', 'slug' => 'crisp', 'shadow' => '6px 6px 0px rgba(0, 0, 0, 1)'],
            ];

            // 2. Fetch Global Settings
            $shadow_settings = $settings['shadow'] ?? [];
            $presets_raw = $shadow_settings['presets'] ?? [];

            // 3. Flatten and Merge All Presets
            $merged = $core_shadows;

            // Should verify if recursive helper needed, but simple iteration usually works for WP structure
            // Let's implement a simple flattening loop
            $iterator = new \RecursiveIteratorIterator(new \RecursiveArrayIterator($presets_raw));
            foreach ($presets_raw as $key => $val) {
                if (isset($val['shadow'])) {
                    $slug = $val['slug'] ?? sanitize_title($val['name']);
                    $merged[$slug] = $val;
                } elseif (is_array($val)) {
                    // Handle nested 'theme', 'default', 'custom' keys
                    foreach ($val as $sub) {
                        if (isset($sub['shadow'])) {
                            $slug = $sub['slug'] ?? sanitize_title($sub['name']);
                            $merged[$slug] = $sub;
                        }
                    }
                }
            }

            foreach ($merged as $slug => $s) {
                $data['shadows'][$slug] = [
                    'name' => $s['name'] ?? 'Unknown',
                    'shadow' => $s['shadow'] ?? ''
                ];
            }
        }

        // ELEMENT STYLES (Global defaults)
        if ($type === 'elements' || $type === 'all') {
            if (function_exists('wp_get_global_styles')) {
                $styles = wp_get_global_styles();
                $data['elements'] = $styles['elements'] ?? [];
            }
        }

        return $type === 'all' ? $data : ($data[$type] ?? []);
    }
}
