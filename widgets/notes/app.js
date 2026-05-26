/**
 * SystemDeck - app.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/notes/app.js
 * @license GPL-2.0-or-later
 *
 * Notes Widget (Client-side Interaction)
 */

;(function ($) {
	"use strict"

	function getNonce() {
		return window.SystemDeckSecurity?.nonce || window.sd_vars?.nonce || ""
	}

	function escHtml(value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
	}

	class SystemDeckNoteInstance {
		constructor(element) {
			this.wrapper = $(element)
			this.workspaceId = String(this.wrapper.data("workspace-id") || "")
			this.currentPage = 1
			this.totalPages = 1
			this.viewMode = "mine"
			this.editor = null // CodeMirror instance

			// Scoped elements
			this.modal = this.wrapper.find(".sd-note-edit-modal").addClass("systemdeck-scope")
			this.readModal = this.wrapper.find(".sd-note-read-modal").addClass("systemdeck-scope")
			this.list = this.wrapper.find(".sd-notes-list")
			this.table = this.wrapper.find(".sd-notes-table")
			this.pagination = this.wrapper.find(".sd-notes-pagination")
			this.emptyState = this.wrapper.find(".sd-notes-empty-state")

			// Generate unique ID for this instance's CodeMirror textarea
			const uniqueId =
				"sd-notes-editor-" + Math.floor(Math.random() * 1000000)
			this.modal.find(".sd-note-code-content").attr("id", uniqueId)

			this.init()
		}

		init() {
			this.bindEvents()
			this.setupExternalEvents()

			// Let workspace load first
			setTimeout(() => {
				this.loadNotes()
			}, 100)
		}

		postAction(action, data = {}) {
			return new Promise((resolve, reject) => {
				$.post(
					window.sd_vars?.ajaxurl || window.ajaxurl,
					{
						action,
						nonce: getNonce(),
						_ajax_nonce: getNonce(),
						...data,
					},
					(res) => {
						if (res && res.success) {
							resolve(res.data)
						} else {
							const err =
								res?.data?.error ||
								res?.data?.message ||
								res?.data ||
								"Request failed"
							reject(err)
						}
					},
				)
			})
		}

		escapeHtml(value) {
			return $("<div>").text(String(value ?? "")).html()
		}

		getStatusBadge(priority) {
			const map = {
				urgent: { label: "Urgent", class: "is-urgent" },
				high: { label: "High", class: "is-high" },
				moderate: { label: "Moderate", class: "is-moderate" },
				low: { label: "Low", class: "is-low" },
			}

			const config = map[priority] || null
			if (!config) return ""

			return `<span class="sd-status-badge ${config.class}">${config.label}</span>`
		}

		setupExternalEvents() {
			const self = this
			// External events are global, so we only respond if it's meant for "us"
			// or if we're the primary widget. For now, open-note opens in the instance.
			document.addEventListener("systemdeck:open-note", function (e) {
				const detail = e?.detail || {}
				const noteId = Number(detail.noteId || 0)
				const targetWorkspace = String(detail.workspaceId || "")

				if (!noteId) return

				// Scoping: If workspaceId is provided, only the matching widget responds.
				// If no workspaceId is provided, the first visible widget responds.
				if (targetWorkspace && targetWorkspace !== self.workspaceId) {
					return
				}

				if (!targetWorkspace && !self.wrapper.is(":visible")) {
					return
				}

				if ((detail.mode || "read") === "read") {
					self.openReadModal(noteId)
				} else if (detail.mode === "edit") {
					// Assuming edit functionality exists in class
					self.editNote(noteId)
				}
			})

			document.addEventListener(
				"systemdeck:comments:count-updated",
				function (e) {
					const detail = e?.detail || {}
					const targetType = String(
						detail.targetType || "",
					).toLowerCase()
					if (targetType !== "note" && targetType !== "notes") return
					const noteId = Number(detail.targetId || 0)
					const count = Number(detail.count || 0)
					if (!noteId) return
					self.sdNotesUpdateCommentCount(noteId, count)
				},
			)
		}

		sdNotesUpdateCommentCount(noteId, newCount) {
			const safeNoteId = Number(noteId || 0)
			if (!safeNoteId) return
			const safeCount = Math.max(0, Number(newCount || 0))
			const row = this.wrapper.find(
				`.sd-note-item[data-id="${safeNoteId}"], .sd-note-item[data-note-id="${safeNoteId}"]`,
			)
			if (!row.length) return

			const commentsLink = row.find(".column-comments a").first()
			const badgeWrap = row.find(".post-com-count").first()
			const approved = row.find(".comment-count-approved").first()

			if (commentsLink.length) {
				commentsLink.attr("data-count", String(safeCount))
			}
			if (approved.length) {
				approved.text(String(safeCount))
			} else if (badgeWrap.length) {
				badgeWrap.text(String(safeCount))
			}

			row.addClass("sd-note-comments-updated")
			setTimeout(() => {
				row.removeClass("sd-note-comments-updated")
			}, 800)
		}

		bindEvents() {
			const self = this
			const wrapper = this.wrapper
			const modal = this.modal
			const readModal = this.readModal

			// Search input filter
			wrapper.on("keyup.sdNotesSearch", ".sd-notes-search", function () {
				self.filterNotes($(this).val())
			})

			// Add Note button opens form
			wrapper.on("click.sdNotesAdd", ".sd-note-new", function () {
				self.resetForm()
				modal.find(".sd-note-edit-modal-heading").text("New Note")
				modal.show()

				if (modal.find(".sd-note-capture").is(":checked")) {
					self.injectCaptureData()
				}
			})

			// Save Note
			modal.on("click.sdNotesSave", ".sd-note-save", function () {
				self.saveNote()
			})

			// Edit Note
			wrapper.on(
				"click.sdNotesEdit",
				".sd-note-item .sd-action-edit",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					const row = $(this).closest(".sd-note-item")
					const isAuthor = row.data("is-author") == "1"
					if (!isAuthor && row.data("scope") === "pinned") {
						self.openReadModal(row.data("id"))
					} else {
						self.editNote(row)
					}
				},
			)

			// View Note
			wrapper.on(
				"click.sdNotesView",
				".sd-note-item .sd-action-view, .sd-note-item .column-title .row-title",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					self.openReadModal(
						$(this).closest(".sd-note-item").data("id"),
					)
				},
			)

			// Open shared comments modal
			wrapper.on(
				"click.sdNotesComments",
				".sd-note-item .column-comments a, .sd-note-item .post-com-count",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					const row = $(this).closest(".sd-note-item")
					const noteId = Number(row.data("id") || 0)
					const noteTitle =
						String(row.data("full-title") || "").trim() ||
						String(row.find(".row-title").text() || "").trim() ||
						"Notes"
					self.openCommentsModal(noteId, noteTitle)
				},
			)

			// Sticky toggle
			wrapper.on(
				"click.sdNotesSticky",
				".sd-note-item .sd-note-pin-btn",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					self.toggleSticky(
						$(this).closest(".sd-note-item").data("id"),
					)
				},
			)

			// Trash Note
			wrapper.on(
				"click.sdNotesTrash",
				".sd-note-item .sd-action-trash",
				function (e) {
					e.preventDefault()
					e.stopPropagation()
					const row = $(this).closest(".sd-note-item")
					const id = row.data("id")
					const title = row.data("full-title") || "this note"
					if (confirm(`Are you sure you want to trash "${title}"?`)) {
						self.deleteNote(id)
					}
				},
			)

			// Delete Note
			modal.on("click.sdNotesDel", ".sd-note-delete", function () {
				if (confirm("Are you sure you want to delete this note?")) {
					self.deleteNote($(this).data("id"))
				}
			})

			// Pagination
			wrapper.on("click.sdNotes", ".sd-notes-prev", function (e) {
				e.preventDefault()
				if (self.currentPage > 1) {
					self.currentPage--
					self.loadNotes()
				}
			})

			wrapper.on("click.sdNotes", ".sd-notes-next", function (e) {
				e.preventDefault()
				if (self.currentPage < self.totalPages) {
					self.currentPage++
					self.loadNotes()
				}
			})

			// Capture Toggle
			modal.on("change.sdNotes", ".sd-note-capture", function () {
				if ($(this).is(":checked")) {
					self.injectCaptureData()
				}
			})

			// Code Snippet Toggle
			modal.on("change.sdNotes", ".sd-note-is-code", function () {
				self.toggleEditorMode()
			})

			// Context Filter
			wrapper.on("click.sdNotes", ".sd-note-context-filter", function () {
				$(this).toggleClass("active")
				self.loadNotes()
			})

			wrapper.on("click.sdNotes", ".sd-notes-view-mode", function (e) {
				e.preventDefault()
				const mode = String(
					$(this).data("view-mode") || "mine",
				).toLowerCase()
				self.viewMode = mode === "shared" ? "shared" : "mine"
				wrapper
					.find(".sd-notes-view-mode")
					.removeClass("is-primary")
				$(this).addClass("is-primary")
				self.currentPage = 1
				self.loadNotes()
			})

			// Sticky Toggle reveal
			modal.on(
				"change.sdNotesProjected",
				".sd-note-is-projected",
				function () {
					modal
						.find(".sd-note-sticky-level-wrap")
						.toggle($(this).is(":checked"))
					self.updateEditPriorityBadge()
				},
			)

			modal.on(
				"change.sdNotesPriority",
				"input[name='sd_note_level']",
				function () {
					self.updateEditPriorityBadge()
				},
			)

			// Modal close
			wrapper.on("click.sdModalClose", ".sd-modal-close", function () {
				$(this).closest(".sd-modal-overlay").hide()
			})

			// Click-outside-to-close on overlay
			wrapper.on(
				"click.sdModalOverlay",
				".sd-modal-overlay",
				function (e) {
					if ($(e.target).is(".sd-modal-overlay")) {
						$(this).hide()
					}
				},
			)

			// Task item clicks (delegated)
			this.wrapper.on(
				"change",
				".sd-task-item input[type='checkbox']",
				function (e) {
					const $cb = $(this)
					const $item = $cb.closest(".sd-note-item")
					if ($item.length) {
						self.handleTaskClick($cb, $item.data("id"))
					}
				},
			)
		}

		renderNoteRow(note) {
			const self = this
			const safeCode = escHtml(note.code_content || "")
			const safeExcerpt = escHtml(note.excerpt || "")
			const safeContext = escHtml(note.context || "")

			const originName = escHtml(note.origin_workspace_name || "")
			const pinnedName =
				note.scope === "pinned"
					? escHtml(note.workspace_name || note.workspace_title || "")
					: ""
			const isProjected = note.scope === "pinned"
			let scopeLabel = `<span class="sd-note-workspace-origin">${
				originName || "&mdash;"
			}</span><br/>`

			if (isProjected) {
				const projectedDisplay = pinnedName ? ` ${pinnedName}` : ""
				const badgeHTML = this.getStatusBadge(
					note.sticky_level || "low",
				)
				scopeLabel += `<strong class="sd-note-workspace-pinned">Pinned${projectedDisplay}</strong> <span class="sd-note-pipe">|</span> ${badgeHTML}`
			} else {
				scopeLabel += `<span class="sd-note-workspace-private">Private</span>`
			}

			const dateHtml = note.date || ""

			const codeBadge = note.is_code
				? `<span class="sd-note-code-badge">| Code <span class="dashicons dashicons-editor-code"></span></span>`
				: ""

			const rowActions = `
				<div class="row-actions">
					<span class="edit"><a href="#" class="sd-action-edit">Edit</a> | </span>
					<span class="view"><a href="#" class="sd-action-view">View</a> | </span>
					<span class="trash"><a href="#" class="sd-action-trash">Trash</a>${codeBadge}</span>
				</div>
			`

			const title = escHtml(note.title || "(Untitled)")
			const safeCommentCount = Math.max(0, Number(note.comment_count || 0))
			const commentHtml = `<div class="post-com-count-wrapper"><a href="#" class="post-com-count" title="View Comments"><span class="comment-count-approved">${safeCommentCount}</span><span class="screen-reader-text">Comments</span></a></div>`

			const contextHtml = note.context
				? `<a href="${escHtml(note.context)}" target="_blank" class="sd-note-context-link" title="${escHtml(note.context)}">
					<span class="dashicons dashicons-admin-links"></span> Context
				   </a>`
				: "&mdash;"

			return `
				<tr class="sd-note-item alternate" data-id="${
					note.id
				}" data-full-title="${escHtml(note.full_title || note.title)}" data-is-author="${
				note.is_author ? 1 : 0
			}" data-excerpt="${safeExcerpt}" data-is-code="${
				note.is_code ? 1 : 0
			}" data-context="${safeContext}" data-scope="${
				note.scope || "private"
			}" data-sticky-level="${
				note.sticky_level || "low"
			}" data-workspace-id="${
				note.workspace_id || ""
			}">
					<td class="check-column" data-colname="Pin">
						<span class="dashicons dashicons-admin-post sd-btn-icon sd-note-pin-btn ${
							note.is_sticky ? "active" : ""
						}" title="Toggle sticky ordering"></span>
					</td>
					<td class="title column-title has-row-actions column-primary" data-colname="Title">
						<strong><a class="row-title" href="#">${title}</a></strong>
						${rowActions}
						<button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>
						<div class="note-content-hidden sd-hidden">${escHtml(note.content)}</div>
						<div class="note-code-hidden sd-hidden">${safeCode}</div>
					</td>
					<td class="column-comments" data-colname="Comments">
						${commentHtml}
					</td>
					<td class="date column-date" data-colname="Date">${dateHtml}</td>
				</tr>
			`
		}

		openReadModal(noteId) {
			const self = this
			const modal = this.readModal
			modal.data("note-id", noteId).show()

			modal.find(".sd-note-read-title").text("Loading...")
			modal
				.find(".sd-note-read-content")
				.html('<span class="spinner is-active"></span>')
			modal.find(".sd-note-read-visit-url").hide()
			modal.find(".sd-note-comments-list").empty()
			modal.find(".sd-note-parent-comment").val("0")
			modal
				.find(".sd-note-new-comment")
				.attr("placeholder", "Write a comment...")
				.val("")

			$.post(
				window.sd_vars?.ajaxurl || window.ajaxurl,
				{
					action: "sd_get_read_note",
					id: noteId,
					nonce: getNonce(),
				},
				function (res) {
					if (modal.data("note-id") !== noteId) return

					if (res.success && res.data.note) {
						const note = res.data.note

						modal.find(".sd-note-read-title").text(note.title)
						let displayContent = note.content
						if (note.is_code && note.code_content) {
							const safeCode = (note.code_content || "")
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")

							const codeId =
								"sd-note-view-code-" +
								noteId +
								"-" +
								Math.floor(Math.random() * 1000)
							displayContent += `
								<div class="sd-view-code-block">
									<div class="description sd-code-label">SOURCE CODE</div>
									<div class="sd-note-form">
										<textarea id="${codeId}" class="sd-hidden">${safeCode}</textarea>
									</div>
								</div>
							`
							modal
								.find(".sd-note-read-content")
								.html(displayContent)

							if (typeof wp !== "undefined" && wp.codeEditor) {
								const settings = $.extend(
									true,
									{},
									wp.codeEditor.defaultSettings || {},
									{
										codemirror: {
											mode: "application/x-httpd-php",
											lineNumbers: true,
											indentUnit: 4,
											readOnly: "nocursor",
										},
									},
								)
								const viewEditor = wp.codeEditor.initialize(
									codeId,
									settings,
								)
								setTimeout(
									() => viewEditor.codemirror.refresh(),
									50,
								)
							}
						} else {
							modal
								.find(".sd-note-read-content")
								.html(displayContent)
						}

						modal
							.find(".sd-note-read-author")
							.text("By " + note.author_name)
						modal.find(".sd-note-read-date").text(note.date)

						const badgeHTML = self.getStatusBadge(
							note.sticky_level || "low",
						)
						modal.find(".sd-note-read-urgency").html(badgeHTML)

						const readCtx = note.context || ""
						const $visitBar = modal.find(".sd-note-read-visit-url")
						if (
							readCtx &&
							(readCtx.startsWith("http") ||
								readCtx.startsWith("//"))
						) {
							$visitBar.attr("href", readCtx).show()
						} else {
							$visitBar.removeAttr("href").hide()
						}

						if (note.can_comment) {
							modal.find(".sd-note-comment-form-container").show()
						} else {
							modal.find(".sd-note-comment-form-container").hide()
						}
					} else {
						const msg =
							res.data?.error ||
							"This note may have been deleted or moved."
						modal.find(".sd-note-read-title").text("Access Denied")
						modal
							.find(".sd-note-read-content")
							.html(`<p class="sd-error-text">${msg}</p>`)
					}
				},
			)
		}

		updateEditPriorityBadge() {
			const badge = this.modal.find(".sd-note-edit-urgency")
			const isProjected = this.modal
				.find(".sd-note-is-projected")
				.is(":checked")
			const level = String(
				this.modal.find("input[name='sd_note_level']:checked").val() ||
					"low",
			).toLowerCase()

			if (!isProjected) {
				badge.empty()
				return
			}

			badge.html(this.getStatusBadge(level))
		}

		openCommentsModal(noteId, noteTitle) {
			document.dispatchEvent(
				new CustomEvent("systemdeck:comments:open", {
					detail: {
						targetType: "note",
						targetId: Number(noteId || 0),
						title: noteTitle || "Notes",
					},
				}),
			)
		}

		renderTaskContent(content) {
			if (
				!content ||
				(!content.includes("[ ]") && !content.includes("[x]"))
			) {
				return null
			}

			const lines = content.split("\n")
			let taskHtml = '<ul class="sd-task-list">'
			let hasTasks = false

			lines.forEach((line, index) => {
				const trimmed = line.trim()
				if (trimmed.startsWith("[ ]") || trimmed.startsWith("[x]")) {
					hasTasks = true
					const isChecked = trimmed.startsWith("[x]")
					const text = trimmed.substring(3).trim()
					taskHtml += `
						<li class="sd-task-item ${isChecked ? "is-done" : ""}">
							<label>
								<input type="checkbox" ${isChecked ? "checked" : ""} data-index="${index}">
								<span>${escHtml(text)}</span>
							</label>
						</li>
					`
				}
			})

			taskHtml += "</ul>"
			return hasTasks ? taskHtml : null
		}

		handleTaskClick(checkbox, noteId) {
			const index = checkbox.data("index")
			const isChecked = checkbox.is(":checked")
			const row = checkbox.closest(".sd-note-item")
			const contentHidden = row.find(".note-content-hidden")
			let content = contentHidden.text()

			// Update the content string
			const lines = content.split("\n")
			if (lines[index]) {
				const oldLine = lines[index].trim()
				const newLine = isChecked
					? oldLine.replace("[ ]", "[x]")
					: oldLine.replace("[x]", "[ ]")
				lines[index] = lines[index].replace(oldLine, newLine)
				content = lines.join("\n")
				// Update both the hidden text and the visual task state
				contentHidden.text(content)
				this.saveTaskState(noteId, content)
			}

			checkbox
				.closest(".sd-task-item")
				.toggleClass("is-completed", isChecked)
		}

		saveTaskState(noteId, content) {
			$.post(window.sd_vars?.ajaxurl || window.ajaxurl, {
				action: "sd_save_note_tasks",
				id: noteId,
				content: content,
				nonce: getNonce(),
			})
		}

		injectCaptureData() {
			const titleInput = this.modal.find(".sd-note-title")
			if (!titleInput.val()) {
				titleInput.val(document.title)
			}
		}

		loadNotes() {
			const self = this
			const list = this.list
			const table = this.table
			const pagination = this.pagination
			const emptyState = this.emptyState

			table.hide()
			pagination.hide()
			emptyState.hide()
			list.html(
				'<tr><td colspan="4" class="sd-loading-td">Loading...</td></tr>',
			)

			const filterActive = this.wrapper
				.find(".sd-note-context-filter")
				.hasClass("active")
			const context = filterActive
				? window.location.href.split("#")[0]
				: ""

			this.postAction("sd_get_notes", {
				limit: 5,
				paged: this.currentPage,
				context: context,
				view_mode: this.viewMode === "shared" ? "shared" : "mine",
				workspace_id:
					localStorage.getItem("sd_active_workspace") ||
					window.sd_vars?.active_workspace ||
					"",
			})
				.then((data) => {
					list.empty()
					if (!data.notes || data.notes.length === 0) {
						table.hide()
						pagination.hide()
						emptyState.show()
						self.wrapper.find(".sd-notes-total-count").text("0 items")
						self.wrapper.find(".sd-notes-current-page").text("1")
						self.wrapper.find(".sd-notes-total-pages").text("1")
						self.wrapper
							.find(".sd-notes-prev, .sd-notes-next")
							.prop("disabled", true)
						return
					}

					table.show()
					pagination.css("display", "flex")
					emptyState.hide()

					self.totalPages = parseInt(data.max_pages, 10) || 1
					self.wrapper
						.find(".sd-notes-total-count")
						.text((data.total || 0) + " items")
					self.wrapper.find(".sd-notes-current-page").text(self.currentPage)
					self.wrapper.find(".sd-notes-total-pages").text(self.totalPages)
					self.wrapper
						.find(".sd-notes-prev")
						.prop("disabled", self.currentPage <= 1)
					self.wrapper
						.find(".sd-notes-next")
						.prop("disabled", self.currentPage >= self.totalPages)

					data.notes.forEach((note) => {
						list.append(self.renderNoteRow(note))
					})
				})
				.catch((err) => {
					console.error("Notes load error:", err)
					list.html(
						'<tr><td class="error-text" colspan="6">Error loading notes.</td></tr>',
					)
				})
		}

		saveNote() {
			const self = this
			const modal = this.modal
			const isCode = modal.find(".sd-note-is-code").is(":checked")
			const title = modal.find(".sd-note-title").val().trim()
			const content = modal.find(".sd-note-content").val().trim()

			let codeContent = ""
			if (isCode) {
				if (this.editor && this.editor.codemirror) {
					codeContent = this.editor.codemirror.getValue()
				} else {
					codeContent = modal.find(".sd-note-code-content").val()
				}
			}
			const id = modal.find(".sd-note-id").val()
			const btn = modal.find(".sd-note-save")
			const spinner = modal.find(".spinner")

			if (!title && !content && (!isCode || !codeContent.trim())) {
				alert("Please enter a title or content.")
				return
			}

			btn.prop("disabled", true)
			spinner.addClass("is-active")

			let finalExcerpt = modal.find(".sd-note-excerpt").val()
			let finalContext = modal.find(".sd-note-context").val()
			if (modal.find(".sd-note-capture").is(":checked")) {
				finalContext = window.location.href.split("#")[0]
			}

			this.postAction("sd_save_note", {
				id: id,
				title: title,
				content: content,
				excerpt: finalExcerpt,
				context: finalContext,
				code_content: codeContent,
				is_code: isCode ? 1 : 0,
				scope: modal.find(".sd-note-is-projected").is(":checked")
					? "pinned"
					: "private",
				is_sticky: this.wrapper
					.find(".sd-note-item[data-id='" + id + "']")
					.find(".sd-note-pin-btn")
					.hasClass("active")
					? 1
					: 0,
				sticky_level:
					modal.find("input[name='sd_note_level']:checked").val() ||
					"low",
				workspace_id:
					localStorage.getItem("sd_active_workspace") ||
					window.sd_vars?.active_workspace ||
					"",
				workspace_name:
					typeof sd_vars !== "undefined" && sd_vars.active_workspace_title
						? sd_vars.active_workspace_title
						: $("#sd-workspace-title").length
						? $("#sd-workspace-title").text().trim()
						: document.title
								.split("‹")[0]
								.trim()
								.replace(" - WordPress", "")
								.trim() || "Admin",
			})
				.then(() => {
					self.loadNotes()
					self.resetForm()
					modal.hide()
					document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
				})
				.catch((err) => {
					alert("Error saving note: " + err)
				})
				.finally(() => {
					btn.prop("disabled", false)
					spinner.removeClass("is-active")
				})
		}

		editNote(row) {
			const id = row.data("id")
			const title =
				row.data("full-title") || row.find(".row-title").text()
			const content = row.find(".note-content-hidden").html()
			const codeContent = row.find(".note-code-hidden").text()
			const excerpt = row.data("excerpt")
			const context = row.data("context") || ""
			const isCode = row.data("is-code") ? true : false

			this.modal.find(".sd-note-id").val(id)
			this.modal.find(".sd-note-title").val(title)

			const decodedContent = this.decodeHtml(content)
			this.modal.find(".sd-note-content").val(decodedContent)
			this.modal.find(".sd-note-code-content").val(codeContent)
			if (this.editor && this.editor.codemirror) {
				this.editor.codemirror.setValue(codeContent)
			}

			this.modal.find(".sd-note-excerpt").val(excerpt)
			this.modal.find(".sd-note-context").val(context)
			this.modal.find(".sd-note-is-code").prop("checked", isCode)

			const scope = row.data("scope") || "private"
			const isProjected = scope === "pinned"
			this.modal
				.find(".sd-note-is-projected")
				.prop("checked", isProjected)
			this.modal.find(".sd-note-sticky-level-wrap").toggle(isProjected)
			const level = row.data("sticky-level") || "low"
			this.modal
				.find("input[name='sd_note_level'][value='" + level + "']")
				.prop("checked", true)
			this.updateEditPriorityBadge()

			this.toggleEditorMode()

			const linkBtn = this.modal.find(".sd-note-visit-link")
			if (
				excerpt &&
				(excerpt.startsWith("http") || excerpt.startsWith("//"))
			) {
				linkBtn.attr("href", excerpt).css("display", "inline-flex")
			} else {
				linkBtn.hide()
			}

			this.modal.find(".sd-note-delete").show().data("id", id)
			this.modal.find(".sd-note-save").text("Update Note")

			this.wrapper.find(".sd-note-item").removeClass("active-edit")
			row.addClass("active-edit")

			this.modal.find(".sd-note-edit-modal-heading").text("Edit Note")
			this.modal.show()
		}

		deleteNote(id) {
			const self = this
			this.postAction("sd_delete_note", { id: id })
				.then(() => {
					self.loadNotes()
					self.resetForm()
					self.modal.hide()
					document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
				})
				.catch((err) => {
					alert("Error deleting note: " + err)
				})
		}

		toggleSticky(id) {
			const self = this
			const row = this.wrapper.find(".sd-note-item[data-id='" + id + "']")
			const icon = row.find(".sd-note-pin-btn")
			icon.toggleClass("active")
			this.postAction("sd_toggle_note_sticky", { note_id: id })
				.then(() => {
					self.loadNotes()
				})
				.catch(() => {
					icon.toggleClass("active")
				})
		}

		toggleEditorMode() {
			const modal = this.modal
			const isCode = modal.find(".sd-note-is-code").is(":checked")
			modal.find(".sd-note-content-wrapper").show()
			modal.find(".sd-note-code-wrapper").toggle(isCode)

			if (isCode && typeof wp !== "undefined" && wp.codeEditor) {
				if (!this.editor) {
					const settings = $.extend(
						true,
						{},
						wp.codeEditor.defaultSettings || {},
						{
							codemirror: {
								mode: "application/x-httpd-php",
								lineNumbers: true,
								indentUnit: 4,
							},
						},
					)
					this.editor = wp.codeEditor.initialize(
						modal.find(".sd-note-code-content")[0],
						settings,
					)
				}
				setTimeout(() => this.editor.codemirror.refresh(), 50)
			}
		}

		resetForm() {
			this.modal.find(".sd-note-id").val("")
			this.modal.find(".sd-note-title").val("")
			this.modal.find(".sd-note-content").val("")
			this.modal.find(".sd-note-excerpt").val("")
			this.modal.find(".sd-note-context").val("")
			this.modal.find(".sd-note-code-content").val("")
			if (this.editor && this.editor.codemirror) {
				this.editor.codemirror.setValue("")
			}
			this.modal.find(".sd-note-is-code").prop("checked", false)
			this.modal.find(".sd-note-is-projected").prop("checked", false)
			this.modal.find(".sd-note-sticky-level-wrap").hide()
			this.modal
				.find("input[name='sd_note_level'][value='low']")
				.prop("checked", true)
			this.modal.find(".sd-note-delete").hide()
			this.modal.find(".sd-note-save").text("Save Note")
			this.modal.find(".sd-note-visit-link").hide()
			this.modal.find(".sd-note-item").removeClass("active-edit")
			this.toggleEditorMode()
		}

		filterNotes(val) {
			const query = val.toLowerCase()
			this.wrapper.find(".sd-note-item").each(function () {
				const title = $(this).find(".row-title").text().toLowerCase()
				const content = $(this)
					.find(".note-content-hidden")
					.text()
					.toLowerCase()
				$(this).toggle(title.includes(query) || content.includes(query))
			})
		}

		decodeHtml(html) {
			const txt = document.createElement("textarea")
			txt.innerHTML = html
			return txt.value
		}
	}

	// Initialize all widget instances
	function initWidgets() {
		$(".sd-notes-widget").each(function () {
			const el = $(this)
			if (!el.data("sd-notes-instance")) {
				el.data("sd-notes-instance", new SystemDeckNoteInstance(this))
			}
		})
	}

	$(document).ready(function () {
		initWidgets()
		$(document).on("sd_workspace_rendered", initWidgets)
		// Also check every second for late-loading widgets
		setInterval(initWidgets, 1000)
	})
})(jQuery)
