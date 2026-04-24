;(function () {
	"use strict"

	const PIXI = window.PIXI
	if (!PIXI) return

	if (
		window.SYSTEMDECK_DEBUG_PIXI_LIFECYCLE &&
		!window.__SD_PIXI_LIFECYCLE_TRAPS_INSTALLED__
	) {
		window.__SD_PIXI_LIFECYCLE_TRAPS_INSTALLED__ = true

		const renderLabel = (obj) =>
			[
				obj?.constructor?.name || "Unknown",
				obj?.label ? `label=${obj.label}` : "",
				obj?.name ? `name=${obj.name}` : "",
				obj?.destroyed ? "destroyed=true" : "",
			]
				.filter(Boolean)
				.join(" ")

		const wrap = (proto, methodName, marker) => {
			const original = proto?.[methodName]
			if (typeof original !== "function" || original.__sdWrapped) return
			const wrapped = function (...args) {
				try {
					console.error(
						`[HUD lifecycle] ${marker}`,
						renderLabel(this),
						new Error().stack,
					)
				} catch (_err) {}
				return original.apply(this, args)
			}
			wrapped.__sdWrapped = true
			proto[methodName] = wrapped
		}

		wrap(PIXI.DisplayObject?.prototype, "destroy", "destroy")
		wrap(PIXI.Container?.prototype, "removeChild", "removeChild")
		wrap(PIXI.Container?.prototype, "removeChildren", "removeChildren")
	}

	/**
	 * SystemDeck Pixi HUD Framework
	 * Locked Execution Contract — Step 1 & 2: Namespace Foundation & Utils
	 */
	window.SystemDeckPixiHUD = {
		Utils: {},
		Spacing: {
			get density() {
				return window.SystemDeckPixiHUD?.Scale?.variants || {}
			},
			inset: {
				panel: 12,
				content: 12,
				block: 10,
				action: 8,
				table: 12,
				timeline: 8,
				pin: 12,
				buttonX: 10,
				buttonY: 6,
				badgeX: 12,
				badgeY: 4,
				chart: 16,
				pie: 10,
				tooltip: 8,
				statRowX: 0,
				statRowY: 0,
			},
			gap: {
				item: 8,
				tight: 6,
				section: 12,
				inline: 8,
				block: 10,
				table: 10,
				timeline: 8,
				feedback: 8,
				row: 8,
				column: 12,
				chart: 16,
				chartBars: 4,
				chartCells: 2,
				grid: 12,
			},
			header: {
				height: 38,
				titleGap: 18,
				dividerY: 24,
			},
			radius: {
				panel: 4,
				block: 4,
				button: 4,
				iconButton: 4,
				badge: 999,
				pill: 999,
				focus: 6,
				pin: 12,
				chart: 4,
				tooltip: 4,
				progress: 4,
			},
			control: {
				buttonHeight: 28,
				inlineHeight: 24,
				iconButtonSize: 28,
				badgeHeight: 20,
				pillHeight: 20,
				progressHeight: 8,
				statRowHeight: 24,
				dataListRowHeight: 24,
				keyValueRowHeight: 24,
				tableRowHeight: 24,
				timelineRowHeight: 24,
				contentHeaderHeight: 38,
				contentFooterHeight: 28,
				actionBarHeight: 32,
				pinHeaderHeight: 40,
				miniTrendSparkWidth: 48,
				miniTrendSparkMinWidth: 32,
			},
			primitive: {
				signalLineWidth: 2,
				sparklineWidth: 1.5,
				sparklineStrokeWidth: 1.5,
				legendDotSize: 4,
				dialTrackWidth: 3.5,
				dialTrackAlpha: 0.42,
				dialTickWidth: 2,
				dialTickAlpha: 0.58,
				dialTickSize: 6,
				dialNeedleWidth: 3,
				hairlineWidth: 1,
				glowStrokeWidth: 2,
				focusRingWidth: 2,
				fillBarHeight: 8,
				shadowAlpha: 0.05,
				badgeAnchorSize: 10,
				gridStrokeWidth: 1,
				gridAlpha: 0.3,
				gridColumns: 10,
				gridRows: 5,
				axisStrokeWidth: 1,
				axisAlpha: 0.5,
				axisTickLength: 5,
				axisTickWidth: 1,
				axisTickCount: 5,
			},
		},
		Theme: {},
		Typography: {},
		Primitives: {},
		Layout: {},
		Animation: {},
		Interaction: {},
		Components: {},
		Charts: {},
		Registry: {},
		Icon: {},
		Scale: {},
		State: {},
		Feedback: {},
		Plugins: {},
		Compositions: {},
		Debug: {},
		EngineInstances: [],
		_themeRefreshTimer: null,
		_refreshing: false,
		_themeObserverInstalled: false,
		_themeObserver: null,
		warn(message) {
			if (typeof console !== "undefined" && console.warn) {
				console.warn(`[SystemDeckPixiHUD] ${message}`)
			}
		},
		refreshAll() {
			if (this._themeRefreshTimer) {
				window.clearTimeout(this._themeRefreshTimer)
				this._themeRefreshTimer = null
			}
			this.Theme.clearAllCaches()
			this.EngineInstances.forEach((engine) => {
				if (engine && !engine.destroyed) {
					engine.refreshThemeAndRedraw()
				}
			})
		},
		scheduleRefreshAll() {
			if (
				!this.EngineInstances.length ||
				this._themeRefreshTimer ||
				this._refreshing
			) {
				return
			}

			this._refreshing = true
			this._themeRefreshTimer = window.setTimeout(() => {
				this._themeRefreshTimer = null
				this._refreshing = false
				this.refreshAll()
			}, 50)
		},
		installThemeObserver() {
			if (
				this._themeObserverInstalled ||
				typeof MutationObserver !== "function"
			) {
				return
			}

			const hud = this
			const shouldRefreshForTarget = (target) => {
				if (!target || !target.nodeType) return false
				if (
					target === document.documentElement ||
					target === document.body
				) {
					return true
				}
				if (
					target.id === "systemdeck" ||
					target.id === "sd-canvas-root"
				) {
					return true
				}
				return !!(
					target.classList &&
					(target.classList.contains("sd-canvas-shell") ||
						target.classList.contains("sd-widget-block-host"))
				)
			}

			this._themeObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === "attributes") {
						if (
							shouldRefreshForTarget(mutation.target) &&
							(mutation.attributeName === "class" ||
								mutation.attributeName === "style")
						) {
							hud.scheduleRefreshAll()
							return
						}
					}

					if (
						mutation.type === "childList" &&
						mutation.target === document.head
					) {
						const nodes = [
							...(mutation.addedNodes || []),
							...(mutation.removedNodes || []),
						]
						if (
							nodes.some(
								(node) =>
									node?.nodeType === 1 &&
									(node.tagName === "STYLE" ||
										node.tagName === "LINK"),
							)
						) {
							nodes.forEach((node) => {
								if (
									node?.nodeType === 1 &&
									node.tagName === "STYLE"
								) {
									hud._themeObserver.observe(node, {
										characterData: true,
										childList: true,
										subtree: true,
									})
								}
							})
							hud.scheduleRefreshAll()
							return
						}
					}

					if (mutation.type === "characterData") {
						const parent = mutation.target?.parentElement
						if (parent && parent.tagName === "STYLE") {
							hud.scheduleRefreshAll()
							return
						}
					}
				}
			})

			const root = document.documentElement
			const body = document.body
			const head = document.head

			if (head) {
				this._themeObserver.observe(head, {
					childList: true,
					subtree: false,
				})
				head.querySelectorAll("style").forEach((styleEl) => {
					this._themeObserver.observe(styleEl, {
						characterData: true,
						childList: true,
						subtree: true,
					})
				})
			}
			if (root) {
				this._themeObserver.observe(root, {
					attributes: true,
					attributeFilter: ["class", "style"],
				})
			}
			if (body) {
				this._themeObserver.observe(body, {
					attributes: true,
					attributeFilter: ["class", "style"],
				})
			}

			this._themeObserverInstalled = true
		},
	}

	window.SystemDeckPixiHUD.Utils = {
		clamp(v, min, max) {
			return Math.max(min, Math.min(max, v))
		},

		lerp(a, b, t) {
			return a + (b - a) * t
		},

		lerpColor(c1, c2, t) {
			const r1 = (c1 >> 16) & 0xff
			const g1 = (c1 >> 8) & 0xff
			const b1 = c1 & 0xff
			const r2 = (c2 >> 16) & 0xff
			const g2 = (c2 >> 8) & 0xff
			const b2 = c2 & 0xff
			const r = Math.round(r1 + (r2 - r1) * t)
			const g = Math.round(g1 + (g2 - g1) * t)
			const b = Math.round(b1 + (b2 - b1) * t)
			return (r << 16) | (g << 8) | b
		},

		alpha(color, a) {
			return { color, alpha: a }
		},

		hex(color) {
			return `#${Number(color || 0)
				.toString(16)
				.padStart(6, "0")}`
		},

		readableTextColor(fill, light = 0xffffff, dark = 0x1d2327) {
			const value = Number(fill)
			if (!Number.isFinite(value)) return dark
			const r = (value >> 16) & 0xff
			const g = (value >> 8) & 0xff
			const b = value & 0xff
			const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
			return luminance < 0.5 ? light : dark
		},

		normalizeValue(v, min, max) {
			return this.clamp((v - min) / (max - min), 0, 1)
		},

		safeNumber(v, fallback = 0) {
			const n = Number(v)
			return Number.isFinite(n) ? n : fallback
		},

		measureText(text, style) {
			if (!PIXI.TextMetrics) return { width: 0, height: 0 }
			return PIXI.TextMetrics.measureText(text, new PIXI.TextStyle(style))
		},

		fitText(textObj, maxWidth, minScale = 0.62) {
			if (!textObj || !maxWidth) return
			textObj.scale.set(1)
			if (textObj.width <= maxWidth) return
			const s = this.clamp(maxWidth / textObj.width, minScale, 1)
			textObj.scale.set(s)
		},

		distributeEvenly(count, width, padding = 0) {
			if (count <= 1) return [width / 2]
			const available = width - padding * 2
			const step = available / (count - 1)
			const points = []
			for (let i = 0; i < count; i++) {
				points.push(padding + i * step)
			}
			return points
		},

		summarizeSeries(samples) {
			const values = Array.isArray(samples)
				? samples.map((v) => Number(v)).filter(Number.isFinite)
				: []
			if (!values.length) {
				return { latest: 0, min: 0, max: 0, spread: 0, avg: 0 }
			}
			let min = values[0]
			let max = values[0]
			let sum = 0
			for (const v of values) {
				if (v < min) min = v
				if (v > max) max = v
				sum += v
			}
			return {
				latest: values[values.length - 1],
				min,
				max,
				spread: max - min,
				avg: sum / values.length,
			}
		},

		parsePing(value) {
			if (typeof value === "number") return value
			const match = String(value || "").match(/-?\d+(\.\d+)?/)
			return match ? Number(match[0]) : 0
		},

		formatDateLabel(epochMs) {
			const date = new Date(this.safeNumber(epochMs, 0))
			if (Number.isNaN(date.getTime())) return "--"
			return date.toLocaleDateString([], {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		},

		formatDriftLabel(value) {
			const numeric = this.safeNumber(value, 0)
			const sign = numeric > 0 ? "+" : ""
			return `${sign}${numeric.toFixed(1)}ms`
		},
	}

	/**
	 * HUD.Theme: Single authority for WP-native color bridging.
	 * Step 3: Theme System
	 */
	window.SystemDeckPixiHUD.Theme = {
		_cache: {},

		/**
		 * Read a CSS variable and convert it to a Pixi-safe numeric hex.
		 * Uses a proxy element to resolve var() chains correctly.
		 */
		readCssColor(name, fallback) {
			const roots = [document.documentElement, document.body]
			const canvasRoot = document.querySelector("#sd-canvas-root")
			if (canvasRoot) roots.unshift(canvasRoot)

			// Fast path: try reading directly from common roots first
			for (const r of roots) {
				const val = getComputedStyle(r).getPropertyValue(name).trim()
				if (val && val !== "" && !val.includes("var(")) {
					const hex = this.parseRgb(val)
					if (hex !== null) return hex
				}
			}

			// Slow path: use proxy for var() chain resolution
			if (!this._proxy) {
				this._proxy = document.createElement("div")
				this._proxy.style.display = "none"
				this._proxy.id = "sd-hud-theme-proxy"
				document.body.appendChild(this._proxy)
			}

			this._proxy.style.color = `var(${name})`
			const value = getComputedStyle(this._proxy).color

			if (!value || value === "" || value.includes("var("))
				return fallback

			return this.parseRgb(value) || fallback
		},

		/**
		 * Parse RGB string from computed style to numeric hex.
		 */
		parseRgb(value) {
			if (!value) return null
			const parts = value.match(/\d+/g)
			if (parts && parts.length >= 3) {
				return (
					(Number(parts[0]) << 16) |
					(Number(parts[1]) << 8) |
					Number(parts[2])
				)
			}
			if (value.startsWith("#")) {
				return parseInt(value.slice(1), 16)
			}
			return null
		},

		/**
		 * Clear the local theme cache.
		 */
		clearCache() {
			this._cache = {}
		},

		/**
		 * Refresh the color cache from current CSS state.
		 */
		refreshColors() {
			const previous = { ...this._cache }
			this._cache = {
				// Surface Layers
				canvas: this.readCssColor(
					"--sd-color-surface-canvas",
					0xf0f0f1,
				),
				panel: this.readCssColor("--sd-color-surface-panel", 0xffffff),
				panelSoft: this.readCssColor(
					"--sd-color-surface-panel-soft",
					0xf6f7f7,
				),

				// Decoration
				border: this.readCssColor("--sd-color-border-strong", 0xc3c4c7),
				borderSubtle: this.readCssColor("--sd-border-subtle", 0xdcdcde),
				grid: this.readCssColor("--sd-color-grid", 0xdcdcde),
				gridStrong: this.readCssColor(
					"--sd-color-grid-strong",
					0x2271b1,
				),
				shadowColor: this.readCssColor("--sd-widget-shadow", 0x000000),
				shadowColorStrong: this.readCssColor(
					"--sd-widget-shadow-strong",
					0x000000,
				),
				inset: this.readCssColor("--sd-widget-inset", 0xf6f7f7),
				insetBorder: this.readCssColor(
					"--sd-widget-inset-border",
					0xc3c4c7,
				),

				// Typography
				text: this.readCssColor("--sd-color-text-primary", 0x3c434a),
				textDim: this.readCssColor(
					"--sd-color-text-secondary",
					0x646970,
				),
				textMuted: this.readCssColor("--sd-color-text-muted", 0xa7aaad),
				buttonColor: this.readCssColor("--sd-button-color", 0x2271b1),
				buttonColorHover: this.readCssColor(
					"--sd-button-color-hover",
					0x1f659f,
				),
				btnPrimaryText: this.readCssColor(
					"--sd-btn-primary-text",
					0xffffff,
				),
				inputBg: this.readCssColor("--sd-input-bg", 0xffffff),
				inputText: this.readCssColor("--sd-input-text", 0x2c3338),

				// States / Sources
				primary: this.readCssColor("--sd-color-primary", 0x2271b1),
				primarySoft: this.readCssColor(
					"--sd-color-primary-soft",
					0x4f83c0,
				),
				primaryStrong: this.readCssColor(
					"--sd-color-primary-strong",
					0x0f4c81,
				),
				secondary: this.readCssColor("--sd-color-secondary", 0x523f6d),
				secondarySoft: this.readCssColor(
					"--sd-color-secondary-soft",
					0x7b648e,
				),
				secondaryStrong: this.readCssColor(
					"--sd-color-secondary-strong",
					0x362a48,
				),
				notification: this.readCssColor(
					"--sd-notification-color",
					0xdba617,
				),
				accent: this.readCssColor("--sd-color-accent", 0x2271b1),
				success: this.readCssColor(
					"--sd-color-state-success",
					0x00a32a,
				),
				warning: this.readCssColor(
					"--sd-color-state-warning",
					0xdba617,
				),
				critical: this.readCssColor(
					"--sd-color-state-critical",
					0xd63638,
				),

				// Specific Sources (Aliased)
				server: this.readCssColor("--sd-color-source-server", 0x2271b1),
				wp: this.readCssColor("--sd-color-source-wordpress", 0x72aee6),
				browser: this.readCssColor(
					"--sd-color-source-browser",
					0x04a4cc,
				),

				// WordPress preset bridge
				presetBlack: this.readCssColor(
					"--wp--preset--color--black",
					0x000000,
				),
				presetCyanBluishGray: this.readCssColor(
					"--wp--preset--color--cyan-bluish-gray",
					0xabb8c3,
				),
				presetWhite: this.readCssColor(
					"--wp--preset--color--white",
					0xffffff,
				),
				presetPalePink: this.readCssColor(
					"--wp--preset--color--pale-pink",
					0xf78da7,
				),
				presetVividRed: this.readCssColor(
					"--wp--preset--color--vivid-red",
					0xcf2e2e,
				),
				presetLuminousVividOrange: this.readCssColor(
					"--wp--preset--color--luminous-vivid-orange",
					0xff6900,
				),
				presetLuminousVividAmber: this.readCssColor(
					"--wp--preset--color--luminous-vivid-amber",
					0xfcb900,
				),
				presetLightGreenCyan: this.readCssColor(
					"--wp--preset--color--light-green-cyan",
					0x7bdcb5,
				),
				presetVividGreenCyan: this.readCssColor(
					"--wp--preset--color--vivid-green-cyan",
					0x00d084,
				),
				presetPaleCyanBlue: this.readCssColor(
					"--wp--preset--color--pale-cyan-blue",
					0x8ed1fc,
				),
				presetVividCyanBlue: this.readCssColor(
					"--wp--preset--color--vivid-cyan-blue",
					0x0693e3,
				),
				presetVividPurple: this.readCssColor(
					"--wp--preset--color--vivid-purple",
					0x9b51e0,
				),

				// Extended semantic colors backed by WP presets
				alertInfo: this.readCssColor(
					"--wp--preset--color--vivid-cyan-blue",
					0x0693e3,
				),
				alertPositive: this.readCssColor(
					"--wp--preset--color--vivid-green-cyan",
					0x00d084,
				),
				alertCaution: this.readCssColor(
					"--wp--preset--color--luminous-vivid-amber",
					0xfcb900,
				),
				alertDanger: this.readCssColor(
					"--wp--preset--color--vivid-red",
					0xcf2e2e,
				),
				chartSeries1: this.readCssColor(
					"--wp--preset--color--vivid-cyan-blue",
					0x0693e3,
				),
				chartSeries2: this.readCssColor(
					"--wp--preset--color--vivid-purple",
					0x9b51e0,
				),
				chartSeries3: this.readCssColor(
					"--wp--preset--color--vivid-green-cyan",
					0x00d084,
				),
				chartSeries4: this.readCssColor(
					"--wp--preset--color--luminous-vivid-amber",
					0xfcb900,
				),
				chartSeries5: this.readCssColor(
					"--wp--preset--color--vivid-red",
					0xcf2e2e,
				),
				chartSeries6: this.readCssColor(
					"--wp--preset--color--pale-cyan-blue",
					0x8ed1fc,
				),
			}
			const changed = Object.keys(this._cache).some(
				(key) => this._cache[key] !== previous[key],
			)
			if (changed && window.SystemDeckPixiHUD?.Icon?.clearCache) {
				window.SystemDeckPixiHUD.Icon.clearCache()
			}
			return this._cache
		},

		getColors() {
			if (!Object.keys(this._cache).length) {
				this.refreshColors()
			}
			return this._cache
		},

		/**
		 * Clear all HUD-owned caches for a full refresh.
		 */
		clearAllCaches() {
			this.clearCache()
			if (window.SystemDeckPixiHUD?.Icon?.clearCache) {
				window.SystemDeckPixiHUD.Icon.clearCache()
			}
		},

		/**
		 * Get a specific color by name.
		 */
		getColor(name, fallback = 0x000000) {
			const colors = this.getColors()
			return colors[name] ?? fallback
		},

		/**
		 * Get a state-specific color.
		 */
		getStateColor(state, fallback) {
			const colors = this.getColors()
			return colors[state] ?? fallback ?? colors.text
		},

		/**
		 * Resolve a tone with an optional soft/strong variant.
		 */
		getToneColor(name, variant = "base", palette = null, fallback = null) {
			const colors = palette || this.getColors()
			const key =
				variant === "soft"
					? `${name}Soft`
					: variant === "strong"
					? `${name}Strong`
					: name
			return colors[key] ?? colors[name] ?? fallback ?? colors.primary
		},

		getPresetColor(name, fallback = null) {
			const colors = this.getColors()
			const presets = {
				black: "presetBlack",
				cyanBluishGray: "presetCyanBluishGray",
				white: "presetWhite",
				palePink: "presetPalePink",
				vividRed: "presetVividRed",
				luminousVividOrange: "presetLuminousVividOrange",
				luminousVividAmber: "presetLuminousVividAmber",
				lightGreenCyan: "presetLightGreenCyan",
				vividGreenCyan: "presetVividGreenCyan",
				paleCyanBlue: "presetPaleCyanBlue",
				vividCyanBlue: "presetVividCyanBlue",
				vividPurple: "presetVividPurple",
			}
			const key = presets[name]
			return key ? colors[key] ?? fallback : fallback
		},

		resolveTextOn(surfaceColor, variant = "base", fallback = null) {
			const colors = this.getColors()
			const surface =
				surfaceColor ??
				fallback ??
				colors.panel ??
				colors.presetWhite ??
				0xffffff
			const base = window.SystemDeckPixiHUD.Utils.readableTextColor(
				surface,
				colors.presetWhite ?? 0xffffff,
				colors.text ?? colors.presetBlack ?? 0x1d2327,
			)

			switch (variant) {
				case "muted":
					return window.SystemDeckPixiHUD.Utils.lerpColor(
						base,
						surface,
						0.38,
					)
				case "dim":
					return window.SystemDeckPixiHUD.Utils.lerpColor(
						base,
						surface,
						0.24,
					)
				default:
					return base
			}
		},

		assertThemeTokenUsage(value, context = "color", options = {}) {
			if (options && options.fromTheme) {
				return
			}
			if (typeof value === "number") {
				window.SystemDeckPixiHUD.warn(
					`Direct numeric ${context} detected. Shared Theme tokens must be used instead.`,
				)
			}
			if (typeof value === "string" && /^(#|rgb\()/i.test(value.trim())) {
				window.SystemDeckPixiHUD.warn(
					`Direct string ${context} detected. Shared Theme tokens must be used instead.`,
				)
			}
		},

		/**
		 * createPalette: Centralize semantic mapping per widget type.
		 */
		createPalette(type = "default") {
			const theme = this
			const palette = {}
			const entries = {
				bg: "canvas",
				panel: "panel",
				panelSoft: "panelSoft",
				border: "border",
				borderSubtle: "borderSubtle",
				grid: "grid",
				gridStrong: "gridStrong",
				shadowColor: "shadowColor",
				shadowColorStrong: "shadowColorStrong",
				inset: "inset",
				insetBorder: "insetBorder",
				text: "text",
				textDim: "textDim",
				textMuted: "textMuted",
				buttonColor: "buttonColor",
				buttonColorHover: "buttonColorHover",
				btnPrimaryText: "btnPrimaryText",
				inputBg: "inputBg",
				inputText: "inputText",
				accent: "accent",
				primary: "primary",
				primarySoft: "primarySoft",
				primaryStrong: "primaryStrong",
				secondary: "secondary",
				secondarySoft: "secondarySoft",
				secondaryStrong: "secondaryStrong",
				notification: "notification",
				server: "server",
				wp: "wp",
				browser: "browser",
				success: "success",
				warning: "warning",
				critical: "critical",
				alertInfo: "alertInfo",
				alertPositive: "alertPositive",
				alertCaution: "alertCaution",
				alertDanger: "alertDanger",
				chartSeries1: "chartSeries1",
				chartSeries2: "chartSeries2",
				chartSeries3: "chartSeries3",
				chartSeries4: "chartSeries4",
				chartSeries5: "chartSeries5",
				chartSeries6: "chartSeries6",
				presetBlack: "presetBlack",
				presetCyanBluishGray: "presetCyanBluishGray",
				presetWhite: "presetWhite",
				presetPalePink: "presetPalePink",
				presetVividRed: "presetVividRed",
				presetLuminousVividOrange: "presetLuminousVividOrange",
				presetLuminousVividAmber: "presetLuminousVividAmber",
				presetLightGreenCyan: "presetLightGreenCyan",
				presetVividGreenCyan: "presetVividGreenCyan",
				presetPaleCyanBlue: "presetPaleCyanBlue",
				presetVividCyanBlue: "presetVividCyanBlue",
				presetVividPurple: "presetVividPurple",
			}

			Object.keys(entries).forEach((key) => {
				Object.defineProperty(palette, key, {
					enumerable: true,
					get() {
						return theme.getColors()[entries[key]]
					},
				})
			})

			return palette
		},

		getPalette(type = "default") {
			return this.createPalette(type)
		},

		getSurface(name, fallback = null) {
			const colors = this.getColors()
			switch (name) {
				case "canvas":
					return colors.canvas ?? fallback
				case "panel":
					return colors.panel ?? fallback
				case "panelSoft":
					return colors.panelSoft ?? fallback
				case "inset":
					return colors.inset ?? fallback ?? colors.panelSoft
				default:
					return fallback ?? colors.panel
			}
		},
	}

	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => window.SystemDeckPixiHUD.installThemeObserver(),
			{ once: true },
		)
	} else {
		window.SystemDeckPixiHUD.installThemeObserver()
	}

	/**
	 * HUD.Typography: Centralized typography system.
	 */
	window.SystemDeckPixiHUD.Typography = {
		defaultFontFamily:
			'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
		defaultResolution: Math.max(window.devicePixelRatio || 1, 2),
		presets: {
			title: {
				fontSize: 20,
				fontWeight: "700",
				letterSpacing: 0,
				fill: "text",
			},
			section: {
				fontSize: 12,
				fontWeight: "700",
				letterSpacing: 0.2,
				fill: "text",
			},
			label: { fontSize: 13, fontWeight: "500", fill: "text" },
			// Keep bold numerals slightly lighter to preserve edge crispness.
			value: { fontSize: 16, fontWeight: "600", fill: "text" },
			small: { fontSize: 12, fontWeight: "400", fill: "text" },
			mono: {
				fontSize: 12,
				fontWeight: "400",
				fill: "text",
			},
		},

		create(styleKey, textStr, options = {}) {
			const theme =
				options.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const preset = this.presets[styleKey] || this.presets.label
			const resolvedFill =
				options.color || theme[preset.fill] || theme.text
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				options.color,
				"typography color",
			)

			const t = new PIXI.Text({
				text: textStr,
				resolution: options.resolution || this.defaultResolution,
				style: {
					fontFamily: this.defaultFontFamily,
					fontSize: options.fontSize || preset.fontSize,
					fontWeight: options.fontWeight || preset.fontWeight,
					letterSpacing:
						options.letterSpacing || preset.letterSpacing || 0,
					fill: resolvedFill,
				},
			})

			t.roundPixels = options.roundPixels ?? true

			if (options.shadow) {
				t.style.dropShadow = {
					alpha: 0.2,
					blur: 2,
					color: "#000000",
					distance: 1,
				}
			}

			if (options.align === "center") t.anchor.set(0.5)

			return t
		},
		assertUsage(context = "text") {
			window.SystemDeckPixiHUD.warn(
				`Direct ${context} instantiation detected. Typography must own text creation.`,
			)
		},

		section(text, options = {}) {
			return this.create("section", String(text).toUpperCase(), options)
		},
		value(text, options = {}) {
			return this.create("value", text, options)
		},
		createText(content, preset = "label", options = {}) {
			return this.create(preset, content, options)
		},
	}

	/**
	 * HUD.Icon: Standardized icon rendering.
	 * Prefers WordPress SVG icons when available, falls back to dashicon text.
	 */
	window.SystemDeckPixiHUD.Icon = {
		_map: {
			bookmark: "\uf487",
			clock: "\uf469",
			"chart-bar": "\uf185",
			"chart-pie": "\uf184",
			"wordpress-classic": "\uf120",
			shadow: "\uf464",
			"admin-generic": "\uf111",
			warning: "\uf534",
			yes: "\uf147",
			no: "\uf158",
			info: "\uf348",
			visibility: "\uf177",
			edit: "\uf464",
			menu: "\uf333",
			search: "\uf179",
			filter: "\uf232",
			update: "\uf463",
			performance: "\uf488",
			saved: "\uf147",
			note: "\uf464",
			flag: "\uf227",
		},
		_opticalOffsets: {
			update: { x: 2, y: 2 },
			"wordpress-classic": { x: -6, y: -3 },
		},
		getGlyph(name) {
			return this._map[name] || this._map["admin-generic"]
		},
		getOpticalOffset(name) {
			return this._opticalOffsets[String(name || "")] || { x: 0, y: 0 }
		},
		clearCache() {},
		create(name, options = {}) {
			const HUD = window.SystemDeckPixiHUD
			const theme = options.palette || HUD.Theme.getColors()
			let iconName = String(name || "admin-generic")
			let size = Number.isFinite(Number(options.size))
				? Number(options.size)
				: 20
			let color = options.color !== undefined ? options.color : theme.text
			let alpha = options.alpha !== undefined ? options.alpha : 1

			const root = new PIXI.Container()
			let node = null

			function buildLegacyNode() {
				const style = new PIXI.TextStyle({
					fontFamily: "dashicons",
					fontSize: size,
					fill: color,
					fontWeight: "400",
				})
				const text = new PIXI.Text({
					text: this.getGlyph(iconName),
					style,
				})
				text.anchor.set(0.5)
				text.alpha = alpha
				text.roundPixels = true
				return text
			}

			const render = () => {
				if (node) {
					root.removeChild(node)
					node.destroy()
					node = null
				}

				const offset = this.getOpticalOffset(iconName)
				node = buildLegacyNode.call(this)
				if (node) {
					node.position.set(
						Math.round(size / 2 + offset.x),
						Math.round(size / 2 + offset.y),
					)
					root.addChild(node)
				}
			}

			render()

			return {
				root,
				render,
				resize: (nextSize) => {
					if (
						Number.isFinite(Number(nextSize)) &&
						Number(nextSize) > 0
					) {
						size = Number(nextSize)
					}
					render()
				},
				setData: (d) => {
					if (d?.icon) iconName = String(d.icon)
					if (d?.color !== undefined) color = d.color
					render()
				},
				setState: (s) => {
					if (s?.alpha !== undefined) {
						alpha = s.alpha
						if (node) node.alpha = alpha
					}
				},
				destroy: () => {
					if (!root || root.destroyed) return
					
					root.destroy({ children: true })
				},
			}
		},
	}

	window.SystemDeckPixiHUD.Scale = {
		variants: {
			compact: {
				scale: 0.88,
				font: 0.92,
				icon: 0.9,
				chart: 0.9,
				gap: 0.8,
			},
			standard: { scale: 1, font: 1, icon: 1, chart: 1, gap: 1 },
			dense: {
				scale: 0.94,
				font: 0.96,
				icon: 0.96,
				chart: 0.92,
				gap: 0.9,
			},
			hero: {
				scale: 1.18,
				font: 1.08,
				icon: 1.1,
				chart: 1.12,
				gap: 1.12,
			},
			micro: {
				scale: 0.76,
				font: 0.84,
				icon: 0.8,
				chart: 0.8,
				gap: 0.72,
			},
		},

		resolve(variant = "standard", overrides = {}) {
			const base =
				this.variants[variant] ||
				this.variants.standard ||
				this.variants.standard
			return {
				variant,
				...base,
				...overrides,
			}
		},

		applyToSpacing(spacing, variant = "standard") {
			const scale = this.resolve(variant)
			const clone = JSON.parse(JSON.stringify(spacing || {}))
			const scaleValue = (value, factor) =>
				Number.isFinite(value)
					? Math.max(0, Math.round(value * factor))
					: value

			if (clone.inset) {
				Object.keys(clone.inset).forEach((key) => {
					clone.inset[key] = scaleValue(clone.inset[key], scale.scale)
				})
			}
			if (clone.gap) {
				Object.keys(clone.gap).forEach((key) => {
					clone.gap[key] = scaleValue(clone.gap[key], scale.gap)
				})
			}
			if (clone.control) {
				Object.keys(clone.control).forEach((key) => {
					clone.control[key] = scaleValue(
						clone.control[key],
						scale.scale,
					)
				})
			}
			if (clone.radius) {
				Object.keys(clone.radius).forEach((key) => {
					clone.radius[key] = scaleValue(
						clone.radius[key],
						scale.scale,
					)
				})
			}
			if (clone.primitive) {
				Object.keys(clone.primitive).forEach((key) => {
					clone.primitive[key] = scaleValue(
						clone.primitive[key],
						key.includes("Alpha") ? 1 : scale.scale,
					)
				})
			}
			return clone
		},
	}

	window.SystemDeckPixiHUD.State = {
		resolveTone(state, palette = null) {
			const hud = window.SystemDeckPixiHUD
			const colors = palette || hud.Theme.getColors()
			const tone =
				typeof state === "string"
					? state
					: state?.tone ||
					  state?.state ||
					  state?.status ||
					  state?.level ||
					  "neutral"

			const definitions = {
				success: {
					tone: "success",
					base: colors.success,
					soft: colors.success,
					strong: colors.success,
					text: colors.btnPrimaryText || colors.panel,
				},
				warning: {
					tone: "warning",
					base: colors.warning,
					soft: colors.warning,
					strong: colors.warning,
					text: colors.panel,
				},
				critical: {
					tone: "critical",
					base: colors.critical,
					soft: colors.critical,
					strong: colors.critical,
					text: colors.btnPrimaryText || colors.panel,
				},
				neutral: {
					tone: "neutral",
					base: colors.textDim,
					soft: colors.textMuted,
					strong: colors.text,
					text: colors.text,
				},
				info: {
					tone: "info",
					base: colors.accent,
					soft: colors.primarySoft || colors.accent,
					strong: colors.primaryStrong || colors.accent,
					text: colors.panel,
				},
				primary: {
					tone: "primary",
					base: colors.primary,
					soft: colors.primarySoft || colors.primary,
					strong: colors.primaryStrong || colors.primary,
					text: colors.btnPrimaryText || colors.panel,
				},
				secondary: {
					tone: "secondary",
					base: colors.secondary,
					soft: colors.secondarySoft || colors.secondary,
					strong: colors.secondaryStrong || colors.secondary,
					text: colors.btnPrimaryText || colors.panel,
				},
			}

			const resolved = definitions[tone] || {
				tone,
				base: colors[tone] ?? colors.textDim,
				soft: colors[`${tone}Soft`] ?? colors[tone] ?? colors.textMuted,
				strong: colors[`${tone}Strong`] ?? colors[tone] ?? colors.text,
				text: hud.Utils.readableTextColor(
					colors[tone] ?? colors.panel,
					colors.panel,
					colors.text,
				),
			}

			return {
				name: tone,
				...resolved,
			}
		},

		shouldRender(flags = {}) {
			return !!(flags.dirty || flags.resized || flags.dataChanged)
		},
	}

	window.SystemDeckPixiHUD.Feedback = {
		apply(target, state = {}, palette = null) {
			if (!target) return target
			const hud = window.SystemDeckPixiHUD
			const resolved = hud.State.resolveTone(state, palette)
			const hovered = !!state.hovered
			const active = !!state.active || !!state.pressed
			const disabled = !!state.disabled
			const noScale = !!target._hudNoScale
			const baseScale =
				target._hudBaseScale ||
				(target._hudBaseScale = {
					x: target.scale?.x ?? 1,
					y: target.scale?.y ?? 1,
				})

			target.alpha = disabled
				? (state.alpha ?? target.alpha ?? 1) * 0.55
				: hovered
				? Math.min(1, (state.alpha ?? target.alpha ?? 1) + 0.05)
				: state.alpha ?? target.alpha ?? 1

			if (target.scale && target.scale.set) {
				const scale = noScale
					? 1
					: disabled
					? 1
					: active
					? 0.97
					: hovered
					? 1.01
					: 1
				target.scale.set(baseScale.x * scale, baseScale.y * scale)
			}

			if (target.blendMode && state.blendMode) {
				target.blendMode = state.blendMode
			}

			target._hudTone = resolved
			target._hudFeedback = { hovered, active, disabled }
			return target
		},
	}

	window.SystemDeckPixiHUD.Plugins = {
		_registry: {},
		register(name, handler) {
			if (!name || typeof handler !== "function") return null
			this._registry[name] = handler
			return handler
		},
		get(name) {
			return this._registry[name] || null
		},
		create(name, ...args) {
			const handler = this.get(name)
			return handler ? handler(...args) : null
		},
	}

	window.SystemDeckPixiHUD.Compositions = {
		_registry: {},
		register(name, factory) {
			if (!name || typeof factory !== "function") return null
			this._registry[name] = factory
			return factory
		},
		get(name) {
			return this._registry[name] || null
		},
		create(name, options = {}) {
			const factory = this.get(name)
			return factory ? factory(options) : null
		},
	}

	window.SystemDeckPixiHUD.Debug = {
		layout: false,
		bounds: false,
		spacing: false,
		drawRect(g, rect, color = 0xff00ff, alpha = 0.18, radius = 0) {
			if (!g || !rect) return g
			if (radius > 0) {
				g.roundRect(rect.x, rect.y, rect.w, rect.h, radius).stroke({
					width: 1,
					color,
					alpha,
					pixelLine: true,
				})
			} else {
				g.rect(rect.x, rect.y, rect.w, rect.h).stroke({
					width: 1,
					color,
					alpha,
					pixelLine: true,
				})
			}
			return g
		},
		drawPadding(g, rect, pad = 0, color = 0x00ffff, alpha = 0.12) {
			if (!g || !rect) return g
			const p =
				typeof pad === "number"
					? { t: pad, r: pad, b: pad, l: pad }
					: pad
			const inner = {
				x: rect.x + (p.l || 0),
				y: rect.y + (p.t || 0),
				w: rect.w - ((p.l || 0) + (p.r || 0)),
				h: rect.h - ((p.t || 0) + (p.b || 0)),
			}
			return this.drawRect(g, inner, color, alpha, 0)
		},
	}

	/**
	 * HUD.Primitives: Stateless drawing helpers.
	 * Step 5: Primitives
	 */
	window.SystemDeckPixiHUD.Primitives = {
		/**
		 * Card: Base container with background, border, and optional shadow.
		 */
		Card(config = {}) {
			const g = new PIXI.Graphics()
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const w = config.width || 100
			const h = config.height || 100
			const r = config.radius || spacing.radius?.panel || 4
			const fill = config.fill !== undefined ? config.fill : theme.panel
			const fillAlpha =
				config.fillAlpha !== undefined ? config.fillAlpha : 1
			const stroke =
				config.stroke !== undefined ? config.stroke : theme.border
			const strokeAlpha =
				config.strokeAlpha !== undefined ? config.strokeAlpha : 0.5
			if (config.fromTheme !== true) {
				window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
					config.fill,
					"card fill",
				)
				window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
					config.stroke,
					"card stroke",
				)
			}

			if (config.shadow) {
				g.roundRect(0, 1, w, h, r + 1).fill({
					color:
						theme.shadowColorStrong ||
						theme.shadowColor ||
						theme.text,
					alpha:
						config.shadowAlpha ??
						spacing.primitive?.shadowAlpha ??
						0.05,
				})
			}

			g.roundRect(0, 0, w, h, r).fill({ color: fill, alpha: fillAlpha })

			if (strokeAlpha > 0) {
				g.roundRect(0, 0, w, h, r).stroke({
					width: config.strokeWidth || 1,
					color: stroke,
					alpha: strokeAlpha,
				})
			}

			return g
		},

		/**
		 * PlotFrame: Background frame for charts.
		 */
		PlotFrame(config = {}) {
			const g = new PIXI.Graphics()
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const w = config.width || 100
			const h = config.height || 100
			const r = config.radius || spacing.radius?.chart || 4

			g.roundRect(0, 0, w, h, r)
				.fill({
					color:
						config.fill ??
						theme.bg ??
						theme.canvas ??
						theme.inset ??
						theme.panelSoft,
					alpha: config.fillAlpha ?? 1,
				})
				.stroke({
					width: 1,
					color: config.stroke ?? theme.insetBorder ?? theme.border,
					alpha: config.strokeAlpha ?? 0.75,
				})

			return g
		},

		/**
		 * Ring: Circular ring or arc.
		 */
		Ring(config = {}) {
			const g = new PIXI.Graphics()
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const radius = config.radius || 50
			const start = config.startAngle || 0
			const end = config.endAngle || Math.PI * 2
			const strokeWidth = config.strokeWidth || config.width || 2
			const color = config.color ?? theme.primary
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"ring color",
			)

			g.arc(0, 0, radius, start, end).stroke({
				width: strokeWidth,
				color,
				alpha: config.alpha || 1,
				cap: config.cap || "round",
			})

			return g
		},

		/**
		 * DialTrack: Static background track for a gauge.
		 */
		DialTrack(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const radius = config.radius || 50
			const start = Math.PI * 0.75
			const span = Math.PI * 1.5
			const end = start + span
			const color =
				config.color ?? theme.primary ?? theme.textMuted ?? theme.border
			const alpha = config.alpha ?? primitive.dialTrackAlpha ?? 0.32
			const tickAlpha =
				config.tickAlpha ?? primitive.dialTickAlpha ?? 0.48
			const width =
				config.strokeWidth ||
				config.width ||
				primitive.dialTrackWidth ||
				3
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"dial track color",
			)

			// Main track
			g.arc(0, 0, radius, start, end).stroke({
				width,
				color,
				alpha,
			})

			// Ticks
			const ticks = config.ticks || 12
			for (let i = 0; i <= ticks; i++) {
				const a = start + (i / ticks) * span
				const r0 =
					radius - (config.tickSize || primitive.dialTickSize || 6)
				g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
					.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
					.stroke({
						width:
							config.tickStrokeWidth ||
							config.tickWidth ||
							primitive.dialTickWidth ||
							1.75,
						color,
						alpha: tickAlpha,
					})
			}

			return g
		},

		/**
		 * Needle: Indicator needle for a gauge.
		 */
		Needle(config = {}) {
			const g = new PIXI.Graphics()
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const length = config.length || 40
			const angle = config.angle || 0
			const color =
				config.color ??
				theme.notification ??
				theme.accent ??
				theme.primaryStrong ??
				theme.primary
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const strokeWidth =
				config.strokeWidth ||
				config.width ||
				primitive.dialNeedleWidth ||
				3
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"needle color",
			)

			g.moveTo(0, 0)
				.lineTo(Math.cos(angle) * length, Math.sin(angle) * length)
				.stroke({
					width: strokeWidth,
					color,
					alpha: 1,
					cap: "round",
				})

			g.circle(0, 0, config.pivot || 4).fill({ color, alpha: 1 })

			return g
		},

		/**
		 * SignalLine: Multi-point line series.
		 */
		SignalLine(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const points = config.points || []
			if (points.length < 2) return g
			const strokeWidth =
				config.strokeWidth ||
				config.width ||
				spacing.primitive?.signalLineWidth ||
				2

			const color = config.color ?? theme.primary
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"signal line color",
			)
			g.moveTo(points[0].x, points[0].y)
			for (let i = 1; i < points.length; i++) {
				g.lineTo(points[i].x, points[i].y)
			}

			g.stroke({
				width: strokeWidth,
				color,
				alpha: config.alpha || 1,
				cap: "round",
				join: "round",
			})

			return g
		},

		/**
		 * Sparkline: Compact line series.
		 */
		Sparkline(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const points = config.points || []
			if (points.length < 2) return g
			const color = config.color ?? theme.primary
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"sparkline color",
			)

			g.moveTo(points[0].x, points[0].y)
			for (let i = 1; i < points.length; i++) {
				g.lineTo(points[i].x, points[i].y)
			}

			g.stroke({
				width:
					config.strokeWidth ||
					config.width ||
					spacing.primitive?.sparklineStrokeWidth ||
					spacing.primitive?.sparklineWidth ||
					1.5,
				color,
				alpha: config.alpha || 0.8,
			})

			return g
		},

		/**
		 * LegendItem: Dot + Text combination.
		 */
		LegendItem(config = {}) {
			const container = new PIXI.Container()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const color = config.color ?? theme.primary
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"legend item color",
			)
			const dot = new PIXI.Graphics()
				.circle(
					0,
					0,
					config.dotSize || spacing.primitive?.legendDotSize || 4,
				)
				.fill({ color, alpha: 1 })

			container.addChild(dot)
			return container
		},

		/**
		 * Hairline: Ultra-light divider.
		 */
		Hairline(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const length = config.length || 100
			const vertical = !!config.vertical
			const strokeWidth =
				config.strokeWidth || primitive.hairlineWidth || 1
			const alpha = config.alpha ?? 0.2
			const color = config.color ?? theme.gridStrong ?? theme.border
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"hairline color",
			)

			if (vertical) {
				g.moveTo(0, 0).lineTo(0, length).stroke({
					width: strokeWidth,
					color,
					alpha,
					pixelLine: true,
				})
			} else {
				g.moveTo(0, 0).lineTo(length, 0).stroke({
					width: strokeWidth,
					color,
					alpha,
					pixelLine: true,
				})
			}

			return g
		},

		/**
		 * GlowStroke: Soft emphasis stroke for hover/focus/active.
		 */
		GlowStroke(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const color = config.color ?? theme.primaryStrong ?? theme.primary
			const glowColor = config.glowColor ?? theme.accent ?? color
			const alpha = config.alpha ?? 0.9
			const glowAlpha = config.glowAlpha ?? 0.18
			const strokeWidth =
				config.strokeWidth || primitive.glowStrokeWidth || 2
			const glowWidth = config.glowWidth || strokeWidth * 2
			const radius = config.radius || 0
			const width = config.width || 100
			const height = config.height || 24
			const points = Array.isArray(config.points) ? config.points : []
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"glow stroke color",
			)
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.glowColor,
				"glow color",
			)

			if (points.length >= 2) {
				g.moveTo(points[0].x, points[0].y)
				for (let i = 1; i < points.length; i++) {
					g.lineTo(points[i].x, points[i].y)
				}
				g.stroke({
					width: glowWidth,
					color: glowColor,
					alpha: glowAlpha,
					cap: "round",
					join: "round",
				})
				g.moveTo(points[0].x, points[0].y)
				for (let i = 1; i < points.length; i++) {
					g.lineTo(points[i].x, points[i].y)
				}
				g.stroke({
					width: strokeWidth,
					color,
					alpha,
					cap: "round",
					join: "round",
				})
				return g
			}

			if (radius > 0) {
				g.roundRect(0, 0, width, height, radius).stroke({
					width: glowWidth,
					color: glowColor,
					alpha: glowAlpha,
				})
				g.roundRect(0, 0, width, height, radius).stroke({
					width: strokeWidth,
					color,
					alpha,
				})
				return g
			}

			g.rect(0, 0, width, height).stroke({
				width: glowWidth,
				color: glowColor,
				alpha: glowAlpha,
			})
			g.rect(0, 0, width, height).stroke({
				width: strokeWidth,
				color,
				alpha,
			})
			return g
		},

		/**
		 * FocusRing: Accessibility-focused outline helper.
		 */
		FocusRing(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const width = config.width || 100
			const height = config.height || 40
			const radius = config.radius || spacing.radius?.focus || 8
			const strokeWidth =
				config.strokeWidth || primitive.focusRingWidth || 2
			const color = config.color ?? theme.primaryStrong ?? theme.primary
			const alpha = config.alpha ?? 0.9
			const inset = config.inset ?? 2
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"focus ring color",
			)

			g.roundRect(
				inset,
				inset,
				width - inset * 2,
				height - inset * 2,
				radius,
			)
				.stroke({
					width: strokeWidth,
					color,
					alpha,
				})
				.roundRect(
					inset + 2,
					inset + 2,
					width - (inset + 2) * 2,
					height - (inset + 2) * 2,
					Math.max(0, radius - 2),
				)
				.stroke({
					width: 1,
					color,
					alpha: alpha * 0.45,
				})

			return g
		},

		/**
		 * FillBar: Low-level bar fill helper.
		 */
		FillBar(config = {}) {
			const container = new PIXI.Container()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const width = config.width || 100
			const height = config.height || primitive.fillBarHeight || 8
			const radius = config.radius || spacing.radius?.progress || 4
			const value = Number.isFinite(config.value) ? config.value : 0
			const min = Number.isFinite(config.min) ? config.min : 0
			const max = Number.isFinite(config.max) ? config.max : 1
			const normalized = window.SystemDeckPixiHUD.Utils.normalizeValue(
				value,
				min,
				max,
			)
			const fillWidth = Math.max(0, Math.round(width * normalized))
			const trackColor = config.trackColor ?? theme.panelSoft
			const fillColor = config.color ?? theme.primary ?? theme.secondary
			const trackAlpha = config.trackAlpha ?? 0.65
			const fillAlpha = config.fillAlpha ?? 1
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.trackColor,
				"fill bar track color",
			)
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"fill bar color",
			)
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.fillColor,
				"fill bar fill color",
			)

			const track = new PIXI.Graphics()
				.roundRect(0, 0, width, height, radius)
				.fill({ color: trackColor, alpha: trackAlpha })

			const fill = new PIXI.Graphics()
				.roundRect(0, 0, fillWidth, height, radius)
				.fill({ color: fillColor, alpha: fillAlpha })

			container.addChild(track, fill)
			container._track = track
			container._fill = fill
			container._width = width
			container._height = height
			container.hitArea = new PIXI.Rectangle(0, 0, width, height)

			return container
		},

		/**
		 * GradientFill: Shared fill gradient factory.
		 */
		GradientFill(config = {}) {
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			if (typeof PIXI.FillGradient !== "function") {
				return (
					config.fallbackColor ||
					config.startColor ||
					config.endColor ||
					theme.primary
				)
			}

			const stops = Array.isArray(config.colorStops)
				? config.colorStops
				: Array.isArray(config.stops)
				? config.stops
				: [
						{
							offset: 0,
							color: config.startColor || theme.primary,
						},
						{ offset: 1, color: config.endColor || theme.text },
				  ]

			return new PIXI.FillGradient({
				type: config.type || "linear",
				start: config.start || { x: 0, y: 0 },
				end: config.end || { x: 1, y: 0 },
				center: config.center || { x: 0.5, y: 0.5 },
				innerRadius: config.innerRadius ?? 0,
				outerCenter: config.outerCenter || { x: 0.5, y: 0.5 },
				outerRadius: config.outerRadius ?? 0.5,
				colorStops: stops,
			})
		},

		/**
		 * ShadowLayer: Controlled depth helper.
		 */
		ShadowLayer(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const width = config.width || 100
			const height = config.height || 40
			const radius = config.radius || spacing.radius?.block || 10
			const offsetX = config.offsetX ?? 1
			const offsetY = config.offsetY ?? 2
			const alpha = config.alpha ?? primitive.shadowAlpha ?? 0.12
			const color = config.color ?? theme.text
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"shadow color",
			)

			g.roundRect(offsetX, offsetY, width, height, radius).fill({
				color,
				alpha,
			})

			return g
		},

		/**
		 * CornerBadgeAnchor: Anchor point for overlays.
		 */
		CornerBadgeAnchor(config = {}) {
			const container = new PIXI.Container()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const size = config.size || primitive.badgeAnchorSize || 10
			const color =
				config.color ?? theme.accent ?? theme.warning ?? theme.primary
			const alpha = config.alpha ?? 1
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"corner badge anchor color",
			)

			const dot = new PIXI.Graphics()
				.circle(0, 0, size / 2)
				.fill({ color, alpha })
			const ring = new PIXI.Graphics().circle(0, 0, size / 2).stroke({
				width: 1,
				color,
				alpha: 0.35,
				pixelLine: true,
			})

			container.addChild(ring, dot)
			container.hitArea = new PIXI.Rectangle(
				-size / 2,
				-size / 2,
				size,
				size,
			)
			container._width = size
			container._height = size
			return container
		},

		/**
		 * Grid: Standard X/Y background grid.
		 */
		Grid(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const w = config.width || 100
			const h = config.height || 100
			const color = config.color ?? theme.grid
			const alpha = config.alpha ?? primitive.gridAlpha ?? 0.3
			const cols = config.columns || primitive.gridColumns || 10
			const rows = config.rows || primitive.gridRows || 5
			const strokeWidth =
				config.strokeWidth || primitive.gridStrokeWidth || 1
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"grid color",
			)

			for (let i = 0; i <= cols; i++) {
				const x = (w / cols) * i
				g.moveTo(x, 0).lineTo(x, h).stroke({
					width: strokeWidth,
					color,
					alpha,
				})
			}
			for (let i = 0; i <= rows; i++) {
				const y = (h / rows) * i
				g.moveTo(0, y).lineTo(w, y).stroke({
					width: strokeWidth,
					color,
					alpha,
				})
			}

			return g
		},

		/**
		 * Axis: Single X or Y axis line with ticks.
		 */
		Axis(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const length = config.length || 100
			const color = config.color ?? theme.textMuted ?? theme.border
			const strokeWidth =
				config.strokeWidth || primitive.axisStrokeWidth || 1
			const axisAlpha = config.alpha ?? primitive.axisAlpha ?? 0.5
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"axis color",
			)

			g.moveTo(0, 0)
				.lineTo(length, 0)
				.stroke({ width: strokeWidth, color, alpha: axisAlpha })

			const ticks = config.ticks || primitive.axisTickCount || 5
			const tickLength =
				config.tickLength || primitive.axisTickLength || 5
			const tickWidth = config.tickWidth || primitive.axisTickWidth || 1
			for (let i = 0; i <= ticks; i++) {
				const x = (length / ticks) * i
				g.moveTo(x, 0)
					.lineTo(x, tickLength)
					.stroke({ width: tickWidth, color, alpha: axisAlpha })
			}

			return g
		},

		/**
		 * BadgeFrame: Rounded frame for tags/badges.
		 */
		BadgeFrame(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const w = config.width || 40
			const h = config.height || spacing.control?.badgeHeight || 20
			const r = config.radius || spacing.radius?.badge || h / 2
			const fill = config.fill ?? theme.panel
			const stroke = config.stroke ?? theme.border
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.fill,
				"badge frame fill",
				{ fromTheme: config.fromTheme === true },
			)
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.stroke,
				"badge frame stroke",
				{ fromTheme: config.fromTheme === true },
			)
			const fillAlpha =
				config.fillAlpha !== undefined
					? config.fillAlpha
					: config.alpha !== undefined
					? config.alpha
					: 0.1
			const strokeAlpha =
				config.strokeAlpha !== undefined ? config.strokeAlpha : 0.2

			g.roundRect(0, 0, w, h, r)
				.fill({
					color: fill,
					alpha: fillAlpha,
				})
				.stroke({
					width: config.strokeWidth ?? 1,
					color: stroke,
					alpha: strokeAlpha,
					pixelLine: config.pixelLine ?? true,
				})

			return g
		},

		/**
		 * ButtonFrame: Standard button background shape.
		 */
		ButtonFrame(config = {}) {
			const g = new PIXI.Graphics()
			const spacing = window.SystemDeckPixiHUD.Spacing || {}
			const theme =
				config.palette || window.SystemDeckPixiHUD.Theme.getColors()
			const w = config.width || 80
			const h = config.height || spacing.control?.buttonHeight || 28
			const r = config.radius || spacing.radius?.button || 4
			const fill = config.fill ?? theme.panel
			const stroke = config.stroke ?? theme.border
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.fill,
				"button frame fill",
				{ fromTheme: config.fromTheme === true },
			)
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.stroke,
				"button frame stroke",
				{ fromTheme: config.fromTheme === true },
			)

			g.roundRect(0, 0, w, h, r)
				.fill({
					color: fill,
					alpha: config.alpha ?? 0.1,
				})
				.stroke({
					width: config.strokeWidth ?? 1,
					color: stroke,
					alpha: config.strokeAlpha ?? 0.3,
					pixelLine: config.pixelLine ?? true,
				})

			return g
		},

		/**
		 * Divider: Simple line separator.
		 */
		Divider(config = {}) {
			const g = new PIXI.Graphics()
			const length = config.length || 100
			const vertical = config.vertical || false
			const theme = window.SystemDeckPixiHUD.Theme.getColors()
			const color = config.color ?? theme.borderSubtle ?? theme.border
			window.SystemDeckPixiHUD.Theme.assertThemeTokenUsage(
				config.color,
				"divider color",
			)

			if (vertical) {
				g.moveTo(0, 0).lineTo(0, length)
			} else {
				g.moveTo(0, 0).lineTo(length, 0)
			}

			g.stroke({ width: 1, color, alpha: config.alpha || 0.5 })
			return g
		},

		/**
		 * ProgressBar: Linear progress bar.
		 */
		ProgressBar(config = {}) {
			const component =
				window.SystemDeckPixiHUD.Components.ProgressBar(config)
			return component?.root || new PIXI.Container()
		},
	}

	/**
	 * HUD.Layout: Mandatory layout engine.
	 * Step 6: Layout
	 */
	window.SystemDeckPixiHUD.Layout = {
		create(surface = {}) {
			const width = Number(surface.width || surface.w || 0) || 0
			const height = Number(surface.height || surface.h || 0) || 0
			return {
				surface: this.box(0, 0, width, height),
				width,
				height,
			}
		},

		apply(layout) {
			return layout
		},

		/**
		 * Create a basic rect object.
		 */
		box(x = 0, y = 0, w = 100, h = 100) {
			return { x, y, w, h, width: w, height: h }
		},

		/**
		 * Create an inset rect.
		 */
		inset(rect, pad = 0) {
			const p =
				typeof pad === "number"
					? { t: pad, r: pad, b: pad, l: pad }
					: pad
			return this.box(
				rect.x + (p.l || 0),
				rect.y + (p.t || 0),
				rect.w - ((p.l || 0) + (p.r || 0)),
				rect.h - ((p.t || 0) + (p.b || 0)),
			)
		},

		/**
		 * Divide a rect into a row of sub-rects.
		 */
		row(rect, count, gap = 0, options = {}) {
			if (count <= 0) return []
			const rects = []
			const ratios =
				Array.isArray(options.ratio) && options.ratio.length === count
					? options.ratio.map((value) =>
							Math.max(0, Number(value) || 0),
					  )
					: null
			const available = rect.w - gap * (count - 1)

			if (ratios) {
				const total =
					ratios.reduce((sum, value) => sum + value, 0) || count
				let cursor = rect.x
				for (let i = 0; i < count; i++) {
					const unitW = (available * ratios[i]) / total
					rects.push(this.box(cursor, rect.y, unitW, rect.h))
					cursor += unitW + gap
				}
				return rects
			}

			const unitW = available / count
			for (let i = 0; i < count; i++) {
				rects.push(
					this.box(rect.x + i * (unitW + gap), rect.y, unitW, rect.h),
				)
			}
			return rects
		},

		/**
		 * Divide a rect into a column of sub-rects.
		 */
		column(rect, count, gap = 0, options = {}) {
			if (count <= 0) return []
			const rects = []
			const ratios =
				Array.isArray(options.ratio) && options.ratio.length === count
					? options.ratio.map((value) =>
							Math.max(0, Number(value) || 0),
					  )
					: null
			const available = rect.h - gap * (count - 1)

			if (ratios) {
				const total =
					ratios.reduce((sum, value) => sum + value, 0) || count
				let cursor = rect.y
				for (let i = 0; i < count; i++) {
					const unitH = (available * ratios[i]) / total
					rects.push(this.box(rect.x, cursor, rect.w, unitH))
					cursor += unitH + gap
				}
				return rects
			}

			const unitH = available / count
			for (let i = 0; i < count; i++) {
				rects.push(
					this.box(rect.x, rect.y + i * (unitH + gap), rect.w, unitH),
				)
			}
			return rects
		},

		/**
		 * Divide a rect into a grid of sub-rects.
		 */
		grid(rect, cols, rows, gap = 0) {
			const colRects = this.row(rect, cols, gap)
			const grid = []
			for (const col of colRects) {
				grid.push(this.column(col, rows, gap))
			}
			return grid // Access as grid[col][row]
		},

		/**
		 * Calculate center coordinates.
		 */
		center(rect, childW = 0, childH = 0) {
			return {
				x: rect.x + (rect.w - childW) / 2,
				y: rect.y + (rect.h - childH) / 2,
			}
		},

		/**
		 * Align coordinates within a rect.
		 */
		align(rect, childW, childH, type = "cc") {
			const locations = {
				tl: { x: rect.x, y: rect.y },
				tc: { x: rect.x + (rect.w - childW) / 2, y: rect.y },
				tr: { x: rect.x + rect.w - childW, y: rect.y },
				ml: { x: rect.x, y: rect.y + (rect.h - childH) / 2 },
				cc: {
					x: rect.x + (rect.w - childW) / 2,
					y: rect.y + (rect.h - childH) / 2,
				},
				mr: {
					x: rect.x + rect.w - childW,
					y: rect.y + (rect.h - childH) / 2,
				},
				bl: { x: rect.x, y: rect.y + rect.h - childH },
				bc: {
					x: rect.x + (rect.w - childW) / 2,
					y: rect.y + rect.h - childH,
				},
				br: {
					x: rect.x + rect.w - childW,
					y: rect.y + rect.h - childH,
				},
			}
			return locations[type] || locations.cc
		},

		/**
		 * Apply an alignment result directly to a target.
		 */
		place(target, rect, align = "cc") {
			if (!target || !target.position) return { x: rect.x, y: rect.y }
			const pos = this.align(
				rect,
				target.width || 0,
				target.height || 0,
				align,
			)
			target.position.set(pos.x, pos.y)
			target.__hudLayoutBound = true
			return pos
		},

		assertBound(target, context = "object") {
			if (!target || !target.__hudLayoutBound) {
				window.SystemDeckPixiHUD.warn(
					`${context} was positioned outside HUD.Layout authority.`,
				)
			}
		},

		/**
		 * Center a target inside a rect.
		 */
		centerIn(rect, target) {
			return this.place(target, rect, "cc")
		},

		/**
		 * Normalize a series to 0..1 values.
		 */
		scaleSeries(samples, options = {}) {
			const values = Array.isArray(samples)
				? samples.map((value) => Number(value)).filter(Number.isFinite)
				: []
			if (!values.length) return []

			const min = options.min ?? Math.min(...values)
			const max = options.max ?? Math.max(...values)
			const spread = max - min || 1
			return values.map((value) => (value - min) / spread)
		},

		/**
		 * Plot a series into a rect as pixel coordinates.
		 */
		plotPoints(samples, rect, options = {}) {
			const values = Array.isArray(samples)
				? samples.map((value) => Number(value)).filter(Number.isFinite)
				: []
			if (!values.length) return []

			const normalized = this.scaleSeries(values, options)
			const paddingX = options.paddingX ?? options.padding ?? 0
			const paddingY = options.paddingY ?? options.padding ?? 0
			const innerW = Math.max(0, rect.w - paddingX * 2)
			const innerH = Math.max(0, rect.h - paddingY * 2)
			const step = values.length > 1 ? innerW / (values.length - 1) : 0

			return normalized.map((value, index) => ({
				x: rect.x + paddingX + step * index,
				y: rect.y + paddingY + innerH - value * innerH,
			}))
		},

		/**
		 * Calculate coordinates for radial placement.
		 */
		radial(cx, cy, radius, angle) {
			return {
				x: cx + Math.cos(angle) * radius,
				y: cy + Math.sin(angle) * radius,
			}
		},

		/**
		 * Distribute items along an axis.
		 */
		distribute(rect, itemCount, axis = "x", padding = 0) {
			const size = axis === "x" ? rect.w : rect.h
			const start = axis === "x" ? rect.x : rect.y
			if (itemCount <= 1) return [start + size / 2]

			const available = size - padding * 2
			const step = available / (itemCount - 1)
			const points = []
			for (let i = 0; i < itemCount; i++) {
				points.push(start + padding + i * step)
			}
			return points
		},

		/**
		 * Flow layout with wrapping.
		 */
		flow(rect, items = [], gap = 0, options = {}) {
			const pad = options.padding || 0
			const maxX = rect.x + rect.w - pad
			const startX = rect.x + pad
			const startY = rect.y + pad
			const rects = []
			let cursorX = startX
			let cursorY = startY
			let rowH = 0

			;(Array.isArray(items) ? items : []).forEach((item) => {
				const w = Math.max(
					0,
					Number(item?.w ?? item?.width ?? item?.size ?? item) || 0,
				)
				const h = Math.max(
					0,
					Number(item?.h ?? item?.height ?? item?.size ?? item) || 0,
				)
				if (cursorX > startX && cursorX + w > maxX) {
					cursorX = startX
					cursorY += rowH + gap
					rowH = 0
				}
				rects.push(this.box(cursorX, cursorY, w, h))
				cursorX += w + gap
				rowH = Math.max(rowH, h)
			})

			return rects
		},

		/**
		 * Stack layout with vertical spacing.
		 */
		stack(rect, items = [], gap = 0, options = {}) {
			const pad = options.padding || 0
			const startX = rect.x + pad
			const startY = rect.y + pad
			const rects = []
			let cursorY = startY

			;(Array.isArray(items) ? items : []).forEach((item) => {
				const w = Math.max(
					0,
					Number(item?.w ?? item?.width ?? rect.w - pad * 2) || 0,
				)
				const h = Math.max(
					0,
					Number(item?.h ?? item?.height ?? item?.size ?? 0) || 0,
				)
				const x =
					options.align === "center"
						? rect.x + (rect.w - w) / 2
						: options.align === "right"
						? rect.x + rect.w - pad - w
						: startX
				rects.push(this.box(x, cursorY, w, h))
				cursorY += h + gap
			})

			return rects
		},

		/**
		 * Overlay layout: place items over a common surface.
		 */
		overlay(rect, items = [], options = {}) {
			const pad = options.padding || 0
			return (Array.isArray(items) ? items : []).map((item) => {
				const w = Number(item?.w ?? item?.width ?? rect.w) || rect.w
				const h = Number(item?.h ?? item?.height ?? rect.h) || rect.h
				const x =
					options.align === "right"
						? rect.x + rect.w - pad - w
						: options.align === "center"
						? rect.x + (rect.w - w) / 2
						: rect.x + pad
				const y =
					options.valign === "bottom"
						? rect.y + rect.h - pad - h
						: options.valign === "middle"
						? rect.y + (rect.h - h) / 2
						: rect.y + pad
				return this.box(x, y, w, h)
			})
		},

		/**
		 * Anchor system: attach a child rect to a container edge/corner.
		 */
		anchor(rect, childW, childH, edge = "tl", pad = 0) {
			return this.align(this.inset(rect, pad), childW, childH, edge)
		},
	}

	/**
	 * HUD.Animation: Lightweight ticker-based animation.
	 * Step 7: Animation
	 */
	window.SystemDeckPixiHUD.Animation = {
		_tweens: [],

		/**
		 * Attach a function to the PIXI ticker.
		 */
		tickerAttach(app, fn) {
			if (!app || !app.ticker) return
			app.ticker.add(fn)
		},

		/**
		 * Smoothly animate properties of a target object.
		 */
		animateTo(target, props, duration = 300, easing = "easeInOutQuad") {
			const startProps = {}
			for (const key in props) {
				startProps[key] = target[key]
			}

			const startTime = performance.now()
			const tween = {
				target,
				startProps,
				endProps: props,
				duration,
				startTime,
				active: true,
			}

			this._tweens.push(tween)
			return tween
		},

		/**
		 * Simple fade helper.
		 */
		fade(target, to, duration = 300) {
			return this.animateTo(target, { alpha: to }, duration)
		},

		/**
		 * Simple pulse helper.
		 */
		pulse(target, intensity = 0.1, duration = 1000) {
			const originalScale = target.scale.x
			const targetScale = originalScale + intensity

			// Note: Pulse is often recursive or repetitive,
			// for now we provide a single sweep foundation.
			return this.animateTo(
				target,
				{
					scale: { x: targetScale, y: targetScale },
				},
				duration / 2,
			)
		},

		/**
		 * Update all active tweens (to be called from engine ticker).
		 */
		update(now) {
			this._tweens = this._tweens.filter((t) => t.active)
			for (const t of this._tweens) {
				if (!t.target || t.target.destroyed) {
					t.active = false
					continue
				}
				const elapsed = now - t.startTime
				const progress = Math.min(elapsed / t.duration, 1)

				// Standard easeInOutQuad
				const ease =
					progress < 0.5
						? 2 * progress * progress
						: 1 - Math.pow(-2 * progress + 2, 2) / 2

				for (const key in t.endProps) {
					const start = t.startProps[key]
					const end = t.endProps[key]

					if (typeof end === "object") {
						for (const subKey in end) {
							t.target[key][subKey] =
								start[subKey] +
								(end[subKey] - start[subKey]) * ease
						}
					} else {
						t.target[key] = start + (end - start) * ease
					}
				}
				if (progress >= 1) t.active = false
			}
		},
	}

	/**
	 * HUD.Interaction: Shared interaction and state helpers.
	 * Step 8: Interaction
	 */
	window.SystemDeckPixiHUD.Interaction = {
		register(target, handlers = {}) {
			target.eventMode = "static"
			target.interactive = true
			target.cursor = "pointer"
			if (handlers.onHover) {
				target.on("pointerover", (e) => handlers.onHover(e, true))
				target.on("pointerout", (e) => handlers.onHover(e, false))
			}
			if (handlers.onClick) {
				target.on("pointertap", (e) => handlers.onClick(e))
			}
			if (handlers.onPress) {
				target.on("pointerdown", (e) => handlers.onPress(e, true))
				target.on("pointerup", (e) => handlers.onPress(e, false))
				target.on("pointerupoutside", (e) => handlers.onPress(e, false))
			}
		},
		setHover(target, isHovering) {
			if (!target) return
			window.SystemDeckPixiHUD.Feedback.apply(target, {
				hovered: isHovering,
				alpha: isHovering ? 1 : 0.85,
			})
			window.SystemDeckPixiHUD.Animation.fade(
				target,
				isHovering ? 1 : 0.85,
				150,
			)
		},
		setActive(target, isActive) {
			if (!target) return
			window.SystemDeckPixiHUD.Feedback.apply(target, {
				active: isActive,
			})
		},
		apply(target, state = {}, palette = null) {
			return window.SystemDeckPixiHUD.Feedback.apply(
				target,
				state,
				palette,
			)
		},
	}

	/**
	 * HUD.Components: Stateful, reusable UI elements.
	 * Step 9: Components
	 */
	window.SystemDeckPixiHUD.Components = {
		_registry: {},

		register(name, factory) {
			if (!name || typeof factory !== "function") {
				return null
			}
			if (this._registry[name] || this[name]) {
				throw new Error(
					`SystemDeckPixiHUD.Components.register(): component "${name}" already exists.`,
				)
			}
			const lockedFactory = Object.freeze(factory)
			this._registry[name] = lockedFactory
			this[name] = lockedFactory
			return lockedFactory
		},

		get(name) {
			return this[name] || this._registry[name] || null
		},

		ClockFace(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const shadow = new PIXI.Graphics()
			const face = new PIXI.Graphics()
			const ring = new PIXI.Graphics()
			const ticks = new PIXI.Graphics()
			const innerDial = new PIXI.Graphics()
			const hourHand = new PIXI.Graphics()
			const minuteHand = new PIXI.Graphics()
			const secondHand = new PIXI.Graphics()
			const centerCap = new PIXI.Graphics()

			container.addChild(shadow)
			container.addChild(face)
			container.addChild(ring)
			container.addChild(ticks)
			container.addChild(innerDial)
			container.addChild(hourHand)
			container.addChild(minuteHand)
			container.addChild(secondHand)
			container.addChild(centerCap)

			const drawHand = (
				graphics,
				cx,
				cy,
				angle,
				length,
				width,
				color,
				alpha,
			) => {
				const tail = Math.max(4, length * 0.12)
				if (!graphics || graphics.destroyed) return
				graphics.clear()
				graphics.moveTo(
					cx - Math.cos(angle) * tail,
					cy - Math.sin(angle) * tail,
				)
				graphics.lineTo(
					cx + Math.cos(angle) * length,
					cy + Math.sin(angle) * length,
				)
				graphics.stroke({
					width,
					color,
					alpha,
					cap: "round",
				})
			}

			container.render = function renderClockFace(state = {}) {
				const palette = state.palette || HUD.Theme.getColors()
				const cx = Number(state.cx || 0)
				const cy = Number(state.cy || 0)
				const radius = Number(state.radius || 0)
				const date =
					state.date instanceof Date ? state.date : new Date()
				if (!radius) return

				const ringColor =
					palette.ring || palette.primary || palette.server
				const tickColor =
					palette.tick || palette.primary || palette.server
				const hourColor =
					palette.hour || palette.primaryStrong || palette.server
				const minuteColor =
					palette.minute || palette.primary || palette.server
				const secondColor =
					palette.second || palette.notification || palette.warning
				const capColor = palette.cap || palette.panel || 0xffffff
				const shadowColor = palette.shadowColor || 0x000000
				const faceColor =
					palette.panel || palette.presetWhite || 0xffffff
				const innerDialColor =
					palette.borderSubtle || palette.logo || palette.tick

				if (!shadow || shadow.destroyed) return
				shadow.clear()
				shadow.circle(cx, cy + Math.max(3, radius * 0.035), radius)
				shadow.fill({
					color: shadowColor,
					alpha: 0.1,
				})

				if (!face || face.destroyed) return
				face.clear()
				face.circle(cx, cy, radius * 0.97)
				face.fill({
					color: faceColor,
					alpha: 0.9,
				})

				if (!ring || ring.destroyed) return
				ring.clear()
				ring.circle(cx, cy, radius)
				ring.stroke({
					width: Math.max(2.5, radius * 0.05),
					color: ringColor,
					alpha: 0.9,
				})

				if (!ticks || ticks.destroyed) return
				ticks.clear()
				for (let index = 0; index < 60; index += 1) {
					const angle = -Math.PI / 2 + (index / 60) * Math.PI * 2
					const isMajor = index % 5 === 0
					const innerRadius = radius * (isMajor ? 0.72 : 0.81)
					const outerRadius = radius * 0.95

					ticks.moveTo(
						cx + Math.cos(angle) * innerRadius,
						cy + Math.sin(angle) * innerRadius,
					)
					ticks.lineTo(
						cx + Math.cos(angle) * outerRadius,
						cy + Math.sin(angle) * outerRadius,
					)
					ticks.stroke({
						width: isMajor
							? Math.max(2.3, radius * 0.034)
							: Math.max(1.1, radius * 0.011),
						color: tickColor,
						alpha: isMajor ? 0.76 : 0.32,
						cap: "round",
					})
				}

				if (!innerDial || innerDial.destroyed) return
				innerDial.clear()
				innerDial.circle(cx, cy, radius * 0.32)
				innerDial.fill({
					color: innerDialColor,
					alpha: 0.08,
				})
				innerDial.stroke({
					width: Math.max(1, radius * 0.018),
					color: innerDialColor,
					alpha: 0.18,
				})
				innerDial.circle(cx, cy, radius * 0.2)
				innerDial.stroke({
					width: Math.max(1, radius * 0.014),
					color: innerDialColor,
					alpha: 0.16,
				})
				for (let index = 0; index < 12; index += 1) {
					const angle = -Math.PI / 2 + (index / 12) * Math.PI * 2
					const innerTickRadius = radius * 0.23
					const outerTickRadius = radius * 0.3
					innerDial.moveTo(
						cx + Math.cos(angle) * innerTickRadius,
						cy + Math.sin(angle) * innerTickRadius,
					)
					innerDial.lineTo(
						cx + Math.cos(angle) * outerTickRadius,
						cy + Math.sin(angle) * outerTickRadius,
					)
					innerDial.stroke({
						width: Math.max(1, radius * 0.01),
						color: innerDialColor,
						alpha: 0.14,
						cap: "round",
					})
				}

				const seconds =
					date.getSeconds() + date.getMilliseconds() / 1000
				const minutes = date.getMinutes() + seconds / 60
				const hours = (date.getHours() % 12) + minutes / 60

				drawHand(
					hourHand,
					cx,
					cy,
					(hours / 12) * Math.PI * 2 - Math.PI / 2,
					radius * 0.46,
					Math.max(4.5, radius * 0.068),
					hourColor,
					0.98,
				)

				drawHand(
					minuteHand,
					cx,
					cy,
					(minutes / 60) * Math.PI * 2 - Math.PI / 2,
					radius * 0.68,
					Math.max(3.5, radius * 0.044),
					minuteColor,
					0.96,
				)

				drawHand(
					secondHand,
					cx,
					cy,
					(seconds / 60) * Math.PI * 2 - Math.PI / 2,
					radius * 0.8,
					Math.max(1.75, radius * 0.02),
					secondColor,
					0.98,
				)

				secondHand.circle(
					cx,
					cy - radius * 0.54,
					Math.max(2, radius * 0.03),
				)
				secondHand.fill({ color: secondColor, alpha: 0.9 })

				if (!centerCap || centerCap.destroyed) return
				centerCap.clear()
				centerCap.circle(cx, cy, Math.max(4, radius * 0.06))
				centerCap.fill({ color: capColor, alpha: 1 })
				centerCap.stroke({
					width: Math.max(1, radius * 0.018),
					color: ringColor,
					alpha: 0.8,
				})
			}
			return container
		},

		DigitalReadout(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const panel = new PIXI.Graphics()
			const panelFx = new PIXI.Graphics()

			const text = HUD.Typography.create("value", "00:00:00", {
				align: "center",
				roundPixels: true,
			})

			const labels = ["HR", "MIN", "SEC"].map((label) =>
				HUD.Typography.create("small", label, {
					align: "center",
					roundPixels: true,
				}),
			)

			container.addChild(panel)
			container.addChild(panelFx)
			container.addChild(text)
			labels.forEach((label) => container.addChild(label))

			container.render = function renderDigitalReadout(state = {}) {
				const palette = state.palette || HUD.Theme.getColors()
				const x = Number(state.x || 0)
				const y = Number(state.y || 0)
				const width = Number(state.width || 0)
				const height = Number(state.height || 0)
				const fontScale = Number(state.fontScale || 0.66)
				const labelFontScale = Number(state.labelFontScale || 0.16)
				const paddingX = Number(state.paddingX || 10)
				const paddingTop = Number(state.paddingTop || 6)
				const paddingBottom = Number(state.paddingBottom || 6)
				const labelGap = Number(state.labelGap || 2)
				const value = String(state.value || "00:00:00")

				if (!width || !height) return

				const innerWidth = Math.max(0, width - paddingX * 2)
				const labelFontSize = Math.max(6, height * labelFontScale)
				const labelBandHeight = labelFontSize + labelGap
				const textHeight = Math.max(
					12,
					height - paddingTop - paddingBottom - labelBandHeight,
				)

				text.text = value
				text.style.fill = palette.digitalText
				text.style.fontSize = Math.max(14, textHeight * fontScale)
				text.style.fontWeight = "700"
				text.style.letterSpacing = Math.max(0.25, innerWidth * 0.004)

				if (!panel || panel.destroyed) return
				panel.clear()
				if (!panelFx || panelFx.destroyed) return
				panelFx.clear()

				// subtle lift only
				panel.roundRect(x + 1, y + 2, width, height, 4)
				panel.fill({
					color: palette.shadowColor || 0x000000,
					alpha: 0.04,
				})

				// main surface
				panel.roundRect(x, y, width, height, 4)
				panel.fill({
					color: palette.inset || palette.panelSoft || 0xf6f7f7,
					alpha: 1,
				})

				// keep border as requested
				panel.stroke({ width: 1.5, color: palette.ring, alpha: 1 })

				// restrained inner surface separation
				panelFx.roundRect(
					x + 1,
					y + 1,
					Math.max(0, width - 2),
					Math.max(0, height - 2),
					3,
				)
				panelFx.stroke({
					width: 1,
					color:
						palette.borderSubtle ||
						palette.ringSoft ||
						palette.border,
					alpha: 0.24,
				})

				// very subtle top plane, not glossy
				panelFx.roundRect(
					x + 2,
					y + 2,
					Math.max(0, width - 4),
					Math.max(0, height * 0.3),
					2,
				)
				panelFx.fill({
					color: palette.presetWhite || palette.panel,
					alpha: 0.04,
				})

				text.x = x + width / 2
				text.y = y + paddingTop + textHeight / 2

				labels.forEach((label, index) => {
					label.style.fill = palette.ringSoft
					label.style.fontSize = labelFontSize
					label.style.fontWeight = "700"
					label.x =
						x +
						width * (index === 0 ? 0.28 : index === 1 ? 0.5 : 0.72)
					label.y =
						y +
						height -
						Math.max(1, paddingBottom * 0.5) -
						labelBandHeight / 2
				})
			}

			Object.defineProperty(container, "textObject", {
				value: text,
				enumerable: false,
			})

			return container
		},

		/**
		 * Button: Config-driven interactive button.
		 */
		Button(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const interaction = HUD.Interaction
			const spacing = HUD.Spacing || {}
			container._hudNoScale = true

			let state = {
				width: config.width || 120,
				height:
					config.height ||
					Math.max(spacing.control?.buttonHeight || 28, 28),
				label: config.label || "Action",
				icon: config.icon || null,
				tone: config.tone || "primary",
				variant: config.variant || "outline",
				iconPosition: config.iconPosition || "left",
				fill: config.fill ?? null,
				stroke: config.stroke ?? null,
				textColor: config.textColor ?? null,
				paddingX: config.paddingX ?? 10,
				paddingY: config.paddingY ?? 6,
				gap: config.gap ?? 4,
				radius: config.radius ?? 4,
				strokeWidth: config.strokeWidth ?? 1,
				strokeAlpha: config.strokeAlpha ?? 1,
				iconOffsetY: config.iconOffsetY ?? 0,
				loading: !!config.loading,
				disabled: !!config.disabled,
				hovered: false,
				pressed: false,
				palette: config.palette || null,
			}

			const frame = new PIXI.Graphics()
			const activeRing = new PIXI.Graphics()
			const iconLayer = new PIXI.Container()
			let iconObj = null
			let spinnerObj = null
			let iconSignature = ""
			let spinTarget = null
			const labelText = HUD.Typography.create("label", "", {
				fontWeight: "500",
				palette: state.palette,
			})
			container.addChild(frame, activeRing, iconLayer, labelText)

			function resolveColors() {
				const theme =
					state.palette || config.palette || HUD.Theme.createPalette()
				const utils = HUD.Utils
				const toneBase = HUD.Theme.getToneColor(
					state.tone,
					"base",
					theme,
					theme.buttonColor || theme.primary,
				)
				const toneSoft = HUD.Theme.getToneColor(
					state.tone,
					"soft",
					theme,
					toneBase,
				)
				const toneStrong = HUD.Theme.getToneColor(
					state.tone,
					"strong",
					theme,
					toneBase,
				)
				const isOutline = state.variant === "outline"
				const isSubtle = state.variant === "subtle"
				const fill = state.fill
				const white = theme.presetWhite || theme.panel || 0xffffff
				const outlineActiveColor = utils.lerpColor(
					toneBase,
					theme.text || 0x1e1e1e,
					0.2,
				)
				const outlineHoverFill = utils.lerpColor(white, toneBase, 0.04)
				const disabledStroke = utils.lerpColor(
					white,
					theme.textMuted || theme.border || 0xdddddd,
					0.2,
				)
				const solidFill =
					fill ||
					(state.pressed
						? theme.buttonColorHover || toneStrong
						: state.hovered
						? theme.buttonColorHover || toneSoft
						: toneBase)

				if (isOutline) {
					if (state.disabled) {
						return {
							fill: fill || white,
							fillAlpha: 1,
							stroke: state.stroke || disabledStroke,
							text:
								state.textColor || theme.textMuted || 0x949494,
						}
					}

					if (state.pressed) {
						return {
							fill: fill || outlineHoverFill,
							fillAlpha: 1,
							stroke: state.stroke || outlineActiveColor,
							text: state.textColor || outlineActiveColor,
						}
					}

					return {
						fill:
							fill || (state.hovered ? outlineHoverFill : white),
						fillAlpha: 1,
						stroke:
							state.stroke ||
							(state.hovered
								? outlineActiveColor
								: theme.buttonColor || toneBase),
						text:
							state.textColor ||
							(state.hovered
								? outlineActiveColor
								: theme.buttonColor || toneBase),
					}
				}

				if (isSubtle) {
					return {
						fill:
							fill ||
							(state.hovered ? theme.panel : theme.panelSoft),
						fillAlpha: 1,
						stroke:
							state.stroke ||
							(state.hovered ? toneBase : theme.border),
						text: state.textColor || theme.buttonColor || toneBase,
					}
				}

				return {
					fill: solidFill,
					fillAlpha: state.disabled ? 0.5 : 1,
					stroke:
						state.stroke ||
						(state.hovered || state.pressed
							? theme.buttonColorHover || toneStrong
							: theme.buttonColor || toneBase),
					strokeAlpha: state.strokeAlpha,
					text:
						state.textColor ||
						theme.btnPrimaryText ||
						HUD.Utils.readableTextColor(
							solidFill,
							theme.panel,
							theme.text,
						),
				}
			}

			function render() {
				if (!container || container.destroyed) return
				const colors = resolveColors()

				frame.clear()
				frame.roundRect(0, 0, state.width, state.height, state.radius).fill({
					color: colors.fill,
					alpha: colors.fillAlpha ?? 1,
				})
				frame
					.roundRect(0, 0, state.width, state.height, state.radius)
					.stroke({
						width: state.strokeWidth,
						color: colors.stroke,
						alpha: state.strokeAlpha ?? 1,
						pixelLine: true,
					})

				activeRing.clear()
				if (state.pressed) {
					activeRing
						.roundRect(
							-2,
							-2,
							state.width + 4,
							state.height + 4,
							state.radius + 1,
						)
						.stroke({
							width: 2,
							color: colors.stroke || colors.fill,
							alpha: 1,
							pixelLine: true,
						})
				}

				const iconSize = Math.round(state.height * 0.48)
				const nextSignature = state.loading
					? `spinner:${iconSize}:${colors.text}`
					: state.icon
					? `icon:${state.icon}:${iconSize}:${colors.text}`
					: ""
				if (iconSignature !== nextSignature) {
					if (iconObj && iconObj !== spinnerObj) {
						console.warn(
							"[HUD destructive render]",
							"Button",
							"render:iconSwapDestroy",
						)
						iconObj.destroy?.()
					}
					iconObj = null
					if (state.loading) {
						if (!spinnerObj || !spinnerObj.root || spinnerObj.root.destroyed) {
							spinnerObj = HUD.Components.Spinner({
								size: iconSize,
								color: colors.text,
								variant: "border",
								palette: state.palette,
							})
						} else {
							spinnerObj.setState?.({
								size: iconSize,
								color: colors.text,
								palette: state.palette,
							})
						}
						iconObj = spinnerObj
					} else if (state.icon) {
						iconObj = HUD.Icon.create(state.icon, {
							size: iconSize,
							color: colors.text,
							palette: state.palette,
						})
					}
					iconSignature = nextSignature
				}

				iconLayer.children.forEach((node) => {
					node.visible = false
				})
				if (iconObj?.root && !iconObj.root.destroyed) {
					if (state.loading && spinnerObj?.setState) {
						spinnerObj.setState({
							size: iconSize,
							color: colors.text,
							palette: state.palette,
						})
					}
					if (iconObj.root.parent !== iconLayer) iconLayer.addChild(iconObj.root)
					iconObj.root.visible = true
				}

				labelText.text = String(state.label || "").toUpperCase()
				labelText.style.fill = colors.text
				labelText.style.fontSize = 14
				labelText.style.fontWeight = "500"

				if (iconObj?.root && iconObj.root.parent === iconLayer) {
					const gap = Math.max(6, state.gap - 2)
					const innerW = Math.max(0, state.width - state.paddingX * 2)
					HUD.Utils.fitText(
						labelText,
						Math.max(0, innerW - (iconObj.root.width || 0) - gap),
					)
					const contentW =
						(iconObj.root.width || 0) + gap + labelText.width
					const startX = Math.round(
						state.paddingX + Math.max(0, (innerW - contentW) / 2),
					)
					const iconY =
						Math.round((state.height - (iconObj.root.height || 0)) / 2) +
						state.iconOffsetY
					const labelY = Math.round(
						(state.height - labelText.height) / 2,
					)

					if (state.iconPosition === "right") {
						labelText.position.set(startX, labelY)
						iconObj.root.position.set(
							Math.round(startX + labelText.width + gap),
							iconY,
						)
					} else {
						iconObj.root.position.set(startX, iconY)
						labelText.position.set(
							Math.round(startX + (iconObj.root.width || 0) + gap),
							labelY,
						)
					}
					spinTarget =
						state.loading
							? null
							: iconObj.root?.children?.[0] || iconObj.root || null
				} else {
					spinTarget = null
					layout.centerIn(
						layout.inset(
							layout.box(0, 0, state.width, state.height),
							{
								t: state.paddingY,
								r: state.paddingX,
								b: state.paddingY,
								l: state.paddingX,
							},
						),
						labelText,
					)
				}

				container.alpha = state.disabled ? 0.6 : 1
			}

			interaction.register(container, {
				onHover: (_e, hover) => {
					state.hovered = hover
					interaction.setHover(container, hover)
					render()
				},
				onPress: (_e, down) => {
					state.pressed = down
					interaction.setActive(container, down)
					render()
				},
				onClick: () => {
					if (
						!state.disabled &&
						typeof config.onClick === "function"
					) {
						config.onClick()
					}
				},
			})

			render()

			return {
				root: container,
				render,
				get spinTarget() {
					return spinTarget
				},
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setLabel: (text) => {
					state.label = text
					render()
				},
				setIcon: (name) => {
					state.icon = name
					render()
				},
				setSize: (w, h) => {
					state.width = w
					state.height = h
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					if (d.label) state.label = d.label
					if (d.icon) state.icon = d.icon
					if ("loading" in d) state.loading = !!d.loading
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					if (window.SYSTEMDECK_DEBUG_PIXI_LIFECYCLE) {
						console.warn("[HUD destructive render]", "Button", "destroy")
					}
					iconObj = null
					spinnerObj = null
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * IconButton: Compact button with an icon.
		 */
		IconButton(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const interaction = HUD.Interaction
			const layout = HUD.Layout
			const primitives = HUD.Primitives
			const spacing = HUD.Spacing || {}
			container._hudNoScale = true

			let state = {
				size:
					config.size ||
					Math.max(spacing.control?.iconButtonSize || 28, 28),
				icon: config.icon || "admin-generic",
				tone: config.tone || "primary",
				variant: config.variant || "outline", // solid | round | subtle | outline
				radius: config.radius ?? 4,
				padding: config.padding ?? 6,
				iconOffsetY: config.iconOffsetY ?? 0,
				disabled: !!config.disabled,
				hovered: false,
				pressed: false,
				palette: config.palette || null,
			}

			let frame = null
			let iconObj = null
			let activeRing = null
			let spinTarget = null

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				const utils = HUD.Utils
				const toneBase =
					state.tone === "primary"
						? palette.buttonColor || palette.primary
						: palette[state.tone] || palette.primary
				const toneHover =
					state.tone === "primary"
						? palette.buttonColorHover ||
						  palette.buttonColor ||
						  toneBase
						: palette[`${state.tone}Soft`] || toneBase
				const toneStrong =
					state.tone === "primary"
						? palette.buttonColorHover ||
						  palette.buttonColor ||
						  toneBase
						: palette[`${state.tone}Strong`] || toneBase
				const white = palette.presetWhite || palette.panel || 0xffffff
				const outlineActiveColor = utils.lerpColor(
					toneBase,
					palette.text || 0x1e1e1e,
					0.2,
				)
				const hoverFill = utils.lerpColor(white, toneBase, 0.04)
				const disabledStroke = utils.lerpColor(
					white,
					palette.textMuted || palette.border || 0xdddddd,
					0.2,
				)

					if (frame) {
						console.warn("[HUD destructive render]", "IconButton", "render:frameDestroy")
						container.removeChild(frame)
						frame.destroy()
					}
					if (iconObj) {
						console.warn("[HUD destructive render]", "IconButton", "render:iconDestroy")
						container.removeChild(iconObj.root)
						iconObj.destroy()
						iconObj = null
					}
					if (activeRing) {
						console.warn("[HUD destructive render]", "IconButton", "render:activeRingDestroy")
						container.removeChild(activeRing)
						activeRing.destroy()
						activeRing = null
				}

				frame = primitives.ButtonFrame({
					width: state.size,
					height: state.size,
					radius:
						state.variant === "round"
							? state.size / 2
							: state.radius,
					fill:
						state.variant === "outline"
							? state.disabled
								? white
								: state.pressed
								? hoverFill
								: state.hovered
								? hoverFill
								: white
							: state.variant === "subtle"
							? state.hovered
								? palette.panel
								: palette.panelSoft
							: state.pressed
							? toneStrong
							: state.hovered
							? toneHover
							: toneBase,
					alpha: state.disabled ? 0.5 : 1,
					stroke:
						state.variant === "outline"
							? state.disabled
								? disabledStroke
								: state.pressed
								? outlineActiveColor
								: state.hovered
								? outlineActiveColor
								: palette.buttonColor || toneBase
							: state.variant === "subtle"
							? state.hovered
								? toneBase
								: palette.border
							: state.pressed
							? toneStrong
							: state.hovered
							? toneHover
							: toneBase,
					strokeWidth: state.variant === "outline" ? 1 : 1,
					strokeAlpha: 1,
					pixelLine: true,
					palette: state.palette,
					fromTheme: true,
				})

				if (state.pressed) {
					activeRing = primitives.ButtonFrame({
						width: state.size + 4,
						height: state.size + 4,
						fill: palette.panel || toneBase,
						alpha: 0,
						stroke: palette.buttonColorHover || toneHover,
						strokeWidth: 2,
						strokeAlpha: 1,
						radius:
							state.variant === "round"
								? state.size / 2 + 1
								: state.radius + 1,
						pixelLine: true,
						palette: state.palette,
						fromTheme: true,
					})
					activeRing.position.set(-2, -2)
					container.addChild(activeRing)
				}

				iconObj = HUD.Icon.create(state.icon, {
					size: Math.round(state.size * 0.48),
					color:
						state.variant === "outline" ||
						state.variant === "subtle"
							? state.disabled
								? palette.textMuted || 0x949494
								: state.pressed
								? outlineActiveColor
								: state.hovered
								? outlineActiveColor
								: palette.buttonColor || palette.text
							: palette.btnPrimaryText ||
							  HUD.Utils.readableTextColor(
									toneBase,
									palette.panel,
									palette.text,
							  ),
					palette: state.palette,
				})

				container.addChild(frame, iconObj.root)
				const inset = layout.inset(
					layout.box(0, 0, state.size, state.size),
					{
						t: state.padding,
						r: state.padding,
						b: state.padding,
						l: state.padding,
					},
				)
				const iconBounds = iconObj.root.getLocalBounds()
				iconObj.root.position.set(
					Math.round(
						inset.x +
							(inset.w - iconBounds.width) / 2 -
							iconBounds.x,
					),
					Math.round(
						inset.y +
							(inset.h - iconBounds.height) / 2 -
							iconBounds.y +
							state.iconOffsetY,
					),
				)
				iconObj.root.__hudLayoutBound = true
				spinTarget = iconObj.root?.children?.[0] || iconObj.root || null

				container.alpha = state.disabled ? 0.6 : 1
			}

			interaction.register(container, {
				onHover: (_e, hover) => {
					state.hovered = hover
					interaction.setHover(container, hover)
					render()
				},
				onPress: (_e, down) => {
					state.pressed = down
					interaction.setActive(container, down)
					render()
				},
				onClick: () => {
					if (
						!state.disabled &&
						typeof config.onClick === "function"
					) {
						config.onClick()
					}
				},
			})

			render()

			return {
				root: container,
				render,
				get spinTarget() {
					return spinTarget
				},
				resize: (size) => {
					state.size = size || state.size
					render()
				},
				setIcon: (name) => {
					state.icon = name
					render()
				},
				setSize: (size) => {
					state.size = size
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					if (d.icon) state.icon = d.icon
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Spinner: Bootstrap-style loading indicator.
		 */
		Spinner(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const track = new PIXI.Graphics()
			const headLayer = new PIXI.Container()
			const head = new PIXI.Graphics()
			const grow = new PIXI.Graphics()
			headLayer.addChild(head)
			container.addChild(track, headLayer, grow)

			let rafId = null
			let state = {
				size: config.size || 16,
				color: config.color ?? null,
				strokeWidth: config.strokeWidth ?? null,
				speed: config.speed || 750,
				variant: config.variant || "border",
				palette: config.palette || null,
			}

			function stop() {
				if (rafId !== null) {
					cancelAnimationFrame(rafId)
					rafId = null
				}
			}

			function render(now = performance.now()) {
				const palette = state.palette || HUD.Theme.createPalette()
				const color =
					state.color ||
					palette.buttonColor ||
					palette.primary ||
					0x0d6efd
				const size = Math.max(8, Number(state.size) || 16)
				const radius = size / 2
				const strokeWidth =
					state.strokeWidth ??
					Math.max(1.5, Math.round(size * 0.1 * 10) / 10)
				const phase = (now % state.speed) / state.speed

				if (!track || track.destroyed) return
				track.clear()
				if (!head || head.destroyed) return
				head.clear()
				if (!grow || grow.destroyed) return
				grow.clear()
				track.visible = state.variant !== "grow"
				headLayer.visible = state.variant !== "grow"
				grow.visible = state.variant === "grow"

				if (state.variant === "grow") {
					const scale = Math.max(0, Math.min(1, phase))
					const alpha = 1 - scale
					grow.circle(radius, radius, radius * scale).fill({
						color,
						alpha: alpha * 0.9,
					})
					headLayer.rotation = 0
				} else {
					const ringRadius = radius - strokeWidth / 2
					track.circle(radius, radius, ringRadius).stroke({
						width: strokeWidth,
						color,
						alpha: 0.22,
					})
					head.arc(
						0,
						0,
						ringRadius,
						-Math.PI / 2,
						-Math.PI / 2 + Math.PI * 0.55,
					).stroke({
						width: strokeWidth,
						color,
						alpha: 1,
						cap: "round",
					})
					headLayer.position.set(radius, radius)
					headLayer.rotation = phase * Math.PI * 2
				}

				container._width = size
				container._height = size
			}

			let destroyed = false
			function start() {
				if (!container || container.destroyed) return
				stop()
				const tick = (now) => {
					if (!container || container.destroyed) return
					render(now)
					rafId = requestAnimationFrame(tick)
				}
				rafId = requestAnimationFrame(tick)
			}

			render()
			start()

			return {
				root: container,
				render,
				resize: (size) => {
					state.size = size || state.size
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
					start()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
					start()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					{
					}
					if (!container || container.destroyed) return
					
					stop()
					if (container && !container.destroyed) {
						container.destroy({ children: true })
					}
				},
			}
		},

		/**
		 * Badge: Small status indicator pill.
		 */
		Badge(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const utils = HUD.Utils

			let state = {
				label: config.label || "STATUS",
				color: config.color || null,
				height: config.height || spacing.control?.badgeHeight || 20,
				paddingX: config.paddingX ?? spacing.inset?.badgeX ?? 12,
				paddingY: config.paddingY ?? spacing.inset?.badgeY ?? 4,
				radius: config.radius ?? spacing.radius?.badge ?? 999,
				palette: config.palette || null,
				fill: config.fill || null,
				fillAlpha: config.fillAlpha,
				strokeAlpha: config.strokeAlpha,
			}

			let frame = null
			const text = HUD.Typography.create("small", "", {
				fontSize: 10,
				fontWeight: "800",
			})
			HUD.Theme.assertThemeTokenUsage(config.color, "badge color")

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				const color =
					state.color ||
					palette.accent ||
					palette.notification ||
					palette.secondaryStrong ||
					palette.secondary ||
					palette.primary
				const fillColor =
					state.fill ||
					palette.presetWhite ||
					palette.white ||
					palette.panel
				const tintFill = utils.lerpColor(fillColor, color, 0.04)

					if (frame) {
						console.warn("[HUD destructive render]", "Badge", "render:frameDestroy")
						if (frame.parent === container) container.removeChild(frame)
						frame.destroy()
					}

				text.text = String(state.label).toUpperCase()
				text.style.fill = color

				const w = Math.max(
					state.height * 2,
					text.width + state.paddingX * 2,
				)
				frame = primitives.BadgeFrame({
					width: w,
					height: state.height,
					fill: tintFill,
					stroke: color,
					radius: state.radius,
					fillAlpha: state.fillAlpha ?? 1,
					strokeAlpha: state.strokeAlpha ?? 1,
					fromTheme: true,
					palette: state.palette,
				})

				container.addChildAt(frame, 0)
				if (text.parent !== container) container.addChild(text)

				layout.centerIn(
					layout.box(
						0,
						state.paddingY,
						w,
						Math.max(0, state.height - state.paddingY * 2),
					),
					text,
				)
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					if (d.label) state.label = d.label
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * SectionHeader: Standardized section labels with optional divider.
		 */
		SectionHeader(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}

			let state = {
				text: config.text || "SECTION",
				width: config.width || 200,
				showDivider: config.showDivider !== false,
				titleColor: config.titleColor || null,
				subtitleColor: config.subtitleColor || null,
				palette: config.palette || null,
			}

			const title = HUD.Typography.create("section", state.text, {
				palette: state.palette,
			})
			const divider = new PIXI.Graphics()
			container.addChild(title, divider)

			function render() {
				if (!container || container.destroyed) return
				const currentPalette =
					state.palette || HUD.Theme.createPalette()

				title.text = String(state.text).toUpperCase()
				title.style.fill = currentPalette.text

				if (!divider || divider.destroyed) return
				divider.clear()
				if (state.showDivider) {
					const dividerY = spacing.header?.dividerY || 24
					divider
						.moveTo(0, dividerY)
						.lineTo(state.width, dividerY)
						.stroke({
							width: 1,
							color: currentPalette.gridStrong,
							alpha: 0.15,
							pixelLine: true,
						})
				}
			}

			function resize(w) {
				state.width = w || state.width
				render()
			}

			render()

			return {
				root: container,
				render,
				resize,
				setData: (d) => {
					if (d.text) state.text = d.text
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Panel: Standardized UI container with variants.
		 */
		Panel(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 220,
				height: config.height || 120,
				padding: config.padding ?? spacing.inset?.panel ?? 12,
				headerHeight:
					config.headerHeight ?? spacing.header?.height ?? 38,
				titleGap: config.titleGap ?? spacing.header?.titleGap ?? 18,
				variant: config.variant || "default", // default | soft | inset | elevated
				title: config.title || "",
				subtitle: config.subtitle || "",
			}

			const frame = new PIXI.Graphics()
			const header = new PIXI.Container()
			const content = new PIXI.Container()
			const titleText = HUD.Typography.create("title", "", {
				fontSize: 13,
				palette: config.palette,
			})
			const subtitleText = HUD.Typography.create("small", "", {
				palette: config.palette,
			})
			header.addChild(titleText, subtitleText)
			container.addChild(frame, header, content)

			function resolveStyles() {
				const palette = state.palette || HUD.Theme.createPalette()
				const styles = {
					default: {
						fill: palette.panel,
						alpha: 1,
						stroke: palette.border,
						strokeAlpha: 0.4,
					},
					soft: {
						fill: palette.panelSoft,
						alpha: 0.8,
						stroke: palette.border,
						strokeAlpha: 0.2,
					},
					inset: {
						fill: palette.text,
						alpha: 0.05,
						stroke: palette.border,
						strokeAlpha: 0.1,
					},
					elevated: {
						fill: palette.panel,
						alpha: 1,
						stroke: palette.gridStrong,
						strokeAlpha: 0.25,
						shadow: true,
					},
				}
				return styles[state.variant] || styles.default
			}

			function render() {
				if (!container || container.destroyed) return
				const styles = resolveStyles()
				const palette = state.palette || HUD.Theme.createPalette()
				const radius = spacing.radius?.panel ?? 10
				frame.clear()
				frame.roundRect(0, 0, state.width, state.height, radius).fill({
					color: styles.fill,
					alpha: styles.alpha ?? 1,
				})
				frame.roundRect(0, 0, state.width, state.height, radius).stroke({
					width: 1,
					color: styles.stroke,
					alpha: styles.strokeAlpha ?? 1,
					pixelLine: true,
				})

				titleText.text = String(state.title || "")
				titleText.visible = !!state.title
				titleText.style.fill =
					state.titleColor ||
					(state.variant === "soft"
						? palette.btnPrimaryText || 0xffffff
						: HUD.Utils.readableTextColor(
								styles.fill,
								0xffffff,
								palette.text,
						  ))
				titleText.position.set(state.padding, state.padding)

				subtitleText.text = String(state.subtitle || "")
				subtitleText.visible = !!state.subtitle && !!state.title
				subtitleText.style.fill =
					state.subtitleColor ||
					(state.variant === "soft"
						? palette.btnPrimaryText || 0xffffff
						: HUD.Utils.readableTextColor(
								styles.fill,
								0xf0f0f1,
								palette.text,
						  ))
				subtitleText.position.set(
					state.padding,
					state.padding + state.titleGap,
				)

				content.position.set(
					state.padding,
					state.title ? state.headerHeight : state.padding,
				)
			}

			render()

			return {
				root: container,
				content,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setVariant: (v) => {
					state.variant = v
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ChartContainer: Wrapper for data visualizations.
		 */
		ChartContainer(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 300,
				height: config.height || 180,
				padding: config.padding ?? spacing.inset?.chart ?? 16,
			}

			const frame = new PIXI.Graphics()
			const content = new PIXI.Container()
			const mask = new PIXI.Graphics()
			content.mask = mask
			container.addChild(frame, mask, content)

			function render() {
				if (!container || container.destroyed) return
				const palette = HUD.Theme.createPalette()
				const radius = spacing.radius?.chart ?? 4
				frame.clear()
				frame.roundRect(0, 0, state.width, state.height, radius).stroke({
					width: 1,
					color: palette.borderSubtle || palette.border || 0xdcdcde,
					alpha: 1,
					pixelLine: true,
				})

				if (!mask || mask.destroyed) return
				mask.clear()
					.rect(0, 0, state.width, state.height)
					.fill({ color: 0xffffff })

				content.position.set(state.padding, state.padding)
			}

			render()

			return {
				root: container,
				content,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Tooltip: Floating contextual information.
		 */
		Tooltip(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const spacing = HUD.Spacing || {}

			const label = HUD.Typography.create(
				"small",
				config.text || "Tooltip",
				{
					color: HUD.Theme.getSurface("panel", 0xffffff),
				},
			)
			let frame = primitives.Card({
				width: label.width + (spacing.inset?.tooltip || 8) * 2,
				height: label.height + (spacing.inset?.tooltip || 8) * 2,
				fill: HUD.Theme.getColor("text", 0x1d2327),
				fillAlpha: 0.9,
				radius: spacing.radius?.tooltip || 4,
			})

			container.addChild(frame, label)
			label.position.set(
				spacing.inset?.tooltip || 8,
				(spacing.inset?.tooltip || 8) / 2,
			)
			container.visible = false

			return {
				root: container,
				show: (x, y, text) => {
					if (text) {
						label.text = text
							if (frame) {
								console.warn("[HUD destructive render]", "Tooltip", "show:frameDestroy")
								container.removeChild(frame)
								frame.destroy()
							}
						frame = primitives.Card({
							width:
								label.width + (spacing.inset?.tooltip || 8) * 2,
							height:
								label.height +
								(spacing.inset?.tooltip || 8) * 2,
							fill: HUD.Theme.getColor("text", 0x1d2327),
							fillAlpha: 0.9,
							radius: spacing.radius?.tooltip || 4,
						})
						container.addChildAt(frame, 0)
						label.position.set(
							spacing.inset?.tooltip || 8,
							(spacing.inset?.tooltip || 8) / 2,
						)
					}
					container.position.set(x, y)
					container.visible = true
				},
				hide: () => {
					container.visible = false
				},
				render: () => {},
				resize: () => {},
				setData: (d) => {
					if (d.text) label.text = d.text
				},
				setState: (s) => {
					if (s.visible !== undefined) container.visible = s.visible
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * StatusDot: Simple blinking or solid status light.
		 */
		StatusDot(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const g = new PIXI.Graphics()

			let state = {
				status: config.state || "normal",
				size: config.size || 4,
				ringSize: config.ringSize || 6,
				alpha: config.alpha ?? 1,
				palette: config.palette || null,
			}

			function render() {
				if (!g || g.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				const color = palette[state.status] || palette.success

				if (!g || g.destroyed) return
				g.clear()
				g.circle(0, 0, state.size).fill({ color, alpha: state.alpha })
				g.circle(0, 0, state.ringSize).stroke({
					width: 2,
					color,
					alpha: 0.3,
				})
			}

			function resize(size, ringSize) {
				state.size = size || state.size
				state.ringSize =
					ringSize || Math.max(state.size + 2, state.ringSize)
				render()
			}

			function setState(next) {
				if (typeof next === "string") {
					state.status = next
				} else {
					state = { ...state, ...next }
				}
				render()
			}

			render()

			return {
				root: g,
				render,
				resize,
				setState,
				setData: setState,
				destroy: () => {
					if (!g || g.destroyed) return
					
					g.destroy()
				},
			}
		},

		/**
		 * Gauge: Radial dial for single metric visualization.
		 */
		Gauge(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const dial = new PIXI.Container()
			const primitives = HUD.Primitives
			const spacing = HUD.Spacing || {}
			const primitive = spacing.primitive || {}
			const utils = HUD.Utils

			let state = {
				radius: config.radius || 60,
				width: config.width || (config.radius || 60) * 2,
				height: config.height || (config.radius || 60) * 2,
				value: config.value || 0,
				tone: config.tone || "secondary",
				color: config.color || null,
				needleColor: config.needleColor || null,
				trackWidth:
					config.trackWidth || primitive.dialTrackWidth || 3.5,
				trackAlpha:
					config.trackAlpha ?? primitive.dialTrackAlpha ?? 0.42,
				tickWidth: config.tickWidth || primitive.dialTickWidth || 2,
				tickAlpha: config.tickAlpha ?? primitive.dialTickAlpha ?? 0.58,
				tickSize: config.tickSize || primitive.dialTickSize || 6,
				needleWidth:
					config.needleWidth || primitive.dialNeedleWidth || 3,
				min: config.min || 0,
				max: config.max || 1,
				tickCount: config.tickCount || 12,
				needleLength: config.needleLength || null,
				palette: config.palette || null,
			}

			const track = new PIXI.Graphics()
			const needle = new PIXI.Graphics()
			container.addChild(dial)
			dial.addChild(track, needle)

			function syncFootprint() {
				const size = Math.max(
					16,
					Math.round(
						Number.isFinite(state.width) && state.width > 0
							? state.width
							: state.radius * 2,
					),
				)
				const footprint = {
					width: Math.max(size, Math.round(state.radius * 2)),
					height: Math.max(
						Math.round(
							Number.isFinite(state.height) && state.height > 0
								? state.height
								: state.radius * 2,
						),
						Math.round(state.radius * 2),
					),
				}

				state.width = footprint.width
				state.height = footprint.height
				container.hitArea = new PIXI.Rectangle(
					0,
					0,
					footprint.width,
					footprint.height,
				)
				container._width = footprint.width
				container._height = footprint.height
				return footprint
			}

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				const toneStrong =
					palette[`${state.tone}Strong`] ||
					palette[state.tone] ||
					palette.secondaryStrong ||
					palette.secondary
				const color = state.color || palette.primary || toneStrong
				const needleColor =
					state.needleColor ||
					palette.notification ||
					palette.accent ||
					color

				if (!state.radius || state.radius <= 0) return

				syncFootprint()
				dial.position.set(
					Math.round(state.radius),
					Math.round(state.radius),
				)
				track.clear()
				track.circle(0, 0, state.radius).stroke({
					width: state.trackWidth,
					color,
					alpha: state.trackAlpha,
				})
				const tickStep = (Math.PI * 2) / Math.max(1, state.tickCount)
				for (let i = 0; i < state.tickCount; i += 1) {
					const a = i * tickStep
					const inner = state.radius - state.tickSize
					const x1 = Math.cos(a) * inner
					const y1 = Math.sin(a) * inner
					const x2 = Math.cos(a) * state.radius
					const y2 = Math.sin(a) * state.radius
					track.moveTo(x1, y1).lineTo(x2, y2).stroke({
						width: state.tickWidth,
						color,
						alpha: state.tickAlpha,
						pixelLine: true,
					})
				}

				const start = Math.PI * 0.75
				const span = Math.PI * 1.5
				const value = Number.isFinite(state.value) ? state.value : 0
				const normalized = utils.normalizeValue(
					value,
					state.min,
					state.max,
				)
				const angle = start + span * normalized

				const length = state.needleLength || state.radius - 10
				needle.clear()
				needle.moveTo(0, 0).lineTo(Math.cos(angle) * length, Math.sin(angle) * length).stroke({
					width: state.needleWidth,
					color: needleColor,
					alpha: 1,
					cap: "round",
				})
			}

			function resize(w, h) {
				if (arguments.length === 2) {
					state.radius = Math.max(8, Math.min(w, h) / 2)
					state.width = w
					state.height = h
				} else {
					state.radius = w || state.radius
					state.width = state.radius * 2
					state.height = state.radius * 2
				}
				render()
			}

			function setData(next = {}) {
				if (typeof next === "number") {
					state.value = next
				} else {
					if ("value" in next) state.value = next.value
					if ("min" in next) state.min = next.min
					if ("max" in next) state.max = next.max
				}
				render()
			}

			function setState(next = {}) {
				if (typeof next === "string") {
					state.tone = next
				} else {
					state = { ...state, ...next }
				}
				render()
			}

			render()

			return {
				root: container,
				render,
				resize,
				setState,
				setData,
				getBoundsBox: () => ({
					x: 0,
					y: 0,
					w: state.width,
					h: state.height,
					width: state.width,
					height: state.height,
				}),
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Sparkline: Tiny history waveform.
		 */
		Sparkline(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const primitive = spacing.primitive || {}

			let state = {
				width: config.width || 80,
				height: config.height || 30,
				samples: config.samples || [],
				tone: config.tone || "primary",
				color: config.color || null,
				palette: config.palette || null,
				strokeWidth:
					config.strokeWidth ||
					primitive.sparklineStrokeWidth ||
					primitive.sparklineWidth ||
					1.5,
				paddingX: config.paddingX ?? 0,
				paddingY: config.paddingY ?? 0,
			}

			const footprint = new PIXI.Rectangle(0, 0, 0, 0)

			function syncFootprint() {
				const width = Math.max(0, Math.round(state.width || 0))
				const height = Math.max(0, Math.round(state.height || 0))
				state.width = width
				state.height = height
				footprint.width = width
				footprint.height = height
				container._width = width
				container._height = height
				container.hitArea = footprint
			}

			const sparkline = new PIXI.Graphics()
			container.addChild(sparkline)

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				const color =
					state.color || palette[state.tone] || palette.secondary

				syncFootprint()

				if (state.width <= 0 || state.height <= 0) return

				const data = Array.isArray(state.samples) ? state.samples : []
				const points = layout.plotPoints(
					data,
					layout.box(0, 0, state.width, state.height),
					{
						paddingX: state.paddingX,
						paddingY: state.paddingY,
					},
				)
				sparkline.clear()
				if (Array.isArray(points) && points.length > 1) {
					sparkline.moveTo(points[0].x, points[0].y)
					for (let i = 1; i < points.length; i += 1) {
						sparkline.lineTo(points[i].x, points[i].y)
					}
					sparkline.stroke({
						width: state.strokeWidth,
						color,
						alpha: 1,
						cap: "round",
						join: "round",
					})
				}
				syncFootprint()
			}

			render()

			return {
				root: container,
				getBoundsBox: () => footprint.clone(),
				render,
				resize: (width, height) => {
					state.width = width || state.width
					state.height = height || state.height
					render()
				},
				setState: (next = {}) => {
					state = { ...state, ...next }
					render()
				},
				setData: (samples) => {
					state.samples = samples || []
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy()
				},
			}
		},

		/**
		 * StatRow: Label/Value pair display.
		 */
		StatRow(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}

			let state = {
				label: config.label || "Metric",
				value: config.value || "0.0",
				width: config.width || 150,
				height: config.height || spacing.control?.statRowHeight || 24,
				paddingX: config.paddingX ?? spacing.inset?.statRowX ?? 0,
				paddingY: config.paddingY ?? spacing.inset?.statRowY ?? 0,
				palette: config.palette || null,
			}

			const labelTxt = HUD.Typography.create("label", state.label, {
				palette: state.palette,
			})
			const valueTxt = HUD.Typography.create("value", state.value, {
				palette: state.palette,
			})
			container.addChild(labelTxt, valueTxt)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				labelTxt.style.fill = palette.text
				valueTxt.style.fill = palette.text

				labelTxt.text = state.label
				valueTxt.text = state.value

				if (state.width <= 0 || state.height <= 0) return

				const labelBox = layout.box(
					state.paddingX,
					state.paddingY,
					Math.max(0, state.width - state.paddingX * 2),
					Math.max(0, state.height - state.paddingY * 2),
				)
				layout.place(labelTxt, labelBox, "ml")
				layout.place(valueTxt, labelBox, "mr")
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					if (d.label !== undefined) state.label = d.label
					if (d.value !== undefined) state.value = d.value
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * MiniTrend: Sparkline + Value combination.
		 */
		MiniTrend(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 120,
				height: config.height || 24,
				samples: config.samples || [],
				latest: config.latest || "0",
				tone: config.tone || "secondary",
				gap: config.gap ?? spacing.gap?.item ?? 10,
				sparkWidth:
					config.sparkWidth ||
					spacing.control?.miniTrendSparkWidth ||
					48,
				palette: config.palette || null,
			}

			let spark = HUD.Components.Sparkline({
				width: state.sparkWidth,
				height: state.height,
				samples: state.samples,
				palette: state.palette,
			})

			const value = HUD.Typography.create("value", String(state.latest), {
				fontWeight: "700",
			})

			container.addChild(spark.root, value)

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()
				value.style.fill = palette.text

				spark.setState({
					color: palette[state.tone] || palette.primary,
					palette: state.palette,
				})
				spark.resize(state.sparkWidth, state.height)
				spark.setData(state.samples)

				spark.root.position.set(0, 0)
				value.text = String(state.latest)

				if (state.width <= 0 || state.height <= 0) return

				value.x = state.sparkWidth + state.gap
				value.y = Math.max(0, (state.height - value.height) / 2)
			}

			function resize(width, height) {
				state.width = width || state.width
				state.height = height || state.height
				state.sparkWidth = Math.max(
					spacing.control?.miniTrendSparkMinWidth || 32,
					Math.min(
						state.sparkWidth,
						state.width -
							(spacing.inset?.panel || 12) * 2 -
							state.gap,
					),
				)
				render()
			}

			function setData(next = {}) {
				if ("samples" in next) state.samples = next.samples || []
				if ("latest" in next) state.latest = next.latest
				render()
			}

			function setState(next = {}) {
				state = { ...state, ...next }
				render()
			}

			render()

			return {
				root: container,
				render,
				resize,
				setState,
				setData,
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * DataList: Vertical stack of StatRows.
		 */
		DataList(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 200,
				data: config.data || [],
				rowHeight:
					config.rowHeight ||
					spacing.control?.dataListRowHeight ||
					24,
				rowGap: config.rowGap ?? spacing.gap?.tight ?? 8,
				palette: config.palette || null,
			}

			let rows = []

			function render() {
				if (!container || container.destroyed) return
				const items = Array.isArray(state.data) ? state.data : []
				for (let i = 0; i < items.length; i += 1) {
					let row = rows[i]
					if (!row) {
						row = HUD.Components.StatRow({
							label: items[i]?.label,
							value: items[i]?.value,
							width: state.width,
							palette: state.palette,
						})
						rows[i] = row
						container.addChild(row.root)
					}
					row.setState({
						label: items[i]?.label,
						value: items[i]?.value,
						width: state.width,
						palette: state.palette,
					})
					row.root.y = i * (state.rowHeight + state.rowGap)
					row.root.visible = true
				}
				for (let i = items.length; i < rows.length; i += 1) {
					if (rows[i]?.root) rows[i].root.visible = false
				}
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (dataArg) => {
					let dataArray = dataArg
					if (
						dataArg &&
						!Array.isArray(dataArg) &&
						"data" in dataArg
					) {
						dataArray = dataArg.data
					}
					state.data = Array.isArray(dataArray) ? dataArray : []
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * KeyValueGrid: 2-column layout for metadata.
		 */
		KeyValueGrid(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 400,
				data: config.data || [],
				cols: config.cols || 2,
				gap: config.gap ?? spacing.gap?.grid ?? 16,
				rowHeight:
					config.rowHeight ||
					spacing.control?.keyValueRowHeight ||
					24,
				palette: config.palette || null,
			}

			let cells = []
			function render() {
				if (!container || container.destroyed) return
				const data = Array.isArray(state.data) ? state.data : []
				if (!data.length) {
					cells.forEach((row) => {
						if (row?.root) row.root.visible = false
					})
					return
				}

				const rows = Math.ceil(data.length / state.cols)
				const grid = layout.grid(
					layout.box(
						0,
						0,
						state.width,
						rows * state.rowHeight +
							Math.max(0, rows - 1) * state.gap,
					),
					state.cols,
					rows,
					state.gap,
				)

				data.forEach((d, i) => {
					const col = i % state.cols
					const rowIdx = Math.floor(i / state.cols)
					const cell = grid[col][rowIdx]

					let row = cells[i]
					if (!row) {
						row = HUD.Components.StatRow({
							label: d.label,
							value: d.value,
							width: cell.w,
							palette: state.palette,
						})
						cells[i] = row
						container.addChild(row.root)
					}
					row.setState({
						label: d.label,
						value: d.value,
						width: cell.w,
						palette: state.palette,
					})
					row.root.position.set(cell.x, cell.y)
					row.root.visible = true
				})
				for (let i = data.length; i < cells.length; i += 1) {
					if (cells[i]?.root) cells[i].root.visible = false
				}
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (dataArg) => {
					let dataArray = dataArg
					if (
						dataArg &&
						!Array.isArray(dataArg) &&
						"data" in dataArg
					) {
						dataArray = dataArg.data
					}
					state.data = Array.isArray(dataArray) ? dataArray : []
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ProgressBar: Bootstrap-style progress surface.
		 */
		ProgressBar(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const track = new PIXI.Graphics()
			const mask = new PIXI.Graphics()
			const barLayer = new PIXI.Container()
			const fill = new PIXI.Graphics()
			const stripes = new PIXI.Graphics()
			const label = HUD.Typography.create("small", config.label || "", {
				palette: config.palette,
				fontSize: 12,
				fontWeight: "700",
			})

			container.addChild(track, barLayer, mask)
			barLayer.mask = mask
			barLayer.addChild(fill, stripes, label)
			let rafId = null

			let state = {
				width: config.width || 180,
				height: config.height || 16,
				value:
					config.value !== undefined
						? Number(config.value) || 0
						: config.progress !== undefined
						? Number(config.progress) || 0
						: 0.5,
				min: config.min ?? 0,
				max: config.max ?? 1,
				radius: config.radius ?? 6,
				color: config.color ?? null,
				trackColor: config.trackColor ?? null,
				showLabel: !!config.showLabel,
				label: config.label || "",
				segments: Array.isArray(config.segments)
					? config.segments
					: null,
				striped: !!config.striped,
				animated: !!config.animated,
				palette: config.palette || null,
				duration: config.duration || 600,
			}

			function normalizedValue() {
				return HUD.Utils.normalizeValue(
					state.value,
					state.min,
					state.max,
				)
			}

			function resolveLabel() {
				if (Array.isArray(state.segments) && state.segments.length)
					return ""
				if (state.label) return String(state.label)
				if (state.showLabel) {
					return `${Math.round(normalizedValue() * 100)}%`
				}
				return ""
			}

			function resolveSegments(palette) {
				if (!Array.isArray(state.segments) || !state.segments.length) {
					return [
						{
							width: Math.max(
								0,
								Math.round(state.width * normalizedValue()),
							),
							color:
								state.color ||
								palette.primary ||
								palette.buttonColor ||
								0x0d6efd,
						},
					]
				}

				const range = Math.max(
					1,
					Number(state.max ?? 100) - Number(state.min ?? 0),
				)
				return state.segments
					.map((segment) => {
						const value = Number(
							segment?.value ??
								segment?.progress ??
								segment?.width ??
								0,
						)
						return {
							width: Math.max(
								0,
								Math.round((state.width * value) / range),
							),
							color:
								segment?.color ||
								palette.primary ||
								palette.buttonColor ||
								0x0d6efd,
						}
					})
					.filter((segment) => segment.width > 0)
			}

			function drawStripes(
				width,
				height,
				color,
				now = performance.now(),
			) {
				if (!stripes || stripes.destroyed) return
				stripes.clear()
				if (!state.striped || width <= 0) return

				const stripeColor = HUD.Utils.lerpColor(color, 0xffffff, 0.45)
				const stripeWidth = Math.max(8, Math.round(height))
				const stripeSkew = Math.max(4, Math.round(height * 0.75))
				const offset = state.animated
					? -((now / 18) % (stripeWidth + stripeSkew))
					: 0

				for (
					let x = offset - stripeWidth - stripeSkew;
					x < width + stripeWidth + stripeSkew;
					x += stripeWidth
				) {
					stripes
						.moveTo(x, height)
						.lineTo(x + stripeSkew, height)
						.lineTo(x + stripeSkew + stripeWidth, 0)
						.lineTo(x + stripeWidth, 0)
						.closePath()
						.fill({ color: stripeColor, alpha: 0.22 })
				}
			}

			function stopAnimation() {
				if (rafId !== null) {
					cancelAnimationFrame(rafId)
					rafId = null
				}
			}

			function startAnimation() {
				stopAnimation()
				if (!state.striped || !state.animated) return
				const tick = (now) => {
					if (!container || container.destroyed) return
					render(now)
					rafId = requestAnimationFrame(tick)
				}
				rafId = requestAnimationFrame(tick)
			}

			function render(now = performance.now()) {
				const palette = state.palette || HUD.Theme.createPalette()
				const trackColor =
					state.trackColor ||
					palette.panelSoft ||
					palette.border ||
					0xe9ecef
				const radius = Math.min(
					state.radius,
					Math.max(0, state.height / 2),
				)
				const segments = resolveSegments(palette)
				const targetWidth = segments.reduce(
					(sum, segment) => sum + segment.width,
					0,
				)
				const leadColor =
					segments[0]?.color ||
					state.color ||
					palette.primary ||
					palette.buttonColor ||
					0x0d6efd

				if (!track || track.destroyed) return
				track.clear()
				track.roundRect(0, 0, state.width, state.height, radius).fill({
					color: trackColor,
					alpha: 1,
				})

				if (!mask || mask.destroyed) return
				mask.clear()
				if (targetWidth > 0) {
					mask.roundRect(
						0,
						0,
						state.width,
						state.height,
						radius,
					).fill({
						color: 0xffffff,
						alpha: 1,
					})
				}
				mask.alpha = 0.001

				if (!fill || fill.destroyed) return
				fill.clear()
				let cursor = 0
				for (const segment of segments) {
					fill.rect(cursor, 0, segment.width, state.height).fill({
						color: segment.color,
						alpha: 1,
					})
					cursor += segment.width
				}
				drawStripes(targetWidth, state.height, leadColor, now)

				const textValue = resolveLabel()
				label.text = textValue
				label.visible = !!textValue && targetWidth > 0
				label.style.fill = HUD.Theme.resolveTextOn(leadColor, "base")
				label.position.set(
					Math.round((targetWidth - label.width) / 2),
					Math.round((state.height - label.height) / 2),
				)

				barLayer.visible = targetWidth > 0
				container._width = state.width
				container._height = state.height
			}

			function syncWidth() {
				render()
				startAnimation()
			}

			render()
			startAnimation()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setProgress: (value) => {
					state.value = value
					syncWidth()
				},
				setData: (d) => {
					state = { ...state, ...d }
					if ("progress" in d && !("value" in d)) {
						state.value = d.progress
					}
					syncWidth()
				},
				setState: (s) => {
					state = { ...state, ...s }
					if ("progress" in s && !("value" in s)) {
						state.value = s.progress
					}
					syncWidth()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					{
					}
					stopAnimation()
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * StatusBadge: State-aware badge (success, warning, critical).
		 */
		StatusBadge(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			let badge = HUD.Components.Badge(config)
			container.addChild(badge.root)

			let state = {
				status: config.state || "success",
				label: config.label || "",
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette =
					state.palette || config.palette || HUD.Theme.createPalette()

				const color = palette[state.status] || palette.text

				badge.setState({
					color,
					palette: state.palette,
				})

				if (state.label) {
					badge.setData({ label: state.label })
				} else {
					badge.setData({ label: state.status.toUpperCase() })
				}
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => badge.resize(w, h),
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					if (d.label) state.label = d.label
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * StatusPill: Compact tone-aware badge.
		 */
		StatusPill(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const tone = HUD.State.resolveTone(
				config.state || config.tone || "neutral",
			)
			HUD.Theme.assertThemeTokenUsage(config.color, "status pill color")
			return HUD.Components.Badge({
				...config,
				label:
					config.label ||
					String(
						config.state || config.tone || "status",
					).toUpperCase(),
				color: config.color ?? tone.base ?? tone.strong,
				height:
					config.height ||
					HUD.Spacing?.control?.pillHeight ||
					HUD.Spacing?.control?.badgeHeight ||
					20,
				paddingX: config.paddingX ?? 10,
				paddingY: config.paddingY ?? 3,
				radius: config.radius ?? HUD.Spacing?.radius?.pill ?? 999,
			})
		},

		/**
		 * Alert: Card-aligned notice surface with semantic state tones.
		 */
		Alert(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const background = new PIXI.Graphics()
			const title = HUD.Typography.create("small", config.title || "", {
				palette: config.palette,
				fontSize: 13,
			})
			const text = HUD.Typography.create("small", config.text || "", {
				palette: config.palette,
				fontSize: config.fontSize || 12,
			})
			const actions = new PIXI.Container()
			const actionNodes = []
			container.addChild(background, title, text, actions)

			let state = {
				variant: "inline",
				width: config.width || 240,
				height: config.height || 36,
				paddingX: config.paddingX ?? 12,
				paddingY: config.paddingY ?? 6,
				radius: config.radius ?? 4,
				railWidth: config.railWidth ?? 4,
				state: config.state || config.tone || "info",
				title: config.title ?? "",
				text: config.text || "",
				border: config.border !== false,
				actions: Array.isArray(config.actions) ? config.actions : [],
				palette: config.palette || null,
			}

			function resolveTone(palette, alertState) {
				switch (alertState) {
					case "success":
					case "positive":
						return (
							palette.alertPositive ||
							palette.success ||
							palette.primary
						)
					case "warning":
					case "caution":
						return (
							palette.alertCaution ||
							palette.warning ||
							palette.primary
						)
					case "danger":
					case "critical":
					case "error":
						return (
							palette.alertDanger ||
							palette.critical ||
							palette.primary
						)
					default:
						return palette.alertInfo || palette.primary
				}
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const tone = resolveTone(palette, state.state)
				const fill = palette.presetWhite || palette.panel
				const stroke = HUD.Utils.lerpColor(
					palette.border || 0xdcdcde,
					fill,
					0.15,
				)

				if (!background || background.destroyed) return
				background.clear()
				background.rect(0, 0, state.width, state.height).fill({
					color: fill,
					alpha: 1,
				})
				if (state.border) {
					background.rect(0, 0, state.width, state.height).stroke({
						width: 1,
						color: stroke,
						alpha: 1,
						pixelLine: true,
					})
				}
				background.rect(0, 0, state.railWidth, state.height).fill({
					color: tone,
					alpha: 1,
				})

				title.text = String(state.title || "")
				title.style.fill = HUD.Theme.resolveTextOn(fill, "base")
				title.style.fontSize = 13
				text.text = String(state.text || "")
				text.style.fill = HUD.Theme.resolveTextOn(fill, "base")
				text.style.fontSize = state.fontSize || 12

				const nextNodes = state.actions
					.map((item) => item?.root || item)
					.filter(Boolean)
				actionNodes.forEach((node) => {
					if (!nextNodes.includes(node)) node.visible = false
				})
				let actionsWidth = 0
				nextNodes.forEach((node) => {
					if (!actionNodes.includes(node)) actionNodes.push(node)
					if (node.parent !== actions) actions.addChild(node)
					node.visible = true
					node.position.set(actionsWidth, 0)
					actionsWidth +=
						(node.width || 0) + (spacing.gap?.inline || 8)
				})
				if (actionsWidth > 0) {
					actionsWidth -= spacing.gap?.inline || 8
				}

				title.visible = !!state.title
				let cursorY = state.paddingY
				const contentX = state.paddingX + state.railWidth
				if (state.title) {
					title.position.set(contentX, cursorY)
					cursorY += title.height + 6
				}

				text.visible = !!state.text
				text.position.set(
					contentX,
					Math.max(
						state.paddingY,
						Math.round((state.height - text.height) / 2),
					),
				)
				if (state.title) {
					text.position.y = cursorY
				}

				if (actionsWidth > 0) {
					actions.position.set(
						Math.max(
							contentX,
							state.width - state.paddingX - actionsWidth,
						),
						Math.max(
							state.paddingY,
							Math.round((state.height - actions.height) / 2),
						),
					)
				}

				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Collapse: Shared disclosure region with animated height clipping.
		 */
		Collapse(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const viewport = new PIXI.Container()
			const contentLayer = new PIXI.Container()
			const mask = new PIXI.Graphics()
			const heightProxy = {
				value:
					Number(config.expanded) === 0 || config.expanded === false
						? 0
						: config.contentHeight || 0,
			}
			let tween = null
			let contentNode = null

			viewport.addChild(contentLayer)
			viewport.mask = mask
			container.addChild(viewport, mask)

			let state = {
				width: config.width || 220,
				contentHeight: config.contentHeight || 0,
				expanded: config.expanded !== false,
				duration: config.duration || 220,
				easing: config.easing || "easeInOutQuad",
				clip: config.clip !== false,
			}

			function resolveContentHeight() {
				const measured =
					Number(state.contentHeight) ||
					(contentNode
						? contentNode._height || contentNode.height || 0
						: 0)
				return Math.max(0, measured)
			}

			function applyViewport() {
				const visibleHeight = Math.max(0, heightProxy.value || 0)
				if (!mask || mask.destroyed) return
				mask.clear()
				mask.rect(0, 0, state.width, visibleHeight).fill({
					color: 0xffffff,
					alpha: 1,
				})
				mask.alpha = state.clip ? 1 : 0.001
				container._width = state.width
				container._height = visibleHeight
			}

			function render() {
				if (!container || container.destroyed) return
				applyViewport()
			}

			function setContent(nextContent, nextHeight = null) {
				const nextNode = nextContent?.root || nextContent || null
				if (contentNode && contentNode !== nextNode) {
					contentNode.visible = false
				}
				contentNode = nextNode
				if (contentNode) {
					if (contentNode.parent !== contentLayer) contentLayer.addChild(contentNode)
					contentNode.visible = true
					contentNode.position.set(0, 0)
				}
				if (nextHeight !== null && nextHeight !== undefined) {
					state.contentHeight = nextHeight
				}
				heightProxy.value = state.expanded ? resolveContentHeight() : 0
				render()
			}

			function animateExpanded(expanded) {
				state.expanded = !!expanded
				const targetHeight = state.expanded ? resolveContentHeight() : 0
				if (tween) tween.active = false
				tween = HUD.Animation.animateTo(
					heightProxy,
					{ value: targetHeight },
					state.duration,
					state.easing,
				)
			}

			if (config.content) {
				setContent(config.content, config.contentHeight)
			} else {
				render()
			}

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setContent,
				toggle: () => {
					animateExpanded(!state.expanded)
				},
				setExpanded: (expanded) => {
					animateExpanded(expanded)
				},
				setData: (d) => {
					if ("contentHeight" in d)
						state.contentHeight = d.contentHeight
					if ("content" in d) setContent(d.content, d.contentHeight)
					if ("expanded" in d) animateExpanded(d.expanded)
				},
				setState: (s) => {
					state = { ...state, ...s }
					if ("content" in s) {
						setContent(s.content, s.contentHeight)
						return
					}
					if ("expanded" in s) {
						animateExpanded(s.expanded)
						return
					}
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Tabs: Bootstrap-style tab strip with active pane.
		 */
		Tabs(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const interaction = HUD.Interaction
			const tabLayer = new PIXI.Container()
			const panelLayer = new PIXI.Container()
			const divider = new PIXI.Graphics()
			const indicator = new PIXI.Graphics()
			const panelFrame = new PIXI.Graphics()
			const panelBody = HUD.Components.CardBody({
				width: config.width || 260,
				height: Math.max(44, (config.height || 140) - ((config.tabHeight || 36) - 1)),
				title: "",
				subtitle: "",
				text: "",
				palette: config.palette || null,
			})
			const tabsPool = []
			container.addChild(tabLayer, divider, panelLayer, indicator)
			panelLayer.addChild(panelFrame, panelBody.root)

			let state = {
				width: config.width || 260,
				height: config.height || 140,
				tabHeight: config.tabHeight || 36,
				variant: config.variant || "underline",
				showPanel: config.showPanel !== false,
				activeIndex: Number(config.activeIndex || 0),
				items: Array.isArray(config.items) ? config.items : [],
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const white = palette.presetWhite || palette.panel || 0xffffff
				const border = palette.border
				const active = palette.buttonColor || palette.primary
				const tabW = state.items.length
					? Math.max(56, Math.floor(state.width / state.items.length))
					: state.width

				if (!divider || divider.destroyed) return
				divider.clear()
				if (!indicator || indicator.destroyed) return
				indicator.clear()

				const panelY = state.tabHeight - 1
				const panelH = Math.max(44, state.height - panelY)
				panelLayer.visible = !!state.showPanel

				if (state.showPanel) {
					const current =
						state.items[state.activeIndex] || state.items[0] || {}
					panelFrame.clear()
					panelFrame
						.roundRect(0, panelY, state.width, panelH, 4)
						.fill({
							color: white,
							alpha: 1,
						})
					panelFrame
						.roundRect(0, panelY, state.width, panelH, 4)
						.stroke({
							width: 1,
							color: border,
							alpha: 1,
							pixelLine: true,
						})
					panelBody.setState({
						width: state.width,
						height: panelH,
						title: current.title || current.label || "Overview",
						subtitle: current.subtitle || "",
						text: current.text || "Tab panel content.",
						palette: state.palette,
						surfaceColor: white,
					})
					panelBody.root.position.set(0, panelY)
					panelBody.root.visible = true
				} else {
					panelFrame.clear()
					panelBody.root.visible = false
				}

				divider
					.moveTo(0, state.tabHeight)
					.lineTo(state.width, state.tabHeight)
					.stroke({
						width: 1,
						color: border,
						alpha: 1,
						pixelLine: true,
					})

				state.items.forEach((item, index) => {
					let tabObj = tabsPool[index]
					if (!tabObj) {
						const tab = new PIXI.Container()
						const hit = new PIXI.Graphics()
						const label = HUD.Components.TextTruncate({
							text: item.label || `Tab ${index + 1}`,
							width: Math.max(
								28,
								state.variant === "pills" ? tabW - 24 : tabW - 16,
							),
							palette: state.palette,
							fontSize: 13,
							tone: "base",
							surfaceColor: white,
						})
						tab.addChild(hit, label.root)
						interaction.register(hit, {
							onClick: () => {
								state.activeIndex = index
								render()
								if (typeof config.onChange === "function") {
									config.onChange(index, state.items[index] || item)
								}
							},
						})
						tabLayer.addChild(tab)
						tabObj = { tab, hit, label, labelNode: label.root }
						tabsPool[index] = tabObj
					}
					const isActive = index === state.activeIndex
					tabObj.label.setState({
						text: item.label || `Tab ${index + 1}`,
						width: Math.max(
							28,
							state.variant === "pills" ? tabW - 24 : tabW - 16,
						),
						palette: state.palette,
						fontSize: 13,
						tone: "base",
						surfaceColor:
							state.variant === "pills" && isActive ? active : white,
					})
					tabObj.hit.clear()
					if (state.variant === "pills") {
						tabObj.hit
							.roundRect(
							0,
							6,
							tabW - 8,
							state.tabHeight - 10,
							4,
						)
							.fill({
							color: isActive ? active : white,
							alpha: isActive ? 1 : 0.001,
						})
					} else if (state.variant === "boxed") {
						tabObj.hit.roundRect(0, 0, tabW, state.tabHeight, 4).fill({
							color: white,
							alpha: 0.001,
						})
					} else {
						tabObj.hit.rect(0, 0, tabW, state.tabHeight).fill({
							color: white,
							alpha: 0.001,
						})
					}
					tabObj.labelNode.position.set(
						Math.round(
							((state.variant === "pills" ? tabW - 8 : tabW) -
								tabObj.labelNode.width) /
								2,
						),
						Math.round((state.tabHeight - tabObj.labelNode.height) / 2) -
							1,
					)
					if (state.variant === "pills" && isActive) {
						tabObj.labelNode.children?.forEach?.((child) => {
							if (child.style) child.style.fill = white
						})
					} else if (isActive) {
						tabObj.labelNode.children?.forEach?.((child) => {
							if (child.style) child.style.fill = active
						})
					}
					tabObj.tab.position.set(index * tabW, 0)
					tabObj.tab.visible = true

					if (state.variant === "boxed") {
						if (isActive) {
							indicator
								.roundRect(
									index * tabW,
									0,
									tabW,
									state.tabHeight,
									4,
								)
								.stroke({
									width: 1,
									color: active,
									alpha: 1,
									pixelLine: true,
								})
						}
					} else if (state.variant === "underline" && isActive) {
						indicator
							.rect(index * tabW, state.tabHeight - 2, tabW, 2)
							.fill({
								color: active,
								alpha: 1,
							})
					}
				})
				for (let i = state.items.length; i < tabsPool.length; i += 1) {
					if (tabsPool[i]?.tab) tabsPool[i].tab.visible = false
				}

				container._width = state.width
				container._height = state.showPanel
					? state.height
					: state.tabHeight
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Accordion: Stacked disclosure sections.
		 */
		Accordion(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const interaction = HUD.Interaction
			const sectionPool = []

			let state = {
				width: config.width || 260,
				items: Array.isArray(config.items) ? config.items : [],
				activeIndex: Number(config.activeIndex ?? 0),
				headerHeight: config.headerHeight || 36,
				panelHeight: config.panelHeight || 72,
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const white = palette.presetWhite || palette.panel || 0xffffff
				const border = palette.border
				const active = palette.buttonColor || palette.primary
				const baseText = HUD.Theme.resolveTextOn(white, "base")

				let cursorY = 0
				state.items.forEach((item, index) => {
					const open = index === state.activeIndex
					let sectionObj = sectionPool[index]
					if (!sectionObj) {
						const section = new PIXI.Container()
						const surface = new PIXI.Graphics()
						const divider = new PIXI.Graphics()
						const label = HUD.Typography.create(
							"label",
							item.label || `Section ${index + 1}`,
							{
								palette: state.palette,
								fontSize: 13,
								fontWeight: "600",
							},
						)
						const subtitle = HUD.Typography.create(
							"small",
							item.subtitle || "",
							{
								palette: state.palette,
								fontSize: 11,
							},
						)
						const bodyText = HUD.Typography.create(
							"small",
							item.text || "Accordion content.",
							{
								palette: state.palette,
								fontSize: 12,
							},
						)
						const hit = new PIXI.Graphics()
						section.addChild(surface, divider, label, subtitle, bodyText, hit)
						interaction.register(hit, {
							onClick: () => {
								const openNow = state.activeIndex === index
								state.activeIndex = openNow ? -1 : index
								render()
								if (typeof config.onChange === "function") {
									config.onChange(state.activeIndex, state.items[index])
								}
							},
						})
						container.addChild(section)
						sectionObj = { section, surface, divider, label, subtitle, bodyText, hit }
						sectionPool[index] = sectionObj
					}
					const sectionHeight =
						state.headerHeight + (open ? state.panelHeight : 0)

					sectionObj.surface.clear()
					sectionObj.surface
						.roundRect(0, 0, state.width, sectionHeight, 4)
						.fill({
							color: white,
							alpha: 1,
						})
					sectionObj.surface
						.roundRect(0, 0, state.width, sectionHeight, 4)
						.stroke({
							width: 1,
							color: open ? active : border,
							alpha: 1,
							pixelLine: true,
						})
					sectionObj.label.text = item.label || `Section ${index + 1}`
					sectionObj.label.style.fill = open ? active : baseText
					sectionObj.label.alpha = 1
					sectionObj.label.position.set(
						14,
						Math.round((state.headerHeight - sectionObj.label.height) / 2),
					)
					sectionObj.divider.clear()

					if (open) {
						sectionObj.divider
							.moveTo(0, state.headerHeight)
							.lineTo(state.width, state.headerHeight)
							.stroke({
								width: 1,
								color: border,
								alpha: 1,
								pixelLine: true,
							})
						sectionObj.subtitle.text = String(item.subtitle || "")
						sectionObj.bodyText.text = String(
							item.text || "Accordion content.",
						)
						sectionObj.subtitle.style.fill = HUD.Theme.resolveTextOn(
							white,
							"muted",
						)
						sectionObj.bodyText.style.fill = HUD.Theme.resolveTextOn(
							white,
							"base",
						)
						sectionObj.subtitle.visible = !!item.subtitle
						sectionObj.subtitle.position.set(14, state.headerHeight + 10)
						sectionObj.bodyText.position.set(14, state.headerHeight + 28)
						sectionObj.bodyText.visible = true
					} else {
						sectionObj.subtitle.visible = false
						sectionObj.bodyText.visible = false
					}

					sectionObj.hit.clear()
					sectionObj.hit.rect(0, 0, state.width, state.headerHeight).fill({
						color: white,
						alpha: 0.001,
					})
					sectionObj.section.position.set(0, cursorY)
					sectionObj.section.visible = true
					cursorY += sectionHeight - 1
				})
				for (let i = state.items.length; i < sectionPool.length; i += 1) {
					if (sectionPool[i]?.section) sectionPool[i].section.visible = false
				}

				container._width = state.width
				container._height = cursorY
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Pagination: Paged navigation control.
		 */
		Pagination(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const group = HUD.Components.InlineGroup({
				gap: config.gap ?? 6,
				align: "center",
			})
			container.addChild(group.root)

			let state = {
				width: config.width || 260,
				current: config.current || 2,
				total: config.total || 5,
				palette: config.palette || null,
			}

			function makeButton(label, active = false, disabled = false) {
				return HUD.Components.Button({
					label: String(label),
					width: String(label).length > 1 ? 38 : 30,
					height: 28,
					variant: active ? "solid" : "outline",
					tone: "primary",
					disabled,
					palette: state.palette,
				})
			}

			function render() {
				if (!container || container.destroyed) return
				const items = []
				items.push(makeButton("‹", false, state.current <= 1))
				for (let i = 1; i <= state.total; i++) {
					items.push(makeButton(i, i === state.current, false))
				}
				items.push(makeButton("›", false, state.current >= state.total))
				group.setState({
					width: state.width,
					items: items.map((item) => item.root),
					align: "center",
				})
				container._width = group.root._width || state.width
				container._height = group.root._height || 28
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardTitle: Bootstrap-style card title text.
		 */
		CardTitle(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			let state = {
				text: config.text || config.label || "Card Title",
				palette: config.palette || null,
				fontSize: config.fontSize || 13,
				surfaceColor: config.surfaceColor || null,
			}

			const text = HUD.Typography.create("title", state.text, {
				palette: state.palette,
				fontSize: state.fontSize,
			})
			container.addChild(text)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				text.text = String(state.text || "")
				text.style.fill = HUD.Theme.resolveTextOn(
					state.surfaceColor ?? palette.presetWhite ?? palette.panel,
					"base",
				)
				text.style.fontSize = state.fontSize
				container._width = text.width
				container._height = text.height
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardSubtitle: Secondary card header text.
		 */
		CardSubtitle(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			let state = {
				text: config.text || config.label || "Card subtitle",
				palette: config.palette || null,
				fontSize: config.fontSize || 11,
				surfaceColor: config.surfaceColor || null,
			}

			const text = HUD.Typography.create("small", state.text, {
				palette: state.palette,
				fontSize: state.fontSize,
			})
			container.addChild(text)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				text.text = String(state.text || "")
				text.style.fill = HUD.Theme.resolveTextOn(
					state.surfaceColor ?? palette.presetWhite ?? palette.panel,
					"muted",
				)
				text.style.fontSize = state.fontSize
				container._width = text.width
				container._height = text.height
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardText: Standard card body copy.
		 */
		CardText(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			let state = {
				text:
					config.text ||
					"Some quick example text to build on the card title and make up the bulk of the card's content.",
				width: config.width || 180,
				palette: config.palette || null,
				fontSize: config.fontSize || 12,
				surfaceColor: config.surfaceColor || null,
			}

			const text = HUD.Typography.create("small", state.text, {
				palette: state.palette,
				fontSize: state.fontSize,
			})
			container.addChild(text)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				text.text = String(state.text || "")
				text.style.fill = HUD.Theme.resolveTextOn(
					state.surfaceColor ?? palette.presetWhite ?? palette.panel,
					"base",
				)
				text.style.fontSize = state.fontSize
				HUD.Utils.fitText(text, state.width)
				container._width = Math.min(state.width, text.width)
				container._height = text.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * TextTruncate: Single-line text that truncates with an ellipsis to fit width.
		 */
		TextTruncate(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			let state = {
				text:
					config.text ||
					"Some long text that should truncate cleanly within the available width.",
				width: config.width || 180,
				palette: config.palette || null,
				fontSize: config.fontSize || 12,
				surfaceColor: config.surfaceColor || null,
				tone: config.tone || "base",
				ellipsis: config.ellipsis || "…",
			}

			const text = HUD.Typography.create("small", state.text, {
				palette: state.palette,
				fontSize: state.fontSize,
			})
			container.addChild(text)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const fullText = String(state.text || "")
				const fill = HUD.Theme.resolveTextOn(
					state.surfaceColor ?? palette.presetWhite ?? palette.panel,
					state.tone,
				)
				text.style.fill = fill
				text.style.fontSize = state.fontSize
				text.style.wordWrap = false
				text.style.breakWords = false
				text.text = fullText

				if (text.width > state.width) {
					const suffix = String(state.ellipsis || "…")
					let low = 0
					let high = fullText.length
					let best = suffix

					text.text = suffix
					if (text.width <= state.width) {
						while (low <= high) {
							const mid = Math.floor((low + high) / 2)
							const candidate = fullText.slice(0, mid) + suffix
							text.text = candidate
							if (text.width <= state.width) {
								best = candidate
								low = mid + 1
							} else {
								high = mid - 1
							}
						}
					}
					text.text = best
				}

				container._width = Math.min(state.width, text.width)
				container._height = text.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardHeader: Header cap for cards.
		 */
		CardHeader(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const layout = HUD.Layout
			const background = new PIXI.Graphics()
			const title = HUD.Components.CardTitle({
				text: config.title || "Card Header",
				palette: config.palette,
			})
			const subtitle = HUD.Components.CardSubtitle({
				text: config.subtitle || "",
				palette: config.palette,
			})
			const actions = new PIXI.Container()
			const actionNodes = []
			container.addChild(background, title.root, subtitle.root, actions)

			let state = {
				width: config.width || 220,
				height: config.height || 56,
				radius: config.radius ?? 4,
				borderBottom: config.borderBottom !== false,
				paddingX: config.paddingX ?? 16,
				paddingY: config.paddingY ?? 12,
				title: config.title || "Card Header",
				subtitle: config.subtitle || "",
				actions: Array.isArray(config.actions) ? config.actions : [],
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const fill = palette.presetWhite || palette.panel || 0xffffff

				if (!background || background.destroyed) return
				background.clear()
				background
					.roundRect(0, 0, state.width, state.height, state.radius)
					.fill({
						color: fill,
						alpha: 1,
					})
				background
					.rect(
						0,
						Math.max(0, state.radius),
						state.width,
						Math.max(0, state.height - state.radius),
					)
					.fill({
						color: fill,
						alpha: 1,
					})
				if (state.borderBottom) {
					background
						.moveTo(0, state.height)
						.lineTo(state.width, state.height)
						.stroke({
							width: 1,
							color: palette.border,
							alpha: 1,
							pixelLine: true,
						})
				}

				title.setState({
					text: state.title,
					palette: state.palette,
					surfaceColor: fill,
				})
				subtitle.setState({
					text: state.subtitle,
					palette: state.palette,
					surfaceColor: fill,
				})

				const nextNodes = state.actions
					.map((item) => item?.root || item)
					.filter(Boolean)
				const activeNodes = new Set(nextNodes)
				actionNodes.forEach((node) => {
					if (!activeNodes.has(node)) node.visible = false
				})
				let actionsWidth = 0
				nextNodes.forEach((node) => {
					if (!actionNodes.includes(node)) actionNodes.push(node)
					if (node.parent !== actions) actions.addChild(node)
					node.visible = true
					node.position.set(actionsWidth, 0)
					actionsWidth +=
						(node.width || 0) + (spacing.gap?.inline || 8)
				})
				if (actionsWidth > 0) {
					actionsWidth -= spacing.gap?.inline || 8
				}

				const textBox = layout.box(
					state.paddingX,
					state.paddingY,
					Math.max(
						0,
						state.width -
							state.paddingX * 2 -
							actionsWidth -
							(actionsWidth ? spacing.gap?.inline || 8 : 0),
					),
					Math.max(0, state.height - state.paddingY * 2),
				)
				title.root.position.set(textBox.x, textBox.y)
				subtitle.root.visible = !!state.subtitle
				if (state.subtitle) {
					subtitle.root.position.set(
						textBox.x,
						textBox.y + title.root.height + 2,
					)
				}

				actions.position.set(
					Math.max(
						state.paddingX,
						state.width - state.paddingX - actionsWidth,
					),
					Math.max(
						0,
						Math.round((state.height - actions.height) / 2),
					),
				)

				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardBody: Main padded content region.
		 */
		CardBody(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const content = new PIXI.Container()
			container.addChild(content)

			let textBlock = null
			let titleBlock = null
			let subtitleBlock = null
			let state = {
				width: config.width || 220,
				height: config.height || 120,
				paddingX: config.paddingX ?? 16,
				paddingY: config.paddingY ?? 16,
				title: config.title || "",
				subtitle: config.subtitle || "",
				text: config.text || "",
				palette: config.palette || null,
				surfaceColor: config.surfaceColor || null,
			}

			function render() {
				if (!container || container.destroyed) return
				let cursorY = state.paddingY
				const contentWidth = Math.max(
					0,
					state.width - state.paddingX * 2,
				)
				const surfaceColor =
					state.surfaceColor ||
					(state.palette || HUD.Theme.createPalette()).presetWhite ||
					(state.palette || HUD.Theme.createPalette()).panel

				if (state.title) {
					titleBlock =
						titleBlock ||
						HUD.Components.CardTitle({ palette: state.palette })
					titleBlock.setState({
						text: state.title,
						palette: state.palette,
						surfaceColor,
					})
					titleBlock.root.position.set(state.paddingX, cursorY)
					if (titleBlock.root.parent !== content)
						content.addChild(titleBlock.root)
					titleBlock.root.visible = true
					cursorY += titleBlock.root.height + 4
				} else if (titleBlock?.root) {
					titleBlock.root.visible = false
				}

				if (state.subtitle) {
					subtitleBlock =
						subtitleBlock ||
						HUD.Components.CardSubtitle({ palette: state.palette })
					subtitleBlock.setState({
						text: state.subtitle,
						palette: state.palette,
						surfaceColor,
					})
					subtitleBlock.root.position.set(state.paddingX, cursorY)
					if (subtitleBlock.root.parent !== content)
						content.addChild(subtitleBlock.root)
					subtitleBlock.root.visible = true
					cursorY += subtitleBlock.root.height + 8
				} else if (subtitleBlock?.root) {
					subtitleBlock.root.visible = false
				}

				if (state.text) {
					textBlock =
						textBlock ||
						HUD.Components.CardText({ palette: state.palette })
					textBlock.setState({
						text: state.text,
						width: contentWidth,
						palette: state.palette,
						surfaceColor,
					})
					textBlock.root.position.set(state.paddingX, cursorY)
					if (textBlock.root.parent !== content)
						content.addChild(textBlock.root)
					textBlock.root.visible = true
					cursorY += textBlock.root.height
				} else if (textBlock?.root) {
					textBlock.root.visible = false
				}

				content._width = contentWidth
				content._height = Math.max(0, state.height - state.paddingY * 2)
				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				content,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardFooter: Footer cap for cards.
		 */
		CardFooter(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const summary = HUD.Components.CardSubtitle({
				text: config.summary || "Card footer",
				palette: config.palette,
			})
			const status = HUD.Components.CardText({
				text: config.status || "",
				palette: config.palette,
				fontSize: 11,
				width: 120,
			})
			const actions = new PIXI.Container()
			const actionNodes = []
			const background = new PIXI.Graphics()
			container.addChild(background, summary.root, status.root, actions)

			let state = {
				width: config.width || 220,
				height: config.height || 52,
				radius: config.radius ?? 4,
				borderTop: config.borderTop !== false,
				paddingX: config.paddingX ?? 16,
				paddingY: config.paddingY ?? 12,
				summary: config.summary || "",
				status: config.status || "",
				actions: Array.isArray(config.actions) ? config.actions : [],
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const fill = palette.presetWhite || palette.panel || 0xffffff
				if (!background || background.destroyed) return
				background.clear()
				background
					.roundRect(0, 0, state.width, state.height, state.radius)
					.fill({
						color: fill,
						alpha: 1,
					})
				background
					.rect(
						0,
						0,
						state.width,
						Math.max(0, state.height - state.radius),
					)
					.fill({
						color: fill,
						alpha: 1,
					})
				if (state.borderTop) {
					background.moveTo(0, 0).lineTo(state.width, 0).stroke({
						width: 1,
						color: palette.border,
						alpha: 1,
						pixelLine: true,
					})
				}

				summary.setState({
					text: state.summary,
					palette: state.palette,
					surfaceColor: fill,
				})
				status.setState({
					text: state.status,
					palette: state.palette,
					width: 120,
					surfaceColor: fill,
				})

				const nextNodes = state.actions
					.map((item) => item?.root || item)
					.filter(Boolean)
				const activeNodes = new Set(nextNodes)
				actionNodes.forEach((node) => {
					if (!activeNodes.has(node)) node.visible = false
				})
				let actionsWidth = 0
				nextNodes.forEach((node) => {
					if (!actionNodes.includes(node)) actionNodes.push(node)
					if (node.parent !== actions) actions.addChild(node)
					node.visible = true
					node.position.set(actionsWidth, 0)
					actionsWidth +=
						(node.width || 0) + (spacing.gap?.inline || 8)
				})
				if (actionsWidth > 0) {
					actionsWidth -= spacing.gap?.inline || 8
				}

				summary.root.position.set(
					state.paddingX,
					Math.max(
						0,
						Math.round((state.height - summary.root.height) / 2),
					),
				)
				status.root.visible = !!state.status
				status.root.position.set(
					Math.max(
						state.paddingX +
							summary.root.width +
							(state.summary && state.status
								? spacing.gap?.inline || 8
								: 0),
						state.width -
							state.paddingX -
							actionsWidth -
							status.root.width -
							(actionsWidth ? spacing.gap?.inline || 8 : 0),
					),
					Math.max(
						0,
						Math.round((state.height - status.root.height) / 2),
					),
				)
				actions.position.set(
					Math.max(
						state.paddingX,
						state.width - state.paddingX - actionsWidth,
					),
					Math.max(
						0,
						Math.round((state.height - actions.height) / 2),
					),
				)

				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardListItem: Row item for card list groups.
		 */
		CardListItem(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const background = new PIXI.Container()
			const backgroundShape = new PIXI.Graphics()
			const backgroundMask = new PIXI.Graphics()
			background.addChild(backgroundShape, backgroundMask)
			backgroundShape.mask = backgroundMask
			const label = HUD.Typography.create(
				"small",
				config.label || "An item",
				{
					palette: config.palette,
					fontSize: 12,
				},
			)
			const value = HUD.Typography.create("small", config.value || "", {
				palette: config.palette,
				fontSize: 12,
			})
			container.addChild(background, label, value)

			let state = {
				width: config.width || 220,
				height: config.height || 36,
				paddingX: config.paddingX ?? spacing.inset?.panel ?? 12,
				label: config.label || "An item",
				value: config.value || "",
				showDivider: config.showDivider !== false,
				align: config.align || "between",
				labelAlign: config.labelAlign || null,
				valueAlign: config.valueAlign || null,
				crossAlign: config.crossAlign || "center",
				fill: config.fill || null,
				fillAlpha: config.fillAlpha,
				stroke: config.stroke || null,
				strokeAlpha: config.strokeAlpha,
				radius: config.radius ?? 4,
				cap: config.cap || null,
				active: !!config.active,
				disabled: !!config.disabled,
				hoverEnabled: !!config.hoverEnabled,
				hovered: !!config.hovered,
				hoverFill: config.hoverFill || null,
				hoverFillAlpha: config.hoverFillAlpha,
				hoverStroke: config.hoverStroke || null,
				hoverStrokeAlpha: config.hoverStrokeAlpha,
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const baseFill =
					state.fill || palette.presetWhite || palette.panel
				const baseStroke = state.stroke || palette.border
				const hoverFill =
					state.hoverFill ||
					HUD.Utils.lerpColor(
						baseFill,
						palette.primary || palette.text || 0x1d2327,
						0.04,
					)
				const hoverStroke =
					state.hoverStroke ||
					HUD.Utils.lerpColor(
						palette.primary || palette.text || 0x1d2327,
						palette.text || 0x1d2327,
						0.2,
					)
				const activeFill = HUD.Utils.lerpColor(
					palette.primary || palette.text || 0x1d2327,
					palette.text || 0x1d2327,
					0.2,
				)
				const disabledFill = palette.presetWhite || palette.panel
				const disabledStroke = palette.border
				const fillColor = state.disabled
					? disabledFill
					: state.active
					? activeFill
					: state.hoverEnabled && state.hovered
					? hoverFill
					: baseFill
				const strokeColor = state.disabled
					? disabledStroke
					: state.active
					? activeFill
					: state.hoverEnabled && state.hovered
					? hoverStroke
					: baseStroke
				const fillAlpha = state.disabled
					? state.fillAlpha ?? 1
					: state.active
					? 1
					: state.hoverEnabled && state.hovered
					? state.hoverFillAlpha ?? 1
					: state.fillAlpha ?? 1
				const strokeAlpha = state.disabled
					? state.strokeAlpha ?? (state.showDivider ? 1 : 0)
					: state.active
					? 1
					: state.hoverEnabled && state.hovered
					? state.hoverStrokeAlpha ?? 1
					: state.strokeAlpha ?? (state.showDivider ? 1 : 0)

				if (!backgroundShape || backgroundShape.destroyed) return
				backgroundShape.clear()
				if (!backgroundMask || backgroundMask.destroyed) return
				backgroundMask.clear()
				if (state.radius > 0) {
					if (state.cap === "top") {
						backgroundShape
							.roundRect(
								0,
								0,
								state.width,
								state.height + state.radius,
								state.radius,
							)
							.fill({ color: fillColor, alpha: fillAlpha })
						if (strokeAlpha > 0) {
							backgroundShape
								.roundRect(
									0,
									0,
									state.width,
									state.height + state.radius,
									state.radius,
								)
								.stroke({
									width: 1,
									color: strokeColor,
									alpha: strokeAlpha,
									pixelLine: true,
								})
						}
					} else if (state.cap === "bottom") {
						backgroundShape
							.roundRect(
								0,
								-state.radius,
								state.width,
								state.height + state.radius,
								state.radius,
							)
							.fill({ color: fillColor, alpha: fillAlpha })
						if (strokeAlpha > 0) {
							backgroundShape
								.roundRect(
									0,
									-state.radius,
									state.width,
									state.height + state.radius,
									state.radius,
								)
								.stroke({
									width: 1,
									color: strokeColor,
									alpha: strokeAlpha,
									pixelLine: true,
								})
						}
					} else {
						backgroundShape
							.roundRect(
								0,
								0,
								state.width,
								state.height,
								state.radius,
							)
							.fill({
								color: fillColor,
								alpha: fillAlpha,
							})
						if (strokeAlpha > 0) {
							backgroundShape
								.roundRect(
									0,
									0,
									state.width,
									state.height,
									state.radius,
								)
								.stroke({
									width: 1,
									color: strokeColor,
									alpha: strokeAlpha,
									pixelLine: true,
								})
						}
					}
					backgroundMask.rect(0, 0, state.width, state.height).fill({
						color: 0xffffff,
						alpha: 1,
					})
					if (
						state.showDivider &&
						state.cap !== "bottom" &&
						state.cap !== "all"
					) {
						backgroundShape
							.moveTo(0, state.height)
							.lineTo(state.width, state.height)
							.stroke({
								width: 1,
								color: strokeColor,
								alpha: strokeAlpha || 1,
								pixelLine: true,
							})
					}
				} else {
					backgroundShape.rect(0, 0, state.width, state.height).fill({
						color: fillColor,
						alpha: fillAlpha,
					})
					backgroundMask.rect(0, 0, state.width, state.height).fill({
						color: 0xffffff,
						alpha: 1,
					})
					if (state.showDivider) {
						backgroundShape
							.moveTo(0, state.height)
							.lineTo(state.width, state.height)
							.stroke({
								width: 1,
								color: strokeColor,
								alpha: strokeAlpha || 1,
								pixelLine: true,
							})
					}
				}
				label.text = String(state.label || "")
				const textColor = state.disabled
					? HUD.Theme.resolveTextOn(fillColor, "muted")
					: state.active
					? HUD.Theme.resolveTextOn(fillColor, "base")
					: state.hoverEnabled && state.hovered
					? hoverStroke
					: HUD.Theme.resolveTextOn(fillColor, "base")
				label.style.fill = textColor
				value.text = String(state.value || "")
				value.style.fill = textColor

				const innerWidth = Math.max(0, state.width - state.paddingX * 2)
				const crossY = (node) =>
					state.crossAlign === "start"
						? 0
						: state.crossAlign === "end"
						? Math.max(0, state.height - node.height)
						: Math.max(
								0,
								Math.round((state.height - node.height) / 2),
						  )
				const align = state.align || "between"
				const labelAlign =
					state.labelAlign ||
					(align === "center" ? "center" : "start")
				const valueAlign =
					state.valueAlign ||
					(align === "center"
						? "center"
						: align === "end"
						? "end"
						: "end")

				if (align === "center") {
					const gap = state.value ? spacing.gap?.inline || 8 : 0
					const totalWidth =
						label.width + (state.value ? gap + value.width : 0)
					const startX = Math.max(
						state.paddingX,
						Math.round((state.width - totalWidth) / 2),
					)
					label.position.set(startX, crossY(label))
					value.position.set(
						startX + label.width + gap,
						crossY(value),
					)
				} else if (align === "start") {
					label.position.set(state.paddingX, crossY(label))
					value.position.set(
						state.paddingX +
							label.width +
							(state.value ? spacing.gap?.inline || 8 : 0),
						crossY(value),
					)
				} else {
					label.position.set(
						labelAlign === "center"
							? Math.max(
									state.paddingX,
									Math.round((state.width - label.width) / 2),
							  )
							: state.paddingX,
						crossY(label),
					)
					value.position.set(
						valueAlign === "center"
							? Math.max(
									state.paddingX,
									Math.round((state.width - value.width) / 2),
							  )
							: Math.max(
									state.paddingX,
									state.width - state.paddingX - value.width,
							  ),
						crossY(value),
					)
				}

				container._width = state.width
				container._height = state.height
			}

			if (state.hoverEnabled) {
				container.eventMode = "static"
				container.cursor = "pointer"
				container.on("pointerover", () => {
					if (state.disabled) return
					state.hovered = true
					render()
				})
				container.on("pointerout", () => {
					state.hovered = false
					render()
				})
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * CardListGroup: Vertical stack of card list items.
		 */
		CardListGroup(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			let items = []
			let state = {
				width: config.width || 220,
				items: Array.isArray(config.items) ? config.items : [],
				rowHeight: config.rowHeight || 38,
				align: config.align || "between",
				labelAlign: config.labelAlign || null,
				valueAlign: config.valueAlign || null,
				crossAlign: config.crossAlign || "center",
				flush: !!config.flush,
				hoverEnabled: !!config.hoverEnabled,
				hoverFill: config.hoverFill || null,
				hoverFillAlpha: config.hoverFillAlpha,
				hoverStroke: config.hoverStroke || null,
				hoverStrokeAlpha: config.hoverStrokeAlpha,
				embedded:
					config.embedded !== undefined
						? !!config.embedded
						: !!config.flush,
				radius: config.radius ?? (HUD.Spacing?.radius?.panel || 4),
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const rows = state.items.length
					? state.items
					: [
							{ label: "An item" },
							{ label: "A second item" },
							{ label: "A third item", showDivider: false },
					  ]
				rows.forEach((row, index) => {
					const isFirst = index === 0
					const isLast = index === rows.length - 1
					const rowRadius =
						state.flush || state.embedded
							? 0
							: rows.length === 1
							? state.radius
							: isFirst || isLast
							? state.radius
							: 0
					const rowState = {
						width: state.width,
						height: state.rowHeight,
						label: row.label,
						value: row.value,
						showDivider:
							row.showDivider !== undefined
								? row.showDivider
								: index < rows.length - 1,
						align: row.align || state.align,
						labelAlign: row.labelAlign || state.labelAlign,
						valueAlign: row.valueAlign || state.valueAlign,
						crossAlign: row.crossAlign || state.crossAlign,
						active: !!row.active,
						disabled: !!row.disabled,
						hoverEnabled:
							row.hoverEnabled !== undefined
								? !!row.hoverEnabled
								: state.hoverEnabled,
						hoverFill: row.hoverFill || state.hoverFill,
						hoverFillAlpha:
							row.hoverFillAlpha !== undefined
								? row.hoverFillAlpha
								: state.hoverFillAlpha,
						hoverStroke: row.hoverStroke || state.hoverStroke,
						hoverStrokeAlpha:
							row.hoverStrokeAlpha !== undefined
								? row.hoverStrokeAlpha
								: state.hoverStrokeAlpha,
						radius: row.radius !== undefined ? row.radius : rowRadius,
						cap:
							state.flush || state.embedded
								? null
								: rows.length === 1
								? "all"
								: isFirst
								? "top"
								: isLast
								? "bottom"
								: null,
						palette: state.palette,
					}

					let item = items[index]
					if (!item || !item.root || item.root.destroyed) {
						item = HUD.Components.CardListItem(rowState)
						items[index] = item
						container.addChild(item.root)
					} else {
						item.setState?.(rowState)
					}

					item.root.visible = true
					item.root.position.set(0, index * state.rowHeight)
				})

				for (let i = rows.length; i < items.length; i += 1) {
					const item = items[i]
					if (item?.root) {
						item.root.visible = false
					}
				}

				container._width = state.width
				container._height = rows.length * state.rowHeight
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					items.forEach((item) => item?.destroy?.())
					items = []
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * Card: Shared card composition surface.
		 */
		Card(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const spacing = HUD.Spacing || {}
			let frame = null
			let header = null
			let body = null
			let footer = null

			let state = {
				width: config.width || 240,
				height: config.height || 180,
				radius: config.radius ?? 4,
				shadow: !!config.shadow,
				palette: config.palette || null,
				header: config.header || null,
				body: config.body || null,
				footer: config.footer || null,
			}

			function ensureSections() {
				if (state.header && !header) {
					header = HUD.Components.CardHeader({
						palette: state.palette,
					})
				}
				if (!state.header && header) {
					header.destroy()
					header = null
				}
				if (state.body && !body) {
					body = HUD.Components.CardBody({ palette: state.palette })
				}
				if (!state.body && body) {
					body.destroy()
					body = null
				}
				if (state.footer && !footer) {
					footer = HUD.Components.CardFooter({
						palette: state.palette,
					})
				}
				if (!state.footer && footer) {
					footer.destroy()
					footer = null
				}
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				if (frame) {
					container.removeChild(frame)
					frame.destroy()
				}

				frame = primitives.Card({
					width: state.width,
					height: state.height,
					radius: state.radius,
					fill: palette.presetWhite || palette.panel,
					stroke: palette.border,
					strokeAlpha: 1,
					shadow: state.shadow,
					palette: state.palette,
				})
				container.addChildAt(frame, 0)

				ensureSections()

				let cursorY = 0
				const headerHeight = state.header?.height || (header ? 56 : 0)
				const footerHeight = state.footer?.height || (footer ? 52 : 0)
				const bodyHeight = Math.max(
					0,
					state.height - headerHeight - footerHeight,
				)

				if (header) {
					header.setState({
						...state.header,
						width: state.width,
						height: headerHeight,
						palette: state.palette,
					})
					header.root.position.set(0, cursorY)
					if (header.root.parent !== container)
						container.addChild(header.root)
					cursorY += headerHeight
				}

				if (body) {
					body.setState({
						...state.body,
						width: state.width,
						height: bodyHeight,
						palette: state.palette,
						surfaceColor: palette.presetWhite || palette.panel,
					})
					body.root.position.set(0, cursorY)
					if (body.root.parent !== container)
						container.addChild(body.root)
					cursorY += bodyHeight
				}

				if (footer) {
					footer.setState({
						...state.footer,
						width: state.width,
						height: footerHeight,
						palette: state.palette,
					})
					footer.root.position.set(0, cursorY)
					if (footer.root.parent !== container)
						container.addChild(footer.root)
				}

				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				content: body?.content || null,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * InlineGroup: Horizontal layout helper.
		 */
		InlineGroup(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 0,
				gap:
					config.gap ??
					Math.round(
						(spacing.gap?.inline || spacing.gap?.item || 8) *
							scale.gap,
					),
				align: config.align || "left",
				valign: config.valign || "middle",
				wrap: !!config.wrap,
				padding: config.padding ?? 0,
				items: Array.isArray(config.items) ? config.items : [],
			}

			function itemNode(item) {
				return item?.root || item
			}

			function render() {
				if (!container || container.destroyed) return
				const nodes = state.items.map(itemNode).filter(Boolean)
				const activeNodes = new Set(nodes)
				container.children.forEach((node) => {
					if (!activeNodes.has(node)) node.visible = false
				})
				nodes.forEach((node) => {
					if (node.parent !== container) container.addChild(node)
					node.visible = true
				})
				if (!nodes.length) return

				if (state.wrap && state.width > 0) {
					const rects = layout.flow(
						layout.box(
							0,
							0,
							state.width,
							Math.max(
								1,
								Math.max(...nodes.map((n) => n.height || 0)),
							),
						),
						nodes.map((node) => ({
							w: node.width || 0,
							h: node.height || 0,
						})),
						state.gap,
						{ padding: state.padding },
					)
					rects.forEach((rect, i) => {
						nodes[i].position.set(rect.x, rect.y)
					})
				} else {
					let cursorX = state.padding
					const maxH = Math.max(...nodes.map((n) => n.height || 0))
					const totalW =
						nodes.reduce(
							(sum, node) => sum + (node.width || 0),
							0,
						) +
						state.gap * Math.max(0, nodes.length - 1)
					if (state.align === "center" && state.width > totalW) {
						cursorX = (state.width - totalW) / 2
					} else if (
						state.align === "right" &&
						state.width > totalW
					) {
						cursorX = Math.max(
							0,
							state.width - totalW - state.padding,
						)
					}

					nodes.forEach((node, index) => {
						const nodeY =
							state.valign === "top"
								? 0
								: state.valign === "bottom"
								? Math.max(0, maxH - (node.height || 0))
								: Math.max(0, (maxH - (node.height || 0)) / 2)
						node.position.set(cursorX, nodeY)
						cursorX +=
							(node.width || 0) +
							(index < nodes.length - 1 ? state.gap : 0)
					})
				}

				container._width =
					state.width ||
					nodes.reduce((sum, node) => sum + (node.width || 0), 0) +
						state.gap * Math.max(0, nodes.length - 1)
				container._height = Math.max(
					...nodes.map((n) => n.height || 0),
					0,
				)
			}

			render()

			return {
				root: container,
				render,
				resize: (width) => {
					state.width = width || state.width
					render()
				},
				setItems: (items) => {
					state.items = Array.isArray(items) ? items : []
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ActionBar: Horizontal control group.
		 */
		ActionBar(config = {}) {
			return window.SystemDeckPixiHUD.Components.InlineGroup({
				...config,
				align: config.align || "left",
				valign: config.valign || "middle",
				wrap: !!config.wrap,
			})
		},

		/**
		 * HeaderBar: Standard header surface.
		 */
		HeaderBar(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")
			const layout = HUD.Layout
			const primitives = HUD.Primitives

			let state = {
				width: config.width || 240,
				title: config.title || "",
				subtitle: config.subtitle || "",
				height:
					config.height ||
					HUD.Spacing?.control?.contentHeaderHeight ||
					HUD.Spacing?.header?.height ||
					38,
				paddingX:
					config.paddingX ??
					Math.round(
						(spacing.inset?.content || spacing.inset?.panel || 12) *
							scale.scale,
					),
				paddingY:
					config.paddingY ??
					Math.round((spacing.inset?.action || 8) * scale.scale),
				gap:
					config.gap ??
					Math.round((spacing.gap?.inline || 8) * scale.gap),
				palette: config.palette || null,
				actions: Array.isArray(config.actions) ? config.actions : [],
			}

			const titleTxt = HUD.Typography.create("title", state.title, {
				palette: state.palette,
				fontSize: Math.max(12, Math.round(13 * scale.font)),
			})
			const subtitleTxt = HUD.Typography.create("small", state.subtitle, {
				palette: state.palette,
				fontSize: Math.max(10, Math.round(10 * scale.font)),
			})
			const actions = window.SystemDeckPixiHUD.Components.InlineGroup({
				items: config.actions || [],
				density: config.density || "standard",
				gap: config.actionGap,
			})

			container.addChild(titleTxt, subtitleTxt, actions.root)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				titleTxt.text = String(state.title || "")
				titleTxt.style.fill = palette.text
				titleTxt.style.fontSize = Math.max(
					12,
					Math.round(13 * scale.font),
				)

				subtitleTxt.visible = !!state.subtitle
				subtitleTxt.text = String(state.subtitle || "")
				subtitleTxt.style.fill = palette.text
				subtitleTxt.style.fontSize = Math.max(
					10,
					Math.round(10 * scale.font),
				)

				actions.setItems(
					Array.isArray(state.actions) ? state.actions : [],
				)

				if (!state.width) return

				const leftX = state.paddingX
				titleTxt.position.set(leftX, state.paddingY)
				if (subtitleTxt.visible) {
					subtitleTxt.position.set(
						leftX,
						state.paddingY + titleTxt.height + state.gap / 2,
					)
				}

				const actionW = actions.root.width || 0
				const actionX = Math.max(
					leftX,
					state.width - state.paddingX - actionW,
				)
				actions.root.position.set(
					actionX,
					Math.max(0, (state.height - actions.root.height) / 2),
				)

				container._width = state.width
				container._height = Math.max(
					state.height,
					subtitleTxt.visible
						? subtitleTxt.y + subtitleTxt.height + state.paddingY
						: titleTxt.y + titleTxt.height + state.paddingY,
				)
			}

			render()

			return {
				root: container,
				actions: actions.root,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * FooterBar: Standard footer surface.
		 */
		FooterBar(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 240,
				summary: config.summary || "",
				status: config.status || "",
				height:
					config.height ||
					HUD.Spacing?.control?.contentFooterHeight ||
					28,
				paddingX:
					config.paddingX ??
					Math.round(
						(spacing.inset?.content || spacing.inset?.panel || 12) *
							scale.scale,
					),
				actions: Array.isArray(config.actions) ? config.actions : [],
				palette: config.palette || null,
			}

			const summaryTxt = HUD.Typography.create("small", state.summary, {
				palette: state.palette,
				fontSize: Math.max(10, Math.round(10 * scale.font)),
			})
			const statusTxt = HUD.Typography.create("value", state.status, {
				palette: state.palette,
				fontSize: Math.max(11, Math.round(11 * scale.font)),
			})
			const actions = window.SystemDeckPixiHUD.Components.InlineGroup({
				items: config.actions || [],
				density: config.density || "standard",
			})

			container.addChild(summaryTxt, statusTxt, actions.root)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				summaryTxt.text = String(state.summary || "")
				summaryTxt.style.fill = palette.text
				summaryTxt.style.fontSize = Math.max(
					10,
					Math.round(10 * scale.font),
				)

				statusTxt.text = String(state.status || "")
				statusTxt.style.fill = palette.text
				statusTxt.style.fontSize = Math.max(
					11,
					Math.round(11 * scale.font),
				)

				actions.setItems(
					Array.isArray(state.actions) ? state.actions : [],
				)

				if (!state.width) return
				summaryTxt.position.set(state.paddingX, 0)
				statusTxt.position.set(
					Math.max(
						state.paddingX,
						state.width - state.paddingX - statusTxt.width,
					),
					0,
				)
				actions.root.position.set(
					Math.max(0, (state.width - actions.root.width) / 2),
					Math.max(0, statusTxt.height + 2),
				)
				container._width = state.width
				container._height = Math.max(
					state.height,
					statusTxt.height + actions.root.height,
				)
			}

			render()

			return {
				root: container,
				actions: actions.root,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ContentBlock: Reusable container with header/footer.
		 */
		ContentBlock(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 240,
				height: config.height || 160,
				padding:
					config.padding ??
					Math.round(
						(spacing.inset?.block || spacing.inset?.panel || 12) *
							scale.scale,
					),
				gap:
					config.gap ??
					Math.round((spacing.gap?.block || 12) * scale.gap),
				title: config.title || "",
				subtitle: config.subtitle || "",
				footer: config.footer || "",
				header: config.header || null,
				actions: config.actions || [],
				palette: config.palette || null,
				variant: config.variant || "default",
			}

			const frame = new PIXI.Graphics()
			const header = new PIXI.Container()
			const content = new PIXI.Container()
			const footer = new PIXI.Container()
			container.addChild(frame, header, content, footer)

			let headerBar = null
			let footerBar = null

			function ensureBars() {
				const hasHeader = !!(state.header || state.title || state.subtitle)
				const hasFooter = !!(
					state.footer ||
					(Array.isArray(state.actions) && state.actions.length)
				)

				if (hasHeader) {
					headerBar =
						headerBar ||
						HUD.Components.HeaderBar({
							title: state.title || state.header?.title || "",
							subtitle:
								state.subtitle || state.header?.subtitle || "",
							actions: state.header?.actions || [],
							width: state.width - state.padding * 2,
							density: config.density || "standard",
							palette: state.palette,
						})
				} else if (headerBar) {
					headerBar.root.visible = false
				}

				if (hasFooter) {
					footerBar =
						footerBar ||
						HUD.Components.FooterBar({
							summary:
								state.footer?.summary || state.footer || "",
							status: state.footer?.status || "",
							actions:
								state.footer?.actions || state.actions || [],
							width: state.width - state.padding * 2,
							density: config.density || "standard",
							palette: state.palette,
						})
				} else if (footerBar) {
					footerBar.root.visible = false
				}
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				frame.clear()
				frame
					.roundRect(
						0,
						0,
						state.width,
						state.height,
						spacing.radius?.block || spacing.radius?.panel || 4,
					)
					.fill({
						color: palette.panel,
						alpha: 1,
					})
				frame
					.roundRect(
						0,
						0,
						state.width,
						state.height,
						spacing.radius?.block || spacing.radius?.panel || 4,
					)
					.stroke({
						width: 1,
						color: palette.border,
						alpha: state.variant === "elevated" ? 0.58 : 0.48,
						pixelLine: true,
					})
				if (state.variant === "elevated") {
					frame.roundRect(
						1,
						1,
						Math.max(0, state.width - 2),
						Math.max(0, state.height - 2),
						spacing.radius?.block || spacing.radius?.panel || 4,
					).stroke({
						width: 1,
						color: palette.gridStrong || palette.border,
						alpha: 0.12,
						pixelLine: true,
					})
				}
				frame.eventMode = "none"
				if (frame.parent !== container) {
					container.addChildAt(frame, 0)
				}

				if (headerBar?.root) {
					if (headerBar.root.parent !== header) {
						header.addChild(headerBar.root)
					}
				}
				if (footerBar?.root) {
					if (footerBar.root.parent !== footer) {
						footer.addChild(footerBar.root)
					}
				}
				header.visible = false
				footer.visible = false
				ensureBars()
				if (headerBar?.root) headerBar.root.visible = !!(state.header || state.title || state.subtitle)
				if (footerBar?.root) footerBar.root.visible = !!(state.footer || (Array.isArray(state.actions) && state.actions.length))

				const headerH = headerBar?.root?.visible ? headerBar.root.height : 0
				const footerH = footerBar?.root?.visible ? footerBar.root.height : 0
				const bodyY = state.padding + headerH + (headerH ? state.gap : 0)
				const bodyH = Math.max(
					0,
					state.height -
						state.padding * 2 -
						headerH -
						footerH -
						(headerH ? state.gap : 0) -
						(footerH ? state.gap : 0),
				)

				if (headerBar?.root?.visible) {
					header.visible = true
					headerBar.setState({
						title: state.title || state.header?.title || "",
						subtitle: state.subtitle || state.header?.subtitle || "",
						actions: state.header?.actions || [],
						palette: state.palette,
					})
					headerBar.resize(state.width - state.padding * 2, headerBar.root.height)
					headerBar.root.position.set(state.padding, state.padding)
				}

				content.position.set(state.padding, bodyY)
				content._width = Math.max(0, state.width - state.padding * 2)
				content._height = bodyH

				if (footerBar?.root?.visible) {
					footer.visible = true
					footerBar.setState({
						summary: state.footer?.summary || state.footer || "",
						status: state.footer?.status || "",
						actions: state.footer?.actions || state.actions || [],
						palette: state.palette,
					})
					footerBar.resize(state.width - state.padding * 2, footerBar.root.height)
					footerBar.root.position.set(
						state.padding,
						Math.max(state.padding, state.height - state.padding - footerBar.root.height),
					)
				}
			}

			render()

			return {
				root: container,
				content,
				header,
				footer,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * DeltaIndicator: Directional change indicator.
		 */
		DeltaIndicator(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				value: config.value ?? 0,
				direction: config.direction || null,
				tone: config.tone || null,
				label: config.label || "",
				precision: Number.isFinite(config.precision)
					? config.precision
					: 1,
				showArrow: config.showArrow !== false,
				palette: config.palette || null,
			}

			const arrow = HUD.Typography.create("value", "", {
				palette: state.palette,
				fontSize: Math.max(11, Math.round(11 * scale.font)),
			})
			const value = HUD.Typography.create("value", "", {
				palette: state.palette,
				fontSize: Math.max(11, Math.round(11 * scale.font)),
			})
			container.addChild(arrow, value)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const tone = HUD.State.resolveTone(
					state.tone ||
						(state.value > 0
							? "success"
							: state.value < 0
							? "critical"
							: "neutral"),
					palette,
				)
				const direction =
					state.direction ||
					(state.value > 0 ? "up" : state.value < 0 ? "down" : "flat")
				const symbol =
					direction === "up" ? "↑" : direction === "down" ? "↓" : "→"

				arrow.visible = !!state.showArrow
				arrow.text = symbol
				arrow.style.fill = tone.strong || tone.base
				value.text =
					(state.value >= 0 ? "+" : "") +
					Number(state.value || 0).toFixed(state.precision)
				value.style.fill = tone.strong || tone.base

				if (state.label) {
					value.text = `${value.text} ${state.label}`
				}

				arrow.position.set(0, 0)
				value.position.set(arrow.visible ? arrow.width + 4 : 0, 0)
				container._width = value.x + value.width
				container._height = Math.max(arrow.height, value.height)
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setData: (d) => {
					if ("value" in d) state.value = d.value
					if ("direction" in d) state.direction = d.direction
					if ("label" in d) state.label = d.label
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ValueWithUnit: Numeric value plus unit.
		 */
		ValueWithUnit(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				value: config.value ?? 0,
				unit: config.unit || "",
				precision: Number.isFinite(config.precision)
					? config.precision
					: 0,
				scaleUnit: !!config.scaleUnit,
				palette: config.palette || null,
			}

			const valueTxt = HUD.Typography.create("value", "", {
				palette: state.palette,
				fontSize: Math.max(12, Math.round(14 * scale.font)),
			})
			const unitTxt = HUD.Typography.create("small", "", {
				palette: state.palette,
				fontSize: Math.max(9, Math.round(10 * scale.font)),
			})
			container.addChild(valueTxt, unitTxt)

			function formatValue(val) {
				const numeric = Number(val)
				if (!Number.isFinite(numeric)) return String(val ?? "")
				if (!state.scaleUnit) {
					return numeric.toFixed(state.precision)
				}
				const scales = [
					{ limit: 1e9, suffix: "G" },
					{ limit: 1e6, suffix: "M" },
					{ limit: 1e3, suffix: "k" },
				]
				for (const item of scales) {
					if (Math.abs(numeric) >= item.limit) {
						return `${(numeric / item.limit).toFixed(
							state.precision,
						)}${item.suffix}`
					}
				}
				return numeric.toFixed(state.precision)
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				valueTxt.text = formatValue(state.value)
				valueTxt.style.fill = palette.text
				unitTxt.text = state.unit
				unitTxt.style.fill = palette.text
				valueTxt.position.set(0, 0)
				unitTxt.position.set(
					valueTxt.width + 4,
					valueTxt.height - unitTxt.height,
				)
				container._width = unitTxt.x + unitTxt.width
				container._height = Math.max(valueTxt.height, unitTxt.height)
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setData: (d) => {
					if ("value" in d) state.value = d.value
					if ("unit" in d) state.unit = d.unit
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * TrendIndicator: Direction + optional sparkline.
		 */
		TrendIndicator(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 140,
				height: config.height || 24,
				value: config.value ?? 0,
				samples: config.samples || [],
				showSparkline: config.showSparkline !== false,
				tone: config.tone || null,
				palette: config.palette || null,
			}

			const delta = HUD.Components.DeltaIndicator({
				value: state.value,
				tone: state.tone,
				palette: state.palette,
				density: config.density || "standard",
			})
			const spark = HUD.Components.Sparkline({
				width: Math.max(32, Math.round(state.width * 0.62)),
				height: state.height,
				samples: state.samples,
				tone: state.tone || "primary",
				palette: state.palette,
			})

			container.addChild(delta.root, spark.root)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				delta.setState({
					value: state.value,
					tone:
						state.tone ||
						(state.value >= 0 ? "success" : "critical"),
					palette: state.palette,
				})
				delta.render()
				spark.setState({
					color: palette[state.tone || "primary"] || palette.primary,
					palette: state.palette,
				})
				spark.setData(state.samples)
				spark.resize(
					Math.max(32, Math.round(state.width * 0.62)),
					state.height,
				)
				spark.root.visible = !!state.showSparkline
				delta.root.position.set(
					0,
					Math.max(0, (state.height - delta.root.height) / 2),
				)
				spark.root.position.set(
					delta.root.width + (spacing.gap?.item || 10),
					0,
				)
				container._width = spark.root.x + spark.root.width
				container._height = Math.max(
					delta.root.height,
					spark.root.height,
				)
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					if ("value" in d) state.value = d.value
					if ("samples" in d) state.samples = d.samples || []
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * ThresholdBar: Current value against threshold marks.
		 */
		ThresholdBar(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 180,
				height: config.height || 12,
				min: config.min ?? 0,
				max: config.max ?? 100,
				value: config.value ?? 0,
				thresholds: Array.isArray(config.thresholds)
					? config.thresholds
					: [],
				palette: config.palette || null,
			}

			let fill = null
			let marks = null

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				container.children.forEach((node) => { node.visible = false })

				fill = HUD.Primitives.FillBar({
					width: state.width,
					height: state.height,
					min: state.min,
					max: state.max,
					value: state.value,
					palette: state.palette,
					color: config.color ?? palette.primary ?? palette.secondary,
				})
				container.addChild(fill)

				marks = new PIXI.Container()
				state.thresholds.forEach((threshold) => {
					const normalized = HUD.Utils.normalizeValue(
						Number(threshold.value) || 0,
						state.min,
						state.max,
					)
					const x = Math.max(
						0,
						Math.min(
							state.width,
							Math.round(state.width * normalized),
						),
					)
					const mark = new PIXI.Graphics()
						.rect(x - 1, -2, 2, state.height + 4)
						.fill({
							color: threshold.color || palette.warning,
							alpha: threshold.alpha ?? 0.4,
						})
					HUD.Theme.assertThemeTokenUsage(
						threshold.color,
						"threshold mark color",
					)
					marks.addChild(mark)
				})
				container.addChild(marks)
				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * RangeIndicator: Acceptable vs danger zones.
		 */
		RangeIndicator(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}

			let state = {
				width: config.width || 180,
				height: config.height || 12,
				min: config.min ?? 0,
				max: config.max ?? 100,
				value: config.value ?? 0,
				safeMin: config.safeMin ?? config.min ?? 0,
				safeMax: config.safeMax ?? config.max ?? 100,
				palette: config.palette || null,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				container.children.forEach((node) => { node.visible = false })

				const base = HUD.Primitives.FillBar({
					width: state.width,
					height: state.height,
					min: state.min,
					max: state.max,
					value: state.max,
					palette: state.palette,
					color: palette.panelSoft,
					trackColor: palette.panelSoft,
					trackAlpha: 1,
				})
				container.addChild(base)

				const safeStart = HUD.Utils.normalizeValue(
					state.safeMin,
					state.min,
					state.max,
				)
				const safeEnd = HUD.Utils.normalizeValue(
					state.safeMax,
					state.min,
					state.max,
				)
				const safeW = Math.max(
					0,
					Math.round(state.width * (safeEnd - safeStart)),
				)
				const safeX = Math.round(state.width * safeStart)
				const safe = new PIXI.Graphics()
					.roundRect(
						safeX,
						0,
						safeW,
						state.height,
						spacing.radius?.progress || 4,
					)
					.fill({
						color: palette.success || palette.primary,
						alpha: 0.35,
					})
				container.addChild(safe)

				const markerX = Math.round(
					state.width *
						HUD.Utils.normalizeValue(
							state.value,
							state.min,
							state.max,
						),
				)
				const marker = new PIXI.Graphics()
					.rect(markerX - 1, -2, 2, state.height + 4)
					.fill({
						color: palette.critical || palette.warning,
						alpha: 0.9,
					})
				container.addChild(marker)

				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * KeyValueList: Aligned key/value pairs with truncation.
		 */
		KeyValueList(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 220,
				data: config.data || [],
				rowHeight:
					config.rowHeight ||
					HUD.Spacing?.control?.keyValueRowHeight ||
					24,
				rowGap: config.rowGap ?? spacing.gap?.tight ?? 8,
				palette: config.palette || null,
			}

			let rows = []

			function render() {
				if (!container || container.destroyed) return
				container.children.forEach((node) => { node.visible = false })
				rows = []
				const totalH =
					state.data.length * state.rowHeight +
					Math.max(0, state.data.length - 1) * state.rowGap
				const grid = layout.column(
					layout.box(0, 0, state.width, totalH),
					state.data.length,
					state.rowGap,
				)

				state.data.forEach((d, i) => {
					const row = HUD.Components.StatRow({
						label: d.label,
						value: d.value,
						width: state.width,
						height: state.rowHeight,
						palette: state.palette,
					})
					row.root.position.set(grid[i].x, grid[i].y)
					container.addChild(row.root)
					rows.push(row)
				})
				container._width = state.width
				container._height = totalH
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (dataArg) => {
					let dataArray = dataArg
					if (
						dataArg &&
						!Array.isArray(dataArg) &&
						"data" in dataArg
					) {
						dataArray = dataArg.data
					}
					state.data = Array.isArray(dataArray) ? dataArray : []
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * DataTable: Lightweight column layout.
		 */
		DataTable(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const guides = new PIXI.Graphics()
			container.addChild(guides)

			let state = {
				width: config.width || 300,
				columns: Array.isArray(config.columns) ? config.columns : [],
				rows: Array.isArray(config.rows) ? config.rows : [],
				rowHeight:
					config.rowHeight ||
					HUD.Spacing?.control?.tableRowHeight ||
					36,
				cellPaddingX: config.cellPaddingX ?? 8,
				cellPaddingY: config.cellPaddingY ?? 6,
				striped: config.striped === true,
				hoveredRow: Number.isFinite(config.hoveredRow)
					? config.hoveredRow
					: -1,
				palette: config.palette || null,
				header: config.header !== false,
			}

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				container.children.forEach((node) => { node.visible = false })
				container.addChild(guides)
				if (!state.rows.length) return

				const cols = state.columns.length
					? state.columns
					: Object.keys(state.rows[0] || {}).map((key) => ({
							key,
							label: key,
							width: 1,
					  }))
				const ratios = cols.map((col) =>
					Math.max(0, Number(col.width) || 1),
				)
				const ratioTotal =
					ratios.reduce((sum, value) => sum + value, 0) || cols.length
				const totalRows = state.rows.length + (state.header ? 1 : 0)
				const totalHeight = totalRows * state.rowHeight
				const border = palette.border
				const rowStripe = HUD.Utils.lerpColor(
					palette.presetWhite || palette.panel || 0xffffff,
					palette.text || 0x1d2327,
					0.04,
				)
				const rowHover = HUD.Utils.lerpColor(
					palette.presetWhite || palette.panel || 0xffffff,
					palette.text || 0x1d2327,
					0.075,
				)
				const columnWidths = []
				let consumed = 0
				cols.forEach((col, index) => {
					if (index === cols.length - 1) {
						columnWidths.push(Math.max(0, state.width - consumed))
						return
					}
					const width = Math.max(
						0,
						Math.round((state.width * ratios[index]) / ratioTotal),
					)
					columnWidths.push(width)
					consumed += width
				})

				if (!guides || guides.destroyed) return
				guides.clear()
				guides.moveTo(0, 0).lineTo(state.width, 0).stroke({
					width: 1,
					color: border,
					alpha: 1,
					pixelLine: true,
				})
				for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
					const y = (rowIndex + 1) * state.rowHeight
					if (y >= totalHeight) break
					guides
						.moveTo(0, y)
						.lineTo(state.width, y)
						.stroke({
							width: rowIndex === 0 && state.header ? 1 : 1,
							color: border,
							alpha: 1,
							pixelLine: true,
						})
				}

				if (state.header) {
					let x = 0
					cols.forEach((col, i) => {
						const cellW = columnWidths[i]
						const txt = HUD.Typography.create(
							"label",
							col.label || col.key || "",
							{
								palette: state.palette,
								fontSize: 12,
								fontWeight: "600",
							},
						)
						txt.style.fill = palette.text
						HUD.Utils.fitText(
							txt,
							Math.max(0, cellW - state.cellPaddingX * 2),
							0.7,
						)
						txt.position.set(
							x + state.cellPaddingX,
							Math.max(
								state.cellPaddingY,
								Math.round((state.rowHeight - txt.height) / 2),
							),
						)
						container.addChild(txt)
						x += cellW
					})
				}

				state.rows.forEach((rowData, rowIndex) => {
					const visualRowIndex = rowIndex + (state.header ? 1 : 0)
					const rowY = visualRowIndex * state.rowHeight
					if (state.striped && rowIndex % 2 === 0) {
						const stripe = new PIXI.Graphics()
						stripe
							.rect(0, rowY, state.width, state.rowHeight)
							.fill({
								color: rowStripe,
								alpha: 1,
							})
						container.addChild(stripe)
					}
					if (state.hoveredRow === rowIndex) {
						const hover = new PIXI.Graphics()
						hover.rect(0, rowY, state.width, state.rowHeight).fill({
							color: rowHover,
							alpha: 1,
						})
						container.addChild(hover)
					}
					let x = 0
					cols.forEach((col, colIndex) => {
						const cellW = columnWidths[colIndex]
						const value =
							rowData[col.key] ?? rowData[col.label] ?? ""
						const txt = HUD.Typography.create(
							"small",
							String(value),
							{
								palette: state.palette,
								fontSize: 12,
							},
						)
						txt.style.fill = palette.text
						HUD.Utils.fitText(
							txt,
							Math.max(0, cellW - state.cellPaddingX * 2),
							0.7,
						)
						txt.position.set(
							x + state.cellPaddingX,
							rowY +
								Math.max(
									state.cellPaddingY,
									Math.round(
										(state.rowHeight - txt.height) / 2,
									),
								),
						)
						container.addChild(txt)
						x += cellW
					})
				})

				container._width = state.width
				container._height = totalHeight
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					if (Array.isArray(d)) state.rows = d
					else if (d && Array.isArray(d.rows)) state.rows = d.rows
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * TimelineRow: Timestamp + value + status.
		 */
		TimelineRow(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const layout = HUD.Layout
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 260,
				timestamp: config.timestamp || "",
				value: config.value || "",
				status: config.status || "neutral",
				palette: config.palette || null,
			}

			const timeTxt = HUD.Typography.create("mono", state.timestamp, {
				palette: state.palette,
				fontSize: Math.max(11, Math.round(11 * scale.font)),
			})
			const valueTxt = HUD.Typography.create("value", state.value, {
				palette: state.palette,
				fontSize: Math.max(12, Math.round(12 * scale.font)),
			})
			const status = HUD.Components.StatusPill({
				state: state.status,
				palette: state.palette,
				density: config.density || "standard",
			})
			container.addChild(timeTxt, valueTxt, status.root)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				timeTxt.text = String(state.timestamp || "")
				timeTxt.style.fill = palette.text
				valueTxt.text = String(state.value || "")
				valueTxt.style.fill = palette.text
				status.setState({
					state: state.status,
					label: String(state.status).toUpperCase(),
				})

				timeTxt.position.set(0, 0)
				status.root.position.set(
					Math.max(0, state.width - status.root.width),
					0,
				)
				valueTxt.position.set(
					timeTxt.width + (spacing.gap?.inline || 8),
					0,
				)
				container._width = state.width
				container._height = Math.max(
					timeTxt.height,
					valueTxt.height,
					status.root.height,
				)
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * EventMarker: Chart/timeline marker.
		 */
		EventMarker(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const primitive = spacing.primitive || {}

			let state = {
				size: config.size || 8,
				label: config.label || "",
				tone: config.tone || "accent",
				shape: config.shape || "circle",
				palette: config.palette || null,
			}

			const marker = new PIXI.Graphics()
			const text = state.label
				? HUD.Typography.create("small", state.label, {
						palette: state.palette,
				  })
				: null
			container.addChild(marker)
			if (text) container.addChild(text)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const tone = HUD.State.resolveTone(state.tone, palette)
				if (!marker || marker.destroyed) return
				marker.clear()
				if (state.shape === "diamond") {
					marker
						.poly([
							0,
							-state.size / 2,
							state.size / 2,
							0,
							0,
							state.size / 2,
							-state.size / 2,
							0,
						])
						.fill({ color: tone.base || tone.strong, alpha: 1 })
				} else {
					marker.circle(0, 0, state.size / 2).fill({
						color: tone.base || tone.strong,
						alpha: 1,
					})
				}
				marker.circle(0, 0, state.size / 2 + 1).stroke({
					width: 1,
					color: tone.base || tone.strong,
					alpha: 0.35,
					pixelLine: true,
				})

				if (text) {
					text.text = String(state.label)
					text.style.fill = palette.text
					text.position.set(state.size + 4, -(text.height / 2))
				}
				container._width = state.size + (text ? text.width + 4 : 0)
				container._height = Math.max(state.size, text ? text.height : 0)
			}

			render()

			return {
				root: container,
				render,
				resize: () => render(),
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * PinHeader: Pin title row.
		 */
		PinHeader(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 240,
				title: config.title || "",
				status: config.status || "",
				icon: config.icon || null,
				palette: config.palette || null,
			}

			const icon = state.icon
				? HUD.Icon.create(state.icon, {
						size: Math.max(12, Math.round(14 * scale.icon)),
						color: state.palette ? state.palette.text : undefined,
				  })
				: null
			const title = HUD.Typography.create("title", state.title, {
				palette: state.palette,
				fontSize: Math.max(12, Math.round(13 * scale.font)),
			})
			const status = state.status
				? HUD.Components.StatusPill({
						label: state.status,
						state: state.status,
						palette: state.palette,
						density: config.density || "standard",
				  })
				: null
			if (icon) container.addChild(icon.root)
			container.addChild(title)
			if (status) container.addChild(status.root)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				title.text = String(state.title || "")
				title.style.fill = palette.text
				title.style.fontSize = Math.max(12, Math.round(13 * scale.font))

				let cursorX = 0
				if (icon) {
					icon.root.position.set(0, 0)
					cursorX += icon.root.width + (spacing.gap?.inline || 8)
				}
				title.position.set(cursorX, 0)
				cursorX += title.width + (spacing.gap?.inline || 8)

				if (status) {
					status.root.position.set(
						Math.max(cursorX, state.width - status.root.width),
						0,
					)
				}

				container._width = state.width
				container._height = Math.max(
					title.height,
					icon ? icon.root.height : 0,
					status ? status.root.height : 0,
				)
			}

			render()

			return {
				root: container,
				render,
				resize: (w) => {
					state.width = w || state.width
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * PinBody: Flexible pin body container.
		 */
		PinBody(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const block = HUD.Components.ContentBlock({
				...config,
				header: false,
				footer: false,
				variant: config.variant || "default",
			})
			container.addChild(block.root)

			return {
				root: container,
				content: block.content,
				render: block.render,
				resize: block.resize,
				setData: block.setData,
				setState: block.setState,
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},

		/**
		 * PinFooter: Optional pin footer row.
		 */
		PinFooter(config = {}) {
			return window.SystemDeckPixiHUD.Components.FooterBar(config)
		},

		/**
		 * PinFrame: Final pin surface.
		 */
		PinFrame(config = {}) {
			const HUD = window.SystemDeckPixiHUD
			const container = new PIXI.Container()
			const primitives = HUD.Primitives
			const spacing = HUD.Spacing || {}
			const scale = HUD.Scale.resolve(config.density || "standard")

			let state = {
				width: config.width || 300,
				height: config.height || 180,
				title: config.title || "",
				subtitle: config.subtitle || "",
				status: config.status || "",
				icon: config.icon || null,
				selected: !!config.selected,
				hovered: !!config.hovered,
				disabled: !!config.disabled,
				tone: config.tone || "primary",
				variant: config.variant || "default",
				density: config.density || "standard",
				palette: config.palette || null,
			}

			const content = HUD.Components.ContentBlock({
				width: state.width,
				height: state.height,
				title: state.title,
				subtitle: state.subtitle,
				density: state.density,
				palette: state.palette,
				variant: state.variant,
			})
			const accent = new PIXI.Graphics()
			const overlay = new PIXI.Graphics()
			let focus = primitives.FocusRing({
				width: state.width,
				height: state.height,
				radius: spacing.radius?.pin || spacing.radius?.panel || 12,
				palette: state.palette,
			})
			container.addChild(content.root, accent, overlay, focus)

			function render() {
				if (!container || container.destroyed) return
				const palette = state.palette || HUD.Theme.createPalette()
				const tone = HUD.State.resolveTone(state.tone, palette)
				content.resize(state.width, state.height)
				content.setState({
					title: state.title,
					subtitle: state.subtitle,
					variant: state.variant,
					palette: state.palette,
				})

				if (!accent || accent.destroyed) return
				accent.clear()
				accent
					.roundRect(0, 0, 6, state.height, spacing.radius?.pin || 12)
					.fill({
						color: tone.strong || tone.base || palette.primary,
						alpha: state.selected ? 1 : 0.9,
					})

				if (!overlay || overlay.destroyed) return
				overlay.clear()
				if (state.hovered) {
					overlay.rect(0, 0, state.width, state.height).fill({
						color: palette.panel,
						alpha: 0.05,
					})
				}
				if (state.selected) {
					overlay.rect(0, 0, state.width, state.height).stroke({
						width: 2,
						color: tone.strong || tone.base || palette.primary,
						alpha: 0.55,
					})
				}

				if (focus && focus.parent === container) {
					container.removeChild(focus)
					focus.destroy()
				}
				focus = primitives.FocusRing({
					width: state.width,
					height: state.height,
					radius: spacing.radius?.pin || spacing.radius?.panel || 12,
					palette: state.palette,
				})
				focus.visible = !!state.selected
				container.addChild(focus)

				container.alpha = state.disabled ? 0.55 : 1
				HUD.Feedback.apply(container, state, palette)
				container._width = state.width
				container._height = state.height
			}

			render()

			return {
				root: container,
				body: content.content,
				header: content.header,
				footer: content.footer,
				render,
				resize: (w, h) => {
					state.width = w || state.width
					state.height = h || state.height
					render()
				},
				setData: (d) => {
					state = { ...state, ...d }
					render()
				},
				setState: (s) => {
					state = { ...state, ...s }
					render()
				},
				destroy: () => {
					if (!container || container.destroyed) return
					
					container.destroy({ children: true })
				},
			}
		},
	}

	Object.keys(window.SystemDeckPixiHUD.Components).forEach((key) => {
		if (typeof window.SystemDeckPixiHUD.Components[key] === "function") {
			Object.freeze(window.SystemDeckPixiHUD.Components[key])
		}
	})

	/**
	 * HUD.Charts: Config-driven data visualization.
	 * Step 10: Charts
	 */
	window.SystemDeckPixiHUD.Charts = {
		/**
		 * Line Chart
		 */
		Line: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const primitives = HUD.Primitives
				const layout = HUD.Layout
				const spacing = HUD.Spacing || {}

				const w = config.width || 300
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const plotRect = layout.inset(
					layout.box(0, 0, w, h),
					spacing.inset?.chart || 16,
				)

				// Frame
				container.addChild(
					primitives.PlotFrame({
						width: w,
						height: h,
						palette: config.palette,
					}),
				)

				// Series
				const data = Array.isArray(config.data)
					? config.data
					: config.data?.data || []

				if (data.length > 0) {
					const samples = data.map((d) => d.value)
					const points = layout.plotPoints(samples, plotRect)
					container.addChild(
						primitives.SignalLine({
							points,
							color:
								config.color ??
								palette.chartSeries1 ??
								palette.chartSeries2 ??
								palette.chartSeries3 ??
								palette.accent,
							strokeWidth:
								config.strokeWidth ||
								spacing.primitive?.signalLineWidth ||
								2,
							palette: config.palette,
						}),
					)
				}
			},
		},

		/**
		 * Bar Chart
		 */
		Bar: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const primitives = HUD.Primitives
				const layout = HUD.Layout
				const spacing = HUD.Spacing || {}

				const w = config.width || 300
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const plotRect = layout.inset(
					layout.box(0, 0, w, h),
					spacing.inset?.chart || 20,
				)
				const data = Array.isArray(config.data)
					? config.data
					: config.data?.data || []

				const bars = layout.row(
					plotRect,
					data.length,
					spacing.gap?.chartBars || 4,
				)

				container.addChild(
					primitives.PlotFrame({
						width: w,
						height: h,
						palette: config.palette,
					}),
				)

				const seriesData = data.map((d) => d.value)
				const values = layout.scaleSeries(seriesData)

				bars.forEach((rect, i) => {
					const barH = (values[i] || 0) * rect.h
					const barG = new PIXI.Graphics()
						.roundRect(
							rect.x,
							rect.y + rect.h - barH,
							rect.w,
							barH,
							2,
						)
						.fill({
							color:
								config.color ??
								palette.chartSeries2 ??
								palette.chartSeries3 ??
								palette.chartSeries1 ??
								palette.chartSeries4 ??
								palette.accent,
							alpha: 0.8,
						})
					container.addChild(barG)
				})
			},
		},

		/**
		 * Pie / Donut Chart
		 */
		Pie: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const utils = HUD.Utils
				const spacing = HUD.Spacing || {}

				const w = config.width || 200
				const h = config.height || 200
				if (w <= 0 || h <= 0) return

				const radius = Math.min(w, h) / 2 - (spacing.inset?.pie || 10)
				const innerRadius = config.donut
					? config.innerRadius || radius * 0.6
					: 0

				const data = Array.isArray(config.data)
					? config.data
					: config.data?.data || []
				const total =
					data.reduce((sum, d) => sum + (Number(d.value) || 0), 0) ||
					1

				let start = -Math.PI / 2
				data.forEach((d) => {
					const val = Number(d.value) || 0
					const span = (val / total) * Math.PI * 2
					const g = new PIXI.Graphics().arc(
						w / 2,
						h / 2,
						radius,
						start,
						start + span,
					)

					if (innerRadius > 0) {
						g.arc(
							w / 2,
							h / 2,
							innerRadius,
							start + span,
							start,
							true,
						)
					} else {
						g.lineTo(w / 2, h / 2)
					}

					g.fill({
						color:
							d.color ||
							palette.chartSeries1 ||
							palette.chartSeries2 ||
							palette.chartSeries3 ||
							palette.accent,
						alpha: 0.85,
					})
					HUD.Theme.assertThemeTokenUsage(d.color, "pie slice color")
					container.addChild(g)
					start += span
				})
			},
		},

		/**
		 * Heatmap
		 */
		Heatmap: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const layout = HUD.Layout
				const utils = HUD.Utils
				const spacing = HUD.Spacing || {}

				const w = config.width || 300
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const data = config.data || [[]] // 2D array
				if (!Array.isArray(data) || !Array.isArray(data[0])) return

				const heatColors = [
					palette.chartSeries6 || palette.chartSeries1,
					palette.chartSeries1 || palette.chartSeries2,
					palette.chartSeries5 || palette.chartSeries4,
				].filter(Boolean)

				const resolveHeatColor = (value) => {
					if (!heatColors.length) return palette.text
					if (heatColors.length === 1) return heatColors[0]

					const normalized = utils.clamp(Number(value) || 0, 0, 1)
					const scaled = normalized * (heatColors.length - 1)
					const index = Math.floor(scaled)
					const nextIndex = Math.min(index + 1, heatColors.length - 1)

					if (index === nextIndex) {
						return heatColors[index]
					}

					return utils.lerpColor(
						heatColors[index],
						heatColors[nextIndex],
						scaled - index,
					)
				}

				const cols = data.length
				const rows = data[0].length

				const mainGrid = layout.grid(
					layout.box(0, 0, w, h),
					cols,
					rows,
					spacing.gap?.chartCells || 2,
				)

				data.forEach((colData, x) => {
					colData.forEach((val, y) => {
						const cell = mainGrid[x][y]
						if (!cell) return

						const g = new PIXI.Graphics()
							.roundRect(cell.x, cell.y, cell.w, cell.h, 2)
							.fill({
								color: config.color ?? resolveHeatColor(val),
								alpha: utils.clamp(
									0.15 + (Number(val) || 0) * 0.85,
									0.15,
									1,
								),
							})
						container.addChild(g)
					})
				})
			},
		},

		/**
		 * Area Chart
		 */
		Area: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const primitives = HUD.Primitives
				const layout = HUD.Layout
				const spacing = HUD.Spacing || {}

				const w = config.width || 300
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const plotRect = layout.inset(
					layout.box(0, 0, w, h),
					spacing.inset?.chart || 16,
				)
				const data = Array.isArray(config.data)
					? config.data
					: config.data?.data || []

				container.addChild(
					primitives.PlotFrame({
						width: w,
						height: h,
						palette: config.palette,
					}),
				)

				if (data.length > 0) {
					const samples = data.map((d) => d.value)
					const points = layout.plotPoints(samples, plotRect)
					const baseline = plotRect.y + plotRect.h
					const area = new PIXI.Graphics()
					if (points.length) {
						area.moveTo(points[0].x, baseline)
						points.forEach((point) => {
							area.lineTo(point.x, point.y)
						})
						area.lineTo(points[points.length - 1].x, baseline)
						area.closePath().fill({
							color:
								config.fillColor ??
								palette.chartSeries6 ??
								palette.chartSeries1,
							alpha: config.fillAlpha ?? 0.25,
						})
					}
					container.addChild(area)
					container.addChild(
						primitives.SignalLine({
							points,
							color:
								config.color ??
								palette.chartSeries1 ??
								palette.chartSeries2,
							strokeWidth:
								config.strokeWidth ||
								spacing.primitive?.signalLineWidth ||
								2,
							palette: config.palette,
						}),
					)
				}
			},
		},

		/**
		 * AreaChart: Named alias for Area renderer.
		 */
		AreaChart: {
			render(container, config = {}) {
				window.SystemDeckPixiHUD.Charts.Area.render(container, config)
			},
		},

		/**
		 * StackedAreaChart: Layered area series.
		 */
		StackedAreaChart: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const layout = HUD.Layout
				const spacing = HUD.Spacing || {}

				const w = config.width || 300
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const series = Array.isArray(config.series)
					? config.series
					: Array.isArray(config.data)
					? config.data
					: []
				if (!series.length) return

				container.addChild(
					HUD.Primitives.PlotFrame({
						width: w,
						height: h,
						palette: config.palette,
					}),
				)

				const plotRect = layout.inset(
					layout.box(0, 0, w, h),
					spacing.inset?.chart || 16,
				)
				const pointCount = Math.max(
					...series.map((s) =>
						Array.isArray(s) ? s.length : s.data?.length || 0,
					),
					0,
				)
				if (!pointCount) return

				const cumulative = Array.from({ length: pointCount }, () => 0)
				const colors = [
					palette.chartSeries1,
					palette.chartSeries2,
					palette.chartSeries3,
					palette.chartSeries4,
					palette.chartSeries5,
					palette.chartSeries6,
					palette.accent,
				].filter(Boolean)

				series.forEach((seriesItem, seriesIndex) => {
					const values = Array.isArray(seriesItem)
						? seriesItem
						: seriesItem.data || seriesItem.values || []
					const samples = values.map((value, index) => {
						cumulative[index] =
							(cumulative[index] || 0) + (Number(value) || 0)
						return cumulative[index]
					})
					const points = layout.plotPoints(samples, plotRect)
					const baseline = plotRect.y + plotRect.h
					const area = new PIXI.Graphics()
					if (points.length) {
						area.moveTo(points[0].x, baseline)
						points.forEach((point) => area.lineTo(point.x, point.y))
						area.lineTo(points[points.length - 1].x, baseline)
						area.closePath().fill({
							color:
								(seriesItem && seriesItem.color) ||
								colors[seriesIndex % colors.length] ||
								palette.primary,
							alpha: seriesItem?.alpha ?? 0.28,
						})
						HUD.Theme.assertThemeTokenUsage(
							seriesItem?.color,
							"stacked area color",
						)
					}
					container.addChild(area)
				})
			},
		},

		/**
		 * RadialGauge: Gauge-style chart wrapper.
		 */
		RadialGauge: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const layout = HUD.Layout
				const w = config.width || 180
				const h = config.height || 180
				if (w <= 0 || h <= 0) return

				const gauge = HUD.Components.Gauge({
					...config,
					width: w,
					height: h,
					tone: config.tone || "secondary",
				})
				container.addChild(gauge.root)
				if (gauge.resize) gauge.resize(w, h)
				const box = gauge.getBoundsBox ? gauge.getBoundsBox() : null
				const gaugeW =
					box?.width || gauge.root._width || gauge.root.width || w
				const gaugeH =
					box?.height || gauge.root._height || gauge.root.height || h
				const pos = layout.center(
					layout.box(0, 0, w, h),
					gaugeW,
					gaugeH,
				)
				gauge.root.position.set(pos.x, pos.y)
			},
		},

		/**
		 * MiniBarChart: Compact bar series.
		 */
		MiniBarChart: {
			render(container, config = {}) {
				container.children.forEach((node) => { node.visible = false })
				const HUD = window.SystemDeckPixiHUD
				const palette = config.palette || HUD.Theme.createPalette()
				const layout = HUD.Layout
				const spacing = HUD.Spacing || {}

				const w = config.width || 180
				const h = config.height || 48
				if (w <= 0 || h <= 0) return

				const data = Array.isArray(config.data)
					? config.data
					: config.data?.data || []
				if (!data.length) return

				const plotRect = layout.inset(
					layout.box(0, 0, w, h),
					spacing.inset?.chart || 8,
				)
				const bars = layout.row(
					plotRect,
					data.length,
					spacing.gap?.chartBars || 2,
				)

				container.addChild(
					HUD.Primitives.PlotFrame({
						width: w,
						height: h,
						radius: spacing.radius?.chart || 4,
						palette: config.palette,
					}),
				)

				const values = layout.scaleSeries(
					data.map((d) => d.value),
					{ min: config.min, max: config.max },
				)
				bars.forEach((rect, i) => {
					const barH = Math.max(
						0,
						Math.round((values[i] || 0) * rect.h),
					)
					const bar = new PIXI.Graphics()
						.roundRect(
							rect.x,
							rect.y + rect.h - barH,
							rect.w,
							barH,
							2,
						)
						.fill({
							color:
								data[i].color ||
								palette.chartSeries1 ||
								palette.chartSeries2 ||
								palette.accent,
							alpha: data[i].alpha ?? 0.85,
						})
					HUD.Theme.assertThemeTokenUsage(
						data[i]?.color,
						"mini bar color",
					)
					container.addChild(bar)
				})
			},
		},
	}

	/**
	 * HUD.Registry: Component and chart factory.
	 * Step 11: Registry
	 */
	window.SystemDeckPixiHUD.Registry = {
		_components: {},
		_charts: {},

		registerComponent(name, factory) {
			this._components[name] = factory
		},

		createComponent(name, options) {
			const factory =
				this._components[name] ||
				window.SystemDeckPixiHUD.Components[name]
			if (!factory) return null
			return factory.call(window.SystemDeckPixiHUD.Components, options)
		},

		registerChart(name, renderer) {
			this._charts[name] = renderer
		},

		createChart(name, containerOrOptions, maybeOptions = {}) {
			const renderer =
				this._charts[name] || window.SystemDeckPixiHUD.Charts[name]
			if (!renderer) return null

			const hasContainer =
				containerOrOptions &&
				typeof containerOrOptions.addChild === "function"
			const container = hasContainer ? containerOrOptions : null
			let options = hasContainer
				? maybeOptions || {}
				: containerOrOptions || {}
			const root = new PIXI.Container()
			let mountedContainer = container

			const instance = {
				root,
				render(target = mountedContainer) {
					if (target && root.parent !== target) {
						target.addChild(root)
					}
					mountedContainer = target || mountedContainer
					renderer.render(root, options)
					return instance
				},
				setData(dataArg) {
					// Handle both raw array and { data: [] } wrapper
					const data =
						dataArg && !Array.isArray(dataArg) && "data" in dataArg
							? dataArg.data
							: dataArg
					options = Object.assign({}, options, { data })
					if (mountedContainer || root.parent) {
						instance.render(mountedContainer || root.parent)
					}
					return instance
				},
				resize(width, height) {
					options = Object.assign({}, options, { width, height })
					if (mountedContainer || root.parent) {
						instance.render(mountedContainer || root.parent)
					}
					return instance
				},
				setOptions(nextOptions = {}) {
					options = Object.assign({}, options, nextOptions)
					if (mountedContainer || root.parent) {
						instance.render(mountedContainer || root.parent)
					}
					return instance
				},
				destroy() {
					if (root.parent) {
						root.parent.removeChild(root)
					}
					root.destroy({ children: true })
				},
			}

			if (hasContainer) {
				instance.render(container)
			}

			return instance
		},
	}

	/**
	 * SystemDeckPixiHUDEngine
	 * Primary runtime for Pixi-based HUD interfaces.
	 */
	class SystemDeckPixiHUDEngine {
		constructor(rootEl, options = {}) {
			this.rootEl = rootEl
			this.options = Object.assign(
				{
					mode: "standalone",
					logicalWidth: null,
					logicalHeight: null,
					viewportPolicy: "stretch",
					autoDensity: true,
					resolution: window.devicePixelRatio || 1,
				},
				options,
			)

			this.mode = this.options.mode

			this.app = null
			this.surface = null
			this.initialized = false
			this.destroyed = false
			this.layers = {}
			this.payload = null
			this.lastDataHash = ""
			this.isStaticDirty = true
			this.isDataDirty = false
			this.resizeObserver = null
			this._rendering = false

			// Register for global refresh
			window.SystemDeckPixiHUD.EngineInstances.push(this)

			this.tick = this.tick.bind(this)
			this.onResize = this.onResize.bind(this)
		}

		/**
		 * Force a full theme refresh and redraw.
		 */
		refreshThemeAndRedraw() {
			if (this._rendering) return
			window.SystemDeckPixiHUD.Theme.clearCache()
			this.isStaticDirty = true
			this.lastDataHash = ""
			if (this.payload) {
				this.draw(this.payload, true)
			}
		}

		/**
		 * Lifecycle: Initialization and Mount.
		 */
		async mount() {
			if (!this.rootEl) return
			this.destroyed = false

			this.app = new PIXI.Application()
			await this.app.init({
				resizeTo: this.rootEl,
				backgroundAlpha: 0,
				antialias: true,
				autoDensity: this.options.autoDensity !== false,
				resolution:
					this.options.resolution || window.devicePixelRatio || 1,
			})

			this.rootEl.innerHTML = ""
			this.rootEl.appendChild(this.app.canvas)

			// Initialize Theme
			window.SystemDeckPixiHUD.Theme.refreshColors()

			// Create Layers
			const layerNames = ["bg", "static", "dynamic", "interaction"]
			layerNames.forEach((name) => {
				this.layers[name] = new PIXI.Container()
				this.app.stage.addChild(this.layers[name])
			})

			// Initial Scene Build
			this.buildScene()
			this.isStaticDirty = true

			this.initialized = true
			this.app.ticker.add(this.tick)

			if (typeof ResizeObserver === "function") {
				this.resizeObserver = new ResizeObserver(() => {
					this.onResize()
				})
				this.resizeObserver.observe(this.rootEl)
			} else {
				window.addEventListener("resize", this.onResize)
			}

			this.onResize()
		}

		destroy() {

			if (this.resizeObserver) {
				this.resizeObserver.disconnect()
				this.resizeObserver = null
			} else {
				window.removeEventListener("resize", this.onResize)
			}

			if (this.app) {
				this.app.ticker.remove(this.tick)
				this.app.destroy(true, {
					children: true,
					texture: true,
					baseTexture: true,
				})
			}

			this.app = null
			this.surface = null
			this.layers = {}

			// Deregister
			window.SystemDeckPixiHUD.EngineInstances =
				window.SystemDeckPixiHUD.EngineInstances.filter(
					(i) => i !== this,
				)
		}

		/**
		 * Core Update Loop.
		 */
		tick() {
			if (this.destroyed || !this.initialized) return

			const now = performance.now()

			// Update Animation System
			window.SystemDeckPixiHUD.Animation.update(now)

			// Orchestrate Scene Rendering
			if (this.payload && this.isDataDirty) {
				const state = this.getStateObject()
				this.renderDynamic(this.payload, state)
				this.isDataDirty = false
			}
		}

		/**
		 * Surface Scaling and Positioning.
		 */
		onResize() {
			if (!this.app || !this.app.stage || !this.rootEl) return

			const surface = this.calculateSurface()
			this.surface = surface

			if (this.app.renderer?.resize) {
				this.app.renderer.resize(
					surface.containerWidth,
					surface.containerHeight,
				)
			}

			// Enforce Theme Refresh on resize (in case of media queries / scheme changes)
			window.SystemDeckPixiHUD.Theme.refreshColors()

			// Widget UI mode: full-fill surface, no contained scene offsetting
			this.app.stage.scale.set(surface.scaleX, surface.scaleY)
			this.app.stage.position.set(surface.offsetX, surface.offsetY)

			// Full Static Redraw on Resize
			if (this.payload) {
				this.renderStatic(this.payload, this.getStateObject())
				this.isStaticDirty = false
			} else if (this.isStaticDirty) {
				this.renderStatic({}, this.getStateObject())
				this.isStaticDirty = false
			}
		}

		calculateSurface() {
			const rect = this.rootEl.getBoundingClientRect()
			const cw = Math.max(1, Math.floor(rect.width))
			const ch = Math.max(1, Math.floor(rect.height))

			const policy = this.options.viewportPolicy || "stretch"

			// Responsive widget mode:
			// - if logicalWidth/logicalHeight are not explicitly supplied, use container size
			// - stretch means full-fill with no letterboxing
			const baseLogicalWidth =
				Number.isFinite(this.options.logicalWidth) &&
				this.options.logicalWidth > 0
					? this.options.logicalWidth
					: cw

			const baseLogicalHeight =
				Number.isFinite(this.options.logicalHeight) &&
				this.options.logicalHeight > 0
					? this.options.logicalHeight
					: ch

			if (policy === "stretch") {
				return {
					containerWidth: cw,
					containerHeight: ch,
					logicalWidth: cw,
					logicalHeight: ch,
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					offsetX: 0,
					offsetY: 0,
					dpr:
						this.options.resolution || window.devicePixelRatio || 1,
				}
			}

			const scaleX = cw / baseLogicalWidth
			const scaleY = ch / baseLogicalHeight
			const scale =
				policy === "cover"
					? Math.max(scaleX, scaleY)
					: Math.min(scaleX, scaleY)

			const offsetX = Math.round((cw - baseLogicalWidth * scale) / 2)
			const offsetY = Math.round((ch - baseLogicalHeight * scale) / 2)

			return {
				containerWidth: cw,
				containerHeight: ch,
				logicalWidth: baseLogicalWidth,
				logicalHeight: baseLogicalHeight,
				scale,
				scaleX: scale,
				scaleY: scale,
				offsetX,
				offsetY,
				dpr: this.options.resolution || window.devicePixelRatio || 1,
			}
		}

		/**
		 * Scene Interface.
		 */
		draw(payload, forceStatic = false) {
			if (this._rendering) return
			this._rendering = true
			try {
			this.payload = payload || {}
			const nextHash = this.hashPayload(this.payload)
			this.isDataDirty = forceStatic || nextHash !== this.lastDataHash
			this.lastDataHash = nextHash

			if (forceStatic || this.isStaticDirty) {
				this.renderStatic(this.payload, this.getStateObject())
				this.isStaticDirty = false
			}

			if (forceStatic) {
				this.isDataDirty = true
			}
			} finally {
				this._rendering = false
			}
		}

		hashPayload(payload) {
			try {
				return JSON.stringify(payload, (key, value) =>
					typeof value === "function" ? undefined : value,
				)
			} catch (error) {
				return String(Date.now())
			}
		}

		getStateObject() {
			return {
				surface: this.surface,
				layers: this.layers,
				theme: window.SystemDeckPixiHUD.Theme,
				layout: window.SystemDeckPixiHUD.Layout,
				animation: window.SystemDeckPixiHUD.Animation,
				interaction: window.SystemDeckPixiHUD.Interaction,
				registry: window.SystemDeckPixiHUD.Registry,
				isStaticDirty: this.isStaticDirty,
				isDataDirty: this.isDataDirty,
				options: this.options,
			}
		}

		/**
		 * Scene Hooks (TO BE OVERRIDDEN BY SCENE IMPLEMENTATION)
		 */
		buildScene() {}
		renderStatic(payload, state) {}
		renderDynamic(payload, state) {}
	}

	window.SystemDeckPixiHUDEngine = SystemDeckPixiHUDEngine
})()
