import { useState, useEffect, useRef } from "@wordpress/element"
import { Spinner } from "@wordpress/components"

const normalizeWidgetId = (value = "") =>
	String(value || "")
		.trim()
		.replace(/_/g, ".")
		.replace(/[^a-zA-Z0-9._-]/g, "")

const DashboardWidgetFrame = ({ widgetId, minHeight = 15 }) => {
	const iframeRef = useRef(null)
	const adminUrl =
		window.SYSTEMDECK_BOOTSTRAP?.config?.admin_url ||
		window.sd_vars?.admin_url ||
		"/wp-admin/"
	const nonce =
		window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
		window.sd_vars?.nonce ||
		""

	const url = new URL(adminUrl + "admin.php", window.location.origin)
	url.searchParams.set("page", "sd-dashboard-tunnel")
	url.searchParams.set("widget", widgetId)
	url.searchParams.set("nonce", nonce)
	url.searchParams.set("sd_block_boot", "1")
	const parentDebug = new URLSearchParams(window.location.search).get(
		"sd_tunnel_debug",
	)
	if (parentDebug === "1") {
		url.searchParams.set("sd_tunnel_debug", "1")
	}

	// Auto-reload iframe when computer wakes from sleep
	useEffect(() => {
		let lastTime = Date.now()
		const checkWake = () => {
			const currentTime = Date.now()
			if (currentTime > lastTime + 5000) {
				if (iframeRef.current) {
					const currentSrc = iframeRef.current.src
					iframeRef.current.src = ""
					setTimeout(() => {
						if (iframeRef.current)
							iframeRef.current.src = currentSrc
					}, 100)
				}
			}
			lastTime = currentTime
		}
		const interval = setInterval(checkWake, 2000)

		const handleVisibilityChange = () => {
			if (!document.hidden && iframeRef.current) {
				setTimeout(() => {
					if (iframeRef.current) {
						const currentSrc = iframeRef.current.src
						iframeRef.current.src = ""
						setTimeout(() => {
							if (iframeRef.current)
								iframeRef.current.src = currentSrc
						}, 100)
					}
				}, 500)
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			clearInterval(interval)
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			)
		}
	}, [widgetId])

	return (
		<div
			className='sd-proxy-frame-wrapper'
			style={{
				width: "100%",
				height: "auto",
				display: "flex",
				flexDirection: "column",
			}}>
			<iframe
				ref={iframeRef}
				src={url.toString()}
				frameBorder='0'
				scrolling='no'
				loading='lazy'
				allowTransparency='true'
				style={{
					width: "100%",
					height: "auto",
					flexGrow: 1,
					background: "transparent",
					border: "none",
					overflow: "hidden",
					minHeight: minHeight + "px",
				}}
			/>
		</div>
	)
}

