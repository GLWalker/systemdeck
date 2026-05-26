# SYSTEMDECK CONTRACT — WIDGET LOADING & MOUNT RUNTIME

## 1. Purpose

Define the authoritative, deterministic lifecycle for how widgets:

-   are resolved
-   are rendered
-   load assets
-   mount into the DOM
-   become interactive

This contract eliminates:

-   implicit script execution
-   race conditions
-   loader drift
-   asset path guessing
-   double-mount bugs

This document is authoritative for widget loading and mount lifecycle.  
If any older contract text conflicts with this file on widget loading behavior, this file wins.

---

## Contract Hierarchy

1. Widget loading/mount authority: `SYSTEMDECK-WIDGET-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`
2. App policy authority (workspace visibility, app launch, app lock rules): `SYSTEMDECK-APP-RUNTIME-CONTRACT.md`
3. Pixi rendering authority (inner scene/render behavior after mount): `SYSTEMDECK-PIXI-HUD.md`
4. On conflict: loading/mount rules from this document take precedence.

---

## 2. Core Principle

Widgets do not self-execute.
The SystemDeck runtime controls all execution.

---

## 2.1 Canonical Pixi Widget Shell

Pixi widgets must render inside canonical widget shell identity:

```html
<article class="postbox sd-widget sd-pixi-widget" tabindex="0">
	<div class="inside">
		<div class="sd-pixi-surface"></div>
	</div>
</article>
```

Rules:

-   `.postbox` is shell authority
-   `.sd-widget` is widget identity
-   `.sd-pixi-widget` is renderer marker
-   `.inside` remains canonical content wrapper
-   `.sd-pixi-surface` is the Pixi host element; runtime manages canvas lifecycle inside it

---

## 3. Authority Model

| Layer                     | Responsibility                              |
| :------------------------ | :------------------------------------------ |
| RegistryService           | Widget definition + metadata                |
| WidgetRuntimeBridge       | Runtime resolution + render payload         |
| Assets.php                | Asset registration (handles + dependencies) |
| AjaxHandler               | Render endpoint                             |
| WidgetRenderer (frontend) | Render request + mount orchestration        |
| Widget Asset Loader       | Deterministic asset execution               |
| Widget App                | Responds to mount event only                |

### 3.1 App-Provided Widgets

Apps may provide widgets through the normal widget runtime, but app policy can restrict visibility and placement:

-   app workspace only
-   hidden from widget picker
-   non-removable root widget (app-governed)

Those policy decisions are managed by app/workspace contracts; loading/mount still follows this runtime contract.

---

## 4. Rendering Flow (Canonical)

### Step 1 — Request

Frontend requests widget render:
`WidgetRenderer → POST sd_render_widget`

---

### Step 2 — Server Resolution

`AjaxHandler → WidgetRuntimeBridge::render()`

Returns:

```json
{
	"html": "<div>...</div>",
	"resolved_widget_id": "...",
	"source_widget_id": "...",
	"assets_manifest": {
		"css": [],
		"js": []
	}
}
```

---

### Step 3 — HTML Injection

Frontend: `inject HTML → mount container`

Rules:

-   HTML is structure only
-   `<script>` tags inside HTML are ignored
-   No execution occurs at this stage

---

### Step 4 — Asset Loading (MANDATORY)

`SystemDeckWidgetLoader.ensureWidgetAssets(manifest)`

Loader rules:

-   CSS loads first
-   JS loads second
-   JS order = backend dependency order (no reordering)
-   Uses registered handles only
-   No path guessing
-   No inline execution

---

### Step 5 — Mount Eligibility Check

Mount may only proceed if:

-   HTML exists in DOM
-   ALL required assets are loaded
-   Widget not already mounted

---

### Step 6 — Mount Dispatch

```javascript
dispatchEvent("systemdeck:widget:mount", {
	widgetId,
	instanceId,
	workspaceId,
	element,
})
```

---

### Step 7 — Widget Boot

