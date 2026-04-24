;(function () {
	"use strict"

	const PIXI = window.PIXI
	const Engine = window.SystemDeckPixiHUDEngine

	if (!PIXI || !Engine) {
		console.warn("HUD Atlas Scene: Missing PIXI or Engine")
		return
	}

	class HudAtlasScene extends Engine {
		makeAnchorId(title) {
			return `sd-hud-atlas-item-${String(title || "")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")}`
		}

		buildScene() {
			const HUD = window.SystemDeckPixiHUD
			const Registry = HUD?.Registry
			const Typography = HUD?.Typography

			if (!HUD || !Registry || !Typography) return

			this.root = new PIXI.Container()
			this.layers.dynamic.addChild(this.root)

			this.bg = new PIXI.Graphics()
			this.border = new PIXI.Graphics()
			this.title = Typography.create(
				"title",
				"HUD ATLAS",
				{ fontSize: 18 },
			)
			this.subtitle = Typography.create(
				"small",
				"FOUR-COLUMN REUSABLE DESIGN SYSTEM GALLERY",
			)
			this.tileLayer = new PIXI.Container()
			this.root.addChild(
				this.bg,
				this.border,
				this.title,
				this.subtitle,
				this.tileLayer,
			)

			this.catalog = this.buildCatalog(HUD, Registry)
		}

		buildCatalog(HUD, Registry) {
			const primitives = HUD.Primitives
			const components = HUD.Components
			const charts = HUD.Charts
			const spacing = HUD.Spacing || {}

			const componentSpec = (title, name, options = {}) => ({
				title,
				anchorId: options.anchorId || this.makeAnchorId(title),
				subtitle: options.subtitle || "COMPONENT",
				kind: "component",
				height: options.height || 180,
				layout: options.layout || "center",
				previewScale: options.previewScale ?? 0.8,
				clampPreview: options.clampPreview === true,
				create: ({ palette, contentW, contentH }) => {
					if (typeof options.create === "function") {
						return options.create({
							HUD,
							Registry,
							palette,
							contentW,
							contentH,
						})
					}
					const cfg =
					typeof options.config === "function"
							? options.config({
									HUD,
									palette,
									contentW,
									contentH,
							  })
							: { ...(options.config || {}) }
					cfg.palette = palette
					const instance = Registry.createComponent(name, cfg)
					if (instance?.root) {
						instance.root.position.set(0, 0)
					}
					if (typeof options.afterCreate === "function") {
						options.afterCreate(instance, {
							HUD,
							palette,
							contentW,
							contentH,
						})
					}
					return instance
				},
				resize: options.resize || null,
			})

			const chartSpec = (title, name, options = {}) => ({
				title,
				anchorId: options.anchorId || this.makeAnchorId(title),
				subtitle: options.subtitle || "CHART",
				kind: "chart",
				height: options.height || 210,
				layout: options.layout || "fill",
				clampPreview: options.clampPreview === true,
				create: ({ palette, contentW, contentH }) => {
					const cfg =
					typeof options.config === "function"
							? options.config({
									HUD,
									palette,
									contentW,
									contentH,
							  })
							: { ...(options.config || {}) }
					cfg.palette = palette
					cfg.width = cfg.width || contentW
					cfg.height = cfg.height || contentH
					const instance = Registry.createChart(name, cfg)
					return instance
				},
			})

			const primitiveSpec = (title, draw, options = {}) => ({
				title,
				anchorId: options.anchorId || this.makeAnchorId(title),
				subtitle: options.subtitle || "PRIMITIVE",
				kind: "primitive",
				height: options.height || 150,
				layout: options.layout || "center",
				clampPreview: options.clampPreview === true,
				create: ({ palette, contentW, contentH }) => {
					const host = new PIXI.Container()
					const root = draw({
						HUD,
						components,
						primitives,
						palette,
						contentW,
						contentH,
					})
					if (root) {
						host.addChild(root)
					}
					return { root: host }
				},
			})

			return [
				primitiveSpec("Hairline", ({ primitives, palette, contentW }) => {
					const g = primitives.Hairline({
						length: Math.max(44, contentW - 32),
						color: palette.gridStrong,
						alpha: 0.45,
					})
					g.position.set(16, 18)
					return g
				}),
				primitiveSpec("GlowStroke", ({ primitives, palette, contentW, contentH }) => {
					const g = primitives.GlowStroke({
						width: Math.max(100, contentW - 40),
						height: Math.max(40, contentH - 50),
						radius: 4,
						color: palette.primaryStrong,
						glowColor: palette.accent,
					})
					return g
				}),
				primitiveSpec("FocusRing", ({ primitives, palette, contentW, contentH }) => {
					const g = primitives.FocusRing({
						width: Math.max(120, contentW - 32),
						height: Math.max(72, contentH - 28),
						radius: 4,
						color: palette.secondaryStrong,
					})
					return g
				}),
				primitiveSpec("LegendItem", ({ primitives, palette }) => {
					const item = primitives.LegendItem({
						dotSize: 6,
						color: palette.secondaryStrong || palette.secondary,
					})
					return item
				}),
				componentSpec("StatusDot", "StatusDot", {
					height: 140,
					layout: "center",
					config: ({ palette }) => ({
						state: "success",
						size: 8,
						ringSize: 12,
						palette,
					}),
					resize: (preview) => {
						if (preview?.resize) {
							preview.resize(8, 12)
						}
					},
				}),
				primitiveSpec("Divider", ({ primitives, palette, contentW, contentH }) => {
					const divider = primitives.Divider({
						length: Math.max(140, contentW - 28),
						color: palette.borderSubtle || palette.border,
						alpha: 0.85,
					})
					return divider
				}),
				primitiveSpec("ButtonFrame", ({ primitives, palette, contentW }) => {
					return primitives.ButtonFrame({
						width: Math.max(160, contentW - 28),
						height: 28,
						radius: 4,
						fill: palette.panel,
						stroke: palette.border,
						strokeAlpha: 1,
					})
				}),
				primitiveSpec("BadgeFrame", ({ primitives, palette, contentW }) => {
					return primitives.BadgeFrame({
						width: Math.max(120, contentW - 60),
						height: 28,
						radius: 999,
						fill: palette.panelSoft,
						stroke: palette.border,
						alpha: 1,
					})
				}),
				primitiveSpec("PlotFrame", ({ primitives, palette, contentW, contentH }) => {
					return primitives.PlotFrame({
						width: Math.max(160, contentW - 28),
						height: Math.max(100, contentH - 36),
						radius: 4,
						palette,
					})
				}),
				componentSpec("Card", "Card", {
					height: 232,
					layout: "center",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: Math.max(170, Math.min(210, contentH - 24)),
						header: {
							title: "Featured",
							subtitle: "Card header",
						},
						body: {
							title: "Card title",
							subtitle: "Card subtitle",
							text: "Some quick example text to build on the card title.",
						},
						footer: {
							summary: "Card footer",
							status: "READY",
						},
						palette,
					}),
				}),
				componentSpec("CardHeader", "CardHeader", {
					height: 132,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 52,
						title: "Featured",
						subtitle: "Card header",
						borderBottom: true,
						palette,
					}),
				}),
				componentSpec("CardBody", "CardBody", {
					height: 150,
					layout: "center",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 108,
						title: "Card title",
						subtitle: "Card subtitle",
						text: "This is some text within a card body.",
						palette,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const bg = HUD.Primitives.Card({
							width: instance.root._width || 240,
							height: instance.root._height || 108,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						instance.root.addChildAt(bg, 0)
					},
				}),
				componentSpec("CardFooter", "CardFooter", {
					height: 132,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 52,
						summary: "Card footer",
						status: "READY",
						borderTop: true,
						palette,
					}),
				}),
				componentSpec("CardListGroup", "CardListGroup", {
					height: 180,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						rowHeight: 38,
						items: [
							{ label: "An item" },
							{ label: "A second item" },
							{ label: "A third item", showDivider: false },
						],
						palette,
					}),
				}),
				componentSpec("CardListGroupCentered", "CardListGroup", {
					height: 180,
					layout: "center",
					subtitle: "CENTERED ROWS",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						rowHeight: 38,
						align: "center",
						items: [
							{ label: "Centered" },
							{ label: "Shared Rows" },
							{ label: "Preview", showDivider: false },
						],
						palette,
					}),
				}),
				componentSpec("CardListGroupHover", "CardListGroup", {
					height: 180,
					layout: "center",
					subtitle: "HOVER ROWS",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						rowHeight: 38,
						align: "between",
						hoverEnabled: true,
						items: [
							{ label: "Server Time", value: "Live" },
							{ label: "Browser Time", value: "Synced" },
							{ label: "Ping", value: "22ms", showDivider: false },
						],
						palette,
					}),
				}),
				componentSpec("CardListGroupFlush", "CardListGroup", {
					height: 180,
					layout: "center",
					subtitle: "COMPONENT",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						rowHeight: 38,
						flush: true,
						items: [
							{ label: "An item" },
							{ label: "A second item" },
							{ label: "A third item", showDivider: false },
						],
						palette,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const headerHeight = 56
						const listHeight = instance.root._height || 114
						const card = HUD.Components.Card({
							width: instance.root._width || 240,
							height: headerHeight + listHeight,
							header: {
								title: "Featured",
								subtitle: "",
							},
							body: null,
							footer: null,
							palette,
						})
						instance.root.position.set(0, headerHeight)
						card.root.addChild(instance.root)
						instance.root = card.root
					},
				}),
				componentSpec("CardListItem", "CardListItem", {
					height: 120,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 38,
						label: "An item",
						value: "Value",
						showDivider: true,
						palette,
					}),
				}),
				componentSpec("CardListItemBetween", "CardListItem", {
					height: 120,
					layout: "center",
					subtitle: "BETWEEN ALIGN",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 38,
						label: "Browser Time",
						value: "14:22:10",
						align: "between",
						showDivider: false,
						palette,
					}),
				}),
				componentSpec("CardTitle", "CardTitle", {
					height: 112,
					layout: "center",
					config: ({ palette }) => ({
						text: "Card title",
						palette,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const paddingX = 16
						const paddingY = 14
						const innerWidth = Math.ceil(instance.root.width)
						const innerHeight = Math.ceil(instance.root.height)
						instance.root.children.forEach((child) => {
							child.position.x += paddingX
							child.position.y += paddingY
						})
						const bg = HUD.Primitives.Card({
							width: innerWidth + paddingX * 2,
							height: innerHeight + paddingY * 2,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						instance.root.addChildAt(bg, 0)
					},
				}),
				componentSpec("CardSubtitle", "CardSubtitle", {
					height: 112,
					layout: "center",
					config: ({ palette }) => ({
						text: "Card subtitle",
						palette,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const paddingX = 16
						const paddingY = 14
						const innerWidth = Math.ceil(instance.root.width)
						const innerHeight = Math.ceil(instance.root.height)
						instance.root.children.forEach((child) => {
							child.position.x += paddingX
							child.position.y += paddingY
						})
						const bg = HUD.Primitives.Card({
							width: innerWidth + paddingX * 2,
							height: innerHeight + paddingY * 2,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						instance.root.addChildAt(bg, 0)
					},
				}),
				componentSpec("CardText", "CardText", {
					height: 128,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, Math.min(260, contentW - 48)),
						text: "Some quick example text to build on the card title.",
						palette,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const paddingX = 16
						const paddingY = 14
						const innerWidth = Math.ceil(instance.root.width)
						const innerHeight = Math.ceil(instance.root.height)
						instance.root.children.forEach((child) => {
							child.position.x += paddingX
							child.position.y += paddingY
						})
						const bg = HUD.Primitives.Card({
							width: innerWidth + paddingX * 2,
							height: innerHeight + paddingY * 2,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						instance.root.addChildAt(bg, 0)
					},
				}),
				componentSpec("TextTruncate", "TextTruncate", {
					height: 112,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(160, Math.min(220, contentW - 56)),
						text: "This is a long line that should truncate cleanly inside the preview surface.",
						palette,
						surfaceColor: palette.presetWhite || palette.panel,
					}),
					afterCreate: (instance, { HUD, palette }) => {
						const paddingX = 16
						const paddingY = 14
						const innerWidth = Math.ceil(instance.root.width)
						const innerHeight = Math.ceil(instance.root.height)
						instance.root.children.forEach((child) => {
							child.position.x += paddingX
							child.position.y += paddingY
						})
						const bg = HUD.Primitives.Card({
							width: innerWidth + paddingX * 2,
							height: innerHeight + paddingY * 2,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						instance.root.addChildAt(bg, 0)
					},
				}),
				componentSpec("Collapse", "Collapse", {
					height: 176,
					layout: "center",
					config: ({ HUD, palette, contentW }) => {
						const width = Math.max(220, Math.min(280, contentW - 36))
						const body = HUD.Components.CardBody({
							width,
							height: 92,
							title: "Card title",
							subtitle: "Card subtitle",
							text: "This content region is owned by Collapse and can be reused as accordion content.",
							palette,
							surfaceColor: palette.presetWhite || palette.panel,
						})
						return {
							width,
							content: body.root,
							contentHeight: 92,
							expanded: true,
						}
					},
					afterCreate: (instance, { HUD, palette }) => {
						const width = instance.root._width || 240
						const headerHeight = 52
						const collapseHeight = instance.root._height || 92
						const demo = new PIXI.Container()
						const frame = HUD.Primitives.Card({
							width,
							height: headerHeight + collapseHeight,
							radius: 4,
							fill: palette.presetWhite || palette.panel,
							stroke: palette.border,
							strokeAlpha: 1,
							palette,
						})
						const header = HUD.Components.CardHeader({
							width,
							height: headerHeight,
							title: "Disclosure",
							subtitle: "",
							borderBottom: true,
							palette,
						})
						instance.root.position.set(0, headerHeight)
						demo.addChild(frame, header.root, instance.root)
						instance.root = demo
					},
				}),
				componentSpec("Tabs", "Tabs", {
					height: 196,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 148,
						items: [
							{ label: "Overview", title: "Overview", subtitle: "Tab one", text: "Primary panel content for the selected tab." },
							{ label: "Metrics", title: "Metrics", subtitle: "Tab two", text: "Secondary panel content for the selected tab." },
							{ label: "Logs", title: "Logs", subtitle: "Tab three", text: "Tertiary panel content for the selected tab." },
						],
						activeIndex: 0,
						palette,
					}),
				}),
				componentSpec("TabsPills", "Tabs", {
					height: 196,
					layout: "center",
					subtitle: "PILLS",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 148,
						variant: "pills",
						items: [
							{ label: "Overview", title: "Overview", subtitle: "Tab one", text: "Primary panel content for the selected tab." },
							{ label: "Metrics", title: "Metrics", subtitle: "Tab two", text: "Secondary panel content for the selected tab." },
							{ label: "Logs", title: "Logs", subtitle: "Tab three", text: "Tertiary panel content for the selected tab." },
						],
						activeIndex: 0,
						palette,
					}),
				}),
				componentSpec("TabsBoxed", "Tabs", {
					height: 196,
					layout: "center",
					subtitle: "BOXED",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 148,
						variant: "boxed",
						items: [
							{ label: "Overview", title: "Overview", subtitle: "Tab one", text: "Primary panel content for the selected tab." },
							{ label: "Metrics", title: "Metrics", subtitle: "Tab two", text: "Secondary panel content for the selected tab." },
							{ label: "Logs", title: "Logs", subtitle: "Tab three", text: "Tertiary panel content for the selected tab." },
						],
						activeIndex: 0,
						palette,
					}),
				}),
				componentSpec("Accordion", "Accordion", {
					height: 232,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						items: [
							{ label: "Section One", title: "First section", subtitle: "Expanded", text: "Accordion content for the first panel." },
							{ label: "Section Two", title: "Second section", subtitle: "", text: "Accordion content for the second panel." },
							{ label: "Section Three", title: "Third section", subtitle: "", text: "Accordion content for the third panel." },
						],
						activeIndex: 0,
						panelHeight: 82,
						palette,
					}),
				}),
				componentSpec("Pagination", "Pagination", {
					height: 120,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						current: 2,
						total: 5,
						palette,
					}),
				}),
				componentSpec("AlertInfo", "Alert", {
					height: 68,
					layout: "center",
					subtitle: "ALERT TEXT",
					previewScale: 1,
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 36,
						state: "info",
						title: "",
						text: "A simple info alert, check it out!",
						palette,
					}),
				}),
				componentSpec("AlertSuccess", "Alert", {
					height: 68,
					layout: "center",
					subtitle: "ALERT TEXT",
					previewScale: 1,
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 36,
						state: "success",
						title: "",
						text: "A simple success alert, check it out!",
						palette,
					}),
				}),
				componentSpec("AlertWarning", "Alert", {
					height: 68,
					layout: "center",
					subtitle: "ALERT TEXT",
					previewScale: 1,
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 36,
						state: "warning",
						title: "",
						text: "A simple warning alert, check it out!",
						palette,
					}),
				}),
				componentSpec("AlertError", "Alert", {
					height: 68,
					layout: "center",
					subtitle: "ALERT TEXT",
					previewScale: 1,
					config: ({ palette, contentW }) => ({
						width: Math.max(220, Math.min(280, contentW - 36)),
						height: 36,
						state: "error",
						title: "",
						text: "A simple error alert, check it out!",
						palette,
					}),
				}),
				primitiveSpec("Grid", ({ primitives, palette, contentW, contentH }) => {
					return primitives.Grid({
						width: Math.max(160, contentW - 28),
						height: Math.max(100, contentH - 36),
						columns: 6,
						rows: 4,
						color: palette.grid,
						alpha: 0.9,
					})
				}),
				primitiveSpec("Axis", ({ primitives, palette, contentW, contentH }) => {
					const axis = primitives.Axis({
						length: Math.max(160, contentW - 28),
						ticks: 6,
						color: palette.gridStrong,
						alpha: 0.8,
					})
					return axis
				}),
				primitiveSpec("SignalLine", ({ primitives, palette, contentW }) => {
					const line = primitives.SignalLine({
						points: [
							{ x: 8, y: 44 },
							{ x: Math.max(48, contentW * 0.4), y: 16 },
							{ x: Math.max(96, contentW * 0.75), y: 28 },
							{ x: Math.max(140, contentW - 20), y: 10 },
						],
						strokeWidth: 3,
						color: palette.primary,
					})
					return line
				}),
				primitiveSpec("Ring", ({ primitives, palette, contentW, contentH }) => {
					const size = Math.max(72, Math.min(contentW, contentH) - 24)
					const ring = primitives.Ring({
						radius: size / 2,
						strokeWidth: 4,
						color: palette.secondaryStrong || palette.secondary,
					})
					const host = new PIXI.Container()
					host._width = size
					host._height = size
					host.hitArea = new PIXI.Rectangle(0, 0, size, size)
					ring.position.set(size / 2, size / 2)
					host.addChild(ring)
					return host
				}),
				primitiveSpec("Needle", ({ primitives, palette, contentW, contentH }) => {
					const size = Math.max(72, Math.min(contentW, contentH) - 24)
					const needle = primitives.Needle({
						length: size / 2 - 8,
						strokeWidth: 4,
						color: palette.accent || palette.warning,
					})
					const host = new PIXI.Container()
					host._width = size
					host._height = size
					host.hitArea = new PIXI.Rectangle(0, 0, size, size)
					needle.position.set(size / 2, size / 2)
					host.addChild(needle)
					return host
				}),
				primitiveSpec("GradientFill", ({ primitives, palette, contentW, contentH }) => {
					const gradient = primitives.GradientFill({
						type: "linear",
						start: { x: 0, y: 0 },
						end: { x: 1, y: 1 },
						colorStops: [
							{ offset: 0, color: palette.primarySoft || palette.primary },
							{ offset: 0.5, color: palette.secondary || palette.secondarySoft },
							{ offset: 1, color: palette.accent || palette.warning },
						],
					})
					return new PIXI.Graphics()
						.roundRect(
							0,
							0,
							Math.max(120, contentW - 36),
							Math.max(54, contentH - 48),
							4,
						)
						.fill(gradient)
				}),
				primitiveSpec("ShadowLayer", ({ primitives, palette, contentW }) => {
					const shadow = primitives.ShadowLayer({
						width: Math.max(120, contentW - 40),
						height: 58,
						radius: 4,
						alpha: 0.18,
					})
					const surface = new PIXI.Graphics()
						.roundRect(0, 0, Math.max(120, contentW - 40), 58, 4)
						.fill({ color: palette.panel, alpha: 1 })
					const host = new PIXI.Container()
					host.addChild(shadow, surface)
					return host
				}),
				primitiveSpec("CornerBadgeAnchor", ({ primitives, palette, contentW, contentH }) => {
					const host = new PIXI.Container()
					const guideSize = 24
					const guideX = Math.max(24, contentW - guideSize - 56)
					const guideY = 24
					const guide = new PIXI.Graphics()
						.roundRect(
							guideX,
							guideY,
							guideSize,
							guideSize,
							4,
						)
						.stroke({
							width: 1,
							color: palette.border,
							alpha: 0.45,
							pixelLine: true,
						})
					const marker = primitives.CornerBadgeAnchor({
						size: 12,
						color: palette.accent || palette.warning,
						alpha: 0.95,
					})
					marker.position.set(guideX + guideSize / 2, guideY + guideSize / 2)
					host._width = contentW
					host._height = contentH
					host.hitArea = new PIXI.Rectangle(0, 0, contentW, contentH)
					host.addChild(guide, marker)
					return host
				}, { clampPreview: true }),
				componentSpec("Button", "Button", {
					height: 128,
					layout: "center",
					previewScale: 0.9,
					clampPreview: true,
					resize: (preview, contentW) => {
						if (preview?.resize) {
							preview.resize(
								Math.max(118, Math.min(146, contentW - 64)),
								28,
							)
						}
					},
					config: ({ palette, contentW }) => ({
						label: "Primary Action",
						width: Math.max(118, Math.min(146, contentW - 64)),
						height: 28,
						palette,
					}),
				}),
				componentSpec("IconButton", "IconButton", {
					height: 128,
					layout: "center",
					previewScale: 1,
					clampPreview: true,
					resize: (preview) => {
						if (preview?.resize) {
							preview.resize(32)
						}
					},
					config: ({ palette }) => ({
						icon: "update",
						size: 32,
						palette,
					}),
				}),
				componentSpec("Spinner", "Spinner", {
					height: 112,
					layout: "center",
					previewScale: 1,
					resize: (preview) => {
						if (preview?.resize) {
							preview.resize(16)
						}
					},
					config: ({ palette }) => ({
						size: 16,
						color: palette.primary || palette.buttonColor,
						variant: "border",
						palette,
					}),
				}),
				componentSpec("Badge", "Badge", {
					height: 112,
					layout: "center",
					config: ({ palette }) => ({
						label: "FRAMEWORK",
						palette,
					}),
				}),
				componentSpec("StatusBadge", "StatusBadge", {
					height: 112,
					layout: "center",
					config: ({ palette }) => ({
						label: "SYNCED",
						state: "success",
						palette,
					}),
				}),
				componentSpec("StatusPill", "StatusPill", {
					height: 112,
					layout: "center",
					config: ({ palette }) => ({
						label: "LIVE",
						state: "info",
						palette,
					}),
				}),
				componentSpec("SectionHeader", "SectionHeader", {
					height: 120,
					layout: "fill",
					previewScale: 0.75,
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 28),
						text: "Section Header",
						showDivider: true,
						palette,
					}),
				}),
				componentSpec("Tooltip", "Tooltip", {
					height: 160,
					layout: "center",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 40),
						text: "Tooltip helper / hover note",
						palette,
					}),
					afterCreate: (instance) => {
						if (instance?.show) {
							instance.show(0, 0, "Tooltip helper / hover note")
						}
					},
				}),
				componentSpec("ProgressBar", "ProgressBar", {
					height: 108,
					layout: "center",
					previewScale: 1,
					resize: (preview, contentW) => {
						if (preview?.resize) {
							preview.resize(Math.max(180, contentW - 52), 16)
						}
					},
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 52),
						height: 16,
						progress: 0.72,
						showLabel: true,
						color: palette.primary || palette.primaryStrong,
						trackColor: palette.panelSoft || palette.border,
						radius: 4,
						palette,
					}),
				}),
				componentSpec("ProgressBarLabel", "ProgressBar", {
					height: 108,
					layout: "center",
					previewScale: 1,
					resize: (preview, contentW) => {
						if (preview?.resize) {
							preview.resize(Math.max(180, contentW - 52), 16)
						}
					},
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 52),
						height: 16,
						progress: 0.54,
						showLabel: true,
						label: "54%",
						color: palette.success || palette.primary,
						trackColor: palette.panelSoft || palette.border,
						radius: 4,
						palette,
					}),
				}),
				componentSpec("ProgressBarStacked", "ProgressBar", {
					height: 108,
					layout: "center",
					previewScale: 1,
					resize: (preview, contentW) => {
						if (preview?.resize) {
							preview.resize(Math.max(180, contentW - 52), 16)
						}
					},
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 52),
						height: 16,
						segments: [
							{ value: 35, color: palette.success || 0x198754 },
							{ value: 22, color: palette.warning || 0xffc107 },
							{ value: 18, color: palette.danger || 0xdc3545 },
						],
						min: 0,
						max: 100,
						trackColor: palette.panelSoft || palette.border,
						radius: 4,
						palette,
					}),
				}),
				componentSpec("ProgressBarStriped", "ProgressBar", {
					height: 108,
					layout: "center",
					previewScale: 1,
					resize: (preview, contentW) => {
						if (preview?.resize) {
							preview.resize(Math.max(180, contentW - 52), 16)
						}
					},
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 52),
						height: 16,
						progress: 0.68,
						showLabel: true,
						striped: true,
						animated: true,
						color: palette.info || palette.primary,
						trackColor: palette.panelSoft || palette.border,
						radius: 4,
						palette,
					}),
				}),
				componentSpec("DeltaIndicator", "DeltaIndicator", {
					height: 150,
					layout: "center",
					config: ({ palette }) => ({
						value: 7.4,
						label: "ms",
						tone: "success",
						palette,
					}),
				}),
				componentSpec("TrendIndicator", "TrendIndicator", {
					height: 170,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(160, contentW - 24),
						height: 36,
						value: -3.2,
						samples: [12, 18, 14, 21, 19, 25, 22, 28],
						showSparkline: true,
						tone: "primary",
						palette,
					}),
				}),
				componentSpec("ValueWithUnit", "ValueWithUnit", {
					height: 150,
					layout: "center",
					config: ({ palette }) => ({
						value: 42,
						unit: "ms",
						precision: 0,
						palette,
					}),
				}),
				componentSpec("ThresholdBar", "ThresholdBar", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(160, contentW - 24),
						height: 14,
						min: 0,
						max: 100,
						value: 68,
						thresholds: [
							{ value: 25, color: palette.warning },
							{ value: 75, color: palette.critical },
						],
						palette,
					}),
				}),
				componentSpec("RangeIndicator", "RangeIndicator", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(160, contentW - 24),
						height: 14,
						min: 0,
						max: 100,
						value: 64,
						safeMin: 22,
						safeMax: 78,
						palette,
					}),
				}),
				componentSpec("StatRow", "StatRow", {
					height: 120,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						label: "Clock",
						value: "12:00:00",
						width: Math.max(160, contentW - 24),
						palette,
					}),
				}),
				componentSpec("DataList", "DataList", {
					height: 190,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(160, contentW - 24),
						data: [
							{ label: "Server", value: "Normal" },
							{ label: "WP", value: "Normal" },
							{ label: "Browser", value: "Aligned" },
						],
						palette,
					}),
				}),
				componentSpec("KeyValueGrid", "KeyValueGrid", {
					height: 190,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 24),
						cols: 2,
						data: [
							{ label: "TZ", value: "UTC" },
							{ label: "Drift", value: "+14ms" },
							{ label: "Ping", value: "22ms" },
							{ label: "Mode", value: "Live" },
						],
						palette,
					}),
				}),
				componentSpec("KeyValueList", "KeyValueList", {
					height: 180,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 24),
						data: [
							{ label: "Server", value: "UTC" },
							{ label: "WP", value: "WP" },
							{ label: "Browser", value: "Browser" },
						],
						palette,
					}),
				}),
				componentSpec("DataTable", "DataTable", {
					height: 210,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(200, contentW - 24),
						columns: [
							{ key: "name", label: "Name", width: 1 },
							{ key: "value", label: "Value", width: 1 },
							{ key: "state", label: "State", width: 1 },
						],
						rows: [
							{ name: "Server", value: "UTC", state: "normal" },
							{ name: "WP", value: "Aligned", state: "normal" },
							{ name: "Browser", value: "Synced", state: "normal" },
						],
						palette,
					}),
				}),
				componentSpec("DataTableStriped", "DataTable", {
					height: 210,
					layout: "fill",
					subtitle: "STRIPED",
					config: ({ palette, contentW }) => ({
						width: Math.max(200, contentW - 24),
						striped: true,
						columns: [
							{ key: "name", label: "Name", width: 1.2 },
							{ key: "value", label: "Value", width: 1 },
							{ key: "state", label: "State", width: 1 },
						],
						rows: [
							{ name: "Server Time", value: "UTC", state: "normal" },
							{ name: "WP Local", value: "Aligned", state: "normal" },
							{ name: "Browser Time", value: "Synced", state: "normal" },
						],
						palette,
					}),
				}),
				componentSpec("TimelineRow", "TimelineRow", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 24),
						timestamp: "12:00",
						value: "Sync complete",
						status: "success",
						palette,
					}),
				}),
				componentSpec("EventMarker", "EventMarker", {
					height: 130,
					layout: "center",
					config: ({ palette }) => ({
						size: 12,
						label: "EVENT",
						tone: "accent",
						palette,
					}),
				}),
				componentSpec("HeaderBar", "HeaderBar", {
					height: 170,
					layout: "fill",
					config: ({ palette, contentW }) => {
						const actionA = HUD.Components.Button({
							label: "Edit",
							width: 80,
							height: 28,
							variant: "subtle",
							palette,
						})
						const actionB = HUD.Components.IconButton({
							icon: "edit",
							size: 28,
							variant: "round",
							palette,
						})
						return {
							width: Math.max(220, contentW - 24),
							title: "Header Bar",
							subtitle: "Title, subtitle, actions",
							actions: [actionA.root, actionB.root],
							palette,
						}
					},
				}),
				componentSpec("FooterBar", "FooterBar", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => {
						const action = HUD.Components.Button({
							label: "Commit",
							width: 90,
							height: 28,
							palette,
						})
						return {
							width: Math.max(220, contentW - 24),
							summary: "Footer summary",
							status: "READY",
							actions: [action.root],
							palette,
						}
					},
				}),
				componentSpec("ActionBar", "ActionBar", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => {
						const a = HUD.Components.Button({
							label: "Play",
							width: 72,
							height: 28,
							palette,
						})
						const b = HUD.Components.Button({
							label: "Pause",
							width: 72,
							height: 28,
							variant: "subtle",
							palette,
						})
						const c = HUD.Components.Button({
							label: "Stop",
							width: 72,
							height: 28,
							variant: "outline",
							palette,
						})
						return {
							width: Math.max(220, contentW - 24),
							items: [a.root, b.root, c.root],
							wrap: false,
							palette,
						}
					},
				}),
				componentSpec("InlineGroup", "InlineGroup", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => {
						const a = HUD.Components.Badge({
							label: "ONE",
							palette,
						})
						const b = HUD.Components.Badge({
							label: "TWO",
							palette,
							color: palette.secondaryStrong,
						})
						const c = HUD.Components.StatusPill({
							label: "THREE",
							state: "warning",
							palette,
						})
						return {
							width: Math.max(220, contentW - 24),
							items: [a.root, b.root, c.root],
							palette,
						}
					},
				}),
				componentSpec("PinHeader", "PinHeader", {
					height: 160,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, contentW - 24),
						title: "Pin Header",
						status: "LIVE",
						icon: "admin-generic",
						palette,
					}),
				}),
				componentSpec("PinFooter", "PinFooter", {
					height: 150,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(220, contentW - 24),
						summary: "Pin actions",
						status: "READY",
						palette,
					}),
				}),
				componentSpec("Gauge", "Gauge", {
					height: 220,
					layout: "center",
					config: ({ palette }) => ({
						radius: 62,
						value: 0.64,
						tone: "secondary",
						palette,
					}),
				}),
				componentSpec("ClockFace", "ClockFace", {
					height: 250,
					layout: "fill",
					subtitle: "COMPONENT",
					create: ({ HUD, palette, contentW, contentH }) => {
						const root = HUD.Components.ClockFace()
						return {
							root,
							render: () => {
								root.render({
									cx: contentW / 2,
									cy: Math.max(68, contentH * 0.48),
									radius: Math.max(42, Math.min(contentW * 0.22, contentH * 0.34)),
									date: new Date("2026-04-10T17:33:51"),
									palette: {
										...palette,
										ring: palette.primary,
										ringSoft: palette.primarySoft,
										tick: palette.primaryStrong || palette.primary,
										hour: palette.primaryStrong || palette.primary,
										minute: palette.primarySoft || palette.primary,
										second: palette.alertCaution || palette.warning || palette.accent,
										cap: palette.panel,
										logo: palette.borderSubtle || palette.primarySoft,
									},
								})
							},
						}
					},
				}),
				componentSpec("DigitalReadout", "DigitalReadout", {
					height: 170,
					layout: "fill",
					subtitle: "COMPONENT",
					create: ({ HUD, palette, contentW, contentH }) => {
						const root = HUD.Components.DigitalReadout()
						return {
							root,
							render: () => {
								const width = Math.max(132, Math.min(contentW * 0.6, 196))
								const height = Math.max(40, Math.min(contentH * 0.46, 52))
								root.render({
									x: Math.round((contentW - width) / 2),
									y: Math.round((contentH - height) / 2),
									width,
									height,
									value: "17:33:51",
									palette: {
										...palette,
										digitalText: palette.primarySoft || palette.primary,
										ring: palette.primary,
										ringSoft: palette.primarySoft,
									},
								})
							},
						}
					},
				}),
				componentSpec("Sparkline", "Sparkline", {
					height: 170,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(180, contentW - 24),
						height: 54,
						samples: [10, 14, 13, 22, 18, 27, 24, 31],
						palette,
					}),
				}),
				componentSpec("MiniTrend", "MiniTrend", {
					height: 184,
					layout: "fill",
					config: ({ palette, contentW }) => ({
						width: Math.max(190, contentW - 20),
						height: 56,
						samples: [12, 16, 14, 18, 20, 19, 21, 17, 22, 24],
						latest: "24ms",
						color: palette.primaryStrong || palette.primary,
						strokeWidth: 3.5,
						paddingY: 2,
						palette,
					}),
				}),
				chartSpec("Line", "Line", {
					height: 220,
					layout: "fill",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(200, contentW - 24),
						height: Math.max(130, contentH - 12),
						data: [
							{ label: "1", value: 12 },
							{ label: "2", value: 18 },
							{ label: "3", value: 14 },
							{ label: "4", value: 26 },
							{ label: "5", value: 21 },
							{ label: "6", value: 28 },
						],
						palette,
					}),
				}),
				chartSpec("AreaChart", "Area", {
					height: 220,
					layout: "fill",
					subtitle: "AREA",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(200, contentW - 24),
						height: Math.max(130, contentH - 12),
						data: [
							{ label: "1", value: 6 },
							{ label: "2", value: 14 },
							{ label: "3", value: 12 },
							{ label: "4", value: 22 },
							{ label: "5", value: 17 },
							{ label: "6", value: 26 },
						],
						palette,
					}),
				}),
				chartSpec("StackedArea", "StackedAreaChart", {
					height: 220,
					layout: "fill",
					subtitle: "STACKED AREA",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(200, contentW - 24),
						height: Math.max(130, contentH - 12),
						series: [
							[2, 3, 5, 4, 6, 7],
							[1, 2, 1, 3, 2, 4],
						],
						palette,
					}),
				}),
				chartSpec("Bar", "Bar", {
					height: 220,
					layout: "fill",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(200, contentW - 24),
						height: Math.max(130, contentH - 12),
						color: palette.primaryStrong || palette.primary,
						data: [
							{ label: "A", value: 4 },
							{ label: "B", value: 7 },
							{ label: "C", value: 5 },
							{ label: "D", value: 9 },
						],
						palette,
					}),
				}),
				chartSpec("MiniBar", "MiniBarChart", {
					height: 190,
					layout: "fill",
					subtitle: "MINI BAR",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(180, contentW - 24),
						height: Math.max(96, contentH - 12),
						color: palette.primaryStrong || palette.primary,
						data: [
							{ label: "One", value: 4 },
							{ label: "Two", value: 7 },
							{ label: "Three", value: 5 },
							{ label: "Four", value: 9 },
						],
						palette,
					}),
				}),
				chartSpec("Pie", "Pie", {
					height: 220,
					layout: "fill",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(160, contentW - 24),
						height: Math.max(160, contentH - 12),
						donut: true,
						data: [
							{ label: "Normal", value: 64, color: palette.success },
							{ label: "Warn", value: 24, color: palette.warning },
							{ label: "Crit", value: 12, color: palette.critical },
						],
						palette,
					}),
				}),
				chartSpec("RadialGauge", "RadialGauge", {
					height: 220,
					layout: "center",
					subtitle: "RADIAL",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(160, contentW - 24),
						height: Math.max(160, contentH - 12),
						value: 0.72,
						tone: "secondary",
						palette,
					}),
				}),
				chartSpec("Heatmap", "Heatmap", {
					height: 220,
					layout: "fill",
					config: ({ palette, contentW, contentH }) => ({
						width: Math.max(220, contentW - 24),
						height: Math.max(150, contentH - 12),
						data: [
							[0.2, 0.3, 0.5, 0.4],
							[0.6, 0.7, 0.3, 0.2],
							[0.8, 1.0, 0.7, 0.4],
							[0.4, 0.5, 0.6, 0.3],
						],
						palette,
					}),
				}),
			]
		}

		getPalette(state) {
			const theme = state?.theme || window.SystemDeckPixiHUD?.Theme
			return theme.createPalette("default")
		}

		clearTileLayer() {
			if (!this.tileLayer) return
			const children = this.tileLayer.removeChildren()
			children.forEach((child) => {
				if (child && !child.destroyed) {
					child.destroy({ children: true })
				}
			})
		}

		layoutTilePreview(spec, preview, host, palette, contentW, contentH) {
			if (!preview) return

			if (typeof preview.setState === "function") {
				preview.setState({ palette })
			}

			if (typeof preview.setData === "function" && spec.data) {
				preview.setData(spec.data)
			}

			if (typeof preview.resize === "function") {
				if (typeof spec.resize === "function") {
					spec.resize(preview, contentW, contentH)
				} else {
					preview.resize(contentW, contentH)
				}
			}

			const root = preview.root || preview
			if (!root || !root.position) return

				if (root.parent !== host) {
					host.addChild(root)
				}

				if (spec.clampPreview) {
						const clip = new PIXI.Graphics()
						clip.rect(0, 0, Math.max(0, contentW), Math.max(0, contentH)).fill({
							color: 0xffffff,
						alpha: 1,
					})
					clip.alpha = 0.001
					host.addChildAt(clip, 0)
					host.mask = clip
				}

			if (typeof preview.render === "function") {
				preview.render(host)
			}

			const previewScale = Number(spec.previewScale)
			if (
				Number.isFinite(previewScale) &&
				previewScale > 0 &&
				previewScale !== 1 &&
				root.scale
			) {
				root.scale.set(previewScale)
			}

			const layout = spec.layout || "center"
			if (layout === "fill" || layout === "top") {
				root.position.set(0, 0)
				return
			}

			const width = root.width || root._width || 0
			const height = root.height || root._height || 0
			root.position.set(
				Math.max(0, (contentW - width) / 2),
				Math.max(0, (contentH - height) / 2),
			)
		}

		syncAtlasAnchors(anchors, contentHeight) {
			if (!this.rootEl?.parentElement) return

			const layer =
				this.anchorLayer ||
				this.rootEl.parentElement.querySelector('[data-role="anchors"]')
			if (!layer) return

			this.anchorLayer = layer
			layer.innerHTML = ""
			layer.style.height = `${Math.max(0, Math.ceil(contentHeight))}px`

			anchors.forEach((anchor) => {
				if (!anchor?.id) return
				const marker = document.createElement("span")
				marker.id = anchor.id
				marker.className = "sd-hud-atlas__anchor"
				marker.setAttribute("aria-hidden", "true")
				marker.style.top = `${Math.max(0, Math.round(anchor.y))}px`
				layer.appendChild(marker)
			})
		}

		renderStatic(payload, state) {
			const HUD = window.SystemDeckPixiHUD
			const layout = HUD?.Layout
			const surface = state?.surface
			if (!surface || !layout) return

			const palette = this.getPalette(state)
			const snap = (value) => Math.round(value)
			const snapRect = (rect) => ({
				x: snap(rect.x),
				y: snap(rect.y),
				w: snap(rect.w),
				h: snap(rect.h),
			})
			const place = (target, x, y) => {
				if (!target || !target.position) return
				target.position.set(snap(x), snap(y))
			}

			const w = surface.logicalWidth
			const h = surface.logicalHeight
			const embedded = this.mode === "embedded"
			const topOffset = embedded ? 12 : 56
			const outer = layout.inset(
				layout.box(0, topOffset, w, h - topOffset),
				18,
			)
			const columns = 4
			const gapX = 16
			const gapY = 16
			const tileW = Math.max(
				220,
				Math.floor((outer.w - gapX * (columns - 1)) / columns),
			)

			if (embedded) {
				this.bg.clear()
				this.border.clear()
				this.title.visible = false
				this.subtitle.visible = false
			} else {
				this.bg.clear()
				this.bg.rect(0, 0, w, h).fill({ color: palette.canvas, alpha: 1 })

				this.border.clear()
				this.border.rect(1, 1, w - 2, h - 2).stroke({
					width: 1,
					color: palette.border,
					alpha: 0.8,
					pixelLine: true,
				})
				this.title.visible = true
				this.subtitle.visible = true
			}

			this.title.text = "HUD ATLAS"
			this.title.style.fill = palette.primaryStrong || palette.primary
			this.subtitle.text = "FOUR-COLUMN REUSABLE DESIGN SYSTEM GALLERY"
			this.subtitle.style.fill = palette.text
			place(this.title, 18, embedded ? 0 : 12)
			place(this.subtitle, 18, embedded ? 18 : 30)

			this.clearTileLayer()

			const rowHeights = []
			for (let i = 0; i < this.catalog.length; i += columns) {
				const rowSpecs = this.catalog.slice(i, i + columns)
				rowHeights.push(
					Math.max(
						...rowSpecs.map((spec) => Math.max(120, spec.height || 180)),
					),
				)
			}

			let cursorY = outer.y
			const anchors = []
			for (let rowIndex = 0; rowIndex < rowHeights.length; rowIndex++) {
				const rowSpecs = this.catalog.slice(rowIndex * columns, rowIndex * columns + columns)
				const rowHeight = rowHeights[rowIndex]

				rowSpecs.forEach((spec, colIndex) => {
					const x = outer.x + colIndex * (tileW + gapX)
					const rect = snapRect({
						x,
						y: cursorY,
						w: tileW,
						h: rowHeight,
					})

					const panel = HUD.Components.Panel({
						width: rect.w,
						height: rect.h,
						title: spec.title,
						subtitle: spec.subtitle,
						variant: "soft",
						palette,
					})
					panel.root.position.set(rect.x, rect.y)
					this.tileLayer.addChild(panel.root)
					anchors.push({
						id: spec.anchorId,
						y: rect.y + 8,
					})

					const host = new PIXI.Container()
					panel.content.addChild(host)

					const innerW = Math.max(0, rect.w - 24)
					const innerH = Math.max(0, rect.h - 52)
					const preview = spec.create({
						HUD,
						Registry: HUD.Registry,
						palette,
						host,
						contentW: innerW,
						contentH: innerH,
						tileW: rect.w,
						tileH: rect.h,
					})

					const normalized =
						preview && preview.root
							? preview
							: { root: preview, resize: null, setState: null, setData: null, render: null }

					this.layoutTilePreview(
						spec,
						normalized,
						host,
						palette,
						innerW,
						innerH,
					)
				})

				cursorY += rowHeight + gapY
			}

			const contentHeight = cursorY + (embedded ? 0 : 18)
			this.syncAtlasAnchors(anchors, contentHeight)
			const minHeight = Math.ceil(Math.max(contentHeight, embedded ? 1200 : 1400))
			this.rootEl.style.minHeight = `${minHeight}px`
			if (this.rootEl.parentElement) {
				this.rootEl.parentElement.style.minHeight = `${minHeight}px`
				this.rootEl.parentElement.style.height = "auto"
			}
		}

		renderDynamic() {}
	}

	window.SystemDeckHudAtlasPixiScene = {
		create(rootEl, options = {}) {
			return new HudAtlasScene(rootEl, options)
		},
	}
})()
