export const WIDGET_GRID_DESKTOP_UNITS = 6
export const WIDGET_GRID_TABLET_UNITS = 4
export const WIDGET_GRID_MOBILE_UNITS = 2

const GRID_ROW_UNIT = 8
const GRID_GAP = 12
const MIN_ROW_SPAN = 4
const MAX_ROW_SPAN = 120
const DEFAULT_ROW_SPAN = 12
const COLLAPSED_HEADER_HEIGHT = 46

export const coerceSpan = (rawSpan, gridUnitCols = WIDGET_GRID_DESKTOP_UNITS) => {
	const maxCols = Math.max(1, Number(gridUnitCols) || 1)
	const mapFractionToSpan = (numerator, denominator) =>
		Math.max(1, Math.min(maxCols, Math.round((maxCols * numerator) / denominator)))

	if (typeof rawSpan === "string") {
		const token = rawSpan.trim().toLowerCase()
		if (token === "full" || token === "1") return maxCols
		if (token === "2/3") return mapFractionToSpan(2, 3)
		if (token === "1/3") return mapFractionToSpan(1, 3)
		if (token === "1/2") return mapFractionToSpan(1, 2)
		if (token === "3/4") return mapFractionToSpan(3, 4)
		if (token === "1/4") return mapFractionToSpan(1, 4)
	}

	const numeric = Number(rawSpan)
	if (!Number.isFinite(numeric) || numeric <= 0) {
		return Math.max(1, Math.min(maxCols, Math.round(maxCols / 3)))
	}

	if (numeric <= maxCols) {
		return Math.max(1, Math.min(maxCols, Math.round(numeric)))
	}

	if (numeric > maxCols) {
		return Math.max(1, Math.min(maxCols, Math.round((numeric / 12) * maxCols)))
	}
	return Math.max(1, Math.min(maxCols, Math.round(maxCols / 3)))
}

export const getWidgetWidthOptions = (gridCols) => {
	if (gridCols <= WIDGET_GRID_MOBILE_UNITS) {
		return [{ label: "1", base: 6 }]
	}
	if (gridCols === WIDGET_GRID_TABLET_UNITS) {
		return [
			{ label: "1/2", base: 2 },
			{ label: "1", base: 4 },
		]
	}
	return [
		{ label: "1/3", base: 2 },
		{ label: "1/2", base: 3 },
		{ label: "2/3", base: 4 },
		{ label: "1", base: 6 },
	]
}

export const resolveWidgetSpanForMode = (desktopBaseSpan, gridCols) => {
	const base = Math.max(1, Math.min(WIDGET_GRID_DESKTOP_UNITS, Number(desktopBaseSpan) || 2))
	if (gridCols <= WIDGET_GRID_MOBILE_UNITS) {
		return WIDGET_GRID_MOBILE_UNITS
	}
	if (gridCols === WIDGET_GRID_TABLET_UNITS) {
		return base <= 3 ? 2 : 4
	}
	return base
}

export const getInitialWidgetUiState = () => {
	const bootstrapState = window.SYSTEMDECK_BOOTSTRAP?.config?.widget_ui_state
	const workspaces = bootstrapState?.workspaces
	if (!workspaces || typeof workspaces !== "object") {
		return {}
	}
	return workspaces
}

export const getWidgetUiKeyForItem = (item = {}) => {
	const instanceId = String(item?.i || item?.id || "").trim()
	if (instanceId) return instanceId
	const settings = item?.settings && typeof item.settings === "object" ? item.settings : {}
	const widgetId = String(settings.widgetId || "").trim()
	const x = Number.isFinite(Number(item?.x)) ? Number(item.x) : 0
	const y = Number.isFinite(Number(item?.y)) ? Number(item.y) : 0

	if (widgetId) {
		return `widget:${widgetId}:x${x}:y${y}:id:${instanceId || "none"}`
	}
	return instanceId || `grid:x${x}:y${y}`
}

export const clampRowSpan = (rows) =>
	Math.max(MIN_ROW_SPAN, Math.min(MAX_ROW_SPAN, Math.round(Number(rows) || DEFAULT_ROW_SPAN)))

export const getCollapsedRowSpan = () =>
	Math.max(1, Math.ceil((COLLAPSED_HEADER_HEIGHT + GRID_GAP) / (GRID_ROW_UNIT + GRID_GAP)))

const intersects = (a, b) =>
	a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const findPlacement = ({ preferredX, colSpan, rowSpan, gridCols, placed }) => {
	const maxX = Math.max(0, gridCols - colSpan)
	let y = 0
	let safety = 0
	while (safety < 5000) {
		const startX = Math.max(0, Math.min(maxX, Number(preferredX) || 0))
		const scanOrder = []
		for (let x = startX; x <= maxX; x += 1) scanOrder.push(x)
		for (let x = 0; x < startX; x += 1) scanOrder.push(x)
		for (const x of scanOrder) {
			const probe = { x, y, w: colSpan, h: rowSpan }
			const hasCollision = placed.some((p) => intersects(p, probe))
			if (!hasCollision) return { x, y }
		}
		y += 1
		safety += 1
	}
	return { x: 0, y: 0 }
}

export const computeRuntimeLayout = ({ items, gridCols, measuredRows, collapsedMap }) => {
	const placed = []
	return (Array.isArray(items) ? items : []).map((item) => {
		const desktopW = coerceSpan(item?.w, WIDGET_GRID_DESKTOP_UNITS)
		const colSpan = Math.min(resolveWidgetSpanForMode(desktopW, gridCols), gridCols)
		const isCollapsed = !!collapsedMap[item?.i]?.collapsed
		const rowSpan = isCollapsed
			? getCollapsedRowSpan()
			: clampRowSpan(measuredRows[item?.i] || item?.h || DEFAULT_ROW_SPAN)
		const preferredX = Math.max(0, Math.min(gridCols - colSpan, Number(item?.x) || 0))
		const { x, y } = findPlacement({ preferredX, colSpan, rowSpan, gridCols, placed })
		placed.push({ x, y, w: colSpan, h: rowSpan })
		return { ...item, x, y, w: colSpan, h: rowSpan }
	})
}

export const mergeCanonicalWithRuntimeCoords = (canonicalItems, runtimeItems) => {
	const runtimeById = new Map((Array.isArray(runtimeItems) ? runtimeItems : []).map((item) => [item?.i, item]))
	return (Array.isArray(canonicalItems) ? canonicalItems : []).map((item) => {
		const runtime = runtimeById.get(item?.i)
		if (!runtime) return item
		return {
			...item,
			x: Math.max(0, Number(runtime.x) || 0),
			y: Math.max(0, Number(runtime.y) || 0),
		}
	})
}

export const layoutPositionSignature = (items) =>
	JSON.stringify(
		(Array.isArray(items) ? items : []).map((item) => ({
			i: String(item?.i || item?.id || ""),
			x: Number(item?.x) || 0,
			y: Number(item?.y) || 0,
			w: Number(item?.w) || 0,
			h: Number(item?.h) || 0,
		})),
	)
