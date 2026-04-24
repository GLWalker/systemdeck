/**
 * SystemDeck Meta-Options Store Slice
 * Manages configuration, registry authority, and drawer state.
 * Ported from systemdeck-yesterday
 */

const getBootstrap = () => {
	return window.SYSTEMDECK_BOOTSTRAP?.config || window.sd_vars || {}
}

const initialState = {
	isDrawerOpen: false,
	isPinPickerOpen: false,
	registry: {}, // Capability: What exists
	configs: {}, // Settings: How it looks
	visibility: {}, // Intent: Is it turned on?
	enablement: getBootstrap().registry_enablement || [], // Global Authority: Is it allowed?
}

export const metaReducer = (state = initialState, action) => {
	switch (action.type) {
		case "SET_REGISTRY_ENABLEMENT":
			return {
				...state,
				enablement: action.payload || [],
			}
		case "TOGGLE_META_DRAWER":
			return {
				...state,
				isDrawerOpen:
					action.payload !== undefined
						? action.payload
						: !state.isDrawerOpen,
			}
		case "TOGGLE_PIN_PICKER":
			return {
				...state,
				isPinPickerOpen:
					action.payload !== undefined
						? action.payload
						: !state.isPinPickerOpen,
			}

		case "REGISTER_WIDGET_V2":
			return {
				...state,
				registry: {
					...state.registry,
					[action.payload.id]: action.payload,
				},
				// Default visibility to TRUE upon registration if not defined
				visibility: {
					...state.visibility,
					[action.payload.id]:
						state.visibility[action.payload.id] !== undefined
							? state.visibility[action.payload.id]
							: true,
				},
			}

		case "UPDATE_WIDGET_CONFIG":
			return {
				...state,
				configs: {
					...state.configs,
					[action.payload.id]: {
						...(state.configs[action.payload.id] || {}),
						...action.payload.config,
					},
				},
			}

		case "TOGGLE_WIDGET_VISIBILITY":
			return {
				...state,
				visibility: {
					...state.visibility,
					[action.payload.id]: action.payload.isVisible,
				},
			}

		case "SET_WIDGET_VISIBILITY":
			return {
				...state,
				visibility: action.payload,
			}

		default:
			return state
	}
}
