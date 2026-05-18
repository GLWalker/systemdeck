<?php
/**
 * SystemDeck - AudioMemoryRoute
 *
 * @package SystemDeck
 * @since 3.3.1
 * @file wp-content/plugins/systemdeck/core/Rest/AudioMemoryRoute.php
 * @license GPL-2.0-or-later
 */

declare(strict_types=1);

namespace SystemDeck\Core\Rest;

if (!defined('ABSPATH')) {
    exit;
}

final class AudioMemoryRoute
{
    public static function init(): void
    {
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void
    {
        $namespace = 'systemdeck/v1';

        register_rest_route($namespace, '/audio/defaults/load', [
            'methods' => \WP_REST_Server::CREATABLE,
            'permission_callback' => [self::class, 'permission_check'],
            'callback' => [self::class, 'load_defaults'],
            'args' => self::base_args(),
        ]);

        register_rest_route($namespace, '/audio/defaults/save', [
            'methods' => \WP_REST_Server::CREATABLE,
            'permission_callback' => [self::class, 'permission_check'],
            'callback' => [self::class, 'save_defaults'],
            'args' => array_merge(self::base_args(), [
                'defaults' => [
                    'required' => false,
                ],
            ]),
        ]);

        register_rest_route($namespace, '/audio/profile/load', [
            'methods' => \WP_REST_Server::CREATABLE,
            'permission_callback' => [self::class, 'permission_check'],
            'callback' => [self::class, 'load_profile'],
            'args' => self::profile_args(),
        ]);

        register_rest_route($namespace, '/audio/profile/save', [
            'methods' => \WP_REST_Server::CREATABLE,
            'permission_callback' => [self::class, 'permission_check'],
            'callback' => [self::class, 'save_profile'],
            'args' => array_merge(self::profile_args(), [
                'profile' => [
                    'required' => false,
                ],
            ]),
        ]);
    }

    public static function permission_check(\WP_REST_Request $request): bool|\WP_Error
    {
        if (!current_user_can('read')) {
            return new \WP_Error('sd_forbidden', 'Insufficient permission.', ['status' => 403]);
        }

        $nonce = (string) $request->get_header('X-WP-Nonce');
        if ($nonce === '') {
            return new \WP_Error('sd_nonce_missing', 'Missing REST nonce.', ['status' => 403]);
        }

        if (!wp_verify_nonce($nonce, 'wp_rest')) {
            return new \WP_Error('sd_nonce_invalid', 'Invalid REST nonce.', ['status' => 403]);
        }

        return true;
    }

    private static function base_args(): array
    {
        return [
            'track_hash' => [
                'type' => 'string',
                'required' => false,
                'sanitize_callback' => static function ($value): string {
                    return self::sanitize_track_hash((string) $value);
                },
            ],
        ];
    }

    private static function profile_args(): array
    {
        return [
            'track_hash' => [
                'type' => 'string',
                'required' => true,
                'sanitize_callback' => static function ($value): string {
                    return self::sanitize_track_hash((string) $value, false);
                },
                'validate_callback' => static function ($value): bool {
                    $hash = self::sanitize_track_hash((string) $value, false);
                    return $hash !== '' && $hash !== 'global-default';
                },
            ],
        ];
    }

    private static function sanitize_track_hash(string $value, bool $allow_global_default = true): string
    {
        $raw = strtolower(trim($value));
        if ($raw === '') {
            return $allow_global_default ? 'global-default' : '';
        }
        $clean = preg_replace('/[^a-f0-9]/', '', $raw);
        if (!is_string($clean)) {
            return $allow_global_default ? 'global-default' : '';
        }
        if ($clean === '') {
            return $allow_global_default ? 'global-default' : '';
        }
        return substr($clean, 0, 64);
    }

    private static function current_user_id(): int
    {
        return (int) get_current_user_id();
    }

    private static function validate_object_payload(mixed $payload, string $field): bool|\WP_Error
    {
        if (!is_array($payload)) {
            return new \WP_Error('sd_invalid_payload', sprintf('Invalid %s payload.', $field), ['status' => 400]);
        }

        if (!array_is_list($payload)) {
            return true;
        }

        if ($payload === []) {
            return true;
        }

        return new \WP_Error('sd_invalid_payload', sprintf('Invalid %s payload.', $field), ['status' => 400]);
    }

    public static function load_defaults(\WP_REST_Request $request): \WP_REST_Response
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_audio_defaults';
        $user_id = self::current_user_id();
        $track_hash = self::sanitize_track_hash((string) $request->get_param('track_hash'));

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT defaults_json, updated_at FROM {$table} WHERE user_id = %d AND track_hash = %s LIMIT 1",
                $user_id,
                $track_hash
            ),
            ARRAY_A
        );

        if (!is_array($row)) {
            return new \WP_REST_Response([
                'success' => true,
                'user_id' => $user_id,
                'track_hash' => $track_hash,
                'defaults' => null,
                'profile' => null,
            ], 200);
        }

        return new \WP_REST_Response([
            'success' => true,
            'user_id' => $user_id,
            'track_hash' => $track_hash,
            'defaults' => json_decode((string) ($row['defaults_json'] ?? 'null'), true),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ], 200);
    }

    public static function save_defaults(\WP_REST_Request $request): \WP_REST_Response
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_audio_defaults';
        $user_id = self::current_user_id();
        $track_hash = self::sanitize_track_hash((string) $request->get_param('track_hash'));
        $payload = $request->get_param('defaults');
        if ($payload === null) {
            $payload = [];
        }
        $validation = self::validate_object_payload($payload, 'defaults');
        if (is_wp_error($validation)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => $validation->get_error_message(),
            ], 400);
        }

        $result = $wpdb->query(
            $wpdb->prepare(
                "INSERT INTO {$table} (user_id, track_hash, defaults_json) VALUES (%d, %s, %s)
                 ON DUPLICATE KEY UPDATE defaults_json = VALUES(defaults_json), updated_at = CURRENT_TIMESTAMP",
                $user_id,
                $track_hash,
                wp_json_encode($payload)
            )
        );

        if ($result === false) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Failed to save defaults.',
            ], 500);
        }

        return new \WP_REST_Response([
            'success' => true,
            'user_id' => $user_id,
            'track_hash' => $track_hash,
            'defaults' => $payload,
        ], 200);
    }

    public static function load_profile(\WP_REST_Request $request): \WP_REST_Response
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_audio_profiles';
        $user_id = self::current_user_id();
        $track_hash = self::sanitize_track_hash((string) $request->get_param('track_hash'), false);
        if ($track_hash === '' || $track_hash === 'global-default') {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Valid track_hash is required for profile routes.',
            ], 400);
        }

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT profile_json, updated_at FROM {$table} WHERE user_id = %d AND track_hash = %s LIMIT 1",
                $user_id,
                $track_hash
            ),
            ARRAY_A
        );

        if (!is_array($row)) {
            return new \WP_REST_Response([
                'success' => true,
                'user_id' => $user_id,
                'track_hash' => $track_hash,
                'profile' => null,
            ], 200);
        }

        return new \WP_REST_Response([
            'success' => true,
            'user_id' => $user_id,
            'track_hash' => $track_hash,
            'profile' => json_decode((string) ($row['profile_json'] ?? 'null'), true),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ], 200);
    }

    public static function save_profile(\WP_REST_Request $request): \WP_REST_Response
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sd_audio_profiles';
        $user_id = self::current_user_id();
        $track_hash = self::sanitize_track_hash((string) $request->get_param('track_hash'), false);
        if ($track_hash === '' || $track_hash === 'global-default') {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Valid track_hash is required for profile routes.',
            ], 400);
        }
        $payload = $request->get_param('profile');
        if ($payload === null) {
            $payload = [];
        }
        $validation = self::validate_object_payload($payload, 'profile');
        if (is_wp_error($validation)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => $validation->get_error_message(),
            ], 400);
        }

        $result = $wpdb->query(
            $wpdb->prepare(
                "INSERT INTO {$table} (user_id, track_hash, profile_json) VALUES (%d, %s, %s)
                 ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), updated_at = CURRENT_TIMESTAMP",
                $user_id,
                $track_hash,
                wp_json_encode($payload)
            )
        );

        if ($result === false) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Failed to save profile.',
            ], 500);
        }

        return new \WP_REST_Response([
            'success' => true,
            'user_id' => $user_id,
            'track_hash' => $track_hash,
            'profile' => $payload,
        ], 200);
    }
}
