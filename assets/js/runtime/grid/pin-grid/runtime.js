const WP_ADMIN_MOBILE_BREAKPOINT = 600
const WP_ADMIN_TABLET_BREAKPOINT = 782
const GRID_GAP = 12
const PIN_GRID_MAX_COLUMNS = 12
const PIN_GRID_MIN_COLUMNS = 4
const PIN_GRID_TARGET_TILE_PX = 56
const PIN_GRID_COMPACT_COLUMNS = 4
const PIN_GRID_TABLET_COLUMNS = 8
const PIN_ALLOWED_SPANS = new Set(["1x1", "1x2", "1x3", "2x1", "2x2", "2x3", "3x1", "3x2", "3x3"])
const PIN_ALLOWED_TEMPLATES = new Set(["default", "samsung-lcd", "tandy-dot", "diagnostic-led"])

export const normalizePinSpanToken = (rawToken, fallbackW = 1, fallbackH = 1) => {
	if (typeof rawToken === "string") {
		const token = rawToken.trim().toLowerCase()
		if (PIN_ALLOWED_SPANS.has(token)) return token
	}
	const w = Math.max(1, Math.min(3, Math.round(Number(fallbackW) || 1)))
	const h = Math.max(1, Math.min(3, Math.round(Number(fallbackH) || 1)))
	const mapped = `${w}x${h}`
	return PIN_ALLOWED_SPANS.has(mapped) ? mapped : "1x1"
}

export const parsePinSpan = (pin) => {
	const settings = pin?.settings || {}
	const token = normalizePinSpanToken(
		pin?.size || settings.grid_span || settings.size || settings.span || "",
		pin?.w ?? 1,
		pin?.h ?? 1,
	)
	const [w, h] = token.split("x").map((value) => Number(value || 1))
	return { token, w: Number.isFinite(w) ? w : 1, h: Number.isFinite(h) ? h : 1 }
}

export const normalizePinType = (rawType, data = {}, settings = {}) => {
	const source = String(rawType || settings.type || data.type || "").trim().toLowerCase()
	const sanitized = source.replace(/[^a-z0-9._-]/g, "")
	if (!sanitized || sanitized === "pin") return "system.status"
	return sanitized
}

export const resolvePinTemplate = (rawTemplate) => {
	const token = String(rawTemplate || "").trim().toLowerCase()
	return PIN_ALLOWED_TEMPLATES.has(token) ? token : "default"
}

export const normalizePinRenderer = (rawRenderer) => {
	const renderer = String(rawRenderer || "").trim().toLowerCase()
	return renderer || "dom"
}

export const isPixiMetricRenderer = (renderer) => {
	const normalized = normalizePinRenderer(renderer)
	return normalized === "pixi" || normalized === "metric_clock_analog"
}

