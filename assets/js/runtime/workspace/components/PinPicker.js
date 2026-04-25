import { useEffect, useMemo, useRef, useState } from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { Modal, Spinner } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import { STORE_NAME } from "../state/store"
import "./PinPicker.css"

const SOURCE_DEFS = [
	{ id: "all", label: "All Sources" },
	{ id: "core", label: "Core" },
	{ id: "widget", label: "Widgets" },
	{ id: "app", label: "Apps" },
	{ id: "wp.metrics", label: "WP" },
	{ id: "third_party", label: "Third-Party" },
]

const getNonce = () =>
	window.SystemDeckSecurity?.nonce ||
	window.sd_vars?.nonce ||
	window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
	window.SYSTEMDECK_STATE?.config?.nonce ||
	""

const getAjaxUrl = () =>
	window.SystemDeckSecurity?.ajaxurl ||
	window.sd_vars?.ajaxurl ||
	window.sd_vars?.ajax_url ||
	window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
	window.SYSTEMDECK_STATE?.config?.ajaxurl ||
	window.ajaxurl ||
	"/wp-admin/admin-ajax.php"

const postAction = async (body) => {
	const formData = new FormData()
	Object.entries(body).forEach(([key, value]) => formData.append(key, value))
	const response = await fetch(getAjaxUrl(), {
		method: "POST",
		body: formData,
	})
	return response.json()
}

const normalizePinRenderer = (rawRenderer) => {
	const renderer = String(rawRenderer || "")
		.trim()
		.toLowerCase()
	return renderer || "dom"
}

const normalizePinRecord = (pin, index = 0) => {
	const source = pin && typeof pin === "object" ? pin : {}
	const data =
		source.data && typeof source.data === "object" ? source.data : {}
	const id = String(source.id || `metric_${index}`).trim()
	const size = ["1x1", "2x1", "3x1", "4x1", "1x2", "2x2", "3x2"].includes(
		String(source.size || ""),
	)
		? String(source.size)
		: "1x1"

	return {
		id,
		type: String(source.type || "system.status"),
		size,
		renderer: normalizePinRenderer(
			source.renderer || source?.settings?.renderer,
		),
		title: String(source.title || data.label || source.label || id),
		data: {
			label: String(data.label || source.label || id),
			icon: String(data.icon || source.icon || "dashicons-admin-generic"),
			source_widget: String(
				data.source_widget ||
					source.source_widget ||
					"systemdeck.pin-registry",
			),
			metric_key: String(data.metric_key || source.metric_key || ""),
			metric_family: String(
				data.metric_family || source.metric_family || "",
			),
			metric_authority: String(
				data.metric_authority || source.metric_authority || "",
			),
			metric_mode: String(data.metric_mode || source.metric_mode || ""),
			category: String(data.category || source.category || ""),
			description: String(data.description || source.description || ""),
			value_label: String(data.value_label || source.value_label || ""),
			action: String(data.action || source.action || ""),
			pin_definition_id: String(
				data.pin_definition_id || source.pin_definition_id || "",
			),
		},
		design_template: String(source.design_template || "default"),
	}
}

const findMetricPinDefinition = (pinDefinitions, metricKey) => {
	if (!pinDefinitions || typeof pinDefinitions !== "object") return null
	const target = String(metricKey || "").trim()
	if (!target) return null

	return (
		Object.values(pinDefinitions).find(
			(definition) =>
				definition &&
				typeof definition === "object" &&
				String(definition.metric_key || "").trim() === target,
		) || null
	)
}

const normalizePinDefinition = (definition, metric) => {
	const source =
		definition && typeof definition === "object" ? definition : {}
	const defaults =
		source.defaults && typeof source.defaults === "object"
			? source.defaults
			: {}
	const sourceInfo =
		source.source && typeof source.source === "object" ? source.source : {}
	const fallbackMetric = metric && typeof metric === "object" ? metric : {}

	return {
		id: String(source.id || "").trim(),
		label: String(
			source.label || fallbackMetric.label || fallbackMetric.key || "",
		).trim(),
		description: String(
			source.description || fallbackMetric.description || "",
		).trim(),
		type: String(source.type || "metric").trim(),
		metric_key: String(
			source.metric_key || fallbackMetric.key || "",
		).trim(),
		renderer: normalizePinRenderer(source.renderer || "dom"),
		size: String(defaults.size || "1x1").trim() || "1x1",
		icon: String(source.icon || fallbackMetric.icon || "").trim(),
		source_kind: String(sourceInfo.kind || "").trim(),
		source_authority: String(sourceInfo.authority || "").trim(),
		source_id: String(sourceInfo.id || "").trim(),
		value_label: String(source?.meta?.value_label || "").trim(),
	}
}

