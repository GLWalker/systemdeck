import { useState, useRef, useEffect } from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { DropdownMenu, MenuGroup, MenuItem } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import WidgetRenderer from "../components/WidgetRenderer"
import PinRenderer from "../components/PinRenderer"
import ErrorBoundary from "../components/ErrorBoundary"
import WidgetShell from "../components/WidgetShell"
import ScreenOptions from "../components/ScreenOptions"
import PinPicker from "../components/PinPicker"
import { STORE_NAME } from "../state/store"
import { openWorkspaceViaSystemDeck } from "../runtime/workspaceLaunch"
import {
	formatTelemetryMetric,
	resolveTelemetrySource,
} from "../runtime/TelemetryFormatter"
import { analyzeTelemetryMetric } from "../runtime/TelemetryIntelligence"
import {
	WIDGET_GRID_DESKTOP_UNITS,
	WIDGET_GRID_TABLET_UNITS,
	WIDGET_GRID_MOBILE_UNITS,
	coerceSpan,
	getWidgetWidthOptions,
	resolveWidgetSpanForMode,
	clampRowSpan,
	getCollapsedRowSpan,
	getInitialWidgetUiState,
	getWidgetUiKeyForItem,
	computeRuntimeLayout,
	mergeCanonicalWithRuntimeCoords,
	layoutPositionSignature,
} from "../../grid/widget-grid/runtime"
import {
	handleWidgetDragStartRuntime,
	handleWidgetDragEnterRuntime,
	handleWidgetDragEndRuntime,
	handleWidgetGridDragOverRuntime,
	handleWidgetItemDragOverRuntime,
	handleWidgetGridDropRuntime,
	handleWidgetItemDropRuntime,
} from "../../grid/widget-grid/interactions"
import {
	createResolveDropPosition,
	commitWidgetDrop as commitWidgetDropRuntime,
	applyWidgetSpanChange,
} from "../../grid/widget-grid/controller"
import {
	createWidgetUiStatePersister,
	persistWidgetWidthState as persistWidgetWidthStateRuntime,
	persistWidgetPositionState as persistWidgetPositionStateRuntime,
	toggleWidgetCollapseState,
} from "../../grid/widget-grid/persistence"
import {
	persistCanonicalLayout as persistCanonicalLayoutRuntime,
	persistBlockWidgetWidth,
} from "../../grid/widget-grid/effects"
import {
	parsePinSpan,
	normalizePinRenderer,
	isPixiMetricRenderer,
	normalizePin,
	getPinGridColumns,
	resolvePinTemplate,
} from "../../grid/pin-grid/runtime"
import {
	handlePinDragStart as handlePinDragStartRuntime,
	handlePinDragEnter as handlePinDragEnterRuntime,
	handlePinDragOver as handlePinDragOverRuntime,
	handlePinDrop as handlePinDropRuntime,
	handlePinDragEnd as handlePinDragEndRuntime,
	handlePinHandleKeyDown as handlePinHandleKeyDownRuntime,
} from "../../grid/pin-grid/interactions"
import {
	persistPins as persistPinsRuntime,
	removePinWithAnimation,
} from "../../grid/pin-grid/persistence"
import {
	reorderPins as reorderPinsRuntime,
	movePinByOffset as movePinByOffsetRuntime,
} from "../../grid/pin-grid/controller"

const formatWidgetTitle = (id = "") => {
	const stripped = String(id)
		.replace(/^core\./, "")
		.replace(/^dashboard\./, "")
		.replace(/[_.-]+/g, " ")
		.trim()
	if (!stripped) return "Widget"
	return stripped.replace(/\b\w/g, (c) => c.toUpperCase())
}

const getAjaxUrl = () =>
	window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
	window.sd_vars?.ajaxurl ||
	window.ajaxurl ||
	"/wp-admin/admin-ajax.php"

const getNonce = () =>
	window.SystemDeckSecurity?.nonce ||
	window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
	window.SYSTEMDECK_STATE?.config?.nonce ||
	window.sd_vars?.nonce ||
	""

