SYSTEMDECK-ICONS-CONTRACT

Introduction

This document defines the icon language for SystemDeck.

It governs icon source selection, supported names, rendering behavior, cache invalidation, and consumer usage across the HUD, widgets, and any other SystemDeck UI surface that depends on shared icons.

This contract applies to all SystemDeck icon consumers, including Pixi HUD surfaces, shared HUD components, widget scenes, and any non-Pixi UI that uses the same icon names.

⸻

1. Scope and Authority

1.1 Scope
• This contract governs the shared SystemDeck icon layer.
• It defines the authoritative icon source, the accepted icon names, the rendering rules, and the cache rules.
• It does not define widget layout, app routing, or non-icon UI behavior.

1.2 Authority
• The shared HUD icon factory is the source of truth for icon rendering inside Pixi HUD surfaces.
• Dashicons are the primary icon source for Pixi HUD rendering.
• Optional SystemDeck-owned icons may exist under the same shared factory when Dashicons do not cover a required mark.

⸻

2. File Tree

The icon system is governed by these runtime and consumer files:

systemdeck/
├── assets/
│   └── js/
│       └── runtime/
│           └── pixi-hud-engine.js (Shared HUD icon factory, cache, and fallback renderer)
├── widgets/
│   └── time-monitor/
│       └── pixi-scene.js (Pixi consumer of shared HUD icons)
├── admin-pages/
│   └── hud-atlas/
│       └── pixi-scene.js (Shared HUD icon atlas consumer)
└── docs/
    └── SYSTEMDECK-ICONS-CONTRACT.md (This contract)

⸻

3. Icon Source Rules

3.1 Primary Source
• SystemDeck Pixi HUD icons must render through Dashicons by default.
• Dashicon text rendering is the authoritative shared runtime path for Pixi HUD icons.

3.2 Optional SystemDeck Icons
• If Dashicons do not cover a required mark, SystemDeck may define a canonical shared icon under the same `HUD.Icon.create(...)` API.
• Such icons are SystemDeck-owned assets, not implicit WordPress runtime exports.

3.3 Source Priority
• Canonical SystemDeck icon name.
• Dashicon glyph mapping.
• `admin-generic` fallback.

3.4 Rendering Requirement
• Pixi HUD icons must render as shared icon objects created by the factory.
• Icon rendering must not rely on per-component font baseline or ad hoc offset logic.

⸻

4. Supported Names

4.1 Canonical SystemDeck Names
The following names are supported as the canonical input names for `HUD.Icon.create(...)`:

• `admin-generic`
• `edit`
• `visibility`
• `yes`
• `no`
• `saved`
• `note`
• `performance`
• `update`
• `warning`
• `info`
• `menu`
• `search`
• `filter`
• `plus`
• `close`
• `chart-bar`
• `chart-pie`
• `clock`
• `bookmark`
• `flag`
• `wordpress-classic`

4.2 Dashicon Mapping
• Canonical SystemDeck names must resolve through the shared Dashicon glyph map in the Pixi HUD factory.
• Consumers should use canonical names, not raw dashicon class names, when the shared factory is available.

4.3 SystemDeck-Owned Icons
• `wordpress-classic` is a canonical SystemDeck icon name for the classic WordPress mark.
• It exists because the required brand mark is not part of the reliable public icon surface for this runtime path.

4.4 Legacy Coverage
• Raw dashicon class names may still exist elsewhere in non-Pixi parts of SystemDeck.
• Pixi HUD consumers must use canonical shared-factory names instead of raw dashicon class names.

⸻

5. Usage Rules

5.1 Shared Factory Use
• All Pixi HUD consumers must use the shared `HUD.Icon.create(...)` factory for icon construction.
• Scene code must not implement its own icon source resolution when the shared factory is available.

5.2 Accepted Inputs
• Consumers may provide an icon name, size, color, alpha, and palette through the shared factory.
• Consumers must treat the returned icon as a fully formed HUD icon object and not as raw text glyph content.

5.3 Non-Pixi Use
• Non-Pixi consumers may continue to use Dashicons directly outside Pixi when appropriate.
• Non-Pixi consumers must not duplicate Pixi icon object logic.

5.4 Naming Discipline
• New icons added to SystemDeck must use a canonical name that resolves through the shared factory.
• Any new alias added to the shared icon map must be reflected in this contract.
• If a required mark is not covered cleanly by Dashicons, SystemDeck may own a canonical icon for that mark in the shared factory.

⸻

6. Rendering Rules

6.1 Box Model
• Icons must render inside a consistent square box.
• Icons must be centered in that box.
• Icons must scale proportionally within that box.

6.2 Alignment
• Icon rendering must not depend on per-consumer baseline hacks.
• Optical offsets, when needed, must live in the shared factory.

6.3 Resolution
• Icon textures must render sharply at the current device pixel ratio.
• The rendered icon must remain crisp when reused across HUD components.

6.4 Visual Consistency
• The icon language must remain visually consistent across buttons, icon buttons, headers, pins, and widget scenes.
• The same icon name must produce the same visual identity wherever it is used.

⸻

7. Cache Rules

7.1 Icon Texture Cache
• Shared icon instances are HUD-owned runtime assets.
• Icon behavior must be consistent by icon name and size.

7.2 Cache Clearing
• Clearing shared HUD caches must not break icon rendering.
• Theme or profile changes must preserve icon behavior under the same API.

7.3 Cache Safety
• Cleanup must not change the public icon API.

⸻

8. Consumer Rules

8.1 Pixi HUD Components
• `Button`, `IconButton`, `PinHeader`, and any future shared HUD component must consume icons through the shared factory.
• Components must not assume a text glyph implementation.

8.2 Widget Scenes
• Widget scene code may request icons from the shared HUD factory, but it must not reimplement source selection or cache management.

8.3 Atlas and Diagnostic Surfaces
• Atlas or diagnostic surfaces that preview HUD elements must use the same shared icon source to avoid drift between preview and runtime.

⸻

9. Compliance Rules

• The shared icon factory is binding for all SystemDeck Pixi icon consumers.
• Dashicons are the active shared source for Pixi HUD icons.
• If a new icon name is required, the canonical name and glyph mapping must be added together.
• This contract overrides informal icon usage conventions.

⸻

END OF CONTRACT
