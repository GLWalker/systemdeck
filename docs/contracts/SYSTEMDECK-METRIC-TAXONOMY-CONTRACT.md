SYSTEMDECK-METRIC-TAXONOMY-CONTRACT

Status: ENFORCED

0. HUMAN-READABLE INTRODUCTION

This contract defines the binding metric taxonomy for SystemDeck.

Metric taxonomy governs how metrics are named, who owns them, how they are classified, and how they may be exposed into runtime systems such as pins, widgets, hydration snapshots, and renderer maps.

This contract exists to keep three different concerns separate:
- metric namespace
- metric authority
- metric mode

Without this split, SystemDeck risks conflating live telemetry, WordPress-owned diagnostics, and third-party/provider data into one unstable namespace.

This contract applies to:
- metric production
- metric normalization
- metric registration
- pin-safe exposure
- runtime hydration payloads
- pin picker grouping and filtering

It does not replace widget contracts, layout contracts, or renderer contracts. It supplies the binding metric authority that those contracts must respect.

1. FILE TREE

systemdeck/
├── core/
│   └── Telemetry.php
├── src/
│   └── canvases/
│       └── WorkspaceCanvas.js
├── assets/
│   └── js/
│       └── runtime/
│           ├── TelemetryStreamEngine.js
│           ├── telemetry-intelligence-engine.js
│           └── self-healing-engine.js
├── widgets/
│   ├── system-status/
│   │   ├── app.js
│   │   └── widget.php
│   ├── time-monitor/
│   │   ├── app.js
│   │   ├── pixi-scene.js
│   │   └── widget.php
│   └── health-bridge/
│       └── widget.php
└── docs/
    ├── SYSTEMDECK-METRIC-TAXONOMY-CONTRACT.md
    └── SYSTEMDECK-PIN-CONTRACT.md

2. CORE PRINCIPLE

Metric namespace, metric authority, and metric mode are separate concepts and must not be conflated.

Definitions:
- metric namespace answers: what family/key does this metric live in
- metric authority answers: who owns the underlying fact or collection
- metric mode answers: how the metric behaves operationally

These three concerns may align, but they are not interchangeable.

3. TOP-LEVEL FAMILIES

3.1 `core.*`

`core.*` is reserved for SystemDeck-owned metrics.

Use for:
- live telemetry
- sampled metrics
- browser-aware metrics
- rolling histories
- ping, drift, and sync calculations
- SystemDeck-derived operational monitoring
- metrics that SystemDeck intentionally monitors over time even if WordPress can also report a similar fact

Examples:
- `core.server_time`
- `core.browser_time`
- `core.wp_local_time`
- `core.ping`
- `core.sync_health`
- `core.db_size`

3.2 `wp.metrics.*`

`wp.metrics.*` is reserved for WordPress-owned metrics.

Use for:
- Site Health results
- debug/system info
- environment facts
- version/configuration facts
- core-owned health counts, statuses, and advisories
- mostly snapshot-based facts

Examples:
- `wp.metrics.health.critical_issues`
- `wp.metrics.health.loopback_status`
- `wp.metrics.env.php_version`
- `wp.metrics.env.db_version`
- `wp.metrics.updates.plugin_updates`

3.3 `third_party.*`

`third_party.*` is reserved for external/provider-owned metrics.

Use for:
- addon or integration metrics
- external service adapters
- imported status feeds

Examples:
- `third_party.cloudflare.bandwidth`
- `third_party.github.actions_status`

4. METRIC AUTHORITY CLASSES

Every governed metric must have one authority class.

Allowed values:
- `systemdeck`
- `wordpress`
- `third_party`
- `derived`

Definitions:
- `systemdeck`: computed, sampled, or collected by SystemDeck runtime authorities
- `wordpress`: sourced from WordPress core diagnostics, facts, or core-owned health subsystems
- `third_party`: sourced from an external provider, integration, or adapter
- `derived`: computed from one or more upstream metrics and normalized as a higher-order value

5. METRIC MODE CLASSES

Every governed metric must have one mode class.

Allowed values:
- `live`
- `sampled`
- `snapshot`
- `derived`

Definitions:
- `live`: runtime-updating behavior tied to active rendering or browser/runtime state
- `sampled`: repeatedly collected by SystemDeck over time
- `snapshot`: point-in-time fact or status
- `derived`: a computed presentation or analytical output built from upstream values

6. NAMESPACE RULES

Rules:
- dot notation only
- top-level prefixes must be stable
- no unqualified flat metrics
- no mixed ownership under one flat namespace
- `wp.metrics.*` must not be renamed to `wp.health.*`
- WordPress-owned metrics must not be moved into `core.*` unless SystemDeck is explicitly monitoring or trending that metric for a different purpose

