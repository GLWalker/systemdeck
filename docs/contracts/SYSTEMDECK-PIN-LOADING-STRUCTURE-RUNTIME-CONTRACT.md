# SYSTEMDECK CONTRACT — PIN LOADING & MOUNT RUNTIME

## 1. Purpose

Define the authoritative, deterministic lifecycle for how pins:

- are resolved
- are rendered
- load assets
- mount into the DOM
- become interactive

This contract eliminates:

- implicit script execution
- race conditions
- loader drift
- asset path guessing
- double-mount bugs
- ad hoc pin boot paths

This document is authoritative for pin loading and mount lifecycle.  
If any older contract text conflicts with this file on pin loading behavior, this file wins.

---

## Contract Hierarchy

1. Pin loading/mount authority: `SYSTEMDECK-PIN-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`
2. Pin identity/persistence authority: `SYSTEMDECK-PIN-CONTRACT.md`
3. Metric taxonomy authority: `SYSTEMDECK-METRIC-TAXONOMY-CONTRACT.md`
4. Pixi render internals authority: `SYSTEMDECK-PIXI-HUD.md`
5. App/workspace policy authority: `SYSTEMDECK-APP-RUNTIME-CONTRACT.md`
6. On conflict: loading/mount rules from this document take precedence for pin runtime lifecycle.

---

## 2. Core Principle

Pins do not self-execute.  
The SystemDeck runtime controls all pin execution.

Pins are render surfaces, not micro-app shells.

---

## 3. Scope

This contract applies to:

- base pins (`pins/pin.php`, `pins/pin.js`)
- advanced pins (`pins/<pin-name-folder>/pin.php`, `app.js`, `style.css`)
- DOM pins
- Pixi pins

This contract does not apply to:

- widget runtime lifecycle (separate authority)
- third-party dashboard/widget discovery flows

---

## 4. File Structure Authority

### 4.1 Base pin lane (default)

```text
pins/
├── pin.php
├── pin.js
```

`pins/pin.php` owns:

- basic pin definitions
- basic server render callbacks
- base pin metadata and asset declaration

`pins/pin.js` owns:

- shared JS for basic pins
- shared mount handling for simple DOM pins

Base lane rule: keep pins in this lane unless they have real advanced needs.

### 4.2 Advanced pin lane

```text
pins/
├── <pin-name-folder>/
│   ├── pin.php
│   ├── app.js
│   └── style.css
```

Advanced lane is required for:

- Pixi pins
- renderer-specific JS lifecycle
- renderer-specific CSS/internal composition
- complex pin-local behavior not suitable for shared base lane

---

## 5. Authority Model

| Layer                  | Responsibility                            |
| :--------------------- | :---------------------------------------- |
| Pin Registry/Service   | Pin definition + metadata                 |
| Runtime Bridge         | Runtime resolution + render payload       |
| Assets authority       | Handle registration + dependency contract |
| Ajax render endpoint   | Render response authority                 |
| Frontend pin renderer  | Inject + loader + mount orchestration     |
| Pin app/scene runtime  | Responds to mount event only              |

---

## 6. Canonical Shell Authority

All pins must render inside canonical shell identity:

### Standard DOM pin

```html
<article class="postbox sd-pin" tabindex="0">
  <div class="inside">...</div>
</article>
```

### Pixi pin

```html
<article class="postbox sd-pin sd-pixi-pin" tabindex="0">
  <div class="inside">
    <div class="sd-pixi-surface"></div>
  </div>
</article>
```

Rules:

- `.postbox` is canonical shell authority
- `.sd-pin` is canonical pin identity
- `.sd-pixi-pin` is canonical Pixi marker
- `.inside` is shell-owned and must not be redefined by pin-local outer wrappers

Pins must not recreate card chrome, alternate shell wrappers, or nested postbox shells.

---

## 7. Rendering Flow (Canonical)

### Step 1 — Request

Frontend requests pin render from pin runtime endpoint.

### Step 2 — Server Resolution

Backend resolves:

- `pin_id`
- `instance_id`
- `renderer`
- HTML payload
- assets manifest

### Step 3 — HTML Injection

Frontend injects HTML structure only.

Rules:

- HTML is structure only
- script tags inside HTML are ignored
- no execution at injection stage

### Step 4 — Asset Loading (MANDATORY)

Shared loader resolves manifest:

- CSS first
- JS second
- backend dependency order only
- handles only (no guessed URLs)

