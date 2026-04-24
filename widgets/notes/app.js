/**
 * SystemDeck Notes Widget
 * Handles note creation, saving, pinning, and list management.
 */
;(function ($) {
	"use strict"

	function getNonce() {
		return window.SystemDeckSecurity?.nonce || window.sd_vars?.nonce || ""
	}

	const NotesWidget = {
		interval: null,
		getStatusBadge: function (priority) {
			const map = {
				urgent: { label: "Urgent", class: "is-urgent" },
				high: { label: "High", class: "is-high" },
				moderate: { label: "Moderate", class: "is-moderate" },
				low: { label: "Low", class: "is-low" },
			}

			const config = map[priority] || null
			if (!config) return ""

			return `<span class="sd-status-badge ${config.class}">${config.label}</span>`
		},
		init: function () {
			// Stop any previous search
			if (this.interval) clearInterval(this.interval)

			const self = this
			this.interval = setInterval(function () {
				$(".sd-notes-widget, #sd-notes-widget").each(function() {
				    const el = $(this);
				    if (!el.data("sd-init")) {
					    el.data("sd-init", true)
					    self.wrapper = el
					    self.bindEvents()
					    self.setupExternalEvents()

					    // Let workspace load first
					    setTimeout(() => {
						    self.loadNotes()
					    }, 100)
					}
				});
			}, 1000)
		},

		setupExternalEvents: function () {
			const self = this
			document.addEventListener("systemdeck:open-note", function (e) {
				const { noteId, mode } = e.detail
				if (mode === "read") {
					self.openReadModal(noteId)
				}
			})
		},

		editor: null, // CodeMirror instance
		
		currentPage: 1,
		totalPages: 1,

		bindEvents: function () {
			const self = this
			const wrapper = this.wrapper
			const modal = $("#sd-note-edit-modal")
			const readModal = $("#sd-note-read-modal")

			// Scoped Event Triggers (Priority Task 7)

			// Search input filter
			wrapper.on("keyup.sdNotesSearch", "#sd-notes-search", function () {
				self.filterNotes($(this).val())
			})

			// Add Note button opens form
			wrapper.on("click.sdNotesAdd", "#sd-note-new", function () {
				self.resetForm()
				$("#sd-note-edit-modal-heading").text("New Note")
				modal.show()
				
				if ($("#sd-note-capture").is(":checked")) {
					self.injectCaptureData()
				}
			})

			// Save Note
			modal.on("click.sdNotesSave", "#sd-note-save", function () {
				self.saveNote()
			})

			// Edit Note — constrained to .sd-action-edit link only
			wrapper.on("click.sdNotesEdit", ".sd-note-item .sd-action-edit", function (e) {
				e.preventDefault();
				e.stopPropagation();
				const row = $(this).closest(".sd-note-item");
				const isAuthor = row.data("is-author") == "1";
				if (!isAuthor && row.data("scope") === "pinned") {
					self.openReadModal(row.data("id"));
				} else {
					self.editNote(row);
				}
			})

			// View Note — constrained to .sd-action-view and comments column
			wrapper.on("click.sdNotesView", ".sd-note-item .sd-action-view, .sd-note-item .column-comments a, .sd-note-item .post-com-count", function (e) {
				e.preventDefault();
				e.stopPropagation();
				self.openReadModal($(this).closest(".sd-note-item").data("id"));
			})

			// Sticky toggle — column icon = sticky ordering only, not workspace projection
			wrapper.on("click.sdNotesSticky", ".sd-note-item .sd-note-pin-btn", function (e) {
				e.preventDefault();
				e.stopPropagation();
				self.toggleSticky($(this).closest(".sd-note-item").data("id"));
			})

			// Delete Note
			modal.on("click.sdNotesDel", "#sd-note-delete", function () {
				if (confirm("Are you sure you want to delete this note?")) {
					self.deleteNote($(this).data("id"))
				}
			})


			// Pagination
			wrapper.on("click.sdNotes", "#sd-notes-prev", function(e) {
				e.preventDefault();
				if (self.currentPage > 1) {
					self.currentPage--;
					self.loadNotes();
				}
			});

			wrapper.on("click.sdNotes", "#sd-notes-next", function(e) {
				e.preventDefault();
				if (self.currentPage < self.totalPages) {
					self.currentPage++;
					self.loadNotes();
				}
			});
			
			// Capture Toggle
			wrapper.on("change.sdNotes", "#sd-note-capture", function () {
				if ($(this).is(":checked")) {
					self.injectCaptureData()
				}
			})

			// Code Snippet Toggle
			wrapper.on("change.sdNotes", "#sd-note-is-code", function () {
				self.toggleEditorMode()
			})

			// Read mode toggle (Generic links)
			wrapper.on("click.sdNotesRead", ".sd-read-note", function (e) {
				if ($(e.target).closest(".dashicons").length && !$(e.target).hasClass("dashicons-welcome-view-site")) return
				e.preventDefault()
				const id = $(this).data("id")
				self.openReadModal(id)
			})

			// Context Filter
			wrapper.on("click.sdNotes", "#sd-note-context-filter", function () {
					$(this).toggleClass("active")
					self.loadNotes()
			})

			// Sticky Toggle reveal
			modal.on("change.sdNotesProjected", "#sd-note-is-projected", function () {
				$("#sd-note-sticky-level-wrap").toggle($(this).is(":checked"))
				self.updateEditPriorityBadge()
			})

			modal.on("change.sdNotesPriority", "input[name='sd_note_level']", function () {
				self.updateEditPriorityBadge()
			})

			// Save Comment
			readModal.on("click", "#sd-note-save-comment", function () {
				const noteId = readModal.data("note-id")
				self.saveComment(noteId)
			})

			// Reply to Comment
			readModal.on("click", ".sd-reply-btn", function (e) {
				e.preventDefault();
				const parentId = $(this).data("id");
				$("#sd-note-parent-comment").val(parentId);
				$("#sd-note-new-comment").attr("placeholder", "Replying to thread...").focus();
			})

			// Modal close — delegated from [data-closes] attribute (replaces inline onclick)
			$(document).on("click.sdModalClose", ".sd-modal-close[data-closes]", function () {
				$("#" + $(this).data("closes")).hide()
			})

			// Click-outside-to-close on overlay
			$(document).on("click.sdModalOverlay", ".sd-modal-overlay", function (e) {
				if ($(e.target).is(".sd-modal-overlay")) {
					$(this).hide()
				}
			})
		},

		openReadModal: function (noteId) {
			const self = this
			const modal = $("#sd-note-read-modal")
			modal.data("note-id", noteId).show()

			$("#sd-note-read-title").text("Loading...")
			$("#sd-note-read-content").html('<span class="spinner is-active"></span>')
			$("#sd-note-read-visit-url").hide()
			$("#sd-note-comments-list").empty()
            $("#sd-note-parent-comment").val("0")
            $("#sd-note-new-comment").attr("placeholder", "Write a comment...").val("")

			$.post(
				window.sd_vars?.ajaxurl || window.ajaxurl,
				{
					action: "sd_get_read_note",
                    id: noteId,
					nonce: getNonce(),
				},
				function (res) {
					// Ensure we're still viewing the same note (Priority Task 8)
					if ($("#sd-note-read-modal").data("note-id") !== noteId) return;

					if (res.success && res.data.note) {
						const note = res.data.note;
						
						$("#sd-note-read-title").text(note.title)
						let displayContent = note.content;
						if (note.is_code && note.code_content) {
							const safeCode = (note.code_content || "")
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")
							
							displayContent += `
								<div class="sd-view-code-block">
									<div class="description sd-code-label">SOURCE CODE</div>
									<div class="sd-note-form">
										<textarea id="sd-note-view-code-content" class="sd-hidden">${safeCode}</textarea>
									</div>
								</div>
							`;
						}
						
						$("#sd-note-read-content").html(displayContent)
                        
                        if (note.is_code && note.code_content && typeof wp !== "undefined" && wp.codeEditor) {
                            const settings = $.extend(true, {}, wp.codeEditor.defaultSettings || {}, {
                                codemirror: {
                                    mode: "application/x-httpd-php",
                                    lineNumbers: true,
                                    indentUnit: 4,
                                    readOnly: "nocursor",
                                },
                            })
                            const viewEditor = wp.codeEditor.initialize(
                                "sd-note-view-code-content",
                                settings,
                            )
                            setTimeout(() => viewEditor.codemirror.refresh(), 50)
                        }

						$("#sd-note-read-author").text("By " + note.author_name)
						$("#sd-note-read-date").text(note.date)
						
						// Urgency Badge
						const badgeHTML = self.getStatusBadge(note.sticky_level || "low")
						const newBadge = $(badgeHTML || '<span class="sd-status-badge"></span>').attr("id", "sd-note-read-urgency")
						$("#sd-note-read-urgency").replaceWith(newBadge)

						// Visit URL link — show beneath content if a URL was captured
						const readCtx = note.context || '';
						const $visitBar = $("#sd-note-read-visit-url");
						if (readCtx && (readCtx.startsWith('http') || readCtx.startsWith('//'))) {
							$visitBar.attr('href', readCtx).show();
						} else {
							$visitBar.removeAttr('href').hide();
						}

						// Lock/Unlock commenting
						if (note.can_comment) {
							$("#sd-note-comment-form-container").show();
						} else {
							$("#sd-note-comment-form-container").hide();
						}

						self.loadComments(noteId)
					} else {
						// Error states (Priority Task 8)
						const msg = res.data?.error || "This note may have been deleted or moved.";
						$("#sd-note-read-title").text("Access Denied")
						$("#sd-note-read-content").html(`<p class="sd-error-text">${msg}</p>`)
					}
				}
			)
		},

		updateEditPriorityBadge: function () {
			const badge = $("#sd-note-edit-urgency")
			const isProjected = $("#sd-note-is-projected").is(":checked")
			const level = String($("input[name='sd_note_level']:checked").val() || "low").toLowerCase()
			const allowed = ["urgent", "high", "moderate", "low"]
			const safeLevel = allowed.includes(level) ? level : "low"

			if (!isProjected) {
				badge.replaceWith('<span id="sd-note-edit-urgency"></span>')
				return
			}

			const badgeHTML = this.getStatusBadge(safeLevel)
			const newBadge = $(badgeHTML || '<span class="sd-status-badge"></span>').attr("id", "sd-note-edit-urgency")
			badge.replaceWith(newBadge)
		},

		renderCommentHTML: function(comment, isReply = false) {
			const wrapperClass = isReply ? "dashboard-comment-wrap sd-note-comment-thread sd-note-reply" : "dashboard-comment-wrap sd-note-comment-thread";
			const replyBtn = isReply ? "" : `<button class="button-link sd-reply-btn" data-id="${comment.id}">Reply</button>`;
			
			let repliesHtml = "";
			if (comment.replies && comment.replies.length > 0) {
				repliesHtml += '<div class="sd-note-comment-replies">';
				comment.replies.forEach(reply => {
					repliesHtml += this.renderCommentHTML(reply, true);
				});
				repliesHtml += '</div>';
			}

			return `
				<div class="${wrapperClass}">
					<div class="comment-meta">
						<img class="avatar" src="${comment.avatar}" alt="${comment.author}" width="24" height="24">
						<cite>${comment.author}</cite>
						<span class="sd-note-comment-date">${comment.date}</span>
						${replyBtn}
					</div>
					<div class="sd-note-comment-content">${comment.content}</div>
					${repliesHtml}
				</div>
			`;
		},

		loadComments: function (noteId) {
			const self = this;
			const list = $("#sd-note-comments-list")
			list.html('<span class="spinner is-active"></span>')

			$.post(window.sd_vars?.ajaxurl || window.ajaxurl, {
				action: "sd_get_note_comments",
				note_id: noteId,
				nonce: getNonce()
			}, function (res) {
				if (res.success) {
					list.empty()
					if (!res.data.comments || res.data.comments.length === 0) {
						list.append('<div class="sd-empty-state">No discussion yet.</div>')
						return
					}

					res.data.comments.forEach(comment => {
						list.append(self.renderCommentHTML(comment));
					})
				}
			})
		},

		saveComment: function (noteId) {
			const self = this
			const content = $("#sd-note-new-comment").val().trim()
            const parentId = $("#sd-note-parent-comment").val() || 0
			if (!content) return

			$("#sd-note-save-comment").prop("disabled", true)

			$.post(window.sd_vars?.ajaxurl || window.ajaxurl, {
				action: "sd_add_note_comment",
				note_id: noteId,
				content: content,
                parent_id: parentId,
				nonce: getNonce()
			}, function (res) {
				$("#sd-note-save-comment").prop("disabled", false)
				if (res.success) {
					$("#sd-note-new-comment").val("")
                    $("#sd-note-parent-comment").val("0")
                    $("#sd-note-new-comment").attr("placeholder", "Write a comment...")
					self.loadComments(noteId)
				} else {
					alert("Failed to post comment: " + (res.data?.error || "Unknown error"))
				}
			})
		},

		openViewAll: function () {
			const self = this
			const drawer = $("#sd-note-view-all-drawer")
			const list = $("#sd-notes-all-list")
			drawer.addClass("open")
			list.html('<li class="loading-text">Loading all notes...</li>')

			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.sd_vars?.ajax_url ||
					window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_get_all_notes",
					nonce: getNonce(),
				},
				function (res) {
					if (res.success) {
						list.empty()
						if (!res.data.notes || res.data.notes.length === 0) {
							list.html(
								'<li class="empty-text">No notes found.</li>',
							)
							return
						}

						res.data.notes.forEach((note) => {
							const safeCode = (note.code_content || "")
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")

							const taskHtml = self.renderTaskContent(
								note.content,
							)
							const previewHtml = taskHtml
								? taskHtml
								: $("<div>")
										.html(note.content)
										.text()
										.substring(0, 50) + "..."

							const html = `
                            <li class="sd-note-item" data-id="${
								note.id
							}" data-is-author="${
                                note.is_author ? 1 : 0
                            }" data-excerpt="${
								note.excerpt || ""
							}" data-is-code="${
								note.is_code ? 1 : 0
							}" data-context="${note.context || ""}" data-scope="${
								note.scope || "private"
							}" data-sticky-level="${
								note.sticky_level || "low"
							}" data-workspace-id="${note.workspace_id || ""}">
                                <div class="sd-note-list-row">
                                    <span class="note-title">${note.title}</span>
                                    <span class="note-meta">${note.date}</span>
                                    <div class="note-preview">
                                        ${previewHtml}
                                    </div>
                                </div>
                                <div class="note-content-hidden sd-hidden">${
									note.content
								}</div>
                                <div class="note-code-hidden sd-hidden">${safeCode}</div>
                            </li>
                        `
							list.append(html)
						})
					} else {
						list.html(
							'<li class="error-text">Error loading notes.</li>',
						)
					}
				},
			)
		},

		injectCaptureData: function () {
			const titleInput = $("#sd-note-title")

			// Auto Title
			if (!titleInput.val()) {
				titleInput.val(document.title)
			}
		},

		loadNotes: function () {
			const self = this
			if (!this.wrapper) return;
			const list = this.wrapper.find("#sd-notes-list")
			const table = this.wrapper.find("#sd-notes-table")
			const pagination = this.wrapper.find("#sd-notes-pagination")
			const emptyState = this.wrapper.find("#sd-notes-empty-state")
			table.hide()
			pagination.hide()
			emptyState.css({ display: "block", visibility: "hidden" })
			list.html('<tr><td colspan="4" class="sd-loading-td">Loading...</td></tr>');

			const filterActive = $("#sd-note-context-filter").hasClass("active")
			const context = filterActive ? window.location.href.split('#')[0] : ""

			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.sd_vars?.ajax_url ||
					window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_get_notes",
					limit: 5,
					paged: this.currentPage,
					context: context,
					nonce: getNonce(),
				},
				function (res) {
					if (res.success) {
						list.empty()
						if (!res.data.notes || res.data.notes.length === 0) {
							table.hide()
							pagination.hide()
							emptyState.css({ display: "block", visibility: "visible" })
							$("#sd-notes-total-count").text("0 items");
							$("#sd-notes-current-page").text("1");
							$("#sd-notes-total-pages").text("1");
							$("#sd-notes-prev, #sd-notes-next").prop("disabled", true);
							return;
						}

						table.show()
						pagination.css("display", "flex")
						emptyState.css({ display: "none", visibility: "hidden" })
						self.totalPages = parseInt(res.data.max_pages) || 1;
						$("#sd-notes-total-count").text((res.data.total || 0) + " items");
						$("#sd-notes-current-page").text(self.currentPage);
						$("#sd-notes-total-pages").text(self.totalPages);
						$("#sd-notes-prev").prop("disabled", self.currentPage <= 1);
						$("#sd-notes-next").prop("disabled", self.currentPage >= self.totalPages);

						res.data.notes.forEach((note) => {
							const safeCode = (note.code_content || "")
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")

							const safeExcerpt = (note.excerpt || "").replace(/"/g, '&quot;')
							const safeContext = (note.context || "").replace(/"/g, '&quot;')

							// Workspace column: origin (historical) + active pin state — max 2 lines
							// origin_workspace_name = write-once, where note was created
							// workspace_name = active pinned destination (only when scope=pinned)
							const originName = note.origin_workspace_name || '';
							const pinnedName = note.scope === 'pinned' ? (note.workspace_name || note.workspace_title || '') : '';
							const isProjected = note.scope === 'pinned';
							let scopeLabel = '';
							// Line 1: origin — em-dash when unknown
							scopeLabel += `<span class="sd-note-workspace-origin">${originName || '&mdash;'}</span><br/>`;
							// Line 2: active state — Pinned WorkspaceName | priority (pipe delimited, no label)
							if (isProjected) {
								const projectedDisplay = pinnedName ? ` ${pinnedName}` : '';
								const badgeHTML = self.getStatusBadge(note.sticky_level || 'low');
								scopeLabel += `<strong class="sd-note-workspace-pinned">Pinned${projectedDisplay}</strong> <span class="sd-note-pipe">|</span> ${badgeHTML}`;
							} else {
								scopeLabel += `<span class="sd-note-workspace-private">Private</span>`;
							}

                            const dateHtml = note.is_modified && note.modified ? `<span class="sd-note-date-label">Last Modified</span><br>${note.modified}` : `<span class="sd-note-date-label">Published</span><br>${note.date}`;

                            const codeBadge = note.is_code ? `<span class="sd-note-code-badge">| Code <span class="dashicons dashicons-editor-code"></span></span>` : '';
                            
                            // Row actions
                            const rowActions = `
                                <div class="row-actions">
                                    <span class="edit"><a href="#" class="sd-action-edit">Edit</a> | </span>
                                    <span class="view"><a href="#" class="sd-action-view">View</a>${codeBadge}</span>
                                </div>
                            `;

                            const commentHtml = note.comment_count > 0 
                                ? `<div class="post-com-count-wrapper"><a href="#" class="post-com-count" title="View Comments"><span class="comment-count-approved">${note.comment_count}</span><span class="screen-reader-text">Comments</span></a></div>` 
                                : `<span title="No Comments" class="sd-no-comments">&mdash;</span>`;

                            const contextHtml = safeContext ? `<a href="${safeContext}" target="_blank" class="sd-note-context-link">${safeContext}</a>` : `<span class="sd-note-no-context">&mdash;</span>`;

							const html = `
                            <tr class="sd-note-item" data-id="${note.id}" data-is-author="${
                                note.is_author ? 1 : 0
                            }" data-excerpt="${safeExcerpt}" data-is-code="${
								note.is_code ? 1 : 0
							}" data-context="${safeContext}" data-scope="${
								note.scope || "private"
							}" data-sticky-level="${
								note.sticky_level || "low"
							}" data-workspace-id="${note.workspace_id || ""}" data-full-title="${(note.full_title || note.title).replace(/"/g, '&quot;')}">
                                <th scope="row" class="check-column" data-colname="Pin">
                                    <span class="dashicons dashicons-admin-post sd-btn-icon sd-note-pin-btn ${note.is_sticky ? 'active' : ''}" title="Toggle sticky ordering"></span>
                                </th>
                                <td class="title column-title has-row-actions column-primary" data-colname="Title">
                                    <strong><a class="row-title" href="#">${note.title}</a></strong>
                                    ${rowActions}
                                    <button type="button" class="toggle-row"><span class="screen-reader-text">Show more details</span></button>
                                    <div class="note-content-hidden sd-hidden">${note.content}</div>
                                    <div class="note-code-hidden sd-hidden">${safeCode}</div>
                                </td>
                                <td data-colname="Workspace">${scopeLabel}</td>
                                <td data-colname="URL Context">${contextHtml}</td>
                                <td class="column-comments" data-colname="Comments">
                                    ${commentHtml}
                                </td>
                                <td class="date column-date" data-colname="Date">${dateHtml}</td>
                            </tr>
                        `
							list.append(html)
						})
					} else {
						list.html('<tr><td class="error-text" colspan="6">Error loading notes.</td></tr>')
					}
				},
			)
		},

		saveNote: function () {
			const self = this
			const isCode = $("#sd-note-is-code").is(":checked")
			const title = $("#sd-note-title").val().trim()
			const content = $("#sd-note-content").val().trim()

			let codeContent = ""
			if (isCode) {
				if (this.editor && this.editor.codemirror) {
					codeContent = this.editor.codemirror.getValue()
				} else {
					codeContent = $("#sd-note-code-content").val()
				}
			}
			const id = $("#sd-note-id").val()
			const btn = $("#sd-note-save")
			const spinner = $(".spinner", "#sd-note-form-container")

			if (!title && !content && (!isCode || !codeContent.trim())) {
				alert("Please enter a title or content.")
				return
			}

			btn.prop("disabled", true)
			spinner.addClass("is-active")

			let finalExcerpt = $("#sd-note-excerpt").val()
            let finalContext = $("#sd-note-context").val()
			if ($("#sd-note-capture").is(":checked")) {
				finalContext = window.location.href.split('#')[0]
			}

			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.sd_vars?.ajax_url ||
					window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_save_note",
					id: id,
					title: title,
					content: content,
					excerpt: finalExcerpt,
                    context: finalContext,
					code_content: codeContent,
					is_code: $("#sd-note-is-code").is(":checked") ? 1 : 0,
					// scope: pinned = workspace projection; private = no projection
					scope: $("#sd-note-is-projected").is(":checked") ? "pinned" : "private",
					// is_sticky: list ordering only. 
					// We read the current state from the active row if it exists, otherwise default 0.
					is_sticky: ($(".sd-note-item[data-id='" + id + "']").find(".sd-note-pin-btn").hasClass("active") ? 1 : 0),					sticky_level: $("input[name='sd_note_level']:checked").val() || "low",
					workspace_id: localStorage.getItem("sd_active_workspace") || window.sd_vars?.active_workspace || "default",
					workspace_name: typeof sd_vars !== 'undefined' && sd_vars.active_workspace_title ? sd_vars.active_workspace_title : ($("#sd-workspace-title").length ? $("#sd-workspace-title").text().trim() : document.title.split('‹')[0].trim().replace(" - WordPress", "").trim() || "Admin"),
					nonce: getNonce(),
				},

				function (res) {
					btn.prop("disabled", false)
					spinner.removeClass("is-active")

					if (res.success) {
						self.loadNotes()
						self.resetForm()
						$("#sd-note-edit-modal").hide()
						// Instant Refresh for Grid Pins
						document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
					} else {
						alert(
							"Error saving note: " +
								(res.data.error || "Unknown"),
						)
					}
				},
			)
		},

		editNote: function (row) {
			const id = row.data("id")
			const title = row.data("full-title") || row.find(".row-title").text()
			const content = row.find(".note-content-hidden").html()
			const codeContent = row.find(".note-code-hidden").text()
			const excerpt = row.data("excerpt")
            const context = row.data("context") || ""
			const isCode = row.data("is-code") ? true : false

			$("#sd-note-id").val(id)
			$("#sd-note-title").val(title)

			const decodedContent = this.decodeHtml(content)
			$("#sd-note-content").val(decodedContent)
			$("#sd-note-code-content").val(codeContent)
			if (this.editor && this.editor.codemirror) {
				this.editor.codemirror.setValue(codeContent)
			}

			$("#sd-note-excerpt").val(excerpt)
            $("#sd-note-context").val(context)
			$("#sd-note-is-code").prop("checked", isCode)

			const scope = row.data("scope") || "private"
			const isProjected = scope === "pinned"
			$("#sd-note-is-projected").prop("checked", isProjected)
			$("#sd-note-sticky-level-wrap").toggle(isProjected)
			const level = row.data("sticky-level") || "low"
			$("input[name='sd_note_level'][value='" + level + "']").prop("checked", true)
			this.updateEditPriorityBadge()

			this.toggleEditorMode()

			const linkBtn = $("#sd-note-visit-link")
			if (
				excerpt &&
				(excerpt.startsWith("http") || excerpt.startsWith("//"))
			) {
				linkBtn.attr("href", excerpt).css("display", "inline-flex")
			} else {
				linkBtn.hide()
			}

			$("#sd-note-delete").show().data("id", id)
			$("#sd-note-save").text("Update Note")

			$(".sd-note-item").removeClass("active-edit")
			row.addClass("active-edit")
			
			$("#sd-note-edit-modal-heading").text("Edit Note")
			$("#sd-note-edit-modal").show()
		},

		deleteNote: function (id) {
			const self = this
			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.sd_vars?.ajax_url ||
					window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_delete_note",
					id: id,
					nonce: getNonce(),
				},
				function (res) {
					if (res.success) {
						self.loadNotes()
						self.resetForm()
						$("#sd-note-edit-modal").hide()
						// Instant Refresh for Grid Pins
						document.dispatchEvent(new CustomEvent("systemdeck:refresh-pins"))
					}
				},
			)
		},

		toggleSticky: function (id) {
			const self = this
			const $row = $(".sd-note-item[data-id='" + id + "']")
			const $icon = $row.find(".sd-note-pin-btn")
			// Optimistic toggle
			$icon.toggleClass("active")
			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_toggle_note_sticky",
					note_id: id,
					nonce: getNonce(),
				},
				function (res) {
					if (res.success) {
						// Reload to re-sort sticky notes to top
						self.loadNotes()
					} else {
						// Revert optimistic toggle on failure
						$icon.toggleClass("active")
					}
				},
			)
		},

		toggleEditorMode: function () {
			const isProjected = $("#sd-note-is-projected").is(":checked")
			const levelWrap = $("#sd-note-sticky-level-wrap")
			if (!isProjected) {
				levelWrap.hide()
			} else {
				levelWrap.show()
			}
			const isCode = $("#sd-note-is-code").is(":checked")
			const textWrap = $("#sd-note-content-wrapper")
			const codeWrap = $("#sd-note-code-wrapper")

			if (isCode) {
				textWrap.show()
				codeWrap.slideDown(200)
				this.initEditor()
				if (this.editor && this.editor.codemirror) {
					setTimeout(() => this.editor.codemirror.refresh(), 50)
				}
			} else {
				codeWrap.slideUp(200)
			}
		},

		initEditor: function () {
			if (this.editor) return
			if (typeof wp !== "undefined" && wp.codeEditor) {
				const settings = $.extend(true, {}, wp.codeEditor.defaultSettings || {}, {
					codemirror: {
						mode: "application/x-httpd-php",
						lineNumbers: true,
						indentUnit: 4,
					},
				})
				this.editor = wp.codeEditor.initialize(
					"sd-note-code-content",
					settings,
				)
			}
		},

		resetForm: function () {
			$("#sd-note-id").val("")
			$("#sd-note-title").val("")
			$("#sd-note-content").val("")
			$("#sd-note-excerpt").val("")
            $("#sd-note-context").val("")
			$("#sd-note-visit-link").hide()
			$("#sd-note-delete").hide()
			$("#sd-note-save").text("Save Note")
			$(".sd-note-item").removeClass("active-edit")
			$("#sd-note-capture").prop("checked", false)
			$("#sd-note-is-code").prop("checked", false)

			$("#sd-note-content-wrapper").show()
			$("#sd-note-code-wrapper").hide()
			if (this.editor && this.editor.codemirror) {
				this.editor.codemirror.setValue("")
			}
			$("#sd-note-code-content").val("")

			$("#sd-note-is-projected").prop("checked", false)
			$("#sd-note-sticky-level-wrap").hide()
			$("#sd-note-edit-urgency").hide().text("").removeClass("urgent high moderate low")
			$("input[name='sd_note_level'][value='low']").prop("checked", true)
		},

		decodeHtml: function (html) {
			var txt = document.createElement("textarea")
			txt.innerHTML = html
			return txt.value
		},

		renderTaskContent: function (content) {
			if (!content || !content.match(/\[(\s|x|X)\]/)) return null

			let index = 0
			const html = content.replace(/\[(\s|x|X)\]/g, function (match) {
				const isChecked = match.toLowerCase().indexOf("x") !== -1
				const cb = `<input type="checkbox" class="sd-todo-checkbox" data-task-index="${index}" ${
					isChecked ? "checked" : ""
				}>`
				index++
				return cb
			})
			return `<div class="sd-todo-list">${html}</div>`
		},

		toggleTaskStatus: function (checkbox) {
			const noteItem = checkbox.closest(".sd-note-item")
			const id = noteItem.data("id")
            const isAuthor = noteItem.data("is-author") == "1"
            if (!isAuthor && noteItem.data("scope") === "pinned") {
                checkbox.prop("checked", !checkbox.is(":checked")) // Revert
                this.openReadModal(id) // Open read modal instead
                return
            }

			const index = checkbox.data("task-index")
			const isChecked = checkbox.is(":checked")

			let rawContent = noteItem.find(".note-content-hidden").html()
			let matchCount = 0

			const newContent = rawContent.replace(
				/\[(\s|x|X)\]/g,
				function (match) {
					if (matchCount === index) {
						matchCount++
						return isChecked ? "[x]" : "[ ]"
					}
					matchCount++
					return match
				},
			)

			noteItem.find(".note-content-hidden").html(newContent)

			$.post(
				window.SystemDeckSecurity?.ajaxurl ||
					window.sd_vars?.ajaxurl ||
					window.sd_vars?.ajax_url ||
					window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
					window.ajaxurl ||
					"/wp-admin/admin-ajax.php",
				{
					action: "sd_save_note",
					id: id,
					title: noteItem.find(".note-title").text(),
					content: this.decodeHtml(newContent),
					excerpt: noteItem.data("excerpt"),
					code_content: noteItem.find(".note-code-hidden").text(),
					is_code: noteItem.data("is-code") ? 1 : 0,
					context: noteItem.data("context") || "",
					scope: noteItem.data("scope") || "private",
					sticky_level: noteItem.data("sticky-level") || "low",
					workspace_id: noteItem.data("workspace-id") || "",
					nonce: getNonce(),
				},
			)
		},
	}

	$(document).ready(function () {
		NotesWidget.init()
		$(document).on("sd_workspace_rendered", function () {
			NotesWidget.init()
		})
	})
})(jQuery)
