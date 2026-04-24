;(function ($) {
	"use strict"

	let Audio = null
	const bindAudioEngine = () => {
		const candidate = window.SystemDeckAudio
		if (!candidate || typeof candidate.getState !== "function") {
			return false
		}
		Audio = candidate
		return true
	}

	const REQUEST_EVENT = "systemdeck:audio-player-request"

	let audioUnlocked = false
	const unlockAudio = async () => {
		if (audioUnlocked) return
		try {
			await Audio.resume()
			audioUnlocked = true
			console.log("🔊 Audio context unlocked")
		} catch (error) {
			console.warn("SystemDeckAudio resume failed:", error)
		}
	}

	const q = (root, selector) => root.querySelector(selector)
	const clamp = (value, min, max) =>
		Math.max(min, Math.min(max, Number(value) || 0))
	const formatTime = (seconds) => {
		const value = Math.max(0, Number(seconds) || 0)
		const min = Math.floor(value / 60)
		const sec = Math.floor(value % 60)
		return `${min}:${sec.toString().padStart(2, "0")}`
	}

	const PlayerSystem = {
		widgets: new Map(),
		engineEventsBound: false,
		bootRetryTimer: 0,
		mixState: {
			bass: 1,
			synth: 1,
			drums: 1,
		},

		cacheUI(root) {
			return {
				play: q(root, '[data-action="play"]'),
				pause: q(root, '[data-action="pause"]'),
				stop: q(root, '[data-action="stop"]'),
				prev: q(root, '[data-action="prev"]'),
				next: q(root, '[data-action="next"]'),
				loadBtn: q(root, '[data-action="load"], [data-action="load-file"]'),

				volume: q(root, '[data-control="volume"], [data-role="volume"]'),
				bass: q(root, '[data-control="bass"], [data-role="bass-boost"]'),
				mixBass: q(root, '[data-role="mix-bass"]'),
				mixSynth: q(root, '[data-role="mix-synth"]'),
				mixDrums: q(root, '[data-role="mix-drums"]'),

				timeline: q(root, "[data-timeline], [data-role='seek']"),
				time: q(root, "[data-time]"),
				duration: q(root, "[data-duration]"),

				status: q(root, "[data-status], [data-role='status']"),
				title: q(root, "[data-title], [data-role='now-playing']"),
				error: q(root, "[data-role='error']"),
				fileInput: q(root, "[data-role='file-input']"),
				trackControls: q(root, "[data-track-controls]"),
			}
		},

		getState() {
			return Audio.getState()
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

		updateTrack(ui, track) {
			if (!track) return
			if (ui.title) ui.title.textContent = track.title || "No source loaded."
			if (ui.duration)
				ui.duration.textContent = formatTime(Number(track.duration || 0))
		},

		updateMode(root, ui, state) {
			const mode = state?.mode === "file" ? "file" : "track"
			root.classList.toggle("mode-file", mode === "file")
			root.classList.toggle("mode-track", mode === "track")
			document.body.classList.toggle("mode-file", mode === "file")
			document.body.classList.toggle("mode-track", mode === "track")
			if (ui.trackControls) ui.trackControls.hidden = false
			if (ui.bass) ui.bass.disabled = false
			if (ui.mixBass) ui.mixBass.disabled = mode !== "track"
			if (ui.mixSynth) ui.mixSynth.disabled = mode !== "track"
			if (ui.mixDrums) ui.mixDrums.disabled = mode !== "track"
		},

		updateUI(root, ui, state) {
			if (!state) return

			const nowPlaying = state.nowPlaying || null
			const duration = Number(nowPlaying?.duration || 0)
			const currentTime = Number(nowPlaying?.currentTime || 0)
			const mix = state.mix || state.mixLevels || this.mixState
			this.mixState = {
				bass: Number(mix?.bass ?? this.mixState.bass ?? 1),
				synth: Number(mix?.synth ?? this.mixState.synth ?? 1),
				drums: Number(mix?.drums ?? this.mixState.drums ?? 1),
			}

			this.setStatus(ui, state.status || "idle")
			if (ui.title) {
				ui.title.textContent =
					nowPlaying?.title || (state.status === "loading" ? "Loading..." : "No source loaded.")
			}
			if (ui.time) ui.time.textContent = formatTime(currentTime)
			if (ui.duration) ui.duration.textContent = formatTime(duration)

			if (ui.timeline && !ui.timeline.matches(":active")) {
				const ratio = duration > 0 ? currentTime / duration : 0
				ui.timeline.value = String(clamp(ratio, 0, 1))
			}
			if (ui.volume && !ui.volume.matches(":active")) {
				ui.volume.value = String(clamp(state.volume, 0, 1))
			}
			if (ui.bass) ui.bass.checked = !!state.bassBoost

			if (ui.mixBass && !ui.mixBass.matches(":active")) {
				ui.mixBass.value = String(Math.round(this.mixState.bass * 100))
			}
			if (ui.mixSynth && !ui.mixSynth.matches(":active")) {
				ui.mixSynth.value = String(Math.round(this.mixState.synth * 100))
			}
			if (ui.mixDrums && !ui.mixDrums.matches(":active")) {
				ui.mixDrums.value = String(Math.round(this.mixState.drums * 100))
			}

			if (ui.error) {
				const message =
					typeof state.error === "string"
						? state.error
						: state.error?.message || ""
				ui.error.hidden = !message
				ui.error.textContent = message
			}

			this.updateMode(root, ui, state)
		},

		renderAll(state = null) {
			const snapshot = state || this.getState()
			this.widgets.forEach(({ root, ui }) => this.updateUI(root, ui, snapshot))
		},

		async loadSource(sourceInput, options = {}) {
			const source =
				typeof sourceInput === "string"
					? { type: "file", url: sourceInput, id: options.id || null }
					: sourceInput && typeof sourceInput === "object"
						? { ...sourceInput }
						: null
			if (!source) return false
			await unlockAudio()
			return await Audio.load(
				source,
				{
					title: options.title || "Loaded File",
					metadata: options.metadata || {},
					autoplay: options.autoplay === true,
				},
			)
		},

		bindControls(root, ui) {
			ui.play?.addEventListener("click", async () => {
				await unlockAudio()
				Audio.play()
			})
			ui.pause?.addEventListener("click", async () => {
				await unlockAudio()
				Audio.pause()
			})
			ui.stop?.addEventListener("click", () => Audio.stop())
			ui.prev?.addEventListener("click", async () => {
				await unlockAudio()
				if (typeof Audio.previous === "function") await Audio.previous()
			})
			ui.next?.addEventListener("click", async () => {
				await unlockAudio()
				if (typeof Audio.next === "function") await Audio.next()
			})

			ui.volume?.addEventListener("input", (event) => {
				Audio.setVolume(clamp(event.target.value, 0, 1))
			})
			ui.bass?.addEventListener("change", (event) => {
				Audio.setBassBoost(!!event.target.checked)
			})

			const setMixField = (field, input) => {
				if (!input || typeof Audio.setMixLevels !== "function") return
				const nextValue = clamp((input.value || 100) / 100, 0, 2)
				this.mixState = {
					...this.mixState,
					[field]: nextValue,
				}
				Audio.setMixLevels({
					[field]: nextValue,
				})
			}
			ui.mixBass?.addEventListener("input", () =>
				setMixField("bass", ui.mixBass),
			)
			ui.mixSynth?.addEventListener("input", () =>
				setMixField("synth", ui.mixSynth),
			)
			ui.mixDrums?.addEventListener("input", () =>
				setMixField("drums", ui.mixDrums),
			)

			ui.timeline?.addEventListener("input", (event) => {
				const state = this.getState()
				const duration = Number(state?.nowPlaying?.duration || 0)
				if (duration <= 0) return
				const ratio = clamp(event.target.value, 0, 1)
				Audio.seek(ratio * duration)
			})

			ui.loadBtn?.addEventListener("click", async () => {
				const url = window.prompt("Enter file URL")
				if (!url) return
				await this.loadSource(url, {
					title: "Loaded File",
					metadata: { origin: "player-widget:url-prompt" },
					autoplay: true,
				})
			})

			ui.fileInput?.addEventListener("change", async () => {
				const file = ui.fileInput.files?.[0]
				if (!file) return
				const fileName = String(file.name || "").toLowerCase()
				const isMidi =
					String(file.type || "").toLowerCase().includes("midi") ||
					fileName.endsWith(".mid") ||
					fileName.endsWith(".midi")
				if (isMidi && typeof Audio.buildMidiDerivativeFromArrayBuffer === "function") {
					try {
						const buffer = await file.arrayBuffer()
						const derivative = await Audio.buildMidiDerivativeFromArrayBuffer(
							buffer,
							{
								sourceType: "player",
								id: `player-midi-${Date.now()}`,
								title: file.name || "Local MIDI",
								mime: file.type || "audio/midi",
								filename: file.name || "",
							},
						)
						await this.loadSource(
							{
								type: "midi",
								data: derivative,
								id: derivative?.source?.id || null,
							},
							{
								id: derivative?.source?.id || null,
								title: derivative?.summary?.title || file.name || "Local MIDI",
								metadata: {
									origin: "player-widget:file-input",
									mime: file.type || "audio/midi",
									filename: file.name || "",
									mediaType: "midi",
									midiDerivative: derivative,
									sourceHash: derivative?.source?.hash || "",
								},
								autoplay: true,
							},
						)
					} catch (error) {
						console.error("Player MIDI upload failed:", error)
					}
				} else {
					const objectUrl = URL.createObjectURL(file)
					await this.loadSource(objectUrl, {
						id: `player-file-${Date.now()}`,
						title: file.name || "Local File",
						metadata: {
							origin: "player-widget:file-input",
							mime: file.type || "",
							filename: file.name || "",
						},
						autoplay: true,
					})
				}
				ui.fileInput.value = ""
			})
		},

		bindEngineEvents() {
			if (this.engineEventsBound || typeof Audio.on !== "function") return
			this.engineEventsBound = true

			Audio.on("statechange", (state) => this.renderAll(state))
			Audio.on("loaded", (track) => {
				this.widgets.forEach(({ ui }) => this.updateTrack(ui, track))
				this.renderAll(this.getState())
			})
			Audio.on("play", () => {
				this.widgets.forEach(({ ui }) => this.setStatus(ui, "playing"))
			})
			Audio.on("pause", () => {
				this.widgets.forEach(({ ui }) => this.setStatus(ui, "paused"))
			})
			Audio.on("stop", () => {
				this.widgets.forEach(({ ui }) => this.setStatus(ui, "stopped"))
			})
			Audio.on("timeupdate", (state) => this.renderAll(state))
			Audio.on("error", (error) => {
				console.error(error)
				this.widgets.forEach(({ ui }) => this.setStatus(ui, "error"))
				this.renderAll(this.getState())
			})

			window.addEventListener(REQUEST_EVENT, async (event) => {
				const detail = event?.detail || {}
				const source =
					detail.type === "midi"
						? {
								type: "midi",
								url: String(detail.source || detail.url || ""),
								id: detail.meta?.id || null,
								data:
									detail.derivative ||
									detail.meta?.midiDerivative ||
									detail.meta?.derivative ||
									null,
							}
						: {
								type: "file",
								url: String(detail.source || detail.url || ""),
								id: detail.meta?.id || null,
							}
				if (!source.url && !source.data) return
				const loaded = await this.loadSource(source, {
					id: detail.meta?.id || null,
					title: detail.meta?.title || "Requested Source",
					metadata: {
						...(detail.meta || {}),
						...(detail.type === "midi" ? { mediaType: "midi" } : {}),
					},
					autoplay: false,
				})
				if (loaded) await Audio.play()
			})

			window.SystemDeckPlayer = {
				playSource: async (source, meta = {}) => {
					const isMidi =
						String(meta?.mediaType || meta?.mime || "")
							.toLowerCase()
							.includes("midi") || !!meta?.midiDerivative
					const sourceConfig = isMidi
						? {
								type: "midi",
								url: String(source || ""),
								id: meta.id || null,
								data: meta?.midiDerivative || null,
							}
						: {
								type: "file",
								url: String(source || ""),
								id: meta.id || null,
							}
					const loaded = await this.loadSource(sourceConfig, {
						id: meta.id || null,
						title: meta.title || "Imported Source",
						metadata: meta,
						autoplay: false,
					})
					if (!loaded) return false
					await Audio.play()
					return true
				},
				control: async (action, payload) => {
					if (action === "play") return await Audio.play()
					if (action === "pause") return Audio.pause()
					if (action === "stop") return Audio.stop()
					if (action === "next" && typeof Audio.next === "function")
						return await Audio.next()
					if (action === "previous" && typeof Audio.previous === "function")
						return await Audio.previous()
					if (action === "seek") return Audio.seek(payload)
					if (action === "volume") return Audio.setVolume(payload)
					return false
				},
				getState: () => Audio.getState(),
				subscribe: (listener) => {
					if (typeof Audio.on !== "function" || typeof listener !== "function") {
						return () => {}
					}
					return Audio.on("statechange", listener)
				},
				emitRequest: (source, meta = {}) => {
					window.dispatchEvent(
						new CustomEvent(REQUEST_EVENT, { detail: { source, meta } }),
					)
				},
			}
		},

		mount(root) {
			if (this.widgets.has(root)) return
			const ui = this.cacheUI(root)
			this.widgets.set(root, { root, ui })
			this.bindControls(root, ui)
			this.updateUI(root, ui, this.getState())
		},

		scan() {
			document.querySelectorAll(".sd-player-root").forEach((root) =>
				this.mount(root),
			)
		},

		init() {
			if (!bindAudioEngine()) {
				if (!this.bootRetryTimer) {
					// Widget assets can load before the shared audio engine. Retry quietly.
					this.bootRetryTimer = window.setTimeout(() => {
						this.bootRetryTimer = 0
						this.init()
					}, 250)
				}
				return
			}
			this.bindEngineEvents()
			this.scan()
			setInterval(() => this.scan(), 1000)
		},
	}

	$(function () {
		PlayerSystem.init()
	})
})(jQuery)
