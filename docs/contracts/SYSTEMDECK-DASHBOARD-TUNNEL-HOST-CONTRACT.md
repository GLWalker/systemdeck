# SYSTEMDECK-DASHBOARD-TUNNEL-HOST-CONTRACT

Introduction

This contract defines how dashboard-origin and third-party tunneled widgets are hosted in SystemDeck.
It exists to prevent regressions between native WordPress widget behavior and SystemDeck shell behavior.

⸻

1. Scope

This contract governs:
• Tunnel host shell ownership in WorkspaceCanvas/WidgetShell
• Tunnel iframe markup ownership in DashboardTunnel
• Tunnel CSS reset boundary (`sd-tunnel-overrides.css`)
• Dashboard-origin compatibility exceptions in tunneled context

This contract does not govern:
• Native WordPress dashboard rendering outside the tunnel route
• First-party non-tunneled SystemDeck widget rendering

⸻

2. Supported Host Modes

2.1 `tunnel_native`
• Iframe keeps native WordPress postbox header and controls.
• Host shell must not duplicate header controls.

2.2 `tunnel_hosted` (Current Default)
• Host shell uses SystemDeck `WidgetShell` (`postbox sd-widget`) as visual/chrome authority.
• Iframe content is treated as content-only surface.
• Internal tunnel `.postbox-header` is hidden to avoid double chrome.
• Collapse/expand and width controls are owned by host shell.

⸻

3. Ownership Boundaries

3.1 Host Shell Owns
• Header title row in SystemDeck workspace
• Collapse/expand control
• Width/span controls
• Drag affordances and grid integration

3.2 Iframe Tunnel Owns
• Widget body rendering and plugin internals
• WordPress/dashboard JS runtime required for widget hydration
• Per-widget script/style handles resolved by queue + `tunnel_assets`

3.3 Forbidden Cross-Ownership
• Host shell must not restyle plugin internals directly by widget-local hacks.
• Tunnel CSS must not style non-tunnel pages.
• Tunnel content must not own workspace layout or shell controls.

⸻

4. Dashboard Context Requirements

For dashboard-origin widgets in tunnel:
• Simulate dashboard screen context (`index.php`) during enqueue.
• Ensure `get_current_screen()` dashboard semantics are available at enqueue time.
• Ensure core dashboard JS is available for JS-gated widgets (e.g., dashboard primary/news widgets).
• Discovery/registry policy defaults to include all dashboard meta boxes (core + third-party). Optional restriction is allowed only via `systemdeck_dashboard_widget_allowlist` filter.

⸻

4.1 Debug Activation Contract

• Tunnel debug logging is OFF by default.
• Debug logging is enabled only when `sd_tunnel_debug=1` is present on the request URL.
• Host routes that generate tunnel iframes must forward `sd_tunnel_debug=1` from the parent URL into the iframe query string.
• Expected usage for operators: append `?sd_tunnel_debug=1` to the parent SystemDeck/admin URL, then reload.

⸻

5. Tunnel CSS Contract

5.1 Scoping
• All tunnel reset rules must be scoped to `.sd-tunnel-content`.

5.2 Allowed
• Baseline control normalization for forms/buttons/tables/notices.
• Compatibility rules for iframe-specific breakage when narrowly scoped.

5.3 Not Allowed
• Unscoped global admin overrides.
• Overrides that change host shell behavior from inside tunnel CSS.

⸻

6. Known Exception Registry

Current approved exception:
• `.sd-tunnel-content #community-events { display: none !important; }`
Reason:
• Community Events module has unreliable behavior in tunneled iframe context and is non-critical relative to broader dashboard parity.

Any new exception must include:
• selector
• reason
• scope
• rollback condition

⸻

7. Definition of Done (Tunnel Hosted)

A tunneled dashboard widget is compliant when:
1. It renders inside SystemDeck `WidgetShell` with single host header chrome.
2. Iframe internal duplicate header chrome is suppressed.
3. Required WP/dashboard assets and JS hydration run in tunnel.
4. Tunnel CSS remains fully scoped to `.sd-tunnel-content`.
5. Known exceptions are documented in this contract.

⸻

8. Widget Discovery Lifecycle Contract

This section defines operator-safe recovery and repopulation behavior for dashboard/third-party widget discovery.

8.1 `Purge Widgets` (Tools)
• Action: `sd_purge_widgets`
• Must delete all rows from `wp_sd_discovered_widgets`.
• Must remove `origin=dashboard|discovered` definitions from `sd_registry_snapshot.widgets`.
• Must sanitize current-user registry enablement so removed IDs do not remain selected.
• Result: registry/scanner return to core-only baseline until repopulation actions are run.

8.2 `Rebuild Registry Snapshot` (Registry)
• Action: `sd_rebuild_registry_snapshot`
• Must rebuild canonical snapshot (`RegistryService::build_snapshot()`).
• Must refresh discovered cache (`RegistryService::refresh_discovered_widget_cache()`).
• Must return diagnostics payload:
• `snapshot_widget_count`
• `live_dashboard_widget_count`
• `scanner_cache_refresh_count`
• `requested_missing_ids` (when requested IDs are passed)
• Result: one-button recovery path for “missing widget” investigations.

8.3 `Widget Scanner` (Scanner)
• Must read from `sd_get_discovered_widgets`.
• Scanner feed authority order:
1. snapshot (`origin=dashboard|discovered`)
2. live dashboard discovery
3. active-plugin source candidates (`wp_add_dashboard_widget` parse)
4. settings/meta candidates only when corroborated by active-plugin source evidence
• Scanner must not treat stale settings/meta IDs as authoritative on their own.

8.4 Stale Candidate Policy
• Deactivated/deleted plugins may leave legacy IDs in WordPress dashboard settings/meta.
• Those IDs must not survive discovery unless corroborated by current active-plugin evidence.
• Cache refresh must prune stale discovery-cache rows not present in current validated discovery set.

8.5 Operator Runbook
1. To hard reset dashboard/third-party discovery state: run `Purge Widgets`.
2. To repopulate deterministically: run `Rebuild Registry Snapshot`.
3. To verify UI feed and capture visibility: run `Widget Scanner`.
4. If a widget is still missing, inspect diagnostics from rebuild response before applying widget-specific exceptions.

⸻

END OF CONTRACT
