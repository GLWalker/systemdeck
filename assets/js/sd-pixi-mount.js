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

	window.SystemDeckPixiMount = {
		hasPixi,
		mount,
		destroy,
	}
})()
