# SystemDeck

**WP Admin. Anywhere.**

SystemDeck is a high-performance runtime shell for WordPress that turns wp-admin into a unified workspace. It brings widgets, screens, pins, telemetry, tunnel-hosted dashboard content, and a React-powered command surface into one installable plugin.

## What It Does

-   Creates shareable workspaces inside WordPress where users can organize the tools and information they need
-   Lets users drop in widgets for notes, private vault storage, media, database browsing, telemetry, and more
-   Supports pins, widgets, and apps as distinct building blocks so the workspace can stay lightweight or grow into a full operational dashboard
-   Makes it easy to leave notes on pages, collect assets, track site information, and collaborate around features or implementation work
-   Includes Pixi-powered runtime visuals for telemetry and chart-style data surfaces
-   Supports tunnel-hosted dashboard content so legacy or third-party admin widgets can be pulled into the SystemDeck environment
-   Is built to be expandable: third parties can register and load their own apps, widgets, and pins through the registry system

## Core Ideas

SystemDeck is structured around three extension types:

-   **Widgets** for larger workspace tools and content panels
-   **Pins** for focused, quick-access utilities and contextual data
-   **Apps** for broader feature surfaces and workspace-level experiences

That structure lets SystemDeck work as both a personal admin cockpit and a platform other developers can extend.

## Key Features

-   **Workspace-based admin UI**: build task-specific WordPress workspaces instead of bouncing between disconnected admin screens
-   **Notes and collaboration**: keep notes close to the pages, screens, and features you are actively working on
-   **Private vault storage**: upload and manage private files inside the SystemDeck environment
-   **Telemetry surfaces**: view system telemetrics and operational signals directly in the workspace
-   **Pixi-powered visuals**: use high-performance canvas rendering for charts, telemetry, and richer visual runtime components
-   **Responsive inspection**: SystemDeck includes responsive inspection and forensic tooling aimed at showing how a site is actually put together across layouts and breakpoints
-   **Forensic analysis**: inspect layout, structure, and rendering behavior in a way that makes the construction of a site easier to understand, debug, and extend

## Extensibility

SystemDeck is designed to be a platform, not just a fixed plugin.

-   Third parties can build custom widgets, pins, and apps
-   Runtime components can be registered and loaded through the SystemDeck registry
-   The workspace model is intended to support both built-in tools and project-specific extensions

## Requirements

-   WordPress 6.7+
-   PHP 8.0+

## Install

1. Download or clone this repository into `wp-content/plugins/systemdeck`
2. Activate **SystemDeck** in WordPress admin
3. Open the SystemDeck screens in wp-admin

## Runtime-First Repo

This repository is set up so the plugin can be installed and run directly from Git.

Tracked runtime assets include:

-   PHP plugin code
-   shipped JS/CSS/assets
-   `assets/runtime/` bundles
-   widgets, modules, pins, templates, and admin pages

Ignored development-only material includes:

-   `node_modules/`
-   `src/`
-   `tests/`
-   build tooling and local docs/dev files not required to run the plugin

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
