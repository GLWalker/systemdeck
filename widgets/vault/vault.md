# SystemDeck Vault Widget Contract

## 1. Purpose

This contract defines the current Vault widget behavior and data boundaries implemented in source.

Authority sources:
- `widgets/vault/widget.php`
- `widgets/vault/app.js`
- `widgets/vault/sd-vault-media.css`
- `core/Services/ObjectAccessGate.php`
- `core/Services/ProjectionService.php`
- `core/Services/CommentService.php`
- `core/AjaxHandler.php` (workspace read/write enforcement)

## 2. Scope

Applies to:
- CPT: `sd_vault_file`
- Widget ID: `core.vault`
- Vault list, details modal, read/comments modal, media-library bridge, and projection behavior

## 3. Files In Contract

`widgets/vault/`
- `widget.php` (CPT, AJAX handlers, stream/link/export/import behavior)
- `app.js` (runtime list/actions/modals/comments/player hooks)
- `style.css` (Vault widget styles)
- `sd-vault-media.css` (targeted WP media fallback alignment rules)
- `media-bridge.js` (present in widget folder but not currently enqueued by the active runtime stack)

## 4. Canonical Data Model

Canonical entity is `sd_vault_file` owned by `post_author`.

Core state/meta:
- `_sd_vault_scope` (`personal` or `shared`)
- `_sd_vault_workspace_id` (active shared destination)
- `_sd_vault_workspace_name` (active shared workspace label)
- `_sd_vault_origin_workspace_id` (origin workspace id)
- `_sd_vault_origin_workspace_name` (origin workspace label)
- `_sd_vault_priority` (`urgent|high|moderate|low`)
- `_sd_vault_storage_mode` (`vault_private` or `media_public`)
- `_sd_vault_storage_driver` (legacy mirror of storage mode still written during state transitions)
- `_sd_vault_is_public`
- `_sd_vault_origin` (`vault` or `media`)
- `_sd_vault_wp_attachment_id` (linked attachment when present)

## 5. Projection and Dataset Separation

### 5.1 Canonical Storage
- Author-private canonical record remains in Vault CPT.
- Projection does not convert canonical ownership.

### 5.2 Base Vault List
- Base widget list is user-scoped (author dataset), not workspace-shared aggregate.
- Shared/pinned items from other users are not injected into another user’s base Vault list.

### 5.3 Shared Access Surface
- Shared items are consumed through workspace projection/read surfaces.
- Projection lifecycle is handled by `sync_vault_projection()` -> `ProjectionService::sync(...)`.

Vault pins are workspace-scoped projection surfaces, not canonical vault records.

Rules:
- the file remains the canonical, author-owned record
- the projection is presentation-only
- widget code must not write `sd_items` directly
- projection lifecycle must remain inside `ProjectionService`
- projection audience follows workspace collaboration mode in the same way widget placement does
- shared owner-only workspaces keep non-owner projection changes member-local
- collaborative workspaces make authorized projection changes workspace-wide

## 6. Access Contract

### 6.1 Author-only mutation
- Details save/delete/export/make-private mutation flows enforce author gate via `ObjectAccessGate::require_author()`.

### 6.2 Non-author read/comment
- Read and comments for shared items use access resolution via ObjectAccessGate/CommentService with:
  - scope key `_sd_vault_scope`
  - workspace key `_sd_vault_workspace_id`
  - shared token `shared`

### 6.3 SystemDeck AJAX alignment
- `workspace_view` requests are shared-aware.
- Write endpoints remain `workspace_edit` / `workspace_manage`.

## 7. Runtime UX Contract

### 7.1 List actions
- `View` opens file stream URL in a new browser tab/window (`window.open(..., "_blank", "noopener")`).
- `Edit` opens Vault attachment-details modal.
- Comments column opens Vault read/comments modal.

### 7.2 Pinned workspace tile behavior
- `systemdeck:open-vault-file` with read mode opens comments/read modal (not direct view action).

### 7.3 Details modal
- Uses WordPress attachment-details shell structure and media-element stack.
- Includes metadata panel, pin/priority controls, and inline comments.
- Priority badge appears in sidebar metadata area for shared files.

### 7.4 Read/comments modal
- Custom read-only modal for discussion context:
  - media preview + metadata
  - discussion thread and reply
  - comment composer

## 8. Media and Asset Contract

Vault runtime stack includes:
- WordPress media stack (`requires_wp_media() === true`)
- `wp-mediaelement` compatibility via initialized media elements
- Vault player/runtime assets (`sd-player-style`, `sd-audio-engine`, `sd-player-app`)
- `sd-vault-media.css` for narrow fallback/alignment rules

Do not:
- reintroduce broad cloned core media CSS
- enqueue redundant `buttons.css`/`dashicons.css` for this widget layer

## 9. WordPress Media Bridge Contract

### 9.1 Import/link
- Supports upload and media-library attachment linking into Vault.

### 9.2 Publication mode
- Supports publishing Vault item to Media Library (`media_public`) and returning to Vault private mode.

### 9.3 View behavior
- View action resolves `stream_url` and opens directly in browser context:
  - image => direct image render
  - audio => browser/audio player handling
  - pdf => browser/pdf viewer handling
  - other => browser file handling

## 10. Comments Contract

Comments are threaded and per-file.

Endpoints:
- `sd_core_vault_ajax_get_file_comments`
- `sd_core_vault_ajax_add_file_comment`

Notes:
- Empty state text is intentionally minimal in current UI.
- Comment counts in list are refreshed after writes.

## 11. Non-Goals / Prohibitions

- Do not treat Vault list as shared workspace index.
- Do not bypass author gate for canonical mutations.
- Do not replace native WP media shell with a custom full clone.
- Do not move read flows back into Edit modal “view space”.
- Do not treat a projected vault pin as the source of truth.
- Do not invent a separate sharing model for vault pins apart from workspace mode.
- Do not write `sd_items` directly from Vault widget code.
