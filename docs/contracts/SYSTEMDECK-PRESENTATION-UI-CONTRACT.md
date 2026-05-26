# SYSTEMDECK-PRESENTATION-UI-CONTRACT

Introduction

This document defines the presentation layer, UI orchestration, and frontend operational logic for the SystemDeck platform.

The presentation layer is responsible for translating the abstract system state into a high-performance, responsive UI. It governs how assets are enqueued, how the shell is injected into the WordPress environment, and how specialized frontend modules like **Visual Mode** and the **Forensic Inspector** interact with the WordPress block-based architecture.

This contract is binding for all UI controllers, asset handlers, and template engines. It ensures a consistent "Retail" experience across both the backend (Admin) and the frontend (Public) of the website.

⸻

1. Introduction

SystemDeck provides a unified UI layer that spans the entire WordPress lifecycle. This contract governs the discovery and delivery of static assets, the rendering of UI components (Docks, Menus, Modals), and the execution of frontend-specific logic via the Retail Controller. By standardizing how the platform mounts its shell and intercepts theme styles, we ensure a seamless transition between development and "Retail" production modes.

2. File Tree

The presentation and UI systems are defined by these core files:

systemdeck/
├── assets/ (Static Asset Root)
│   ├── css/ (System Styles)
│   ├── js/ (System Logic)
│   └── img/ (Icons and SVGs)
├── core/
│   ├── Assets.php (Asset Authority)
│   ├── UI.php (UI Component Library)
│   ├── MenuEngine.php (Menu Orchestration)
│   ├── RetailController.php (Frontend Presence)
│   ├── ThemeUtilities.php (Style Helpers)
│   ├── EditorController.php (Gutenberg Integration)
│   └── CanvasEngine.php (Spatial Rendering)
├── modules/
│   ├── SystemScreen.php (Full-screen Displays)
│   └── Inspectors/
│       ├── BlockInspector.php (Forensic Data)
│       └── SystemInspector.php (UI Feedback)
├── templates/
│   └── single-systemdeck_canvas.html (CPT Template)
├── utils/
│   └── Color.php (Harmonization Logic)
└── includes/
    └── functions.php (Public UI Helpers)

⸻

3. Asset Authority (Assets.php)

3.1 Centralized Registration
• All CSS and JS handles must be registered through `Assets.php`.
• Core handles (e.g., `sd-shell`, `sd-common`) are enqueued conditionally based on user capability and system state.
• Global registration does not authorize global enqueue.
• Widget-local handles may be registered globally, but they must be enqueued only when the active shell or active workspace context requires them.
• Disabled widgets must not cause widget-local assets to preload only because the widget exists in the registry snapshot.

3.1.1 Enqueue Eligibility
• Widget-local assets must be enqueued only when the widget is registry-enabled and required by the active shell/workspace context.
• A disabled widget that is already placed in an accessible workspace may still cause its runtime assets to load so the persisted layout can resolve safely.
• A disabled widget that is not active in an accessible workspace must not cause shell preload or runtime bootstrap enqueueing.
• Shared runtimes (for example Pixi/HUD or telemetry engines) must not be blanket-loaded only because a compatible widget type exists in the registry. They must load only when an active consumer requires them.

3.2 Dynamic CSS Generation
• The platform generates dynamic CSS variables based on the active WordPress admin color scheme.
• This ensures that SystemDeck UI elements (Docks, Buttons, Borders) match the user's preferred WordPress environment.

3.3 Frontend Bootstrap Payload
• Frontend bootstrap data must be a sanitized runtime manifest, not a raw server-side registry snapshot.
• The runtime payload may include only fields required by the browser to discover, label, and render accessible widgets.
• Server-only execution metadata must not be exposed to the frontend bootstrap payload.
• Forbidden frontend manifest fields include widget asset declarations, tunnel asset declarations, PHP file paths, class names, callbacks, and other server-only internals.

⸻

4. UI & Shell Injection (UI.php)

4.1 Shell Mounting
• The `render_shell` method is the authoritative entry point for the React/Canvas container.
• It must be injected into the `wp_footer` (frontend) or `admin_footer` (backend).

4.2 The Inception Guard
• The shell must never mount inside an iframe (e.g., the Dashboard Tunnel or Preview Iframe).
• Detection is enforced via the `sd_block_boot` query parameter or `IFRAME_REQUEST` constant.

⸻

5. Retail Mode & Visual Mode (RetailController.php)

5.1 The Retail System
• Manages the platform's presence on the public frontend.
• Enqueues `sd-retail-system.js` to provide the floating visual triggers.

5.2 Visual Mode (Preview Iframe)
• Provides a "Clean Room" environment for site editing.
• Bypasses theme/plugin interference by stripping the admin bar and parent shell logic.
• Intercepts `wp_theme_json_data_theme` to apply real-time style variations without database writes.

⸻

6. Navigation & Menus (MenuEngine.php)

6.1 Admin Menu Integration
• Registers the SystemDeck top-level menu and submenus (Command Center, Vault).

6.2 Platform Toolbars
• Orchestrates the "Forensic Inspector" and "Launcher" toolbars within the shell.

⸻

7. Templates & Special Views

7.1 Canvas Templates
• The `single-systemdeck_canvas.html` template provides the root structure for custom spatial workspaces.
• It must be loaded via the `template_include` filter when viewing a `systemdeck_canvas` CPT.

⸻

END OF CONTRACT
