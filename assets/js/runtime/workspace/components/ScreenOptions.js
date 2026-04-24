import { useEffect, useState } from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { Modal } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import { STORE_NAME } from "../state/store"

export default function ScreenOptions() {
	const { isOpen, registry, availableIds, activeId, activeWorkspace, enablement, layoutObj } = useSelect(
		(select) => {
			const {
				isMetaDrawerOpen,
				getRegistry,
				getActiveWorkspace,
				getActiveWorkspaceId,
				getRegistryEnablement,
				getCurrentLayout,
			} = select(STORE_NAME)
			const activeWS = getActiveWorkspace ? getActiveWorkspace() : null

			return {
				isOpen: isMetaDrawerOpen ? isMetaDrawerOpen() : false,
				registry: getRegistry ? getRegistry() : {},
				activeWorkspace: activeWS,
				availableIds: activeWS?.available || [],
				activeId: getActiveWorkspaceId ? getActiveWorkspaceId() : null,
				enablement: getRegistryEnablement
					? getRegistryEnablement()
					: [],
				layoutObj: getCurrentLayout ? getCurrentLayout() : {},
			}
		},
		[],
	)
	const [blockStatus, setBlockStatus] = useState(null)
	const [isOpeningEditor, setIsOpeningEditor] = useState(false)
	const [diagRows, setDiagRows] = useState([])
	const [diagLoading, setDiagLoading] = useState(false)
	const [widgetSyncLoading, setWidgetSyncLoading] = useState(false)
	const [layoutSyncLoading, setLayoutSyncLoading] = useState(false)
	const [syncedWidgetIds, setSyncedWidgetIds] = useState(null)
	const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(
		!!window.SYSTEMDECK_BOOTSTRAP?.config?.hydration_diagnostics_enabled,
	)
	const currentUserId = Number(
		window.SYSTEMDECK_BOOTSTRAP?.config?.user?.id ||
		window.sd_vars?.user?.id ||
		0,
	)
	const canManageOptions = !!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_options
	const canManageWorkspaces = !!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_workspaces
	const activeWorkspaceOwnerId = Number(activeWorkspace?.cpt_author_id || 0)

	const { toggleMetaDrawer: toggleDrawer, setLayoutItems } =
		useDispatch(STORE_NAME)

	const isPickerVisibleForWorkspace = (widget) => {
		const widgetId = String(widget?.id || "")
		if (!widgetId) return false
		if (widgetId === "core.system-status") return false

		if (typeof widget?.is_picker_visible === "boolean") {
			return widget.is_picker_visible
		}

		const policy = String(widget?.visibility_policy || "global")
		const widgetAppId = String(widget?.app_id || "")
		const workspaceAppId = String(activeWorkspace?.app_id || "")
		const isAppWorkspace = !!activeWorkspace?.is_app_workspace

		if (policy === "hidden" || policy === "app_root_only") return false
		if (policy === "app_scoped") {
			return isAppWorkspace && workspaceAppId !== "" && workspaceAppId === widgetAppId
		}
		return true
	}

	const visibleRegistryWidgets = Object.values(registry).filter((widget) =>
		isPickerVisibleForWorkspace(widget),
	)

	const canEditActiveWorkspace = (() => {
		if (!activeWorkspace || !activeId) return false
		const ownerId = Number(activeWorkspace?.cpt_author_id || 0)
		const isOwner = ownerId > 0 && ownerId === currentUserId
		const isSharedIncoming = !!activeWorkspace?.shared_incoming
		const isLocked = !!activeWorkspace?.is_locked

		if (canManageOptions) return true
		if (isSharedIncoming && isLocked) return false
		if (isOwner && canManageWorkspaces) return true
		if (isSharedIncoming && !isLocked) return true
		return false
	})()
	const isSharedIncomingWorkspace =
		!!activeWorkspace?.shared_incoming ||
		(activeWorkspaceOwnerId > 0 && activeWorkspaceOwnerId !== currentUserId)

	useEffect(() => {
		const handlePrefChange = (event) => {
			setDiagnosticsEnabled(!!event?.detail?.enabled)
		}
		window.addEventListener("sd_hydration_diag_toggle", handlePrefChange)
		return () => window.removeEventListener("sd_hydration_diag_toggle", handlePrefChange)
	}, [])

	useEffect(() => {
		setSyncedWidgetIds(null)
		setBlockStatus(null)
	}, [activeId])

	const getNonce = () =>
		window.SystemDeckSecurity?.nonce ||
		window.sd_vars?.nonce ||
		window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
		window.SYSTEMDECK_STATE?.config?.nonce ||
		""

	const getAjaxUrl = () =>
		window.SystemDeckSecurity?.ajaxurl ||
		window.sd_vars?.ajaxurl ||
		window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
		window.SYSTEMDECK_STATE?.config?.ajaxurl ||
		"/wp-admin/admin-ajax.php"

	const openWorkspaceEditor = async () => {
		if (!activeId) return
		setIsOpeningEditor(true)
		try {
			const res = await jQuery.post(getAjaxUrl(), {
				action: "sd_get_workspace_editor_url",
				nonce: getNonce(),
				workspace_id: activeId,
			})
			if (!res?.success || !res?.data?.edit_url) {
				setBlockStatus({
					type: "error",
					message: res?.data?.message || __("Could not open workspace editor.", "systemdeck"),
				})
				return
			}
			window.location.href = res.data.edit_url
		} catch (e) {
			setBlockStatus({
				type: "error",
				message: __("Editor request failed.", "systemdeck"),
			})
		} finally {
			setIsOpeningEditor(false)
		}
	}

	const runHydrationDiagnostics = async () => {
		const slotItems = Object.values(layoutObj || {}).filter(
			(item) => item?.type === "block_widget_placeholder" && item?.settings?.widgetId,
		)
		if (!slotItems.length) {
			setDiagRows([])
			setBlockStatus({
				type: "error",
				message: __("No widget blocks found in current workspace layout.", "systemdeck"),
			})
			return
		}

		setDiagLoading(true)
		try {
			const rows = await Promise.all(
				slotItems.map(async (item) => {
					const res = await jQuery.post(getAjaxUrl(), {
						action: "sd_resolve_widget",
						nonce: getNonce(),
						widget_id: item.settings.widgetId,
					})
					if (!res?.success) {
						return {
							itemId: item.i || item.id,
							requested: item.settings.widgetId,
							resolved: "",
							source: "",
							status: "error",
						}
					}
					return {
						itemId: item.i || item.id,
						requested: res.data.requested_id || item.settings.widgetId,
						resolved: res.data.resolved_id || "",
						source: res.data.source_id || "",
						status: res.data.found ? "ok" : "missing",
					}
				}),
			)
			setDiagRows(rows)
			setBlockStatus({
				type: "success",
				message: __("Hydration diagnostics updated.", "systemdeck"),
			})
		} catch (e) {
			setBlockStatus({
				type: "error",
				message: __("Diagnostics request failed.", "systemdeck"),
			})
		} finally {
			setDiagLoading(false)
		}
	}

	const syncLayoutToEditor = async () => {
		if (!activeId) return
		setLayoutSyncLoading(true)
		try {
			const items = Object.values(layoutObj || {})
				.map((item) => ({
					...item,
					id: item?.id || item?.i,
					i: item?.i || item?.id,
					x: Number.isFinite(item?.x) ? item.x : 0,
					y: Number.isFinite(item?.y) ? item.y : 0,
					w: Number.isFinite(item?.w) ? item.w : 2,
					h: Number.isFinite(item?.h) ? item.h : 1,
				}))
				.filter((item) => !!item.id)
				.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
				.map((item, index) => ({ ...item, y: index * 2 }))
			const res = await jQuery.post(getAjaxUrl(), {
				action: "sd_sync_layout_to_editor",
				nonce: getNonce(),
				workspace_id: activeId,
				layout: JSON.stringify(items),
			})
			if (!res?.success) {
				setBlockStatus({
					type: "error",
					message: res?.data?.message || __("Could not sync layout to editor.", "systemdeck"),
				})
				return
			}
			setBlockStatus({
				type: "success",
				message: __("Workspace state saved to editor layout.", "systemdeck"),
			})
		} catch (e) {
			setBlockStatus({
				type: "error",
				message: __("Layout sync request failed.", "systemdeck"),
			})
		} finally {
			setLayoutSyncLoading(false)
		}
	}

	const isWidgetChecked = (widgetId) => {
		if (Array.isArray(syncedWidgetIds)) {
			return syncedWidgetIds.includes(widgetId)
		}
		if (availableIds.includes(widgetId)) return true
		return Object.values(layoutObj || {}).some(
			(item) =>
				item?.type === "block_widget_placeholder" &&
				(item?.settings?.widgetId || "") === widgetId,
		)
	}

	const toggleWorkspaceWidgetBlock = async (widgetId) => {
		if (!activeId) return
		setWidgetSyncLoading(true)
		try {
			const res = await jQuery.post(getAjaxUrl(), {
				action: "sd_toggle_workspace_widget_block",
				nonce: getNonce(),
				workspace_id: activeId,
				widget_id: widgetId,
			})
			if (!res?.success) {
				setBlockStatus({
					type: "error",
					message: res?.data?.message || __("Widget sync failed.", "systemdeck"),
				})
				return
			}
			setBlockStatus({
				type: "success",
				message:
					res?.data?.operation === "added"
						? __("Widget block added.", "systemdeck")
						: __("Widget block removed.", "systemdeck"),
			})
			setSyncedWidgetIds(Array.isArray(res?.data?.workspace_widgets) ? res.data.workspace_widgets : [])
			if (setLayoutItems && res?.data?.layout_items && activeId) {
				setLayoutItems(activeId, Object.values(res.data.layout_items))
			}
		} catch (e) {
			setBlockStatus({
				type: "error",
				message: __("Widget sync request failed.", "systemdeck"),
			})
		} finally {
			setWidgetSyncLoading(false)
		}
	}

	if (!isOpen) return null

	return (
		<Modal
			title={__("Workspace Options", "systemdeck")}
			className='sd-workspace-options-modal'
			onRequestClose={() => toggleDrawer(false)}>
			<div id='workspace-options-wrap'>
					<fieldset className='metabox-prefs'>
						<legend>{__("Widgets", "systemdeck")}</legend>
						{visibleRegistryWidgets
							.filter((w) => enablement.includes(w.id))
							.map((widget) => (
								<label key={widget.id}>
									<input
										type='checkbox'
										checked={isWidgetChecked(widget.id)}
										disabled={widgetSyncLoading}
										onChange={() => toggleWorkspaceWidgetBlock(widget.id)}
									/>
									{widget.title || widget.id}
								</label>
							))}
						{visibleRegistryWidgets.length === 0 && (
							<p className='sd-meta-empty-note'>
								{__(
									"No widgets discovered yet. Run the scanner in Discovery mode.",
									"systemdeck",
								)}
							</p>
						)}
					</fieldset>
					<fieldset className='metabox-prefs sd-meta-blocks'>
						<legend>{__("Workspace", "systemdeck")}</legend>
							<p className='description'>
								{__(
									"Open the workspace editor to add and manage blocks.",
									"systemdeck",
								)}
							</p>
							<div className='sd-meta-block-actions'>
								{!isSharedIncomingWorkspace ? (
									<>
										<button
											type='button'
											className='button button-primary'
											disabled={isOpeningEditor}
											onClick={openWorkspaceEditor}>
											{__("Open Workspace Editor", "systemdeck")}
										</button>
										<button
											type='button'
											className='button button-secondary'
											disabled={layoutSyncLoading}
											onClick={syncLayoutToEditor}>
											{layoutSyncLoading
												? __("Saving State...", "systemdeck")
												: __("Save State to Editor", "systemdeck")}
										</button>
									</>
								) : null}
								{diagnosticsEnabled ? (
									<button
										type='button'
										className='button button-secondary'
										disabled={diagLoading}
										onClick={runHydrationDiagnostics}>
										{diagLoading
											? __("Running Diagnostics...", "systemdeck")
											: __("Run Hydration Diagnostics", "systemdeck")}
									</button>
								) : null}
							</div>
						{blockStatus ? (
							<p
								className={`sd-meta-block-status ${blockStatus.type === "success" ? "is-success" : "is-error"}`}>
								{blockStatus.message}
							</p>
						) : null}
						{diagnosticsEnabled && diagRows.length ? (
							<div className='sd-meta-block-status sd-meta-diag-wrap'>
								<table className='widefat striped sd-meta-diag-table'>
									<thead>
										<tr>
											<th>{__("Slot", "systemdeck")}</th>
											<th>{__("requested_id", "systemdeck")}</th>
											<th>{__("resolved_id", "systemdeck")}</th>
											<th>{__("source_id", "systemdeck")}</th>
											<th>{__("status", "systemdeck")}</th>
										</tr>
									</thead>
									<tbody>
										{diagRows.map((row) => (
											<tr key={row.itemId}>
												<td><code>{row.itemId}</code></td>
												<td><code>{row.requested}</code></td>
												<td><code>{row.resolved}</code></td>
												<td><code>{row.source}</code></td>
												<td>{row.status}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</fieldset>
				</div>
		</Modal>
	)
}
