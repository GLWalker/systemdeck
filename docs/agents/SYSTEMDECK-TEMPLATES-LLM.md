# SYSTEMDECK-TEMPLATES-LLM.md

## 1. Purpose

This document represents the template-layer intelligence manifest for the SystemDeck plugin (Tier 2 Extension). It defines the structural realization of plugin-specific Custom Post Types (CPTs) within the WordPress block environment.

## 2. Symbols (Templates)

### Canvas Single Template
- **type**: symbol
- **name**: `single-systemdeck_canvas.html`
- **category**: template
- **description**: Authoritative block-template for rendering individual SystemDeck Canvas post types on the frontend.
- **extraction_confidence**: 1.0 (Static File)
- **usage_confidence**: 1.0 (Primary Realization)

## 3. Events (Realization & Fallbacks)

### Theme Interaction
- **type**: event
- **name**: `template_include`
- **category**: action
- **trigger**: Fired during the WordPress template loading sequence.
- **description**: Priority hook for injecting the plugin-provided template when the active theme does not provide a specialized canvas layout.
- **extraction_confidence**: 0.7 (Standard Hook)

## 4. Registrations (Realization)

### Block Injections
- **type**: registration
- **category**: block
- **identifier**: `core/post-content`
- **arguments**: { "inContext": "systemdeck_canvas" }
- **callback**: `render_block()`
- **extraction_confidence**: 0.7 (Standard Layout)

## 5. Standard Patterns

### CPT Layout Integration
- Templates utilize the standard [**`single-{post_type}.html`**] naming convention for seamless WordPress Block Theme integration.
- The template primarily functions as a wrapper for the `systemdeck/canvas-grid` core block.

### Visual Isolation
- All template realization logic is optimized to avoid interference with the surrounding theme's layout and styles.

## 6. Output Discipline

- Template intelligence must be extraction-verified against the [**`wp-content/plugins/systemdeck/templates/`**] source directory.
- Avoid suggesting manual HTML overrides when standard block-content tags are available.
- Always respect the namespaced scope of the SystemDeck Canvas CPT.
