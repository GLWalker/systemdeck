<?php

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class Router
 *
 * A lightweight, high-performance request handler that bypasses admin-ajax.php.
 * Usage: GET/POST to /?sd_action=endpoint_name
 */
class Router
{
    private $endpoints = [];

    public function __construct()
    {
        // Hook early to catch requests
        add_action('parse_request', [$this, 'handle_request'], 1);

        // Register default internal endpoints
        $this->register_endpoint('ping', [$this, 'handle_ping']);
        $this->register_endpoint('get_manifest', [$this, 'handle_get_manifest']);
        $this->register_endpoint('save_layout', [$this, 'handle_save_layout']);
        $this->register_endpoint('save_proxy_selection', [$this, 'handle_save_proxy_selection']);
        $this->register_endpoint('get_active_proxies', [$this, 'handle_get_active_proxies']);
        $this->register_endpoint('create_workspace', [$this, 'handle_create_workspace']);
        $this->register_endpoint('delete_workspace', [$this, 'handle_delete_workspace']);
        $this->register_endpoint('rename_workspace', [$this, 'handle_rename_workspace']);
        $this->register_endpoint('update_workspace_order', [$this, 'handle_update_workspace_order']);

        // Notes Endpoints are now registered by the Notes widget itself during init()
        // This prevents class-not-found errors during early Router construction

        $this->register_endpoint('get_telemetry', [$this, 'handle_get_telemetry']);
    }

    /**
     * Endpoint: Get Telemetry Data
     */
    private function handle_get_telemetry($request): array
    {
        if (!class_exists('\\SystemDeck\\Core\\Telemetry')) {
            throw new \Exception('Telemetry module missing');
        }

        $mode = sanitize_key($request['mode'] ?? 'runtime');

        if ($mode === 'full') {
            return [
                'mode' => 'full',
                'raw' => \SystemDeck\Core\Telemetry::get_raw_metrics(),
                'formatted' => \SystemDeck\Core\Telemetry::get_all_metrics(),
            ];
        }

        return [
            'mode' => 'runtime',
            'raw' => \SystemDeck\Core\Telemetry::get_runtime_metrics(),
        ];
    }

    /**
     * Endpoint: Create Workspace
     */
    private function handle_create_workspace($request): array
    {
        $name = sanitize_text_field($request['name'] ?? '');
        if (!$name)
            throw new \Exception('Invalid Name');

        $user_id = (int) get_current_user_id();
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        $id = 'ws_' . uniqid();
        $max_order = 0;
        foreach ($workspaces as $ws) {
            if (is_array($ws) && isset($ws['order']) && $ws['order'] > $max_order)
                $max_order = $ws['order'];
        }

        $workspaces[$id] = [
            'id' => $id,
            'name' => $name,
            'widgets' => [],
            'created' => current_time('mysql'),
            'order' => $max_order + 1
        ];

        // Handle Pre-Populated Layout
        $layout_json = $request['layout'] ?? '';
        if ($layout_json) {
            $layout = json_decode(stripslashes($layout_json), true);
            if (is_array($layout)) {
                $context = new Context($user_id, $id);
                StorageEngine::save('layout', $layout, $context);
                $widget_ids = [];
                foreach ($layout as $item) {
                    if (($item['type'] ?? '') === 'widget')
                        $widget_ids[] = $item['id'];
                }
                $workspaces[$id]['widgets'] = $widget_ids;
            }
        }

        update_user_meta($user_id, 'sd_workspaces', $workspaces);

        return ['message' => 'Created', 'workspace' => $workspaces[$id]];
    }

    /**
     * Endpoint: Delete Workspace
     */
    private function handle_delete_workspace($request): array
    {
        $workspace_id = Registry::resolve_workspace_id($request['workspace_id'] ?? '');
        if ($workspace_id === 'default')
            throw new \Exception('Cannot delete default');

        $user_id = (int) get_current_user_id();
        $workspaces = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        if (isset($workspaces[$workspace_id])) {
            unset($workspaces[$workspace_id]);
            update_user_meta($user_id, 'sd_workspaces', $workspaces);
            return ['message' => 'Deleted'];
        }
        throw new \Exception('Workspace not found');
    }

    /**
     * Endpoint: Rename Workspace
     */
    private function handle_rename_workspace($request): array
    {
        $id = Registry::resolve_workspace_id($request['workspace_id'] ?? '');
        $name = sanitize_text_field($request['name'] ?? '');

        $user_id = (int) get_current_user_id();
        $ws = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        if (isset($ws[$id])) {
            $ws[$id]['name'] = $name;
            update_user_meta($user_id, 'sd_workspaces', $ws);
            return ['message' => 'Renamed'];
        }
        throw new \Exception('Workspace not found');
    }

