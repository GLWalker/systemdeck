# Runtime Build Offloading

## Goal

Move SystemDeck toward a `100%` no-build runtime model while still using WordPress-provided dependencies such as:

- `wp-element`
- `wp-data`
- `wp-components`
- `wp-i18n`

The goal is not to remove React-style components. The goal is to remove the bundler requirement for shipped runtime UI.

---

## Desired End State

SystemDeck should be installable and runnable directly from the repository without requiring:

- `npm install`
- `npm run build`
- `src/index.js` as a required runtime entry
- `assets/runtime/systemdeck-runtime.js` as the central app bundle

Instead, runtime UI should be delivered as standalone browser-ready scripts and styles that are enqueued directly by PHP.

Those scripts may still depend on WordPress globals, for example:

```js
const { useState, useEffect } = wp.element
const { useSelect, useDispatch } = wp.data
const { Modal } = wp.components
const { __ } = wp.i18n
```

This keeps WordPress integration while removing the bundler as a delivery requirement.

---

## Current State

SystemDeck currently has three architectural patterns:

### 1. Standalone assets

These run without the runtime bundle and are already close to the desired model.

Examples:

- `assets/js/systemdeck-shell.js`
- `assets/js/sd-retail-system.js`
- `assets/js/sd-scanner.js`
- various PHP-rendered widget assets

### 2. Standalone assets using WordPress globals

These do not require the runtime build, but still depend on WordPress-provided packages.

Examples:

- `assets/js/sd-fse-sidebar.js`
- `assets/js/sd-widget-placeholder-block.js`
- `assets/js/sd-canvas-grid-block.js`
- `assets/js/sd-inspector-hud.js`

These prove that SystemDeck already supports the model we want.

### 3. Build-owned runtime app

This is the remaining bundled surface.

Examples:

- `assets/js/runtime/workspace/CanvasManager.js`
- `assets/js/runtime/workspace/canvases/WorkspaceCanvas.js`
- `assets/js/runtime/workspace/components/ScreenOptions.js`
- `assets/js/runtime/workspace/components/PinPicker.js`
- `assets/js/command-center/DiscoveryCanvas.js`
- runtime store/actions/selectors

This code currently depends on:

- ES module imports
- JSX transformation
- bundling into `assets/runtime/systemdeck-runtime.js`

---

## Guiding Principles

1. New components should be authored as standalone-owned pieces from the start.

2. Every new UI component should have its own local JS and CSS ownership.

3. Shared CSS should only contain truly shared primitives, not feature-specific blocks.

4. WordPress dependencies are allowed and preferred over reinventing working primitives.

5. The bundle should shrink over time. It should not remain the default destination for new UI.

6. Offloading should be incremental. Do not attempt to rewrite the full runtime shell in one pass.

---

## What “Offloaded” Means

A component is considered offloaded when:

- it is no longer sourced from the central runtime bundle
- it is delivered by its own directly enqueued script
- it has its own stylesheet or clearly owned style block
- it uses WordPress globals instead of module imports
- its PHP enqueue path is explicit and local

Example direction:

- current:
  - `import { Modal } from "@wordpress/components"`
  - bundled into `systemdeck-runtime.js`

- target:
  - `const { Modal } = wp.components`
  - enqueued directly as `pin-picker.js` with dependency `wp-components`

---

## Migration Strategy

### Phase 1: Component ownership

Continue extracting feature code out of shared files before changing delivery.

Required pattern:

- `ComponentName.js`
- `ComponentName.css`

This is already started for:

- `PinPicker`

This phase reduces blast radius and makes later offloading realistic.

### Phase 2: Offload leaf components

Move isolated components out of the build first.

Best candidates:

- `PinPicker`
- `ScreenOptions`
- `useConfirmDialog` / confirm modal flows
- smaller command-center panes
- UI pieces that do not bootstrap the whole workspace

These should be rewritten to use:

- `wp.element`
- `wp.data`
- `wp.components`
- `wp.i18n`

and then enqueued directly.

### Phase 3: Reduce bundle responsibility

After enough components are offloaded, the runtime bundle should only own:

- canvas bootstrapping
- workspace shell coordination
- core state/store wiring
- any truly app-level orchestration that still benefits from bundling

At this point the bundle becomes a small core, not the home for all UI.

### Phase 4: Decide final core strategy

Once only the app shell remains bundled, decide whether to:

- keep a very small build-owned shell
- or fully convert the remaining shell/store layer to standalone WordPress-global scripts

This decision should be made last, not first.

---

## Priority Order

### Priority A

- `PinPicker`
- `ScreenOptions`

Reason:

- modal-driven
- highly visible
- frequent iteration
- currently sensitive to shared CSS regressions

### Priority B

- shared modal helpers
- command-center tools panels
- discrete workspace UI blocks

### Priority C

- `CanvasManager`
- `WorkspaceCanvas`
- runtime store and shell coordination

These should move last.

---

## Technical Rules For Offloaded Components

When offloading a component:

1. No `import` from `@wordpress/*` in shipped runtime code.

2. No JSX in shipped direct-enqueue files unless a separate component-local build still exists.

3. Use explicit WordPress globals:

```js
const { useState, useEffect } = wp.element
const { Modal } = wp.components
const { __ } = wp.i18n
```

4. Enqueue dependencies in PHP explicitly.

5. Keep CSS local to the component.

6. Avoid feature styles in `common.css` unless they are truly shared.

7. Do not move a component out of the bundle until its ownership boundaries are clean.

---

## Immediate Next Step

The next candidate for true offloading should be:

- `PinPicker`

because it now has:

- its own component file
- its own stylesheet
- clear feature ownership

Before offloading `PinPicker`, do this:

1. Stabilize its UI again on the current bundled path.
2. Freeze its markup and CSS structure.
3. Rewrite it from module-import form to WordPress-global standalone form.
4. Enqueue it directly from PHP.
5. Remove it from the runtime bundle.

---

## Non-Goals

This plan does not require:

- removing WordPress dependencies
- abandoning React-style component patterns
- rewriting the whole plugin to vanilla JS immediately
- deleting the runtime bundle in one step

The goal is controlled offloading, not chaos.

---

## Success Criteria

This effort is successful if:

- new components stop defaulting to the runtime bundle
- feature UI becomes locally owned
- runtime CSS regressions stop spreading across unrelated features
- the bundled surface gets smaller over time
- direct repository installs continue to work without local build requirements

---

## Working Rule Going Forward

From this point forward, new components should be built as standalone-owned pieces first:

- local JS
- local CSS
- explicit dependencies
- minimal shared styling

If a component enters the bundle, that should be a conscious exception, not the default.
