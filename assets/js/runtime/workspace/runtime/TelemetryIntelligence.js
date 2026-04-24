import { buildTelemetrySource } from "./TelemetryFormatter"

const UNKNOWN_ANALYSIS = Object.freeze({
	status: "unknown",
	severity: 0,
	trend: "unknown",
	state_label: "Unknown",
	emphasis: "low",
})

const makeAnalysis = (status, severity, stateLabel, emphasis = "low", trend = "unknown") => ({
	status,
	severity,
	trend,
	state_label: stateLabel,
	emphasis,
})

const toFiniteNumber = (value) => {
	const num = Number(value)
	return Number.isFinite(num) ? num : null
}

const parseByteLike = (value) => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value
	}
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([KMGTP]?B?)?$/i)
	if (!match) return null
	const numeric = Number(match[1])
	if (!Number.isFinite(numeric)) return null
	const unit = String(match[2] || "B").toUpperCase()
	const multipliers = {
		B: 1,
		K: 1024,
		KB: 1024,
		M: 1024 * 1024,
		MB: 1024 * 1024,
		G: 1024 * 1024 * 1024,
		GB: 1024 * 1024 * 1024,
		T: 1024 * 1024 * 1024 * 1024,
		TB: 1024 * 1024 * 1024 * 1024,
	}
	return numeric * (multipliers[unit] || 1)
}

const classifyByThreshold = (value, warningAt, criticalAt, labels = {}) => {
	const numeric = toFiniteNumber(value)
	if (numeric === null) return { ...UNKNOWN_ANALYSIS }
	if (numeric >= criticalAt) {
		return makeAnalysis("critical", 3, labels.critical || "Critical", "high", "unknown")
	}
	if (numeric >= warningAt) {
		return makeAnalysis("warning", 2, labels.warning || "Warning", "medium", "unknown")
	}
	return makeAnalysis("normal", 1, labels.normal || "Healthy", "low", "unknown")
}

const buildMetricSource = (metricKey, source = {}) => {
	const key = String(metricKey || "")
	const resolved = buildTelemetrySource(key, source)
	if (!Object.prototype.hasOwnProperty.call(resolved, key) && Object.prototype.hasOwnProperty.call(source || {}, key)) {
		resolved[key] = source[key]
	}
	return resolved
}

const METRIC_ANALYZERS = {
	load_time_wp: (source) =>
		classifyByThreshold(source.load_time_wp, 0.4, 0.9, {
			normal: "Healthy",
			warning: "Slow",
			critical: "Critical delay",
		}),

	db_queries: (source) =>
		classifyByThreshold(source.db_queries, 100, 250, {
			normal: "Lean",
			warning: "Busy",
			critical: "Heavy",
		}),

	memory_bytes: (source) => {
		const memoryBytes = parseByteLike(source.memory_bytes)
		const memoryLimit = parseByteLike(source.memory_limit)
		if (memoryBytes === null || memoryLimit === null || memoryLimit <= 0) {
			return { ...UNKNOWN_ANALYSIS }
		}
		const ratio = memoryBytes / memoryLimit
		if (ratio >= 0.9) return makeAnalysis("critical", 3, "Near limit", "high")
		if (ratio >= 0.7) return makeAnalysis("warning", 2, "Elevated", "medium")
		return makeAnalysis("normal", 1, "Healthy", "low")
	},

	server_time: (source) =>
		toFiniteNumber(source.server_time || source.timestamp) === null
			? { ...UNKNOWN_ANALYSIS }
			: makeAnalysis("normal", 1, "Current", "low", "stable"),

	wp_time: (source) =>
		toFiniteNumber(source.wp_time || source.timestamp) === null
			? { ...UNKNOWN_ANALYSIS }
			: makeAnalysis("normal", 1, "Current", "low", "stable"),

	uptime: (source) => {
		const numeric = toFiniteNumber(source.uptime)
		if (numeric === null) {
			return source.uptime ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS }
		}
		if (numeric < 3600) return makeAnalysis("warning", 2, "Fresh restart", "medium")
		return makeAnalysis("normal", 1, "Stable", "low", "stable")
	},

	db_version: (source) =>
		source.db_version ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS },

	db_size_bytes: (source) =>
		classifyByThreshold(source.db_size_bytes, 256 * 1024 * 1024, 1024 * 1024 * 1024, {
			normal: "Compact",
			warning: "Growing",
			critical: "Heavy",
		}),

	db_autoload_bytes: (source) =>
		classifyByThreshold(source.db_autoload_bytes, 1024 * 1024, 3 * 1024 * 1024, {
			normal: "Healthy",
			warning: "Elevated",
			critical: "Heavy",
		}),

	plugins_active: (source) =>
		classifyByThreshold(source.plugins_active, 30, 60, {
			normal: "Healthy",
			warning: "Dense",
			critical: "Heavy",
		}),

	themes_total: (source) =>
		classifyByThreshold(source.themes_total, 5, 15, {
			normal: "Lean",
			warning: "Crowded",
			critical: "Heavy",
		}),

	wp_debug: (source) =>
		source.wp_debug
			? makeAnalysis("warning", 2, "Debug enabled", "medium", "stable")
			: makeAnalysis("normal", 1, "Debug off", "low", "stable"),

	php_version: (source) =>
		source.php_version ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS },

	wp_version: (source) =>
		source.wp_version ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS },

	ip_user: (source) =>
		source.ip_user ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS },

	geo_location: (source) =>
		source.geo_location ? makeAnalysis("normal", 1, "Available", "low", "stable") : { ...UNKNOWN_ANALYSIS },
}

export const analyzeTelemetryMetric = (metricKey, source = {}) => {
	const key = String(metricKey || "")
	const analyzer = METRIC_ANALYZERS[key]
	if (typeof analyzer !== "function") {
		return { ...UNKNOWN_ANALYSIS }
	}
	try {
		const metricSource = buildMetricSource(key, source && typeof source === "object" ? source : {})
		const analysis = analyzer(metricSource)
		return {
			...UNKNOWN_ANALYSIS,
			...(analysis && typeof analysis === "object" ? analysis : {}),
		}
	} catch (error) {
		return { ...UNKNOWN_ANALYSIS }
	}
}

export const analyzeTelemetrySet = (telemetry = {}) => {
	const source = telemetry && typeof telemetry === "object" ? telemetry : {}
	return Object.keys(METRIC_ANALYZERS).reduce((acc, metricKey) => {
		acc[metricKey] = analyzeTelemetryMetric(metricKey, source)
		return acc
	}, {})
}

const sharedApi = {
	analyzeTelemetryMetric,
	analyzeTelemetrySet,
}

if (typeof window !== "undefined") {
	window.SystemDeckTelemetryIntelligence = sharedApi
}

export default sharedApi
