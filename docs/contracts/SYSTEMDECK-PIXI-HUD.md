SYSTEMDECK PIXI HUD CONTRACT

⸻

0. HUMAN-READABLE INTRODUCTION

This contract defines the complete Pixi HUD rendering system used by SystemDeck.

It governs how Pixi integrates with widgets, how scenes are structured, how visuals are rendered, and how data flows from telemetry systems into visual components. It establishes strict rules for layout, typography, color, surfaces, motion, and component composition.

This contract applies to:
• all Pixi HUD engine code
• all widget Pixi scenes
• all HUD components
• all agents implementing or modifying Pixi-based UI

Its purpose is to ensure:
• consistent rendering behavior across all widgets
• elimination of layout drift and duplicated UI logic
• strict separation between data, structure, and visuals
• a unified visual language aligned with WordPress admin

This contract is authoritative and must be followed exactly.

Widget loading and mount order are governed by the widget runtime contract:
`SYSTEMDECK-WIDGET-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`.
This Pixi contract governs inner rendering behavior after mount.

⸻

CONTRACT HIERARCHY

1. Widget loading/mount authority: `SYSTEMDECK-WIDGET-LOADING-STRUCTURE-RUNTIME-CONTRACT.md`
2. App policy authority (workspace visibility, app launch, app lock rules): `SYSTEMDECK-APP-RUNTIME-CONTRACT.md`
3. Pixi rendering authority (inner scene/render behavior after mount): this document
4. On conflict: Pixi rendering rules must not override widget loading/mount order.

⸻

1. FILE TREE

systemdeck/
├── assets/
│ └── js/
│ └── runtime/
│ └── pixi-hud-engine.js
│
├── widgets/
│ └── <widget-name>/
│ ├── widget.php
│ ├── app.js
│ ├── style.css
│ └── pixi-scene.js
│
└── docs/
└── SYSTEMDECK-PIXI-HUD.md

⸻

2. SYSTEM ROLE

Pixi HUD is responsible for:
• all visual rendering
• all chart rendering
• all layout inside widget body
• all data visualization

Pixi HUD must not:
• render WordPress UI
• replicate widget chrome
• perform data fetching
• implement telemetry logic

⸻

3. WIDGET → PIXI INTEGRATION

3.1 Required Files

Every Pixi widget must include:
• widget.php
• app.js
• style.css
• pixi-scene.js

⸻

3.2 widget.php

Must:
• register widget
• output Pixi mount container
• include accessibility region

Must not:
• render UI content
• render telemetry data
• contain layout logic

⸻

3.3 app.js

Must:
• listen for `systemdeck:widget:mount`
• initialize Pixi renderer after mount eligibility is satisfied
• mount scene into the widget-provided inner surface
• connect telemetry pipeline
• pass normalized data to scene
• manage resize lifecycle

Must not:
• render visuals
• define layout
• inject scripts/styles
• guess asset paths
• self-boot before runtime mount event

⸻

3.4 pixi-scene.js

Must:
• compose layout using HUD.Layout
• position components
• bind data
• handle rendering updates

Must not:
• fetch data
• define colors
• define typography
• define layout primitives
• define components
• manage widget mount lifecycle

⸻

3.5 CSS Roles

File Responsibility
style.css widget shell + Pixi integration styling

⸻

4. TELEMETRY DATA FLOW

4.1 Flow

Server → TelemetryStream → Intelligence → Self-Healing
↓
app.js
↓
pixi-scene
↓
HUD components

⸻

4.2 Scene Input Contract

Scenes must receive normalized payload:

{
sources,
drift,
uptime,
ping,
sync,
history
}

⸻

4.3 Restrictions

Scenes must:
• consume normalized data
• render only

Scenes must not:
• call APIs
• interpret raw data
• compute telemetry logic

⸻

4.4 Ownership

Telemetry systems own:
• normalization
• analysis
• adaptive behavior

Pixi owns:
• visualization only

⸻

5. DOM & ACCESSIBILITY

5.1 Rules
• no DOM fallback renderer
• Pixi owns visuals only
• DOM owns semantics

⸻

5.2 DOM Responsibilities
• widget structure
• widget inner Pixi surface container
• accessibility regions
• live regions
• fallback messaging

⸻

5.3 Pixi Accessibility

Allowed:
• interactive elements only

Forbidden:
• charts
• decorative visuals

⸻

6. CANVAS SCENE & DISPLAY

6.1 Core Principle

Pixi renders content only
Widget system owns structure
Runtime owns mount/asset ordering

⸻

6.2 No Wrapper Rule

Scenes must not create:
• outer cards
• duplicate panels
• fake margins

⸻

6.3 No Outer Padding

Scenes must not add global padding

⸻

6.4 Full Surface Rule

Scene must use:
• full width
• full height

⸻

6.5 Responsive Rules

Scenes must:
• reflow layout
• adapt components
• handle resize

Scenes must not:
• use fixed layouts
• scale entire scene

⸻

6.6 Resize Contract

On resize:
• layout recalculates
• chart recomputes
• text reflows

⸻

6.7 No Clipping Rule

No content may overflow or be hidden

⸻

6.8 Half-Width Rule

At ½ width:
• no clipping
• chart readable
• layout complete

⸻

6.9 Stretch & Shrink Rules

Layout must:
• expand cleanly
• compress gracefully

⸻

7. THEME & COLOR

7.1 Source

All colors come from:
• SystemDeckPixiHUD.Theme

⸻

7.2 Forbidden
• hex values
• rgb values
• CSS reads in scenes
• color values passed through component config unless originating from Theme

