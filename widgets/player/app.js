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
	"use strict"

	if (window.SystemDeckPlayerBooted) return
	window.SystemDeckPlayerBooted = true

	console.log("[SystemDeckPlayer] app.js loaded")

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
		Flat: { name: "Flat", bands: { 32: 0, 64: 0, 125: 0, 250: 0, 500: 0, "1k": 0, "2k": 0, "4k": 0, "8k": 0, "16k": 0 } },
		"Bass Boost": { name: "Bass Boost", bands: { 32: 8, 64: 6, 125: 4, 250: 2, 500: 1, "1k": 0, "2k": -1, "4k": -2, "8k": -2, "16k": -1 } },
		"Bass Reducer": { name: "Bass Reducer", bands: { 32: -8, 64: -6, 125: -4, 250: -2, 500: -1, "1k": 0, "2k": 1, "4k": 2, "8k": 2, "16k": 1 } },
		Vocal: { name: "Vocal", bands: { 32: -4, 64: -3, 125: -2, 250: 0, 500: 2, "1k": 4, "2k": 5, "4k": 4, "8k": 2, "16k": 0 } },
		"Spoken Word": { name: "Spoken Word", bands: { 32: -8, 64: -6, 125: -4, 250: -2, 500: 2, "1k": 4, "2k": 5, "4k": 4, "8k": 2, "16k": 0 } },
		Acoustic: { name: "Acoustic", bands: { 32: -1, 64: 0, 125: 1, 250: 2, 500: 2, "1k": 1, "2k": 2, "4k": 2, "8k": 1, "16k": 0 } },
		Classical: { name: "Classical", bands: { 32: 0, 64: 0, 125: 1, 250: 2, 500: 1, "1k": 0, "2k": 1, "4k": 2, "8k": 3, "16k": 2 } },
		Piano: { name: "Piano", bands: { 32: -2, 64: -1, 125: 0, 250: 1, 500: 2, "1k": 3, "2k": 2, "4k": 1, "8k": 0, "16k": -1 } },
		Jazz: { name: "Jazz", bands: { 32: 2, 64: 1, 125: 1, 250: 0, 500: 1, "1k": 1, "2k": 2, "4k": 2, "8k": 1, "16k": 0 } },
		Blues: { name: "Blues", bands: { 32: 2, 64: 1, 125: 0, 250: 1, 500: 1, "1k": 2, "2k": 1, "4k": 0, "8k": -1, "16k": -1 } },
		Rock: { name: "Rock", bands: { 32: 3, 64: 2, 125: 1, 250: 0, 500: -1, "1k": 1, "2k": 3, "4k": 4, "8k": 3, "16k": 2 } },
		"Hard Rock": { name: "Hard Rock", bands: { 32: 4, 64: 3, 125: 2, 250: 0, 500: -2, "1k": 1, "2k": 4, "4k": 5, "8k": 4, "16k": 2 } },
		Metal: { name: "Metal", bands: { 32: 5, 64: 4, 125: 2, 250: -1, 500: -2, "1k": 0, "2k": 4, "4k": 5, "8k": 4, "16k": 2 } },
		Electronic: { name: "Electronic", bands: { 32: 4, 64: 3, 125: 1, 250: 0, 500: -1, "1k": 1, "2k": 2, "4k": 3, "8k": 4, "16k": 3 } },
		EDM: { name: "EDM", bands: { 32: 6, 64: 5, 125: 3, 250: 1, 500: -1, "1k": 0, "2k": 2, "4k": 4, "8k": 5, "16k": 4 } },
		"Hip Hop": { name: "Hip Hop", bands: { 32: 7, 64: 6, 125: 4, 250: 2, 500: 0, "1k": -1, "2k": 0, "4k": 1, "8k": 2, "16k": 2 } },
		Dance: { name: "Dance", bands: { 32: 5, 64: 4, 125: 2, 250: 1, 500: 0, "1k": 1, "2k": 2, "4k": 3, "8k": 4, "16k": 3 } },
		Pop: { name: "Pop", bands: { 32: 1, 64: 2, 125: 1, 250: 0, 500: 1, "1k": 2, "2k": 3, "4k": 3, "8k": 2, "16k": 1 } },
		"R&B": { name: "R&B", bands: { 32: 4, 64: 3, 125: 2, 250: 1, 500: 0, "1k": 1, "2k": 2, "4k": 2, "8k": 1, "16k": 0 } },
		Retro: { name: "Retro", bands: { 32: 3, 64: 2, 125: 1, 250: 0, 500: -1, "1k": -2, "2k": -3, "4k": -3, "8k": -2, "16k": -1 } },
		Warm: { name: "Warm", bands: { 32: 2, 64: 3, 125: 2, 250: 1, 500: 1, "1k": 0, "2k": -1, "4k": -2, "8k": -2, "16k": -1 } },
		Bright: { name: "Bright", bands: { 32: -2, 64: -2, 125: -1, 250: 0, 500: 1, "1k": 2, "2k": 3, "4k": 4, "8k": 5, "16k": 4 } },
		Loudness: { name: "Loudness", bands: { 32: 4, 64: 3, 125: 2, 250: 1, 500: 0, "1k": 0, "2k": 1, "4k": 2, "8k": 3, "16k": 4 } },
		"Late Night": { name: "Late Night", bands: { 32: -2, 64: -1, 125: 0, 250: 1, 500: 2, "1k": 2, "2k": 1, "4k": 0, "8k": -1, "16k": -2 } },
		"Car Stereo": { name: "Car Stereo", bands: { 32: 5, 64: 4, 125: 2, 250: 0, 500: -1, "1k": 0, "2k": 2, "4k": 3, "8k": 4, "16k": 3 } },
		"Small Speakers": { name: "Small Speakers", bands: { 32: -8, 64: -6, 125: -3, 250: 0, 500: 2, "1k": 3, "2k": 4, "4k": 4, "8k": 3, "16k": 2 } },
	}

	const PlayerUI = {
		widgets: new Map(),
		playlists: new WeakMap(),
		states: new WeakMap(), // Cache current state per widget for seek authority
		autoplayEnabled: false,
		repeatTrackEnabled: false,
		_lastPlaybackStatus: "idle",
		_lastHandledTrackEndKey: "",

		cacheUI(root) {
			return {
				play: q(root, '[data-action="play"]'),
				playSelected: q(root, '[data-action="play-selected"]'),
				loadSelected: q(root, '[data-action="load-selected"]'),
				playSelectedButtons: Array.from(
					root.querySelectorAll('[data-action="play-selected"]'),
				),
				pause: q(root, '[data-action="pause"]'),
				stop: q(root, '[data-action="stop"]'),
				prev: q(root, '[data-action="prev"]'),
				next: q(root, '[data-action="next"]'),
				uploadBtn: q(root, '[data-action="upload-vault"]'),

				volume: q(
					root,
					'[data-control="volume"], [data-role="volume"]',
				),
				bass: q(
					root,
					'[data-control="bass"], [data-role="bass-boost"], [data-role-secondary="bass-boost"]',
				),
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
				eqMasterGainAll: Array.from(
					root.querySelectorAll('[data-role="eq-master-gain"]'),
				),
				eqMasterValueAll: Array.from(
					root.querySelectorAll('[data-role="eq-master-value"]'),
				),
				eqAdvancedBand: q(root, '[data-role="eq-advanced-band"]'),
				eqAdvancedFreq: q(root, '[data-role="eq-advanced-frequency"]'),
				eqAdvancedQ: q(root, '[data-role="eq-advanced-q"]'),
				eqEnabled: q(root, '[data-role="eq-enabled"]'),
				eqBassBoostVisual: q(
					root,
					'[data-role="eq-bass-boost-visual"]',
				),
				eqBands10: Array.from(
					root.querySelectorAll('[data-role="eq-band"]'),
				),
				metaTrack: q(root, '[data-role="meta-track"]'),
				metaCodec: q(root, '[data-role="meta-codec"]'),
				metaType: q(root, '[data-role="meta-type"]'),
				artwork: q(root, '[data-role="artwork"]'),
				visualizer: q(root, '[data-role="visualizer"]'),
				visualizerBars: q(root, ".sd-player-visualizer-bars"),

				timeline: q(root, "[data-timeline], [data-role='seek']"),
				time: q(root, "[data-time]"),
				duration: q(root, "[data-duration]"),
				nowCodec: q(root, '[data-role="now-codec"]'),

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

		renderMiniPlayerSurface(options = {}) {
			const config = {
				showTrackSelect: options.showTrackSelect !== false,
				showUpload: options.showUpload !== false,
				showBassBoost: options.showBassBoost !== false,
				compact: !!options.compact,
			}
			const tpl = document.createElement("template")
			tpl.innerHTML = `<section class="sd-player-card sd-player-now-card${
				config.compact ? " sd-mini-compact" : ""
			}">
				<div class="sd-player-now-card-content">
					<div class="sd-player-artwork" data-role="artwork"><div class="sd-player-artwork-placeholder"><span class="dashicons dashicons-format-audio"></span></div></div>
					<div class="sd-player-now-main">
						<div class="sd-player-now-header">
							<div>
								<div class="sd-player-track-title" data-role="now-playing">No source loaded.</div>
								<div class="sd-player-now-meta-line"><div class="sd-status-badge is-low" data-role="status">IDLE</div><span class="sd-player-codec" data-role="now-codec" hidden></span></div>
							</div>
							<div class="sd-player-track-time"><span data-time>0:00</span><span>/</span><span data-duration>0:00</span></div>
						</div>
						<div class="sd-player-visualizer" data-role="visualizer"><div class="sd-player-visualizer-bars"></div></div>
					</div>
				</div>
				<div class="sd-player-seek-row"><input type="range" min="0" max="1" step="0.001" value="0" data-role="seek" data-timeline></div>
				<div class="sd-player-bottom-controls">
					<div class="sd-player-volume-stack">
						<div class="sd-player-volume"><button type="button" class="sd-player-volume-toggle" data-role="volume-toggle" aria-label="Mute" title="Mute"><span class="dashicons dashicons-controls-volumeon sd-button-icon" data-role="volume-icon"></span></button><input type="range" min="0" max="1" step="0.01" value="0.45" data-role="volume" data-control="volume"></div>
						${
							config.showBassBoost
								? `<label class="sd-player-check sd-player-bass-inline"><input type="checkbox" data-role="eq-bass-boost-visual" data-role-secondary="bass-boost"><span>Bass Boost</span></label>`
								: ""
						}
					</div>
					<div class="sd-player-controls-right">
						<div class="sd-player-transport">
							<button type="button" class="button button-small" data-action="prev" aria-label="Previous" title="Previous"><span class="dashicons dashicons-controls-back sd-button-icon"></span><span class="screen-reader-text">Previous</span></button>
							<button type="button" class="button button-small button-primary" data-action="play-selected" data-role="transport-main" aria-label="Play" title="Play"><span class="dashicons dashicons-controls-play sd-button-icon"></span><span class="screen-reader-text">Play</span></button>
							<button type="button" class="button button-small" data-action="pause" aria-label="Pause" title="Pause"><span class="dashicons dashicons-controls-pause sd-button-icon"></span><span class="screen-reader-text">Pause</span></button>
							<button type="button" class="button button-small" data-action="next" aria-label="Next" title="Next"><span class="dashicons dashicons-controls-forward sd-button-icon"></span><span class="screen-reader-text">Next</span></button>
							<button type="button" class="button button-small" data-action="autoplay" aria-label="Autoplay" title="Autoplay" aria-pressed="false"><span class="dashicons dashicons-image-rotate sd-button-icon"></span><span class="screen-reader-text">Autoplay</span></button>
							<button type="button" class="button button-small" data-action="repeat-track" aria-label="Repeat Track" title="Repeat Track" aria-pressed="false"><span class="dashicons dashicons-controls-repeat sd-button-icon"></span><span class="screen-reader-text">Repeat Track</span></button>
						</div>
					</div>
				</div>
				${
					config.showTrackSelect
						? `<div class="sd-player-track-row"><div class="sd-player-preset-inline"><label><span class="screen-reader-text">EQ Presets</span><select data-role="eq-preset"><option>Flat</option><option>Bass Boost</option><option>Bass Reducer</option><option>Vocal</option><option>Spoken Word</option><option>Acoustic</option><option>Classical</option><option>Piano</option><option>Jazz</option><option>Blues</option><option>Rock</option><option>Hard Rock</option><option>Metal</option><option>Electronic</option><option>EDM</option><option>Hip Hop</option><option>Dance</option><option>Pop</option><option>R&B</option><option>Retro</option><option>Warm</option><option>Bright</option><option>Loudness</option><option>Late Night</option><option>Car Stereo</option><option>Small Speakers</option><option>Custom</option></select></label></div><div class="sd-player-load-block sd-player-load-inline"><label><span class="screen-reader-text">Track</span><select data-role="playlist" class="sd-player-playlist-select"><option value="">-- Select Track --</option></select></label><div class="sd-player-load-actions">${
								config.showUpload
									? `<button type="button" class="button" data-action="upload-vault">Upload</button>`
									: ""
						  }</div><input type="file" data-role="file-input" hidden></div></div>`
						: ""
				}
			</section>`
			return tpl.content.firstElementChild
		},

		createVisualizerBars(container, count = 48) {
			if (!container) return []
			const barCount = Math.max(16, Math.min(64, Number(count) || 48))
			container.innerHTML = ""
			const bars = []
			for (let i = 0; i < barCount; i++) {
				const bar = document.createElement("div")
				bar.className = "sd-player-bar"
				container.appendChild(bar)
				bars.push(bar)
			}
			return bars
		},

		startVisualizerLoop(surfaceRoot) {
			if (!surfaceRoot || surfaceRoot._sdVisualizerLoop) return
			const barsContainer = surfaceRoot.querySelector(
				".sd-player-visualizer-bars",
			)
			if (!barsContainer) return
			const compact = surfaceRoot.classList.contains("sd-mini-compact")
			const targetCount = compact ? 32 : 48
			const bars = this.createVisualizerBars(barsContainer, targetCount)
			if (!bars.length) return
			let rafId = null
			const render = () => {
				const state = window.SystemDeckPlayback?.getState?.() || {}
				const status = String(state.status || "idle").toLowerCase()
				const frame = window.SystemDeckAudio?.getVisualizerFrame?.(
					bars.length,
				) || new Array(bars.length).fill(0)
				bars.forEach((bar, i) => {
					const n = Math.max(0, Math.min(1, Number(frame[i] || 0)))
					const h = Math.max(8, Math.round(8 + n * 30))
					bar.style.height = `${h}px`
					bar.classList.toggle(
						"is-active",
						status === "playing" || status === "loading",
					)
				})
				rafId = window.requestAnimationFrame(render)
			}
			rafId = window.requestAnimationFrame(render)
			surfaceRoot._sdVisualizerLoop = () => {
				if (rafId) window.cancelAnimationFrame(rafId)
				rafId = null
			}
		},

		syncMiniPlayerSurface(surfaceRoot, state) {
			if (!surfaceRoot || !state) return
			const ui = this.cacheUI(surfaceRoot)
			const duration = Number(state.duration || 0)
			const currentTime = Number(state.currentTime || 0)
			const progress = Number.isFinite(Number(state.progress))
				? clamp(state.progress, 0, 1)
				: duration > 0
				? clamp(currentTime / duration, 0, 1)
				: 0
			const normalizedStatus = String(
				state.status || "stopped",
			).toLowerCase()
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
					ui.artwork.innerHTML = `<img src="${this.escapeHtml(
						normalizedArtwork,
					)}" alt="">`
				} else {
					const existingImg = existingImage
					if (existingImg) {
						existingImg.removeAttribute("src")
						existingImg.remove()
					}
					if (
						!ui.artwork.querySelector(
							".sd-player-artwork-placeholder",
						)
					) {
						ui.artwork.innerHTML = `<div class="sd-player-artwork-placeholder"><span class="dashicons dashicons-format-audio"></span></div>`
					}
				}
			}
			if (ui.visualizer)
				ui.visualizer.classList.toggle(
					"is-playing",
					normalizedStatus === "playing" ||
						normalizedStatus === "loading",
				)
			if (ui.time) ui.time.textContent = formatTime(currentTime)
			if (ui.duration) ui.duration.textContent = formatTime(duration)
			const codecMime = String(state.metadata?.mime || "").trim()
			const codecRate = String(
				state.metadata?.bitrate || state.metadata?.bit_rate || "",
			).trim()
			if (ui.nowCodec) {
				const codecText = [codecMime, codecRate].filter(Boolean).join(" / ")
				if (codecText) {
					ui.nowCodec.textContent = codecText.toUpperCase()
					ui.nowCodec.hidden = false
				} else {
					ui.nowCodec.textContent = ""
					ui.nowCodec.hidden = true
				}
			}
			const transportMain = surfaceRoot.querySelector(
				'[data-role="transport-main"]',
			)
			if (transportMain) {
				const actionLabel =
					normalizedStatus === "playing" ||
					normalizedStatus === "loading"
						? "Stop"
						: "Play"
				transportMain.setAttribute("aria-label", actionLabel)
				transportMain.setAttribute("title", actionLabel)
			}
			const volumeInput = surfaceRoot.querySelector(
				'[data-control="volume"], [data-role="volume"]',
			)
			const volumeIcon = surfaceRoot.querySelector(
				'[data-role="volume-icon"]',
			)
			const volumeToggle = surfaceRoot.querySelector(
				'[data-role="volume-toggle"]',
			)
			if (volumeIcon && volumeToggle) {
				const level = Number(volumeInput?.value || 0)
				const muted = level <= 0.0001
				volumeIcon.classList.toggle(
					"dashicons-controls-volumeoff",
					muted,
				)
				volumeIcon.classList.toggle(
					"dashicons-controls-volumeon",
					!muted,
				)
				volumeToggle.setAttribute(
					"aria-label",
					muted ? "Unmute" : "Mute",
				)
				volumeToggle.setAttribute("title", muted ? "Unmute" : "Mute")
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
			const pauseBtn = surfaceRoot.querySelector('[data-action="pause"]')
			const stopBtn = surfaceRoot.querySelector('[data-action="stop"]')
			const prevBtn = surfaceRoot.querySelector('[data-action="prev"]')
			const nextBtn = surfaceRoot.querySelector('[data-action="next"]')
			const autoplayBtn = surfaceRoot.querySelector(
				'[data-action="autoplay"]',
			)
			const repeatTrackBtn = surfaceRoot.querySelector(
				'[data-action="repeat-track"]',
			)
			const volumeInput = surfaceRoot.querySelector(
				'[data-control="volume"], [data-role="volume"]',
			)
			const volumeToggle = surfaceRoot.querySelector(
				'[data-role="volume-toggle"]',
			)
			const timelineInput = surfaceRoot.querySelector(
				"[data-timeline], [data-role='seek']",
			)
			const playSelectedBtns = Array.from(
				surfaceRoot.querySelectorAll('[data-action="play-selected"]'),
			)
			this.startVisualizerLoop(surfaceRoot)

			ui.play?.addEventListener("click", async () => {
				const state = window.SystemDeckPlayback?.getState?.()
				if (!state || state.status === "idle") {
					alert("Load a track first")
					return
				}
				window.SystemDeckPlayback?.resume?.()
			})
			playSelectedBtns.forEach((btn) => {
				if (btn.dataset.sdMiniBound === "1") return
				btn.dataset.sdMiniBound = "1"
				btn.addEventListener("click", () => {
					const playbackState =
						window.SystemDeckPlayback?.getState?.() || {}
					const status = String(
						playbackState?.status || "",
					).toLowerCase()
					if (btn.dataset.role === "transport-main") {
						if (status === "playing" || status === "loading") {
							window.SystemDeckPlayback?.stop?.()
							return
						}
					}
					if (status === "paused") {
						window.SystemDeckPlayback?.resume?.()
						return
					}
					if (
						typeof surfaceRoot._sdPlayerPlaySelected === "function"
					) {
						surfaceRoot._sdPlayerPlaySelected()
						return
					}
					window.SystemDeckPlayback?.resume?.()
				})
			})
			if (pauseBtn && pauseBtn.dataset.sdMiniBound !== "1") {
				pauseBtn.dataset.sdMiniBound = "1"
				pauseBtn.addEventListener("click", () =>
					window.SystemDeckPlayback?.pause?.(),
				)
			}
			if (stopBtn && stopBtn.dataset.sdMiniBound !== "1") {
				stopBtn.dataset.sdMiniBound = "1"
				stopBtn.addEventListener("click", () =>
					window.SystemDeckPlayback?.stop?.(),
				)
			}
			if (prevBtn && prevBtn.dataset.sdMiniBound !== "1") {
				prevBtn.dataset.sdMiniBound = "1"
				prevBtn.addEventListener("click", () =>
					window.SystemDeckPlayback?.previous?.(),
				)
			}
			if (nextBtn && nextBtn.dataset.sdMiniBound !== "1") {
				nextBtn.dataset.sdMiniBound = "1"
				nextBtn.addEventListener("click", () =>
					window.SystemDeckPlayback?.next?.(),
				)
			}
			if (autoplayBtn && autoplayBtn.dataset.sdMiniBound !== "1") {
				autoplayBtn.dataset.sdMiniBound = "1"
				autoplayBtn.addEventListener("click", () => {
					this.autoplayEnabled = !this.autoplayEnabled
					this.syncTransportModeUI()
				})
			}
			if (
				repeatTrackBtn &&
				repeatTrackBtn.dataset.sdMiniBound !== "1"
			) {
				repeatTrackBtn.dataset.sdMiniBound = "1"
				repeatTrackBtn.addEventListener("click", () => {
					this.repeatTrackEnabled = !this.repeatTrackEnabled
					this.syncTransportModeUI()
				})
			}
			volumeInput?.addEventListener("input", (e) => {
				window.SystemDeckPlayback?.setVolume?.(e.target.value)
			})
			if (volumeToggle && volumeInput) {
				volumeToggle.addEventListener("click", () => {
					const current = Number(volumeInput.value || 0)
					const previous = Number(
						volumeInput.dataset.previousVolume || "0.45",
					)
					if (current > 0.0001) {
						volumeInput.dataset.previousVolume = String(current)
						volumeInput.value = "0"
						window.SystemDeckPlayback?.setVolume?.(0)
					} else {
						const nextLevel = previous > 0.0001 ? previous : 0.45
						volumeInput.value = String(nextLevel)
						window.SystemDeckPlayback?.setVolume?.(nextLevel)
					}
				})
			}
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
				delete timelineInput?.dataset.dragging
			}
			const seekFromSlider = () => {
				const ratio = Number(timelineInput?.value || 0)
				seekToRatio(ratio)
			}
			timelineInput?.addEventListener("input", (e) => {
				surfaceRoot.dataset.sdMiniSeeking = "1"
				timelineInput.dataset.dragging = "true"
			})
			timelineInput?.addEventListener("change", (e) => {
				seekFromSlider()
				releaseSeek()
			})
			timelineInput?.addEventListener("pointerdown", (e) => {
				surfaceRoot.dataset.sdMiniSeeking = "1"
			})
			timelineInput?.addEventListener("pointerup", () => {
				releaseSeek()
			})
			timelineInput?.addEventListener("pointercancel", releaseSeek)
			timelineInput?.addEventListener("mouseup", releaseSeek)
			timelineInput?.addEventListener("touchend", releaseSeek)
			timelineInput?.addEventListener("keyup", releaseSeek)
			timelineInput?.addEventListener("blur", releaseSeek)
			this.syncTransportModeUI()
		},

		syncTransportModeUI() {
			this.widgets.forEach(({ root }) => {
				const autoplayBtn = root.querySelector(
					'[data-action="autoplay"]',
				)
				const repeatTrackBtn = root.querySelector(
					'[data-action="repeat-track"]',
				)
				if (autoplayBtn) {
					autoplayBtn.classList.toggle(
						"is-active",
						!!this.autoplayEnabled,
					)
					autoplayBtn.setAttribute(
						"aria-pressed",
						this.autoplayEnabled ? "true" : "false",
					)
				}
				if (repeatTrackBtn) {
					repeatTrackBtn.classList.toggle(
						"is-active",
						!!this.repeatTrackEnabled,
					)
					repeatTrackBtn.setAttribute(
						"aria-pressed",
						this.repeatTrackEnabled ? "true" : "false",
					)
				}
			})
		},

		handleTrackEnded(detail = {}) {
			const state = window.SystemDeckPlayback?.getState?.() || {}
			const playlist = Array.isArray(state?.playlist) ? state.playlist : []
			const currentIndex = Number(state?.currentIndex)
			const endKey = String(
				detail?.playbackId ??
					`${detail?.mode || state?.mode || "unknown"}:${currentIndex}`,
			)
			if (this._lastHandledTrackEndKey === endKey) return
			this._lastHandledTrackEndKey = endKey

			if (this.repeatTrackEnabled && currentIndex >= 0 && playlist[currentIndex]) {
				window.SystemDeckPlayback?.playIndex?.(currentIndex)
				return
			}

			if (!this.autoplayEnabled) return
			if (currentIndex < 0 || !playlist.length) return
			for (let i = currentIndex + 1; i < playlist.length; i += 1) {
				const nextItem = playlist[i]
				if (!nextItem) continue
				const source = String(
					nextItem.source ||
						nextItem.url ||
						nextItem.stream_url ||
						nextItem.id ||
						"",
				)
				if (!source) continue
				window.SystemDeckPlayback?.playIndex?.(i)
				return
			}
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
					(state.status === "loading"
						? "Loading..."
						: "No source loaded."),
				status: String(state.status || "stopped").toLowerCase(),
				currentTime: Number(state.currentTime || 0),
				duration: Number(state.duration || 0),
				progress:
					Number(state.duration || 0) > 0
						? clamp(
								Number(state.currentTime || 0) /
									Number(state.duration || 0),
								0,
								1,
						  )
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
				ui.metaTrack.textContent =
					state.title || state.metadata?.title || "-"
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

			// 1. Control Button States
			if (ui.play) ui.play.disabled = !hasTrack
			if (ui.pause) ui.pause.disabled = status !== "playing"
			if (ui.stop)
				ui.stop.disabled =
					(status === "idle" || status === "stopped") && !hasTrack

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
					<section class="sd-player-card sd-player-eq-card">
						<header class="sd-player-card-title">EQUALIZER</header>
						<div class="sd-player-eq-preamp-row"><label><span>Preamp</span><input type="range" min="0" max="2" step="0.01" value="1" data-role="eq-master-gain"></label></div><div class="sd-player-eq-board"><div class="sd-player-db-scale"><span>+12 dB</span><span>0 dB</span><span>-12 dB</span></div><div class="sd-player-eq-scroll"><div class="sd-player-eq-grid"><div class="sd-player-eq-guide sd-player-eq-guide-top"></div><div class="sd-player-eq-guide sd-player-eq-guide-mid"></div><div class="sd-player-eq-guide sd-player-eq-guide-bottom"></div>${[
							"32",
							"64",
							"125",
							"250",
							"500",
							"1K",
							"2K",
							"4K",
							"8K",
							"16K",
						]
							.map(
								(hz) =>
									`<label class="sd-player-eq-band"><div class="sd-player-eq-lane"><span class="sd-player-eq-rail" aria-hidden="true"></span><input type="range" min="-12" max="12" step="1" value="0" data-role="eq-band" data-freq="${hz}"></div><span>${hz}</span></label>`,
							)
							.join("")}</div></div></div>
						<details class="sd-player-advanced-eq"><summary>Advanced EQ</summary><div class="sd-player-advanced-eq-grid"><label><span>Band</span><select data-role="eq-advanced-band"><option value="32">32 Hz</option><option value="64">64 Hz</option><option value="125">125 Hz</option><option value="250">250 Hz</option><option value="500">500 Hz</option><option value="1k">1 KHz</option><option value="2k">2 KHz</option><option value="4k">4 KHz</option><option value="8k">8 KHz</option><option value="16k">16 KHz</option></select></label><label><span>Frequency</span><input type="range" min="20" max="20000" step="1" value="1000" data-role="eq-advanced-frequency"></label><label><span>Q</span><input type="range" min="0.1" max="24" step="0.1" value="1" data-role="eq-advanced-q"></label></div></details>
					</section>
					<div class="sd-player-error" data-role="error" hidden></div>
				</div>`,
			)
			const shell = q(root, ".sd-player-shell.sd-player-v2")
			const slot = q(shell, "[data-mini-surface-slot]")
			const mini = this.renderMiniPlayerSurface({
				showTrackSelect: true,
				showUpload: true,
				showBassBoost: true,
				compact: false,
			})
			slot?.replaceWith(mini)
		},

		syncEQUI(ui, eqState = {}) {
			const bands = eqState.bands || {}
			const advanced = eqState.advanced || {}
			const setValue = (el, v) => {
				if (!el) return
				el.value = String(Math.round(Number(v) || 0))
			}
			const band32 = Number(bands["32"] ?? 0)
			const band64 = Number(bands["64"] ?? 0)
			const band125 = Number(bands["125"] ?? 0)
			const band250 = Number(bands["250"] ?? 0)
			const band500 = Number(bands["500"] ?? 0)
			const band1k = Number(bands["1k"] ?? bands["1K"] ?? 0)
			const band2k = Number(bands["2k"] ?? bands["2K"] ?? 0)
			const band4k = Number(bands["4k"] ?? bands["4K"] ?? 0)
			const band8k = Number(bands["8k"] ?? bands["8K"] ?? 0)
			const band16k = Number(bands["16k"] ?? bands["16K"] ?? 0)
			setValue(ui.eqBass, band32)
			setValue(ui.eqLowMid, band250)
			setValue(ui.eqMid, band1k)
			setValue(ui.eqHighMid, band4k)
			setValue(ui.eqTreble, band16k)
			const mapFreq = {
				32: band32,
				64: band64,
				125: band125,
				250: band250,
				500: band500,
				"1K": band1k,
				"2K": band2k,
				"4K": band4k,
				"8K": band8k,
				"16K": band16k,
			}
			;(ui.eqBands10 || []).forEach((el) => {
				const freq = String(el?.dataset?.freq || "")
				if (Object.prototype.hasOwnProperty.call(mapFreq, freq)) {
					setValue(el, mapFreq[freq])
				}
			})
			if (
				ui.eqMasterGainAll?.length &&
				Number.isFinite(Number(eqState.masterGain))
			) {
				ui.eqMasterGainAll.forEach((el) => {
					el.value = String(Number(eqState.masterGain))
				})
			}
			if (
				ui.eqMasterValueAll?.length &&
				Number.isFinite(Number(eqState.masterGain))
			) {
				const db = (Math.max(0, Number(eqState.masterGain)) - 1) * 12
				ui.eqMasterValueAll.forEach((el) => {
					el.textContent = `${db.toFixed(1)} dB`
				})
			}
			if (ui.bass && typeof eqState.bassBoost === "boolean") {
				ui.bass.checked = !!eqState.bassBoost
			}
			if (
				ui.eqBassBoostVisual &&
				typeof eqState.bassBoost === "boolean"
			) {
				ui.eqBassBoostVisual.checked = !!eqState.bassBoost
			}
			if (ui.eqEnabled) {
				ui.eqEnabled.checked =
					String(eqState.preset || "Flat") !== "Flat"
			}
			if (ui.eqPreset) {
				const preset = String(eqState.preset || "Custom")
				ui.eqPreset.value = EQ_PRESETS[preset] ? preset : "Custom"
			}
			const selectedAdvancedBand = String(
				ui.eqAdvancedBand?.value || "1k",
			)
			const advancedBandState =
				advanced[selectedAdvancedBand] || advanced["1k"] || null
			if (advancedBandState) {
				if (ui.eqAdvancedFreq) {
					ui.eqAdvancedFreq.value = String(
						Number(advancedBandState.frequency || 1000),
					)
				}
				if (ui.eqAdvancedQ) {
					ui.eqAdvancedQ.value = String(
						Number(advancedBandState.q || 1),
					)
				}
			}
		},

		normalizeTrack(item, group) {
			const title = String(
				item?.title ||
					item?.label ||
					item?.name ||
					item?.id ||
					"Untitled Track",
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
					nonce:
						window.sd_vars?.nonce ||
						window.SystemDeckSecurity?.nonce,
					workspace_id:
						ui.playlist.closest("[data-workspace-id]")?.dataset
							.workspaceId || "default",
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
							...builtins.map((i) =>
								this.normalizeTrack(i, "Built-in"),
							),
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
			return $("<div>")
				.text(String(value ?? ""))
				.html()
		},

		renderPlaylist(ui) {
			if (!ui.playlist) return
			const playlist = this.playlists.get(ui.playlist) || []

			let html = `<option value="">-- Select Track --</option>`

			const groups = {
				"Built-in": [],
				Vault: [],
				Media: [],
			}

			// Maintain original order but group visually
			playlist.forEach((item, index) => {
				const group = item.group || "Media"
				if (groups[group]) {
					groups[group].push({ item, index })
				}
			})

			for (const [label, items] of Object.entries(groups)) {
				if (!items.length) continue
				html += `<optgroup label="${label}">`
				items.forEach(({ item, index }) => {
					const title = this.escapeHtml(
						item.title ||
							item.label ||
							item.name ||
							item.id ||
							"Untitled Track",
					)
					html += `<option value="${index}">${title}</option>`
				})
				html += `</optgroup>`
			}

			ui.playlist.innerHTML = html

			if (window.SYSTEMDECK_DEBUG_AUDIO) {
				console.log("[SystemDeckPlayer] rendered options", {
					select: ui.playlist,
					optionCount: ui.playlist.options.length,
					html: ui.playlist.innerHTML,
					visible: !!(
						ui.playlist.offsetWidth ||
						ui.playlist.offsetHeight ||
						ui.playlist.getClientRects().length
					),
					computedDisplay: window.getComputedStyle(ui.playlist)
						.display,
					computedVisibility: window.getComputedStyle(ui.playlist)
						.visibility,
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
				setTimeout(() => {
					this._playLock = false
				}, 200)
			}
		},

		async uploadToVault(ui, file) {
			const formData = new FormData()
			formData.append("action", "sd_core_vault_ajax_upload_file")
			formData.append(
				"_ajax_nonce",
				window.sd_vars?.nonce || window.SystemDeckSecurity?.nonce || "",
			)
			formData.append("vault_file", file)
			formData.append(
				"workspace_id",
				ui.playlist.closest("[data-workspace-id]")?.dataset
					.workspaceId || "default",
			)
			formData.append(
				"workspace_name",
				window.sd_vars?.active_workspace_title || "",
			)
			formData.append("is_shared", "0")
			formData.append("priority", "low")

			try {
				const response = await $.ajax({
					url: window.ajaxurl,
					type: "POST",
					data: formData,
					processData: false,
					contentType: false,
				})

				if (response.success && response.data) {
					console.log(
						"[SystemDeckPlayer] Upload success, refreshing playlist",
						response.data,
					)
					await this.fetchPlaylist(ui)

					const playlist = this.playlists.get(ui.playlist) || []
					const newId = String(response.data.id)

					// Find new item by ID or path signature in source
					const newIndex = playlist.findIndex(
						(i) =>
							String(i.id) === newId ||
							(i.source && String(i.source).includes(newId)),
					)

					if (newIndex !== -1) {
						ui.playlist.value = newIndex
						const uploadedItem = playlist[newIndex] || {}
						const sourceUrl = String(
							uploadedItem.source ||
								uploadedItem.url ||
								response.data.stream_url ||
								response.data.url ||
								"",
						)
						if (sourceUrl) {
							const detectedMime = String(
								uploadedItem.mime ||
									response.data.mime ||
									file.type ||
									"",
							).toLowerCase()
							const detectedName = String(
								uploadedItem.title ||
									uploadedItem.filename ||
									response.data.title ||
									file.name ||
									"",
							).toLowerCase()
							const isMidi =
								detectedMime.includes("midi") ||
								detectedName.endsWith(".mid") ||
								detectedName.endsWith(".midi")
							await window.SystemDeckAudio?.resume?.()
							document.dispatchEvent(
								new CustomEvent("systemdeck:vault-play", {
									detail: {
										url: sourceUrl,
										meta: {
											id: String(
												uploadedItem.id ||
													response.data.id ||
													"",
											),
											title:
												uploadedItem.title ||
												uploadedItem.filename ||
												response.data.title ||
												file.name ||
												"Uploaded Media",
											mime:
												uploadedItem.mime ||
												response.data.mime ||
												file.type ||
												"",
											origin:
												uploadedItem.origin ||
												"vault-media",
											mediaType: isMidi
												? "midi"
												: "file",
											midiDerivative:
												uploadedItem.midi_derivative ||
												response.data
													.midi_derivative ||
												null,
										},
									},
								}),
							)
						} else {
							await this.playSelected(ui)
						}
					} else {
						console.warn(
							"[SystemDeckPlayer] New item not found in refreshed playlist",
							{ newId, response: response.data },
						)
					}
				} else {
					alert(
						"Upload failed: " +
							(response.data?.error || "Unknown error"),
					)
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
				const selectedValue = String(ui.playlist.value ?? "")
				if (ui.playlist.dataset.sdLastAutoPlay === selectedValue) return
				ui.playlist.dataset.sdLastAutoPlay = selectedValue
				await window.SystemDeckAudio?.resume?.()
				this.playSelected(ui)
			})

			const onBassBoostChange = (checked) => {
				const next = !!checked
				if (ui.bass && ui.bass.checked !== next) ui.bass.checked = next
				if (
					ui.eqBassBoostVisual &&
					ui.eqBassBoostVisual.checked !== next
				) {
					ui.eqBassBoostVisual.checked = next
				}
				window.SystemDeckPlayback?.setBassBoost(next)
			}
			ui.bass?.addEventListener("change", (e) => {
				onBassBoostChange(e.target.checked)
			})
			if (ui.eqBassBoostVisual && ui.eqBassBoostVisual !== ui.bass) {
				ui.eqBassBoostVisual.addEventListener("change", (e) => {
					onBassBoostChange(e.target.checked)
				})
			}

			ui.eqPreset?.addEventListener("change", (e) => {
				const name = String(e.target.value || "Flat")
				if (name === "Custom") return
				const preset = EQ_PRESETS[name]
				if (!preset) return
				window.SystemDeckPlayback?.setEQ(preset)
				const liveState = window.SystemDeckAudio?.getEQState?.()
				if (liveState) {
					this.syncEQUI(ui, liveState)
				}
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
				32: "32",
				64: "64",
				125: "125",
				250: "250",
				500: "500",
				"1K": "1k",
				"2K": "2k",
				"4K": "4k",
				"8K": "8k",
				"16K": "16k",
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
			const resolveAdvancedBand = () =>
				String(ui.eqAdvancedBand?.value || "1k")
			const syncAdvancedControlsForBand = () => {
				const eqState = window.SystemDeckAudio?.getEQState?.() || {}
				const advanced = eqState.advanced || {}
				const bandState =
					advanced[resolveAdvancedBand()] || advanced["1k"] || null
				if (!bandState) return
				if (ui.eqAdvancedFreq) {
					ui.eqAdvancedFreq.value = String(
						Number(bandState.frequency || 1000),
					)
				}
				if (ui.eqAdvancedQ) {
					ui.eqAdvancedQ.value = String(Number(bandState.q || 1))
				}
			}
			ui.eqAdvancedBand?.addEventListener(
				"change",
				syncAdvancedControlsForBand,
			)
			ui.eqAdvancedFreq?.addEventListener("input", (e) => {
				window.SystemDeckAudio?.setBandFrequency?.(
					resolveAdvancedBand(),
					Number(e.target.value || 1000),
				)
				if (ui.eqPreset) ui.eqPreset.value = "Custom"
			})
			ui.eqAdvancedQ?.addEventListener("input", (e) => {
				window.SystemDeckAudio?.setBandQ?.(
					resolveAdvancedBand(),
					Number(e.target.value || 1),
				)
				if (ui.eqPreset) ui.eqPreset.value = "Custom"
			})
			syncAdvancedControlsForBand()

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
						safeDb(ui.mixDrums),
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
					this.widgets.forEach((w) => {
						this.states.set(w.ui.timeline, e.detail) // Store state for seek authority
						this.updateUI(w.ui, e.detail)
					})
				})
				document.addEventListener("systemdeck:track-ended", (e) => {
					this.handleTrackEnded(e.detail || {})
				})

				document.addEventListener("systemdeck:playlist-state", (e) => {
					const { currentIndex, playlist } = e.detail
					this.widgets.forEach((w) => {
						if (
							w.ui.playlist &&
							playlist[currentIndex] !== undefined
						) {
							w.ui.playlist.value = currentIndex
						}
					})
				})

				window.addEventListener(
					"systemdeck:audio-player-request",
					(e) => {
						const { source, meta } = e.detail || {}
						window.SystemDeckPlayback?.play(source, meta)
					},
				)

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
				if (
					ui.playlist &&
					ui.playlist.options.length <= 1 &&
					playlist.length > 0
				) {
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
		},
	}

	$(function () {
		PlayerUI.init()
	})
})(jQuery)
