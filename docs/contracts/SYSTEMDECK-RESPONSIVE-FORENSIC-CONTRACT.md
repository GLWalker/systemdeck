# SYSTEMDECK-RESPONSIVE-FORENSIC-CONTRACT

Introduction

This document defines the operational standards and technical protocols for the SystemDeck Responsive Viewer (Retail Mode) and the Forensic Inspector.

These systems provide the "Visual Layer" of the platform, enabling real-time site editing, responsive stress-testing, and deep block-level diagnostics. This contract governs the separation between the WordPress Editor (Gutenberg) and the Public Frontend, the protocol for cross-context communication (Iframe Message Bus), and the authoritative use of `theme.json` metrics for forensic correlation.

This contract is binding for all visual controllers, inspector engines, and telemetry harvesters.

⸻

1. Introduction

The Responsive & Forensic layer is responsible for the platform's visual intelligence. It allows users to view their site through a managed "Clean Room" viewport and inspect the "DNA" of any block or element. By bridging the gap between computed CSS and static `theme.json` presets, the Forensic Inspector provides an authoritative view of how styles are applied and inherited across the WordPress ecosystem.

2. File Tree

The following files govern the Responsive and Forensic systems:

systemdeck/
├── core/
│   ├── RetailController.php (Frontend Presence & Iframe Authority)
│   ├── EditorController.php (Gutenberg Integration & Sidebar Registry)
│   └── Harvester.php (Theme JSON Extraction Logic)
├── assets/
│   ├── js/
│   │   ├── sd-retail-system.js (Responsive Viewer UI)
│   │   ├── sd-inspector-hud.js (Frontend React HUD)
│   │   ├── sd-inspector-engine.js (The "Magic Mouse" Iframe Engine)
│   │   └── sd-fse-sidebar.js (Editor Sidebar React App)
│   └── css/
│       ├── sd-common.css (Shared UI Components)
│       └── sd-editor-overrides.css (Gutenberg Canvas Styles)
└── modules/
    └── Inspectors/
        └── BlockInspector.php (Backend Logic Placeholder)

⸻

3. The Responsive Viewer (Retail System)

3.1 Operational Modes
• Full Screen: Default view using 100% of the available browser width.
• Managed Viewports: Predefined breakpoints for testing responsiveness.
  - SM (360px), MD (782px), LG (960px), XL (1200px), XXL (1400px).

3.2 Intelligent Scaling
• When a target viewport exceeds the available screen width, the viewer must apply a CSS `transform: scale()` to fit the canvas while preserving the logical pixel dimensions.
• A dimension tooltip must display the real-world width and height during resizes and scaling.

3.3 Iframe Isolation
• The viewer renders the site inside a "Clean Room" iframe using the `sd_preview=1` parameter.
• This mode must strip the WordPress Admin Bar and parent SystemDeck shell to prevent UI recursion.

⸻

4. The Forensic Inspector (Magic Mouse)

4.1 Shared DNA Engine
• The inspector uses a unified logic for "Forensic Correlation"—mapping computed CSS values (e.g., `rgb(34, 113, 177)`) back to their `theme.json` presets (e.g., `var:preset|color|vivid-cyan-blue`).
• It must distinguish between **Set Values** (inline or block-specific) and **Inherited Values** (global styles or tag defaults).

4.2 Dual-Context Presence
• Frontend (HUD): A floating React panel mounted over the Responsive Viewer.
• Editor (Sidebar): A native WordPress `PluginSidebar` integrated into Gutenberg/FSE.
• Both contexts must consume the same data contract and telemetry models.

4.3 The Magic Mouse Engine (sd-inspector-engine.js)
• This engine runs *inside* the iframe or editor canvas.
• It is responsible for DOM traversal, ghost highlighting (`sd-ghost-hover`), and element selection.
• It communicates with the parent UI (HUD or Sidebar) via `window.postMessage`.

⸻

5. Telemetry & Theme JSON

5.1 The Harvesting Process (Harvester.php)
• The system must extract a sanitized data graph of the active `theme.json`.
• This graph includes color palettes, font sizes, spacing scales, and block-level styles.

5.2 Real-time Style Swapping
• The viewer supports "Live Styles" by intercepting the `wp_theme_json_data_theme` filter via `RetailController`.
• This allows the user to preview style variations (variations provided by the theme) in memory without database writes.

5.3 Export Authority
• Sanitized telemetry can be exported as a `theme-variation.json` file for inclusion in child themes or for distribution as first-class presets.

⸻

6. Evolutionary Path: The Visual Optimizer App

6.1 App Transition
• The Responsive Viewer and Forensic Inspector are slated for transition into a unified **"Visual Optimizer" App**.
• This app will provision a dedicated `ws_visual_optimizer` workspace and anchor all visual tools (Grid, Inspector, Style Swapper) into a first-class app runtime.

6.2 Enhanced Widgets
• The transition will include specialized app widgets for "Box Model Forensic", "Typography Stress Testing", and "Color Palette Harmonization".

⸻

END OF CONTRACT
