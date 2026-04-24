/**
 * SystemDeck Vault Widget
 * Handles file dropzone, upload progress, and grid rendering securely based on workspace contexts.
 */
;(function ($) {
	"use strict"

	function getNonce() {
		return window.SystemDeckSecurity?.nonce || window.sd_vars?.nonce || ""
	}

	const VaultWidget = {
		interval: null,
		mediaFrame: null,
		manageFrame: null,
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
		init: function () {
			if (this.interval) clearInterval(this.interval)

			const self = this
			this.interval = setInterval(function () {
				$(".sd-vault-wrapper").each(function() {
				    const el = $(this);
				    if (!el.data("sd-vault-init")) {
					    el.data("sd-vault-init", true)
					    self.wrapper = el
					    self.bindEvents()
					    self.setupExternalEvents()
					    self.loadFiles()
					}
				});
			}, 1000)
		},

		setupExternalEvents: function () {
			if (this.externalEventsBound) return
			this.externalEventsBound = true

			const self = this
			document.addEventListener("systemdeck:open-vault-file", function (e) {
				const detail = e?.detail || {}
				const fileId = Number(detail.fileId || 0)
				if (!fileId) return
				if ((detail.mode || "read") === "read") {
					self.openComments(fileId)
				}
			})
		},

			bindEvents: function () {
			const self = this;
			const wrapper = this.wrapper

            $(document).off("click.sdVaultUpload").on("click.sdVaultUpload", "#sd-vault-upload-file", function(e) {
                e.preventDefault();
                $("#sd-vault-file-input").trigger("click");
            });

            $(document).off("change.sdVaultUpload").on("change.sdVaultUpload", "#sd-vault-file-input", function() {
                const file = this.files && this.files[0] ? this.files[0] : null;
                if (!file) return;
                self.uploadSelectedFile(file).catch(() => {}).finally(() => {
                    this.value = "";
                });
            });
			
            $(document).off("click.sdVaultMedia").on("click.sdVaultMedia", "#sd-vault-open-media", function(e) {
                e.preventDefault();
                self.openMediaFrame();
            });

            // Priority visibility toggle for details
            $(document).off("change.sdVaultDetailsSharedToggle").on("change.sdVaultDetailsSharedToggle", "#sd-vault-details-is-shared", function() {
                if ($(this).is(":checked")) {
                    $("#sd-vault-details-priority-wrap").show();
                } else {
                    $("#sd-vault-details-priority-wrap").hide();
                }
                self.updateDetailsPriorityBadge();
            });

            $(document).off("change.sdVaultPriorityLevel").on("change.sdVaultPriorityLevel", "input[name='sd_vault_priority']", function() {
                self.updateDetailsPriorityBadge();
            });

			wrapper.on("click.sdVaultView", ".sd-vault-item .sd-action-view, .sd-vault-item .row-title", function (e) {
				e.preventDefault()
				self.handleViewAction($(this).closest(".sd-vault-item").data("id"))
			})

			wrapper.on("click.sdVaultComments", ".sd-vault-item .column-comments a, .sd-vault-item .post-com-count", function (e) {
				e.preventDefault()
				const row = $(this).closest(".sd-vault-item")
				self.openComments(
					row.data("id"),
					row.find(".row-title").text().trim(),
				)
			})

			wrapper.on("click.sdVaultEdit", ".sd-vault-item .sd-action-edit", function (e) {
				e.preventDefault()
				self.handleEditAction($(this).closest(".sd-vault-item").data("id"))
			})

			wrapper.on("click.sdVaultExport", ".sd-vault-item .sd-action-export", function (e) {
				e.preventDefault()
				const id = $(this).closest(".sd-vault-item").data("id")
                const isPublic = String($(this).data("storage-mode") || "") === "media_public"
                const confirmText = isPublic
                    ? "Return this file to private Vault mode?"
                    : "Publish this file to the global WordPress Media Library?"
				if (!window.confirm(confirmText)) return
				const btn = $(this)
				const oldText = btn.text()
				btn.text("...")
				$.post(window.ajaxurl, {
					action: isPublic ? 'sd_core_vault_ajax_make_private' : 'sd_core_vault_ajax_export_to_media_library',
					id: id,
					_ajax_nonce: getNonce()
				}, function(res) {
					btn.text(oldText)
					if (res.success) {
                        self.loadFiles()
                        self.handleEditAction(id)
						alert(isPublic ? "File returned to private Vault mode." : "File published to the WordPress Media Library.")
					} else {
						alert((isPublic ? "Return to Vault failed: " : "Publish failed: ") + (res.data || "Unknown error"))
					}
				})
			})

			wrapper.on("click.sdVaultTrash", ".sd-vault-item .sd-action-trash", function (e) {
				e.preventDefault()
				const id = $(this).closest(".sd-vault-item").data("id")
				if (!window.confirm("Are you sure you want to permanently delete this file?")) return
				$.post(window.ajaxurl, {
					action: 'sd_core_vault_ajax_delete_file',
					id: id,
					_ajax_nonce: getNonce()
				}, function(res) {
					if (res.success) {
						self.loadFiles()
						document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
					}
				})
			})

			wrapper.on("click.sdVaultSticky", ".sd-vault-item .sd-note-pin-btn", function (e) {
				e.preventDefault()
				e.stopPropagation()
				const id = $(this).closest(".sd-vault-item").data("id")
				if (!id) return
				$.post(window.ajaxurl, {
					action: "sd_toggle_vault_sticky",
					id,
					_ajax_nonce: getNonce(),
				}, function (res) {
					if (res && res.success) {
						self.loadFiles()
					}
				})
			})

			wrapper.on("click.sdVaultPage", "#sd-vault-prev", function (e) {
				e.preventDefault()
				if (self.currentPage > 1) {
					self.currentPage--
					self.loadFiles()
				}
			})

			wrapper.on("click.sdVaultPage", "#sd-vault-next", function (e) {
				e.preventDefault()
				if (self.currentPage < self.totalPages) {
					self.currentPage++
					self.loadFiles()
				}
			})

				$("#sd-vault-details-modal").on("click.sdVaultDetailsComment", "#sd-vault-details-save-comment", function () {
					self.saveComment("details")
				})

			$("#sd-vault-details-modal").on("click.sdVaultDetailsReply", ".sd-reply-btn", function (e) {
				e.preventDefault()
				const parentId = $(this).data("id")
				$("#sd-vault-details-parent-comment").val(parentId)
				$("#sd-vault-details-new-comment")
					.attr("placeholder", "Replying to thread...")
					.focus()
			})

			$("#sd-vault-comments-modal").on("click.sdVaultCommentReply", ".sd-reply-btn", function (e) {
				e.preventDefault()
				const parentId = $(this).data("id")
				$("#sd-vault-parent-comment").val(parentId)
				$("#sd-vault-new-comment")
					.attr("placeholder", "Replying to thread...")
					.focus()
			})

			$(document).off("click.sdVaultDetailsClose").on("click.sdVaultDetailsClose", "#sd-vault-details-close, #sd-vault-details-modal .media-modal-backdrop", function (e) {
				e.preventDefault()
				self.closeDetailsModal()
			})
			$(document).off("click.sdVaultCommentsClose")
				.on("click.sdVaultCommentsClose", "#sd-vault-comments-close", function (e) {
					e.preventDefault()
					$("#sd-vault-comments-modal").hide()
				})
				.on("click.sdVaultCommentsClose", "#sd-vault-comments-modal", function (e) {
					if (e.target !== this) return
					e.preventDefault()
					$("#sd-vault-comments-modal").hide()
				})

			$(document).off("click.sdVaultCopyAttachmentUrl").on("click.sdVaultCopyAttachmentUrl", "#sd-vault-details-modal .copy-attachment-url", async function (e) {
				e.preventDefault()
				const target = $($(this).data("clipboard-target"))
				if (!target.length) return
				const value = String(target.val() || "")
				if (!value) return
				try {
					if (navigator.clipboard?.writeText) {
						await navigator.clipboard.writeText(value)
					} else {
						target.trigger("focus").trigger("select")
						document.execCommand("copy")
					}
					const success = $(this).siblings(".success")
					success.removeClass("hidden")
					window.setTimeout(() => success.addClass("hidden"), 1200)
				} catch (_err) {}
			})

			$(document).off("click.sdVaultDetailsNav").on("click.sdVaultDetailsNav", "#sd-vault-details-prev, #sd-vault-details-next", function (e) {
				e.preventDefault()
				const currentId = Number($("#sd-vault-details-id").val() || 0)
				const ids = (self.currentFiles || []).map((file) => Number(file?.id || 0)).filter((id) => id > 0)
				const index = ids.indexOf(currentId)
				if (index === -1) return
				const targetIndex = $(this).is("#sd-vault-details-prev") ? index - 1 : index + 1
				const targetId = Number(ids[targetIndex] || 0)
				if (targetId > 0) {
					self.openDetails(targetId)
				}
			})
		},

		getAudioRuntime: function () {
			const runtime = window.SystemDeckAudio
			if (!runtime || typeof runtime !== "object") return null
			if (
				typeof runtime.load !== "function" ||
				typeof runtime.play !== "function" ||
				typeof runtime.pause !== "function" ||
				typeof runtime.stop !== "function" ||
				typeof runtime.seek !== "function" ||
				typeof runtime.getState !== "function"
			) {
				return null
			}
			return runtime
		},

		isMidiFile: function (file) {
			const mime = String(file?.mime || "").toLowerCase()
			const title = String(file?.title || "").toLowerCase()
			return (
				mime.includes("midi") ||
				title.endsWith(".mid") ||
				title.endsWith(".midi")
			)
		},

		isPlayableFile: function (file) {
			const mime = String(file?.mime || "").toLowerCase()
			return mime.startsWith("audio/") || this.isMidiFile(file)
		},

		buildMidiDerivativeForFile: async function (file, runtime) {
			if (!file || !runtime) return null
			if (typeof runtime.buildMidiDerivativeFromArrayBuffer !== "function") return null
			const buffer = await file.arrayBuffer()
			const derivative = await runtime.buildMidiDerivativeFromArrayBuffer(buffer, {
				sourceType: "vault",
				title: file.name || "Vault MIDI",
				mime: file.type || "audio/midi",
				filename: file.name || "",
			})
			return derivative && typeof derivative === "object" ? derivative : null
		},

        formatAudioTime: function (seconds) {
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
				document.title.split("‹")[0].trim().replace(" - WordPress", "").trim() ||
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

		getAttachmentEditUrl: function (attachment) {
			const direct = String(attachment?.editLink || "")
			if (direct) return direct
			const id = Number(attachment?.id || 0)
			if (!id) return "#"
			const ajaxUrl = String(window.ajaxurl || window.sd_vars?.ajaxurl || "")
			if (ajaxUrl) {
				return ajaxUrl.replace(/admin-ajax\.php(?:\?.*)?$/, `post.php?post=${id}&action=edit`)
			}
			return `/wp-admin/post.php?post=${id}&action=edit`
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
			this.mediaExtensionState = {
				isShared: false,
				priority: "low",
			}
		},

		ensureMediaFrame: function () {
			if (this.mediaFrame) return this.mediaFrame
			if (typeof wp === "undefined" || !wp.media) return null

			const self = this
			const frame = wp.media({
				title: "Vault",
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
					window.alert(String(error?.message || error || "Unable to add attachment to Vault."))
				}
			})

			this.mediaFrame = frame
			return frame
		},

		openMediaFrame: function () {
			this.mediaFrameContext = { type: "import" }
			const frame = this.ensureMediaFrame()
			if (!frame) {
				window.alert("WordPress media is unavailable on this screen.")
				return
			}
			frame.open()
		},

		canUseNativeAttachmentDetails: function (file) {
			return Boolean(
				Number(file?.attachment_id || 0) > 0 &&
				file?.edit_url &&
				typeof wp !== "undefined" &&
				wp.media,
			)
		},

		fetchFileDetails: function (id) {
			return this.postAction("sd_core_vault_ajax_get_file_details", { id })
		},

			handleViewAction: async function (id) {
				try {
					const file = await this.fetchFileDetails(id)
					const viewUrl = String(file?.stream_url || "")
					if (!viewUrl) {
						throw new Error("Media URL unavailable.")
					}
					window.open(viewUrl, "_blank", "noopener")
				} catch (error) {
					window.alert(String(error?.message || error || "Unable to open file."))
				}
			},

		handleEditAction: async function (id) {
			try {
				this.openDetails(id)
			} catch (error) {
				window.alert(String(error?.message || error || "Unable to open file details."))
			}
		},

		findFileByAttachmentId: function (attachmentId) {
			const targetId = Number(attachmentId || 0)
			if (!targetId) return null
			return (
				(this.currentFiles || []).find(
					(file) => Number(file?.attachment_id || 0) === targetId,
				) || null
			)
		},

		attachNativeEditFrameExtensions: function (frame, file) {
			if (!frame) return

			const self = this
			const bindContext = function () {
				const activeAttachmentId = Number(
					frame?.model?.get?.("id") ||
					frame?.state?.()?.get?.("selection")?.first?.()?.get?.("id") ||
					0,
				)
				const matchedFile =
					self.findFileByAttachmentId(activeAttachmentId) ||
					self.findFileByAttachmentId(file?.attachment_id) ||
					file ||
					null

				self.mediaFrameContext = matchedFile
					? { type: "item", file: matchedFile }
					: { type: "item", file }
			}

			const render = function () {
				bindContext()
				self.startMediaExtensionLoop(frame)
			}

			if (typeof frame.off === "function") {
				frame.off("open", render)
				frame.off("refresh", render)
				frame.off("content:render", render)
				frame.off("close", self.__sdVaultNativeFrameClose)
			}

			self.__sdVaultNativeFrameClose = function () {
				self.stopMediaExtensionLoop()
				self.mediaFrameContext = null
			}

			if (typeof frame.on === "function") {
				frame.on("open", render)
				frame.on("refresh", render)
				frame.on("content:render", render)
				frame.on("close", self.__sdVaultNativeFrameClose)
			}

			window.setTimeout(render, 0)
		},

		ensureManageFrame: function (attachmentIds = []) {
			if (
				typeof wp === "undefined" ||
				!wp.media ||
				!wp.media.view ||
				!wp.media.view.MediaFrame ||
				!wp.media.view.MediaFrame.Manage
			) {
				return null
			}

			const normalizedIds = Array.from(
				new Set(
					attachmentIds
						.map((id) => Number(id || 0))
						.filter((id) => id > 0),
				),
			)
			const signature = normalizedIds.join(",")
			if (this.manageFrame && this.manageFrameSignature === signature) {
				return this.manageFrame
			}

			if (this.manageFrame && typeof this.manageFrame.off === "function") {
				this.manageFrame.off(".sdVaultManage")
			}

			let container = document.getElementById("sd-vault-manage-frame")
			if (!container) {
				container = document.createElement("div")
				container.id = "sd-vault-manage-frame"
				container.style.display = "none"
				document.body.appendChild(container)
			} else {
				container.innerHTML = ""
			}

			const libraryArgs = normalizedIds.length
				? {
						post__in: normalizedIds,
						orderby: "post__in",
						posts_per_page: normalizedIds.length,
				  }
				: {
						posts_per_page: 1,
				  }

			this.manageFrame = wp.media({
				frame: "manage",
				container: container,
				library: libraryArgs,
			}).open()
			this.manageFrameSignature = signature
			return this.manageFrame
		},

		openNativeEditAttachmentModal: function (file) {
			const hasAttachment = Number(file?.attachment_id || 0) > 0 && !!file?.edit_url
			if (!hasAttachment) {
				this.openDetails(file?.id)
				return
			}

			const attachmentId = Number(file.attachment_id || 0)
			const visibleAttachmentIds = (this.currentFiles || [])
				.map((item) => Number(item?.attachment_id || 0))
				.filter((id) => id > 0)
			if (!visibleAttachmentIds.includes(attachmentId)) {
				visibleAttachmentIds.unshift(attachmentId)
			}

			const frame = this.ensureManageFrame(visibleAttachmentIds)
			if (!frame || typeof frame.trigger !== "function") {
				window.location.assign(file.edit_url)
				return
			}

			const library = frame.state()?.get?.("library")
			const openForModel = (model) => {
				if (!model) {
					window.location.assign(file.edit_url)
					return
				}
				if (wp.media?.frames?.edit) {
					const editFrame = wp.media.frames.edit.open()
					this.attachNativeEditFrameExtensions(editFrame, file)
					editFrame.trigger("refresh", model)
					return
				}
				wp.media.frames.edit = wp.media({
					frame: "edit-attachments",
					controller: frame,
					library: library,
					model: model,
				})
				this.attachNativeEditFrameExtensions(wp.media.frames.edit, file)
			}

			const tryOpen = () => {
				const model = library?.findWhere?.({ id: attachmentId }) || null
				if (model) {
					openForModel(model)
					return
				}
				const fetched = wp.media.attachment(attachmentId)
				if (typeof fetched?.fetch === "function") {
					const req = fetched.fetch()
					if (req && typeof req.always === "function") {
						req.always(() => openForModel(fetched))
						return
					}
				}
				openForModel(fetched)
			}

			if (library && typeof library.more === "function") {
				const req = library.more()
				if (req && typeof req.always === "function") {
					req.always(tryOpen)
					return
				}
			}

			tryOpen()
		},

	        uploadSelectedFile: function (file) {
            const self = this
            const formData = new FormData()
            const button = $("#sd-vault-upload-file")
            const originalHtml = button.html()
            const isShared = false

            formData.append("action", "sd_core_vault_ajax_upload_file")
            formData.append("vault_file", file)
            formData.append("workspace_id", self.getCurrentWorkspaceId())
            formData.append("workspace_name", self.getCurrentWorkspaceName())
            formData.append("is_shared", isShared ? "1" : "0")
            formData.append("priority", "low")
            formData.append("_ajax_nonce", getNonce())

            button.prop("disabled", true).text("Uploading...")

            return new Promise((resolve, reject) => {
                $.ajax({
                    url: window.ajaxurl,
                    type: "POST",
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function (res) {
                        button.prop("disabled", false).html(originalHtml)
                        if (!res?.success) {
                            reject(res?.data || "Upload failed.")
                            return
                        }
                        self.loadFiles()
                        resolve(res.data)
                    },
                    error: function (_xhr, _status, error) {
                        button.prop("disabled", false).html(originalHtml)
                        reject(error || "Upload failed.")
                    },
                })
            }).catch(function (error) {
                window.alert(String(error?.message || error || "Upload failed."))
                throw error
            })
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
			if (this.mediaPanelInterval) {
				window.clearInterval(this.mediaPanelInterval)
			}
			this.mediaPanelInterval = null
		},

		getMediaExtensionSettings: function () {
			const panel = $(".sd-vault-media-extension").first()
			const isShared = panel.find("[data-sd-vault-is-shared]").is(":checked")
			const priority = String(
				panel.find("input[name='sd_vault_media_priority']:checked").val() || "low",
			).toLowerCase()

			this.mediaExtensionState = {
				isShared,
				priority,
			}

			return this.mediaExtensionState
		},

		linkAttachmentFromSelection: function (attachment) {
			const self = this
			const settings = self.getMediaExtensionSettings()
			return new Promise((resolve, reject) => {
				$.post(
					window.ajaxurl,
					{
						action: "sd_core_vault_ajax_link_attachment",
						attachment_id: Number(attachment?.id || 0),
						workspace_id: self.getCurrentWorkspaceId(),
						workspace_name: self.getCurrentWorkspaceName(),
						is_shared: settings.isShared ? 1 : 0,
						priority: settings.priority || "low",
						_ajax_nonce: getNonce(),
					},
					function (res) {
						if (!res?.success) {
							reject(res?.data || "Unable to link attachment.")
							return
						}

						self.loadFiles()
						if (settings.isShared) {
							document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
						}
						resolve(res.data)
					},
				).fail(function (_xhr, _status, error) {
					reject(error || "Unable to link attachment.")
				})
			})
		},

		renderMediaExtension: function (frame) {
			const attachment = this.getSelectedMediaAttachment(frame)
			const frameEl = frame?.$el
			if (!frameEl || !frameEl.length) return
			let context = this.mediaFrameContext || { type: "import" }

			const settings = this.mediaExtensionState || { isShared: false, priority: "low" }
			const renderKey = JSON.stringify([
				String(context?.type || "import"),
				String(context?.file?.id || ""),
				String(attachment?.id || ""),
				settings.isShared ? 1 : 0,
				settings.priority || "low",
			])

			if (!attachment) {
				frameEl.removeData("sdVaultRenderKey")
				frameEl.find(".sd-vault-media-extension").remove()
				frameEl.find(".sd-vault-media-audio-extension").remove()
				return
			}

			if (
				context.type === "item" &&
				Number(context?.file?.attachment_id || 0) > 0 &&
				Number(attachment?.id || 0) !== Number(context.file.attachment_id || 0)
			) {
				const matchedFile = this.findFileByAttachmentId(attachment?.id)
				if (matchedFile) {
					this.mediaFrameContext = { type: "item", file: matchedFile }
					context = this.mediaFrameContext
				} else {
				frameEl.removeData("sdVaultRenderKey")
				frameEl.find(".sd-vault-media-extension").remove()
				frameEl.find(".sd-vault-media-audio-extension").remove()
				return
				}
			}

			if (frameEl.data("sdVaultRenderKey") === renderKey) return
			frameEl.data("sdVaultRenderKey", renderKey)

			frameEl.find(".sd-vault-media-extension").remove()
			frameEl.find(".sd-vault-media-audio-extension").remove()
			const editUrl = this.getAttachmentEditUrl(attachment)
			const detailsHost = frameEl.find(".attachment-info, .attachment-details").first()
			if (detailsHost.length) {
				if (context.type === "item" && context.file) {
					const file = context.file
					const isPublic = String(file.storage_mode || "") === "media_public"
					const exportLabel = isPublic ? "Return to Vault" : "Publish to Media Library"
					detailsHost.append(`
						<div class="sd-vault-media-extension sd-vault-media-extension--item" data-sd-vault-item-extension>
							<div class="sd-vault-media-extension__heading">SystemDeck Vault</div>
							<p class="sd-vault-media-extension__text">WordPress remains the primary preview shell. Vault adds storage authority, workspace state, comments, and publication controls.</p>
							<div class="sd-vault-read-meta">
								<div class="sd-vault-read-meta-row"><strong>Storage:</strong> ${this.escapeHtml(isPublic ? "Media Library (Public)" : "Vault (Private)")}</div>
								<div class="sd-vault-read-meta-row"><strong>Origin:</strong> ${this.escapeHtml(this.capitalize(String(file.origin || "vault")))}</div>
								<div class="sd-vault-read-meta-row"><strong>Workspace:</strong> ${this.renderWorkspaceLabel(file)}</div>
								<div class="sd-vault-read-meta-row"><strong>Date:</strong> ${this.renderDateLabel(file)}</div>
							</div>
							<div class="sd-vault-media-extension__actions">
								<button type="button" class="button button-secondary" data-sd-vault-export data-storage-mode="${this.escapeHtml(file.storage_mode || "vault_private")}" data-id="${this.escapeHtml(file.id)}">${exportLabel}</button>
								<a class="button button-secondary" target="_blank" rel="noopener" href="${this.escapeHtml(editUrl)}">Open in Media Library</a>
							</div>
							<div class="sd-vault-media-comments">
								<div class="sd-vault-media-extension__heading">Vault Comments</div>
								<div data-sd-vault-comments-list><p style="padding:15px; color:#646970;">Loading discussion...</p></div>
								<div class="sd-vault-comment-form" style="margin-top: 12px;">
									<textarea class="widefat" rows="4" data-sd-vault-comment-input placeholder="Write a comment..."></textarea>
									<input type="hidden" data-sd-vault-comment-parent value="0">
									<div style="margin-top: 10px; display: flex; justify-content: flex-end;">
										<button type="button" class="button button-primary" data-sd-vault-comment-save>Post Comment</button>
									</div>
								</div>
							</div>
						</div>
					`)
					this.loadCommentsInto(detailsHost.find("[data-sd-vault-comments-list]").first(), file.id)
				} else {
					detailsHost.append(`
						<div class="sd-vault-media-extension">
							<div class="sd-vault-media-extension__heading">SystemDeck</div>
							<p class="sd-vault-media-extension__text">Import this item into Vault as a private managed copy. Vault remains the private storage authority.</p>
							<label class="sd-vault-media-extension__check">
								<input type="checkbox" data-sd-vault-is-shared ${settings.isShared ? "checked" : ""}>
								<span>Pin File</span>
							</label>
							<div class="sd-vault-media-extension__priority" style="display:${settings.isShared ? "flex" : "none"};">
								<label><input type="radio" name="sd_vault_media_priority" value="urgent" ${settings.priority === "urgent" ? "checked" : ""}> Urgent</label>
								<label><input type="radio" name="sd_vault_media_priority" value="high" ${settings.priority === "high" ? "checked" : ""}> High</label>
								<label><input type="radio" name="sd_vault_media_priority" value="moderate" ${settings.priority === "moderate" ? "checked" : ""}> Moderate</label>
								<label><input type="radio" name="sd_vault_media_priority" value="low" ${settings.priority === "low" ? "checked" : ""}> Low</label>
							</div>
							<div class="sd-vault-media-extension__actions">
								<a class="button button-secondary" target="_blank" rel="noopener" href="${this.escapeHtml(editUrl)}">Open in Media Library</a>
							</div>
						</div>
					`)
				}
			}

			if (this.isAttachmentAudioLike(attachment)) {
				const mediaHost = frameEl.find(".attachment-media-view").first()
				if (mediaHost.length) {
					const midi = this.isMidiFile(attachment)
					const itemFile = context.type === "item" ? context.file : null
					mediaHost.append(`
						<div class="sd-vault-media-audio-extension">
							<div class="sd-vault-media-extension__heading">${midi ? "SystemDeck MIDI" : "SystemDeck Audio"}</div>
							<p class="sd-vault-media-extension__text">${midi ? "Load this MIDI into the shared SystemDeck runtime without replacing the native WordPress preview." : "Use the shared SystemDeck runtime without replacing the native WordPress preview."}</p>
							<div class="sd-vault-media-extension__actions">
								<button type="button" class="button button-secondary" data-sd-vault-audio-open>${midi ? "Send MIDI to Player" : "Send to Player"}</button>
								<button type="button" class="button" data-sd-vault-audio-stop>Stop Runtime</button>
							</div>
							${itemFile && midi ? '<div class="sd-vault-midi-editor-wrap" data-sd-vault-inline-midi-editor></div>' : ""}
						</div>
					`)
					if (itemFile && midi) {
						this.loadInlineMidiEditor(mediaHost.find("[data-sd-vault-inline-midi-editor]").first(), itemFile)
					}
				}
			}

			frameEl.off(".sdVaultMediaFrame")
			if (context.type !== "item") {
				frameEl.on("change.sdVaultMediaFrame", "[data-sd-vault-is-shared], input[name='sd_vault_media_priority']", () => {
					this.getMediaExtensionSettings()
					this.renderMediaExtension(frame)
				})
			}
			frameEl.on("click.sdVaultMediaFrame", ".sd-vault-media-comments .sd-reply-btn", (e) => {
				e.preventDefault()
				const parentId = $(e.currentTarget).data("id")
				const extension = $(e.currentTarget).closest("[data-sd-vault-item-extension]")
				extension.find("[data-sd-vault-comment-parent]").val(parentId)
				extension
					.find("[data-sd-vault-comment-input]")
					.attr("placeholder", "Replying to thread...")
					.focus()
			})
			frameEl.on("click.sdVaultMediaFrame", "[data-sd-vault-comment-save]", async (e) => {
				e.preventDefault()
				const extension = $(e.currentTarget).closest("[data-sd-vault-item-extension]")
				const file = context.file
				if (!file) return
				await this.saveInlineComment(extension, file.id)
			})
			frameEl.on("click.sdVaultMediaFrame", "[data-sd-vault-export]", async (e) => {
				e.preventDefault()
				const file = context.file
				if (!file) return
				const isPublic = String($(e.currentTarget).data("storage-mode") || "") === "media_public"
				const confirmText = isPublic
					? "Return this file to private Vault mode?"
					: "Publish this file to the global WordPress Media Library?"
				if (!window.confirm(confirmText)) return
				const btn = $(e.currentTarget)
				const originalText = btn.text()
				btn.prop("disabled", true).text("Working...")
				try {
					await this.postAction(
						isPublic ? "sd_core_vault_ajax_make_private" : "sd_core_vault_ajax_export_to_media_library",
						{ id: file.id },
					)
					frame.close()
					this.loadFiles()
					window.alert(isPublic ? "File returned to private Vault mode." : "File published to the WordPress Media Library.")
				} catch (error) {
					window.alert(String(error?.message || error || "Unable to update publication state."))
				} finally {
					btn.prop("disabled", false).text(originalText)
				}
			})
			frameEl.on("click.sdVaultMediaFrame", "[data-sd-vault-audio-open]", async (e) => {
				e.preventDefault()
				const sourceFile = context.type === "item" && context.file ? context.file : attachment
				await this.playAttachmentInRuntime(sourceFile)
			})
			frameEl.on("click.sdVaultMediaFrame", "[data-sd-vault-audio-stop]", (e) => {
				e.preventDefault()
				this.getAudioRuntime()?.stop?.()
			})
		},

		playAttachmentInRuntime: async function (attachment) {
			const audio = this.getAudioRuntime()
			if (!audio) {
				window.alert("SystemDeck audio runtime unavailable.")
				return
			}

			const sourceUrl = String(attachment?.stream_url || attachment?.url || "")
			if (!sourceUrl) {
				window.alert("Audio source unavailable.")
				return
			}

			await audio.resume?.()
			const midi = this.isMidiFile(attachment)
			await audio.load(
				midi
					? {
							type: "midi",
							url: sourceUrl,
							id: String(attachment.id || ""),
					  }
					: {
							type: "file",
							url: sourceUrl,
							id: String(attachment.id || ""),
					  },
				{
					title: attachment.title || attachment.filename || "Media Attachment",
					metadata: {
						attachmentId: String(attachment.id || ""),
						mime: attachment.mime || "",
						origin: "vault-media",
						mediaType: midi ? "midi" : "file",
					},
					autoplay: true,
				},
			)
		},

		getFileIconClass: function (file) {
			const mime = String(file?.mime || "").toLowerCase()
			if (mime.includes("image")) return "dashicons-format-image"
			if (mime.includes("pdf")) return "dashicons-media-document"
			if (mime.includes("audio") || mime.includes("midi")) return "dashicons-media-audio"
			if (mime.includes("video")) return "dashicons-media-video"
			if (mime.includes("zip")) return "dashicons-media-archive"
			return "dashicons-media-default"
		},

			renderWorkspaceLabel: function (file) {
				const originName = String(file?.origin_workspace_name || "")
				const originHtml = originName ? this.escapeHtml(originName) : "&mdash;"
	            const modeLabel = String(file?.storage_mode || "") === "media_public" ? "Public" : "Private"
				const isPinned = file?.scope === "pinned"
				const pinnedName = String(file?.workspace_name || "")
				if (isPinned) {
					const pinnedDisplay = pinnedName ? ` ${pinnedName}` : ""
					const priority = String(file?.priority || "low").toLowerCase()
					const level = ["urgent", "high", "moderate", "low"].includes(priority) ? priority : "low"
					return `<span class="sd-vault-origin-label">${originHtml}</span><br/><strong class="sd-vault-pinned-label">Pinned${this.escapeHtml(pinnedDisplay)}</strong> <span class="sd-vault-sep">|</span> <span class="sd-status-badge is-${level}">${this.capitalize(level)}</span> <span class="sd-vault-sep">|</span> <span class="sd-vault-mode-label">${modeLabel}</span>`
				}
				return `<span class="sd-vault-origin-label">${originHtml}</span><br/><span class="sd-vault-mode-label">${modeLabel}</span>`
			},

			renderDateLabel: function (file) {
				if (file?.is_modified && file?.modified) {
					return `<span class="sd-vault-date-kind">Last Modified</span><br>${this.escapeHtml(file.modified)}`
				}
				return `<span class="sd-vault-date-kind">Published</span><br>${this.escapeHtml(file?.date || "")}`
			},

		updateDetailsPriorityBadge: function () {
			const modal = $("#sd-vault-details-modal")
			const badge = modal.find("#sd-vault-priority-badge")
			const isPinned = modal.find("#sd-vault-details-is-shared").is(":checked")
			const level = String($("input[name='sd_vault_priority']:checked").val() || "low").toLowerCase()
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

		isCurrentVaultSource: function (file, state) {
			if (!state || !state.nowPlaying) return false
			const metadata = state.nowPlaying.metadata || {}
			const fileId = String(file?.id || "")
			const vaultId = String(metadata.vaultId || metadata.fileId || "")
			if (fileId && vaultId) return fileId === vaultId
			return (
				String(state.nowPlaying.source || "") === String(file?.stream_url || "")
			)
		},

		cleanupAudioSubscriptions: function () {
			if (typeof this.audioStateUnsubscribe === "function") {
				try {
					this.audioStateUnsubscribe()
				} catch (_err) {}
			}
			if (typeof this.audioTimeUnsubscribe === "function") {
				try {
					this.audioTimeUnsubscribe()
				} catch (_err) {}
			}
			if (typeof this.audioErrorUnsubscribe === "function") {
				try {
					this.audioErrorUnsubscribe()
				} catch (_err) {}
			}
			this.audioStateUnsubscribe = null
			this.audioTimeUnsubscribe = null
			this.audioErrorUnsubscribe = null
			$(document).off("click.sdVaultAudioModalClose")
		},

		postAction: function (action, data = {}) {
			return new Promise((resolve, reject) => {
				$.post(
					window.ajaxurl,
					{
						action,
						_ajax_nonce: getNonce(),
						...data,
					},
					function (res) {
						if (res && res.success) {
							resolve(res.data)
							return
						}
						reject(res?.data || "Request failed")
					},
				).fail(function (_xhr, _status, error) {
					reject(error || "Request failed")
				})
			})
		},

		escapeHtml: function (value) {
			return $("<div>").text(String(value ?? "")).html()
		},

		resetMidiEditor: function (modal) {
			const editor = modal.find("#sd-vault-details-preview-actions")
			editor.removeClass("has-midi-tools").hide().empty()
		},

		setMidiEditorMessage: function (editor, message, type = "info") {
			const el = editor.find("[data-midi-editor-message]")
			el.removeClass(
				"is-success is-error is-info"
			).addClass(`is-${type}`)
			el.text(String(message || ""))
		},

		renderMidiSummaryRows: function (summary = {}) {
			const rows = [
				["Source Hash", summary.source_hash || "Unavailable"],
				["Parser Version", summary.parser_version || "Unavailable"],
				["Derivative Version", summary.derivative_version || "Unavailable"],
				["Track Count", Number(summary.track_count || 0)],
				["Duration", `${this.formatAudioTime(summary.duration || 0)} (${Number(summary.duration || 0).toFixed(2)}s)`],
				["Note Count", Number(summary.note_count || 0)],
				["Modified", summary.is_modified ? "Yes" : "No"],
				["Last Generated", summary.last_generated_at || "Never"],
				["Last Modified", summary.last_modified_at || "Never"],
				["Last Rebuilt", summary.last_rebuilt_at || "Never"],
			]
			return rows
				.map(
					([label, value]) => `
						<div class="sd-vault-midi-summary-item">
							<span class="sd-vault-midi-summary-label">${this.escapeHtml(label)}</span>
							<span class="sd-vault-midi-summary-value">${this.escapeHtml(value)}</span>
						</div>
					`,
				)
				.join("")
		},

		renderMidiEditor: function (modal, file, payload) {
			const self = this
			const editor = modal.find("#sd-vault-details-preview-actions")
			const summary = payload?.summary || {}
			const activeJson = String(payload?.active_json || "")
			editor.html(`
				<div class="sd-vault-midi-editor-wrap">
					<div class="sd-vault-midi-editor-panel">
						<details class="sd-vault-midi-editor-details">
							<summary class="sd-vault-midi-editor-summary-toggle">Advanced MIDI Data</summary>
							<div class="sd-vault-midi-summary-grid" data-midi-summary-grid>
								${self.renderMidiSummaryRows(summary)}
							</div>
							<label class="sd-vault-midi-editor-label" for="sd-vault-midi-json">Active Derivative JSON</label>
							<textarea id="sd-vault-midi-json" class="sd-vault-midi-json" rows="4" spellcheck="false">${self.escapeHtml(activeJson)}</textarea>
							<div class="sd-vault-midi-editor-actions">
								<button type="button" class="button" data-midi-editor-action="validate">Validate JSON</button>
								<button type="button" class="button button-primary" data-midi-editor-action="save">Save MIDI Data</button>
								<button type="button" class="button" data-midi-editor-action="rebuild">Rebuild from Source MIDI</button>
							</div>
							<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>
								MIDI derivative data is hidden Vault metadata. Playback uses the active derivative.
							</div>
						</details>
					</div>
				</div>
			`).addClass("has-midi-tools").show()

			const textarea = editor.find("#sd-vault-midi-json")
			const validateBtn = editor.find('[data-midi-editor-action="validate"]')
			const saveBtn = editor.find('[data-midi-editor-action="save"]')
			const rebuildBtn = editor.find('[data-midi-editor-action="rebuild"]')

			const getRuntime = function () {
				const runtime = self.getAudioRuntime()
				if (!runtime || typeof runtime.normalizeMidiDerivative !== "function") {
					throw new Error("Audio runtime MIDI validator unavailable.")
				}
				return runtime
			}

			const parseAndNormalize = async function () {
				const runtime = getRuntime()
				const raw = textarea.val()
				let parsed
				try {
					parsed = JSON.parse(String(raw || ""))
				} catch (_err) {
					throw new Error("Invalid JSON. Fix formatting before continuing.")
				}

				const normalized = runtime.normalizeMidiDerivative(parsed)
				if (!normalized) {
					throw new Error("JSON is not a valid SystemDeck MIDI derivative.")
				}
				return normalized
			}

			validateBtn.on("click", async function () {
				validateBtn.prop("disabled", true)
				try {
					const normalized = await parseAndNormalize()
					const validated = await self.postAction(
						"sd_core_vault_ajax_validate_midi_derivative",
						{
							id: file.id,
							json: JSON.stringify(normalized),
						},
					)
					textarea.val(validated.pretty_json || JSON.stringify(normalized, null, 2))
					if (validated.summary) {
						Object.assign(summary, validated.summary)
						editor
							.find("[data-midi-summary-grid]")
							.html(self.renderMidiSummaryRows(validated.summary))
					}
					self.setMidiEditorMessage(editor, "MIDI JSON validated.", "success")
				} catch (error) {
					self.setMidiEditorMessage(
						editor,
						String(error?.message || error || "Validation failed."),
						"error",
					)
				} finally {
					validateBtn.prop("disabled", false)
				}
			})

			saveBtn.on("click", async function () {
				saveBtn.prop("disabled", true)
				try {
					const normalized = await parseAndNormalize()
					const saved = await self.postAction(
						"sd_core_vault_ajax_save_midi_derivative",
						{
							id: file.id,
							json: JSON.stringify(normalized),
						},
					)
					textarea.val(saved.active_json || JSON.stringify(normalized, null, 2))
					if (saved.summary) {
						Object.assign(summary, saved.summary)
						editor
							.find("[data-midi-summary-grid]")
							.html(self.renderMidiSummaryRows(saved.summary))
					}
					file.midi_derivative = saved.active_derivative || normalized
					file.midi_derivative_meta = saved.summary || file.midi_derivative_meta || {}
					self.setMidiEditorMessage(editor, "Active MIDI derivative saved.", "success")
				} catch (error) {
					self.setMidiEditorMessage(
						editor,
						String(error?.message || error || "Save failed."),
						"error",
					)
				} finally {
					saveBtn.prop("disabled", false)
				}
			})

			rebuildBtn.on("click", async function () {
				rebuildBtn.prop("disabled", true)
				try {
					const runtime = getRuntime()
					const replaceActive = !summary.is_modified
						? true
						: window.confirm(
								"Replace the edited active MIDI data with a rebuild from the source MIDI?",
						  )
					const response = await fetch(file.stream_url)
					if (!response.ok) {
						throw new Error("Unable to read the source MIDI file.")
					}
					const buffer = await response.arrayBuffer()
					const rebuilt = await runtime.buildMidiDerivativeFromArrayBuffer(buffer, {
						sourceType: "vault",
						id: String(file.id || ""),
						title: file.title || "Vault MIDI",
						mime: file.mime || "audio/midi",
						filename: file.title || "",
						url: file.stream_url,
					})
					const normalized = runtime.normalizeMidiDerivative(rebuilt)
					if (!normalized) {
						throw new Error("Source MIDI rebuild produced invalid derivative data.")
					}
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
						.html(self.renderMidiSummaryRows(saved.summary || {}))
					file.midi_derivative = saved.active_derivative || normalized
					file.midi_derivative_meta = saved.summary || file.midi_derivative_meta || {}
					Object.assign(summary, saved.summary || {})
					self.setMidiEditorMessage(editor, "Derivative rebuilt from source MIDI.", "success")
				} catch (error) {
					self.setMidiEditorMessage(
						editor,
						String(error?.message || error || "Rebuild failed."),
						"error",
					)
				} finally {
					rebuildBtn.prop("disabled", false)
				}
			})
		},

		loadMidiEditor: async function (modal, file) {
			const self = this
			if (!self.isMidiFile(file)) {
				self.resetMidiEditor(modal)
				return
			}

			const editor = modal.find("#sd-vault-details-preview-actions")
			editor
				.addClass("has-midi-tools")
				.show()
				.html(
					'<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>Loading MIDI editor…</div>',
				)

			try {
				const payload = await self.postAction(
					"sd_core_vault_ajax_get_midi_editor_payload",
					{
						id: file.id,
					},
				)
				self.renderMidiEditor(modal, file, payload)
			} catch (error) {
				editor.html(
					`<div class="sd-vault-midi-editor-message is-error" data-midi-editor-message>${self.escapeHtml(
						String(error?.message || error || "Unable to load MIDI editor."),
					)}</div>`,
				)
			}
		},

		loadInlineMidiEditor: async function (host, file) {
			const self = this
			if (!host || !host.length || !self.isMidiFile(file)) {
				if (host && host.length) {
					host.empty().hide()
				}
				return
			}

			host
				.show()
				.html(
					'<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>Loading MIDI controls…</div>',
				)

			try {
				const payload = await self.postAction(
					"sd_core_vault_ajax_get_midi_editor_payload",
					{
						id: file.id,
					},
				)
				host.html(`
					<div class="sd-vault-midi-editor-panel">
						<details class="sd-vault-midi-editor-details">
							<summary class="sd-vault-midi-editor-summary-toggle">Advanced MIDI Data</summary>
							<div class="sd-vault-midi-summary-grid">
								${self.renderMidiSummaryRows(payload?.summary || {})}
							</div>
							<div class="sd-vault-midi-editor-message is-info" data-midi-editor-message>
								Advanced MIDI editing remains available in the transitional Vault editor for private-only items.
							</div>
						</details>
					</div>
				`)
			} catch (error) {
				host.html(
					`<div class="sd-vault-midi-editor-message is-error" data-midi-editor-message>${self.escapeHtml(
						String(error?.message || error || "Unable to load MIDI controls."),
					)}</div>`,
				)
			}
		},

			loadCommentsInto: function (list, fileId) {
				const self = this
				list.html('<p class="description sd-vault-comments-loading">Loading discussion...</p>')
				$.post(window.ajaxurl, {
				action: 'sd_core_vault_ajax_get_file_comments',
				file_id: fileId,
				_ajax_nonce: getNonce()
			}, function(res) {
				if (res.success) {
					list.empty()

					if (!Array.isArray(res.data.comments) || res.data.comments.length === 0) {
						return
					}

					res.data.comments.forEach(function(c) {
						list.append(self.renderCommentHTML(c))
					})
					return
				}
					list.html('<p class="description sd-vault-comments-error">Unable to load discussion.</p>')
				}).fail(function() {
					list.html('<p class="description sd-vault-comments-error">Unable to load discussion.</p>')
				})
			},

		saveInlineComment: async function (root, fileId) {
			const input = root.find("[data-sd-vault-comment-input]")
			const button = root.find("[data-sd-vault-comment-save]")
			const parentInput = root.find("[data-sd-vault-comment-parent]")
			const content = String(input.val() || "").trim()
			const parentId = parentInput.val() || 0
			if (!content) return

			button.prop("disabled", true).text("...")
			try {
				await this.postAction("sd_core_vault_ajax_add_file_comment", {
					file_id: fileId,
					content: content,
					parent_id: parentId,
				})
				input.val("").attr("placeholder", "Write a comment...")
				parentInput.val("0")
				this.loadCommentsInto(root.find("[data-sd-vault-comments-list]").first(), fileId)
				this.loadFiles()
			} finally {
				button.prop("disabled", false).text("Post Comment")
			}
		},

        loadFiles: function() {
            const self = this;
            if (!this.wrapper) return;
            const tbody = this.wrapper.find("#sd-vault-list");
            const table = this.wrapper.find("#sd-vault-table");
            const emptyState = this.wrapper.find("#sd-vault-empty-state");
            const pagination = this.wrapper.find("#sd-vault-pagination");
            const workspaceId = this.wrapper.data("workspace-id") || "";

            table.hide();
            pagination.hide();
            emptyState.hide();
            
            $.ajax({
                url: window.ajaxurl,
                type: "POST",
                data: {
                    action: "sd_core_vault_ajax_get_files",
                    limit: 5,
                    paged: this.currentPage,
                    workspace_id: workspaceId,
                    _ajax_nonce: getNonce()
                },
                success: function(response) {
                    if (response.success && response.data.files) {
                        tbody.empty();
                        
                        if (response.data.files.length === 0) {
                            $("#sd-vault-total-count").text("0 items");
                            $("#sd-vault-current-page").text("1");
                            $("#sd-vault-total-pages").text("1");
                            $("#sd-vault-prev, #sd-vault-next").prop("disabled", true);
                            table.hide();
                            pagination.hide();
                            emptyState.show();
                            return;
                        }

                        self.totalPages = parseInt(response.data.max_pages, 10) || 1;
                        self.currentPage = parseInt(response.data.paged, 10) || self.currentPage;
                        self.currentFiles = Array.isArray(response.data.files) ? response.data.files : [];
                        $("#sd-vault-total-count").text((response.data.total || 0) + " items");
                        $("#sd-vault-current-page").text(self.currentPage);
                        $("#sd-vault-total-pages").text(self.totalPages);
                        $("#sd-vault-prev").prop("disabled", self.currentPage <= 1);
                        $("#sd-vault-next").prop("disabled", self.currentPage >= self.totalPages);
                        emptyState.hide();
                        table.show();
                        pagination.css("display", "flex");

		                        response.data.files.forEach(function(file) {
		                            const icon = self.getFileIconClass(file)
		                            const exportLabel = file.storage_mode === "media_public" ? "Return to Vault" : "Publish to Media Library"
		                            const rowActions = `<div class="row-actions"><span class="edit"><a href="#" class="sd-action-edit">Edit</a> | </span><span class="view"><a href="#" class="sd-action-view">View</a> | </span><span class="export"><a href="#" class="sd-action-export" data-storage-mode="${self.escapeHtml(file.storage_mode || "vault_private")}">${exportLabel}</a> | </span><span class="trash"><a href="#" class="sd-action-trash">Trash</a></span></div>`
		                            const commentHtml = file.comment_count > 0
		                                ? `<div class="post-com-count-wrapper"><a href="#" class="post-com-count" title="View Comments"><span class="comment-count-approved">${file.comment_count}</span><span class="screen-reader-text">Comments</span></a></div>`
		                                : `<span class="sd-vault-no-comments" title="No Comments">&mdash;</span>`
		                            const stickyClass = file.is_sticky ? " is-sticky" : ""
		                            const html = `
		                                <tr class="sd-vault-item${stickyClass}" data-id="${file.id}">
		                                    <th scope="row" class="check-column" data-colname="Sticky">
		                                        <span class="dashicons ${icon} sd-btn-icon sd-note-pin-btn ${file.is_sticky ? "active" : ""}" title="Toggle sticky ordering" aria-hidden="true"></span>
		                                    </th>
	                                    <td class="title column-title has-row-actions column-primary" data-colname="Title">
	                                        <strong><a class="row-title" href="#">${self.escapeHtml(file.title)}</a></strong>
	                                        ${rowActions}
	                                        <button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>
	                                    </td>
	                                    <td class="column-workspace" data-colname="Workspace">${self.renderWorkspaceLabel(file)}</td>
	                                    <td class="column-size" data-colname="Size">${self.escapeHtml(file.size)}</td>
	                                    <td class="column-comments" data-colname="Comments">${commentHtml}</td>
	                                    <td class="column-date" data-colname="Date">${self.renderDateLabel(file)}</td>
	                                </tr>
	                            `
	                            tbody.append(html)
	                        })
	                    } else {
	                        tbody.html('<tr><td class="error-text" colspan="6">Error loading files.</td></tr>')
	                    }
	                }
	            });
        },

		closeDetailsModal: function () {
			const modal = $("#sd-vault-details-modal")
			this.cleanupAudioSubscriptions()
			this.resetMidiEditor(modal)
			modal.hide()
			modal.find("#sd-vault-details-new-comment").val("").attr("placeholder", "Write a comment...")
			modal.find("#sd-vault-details-parent-comment").val("0")
		},

		updateDetailsNavigation: function (id) {
			const ids = (this.currentFiles || []).map((file) => Number(file?.id || 0)).filter((fileId) => fileId > 0)
			const index = ids.indexOf(Number(id || 0))
			$("#sd-vault-details-prev").prop("disabled", index <= 0)
			$("#sd-vault-details-next").prop("disabled", index === -1 || index >= ids.length - 1)
		},

			getDetailsDisplayModel: function (file) {
				const attachment = file && typeof file.attachment === "object" ? file.attachment : null
				const mime = String(attachment?.mime || file?.mime || "")
			const mediaType = String(attachment?.type || "").trim() || (mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "file")
			const title = String(attachment?.title || file?.title || file?.full_title || "")
			const caption = String(attachment?.caption || file?.caption || "")
			const description = String(attachment?.description || file?.description || "")
			const altText = String(attachment?.alt || file?.alt_text || "")
			const artist = String(attachment?.artist || attachment?.meta?.artist || file?.artist || "")
			const album = String(attachment?.album || attachment?.meta?.album || file?.album || "")
			const filename = String(attachment?.filename || file?.full_title || file?.title || "")
				const author = String(file?.author_name || attachment?.authorName || "You")
				const authorUrl = String(file?.author_url || "")
				const uploaded = String(attachment?.dateFormatted || file?.date || "")
				const filesize = String(attachment?.filesizeHumanReadable || file?.size || "")
				const workspace = String(file?.origin_workspace_name || file?.workspace_name || "")
				const status = String(file?.status_label || (String(file?.storage_mode || "") === "media_public" ? "Public" : "Private"))
				const dimensions =
					Number(attachment?.width || 0) > 0 && Number(attachment?.height || 0) > 0
						? `${attachment.width} by ${attachment.height} pixels`
					: ""
			const fileLength = String(attachment?.fileLengthHumanReadable || "")
			const bitrateValue = Number(attachment?.meta?.bitrate || 0)
			const bitrateMode = String(attachment?.meta?.bitrate_mode || "").trim()
			const bitrate = bitrateValue > 0
				? `${Math.round(bitrateValue / 1000)}kb/s${bitrateMode ? ` ${bitrateMode.toUpperCase()}` : ""}`
				: ""
			const previewUrl = String(
				attachment?.sizes?.full?.url ||
				attachment?.sizes?.large?.url ||
				attachment?.image?.src ||
				attachment?.url ||
				file?.stream_url ||
				"",
			)

			return {
				attachment,
				mediaType,
				title,
				caption,
				description,
				altText,
				artist,
				album,
					filename,
					author,
					authorUrl,
					uploaded,
					mime,
					filesize,
					workspace,
					status,
					dimensions,
					fileLength,
					bitrate,
				previewUrl,
				icon: String(attachment?.icon || ""),
			}
		},

		renderDetailsPreview: function (modal, file, details) {
			const previewActions = modal.find("#sd-vault-details-preview-actions")
			const previewShell = modal.find("#sd-vault-details-preview-shell")
			const mediaView = modal.find("#sd-vault-details-media-view")
			previewShell.children().not(previewActions).remove()
			previewActions.removeClass("has-midi-tools").hide().empty()
			this.cleanupAudioSubscriptions()
			this.resetMidiEditor(modal)

			const attachment = details && typeof details.attachment === "object" ? details.attachment : null
			const rawOrientation = String(
				attachment?.orientation ||
				(Number(attachment?.width || 0) > Number(attachment?.height || 0) ? "landscape" : "portrait"),
			).toLowerCase()
			const orientation = rawOrientation === "landscape" ? "landscape" : "portrait"
			const rawThumbnailType = String(
				attachment?.type ||
				(details.mediaType === "audio" || details.mediaType === "video" || details.mediaType === "image"
					? details.mediaType
					: "file"),
			).toLowerCase()
			const thumbnailType = rawThumbnailType || "file"

			mediaView.attr("class", `attachment-media-view ${orientation}`)
			previewShell.attr("class", `thumbnail thumbnail-${thumbnailType}`)

			const attachmentUrl = this.escapeHtml(String(file?.stream_url || details.previewUrl || ""))
			const previewUrl = this.escapeHtml(String(details.previewUrl || file?.stream_url || ""))
			const title = this.escapeHtml(String(details.title || file?.title || "Vault file"))
			const mime = String(details.mime || "")
			const insertPreview = function (html) {
				previewActions.before(html)
			}

			if (details.mediaType === "image" && previewUrl) {
				insertPreview(`<img class="details-image" src="${previewUrl}" draggable="false" alt="" />`)
			} else if (details.mediaType === "audio" && !this.isMidiFile(file)) {
				insertPreview(`
					<div class="wp-media-wrapper wp-audio">
						<audio controls class="wp-audio-shortcode" width="100%" preload="none">
							<source type="${this.escapeHtml(mime)}" src="${attachmentUrl}" />
						</audio>
					</div>
				`)
				window.wp?.mediaelement?.initialize?.()
			} else if (details.mediaType === "video") {
				insertPreview(`
					<div class="wp-media-wrapper wp-video">
						<video controls="controls" class="wp-video-shortcode" preload="metadata">
							<source type="${this.escapeHtml(mime)}" src="${attachmentUrl}" />
						</video>
					</div>
				`)
				window.wp?.mediaelement?.initialize?.()
			} else if (mime.includes("pdf")) {
				insertPreview(`<iframe src="${attachmentUrl}" style="width:100%; min-height:420px; border:none;" title="${title}"></iframe>`)
			} else if (previewUrl && details.mediaType === "file" && mime.includes("image")) {
				insertPreview(`<img class="details-image" src="${previewUrl}" draggable="false" alt="" />`)
			} else {
				const iconUrl = this.escapeHtml(String(details.icon || ""))
				const iconClass = this.getFileIconClass(file)
				insertPreview(iconUrl
					? `<img class="details-image icon" src="${iconUrl}" draggable="false" alt="" />`
					: `<span class="dashicons ${iconClass}" style="font-size:64px; width:64px; height:64px; color:#8c8f94;"></span>`)
			}

			if (this.isMidiFile(file)) {
				this.loadMidiEditor(modal, file)
			}
		},

		renderReadPreview: function (file, details) {
			const attachmentUrl = this.escapeHtml(String(file?.stream_url || details.previewUrl || ""))
			const previewUrl = this.escapeHtml(String(details.previewUrl || file?.stream_url || ""))
			const title = this.escapeHtml(String(details.title || file?.title || "Vault file"))
			const mime = String(details.mime || "")
			const iconClass = this.getFileIconClass(file)
			const iconUrl = this.escapeHtml(String(details.icon || ""))

			if (details.mediaType === "image" && previewUrl) {
				return `<img class="sd-vault-read-preview__image" src="${previewUrl}" draggable="false" alt="${title}" />`
			}

			if (details.mediaType === "audio" && !this.isMidiFile(file)) {
				return `
					<div class="sd-vault-read-preview__player">
						<audio controls class="wp-audio-shortcode" preload="none">
							<source type="${this.escapeHtml(mime)}" src="${attachmentUrl}" />
						</audio>
					</div>
				`
			}

			if (details.mediaType === "video") {
				return `
					<div class="sd-vault-read-preview__player">
						<video controls class="wp-video-shortcode" preload="metadata">
							<source type="${this.escapeHtml(mime)}" src="${attachmentUrl}" />
						</video>
					</div>
				`
			}

			return `
				<div class="sd-vault-read-preview__file">
					${iconUrl
						? `<img class="sd-vault-read-preview__icon" src="${iconUrl}" draggable="false" alt="" />`
						: `<span class="dashicons ${iconClass} sd-vault-read-preview__dashicon" aria-hidden="true"></span>`}
					<div class="sd-vault-read-preview__file-meta">
						<div class="sd-vault-read-preview__file-title">${title}</div>
						<div class="sd-vault-read-preview__file-type">${this.escapeHtml(mime || "File")}</div>
						<a class="button button-secondary" href="${attachmentUrl}" target="_blank" rel="noopener">Open file</a>
					</div>
				</div>
			`
		},

		renderReadMeta: function (file, details) {
			const rows = []
			const authorValue = details.authorUrl
				? `<a href="${this.escapeHtml(details.authorUrl)}">${this.escapeHtml(details.author)}</a>`
				: this.escapeHtml(details.author)

			if (details.uploaded) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>Uploaded on:</strong> ${this.escapeHtml(details.uploaded)}</div>`)
			}
			rows.push(`<div class="sd-vault-read-meta-row"><strong>Uploaded by:</strong> ${authorValue}</div>`)
			if (details.workspace) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>Uploaded to:</strong> ${this.escapeHtml(details.workspace)}</div>`)
			}
			rows.push(`<div class="sd-vault-read-meta-row"><strong>Status:</strong> ${this.escapeHtml(details.status)}</div>`)
			rows.push(`<div class="sd-vault-read-meta-row"><strong>File name:</strong> ${this.escapeHtml(details.filename)}</div>`)
			if (details.mime) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>File type:</strong> ${this.escapeHtml(details.mime)}</div>`)
			}
			if (details.filesize) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>File size:</strong> ${this.escapeHtml(details.filesize)}</div>`)
			}
			if (details.dimensions) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>Dimensions:</strong> ${this.escapeHtml(details.dimensions)}</div>`)
			}
			if (details.fileLength) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>Length:</strong> ${this.escapeHtml(details.fileLength)}</div>`)
			}
			if (details.bitrate) {
				rows.push(`<div class="sd-vault-read-meta-row"><strong>Bitrate:</strong> ${this.escapeHtml(details.bitrate)}</div>`)
			}

			return rows.join("")
		},

        openDetails: function(id) {
            const self = this;
            const modal = $("#sd-vault-details-modal");
            const detailsPane = modal.find("#sd-vault-attachment-details");
            self.cleanupAudioSubscriptions();
            self.resetMidiEditor(modal);
            detailsPane.removeClass("save-waiting save-complete needs-refresh").addClass("save-ready");
            modal.find("#sd-vault-delete-details").hide().data("id", "");
            modal.find("#sd-vault-download-details").hide().attr("href", "#");
            modal.find("#sd-vault-open-media-details").hide().attr("href", "#");
            modal.find("#sd-vault-open-public-link").hide().attr("href", "#");
            modal.find("#sd-vault-export-details").hide().data("id", "");
            modal.find("#sd-vault-open-public-sep, #sd-vault-open-media-sep, #sd-vault-download-sep, #sd-vault-export-sep").hide();
	            modal.find("#sd-vault-priority-badge").hide().text("").removeClass("is-urgent is-high is-moderate is-low");
	            modal.find("#sd-vault-details-preview-shell").children().not("#sd-vault-details-preview-actions").remove();
	            modal.find("#sd-vault-details-preview-shell .sd-vault-loading-text").remove();
	            modal.find("#sd-vault-details-preview-actions").before('<p class="description sd-vault-loading-text">Loading preview...</p>');
	            modal.find("#sd-vault-details-comments-list").html('<p class="description sd-vault-comments-loading">Loading discussion...</p>');
            modal.find("#sd-vault-details-new-comment").val("").attr("placeholder", "Write a comment...");
            modal.find("#sd-vault-details-parent-comment").val("0");
            modal.find("#sd-vault-details-readonly-note").hide();
            modal.find("#sd-vault-details-alt-text, #sd-vault-details-title, #sd-vault-details-artist, #sd-vault-details-album, #sd-vault-details-caption, #sd-vault-details-description, #sd-vault-details-copy-link").val("");
            modal.find("#sd-vault-details-alt-setting, #sd-vault-alt-text-description, #sd-vault-details-artist-setting, #sd-vault-details-album-setting").hide();
            modal.find(".attachment-info, #sd-vault-attachment-details, #sd-vault-details-preview-shell").scrollTop(0);
            modal.show();
            self.updateDetailsNavigation(id);

            $.post(window.ajaxurl, {
                action: 'sd_core_vault_ajax_get_file_details',
                id: id,
                _ajax_nonce: getNonce()
            }, function(res) {
                if (res.success) {
                    const file = res.data;
                    const details = self.getDetailsDisplayModel(file);
                    const isPublic = String(file.storage_mode || "") === "media_public"
                    modal.find("#sd-vault-details-id").val(file.id);
                    modal.find("#sd-vault-details-alt-setting, #sd-vault-alt-text-description").toggle(details.mediaType === "image");
                    modal.find("#sd-vault-details-artist-setting, #sd-vault-details-album-setting").toggle(details.mediaType === "audio");
                    modal.find("#sd-vault-details-alt-text").val(details.altText).prop("readonly", isPublic);
                    modal.find("#sd-vault-details-title").val(details.title).prop("readonly", isPublic);
                    modal.find("#sd-vault-details-artist").val(details.artist).prop("readonly", isPublic);
                    modal.find("#sd-vault-details-album").val(details.album).prop("readonly", isPublic);
                    modal.find("#sd-vault-details-caption").val(details.caption).prop("readonly", isPublic);
                    modal.find("#sd-vault-details-description").val(details.description).prop("readonly", isPublic);
	                    modal.find("#sd-vault-details-is-shared").prop("checked", file.scope === 'pinned');
                    modal.find("#sd-vault-delete-details").show().data("id", file.id);
                    modal.find("#sd-vault-download-details").show().attr("href", isPublic ? file.stream_url : `${file.stream_url}&download=1`);
                    modal.find("#sd-vault-download-sep").show();
                    if (file.edit_url) {
                        modal.find("#sd-vault-open-media-details").show().attr("href", file.edit_url);
                        modal.find("#sd-vault-open-media-sep").show();
                    }
                    if (isPublic && file.stream_url) {
                        modal.find("#sd-vault-open-public-link").show().attr("href", file.stream_url);
                        modal.find("#sd-vault-open-public-sep").show();
                    }
                    modal.find("#sd-vault-export-details")
                        .show()
                        .data("id", file.id)
                        .data("storage-mode", file.storage_mode || "vault_private")
                        .text(isPublic ? "Return to Vault" : "Publish to Media Library");
                    modal.find("#sd-vault-export-sep").show();
                    modal.find("#sd-vault-details-readonly-note").toggle(isPublic);
                    
                    // Set priority radio
                    modal.find(`input[name="sd_vault_priority"][value="${file.priority || 'low'}"]`).prop("checked", true);
                    
	                    if (file.scope === 'pinned') {
                        modal.find("#sd-vault-details-priority-wrap").show();
                    } else {
                        modal.find("#sd-vault-details-priority-wrap").hide();
                    }

                    self.updateDetailsPriorityBadge();
                    modal.find("#sd-vault-details-modal-title").text("Attachment details");
                    modal.find("#sd-vault-details-uploaded").text(details.uploaded || file.date || "")
	                    modal.find("#sd-vault-details-author").html(
	                        details.authorUrl
	                            ? `<a href="${self.escapeHtml(details.authorUrl)}">${self.escapeHtml(details.author)}</a>`
	                            : self.escapeHtml(details.author)
	                    )
	                    modal.find("#sd-vault-details-workspace").text(details.workspace)
	                    modal.find("#sd-vault-details-status").text(details.status)
	                    modal.find("#sd-vault-details-filename").text(details.filename)
                    modal.find("#sd-vault-details-filetype").text(details.mime || file.mime || "")
                    modal.find("#sd-vault-details-filesize").text(details.filesize || file.size || "")
                    modal.find("#sd-vault-details-dimensions-row").toggle(Boolean(details.dimensions))
                    modal.find("#sd-vault-details-dimensions").text(details.dimensions)
                    modal.find("#sd-vault-details-length-row").toggle(Boolean(details.fileLength))
                    modal.find("#sd-vault-details-length").text(details.fileLength)
                    modal.find("#sd-vault-details-bitrate-row").toggle(Boolean(details.bitrate))
                    modal.find("#sd-vault-details-bitrate").text(details.bitrate)
                    modal.find("#sd-vault-details-copy-link").val(String(file.stream_url || ""))
                    modal.find(".attachment-info, #sd-vault-attachment-details, #sd-vault-details-preview-shell").scrollTop(0)

                    self.renderDetailsPreview(modal, file, details)
                    self.loadComments(file.id, "details")

                    // Bind save button
                    $(document).off('click.sdVaultSaveDetails').on('click.sdVaultSaveDetails', '#sd-vault-save-details', function() {
                        self.saveDetails();
                    });
                    $(document).off('click.sdVaultDeleteDetails').on('click.sdVaultDeleteDetails', '#sd-vault-delete-details', function() {
                        const fileId = $(this).data('id');
                        if (!fileId || !window.confirm("Are you sure you want to permanently delete this file?")) return;
                        $.post(window.ajaxurl, {
                            action: 'sd_core_vault_ajax_delete_file',
                            id: fileId,
                            _ajax_nonce: getNonce()
                        }, function(deleteRes) {
                            if (deleteRes.success) {
                                self.closeDetailsModal();
                                self.loadFiles();
                                document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"));
                            }
                        });
                    });
                    $(document).off('click.sdVaultExportDetails').on('click.sdVaultExportDetails', '#sd-vault-export-details', function() {
                        const fileId = $(this).data('id');
                        const isPublic = String($(this).data('storage-mode') || '') === 'media_public';
                        const confirmText = isPublic
                            ? "Return this file to private Vault mode?"
                            : "Publish this file to the global WordPress Media Library?";
                        if (!fileId || !window.confirm(confirmText)) return;
                        const btn = $(this);
                        const oldHtml = btn.html();
                        btn.prop("disabled", true).text("Working...");
                        $.post(window.ajaxurl, {
                            action: isPublic ? 'sd_core_vault_ajax_make_private' : 'sd_core_vault_ajax_export_to_media_library',
                            id: fileId,
                            _ajax_nonce: getNonce()
                        }, function(exportRes) {
                            btn.prop("disabled", false).html(oldHtml);
                            if (exportRes.success) {
                                self.loadFiles();
                                self.handleEditAction(fileId);
                                alert(isPublic ? "File returned to private Vault mode." : "File published to the WordPress Media Library.");
                            } else {
                                alert((isPublic ? "Return to Vault failed: " : "Publish failed: ") + (exportRes.data || "Unknown error"));
                            }
                        });
                    });
                }
            });
        },

	        saveDetails: function() {
            const self = this;
            const id = $("#sd-vault-details-id").val();
            const detailsPane = $("#sd-vault-attachment-details");
            const altText = $("#sd-vault-details-alt-text").val().trim();
            const title = $("#sd-vault-details-title").val().trim();
            const artist = $("#sd-vault-details-artist").val().trim();
            const album = $("#sd-vault-details-album").val().trim();
            const caption = $("#sd-vault-details-caption").val().trim();
            const description = $("#sd-vault-details-description").val().trim();
            const isShared = $("#sd-vault-details-is-shared").is(":checked");
            const workspaceId = this.getCurrentWorkspaceId();
            const workspaceName = this.getCurrentWorkspaceName();

            const priority = $('input[name="sd_vault_priority"]:checked').val() || 'low';

            if (!title) return;

            detailsPane.removeClass("save-complete").addClass("save-waiting");
            $("#sd-vault-save-details").prop("disabled", true).text("Saving...");

            $.post(window.ajaxurl, {
                action: 'sd_core_vault_ajax_save_file_details',
                id: id,
                alt_text: altText,
                title: title,
                artist: artist,
                album: album,
                caption: caption,
                description: description,
                scope: isShared ? 'pinned' : 'private',
                priority: priority,
                workspace_id: workspaceId,
                workspace_name: workspaceName,
                _ajax_nonce: getNonce()
            }, function(res) {
                detailsPane.removeClass("save-waiting");
                $("#sd-vault-save-details").prop("disabled", false).text("Update");
                if (res.success) {
                    detailsPane.addClass("save-complete");
                    self.cleanupAudioSubscriptions();
                    self.resetMidiEditor($("#sd-vault-details-modal"));
                    $("#sd-vault-details-modal").hide();
                    self.loadFiles();
                    document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"));
                }
            });
        },

        openComments: async function(id, title) {
            const self = this;
            const modal = $("#sd-vault-comments-modal");
            modal.find("#sd-vault-comment-file-title").text(title || "Loading...");
            modal.find("#sd-vault-comment-file-author").text("");
            modal.find("#sd-vault-comment-file-date").text("");
            modal.find("#sd-vault-comment-file-id").val(id);
	            modal.find("#sd-vault-comment-file-urgency").addClass("sd-hidden").text("").removeClass("is-urgent is-high is-moderate is-low");
	            modal.find("#sd-vault-read-preview").html('<span class="spinner is-active sd-vault-spinner"></span>');
	            modal.find("#sd-vault-read-meta").html("");
	            modal.find("#sd-vault-comments-list").html('<p class="description sd-vault-comments-loading">Loading discussion...</p>');
	            modal.find("#sd-vault-new-comment").val("").attr("placeholder", "Write a comment...");
	            modal.find("#sd-vault-parent-comment").val("0");
	            modal.show();

            try {
                const file = await this.fetchFileDetails(id)
                const details = this.getDetailsDisplayModel(file)
                modal.find("#sd-vault-comment-file-title").text(details.title || title || "Vault file")
                modal.find("#sd-vault-comment-file-author").text(details.author || "")
                modal.find("#sd-vault-comment-file-date").text(details.uploaded || file.date || "")
                modal.find("#sd-vault-read-preview").html(this.renderReadPreview(file, details))
                modal.find("#sd-vault-read-meta").html(this.renderReadMeta(file, details))
	                const badge = modal.find("#sd-vault-comment-file-urgency")
	            if (String(file?.scope || "") === "pinned") {
	                    const priority = String(file?.priority || "low").toLowerCase()
	                    const safePriority = ["urgent", "high", "moderate", "low"].includes(priority) ? priority : "low"
	                    badge.text(this.capitalize(safePriority)).removeClass("is-urgent is-high is-moderate is-low sd-hidden").addClass(`is-${safePriority}`)
	                }
	                window.wp?.mediaelement?.initialize?.()
	            } catch (error) {
	                modal.find("#sd-vault-read-preview").html('<p class="description sd-vault-comments-error">Unable to load preview.</p>')
	                modal.find("#sd-vault-read-meta").html(`<div class="sd-vault-read-meta-row sd-vault-comments-error">${this.escapeHtml(String(error?.message || error || "Unable to load file details."))}</div>`)
	            }

            this.loadComments(id);

            $(document).off('click.sdVaultSaveComment').on('click.sdVaultSaveComment', '#sd-vault-save-comment', function() {
                self.saveComment();
            });
        },

	        loadComments: function(fileId, mode = "legacy") {
	            const list = mode === "details"
	                    ? $("#sd-vault-details-comments-list")
	                    : $("#sd-vault-comments-list");
	            this.loadCommentsInto(list, fileId);
        },

	        renderCommentHTML: function(comment, isReply = false) {
	            const wrapperClass = isReply
	                ? "dashboard-comment-wrap sd-vault-comment-thread sd-vault-comment-reply"
	                : "dashboard-comment-wrap sd-vault-comment-thread"
	            const replyBtn = isReply
	                ? ""
	                : `<button class="button-link sd-reply-btn" data-id="${comment.id}">Reply</button>`

            let repliesHtml = ""
            if (Array.isArray(comment.replies) && comment.replies.length > 0) {
                repliesHtml += '<div class="sd-vault-comment-replies">'
                comment.replies.forEach((reply) => {
                    repliesHtml += this.renderCommentHTML(reply, true)
                })
                repliesHtml += "</div>"
            }

	            return `
	                <div class="${wrapperClass}">
	                    <div class="comment-meta">
	                        <img class="avatar" src="${comment.avatar}" alt="${comment.author}" width="24" height="24">
	                        <cite>${comment.author}</cite>
	                        <span class="sd-note-comment-date">${comment.date}</span>
	                        ${replyBtn}
	                    </div>
	                    <div class="sd-vault-comment-content">${comment.content}</div>
	                    ${repliesHtml}
	                </div>
            `
        },

	        saveComment: function(mode = "legacy") {
	            const self = this;
	            const fileId = mode === "details"
	                    ? $("#sd-vault-details-id").val()
	                    : $("#sd-vault-comment-file-id").val();
	            const input = mode === "details"
	                    ? $("#sd-vault-details-new-comment")
	                    : $("#sd-vault-new-comment");
	            const button = mode === "details"
	                    ? $("#sd-vault-details-save-comment")
	                    : $("#sd-vault-save-comment");
	            const parentInput = mode === "details"
	                    ? $("#sd-vault-details-parent-comment")
	                    : $("#sd-vault-parent-comment");
            const content = input.val().trim();
            const parentId = parentInput.length ? (parentInput.val() || 0) : 0;
            if (!content) return;

            button.prop("disabled", true).text("...");
            
            $.post(window.ajaxurl, {
                action: 'sd_core_vault_ajax_add_file_comment',
                file_id: fileId,
                content: content,
                parent_id: parentId,
                _ajax_nonce: getNonce()
            }, function(res) {
                button.prop("disabled", false).text("Post Comment");
                if (res.success) {
                    input.val("");
                    if (parentInput.length) {
                        parentInput.val("0");
                    }
                    input.attr("placeholder", "Write a comment...");
                    self.loadComments(fileId, mode);
                    self.loadFiles(); // Sync counts in list
                }
            });
        }
    };
    
    VaultWidget.init();
})(jQuery);
