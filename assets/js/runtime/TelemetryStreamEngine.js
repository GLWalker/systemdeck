;(function () {
	"use strict"

	const DEFAULT_INTERVAL = 30000
	const HISTORY_LIMIT = 120
	const DRIFT_SMOOTHING = 0.18

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

	function toFiniteNumber(value) {
		const numeric = Number(value)
		return Number.isFinite(numeric) ? numeric : null
	}

	function toEpochMs(value, fallbackSeconds) {
		const numeric = toFiniteNumber(value)
		if (numeric === null || numeric <= 0) {
			return Number(fallbackSeconds || 0) * 1000
		}

		return numeric > 1e12 ? numeric : numeric * 1000
	}

	function formatTimeLabel(epochMs) {
		const date = new Date(Number(epochMs || 0))
		if (Number.isNaN(date.getTime())) return "--:--:--"

		return date.toLocaleTimeString([], {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
	}

	function resolveTimezoneLabel(raw, fallback) {
		const label = String(raw || "").trim()
		if (label) return label
		return String(fallback || "Browser")
	}

	function classifyDrift(ms) {
		const value = Math.abs(Number(ms || 0))
		if (!Number.isFinite(value)) {
			return { status: "unknown", severity: 0, label: "Unknown" }
		}
		if (value >= 1000) {
			return { status: "critical", severity: 3, label: "Critical drift" }
		}
		if (value >= 250) {
			return { status: "warning", severity: 2, label: "Slight drift" }
		}
		return { status: "normal", severity: 1, label: "Aligned" }
	}

	function resolveUptime(raw) {
		const uptimeSource =
			raw?.uptime && typeof raw.uptime === "object" ? raw.uptime : null

		const seconds = toFiniteNumber(
			uptimeSource?.seconds ??
				raw?.uptimeSeconds ??
				raw?.uptime_seconds ??
				raw?.uptime,
		)

		return {
			seconds: seconds !== null ? Math.max(0, seconds) : 0,
			human: String(
				uptimeSource?.human ?? raw?.uptimeHuman ?? raw?.uptime_human ?? raw?.uptime ?? "N/A",
			),
		}
	}

	function resolvePing(raw, fallbackPing = null) {
		const pingSource = raw?.ping && typeof raw.ping === "object" ? raw.ping : null
		const valueMs = toFiniteNumber(
			pingSource?.valueMs ??
				raw?.pingValueMs ??
				raw?.ping_ms ??
				raw?.pingMs ??
				raw?.ping ??
				fallbackPing,
		)

		return {
			valueMs: valueMs !== null ? valueMs : null,
			status: String(
				pingSource?.status ??
					raw?.pingStatus ??
					raw?.ping_status ??
					(valueMs !== null ? "normal" : "idle"),
			),
		}
	}

	function cloneHistory(history) {
		return {
			serverBrowser: Array.isArray(history?.serverBrowser)
				? history.serverBrowser.slice(-HISTORY_LIMIT)
				: [],
			wpBrowser: Array.isArray(history?.wpBrowser)
				? history.wpBrowser.slice(-HISTORY_LIMIT)
				: [],
			serverWp: Array.isArray(history?.serverWp)
				? history.serverWp.slice(-HISTORY_LIMIT)
				: [],
			ping: Array.isArray(history?.ping)
				? history.ping.slice(-HISTORY_LIMIT)
				: [],
		}
	}

	class TelemetryStreamEngine {
		constructor(options = {}) {
			this.engineName = "SystemDeckTelemetryStream"
			this.engineVariant = "advanced"
			this.schemaVersion = 2
			this.interval = Number(options.interval || DEFAULT_INTERVAL)
			this.endpoint = options.endpoint || getAjaxUrl()
			this.nonce = options.nonce || getNonce()
			this.timer = null
			this.websocket = null
			this.websocketUrl = ""
			this.subscribers = new Set()
			this.lastPayload = null
			this.historyBuffer = {
				serverBrowser: [],
				wpBrowser: [],
				serverWp: [],
				ping: [],
			}
			this.isRunning = false
			this.inFlight = null
			this.prevDrift = {
				serverVsBrowserMs: null,
				wpVsBrowserMs: null,
				serverVsWpMs: null,
			}
			this.historySeeded = false
		}

		setEndpoint(endpoint) {
			if (endpoint) {
				this.endpoint = String(endpoint)
			}
		}

		subscribe(callback) {
			if (typeof callback !== "function") {
				return () => {}
			}

			this.subscribers.add(callback)

			if (this.lastPayload) {
				try {
					callback(this.lastPayload)
				} catch (error) {
					console.warn("Telemetry subscriber replay error", error)
				}
			}

			this.start()

			return () => this.unsubscribe(callback)
		}

		unsubscribe(callback) {
			this.subscribers.delete(callback)
			if (this.subscribers.size === 0) {
				this.stop()
			}
		}

		start() {
			if (this.isRunning) return
			this.isRunning = true
			this.fetch()
			this.timer = window.setInterval(() => {
				this.fetch()
			}, this.interval)
		}

		stop() {
			if (this.timer !== null) {
				window.clearInterval(this.timer)
				this.timer = null
			}

			if (this.websocket) {
				try {
					this.websocket.close()
				} catch (error) {
					console.warn("Telemetry websocket close failed", error)
				}
			}

			this.websocket = null
			this.websocketUrl = ""
			this.isRunning = false
			this.inFlight = null
		}

		async fetch() {
			if (!this.endpoint) {
				return null
			}

			if (this.inFlight) {
				return this.inFlight
			}

			this.inFlight = this.requestTelemetry()
				.then((response) => {
					if (!response) return null

					const raw =
						response?.success && response.data && typeof response.data === "object"
							? response.data.raw || response.data.data?.raw || response.data
							: response?.raw || response

					if (!raw || typeof raw !== "object") return null

					const normalized = this.normalize(raw)
					this.pushHistory(normalized)
					const payload = {
						...normalized,
						history: this.extractHistory(),
					}
					this.lastPayload = payload
					this.emit(payload)
					return payload
				})
				.catch((error) => {
					console.warn("Telemetry stream fetch failed", error)
					return null
				})
				.finally(() => {
					this.inFlight = null
				})

			return this.inFlight
		}

		requestTelemetry() {
			if (window.fetch) {
				const body = new URLSearchParams()
				body.set("action", "sd_get_telemetry")
				body.set("mode", "runtime")
				body.set("nonce", this.nonce)

				return window
					.fetch(this.endpoint, {
						method: "POST",
						credentials: "same-origin",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
						},
						body,
					})
					.then((res) => res.json())
			}

			if (window.jQuery?.post) {
				return new Promise((resolve, reject) => {
					window.jQuery
						.post(this.endpoint, {
							action: "sd_get_telemetry",
							mode: "runtime",
							nonce: this.nonce,
						})
						.done(resolve)
						.fail(reject)
				})
			}

			return Promise.reject(new Error("No telemetry transport available."))
		}

		normalize(raw = {}) {
			const now = Date.now()
			const fallbackSeconds = Math.floor(now / 1000)
			const browserTimezoneLabel = resolveTimezoneLabel(
				raw?.browserTimezoneLabel ?? raw?.browser_timezone_label,
				Intl.DateTimeFormat().resolvedOptions().timeZone || "Browser",
			)

			const serverEpochMs = toEpochMs(
				raw?.serverEpochMs ??
					raw?.server_epoch_ms ??
					raw?.server_time ??
					raw?.timestamp,
				fallbackSeconds,
			)
			const wpEpochMs = toEpochMs(
				raw?.wpEpochMs ?? raw?.wp_epoch_ms ?? raw?.wp_time ?? raw?.timestamp,
				fallbackSeconds,
			)
			const browserEpochMs = now

			const sourceDrift =
				raw?.drift && typeof raw.drift === "object"
					? raw.drift
					: {
							serverVsBrowserMs: serverEpochMs - browserEpochMs,
							wpVsBrowserMs: wpEpochMs - browserEpochMs,
							serverVsWpMs: serverEpochMs - wpEpochMs,
						}

			const serverVsBrowserMs = this.smoothDrift(
				"serverVsBrowserMs",
				sourceDrift.serverVsBrowserMs,
			)
			const wpVsBrowserMs = this.smoothDrift(
				"wpVsBrowserMs",
				sourceDrift.wpVsBrowserMs,
			)
			const serverVsWpMs = this.smoothDrift("serverVsWpMs", sourceDrift.serverVsWpMs)

			const serverState = classifyDrift(serverVsBrowserMs)
			const wpState = classifyDrift(wpVsBrowserMs)
			const serverWpState = classifyDrift(serverVsWpMs)
			const maxSeverity = Math.max(
				serverState.severity,
				wpState.severity,
				serverWpState.severity,
			)

			const sync =
				maxSeverity >= 3
					? { label: "Critical drift", severity: 3, status: "critical" }
					: maxSeverity >= 2
						? { label: "Slight drift", severity: 2, status: "warning" }
						: { label: "Aligned", severity: 1, status: "normal" }

			const uptime = resolveUptime(raw)
			const ping = resolvePing(raw, this.lastPayload?.ping?.valueMs ?? null)

			const normalized = {
				sampleTimestampMs: now,
				sources: {
					server: {
						epochMs: serverEpochMs,
						timezoneLabel: String(raw?.serverTimezoneLabel ?? raw?.server_timezone_label ?? "UTC"),
						displayLabel: formatTimeLabel(serverEpochMs),
						status: serverState.status,
					},
					wp: {
						epochMs: wpEpochMs,
						timezoneLabel: String(raw?.wpTimezoneLabel ?? raw?.wp_timezone_label ?? "WP Local"),
						displayLabel: formatTimeLabel(wpEpochMs),
						status: wpState.status,
					},
					browser: {
						epochMs: browserEpochMs,
						timezoneLabel: browserTimezoneLabel,
						displayLabel: formatTimeLabel(browserEpochMs),
						status: "normal",
					},
				},
				drift: {
					serverVsWpMs,
					serverVsBrowserMs,
					wpVsBrowserMs,
				},
				uptime,
				ping,
				sync,
			}

			normalized.serverEpochMs = serverEpochMs
			normalized.wpEpochMs = wpEpochMs
			normalized.browserEpochMs = browserEpochMs
			normalized.serverTimezoneLabel = normalized.sources.server.timezoneLabel
			normalized.wpTimezoneLabel = normalized.sources.wp.timezoneLabel
			normalized.browserTimezoneLabel = browserTimezoneLabel
			normalized.serverVsWpMs = serverVsWpMs
			normalized.serverVsBrowserMs = serverVsBrowserMs
			normalized.wpVsBrowserMs = wpVsBrowserMs
			normalized.uptimeSeconds = uptime.seconds
			normalized.uptimeHuman = uptime.human
			normalized.pingValueMs = ping.valueMs
			normalized.pingStatus = ping.status
			normalized.syncLabel = sync.label
			normalized.syncSeverity = sync.severity
			normalized.syncStatus = sync.status

			return normalized
		}

		smoothDrift(key, value) {
			const numeric = toFiniteNumber(value)
			if (numeric === null) {
				return this.prevDrift[key] ?? 0
			}

			const previous = toFiniteNumber(this.prevDrift[key])
			const smoothed =
				previous === null ? numeric : previous + (numeric - previous) * DRIFT_SMOOTHING

			this.prevDrift[key] = smoothed
			return smoothed
		}

		seedHistoryFromNormalized(payload) {
			if (this.historySeeded || !payload) {
				return false
			}

			// Seed first-load history from the first real sample so charts render immediately.
			const seedCount = 24
			const seedProfile = [
				-0.32, -0.24, -0.15, -0.06, 0.04, 0.16, 0.28, 0.42,
				0.34, 0.18, 0.06, -0.08, -0.2, -0.28, -0.18, -0.04,
				0.1, 0.22, 0.36, 0.44, 0.32, 0.16, 0.04, -0.08,
			]
			const drift = payload?.drift || {}
			const pingValue = toFiniteNumber(payload?.ping?.valueMs)

			let seeded = false
			const seedSeries = (key, value) => {
				const numeric = toFiniteNumber(value)
				if (numeric === null || this.historyBuffer[key].length > 0) {
					return
				}

				const amplitude = Math.max(14, Math.abs(numeric) * 0.2)
				const seededSeries = Array.from({ length: seedCount }, (_, index) => {
					return numeric + amplitude * seedProfile[index % seedProfile.length]
				})

				this.historyBuffer[key].push(...seededSeries)
				seeded = true
			}

			seedSeries("serverBrowser", drift.serverVsBrowserMs)
			seedSeries("wpBrowser", drift.wpVsBrowserMs)
			seedSeries("serverWp", drift.serverVsWpMs)
			seedSeries("ping", pingValue)

			if (seeded) {
				this.historySeeded = true
			}

			return seeded
		}

		pushHistory(payload) {
			if (this.seedHistoryFromNormalized(payload)) {
				return this.extractHistory()
			}

			const drift = payload?.drift || {}
			const pingValue = toFiniteNumber(payload?.ping?.valueMs)

			if (Number.isFinite(Number(drift.serverVsBrowserMs))) {
				this.historyBuffer.serverBrowser.push(Number(drift.serverVsBrowserMs))
			}
			if (Number.isFinite(Number(drift.wpVsBrowserMs))) {
				this.historyBuffer.wpBrowser.push(Number(drift.wpVsBrowserMs))
			}
			if (Number.isFinite(Number(drift.serverVsWpMs))) {
				this.historyBuffer.serverWp.push(Number(drift.serverVsWpMs))
			}
			if (pingValue !== null) {
				this.historyBuffer.ping.push(pingValue)
			}

			for (const key of Object.keys(this.historyBuffer)) {
				const list = this.historyBuffer[key]
				if (list.length > HISTORY_LIMIT) {
					list.splice(0, list.length - HISTORY_LIMIT)
				}
			}

			return this.extractHistory()
		}

		extractHistory() {
			return cloneHistory(this.historyBuffer)
		}

		connectWebSocket(url) {
			if (!url || typeof window.WebSocket !== "function") {
				return null
			}

			this.websocketUrl = String(url)

			try {
				if (this.websocket) {
					this.websocket.close()
				}
			} catch (error) {
				console.warn("Telemetry websocket reset failed", error)
			}

			try {
				const socket = new window.WebSocket(this.websocketUrl)
				socket.onmessage = (event) => {
					let parsed = null
					try {
						parsed = JSON.parse(event.data)
					} catch (error) {
						return
					}

					const normalized = this.normalize(parsed)
					this.pushHistory(normalized)
					const payload = {
						...normalized,
						history: this.extractHistory(),
					}
					this.lastPayload = payload
					this.emit(payload)
				}
				socket.onclose = () => {
					if (this.websocket === socket) {
						this.websocket = null
					}
				}
				socket.onerror = () => {
					try {
						socket.close()
					} catch (error) {
						console.warn("Telemetry websocket error close failed", error)
					}
				}

				this.websocket = socket
				return socket
			} catch (error) {
				console.warn("Telemetry websocket connect failed", error)
				this.websocket = null
				return null
			}
		}

		emit(payload) {
			for (const subscriber of this.subscribers) {
				try {
					subscriber(payload)
				} catch (error) {
					console.warn("Telemetry subscriber error", error)
				}
			}
		}
	}

	window.SystemDeckTelemetryStream =
		window.SystemDeckTelemetryStream || new TelemetryStreamEngine()
})()