const normalizeStandalonePinDefinition = (definition) => {
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

const normalizeMetric = (metric, pinDefinitions) => {
	const source = metric && typeof metric === "object" ? metric : {}
	const key = String(source.key || "").trim()
	const rawDefinition = findMetricPinDefinition(pinDefinitions, key)
	const pinDefinition = rawDefinition
		? normalizePinDefinition(rawDefinition, source)
		: null
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
			source.analysis && typeof source.analysis === "object"
				? source.analysis
				: null,
		pin_definition: pinDefinition,
	}
}

const hasSpecialPinDefinition = (metric) => {
	const definition = metric?.pin_definition
	if (!definition || typeof definition !== "object") return false
	return definition.renderer !== "dom" || definition.size !== "1x1"
}

const buildPinCatalog = (metrics, pinDefinitions) => {
	const indexed = {}
	const definitionMap =
		pinDefinitions && typeof pinDefinitions === "object"
			? pinDefinitions
			: {}

	Object.keys(definitionMap).forEach((definitionId) => {
		const item = normalizeStandalonePinDefinition(
			definitionMap[definitionId],
		)
		if (item && item.pin_definition?.type !== "metric") {
			indexed[item.key] = item
		}
	})
	;(Array.isArray(metrics) ? metrics : []).forEach((metric) => {
		const item = normalizeMetric(metric, definitionMap)
		if (item?.key) indexed[item.key] = item
	})

	return Object.values(indexed)
}

const formatMetricValue = (metric) => {
	if (
		typeof metric?.display_value === "string" &&
		metric.display_value !== ""
	) {
		return metric.display_value
	}

	const unit = String(metric?.unit || "text")
	const value = metric?.value
	if (value === null || value === undefined || value === "") return "--"
	if (unit === "boolean") return value ? "Yes" : "No"
	if (unit === "bytes") {
		const numeric = Number(value)
		if (!Number.isFinite(numeric)) return String(value)
		if (numeric >= 1073741824)
			return `${(numeric / 1073741824).toFixed(2)} GB`
		if (numeric >= 1048576) return `${(numeric / 1048576).toFixed(2)} MB`
		if (numeric >= 1024) return `${(numeric / 1024).toFixed(1)} KB`
		return `${numeric} B`
	}
	if (unit === "seconds") return `${value}s`
	if (unit === "percent") return `${value}%`
	if (unit === "count") return String(value)
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

const getMetricIcon = (metric) => {
	const category = String(metric?.category || "")
	const family = String(metric?.family || "")
	if (family === "wp.metrics") return "dashicons-wordpress"
	if (family === "widget") return "dashicons-admin-tools"
	if (family === "app") return "dashicons-screenoptions"
	if (metric?.icon) return String(metric.icon)
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

const getCategoryDefs = (metrics, activeSource) => {
	const source = String(activeSource || "all")
	const scoped = Array.isArray(metrics)
		? metrics.filter(
				(metric) => source === "all" || metric.family === source,
		  )
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
				label: category
					.replace(/[-_]+/g, " ")
					.replace(/\b\w/g, (c) => c.toUpperCase()),
				count: counts[category],
			})
		})
	return defs
}

const clonePinMap = (pins) =>
	JSON.parse(JSON.stringify(pins && typeof pins === "object" ? pins : {}))

const dispatchPinsUpdated = (workspaceId, pins) => {
	document.dispatchEvent(
		new CustomEvent("systemdeck:pins-updated", {
			detail: { workspaceId, pins },
		}),
	)
}