export default function WidgetRenderer({
	widgetId,
	settings = {},
	workspaceId = "",
	itemId = "",
}) {
	const [content, setContent] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [assetsManifest, setAssetsManifest] = useState([])
	const [assetsReady, setAssetsReady] = useState(false)
	const [resolvedMeta, setResolvedMeta] = useState({
		requested: "",
		resolved: "",
		source: "",
	})
	const mountedRef = useRef(false)
	const requestKeyRef = useRef("")
	const hostRef = useRef(null)
	const settingsKey = JSON.stringify(settings || {})
	const normalizedRequested = normalizeWidgetId(widgetId)

	// Dashboard/discovered widgets must be tunneled to avoid executing
	// third-party dashboard callbacks directly in AJAX render context.
	const isProxy =
		widgetId.startsWith("dashboard.") ||
		widgetId.startsWith("discovered.")

	useEffect(() => {
		setContent(null)
		setError(null)
		setResolvedMeta({
			requested: normalizedRequested,
			resolved: "",
			source: "",
		})
		setAssetsManifest([])
		setAssetsReady(false)
		mountedRef.current = false
	}, [widgetId, settingsKey, normalizedRequested])

	useEffect(() => {
		if (isProxy || !widgetId || widgetId === "undefined") return

		const nonce =
			window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
			window.sd_vars?.nonce ||
			""
		const ajaxUrl =
			window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
			window.sd_vars?.ajaxurl ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"

		const formData = new FormData()
		formData.append("action", "sd_render_widget")
		formData.append("widget_id", widgetId)
		formData.append("workspace_id", workspaceId || "")
		formData.append("nonce", nonce)
		const requestKey = `${normalizedRequested}::${settingsKey}`
		requestKeyRef.current = requestKey
		const controller = new AbortController()
		setLoading(true)

		if (Object.keys(settings).length) {
			formData.append("settings", JSON.stringify(settings))
		}

		fetch(ajaxUrl, {
			method: "POST",
			body: formData,
			signal: controller.signal,
		})
			.then(async (res) => {
				const contentType = res.headers.get("content-type") || "";
				const isJson = contentType.includes("application/json");
				let data = null;
				const looksLikeWidgetHtml = (text) => {
					const trimmed = (text || "").trim();
					return (
						trimmed.startsWith("<") &&
						/(sd-|postbox|data-widget=|react-mount-point|widget-)/i.test(trimmed)
					);
				};

				if (isJson) {
					const text = await res.text();
					try {
						data = text ? JSON.parse(text) : null;
					} catch (parseError) {
						if (looksLikeWidgetHtml(text)) {
							data = {
								success: true,
								data: {
									html: text,
									resolved_id: normalizedRequested,
									source_id: normalizedRequested,
								},
							};
						} else if (!res.ok) {
							throw new Error(`Server Error (${res.status}): Invalid JSON response.`);
						} else {
							console.error("SystemDeck Raw Response Error:", text.substring(0, 500));
							throw new Error(`Invalid JSON format from server. Attempted to parse HTML as JSON.`);
						}
					}
				} else {
					const text = await res.text();
					try {
						data = text ? JSON.parse(text) : null;
					} catch (parseError) {
						if (looksLikeWidgetHtml(text)) {
							data = {
								success: true,
								data: {
									html: text,
									resolved_id: normalizedRequested,
									source_id: normalizedRequested,
								},
							};
						} else if (!res.ok) {
							console.error(
								"SystemDeck Widget 403/Non-JSON Response:",
								text.substring(0, 1000),
							)
							throw new Error(`Server Error (${res.status}): Invalid response format.`);
						} else {
							console.error("SystemDeck Raw Response Error:", text.substring(0, 500));
							throw new Error(`Invalid JSON format from server. Attempted to parse HTML as JSON.`);
						}
					}
				}

				if (!res.ok) {
					const errorMsg =
						(data && data.data && data.data.message) ||
						res.statusText;
					throw new Error(`Server Error: ${errorMsg} (${res.status})`);
				}

				if (data && data.success) {
					if (requestKeyRef.current !== requestKey) {
						return
					}
					const resolved = normalizeWidgetId(
						data?.data?.resolved_id || "",
					)
					const source = normalizeWidgetId(
						data?.data?.source_id || "",
					)
					setResolvedMeta({
						requested: normalizedRequested,
						resolved,
						source,
					})
					if (resolved && resolved !== normalizedRequested) {
						throw new Error(
							`Widget dataset mismatch (${normalizedRequested} -> ${resolved})`,
						)
					}
					const manifest = Array.isArray(
						data?.data?.assets_manifest,
					)
						? data.data.assets_manifest
						: []
					setAssetsManifest(manifest)
					setAssetsReady(manifest.length === 0)
					setContent(data.data.html || "")
				} else {
					setError(data?.data?.message || "Failed to load widget")
				}
			})
			.catch((err) => {
				if (err?.name === "AbortError") return
				console.error("SystemDeck Widget Error:", err)
				setError(err.message)
			})
			.finally(() => {
				if (requestKeyRef.current === requestKey) {
					setLoading(false)
				}
			})
		return () => {
			controller.abort()
		}
	}, [widgetId, isProxy, settingsKey, normalizedRequested])

	useEffect(() => {
		if (!content || assetsReady || !Array.isArray(assetsManifest)) {
			return
		}

		const loader = window.SystemDeckWidgetLoader
		if (!loader || typeof loader.ensureWidgetAssets !== "function") {
			setError("Widget asset loader unavailable.")
			return
		}

		let cancelled = false
		loader
			.ensureWidgetAssets(assetsManifest)
			.then(() => {
				if (cancelled) return
				setAssetsReady(true)
			})
			.catch((err) => {
				if (cancelled) return
				console.error("[WidgetAssetLoader] Critical asset failure", err)
				setError(
					`Failed to load widget assets: ${
						err?.message || "Unknown asset error"
					}`,
				)
			})

		return () => {
			cancelled = true
		}
	}, [content, assetsManifest, assetsReady])

	useEffect(() => {
		if (content && assetsReady && !mountedRef.current) {
			const root = hostRef.current
			if (!root || !document.body.contains(root)) {
				return
			}
			mountedRef.current = true

			const mountEvent = new CustomEvent("systemdeck:widget:mount", {
				detail: {
					widgetId: normalizedRequested,
					root,
				},
			})
			document.dispatchEvent(mountEvent)
		}
	}, [content, assetsReady, normalizedRequested])

	if (isProxy) {
		const realId = widgetId
			.replace("dashboard.", "")
			.replace("discovered.", "")
		return (
			<div
				className='sd-widget-render-host'
				data-widget-id={normalizedRequested}
				data-source-id={realId}
				data-workspace-id={workspaceId}
				data-item-id={itemId}>
				<DashboardWidgetFrame widgetId={realId} />
			</div>
		)
	}

	if (error) {
		return <div className='sd-widget-error'>Error: {error}</div>
	}

	if (loading) {
		return (
			<div className='sd-widget-loading'>
				<Spinner />
			</div>
		)
	}

	return (
		<div
			ref={hostRef}
			className='sd-widget-render-host'
			data-widget-id={normalizedRequested}
			data-resolved-id={resolvedMeta.resolved}
			data-source-id={resolvedMeta.source}
			data-workspace-id={workspaceId}
			data-item-id={itemId}>
			<div
			className={`sd-widget-content widget-${widgetId}`}
			dangerouslySetInnerHTML={{ __html: content }}
			/>
		</div>
	)
}
