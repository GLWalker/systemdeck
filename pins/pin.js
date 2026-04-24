(function () {
	"use strict"

	function getMountRoot(detail) {
		if (!detail || !(detail.element instanceof Element)) {
			return null
		}
		return detail.element
	}

	function triggerOpenPinManager() {
		const event = new CustomEvent("systemdeck:open-screen-options", {
			detail: { source: "pin-runtime" },
		})
		document.dispatchEvent(event)
	}

	function mountControlPin(root) {
		const action = String(root.getAttribute("data-pin-action") || "").trim()
		if (action !== "open_pin_manager") {
			return
		}

		const activate = function () {
			triggerOpenPinManager()
		}

		root.addEventListener("click", activate)
		root.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault()
				activate()
			}
		})
	}

	function handlePinMount(event) {
		const detail = event && event.detail ? event.detail : null
		const root = getMountRoot(detail)
		if (!root) {
			return
		}

		if (root.dataset.sdMounted === "1") {
			return
		}
		root.dataset.sdMounted = "1"

		const pinId = String(detail.pinId || root.getAttribute("data-pin-id") || "").trim()
		if (pinId === "core_open_pin_manager") {
			mountControlPin(root)
		}
	}

	document.addEventListener("systemdeck:pin:mount", handlePinMount)
})()
