;(function () {
	"use strict"

	const STREAM = window.SystemDeckTelemetryStream || null
	const INTELLIGENCE = window.SystemDeckTelemetryIntelligence || null

	if (
		STREAM &&
		(!STREAM.historyBuffer || STREAM.engineVariant !== "advanced")
	) {
		console.warn(
			"Self-healing expects the advanced telemetry stream engine.",
		)
	}

	const DEFAULT_INTERVAL = 30000
	const ADAPTIVE_INTERVAL = 45000
	const CRITICAL_INTERVAL = 60000
	const ACTION_LIMIT = 64

	function cloneState(state) {
		return JSON.parse(JSON.stringify(state))
	}

	class SystemDeckSelfHealingEngine {
		constructor(intelligence) {
			this.intelligence = intelligence || null
			this.stream = STREAM
			this.subscribers = new Set()
			this.unsubscribeIntelligence = null
			this.started = false
			this.latestState = {
				mode: "normal",
				lastAction: null,
				actions: [],
				lastInsight: null,
			}
			this.defaultInterval = Number(this.stream?.interval || DEFAULT_INTERVAL)
			this.modeIntervals = {
				normal: this.defaultInterval,
				adaptive: ADAPTIVE_INTERVAL,
				critical: CRITICAL_INTERVAL,
			}

			this.start()
		}

		subscribe(callback) {
			if (typeof callback !== "function") return () => {}

			this.subscribers.add(callback)

			if (this.latestState) {
				try {
					callback(this.getState())
				} catch (error) {
					console.warn("Self-healing subscriber replay error", error)
				}
			}

			this.start()

			return () => this.unsubscribeCallback(callback)
		}

		unsubscribeCallback(callback) {
			this.subscribers.delete(callback)
		}

		start() {
			if (this.started) return

			const source = this.intelligence || INTELLIGENCE
			if (!source?.subscribe) return

			this.unsubscribeIntelligence = source.subscribe((insight) => {
				this.evaluate(insight)
			})
			source.start?.()
			this.started = true
		}

		stop() {
			if (typeof this.unsubscribeIntelligence === "function") {
				this.unsubscribeIntelligence()
			}
			this.unsubscribeIntelligence = null
			this.started = false
			this.applyMode("normal", "stop")
		}

		getLatest() {
			return this.latestState?.lastAction || null
		}

		getState() {
			return cloneState(this.latestState)
		}

		emit(state) {
			this.latestState = state
			window.SystemDeckSelfHealingState = this.getState()

			for (const subscriber of this.subscribers) {
				try {
					subscriber(this.getState())
				} catch (error) {
					console.warn("Self-healing subscriber error", error)
				}
			}
		}

		logAction(type, reason, mode) {
			const action = {
				type,
				reason,
				mode,
				timestamp: Date.now(),
			}

			const actions = Array.isArray(this.latestState.actions)
				? this.latestState.actions.slice()
				: []
			actions.push(action)
			if (actions.length > ACTION_LIMIT) {
				actions.splice(0, actions.length - ACTION_LIMIT)
			}

			const nextState = {
				mode,
				lastAction: action,
				actions,
				lastInsight: this.latestState.lastInsight || null,
			}
			this.emit(nextState)
			return action
		}

		setStreamInterval(interval, reason) {
			if (!this.stream) return

			const nextInterval = Math.max(5000, Number(interval || this.defaultInterval))
			if (this.stream.interval === nextInterval && this.stream.running) {
				return
			}

			this.stream.interval = nextInterval
			if (this.stream.running) {
				this.stream.stop()
				this.stream.start()
			}

			const action = this.logAction("SET_STREAM_INTERVAL", reason, this.latestState.mode)
			action.interval = nextInterval
		}

		applyMode(mode, reason) {
			const currentMode = this.latestState.mode || "normal"
			if (currentMode === mode) {
				return
			}

			const nextState = {
				mode,
				lastAction: {
					type: "MODE_CHANGE",
					reason,
					mode,
					timestamp: Date.now(),
				},
				actions: Array.isArray(this.latestState.actions)
					? this.latestState.actions.slice()
					: [],
				lastInsight: this.latestState.lastInsight || null,
			}
			nextState.actions.push(nextState.lastAction)
			if (nextState.actions.length > ACTION_LIMIT) {
				nextState.actions.splice(0, nextState.actions.length - ACTION_LIMIT)
			}
			this.emit(nextState)

			const interval =
				this.modeIntervals[mode] || this.modeIntervals.normal || this.defaultInterval
			this.setStreamInterval(interval, reason || "mode-change")
		}

		evaluate(insight) {
			if (!insight) return

			const severity = Number(insight?.severity?.level || 0)
			const reason = String(insight?.summary || "insight")

			const nextState = {
				mode: this.latestState.mode || "normal",
				lastAction: this.latestState.lastAction || null,
				actions: Array.isArray(this.latestState.actions)
					? this.latestState.actions.slice()
					: [],
				lastInsight: insight,
			}

			if (severity >= 3) {
				nextState.mode = "critical"
			} else if (severity >= 2) {
				nextState.mode = "adaptive"
			} else {
				nextState.mode = "normal"
			}

			const modeChanged = nextState.mode !== (this.latestState.mode || "normal")
			nextState.lastAction = {
				type: modeChanged ? "MODE_CHANGE" : "OBSERVE",
				reason,
				mode: nextState.mode,
				timestamp: Date.now(),
			}
			nextState.actions.push(nextState.lastAction)
			if (nextState.actions.length > ACTION_LIMIT) {
				nextState.actions.splice(0, nextState.actions.length - ACTION_LIMIT)
			}
			this.latestState = nextState
			window.SystemDeckSelfHealingInsight = insight
			window.SystemDeckSelfHealingState = this.getState()
			this.emit(this.latestState)

			const interval =
				nextState.mode === "critical"
					? this.modeIntervals.critical
					: nextState.mode === "adaptive"
						? this.modeIntervals.adaptive
						: this.modeIntervals.normal
			this.setStreamInterval(interval, reason)
		}
	}

	window.SystemDeckSelfHealing =
		window.SystemDeckSelfHealing || new SystemDeckSelfHealingEngine(INTELLIGENCE)
})()