const buildPreviewPinFromMetric = (metric) => {
	const pinDefinition = metric?.pin_definition || {}
	const nextPinId = String(
		pinDefinition?.id ||
			`metric_${String(metric?.key || "").replace(/[^a-z0-9_-]/gi, "_")}`,
	)
	const title = String(pinDefinition?.label || metric?.label || nextPinId)
	const sourceKind = String(pinDefinition?.source_kind || metric?.family || "")
	const sourceAuthority = String(
		pinDefinition?.source_authority || metric?.authority || "",
	)
	const sourceId = String(pinDefinition?.source_id || metric?.key || "")

	return normalizePinRecord({
		id: nextPinId,
		type: String(pinDefinition?.type || "metric"),
		size: String(pinDefinition?.size || "1x1"),
		renderer: normalizePinRenderer(pinDefinition?.renderer || "dom"),
		title,
		design_template: "default",
		data: {
			label: title,
			icon: String(pinDefinition?.icon || getMetricIcon(metric)),
			source_widget: String(metric?.key || "systemdeck.pin-registry"),
			metric_key: String(pinDefinition?.metric_key || metric?.key || ""),
			metric_family: String(metric?.family || ""),
			metric_authority: String(metric?.authority || ""),
			metric_mode: String(metric?.mode || ""),
			category: String(metric?.category || ""),
			description: String(pinDefinition?.description || metric?.description || ""),
			value_label: String(pinDefinition?.value_label || formatMetricValue(metric)),
			action: String(pinDefinition?.type === "metric" ? "" : "open"),
			pin_definition_id: String(pinDefinition?.id || ""),
			pin_source_kind: sourceKind,
			pin_source_authority: sourceAuthority,
			pin_source_id: sourceId,
			value: String(metric?.value ?? ""),
		},
		settings: {
			label: title,
			icon: String(pinDefinition?.icon || getMetricIcon(metric)),
			source_widget: String(metric?.key || "systemdeck.pin-registry"),
			metric_key: String(pinDefinition?.metric_key || metric?.key || ""),
			metric_family: String(metric?.family || ""),
			metric_authority: String(metric?.authority || ""),
			metric_mode: String(metric?.mode || ""),
			category: String(metric?.category || ""),
			description: String(pinDefinition?.description || metric?.description || ""),
			value_label: String(pinDefinition?.value_label || formatMetricValue(metric)),
			action: String(pinDefinition?.type === "metric" ? "" : "open"),
			pin_definition_id: String(pinDefinition?.id || ""),
			pin_source_kind: sourceKind,
			pin_source_authority: sourceAuthority,
			pin_source_id: sourceId,
			grid_span: String(pinDefinition?.size || "1x1"),
			renderer: normalizePinRenderer(pinDefinition?.renderer || "dom"),
			design_template: "default",
		},
	})
}

const canOpenPinPickerForWorkspace = (
	uiMode,
	activeWorkspace,
	activeWorkspaceId,
) => {
	const userConfig = window.SYSTEMDECK_BOOTSTRAP?.config?.user || {}
	const canManageOptions = !!userConfig.can_manage_options
	const canManageWorkspaces = !!userConfig.can_manage_workspaces

	if (uiMode !== "runtime" || !activeWorkspaceId) return false
	if (!canManageOptions && !canManageWorkspaces) return false
	if (activeWorkspace?.shared_incoming && activeWorkspace?.is_locked)
		return false
	return true
}

