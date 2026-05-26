# SYSTEMDECK-WORKSPACE-LAYOUT-CONTRACT

Introduction

This document defines the spatial and interaction model for the SystemDeck workspace.

SystemDeck uses deterministic responsive grid lanes to organize widgets and pins across multiple workspaces. Each workspace acts as a unique canvas—either private to a user or shared across a collaborative group—governed by strict layout and visibility rules.

This contract is binding for the layout engine, the widget registry, and the sharing services. It ensures that the user interface remains stable, accessible, and high-performance across all device types and collaboration modes.

⸻

1. Introduction

Layout in SystemDeck is a first-class citizen, anchored by the logical coordinate system of the workspace grid. This contract governs the relationship between the central widget registry and the spatial positioning of items in the runtime layout engine. It enforces the persistence rules that keep workspaces consistent across sessions and the sharing models that allow for collaborative or locked layouts.

2. File Tree

The workspace system is defined by these core files:

systemdeck/
├── src/
│   ├── canvases/
│   │   └── WorkspaceCanvas.js (Widget + Pin Runtime Grid Authority)
│   └── state/
│       ├── reducer.js (Canonical Workspace State)
│       ├── actions.js (Layout Actions)
│       └── controls.js (Persistence Side Effects)
├── core/
│   ├── AjaxHandler.php (Persistence Endpoints)
│   └── Services/
│       ├── StorageEngine.php (Workspace Persistence)
│       ├── CanvasRepository.php (Canvas Spatial Sync)
│       └── WidgetRuntimeBridge.php (Widget Execution Gateway)
├── assets/
│   └── css/
│       └── sd-common.css (Pin Grid Shared Presentation)

⸻

3. The Workspace Model

3.1 Identity and Anchoring
• Workspaces are logical containers for widgets and pins.
• Each workspace is anchored to a unique slug in user meta or a `systemdeck_canvas` CPT post in the database.
• The default workspace resolves to the identity `default`.

3.2 Hierarchy of Persistence
• Private: Layout changes are canonical only to the workspace owner.
• Collaborative: Layout changes are synchronized across all authorized members.
• Shared (Owner-Only): Non-owner changes (resizing, moving) are treated as local browser overlays and are not persisted to the global state.
• Locked: No layout mutations are permitted.

3.3 Shared Audience Law
• Workspace collaboration mode governs both widget placement and pin projection audience.
• Widget placement and projection pins must not invent separate workspace visibility laws.
• Canonical object ownership remains separate from workspace audience.

Binding behavior:
• Shared (Owner-Only): For non-owner members, widget placement is member-local overlay behavior and pin placement/projection must follow the same member-local overlay behavior.
• Collaborative: For authorized members, widget placement is workspace-wide canonical workspace state and pin placement/projection must follow the same workspace-wide behavior.

Clarification:
• A note, file, or other canonical object does not change ownership when projected.
• Only the audience of the projection changes with workspace mode.

⸻

4. The Runtime Grid

4.1 Coordinate System
• The grid uses a deterministic responsive column model.
• Placement is defined by four canonical coordinates:
• `x`: Column start (0-based)
• `y`: Row start
• `w`: Column span
• `h`: Row span (integer units)

Responsive lane rules:
• Widget lane canonical base is desktop 6-unit width.
• Widget lane runtime widths resolve per breakpoint from desktop canonical width.
• Pin lane uses its own responsive grid lane and persists x/y/w/h coordinates.

4.2 Packing Behavior
• The system optimizes for spatial stability. Global reordering is forbidden.
• Only local collision resolution is permitted when moving or resizing items.
• A dashed "drop-zone" indicator must preview the exact footprint of an item during drag-and-drop.

4.3 Item States
• Expanded: Items occupy their persisted `w` and `h`.
• Collapsed: Items occupy a header-only row span but preserve their expanded `h` for restoration.

⸻

5. Widget Registration Contract

5.1 Canonical Identity
• Widget IDs must be dot-separated and unique within the registry snapshot (e.g., `core.notes`).
• Third-party widgets must register through the `systemdeck_registry_collect` filter.

5.2 Supported Render Modes
• `php`: Rendered via a server-side PHP callback or class.
• `tunnel`: Hosted through a secure iframe tunnel for dashboard compatibility.
• `tunnel_hosted`: Tunnel content rendered inside a SystemDeck-owned host shell (`WidgetShell`) where SystemDeck owns header/collapse/width controls and the iframe owns only inner widget content.
• `plugin_tunnel`: A tunnel variant with specific host asset requirements.
• `react_hosted`: Rendered directly by the client-side React runtime.

5.3 Asset Handlers
• `assets`: Declares widget-local CSS/JS files.
• `tunnel_assets`: Declares WordPress script/style handles required for tunneled widgets.
• Tunnels must simulate canonical dashboard enqueue context (`index.php` screen hooks) when rendering dashboard-origin widgets that gate assets by screen ID/base/hook suffix.
• Asset declaration is not equivalent to enqueue authorization.
• Declared widget assets must load only when the widget is required by the active workspace/runtime context.
• Disabled widgets must not cause shell preload or runtime bootstrap asset loading only because their declarations exist in the registry snapshot.
• A disabled widget that is already placed in an accessible workspace may continue to resolve its runtime assets so the persisted layout remains renderable and reversible.
• Shared runtimes required by multiple widgets must load only when an active placed consumer requires them.

5.4 Registry Snapshot Boundary
• The server-side registry snapshot is the authority for runtime lookup.
• Frontend-facing workspace/bootstrap manifests must expose only sanitized widget fields required for client-side discovery and rendering.
• Frontend manifests must not expose `assets`, `tunnel_assets`, file paths, class names, callbacks, or other server-only execution metadata.

5.5 Tunnel CSS Boundary
• Tunnel reset/stabilization styles must be scoped to `.sd-tunnel-content`.
• Tunnel reset styles must not affect native WordPress admin pages outside the iframe route.
• Host shell styles (`.sd-widget`, `WidgetShell`) and tunnel iframe styles are separate ownership domains and must not cross-own each other.
• Known tunnel-only compatibility suppressions (for unstable modules in iframe context) are allowed when narrowly scoped and documented.

⸻

6. Permission and Access

6.1 Capability Gates
• Every widget must declare a minimum `capability` (default: `manage_options`).
• Access is verified by the `WidgetRuntimeBridge` before rendering.

6.2 Runtime Nonces
• Mutations (moving, resizing, deleting) require a valid `systemdeck_runtime` nonce.
• Requests are verified by `AjaxHandler::verify_request()`.

6.3 Pin / Projection Alignment
• Any pin or projected surface placed into a workspace must inherit the workspace audience rules defined in 3.2 and 3.3.
• Shared owner-only workspaces must not promote a non-owner member's pin/projection mutations into workspace-wide state.
• Collaborative workspaces must treat authorized pin/projection mutations as workspace-wide state in the same way widget placement does.

⸻

END OF CONTRACT
