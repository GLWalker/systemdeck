# SYSTEMDECK-JS-LLM.md

## 1. Purpose

JS runtime entry points, canvases, controllers, and event contracts used by SystemDeck. While React may exist in some surfaces, it is not "the architecture." This document defines the actual client-side intelligence constraints for SystemDeck.

## 2. Symbols (Logic & Components)

### Global Namespace
- SystemDeck exposes multiple globals; authoritative list is in `CURRENT-STATE.md`.
- Do **not** claim a single "registry global" unless verified.

### Widget Runtime
- **type**: symbol
- **name**: `SystemDeck.Core.WidgetRuntime`
- **category**: core
- **description**: Base controller responsible for mounting and managing lifecycle for deck-mounted widgets.

### System Status (Widget)
- **type**: symbol
- **name**: `SystemDeck.Widgets.SystemStatus`
- **category**: widget
- **description**: Entrypoint for the system telemetry dashboard.

## 3. Events (Actions & Triggers)

### Interaction Triggers
- **type**: event
- **name**: `sd_widget_mount`
- **category**: action
- **trigger**: Fired when a widget is successfully mounted by the runtime.
- **description**: Hook for additional initialization (e.g., establishing polling).

- **type**: event
- **name**: `sd_telem_update`
- **category**: action
- **trigger**: Fired when new telemetry data is received via AJAX/REST.
- **description**: Data-binding trigger for live dashboard components.

## 4. Registrations (Client-side)

### Block Data
- **type**: registration
- **category**: block
- **identifier**: `systemdeck/widget-placeholder`
- **arguments**: { "name": "systemdeck/widget-placeholder", "title": "SystemDeck Widget" }
- **callback**: `EditComponent.render()`

### Widget Entries
- **type**: registration
- **category**: widget
- **identifier**: `notes`, `system-status`, `time-monitor`, `vault`.
- **arguments**: { "slug": "string", "icon": "string" }
> [!NOTE]
> See `CURRENT-STATE.md` for information on removed widgets (e.g. `player`).

## 5. How to reason about JS changes

- **Where to look first**: Runtime canvases and controllers.
- **Event contracts are authoritative**: See `CURRENT-STATE.md` for the single source of truth.
- **Pins**: No self-executing pins; pins mount strictly via events.

## 6. Output Discipline

- All requests must include the namespaced AJAX action and `X-WP-Nonce` as per `GPT-SETUP.md`.
- Never invent widget slugs or property names; use those explicitly present in the source.
- Follow the **REST API rules** and **Block output rules** defined in `GPT-SETUP.md`.
