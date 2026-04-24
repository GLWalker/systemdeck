import { Fragment, useEffect, useMemo, useState } from "@wordpress/element"
import { FormToggle } from "@wordpress/components"
import { __, sprintf } from "@wordpress/i18n"

const AUDIENCE_OPTIONS = [
	{ value: "global", label: __("Global", "systemdeck") },
	{ value: "targeted_users", label: __("Targeted Users", "systemdeck") },
]

function canManageWorkspaceCard({
	ws,
	currentUserId,
	canManageOptions,
	canManageWorkspaces,
}) {
	const ownerId = Number(ws?.cpt_author_id || 0)
	const isOwner = ownerId > 0 && ownerId === currentUserId
	return canManageOptions || (isOwner && canManageWorkspaces)
}

function roleLabel(role) {
	if (!role || typeof role !== "string") {
		return __("Admin", "systemdeck")
	}
	return role.charAt(0).toUpperCase() + role.slice(1)
}

function badgeListForWorkspace(ws, accessRole) {
	const badges = []
	const isPublic = !!ws?.is_public
	const isLocked = !!ws?.is_locked
	const collaborationMode =
		ws?.collaboration_mode === "collaborative"
			? "collaborative"
			: "owner_only"
	const audienceScope =
		ws?.audience_scope === "targeted_users"
			? "targeted_users"
			: "global"

	badges.push({
		key: "visibility",
		tone: isPublic ? "info" : "neutral",
		label: isPublic
			? __("Public", "systemdeck")
			: __("Private", "systemdeck"),
	})

	if (isPublic) {
		badges.push({
			key: "mode",
			tone: collaborationMode === "collaborative" ? "accent" : "muted",
			label:
				collaborationMode === "collaborative"
					? __("Collaborative", "systemdeck")
					: __("Owner Only", "systemdeck"),
		})

		if (isLocked) {
			badges.push({
				key: "locked",
				tone: "warning",
				label: __("Locked", "systemdeck"),
			})
		}

		badges.push({
			key: "audience",
			tone: audienceScope === "targeted_users" ? "accent" : "muted",
			label:
				audienceScope === "targeted_users"
					? __("Audience: Targeted", "systemdeck")
					: __("Audience: Global", "systemdeck"),
		})
	}

	badges.push({
		key: "access",
		tone: "neutral",
		label: sprintf(__("Access: %s+", "systemdeck"), roleLabel(accessRole)),
	})

	return badges
}

function draftFromWorkspace(ws, accessRole) {
	return {
		title: ws?.name || ws?.title || "",
		is_public: !!ws?.is_public,
		is_locked: !!ws?.is_locked,
		collaboration_mode:
			ws?.collaboration_mode === "collaborative"
				? "collaborative"
				: "owner_only",
		access_role: accessRole,
		audience_scope:
			ws?.audience_scope === "targeted_users"
				? "targeted_users"
				: "global",
		target_user_ids: Array.isArray(ws?.target_user_ids)
			? ws.target_user_ids.map((id) => Number(id))
			: [],
	}
}

function sameNumberSet(a, b) {
	const left = [...(Array.isArray(a) ? a : [])].map(Number).sort((x, y) => x - y)
	const right = [...(Array.isArray(b) ? b : [])]
		.map(Number)
		.sort((x, y) => x - y)

	if (left.length !== right.length) {
		return false
	}

	return left.every((value, index) => value === right[index])
}

