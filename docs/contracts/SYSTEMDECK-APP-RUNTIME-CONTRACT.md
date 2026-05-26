# SYSTEMDECK-APP-RUNTIME-CONTRACT

Introduction

This document defines the runtime environment and interaction model for first-class Apps in SystemDeck.

An App is not a standard workspace widget. While a widget is a modular component that can be added to any workspace, an App is a managed runtime surface that provisions its own dedicated workspace and canvas environment.

This contract is binding for all first-class app modules (e.g., core.vics-hideaway) and any third-party apps that require stable, isolated behavior. It governs how apps are registered, how they anchor to workspaces, and how their visibility and navigation are managed across the platform.

⸻

Contract Hierarchy

1. Widget loading/mount authority: `SYSTEMDECK-WIDGET-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`
2. App policy authority (workspace visibility, app launch, app lock rules): this document
3. Pixi rendering authority (inner scene/render behavior after mount): `SYSTEMDECK-PIXI-HUD.md`
4. On conflict: app policy cannot override widget loading/mount rules.

⸻

1. Introduction

Apps represent the highest level of functional isolation in SystemDeck. Unlike widgets, which are modular components within a shared workspace, Apps own their dedicated workspace and canvas identity. This contract ensures that all Apps consume system resources, register their metadata, and manage their lifecycle in a deterministic and platform-governed manner.

2. File Tree

The app runtime is governed by these core components:

systemdeck/
├── core/
│   ├── AppRuntime.php (Runtime Helper)
│   ├── AjaxHandler.php (App Metadata Gateways)
│   └── Rest/ (REST API Controllers)
├── modules/
│   └── DashboardTunnel.php (Clean Room Iframe Subsystem)
├── widgets/
│   ├── BaseWidget.php (Abstract Provider)
│   └── <app_slug>/
│       └── widget.php (App Provider Registration)

⸻

3. App vs Widget Model

3.1 Standard Widget
• Appears in the widget registry.
• Can be toggled on or off per individual workspace.
• Participates in traditional masonry layout controls.

3.2 First-Class App
• Registered through the app registry (`systemdeck_register_apps`).
• Provisions a dedicated, immutable workspace/canvas identity.
• Is launched through explicit entrypoints (App Launcher, Tools menu).
• May contain its own internal widgets, but the root app policy is host-managed.

3.3 Contract Boundary With Widget Runtime
• App policy controls where app-provided widgets are visible/allowed.
• Widget loading and execution lifecycle is governed by:
  `SYSTEMDECK-WIDGET-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`.
• Apps must not bypass widget runtime mount/asset rules.

⸻

4. Registration and Identity

4.1 Mandatory Registration
• Apps must register through `add_filter('systemdeck_register_apps', ...)`.
• Core providers are loaded via `systemdeck_load_app_providers`.

4.2 Required Metadata
• `id`: Canonical app identity (e.g., `systemdeck.vics-hideaway`).
• `title`: Human-readable display name.
• `capability`: Minimum user capability required to open the app.
• `workspace.id`: Stable, deterministic workspace anchor (e.g., `ws_vics_hideaway`).

4.3 Identity Boundaries
• App storage keys must include the `app_id` and the app workspace ID.
• App workspace metadata must persist `is_app_workspace = true` and the `app_id`.

⸻

5. The App Workspace

5.1 Provisioning
• App workspaces are created through an idempotent `provision()` step.
• The app root widget is seeded on provision and is non-removable by default.

5.2 Visibility Policy
• By default, app workspaces are hidden from common lists and the Command Center.
• Visibility is explicitly opted-in through App settings in the Command Center.
• App-provided widgets may be:
  - hidden from widget picker
  - restricted to app workspace only
  - locked as app root widgets

⸻

6. The Dashboard Tunnel (DashboardTunnel.php)

6.1 Universal Iframe Rendering
• SystemDeck provides a "Dashboard Tunnel" to bridge the gap between legacy WordPress widgets and the modern React runtime.
• This subsystem renders PHP-based or React-based dashboard widgets in a clean iframe without WordPress admin chrome or padding artifacts.

6.2 The Assets Firewall
• The tunnel enforces a strict asset policy, deregistering standard admin-bar and SystemDeck shell scripts to prevent recursion and styling artifacts inside the iframe.

6.3 Widget Assets in App Context
• App policy does not change widget asset authority:
  backend manifests + runtime widget loader remain authoritative.
• No app-local script injection or implicit script execution is allowed for widget boot.

⸻

7. Integration Gates (Rest/ & Blocks/)

7.1 Gutenberg Block Bridge
• Apps may register themselves as WordPress blocks to allow embedding within standard pages (Inception Mode).
• Registration occurs via `BlockRepository` and is managed by `EditorController.php`.

7.2 REST Strategy
• High-frequency data transfers for apps should utilize the SystemDeck REST API controllers located in `core/Rest/`.
• These routes are authenticated via the central Nonce Authority.

⸻

8. App Lifecycle (Provision, Open, Upgrade, Uninstall)

Apps must respect the platform phases to ensure data integrity during system upgrades or deactivations.

8.1 Widget UI State in App Workspaces
• Widget UI preferences (`collapsed`, `width`) remain user-scoped server state.
• Workspace scope applies equally to app workspaces and standard workspaces.
• Apps must not create competing persistence for widget shell controls.

⸻

END OF CONTRACT
