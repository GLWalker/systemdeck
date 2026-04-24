SYSTEMDECK TIME MONITOR CONTRACT

⸻

0. HUMAN-READABLE INTRODUCTION

This contract defines the Time Monitor widget as a SystemDeck Pixi widget.

It governs:
• widget identity
• file ownership
• DOM mount contract
• normalized data schema
• runtime state transitions
• the approved vNext wireframe component tree

This contract applies to:
• `widget.php`
• `app.js`
• `pixi-scene.js`
• `pixi-hud-dress.js`
• all agents modifying the Time Monitor widget

This contract is authoritative for the widget directory.

⸻

1. FILE TREE

`widgets/time-monitor/`
├── `widget.php`
├── `app.js`
├── `pixi-scene.js`
├── `style.css`
└── `SYSTEMDECK-TIME-MONITOR-CONTRACT.md`

⸻

2. WIDGET IDENTITY

2.1 Widget Registration

The widget is registered in `widget.php` with:
• `ID = 'core.time-monitor'`
• `TITLE = 'Time Monitor'`
• `ICON = 'dashicons-clock'`

2.2 Renderer Mode

The widget is a Pixi-enabled widget and must render with:
• `data-renderer="pixi"`
• `data-pixi-enabled="1"`

2.3 Purpose

Time Monitor exists to visualize:
• current server time
• current WordPress local time
• current browser time
• server uptime
• ping latency
• drift and sync state across those sources

⸻

3. FILE OWNERSHIP

3.1 `widget.php`

Must:
• register the widget
• emit the widget shell
• emit the Pixi stage mount
• emit accessibility/live-region nodes
• emit bootstrap data attributes needed by runtime

Must not:
• render final instrument visuals
• render telemetry rows as primary UI
• own chart layout

3.2 `app.js`

Must:
• locate widget instances
• mount and destroy renderer instances
• fetch telemetry
• normalize telemetry
• own runtime state transitions
• bridge DOM semantics to Pixi visuals

Must not:
• define final HUD styling
• freehand widget chrome

3.3 `pixi-scene.js`

Must:
• build the scene graph
• own visual layout inside the widget body
• receive normalized payload only
• render rows, controls, chart, and status visuals

Must not:
• fetch telemetry
• normalize raw server responses
• own WordPress shell markup

3.4 `pixi-hud-dress.js`

Must:
• provide optional visual dressing for the Time Monitor scene only

Must not:
• replace shared HUD component behavior when the shared component is sufficient

3.5 CSS Files

`style.css` owns:
• widget shell styling
• fallback DOM styling
• shell-level spacing and visibility behavior
• Pixi layer integration styling

⸻

4. DOM MOUNT CONTRACT

4.1 Required Outer Root

Each widget instance must render:
• `.sd-time-monitor-module`
• `data-widget="time-monitor"`
• `data-renderer="pixi"`
• `data-pixi-enabled="1"`

4.2 Required Data Attributes

The root must expose:
• `data-tz-server`
• `data-tz-wp`
• `data-tz-browser`
• `data-ping-ms`
• `data-ping-status`

4.3 Required Internal Nodes

The widget markup must include:
• `[data-role="shell"]`
• `[data-role="pixi-stage"]`
• `[data-role="fallback"]`
• `[data-role="status"]`
• `[data-role="ping-button"]`

4.4 Accessibility Contract

DOM owns:
• live region semantics
• screen-reader status text
• hidden button semantics for ping action

Pixi owns:
• visual rendering only

⸻

5. RUNTIME OWNERSHIP

5.1 Runtime Bootstrap

`app.js` must:
• discover `.sd-time-monitor-module[data-pixi-enabled="1"]`
• mount one renderer per widget root
• destroy renderer cleanly on unmount

5.2 Scene Factory

Renderer creation must prefer:
• `window.SystemDeckTimeMonitorPixiScene.create`

It may fall back to a shared HUD engine path only if the dedicated scene factory is unavailable.

5.3 Renderer Input

The scene must consume a normalized payload only.

The scene update path is:
• `normalizeTelemetry(...)`
• `buildSnapshot(...)`
• `engine.update(snapshot)`

⸻

6. NORMALIZED DATA SCHEMA

6.1 Root Payload

The normalized payload shape is:

```js
{
  sampleTimestampMs,
  sources: {
    server,
    wp,
    browser
  },
  drift: {
    serverVsWpMs,
    serverVsBrowserMs,
    wpVsBrowserMs
  },
  uptime: {
    seconds,
    human
  },
  ping: {
    valueMs,
    status
  },
  sync: {
    label,
    severity,
    status
  },
  history: {
    serverBrowser,
    wpBrowser,
    serverWp,
    ping
  }
}
```

6.2 Source Object

Each source object must contain:

```js
{
	epochMs, timezoneLabel, displayLabel, status
}
```

Sources:
• `sources.server`
• `sources.wp`
• `sources.browser`

6.3 Drift Object

`drift` must contain millisecond deltas:
• `serverVsWpMs`
• `serverVsBrowserMs`
• `wpVsBrowserMs`

6.4 Uptime Object

`uptime` must contain:
• `seconds`
• `human`

6.5 Ping Object

`ping` must contain:
• `valueMs`
• `status`

Observed status values in runtime:
• `idle`
• `pending`
• `success`
• `error`

6.6 Sync Object

`sync` must contain:
• `label`
• `severity`
• `status`

Observed normalized label values:
• `DRIFT`
• `CHECKING`
• `SYNCED`

Observed normalized severity/status values:
• `critical`
• `warning`
• `normal`
• `unknown`

6.7 History Object

