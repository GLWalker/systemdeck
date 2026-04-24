/**
 * SystemDeck Redux Reducers
 * Phase 8: Smart Stacking Logic Implemented
 * Ported from systemdeck-yesterday
 */
import { combineReducers } from "@wordpress/data"
import * as types from "./types"
import { metaReducer } from "./meta-store"

const getBootstrap = () => {
	return (
		window.SYSTEMDECK_BOOTSTRAP?.config ||
		window.SYSTEMDECK_STATE?.config ||
		{}
	)
}

const session = (
	state = {
		activeWorkspaceId: getBootstrap().activeWorkspace || "",
		currentUser: getBootstrap().user || {},
		environment: {},
	},
	action,
) => {
	switch (action.type) {
		case types.SET_ACTIVE_WORKSPACE:
			return { ...state, activeWorkspaceId: action.payload.workspaceId }
		case types.SET_CURRENT_USER:
			return { ...state, currentUser: action.payload.user }
		case types.SET_ENVIRONMENT:
			return { ...state, environment: action.payload.env }
		default:
			return state
	}
}

// 2. Updated Workspaces Reducer (Gatekeeper Logic)
const workspaces = (
	state = {
		byId: getBootstrap().workspaces || {},
		allIds: Object.keys(getBootstrap().workspaces || {}),
		default: { available: [] },
	},
	action,
) => {
	switch (action.type) {
		case types.REGISTER_WORKSPACE:
		case "SD_WORKSPACE_ADD": // Phase 14 compat
			const { workspace } = action.payload
			const wsId = workspace.id || workspace.slug || "ws_" + Date.now()
			return {
				...state,
				byId: { ...state.byId, [wsId]: { ...workspace, id: wsId } },
				allIds: [...new Set([...state.allIds, wsId])].filter(
					(id) => id !== "undefined",
				),
			}
		case types.UNREGISTER_WORKSPACE:
		case "SD_WORKSPACE_REMOVE": // Phase 14 compat
			const removeId = action.payload.workspaceId || action.payload // Handle both obj and string
			const newById = { ...state.byId }
			delete newById[removeId]
			return {
				...state,
				byId: newById,
				allIds: state.allIds.filter((id) => id !== removeId),
			}
		case "SD_WORKSPACE_REORDER":
			// Payload expects array of objects with {id, order} OR just new array of IDs
			// Phase 14 sends array of objects. We just need the IDs in order.
			const newOrder = action.payload
				.map((w) => (typeof w === "string" ? w : w.id))
				.filter((id) => id && id !== "undefined")
			return {
				...state,
				allIds: newOrder,
			}
		case "SD_WORKSPACE_RENAME":
			const { id: rid, title: rtitle } = action.payload
			if (!rid || rid === "undefined") return state
			return {
				...state,
				byId: {
					...state.byId,
					[rid]: {
						...state.byId[rid],
						name: rtitle,
						title: rtitle,
					},
				},
			}
		case types.UPDATE_WORKSPACE_CONFIG: {
			const { id, updates } = action.payload
			if (!id || id === "undefined") return state
			return {
				...state,
				byId: {
					...state.byId,
					[id]: {
						...state.byId[id],
						...updates,
					},
				},
			}
		}
		case "TOGGLE_WORKSPACE_WIDGET": {
			const { widgetId, workspaceId } = action.payload
			const ws = state.byId[workspaceId] || state.default || {}
			const currentList = ws.available || []
			const isAvailable = currentList.includes(widgetId)

			return {
				...state,
				byId: {
					...state.byId,
					[workspaceId]: {
						...ws,
						available: isAvailable
							? currentList.filter((id) => id !== widgetId) // Remove
							: [...currentList, widgetId], // Add
					},
				},
				// Keep 'default' sync for legacy/bootstrap
				default:
					workspaceId === "default"
						? {
								...state.default,
								available: isAvailable
									? currentList.filter(
											(id) => id !== widgetId,
									  )
									: [...currentList, widgetId],
						  }
						: state.default,
			}
		}
		default:
			return state
	}
}

