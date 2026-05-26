# SYSTEMDECK-JSON-LLM.md

## 1. Purpose

This document represents the declarative-layer intelligence manifest for the SystemDeck plugin (Tier 2 Extension). It defines the build scripts, dependencies, and plugin metadata that govern the plugin's configuration-based behavior.

## 2. Symbols (Config & Metadata)

### Package Manifest
- **type**: symbol
- **name**: `package.json`
- **category**: config
- **description**: Centralized definition of plugin dependencies and development scripts.
- **extraction_confidence**: 1.0 (Root Config)
- **usage_confidence**: 1.0 (Stable)

### Asset Pack
- **type**: symbol
- **name**: `.assetpack.mjs`
- **category**: config
- **description**: Configuration for the PixiJS asset processing pipeline.
- **extraction_confidence**: 0.7 (Tooling Config)

## 3. Events (Scripts & Pipelines)

### Build Scripts
- **type**: event
- **name**: `npm run build`
- **category**: action
- **trigger**: Executes when compiling production-ready assets (JS/CSS).
- **description**: Standard `@wordpress/scripts` build sequence.
- **extraction_confidence**: 1.0 (Standard Script)

- **type**: event
- **name**: `npm run registry:build`
- **category**: action
- **trigger**: Executes when rebuilding the plugin's internal service registry.
- **description**: Custom SystemDeck CLI command for server-side registry synchronization.
- **extraction_confidence**: 1.0 (Core Script)

- **type**: event
- **name**: `npm run assetpack`
- **category**: action
- **trigger**: Executes when processing PixiJS assets.
- **description**: Runs the AssetPack core utility with the plugin's configuration.
- **extraction_confidence**: 0.7 (Feature Script)

## 4. Registrations (Dependencies)

### Frontend Dependencies
- **type**: registration
- **category**: lib
- **identifier**: `react`, `react-dom`, `react-grid-layout`
- **arguments**: { "version": "^16.14.0", "category": "frontend" }
- **callback**: `npm install`
- **extraction_confidence**: 1.0 (Locked Version)

### Library Extensions
- **type**: registration
- **category**: lib
- **identifier**: `pixi.js`, `motion`
- **arguments**: { "version": "^8.17.0", "category": "animation|graphics" }
- **callback**: `npm install`
- **extraction_confidence**: 1.0 (Locked Version)

## 5. Standard Patterns

### Tooling Orchestration
- The plugin utilizes `@wordpress/scripts` for standardized WordPress block and package management [**`package.json`**].
- Service-level discovery and registration are automated via the `registry:build` script pattern.

### Asset Processing
- PixiJS assets are processed via a dedicated **AssetPack** pipeline to optimize for hardware acceleration.
- Resulting assets are expected to reside in the [**`build/`**] or [**`assets/`**] distribution paths.

## 6. Output Discipline

- All configuration intelligence must be extraction-verified against the [**`wp-content/plugins/systemdeck/package.json`**] and manifest source files.
- Prefer standard WordPress dependency patterns before suggesting external libraries.
- Never invent script names; use those explicitly present in the `package.json` file.