Widget JS must:

-   listen for mount event
-   initialize only once
-   bind to provided DOM node

For Pixi widgets, `app.js` must only boot scene runtime after this mount event and target the widget-provided inner surface.

---

## 5. Asset Manifest Contract

Returned from backend:

```json
{
	"css": [
		{
			"handle": "sd-widget-style",
			"src": "...",
			"ver": "1.0.0",
			"required": true
		}
	],
	"js": [
		{
			"handle": "sd-widget-app",
			"src": "...",
			"ver": "1.0.0",
			"required": true
		}
	]
}
```

### Rules

-   Handles must be registered via `Assets.php`
-   `required: true` blocks mount if load fails
-   `ver` must be present for cache control
-   No derived URLs allowed

---

## 6. Loader Rules (STRICT)

The loader:

**MUST**

-   load assets exactly once per handle
-   respect dependency order
-   log:
    -   loading
    -   loaded
    -   failed

**MUST NOT**

-   guess file paths
-   execute inline scripts
-   re-load already loaded assets
-   mount before assets resolve

---

## 7. Required Asset Failure Behavior

If a required asset fails:

-   widget **MUST NOT** mount
-   dispatch error event: `systemdeck:widget:error`
-   log failure with handle + widget id
-   render fallback UI (optional but recommended)

---

## 8. Mount Contract

-   **Event Name**: `systemdeck:widget:mount`
-   **Payload**:

```json
{
	"widgetId": "string",
	"instanceId": "string",
	"workspaceId": "string",
	"element": "HTMLElement"
}
```

---

## 9. Single-Mount Guard (MANDATORY)

Each widget root must enforce: `data-sd-mounted="true"`

Rules:

-   if present → abort mount
-   prevents:
    -   double initialization
    -   duplicate Pixi instances
    -   memory leaks

---

## 10. Prohibited Patterns

The following are forbidden:

❌ **Inline script execution**

```html
<script>
	initWidget()
</script>
```

❌ **Widget self-boot**

```javascript
document.querySelector(...).init()
```

❌ **Asset injection inside widget**

```javascript
const script = document.createElement("script")
```

❌ **Guessing asset paths**

```text
/wp-content/plugins/.../app.js
```

❌ **Mount before assets loaded**

---

## 11. UI State Interaction (Boundary Rule)

Widget loading/mount does not own user UI preference persistence.

-   Widget UI state (`collapsed`, `width`) is server-authoritative user meta.
-   Canvas/layout remains structural authority.
-   Widgets must not create parallel persistence paths for shell controls.

---

## 11. Logging Requirements

Loader must emit:

```text
[WidgetLoader] loading: <handle>
[WidgetLoader] loaded: <handle>
[WidgetLoader] failed: <handle>
```

Mount lifecycle:

```text
[WidgetMount] dispatch: <widgetId>
[WidgetMount] complete: <instanceId>
```

Failures:

```text
[WidgetError] <widgetId> <reason>
```

---

## 12. Transitional Cleanup Rule

After this contract is active:

-   all widget-specific loaders must be removed
-   all inline execution must be removed
-   all legacy boot paths must be removed

No hybrid systems allowed.

---

## 13. Definition of Done

A widget is considered correctly implemented only if:

-   renders via `sd_render_widget`
-   injects HTML only
-   loads assets via manifest loader
-   mounts via `systemdeck:widget:mount`
-   enforces single-mount guard
-   does not execute outside lifecycle
-   respects backend asset authority

---

## 14. Enforcement Model

This contract is:

-   non-optional
-   global across all widgets
-   required for Pixi and non-Pixi widgets alike

Any widget violating this contract is considered: **non-compliant and unstable**

---

## 15. Summary

SystemDeck widget lifecycle is now:
`Render → Inject → Load → Verify → Mount → Run`

Not:
`Inject → Hope → Break`

---

Use this as the companion enforcement contract.

---