const formatRegistryMetricValue = (metric = {}) => {
	if (typeof metric?.display_value === "string" && metric.display_value !== "") {
		return metric.display_value
	}

	const unit = String(metric?.unit || "text")
	const value = metric?.value
	if (value === null || value === undefined || value === "") {
		return ""
	}

	if (unit === "boolean") {
		return value ? __("Yes", "systemdeck") : __("No", "systemdeck")
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

	if (unit === "unix") {
		const epoch = Number(value)
		if (!Number.isFinite(epoch) || epoch <= 0) return ""
		return new Date(epoch * 1000).toLocaleTimeString([], {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
	}

	return String(value)
}

const resolveMetricDisplayValue = (metricKey, telemetry, metricRegistry = {}, pinData = {}) => {
	const registryMetric = metricRegistry?.[metricKey] || null
	const metricMode = String(
		registryMetric?.mode || pinData?.metric_mode || pinData?.mode || "",
	).trim()
	const telemetryLookupKey = registryMetric?.source_key
		? String(registryMetric.source_key)
		: String(metricKey || "")
	const telemetrySource =
		resolveTelemetrySource(telemetryLookupKey, telemetry, pinData) ||
		(metricKey && telemetryLookupKey !== metricKey
			? resolveTelemetrySource(String(metricKey), telemetry, pinData)
			: null)

	if (registryMetric) {
		if (metricMode === "live" && telemetrySource) {
			return formatTelemetryMetric(telemetryLookupKey, telemetrySource)
		}
		return formatRegistryMetricValue(registryMetric)
	}

	if (String(metricKey || "").startsWith("core.") && telemetrySource) {
		return formatTelemetryMetric(telemetryLookupKey, telemetrySource)
	}

	if (pinData?.raw_value !== undefined && pinData?.raw_value !== null && pinData?.raw_value !== "") {
		return String(pinData.raw_value)
	}

	if (pinData?.value_label !== undefined && pinData?.value_label !== null && pinData?.value_label !== "") {
		return String(pinData.value_label)
	}

	return pinData?.value ?? ""
}

const resolveMetricAnalysis = (metricKey, telemetry, metricRegistry = {}, pinData = {}) => {
	const registryMetric = metricRegistry?.[metricKey] || null
	const metricMode = String(
		registryMetric?.mode || pinData?.metric_mode || pinData?.mode || "",
	).trim()
	const telemetryLookupKey = registryMetric?.source_key
		? String(registryMetric.source_key)
		: String(metricKey || "")
	const telemetrySource =
		resolveTelemetrySource(telemetryLookupKey, telemetry, pinData) ||
		(metricKey && telemetryLookupKey !== metricKey
			? resolveTelemetrySource(String(metricKey), telemetry, pinData)
			: null)

	if (registryMetric) {
		if (metricMode === "live" && telemetrySource) {
			return analyzeTelemetryMetric(telemetryLookupKey, telemetrySource)
		}
		if (registryMetric.analysis && typeof registryMetric.analysis === "object") {
			return registryMetric.analysis
		}
		const status = String(registryMetric.status || "ok")
		return {
			status,
			severity: status === "error" ? 3 : status === "warn" ? 2 : 1,
			trend: String(registryMetric.trend || "stable"),
			state_label: String(registryMetric.label || status),
			emphasis: status === "error" ? "high" : status === "warn" ? "medium" : "low",
		}
	}

	if (String(metricKey || "").startsWith("core.") && telemetrySource) {
		return analyzeTelemetryMetric(telemetryLookupKey, telemetrySource)
	}

	return analyzeTelemetryMetric("", {})
}

const GRID_ROW_UNIT = 8
const GRID_GAP = 12
const WP_ADMIN_MOBILE_BREAKPOINT = 600
const WP_ADMIN_TABLET_BREAKPOINT = 782
const USE_CANONICAL_LAYOUT_ENGINE = true
const DEFAULT_ROW_SPAN = 12
const GRID_MEASURE_BUFFER_ROWS = 0

function MetricPinRendererSurface({ renderer, pin, metric, title, workspaceId }) {
	const rootRef = useRef(null)
	const instanceRef = useRef(null)

	useEffect(() => {
		const rootEl = rootRef.current
		const mountApi = window.SystemDeckPixiMount
		const registry = window.SystemDeckMetricPinRenderers || {}
		const factory = registry?.[renderer]
		if (!rootEl || !isPixiMetricRenderer(renderer)) {
			return undefined
		}
		if (!mountApi?.hasPixi?.() || typeof factory !== "function") {
			return undefined
		}

		instanceRef.current = mountApi.mount(rootEl, factory, {
			pin,
			metric,
			title,
		})

		return () => {
			if (instanceRef.current) {
				try {
					mountApi.destroy(instanceRef.current)
				} catch (_error) {}
				instanceRef.current = null
			}
		}
	}, [renderer, workspaceId])

	useEffect(() => {
		if (!instanceRef.current || typeof instanceRef.current.update !== "function") {
			return
		}

		instanceRef.current.update({
			pin,
			metric,
			title,
		})
	}, [pin, metric, title])

	useEffect(() => {
		if (!instanceRef.current || typeof instanceRef.current.resize !== "function") {
			return
		}

		let frameOne = 0
		let frameTwo = 0
		frameOne = window.requestAnimationFrame(() => {
			instanceRef.current?.resize?.()
			frameTwo = window.requestAnimationFrame(() => {
				instanceRef.current?.resize?.()
			})
		})

		return () => {
			if (frameOne) window.cancelAnimationFrame(frameOne)
			if (frameTwo) window.cancelAnimationFrame(frameTwo)
		}
	}, [workspaceId, renderer])

	return (
		<div
			ref={rootRef}
			className='sd-pinned-pixi-surface'
			aria-hidden='true'
			style={{ width: "100%", height: "100%" }}
		/>
	)
}

const resolveWorkspaceStateKey = (activeWorkspace, activeId) => {
	try {
		const selector = window?.wp?.data?.select
		if (typeof selector === "function") {
			const store = selector("systemdeck/core")
			if (store && typeof store.getActiveWorkspaceId === "function") {
				const fromStore = String(store.getActiveWorkspaceId() || "").trim()
				if (fromStore) return fromStore
			}
		}
	} catch (_error) {
		// noop
	}

	const fromActiveId = String(activeId || "").trim()
	if (fromActiveId) return fromActiveId

	const fromWorkspace = String(activeWorkspace?.id || activeWorkspace?.workspace_id || "").trim()
	if (fromWorkspace) return fromWorkspace

	try {
		const fromStorage = String(window.localStorage?.getItem("sd_active_workspace") || "").trim()
		if (fromStorage) return fromStorage
	} catch (_error) {
		// noop
	}

	try {
		const hash = String(window.location?.hash || "").trim()
		if (hash.startsWith("#workspace-")) {
			const fromHash = hash.replace(/^#workspace-/, "").trim()
			if (fromHash) return fromHash
		}
	} catch (_error) {
		// noop
	}

	return "default"
}

export default function WorkspaceCanvas() {
	const { layoutObj, widgets, registry, activeId, dockState, activeWorkspace } = useSelect((select) => {
		const { getActiveWorkspaceId, getCurrentLayout, getWidgets, getRegistry, getDockState, getActiveWorkspace } =
			select(STORE_NAME)

		return {
			layoutObj: getCurrentLayout ? getCurrentLayout() : {},
			widgets: getWidgets ? getWidgets() : {},
			registry: getRegistry ? getRegistry() : {},
			activeId: getActiveWorkspaceId ? getActiveWorkspaceId() : "",
			dockState: getDockState ? getDockState() : "standard",
			activeWorkspace: getActiveWorkspace ? getActiveWorkspace() : null,
		}
	}, [])

	const { setLayoutItems, persistLayout, toggleMetaDrawer, togglePinPicker } = useDispatch(STORE_NAME)

	useEffect(() => {
		const handleOpenScreenOptions = () => {
			if (typeof toggleMetaDrawer === "function") {
				toggleMetaDrawer(true)
			}
		}

		document.addEventListener("systemdeck:open-screen-options", handleOpenScreenOptions)
		return () => {
			document.removeEventListener("systemdeck:open-screen-options", handleOpenScreenOptions)
		}
	}, [toggleMetaDrawer])

	useEffect(() => {
		const handleOpenPinPicker = () => {
			if (typeof togglePinPicker === "function") {
				togglePinPicker(true)
			}
		}

		document.addEventListener("systemdeck:open-pin-picker", handleOpenPinPicker)
		return () => {
			document.removeEventListener("systemdeck:open-pin-picker", handleOpenPinPicker)
		}
	}, [togglePinPicker])

	const [canonicalLayout, setCanonicalLayout] = useState([])
	const [dragging, setDragging] = useState(false)
	const [dragTargetId, setDragTargetId] = useState("")
	const [widgetDropPreview, setWidgetDropPreview] = useState(null)
	const [collapsedMap, setCollapsedMap] = useState(getInitialWidgetUiState)
	const [viewportWidth, setViewportWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1440,
	)
	
	const currentUserId = Number(
		window.SYSTEMDECK_BOOTSTRAP?.config?.user?.id ||
		window.sd_vars?.user?.id ||
		0,
	)
	const canManageOptions = !!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_options
	const canManageWorkspaces = !!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_workspaces
	const activeWorkspaceOwnerId = Number(activeWorkspace?.cpt_author_id || 0)
	
	const [pins, setPinsState] = useState([])
	const [refreshTrigger, setRefreshTrigger] = useState(0)
	const [removingPinIds, setRemovingPinIds] = useState({})
	const [draggingPinId, setDraggingPinId] = useState("")
	const [pinDropTargetId, setPinDropTargetId] = useState("")
	const [telemetry, setTelemetry] = useState({})
	const [metricRegistry, setMetricRegistry] = useState({})
	const [pinDefinitions, setPinDefinitions] = useState({})
	const [measuredRows, setMeasuredRows] = useState({})
	const [pinGridWidth, setPinGridWidth] = useState(0)
	const dragItem = useRef()
	const dragNode = useRef()
	const widgetDropPreviewRef = useRef(null)
	const canonicalLayoutRef = useRef([])
	const runtimeLayoutRef = useRef([])
	const hasHydratedCanonicalRef = useRef(false)
	const persistTimerRef = useRef(0)
	const lastPersistSignatureRef = useRef("")
	const widgetGridRef = useRef(null)
	const pinGridRef = useRef(null)
	const resizeObserverRef = useRef(null)
	const observedNodesRef = useRef(new Map())
	const resizeFrameRef = useRef(0)
	const pendingMeasuredRowsRef = useRef({})
	const collapsePersistTimersRef = useRef({})

	useEffect(() => {
		const onResize = () => setViewportWidth(window.innerWidth || 1440)
		window.addEventListener("resize", onResize)
		return () => window.removeEventListener("resize", onResize)
	}, [])

	useEffect(() => {
		widgetDropPreviewRef.current = widgetDropPreview
	}, [widgetDropPreview])

	useEffect(() => {
		return () => {
			Object.values(collapsePersistTimersRef.current).forEach((timerId) => {
				window.clearTimeout(timerId)
			})
			collapsePersistTimersRef.current = {}
		}
	}, [])

	const isSideDock =
		dockState === "left-dock" ||
		dockState === "right-dock" ||
		dockState === "left-base-dock" ||
		dockState === "right-base-dock"
	const workspaceStateKey = resolveWorkspaceStateKey(activeWorkspace, activeId)
	const responsiveWidth = pinGridWidth > 0 ? pinGridWidth : viewportWidth
	const gridCols = isSideDock
		? 1
		: responsiveWidth <= WP_ADMIN_MOBILE_BREAKPOINT
			? WIDGET_GRID_MOBILE_UNITS
			: responsiveWidth <= WP_ADMIN_TABLET_BREAKPOINT
				? WIDGET_GRID_TABLET_UNITS
				: WIDGET_GRID_DESKTOP_UNITS
	const gridGap = GRID_GAP
	const pinGridCols = getPinGridColumns(responsiveWidth)
	const pinGridUnit = Math.max(
		1,
		(pinGridWidth - (pinGridCols - 1) * gridGap) / Math.max(1, pinGridCols),
	)

	useEffect(() => {
		if (!layoutObj) {
			return
		}
		const workspaceUiState =
			collapsedMap[workspaceStateKey] && typeof collapsedMap[workspaceStateKey] === "object"
				? collapsedMap[workspaceStateKey]
				: {}
		const normalized = Object.values(layoutObj)
			.map((item) => ({
				...item,
				i: item.i || item.id,
				type: item.type || "widget",
			}))
			.map((item) => {
				const widgetUiKey = getWidgetUiKeyForItem(item)
				const uiWidth = Number(workspaceUiState?.[widgetUiKey]?.width)
				const uiX = Number(workspaceUiState?.[widgetUiKey]?.x)
				const uiY = Number(workspaceUiState?.[widgetUiKey]?.y)
				const normalizedX = Number.isFinite(Number(item?.x)) ? Math.max(0, Number(item.x)) : 0
				const normalizedY = Number.isFinite(Number(item?.y)) ? Math.max(0, Number(item.y)) : 0
				return {
					...item,
					x: Number.isFinite(uiX) ? Math.max(0, uiX) : normalizedX,
					y: Number.isFinite(uiY) ? Math.max(0, uiY) : normalizedY,
					w: Number.isFinite(uiWidth)
						? coerceSpan(uiWidth, WIDGET_GRID_DESKTOP_UNITS)
						: coerceSpan(item?.w, WIDGET_GRID_DESKTOP_UNITS),
				}
			})
			.filter((item) => !String(item.i || "").startsWith("sd_block_"))

		const canonical = normalized.sort((a, b) => {
			if (a.y === b.y) return a.x - b.x
			return a.y - b.y
		})
		if (USE_CANONICAL_LAYOUT_ENGINE) {
			setCanonicalLayout(canonical)
			canonicalLayoutRef.current = canonical
			hasHydratedCanonicalRef.current = true
		}
	}, [layoutObj, collapsedMap, workspaceStateKey])

	useEffect(() => {
		if (!USE_CANONICAL_LAYOUT_ENGINE) return undefined
		if (!hasHydratedCanonicalRef.current) return undefined
		if (!activeId) return undefined
		if (!Array.isArray(canonicalLayout)) return undefined

		const signature = JSON.stringify(
			canonicalLayout.map((item) => ({
				i: item?.i || item?.id || "",
				x: Number(item?.x) || 0,
				y: Number(item?.y) || 0,
				w: Number(item?.w) || 0,
				h: Number(item?.h) || 0,
			})),
		)
		if (signature === lastPersistSignatureRef.current) return undefined

		if (persistTimerRef.current) {
			window.clearTimeout(persistTimerRef.current)
		}
		persistTimerRef.current = window.setTimeout(() => {
			lastPersistSignatureRef.current = signature
			if (setLayoutItems) {
				setLayoutItems(activeId, canonicalLayoutRef.current)
			}
			if (persistLayout) {
				persistLayout(activeId, canonicalLayoutRef.current)
			}
			persistTimerRef.current = 0
		}, 120)

		return () => {
			if (persistTimerRef.current) {
				window.clearTimeout(persistTimerRef.current)
				persistTimerRef.current = 0
			}
		}
	}, [canonicalLayout, activeId, persistLayout, setLayoutItems])

	useEffect(() => {
		pendingMeasuredRowsRef.current = {}
		setMeasuredRows({})
	}, [canonicalLayout.length, gridCols])

	useEffect(() => {
		if (typeof window === "undefined" || typeof window.ResizeObserver !== "function") {
			return undefined
		}

		const observer = new window.ResizeObserver((entries) => {
			let next = null
			entries.forEach((entry) => {
				const itemId = entry.target?.dataset?.itemId
				if (!itemId) return
				const contentHeight = Number(entry.contentRect?.height || 0)
				const naturalHeight = Number(entry.target?.scrollHeight || 0)
				const height = Math.max(contentHeight, naturalHeight)
				if (!Number.isFinite(height) || height <= 0) return
				const rows = clampRowSpan(
					Math.ceil((height + gridGap) / (GRID_ROW_UNIT + gridGap)) + GRID_MEASURE_BUFFER_ROWS,
				)
				if (!next) next = {}
				next[itemId] = rows
			})
			if (!next) return

			pendingMeasuredRowsRef.current = {
				...pendingMeasuredRowsRef.current,
				...next,
			}

			if (resizeFrameRef.current) return

			resizeFrameRef.current = window.requestAnimationFrame(() => {
				const pending = pendingMeasuredRowsRef.current
				pendingMeasuredRowsRef.current = {}
				resizeFrameRef.current = 0

				setMeasuredRows((prev) => {
					let changed = false
					const merged = { ...prev }
					Object.entries(pending).forEach(([itemId, rows]) => {
						if (merged[itemId] !== rows) {
							merged[itemId] = rows
							changed = true
						}
					})
					return changed ? merged : prev
				})
			})
		})

		resizeObserverRef.current = observer
		return () => {
			if (resizeFrameRef.current) {
				window.cancelAnimationFrame(resizeFrameRef.current)
				resizeFrameRef.current = 0
			}
			pendingMeasuredRowsRef.current = {}
			observer.disconnect()
			resizeObserverRef.current = null
		}
	}, [gridGap])

	useEffect(() => {
		const node = pinGridRef.current
		if (!node) return undefined

		const updateWidth = () => {
			const nextWidth = Number(node.clientWidth || 0)
			setPinGridWidth((prev) => (prev !== nextWidth ? nextWidth : prev))
		}

		updateWidth()

		if (typeof window === "undefined" || typeof window.ResizeObserver !== "function") {
			window.addEventListener("resize", updateWidth)
			return () => window.removeEventListener("resize", updateWidth)
		}

		const observer = new window.ResizeObserver(updateWidth)
		observer.observe(node)
		return () => observer.disconnect()
	}, [pins.length, draggingPinId])

	const bindMeasureNode = (itemId) => (node) => {
		const prev = observedNodesRef.current.get(itemId)
		if (prev && resizeObserverRef.current) {
			resizeObserverRef.current.unobserve(prev)
		}
		if (node && resizeObserverRef.current) {
			node.dataset.itemId = itemId
			resizeObserverRef.current.observe(node)
			observedNodesRef.current.set(itemId, node)
		} else {
			observedNodesRef.current.delete(itemId)
		}
	}

	useEffect(() => {
		if (!activeId) {
			return
		}

		let cancelled = false
		const formData = new FormData()
		formData.append("action", "sd_get_workspace_pins")
		formData.append("workspace_id", activeId)
		formData.append("nonce", getNonce())

		fetch(getAjaxUrl(), { method: "POST", body: formData })
			.then((res) => res.json())
			.then((data) => {
				if (cancelled || !data?.success) return
				const incomingPins = Array.isArray(data.data?.pins) ? data.data.pins : []
				console.log("[CANVAS] pins received", incomingPins)
				setPinsState(incomingPins.map((pin, index) => normalizePin(pin, index)))
			})
			.catch(() => {})

		return () => {
			cancelled = true
		}
	}, [activeId, refreshTrigger])

	useEffect(() => {
		const handleRefresh = () => {
			console.log("[CANVAS] refresh pins triggered")
			setRefreshTrigger((prev) => prev + 1)
		}
		document.addEventListener("systemdeck:refresh-pins", handleRefresh)
		return () => document.removeEventListener("systemdeck:refresh-pins", handleRefresh)
	}, [])

	useEffect(() => {
		const handlePinsUpdated = (event) => {
			const detail = event?.detail || {}
			const workspaceId = detail.workspaceId || "default"
			if ((activeId || "default") !== workspaceId) return
			if (!Array.isArray(detail.pins)) return
			const incomingPins = detail.pins
			setPinsState(incomingPins.map((pin, index) => normalizePin(pin, index)))
		}

		document.addEventListener("systemdeck:pins-updated", handlePinsUpdated)
		return () =>
			document.removeEventListener("systemdeck:pins-updated", handlePinsUpdated)
	}, [activeId])

	useEffect(() => {
		if (draggingPinId) {
			document.body.classList.add("sd-pin-dragging")
		} else {
			document.body.classList.remove("sd-pin-dragging")
		}
	}, [draggingPinId])

	useEffect(() => {
		if (dragging) {
			document.body.classList.add("sd-widget-dragging")
			document.body.classList.add("is-dragging-metaboxes")
		} else {
			document.body.classList.remove("sd-widget-dragging")
			document.body.classList.remove("is-dragging-metaboxes")
		}
		return () => {
			document.body.classList.remove("sd-widget-dragging")
			document.body.classList.remove("is-dragging-metaboxes")
		}
	}, [dragging])

	useEffect(() => {
		const preventGlobalDropzone = (e) => {
			const types = Array.from(e?.dataTransfer?.types || [])
			if (types.includes("application/systemdeck-pin") || types.includes("application/systemdeck-widget")) {
				// Prevent default to allow drop, but DO NOT stopPropagation 
				// or it kills React's root event delegation for onDragEnter!
				e.preventDefault()
			}
		}
		window.addEventListener("dragenter", preventGlobalDropzone, true)
		window.addEventListener("dragover", preventGlobalDropzone, true)
		return () => {
			window.removeEventListener("dragenter", preventGlobalDropzone, true)
			window.removeEventListener("dragover", preventGlobalDropzone, true)
		}
	}, [])

	useEffect(() => {
		const hasMetricDefinitionPins = pins.some((pin) => pin?.settings?.metric_key)
		const hasRegistryDefinitionPins = pins.some(
			(pin) => String(pin?.data?.pin_definition_id || pin?.settings?.pin_definition_id || "") !== "",
		)
		if (!hasMetricDefinitionPins && !hasRegistryDefinitionPins) {
			setMetricRegistry({})
			setPinDefinitions({})
			setTelemetry({})
			return
		}

		let cancelled = false
		const hasMetricPins = pins.some((pin) => String(pin?.settings?.metric_key || pin?.data?.metric_key || "") !== "")
		const hasLiveMetricPins = pins.some((pin) => {
			const type = String(pin?.type || "")
			const metricMode = String(pin?.data?.metric_mode || pin?.settings?.metric_mode || "")
			const metricFamily = String(pin?.data?.metric_family || pin?.settings?.metric_family || "")
			const metricKey = String(pin?.data?.metric_key || pin?.settings?.metric_key || "")
			return type === "metric" || (metricKey && (metricMode === "live" || metricFamily === "core"))
		})
		const hasSnapshotMetricPins = pins.some((pin) => {
			const metricKey = String(pin?.data?.metric_key || pin?.settings?.metric_key || "")
			const metricMode = String(pin?.data?.metric_mode || pin?.settings?.metric_mode || "")
			return metricKey !== "" && metricMode === "snapshot"
		})
		const hasDerivedMetricPins = pins.some((pin) => {
			const metricKey = String(pin?.data?.metric_key || pin?.settings?.metric_key || "")
			const metricMode = String(pin?.data?.metric_mode || pin?.settings?.metric_mode || "")
			return metricKey !== "" && metricMode === "derived"
		})

		const loadTelemetrySnapshot = () => {
			const formData = new FormData()
			formData.append("action", "sd_get_telemetry")
			formData.append("mode", "runtime")
			formData.append("nonce", getNonce())
			fetch(getAjaxUrl(), { method: "POST", body: formData })
				.then((res) => res.json())
				.then((data) => {
					if (cancelled || !data?.success) return
					setTelemetry(data.data?.raw || {})
				})
				.catch(() => {})
		}

		const loadMetricRegistry = () => {
			const formData = new FormData()
			formData.append("action", "sd_get_pin_safe_metrics")
			formData.append("nonce", getNonce())
			fetch(getAjaxUrl(), { method: "POST", body: formData })
				.then((res) => res.json())
				.then((data) => {
					if (cancelled || !data?.success) return
					const indexed = {}
					;(Array.isArray(data.data?.metrics) ? data.data.metrics : []).forEach((metric) => {
						const key = String(metric?.key || "")
						if (!key) return
						indexed[key] = metric
					})
					setMetricRegistry(indexed)
					setPinDefinitions(
						data.data?.pin_definitions && typeof data.data.pin_definitions === "object"
							? data.data.pin_definitions
							: {},
					)
				})
				.catch(() => {})
		}

		const stream = window.SystemDeckTelemetryStream || null
		let unsubscribeStream = null
		if (hasLiveMetricPins && stream && typeof stream.subscribe === "function") {
			unsubscribeStream = stream.subscribe((payload) => {
				if (cancelled || !payload) return
				setTelemetry(payload)
			})
		} else if (hasLiveMetricPins) {
			loadTelemetrySnapshot()
		}

		if (hasMetricPins || hasRegistryDefinitionPins) {
			loadMetricRegistry()
		}
		const intervalId = hasLiveMetricPins && !unsubscribeStream
			? window.setInterval(loadTelemetrySnapshot, 15000)
			: null
		const registryIntervalId =
			hasSnapshotMetricPins || hasDerivedMetricPins
				? window.setInterval(loadMetricRegistry, 60000)
				: null
		return () => {
			cancelled = true
			if (typeof unsubscribeStream === "function") {
				unsubscribeStream()
			}
			if (intervalId !== null) {
				window.clearInterval(intervalId)
			}
			if (registryIntervalId !== null) {
				window.clearInterval(registryIntervalId)
			}
		}
	}, [pins])

	const workspaceCollapseState = collapsedMap[workspaceStateKey] || {}
	const runtimeLayout = computeRuntimeLayout({
		items: canonicalLayout,
		gridCols,
		measuredRows,
		collapsedMap: workspaceCollapseState,
	})
	runtimeLayoutRef.current = runtimeLayout

	useEffect(() => {
		if (!USE_CANONICAL_LAYOUT_ENGINE) return
		if (dragging || widgetDropPreview) return
		if (!Array.isArray(canonicalLayout) || !canonicalLayout.length) return
		const merged = mergeCanonicalWithRuntimeCoords(canonicalLayout, runtimeLayout)
		if (layoutPositionSignature(merged) === layoutPositionSignature(canonicalLayout)) return
		setCanonicalLayout(merged)
		canonicalLayoutRef.current = merged
		persistWidgetPositionState(merged)
		persistCanonicalLayout(merged)
	}, [runtimeLayout, dragging, widgetDropPreview])

	useEffect(() => {
		canonicalLayoutRef.current = canonicalLayout
	}, [canonicalLayout])

	const persistCanonicalLayout = (nextCanonicalLayout) =>
		persistCanonicalLayoutRuntime({
			nextCanonicalLayout,
			setLayoutItems,
			persistLayout,
			activeId,
			useCanonicalLayoutEngine: USE_CANONICAL_LAYOUT_ENGINE,
		})

	const persistWidgetUiPatch = createWidgetUiStatePersister({
		getAjaxUrl,
		getNonce,
		timersRef: collapsePersistTimersRef,
	})

	const handleDragStart = (e, item) =>
		handleWidgetDragStartRuntime(e, item, {
			dragItemRef: dragItem,
			dragNodeRef: dragNode,
			setDragging,
		})

	const handleDragEnter = (e, targetItem) =>
		handleWidgetDragEnterRuntime(e, targetItem, {
			dragItemRef: dragItem,
			setDragTargetId,
			resolveDropPosition,
			setWidgetDropPreview,
		})

	const resolveDropPosition = createResolveDropPosition({
		gridCols,
		runtimeLayoutRef,
		measuredRows,
		workspaceCollapseState,
		getWidgetUiKeyForItem,
		getCollapsedRowSpan,
		clampRowSpan,
		defaultRowSpan: DEFAULT_ROW_SPAN,
	})

	const commitWidgetDrop = (sourceItem, targetX, targetY) =>
		commitWidgetDropRuntime({
			sourceItem,
			targetX,
			targetY,
			widgetDropPreview: widgetDropPreviewRef.current,
			resolveDropPosition,
			canonicalLayoutRef,
			gridCols,
			measuredRows,
			workspaceCollapseState,
			setCanonicalLayout,
			persistWidgetPositionState,
			persistCanonicalLayout,
		})

	const handleDragEnd = () =>
		handleWidgetDragEndRuntime({
			dragItemRef: dragItem,
			widgetDropPreview: widgetDropPreviewRef.current,
			commitWidgetDrop,
			setDragging,
			setDragTargetId,
			setWidgetDropPreview,
			dragNodeRef: dragNode,
		})

	const handleWidgetGridDragOver = (event) =>
		handleWidgetGridDragOverRuntime(event, {
			dragging,
			dragItemRef: dragItem,
			widgetGridRef,
			gridCols,
			gridGap,
			rowUnit: GRID_ROW_UNIT,
			resolveDropPosition,
			setWidgetDropPreview,
		})

	const handleWidgetItemDragOver = (event, targetItem) =>
		handleWidgetItemDragOverRuntime(event, targetItem, {
			dragging,
			dragItemRef: dragItem,
			setDragTargetId,
			resolveDropPosition,
			setWidgetDropPreview,
		})

	const handleWidgetGridDrop = (event) =>
		handleWidgetGridDropRuntime(event, {
			dragging,
			dragItemRef: dragItem,
			widgetDropPreview: widgetDropPreviewRef.current,
			handleDragEnd,
		})

	const handleWidgetItemDrop = (event, targetItem) =>
		handleWidgetItemDropRuntime(event, targetItem, {
			dragging,
			dragItemRef: dragItem,
			widgetDropPreview: widgetDropPreviewRef.current,
			commitWidgetDrop,
			setDragging,
			setDragTargetId,
			setWidgetDropPreview,
			dragNodeRef: dragNode,
		})

	const updateWidgetSpan = (widgetId, newSpan) => {
		const { normalizedBaseSpan, nextCanonicalLayout } = applyWidgetSpanChange({
			widgetId,
			newSpan,
			canonicalLayoutRef,
			gridCols,
			measuredRows,
			workspaceCollapseState,
			setCanonicalLayout,
			persistWidgetPositionState,
			persistCanonicalLayout,
		})

		const target = nextCanonicalLayout.find((item) => item.i === widgetId)
		if (target) {
			persistWidgetWidthState(target, normalizedBaseSpan)
		}
		persistBlockWidgetWidth({
			target,
			normalizedBaseSpan,
			gridCols,
			activeId,
			ajaxUrl:
				window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
				window.sd_vars?.ajaxurl ||
				window.ajaxurl,
			nonce: window.SYSTEMDECK_BOOTSTRAP?.config?.nonce || window.sd_vars?.nonce || "",
		})
	}

	const moveWidgetByDirection = (item, direction) => {
		if (!item) return
		const span = Number(item.w || 1)
		const maxX = Math.max(0, gridCols - span)
		const currentX = Number(item.x || 0)
		const currentY = Number(item.y || 0)
		const currentW = Number(item.w || 1)
		const currentH = Number(item.h || 1)
		let targetX = currentX
		let targetY = currentY
		const runtimeItems = Array.isArray(runtimeLayoutRef.current) ? runtimeLayoutRef.current : []
		const others = runtimeItems.filter((candidate) => candidate?.i !== item?.i)
		const overlapsColumn = (candidate) =>
			Math.max(currentX, Number(candidate?.x || 0)) <
			Math.min(currentX + currentW, Number(candidate?.x || 0) + Number(candidate?.w || 1))
		const overlapsRow = (candidate) =>
			Math.max(currentY, Number(candidate?.y || 0)) <
			Math.min(currentY + currentH, Number(candidate?.y || 0) + Number(candidate?.h || 1))

		if (direction === "up") {
			const candidates = others
				.filter((candidate) => overlapsColumn(candidate) && Number(candidate?.y || 0) < currentY)
				.sort((a, b) => Number(b?.y || 0) - Number(a?.y || 0))
			if (candidates.length) {
				const nearest = candidates[0]
				targetX = Number(nearest?.x || currentX)
				// Place above the nearest overlapping widget so collision resolver
				// does not immediately push us back down.
				targetY = Math.max(0, Number(nearest?.y || currentY) - currentH)
			} else {
				targetY = Math.max(0, currentY - 1)
			}
		}
		if (direction === "down") {
			const candidates = others
				.filter((candidate) => overlapsColumn(candidate) && Number(candidate?.y || 0) > currentY)
				.sort((a, b) => Number(a?.y || 0) - Number(b?.y || 0))
			if (candidates.length) {
				targetX = Number(candidates[0]?.x || currentX)
				targetY = Number(candidates[0]?.y || currentY) + 1
			} else {
				targetY = currentY + 1
			}
		}
		if (direction === "left") {
			const candidates = others
				.filter((candidate) => overlapsRow(candidate) && Number(candidate?.x || 0) < currentX)
				.sort((a, b) => Number(b?.x || 0) - Number(a?.x || 0))
			if (candidates.length) {
				targetX = Math.max(0, Number(candidates[0]?.x || currentX))
				targetY = Number(candidates[0]?.y || currentY)
			} else {
				targetX = Math.max(0, currentX - 1)
			}
		}
		if (direction === "right") {
			const candidates = others
				.filter((candidate) => overlapsRow(candidate) && Number(candidate?.x || 0) > currentX)
				.sort((a, b) => Number(a?.x || 0) - Number(b?.x || 0))
			if (candidates.length) {
				targetX = Math.min(maxX, Number(candidates[0]?.x || currentX))
				targetY = Number(candidates[0]?.y || currentY)
			} else {
				targetX = Math.min(maxX, currentX + 1)
			}
		}

		targetX = Math.max(0, Math.min(maxX, targetX))
		targetY = Math.max(0, targetY)
		commitWidgetDrop(item, targetX, targetY)
	}

	const toggleWidgetCollapse = (item) =>
		toggleWidgetCollapseState({
			item,
			workspaceId: workspaceStateKey,
			getWidgetUiKeyForItem,
			setCollapsedMap,
			persistWidgetUiPatch,
		})

	const persistWidgetWidthState = (item, width) =>
		persistWidgetWidthStateRuntime({
			item,
			width,
			workspaceId: workspaceStateKey,
			getWidgetUiKeyForItem,
			setCollapsedMap,
			persistWidgetUiPatch,
		})

	const persistWidgetPositionState = (items) =>
		persistWidgetPositionStateRuntime({
			items,
			workspaceId: workspaceStateKey,
			getWidgetUiKeyForItem,
			setCollapsedMap,
			persistWidgetUiPatch,
		})

	const persistPins = (nextPins) =>
		persistPinsRuntime({
			nextPins,
			activeId,
			getAjaxUrl,
			getNonce,
		})

	const removePin = (pinId) =>
		removePinWithAnimation({
			pinId,
			removingPinIds,
			setRemovingPinIds,
			setPinsState,
			persistPins,
			animationMs: 140,
		})

	const reorderPins = (fromPinId, toPinId) =>
		reorderPinsRuntime({
			fromPinId,
			toPinId,
			setPinsState,
			persistPins,
		})

	const handlePinDragStart = (event, pinId) =>
		handlePinDragStartRuntime(event, pinId, {
			setDraggingPinId,
			setPinDropTargetId,
		})

	const handlePinDragEnter = (event, pinId) =>
		handlePinDragEnterRuntime(event, pinId, {
			draggingPinId,
			setPinDropTargetId,
		})

	const handlePinDragOver = (event) => handlePinDragOverRuntime(event)

	const handlePinDrop = (event, pinId) =>
		handlePinDropRuntime(event, pinId, {
			draggingPinId,
			reorderPins,
			setDraggingPinId,
			setPinDropTargetId,
		})

	const handlePinDragEnd = () =>
		handlePinDragEndRuntime({
			setDraggingPinId,
			setPinDropTargetId,
		})

	const movePinByOffset = (pinId, offset) =>
		movePinByOffsetRuntime({
			pinId,
			offset,
			setPinsState,
			persistPins,
		})

	const handlePinHandleKeyDown = (event, pinId) =>
		handlePinHandleKeyDownRuntime(event, pinId, {
			movePinByOffset,
		})

	const resolvedPins = pins.map((pin) => {
		const span = parsePinSpan(pin)
		const metricKey = pin?.data?.metric_key || pin?.settings?.metric_key
		const stickyLevel =
			pin?.data?.sticky_level || pin?.settings?.sticky_level || pin?.settings?.pin_level || "low"
		const pinId = String(pin?.id || "")
		const fallbackNoteId =
			Number(pin?.data?.noteId || pin?.settings?.noteId || 0) ||
			(pinId.startsWith("note.") ? Number(pinId.split(".").pop() || 0) : 0)
		const fallbackFileId =
			Number(pin?.data?.fileId || pin?.settings?.fileId || 0) ||
			(pinId.startsWith("vault.") ? Number(pinId.split(".").pop() || 0) : 0)
		const title = pin?.title || pin?.settings?.label || pinId
		return {
			...pin,
			size: span.token,
			renderer: normalizePinRenderer(pin?.renderer || pin?.settings?.renderer),
			title,
			design_template: pin?.design_template || "default",
			w: span.w,
			h: span.h,
			data: {
				...(pin?.data || {}),
				label: title,
				value: pin?.data?.value ?? pin?.settings?.value ?? "",
				noteId: fallbackNoteId || 0,
				fileId: fallbackFileId || 0,
				sticky_level: stickyLevel,
			},
				settings: {
					...(pin?.settings || {}),
					label: title,
				noteId: fallbackNoteId || 0,
				fileId: fallbackFileId || 0,
				sticky_level: stickyLevel,
					grid_span: span.token,
					metric_key: metricKey,
				},
		}
	})

	const resolvePinDefinition = (pin) => {
		const definitionId = String(
			pin?.data?.pin_definition_id || pin?.settings?.pin_definition_id || "",
		).trim()
		if (!definitionId) {
			return null
		}
		const definition =
			pinDefinitions && typeof pinDefinitions === "object"
				? pinDefinitions[definitionId]
				: null
		return definition && typeof definition === "object" ? definition : null
	}

	const resolvePlatformPinAction = (pin) => {
		const definition = resolvePinDefinition(pin)
		const definitionMeta =
			definition?.meta && typeof definition.meta === "object" ? definition.meta : {}

		return {
			action: String(definitionMeta.action || "").trim(),
			workspaceId: String(definitionMeta.workspace_id || "").trim(),
		}
	}

	const PLATFORM_PIN_ACTIONS = {
		open_pin_manager: () => {
			togglePinPicker?.(true)
			return true
		},
		player_stop: () => {
			const playerApi = window.SystemDeckPlayer
			if (playerApi && typeof playerApi.control === "function") {
				void playerApi.control("stop")
				return true
			}
			return false
		},
		open_workspace: ({ workspaceId }) => openWorkspaceViaSystemDeck(workspaceId),
	}

	const triggerPlatformPinAction = (pin) => {
		const resolved = resolvePlatformPinAction(pin)
		const handler = PLATFORM_PIN_ACTIONS[resolved.action]
		if (typeof handler !== "function") {
			return false
		}
		return !!handler(resolved, pin)
	}

	return (
		<>
			<ScreenOptions />
			<PinPicker />
			{resolvedPins.length > 0 && (
				<section
					className='sd-pinned-metrics-root'
					role='region'
					aria-labelledby='sd-pinned-metrics-title'>
					<h2 id='sd-pinned-metrics-title' className='screen-reader-text'>
						{__("Pinned pins", "systemdeck")}
					</h2>
					<div
						ref={pinGridRef}
						className={`sd-pinned-grid ${draggingPinId ? "is-dragging" : ""}`}
						role='list'
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${pinGridCols}, minmax(0, 1fr))`,
							gridAutoFlow: "row dense",
							gridAutoRows: `${pinGridUnit}px`,
							gap: `${gridGap}px`,
							columnGap: `${gridGap}px`,
							rowGap: `${gridGap}px`,
						}}
						aria-label={__("Pinned pins", "systemdeck")}>
								{resolvedPins.map((pin) => {
									const metricKey = String(pin.data?.metric_key || pin.settings?.metric_key || "")
									const metricFamily = String(pin.data?.metric_family || pin.settings?.metric_family || "")
									const metricMode = String(pin.data?.metric_mode || pin.settings?.metric_mode || "")
									const pinKind = String(pin.data?.pin_kind || pin.settings?.pin_kind || "")
									const noteId = Number(pin.data?.noteId || pin.settings?.noteId || 0)
									const fileId = Number(pin.data?.fileId || pin.settings?.fileId || 0)
									const pinTitle = String(pin.title || pin.settings?.label || pin.id || "")
									const pinDisplayValue = resolveMetricDisplayValue(metricKey, telemetry, metricRegistry, pin.data || {})
									const pinAnalysis = resolveMetricAnalysis(metricKey, telemetry, metricRegistry, pin.data || {})
									const isNote =
										pin.type === "note" ||
										pin.settings?.type === "note" ||
										pinKind === "pinned_note" ||
										noteId > 0
									const isVault =
										pin.type === "vault" ||
										pin.settings?.type === "vault" ||
										pinKind === "pinned_file" ||
										fileId > 0
									const stickyLevel = pin.data?.sticky_level || pin.settings?.sticky_level || "low"
									const designTemplate = resolvePinTemplate(
										pin.design_template || pin.settings?.design_template || "default",
									)
									const isMetricPin =
										!isNote &&
										!isVault &&
										(pin.type === "metric" ||
											(metricKey !== "" &&
												(metricFamily !== "" || metricMode !== "" || pin.type === "system.status")))
									const hasCustomMetricRenderer =
										isMetricPin && isPixiMetricRenderer(pin.renderer)
									const isBaseRuntimePin =
										!isMetricPin &&
										!isNote &&
										!isVault &&
										["core_open_pin_manager"].includes(
											String(pin.settings?.pin_definition_id || pin.id || ""),
										)
									const urgencyColors = {
										urgent: "#cf2e2e",
										high: "#fcb900",
										moderate: "#7bdcb5",
										low: "#8ed1fc",
									}
									const urgencyColor = urgencyColors[stickyLevel] || urgencyColors.low
									const contrastColor = stickyLevel === "urgent" ? "#fff" : "#000"

									if (isBaseRuntimePin) {
										return (
											<div
												key={pin.id}
												className={`sd-pinned-item sd-runtime-pin-host ${removingPinIds[pin.id] ? "is-removing" : ""} ${
													draggingPinId === pin.id ? "is-dragging" : ""
												} ${pinDropTargetId === pin.id && draggingPinId !== pin.id ? "is-drop-target" : ""}`}
												style={{
													gridColumn: `span ${Math.max(1, Math.min(pinGridCols, Number(pin.w || 1)))}`,
													gridRow: `span ${Math.max(1, Math.min(3, Number(pin.h || 1)))}`,
													padding: 0,
													overflow: "hidden",
												}}
												role='listitem'
												tabIndex={0}
												draggable
												onDragStart={(event) => handlePinDragStart(event, pin.id)}
												onDragEnd={handlePinDragEnd}
												onDragEnter={(event) => handlePinDragEnter(event, pin.id)}
												onDragOver={handlePinDragOver}
												onDrop={(event) => handlePinDrop(event, pin.id)}
												onKeyDown={(event) => handlePinHandleKeyDown(event, pin.id)}>
												<PinRenderer
													pinId={String(pin.id || "")}
													instanceId={String(pin.id || "")}
													workspaceId={activeId}
												/>
												{(() => {
													const pinAuthorId = Number(pin.settings?.author_id || 0)
													const isAuthor = pinAuthorId === 0 || pinAuthorId === currentUserId
													const isWsOwner = activeWorkspaceOwnerId === currentUserId
													return canManageOptions || isWsOwner || isAuthor
												})() && (
													<button
														type='button'
														className='sd-pin-toggle'
														onClick={(e) => {
															e.stopPropagation()
															removePin(pin.id)
														}}
														aria-label={__("Remove pin", "systemdeck") + " " + pinTitle}
														title={__("Remove pin", "systemdeck")}>
														<span className='dashicons dashicons-no-alt' aria-hidden='true' />
													</button>
												)}
											</div>
										)
									}

									return (
										<article
											key={pin.id}
											className={`sd-pinned-item ${isNote ? "is-note" : ""} ${isMetricPin ? "is-telemetry" : ""} ${hasCustomMetricRenderer ? "is-pixi-metric" : ""} sd-pin-template--${designTemplate} ${removingPinIds[pin.id] ? "is-removing" : ""} ${
												isMetricPin ? `sd-pin-status--${pinAnalysis.status}` : ""
											} ${
												draggingPinId === pin.id ? "is-dragging" : ""
											} ${pinDropTargetId === pin.id && draggingPinId !== pin.id ? "is-drop-target" : ""}`}
											data-status={isMetricPin ? pinAnalysis.status : undefined}
											data-severity={isMetricPin ? String(pinAnalysis.severity) : undefined}
											data-trend={isMetricPin ? pinAnalysis.trend : undefined}
											data-emphasis={isMetricPin ? pinAnalysis.emphasis : undefined}
											data-state-label={isMetricPin ? pinAnalysis.state_label : undefined}
											style={{
												gridColumn: `span ${Math.max(1, Math.min(pinGridCols, Number(pin.w || 1)))}`,
												gridRow: `span ${Math.max(1, Math.min(3, Number(pin.h || 1)))}`,
												padding: hasCustomMetricRenderer ? 0 : undefined,
												overflow: hasCustomMetricRenderer ? "hidden" : undefined,
												...(isNote
													? {
															backgroundColor: urgencyColor,
															color: contrastColor,
															border: "none",
															boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
														}
													: {}),
											}}
											role='listitem'
											tabIndex={0}
											draggable
											onDragStart={(event) => handlePinDragStart(event, pin.id)}
											onDragEnd={handlePinDragEnd}
											onDragEnter={(event) => handlePinDragEnter(event, pin.id)}
											onDragOver={handlePinDragOver}
											onDrop={(event) => handlePinDrop(event, pin.id)}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault()
													if (isNote && noteId > 0) {
														document.dispatchEvent(new CustomEvent("systemdeck:open-note", {
															detail: {
																noteId,
																mode: "read",
															},
														}))
													} else if (isVault && fileId > 0) {
														document.dispatchEvent(new CustomEvent("systemdeck:open-vault-file", {
															detail: {
																fileId,
															mode: "read",
														},
													}))
													} else if (triggerPlatformPinAction(pin)) {
														return
													}
													return
												}
												handlePinHandleKeyDown(event, pin.id)
											}}
											onClick={() => {
												if (isNote && noteId > 0) {
													// Trigger sticky note read modal
													document.dispatchEvent(new CustomEvent('systemdeck:open-note', {
														detail: {
															noteId,
															mode: 'read'
														}
													}));
												} else if (isVault && fileId > 0) {
													document.dispatchEvent(new CustomEvent("systemdeck:open-vault-file", {
														detail: {
															fileId,
															mode: 'read'
														}
													}))
												} else {
													triggerPlatformPinAction(pin)
												}
											}}
											aria-label={`${pinTitle}: ${pinDisplayValue}`}>
											{hasCustomMetricRenderer ? (
												<MetricPinRendererSurface
													renderer={pin.renderer}
													pin={pin}
													metric={metricRegistry?.[metricKey] || null}
													title={pinTitle}
													workspaceId={activeId}
												/>
											) : (
												<>
													<div className='sd-pinned-label' style={isNote ? { color: contrastColor, opacity: 0.9 } : {}}>
														<span
															className={`dashicons ${pin.data?.icon || pin.settings?.icon || (isNote ? "dashicons-paperclip" : "dashicons-admin-generic")}`}
															aria-hidden='true'
															style={isNote ? { color: contrastColor } : {}}
														/>
														{pinTitle}
													</div>
													<div className='sd-pinned-value' aria-live='polite' style={isNote ? { color: contrastColor } : {}}>
														{isNote ? "" : pinDisplayValue}
													</div>
												</>
											)}
											{(() => {
						const pinAuthorId = Number(pin.settings?.author_id || 0)
						// Legacy pins with no author_id: treat as owned by the user who can see them
						// (will be assigned on next save). Only lock if author_id is explicitly set
						// to a DIFFERENT user.
						const isAuthor = pinAuthorId === 0 || pinAuthorId === currentUserId
						const isWsOwner = activeWorkspaceOwnerId === currentUserId
						return (canManageOptions || isWsOwner || isAuthor)
					})() && (
												<button
													type='button'
													className='sd-pin-toggle'
													style={isNote ? { 
														backgroundColor: "rgba(255,255,255,0.2)", 
														color: contrastColor,
														borderColor: "rgba(255,255,255,0.3)"
													} : {}}
													onClick={(e) => {
														e.stopPropagation()
														removePin(pin.id)
													}}
													aria-label={__("Remove pin", "systemdeck") + " " + pinTitle}
													title={__("Remove pin", "systemdeck")}>
													<span className='dashicons dashicons-no-alt' aria-hidden='true' />
												</button>
											)}
										</article>
									)
								})}
							</div>
						</section>
					)}
			{(!canonicalLayout || !canonicalLayout.length) && resolvedPins.length === 0 ? (
				<div className='sd-workspace-empty'>
					<p>
						{__(
							"Workspace is empty. Open Screen Options to add widgets.",
							"systemdeck",
						)}
					</p>
				</div>
			) : (
						<div
							ref={widgetGridRef}
							className='sd-workspace-grid'
							data-dragging={dragging ? "true" : "false"}
							role='grid'
							aria-label={__("Workspace widgets", "systemdeck")}
							onDragOver={handleWidgetGridDragOver}
							onDrop={handleWidgetGridDrop}
							style={{
								display: "grid",
								gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
								gap: `${gridGap}px`,
								padding: 0,
								gridAutoRows: `${GRID_ROW_UNIT}px`,
								gridAutoFlow: "row",
								alignItems: "start",
							width: "100%",
							maxWidth: "100%",
							boxSizing: "border-box",
							overflowX: "hidden",
						}}>
							{runtimeLayout.map((item) => {
						const widgetData = widgets[item.i] || {}
						const registryData = registry[item.i] || {}
						const collapseKey = getWidgetUiKeyForItem(item)
						const isCollapsed = !!workspaceCollapseState[collapseKey]?.collapsed
						const desktopBaseSpan = coerceSpan(item.w, WIDGET_GRID_DESKTOP_UNITS)
						const effectiveSpan = Number(item.w || 1)
						const rowSpan = Number(item.h || (isCollapsed ? getCollapsedRowSpan() : DEFAULT_ROW_SPAN))
						const maxX = Math.max(0, gridCols - effectiveSpan)
						const storedX = Number.isFinite(Number(item.x)) ? Number(item.x) : 0
						const storedY = Number.isFinite(Number(item.y)) ? Number(item.y) : 0
						const previewX =
							widgetDropPreview?.id === item.i ? widgetDropPreview.x : storedX
						const previewY =
							widgetDropPreview?.id === item.i ? widgetDropPreview.y : storedY
						const lockedColStart = Math.max(1, Math.min(maxX, previewX) + 1)
						const lockedRowStart = Math.max(1, previewY + 1)
						const isCanvasHtmlBlock = item.type === "block_html"
						const isWidgetSlot = item.type === "block_widget_placeholder"
						const renderWidgetId = isWidgetSlot
							? item.settings?.widgetId || ""
							: item.i
						const isTunneledProxyWidget =
							typeof renderWidgetId === "string" &&
							(renderWidgetId.startsWith("dashboard.") ||
								renderWidgetId.startsWith("discovered."))
						const widgetTitle =
							registryData.title ||
							widgetData.title ||
							(isWidgetSlot ? item.settings?.label : null) ||
							item.title ||
							formatWidgetTitle(item.i)
						const widthOptions = getWidgetWidthOptions(gridCols)
						const activeWidth = resolveWidgetSpanForMode(desktopBaseSpan, gridCols)

						const widthControl = (
							<DropdownMenu
								icon='editor-expand'
								label={__("Change Width", "systemdeck")}
								className='sd-width-dropdown'
								popoverProps={{ position: "bottom left" }}
								toggleProps={{
									className: "sd-width-dropdown__toggle",
								}}>
								{({ onClose }) => (
									<MenuGroup>
										{widthOptions.map((opt) => (
											<MenuItem
												key={opt.base}
												icon={
													activeWidth === resolveWidgetSpanForMode(opt.base, gridCols)
														? "yes"
														: null
												}
												onClick={() => {
													updateWidgetSpan(item.i, opt.base)
													onClose()
												}}>
												{opt.label}
											</MenuItem>
										))}
									</MenuGroup>
								)}
							</DropdownMenu>
						)

						return (
							<div
								key={item.i}
								onDragEnter={(e) => handleDragEnter(e, item)}
								onDragOver={(e) => handleWidgetItemDragOver(e, item)}
								onDrop={(e) => handleWidgetItemDrop(e, item)}
								ref={bindMeasureNode(item.i)}
								className={`sd-grid-widget ${
									dragging && dragItem.current?.i === item.i
										? "dragging"
										: ""
								} ${
									dragging &&
									dragTargetId === item.i &&
									dragItem.current?.i !== item.i
										? "is-drop-target"
										: ""
								}`}
								style={{
									gridColumn: `${lockedColStart} / span ${effectiveSpan}`,
									gridRow: `${lockedRowStart} / span ${rowSpan}`,
									minWidth: 0,
									width: "100%",
									boxSizing: "border-box",
								}}
								role='gridcell'
								aria-colspan={effectiveSpan}
								aria-rowspan={rowSpan}
								aria-grabbed={dragging && dragItem.current?.i === item.i ? "true" : "false"}>
								{isCanvasHtmlBlock ? (
									<div className='sd-canvas-card sd-canvas-html-block'>
										<div
											className='sd-canvas-html-block__content'
											dangerouslySetInnerHTML={{
												__html: item.settings?.html || "",
											}}
										/>
									</div>
								) : isTunneledProxyWidget ? (
									<WidgetShell
										widgetId={item.i}
										title={widgetTitle}
										isCollapsed={isCollapsed}
										onToggle={() => toggleWidgetCollapse(item)}
										onMoveUp={() => moveWidgetByDirection(item, "up")}
										onMoveDown={() => moveWidgetByDirection(item, "down")}
										onMoveLeft={() => moveWidgetByDirection(item, "left")}
										onMoveRight={() => moveWidgetByDirection(item, "right")}
										moveUpDisabled={lockedRowStart <= 1}
										moveLeftDisabled={lockedColStart <= 1}
										headerDragProps={{
											draggable: true,
											onDragStart: (e) => handleDragStart(e, item),
											onDragEnd: handleDragEnd,
										}}
										widthControl={widthControl}>
										<div className='sd-dashboard-proxy-shell'>
											<ErrorBoundary
												fallback={(err) => (
													<div className='sd-widget-crash'>
														<span className='dashicons dashicons-warning'></span>
														<strong>Crashed</strong>
														<span className='sd-widget-crash__detail'>
															{err?.message}
														</span>
													</div>
												)}>
												{renderWidgetId ? (
													<WidgetRenderer
														widgetId={renderWidgetId}
														settings={item.settings}
														workspaceId={activeId}
														itemId={item.i}
													/>
												) : (
													<div className='sd-canvas-widget-placeholder'>
														<strong>{__("Widget slot is not configured.", "systemdeck")}</strong>
													</div>
												)}
											</ErrorBoundary>
										</div>
									</WidgetShell>
								) : (
									<WidgetShell
										widgetId={item.i}
										title={widgetTitle}
										isCollapsed={isCollapsed}
										onToggle={() => toggleWidgetCollapse(item)}
										onMoveUp={() => moveWidgetByDirection(item, "up")}
										onMoveDown={() => moveWidgetByDirection(item, "down")}
										onMoveLeft={() => moveWidgetByDirection(item, "left")}
										onMoveRight={() => moveWidgetByDirection(item, "right")}
										moveUpDisabled={lockedRowStart <= 1}
										moveLeftDisabled={lockedColStart <= 1}
										headerDragProps={{
											draggable: true,
											onDragStart: (e) => handleDragStart(e, item),
											onDragEnd: handleDragEnd,
										}}
										widthControl={widthControl}>
										<ErrorBoundary
											fallback={(err) => (
												<div className='sd-widget-crash'>
													<span className='dashicons dashicons-warning'></span>
													<strong>Crashed</strong>
													<span className='sd-widget-crash__detail'>
														{err?.message}
													</span>
												</div>
											)}>
											{renderWidgetId ? (
												<WidgetRenderer
													widgetId={renderWidgetId}
													settings={item.settings}
													workspaceId={activeId}
													itemId={item.i}
												/>
											) : (
												<div className='sd-canvas-widget-placeholder'>
													<strong>{__("Widget slot is not configured.", "systemdeck")}</strong>
												</div>
											)}
										</ErrorBoundary>
									</WidgetShell>
								)}
							</div>
						)
								})}
					</div>
			)}
		</>
	)
}
