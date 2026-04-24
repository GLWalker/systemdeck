import { useEffect, useRef, useState } from "@wordpress/element"
import { Spinner } from "@wordpress/components"

const normalizePinId = (value = "") =>
	String(value || "")
		.trim()
		.replace(/[^a-zA-Z0-9._-]/g, "")

export default function PinRenderer({ pinId, workspaceId = "", instanceId = "" }) {
	const [content, setContent] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [assetsManifest, setAssetsManifest] = useState([])
	const [assetsReady, setAssetsReady] = useState(false)
	const [resolvedId, setResolvedId] = useState("")
	const [renderer, setRenderer] = useState("dom")
	const hostRef = useRef(null)
	const requestKeyRef = useRef("")

	const normalizedPinId = normalizePinId(pinId)

	useEffect(() => {
		setContent(null)
		setError(null)
		setAssetsManifest([])
		setAssetsReady(false)
		setResolvedId("")
		setRenderer("dom")
		if (hostRef.current) {
			hostRef.current.dataset.sdMounted = "0"
		}
	}, [normalizedPinId, workspaceId, instanceId])

	useEffect(() => {
		if (!normalizedPinId) return

		const nonce =
			window.SystemDeckSecurity?.nonce ||
			window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
			window.sd_vars?.nonce ||
			""
		const ajaxUrl =
			window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
			window.sd_vars?.ajaxurl ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"

		const formData = new FormData()
		formData.append("action", "sd_render_pin")
		formData.append("pin_id", normalizedPinId)
		formData.append("workspace_id", workspaceId || "")
		formData.append("instance_id", instanceId || normalizedPinId)
		formData.append("nonce", nonce)

		const requestKey = `${normalizedPinId}::${workspaceId}::${instanceId}`
		requestKeyRef.current = requestKey
		const controller = new AbortController()
		setLoading(true)

		fetch(ajaxUrl, {
			method: "POST",
			body: formData,
			signal: controller.signal,
		})
			.then((res) => res.json())
			.then((data) => {
				if (requestKeyRef.current !== requestKey) {
					return
				}
				if (!data || !data.success) {
					throw new Error(data?.data?.message || "Failed to render pin")
				}

				setContent(String(data.data?.html || ""))
				setResolvedId(normalizePinId(String(data.data?.resolved_id || "")))
				setRenderer(String(data.data?.renderer || "dom"))
				setAssetsManifest(
					Array.isArray(data.data?.assets_manifest) ? data.data.assets_manifest : [],
				)
			})
			.catch((fetchError) => {
				if (fetchError?.name === "AbortError") return
				console.error("SystemDeck Pin Error:", fetchError)
				setError(fetchError?.message || "Failed to render pin")
			})
			.finally(() => {
				if (requestKeyRef.current === requestKey) {
					setLoading(false)
				}
			})

		return () => {
			controller.abort()
		}
	}, [normalizedPinId, workspaceId, instanceId])

	useEffect(() => {
		if (!content) return
		if (!Array.isArray(assetsManifest) || assetsManifest.length === 0) {
			setAssetsReady(true)
			return
		}

		const loader = window.SystemDeckWidgetLoader
		if (!loader || typeof loader.ensureWidgetAssets !== "function") {
			setError("Pin asset loader unavailable.")
			return
		}

		let cancelled = false
		loader
			.ensureWidgetAssets(assetsManifest)
			.then(() => {
				if (!cancelled) {
					setAssetsReady(true)
				}
			})
			.catch((assetError) => {
				if (!cancelled) {
					console.error("[PinAssetLoader] Critical asset failure", assetError)
					setError(`Failed to load pin assets: ${assetError?.message || "Unknown asset error"}`)
				}
			})

		return () => {
			cancelled = true
		}
	}, [content, assetsManifest])

	useEffect(() => {
		if (!content || !assetsReady || !hostRef.current) {
			return
		}

		const host = hostRef.current
		const root = host.querySelector('[data-pin-root="1"]') || host.firstElementChild
		if (!(root instanceof Element)) {
			return
		}

		if (root.dataset.sdMounted === "1") {
			return
		}

		document.dispatchEvent(
			new CustomEvent("systemdeck:pin:mount", {
				detail: {
					pinId: resolvedId || normalizedPinId,
					instanceId: instanceId || normalizedPinId,
					workspaceId,
					element: root,
					renderer,
				},
			}),
		)
	}, [content, assetsReady, resolvedId, normalizedPinId, instanceId, workspaceId, renderer])

	if (error) {
		return <div className='sd-pin-error'>Error: {error}</div>
	}

	if (loading || !content || !assetsReady) {
		return (
			<div className='sd-pin-loading'>
				<Spinner />
			</div>
		)
	}

	return (
		<div
			ref={hostRef}
			className='sd-pin-render-host'
			data-pin-id={normalizedPinId}
			data-resolved-id={resolvedId}
			dangerouslySetInnerHTML={{ __html: content }}
		/>
	)
}
