<?php
declare(strict_types=1);

namespace SystemDeck\Core\Services;

if (!defined('ABSPATH')) {
    exit;
}

final class PinRegistry
{
    /**
     * Canonical normalized pin definition shape.
     *
     * [
     *   'id' => string,
     *   'label' => string,
     *   'type' => 'metric'|'html'|'control'|'custom',
     *   'source' => [
     *     'kind' => 'core'|'metric'|'widget'|'app'|'third_party',
     *     'authority' => string,
     *     'id' => string,
     *   ],
     *   'category' => string,
     *   'renderer' => string,
     *   'description' => string,
     *   'icon' => string,
     *   'tags' => array<int,string>,
     *   'pin_safe' => bool,
     *   'metric_key' => string,
     *   'defaults' => [
     *     'size' => string,
     *     'design_template' => string,
     *   ],
     *   'meta' => array<string,mixed>,
     * ]
     *
     * Ownership:
     * - PinRegistry owns the definition record for what a pin is.
     * - PinRegistry does not own persistence, rendering, live metric values, picker UX,
     *   workspace placement, or runtime creation flows.
     */
    private const DEFINITION_FIELDS = [
        'id',
        'label',
        'type',
        'source',
        'category',
        'renderer',
        'description',
        'icon',
        'tags',
        'pin_safe',
        'metric_key',
        'defaults',
        'meta',
    ];

    private const ALLOWED_TYPES = ['metric', 'html', 'control', 'custom'];
    private const ALLOWED_SOURCE_KINDS = ['core', 'metric', 'widget', 'app', 'third_party'];

    /**
     * @var array<string,array<string,mixed>>
     */
    private static array $registered = [];