### Step 5 — Mount Eligibility Check

Mount may proceed only if:

- HTML exists in DOM
- required assets are loaded
- pin root is stable
- pin is not already mounted

### Step 6 — Mount Dispatch

```javascript
dispatchEvent("systemdeck:pin:mount", {
  pinId,
  instanceId,
  workspaceId,
  element,
  renderer,
})
```

### Step 7 — Pin Boot

Pin JS/scene must:

- listen for mount event
- initialize once
- bind only to provided element/root

---

## 8. Asset Manifest Contract

Manifest shape:

```json
{
  "css": [
    {
      "handle": "sd-pin-example-style",
      "src": "...",
      "ver": "1.0.0",
      "required": true
    }
  ],
  "js": [
    {
      "handle": "sd-pin-example-app",
      "src": "...",
      "ver": "1.0.0",
      "required": true
    }
  ]
}
```

Rules:

- handles must be registered via backend asset authority
- `required: true` blocks mount if load fails
- `ver` is required for cache control
- no derived URLs, no string-built path loading

---

## 9. Loader Rules (STRICT)

Loader MUST:

- load assets once per handle
- respect dependency order
- log loading/loaded/failed states

Loader MUST NOT:

- guess file paths
- execute inline scripts
- re-load loaded handles
- mount before required assets resolve

---

## 10. Required Asset Failure Behavior

If a required asset fails:

- pin must not mount
- dispatch error event (`systemdeck:pin:error`)
- log failure with handle + pin id + instance id
- show fallback pin state (recommended)

---

## 11. Mount Contract

- Event name: `systemdeck:pin:mount`
- Payload:

```json
{
  "pinId": "string",
  "instanceId": "string",
  "workspaceId": "string",
  "element": "HTMLElement",
  "renderer": "string"
}
```

No alternate mount events.

---

## 12. Single-Mount Guard (MANDATORY)

Each pin root must enforce one-time mount guard:

- `data-sd-mounted="true"` (or equivalent canonical guard)

Rules:

- if mounted guard present, abort initialization
- prevents duplicate listeners/timers/scenes and memory leaks

---

## 13. Identity Rules

Runtime must distinguish:

- definition ID (`pinId` family/type identity)
- instance ID (`instanceId`, persisted/rendered unit identity)

Instance identity must not be guessed from transient DOM structure.

---

## 14. Basic vs Advanced Rules

A pin stays in base lane (`pins/pin.php` + `pins/pin.js`) unless it requires:

- unique renderer JS lifecycle
- unique CSS/internal composition
- Pixi runtime
- complex stateful behavior unsuitable for shared base code

Advanced pins must use dedicated folder lane.

---

## 15. Styling Authority

Shared pin shell/chrome styling must be owned by pin-shared style authority (not ad hoc per pin).

Advanced `style.css` files may only own:

- internal composition
- renderer-specific internals

Advanced pin CSS must not restyle global shell authority, workspace grid, or unrelated runtime surfaces.

---

## 16. Data Authority

Pins should serve live/system-governed data through approved runtime/service paths.

Pins must not rely on placeholder/demo data in production runtime paths unless explicitly marked as temporary development behavior.

---

## 17. Discovery/Registry Policy

Pins do not use third-party discovery ingestion comparable to widget scanner/registry capture.

SystemDeck pin availability is platform-authoritative:

- defined by SystemDeck pin runtime definitions
- surfaced via pin picker/runtime metadata
- no external third-party pin scraping lane

---

## 18. Prohibited Patterns

Forbidden:

- inline script execution in pin HTML
- `document.createElement('script'|'link')` pin-local bootstrap loading
- string-built asset path guessing (`/pins/...` hardcoded boot)
- shell recreation/nested postbox wrappers
- self-boot primary authority (DOM sweep + autonomous init outside mount event)

---

## 19. Definition of Done

A pin implementation is compliant only if:

1. It lives in correct base or advanced file structure.
2. It follows canonical shell authority.
3. It uses backend handle-based asset manifests.
4. It mounts only through canonical runtime flow.
5. It enforces single-mount guard.
6. It uses live/system-governed data paths (no accidental placeholder runtime).
7. It does not introduce third-party discovery assumptions.

---

## 20. Summary

Pin runtime model is:

`resolve → render → inject → load assets → confirm root → dispatch mount → run`

Not:

`render something → guess path → self-boot → hope`

---

END OF CONTRACT
