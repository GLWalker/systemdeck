/**
 * SystemDeck Redux Selectors
 * Ported from systemdeck-yesterday
 */

// 1. Session
export const getActiveWorkspaceId = (state) =>
	state.session.activeWorkspaceId || ""
export const getCurrentUser = (state) => state.session.currentUser
export const getEnvironment = (state) => state.session.environment

// 2. Workspaces
export const getWorkspace = (state, id) => state.workspaces.byId[id]
export const getAllWorkspaces = (state) =>
	state.workspaces.allIds
		.map((id) => state.workspaces.byId[id])
		.filter(Boolean)

export const getActiveWorkspace = (state) => {
	const id = getActiveWorkspaceId(state)
	return getWorkspace(state, id)
}

// 3. Layouts
// --- NEW: Required for Persistence Engine ---
export const getLayouts = (state) => state.layouts

export const getLayout = (state, layoutId) => state.layouts[layoutId] || {}

// *** UPDATED SELECTOR ***
export const getCurrentLayout = (state) => {
	// Strategy A: Try to find the specific layout assigned to the active workspace
	const ws = getActiveWorkspace(state)
	if (ws && ws.layoutId) {
		return getLayout(state, ws.layoutId)
	}

	// Strategy B (Fallback): If the workspace registry is empty (bootstrapping),
	// look for a layout that matches the active ID (e.g., 'default').
	const activeId = getActiveWorkspaceId(state)
	return getLayout(state, activeId)
}

// 4. Widgets
export const getWidget = (state, id) => state.widgets[id]
export const getWidgets = (state) => state.widgets || {}
export const getAllWidgets = (state) =>
	state.widgets ? Object.values(state.widgets) : []

// 5. Pins
export const getPin = (state, id) => state.pins[id]
// Added safety check: (state.pins || {}) prevents crash if state isn't ready
export const getAllPins = (state) =>
	state.pins ? Object.values(state.pins) : []

export const getPinsByContext = (state, context) => {
	return getAllPins(state).filter((pin) => {
		// Implement logic to match context (e.g. pageId matches)
		return true
	})
}

// 6. UI
export const getUIMode = (state) => state.ui.mode || "runtime"

// Gatekeeper Selector: Returns only widgets allowed in the workspace
export const getAvailableWidgets = (state) => {
	const registry = state.meta?.registry || {} // All possible widgets
	const activeId = getActiveWorkspaceId(state)
	const allowedIds = state.workspaces.byId?.[activeId]?.available || []

	// Return filtered object
	return allowedIds.reduce((acc, id) => {
		if (registry[id]) {
			acc[id] = registry[id]
		}
		return acc
	}, {})
}

// Helper to check if a specific widget is allowed
export const isWidgetAvailable = (state, widgetId) => {
	const activeId = getActiveWorkspaceId(state)
	return (state.workspaces.byId?.[activeId]?.available || []).includes(widgetId)
}

export const getDockState = (state) => state.ui.dockState
export const isSystemAlive = (state) => state.ui.isActive
export const getTheme = (state) => state.ui.theme
export const isMenuFolded = (state) => state.ui.menuFolded
export const getActiveScreen = (state) => state.ui.activeScreen
export const isPanelOpen = (state, panelId) => !!state.ui.panels[panelId]

// --- PATCH: Core UI Memory Access ---
export const getUIState = (state) => state.ui || {}

/* --- Meta-Options Selectors (Phase 14 Contract) --- */

/**
 * Retrieve the configuration object for a specific widget instance.
 * Returns an empty object if no config exists to prevent destructuring errors.
 *
 * @param {Object} state - Global Redux state
 * @param {string} widgetId - The unique ID of the widget instance
 * @return {Object} The configuration object
 */
export const getWidgetConfig = (state, widgetId) => {
	return state.meta?.configs?.[widgetId] || {}
}

/**
 * Check if a specific widget has configuration.
 *
 * @param {Object} state - Global Redux state
 * @param {string} widgetId - The unique ID of the widget instance
 * @return {boolean}
 */
export const hasWidgetConfig = (state, widgetId) => {
	return Boolean(state.meta?.configs?.[widgetId])
}

/**
 * Retrieve the full V2 Registry of available widgets.
 */
export const getRegistry = (state) => {
	return state.meta ? state.meta.registry : {}
}

/**
 * Compatibility alias used by DiscoveryCanvas.
 * Returns a snapshot-like object with a widgets map.
 */
export const getRegistrySnapshot = (state) => {
	return {
		widgets: getRegistry(state),
	}
}

/**
 * Retrieve the full map of widget configurations.
 */
export const getWidgetConfigs = (state) => {
	return state.meta ? state.meta.configs : {}
}

/**
 * Retrieve the full map of widget visibility settings.
 */
export const getWidgetVisibility = (state) => {
	return state.meta?.visibility || {}
}

/**
 * Retrieve the global registry enablement list.
 */
export const getRegistryEnablement = (state) => {
	const raw = state.meta?.enablement || []
	return Array.isArray(raw) ? raw : Object.values(raw)
}

/**
 * Check if a specific widget should be visible.
 * Default to true if not explicitly set (opt-out model).
 */
export const isWidgetVisible = (state, widgetId) => {
	const visibility = getWidgetVisibility(state)
	return visibility[widgetId] !== false
}

/**
 * check if the Meta-Options drawer is currently visible.
 */
export const isMetaDrawerOpen = (state) => {
	return state.meta ? state.meta.isDrawerOpen : false
}
