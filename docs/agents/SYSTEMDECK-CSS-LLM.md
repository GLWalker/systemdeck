# SYSTEMDECK-CSS-LLM.md

## 1. Purpose

This document represents the visual-layer intelligence manifest for the SystemDeck plugin (Tier 2 Extension). It defines the namespaced CSS identifiers, shell layout, and widget boundaries that govern the plugin's visual realization.

## 2. Symbols (Visuals & Layout)

### Plugin Shell
- **type**: symbol
- **name**: `.systemdeck-shell`
- **category**: layout
- **description**: Root container for the entire plugin dashboard UI.
- **extraction_confidence**: 1.0 (Root Identifier)
- **usage_confidence**: 1.0 (Entrypoint)

### Widget Container
- **type**: symbol
- **name**: `.sd-widget-container`
- **category**: layout
- **description**: Standardized container for mounting all dashboard widgets.
- **extraction_confidence**: 0.7 (Core UI)

### Canvas Grid Block
- **type**: symbol
- **name**: `.wp-block-systemdeck-canvas-grid`
- **category**: block
- **description**: Frontend and Editor-side styling for the Canvas layout block.
- **extraction_confidence**: 1.0 (Block Identifier)

## 3. Events (Transitions & State)

### State Triggers
- **type**: event
- **name**: `.is-loading`
- **category**: active
- **trigger**: Applied to widget containers during asynchronous data fetching.
- **description**: Visual state for pending AJAX/REST requests.
- **extraction_confidence**: 0.7 (UI State)

- **type**: event
- **name**: `.has-error`
- **category**: active
- **trigger**: Applied upon failed request or validation error.
- **description**: Visual feedback state for system errors.
- **extraction_confidence**: 0.7 (UI State)

## 4. Registrations (Visual Extensions)

### Global Styles
- **type**: registration
- **category**: css
- **identifier**: `sd-common.css`
- **arguments**: { "handle": "systemdeck-common", "deps": [] }
- **callback**: `Assets::enqueue_scripts()`
- **extraction_confidence**: 1.0 (Static Asset)

### Shell Styles
- **type**: registration
- **category**: css
- **identifier**: `systemdeck-shell.css`
- **arguments**: { "handle": "systemdeck-shell", "deps": ["systemdeck-common"] }
- **callback**: `Assets::enqueue_shell_assets()`
- **extraction_confidence**: 1.0 (Authoritative)

## 5. Standard Patterns

### Widget Namespacing
- All widget-specific styles [**`widgets/*/style.css`**] are expected to be namespaced under the widget slug.
- Shared styles and utility classes reside in [**`assets/css/sd-common.css`**].

### Dashboard Layout
- The plugin utilizes a grid-based dashboard system using [**`systemdeck-shell.css`**].

## 6. Output Discipline

- All CSS intelligence must be extraction-verified against the [**`wp-content/plugins/systemdeck/assets/css/`**] and [**`widgets/*/style.css`**] source files.
- Favor standard WordPress dashboard themes and variables where possible.
- Avoid introducing speculative UI patterns not explicitly present in the source files.
