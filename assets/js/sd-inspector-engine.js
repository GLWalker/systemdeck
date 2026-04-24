/**
 * SystemDeck Inspector Engine — The Magic Mouse (V2.1)
 *
 * Direct port of src/runtime/Inspector.js into a self-contained IIFE.
 * Runs INSIDE the preview iframe (loaded when sd_preview=1&sd_inspect=1).
 *
 * Protocol:
 *   RECEIVE  parent → { command: "sd_inspector_toggle", active: bool }
 *   RECEIVE  parent → { command: "sd_grid_toggle", active: bool }
 *   SEND     iframe → { command: "sd_inspector_ready" }
 *   SEND     iframe → { command: "sd_inspector_data", data: {...} }
 *   SEND     iframe → { type: "sd_element_selected", data: {...} }  (legacy)
 */
;(function () {
	"use strict"

	var isBlockEditorShellDocument =
		window.parent === window &&
		document.body &&
		(document.body.classList.contains("block-editor-page") ||
			document.body.classList.contains("site-editor-php")) &&
		!document.getElementById("sd-canvas-root")

	if (isBlockEditorShellDocument) {
		return
	}

	// ─── SHARED STATE ─────────────────────────────────────────────────────────
	var inspectorActive = false
	var hovered = null
	var selected = null
	var selectedAncestry = []
	var cleanupFn = null

	// ─── FORENSIC VALUE HELPER (ported 1:1 from Inspector.js) ─────────────────
	function forensicValue(comp, inl, prop, cls) {
		var propSlug = prop.toLowerCase()
		var inlineLower = (inl || "").toLowerCase()
		var cssName = prop.replace(/([A-Z])/g, "-$1").toLowerCase()

		var isSet =
			inlineLower.includes(cssName + ":") ||
			cls.includes(
				"has-" +
					propSlug
						.replace("backgroundcolor", "background")
						.replace("fontsize", "font-size") +
					"-",
			) ||
			inlineLower.includes("--wp--preset--")

		return {
			rendered: comp[prop],
			isSet: isSet,
			isInherited: !isSet,
		}
	}

	// ─── CSS INJECTION ────────────────────────────────────────────────────────
	var STYLE_ID = "sd-inspector-styles"

	function injectStyles() {
		if (document.getElementById(STYLE_ID)) return
		var style = document.createElement("style")
		style.id = STYLE_ID
		style.textContent = [
			".sd-ghost-hover {",
			"    outline: 2px dashed var(--sd-highlight-color, var(--wp-admin-theme-color, #007cba)) !important;",
			"    outline-offset: -2px !important;",
			"    cursor: crosshair !important;",
			"    background: color-mix(in srgb, var(--sd-highlight-color, var(--wp-admin-theme-color, #007cba)) 8%, transparent) !important;",
			"    position: relative;",
			"    z-index: 2147483647 !important;",
			"}",
			".sd-ghost-selected {",
			"    outline: 2px solid var(--sd-highlight-color, var(--wp-admin-theme-color, #007cba)) !important;",
			"    outline-offset: -2px !important;",
			"    background: color-mix(in srgb, var(--sd-highlight-color, var(--wp-admin-theme-color, #007cba)) 14%, transparent) !important;",
			"    position: relative;",
			"    z-index: 2147483646 !important;",
			"}",
			".sd-ghost-label {",
			"    position: absolute;",
			"    top: -24px;",
			"    left: 0;",
			"    background: color-mix(in srgb, var(--sd-menu-background, var(--sd-heading-color, #1d2327)) 92%, transparent) !important;",
			"    backdrop-filter: blur(4px);",
			"    color: var(--sd-menu-text, #fff) !important;",
			'    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;',
			"    font-size: 10px !important;",
			"    font-weight: 600 !important;",
			"    line-height: 1 !important;",
			"    padding: 4px 8px !important;",
			"    border-radius: 4px !important;",
			"    pointer-events: none !important;",
			"    white-space: nowrap !important;",
			"    box-shadow: 0 4px 10px color-mix(in srgb, var(--sd-menu-background, #1d2327) 40%, transparent) !important;",
			"    border: 1px solid color-mix(in srgb, var(--sd-menu-text, #fff) 16%, transparent) !important;",
			"    z-index: 22000000 !important;",
			"    display: flex;",
			"    align-items: center;",
			"    gap: 5px;",
			"}",
			".sd-ghost-label::after {",
			"    content: '';",
			"    position: absolute;",
			"    bottom: -4px;",
			"    left: 8px;",
			"    width: 0;",
			"    height: 0;",
			"    border-left: 4px solid transparent;",
			"    border-right: 4px solid transparent;",
			"    border-top: 4px solid color-mix(in srgb, var(--sd-menu-background, #1d2327) 92%, transparent);",
			"}",
		].join("\n")
		document.head.appendChild(style)
	}

	function removeStyles() {
		var el = document.getElementById(STYLE_ID)
		if (el && el.parentNode) el.parentNode.removeChild(el)
	}

	// ─── ELEMENT HELPERS ──────────────────────────────────────────────────────
	var CONTENT_TAGS = [
		"P",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
		"LI",
		"EM",
		"STRONG",
		"A",
		"SPAN",
		"IMG",
		"BUTTON",
		"CODE",
		"MARK",
	]

	function clearHighlight(el) {
		if (!el || !el.classList) return
		el.classList.remove("sd-ghost-hover")
		if (selected !== el) {
			var label = el.querySelector(":scope > .sd-ghost-label")
			if (label && label.parentNode) label.parentNode.removeChild(label)
		}
		if (hovered === el) hovered = null
	}

	function highlight(el) {
		if (!el || !el.classList) return
		hovered = el
		el.classList.add("sd-ghost-hover")

		var name = el.getAttribute("data-type") || el.getAttribute("data-block")
		if (!name) {
			var cls =
				typeof el.className === "string"
					? el.className
					: (el.className && el.className.baseVal) || ""
			var match = cls.match(/wp-block-([a-z0-9-]+)/)
			name = match ? "core/" + match[1] : el.tagName.toLowerCase()
		}

		if (!el.querySelector(":scope > .sd-ghost-label")) {
			var lbl = document.createElement("div")
			lbl.className = "sd-ghost-label"
			lbl.innerText = name
			el.appendChild(lbl)
		}
	}

	function resolveSubject(blockRoot, blockName) {
		if (
			blockName === "core/paragraph" ||
			(blockRoot.classList &&
				blockRoot.classList.contains("wp-block-paragraph"))
		) {
			return blockRoot.querySelector("p") || blockRoot
		}
		if (
			blockName === "core/button" ||
			(blockRoot.classList &&
				blockRoot.classList.contains("wp-block-button"))
		) {
			return (
				blockRoot.querySelector(".wp-block-button__link") || blockRoot
			)
		}
		if (blockName && blockName.startsWith("core/heading")) {
			return (
				blockRoot.querySelector("h1, h2, h3, h4, h5, h6") || blockRoot
			)
		}
		if (blockRoot.classList && blockRoot.classList.contains("postbox")) {
			return blockRoot
		}
		return blockRoot
	}

	// ─── SELECT ELEMENT ───────────────────────────────────────────────────────
	function selectElement(el) {
		if (!el) return

		// Deselect previous
		if (selected && selected !== el) {
			var prev = selected
			prev.classList.remove("sd-ghost-selected")
			if (prev !== hovered) {
				var prevLbl = prev.querySelector(":scope > .sd-ghost-label")
				if (prevLbl && prevLbl.parentNode)
					prevLbl.parentNode.removeChild(prevLbl)
			}
		}
		selected = el
		el.classList.add("sd-ghost-selected")

		// 1. Resolve Identity
		var blockRoot =
			el.closest("[data-block], [class*='wp-block-'], .postbox") || el
		var blockName =
			blockRoot.getAttribute("data-type") ||
			blockRoot.getAttribute("data-block")

		if (!blockName) {
			var rootCls =
				typeof blockRoot.className === "string"
					? blockRoot.className
					: ""
			var rootMatch = rootCls.match(/wp-block-([a-z0-9-]+)/)
			blockName = rootMatch
				? "core/" + rootMatch[1]
				: blockRoot.tagName.toLowerCase()
		}
		if (
			blockRoot.id &&
			blockRoot.classList &&
			blockRoot.classList.contains("postbox")
		) {
			blockName = "wp-dashboard-widget"
		}

		// 2. Resolve Subject
		var subject = resolveSubject(blockRoot, blockName)
		if (CONTENT_TAGS.indexOf(el.tagName) !== -1) subject = el

		// 3. Read Styles
		var computed = window.getComputedStyle(subject)
		var inline = subject.getAttribute("style") || ""
		var classes =
			typeof subject.className === "string" ? subject.className : ""

		// 4. Ancestry
		selectedAncestry = []
		var curr = blockRoot
		while (curr) {
			selectedAncestry.unshift(curr)
			if (curr.tagName === "HTML") break
			curr = curr.parentElement
		}

		var breadcrumbs = selectedAncestry.map(function (node) {
			var n =
				node.getAttribute("data-type") ||
				node.getAttribute("data-block")
			if (!n) n = node.tagName.toLowerCase()
			return { name: n, tagName: node.tagName.toLowerCase() }
		})

		// 5. Build Payload (matches sd-inspector-hud.js data contract exactly)
		var payload = {
			type: "sd_element_selected",
			data: {
				block: blockName,
				tagName: subject.tagName.toLowerCase(),
				className: classes,
				inlineStyle: inline,
				breadcrumbs: breadcrumbs,
				selectedIndex: selectedAncestry.indexOf(blockRoot),
				htmlAnchor: subject.id || blockRoot.id || null,

				content: blockRoot.outerHTML,
				title:
					(blockRoot.querySelector("h2, h3, .wp-menu-name") || {})
						.innerText || "Untitled Widget",

				box: {
					width: subject.getBoundingClientRect().width,
					height: subject.getBoundingClientRect().height,
					padding: computed.padding,
					margin: computed.margin,
					gap: computed.gap,
					display: computed.display,
					position: computed.position,
				},

				// Forensic Style Data — matches sd-inspector-hud.js nested expectations
				styles: {
					typography: {
						color: forensicValue(
							computed,
							inline,
							"color",
							classes,
						),
						fontSize: forensicValue(
							computed,
							inline,
							"fontSize",
							classes,
						),
						fontFamily: forensicValue(
							computed,
							inline,
							"fontFamily",
							classes,
						),
						fontWeight: {
							rendered: computed.fontWeight,
							isSet: inline.includes("font-weight:"),
						},
						fontStyle: computed.fontStyle,
						lineHeight: {
							rendered: computed.lineHeight,
							isSet: inline.includes("line-height:"),
						},
						letterSpacing: computed.letterSpacing,
						textDecoration: computed.textDecoration,
						textTransform: computed.textTransform,
					},
					colors: {
						background: forensicValue(
							computed,
							inline,
							"backgroundColor",
							classes,
						),
					},
					background: {
						image: forensicValue(
							computed,
							inline,
							"backgroundImage",
							classes,
						),
					},
					border: {
						radius: {
							rendered: computed.borderRadius,
							isSet: inline.includes("border-radius:"),
						},
						sides: {
							top: computed.borderTopWidth,
							right: computed.borderRightWidth,
							bottom: computed.borderBottomWidth,
							left: computed.borderLeftWidth,
						},
					},
					fx: {
						shadow: {
							rendered: computed.boxShadow,
							isSet: inline.includes("box-shadow:"),
						},
						opacity: {
							rendered: computed.opacity,
							isSet: inline.includes("opacity:"),
						},
					},
				},
			},
		}

		// Fire to parent — two formats for compatibility
		window.parent.postMessage(payload, "*")
		window.parent.postMessage(
			{ command: "sd_inspector_data", data: payload.data },
			"*",
		)

		console.log("SD Magic Mouse: Selected →", payload.data.block)
	}

	// ─── EVENT HANDLERS ───────────────────────────────────────────────────────
	function onMouseOver(e) {
		e.stopPropagation()
		var target = e.target
		if (
			!target ||
			target === document ||
			target === document.documentElement
		)
			return
		if (target.classList && target.classList.contains("sd-ghost-label"))
			return

		// Prefer block-root unless it's a content-level tag
		if (CONTENT_TAGS.indexOf(target.tagName) === -1) {
			var block = target.closest(
				"[data-block], [data-type], [class*='wp-block-'], .postbox",
			)
			if (block) target = block
		}

		if (hovered === target) return
		if (hovered) clearHighlight(hovered)
		highlight(target)
	}

	function onMouseOut(e) {
		if (hovered && !hovered.contains(e.relatedTarget)) {
			clearHighlight(hovered)
		}
	}

	function onClick(e) {
		// Allow shift+click to follow links
		if (e.shiftKey && e.target.closest && e.target.closest("a")) return
		e.preventDefault()
		e.stopPropagation()
		var target = hovered || e.target
		if (target) selectElement(target)
	}

	// ─── ACTIVATE / DEACTIVATE ────────────────────────────────────────────────
	function activate() {
		if (inspectorActive) return
		inspectorActive = true
		injectStyles()
		document.body.addEventListener("mouseover", onMouseOver, true)
		document.body.addEventListener("mouseout", onMouseOut, true)
		document.body.addEventListener("click", onClick, true)
		console.log("SD Magic Mouse: ✓ Neural link established")
	}

	function deactivate() {
		if (!inspectorActive) return
		inspectorActive = false
		document.body.removeEventListener("mouseover", onMouseOver, true)
		document.body.removeEventListener("mouseout", onMouseOut, true)
		document.body.removeEventListener("click", onClick, true)

		// Clean up all ghost decorations
		var ghosts = document.querySelectorAll(
			".sd-ghost-hover, .sd-ghost-selected, .sd-ghost-label",
		)
		for (var i = 0; i < ghosts.length; i++) {
			var g = ghosts[i]
			g.classList.remove("sd-ghost-hover", "sd-ghost-selected")
			if (g.classList.contains("sd-ghost-label") && g.parentNode) {
				g.parentNode.removeChild(g)
			}
		}
		hovered = null
		selected = null
		removeStyles()
		console.log("SD Magic Mouse: Deactivated")
	}

	// ─── GRID OVERLAY (ported from sd-retail-system.js listenForInspector) ────
	// The iframe also handles sd_grid_toggle to show/hide the layout overlay.
	function toggleGrid(active) {
		var grid = document.getElementById("sd-grid-overlay-layer")
		var legend = document.getElementById("sd-specs-legend")

		if (!grid && active) {
			var rootStyles = getComputedStyle(document.documentElement)
			var contentSize =
				rootStyles
					.getPropertyValue("--wp--style--global--content-size")
					.trim() || "645px"
			var wideSize =
				rootStyles
					.getPropertyValue("--wp--style--global--wide-size")
					.trim() || "1340px"
			var blockGap =
				rootStyles.getPropertyValue("--wp--style--block-gap").trim() ||
				"24px"

			var styleEl = document.createElement("style")
			styleEl.id = "sd-grid-styles"
			styleEl.textContent = [
				":root {",
				"    --sd-grid-content: " + contentSize + ";",
				"    --sd-grid-wide: " + wideSize + ";",
				"    --sd-grid-gap: " + blockGap + ";",
				"    --sd-grid-magenta: rgba(255,0,255,0.1);",
				"    --sd-guide-cyan: #00f2ff;",
				"    --sd-guide-orange: #ff9900;",
				"}",
				"#sd-grid-overlay-layer { position:fixed;top:0;left:0;right:0;bottom:0;z-index:1999999999;pointer-events:none;mix-blend-mode:exclusion;display:none; }",
				".sd-grid-container { max-width:var(--sd-grid-wide);margin:0 auto;height:100%;display:grid;grid-template-columns:repeat(12,1fr);gap:var(--sd-grid-gap);border-left:1px solid var(--sd-guide-orange);border-right:1px solid var(--sd-guide-orange);position:relative; }",
				".sd-grid-container::after { content:'';position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:var(--sd-grid-content);border-left:1px solid var(--sd-guide-cyan);border-right:1px solid var(--sd-guide-cyan); }",
				".sd-grid-col { background:var(--sd-grid-magenta);height:100%; }",
				"#sd-specs-legend { position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.85);color:#fff;padding:10px 15px;border-radius:8px;font-family:monospace;font-size:11px;z-index:2000000000;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(5px);display:none;pointer-events:none; }",
				".sd-spec-row { margin-bottom:4px;display:flex;justify-content:space-between;gap:20px; }",
				".sd-spec-label { color:#aaa; }",
				".sd-spec-val { color:#00f2ff;font-weight:bold; }",
			].join("\n")
			document.head.appendChild(styleEl)

			grid = document.createElement("div")
			grid.id = "sd-grid-overlay-layer"
			var container = document.createElement("div")
			container.className = "sd-grid-container"
			for (var i = 0; i < 12; i++) {
				var col = document.createElement("div")
				col.className = "sd-grid-col"
				container.appendChild(col)
			}
			grid.appendChild(container)
			document.body.appendChild(grid)

			legend = document.createElement("div")
			legend.id = "sd-specs-legend"
			legend.innerHTML = [
				'<div class="sd-spec-row"><span class="sd-spec-label">Viewport:</span> <span class="sd-spec-val" id="sd-val-vp">--</span></div>',
				'<div class="sd-spec-row"><span class="sd-spec-label">Content:</span> <span class="sd-spec-val">' +
					contentSize +
					"</span></div>",
				'<div class="sd-spec-row"><span class="sd-spec-label">Wide:</span> <span class="sd-spec-val">' +
					wideSize +
					"</span></div>",
				'<div class="sd-spec-row"><span class="sd-spec-label">Gap:</span> <span class="sd-spec-val">' +
					blockGap +
					"</span></div>",
			].join("")
			document.body.appendChild(legend)

			var updateVp = function () {
				var vp = document.getElementById("sd-val-vp")
				if (vp) vp.textContent = window.innerWidth + "px"
			}
			window.addEventListener("resize", updateVp)
			updateVp()
		}

		var display = active ? "block" : "none"
		if (grid) grid.style.display = display
		if (legend) legend.style.display = display
	}

	// ─── PARENT MESSAGE BUS ───────────────────────────────────────────────────
	window.addEventListener("message", function (e) {
		if (!e.data) return

		if (e.data.command === "sd_inspector_toggle") {
			if (e.data.active) {
				activate()
			} else {
				deactivate()
			}
		}

		if (e.data.command === "sd_grid_toggle") {
			toggleGrid(e.data.active)
		}
	})

	// ─── READY SIGNAL ─────────────────────────────────────────────────────────
	// Tell the parent window we are alive — it will reply with sd_inspector_toggle
	// and sd_grid_toggle to restore whatever state was active before the page loaded.
	function signalReady() {
		window.parent.postMessage({ command: "sd_inspector_ready" }, "*")
		console.log("SD Magic Mouse: Ready signal → parent")
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", signalReady)
	} else {
		setTimeout(signalReady, 50)
	}

	console.log("SD Magic Mouse: Engine booted")
})()
