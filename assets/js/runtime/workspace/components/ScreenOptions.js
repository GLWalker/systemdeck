import { useEffect, useMemo, useRef, useState } from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { Modal, Spinner } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import { STORE_NAME } from "../state/store"
import "./WidgetPicker.css"

const GROUP_DEFS = [
	{ id: "all", label: "All Widgets" },
	{ id: "core", label: "Core" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "apps", label: "Apps" },
	{ id: "third-party", label: "Third-Party" },
]

const makeActivityDefs = (activeCount, totalCount) => [
	{ id: "all", label: `All (${totalCount})` },
	{ id: "active", label: `Active (${activeCount})` },
	{ id: "inactive", label: `Inactive (${Math.max(0, totalCount - activeCount)})` },
]

const CORE_DASHBOARD_WIDGET_IDS = new Set([
	"dashboard_activity",
	"dashboard_right_now",
	"dashboard_quick_press",
	"dashboard_primary",
	"dashboard_site_health",
	"dashboard_browser_nag",
])

const ORIGIN_LABELS = {
	core: "Core",
	dashboard: "Dashboard",
	discovered: "Third-Party",
	addon: "Third-Party",
	auto_scan: "Third-Party",
	deep_scan: "Third-Party",
}

const isCoreDashboardWidget = (widget) => {
	if (widget.origin !== "dashboard") return false
	const sourceId = String(widget.source_id || "").trim()
	if (sourceId && CORE_DASHBOARD_WIDGET_IDS.has(sourceId)) return true
	const widgetId = String(widget.id || "").trim().replace(/^dashboard\./, "")
	return CORE_DASHBOARD_WIDGET_IDS.has(widgetId)
}

const iconForWidget = (widget) => {
	if (widget.app_id) return "dashicons-admin-plugins"
	if (isCoreDashboardWidget(widget)) {
		return "dashicons-dashboard"
	}
	switch (String(widget.origin || "")) {
		case "dashboard":
			return "dashicons-admin-plugins"
		case "core":
			return "dashicons-screenoptions"
		default:
			return "dashicons-admin-plugins"
	}
}

const inferGroupId = (widget) => {
	if (widget.origin === "core") return "core"
	if (widget.app_id || widget.is_app_scoped || widget.is_app_root) return "apps"
	if (isCoreDashboardWidget(widget)) return "dashboard"
	return "third-party"
}

const inferGroupLabel = (widget) => {
	const groupId = inferGroupId(widget)
	if (groupId === "dashboard") return "Dashboard Widget"
	if (groupId === "core") return "Core Widget"
	if (groupId === "apps") return "App Widget"
	return "Third-Party Widget"
}

const inferProvider = (widget) => {
	if (widget.app_id) {
		return `App: ${String(widget.app_id).replace(/[-_]+/g, " ")}`
	}

	if (isCoreDashboardWidget(widget)) {
		return "WordPress Dashboard"
	}

	if (widget.provider_name) {
		return widget.provider_name
	}

	if (widget.origin === "core") {
		return "SystemDeck Core"
	}

	if (widget.source_id) {
		return String(widget.source_id).replace(/[-_]+/g, " ")
	}

	return ORIGIN_LABELS[String(widget.origin || "")] || "Third-Party"
}

const cloneLayoutItems = (items) =>
	JSON.parse(JSON.stringify(items && typeof items === "object" ? items : {}))

const nextPreviewWidgetPosition = (layoutItems) => {
	let maxY = 0
	Object.values(layoutItems || {}).forEach((item) => {
		maxY = Math.max(maxY, Number(item?.y || 0) + Number(item?.h || 1))
	})
	return { x: 0, y: maxY, w: 2, h: 1 }
}

