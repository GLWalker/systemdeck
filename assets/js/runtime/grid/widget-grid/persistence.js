import { WIDGET_GRID_DESKTOP_UNITS, coerceSpan } from "./runtime"

export const createWidgetUiStatePersister = ({
	getAjaxUrl,
	getNonce,
	timersRef,
	debounceMs = 120,
}) => {
	return (workspaceId, widgetId, patch = {}) => {
		const ajaxUrl = typeof getAjaxUrl === "function" ? getAjaxUrl() : ""
		const nonce = typeof getNonce === "function" ? getNonce() : ""
		if (!ajaxUrl || !nonce || !workspaceId || !widgetId) return

		const timerKey = `${workspaceId}:${widgetId}`
		if (timersRef?.current?.[timerKey]) {
			window.clearTimeout(timersRef.current[timerKey])
		}

		timersRef.current[timerKey] = window.setTimeout(() => {
			const formData = new FormData()
			formData.append("action", "sd_set_widget_ui_state")
			formData.append("workspace_id", workspaceId)
			formData.append("widget_id", widgetId)
			if (Object.prototype.hasOwnProperty.call(patch, "collapsed")) {
				formData.append("collapsed", patch.collapsed ? "1" : "0")
			}
			if (Object.prototype.hasOwnProperty.call(patch, "width")) {
				formData.append("width", String(coerceSpan(patch.width, WIDGET_GRID_DESKTOP_UNITS)))
			}
			if (Object.prototype.hasOwnProperty.call(patch, "x")) {
				formData.append("x", String(Math.max(0, Number(patch.x) || 0)))
			}
			if (Object.prototype.hasOwnProperty.call(patch, "y")) {
				formData.append("y", String(Math.max(0, Number(patch.y) || 0)))
			}
			formData.append("nonce", nonce)
			formData.append("_ajax_nonce", nonce)
			formData.append("_wpnonce", nonce)
			fetch(ajaxUrl, { method: "POST", body: formData })
				.then((res) => res.json())
				.then((payload) => {
					if (!payload?.success) {
						console.warn("[Widget UI State] save failed", payload)
					}
				})
				.catch((error) => {
					console.warn("[Widget UI State] request failed", error)
				})
			delete timersRef.current[timerKey]
		}, debounceMs)
	}
}

export const updateCollapsedStateForWidget = ({
	prev,
	workspaceId,
	widgetId,
	patch,
}) => {
	const workspaceState =
		prev?.[workspaceId] && typeof prev[workspaceId] === "object"
			? prev[workspaceId]
			: {}
	return {
		...prev,
		[workspaceId]: {
			...workspaceState,
			[widgetId]: {
				...(workspaceState[widgetId] || {}),
				...(patch || {}),
			},
		},
	}
}

export const updateCollapsedStateForWidgetPositions = ({
	prev,
	workspaceId,
	items,
	getWidgetKey,
}) => {
	const workspaceState =
		prev?.[workspaceId] && typeof prev[workspaceId] === "object"
			? prev[workspaceId]
			: {}
	const nextWorkspaceState = { ...workspaceState }

	;(Array.isArray(items) ? items : []).forEach((item) => {
		const widgetId = typeof getWidgetKey === "function" ? getWidgetKey(item) : ""
		if (!widgetId) return
		nextWorkspaceState[widgetId] = {
			...(nextWorkspaceState[widgetId] || {}),
			x: Math.max(0, Number(item?.x) || 0),
			y: Math.max(0, Number(item?.y) || 0),
		}
	})

	return {
		...prev,
		[workspaceId]: nextWorkspaceState,
	}
}

export const persistWidgetWidthState = ({
	item,
	width,
	workspaceId,
	getWidgetUiKeyForItem,
	setCollapsedMap,
	persistWidgetUiPatch,
}) => {
	const widgetId = typeof getWidgetUiKeyForItem === "function" ? getWidgetUiKeyForItem(item) : ""
	if (!workspaceId || !widgetId) return
	const normalizedWidth = coerceSpan(width, WIDGET_GRID_DESKTOP_UNITS)

	setCollapsedMap((prev) => {
		const next = updateCollapsedStateForWidget({
			prev,
			workspaceId,
			widgetId,
			patch: { width: normalizedWidth },
		})
		persistWidgetUiPatch(workspaceId, widgetId, { width: normalizedWidth })
		return next
	})
}

export const persistWidgetPositionState = ({
	items,
	workspaceId,
	getWidgetUiKeyForItem,
	setCollapsedMap,
	persistWidgetUiPatch,
}) => {
	if (!workspaceId) return
	const entries = Array.isArray(items) ? items : []
	if (!entries.length) return

	setCollapsedMap((prev) => {
		return updateCollapsedStateForWidgetPositions({
			prev,
			workspaceId,
			items: entries,
			getWidgetKey: getWidgetUiKeyForItem,
		})
	})

	entries.forEach((item) => {
		const widgetId =
			typeof getWidgetUiKeyForItem === "function" ? getWidgetUiKeyForItem(item) : ""
		if (!widgetId) return
		persistWidgetUiPatch(workspaceId, widgetId, {
			x: Math.max(0, Number(item?.x) || 0),
			y: Math.max(0, Number(item?.y) || 0),
		})
	})
}

export const toggleWidgetCollapseState = ({
	item,
	workspaceId,
	getWidgetUiKeyForItem,
	setCollapsedMap,
	persistWidgetUiPatch,
}) => {
	const widgetId = typeof getWidgetUiKeyForItem === "function" ? getWidgetUiKeyForItem(item) : ""
	if (!widgetId) return

	setCollapsedMap((prev) => {
		const prevCollapsed = !!prev?.[workspaceId]?.[widgetId]?.collapsed
		const nextCollapsed = !prevCollapsed
		const next = updateCollapsedStateForWidget({
			prev,
			workspaceId,
			widgetId,
			patch: { collapsed: nextCollapsed },
		})
		persistWidgetUiPatch(workspaceId, widgetId, { collapsed: nextCollapsed })
		return next
	})
}
