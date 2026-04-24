;(function () {
	"use strict"

	// --- Helper: Event Delegation ---
	const on = (selector, eventType, handler) => {
		document.addEventListener(eventType, (e) => {
			const target = e.target.closest(selector)
			if (target) {
				handler.call(target, e, target)
			}
		})
	}

	const SystemDeck = {
		el: null,
		currentDock: "standard-dock",
		lastDock: "standard-dock",
		eventsBound: false,

		/**
		 * Get the default dock from the shell's data attribute or fallback
		 */
		getDefaultDock: function () {
			const el = this.el || document.getElementById("systemdeck")
			if (el && el.dataset.defaultDock) {
				return el.dataset.defaultDock
			}
			return "standard-dock"
		},

		applyIncognitoMode: function () {
			const el = this.el || document.getElementById("systemdeck")
			if (!el) return

			el.classList.toggle("incognito", el.dataset.incognito === "true")
		},

		init: function () {
			this.bindEvents()

			const el = document.getElementById("systemdeck")
			if (!el) return

			this.el = el
			this.applyIncognitoMode()
			const defaultDock = this.getDefaultDock()
			this.lastDock = localStorage.getItem("sd_last_dock") || defaultDock

			// Theme is hard-locked to light mode.
			this.setTheme("light")

			// Detect Admin Bar Height (FSE vs Standard)
			const body = document.body
			const isFse =
				body.classList.contains("site-editor-php") ||
				body.classList.contains("block-editor-page")
			const adminBarHeight = isFse ? "60px" : "32px"
			document.documentElement.style.setProperty(
				"--sd-adminbar-h",
				adminBarHeight,
			)

			// --- RESIZE GUARD ---
			// Protect against "stuck" dimensions when moving from huge -> small screens
			const dimKeys = ["sd_dim_standard", "sd_dim_right", "sd_dim_left"]
			dimKeys.forEach((key) => {
				const val = localStorage.getItem(key)
				if (val && val.endsWith("px")) {
					const px = parseInt(val, 10)
					const isHeight = key === "sd_dim_standard"
					const limit = isHeight
						? window.innerHeight * 0.9
						: window.innerWidth * 0.9

					if (px > limit) {
						localStorage.removeItem(key)
					}
				}
			})

			// Load saved dock state
			const savedDock =
				localStorage.getItem("sd_dock_state") || defaultDock
			this.switchDock(savedDock)

			// Check if shell should be open (from cookie)
			const isActive = document.cookie
				.split("; ")
				.find((row) => row.startsWith("sd_is_active=true"))

			if (isActive) {
				// Cookie says open → show the shell
				this.el.classList.remove("sd-closed")
				this.el.classList.remove("sd-drawer-hidden")
				this.el.setAttribute("aria-hidden", "false")
				this.el.inert = false
			} else {
				// Shell starts closed (default from HTML)
				this.el.inert = true
			}

			// Restore Menu State
			const isFolded = localStorage.getItem("sd_menu_folded") === "true"
			if (isFolded) {
				const menu = this.el.querySelector("#sd-menumain")
				const collapseBtn = this.el.querySelector("#sd-collapse-button")
				if (menu) menu.classList.add("folded")
				if (collapseBtn)
					collapseBtn.setAttribute("aria-expanded", "false")
			}

			this.updateResizeHandles()
			SD_Resizer.init("#systemdeck")
		},

		bindEvents: function () {
			if (this.eventsBound) return
			this.eventsBound = true

			const self = this

			// --- Admin Bar & Global Toggle ---
			on(
				"#wp-admin-bar-system-deck-toggle, .sd-toggle-trigger",
				"click",
				function (e) {
					e.preventDefault()

					const el = document.getElementById("systemdeck")
					if (!el) return // Shell not present, nothing to toggle

					self.el = el

					if (!el.classList.contains("sd-closed")) {
						// CLOSING via Admin Bar always resets to the configured default dock.
						self.lastDock = self.currentDock
						localStorage.setItem("sd_last_dock", self.lastDock)
						localStorage.setItem(
							"sd_dock_state",
							self.getDefaultDock(),
						)
						el.classList.add("sd-closed")
						el.inert = true
						localStorage.setItem("sd_is_closed", "true")
						document.cookie =
							"sd_is_active=false; path=/; max-age=0"
					} else {
						// OPENING via Admin Bar should restore the configured default dock state.
						self.switchDock(
							localStorage.getItem("sd_dock_state") ||
								self.getDefaultDock(),
						)
						el.classList.remove("sd-closed")
						el.classList.remove("sd-drawer-hidden")
						el.setAttribute("aria-hidden", "false")
						el.inert = false
						localStorage.setItem("sd_is_closed", "false")
						document.cookie =
							"sd_is_active=true; path=/; max-age=31536000"
					}
				},
			)

			on("#systemdeck .sd-drawer-icon", "click", function () {
				self.toggleMinDock()
			})

			on("#systemdeck [data-dock]", "click", function (e, target) {
				const requestedDock = target.getAttribute("data-dock")
				const current = self.currentDock

				// 1. Shuffled Navigation: Left Arrow
				if (requestedDock === "left-dock") {
					if (current === "right-base-dock") {
						self.switchDock("base-dock")
					} else if (current === "base-dock") {
						self.switchDock("left-base-dock")
					} else if (current === "right-dock") {
						self.switchDock("full-dock")
					} else if (current === "full-dock") {
						self.switchDock("left-dock")
					} else {
						self.switchDock("left-dock")
					}
				}
				// 2. Shuffled Navigation: Right Arrow
				else if (requestedDock === "right-dock") {
					if (current === "left-base-dock") {
						self.switchDock("base-dock")
					} else if (current === "base-dock") {
						self.switchDock("right-base-dock")
					} else if (current === "left-dock") {
						self.switchDock("full-dock")
					} else if (current === "full-dock") {
						self.switchDock("right-dock")
					} else {
						self.switchDock("right-dock")
					}
				}
				// 3. Base Dock Toggle
				else if (requestedDock === "base-dock") {
					self.toggleBaseDock()
				}
				// 4. Standard/Full (Direct Switch)
				else {
					self.switchDock(requestedDock)
				}
			})

			// Header X close button - just closes, preserves dock state
			on("#systemdeck #sd-close-button", "click", function (e) {
				e.preventDefault()

				// A11Y FIX: Move focus OUT of the deck before hiding it to prevent "aria-hidden" violations
				const adminToggle = document.getElementById(
					"wp-admin-bar-system-deck-toggle",
				)
				if (adminToggle) {
					const link = adminToggle.querySelector("a")
					if (link) link.focus()
				} else {
					if (document.activeElement) document.activeElement.blur()
				}

				self.toggle()
				document.cookie = "sd_is_active=false; path=/; max-age=0"
			})

			on("#systemdeck #sd-collapse-button", "click", function () {
				const menu = self.el.querySelector("#sd-menumain")
				const isFolded = menu.classList.toggle("folded")
				this.setAttribute("aria-expanded", !isFolded)
				localStorage.setItem("sd_menu_folded", isFolded)
			})

			// PREVENT HASH CHANGE on placeholder menu links
			on("#systemdeck #sd-menu a", "click", function (e) {
				const href = this.getAttribute("href")
				if (href && href.startsWith("#")) {
					e.preventDefault()
					// Future: dispatch event to handle navigation without hash change
					// console.log("Menu click prevented:", href);
				}
			})
		},

		toggle: function () {
			if (!this.el) this.el = document.getElementById("systemdeck")
			if (!this.el) return

			this.el.classList.toggle("sd-closed")
			const isClosed = this.el.classList.contains("sd-closed")
			if (!isClosed) this.el.classList.remove("sd-drawer-hidden")

			this.el.setAttribute("aria-hidden", isClosed ? "true" : "false")
			this.el.inert = isClosed
			localStorage.setItem("sd_is_closed", isClosed)
		},

		toggleMinDock: function () {
			if (this.currentDock === "min-dock") {
				this.switchDock(this.lastDock || this.getDefaultDock())
			} else {
				this.lastDock = this.currentDock
				localStorage.setItem("sd_last_dock", this.lastDock)
				this.switchDock("min-dock")
			}
		},

		toggleBaseDock: function () {
			let target = "base-dock"

			if (this.currentDock.includes("base-dock")) {
				this.switchDock(this.lastDock || this.getDefaultDock())
				return
			}

			if (this.currentDock === "full-dock") {
				this.switchDock("standard-dock")
				return
			}

			this.lastDock = this.currentDock
			localStorage.setItem("sd_last_dock", this.lastDock)

			if (this.currentDock === "right-dock") target = "right-base-dock"
			else if (this.currentDock === "left-dock") target = "left-base-dock"
			else target = "base-dock"

			this.switchDock(target)
		},

		switchDock: function (newDock) {
			if (!this.el) this.el = document.getElementById("systemdeck")
			if (!this.el) return

			if (newDock === this.currentDock && newDock !== "standard-dock") {
				newDock = "standard-dock"
			}

			this.el.removeAttribute("style")

			const dockClasses = [
				"standard-dock",
				"right-dock",
				"left-dock",
				"full-dock",
				"base-dock",
				"right-base-dock",
				"left-base-dock",
				"min-dock",
			]
			this.el.classList.remove(...dockClasses)
			this.el.classList.add(newDock)

			if (newDock === "standard-dock") {
				const h = localStorage.getItem("sd_dim_standard")
				if (h) this.el.style.height = h
			} else if (newDock === "right-dock") {
				const w = localStorage.getItem("sd_dim_right")
				if (w) this.el.style.width = w
			} else if (newDock === "left-dock") {
				const w = localStorage.getItem("sd_dim_left")
				if (w) this.el.style.width = w
			}

			this.currentDock = newDock
			localStorage.setItem("sd_dock_state", newDock)

			const baseBtnIcon = this.el.querySelector(
				'[data-dock="base-dock"] .dashicons',
			)
			if (baseBtnIcon) {
				if (newDock.includes("base-dock")) {
					baseBtnIcon.classList.remove("dashicons-minus")
					baseBtnIcon.classList.add("dashicons-arrow-up-alt")
				} else {
					baseBtnIcon.classList.remove("dashicons-arrow-up-alt")
					baseBtnIcon.classList.add("dashicons-minus")
				}
			}

			this.updateResizeHandles()
		},

		updateResizeHandles: function () {
			if (!this.el) return
			const existingHandles =
				this.el.querySelectorAll(".sd-handle-resize")
			existingHandles.forEach((el) => el.remove())

			const dock = this.currentDock
			let handleClass = ""

			if (dock === "standard-dock") handleClass = "sd-handle-n"
			else if (dock === "right-dock") handleClass = "sd-handle-w"
			else if (dock === "left-dock") handleClass = "sd-handle-e"
			else return

			const handleHTML = `<div class="sd-handle-resize ${handleClass}" draggable="false" ondragstart="return false;" style="touch-action:none;"><span class="dashicons dashicons-ellipsis"></span></div>`
			this.el.insertAdjacentHTML("beforeend", handleHTML)
		},

		setTheme: function () {
			if (!this.el) return
			const theme = "light"
			this.el.setAttribute("data-theme", theme)
			localStorage.setItem("sd_theme", "light")

			// Broadcast theme state to all tunneled iframe widgets
			const iframes = document.querySelectorAll(
				"#systemdeck .sd-widget-proxy iframe, #systemdeck .sd-proxy-frame-wrapper iframe",
			)
			iframes.forEach((iframe) => {
				if (iframe.contentWindow) {
					iframe.contentWindow.postMessage(
						{
							command: "sd_theme_changed",
							data: { theme: theme },
						},
						"*",
					)
				}
			})
		},
	}

	var SD_Resizer = {
		root: null,
		target: null,
		type: null,

		startX: 0,
		startY: 0,
		startW: 0,
		startH: 0,

		lastEvent: null,
		frame: null,

		velocity: 0,
		lastPos: 0,
		lastTime: 0,

		snapThreshold: 24,
		maxRatio: 0.75,

		snapPoints: [0.25, 0.3333, 0.5, 0.6667, 0.75],

		init: function (selector) {
			const el = document.querySelector(selector)
			if (!el) return

			// If finding same root, ensure listener is there (just in case), or return
			if (this.root === el) return

			// Unbind old if exists (clean up)
			if (this.root) {
				try {
					this.root.removeEventListener(
						"pointerdown",
						this.startResize,
					)
				} catch (e) {}
			}

			this.root = el
			this.root.addEventListener(
				"pointerdown",
				this.startResize.bind(this),
			)
		},

		startResize: function (e) {
			var handle = e.target.closest(".sd-handle-resize")
			if (!handle) return

			e.preventDefault()

			this.target = this.root
			this.lastEvent = e
			this.startX = e.clientX
			this.startY = e.clientY
			this.startW = this.target.offsetWidth
			this.startH = this.target.offsetHeight

			if (handle.classList.contains("sd-handle-n")) this.type = "n"
			if (handle.classList.contains("sd-handle-w")) this.type = "w"
			if (handle.classList.contains("sd-handle-e")) this.type = "e"

			this.lastPos = this.type === "n" ? e.clientY : e.clientX
			this.lastTime = performance.now()
			this.velocity = 0

			this.target.setPointerCapture(e.pointerId)
			document.body.classList.add("sd-is-resizing")
			document.body.style.userSelect = "none"

			this.setGlow(18)

			window.addEventListener("pointermove", this.queueResize)
			window.addEventListener("pointerup", this.stopResize)
		},

		queueResize: function (e) {
			SD_Resizer.lastEvent = e
			if (!SD_Resizer.frame) {
				SD_Resizer.frame = requestAnimationFrame(SD_Resizer.doResize)
			}
		},

		doResize: function () {
			var r = SD_Resizer
			r.frame = null
			if (!r.target || !r.lastEvent) return

			var e = r.lastEvent
			var now = performance.now()

			if (r.type === "n") {
				var delta = r.startY - e.clientY
				var newH = r.startH + delta

				var adminH =
					parseInt(
						getComputedStyle(
							document.documentElement,
						).getPropertyValue("--sd-adminbar-h"),
						10,
					) || 32

				newH = Math.max(
					100,
					Math.min(newH, window.innerHeight - adminH),
				)
				r.target.style.height = newH + "px"

				r.velocity = (r.lastPos - e.clientY) / (now - r.lastTime)
				r.lastPos = e.clientY
			}

			if (r.type === "w" || r.type === "e") {
				var delta =
					r.type === "w" ? r.startX - e.clientX : e.clientX - r.startX

				var maxW = window.innerWidth * r.maxRatio
				var newW = Math.max(200, Math.min(r.startW + delta, maxW))

				var snap = r.getSnapWidth(newW)
				if (snap) newW = snap

				r.target.style.width = newW + "px"

				r.velocity = (e.clientX - r.lastPos) / (now - r.lastTime)
				r.lastPos = e.clientX
			}

			r.lastTime = now

			r.target.dispatchEvent(
				new CustomEvent("sd:resize", {
					bubbles: true,
					detail: { type: r.type },
				}),
			)
		},

		stopResize: function (e) {
			var r = SD_Resizer
			var target = r.target // 🔒 capture reference

			try {
				target && target.releasePointerCapture(e.pointerId)
			} catch (_) {}

			window.removeEventListener("pointermove", r.queueResize)
			window.removeEventListener("pointerup", r.stopResize)

			document.body.classList.remove("sd-is-resizing")
			document.body.style.userSelect = ""

			if (target) {
				// SAVE STATE (Immediate - Pre Inertia)
				var type = r.type
				if (type === "n")
					localStorage.setItem("sd_dim_standard", target.style.height)
				if (type === "w")
					localStorage.setItem("sd_dim_right", target.style.width)
				if (type === "e")
					localStorage.setItem("sd_dim_left", target.style.width)

				target.dispatchEvent(
					new CustomEvent("sd:resize-end", {
						bubbles: true,
						detail: { type: r.type },
					}),
				)

				r.applyInertia(target, type) // 👈 pass target AND type
			}

			r.setGlow(12)

			// cleanup AFTER inertia is scheduled
			r.target = null
			r.lastEvent = null
		},

		applyInertia: function (target, type) {
			var velocity = this.velocity
			var decay = 0.92
			var min = 0.01
			var maxW = window.innerWidth * this.maxRatio
			// var type = this.type // Removed: use passed arg

			function step() {
				velocity *= decay
				if (Math.abs(velocity) < min) {
					// INERTIA COMPLETE: Save Final State
					if (target && target.isConnected) {
						if (type === "w")
							localStorage.setItem(
								"sd_dim_right",
								target.style.width,
							)
						if (type === "e")
							localStorage.setItem(
								"sd_dim_left",
								target.style.width,
							)
					}
					return
				}

				if (!target || !target.isConnected) return

				if (type === "w" || type === "e") {
					var w = target.offsetWidth + velocity * 16
					w = Math.max(200, Math.min(w, maxW))
					target.style.width = w + "px"
				}

				requestAnimationFrame(step)
			}

			requestAnimationFrame(step)
		},

		getSnapWidth: function (w) {
			var vw = window.innerWidth
			var snaps = []

			this.snapPoints.forEach(function (p) {
				snaps.push(vw * p)
			})

			var cssW = getComputedStyle(document.documentElement)
				.getPropertyValue("--sd-sidebar-w")
				.trim()

			if (cssW.endsWith("px")) snaps.push(parseInt(cssW, 10))

			for (var i = 0; i < snaps.length; i++) {
				if (Math.abs(w - snaps[i]) <= this.snapThreshold) {
					return Math.round(snaps[i])
				}
			}
			return null
		},

		setGlow: function (blur) {
			document.documentElement.style.setProperty(
				"--sd-resize-glow-blur",
				blur + "px",
			)
		},

		/**
		 * UI: Show System Notification (Toast)
		 */
		notify: function (message, type = "info", duration = 3000) {
			let container = document.querySelector(".sd-notification-container")
			if (!container) {
				container = document.createElement("div")
				container.className = "sd-notification-container"
				document.body.appendChild(container)
			}

			const toast = document.createElement("div")
			toast.className = `sd-toast ${type}`

			// Map icons
			const icons = {
				success: "dashicons-yes",
				error: "dashicons-warning",
				info: "dashicons-info",
				scan: "dashicons-search",
			}
			const icon = icons[type] || "dashicons-info"

			toast.innerHTML = `
                <span class="dashicons ${icon}"></span>
                <span class="sd-toast-msg">${message}</span>
            `

			container.appendChild(toast)

			// Trigger animation
			setTimeout(() => toast.classList.add("show"), 10)

			// Remove
			setTimeout(() => {
				toast.classList.remove("show")
				setTimeout(() => toast.remove(), 400)
			}, duration)
		},
	}

	// Expose API (Non-destructive merge)
	if (window.SystemDeck) {
		Object.assign(window.SystemDeck, SystemDeck)
	} else {
		window.SystemDeck = SystemDeck
	}

	document.addEventListener("DOMContentLoaded", function () {
		SystemDeck.init()
		SD_Resizer.init("#systemdeck")
	})
})()
