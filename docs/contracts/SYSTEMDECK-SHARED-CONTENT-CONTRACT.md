# SystemDeck Shared Content Contract

## Status: ENFORCED

This contract governs how SystemDeck widgets interact with shared content, workspace projections, object-level access, and comments.

Projection audience is governed jointly by this contract and the workspace layout contract. Canonical object ownership remains here; workspace visibility semantics come from workspace mode.

---

## Mandatory Core Services

The following services are **mandatory** for all widgets that handle shared or projected content:

| Service | Path | Purpose |
|---------|------|---------|
| `ObjectAccessGate` | `core/Services/ObjectAccessGate.php` | Single-object authorization (read/write/comment) |
| `ProjectionService` | `core/Services/ProjectionService.php` | Workspace projection sync/remove/purge |
| `CommentService` | `core/Services/CommentService.php` | Comment tree retrieval and access-gated insertion |

---

## Five Invariants

### 1. Canonical Widget Datasets Are Author-Scoped

A widget's primary data endpoint MUST include `'author' => $user_id` in WP_Query args.

The canonical list shows **only the current user's own objects**. Other users' objects MUST NOT be mixed into this list.

**Violation**: Omitting `'author' => $user_id` from the primary query.

### 2. Projections Do Not Expose Canonical Lists

A projection writes to `sd_items` and makes a single object visible on a workspace pin board. It does NOT:
- Add the object to another user's canonical widget list
- Expose the projecting user's full widget inventory
- Grant edit access to non-authors
- Change canonical object ownership

**Violation**: Querying `sd_items` to build a canonical widget list.

### 3. Non-Authors Get Read/Comment Access Only Through Approved Projected Surfaces

When a user requests a single object by ID (detail view, comments, stream), access MUST be resolved through `ObjectAccessGate::resolve()`:
- **Author** → full access (view, edit, comment)
- **Non-author + scope matches projected value + workspace membership** → view + comment only
- **Otherwise** → `Access denied`

**Violation**: Inline author/workspace access checks. All access resolution MUST go through `ObjectAccessGate`.

### 4. Workspace Projection Writes Require workspace_edit Access

Before creating or updating a projection into a workspace, the handler MUST call `ObjectAccessGate::require_workspace_write($user_id, $workspace_id)`.

No workspace_id should be accepted for projection without this verification.

**Violation**: Accepting workspace_id for projection without calling `require_workspace_write()`.

### 5. Projection Sync/Remove/Purge Goes Through ProjectionService

All projection lifecycle operations MUST use:
- `ProjectionService::sync()` — create or update
- `ProjectionService::remove()` — remove by object ID
- `ProjectionService::purge_workspace()` — bulk removal on workspace deletion

Direct writes to `sd_items` from widget code are forbidden.

**Exception**: `StorageEngine`, `CanvasRepository`, and `AjaxHandler::purge_workspace_for_all_users()` may access `sd_items` directly as infrastructure-level table owners — they do not perform widget-level projection logic.

---

## Workspace Audience Law

A projection pin inherits workspace visibility semantics from the target workspace in the same way widget placement does.

Meaning:
- in a shared owner-only workspace, non-owner projection changes are member-local only
- in a collaborative workspace, authorized projection changes are workspace-wide

Rules:
- canonical object ownership remains unchanged
- projection audience is determined by workspace mode
- pins must not invent a separate sharing model from widgets
- projection visibility must not be inferred from object scope alone

This contract governs object authority and projection mechanics. Workspace mode governs who sees the projection mutation.

---

## Scope Vocabulary

Scope values are **widget-defined** and MUST be passed explicitly to core services as parameters.

| Widget | Private Scope | Projected Scope | Scope Meta Key |
|--------|---------------|-----------------|----------------|
| Notes | `private` | `pinned` | `_sd_note_scope` |
| Vault | `personal` | `shared` | `_sd_vault_scope` |

Core services MUST NOT normalize or reinterpret scope values. They operate strictly on the values provided by the `$shared_val` parameter.

---

## Comment Service Contract

1. Comment retrieval MUST use `CommentService::get_comment_tree($post_id)`.
2. Comment insertion MUST use `CommentService::add_comment(...)`.
3. `add_comment()` integrates `ObjectAccessGate::resolve()` internally — it is impossible to insert a comment without passing the access check.
4. Direct use of `wp_insert_comment()` or custom comment tree builders inside widgets is **forbidden**.

---

## Author-Only Write Operations

For operations that mutate an object (update, delete, export, scope change), the handler MUST call `ObjectAccessGate::require_author($object_id, $post_type, $user_id)`.

This replaces all inline `get_post()` + `post_author !== get_current_user_id()` patterns.

---

## New Widget Checklist

Any new widget implementing shared or projected content MUST:

- [ ] Use `'author' => $user_id` in canonical queries
- [ ] Use `ObjectAccessGate::resolve()` for single-object read/comment access
- [ ] Use `ObjectAccessGate::require_author()` for write operations
- [ ] Use `ObjectAccessGate::require_workspace_write()` before projection
- [ ] Use `ProjectionService::sync()` for projection lifecycle
- [ ] Use `CommentService::get_comment_tree()` for comment retrieval
- [ ] Use `CommentService::add_comment()` for comment insertion
- [ ] Define widget-specific scope vocabulary and pass it as parameters
- [ ] Ensure projection audience follows workspace collaboration mode
- [ ] NOT implement any of the above logic inline

Reimplementation of these patterns inside a widget is a **contract violation**.
