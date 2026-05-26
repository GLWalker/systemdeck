# SYSTEMDECK-CORE-ARCHITECTURE-CONTRACT

Introduction

This document defines the core architecture and operational boundary of the SystemDeck platform.

SystemDeck is not a single dashboard widget; it is a persistent, layered control center for WordPress. It separates infrastructure (PHP), presentation (Shell), and the runtime environment (React/Canvas).

This contract governs the lifecycle of the platform—from early boot and metadata registration to the guaranteed behavior of the stable runtime. It defines the responsibilities of the central platform authorities and the boundaries that must be preserved to ensure system stability.

⸻

1. Introduction

SystemDeck is a platform-level extension for WordPress that provides a unified, persistent workspace environment. This contract defines the fundamental architectural layers and authorities that maintain the platform's integrity. It ensures that infrastructure, presentation, and runtime layers act in concert to deliver a stable, high-performance experience.

2. File Tree

The following files constitute the authoritative core of the SystemDeck platform:

systemdeck/
├── systemdeck.php (Bootloader)
├── core/
│   ├── Autoloader.php (Namespace Authority)
│   ├── Router.php (High-Performance Request Handler)
│   ├── Harvester.php (Metric Extraction Logic)
│   ├── Registry.php (Runtime Reader)
│   ├── AjaxHandler.php (Operational Gateway)
│   ├── Telemetry.php (Diagnostics Authority)
│   └── Services/
│       ├── RegistryService.php (Build-time Registry)
│       ├── StorageEngine.php (Persistence)
│       ├── CanvasRepository.php (Identity/CPT Anchor)
│       └── WidgetRuntimeBridge.php (Execution Bridge)

⸻

3. Platform Model

SystemDeck operates as a three-layered platform:

3.1 Infrastructure Layer (PHP/WordPress)
• Registers CPTs, REST routes, and Ajax handlers early in the WordPress boot.
• Manages the persistent widget registry snapshot.
• Authorizes shell boot and hydrates the runtime payload.

3.2 Presentation Layer (The Shell)
• Injects a global, persistent UI frame into the WordPress environment.
• Manages dock state, visibility, and shell-level interaction.
• Hydrates the browser environment with SystemDeck globals.

3.3 Runtime Layer (React/Canvas)
• Mounts into the shell and manages the active workspace.
• Executes widgets and manages spatial layout state.
• Communicates with the platform layer via nonce-verified gateways.

⸻

4. Core Authorities

The following services are the authoritative owners of their respective domains.

4.1 The Bootloader (systemdeck.php)
• The single entry point for the plugin.
• Responsible for registering all infrastructure during `init`.
• The gatekeeper for shell access (`systemdeck_user_can_boot`).
• Publishes the canonical bootstrap globals: `SYSTEMDECK_BOOTSTRAP`, `SYSTEMDECK_STATE`, `sd_vars`.

4.2 RegistryService (RegistryService.php)
• The build-time authority for widget discovery.
• Assembles the authoritative `sd_registry_snapshot` option.
• Snapshot discovery must occur during explicit builds (activation/upgrade), never on every page load.
• Runtime code must read from the snapshot, not from live directory scans.
• The authoritative server-side snapshot may contain execution metadata required by PHP authorities.
• Any frontend-facing projection of the snapshot must be sanitized before publication.

4.3 CanvasRepository (CanvasRepository.php)
• The CPT-backed authority for workspace identity.
• Maps logical workspace IDs (slugs) to `systemdeck_canvas` posts.
• Responsible for synchronizing block-editor content into runtime layout state.
• Owns the workspace-to-canvas mapping and canvas metadata (access, locks, visibility).

4.4 StorageEngine (StorageEngine.php)
• The persistence controller for all runtime state.
• Maps logical keys to physical storage (User Meta, `sd_items`, `sd_context_state`).
• Owns the persistence of layout, pins, and telemetry snapshots.
• Buffers transient writes until shutdown to minimize DB overhead.

4.5 Bootloader Publication Boundary
• The Bootloader may publish runtime bootstrap globals only in sanitized form.
• Published widget manifests must exclude server-only execution metadata including asset declarations, tunnel asset declarations, file paths, class names, and callbacks.
• The runtime payload must expose only the fields required for client-side discovery, labeling, capability-aware visibility, and render-mode selection.

⸻

5. Orchestration Services

SystemDeck utilizes specialized services to bypass standard WordPress bottlenecks.

5.1 The Router (Router.php)
• A high-performance, lightweight request handler that bypasses `admin-ajax.php`.
• Authority for `sd_action` endpoints (Manifest hydration, Layout saving, Workspaces).
• Enforces the Nonce Authority for all direct system calls.

5.2 The Harvester (Harvester.php)
• Responsible for extracting structural metrics (`theme.json`) from the WordPress site.
• Operates as a "read-only" intelligence layer for the Forensic Inspector.
• Normalizes style values (RGB, Typography, Spacing) for use in the spatial UI.

⸻

6. Stable Mode Guarantee

Stable Mode defines the minimum platform surface that must be operational for a SystemDeck installation to be considered healthy.

6.1 Guaranteed Behaviors
• Shell Boot: The platform must inject the shell and hydrate the bootstrap payload for authorized users.
• Workspace Load: The runtime must load the default user workspace and any accessible shared workspaces.
• Widget Render: Valid widgets must resolve through the bridge and attempt to render.
• Registry Authority: The snapshot must be the source of truth for runtime widget lookup.
• Telemetry: The platform must return structured diagnostics, failing gracefully when specific host metrics are missing.
• Asset Discipline: Registered widget assets must load only when required by an active enabled widget or by an already-placed widget that must resolve safely in an accessible workspace.

6.2 Operational Boundaries
• Failure to boot the shell or load a workspace constitutes a platform outage.
• Failure of an individual third-party widget does not constitute a platform outage, provided the host resolves it to a graceful error state.
• A disabled widget must not remain available for new placement only because it exists in the registry snapshot.
• A disabled widget that is already placed may continue to resolve for existing accessible layouts, but that exception must not broaden into general preload behavior.

⸻

END OF CONTRACT