# SYSTEMDECK CONTRACT — WIDGET LOADING & MOUNT ENFORCEMENT RULES

## 1. Purpose

Define the enforcement rules that make the Widget Loading & Mount Runtime contract auditable and repeatable.
This contract exists so Codex, other agents, and future maintainers can automatically detect and reject widget implementations that violate the approved runtime lifecycle.

This is not a conceptual contract.
This is an enforcement contract.

---

## 2. Enforcement Principle

A widget is not compliant because it "works."
A widget is compliant only if it follows the approved loading, asset, and mount rules.

---

## 3. Scope

These rules apply to all widgets, including:

-   standard widgets
-   Pixi widgets
-   widgets with `app.js` boot logic
-   widgets with CSS-only behavior
-   widgets rendered through `sd_render_widget`

This contract does not apply to:

-   pure modules launched outside widget runtime, unless they explicitly reuse widget mount flow
-   non-widget admin pages outside SystemDeck widget runtime

---

## 4. Canonical Runtime Rule

A compliant widget must follow this exact sequence:

1. render request
2. → HTML injection
3. → asset manifest load
4. → root confirmed in DOM
5. → `systemdeck:widget:mount` dispatched
6. → widget boot executes

Any alternate execution path is a violation unless explicitly contracted later.

---

## 5. Hard Prohibitions

The following patterns are forbidden and must be flagged.

### 5.1 Inline script execution in widget HTML

Forbidden:

```html
<script>
	...
</script>
```

or any widget render output relying on script tags embedded in HTML.

Reason:
Injected HTML is structure only, not execution authority.

---

### 5.2 Widget-local script injection

Forbidden:

```javascript
document.createElement("script")
document.createElement("link")
appendChild(script)
appendChild(link)
```

inside widget app code for runtime boot purposes.

Reason:
Assets must load through the shared widget asset loader only.

---

### 5.3 Asset path guessing

Forbidden:

-   hardcoded plugin-relative JS/CSS URLs
-   widget-local derived path construction
-   converting handles into guessed file paths

Reason:
Backend-registered handles are the only asset authority.

---

### 5.4 Self-boot on DOM scan without mount event

Forbidden as primary authority:

-   `document.querySelector(...)`
-   `setInterval(...)`
-   `MutationObserver(...)`
    used to initialize widget behavior without relying on `systemdeck:widget:mount`.

These may exist only as temporary internal mechanics during pilot debugging and must be removed once the shared loader path is active.

---

### 5.5 Multiple mount event systems

Forbidden:

-   `sd-widget-mount`
-   `sd_widget_mount`
-   any widget-specific custom mount event
-   dual mount listeners kept for compatibility

Allowed:

-   `systemdeck:widget:mount` only

---

### 5.6 Double initialization

Forbidden:

-   mounting the same widget root multiple times
-   creating duplicate Pixi instances
-   duplicate event binding due to repeated boot

Required:
Single-mount guard using a mounted marker.

---

## 6. Required Patterns

The following patterns are required.

### 6.1 Shared mount event listener

Widget JS must listen for: `systemdeck:widget:mount` and initialize only from that path.

---

### 6.2 Stable root targeting

Widget boot must target the DOM element provided by the mount payload or a deterministic child of that root.
It must not rely on:

-   ambiguous global selectors
-   unrelated matching nodes elsewhere in the page

---

### 6.3 Single-mount guard

Each widget root must enforce a mounted guard, such as: `data-sd-mounted="true"` or equivalent runtime guard with the same effect.

---

### 6.4 Manifest-only asset loading

If a widget requires JS/CSS, those assets must appear in the backend-provided manifest.
No hidden runtime dependencies are allowed.

---

### 6.5 Required asset failure handling

If a required asset fails:

-   mount must not proceed
-   failure must be logged
-   widget must not silently half-boot

---

## 7. Codex Auto-Check Rules

When auditing a widget, Codex must check the following.

### Rule A — No inline scripts in rendered widget HTML

Inspect:

