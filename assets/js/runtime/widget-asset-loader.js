;(function () {
	"use strict"

	const loaded = new Set()
	const inFlight = new Map()

	function log(type, asset) {
		const handle = String(asset?.handle || asset?.src || "unknown")
		console.log(`[WidgetAssetLoader] ${type} ${handle}`)
	}

	function normalizeSrc(src) {
		const raw = String(src || "").trim()
		if (!raw) return ""
		try {
			return new URL(raw, window.location.href).toString()
		} catch (_error) {
			return raw
		}
	}

	function keyFor(asset) {
		return String(asset?.handle || normalizeSrc(asset?.src) || "")
	}

	function markLoaded(key, src) {
		if (key) loaded.add(key)
		if (src) loaded.add(src)
	}

	function isAlreadyPresent(tagName, src) {
		if (!src) return false
		const nodes = document.querySelectorAll(`${tagName}[src], ${tagName}[href]`)
		for (let i = 0; i < nodes.length; i += 1) {
			const candidate =
				tagName === "script"
					? String(nodes[i].src || "")
					: String(nodes[i].href || "")
			if (candidate === src) return true
		}
		return false
	}

	function loadStyle(asset) {
		const key = keyFor(asset)
		const src = normalizeSrc(asset?.src)
		if (!key || !src) {
			return Promise.reject(new Error("Invalid CSS manifest entry"))
		}
		if (loaded.has(key) || loaded.has(src) || isAlreadyPresent("link", src)) {
			markLoaded(key, src)
			return Promise.resolve()
		}
		if (inFlight.has(`css:${key}`)) return inFlight.get(`css:${key}`)

		const task = new Promise((resolve, reject) => {
			const link = document.createElement("link")
			link.rel = "stylesheet"
			link.href = src
			link.dataset.sdAssetHandle = key
			log("loading", asset)
			link.onload = function () {
				markLoaded(key, src)
				log("loaded", asset)
				resolve()
			}
			link.onerror = function () {
				log("failed", asset)
				reject(new Error(`Failed CSS asset: ${key}`))
			}
			document.head.appendChild(link)
		}).finally(() => {
			inFlight.delete(`css:${key}`)
		})

		inFlight.set(`css:${key}`, task)
		return task
	}

	function loadScript(asset) {
		const key = keyFor(asset)
		const src = normalizeSrc(asset?.src)
		if (!key || !src) {
			return Promise.reject(new Error("Invalid JS manifest entry"))
		}
		if (loaded.has(key) || loaded.has(src) || isAlreadyPresent("script", src)) {
			markLoaded(key, src)
			return Promise.resolve()
		}
		if (inFlight.has(`js:${key}`)) return inFlight.get(`js:${key}`)

		const task = new Promise((resolve, reject) => {
			const script = document.createElement("script")
			script.src = src
			script.async = false
			script.dataset.sdAssetHandle = key
			log("loading", asset)
			script.onload = function () {
				markLoaded(key, src)
				log("loaded", asset)
				resolve()
			}
			script.onerror = function () {
				log("failed", asset)
				reject(new Error(`Failed JS asset: ${key}`))
			}
			document.head.appendChild(script)
		}).finally(() => {
			inFlight.delete(`js:${key}`)
		})

		inFlight.set(`js:${key}`, task)
		return task
	}

	async function ensureWidgetAssets(manifest) {
		const assets = Array.isArray(manifest) ? manifest : []
		const styles = assets.filter((asset) => asset && asset.type === "css")
		const scripts = assets.filter((asset) => asset && asset.type === "js")

		for (let i = 0; i < styles.length; i += 1) {
			const asset = styles[i]
			try {
				await loadStyle(asset)
			} catch (error) {
				if (asset.required !== false) throw error
			}
		}

		for (let i = 0; i < scripts.length; i += 1) {
			const asset = scripts[i]
			try {
				await loadScript(asset)
			} catch (error) {
				if (asset.required !== false) throw error
			}
		}
	}

	window.SystemDeckWidgetLoader = {
		ensureWidgetAssets,
	}
})()