    /**
     * Register one authoritative pin definition.
     *
     * This is safe to expose now because nothing consumes it yet. Future providers
     * can register standalone pins without being forced through MetricRegistry.
     *
     * @param array<string,mixed> $definition
     */
    public static function register(array $definition): bool
    {
        $normalized = self::normalize_definition($definition);
        if ($normalized === null) {
            return false;
        }

        self::$registered[$normalized['id']] = $normalized;
        return true;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function get_all(): array
    {
        $indexed = [];

        foreach (self::build_core_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        foreach (self::build_metric_backed_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        // Advanced lane definitions intentionally load after metric-backed defaults
        // so specialized pin folders can override generic metric pin entries.
        foreach (self::collect_advanced_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        foreach (self::collect_widget_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        foreach (self::collect_app_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        foreach (self::$registered as $id => $definition) {
            $indexed[$id] = $definition;
        }

        foreach (self::collect_third_party_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }
            $indexed[$normalized['id']] = $normalized;
        }

        return array_values($indexed);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function get_pin_safe(): array
    {
        return array_values(array_filter(
            self::get_all(),
            static fn(array $definition): bool => !empty($definition['pin_safe'])
        ));
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_pin_safe_indexed(): array
    {
        $indexed = [];
        foreach (self::get_pin_safe() as $definition) {
            $id = (string) ($definition['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $indexed[$id] = $definition;
        }

        return $indexed;
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_all_indexed(): array
    {
        $indexed = [];
        foreach (self::get_all() as $definition) {
            $id = (string) ($definition['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $indexed[$id] = $definition;
        }

        return $indexed;
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function get_definition(string $id): ?array
    {
        $normalized_id = self::normalize_identifier($id);
        if ($normalized_id === '') {
            return null;
        }

        $indexed = self::get_all_indexed();
        return $indexed[$normalized_id] ?? null;
    }

    /**
     * Resolve the canonical metric-backed pin definition for a metric key.
     *
     * PinRegistry owns the pin-definition semantics. MetricRegistry remains the
     * authority for metric rows and live metric metadata.
     *
     * @return array<string,mixed>|null
     */
    public static function get_metric_definition(string $metric_key): ?array
    {
        $normalized_metric_key = trim($metric_key);
        if ($normalized_metric_key === '') {
            return null;
        }

        foreach (self::build_metric_backed_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }

            if ((string) ($normalized['metric_key'] ?? '') === $normalized_metric_key) {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public static function get_metric_definitions_indexed(): array
    {
        $indexed = [];

        foreach (self::build_metric_backed_pin_definitions() as $definition) {
            $normalized = self::normalize_definition($definition);
            if ($normalized === null) {
                continue;
            }

            $metric_key = (string) ($normalized['metric_key'] ?? '');
            if ($metric_key === '') {
                continue;
            }

            $indexed[$metric_key] = $normalized;
        }

        return $indexed;
    }

    /**
     * Build the existing runtime pin payload shape from the canonical definition.
     *
     * @param array<string,mixed> $metric
     * @return array<string,mixed>|null
     */
    public static function build_metric_pin_payload(array $metric, int $author_id = 0): ?array
    {
        $definition = self::build_metric_backed_pin_definition($metric);
        if ($definition === null || empty($definition['pin_safe'])) {
            return null;
        }

        return self::build_pin_payload_from_definition($definition, $author_id, $metric);
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function build_pin_payload(string $definition_id, int $author_id = 0): ?array
    {
        $definition = self::get_definition($definition_id);
        if (!is_array($definition) || empty($definition['pin_safe'])) {
            return null;
        }

        return self::build_pin_payload_from_definition($definition, $author_id);
    }

    /**
     * @param array<string,mixed> $definition
     * @param array<string,mixed> $metric
     * @return array<string,mixed>|null
     */
    public static function build_pin_payload_from_definition(array $definition, int $author_id = 0, array $metric = []): ?array
    {
        $normalized = self::normalize_definition($definition);
        if ($normalized === null || empty($normalized['pin_safe'])) {
            return null;
        }

        $type = (string) ($normalized['type'] ?? 'custom');
        $metric_key = (string) ($normalized['metric_key'] ?? '');
        $size = (string) (($normalized['defaults']['size'] ?? '1x1'));
        [$w, $h] = self::parse_size($size);
        $label = (string) ($normalized['label'] ?? $metric_key);
        $renderer = (string) ($normalized['renderer'] ?? 'dom');
        $icon = (string) ($normalized['icon'] ?? 'dashicons-admin-generic');
        $category = (string) ($normalized['category'] ?? 'custom');
        $description = (string) ($normalized['description'] ?? '');
        $design_template = (string) (($normalized['defaults']['design_template'] ?? 'default'));
        $family = sanitize_text_field((string) ($metric['family'] ?? ($normalized['meta']['metric_family'] ?? '')));
        $authority = sanitize_text_field((string) ($metric['authority'] ?? ($normalized['meta']['metric_authority'] ?? '')));
        $mode = sanitize_text_field((string) ($metric['mode'] ?? ($normalized['meta']['metric_mode'] ?? '')));
        $source_widget = $type === 'metric' ? 'systemdeck.metric-registry' : 'systemdeck.pin-registry';
        $pin_kind = $type === 'metric'
            ? 'metric_pin'
            : (sanitize_key((string) ($normalized['meta']['pin_kind'] ?? 'platform_control_pin')) ?: 'platform_control_pin');
        $source = is_array($normalized['source'] ?? null) ? $normalized['source'] : [];
        $workspace_id = sanitize_key((string) ($normalized['meta']['workspace_id'] ?? ''));

        $settings = [
            'type' => $type,
            'label' => $label,
            'value' => '',
            'value_label' => sanitize_text_field((string) ($normalized['meta']['value_label'] ?? '')),
            'icon' => $icon,
            'source_widget' => $source_widget,
            'metric_key' => $metric_key,
            'metric_family' => $family,
            'metric_authority' => $authority,
            'metric_mode' => $mode,
            'category' => $category,
            'description' => $description,
            'pin_definition_id' => (string) ($normalized['id'] ?? ''),
            'pin_source_kind' => (string) ($source['kind'] ?? ''),
            'pin_source_authority' => (string) ($source['authority'] ?? ''),
            'pin_source_id' => (string) ($source['id'] ?? ''),
            'action' => sanitize_key((string) ($normalized['meta']['action'] ?? '')),
            'workspace_id' => $workspace_id,
            'grid_span' => $size,
            'renderer' => $renderer,
            'design_template' => $design_template,
            'pin_kind' => $pin_kind,
            'sticky_level' => 'low',
            'author_id' => max(0, $author_id),
        ];

        return [
            'id' => (string) ($normalized['id'] ?? ''),
            'type' => $type,
            'size' => $size,
            'renderer' => $renderer,
            'title' => $label,
            'data' => [
                'label' => $label,
                'metric_key' => $metric_key,
                'metric_family' => $family,
                'metric_authority' => $authority,
                'metric_mode' => $mode,
                'category' => $category,
                'description' => $description,
                'icon' => $icon,
                'source_widget' => $source_widget,
                'pin_kind' => $pin_kind,
                'author_id' => max(0, $author_id),
                'pin_definition_id' => (string) ($normalized['id'] ?? ''),
                'pin_source_kind' => (string) ($source['kind'] ?? ''),
                'pin_source_authority' => (string) ($source['authority'] ?? ''),
                'pin_source_id' => (string) ($source['id'] ?? ''),
                'action' => sanitize_key((string) ($normalized['meta']['action'] ?? '')),
                'workspace_id' => $workspace_id,
                'value_label' => sanitize_text_field((string) ($normalized['meta']['value_label'] ?? '')),
            ],
            'design_template' => $design_template,
            'settings' => $settings,
            'x' => 0,
            'y' => 0,
            'w' => $w,
            'h' => $h,
            'is_pinned' => 1,
        ];
    }

    /**
     * @param array<string,mixed> $definition
     * @return array<string,mixed>|null
     */
    public static function normalize_definition(array $definition): ?array
    {
        $id = self::normalize_identifier((string) ($definition['id'] ?? ''));
        $label = sanitize_text_field((string) ($definition['label'] ?? ''));
        $type = sanitize_key((string) ($definition['type'] ?? 'custom'));
        $category = sanitize_key((string) ($definition['category'] ?? 'custom'));
        $renderer = sanitize_key((string) ($definition['renderer'] ?? ''));
        $description = sanitize_text_field((string) ($definition['description'] ?? ''));
        $icon = sanitize_html_class((string) ($definition['icon'] ?? 'dashicons-admin-generic'));
        $pin_safe = !empty($definition['pin_safe']);
        $metric_key = trim((string) ($definition['metric_key'] ?? ''));

        if ($id === '' || $label === '' || $renderer === '') {
            return null;
        }

        if (!in_array($type, self::ALLOWED_TYPES, true)) {
            return null;
        }

        $source = self::normalize_source($definition['source'] ?? []);
        if ($source === null) {
            return null;
        }

        if ($type === 'metric' && $metric_key === '') {
            return null;
        }

        if ($type !== 'metric') {
            $metric_key = '';
        }

        $tags = [];
        if (isset($definition['tags']) && is_array($definition['tags'])) {
            foreach ($definition['tags'] as $tag) {
                $normalized_tag = sanitize_key((string) $tag);
                if ($normalized_tag !== '') {
                    $tags[] = $normalized_tag;
                }
            }
        }

        $defaults = self::normalize_defaults($definition['defaults'] ?? []);
        $meta = is_array($definition['meta'] ?? null) ? $definition['meta'] : [];

        return [
            'id' => $id,
            'label' => $label,
            'type' => $type,
            'source' => $source,
            'category' => $category !== '' ? $category : 'custom',
            'renderer' => $renderer,
            'description' => $description,
            'icon' => $icon !== '' ? $icon : 'dashicons-admin-generic',
            'tags' => array_values(array_unique($tags)),
            'pin_safe' => $pin_safe,
            'metric_key' => $metric_key,
            'defaults' => $defaults,
            'meta' => $meta,
        ];
    }

    /**
     * Core standalone pins are first-class platform primitives owned by PinRegistry.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function build_core_pin_definitions(): array
    {
        $base_pin_file = trailingslashit((string) SYSTEMDECK_PATH) . 'pins/pin.php';
        if (file_exists($base_pin_file)) {
            require_once $base_pin_file;
        }

        if (class_exists('\\SystemDeck\\Pins\\BasePinRuntime') && method_exists('\\SystemDeck\\Pins\\BasePinRuntime', 'definitions')) {
            $provided = \SystemDeck\Pins\BasePinRuntime::definitions();
            if (is_array($provided)) {
                return array_values(array_filter($provided, static fn($row): bool => is_array($row)));
            }
        }

        return [];
    }

    /**
     * Discover advanced pin folder definitions from pins/<folder>/pin.php files.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function collect_advanced_pin_definitions(): array
    {
        $base_dir = trailingslashit((string) SYSTEMDECK_PATH) . 'pins';
        if (!is_dir($base_dir)) {
            return [];
        }

        $folders = glob($base_dir . '/*', GLOB_ONLYDIR) ?: [];
        $definitions = [];

        foreach ($folders as $folder_path) {
            $folder_name = basename((string) $folder_path);
            if ($folder_name === '' || $folder_name === '.' || $folder_name === '..') {
                continue;
            }

            $pin_file = trailingslashit((string) $folder_path) . 'pin.php';
            if (!file_exists($pin_file)) {
                continue;
            }

            require_once $pin_file;

            $runtime_class = '\\SystemDeck\\Pins\\' . self::folder_to_runtime_namespace($folder_name) . '\\PinRuntime';
            if (!class_exists($runtime_class) || !method_exists($runtime_class, 'definitions')) {
                continue;
            }

            $provided = $runtime_class::definitions();
            if (!is_array($provided)) {
                continue;
            }

            foreach ($provided as $definition) {
                if (!is_array($definition)) {
                    continue;
                }
                $definition['meta'] = is_array($definition['meta'] ?? null) ? $definition['meta'] : [];
                $definition['meta']['runtime_class'] = $runtime_class;
                $definition['meta']['runtime_folder'] = sanitize_key($folder_name);
                $definitions[] = $definition;
            }
        }

        return $definitions;
    }

    private static function folder_to_runtime_namespace(string $folder_name): string
    {
        $parts = preg_split('/[^a-zA-Z0-9]+/', $folder_name) ?: [];
        $segments = array_filter(array_map(static fn(string $part): string => ucfirst(strtolower($part)), $parts));
        return implode('', $segments) ?: 'Pin';
    }

    /**
     * Metric-backed pin definitions are derived here from MetricRegistry rows.
     *
     * PinRegistry owns definition semantics. MetricRegistry still owns the
     * metric catalog, live values, and pin-safe eligibility.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function build_metric_backed_pin_definitions(): array
    {
        if (!class_exists(MetricRegistry::class)) {
            return [];
        }

        $definitions = [];
        foreach (MetricRegistry::get_pin_safe() as $metric) {
            $definition = self::build_metric_backed_pin_definition($metric);
            if ($definition !== null) {
                $definitions[] = $definition;
            }
        }

        return $definitions;
    }

    /**
     * Widget providers may contribute pin definitions, but PinRegistry remains
     * the authority for normalization, discovery, and picker exposure.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function collect_widget_pin_definitions(): array
    {
        if (!class_exists(RegistryService::class)) {
            return [];
        }

        $definitions = [];
        $snapshot = RegistryService::get_snapshot();
        $widgets = is_array($snapshot['widgets'] ?? null) ? $snapshot['widgets'] : [];

        foreach ($widgets as $widget) {
            if (!is_array($widget)) {
                continue;
            }

            $class = (string) ($widget['class'] ?? '');
            $file = (string) ($widget['file'] ?? '');

            if ($class !== '' && !class_exists($class) && $file !== '' && file_exists($file)) {
                require_once $file;
            }

            if ($class === '' || !class_exists($class) || !method_exists($class, 'pin_definitions')) {
                continue;
            }

            $provided = $class::pin_definitions();
            if (!is_array($provided)) {
                continue;
            }

            foreach ($provided as $definition) {
                if (is_array($definition)) {
                    $definitions[] = $definition;
                }
            }
        }

        return $definitions;
    }

    /**
     * App providers may contribute pin definitions through the app runtime
     * registry, but PinRegistry still owns the pin-definition authority.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function collect_app_pin_definitions(): array
    {
        if (!class_exists('\\SystemDeck\\Core\\AppRuntime')) {
            return [];
        }

        $apps = \SystemDeck\Core\AppRuntime::get_registered_apps();
        $definitions = apply_filters('systemdeck_app_pin_registry_collect', [], [
            'apps' => $apps,
            'definition_fields' => self::DEFINITION_FIELDS,
            'allowed_types' => self::ALLOWED_TYPES,
            'allowed_source_kinds' => self::ALLOWED_SOURCE_KINDS,
        ]);

        return is_array($definitions) ? array_values($definitions) : [];
    }

    /**
     * Third-party standalone pins can register directly through this filter
     * without pretending to be metrics, widgets, or apps.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function collect_third_party_pin_definitions(): array
    {
        $definitions = apply_filters('systemdeck_pin_registry_collect', [], [
            'definition_fields' => self::DEFINITION_FIELDS,
            'allowed_types' => self::ALLOWED_TYPES,
            'allowed_source_kinds' => self::ALLOWED_SOURCE_KINDS,
        ]);

        return is_array($definitions) ? array_values($definitions) : [];
    }

    /**
     * @param mixed $source
     * @return array<string,string>|null
     */
    private static function normalize_source($source): ?array
    {
        if (!is_array($source)) {
            return null;
        }

        $kind = sanitize_key((string) ($source['kind'] ?? ''));
        $authority = sanitize_key((string) ($source['authority'] ?? ''));
        $id = self::normalize_identifier((string) ($source['id'] ?? ''));

        if ($kind === '' || $authority === '' || $id === '') {
            return null;
        }

        if (!in_array($kind, self::ALLOWED_SOURCE_KINDS, true)) {
            return null;
        }

        return [
            'kind' => $kind,
            'authority' => $authority,
            'id' => $id,
        ];
    }

    /**
     * @param mixed $defaults
     * @return array<string,string>
     */
    private static function normalize_defaults($defaults): array
    {
        if (!is_array($defaults)) {
            $defaults = [];
        }

        $size = preg_replace('/[^0-9x]/', '', (string) ($defaults['size'] ?? '2x1'));
        if (!is_string($size) || $size === '') {
            $size = '2x1';
        }

        $design_template = sanitize_key((string) ($defaults['design_template'] ?? 'default'));
        if ($design_template === '') {
            $design_template = 'default';
        }

        return [
            'size' => $size,
            'design_template' => $design_template,
        ];
    }

    /**
     * @param array<string,mixed> $metric
     * @return array<string,mixed>|null
     */
    private static function build_metric_backed_pin_definition(array $metric): ?array
    {
        $metric_key = trim((string) ($metric['key'] ?? ''));
        if ($metric_key === '' || empty($metric['pin_safe'])) {
            return null;
        }

        $renderer = 'dom';
        $size = '2x1';
        if ($metric_key === 'wp.metrics.env.wp_time') {
            $renderer = 'metric_clock_analog';
            $size = '2x2';
        }
        $pin_id = 'metric_' . preg_replace('/[^a-z0-9_-]/i', '_', $metric_key);
        $label = sanitize_text_field((string) ($metric['label'] ?? $metric_key));
        $icon = sanitize_html_class((string) ($metric['icon'] ?? 'dashicons-admin-generic'));
        $category = sanitize_key((string) ($metric['category'] ?? 'custom'));
        $description = sanitize_text_field((string) ($metric['description'] ?? ''));
        $family = sanitize_key((string) ($metric['family'] ?? 'metric'));
        $authority = sanitize_key((string) ($metric['authority'] ?? 'systemdeck'));

        return [
            'id' => $pin_id,
            'label' => $label,
            'type' => 'metric',
            'source' => [
                'kind' => 'metric',
                'authority' => $authority !== '' ? $authority : 'systemdeck',
                'id' => $metric_key,
            ],
            'category' => $category !== '' ? $category : 'custom',
            'renderer' => $renderer,
            'description' => $description,
            'icon' => $icon !== '' ? $icon : 'dashicons-admin-generic',
            'tags' => array_values(array_filter([$family, $category])),
            'pin_safe' => true,
            'metric_key' => $metric_key,
            'defaults' => [
                'size' => $size,
                'design_template' => 'default',
            ],
            'meta' => [
                'metric_family' => $family,
                'metric_authority' => $authority,
                'metric_mode' => sanitize_key((string) ($metric['mode'] ?? '')),
                'action' => '',
                'value_label' => '',
            ],
        ];
    }

    /**
     * @return array{0:int,1:int}
     */
    private static function parse_size(string $size): array
    {
        $parts = explode('x', $size);
        $w = max(1, (int) ($parts[0] ?? 1));
        $h = max(1, (int) ($parts[1] ?? 1));

        return [$w, $h];
    }

    private static function normalize_identifier(string $value): string
    {
        return (string) preg_replace('/[^a-z0-9._-]/', '', strtolower(trim($value)));
    }
}
