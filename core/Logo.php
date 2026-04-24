<?php
declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class Logo
{
    public static function init(): void
    {
        add_filter('sd_dynamic_css_extra', [self::class, 'append_dynamic_css'], 10, 3);
    }

    public static function render_svg(int $size = 28, string $extra_css = ''): string
    {
        $path = SYSTEMDECK_PATH . 'assets/img/vic-image-cropped.svg';
        if (!file_exists($path)) {
            return '';
        }

        $svg_content = file_get_contents($path);
        if (!is_string($svg_content) || $svg_content === '') {
            return '';
        }

        $updated = preg_replace(
            '/<svg([^>]*)>/i',
            '<svg$1 width="' . $size . '" height="' . $size . '" style="' . esc_attr($extra_css) . '" role="img" aria-hidden="true">',
            $svg_content,
            1
        );

        if (!is_string($updated) || $updated === '') {
            return '';
        }

        return wp_kses($updated, self::allowed_svg_tags());
    }

    public static function append_dynamic_css(string $css, string $scheme = 'fresh', int $user_id = 0): string
    {
        $extra_css = "\n    /* SVG Logo Anatomy (Theme Dependent) */\n";

        foreach (self::logo_variable_map() as $name => $value) {
            $extra_css .= "    {$name}: {$value};\n";
        }

        if (class_exists(Assets::class) && class_exists(Color::class)) {
            $schemes = Assets::$schemes ?? [];
            $scheme_colors = $schemes[$scheme] ?? ($schemes['fresh'] ?? []);
            $base_blue = $scheme_colors[2] ?? '#2271b1';

            $blue_palette = (new Color($base_blue))->createPalette(3, 15.0);
            foreach ($blue_palette as $i => $hex) {
                $extra_css .= '    --sd-logo-highlight-' . ($i + 1) . ': ' . $hex . ";\n";
            }

            $dark_palette = (new Color('#052E51'))->createPalette(4, 8.0);
            foreach ($dark_palette as $i => $hex) {
                $extra_css .= '    --sd-logo-dark-' . ($i + 1) . ': ' . $hex . ";\n";
            }
        }

        return $css . $extra_css;
    }

    private static function logo_variable_map(): array
    {
        return [
            '--sd-logo-crown' => 'var(--sd-highlight-color, #1681CC)',
            '--sd-logo-plumicorns' => 'var(--sd-heading-color, #052E51)',
            '--sd-logo-facial-disk' => 'var(--sd-card-bg, #FCFCFC)',
            '--sd-logo-eyebrows' => 'var(--sd-menu-background, #062F52)',
            '--sd-logo-pupils' => '#041223',
            '--sd-logo-beak' => 'var(--sd-notification-color, #72aee6)',
            '--sd-logo-shield' => 'var(--sd-highlight-color, #0A8FDF)',
            '--sd-logo-wings' => 'var(--sd-highlight-color, #1681CC)',
        ];
    }

    private static function allowed_svg_tags(): array
    {
        return [
            'svg' => [
                'xmlns' => [],
                'viewBox' => [],
                'viewbox' => [],
                'width' => [],
                'height' => [],
                'style' => [],
                'role' => [],
                'aria-hidden' => [],
                'version' => [],
            ],
            'path' => [
                'd' => [],
                'fill' => [],
                'transform' => [],
                'style' => [],
                'opacity' => [],
            ],
            'g' => [
                'fill' => [],
                'transform' => [],
                'style' => [],
            ],
            'defs' => [],
            'style' => [],
        ];
    }
}