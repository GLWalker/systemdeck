;(function (window) {
	"use strict"

	if (!window.wp || !window.wp.element) return

	const { createElement, useEffect, useRef, useState } = window.wp.element

	function parseReplyTargetId(triggerEl) {
		if (!triggerEl) return 0
		const data =
			triggerEl.dataset && typeof triggerEl.dataset === "object"
				? triggerEl.dataset
				: {}
		const direct =
			Number(
				data.id ||
					data.commentid ||
					data.commentId ||
					data.comment_id ||
					0,
			) || 0
		if (direct > 0) return direct
		const href = String(triggerEl.getAttribute("href") || "")
		const match = href.match(/[?&]replytocom=(\d+)/i)
		if (match && match[1]) return Number(match[1]) || 0
		return 0
	}

	function getEnv() {
		return (
			window.SystemDeckModalEnv ||
			window.SYSTEMDECK_ENV ||
			window.sd_vars ||
			{}
		)
	}

	function getAjaxUrl() {
		const env = getEnv()
		return (
			env.ajaxUrl ||
			env.ajax_url ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"
		)
	}

	function getNonce() {
		const env = getEnv()
		return (
			env.nonce ||
			(env.nonces && env.nonces.systemdeck_runtime) ||
			window.sd_vault_bridge?.nonce ||
			window.SystemDeckSecurity?.nonce ||
			window.sd_vars?.nonce ||
			""
		)
	}

	function countThreadNodes(comments) {
		if (!Array.isArray(comments) || comments.length === 0) return 0
		let total = 0
		comments.forEach(function walk(node) {
			if (!node || typeof node !== "object") return
			total += 1
			if (Array.isArray(node.replies) && node.replies.length) {
				node.replies.forEach(walk)
			}
		})
		return total
	}

	function resolveCommentsConfig(props, targetId) {
		const rawTargetType = String(props?.targetType || "vault_file")
			.trim()
			.toLowerCase()
		const targetType =
			rawTargetType === "vault"
				? "vault_file"
				: rawTargetType === "notes"
					? "note"
					: rawTargetType
		const custom = props?.commentsConfig || {}
		if (custom && typeof custom === "object" && custom.threadAction) {
			return custom
		}

		if (targetType === "note") {
			return {
				contextName: "Note",
				details: {
					action: "sd_get_read_note",
					fields: { id: targetId },
					getTitle: function (data) {
						return String(data?.note?.title || data?.title || "")
					},
				},
				thread: {
					action: "sd_get_note_comments",
					fields: { note_id: targetId },
					getHtml: function (data) {
						return String(data?.html || "")
					},
					getCount: function (data) {
						if (typeof data?.count === "number") return data.count
						return countThreadNodes(data?.comments || [])
					},
				},
				add: {
					action: "sd_add_note_comment",
					fields: function (content, parentId) {
						return {
							note_id: targetId,
							content: content,
							parent_id: parentId || 0,
							comment_parent: parentId || 0,
						}
					},
				},
			}
		}

		if (targetType === "workspace") {
			return {
				contextName: "Workspace",
				details: {
					action: String(props?.detailsAction || ""),
					fields: Object.assign({}, props?.detailsFields || {}, {
						id: targetId,
					}),
					getTitle: function (data) {
						return String(data?.title || data?.workspace?.title || "")
					},
				},
				thread: {
					action: String(props?.threadAction || ""),
					fields: Object.assign({}, props?.threadFields || {}, {
						workspace_id: targetId,
					}),
					getHtml: function (data) {
						return String(data?.html || "")
					},
					getCount: function (data) {
						if (typeof data?.count === "number") return data.count
						return countThreadNodes(data?.comments || [])
					},
				},
				add: {
					action: String(props?.addAction || ""),
					fields: function (content, parentId) {
						return Object.assign({}, props?.addFields || {}, {
							workspace_id: targetId,
							content: content,
							parent_id: parentId || 0,
							comment_parent: parentId || 0,
						})
					},
				},
			}
		}

		return {
			contextName: "Vault File",
			details: {
				action: "sd_core_vault_ajax_get_file_details",
				fields: { id: targetId },
				getTitle: function (data) {
					return String(data?.title || "")
				},
			},
			thread: {
				action: "sd_core_vault_ajax_get_file_comments",
				fields: { file_id: targetId },
				getHtml: function (data) {
					return String(data?.html || "")
				},
				getCount: function (data) {
					return Number(data?.count || 0)
				},
			},
			add: {
				action: "sd_core_vault_ajax_add_file_comment",
				fields: function (content, parentId) {
					return {
						file_id: targetId,
						content: content,
						parent_id: parentId || 0,
						comment_parent: parentId || 0,
					}
				},
			},
		}
	}

	function normalizeTargetType(value) {
		const raw = String(value || "vault_file").trim().toLowerCase()
		if (raw === "vault") return "vault_file"
		if (raw === "notes") return "note"
		return raw
	}

	function formatCommentCountLabel(count) {
		const safeCount = Number(count || 0)
		return safeCount === 1 ? "1 comment" : String(safeCount) + " comments"
	}

	function syncHeaderCommentBadge(label) {
		const root = document.querySelector(
			".systemdeck-modal-root.sd-modal--comments",
		)
		if (!root) return
		const title = root.querySelector(".sd-modal-title")
		if (!title) return
		let badge = title.querySelector(".sd-modal-title-badge")
		if (!badge) {
			badge = document.createElement("span")
			badge.className = "sd-modal-title-badge"
			title.appendChild(badge)
		}
		badge.textContent = String(label || "")
	}

	function clearHeaderCommentBadge() {
		const root = document.querySelector(
			".systemdeck-modal-root.sd-modal--comments",
		)
		if (!root) return
		const title = root.querySelector(".sd-modal-title")
		if (!title) return
		const badge = title.querySelector(".sd-modal-title-badge")
		if (badge) badge.remove()
	}

	async function postAjax(action, fields) {
		const body = new URLSearchParams()
		body.append("action", action)
		const nonce = getNonce()
		if (nonce) {
			body.append("nonce", nonce)
			body.append("_ajax_nonce", nonce)
		}
		Object.keys(fields || {}).forEach((key) => {
			const value = fields[key]
			body.append(key, value == null ? "" : String(value))
		})
		const response = await fetch(getAjaxUrl(), {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			},
			body: body.toString(),
		})
		const json = await response.json()
		if (!response.ok || !json || json.success !== true) {
			const message =
				json?.data?.error || json?.data?.message || "Request failed."
			throw new Error(String(message))
		}
		return json.data || {}
	}

	function CommentsModal(props) {
		const targetId = Number(props?.targetId || 0)
		const normalizedTargetType = normalizeTargetType(props?.targetType)
		const commentsConfig = resolveCommentsConfig(props, targetId)
		const [commentsHtml, setCommentsHtml] = useState("")
		const [commentsCount, setCommentsCount] = useState(0)
		const [content, setContent] = useState("")
		const [loading, setLoading] = useState(true)
		const [posting, setPosting] = useState(false)
		const [error, setError] = useState("")
		const [replyToCommentId, setReplyToCommentId] = useState(0)
		const [replyToLabel, setReplyToLabel] = useState("")
		const textareaRef = useRef(null)

		useEffect(function () {
			syncHeaderCommentBadge(formatCommentCountLabel(commentsCount))
		}, [commentsCount])

		useEffect(function () {
			return function () {
				clearHeaderCommentBadge()
			}
		}, [])

		useEffect(
			function () {
				let mounted = true
				if (!targetId) {
					setLoading(false)
					setError("Missing target id.")
					return function () {}
				}

				async function loadAll() {
					setLoading(true)
					setError("")
					try {
						const requests = []
						if (commentsConfig.details && commentsConfig.details.action) {
							requests.push(
								postAjax(
									commentsConfig.details.action,
									commentsConfig.details.fields || {},
								),
							)
						} else {
							requests.push(Promise.resolve({}))
						}
						requests.push(
							postAjax(
								commentsConfig.thread.action,
								commentsConfig.thread.fields || {},
							),
						)
						const [details, thread] = await Promise.all(requests)
						if (!mounted) return
						setCommentsHtml(
							String(
								commentsConfig.thread.getHtml
									? commentsConfig.thread.getHtml(thread || {})
									: thread?.html || "",
							),
						)
						setCommentsCount(
							Number(
								commentsConfig.thread.getCount
									? commentsConfig.thread.getCount(thread || {})
									: thread?.count || 0,
							),
						)
					} catch (err) {
						if (!mounted) return
						setError(String(err?.message || err || "Unable to load comments."))
					} finally {
						if (mounted) setLoading(false)
					}
				}

				loadAll()
				return function () {
					mounted = false
				}
			},
			[targetId, props?.title, props?.modalTitle, normalizedTargetType],
		)

		function onThreadClick(event) {
			const trigger = event.target.closest(
				".comment-reply-link, .reply a, .sd-reply-btn",
			)
			if (!trigger) return
			event.preventDefault()
			event.stopPropagation()
			const commentId = parseReplyTargetId(trigger)
			if (!commentId) return
			const thread = trigger.closest(
				".sd-thread-comment, .dashboard-comment-wrap, li",
			)
			const authorEl = thread
				? thread.querySelector(
						".sd-thread-author, cite, .comment-author .fn",
				  )
				: null
			const author = String(authorEl?.textContent || "").trim()
			setReplyToCommentId(commentId)
			setReplyToLabel(author ? "@" + author : "@user")
			if (textareaRef.current && typeof textareaRef.current.focus === "function") {
				textareaRef.current.focus()
			}
		}

		async function onPostComment(event) {
			event.preventDefault()
			if (!targetId || posting) return
			const trimmed = String(content || "").trim()
			if (!trimmed) return
			setPosting(true)
			setError("")
			try {
				await postAjax(
					commentsConfig.add.action,
					commentsConfig.add.fields(trimmed, replyToCommentId || 0),
				)
				setContent("")
				setReplyToCommentId(0)
				setReplyToLabel("")
				const thread = await postAjax(
					commentsConfig.thread.action,
					commentsConfig.thread.fields || {},
				)
				const nextCount = Number(
					commentsConfig.thread.getCount
						? commentsConfig.thread.getCount(thread || {})
						: thread?.count || 0,
				)
				setCommentsHtml(
					String(
						commentsConfig.thread.getHtml
							? commentsConfig.thread.getHtml(thread || {})
							: thread?.html || "",
					),
				)
				setCommentsCount(nextCount)
				document.dispatchEvent(
					new CustomEvent("systemdeck:comments:count-updated", {
						detail: {
							targetType: normalizedTargetType,
							targetId: targetId,
							count: nextCount,
						},
					}),
				)
			} catch (err) {
				setError(String(err?.message || err || "Unable to post comment."))
			} finally {
				setPosting(false)
			}
		}

		return createElement(
			"div",
			{ className: "sd-comments-modal" },
			error
				? createElement("p", { className: "sd-comments-error" }, error)
				: null,
			loading
				? createElement("p", { className: "sd-comments-loading" }, "Loading discussion...")
				: createElement(
						"div",
						{
							className: "sd-comments-thread-list",
							onClick: onThreadClick,
						},
						createElement("div", {
							className: "sd-comments-thread-html",
							dangerouslySetInnerHTML: {
								__html:
									commentsHtml ||
									'<p class="description sd-comments-empty">No comments yet.</p>',
							},
						}),
				  ),
			createElement(
				"form",
				{
					className: "sd-comments-composer",
					onSubmit: onPostComment,
				},
				createElement("textarea", {
					className: "sd-comments-input",
					rows: 3,
					placeholder: "Write a comment...",
					value: content,
					ref: textareaRef,
					onChange: function (event) {
						setContent(event.target.value)
					},
				}),
				replyToCommentId > 0
					? createElement(
							"div",
							{ className: "sd-comments-reply-state" },
							createElement(
								"span",
								{ className: "sd-comments-reply-target" },
								replyToLabel || "@user",
							),
							createElement(
								"button",
								{
									type: "button",
									className: "button-link button-small",
									onClick: function () {
										setReplyToCommentId(0)
										setReplyToLabel("")
									},
								},
								"Cancel",
							),
					  )
					: null,
				createElement(
					"button",
					{
						type: "submit",
						className: "button button-primary sd-comments-submit",
						disabled: posting,
					},
					posting ? "Posting..." : "Post Comment",
				),
				),
		)
	}

	function register() {
		const shell = window.SystemDeckModalShell
		if (!shell || typeof shell.register !== "function") return
		shell.register("comments", function (props) {
			return createElement(CommentsModal, props || {})
		})
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", register)
	} else {
		register()
	}
})(window)
