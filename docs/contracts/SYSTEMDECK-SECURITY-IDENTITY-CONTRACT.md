# SYSTEMDECK-SECURITY-IDENTITY-CONTRACT

Introduction

This document defines the canonical identity rules and security protocols for the SystemDeck platform.

Consistency in identification is critical for a multi-workspace, collaborative environment. This contract governs how widgets, workspaces, and users are uniquely identified across the system, and how those identities are protected through secure runtime gateways.

It defines the boundaries between "Business Identities" (used by the UI and logic) and "Persistence Keys" (used by the database), as well as the single-authority nonce model that gates all persistent mutations.

⸻

1. Introduction

SystemDeck operates as a high-security extension of the WordPress environment. This contract ensures that all identifiers—from widget keys to user-scoped persistence slugs—follow a standardized nomenclature. By centralizing identity resolution and security authority (Nonces and Access Gates), the platform prevents architectural collision and protects user data across shared workspace boundaries.

2. File Tree

Security and identity are enforced by these core files:

systemdeck/
├── systemdeck.php (Access Gate)
├── core/
│   ├── Context.php (Runtime Context Signature)
│   ├── AjaxHandler.php (Nonce Verification)
│   ├── VaultManager.php (Secure Storage Gateway)
│   ├── UserPreferences.php (User Profile Authority)
│   ├── Defaults.php (System Standards)
│   ├── Services/
│   │   ├── CanvasRepository.php (Identity Resolution)
│   │   └── WidgetRuntimeBridge.php (ID Normalization)
│   └── Registry.php (Workspace Normalization)

⸻

3. Identity Domains

SystemDeck recognizes four primary identity domains. These identities are not interchangeable and must be resolved by their respective authorities.

3.1 Canonical Widget Identity
• The snapshot key in `sd_registry_snapshot['widgets']` is the authoritative widget ID.
• Pattern: Dotted notation (e.g., `core.notes`, `vendor.my-widget`).
• Rule: All runtime APIs must resolve to the `resolved_id` before execution.

3.2 Logical Workspace Identity
• The logical ID stored in `sd_workspaces` user meta.
• Pattern: Lowercase, slug-safe strings (e.g., `default`, `ws_vics_hideaway`).
• Rule: Comparisons must use sanitized IDs, never human-readable display names.

3.3 Canvas Persistence Identity
• The CPT post ID of the `systemdeck_canvas` record.
• Role: Acts as the primary storage anchor for layout and pins inside the `sd_items` table.
• Rule: Logic must never derive business identity from a canvas post ID.

3.4 User Identity
• The WordPress User ID.
• Role: Bridges ownership, permissions, and workspace sharing visibility.

⸻

4. Security Authority

4.1 Nonce Authority
• Canonical Nonce: `systemdeck_runtime`.
• Responsibility: All AJAX and REST mutations (saving layout, deleting notes, pinning items) must verify against this single authority.

4.2 Access Gatekeeping
• `systemdeck_user_can_boot()`: Authorizes the initial shell injection.
• `AjaxHandler::verify_request()`: The runtime gate for all data mutations.
• `systemdeck_user_meets_workspace_access()`: Enforces the Sharing Mode (Private/Shared/Locked) for the active user.

4.3 Secure Storage (VaultManager.php)
• Operates as the gateway for sensitive user data and configuration.
• Manages encrypted or protected settings that bypass standard user meta filters.

⸻

5. Normalization & Context (Context.php)

5.1 The Request Context
• All system calls must wrap their parameters in a `Context` object.
• This ensures that every operation is explicitly scoped to a `user_id` and `workspace_id` to prevent data leaking between workspaces.

5.2 Identity Normalization
• Underscore forms (e.g., `core_notes`) are compatibility inputs and must normalize to the dotted form (`core.notes`) upon resolution.
• The default workspace ID must always normalize to the string `default`.

⸻

6. Data Boundaries

6.1 Storage Keys
• `sd_items.workspace_id`: A persistence key that may hold either a workspace slug or a canvas post ID.
• Rule: Do not assume the storage key matches the logical workspace ID.

6.2 Runtime Item IDs
• Generated IDs (e.g., `sd_canvas_<seed>`) are runtime-only identifiers for canvas blocks.
• Rule: These IDs must not be used as widget IDs.

⸻

END OF CONTRACT
