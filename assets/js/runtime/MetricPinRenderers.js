;(function () {
	"use strict"

	function pad(value) {
		return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, "0")
	}

	function formatTime(date) {
		return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	}

	function resolveMetricEpochMs(metric) {
		const value = Number(metric?.value || 0)
		if (!Number.isFinite(value) || value <= 0) {
			return 0
		}
		return value * 1000
	}

	class MetricClockAnalogRenderer {
		constructor(rootEl, options = {}) {
			this.rootEl = rootEl
			this.options = options
			this.app = null
			this.resizeObserver = null
			this._cancelResize = function () {}
			this.resizeFrame = 0
			this.isReady = false
			this.isDestroyed = false
			this.visualLayer = null
			this.clockFace = null
			this.digitalReadout = null
			this.surface = {
				width: 1,
				height: 1,
			}
			this.metricEpochMs = 0
			this.anchorPerfMs = performance.now()
			this.lastMetricValue = null
			this.tick = this.tick.bind(this)
			this.onResize = this.onResize.bind(this)
			this.handleResize = this.handleResize.bind(this)
		}

		async mount() {
			if (!this.rootEl || !window.PIXI || !window.SystemDeckPixiHUD || this.isDestroyed) {
				return
			}

			try {
				this.app = new PIXI.Application()
				await this.app.init({
					width: 1,
					height: 1,
					backgroundAlpha: 0,
					antialias: true,
					autoDensity: true,
					resolution: window.devicePixelRatio || 1,
				})
			} catch (error) {
				this.app = null
				return
			}

			if (this.isDestroyed || !this.app) {
				if (this.app) {
					try {
						this.app.destroy(false, { children: true })
					} catch (e) {}
					this.app = null
				}
				return
			}

			this.rootEl.innerHTML = ""
			this.rootEl.appendChild(this.app.canvas)
			this.app.canvas.style.display = "block"
			this.app.canvas.style.width = "100%"
			this.app.canvas.style.height = "100%"

			this.visualLayer = new PIXI.Container()
			this.app.stage.addChild(this.visualLayer)

			const HUD = window.SystemDeckPixiHUD
			this.clockFace = HUD.Components.ClockFace()
			this.digitalReadout = HUD.Components.DigitalReadout()

			this.visualLayer.addChild(this.clockFace)
			this.visualLayer.addChild(this.digitalReadout)

			this.syncMetric(this.options.metric)

			if (typeof ResizeObserver === "function") {
				this.resizeObserver = new ResizeObserver(this.handleResize)
				this.resizeObserver.observe(this.rootEl)
				this._cancelResize = () => {
					if (this.resizeObserver) {
						this.resizeObserver.disconnect()
						this.resizeObserver = null
					}
				}
			} else if (typeof window !== "undefined") {
				window.addEventListener("resize", this.handleResize)
				this._cancelResize = () => {
					window.removeEventListener("resize", this.handleResize)
				}
			}

			this.isReady = true
			this.app.ticker.add(this.tick)
			this.handleResize(true)
		}

		update(nextOptions = {}) {
			if (this.isDestroyed) {
				return
			}

			this.options = {
				...this.options,
				...nextOptions,
			}

			if (!this.isReady) {
				return
			}
			this.syncMetric(this.options.metric)
			this.handleResize(true)
		}

		syncMetric(metric) {
			const epochMs = resolveMetricEpochMs(metric)
			if (!epochMs) {
				return
			}

			if (this.lastMetricValue === epochMs) {
				return
			}

			this.metricEpochMs = epochMs
			this.anchorPerfMs = performance.now()
			this.lastMetricValue = epochMs
		}

		measureSurface() {
			const rect = this.rootEl?.getBoundingClientRect?.() || null
			const width = Math.max(
				1,
				Math.round(rect?.width || this.rootEl?.clientWidth || 0),
			)
			const height = Math.max(
				1,
				Math.round(rect?.height || this.rootEl?.clientHeight || 0),
			)
			return { width, height }
		}

		getDisplayDate() {
			if (!this.metricEpochMs) {
				return new Date()
			}
			const driftMs = performance.now() - this.anchorPerfMs
			return new Date(this.metricEpochMs + driftMs)
		}

		getPalette() {
			const HUD = window.SystemDeckPixiHUD
			HUD.Theme.refreshColors()
			const colors = HUD.Theme.getColors()
			return {
				ring: colors.primary,
				ringSoft: colors.primarySoft,
				tick: colors.primaryStrong || colors.primary,
				hour: colors.primaryStrong,
				minute: colors.primarySoft || colors.primary,
				second: colors.alertCaution || colors.warning || colors.accent,
				cap: colors.panel,
				panel: colors.panel,
				panelSoft: colors.panelSoft,
				panelBorder: colors.borderSubtle,
				textStrong: colors.text,
				digitalText: colors.primarySoft || colors.primary,
				textDim: colors.textDim,
				logo: colors.borderSubtle || colors.wp || colors.primarySoft,
				glow: colors.alertCaution || colors.warning || colors.accent,
			}
		}

		getBounds() {
			const width = Math.max(1, Math.round(this.surface?.width || 1))
			const height = Math.max(1, Math.round(this.surface?.height || 1))
			const cx = width / 2
			const edgeInset = 3
			const panelHeight = Math.max(32, Math.min(46, height * 0.17))
			const radius = Math.max(
				38,
				Math.min(width / 2 - edgeInset, height / 2 - edgeInset),
			)
			const cy = height / 2
			const panelY = height - panelHeight
			return {
				width,
				height,
				cx,
				cy,
				radius,
				panelHeight,
				panelY,
			}
		}

		drawFrame(bounds, palette, displayValue) {
			if (!this.clockFace || !this.digitalReadout) {
				return
			}

			const { cx, cy, radius, panelHeight, panelY } = bounds
			const panelMetrics = this.layoutDigitalPanel(bounds, displayValue)
			this.clockFace.render({
				cx,
				cy,
				radius,
				date: this.getDisplayDate(),
				palette,
			})
			this.digitalReadout.render({
				x: panelMetrics.panelX,
				y: panelY,
				width: panelMetrics.panelWidth,
				height: panelHeight,
				value: displayValue,
				fontScale: 0.33,
				palette,
			})
		}

		layoutDigitalPanel(bounds, displayValue) {
			const { width, cx, radius } = bounds
			const charCount = String(displayValue || "00:00:00").length
			const digitWidth = Math.max(9, radius * 0.165)
			const textWidth = charCount * digitWidth
			const horizontalPadding = Math.max(5, radius * 0.058)
			const minWidth = Math.max(90, textWidth + horizontalPadding * 2)
			const maxWidth = Math.min(width - 144, radius * 1.14)
			const panelWidth = Math.max(
				minWidth,
				Math.min(maxWidth, textWidth + horizontalPadding * 2),
			)
			const panelX = Math.round(cx - panelWidth / 2)
			return {
				panelX,
				panelWidth,
			}
		}

		tick() {
			if (!this.app || !this.isReady || this.isDestroyed) {
				return
			}

			const palette = this.getPalette()
			const bounds = this.getBounds()
			const now = this.getDisplayDate()
			const displayValue = formatTime(now)
			this.drawFrame(bounds, palette, displayValue)
		}

		handleResize(force = false) {
			if (!this.isReady || this.isDestroyed) {
				return
			}
			if (this.resizeFrame) {
				cancelAnimationFrame(this.resizeFrame)
			}
			this.resizeFrame = requestAnimationFrame(() => {
				this.resizeFrame = 0
				if (!this.app || this.isDestroyed) {
					return
				}
				const nextSurface = this.measureSurface()
				if (
					!force &&
					nextSurface.width === this.surface.width &&
					nextSurface.height === this.surface.height
				) {
					this.tick()
					return
				}
				this.surface = nextSurface
				this.app.renderer.resize(nextSurface.width, nextSurface.height)
				this.tick()
			})
		}

		onResize() {
			this.handleResize()
		}

		resize() {
			this.handleResize(true)
		}

		destroy() {
			if (this.isDestroyed) {
				return
			}
			if (this.resizeFrame) {
				cancelAnimationFrame(this.resizeFrame)
				this.resizeFrame = 0
			}

			this.isDestroyed = true
			this.isReady = false

			if (typeof this._cancelResize === "function") {
				try {
					this._cancelResize()
				} catch (e) {}
			}
			this._cancelResize = function () {}

			if (this.app?.ticker) {
				try {
					this.app.ticker.remove(this.tick)
				} catch (e) {}
			}
			if (this.app) {
				try {
					this.app.destroy(false, { children: true })
				} catch (e) {}
			this.app = null
			}

			this.visualLayer = null
			this.clockFace = null
			this.digitalReadout = null

			if (this.rootEl) {
				this.rootEl.innerHTML = ""
			}
		}
	}

	window.SystemDeckMetricPinRenderers = window.SystemDeckMetricPinRenderers || {}
	window.SystemDeckMetricPinRenderers.metric_clock_analog = function (rootEl, options) {
		const renderer = new MetricClockAnalogRenderer(rootEl, options)
		void renderer.mount()
		return renderer
	}
})()