⸻

7.3 Required
• semantic palette
• tone system

⸻

7.4 Color Meaning

Color must represent:
• data source
• system state
• interaction

⸻

7.5 Surfaces

Surfaces must remain:
• neutral
• low contrast

⸻

8. TYPOGRAPHY

8.1 Source

All text must use:
• SystemDeckPixiHUD.Typography

⸻

8.2 Font

Roboto + system fallbacks only

⸻

8.3 Presets
• title
• section
• label
• value
• small

⸻

8.4 Restrictions

Scenes must not:
• define fonts
• define rendering behavior

Scenes and components must not:
• instantiate PIXI.Text directly
• construct text objects outside Typography
• resolve text color against anything other than the nearest owning surface

Text contrast must be resolved against the most immediate rendered background behind the text.
If a component paints its own fill, cap, row, panel, badge, or state surface, that component owns text contrast for content inside that surface.
If a child does not paint a new surface, it inherits contrast from the nearest parent surface.

⸻

9. SURFACE & DEPTH

9.1 Layers
• canvas
• panel
• panelSoft
• transparent

⸻

9.2 Rules
• no card stacking
• no heavy shadows
• no decorative containers

⸻

9.3 Structure

Use:
• banded rows
• separators
• spacing

⸻

10. COMPONENT SYSTEM

10.1 Rule

Scenes must use shared components only

⸻

10.2 Core Components
• DataRow
• MetricRow
• Button
• PlotFrame
• Chart
• Legend

⸻

10.3 Restrictions

Scenes must not:
• recreate components
• fork components
• redefine structure

Components are immutable shared primitives.

Scenes must not:
• modify shared component internals
• fork component structure inline
• reimplement an existing shared component locally

Any new reusable UI pattern must be added to the shared engine, not authored ad hoc inside a scene.

⸻

11. LAYOUT SYSTEM

Scenes must use:
• HUD.Layout

Layout is a two-phase system:

Engine owns:
• surface dimensions
• logical drawing area
• resize propagation

Scene owns:
• composition using layout output
• placement of shared components
• arrangement of visual groups inside the provided surface

All positioned objects must originate from HUD.Layout operations.

Objects not bound through HUD.Layout are considered invalid layout usage.

Scenes must not:
• hardcode dimensions as structural layout
• use fixed coordinates as layout authority
• calculate global viewport scaling
• apply full-scene transform scaling as a layout substitute

⸻

12. MOTION & INTERACTION

12.1 Principle

Motion must reflect state change

⸻

12.2 Rules
• no idle animation
• no decorative motion
• must be interruptible

⸻

12.3 Timing
• 120–300ms standard

⸻

12.4 Interaction Chain

input → confirmation → data → visualization

⸻

13. PERFORMANCE

Scenes must:
• reuse objects
• avoid per-frame allocation
• use bounded data

⸻

14. ENGINE RESPONSIBILITIES

Engine owns:
• theme
• typography
• layout
• components
• charts
• motion

⸻

14.1 Engine API Surface

The shared Pixi HUD engine must expose the following namespaces as authoritative runtime systems:

• `SystemDeckPixiHUD.Theme`
• `SystemDeckPixiHUD.Typography`
• `SystemDeckPixiHUD.Primitives`
• `SystemDeckPixiHUD.Layout`
• `SystemDeckPixiHUD.Animation`
• `SystemDeckPixiHUD.Interaction`
• `SystemDeckPixiHUD.Components`
• `SystemDeckPixiHUD.Charts`
• `SystemDeckPixiHUD.Icon`

The following methods are mandatory where applicable:

Theme
• `getColors()`
• `getColor(name, fallback)`
• `getStateColor(state, fallback)`
• `getToneColor(name, variant, palette, fallback)`
• `createPalette(type)`

Typography
• `create(...)`
• preset helpers owned by Typography

Layout
• `box(...)`
• `inset(...)`
• `row(...)`
• `column(...)`
• `grid(...)`
• `align(...)`
• `centerIn(...)`
• `plotPoints(...)`

Components
• shared component factories only

Scenes may only consume these systems.
Scenes must not redefine equivalent systems locally.

⸻

15. SCENE RESPONSIBILITIES

Scenes must:
• compose UI
• bind data
• render visuals

Scenes must not:
• define systems
• fetch data
• compute logic

⸻

16. ACCEPTANCE CRITERIA

System is valid when:
• no hardcoded colors exist
• layout is fully responsive
• no clipping occurs
• telemetry is externalized
• typography is consistent
• UI matches WordPress admin
• components are reused consistently

⸻

17. FINAL SYSTEM LAW

Pixi HUD is the visual runtime of SystemDeck

It is:
• not optional
• not duplicated
• not overridden

⸻

18. CONTRACT ENFORCEMENT SUMMARY

Violations include:
• hardcoded colors
• custom typography
• layout duplication
• DOM fallback rendering
• telemetry logic inside scenes
• component reinvention

Any violation is considered incorrect implementation.

⸻

18.1 Enforcement Model

The shared Pixi HUD engine is responsible for enforcing contract boundaries.

The engine must reject or warn on:
• direct color ownership outside Theme
• direct typography ownership outside Typography
• layout duplication outside HUD.Layout
• component reinvention where a shared component already exists

Scenes are invalid if they:
• bypass Theme for colors
• bypass Typography for text creation
• bypass Layout for structural composition
• recreate shared components locally

Where hard failure is not practical, the engine must emit runtime warnings.
Silent architectural drift is not permitted.

⸻
