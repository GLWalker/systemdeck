;(function () {
	"use strict"

	const STREAM = window.SystemDeckTelemetryStream || null

	if (
		STREAM &&
		(!STREAM.historyBuffer || STREAM.engineVariant !== "advanced")
	) {
		console.warn(
			"Telemetry intelligence expects the advanced telemetry stream engine.",
		)
	}

	function directionFromDelta(delta, threshold = 1) {
		if (!Number.isFinite(delta) || Math.abs(delta) <= threshold) return "stable"
		return delta > 0 ? "up" : "down"
	}

	function mean(values) {
		const nums = (Array.isArray(values) ? values : [])
			.map((value) => Number(value))
			.filter(Number.isFinite)
		if (!nums.length) return 0
		return nums.reduce((sum, value) => sum + value, 0) / nums.length
	}

	function spread(values) {
		const nums = (Array.isArray(values) ? values : [])
			.map((value) => Number(value))
			.filter(Number.isFinite)
		if (!nums.length) return 0
		let min = nums[0]
		let max = nums[0]
		for (let i = 1; i < nums.length; i += 1) {
			const value = nums[i]
			if (value < min) min = value
			if (value > max) max = value
		}
		return max - min
	}

	function trendForSeries(samples) {
		const values = (Array.isArray(samples) ? samples : [])
			.map((value) => Number(value))
			.filter(Number.isFinite)
		if (values.length < 3) return "stable"

		const half = Math.max(1, Math.floor(values.length / 2))
		const recent = mean(values.slice(-half))
		const earlier = mean(values.slice(0, half))
		return directionFromDelta(recent - earlier, 0.6)
	}

	function classifySeverity(payload, stats) {
		const maxDrift = Math.max(
			Math.abs(Number(payload?.serverVsBrowserMs || 0)),
			Math.abs(Number(payload?.wpVsBrowserMs || 0)),
			Math.abs(Number(payload?.serverVsWpMs || 0)),
		)
		const maxSpread = Math.max(
			stats.serverBrowserSpread,
			stats.wpBrowserSpread,
			stats.serverWpSpread,
		)
		const anomaly = stats.anomaly

		if (anomaly && (maxDrift >= 1000 || maxSpread >= 400)) {
			return { level: 3, label: "critical" }
		}
		if (maxDrift >= 500 || maxSpread >= 150 || anomaly) {
			return { level: 2, label: "warning" }
		}
		if (maxDrift >= 120 || maxSpread >= 30) {
			return { level: 1, label: "normal" }
		}
		return { level: 0, label: "normal" }
	}

	class TelemetryIntelligenceEngine {
		constructor(stream) {
			this.stream = stream || null
			this.historyLimit = 30
			this.subscribers = new Set()
			this.history = {
				serverBrowser: [],
				wpBrowser: [],
				serverWp: [],
			}
			this.latestInsight = null
			this.started = false
			this.unsubscribe = null

			if (this.stream) {
				this.start()
			}
		}

		subscribe(callback) {
			if (typeof callback !== "function") return () => {}
			this.subscribers.add(callback)
			if (this.latestInsight) {
				try {
					callback(this.latestInsight)
				} catch (error) {
					console.warn("Telemetry intelligence replay error", error)
				}
			}
			this.start()
			return () => this.unsubscribeCallback(callback)
		}

		unsubscribeCallback(callback) {
			this.subscribers.delete(callback)
			if (this.subscribers.size === 0) {
				this.stop()
			}
		}

		start() {
			if (this.started || !this.stream?.subscribe) return
			this.started = true
			this.unsubscribe = this.stream.subscribe((payload) => {
				this.process(payload)
			})
			this.stream.start?.()
		}

		stop() {
			if (typeof this.unsubscribe === "function") {
				this.unsubscribe()
			}
			this.unsubscribe = null
			this.started = false
		}

		getLatest() {
			return this.latestInsight
		}

		pushSeries(key, value) {
			const list = this.history[key]
			if (!list) return
			list.push(Number(value || 0))
			if (list.length > this.historyLimit) list.shift()
		}

		process(payload) {
			if (!payload) return

			this.pushSeries("serverBrowser", payload.serverVsBrowserMs)
			this.pushSeries("wpBrowser", payload.wpVsBrowserMs)
			this.pushSeries("serverWp", payload.serverVsWpMs)

			const stats = {
				serverTrend: trendForSeries(this.history.serverBrowser),
				wpTrend: trendForSeries(this.history.wpBrowser),
				serverWpTrend: trendForSeries(this.history.serverWp),
				serverBrowserSpread: spread(this.history.serverBrowser),
				wpBrowserSpread: spread(this.history.wpBrowser),
				serverWpSpread: spread(this.history.serverWp),
				anomaly:
					Math.max(
						spread(this.history.serverBrowser),
						spread(this.history.wpBrowser),
						spread(this.history.serverWp),
					) >= 120,
			}

			const severity = classifySeverity(payload, stats)
			const dominantSource = (() => {
				const entries = [
					["serverVsBrowser", Math.abs(Number(payload?.serverVsBrowserMs || 0))],
					["wpVsBrowser", Math.abs(Number(payload?.wpVsBrowserMs || 0))],
					["serverVsWp", Math.abs(Number(payload?.serverVsWpMs || 0))],
				].sort((a, b) => b[1] - a[1])
				return entries[0]?.[0] || null
			})()

			const anomalyDetected = !!stats.anomaly && severity.level >= 2
			const summary =
				severity.level >= 3
					? "Critical drift spike detected"
					: severity.level >= 2
						? "Drift instability rising"
						: "Stable drift across all sources"

			const insight = {
				sampleTimestampMs: payload.sampleTimestampMs || Date.now(),
				trend: {
					serverVsBrowser: stats.serverTrend,
					wpVsBrowser: stats.wpTrend,
					serverVsWp: stats.serverWpTrend,
				},
				anomaly: {
					detected: anomalyDetected,
					source: anomalyDetected ? dominantSource : null,
					reason: anomalyDetected ? "spread" : null,
				},
				severity,
				summary,
			}

			this.emit(insight)
		}

		emit(insight) {
			this.latestInsight = insight
			window.SystemDeckTelemetryInsightState = {
				lastInsight: insight,
			}

			for (const subscriber of this.subscribers) {
				try {
					subscriber(insight)
				} catch (error) {
					console.warn("Telemetry intelligence subscriber error", error)
				}
			}
		}
	}

	window.SystemDeckTelemetryIntelligence =
		window.SystemDeckTelemetryIntelligence ||
		new TelemetryIntelligenceEngine(STREAM)
})()
