/**
 * SystemDeck Inspector HUD (Retail Edition)
 * Version 1.6.0 (Full Parity with FSE)
 */
;(function (wp) {
	const {
		render,
		useState,
		useEffect,
		useMemo,
		Fragment,
		createElement: el,
	} = wp.element
	const { PanelBody, Button, Dashicon } = wp.components

	const telemetry = window.sd_retail_vars?.telemetry || null
	let computedScale = { colors: {}, fonts: {}, spacing: {} }

	const DesignUtils = {
		getSetting: (path) => {
			if (!telemetry || !telemetry.settings) return null
			return path
				.split(".")
				.reduce((o, i) => (o ? o[i] : null), telemetry.settings)
		},
		getStyle: (path, blockName = null, tagName = null) => {
			if (!telemetry || !telemetry.styles) return null
			const styles = telemetry.styles
			if (tagName) {
				const tagStyle = path
					.split(".")
					.reduce(
						(o, i) => (o ? o[i] : null),
						styles.elements ? styles.elements[tagName] : null,
					)
				if (tagStyle) return tagStyle
			}
			if (blockName) {
				const blockStyle = path
					.split(".")
					.reduce(
						(o, i) => (o ? o[i] : null),
						styles.blocks ? styles.blocks[blockName] : null,
					)
				if (blockStyle) return blockStyle
				const genericTag = blockName.split("/").pop()
				const genericStyle = path
					.split(".")
					.reduce(
						(o, i) => (o ? o[i] : null),
						styles.elements ? styles.elements[genericTag] : null,
					)
				if (genericStyle) return genericStyle
			}
			return path.split(".").reduce((o, i) => (o ? o[i] : null), styles)
		},
		probeScale: function () {
			if (!telemetry) return
			const ghost = document.createElement("div")
			ghost.id = "sd-scale-prober-retail"
			ghost.style.visibility = "hidden"
			ghost.style.position = "fixed"
			ghost.style.pointerEvents = "none"
			document.body.appendChild(ghost)

			const pal = [
				this.getSetting("color.palette.theme"),
				this.getSetting("color.palette.default"),
				this.getSetting("color.palette.custom"),
			]
			pal.forEach((p) => {
				if (Array.isArray(p))
					p.forEach((c) => {
						ghost.style.color = c.color
						computedScale.colors[
							window.getComputedStyle(ghost).color
						] = c
					})
			})

			const sizes = [
				this.getSetting("typography.fontSizes.theme"),
				this.getSetting("typography.fontSizes.default"),
			]
			sizes.forEach((sList) => {
				if (Array.isArray(sList))
					sList.forEach((s) => {
						ghost.style.fontSize = s.size
						computedScale.fonts[
							window.getComputedStyle(ghost).fontSize
						] = s
					})
			})

			const spacing = [
				this.getSetting("spacing.spacingScale.steps"),
				this.getSetting("spacing.spacingSizes"),
			]
			spacing.forEach((sList) => {
				if (Array.isArray(sList))
					sList.forEach((s) => {
						ghost.style.marginTop = s.size
						computedScale.spacing[
							window.getComputedStyle(ghost).marginTop
						] = s
					})
			})

			document.body.removeChild(ghost)
		},
		correlateColor: function (val) {
			if (computedScale.colors[val]) return computedScale.colors[val]
			const rgba = val.match(
				/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
			)
			const target = rgba
				? [parseInt(rgba[1]), parseInt(rgba[2]), parseInt(rgba[3])]
				: null
			if (!target) return null
			for (let v in computedScale.colors) {
				const c = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
				if (
					c &&
					parseInt(c[1]) === target[0] &&
					parseInt(c[2]) === target[1] &&
					parseInt(c[3]) === target[2]
				)
					return computedScale.colors[v]
			}
			return null
		},
		correlateFontSize: function (val) {
			if (computedScale.fonts[val]) return computedScale.fonts[val]
			const targetPx = parseFloat(val)
			let best = null,
				diff = 999
			for (let v in computedScale.fonts) {
				const d = Math.abs(parseFloat(v) - targetPx)
				if (d < 1.1 && d < diff) {
					diff = d
					best = computedScale.fonts[v]
				}
			}
			return best
		},
		correlateFontFamily: function (val) {
			const families = [
				this.getSetting("typography.fontFamilies.theme"),
				this.getSetting("typography.fontFamilies.default"),
			]
			const clean = val
				.replace(/['"]/g, "")
				.split(",")[0]
				.trim()
				.toLowerCase()
			for (let fList of families) {
				if (Array.isArray(fList)) {
					const match = fList.find(
						(f) =>
							f.fontFamily.toLowerCase().includes(clean) ||
							f.name.toLowerCase().includes(clean),
					)
					if (match) return match
				}
			}
			return null
		},
		correlateSpacing: function (val) {
			if (computedScale.spacing[val]) return computedScale.spacing[val]
			const targetPx = parseFloat(val)
			for (let v in computedScale.spacing) {
				if (Math.abs(parseFloat(v) - targetPx) < 0.5)
					return computedScale.spacing[v]
			}
			return null
		},
		correlateLineHeight: function (val, fontSizePx) {
			if (!val || val === "normal") return null
			const heightPx = parseFloat(val)
			if (isNaN(heightPx)) return null
			const ratio = (heightPx / fontSizePx).toFixed(3)
			const common = [
				"1.0",
				"1.125",
				"1.1",
				"1.2",
				"1.3",
				"1.4",
				"1.5",
				"1.6",
				"1.7",
				"1.8",
			]
			const match = common.find(
				(r) => Math.abs(parseFloat(r) - parseFloat(ratio)) < 0.01,
			)
			return match || ratio
		},
		correlateGradient: function (val) {
			if (!val || val === "none") return null
			const match = val.match(
				/var\(--wp--preset--gradient--([a-z0-9-]+)\)/,
			)
			if (match) {
				const slug = match[1]
				const gradients = [
					this.getSetting("color.gradients.theme"),
					this.getSetting("color.gradients.default"),
				]
				for (let gList of gradients) {
					if (Array.isArray(gList)) {
						const found = gList.find((g) => g.slug === slug)
						if (found) return found
					}
				}
				return { slug: slug, name: slug }
			}
			return null
		},
	}

	DesignUtils.probeScale()

	const InspectorField = ({
		label,
		dna,
		matchType,
		blockName,
		tagName,
		stylePath,
		forceShow = false,
	}) => {
		if (!dna) return null
		const isInherited = dna.isInherited && !dna.isSet
		const val = dna.rendered
		if (
			!dna.isSet &&
			!forceShow &&
			(val === "0px" ||
				val === "none" ||
				val === "normal" ||
				val === "static" ||
				val === "rgba(0, 0, 0, 0)")
		)
			return null

		let sourceVal = stylePath
			? DesignUtils.getStyle(stylePath, blockName, tagName)
			: null
		let jsonMatch = null

		if (sourceVal) {
			const slug =
				sourceVal.match(
					/var:preset\|(color|font-size|spacing|gradient)\|([a-z0-9-]+)/,
				)?.[2] ||
				sourceVal.match(
					/var\(--wp--preset--(color|font-size|spacing|gradient)--([a-z0-9-]+)\)/,
				)?.[2]

			if (slug) {
				const groupKey = stylePath.includes("color")
					? "color.palette"
					: stylePath.includes("fontSize")
					? "typography.fontSizes"
					: stylePath.includes("gradient")
					? "color.gradients"
					: "spacing.spacingSizes"
				const palettes = [
					DesignUtils.getSetting(`${groupKey}.theme`),
					DesignUtils.getSetting(`${groupKey}.default`),
				]
				palettes.forEach((p) => {
					if (Array.isArray(p)) {
						const found = p.find((item) => item.slug === slug)
						if (found) jsonMatch = found
					}
				})
				if (jsonMatch)
					sourceVal =
						jsonMatch.size ||
						jsonMatch.color ||
						jsonMatch.gradient ||
						sourceVal
			}
		}

		let match = jsonMatch ? jsonMatch : null
		if (!match) {
			if (matchType === "color") match = DesignUtils.correlateColor(val)
			if (matchType === "size") match = DesignUtils.correlateFontSize(val)
			if (matchType === "family")
				match = DesignUtils.correlateFontFamily(val)
			if (matchType === "spacing")
				match = DesignUtils.correlateSpacing(val)
			if (matchType === "gradient")
				match = DesignUtils.correlateGradient(val)
		}

		let displayVal = sourceVal || val
		if (match && !sourceVal) {
			displayVal =
				match.color ||
				match.size ||
				match.fontFamily ||
				match.gradient ||
				val
		}
		let slugVal = match ? match.slug || match.name || "" : ""

		if (label === "Line Height") {
			const lh = DesignUtils.correlateLineHeight(
				val,
				parseFloat(dna.fontSizePx || 16),
			)
			if (lh || sourceVal) displayVal = sourceVal || lh
		}

		return el(
			"div",
			{ className: "sd-sidebar-field", style: { marginBottom: "12px" } },
			el(
				"div",
				{
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "baseline",
					},
				},
				el(
					"span",
					{
						style: {
							fontSize: "10px",
							fontWeight: 600,
							color: "#757575",
							textTransform: "uppercase",
						},
					},
					label,
				),
				el(
					"div",
					{ style: { textAlign: "right" } },
					el(
						"span",
						{ style: { fontSize: "12px", color: "#1e1e1e" } },
						displayVal,
					),
					slugVal &&
						el(
							"span",
							{
								style: {
									fontSize: "12px",
									color: "#1e1e1e",
									marginLeft: "5px",
								},
							},
							slugVal,
						),
				),
			),
			isInherited &&
				el(
					"div",
					{
						style: {
							fontSize: "9px",
							color: "#888",
							fontStyle: "italic",
							textAlign: "right",
							marginTop: "-2px",
						},
					},
					"(inherited)",
				),
		)
	}

	const Breadcrumbs = ({ items, selectedIndex, onSelect }) => {
		if (!items || items.length === 0) return null

		return el(
			"div",
			{ className: "sd-hud-breadcrumbs" },
			items.map((item, index) =>
				el(
					Fragment,
					{ key: index },
					el(
						"span",
						{
							className: `sd-hud-breadcrumb-item ${
								index === selectedIndex ? "active" : ""
							}`,
							onClick: () => onSelect(index),
						},
						item.name,
					),
					index < items.length - 1 &&
						el(
							"span",
							{ className: "sd-hud-breadcrumb-separator" },
							"›",
						),
				),
			),
		)
	}

	const InspectorHUD = () => {
		const [selection, setSelection] = useState(null)

		const handleReselect = (index) => {
			const frame = document.getElementById("sd-visual-frame")
			if (frame && frame.contentWindow) {
				frame.contentWindow.postMessage(
					{ type: "sd_request_reselection", index: index },
					"*",
				)
			}
		}

		useEffect(() => {
			const handleMessage = (event) => {
				if (event.data && event.data.command === "sd_inspector_data") {
					setSelection(event.data.data)
				}
			}
			window.addEventListener("message", handleMessage)
			return () => window.removeEventListener("message", handleMessage)
		}, [])

		if (!selection) {
			return el(
				"div",
				{ className: "sd-hud-empty" },
				el(Dashicon, { icon: "info", size: 30 }),
				el(
					"p",
					{ style: { marginTop: "10px", fontSize: "13px" } },
					"Hover over an element to inspect its DNA.",
				),
			)
		}

		const {
			styles,
			box,
			block,
			tagName,
			className,
			variation,
			patternTitle,
			htmlAnchor,
			isLink,
			isButton,
			isHeading,
		} = selection

		return el(
			"div",
			{ className: "sd-hud-app" },
			el(Breadcrumbs, {
				items: selection.breadcrumbs,
				selectedIndex: selection.selectedIndex,
				onSelect: handleReselect,
			}),
			el(
				PanelBody,
				{ title: "Forensic Inspector", initialOpen: true },
				el(
					"div",
					{
						style: {
							marginBottom: "20px",
							borderBottom: "1px solid #f0f0f1",
							paddingBottom: "10px",
						},
					},
					patternTitle &&
						el(
							"div",
							{
								style: {
									fontSize: "10px",
									color: "#757575",
									marginBottom: "4px",
								},
							},
							`Pattern: ${patternTitle}`,
						),
					el(
						"h4",
						{
							style: {
								margin: 0,
								fontSize: "14px",
								fontWeight: 600,
							},
						},
						block || tagName,
					),
					variation &&
						el(
							"div",
							{
								style: {
									marginTop: "5px",
									fontSize: "14px",
									fontWeight: 600,
									color: "#2271b1",
								},
							},
							`Style: ${variation}`,
						),
				),
				(isLink || isButton || isHeading) &&
					el(
						"div",
						{
							style: {
								borderLeft: "2px solid #2271b1",
								background: "rgba(34, 113, 177, 0.1)",
								padding: "8px 12px",
								marginBottom: "15px",
							},
						},
						el(
							"div",
							{
								style: {
									fontSize: "10px",
									fontWeight: 600,
									color: "#2271b1",
									textTransform: "uppercase",
								},
							},
							"Contextual Override",
						),
						el(
							"div",
							{ style: { fontSize: "12px", fontWeight: 600 } },
							isLink
								? "Link Element"
								: isButton
								? "Button Element"
								: "Heading Element",
						),
					),
			),
			el(
				PanelBody,
				{ title: "Settings", initialOpen: true },
				el(InspectorField, {
					label: "Element",
					dna: { rendered: tagName, isSet: true },
				}),
				htmlAnchor &&
					el(InspectorField, {
						label: "HTML Anchor",
						dna: { rendered: htmlAnchor, isSet: true },
					}),
				el(
					"div",
					{ style: { marginTop: "10px" } },
					el(
						"span",
						{
							style: {
								fontSize: "10px",
								fontWeight: 600,
								color: "#757575",
								textTransform: "uppercase",
								display: "block",
								marginBottom: "5px",
							},
						},
						"Classes",
					),
					el(
						"div",
						{ style: { display: "block" } },
						className
							.split(/\s+/)
							.filter(
								(c) =>
									c &&
									![
										"sd-inspectable",
										"sd-ghost-hover",
										"sd-ghost-selected",
									].includes(c),
							)
							.map((c) =>
								el(
									"div",
									{
										key: c,
										style: {
											fontSize: "12px",
											color: "#1e1e1e",
											marginBottom: "2px",
										},
									},
									`.${c}`,
								),
							),
					),
				),
			),
			el(
				PanelBody,
				{ title: "Layout", initialOpen: true },
				el(InspectorField, {
					label: "Dimensions",
					dna: {
						rendered: `${Math.round(box.width)}x${Math.round(
							box.height,
						)}px`,
						isSet: true,
					},
				}),
				el(InspectorField, {
					label: "Display",
					dna: { rendered: box.display, isSet: true },
				}),
				el(InspectorField, {
					label: "Position",
					dna: {
						rendered: `${box.position} ${
							box.zIndex !== "auto" ? `(z-${box.zIndex})` : ""
						}`,
						isSet: box.position !== "static",
					},
				}),
			),
			el(
				PanelBody,
				{ title: "Colors & FX", initialOpen: true },
				el(InspectorField, {
					label: "Text",
					dna: styles.typography.color,
					matchType: "color",
					blockName: block,
					tagName: tagName,
					stylePath: "typography.color",
				}),
				el(InspectorField, {
					label: "Background",
					dna: styles.colors.background,
					matchType: "color",
					blockName: block,
					tagName: tagName,
					stylePath: "color.background",
				}),
				el(InspectorField, {
					label: "Gradient",
					dna: styles.background.image,
					matchType: "gradient",
					forceShow: styles.background.image.rendered !== "none",
				}),
				el(InspectorField, {
					label: "Shadow",
					dna: styles.fx.shadow,
					forceShow: styles.fx.shadow.isSet,
				}),
				el(InspectorField, {
					label: "Opacity",
					dna: styles.fx.opacity,
					forceShow: styles.fx.opacity.isSet,
				}),
			),
			el(
				PanelBody,
				{ title: "Typography", initialOpen: false },
				el(InspectorField, {
					label: "Font",
					dna: styles.typography.fontFamily,
					matchType: "family",
				}),
				el(InspectorField, {
					label: "Size",
					dna: styles.typography.fontSize,
					matchType: "size",
					blockName: block,
					tagName: tagName,
					stylePath: "typography.fontSize",
				}),
				el(InspectorField, {
					label: "Appearance",
					dna: {
						rendered: `${styles.typography.fontWeight.rendered} ${styles.typography.fontStyle}`,
						isInherited: !styles.typography.fontWeight.isSet,
					},
					forceShow: true,
				}),
				el(InspectorField, {
					label: "Line Height",
					dna: {
						...styles.typography.lineHeight,
						fontSizePx: styles.typography.fontSize.rendered,
					},
					blockName: block,
					tagName: tagName,
					stylePath: "typography.lineHeight",
					forceShow: true,
				}),
				el(InspectorField, {
					label: "Letter Spacing",
					dna: {
						rendered: styles.typography.letterSpacing,
						isSet: styles.typography.letterSpacing !== "normal",
					},
					blockName: block,
					tagName: tagName,
					stylePath: "typography.letterSpacing",
					forceShow: true,
				}),
				el(InspectorField, {
					label: "Decor",
					dna: {
						rendered: styles.typography.textDecoration,
						isSet: styles.typography.textDecoration !== "none",
					},
				}),
				el(InspectorField, {
					label: "Case",
					dna: {
						rendered: styles.typography.textTransform,
						isSet: styles.typography.textTransform !== "none",
					},
				}),
			),
			el(
				PanelBody,
				{ title: "Dimensions", initialOpen: false },
				el(InspectorField, {
					label: "Padding",
					dna: { rendered: box.padding, isSet: true },
					forceShow: true,
				}),
				el(InspectorField, {
					label: "Margin",
					dna: { rendered: box.margin, isSet: true },
					forceShow: true,
				}),
				el(InspectorField, {
					label: "Gap",
					dna: {
						rendered: box.gap,
						isSet: box.gap !== "normal",
					},
					matchType: "spacing",
					blockName: block,
					tagName: tagName,
					stylePath: "spacing.blockGap",
				}),
			),
			el(
				PanelBody,
				{ title: "Border", initialOpen: false },
				el(InspectorField, {
					label: "Radius",
					dna: styles.border.radius,
					forceShow: styles.border.radius.isSet,
				}),
				el(InspectorField, {
					label: "Sides",
					dna: {
						rendered: `T: ${styles.border.sides.top}`,
						isSet: true,
					},
					forceShow: true,
				}),
			),
			el(
				PanelBody,
				{ title: "Controls" },
				el(
					Button,
					{
						isPrimary: true,
						onClick: () => {
							// Trigger the parent toolbar button
							const btn =
								document.getElementById("sd-tool-inspect")
							if (btn) btn.click()
						},
						style: { width: "100%", justifyContent: "center" },
					},
					"Deactivate Inspector",
				),
				el(
					Button,
					{
						isSecondary: true,
						onClick: () =>
							(window.location.href = `${
								sd_retail_vars.ajax_url
							}?action=sd_export_theme_json&nonce=${
								window.SystemDeckSecurity?.nonce ||
								sd_retail_vars.nonce
							}`),
						style: {
							width: "100%",
							justifyContent: "center",
							marginTop: "10px",
						},
					},
					el(Dashicon, { icon: "download" }),
					" Export Variation",
				),
			),
		)
	}

	// Auto-mount when the workspace renders
	document.addEventListener("DOMContentLoaded", () => {
		const checkExist = setInterval(() => {
			const root = document.getElementById("sd-inspector-hud-content")
			if (root) {
				render(el(InspectorHUD), root)
				clearInterval(checkExist)
			}
		}, 100)
	})
})(window.wp)
