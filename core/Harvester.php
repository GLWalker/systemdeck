<?php
/**
 * SystemDeck Harvester
 * Specialized tool for extracting and persisting structural metrics (theme.json telemetry).
 * PHASE 3 FIX: Adds RGB normalization and Font Families.
 */
declare(strict_types=1);

namespace SystemDeck\Core;

use SystemDeck\Core\Color;

if (!defined('ABSPATH')) {
    exit;
}

class Harvester
{


    /**
     * Run the harvest operation.
     */
    public static function harvest(Context $context): array
    {
        $data = self::capture_data_graph();
        StorageEngine::save('telemetry', $data, $context);
        return $data;
    }

    /**
     * Layer 2 Extraction: The Theme JSON Data Graph
     * Captures ALL settings and styles, known or unknown.
     */
    private static function capture_data_graph(): array
    {
        if (!class_exists('WP_Theme_JSON_Resolver')) {
            return [];
        }

        // 1. Get the Single Source of Truth (Layer 2)
        // This contains Core + Theme + User data merged correctly.
        $theme_json = \WP_Theme_JSON_Resolver::get_merged_data();

        // 2. Capture RAW Arrays (The Golden Rule: Never Enumerate Keys)
        $raw_data = $theme_json->get_raw_data();
        $settings = $raw_data['settings'] ?? [];
        $styles = $raw_data['styles'] ?? [];

        // 3. Non-Destructive Augmentation (The Intelligence Layer)
        // We inject RGB values for the Inspector, but we DO NOT filter the keys.
        $settings = self::enrich_color_data($settings);

        // 4. Capture Variations (For the Swapper)
        $variations = [];
        if (method_exists('WP_Theme_JSON_Resolver', 'get_style_variations')) {
            $raw_vars = \WP_Theme_JSON_Resolver::get_style_variations();
            foreach ($raw_vars as $v) {
                $variations[] = [
                    'title' => $v['title'],
                    'slug' => $v['slug'] ?? sanitize_title($v['title'])
                ];
            }
        }

        return [
            'theme' => get_stylesheet(),
            'timestamp' => time(),
            'settings' => $settings, // <--- Contains EVERYTHING (Color, Spacing, Custom, Shadows, Unknowns)
            'styles' => $styles,   // <--- Contains EVERYTHING (Elements, Blocks, Roots)
            'variations' => $variations
        ];
    }

    /**
     * injects RGB values into palettes without destroying other keys.
     */
    private static function enrich_color_data(array $settings): array
    {
        if (!class_exists(Color::class)) {
            return $settings;
        }

        // Helper to process a specific palette array
        $process_palette = function (&$palette) {
            if (is_array($palette)) {
                foreach ($palette as &$p) {
                    if (isset($p['color'])) {
                        $c = new Color($p['color']);
                        $p['rgb'] = $c->hex_to_rgb($p['color']);
                    }
                }
            }
        };

        // 1. Standard Palettes
        if (isset($settings['color']['palette']['theme'])) {
            $process_palette($settings['color']['palette']['theme']);
        }
        if (isset($settings['color']['palette']['default'])) {
            $process_palette($settings['color']['palette']['default']);
        }
        if (isset($settings['color']['palette']['custom'])) {
            $process_palette($settings['color']['palette']['custom']); // User overrides
        }

        return $settings;
    }

    public static function needs_harvest(Context $context): bool
    {
        $last = StorageEngine::get('telemetry', $context);
        if (!$last || empty($last['settings'])) {
            return true;
        }
        return ($last['theme'] ?? '') !== get_stylesheet();
    }


}
