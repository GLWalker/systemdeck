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
	const ensureStylesheet = (href, marker) => {
		if (!href) return
		if (document.querySelector(`link[data-sd-style="${marker}"]`)) return
		const hasHref = Array.from(document.querySelectorAll("link[rel='stylesheet']")).some(
			(node) => String(node.href || "").indexOf(href) !== -1,
		)
		if (hasHref) return
		const link = document.createElement("link")
		link.rel = "stylesheet"
		link.href = href
		link.dataset.sdStyle = marker
		document.head.appendChild(link)
	}
	const ensureDashiconsFallback = () => {
		const existingFallback = document.getElementById(
			"systemdeck-dashicons-fallback",
		)
		if (existingFallback) return
		const hasDashicons = Array.from(
			document.querySelectorAll("link[rel='stylesheet']"),
		).some((node) => String(node.href || "").includes("/dashicons"))
		if (hasDashicons) return
		const link = document.createElement("link")
		link.id = "systemdeck-dashicons-fallback"
		link.rel = "stylesheet"
		link.href = `${window.location.origin}/wp-includes/css/dashicons.min.css`
		document.head.appendChild(link)
	}
	const ensureModalPlayerAssets = () => {
		const playerScript = document.querySelector(
			'script[src*="widgets/player/app.js"]',
		)
		const playerScriptSrc = String(playerScript?.src || "")
		if (playerScriptSrc.includes("/widgets/player/app.js")) {
			const baseUrl = playerScriptSrc.split("/widgets/player/app.js")[0]
			if (baseUrl) {
				ensureStylesheet(
					`${baseUrl}/widgets/player/style.css`,
					"sd-player-style-fallback",
				)
			}
		}
		ensureDashiconsFallback()
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
	const EQ_DISPLAY_BANDS = ["32", "64", "125", "250", "500", "1K", "2K", "4K", "8K", "16K"]
	const EQ_STATE_KEYS_BY_FREQ = {
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

	const PlayerUI = {
		widgets: new Map(),
		playlists: new WeakMap(),
		states: new WeakMap(), // Cache current state per widget for seek authority
		runtimeState: {
			currentTrack: null,
			transportState: "idle",
			autoplayEnabled: false,
			repeatTrackEnabled: false,
			seeking: false,
			loading: false,
			hydrated: false,
			profileReady: false,
			profileHydrating: false,
		},
		_lastPlaybackStatus: "idle",
		_lastHandledTrackEndKey: "",
		_profileLoadsInFlight: new Set(),
		_lastHydratedTrackRuntimeKey: "",
		_profileHydrationTimer: null,

		updateRuntimeState(patch = {}) {
			this.runtimeState = {
				...this.runtimeState,
				...(patch || {}),
			}
			this.runtimeState.autoplayEnabled = !!this.runtimeState.autoplayEnabled
			this.runtimeState.repeatTrackEnabled =
				!!this.runtimeState.repeatTrackEnabled
			this.autoplayEnabled = this.runtimeState.autoplayEnabled
			this.repeatTrackEnabled = this.runtimeState.repeatTrackEnabled
			return this.runtimeState
		},

		ensureTransportIconClasses(surfaceRoot) {
			if (!surfaceRoot) return
			const iconByAction = {
				prev: "dashicons-controls-back",
				"play-selected": "dashicons-controls-play",
				pause: "dashicons-controls-pause",
				next: "dashicons-controls-forward",
				autoplay: "dashicons-migrate",
				"repeat-track": "dashicons-controls-repeat",
			}
			const allDashicons = Object.values(iconByAction)
			Object.keys(iconByAction).forEach((action) => {
				const button = surfaceRoot.querySelector(`[data-action="${action}"]`)
				const icon = button?.querySelector(".dashicons")
				if (!icon) return
				allDashicons.forEach((dashicon) => {
					if (dashicon !== "dashicons-no") {
						icon.classList.remove(dashicon)
					}
				})
				icon.classList.add(iconByAction[action], "sd-button-icon")
			})
		},

		// Transport / playlist UI selectors for the canonical player surface.
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
				saveEqBtn: q(root, '[data-action="save-eq-song"]'),
				saveEqStatus: q(root, '[data-role="save-eq-status"]'),
				eqOpenToggle: q(root, '[data-role="eq-open-toggle"]'),
				eqSection: q(root, '[data-role="eq-section"]'),

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
				idle: "sd-badge-neutral",
				loading: "sd-badge-info",
				playing: "sd-badge-success",
				paused: "sd-badge-neutral",
				stopped: "sd-badge-neutral",
				error: "sd-badge-warning",
			}
			const key = String(status || "idle").toLowerCase()
			const level = map[key] || "sd-badge-neutral"
			ui.status.className = `sd-badge ${level}`
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
					<div class="sd-player-now-media sd-player-media-row">
						<div class="sd-player-artwork sd-player-media-art" data-role="artwork"><div class="sd-player-artwork-placeholder"><span class="dashicons dashicons-format-audio"></span></div></div>
						<div class="sd-player-visualizer sd-player-media-visualizer" data-role="visualizer"><div class="sd-player-visualizer-bars"></div></div>
					</div>
					<div class="sd-player-now-meta-row sd-player-meta-row">
						<div class="sd-player-now-meta-left sd-player-meta-left">
							<div class="sd-player-track-title sd-player-meta-title" data-role="now-playing">No source loaded.</div>
							<div class="sd-player-now-meta-line sd-player-meta-badges"><div class="sd-badge sd-badge-neutral" data-role="status">IDLE</div><span class="sd-badge sd-badge-info sd-player-codec" data-role="now-codec" hidden></span></div>
						</div>
						<div class="sd-player-track-time sd-player-meta-time"><span data-time>0:00</span><span>/</span><span data-duration>0:00</span></div>
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
							<button type="button" class="button button-small sd-transport-btn" data-action="prev" aria-label="Previous" title="Previous"><span class="dashicons dashicons-controls-back sd-button-icon"></span><span class="screen-reader-text">Previous</span></button>
							<button type="button" class="button button-small button-primary sd-transport-btn" data-action="play-selected" data-role="transport-main" aria-label="Play" title="Play" aria-pressed="false"><span class="dashicons dashicons-controls-play sd-button-icon" data-role="transport-main-icon"></span><span class="screen-reader-text">Play</span></button>
							<button type="button" class="button button-small sd-transport-btn" data-action="pause" aria-label="Pause" title="Pause"><span class="dashicons dashicons-controls-pause sd-button-icon"></span><span class="screen-reader-text">Pause</span></button>
							<button type="button" class="button button-small sd-transport-btn" data-action="next" aria-label="Next" title="Next"><span class="dashicons dashicons-controls-forward sd-button-icon"></span><span class="screen-reader-text">Next</span></button>
							<button type="button" class="button button-small sd-transport-btn sd-transport-btn-mode" data-action="autoplay" aria-label="Autoplay" title="Autoplay" aria-pressed="false"><span class="dashicons dashicons-migrate sd-button-icon"></span><span class="screen-reader-text">Autoplay</span></button>
							<button type="button" class="button button-small sd-transport-btn sd-transport-btn-mode" data-action="repeat-track" aria-label="Repeat Track" title="Repeat Track" aria-pressed="false"><span class="dashicons dashicons-controls-repeat sd-button-icon"></span><span class="screen-reader-text">Repeat Track</span></button>
						</div>
					</div>
				</div>
				${
					config.showTrackSelect
						? `<div class="sd-player-track-row"><div class="sd-player-preset-inline"><label><span class="screen-reader-text">EQ Presets</span><select data-role="eq-preset"><option>Flat</option><option>Bass Boost</option><option>Bass Reducer</option><option>Vocal</option><option>Spoken Word</option><option>Acoustic</option><option>Classical</option><option>Piano</option><option>Jazz</option><option>Blues</option><option>Rock</option><option>Hard Rock</option><option>Metal</option><option>Electronic</option><option>EDM</option><option>Hip Hop</option><option>Dance</option><option>Pop</option><option>R&B</option><option>Retro</option><option>Warm</option><option>Bright</option><option>Loudness</option><option>Late Night</option><option>Car Stereo</option><option>Small Speakers</option><option>Custom</option></select></label><label class="sd-player-check sd-player-eq-inline"><input type="checkbox" data-role="eq-open-toggle"><span>EQ</span></label></div><div class="sd-player-load-block sd-player-load-inline"><label><span class="screen-reader-text">Track</span><select data-role="playlist" class="sd-player-playlist-select"><option value="">-- Select Track --</option></select></label><div class="sd-player-load-actions">${
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

		getFileTypeLabel(track = {}) {
			if (!track || typeof track !== "object") return ""
			const normalizeType = (value) => {
				const raw = String(value || "").trim().toLowerCase()
				if (!raw) return ""
				if (raw === "mid" || raw === "midi") return "MIDI"
				if (
					raw === "mp3" ||
					raw === "wav" ||
					raw === "flac"
				) {
					return raw.toUpperCase()
				}
				return ""
			}
			const explicitType =
				normalizeType(track.file_type) ||
				normalizeType(track.extension) ||
				normalizeType(track.ext)
			if (explicitType) return explicitType

			const parseExtension = (value) => {
				const cleaned = String(value || "")
					.split("?")[0]
					.split("#")[0]
					.trim()
				if (!cleaned.includes(".")) return ""
				const ext = cleaned.split(".").pop()
				return normalizeType(ext)
			}
			const candidates = [
				track.filename,
				track.name,
				track.title,
				track.url,
				track.src,
				track.source,
			]
			for (let i = 0; i < candidates.length; i += 1) {
				const label = parseExtension(candidates[i])
				if (label) return label
			}
			return ""
		},

		syncMiniPlayerSurface(surfaceRoot, state) {
			const coerceArtworkUrl = (value) => {
				if (!value) return ""
				if (typeof value === "string") {
					const candidate = value.trim()
					if (!candidate) return ""
					if (candidate === "[object Object]") return ""
					if (/^https?:\/\//i.test(candidate)) return candidate
					if (candidate.startsWith("//")) return candidate
					if (candidate.startsWith("/")) return candidate
					return ""
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

			if (!surfaceRoot || !state) return
			this.ensureTransportIconClasses(surfaceRoot)
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
			const normalizedArtwork = coerceArtworkUrl(state.artwork)
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
			if (ui.nowCodec) {
				const fileType = this.getFileTypeLabel(state.track || {})
				if (fileType) {
					ui.nowCodec.textContent = fileType
					ui.nowCodec.hidden = false
				} else {
					ui.nowCodec.textContent = ""
					ui.nowCodec.hidden = true
				}
			}
			const transportMain = surfaceRoot.querySelector(
				'[data-role="transport-main"]',
			)
			const transportMainIcon = surfaceRoot.querySelector(
				'[data-role="transport-main-icon"]',
			)
			if (transportMain) {
				const actionLabel =
					normalizedStatus === "playing" ||
					normalizedStatus === "loading"
						? "Stop"
						: "Play"
				transportMain.setAttribute("aria-label", actionLabel)
				transportMain.setAttribute("title", actionLabel)
				transportMain.setAttribute(
					"aria-pressed",
					normalizedStatus === "playing" ? "true" : "false",
				)
			}
			if (transportMainIcon) {
				const playing = normalizedStatus === "playing"
				transportMainIcon.classList.toggle(
					"dashicons-controls-play",
					!playing,
				)
				transportMainIcon.classList.toggle("dashicons-no", playing)
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
					const current = !!this.runtimeState?.autoplayEnabled
					this.updateRuntimeState({
						autoplayEnabled: !current,
					})
					this.syncTransportModeUI()
				})
			}
			if (
				repeatTrackBtn &&
				repeatTrackBtn.dataset.sdMiniBound !== "1"
			) {
				repeatTrackBtn.dataset.sdMiniBound = "1"
				repeatTrackBtn.addEventListener("click", () => {
					const current = !!this.runtimeState?.repeatTrackEnabled
					this.updateRuntimeState({
						repeatTrackEnabled: !current,
					})
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
				this.updateRuntimeState({ seeking: false })
			}
			const seekFromSlider = () => {
				const ratio = Number(timelineInput?.value || 0)
				seekToRatio(ratio)
			}
			timelineInput?.addEventListener("input", (e) => {
				surfaceRoot.dataset.sdMiniSeeking = "1"
				timelineInput.dataset.dragging = "true"
				this.updateRuntimeState({ seeking: true })
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
				const state = window.SystemDeckPlayback?.getState?.() || {}
				const runtime = this.runtimeState || {}
				const playlist = Array.isArray(state?.playlist)
					? state.playlist
					: []
				const status = String(state?.status || "idle").toLowerCase()
				const runtimeTrack = runtime?.currentTrack || null
				const hasTrack =
					(state?.currentIndex >= 0 && playlist.length > 0) ||
					!!runtimeTrack?.source ||
					!!runtimeTrack?.title ||
					!!state?.nowPlaying?.source ||
					!!state?.source ||
					(status !== "idle" &&
						String(state?.nowPlaying?.title || "") !==
							"No source loaded.")
				const autoplayBtn = root.querySelector(
					'[data-action="autoplay"]',
				)
				const repeatTrackBtn = root.querySelector(
					'[data-action="repeat-track"]',
				)
				const playBtn = root.querySelector('[data-role="transport-main"]')
				const pauseBtn = root.querySelector('[data-action="pause"]')
				const prevBtn = root.querySelector('[data-action="prev"]')
				const nextBtn = root.querySelector('[data-action="next"]')
				const transport = root.querySelector(".sd-player-transport")
				const transportButtons = Array.from(
					root.querySelectorAll(".sd-player-transport .sd-transport-btn"),
				)
				transportButtons.forEach((btn) => {
					const disabled = !hasTrack || status === "loading"
					btn.classList.toggle("is-disabled", disabled)
				})
				if (transport) {
					transport.classList.toggle("has-track", !!hasTrack)
					transport.classList.toggle("is-playing", status === "playing")
					transport.classList.toggle("is-paused", status === "paused")
				}
				if (playBtn) {
					playBtn.classList.toggle("is-active", status === "playing")
					playBtn.setAttribute(
						"aria-pressed",
						status === "playing" ? "true" : "false",
					)
				}
				if (pauseBtn) {
					pauseBtn.classList.toggle("is-active", status === "paused")
				}
				if (prevBtn) {
					prevBtn.classList.toggle("is-active", false)
				}
				if (nextBtn) {
					nextBtn.classList.toggle("is-active", false)
				}
				if (autoplayBtn) {
					const autoplayEnabled = !!runtime.autoplayEnabled
					autoplayBtn.classList.toggle(
						"is-active",
						!!hasTrack && autoplayEnabled,
					)
					autoplayBtn.classList.toggle("is-disabled", !hasTrack)
					autoplayBtn.setAttribute(
						"aria-pressed",
						autoplayEnabled ? "true" : "false",
					)
				}
				if (repeatTrackBtn) {
					const repeatEnabled = !!runtime.repeatTrackEnabled
					repeatTrackBtn.classList.toggle(
						"is-active",
						!!hasTrack && repeatEnabled,
					)
					repeatTrackBtn.classList.toggle("is-disabled", !hasTrack)
					repeatTrackBtn.setAttribute(
						"aria-pressed",
						repeatEnabled ? "true" : "false",
					)
				}
			})
		},

		dispatchTrackPlay(item, index, playlist) {
			if (!item) return false
			const source = String(
				item.source || item.url || item.stream_url || item.src || "",
			)
			if (!source) return false
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "play-dispatch",
					title: String(item?.title || ""),
					source,
					index: Number(index),
					playlistSize: Array.isArray(playlist) ? playlist.length : 0,
				})
			}
			document.dispatchEvent(
				new CustomEvent("systemdeck:play-file", {
					detail: {
						source,
						meta: {
							...(item || {}),
							...(item?.metadata || {}),
							source,
						},
						index: Number(index),
						playlist: Array.isArray(playlist) ? playlist : [],
					},
				}),
			)
			return true
		},

		// Hydration authority: explicit detail beats runtime, which beats live playback payloads.
		getAuthoritativeCurrentTrack(detail = {}) {
			const explicit = window.SystemDeckAudioMemory?.getTrackFromDetail
				? window.SystemDeckAudioMemory.getTrackFromDetail(detail)
				: detail || {}
			const playbackState = window.SystemDeckPlayback?.getState?.() || {}
			const runtimeTrack = this.runtimeState?.currentTrack || {}
			const playbackTrack = playbackState.nowPlaying || {}
			const playbackMeta = playbackTrack.metadata || playbackState.metadata || {}
			return {
				...playbackTrack,
				...playbackMeta,
				...(runtimeTrack || {}),
				...(explicit || {}),
				title:
					explicit?.title ||
					playbackTrack.title ||
					playbackState.title ||
					runtimeTrack?.title ||
					"",
				source:
					explicit?.source ||
					explicit?.url ||
					playbackTrack.source ||
					playbackState.source ||
					playbackMeta.source ||
					runtimeTrack?.source ||
					"",
			}
		},

		async hydrateProfileForCurrentTrack(reason = "unknown", detail = {}) {
			if (!window.SystemDeckAudioMemory) return

			const hydratedTrack = this.getAuthoritativeCurrentTrack(detail)
			let loadKey = ""

			try {
				const trackHash =
					await window.SystemDeckAudioMemory.deriveTrackHash(hydratedTrack)
				const playbackPart = String(
					detail.playbackId ||
						hydratedTrack.source ||
						hydratedTrack.url ||
						hydratedTrack.id ||
						"na",
				)
				loadKey = `${trackHash}:${playbackPart}`
				if (this._profileLoadsInFlight.has(loadKey)) return
				this._profileLoadsInFlight.add(loadKey)

				this.updateRuntimeState({
					hydrated: false,
					profileReady: false,
					profileHydrating: true,
				})
				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckAudio:profile-hydration]", {
						stage: "track-ready",
						reason,
						detail,
						track: hydratedTrack,
						trackHash,
						loadKey,
					})
				}

				document.dispatchEvent(
					new CustomEvent("systemdeck:profile-loading", {
						detail: {
							trackHash,
							track: hydratedTrack,
							playbackId: detail.playbackId || null,
							reason,
						},
					}),
				)

				const response = await window.SystemDeckAudioMemory.loadProfile(trackHash)
				const profile = window.SystemDeckAudioMemory.extractProfileFromResponse
					? window.SystemDeckAudioMemory.extractProfileFromResponse(response)
					: response?.profile && typeof response.profile === "object"
					? response.profile
					: null
				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckAudio:profile-hydration]", {
						stage: "profile-response",
						reason,
						trackHash,
						response,
						hasProfile: !!profile,
					})
				}

				if (!profile) {
					this.updateRuntimeState({
						hydrated: true,
						profileReady: false,
						profileHydrating: false,
					})
					document.dispatchEvent(
						new CustomEvent("systemdeck:profile-missing", {
							detail: {
								trackHash,
								track: hydratedTrack,
								playbackId: detail.playbackId || null,
								reason,
							},
						}),
					)
					return
				}

				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckAudio:profile-hydration]", {
						stage: "profile-apply-start",
						trackHash,
						profile,
					})
				}
				setTimeout(() => {
					;(async () => {
						const activeTrack = this.getAuthoritativeCurrentTrack({})
						const activeHash =
							await window.SystemDeckAudioMemory.deriveTrackHash(activeTrack)
						if (activeHash !== trackHash) {
							if (window.SystemDeckAudioDebug === true) {
								console.debug("[SystemDeckAudio:profile-hydration]", {
									stage: "stale-profile-skip",
									reason,
									requestedHash: trackHash,
									activeHash,
									applied: false,
								})
							}
							this.updateRuntimeState({
								profileHydrating: false,
							})
							return
						}
						window.SystemDeckAudioMemory.applyProfile(profile)
						if (window.SystemDeckAudioDebug === true) {
							console.debug("[SystemDeckAudio:profile-hydration]", {
								stage: "profile-applied",
								reason,
								requestedHash: trackHash,
								activeHash,
								applied: true,
							})
						}
						this.updateRuntimeState({
							profileHydrating: false,
						})
					})()
				}, 0)
				this.updateRuntimeState({
					hydrated: true,
					profileReady: true,
				})
				document.dispatchEvent(
					new CustomEvent("systemdeck:profile-loaded", {
						detail: {
							trackHash,
							track: hydratedTrack,
							profile,
							playbackId: detail.playbackId || null,
							reason,
						},
					}),
				)
			} catch (error) {
				this.updateRuntimeState({
					hydrated: true,
					profileReady: false,
					profileHydrating: false,
				})
				document.dispatchEvent(
					new CustomEvent("systemdeck:profile-error", {
						detail: {
							track: hydratedTrack,
							playbackId: detail.playbackId || null,
							reason,
							error: String(error?.message || error || "Profile load failed"),
						},
					}),
				)
			} finally {
				if (loadKey) this._profileLoadsInFlight.delete(loadKey)
			}
		},

		async handleTrackReadyProfile(detail = {}) {
			return this.hydrateProfileForCurrentTrack("track-ready", detail)
		},

		handleTrackEnded(detail = {}) {
			const state = window.SystemDeckPlayback?.getState?.() || {}
			const runtime = this.runtimeState || {}
			const playlist = Array.isArray(runtime?.playlist)
				? runtime.playlist
				: Array.isArray(state?.playlist)
				? state.playlist
				: []
			const currentIndex = Number(
				runtime?.currentIndex ?? state?.currentIndex ?? -1,
			)
			const endKey = String(
				detail?.endId ??
					`${detail?.playbackId || "pid"}:${detail?.mode || state?.mode || "unknown"}:${currentIndex}`,
			)
			if (this._lastHandledTrackEndKey === endKey) return
			this._lastHandledTrackEndKey = endKey
			const liveState = this.runtimeState || {}
			const repeatEnabled = !!liveState.repeatTrackEnabled
			const autoplayEnabled = !!liveState.autoplayEnabled
			const activePlaylist = Array.isArray(liveState.playlist)
				? liveState.playlist
				: playlist
			const activeIndex = Number(
				liveState.currentIndex ?? currentIndex ?? -1,
			)

			if (
				repeatEnabled &&
				activeIndex >= 0 &&
				activePlaylist[activeIndex]
			) {
				this.updateRuntimeState({
					transportState: "loading",
					loading: true,
				})
				this.dispatchTrackPlay(
					activePlaylist[activeIndex],
					activeIndex,
					activePlaylist,
				)
				return
			}

			if (autoplayEnabled && activeIndex >= 0 && activePlaylist.length) {
				for (let i = activeIndex + 1; i < activePlaylist.length; i += 1) {
					const nextItem = activePlaylist[i]
					if (!nextItem) continue
					const origin = String(nextItem.origin || "").toLowerCase()
					if (origin && !origin.includes("vault")) continue
					const hasSource = String(
						nextItem.source ||
							nextItem.url ||
							nextItem.stream_url ||
							nextItem.src ||
							"",
					)
					if (!hasSource) continue
					this.updateRuntimeState({
						transportState: "loading",
						loading: true,
					})
					this.dispatchTrackPlay(nextItem, i, activePlaylist)
					return
				}
			}

			this.updateRuntimeState({
				transportState: "ended",
				loading: false,
				seeking: false,
			})
			this.syncTransportModeUI()
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
					((candidate) => {
						if (!candidate) return null
						if (typeof candidate === "string") {
							const trimmed = candidate.trim()
							if (
								trimmed === "" ||
								trimmed === "[object Object]"
							) {
								return null
							}
							if (
								/^https?:\/\//i.test(trimmed) ||
								trimmed.startsWith("//") ||
								trimmed.startsWith("/")
							) {
								return trimmed
							}
							return null
						}
						if (typeof candidate === "object") {
							const nested =
								candidate.url ||
								candidate.src ||
								candidate.full?.url ||
								candidate.sizes?.full?.url ||
								candidate.sizes?.large?.url ||
								candidate.sizes?.medium?.url ||
								candidate.sizes?.thumbnail?.url ||
								""
							return typeof nested === "string" && nested !== ""
								? nested
								: null
						}
						return null
					})(
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
					),
				metadata:
					state.nowPlaying?.metadata ||
					state.metadata ||
					{},
				track: {
					...(state.nowPlaying || {}),
					...(state.nowPlaying?.metadata || {}),
					...(state.metadata || {}),
					title:
						state.nowPlaying?.title ||
						state.title ||
						state.nowPlaying?.metadata?.title ||
						state.metadata?.title ||
						"",
					source:
						state.nowPlaying?.source ||
						state.source ||
						state.nowPlaying?.metadata?.source ||
						state.metadata?.source ||
						"",
				},
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
			const status = String(state.status || "idle").toLowerCase()
			const hasTrack =
				(state.currentIndex >= 0 && playlist.length > 0) ||
				!!state.nowPlaying?.source ||
				!!state.source ||
				(status !== "idle" &&
					String(state?.nowPlaying?.title || "") !==
						"No source loaded.")
			this.updateRuntimeState({
				currentTrack: hasTrack
					? {
						id: state?.nowPlaying?.id ?? state?.id ?? null,
						title: miniState.title || "",
						source:
							state?.nowPlaying?.source ||
							state?.source ||
							"",
					}
					: null,
				transportState: status,
				loading: status === "loading",
				playlist,
				currentIndex: Number(state.currentIndex ?? -1),
			})
			const runtimeTrack = this.runtimeState?.currentTrack || null
			const runtimeTrackKey = runtimeTrack
				? `${String(runtimeTrack.id || "")}|${String(runtimeTrack.source || "")}|${String(runtimeTrack.title || "")}`
				: ""
			if (runtimeTrackKey && runtimeTrackKey !== this._lastHydratedTrackRuntimeKey) {
				this._lastHydratedTrackRuntimeKey = runtimeTrackKey
				if (this._profileHydrationTimer) {
					clearTimeout(this._profileHydrationTimer)
				}
				this._profileHydrationTimer = setTimeout(() => {
					void this.hydrateProfileForCurrentTrack(
						"runtime-track-change-settled",
						{
							currentTrack: runtimeTrack,
							source: runtimeTrack.source || "",
							meta: {
								title: runtimeTrack.title || "",
							},
						},
					)
				}, 75)
			}

			// 1. Control Button States
			if (ui.play) ui.play.disabled = !hasTrack || status === "loading"
			if (ui.pause) ui.pause.disabled = !hasTrack || status === "loading"
			if (ui.prev) ui.prev.disabled = !hasTrack || status === "loading"
			if (ui.next) ui.next.disabled = !hasTrack || status === "loading"
			const autoplayBtn = ui.timeline?.closest(".sd-player-now-card")?.querySelector('[data-action="autoplay"]')
			const repeatTrackBtn = ui.timeline?.closest(".sd-player-now-card")?.querySelector('[data-action="repeat-track"]')
			if (autoplayBtn) autoplayBtn.disabled = !hasTrack || status === "loading"
			if (repeatTrackBtn) repeatTrackBtn.disabled = !hasTrack || status === "loading"

			// 2. Load Action Locking
			if (ui.playSelectedButtons?.length) {
				ui.playSelectedButtons.forEach((btn) => {
					btn.disabled = status === "loading"
				})
			}
			this.syncTransportModeUI()
		},

		// Canonical EQ surface rendering and synchronization.
		ensureProEQPanel(root) {
			if (!root) return
			root.innerHTML = ""
			root.insertAdjacentHTML(
				"afterbegin",
				`<div class="sd-player-shell sd-player-v2">
					<div data-mini-surface-slot></div>
					<section class="sd-player-card sd-player-eq-card" data-role="eq-section" hidden>
						<div class="sd-player-eq-head"><header class="sd-player-card-title">EQUALIZER</header><div class="sd-player-eq-head-actions"><button type="button" class="button" data-action="save-eq-song">Save to Song</button><span class="sd-player-save-eq-status" data-role="save-eq-status" aria-live="polite"></span></div></div><div class="sd-player-eq-preamp-row"><label><span>Preamp</span><input type="range" min="0" max="2" step="0.01" value="1" data-role="eq-master-gain"></label></div><div class="sd-player-eq-board"><div class="sd-player-db-scale"><span>+12 dB</span><span>0 dB</span><span>-12 dB</span></div><div class="sd-player-eq-scroll"><div class="sd-player-eq-grid"><div class="sd-player-eq-guide sd-player-eq-guide-top"></div><div class="sd-player-eq-guide sd-player-eq-guide-mid"></div><div class="sd-player-eq-guide sd-player-eq-guide-bottom"></div>${EQ_DISPLAY_BANDS
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
			const eqToggle = q(root, '[data-role="eq-open-toggle"]')
			const eqSection = q(root, '[data-role="eq-section"]')
			const keepOpenPref =
				localStorage.getItem("systemdeck.player.eqOpen") === "1"
			if (eqToggle) eqToggle.checked = keepOpenPref
			if (eqSection) eqSection.hidden = !keepOpenPref
		},

		buildModalSeededPlaybackState(item) {
			const source = item.source || item.url || ""
			const title = item.title || "Modal Track"
			const metadata = {
				...(item.metadata || {}),
				title,
				source,
			}
			return {
				...(window.SystemDeckPlayback?.getState?.() || {}),
				status: "stopped",
				title,
				source,
				currentTime: 0,
				duration: Number(item.duration || 0),
				currentIndex: 0,
				playlist: [{ ...item, group: "Media" }],
				nowPlaying: {
					...(item || {}),
					title,
					source,
					metadata,
				},
				metadata,
			}
		},

		// Modal hosts remain hosts only; canonical playback stays shared.
		normalizeModalTrack(detail = {}) {
			const coerceArtworkUrl = (value) => {
				if (!value) return ""
				if (typeof value === "string") return value
				if (typeof value === "object") {
					return String(
						value.url ||
							value.src ||
							value.full?.url ||
							value.sizes?.medium?.url ||
							value.sizes?.thumbnail?.url ||
							"",
					)
				}
				return ""
			}

			const track = detail?.track && typeof detail.track === "object" ? detail.track : {}
			const url = String(
				track.source ||
					track.url ||
					detail.url ||
					detail.trackUrl ||
					"",
			)
			const artwork =
				coerceArtworkUrl(track.artwork) ||
				coerceArtworkUrl(track.artworkUrl) ||
				coerceArtworkUrl(track.thumbnail) ||
				coerceArtworkUrl(track.cover) ||
				coerceArtworkUrl(track.metadata?.artwork) ||
				coerceArtworkUrl(track.metadata?.artworkUrl) ||
				coerceArtworkUrl(track.metadata?.thumbnail) ||
				coerceArtworkUrl(track.metadata?.cover) ||
				coerceArtworkUrl(detail.artwork) ||
				coerceArtworkUrl(detail.artworkUrl) ||
				coerceArtworkUrl(detail.thumbnail) ||
				coerceArtworkUrl(detail.cover) ||
				coerceArtworkUrl(detail.trackArtworkUrl) ||
				""
			const type = String(
				track.type ||
					detail.type ||
					detail.trackType ||
					"",
			).toLowerCase()
			return {
				id: track.id || detail.trackId || detail.id || "",
				title: track.title || detail.title || "Modal Track",
				source: url,
				url,
				type:
					type === "mid" || type === "midi"
						? "midi"
						: "audio",
				mime:
					track.mime ||
					(type === "midi" ? "audio/midi" : "audio/mpeg"),
				artwork,
				metadata: {
					...(track.metadata || {}),
					title: track.title || detail.title || "Modal Track",
					mime:
						track.mime ||
						(type === "midi" ? "audio/midi" : "audio/mpeg"),
					artwork,
					artworkUrl: artwork,
					thumbnail: artwork,
					cover: artwork,
				},
			}
		},

		mountModalSurface(detail = {}) {
			const host = detail?.host
			if (!host || !(host instanceof Element)) return
			ensureModalPlayerAssets()
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "mount-received",
					context: detail?.context || "modal",
					detail,
				})
			}
			const existing = host.querySelector(".sd-player-root")
			if (existing && existing.dataset.sdPlayerModalMounted === "1") return
			this.unmountModalSurface(detail)
			const root = document.createElement("div")
			root.className =
				"systemdeck-scope sd-player-widget sd-player-root sd-player-root--modal"
			root.dataset.sdPlayerModalMounted = "1"
			host.innerHTML = ""
			host.appendChild(root)
			this.ensureProEQPanel(root)
			const ui = this.cacheUI(root)
			const miniSurface = q(root, ".sd-player-now-card")
			this.widgets.set(root, { root, ui })
			this.bindEvents(root, ui)
			const item = this.normalizeModalTrack(detail)
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "track-normalized",
					context: detail?.context || "modal",
					track: item,
					hasSource: !!item?.source,
				})
			}
			if (ui.playlist && item.source) {
				this.playlists.set(ui.playlist, [{ ...item, group: "Media" }])
				this.renderPlaylist(ui)
				ui.playlist.value = "0"
			}
			if (item.source && miniSurface) {
				miniSurface._sdPlayerPlaySelected = () => {
				const modalPlaylist = this.playlists.get(ui.playlist) || []
					const selectedIndex = Number(ui.playlist?.value || 0)
					const playIndex =
						Number.isInteger(selectedIndex) && selectedIndex >= 0
							? selectedIndex
							: 0
					const selectedItem = modalPlaylist[playIndex] || modalPlaylist[0]
					if (!selectedItem) return
					this.dispatchTrackPlay(selectedItem, playIndex, modalPlaylist)
				}
				const seededState = this.buildModalSeededPlaybackState(item)
				this.updateUI(ui, seededState)
				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckPlayer:modal]", {
						stage: "mounted",
						context: detail?.context || "modal",
						track: item,
						hasSource: !!item.source,
					})
				}
			} else if (window.SystemDeckPlayback) {
				this.updateUI(ui, window.SystemDeckPlayback.getState())
			}
			if (window.SystemDeckAudio?.getEQState) {
				this.syncEQUI(ui, window.SystemDeckAudio.getEQState())
			}
			root.style.visibility = "visible"
			root.setAttribute("data-ready", "1")
		},

		unmountModalSurface(detail = {}) {
			const host = detail?.host
			if (!host || !(host instanceof Element)) return
			const root = host.querySelector(".sd-player-root")
			if (!root) return
			const entry = this.widgets.get(root)
			if (entry) {
				const slot = entry.ui?.visualizer?.closest(".sd-player-now-card")
				if (slot && typeof slot._sdVisualizerLoop === "function") {
					slot._sdVisualizerLoop()
					delete slot._sdVisualizerLoop
				}
				this.widgets.delete(root)
			}
			host.innerHTML = ""
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[SystemDeckPlayer:modal]", {
					stage: "unmounted",
					context: detail?.context || "modal",
				})
			}
		},

		syncEQUI(ui, eqState = {}) {
			const bands = eqState.bands || {}
			const advanced = eqState.advanced || {}
			const setValue = (el, v) => {
				if (!el) return
				el.value = String(Math.round(Number(v) || 0))
			}
			const canonicalBands = Object.fromEntries(
				Object.entries(EQ_STATE_KEYS_BY_FREQ).map(([freq, key]) => [
					freq,
					Number(bands[key] ?? bands[String(key).toUpperCase()] ?? 0),
				]),
			)
			;(ui.eqBands10 || []).forEach((el) => {
				const freq = String(el?.dataset?.freq || "")
				if (Object.prototype.hasOwnProperty.call(canonicalBands, freq)) {
					setValue(el, canonicalBands[freq])
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

		syncAllEQUI(eqState = {}) {
			this.widgets.forEach((widget) => {
				if (widget?.ui) {
					this.syncEQUI(widget.ui, eqState)
				}
			})
		},

		buildPresetEQState(preset = {}, baseState = {}) {
			const safePreset = preset && typeof preset === "object" ? preset : {}
			const nextBands =
				safePreset.bands && typeof safePreset.bands === "object"
					? safePreset.bands
					: {}
			return {
				...(baseState && typeof baseState === "object" ? baseState : {}),
				bands: {
					32: Number(nextBands["32"] ?? 0),
					64: Number(nextBands["64"] ?? 0),
					125: Number(nextBands["125"] ?? 0),
					250: Number(nextBands["250"] ?? 0),
					500: Number(nextBands["500"] ?? 0),
					"1k": Number(nextBands["1k"] ?? nextBands["1K"] ?? 0),
					"2k": Number(nextBands["2k"] ?? nextBands["2K"] ?? 0),
					"4k": Number(nextBands["4k"] ?? nextBands["4K"] ?? 0),
					"8k": Number(nextBands["8k"] ?? nextBands["8K"] ?? 0),
					"16k": Number(nextBands["16k"] ?? nextBands["16K"] ?? 0),
				},
				bassBoost:
					Object.prototype.hasOwnProperty.call(
						safePreset,
						"bassBoost",
					)
						? !!safePreset.bassBoost
						: !!baseState?.bassBoost,
				masterGain: Number(
					Object.prototype.hasOwnProperty.call(
						safePreset,
						"masterGain",
					)
						? safePreset.masterGain
						: baseState?.masterGain ?? 1,
				),
				preset: String(
					safePreset.name || safePreset.preset || "Custom",
				),
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
				ui.status.className = "sd-badge sd-badge-info"
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
					ui.status.className = "sd-badge sd-badge-warning"
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
								new CustomEvent("systemdeck:play-file", {
									detail: {
										source: sourceUrl,
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
				if (
					this.runtimeState?.profileHydrating === true &&
					e.isTrusted !== true
				) {
					if (window.SystemDeckAudioDebug === true) {
						console.debug("[SystemDeckAudio:profile-hydration]", {
							stage: "skip-preset-change-during-hydration",
							name,
						})
					}
					return
				}
				const preset = EQ_PRESETS[name]
				if (!preset) return
				const fallbackState = this.buildPresetEQState(
					preset,
					window.SystemDeckAudio?.getEQState?.() || {},
				)
				this.syncAllEQUI(fallbackState)
				if (window.SystemDeckAudioDebug === true && name === "Flat") {
					console.debug("[SystemDeckAudio:profile-hydration]", {
						stage: "preset-change-apply",
						name,
						isTrusted: e.isTrusted === true,
						profileReady: !!this.runtimeState?.profileReady,
						profileHydrating: !!this.runtimeState?.profileHydrating,
					})
				}
				window.SystemDeckPlayback?.setEQ(preset)
				const liveState = window.SystemDeckAudio?.getEQState?.()
				if (liveState) {
					this.syncAllEQUI(liveState)
				}
			})

			;(ui.eqBands10 || []).forEach((el) => {
				el.addEventListener("input", (e) => {
					const freq = String(el?.dataset?.freq || "")
					const band = EQ_STATE_KEYS_BY_FREQ[freq]
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
				if (
					this.runtimeState?.profileHydrating === true &&
					e.isTrusted !== true
				) {
					if (window.SystemDeckAudioDebug === true) {
						console.debug("[SystemDeckAudio:profile-hydration]", {
							stage: "skip-flat-apply-during-hydration",
							isTrusted: false,
						})
					}
					return
				}
				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckAudio:profile-hydration]", {
						stage: "flat-apply",
						reason: "eq-disabled",
						isTrusted: e.isTrusted === true,
						profileReady: !!this.runtimeState?.profileReady,
						profileHydrating: !!this.runtimeState?.profileHydrating,
					})
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
			ui.eqOpenToggle?.addEventListener("change", (e) => {
				const open = !!e.target.checked
				localStorage.setItem("systemdeck.player.eqOpen", open ? "1" : "0")
				if (ui.eqSection) ui.eqSection.hidden = !open
			})

			ui.saveEqBtn?.addEventListener("click", async () => {
				if (!window.SystemDeckAudioMemory) return
				if (ui.saveEqStatus) ui.saveEqStatus.textContent = "Saving..."
				try {
					const track = this.getAuthoritativeCurrentTrack({})
					if (!track || (!track.source && !track.url)) {
						throw new Error("No active track")
					}
					const trackHash =
						await window.SystemDeckAudioMemory.deriveTrackHash(track)
					const profile =
						window.SystemDeckAudioMemory.captureCurrentProfile()
					await window.SystemDeckAudioMemory.saveProfile(
						trackHash,
						profile,
					)
					if (ui.saveEqStatus) ui.saveEqStatus.textContent = "Saved"
				} catch (err) {
					if (ui.saveEqStatus) ui.saveEqStatus.textContent = "Save failed"
					if (window.SystemDeckAudioDebug === true) {
						console.debug("[SystemDeckAudio:save-profile]", err)
					}
				}
			})

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
				document.addEventListener("systemdeck:track-ready", (e) => {
					void this.handleTrackReadyProfile(e.detail || {})
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

				document.addEventListener("systemdeck:player-modal-mount", (e) => {
					this.mountModalSurface(e.detail || {})
				})

				document.addEventListener("systemdeck:player-modal-unmount", (e) => {
					this.unmountModalSurface(e.detail || {})
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
			this.updateRuntimeState({
				autoplayEnabled: false,
				repeatTrackEnabled: false,
			})
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