Examples:
- allowed: `core.db_size`
- allowed: `wp.metrics.env.php_version`
- allowed: `third_party.cloudflare.bandwidth`
- forbidden: `db_size`
- forbidden: `health.loopback_status`
- forbidden: `wp.health.loopback_status`

7. WORDPRESS METRIC BOUNDARY

WordPress is the authority for diagnostics and facts that WordPress core already computes.

Rules:
- SystemDeck should ingest and normalize WordPress-owned values rather than recompute them where practical
- `wp.metrics.*` is the binding namespace for those values
- WordPress-owned values are snapshot-oriented by default
- WordPress does not provide a native live stream for Time Monitor-class behavior

Examples of appropriate `wp.metrics.*` usage:
- Site Health counts
- loopback status
- PHP version
- DB version
- update counts
- environment/configuration facts

8. SYSTEMDECK LIVE TELEMETRY BOUNDARY

SystemDeck remains the authority for browser-aware, live, sampled, history-based, and cross-source comparison metrics.

Rules:
- metrics that depend on browser context remain `core.*`
- metrics that depend on drift or cross-source comparison remain `core.*`
- metrics that depend on rolling history or trend buffers remain `core.*`
- metrics intentionally monitored over time by SystemDeck remain `core.*` even if WordPress can report a similar fact

This includes Time Monitor-class behavior:
- browser time
- drift comparisons
- ping orchestration
- rolling histories
- live rendering cadence

Time Monitor ownership must not be reassigned to `wp.metrics.*`

9. PIN EXPOSURE RULES

Not all governed metrics are pin-safe.

Rules:
- pin-safe metrics must be normalized before exposure
- raw Site Health blobs are not pin-safe
- raw debug-data payloads are not pin-safe
- raw third-party provider payloads are not pin-safe
- pin selectors and pin metric widgets must expose normalized subsets, not raw diagnostic payloads

Pin-safe exposure is a presentation decision layered on top of this taxonomy contract. This contract governs the upstream metric boundary that makes that decision possible.

10. CATEGORY / GROUPING GUIDANCE

User-facing grouping may present metrics by source group:
- core
- wp
- third-party

Additional category grouping may exist beneath the source group, for example:
- health
- env
- updates
- storage
- sync
- network

This grouping must support shared pin picker, metric selector, and renderer grouping workflows without changing the underlying namespace rules.

11. ANTI-PATTERNS (FORBIDDEN)

❌ Using `wp.health.*` as the top-level namespace  
❌ Treating snapshot diagnostics as live telemetry  
❌ Using flat mixed namespaces for different authorities  
❌ Exposing raw diagnostic blobs directly in the metric picker  
❌ Reusing widget registry origin strings as the authoritative metric taxonomy  
❌ Collapsing fact ownership and monitoring intent into one concept  
❌ Re-labeling WordPress-owned metrics as SystemDeck live telemetry without an explicit governed sampling layer  

12. REGISTRY ORIGIN SEPARATION

Existing widget origin or registry source values such as:
- `core`
- `dashboard`
- `discovered`
- `addon`

must not be reused as the authoritative metric taxonomy.

User-facing and contract-facing metric taxonomy remains:
- `core.*`
- `wp.metrics.*`
- `third_party.*`

Any mapping from registry internals into this taxonomy is implementation-side, not contract-side.

13. FACT OWNERSHIP VS MONITORING INTENT

A WordPress-owned fact may coexist with a SystemDeck-owned monitoring counterpart.

Example:
- `wp.metrics.env.db_version` is a WordPress-owned fact
- `core.db_size` is a SystemDeck-monitored operational metric

These must not be collapsed into one concept solely because they both concern the database.

14. ENFORCEMENT CHECKLIST

All metric registration and exposure systems must:
- use one of the approved top-level families
- assign one authority class
- assign one mode class
- keep namespace, authority, and mode separate
- place WordPress-owned diagnostics under `wp.metrics.*`
- keep Time Monitor-class live telemetry under `core.*`
- place external/provider-owned values under `third_party.*`
- normalize metrics before pin-safe exposure
- avoid raw diagnostic blob exposure in pin selectors
- avoid registry-origin leakage into the contract taxonomy

15. STEP 8 INTEGRATION LAW

Step 8 implementations must ensure:
- pins are registered against the correct metric family
- pin picker grouping and filtering use taxonomy authority
- renderer maps and pin-safe registration respect metric authority and metric mode
- WordPress-owned metrics are not mislabeled as SystemDeck live telemetry

This requirement is binding for pin registration, pin picker exposure, and renderer grouping work performed under Step 8.
