/**
 * SystemDeck Vault Widget - Media Bridge
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/vault/media-bridge.js
 * @license GPL-2.0-or-later
 *
 * Injects porting capabilities directly into the native WordPress Media Library.
 */
jQuery(function ($) {
	"use strict"

	if (typeof wp === "undefined" || !wp.media) return
	
	// Bridge Playback Listener
	document.addEventListener("systemdeck:vault-play", (e) => {
		const { url, meta } = e.detail || {}
		if (window.SystemDeckPlayback) {
			window.SystemDeckPlayback.play(url, meta)
		}
	})

	const BRIDGE_BUTTON_ID = "sd-vault-import-btn"
	const BRIDGE_BUTTON_SELECTOR = `#${BRIDGE_BUTTON_ID}`
	let playbackStateBound = false

	function formatTime(seconds) {
		const value = Math.max(0, Number(seconds) || 0)
		const min = Math.floor(value / 60)
		const sec = Math.floor(value % 60)
		return `${min}:${String(sec).padStart(2, "0")}`
	}

	function renderModalPlayerSurfaceHTML({ id, url, title, type }) {
		const safeId = String(id || "")
		const safeUrl = String(url || "")
		const safeTitle = String(title || "Media Attachment")
		const isMidi = String(type || "") === "midi"
		return `
			<div class="sd-vault-modal-player-surface sd-vault-midi-player-bridge"
				data-track-id="${safeId}"
				data-track-url="${safeUrl}"
				data-track-title="${safeTitle}"
				data-track-type="${isMidi ? "midi" : "audio"}">
				<div class="sd-midi-bridge-visual">
					<span class="dashicons ${
						isMidi ? "dashicons-performance" : "dashicons-format-audio"
					}"></span>
					<div class="sd-midi-bridge-status">${
						isMidi ? "MIDI Ready" : "Audio Ready"
					}</div>
				</div>
				<div class="sd-midi-bridge-controls">
					<button type="button" class="button sd-midi-bridge-play" title="Play/Pause">
						<span class="dashicons dashicons-play"></span>
					</button>
					<button type="button" class="button sd-midi-bridge-stop" title="Stop">
						<span class="dashicons dashicons-media-stop"></span>
					</button>
					<div class="sd-midi-bridge-progress-wrap">
						<div class="sd-midi-bridge-progress-bar" style="width:0%"></div>
					</div>
					<div class="sd-midi-bridge-time">0:00 / 0:00</div>
				</div>
			</div>
		`
	}

	function bindPlayerSurfaceStateSync() {
		if (playbackStateBound) return
		playbackStateBound = true
		document.addEventListener("systemdeck:playback-state", function (e) {
			const state = e?.detail || {}
			$(".sd-vault-modal-player-surface").each(function () {
				const surface = $(this)
				const trackId = String(surface.data("trackId") || "")
				const activeId = String(state.nowPlaying?.id || state.id || "")
				const isCurrent = trackId && trackId === activeId
				const statusText = surface.find(".sd-midi-bridge-status")
				const playBtn = surface.find(".sd-midi-bridge-play .dashicons")
				if (!isCurrent) {
					const type = String(surface.data("trackType") || "")
					statusText.text(type === "midi" ? "MIDI Ready" : "Audio Ready")
					playBtn.attr("class", "dashicons dashicons-play")
					surface.find(".sd-midi-bridge-progress-bar").css("width", "0%")
					surface.find(".sd-midi-bridge-time").text("0:00 / 0:00")
					return
				}
				const status = String(state.status || "ready")
				statusText.text(status.charAt(0).toUpperCase() + status.slice(1))
				playBtn.attr(
					"class",
					status === "playing"
						? "dashicons dashicons-pause"
						: "dashicons dashicons-play",
				)
				const duration = Number(state.duration || 0)
				const currentTime = Number(state.currentTime || 0)
				const percent =
					duration > 0
						? Math.max(0, Math.min(100, (currentTime / duration) * 100))
						: 0
				surface.find(".sd-midi-bridge-progress-bar").css("width", `${percent}%`)
				surface
					.find(".sd-midi-bridge-time")
					.text(`${formatTime(currentTime)} / ${formatTime(duration)}`)
			})
		})
	}

	function getBridgeConfig() {
		return {
			ajaxurl:
				window.sd_vault_bridge?.ajaxurl ||
				window.sd_vars?.ajaxurl ||
				window.ajaxurl ||
				"/wp-admin/admin-ajax.php",
			nonce:
				window.sd_vault_bridge?.nonce ||
				window.SystemDeckSecurity?.nonce ||
				window.sd_vars?.nonce ||
				window.sd_vars?.vault_nonce ||
				"",
		}
	}

	function normalizeError(data) {
		if (data?.error) return String(data.error)
		if (data?.message) return String(data.message)
		if (typeof data === "string") return data
		return "Unknown error"
	}

	function getAttachmentIdFromDetailsView(view) {
		const modelId = Number(view?.model?.get?.("id") || 0)
		if (modelId > 0) return modelId

		const json = view?.model?.toJSON?.()
		const jsonId = Number(json?.id || 0)
		if (jsonId > 0) return jsonId

		return 0
	}

	function getAttachmentIdFromDom(root) {
		const scopedRoot = root && root.length ? root : $(document)

		const selected = scopedRoot
			.find(".attachment.selected, .attachment.details.selected")
			.first()
		const selectedId = Number(
			selected.data("id") || selected.attr("data-id") || 0,
		)
		if (selectedId > 0) return selectedId

		const details = scopedRoot
			.find(".attachment-details, .attachment-info")
			.first()
		const deleteHref = String(
			details.find(".delete-attachment").attr("href") || "",
		)
		const deleteMatch = deleteHref.match(/[?&]post=([0-9]+)/)
		if (deleteMatch && deleteMatch[1]) return Number(deleteMatch[1]) || 0

		const search = String(
			window.location.search || window.location.hash || "",
		)
		const itemMatch = search.match(/[?&#]item=([0-9]+)/)
		if (itemMatch && itemMatch[1]) return Number(itemMatch[1]) || 0

		return 0
	}

	function importAttachment(attachmentId, button, mode = "copy") {
		const id = Number(attachmentId || 0)
		if (!id) return

		const isPublish = mode === "publish"
		const confirmMsg = isPublish
			? "Publishing will move this file into Vault and DELETE it from the Media Library. Continue?"
			: "Copy this file into your private SystemDeck Vault?"

		if (!window.confirm(confirmMsg)) return

		const config = getBridgeConfig()
		const btn = $(button)
		const oldText = btn.text()

		const ajaxAction = isPublish
			? "sd_core_vault_ajax_publish_to_vault"
			: "sd_core_vault_ajax_copy_from_media_library"

		btn.prop("disabled", true).text(
			isPublish ? "Publishing..." : "Copying...",
		)

		$.post(
			config.ajaxurl,
			{
				action: ajaxAction,
				attachment_id: id,
				nonce: config.nonce,
				_ajax_nonce: config.nonce,
			},
			function (res) {
				btn.prop("disabled", false).text(oldText)

				if (res && res.success) {
					const successMsg = isPublish
						? "File successfully published to your SystemDeck Vault!"
						: "File successfully copied to your SystemDeck Vault!"
					window.alert(successMsg)
					document.dispatchEvent(
						new CustomEvent("systemdeck:vault-imported", {
							detail: {
								attachmentId: id,
								vaultFile: res.data || null,
							},
						}),
					)
					document.dispatchEvent(
						new CustomEvent("systemdeck:refresh-vault"),
					)
					return
				}

				window.alert("Action failed: " + normalizeError(res?.data))
			},
		).fail(function () {
			btn.prop("disabled", false).text(oldText)
			window.alert("Request failed.")
		})
	}

	function injectButtonIntoActions(actions, attachmentId) {
		if (!actions || !actions.length) return

		const id = Number(attachmentId || 0)
		if (!id) return

		// Idempotency: Don't re-inject if we are already there for this ID
		const existing = actions.find(".sd-vault-media-bridge-actions")
		if (existing.length && existing.data("id") === id) return

		existing.remove()
		actions.append(
			`<span class="sd-vault-media-bridge-actions" data-id="${id}"> | ` +
				`<button class="button-link sd-bridge-copy-btn" type="button" data-id="${id}" style="color:#135e96; text-decoration:none;">Copy to Vault</button>` +
				` | <button class="button-link sd-bridge-publish-btn" type="button" data-id="${id}" style="color:#d63638; text-decoration:none;">Publish to Vault</button>` +
				`</span>`,
		)
	}

	function injectIntoDetailsView(view) {
		const id = getAttachmentIdFromDetailsView(view)
		const model = view?.model
		if (!id || !$ || !model) return

		const $el = view.$el
		const sidebar = $el.find(".attachment-info").first()
		const mediaHost = $el.find(".attachment-media-view").first()
		if (!sidebar.length) return

		// Idempotency
		if (sidebar.find(`.sd-vault-native-extension[data-id="${id}"]`).length) return
		sidebar.find(".sd-vault-native-extension").remove()

		const mime = String(model.get("mime") || "").toLowerCase()
		const filename = String(model.get("filename") || "").toLowerCase()
		const isAudio = mime.startsWith("audio/") || filename.endsWith(".mp3") || filename.endsWith(".wav")
		const isMidi = mime.includes("midi") || filename.endsWith(".mid") || filename.endsWith(".midi")

		if (!isAudio && !isMidi) {
			if (mediaHost.length) {
				mediaHost.removeClass("sd-vault-has-systemdeck-player")
				mediaHost.find(".sd-vault-modal-player-surface").remove()
			}
			const actions = sidebar.find(".actions").first()
			injectButtonIntoActions(actions, id)
			return
		}
		if (mediaHost.length) {
			mediaHost.addClass("sd-vault-has-systemdeck-player")
			mediaHost.find(".sd-vault-modal-player-surface").remove()
			mediaHost.prepend(
				renderModalPlayerSurfaceHTML({
					id: id,
					url: model.get("url"),
					title: model.get("title") || filename,
					type: isMidi ? "midi" : "audio",
				}),
			)
			bindPlayerSurfaceStateSync()
		}

		// Build Extension Panel
		let html = `<div class="sd-vault-native-extension" data-id="${id}">`

		html += `
			<div class="sd-vault-extension-actions">
				<button type="button" class="button-link sd-bridge-copy-btn" data-id="${id}">Copy to Vault</button> | 
				<button type="button" class="button-link sd-bridge-publish-btn" data-id="${id}" style="color:#d63638;">Publish to Vault</button>
			</div>
		</div>`

		const settings = sidebar.find(".settings").first()
		if (settings.length) {
			settings.after(html)
		} else {
			sidebar.find(".actions").first().before(html)
		}
	}

	function patchDetailsView(ViewClass) {
		if (
			!ViewClass ||
			!ViewClass.prototype ||
			ViewClass.prototype.__sdVaultBridgePatched
		)
			return

		const originalRender = ViewClass.prototype.render
		if (typeof originalRender !== "function") return

		ViewClass.prototype.__sdVaultBridgePatched = true
		ViewClass.prototype.render = function () {
			const result = originalRender.apply(this, arguments)
			injectIntoDetailsView(this)
			return result
		}
	}

	patchDetailsView(wp.media.view.Attachment?.Details)
	patchDetailsView(wp.media.view.Attachment?.Compat)

	$(document).on(
		"click.sdVaultBridgeFallback",
		".attachment, .attachment-preview, .media-modal",
		function () {
			window.setTimeout(function () {
				const modal = $(".media-modal:visible").last()
				const actions = modal
					.find(
						".attachment-info .actions, .attachment-details .actions",
					)
					.first()
				const id = getAttachmentIdFromDom(modal)
				injectButtonIntoActions(actions, id)
			}, 0)
		},
	)

	$(document).on(
		"sd:media:details:rendered systemdeck:media:details:rendered",
		function () {
			const modal = $(".media-modal:visible").last()
			const actions = modal
				.find(".attachment-info .actions, .attachment-details .actions")
				.first()
			const id = getAttachmentIdFromDom(modal)
			injectButtonIntoActions(actions, id)
		},
	)

	// Pro-level Delegation: Bind once at document level
	$(document).on(
		"click.sdVaultBridge",
		".sd-vault-modal-player-surface .sd-midi-bridge-play",
		async function (e) {
		e.preventDefault()
		const surface = $(this).closest(".sd-vault-modal-player-surface")
		const url = String(surface.data("trackUrl") || "")
		const title = String(surface.data("trackTitle") || "Media Attachment")
		const type = String(surface.data("trackType") || "audio")
		const mime = type === "midi" ? "audio/midi" : "audio/mpeg"
		const id = String(surface.data("trackId") || "")

		if (window.SystemDeckPlayback) {
			try {
				await window.SystemDeckAudio?.resume?.()
			} catch (_err) {}
			const state = window.SystemDeckPlayback.getState()
			const activeId = String(state.nowPlaying?.id || state.id || "")
			const isCurrent = id && activeId === id
			if (isCurrent && state.status === "playing") {
				window.SystemDeckPlayback.pause()
				return
			}
			if (isCurrent && state.status === "paused") {
				window.SystemDeckPlayback.resume()
				return
			}
			const item = {
				id: id || `media-${Date.now()}`,
				title: title,
				url: url,
				source: url,
				mime: mime,
				type: type,
				origin: "media",
				metadata: { title: title, mime: mime, mediaType: type }
			}
			window.SystemDeckPlayback.setPlaylist([item], 0)
			window.SystemDeckPlayback.playIndex(0)
		}
	})

	$(document).on(
		"click.sdVaultBridge",
		".sd-vault-modal-player-surface .sd-midi-bridge-stop",
		function (e) {
			e.preventDefault()
			window.SystemDeckPlayback?.stop()
		},
	)

	$(document).on("click.sdVaultBridge", ".sd-bridge-copy-btn", function (e) {
		e.preventDefault()
		const id = $(this).data("id")
		importAttachment(id, this, "copy")
	})

	$(document).on(
		"click.sdVaultBridge",
		".sd-bridge-publish-btn",
		function (e) {
			e.preventDefault()
			const id = $(this).data("id")
			importAttachment(id, this, "publish")
		},
	)
})
