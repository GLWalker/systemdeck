import { useState, useEffect } from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { STORE_NAME } from "./state/store"
import WorkspaceCanvas from "./canvases/WorkspaceCanvas"
import InspectorCanvas from "./canvases/InspectorCanvas"
import DiscoveryCanvas from "../../command-center/DiscoveryCanvas"

const STORAGE_ACTIVE_WORKSPACE = "sd_active_workspace"
const STORAGE_UI_MODE = "sd_ui_mode"
const RESTORABLE_MODES = new Set(["runtime", "discovery", "config"])

/**
 * Canvas Manager
 *
 * Orchestrates the active "Canvas" view based on Redux state.
 * Implements the "Interactive Readiness Gate" (Phase 10).
 */
function CanvasManager() {
	// const dispatch = useDispatch(STORE_NAME)

	// Local readiness state (blocks interaction until hydrated)
	const [isHydrated, setIsHydrated] = useState(false)
	const [bootError, setBootError] = useState(null)

	// Connect to Redux State
	const { uiMode, activeWorkspaceId } = useSelect((select) => {
		const store = select(STORE_NAME)
		return {
			uiMode: store.getUIMode(),
			activeWorkspaceId: store.getActiveWorkspaceId
				? store.getActiveWorkspaceId()
				: "",
		}
	}, [])

	// Phase 10: Use bound actions from dispatch
	const {
		setCurrentUser,
		setEnvironment,
		setLayoutItems,
		setActiveWorkspace,
		setUIMode,
		registerWidgetV2,
		setRegistryEnablement,
	} = useDispatch(STORE_NAME)

	// Phase 10: Boot-to-Interaction Assembly
	useEffect(() => {
		const boot = async () => {
			if (window.SYSTEMDECK_BOOTSTRAP) {
				const { config } = window.SYSTEMDECK_BOOTSTRAP
				const initialLayouts = config?.initialLayouts || {}

				// 1. Hydrate User & Environment
				if (config.user) {
					setCurrentUser(config.user)
				}

				setEnvironment({
					siteUrl: config.siteUrl,
					ajaxurl: config.ajaxurl,
					nonce: config.nonce,
				})

				// 2. Hydrate Layouts
				if (initialLayouts) {
					Object.keys(initialLayouts).forEach((layoutId) => {
						setLayoutItems(layoutId, initialLayouts[layoutId])
					})
				}

				// 3. Register Widgets from Snapshot (Canonical Source)
				if (
					config.registry_snapshot &&
					config.registry_snapshot.widgets
				) {
					Object.values(config.registry_snapshot.widgets).forEach(
						(w) => registerWidgetV2(w),
					)
				}

				// 3b. Hydrate Global Enablement
				if (config.registry_enablement) {
					setRegistryEnablement(config.registry_enablement)
				}

				// Restore prior workspace when valid, else use first available.
				const bootWorkspaces = config?.workspaces || {}
				const workspaceIds = Array.isArray(bootWorkspaces)
					? bootWorkspaces
							.map((ws) => ws?.id)
							.filter((id) => typeof id === "string" && id)
					: Object.keys(bootWorkspaces)
					const savedWorkspaceId =
						localStorage.getItem(STORAGE_ACTIVE_WORKSPACE) || ""
					const initialWorkspaceId = workspaceIds.includes(savedWorkspaceId)
						? savedWorkspaceId
						: workspaceIds[0] || ""
					setActiveWorkspace(initialWorkspaceId)
					if (initialWorkspaceId) {
						localStorage.setItem(STORAGE_ACTIVE_WORKSPACE, initialWorkspaceId)
					}

					const savedMode = localStorage.getItem(STORAGE_UI_MODE) || "runtime"
					const initialMode = workspaceIds.length === 0
						? "discovery"
						: RESTORABLE_MODES.has(savedMode)
						? savedMode
						: "runtime"
					setUIMode(initialMode)
					localStorage.setItem(STORAGE_UI_MODE, initialMode)

					// 4. Open the Gate
					setIsHydrated(true)
				console.log("SystemDeck: Hydration Complete. Gate Open.")
			} else {
				console.error("SystemDeck: Boot failure. Missing payload.")
				setBootError(
					"SystemDeck Payload Missing. Please refresh the page.",
				)
			}
		}

		// Timeout fallback (5s)
		const timeout = setTimeout(() => {
			if (!isHydrated) {
				setBootError(
					"SystemDeck Boot Timeout. Dashboard tunnel or API might be blocked.",
				)
			}
		}, 5000)

		boot()

		return () => clearTimeout(timeout)
	}, [])

	useEffect(() => {
		if (!isHydrated) {
			return
		}
		if (activeWorkspaceId && typeof activeWorkspaceId === "string") {
			localStorage.setItem(STORAGE_ACTIVE_WORKSPACE, activeWorkspaceId)
		}
		if (uiMode && RESTORABLE_MODES.has(uiMode)) {
			localStorage.setItem(STORAGE_UI_MODE, uiMode)
		}
	}, [isHydrated, activeWorkspaceId, uiMode])

	// Hotkey Listener (Phase 10: Inspector Activation)
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Cmd+Shift+E (Edit/Explore) to avoid DevTools collision
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyE") {
				e.preventDefault()
				const currentMode = uiMode
				if (currentMode === "runtime") {
					setUIMode("discovery")
				} else if (currentMode === "discovery") {
					setUIMode("runtime")
				}
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [uiMode])

		if (!isHydrated) {
			if (bootError) {
				return (
					<div className='sd-boot-status sd-boot-status--error'>
						<span
							className='dashicons dashicons-warning'
						/>
						<strong>Boot Failure</strong>
						<span className='sd-boot-status__detail'>
							{bootError}
						</span>
						<button
							className='button button-secondary'
							onClick={() => window.location.reload()}>
							Reload Dashboard
						</button>
					</div>
				)
			}
			return (
				<div className='sd-boot-status sd-boot-status--loading'>
					<span className='dashicons dashicons-update-alt sd-boot-status__spinner' />
					Booting SystemDeck...
				</div>
			)
		}
	return (
		<div
			className='sd-canvas-manager'
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
			}}>
			{/* CANVAS RENDERER */}
			<div
				className='sd-active-canvas-container'
				style={{ flex: 1, position: "relative" }}>
				{/* Default Runtime (Workspace) - Always Mounted */}
				<div
					className='sd-canvas-stage'
					style={{
						display:
							uiMode === "runtime" || uiMode === "inspector"
								? "block"
								: "none",
					}}>
					<WorkspaceCanvas />
				</div>

				{/* Configuration & Discovery - Always Mounted (Zero Flicker) */}
				<div
					className='sd-canvas-stage'
					style={{
						display:
							uiMode === "config" || uiMode === "discovery"
								? "block"
								: "none",
					}}>
					<DiscoveryCanvas />
				</div>

				{/* Standalone Inspector (Optional / Legacy) */}
				{uiMode === "inspector" && (
					<div className='sd-canvas-stage'>
						<InspectorCanvas />
					</div>
				)}
			</div>
		</div>
	)
}

export default CanvasManager
