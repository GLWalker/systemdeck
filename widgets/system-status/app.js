;(function ($) {
	"use strict"

	const SOURCE_DEFS = [
		{ id: "all", label: "All Sources" },
		{ id: "core", label: "Core" },
		{ id: "widget", label: "Widgets" },
		{ id: "app", label: "Apps" },
		{ id: "wp.metrics", label: "WP" },
		{ id: "third_party", label: "Third-Party" },
	]
	const MODULE_HOST_ID = "sd-system-status-module-host"
	const MODULE_LAUNCHER_ID = "sd-telemetrics-picker-launcher"

	function getActiveWorkspaceId() {
		try {
			const selector = window?.wp?.data?.select
			if (typeof selector === "function") {
				const store = selector("systemdeck/core")
				if (store && typeof store.getActiveWorkspaceId === "function") {
					const activeId = String(store.getActiveWorkspaceId() || "").trim()
					if (activeId) return activeId
				}
			}
		} catch (_err) {
			// noop
		}
		const bootId = String(window?.SYSTEMDECK_BOOTSTRAP?.activeWorkspace || "").trim()
		return bootId || "default"
	}

	function resolveWorkspaceId($widget = null) {
		const fromStore = getActiveWorkspaceId()
		if (fromStore && fromStore !== "default") return fromStore

		try {
			const fromStorage = String(window?.localStorage?.getItem("sd_active_workspace") || "").trim()
			if (fromStorage) return fromStorage
		} catch (_err) {
			// noop
		}

		if ($widget && $widget.length) {
			const direct = String($widget.data("workspace-id") || "").trim()
			if (direct) return direct
			const nearest = String($widget.closest("[data-workspace-id]").data("workspace-id") || "").trim()
			if (nearest) return nearest
		}

		const domWorkspace = String(
			document.querySelector(
				".sd-widget-render-host[data-workspace-id], [data-workspace-id].sd-system-status-widget",
			)?.getAttribute("data-workspace-id") || "",
		).trim()
		if (domWorkspace) return domWorkspace

		const bootId = String(window?.SYSTEMDECK_BOOTSTRAP?.activeWorkspace || "").trim()
		return bootId || "default"
	}

	function ensureModuleStyle() {
		if (document.getElementById("sd-system-status-module-style")) return
		const style = document.createElement("style")
		style.id = "sd-system-status-module-style"
		style.textContent = `
#${MODULE_HOST_ID} .sd-telemetrics-launcher-host > .sd-telemetrics-launcher { display: none !important; }
#${MODULE_LAUNCHER_ID} .dashicons { font-size: 18px; line-height: 1; width: 18px; height: 18px; }
`
		document.head.appendChild(style)
	}

	function ensureModuleHost() {
		let host = document.getElementById(MODULE_HOST_ID)
		if (host) {
			host.setAttribute("data-workspace-id", resolveWorkspaceId())
			return host
		}
		const root = document.querySelector("#systemdeck") || document.body
		host = document.createElement("div")
		host.id = MODULE_HOST_ID
		host.className = "sd-status-wrapper sd-system-status-widget sd-system-status-module-host"
		host.setAttribute("data-workspace-id", resolveWorkspaceId())
		root.appendChild(host)
		return host
	}

	function ensureHeaderLauncher() {
		let button = document.getElementById(MODULE_LAUNCHER_ID)
		if (button) return button
		const headerRight = document.querySelector("#systemdeck .sd-header-right")
		if (!headerRight) return null
		button = document.createElement("button")
		button.type = "button"
		button.id = MODULE_LAUNCHER_ID
		button.className = "sd-btn-icon"
		button.title = "Pin Picker"
		button.setAttribute("aria-label", "Open Pin Picker")
		button.innerHTML = '<span class="dashicons dashicons-chart-line" aria-hidden="true"></span>'
		const dockControls = headerRight.querySelector(".sd-dock-controls")
		if (dockControls) {
			headerRight.insertBefore(button, dockControls)
		} else {
			headerRight.appendChild(button)
		}
		return button
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

	function fetchPins(workspaceId) {
		return $.post(getAjaxUrl(), {
			action: "sd_get_workspace_pins",
			workspace_id: workspaceId || "default",
			nonce: getNonce(),
		})
	}

	function fetchPinSafeMetrics() {
		return $.post(getAjaxUrl(), {
			action: "sd_get_pin_safe_metrics",
			nonce: getNonce(),
		})
	}

	function createMetricPin(workspaceId, metricKey) {
		return $.post(getAjaxUrl(), {
			action: "sd_create_metric_pin",
			workspace_id: workspaceId || "default",
			metric_key: metricKey,
			nonce: getNonce(),
		})
	}

	function createRegistryPin(workspaceId, definitionId) {
		return $.post(getAjaxUrl(), {
			action: "sd_create_registry_pin",
			workspace_id: workspaceId || "default",
			definition_id: definitionId,
			nonce: getNonce(),
		})
	}

	function broadcastPinsUpdated(workspaceId, pins) {
		document.dispatchEvent(
			new CustomEvent("systemdeck:pins-updated", {
				detail: {
					workspaceId: workspaceId || "default",
					pins: Array.isArray(pins) ? pins : [],
				},
			}),
		)
	}

	function isSystemStatusPin(pin) {
		if (!pin || typeof pin !== "object") return false
		const type = String(pin.type || "").trim()
		const sourceWidget = String(pin?.data?.source_widget || pin?.source_widget || "").trim()
		const pinKind = String(pin?.data?.pin_kind || pin?.settings?.pin_kind || "").trim()
		const metricKey = String(pin?.data?.metric_key || pin?.settings?.metric_key || "").trim()
		return (
			type === "system.status" ||
			type === "metric" ||
			pinKind === "metric_pin" ||
			pinKind === "platform_control_pin" ||
			metricKey !== "" ||
			sourceWidget === "core.system-status" ||
			sourceWidget === "systemdeck.pin-registry"
		)
	}

	function normalizePinRenderer(rawRenderer) {
		const renderer = String(rawRenderer || "").trim().toLowerCase()
		return renderer || "dom"
	}

	function normalizePinRecord(pin, index = 0) {
		const source = pin && typeof pin === "object" ? pin : {}
		const data = source.data && typeof source.data === "object" ? source.data : {}
		const id = String(source.id || `metric_${index}`).trim()
		const size = ["1x1", "2x1", "3x1", "4x1", "1x2", "2x2", "3x2"].includes(String(source.size || ""))
			? String(source.size)
			: "1x1"

		return {
			id,
			type: String(source.type || "system.status"),
			size,
			renderer: normalizePinRenderer(source.renderer || source?.settings?.renderer),
			title: String(source.title || data.label || source.label || id),
			data: {
				label: String(data.label || source.label || id),
				icon: String(data.icon || source.icon || "dashicons-admin-generic"),
				source_widget: String(data.source_widget || source.source_widget || "core.system-status"),
				metric_key: String(data.metric_key || source.metric_key || ""),
				metric_family: String(data.metric_family || source.metric_family || ""),
				metric_authority: String(data.metric_authority || source.metric_authority || ""),
				metric_mode: String(data.metric_mode || source.metric_mode || ""),
				category: String(data.category || source.category || ""),
				description: String(data.description || source.description || ""),
				value_label: String(data.value_label || source.value_label || ""),
				action: String(data.action || source.action || ""),
				pin_definition_id: String(data.pin_definition_id || source.pin_definition_id || ""),
			},
			design_template: String(source.design_template || "default"),
		}
	}

	function normalizePinDefinition(definition, metric) {
		const source = definition && typeof definition === "object" ? definition : {}
		const defaults =
			source.defaults && typeof source.defaults === "object" ? source.defaults : {}
		const sourceInfo = source.source && typeof source.source === "object" ? source.source : {}
		const fallbackMetric = metric && typeof metric === "object" ? metric : {}

		return {
			id: String(source.id || "").trim(),
			label: String(source.label || fallbackMetric.label || fallbackMetric.key || "").trim(),
			description: String(source.description || fallbackMetric.description || "").trim(),
			type: String(source.type || "metric").trim(),
			metric_key: String(source.metric_key || fallbackMetric.key || "").trim(),
			renderer: normalizePinRenderer(source.renderer || "dom"),
			size: String(defaults.size || "1x1").trim() || "1x1",
			icon: String(source.icon || fallbackMetric.icon || "").trim(),
			source_kind: String(sourceInfo.kind || "").trim(),
			source_authority: String(sourceInfo.authority || "").trim(),
			source_id: String(sourceInfo.id || "").trim(),
			value_label: String(source?.meta?.value_label || "").trim(),
		}
	}

	function normalizeStandalonePinDefinition(definition) {
		const pinDefinition = normalizePinDefinition(definition, null)
		if (!pinDefinition?.id) return null

		const sourceKind = String(pinDefinition.source_kind || "").trim()
		const family =
			sourceKind === "third_party"
				? "third_party"
				: sourceKind === "widget"
					? "widget"
					: sourceKind === "app"
						? "app"
						: "core"

		return {
			key: pinDefinition.id,
			label: pinDefinition.label,
			value: null,
			unit: "text",
			family,
			authority: pinDefinition.source_authority,
			mode: "",
			status: "ok",
			trend: "stable",
			timestamp: 0,
			category: String(definition?.category || "tools").trim(),
			description: pinDefinition.description,
			display_value: String(pinDefinition.value_label || "Open"),
			icon: pinDefinition.icon,
			analysis: null,
			pin_definition: pinDefinition,
		}
	}

	function findMetricPinDefinition(pinDefinitions, metricKey) {
		if (!pinDefinitions || typeof pinDefinitions !== "object") return null
		const target = String(metricKey || "").trim()
		if (!target) return null

		const match = Object.values(pinDefinitions).find(
			(definition) =>
				definition &&
				typeof definition === "object" &&
				String(definition.metric_key || "").trim() === target,
		)

		return match || null
	}

	function normalizeMetric(metric, pinDefinitions) {
		const source = metric && typeof metric === "object" ? metric : {}
		const key = String(source.key || "").trim()
		const rawDefinition = findMetricPinDefinition(pinDefinitions, key)
		const pinDefinition = rawDefinition ? normalizePinDefinition(rawDefinition, source) : null
		return {
			key,
			label: String(source.label || source.key || "").trim(),
			value: source.value ?? null,
			unit: String(source.unit || "text").trim(),
			family: String(source.family || "").trim(),
			authority: String(source.authority || "").trim(),
			mode: String(source.mode || "").trim(),
			status: String(source.status || "ok").trim(),
			trend: String(source.trend || "stable").trim(),
			timestamp: Number(source.timestamp || 0),
			category: String(source.category || "general").trim(),
			description: String(source.description || "").trim(),
			display_value: String(source.display_value || ""),
			icon: String(source.icon || "").trim(),
			analysis:
				source.analysis && typeof source.analysis === "object" ? source.analysis : null,
			pin_definition: pinDefinition,
		}
	}

	function hasSpecialPinDefinition(metric) {
		const definition = metric?.pin_definition
		if (!definition || typeof definition !== "object") return false
		return definition.renderer !== "dom" || definition.size !== "1x1"
	}

	function buildPinCatalog(metrics, pinDefinitions) {
		const indexed = {}
		const definitionMap =
			pinDefinitions && typeof pinDefinitions === "object" ? pinDefinitions : {}

		Object.keys(definitionMap).forEach((definitionId) => {
			const item = normalizeStandalonePinDefinition(definitionMap[definitionId])
			if (item && item.pin_definition?.type !== "metric") {
				indexed[item.key] = item
			}
		})

		;(Array.isArray(metrics) ? metrics : []).forEach((metric) => {
			const item = normalizeMetric(metric, definitionMap)
			if (item?.key) {
				indexed[item.key] = item
			}
		})

		return Object.values(indexed)
	}

	function getMetricCatalog($widget) {
		const catalog = $widget.data("sd-metric-registry")
		return Array.isArray(catalog) ? catalog : []
	}

	function formatMetricValue(metric) {
		if (typeof metric?.display_value === "string" && metric.display_value !== "") {
			return metric.display_value
		}

		const unit = String(metric?.unit || "text")
		const value = metric?.value
		if (value === null || value === undefined || value === "") return "--"

		if (unit === "boolean") {
			return value ? "Yes" : "No"
		}

		if (unit === "bytes") {
			const numeric = Number(value)
			if (!Number.isFinite(numeric)) return String(value)
			if (numeric >= 1073741824) return `${(numeric / 1073741824).toFixed(2)} GB`
			if (numeric >= 1048576) return `${(numeric / 1048576).toFixed(2)} MB`
			if (numeric >= 1024) return `${(numeric / 1024).toFixed(1)} KB`
			return `${numeric} B`
		}

		if (unit === "seconds") {
			return `${value}s`
		}

		if (unit === "percent") {
			return `${value}%`
		}

		if (unit === "count") {
			return String(value)
		}

		if (unit === "unix") {
			const epoch = Number(value)
			if (!Number.isFinite(epoch) || epoch <= 0) return "--"
			return new Date(epoch * 1000).toLocaleTimeString([], {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		}

		return String(value)
	}

	function getMetricIcon(metric) {
		if (metric?.icon) return String(metric.icon)
		const category = String(metric?.category || "")
		const family = String(metric?.family || "")
		if (family === "wp.metrics") return "dashicons-wordpress"
		const categoryMap = {
			time: "dashicons-clock",
			performance: "dashicons-chart-area",
			database: "dashicons-database",
			health: "dashicons-heart",
			env: "dashicons-admin-tools",
			updates: "dashicons-update",
			security: "dashicons-shield",
			network: "dashicons-admin-site-alt3",
			hardware: "dashicons-admin-generic",
			"wp-core": "dashicons-wordpress",
		}
		return categoryMap[category] || "dashicons-admin-generic"
	}

	function getCategoryDefs(metrics, activeSource) {
		const source = String(activeSource || "all")
		const scoped = Array.isArray(metrics)
			? metrics.filter((metric) => source === "all" || metric.family === source)
			: []
		const counts = {}
		scoped.forEach((metric) => {
			const category = String(metric.category || "general")
			counts[category] = (counts[category] || 0) + 1
		})
		const defs = [{ id: "all", label: "All Pins", count: scoped.length }]
		Object.keys(counts)
			.sort()
			.forEach((category) => {
				defs.push({
					id: category,
					label: category.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
					count: counts[category],
				})
			})
		return defs
	}

	function filterMetrics($widget) {
		const metrics = getMetricCatalog($widget)
		const sourceId = String($widget.data("sd-picker-source") || "all")
		const categoryId = String($widget.data("sd-picker-category") || "all")
		const searchTerm = String($widget.data("sd-picker-search") || "").trim().toLowerCase()

		return metrics.filter((metric) => {
			if (sourceId !== "all" && metric.family !== sourceId) return false
			if (categoryId !== "all" && metric.category !== categoryId) return false
			if (!searchTerm) return true
			const haystack = [
				metric.label,
				metric.description,
				metric.category,
				metric.key,
				metric.family,
			]
				.join(" ")
				.toLowerCase()
			return haystack.includes(searchTerm)
		})
	}

	function ensureWidgetShell($widget) {
		let $host = $widget.find(".sd-telemetrics-launcher-host")
		if ($host.length) return $host
		$widget.empty()
		$host = $('<div class="sd-telemetrics-launcher-host"></div>')
		$widget.append($host)
		return $host
	}

	function renderLauncherShell($widget) {
		const pinMap = $widget.data("sd-pin-map") || {}
		const pinnedCount = Object.values(pinMap).filter((pin) => isSystemStatusPin(pin)).length
		const metricCount = getMetricCatalog($widget).length
		const $host = ensureWidgetShell($widget)
		$host.html(`
			<div class="sd-telemetrics-launcher">
				<div class="sd-telemetrics-launcher__copy">
					<h3 class="sd-telemetrics-launcher__title">Pin Picker</h3>
					<p class="sd-telemetrics-launcher__text">Select normalized pins from the shared registry and pin them into the workspace.</p>
				</div>
				<div class="sd-telemetrics-launcher__meta">
					<div class="sd-telemetrics-launcher__badge">
						<span class="sd-telemetrics-launcher__badge-value">${metricCount}</span>
						<span class="sd-telemetrics-launcher__badge-label">Pin-Safe Pins</span>
					</div>
					<div class="sd-telemetrics-launcher__badge">
						<span class="sd-telemetrics-launcher__badge-value">${pinnedCount}</span>
						<span class="sd-telemetrics-launcher__badge-label">Pinned</span>
					</div>
				</div>
				<div class="sd-telemetrics-launcher__actions">
					<button type="button" class="button button-primary sd-open-telemetrics-picker">Open Pin Picker</button>
				</div>
			</div>
		`)
	}

	function ensurePickerModal($widget) {
		ensureWidgetShell($widget)
		let $modal = $widget.find(".sd-telemetrics-picker-modal")
		if ($modal.length) return $modal

		$modal = $(`
			<div class="components-modal__screen-overlay sd-telemetrics-picker-modal" style="display:none; z-index: 100000;">
				<div class="components-modal__frame components-modal" role="dialog" tabindex="-1" aria-label="SystemDeck Pin Picker">
					<div class="components-modal__content" role="document">
						<div class="components-modal__header sd-telemetrics-picker-modal__header">
							<div class="sd-telemetrics-picker-modal__header-main">
								<div class="components-modal__header-heading-container">
									<div class="sd-telemetrics-picker-modal__eyebrow">System Telemetrics</div>
									<h1 class="components-modal__header-heading sd-telemetrics-picker-modal__title">Pin Picker</h1>
								</div>
								<div class="sd-telemetrics-picker-modal__header-actions">
									<select class="sd-telemetrics-picker__source" aria-label="Filter source">
										${SOURCE_DEFS.map((source) => `<option value="${source.id}">${source.label}</option>`).join("")}
									</select>
									<input type="search" class="sd-telemetrics-picker__search" placeholder="Search pins..." />
								</div>
							</div>
							<button type="button" class="components-button has-icon sd-modal-close sd-telemetrics-picker__close" aria-label="Close dialog">
								<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path></svg>
							</button>
						</div>
						<div class="sd-telemetrics-picker-modal__body">
							<aside class="sd-telemetrics-picker__rail"></aside>
							<section class="sd-telemetrics-picker__list-wrap">
								<div class="sd-telemetrics-picker__list-header">
								<div class="sd-telemetrics-picker__list-title">Available Pins</div>
								</div>
								<div class="sd-telemetrics-picker__list"></div>
							</section>
						</div>
					</div>
				</div>
			</div>
		`)
		$widget.append($modal)
		return $modal
	}

	function renderCategoryRail($widget) {
		const $modal = ensurePickerModal($widget)
		const activeCategory = String($widget.data("sd-picker-category") || "all")
		const activeSource = String($widget.data("sd-picker-source") || "all")
		const metrics = getMetricCatalog($widget)
		const categoryDefs = getCategoryDefs(metrics, activeSource)
		const $rail = $modal.find(".sd-telemetrics-picker__rail")
		$rail.html(
			categoryDefs
				.map((category) => {
					return `
						<button type="button" class="sd-telemetrics-picker__rail-item${activeCategory === category.id ? " is-active" : ""}" data-category="${category.id}">
							<span class="sd-telemetrics-picker__rail-label">${category.label}</span>
							<span class="sd-telemetrics-picker__rail-count">${category.count}</span>
						</button>
					`
				})
				.join(""),
		)
	}

	function renderMetricList($widget) {
		const $modal = ensurePickerModal($widget)
		const metrics = filterMetrics($widget)
		const sourceId = String($widget.data("sd-picker-source") || "all")
		const pinMap = $widget.data("sd-pin-map") || {}
		const sourceLabel =
			SOURCE_DEFS.find((source) => source.id === sourceId)?.label || "All Sources"
		const $list = $modal.find(".sd-telemetrics-picker__list")

		$modal
			.find(".sd-telemetrics-picker__source")
			.val(sourceId)
		$modal
			.find(".sd-telemetrics-picker__list-title")
			.text(`${sourceLabel} (${metrics.length})`)

		if (!metrics.length) {
			$list.html('<div class="sd-telemetrics-picker__empty">No pins match the current filter.</div>')
			return
		}

		$list.html(
			metrics
				.map((metric) => {
					const pinDefinition = metric.pin_definition
					const metricId = String(pinDefinition?.id || `metric_${metric.key.replace(/[^a-z0-9_-]/gi, "_")}`)
					const isPinned = !!pinMap[metricId]
					const analysis =
						metric.analysis && typeof metric.analysis === "object"
							? metric.analysis
							: {
									status: metric.status || "ok",
									severity: metric.status === "error" ? 3 : metric.status === "warn" ? 2 : 1,
									trend: metric.trend || "stable",
									emphasis: metric.status === "error" ? "high" : metric.status === "warn" ? "medium" : "low",
									state_label: metric.label || metric.status || "ok",
								}
					const hasSpecialCandidate = hasSpecialPinDefinition(metric)
					const candidateLabel = hasSpecialCandidate
						? String(pinDefinition.label || metric.label || "")
						: ""
					const candidateDescription = hasSpecialCandidate
						? String(pinDefinition.description || metric.description || "")
						: ""
					const candidateSize = hasSpecialCandidate ? String(pinDefinition.size || "1x1") : "1x1"
					const candidateRenderer = hasSpecialCandidate
						? normalizePinRenderer(pinDefinition.renderer || "dom")
						: "dom"
					const candidatePinned = hasSpecialCandidate && !!pinMap[String(pinDefinition.id || metricId)]
					const rowButtonLabel = hasSpecialCandidate
						? candidatePinned
							? "Unpin Clock"
							: "Add Clock Pin"
						: isPinned
							? "Unpin"
							: "Pin to Grid"
					const rowTitle = hasSpecialCandidate
						? candidateLabel
						: String(pinDefinition?.label || metric.label || "")
					const rowDescription = hasSpecialCandidate
						? candidateDescription
						: String(pinDefinition?.description || metric.description || "")
					const rowIcon =
						hasSpecialCandidate && pinDefinition?.icon ? String(pinDefinition.icon) : getMetricIcon(metric)
					const pinnedState = hasSpecialCandidate ? candidatePinned : isPinned
					const definitionId = String(pinDefinition?.id || "")

					return `
						<div class="sd-telemetrics-picker__row sd-telemetrics-picker__row--${analysis.status} ${hasSpecialCandidate ? "sd-telemetrics-picker__row--candidate" : ""}" data-metric-key="${metric.key}" data-definition-id="${definitionId}" data-status="${analysis.status}" data-renderer="${candidateRenderer}" data-size="${candidateSize}">
							<div class="sd-telemetrics-picker__row-icon"><span class="dashicons ${rowIcon}" aria-hidden="true"></span></div>
							<div class="sd-telemetrics-picker__row-copy">
								<div class="sd-telemetrics-picker__row-title">${rowTitle}${hasSpecialCandidate ? ` <span class="sd-telemetrics-picker__row-badge">${candidateSize} ${candidateRenderer.replace(/_/g, " ")}</span>` : ""}</div>
								<div class="sd-telemetrics-picker__row-description">${rowDescription}</div>
							</div>
							<div class="sd-telemetrics-picker__row-sample">${formatMetricValue(metric)}</div>
							<div class="sd-telemetrics-picker__row-action">
								<button type="button" class="button ${pinnedState ? "button-secondary" : "button-primary"} sd-telemetrics-picker__pin-btn" data-metric-key="${metric.key}" data-definition-id="${definitionId}" data-is-pinned="${pinnedState ? "1" : "0"}" data-renderer="${candidateRenderer}" data-size="${candidateSize}">
									${rowButtonLabel}
								</button>
							</div>
						</div>
					`
				})
				.join(""),
		)
	}

	function saveMergedPins($widget, mergedPins) {
		const workspaceId = resolveWorkspaceId($widget)

		const nextPinMap = {}
		;(Array.isArray(mergedPins) ? mergedPins : []).forEach((pin) => {
			if (pin && pin.id) nextPinMap[pin.id] = pin
		})

		$widget.data("sd-pin-map", nextPinMap)
		broadcastPinsUpdated(workspaceId, mergedPins)

		$.post(getAjaxUrl(), {
			action: "sd_save_workspace_pins",
			workspace_id: workspaceId,
			pins: JSON.stringify(mergedPins),
			nonce: getNonce(),
		})
	}

	function syncPins($widget) {
		const workspaceId = resolveWorkspaceId($widget)
		return fetchPins(workspaceId).done((pinsPayload) => {
			const pinMap = {}
			;(pinsPayload?.data?.pins || []).forEach((pin) => {
				if (pin && pin.id) pinMap[pin.id] = pin
			})
			$widget.data("sd-pin-map", pinMap)
			renderLauncherShell($widget)
			if (ensurePickerModal($widget).is(":visible")) {
				renderCategoryRail($widget)
				renderMetricList($widget)
			}
		})
	}

	function syncMetricRegistry($widget) {
		return fetchPinSafeMetrics().done((payload) => {
			const pinDefinitions =
				payload?.data?.pin_definitions && typeof payload.data.pin_definitions === "object"
					? payload.data.pin_definitions
					: {}
			const metrics = Array.isArray(payload?.data?.metrics) ? payload.data.metrics : []
			$widget.data("sd-metric-registry", buildPinCatalog(metrics, pinDefinitions))
			renderLauncherShell($widget)
			if (ensurePickerModal($widget).is(":visible")) {
				renderCategoryRail($widget)
				renderMetricList($widget)
			}
		})
	}

	function openPicker($widget) {
		const $modal = ensurePickerModal($widget)
		const resolvedWorkspaceId = resolveWorkspaceId($widget)
		$widget.attr("data-workspace-id", resolvedWorkspaceId)
		$widget.data("sd-workspace-id", resolvedWorkspaceId)
		$modal.find(".sd-telemetrics-picker__search").val(String($widget.data("sd-picker-search") || ""))
		$modal.find(".sd-telemetrics-picker__source").val(String($widget.data("sd-picker-source") || "all"))
		$modal.css("display", "flex")
		renderCategoryRail($widget)
		renderMetricList($widget)
		window.requestAnimationFrame(() => {
			$modal.find(".components-modal__frame").trigger("focus")
		})
		syncPins($widget)
		syncMetricRegistry($widget)
	}

	function closePicker($widget) {
		const $modal = ensurePickerModal($widget)
		const active = document.activeElement
		if (active && $modal[0] && $modal[0].contains(active) && typeof active.blur === "function") {
			active.blur()
		}
		$modal.hide()
		const $trigger = $widget.find(".sd-open-telemetrics-picker")
		if ($trigger.length) {
			window.requestAnimationFrame(() => {
				$trigger.trigger("focus")
			})
		} else {
			const launcher = document.getElementById(MODULE_LAUNCHER_ID)
			if (launcher && typeof launcher.focus === "function") {
				window.requestAnimationFrame(() => launcher.focus())
			}
		}
	}

	function toggleMetricPin($widget, itemKey, explicitDefinitionId = "") {
		const metrics = getMetricCatalog($widget)
		const metric = metrics.find((item) => item.key === itemKey)
		if (!metric) return
		const pinDefinition = metric.pin_definition || null

		const workspaceId = resolveWorkspaceId($widget)
		const $modal = ensurePickerModal($widget)
		const $listWrap = $modal.find(".sd-telemetrics-picker__list-wrap")
		const scrollTop = $listWrap.scrollTop()
		const currentPinMap = $widget.data("sd-pin-map") || {}
		const existingPins = Object.values(currentPinMap).filter((pin) => pin && typeof pin === "object")
		const nextPinId = String(pinDefinition?.id || `metric_${metric.key.replace(/[^a-z0-9_-]/gi, "_")}`)
		const isPinned = existingPins.some((pin) => pin?.id === nextPinId)
		if (isPinned) {
			const mergedPins = existingPins.filter((pin) => pin?.id !== nextPinId)
			saveMergedPins($widget, mergedPins)
			renderLauncherShell($widget)
			renderMetricList($widget)
			$modal.find(".sd-telemetrics-picker__search").val(String($widget.data("sd-picker-search") || ""))
			$listWrap.scrollTop(scrollTop)
			return
		}

		const createRequest =
			pinDefinition?.type === "metric"
				? createMetricPin(workspaceId, String(pinDefinition.metric_key || metric.key || ""))
				: createRegistryPin(workspaceId, String(explicitDefinitionId || pinDefinition?.id || metric.key || ""))

		createRequest.done((payload) => {
			if (!payload?.success || !payload?.data?.pin) {
				return
			}
			const normalizedPin = normalizePinRecord(payload.data.pin)
			const mergedPins = [
				...existingPins.filter((pin) => pin?.id !== normalizedPin.id),
				normalizedPin,
			]
			const nextPinMap = {}
			mergedPins.forEach((pin) => {
				if (pin && pin.id) nextPinMap[pin.id] = pin
			})
			$widget.data("sd-pin-map", nextPinMap)
			broadcastPinsUpdated(workspaceId, mergedPins)
			renderLauncherShell($widget)
			renderMetricList($widget)
			$modal.find(".sd-telemetrics-picker__search").val(String($widget.data("sd-picker-search") || ""))
			$listWrap.scrollTop(scrollTop)
		})
	}

	function initWidget(root) {
		const $widget = $(root)
		if (!$widget.length) return
		const resolvedWorkspaceId = resolveWorkspaceId($widget)
		const previousWorkspaceId = String($widget.data("sd-workspace-id") || "").trim()
		$widget.attr("data-workspace-id", resolvedWorkspaceId)
		$widget.data("sd-workspace-id", resolvedWorkspaceId)
		const workspaceChanged =
			previousWorkspaceId !== "" && previousWorkspaceId !== resolvedWorkspaceId
		if (
			$widget.data("sd-system-status-init") &&
			$widget.find(".sd-telemetrics-launcher-host").length
		) {
			if (workspaceChanged) {
				$widget.data("sd-pin-map", {})
				renderLauncherShell($widget)
				syncPins($widget)
			}
			return
		}

		try {
			$widget.data("sd-system-status-init", false)
			$widget.data("sd-pin-map", $widget.data("sd-pin-map") || {})
			$widget.data("sd-metric-registry", $widget.data("sd-metric-registry") || [])
			$widget.data("sd-picker-category", $widget.data("sd-picker-category") || "all")
			$widget.data("sd-picker-source", $widget.data("sd-picker-source") || "all")
			$widget.data("sd-picker-search", $widget.data("sd-picker-search") || "")

			ensureWidgetShell($widget)
			renderLauncherShell($widget)
			ensurePickerModal($widget)
			$widget.data("sd-system-status-init", true)
			syncPins($widget)
			syncMetricRegistry($widget)
		} catch (error) {
			$widget.removeData("sd-system-status-init")
			console.error("SystemDeck Telemetrics: widget init failed", error)
		}
	}

	function initAll() {
		$(".sd-system-status-widget").each(function () {
			initWidget(this)
		})
	}

	function initModuleHost() {
		ensureModuleStyle()
		const host = ensureModuleHost()
		if (!host) return
		const $host = $(host)
		$host.attr("data-workspace-id", resolveWorkspaceId($host))
		initWidget(host)
		ensureHeaderLauncher()
	}

	function openModulePicker() {
		const host = ensureModuleHost()
		if (!host) return
		const $host = $(host)
		$host.attr("data-workspace-id", resolveWorkspaceId($host))
		initWidget(host)
		openPicker($host)
	}

	$(document)
		.off("systemdeck:pins-updated.sdSystemStatusPicker")
		.on("systemdeck:pins-updated.sdSystemStatusPicker", function (event) {
			const detail = event.originalEvent?.detail || event.detail || {}
			const workspaceId = detail.workspaceId || "default"
			const pinMap = {}
			;(detail.pins || []).forEach((pin) => {
				if (pin && pin.id) pinMap[pin.id] = pin
			})
			$(`.sd-system-status-widget[data-workspace-id="${workspaceId}"]`).each(function () {
				const $widget = $(this)
				const $modal = ensurePickerModal($widget)
				const $listWrap = $modal.find(".sd-telemetrics-picker__list-wrap")
				const scrollTop = $listWrap.scrollTop()
				$widget.data("sd-pin-map", pinMap)
				renderLauncherShell($widget)
				if ($modal.is(":visible")) {
					renderCategoryRail($widget)
					renderMetricList($widget)
					$modal.find(".sd-telemetrics-picker__search").val(String($widget.data("sd-picker-search") || ""))
					$listWrap.scrollTop(scrollTop)
				}
			})
		})

	$(document)
		.off("click.sdOpenTelemetricsPicker")
		.on("click.sdOpenTelemetricsPicker", ".sd-system-status-widget .sd-open-telemetrics-picker", function (e) {
			e.preventDefault()
			openPicker($(this).closest(".sd-system-status-widget"))
		})
		.off("click.sdOpenTelemetricsPickerModule")
		.on("click.sdOpenTelemetricsPickerModule", `#${MODULE_LAUNCHER_ID}`, function (e) {
			e.preventDefault()
			openModulePicker()
		})

	$(document)
		.off("click.sdCloseTelemetricsPicker")
		.on("click.sdCloseTelemetricsPicker", ".sd-system-status-widget .sd-telemetrics-picker__close, .sd-system-status-widget .sd-telemetrics-picker-modal", function (e) {
			const $target = $(e.target)
			const isCloseButton = $target.closest(".sd-telemetrics-picker__close").length > 0
			const isDirectOverlayClick = $(this).hasClass("sd-telemetrics-picker-modal") && e.target === this
			if (!isCloseButton && !isDirectOverlayClick) return
			e.preventDefault()
			closePicker($(this).closest(".sd-system-status-widget"))
		})

	$(document)
		.off("keydown.sdTelemetricsEscape")
		.on("keydown.sdTelemetricsEscape", function (e) {
			if (e.key !== "Escape") return
			const $modal = $(".sd-system-status-widget .sd-telemetrics-picker-modal:visible").last()
			if (!$modal.length) return
			e.preventDefault()
			closePicker($modal.closest(".sd-system-status-widget"))
		})

	$(document)
		.off("click.sdTelemetricsCategory")
		.on("click.sdTelemetricsCategory", ".sd-system-status-widget .sd-telemetrics-picker__rail-item", function (e) {
			e.preventDefault()
			const $widget = $(this).closest(".sd-system-status-widget")
			$widget.data("sd-picker-category", $(this).data("category") || "all")
			renderCategoryRail($widget)
			renderMetricList($widget)
		})

	$(document)
		.off("change.sdTelemetricsSource")
		.on("change.sdTelemetricsSource", ".sd-system-status-widget .sd-telemetrics-picker__source", function () {
			const $widget = $(this).closest(".sd-system-status-widget")
			$widget.data("sd-picker-source", $(this).val() || "all")
			$widget.data("sd-picker-category", "all")
			renderCategoryRail($widget)
			renderMetricList($widget)
		})

	$(document)
		.off("input.sdTelemetricsSearch")
		.on("input.sdTelemetricsSearch", ".sd-system-status-widget .sd-telemetrics-picker__search", function () {
			const $widget = $(this).closest(".sd-system-status-widget")
			$widget.data("sd-picker-search", $(this).val() || "")
			renderMetricList($widget)
		})

	$(document)
		.off("click.sdTelemetricsPin")
		.on("click.sdTelemetricsPin", ".sd-system-status-widget .sd-telemetrics-picker__pin-btn", function (e) {
			e.preventDefault()
			toggleMetricPin(
				$(this).closest(".sd-system-status-widget"),
				String($(this).data("metric-key") || ""),
				String($(this).data("definition-id") || ""),
			)
		})

	$(document).ready(function () {
		initAll()
		initModuleHost()
	})
	$(document).on("sd_workspace_rendered", function () {
		initAll()
		initModuleHost()
	})
	document.addEventListener("systemdeck:widget:mount", function () {
		initAll()
	})
	document.addEventListener("systemdeck:pins-updated", function () {
		initModuleHost()
	})
})(jQuery)
