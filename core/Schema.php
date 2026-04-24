<?php

namespace SystemDeck\Core;
/**
 * Return all schemes
 * 'admin' => [
 *      'menu-bg' => '#1d2327',
 *      'submenu-bg' => '#2c3338',
 *      'menu-highlight-bg' => '#2271b1',
 *      'submenu-focus' => '#72aee6',],
 *
 * rename to wp-admin-scheme-color-1, wp-admin-scheme-color-2, wp-admin-scheme-color-3, wp-admin-scheme-color-4
 * wp-admin-icon-base, wp-admin-icon-focus, wp-admin-icon-current
 *
 */
final class Schema
{
    public static function all(): array
    {
        return [
            'fresh' => [
                'label' => 'Default',
                'admin' => [
                    'admin-scheme-color-1' => '#1d2327',
                    'admin-scheme-color-2' => '#2c3338',
                    'admin-scheme-color-3' => '#2271b1',
                    'admin-scheme-color-4' => '#72aee6',
                ],
                'icons' => [
                    'admin-icon-base' => '#a7aaad',
                    'admin-icon-focus' => '#72aee6',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#2271b1',
                    'admin-theme-color--rgb' => '34, 113, 177',
                    'admin-theme-color-darker-10' => '#1d5f96',
                    'admin-theme-color-darker-10--rgb' => '29, 95, 150',
                    'admin-theme-color-darker-20' => '#174e7a',
                    'admin-theme-color-darker-20--rgb' => '23, 78, 122',
                ],
            ],
            'light' => [
                'label' => 'Light',
                'admin' => [
                    'menu-bg' => '#e5e5e5',
                    'submenu-bg' => '#999999',
                    'menu-highlight-bg' => '#d64e07',
                    'submenu-focus' => '#0085ba',
                ],
                'icons' => [
                    'admin-icon-base' => '#999999',
                    'admin-icon-focus' => '#cccccc',
                    'admin-icon-current' => '#cccccc',
                ],
                'theme' => [
                    'admin-theme-color' => '#0085ba',
                    'admin-theme-color--rgb' => '0, 133, 186',
                    'admin-theme-color-darker-10' => '#0073a1',
                    'admin-theme-color-darker-10--rgb' => '0, 115, 161',
                    'admin-theme-color-darker-20' => '#006187',
                    'admin-theme-color-darker-20--rgb' => '0, 97, 135',
                ],
            ],
            'modern' => [
                'label' => 'Modern',
                'admin' => [
                    'menu-bg' => '#1e1e1e',
                    'submenu-bg' => '#2c2c2c',
                    'menu-highlight-bg' => '#3858e9',
                    'submenu-focus' => '#7b90ff',
                ],
                'icons' => [
                    'admin-icon-base' => '#f3f1f1',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#3858e9',
                    'admin-theme-color--rgb' => '56, 88, 233',
                    'admin-theme-color-darker-10' => '#2145e6',
                    'admin-theme-color-darker-10--rgb' => '33, 69, 230',
                    'admin-theme-color-darker-20' => '#183ad6',
                    'admin-theme-color-darker-20--rgb' => '24, 58, 214',
                ],
            ],
            'blue' => [
                'label' => 'Blue',
                'admin' => [
                    'menu-bg' => '#096484',
                    'submenu-bg' => '#4796b3',
                    'menu-highlight-bg' => '#52accc',
                    'submenu-focus' => '#74b6ce',
                ],
                'icons' => [
                    'admin-icon-base' => '#e5f8ff',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#096484',
                    'admin-theme-color--rgb' => '9, 100, 132',
                    'admin-theme-color-darker-10' => '#07526c',
                    'admin-theme-color-darker-10--rgb' => '7, 82, 108',
                    'admin-theme-color-darker-20' => '#064054',
                    'admin-theme-color-darker-20--rgb' => '6, 64, 84',
                ],
            ],
            'midnight' => [
                'label' => 'Midnight',
                'admin' => [
                    'menu-bg' => '#25282b',
                    'submenu-bg' => '#363b3f',
                    'menu-highlight-bg' => '#69a8bb',
                    'submenu-focus' => '#e14d43',
                ],
                'icons' => [
                    'admin-icon-base' => '#f1f2f3',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#e14d43',
                    'admin-theme-color--rgb' => '225, 77, 67',
                    'admin-theme-color-darker-10' => '#dd382d',
                    'admin-theme-color-darker-10--rgb' => '221, 56, 45',
                    'admin-theme-color-darker-20' => '#d02c21',
                    'admin-theme-color-darker-20--rgb' => '208, 44, 33',
                ],
            ],
            'sunrise' => [
                'label' => 'Sunrise',
                'admin' => [
                    'menu-bg' => '#b43c38',
                    'submenu-bg' => '#cf4944',
                    'menu-highlight-bg' => '#dd823b',
                    'submenu-focus' => '#ccaf0b',
                ],
                'icons' => [
                    'admin-icon-base' => '#f3f1f1',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#dd823b',
                    'admin-theme-color--rgb' => '221, 130, 59',
                    'admin-theme-color-darker-10' => '#d97426',
                    'admin-theme-color-darker-10--rgb' => '217, 116, 38',
                    'admin-theme-color-darker-20' => '#c36922',
                    'admin-theme-color-darker-20--rgb' => '195, 105, 34',
                ],
            ],
            'ectoplasm' => [
                'label' => 'Ectoplasm',
                'admin' => [
                    'menu-bg' => '#413256',
                    'submenu-bg' => '#523f6d',
                    'menu-highlight-bg' => '#a3b745',
                    'submenu-focus' => '#d46f15',
                ],
                'icons' => [
                    'admin-icon-base' => '#ece6f6',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#523f6d',
                    'admin-theme-color--rgb' => '82, 63, 109',
                    'admin-theme-color-darker-10' => '#46365d',
                    'admin-theme-color-darker-10--rgb' => '70, 54, 93',
                    'admin-theme-color-darker-20' => '#3a2c4d',
                    'admin-theme-color-darker-20--rgb' => '58, 44, 77',
                ],
            ],
            'ocean' => [
                'label' => 'Ocean',
                'admin' => [
                    'menu-bg' => '#627c83',
                    'submenu-bg' => '#738e96',
                    'menu-highlight-bg' => '#9ebaa0',
                    'submenu-focus' => '#aa9d88',
                ],
                'icons' => [
                    'admin-icon-base' => '#f2fcff',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#627c83',
                    'admin-theme-color--rgb' => '98, 124, 131',
                    'admin-theme-color-darker-10' => '#576e74',
                    'admin-theme-color-darker-10--rgb' => '87, 110, 116',
                    'admin-theme-color-darker-20' => '#4c6066',
                    'admin-theme-color-darker-20--rgb' => '76, 96, 102',
                ],
            ],
            'coffee' => [
                'label' => 'Coffee',
                'admin' => [
                    'menu-bg' => '#46403c',
                    'submenu-bg' => '#59524c',
                    'menu-highlight-bg' => '#c7a589',
                    'submenu-focus' => '#9ea476',
                ],
                'icons' => [
                    'admin-icon-base' => '#f3f2f1',
                    'admin-icon-focus' => '#ffffff',
                    'admin-icon-current' => '#ffffff',
                ],
                'theme' => [
                    'admin-theme-color' => '#46403c',
                    'admin-theme-color--rgb' => '70, 64, 60',
                    'admin-theme-color-darker-10' => '#383330',
                    'admin-theme-color-darker-10--rgb' => '56, 51, 48',
                    'admin-theme-color-darker-20' => '#2b2724',
                    'admin-theme-color-darker-20--rgb' => '43, 39, 36',
                ],
            ],
        ];
    }

    public static function get(string $scheme): array
    {
        $all = self::all();
        return $all[$scheme] ?? $all[self::default_scheme()];
    }

    public static function has(string $scheme): bool
    {
        return isset(self::all()[$scheme]);
    }

    public static function default_scheme(): string
    {
        return 'fresh';
    }

    public static function to_css(string $scheme): string
    {
        $data = self::get($scheme);
        $vars = [];

        foreach ($data['admin'] as $key => $value) {
            $vars[] = '--wp-' . $key . ': ' . $value . ';';
        }

        foreach ($data['icons'] as $key => $value) {
            $vars[] = '--wp-' . $key . ': ' . $value . ';';
        }

        foreach ($data['theme'] as $key => $value) {
            $vars[] = '--wp-' . $key . ': ' . $value . ';';
        }

        return ":root{\n    " . implode("\n    ", $vars) . "\n}";
    }

    public static function to_style_tag(string $scheme, string $id = 'sd-schema-test'): string
    {
        return '<style id="' . esc_attr($id) . '">' . self::to_css($scheme) . '</style>';
    }
}