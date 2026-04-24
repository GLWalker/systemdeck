;(function () {
	"use strict"

	const PIXI = window.PIXI
	const HUD = window.SystemDeckPixiHUD

	if (!PIXI || !HUD) return

	const { Application, Container, Graphics } = PIXI
	const Layout = HUD.Layout

	const TAB_ITEMS = [
		{ id: "overview", label: "Overview" },
		{ id: "history", label: "History" },
		{ id: "details", label: "Details" },
	]

	const COPY = Object.freeze({
		driftAlert:
			"Time synchronization issue detected. Check server settings.",
		driftWarning: "Clock drift detected. Check server settings.",
		telemetryUnavailable: "Telemetry unavailable.",
		rendererFailed: "Renderer failed to start.",
		pingFailed: "Ping failed.",
		loading: "Loading telemetry...",
		pending: "Checking time sources...",
	})

	function toNumber(value, fallback = 0) {
		const numeric = Number(value)
		return Number.isFinite(numeric) ? numeric : fallback
	}

	function snap4(value) {
		return Math.max(0, Math.round(toNumber(value, 0) / 4) * 4)
	}

	function rect(x, y, w, h) {
		return Layout.box(snap4(x), snap4(y), snap4(w), snap4(h))
	}

	function buildLayout(surface) {
		const width = snap4(Math.max(240, surface?.width || 0))
		const height = snap4(Math.max(320, surface?.height || 0))
		const compact = width < 400 || height < 360

		const outerInsetX = compact ? 8 : 12
		const outerInsetY = 4
		const subtitleHeight = compact ? 14 : 16
		const regionGap = 8
		const noticeHeight = compact ? 40 : 44
		const tabsHeight = compact ? 32 : 36
		const footerHeight = compact ? 20 : 24
		const rowHeight = compact ? 28 : 36
		const buttonHeight = compact ? 24 : 28
		const contentGap = compact ? 6 : 8
		const historySummaryGap = compact ? 14 : 18
		const plotMinHeight = compact ? 84 : 96
		const sectionLabelHeight = compact ? 18 : 20
		const summaryRowHeight = compact ? 20 : 22

		const surfaceRect = rect(0, 0, width, height)
		const bodyRect = Layout.inset(surfaceRect, {
			t: outerInsetY,
			r: outerInsetX,
			b: outerInsetY,
			l: outerInsetX,
		})

		const subtitleRect = rect(
			bodyRect.x,
			bodyRect.y,
			bodyRect.w,
			subtitleHeight,
		)
		const noticeRect = rect(
			bodyRect.x,
			subtitleRect.y + subtitleRect.h + 2,
			bodyRect.w,
			noticeHeight,
		)
		const tabsRect = rect(
			bodyRect.x,
			noticeRect.y + noticeRect.h + regionGap,
			bodyRect.w,
			tabsHeight,
		)
		const footerRect = rect(
			bodyRect.x,
			bodyRect.y + bodyRect.h - footerHeight,
			bodyRect.w,
			footerHeight,
		)
		const contentRect = rect(
			bodyRect.x,
			tabsRect.y + tabsRect.h + regionGap,
			bodyRect.w,
			Math.max(
				96,
				footerRect.y -
					regionGap -
					(tabsRect.y + tabsRect.h + regionGap),
			),
		)

		const overviewListRect = rect(
			contentRect.x,
			contentRect.y,
			contentRect.w,
			rowHeight * 5,
		)
		const overviewButtonRect = rect(
			contentRect.x + contentRect.w - (compact ? 80 : 88),
			overviewListRect.y + overviewListRect.h + contentGap,
			compact ? 80 : 88,
			buttonHeight,
		)

		const historyPlotLabelRect = rect(
			contentRect.x,
			contentRect.y,
			contentRect.w,
			sectionLabelHeight,
		)
		const historyPlotRect = rect(
			contentRect.x,
			historyPlotLabelRect.y + historyPlotLabelRect.h + 4,
			contentRect.w,
			Math.max(
				plotMinHeight,
				contentRect.h -
					(sectionLabelHeight +
						summaryRowHeight * 3 +
						historySummaryGap +
						contentGap),
			),
		)
		const historySummaryRect = rect(
			contentRect.x,
			historyPlotRect.y + historyPlotRect.h + historySummaryGap,
			contentRect.w,
			summaryRowHeight * 3,
		)

		const detailsCollapseRect = rect(
			contentRect.x,
			contentRect.y,
			contentRect.w,
			contentRect.h,
		)

		return {
			surfaceRect,
			bodyRect,
			subtitleRect,
			noticeRect,
			tabsRect,
			contentRect,
			footerRect,
			rowHeight,
			buttonHeight,
			overview: {
				listRect: overviewListRect,
				buttonRect: overviewButtonRect,
			},
			history: {
				plotLabelRect: historyPlotLabelRect,
				plotRect: historyPlotRect,
				summaryRect: historySummaryRect,
				summaryRowHeight,
			},
			details: {
				collapseRect: detailsCollapseRect,
			},
		}
	}

	function formatTimestamp(epochMs, timezoneLabel) {
		const date = new Date(toNumber(epochMs, 0))
		if (Number.isNaN(date.getTime())) return "--"

		const zone = String(timezoneLabel || "").trim()
		const options = {
			hour12: false,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}

		if (zone && zone.includes("/")) {
			options.timeZone = zone
		}

		try {
			const parts = Object.fromEntries(
				new Intl.DateTimeFormat("en-CA", options)
					.formatToParts(date)
					.map((part) => [part.type, part.value]),
			)
			const stamp =
				`${parts.year}-${parts.month}-${parts.day} ` +
				`${parts.hour}:${parts.minute}:${parts.second}`
			return zone ? `${stamp} ${zone}` : stamp
		} catch (_error) {
			return date.toISOString().slice(0, 19).replace("T", " ")
		}
	}

	function formatUptime(value) {
		if (value && typeof value === "object") {
			const human = String(value.human || "").trim()
			if (human && human !== "N/A") return human
			value = value.seconds
		}

		const total = Math.max(0, Math.floor(toNumber(value, 0)))
		const days = Math.floor(total / 86400)
		const hours = Math.floor((total % 86400) / 3600)
		const minutes = Math.floor((total % 3600) / 60)

		if (days > 0) return `${days}d ${hours}h`
		if (hours > 0) return `${hours}h ${minutes}m`
		return `${minutes}m`
	}

	function formatPing(valueMs) {
		const numeric = Number(valueMs)
		return Number.isFinite(numeric) ? `${Math.round(numeric)} ms` : "--"
	}

	function formatDrift(valueMs) {
		const numeric = Number(valueMs)
		if (!Number.isFinite(numeric)) return "--"
		const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : ""
		const absolute = Math.abs(numeric)
		if (absolute >= 1000) {
			return `${sign}${(absolute / 1000).toFixed(3)}s`
		}
		return `${sign}${absolute.toFixed(1)}ms`
	}

	function cloneSeries(values) {
		return (Array.isArray(values) ? values : [])
			.map((value) => Number(value))
			.filter(Number.isFinite)
			.slice(-60)
	}

	function seriesRange(seriesList) {
		const merged = []
		seriesList.forEach((series) => {
			series.forEach((value) => merged.push(value))
		})

		if (!merged.length) {
			return { min: -100, max: 100 }
		}

		let min = merged[0]
		let max = merged[0]
		for (let index = 1; index < merged.length; index += 1) {
			const value = merged[index]
			if (value < min) min = value
			if (value > max) max = value
		}

		if (min === max) {
			min -= 50
			max += 50
		}

		const pad = Math.max(8, (max - min) * 0.1)
		return { min: min - pad, max: max + pad }
	}

	function seriesToPoints(series, plotRect, range) {
		if (!series.length) return []

		const usableRect = Layout.inset(plotRect, {
			t: 12,
			r: 12,
			b: 20,
			l: 12,
		})
		const span = Math.max(1, range.max - range.min)
		const step = series.length > 1 ? usableRect.w / (series.length - 1) : 0

		return series.map((value, index) => {
			const ratio = (value - range.min) / span
			return {
				x: usableRect.x + step * index,
				y: usableRect.y + usableRect.h - ratio * usableRect.h,
			}
		})
	}

	function renderSeriesLine(points, color, alpha) {
		if (!Array.isArray(points) || points.length < 2) return null

		const line = new Graphics()
		line.setStrokeStyle({
			width: 2,
			color,
			alpha,
			cap: "round",
			join: "round",
		})
		line.moveTo(points[0].x, points[0].y)

		for (let index = 1; index < points.length; index += 1) {
			line.lineTo(points[index].x, points[index].y)
		}

		line.stroke()
		return line
	}

	function safeDestroyDisplayObject(target) {
		if (!target || typeof target.destroy !== "function") return

		try {
			if (target.destroyed) return
		} catch (_error) {
			return
		}

		try {
			target.destroy({ children: true })
		} catch (_error) {
			try {
				target.destroy(true)
			} catch (__error) {}
		}
	}

	function clearContainer(container, options = {}) {
		if (!container || typeof container.removeChildren !== "function")
			return []
		if (options.skipIfDestroyed && container.destroyed) return []

		let removed = []
		try {
			removed = container.removeChildren()
		} catch (_error) {
			return []
		}

		if (options.destroyRemoved) {
			removed.forEach((child) => safeDestroyDisplayObject(child))
		}

		return removed
	}

	function createEmptySnapshot() {
		const now = Date.now()
		return {
			sampleTimestampMs: now,
			sources: {
				server: {
					epochMs: now,
					timezoneLabel: "UTC",
				},
				wp: {
					epochMs: now,
					timezoneLabel: "WP Local",
				},
				browser: {
					epochMs: now,
					timezoneLabel: "Browser",
				},
			},
			drift: {
				serverVsWpMs: 0,
				serverVsBrowserMs: 0,
				wpVsBrowserMs: 0,
			},
			uptime: {
				seconds: 0,
			},
			ping: {
				valueMs: null,
				status: "idle",
			},
			sync: {
				label: "SYNCED",
				status: "normal",
				severity: 1,
			},
			history: {
				serverBrowser: [],
				wpBrowser: [],
				serverWp: [],
				ping: [],
			},
		}
	}

	class TimeMonitorPixiScene {
		constructor(rootEl, options = {}) {
			this.rootEl = rootEl
			this.options = options
			this.palette = HUD.Theme.createPalette("time-monitor")
			this.surface = { width: 0, height: 0 }
			this.layoutMap = buildLayout({ width: 240, height: 320 })
			this.snapshot = createEmptySnapshot()
			this.statusState = { label: "", status: "idle" }
			this.activeTab = "overview"
			this.app = null
			this.root = null
			this.layers = {}
			this.components = {}
			this.resizeObserver = null
			this.destroyed = false
			this._tabsBuilt = false

			this.handleResize = this.handleResize.bind(this)
		}

		static create(rootEl, options = {}) {
			return new TimeMonitorPixiScene(rootEl, options)
		}

		async mount() {
			if (!this.rootEl) {
				throw new Error("Time Monitor Pixi root not provided.")
			}

			const initial = this.measureSurface()
			this.surface = initial

			this.app = new Application()
			await this.app.init({
				width: initial.width,
				height: initial.height,
				backgroundAlpha: 0,
				antialias: true,
				autoDensity: true,
				resolution: Math.max(window.devicePixelRatio || 1, 2),
			})

			this.app.stage.sortableChildren = false
			this.app.canvas.style.width = "100%"
			this.app.canvas.style.height = "100%"
			this.app.canvas.style.pointerEvents = "auto"
			this.rootEl.innerHTML = ""
			this.rootEl.appendChild(this.app.canvas)

			this.buildScene()
			this.installResizeObserver()
			this.layoutMap = buildLayout(initial)
			this.applyLayout()
			this.renderData()
		}

		buildScene() {
			this.root = new Container()
			this.layers.notice = new Container()
			this.layers.subtitle = new Container()
			this.layers.tabs = new Container()
			this.layers.tabButtons = new Container()
			this.layers.content = new Container()
			this.layers.overview = new Container()
			this.layers.history = new Container()
			this.layers.details = new Container()
			this.layers.footer = new Container()
			this.layers.chart = new Container()

			this.root.addChild(
				this.layers.subtitle,
				this.layers.notice,
				this.layers.tabs,
				this.layers.content,
				this.layers.footer,
			)
			this.layers.tabs.addChild(this.layers.tabButtons)
			this.layers.content.addChild(
				this.layers.overview,
				this.layers.history,
				this.layers.details,
			)
			this.layers.history.addChild(this.layers.chart)
			this.app.stage.addChild(this.root)

			this.components.subtitle = HUD.Components.TextTruncate({
				text: "Clock Drift & Sync Health",
				width: 240,
				palette: this.palette,
				fontSize: 12,
				tone: "base",
			})
			this.layers.subtitle.addChild(this.components.subtitle.root)

			this.components.notice = HUD.Components.Alert({
				width: 240,
				height: 44,
				state: "warning",
				text: COPY.driftAlert,
				border: false,
				palette: this.palette,
			})
			this.layers.notice.addChild(this.components.notice.root)

			this.components.overviewRows = HUD.Components.CardListGroup({
				width: 240,
				flush: true,
				rowHeight: 36,
				items: [],
				palette: this.palette,
			})
			this.components.pingButton = HUD.Components.Button({
				label: "PING",
				width: 88,
				height: 28,
				variant: "outline",
				tone: "primary",
				palette: this.palette,
				onClick: () => {
					if (typeof this.options.onPing === "function") {
						this.options.onPing()
					}
				},
			})
			this.layers.overview.addChild(
				this.components.overviewRows.root,
				this.components.pingButton.root,
			)

			this.components.historyPlotLabel = HUD.Components.SectionHeader({
				text: "Telemetry Timeline",
				width: 240,
				showDivider: false,
				palette: this.palette,
			})
			this.components.historySummaryRows = HUD.Components.CardListGroup({
				width: 240,
				flush: true,
				rowHeight: 28,
				items: [],
				palette: this.palette,
			})
			this.layers.history.addChild(
				this.components.historyPlotLabel.root,
				this.components.historySummaryRows.root,
			)

			this.components.detailsRows = HUD.Components.CardListGroup({
				width: 240,
				flush: true,
				rowHeight: 36,
				items: [],
				palette: this.palette,
			})
			this.layers.details.addChild(this.components.detailsRows.root)

			this.components.footer = HUD.Components.FooterBar({
				width: 240,
				summary: "",
				status: "",
				palette: this.palette,
			})
			this.layers.footer.addChild(this.components.footer.root)

			this.applyTabVisibility()
		}

		measureSurface() {
			const bounds = this.rootEl.getBoundingClientRect()
			return {
				width: snap4(Math.max(240, Math.round(bounds.width || 0))),
				height: snap4(Math.max(320, Math.round(bounds.height || 0))),
			}
		}

		installResizeObserver() {
			if (typeof ResizeObserver !== "function") {
				window.addEventListener("resize", this.handleResize)
				return
			}

			this.resizeObserver = new ResizeObserver(() => {
				this.handleResize()
			})
			this.resizeObserver.observe(this.rootEl)
		}

		isSceneReady() {
			return !!(
				this.app &&
				this.root &&
				this.layers?.subtitle &&
				this.layers?.notice &&
				this.layers?.tabs &&
				this.layers?.content &&
				this.layers?.footer &&
				this.components?.subtitle &&
				this.components?.notice &&
				this.components?.overviewRows &&
				this.components?.pingButton &&
				this.components?.historyPlotLabel &&
				this.components?.historySummaryRows &&
				this.components?.detailsRows &&
				this.components?.footer
			)
		}

		handleResize() {
			if (!this.app || this.destroyed || !this.isSceneReady()) return

			const nextSurface = this.measureSurface()
			if (
				nextSurface.width === this.surface.width &&
				nextSurface.height === this.surface.height
			) {
				return
			}

			this.surface = nextSurface
			this.layoutMap = buildLayout(nextSurface)
			this.app.renderer.resize(nextSurface.width, nextSurface.height)
			this.applyLayout()
			this.renderData()
		}

		applyLayout() {
			if (!this.app || this.destroyed || !this.isSceneReady()) return
			const layout = this.layoutMap

			this.layers.subtitle.position.set(
				layout.subtitleRect.x,
				layout.subtitleRect.y,
			)
			this.components.subtitle.resize(layout.subtitleRect.w)

			this.layers.notice.position.set(
				layout.noticeRect.x,
				layout.noticeRect.y,
			)
			this.components.notice.resize(
				layout.noticeRect.w,
				layout.noticeRect.h,
			)

			this.layers.tabs.position.set(layout.tabsRect.x, layout.tabsRect.y)
			this.renderTabs()

			this.layers.content.position.set(0, 0)

			this.layers.overview.position.set(0, 0)
			this.components.overviewRows.resize(layout.overview.listRect.w)
			this.components.overviewRows.root.position.set(
				layout.overview.listRect.x,
				layout.overview.listRect.y,
			)
			this.components.pingButton.setSize(
				layout.overview.buttonRect.w,
				layout.overview.buttonRect.h,
			)
			this.components.pingButton.root.position.set(
				layout.overview.buttonRect.x,
				layout.overview.buttonRect.y,
			)

			this.layers.history.position.set(0, 0)
			this.layers.chart.position.set(0, 0)
			this.components.historyPlotLabel.resize(
				layout.history.plotLabelRect.w,
			)
			this.components.historyPlotLabel.root.position.set(
				layout.history.plotLabelRect.x,
				layout.history.plotLabelRect.y,
			)
			this.components.historySummaryRows.resize(
				layout.history.summaryRect.w,
			)
			this.components.historySummaryRows.root.position.set(
				layout.history.summaryRect.x,
				layout.history.summaryRect.y,
			)

			this.layers.details.position.set(0, 0)
			this.components.detailsRows.resize(layout.details.collapseRect.w)
			this.components.detailsRows.root.position.set(
				layout.details.collapseRect.x,
				layout.details.collapseRect.y,
			)

			this.layers.footer.position.set(
				layout.footerRect.x,
				layout.footerRect.y,
			)
			this.components.footer.resize(
				layout.footerRect.w,
				layout.footerRect.h,
			)
		}

		applyTabVisibility() {
			this.layers.overview.visible = this.activeTab === "overview"
			this.layers.history.visible = this.activeTab === "history"
			this.layers.details.visible = this.activeTab === "details"
		}

		renderTabs() {
			if (!this.app || this.destroyed || !this.isSceneReady()) return
			const tabLayer = this.layers.tabButtons
			const palette = this.palette
			const interaction = HUD.Interaction
			const width = this.layoutMap.tabsRect.w
			const height = this.layoutMap.tabsRect.h
			const tabWidth = TAB_ITEMS.length
				? Math.max(56, Math.floor(width / TAB_ITEMS.length))
				: width
			const activeColor = palette.buttonColor || palette.primary
			const borderColor = palette.border
			const surfaceColor =
				palette.presetWhite || palette.panel || 0xffffff

			clearContainer(tabLayer, {
				destroyRemoved: true,
				skipIfDestroyed: true,
			})

			const divider = new Graphics()
			divider.moveTo(0, height).lineTo(width, height).stroke({
				width: 1,
				color: borderColor,
				alpha: 1,
				pixelLine: true,
			})
			tabLayer.addChild(divider)

			TAB_ITEMS.forEach((item, index) => {
				const tab = new Container()
				const hit = new Graphics()
				const isActive = item.id === this.activeTab
				const label = HUD.Components.TextTruncate({
					text: item.label,
					width: Math.max(28, tabWidth - 16),
					palette,
					fontSize: 13,
					tone: "base",
					surfaceColor,
				})
				const labelNode = label.root

				hit.rect(0, 0, tabWidth, height).fill({
					color: surfaceColor,
					alpha: 0.001,
				})

				labelNode.position.set(
					Math.round((tabWidth - labelNode.width) / 2),
					Math.round((height - labelNode.height) / 2) - 1,
				)

				labelNode.children?.forEach?.((child) => {
					if (child.style) {
						child.style.fill = isActive ? activeColor : palette.text
					}
				})

				interaction.register(hit, {
					onClick: () => {
						if (this.destroyed || this.activeTab === item.id) return
						this.activeTab = item.id
						this.renderTabs()
						this.renderData()
					},
				})

				tab.position.set(index * tabWidth, 0)
				tab.addChild(hit, labelNode)
				tabLayer.addChild(tab)

				if (isActive) {
					const indicator = new Graphics()
					indicator
						.rect(index * tabWidth, height - 2, tabWidth, 2)
						.fill({
							color: activeColor,
							alpha: 1,
						})
					tabLayer.addChild(indicator)
				}
			})

			this._tabsBuilt = true
		}

		resolveNoticeState() {
			if (this.statusState.status === "error") {
				return {
					visible: true,
					state: "danger",
					text: this.statusState.label || COPY.telemetryUnavailable,
				}
			}

			if (this.statusState.status === "pending") {
				return {
					visible: true,
					state: "warning",
					text: this.statusState.label || COPY.pending,
				}
			}

			if (
				this.snapshot?.sync?.status === "critical" ||
				this.snapshot?.sync?.status === "warning"
			) {
				return {
					visible: true,
					state:
						this.snapshot.sync.status === "critical"
							? "danger"
							: "warning",
					text:
						this.snapshot.sync.status === "critical"
							? COPY.driftAlert
							: COPY.driftWarning,
				}
			}

			return {
				visible: false,
				state: "info",
				text: "",
			}
		}

		buildOverviewItems() {
			const snapshot = this.snapshot
			return [
				{
					label: "Server Time",
					value: formatTimestamp(
						snapshot?.sources?.server?.epochMs,
						snapshot?.sources?.server?.timezoneLabel,
					),
				},
				{
					label: "WP Local Time",
					value: formatTimestamp(
						snapshot?.sources?.wp?.epochMs,
						snapshot?.sources?.wp?.timezoneLabel,
					),
				},
				{
					label: "Browser Time",
					value: formatTimestamp(
						snapshot?.sources?.browser?.epochMs,
						snapshot?.sources?.browser?.timezoneLabel,
					),
				},
				{
					label: "Server Uptime",
					value: formatUptime(snapshot?.uptime),
				},
				{
					label: "Ping",
					value: formatPing(snapshot?.ping?.valueMs),
					showDivider: false,
				},
			]
		}

		buildDetailsItems() {
			const snapshot = this.snapshot
			return [
				{
					label: "Server vs WP",
					value: formatDrift(snapshot?.drift?.serverVsWpMs),
				},
				{
					label: "Server vs Browser",
					value: formatDrift(snapshot?.drift?.serverVsBrowserMs),
				},
				{
					label: "WP vs Browser",
					value: formatDrift(snapshot?.drift?.wpVsBrowserMs),
				},
				{
					label: "Last Check",
					value: formatTimestamp(
						snapshot?.sampleTimestampMs,
						snapshot?.sources?.browser?.timezoneLabel,
					),
				},
				{
					label: "Timezone Sources",
					value: [
						snapshot?.sources?.server?.timezoneLabel || "UTC",
						snapshot?.sources?.wp?.timezoneLabel || "WP Local",
						snapshot?.sources?.browser?.timezoneLabel || "Browser",
					].join(" / "),
					showDivider: false,
				},
			]
		}

		buildHistoryItems() {
			const snapshot = this.snapshot
			return [
				{
					label: "Server vs Browser",
					value: formatDrift(snapshot?.drift?.serverVsBrowserMs),
				},
				{
					label: "WP vs Browser",
					value: formatDrift(snapshot?.drift?.wpVsBrowserMs),
				},
				{
					label: "Ping Latency",
					value: formatPing(snapshot?.ping?.valueMs),
					showDivider: false,
				},
			]
		}

		renderHistoryChart() {
			if (!this.app || this.destroyed || !this.isSceneReady()) return
			const plotRect = this.layoutMap.history.plotRect
			const plotLayer = this.layers.chart
			const palette = this.palette

			clearContainer(plotLayer, {
				destroyRemoved: true,
				skipIfDestroyed: true,
			})

			const frame = HUD.Primitives.PlotFrame({
				width: plotRect.w,
				height: plotRect.h,
				stroke: palette.borderSubtle || palette.border,
				strokeAlpha: 0.9,
				palette,
				fromTheme: true,
			})
			frame.position.set(plotRect.x, plotRect.y)
			plotLayer.addChild(frame)

			const innerRect = Layout.inset(
				rect(plotRect.x, plotRect.y, plotRect.w, plotRect.h),
				{ t: 12, r: 12, b: 20, l: 12 },
			)

			const grid = HUD.Primitives.Grid({
				width: innerRect.w,
				height: innerRect.h,
				palette,
			})
			grid.position.set(innerRect.x, innerRect.y)
			plotLayer.addChild(grid)

			const axis = HUD.Primitives.Axis({
				length: innerRect.w,
				palette,
			})
			axis.position.set(innerRect.x, innerRect.y + innerRect.h)
			plotLayer.addChild(axis)

			const serverBrowser = cloneSeries(
				this.snapshot?.history?.serverBrowser,
			)
			const wpBrowser = cloneSeries(this.snapshot?.history?.wpBrowser)
			const serverWp = cloneSeries(this.snapshot?.history?.serverWp)
			const ping = cloneSeries(this.snapshot?.history?.ping)
			const range = seriesRange([
				serverBrowser,
				wpBrowser,
				serverWp,
				ping,
			])

			const series = [
				{
					points: seriesToPoints(serverBrowser, plotRect, range),
					color: palette.server,
					alpha: 0.95,
				},
				{
					points: seriesToPoints(wpBrowser, plotRect, range),
					color: palette.wp,
					alpha: 0.88,
				},
				{
					points: seriesToPoints(serverWp, plotRect, range),
					color: palette.browser,
					alpha: 0.82,
				},
				{
					points: seriesToPoints(ping, plotRect, range),
					color: palette.primaryStrong,
					alpha: 0.72,
				},
			]

			series.forEach((entry) => {
				const line = renderSeriesLine(
					entry.points,
					entry.color,
					entry.alpha,
				)
				if (!line) return
				plotLayer.addChild(line)
			})

			const legendEntries = [
				{
					label: "Server / Browser",
					color: palette.server,
					alpha: 0.95,
				},
				{ label: "WP / Browser", color: palette.wp, alpha: 0.88 },
				{ label: "Server / WP", color: palette.browser, alpha: 0.82 },
				{ label: "Ping", color: palette.primaryStrong, alpha: 0.72 },
			]
			const legendWidth = Math.min(116, Math.max(88, innerRect.w * 0.28))
			const legendX = innerRect.x + innerRect.w - legendWidth
			const legendY = innerRect.y + 4
			legendEntries.forEach((entry, index) => {
				const itemY = legendY + index * 12
				const swatch = new Graphics()
				swatch
					.moveTo(legendX, itemY + 5)
					.lineTo(legendX + 12, itemY + 5)
					.stroke({
						width: 2,
						color: entry.color,
						alpha: entry.alpha,
						pixelLine: true,
					})
				plotLayer.addChild(swatch)

				const label = HUD.Components.TextTruncate({
					text: entry.label,
					width: legendWidth - 16,
					palette,
					fontSize: 10,
					tone: "base",
					surfaceColor: palette.canvas || palette.panel,
				})
				label.root.position.set(legendX + 16, itemY - 1)
				plotLayer.addChild(label.root)
			})

			const upperLabel = HUD.Components.TextTruncate({
				text: `${Math.round(range.max)} ms`,
				width: 72,
				palette,
				fontSize: 11,
				tone: "base",
				surfaceColor: palette.canvas || palette.panel,
			})
			upperLabel.root.position.set(plotRect.x + 8, plotRect.y + 4)
			plotLayer.addChild(upperLabel.root)

			const lowerLabel = HUD.Components.TextTruncate({
				text: `${Math.round(range.min)} ms`,
				width: 72,
				palette,
				fontSize: 11,
				tone: "base",
				surfaceColor: palette.canvas || palette.panel,
			})
			lowerLabel.root.position.set(
				plotRect.x + 8,
				plotRect.y + plotRect.h - 18,
			)
			plotLayer.addChild(lowerLabel.root)
		}

		renderData() {
			if (!this.app || this.destroyed || !this.isSceneReady()) return

			const notice = this.resolveNoticeState()
			this.layers.notice.visible = notice.visible
			this.components.notice.setState({
				state: notice.state,
				text: notice.text,
				width: this.layoutMap.noticeRect.w,
				height: this.layoutMap.noticeRect.h,
			})

			this.components.overviewRows.setState({
				width: this.layoutMap.overview.listRect.w,
				rowHeight: this.layoutMap.rowHeight,
				flush: true,
				items: this.buildOverviewItems(),
			})

			this.components.pingButton.setState({
				label: "PING",
				width: this.layoutMap.overview.buttonRect.w,
				height: this.layoutMap.overview.buttonRect.h,
				loading: this.statusState.status === "pending",
				disabled: this.statusState.status === "pending",
			})

			this.components.historySummaryRows.setState({
				width: this.layoutMap.history.summaryRect.w,
				rowHeight: this.layoutMap.history.summaryRowHeight,
				flush: true,
				items: this.buildHistoryItems(),
			})

			this.components.detailsRows.setState({
				width: this.layoutMap.details.collapseRect.w,
				rowHeight: this.layoutMap.rowHeight,
				flush: true,
				items: this.buildDetailsItems(),
			})

			this.components.footer.setState({
				width: this.layoutMap.footerRect.w,
				summary: formatTimestamp(this.snapshot?.sampleTimestampMs, ""),
				status:
					this.statusState.status === "pending"
						? "CHECKING"
						: this.statusState.status === "error"
						? "ERROR"
						: String(this.snapshot?.sync?.label || "SYNCED"),
			})

			this.renderHistoryChart()
			this.applyTabVisibility()
		}

		update(snapshot) {
			if (!this.app || this.destroyed || !this.isSceneReady()) return
			if (!snapshot || typeof snapshot !== "object") return
			this.snapshot = snapshot
			this.renderData()
		}

		setStatus(nextStatus = {}) {
			if (!this.app || this.destroyed || !this.isSceneReady()) return
			this.statusState = {
				label: String(nextStatus?.label || ""),
				status: String(nextStatus?.status || "idle"),
			}
			this.renderData()
		}

		resize() {
			this.handleResize()
		}

		destroy() {
			this.destroyed = true

			if (this.resizeObserver) {
				this.resizeObserver.disconnect()
				this.resizeObserver = null
			} else {
				window.removeEventListener("resize", this.handleResize)
			}

			Object.values(this.components).forEach((component) => {
				component?.destroy?.()
			})
			this.components = {}

			Object.values(this.layers).forEach((layer) => {
				safeDestroyDisplayObject(layer)
			})
			this.layers = {}
			this.root = null

			if (this.app) {
				try {
					this.app.destroy(false, { children: true })
				} catch (_error) {
					try {
						this.app.destroy(false)
					} catch (__error) {}
				}
				this.app = null
			}
		}
	}

	window.SystemDeckTimeMonitorPixiScene = {
		create(rootEl, options = {}) {
			return TimeMonitorPixiScene.create(rootEl, options)
		},
	}
})()