export default function PinPicker() {
	const { isOpen, activeWorkspace, activeWorkspaceId, uiMode } = useSelect(
		(select) => {
			const store = select(STORE_NAME)
			return {
				isOpen: store.isPinPickerOpen ? store.isPinPickerOpen() : false,
				activeWorkspace: store.getActiveWorkspace
					? store.getActiveWorkspace()
					: null,
				activeWorkspaceId: store.getActiveWorkspaceId
					? store.getActiveWorkspaceId()
					: "",
				uiMode: store.getUIMode ? store.getUIMode() : "runtime",
			}
		},
		[],
	)
	const { togglePinPicker } = useDispatch(STORE_NAME)
	const [pinMap, setPinMap] = useState({})
	const [metricCatalog, setMetricCatalog] = useState([])
	const [sourceId, setSourceId] = useState("all")
	const [categoryId, setCategoryId] = useState("all")
	const [searchTerm, setSearchTerm] = useState("")
	const [blockStatus, setBlockStatus] = useState(null)
	const [isSyncing, setIsSyncing] = useState(false)
	const initialPinMapRef = useRef(null)

	const canOpen = canOpenPinPickerForWorkspace(
		uiMode,
		activeWorkspace,
		activeWorkspaceId,
	)

	useEffect(() => {
		if (!canOpen && isOpen) {
			togglePinPicker(false)
		}
	}, [canOpen, isOpen, togglePinPicker])

	useEffect(() => {
		if (!isOpen || !activeWorkspaceId) return undefined
		let cancelled = false

		const load = async () => {
			try {
				const [pinsPayload, metricsPayload] = await Promise.all([
					postAction({
						action: "sd_get_workspace_pins",
						workspace_id: activeWorkspaceId,
						nonce: getNonce(),
					}),
					postAction({
						action: "sd_get_pin_safe_metrics",
						nonce: getNonce(),
					}),
				])
				if (cancelled) return

				const nextPinMap = {}
				;(pinsPayload?.data?.pins || []).forEach((pin, index) => {
					const normalizedPin = normalizePinRecord(pin, index)
					if (normalizedPin?.id)
						nextPinMap[normalizedPin.id] = normalizedPin
				})
				setPinMap(nextPinMap)
				initialPinMapRef.current = clonePinMap(nextPinMap)

				const pinDefinitions =
					metricsPayload?.data?.pin_definitions &&
					typeof metricsPayload.data.pin_definitions === "object"
						? metricsPayload.data.pin_definitions
						: {}
				const metrics = Array.isArray(metricsPayload?.data?.metrics)
					? metricsPayload.data.metrics
					: []
				setMetricCatalog(buildPinCatalog(metrics, pinDefinitions))
			} catch (_error) {
				if (!cancelled) {
					setPinMap({})
					setMetricCatalog([])
				}
			}
		}

		load()
		return () => {
			cancelled = true
		}
	}, [activeWorkspaceId, isOpen])

	useEffect(() => {
		if (!activeWorkspaceId) return undefined
		const handlePinsUpdated = (event) => {
			const detail = event?.detail || {}
			if ((detail.workspaceId || "default") !== activeWorkspaceId) return
			const nextPinMap = {}
			;(detail.pins || []).forEach((pin, index) => {
				const normalizedPin = normalizePinRecord(pin, index)
				if (normalizedPin?.id)
					nextPinMap[normalizedPin.id] = normalizedPin
			})
			setPinMap(nextPinMap)
		}
		document.addEventListener("systemdeck:pins-updated", handlePinsUpdated)
		return () =>
			document.removeEventListener(
				"systemdeck:pins-updated",
				handlePinsUpdated,
			)
	}, [activeWorkspaceId])

	useEffect(() => {
		setCategoryId("all")
		setSourceId("all")
		setSearchTerm("")
		setBlockStatus(null)
		setIsSyncing(false)
		if (!isOpen) {
			initialPinMapRef.current = null
		}
	}, [activeWorkspaceId, isOpen])

	const filteredMetrics = useMemo(() => {
		const normalizedSearchTerm = String(searchTerm || "")
			.trim()
			.toLowerCase()
		return metricCatalog.filter((metric) => {
			if (sourceId !== "all" && metric.family !== sourceId) return false
			if (categoryId !== "all" && metric.category !== categoryId)
				return false
			if (!normalizedSearchTerm) return true
			const haystack = [
				metric.label,
				metric.description,
				metric.category,
				metric.key,
				metric.family,
			]
				.join(" ")
				.toLowerCase()
			return haystack.includes(normalizedSearchTerm)
		})
	}, [categoryId, metricCatalog, searchTerm, sourceId])

	const categoryDefs = useMemo(
		() => getCategoryDefs(metricCatalog, sourceId),
		[metricCatalog, sourceId],
	)

	const sourceLabel = useMemo(
		() =>
			SOURCE_DEFS.find((source) => source.id === sourceId)?.label ||
			"All Sources",
		[sourceId],
	)
	const hasPendingChanges = useMemo(() => {
		const initial = initialPinMapRef.current || {}
		const currentIds = Object.keys(pinMap).sort()
		const initialIds = Object.keys(initial).sort()
		if (currentIds.length !== initialIds.length) return true
		return currentIds.some((id, index) => id !== initialIds[index])
	}, [pinMap])

	if (!isOpen || !canOpen) return null

	const restoreInitialPins = () => {
		const restored = clonePinMap(initialPinMapRef.current || {})
		setPinMap(restored)
		dispatchPinsUpdated(activeWorkspaceId, Object.values(restored))
	}

	const handleRequestClose = () => {
		if (!isSyncing) {
			restoreInitialPins()
		}
		togglePinPicker(false)
	}

	const handleTogglePin = (metric) => {
		const pinDefinition = metric?.pin_definition || null
		const existingPins = Object.values(pinMap).filter(
			(pin) => pin && typeof pin === "object",
		)
		const nextPinId = String(
			pinDefinition?.id ||
				`metric_${metric.key.replace(/[^a-z0-9_-]/gi, "_")}`,
		)
		const isPinned = existingPins.some((pin) => pin?.id === nextPinId)

		if (isPinned) {
			setBlockStatus({
				type: "success",
				message: __("Pin removed.", "systemdeck"),
			})
			const mergedPins = existingPins.filter(
				(pin) => pin?.id !== nextPinId,
			)
			const nextPinMap = {}
			mergedPins.forEach((pin) => {
				if (pin?.id) nextPinMap[pin.id] = pin
			})
			setPinMap(nextPinMap)
			dispatchPinsUpdated(activeWorkspaceId, mergedPins)
			return
		}

		setBlockStatus({
			type: "success",
			message: __("Pin added.", "systemdeck"),
		})
		const normalizedPin = buildPreviewPinFromMetric(metric)
		const mergedPins = [
			...existingPins.filter((pin) => pin?.id !== normalizedPin.id),
			normalizedPin,
		]
		const nextPinMap = {}
		mergedPins.forEach((pin) => {
			if (pin?.id) nextPinMap[pin.id] = pin
		})
		setPinMap(nextPinMap)
		dispatchPinsUpdated(activeWorkspaceId, mergedPins)
	}

	const handleSavePins = async () => {
		if (!activeWorkspaceId || isSyncing) return
		if (!hasPendingChanges) {
			togglePinPicker(false)
			return
		}

		setIsSyncing(true)
		try {
			const payload = await postAction({
				action: "sd_save_workspace_pins",
				workspace_id: activeWorkspaceId,
				pins: JSON.stringify(Object.values(pinMap)),
				nonce: getNonce(),
			})
			if (!payload?.success) {
				setBlockStatus({
					type: "error",
					message:
						payload?.data?.message ||
						__("Pin sync failed.", "systemdeck"),
				})
				setIsSyncing(false)
				return
			}
			initialPinMapRef.current = clonePinMap(pinMap)
			togglePinPicker(false)
		} catch (_error) {
			setBlockStatus({
				type: "error",
				message: __("Pin sync failed.", "systemdeck"),
			})
			setIsSyncing(false)
		}
	}

	return (
		<Modal
			title={__("Pin Picker", "systemdeck")}
			className='sd-telemetrics-picker-modal'
			onRequestClose={handleRequestClose}>
			<div className='sd-pin-picker__surface'>
				<div className='sd-pin-picker'>
					{isSyncing ? (
						<div
							className='sd-pin-picker__loading'
							aria-live='polite'
							aria-busy='true'>
							<div className='sd-pin-picker__loading-card'>
								<Spinner />
								<span>{__("Saving pins...", "systemdeck")}</span>
							</div>
						</div>
					) : null}
					<div className='sd-pin-picker__toolbar'>
						<div className='sd-pin-picker__toolbar-field'>
							<select
								className='sd-pin-picker__source-select'
								value={sourceId}
								onChange={(event) => setSourceId(event.target.value)}>
								{SOURCE_DEFS.map((source) => (
									<option key={source.id} value={source.id}>
										{source.label}
									</option>
								))}
							</select>
						</div>
						<div className='sd-pin-picker__toolbar-field'>
							<input
								type='search'
								className='sd-pin-picker__search'
								value={searchTerm}
								onChange={(event) =>
									setSearchTerm(event.target.value)
								}
								placeholder={__(
									"Search pins…",
									"systemdeck",
								)}
							/>
						</div>
						<div className='sd-pin-picker__toolbar-actions'>
							<button
								type='button'
								className='button button-primary sd-pin-picker__save-btn'
								disabled={!hasPendingChanges || isSyncing}
								onClick={handleSavePins}>
								{__("Save Pins", "systemdeck")}
							</button>
						</div>
					</div>
					<div className='sd-pin-picker__layout'>
						<aside className='sd-pin-picker__rail'>
							{categoryDefs.map((category) => (
								<button
									key={category.id}
									type='button'
									className={`sd-pin-picker__rail-item${
										categoryId === category.id
											? " is-active"
											: ""
									}`}
									onClick={() => setCategoryId(category.id)}>
									<span className='sd-pin-picker__rail-label'>
										{category.label}
									</span>
									<span className='sd-pin-picker__rail-count'>
										{category.count}
									</span>
								</button>
							))}
						</aside>
						<section className='sd-pin-picker__panel'>
							<div className='sd-pin-picker__panel-header'>
								<div className='sd-pin-picker__panel-title'>
									{`${sourceLabel} (${filteredMetrics.length})`}
								</div>
							</div>
							{blockStatus ? (
								<div
									className={`sd-pin-picker__status ${
										blockStatus.type === "success"
											? "is-success"
											: "is-error"
									}`}>
									{blockStatus.message}
								</div>
							) : null}
							<div className='sd-pin-picker__list'>
								{!filteredMetrics.length ? (
									<div className='sd-pin-picker__empty'>
										{__(
											"No pins match the current filter.",
											"systemdeck",
										)}
									</div>
								) : (
									filteredMetrics.map((metric) => {
										const pinDefinition =
											metric.pin_definition
										const metricId = String(
											pinDefinition?.id ||
												`metric_${metric.key.replace(
													/[^a-z0-9_-]/gi,
													"_",
												)}`,
										)
										const isPinned = !!pinMap[metricId]
										const analysis =
											metric.analysis &&
											typeof metric.analysis === "object"
												? metric.analysis
												: {
														status:
															metric.status ||
															"ok",
														severity:
															metric.status ===
															"error"
																? 3
																: metric.status ===
																  "warn"
																? 2
																: 1,
														trend:
															metric.trend ||
															"stable",
														emphasis:
															metric.status ===
															"error"
																? "high"
																: metric.status ===
																  "warn"
																? "medium"
																: "low",
														state_label:
															metric.label ||
															metric.status ||
															"ok",
												  }
										const hasSpecialCandidate =
											hasSpecialPinDefinition(metric)
										const candidateLabel =
											hasSpecialCandidate
												? String(
														pinDefinition.label ||
															metric.label ||
															"",
												  )
												: ""
										const candidateDescription =
											hasSpecialCandidate
												? String(
														pinDefinition.description ||
															metric.description ||
															"",
												  )
												: ""
										const candidateSize =
											hasSpecialCandidate
												? String(
														pinDefinition.size ||
															"1x1",
												  )
												: "1x1"
										const candidateRenderer =
											hasSpecialCandidate
												? normalizePinRenderer(
														pinDefinition.renderer ||
															"dom",
												  )
												: "dom"
										const candidatePinned =
											hasSpecialCandidate &&
											!!pinMap[
												String(
													pinDefinition.id ||
														metricId,
												)
											]
										const rowButtonLabel =
											hasSpecialCandidate
												? candidatePinned
													? __(
															"Unpin Item",
															"systemdeck",
													  )
													: __(
															"Pin Item",
															"systemdeck",
													  )
												: isPinned
												? __("Unpin Item", "systemdeck")
												: __("Pin Item", "systemdeck")
										const rowTitle = hasSpecialCandidate
											? candidateLabel
											: String(
													pinDefinition?.label ||
														metric.label ||
														"",
											  )
										const rowDescription =
											hasSpecialCandidate
												? candidateDescription
												: String(
														pinDefinition?.description ||
															metric.description ||
															"",
												  )
										const rowIcon =
											hasSpecialCandidate &&
											pinDefinition?.icon
												? String(pinDefinition.icon)
												: getMetricIcon(metric)
										const pinnedState = hasSpecialCandidate
											? candidatePinned
											: isPinned

										return (
											<div
												key={metric.key}
												className={`sd-pin-picker__row sd-pin-picker__row--${
													analysis.status
												} ${
													hasSpecialCandidate
														? "sd-pin-picker__row--candidate"
														: ""
												}`}>
												<div className='sd-pin-picker__row-icon'>
													<span
														className={`dashicons ${rowIcon}`}
														aria-hidden='true'></span>
												</div>
												<div className='sd-pin-picker__row-copy'>
													<div className='sd-pin-picker__row-title'>
														{rowTitle}
														{hasSpecialCandidate ? (
															<span className='sd-pin-picker__row-badge'>
																{` ${candidateSize} ${candidateRenderer.replace(
																	/_/g,
																	" ",
																)}`}
															</span>
														) : null}
													</div>
													<div className='sd-pin-picker__row-description'>
														{rowDescription}
													</div>
												</div>
												<div className='sd-pin-picker__row-sample'>
													{formatMetricValue(metric)}
												</div>
												<div className='sd-pin-picker__row-action'>
													<button
														type='button'
														className={`button ${
															pinnedState
																? "button-secondary"
																: "button-primary"
														} sd-pin-picker__pin-btn`}
														disabled={isSyncing}
														onClick={() =>
															handleTogglePin(
																metric,
															)
														}>
														{rowButtonLabel}
													</button>
												</div>
											</div>
										)
									})
								)}
							</div>
						</section>
					</div>
				</div>
			</div>
		</Modal>
	)
}
