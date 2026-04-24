/**
 * SystemDeck Store Initialization
 * Uses @wordpress/data if available, ensuring native integration.
 * Ported from systemdeck-yesterday
 */
import { createReduxStore, register } from "@wordpress/data"
import reducer from "./reducer" // Ensure reducer is default export from reducer.js
import * as actions from "./actions"
import * as selectors from "./selectors"
import controls from "./controls"

const STORE_NAME = "systemdeck/core"

// Define the store configuration
const storeConfig = {
	reducer,
	actions,
	selectors,
	controls,
	resolvers: {
		// Future: Add resolvers for fetching data if not in state
	},
}

// 1. Create the store definition
const store = createReduxStore(STORE_NAME, storeConfig)

// 2. Register it with WordPress
register(store)

export default store
export { STORE_NAME }
