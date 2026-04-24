/**
 * SystemDeck Menu Controller
 * Bridges the PHP-rendered menu (#sd-menu) with the React state.
 */
import { dispatch } from "@wordpress/data"
import { select, subscribe } from "@wordpress/data"
import { STORE_NAME } from "../state/store"
import { openWorkspaceViaSystemDeck } from "../runtime/workspaceLaunch"

const WORKSPACE_OPTIONS_LAUNCHER = {
	id: "sd-workspace-options-launcher",
	title: "Workspace Options",
	ariaLabel: "Workspace Options",
	iconClass: "dashicons dashicons-admin-generic",
}

export function initializeMenuController() {
	const menuWrap = document.getElementById("sd-menuwrap")
	if (!menuWrap) return
	let workspaceOptionsLauncher = document.getElementById(
		WORKSPACE_OPTIONS_LAUNCHER.id,
	)
	if (!workspaceOptionsLauncher) {
		const headerRight = document.querySelector("#systemdeck .sd-header-right")
		if (headerRight) {
			workspaceOptionsLauncher = document.createElement("button")
			workspaceOptionsLauncher.type = "button"
			workspaceOptionsLauncher.id = WORKSPACE_OPTIONS_LAUNCHER.id
			workspaceOptionsLauncher.className = "sd-btn-icon"
			workspaceOptionsLauncher.title = WORKSPACE_OPTIONS_LAUNCHER.title
			workspaceOptionsLauncher.setAttribute(
				"aria-label",
				WORKSPACE_OPTIONS_LAUNCHER.ariaLabel,
			)
			workspaceOptionsLauncher.style.display = "none"

			const icon = document.createElement("span")
			icon.className = WORKSPACE_OPTIONS_LAUNCHER.iconClass
			workspaceOptionsLauncher.appendChild(icon)

			const dockControls = headerRight.querySelector(".sd-dock-controls")
			if (dockControls) {
				headerRight.insertBefore(workspaceOptionsLauncher, dockControls)
			} else {
				headerRight.appendChild(workspaceOptionsLauncher)
			}
		}
	}
	const setWorkspaceOptionsLauncherVisible = (isVisible) => {
		if (!workspaceOptionsLauncher) return
		workspaceOptionsLauncher.style.display = isVisible ? "" : "none"
	}

	const canOpenWorkspaceOptions = () => {
		const store = select(STORE_NAME)
		if (!store) return false
		const uiMode = store.getUIMode ? store.getUIMode() : "runtime"
		const activeWorkspaceId = store.getActiveWorkspaceId
			? store.getActiveWorkspaceId()
			: null
		const activeWorkspace = store.getActiveWorkspace
			? store.getActiveWorkspace()
			: null
		const userConfig = window.SYSTEMDECK_BOOTSTRAP?.config?.user || {}
		const canManageOptions = !!userConfig.can_manage_options
		const canManageWorkspaces = !!userConfig.can_manage_workspaces

		if (uiMode !== "runtime" || !activeWorkspaceId) return false
		if (!canManageOptions && !canManageWorkspaces) return false
		if (activeWorkspace?.shared_incoming && activeWorkspace?.is_locked) {
			return false
		}

		return true
	}

	const workspaceMenuNode = menuWrap.querySelector("#sd-menu-workspaces")
	const workspaceTitleNode = document.getElementById("sd-workspace-title")
	let lastMenuSignature = ""
	let lastActiveWorkspace = null
	let lastHeaderTitle = ""

	const renderWorkspaceSubmenu = (workspaces) => {
		if (!workspaceMenuNode) return
		const submenu = workspaceMenuNode.querySelector(".wp-submenu")

		const appLinks = (workspaces || []).filter(
			(ws) =>
				ws &&
				ws.id &&
				ws.id !== "undefined" &&
				!!ws?.show_top_level_menu,
		)
		const appLinkIds = new Set(appLinks.map((ws) => String(ws.id)))
		const all = (workspaces || []).filter(
			(ws) =>
				ws &&
				ws.id &&
				ws.id !== "undefined" &&
				!appLinkIds.has(String(ws.id)),
		)
		const ordered = all.filter((ws) => !(ws?.is_public && ws?.is_locked))
		const lockedShared = all.filter((ws) => !!ws?.is_public && !!ws?.is_locked)
		const signature = JSON.stringify(
			[
				ordered.map((ws) => ({
					id: ws.id,
					name: ws.name || ws.title || "Untitled Workspace",
				})),
				lockedShared.map((ws) => ({
					id: ws.id,
					name: ws.name || ws.title || "Untitled Workspace",
				})),
				appLinks.map((ws) => ({
					id: ws.id,
					name: ws.name || ws.title || "Untitled App",
					icon: ws.menu_icon || "dashicons-screenoptions",
				})),
			],
		)
		if (signature === lastMenuSignature) return
		lastMenuSignature = signature

		if (submenu) {
			const header = submenu.querySelector(".wp-submenu-head")
			submenu.innerHTML = ""
			if (header) submenu.appendChild(header)
			workspaceMenuNode.classList.toggle("wp-has-submenu", ordered.length > 0)
			workspaceMenuNode.classList.toggle("wp-menu-open", ordered.length > 0)
			if (!ordered.length) {
				workspaceMenuNode.classList.remove("wp-has-current-submenu")
			}

			ordered.forEach((ws) => {
				const title = ws.name || ws.title || "Untitled Workspace"
				const li = document.createElement("li")
				const a = document.createElement("a")
				a.setAttribute("href", `#workspace-${ws.id}`)
				a.setAttribute("data-workspace_id", ws.id)
				a.setAttribute("data-workspace_name", title)
				a.textContent = title
				li.appendChild(a)
				submenu.appendChild(li)
			})
		}

		// Shared + locked workspaces become top-level menu items.
		menuWrap
			.querySelectorAll("li.sd-menu-shared-locked")
			.forEach((el) => el.remove())
		lockedShared.forEach((ws) => {
			const title = ws.name || ws.title || "Untitled Workspace"
			const li = document.createElement("li")
			li.className = "menu-top sd-menu-shared-locked"
			const a = document.createElement("a")
			a.setAttribute("href", `#workspace-${ws.id}`)
			a.setAttribute("data-workspace_id", ws.id)
			a.className = "menu-top"
			a.textContent = title
			li.appendChild(a)
			workspaceMenuNode.insertAdjacentElement("afterend", li)
		})

		menuWrap.querySelectorAll("li.sd-menu-app-link").forEach((el) => el.remove())
		let appAnchor = workspaceMenuNode
		appLinks.forEach((ws) => {
			const title = ws.name || ws.title || "Untitled App"
			const iconClass = ws.menu_icon || "dashicons-screenoptions"
			const li = document.createElement("li")
			li.className = "menu-top sd-menu-app-link"
			li.setAttribute("id", `sd-menu-app-${ws.id}`)
			const a = document.createElement("a")
			a.setAttribute("href", `#workspace-${ws.id}`)
			a.setAttribute("data-workspace_id", ws.id)
			a.className = "menu-top"
			const icon = document.createElement("div")
			icon.className = `wp-menu-image dashicons-before ${iconClass}`
			icon.innerHTML = "<br>"
			const name = document.createElement("div")
			name.className = "wp-menu-name"
			name.textContent = title
			a.appendChild(icon)
			a.appendChild(name)
			li.appendChild(a)
			appAnchor.insertAdjacentElement("afterend", li)
			appAnchor = li
		})
	}

	// --- COLLAPSE BUTTON ---
	const collapseBtn = document.getElementById("sd-collapse-button")
	if (collapseBtn) {
		collapseBtn.addEventListener("click", (e) => {
			e.preventDefault()
			// Toggle visual class immediately for responsiveness
			document.body.classList.toggle("folded")

			// Sync with Redux (Optional, if other components need to know)
			// const current = select(STORE_NAME).isMenuFolded();
			// dispatch(STORE_NAME).setMenuFolded(!current);
		})
	}

	// Delegate click events
	menuWrap.addEventListener("click", (e) => {
		// --- ACCORDION LOGIC ---
		// Handle submenu toggle (click on LI or .wp-menu-image)
		const li = e.target.closest("li.menu-top")
		if (li && li.classList.contains("wp-has-submenu")) {
			const link = e.target.closest("a")
			const isToggleClick =
				!link ||
				link.getAttribute("href") === "#" ||
				e.target.closest(".wp-menu-image")

			if (isToggleClick) {
				e.preventDefault()
				toggleSubmenu(li)
			} else {
				// It's a navigation click, ensure submenu is visible
				openSubmenu(li)
			}
		}

		const link = e.target.closest("a")
		if (!link) return

		const href = link.getAttribute("href")
		const workspaceId = link.getAttribute("data-workspace_id")

		// 1. Config / System
		if (href === "#system" || link.parentElement.id === "sd-menu-system") {
			e.preventDefault()
			dispatch(STORE_NAME).setUIMode("discovery")
			updateActiveMenu("#system")
		}
		// 1.5 Workspace Options drawer
		else if (
			href === "#workspace-options" ||
			link.parentElement.id === "sd-menu-workspace-options"
		) {
			e.preventDefault()
			if (!canOpenWorkspaceOptions()) return
			dispatch(STORE_NAME).setUIMode("runtime")
			dispatch(STORE_NAME).toggleMetaDrawer(true)
			updateActiveMenu("#workspace-options")
		}

		// 2. Workspaces
		else if (workspaceId || (href && href.startsWith("#workspace-"))) {
			e.preventDefault()
			const id = workspaceId || href.replace("#workspace-", "")
			openWorkspaceViaSystemDeck(id)
			updateActiveMenu(href)
		}
	})

	if (workspaceOptionsLauncher) {
		workspaceOptionsLauncher.addEventListener("click", (e) => {
			e.preventDefault()
			if (!canOpenWorkspaceOptions()) return
			dispatch(STORE_NAME).toggleMetaDrawer(true)
		})
	}

	const syncFromStore = () => {
		const store = select(STORE_NAME)
		if (!store) return
		const workspaces = store.getAllWorkspaces ? store.getAllWorkspaces() : []
		const activeWorkspaceId = store.getActiveWorkspaceId
			? store.getActiveWorkspaceId()
			: null
		const uiMode = store.getUIMode ? store.getUIMode() : "runtime"
		const activeWorkspace = store.getActiveWorkspace
			? store.getActiveWorkspace()
			: null
		const userConfig = window.SYSTEMDECK_BOOTSTRAP?.config?.user || {}
		const canManageOptions = !!userConfig.can_manage_options
		const canManageWorkspaces = !!userConfig.can_manage_workspaces
		const showWorkspaceOptionsLauncher =
			uiMode === "runtime" &&
			!!activeWorkspaceId &&
			(canManageOptions || canManageWorkspaces) &&
			!(activeWorkspace?.shared_incoming && activeWorkspace?.is_locked)

		renderWorkspaceSubmenu(workspaces)
		markWorkspaceActive(activeWorkspaceId)
		syncWorkspaceHeaderTitle(uiMode, activeWorkspace, activeWorkspaceId)
		setWorkspaceOptionsLauncherVisible(showWorkspaceOptionsLauncher)

		// Keep menu state deterministic across reloads/navigation.
		if (uiMode === "runtime" && activeWorkspaceId) {
			if (activeWorkspaceId !== lastActiveWorkspace) {
				lastActiveWorkspace = activeWorkspaceId
			}
			updateActiveMenu(`#workspace-${activeWorkspaceId}`)
		} else if (uiMode === "discovery" || uiMode === "config") {
			updateActiveMenu("#system")
		}
	}

	function syncWorkspaceHeaderTitle(uiMode, activeWorkspace, activeWorkspaceId) {
		if (!workspaceTitleNode) return
		const isSystemView = uiMode === "discovery" || uiMode === "config"
		let nextTitle = "SystemDeck"
		if (!isSystemView && activeWorkspaceId) {
			nextTitle = activeWorkspace?.name || activeWorkspace?.title || ""
			if (
				(!nextTitle || nextTitle === activeWorkspaceId) &&
				(activeWorkspace?.is_app_workspace || activeWorkspace?.app_id)
			) {
				const apps = Array.isArray(window.SYSTEMDECK_BOOTSTRAP?.config?.apps)
					? window.SYSTEMDECK_BOOTSTRAP.config.apps
					: []
				const appId = String(activeWorkspace?.app_id || "")
				const appMeta = apps.find((app) => String(app?.id || "") === appId)
				if (appMeta?.title) {
					nextTitle = String(appMeta.title)
				}
			}
			nextTitle = nextTitle || activeWorkspaceId || "SystemDeck"
		}
		if (nextTitle === lastHeaderTitle) return
		lastHeaderTitle = nextTitle
		workspaceTitleNode.textContent = nextTitle
	}

	syncFromStore()
	subscribe(syncFromStore)

	function openSubmenu(li) {
		// Close others
		const open = menuWrap.querySelectorAll(".wp-has-submenu.wp-menu-open")
		open.forEach((el) => {
			if (el !== li) el.classList.remove("wp-menu-open")
		})
		li.classList.add("wp-menu-open")
	}

	function toggleSubmenu(li) {
		if (li.classList.contains("wp-menu-open")) {
			li.classList.remove("wp-menu-open")
		} else {
			openSubmenu(li)
		}
	}

	// Helper to visual state (since PHP renders it static initially)
	function updateActiveMenu(targetHref) {
		// Remove current
		const current = menuWrap.querySelector(".current")
		if (current) current.classList.remove("current")
		const currentParent = menuWrap.querySelector(".wp-has-current-submenu")
		if (currentParent)
			currentParent.classList.remove("wp-has-current-submenu")

		// Add to new
		const newLink = menuWrap.querySelector(`a[href="${targetHref}"]`)
		if (newLink) {
			const li = newLink.closest("li")
			if (li) li.classList.add("current")

			// Handle parent menu item highlighting
			const parentLi = li.closest(".wp-has-submenu")
			if (parentLi) {
				parentLi.classList.add("wp-has-current-submenu")
				parentLi.classList.add("wp-menu-open")
			}
		}
	}

	function markWorkspaceActive(activeWorkspaceId) {
		const links = menuWrap.querySelectorAll(
			'#sd-menu-workspaces .wp-submenu a[data-workspace_id], li.sd-menu-shared-locked a[data-workspace_id], li.sd-menu-app-link a[data-workspace_id]',
		)
		links.forEach((link) => {
			const li = link.closest("li")
			const isActive = activeWorkspaceId
				? link.getAttribute("data-workspace_id") === activeWorkspaceId
				: false
			link.classList.toggle("sd-workspace-active", isActive)
			if (li) {
				li.classList.toggle("sd-workspace-active", isActive)
			}
		})
	}

	console.log("SystemDeck: Menu Controller Active")
}
