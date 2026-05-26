/**
 * SystemDeck - pin.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/pins/pin.js
 * @license GPL-2.0-or-later
 *
 * Pin Client-side Runtime (Interactions & Rendering)
 */

(function () {
	"use strict"
	const SD_DEBUG = window.SYSTEMDECK_DEBUG === true
	if (SD_DEBUG) {
		console.log("[PIN] pin runtime loaded", { handle: "sd-pin-base-runtime", file: "pins/pin.js" })
	}
	window.SystemDeckPinRuntimeReady = true
	if (SD_DEBUG) {
		console.log("[PIN] runtime ready")
	}
	document.dispatchEvent(new CustomEvent("systemdeck:pin:runtime-ready"))

	function sdMountAllPinsFromDom(reason = "runtime-ready") {
		const roots = document.querySelectorAll("[data-pin-root='1']")
		let mounted = 0

		roots.forEach((el) => {
			if (!(el instanceof Element)) return
			if (el.dataset.sdPinRuntimeBound === "true") return

			const pinId = String(el.getAttribute("data-pin-id") || el.dataset.pinId || "").trim()
			const workspaceId = String(
				el.getAttribute("data-workspace-id") || el.dataset.workspaceId || "default",
			).trim()
			const declaredType = String(
				el.getAttribute("data-pin-type") || el.getAttribute("data-pin-kind") || "",
			)
				.trim()
				.toLowerCase()
			const trackUrl = String(el.getAttribute("data-track-url") || "").trim()
			const trackType = String(el.getAttribute("data-track-type") || "").trim().toLowerCase()
			const isAudioLike =
				trackUrl !== "" &&
				(trackType.startsWith("audio") ||
					trackType.includes("audio") ||
					trackType.includes("midi"))
			const pinType = !declaredType && isAudioLike ? "audio_tile" : declaredType
			const mountKey = `${workspaceId}::${pinId}::${pinType}`

			el.dataset.sdMounted = "true"
			el.setAttribute("data-sd-mount-key", mountKey)

			if (SD_DEBUG) {
				console.log("[PIN] dispatch mount (fallback)", {
					reason,
					pinType,
					pinId,
					workspaceId,
				})
			}

			document.dispatchEvent(
				new CustomEvent("systemdeck:pin:mount", {
					detail: {
						element: el,
						workspaceId,
						pinId,
						instanceId: mountKey,
						pinType,
						renderer: pinType,
					},
				}),
			)

			mounted++
		})

		if (SD_DEBUG) {
			console.log("[PIN] fallback mounted count", { reason, mounted })
		}
		return mounted
	}

	function isDebugEnabled() {
		return window.SYSTEMDECK_DEBUG === true
	}

	function isPlayableTrackUrl(value) {
		const url = String(value || "").trim()
		if (!url) return false
		return (
			url.startsWith("http://") ||
			url.startsWith("https://") ||
			url.startsWith("/") ||
			url.startsWith("?sd_vault_stream=") ||
			url.startsWith("blob:")
		)
	}

	function getMountRoot(detail) {
		const candidate = detail?.element || detail?.root || null
		if (!candidate || !(candidate instanceof Element)) {
			return null
		}
		return candidate
	}

	function triggerOpenPinManager() {
		const event = new CustomEvent("systemdeck:open-pin-picker", {
			detail: { source: "pin-runtime" },
		})
		document.dispatchEvent(event)
	}

	function mountActionPin(root) {
		const actionNode =
			root.matches && root.matches("[data-pin-action]")
				? root
				: root.querySelector("[data-pin-action]")
		if (!actionNode) return
		const action = String(
			actionNode.getAttribute("data-pin-action") || "",
		).trim()
		if (!action) return

		const activate = function (e) {
			e.stopPropagation()
			if (action === "open_pin_manager") {
				triggerOpenPinManager()
			} else if (action === "open_note") {
				const noteId = parseInt(
					actionNode.getAttribute("data-note-id") || "0",
				)
				const noteTitle = String(
					actionNode.getAttribute("data-note-title") || "",
				).trim()
				if (noteId > 0) {
					document.dispatchEvent(
						new CustomEvent("systemdeck:comments:open", {
							detail: {
								targetType: "note",
								targetId: noteId,
								title: noteTitle || "Notes",
							},
						}),
					)
				}
			} else if (action === "open_vault_file") {
				const fileId = parseInt(
					actionNode.getAttribute("data-file-id") || "0",
				)
				const workspaceId =
					actionNode.getAttribute("data-workspace-id") || ""
				// Check if the clicked element or its parents (up to the root) have a data-mode
				const clickedMode = e.target.closest("[data-mode]")?.getAttribute("data-mode")
				const mode =
					clickedMode ||
					actionNode.getAttribute("data-mode") ||
					"read"
				if (fileId > 0) {
					document.dispatchEvent(new CustomEvent("systemdeck:open-vault-file", {
						detail: { fileId, mode, workspaceId }
					}))
				}
			}
		}

		actionNode.addEventListener("click", activate)
		actionNode.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault()
				activate(event)
			}
		})
	}

	function dispatchActionFromNode(node, event) {
		if (!node) return
		const action = String(node.getAttribute("data-pin-action") || "").trim()
		if (!action) return
		if (event) {
			event.preventDefault()
			event.stopPropagation()
		}
		if (action === "open_note") {
			const noteId = parseInt(node.getAttribute("data-note-id") || "0")
			const noteTitle = String(node.getAttribute("data-note-title") || "").trim()
			if (noteId > 0) {
				document.dispatchEvent(
					new CustomEvent("systemdeck:comments:open", {
						detail: {
							targetType: "note",
							targetId: noteId,
							title: noteTitle || "Notes",
						},
					}),
				)
			}
		}
	}

	function getWorkspacePlaylist(detail) {
		const workspaceId = String(detail?.workspaceId || "default")
		const map =
			window.SystemDeckWorkspacePinPlaylists &&
			typeof window.SystemDeckWorkspacePinPlaylists === "object"
				? window.SystemDeckWorkspacePinPlaylists
				: {}
		const entry = map[workspaceId] || map.default || {}
		const items = Array.isArray(entry.items) ? entry.items : []
		return items.filter((item) => {
			if (!item) return false
			const source = String(item.source || item.url || "").trim()
			return isPlayableTrackUrl(source)
		})
	}

	function getPinTrack(root) {
		const url = String(root.getAttribute("data-track-url") || "").trim()
		if (!url) return null
		return {
			id: String(root.getAttribute("data-track-id") || root.getAttribute("data-file-id") || "").trim(),
			pinId: String(root.getAttribute("data-pin-id") || "").trim(),
			title: String(root.getAttribute("data-track-title") || "").trim() || "Track",
			source: url,
			url,
			artworkUrl: String(root.getAttribute("data-track-artwork-url") || "").trim(),
			artwork: String(root.getAttribute("data-track-artwork-url") || "").trim(),
			type: String(root.getAttribute("data-track-type") || "audio").trim().toLowerCase(),
			sourceKind: String(root.getAttribute("data-source-kind") || "vault").trim(),
			vaultFileId: Number(root.getAttribute("data-file-id") || 0) || 0,
			attachmentId: Number(root.getAttribute("data-attachment-id") || 0) || 0,
		}
	}

	function getTrackFromRoot(root) {
		if (!root) return null
		const url = String(
			root.getAttribute("data-track-url") ||
				root.dataset.trackUrl ||
				root.getAttribute("data-url") ||
				root.dataset.url ||
				root.getAttribute("data-stream-url") ||
				root.dataset.streamUrl ||
				"",
		).trim()
		if (!isPlayableTrackUrl(url)) return null
		const artwork = String(root.getAttribute("data-track-artwork-url") || root.dataset.trackArtworkUrl || "").trim()
		return {
			id: String(root.getAttribute("data-track-id") || root.getAttribute("data-file-id") || "").trim(),
			pinId: String(root.getAttribute("data-pin-id") || "").trim(),
			title: String(root.getAttribute("data-track-title") || "").trim() || "Track",
			source: url,
			url,
			artworkUrl: artwork,
			artwork,
			type: String(root.getAttribute("data-track-type") || "audio").trim().toLowerCase(),
			sourceKind: String(root.getAttribute("data-source-kind") || "vault").trim(),
			vaultFileId: Number(root.getAttribute("data-file-id") || 0) || 0,
			attachmentId: Number(root.getAttribute("data-attachment-id") || 0) || 0,
		}
	}

	function isAudioTileRoot(root, detail) {
		if (!root) return false
		const declaredType = String(
			root.getAttribute("data-pin-type") ||
				root.getAttribute("data-pin-kind") ||
				detail?.pinType ||
				detail?.renderer ||
				detail?.pin?.type ||
				detail?.pin?.data?.pin_kind ||
				detail?.pinId ||
				"",
		).toLowerCase()
		if (declaredType === "audio_tile" || declaredType === "sd_audio_tile") {
			return true
		}
		const hasTrackUrl = isPlayableTrackUrl(
			root.getAttribute("data-track-url") ||
				root.dataset.trackUrl ||
				root.getAttribute("data-url") ||
				root.dataset.url ||
				root.getAttribute("data-stream-url") ||
				root.dataset.streamUrl ||
				"",
		)
		if (hasTrackUrl) return true
		const action = String(root.getAttribute("data-pin-action") || "").toLowerCase()
		const kind = String(root.getAttribute("data-source-kind") || "").toLowerCase()
		return action === "open_vault_file" && kind === "vault"
	}

	function playTrackFromPlaylist(playlist, index) {
		if (!Array.isArray(playlist) || !playlist.length) return
		const safeIndex = Number(index)
		if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= playlist.length) return
		const selected = playlist[safeIndex]
		const resolvedSource = String(selected?.source || selected?.url || "").trim()
		if (!isPlayableTrackUrl(resolvedSource)) {
			if (isDebugEnabled()) {
				console.debug("[SystemDeckPins] Skipping play for invalid source", {
					index: safeIndex,
					selected,
				})
			}
			return
		}
		if (window.SystemDeckPlayback?.setPlaylist && window.SystemDeckPlayback?.playIndex) {
			window.SystemDeckPlayback.setPlaylist(
				playlist.map((item, i) =>
					i === safeIndex
						? { ...item, source: resolvedSource, url: resolvedSource }
						: item,
				),
				safeIndex,
			)
			void window.SystemDeckPlayback.playIndex(safeIndex)
			return
		}
		document.dispatchEvent(
			new CustomEvent("systemdeck:play-file", {
				detail: {
					source: resolvedSource,
					meta: {
						...selected,
						source: resolvedSource,
						url: resolvedSource,
					},
					index: safeIndex,
					playlist,
				},
			}),
		)
	}

	function sdHasWidgetPlayerSurface() {
		const roots = Array.from(document.querySelectorAll(".sd-player-root"))
		return roots.some((node) => {
			if (!(node instanceof HTMLElement)) return false
			if (!node.isConnected) return false
			const context = String(node.getAttribute("data-context") || "").toLowerCase()
			if (context.includes("modal")) return false
			return true
		})
	}

	function sdHasPinMiniPlayerSurface(workspaceId = "default") {
		const ws = String(workspaceId || "default").trim()
		const nodes = Array.from(
			document.querySelectorAll(
				"[data-pin-type='pin_mini_player'],[data-pin-type='sd_pin_mini_player'],[data-pin-kind='pin_mini_player'],[data-pin-kind='sd_pin_mini_player']",
			),
		)
		return nodes.some((node) => {
			if (!(node instanceof HTMLElement)) return false
			if (!node.isConnected) return false
			const nodeWorkspaceId = String(node.getAttribute("data-workspace-id") || "default").trim()
			return nodeWorkspaceId === ws || nodeWorkspaceId === "default"
		})
	}

	function resolvePinnedPlaybackRoute(workspaceId = "default") {
		if (sdHasWidgetPlayerSurface()) return "widget-player"
		if (sdHasPinMiniPlayerSurface(workspaceId)) return "pin-mini-player"
		return "none"
	}

	function dispatchPinnedRouteSync(route, workspaceId, playlist, index, track) {
		document.dispatchEvent(
			new CustomEvent("systemdeck:pins:playback-route", {
				detail: {
					route,
					workspaceId: String(workspaceId || "default"),
					playlist,
					index,
					track,
				},
			}),
		)
	}

	function sdPlayPinnedTrack({ workspaceId = "default", playlist = [], index = 0, track = null }) {
		const route = resolvePinnedPlaybackRoute(workspaceId)
		playTrackFromPlaylist(playlist, index)
		dispatchPinnedRouteSync(route, workspaceId, playlist, index, track)
		if (route === "none" && isDebugEnabled()) {
			console.debug("[SystemDeckPins] No player surface mounted; playback dispatched via authority.")
		}
	}

	function mountAudioTilePin(root, detail) {
		const track = getPinTrack(root)
		const fallbackTrack = getTrackFromRoot(root)
		const mountedTrack = track || fallbackTrack
		if (!mountedTrack) {
			if (isDebugEnabled()) {
				console.debug("[PIN] skip", { reason: "no-track-url", pinId: root?.getAttribute("data-pin-id") || "" })
			}
			return
		}
		const workspaceId = String(detail?.workspaceId || "default")
		if (isDebugEnabled()) {
			console.debug("[PIN] mounted audio_tile", {
				pinType: String(root.getAttribute("data-pin-type") || root.getAttribute("data-pin-kind") || ""),
				pinId: String(root.getAttribute("data-pin-id") || ""),
				instanceId: String(detail?.instanceId || ""),
				workspaceId,
				hasTrackUrl: true,
			})
		}
		console.log("[PIN] bind audio tile handlers", {
			pinId: String(root.getAttribute("data-pin-id") || ""),
			workspaceId,
		})

		const activate = function (event) {
			event.preventDefault()
			event.stopPropagation()
			const playlist = getWorkspacePlaylist({ workspaceId })
			const playlistIndex = playlist.findIndex(
				(item) => String(item?.pinId || "") === String(mountedTrack.pinId || ""),
			)
			if (isDebugEnabled()) {
				console.debug("[PIN] click audio_tile", {
					workspaceId,
					index: playlistIndex,
					playlistLength: playlist.length,
					source: mountedTrack.source || mountedTrack.url || "",
				})
			}
			if (playlistIndex >= 0) {
				sdPlayPinnedTrack({
					workspaceId,
					playlist,
					index: playlistIndex,
					track: playlist[playlistIndex] || mountedTrack,
				})
				return
			}
			if (isDebugEnabled()) {
				console.debug("[PIN] skip", {
					reason: "playlist-missing-track",
					workspaceId,
					pinId: mountedTrack.pinId || "",
				})
			}
			sdPlayPinnedTrack({
				workspaceId,
				playlist: [mountedTrack],
				index: 0,
				track: mountedTrack,
			})
		}

		root.addEventListener("click", activate, true)
		root.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				activate(event)
			}
		}, true)
	}

	function mountMiniPlayerPin(root, detail) {
		const titleNode = root.querySelector(".sd-pin-mini-player-title")
		const artNode = root.querySelector(".sd-pin-mini-player-art")
		const prevBtn = root.querySelector('[data-role="mini-prev"]')
		const playBtn = root.querySelector('[data-role="mini-play"]')
		const nextBtn = root.querySelector('[data-role="mini-next"]')
		const playIcon = playBtn ? playBtn.querySelector(".dashicons") : null
		const initialTitle = String(root.getAttribute("data-empty-title") || "No track selected")
		const workspaceId = String(detail?.workspaceId || "default")

		const setState = function (track, isPlaying) {
			if (titleNode) {
				titleNode.textContent = track?.title ? String(track.title) : initialTitle
			}
			if (artNode) {
				const artwork = String(track?.artworkUrl || track?.artwork || "").trim()
				artNode.innerHTML = artwork
					? `<img src="${artwork}" alt="" class="sd-pin-mini-player-art-img" />`
					: '<span class="dashicons dashicons-format-audio sd-pin-mini-player-placeholder-icon" aria-hidden="true"></span>'
			}
			if (playIcon) {
				playIcon.classList.remove("dashicons-controls-play", "dashicons-controls-pause")
				playIcon.classList.add(isPlaying ? "dashicons-controls-pause" : "dashicons-controls-play")
			}
		}

		const getState = function () {
			const playlist = getWorkspacePlaylist({ workspaceId })
			const currentTrackId = String(root.getAttribute("data-current-track-id") || "")
			let currentIndex = Number(root.getAttribute("data-current-index") || -1)
			if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= playlist.length) {
				currentIndex = playlist.findIndex((item) => String(item?.id || "") === currentTrackId)
			}
			return { playlist, currentIndex }
		}

		const setCurrent = function (track, index) {
			root.setAttribute("data-current-track-id", String(track?.id || ""))
			root.setAttribute("data-current-index", String(Number.isInteger(index) ? index : -1))
		}

		const playAt = function (index) {
			const state = getState()
			if (!state.playlist.length) {
				setState(null, false)
				return
			}
			const safeIndex =
				Number.isInteger(index) && index >= 0 && index < state.playlist.length ? index : 0
			const track = state.playlist[safeIndex]
			setCurrent(track, safeIndex)
			setState(track, true)
			playTrackFromPlaylist(state.playlist, safeIndex)
		}

		if (prevBtn) {
			prevBtn.addEventListener("click", function (event) {
				event.preventDefault()
				event.stopPropagation()
				const state = getState()
				if (!state.playlist.length) return
				const nextIndex =
					state.currentIndex >= 0
						? (state.currentIndex - 1 + state.playlist.length) % state.playlist.length
						: 0
				playAt(nextIndex)
			})
		}
		if (nextBtn) {
			nextBtn.addEventListener("click", function (event) {
				event.preventDefault()
				event.stopPropagation()
				const state = getState()
				if (!state.playlist.length) return
				const nextIndex =
					state.currentIndex >= 0
						? (state.currentIndex + 1) % state.playlist.length
						: 0
				playAt(nextIndex)
			})
		}
		if (playBtn) {
			playBtn.addEventListener("click", function (event) {
				event.preventDefault()
				event.stopPropagation()
				const state = getState()
				const playbackState = window.SystemDeckPlayback?.getState?.() || {}
				const status = String(playbackState?.status || "").toLowerCase()
				if (status === "playing") {
					window.SystemDeckPlayback?.pause?.()
					setState(state.playlist[state.currentIndex] || null, false)
					return
				}
				if (status === "paused") {
					void window.SystemDeckPlayback?.resume?.()
					setState(state.playlist[state.currentIndex] || null, true)
					return
				}
				playAt(state.currentIndex >= 0 ? state.currentIndex : 0)
			})
		}

		const onPlaybackState = function (event) {
			const state = getState()
			const detailState = event?.detail || {}
			const nowPlaying = detailState?.nowPlaying || {}
			const source = String(
				nowPlaying?.source || detailState?.source || detailState?.metadata?.source || "",
			)
			if (!source || !state.playlist.length) return
			const matchedIndex = state.playlist.findIndex((item) => item?.source === source)
			if (matchedIndex < 0) return
			const matched = state.playlist[matchedIndex]
			setCurrent(matched, matchedIndex)
			setState(matched, String(detailState?.status || "").toLowerCase() === "playing")
		}
		document.addEventListener("systemdeck:playback-state", onPlaybackState)
		root._sdMiniUnmount = function () {
			document.removeEventListener("systemdeck:playback-state", onPlaybackState)
		}

		const state = getState()
		const initialTrack = state.currentIndex >= 0 ? state.playlist[state.currentIndex] : null
		setState(initialTrack, false)
	}

	function handlePinMount(event) {
		const detail = event && event.detail ? event.detail : null
		if (SD_DEBUG) {
			console.log("[PIN] mount event received", detail)
		}
		const root = getMountRoot(detail)
		if (!root) {
			if (SD_DEBUG) {
				console.log("[PIN] skip mount: no root")
			}
			return
		}

		if (root.dataset.sdPinRuntimeBound === "true") {
			return
		}
		root.dataset.sdPinRuntimeBound = "true"
		if (SD_DEBUG) {
			console.log("[PIN] mount event received", {
				pinId: String(detail?.pinId || ""),
				instanceId: String(detail?.instanceId || ""),
				workspaceId: String(detail?.workspaceId || ""),
				rootTag: root.tagName,
				pinType: String(root.getAttribute("data-pin-type") || root.getAttribute("data-pin-kind") || ""),
			})
		}

		mountActionPin(root)
		const pinType = String(
			root.getAttribute("data-pin-type") ||
				root.getAttribute("data-pin-kind") ||
				detail?.pinId ||
				"",
		).toLowerCase()
		if (pinType === "audio_tile" || pinType === "sd_audio_tile" || isAudioTileRoot(root, detail)) {
			mountAudioTilePin(root, detail)
		}
		if (pinType === "pin_mini_player" || pinType === "sd_pin_mini_player") {
			mountMiniPlayerPin(root, detail)
		}
	}

	if (SD_DEBUG) {
		console.log("[PIN] listener registered (document)", "systemdeck:pin:mount")
	}
	document.addEventListener("systemdeck:pin:mount", handlePinMount)
	sdMountAllPinsFromDom("runtime-ready")
	setTimeout(() => sdMountAllPinsFromDom("post-ready-tick"), 0)
	document.addEventListener("systemdeck:refresh-pins", () =>
		setTimeout(() => sdMountAllPinsFromDom("refresh-pins"), 0),
	)
	document.addEventListener("click", function (event) {
		const node = event?.target?.closest
			? event.target.closest("[data-pin-action='open_note']")
			: null
		if (!node) return
		dispatchActionFromNode(node, event)
	})
	document.addEventListener("keydown", function (event) {
		if (event.key !== "Enter" && event.key !== " ") return
		const node = event?.target?.closest
			? event.target.closest("[data-pin-action='open_note']")
			: null
		if (!node) return
		dispatchActionFromNode(node, event)
	})
})()
