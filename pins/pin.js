/**
 * SystemDeck - pin.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/pins/pin.js
 * @license GPL-2.0-or-later
 *
 * Pin Client-side Runtime (Interactions & Rendering)
 */

(function () {
	"use strict"

	function getMountRoot(detail) {
		if (!detail || !(detail.element instanceof Element)) {
			return null
		}
		return detail.element
	}

	function triggerOpenPinManager() {
		const event = new CustomEvent("systemdeck:open-pin-picker", {
			detail: { source: "pin-runtime" },
		})
		document.dispatchEvent(event)
	}

	function mountActionPin(root) {
		const action = String(root.getAttribute("data-pin-action") || "").trim()
		if (!action) return

		const activate = function (e) {
			e.stopPropagation()
			if (action === "open_pin_manager") {
				triggerOpenPinManager()
			} else if (action === "open_note") {
				const noteId = parseInt(root.getAttribute("data-note-id") || "0")
				const workspaceId = root.getAttribute("data-workspace-id") || ""
				if (noteId > 0) {
					document.dispatchEvent(new CustomEvent("systemdeck:open-note", {
						detail: { noteId, mode: "read", workspaceId }
					}))
				}
			} else if (action === "open_vault_file") {
				const fileId = parseInt(root.getAttribute("data-file-id") || "0")
				const workspaceId = root.getAttribute("data-workspace-id") || ""
				// Check if the clicked element or its parents (up to the root) have a data-mode
				const clickedMode = e.target.closest("[data-mode]")?.getAttribute("data-mode")
				const mode = clickedMode || root.getAttribute("data-mode") || "read"
				if (fileId > 0) {
					document.dispatchEvent(new CustomEvent("systemdeck:open-vault-file", {
						detail: { fileId, mode, workspaceId }
					}))
				}
			}
		}

		root.addEventListener("click", activate)
		root.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault()
				activate(event)
			}
		})
	}

	function handlePinMount(event) {
		const detail = event && event.detail ? event.detail : null
		const root = getMountRoot(detail)
		if (!root) {
			return
		}

		if (root.dataset.sdMounted === "true") {
			return
		}
		root.dataset.sdMounted = "true"

		mountActionPin(root)
	}

	document.addEventListener("systemdeck:pin:mount", handlePinMount)
})()
