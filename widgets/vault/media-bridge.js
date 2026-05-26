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
	function renderModalPlayerSurfaceHTML({ id, url, title, type, artworkUrl }) {
		const safeId = String(id || "")
		const safeUrl = String(url || "")
		const safeTitle = String(title || "Media Attachment")
		const safeArtworkUrl = String(artworkUrl || "")
		const isMidi = String(type || "") === "midi"
		return `
			<div class="sd-vault-modal-player-surface"
				data-track-id="${safeId}"
				data-track-url="${safeUrl}"
				data-track-title="${safeTitle}"
				data-track-artwork-url="${safeArtworkUrl}"
				data-track-type="${isMidi ? "midi" : "audio"}">
				<div class="sd-player-modal-mount"
					data-context="media-modal"
					data-track-id="${safeId}"
					data-track-url="${safeUrl}"
					data-track-title="${safeTitle}"
					data-track-artwork-url="${safeArtworkUrl}"
					data-track-type="${isMidi ? "midi" : "audio"}"></div>
			</div>
		`
	}

	function mountCanonicalModalSurface(surface) {
		const mountEl = surface?.find(".sd-player-modal-mount")?.get(0)
		if (!mountEl) return
		if (mountEl.dataset.sdMountedTrackId === String(surface.data("trackId") || "")) return
		const detail = {
			context: "media-modal",
			host: mountEl,
			trackId: String(surface.data("trackId") || ""),
			url: String(surface.data("trackUrl") || ""),
			title: String(surface.data("trackTitle") || "Media Attachment"),
			artworkUrl: String(surface.data("trackArtworkUrl") || ""),
			artwork: String(surface.data("trackArtworkUrl") || ""),
			type: String(surface.data("trackType") || "audio"),
		}
		mountEl.dataset.sdMountedTrackId = detail.trackId
		if (window.SystemDeckAudioDebug === true) {
			console.debug("[SystemDeckPlayer:modal]", {
				stage: "media-dispatch-mount",
				context: detail.context,
				trackId: detail.trackId,
				url: detail.url,
				title: detail.title,
				artworkUrl: detail.artworkUrl,
				type: detail.type,
			})
		}
		document.dispatchEvent(
			new CustomEvent("systemdeck:player-modal-mount", { detail }),
		)
	}

	function unmountCanonicalModalSurface(root, context = "media-modal") {
		const $root = root && root.length ? root : $(document)
		$root.find(".sd-player-modal-mount").each(function () {
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "media-dispatch-unmount",
					context,
					trackId: String(this.dataset.sdMountedTrackId || ""),
				})
			}
			delete this.dataset.sdMountedTrackId
			document.dispatchEvent(
				new CustomEvent("systemdeck:player-modal-unmount", {
					detail: { context, host: this },
				}),
			)
			this.innerHTML = ""
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

	function sdAdvancedMediaModalEnabled() {
		return (
			window.sd_vars?.audio?.advancedMediaModal === true ||
			window.SYSTEMDECK_BOOTSTRAP?.config?.audio?.advancedMediaModal === true ||
			window.SYSTEMDECK_ENV?.audio?.advancedMediaModal === true
		)
	}

	function normalizeError(data) {
		if (data?.error) return String(data.error)
		if (data?.message) return String(data.message)
		if (typeof data === "string") return data
		return "Unknown error"
	}

	function sdFixDoubleOriginUrl() {
		// Scoped media-modal URL safety: normalize accidental double-origin URLs
		// during WP modal lifecycle without changing navigation behavior.
		const origin = String(window.location.origin || "").replace(/\/+$/, "")
		const href = String(window.location.href || "")
		if (!origin || !href) return false
		const badPrefix = `${origin}/${origin}`
		if (!href.includes(badPrefix)) return false
		const fixed = href.replace(badPrefix, origin)
		try {
			window.history.replaceState(window.history.state, document.title, fixed)
			return true
		} catch (_error) {
			return false
		}
	}

	function coerceArtworkUrl(value) {
		if (!value) return ""
		if (typeof value === "string") {
			const candidate = value.trim()
			if (!candidate || candidate === "[object Object]") return ""
			return candidate
		}
		if (typeof value === "object") {
			return coerceArtworkUrl(
				value.url ||
					value.src ||
					value.full?.url ||
					value.sizes?.full?.url ||
					value.sizes?.large?.url ||
					value.sizes?.medium?.url ||
					value.sizes?.thumbnail?.url ||
					"",
			)
		}
		return ""
	}

	function sdIsWpDefaultMediaIcon(url) {
		const u = String(url || "").toLowerCase().trim()
		if (!u) return true
		if (u.includes("/wp-includes/images/media/")) return true
		if (u.includes("/wp-includes/images/crystal/")) return true
		if (u.includes("dashicons") && u.includes(".svg")) return true
		if (u.endsWith("audio.png") || u.endsWith("audio.svg")) return true
		if (u.endsWith("document.png") || u.endsWith("document.svg")) return true
		return false
	}

	function extractBackgroundImageUrl($node) {
		if (!$node || !$node.length) return ""
		const cssValue = String($node.css("background-image") || "")
		if (!cssValue || cssValue === "none") return ""
		const match = cssValue.match(/url\((['"]?)(.*?)\1\)/i)
		return match && match[2] ? String(match[2]).trim() : ""
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

		// Idempotency: Don't re-inject if a marker already exists.
		if (actions.find('[data-sd-vault-actions="1"]').length) return

		actions.append(
			`<span class="sd-vault-media-bridge-actions" data-id="${id}" data-sd-vault-actions="1"> | ` +
					`<button class="button-link sd-bridge-copy-btn" type="button" data-id="${id}" style="color:#135e96; text-decoration:none;">Copy to Vault</button>` +
					` | <button class="button-link sd-bridge-publish-btn" type="button" data-id="${id}" style="color:#d63638; text-decoration:none;">Publish to Vault</button>` +
					`</span>`,
		)
	}

	function injectIntoDetailsView(view) {
		sdFixDoubleOriginUrl()
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
		const isAudioLike = isAudio || isMidi
		const hasPlayer = sdAdvancedMediaModalEnabled()
		const thumbnailShell = sidebar
			.find(".thumbnail, .details-image, .attachment-preview")
			.first()
		const artworkUrl =
			coerceArtworkUrl(model.get("thumb")) ||
			coerceArtworkUrl(model.get("image")) ||
			coerceArtworkUrl(model.get("thumbnail")) ||
			coerceArtworkUrl(model.get("icon")) ||
			coerceArtworkUrl(
				sidebar.find(".thumbnail img, .details-image img").first().attr("src"),
			) ||
			extractBackgroundImageUrl(thumbnailShell) ||
			coerceArtworkUrl($el.find(".attachment-details .thumbnail img").first().attr("src")) ||
			coerceArtworkUrl(sidebar.find("img").first().attr("src"))
		const finalArtworkUrl = sdIsWpDefaultMediaIcon(artworkUrl) ? "" : artworkUrl

		if (!isAudioLike) {
			if (mediaHost.length) {
				mediaHost.removeClass("sd-vault-has-systemdeck-player")
				unmountCanonicalModalSurface(mediaHost)
				mediaHost.find(".sd-vault-modal-player-surface").remove()
			}
			const actions = sidebar.find(".actions").first()
			injectButtonIntoActions(actions, id)
			return
		}

		if (!hasPlayer) {
			if (mediaHost.length) {
				mediaHost.removeClass("sd-vault-has-systemdeck-player")
				unmountCanonicalModalSurface(mediaHost)
				mediaHost.find(".sd-vault-modal-player-surface").remove()
			}
			const actions = sidebar.find(".actions").first()
			injectButtonIntoActions(actions, id)
			return
		}

		if (mediaHost.length) {
			mediaHost.addClass("sd-vault-has-systemdeck-player")
			unmountCanonicalModalSurface(mediaHost)
			mediaHost.find(".sd-vault-modal-player-surface").remove()
			const surface = $(
				renderModalPlayerSurfaceHTML({
					id: id,
					url: model.get("url"),
					title: model.get("title") || filename,
					artworkUrl: finalArtworkUrl,
					type: isMidi ? "midi" : "audio",
				}),
			)
			mediaHost.prepend(surface)
			mountCanonicalModalSurface(surface)
		}

		const actions = sidebar.find(".actions").first()
		injectButtonIntoActions(actions, id)
		sdFixDoubleOriginUrl()
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

	$(document).on(
		"click.sdVaultBridgeModalUnmount",
		".media-modal-close, .media-modal-backdrop",
		function () {
			sdFixDoubleOriginUrl()
			const modal = $(".media-modal:visible").last()
			unmountCanonicalModalSurface(modal, "media-modal")
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