const createPreviewWidgetItem = (widget, layoutItems) => {
	const widgetId = String(widget?.id || "").trim()
	const widgetTitle = String(widget?.title || widgetId).trim()
	const instanceId = `sd_preview_${widgetId.replace(/[^a-z0-9_-]/gi, "_")}`
	const position = nextPreviewWidgetPosition(layoutItems)
	return {
		i: instanceId,
		id: instanceId,
		type: "block_widget_placeholder",
		title: widgetTitle,
		x: position.x,
		y: position.y,
		w: position.w,
		h: position.h,
		settings: {
			source: "canvas",
			blockName: "systemdeck/widgets",
			widgetId,
			label: widgetTitle,
		},
	}
}

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
	const [activeGroup, setActiveGroup] = useState("all")
	const [activityFilter, setActivityFilter] = useState("all")
	const [searchTerm, setSearchTerm] = useState("")
	const [blockStatus, setBlockStatus] = useState(null)
	const [isSyncing, setIsSyncing] = useState(false)
	const [pendingWidgetIds, setPendingWidgetIds] = useState(null)
	const initialWidgetIdsRef = useRef(null)
	const initialLayoutItemsRef = useRef(null)
	const previewLayoutItemsRef = useRef(null)

	const { toggleMetaDrawer: toggleDrawer, setLayoutItems } =
		useDispatch(STORE_NAME)
	const isLockedSharedWorkspace =
		!!activeWorkspace?.shared_incoming && !!activeWorkspace?.is_locked

	const isPickerVisibleForWorkspace = (widget) => {
		const widgetId = String(widget?.id || "")
		if (!widgetId) return false

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

	useEffect(() => {
		if (isOpen) {
			const fromLayout = Object.values(layoutObj || {})
				.filter((item) => item?.type === "block_widget_placeholder")
				.map((item) => String(item?.settings?.widgetId || ""))
				.filter(Boolean)
			const combined = [...new Set([...availableIds, ...fromLayout])]
			initialWidgetIdsRef.current = combined
			initialLayoutItemsRef.current = cloneLayoutItems(layoutObj)
			previewLayoutItemsRef.current = cloneLayoutItems(layoutObj)
			setPendingWidgetIds(combined)
			setActivityFilter("all")
		} else {
			initialWidgetIdsRef.current = null
			initialLayoutItemsRef.current = null
			previewLayoutItemsRef.current = null
			setPendingWidgetIds(null)
			setBlockStatus(null)
			setIsSyncing(false)
		}
	}, [isOpen, activeId])

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

	const isWidgetChecked = (widgetId) => {
		if (Array.isArray(pendingWidgetIds)) {
			return pendingWidgetIds.includes(widgetId)
		}
		return availableIds.includes(widgetId)
	}

	const pickerWidgets = useMemo(() => {
		return visibleRegistryWidgets
			.filter((widget) => enablement.includes(widget.id))
			.map((widget) => {
				const title = String(widget.title || widget.id || "").trim()
				const provider = inferProvider(widget)
				return {
					...widget,
					title,
					group: inferGroupId(widget),
					provider,
					icon: iconForWidget(widget),
					meta: __(inferGroupLabel(widget), "systemdeck"),
					searchIndex: [title, provider, widget.id, widget.origin, widget.app_id]
						.filter(Boolean)
						.join(" ")
						.toLowerCase(),
				}
			})
			.sort((a, b) => a.title.localeCompare(b.title))
	}, [visibleRegistryWidgets, enablement])

	const pendingWidgetIdSet = useMemo(
		() => new Set(Array.isArray(pendingWidgetIds) ? pendingWidgetIds : availableIds),
		[pendingWidgetIds, availableIds],
	)

	const activityCounts = useMemo(() => {
		let active = 0
		pickerWidgets.forEach((widget) => {
			if (pendingWidgetIdSet.has(widget.id)) active += 1
		})
		return {
			active,
			total: pickerWidgets.length,
		}
	}, [pickerWidgets, pendingWidgetIdSet])

	const activityDefs = useMemo(
		() => makeActivityDefs(activityCounts.active, activityCounts.total),
		[activityCounts],
	)

	const filteredWidgets = useMemo(() => {
		const term = searchTerm.trim().toLowerCase()
		return pickerWidgets.filter((widget) => {
			if (activeGroup !== "all" && widget.group !== activeGroup) return false
			const isActive = pendingWidgetIdSet.has(widget.id)
			if (activityFilter === "active" && !isActive) return false
			if (activityFilter === "inactive" && isActive) return false
			if (!term) return true
			return widget.searchIndex.includes(term)
		})
	}, [pickerWidgets, activeGroup, activityFilter, pendingWidgetIdSet, searchTerm])

	const groupCounts = useMemo(() => {
		const counts = { all: pickerWidgets.length, core: 0, dashboard: 0, apps: 0, "third-party": 0 }
		pickerWidgets.forEach((widget) => {
			if (counts[widget.group] !== undefined) {
				counts[widget.group] += 1
			}
		})
		return counts
	}, [pickerWidgets])

	const activeGroupDef = GROUP_DEFS.find((group) => group.id === activeGroup) || GROUP_DEFS[0]
	const hasPendingChanges = useMemo(() => {
		const pending = Array.isArray(pendingWidgetIds) ? pendingWidgetIds : []
		const initial = Array.isArray(initialWidgetIdsRef.current)
			? initialWidgetIdsRef.current
			: []
		if (pending.length !== initial.length) return true
		return pending.some((id) => !initial.includes(id))
	}, [pendingWidgetIds])

	const handleToggleWidget = (widgetId) => {
		if (!activeId || isSyncing || isLockedSharedWorkspace) return
		const currentlyChecked = pendingWidgetIdSet.has(widgetId)
		const widget = pickerWidgets.find((entry) => entry.id === widgetId)
		if (!widget) return
		setBlockStatus({
			type: "success",
			message: currentlyChecked
				? __("Widget removed.", "systemdeck")
				: __("Widget added.", "systemdeck"),
		})
		setPendingWidgetIds((prev) => {
			const current = Array.isArray(prev) ? prev : [...availableIds]
			return current.includes(widgetId)
				? current.filter((id) => id !== widgetId)
				: [...current, widgetId]
		})
		if (!setLayoutItems || !activeId) return
		const nextLayout = cloneLayoutItems(previewLayoutItemsRef.current || layoutObj)
		if (currentlyChecked) {
			const targetId = Object.keys(nextLayout).find((itemId) => {
				const item = nextLayout[itemId]
				return (
					String(item?.type || "") === "block_widget_placeholder" &&
					String(item?.settings?.widgetId || "") === widgetId
				)
			})
			if (targetId) {
				delete nextLayout[targetId]
			}
		} else {
			const nextItem = createPreviewWidgetItem(widget, nextLayout)
			nextLayout[nextItem.id] = nextItem
		}
		previewLayoutItemsRef.current = nextLayout
		setLayoutItems(activeId, nextLayout)
	}

	const restorePreviewSnapshot = () => {
		if (setLayoutItems && activeId && initialLayoutItemsRef.current) {
			const restoredLayout = cloneLayoutItems(initialLayoutItemsRef.current)
			previewLayoutItemsRef.current = restoredLayout
			setLayoutItems(activeId, restoredLayout)
		}
	}

	const handleRequestClose = () => {
		if (!isSyncing) {
			restorePreviewSnapshot()
		}
		toggleDrawer(false)
	}

	const handleSaveWidgets = async () => {
		const pending = pendingWidgetIds
		const initial = initialWidgetIdsRef.current
		const nonce = getNonce()
		const ajaxUrl = getAjaxUrl()
		const hasChanges =
			Array.isArray(pending) &&
			Array.isArray(initial) &&
			(pending.length !== initial.length ||
				pending.some((id) => !initial.includes(id)))

		if (!activeId || isLockedSharedWorkspace || isSyncing) return
		if (!hasChanges) {
			toggleDrawer(false)
			return
		}

		setIsSyncing(true)
		try {
			const res = await jQuery.post(ajaxUrl, {
				action: "sd_sync_workspace_widget_list",
				nonce,
				workspace_id: activeId,
				widget_ids: JSON.stringify(pending),
			})
			if (!res?.success) {
				setBlockStatus({
					type: "error",
					message: res?.data?.message || __("Widget sync failed.", "systemdeck"),
				})
				setIsSyncing(false)
				return
			}
			if (setLayoutItems && res?.data?.layout_items && activeId) {
				setLayoutItems(activeId, Object.values(res.data.layout_items))
			}
			initialWidgetIdsRef.current = Array.isArray(pending) ? [...pending] : []
			initialLayoutItemsRef.current = cloneLayoutItems(res?.data?.layout_items || layoutObj)
			previewLayoutItemsRef.current = cloneLayoutItems(res?.data?.layout_items || layoutObj)
			toggleDrawer(false)
		} catch (e) {
			setBlockStatus({
				type: "error",
				message: __("Widget sync request failed.", "systemdeck"),
			})
			setIsSyncing(false)
		}
	}

	if (!isOpen) return null

	return (
		<Modal
			title={__("Widget Picker", "systemdeck")}
			className='sd-widget-picker-modal'
			onRequestClose={handleRequestClose}>
			<div className='sd-widget-picker__surface'>
				<div className='sd-widget-picker'>
					{isSyncing && (
						<div
							className='sd-widget-picker__loading'
							aria-live='polite'
							aria-busy='true'>
							<div className='sd-widget-picker__loading-card'>
								<Spinner />
								<span>{__("Saving widgets...", "systemdeck")}</span>
							</div>
						</div>
					)}
					<div className='sd-widget-picker__toolbar'>
						<div className='sd-widget-picker__toolbar-field'>
							<select
								className='sd-widget-picker__source-select'
								value={activeGroup}
								onChange={(event) => setActiveGroup(event.target.value)}>
								{GROUP_DEFS.map((group) => (
									<option key={group.id} value={group.id}>
										{group.label}
									</option>
								))}
							</select>
						</div>
						<div className='sd-widget-picker__toolbar-field'>
							<input
								type='search'
								className='sd-widget-picker__search'
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
								placeholder={__("Search widgets...", "systemdeck")}
							/>
						</div>
						<div className='sd-widget-picker__toolbar-field'>
							<select
								className='sd-widget-picker__activity-select'
								value={activityFilter}
								onChange={(event) => setActivityFilter(event.target.value)}>
								{activityDefs.map((activity) => (
									<option key={activity.id} value={activity.id}>
										{activity.label}
									</option>
								))}
							</select>
						</div>
						<div className='sd-widget-picker__toolbar-actions'>
							<button
								type='button'
								className='button button-primary sd-widget-picker__save-btn'
								disabled={!hasPendingChanges || isSyncing || isLockedSharedWorkspace}
								onClick={handleSaveWidgets}>
								{__("Save Widgets", "systemdeck")}
							</button>
						</div>
					</div>
					<div className='sd-widget-picker__layout'>
						<aside className='sd-widget-picker__rail'>
							{GROUP_DEFS.map((group) => (
								<button
									key={group.id}
									type='button'
									className={`sd-widget-picker__rail-item ${activeGroup === group.id ? "is-active" : ""}`}
									onClick={() => setActiveGroup(group.id)}>
									<span className='sd-widget-picker__rail-label'>{group.label}</span>
									<span className='sd-widget-picker__rail-count'>{groupCounts[group.id] || 0}</span>
								</button>
							))}
						</aside>
						<section className='sd-widget-picker__panel'>
							<div className='sd-widget-picker__panel-header'>
								<div className='sd-widget-picker__panel-title'>
									{activeGroupDef.label} ({filteredWidgets.length})
								</div>
							</div>
							{blockStatus ? (
								<div className={`sd-widget-picker__status ${blockStatus.type === "success" ? "is-success" : "is-error"}`}>
									{blockStatus.message}
								</div>
							) : null}
							<div className='sd-widget-picker__list'>
								{filteredWidgets.length ? (
									filteredWidgets.map((widget) => {
										const isActive = isWidgetChecked(widget.id)
										return (
											<div key={widget.id} className='sd-widget-picker__row'>
												<div className='sd-widget-picker__row-icon'>
													<span className={`dashicons ${widget.icon}`} aria-hidden='true' />
												</div>
												<div className='sd-widget-picker__row-copy'>
													<div className='sd-widget-picker__row-title'>{widget.title}</div>
													<div className='sd-widget-picker__row-description'>
														{widget.id}
													</div>
													<div className='sd-widget-picker__row-provider'>
														{widget.provider}
													</div>
												</div>
												<div className='sd-widget-picker__row-meta'>{widget.meta}</div>
												<div className='sd-widget-picker__row-action'>
													<button
														type='button'
														className={`button ${isActive ? "button-secondary" : "button-primary"} sd-widget-picker__action-btn`}
														disabled={isSyncing || isLockedSharedWorkspace}
														onClick={() => handleToggleWidget(widget.id)}>
														{isActive
															? __("Remove Widget", "systemdeck")
															: __("Add Widget", "systemdeck")}
													</button>
												</div>
											</div>
										)
									})
								) : (
									<div className='sd-widget-picker__empty'>
										{__(
											"No widgets match this selection yet.",
											"systemdeck",
										)}
									</div>
								)}
							</div>
						</section>
					</div>
				</div>
			</div>
		</Modal>
	)
}
