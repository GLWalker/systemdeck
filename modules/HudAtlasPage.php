<?php
/**
 * SystemDeck HUD Atlas admin page.
 */

declare(strict_types=1);

namespace SystemDeck\Modules;

use SystemDeck\Core\Assets;

if (!defined('ABSPATH')) {
    exit;
}

final class HudAtlasPage
{
    public const PAGE_SLUG = 'sd-hud-atlas';

    /**
     * Normalize an atlas title into a stable anchor id.
     *
     * @param string $title
     * @return string
     */
    private static function anchor_id(string $title): string
    {
        $slug = function_exists('sanitize_title')
            ? sanitize_title($title)
            : strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title));

        return 'sd-hud-atlas-item-' . trim((string) $slug, '-');
    }

    /**
     * Return grouped atlas item reference copy shown under the gallery.
     *
     * @return array<int, array{label:string, summary:string, items:array<int, array{title:string, summary:string}>}>
     */
    private static function hud_elements(): array
    {
        return [
            [
                'label' => 'Primitives',
                'summary' => 'Atomic drawing blocks reused across panels, charts, and controls.',
                'items' => [
                    ['title' => 'Hairline', 'summary' => 'Ultra-thin divider line for subtle separation and quiet section breaks.'],
                    ['title' => 'GlowStroke', 'summary' => 'Outlined frame with a soft glow edge for hover, emphasis, and active states.'],
                    ['title' => 'FocusRing', 'summary' => 'Accessibility and selection ring for keyboard focus and target emphasis.'],
                    ['title' => 'LegendItem', 'summary' => 'Small dot-plus-label marker for compact chart legends and series labeling.'],
                    ['title' => 'StatusDot', 'summary' => 'Tiny circular status indicator for presence lights and simple health states.'],
                    ['title' => 'Divider', 'summary' => 'Simple horizontal rule for splitting content inside panels or grouped items.'],
                    ['title' => 'ButtonFrame', 'summary' => 'Visual shell for button backgrounds and borders behind button text.'],
                    ['title' => 'BadgeFrame', 'summary' => 'Pill-shaped frame for compact tags, badges, and status chips.'],
                    ['title' => 'PlotFrame', 'summary' => 'Chart plotting surface for line, area, and radial chart content.'],
                    ['title' => 'Grid', 'summary' => 'Configurable grid overlay for chart scaffolding and alignment guides.'],
                    ['title' => 'Axis', 'summary' => 'Baseline with ticks for chart scale and measurement divisions.'],
                    ['title' => 'SignalLine', 'summary' => 'Polyline trend stroke for series, sparklines, and directional traces.'],
                    ['title' => 'Ring', 'summary' => 'Circular outline primitive for dials, gauge tracks, and progress rings.'],
                    ['title' => 'Needle', 'summary' => 'Radial pointer primitive for gauges and value-angle indicators.'],
                    ['title' => 'GradientFill', 'summary' => 'Multi-stop gradient fill used for richer chart and surface treatments.'],
                    ['title' => 'ShadowLayer', 'summary' => 'Controlled shadow surface for depth and soft elevation.'],
                    ['title' => 'CornerBadgeAnchor', 'summary' => 'Corner anchor point for alerts, notifications, and status overlays.'],
                ],
            ],
            [
                'label' => 'Components',
                'summary' => 'Self-contained HUD widgets composed from primitives and layout rules.',
                'items' => [
                    ['title' => 'Button', 'summary' => 'Primary action control with label, hover, press, and tone-aware states.'],
                    ['title' => 'IconButton', 'summary' => 'Compact action control that uses an icon instead of text.'],
                    ['title' => 'Spinner', 'summary' => 'Compact loading indicator for inline status and button processing states.'],
                    ['title' => 'Badge', 'summary' => 'Inline pill label for short category or mode tags.'],
                    ['title' => 'StatusBadge', 'summary' => 'Tone-aware status pill for live health and sync-state messaging.'],
                    ['title' => 'StatusPill', 'summary' => 'Compact status label with inline treatment for small readouts.'],
                    ['title' => 'Card', 'summary' => 'Shared card surface with optional header, body, and footer composition.'],
                    ['title' => 'CardHeader', 'summary' => 'Top card cap for titles, subtitles, and optional actions.'],
                    ['title' => 'CardBody', 'summary' => 'Main padded content region for text, metrics, and embedded items.'],
                    ['title' => 'CardFooter', 'summary' => 'Bottom card cap for summary text, state, and actions.'],
                    ['title' => 'CardListGroup', 'summary' => 'Vertical stack of bordered card list rows for grouped content.'],
                    ['title' => 'CardListItem', 'summary' => 'Single bordered list row for use inside a card list group.'],
                    ['title' => 'CardTitle', 'summary' => 'Primary card title text treatment for card headers and bodies.'],
                    ['title' => 'CardSubtitle', 'summary' => 'Secondary card subtitle text treatment for supporting context.'],
                    ['title' => 'CardText', 'summary' => 'Standard body copy treatment for card content.'],
                    ['title' => 'TextTruncate', 'summary' => 'Single-line text treatment that truncates cleanly within a fixed width.'],
                    ['title' => 'Tabs', 'summary' => 'Tabbed navigation surface with an active pane and content region.'],
                    ['title' => 'Accordion', 'summary' => 'Stacked disclosure surface for grouped expandable content sections.'],
                    ['title' => 'Pagination', 'summary' => 'Paged navigation control for moving through multi-page content sets.'],
                    ['title' => 'SectionHeader', 'summary' => 'Reusable section title with optional divider and supporting text.'],
                    ['title' => 'Tooltip', 'summary' => 'Hover helper card for short contextual notes and hints.'],
                    ['title' => 'ProgressBar', 'summary' => 'Simple progress indicator for loading and task completion.'],
                    ['title' => 'DeltaIndicator', 'summary' => 'Directional change display for increases, decreases, and steady movement.'],
                    ['title' => 'TrendIndicator', 'summary' => 'Mini trend signal with arrow and optional sparkline.'],
                    ['title' => 'ValueWithUnit', 'summary' => 'Numeric value display with unit formatting and precision control.'],
                    ['title' => 'ThresholdBar', 'summary' => 'Value bar with explicit threshold markers and breakpoints.'],
                    ['title' => 'RangeIndicator', 'summary' => 'Range visualization for safe, warning, and danger zones.'],
                    ['title' => 'StatRow', 'summary' => 'Aligned key/value stat row for a single metric line.'],
                    ['title' => 'DataList', 'summary' => 'Simple stacked list for short name/value metric groups.'],
                    ['title' => 'KeyValueGrid', 'summary' => 'Two-column key/value grid for compact metric sets.'],
                    ['title' => 'KeyValueList', 'summary' => 'Vertical key/value list for source-style readouts.'],
                    ['title' => 'DataTable', 'summary' => 'Lightweight table for aligned column and row data.'],
                    ['title' => 'TimelineRow', 'summary' => 'Timestamp, value, and status row for event timelines.'],
                    ['title' => 'EventMarker', 'summary' => 'Small labeled event dot used for timeline and chart annotations.'],
                    ['title' => 'HeaderBar', 'summary' => 'Top bar with title, subtitle, and action controls.'],
                    ['title' => 'FooterBar', 'summary' => 'Bottom bar for summary text, status, and footer actions.'],
                    ['title' => 'ActionBar', 'summary' => 'Horizontal control group for button clusters and toolbar actions.'],
                    ['title' => 'InlineGroup', 'summary' => 'Evenly spaced inline item group for compact horizontal composition.'],
                    ['title' => 'PinHeader', 'summary' => 'Pin title bar with icon, label, and optional live status.'],
                    ['title' => 'PinFooter', 'summary' => 'Optional pin footer for actions, status, and summary text.'],
                    ['title' => 'Gauge', 'summary' => 'Radial dial component for a single metric or current value.'],
                    ['title' => 'ClockFace', 'summary' => 'Analog clock face component extracted from the WP clock pin for reusable HUD instrumentation.'],
                    ['title' => 'DigitalReadout', 'summary' => 'Tight digital time/status readout module extracted from the WP clock pin for reusable HUD overlays.'],
                    ['title' => 'Sparkline', 'summary' => 'Tiny history waveform for compact trend previews.'],
                    ['title' => 'MiniTrend', 'summary' => 'Sparkline plus value display for small trend summaries.'],
                ],
            ],
            [
                'label' => 'Charts',
                'summary' => 'Data visualizations built on the shared primitive and component layer.',
                'items' => [
                    ['title' => 'Line', 'summary' => 'Standard line chart for continuous series and trend comparison.'],
                    ['title' => 'AreaChart', 'summary' => 'Filled area chart for series emphasis and volume shape.'],
                    ['title' => 'StackedArea', 'summary' => 'Layered area chart for stacked contribution comparisons.'],
                    ['title' => 'Bar', 'summary' => 'Standard bar chart for category comparison and ranking.'],
                    ['title' => 'MiniBar', 'summary' => 'Compact bar chart for dense micro summaries.'],
                    ['title' => 'Pie', 'summary' => 'Donut-style categorical share chart for proportional breakdowns.'],
                    ['title' => 'RadialGauge', 'summary' => 'Gauge-style radial chart for circular metric readouts.'],
                    ['title' => 'Heatmap', 'summary' => 'Grid heatmap for distribution density and intensity mapping.'],
                ],
            ],
        ];
    }

    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_page']);
    }

    public static function register_page(): void
    {
        $hook = add_submenu_page(
            'options.php',
            'HUD Atlas',
            '',
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_page']
        );

        add_action('admin_enqueue_scripts', static function (string $current_hook) use ($hook): void {
            if ($current_hook === $hook) {
                self::enqueue_assets();
            }
        });
    }

    public static function enqueue_assets(): void
    {
        if (class_exists(Assets::class)) {
            Assets::register_all();
        }

        wp_enqueue_style('dashicons');

        $atlas_css_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'admin-pages/hud-atlas/style.css') ?: SYSTEMDECK_VERSION);
        $atlas_pixi_css_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'admin-pages/hud-atlas/hud-atlas-pixi.css') ?: SYSTEMDECK_VERSION);
        $atlas_scene_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'admin-pages/hud-atlas/pixi-scene.js') ?: SYSTEMDECK_VERSION);
        $atlas_app_ver = (string) (@filemtime(SYSTEMDECK_PATH . 'admin-pages/hud-atlas/app.js') ?: SYSTEMDECK_VERSION);

        wp_register_style('sd-hud-atlas', SYSTEMDECK_URL . 'admin-pages/hud-atlas/style.css', [], $atlas_css_ver);
        wp_register_style('sd-hud-atlas-pixi', SYSTEMDECK_URL . 'admin-pages/hud-atlas/hud-atlas-pixi.css', ['sd-hud-atlas'], $atlas_pixi_css_ver);

        wp_register_script('sd-hud-atlas-pixi-scene', SYSTEMDECK_URL . 'admin-pages/hud-atlas/pixi-scene.js', ['sd-pixi-hud-engine'], $atlas_scene_ver, true);
        wp_register_script('sd-hud-atlas-app', SYSTEMDECK_URL . 'admin-pages/hud-atlas/app.js', ['jquery', 'sd-hud-atlas-pixi-scene'], $atlas_app_ver, true);

        wp_enqueue_style('sd-hud-atlas');
        wp_enqueue_style('sd-hud-atlas-pixi');
        wp_enqueue_script('sd-pixi-vendor');
        wp_enqueue_script('sd-motion-vendor');
        wp_enqueue_script('sd-pixi-mount');
        wp_enqueue_script('sd-pixi-hud-engine');
        wp_enqueue_script('sd-hud-atlas-pixi-scene');
        wp_enqueue_script('sd-hud-atlas-app');
    }

    public static function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('<h1>403 Forbidden</h1><p>SystemDeck: Unauthorized access.</p>', 403);
        }
        ?>
        <div class="wrap sd-hud-atlas-page">
            <h1 class="wp-heading-inline">HUD Atlas</h1>
            <hr class="wp-header-end">

            <div
                class="sd-hud-atlas-module"
                data-widget="hud-atlas"
                data-widget-id="core.hud-atlas"
                data-renderer="pixi"
                data-pixi-enabled="1">
                <div class="sd-hud-atlas-shell" data-role="shell" aria-live="polite">
                    <div class="sd-hud-atlas" data-widget="hud-atlas" data-renderer="pixi">
                        <div class="sd-hud-atlas__pixi-stage" data-role="pixi-stage" aria-hidden="true"></div>
                        <div class="sd-hud-atlas__anchor-layer" data-role="anchors" aria-hidden="true"></div>
                        <div class="sd-hud-atlas__fallback" data-role="fallback">
                            <?php esc_html_e('Loading HUD Atlas...', 'systemdeck'); ?>
                        </div>
                        <noscript class="sd-hud-atlas__fallback">
                            <?php esc_html_e('HUD Atlas requires JavaScript.', 'systemdeck'); ?>
                        </noscript>
                    </div>
                </div>
            </div>

            <section class="sd-hud-atlas-reference" aria-labelledby="sd-hud-atlas-reference-title">
                <h2 id="sd-hud-atlas-reference-title">HUD Elements</h2>
                <p class="sd-hud-atlas-reference__intro">
                    <?php esc_html_e('Quick reference for the reusable HUD items currently shown in the atlas. Click a name to jump to the matching tile.', 'systemdeck'); ?>
                </p>
                <?php foreach (self::hud_elements() as $group) : ?>
                    <section class="sd-hud-atlas-reference__group" aria-labelledby="<?php echo esc_attr(self::anchor_id($group['label'])); ?>">
                        <h3 id="<?php echo esc_attr(self::anchor_id($group['label'])); ?>">
                            <span class="sd-hud-atlas-reference__group-label"><?php echo esc_html($group['label']); ?></span>
                            <span class="sd-hud-atlas-reference__group-summary"><?php echo esc_html($group['summary']); ?></span>
                        </h3>
                        <dl class="sd-hud-atlas-reference__list">
                            <?php foreach ($group['items'] as $item) : ?>
                                <?php $anchor_id = self::anchor_id($item['title']); ?>
                                <?php $row_id = $anchor_id . '-reference'; ?>
                                <div class="sd-hud-atlas-reference__item" id="<?php echo esc_attr($row_id); ?>" data-target="<?php echo esc_attr($anchor_id); ?>">
                                    <dt>
                                        <a href="#<?php echo esc_attr($anchor_id); ?>">
                                            <?php echo esc_html($item['title']); ?>
                                        </a>
                                    </dt>
                                    <dd><?php echo esc_html($item['summary']); ?></dd>
                                </div>
                            <?php endforeach; ?>
                        </dl>
                    </section>
                <?php endforeach; ?>
            </section>
        </div>
        <?php
    }
}
