;(function ($) {
	"use strict"

	const ROOT_SELECTOR = '.sd-time-monitor-module[data-pixi-enabled="1"]'
	const STREAM = window.SystemDeckTelemetryStream || null

	if (
		STREAM &&
		(!STREAM.historyBuffer || STREAM.engineVariant !== "advanced")
	) {
		console.warn(
			"Time Monitor expects the advanced telemetry stream engine.",
		)
	}

	function getSceneFactory() {
		return window.SystemDeckTimeMonitorPixiScene?.create || null
	}

	const INSTANCES = new WeakMap()
	const INSTANCES_BY_KEY = new Map()
	const ROOT_ATTEMPTS = new WeakMap()

	let discoveryTimer = null
	let discoveryInterval = null
	let discoveryUntil = 0
	let globalTickHandle = null
	let streamUnsubscribe = null
	let observer = null
	const ROOT_BOOT_RETRY_LIMIT = 120
	const DISCOVERY_INTERVAL_MS = 200
	const DISCOVERY_WINDOW_MS = 8000
	const ORPHAN_GRACE_MS = 1500

	function logBoot(message, root) {
		const id = root?.id || root?.dataset?.widgetId || "unknown"
		const key = root?.dataset?.tmInstanceId || "unknown"
		console.log(`[TM boot] ${message}`, { id, key })
	}

	function logPrune(message, key) {
		console.log(`[TM prune] ${message}`, { key })
	}

	function logDestroy(message, key) {
		console.log(`[TM destroy] ${message}`, { key })
	}

	function ensureRootKey(root) {
		if (!root) return ""
		if (root.dataset.tmInstanceId) return root.dataset.tmInstanceId
		const stable =
			String(root.id || "").trim() ||
			String(root.dataset.widgetId || "").trim() ||
			String(root.dataset.itemId || "").trim() ||
			`tm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
		root.dataset.tmInstanceId = stable
		return stable
	}

	function isRootVisible(root) {
		if (!root || !document.body?.contains(root)) return false
		const rect = root.getBoundingClientRect()
		if (rect.width <= 0 || rect.height <= 0) return false
		const stage = root.closest(".sd-canvas-stage")
		if (stage && window.getComputedStyle(stage).display === "none")
			return false
		const hostWidget = root.closest(".postbox.sd-widget")
		if (hostWidget?.classList.contains("closed")) return false
		return true
	}

	function isInstanceVisible(instance) {
		if (!instance?.root || !instance?.stageRoot) return false
		if (!isRootVisible(instance.root)) return false
		const rect = instance.stageRoot.getBoundingClientRect()
		return rect.width > 0 && rect.height > 0
	}

	function getNonce() {
		return window.SystemDeckSecurity?.nonce || window.sd_vars?.nonce || ""
	}

	function getAjaxUrl() {
		return (
			window.SystemDeckSecurity?.ajaxurl ||
			window.sd_vars?.ajaxurl ||
			window.sd_vars?.ajax_url ||
			window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"
		)
	}

	function toFiniteNumber(value, fallback = 0) {
		const numeric = Number(value)
		return Number.isFinite(numeric) ? numeric : fallback
	}

	function parseUptimeSeconds(value) {
		if (typeof value === "number" && Number.isFinite(value)) {
			return Math.max(0, value)
		}

		const raw = String(value || "").trim()
		if (!raw) return null

		const numeric = Number(raw)
		if (Number.isFinite(numeric)) {
			return Math.max(0, numeric)
		}

		const units = [
			{ pattern: /(\d+)\s*d/i, seconds: 86400 },
			{ pattern: /(\d+)\s*h/i, seconds: 3600 },
			{ pattern: /(\d+)\s*m/i, seconds: 60 },
			{ pattern: /(\d+)\s*s/i, seconds: 1 },
		]

		let total = 0
		let matched = false
		units.forEach(({ pattern, seconds }) => {
			const match = raw.match(pattern)
			if (!match) return
			total += Number(match[1] || 0) * seconds
			matched = true
		})

		return matched ? total : null
	}

	function toNullableNumber(value) {
		if (value === null || value === undefined) return null
		if (typeof value === "string" && value.trim() === "") return null
		const numeric = Number(value)
		return Number.isFinite(numeric) ? numeric : null
	}

	function toEpochMs(value, fallbackMs = Date.now()) {
		const numeric = Number(value)
		if (!Number.isFinite(numeric) || numeric <= 0) return fallbackMs
		return numeric > 1e12 ? numeric : numeric * 1000
	}

	function formatClock(epochMs) {
		const date = new Date(Number(epochMs || 0))
		if (Number.isNaN(date.getTime())) return "--:--:--"

		return date.toLocaleTimeString([], {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
	}

	function formatDrift(ms) {
		const numeric = Number(ms || 0)
		if (!Number.isFinite(numeric)) return "--"
		const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : ""
		if (Math.abs(numeric) >= 1000) {
			return `${sign}${(Math.abs(numeric) / 1000).toFixed(3)}s`
		}
		return `${sign}${Math.abs(numeric).toFixed(1)}ms`
	}

	function classifyDrift(ms) {
		const drift = Math.abs(Number(ms || 0))
		if (!Number.isFinite(drift)) {
			return {
				status: "unknown",
				label: "Unknown",
				severity: 0,
			}
		}
		if (drift >= 1000) {
			return {
				status: "critical",
				label: "Critical drift",
				severity: 3,
			}
		}
		if (drift >= 250) {
			return {
				status: "warning",
				label: "Slight drift",
				severity: 2,
			}
		}
		return {
			status: "normal",
			label: "Aligned",
			severity: 1,
		}
	}

	function cloneHistory(history) {
		return {
			serverBrowser: Array.isArray(history?.serverBrowser)
				? history.serverBrowser.slice(-120)
				: [],
			wpBrowser: Array.isArray(history?.wpBrowser)
				? history.wpBrowser.slice(-120)
				: [],
			serverWp: Array.isArray(history?.serverWp)
				? history.serverWp.slice(-120)
				: [],
			ping: Array.isArray(history?.ping) ? history.ping.slice(-120) : [],
		}
	}

	function resolveTimezoneLabel(raw, fallback) {
		const label = String(raw || "").trim()
		return label || String(fallback || "Browser")
	}

	function normalizeTelemetry(raw, root) {
		const now = Date.now()

		const serverEpochMs = toEpochMs(
			raw?.sources?.server?.epochMs ??
				raw?.serverEpochMs ??
				raw?.server_epoch_ms,
			now,
		)

		const wpEpochMs = toEpochMs(
			raw?.sources?.wp?.epochMs ?? raw?.wpEpochMs ?? raw?.wp_epoch_ms,
			now,
		)

		const browserEpochMs = now

		const driftServerVsWpMs = toFiniteNumber(
			raw?.drift?.serverVsWpMs ??
				raw?.drift?.server_vs_wp_ms ??
				serverEpochMs - wpEpochMs,
			serverEpochMs - wpEpochMs,
		)

		const driftServerVsBrowserMs = toFiniteNumber(
			raw?.drift?.serverVsBrowserMs ??
				raw?.drift?.server_vs_browser_ms ??
				serverEpochMs - browserEpochMs,
			serverEpochMs - browserEpochMs,
		)

		const driftWpVsBrowserMs = toFiniteNumber(
			raw?.drift?.wpVsBrowserMs ??
				raw?.drift?.wp_vs_browser_ms ??
				wpEpochMs - browserEpochMs,
			wpEpochMs - browserEpochMs,
		)

		const serverState =
			raw?.sources?.server?.status ||
			classifyDrift(driftServerVsBrowserMs).status
		const wpState =
			raw?.sources?.wp?.status || classifyDrift(driftWpVsBrowserMs).status
		const browserState =
			raw?.sources?.browser?.status || classifyDrift(0).status

		const history = cloneHistory(raw?.history)

		const uptimeSeconds =
			parseUptimeSeconds(
				raw?.uptime?.seconds ??
					raw?.uptime?.human ??
					raw?.uptimeSeconds ??
					raw?.uptimeHuman ??
					raw?.uptime_seconds ??
					raw?.uptime_human ??
					raw?.uptime,
			) ?? 0

		const uptimeHuman = String(
			raw?.uptime?.human ??
				raw?.uptimeHuman ??
				raw?.uptime_human ??
				raw?.uptime ??
				"0m",
		)

		const pingValueMs = toNullableNumber(
			raw?.ping?.valueMs ??
				raw?.pingValueMs ??
				raw?.ping_ms ??
				raw?.pingMs ??
				root?.dataset?.pingMs,
		)

		const syncSeverity = Math.max(
			classifyDrift(driftServerVsWpMs).severity,
			classifyDrift(driftServerVsBrowserMs).severity,
			classifyDrift(driftWpVsBrowserMs).severity,
		)

		const syncStatus =
			syncSeverity >= 3
				? "critical"
				: syncSeverity >= 2
				? "warning"
				: syncSeverity >= 1
				? "normal"
				: "unknown"

		const syncLabel =
			syncStatus === "critical"
				? "DRIFT"
				: syncStatus === "warning"
				? "OFFSET"
				: "SYNCED"

		return {
			sampleTimestampMs: toFiniteNumber(raw?.sampleTimestampMs, now),

			sources: {
				server: {
					epochMs: serverEpochMs,
					timezoneLabel: resolveTimezoneLabel(
						raw?.sources?.server?.timezoneLabel ??
							raw?.serverTimezoneLabel,
						root?.dataset?.tzServer || "UTC",
					),
					displayLabel:
						raw?.sources?.server?.displayLabel ||
						formatClock(serverEpochMs),
					status: serverState,
				},
				wp: {
					epochMs: wpEpochMs,
					timezoneLabel: resolveTimezoneLabel(
						raw?.sources?.wp?.timezoneLabel ?? raw?.wpTimezoneLabel,
						root?.dataset?.tzWp || "WP Local",
					),
					displayLabel:
						raw?.sources?.wp?.displayLabel ||
						formatClock(wpEpochMs),
					status: wpState,
				},
				browser: {
					epochMs: browserEpochMs,
					timezoneLabel: resolveTimezoneLabel(
						raw?.sources?.browser?.timezoneLabel ??
							raw?.browserTimezoneLabel,
						root?.dataset?.tzBrowser ||
							root?.dataset?.tzBrowserAbbr ||
							"Browser",
					),
					displayLabel:
						raw?.sources?.browser?.displayLabel ||
						formatClock(browserEpochMs),
					status: browserState,
				},
			},

			drift: {
				serverVsWpMs: driftServerVsWpMs,
				serverVsBrowserMs: driftServerVsBrowserMs,
				wpVsBrowserMs: driftWpVsBrowserMs,
			},

			uptime: {
				seconds: uptimeSeconds,
				human: uptimeHuman,
			},

			ping: {
				valueMs: pingValueMs,
				status: String(raw?.ping?.status || raw?.pingStatus || "idle"),
			},

			sync: {
				label: syncLabel,
				severity: syncSeverity,
				status: syncStatus,
			},

			history,
		}
	}

	function buildSnapshot(instance) {
		const base =
			instance.normalized || normalizeTelemetry({}, instance.root)
		const now = Date.now()
		const elapsed = Math.max(0, now - base.sampleTimestampMs)

		const serverEpochMs = base.sources.server.epochMs + elapsed
		const wpEpochMs = base.sources.wp.epochMs + elapsed
		const browserEpochMs = now

		return {
			sampleTimestampMs: now,

			sources: {
				server: {
					...base.sources.server,
					epochMs: serverEpochMs,
					displayLabel: formatClock(serverEpochMs),
				},
				wp: {
					...base.sources.wp,
					epochMs: wpEpochMs,
					displayLabel: formatClock(wpEpochMs),
				},
				browser: {
					...base.sources.browser,
					epochMs: browserEpochMs,
					displayLabel: formatClock(browserEpochMs),
				},
			},

			drift: { ...base.drift },
			uptime: {
				...base.uptime,
				seconds: Math.max(
					0,
					Number(base.uptime.seconds || 0) + elapsed / 1000,
				),
			},
			ping: { ...base.ping },
			sync: { ...base.sync },
			history: cloneHistory(base.history),
		}
	}

	function updateScreenReaderSummary(instance, snapshot) {
		const statusEl = instance.screenReader
		if (!statusEl) return

		const server = snapshot?.sources?.server?.displayLabel || "--:--:--"
		const wp = snapshot?.sources?.wp?.displayLabel || "--:--:--"
		const browser = snapshot?.sources?.browser?.displayLabel || "--:--:--"
		const sync = snapshot?.sync?.label || "WAITING"
		const ping =
			snapshot?.ping?.valueMs === null ||
			snapshot?.ping?.valueMs === undefined
				? "Ping unavailable"
				: `Ping ${Math.round(snapshot.ping.valueMs)} milliseconds`
		const drift = formatDrift(snapshot?.drift?.serverVsBrowserMs)

		statusEl.textContent =
			`Server ${server}. ` +
			`WordPress ${wp}. ` +
			`Browser ${browser}. ` +
			`Status ${sync}. ` +
			`${ping}. ` +
			`Server to browser drift ${drift}.`
	}

	function setDomStatus(instance, message, state = "idle") {
		if (instance.statusNode) {
			instance.statusNode.textContent = message || ""
			instance.statusNode.dataset.state = state
		}
		if (instance.engine?.setStatus) {
			instance.engine.setStatus({
				label: message || "",
				status: state,
			})
		}
	}

	function updatePingButtonState(instance, status = "idle") {
		const button = instance.pingButton
		if (!button) return

		button.disabled = status === "pending"
		button.setAttribute(
			"aria-busy",
			status === "pending" ? "true" : "false",
		)
	}

	function safeRendererUpdate(engine, snapshot) {
		if (!engine || engine.destroyed || !snapshot) return
		if (typeof engine.update === "function") {
			engine.update(snapshot)
			return
		}
		if (typeof engine.updateTelemetry === "function") {
			engine.updateTelemetry(snapshot)
		}
	}

	async function requestRawTelemetry() {
		const endpoint = getAjaxUrl()
		const nonce = getNonce()

		if (window.fetch) {
			const body = new URLSearchParams()
			body.set("action", "sd_get_telemetry")
			body.set("mode", "runtime")
			body.set("nonce", nonce)

			const response = await window.fetch(endpoint, {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"Content-Type":
						"application/x-www-form-urlencoded; charset=UTF-8",
				},
				body,
			})

			return response.json()
		}

		return $.post(endpoint, {
			action: "sd_get_telemetry",
			mode: "runtime",
			nonce,
		})
	}

	async function pingLatency() {
		const start = performance.now()
		const endpoint = getAjaxUrl()
		const nonce = getNonce()

		if (window.fetch) {
			const body = new URLSearchParams()
			body.set("action", "sd_ping_latency")
			body.set("nonce", nonce)

			await window.fetch(endpoint, {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"Content-Type":
						"application/x-www-form-urlencoded; charset=UTF-8",
				},
				body,
			})
			return Math.round(performance.now() - start)
		}

		await $.post(endpoint, {
			action: "sd_ping_latency",
			nonce,
		})

		return Math.round(performance.now() - start)
	}

	async function refreshTelemetry(instance) {
		if (!instance || instance.destroyed || instance.inFlight) return null

		instance.inFlight = requestRawTelemetry()
			.then((response) => {
				const raw =
					response?.success &&
					response.data &&
					typeof response.data === "object"
						? response.data.raw ||
						  response.data.data?.raw ||
						  response.data
						: response?.raw || response

				if (!raw || typeof raw !== "object") return null

				instance.normalized = normalizeTelemetry(raw, instance.root)
				const snapshot = buildSnapshot(instance)
				instance.lastSnapshot = snapshot

				updateScreenReaderSummary(instance, snapshot)
				safeRendererUpdate(instance.engine, snapshot)
				setDomStatus(instance, "", "ready")

				return snapshot
			})
			.catch((error) => {
				console.warn("Time Monitor telemetry refresh failed", error)
				setDomStatus(instance, "Telemetry unavailable.", "error")
				return null
			})
			.finally(() => {
				instance.inFlight = null
			})

		return instance.inFlight
	}

	function handleStreamPayload(payload) {
		INSTANCES_BY_KEY.forEach((entry) => {
			const instance = entry?.instance || null
			if (!instance || instance.destroyed || !isInstanceVisible(instance))
				return

			instance.normalized = normalizeTelemetry(payload, instance.root)
			const snapshot = buildSnapshot(instance)
			instance.lastSnapshot = snapshot

			updateScreenReaderSummary(instance, snapshot)
			safeRendererUpdate(instance.engine, snapshot)
			setDomStatus(instance, "", "ready")
		})
	}

	function ensureGlobalTicker() {
		if (globalTickHandle) return

		let lastTickAt = 0

		const frame = () => {
			globalTickHandle = window.requestAnimationFrame(frame)
			const now = Date.now()
			if (now - lastTickAt < 1000) return
			lastTickAt = now

			INSTANCES_BY_KEY.forEach((entry) => {
				const instance = entry?.instance || null
				if (!instance || instance.destroyed || !instance.normalized)
					return
				if (
					!isInstanceVisible(instance) ||
					instance.root.offsetWidth === 0 ||
					instance.root.offsetHeight === 0 ||
					instance.root.closest(".postbox.sd-widget")?.classList.contains("closed")
				)
					return

				const snapshot = buildSnapshot(instance)
				instance.lastSnapshot = snapshot
				updateScreenReaderSummary(instance, snapshot)
				safeRendererUpdate(instance.engine, snapshot)
			})
		}

		globalTickHandle = window.requestAnimationFrame(frame)
	}

	function stopGlobalTickerIfIdle() {
		if (INSTANCES_BY_KEY.size > 0) return
		if (globalTickHandle) {
			window.cancelAnimationFrame(globalTickHandle)
			globalTickHandle = null
		}
	}

	function bindPing(instance) {
		if (!instance.pingButton || instance.boundPing) return

		instance.boundPing = async () => {
			if (instance.pingPending) return

			instance.pingPending = true
			updatePingButtonState(instance, "pending")
			setDomStatus(instance, "Checking time sources…", "pending")

			if (instance.engine?.setStatus) {
				instance.engine.setStatus({
					label: "Checking time sources…",
					status: "pending",
				})
			}

			try {
				const latency = await pingLatency()
				if (instance.destroyed) return

				const base =
					instance.normalized || normalizeTelemetry({}, instance.root)
				instance.normalized = {
					...base,
					ping: {
						valueMs: latency,
						status: "success",
					},
				}

				const snapshot = buildSnapshot(instance)
				instance.lastSnapshot = snapshot
				updateScreenReaderSummary(instance, snapshot)
				safeRendererUpdate(instance.engine, snapshot)
				setDomStatus(instance, "", "ready")
			} catch (error) {
				console.warn("Time Monitor ping failed", error)

				if (!instance.destroyed) {
					const base =
						instance.normalized ||
						normalizeTelemetry({}, instance.root)
					instance.normalized = {
						...base,
						ping: {
							valueMs: base.ping?.valueMs ?? null,
							status: "error",
						},
					}
					setDomStatus(instance, "Ping failed.", "error")
				}
			} finally {
				instance.pingPending = false
				updatePingButtonState(instance, "idle")
			}
		}

		instance.pingButton.addEventListener("click", instance.boundPing)
	}

	async function mountInstance(root, sceneFactory) {
		if (!root || INSTANCES.has(root)) return INSTANCES.get(root)
		if (!sceneFactory) return null
		const rootKey = ensureRootKey(root)
		const existingEntry = INSTANCES_BY_KEY.get(rootKey)
		if (existingEntry?.instance && !existingEntry.instance.destroyed) {
			return existingEntry.instance
		}

		const stageRoot = root.querySelector('[data-role="pixi-stage"]')
		if (!stageRoot) return null

		const instance = {
			key: rootKey,
			root,
			stageRoot,
			statusNode: root.querySelector('[data-role="status"]'),
			screenReader: root.querySelector(
				'.screen-reader-text[data-role="status"]',
			),
			pingButton: root.querySelector('[data-role="ping-button"]'),
			engine: null,
			normalized: null,
			lastSnapshot: null,
			inFlight: null,
			pingPending: false,
			destroyed: false,
			boundPing: null,
		}

		try {
			instance.engine = sceneFactory(stageRoot, {
				mode: "time-monitor",
				logicalWidth: 960,
				logicalHeight: 960,
				viewportPolicy: "contain",
				isWidget: true,
				onPing: () => {
					instance.pingButton?.click()
				},
			})

			if (instance.engine?.mount) {
				await instance.engine.mount()
			}
			if (!instance.engine) {
				throw new Error("Time Monitor scene instance missing.")
			}

			INSTANCES.set(root, instance)
			INSTANCES_BY_KEY.set(rootKey, {
				key: rootKey,
				root,
				instance,
				mountedAt: Date.now(),
				lastSeenAt: Date.now(),
				destroying: false,
				detachedSince: 0,
			})
			root.classList.add("is-pixi-active")
			root.dataset.pixiBooted = "1"
			delete root.dataset.pixiBooting
			stageRoot.removeAttribute("aria-hidden")
			stageRoot.style.display = ""
			const fallback = root.querySelector('[data-role="fallback"]')
			if (fallback) {
				fallback.classList.add("sd-hidden")
				fallback.style.display = "none"
				fallback.setAttribute("aria-hidden", "true")
			}
			bindPing(instance)
			updatePingButtonState(instance, "idle")
			setDomStatus(instance, "Loading telemetry…", "loading")

			if (STREAM?.lastPayload) {
				handleStreamPayload(STREAM.lastPayload)
			} else {
				await refreshTelemetry(instance)
			}
		} catch (error) {
			console.warn("Time Monitor mount failed", error)
			root.classList.remove("is-pixi-active")
			delete root.dataset.pixiBooted
			delete root.dataset.pixiBooting
			INSTANCES.delete(root)
			INSTANCES_BY_KEY.delete(rootKey)
			const fallback = root.querySelector('[data-role="fallback"]')
			if (fallback) {
				fallback.classList.remove("sd-hidden")
				fallback.style.display = ""
				fallback.removeAttribute("aria-hidden")
			}
			setDomStatus(instance, "Renderer failed to start.", "error")
		}

		ensureGlobalTicker()
		return instance
	}

	function destroyEntry(entry) {
		if (!entry) return
		if (entry.destroying) return
		entry.destroying = true
		const root = entry.root
		const instance = entry.instance
		const key = entry.key || ensureRootKey(root)
		logDestroy("destroying instance", key)
		if (!instance) {
			INSTANCES_BY_KEY.delete(key)
			return
		}

		root.classList.remove("is-pixi-active")
		instance.destroyed = true

		if (instance.boundPing && instance.pingButton) {
			instance.pingButton.removeEventListener("click", instance.boundPing)
		}

		try {
			if (typeof instance.engine?.pause === "function") {
				instance.engine.pause()
			}
			if (typeof instance.engine?.stop === "function") {
				instance.engine.stop()
			}
			if (instance.engine?.destroy) {
				if (typeof instance.engine.app?.ticker?.stop === "function") {
					instance.engine.app.ticker.stop()
				}
				instance.engine.destroy()
			}
		} catch (error) {
			console.warn("Time Monitor destroy error", error)
		}

		INSTANCES.delete(root)
		INSTANCES_BY_KEY.delete(key)
		ROOT_ATTEMPTS.delete(root)
		delete root.dataset.pixiBooted
		delete root.dataset.pixiBooting
		logDestroy("destroyed instance", key)

		stopGlobalTickerIfIdle()
	}

	function pruneOrphans(discoveredKeys = new Set()) {
		const now = Date.now()
		INSTANCES_BY_KEY.forEach((entry, key) => {
			const root = entry.root
			const instance = entry.instance
			const seenNow = discoveredKeys.has(key)
			if (seenNow) {
				entry.lastSeenAt = now
				entry.detachedSince = 0
			}
			if (!seenNow || !document.documentElement.contains(root)) {
				if (!entry.detachedSince) {
					entry.detachedSince = now
				}
				const age = now - Number(entry.mountedAt || now)
				const detachedAge = now - Number(entry.detachedSince || now)
				if (age < ORPHAN_GRACE_MS || detachedAge < ORPHAN_GRACE_MS) {
					logPrune("skipping young instance", key)
					return
				}
				logPrune("confirmed orphan", key)
				destroyEntry(entry)
				return
			}
			if (!isRootVisible(root)) return
			if (
				instance &&
				instance.engine &&
				typeof instance.engine.resize === "function"
			) {
				instance.engine.resize()
			}
		})
	}

	async function ensureRootBooted(root) {
		if (!root) {
			return true
		}
		const rootKey = ensureRootKey(root)
		const existingEntry = INSTANCES_BY_KEY.get(rootKey)
		if (existingEntry?.instance && !existingEntry.instance.destroyed) {
			existingEntry.root = root
			existingEntry.lastSeenAt = Date.now()
			if (existingEntry.instance.root !== root) {
				existingEntry.instance.root = root
			}
			if (existingEntry.instance.stageRoot && !root.contains(existingEntry.instance.stageRoot)) {
				existingEntry.instance.stageRoot = root.querySelector('[data-role="pixi-stage"]')
			}
			INSTANCES.set(root, existingEntry.instance)
			return true
		}
		const existing = INSTANCES.get(root)
		if (existing && !existing.destroyed && existing.engine) {
			return true
		}
		if (!existing && root.dataset.pixiBooted === "1") {
			return true
		}

		logBoot("discovered root", root)

		if (!isRootVisible(root)) {
			logBoot("waiting for visibility", root)
			return false
		}

		const stageRoot = root.querySelector('[data-role="pixi-stage"]')
		if (!stageRoot) {
			logBoot("mount failed, retrying", root)
			return false
		}

		const sceneFactory = getSceneFactory()
		if (!window.PIXI?.Application || !sceneFactory) {
			logBoot("waiting for dependencies", root)
			return false
		}

		if (root.dataset.pixiBooting === "1") {
			return false
		}

		const attempts = (ROOT_ATTEMPTS.get(root) || 0) + 1
		ROOT_ATTEMPTS.set(root, attempts)
		if (attempts > ROOT_BOOT_RETRY_LIMIT) {
			logBoot("mount failed, retrying", root)
			return false
		}

		root.dataset.pixiBooting = "1"

		try {
			const instance = await mountInstance(root, sceneFactory)
			if (instance && !instance.destroyed) {
				logBoot("mount success", root)
				return true
			}
		} catch (_error) {}

		delete root.dataset.pixiBooting
		logBoot("mount failed, retrying", root)
		return false
	}

	function stopDiscoveryLoop() {
		if (discoveryTimer) {
			window.clearTimeout(discoveryTimer)
			discoveryTimer = null
		}
		if (discoveryInterval) {
			window.clearInterval(discoveryInterval)
			discoveryInterval = null
		}
	}

	function runDiscoveryPass() {
		const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR))
		let pending = false
		const discoveredKeys = new Set()

		roots.forEach((root) => {
			const key = ensureRootKey(root)
			discoveredKeys.add(key)
			const existing = INSTANCES.get(root)
			if ((root.dataset.pixiBooted === "1" && existing) || (existing && !existing.destroyed && existing.engine)) {
				return
			}
			pending = true
			ensureRootBooted(root)
		})

		pruneOrphans(discoveredKeys)

		if (STREAM && !streamUnsubscribe) {
			streamUnsubscribe = STREAM.subscribe(handleStreamPayload)
		}

		if (pending && Date.now() > discoveryUntil) {
			discoveryUntil = Date.now() + DISCOVERY_WINDOW_MS
		}
		if (!pending) {
			stopDiscoveryLoop()
		}
	}

	function scheduleBoot() {
		if (discoveryTimer) {
			window.clearTimeout(discoveryTimer)
		}
		discoveryTimer = window.setTimeout(() => {
			discoveryTimer = null
			discoveryUntil = Date.now() + DISCOVERY_WINDOW_MS
			runDiscoveryPass()
			if (!discoveryInterval) {
				discoveryInterval = window.setInterval(
					runDiscoveryPass,
					DISCOVERY_INTERVAL_MS,
				)
			}
		}, 32)
	}

	function installObserver() {
		if (observer || typeof MutationObserver !== "function") return

		observer = new MutationObserver(() => {
			scheduleBoot()
		})

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		})
	}

	$(document).ready(function () {
		scheduleBoot()
		installObserver()
	})

	document.addEventListener("sd_workspace_rendered", scheduleBoot)
	document.addEventListener("sd_shell_loaded", scheduleBoot)
	document.addEventListener("systemdeck:widget:mount", function (event) {
		const detail = event?.detail || {}
		const widgetId = String(detail.widgetId || "")
		if (widgetId !== "core.time-monitor" && widgetId !== "time-monitor") {
			return
		}
		scheduleBoot()
	})
	window.addEventListener("resize", function () {
		INSTANCES_BY_KEY.forEach((entry) => {
			const instance = entry?.instance || null
			if (!instance || !instance.engine) return
			if (typeof instance.engine.resize === "function") {
				instance.engine.resize()
			}
		})
	})
})(jQuery)
