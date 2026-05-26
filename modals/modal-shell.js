;(function (window, document) {
	"use strict"

	if (!window.wp || !window.wp.element) return

	const { createElement, useEffect, useState } = window.wp.element
	const registry = (window.SystemDeckModalRegistry =
		window.SystemDeckModalRegistry || {})
	const shellApi = (window.SystemDeckModalShell =
		window.SystemDeckModalShell || {})

	let setModalState = null
	let lastBodyOverflow = ""
	let isRendered = false

	function ensureHost() {
		let host = document.querySelector(".systemdeck-modal-root")
		if (host) return host
		host = document.createElement("div")
		host.className = "systemdeck-modal-root"
		document.body.appendChild(host)
		return host
	}

	function resolveModalHostId(modalState) {
		const type = String(modalState?.type || "")
		const targetType = String(modalState?.props?.targetType || "")
		if (type === "comments") {
			if (targetType === "vault_file") {
				return "systemdeck-vault-comments"
			}
			if (targetType === "note" || targetType === "notes") {
				return "systemdeck-notes-comments"
			}
			if (targetType) {
				const safeType = targetType
					.toLowerCase()
					.replace(/[^a-z0-9_-]+/g, "-")
					.replace(/_file$/, "")
				return "systemdeck-" + safeType + "-comments"
			}
		}
		return "systemdeck-modal-root"
	}

	function resolveModalHostClasses(modalState) {
		const classes = ["systemdeck-modal-root"]
		const type = String(modalState?.type || "")
		const targetType = String(modalState?.props?.targetType || "")
		if (type) {
			classes.push("sd-modal--" + type.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))
		}
		if (type === "comments") {
			const suffix = targetType
				? targetType.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
				: "generic"
			classes.push("sd-comments--" + suffix)
		}
		return classes.join(" ")
	}

	function closeModal() {
		if (typeof setModalState !== "function") return
		setModalState({ open: false, type: "", title: "", props: {} })
	}

	function openModal(payload) {
		if (typeof setModalState !== "function") return
		const next = payload && typeof payload === "object" ? payload : {}
		setModalState({
			open: true,
			type: String(next.type || ""),
			title: String(next.title || ""),
			props: next.props && typeof next.props === "object" ? next.props : {},
		})
	}

	function registerModal(type, renderer) {
		if (!type || typeof renderer !== "function") return
		registry[String(type)] = renderer
	}

	function ModalShellApp() {
		const [modalState, setState] = useState({
			open: false,
			type: "",
			title: "",
			props: {},
		})

		useEffect(function () {
			setModalState = setState
			return function () {
				setModalState = null
			}
		}, [])

		useEffect(
			function () {
				if (!modalState.open) return
				function onKeyDown(event) {
					if (event.key === "Escape") closeModal()
				}
				document.addEventListener("keydown", onKeyDown)
				return function () {
					document.removeEventListener("keydown", onKeyDown)
				}
			},
			[modalState.open],
		)

		useEffect(
			function () {
				if (!modalState.open) {
					if (document.body.style.overflow === "hidden") {
						document.body.style.overflow = lastBodyOverflow || ""
					}
					return
				}
				lastBodyOverflow = document.body.style.overflow || ""
				document.body.style.overflow = "hidden"
			},
			[modalState.open],
		)

		useEffect(
			function () {
				const host = ensureHost()
				host.className = resolveModalHostClasses(modalState)
				host.id = resolveModalHostId(modalState)
				host.setAttribute(
					"data-context-type",
					String(modalState?.props?.targetType || ""),
				)
				host.setAttribute(
					"data-context-id",
					String(modalState?.props?.targetId || ""),
				)
			},
			[modalState.type, modalState.props?.targetType, modalState.props?.targetId],
		)

		if (!modalState.open) return null
		const modalHostId = resolveModalHostId(modalState)
		const modalTitleId = modalHostId + "-title"

		const renderer = registry[modalState.type]
		const bodyContent = renderer
			? renderer(
					Object.assign({}, modalState.props || {}, {
						closeModal,
						modalTitle: modalState.title,
					}),
			  )
			: createElement(
					"div",
					{ className: "sd-modal-empty" },
					"Modal content unavailable.",
			  )

		return createElement(
			"div",
			{
				className: "sd-modal-overlay",
				onClick: function (event) {
					if (event.target === event.currentTarget) closeModal()
				},
			},
			createElement(
				"div",
				{
					className: "sd-modal-dialog",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": modalTitleId,
				},
				createElement(
					"div",
					{ className: "sd-modal-header" },
					createElement(
						"h2",
						{ className: "sd-modal-title", id: modalTitleId },
						modalState.title || "SystemDeck",
					),
					createElement(
						"button",
						{
							type: "button",
							className: "sd-modal-close",
							onClick: closeModal,
							"aria-label": "Close modal",
						},
						"\u00d7",
					),
				),
				createElement("div", { className: "sd-modal-body" }, bodyContent),
			),
		)
	}

	function attachEvents() {
		document.addEventListener("systemdeck:modal:open", function (event) {
			openModal(event && event.detail ? event.detail : {})
		})

		document.addEventListener("systemdeck:modal:close", function () {
			closeModal()
		})

		document.addEventListener("systemdeck:comments:open", function (event) {
			const detail = event && event.detail ? event.detail : {}
			openModal({
				type: "comments",
				title: String(detail.title || "Comments"),
				props: detail,
			})
		})
	}

	function boot() {
		if (isRendered) return
		isRendered = true
		window.wp.element.render(
			createElement(ModalShellApp),
			ensureHost(),
		)
		attachEvents()
	}

	shellApi.open = openModal
	shellApi.close = closeModal
	shellApi.register = registerModal

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot)
	} else {
		boot()
	}
})(window, document)
