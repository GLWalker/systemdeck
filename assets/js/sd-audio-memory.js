/**
 * SystemDeck Audio Memory Adapter (Phase 4 skeleton)
 *
 * Manual-only client adapter for audio defaults/profile REST roundtrip.
 * No automatic hydration. No automatic save.
 *
 * @package SystemDeck
 */

;(function () {
	"use strict"

	const getNonce = () =>
		window.wpApiSettings?.nonce ||
		window.SYSTEMDECK_BOOTSTRAP?.config?.nonce ||
		window.sd_vars?.nonce ||
		""

	const getApiFetch = () => {
		if (window.wp?.apiFetch) return window.wp.apiFetch
		if (window.wp?.apiFetch?.default) return window.wp.apiFetch.default
		return null
	}

	const normalizeHashInput = (track = {}) => {
		if (window.SystemDeckAudioIdentity?.getTrackHashInput) {
			return window.SystemDeckAudioIdentity.getTrackHashInput(track)
		}
		return {
			source: String(track.source || track.url || track.src || ""),
			filename: String(track.filename || track.name || track.title || ""),
			extension: String(track.extension || track.file_type || ""),
			title: String(track.title || track.name || ""),
			origin: String(track.origin || ""),
			type: String(track.type || ""),
			attachmentId: track.attachmentId || track.attachment_id || null,
			id: track.id || null,
		}
	}

	const toHex = (buffer) =>
		Array.from(new Uint8Array(buffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")

	const fallbackHash = (text) => {
		// Deterministic fallback when SubtleCrypto is unavailable.
		let h1 = 0x811c9dc5
		let h2 = 0x811c9dc5
		for (let i = 0; i < text.length; i++) {
			const ch = text.charCodeAt(i)
			h1 ^= ch
			h1 += (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24)
			h2 ^= ch ^ 0x9e3779b9
			h2 += (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24)
		}
		const p1 = (h1 >>> 0).toString(16).padStart(8, "0")
		const p2 = (h2 >>> 0).toString(16).padStart(8, "0")
		return (p1 + p2 + p1 + p2 + p1 + p2 + p1 + p2).slice(0, 64)
	}

	const deriveTrackHash = async (track = {}) => {
		const input = normalizeHashInput(track)
		const text = JSON.stringify(input)
		const sourceUsed = String(
			track?.source || track?.url || track?.src || track?.stream_url || "",
		)
		try {
			if (window.crypto?.subtle?.digest) {
				const data = new TextEncoder().encode(text)
				const digest = await window.crypto.subtle.digest("SHA-256", data)
				const hash = toHex(digest)
				if (window.SystemDeckAudioDebug === true) {
					console.debug("[SystemDeckAudio:track-hash]", {
						input,
						hash,
						source: sourceUsed,
					})
				}
				return hash
			}
		} catch (e) {
			// Fall through to deterministic fallback
		}
		const fallback = fallbackHash(text)
		if (window.SystemDeckAudioDebug === true) {
			console.debug("[SystemDeckAudio:track-hash]", {
				input,
				hash: fallback,
				source: sourceUsed,
				fallback: true,
			})
		}
		return fallback
	}

	const request = async (path, data = {}) => {
		const apiFetch = getApiFetch()
		if (!apiFetch) {
			throw new Error("wp.apiFetch unavailable")
		}

		const nonce = getNonce()
		if (!nonce) {
			throw new Error("Missing REST nonce")
		}

		return apiFetch({
			path,
			method: "POST",
			headers: {
				"X-WP-Nonce": nonce,
			},
			data,
		})
	}

	const loadDefaults = async () => {
		return request("/systemdeck/v1/audio/defaults/load", {
			track_hash: "global-default",
		})
	}

	const saveDefaults = async (payload = {}) => {
		const defaults = payload && typeof payload === "object" ? payload : {}
		return request("/systemdeck/v1/audio/defaults/save", {
			track_hash: "global-default",
			defaults,
		})
	}

	const loadProfile = async (trackHash) => {
		const hash = String(trackHash || "").trim().toLowerCase()
		if (!hash) {
			throw new Error("trackHash is required for loadProfile")
		}
		return request("/systemdeck/v1/audio/profile/load", {
			track_hash: hash,
		})
	}

	const saveProfile = async (trackHash, payload = {}) => {
		const hash = String(trackHash || "").trim().toLowerCase()
		if (!hash) {
			throw new Error("trackHash is required for saveProfile")
		}
		const profile = payload && typeof payload === "object" ? payload : {}
		return request("/systemdeck/v1/audio/profile/save", {
			track_hash: hash,
			profile,
		})
	}

	const getCurrentTrack = () => {
		const state = window.SystemDeckPlayback?.getState?.() || {}
		return (
			state.track ||
			state.currentTrack ||
			state.item ||
			state.nowPlaying ||
			state.metadata ||
			null
		)
	}

	const getTrackFromDetail = (detail = {}) => {
		const d = detail && typeof detail === "object" ? detail : {}
		const playbackState = window.SystemDeckPlayback?.getState?.() || {}
		const sourceFallback = String(d.source || d.url || "")
		return {
			...(d.track || {}),
			...(d.currentTrack || {}),
			...(d.item || {}),
			...(d.file || {}),
			...(d.asset || {}),
			...(d.meta || {}),
			...(d.metadata || {}),
			...(playbackState.nowPlaying || {}),
			...(playbackState.nowPlaying?.metadata || {}),
			...(playbackState.metadata || {}),
			title:
				d.title ||
				d.meta?.title ||
				d.metadata?.title ||
				playbackState.nowPlaying?.title ||
				playbackState.title ||
				"",
			source:
				sourceFallback ||
				d.meta?.source ||
				d.metadata?.source ||
				playbackState.nowPlaying?.source ||
				playbackState.source ||
				playbackState.nowPlaying?.metadata?.source ||
				playbackState.metadata?.source ||
				"",
			url:
				String(d.url || d.meta?.url || d.metadata?.url || playbackState.url || ""),
		}
	}

	const extractProfileFromResponse = (response) => {
		if (!response || typeof response !== "object") return null
		if (response.profile && typeof response.profile === "object") {
			return response.profile
		}
		if (response.data?.profile && typeof response.data.profile === "object") {
			return response.data.profile
		}
		return null
	}

	const getSelectedPresetFromUI = () => {
		try {
			const el = document.querySelector('[data-role="eq-preset"]')
			const value = String(el?.value || "").trim()
			return value || ""
		} catch (_e) {
			return ""
		}
	}

	const captureCurrentProfile = () => {
		const eqState = window.SystemDeckAudio?.getEQState?.() || {}
		const selectedPreset = getSelectedPresetFromUI()
		const normalizedPreset =
			selectedPreset && selectedPreset.toLowerCase() !== "custom"
				? selectedPreset
				: String(eqState.preset || "Custom")
		const visualizerFrame = window.SystemDeckAudio?.getVisualizerFrame?.(24)
		const visualizer =
			visualizerFrame && Array.isArray(visualizerFrame.values)
				? {
						active: !!visualizerFrame.active,
						bars: visualizerFrame.values.length,
				  }
				: null

		const bands =
			eqState.bands && typeof eqState.bands === "object"
				? { ...eqState.bands }
				: {}
		const advanced =
			eqState.advanced && typeof eqState.advanced === "object"
				? Object.fromEntries(
						Object.entries(eqState.advanced).map(([key, value]) => [
							key,
							{
								frequency: Number(value?.frequency || 0),
								q: Number(value?.q || 1),
							},
						]),
				  )
				: {}

		return {
			preset: normalizedPreset,
			preamp: Number(eqState.preamp ?? eqState.masterGain ?? 1),
			masterGain: Number(eqState.masterGain ?? eqState.preamp ?? 1),
			bassBoost: !!eqState.bassBoost,
			bands,
			advanced,
			visualizer,
		}
	}

	const applyProfile = (profile = {}) => {
		if (!profile || typeof profile !== "object") return { applied: false }

		const presetName = String(profile.preset || "Custom")
		const payload = {
			preset: presetName,
			bands:
				profile.bands && typeof profile.bands === "object"
					? { ...profile.bands }
					: {},
			bassBoost: !!profile.bassBoost,
			masterGain: Number(profile.masterGain ?? profile.preamp ?? 1),
		}

		if (window.SystemDeckPlayback?.setEQ) {
			window.SystemDeckPlayback.setEQ(payload)
		} else if (window.SystemDeckAudio?.applyEQ) {
			window.SystemDeckAudio.applyEQ(payload)
		}

		if (window.SystemDeckPlayback?.setMasterGain) {
			window.SystemDeckPlayback.setMasterGain(payload.masterGain)
		}
		if (window.SystemDeckPlayback?.setBassBoost) {
			window.SystemDeckPlayback.setBassBoost(!!payload.bassBoost)
		}

		const advanced =
			profile.advanced && typeof profile.advanced === "object"
				? profile.advanced
				: {}
		// Preserve named preset label: advanced param writes mark engine preset as Custom.
		// Only apply advanced frequency/Q when profile itself is Custom.
		if (presetName.toLowerCase() === "custom") {
			Object.entries(advanced).forEach(([band, value]) => {
				const frequency = Number(value?.frequency)
				const q = Number(value?.q)
				if (Number.isFinite(frequency)) {
					window.SystemDeckAudio?.setBandFrequency?.(band, frequency)
				}
				if (Number.isFinite(q)) {
					window.SystemDeckAudio?.setBandQ?.(band, q)
				}
			})
		}

		return { applied: true, profile: payload }
	}

	window.SystemDeckAudioMemory = {
		loadDefaults,
		saveDefaults,
		loadProfile,
		saveProfile,
		deriveTrackHash,
		getTrackFromDetail,
		extractProfileFromResponse,
		captureCurrentProfile,
		applyProfile,
	}

	window.sdAudioDebug = {
		async saveDefaults(payload = {}) {
			const res = await window.SystemDeckAudioMemory.saveDefaults(payload)
			console.log("[sdAudioDebug] saveDefaults", res)
			return res
		},
		async loadDefaults() {
			const res = await window.SystemDeckAudioMemory.loadDefaults()
			console.log("[sdAudioDebug] loadDefaults", res)
			return res
		},
		async saveCurrentProfile(payload = {}) {
			const track = getTrackFromDetail({ track: getCurrentTrack() })
			if (!track) throw new Error("No active track available")
			const trackHash = await window.SystemDeckAudioMemory.deriveTrackHash(track)
			const captured = window.SystemDeckAudioMemory.captureCurrentProfile()
			const profile =
				payload && typeof payload === "object" && Object.keys(payload).length
					? payload
					: captured
			const res = await window.SystemDeckAudioMemory.saveProfile(trackHash, profile)
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[sdAudioDebug:saveCurrentProfile]", {
					track,
					trackHash,
				})
			}
			console.log("[sdAudioDebug] saveCurrentProfile", { trackHash, res })
			return { trackHash, res }
		},
		async loadCurrentProfile() {
			const track = getTrackFromDetail({ track: getCurrentTrack() })
			if (!track) throw new Error("No active track available")
			const trackHash = await window.SystemDeckAudioMemory.deriveTrackHash(track)
			const res = await window.SystemDeckAudioMemory.loadProfile(trackHash)
			const loadedProfile =
				window.SystemDeckAudioMemory.extractProfileFromResponse(res)
			if (loadedProfile) {
				window.SystemDeckAudioMemory.applyProfile(loadedProfile)
			}
			if (window.SystemDeckAudioDebug === true) {
				console.debug("[sdAudioDebug:loadCurrentProfile]", {
					track,
					trackHash,
					hasProfile: !!loadedProfile,
				})
			}
			console.log("[sdAudioDebug] loadCurrentProfile", { trackHash, res })
			return { trackHash, res }
		},
	}
})()
