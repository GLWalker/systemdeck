/**
 * SystemDeck Vault Widget - Main Controller
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/vault/app.js
 * @license GPL-2.0-or-later
 *
 * Handles file dropzone, upload progress, and grid rendering securely based on workspace contexts.
 */
;(function ($) {
	"use strict"

	function ajaxUrl() {
		return (
			window.sd_vault_bridge?.ajaxurl ||
			window.sd_vars?.ajaxurl ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"
		)
	}

	function getNonce() {
		return (
			window.sd_vault_bridge?.nonce ||
			window.SystemDeckSecurity?.nonce ||
			window.sd_vars?.nonce ||
			window.sd_vars?.vault_nonce ||
			""
		)
	}

	function first($root, selectors) {
		for (let i = 0; i < selectors.length; i++) {
			const found = $root.find(selectors[i]).first()
			if (found.length) return found
		}
		return $()
	}

	function globalFirst(selectors) {
		for (let i = 0; i < selectors.length; i++) {
			const found = $(selectors[i]).first()
			if (found.length) return found
		}
		return $()
	}

	function asError(value, fallback) {
		if (value?.error) return String(value.error)
		if (value?.message) return String(value.message)
		if (typeof value === "string") return value
		return fallback || "Request failed"
	}

	const VaultWidget = {
		interval: null,
		mediaFrame: null,
		mediaPanelInterval: null,
		mediaExtensionState: {
			isShared: false,
			priority: "low",
		},
		mediaFrameContext: null,
		audioStateUnsubscribe: null,
		audioTimeUnsubscribe: null,
		audioErrorUnsubscribe: null,
		externalEventsBound: false,
		currentPage: 1,
		totalPages: 1,
		currentFiles: [],
		wrapper: null,
		currentDetailsFile: null,
		detailsRequestToken: 0,

		init: function () {
			if (this.interval) clearInterval(this.interval)

			const self = this
			const hydrate = function () {
				$(".sd-vault-wrapper").each(function () {
					const el = $(this)
					if (el.data("sd-vault-init")) return
					el.data("sd-vault-init", true)
					self.wrapper = el
					self.bindEvents()
					self.setupExternalEvents()
					self.prepareModals()
					self.loadFiles()
				})
			}

			hydrate()
			this.interval = setInterval(hydrate, 1000)
		},

		prepareModals: function () {
			const details = this.detailsModal()
			const comments = this.commentsModal()

			if (details.length && !details.data("sd-vault-body-mounted")) {
				details
					.data("sd-vault-body-mounted", true)
					.appendTo(document.body)
					.attr("aria-modal", "true")
			}
			if (comments.length && !comments.data("sd-vault-body-mounted")) {
				comments
					.data("sd-vault-body-mounted", true)
					.appendTo(document.body)
			}
		},

		detailsModal: function () {
			return globalFirst([
				".sd-vault-details-shell-modal",
				"#sd-vault-details-modal",
			])
		},

		commentsModal: function () {
			return globalFirst([
				".sd-vault-comments-modal",
				"#sd-vault-comments-modal",
			])
		},

		findInDetails: function (selectors) {
			return first(this.detailsModal(), selectors)
		},

		findInComments: function (selectors) {
			return first(this.commentsModal(), selectors)
		},

		setupExternalEvents: function () {
			if (this.externalEventsBound) return
			this.externalEventsBound = true

			const self = this
			document.addEventListener(
				"systemdeck:open-vault-file",
				function (e) {
					const detail = e?.detail || {}
					const fileId = Number(detail.fileId || 0)
					const targetWorkspace = String(detail.workspaceId || "")
					if (!fileId) return
					if (
						targetWorkspace &&
						targetWorkspace !== String(self.getCurrentWorkspaceId())
					)
						return

					if ((detail.mode || "read") === "edit") {
						self.handleEditAction(fileId)
					} else {
						self.openComments(fileId)
					}
				},
			)
		},

		bindEvents: function () {
			const self = this
			const wrapper = this.wrapper
			if (!wrapper || !wrapper.length) return

			wrapper.off(".sdVault")
			this.detailsModal().off(".sdVault")
			this.commentsModal().off(".sdVault")

			wrapper.on(
				"click.sdVault",
				".sd-vault-upload-file, #sd-vault-upload-file",
				function (e) {
					e.preventDefault()
					first(wrapper, [
						".sd-vault-file-input",
						"#sd-vault-file-input",
					]).trigger("click")
				},
			)

			wrapper.on(
				"change.sdVault",
				".sd-vault-file-input, #sd-vault-file-input",
				function () {
					const file =
						this.files && this.files[0] ? this.files[0] : null
					if (!file) return
					self.uploadSelectedFile(file)
						.catch(() => {})
						.finally(() => {
							this.value = ""
						})
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-open-media, #sd-vault-open-media",
				function (e) {
					e.preventDefault()
					self.openMediaFrame()
				},
			)

			$(document)
				.off("change.sdVaultDetailsSharedToggle")
				.on(
					"change.sdVaultDetailsSharedToggle",
					".sd-vault-details-is-shared, #sd-vault-details-is-shared",
					function () {
						self.findInDetails([
							".sd-vault-details-priority-wrap",
							"#sd-vault-details-priority-wrap",
						]).toggle($(this).is(":checked"))
						self.updateDetailsPriorityBadge()
					},
				)

			$(document)
				.off("change.sdVaultPriorityLevel")
				.on(
					"change.sdVaultPriorityLevel",
					"input[name='sd_vault_priority']",
					function () {
						self.updateDetailsPriorityBadge()
					},
				)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .sd-action-view, .sd-vault-item .row-title",
				function (e) {
					e.preventDefault()
					self.handleViewAction(
						$(this).closest(".sd-vault-item").data("id"),
					)
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .column-comments a, .sd-vault-item .post-com-count",
				function (e) {
					e.preventDefault()
					const row = $(this).closest(".sd-vault-item")
					self.openComments(
						row.data("id"),
						row.find(".row-title").text().trim(),
					)
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .sd-action-edit",
				function (e) {
					e.preventDefault()
					self.handleEditAction(
						$(this).closest(".sd-vault-item").data("id"),
					)
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .sd-action-export",
				function (e) {
					e.preventDefault()
					const id = $(this).closest(".sd-vault-item").data("id")
					const isPublic =
						String($(this).data("storage-mode") || "") ===
						"media_public"
					self.exportToggle(id, isPublic, $(this))
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .sd-action-trash",
				function (e) {
					e.preventDefault()
					const id = $(this).closest(".sd-vault-item").data("id")
					if (
						!window.confirm(
							"Are you sure you want to permanently delete this file?",
						)
					)
						return
					self.postAction("sd_core_vault_ajax_delete_file", { id })
						.then(() => {
							self.loadFiles()
							document.dispatchEvent(
								new CustomEvent("systemdeck:refresh-pins"),
							)
						})
						.catch((err) => alert("Delete failed: " + err))
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-item .sd-note-pin-btn",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					const id = $(this).closest(".sd-vault-item").data("id")
					if (!id) return
					self.postAction("sd_toggle_vault_sticky", { id })
						.then(() => self.loadFiles())
						.catch((err) =>
							console.error("Sticky toggle failed:", err),
						)
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-prev, #sd-vault-prev",
				function (e) {
					e.preventDefault()
					if (self.currentPage > 1) {
						self.currentPage--
						self.loadFiles()
					}
				},
			)

			wrapper.on(
				"click.sdVault",
				".sd-vault-next, #sd-vault-next",
				function (e) {
					e.preventDefault()
					if (self.currentPage < self.totalPages) {
						self.currentPage++
						self.loadFiles()
					}
				},
			)

			$(document)
				.off("click.sdVaultDetailsComment")
				.on(
					"click.sdVaultDetailsComment",
					".sd-vault-details-save-comment, #sd-vault-details-save-comment",
					function (e) {
						e.preventDefault()
						e.stopPropagation()
						self.saveComment("details")
					},
				)

			$(document)
				.off("click.sdVaultReply")
				.on(
					"click.sdVaultReply",
					".sd-vault-details-shell-modal .sd-reply-btn, #sd-vault-details-modal .sd-reply-btn",
					function (e) {
						e.preventDefault()
						const parentId = $(this).data("id")
						self.findInDetails([
							".sd-vault-details-parent-comment",
							"#sd-vault-details-parent-comment",
						]).val(parentId)
						self.findInDetails([
							".sd-vault-details-new-comment",
							"#sd-vault-details-new-comment",
						])
							.attr("placeholder", "Replying to thread...")
							.focus()
					},
				)
				.on(
					"click.sdVaultReply",
					".sd-vault-comments-modal .sd-reply-btn, #sd-vault-comments-modal .sd-reply-btn",
					function (e) {
						e.preventDefault()
						const parentId = $(this).data("id")
						self.findInComments([
							".sd-vault-parent-comment",
							"#sd-vault-parent-comment",
						]).val(parentId)
						self.findInComments([
							".sd-vault-new-comment",
							"#sd-vault-new-comment",
						])
							.attr("placeholder", "Replying to thread...")
							.focus()
					},
				)

			$(document)
				.off("click.sdVaultClose")
				.on(
					"click.sdVaultClose",
					".sd-vault-details-close, #sd-vault-details-close",
					function (e) {
						e.preventDefault()
						self.closeDetailsModal()
					},
				)
				.on(
					"click.sdVaultClose",
					".sd-vault-details-shell-modal > .media-modal-backdrop, #sd-vault-details-modal > .media-modal-backdrop",
					function (e) {
						e.preventDefault()
						self.closeDetailsModal()
					},
				)
				.on(
					"click.sdVaultClose",
					".sd-vault-comments-close, #sd-vault-comments-close",
					function (e) {
						e.preventDefault()
						self.commentsModal().hide()
					},
				)
				.on(
					"click.sdVaultClose",
					".sd-vault-comments-modal, #sd-vault-comments-modal",
					function (e) {
						if (e.target !== this) return
						e.preventDefault()
						$(this).hide()
					},
				)

			$(document)
				.off("click.sdVaultCopyAttachmentUrl")
				.on(
					"click.sdVaultCopyAttachmentUrl",
					".sd-vault-details-shell-modal .copy-attachment-url, #sd-vault-details-modal .copy-attachment-url",
					async function (e) {
						e.preventDefault()
						const input = self.findInDetails([
							".sd-vault-details-copy-link",
							"#sd-vault-details-copy-link",
						])
						const value = String(input.val() || "")
						if (!value) return
						try {
							if (navigator.clipboard?.writeText)
								await navigator.clipboard.writeText(value)
							else {
								input.trigger("focus").trigger("select")
								document.execCommand("copy")
							}
							const success = $(this).siblings(".success")
							success.removeClass("hidden")
							window.setTimeout(
								() => success.addClass("hidden"),
								1200,
							)
						} catch (_err) {}
					},
				)

			$(document)
				.off("click.sdVaultDetailsNav")
				.on(
					"click.sdVaultDetailsNav",
					".sd-vault-details-prev, .sd-vault-details-next, #sd-vault-details-prev, #sd-vault-details-next",
					function (e) {
						e.preventDefault()
						const currentId = Number(
							self
								.findInDetails([
									".sd-vault-details-id",
									"#sd-vault-details-id",
								])
								.val() || 0,
						)
						const ids = (self.currentFiles || [])
							.map((file) => Number(file?.id || 0))
							.filter((id) => id > 0)
						const index = ids.indexOf(currentId)
						if (index === -1) return
						const targetIndex = $(this).is(
							".sd-vault-details-prev, #sd-vault-details-prev",
						)
							? index - 1
							: index + 1
						const targetId = Number(ids[targetIndex] || 0)
						if (targetId > 0) self.openDetails(targetId)
					},
				)
		},

		isMidiFile: function (file) {
			const mime = String(file?.mime || file?.type || "").toLowerCase()
			const title = String(
				file?.title || file?.filename || file?.name || "",
			).toLowerCase()
			return (
				mime.includes("midi") ||
				title.endsWith(".mid") ||
				title.endsWith(".midi")
			)
		},

		formatTime: function (seconds) {
			const total = Math.max(0, Math.floor(Number(seconds) || 0))
			const min = Math.floor(total / 60)
			const sec = total % 60
			return `${min}:${String(sec).padStart(2, "0")}`
		},

		capitalize: function (value) {
			const text = String(value || "").trim()
			if (!text) return ""
			return text.charAt(0).toUpperCase() + text.slice(1)
		},

		getCurrentWorkspaceName: function () {
			return (
				window.sd_vars?.active_workspace_title ||
				$("#sd-workspace-title").text().trim() ||
				document.title
					.split("‹")[0]
					.trim()
					.replace(" - WordPress", "")
					.trim() ||
				"Admin"
			)
		},

		getCurrentWorkspaceId: function () {
			return (
				this.wrapper?.data("workspace-id") ||
				localStorage.getItem("sd_active_workspace") ||
				window.sd_vars?.active_workspace ||
				window.SYSTEMDECK_BOOTSTRAP?.config?.activeWorkspace ||
				"default"
			)
		},

		getAudioRuntime: function () {
			return window.SystemDeckAudio || null
		},

		sdAdvancedMediaModalEnabled: function () {
			return (
				window.sd_vars?.audio?.advancedMediaModal === true ||
				window.SYSTEMDECK_BOOTSTRAP?.config?.audio
					?.advancedMediaModal === true ||
				window.SYSTEMDECK_ENV?.audio?.advancedMediaModal === true
			)
		},

		sdAdvancedVaultModalEnabled: function () {
			return (
				window.sd_vars?.audio?.advancedVaultModal === true ||
				window.SYSTEMDECK_BOOTSTRAP?.config?.audio
					?.advancedVaultModal === true ||
				window.SYSTEMDECK_ENV?.audio?.advancedVaultModal === true
			)
		},

		postAction: function (action, data = {}) {
			return new Promise((resolve, reject) => {
				$.post(
					ajaxUrl(),
					{
						action,
						nonce: getNonce(),
						_ajax_nonce: getNonce(),
						...data,
					},
					function (res) {
						if (res && res.success) {
							resolve(res.data)
							return
						}
						reject(asError(res?.data, "Request failed"))
					},
				).fail(function (_xhr, _status, error) {
					reject(error || "Request failed")
				})
			})
		},

		getPlayerVaultPlaylistItem: function (fileId) {
			const targetId = String(fileId || "")
			return new Promise((resolve, reject) => {
				$.post(
					ajaxUrl(),
					{
						action: "sd_player_get_playlist",
						nonce: getNonce(),
						_ajax_nonce: getNonce(),
						workspace_id: this.getCurrentWorkspaceId(),
					},
					function (res) {
						if (!(res && res.success && res.data)) {
							reject("Unable to load player playlist.")
							return
						}
						const items = Array.isArray(res.data.items)
							? res.data.items
							: []
						const item = items.find(
							(entry) =>
								String(entry?.origin || "") === "vault" &&
								String(entry?.id || "") === targetId,
						)
						if (!item) {
							reject("Vault item not found in player playlist.")
							return
						}
						resolve(item)
					},
				).fail(function (_xhr, _status, error) {
					reject(error || "Unable to load player playlist.")
				})
			})
		},

		escapeHtml: function (value) {
			return $("<div>")
				.text(String(value ?? ""))
				.html()
		},

		getFileIconClass: function (file) {
			const mime = String(file?.mime || "").toLowerCase()
			if (mime.includes("image")) return "dashicons-format-image"
			if (mime.includes("pdf")) return "dashicons-media-document"
			if (mime.includes("audio") || mime.includes("midi"))
				return "dashicons-media-audio"
			if (mime.includes("video")) return "dashicons-media-video"
			if (mime.includes("zip")) return "dashicons-media-archive"
			return "dashicons-media-default"
		},

		renderWorkspaceLabel: function (file) {
			const originName = String(file?.origin_workspace_name || "")
			const originHtml = originName
				? this.escapeHtml(originName)
				: "&mdash;"
			const modeLabel =
				String(file?.storage_mode || "") === "media_public"
					? "Public"
					: "Private"
			const isPinned = file?.scope === "pinned"
			const pinnedName = String(file?.workspace_name || "")
			if (isPinned) {
				const pinnedDisplay = pinnedName ? ` ${pinnedName}` : ""
				const priority = String(file?.priority || "low").toLowerCase()
				const level = ["urgent", "high", "moderate", "low"].includes(
					priority,
				)
					? priority
					: "low"
				return `<span class="sd-vault-origin-label">${originHtml}</span><br/><strong class="sd-vault-pinned-label">Pinned${this.escapeHtml(
					pinnedDisplay,
				)}</strong> <span class="sd-vault-sep">|</span> <span class="sd-status-badge is-${level}">${this.capitalize(
					level,
				)}</span> <span class="sd-vault-sep">|</span> <span class="sd-vault-mode-label">${modeLabel}</span>`
			}
			return `<span class="sd-vault-origin-label">${originHtml}</span><br/><span class="sd-vault-mode-label">${modeLabel}</span>`
		},

		renderDateLabel: function (file) {
			if (file?.is_modified && file?.modified) {
				return `<span class="sd-vault-date-kind">Last Modified</span><br>${this.escapeHtml(
					file.modified,
				)}`
			}
			return `<span class="sd-vault-date-kind">Published</span><br>${this.escapeHtml(
				file?.date || "",
			)}`
		},

		updateDetailsPriorityBadge: function () {
			const modal = this.detailsModal()
			const badge = first(modal, [
				".sd-vault-priority-badge",
				"#sd-vault-priority-badge",
			])
			const isPinned = first(modal, [
				".sd-vault-details-is-shared",
				"#sd-vault-details-is-shared",
			]).is(":checked")
			const level = String(
				modal.find("input[name='sd_vault_priority']:checked").val() ||
					"low",
			).toLowerCase()
			const allowed = ["urgent", "high", "moderate", "low"]
			const safeLevel = allowed.includes(level) ? level : "low"

			badge.removeClass("is-urgent is-high is-moderate is-low")
			if (!isPinned) {
				badge.hide().text("")
				return
			}

			badge
				.addClass(`is-${safeLevel}`)
				.text(this.capitalize(safeLevel))
				.css("display", "inline-block")
		},

		getSelectedMediaAttachment: function (frame) {
			const selection = frame?.state?.()?.get?.("selection")
			const model = selection?.first?.()
			return model?.toJSON?.() || null
		},

		isAttachmentAudioLike: function (attachment) {
			const mime = String(attachment?.mime || "").toLowerCase()
			return mime.startsWith("audio/") || this.isMidiFile(attachment)
		},

		resetMediaExtensionState: function () {
			this.mediaExtensionState = { isShared: false, priority: "low" }
		},

		ensureImportMediaFrame: function () {
			if (this.importFrame) return this.importFrame
			if (typeof wp === "undefined" || !wp.media) return null

			const self = this
			const frame = wp.media({
				title: "Add from Media Library",
				library: { type: null },
				button: { text: "Add to Vault" },
				multiple: false,
			})

			frame.on("open", function () {
				self.resetMediaExtensionState()
				self.startMediaExtensionLoop(frame)
			})

			frame.on("close", function () {
				self.stopMediaExtensionLoop()
				self.resetMediaExtensionState()
			})

			frame.on("select", async function () {
				const attachment = self.getSelectedMediaAttachment(frame)
				if (!attachment) return
				try {
					await self.linkAttachmentFromSelection(attachment)
					frame.close()
				} catch (error) {
					window.alert(
						String(
							error?.message ||
								error ||
								"Unable to add attachment to Vault.",
						),
					)
				}
			})

			this.importFrame = frame
			return frame
		},

		openMediaFrame: function () {
			this.mediaFrameContext = { type: "import" }
			this.closeDetailsModal()
			const frame = this.ensureImportMediaFrame()
			if (!frame) {
				window.alert("WordPress media is unavailable on this screen.")
				return
			}
			frame.open()
		},

		getAttachmentEditUrl: function (attachment) {
			const direct = String(attachment?.editLink || "")
			if (direct) return direct
			const id = Number(attachment?.id || 0)
			if (!id) return "#"
			const url = ajaxUrl()
			return url
				? url.replace(
						/admin-ajax\.php(?:\?.*)?$/,
						`post.php?post=${id}&action=edit`,
				  )
				: `/wp-admin/post.php?post=${id}&action=edit`
		},

		startMediaExtensionLoop: function (frame) {
			this.stopMediaExtensionLoop()
			const self = this
			this.mediaPanelInterval = window.setInterval(function () {
				self.renderMediaExtension(frame)
			}, 150)
			self.renderMediaExtension(frame)
		},

		stopMediaExtensionLoop: function () {
			if (this.mediaPanelInterval)
				window.clearInterval(this.mediaPanelInterval)
			this.mediaPanelInterval = null
		},

		getMediaExtensionSettings: function () {
			const panel = $(".sd-vault-media-extension").first()
			const isShared = panel
				.find("[data-sd-vault-is-shared]")
				.is(":checked")
			const priority = String(
				panel
					.find("input[name='sd_vault_media_priority']:checked")
					.val() || "low",
			).toLowerCase()
			this.mediaExtensionState = { isShared, priority }
			return this.mediaExtensionState
		},

		linkAttachmentFromSelection: function (attachment) {
			const self = this
			const settings = self.getMediaExtensionSettings()
			return self
				.postAction("sd_core_vault_ajax_link_attachment", {
					attachment_id: Number(attachment?.id || 0),
					workspace_id: self.getCurrentWorkspaceId(),
					workspace_name: self.getCurrentWorkspaceName(),
					is_shared: settings.isShared ? 1 : 0,
					priority: settings.priority || "low",
				})
				.then((data) => {
					self.loadFiles()
					if (settings.isShared)
						document.dispatchEvent(
							new CustomEvent("systemdeck:refresh-pins"),
						)
					return data
				})
		},

		renderMediaExtension: function (frame) {
			const self = this
			const attachment = this.getSelectedMediaAttachment(frame)
			const frameEl = frame?.$el
			if (!frameEl || !frameEl.length) return

			const context = this.mediaFrameContext || { type: "import" }
			const isItemMode = context.type === "item" && context.file
			const file = isItemMode ? context.file : null

			if (!attachment) {
				frameEl.removeData("sdVaultRenderKey")
				frameEl.find(".sd-vault-media-extension").remove()
				return
			}

			// If in item mode, verify the selected attachment matches the file's attachment_id
			if (
				isItemMode &&
				Number(attachment.id) !== Number(file.attachment_id)
			) {
				frameEl.removeData("sdVaultRenderKey")
				frameEl.find(".sd-vault-media-extension").remove()
				return
			}

			const settings = this.mediaExtensionState || {
				isShared: isItemMode ? file.scope === "pinned" : false,
				priority: isItemMode ? file.priority || "low" : "low",
			}

			const renderKey = JSON.stringify([
				context.type,
				String(attachment?.id || ""),
				settings.isShared ? 1 : 0,
				settings.priority || "low",
				isItemMode ? file.id : "new",
			])
			if (frameEl.data("sdVaultRenderKey") === renderKey) return
			frameEl.data("sdVaultRenderKey", renderKey)

			frameEl.find(".sd-vault-media-extension").remove()

			const detailsHost = frameEl
				.find(
					".sd-vault-native-extension-host, .attachment-info, .attachment-details",
				)
				.first()

			const midi = this.isMidiFile(attachment)

			if (detailsHost.length) {
				this.renderVaultPanel(frameEl, file, attachment, frame)
				if (midi && isItemMode && file) {
					this.loadMidiEditor(frameEl, file)
				}
			}

			if (this.isAttachmentAudioLike(attachment)) {
				const mediaHost = frameEl.find(".attachment-media-view").first()
				if (mediaHost.length) {
					const hasPlayerRuntime = this.sdAdvancedMediaModalEnabled()
					if (!hasPlayerRuntime) {
						mediaHost.removeClass("sd-vault-has-systemdeck-player")
						this.unmountCanonicalModalPlayer(frameEl, "media-modal")
						mediaHost
							.find(
								".sd-vault-media-audio-extension, .sd-vault-midi-player-bridge, .sd-vault-modal-player-surface",
							)
							.remove()
						return
					}

					mediaHost.addClass("sd-vault-has-systemdeck-player")
					mediaHost
						.find(
							".sd-vault-media-audio-extension, .sd-vault-midi-player-bridge, .sd-vault-modal-player-surface",
						)
						.remove()

					const runtimeFile = isItemMode && file
						? file
						: {
								id: attachment.id,
								title:
									attachment.title ||
									attachment.filename ||
									"Media Attachment",
								stream_url:
									attachment.stream_url || attachment.url || "",
								mime: attachment.mime || "",
								active_derivative:
									attachment.midi_derivative || null,
						  }

					mediaHost.prepend(
						this.renderModalPlayerSurfaceHTML(runtimeFile, {
							midi,
							includeTools: midi && isItemMode && !!file,
							context: "media-modal",
						}),
					)
					this.mountCanonicalModalPlayer(
						frameEl,
						runtimeFile,
						"media-modal",
					)
				}
			}

			frameEl.off(".sdVaultMediaFrame")
			frameEl.off(".sdVaultAuthorityActions")

			// Update state on change
			frameEl.on(
				"change.sdVaultMediaFrame",
				".sd-vault-details-is-shared, .sd-vault-details-priority",
				() => {
					const panel = frameEl
						.find(".sd-vault-media-extension")
						.first()
					this.mediaExtensionState = {
						isShared: panel
							.find(".sd-vault-details-is-shared")
							.is(":checked"),
						priority:
							panel.find(".sd-vault-details-priority").val() ||
							"low",
					}
					frameEl.removeData("sdVaultRenderKey")
					this.renderMediaExtension(frame)
				},
			)

			// Bind Phase 2F Actions (Import)
			frameEl.on(
				"click.sdVaultAuthorityActions",
				".sd-vault-action-copy-from-media",
				async (e) => {
					const btn = $(e.currentTarget)
					btn.prop("disabled", true).text("Copying...")
					try {
						const settings = self.getMediaExtensionSettings()
						await self.postAction(
							"sd_core_vault_ajax_copy_from_media_library",
							{
								attachment_id: Number(attachment?.id || 0),
								workspace_id: self.getCurrentWorkspaceId(),
								workspace_name: self.getCurrentWorkspaceName(),
								is_shared: settings.isShared ? 1 : 0,
								priority: settings.priority || "low",
							},
						)
						self.loadFiles()
						frame.close()
					} catch (error) {
						alert(error)
						btn.prop("disabled", false).text("Copy to Vault")
					}
				},
			)

			frameEl.on(
				"click.sdVaultAuthorityActions",
				".sd-vault-action-publish-from-media",
				async (e) => {
					const btn = $(e.currentTarget)
					if (
						!window.confirm(
							"Publishing will move this file into Vault and DELETE it from the Media Library. Continue?",
						)
					)
						return
					btn.prop("disabled", true).text("Publishing...")
					try {
						const settings = self.getMediaExtensionSettings()
						await self.postAction(
							"sd_core_vault_ajax_publish_to_vault",
							{
								attachment_id: Number(attachment?.id || 0),
								workspace_id: self.getCurrentWorkspaceId(),
								workspace_name: self.getCurrentWorkspaceName(),
								is_shared: settings.isShared ? 1 : 0,
								priority: settings.priority || "low",
							},
						)
						self.loadFiles()
						frame.close()
					} catch (error) {
						alert(error)
						btn.prop("disabled", false).text("Publish to Vault")
					}
				},
			)

			frameEl.on(
				"click.sdVaultMediaFrame",
				"[data-sd-vault-audio-open]",
				async (e) => {
					e.preventDefault()
					await this.playAttachmentInRuntime(attachment)
				},
			)
			frameEl.on(
				"click.sdVaultMediaFrame",
				"[data-sd-vault-audio-stop]",
				(e) => {
					e.preventDefault()
					window.SystemDeckPlayback?.stop()
				},
			)
		},

		renderVaultPanel: function (
			container,
			file,
			attachment = null,
			frame = null,
		) {
			const self = this
			const context = this.mediaFrameContext || { type: "import" }
			const isItemMode =
				(context.type === "item" && context.file) ||
				(file && !attachment)
			const activeFile = isItemMode ? file || context.file : null

			const detailsHost = container
				.find(
					".sd-vault-native-extension-host, .attachment-info, .attachment-details",
				)
				.first()

			if (!detailsHost.length) return

			// Clean up previous injections to avoid duplicates
			detailsHost
				.find(
					".vault-id, .storage, .sd-vault-details-extension, .sd-vault-details-save-row",
				)
				.remove()
			detailsHost
				.find(
					'.setting[data-setting="sd-vault-is-shared"], .setting[data-setting="sd-vault-priority"]',
				)
				.remove()

			if (isItemMode && activeFile) {
				// 1. Details Injection (Vault ID & Storage)
				const details = detailsHost.find(".details").first()
				if (details.length) {
					const sizeRow = details.find(".file-size").first()
					const detailHtml = `
						<div class="vault-id">
							<strong>Vault ID:</strong>
							<span class="sd-vault-details-vault-id">#${activeFile.id}</span>
						</div>
						<div class="storage">
							<strong>Storage:</strong>
							<span class="sd-vault-details-storage">${this.escapeHtml(
								String(
									activeFile.storage_mode || "vault private",
								).replace("_", " "),
							)}</span>
						</div>
					`
					if (sizeRow.length) sizeRow.after(detailHtml)
					else details.append(detailHtml)
				}

				// 2. Settings Injection (Pin, Priority & Update Button)
				const settings = detailsHost.find(".settings").first()
				if (settings.length) {
					const settingsHtml = `
						<span class="setting" data-setting="sd-vault-is-shared">
							<label class="name">Pin to Workspace</label>
							<input type="checkbox" class="sd-vault-details-is-shared" ${
								activeFile.storage_mode === "media_public"
									? "checked"
									: ""
							}>
						</span>
						<span class="setting sd-vault-details-priority-wrap" data-setting="sd-vault-priority" style="${
							activeFile.storage_mode === "media_public"
								? ""
								: "display:none;"
						}">
							<label class="name">Priority</label>
							<span class="sd-vault-priority-radios setting">
								<label><input type="radio" name="sd_vault_priority_${
									activeFile.id
								}" value="low" ${
						activeFile.priority === "low" ? "checked" : ""
					}> Low</label>
								<label><input type="radio" name="sd_vault_priority_${
									activeFile.id
								}" value="moderate" ${
						activeFile.priority === "moderate" ? "checked" : ""
					}> Moderate</label>
								<label><input type="radio" name="sd_vault_priority_${
									activeFile.id
								}" value="high" ${
						activeFile.priority === "high" ? "checked" : ""
					}> High</label>
								<label><input type="radio" name="sd_vault_priority_${
									activeFile.id
								}" value="urgent" ${
						activeFile.priority === "urgent" ? "checked" : ""
					}> Urgent</label>
							</span>
						</span>
					`
					// Insert after the last native setting (usually Description or URL)
					const lastSetting = settings.find(".setting").last()
					if (lastSetting.length) lastSetting.after(settingsHtml)
					else settings.prepend(settingsHtml)
				}

				// 3. Extension Injection (Comments Only)
				const extensionHtml = `
					<div class="compat-item sd-vault-details-extension">
						<div class="sd-vault-media-extension" data-vault-file-id="${activeFile.id}">
							<div class="sd-vault-details-save-row">
								<button type="button" class="button button-primary sd-vault-save-details">Update Media Details</button>
							</div>
							<div class="sd-vault-details-comments-host">
								<h4>Discussion</h4>
								<div class="sd-vault-details-comments-list"></div>
								<div class="sd-vault-details-comment-form">
									<textarea class="widefat sd-vault-details-new-comment" rows="2" placeholder="Write a comment..."></textarea>
									<input type="hidden" class="sd-vault-details-parent-comment" value="0">
									<p class="submit">
										<button type="button" class="button button-small sd-vault-details-save-comment">Post Comment</button>
									</p>
								</div>
							</div>
						</div>
					</div>
				`
				const settingsContainer = detailsHost.find(".settings").first()
				if (settingsContainer.length)
					settingsContainer.after(extensionHtml)

				// Bind visibility toggle for Priority
				detailsHost
					.off("change.sdVaultPin")
					.on(
						"change.sdVaultPin",
						".sd-vault-details-is-shared",
						function () {
							detailsHost
								.find(".sd-vault-details-priority-wrap")
								.toggle($(this).is(":checked"))
						},
					)
			} else {
				// Import mode shell
				const panelHtml = `
					<div class="compat-item sd-vault-details-extension">
						<div class="sd-vault-media-extension">
							<div class="sd-vault-media-extension__heading">SystemDeck Vault</div>
							<p class="description">This item is not yet in the SystemDeck Vault.</p>
							<div class="sd-vault-extension-actions">
								<button type="button" class="button button-secondary sd-vault-action-copy-from-media">Import to Vault</button>
							</div>
						</div>
					</div>
				`
				const insertionPoint = detailsHost
					.find(".settings, #sd-vault-details-save-row")
					.first()
				if (insertionPoint.length) insertionPoint.after(panelHtml)
				else detailsHost.append(panelHtml)
			}

			// 4. Actions Injection (Copy/Publish Links)
			const actions = detailsHost.find(".actions").first()
			if (actions.length) {
				actions
					.find(
						".sd-vault-details-action-copy, .sd-vault-details-action-publish, .sd-vault-details-copy-sep",
					)
					.remove()
				if (isItemMode && activeFile) {
					actions.append(`
						<span class="links-separator sd-vault-details-copy-sep">|</span>
						<button type="button" class="button-link sd-vault-details-action-copy" data-id="${activeFile.id}">Copy to Media Library</button>
						<span class="links-separator sd-vault-details-copy-sep">|</span>
						<button type="button" class="button-link sd-vault-details-action-publish" data-id="${activeFile.id}">Publish to Media Library</button>
					`)
				}
			}

			// Initialize comments if in item mode
			if (isItemMode && activeFile) {
				this.loadComments(activeFile.id, "details")
			}

			// Authority Event Handlers
			detailsHost
				.off("click.sdVaultCopy")
				.on(
					"click.sdVaultCopy",
					".sd-vault-details-action-copy",
					function () {
						const id = $(this).data("id")
						self.postAction(
							"sd_core_vault_ajax_copy_to_media_library",
							{ id },
						)
							.then(() => {
								self.loadFiles()
								if (frame) frame.close()
								else self.closeDetailsModal()
							})
							.catch((err) => alert(err))
					},
				)

			detailsHost
				.off("click.sdVaultPublish")
				.on(
					"click.sdVaultPublish",
					".sd-vault-details-action-publish",
					function () {
						const id = $(this).data("id")
						if (
							!window.confirm(
								"Publishing will move this file into the Media Library and DELETE it from Vault. Continue?",
							)
						)
							return
						self.postAction(
							"sd_core_vault_ajax_publish_to_media_library",
							{ id },
						)
							.then(() => {
								self.loadFiles()
								if (frame) frame.close()
								else self.closeDetailsModal()
							})
							.catch((err) => alert(err))
					},
				)

			// Import Action Handler
			detailsHost
				.off("click.sdVaultImport")
				.on(
					"click.sdVaultImport",
					".sd-vault-action-copy-from-media",
					async (e) => {
						const btn = $(e.currentTarget)
						btn.prop("disabled", true).text("Importing...")
						try {
							await self.postAction(
								"sd_core_vault_ajax_copy_from_media_library",
								{
									attachment_id: Number(attachment?.id || 0),
									workspace_id: self.getCurrentWorkspaceId(),
									workspace_name:
										self.getCurrentWorkspaceName(),
									is_shared: 0,
									priority: "low",
								},
							)
							self.loadFiles()
							if (frame) frame.close()
							else self.closeDetailsModal()
						} catch (err) {
							alert(err)
							btn.prop("disabled", false).text("Import to Vault")
						}
					},
				)
		},

		playAttachmentInRuntime: async function (attachment) {
			const sourceUrl = String(
				attachment?.stream_url || attachment?.url || "",
			)
			if (!sourceUrl) {
				window.alert("Audio source unavailable.")
				return
			}

			const midi = this.isMidiFile(attachment)
			document.dispatchEvent(
				new CustomEvent("systemdeck:vault-play", {
					detail: {
						url: sourceUrl,
						meta: {
							id: String(attachment.id || ""),
							title:
								attachment.title ||
								attachment.filename ||
								"Media Attachment",
							mime: attachment.mime || "",
							origin: "vault-media",
							mediaType: midi ? "midi" : "file",
							artwork:
								attachment.artwork ||
								attachment.artworkUrl ||
								attachment.thumbnail ||
								attachment.cover ||
								null,
							artworkUrl:
								attachment.artworkUrl ||
								attachment.artwork ||
								attachment.thumbnail ||
								attachment.cover ||
								null,
							thumbnail:
								attachment.thumbnail ||
								attachment.artwork ||
								attachment.artworkUrl ||
								attachment.cover ||
								null,
							cover:
								attachment.cover ||
								attachment.artwork ||
								attachment.artworkUrl ||
								attachment.thumbnail ||
								null,
							duration: Number(attachment.duration || 0),
							attachmentId: Number(
								attachment.attachment_id || attachment.id || 0,
							),
							linkedVaultId:
								Number(attachment.linked_vault_id || 0) || null,
							midiDerivative: attachment.midi_derivative || null,
						},
					},
				}),
			)
		},

		handleViewAction: async function (id) {
			try {
				const file = await this.fetchFileDetails(id)
				const viewUrl = String(file?.stream_url || "")
				if (!viewUrl) throw new Error("Media URL unavailable.")
				window.open(viewUrl, "_blank", "noopener")
			} catch (error) {
				window.alert(
					String(error?.message || error || "Unable to open file."),
				)
			}
		},

		handleEditAction: function (id) {
			this.openDetails(id)
		},

		fetchFileDetails: function (id) {
			return this.postAction("sd_core_vault_ajax_get_file_details", {
				id,
			})
		},

		exportToggle: function (id, isPublic, btn) {
			const confirmText = isPublic
				? "Return this file to private Vault mode?"
				: "Publish this file to the global WordPress Media Library?"
			if (!window.confirm(confirmText)) return
			const oldText = btn?.text ? btn.text() : ""
			if (btn?.text) btn.text("...")
			this.postAction(
				isPublic
					? "sd_core_vault_ajax_make_private"
					: "sd_core_vault_ajax_export_to_media_library",
				{ id },
			)
				.then(() => {
					this.loadFiles()
					this.handleEditAction(id)
					window.alert(
						isPublic
							? "File returned to private Vault mode."
							: "File published to the WordPress Media Library.",
					)
				})
				.catch((err) =>
					window.alert(
						(isPublic
							? "Return to Vault failed: "
							: "Publish failed: ") + err,
					),
				)
				.finally(() => {
					if (btn?.text) btn.text(oldText)
				})
		},

		uploadSelectedFile: function (file) {
			const self = this
			const formData = new FormData()
			const button = first(this.wrapper, [
				".sd-vault-upload-file",
				"#sd-vault-upload-file",
			])
			const originalHtml = button.html()

			formData.append("action", "sd_core_vault_ajax_upload_file")
			formData.append("vault_file", file)
			formData.append("workspace_id", self.getCurrentWorkspaceId())
			formData.append("workspace_name", self.getCurrentWorkspaceName())
			formData.append("is_shared", "0")
			formData.append("priority", "low")
			formData.append("nonce", getNonce())
			formData.append("_ajax_nonce", getNonce())

			button.prop("disabled", true).text("Uploading...")

			return new Promise((resolve, reject) => {
				$.ajax({
					url: ajaxUrl(),
					type: "POST",
					data: formData,
					processData: false,
					contentType: false,
					success: function (res) {
						button.prop("disabled", false).html(originalHtml)
						if (!res?.success) {
							reject(asError(res?.data, "Upload failed."))
							return
						}

						const wasEmpty =
							!self.currentFiles || self.currentFiles.length === 0

						self.loadFiles()
						resolve(res.data)

						if (
							wasEmpty &&
							!sessionStorage.getItem(
								"systemdeck_vault_first_upload_refresh_done",
							)
						) {
							sessionStorage.setItem(
								"systemdeck_vault_first_upload_refresh_done",
								"1",
							)
							button.text("Vault initialized, refreshing...")
							setTimeout(() => {
								window.location.reload()
							}, 1000)
						}
					},
					error: function (_xhr, _status, error) {
						button.prop("disabled", false).html(originalHtml)
						reject(error || "Upload failed.")
					},
				})
			}).catch(function (error) {
				window.alert(
					String(error?.message || error || "Upload failed."),
				)
				throw error
			})
		},

		loadFiles: function () {
			const self = this
			if (!this.wrapper) return
			const tbody = first(this.wrapper, [
				".sd-vault-list",
				"#sd-vault-list",
			])
			const table = first(this.wrapper, [
				".sd-vault-table",
				"#sd-vault-table",
			])
			const emptyState = first(this.wrapper, [
				".sd-vault-empty-state",
				"#sd-vault-empty-state",
			])
			const pagination = first(this.wrapper, [
				".sd-vault-pagination",
				"#sd-vault-pagination",
			])
			const workspaceId = this.wrapper.data("workspace-id") || ""

			table.hide()
			pagination.hide()
			emptyState.hide()

			this.postAction("sd_core_vault_ajax_get_files", {
				limit: 5,
				paged: this.currentPage,
				workspace_id: workspaceId,
			})
				.then(function (data) {
					tbody.empty()
					if (!data.files || data.files.length === 0) {
						self.wrapper
							.find(
								".sd-vault-total-count, #sd-vault-total-count",
							)
							.text("0 items")
						self.wrapper
							.find(
								".sd-vault-current-page, #sd-vault-current-page",
							)
							.text("1")
						self.wrapper
							.find(
								".sd-vault-total-pages, #sd-vault-total-pages",
							)
							.text("1")
						self.wrapper
							.find(
								".sd-vault-prev, .sd-vault-next, #sd-vault-prev, #sd-vault-next",
							)
							.prop("disabled", true)
						table.hide()
						pagination.hide()
						emptyState.show()
						return
					}

					self.totalPages = parseInt(data.max_pages, 10) || 1
					self.currentPage =
						parseInt(data.paged, 10) || self.currentPage
					self.currentFiles = Array.isArray(data.files)
						? data.files
						: []

					self.wrapper
						.find(".sd-vault-total-count, #sd-vault-total-count")
						.text((data.total || 0) + " items")
					self.wrapper
						.find(".sd-vault-current-page, #sd-vault-current-page")
						.text(self.currentPage)
					self.wrapper
						.find(".sd-vault-total-pages, #sd-vault-total-pages")
						.text(self.totalPages)
					self.wrapper
						.find(".sd-vault-prev, #sd-vault-prev")
						.prop("disabled", self.currentPage <= 1)
					self.wrapper
						.find(".sd-vault-next, #sd-vault-next")
						.prop("disabled", self.currentPage >= self.totalPages)

					emptyState.hide()
					table.show()
					pagination.css("display", "flex")

					data.files.forEach(function (file) {
						tbody.append(self.renderFileRow(file))
					})
				})
				.catch(function () {
					tbody.html(
						'<tr><td class="error-text" colspan="6">Error loading files.</td></tr>',
					)
				})
		},

		renderFileRow: function (file) {
			const icon = this.getFileIconClass(file)
			const exportLabel =
				file.storage_mode === "media_public"
					? "Return to Vault"
					: "Copy to Media Library"
			const rowActions = `<div class="row-actions"><span class="edit"><a href="#" class="sd-action-edit">Edit</a> | </span><span class="view"><a href="#" class="sd-action-view">View</a> | </span><span class="export"><a href="#" class="sd-action-export" data-storage-mode="${this.escapeHtml(
				file.storage_mode || "vault_private",
			)}">${exportLabel}</a> | </span><span class="trash"><a href="#" class="sd-action-trash">Trash</a></span></div>`
			const commentHtml =
				file.comment_count > 0
					? `<div class="post-com-count-wrapper"><a href="#" class="post-com-count" title="View Comments"><span class="comment-count-approved">${file.comment_count}</span><span class="screen-reader-text">Comments</span></a></div>`
					: `<span class="sd-vault-no-comments sd-no-comments" title="No Comments">&mdash;</span>`
			const stickyClass = file.is_sticky ? " is-sticky" : ""

			return `
				<tr class="sd-vault-item${stickyClass}" data-id="${this.escapeHtml(file.id)}">
					<th scope="row" class="check-column" data-colname="Sticky">
						<span class="dashicons ${icon} sd-btn-icon sd-note-pin-btn ${
				file.is_sticky ? "active" : ""
			}" title="Toggle sticky ordering" aria-hidden="true"></span>
					</th>
					<td class="title column-title has-row-actions column-primary" data-colname="Title">
						<strong><a class="row-title" href="#">${this.escapeHtml(
							file.title,
						)}</a></strong>
						${rowActions}
						<button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>
					</td>
					${
						this.wrapper.find(".column-workspace").length
							? `<td class="column-workspace" data-colname="Workspace">${this.renderWorkspaceLabel(
									file,
							  )}</td>`
							: ""
					}
					${
						this.wrapper.find(".column-size").length
							? `<td class="column-size" data-colname="Size">${this.escapeHtml(
									file.size,
							  )}</td>`
							: ""
					}
					<td class="column-comments" data-colname="Comments">${commentHtml}</td>
					<td class="column-date" data-colname="Date">${this.renderDateLabel(file)}</td>
				</tr>
			`
		},

		closeDetailsModal: function () {
			const modal = this.detailsModal()
			if (!modal.length) return

			const active = document.activeElement
			if (active && modal[0] && modal[0].contains(active)) {
				active.blur()
			}

			this.cleanupAudioSubscriptions()
			this.resetMidiEditor(modal)
			this.unmountCanonicalModalPlayer(modal)

			modal.attr("aria-hidden", "true").hide()
			this.findInDetails([
				".sd-vault-details-new-comment",
				"#sd-vault-details-new-comment",
			])
				.val("")
				.attr("placeholder", "Write a comment...")
			this.findInDetails([
				".sd-vault-details-parent-comment",
				"#sd-vault-details-parent-comment",
			]).val("0")
		},

		mountCanonicalModalPlayer: function (modal, file, context = "vault-modal") {
			const shell = first(modal, [".sd-vault-modal-player-surface"]).first()
			if (!shell.length) return
			let host = shell.find(".sd-player-modal-mount").first()
			const isMidi = this.isMidiFile(file)
			const mime = String(file?.mime || file?.type || "").toLowerCase()
			const isAudio = mime.startsWith("audio/") || isMidi
			if (!isAudio) {
				this.ensureVaultModalMountHost(shell, file, context, isMidi)
				this.clearVaultAudioFallback(modal)
				return
			}

			if (!this.sdAdvancedVaultModalEnabled()) {
				this.renderVaultAudioFallback(modal, file, shell)
				return
			}

			this.clearVaultAudioFallback(modal)
			host = this.ensureVaultModalMountHost(shell, file, context, isMidi)
			if (!host || !host.length) return
			const hostEl = host[0]
			const fileId = String(file?.id || "")
			const trackUrl = String(file?.stream_url || file?.url || "")
			const trackTitle = String(file?.title || "Vault file")
			const trackType = isMidi ? "midi" : "audio"
			host.attr("data-context", context)
			host.attr("data-track-id", fileId)
			host.attr("data-track-url", trackUrl)
			host.attr("data-track-title", trackTitle)
			host.attr("data-track-type", trackType)
			if (hostEl.dataset.sdMountedTrackId === fileId) return
			hostEl.dataset.sdMountedTrackId = fileId
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "vault-dispatch-mount",
					context,
					fileId,
					trackUrl,
					trackTitle,
					trackType,
				})
			}
			document.dispatchEvent(
				new CustomEvent("systemdeck:player-modal-mount", {
					detail: {
						context,
						host: hostEl,
						track: file || null,
						trackId: fileId,
						url: trackUrl,
						title: trackTitle,
						type: trackType,
					},
				}),
			)
		},

		unmountCanonicalModalPlayer: function (modal, context = "vault-modal") {
			const host = first(modal, [".sd-player-modal-mount"]).first()
			this.clearVaultAudioFallback(modal)
			if (!host.length) return
			const hostEl = host[0]
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "vault-dispatch-unmount",
					context,
					fileId: String(host.attr("data-track-id") || ""),
				})
			}
			delete hostEl.dataset.sdMountedTrackId
			document.dispatchEvent(
				new CustomEvent("systemdeck:player-modal-unmount", {
					detail: { context, host: hostEl },
				}),
			)
			host.empty()
		},

		clearVaultAudioFallback: function (modal) {
			if (!modal || !modal.length) return
			modal.find(".sd-vault-audio-fallback").remove()
		},

		ensureVaultModalMountHost: function (
			shell,
			file,
			context = "vault-modal",
			isMidi = false,
		) {
			if (!shell.length) return

			let host = shell.find(".sd-player-modal-mount").first()
			if (!host.length) {
				shell.prepend(
					`<div class="sd-player-modal-mount"
						data-context="${this.escapeHtml(String(context || "vault-modal"))}"
						data-track-id="${this.escapeHtml(String(file?.id || ""))}"
						data-track-url="${this.escapeHtml(String(file?.stream_url || file?.url || ""))}"
						data-track-title="${this.escapeHtml(String(file?.title || "Vault file"))}"
						data-track-type="${isMidi ? "midi" : "audio"}"></div>`,
				)
				host = shell.find(".sd-player-modal-mount").first()
			}
			return host
		},

		renderVaultAudioFallback: function (modal, file, shell = null) {
			const resolvedShell =
				shell && shell.length
					? shell
					: first(modal, [".sd-vault-modal-player-surface"]).first()
			if (!resolvedShell.length) return

			const host = resolvedShell.find(".sd-player-modal-mount").first()
			if (host.length) {
				delete host[0].dataset.sdMountedTrackId
				host.remove()
			}

			this.clearVaultAudioFallback(modal)
			host.empty()

			const streamUrl = String(file?.stream_url || file?.url || "")
			if (!streamUrl) return

			if (this.isMidiFile(file)) {
				resolvedShell.append(
					`<div class="sd-vault-audio-fallback sd-vault-midi-fallback">
						<p>MIDI preview requires the SystemDeck Player widget.</p>
						<p><a class="button button-secondary" href="${this.escapeHtml(streamUrl)}" target="_blank" rel="noopener">Open file</a></p>
					</div>`,
				)
				return
			}

			resolvedShell.append(
				`<div class="sd-vault-audio-fallback">
					<audio controls preload="metadata" src="${this.escapeHtml(streamUrl)}"></audio>
				</div>`,
			)
		},

		updateDetailsNavigation: function (id) {
			const ids = (this.currentFiles || [])
				.map((file) => Number(file?.id || 0))
				.filter((fileId) => fileId > 0)
			const index = ids.indexOf(Number(id || 0))
			this.findInDetails([
				".sd-vault-details-prev",
				"#sd-vault-details-prev",
			]).prop("disabled", index <= 0)
			this.findInDetails([
				".sd-vault-details-next",
				"#sd-vault-details-next",
			]).prop("disabled", index === -1 || index >= ids.length - 1)
		},

		getDetailsDisplayModel: function (file) {
			const attachment =
				file && typeof file.attachment === "object"
					? file.attachment
					: null
			const mime = String(attachment?.mime || file?.mime || "")
			const mediaType =
				String(attachment?.type || "").trim() ||
				(mime.startsWith("image/")
					? "image"
					: mime.startsWith("audio/")
					? "audio"
					: mime.startsWith("video/")
					? "video"
					: "file")
			const bitrateValue = Number(attachment?.meta?.bitrate || 0)
			const bitrateMode = String(
				attachment?.meta?.bitrate_mode || "",
			).trim()
			return {
				attachment,
				mediaType,
				title: String(
					attachment?.title || file?.title || file?.full_title || "",
				),
				caption: String(attachment?.caption || file?.caption || ""),
				description: String(
					attachment?.description || file?.description || "",
				),
				altText: String(attachment?.alt || file?.alt_text || ""),
				artist: String(
					attachment?.artist ||
						attachment?.meta?.artist ||
						file?.artist ||
						"",
				),
				album: String(
					attachment?.album ||
						attachment?.meta?.album ||
						file?.album ||
						"",
				),
				filename: String(
					attachment?.filename ||
						file?.full_title ||
						file?.title ||
						"",
				),
				author: String(
					file?.author_name || attachment?.authorName || "You",
				),
				authorUrl: String(file?.author_url || ""),
				uploaded: String(attachment?.dateFormatted || file?.date || ""),
				mime,
				filesize: String(
					attachment?.filesizeHumanReadable || file?.size || "",
				),
				workspace: String(
					file?.origin_workspace_name || file?.workspace_name || "",
				),
				status: String(
					file?.status_label ||
						(String(file?.storage_mode || "") === "media_public"
							? "Public"
							: "Private"),
				),
				dimensions:
					Number(attachment?.width || 0) > 0 &&
					Number(attachment?.height || 0) > 0
						? `${attachment.width} by ${attachment.height} pixels`
						: "",
				fileLength: String(attachment?.fileLengthHumanReadable || ""),
				bitrate:
					bitrateValue > 0
						? `${Math.round(bitrateValue / 1000)}kb/s${
								bitrateMode
									? ` ${bitrateMode.toUpperCase()}`
									: ""
						  }`
						: "",
				previewUrl: String(
					attachment?.sizes?.full?.url ||
						attachment?.sizes?.large?.url ||
						attachment?.image?.src ||
						attachment?.url ||
						file?.stream_url ||
						"",
				),
				icon: String(attachment?.icon || ""),
			}
		},

		openDetails: function (id) {
			const self = this
			const modal = this.detailsModal()
			if (!modal.length) return
			const requestToken = ++this.detailsRequestToken
			const detailsPane = first(modal, [
				".sd-vault-attachment-details",
				"#sd-vault-attachment-details",
			])
			const previewShell = first(modal, [
				".sd-vault-details-preview-shell",
				"#sd-vault-details-preview-shell",
			])
			const previewActions = first(modal, [
				".sd-vault-details-preview-actions",
				"#sd-vault-details-preview-actions",
			])

				self.cleanupAudioSubscriptions()
				self.resetMidiEditor(modal)
				self.currentDetailsFile = null
				modal.removeData("sdVaultCurrentFile")
			detailsPane
				.removeClass("save-waiting save-complete needs-refresh")
				.addClass("save-ready")
			first(modal, [
				".sd-vault-delete-details",
				"#sd-vault-delete-details",
			])
				.hide()
				.data("id", "")
			first(modal, [
				".sd-vault-download-details",
				"#sd-vault-download-details",
			])
				.hide()
				.attr("href", "#")
			first(modal, [
				".sd-vault-open-media-details",
				"#sd-vault-open-media-details",
			])
				.hide()
				.attr("href", "#")
			first(modal, [
				".sd-vault-open-public-link",
				"#sd-vault-open-public-link",
			])
				.hide()
				.attr("href", "#")
			first(modal, [
				".sd-vault-export-details",
				"#sd-vault-export-details",
			])
				.hide()
				.data("id", "")
			modal
				.find(
					".sd-vault-open-public-sep, #sd-vault-open-public-sep, .sd-vault-open-media-sep, #sd-vault-open-media-sep, .sd-vault-download-sep, #sd-vault-download-sep, .sd-vault-export-sep, #sd-vault-export-sep",
				)
				.hide()
			first(modal, [
				".sd-vault-priority-badge",
				"#sd-vault-priority-badge",
			])
				.hide()
				.text("")
				.removeClass("is-urgent is-high is-moderate is-low")
			previewShell.children().not(previewActions).remove()
			previewActions.before(
				'<p class="description sd-vault-loading-text">Loading preview...</p>',
			)
			first(modal, [
				".sd-vault-details-comments-list",
				"#sd-vault-details-comments-list",
			]).html(
				'<p class="description sd-vault-comments-loading">Loading discussion...</p>',
			)
			first(modal, [
				".sd-vault-details-new-comment",
				"#sd-vault-details-new-comment",
			])
				.val("")
				.attr("placeholder", "Write a comment...")
			first(modal, [
				".sd-vault-details-parent-comment",
				"#sd-vault-details-parent-comment",
			]).val("0")
			first(modal, [
				".sd-vault-details-readonly-note",
				"#sd-vault-details-readonly-note",
			]).hide()
			modal
				.find(
					".sd-vault-details-alt-text, #sd-vault-details-alt-text, .sd-vault-details-title, #sd-vault-details-title, .sd-vault-details-artist, #sd-vault-details-artist, .sd-vault-details-album, #sd-vault-details-album, .sd-vault-details-caption, #sd-vault-details-caption, .sd-vault-details-description, #sd-vault-details-description, .sd-vault-details-copy-link, #sd-vault-details-copy-link",
				)
				.val("")
			modal
				.find(
					".sd-vault-details-alt-setting, #sd-vault-details-alt-setting, .sd-vault-alt-text-description, #sd-vault-alt-text-description, .sd-vault-details-artist-setting, #sd-vault-details-artist-setting, .sd-vault-details-album-setting, #sd-vault-details-album-setting",
				)
				.hide()
			modal
				.find(
					".attachment-info, .sd-vault-attachment-details, #sd-vault-attachment-details, .sd-vault-details-preview-shell, #sd-vault-details-preview-shell",
				)
				.scrollTop(0)
			modal
				.appendTo(document.body)
				.removeAttr("aria-hidden")
				.css({
					display: "block",
					position: "fixed",
					inset: "0",
					zIndex: 2147483647,
				})
				.show()
			self.updateDetailsNavigation(id)

				self.fetchFileDetails(id)
					.then(function (file) {
						if (requestToken !== self.detailsRequestToken) return
						self.currentDetailsFile = file
						modal.data("sdVaultCurrentFile", file)
						const details = self.getDetailsDisplayModel(file)
					const isPublic =
						String(file.storage_mode || "") === "media_public"
					first(modal, [
						".sd-vault-details-id",
						"#sd-vault-details-id",
					]).val(file.id)
					modal
						.find(
							".sd-vault-details-alt-setting, #sd-vault-details-alt-setting, .sd-vault-alt-text-description, #sd-vault-alt-text-description",
						)
						.toggle(details.mediaType === "image")
					modal
						.find(
							".sd-vault-details-artist-setting, #sd-vault-details-artist-setting, .sd-vault-details-album-setting, #sd-vault-details-album-setting",
						)
						.toggle(details.mediaType === "audio")
					first(modal, [
						".sd-vault-details-alt-text",
						"#sd-vault-details-alt-text",
					])
						.val(details.altText)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-details-title",
						"#sd-vault-details-title",
					])
						.val(details.title)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-details-artist",
						"#sd-vault-details-artist",
					])
						.val(details.artist)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-details-album",
						"#sd-vault-details-album",
					])
						.val(details.album)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-details-caption",
						"#sd-vault-details-caption",
					])
						.val(details.caption)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-details-description",
						"#sd-vault-details-description",
					])
						.val(details.description)
						.prop("readonly", isPublic)
					first(modal, [
						".sd-vault-delete-details",
						"#sd-vault-delete-details",
					])
						.show()
						.data("id", file.id)
					first(modal, [
						".sd-vault-download-details",
						"#sd-vault-download-details",
					])
						.show()
						.attr(
							"href",
							isPublic
								? file.stream_url
								: `${file.stream_url}&download=1`,
						)
					first(modal, [
						".sd-vault-download-sep",
						"#sd-vault-download-sep",
					]).show()
					if (file.edit_url) {
						first(modal, [
							".sd-vault-open-media-details",
							"#sd-vault-open-media-details",
						])
							.show()
							.attr("href", file.edit_url)
						first(modal, [
							".sd-vault-open-media-sep",
							"#sd-vault-open-media-sep",
						]).show()
					}
					if (isPublic && file.stream_url) {
						first(modal, [
							".sd-vault-open-public-link",
							"#sd-vault-open-public-link",
						])
							.show()
							.attr("href", file.stream_url)
						first(modal, [
							".sd-vault-open-public-sep",
							"#sd-vault-open-public-sep",
						]).show()
					}
					first(modal, [
						".sd-vault-details-readonly-note",
						"#sd-vault-details-readonly-note",
					]).toggle(isPublic)
					first(modal, [
						".sd-vault-details-modal-title",
						"#sd-vault-details-modal-title",
					]).text("Attachment details")
					first(modal, [
						".sd-vault-details-uploaded",
						"#sd-vault-details-uploaded",
					]).text(details.uploaded || file.date || "")
					first(modal, [
						".sd-vault-details-author",
						"#sd-vault-details-author",
					]).html(
						details.authorUrl
							? `<a href="${self.escapeHtml(
									details.authorUrl,
							  )}">${self.escapeHtml(details.author)}</a>`
							: self.escapeHtml(details.author),
					)
					first(modal, [
						".sd-vault-details-workspace",
						"#sd-vault-details-workspace",
					]).text(details.workspace)
					first(modal, [
						".sd-vault-details-status",
						"#sd-vault-details-status",
					]).text(details.status)
					first(modal, [
						".sd-vault-details-filename",
						"#sd-vault-details-filename",
					]).text(details.filename)
					first(modal, [
						".sd-vault-details-filetype",
						"#sd-vault-details-filetype",
					]).text(details.mime || file.mime || "")
					first(modal, [
						".sd-vault-details-filesize",
						"#sd-vault-details-filesize",
					]).text(details.filesize || file.size || "")
					first(modal, [
						".sd-vault-details-dimensions-row",
						"#sd-vault-details-dimensions-row",
					]).toggle(Boolean(details.dimensions))
					first(modal, [
						".sd-vault-details-dimensions",
						"#sd-vault-details-dimensions",
					]).text(details.dimensions)
					first(modal, [
						".sd-vault-details-length-row",
						"#sd-vault-details-length-row",
					]).toggle(Boolean(details.fileLength))
					first(modal, [
						".sd-vault-details-length",
						"#sd-vault-details-length",
					]).text(details.fileLength)
					first(modal, [
						".sd-vault-details-bitrate-row",
						"#sd-vault-details-bitrate-row",
					]).toggle(Boolean(details.bitrate))
					first(modal, [
						".sd-vault-details-bitrate",
						"#sd-vault-details-bitrate",
					]).text(details.bitrate)
					first(modal, [
						".sd-vault-details-copy-link",
						"#sd-vault-details-copy-link",
					]).val(String(file.stream_url || ""))
					modal
						.find(
							".attachment-info, .sd-vault-attachment-details, #sd-vault-attachment-details, .sd-vault-details-preview-shell, #sd-vault-details-preview-shell",
						)
						.val(details.title)

					// Inject Vault Panel (Rule 5 Compliance)
					self.renderVaultPanel(modal, file)

					// Render Preview (Image/Audio/MIDI/Video)
					self.renderDetailsPreview(modal, file, details)
				})
				.catch(function (err) {
					window.alert("Failed to load file details: " + err)
				})

			$(document)
				.off("click.sdVaultSaveDetails")
				.on(
					"click.sdVaultSaveDetails",
					".sd-vault-save-details, #sd-vault-save-details",
					function () {
						self.saveDetails()
					},
				)
				.off("click.sdVaultDeleteDetails")
				.on(
					"click.sdVaultDeleteDetails",
					".sd-vault-delete-details, #sd-vault-delete-details",
					function () {
						const fileId = $(this).data("id")
						if (
							!fileId ||
							!window.confirm(
								"Are you sure you want to permanently delete this file?",
							)
						)
							return
						self.postAction("sd_core_vault_ajax_delete_file", {
							id: fileId,
						}).then(() => {
							self.closeDetailsModal()
							self.loadFiles()
							document.dispatchEvent(
								new CustomEvent("systemdeck:refresh-pins"),
							)
						})
					},
				)
		},

		renderDetailsPreview: function (modal, file, details) {
			const authoritativeFile = modal?.data("sdVaultCurrentFile")
			const currentFile =
				authoritativeFile &&
				Number(authoritativeFile?.id || 0) === Number(file?.id || 0)
					? authoritativeFile
					: file
			const previewActions = first(modal, [
				".sd-vault-details-preview-actions",
				"#sd-vault-details-preview-actions",
			])
			const previewShell = first(modal, [
				".sd-vault-details-preview-shell",
				"#sd-vault-details-preview-shell",
			])
			const mediaView = first(modal, [
				".sd-vault-details-media-view",
				"#sd-vault-details-media-view",
			])
			previewShell.find(".sd-vault-loading-text").remove()
			previewShell.children().not(previewActions).remove()
			this.unmountCanonicalModalPlayer(modal)
			previewActions.removeClass("has-midi-tools").hide().empty()
			this.cleanupAudioSubscriptions()
			this.resetMidiEditor(modal)

			const attachment =
				details && typeof details.attachment === "object"
					? details.attachment
					: null
			const orientation =
				String(
					attachment?.orientation ||
						(Number(attachment?.width || 0) >
						Number(attachment?.height || 0)
							? "landscape"
							: "portrait"),
				).toLowerCase() === "landscape"
					? "landscape"
					: "portrait"
			const thumbnailType =
				String(
					attachment?.type ||
						(details.mediaType === "audio" ||
						details.mediaType === "video" ||
						details.mediaType === "image"
							? details.mediaType
							: "file"),
				).toLowerCase() || "file"
			mediaView.attr(
				"class",
				`attachment-media-view ${orientation} sd-vault-details-media-view`,
			)
			previewShell.attr(
				"class",
				`sd-vault-details-preview-shell thumbnail thumbnail-${thumbnailType}`,
			)

			const attachmentUrl = this.escapeHtml(
				String(currentFile?.stream_url || ""),
			)
			const previewUrl = this.escapeHtml(
				String(details.previewUrl || currentFile?.stream_url || ""),
			)
			const title = this.escapeHtml(
				String(details.title || currentFile?.title || "Vault file"),
			)
			const mime = String(details.mime || "")
			const insertPreview = function (html) {
				previewActions.before(html)
			}

			if (details.mediaType === "image" && previewUrl) {
				insertPreview(
					`<img class="details-image" src="${previewUrl}" draggable="false" alt="" />`,
				)
			} else if (
				details.mediaType === "audio" &&
				!this.isMidiFile(currentFile)
			) {
				insertPreview(
					this.renderModalPlayerSurfaceHTML(currentFile, {
						midi: false,
						includeTools: false,
					}),
				)
			} else if (this.isMidiFile(currentFile)) {
				insertPreview(
					this.renderModalPlayerSurfaceHTML(currentFile, {
						midi: true,
						includeTools: true,
					}),
				)
			} else if (details.mediaType === "video") {
				insertPreview(
					`<div class="wp-media-wrapper wp-video"><video controls="controls" class="wp-video-shortcode" preload="metadata"><source type="${this.escapeHtml(
						mime,
					)}" src="${attachmentUrl}" /></video></div>`,
				)
				window.wp?.mediaelement?.initialize?.()
			} else if (mime.includes("pdf")) {
				if (
					attachmentUrl &&
					attachmentUrl !== "#" &&
					attachmentUrl !== ""
				) {
					insertPreview(
						`<iframe src="${attachmentUrl}" style="width:100%; min-height:420px; border:none;" title="${title}"></iframe>`,
					)
				} else {
					const iconClass = this.getFileIconClass(file)
					insertPreview(
						`<span class="dashicons ${iconClass}" style="font-size:64px; width:64px; height:64px; color:#8c8f94;"></span><p class="description">PDF preview pending...</p>`,
					)
				}
			} else {
				const iconUrl = this.escapeHtml(String(details.icon || ""))
				const iconClass = this.getFileIconClass(currentFile)
				insertPreview(
					iconUrl
						? `<img class="details-image icon" src="${iconUrl}" draggable="false" alt="" />`
						: `<span class="dashicons ${iconClass}" style="font-size:64px; width:64px; height:64px; color:#8c8f94;"></span>`,
				)
			}

			if (this.isMidiFile(currentFile)) this.loadMidiEditor(modal, currentFile)
			this.mountCanonicalModalPlayer(modal, currentFile, "vault-modal")
		},

		renderModalPlayerSurfaceHTML: function (file, options = {}) {
			const midi = options.midi === true
			const includeTools = options.includeTools === true
			return `
				<div class="sd-vault-modal-player-surface" data-file-id="${file.id}">
					<div class="sd-player-modal-mount"
						data-context="${options.context || "vault-modal"}"
						data-track-id="${this.escapeHtml(String(file?.id || ""))}"
						data-track-url="${this.escapeHtml(String(file?.stream_url || file?.url || ""))}"
						data-track-title="${this.escapeHtml(String(file?.title || "Vault file"))}"
						data-track-type="${midi ? "midi" : "audio"}"></div>
				</div>
				${
					includeTools
						? '<div class="sd-vault-midi-tools-host" style="display:none; margin-top:20px;"></div>'
						: ""
				}
			`
		},

		renderMidiBridgeHTML: function (file) {
			return this.renderModalPlayerSurfaceHTML(file, {
				midi: true,
				includeTools: true,
			})
		},

		renderReadPreview: function (file, details) {
			const attachmentUrl = this.escapeHtml(
				String(file?.stream_url || details.previewUrl || ""),
			)
			const previewUrl = this.escapeHtml(
				String(details.previewUrl || file?.stream_url || ""),
			)
			const title = this.escapeHtml(
				String(details.title || file?.title || "Vault file"),
			)
			const mime = String(details.mime || "")
			if (details.mediaType === "image" && previewUrl)
				return `<img class="sd-vault-read-preview__image" src="${previewUrl}" draggable="false" alt="${title}" />`
			if (details.mediaType === "audio" && !this.isMidiFile(file))
				return `<div class="sd-vault-read-preview__player"><audio controls class="wp-audio-shortcode" preload="none"><source type="${this.escapeHtml(
					mime,
				)}" src="${attachmentUrl}" /></audio></div>`
			if (details.mediaType === "video")
				return `<div class="sd-vault-read-preview__player"><video controls class="wp-video-shortcode" preload="metadata"><source type="${this.escapeHtml(
					mime,
				)}" src="${attachmentUrl}" /></video></div>`
			const iconClass = this.getFileIconClass(file)
			const iconUrl = this.escapeHtml(String(details.icon || ""))
			return `<div class="sd-vault-read-preview__file">${
				iconUrl
					? `<img class="sd-vault-read-preview__icon" src="${iconUrl}" draggable="false" alt="" />`
					: `<span class="dashicons ${iconClass} sd-vault-read-preview__dashicon" aria-hidden="true"></span>`
			}<div class="sd-vault-read-preview__file-meta"><div class="sd-vault-read-preview__file-title">${title}</div><div class="sd-vault-read-preview__file-type">${this.escapeHtml(
				mime || "File",
			)}</div><a class="button button-secondary" href="${attachmentUrl}" target="_blank" rel="noopener">Open file</a></div></div>`
		},

		renderReadMeta: function (_file, details) {
			const rows = []
			const authorValue = details.authorUrl
				? `<a href="${this.escapeHtml(
						details.authorUrl,
				  )}">${this.escapeHtml(details.author)}</a>`
				: this.escapeHtml(details.author)
			if (details.uploaded)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>Uploaded on:</strong> ${this.escapeHtml(
						details.uploaded,
					)}</div>`,
				)
			rows.push(
				`<div class="sd-vault-read-meta-row"><strong>Uploaded by:</strong> ${authorValue}</div>`,
			)
			if (details.workspace)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>Uploaded to:</strong> ${this.escapeHtml(
						details.workspace,
					)}</div>`,
				)
			rows.push(
				`<div class="sd-vault-read-meta-row"><strong>Status:</strong> ${this.escapeHtml(
					details.status,
				)}</div>`,
			)
			rows.push(
				`<div class="sd-vault-read-meta-row"><strong>File name:</strong> ${this.escapeHtml(
					details.filename,
				)}</div>`,
			)
			if (details.mime)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>File type:</strong> ${this.escapeHtml(
						details.mime,
					)}</div>`,
				)
			if (details.filesize)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>File size:</strong> ${this.escapeHtml(
						details.filesize,
					)}</div>`,
				)
			if (details.dimensions)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>Dimensions:</strong> ${this.escapeHtml(
						details.dimensions,
					)}</div>`,
				)
			if (details.fileLength)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>Length:</strong> ${this.escapeHtml(
						details.fileLength,
					)}</div>`,
				)
			if (details.bitrate)
				rows.push(
					`<div class="sd-vault-read-meta-row"><strong>Bitrate:</strong> ${this.escapeHtml(
						details.bitrate,
					)}</div>`,
				)
			return rows.join("")
		},

		saveDetails: function () {
			const self = this
			const modal = this.detailsModal()
			const id = first(modal, [
				".sd-vault-details-id",
				"#sd-vault-details-id",
			]).val()
			const detailsPane = first(modal, [
				".sd-vault-attachment-details",
				"#sd-vault-attachment-details",
			])
			const title = first(modal, [
				".sd-vault-details-title",
				"#sd-vault-details-title",
			])
				.val()
				.trim()
			if (!title) return

			detailsPane.removeClass("save-complete").addClass("save-waiting")
			first(modal, [".sd-vault-save-details", "#sd-vault-save-details"])
				.prop("disabled", true)
				.text("Saving...")

			this.postAction("sd_core_vault_ajax_save_file_details", {
				id,
				alt_text: first(modal, [
					".sd-vault-details-alt-text",
					"#sd-vault-details-alt-text",
				])
					.val()
					.trim(),
				title,
				artist: first(modal, [
					".sd-vault-details-artist",
					"#sd-vault-details-artist",
				])
					.val()
					.trim(),
				album: first(modal, [
					".sd-vault-details-album",
					"#sd-vault-details-album",
				])
					.val()
					.trim(),
				caption: first(modal, [
					".sd-vault-details-caption",
					"#sd-vault-details-caption",
				])
					.val()
					.trim(),
				description: first(modal, [
					".sd-vault-details-description",
					"#sd-vault-details-description",
				])
					.val()
					.trim(),
				scope: first(modal, [
					".sd-vault-details-is-shared",
					"#sd-vault-details-is-shared",
				]).is(":checked")
					? "pinned"
					: "private",
				priority:
					modal
						.find('input[name^="sd_vault_priority"]:checked')
						.val() || "low",
				workspace_id: this.getCurrentWorkspaceId(),
				workspace_name: this.getCurrentWorkspaceName(),
			})
				.then(function () {
					detailsPane.addClass("save-complete")
					self.cleanupAudioSubscriptions()
					self.resetMidiEditor(modal)
					modal.hide()
					self.loadFiles()
					document.dispatchEvent(
						new CustomEvent("systemdeck:refresh-pins"),
					)
				})
				.catch(function (err) {
					window.alert("Save failed: " + err)
				})
				.finally(function () {
					detailsPane.removeClass("save-waiting")
					first(modal, [
						".sd-vault-save-details",
						"#sd-vault-save-details",
					])
						.prop("disabled", false)
						.text("Update")
				})
		},

		openComments: async function (id, title) {
			const modal = this.commentsModal()
			first(modal, [
				".sd-vault-comment-file-title",
				"#sd-vault-comment-file-title",
			]).text(title || "Loading...")
			first(modal, [
				".sd-vault-comment-file-id",
				"#sd-vault-comment-file-id",
			]).val(id)
			first(modal, [
				".sd-vault-comment-file-urgency",
				"#sd-vault-comment-file-urgency",
			])
				.addClass("sd-hidden")
				.text("")
				.removeClass("is-urgent is-high is-moderate is-low")
			first(modal, [
				".sd-vault-read-preview",
				"#sd-vault-read-preview",
			]).html('<span class="spinner is-active sd-vault-spinner"></span>')
			first(modal, [".sd-vault-read-meta", "#sd-vault-read-meta"]).html(
				"",
			)
			first(modal, [
				".sd-vault-comments-list",
				"#sd-vault-comments-list",
			]).html(
				'<p class="description sd-vault-comments-loading">Loading discussion...</p>',
			)
			first(modal, [".sd-vault-new-comment", "#sd-vault-new-comment"])
				.val("")
				.attr("placeholder", "Write a comment...")
			first(modal, [
				".sd-vault-parent-comment",
				"#sd-vault-parent-comment",
			]).val("0")
			modal.show()

			try {
				const file = await this.fetchFileDetails(id)
				const details = this.getDetailsDisplayModel(file)
				first(modal, [
					".sd-vault-comment-file-title",
					"#sd-vault-comment-file-title",
				]).text(details.title || title || "Vault file")
				first(modal, [
					".sd-vault-read-preview",
					"#sd-vault-read-preview",
				]).html(this.renderReadPreview(file, details))
				first(modal, [
					".sd-vault-read-meta",
					"#sd-vault-read-meta",
				]).html(this.renderReadMeta(file, details))
				const badge = first(modal, [
					".sd-vault-comment-file-urgency",
					"#sd-vault-comment-file-urgency",
				])
				if (String(file?.scope || "") === "pinned") {
					const priority = String(
						file?.priority || "low",
					).toLowerCase()
					const safePriority = [
						"urgent",
						"high",
						"moderate",
						"low",
					].includes(priority)
						? priority
						: "low"
					badge
						.text(this.capitalize(safePriority))
						.removeClass(
							"is-urgent is-high is-moderate is-low sd-hidden",
						)
						.addClass(`is-${safePriority}`)
				}
				window.wp?.mediaelement?.initialize?.()
			} catch (error) {
				first(modal, [
					".sd-vault-read-preview",
					"#sd-vault-read-preview",
				]).html(
					'<p class="description sd-vault-comments-error">Unable to load preview.</p>',
				)
				first(modal, [
					".sd-vault-read-meta",
					"#sd-vault-read-meta",
				]).html(
					`<div class="sd-vault-read-meta-row sd-vault-comments-error">${this.escapeHtml(
						String(
							error?.message ||
								error ||
								"Unable to load file details.",
						),
					)}</div>`,
				)
			}

			this.loadComments(id)
			$(document)
				.off("click.sdVaultSaveComment")
				.on(
					"click.sdVaultSaveComment",
					".sd-vault-save-comment, #sd-vault-save-comment",
					() => this.saveComment(),
				)
		},

		loadComments: function (fileId, mode = "legacy") {
			const list =
				mode === "details"
					? first(this.detailsModal(), [
							".sd-vault-details-comments-list",
							"#sd-vault-details-comments-list",
					  ])
					: first(this.commentsModal(), [
							".sd-vault-comments-list",
							"#sd-vault-comments-list",
					  ])
			this.loadCommentsInto(list, fileId)
		},

		loadCommentsInto: function (list, fileId) {
			const self = this
			list.html(
				'<p class="description sd-vault-comments-loading">Loading discussion...</p>',
			)
			this.postAction("sd_core_vault_ajax_get_file_comments", {
				file_id: fileId,
			})
				.then(function (data) {
					list.empty()
					if (
						!Array.isArray(data.comments) ||
						data.comments.length === 0
					)
						return
					data.comments.forEach(function (c) {
						list.append(self.renderCommentHTML(c))
					})
				})
				.catch(function () {
					list.html(
						'<p class="description sd-vault-comments-error">Unable to load discussion.</p>',
					)
				})
		},

		renderCommentHTML: function (comment, isReply = false) {
			const wrapperClass = isReply
				? "dashboard-comment-wrap sd-vault-comment-thread sd-vault-comment-reply"
				: "dashboard-comment-wrap sd-vault-comment-thread"
			const replyBtn = isReply
				? ""
				: `<button class="button-link sd-reply-btn" data-id="${this.escapeHtml(
						comment.id,
				  )}">Reply</button>`
			let repliesHtml = ""
			if (Array.isArray(comment.replies) && comment.replies.length > 0) {
				repliesHtml += '<div class="sd-vault-comment-replies">'
				comment.replies.forEach((reply) => {
					repliesHtml += this.renderCommentHTML(reply, true)
				})
				repliesHtml += "</div>"
			}
			return `<div class="${wrapperClass}"><div class="comment-meta"><img class="avatar" src="${this.escapeHtml(
				comment.avatar,
			)}" alt="${this.escapeHtml(
				comment.author,
			)}" width="24" height="24"><cite>${this.escapeHtml(
				comment.author,
			)}</cite><span class="sd-note-comment-date">${this.escapeHtml(
				comment.date,
			)}</span>${replyBtn}</div><div class="sd-vault-comment-content comment-content">${
				comment.content
			}</div>${repliesHtml}</div>`
		},

		saveComment: function (mode = "legacy") {
			if (mode === "details") {
				if (this.detailsCommentSubmitting) return
				this.detailsCommentSubmitting = true
			}

			const modal =
				mode === "details" ? this.detailsModal() : this.commentsModal()
			const fileId =
				mode === "details"
					? first(modal, [
							".sd-vault-details-id",
							"#sd-vault-details-id",
					  ]).val()
					: first(modal, [
							".sd-vault-comment-file-id",
							"#sd-vault-comment-file-id",
					  ]).val()
			const input =
				mode === "details"
					? first(modal, [
							".sd-vault-details-new-comment",
							"#sd-vault-details-new-comment",
					  ])
					: first(modal, [
							".sd-vault-new-comment",
							"#sd-vault-new-comment",
					  ])
			const button =
				mode === "details"
					? first(modal, [
							".sd-vault-details-save-comment",
							"#sd-vault-details-save-comment",
					  ])
					: first(modal, [
							".sd-vault-save-comment",
							"#sd-vault-save-comment",
					  ])
			const parentInput =
				mode === "details"
					? first(modal, [
							".sd-vault-details-parent-comment",
							"#sd-vault-details-parent-comment",
					  ])
					: first(modal, [
							".sd-vault-parent-comment",
							"#sd-vault-parent-comment",
					  ])
			const content = input.val().trim()
			const parentId = parentInput.length ? parentInput.val() || 0 : 0
			if (!content) {
				if (mode === "details") this.detailsCommentSubmitting = false
				return
			}

			button.prop("disabled", true).text("...")
			this.postAction("sd_core_vault_ajax_add_file_comment", {
				file_id: fileId,
				content,
				parent_id: parentId,
			})
				.then(() => {
					input.val("").attr("placeholder", "Write a comment...")
					if (parentInput.length) parentInput.val("0")
					this.loadComments(fileId, mode)
					this.loadFiles()
				})
				.catch((err) => window.alert("Unable to post comment: " + err))
				.finally(() => {
					if (mode === "details")
						this.detailsCommentSubmitting = false
					button.prop("disabled", false).text("Post Comment")
				})
		},

		cleanupAudioSubscriptions: function () {
			;[
				"audioStateUnsubscribe",
				"audioTimeUnsubscribe",
				"audioErrorUnsubscribe",
			].forEach((key) => {
				if (typeof this[key] === "function") {
					try {
						this[key]()
					} catch (_err) {}
				}
				this[key] = null
			})
			$(document).off("click.sdVaultAudioModalClose")
		},

		resetMidiEditor: function (modal) {
			first(modal, [
				".sd-vault-details-preview-actions",
				"#sd-vault-details-preview-actions",
			])
				.removeClass("has-midi-tools")
				.hide()
				.empty()
		},

		setMidiEditorMessage: function (editor, message, type = "info") {
			const panel = editor.closest(".sd-vault-midi-editor-panel")
			panel.removeClass("is-valid is-invalid is-dirty")
			if (type === "success") {
				panel.addClass("is-valid")
			} else if (type === "error") {
				panel.addClass("is-invalid")
			}

			editor
				.find("[data-midi-editor-message]")
				.removeClass("is-success is-error is-info")
				.addClass(`is-${type}`)
				.text(String(message || ""))
		},

		renderMidiSummaryRows: function (summary = {}) {
			const rows = [
				["Source Hash", summary.source_hash || "Unavailable"],
				["Parser Version", summary.parser_version || "Unavailable"],
				[
					"Derivative Version",
					summary.derivative_version || "Unavailable",
				],
				["Track Count", Number(summary.track_count || 0)],
				[
					"Duration",
					`${this.formatTime(summary.duration || 0)} (${Number(
						summary.duration || 0,
					).toFixed(2)}s)`,
				],
				["Note Count", Number(summary.note_count || 0)],
				["Modified", summary.is_modified ? "Yes" : "No"],
				["Last Generated", summary.last_generated_at || "Never"],
				["Last Modified", summary.last_modified_at || "Never"],
				["Last Rebuilt", summary.last_rebuilt_at || "Never"],
			]
			return rows
				.map(
					([label, value]) =>
						`<div class="sd-vault-midi-summary-item"><span class="sd-vault-midi-summary-label">${this.escapeHtml(
							label,
						)}</span><span class="sd-vault-midi-summary-value">${this.escapeHtml(
							value,
						)}</span></div>`,
				)
				.join("")
		},

		renderMidiEditor: function (modal, file, payload) {
			const self = this
			const editor = modal.find(".sd-vault-midi-tools-host")
			if (!editor.length) return

			const summary = payload?.summary || {}
			const activeJson = String(payload?.active_json || "")
			const storageKey = `sd_vault_midi_details_open_${file.id}`
			let isOpen = false
			try {
				isOpen = localStorage.getItem(storageKey) === "1"
			} catch (_e) {}

			editor
				.html(
					`
				<div class="sd-vault-midi-editor-wrap">
					<div class="sd-vault-midi-editor-panel">
						<details class="sd-vault-midi-editor-details" ${isOpen ? "open" : ""}>
							<summary class="sd-vault-midi-editor-summary-toggle">Advanced MIDI Data</summary>
							<div class="sd-vault-midi-summary-grid" data-midi-summary-grid>${self.renderMidiSummaryRows(
								summary,
							)}</div>
							<label class="sd-vault-midi-editor-label">Active Derivative JSON</label>
							<textarea class="sd-vault-midi-json" rows="4" spellcheck="false">${self.escapeHtml(
								activeJson,
							)}</textarea>
							<div class="sd-vault-midi-editor-actions">
								<button type="button" class="button" data-midi-editor-action="validate">Validate JSON</button>
								<button type="button" class="button button-primary" data-midi-editor-action="save">Save MIDI Data</button>
								<button type="button" class="button" data-midi-editor-action="rebuild">Rebuild from Source MIDI</button>
							</div>
							<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>MIDI derivative data is hidden Vault metadata. Playback uses the active derivative.</div>
						</details>
					</div>
				</div>
			`,
				)
				.addClass("has-midi-tools")
				.show()

			const textarea = editor.find(".sd-vault-midi-json")
			const details = editor.find(".sd-vault-midi-editor-details")

			const updateHeight = function () {
				textarea.css("height", "auto")
				textarea.css("height", textarea[0].scrollHeight + "px")
			}

			textarea
				.off("input.sdVaultMidiJsonAutoHeight")
				.on("input.sdVaultMidiJsonAutoHeight", function () {
					updateHeight()
					const panel = editor.closest(".sd-vault-midi-editor-panel")
					panel
						.removeClass("is-valid is-invalid")
						.addClass("is-dirty")
					self.setMidiEditorMessage(
						editor,
						"MIDI derivative data has been modified. Validate or Save to apply.",
						"info",
					)
				})

			// Run once
			setTimeout(updateHeight, 0)

			details
				.off("toggle.sdVaultMidi")
				.on("toggle.sdVaultMidi", function () {
					try {
						localStorage.setItem(storageKey, this.open ? "1" : "0")
					} catch (_e) {}
				})
			const parseAndNormalize = async function () {
				const runtime = self.getAudioRuntime()
				if (
					!runtime ||
					typeof runtime.normalizeMidiDerivative !== "function"
				)
					throw new Error("Audio runtime MIDI validator unavailable.")
				let parsed
				try {
					parsed = JSON.parse(String(textarea.val() || ""))
				} catch (_err) {
					throw new Error(
						"Invalid JSON. Fix formatting before continuing.",
					)
				}
				const normalized = runtime.normalizeMidiDerivative(parsed)
				if (!normalized)
					throw new Error(
						"JSON is not a valid SystemDeck MIDI derivative.",
					)
				return normalized
			}

			editor
				.off("click.sdVaultMidi")
				.on(
					"click.sdVaultMidi",
					"[data-midi-editor-action]",
					async function () {
						const action = String(
							$(this).data("midi-editor-action") || "",
						)
						const btn = $(this).prop("disabled", true)
						try {
							let normalized
							if (action === "rebuild") {
								const runtime = self.getAudioRuntime()
								if (
									!runtime ||
									typeof runtime.buildMidiDerivativeFromArrayBuffer !==
										"function"
								)
									throw new Error(
										"Audio runtime MIDI builder unavailable.",
									)
								const replaceActive = !summary.is_modified
									? true
									: window.confirm(
											"Replace the edited active MIDI data with a rebuild from the source MIDI?",
									  )
								const response = await fetch(file.stream_url)
								if (!response.ok)
									throw new Error(
										"Unable to read the source MIDI file.",
									)
								const buffer = await response.arrayBuffer()
								normalized = runtime.normalizeMidiDerivative(
									await runtime.buildMidiDerivativeFromArrayBuffer(
										buffer,
										{
											sourceType: "vault",
											id: String(file.id || ""),
											title: file.title || "Vault MIDI",
											mime: file.mime || "audio/midi",
											filename: file.title || "",
											url: file.stream_url,
										},
									),
								)
								const saved = await self.postAction(
									"sd_core_vault_ajax_rebuild_midi_derivative",
									{
										id: file.id,
										json: JSON.stringify(normalized),
										replace_active: replaceActive ? 1 : 0,
									},
								)
								textarea.val(saved.active_json || "")
								editor
									.find("[data-midi-summary-grid]")
									.html(
										self.renderMidiSummaryRows(
											saved.summary || {},
										),
									)
								self.setMidiEditorMessage(
									editor,
									"Derivative rebuilt from source MIDI.",
									"success",
								)
								return
							}
							normalized = await parseAndNormalize()
							const endpoint =
								action === "save"
									? "sd_core_vault_ajax_save_midi_derivative"
									: "sd_core_vault_ajax_validate_midi_derivative"
							const saved = await self.postAction(endpoint, {
								id: file.id,
								json: JSON.stringify(normalized),
							})
							textarea.val(
								saved.active_json ||
									saved.pretty_json ||
									JSON.stringify(normalized, null, 2),
							)
							if (saved.summary)
								editor
									.find("[data-midi-summary-grid]")
									.html(
										self.renderMidiSummaryRows(
											saved.summary,
										),
									)
							self.setMidiEditorMessage(
								editor,
								action === "save"
									? "Active MIDI derivative saved."
									: "MIDI JSON validated.",
								"success",
							)
						} catch (error) {
							self.setMidiEditorMessage(
								editor,
								String(
									error?.message ||
										error ||
										"MIDI action failed.",
								),
								"error",
							)
						} finally {
							btn.prop("disabled", false)
						}
					},
				)
		},

		loadMidiEditor: async function (modal, file) {
			if (!this.isMidiFile(file)) {
				this.resetMidiEditor(modal)
				return
			}
			const editor = modal.find(".sd-vault-midi-tools-host")
			if (!editor.length) return

			editor
				.addClass("has-midi-tools")
				.show()
				.html(
					'<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>Loading MIDI editor…</div>',
				)
			try {
				const payload = await this.postAction(
					"sd_core_vault_ajax_get_midi_editor_payload",
					{ id: file.id },
				)
				this.renderMidiEditor(modal, file, payload)
			} catch (error) {
				editor.html(
					`<div class="sd-vault-midi-editor-message is-error" data-midi-editor-message>${this.escapeHtml(
						String(
							error?.message ||
								error ||
								"Unable to load MIDI editor.",
						),
					)}</div>`,
				)
			}
		},
	}

	VaultWidget.init()
	window.SystemDeckVaultWidget = VaultWidget
})(jQuery)
