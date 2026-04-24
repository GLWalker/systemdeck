;(function ($) {
	"use strict"

	const SceneFactory = window.SystemDeckHudAtlasPixiScene?.create || null

	const INSTANCES = new WeakMap()
	const BOOT_LABEL = "HUD Atlas"
	let pixiReadyPromise = null
	let discoveryObserver = null

	function waitForFonts() {
		if (!document.fonts || typeof document.fonts.load !== "function") {
			return Promise.resolve()
		}

		return Promise.all([
			document.fonts.load('400 20px "dashicons"'),
			document.fonts.load('400 20px Arial'),
		]).catch(() => {})
	}

	function waitForPixi(timeout = 3000) {
		if (window.PIXI?.Application) {
			return Promise.resolve()
		}

		if (pixiReadyPromise) {
			return pixiReadyPromise
		}

		pixiReadyPromise = new Promise((resolve, reject) => {
			const start = performance.now()

			function check() {
				if (window.PIXI?.Application) {
					resolve()
					return
				}

				if (performance.now() - start > timeout) {
					reject(new Error("PIXI failed to load"))
					return
				}

				requestAnimationFrame(check)
			}

			check()
		})

		return pixiReadyPromise.catch((error) => {
			pixiReadyPromise = null
			throw error
		})
	}

	function mountPixi(instance) {
		if (!SceneFactory) {
			console.warn(`${BOOT_LABEL}: No Pixi Scene available`)
			return
		}

		const mountNode = instance.root.querySelector('[data-role="pixi-stage"]')
		if (!mountNode) {
			console.warn(`${BOOT_LABEL}: Pixi stage not found`, instance.root)
			return
		}

		try {
			console.log(`${BOOT_LABEL}: mounting Pixi scene`)
			mountNode.style.pointerEvents = "auto"
			const renderer = SceneFactory(mountNode, {
				target: "core.hud-atlas",
				mode: "embedded",
			})

			instance.pixiRenderer = renderer
			const result = renderer?.mount?.()

			if (result?.then) {
				result
					.then(() => onPixiReady(instance))
					.catch((err) => onPixiFail(instance, err))
			} else {
				onPixiReady(instance)
			}
		} catch (err) {
			onPixiFail(instance, err)
		}
	}

	function onPixiReady(instance) {
		instance.pixiReady = true
		instance.root.classList.add("is-pixi-active")
		console.log(`${BOOT_LABEL}: ready`)

		requestAnimationFrame(() => {
			instance.pixiRenderer?.onResize?.()
			renderInstance(instance)
		})
	}

	function onPixiFail(instance, error) {
		console.error(`${BOOT_LABEL} Pixi mount failed:`, error)
		instance.pixiRenderer = null
		instance.pixiReady = false
		instance.root.classList.remove("is-pixi-active")
	}

	function renderInstance(instance) {
		if (!instance.root.isConnected) return

		const fallback = instance.root.querySelector('[data-role="fallback"]')
		if (fallback) {
			fallback.textContent = instance.pixiReady
				? "HUD Atlas ready."
				: "Loading HUD Atlas..."
		}

		if (instance.pixiRenderer?.draw && instance.pixiReady) {
			instance.pixiRenderer.draw({})
		}
	}

	function mountInstance(root) {
		if (INSTANCES.has(root)) return

		console.log(`${BOOT_LABEL}: booting`, root)

		const instance = {
			root,
			pixiRenderer: null,
			pixiReady: false,
		}

		INSTANCES.set(root, instance)
		mountPixi(instance)
	}

	function ensureDiscoveryObserver() {
		if (discoveryObserver || typeof MutationObserver !== "function") return

		discoveryObserver = new MutationObserver((mutations) => {
			let shouldBoot = false
			for (const mutation of mutations) {
				mutation.removedNodes?.forEach((node) => {
					if (!(node instanceof Element)) return
					if (
						node.matches?.(
							'.sd-hud-atlas-module[data-widget-id="core.hud-atlas"]',
						)
					) {
						unmountInstance(node)
					}
					node
						.querySelectorAll?.(
							'.sd-hud-atlas-module[data-widget-id="core.hud-atlas"]',
						)
						.forEach((root) => unmountInstance(root))
				})

				mutation.addedNodes?.forEach((node) => {
					if (!(node instanceof Element)) return
					if (
						node.matches?.(
							'.sd-hud-atlas-module[data-widget-id="core.hud-atlas"]',
						) ||
						node.querySelector?.(
							'.sd-hud-atlas-module[data-widget-id="core.hud-atlas"]',
						)
					) {
						shouldBoot = true
					}
				})
			}

			if (shouldBoot) {
				boot()
			}
		})

		discoveryObserver.observe(document.body, {
			childList: true,
			subtree: true,
		})
	}

	function unmountInstance(root) {
		const instance = INSTANCES.get(root)
		if (!instance) return

		instance.pixiRenderer?.destroy?.()
		instance.pixiRenderer = null
		instance.pixiReady = false
		INSTANCES.delete(root)
	}

	function boot() {
		document
			.querySelectorAll(
				'.sd-hud-atlas-module[data-widget-id="core.hud-atlas"]',
			)
			.forEach((root) => mountInstance(root))
	}

	$(document).ready(function () {
		Promise.all([waitForFonts(), waitForPixi()])
			.then(() => {
				boot()
				ensureDiscoveryObserver()
			})
			.catch((error) => {
				console.error(`${BOOT_LABEL}: boot blocked`, error)
			})
	})

	$(document).on("sd_widget_mount sd_workspace_rendered", function () {
		waitForPixi()
			.then(() => {
				boot()
				ensureDiscoveryObserver()
			})
			.catch((error) => {
				console.error(`${BOOT_LABEL}: remount blocked`, error)
			})
	})

	$(document).on("widget-removed", (_event, widgetId) => {
		if (!widgetId) return
		document
			.querySelectorAll(`[data-widget-id="${widgetId}"]`)
			.forEach((root) => unmountInstance(root))
	})
})(jQuery)