export const normalizePin = (pin, index = 0) => {
	const source = pin && typeof pin === "object" ? pin : {}
	const settings = source.settings && typeof source.settings === "object" ? source.settings : {}
	const incomingData = source.data && typeof source.data === "object" && !Array.isArray(source.data) ? source.data : {}
	const id = String(source.id || "").trim() || `pin_${index + 1}`
	const type = normalizePinType(source.type, incomingData, settings)
	const size = normalizePinSpanToken(
		source.size || settings.grid_span || settings.size || settings.span || "",
		source.w ?? 1,
		source.h ?? 1,
	)
	const [w, h] = size.split("x").map((value) => Number(value || 1))
	const renderer = normalizePinRenderer(source.renderer || settings.renderer)
	const designTemplate = resolvePinTemplate(source.design_template || settings.design_template || "default")
	const title = String(source.title || settings.label || incomingData.label || id).trim() || id
	const metricKey = String(incomingData.metric_key || settings.metric_key || "").trim()
	const noteId = Number(incomingData.noteId || settings.noteId || 0) || (id.startsWith("note.") ? Number(id.split(".").pop() || 0) : 0)
	const fileId = Number(incomingData.fileId || settings.fileId || 0) || (id.startsWith("vault.") ? Number(id.split(".").pop() || 0) : 0)
	const stickyLevel = String(
		incomingData.sticky_level || incomingData.pin_level || settings.sticky_level || settings.pin_level || "low",
	).trim() || "low"
	const sourceWidget = String(incomingData.source_widget || settings.source_widget || "").trim()
	const icon = String(incomingData.icon || settings.icon || "dashicons-admin-generic").trim() || "dashicons-admin-generic"
	const pinKind = String(incomingData.pin_kind || settings.pin_kind || (type === "note" ? "pinned_note" : type === "vault" ? "pinned_file" : "")).trim()
	const data = {
		...incomingData,
		label: title,
		value: incomingData.value ?? settings.value ?? "",
		value_label: incomingData.value_label ?? settings.value_label ?? "",
		action: incomingData.action ?? settings.action ?? "",
		icon,
		metric_key: metricKey,
		source_widget: sourceWidget,
		sticky_level: stickyLevel,
		pin_kind: pinKind,
	}
	if (noteId > 0) data.noteId = noteId
	if (fileId > 0) data.fileId = fileId
	if (type === "note" || noteId > 0) data.type = "note"
	if (type === "vault" || fileId > 0) data.type = "vault"

	return {
		id,
		type,
		size,
		renderer,
		title,
		data,
		design_template: designTemplate,
		settings: {
			...(settings || {}),
			label: title,
			value: data.value,
			value_label: data.value_label,
			action: data.action,
			icon,
			source_widget: sourceWidget,
			metric_key: metricKey,
			grid_span: size,
			design_template: designTemplate,
			renderer,
			sticky_level: stickyLevel,
			pin_kind: pinKind,
			noteId: noteId || 0,
			fileId: fileId || 0,
			type: data.type || settings.type || type,
			author_id: Number(incomingData.author_id || settings.author_id || 0),
		},
		x: Number.isFinite(Number(source.x)) ? Number(source.x) : 0,
		y: Number.isFinite(Number(source.y)) ? Number(source.y) : index,
		w: Number.isFinite(w) ? w : 1,
		h: Number.isFinite(h) ? h : 1,
	}
}

export const getPinGridColumns = (width) => {
	const safeWidth = Math.max(0, Number(width) || 0)
	if (safeWidth <= WP_ADMIN_MOBILE_BREAKPOINT) {
		return Math.max(PIN_GRID_MIN_COLUMNS, Math.min(PIN_GRID_MAX_COLUMNS, PIN_GRID_COMPACT_COLUMNS))
	}
	if (safeWidth <= WP_ADMIN_TABLET_BREAKPOINT) {
		return Math.max(PIN_GRID_MIN_COLUMNS, Math.min(PIN_GRID_MAX_COLUMNS, PIN_GRID_TABLET_COLUMNS))
	}
	const estimated = Math.floor((safeWidth + GRID_GAP) / (PIN_GRID_TARGET_TILE_PX + GRID_GAP))
	return Math.max(PIN_GRID_MIN_COLUMNS, Math.min(PIN_GRID_MAX_COLUMNS, estimated || PIN_GRID_COMPACT_COLUMNS))
}

export const reorderPinsById = (pins, fromPinId, toPinId) => {
	const currentPins = Array.isArray(pins) ? pins : []
	const fromIndex = currentPins.findIndex((pin) => pin?.id === fromPinId)
	const toIndex = currentPins.findIndex((pin) => pin?.id === toPinId)
	if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return currentPins
	const nextPins = [...currentPins]
	const [moved] = nextPins.splice(fromIndex, 1)
	nextPins.splice(toIndex, 0, moved)
	return nextPins
}

export const movePinByOffsetInList = (pins, pinId, offset) => {
	const currentPins = Array.isArray(pins) ? pins : []
	const fromIndex = currentPins.findIndex((pin) => pin?.id === pinId)
	if (fromIndex < 0) return currentPins
	const toIndex = Math.max(0, Math.min(currentPins.length - 1, fromIndex + offset))
	if (toIndex === fromIndex) return currentPins
	const nextPins = [...currentPins]
	const [moved] = nextPins.splice(fromIndex, 1)
	nextPins.splice(toIndex, 0, moved)
	return nextPins
}
