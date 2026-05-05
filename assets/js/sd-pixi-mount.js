/**
 * SystemDeck - sd-pixi-mount.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/assets/js/sd-pixi-mount.js
 * @license GPL-2.0-or-later
 *
 * PixiJS Application Mounting and Bridge
 */

;(function () {
	"use strict"

	function hasPixi() {
		return !!(window.PIXI && typeof window.PIXI.Application === "function")
	}

	function mount(rootEl, factory, options) {
		if (!rootEl || typeof factory !== "function" || !hasPixi()) {
			return null
		}

		return factory(rootEl, options || {})
	}

	function destroy(instance) {
		if (instance && typeof instance.destroy === "function") {
			try {
				instance.destroy()
			} catch (_error) {}
		}
	}

	function handlePinMount(event) {
		const detail = event?.detail
		const rootEl = detail?.element
		const renderer = detail?.renderer

		if (!rootEl || !hasPixi()) return
		if (rootEl.dataset.sdMounted === "true") return

		// Identify if this is a Pixi renderer
		const isPixi = renderer === "pixi" || renderer === "metric_clock_analog" || rootEl.classList.contains("sd-pixi-pin")
		if (!isPixi) return

		const registry = window.SystemDeckMetricPinRenderers || {}
		const factory = registry[renderer]
		if (typeof factory !== "function") return

		// Mark as mounted BEFORE calling factory to prevent race conditions
		rootEl.dataset.sdMounted = "true"

		const instance = mount(rootEl, factory, {
			pin: detail.pin || { id: detail.pinId, settings: { renderer } },
			metric: detail.metric || null,
			title: detail.title || detail.pinId,
		})

		if (instance) {
			// Store instance for potential manual destruction
			rootEl._sd_pixi_instance = instance
		}
	}

	window.SystemDeckPixiMount = {
		hasPixi,
		mount,
		destroy,
	}

	document.addEventListener("systemdeck:pin:mount", handlePinMount)
})()