-   `widget.php`
-   render callbacks
-   runtime HTML string builders

Flag any `<script>` tag or script-dependent HTML execution assumption.

---

### Rule B — No widget-local asset injection

Inspect:

-   `app.js`
-   widget-local JS helpers

Flag:

-   `createElement('script')`
-   `createElement('link')`
-   runtime asset append logic

---

### Rule C — No legacy mount events

Inspect all widget JS and runtime JS.
Flag any reference to:

-   `sd-widget-mount`
-   `sd_widget_mount`

Only `systemdeck:widget:mount` is allowed.

---

### Rule D — No guessed asset URLs

Inspect:

-   manifest builder
-   widget JS
-   runtime bridge

Flag:

-   `/widgets/<name>/...` guessed from handle names
-   string-built asset paths not coming from registered handles

---

### Rule E — Single-mount guard present

Inspect widget boot logic.
Flag if:

-   no mount guard exists
-   repeated mount can create duplicate renderer/instance/bindings

---

### Rule F — No self-boot outside runtime contract

Inspect widget JS.
Flag if the widget boots itself from:

-   immediate DOM ready scan
-   repeated polling
-   `MutationObserver`-only initialization

without using the canonical mount event as the execution authority.

---

### Rule G — Pixi widgets must still obey widget runtime

For Pixi widgets:

-   Pixi surface may exist inside widget body
-   Pixi app/scene may mount only after canonical widget mount
-   no Pixi-specific bypass of the shared widget loader

---

## 8. Warning-Level vs Error-Level Findings

### Error-level

These must be fixed before merge:

-   inline script execution
-   asset path guessing
-   widget-local script/link injection
-   legacy mount events
-   double-mount risk
-   required asset boot outside loader

### Warning-level

These should be cleaned soon, but may be transitional:

-   temporary debug logs
-   temporary compatibility guards
-   temporary observer fallback that no longer serves as primary authority

---

## 9. Required Audit Output Format

When Codex audits a widget against this contract, it must return:

### Section 1 — Pass/Fail Summary

-   compliant
-   partially compliant
-   non-compliant

### Section 2 — Violations

Each violation must include:

-   file
-   selector/function
-   rule violated
-   why it violates contract

### Section 3 — Transitional Warnings

List non-blocking but undesirable remnants.

### Section 4 — Fix Plan

Minimal file-scoped remediation plan.

---

## 10. Safe Search Patterns for Codex

Codex should search for these patterns when auditing:

-   `<script`
-   `createElement('script')`
-   `createElement("script")`
-   `createElement('link')`
-   `createElement("link")`
-   `sd-widget-mount`
-   `sd_widget_mount`
-   `systemdeck:widget:mount`
-   `appendChild(script)`
-   `appendChild(link)`
-   `/widgets/`
-   `wp-content/plugins/systemdeck/widgets/`
-   `MutationObserver`
-   `setInterval(`
-   `setTimeout(`
-   `data-sd-mounted`

These patterns are not proof by themselves, but they are the correct first-pass audit signals.

---

## 11. Merge Gate Rule

A widget must not be considered ready if it violates the loading/mount contract, even if it appears to function in one manual test.
Visual success does not override lifecycle non-compliance.

---

## 12. Transitional Cleanup Rule

Once a widget is migrated to the shared loader contract:

-   all widget-local loaders must be removed
-   all legacy mount listeners must be removed
-   all bypass boot paths must be removed

Leaving both systems in place is a violation.

---

## 13. Definition of Compliance

A widget is compliant only if:

-   it renders through the approved runtime path
-   its assets come from the backend manifest
-   it mounts only after assets are ready
-   it listens only to `systemdeck:widget:mount`
-   it prevents double initialization
-   it contains no hidden execution paths

---

## 14. Summary

This enforcement contract exists so Codex can answer a simple question:
_Does this widget follow the SystemDeck widget runtime contract, or is it sneaking around it?_

If it sneaks around it, it is rejected.
