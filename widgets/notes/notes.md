# SystemDeck Notes Widget Contract

## 1. Purpose

This contract defines the current Notes widget runtime and data semantics implemented in source.

Authority sources:
- `widgets/notes/widget.php`
- `widgets/notes/app.js`
- `core/Services/ObjectAccessGate.php`
- `core/Services/ProjectionService.php`
- `core/Services/CommentService.php`

## 2. Scope

Applies to:
- CPT: `sd_note`
- Widget ID: `core.notes`
- Runtime list/edit/read/comment flows in the Notes widget

## 3. Files In Contract

`widgets/notes/`
- `widget.php` (CPT registration, AJAX data contract, projection hooks)
- `app.js` (list rendering, modal flows, interaction handlers)
- `style.css` (widget styles)

## 4. Canonical Data Model

Notes are canonical CPT records owned by `post_author`.

Primary meta keys:
- `_sd_note_scope` (`private` or `pinned`; legacy `sticky` and `personal` are normalized)
- `_sd_note_workspace_id` (active pinned destination)
- `_sd_note_workspace_name` (active pinned workspace label)
- `_sd_note_origin_workspace_name` (write-once origin label)
- `_sd_note_is_sticky` (ordering flag only)
- `_sd_note_sticky_level` (`urgent|high|moderate|low`)
- `_sd_note_context`
- `_sd_note_is_code`
- `_sd_note_code_content`

## 5. Semantics

### 5.1 Ownership
- Author is canonical owner.
- Author-only mutation is enforced through `ObjectAccessGate::require_author()` for edits/deletes.

### 5.2 Scope vs Sticky
- Scope controls projection:
  - `pinned` => projected into workspace
  - `private` => not projected
- Sticky (`_sd_note_is_sticky`) controls list ordering only.
- Sticky does not grant access and does not create projection.

### 5.3 Origin vs Active Workspace
- Origin workspace name is set on first save and retained.
- Active workspace (`_sd_note_workspace_id`) tracks the current pinned destination only.

## 6. Projection Contract

Projection is driven by `sync_pin_projection()` in `widget.php`, which delegates to `ProjectionService::sync()`:
- `scope === pinned` => create/update projection (`note`, projection state `pinned`)
- `scope === private` => remove projection
- Workspace purge/deletion flows force private and purge projection

Notes pins are workspace-scoped projection surfaces, not canonical note objects.

Rules:
- the note remains the canonical, author-owned record
- the projection is presentation-only
- widget code must not write `sd_items` directly
- projection lifecycle must remain inside `ProjectionService`
- projection audience follows workspace collaboration mode in the same way widget placement does
- shared owner-only workspaces keep non-owner projection changes member-local
- collaborative workspaces make authorized projection changes workspace-wide

## 7. Access Contract

Read/comment permissions for non-authors are resolved via `ObjectAccessGate::resolve(...)` using:
- scope meta key: `_sd_note_scope`
- workspace meta key: `_sd_note_workspace_id`
- shared scope token: `pinned`

Rules:
- Non-author may view/comment only when workspace access allows it.
- Non-author may not edit/delete canonical note content.

## 8. AJAX Surface (Notes Widget)

Implemented by Notes class methods and routed through SystemDeck AJAX registration:
- `sd_get_notes`
- `sd_save_note`
- `sd_pin_note` (legacy pin marker toggle)
- `sd_delete_note`
- `sd_get_read_note`
- `sd_get_all_notes`
- `sd_get_note_comments`
- `sd_add_note_comment`

## 9. Runtime UX Contract

List view:
- User-scoped list query (`author = current_user`) for base Notes dataset.
- Row actions: Edit / View.
- Comment count opens read modal.

Read modal:
- Includes content, author/date, urgency badge, optional captured URL, and threaded discussion.
- Comment form availability is controlled by `can_comment` response.

## 10. Non-Goals / Prohibitions

- Do not treat sticky as sharing.
- Do not infer ownership from workspace projection.
- Do not bypass `ObjectAccessGate` for mutation paths.
- Do not duplicate projection records for a single note/workspace state.
- Do not treat a projected note pin as the source of truth.
- Do not invent a separate sharing model for note pins apart from workspace mode.
- Do not write `sd_items` directly from Notes widget code.

## 11. Canonical UI Contract

- The widget shell strictly uses `.postbox.sd-widget`.
- Widget header uses `.postbox-header`, `.hndle`, and `.handle-actions`.
- Forms strictly use standard primitives: `.input-text-wrap`, `.textarea-wrap`, `.description`, and `<p class="submit">`.
- Destructive actions and auxiliary actions use neutral buttons or `.button-link` within the forms.
- Data lists strictly use `.wp-list-table.widefat.fixed.striped` with native WP table styling.
- Row actions use canonical span-wrapped links inside `.row-actions`.
- Comment trees utilize class-based rendering over inline styles, adhering to generic dashboard comment layouts (`dashboard-comment-wrap`).
- Local CSS (`style.css`) only contains Notes-specific constraints (e.g. CodeMirror bounds, localized badges) rather than redefining forms matching native aesthetics.

## 12. HARD RULES (Enforcement)

1. Widgets MUST NOT render `.postbox`. (The outer system handles it).
2. Widgets MUST NOT render `.postbox-header`.
3. Widgets MUST NOT use `.inside`.
4. Widgets MUST NOT duplicate WP chrome.
5. Widgets MUST NOT use inline styles.
6. Widgets MUST inherit WP styles whenever possible.