function WorkspaceCard({
	ws,
	activeId,
	editingId,
	isLoading,
	dragging,
	dropTargetId,
	dragItemRef,
	currentUserId,
	canManageOptions,
	canManageWorkspaces,
	roleOptions,
	onDragStart,
	onDragEnter,
	onDragEnd,
	onActivate,
	onStartEditing,
	onDelete,
	onRename,
	onCancelRename,
	onSetWorkspaceVisibility,
	onSetCollaborationMode,
	onSetWorkspaceAudience,
	onFetchWorkspaceAudienceCandidates,
	onSetAccessRole,
	getWorkspaceAccessRole,
	getWorkspaceWidgetCount,
	getWorkspaceCreatedLabel,
	getWorkspaceAuthorLabel,
	getWorkspaceAudienceCandidates,
}) {
	const canManageCard = canManageWorkspaceCard({
		ws,
		currentUserId,
		canManageOptions,
		canManageWorkspaces,
	})
	const isActive = activeId === ws.id
	const isEditing = editingId === ws.id
	const canDelete = canManageCard && !isActive
	const accessRole = getWorkspaceAccessRole(ws)
	const authorLabel = getWorkspaceAuthorLabel(ws)
	const createdLabel = getWorkspaceCreatedLabel(ws)
	const widgetCount = getWorkspaceWidgetCount(ws)
	const workspaceName = ws.name || ws.title || __("Untitled Workspace", "systemdeck")
	const headingId = `sd-workspace-card-title-${ws.id}`
	const metaId = `sd-workspace-card-meta-${ws.id}`
	const statusId = `sd-workspace-card-status-${ws.id}`
	const editPanelId = `sd-workspace-card-edit-${ws.id}`
	const badges = useMemo(
		() => badgeListForWorkspace(ws, accessRole),
		[accessRole, ws],
	)
	const audienceCandidates = getWorkspaceAudienceCandidates(ws)
	const [draft, setDraft] = useState(() => draftFromWorkspace(ws, accessRole))
	const [isSaving, setIsSaving] = useState(false)

	useEffect(() => {
		if (!isEditing) {
			return
		}
		setDraft(draftFromWorkspace(ws, accessRole))
	}, [accessRole, isEditing, ws])

	useEffect(() => {
		if (!isEditing || draft.audience_scope !== "targeted_users") {
			return
		}

		let cancelled = false

		Promise.resolve(
			onFetchWorkspaceAudienceCandidates(ws.id, "", draft.access_role),
		).then((candidates) => {
			if (cancelled || !Array.isArray(candidates)) {
				return
			}

			const eligibleIds = new Set(candidates.map((candidate) => Number(candidate.id)))
			setDraft((prev) => ({
				...prev,
				target_user_ids: prev.target_user_ids.filter((id) =>
					eligibleIds.has(Number(id)),
				),
			}))
		})

		return () => {
			cancelled = true
		}
	}, [
		draft.access_role,
		draft.audience_scope,
		isEditing,
		onFetchWorkspaceAudienceCandidates,
		ws.id,
	])

	const metaParts = [
		sprintf(
			widgetCount === 1 ? __("%d widget", "systemdeck") : __("%d widgets", "systemdeck"),
			widgetCount,
		),
	]

	if (authorLabel !== "n/a") {
		metaParts.push(sprintf(__("by %s", "systemdeck"), authorLabel))
	}

	const handleDraftChange = (key, value) => {
		setDraft((prev) => ({ ...prev, [key]: value }))
	}

	const handlePublicToggle = (checked) => {
		setDraft((prev) => ({
			...prev,
			is_public: checked,
			is_locked: checked ? prev.is_locked : false,
			collaboration_mode: checked ? prev.collaboration_mode : "owner_only",
			audience_scope: checked ? prev.audience_scope : "global",
			target_user_ids: checked ? prev.target_user_ids : [],
		}))
	}

	const handleLockedToggle = (checked) => {
		setDraft((prev) => ({
			...prev,
			is_locked: checked,
			collaboration_mode: checked ? "owner_only" : prev.collaboration_mode,
		}))
	}

	const handleCollaborativeToggle = (checked) => {
		setDraft((prev) => ({
			...prev,
			is_public: checked ? true : prev.is_public,
			is_locked: checked ? false : prev.is_locked,
			collaboration_mode: checked ? "collaborative" : "owner_only",
		}))
	}

	const handleAudienceScopeChange = (scope) => {
		setDraft((prev) => ({
			...prev,
			audience_scope: scope,
			target_user_ids: scope === "targeted_users" ? prev.target_user_ids : [],
		}))
	}

	const handleAudienceUserToggle = (userId, checked) => {
		setDraft((prev) => ({
			...prev,
			target_user_ids: checked
				? [...new Set([...prev.target_user_ids, userId])]
				: prev.target_user_ids.filter((id) => Number(id) !== Number(userId)),
		}))
	}

	const handleSave = async () => {
		if (!canManageCard) {
			return
		}

		const title = draft.title.trim()
		if (!title) {
			return
		}

		setIsSaving(true)
		const original = draftFromWorkspace(ws, accessRole)

		try {
			if (title !== original.title) {
				const renamed = await onRename(ws.id, title)
				if (!renamed) {
					return
				}
			}

			if (
				draft.is_public !== original.is_public ||
				draft.is_locked !== original.is_locked
			) {
				const visibilityResult = await onSetWorkspaceVisibility(
					ws.id,
					draft.is_public,
					draft.is_locked,
				)
				if (!visibilityResult) {
					return
				}
			}

			if (draft.collaboration_mode !== original.collaboration_mode) {
				const collaborationResult = await onSetCollaborationMode(
					ws.id,
					draft.collaboration_mode,
				)
				if (!collaborationResult) {
					return
				}
			}

			if (draft.access_role !== original.access_role) {
				const accessResult = await onSetAccessRole(ws.id, draft.access_role)
				if (!accessResult) {
					return
				}
			}

			if (
				draft.audience_scope !== original.audience_scope ||
				!sameNumberSet(draft.target_user_ids, original.target_user_ids)
			) {
				const audienceResult = await onSetWorkspaceAudience(
					ws.id,
					draft.audience_scope,
					"",
					draft.audience_scope === "targeted_users"
						? draft.target_user_ids
						: [],
				)
				if (!audienceResult) {
					return
				}
			}

			onCancelRename()
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div
			draggable={editingId !== ws.id}
			onDragStart={(event) => onDragStart(event, ws)}
			onDragEnter={dragging ? (event) => onDragEnter(event, ws) : null}
			onDragOver={(event) => event.preventDefault()}
			onDragEnd={onDragEnd}
			className={`sd-grid-widget ${dragging && dragItemRef?.current?.id === ws.id ? "is-dragging" : ""} ${
				dragging && dropTargetId === ws.id && dragItemRef?.current?.id !== ws.id ? "is-drop-target" : ""
			}`}>
			<section
				className={`sd-workspace-card ${isActive ? "is-active" : ""} ${isEditing ? "is-editing" : ""}`}
				role='region'
				aria-labelledby={headingId}
				aria-describedby={`${metaId} ${statusId}`}>
				<div className='sd-workspace-card__header'>
					<div className='sd-workspace-card__heading'>
						<h3 id={headingId} className='sd-workspace-card__title'>
							{workspaceName}
						</h3>
						<p id={metaId} className='sd-workspace-card__meta'>
							{metaParts.join(" · ")}
						</p>
					</div>
					<div
						className='sd-workspace-card__toolbar'
						role='toolbar'
						aria-label={__("Workspace actions", "systemdeck")}>
						<button
							type='button'
							className='sd-workspace-card__action'
							onClick={() => onActivate(ws.id, true)}
							aria-label={__("Open workspace", "systemdeck")}
							title={__("Open workspace", "systemdeck")}>
							<span className='dashicons dashicons-external' />
						</button>
						{canManageCard ? (
							<button
								type='button'
								className='sd-workspace-card__action'
								onClick={() =>
									isEditing ? onCancelRename() : onStartEditing(ws)
								}
								aria-label={__("Edit workspace settings", "systemdeck")}
								aria-expanded={isEditing ? "true" : "false"}
								aria-controls={editPanelId}
								title={__("Edit workspace settings", "systemdeck")}>
								<span className='dashicons dashicons-edit' />
							</button>
						) : null}
						{canManageCard ? (
							<button
								type='button'
								className={`sd-workspace-card__action ${canDelete ? "" : "is-disabled"}`}
								onClick={() => {
									if (canDelete) {
										onDelete(ws.id)
									}
								}}
								disabled={!canDelete}
								aria-disabled={!canDelete ? "true" : undefined}
								aria-label={
									canDelete
										? __("Delete workspace", "systemdeck")
										: __("Active workspace cannot be deleted", "systemdeck")
								}
								title={
									canDelete
										? __("Delete workspace", "systemdeck")
										: __("Active workspace cannot be deleted", "systemdeck")
								}>
								<span className='dashicons dashicons-trash' />
							</button>
						) : null}
					</div>
				</div>

				<button
					type='button'
					className='sd-workspace-card__summary'
					onClick={() => onActivate(ws.id)}
					aria-current={isActive ? "true" : undefined}
					aria-describedby={`${metaId} ${statusId}`}>
					<div id={statusId} className='sd-workspace-card__badges' role='status'>
						{badges.map((badge) => (
							<span
								key={`${ws.id}-${badge.key}`}
								className={`sd-workspace-badge sd-workspace-badge--${badge.tone}`}>
								{badge.label}
							</span>
						))}
					</div>
				</button>

				{isEditing ? (
					<div id={editPanelId} className='sd-workspace-card__edit-panel'>
						<div className='sd-workspace-card__edit-grid'>
							<section className='sd-workspace-card__section'>
								<h4 className='sd-workspace-card__section-title'>
									{__("Workspace", "systemdeck")}
								</h4>
								<label className='sd-workspace-card__field'>
									<span className='sd-workspace-card__field-label'>
										{__("Workspace Name", "systemdeck")}
									</span>
									<input
										type='text'
										value={draft.title}
										onChange={(event) =>
											handleDraftChange("title", event.target.value)
										}
										className='regular-text sd-workspace-card__input'
									/>
								</label>
								<div className='sd-workspace-card__meta-grid'>
									<div>
										<span className='sd-workspace-card__meta-label'>
											{__("Author", "systemdeck")}
										</span>
										<span className='sd-workspace-card__meta-value'>
											{authorLabel !== "n/a"
												? authorLabel
												: __("Unknown", "systemdeck")}
										</span>
									</div>
									<div>
										<span className='sd-workspace-card__meta-label'>
											{__("Created", "systemdeck")}
										</span>
										<span className='sd-workspace-card__meta-value'>
											{createdLabel}
										</span>
									</div>
								</div>
							</section>

							<section className='sd-workspace-card__section'>
								<h4 className='sd-workspace-card__section-title'>
									{__("Behavior", "systemdeck")}
								</h4>
								<label className='sd-workspace-card__toggle'>
									<FormToggle
										checked={draft.is_public}
										onChange={(event) =>
											handlePublicToggle(!!event?.target?.checked)
										}
									/>
									<span>{__("Public Workspace", "systemdeck")}</span>
								</label>
								{canManageOptions ? (
									<label className='sd-workspace-card__toggle'>
										<FormToggle
											checked={draft.is_locked}
											onChange={(event) =>
												handleLockedToggle(!!event?.target?.checked)
											}
											disabled={!draft.is_public}
										/>
										<span>{__("Locked", "systemdeck")}</span>
									</label>
								) : null}
								<label className='sd-workspace-card__toggle'>
									<FormToggle
										checked={draft.collaboration_mode === "collaborative"}
										onChange={(event) =>
											handleCollaborativeToggle(!!event?.target?.checked)
										}
										disabled={!draft.is_public || !!draft.is_locked}
									/>
									<span>{__("Collaborative", "systemdeck")}</span>
								</label>
							</section>

							<section className='sd-workspace-card__section'>
								<h4 className='sd-workspace-card__section-title'>
									{__("Access", "systemdeck")}
								</h4>
								<label className='sd-workspace-card__field'>
									<span className='sd-workspace-card__field-label'>
										{__("Minimum Role", "systemdeck")}
									</span>
									<select
										className='sd-workspace-card__select'
										value={draft.access_role}
										onChange={(event) =>
											handleDraftChange("access_role", event.target.value)
										}>
										{roleOptions.map((role) => (
											<option key={`${ws.id}-${role}`} value={role}>
												{roleLabel(role)}
											</option>
										))}
									</select>
								</label>
							</section>

							<section className='sd-workspace-card__section'>
								<h4 className='sd-workspace-card__section-title'>
									{__("Audience", "systemdeck")}
								</h4>
								{draft.is_public ? (
									<Fragment>
										<label className='sd-workspace-card__field'>
											<span className='sd-workspace-card__field-label'>
												{__("Audience Scope", "systemdeck")}
											</span>
											<select
												className='sd-workspace-card__select'
												value={draft.audience_scope}
												onChange={(event) =>
													handleAudienceScopeChange(event.target.value)
												}>
												{AUDIENCE_OPTIONS.map((option) => (
													<option
														key={`${ws.id}-${option.value}`}
														value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</label>
										{draft.audience_scope === "targeted_users" ? (
											<div className='sd-workspace-card__targeted-users'>
												<span className='sd-workspace-card__field-label'>
													{__("Allowed Users", "systemdeck")}
												</span>
												<div className='sd-workspace-card__user-list'>
													{audienceCandidates.length > 0 ? (
														audienceCandidates.map((candidate) => {
															const checked = draft.target_user_ids.includes(
																Number(candidate.id),
															)
															return (
																<label
																	key={`${ws.id}-${candidate.id}`}
																	className='sd-workspace-card__user-option'>
																	<input
																		type='checkbox'
																		checked={checked}
																		onChange={(event) =>
																			handleAudienceUserToggle(
																				Number(candidate.id),
																				event.target.checked,
																			)
																		}
																	/>
																	<span>{candidate.label}</span>
																</label>
															)
														})
													) : (
														<p className='description'>
															{__(
																"No eligible users found for the current minimum role.",
																"systemdeck",
															)}
														</p>
													)}
												</div>
												<p className='description'>
													{__(
														"Only users at the minimum role or above are shown.",
														"systemdeck",
													)}
												</p>
											</div>
										) : null}
									</Fragment>
								) : (
									<p className='description'>
										{__("Audience settings apply only to public workspaces.", "systemdeck")}
									</p>
								)}
							</section>
						</div>

						<div className='sd-workspace-card__edit-actions'>
							<button
								type='button'
								className='button button-primary'
								onClick={handleSave}
								disabled={isSaving || isLoading}>
								{__("Save Changes", "systemdeck")}
							</button>
							<button
								type='button'
								className='button button-secondary'
								onClick={onCancelRename}
								disabled={isSaving || isLoading}>
								{__("Cancel", "systemdeck")}
							</button>
						</div>
					</div>
				) : null}
			</section>
		</div>
	)
}

export default function WorkspaceGridSection({
	canViewWorkspaces,
	canManageWorkspaces,
	canManageOptions,
	workspaceCards,
	activeId,
	editingId,
	isLoading,
	dragging,
	dropTargetId,
	dragItemRef,
	currentUserId,
	accessPolicyRoleOptions,
	onDragStart,
	onDragEnter,
	onDragEnd,
	onActivate,
	onStartEditing,
	onDelete,
	onRename,
	onCancelRename,
	onSetWorkspaceVisibility,
	onSetCollaborationMode,
	onSetWorkspaceAudience,
	onFetchWorkspaceAudienceCandidates,
	onSetAccessRole,
	getWorkspaceAccessRole,
	getWorkspaceWidgetCount,
	getWorkspaceCreatedLabel,
	getWorkspaceAuthorLabel,
	getWorkspaceAudienceCandidates,
	isCreating,
	newTitle,
	onStartCreate,
	onCancelCreate,
	onCreate,
	onSetNewTitle,
	adminUrl,
}) {
	if (!canViewWorkspaces && !(canManageWorkspaces || canManageOptions)) {
		return null
	}

	const roleOptions =
		Array.isArray(accessPolicyRoleOptions) && accessPolicyRoleOptions.length
			? Array.from(
					new Set(["administrator", ...accessPolicyRoleOptions]),
			  )
			: ["administrator", "editor", "author", "contributor", "subscriber"]

	return (
		<Fragment>
			{canViewWorkspaces ? (
				<div className={`sd-discovery-grid ${dragging ? "is-dragging" : ""}`}>
					{workspaceCards.map((ws) => (
						<WorkspaceCard
							key={ws.id}
							ws={ws}
							activeId={activeId}
							editingId={editingId}
							isLoading={isLoading}
							dragging={dragging}
							dropTargetId={dropTargetId}
							dragItemRef={dragItemRef}
							currentUserId={currentUserId}
							canManageOptions={canManageOptions}
							canManageWorkspaces={canManageWorkspaces}
							roleOptions={roleOptions}
							onDragStart={onDragStart}
							onDragEnter={onDragEnter}
							onDragEnd={onDragEnd}
							onActivate={onActivate}
							onStartEditing={onStartEditing}
							onDelete={onDelete}
							onRename={onRename}
							onCancelRename={onCancelRename}
							onSetWorkspaceVisibility={onSetWorkspaceVisibility}
							onSetCollaborationMode={onSetCollaborationMode}
							onSetWorkspaceAudience={onSetWorkspaceAudience}
							onFetchWorkspaceAudienceCandidates={
								onFetchWorkspaceAudienceCandidates
							}
							onSetAccessRole={onSetAccessRole}
							getWorkspaceAccessRole={getWorkspaceAccessRole}
							getWorkspaceWidgetCount={getWorkspaceWidgetCount}
							getWorkspaceCreatedLabel={getWorkspaceCreatedLabel}
							getWorkspaceAuthorLabel={getWorkspaceAuthorLabel}
							getWorkspaceAudienceCandidates={getWorkspaceAudienceCandidates}
						/>
					))}
				</div>
			) : null}

			{canManageWorkspaces || canManageOptions ? (
				<div className='sd-workspace-creator'>
					{!isCreating ? (
						<button
							type='button'
							className='button button-primary sd-create-btn'
							onClick={onStartCreate}>
							<span className='dashicons dashicons-plus-alt2' />
							{__("Create New Workspace", "systemdeck")}
						</button>
					) : (
						<div className='sd-inline-creator'>
							<div className='sd-creator-input-wrap'>
								<input
									type='text'
									value={newTitle}
									onChange={(event) => onSetNewTitle(event.target.value)}
									autoFocus
									placeholder={__("Workspace Name", "systemdeck")}
									className='regular-text sd-creator-input'
								/>
							</div>
							<div className='sd-creator-actions'>
								<button
									type='button'
									className='button button-primary sd-btn-create'
									onClick={onCreate}
									disabled={isLoading}>
									{__("Create", "systemdeck")}
								</button>
								<button
									type='button'
									className='button button-secondary sd-btn-cancel'
									onClick={onCancelCreate}>
									{__("Cancel", "systemdeck")}
								</button>
							</div>
						</div>
					)}
				</div>
			) : null}
		</Fragment>
	)
}
