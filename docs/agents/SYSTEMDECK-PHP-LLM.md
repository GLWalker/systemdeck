# SYSTEMDECK-PHP-LLM.md

## 1. Purpose

This document represents the authoritative execution-layer manifest for the SystemDeck plugin (Tier 2 Extension). It defines the namespaced logic, service contracts, hooks, and registrations that govern the plugin's server-side behavior.

## 2. Symbols (Logic & Services)

### core/Registry.php
- **type**: symbol
- **name**: `SystemDeck\Core\Registry`
- **category**: service
- **description**: Centralized repository for plugin-specific registrations and state.
- **signature**: `static function get_instance()`
- **extraction_confidence**: 1.0 (Stable Public API)
- **usage_confidence**: 1.0 (Primary Entrypoint)

### core/AppRuntime.php
- **type**: symbol
- **name**: `SystemDeck\Core\AppRuntime`
- **category**: core
- **description**: Manages the plugin lifecycle and execution context.
- **signature**: `function init()`
- **extraction_confidence**: 1.0 (Main Controller)
- **usage_confidence**: 1.0 (Stable)

### core/Services/CanvasRepository.php
- **type**: symbol
- **name**: `SystemDeck\Core\Services\CanvasRepository`
- **category**: service
- **description**: Manages the persistence and retrieval of Canvas CPT data.
- **signature**: `static function save_canvas(array $data)`
- **extraction_confidence**: 0.7 (Core Storage Logic)
- **usage_confidence**: 1.0 (Authoritative)

### core/AjaxHandler.php
- **type**: symbol
- **name**: `SystemDeck\Core\AjaxHandler`
- **category**: service
- **description**: Central entrypoint for all AJAX-based communication between client and server.
- **signature**: `static function handle_request()`
- **extraction_confidence**: 0.7 (Internal Orchestrator)
- **usage_confidence**: 0.7 (Used via Actions)

## 3. Events (Hooks & Interactions)

### Initialization Hooks
- **type**: event
- **name**: `systemdeck_load_app_providers`
- **category**: action
- **trigger**: Fired during `init` before infrastructure registration.
- **description**: Allows modular feature injection for the plugin runtime.
- **extraction_confidence**: 1.0 (Extension Hook)

- **type**: event
- **name**: `systemdeck_after_init`
- **category**: action
- **trigger**: Fired at the end of the `AppRuntime::init()` sequence.
- **description**: Final catch-all for plugin-specific post-initialization logic.
- **extraction_confidence**: 1.0 (Lifecycle Hook)

### Lifecycle Triggers
- **type**: event
- **name**: `save_post_systemdeck_canvas`
- **category**: action
- **trigger**: Fired when a SystemDeck Canvas CPT is saved.
- **description**: Hook for synchronizing metadata and performing validation.
- **extraction_confidence**: 0.7 (Standard CPT Hook)

## 4. Registrations (Extensions)

### Custom Post Types (CPT)
- **type**: registration
- **category**: cpt
- **identifier**: `systemdeck_canvas`
- **arguments**: { "public": true, "show_in_rest": true, "supports": ["title", "editor", "custom-fields"] }
- **callback**: `CanvasRepository::register_post_type()`
- **extraction_confidence**: 1.0 (Static Registration)

### REST Router
- **type**: registration
- **category**: rest
- **identifier**: `systemdeck/v1/preview`
- **arguments**: { "methods": "GET", "permission_callback": "is_user_logged_in" }
- **callback**: `WidgetPreviewRoute::handle_request()`
- **extraction_confidence**: 1.0 (Namespaced Route)

### AJAX Actions
- **type**: registration
- **category**: ajax
- **identifier**: `systemdeck_get_metrics`
- **arguments**: { "action": "systemdeck_get_metrics", "nopriv": false }
- **callback**: `AjaxHandler::handle_get_metrics()`
- **extraction_confidence**: 1.0 (Namespaced Action)

## 5. Standard Patterns

### CPT Contextualization
- All SystemDeck CPTs are identified by the `systemdeck_` prefix.
- All metadata fields utilize namespaced keys (e.g., `_sd_canvas_settings`).

### Namespaced Execution
- Logic must be contained within `SystemDeck\` sub-namespaces.
- Redefinition of Core (`WP_`) symbols is strictly forbidden.

## 6. Output Discipline

- All PHP intelligence must be extraction-verified against the [**`wp-content/plugins/systemdeck/`**] source directory.
- For all examples, follow the **Standard WordPress Example** rules in `GPT-SETUP.md`.
- Prefer namespaced class methods over global functions for consistency.
