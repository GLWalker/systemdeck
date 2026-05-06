/**
 * SystemDeck - app.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/player/app.js
 * @license GPL-2.0-or-later
 *
 * SystemDeck Media Player Widget (Client-side Interaction)
 */

;(function ($) {
	"use strict";


	if (window.SystemDeckPlayerBooted) return;
	window.SystemDeckPlayerBooted = true;

	console.log("[SystemDeckPlayer] app.js loaded");

	const q = (root, selector) => root.querySelector(selector)
	const clamp = (value, min, max) =>
		Math.max(min, Math.min(max, Number(value) || 0))
	const formatTime = (seconds) => {
		const value = Math.max(0, Number(seconds) || 0)
		const min = Math.floor(value / 60)
		const sec = Math.floor(value % 60)
		return `${min}:${sec.toString().padStart(2, "0")}`
	}
	const EQ_PRESETS = {
		Flat: {
			name: "Flat",
			bands: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 },
		},
		"Bass Boost": {
			name: "Bass Boost",
			bands: { bass: 6, lowMid: 3, mid: 0, highMid: 0, treble: 0 },
		},
		Warm: {
			name: "Warm",
			bands: { bass: 3, lowMid: 0, mid: 2, highMid: 0, treble: -2 },
		},
		Bright: {
			name: "Bright",
			bands: { bass: 0, lowMid: 0, mid: 0, highMid: 3, treble: 5 },
		},
		Vocal: {
			name: "Vocal",
			bands: { bass: -2, lowMid: 0, mid: 4, highMid: 2, treble: 0 },
		},
		Retro: {
			name: "Retro",
			bands: { bass: 2, lowMid: 0, mid: 0, highMid: 0, treble: -3 },
		},
	}

	const PlayerUI = {
		widgets: new Map(),
		playlists: new WeakMap(),
		states: new WeakMap(), // Cache current state per widget for seek authority

		cacheUI(root) {
			return {
				play: q(root, '[data-action="play"]'),
				playSelected: q(root, '[data-action="play-selected"]'),
				loadSelected: q(root, '[data-action="load-selected"]'),
				playSelectedButtons: Array.from(root.querySelectorAll('[data-action="play-selected"]')),
				pause: q(root, '[data-action="pause"]'),
				stop: q(root, '[data-action="stop"]'),
				prev: q(root, '[data-action="prev"]'),
				next: q(root, '[data-action="next"]'),
				uploadBtn: q(root, '[data-action="upload-vault"]'),

				volume: q(root, '[data-control="volume"], [data-role="volume"]'),
				bass: q(root, '[data-control="bass"], [data-role="bass-boost"], [data-role-secondary="bass-boost"]'),
				mixBass: q(root, '[data-role="mix-bass"]'),
				mixSynth: q(root, '[data-role="mix-synth"]'),
				mixDrums: q(root, '[data-role="mix-drums"]'),
				eqPreset: q(root, '[data-role="eq-preset"]'),
				eqBass: q(root, '[data-role="eq-bass"]'),
				eqLowMid: q(root, '[data-role="eq-low-mid"]'),
				eqMid: q(root, '[data-role="eq-mid"]'),
				eqHighMid: q(root, '[data-role="eq-high-mid"]'),
				eqTreble: q(root, '[data-role="eq-treble"]'),
				eqMasterGain: q(root, '[data-role="eq-master-gain"]'),
				eqMasterGainAll: Array.from(root.querySelectorAll('[data-role="eq-master-gain"]')),
				eqMasterValueAll: Array.from(root.querySelectorAll('[data-role="eq-master-value"]')),
				eqAdvancedBand: q(root, '[data-role="eq-advanced-band"]'),
				eqAdvancedFreq: q(root, '[data-role="eq-advanced-frequency"]'),
				eqAdvancedQ: q(root, '[data-role="eq-advanced-q"]'),
				eqEnabled: q(root, '[data-role="eq-enabled"]'),
				eqBassBoostVisual: q(root, '[data-role="eq-bass-boost-visual"]'),
				eqBands10: Array.from(root.querySelectorAll('[data-role="eq-band"]')),
				playlistList: q(root, '[data-role="playlist-list"]'),
				metaTrack: q(root, '[data-role="meta-track"]'),
				metaCodec: q(root, '[data-role="meta-codec"]'),
				metaType: q(root, '[data-role="meta-type"]'),
				artwork: q(root, '[data-role="artwork"]'),
				visualizer: q(root, '[data-role="visualizer"]'),
				playlistTotal: q(root, '[data-role="playlist-total"]'),

				timeline: q(root, "[data-timeline], [data-role='seek']"),
				time: q(root, "[data-time]"),
				duration: q(root, "[data-duration]"),

				status: q(root, "[data-status], [data-role='status']"),
				title: q(root, "[data-title], [data-role='now-playing']"),
				error: q(root, "[data-role='error']"),
				playlist: q(root, "[data-role='playlist']"),
				fileInput: q(root, "[data-role='file-input']"),
			}
		},

		setStatus(ui, status) {
			if (!ui.status) return
			const map = {
				idle: "is-low",
				loading: "is-moderate",
				playing: "is-high",
				paused: "is-moderate",
				stopped: "is-low",
				error: "is-urgent",
			}
			const key = String(status || "idle").toLowerCase()
			const level = map[key] || "is-low"
			ui.status.className = `sd-status-badge ${level}`
			ui.status.textContent = String(status || "").toUpperCase()
		},

		renderMiniPlayerSurface() {
			const tpl = document.createElement("template")
			tpl.innerHTML = `<section class="sd-player-card sd-player-now-card">
				<header class="sd-player-card-title">NOW PLAYING</header>
				<div class="sd-player-now-card-content">
					<div class="sd-player-artwork" data-role="artwork"><div class="sd-player-artwork-placeholder"><span class="dashicons dashicons-format-audio"></span></div></div>
					<div class="sd-player-now-main">
						<div class="sd-player-now-header">
							<div>
								<div class="sd-player-track-title" data-role="now-playing">No source loaded.</div>
								<div class="sd-status-badge is-low" data-role="status">IDLE</div>
							</div>
							<div class="sd-player-track-time"><span data-time>0:00</span><span>/</span><span data-duration>0:00</span></div>
						</div>
						<div class="sd-player-visualizer" data-role="visualizer"><div class="sd-player-bars">${"<span></span>".repeat(52)}</div></div>
					</div>
				</div>
				<div class="sd-player-seek-row"><input type="range" min="0" max="1" step="0.001" value="0" data-role="seek" data-timeline></div>
				<div class="sd-player-bottom-controls">
					<div class="sd-player-volume"><span class="dashicons dashicons-controls-volumeon sd-button-icon"></span><input type="range" min="0" max="1" step="0.01" value="0.45" data-role="volume" data-control="volume"></div>
					<div class="sd-player-transport">
						<button type="button" class="button" data-action="prev"><span class="dashicons dashicons-controls-skipback sd-button-icon"></span><span>Prev</span></button>
						<button type="button" class="button button-primary" data-action="play-selected"><span class="dashicons dashicons-controls-play sd-button-icon"></span><span>Play</span></button>
						<button type="button" class="button" data-action="pause"><span class="dashicons dashicons-controls-pause sd-button-icon"></span><span>Pause</span></button>
						<button type="button" class="button" data-action="stop"><span class="dashicons dashicons-no sd-button-icon"></span><span>Stop</span></button>
						<button type="button" class="button" data-action="next"><span>Next</span><span class="dashicons dashicons-controls-forward sd-button-icon sd-button-icon-right"></span></button>
					</div>
				</div>
			</section>`
			return tpl.content.firstElementChild
		},

		syncMiniPlayerSurface(surfaceRoot, state) {
			if (!surfaceRoot || !state) return
			const ui = this.cacheUI(surfaceRoot)
			const duration = Number(state.duration || 0)
			const currentTime = Number(state.currentTime || 0)
			const progress =
				Number.isFinite(Number(state.progress))
					? clamp(state.progress, 0, 1)
					: duration > 0
						? clamp(currentTime / duration, 0, 1)
						: 0
			const normalizedStatus = String(state.status || "stopped").toLowerCase()
			const normalizedTitle = state.title || "No source loaded."
			const normalizedArtwork = state.artwork || ""
			const isSeeking = surfaceRoot.dataset.sdMiniSeeking === "1"

			this.setStatus(ui, normalizedStatus)
			if (ui.title) {
				ui.title.textContent = normalizedTitle
			}
			if (ui.artwork) {
				const existingImage = ui.artwork.querySelector("img")
				if (normalizedArtwork) {
					ui.artwork.innerHTML = `<img src="${this.escapeHtml(normalizedArtwork)}" alt="">`
				} else {
					const existingImg = existingImage
					if (existingImg) {
						existingImg.removeAttribute("src")
						existingImg.remove()
					}
					if (!ui.artwork.querySelector(".sd-player-artwork-placeholder")) {
						ui.artwork.innerHTML = `<div class="sd-player-artwork-placeholder"><span class="dashicons dashicons-format-audio"></span></div>`
					}
				}
			}
			if (ui.visualizer) {
				ui.visualizer.classList.toggle("is-playing", normalizedStatus === "playing")
			}
			if (ui.time) ui.time.textContent = formatTime(currentTime)
			if (ui.duration) ui.duration.textContent = formatTime(duration)
			if (ui.visualizer) {
				// TODO: replace progress visualizer with Tone analyser-driven bars once playback state is fully stable.
				const bars = ui.visualizer.querySelectorAll(".sd-player-bars span")
				if (bars.length) {
					const activeCount = Math.round(progress * bars.length)
					bars.forEach((bar, index) => {
						bar.classList.toggle("is-active", index < activeCount)
					})
				}
			}
			if (ui.timeline) {
				ui.timeline.min = 0
				ui.timeline.max = 1
				ui.timeline.step = 0.001
				if (duration > 0) {
					ui.timeline.disabled = false
					if (!isSeeking) {
						ui.timeline.value = String(progress)
					}
				} else {
					ui.timeline.disabled = false
					if (!isSeeking) ui.timeline.value = "0"
				}
			}
		},

		bindMiniPlayerSurface(surfaceRoot) {
			if (!surfaceRoot) return
			if (surfaceRoot.dataset.sdMiniBound === "1") return
			surfaceRoot.dataset.sdMiniBound = "1"
			const ui = this.cacheUI(surfaceRoot)

			ui.play?.addEventListener("click", async () => {
				const state = window.SystemDeckPlayback?.getState?.()
				if (!state || state.status === "idle") {
					alert("Load a track first")
					return
				}
				window.SystemDeckPlayback?.resume?.()
			})
			;(ui.playSelectedButtons || []).forEach((btn) => {
				btn.addEventListener("click", () => {
					const playbackState = window.SystemDeckPlayback?.getState?.() || {}
					const status = String(playbackState?.status || "").toLowerCase()
					if (status === "paused") {
						window.SystemDeckPlayback?.resume?.()
						return
					}
					if (typeof surfaceRoot._sdPlayerPlaySelected === "function") {
						surfaceRoot._sdPlayerPlaySelected()
						return
					}
					window.SystemDeckPlayback?.resume?.()
				})
			})
			ui.pause?.addEventListener("click", () => window.SystemDeckPlayback?.pause?.())
			ui.stop?.addEventListener("click", () => window.SystemDeckPlayback?.stop?.())
			ui.prev?.addEventListener("click", () => window.SystemDeckPlayback?.previous?.())
			ui.next?.addEventListener("click", () => window.SystemDeckPlayback?.next?.())
			ui.volume?.addEventListener("input", (e) => {
				window.SystemDeckPlayback?.setVolume?.(e.target.value)
			})
			const seekToRatio = (ratio) => {
				const state = window.SystemDeckPlayback?.getState?.() || {}
				const duration = Number(state?.duration || 0)
				const target = duration > 0 ? ratio * duration : 0
				if (duration > 0 && window.SystemDeckPlayback) {
					window.SystemDeckPlayback.seek?.(target)
				}
			}
			const releaseSeek = () => {
				surfaceRoot.dataset.sdMiniSeeking = "0"
				delete ui.timeline?.dataset.dragging
			}
			const seekFromSlider = () => {
				const ratio = Number(ui.timeline?.value || 0)
				seekToRatio(ratio)
			}
			ui.timeline?.addEventListener("input", (e) => {
				surfaceRoot.dataset.sdMiniSeeking = "1"
				ui.timeline.dataset.dragging = "true"
			})
			ui.timeline?.addEventListener("change", (e) => {
				seekFromSlider()
				releaseSeek()
			})
			ui.timeline?.addEventListener("pointerdown", (e) => {
				surfaceRoot.dataset.sdMiniSeeking = "1"
			})
			ui.timeline?.addEventListener("pointerup", () => {
				releaseSeek()
			})
			ui.timeline?.addEventListener("pointercancel", releaseSeek)
			ui.timeline?.addEventListener("mouseup", releaseSeek)
			ui.timeline?.addEventListener("touchend", releaseSeek)
			ui.timeline?.addEventListener("keyup", releaseSeek)
			ui.timeline?.addEventListener("blur", releaseSeek)
		},

		updateUI(ui, state) {
			if (!state) return

			const surfaceRoot = ui.title?.closest(".sd-player-now-card")
			const miniState = {
				title:
					state.nowPlaying?.title ||
					state.title ||
					state.nowPlaying?.metadata?.title ||
					state.metadata?.title ||
					(state.status === "loading" ? "Loading..." : "No source loaded."),
				status: String(state.status || "stopped").toLowerCase(),
				currentTime: Number(state.currentTime || 0),
				duration: Number(state.duration || 0),
				progress:
					Number(state.duration || 0) > 0
						? clamp(Number(state.currentTime || 0) / Number(state.duration || 0), 0, 1)
						: 0,
				artwork:
					state.artwork ||
					state.nowPlaying?.metadata?.artwork ||
					state.nowPlaying?.metadata?.artworkUrl ||
					state.nowPlaying?.metadata?.thumbnail ||
					state.nowPlaying?.metadata?.cover ||
					state.metadata?.artwork ||
					state.metadata?.artworkUrl ||
					state.metadata?.thumbnail ||
					state.metadata?.cover ||
					null,
			}
			this.syncMiniPlayerSurface(surfaceRoot, miniState)

			if (ui.metaTrack) {
				ui.metaTrack.textContent = state.title || state.metadata?.title || "-"
			}
			if (ui.metaCodec) {
				ui.metaCodec.textContent = state.metadata?.mime || "-"
			}
			if (ui.metaType) {
				ui.metaType.textContent = state.mode || "-"
			}

			const duration = Number(state.duration || 0)
			const currentTime = Number(state.currentTime || 0)
			const playlist = state.playlist || []
			const hasTrack = state.currentIndex >= 0 && playlist.length > 0
			const status = state.status || "idle"

			if (ui.playlistTotal) {
				ui.playlistTotal.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
			}

			// 1. Control Button States
			if (ui.play) ui.play.disabled = !hasTrack
			if (ui.pause) ui.pause.disabled = status !== "playing"
			if (ui.stop) ui.stop.disabled = (status === "idle" || status === "stopped") && !hasTrack
			
			if (ui.prev) ui.prev.disabled = playlist.length <= 1
			if (ui.next) ui.next.disabled = playlist.length <= 1

			// 2. Load Action Locking
			if (ui.playSelectedButtons?.length) {
				ui.playSelectedButtons.forEach((btn) => {
					btn.disabled = status === "loading"
				})
			}

		},

		ensureProEQPanel(root) {
			if (!root) return
			root.innerHTML = ""
			root.insertAdjacentHTML(
				"afterbegin",
				`<div class="sd-player-shell sd-player-v2">
					<div data-mini-surface-slot></div>
					<section class="sd-player-card sd-player-controls-card">
						<header class="sd-player-card-title">PLAYER CONTROLS</header>
						<div class="sd-player-controls-grid-v2">
							<label class="sd-player-control-block"><span>Master Gain</span><input type="range" min="0" max="2" step="0.01" value="1" data-role="eq-master-gain"></label>
							<label class="sd-player-check"><input type="checkbox" data-role="eq-bass-boost-visual" data-role-secondary="bass-boost"><span>Bass Boost</span></label>
							<div class="sd-player-load-block"><label><span>Load Playlist</span><select data-role="playlist" class="sd-player-playlist-select"><option value="">-- Select Track --</option></select></label><button type="button" class="button button-primary" data-action="load-selected">Load</button><button type="button" class="button" data-action="upload-vault">Upload</button><input type="file" data-role="file-input" hidden></div>
						</div>
						<div class="sd-player-controls-balance"><span>Balance</span><div class="sd-player-balance" aria-hidden="true"><span>L</span><input type="range" min="-1" max="1" step="0.01" value="0" disabled><span>R</span></div></div>
						<div class="sd-player-adv-meta"><div><span>Track</span><strong data-role="meta-track">-</strong></div><div><span>Codec</span><strong data-role="meta-codec">-</strong></div><div><span>Mode</span><strong data-role="meta-type">-</strong></div></div>
					</section>
					<section class="sd-player-card sd-player-eq-card">
						<header class="sd-player-card-title">EQUALIZER</header>
						<div class="sd-player-eq-top"><label><input type="checkbox" data-role="eq-enabled" checked><span>EQ On</span></label><label>Preset<select data-role="eq-preset"><option>Flat</option><option>Bass Boost</option><option>Warm</option><option>Bright</option><option>Vocal</option><option>Retro</option><option>Custom</option></select></label><label>Preamp<div class="sd-player-preamp-wrap"><input type="range" min="0" max="2" step="0.01" value="1" data-role="eq-master-gain"><strong data-role="eq-master-value">0.0 dB</strong></div></label></div>
						<div class="sd-player-eq-board"><div class="sd-player-db-scale"><span>+12 dB</span><span>0 dB</span><span>-12 dB</span></div><div class="sd-player-eq-grid"><div class="sd-player-eq-guide sd-player-eq-guide-top"></div><div class="sd-player-eq-guide sd-player-eq-guide-mid"></div><div class="sd-player-eq-guide sd-player-eq-guide-bottom"></div>${["32","64","125","250","500","1K","2K","4K","8K","16K"].map((hz)=>`<label class="sd-player-eq-band"><input type="range" min="-24" max="12" step="1" value="0" data-role="eq-band" data-freq="${hz}"><span>${hz}</span></label>`).join("")}</div></div>
						<details class="sd-player-advanced-eq"><summary>Advanced EQ</summary><div class="sd-player-advanced-eq-grid"><label><span>Band</span><select data-role="eq-advanced-band"><option value="bass">Bass</option><option value="lowMid">Low Mid</option><option value="mid">Mid</option><option value="highMid">High Mid</option><option value="treble">Treble</option></select></label><label><span>Frequency</span><input type="range" min="20" max="20000" step="1" value="1000" data-role="eq-advanced-frequency"></label><label><span>Q</span><input type="range" min="0.1" max="24" step="0.1" value="1" data-role="eq-advanced-q"></label></div></details>
					</section>
					<section class="sd-player-card sd-player-playlist-card">
						<header class="sd-player-card-title">PLAYLIST</header>
						<div class="sd-player-playlist-table" data-role="playlist-list"></div>
						<div class="sd-player-playlist-actions"><button type="button" class="button" disabled><span class="dashicons dashicons-plus"></span> Add</button><button type="button" class="button" disabled><span class="dashicons dashicons-minus"></span> Remove</button><button type="button" class="button" disabled><span class="dashicons dashicons-list-view"></span> Clear</button><button type="button" class="button" disabled><span class="dashicons dashicons-ellipsis"></span> More</button><button type="button" class="button" disabled><span class="dashicons dashicons-portfolio"></span></button><span class="sd-player-playlist-total" data-role="playlist-total">0:00 / 0:00</span></div>
					</section>
					<div class="sd-player-error" data-role="error" hidden></div>
				</div>`,
			)
			const shell = q(root, ".sd-player-shell.sd-player-v2")
			const slot = q(shell, "[data-mini-surface-slot]")
			const mini = this.renderMiniPlayerSurface()
			slot?.replaceWith(mini)
		},

		syncEQUI(ui, eqState = {}) {
			const bands = eqState.bands || {}
			const setValue = (el, v) => {
				if (!el) return
				el.value = String(Math.round(Number(v) || 0))
			}
			setValue(ui.eqBass, bands.bass)
			setValue(ui.eqLowMid, bands.lowMid)
			setValue(ui.eqMid, bands.mid)
			setValue(ui.eqHighMid, bands.highMid)
			setValue(ui.eqTreble, bands.treble)
			const mapFreq = {
				"32": bands.bass,
				"64": bands.bass,
				"125": bands.lowMid,
				"250": bands.lowMid,
				"500": bands.mid,
				"1K": bands.mid,
				"2K": bands.highMid,
				"4K": bands.highMid,
				"8K": bands.treble,
				"16K": bands.treble,
			}
			;(ui.eqBands10 || []).forEach((el) => {
				const freq = String(el?.dataset?.freq || "")
				if (Object.prototype.hasOwnProperty.call(mapFreq, freq)) {
					setValue(el, mapFreq[freq])
				}
			})
			if (ui.eqMasterGainAll?.length && Number.isFinite(Number(eqState.masterGain))) {
				ui.eqMasterGainAll.forEach((el) => {
					el.value = String(Number(eqState.masterGain))
				})
			}
			if (ui.eqMasterValueAll?.length && Number.isFinite(Number(eqState.masterGain))) {
				const db = (Math.max(0, Number(eqState.masterGain)) - 1) * 12
				ui.eqMasterValueAll.forEach((el) => {
					el.textContent = `${db.toFixed(1)} dB`
				})
			}
			if (ui.bass && typeof eqState.bassBoost === "boolean") {
				ui.bass.checked = !!eqState.bassBoost
			}
			if (ui.eqBassBoostVisual && typeof eqState.bassBoost === "boolean") {
				ui.eqBassBoostVisual.checked = !!eqState.bassBoost
			}
			if (ui.eqEnabled) {
				ui.eqEnabled.checked = String(eqState.preset || "Flat") !== "Flat"
			}
			if (ui.eqPreset) {
				const preset = String(eqState.preset || "Custom")
				ui.eqPreset.value = EQ_PRESETS[preset] ? preset : "Custom"
			}
		},

		renderPlaylistPane(ui, currentIndex = -1) {
			if (!ui.playlistList || !ui.playlist) return
			const options = Array.from(ui.playlist.options || []).filter((opt) => opt.value !== "")
			if (!options.length) {
				ui.playlistList.innerHTML = `<div class="sd-player-playlist-empty">No tracks</div>`
				return
			}
			const playlist = this.playlists.get(ui.playlist) || []
			const rows = options
				.map((opt) => {
					const idx = Number(opt.value)
					const item = playlist[idx] || {}
					const cls = idx === Number(currentIndex) ? " is-playing" : ""
					const durSeconds = Number(item?.metadata?.duration || item?.duration || 0)
					const duration = durSeconds > 0 ? formatTime(durSeconds) : "--:--"
					const icon = cls ? '<span class="dashicons dashicons-controls-play"></span>' : ""
					return `<button type="button" class="sd-player-playlist-row${cls}" data-index="${idx}">
						<span class="sd-player-playlist-number">${icon}${idx + 1}</span>
						<span class="sd-player-playlist-title">${this.escapeHtml(opt.textContent || "")}</span>
						<span class="sd-player-playlist-duration">${duration}</span>
						<span class="sd-player-playlist-menu">⋮</span>
					</button>`
				})
				.join("")
			ui.playlistList.innerHTML = `<div class="sd-player-playlist-head">
				<span class="sd-player-playlist-number">#</span>
				<span class="sd-player-playlist-title">Title</span>
				<span class="sd-player-playlist-duration">Duration</span>
				<span class="sd-player-playlist-menu"></span>
			</div>${rows}`
		},

		normalizeTrack(item, group) {
			const title = String(
				item?.title ||
				item?.label ||
				item?.name ||
				item?.id ||
				"Untitled Track"
			)

			const origin = item.origin || group?.toLowerCase() || "media"
			const groupLabel =
				origin === "builtin"
					? "Built-in"
					: origin.charAt(0).toUpperCase() + origin.slice(1)

			return {
				...item,
				title,
				group: groupLabel,
				origin,
			}
		},

		async fetchPlaylist(ui, retryCount = 0) {
			try {
				const response = await $.post(window.ajaxurl, {
					action: "sd_player_get_playlist",
					nonce: window.sd_vars?.nonce || window.SystemDeckSecurity?.nonce,
					workspace_id: ui.playlist.closest("[data-workspace-id]")?.dataset.workspaceId || "default"
				})

				if (response.success) {
					const data = response.data || { items: [] }
					let playlist = []

					if (Array.isArray(data.items) && data.items.length > 0) {
						playlist = data.items.map((i) => this.normalizeTrack(i))
					} else {
						// Fallback to legacy structure or client-side builtins
						let builtins = []
						if (window.SystemDeckAudio?.getBuiltinTracks) {
							builtins = window.SystemDeckAudio.getBuiltinTracks()
						}

						playlist = [
							...builtins.map((i) => this.normalizeTrack(i, "Built-in")),
							...(data.vault || []).map((i) =>
								this.normalizeTrack(i, "Vault"),
							),
							...(data.media || []).map((i) =>
								this.normalizeTrack(i, "Media"),
							),
						]
					}

					if (playlist.length === 0) {
						console.warn("[SystemDeckPlayer] Empty playlist", {
							response,
						})
					}

					this.playlists.set(ui.playlist, playlist)
					requestAnimationFrame(() => {
						this.renderPlaylist(ui)
					})
					// survivors: ensure rendering persists after potential immediate hydration wipe
					requestAnimationFrame(() => {
						setTimeout(() => this.renderPlaylist(ui), 250)
					})
				}
			} catch (e) {
				console.error("Failed to fetch playlist", e)
			}
		},

		escapeHtml(value) {
			return $("<div>").text(String(value ?? "")).html()
		},

		renderPlaylist(ui) {
			if (!ui.playlist) return
			const playlist = this.playlists.get(ui.playlist) || []
			
			let html = `<option value="">-- Select Track --</option>`
			
			const groups = {
				'Built-in': [],
				'Vault': [],
				'Media': []
			}

			// Maintain original order but group visually
			playlist.forEach((item, index) => {
				const group = item.group || 'Media'
				if (groups[group]) {
					groups[group].push({ item, index })
				}
			})

			for (const [label, items] of Object.entries(groups)) {
				if (!items.length) continue
				html += `<optgroup label="${label}">`
				items.forEach(({ item, index }) => {
					const title = this.escapeHtml(item.title || item.label || item.name || item.id || "Untitled Track")
					html += `<option value="${index}">${title}</option>`
				})
				html += `</optgroup>`
			}

			ui.playlist.innerHTML = html
			this.renderPlaylistPane(ui, Number(ui.playlist.value))

			if (window.SYSTEMDECK_DEBUG_AUDIO) {
				console.log("[SystemDeckPlayer] rendered options", {
					select: ui.playlist,
					optionCount: ui.playlist.options.length,
					html: ui.playlist.innerHTML,
					visible: !!(ui.playlist.offsetWidth || ui.playlist.offsetHeight || ui.playlist.getClientRects().length),
					computedDisplay: window.getComputedStyle(ui.playlist).display,
					computedVisibility: window.getComputedStyle(ui.playlist).visibility,
				})
			}
		},

		async playSelected(ui) {
			const index = Number(ui.playlist.value)
			if (!Number.isInteger(index) || index < 0) return

			// 1. Dispatch Lock - prevent duplicate triggers
			if (this._playLock) return
			this._playLock = true

			const playlist = this.playlists.get(ui.playlist) || []

			if (ui.status) {
				ui.status.textContent = "Loading..."
				ui.status.className = "sd-status-badge is-low"
			}

			try {
				await window.SystemDeckAudio?.resume?.()
				if (window.SystemDeckPlayback) {
					window.SystemDeckPlayback.setPlaylist(playlist, index)
					await window.SystemDeckPlayback.playIndex(index)
				}
			} catch (e) {
				console.error("[SystemDeckPlayer] Playback failed", e)
				if (ui.status) {
					ui.status.textContent = "Error"
					ui.status.className = "sd-status-badge is-critical"
				}
			} finally {
				// Unlock after a small debounce
				setTimeout(() => { this._playLock = false }, 200)
			}
		},

		async uploadToVault(ui, file) {
			const formData = new FormData()
			formData.append("action", "sd_core_vault_ajax_upload_file")
			formData.append("_ajax_nonce", window.sd_vars?.nonce || window.SystemDeckSecurity?.nonce || "")
			formData.append("vault_file", file)
			formData.append("workspace_id", ui.playlist.closest("[data-workspace-id]")?.dataset.workspaceId || "default")
			formData.append("workspace_name", window.sd_vars?.active_workspace_title || "")
			formData.append("is_shared", "0")
			formData.append("priority", "low")

			try {
				const response = await $.ajax({
					url: window.ajaxurl,
					type: "POST",
					data: formData,
					processData: false,
					contentType: false
				})

				if (response.success && response.data) {
					console.log("[SystemDeckPlayer] Upload success, refreshing playlist", response.data)
					await this.fetchPlaylist(ui)
					
					const playlist = this.playlists.get(ui.playlist) || []
					const newId = String(response.data.id)
					
					// Find new item by ID or path signature in source
					const newIndex = playlist.findIndex(i => 
						String(i.id) === newId || 
						(i.source && String(i.source).includes(newId))
					)

					if (newIndex !== -1) {
						ui.playlist.value = newIndex
					} else {
						console.warn("[SystemDeckPlayer] New item not found in refreshed playlist", { newId, response: response.data })
					}
				} else {
					alert("Upload failed: " + (response.data?.error || "Unknown error"))
				}
			} catch (e) {
				console.error("Upload error", e)
			} finally {
				if (ui.fileInput) ui.fileInput.value = ""
			}
		},

		bindEvents(root, ui) {
			// Prevent duplicate local binding
			if (root.dataset.sdPlayerMounted === "1") return
			root.dataset.sdPlayerMounted = "1"

			const miniSurface = q(root, ".sd-player-now-card")
			if (miniSurface) {
				miniSurface._sdPlayerPlaySelected = () => this.playSelected(ui)
			}
			this.bindMiniPlayerSurface(miniSurface)
			
			ui.playlist?.addEventListener("change", async () => {
				await window.SystemDeckAudio?.resume?.()
				this.playSelected(ui)
			})

			ui.loadSelected?.addEventListener("click", async () => {
				await window.SystemDeckAudio?.resume?.()
				this.playSelected(ui)
			})

			ui.bass?.addEventListener("change", (e) => {
				window.SystemDeckPlayback?.setBassBoost(e.target.checked)
			})

			ui.eqPreset?.addEventListener("change", (e) => {
				const name = String(e.target.value || "Flat")
				if (name === "Custom") return
				const preset = EQ_PRESETS[name]
				if (!preset) return
				window.SystemDeckPlayback?.setEQ(preset)
				this.syncEQUI(ui, {
					...preset,
					preset: name,
					bassBoost: !!ui.bass?.checked,
					masterGain: Number(ui.eqMasterGain?.value || 1),
				})
			})

			const bindBand = (el, band) => {
				el?.addEventListener("input", (e) => {
					const value = Number(e.target.value || 0)
					window.SystemDeckPlayback?.updateEQBand?.(band, value)
					if (ui.eqPreset) ui.eqPreset.value = "Custom"
				})
			}
			bindBand(ui.eqBass, "bass")
			bindBand(ui.eqLowMid, "lowMid")
			bindBand(ui.eqMid, "mid")
			bindBand(ui.eqHighMid, "highMid")
			bindBand(ui.eqTreble, "treble")
			const freqBandMap = {
				"32": "bass",
				"64": "bass",
				"125": "lowMid",
				"250": "lowMid",
				"500": "mid",
				"1K": "mid",
				"2K": "highMid",
				"4K": "highMid",
				"8K": "treble",
				"16K": "treble",
			}
			;(ui.eqBands10 || []).forEach((el) => {
				el.addEventListener("input", (e) => {
					const freq = String(el?.dataset?.freq || "")
					const band = freqBandMap[freq]
					if (!band) return
					window.SystemDeckPlayback?.updateEQBand?.(
						band,
						Number(e.target.value || 0),
					)
					if (ui.eqPreset) ui.eqPreset.value = "Custom"
				})
			})
			ui.eqEnabled?.addEventListener("change", (e) => {
				if (e.target.checked) {
					const name = String(ui.eqPreset?.value || "Flat")
					const preset = EQ_PRESETS[name] || EQ_PRESETS.Flat
					window.SystemDeckPlayback?.setEQ(preset)
					return
				}
				window.SystemDeckPlayback?.setEQ(EQ_PRESETS.Flat)
			})

			;(ui.eqMasterGainAll || []).forEach((slider) => {
				slider.addEventListener("input", (e) => {
					window.SystemDeckPlayback?.setMasterGain?.(
						Number(e.target.value || 1),
					)
				})
			})
			ui.playlistList?.addEventListener("click", (e) => {
				const btn = e.target.closest("[data-index]")
				if (!btn) return
				const nextIndex = Number(btn.dataset.index || -1)
				if (!Number.isInteger(nextIndex) || nextIndex < 0) return
				if (ui.playlist) ui.playlist.value = String(nextIndex)
				this.playSelected(ui)
			})

			const resolveAdvancedBand = () =>
				String(ui.eqAdvancedBand?.value || "mid")
			ui.eqAdvancedFreq?.addEventListener("input", (e) => {
				window.SystemDeckAudio?.setBandFrequency?.(
					resolveAdvancedBand(),
					Number(e.target.value || 1000),
				)
			})
			ui.eqAdvancedQ?.addEventListener("input", (e) => {
				window.SystemDeckAudio?.setBandQ?.(
					resolveAdvancedBand(),
					Number(e.target.value || 1),
				)
			})

			const updateEQ = () => {
				const safeDb = (input) => {
					const raw = Number(input?.value ?? 100)
					if (!Number.isFinite(raw)) return 0
					// Map 0-200 to -20 to +20 dB
					return Math.max(-20, Math.min(20, (raw - 100) / 5))
				}

				if (window.SystemDeckPlayback) {
					window.SystemDeckPlayback.setEQ(
						safeDb(ui.mixBass),
						safeDb(ui.mixSynth),
						safeDb(ui.mixDrums)
					)
				}
			}

			ui.mixBass?.addEventListener("input", updateEQ)
			ui.mixSynth?.addEventListener("input", updateEQ)
			ui.mixDrums?.addEventListener("input", updateEQ)

			ui.uploadBtn?.addEventListener("click", () => ui.fileInput?.click())

			ui.fileInput?.addEventListener("change", (e) => {
				const file = e.target.files[0]
				if (!file) return
				this.uploadToVault(ui, file)
			})

			// Global listeners bound only once
			if (!this.globalEventsBound) {
				document.addEventListener("systemdeck:playback-state", (e) => {
					this.widgets.forEach(w => {
						this.states.set(w.ui.timeline, e.detail) // Store state for seek authority
						this.updateUI(w.ui, e.detail)
					})
				})

				document.addEventListener("systemdeck:playlist-state", (e) => {
					const { currentIndex, playlist } = e.detail
					this.widgets.forEach(w => {
						if (w.ui.playlist && playlist[currentIndex] !== undefined) {
							w.ui.playlist.value = currentIndex
							this.renderPlaylistPane(w.ui, currentIndex)
						}
					})
				})

				window.addEventListener("systemdeck:audio-player-request", (e) => {
					const { source, meta } = e.detail || {}
					window.SystemDeckPlayback?.play(source, meta)
				})

				window.addEventListener("systemdeck:eq-state", (e) => {
					const eqState = e.detail || {}
					this.widgets.forEach((w) => this.syncEQUI(w.ui, eqState))
				})

				this.globalEventsBound = true
			}
		},

		mount(root) {
			if (root.dataset.sdPlayerMounted === "1") return
			root.style.visibility = "hidden"
			root.removeAttribute("data-ready")
			try {
				this.ensureProEQPanel(root)
				const ui = this.cacheUI(root)
				this.widgets.set(root, { root, ui })
				this.bindEvents(root, ui)
				
				if (window.SystemDeckPlayback) {
					this.updateUI(ui, window.SystemDeckPlayback.getState())
				}
				if (window.SystemDeckAudio?.getEQState) {
					this.syncEQUI(ui, window.SystemDeckAudio.getEQState())
				}
				this.fetchPlaylist(ui)
				root.style.visibility = "visible"
				root.setAttribute("data-ready", "1")
			} catch (e) {
				console.error("[SystemDeckPlayer] mount failed", e)
				root.style.visibility = "hidden"
			}
		},

		refreshMountedWidgets() {
			// Skip processing if tab is backgrounded to save CPU
			if (document.hidden) return

			// 1. Cleanup detached widgets
			for (const [root, entry] of this.widgets.entries()) {
				if (!document.body.contains(root)) {
					this.widgets.delete(root)
					continue
				}

				// 2. Detect DOM reset (canvas hydration overwrite)
				const ui = entry.ui
				const playlist = this.playlists.get(ui.playlist) || []
				// Only re-render if it's actually reverted to "Loading" but we have data
				if (ui.playlist && ui.playlist.options.length <= 1 && playlist.length > 0) {
					this.renderPlaylist(ui)
				}
			}

			// 3. Mount new widgets only if not already tracked or marked
			document.querySelectorAll(".sd-player-root").forEach((r) => {
				if (!this.widgets.has(r) && r.dataset.sdPlayerMounted !== "1") {
					this.mount(r)
				}
			})
		},

		init() {
			this.globalEventsBound = false
			if (this.mountInterval) {
				clearInterval(this.mountInterval)
				this.mountInterval = null
			}
			this.refreshMountedWidgets()

			// Continuous scanner to survive canvas re-renders, throttled to 3s
			this.mountInterval = setInterval(() => {
				this.refreshMountedWidgets()
			}, 3000)
		}
	}

	$(function () {
		PlayerUI.init()
	})

})(jQuery)
