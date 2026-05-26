# SYSTEMDECK-GRID-RUNTIME-CONTRACT

Introduction

This document defines the authoritative runtime model for all SystemDeck grid systems.

SystemDeck has three grid lanes with separate ownership:
• Widget runtime grid
• Pin runtime grid
• Command Center grid

This contract defines their boundaries, placement authority, persistence authority, and responsive behavior requirements.

⸻

1. Scope

This contract governs:
• runtime grid computation
• drag/drop placement behavior
• persisted spatial state
• lane ownership boundaries
• breakpoint width resolution rules

This contract does not govern:
• widget internal rendering contracts
• pin payload taxonomy contracts
• dashboard tunnel host contracts

⸻

2. File Tree

The grid runtime system is defined by these files:

systemdeck/
├── src/
│   ├── canvases/
│   │   ├── WorkspaceCanvas.js (Widget + Pin Runtime Grid Authority)
│   │   └── CanvasManager.js (Canvas Routing Authority)
│   └── state/
│       ├── reducer.js (Canonical Workspace State)
│       ├── actions.js (Layout Action Authority)
│       └── controls.js (Persistence Side Effects)
├── assets/
│   ├── js/
│   │   └── command-center/
│   │       ├── DiscoveryCanvas.js (Command Center Grid Runtime)
│   │       └── discovery/
│   │           └── WorkspaceGridSection.js (Command Center Card Grid)
│   └── css/
│       ├── command-center/
│       │   └── DiscoveryCanvas.css (Command Center Grid Presentation)
│       └── sd-common.css (Pin Grid Shared Presentation)
└── core/
    ├── AjaxHandler.php (Layout/Pin Persistence Endpoints)
    └── Services/
        ├── StorageEngine.php (Persisted Spatial State)
        └── CanvasRepository.php (Canvas Spatial Projection Sync)

⸻

3. Lane Authorities

3.1 Widget runtime lane
• Owned by `WorkspaceCanvas.js`.
• Uses canonical desktop width state as the source of truth.
• Resolves responsive runtime span from canonical width at render time.
• Persists canonical x/y/w state for workspace widgets.

3.2 Pin runtime lane
• Owned by `WorkspaceCanvas.js`.
• Uses explicit pin x/y/w/h coordinates with responsive column rules.
• Persists pin coordinates as authoritative state.

3.3 Command Center lane
• Owned by `assets/js/command-center/*`.
• Uses management card grid behavior for operational UI.
• Does not own workspace runtime widget/pin placement persistence.

⸻

4. Runtime Placement Rules

4.1 Deterministic placement
• Runtime placement must be deterministic for a given canonical state.
• Local collision resolution is allowed.
• Global reorder side effects are forbidden.

4.2 Drag/drop rule
• Drag preview is visual-only until drop commit.
• On drop, only canonical layout state is updated.
• Runtime layout is recomputed from canonical state.

4.3 Collapse behavior
• Collapsed widgets keep canonical width.
• Collapsed row height is runtime-only presentation state.
• Expanded height restoration must preserve previous expanded geometry.

⸻

5. Persistence Rules

5.1 Canonical persistence
• Persist only canonical layout coordinates and canonical width state.
• Never persist runtime breakpoint-resolved span as canonical width.

5.2 Runtime-only measurements
• Runtime measured row heights are not canonical state.
• Runtime measurements are forbidden from being stored as canonical truth.

5.3 Service boundary
• All persistence writes flow through AJAX endpoint authorities.
• Storage authority remains in `StorageEngine.php`.

⸻

6. Responsive Behavior Rules

6.1 Widget lane
• Desktop canonical width is authoritative.
• Tablet/mobile spans are deterministic transforms of desktop canonical width.
• Tablet/mobile runtime transforms must not overwrite canonical desktop width.

6.2 Pin lane
• Pin lane column counts are responsive by viewport.
• Pin tile aspect rules are lane-owned and deterministic.

6.3 Command Center lane
• Command Center card grid may use lane-specific responsive rules.
• Command Center responsive rules must not mutate workspace canonical widget/pin coordinates.

⸻

7. Boundary Rules

• Command Center lane must not write widget/pin runtime placement logic.
• Widget lane must not own Command Center card presentation logic.
• Pin lane must not own widget width-option policy logic.
• Shared helper functions are permitted only if lane-neutral.

⸻

8. Failure and Safety Rules

• If grid recomputation fails, existing canonical state remains unchanged.
• Failed runtime recompute must not write corrupted coordinates.
• Drag/drop errors must fail closed (no destructive reorder).

⸻

END OF CONTRACT
