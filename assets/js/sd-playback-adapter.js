/**
 * SystemDeck Playback Adapter
 *
 * A unified audio pipeline that routes all playback (Native Media or Tone Engine)
 * through Tone.js for global EQ and FX processing.
 *
 * @package SystemDeck
 * @since 1.1.0
 */

(function ($) {
	"use strict"


	class SystemDeckPlaybackAdapter {
		constructor() {
			this.audioEl = null
			this.mediaSource = null
			this.mode = null // 'native' | 'systemdeck'
			this.initialized = false
			this.playbackId = 0 // Monotonic ID for instance isolation
			this._playingIndex = -1 // Track authority guard
			this.isResetting = false // Cleanup guard
			this.state = {
				status: "idle",
				title: "No source loaded.",
				currentTime: 0,
				duration: 0,
				mode: null,
				metadata: {}
			}

			// Queue Authority
			this.playlist = []
			this.currentIndex = -1

			// Polling for synthetic engine timing
			this.pollInterval = null
			this._lastEmittedSignature = ""
			this._lastEmittedAt = 0
			this._midiLoadToken = 0
			this._activeRoute = "none"
			this._lastTrackEndedSignature = ""
			this._bindTrackEndedBridge()
		}

		_bindTrackEndedBridge() {
			document.addEventListener("systemdeck:audio-player-state", (event) => {
				const detail = event?.detail || {}
				const reason = String(detail?.reason || "").toLowerCase()
				if (reason !== "file:ended" && reason !== "midi:ended") return
				this._emitTrackEnded({
					source: "engine",
					reason,
					mode: this.mode,
				})
			})
		}

		_emitTrackEnded(detail = {}) {
			const state = this.getState()
			const signature = [
				String(detail?.source || "unknown"),
				String(detail?.reason || ""),
				String(state?.mode || this.mode || ""),
				String(state?.currentIndex ?? this.currentIndex ?? -1),
				String(this.playbackId || 0),
			].join("|")
			if (signature === this._lastTrackEndedSignature) return
			this._lastTrackEndedSignature = signature
			document.dispatchEvent(
				new CustomEvent("systemdeck:track-ended", {
					detail: {
						...detail,
						playbackId: this.playbackId,
						mode: state?.mode || this.mode || null,
						currentIndex: Number(state?.currentIndex ?? this.currentIndex ?? -1),
					},
				}),
			)
		}

		/**
		 * Seek to a specific time in seconds
		 */
		seek(seconds) {
			const target = Number(seconds) || 0
			if (this.mode === "native" || this.mode === "native-fallback") {
				if (this.audioEl) {
					this.audioEl.currentTime = target
					this.emitState("playing", {
						currentTime: this.audioEl.currentTime,
						duration: this.audioEl.duration
					})
				}
			} else if (this.mode === "systemdeck") {
				if (window.SystemDeckAudio?.seek) {
					window.SystemDeckAudio.seek(target)
					const engineState = window.SystemDeckAudio.getState()
					this.emitState("playing", engineState)
				}
			}
		}

		/**
		 * Returns the current playback state
		 */
		getState() {
			let baseState = {
				...this.state,
				playlist: this.playlist,
				currentIndex: this.currentIndex,
				mode: this.mode
			}

			if (this.mode === "systemdeck" && window.SystemDeckAudio) {
				const engineState = window.SystemDeckAudio.getState()
				baseState = {
					...baseState,
					...engineState,
					currentTime: engineState.nowPlaying?.currentTime || 0,
					duration: engineState.nowPlaying?.duration || 0,
				}
			}

			return baseState
		}

		startPolling() {
			this.stopPolling()
			this.pollInterval = setInterval(() => {
				if (this.mode === "systemdeck" && window.SystemDeckAudio) {
					const state = window.SystemDeckAudio.getState()
					if (state.status === "playing") {
						this.emitState("playing", state)
					}
				}
			}, 250)
		}

		stopPolling() {
			if (this.pollInterval) {
				clearInterval(this.pollInterval)
				this.pollInterval = null
			}
		}

		/**
		 * Returns the current playlist
		 */
		getPlaylist() {
			return [...this.playlist]
		}

		/**
		 * Set the current playlist and optional starting index
		 */
		setPlaylist(items = [], index = 0) {
			this.playlist = Array.isArray(items) ? items : []
			this.currentIndex = Number(index) || 0
			this.emitPlaylistState()
		}

		/**
		 * Navigate to the next track
		 */
		next() {
			if (this.playlist.length === 0) return
			const nextIndex = (this.currentIndex + 1) % this.playlist.length
			this.playIndex(nextIndex)
		}

		/**
		 * Navigate to the previous track
		 */
		previous() {
			if (this.playlist.length === 0) return
			const prevIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length
			this.playIndex(prevIndex)
		}

		/**
		 * Play a track by its index in the current playlist
		 */
		async playIndex(index) {
			const idx = Number(index)
			if (isNaN(idx) || idx < 0 || idx >= this.playlist.length) {
				console.error("[SystemDeckPlayback] Invalid playlist index", index)
				return
			}

			this.currentIndex = idx
			const track = this.playlist[this.currentIndex]
			
			// Normalization layer for track source and metadata
			const source = track.source || track.url || track.src || track.file || track.data
			const meta = {
				...track,
				...(track.metadata || {}),
				title: track.title || track.label || track.name || "Track",
				mime: track.mime || track.type || track.metadata?.mime || "",
				mediaType: track.mediaType || track.kind || track.metadata?.mediaType || ""
			}

			this.emitState("loading", { title: meta.title })
			this.emitPlaylistState()

			try {
				if (track.origin === "builtin") {
					// Built-ins require SystemDeckAudio engine
					return this.play(source, meta)
				} else {
					// Files (Native/Vault/Media)
					return this.play(source, meta)
				}
			} catch (e) {
				this.emitState("error", { error: e.message, title: meta.title })
				throw e
			}
		}

		/**
		 * Seek to a specific time in seconds
		 */
		seek(seconds) {
			const time = Number(seconds)
			if (isNaN(time)) return

			if (this.mode === "native" && this.audioEl) {
				this.audioEl.currentTime = time
			} else if (this.mode === "systemdeck" && window.SystemDeckAudio) {
				window.SystemDeckAudio.seek?.(time)
			}
		}

		/**
		 * Emit the current playlist state
		 */
		emitPlaylistState() {
			document.dispatchEvent(new CustomEvent("systemdeck:playlist-state", {
				detail: {
					playlist: this.playlist,
					currentIndex: this.currentIndex
				}
			}))
		}

		/**
		 * Ensure the audio engine and global EQ are ready.
		 * @returns {Promise<boolean>}
		 */
		async ensureEngine() {
			try {
				// 1. Resume SystemDeck context if available
				if (window.SystemDeckAudio?.resume) {
					await window.SystemDeckAudio.resume()
				}

				// 2. Safety check for Tone.js
				if (typeof Tone === "undefined" || !Tone.getContext) {
					console.warn("[SystemDeckPlayback] Tone.js not available.")
					return false
				}

				if (!this.initialized) this.initialized = true

				// 4. Ensure context is running
				if (Tone.getContext().state !== "running") {
					await Tone.start()
				}

				return true
			} catch (e) {
				console.error("[SystemDeckPlayback] Engine initialization failed", e)
				return false
			}
		}

		/**
		 * Set master volume (0-1)
		 */
		setVolume(value) {
			const vol = Math.max(0, Math.min(1, Number(value) || 0))
			this.volume = vol

			if (typeof Tone !== "undefined" && Tone.getDestination) {
				Tone.getDestination().volume.value = Tone.gainToDb(vol)
			}
			
			if (this.audioEl) {
				this.audioEl.volume = vol
			}
		}

		/**
		 * Apply EQ preset or legacy 3-band values
		 */
		setEQ(presetOrLow, mid, high) {
			if (!window.SystemDeckAudio) return
			if (
				presetOrLow &&
				typeof presetOrLow === "object" &&
				window.SystemDeckAudio.applyEQ
			) {
				window.SystemDeckAudio.applyEQ(presetOrLow)
				return
			}
			if (!window.SystemDeckAudio.setEQ) return
			window.SystemDeckAudio.setEQ({
				low: Math.max(-24, Math.min(12, Number(presetOrLow) || 0)),
				mid2: Math.max(-24, Math.min(12, Number(mid) || 0)),
				high: Math.max(-24, Math.min(12, Number(high) || 0)),
				preset: "Custom",
			})
		}

		updateEQBand(band, value) {
			window.SystemDeckAudio?.setBandGain?.(band, value)
		}

		setBassBoost(value) {
			if (window.SystemDeckAudio?.toggleBassBoost) {
				window.SystemDeckAudio.toggleBassBoost(!!value)
				return
			}
			window.SystemDeckAudio?.setBassBoostEnabled?.(!!value)
		}

		setMasterGain(value) {
			window.SystemDeckAudio?.setMasterGain?.(value)
		}

		/**
		 * Complete cleanup of previous playback state
		 */
		stopNativeOnly() {
			this.isResetting = true
			try {
				this.stopPolling()
				if (this.audioEl) {
					this.audioEl.pause()
					this.audioEl.removeAttribute("src")
					this.audioEl.load()
					this.audioEl.onended = null
					this.audioEl.ontimeupdate = null
					this.audioEl.onerror = null
					this.audioEl.onplaying = null
					this.audioEl.onpause = null
					this.audioEl.remove()
					this.audioEl = null
				}
				if (this.mediaSource) {
					try { this.mediaSource.disconnect() } catch (e) {}
					this.mediaSource = null
				}
			} finally {
				this.isResetting = false
			}
		}

		stopSystemDeckOnly() {
			if (window.SystemDeckAudio) {
				window.SystemDeckAudio.stop?.(false)
			}
		}

		resetPlayback() {
			this._playingIndex = -1
			this.stopNativeOnly()
			this.stopSystemDeckOnly()
		}

		/**
		 * Detect the best playback mode for the source
		 */
		detectType(source, meta = {}) {
			const mime = String(meta?.mime || "").toLowerCase()
			const url = String(typeof source === "string" ? source : (source?.url || "")).toLowerCase()
			
			if (
				mime.includes("midi") ||
				url.endsWith(".mid") ||
				url.endsWith(".midi") ||
				meta?.mediaType === "midi" ||
				meta?.midiDerivative ||
				url.endsWith(".json") ||
				meta?.origin === "builtin"
			) {
				return "systemdeck"
			}
			
			return "native"
		}

		/**
		 * Resolve the canonical source URL or track object from a playlist item
		 */
		resolveTrackSource(track) {
			if (!track || typeof track !== "object") return ""
			const source = track.source ||
				track.url ||
				track.stream_url ||
				track.guid ||
				track.attachment?.url ||
				track.attachment?.sizes?.full?.url ||
				""
			
			// Prevent stringified objects
			if (typeof source === "object") return ""
			return String(source)
		}

		/**
		 * Play a track by its index in the current playlist
		 */
		async playIndex(index) {
			const idx = Number(index)

			// 2. Play authority guard - prevent duplicate loading of same index while playing
			if (this._playingIndex === idx && this.state.status === "playing") {
				return true
			}

			if (isNaN(idx) || idx < 0 || idx >= this.playlist.length) {
				console.error("[SystemDeckPlayback] Invalid playlist index", index)
				return false
			}

			this.currentIndex = idx
			this._playingIndex = idx
			const track = this.playlist[this.currentIndex]
			
			const metadata = {
				...track,
				...(track.metadata || {}),
				title: track.title || track.label || track.name || "Track",
				mime: track.mime || track.type || track.metadata?.mime || "",
				mediaType: track.mediaType || track.kind || track.metadata?.mediaType || ""
			}

			// 3. Built-in Detection (Synthetic Engine)
			if (track.type === "builtin" || track.origin === "builtin" || metadata.engine === "systemdeck") {
				this._activeRoute = "builtin"
				if (window.SYSTEMDECK_DEBUG_AUDIO) {
					console.log("[BUILTIN ROUTE]", {
						index: idx,
						item: track,
						songId: metadata.builtinId || metadata.songId || track.source || track.id,
						hasSystemDeckAudio: !!window.SystemDeckAudio,
						hasLoad: !!window.SystemDeckAudio?.load,
						hasPlay: !!window.SystemDeckAudio?.play,
						audioState: window.SystemDeckAudio?.getState?.()
					})
				}
				return this.playSystemDeckBuiltin(track)
			}

			// 4. MIDI Detection (Synthetic Engine)
			if (track.type === "midi" || metadata.mime === "audio/midi") {
				this._activeRoute = "midi"
				this.mode = "systemdeck"
				const durationHint = Number(
					metadata?.duration ||
						metadata?.midiDerivative?.playback?.duration ||
						0,
				)
				this.emitState("loading", {
					title: metadata.title,
					currentTime: 0,
					duration: Number.isFinite(durationHint) ? durationHint : 0,
					metadata: {
						...metadata,
						mediaType: "midi",
						mime: metadata.mime || "audio/midi",
					},
				})
				this.emitPlaylistState()
				const token = ++this._midiLoadToken
				return this.playSystemDeckMidi(track, token)
			}

			this.stopSystemDeckOnly()
			this._activeRoute = "file"
			const source = this.resolveTrackSource(track)

			if (!source || source === "[object Object]") {
				this.emitState("error", { error: "Invalid track source", title: metadata.title })
				return false
			}

			this.emitState("loading", { title: metadata.title })
			this.emitPlaylistState()

			try {
				return await this.playNative(source, metadata)
			} catch (e) {
				this._playingIndex = -1
				this.emitState("error", { error: e.message, title: metadata.title })
				throw e
			}
		}

		async playSystemDeckMidi(item, loadToken) {
			const metadata = { ...(item.metadata || {}), title: item.title }
			// MIDI Priority: Derivative Object > Derivative URL > Original
			const forceRaw = window.SYSTEMDECK_DEBUG_AUDIO && (window.location.hash === "#force-raw-midi" || window.SYSTEMDECK_FORCE_RAW_MIDI === true)
			const midiSource = forceRaw
				? item.source || item.url
				: metadata.midiDerivative || metadata.derivativeUrl || item.source || item.url

			if (forceRaw && window.SYSTEMDECK_DEBUG_AUDIO) {
				console.log("[MIDI DIAGNOSTICS] Forcing raw MIDI mode")
			}

			if (!midiSource) {
				this.emitState("error", {
					error: "Missing MIDI source",
					title: item.title,
				})
				return false
			}

			if (!window.SystemDeckAudio) {
				this.emitState("error", {
					error: "SystemDeckAudio unavailable",
					title: item.title,
				})
				return false
			}

			try {
				this.stopNativeOnly()
				await window.SystemDeckAudio.resume?.()
				if (Number(loadToken) !== Number(this._midiLoadToken)) return false

				// If midiSource is an object, it's already a derivative
				let isDerivative = typeof midiSource === "object" && midiSource !== null
				let parsedSource = midiSource

				if (
					!isDerivative &&
					typeof midiSource === "string" &&
					(midiSource.trim().startsWith("{") ||
						midiSource.trim().startsWith("["))
				) {
					try {
						parsedSource = JSON.parse(midiSource)
						isDerivative = true
					} catch (e) {
						console.warn(
							"[SystemDeckPlayback] Failed to parse MIDI JSON source",
							e,
						)
					}
				}

				if (isDerivative) {
					const loaded = await window.SystemDeckAudio.load(
						{
							type: "midi",
							id: item.id,
							data: parsedSource,
						},
						{
							title: item.title,
							metadata: metadata,
							autoplay: true,
						},
					)
					if (loaded) {
						if (Number(loadToken) !== Number(this._midiLoadToken))
							return false
						this.mode = "systemdeck"
						this._activeRoute = "midi"
						this.startPolling()
						const engineState = window.SystemDeckAudio.getState?.() || {}
						const now = engineState.nowPlaying || {}
						const duration = Number(now.duration || this.state.duration || 0)
						const currentTime = Number(now.currentTime || 0)
						const status = String(engineState.status || "playing").toLowerCase()
						this.emitState(
							status === "paused" ? "paused" : "playing",
							{
								title: metadata.title || item.title || now.title || "MIDI Track",
								currentTime,
								duration: Number.isFinite(duration) ? duration : 0,
								metadata: {
									...metadata,
									...(now.metadata || {}),
									mediaType: "midi",
									mime: metadata.mime || "audio/midi",
								},
							},
						)
						this.emitPlaylistState()
					}
					return loaded
				}

				const success = await window.SystemDeckAudio.playMidiTrack(
					midiSource,
					item.title,
					{
						trackId: item.id,
						metadata: metadata,
						autoplay: true,
					},
				)

				if (success) {
					if (Number(loadToken) !== Number(this._midiLoadToken))
						return false
					this.mode = "systemdeck"
					this._activeRoute = "midi"
					this.startPolling()
					const engineState = window.SystemDeckAudio.getState?.() || {}
					const now = engineState.nowPlaying || {}
					const duration = Number(now.duration || this.state.duration || 0)
					const currentTime = Number(now.currentTime || 0)
					const status = String(engineState.status || "playing").toLowerCase()
					this.emitState(status === "paused" ? "paused" : "playing", {
						title: metadata.title || item.title || now.title || "MIDI Track",
						currentTime,
						duration: Number.isFinite(duration) ? duration : 0,
						metadata: {
							...metadata,
							...(now.metadata || {}),
							mediaType: "midi",
							mime: metadata.mime || "audio/midi",
						},
					})
					this.emitPlaylistState()
				}

				return success
			} catch (e) {
				if (Number(loadToken) !== Number(this._midiLoadToken))
					return false
				console.error("[SystemDeckPlayback] MIDI error", e)
				this.emitState("error", { error: e.message, title: item.title })
				return false
			}
		}

		async playSystemDeckBuiltin(item) {
			const token = ++this._midiLoadToken
			const metadata = { ...(item.metadata || {}), title: item.title }
			const songId =
				metadata.songId ||
				metadata.builtinId ||
				String(item.source || "").replace(/^builtin:/, "")

			if (!songId) {
				this.emitState("error", { error: "Missing builtin song id", title: item.title })
				return false
			}

			if (!window.SystemDeckAudio) {
				this.emitState("error", { error: "SystemDeckAudio unavailable", title: item.title })
				return false
			}

			try {
				this.stopNativeOnly()
				await window.SystemDeckAudio.resume?.()
				if (Number(token) !== Number(this._midiLoadToken)) return false

				if (window.SystemDeckAudio.loadBuiltin) {
					await window.SystemDeckAudio.loadBuiltin(songId, { autoplay: true })
				} else {
					await window.SystemDeckAudio.load({ type: "track", id: songId }, {
						title: item.title,
						metadata: metadata,
						autoplay: true
					})
				}

				this.mode = "systemdeck"
				this._activeRoute = "builtin"
				this.startPolling()
				this.emitState("playing", {
					title: item.title,
					type: "builtin",
					origin: "builtin",
					metadata: metadata
				})

				return true
			} catch (e) {
				console.error("[SystemDeckPlayback] Builtin error", e)
				this.emitState("error", { error: e.message, title: item.title })
				return false
			}
		}

		/**
		 * Primary playback entry point
		 */
		async play(source, metadata = {}) {
			this.playbackId++
			const currentId = this.playbackId

			this.resetPlayback()
			const meta = { title: "Unknown", ...metadata }
			const type = this.detectType(source, meta)
			
			if (type === "native") {
				const url = typeof source === "string" ? source : source.url
				return this.playNative(url, meta, currentId)
			}

			const engineReady = await this.ensureEngine()
			if (!engineReady) {
				this.emitState("error", { 
					error: "SystemDeck audio engine unavailable.",
					title: meta.title 
				})
				return false
			}

			return this.playSystemDeck(source, meta)
		}

		/**
		 * Native Playback (Bypassing Tone for now to ensure stability)
		 */
		async playNative(url, meta, targetId) {
			try {
				this._midiLoadToken++
				this.resetPlayback()
				this.mode = "systemdeck"
				this._activeRoute = "file"
				this.emitState("loading", { title: meta.title || "Loading..." })
				this.audioEl = null
				this._activeNativeElement = null
				this.mediaSource = null
				const pid = targetId || this.playbackId

				if (!window.SystemDeckAudio) {
					throw new Error("SystemDeckAudio engine missing.")
				}

				const loadedAndPlaying = await window.SystemDeckAudio.playFile(url, {
					...(meta || {}),
					source: url,
					title: meta?.title || "Audio Track",
				})

				if (!loadedAndPlaying) {
					throw new Error("File playback failed.")
				}
				if (this.playbackId !== pid) return false

				this.startPolling()
				this.emitState("playing", {
					...meta,
					title: meta?.title || "Audio Track",
					engine: "systemdeck",
				})
				return true
			} catch (e) {
				// Suppress AbortError which is expected during rapid track switching
				if (e.name === "AbortError") return
				
				console.error("[SystemDeckPlayback] playNative failed", e)
				this.emitState("error", { error: e.message })
			}
		}

		setupNativeListeners(url, meta, audio, pid) {
			if (!audio) return

			const readNativeTime = () => {
				if (this.playbackId !== pid) return null
				
				const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
				const duration = Number.isFinite(audio.duration) ? audio.duration : 0
				
				return { currentTime, duration }
			}

			const emitTimeState = (status) => {
				const time = readNativeTime()
				if (!time) return

				this.emitState(status, {
					...meta,
					...time,
					source: url,
					engine: this.mode
				})
			}

			audio.addEventListener("loadedmetadata", () => emitTimeState("loading"))
			audio.addEventListener("durationchange", () => emitTimeState("playing"))
			audio.addEventListener("canplay", () => emitTimeState("playing"))
			audio.addEventListener("playing", () => emitTimeState("playing"))
			audio.addEventListener("pause", () => emitTimeState("paused"))
			audio.addEventListener("seeked", () => emitTimeState("playing"))
			
			audio.addEventListener("ended", () => {
				if (this.playbackId !== pid) return
				this.emitState("stopped", {
					...meta,
					currentTime: Number.isFinite(audio.duration) ? audio.duration : 0,
					duration: Number.isFinite(audio.duration) ? audio.duration : 0,
					source: url,
					engine: this.mode
				})
				this._emitTrackEnded({
					source: "native",
					reason: "native:ended",
					mode: this.mode,
				})
			})

			audio.addEventListener("error", (e) => {
				// 1. Guard against stale instances or active teardown
				if (this.playbackId !== pid || this.isResetting) return

				// 2. Suppress non-critical errors (Abort or Empty Src during cleanup)
				const code = audio.error?.code
				const msg = audio.error?.message || ""
				
				if (code === 1 || code === MediaError.MEDIA_ERR_ABORTED) return
				if (!audio.src || !audio.currentSrc) return
				if (code === 4 && msg.toLowerCase().includes("empty src")) return

				// 3. Log genuine playback failures
				console.warn("[SystemDeckPlayback] native audio error", {
					source: url,
					errorCode: code,
					errorMsg: msg,
					networkState: audio.networkState,
					readyState: audio.readyState
				})
				
				this.emitState("error", { error: "Native playback error" })
			})
			
			audio.addEventListener("timeupdate", () => {
				if (this.playbackId !== pid) return
				// Throttle updates in background
				if (document.hidden && Math.random() > 0.1) return
				emitTimeState("playing")
			})
		}

		/**
		 * Delegate to SystemDeckAudio (Tone.js engine)
		 */
		async playSystemDeck(source, meta) {
			try {
				this.resetPlayback()
				this.mode = "systemdeck"

				if (!window.SystemDeckAudio) {
					throw new Error("SystemDeckAudio engine missing.")
				}

				this.emitState("loading", { title: meta.title || "Loading SystemDeck..." })

				await window.SystemDeckAudio.load(source, {
					title: meta.title,
					metadata: meta,
					autoplay: true,
				})

				this.startPolling()

				this.emitState("playing", {
					...meta,
					title: meta.title || "MIDI Track",
					duration: 0,
					currentTime: 0,
					isMidi: true,
					engine: "systemdeck",
				})
			} catch (e) {
				this.emitState("error", { error: e.message })
			}
		}

		/**
		 * Toggle pause/play
		 */
		pause() {
			this.stopPolling()
			if (this.audioEl) {
				this.audioEl.pause()
			}
			if (window.SystemDeckAudio) {
				window.SystemDeckAudio.pause?.()
			}
			const snapshot = this.getState()
			this.emitState("paused", {
				title:
					snapshot?.nowPlaying?.title ||
					snapshot?.title ||
					this.state?.title ||
					"No source loaded.",
				currentTime: Number(
					snapshot?.nowPlaying?.currentTime ??
						snapshot?.currentTime ??
						0,
				),
				duration: Number(
					snapshot?.nowPlaying?.duration ??
						snapshot?.duration ??
						0,
				),
				metadata: {
					...(snapshot?.nowPlaying?.metadata ||
						snapshot?.metadata ||
						{}),
				},
			})
		}

		/**
		 * Resume playback
		 */
		async resume() {
			// If we have an active native element, just play it
			if (this.audioEl) {
				await this.audioEl.play()
				this.startPolling()
				this.emitState("playing")
				return
			}

			const snapshot = this.getState()
			const status = String(snapshot?.status || "").toLowerCase()
			if (status === "paused" && this.mode === "systemdeck" && window.SystemDeckAudio) {
				await window.SystemDeckAudio.resume?.()
				await window.SystemDeckAudio.play?.()
				this.startPolling()
				this.emitState("playing", {
					title:
						snapshot?.nowPlaying?.title ||
						snapshot?.title ||
						this.state?.title ||
						"No source loaded.",
					currentTime: Number(
						snapshot?.nowPlaying?.currentTime ??
							snapshot?.currentTime ??
							0,
					),
					duration: Number(
						snapshot?.nowPlaying?.duration ??
							snapshot?.duration ??
							0,
					),
					metadata: {
						...(snapshot?.nowPlaying?.metadata ||
							snapshot?.metadata ||
							{}),
					},
				})
				return
			}

			// If nothing is playing but we have a valid index, re-load that track
			if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
				await this.playIndex(this.currentIndex)
				return
			}

			// Fallback: Ensure we have an engine if nothing else
			await this.ensureEngine()
			if (window.SystemDeckAudio) {
				await window.SystemDeckAudio.resume?.()
				window.SystemDeckAudio.play?.()
			}
			this.startPolling()
			this.emitState("playing")
		}

		/**
		 * Stop all playback and clean up resources
		 */
		stop() {
			this._midiLoadToken++
			this._activeRoute = "none"
			const preservedIndex = this.currentIndex
			this.cleanup()
			this.currentIndex = preservedIndex // Preserve for resume
			this.emitState("stopped")
		}

		/**
		 * Stop all audio including global FX/Synths
		 */
		stopAll() {
			this._midiLoadToken++
			this._activeRoute = "none"
			const preservedIndex = this.currentIndex
			this.cleanupAll()
			this.currentIndex = preservedIndex
			this.emitState("stopped")
		}

		/**
		 * Internal resource cleanup
		 */
		cleanup() {
			this.isResetting = true
			if (this.audioEl) {
				this.audioEl.pause()
				this.audioEl.src = ""
				if (this.audioEl.parentNode) {
					this.audioEl.parentNode.removeChild(this.audioEl)
				}
				this.audioEl = null
			}
			this._activeNativeElement = null

			if (this.mediaSource) {
				try { this.mediaSource.disconnect() } catch (e) {}
				this.mediaSource = null
			}
			window.SystemDeckAudio?.stopNativeBridgeRetryLoop?.()

			if (window.SystemDeckAudio) {
				// Standard stop does not kill FX
				window.SystemDeckAudio.stop?.()
			}
			this.isResetting = false
		}

		/**
		 * Full cleanup including global FX authority
		 */
		cleanupAll() {
			this.isResetting = true
			if (this.audioEl) {
				this.audioEl.pause()
				this.audioEl.src = ""
				if (this.audioEl.parentNode) {
					this.audioEl.parentNode.removeChild(this.audioEl)
				}
				this.audioEl = null
			}
			this._activeNativeElement = null

			if (this.mediaSource) {
				try { this.mediaSource.disconnect() } catch (e) {}
				this.mediaSource = null
			}
			window.SystemDeckAudio?.stopNativeBridgeRetryLoop?.()

			if (window.SystemDeckAudio) {
				// stopAll kills music, MIDI, and FX
				window.SystemDeckAudio.stopAll?.()
			}
			this.isResetting = false
		}

		/**
		 * Helper to emit standardized playback state events
		 */
		emitState(status, detail = {}) {
			this.state = {
				...this.state,
				status,
				mode: this.mode,
				...detail
			}

			const state = this.getState()
			state.status = String(status || state.status || "idle")
			const signature = JSON.stringify({
				status: state.status,
				mode: state.mode,
				currentIndex: state.currentIndex,
				title:
					state.nowPlaying?.title ||
					state.title ||
					"",
				currentTime: Number(state.currentTime || 0).toFixed(2),
				duration: Number(state.duration || 0).toFixed(2),
			})
			const now = Date.now()
			if (
				signature === this._lastEmittedSignature &&
				now - this._lastEmittedAt < 120
			) {
				return
			}
			this._lastEmittedSignature = signature
			this._lastEmittedAt = now
			document.dispatchEvent(new CustomEvent("systemdeck:playback-state", {
				detail: state
			}))
		}
	}

	// Export singleton
	window.SystemDeckPlayback = new SystemDeckPlaybackAdapter()

})(jQuery)