    /**
     * Endpoint: Update Workspace Order
     */
    private function handle_update_workspace_order($request): array
    {
        $order = $request['order'] ?? [];
        if (!is_array($order))
            $order = json_decode(stripslashes((string) $order), true);

        $user_id = (int) get_current_user_id();
        $ws = get_user_meta($user_id, 'sd_workspaces', true) ?: [];

        foreach ($order as $idx => $id) {
            if (isset($ws[$id]))
                $ws[$id]['order'] = $idx;
        }
        update_user_meta($user_id, 'sd_workspaces', $ws);
        return ['message' => 'Order updated'];
    }

    /**
     * Endpoint: Get Active Proxy Widgets
     */
    private function handle_get_active_proxies($request): array
    {
        $user_id = (int) get_current_user_id();
        $proxies = get_user_meta($user_id, 'sd_active_proxy_widgets', true) ?: [];
        return ['proxies' => $proxies];
    }

    /**
     * Endpoint: Get Workspace Manifest
     */
    private function handle_get_manifest($request): array
    {
        $workspace_id = Registry::resolve_workspace_id($request['workspaceId'] ?? 'default');

        if (!class_exists('\\SystemDeck\\Core\\Registry')) {
            throw new \Exception('Registry class missing');
        }

        return Registry::instance()->hydrate_manifest($workspace_id);
    }

    /**
     * Endpoint: Save Workspace Layout
     */
    private function handle_save_layout($request): array
    {
        $workspace_id = Registry::resolve_workspace_id($request['workspaceId'] ?? 'default');
        $layout = isset($request['layout']) ? json_decode(stripslashes($request['layout']), true) : [];
        $user_id = (int) get_current_user_id();

        if (!class_exists('\\SystemDeck\\Core\\StorageEngine') || !class_exists('\\SystemDeck\\Core\\Context')) {
            throw new \Exception('Storage dependencies missing');
        }

        $context = new Context($user_id, $workspace_id);
        StorageEngine::save('layout', $layout, $context);

        return ['message' => 'Layout saved', 'workspaceId' => $workspace_id];
    }

    /**
     * Endpoint: Save Dashboard Proxy Selection
     */
    private function handle_save_proxy_selection($request): array
    {
        $widgets = isset($request['widgets']) ? (array) $request['widgets'] : [];
        $clean_widgets = array_map('sanitize_text_field', $widgets);

        update_user_meta((int) get_current_user_id(), 'sd_active_proxy_widgets', $clean_widgets);

        return ['message' => 'Proxy selection updated', 'count' => count($clean_widgets)];
    }

    /**
     * Register a custom endpoint.
     *
     * @param string   $action   The action name (e.g., 'save_layout')
     * @param callable $callback The function to call. Must return array (for JSON) or void.
     * @param bool     $public   Whether this endpoint is public (no capability check). Default false.
     */
    public function register_endpoint(string $action, callable $callback, bool $public = false): void
    {
        $this->endpoints[$action] = [
            'callback' => $callback,
            'public' => $public
        ];
    }

    public function handle_request($wp): void
    {
        if (!isset($_REQUEST['sd_action'])) {
            return;
        }

        $action = sanitize_text_field($_REQUEST['sd_action']);

        if (!isset($this->endpoints[$action])) {
            return; // Let WP continue if not our action
        }

        $endpoint = $this->endpoints[$action];

        // Security: Nonce Authority Contract
        // 1. Strict Header Priority
        $nonce = $_SERVER['HTTP_X_SYSTEMDECK_NONCE'] ?? $_SERVER['HTTP_X_WP_NONCE'] ?? $_REQUEST['_wpnonce'] ?? '';

        // 2. Strict Action Verification (No Fallbacks)
        if (!wp_verify_nonce($nonce, 'systemdeck_runtime')) {
            $this->send_json_error('Invalid security token (Nonce Authority Violation)', 403);
        }

        // Security: Capability Check (if not public)
        if (!$endpoint['public'] && !current_user_can('manage_options')) { // Default to admin
            // Allow filter for capability
            if (!apply_filters('systemdeck_user_can_access_router', false, $action)) {
                $this->send_json_error('Unauthorized', 403);
            }
        }

        // Execution
        try {
            $response = call_user_func($endpoint['callback'], $_REQUEST);
            if (is_array($response)) {
                $this->send_json_success($response);
            }
        } catch (\Exception $e) {
            $this->send_json_error($e->getMessage(), 500);
        }

        exit; // Stop WP execution
    }

    private function handle_ping($request): array
    {
        return [
            'message' => 'pong',
            'time' => time(),
            'ver' => SYSTEMDECK_VERSION
        ];
    }

    private function send_json_success(array $data): void
    {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'data' => $data]);
        exit;
    }

    private function send_json_error(string $message, int $code = 400): void
    {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'data' => ['message' => $message]]);
        exit;
    }
}
