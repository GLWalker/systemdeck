<?php

declare(strict_types=1);

namespace SystemDeck\Widgets;

if (!defined('ABSPATH')) {
    exit;
}

final class Player extends BaseWidget
{
    public const ID = 'core.player';
    public const TITLE = 'Player System';
    public const ICON = 'dashicons-controls-volumeon';

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function pin_definitions(): array
    {
        return [
            [
                'id' => 'widget_player_stop_audio',
                'label' => 'Stop Audio',
                'type' => 'control',
                'source' => [
                    'kind' => 'widget',
                    'authority' => self::ID,
                    'id' => 'stop_audio',
                ],
                'category' => 'media',
                'renderer' => 'dom',
                'description' => 'Send a stop command to the shared Player System.',
                'icon' => 'dashicons-controls-stop',
                'tags' => ['player', 'audio', 'widget'],
                'pin_safe' => true,
                'defaults' => [
                    'size' => '1x1',
                    'design_template' => 'default',
                ],
                'meta' => [
                    'pin_kind' => 'widget_control_pin',
                    'action' => 'player_stop',
                    'value_label' => 'Stop',
                ],
            ],
        ];
    }

    public static function assets(): array
    {
        return [
            'css' => ['style.css'],
            'js' => ['sd-audio-engine', 'app.js'],
        ];
    }

    protected static function output(array $context): void
    {
        $workspace_id = sanitize_text_field((string) ($context['workspace_id'] ?? ''));
?>
        <div class="sd-player-root" data-workspace-id="<?php echo esc_attr($workspace_id); ?>">
            <div class="sd-player-now" data-role="now-playing" data-title>
                <?php esc_html_e('No source loaded.', 'systemdeck'); ?>
            </div>

            <div class="sd-player-status-wrap">
                <span class="sd-status-badge is-low" data-role="status" data-status><?php esc_html_e('Idle', 'systemdeck'); ?></span>
            </div>

            <div class="sd-player-transport" role="toolbar" aria-label="<?php esc_attr_e('Playback controls', 'systemdeck'); ?>">
                <button type="button" class="button" data-action="prev"><?php esc_html_e('Prev', 'systemdeck'); ?></button>
                <button type="button" class="button button-primary" data-action="play"><?php esc_html_e('Play', 'systemdeck'); ?></button>
                <button type="button" class="button" data-action="pause"><?php esc_html_e('Pause', 'systemdeck'); ?></button>
                <button type="button" class="button" data-action="stop"><?php esc_html_e('Stop', 'systemdeck'); ?></button>
                <button type="button" class="button" data-action="next"><?php esc_html_e('Next', 'systemdeck'); ?></button>
            </div>

            <div class="sd-player-progress-row">
                <input type="range" min="0" max="1" step="0.001" value="0" data-role="seek" data-timeline aria-label="<?php esc_attr_e('Seek', 'systemdeck'); ?>">
                <div class="sd-player-time" data-role="time">
                    <span data-time>0:00</span> / <span data-duration>0:00</span>
                </div>
            </div>

            <div class="sd-player-controls-grid" data-track-controls>
                <label>
                    <?php esc_html_e('Volume', 'systemdeck'); ?>
                    <input type="range" min="0" max="1" step="0.01" value="0.45" data-role="volume" data-control="volume">
                </label>

                <label>
                    <input type="checkbox" data-role="bass-boost" data-control="bass">
                    <?php esc_html_e('Bass Boost', 'systemdeck'); ?>
                </label>
            </div>

            <div class="sd-player-eq-row" data-role="eq-row">
                <label>
                    <?php esc_html_e('Bass', 'systemdeck'); ?>
                    <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value="100"
                        data-role="mix-bass"
                        aria-label="<?php esc_attr_e('Bass mix', 'systemdeck'); ?>">
                </label>

                <label>
                    <?php esc_html_e('Synth', 'systemdeck'); ?>
                    <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value="100"
                        data-role="mix-synth"
                        aria-label="<?php esc_attr_e('Synth mix', 'systemdeck'); ?>">
                </label>

                <label>
                    <?php esc_html_e('Drums', 'systemdeck'); ?>
                    <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value="100"
                        data-role="mix-drums"
                        aria-label="<?php esc_attr_e('Drums mix', 'systemdeck'); ?>">
                </label>
            </div>

            <div class="sd-player-load-row">
                <button type="button" class="button" data-action="load"><?php esc_html_e('Load', 'systemdeck'); ?></button>
                <input type="file" accept="audio/*,.mid,.midi" data-role="file-input" hidden>
            </div>

            <div class="sd-player-queue" data-role="queue"></div>
            <div class="sd-player-error" data-role="error" hidden></div>
        </div>
<?php
    }
}