`history` must contain time-series arrays for:
• `serverBrowser`
• `wpBrowser`
• `serverWp`
• `ping`

⸻

7. STATE TRANSITIONS

7.1 Widget Runtime State

The widget runtime uses DOM/Pixi bridge states:
• `idle`
• `loading`
• `ready`
• `pending`
• `error`

7.2 Telemetry Refresh State Flow

Boot/mount flow:

1. instance mounts
2. telemetry refresh begins
3. DOM status may enter `loading`
4. normalized payload is built on success
5. renderer receives update
6. DOM status becomes `ready`

Failure flow:

1. telemetry refresh fails
2. DOM status message becomes `Telemetry unavailable.`
3. DOM status becomes `error`

7.3 Ping State Flow

Ping button flow:

1. user triggers ping
2. if already pending, action is ignored
3. `pingPending = true`
4. DOM ping button enters pending state
5. DOM status becomes `Pinging…`
6. DOM status state becomes `pending`
7. scene status becomes `{ label: "PINGING", status: "pending" }`
8. on success:
   • `ping.valueMs` updates
   • `ping.status = "success"`
   • DOM status returns to `ready`
9. on failure:
   • `ping.status = "error"`
   • DOM status becomes `Ping failed.`
   • DOM status state becomes `error`
10. finally:
    • `pingPending = false`
    • DOM ping button returns to idle

7.4 Drift Classification

`classifyDrift(ms)` must classify:
• `critical` when absolute drift is `>= 1000`
• `warning` when absolute drift is `>= 250`
• `normal` otherwise

7.5 Sync Severity Resolution

Sync severity must be derived from the maximum drift severity across:
• server vs wp
• server vs browser
• wp vs browser

⸻

8. CURRENT SCENE STRUCTURE

The current Pixi scene builds these visual groups:
• `rows`
• `rowDividers`
• `chartBg`
• `chartGrid`
• `chartLines`
• `chartMarkers`
• `chartFx`
• `scanlines`
• `footerRule`
• `legend`
• `controls`

The current primary rows are:
• `SERVER TIME`
• `WP LOCAL TIME`
• `BROWSER TIME`
• `SERVER UPTIME`

The current control area includes:
• ping button

⸻

9. APPROVED VNEXT WIREFRAME COMPONENT TREE

This section defines the approved component tree for the next Time Monitor rebuild using the current SystemDeck Pixi HUD library.

This is the target composition contract.

```text
TimeMonitorWidget
└── Card
    ├── CardHeader
    │   ├── CardTitle("Time Monitor")
    │   ├── CardSubtitle("Clock Drift & Sync Health")
    │   └── HeaderActions
    │       ├── IconButton(collapse)
    │       └── IconButton(close)
    ├── CardBody
    │   ├── Alert (conditional)
    │   │   └── TextTruncate / alert text
    │   ├── Tabs
    │   │   ├── Tab("Overview")
    │   │   ├── Tab("History")
    │   │   └── Tab("Details")
    │   ├── TabPanel("Overview")
    │   │   ├── CardListGroup flush
    │   │   │   ├── CardListItem("Server Time", value)
    │   │   │   ├── CardListItem("WP Local Time", value)
    │   │   │   ├── CardListItem("Browser Time", value)
    │   │   │   ├── CardListItem("Server Uptime", value)
    │   │   │   └── CardListItem("Ping", value)
    │   │   └── Button("PING")
    │   │       └── Spinner (conditional loading state)
    │   ├── TabPanel("History")
    │   │   ├── PlotFrame
    │   │   │   └── Drift/Ping chart
    │   │   └── ProgressBar("Sync Health")
    │   └── TabPanel("Details")
    │       └── Collapse(expanded = false by default)
    │           └── CardListGroup flush
    │               ├── CardListItem("Server vs WP", delta)
    │               ├── CardListItem("Server vs Browser", delta)
    │               ├── CardListItem("WP vs Browser", delta)
    │               ├── CardListItem("Last Check", timestamp)
    │               └── CardListItem("Timezone Sources", summary)
    └── CardFooter
        ├── CardText(sync label)
        └── CardText(last sample timestamp)
```

⸻

10. VNEXT VISUAL RULES

The approved Time Monitor rebuild must prefer:
• WordPress-aligned white card surfaces
• `4px` radius on non-round structural surfaces
• flush list-group rows for primary readouts
• alert-only escalation when needed
• stable ping button label `PING`
• spinner-only loading indicator inside the button

The approved rebuild must not:
• swap the ping button label during loading
• rely on ad hoc local button dressing when the shared button is sufficient
• mix telemetry normalization into scene code

⸻

11. IMPLEMENTATION RULES

11.1 Data Ownership

`app.js` owns:
• fetch
• normalization
• status transition control

`pixi-scene.js` owns:
• layout
• drawing
• visual update from normalized data

11.2 Text Contrast Ownership

Text color must resolve from the nearest owning surface.

If a component paints a surface, it owns text contrast for content inside that surface.

11.3 Button Loading Rule

The ping button must keep a stable label and use spinner-only loading feedback.

11.4 Alert Rule

Alerts in Time Monitor must follow the shared WordPress-style notice pattern.

⸻

12. COMPLETION CRITERIA FOR THE NEXT REBUILD

The next Time Monitor rebuild is complete only when all are true:

1. the widget consumes the normalized schema defined in this contract
2. the widget renders through the approved vNext component tree or a stricter equivalent
3. the ping button keeps a stable label
4. drift and sync state are visible without reading chart details
5. details are disclosed, not always expanded
6. Pixi remains visual-only
7. DOM remains semantic-only
