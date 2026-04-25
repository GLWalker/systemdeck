import {
	useState,
	useRef,
	useEffect,
	Fragment,
	useMemo,
} from "@wordpress/element"
import { useSelect, useDispatch } from "@wordpress/data"
import { FormToggle, Icon, Spinner, TabPanel } from "@wordpress/components"
import { __ } from "@wordpress/i18n"
import { STORE_NAME } from "../runtime/workspace/state/store"
import * as actions from "../runtime/workspace/state/actions"
import useConfirmDialog from "../runtime/workspace/components/useConfirmDialog"
import useSystemNotice from "../runtime/workspace/components/useSystemNotice"
import WorkspaceGridSection from "./discovery/WorkspaceGridSection"
import "../../css/command-center/DiscoveryCanvas.css"

export default function DiscoveryCanvas() {
	const SHOW_SCANNER_TAB = false
	const APP_MANIFESTS =
		window.SYSTEMDECK_BOOTSTRAP?.config?.apps?.map((app) => ({
			id: app?.id || "",
			title: app?.title || app?.id || "",
			workspaceId: app?.workspace_id || "",
			rootWidgetId: app?.root_widget_id || "",
			entry: app?.entry || "tools",
			capability: "manage_options",
		})) || []
	const CAN_MANAGE_OPTIONS =
		!!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_options
	const CAN_VIEW_WORKSPACES =
		!!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_view_workspaces
	const CAN_MANAGE_WORKSPACES =
		!!window.SYSTEMDECK_BOOTSTRAP?.config?.user?.can_manage_workspaces
	const ACCESS_POLICY_ROLE_OPTIONS = window.SYSTEMDECK_BOOTSTRAP?.config?.user
		?.access_policy_role_options || [
		"editor",
		"author",
		"contributor",
		"subscriber",
	]

	// 1. Redux State & Actions
	const { workspaces, activeId, layouts } = useSelect((select) => {
		const store = select(STORE_NAME)
		return {
			workspaces: store.getAllWorkspaces ? store.getAllWorkspaces() : [],
			activeId: store.getActiveWorkspaceId
				? store.getActiveWorkspaceId()
				: "",
			layouts: store.getLayouts ? store.getLayouts() : {},
		}
	}, [])

	// Phase 10: State Alignment (Canonical Snapshot)
	const registrySnapshot = useSelect(
		(select) => select(STORE_NAME).getRegistrySnapshot(),
		[],
	)
	const initialEnablement = useSelect(
		(select) => select(STORE_NAME).getRegistryEnablement(),
		[],
	)

	const {
		addWorkspace,
		registerWorkspace,
		removeWorkspace,
		reorderWorkspaces,
		renameWorkspace,
		setActiveWorkspace,
		setUIMode,
		setRegistryEnablement: dispatchSetRegistryEnablement,
		updateWorkspaceConfig,
	} = useDispatch(STORE_NAME)

	// 2. Helpers
	const getNonce = () =>
		window.SystemDeckSecurity?.nonce ||
		window.sd_vars?.nonce ||
		window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
		""

	const getAjaxUrl = () =>
		window.sd_vars?.ajaxurl ||
		window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
		"/wp-admin/admin-ajax.php"

	const postAction = async (action, payload = {}) =>
		jQuery.post(getAjaxUrl(), {
			action,
			nonce: getNonce(),
			...payload,
		})

	const { pushNotice } = useSystemNotice()

	// 3. Local State
	const [wsList, setWsList] = useState([])
	const [dragging, setDragging] = useState(false)
	const [dropTargetId, setDropTargetId] = useState("")
	const [isCreating, setIsCreating] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [newTitle, setNewTitle] = useState("")
	const [registrySaveStatus, setRegistrySaveStatus] = useState(null)
	const [accessPolicySaveStatus, setAccessPolicySaveStatus] = useState(null)
	const [userPreferencesSaveStatus, setUserPreferencesSaveStatus] =
		useState(null)

	const [incognitoMode, setIncognitoMode] = useState(
		window.sd_vars?.user?.sd_incognito_mode || false,
	)
	const [defaultDock, setDefaultDock] = useState(
		window.sd_vars?.user?.sd_default_dock || "standard-dock",
	)
	const [audioMasterVolume, setAudioMasterVolume] = useState(() => {
		const raw = Number(window.sd_vars?.user?.sd_audio_master_volume ?? 1)
		if (!Number.isFinite(raw)) return 1
		return Math.max(0, Math.min(1, raw))
	})
	const [importPayload, setImportPayload] = useState("")
	const [importFileName, setImportFileName] = useState("")
	const [audienceCandidatesByWorkspace, setAudienceCandidatesByWorkspace] =
		useState({})
	const [appEditingId, setAppEditingId] = useState("")
	const [appDraftById, setAppDraftById] = useState({})
	const [appSavingId, setAppSavingId] = useState("")
	const [accessPolicy, setAccessPolicy] = useState({
		shell_roles: ["administrator"],
		workspace_manage_roles: ["administrator"],
	})

	// Edit/Rename State
	const [editingId, setEditingId] = useState(null)
	const [editTitle, setEditTitle] = useState("")

	// Local copy for "Pending Changes" in Widget Registry
	// Use bootstrap or store for initial value
	const [registryEnablement, setLocalEnablement] = useState(() => {
		return (
			window.SYSTEMDECK_BOOTSTRAP?.config?.registry_enablement ||
			window.sd_vars?.registry_enablement ||
			initialEnablement ||
			[]
		)
	})

	const { requestConfirm, confirmNode } = useConfirmDialog()

	const widgetCountsByWorkspace = useMemo(() => {
		const counts = {}
		Object.keys(layouts || {}).forEach((workspaceId) => {
			const layout = layouts[workspaceId] || {}
			counts[workspaceId] = Object.values(layout).filter(
				(item) =>
					item &&
					(item.type === "widget" ||
						item.type === undefined ||
						item.type === "block_widget_placeholder"),
			).length
		})
		;(workspaces || []).forEach((ws) => {
			if (!counts[ws.id]) {
				counts[ws.id] = ws.widgets?.length || 0
			}
		})
		return counts
	}, [layouts, workspaces])

	const getWorkspaceWidgetCount = (ws) => {
		const raw = widgetCountsByWorkspace?.[ws.id]
		return Number.isFinite(raw) ? raw : 0
	}

	const getWorkspaceCreatedLabel = (ws) => {
		const raw = ws?.cpt_created || ws?.created
		if (!raw || typeof raw !== "string" || !raw.trim()) {
			return "n/a"
		}
		return raw
	}

	const getWorkspaceAuthorLabel = (ws) => {
		const raw = ws?.cpt_author_name
		if (!raw || typeof raw !== "string" || !raw.trim()) {
			return "n/a"
		}
		return raw
	}

	const getWorkspaceAudienceCandidates = (workspace) => {
		const workspaceId = workspace?.id || ""
		return Array.isArray(audienceCandidatesByWorkspace?.[workspaceId])
			? audienceCandidatesByWorkspace[workspaceId]
			: []
	}

	const handleSetAccessRole = async (workspaceId, accessRole) => {
		if (!workspaceId) return
		let result = null
		try {
			const res = await postAction("sd_set_workspace_access_role", {
				workspace_id: workspaceId,
				access_role: accessRole || "administrator",
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__("Could not update workspace access.", "systemdeck"),
			)
				return
			}
			result = res?.data || {}
			setWsList((prev) =>
				(prev || []).map((ws) =>
					ws.id === workspaceId
						? {
								...ws,
								access_role:
									res?.data?.access_role || "administrator",
						  }
						: ws,
				),
			)
			pushNotice("success", __("Workspace access updated.", "systemdeck"))
		} catch (e) {
			pushNotice(
				"error",
				__("Could not update workspace access.", "systemdeck"),
			)
			return null
		}
		return result
	}

	const handleSetWorkspaceVisibility = async (
		workspaceId,
		isPublic,
		isLocked,
	) => {
		if (!workspaceId) return
		let result = null
		try {
			const res = await postAction("sd_set_workspace_visibility", {
				workspace_id: workspaceId,
				is_public: isPublic ? 1 : 0,
				is_locked: isLocked ? 1 : 0,
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__(
							"Could not update workspace visibility.",
							"systemdeck",
						),
				)
				return
			}
			result = res?.data || {}
			setWsList((prev) =>
				(prev || []).map((ws) =>
					ws.id === workspaceId
						? {
								...ws,
								is_public: !!res?.data?.is_public,
								is_locked: !!res?.data?.is_locked,
								collaboration_mode:
									res?.data?.collaboration_mode ||
									ws?.collaboration_mode ||
									"owner_only",
						  }
						: ws,
				),
			)
			if (updateWorkspaceConfig) {
				updateWorkspaceConfig(workspaceId, {
					is_public: !!res?.data?.is_public,
					is_locked: !!res?.data?.is_locked,
					collaboration_mode:
						res?.data?.collaboration_mode || "owner_only",
					shared_menu_only:
						!!res?.data?.is_public && !!res?.data?.is_locked,
				})
			}
			pushNotice(
				"success",
				__("Workspace visibility updated.", "systemdeck"),
			)
		} catch (e) {
			pushNotice(
				"error",
				__("Could not update workspace visibility.", "systemdeck"),
			)
			return null
		}
		return result
	}

	const handleSetCollaborationMode = async (workspaceId, collaborationMode) => {
		if (!workspaceId) return
		let result = null
		try {
			const res = await postAction("sd_set_workspace_collaboration_mode", {
				workspace_id: workspaceId,
				collaboration_mode: collaborationMode || "owner_only",
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__(
							"Could not update workspace collaboration mode.",
							"systemdeck",
						),
				)
				return
			}
			result = res?.data || {}
			setWsList((prev) =>
				(prev || []).map((ws) =>
					ws.id === workspaceId
						? {
								...ws,
								collaboration_mode:
									res?.data?.collaboration_mode || "owner_only",
								is_public:
									res?.data?.is_public === null
										? !!ws?.is_public
										: !!res?.data?.is_public,
								is_locked:
									res?.data?.is_locked === null
										? !!ws?.is_locked
										: !!res?.data?.is_locked,
						  }
						: ws,
				),
			)
			if (updateWorkspaceConfig) {
				updateWorkspaceConfig(workspaceId, {
					collaboration_mode:
						res?.data?.collaboration_mode || "owner_only",
					is_public:
						res?.data?.is_public === null
							? undefined
							: !!res?.data?.is_public,
					is_locked:
						res?.data?.is_locked === null
							? undefined
							: !!res?.data?.is_locked,
					shared_menu_only:
						res?.data?.is_public === null
							? undefined
							: !!res?.data?.is_public && !!res?.data?.is_locked,
				})
			}
			pushNotice(
				"success",
				__("Workspace collaboration mode updated.", "systemdeck"),
			)
		} catch (e) {
			pushNotice(
				"error",
				__(
					"Could not update workspace collaboration mode.",
					"systemdeck",
				),
			)
			return null
		}
		return result
	}

	const handleSetWorkspaceAudience = async (
		workspaceId,
		audienceScope,
		targetUsernames = "",
		targetUserIds = [],
	) => {
		if (!workspaceId) return
		let result = null
		try {
			const res = await postAction("sd_set_workspace_audience", {
				workspace_id: workspaceId,
				audience_scope: audienceScope || "global",
				target_usernames: targetUsernames || "",
				target_user_ids: Array.isArray(targetUserIds)
					? JSON.stringify(targetUserIds)
					: "[]",
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__("Could not update workspace audience.", "systemdeck"),
				)
				return
			}
			result = res?.data || {}
			setWsList((prev) =>
				(prev || []).map((ws) =>
					ws.id === workspaceId
						? {
								...ws,
								audience_scope: res?.data?.audience_scope || "global",
								target_user_ids: res?.data?.target_user_ids || [],
								target_user_logins:
									res?.data?.target_user_logins || [],
						  }
						: ws,
				),
			)
			if (updateWorkspaceConfig) {
				updateWorkspaceConfig(workspaceId, {
					audience_scope: res?.data?.audience_scope || "global",
					target_user_ids: res?.data?.target_user_ids || [],
					target_user_logins: res?.data?.target_user_logins || [],
				})
			}
			pushNotice("success", __("Workspace audience updated.", "systemdeck"))
		} catch (e) {
			pushNotice(
				"error",
				__("Could not update workspace audience.", "systemdeck"),
			)
			return null
		}
		return result
	}

	const handleSetWorkspaceAppMenu = async (
		workspaceId,
		showTopLevelMenu,
		menuIcon,
	) => {
		if (!workspaceId) return null
		try {
			const res = await postAction("sd_set_workspace_app_menu", {
				workspace_id: workspaceId,
				show_top_level_menu: showTopLevelMenu ? 1 : 0,
				menu_icon: menuIcon || "",
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message || __("Could not update app menu settings.", "systemdeck"),
				)
				return null
			}
			const incomingWorkspace = res?.data?.workspace
			setWsList((prev) =>
				(prev || []).map((ws) =>
					ws.id === workspaceId
						? incomingWorkspace && typeof incomingWorkspace === "object"
							? { ...ws, ...incomingWorkspace }
							: {
									...ws,
									show_top_level_menu: !!res?.data?.show_top_level_menu,
									menu_icon: res?.data?.menu_icon || "dashicons-screenoptions",
							  }
						: ws,
				),
			)
			if (updateWorkspaceConfig) {
				updateWorkspaceConfig(workspaceId, {
					show_top_level_menu: !!res?.data?.show_top_level_menu,
					menu_icon: res?.data?.menu_icon || "dashicons-screenoptions",
				})
			}
			return res?.data || null
		} catch (e) {
			pushNotice("error", __("Could not update app menu settings.", "systemdeck"))
			return null
		}
	}

	const handleFetchWorkspaceAudienceCandidates = async (
		workspaceId,
		query = "",
		accessRole = "",
	) => {
		if (!workspaceId) return
		try {
			const res = await postAction("sd_get_workspace_audience_candidates", {
				workspace_id: workspaceId,
				q: query || "",
				access_role: accessRole || "",
			})
			if (!res?.success) {
				return []
			}
			const candidates = Array.isArray(res?.data?.candidates)
				? res.data.candidates
				: []
			setAudienceCandidatesByWorkspace((prev) => ({
				...prev,
				[workspaceId]: candidates,
			}))
			return candidates
		} catch (e) {
			// Non-fatal UI helper.
			return []
		}
	}

	const POLICY_ROLE_OPTIONS = [
		"administrator",
		"editor",
		"author",
		"contributor",
		"subscriber",
	]

	const getWorkspaceAccessRole = (workspace) => {
		const role = (workspace?.access_role || "").toLowerCase()
		return POLICY_ROLE_OPTIONS.includes(role) ? role : "administrator"
	}

	const POLICY_FIELDS = [
		["shell_roles", __("Shell Access", "systemdeck")],
		["workspace_view_roles", __("Workspace View", "systemdeck")],
		["workspace_manage_roles", __("Workspace Manage", "systemdeck")],
	]

	const togglePolicyRole = (field, role, checked) => {
		setAccessPolicy((prev) => {
			const current = Array.isArray(prev?.[field]) ? prev[field] : []
			const next = checked
				? [...new Set([...current, role])]
				: current.filter((r) => r !== role)
			return { ...prev, [field]: next.length ? next : ["administrator"] }
		})
	}

	const saveUserPreferences = async () => {
		setIsLoading(true)
		setUserPreferencesSaveStatus(null)
		try {
				const res = await jQuery.post(getAjaxUrl(), {
					action: "sd_save_user_preferences",
					nonce: getNonce(),
					incognito_mode: incognitoMode ? "true" : "false",
					default_dock: defaultDock,
					audio_master_volume: audioMasterVolume,
				})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__("Could not save preferences.", "systemdeck"),
				)
				setUserPreferencesSaveStatus({
					type: "error",
					message: __("Save failed", "systemdeck"),
				})
				return
			}
			pushNotice("success", __("Preferences saved.", "systemdeck"))
			setUserPreferencesSaveStatus({
				type: "success",
				message: __("Saved", "systemdeck"),
			})
			if (window.SYSTEMDECK_BOOTSTRAP?.config?.user) {
				window.SYSTEMDECK_BOOTSTRAP.config.user.sd_incognito_mode =
					incognitoMode
				window.SYSTEMDECK_BOOTSTRAP.config.user.sd_default_dock =
					defaultDock
				window.SYSTEMDECK_BOOTSTRAP.config.user.sd_audio_master_volume =
					audioMasterVolume
			}
			const shellEl = document.getElementById("systemdeck")
			if (shellEl) {
				shellEl.dataset.defaultDock = defaultDock
				shellEl.dataset.incognito = incognitoMode ? "true" : "false"
				shellEl.classList.toggle("incognito", !!incognitoMode)
			}
			if (window.SYSTEMDECK_ENV) {
				window.SYSTEMDECK_ENV.audio = {
					masterVolume: Number(audioMasterVolume || 1),
					}
				}
				if (window.dispatchEvent && window.CustomEvent) {
					window.dispatchEvent(
						new CustomEvent("systemdeck:audio-settings-changed", {
							detail: {
								masterVolume: Number(audioMasterVolume || 1),
							},
						}),
					)
				}
		} catch (e) {
			console.error(e)
			pushNotice("error", __("Could not save preferences.", "systemdeck"))
			setUserPreferencesSaveStatus({
				type: "error",
				message: __("Save failed", "systemdeck"),
			})
		} finally {
			setIsLoading(false)
		}
	}

	const saveAccessPolicy = async () => {
		setIsLoading(true)
		setAccessPolicySaveStatus(null)
		try {
			const res = await postAction("sd_save_access_policy", {
				policy: JSON.stringify(accessPolicy),
			})
			if (!res?.success) {
				pushNotice(
					"error",
					res?.data?.message ||
						__("Could not save access policy.", "systemdeck"),
				)
				setAccessPolicySaveStatus({
					type: "error",
					message: __("Save failed", "systemdeck"),
				})
				return
			}
			if (res?.data?.policy) {
				setAccessPolicy(res.data.policy)
			}
			pushNotice("success", __("Access policy saved.", "systemdeck"))
			setAccessPolicySaveStatus({
				type: "success",
				message: __("Saved", "systemdeck"),
			})
		} catch (e) {
			pushNotice(
				"error",
				__("Could not save access policy.", "systemdeck"),
			)
			setAccessPolicySaveStatus({
				type: "error",
				message: __("Save failed", "systemdeck"),
			})
		} finally {
			setIsLoading(false)
		}
	}

	// Sync Redux -> Local
	useEffect(() => {
		if (initialEnablement) {
			setLocalEnablement(initialEnablement)
		}
	}, [initialEnablement])

	useEffect(() => {
		if (!registrySaveStatus) {
			return undefined
		}
		const timer = setTimeout(() => setRegistrySaveStatus(null), 4500)
		return () => clearTimeout(timer)
	}, [registrySaveStatus])

	useEffect(() => {
		if (!accessPolicySaveStatus) {
			return undefined
		}
		const timer = setTimeout(() => setAccessPolicySaveStatus(null), 4500)
		return () => clearTimeout(timer)
	}, [accessPolicySaveStatus])

	useEffect(() => {
		if (!userPreferencesSaveStatus) {
			return undefined
		}
		const timer = setTimeout(() => setUserPreferencesSaveStatus(null), 4500)
		return () => clearTimeout(timer)
	}, [userPreferencesSaveStatus])

	const dragItem = useRef()
	const dragNode = useRef()
	const wsSyncSignatureRef = useRef("")

	// Sync Redux -> Local List
	useEffect(() => {
		if (workspaces) {
			const signature = JSON.stringify(
				(workspaces || []).map((ws) => ({
					id: ws?.id,
					name: ws?.name || ws?.title || "",
					is_public: !!ws?.is_public,
					is_locked: !!ws?.is_locked,
					collaboration_mode: ws?.collaboration_mode || "owner_only",
					audience_scope: ws?.audience_scope || "global",
					target_user_ids: ws?.target_user_ids || [],
					target_user_logins: ws?.target_user_logins || [],
					access_role: ws?.access_role || "",
				})),
			)
			if (signature !== wsSyncSignatureRef.current) {
				wsSyncSignatureRef.current = signature
				setWsList(workspaces)
			}
		}
	}, [workspaces])

	useEffect(() => {
		if (!CAN_MANAGE_OPTIONS) return
		const loadAccessPolicy = async () => {
			try {
				const res = await postAction("sd_get_access_policy")
				if (res?.success && res?.data?.policy) {
					setAccessPolicy(res.data.policy)
				}
			} catch (e) {}
		}
		loadAccessPolicy()
	}, [CAN_MANAGE_OPTIONS])

	// 4. Handlers

	// --- DRAG & DROP ---
	const handleDragStart = (e, item) => {
		dragItem.current = item
		dragNode.current = e.target
		e.dataTransfer.effectAllowed = "move"
		setDropTargetId("")
		setTimeout(() => setDragging(true), 0)
	}

	const handleDragEnter = (e, targetItem) => {
		if (dragNode.current !== e.target && dragItem.current) {
			const currentItem = dragItem.current
			if (currentItem.id === targetItem.id) return

			const newList = [...wsList]
			const dragIndex = newList.findIndex((i) => i.id === currentItem.id)
			const targetIndex = newList.findIndex((i) => i.id === targetItem.id)

			if (dragIndex === -1 || targetIndex === -1) return
			setDropTargetId(targetItem.id)

			newList.splice(dragIndex, 1)
			newList.splice(targetIndex, 0, currentItem)

			setWsList(newList)
		}
	}

	const handleDragEnd = () => {
		setDragging(false)
		setDropTargetId("")
		dragItem.current = null
		dragNode.current = null

		// Optimistic Update and Persist via Action Creator
		if (reorderWorkspaces) reorderWorkspaces(wsList)
	}

	// --- CREATE ---
	const handleCreate = async () => {
		if (!newTitle || !newTitle.trim()) return
		setIsLoading(true)

		try {
			await addWorkspace(newTitle)
			setNewTitle("")
			setIsCreating(false)
		} catch (e) {
			console.error(e)
			pushNotice("error", __("Error creating workspace.", "systemdeck"))
		} finally {
			setIsLoading(false)
		}
	}

	// --- DELETE ---
	const handleDelete = async (id) => {
		if (wsList.length <= 1) {
			pushNotice(
				"warning",
				__("Cannot delete the last workspace.", "systemdeck"),
			)
			return
		}
		requestConfirm({
			title: __("Delete Workspace", "systemdeck"),
			message: __(
				"Delete this workspace and its saved layouts? This action cannot be undone.",
				"systemdeck",
			),
			confirmLabel: __("Delete", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				try {
					await removeWorkspace(id)
					pushNotice(
						"success",
						__("Workspace deleted.", "systemdeck"),
					)
				} catch (e) {
					console.error(e)
					pushNotice("error", __("Delete failed.", "systemdeck"))
				}
			},
		})
	}

	// --- RENAME ---
	const startEditing = async (ws) => {
		setEditingId(ws.id)
		setEditTitle(ws.name || ws.title || "")
		if ((ws?.audience_scope || "global") === "targeted_users") {
			await handleFetchWorkspaceAudienceCandidates(
				ws.id,
				"",
				ws?.access_role || "administrator",
			)
		}
	}

	const handleRename = async (workspaceId = editingId, nextTitle = editTitle) => {
		if (!workspaceId || !nextTitle || !nextTitle.trim()) return false
		setIsLoading(true)

		try {
			await renameWorkspace(workspaceId, nextTitle)
			setEditTitle("")
			return true
		} catch (e) {
			console.error(e)
			pushNotice("error", __("Rename failed.", "systemdeck"))
			return false
		} finally {
			setIsLoading(false)
		}
	}

	// --- ACTIVATE ---
	const handleActivate = (id, openWorkspace = false) => {
		if (setActiveWorkspace) {
			setActiveWorkspace(id)
			localStorage.setItem("sd_active_workspace", id)
		}
		if (openWorkspace && setUIMode) {
			setUIMode("runtime")
		}
	}

	// --- REGISTRY ---
	const handleRegistryToggle = (widgetId, checked) => {
		setLocalEnablement((prev) => {
			const current = Array.isArray(prev) ? prev : []
			if (checked) {
				return Array.from(new Set([...current, widgetId]))
			}
			return current.filter((id) => id !== widgetId)
		})
	}

	const allWidgetIds = Object.values(registrySnapshot?.widgets || {}).map(
		(w) => w.id,
	)
	const isPickerVisibleInStandardWorkspace = (widget) => {
		if (typeof widget?.is_picker_visible === "boolean") {
			return widget.is_picker_visible
		}
		const policy = String(widget?.visibility_policy || "global")
		return policy === "global"
	}
	const visibleRegistryWidgets = Object.values(registrySnapshot?.widgets || {}).filter(
		(widget) => isPickerVisibleInStandardWorkspace(widget),
	)
	const visibleRegistryWidgetIds = visibleRegistryWidgets.map((widget) => widget.id)
	const isAllRegistryChecked =
		visibleRegistryWidgetIds.length > 0 &&
		visibleRegistryWidgetIds.every((id) => (registryEnablement || []).includes(id))

	const handleRegistrySelectAll = (e) => {
		if (e.target.checked) {
			setLocalEnablement((prev) =>
				Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...visibleRegistryWidgetIds])),
			)
		} else {
			setLocalEnablement((prev) =>
				(Array.isArray(prev) ? prev : []).filter(
					(id) => !visibleRegistryWidgetIds.includes(id),
				),
			)
		}
	}

	const handleSaveRegistry = async () => {
		setIsLoading(true)
		setRegistrySaveStatus(null)
		try {
			const res = await jQuery.post(getAjaxUrl(), {
				action: "sd_save_registry_state",
				nonce: getNonce(),
				enablement: registryEnablement,
			})
			if (res.success) {
				pushNotice(
					"success",
					__("Registry updated successfully.", "systemdeck"),
				)
				setRegistrySaveStatus({
					type: "success",
					message: __("Saved", "systemdeck"),
				})
				// Sync Redux
				if (dispatchSetRegistryEnablement) {
					dispatchSetRegistryEnablement(registryEnablement)
				}
				// Optional: update bootstrap so refreshes stay sync'd
				if (window.SYSTEMDECK_BOOTSTRAP?.config) {
					window.SYSTEMDECK_BOOTSTRAP.config.registry_enablement =
						registryEnablement
				}
			} else {
				const errorMessage =
					res.data?.message || __("Unknown error", "systemdeck")
				setRegistrySaveStatus({
					type: "error",
					message: errorMessage,
				})
				pushNotice(
					"error",
					__("Save failed:", "systemdeck") + " " + errorMessage,
				)
			}
		} catch (e) {
			console.error(e)
			setRegistrySaveStatus({
				type: "error",
				message: __("Save failed", "systemdeck"),
			})
			pushNotice(
				"error",
				__("Error saving registry settings.", "systemdeck"),
			)
		} finally {
			setIsLoading(false)
		}
	}

	const handleRebuildRegistrySnapshot = async () => {
		requestConfirm({
			title: __("Rebuild Registry Snapshot", "systemdeck"),
			message: __(
				"Rebuild the widget registry snapshot now? This can take a moment on larger installs.",
				"systemdeck",
			),
			confirmLabel: __("Rebuild", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				setIsLoading(true)
				try {
					const res = await jQuery.post(getAjaxUrl(), {
						action: "sd_rebuild_registry_snapshot",
						nonce: getNonce(),
					})

					if (res?.success) {
						const snapshotCount =
							Number(res?.data?.snapshot_widget_count || res?.data?.count || 0)
						const liveCount = Number(res?.data?.live_dashboard_widget_count || 0)
						const scannerCount = Number(res?.data?.scanner_cache_refresh_count || 0)
						pushNotice(
							"success",
							__(
								"Registry rebuilt. Snapshot: ",
								"systemdeck",
							) +
								String(snapshotCount) +
								__(" | Live dashboard: ", "systemdeck") +
								String(liveCount) +
								__(" | Scanner cache: ", "systemdeck") +
								String(scannerCount) +
								__(". Reloading to apply updates...", "systemdeck"),
						)
						window.location.reload()
						return
					}

					pushNotice(
						"error",
						__("Snapshot rebuild failed:", "systemdeck") +
							" " +
							(res?.data?.message ||
								__("Unknown error", "systemdeck")),
					)
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Error rebuilding registry snapshot.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	const handlePublishTemplate = async (workspaceId) => {
		setIsLoading(true)
		try {
			const res = await postAction("sd_publish_workspace_template", {
				workspace_id: workspaceId,
			})
			if (!res?.success) {
				pushNotice(
					"error",
					__("Publish failed:", "systemdeck") +
						" " +
						(res?.data?.message ||
							__("Unknown error", "systemdeck")),
				)
				return
			}
			pushNotice(
				"success",
				__("Workspace template published.", "systemdeck"),
			)
			setTemplateStatus((prev) => ({
				...prev,
				[workspaceId]: {
					lastMessage: `Published v${res?.data?.version || 1}`,
					hasUpdate: false,
				},
			}))
		} catch (e) {
			console.error(e)
			pushNotice("error", __("Error publishing template.", "systemdeck"))
		} finally {
			setIsLoading(false)
		}
	}

	const handleResetToSource = async (workspaceId) => {
		requestConfirm({
			title: __("Reset Workspace To Source", "systemdeck"),
			message: __(
				"Reset this workspace to the latest shared source version? Local edits in this workspace will be replaced.",
				"systemdeck",
			),
			confirmLabel: __("Reset", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				setIsLoading(true)
				try {
					const res = await postAction(
						"sd_reset_workspace_to_source",
						{
							workspace_id: workspaceId,
						},
					)
					if (!res?.success) {
						pushNotice(
							"error",
							__("Reset failed:", "systemdeck") +
								" " +
								(res?.data?.message ||
									__("Unknown error", "systemdeck")),
						)
						return
					}
					pushNotice(
						"success",
						__("Workspace reset to source.", "systemdeck"),
					)
					setTemplateStatus((prev) => ({
						...prev,
						[workspaceId]: {
							lastMessage: `Reset to v${res?.data?.version || 1}`,
							hasUpdate: false,
						},
					}))
					window.location.reload()
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Error resetting workspace.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	const handleCheckUpdate = async (workspaceId) => {
		setIsLoading(true)
		try {
			const res = await postAction("sd_check_workspace_update", {
				workspace_id: workspaceId,
			})
			if (!res?.success) {
				pushNotice(
					"error",
					__("Check failed:", "systemdeck") +
						" " +
						(res?.data?.message ||
							__("Unknown error", "systemdeck")),
				)
				return
			}
			setTemplateStatus((prev) => ({
				...prev,
				[workspaceId]: {
					lastMessage: res?.data?.has_update
						? `Update available: v${res?.data?.version_latest || 0}`
						: "Workspace is up to date",
					hasUpdate: !!res?.data?.has_update,
				},
			}))
		} catch (e) {
			console.error(e)
			pushNotice(
				"error",
				__("Error checking template update.", "systemdeck"),
			)
		} finally {
			setIsLoading(false)
		}
	}

	const handleClearCache = (type) => {
		const isSitewide = type === "object" || type === "all_sitewide"
		const message = isSitewide
			? __(
					"This action is site-wide and can affect all caches. Proceed?",
					"systemdeck",
			  )
			: __("Proceed with cache cleanup for this target?", "systemdeck")
		requestConfirm({
			title: __("Clear System Cache", "systemdeck"),
			message,
			confirmLabel: __("Run Cleanup", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				setIsLoading(true)
				try {
					const res = await postAction("sd_clear_cache", { type })
					if (res?.success) {
						pushNotice(
							"success",
							res?.data?.message ||
								__("Cleanup completed.", "systemdeck"),
						)
						triggerPixiHudRefresh()
					} else {
						pushNotice(
							"error",
							__("Cleanup failed:", "systemdeck") +
								" " +
								(res?.data?.message ||
									__("Unknown error", "systemdeck")),
						)
					}
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Cleanup request failed.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	const triggerPixiHudRefresh = () => {
		const hud = window.SystemDeckPixiHUD
		if (!hud || typeof hud.refreshAll !== "function") {
			return
		}

		if (typeof hud.scheduleRefreshAll === "function") {
			hud.scheduleRefreshAll()
		} else {
			hud.refreshAll()
		}
	}

	const handleResetViewMemory = () => {
		requestConfirm({
			title: __("Reset View Memory", "systemdeck"),
			message: __(
				"Reset saved page/workspace memory and return to default workspace runtime?",
				"systemdeck",
			),
			confirmLabel: __("Reset Memory", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: () => {
				try {
					localStorage.removeItem("sd_ui_mode")
					localStorage.removeItem("sd_active_workspace")
					localStorage.removeItem("sd_dock_state")
					localStorage.removeItem("sd_last_dock")
					if (setActiveWorkspace) {
						setActiveWorkspace("default")
					}
					if (setUIMode) {
						setUIMode("discovery")
					}
					if (
						window.SystemDeck &&
						typeof window.SystemDeck.getDefaultDock === "function" &&
						typeof window.SystemDeck.switchDock === "function"
					) {
						window.SystemDeck.switchDock(
							window.SystemDeck.getDefaultDock(),
						)
					}
					pushNotice(
						"success",
						__("View memory reset.", "systemdeck"),
					)
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Failed to reset view memory.", "systemdeck"),
					)
				}
			},
		})
	}

	const handleRefreshPixiHud = () => {
		requestConfirm({
			title: __("Clear SD HUD", "systemdeck"),
			message: __(
				"Clear the Pixi HUD cache and redraw all HUD engines with the latest theme colors?",
				"systemdeck",
			),
			confirmLabel: __("Clear HUD", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: () => {
				try {
					const hud = window.SystemDeckPixiHUD
					if (!hud || typeof hud.refreshAll !== "function") {
						pushNotice(
							"error",
							__("Pixi HUD refresh is unavailable.", "systemdeck"),
						)
						return
					}

					triggerPixiHudRefresh()
					pushNotice("success", __("SD HUD cleared.", "systemdeck"))
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Failed to clear SD HUD.", "systemdeck"),
					)
				}
			},
		})
	}

	const handleSweepOrphans = () => {
		requestConfirm({
			title: __("Clear Orphaned Data", "systemdeck"),
			message: __(
				"Run orphan sweep now? This removes stale Note/Vault projections and deletes orphaned app workspaces whose app plugin is no longer registered.",
				"systemdeck",
			),
			confirmLabel: __("Sweep System", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				setIsLoading(true)
				try {
					const res = await postAction("sd_sweep_orphans", {})
					if (res?.success) {
						pushNotice(
							"success",
							res?.data?.message || __("Sweep complete.", "systemdeck"),
						)
					} else {
						pushNotice(
							"error",
							__("Sweep failed: ", "systemdeck") +
								(res?.data?.message || __("Unknown error", "systemdeck")),
						)
					}
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Sweep request failed.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	const handlePurgeWidgets = () => {
		requestConfirm({
			title: __("Purge Widgets", "systemdeck"),
			message: __(
				"Purge all discovered/dashboard widgets from SystemDeck registry cache now? Core widgets remain. You can repopulate by running Rebuild Registry Snapshot or Widget Scanner.",
				"systemdeck",
			),
			confirmLabel: __("Purge Widgets", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				setIsLoading(true)
				try {
					const res = await postAction("sd_purge_widgets", {})
					if (res?.success) {
						pushNotice(
							"success",
							res?.data?.message || __("Widget purge complete.", "systemdeck"),
						)
						window.location.reload()
						return
					}
					pushNotice(
						"error",
						__("Widget purge failed:", "systemdeck") +
							" " +
							(res?.data?.message || __("Unknown error", "systemdeck")),
					)
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Error purging widgets.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	const handleExportWorkspaces = () => {
		requestConfirm({
			title: __("Export Workspaces", "systemdeck"),
			message: __(
				"Download your current SystemDeck workspace export now?",
				"systemdeck",
			),
			confirmLabel: __("Export", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: () => {
				try {
					const form = document.createElement("form")
					form.method = "POST"
					form.action = getAjaxUrl()
					form.style.display = "none"

					const addField = (name, value) => {
						const input = document.createElement("input")
						input.type = "hidden"
						input.name = name
						input.value = value
						form.appendChild(input)
					}

					addField("action", "sd_export_workspaces")
					addField("nonce", getNonce())

					document.body.appendChild(form)
					form.submit()
					document.body.removeChild(form)
					pushNotice("success", __("Export started.", "systemdeck"))
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Export failed to start.", "systemdeck"),
					)
				}
			},
		})
	}

	const handleImportFile = async (event) => {
		const file = event?.target?.files?.[0]
		if (!file) {
			return
		}
		try {
			const text = await file.text()
			setImportPayload(text)
			setImportFileName(file.name || __("selected file", "systemdeck"))
			pushNotice("success", __("Import file loaded.", "systemdeck"))
		} catch (e) {
			console.error(e)
			pushNotice("error", __("Could not read import file.", "systemdeck"))
		}
	}

	const handleImportWorkspaces = () => {
		requestConfirm({
			title: __("Import Workspaces", "systemdeck"),
			message: __(
				"Import workspace data from the loaded JSON file? Existing workspace IDs are skipped.",
				"systemdeck",
			),
			confirmLabel: __("Import", "systemdeck"),
			cancelLabel: __("Cancel", "systemdeck"),
			onConfirm: async () => {
				if (!importPayload.trim()) {
					pushNotice(
						"warning",
						__("Load an export JSON file first.", "systemdeck"),
					)
					return
				}

				setIsLoading(true)
				try {
					JSON.parse(importPayload)
				} catch (e) {
					pushNotice(
						"error",
						__("Import JSON is invalid.", "systemdeck"),
					)
					setIsLoading(false)
					return
				}

				try {
					const res = await postAction("sd_import_workspaces", {
						data: importPayload,
					})
					if (res?.success) {
						pushNotice(
							"success",
							res?.data?.message ||
								__("Import completed.", "systemdeck"),
						)
						window.location.reload()
						return
					}
					pushNotice(
						"error",
						__("Import failed:", "systemdeck") +
							" " +
							(res?.data?.message ||
								__("Unknown error", "systemdeck")),
					)
				} catch (e) {
					console.error(e)
					pushNotice(
						"error",
						__("Import request failed.", "systemdeck"),
					)
				} finally {
					setIsLoading(false)
				}
			},
		})
	}

	// 5. Render
	const adminUrl = window.sd_vars?.admin_url || "/wp-admin/"
	const iframeUrl = `${adminUrl}admin.php?page=systemdeck&sd_embed=1`
	const pageManagementLinks = [
		{
			href: `${adminUrl}edit.php?post_type=systemdeck_canvas`,
			label: __("Canvas Post", "systemdeck"),
		},
		{
			href: `${adminUrl}edit.php?post_type=sd_note`,
			label: __("Notes Post", "systemdeck"),
		},
		{
			href: `${adminUrl}edit.php?post_type=sd_vault_file`,
			label: __("Vault Post", "systemdeck"),
		},
		{
			href: `${adminUrl}admin.php?page=systemdeck`,
			label: __("Widget Scanner", "systemdeck"),
		},
		{
			href: `${adminUrl}admin.php?page=sd-hud-atlas`,
			label: __("HUD Atlas", "systemdeck"),
		},
	]
	const currentUserId = Number(
		window.SYSTEMDECK_BOOTSTRAP?.config?.user?.id || 0,
	)
	const appWorkspaceIds = new Set(
		(wsList || [])
			.filter((ws) => ws?.is_app_workspace || ws?.app_id)
			.map((ws) => String(ws?.id || "")),
	)
	const activeAppWorkspaceIds = new Set(
		APP_MANIFESTS.map((app) => String(app?.workspaceId || "")).filter(Boolean),
	)
	const activeAppIds = new Set(
		APP_MANIFESTS.map((app) => String(app?.id || "")).filter(Boolean),
	)
	const visibleWorkspaceCards = CAN_VIEW_WORKSPACES
		? (wsList || []).filter(
				(ws) =>
					ws &&
					ws.id &&
					ws.id !== "undefined" &&
					!(
						(
							// Keep active app workspaces in the App section; surface orphaned app
							// workspaces in the normal list so admins can manage/delete them.
							appWorkspaceIds.has(String(ws.id || "")) &&
							(
								activeAppWorkspaceIds.has(String(ws.id || "")) ||
								(!!ws?.app_id && activeAppIds.has(String(ws.app_id || "")))
							)
						) ||
						!!ws?.show_top_level_menu
					) &&
					!(
						ws?.is_public &&
						ws?.is_locked &&
						Number(ws?.cpt_author_id || 0) !== currentUserId
					),
		  )
		: []
	const appCards = APP_MANIFESTS.map((app) => {
		const workspace = (wsList || []).find((ws) => String(ws?.id || "") === String(app.workspaceId || ""))
		const widgetCount = workspace ? getWorkspaceWidgetCount(workspace) : 0
		return {
			...app,
			workspace,
			widgetCount,
		}
	})
	const ROLE_OPTIONS = [
		"administrator",
		"editor",
		"author",
		"contributor",
		"subscriber",
	]

	const openAppEditor = async (app) => {
		const ws = app?.workspace
		if (!ws?.id) return
		const accessRole = getWorkspaceAccessRole(ws)
		const seed = {
			title: ws?.name || ws?.title || app.title,
			is_public: !!ws?.is_public,
			is_locked: !!ws?.is_locked,
			collaboration_mode: ws?.collaboration_mode === "collaborative" ? "collaborative" : "owner_only",
			access_role: accessRole,
			audience_scope: ws?.audience_scope === "targeted_users" ? "targeted_users" : "global",
			target_user_ids: Array.isArray(ws?.target_user_ids) ? ws.target_user_ids.map((id) => Number(id)) : [],
			show_top_level_menu: !!ws?.show_top_level_menu,
			menu_icon: ws?.menu_icon || "dashicons-screenoptions",
		}
		setAppDraftById((prev) => ({ ...prev, [ws.id]: seed }))
		setAppEditingId(ws.id)
		if (seed.audience_scope === "targeted_users") {
			await handleFetchWorkspaceAudienceCandidates(ws.id, "", seed.access_role)
		}
	}

	const handleSaveAppSettings = async (app) => {
		const ws = app?.workspace
		if (!ws?.id) return
		const draft = appDraftById?.[ws.id]
		if (!draft) return
		setAppSavingId(ws.id)
		try {
			const original = {
				title: ws?.name || ws?.title || "",
				is_public: !!ws?.is_public,
				is_locked: !!ws?.is_locked,
				collaboration_mode:
					ws?.collaboration_mode === "collaborative" ? "collaborative" : "owner_only",
				access_role: getWorkspaceAccessRole(ws),
				audience_scope: ws?.audience_scope === "targeted_users" ? "targeted_users" : "global",
				target_user_ids: Array.isArray(ws?.target_user_ids) ? ws.target_user_ids.map((id) => Number(id)) : [],
				show_top_level_menu: !!ws?.show_top_level_menu,
				menu_icon: ws?.menu_icon || "dashicons-screenoptions",
			}

			if ((draft.title || "").trim() && (draft.title || "").trim() !== original.title) {
				const renamed = await handleRename(ws.id, draft.title)
				if (!renamed) return
			}

			if (draft.is_public !== original.is_public || draft.is_locked !== original.is_locked) {
				const vis = await handleSetWorkspaceVisibility(ws.id, !!draft.is_public, !!draft.is_locked)
				if (!vis) return
			}

			if ((draft.collaboration_mode || "owner_only") !== original.collaboration_mode) {
				const collab = await handleSetCollaborationMode(ws.id, draft.collaboration_mode || "owner_only")
				if (!collab) return
			}

			if ((draft.access_role || "administrator") !== original.access_role) {
				const access = await handleSetAccessRole(ws.id, draft.access_role || "administrator")
				if (!access) return
			}

			const draftAudienceIds =
				draft.audience_scope === "targeted_users" ? (draft.target_user_ids || []).map((id) => Number(id)).sort((a, b) => a - b) : []
			const originalAudienceIds =
				original.audience_scope === "targeted_users" ? (original.target_user_ids || []).map((id) => Number(id)).sort((a, b) => a - b) : []
			const audienceChanged =
				(draft.audience_scope || "global") !== original.audience_scope ||
				draftAudienceIds.length !== originalAudienceIds.length ||
				draftAudienceIds.some((id, idx) => id !== originalAudienceIds[idx])

			if (audienceChanged) {
				const audience = await handleSetWorkspaceAudience(
					ws.id,
					draft.audience_scope || "global",
					"",
					draft.audience_scope === "targeted_users" ? (draft.target_user_ids || []) : [],
				)
				if (!audience) return
			}

			const menuChanged =
				!!draft.show_top_level_menu !== original.show_top_level_menu ||
				(draft.menu_icon || "dashicons-screenoptions") !== original.menu_icon
			if (menuChanged) {
				const menu = await handleSetWorkspaceAppMenu(
					ws.id,
					!!draft.show_top_level_menu,
					draft.menu_icon || "dashicons-screenoptions",
				)
				if (!menu) return
			}
			pushNotice("success", __("App settings updated.", "systemdeck"))
			setAppEditingId("")
		} finally {
			setAppSavingId("")
		}
	}
	return (
		<div className='sd-discovery-canvas'>
			{confirmNode}
			{isLoading && (
				<div className='sd-discovery-canvas__loading' aria-live='polite' aria-busy='true'>
					<div className='sd-discovery-canvas__loading-card'>
						<Spinner />
						<span>{__("Working...", "systemdeck")}</span>
					</div>
				</div>
			)}
			{/* 1. Header Section */}
			<div className='sd-canvas-header'>
				<h2 className='wp-heading-inline'>
					{__("SystemDeck", "systemdeck")}
				</h2>
				<hr className='wp-header-end' />
				{window.sd_vars?.logoSvg && (
					<div
						className='sd-canvas-header__logo'
						dangerouslySetInnerHTML={{
							__html: window.sd_vars.logoSvg,
						}}
					/>
				)}
			</div>

			<WorkspaceGridSection
				canViewWorkspaces={CAN_VIEW_WORKSPACES}
				canManageWorkspaces={CAN_MANAGE_WORKSPACES}
				canManageOptions={CAN_MANAGE_OPTIONS}
				workspaceCards={visibleWorkspaceCards}
				activeId={activeId}
				editingId={editingId}
				isLoading={isLoading}
				dragging={dragging}
				dropTargetId={dropTargetId}
				dragItemRef={dragItem}
				currentUserId={currentUserId}
				accessPolicyRoleOptions={ACCESS_POLICY_ROLE_OPTIONS}
				onDragStart={handleDragStart}
				onDragEnter={handleDragEnter}
				onDragEnd={handleDragEnd}
				onActivate={handleActivate}
				onStartEditing={startEditing}
				onDelete={handleDelete}
				onRename={handleRename}
				onCancelRename={() => setEditingId(null)}
				onSetWorkspaceVisibility={handleSetWorkspaceVisibility}
				onSetCollaborationMode={handleSetCollaborationMode}
				onSetWorkspaceAudience={handleSetWorkspaceAudience}
				onFetchWorkspaceAudienceCandidates={
					handleFetchWorkspaceAudienceCandidates
				}
				onSetAccessRole={handleSetAccessRole}
				getWorkspaceAccessRole={getWorkspaceAccessRole}
				getWorkspaceWidgetCount={getWorkspaceWidgetCount}
				getWorkspaceCreatedLabel={getWorkspaceCreatedLabel}
				getWorkspaceAuthorLabel={getWorkspaceAuthorLabel}
				getWorkspaceAudienceCandidates={getWorkspaceAudienceCandidates}
				isCreating={isCreating}
				newTitle={newTitle}
				onStartCreate={() => setIsCreating(true)}
				onCancelCreate={() => {
					setIsCreating(false)
					setNewTitle("")
				}}
				onCreate={handleCreate}
				onSetNewTitle={setNewTitle}
				adminUrl={adminUrl}
			/>

			{/* 3. System Configuration Divider */}
			<div className='sd-section-header'>
				<h3 className='wp-heading-inline'>
					{__("System Configuration", "systemdeck")}
				</h3>
			</div>

			{/* 4. Configuration Panel with Tabs */}
			<div className='sd-config-container'>
				<TabPanel
					className='sd-settings-tabs'
					activeClass='is-active'
					tabs={[
						{
							name: "welcome",
							title: (
								<div className='sd-tab-title'>
									<Icon icon='admin-home' />
									<span>{__("Welcome", "systemdeck")}</span>
								</div>
							),
						},
						SHOW_SCANNER_TAB
							? {
									name: "scanner",
									title: (
										<div className='sd-tab-title'>
											<Icon icon='search' />
											<span>
												{__(
													"Widget Scanner",
													"systemdeck",
												)}
											</span>
										</div>
									),
							  }
							: null,
						CAN_MANAGE_OPTIONS
							? {
									name: "apps",
									title: (
										<div className='sd-tab-title'>
											<Icon icon='screenoptions' />
											<span>{__("Apps", "systemdeck")}</span>
										</div>
									),
							  }
							: null,
						CAN_MANAGE_OPTIONS
							? {
									name: "registry",
									title: (
										<div className='sd-tab-title'>
											<Icon icon='grid-view' />
											<span>
												{__(
													"Widget Registry",
													"systemdeck",
												)}
											</span>
										</div>
									),
							  }
							: null,
						{
							name: "tools",
							title: (
								<div className='sd-tab-title'>
									<Icon icon='admin-tools' />
									<span>{__("Tools", "systemdeck")}</span>
								</div>
							),
						},
						CAN_MANAGE_WORKSPACES || CAN_MANAGE_OPTIONS
							? {
									name: "import",
									title: (
										<div className='sd-tab-title'>
											<Icon icon='migrate' />
											<span>
												{__(
													"Import / Export",
													"systemdeck",
												)}
											</span>
										</div>
									),
							  }
							: null,
						{
							name: "help",
							title: (
								<div className='sd-tab-title'>
									<Icon icon='editor-help' />
									<span>{__("Help", "systemdeck")}</span>
								</div>
							),
						},
					].filter(Boolean)}>
					{(tab) => (
						<div className='sd-tab-content'>
							{tab.name === "welcome" && (
								<div className='sd-placeholder-tab'>
									<h3>
										{__(
											"Welcome to SystemDeck ",
											"systemdeck",
										)}
										{window.sd_vars?.user?.name || "walker"}
										!
									</h3>
									<p>
										{__(
											"Last Login: February 13, 2026 3:24 am",
											"systemdeck",
										)}
										<br />
										{__(
											"IP Address: 172.172.0.1",
											"systemdeck",
										)}
									</p>
								</div>
							)}
							{tab.name === "scanner" && (
								<div className='sd-scanner-tab'>
									<iframe
										src={iframeUrl}
										className='sd-scanner-frame'
										title='SystemDeck Scanner'
									/>
								</div>
							)}
							{tab.name === "registry" && (
								<div className='sd-registry-tab'>
									<div className='sd-registry-header'>
										<p className='description'>
											{__(
												"Enable or disable widgets globally. If a widget is already added to a workspace, it will remain visible there even if disabled below.",
												"systemdeck",
											)}
										</p>
									</div>
									<table className='wp-list-table widefat fixed striped sd-registry-table'>
										<thead>
											<tr>
												<td className='manage-column column-cb sd-check-column'>
													<input
														type='checkbox'
														aria-label='Select all widgets'
														checked={
															isAllRegistryChecked
														}
														onChange={
															handleRegistrySelectAll
														}
													/>
												</td>
												<th
													scope='col'
													className='manage-column column-primary'>
													<span>
														{__(
															"Widget Title",
															"systemdeck",
														)}
													</span>
												</th>
												<th
													scope='col'
													className='manage-column'>
													<span>
														{__(
															"Widget ID",
															"systemdeck",
														)}
													</span>
												</th>
											</tr>
										</thead>
										<tbody>
											{visibleRegistryWidgets.map((widget) => {
												const checked = (
													registryEnablement || []
												).includes(widget.id)
												return (
													<tr key={widget.id}>
														<th
															scope='row'
															className='sd-check-column'>
															<input
																type='checkbox'
																checked={
																	checked
																}
																onChange={(e) =>
																	handleRegistryToggle(
																		widget.id,
																		e.target
																			.checked,
																	)
																}
															/>
														</th>
														<td className='column-primary'>
															<strong>
																{widget.title}
															</strong>
														</td>
														<td>
															<code className='sd-registry-widget-id'>
																{widget.id}
															</code>
														</td>
													</tr>
												)
											})}
										</tbody>
										<tfoot>
											<tr>
												<td className='manage-column column-cb sd-check-column'>
													<input
														type='checkbox'
														aria-label='Select all widgets'
														checked={
															isAllRegistryChecked
														}
														onChange={
															handleRegistrySelectAll
														}
													/>
												</td>
												<th
													scope='col'
													className='manage-column column-primary'>
													<span>
														{__(
															"Widget Title",
															"systemdeck",
														)}
													</span>
												</th>
												<th
													scope='col'
													className='manage-column'>
													<span>
														{__(
															"Widget ID",
															"systemdeck",
														)}
													</span>
												</th>
											</tr>
										</tfoot>
									</table>
									<div className='actions sd-registry-actions sd-registry-actions--spacious'>
										<button
											type='button'
											className='button button-secondary'
											onClick={
												handleRebuildRegistrySnapshot
											}
											disabled={isLoading}>
											{__(
												"Rebuild Snapshot",
												"systemdeck",
											)}
										</button>
										<button
											type='button'
											className='button button-primary'
											onClick={handleSaveRegistry}
											disabled={isLoading}>
											{__("Save Changes", "systemdeck")}
										</button>
										{registrySaveStatus ? (
											<span
												className={`sd-inline-status ${
													registrySaveStatus.type ===
													"success"
														? "is-success"
														: "is-error"
												}`}>
												{registrySaveStatus.message}
											</span>
										) : null}
									</div>
								</div>
							)}
							{tab.name === "apps" && (
								<div className='sd-registry-tab'>
									<div className='sd-registry-header'>
										<p className='description'>
											{__(
												"Apps are isolated runtime surfaces. App root widgets are hidden from normal workspace/widget flows.",
												"systemdeck",
											)}
										</p>
									</div>
									<table className='wp-list-table widefat fixed striped sd-registry-table'>
										<thead>
											<tr>
												<th scope='col' className='manage-column column-primary'>
													{__("App", "systemdeck")}
												</th>
												<th scope='col' className='manage-column'>
													{__("App ID", "systemdeck")}
												</th>
												<th scope='col' className='manage-column'>
													{__("Workspace", "systemdeck")}
												</th>
												<th scope='col' className='manage-column'>
													{__("Actions", "systemdeck")}
												</th>
											</tr>
										</thead>
										<tbody>
											{appCards.map((app) => (
												<Fragment key={app.id}>
												<tr>
													<td className='column-primary'>
														<strong>{app.title}</strong>
														<div className='description'>
															{app.widgetCount} {__("widgets", "systemdeck")}
														</div>
													</td>
													<td>
														<code className='sd-registry-widget-id'>{app.id}</code>
													</td>
													<td>
														<code className='sd-registry-widget-id'>{app.workspaceId}</code>
													</td>
													<td>
														<button
															type='button'
															className='button button-secondary'
															onClick={() =>
																app.workspaceId
																	? handleActivate(app.workspaceId, true)
																	: null
															}
															disabled={isLoading || !app.workspaceId}>
															{__("Open App", "systemdeck")}
														</button>
														<button
															type='button'
															className='button button-link'
															onClick={() =>
																appEditingId === app.workspaceId
																	? setAppEditingId("")
																	: openAppEditor(app)
															}
															disabled={isLoading || !app.workspace}>
															{appEditingId === app.workspaceId
																? __("Close Settings", "systemdeck")
																: __("App Settings", "systemdeck")}
														</button>
													</td>
												</tr>
												{appEditingId === app.workspaceId && app.workspace ? (
													<tr>
														<td colSpan={4}>
															<div className='sd-workspace-card__edit-panel'>
																<div className='sd-workspace-card__edit-grid'>
																	<div className='sd-workspace-card__section'>
																		<h4 className='sd-workspace-card__section-title'>{__("Workspace", "systemdeck")}</h4>
																		<label className='sd-workspace-card__field'>
																			<span className='sd-workspace-card__field-label'>{__("Workspace Name", "systemdeck")}</span>
																			<input
																				className='sd-workspace-card__input'
																				type='text'
																				value={appDraftById?.[app.workspaceId]?.title || ""}
																				onChange={(e) =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							title: e.target.value,
																						},
																					}))
																				}
																			/>
																		</label>
																		<div className='sd-workspace-card__switch-row'>
																			<FormToggle
																				checked={!!appDraftById?.[app.workspaceId]?.is_public}
																				onChange={() =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							is_public: !prev?.[app.workspaceId]?.is_public,
																						},
																					}))
																				}
																			/>
																			<span>{__("Public Workspace", "systemdeck")}</span>
																		</div>
																		<div className='sd-workspace-card__switch-row'>
																			<FormToggle
																				checked={!!appDraftById?.[app.workspaceId]?.is_locked}
																				onChange={() =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							is_locked: !prev?.[app.workspaceId]?.is_locked,
																						},
																					}))
																				}
																			/>
																			<span>{__("Locked", "systemdeck")}</span>
																		</div>
																		<div className='sd-workspace-card__switch-row'>
																			<FormToggle
																				checked={appDraftById?.[app.workspaceId]?.collaboration_mode === "collaborative"}
																				onChange={() =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							collaboration_mode:
																								prev?.[app.workspaceId]?.collaboration_mode === "collaborative"
																									? "owner_only"
																									: "collaborative",
																						},
																					}))
																				}
																			/>
																			<span>{__("Collaborative", "systemdeck")}</span>
																		</div>
																	</div>
																	<div className='sd-workspace-card__section'>
																		<h4 className='sd-workspace-card__section-title'>{__("Access", "systemdeck")}</h4>
																		<label className='sd-workspace-card__field'>
																			<span className='sd-workspace-card__field-label'>{__("Minimum Role", "systemdeck")}</span>
																			<select
																				className='sd-workspace-card__select'
																				value={appDraftById?.[app.workspaceId]?.access_role || "administrator"}
																				onChange={(e) =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							access_role: e.target.value,
																						},
																					}))
																				}>
																				{ROLE_OPTIONS.map((role) => (
																					<option key={role} value={role}>
																						{role.charAt(0).toUpperCase() + role.slice(1)}
																					</option>
																				))}
																			</select>
																		</label>
																		<label className='sd-workspace-card__field'>
																			<span className='sd-workspace-card__field-label'>{__("Audience Scope", "systemdeck")}</span>
																			<select
																				className='sd-workspace-card__select'
																				value={appDraftById?.[app.workspaceId]?.audience_scope || "global"}
																				onChange={(e) =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							audience_scope: e.target.value,
																						},
																					}))
																				}>
																				<option value='global'>{__("Global", "systemdeck")}</option>
																				<option value='targeted_users'>{__("Targeted Users", "systemdeck")}</option>
																			</select>
																		</label>
																		{appDraftById?.[app.workspaceId]?.audience_scope === "targeted_users" ? (
																			<div className='sd-workspace-card__audience-picker'>
																				{(getWorkspaceAudienceCandidates(app.workspace) || []).map((candidate) => {
																					const cid = Number(candidate?.id || 0)
																					const selected = (appDraftById?.[app.workspaceId]?.target_user_ids || []).includes(cid)
																					return (
																						<label key={cid} className='sd-workspace-card__audience-option'>
																							<input
																								type='checkbox'
																								checked={selected}
																								onChange={(e) =>
																									setAppDraftById((prev) => ({
																										...prev,
																										[app.workspaceId]: {
																											...(prev?.[app.workspaceId] || {}),
																											target_user_ids: e.target.checked
																												? [...new Set([...(prev?.[app.workspaceId]?.target_user_ids || []), cid])]
																												: (prev?.[app.workspaceId]?.target_user_ids || []).filter((id) => Number(id) !== cid),
																										},
																									}))
																								}
																							/>
																							<span>{candidate?.label || candidate?.login || `#${cid}`}</span>
																						</label>
																					)
																				})}
																			</div>
																		) : null}
																	</div>
																	<div className='sd-workspace-card__section'>
																		<h4 className='sd-workspace-card__section-title'>{__("App Navigation", "systemdeck")}</h4>
																		<div className='sd-workspace-card__switch-row'>
																			<FormToggle
																				checked={!!appDraftById?.[app.workspaceId]?.show_top_level_menu}
																				onChange={() =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							show_top_level_menu: !prev?.[app.workspaceId]?.show_top_level_menu,
																						},
																					}))
																				}
																			/>
																			<span>{__("Show Top-Level Menu Link", "systemdeck")}</span>
																		</div>
																		<label className='sd-workspace-card__field'>
																			<span className='sd-workspace-card__field-label'>{__("Menu Icon Class", "systemdeck")}</span>
																			<input
																				className='sd-workspace-card__input'
																				type='text'
																				value={appDraftById?.[app.workspaceId]?.menu_icon || ""}
																				onChange={(e) =>
																					setAppDraftById((prev) => ({
																						...prev,
																						[app.workspaceId]: {
																							...(prev?.[app.workspaceId] || {}),
																							menu_icon: e.target.value,
																						},
																					}))
																				}
																				placeholder='dashicons-games'
																			/>
																		</label>
																	</div>
																</div>
																<div className='sd-workspace-card__footer'>
																	<div className='sd-workspace-card__footer-actions'>
																		<button
																			type='button'
																			className='button button-primary'
																			onClick={() => handleSaveAppSettings(app)}
																			disabled={isLoading || appSavingId === app.workspaceId}>
																			{__("Save Changes", "systemdeck")}
																		</button>
																		<button
																			type='button'
																			className='button button-secondary'
																			onClick={() => setAppEditingId("")}
																			disabled={isLoading || appSavingId === app.workspaceId}>
																			{__("Cancel", "systemdeck")}
																		</button>
																	</div>
																</div>
															</div>
														</td>
													</tr>
												) : null}
												</Fragment>
											))}
										</tbody>
									</table>
								</div>
							)}
							{
								tab.name === "import" && (
									<div className='sd-placeholder-tab'>
										<p className='description'>
											{__(
												"Export your current workspace bundle or import from a prior SystemDeck export file.",
												"systemdeck",
											)}
										</p>
										<table
											className='form-table'
											role='presentation'>
											<tbody>
												<tr>
													<th scope='row'>
														{__(
															"Export",
															"systemdeck",
														)}
													</th>
													<td>
														<button
															type='button'
															className='button button-primary'
															onClick={
																handleExportWorkspaces
															}
															disabled={
																isLoading
															}>
															{__(
																"Export Workspaces",
																"systemdeck",
															)}
														</button>
														<p className='description sd-description--top-gap-sm'>
															{__(
																"Download a complete backup of all workspaces and widget layouts.",
																"systemdeck",
															)}
														</p>
													</td>
												</tr>
												<tr>
													<th scope='row'>
														{__(
															"Import",
															"systemdeck",
														)}
													</th>
													<td>
														<div className='sd-import-row'>
															<label className='button button-secondary'>
																{__(
																	"Choose Import File",
																	"systemdeck",
																)}
																<input
																	type='file'
																	accept='application/json,.json'
																	onChange={
																		handleImportFile
																	}
																	className='sd-import-file-input'
																/>
															</label>
															{importFileName ? (
																<span className='sd-inline-status is-success'>
																	{
																		importFileName
																	}
																</span>
															) : null}
															<button
																type='button'
																className='button button-primary'
																onClick={
																	handleImportWorkspaces
																}
																disabled={
																	isLoading ||
																	!importPayload.trim()
																}>
																{__(
																	"Import Workspaces",
																	"systemdeck",
																)}
															</button>
														</div>
														<p className='description sd-description--top-gap-md'>
															{__(
																"Restore workspaces from a previously exported JSON backup file.",
																"systemdeck",
															)}
														</p>
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								) /* Placeholder for now */
							}
							{
								tab.name === "help" && (
									<div className='sd-placeholder-tab'>
										<p>
											{__("Documentation coming soon.")}
										</p>
									</div>
								) /* Placeholder for now */
							}
							{tab.name === "tools" && (
								<div className='sd-placeholder-tab'>
									<div className='sd-tools-wrapper'>
										{/* Maintenance section — Moved to Top */}
										<div className='sd-options-group sd-options-group--compact'>
											<table
												className='form-table'
												role='presentation'>
												<tbody>
													<tr>
														<th scope='row'>
															{__(
																"Maintenance",
																"systemdeck",
															)}
														</th>
														<td>
															<fieldset className='sd-tools-actions'>
																<legend className='screen-reader-text'>
																	<span>
																		{__(
																			"Maintenance",
																			"systemdeck",
																		)}
																	</span>
																</legend>
															<div className='sd-maintenance-actions'>
																<button
																	type='button'
																	className='button button-secondary'
																	onClick={
																		handleResetViewMemory
																	}
																	disabled={
																		isLoading
																	}>
																	{__(
																		"Reset View Memory",
																		"systemdeck",
																	)}
																</button>
																<button
																	type='button'
																	className='button button-secondary'
																	onClick={
																		handleRefreshPixiHud
																	}
																	disabled={
																		isLoading
																	}>
																	{__(
																		"Clear SD HUD",
																		"systemdeck",
																	)}
																</button>
																{CAN_MANAGE_OPTIONS ? (
																	<>
																			<button
																				type='button'
																				className='button button-secondary'
																				onClick={() =>
																					handleClearCache(
																						"css",
																					)
																				}
																				disabled={
																					isLoading
																				}>
																				{__(
																					"Clear CSS Cache",
																					"systemdeck",
																				)}
																			</button>
																			<button
																				type='button'
																				className='button button-secondary'
																				onClick={() =>
																					handleClearCache(
																						"transients",
																					)
																				}
																				disabled={
																					isLoading
																				}>
																				{__(
																					"Clear SD Transients",
																					"systemdeck",
																				)}
																			</button>
																			<button
																				type='button'
																				className='button button-secondary'
																				onClick={handleSweepOrphans}
																				disabled={isLoading}>
																				{__(
																					"Clear Orphaned Data",
																					"systemdeck",
																				)}
																			</button>
																			<button
																				type='button'
																				className='button button-secondary'
																				onClick={handlePurgeWidgets}
																				disabled={isLoading}>
																				{__(
																					"Purge Widgets",
																					"systemdeck",
																				)}
																			</button>
																			<button
																				type='button'
																				className='button button-secondary'
																				onClick={() =>
																					handleClearCache(
																						"object",
																					)
																				}
																				disabled={
																					isLoading
																				}>
																				{__(
																					"Flush Object Cache (Sitewide)",
																					"systemdeck",
																				)}
																			</button>
																		</>
																	) : null}
																</div>
															</fieldset>
														</td>
													</tr>
													{CAN_MANAGE_OPTIONS ? (
														<tr>
															<th scope='row'>
																{__(
																	"Page Management",
																	"systemdeck",
																)}
															</th>
															<td>
																<div className='sd-maintenance-actions'>
																	{pageManagementLinks.map((link) => (
																		<a
																			key={link.href}
																			href={link.href}
																			target='_blank'
																			rel='noreferrer'
																			className='button button-secondary'>
																			{link.label}
																		</a>
																	))}
																</div>
															</td>
														</tr>
													) : null}
												</tbody>
											</table>
										</div>

										<div className='sd-options-group'>
											<table
												className='form-table'
												role='presentation'>
												<tbody>
													<tr>
														<th scope='row'>
															{__(
																"Default Dock State",
																"systemdeck",
															)}
														</th>
														<td>
																<select
																	className='regular-text'
																	value={
																	defaultDock
																}
																onChange={(e) =>
																	setDefaultDock(
																		e.target
																			.value,
																	)
																}
																disabled={
																	isLoading
																}>
																<option value='standard-dock'>
																	{__(
																		"Standard Dock (Default)",
																		"systemdeck",
																	)}
																</option>
																<option value='full-dock'>
																	{__(
																		"Full Screen",
																		"systemdeck",
																	)}
																</option>
																<option value='left-dock'>
																	{__(
																		"Left Side",
																		"systemdeck",
																	)}
																</option>
																<option value='right-dock'>
																	{__(
																		"Right Side",
																		"systemdeck",
																	)}
																</option>
																<option value='base-dock'>
																	{__(
																		"Base Dock (Bottom)",
																		"systemdeck",
																	)}
																</option>
																<option value='left-base-dock'>
																	{__(
																		"Base Dock (Left)",
																		"systemdeck",
																	)}
																</option>
																<option value='right-base-dock'>
																	{__(
																		"Base Dock (Right)",
																		"systemdeck",
																	)}
																</option>
																<option value='min-dock'>
																	{__(
																		"Min Dock (Circle)",
																		"systemdeck",
																	)}
																</option>
															</select>
														</td>
													</tr>
														<tr>
															<th scope='row'>
																{__(
																	"Incognito Mode",
																"systemdeck",
															)}
														</th>
														<td>
															<label className='sd-checkbox-control'>
																<input
																	type='checkbox'
																	checked={
																		incognitoMode
																	}
																	onChange={(
																		e,
																	) =>
																		setIncognitoMode(
																			e
																				.target
																				.checked,
																		)
																	}
																	disabled={
																		isLoading
																	}
																/>
																<span>
																	{__(
																		"Enable Incognito Mode (Dock fades out when minimized)",
																		"systemdeck",
																	)}
																</span>
															</label>
															</td>
														</tr>
														<tr>
															<th scope='row'>
																{__(
																	"Master Volume",
																	"systemdeck",
																)}
															</th>
															<td>
																<div className='sd-tools-workspace-select'>
																	<input
																		type='range'
																		min='0'
																		max='100'
																		step='1'
																		value={Math.round(
																			audioMasterVolume *
																				100,
																		)}
																		onChange={(
																			e,
																		) =>
																			setAudioMasterVolume(
																				Math.max(
																					0,
																					Math.min(
																						1,
																						Number(
																							e
																								.target
																								.value,
																						) / 100,
																					),
																				),
																			)
																		}
																		disabled={
																			isLoading
																		}
																	/>
																	<span>
																		{`${Math.round(audioMasterVolume * 100)}%`}
																	</span>
																</div>
															</td>
														</tr>
													</tbody>
												</table>
											<p className='submit sd-submit-row'>
												<button
													type='button'
													className='button button-primary'
													onClick={
														saveUserPreferences
													}
													disabled={isLoading}>
													{__(
														"Save Preferences",
														"systemdeck",
													)}
												</button>
												{userPreferencesSaveStatus ? (
													<span
														className={`sd-inline-status ${
															userPreferencesSaveStatus.type ===
															"success"
																? "is-success"
																: "is-error"
														}`}>
														{
															userPreferencesSaveStatus.message
														}
													</span>
												) : null}
											</p>
										</div>

										{CAN_MANAGE_OPTIONS ? (
											<div className='sd-options-group'>
												<h3 className='title'>
													{__(
														"Access Policy",
														"systemdeck",
													)}
												</h3>
												<table
													className='form-table'
													role='presentation'>
													<tbody>
														{POLICY_FIELDS.map(
															([
																field,
																label,
															]) => (
																<tr key={field}>
																	<th scope='row'>
																		{label}
																	</th>
																	<td>
																		<fieldset>
																			<legend className='screen-reader-text'>
																				<span>
																					{
																						label
																					}
																				</span>
																			</legend>
																			{ACCESS_POLICY_ROLE_OPTIONS.map(
																				(
																					role,
																				) => {
																					const roleLabel =
																						role
																							.split(
																								"_",
																							)
																							.map(
																								(
																									w,
																								) =>
																									w
																										.charAt(
																											0,
																										)
																										.toUpperCase() +
																									w
																										.toLowerCase()
																										.slice(
																											1,
																										),
																							)
																							.join(
																								" ",
																							)
																					return (
																							<label
																								key={`${field}-${role}`}
																								className='sd-tools-policy-option'>
																							<input
																								type='checkbox'
																								checked={(
																									accessPolicy?.[
																										field
																									] ||
																									[]
																								).includes(
																									role,
																								)}
																								onChange={(
																									e,
																								) =>
																									togglePolicyRole(
																										field,
																										role,
																										e
																											.target
																											.checked,
																									)
																								}
																								disabled={
																									isLoading
																								}
																							/>
																							<span>
																								{
																									roleLabel
																								}
																							</span>
																						</label>
																					)
																				},
																			)}
																		</fieldset>
																	</td>
																</tr>
															),
														)}
													</tbody>
												</table>
												<p className='submit sd-submit-row'>
													<button
														type='button'
														className='button button-primary'
														onClick={
															saveAccessPolicy
														}
														disabled={isLoading}>
														{__(
															"Save Access Policy",
															"systemdeck",
														)}
													</button>
													{accessPolicySaveStatus ? (
														<span
															className={`sd-inline-status ${
																accessPolicySaveStatus.type ===
																"success"
																	? "is-success"
																	: "is-error"
															}`}>
															{
																accessPolicySaveStatus.message
															}
														</span>
													) : null}
												</p>
											</div>
										) : null}
									</div>
								</div>
							)}
						</div>
					)}
				</TabPanel>
			</div>
		</div>
	)
}
