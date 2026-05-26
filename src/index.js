import { render } from "@wordpress/element"
import CanvasManager from "../assets/js/runtime/workspace/CanvasManager"
import { initializeMenuController } from "../assets/js/runtime/workspace/controllers/MenuController"
import { initializeInspector } from "./runtime/Inspector"
import "./style.scss"
import "../assets/js/runtime/workspace/state/store" // Initialize Redux Store

import domReady from "@wordpress/dom-ready"

import { dispatch } from "@wordpress/data"
import { STORE_NAME } from "../assets/js/runtime/workspace/state/store"

/**
 * SystemDeck Canvas Runtime Entry Point
 */
domReady(() => {
	const root = document.getElementById("sd-canvas-root")

	if (!root) {
		return
	}

	console.log("SystemDeck: Initializing Canvas Runtime...")

	const bootConfig = window.sd_vars || window.SYSTEMDECK_BOOTSTRAP?.config || {}
	if (bootConfig.workspaces) {
		const workspaces =
			typeof bootConfig.workspaces === "object"
				? Object.values(bootConfig.workspaces)
				: bootConfig.workspaces

		console.log("SystemDeck: Hydrating Workspaces...", workspaces)

		workspaces.forEach((ws) => {
			dispatch(STORE_NAME).registerWorkspace(ws)
		})
	}

	// Phase 10: CanvasManager handles boot errors/timeouts internally
	render(<CanvasManager />, root)
	// Initialize the bridge after render
	setTimeout(() => initializeMenuController(), 100)
	console.log("SystemDeck: Canvas Mounted.")

	// GLOBAL API BRIDGE
	if (!window.SystemDeck) {
		window.SystemDeck = {}
	}

	// INSPECTOR BRIDGE (For Canvas Integration)
	window.addEventListener("message", (event) => {
		if (event.data && event.data.command === "sd_inspector_toggle") {
			const active = event.data.active
			if (active) {
				console.log("SystemDeck Runtime: Activating Inspector...")
				if (window.SystemDeck.inspectorCleanup)
					window.SystemDeck.inspectorCleanup()
				window.SystemDeck.inspectorCleanup = initializeInspector(window)
			} else {
				console.log("SystemDeck Runtime: Deactivating Inspector...")
				if (window.SystemDeck.inspectorCleanup) {
					window.SystemDeck.inspectorCleanup()
					window.SystemDeck.inspectorCleanup = null
				}
			}
		}
	})

/**
 * Enhanced loadShell for external callers (like FSE Sidebar)
 * Synchronization between React Runtime and Vanilla Shell.
 */
	window.SystemDeck.loadShell = function () {
		const deck = document.getElementById("systemdeck")
		if (deck) {
			deck.classList.remove("sd-closed")
			deck.classList.remove("sd-drawer-hidden") // Ensure it's not hidden by drawer logic
			deck.setAttribute("aria-hidden", "false")

			// Use property or attribute for inert
			if ("inert" in deck) {
				deck.inert = false
			} else {
				deck.removeAttribute("inert")
			}

			// Sync State
			localStorage.setItem("sd_is_closed", "false")
			document.cookie = "sd_is_active=true; path=/; max-age=31536000"

			// Broadcast open event for vanilla listeners
			document.dispatchEvent(new CustomEvent("system_deck_open"))

			console.log("SystemDeck: Shell Launched.")
		} else {
			console.warn("SystemDeck: Shell not found in DOM.")
		}
	}

	window.SystemDeck.closeShell = function () {
		const deck = document.getElementById("systemdeck")
		if (deck) {
			deck.classList.add("sd-closed")
			deck.setAttribute("aria-hidden", "true")

			if ("inert" in deck) {
				deck.inert = true
			} else {
				deck.setAttribute("inert", "")
			}

			localStorage.setItem("sd_is_closed", "true")
			document.cookie = "sd_is_active=false; path=/; max-age=0"

			document.dispatchEvent(new CustomEvent("system_deck_close"))
		}
	}
})
