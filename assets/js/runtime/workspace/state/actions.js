/**
 * SystemDeck Redux Actions
 * Ported from systemdeck-yesterday
 */
import { select } from "@wordpress/data"
import * as types from "./types"
const STORE_NAME = "systemdeck/core"

// Session
export const setActiveWorkspace = (workspaceId) => ({
	type: types.SET_ACTIVE_WORKSPACE,
	payload: { workspaceId },
})

export const setCurrentUser = (user) => ({
	type: types.SET_CURRENT_USER,
	payload: { user },
})

export const setEnvironment = (env) => ({
	type: types.SET_ENVIRONMENT,
	payload: { env },
})

// Workspaces
export function* registerWorkspace(workspace) {
	return {
		type: types.REGISTER_WORKSPACE,
		payload: { workspace },
	}
}

export function* addWorkspace(title) {
	const res = yield { type: "PERSIST_WORKSPACE_ADD", payload: { title } }
	if (res && res.success) {
		return {
			type: types.SD_WORKSPACE_ADD,
			payload: { workspace: res.data.workspace },
		}
	}
}

export function* removeWorkspace(workspaceId) {
	yield { type: "PERSIST_WORKSPACE_REMOVE", payload: workspaceId }
	return {
		type: types.SD_WORKSPACE_REMOVE,
		payload: workspaceId,
	}
}

export function* reorderWorkspaces(workspaces) {
	yield { type: "PERSIST_WORKSPACE_REORDER", payload: workspaces }
	return {
		type: types.SD_WORKSPACE_REORDER,
		payload: workspaces,
	}
}

export function* renameWorkspace(id, title) {
	yield { type: "PERSIST_WORKSPACE_RENAME", payload: { id, title } }
	return {
		type: types.SD_WORKSPACE_RENAME,
		payload: { id, title },
	}
}

export const updateWorkspaceConfig = (id, updates) => ({
	type: types.UPDATE_WORKSPACE_CONFIG,
	payload: { id, updates },
})

// Layouts
export function* updateLayoutItem(layoutId, itemId, updates) {
	return {
		type: types.UPDATE_LAYOUT_ITEM,
		payload: { layoutId, itemId, updates },
	}
}

export function* setLayoutItems(layoutId, items) {
	return {
		type: types.SET_LAYOUT_ITEMS,
		payload: { layoutId, items },
	}
}

export function* persistLayout(layoutId, items) {
	return {
		type: "PERSIST_LAYOUT",
		payload: { layoutId, items },
	}
}

// Widgets
export const registerWidget = (widget) => ({
	type: types.REGISTER_WIDGET,
	payload: { widget },
})

export const registerWidgetV2 = (widget) => ({
	type: "REGISTER_WIDGET_V2",
	payload: widget,
})

export const toggleMetaDrawer = (isOpen) => ({
	type: "TOGGLE_META_DRAWER",
	payload: isOpen,
})

export const updateWidgetConfig = (id, config) => ({
	type: "UPDATE_WIDGET_CONFIG",
	payload: { id, config },
})

export const toggleWidgetVisibility = (id, isVisible) => ({
	type: "TOGGLE_WIDGET_VISIBILITY",
	payload: { id, isVisible },
})

export const setWidgetVisibility = (visibilityMap) => ({
	type: "SET_WIDGET_VISIBILITY",
	payload: visibilityMap,
})

// Pins
export const addPin = (pin) => ({
	type: types.ADD_PIN,
	payload: { pin },
})

export const updatePin = (pinId, updates) => ({
	type: types.UPDATE_PIN,
	payload: { pinId, updates },
})

export const removePin = (pinId) => ({
	type: types.REMOVE_PIN,
	payload: { pinId },
})

export const setPins = (pins) => ({
	type: types.SET_PINS,
	payload: { pins },
})

// UI
export const setDockState = (dockState) => ({
	type: types.SET_DOCK_STATE,
	payload: { dockState },
})

export const setAliveState = (isActive) => ({
	type: types.SET_ALIVE_STATE,
	payload: { isActive },
})

export const setTheme = (theme) => ({
	type: types.SET_THEME,
	payload: { theme },
})

export const togglePanel = (panelId, forceState = null) => ({
	type: types.TOGGLE_PANEL,
	payload: { panelId, forceState },
})

export const setMenuFolded = (isFolded) => ({
	type: types.SET_MENU_FOLDED,
	payload: { isFolded },
})

export const setActiveScreen = (screenId) => ({
	type: types.SET_ACTIVE_SCREEN,
	payload: { screenId },
})

/**
 * Adds a new widget to the current workspace layout.
 * @param {object} widgetData - The raw data from the inspector { id, title, html, type, data }
 */
export function addWidgetToDeck(widgetData) {
	return {
		type: "ADD_WIDGET_TO_DECK",
		payload: {
			id: widgetData.id,
			type: "SMART_WIDGET",
			title: widgetData.title,
			// Ensure we catch 'content' (Phase 9 Inspector) or 'html' (Legacy)
			content: widgetData.content || widgetData.html,

			// --- THE CRITICAL FIX ---
			// Pass the semantic data through to the reducer
			data: widgetData.data,

			// Default placement (desktop base: 1/3 width)
			x: 0,
			y: 0,
			w: 2,
			h: 4,
		},
	}
}

// Phase 15: Configuration Canvas Actions
export const setUIMode = (mode) => ({
	type: types.SET_UI_MODE,
	payload: mode, // 'runtime' | 'config'
})

export function* toggleWorkspaceWidget(widgetId, workspaceId = "") {
	if (!workspaceId) return
	yield {
		type: "TOGGLE_WORKSPACE_WIDGET",
		payload: { widgetId, workspaceId },
	}
	const layout = select(STORE_NAME).getLayout(workspaceId)
	yield {
		type: "PERSIST_LAYOUT",
		payload: { layoutId: workspaceId, items: Object.values(layout) },
	}
}

/**
 * Removes a widget from the current workspace layout.
 */
export function* removeWidgetFromDeck(widgetId, layoutId = "") {
	if (!layoutId) return
	yield {
		type: "REMOVE_WIDGET_FROM_DECK",
		payload: { widgetId, layoutId },
	}
	const layout = select(STORE_NAME).getLayout(layoutId)
	yield {
		type: "PERSIST_LAYOUT",
		payload: { layoutId, items: Object.values(layout) },
	}
}

export const setRegistryEnablement = (enablement) => ({
	type: types.SET_REGISTRY_ENABLEMENT,
	payload: enablement,
})
