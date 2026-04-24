const METRIC_RAW_KEYS = {
	load_time_wp: ["load_time_wp", "load_time_srv"],
	memory_bytes: ["memory_bytes", "memory_limit"],
	plugins_active: ["plugins_active", "plugins_total"],
	db_size_bytes: ["db_size_bytes", "db_tables"],
	scripts_enqueued: ["scripts_enqueued", "scripts_total"],
	styles_enqueued: ["styles_enqueued", "styles_total"],
}

export const formatBytes = (bytes) => {
	const num = Number(bytes || 0)
	if (!Number.isFinite(num) || num <= 0) return "0 B"
	const units = ["B", "KB", "MB", "GB", "TB"]
	let value = num
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export const formatTimeValue = (seconds) => {
	const num = Number(seconds || 0)
	if (!Number.isFinite(num) || num <= 0) return "--:--:--"
	return new Date(num * 1000).toLocaleTimeString([], {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

export const buildTelemetrySource = (metricKey, source = {}) => {
	const key = String(metricKey || "")
	const rawSource = source && typeof source === "object" ? source : {}
	const companion = Array.isArray(METRIC_RAW_KEYS[key]) ? METRIC_RAW_KEYS[key] : [key]
	const resolved = {}
	companion.forEach((field) => {
		if (Object.prototype.hasOwnProperty.call(rawSource, field)) {
			resolved[field] = rawSource[field]
		}
	})
	return resolved
}

const TELEMETRY_FORMATTERS = {
	load_time_wp: (source) =>
		`${Number(source.load_time_wp || 0).toFixed(3)}s / ${Number(source.load_time_srv || 0).toFixed(3)}s`,
	db_queries: (source) => String(source.db_queries ?? 0),
	memory_bytes: (source) => `${formatBytes(source.memory_bytes)} / ${source.memory_limit || "?"}`,
	server_time: (source) => formatTimeValue(source.server_time || source.timestamp),
	wp_time: (source) => formatTimeValue(source.wp_time || source.timestamp),
	uptime: (source) => String(source.uptime || "N/A"),
	db_version: (source) => String(source.db_version || "Unknown"),
	db_size_bytes: (source) => `${formatBytes(source.db_size_bytes)} (${source.db_tables || 0} tables)`,
	db_autoload_bytes: (source) => formatBytes(source.db_autoload_bytes),
	plugins_active: (source) => `${source.plugins_active || 0} / ${source.plugins_total || 0}`,
	scripts_enqueued: (source) => `${source.scripts_enqueued || 0} / ${source.scripts_total || 0}`,
	styles_enqueued: (source) => `${source.styles_enqueued || 0} / ${source.styles_total || 0}`,
	themes_total: (source) => String(source.themes_total || 0),
	wp_debug: (source) => (source.wp_debug ? "Enabled" : "Disabled"),
	php_version: (source) => String(source.php_version || "Unknown"),
	wp_version: (source) => String(source.wp_version || "Unknown"),
	ip_user: (source) => String(source.ip_user || "Unknown"),
	geo_location: (source) => String(source.geo_location || "Unknown"),
}

export const formatTelemetryMetric = (metricKey, source = {}) => {
	const key = String(metricKey || "")
	const formatter = TELEMETRY_FORMATTERS[key]
	if (typeof formatter !== "function") {
		return String(source?.[key] ?? source?.raw_value ?? "--")
	}
	return formatter(source && typeof source === "object" ? source : {})
}

export const resolveTelemetrySource = (metricKey, telemetry = {}, pinData = {}) => {
	const key = String(metricKey || "")
	const liveTelemetry =
		telemetry && typeof telemetry === "object" && Object.prototype.hasOwnProperty.call(telemetry, key)
			? {
					[key]: telemetry[key],
					...buildTelemetrySource(key, telemetry),
				}
			: null

	if (liveTelemetry) {
		return liveTelemetry
	}

	const structuredRaw =
		pinData && typeof pinData.raw === "object" && !Array.isArray(pinData.raw)
			? buildTelemetrySource(key, pinData.raw)
			: {}

	if (!Object.prototype.hasOwnProperty.call(structuredRaw, key) && pinData?.raw_value !== undefined) {
		structuredRaw[key] = pinData.raw_value
	}

	if (Object.keys(structuredRaw).length > 0) {
		return structuredRaw
	}

	return null
}

const sharedApi = {
	formatBytes,
	formatTimeValue,
	buildTelemetrySource,
	formatTelemetryMetric,
	resolveTelemetrySource,
}

if (typeof window !== "undefined") {
	window.SystemDeckTelemetryFormatter = sharedApi
}

export default sharedApi