const layouts = (state = getBootstrap().initialLayouts || {}, action) => {
	switch (action.type) {
		case types.UPDATE_LAYOUT_ITEM:
			const { layoutId, itemId, updates } = action.payload
			const currentLayout = state[layoutId] || {}
			const currentItem = currentLayout[itemId] || {}
			return {
				...state,
				[layoutId]: {
					...currentLayout,
					[itemId]: { ...currentItem, ...updates },
				},
			}
		case types.SET_LAYOUT_ITEMS: {
			const { layoutId, items } = action.payload
			let normalizedItems = items
			if (Array.isArray(items)) {
				normalizedItems = items.reduce((acc, item) => {
					const id = item.i || item.id
					if (id) acc[id] = item
					return acc
				}, {})
			}
			return {
				...state,
				[layoutId]: normalizedItems,
			}
		}

		case "TOGGLE_WORKSPACE_WIDGET": {
			// Synchronize with Workspace List
			const { widgetId, workspaceId: targetLayoutId } = action.payload
			const currentLayout = state[targetLayoutId] || {}

			if (currentLayout[widgetId]) {
				// REMOVE
				const { [widgetId]: _, ...remaining } = currentLayout
				return { ...state, [targetLayoutId]: remaining }
			} else {
				// ADD (canonical neutral placement; runtime engine computes first-fit)
				const w = 2
				const h = 4
				return {
					...state,
					[targetLayoutId]: {
						...currentLayout,
						[widgetId]: {
							i: widgetId,
							id: widgetId,
							x: 0,
							y: 0,
							w,
							h,
							// Title/Content will be pulled from registry by Renderer
						},
					},
				}
			}
		}

		// --- PHASE 8 & 10 UPDATE ---
		case "ADD_WIDGET_TO_DECK": {
			const targetLayoutId = "default"
			const activeGrid = state[targetLayoutId] || {}

			const w = action.payload.w || 2
			const h = action.payload.h || 4

			return {
				...state,
				[targetLayoutId]: {
					...activeGrid,
					[action.payload.id]: {
						i: action.payload.id,
						id: action.payload.id,
						x: 0,
						y: 0,
						w: w,
						h: h,
						title: action.payload.title,
						content: action.payload.content,
						// --- THE FIX IS HERE ---
						data: action.payload.data, // <--- We must save this!
					},
				},
			}
		}
		case "REMOVE_WIDGET_FROM_DECK": {
			const { layoutId, widgetId } = action.payload
			const currentLayout = state[layoutId] || {}

			// Immutable removal
			const { [widgetId]: _, ...remainingItems } = currentLayout

			return {
				...state,
				[layoutId]: remainingItems,
			}
		}

		default:
			return state
	}
}

const widgets = (state = {}, action) => {
	switch (action.type) {
		case types.REGISTER_WIDGET:
			return {
				...state,
				[action.payload.widget.id]: action.payload.widget,
			}

		// --- PHASE 7 UPDATE: The Hands ---
		// Registers the captured widget definition
		case "ADD_WIDGET_TO_DECK":
			return {
				...state,
				[action.payload.id]: action.payload,
			}

		default:
			return state
	}
}

const pins = (state = {}, action) => {
	switch (action.type) {
		case types.ADD_PIN:
		case types.UPDATE_PIN:
			return {
				...state,
				[action.payload.pin.id]: {
					...(state[action.payload.pin.id] || {}),
					...action.payload.pin,
				},
			}
		case types.REMOVE_PIN:
			const newState = { ...state }
			delete newState[action.payload.pinId]
			return newState
		case types.SET_PINS:
			return { ...action.payload.pins }
		default:
			// Handle specific update action if separate from add
			if (action.type === types.UPDATE_PIN && action.payload.pinId) {
				return {
					...state,
					[action.payload.pinId]: {
						...(state[action.payload.pinId] || {}),
						...action.payload.updates,
					},
				}
			}
			return state
	}
}

const ui = (
	state = {
		mode: "runtime",
		dockState: "standard",
		isActive: false,
		theme: "light",
		panels: {},
		menuFolded: false,
		activeScreen: "#system",
		lastActiveDock: "standard",
	},
	action,
) => {
	switch (action.type) {
		case types.SET_DOCK_STATE:
			return {
				...state,
				dockState: action.payload.dockState,
				lastActiveDock:
					action.payload.dockState !== "min-dock"
						? action.payload.dockState
						: state.lastActiveDock,
			}
		case types.SET_ALIVE_STATE:
			return { ...state, isActive: action.payload.isActive }
		case types.SET_THEME:
			return { ...state, theme: action.payload.theme }
		case types.SET_MENU_FOLDED:
			return { ...state, menuFolded: action.payload.isFolded }
		case types.SET_ACTIVE_SCREEN:
			return { ...state, activeScreen: action.payload.screenId }
		case "SET_UI_MODE":
			return { ...state, mode: action.payload }
		case types.TOGGLE_PANEL:
			const { panelId, forceState } = action.payload
			const nextState =
				forceState !== null ? forceState : !state.panels[panelId]
			return {
				...state,
				panels: { ...state.panels, [panelId]: nextState },
			}
		default:
			return state
	}
}

export default combineReducers({
	session,
	workspaces,
	layouts,
	widgets,
	pins,
	ui,
	meta: metaReducer,
})
