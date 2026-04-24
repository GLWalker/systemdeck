/**
 * SystemDeck Shared Audio Engine
 * High-fidelity synthesis and arrangement engine.
 */
window.SystemDeckAudio = (() => {
	"use strict"

	if (
		typeof window !== "undefined" &&
		window.SystemDeckAudio &&
		typeof window.SystemDeckAudio === "object" &&
		typeof window.SystemDeckAudio.getState === "function"
	) {
		console.warn("[SystemDeckAudio] already initialized")
		return window.SystemDeckAudio
	}

	const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
	const SCRIPT_PROMISES = {}
	const getAudioAssetConfig = () =>
		typeof window !== "undefined" ? window.SYSTEMDECK_AUDIO_ASSETS || {} : {}
	const buildAssetUrl = (url, version) => {
		if (!url) return ""
		if (!version) return String(url)
		const separator = String(url).includes("?") ? "&" : "?"
		return `${url}${separator}ver=${encodeURIComponent(version)}`
	}
	const loadScriptOnce = (key, url) => {
		if (!url) return Promise.reject(new Error(`Missing script URL for ${key}.`))
		if (SCRIPT_PROMISES[key]) return SCRIPT_PROMISES[key]
		SCRIPT_PROMISES[key] = new Promise((resolve, reject) => {
			const existing = document.querySelector(`script[data-systemdeck-script="${key}"]`)
			if (existing?.dataset?.loaded === "true") {
				resolve()
				return
			}
			const handleError = () => {
				delete SCRIPT_PROMISES[key]
				reject(new Error(`Failed to load ${key}.`))
			}
			if (existing) {
				existing.addEventListener(
					"load",
					() => {
						existing.dataset.loaded = "true"
						resolve()
					},
					{ once: true },
				)
				existing.addEventListener("error", handleError, { once: true })
				return
			}
			const script = document.createElement("script")
			script.src = url
			script.async = true
			script.dataset.systemdeckScript = key
			script.addEventListener(
				"load",
				() => {
					script.dataset.loaded = "true"
					resolve()
				},
				{ once: true },
			)
			script.addEventListener("error", handleError, { once: true })
			document.head.appendChild(script)
		})
		return SCRIPT_PROMISES[key]
	}

	const SONG_DATA = {
		metal: {
			tempo: 104,
			arrangement: [
				"intro",
				"intro",
				"intro",
				"intro",
				"riff_intro",
				"riff_intro",
				"verse",
				"verse",
				"verse",
				"verse",
				"pre_chorus",
				"pre_chorus",
				"chorus",
				"chorus",
				"chorus",
				"chorus",
				"riff_main",
				"riff_main",
				"verse",
				"verse",
				"chorus",
				"chorus",
				"bridge",
				"bridge",
				"intro",
				"intro",
				"chorus",
				"chorus",
				"chorus",
				"chorus",
				"outro",
				"outro",
			],
			patterns: {
				intro: {
					bass: [33, 0, 0, 0, 33, 0, 0, 0, 33, 0, 0, 0, 33, 0, 0, 0],
					synth: [
						69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 65, 0, 67, 0, 0, 0,
					],
					bell: [0, 0, 0, 0, 93, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0],
					drums: ["k", 0, 0, 0, 0, 0, 0, 0, "k", 0, 0, 0, 0, 0, 0, 0],
				},
				riff_intro: {
					bass: [
						33, 33, 0, 36, 33, 0, 38, 33, 39, 38, 0, 36, 33, 0, 0,
						0,
					],
					synth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					bell: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						0,
						"h",
						0,
						"s",
						0,
						"h",
						0,
						"k",
						"k",
						"h",
						0,
						"s",
						0,
						"h",
						0,
					],
				},
				riff_main: {
					bass: [
						33, 33, 36, 33, 38, 33, 40, 39, 33, 33, 36, 33, 31, 32,
						33, 33,
					],
					synth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				verse: {
					bass: [
						33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33,
						33, 33,
					],
					synth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					bell: [0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 60, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"k",
						"k",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
					],
				},
				pre_chorus: {
					bass: [
						26, 26, 26, 26, 28, 28, 28, 28, 29, 29, 29, 29, 31, 31,
						31, 31,
					],
					synth: [
						62, 62, 62, 62, 64, 64, 64, 64, 65, 65, 65, 65, 67, 67,
						67, 67,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				chorus: {
					bass: [
						38, 38, 38, 38, 36, 36, 36, 36, 34, 34, 34, 34, 33, 33,
						33, 33,
					],
					synth: [
						81, 0, 81, 0, 79, 0, 79, 0, 77, 0, 77, 0, 74, 0, 0, 0,
					],
					bell: [0, 0, 93, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				bridge: {
					bass: [
						26, 0, 26, 0, 28, 0, 28, 0, 29, 0, 29, 0, 31, 0, 31, 0,
					],
					synth: [
						74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 82, 0, 84, 0, 86, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				outro: {
					bass: [
						33, 0, 33, 0, 33, 0, 33, 0, 26, 0, 26, 0, 33, 0, 0, 0,
					],
					synth: [69, 0, 0, 0, 69, 0, 0, 0, 57, 0, 0, 0, 45, 0, 0, 0],
					drums: ["k", 0, 0, 0, 0, 0, 0, 0, "k", 0, 0, 0, 0, 0, 0, 0],
				},
			},
		},
		oldies: {
			tempo: 150,
			arrangement: [
				"intro",
				"intro",
				"main_riff",
				"main_riff",
				"verse",
				"verse",
				"main_riff",
				"main_riff",
				"verse",
				"verse",
				"solo",
				"solo",
				"main_riff",
				"main_riff",
				"outro",
			],
			patterns: {
				intro: {
					bass: [
						36, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 43, 0, 41, 40,
					],
					surf: [
						60, 0, 0, 0, 65, 0, 0, 0, 67, 0, 0, 0, 67, 0, 65, 64,
					],
					drums: [
						"k",
						0,
						0,
						0,
						"s",
						0,
						0,
						0,
						"k",
						0,
						0,
						0,
						"s",
						0,
						0,
						0,
					],
				},
				main_riff: {
					bass: [
						36, 36, 40, 40, 41, 41, 45, 45, 43, 43, 47, 47, 43, 41,
						40, 38,
					],
					surf: [
						60, 0, 64, 60, 65, 0, 69, 65, 67, 0, 71, 67, 67, 65, 64,
						62,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				verse: {
					bass: [
						36, 36, 36, 36, 41, 41, 41, 41, 43, 43, 43, 43, 43, 41,
						40, 38,
					],
					surf: [0, 0, 60, 0, 0, 0, 65, 0, 0, 0, 67, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
					],
				},
				solo: {
					bass: [
						36, 40, 43, 40, 41, 45, 48, 45, 43, 47, 50, 47, 43, 41,
						40, 38,
					],
					surf: [
						72, 72, 74, 72, 77, 77, 79, 77, 81, 81, 79, 77, 72, 72,
						70, 67,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				outro: {
					bass: [
						36, 0, 41, 0, 43, 0, 0, 0, 36, 0, 41, 0, 43, 0, 36, 0,
					],
					surf: [
						60, 0, 65, 0, 67, 0, 0, 0, 60, 0, 65, 0, 67, 0, 60, 0,
					],
					drums: [
						"k",
						0,
						0,
						0,
						"s",
						0,
						0,
						0,
						"k",
						0,
						0,
						0,
						"s",
						0,
						"k",
						0,
					],
				},
			},
		},
		country: {
			tempo: 78,
			// Full song structure mapped bar-by-bar
			arrangement: [
				// Intro
				"D",
				"D",
				"Am7",
				"Am7",
				"F",
				"F",
				"D",
				"Riff1",
				// Verse 1
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"Am7",
				"D",
				"Am7",
				"G",
				"D",
				// Verse 2
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"Am7",
				"D",
				"Am7",
				"G",
				"D",
				// Pre-Chorus 1
				"G",
				"F",
				"C",
				"G",
				"G",
				"F",
				"C",
				"G",
				"Riff1",
				// Chorus 1
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"Am7",
				"D",
				"Am7",
				"G",
				"D",
				// Verse 3
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"D",
				"G",
				"Am7",
				"D",
				"Am7",
				"G",
				"D",
				// Pre-Chorus 2
				"G",
				"F",
				"C",
				"G",
				"G",
				"F",
				"C",
				"G",
				"Riff2",
				// Chorus 2
				"D",
				"Am7",
				"G",
				"D",
				"D",
				"Am7",
				"G",
				"Am7",
				"D",
				"Am7",
				"G",
				"D",
				// Outro
				"Riff1",
				"D",
				"D",
			],
			patterns: {
				D: {
					bass: [
						26, 0, 38, 0, 26, 0, 38, 0, 26, 0, 38, 0, 26, 0, 38, 0,
					],
					twang: [
						50, 0, 54, 0, 57, 0, 54, 0, 50, 0, 54, 0, 57, 0, 54, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				Am7: {
					bass: [
						33, 0, 45, 0, 33, 0, 45, 0, 33, 0, 45, 0, 33, 0, 45, 0,
					],
					twang: [
						45, 0, 48, 0, 52, 0, 48, 0, 45, 0, 48, 0, 52, 0, 48, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				G: {
					bass: [
						31, 0, 43, 0, 31, 0, 43, 0, 31, 0, 43, 0, 31, 0, 43, 0,
					],
					twang: [
						43, 0, 47, 0, 50, 0, 47, 0, 43, 0, 47, 0, 50, 0, 47, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				F: {
					bass: [
						29, 0, 41, 0, 29, 0, 41, 0, 29, 0, 41, 0, 29, 0, 41, 0,
					],
					twang: [
						41, 0, 45, 0, 48, 0, 45, 0, 41, 0, 45, 0, 48, 0, 45, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				C: {
					bass: [
						36, 0, 48, 0, 36, 0, 48, 0, 36, 0, 48, 0, 36, 0, 48, 0,
					],
					twang: [
						48, 0, 52, 0, 55, 0, 52, 0, 48, 0, 52, 0, 55, 0, 52, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"k",
						"s",
						"h",
					],
				},
				// Translating the 3p2p0 pull-offs to precise MIDI steps
				Riff1: {
					bass: [26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					twang: [
						53, 52, 50, 0, 48, 47, 45, 0, 45, 0, 41, 0, 0, 0, 0, 0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"h",
					],
				},
				Riff2: {
					bass: [26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					twang: [
						58, 57, 55, 0, 53, 52, 50, 0, 47, 48, 47, 45, 41, 38, 0,
						0,
					],
					drums: [
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"h",
						"k",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"h",
					],
				},
			},
		},
		hiphop: {
			tempo: 94, // Slowed down slightly for that heavy Houston bounce
			arrangement: [
				// Intro (Main Riff x2)
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",

				// Verse 1 (At night I can't sleep...)
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",

				// Chorus (Main Riff)
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",

				// Verse 2 (I make big money...)
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",

				// Chorus (Main Riff)
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",

				// Verse 3 (Day by day...)
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",

				// Chorus (Main Riff)
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",

				// Verse 4 (This year Halloween...)
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",
				"Verse_Bm7",
				"Verse_Em7",

				// Outro (Main Riff fading out)
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",
				"Riff_Bm7",
				"Riff_Em7",
			],
			patterns: {
				// The Verse patterns are stripped down. Deep 808 sub-bass holding the roots
				// with a classic, head-nodding kick/snare boom-bap drum pattern.
				Verse_Bm7: {
					bass: [35, 0, 0, 0, 35, 0, 0, 35, 0, 0, 0, 0, 35, 0, 0, 0], // MIDI 35 = B1
					piano: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"h",
						"h",
					],
				},
				Verse_Em7: {
					bass: [28, 0, 0, 0, 28, 0, 0, 28, 0, 0, 0, 0, 28, 0, 0, 0], // MIDI 28 = E1
					piano: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"h",
						"h",
					],
				},

				// The Riff patterns introduce the exact guitar tab translated to MIDI keys
				Riff_Bm7: {
					bass: [35, 0, 0, 0, 35, 0, 0, 35, 0, 0, 0, 0, 35, 0, 0, 0],
					// Tab: 9, 12-12-12, 9, 12, 14, 9 on the B string
					piano: [
						0, 68, 0, 71, 71, 0, 71, 0, 68, 0, 71, 0, 73, 0, 68, 0,
					],
					drums: [
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"h",
						"h",
					],
				},
				Riff_Em7: {
					bass: [28, 0, 0, 0, 28, 0, 0, 28, 0, 0, 0, 0, 28, 0, 0, 0],
					// Tab: 7, 9-9-9, 6, 9, 9 on the B and G strings
					piano: [
						0, 66, 0, 0, 64, 0, 64, 0, 64, 0, 61, 0, 64, 0, 64, 0,
					],
					drums: [
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"k",
						"h",
						"h",
						"h",
						"s",
						"h",
						"h",
						"h",
					],
				},
			},
		},
		spicy: {
			tempo: 102,
			arrangement: [
				// Intro Riff (Translating the full tab)
				"Riff_A",
				"Riff_B",
				"Riff_C",
				"A",
				// Verse 1 (yo se que tienes...)
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				// Chorus (como la flor...)
				"D",
				"E",
				"A",
				"Fsm",
				"D",
				"E",
				"D_E",
				"A",
				"D_E",
				"A",
				// Interlude (Short Riff)
				"Riff_Short",
				"A",
				// Verse 2 (si vieras como duele...)
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				"A",
				"D",
				"E",
				// Chorus
				"D",
				"E",
				"A",
				"Fsm",
				"D",
				"E",
				"D_E",
				"A",
				"D_E",
				"A",
				// Outro Riff
				"Riff_A",
				"Riff_B",
				"Riff_C",
				"A",
			],
			patterns: {
				A: {
					// Deep 808-style Reggaeton bounce on the root note
					bass: [
						33, 0, 0, 33, 0, 0, 33, 0, 33, 0, 0, 33, 0, 0, 33, 0,
					],
					horn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				D: {
					bass: [
						26, 0, 0, 26, 0, 0, 26, 0, 26, 0, 0, 26, 0, 0, 26, 0,
					],
					horn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				E: {
					bass: [
						28, 0, 0, 28, 0, 0, 28, 0, 28, 0, 0, 28, 0, 0, 28, 0,
					],
					horn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				Fsm: {
					bass: [
						30, 0, 0, 30, 0, 0, 30, 0, 30, 0, 0, 30, 0, 0, 30, 0,
					],
					horn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				D_E: {
					// Split bar for the "pero a-a-ay" transition
					bass: [
						26, 0, 0, 26, 0, 0, 26, 0, 28, 0, 0, 28, 0, 0, 28, 0,
					],
					horn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				// Translating the iconic Intro/Outro synth melody Tab
				Riff_A: {
					bass: [
						26, 0, 0, 26, 0, 0, 26, 0, 26, 0, 0, 26, 0, 0, 26, 0,
					],
					horn: [
						74, 0, 70, 0, 72, 0, 75, 74, 0, 70, 0, 67, 69, 70, 0,
						72,
					],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				Riff_B: {
					bass: [
						28, 0, 0, 28, 0, 0, 28, 0, 28, 0, 0, 28, 0, 0, 28, 0,
					],
					horn: [
						0, 75, 74, 0, 77, 0, 69, 70, 0, 72, 0, 74, 72, 0, 70, 0,
					],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				Riff_C: {
					bass: [
						33, 0, 0, 33, 0, 0, 33, 0, 33, 0, 0, 33, 0, 0, 33, 0,
					],
					horn: [70, 0, 69, 0, 67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
				// The interlude short riff Tab
				Riff_Short: {
					bass: [
						33, 0, 0, 33, 0, 0, 33, 0, 33, 0, 0, 33, 0, 0, 33, 0,
					],
					horn: [
						75, 0, 74, 0, 77, 0, 69, 70, 0, 72, 0, 74, 72, 0, 70, 0,
					],
					drums: [
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
						"k",
						"h",
						"h",
						"s",
						"h",
						"h",
						"s",
						"h",
					],
				},
			},
		},
	}
	/*
	class SystemDeckAudio {
		static getInstance() {
			return new SystemDeckAudio()
		}

		constructor() {
			if (SystemDeckAudio._instance) return SystemDeckAudio._instance

			this.audioContext = null
			this.master = null
			this.fxGain = null
			this.musicGain = null
			this.fileGain = null
			this.bassGain = null
			this.synthGain = null
			this.drumGain = null
			this.bassBoostFilter = null
			this.bassBoostEnabled = false
			this.musicTimer = null
			this.musicIndex = 0
			this.currentTrack = "metal"
			this.muted = false
			this.fxVolume = 0.7
			this.musicVolume = 0.45
			this.mixLevels = { bass: 1, synth: 1, drums: 1 }
			this.shaper = null
			this.lastBassFreq = null
			this.noiseBuffer = null
			this.songs = {}
			this.handleGlobalAudioSettingsChange = () => {
				this.refreshOutputVolumes()
			}
			if (typeof window !== "undefined" && window.addEventListener) {
				window.addEventListener(
					"systemdeck:audio-settings-changed",
					this.handleGlobalAudioSettingsChange,
				)
			}
			const defaultMixByTrack = {
				metal: { bass: 1.2, synth: 0.95, drums: 1.1 },
				oldies: { bass: 0.9, synth: 1.05, drums: 0.85 },
				country: { bass: 1.0, synth: 0.95, drums: 0.9 },
				hiphop: { bass: 1.35, synth: 1.0, drums: 1.15 },
				spicy: { bass: 1.25, synth: 1.1, drums: 1.0 },
			}
			const titleByTrack = {
				metal: "Heavy Metal",
				oldies: "Oldies",
				country: "Country / Western",
				hiphop: "Hip Hop",
				spicy: "Spicy",
			}
			Object.entries(SONG_DATA).forEach(([id, data]) => {
				this.registerSong(
					id,
					titleByTrack[id] || id,
					data,
					defaultMixByTrack[id] || { bass: 1, synth: 1, drums: 1 },
				)
			})
		}

		registerSong(
			id,
			title,
			data,
			defaultMix = { bass: 1, synth: 1, drums: 1 },
		) {
			if (!id || !data || !data.arrangement || !data.patterns) return
			this.songs[id] = {
				title: String(title || id),
				data,
				defaultMix: {
					bass: Number(defaultMix.bass ?? 1),
					synth: Number(defaultMix.synth ?? 1),
					drums: Number(defaultMix.drums ?? 1),
				},
			}
		}

		getRegisteredSongs() {
			return Object.entries(this.songs).map(([id, song]) => ({
				id,
				title: song.title,
			}))
		}

		subscribe(listener) {
			if (typeof listener !== "function") return () => {}
			this.subscribers.add(listener)
			try {
				listener(this.getState())
			} catch (_err) {}
			return () => {
				this.subscribers.delete(listener)
			}
		}

		on(event, callback) {
			if (!this.eventListeners.has(event) || typeof callback !== "function") {
				return () => {}
			}
			this.eventListeners.get(event).add(callback)
			return () => this.off(event, callback)
		}

		off(event, callback) {
			if (!this.eventListeners.has(event) || typeof callback !== "function") {
				return
			}
			this.eventListeners.get(event).delete(callback)
		}

		emitEvent(event, payload) {
			if (!this.eventListeners.has(event)) return
			this.eventListeners.get(event).forEach((callback) => {
				try {
					callback(payload)
				} catch (_err) {}
			})
		}

		normalizeStatus(status) {
			const allowed = new Set([
				"idle",
				"loading",
				"playing",
				"paused",
				"stopped",
				"error",
			])
			return allowed.has(status) ? status : "idle"
		}

		normalizeMode(mode) {
			return mode === "file" ? "file" : "track"
		}

		getState() {
			const nowPlaying = this.playbackState.nowPlaying || {}
			const mix = {
				bass: Number(this.mixLevels?.bass ?? 1),
				synth: Number(this.mixLevels?.synth ?? 1),
				drums: Number(this.mixLevels?.drums ?? 1),
			}
			return {
				status: this.normalizeStatus(this.playbackState.status),
				nowPlaying: {
					type: this.normalizeMode(
						nowPlaying.type || this.playbackState.mode || "track",
					),
					id: nowPlaying.id ?? null,
					title: String(nowPlaying.title || ""),
					duration: Number(nowPlaying.duration || 0),
					currentTime: Number(nowPlaying.currentTime || 0),
					source: String(nowPlaying.source || ""),
					metadata: { ...(nowPlaying.metadata || {}) },
				},
				volume: this.clamp(this.musicVolume, 0, 1),
				bassBoost: !!this.bassBoostEnabled,
				mix,
				mixLevels: { ...mix },
				mode: this.normalizeMode(this.playbackState.mode),
				error: this.playbackState.error
					? { message: String(this.playbackState.error.message || "") }
					: null,
			}
		}

		getPlaybackState() {
			const state = this.getState()
			const nowPlaying = state.nowPlaying || {}
			return {
				...state,
				currentTime: Number(nowPlaying.currentTime || 0),
				duration: Number(nowPlaying.duration || 0),
				musicVolume: state.volume,
				bassBoostEnabled: state.bassBoost,
				error: state.error?.message || "",
				reason: String(this.playbackState.reason || ""),
				queue: this.queue.map((item) => ({
					title: item?.meta?.title || item?.meta?.name || "Untitled",
					source: String(item?.source || ""),
					meta: { ...(item?.meta || {}) },
				})),
				queueIndex: this.queueIndex,
				fxVolume: this.fxVolume,
				mixLevels: { ...this.mixLevels },
				currentTrack: this.currentTrack,
			}
		}

		getNowPlaying() {
			return { ...this.getState().nowPlaying }
		}

		getMode() {
			return this.normalizeMode(this.playbackState.mode)
		}

		emitPlaybackState(reason = "update", patch = {}) {
			const nextStatus = this.normalizeStatus(
				String(patch.status || this.playbackState.status || "idle"),
			)
			const nextMode = this.normalizeMode(
				String(patch.mode || this.playbackState.mode || "track"),
			)
			const previousNowPlaying = this.playbackState.nowPlaying || {}
			const patchNowPlaying =
				patch.nowPlaying && typeof patch.nowPlaying === "object"
					? patch.nowPlaying
					: {}
			const nextNowPlaying = {
				...previousNowPlaying,
				...patchNowPlaying,
				id:
					patch.id ??
					patchNowPlaying.id ??
					previousNowPlaying.id ??
					null,
				title: String(
					patch.title ??
						patchNowPlaying.title ??
						previousNowPlaying.title ??
						"",
				),
				duration: Number(
					patch.duration ??
						patchNowPlaying.duration ??
						previousNowPlaying.duration ??
						0,
				),
				currentTime: Number(
					patch.currentTime ??
						patchNowPlaying.currentTime ??
						previousNowPlaying.currentTime ??
						0,
				),
				source: String(
					patch.source ??
						patchNowPlaying.source ??
						previousNowPlaying.source ??
						"",
				),
				metadata: {
					...(previousNowPlaying.metadata || {}),
					...(patchNowPlaying.metadata || {}),
				},
			}
			const nowPlayingType =
				nextNowPlaying.type || (nextMode === "file" ? "file" : "track")
			this.playbackState = {
				...this.playbackState,
				...patch,
				status: nextStatus,
				mode: nextMode,
				nowPlaying: {
					type: this.normalizeMode(String(nowPlayingType)),
					id: nextNowPlaying.id ?? null,
					title: String(nextNowPlaying.title || ""),
					duration: Number(nextNowPlaying.duration || 0),
					currentTime: Number(nextNowPlaying.currentTime || 0),
					source: String(nextNowPlaying.source || ""),
					metadata: { ...(nextNowPlaying.metadata || {}) },
				},
				reason,
				volume: this.clamp(this.musicVolume, 0, 1),
				bassBoost: !!this.bassBoostEnabled,
				error: patch.error
					? { message: String(patch.error.message || patch.error) }
					: patch.status === "error"
						? this.playbackState.error || { message: "Playback error" }
						: null,
				queue: this.queue,
				queueIndex: this.queueIndex,
			}
			const snapshot = this.getState()
			this.subscribers.forEach((listener) => {
				try {
					listener(snapshot)
				} catch (_err) {}
			})
			this.emitEvent("statechange", snapshot)
			if (reason === "file:progress" || reason === "midi:progress")
				this.emitEvent("timeupdate", snapshot)
			if (reason === "file:ready" || reason === "loaded")
				this.emitEvent("loaded", snapshot)
			if (reason === "file:ended") this.emitEvent("ended", snapshot)
			if (snapshot.status === "playing") this.emitEvent("play", snapshot)
			if (snapshot.status === "paused") this.emitEvent("pause", snapshot)
			const isStopReason =
				typeof reason === "string" && reason.toLowerCase().includes("stop")
			if (isStopReason || (snapshot.status === "stopped" && reason !== "loaded"))
				this.emitEvent("stop", snapshot)
			if (snapshot.status === "error")
				this.emitEvent("error", snapshot.error || { message: "Playback error" })
			if (typeof window !== "undefined" && window.dispatchEvent) {
				window.dispatchEvent(
					new CustomEvent("systemdeck:audio-player-state", {
						detail: this.getPlaybackState(),
					}),
				)
			}
		}

		clearFileProgressTimer() {
			if (this.fileProgressTimer) {
				clearInterval(this.fileProgressTimer)
				this.fileProgressTimer = null
			}
		}

		startFileProgressTimer() {
			this.clearFileProgressTimer()
			this.fileProgressTimer = window.setInterval(() => {
				if (!this.fileIsPlaying) return
				this.emitPlaybackState("file:progress")
			}, 250)
		}

		getFileCurrentTime() {
			if (!this.Tone || !this.fileIsPlaying) return this.filePausedAt || 0
			const now = this.Tone.now()
			const elapsed = Math.max(0, now - this.fileStartedAt)
			return this.fileDuration > 0
				? Math.min(this.fileDuration, elapsed)
				: elapsed
		}

		clearMidiProgressTimer() {
			if (this.midiProgressTimer) {
				clearInterval(this.midiProgressTimer)
				this.midiProgressTimer = null
			}
		}

		startMidiProgressTimer() {
			this.clearMidiProgressTimer()
			this.midiProgressTimer = window.setInterval(() => {
				if (!this.midiActive) return
				this.emitPlaybackState("midi:progress")
			}, 250)
		}

		clearMidiEndTimeout() {
			if (this.midiEndTimeout) {
				clearTimeout(this.midiEndTimeout)
				this.midiEndTimeout = null
			}
		}

		getMidiCurrentTime() {
			if (!this.Tone || !this.midiActive) return this.midiPausedAt || 0
			const elapsed = Math.max(0, this.Tone.now() - this.midiStartedAt)
			if (this.midiDuration > 0) return Math.min(this.midiDuration, elapsed)
			return elapsed
		}

		async sha256HexFromBuffer(arrayBuffer) {
			if (!arrayBuffer) return ""
			try {
				if (
					typeof crypto !== "undefined" &&
					crypto?.subtle &&
					typeof crypto.subtle.digest === "function"
				) {
					const digest = await crypto.subtle.digest("SHA-256", arrayBuffer)
					return Array.from(new Uint8Array(digest))
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join("")
				}
			} catch (_err) {}
			const bytes = new Uint8Array(arrayBuffer)
			let hash = 2166136261
			for (let i = 0; i < bytes.length; i++) {
				hash ^= bytes[i]
				hash +=
					(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
			}
			return `fnv1a-${(hash >>> 0).toString(16)}`
		}

		getMidiParser() {
			if (window.TonejsMidi && typeof window.TonejsMidi.Midi === "function")
				return window.TonejsMidi.Midi
			if (typeof window.Midi === "function") return window.Midi
			if (window.Midi && typeof window.Midi.Midi === "function")
				return window.Midi.Midi
			if (window.exports && typeof window.exports.Midi === "function")
				return window.exports.Midi
			if (
				window.exports &&
				window.exports.Midi &&
				typeof window.exports.Midi.Midi === "function"
			)
				return window.exports.Midi.Midi
			if (
				window.module &&
				window.module.exports &&
				typeof window.module.exports.Midi === "function"
			)
				return window.module.exports.Midi
			return null
		}

		async buildMidiDerivativeFromArrayBuffer(arrayBuffer, options = {}) {
			await this.ensureAudioLibraries({ midi: true })
			const MidiCtor = this.getMidiParser()
			if (!MidiCtor) throw new Error("@tonejs/midi parser is unavailable.")
			if (!arrayBuffer) throw new Error("MIDI source buffer is missing.")

			const midi = new MidiCtor(arrayBuffer)
			const sourceHash = await this.sha256HexFromBuffer(arrayBuffer)
			const tempos = Array.isArray(midi?.header?.tempos) ? midi.header.tempos : []
			const timeSignatures = Array.isArray(midi?.header?.timeSignatures)
				? midi.header.timeSignatures
				: []
			const tracks = Array.isArray(midi?.tracks) ? midi.tracks : []

			let noteCount = 0
			const derivativeTracks = tracks.map((track, index) => {
				const percussion =
					!!track?.instrument?.percussion || Number(track?.channel) === 9
				const family = String(track?.instrument?.family || "")
				const lane = percussion
					? "drums"
					: family.includes("bass")
						? "bass"
						: "synth"
				const notes = (Array.isArray(track?.notes) ? track.notes : []).map((note) => ({
					midi: Number(note?.midi || 0),
					time: Number(note?.time || 0),
					duration: Number(note?.duration || 0),
					velocity: Number(note?.velocity ?? 0.8),
					noteOffVelocity: Number(note?.noteOffVelocity ?? 0.8),
					ticks: Number(note?.ticks || 0),
					durationTicks: Number(note?.durationTicks || 0),
				}))
				noteCount += notes.length
				return {
					index,
					name: String(track?.name || track?.instrument?.name || `Track ${index + 1}`),
					channel: Number(track?.channel ?? -1),
					instrument: {
						number: Number(track?.instrument?.number ?? 0),
						name: String(track?.instrument?.name || ""),
						family: family,
						percussion,
					},
					lane,
					notes,
				}
			})

			return {
				schema: "systemdeck-midi-derivative",
				version: this.midiSchemaVersion,
				parser: {
					name: "@tonejs/midi",
					version: this.midiParserVersion,
				},
				source: {
					hash: sourceHash,
					sourceType: String(options?.sourceType || "player"),
					id: options?.id != null ? String(options.id) : null,
					title: String(options?.title || midi?.name || "MIDI Track"),
					mime: String(options?.mime || "audio/midi"),
					filename: String(options?.filename || ""),
					url: String(options?.url || ""),
				},
				timing: {
					ppq: Number(midi?.header?.ppq || 480),
					tempoMap: tempos.map((tempo) => ({
						bpm: Number(tempo?.bpm || 120),
						time: Number(tempo?.time || 0),
						ticks: Number(tempo?.ticks || 0),
					})),
					timeSignatures: timeSignatures.map((signature) => ({
						time: Number(signature?.time || 0),
						ticks: Number(signature?.ticks || 0),
						signature: Array.isArray(signature?.timeSignature)
							? signature.timeSignature.slice(0, 2).map((value) => Number(value || 0))
							: [4, 4],
					})),
				},
				tracks: derivativeTracks,
				playback: {
					duration: Number(midi?.duration || 0),
					durationTicks: Number(midi?.durationTicks || 0),
				},
				summary: {
					title: String(options?.title || midi?.name || "MIDI Track"),
					trackCount: derivativeTracks.length,
					noteCount,
					tempo: Number(tempos?.[0]?.bpm || 120),
					duration: Number(midi?.duration || 0),
				},
			}
		}

		normalizeMidiDerivative(derivative = {}) {
			if (!derivative || typeof derivative !== "object") return null
			if (String(derivative.schema || "") !== "systemdeck-midi-derivative")
				return null
			const tracks = Array.isArray(derivative.tracks) ? derivative.tracks : []
			const normalizedTracks = tracks.map((track, index) => ({
				index: Number(track?.index ?? index),
				name: String(track?.name || `Track ${index + 1}`),
				channel: Number(track?.channel ?? -1),
				lane: String(track?.lane || "synth"),
				instrument: {
					number: Number(track?.instrument?.number ?? 0),
					name: String(track?.instrument?.name || ""),
					family: String(track?.instrument?.family || ""),
					percussion: !!track?.instrument?.percussion,
				},
				notes: (Array.isArray(track?.notes) ? track.notes : [])
					.map((note) => ({
						midi: Number(note?.midi || 0),
						time: Math.max(0, Number(note?.time || 0)),
						duration: Math.max(0.01, Number(note?.duration || 0.05)),
						velocity: this.clamp(note?.velocity ?? 0.8, 0, 1),
						noteOffVelocity: this.clamp(note?.noteOffVelocity ?? 0.8, 0, 1),
						ticks: Number(note?.ticks || 0),
						durationTicks: Number(note?.durationTicks || 0),
					}))
					.filter((note) => note.midi > 0),
			}))
			return {
				...derivative,
				tracks: normalizedTracks,
				playback: {
					...(derivative.playback || {}),
					duration: Number(derivative?.playback?.duration || 0),
					durationTicks: Number(derivative?.playback?.durationTicks || 0),
				},
			}
		}

		getMidiCacheKey(payload = {}) {
			const sourceHash = String(payload?.source?.hash || "")
			const parserVersion = String(payload?.parser?.version || "")
			const schemaVersion = String(payload?.version || "")
			return `${sourceHash}:${parserVersion}:${schemaVersion}`
		}

		setPlaybackError(message) {
			this.emitPlaybackState("error", {
				error: { message: String(message || "Unknown playback error") },
				status: "error",
			})
		}

		buildNowPlaying(meta = {}, source = "") {
			const modeType = this.normalizeMode(String(meta.type || this.playbackState.mode || "track"))
			const title = String(meta.title || meta.name || meta.filename || "Untitled")
			const currentTime = this.fileIsPlaying ? this.getFileCurrentTime() : this.filePausedAt || 0
			return {
				type: modeType,
				id: meta.id ?? null,
				title,
				duration: Number(meta.duration || this.fileDuration || 0),
				currentTime: Number(currentTime || 0),
				source: String(source || meta.source || ""),
				metadata: { ...meta },
			}
		}

		ensureContext() {
			if (this.audioContext) return
			const AudioCtx = window.AudioContext || window.webkitAudioContext
			if (!AudioCtx) return

			this.audioContext = new AudioCtx()
			this.master = this.audioContext.createGain()
			this.fxGain = this.audioContext.createGain()
			this.musicGain = this.audioContext.createGain()
			this.bassGain = this.audioContext.createGain()
			this.synthGain = this.audioContext.createGain()
			this.drumGain = this.audioContext.createGain()
			this.bassBoostFilter = this.audioContext.createBiquadFilter()

			this.fxGain.gain.value = this.fxVolume
			this.musicGain.gain.value = this.musicVolume
			this.bassGain.gain.value = this.mixLevels.bass
			this.synthGain.gain.value = this.mixLevels.synth
			this.drumGain.gain.value = this.mixLevels.drums
			this.master.gain.value = 1.0
			this.bassBoostFilter.type = "lowshelf"
			this.bassBoostFilter.frequency.setValueAtTime(
				80,
				this.audioContext.currentTime,
			)
			this.bassBoostFilter.gain.setValueAtTime(
				0,
				this.audioContext.currentTime,
			)

			this.compressor = this.audioContext.createDynamicsCompressor()
			this.compressor.threshold.setValueAtTime(
				-24,
				this.audioContext.currentTime,
			)
			this.compressor.ratio.setValueAtTime(
				12,
				this.audioContext.currentTime,
			)

			this.shaper = this.audioContext.createWaveShaper()
			this.shaper.curve = this.makeDistortionCurve(400)
			this.shaper.oversample = "4x"

			// Phase 1: Strict Routing Matrix
			this.bassGain.connect(this.musicGain)
			this.synthGain.connect(this.musicGain)
			this.drumGain.connect(this.musicGain)
			this.musicGain.connect(this.bassBoostFilter)
			this.bassBoostFilter.connect(this.master)
			this.fxGain.connect(this.master)
			this.master.connect(this.compressor)
			this.compressor.connect(this.audioContext.destination)

			this.createNoiseBuffer()
			this.refreshOutputVolumes()
		}

		createNoiseBuffer() {
			const size = 2 * this.audioContext.sampleRate
			this.noiseBuffer = this.audioContext.createBuffer(
				1,
				size,
				this.audioContext.sampleRate,
			)
			const output = this.noiseBuffer.getChannelData(0)
			for (let i = 0; i < size; i++) {
				output[i] = Math.random() * 2 - 1
			}
		}

		makeDistortionCurve(amount) {
			const k = typeof amount === "number" ? amount : 50
			const n_samples = 44100
			const curve = new Float32Array(n_samples)
			const deg = Math.PI / 180
			for (let i = 0; i < n_samples; ++i) {
				const x = (i * 2) / n_samples - 1
				curve[i] =
					((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
			}
			return curve
		}

		resume() {
			this.ensureContext()
			if (this.audioContext?.state === "suspended")
				this.audioContext.resume().catch(() => {})
		}

		getGlobalVolumeMultiplier() {
			const audioConfig = window.SYSTEMDECK_ENV?.audio || null
			if (!audioConfig) return 1
			const parsed = Number(audioConfig.masterVolume ?? 1)
			if (!Number.isFinite(parsed)) return 1
			return Math.max(0, Math.min(1, parsed))
		}

		refreshOutputVolumes() {
			const globalVolume = this.getGlobalVolumeMultiplier()
			if (this.fxGain)
				this.fxGain.gain.value = this.fxVolume * globalVolume
			if (this.musicGain)
				this.musicGain.gain.value = this.musicVolume * globalVolume
		}

		setMuted(muted) {
			this.muted = !!muted
			if (this.master) this.master.gain.value = this.muted ? 0 : 1
		}

		setTrack(track) {
			if (this.songs[track]) {
				this.stopMidiPlayback(false)
				this.midiDerivative = null
				this.midiSourceHash = ""
				this.currentTrack = track
				this.musicIndex = 0
				this.lastBassFreq = null
				this.applyTrackDefaultMix(track)
				this.emitPlaybackState("track:set", {
					mode: "music",
					nowPlaying: {
						title: this.songs[track]?.title || track,
						source: track,
						mime: "application/x-systemdeck-track",
						origin: "systemdeck-track",
					},
					error: "",
				})
			}
		}

		setFxVolume(v) {
			const next = Number(v)
			this.fxVolume = Number.isFinite(next)
				? Math.max(0, Math.min(1, next))
				: this.fxVolume
			this.refreshOutputVolumes()
			this.emitPlaybackState("fx:volume")
		}

		setMusicVolume(v) {
			const next = Number(v)
			this.musicVolume = Number.isFinite(next)
				? Math.max(0, Math.min(1, next))
				: this.musicVolume
			this.refreshOutputVolumes()
			this.emitPlaybackState("music:volume")
		}

		setMixLevels(partial = {}) {
			this.mixLevels = {
				bass: Number(partial.bass ?? this.mixLevels.bass ?? 1),
				synth: Number(partial.synth ?? this.mixLevels.synth ?? 1),
				drums: Number(partial.drums ?? this.mixLevels.drums ?? 1),
			}
			if (this.bassGain) this.bassGain.gain.value = this.mixLevels.bass
			if (this.synthGain) this.synthGain.gain.value = this.mixLevels.synth
			if (this.drumGain) this.drumGain.gain.value = this.mixLevels.drums
		}

		setBassBoostEnabled(enabled) {
			this.bassBoostEnabled = !!enabled
			if (this.bassBoostFilter && this.audioContext) {
				this.bassBoostFilter.gain.setValueAtTime(
					this.bassBoostEnabled ? 9 : 0,
					this.audioContext.currentTime,
				)
			}
		}

		applyTrackDefaultMix(trackId) {
			const track = this.songs[trackId]
			if (!track) return
			this.setMixLevels(
				track.defaultMix || { bass: 1, synth: 1, drums: 1 },
			)
		}

		playTwang(midi, time, dur) {
			const osc1 = this.audioContext.createOscillator()
			const osc2 = this.audioContext.createOscillator()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			osc1.type = "square"
			osc2.type = "sawtooth"
			const freq = midiToHz(midi)
			osc1.frequency.setValueAtTime(freq, time)
			osc2.frequency.setValueAtTime(freq, time)

			filter.type = "highpass"
			filter.frequency.setValueAtTime(400, time)
			filter.frequency.exponentialRampToValueAtTime(800, time + 0.05)

			gain.gain.setValueAtTime(0.0001, time)
			gain.gain.linearRampToValueAtTime(0.06, time + 0.005)
			gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1)
			gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 1.5)

			osc1.connect(filter)
			osc2.connect(filter)
			filter.connect(gain)
			gain.connect(this.synthGain || this.musicGain)

			osc1.start(time)
			osc1.stop(time + dur * 2)
			osc2.start(time)
			osc2.stop(time + dur * 2)
		}

		playSurf(midi, time, dur) {
			const osc1 = this.audioContext.createOscillator()
			const osc2 = this.audioContext.createOscillator()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			osc1.type = "sawtooth"
			osc2.type = "sine"
			const freq = midiToHz(midi)
			osc1.frequency.setValueAtTime(freq, time)
			osc2.frequency.setValueAtTime(freq, time)

			filter.type = "bandpass"
			filter.frequency.setValueAtTime(2000, time)
			filter.Q.setValueAtTime(1, time)

			gain.gain.setValueAtTime(0.0001, time)
			gain.gain.linearRampToValueAtTime(0.07, time + 0.005)
			gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15)
			gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 2)

			osc1.connect(filter)
			osc2.connect(filter)
			filter.connect(gain)
			gain.connect(this.synthGain || this.musicGain)

			osc1.start(time)
			osc1.stop(time + dur * 3)
			osc2.start(time)
			osc2.stop(time + dur * 3)
		}

		playPiano(midi, time, dur) {
			const osc1 = this.audioContext.createOscillator()
			const osc2 = this.audioContext.createOscillator()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			osc1.type = "triangle"
			osc2.type = "sine"
			const freq = midiToHz(midi)
			osc1.frequency.setValueAtTime(freq + 1, time)
			osc2.frequency.setValueAtTime(freq - 1, time)

			filter.type = "lowpass"
			filter.frequency.setValueAtTime(1500, time)

			gain.gain.setValueAtTime(0.0001, time)
			gain.gain.linearRampToValueAtTime(0.05, time + 0.01)
			gain.gain.exponentialRampToValueAtTime(0.02, time + 0.2)
			gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 3)

			osc1.connect(filter)
			osc2.connect(filter)
			filter.connect(gain)
			gain.connect(this.synthGain || this.musicGain)

			osc1.start(time)
			osc1.stop(time + dur * 4)
			osc2.start(time)
			osc2.stop(time + dur * 4)
		}

		playFx(type) {
			this.resume()
			if (!this.audioContext || !this.fxGain) return

			const ctx = this.audioContext
			const now = ctx.currentTime
			const out = this.fxGain
			const rand = (min, max) => min + Math.random() * (max - min)

			const noiseBuffer = (() => {
				if (this._fxNoiseBuffer) return this._fxNoiseBuffer
				const length = Math.max(1, Math.floor(ctx.sampleRate * 0.35))
				const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
				const data = buffer.getChannelData(0)
				for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
				this._fxNoiseBuffer = buffer
				return buffer
			})()

			const env = (gainNode, peak, attack, release, when = now) => {
				gainNode.gain.cancelScheduledValues(when)
				gainNode.gain.setValueAtTime(0.0001, when)
				gainNode.gain.linearRampToValueAtTime(peak, when + attack)
				gainNode.gain.exponentialRampToValueAtTime(
					0.0001,
					when + attack + release,
				)
			}

			const tone = ({
				type = "sine",
				freq = 440,
				freqEnd = null,
				peak = 0.08,
				attack = 0.003,
				release = 0.12,
				when = now,
				detune = 0,
				filterType = null,
				filterFreq = 1200,
				filterQ = 0.7,
				target = out,
			}) => {
				const osc = ctx.createOscillator()
				const gain = ctx.createGain()
				let tail = gain

				osc.type = type
				osc.frequency.setValueAtTime(Math.max(20, freq), when)
				osc.detune.setValueAtTime(detune, when)

				if (freqEnd && freqEnd > 0) {
					osc.frequency.exponentialRampToValueAtTime(
						Math.max(20, freqEnd),
						when + attack + release,
					)
				}

				if (filterType) {
					const filter = ctx.createBiquadFilter()
					filter.type = filterType
					filter.frequency.setValueAtTime(filterFreq, when)
					filter.Q.setValueAtTime(filterQ, when)
					osc.connect(filter)
					filter.connect(gain)
				} else {
					osc.connect(gain)
				}

				gain.connect(target)
				env(gain, peak, attack, release, when)
				osc.start(when)
				osc.stop(when + attack + release + 0.03)
				return { osc, gain, tail }
			}

			const noise = ({
				peak = 0.05,
				attack = 0.002,
				release = 0.12,
				when = now,
				filterType = "highpass",
				filterFreq = 1200,
				filterQ = 0.8,
				target = out,
			}) => {
				const src = ctx.createBufferSource()
				const filter = ctx.createBiquadFilter()
				const gain = ctx.createGain()

				src.buffer = noiseBuffer
				filter.type = filterType
				filter.frequency.setValueAtTime(filterFreq, when)
				filter.Q.setValueAtTime(filterQ, when)

				src.connect(filter)
				filter.connect(gain)
				gain.connect(target)
				env(gain, peak, attack, release, when)

				src.start(when)
				src.stop(when + attack + release + 0.03)
				return { src, gain, filter }
			}

			const echoBus = ({
				delayTime = 0.12,
				feedbackAmount = 0.22,
				wetAmount = 0.28,
				lowpass = 1800,
			}) => {
				const input = ctx.createGain()
				const dry = ctx.createGain()
				const wet = ctx.createGain()
				const delay = ctx.createDelay(0.5)
				const feedback = ctx.createGain()
				const tone = ctx.createBiquadFilter()

				delay.delayTime.setValueAtTime(delayTime, now)
				feedback.gain.setValueAtTime(feedbackAmount, now)
				wet.gain.setValueAtTime(wetAmount, now)
				dry.gain.setValueAtTime(1, now)
				tone.type = "lowpass"
				tone.frequency.setValueAtTime(lowpass, now)

				input.connect(dry)
				dry.connect(out)

				input.connect(delay)
				delay.connect(tone)
				tone.connect(wet)
				wet.connect(out)

				delay.connect(feedback)
				feedback.connect(delay)

				return input
			}

			if (type === "systemdeck_boot") {
				tone({
					type: "triangle",
					freq: 220,
					freqEnd: 440,
					peak: 0.08,
					attack: 0.006,
					release: 0.18,
					filterType: "lowpass",
					filterFreq: 1800,
					filterQ: 0.7,
				})

				tone({
					type: "sine",
					freq: 440,
					freqEnd: 660,
					peak: 0.05,
					attack: 0.012,
					release: 0.22,
					when: now + 0.045,
					filterType: "bandpass",
					filterFreq: 2200,
					filterQ: 1.1,
				})

				tone({
					type: "triangle",
					freq: 880,
					freqEnd: 990,
					peak: 0.03,
					attack: 0.003,
					release: 0.12,
					when: now + 0.09,
					filterType: "highpass",
					filterFreq: 1400,
					filterQ: 0.8,
				})

				const shimmer = ctx.createBufferSource()
				const shimmerGain = ctx.createGain()
				const shimmerFilter = ctx.createBiquadFilter()

				shimmer.buffer = noiseBuffer
				shimmerFilter.type = "bandpass"
				shimmerFilter.frequency.setValueAtTime(3200, now)
				shimmerFilter.Q.setValueAtTime(1.6, now)

				shimmerGain.gain.setValueAtTime(0.0001, now)
				shimmerGain.gain.linearRampToValueAtTime(0.018, now + 0.01)
				shimmerGain.gain.exponentialRampToValueAtTime(
					0.0001,
					now + 0.12,
				)

				shimmer.connect(shimmerFilter)
				shimmerFilter.connect(shimmerGain)
				shimmerGain.connect(out)

				shimmer.start(now)
				shimmer.stop(now + 0.13)

				return
			}

			const effects = {
				systemdeck_boot: () => {
					const bus = echoBus({
						delayTime: 0.09,
						feedbackAmount: 0.18,
						wetAmount: 0.16,
						lowpass: 2200,
					})

					tone({
						type: "triangle",
						freq: 220,
						freqEnd: 440,
						peak: 0.08,
						attack: 0.006,
						release: 0.18,
						filterType: "lowpass",
						filterFreq: 1800,
						filterQ: 0.7,
						target: bus,
					})

					tone({
						type: "sine",
						freq: 440,
						freqEnd: 660,
						peak: 0.05,
						attack: 0.012,
						release: 0.22,
						when: now + 0.045,
						filterType: "bandpass",
						filterFreq: 2200,
						filterQ: 1.1,
						target: bus,
					})

					tone({
						type: "triangle",
						freq: 880,
						freqEnd: 990,
						peak: 0.03,
						attack: 0.003,
						release: 0.12,
						when: now + 0.09,
						filterType: "highpass",
						filterFreq: 1400,
						filterQ: 0.8,
						target: bus,
					})

					noise({
						peak: 0.012,
						attack: 0.001,
						release: 0.06,
						when: now + 0.01,
						filterType: "bandpass",
						filterFreq: 3200,
						filterQ: 1.6,
						target: bus,
					})
				},

				piece_rotate: () => {
					tone({
						type: "triangle",
						freq: rand(560, 620),
						freqEnd: rand(820, 900),
						peak: 0.05,
						attack: 0.002,
						release: 0.06,
						filterType: "highpass",
						filterFreq: 700,
						filterQ: 0.8,
					})
				},

				piece_move: () => {
					tone({
						type: "square",
						freq: rand(240, 280),
						freqEnd: rand(190, 220),
						peak: 0.028,
						attack: 0.001,
						release: 0.035,
						filterType: "bandpass",
						filterFreq: 900,
						filterQ: 1.2,
					})
				},

				piece_land: () => {
					tone({
						type: "square",
						freq: rand(170, 210),
						freqEnd: rand(68, 92),
						peak: 0.06,
						attack: 0.002,
						release: 0.09,
						filterType: "lowpass",
						filterFreq: 650,
						filterQ: 0.7,
					})
					noise({
						peak: 0.018,
						attack: 0.001,
						release: 0.05,
						filterType: "bandpass",
						filterFreq: 480,
						filterQ: 0.9,
					})
				},

				piece_land_heavy: () => {
					const bus = echoBus({
						delayTime: 0.14,
						feedbackAmount: 0.24,
						wetAmount: 0.22,
						lowpass: 1400,
					})

					tone({
						type: "sine",
						freq: rand(95, 120),
						freqEnd: rand(38, 52),
						peak: 0.16,
						attack: 0.002,
						release: 0.22,
						target: bus,
					})

					tone({
						type: "triangle",
						freq: rand(180, 220),
						freqEnd: rand(70, 88),
						peak: 0.06,
						attack: 0.001,
						release: 0.11,
						target: bus,
					})

					noise({
						peak: 0.025,
						attack: 0.001,
						release: 0.08,
						filterType: "bandpass",
						filterFreq: 320,
						filterQ: 0.8,
						target: bus,
					})
				},

				line_clear: () => {
					noise({
						peak: 0.04,
						attack: 0.002,
						release: 0.14,
						filterType: "highpass",
						filterFreq: 2200,
						filterQ: 0.7,
					})
					tone({
						type: "sawtooth",
						freq: rand(480, 560),
						freqEnd: rand(1250, 1450),
						peak: 0.06,
						attack: 0.002,
						release: 0.14,
						filterType: "highpass",
						filterFreq: 900,
						filterQ: 0.8,
					})
					tone({
						type: "triangle",
						freq: rand(760, 860),
						freqEnd: rand(1600, 1850),
						peak: 0.03,
						attack: 0.004,
						release: 0.12,
						filterType: "highpass",
						filterFreq: 1200,
						filterQ: 0.8,
						when: now + 0.012,
					})
				},

				column_clear: () => {
					noise({
						peak: 0.03,
						attack: 0.002,
						release: 0.15,
						filterType: "bandpass",
						filterFreq: 2600,
						filterQ: 1.4,
					})
					tone({
						type: "triangle",
						freq: rand(620, 720),
						freqEnd: rand(1250, 1420),
						peak: 0.04,
						attack: 0.003,
						release: 0.16,
						filterType: "highpass",
						filterFreq: 1400,
						filterQ: 1.1,
					})
					tone({
						type: "sine",
						freq: rand(980, 1120),
						freqEnd: rand(1800, 2100),
						peak: 0.025,
						attack: 0.002,
						release: 0.11,
						when: now + 0.015,
						filterType: "highpass",
						filterFreq: 1500,
						filterQ: 1.2,
					})
				},

				cascade: () => {
					tone({
						type: "triangle",
						freq: rand(500, 580),
						freqEnd: rand(1050, 1180),
						peak: 0.045,
						attack: 0.002,
						release: 0.08,
					})
					tone({
						type: "triangle",
						freq: rand(760, 840),
						freqEnd: rand(1500, 1700),
						peak: 0.03,
						attack: 0.002,
						release: 0.08,
						when: now + 0.03,
					})
				},

				danger: () => {
					tone({
						type: "sawtooth",
						freq: 180,
						freqEnd: 140,
						peak: 0.06,
						attack: 0.002,
						release: 0.12,
						filterType: "bandpass",
						filterFreq: 700,
						filterQ: 1,
					})
					tone({
						type: "square",
						freq: 1200,
						freqEnd: 900,
						peak: 0.02,
						attack: 0.001,
						release: 0.06,
						when: now + 0.01,
						filterType: "highpass",
						filterFreq: 1300,
						filterQ: 0.8,
					})
				},

				player_shot: () => {
					tone({
						type: "square",
						freq: rand(780, 920),
						freqEnd: rand(240, 320),
						peak: 0.045,
						attack: 0.001,
						release: 0.06,
						filterType: "highpass",
						filterFreq: 1100,
						filterQ: 0.9,
					})
					tone({
						type: "sawtooth",
						freq: rand(1180, 1320),
						freqEnd: rand(340, 420),
						peak: 0.025,
						attack: 0.001,
						release: 0.045,
						when: now + 0.003,
						filterType: "highpass",
						filterFreq: 1600,
						filterQ: 1,
					})
				},

				enemy_shot: () => {
					tone({
						type: "sawtooth",
						freq: rand(540, 660),
						freqEnd: rand(120, 170),
						peak: 0.05,
						attack: 0.001,
						release: 0.1,
						filterType: "bandpass",
						filterFreq: 900,
						filterQ: 1.1,
					})
				},

				enemy_hit: () => {
					noise({
						peak: 0.03,
						attack: 0.001,
						release: 0.06,
						filterType: "bandpass",
						filterFreq: 1700,
						filterQ: 1.3,
					})
					tone({
						type: "square",
						freq: rand(260, 320),
						freqEnd: rand(120, 150),
						peak: 0.03,
						attack: 0.001,
						release: 0.07,
					})
				},

				enemy_explode: () => {
					const bus = echoBus({
						delayTime: 0.1,
						feedbackAmount: 0.18,
						wetAmount: 0.18,
						lowpass: 2200,
					})
					noise({
						peak: 0.07,
						attack: 0.001,
						release: 0.18,
						filterType: "bandpass",
						filterFreq: 900,
						filterQ: 0.8,
						target: bus,
					})
					tone({
						type: "sawtooth",
						freq: rand(240, 300),
						freqEnd: rand(50, 70),
						peak: 0.07,
						attack: 0.001,
						release: 0.16,
						target: bus,
					})
				},

				player_hit: () => {
					noise({
						peak: 0.045,
						attack: 0.001,
						release: 0.12,
						filterType: "bandpass",
						filterFreq: 700,
						filterQ: 1.1,
					})
					tone({
						type: "square",
						freq: rand(180, 220),
						freqEnd: rand(65, 85),
						peak: 0.08,
						attack: 0.001,
						release: 0.18,
					})
					tone({
						type: "triangle",
						freq: rand(900, 1100),
						freqEnd: rand(500, 620),
						peak: 0.02,
						attack: 0.001,
						release: 0.09,
						when: now + 0.01,
					})
				},

				boss_appear: () => {
					const bus = echoBus({
						delayTime: 0.16,
						feedbackAmount: 0.28,
						wetAmount: 0.24,
						lowpass: 2400,
					})
					tone({
						type: "sawtooth",
						freq: 90,
						freqEnd: 420,
						peak: 0.12,
						attack: 0.01,
						release: 0.45,
						target: bus,
					})
					tone({
						type: "triangle",
						freq: 240,
						freqEnd: 880,
						peak: 0.05,
						attack: 0.02,
						release: 0.35,
						when: now + 0.03,
						target: bus,
					})
				},

				boss_hit: () => {
					noise({
						peak: 0.04,
						attack: 0.001,
						release: 0.08,
						filterType: "bandpass",
						filterFreq: 1200,
						filterQ: 1.2,
					})
					tone({
						type: "square",
						freq: rand(160, 210),
						freqEnd: rand(85, 110),
						peak: 0.05,
						attack: 0.001,
						release: 0.09,
					})
				},

				boss_fire: () => {
					tone({
						type: "sawtooth",
						freq: rand(320, 420),
						freqEnd: rand(80, 120),
						peak: 0.08,
						attack: 0.001,
						release: 0.16,
						filterType: "bandpass",
						filterFreq: 760,
						filterQ: 1.2,
					})
					noise({
						peak: 0.025,
						attack: 0.001,
						release: 0.08,
						filterType: "highpass",
						filterFreq: 2000,
						filterQ: 0.8,
					})
				},

				boss_explode: () => {
					const bus = echoBus({
						delayTime: 0.18,
						feedbackAmount: 0.3,
						wetAmount: 0.26,
						lowpass: 1800,
					})
					noise({
						peak: 0.09,
						attack: 0.001,
						release: 0.32,
						filterType: "bandpass",
						filterFreq: 700,
						filterQ: 0.7,
						target: bus,
					})
					tone({
						type: "sine",
						freq: rand(130, 155),
						freqEnd: rand(36, 48),
						peak: 0.18,
						attack: 0.001,
						release: 0.34,
						target: bus,
					})
					tone({
						type: "sawtooth",
						freq: rand(260, 320),
						freqEnd: rand(65, 90),
						peak: 0.06,
						attack: 0.002,
						release: 0.22,
						when: now + 0.015,
						target: bus,
					})
				},

				wave_start: () => {
					tone({
						type: "triangle",
						freq: 420,
						freqEnd: 900,
						peak: 0.04,
						attack: 0.002,
						release: 0.09,
					})
					tone({
						type: "triangle",
						freq: 640,
						freqEnd: 1320,
						peak: 0.03,
						attack: 0.002,
						release: 0.1,
						when: now + 0.04,
					})
				},

				extra_life: () => {
					tone({
						type: "triangle",
						freq: 520,
						freqEnd: 760,
						peak: 0.04,
						attack: 0.002,
						release: 0.08,
					})
					tone({
						type: "triangle",
						freq: 760,
						freqEnd: 1140,
						peak: 0.035,
						attack: 0.002,
						release: 0.09,
						when: now + 0.04,
					})
					tone({
						type: "triangle",
						freq: 1020,
						freqEnd: 1520,
						peak: 0.03,
						attack: 0.002,
						release: 0.1,
						when: now + 0.08,
					})
				},

				card_flip: () => {
					noise({
						peak: 0.02,
						attack: 0.001,
						release: 0.03,
						filterType: "highpass",
						filterFreq: 2200,
						filterQ: 1.4,
					})
					tone({
						type: "triangle",
						freq: 820,
						freqEnd: 520,
						peak: 0.02,
						attack: 0.001,
						release: 0.035,
					})
				},

				card_slide: () => {
					noise({
						peak: 0.022,
						attack: 0.001,
						release: 0.07,
						filterType: "bandpass",
						filterFreq: 1400,
						filterQ: 0.9,
					})
				},

				chip_click: () => {
					tone({
						type: "square",
						freq: 1400,
						freqEnd: 900,
						peak: 0.018,
						attack: 0.001,
						release: 0.025,
						filterType: "highpass",
						filterFreq: 1200,
						filterQ: 1.2,
					})
				},

				chip_stack: () => {
					effects.chip_click()
					tone({
						type: "square",
						freq: 1200,
						freqEnd: 760,
						peak: 0.014,
						attack: 0.001,
						release: 0.025,
						when: now + 0.02,
						filterType: "highpass",
						filterFreq: 1100,
						filterQ: 1.1,
					})
				},

				shuffle: () => {
					noise({
						peak: 0.03,
						attack: 0.001,
						release: 0.11,
						filterType: "bandpass",
						filterFreq: 1800,
						filterQ: 0.8,
					})
				},

				deal: () => {
					effects.card_slide()
					tone({
						type: "triangle",
						freq: 560,
						freqEnd: 420,
						peak: 0.015,
						attack: 0.001,
						release: 0.04,
						when: now + 0.006,
					})
				},

				blackjack: () => {
					tone({
						type: "triangle",
						freq: 520,
						freqEnd: 780,
						peak: 0.03,
						attack: 0.002,
						release: 0.09,
					})
					tone({
						type: "triangle",
						freq: 780,
						freqEnd: 1180,
						peak: 0.03,
						attack: 0.002,
						release: 0.11,
						when: now + 0.06,
					})
					tone({
						type: "triangle",
						freq: 1180,
						freqEnd: 1680,
						peak: 0.025,
						attack: 0.002,
						release: 0.12,
						when: now + 0.12,
					})
				},

				bust: () => {
					tone({
						type: "sawtooth",
						freq: 420,
						freqEnd: 140,
						peak: 0.05,
						attack: 0.002,
						release: 0.18,
					})
				},

				win_sting: () => effects.blackjack(),

				lose_sting: () => {
					tone({
						type: "triangle",
						freq: 340,
						freqEnd: 120,
						peak: 0.05,
						attack: 0.002,
						release: 0.16,
					})
				},

				push_sting: () => {
					tone({
						type: "triangle",
						freq: 460,
						freqEnd: 460,
						peak: 0.025,
						attack: 0.002,
						release: 0.08,
					})
				},

				gameover: () => {
					const bus = echoBus({
						delayTime: 0.16,
						feedbackAmount: 0.22,
						wetAmount: 0.18,
						lowpass: 1600,
					})
					tone({
						type: "sawtooth",
						freq: 280,
						freqEnd: 60,
						peak: 0.11,
						attack: 0.002,
						release: 0.36,
						target: bus,
					})
					tone({
						type: "triangle",
						freq: 140,
						freqEnd: 42,
						peak: 0.06,
						attack: 0.002,
						release: 0.42,
						target: bus,
					})
				},
			}

			const effect = effects[type]
			if (effect) effect()
		}

		startMusic() {
			this.resume()
			this.stopMusic()
			this.applyTrackDefaultMix(this.currentTrack)
			this.queueNextNote()
		}

		stopMusic() {
			if (this.musicTimer) {
				clearTimeout(this.musicTimer)
				this.musicTimer = null
			}
		}

		playLaneStep(lane, note, now, noteDur, patternName = "") {
			if (!(note > 0)) return

			switch (lane) {
				case "bass": {
					const targetFreq = midiToHz(note)
					this.triggerVoice(
						"triangle",
						note,
						now,
						noteDur * 1.1,
						0.1,
						360,
						false,
						this.lastBassFreq,
						false,
						this.bassGain,
					)
					this.triggerVoice(
						"sine",
						note,
						now,
						noteDur * 1.1,
						0.06,
						120,
						false,
						null,
						false,
						this.bassGain,
					)
					this.lastBassFreq = targetFreq
					break
				}
				case "bell": {
					this.triggerVoice(
						"sine",
						note,
						now,
						noteDur * 6,
						0.035,
						4200,
						false,
						null,
						true,
						this.synthGain,
					)
					break
				}
				case "twang":
					this.playTwang(note, now, noteDur)
					break
				case "piano":
					this.playPiano(note, now, noteDur)
					break
				case "surf":
					this.playSurf(note, now, noteDur)
					this.playPickAttack(now)
					break
				case "horn":
					this.triggerVoice(
						"sawtooth",
						note,
						now,
						noteDur * 0.65,
						0.065,
						2600,
						false,
						null,
						false,
						this.synthGain,
					)
					this.triggerVoice(
						"square",
						note,
						now,
						noteDur * 0.65,
						0.04,
						1800,
						false,
						null,
						false,
						this.synthGain,
					)
					break
				case "synth":
				default: {
					const isSwell = ["intro", "bridge", "outro"].includes(
						patternName,
					)
					this.triggerVoice(
						"triangle",
						note,
						now,
						noteDur * 2.5,
						0.05,
						1800,
						false,
						null,
						isSwell,
						this.synthGain,
					)
					this.triggerVoice(
						"sine",
						note,
						now,
						noteDur * 2.5,
						0.025,
						1100,
						false,
						null,
						isSwell,
						this.synthGain,
					)
					break
				}
			}
		}

		queueNextNote() {
			const trackRef =
				this.songs[this.currentTrack] ||
				this.songs.metal ||
				Object.values(this.songs)[0]
			if (!trackRef) return
			const track = trackRef.data
			const tempo = track.tempo || 120
			const barDur = 60 / tempo
			const noteDur = barDur / 4

			if (!this.audioContext || !this.musicGain || this.muted) {
				this.musicTimer = window.setTimeout(
					() => this.queueNextNote(),
					noteDur * 1000,
				)
				return
			}

			const now = this.audioContext.currentTime
			const totalSteps = track.arrangement.length * 16
			const currentStep = this.musicIndex % totalSteps
			const patternIdx = Math.floor(currentStep / 16)
			const patternName = track.arrangement[patternIdx]
			const pattern = track.patterns[patternName]
			const stepInPattern = currentStep % 16

			if (!pattern || typeof pattern !== "object") {
				this.musicIndex++
				this.musicTimer = window.setTimeout(
					() => this.queueNextNote(),
					noteDur * 1000,
				)
				return
			}

			const bassStep = Number(pattern?.bass?.[stepInPattern] || 0)
			if (bassStep <= 0) this.lastBassFreq = null

			Object.entries(pattern).forEach(([lane, laneSteps]) => {
				if (lane === "drums" || !Array.isArray(laneSteps)) return
				const note = Number(laneSteps[stepInPattern] || 0)
				if (note > 0) {
					this.playLaneStep(lane, note, now, noteDur, patternName)
				}
			})

			const drum = pattern?.drums?.[stepInPattern]
			if (drum === "k") this.playPercussion("kick", now)
			if (drum === "s") this.playPercussion("snare", now)
			if (drum === "h") this.playPercussion("hihat", now)

			this.musicIndex++
			this.musicTimer = window.setTimeout(
				() => this.queueNextNote(),
				noteDur * 1000,
			)
		}

		triggerVoice(
			wave,
			midi,
			time,
			dur,
			vol,
			freq,
			distort,
			slideFrom = null,
			swell = false,
			outputGain = null,
		) {
			const osc = this.audioContext.createOscillator()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			osc.type = wave
			const targetFreq = midiToHz(midi)

			if (slideFrom) {
				osc.frequency.setValueAtTime(slideFrom, time)
				osc.frequency.exponentialRampToValueAtTime(
					targetFreq,
					time + 0.05,
				)
			} else {
				osc.frequency.setValueAtTime(targetFreq, time)
			}

			filter.type = "lowpass"
			filter.frequency.setValueAtTime(freq || 2000, time)

			gain.gain.setValueAtTime(0.0001, time)
			if (swell) {
				gain.gain.linearRampToValueAtTime(vol, time + dur * 0.5)
			} else {
				gain.gain.exponentialRampToValueAtTime(vol, time + 0.01)
			}
			gain.gain.exponentialRampToValueAtTime(0.0001, time + dur)

			osc.connect(filter)
			if (distort && this.shaper) {
				filter.connect(this.shaper)
				this.shaper.connect(gain)
			} else {
				filter.connect(gain)
			}
			gain.connect(outputGain || this.synthGain || this.musicGain)
			osc.start(time)
			osc.stop(time + dur)
		}

		playPickAttack(time) {
			if (!this.noiseBuffer) return
			const source = this.audioContext.createBufferSource()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			source.buffer = this.noiseBuffer
			filter.type = "bandpass"
			filter.frequency.setValueAtTime(3000, time)

			gain.gain.setValueAtTime(0.04, time)
			gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02)

			source.connect(filter)
			filter.connect(gain)
			gain.connect(this.bassGain || this.musicGain)
			source.start(time)
			source.stop(time + 0.03)
		}

		playPercussion(type, time) {
			const osc = this.audioContext.createOscillator()
			const gain = this.audioContext.createGain()
			const filter = this.audioContext.createBiquadFilter()

			if (type === "kick") {
				osc.type = "sine"
				osc.frequency.setValueAtTime(150, time)
				osc.frequency.exponentialRampToValueAtTime(40, time + 0.1)
				gain.gain.setValueAtTime(0.4, time)
				gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
				osc.connect(gain)
			} else if (type === "snare") {
				osc.type = "square"
				osc.frequency.setValueAtTime(240, time)
				filter.type = "highpass"
				filter.frequency.setValueAtTime(1000, time)
				gain.gain.setValueAtTime(0.1, time)
				gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
				osc.connect(filter)
				filter.connect(gain)
			} else if (type === "hihat") {
				osc.type = "square"
				osc.frequency.setValueAtTime(8000, time)
				gain.gain.setValueAtTime(0.02, time)
				gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02)
				osc.connect(gain)
			}

			gain.connect(this.drumGain || this.musicGain)
			osc.start(time)
			osc.stop(time + 0.2)
		}

		destroy() {
			this.stopMusic()
			if (typeof window !== "undefined" && window.removeEventListener) {
				window.removeEventListener(
					"systemdeck:audio-settings-changed",
					this.handleGlobalAudioSettingsChange,
				)
			}
			if (this.audioContext?.state !== "closed")
				this.audioContext?.close().catch(() => {})
			this.audioContext = null
		}
	}
	*/

	class SystemDeckAudio {
		static getInstance() {
			return new SystemDeckAudio()
		}

		constructor() {
			if (SystemDeckAudio._instance) return SystemDeckAudio._instance

			this.audioContext = null
			this.master = null
			this.fxGain = null
			this.musicGain = null
			this.fileGain = null
			this.bassGain = null
			this.synthGain = null
			this.drumGain = null
			this.bassBoostFilter = null
			this.bassBoostEnabled = false
			this.musicTimer = null
			this.musicIndex = 0
			this.currentTrack = "metal"
			this.muted = false
			this.fxVolume = 0.7
			this.musicVolume = 0.45
			this.mixLevels = { bass: 1, synth: 1, drums: 1 }
			this.lastBassFreq = null
			this.noiseBuffer = null
			this.songs = {}
			this.Tone = window.Tone || null
			this.toneReady = false
			this.toneStarted = false
			this.toneInstruments = {}
			this.toneDisposables = []
			this.subscribers = new Set()
			this.eventListeners = new Map([
				["statechange", new Set()],
				["play", new Set()],
				["pause", new Set()],
				["stop", new Set()],
				["ended", new Set()],
				["timeupdate", new Set()],
				["error", new Set()],
				["loaded", new Set()],
			])
			this.queue = []
			this.queueIndex = -1
			this.filePlayer = null
			this.filePlayerLoaded = false
			this.fileLoadPromise = null
			this.fileLoadToken = 0
			this.fileSource = ""
			this.fileMeta = {}
			this.filePausedAt = 0
			this.fileStartedAt = 0
			this.fileDuration = 0
			this.fileIsPlaying = false
			this.fileStopReason = "idle"
			this.fileVolume = 1
			this.fileProgressTimer = null
			this.musicRunning = false
			this.midiActive = false
			this.midiDerivative = null
			this.midiSourceHash = ""
			this.midiDuration = 0
			this.midiPausedAt = 0
			this.midiStartedAt = 0
			this.midiProgressTimer = null
			this.midiEndTimeout = null
			this.midiParts = []
			this.midiSchemaVersion = "1.0.0"
			this.midiParserVersion = "2.0.0"
			this.midiDerivativeCache = new Map()
			this.lastMidiTriggerTime = -Infinity
			this.lastPercussionStartTimes = {
				kick: -Infinity,
				snare: -Infinity,
				hihat: -Infinity,
			}
			this.libraryLoadPromise = null
			this.audioWorkletWarningShown = false
			this.playbackState = {
				status: "idle",
				mode: "track",
				nowPlaying: {
					type: "track",
					id: null,
					title: "",
					duration: 0,
					currentTime: 0,
					source: "",
					metadata: {},
				},
				volume: this.musicVolume,
				bassBoost: this.bassBoostEnabled,
				error: null,
				reason: "init",
				queue: [],
				queueIndex: -1,
			}
			this.handleGlobalAudioSettingsChange = () => {
				this.refreshOutputVolumes()
			}

			if (typeof window !== "undefined" && window.addEventListener) {
				window.addEventListener(
					"systemdeck:audio-settings-changed",
					this.handleGlobalAudioSettingsChange,
				)
			}

			const defaultMixByTrack = {
				metal: { bass: 1.2, synth: 0.95, drums: 1.1 },
				oldies: { bass: 0.9, synth: 1.05, drums: 0.85 },
				country: { bass: 1.0, synth: 0.95, drums: 0.9 },
				hiphop: { bass: 1.35, synth: 1.0, drums: 1.15 },
				spicy: { bass: 1.25, synth: 1.1, drums: 1.0 },
			}

			const titleByTrack = {
				metal: "Heavy Metal",
				oldies: "Oldies",
				country: "Country / Western",
				hiphop: "Hip Hop",
				spicy: "Spicy",
			}

			Object.entries(SONG_DATA).forEach(([id, data]) => {
				this.registerSong(
					id,
					titleByTrack[id] || id,
					data,
					defaultMixByTrack[id] || { bass: 1, synth: 1, drums: 1 },
				)
			})

			SystemDeckAudio._instance = this
		}

		registerSong(
			id,
			title,
			data,
			defaultMix = { bass: 1, synth: 1, drums: 1 },
		) {
			if (!id || !data || !data.arrangement || !data.patterns) return
			this.songs[id] = {
				title: String(title || id),
				data,
				defaultMix: {
					bass: Number(defaultMix.bass ?? 1),
					synth: Number(defaultMix.synth ?? 1),
					drums: Number(defaultMix.drums ?? 1),
				},
			}
		}

		getRegisteredSongs() {
			return Object.entries(this.songs).map(([id, song]) => ({
				id,
				title: song.title,
			}))
		}

		subscribe(listener) {
			if (typeof listener !== "function") return () => {}
			this.subscribers.add(listener)
			try {
				listener(this.getState())
			} catch (_err) {}
			return () => {
				this.subscribers.delete(listener)
			}
		}

		on(event, callback) {
			if (!this.eventListeners.has(event) || typeof callback !== "function") {
				return () => {}
			}
			this.eventListeners.get(event).add(callback)
			return () => this.off(event, callback)
		}

		off(event, callback) {
			if (!this.eventListeners.has(event) || typeof callback !== "function") {
				return
			}
			this.eventListeners.get(event).delete(callback)
		}

		emitEvent(event, payload) {
			if (!this.eventListeners.has(event)) return
			this.eventListeners.get(event).forEach((callback) => {
				try {
					callback(payload)
				} catch (_err) {}
			})
		}

		normalizeStatus(status) {
			const allowed = new Set([
				"idle",
				"loading",
				"playing",
				"paused",
				"stopped",
				"error",
			])
			return allowed.has(status) ? status : "idle"
		}

		normalizeMode(mode) {
			return mode === "file" ? "file" : "track"
		}

		getState() {
			const nowPlaying = this.playbackState.nowPlaying || {}
			const mix = {
				bass: Number(this.mixLevels?.bass ?? 1),
				synth: Number(this.mixLevels?.synth ?? 1),
				drums: Number(this.mixLevels?.drums ?? 1),
			}
			return {
				status: this.normalizeStatus(this.playbackState.status),
				nowPlaying: {
					type: this.normalizeMode(
						nowPlaying.type || this.playbackState.mode || "track",
					),
					id: nowPlaying.id ?? null,
					title: String(nowPlaying.title || ""),
					duration: Number(nowPlaying.duration || 0),
					currentTime: Number(nowPlaying.currentTime || 0),
					source: String(nowPlaying.source || ""),
					metadata: { ...(nowPlaying.metadata || {}) },
				},
				volume: this.clamp(this.musicVolume, 0, 1),
				bassBoost: !!this.bassBoostEnabled,
				mix,
				mixLevels: { ...mix },
				mode: this.normalizeMode(this.playbackState.mode),
				error: this.playbackState.error
					? { message: String(this.playbackState.error.message || "") }
					: null,
			}
		}

		getPlaybackState() {
			const state = this.getState()
			return {
				...state,
				reason: String(this.playbackState.reason || ""),
				queue: this.queue.map((item) => ({
					title: item?.meta?.title || item?.meta?.name || "Untitled",
					source: String(item?.source || ""),
					meta: { ...(item?.meta || {}) },
				})),
				queueIndex: this.queueIndex,
				fxVolume: this.fxVolume,
				mixLevels: { ...this.mixLevels },
				currentTrack: this.currentTrack,
			}
		}

		getNowPlaying() {
			return { ...this.getState().nowPlaying }
		}

		getMode() {
			return this.normalizeMode(this.playbackState.mode)
		}

		emitPlaybackState(reason = "update", patch = {}) {
			const nextStatus = this.normalizeStatus(
				String(patch.status || this.playbackState.status || "idle"),
			)
			const nextMode = this.normalizeMode(
				String(patch.mode || this.playbackState.mode || "track"),
			)
			const nextNowPlaying = patch.nowPlaying || this.playbackState.nowPlaying || {}
			const nowPlayingType =
				nextNowPlaying.type || (nextMode === "file" ? "file" : "track")
			this.playbackState = {
				...this.playbackState,
				...patch,
				status: nextStatus,
				mode: nextMode,
				nowPlaying: {
					type: this.normalizeMode(String(nowPlayingType)),
					id: nextNowPlaying.id ?? null,
					title: String(nextNowPlaying.title || ""),
					duration: Number(nextNowPlaying.duration || 0),
					currentTime: Number(nextNowPlaying.currentTime || 0),
					source: String(nextNowPlaying.source || ""),
					metadata: { ...(nextNowPlaying.metadata || {}) },
				},
				reason,
				volume: this.clamp(this.musicVolume, 0, 1),
				bassBoost: !!this.bassBoostEnabled,
				error: patch.error
					? { message: String(patch.error.message || patch.error) }
					: patch.status === "error"
						? this.playbackState.error || { message: "Playback error" }
						: null,
				queue: this.queue,
				queueIndex: this.queueIndex,
			}
			const snapshot = this.getState()
			this.subscribers.forEach((listener) => {
				try {
					listener(snapshot)
				} catch (_err) {}
			})
			this.emitEvent("statechange", snapshot)
			if (reason === "file:progress") this.emitEvent("timeupdate", snapshot)
			if (reason === "file:ready" || reason === "loaded")
				this.emitEvent("loaded", snapshot)
			if (reason === "file:ended") this.emitEvent("ended", snapshot)
			if (snapshot.status === "playing") this.emitEvent("play", snapshot)
			if (snapshot.status === "paused") this.emitEvent("pause", snapshot)
			if (snapshot.status === "stopped" || reason.includes("stop"))
				this.emitEvent("stop", snapshot)
			if (snapshot.status === "error")
				this.emitEvent("error", snapshot.error || { message: "Playback error" })
			if (typeof window !== "undefined" && window.dispatchEvent) {
				window.dispatchEvent(
					new CustomEvent("systemdeck:audio-player-state", {
						detail: this.getPlaybackState(),
					}),
				)
			}
		}

		clearFileProgressTimer() {
			if (this.fileProgressTimer) {
				clearInterval(this.fileProgressTimer)
				this.fileProgressTimer = null
			}
		}

		startFileProgressTimer() {
			this.clearFileProgressTimer()
			this.fileProgressTimer = window.setInterval(() => {
				if (!this.fileIsPlaying) return
				this.emitPlaybackState("file:progress")
			}, 250)
		}

		getFileCurrentTime() {
			if (!this.Tone || !this.fileIsPlaying) return this.filePausedAt || 0
			const now = this.Tone.now()
			const elapsed = Math.max(0, now - this.fileStartedAt)
			return this.fileDuration > 0
				? Math.min(this.fileDuration, elapsed)
				: elapsed
		}

		clearMidiProgressTimer() {
			if (this.midiProgressTimer) {
				clearInterval(this.midiProgressTimer)
				this.midiProgressTimer = null
			}
		}

		startMidiProgressTimer() {
			this.clearMidiProgressTimer()
			this.midiProgressTimer = window.setInterval(() => {
				if (!this.midiActive) return
				this.emitPlaybackState("midi:progress")
			}, 250)
		}

		clearMidiEndTimeout() {
			if (this.midiEndTimeout) {
				clearTimeout(this.midiEndTimeout)
				this.midiEndTimeout = null
			}
		}

		getMidiCurrentTime() {
			if (!this.Tone || !this.midiActive) return this.midiPausedAt || 0
			const elapsed = Math.max(0, this.Tone.now() - this.midiStartedAt)
			if (this.midiDuration > 0) return Math.min(this.midiDuration, elapsed)
			return elapsed
		}

		async sha256HexFromBuffer(arrayBuffer) {
			if (!arrayBuffer) return ""
			try {
				if (
					typeof crypto !== "undefined" &&
					crypto?.subtle &&
					typeof crypto.subtle.digest === "function"
				) {
					const digest = await crypto.subtle.digest("SHA-256", arrayBuffer)
					return Array.from(new Uint8Array(digest))
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join("")
				}
			} catch (_err) {}
			const bytes = new Uint8Array(arrayBuffer)
			let hash = 2166136261
			for (let i = 0; i < bytes.length; i++) {
				hash ^= bytes[i]
				hash +=
					(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
			}
			return `fnv1a-${(hash >>> 0).toString(16)}`
		}

		getMidiParser() {
			if (window.TonejsMidi && typeof window.TonejsMidi.Midi === "function")
				return window.TonejsMidi.Midi
			if (typeof window.Midi === "function") return window.Midi
			if (window.Midi && typeof window.Midi.Midi === "function")
				return window.Midi.Midi
			if (window.exports && typeof window.exports.Midi === "function")
				return window.exports.Midi
			if (
				window.exports &&
				window.exports.Midi &&
				typeof window.exports.Midi.Midi === "function"
			)
				return window.exports.Midi.Midi
			if (
				window.module &&
				window.module.exports &&
				typeof window.module.exports.Midi === "function"
			)
				return window.module.exports.Midi
			return null
		}

		async buildMidiDerivativeFromArrayBuffer(arrayBuffer, options = {}) {
			await this.ensureAudioLibraries({ midi: true })
			const MidiCtor = this.getMidiParser()
			if (!MidiCtor) throw new Error("@tonejs/midi parser is unavailable.")
			if (!arrayBuffer) throw new Error("MIDI source buffer is missing.")

			const midi = new MidiCtor(arrayBuffer)
			const sourceHash = await this.sha256HexFromBuffer(arrayBuffer)
			const tempos = Array.isArray(midi?.header?.tempos) ? midi.header.tempos : []
			const timeSignatures = Array.isArray(midi?.header?.timeSignatures)
				? midi.header.timeSignatures
				: []
			const tracks = Array.isArray(midi?.tracks) ? midi.tracks : []

			let noteCount = 0
			const derivativeTracks = tracks.map((track, index) => {
				const percussion =
					!!track?.instrument?.percussion || Number(track?.channel) === 9
				const family = String(track?.instrument?.family || "")
				const lane = percussion
					? "drums"
					: family.includes("bass")
						? "bass"
						: "synth"
				const notes = (Array.isArray(track?.notes) ? track.notes : []).map((note) => ({
					midi: Number(note?.midi || 0),
					time: Number(note?.time || 0),
					duration: Number(note?.duration || 0),
					velocity: Number(note?.velocity ?? 0.8),
					noteOffVelocity: Number(note?.noteOffVelocity ?? 0.8),
					ticks: Number(note?.ticks || 0),
					durationTicks: Number(note?.durationTicks || 0),
				}))
				noteCount += notes.length
				return {
					index,
					name: String(track?.name || track?.instrument?.name || `Track ${index + 1}`),
					channel: Number(track?.channel ?? -1),
					instrument: {
						number: Number(track?.instrument?.number ?? 0),
						name: String(track?.instrument?.name || ""),
						family: family,
						percussion,
					},
					lane,
					notes,
				}
			})

			return {
				schema: "systemdeck-midi-derivative",
				version: this.midiSchemaVersion,
				parser: {
					name: "@tonejs/midi",
					version: this.midiParserVersion,
				},
				source: {
					hash: sourceHash,
					sourceType: String(options?.sourceType || "player"),
					id: options?.id != null ? String(options.id) : null,
					title: String(options?.title || midi?.name || "MIDI Track"),
					mime: String(options?.mime || "audio/midi"),
					filename: String(options?.filename || ""),
					url: String(options?.url || ""),
				},
				timing: {
					ppq: Number(midi?.header?.ppq || 480),
					tempoMap: tempos.map((tempo) => ({
						bpm: Number(tempo?.bpm || 120),
						time: Number(tempo?.time || 0),
						ticks: Number(tempo?.ticks || 0),
					})),
					timeSignatures: timeSignatures.map((signature) => ({
						time: Number(signature?.time || 0),
						ticks: Number(signature?.ticks || 0),
						signature: Array.isArray(signature?.timeSignature)
							? signature.timeSignature.slice(0, 2).map((value) => Number(value || 0))
							: [4, 4],
					})),
				},
				tracks: derivativeTracks,
				playback: {
					duration: Number(midi?.duration || 0),
					durationTicks: Number(midi?.durationTicks || 0),
				},
				summary: {
					title: String(options?.title || midi?.name || "MIDI Track"),
					trackCount: derivativeTracks.length,
					noteCount,
					tempo: Number(tempos?.[0]?.bpm || 120),
					duration: Number(midi?.duration || 0),
				},
			}
		}

		normalizeMidiDerivative(derivative = {}) {
			if (!derivative || typeof derivative !== "object") return null
			if (String(derivative.schema || "") !== "systemdeck-midi-derivative")
				return null
			const tracks = Array.isArray(derivative.tracks) ? derivative.tracks : []
			const normalizedTracks = tracks.map((track, index) => ({
				index: Number(track?.index ?? index),
				name: String(track?.name || `Track ${index + 1}`),
				channel: Number(track?.channel ?? -1),
				lane: String(track?.lane || "synth"),
				instrument: {
					number: Number(track?.instrument?.number ?? 0),
					name: String(track?.instrument?.name || ""),
					family: String(track?.instrument?.family || ""),
					percussion: !!track?.instrument?.percussion,
				},
				notes: (Array.isArray(track?.notes) ? track.notes : [])
					.map((note) => ({
						midi: Number(note?.midi || 0),
						time: Math.max(0, Number(note?.time || 0)),
						duration: Math.max(0.01, Number(note?.duration || 0.05)),
						velocity: this.clamp(note?.velocity ?? 0.8, 0, 1),
						noteOffVelocity: this.clamp(note?.noteOffVelocity ?? 0.8, 0, 1),
						ticks: Number(note?.ticks || 0),
						durationTicks: Number(note?.durationTicks || 0),
					}))
					.filter((note) => note.midi > 0),
			}))
			return {
				...derivative,
				tracks: normalizedTracks,
				playback: {
					...(derivative.playback || {}),
					duration: Number(derivative?.playback?.duration || 0),
					durationTicks: Number(derivative?.playback?.durationTicks || 0),
				},
			}
		}

		getMidiCacheKey(payload = {}) {
			const sourceHash = String(payload?.source?.hash || "")
			const parserVersion = String(payload?.parser?.version || "")
			const schemaVersion = String(payload?.version || "")
			return `${sourceHash}:${parserVersion}:${schemaVersion}`
		}

		setPlaybackError(message) {
			this.emitPlaybackState("error", {
				error: { message: String(message || "Unknown playback error") },
				status: "error",
			})
		}

		buildNowPlaying(meta = {}, source = "") {
			const modeType = this.normalizeMode(
				String(meta.type || this.playbackState.mode || "track"),
			)
			const title = String(meta.title || meta.name || meta.filename || "Untitled")
			const isMidiMeta = String(meta.mediaType || meta.mime || "")
				.toLowerCase()
				.includes("midi")
			const currentTime = isMidiMeta
				? this.midiActive
					? this.getMidiCurrentTime()
					: this.midiPausedAt || 0
				: this.fileIsPlaying
					? this.getFileCurrentTime()
					: this.filePausedAt || 0
			return {
				type: modeType,
				id: meta.id ?? null,
				title,
				duration: Number(
					meta.duration || (isMidiMeta ? this.midiDuration : this.fileDuration) || 0,
				),
				currentTime: Number(currentTime || 0),
				source: String(source || meta.source || ""),
				metadata: { ...meta },
			}
		}

		midiToNote(midi) {
			if (!(Number(midi) > 0)) return null
			const names = [
				"C",
				"C#",
				"D",
				"D#",
				"E",
				"F",
				"F#",
				"G",
				"G#",
				"A",
				"A#",
				"B",
			]
			const note = Number(midi)
			const name = names[((note % 12) + 12) % 12]
			const octave = Math.floor(note / 12) - 1
			return `${name}${octave}`
		}

		clamp(value, min = 0, max = 1) {
			const n = Number(value)
			if (!Number.isFinite(n)) return min
			return Math.max(min, Math.min(max, n))
		}

		trackDisposable(node) {
			if (node) this.toneDisposables.push(node)
			return node
		}

		canUseAudioWorklets() {
			const context =
				this.audioContext ||
				(this.Tone?.getContext ? this.Tone.getContext().rawContext : null)
			return !!(
				typeof window !== "undefined" &&
				window.isSecureContext &&
				context?.audioWorklet &&
				typeof window.AudioWorkletNode === "function"
			)
		}

		warnAudioWorkletUnavailable(feature = "Audio feature") {
			if (this.audioWorkletWarningShown) return
			this.audioWorkletWarningShown = true
		}

		createToneNode(factory, options = {}) {
			const {
				feature = "Tone node",
				requiresAudioWorklet = false,
			} = options
			if (requiresAudioWorklet && !this.canUseAudioWorklets()) {
				this.warnAudioWorkletUnavailable(feature)
				return null
			}
			try {
				return factory()
			} catch (error) {
				if (
					requiresAudioWorklet &&
					/AudioWorkletNode|secure context/i.test(String(error?.message || error))
				) {
					this.warnAudioWorkletUnavailable(feature)
					return null
				}
				throw error
			}
		}

		async ensureAudioLibraries({ midi = false } = {}) {
			if (window.Tone && (!midi || this.getMidiParser())) {
				this.Tone = window.Tone
				return true
			}
			if (!this.libraryLoadPromise) {
				const assets = getAudioAssetConfig()
				const toneUrl = buildAssetUrl(assets.toneUrl, assets.toneVersion)
				this.libraryLoadPromise = (async () => {
					await loadScriptOnce("tone", toneUrl)
					this.Tone = window.Tone || null
					return !!this.Tone
				})().catch((error) => {
					this.libraryLoadPromise = null
					throw error
				})
			}
			const loaded = await this.libraryLoadPromise
			if (!loaded) {
				throw new Error("Tone.js failed to load.")
			}
			if (midi && !this.getMidiParser()) {
				const assets = getAudioAssetConfig()
				const midiUrl = buildAssetUrl(assets.midiUrl, assets.midiVersion)
				await loadScriptOnce("sd-tonejs-midi", midiUrl)
				if (!window.Midi && window.exports && typeof window.exports.Midi === "function") {
					window.Midi = window.exports.Midi
				}
				if (
					!window.TonejsMidi &&
					window.exports &&
					window.exports.Midi &&
					typeof window.exports.Midi.Midi === "function"
				) {
					window.TonejsMidi = window.exports
				}
				if (
					!window.Midi &&
					window.module &&
					window.module.exports &&
					typeof window.module.exports.Midi === "function"
				) {
					window.Midi = window.module.exports.Midi
				}
				if (!this.getMidiParser()) {
					throw new Error("@tonejs/midi parser failed to initialize.")
				}
			}
			this.Tone = window.Tone || null
			return true
		}

		disposeToneResources() {
			this.stopMusic()

			Object.values(this.toneInstruments || {}).forEach((value) => {
				if (!value) return
				if (typeof value.dispose === "function") {
					try {
						value.dispose()
					} catch (_err) {}
					return
				}
				if (typeof value === "object") {
					Object.values(value).forEach((sub) => {
						if (sub && typeof sub.dispose === "function") {
							try {
								sub.dispose()
							} catch (_err) {}
						}
					})
				}
			})
			;(this.toneDisposables || []).forEach((node) => {
				if (node && typeof node.dispose === "function") {
					try {
						node.dispose()
					} catch (_err) {}
				}
			})

			this.toneDisposables = []
			this.toneInstruments = {}
			this.toneReady = false
		}

		ensureContext() {
			if (!this.Tone) {
				console.warn("SystemDeckAudio: Tone.js is not available.")
				return
			}
			if (this.toneReady) return

			const Tone = this.Tone

			this.audioContext = Tone.getContext().rawContext

			this.master = this.trackDisposable(new Tone.Gain(1))
			this.fxGain = this.trackDisposable(new Tone.Gain(this.fxVolume))
			this.musicGain = this.trackDisposable(
				new Tone.Gain(this.musicVolume),
			)
			this.fileGain = this.trackDisposable(new Tone.Gain(this.fileVolume))
			this.bassGain = this.trackDisposable(
				new Tone.Gain(this.mixLevels.bass),
			)
			this.synthGain = this.trackDisposable(
				new Tone.Gain(this.mixLevels.synth),
			)
			this.drumGain = this.trackDisposable(
				new Tone.Gain(this.mixLevels.drums),
			)
			this.bassBoostFilter = this.trackDisposable(
				new Tone.Filter({
					type: "lowshelf",
					frequency: 80,
					gain: 0,
					Q: 0.7,
				}),
			)
			this.compressor = this.trackDisposable(
				new Tone.Compressor({
					threshold: -18,
					ratio: 4,
					attack: 0.01,
					release: 0.18,
				}),
			)
			this.limiter = this.trackDisposable(new Tone.Limiter(-0.6))

			this.bassGain.connect(this.musicGain)
			this.synthGain.connect(this.musicGain)
			this.drumGain.connect(this.musicGain)
			this.fileGain.connect(this.musicGain)
			this.musicGain.connect(this.bassBoostFilter)
			this.bassBoostFilter.connect(this.master)
			this.fxGain.connect(this.musicGain)
			this.master.connect(this.compressor)
			this.compressor.connect(this.limiter)
			this.limiter.toDestination()

			this.initToneInstruments()
			this.refreshOutputVolumes()
			this.setBassBoostEnabled(this.bassBoostEnabled)
			this.toneReady = true
		}

		initToneInstruments() {
			const Tone = this.Tone
			if (!Tone) return

			const bassDrive = this.trackDisposable(new Tone.Distortion(0.25))
			const bassComp = this.trackDisposable(
				new Tone.Compressor({
					threshold: -22,
					ratio: 3,
					attack: 0.01,
					release: 0.2,
				}),
			)
			bassDrive.connect(bassComp)
			bassComp.connect(this.bassGain)

			const synthEQ = this.trackDisposable(
				new Tone.EQ3({ low: 1, mid: 0, high: 2 }),
			)
			const synthDelay = this.trackDisposable(
				new Tone.FeedbackDelay({
					delayTime: 0.125,
					feedback: 0.16,
					wet: 0.12,
				}),
			)
			const synthChorus = this.trackDisposable(
				new Tone.Chorus({
					frequency: 1.5,
					delayTime: 2.5,
					depth: 0.2,
					wet: 0.1,
				}).start(),
			)
			const synthDrive = this.trackDisposable(new Tone.Distortion(0.14))
			synthDrive.connect(synthChorus)
			synthChorus.connect(synthDelay)
			synthDelay.connect(synthEQ)
			synthEQ.connect(this.synthGain)

			const drumComp = this.trackDisposable(
				new Tone.Compressor({
					threshold: -20,
					ratio: 4,
					attack: 0.003,
					release: 0.14,
				}),
			)
			const drumEQ = this.trackDisposable(
				new Tone.EQ3({ low: 2, mid: 0, high: 1 }),
			)
			drumComp.connect(drumEQ)
			drumEQ.connect(this.drumGain)

			const fxDelay = this.trackDisposable(
				new Tone.FeedbackDelay({
					delayTime: 0.12,
					feedback: 0.22,
					wet: 0.18,
				}),
			)
			const fxFilter = this.trackDisposable(
				new Tone.Filter({
					type: "lowpass",
					frequency: 2200,
					Q: 0.7,
				}),
			)
			fxDelay.connect(fxFilter)
			fxFilter.connect(this.fxGain)

			this.toneInstruments = {
				bassMain: this.trackDisposable(
					new Tone.MonoSynth({
						oscillator: { type: "sawtooth" },
						filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
						filterEnvelope: {
							attack: 0.002,
							decay: 0.18,
							sustain: 0.35,
							release: 0.14,
							baseFrequency: 90,
							octaves: 2.8,
						},
						envelope: {
							attack: 0.002,
							decay: 0.12,
							sustain: 0.45,
							release: 0.18,
						},
						portamento: 0.04,
					}).connect(bassDrive),
				),

				bassSub: this.trackDisposable(
					new Tone.MonoSynth({
						oscillator: { type: "sine" },
						filter: { Q: 0.8, type: "lowpass", rolloff: -24 },
						envelope: {
							attack: 0.001,
							decay: 0.08,
							sustain: 0.9,
							release: 0.2,
						},
						portamento: 0.02,
					}).connect(bassDrive),
				),

				lead: this.trackDisposable(
					new Tone.PolySynth(Tone.Synth, {
						oscillator: { type: "sawtooth" },
						envelope: {
							attack: 0.004,
							decay: 0.08,
							sustain: 0.45,
							release: 0.18,
						},
					}).connect(synthDrive),
				),

				pad: this.trackDisposable(
					new Tone.PolySynth(Tone.AMSynth, {
						harmonicity: 1.5,
						oscillator: { type: "triangle" },
						envelope: {
							attack: 0.08,
							decay: 0.2,
							sustain: 0.5,
							release: 0.45,
						},
						modulation: { type: "sine" },
						modulationEnvelope: {
							attack: 0.1,
							decay: 0.1,
							sustain: 0.5,
							release: 0.3,
						},
					}).connect(synthDrive),
				),

				bell: this.trackDisposable(
					new Tone.PolySynth(Tone.FMSynth, {
						harmonicity: 3.1,
						modulationIndex: 12,
						oscillator: { type: "sine" },
						envelope: {
							attack: 0.002,
							decay: 1.8,
							sustain: 0.02,
							release: 1.4,
						},
						modulation: { type: "square" },
						modulationEnvelope: {
							attack: 0.002,
							decay: 0.7,
							sustain: 0.01,
							release: 0.5,
						},
					}).connect(synthDrive),
				),

				twang: this.trackDisposable(
					this.createToneNode(
						() =>
							new Tone.PluckSynth({
								attackNoise: 0.8,
								dampening: 2800,
								resonance: 0.86,
								release: 0.8,
							}).connect(this.synthGain),
						{
							feature: "Tone.PluckSynth",
							requiresAudioWorklet: true,
						},
					),
				),

				piano: this.trackDisposable(
					new Tone.PolySynth(Tone.FMSynth, {
						harmonicity: 1.2,
						modulationIndex: 4,
						oscillator: { type: "triangle" },
						envelope: {
							attack: 0.008,
							decay: 0.24,
							sustain: 0.18,
							release: 0.8,
						},
						modulation: { type: "sine" },
						modulationEnvelope: {
							attack: 0.01,
							decay: 0.2,
							sustain: 0.1,
							release: 0.4,
						},
					}).connect(this.synthGain),
				),

				surf: this.trackDisposable(
					new Tone.PolySynth(Tone.DuoSynth, {
						voice0: {
							oscillator: { type: "sawtooth" },
							filterEnvelope: {
								attack: 0.01,
								decay: 0.1,
								sustain: 0.3,
								release: 0.2,
								baseFrequency: 500,
								octaves: 3,
							},
							envelope: {
								attack: 0.004,
								decay: 0.1,
								sustain: 0.25,
								release: 0.25,
							},
						},
						voice1: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.004,
								decay: 0.08,
								sustain: 0.22,
								release: 0.22,
							},
						},
						harmonicity: 1.01,
						vibratoAmount: 0.03,
						vibratoRate: 4.5,
					}).connect(this.synthGain),
				),

				horn: this.trackDisposable(
					new Tone.PolySynth(Tone.Synth, {
						oscillator: { type: "sawtooth" },
						envelope: {
							attack: 0.01,
							decay: 0.12,
							sustain: 0.4,
							release: 0.18,
						},
					}).connect(this.synthGain),
				),

				kick: this.trackDisposable(
					new Tone.MembraneSynth({
						pitchDecay: 0.05,
						octaves: 8,
						oscillator: { type: "sine" },
						envelope: {
							attack: 0.001,
							decay: 0.18,
							sustain: 0.001,
							release: 0.12,
						},
					}).connect(drumComp),
				),

				snare: this.trackDisposable(
					new Tone.NoiseSynth({
						noise: { type: "white" },
						envelope: {
							attack: 0.001,
							decay: 0.12,
							sustain: 0,
							release: 0.05,
						},
					}).connect(drumComp),
				),

				hat: this.trackDisposable(
					new Tone.MetalSynth({
						frequency: 260,
						envelope: {
							attack: 0.001,
							decay: 0.025,
							release: 0.01,
						},
						harmonicity: 5.1,
						modulationIndex: 28,
						resonance: 2600,
						octaves: 1.5,
					}).connect(drumComp),
				),

				fxDelay,
			}
		}

		async resume() {
			try {
				await this.ensureAudioLibraries()
			} catch (error) {
				this.setPlaybackError(error?.message || "Audio libraries failed to load.")
				throw error
			}
			if (!this.Tone) return
			if (!this.toneStarted) {
				try {
					await this.Tone.start()
				} catch (_err) {}
				this.toneStarted = true
			}
			this.ensureContext()
		}

		getGlobalVolumeMultiplier() {
			const audioConfig = window.SYSTEMDECK_ENV?.audio || null
			if (!audioConfig) return 1
			const parsed = Number(audioConfig.masterVolume ?? 1)
			if (!Number.isFinite(parsed)) return 1
			return Math.max(0, Math.min(1, parsed))
		}

		refreshOutputVolumes() {
			const globalVolume = this.getGlobalVolumeMultiplier()
			if (this.fxGain?.gain)
				this.fxGain.gain.value = this.fxVolume * globalVolume
			if (this.musicGain?.gain)
				this.musicGain.gain.value = this.musicVolume * globalVolume
		}

		setMuted(muted) {
			this.muted = !!muted
			if (this.master?.gain) this.master.gain.value = this.muted ? 0 : 1
		}

		setTrack(track) {
			if (this.songs[track]) {
				this.currentTrack = track
				this.musicIndex = 0
				this.lastBassFreq = null
				this.applyTrackDefaultMix(track)
				this.emitPlaybackState("track:set", {
					mode: "track",
					nowPlaying: {
						type: "track",
						id: track,
						title: this.songs[track]?.title || track,
						duration: 0,
						currentTime: 0,
						source: track,
						metadata: { id: track },
					},
					error: null,
				})
			}
		}

		setFxVolume(v) {
			const next = Number(v)
			this.fxVolume = Number.isFinite(next)
				? Math.max(0, Math.min(1, next))
				: this.fxVolume
			this.refreshOutputVolumes()
			this.emitPlaybackState("fx:volume")
		}

		setMusicVolume(v) {
			const next = Number(v)
			this.musicVolume = Number.isFinite(next)
				? Math.max(0, Math.min(1, next))
				: this.musicVolume
			this.refreshOutputVolumes()
			this.emitPlaybackState("music:volume")
		}

		setVolume(value) {
			this.setMusicVolume(value)
			return this.musicVolume
		}

		setMixLevels(partial = {}) {
			this.mixLevels = {
				bass: Number(partial.bass ?? this.mixLevels.bass ?? 1),
				synth: Number(partial.synth ?? this.mixLevels.synth ?? 1),
				drums: Number(partial.drums ?? this.mixLevels.drums ?? 1),
			}
			if (this.bassGain?.gain)
				this.bassGain.gain.value = this.mixLevels.bass
			if (this.synthGain?.gain)
				this.synthGain.gain.value = this.mixLevels.synth
			if (this.drumGain?.gain)
				this.drumGain.gain.value = this.mixLevels.drums
			this.emitPlaybackState("mix:update")
		}

		setBassBoostEnabled(enabled) {
			this.bassBoostEnabled = !!enabled
			if (this.bassBoostFilter?.gain) {
				this.bassBoostFilter.gain.value = this.bassBoostEnabled ? 9 : 0
			}
			this.emitPlaybackState("mix:bass-boost")
		}

		setBassBoost(enabled) {
			this.setBassBoostEnabled(enabled)
			return this.bassBoostEnabled
		}

		applyTrackDefaultMix(trackId) {
			const track = this.songs[trackId]
			if (!track) return
			this.setMixLevels(
				track.defaultMix || { bass: 1, synth: 1, drums: 1 },
			)
		}

		triggerEffectSynth({
			synthFactory = "Synth",
			options = {},
			note = "C4",
			duration = 0.1,
			when = null,
			velocity = 0.8,
			target = null,
			disposeAfter = 600,
		}) {
			if (!this.Tone) return
			const Tone = this.Tone
			const bus = target || this.fxGain
			const time = when ?? Tone.now()
			const Ctor = Tone[synthFactory]
			if (!Ctor) return

			const synth = new Ctor(options).connect(bus)
			if (typeof synth.triggerAttackRelease === "function") {
				synth.triggerAttackRelease(note, duration, time, velocity)
			}
			window.setTimeout(() => {
				try {
					synth.dispose()
				} catch (_err) {}
			}, disposeAfter)
		}

		triggerEffectNoise({
			options = {},
			duration = 0.08,
			when = null,
			target = null,
			disposeAfter = 500,
		}) {
			if (!this.Tone) return
			const Tone = this.Tone
			const bus = target || this.fxGain
			const time = when ?? Tone.now()
			const synth = new Tone.NoiseSynth(options).connect(bus)
			synth.triggerAttackRelease(duration, time)
			window.setTimeout(() => {
				try {
					synth.dispose()
				} catch (_err) {}
			}, disposeAfter)
		}

		createFxBus({
			delayTime = 0.12,
			feedback = 0.22,
			wet = 0.18,
			lowpass = 2200,
		} = {}) {
			if (!this.Tone) return this.fxGain
			const Tone = this.Tone
			const input = new Tone.Gain(1)
			const delay = new Tone.FeedbackDelay({
				delayTime,
				feedback,
				wet,
			})
			const filter = new Tone.Filter({
				type: "lowpass",
				frequency: lowpass,
				Q: 0.7,
			})

			input.connect(this.fxGain)
			input.connect(delay)
			delay.connect(filter)
			filter.connect(this.fxGain)

			window.setTimeout(() => {
				try {
					input.dispose()
					delay.dispose()
					filter.dispose()
				} catch (_err) {}
			}, 2000)

			return input
		}

		async playFx(type) {
			await this.resume()
			if (!this.Tone || !this.fxGain) return

			const Tone = this.Tone
			const now = Tone.now()
			const rand = (min, max) => min + Math.random() * (max - min)

			const effects = {
				systemdeck_boot: () => {
					const bus = this.createFxBus({
						delayTime: 0.09,
						feedback: 0.18,
						wet: 0.16,
						lowpass: 2200,
					})

					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.006,
								decay: 0.16,
								sustain: 0.1,
								release: 0.18,
							},
						},
						note: 220,
						duration: 0.18,
						when: now,
						target: bus,
					})

					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sine" },
							envelope: {
								attack: 0.012,
								decay: 0.18,
								sustain: 0.08,
								release: 0.22,
							},
						},
						note: 440,
						duration: 0.22,
						when: now + 0.045,
						target: bus,
					})

					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.05,
								sustain: 0,
								release: 0.02,
							},
						},
						duration: 0.05,
						when: now + 0.01,
						target: bus,
					})
				},

				piece_rotate: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.04,
								sustain: 0.02,
								release: 0.03,
							},
						},
						note: rand(560, 620),
						duration: 0.06,
						when: now,
					})
				},

				piece_move: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.02,
								sustain: 0.01,
								release: 0.02,
							},
						},
						note: rand(240, 280),
						duration: 0.035,
						when: now,
						velocity: 0.5,
					})
				},

				piece_land: () => {
					this.triggerEffectSynth({
						synthFactory: "MembraneSynth",
						options: {
							pitchDecay: 0.04,
							octaves: 5,
							envelope: {
								attack: 0.001,
								decay: 0.12,
								sustain: 0,
								release: 0.08,
							},
						},
						note: rand(70, 90),
						duration: 0.12,
						when: now,
					})
					this.triggerEffectNoise({
						options: {
							noise: { type: "brown" },
							envelope: {
								attack: 0.001,
								decay: 0.03,
								sustain: 0,
								release: 0.02,
							},
						},
						duration: 0.03,
						when: now,
					})
				},

				piece_land_heavy: () => {
					const bus = this.createFxBus({
						delayTime: 0.14,
						feedback: 0.24,
						wet: 0.22,
						lowpass: 1400,
					})

					this.triggerEffectSynth({
						synthFactory: "MembraneSynth",
						options: {
							pitchDecay: 0.08,
							octaves: 8,
							envelope: {
								attack: 0.001,
								decay: 0.26,
								sustain: 0,
								release: 0.12,
							},
						},
						note: rand(46, 54),
						duration: 0.24,
						when: now,
						target: bus,
					})

					this.triggerEffectNoise({
						options: {
							noise: { type: "brown" },
							envelope: {
								attack: 0.001,
								decay: 0.08,
								sustain: 0,
								release: 0.05,
							},
						},
						duration: 0.08,
						when: now,
						target: bus,
					})
				},

				line_clear: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.08,
								sustain: 0,
								release: 0.05,
							},
						},
						duration: 0.08,
						when: now,
					})

					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.002,
								decay: 0.08,
								sustain: 0.06,
								release: 0.08,
							},
						},
						note: rand(720, 860),
						duration: 0.14,
						when: now,
					})

					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.004,
								decay: 0.05,
								sustain: 0.02,
								release: 0.08,
							},
						},
						note: rand(1180, 1450),
						duration: 0.12,
						when: now + 0.012,
					})
				},

				column_clear: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "pink" },
							envelope: {
								attack: 0.001,
								decay: 0.1,
								sustain: 0,
								release: 0.05,
							},
						},
						duration: 0.1,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.09,
								sustain: 0.03,
								release: 0.08,
							},
						},
						note: rand(980, 1220),
						duration: 0.16,
						when: now,
					})
				},

				cascade: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.04,
								sustain: 0.02,
								release: 0.04,
							},
						},
						note: rand(500, 580),
						duration: 0.08,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.05,
								sustain: 0.02,
								release: 0.05,
							},
						},
						note: rand(760, 840),
						duration: 0.08,
						when: now + 0.03,
					})
				},

				danger: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.001,
								decay: 0.07,
								sustain: 0.04,
								release: 0.05,
							},
						},
						note: 180,
						duration: 0.12,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.03,
								sustain: 0,
								release: 0.03,
							},
						},
						note: 1200,
						duration: 0.06,
						when: now + 0.01,
						velocity: 0.4,
					})
				},

				player_shot: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.03,
								sustain: 0.01,
								release: 0.03,
							},
						},
						note: rand(780, 920),
						duration: 0.06,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.001,
								decay: 0.02,
								sustain: 0,
								release: 0.025,
							},
						},
						note: rand(1180, 1320),
						duration: 0.045,
						when: now + 0.003,
						velocity: 0.5,
					})
				},

				enemy_shot: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.001,
								decay: 0.05,
								sustain: 0.02,
								release: 0.05,
							},
						},
						note: rand(540, 660),
						duration: 0.1,
						when: now,
					})
				},

				enemy_hit: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.04,
								sustain: 0,
								release: 0.02,
							},
						},
						duration: 0.05,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.04,
								sustain: 0.01,
								release: 0.03,
							},
						},
						note: rand(260, 320),
						duration: 0.07,
						when: now,
					})
				},

				enemy_explode: () => {
					const bus = this.createFxBus({
						delayTime: 0.1,
						feedback: 0.18,
						wet: 0.18,
						lowpass: 2200,
					})
					this.triggerEffectNoise({
						options: {
							noise: { type: "brown" },
							envelope: {
								attack: 0.001,
								decay: 0.14,
								sustain: 0,
								release: 0.05,
							},
						},
						duration: 0.16,
						when: now,
						target: bus,
					})
					this.triggerEffectSynth({
						synthFactory: "MembraneSynth",
						options: {
							pitchDecay: 0.05,
							octaves: 6,
							envelope: {
								attack: 0.001,
								decay: 0.16,
								sustain: 0,
								release: 0.08,
							},
						},
						note: rand(52, 68),
						duration: 0.16,
						when: now,
						target: bus,
					})
				},

				player_hit: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "brown" },
							envelope: {
								attack: 0.001,
								decay: 0.08,
								sustain: 0,
								release: 0.04,
							},
						},
						duration: 0.1,
						when: now,
					})
					this.triggerEffectSynth({
						synthFactory: "MembraneSynth",
						options: {
							pitchDecay: 0.05,
							octaves: 5,
						},
						note: rand(65, 85),
						duration: 0.18,
						when: now,
					})
				},

				boss_appear: () => {
					const bus = this.createFxBus({
						delayTime: 0.16,
						feedback: 0.28,
						wet: 0.24,
						lowpass: 2400,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.02,
								decay: 0.22,
								sustain: 0.2,
								release: 0.32,
							},
						},
						note: 90,
						duration: 0.45,
						when: now,
						target: bus,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.02,
								decay: 0.18,
								sustain: 0.16,
								release: 0.22,
							},
						},
						note: 240,
						duration: 0.35,
						when: now + 0.03,
						target: bus,
					})
				},

				boss_hit: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.04,
								sustain: 0,
								release: 0.03,
							},
						},
						duration: 0.05,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.05,
								sustain: 0.02,
								release: 0.04,
							},
						},
						note: rand(160, 210),
						duration: 0.09,
						when: now,
					})
				},

				boss_fire: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.001,
								decay: 0.08,
								sustain: 0.03,
								release: 0.06,
							},
						},
						note: rand(320, 420),
						duration: 0.16,
						when: now,
					})
					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.03,
								sustain: 0,
								release: 0.02,
							},
						},
						duration: 0.04,
						when: now,
					})
				},

				boss_explode: () => {
					const bus = this.createFxBus({
						delayTime: 0.18,
						feedback: 0.3,
						wet: 0.26,
						lowpass: 1800,
					})
					this.triggerEffectNoise({
						options: {
							noise: { type: "brown" },
							envelope: {
								attack: 0.001,
								decay: 0.24,
								sustain: 0,
								release: 0.08,
							},
						},
						duration: 0.28,
						when: now,
						target: bus,
					})
					this.triggerEffectSynth({
						synthFactory: "MembraneSynth",
						options: {
							pitchDecay: 0.09,
							octaves: 8,
							envelope: {
								attack: 0.001,
								decay: 0.32,
								sustain: 0,
								release: 0.08,
							},
						},
						note: rand(36, 48),
						duration: 0.34,
						when: now,
						target: bus,
					})
				},

				wave_start: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.05,
								sustain: 0.02,
								release: 0.04,
							},
						},
						note: 420,
						duration: 0.09,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.06,
								sustain: 0.02,
								release: 0.05,
							},
						},
						note: 640,
						duration: 0.1,
						when: now + 0.04,
					})
				},

				extra_life: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.05,
								sustain: 0.02,
								release: 0.06,
							},
						},
						note: 520,
						duration: 0.08,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.06,
								sustain: 0.02,
								release: 0.06,
							},
						},
						note: 760,
						duration: 0.09,
						when: now + 0.04,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.06,
								sustain: 0.02,
								release: 0.06,
							},
						},
						note: 1020,
						duration: 0.1,
						when: now + 0.08,
					})
				},

				card_flip: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "white" },
							envelope: {
								attack: 0.001,
								decay: 0.018,
								sustain: 0,
								release: 0.012,
							},
						},
						duration: 0.02,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.001,
								decay: 0.02,
								sustain: 0,
								release: 0.015,
							},
						},
						note: 820,
						duration: 0.035,
						when: now,
						velocity: 0.4,
					})
				},

				card_slide: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "pink" },
							envelope: {
								attack: 0.001,
								decay: 0.04,
								sustain: 0,
								release: 0.03,
							},
						},
						duration: 0.07,
						when: now,
					})
				},

				chip_click: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.014,
								sustain: 0,
								release: 0.01,
							},
						},
						note: 1400,
						duration: 0.025,
						when: now,
						velocity: 0.35,
					})
				},

				chip_stack: () => {
					effects.chip_click()
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "square" },
							envelope: {
								attack: 0.001,
								decay: 0.014,
								sustain: 0,
								release: 0.01,
							},
						},
						note: 1200,
						duration: 0.025,
						when: now + 0.02,
						velocity: 0.3,
					})
				},

				shuffle: () => {
					this.triggerEffectNoise({
						options: {
							noise: { type: "pink" },
							envelope: {
								attack: 0.001,
								decay: 0.08,
								sustain: 0,
								release: 0.03,
							},
						},
						duration: 0.11,
						when: now,
					})
				},

				deal: () => {
					effects.card_slide()
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.001,
								decay: 0.02,
								sustain: 0,
								release: 0.02,
							},
						},
						note: 560,
						duration: 0.04,
						when: now + 0.006,
						velocity: 0.3,
					})
				},

				blackjack: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.05,
								sustain: 0.04,
								release: 0.05,
							},
						},
						note: 520,
						duration: 0.09,
						when: now,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.06,
								sustain: 0.04,
								release: 0.06,
							},
						},
						note: 780,
						duration: 0.11,
						when: now + 0.06,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.07,
								sustain: 0.04,
								release: 0.06,
							},
						},
						note: 1180,
						duration: 0.12,
						when: now + 0.12,
					})
				},

				bust: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.002,
								decay: 0.08,
								sustain: 0.03,
								release: 0.08,
							},
						},
						note: 420,
						duration: 0.18,
						when: now,
					})
				},

				win_sting: () => effects.blackjack(),

				lose_sting: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.06,
								sustain: 0.03,
								release: 0.06,
							},
						},
						note: 340,
						duration: 0.16,
						when: now,
					})
				},

				push_sting: () => {
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.03,
								sustain: 0.02,
								release: 0.04,
							},
						},
						note: 460,
						duration: 0.08,
						when: now,
						velocity: 0.35,
					})
				},

				gameover: () => {
					const bus = this.createFxBus({
						delayTime: 0.16,
						feedback: 0.22,
						wet: 0.18,
						lowpass: 1600,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "sawtooth" },
							envelope: {
								attack: 0.002,
								decay: 0.16,
								sustain: 0.08,
								release: 0.18,
							},
						},
						note: 280,
						duration: 0.36,
						when: now,
						target: bus,
					})
					this.triggerEffectSynth({
						options: {
							oscillator: { type: "triangle" },
							envelope: {
								attack: 0.002,
								decay: 0.18,
								sustain: 0.06,
								release: 0.2,
							},
						},
						note: 140,
						duration: 0.42,
						when: now,
						target: bus,
					})
				},
			}

			const effect = effects[type]
			if (effect) effect()
		}

		createFilePlayer(url, options = {}) {
			if (!this.Tone || !this.toneReady) return null
			const player = new this.Tone.Player({
				url: url,
				autostart: options.autostart || false,
				loop: options.loop || false,
				onstop: options.onstop || null,
				onload: options.onload || null,
			})
			player.connect(this.fileGain || this.musicGain || this.master)
			return player
		}

		isFilePlayerReady(player = this.filePlayer) {
			if (!player || !this.filePlayerLoaded) return false
			if (player.loaded === true) return true
			if (player?.buffer?.loaded === true) return true
			if (Number(player?.buffer?.duration || 0) > 0) return true
			return false
		}

		async waitForFilePlayerReady(timeoutMs = 4000) {
			if (this.isFilePlayerReady()) return true
			const startedAt = Date.now()
			while (Date.now() - startedAt < timeoutMs) {
				await new Promise((resolve) => window.setTimeout(resolve, 25))
				if (this.isFilePlayerReady()) return true
			}
			return this.isFilePlayerReady()
		}

		async loadFile(source, meta = {}) {
			try {
				await this.ensureAudioLibraries()
			} catch (error) {
				this.setPlaybackError(error?.message || "Audio libraries failed to load.")
				return null
			}
			this.ensureContext()
			if (!this.Tone || !this.toneReady) {
				this.setPlaybackError("Audio runtime is not ready.")
				return null
			}
			if (!source) {
				this.setPlaybackError("Missing file source.")
				return null
			}

			const playerSource =
				typeof source === "object" && source !== null
					? source.buffer ||
						source.url ||
						source.src ||
						(typeof AudioBuffer !== "undefined" &&
						source instanceof AudioBuffer
							? source
							: null)
					: source
			if (!playerSource) {
				this.setPlaybackError("Missing file source.")
				return null
			}
			const src =
				typeof playerSource === "string"
					? playerSource
					: String(meta.source || "")

			this.stopMusic(false)
			this.stopFile(false, false)
			this.fileSource = src
			this.fileMeta = { ...meta }
			this.filePausedAt = 0
			this.fileDuration = 0
			this.filePlayerLoaded = false
			const loadToken = ++this.fileLoadToken
			this.fileStopReason = "load"
			this.emitPlaybackState("file:loading", {
				mode: "file",
				status: "loading",
				nowPlaying: this.buildNowPlaying(meta, src),
				error: "",
			})

			this.fileLoadPromise = new Promise((resolve) => {
				const player = this.createFilePlayer(playerSource, {
					autostart: false,
					loop: !!meta.loop,
					onstop: () => {
						const reason = this.fileStopReason
						this.fileIsPlaying = false
						this.clearFileProgressTimer()
						if (reason === "pause") {
							this.emitPlaybackState("file:paused", {
								mode: "file",
								status: "paused",
							})
							return
						}
						if (reason === "seek" || reason === "stop") {
							this.emitPlaybackState("file:stopped", {
								mode: "file",
								status: "stopped",
								nowPlaying: this.buildNowPlaying(meta, src),
							})
							return
						}

						this.filePausedAt = 0
						this.emitPlaybackState("file:ended", {
							mode: "file",
							status: "stopped",
							nowPlaying: this.buildNowPlaying(
								{ ...meta, currentTime: this.fileDuration || 0 },
								src,
							),
						})
						this.next()
					},
					onload: () => {
						if (loadToken !== this.fileLoadToken) {
							resolve(null)
							return
						}
						this.filePlayerLoaded = true
						this.fileDuration = Number(
							player?.buffer?.duration || meta.duration || 0,
						)
						resolve(player)
						this.emitPlaybackState("loaded", {
							mode: "file",
							status: "stopped",
							nowPlaying: this.buildNowPlaying(
								{ ...meta, duration: this.fileDuration, currentTime: 0 },
								src,
							),
							error: null,
						})
					},
				})
				if (!player) {
					this.setPlaybackError("Unable to create file player.")
					resolve(null)
					return
				}
				this.filePlayer = player
				this.setFileVolume(this.fileVolume)
			})
			const loadedPlayer = await this.fileLoadPromise
			this.fileLoadPromise = null
			return loadedPlayer
		}

		async playFile() {
			await this.resume()
			if (this.fileLoadPromise) {
				await this.fileLoadPromise
			}
			if (!this.filePlayer || !this.filePlayerLoaded) {
				if (this.queueIndex >= 0 && this.queue[this.queueIndex]) {
					const item = this.queue[this.queueIndex]
					await this.loadFile(item.source, item.meta || {})
				}
			}
			if (!this.filePlayer || !this.filePlayerLoaded || !(await this.waitForFilePlayerReady())) {
				this.setPlaybackError("No file is loaded.")
				return false
			}

			this.stopMusic()
			const offset = Math.max(
				0,
				Math.min(this.filePausedAt || 0, this.fileDuration || Infinity),
			)
			this.fileStopReason = "play"
			try {
				this.filePlayer.start(undefined, offset)
			} catch (_error) {
				const ready = await this.waitForFilePlayerReady(1500)
				if (!ready) {
					this.setPlaybackError("File buffer is not ready.")
					return false
				}
				this.filePlayer.start(undefined, offset)
			}
			this.fileStartedAt = this.Tone.now() - offset
			this.fileIsPlaying = true
			this.startFileProgressTimer()
			this.emitPlaybackState("file:playing", {
				mode: "file",
				status: "playing",
				nowPlaying: this.buildNowPlaying(this.fileMeta, this.fileSource),
				error: null,
			})
			return true
		}

		pauseFile() {
			if (!this.filePlayer || !this.fileIsPlaying) return false
			this.filePausedAt = this.getFileCurrentTime()
			this.fileStopReason = "pause"
			this.filePlayer.stop()
			this.fileIsPlaying = false
			this.clearFileProgressTimer()
			this.emitPlaybackState("file:paused", {
				mode: "file",
				status: "paused",
			})
			return true
		}

		stopFile(emitState = true, preserveSource = true) {
			this.clearFileProgressTimer()
			if (this.filePlayer) {
				this.fileStopReason = "stop"
				if (this.fileIsPlaying) {
					this.filePlayer.stop()
				}
				try {
					this.filePlayer.dispose?.()
				} catch (_err) {}
			}
			this.filePlayer = null
			this.filePlayerLoaded = false
			this.filePausedAt = 0
			this.fileDuration = 0
			this.fileIsPlaying = false
			if (!preserveSource) {
				this.fileSource = ""
				this.fileMeta = {}
			}
			if (emitState) {
				this.emitPlaybackState("file:stopped", {
					mode: "file",
					status: "stopped",
					nowPlaying: {
						type: "file",
						id: null,
						title: "",
						duration: 0,
						currentTime: 0,
						source: "",
						metadata: {},
					},
				})
			}
			return true
		}

		seekFile(position) {
			if (!this.filePlayer || !this.filePlayerLoaded) return false
			const target = Math.max(
				0,
				Math.min(Number(position) || 0, this.fileDuration || Infinity),
			)
			const wasPlaying = this.fileIsPlaying
			this.filePausedAt = target
			if (wasPlaying) {
				this.fileStopReason = "seek"
				this.filePlayer.stop()
				this.fileIsPlaying = false
				this.playFile()
			} else {
				this.emitPlaybackState("file:seek", {
					mode: "file",
					status: "paused",
					currentTime: target,
				})
			}
			return true
		}

		setFileVolume(value) {
			this.fileVolume = this.clamp(value, 0, 1)
			if (this.filePlayer?.volume && this.Tone?.gainToDb) {
				const db = this.fileVolume <= 0.0001
					? -96
					: this.Tone.gainToDb(this.fileVolume)
				this.filePlayer.volume.value = db
			}
			this.emitPlaybackState("file:volume")
			return this.fileVolume
		}

		setFileEQ(settings = {}) {
			const patch = {}
			if (Object.prototype.hasOwnProperty.call(settings, "bass")) {
				patch.bass = this.clamp(settings.bass, 0, 2)
			}
			if (Object.prototype.hasOwnProperty.call(settings, "synth")) {
				patch.synth = this.clamp(settings.synth, 0, 2)
			}
			if (Object.prototype.hasOwnProperty.call(settings, "drums")) {
				patch.drums = this.clamp(settings.drums, 0, 2)
			}
			if (Object.keys(patch).length > 0) {
				this.setMixLevels(patch)
			}
			if (Object.prototype.hasOwnProperty.call(settings, "bassBoost")) {
				this.setBassBoostEnabled(!!settings.bassBoost)
			}
			this.emitPlaybackState("file:eq")
		}

		stopMidiPlayback(emitState = false, resetPosition = true) {
			this.clearMidiProgressTimer()
			this.clearMidiEndTimeout()
			if (Array.isArray(this.midiParts)) {
				this.midiParts.forEach((part) => {
					try {
						part?.stop?.(0)
						part?.dispose?.()
					} catch (_err) {}
				})
			}
			this.midiParts = []
			this.midiActive = false
			this.lastMidiTriggerTime = -Infinity
			if (resetPosition) this.midiPausedAt = 0
			this.midiStartedAt = 0
			this.midiDuration = Number(this.midiDerivative?.playback?.duration || 0)
			if (this.Tone?.Transport) {
				try {
					this.Tone.Transport.stop()
					this.Tone.Transport.cancel(0)
				} catch (_err) {}
			}
			if (emitState) {
				this.emitPlaybackState("midi:stopped", {
					mode: "track",
					status: "stopped",
					nowPlaying: this.buildNowPlaying(
						{
							type: "track",
							id: this.midiDerivative?.source?.id || null,
							title: this.midiDerivative?.source?.title || "MIDI Track",
							duration: this.midiDuration || 0,
							mediaType: "midi",
							mime: "audio/midi",
							sourceHash: this.midiSourceHash || "",
						},
						this.midiDerivative?.source?.url || "",
					),
				})
			}
		}

		triggerMidiNote(track, note, time) {
			const velocity = this.clamp(note?.velocity ?? 0.8, 0, 1)
			const duration = Math.max(0.01, Number(note?.duration || 0.06))
			const midiValue = Number(note?.midi || 0)
			const noteName = this.midiToNote(midiValue)
			if (!noteName) return
			const epsilon = 0.0001
			const toneNow = Number(this.Tone?.now ? this.Tone.now() : 0)
			const requested = Number(time)
			const baseTime = Number.isFinite(requested) ? Math.max(requested, toneNow) : toneNow
			const previous = Number(this.lastMidiTriggerTime ?? -Infinity)
			const safeTime = baseTime <= previous ? previous + epsilon : baseTime
			this.lastMidiTriggerTime = safeTime

			const lane = String(track?.lane || "")
			const isPercussion =
				lane === "drums" ||
				track?.instrument?.percussion === true ||
				Number(track?.channel) === 9
			if (isPercussion) {
				if (midiValue <= 38) this.playPercussion("kick", safeTime)
				else if (midiValue <= 46) this.playPercussion("snare", safeTime)
				else this.playPercussion("hihat", safeTime)
				return
			}

			if (lane === "bass") {
				this.toneInstruments.bassMain?.triggerAttackRelease(
					noteName,
					duration,
					safeTime,
					velocity,
				)
				this.toneInstruments.bassSub?.triggerAttackRelease(
					noteName,
					duration,
					safeTime,
					velocity * 0.8,
				)
				return
			}

			this.toneInstruments.lead?.triggerAttackRelease(
				noteName,
				duration,
				safeTime,
				velocity,
			)
		}

		async loadMidi(source = {}, options = {}) {
			await this.resume()
			if (!this.Tone || !this.toneReady) {
				this.setPlaybackError("Audio runtime is not ready.")
				return false
			}

			let derivative =
				source?.data && typeof source.data === "object"
					? source.data
					: source?.derivative && typeof source.derivative === "object"
						? source.derivative
						: null

			const metadata = {
				...(options.metadata || {}),
			}
			if (options.title) metadata.title = options.title

			if (!derivative && source?.buffer) {
				derivative = await this.buildMidiDerivativeFromArrayBuffer(source.buffer, {
					sourceType: metadata.origin || "player",
					id: source?.id ?? null,
					title: options.title || metadata.title || "MIDI Track",
					mime: metadata.mime || "audio/midi",
					filename: metadata.filename || "",
					url: typeof source?.url === "string" ? source.url : "",
				})
			}

			if (!derivative && typeof source?.url === "string" && source.url) {
				const response = await fetch(source.url, { credentials: "same-origin" })
				if (!response.ok) throw new Error(`Unable to fetch MIDI source: ${response.status}`)
				const buffer = await response.arrayBuffer()
				derivative = await this.buildMidiDerivativeFromArrayBuffer(buffer, {
					sourceType: metadata.origin || "vault",
					id: source?.id ?? null,
					title: options.title || metadata.title || "MIDI Track",
					mime: metadata.mime || "audio/midi",
					filename: metadata.filename || "",
					url: source.url,
				})
			}

			const normalized = this.normalizeMidiDerivative(derivative)
			if (!normalized) {
				this.setPlaybackError("Invalid MIDI derivative.")
				return false
			}

			const cacheKey = this.getMidiCacheKey(normalized)
			if (cacheKey && !this.midiDerivativeCache.has(cacheKey)) {
				this.midiDerivativeCache.set(cacheKey, normalized)
			}

			this.stopFile(false, false)
			this.stopMusic(false)
			this.stopMidiPlayback(false, false)

			this.midiDerivative = normalized
			this.midiSourceHash = String(normalized?.source?.hash || "")
			this.midiDuration = Number(normalized?.playback?.duration || 0)
			this.midiPausedAt = 0
			this.midiActive = false
			this.currentTrack = String(source?.id || normalized?.source?.id || this.currentTrack)

			const nowPlaying = this.buildNowPlaying(
				{
					type: "track",
					id: source?.id ?? normalized?.source?.id ?? null,
					title:
						options.title ||
						metadata.title ||
						normalized?.source?.title ||
						normalized?.summary?.title ||
						"MIDI Track",
					duration: this.midiDuration,
					sourceHash: this.midiSourceHash,
					mediaType: "midi",
					mime: "audio/midi",
					parserVersion:
						normalized?.parser?.version || this.midiParserVersion,
					derivativeVersion:
						normalized?.version || this.midiSchemaVersion,
					...(normalized?.source?.sourceType
						? { sourceType: normalized.source.sourceType }
						: {}),
					...metadata,
				},
				String(source?.url || normalized?.source?.url || ""),
			)

			this.emitPlaybackState("loaded", {
				mode: "track",
				status: "stopped",
				nowPlaying,
				error: null,
			})
			return true
		}

		async playMidi() {
			await this.resume()
			if (!this.Tone || !this.toneReady || !this.midiDerivative) {
				this.setPlaybackError("No MIDI source is loaded.")
				return false
			}

			this.stopMusic(false)
			this.stopFile(false, false)
			this.stopMidiPlayback(false, false)

			const Tone = this.Tone
			const offset = Math.max(
				0,
				Math.min(this.midiPausedAt || 0, this.midiDuration || Infinity),
			)
			const tracks = Array.isArray(this.midiDerivative?.tracks)
				? this.midiDerivative.tracks
				: []

			const firstTempo = Number(this.midiDerivative?.timing?.tempoMap?.[0]?.bpm || 120)
			Tone.Transport.bpm.value = firstTempo
			Tone.Transport.loop = false

			this.midiParts = tracks.map((track) => {
				const events = (Array.isArray(track?.notes) ? track.notes : []).map((note) => [
					Math.max(0, Number(note?.time || 0)),
					note,
				])
				const part = this.trackDisposable(
					new Tone.Part((time, note) => {
						this.triggerMidiNote(track, note, time)
					}, events),
				)
				part.start(0, offset)
				return part
			})

			this.midiStartedAt = Tone.now() - offset
			this.midiActive = true
			this.startMidiProgressTimer()
			Tone.Transport.start("+0.01", offset)

			const timeRemaining =
				Math.max(0, (this.midiDuration || 0) - offset) * 1000 + 50
			this.clearMidiEndTimeout()
			this.midiEndTimeout = window.setTimeout(() => {
				if (!this.midiActive) return
				this.stopMidiPlayback(false)
				this.emitPlaybackState("midi:ended", {
					mode: "track",
					status: "stopped",
					nowPlaying: this.buildNowPlaying(
						{
							type: "track",
							id: this.midiDerivative?.source?.id || null,
							title: this.midiDerivative?.source?.title || "MIDI Track",
							duration: this.midiDuration || 0,
							currentTime: this.midiDuration || 0,
							mediaType: "midi",
							mime: "audio/midi",
							sourceHash: this.midiSourceHash || "",
						},
						this.midiDerivative?.source?.url || "",
					),
				})
				this.next()
			}, timeRemaining)

			this.emitPlaybackState("midi:playing", {
				mode: "track",
				status: "playing",
				nowPlaying: this.buildNowPlaying(
					{
						type: "track",
						id: this.midiDerivative?.source?.id || null,
						title: this.midiDerivative?.source?.title || "MIDI Track",
						duration: this.midiDuration || 0,
						mediaType: "midi",
						mime: "audio/midi",
						sourceHash: this.midiSourceHash || "",
					},
					this.midiDerivative?.source?.url || "",
				),
				error: null,
			})
			return true
		}

		pauseMidi() {
			if (!this.midiDerivative) return false
			if (this.midiActive && this.Tone?.Transport) {
				try {
					this.Tone.Transport.pause()
				} catch (_err) {}
			}
			this.midiPausedAt = this.getMidiCurrentTime()
			this.stopMidiPlayback(false, false)
			this.midiActive = false
			this.emitPlaybackState("midi:paused", {
				mode: "track",
				status: "paused",
				nowPlaying: this.buildNowPlaying(
					{
						type: "track",
						id: this.midiDerivative?.source?.id || null,
						title: this.midiDerivative?.source?.title || "MIDI Track",
						duration: this.midiDuration || 0,
						currentTime: this.midiPausedAt || 0,
						mediaType: "midi",
						mime: "audio/midi",
						sourceHash: this.midiSourceHash || "",
					},
					this.midiDerivative?.source?.url || "",
				),
			})
			return true
		}

		seekMidi(position) {
			if (!this.midiDerivative) return false
			const target = Math.max(
				0,
				Math.min(Number(position) || 0, this.midiDuration || Infinity),
			)
			const wasPlaying = this.midiActive
			this.midiPausedAt = target
			if (wasPlaying) {
				this.playMidi()
			} else {
				this.emitPlaybackState("midi:seek", {
					mode: "track",
					status: "paused",
					nowPlaying: this.buildNowPlaying(
						{
							type: "track",
							id: this.midiDerivative?.source?.id || null,
							title: this.midiDerivative?.source?.title || "MIDI Track",
							duration: this.midiDuration || 0,
							currentTime: target,
							mediaType: "midi",
							mime: "audio/midi",
							sourceHash: this.midiSourceHash || "",
						},
						this.midiDerivative?.source?.url || "",
					),
				})
			}
			return true
		}

		async playSource(source, meta = {}) {
			const loaded = await this.load(
				{
					type: "file",
					url: String(source || ""),
					id: meta?.id || null,
				},
				{
					title: meta?.title || "Imported Source",
					metadata: { ...meta },
					autoplay: true,
				},
			)
			return !!loaded
		}

		async load(source, options = {}) {
			const requestedType = String(source?.type || "")
			const type =
				requestedType === "midi"
					? "midi"
					: requestedType === "file"
						? "file"
						: "track"
			const metadata = {
				...(options.metadata || {}),
			}
			if (options.title) metadata.title = options.title
			if (source?.id != null && metadata.id == null) metadata.id = source.id
			const autoplay = options.autoplay === true

			if (type === "track") {
				const trackId = String(source?.id || "")
				if (!trackId || !this.songs[trackId]) {
					this.setPlaybackError(`Unknown track: ${trackId || "missing id"}`)
					return false
				}
				this.stopMidiPlayback(false)
				this.midiDerivative = null
				this.midiSourceHash = ""
				this.stopFile(false, false)
				this.stopMusic(false)
				this.setTrack(trackId)
				this.emitPlaybackState("loaded", {
					mode: "track",
					status: "stopped",
					nowPlaying: {
						type: "track",
						id: trackId,
						title: options.title || this.songs[trackId]?.title || trackId,
						duration: 0,
						currentTime: 0,
						source: trackId,
						metadata: { id: trackId, ...metadata },
					},
					error: null,
				})
				if (autoplay) return await this.play()
				return true
			}

			if (type === "midi") {
				try {
					const loaded = await this.loadMidi(source, options)
					if (!loaded) return false
					if (autoplay) return await this.playMidi()
					return true
				} catch (error) {
					console.error("SystemDeckAudio: MIDI load failed.", error)
					this.setPlaybackError("Unable to load MIDI source.")
					return false
				}
			}

			const fileUrl = source?.url || source?.buffer || null
			if (!fileUrl) {
				this.setPlaybackError("File source requires a url or buffer.")
				return false
			}

			const mime = String(metadata?.mime || "").toLowerCase()
			const sourceUrl =
				typeof source?.url === "string" ? source.url.toLowerCase() : ""
			if (
				(typeof source?.url === "string" &&
					(sourceUrl.endsWith(".mid") || sourceUrl.endsWith(".midi"))) ||
				mime.includes("midi")
			) {
				const loaded = await this.loadMidi(
					{
						type: "midi",
						url: String(source?.url || ""),
						id: source?.id ?? null,
						data: source?.derivative || metadata?.midiDerivative || null,
					},
					{
						title: options.title || metadata.title || "MIDI Track",
						metadata: {
							...metadata,
							mediaType: "midi",
						},
					},
				)
				if (!loaded) return false
				if (autoplay) return await this.playMidi()
				return true
			}

			const loaded = await this.loadFile(fileUrl, {
				...metadata,
				type: "file",
				id: source?.id ?? null,
				title: options.title || metadata.title || metadata.name || "Untitled",
				source: typeof source?.url === "string" ? source.url : "",
			})
			if (!loaded) return false
			if (autoplay) return await this.playFile()
			return true
		}

		async play() {
			if (this.midiDerivative) {
				return await this.playMidi()
			}
			if (this.getMode() === "file" || this.filePlayer || this.fileSource) {
				if (!this.filePlayer && this.fileSource) {
					const loaded = await this.loadFile(this.fileSource, this.fileMeta || {})
					if (!loaded) return false
				}
				return await this.playFile()
			}
			await this.resume()
			this.startMusic()
			return true
		}

		pause() {
			if (this.midiDerivative) {
				return this.pauseMidi()
			}
			if (this.getMode() === "file" || this.filePlayer) {
				return this.pauseFile()
			}
			this.stopMusic(false)
			this.emitPlaybackState("music:paused", {
				mode: "track",
				status: "paused",
				nowPlaying: {
					type: "track",
					id: this.currentTrack,
					title: this.songs[this.currentTrack]?.title || this.currentTrack || "",
					duration: 0,
					currentTime: 0,
					source: this.currentTrack || "",
					metadata: { id: this.currentTrack || null },
				},
			})
			return true
		}

		stop() {
			this.stopMusic()
			this.stopFile(false)
			this.stopMidiPlayback(false)
			this.emitPlaybackState("transport:stop", {
				mode: this.fileSource ? "file" : "track",
				status: "stopped",
				nowPlaying: this.fileSource
					? this.buildNowPlaying(this.fileMeta || {}, this.fileSource)
					: this.midiDerivative
						? this.buildNowPlaying(
								{
									type: "track",
									id: this.midiDerivative?.source?.id || null,
									title:
										this.midiDerivative?.source?.title || "MIDI Track",
									duration: this.midiDuration || 0,
									mediaType: "midi",
									mime: "audio/midi",
									sourceHash: this.midiSourceHash || "",
								},
								this.midiDerivative?.source?.url || "",
							)
					: {
							type: "track",
							id: this.currentTrack || null,
							title:
								this.songs[this.currentTrack]?.title || this.currentTrack || "",
							duration: 0,
							currentTime: 0,
							source: this.currentTrack || "",
							metadata: { id: this.currentTrack || null },
						},
			})
			return true
		}

		seek(seconds) {
			if (this.midiDerivative) {
				return this.seekMidi(seconds)
			}
			if (this.getMode() === "file" || this.filePlayer) {
				return this.seekFile(seconds)
			}
			return false
		}

		setQueue(items = []) {
			this.queue = Array.isArray(items)
				? items
						.map((item) => {
							if (!item) return null
							const source =
								typeof item === "string"
									? item
									: String(item.source || item.url || "")
							if (!source) return null
							const meta =
								typeof item === "string"
									? {}
									: { ...(item.meta || {}), ...(item || {}) }
							return { source, meta }
						})
						.filter(Boolean)
				: []
			this.queueIndex = this.queue.length > 0 ? 0 : -1
			this.emitPlaybackState("queue:set")
			return this.queue.map((item) => ({ ...item }))
		}

		enqueueSource(source, meta = {}) {
			const src = String(source || "")
			if (!src) return this.queue.length
			this.queue.push({ source: src, meta: { ...meta } })
			if (this.queueIndex < 0) this.queueIndex = 0
			this.emitPlaybackState("queue:enqueue")
			return this.queue.length
		}

		async next() {
			if (!Array.isArray(this.queue) || this.queue.length === 0) return false
			const nextIndex = (this.queueIndex + 1) % this.queue.length
			this.queueIndex = nextIndex
			const item = this.queue[nextIndex]
			if (!item) return false
			return await this.playSource(item.source, item.meta || {})
		}

		async previous() {
			if (!Array.isArray(this.queue) || this.queue.length === 0) return false
			const prevIndex =
				(this.queueIndex - 1 + this.queue.length) % this.queue.length
			this.queueIndex = prevIndex
			const item = this.queue[prevIndex]
			if (!item) return false
			return await this.playSource(item.source, item.meta || {})
		}

		async playMidiTrack(url, title = "MIDI Track", options = {}) {
			try {
				const response = await fetch(url, { credentials: "same-origin" })
				if (!response.ok) {
					throw new Error(`Unable to fetch MIDI source: ${response.status}`)
				}
				const buffer = await response.arrayBuffer()
				const derivative = await this.buildMidiDerivativeFromArrayBuffer(buffer, {
					sourceType: String(options?.sourceType || "legacy"),
					id: options?.trackId ?? null,
					title: title || "MIDI Track",
					mime: "audio/midi",
					filename: String(options?.filename || ""),
					url,
				})
				const loaded = await this.loadMidi(
					{
						type: "midi",
						url,
						id: options?.trackId ?? null,
						data: derivative,
					},
					{
						title: title || "MIDI Track",
						metadata: {
							...(options?.metadata || {}),
							mime: "audio/midi",
							mediaType: "midi",
							sourceHash: derivative?.source?.hash || "",
							parserVersion:
								derivative?.parser?.version || this.midiParserVersion,
							derivativeVersion:
								derivative?.version || this.midiSchemaVersion,
						},
						autoplay: false,
					},
				)
				if (!loaded) return false
				if (options.autoplay === true) {
					return await this.playMidi()
				}
				return true
			} catch (error) {
				console.error("SystemDeckAudio: MIDI parse failed.", error)
				this.setPlaybackError("Unable to parse MIDI track.")
				return false
			}
		}

		startMusic() {
			this.stopFile(false, false)
			this.stopMusic(false)
			this.applyTrackDefaultMix(this.currentTrack)
			this.musicRunning = true
			const trackTitle =
				this.songs[this.currentTrack]?.title || this.currentTrack || "Track"
			this.emitPlaybackState("music:start", {
				mode: "track",
				status: "playing",
				nowPlaying: {
					type: "track",
					id: this.currentTrack || null,
					title: trackTitle,
					duration: 0,
					currentTime: 0,
					source: this.currentTrack,
					metadata: {
						id: this.currentTrack || null,
						mime: "application/x-systemdeck-track",
						origin: "systemdeck-track",
					},
				},
				error: null,
			})
			this.queueNextNote()
		}

		stopMusic(emitState = true) {
			if (this.musicTimer) {
				clearTimeout(this.musicTimer)
				this.musicTimer = null
			}
			this.musicRunning = false
			if (emitState && !this.fileIsPlaying) {
				this.emitPlaybackState("music:stop", {
					mode: "track",
					status: "stopped",
					nowPlaying: {
						type: "track",
						id: this.currentTrack || null,
						title:
							this.songs[this.currentTrack]?.title || this.currentTrack || "",
						duration: 0,
						currentTime: 0,
						source: this.currentTrack || "",
						metadata: { id: this.currentTrack || null },
					},
				})
			}
		}

		playTwang(midi, time, dur) {
			const note = this.midiToNote(midi)
			if (!note || !this.toneInstruments.twang) return
			this.toneInstruments.twang.triggerAttack(note, time)
		}

		playSurf(midi, time, dur) {
			const note = this.midiToNote(midi)
			if (!note || !this.toneInstruments.surf) return
			this.toneInstruments.surf.triggerAttackRelease(
				note,
				dur * 1.8,
				time,
				0.65,
			)
		}

		playPiano(midi, time, dur) {
			const note = this.midiToNote(midi)
			if (!note || !this.toneInstruments.piano) return
			this.toneInstruments.piano.triggerAttackRelease(
				note,
				dur * 2.6,
				time,
				0.65,
			)
		}

		playLaneStep(lane, note, now, noteDur, patternName = "") {
			if (!(note > 0) || !this.Tone) return
			const noteName = this.midiToNote(note)
			if (!noteName) return

			switch (lane) {
				case "bass": {
					if (this.toneInstruments.bassMain) {
						this.toneInstruments.bassMain.triggerAttackRelease(
							noteName,
							noteDur * 1.1,
							now,
							0.8,
						)
					}
					if (this.toneInstruments.bassSub) {
						this.toneInstruments.bassSub.triggerAttackRelease(
							noteName,
							noteDur * 1.05,
							now,
							0.6,
						)
					}
					this.lastBassFreq = midiToHz(note)
					break
				}

				case "bell":
					this.toneInstruments.bell?.triggerAttackRelease(
						noteName,
						noteDur * 5.5,
						now,
						0.45,
					)
					break

				case "twang":
					this.playTwang(note, now, noteDur)
					break

				case "piano":
					this.playPiano(note, now, noteDur)
					break

				case "surf":
					this.playSurf(note, now, noteDur)
					break

				case "horn":
					this.toneInstruments.horn?.triggerAttackRelease(
						noteName,
						noteDur * 0.7,
						now,
						0.7,
					)
					break

				case "synth":
				default: {
					const isSwell = ["intro", "bridge", "outro"].includes(
						patternName,
					)
					if (isSwell) {
						this.toneInstruments.pad?.triggerAttackRelease(
							noteName,
							noteDur * 2.4,
							now,
							0.52,
						)
					} else {
						this.toneInstruments.lead?.triggerAttackRelease(
							noteName,
							noteDur * 1.35,
							now,
							0.58,
						)
					}
					break
				}
			}
		}

		queueNextNote() {
			const trackRef =
				this.songs[this.currentTrack] ||
				this.songs.metal ||
				Object.values(this.songs)[0]
			if (!trackRef) return

			const track = trackRef.data
			const tempo = track.tempo || 120
			const barDur = 60 / tempo
			const noteDur = barDur / 4

			if (!this.Tone || !this.toneReady || this.muted || this.Tone.context.state !== "running") {
				this.musicTimer = window.setTimeout(
					() => this.queueNextNote(),
					noteDur * 1000,
				)
				return
			}

			const now = this.Tone.now() + 0.02
			const totalSteps = track.arrangement.length * 16
			const currentStep = this.musicIndex % totalSteps
			const patternIdx = Math.floor(currentStep / 16)
			const patternName = track.arrangement[patternIdx]
			const pattern = track.patterns[patternName]
			const stepInPattern = currentStep % 16

			if (!pattern || typeof pattern !== "object") {
				this.musicIndex++
				this.musicTimer = window.setTimeout(
					() => this.queueNextNote(),
					noteDur * 1000,
				)
				return
			}

			const bassStep = Number(pattern?.bass?.[stepInPattern] || 0)
			if (bassStep <= 0) this.lastBassFreq = null

			Object.entries(pattern).forEach(([lane, laneSteps]) => {
				if (lane === "drums" || !Array.isArray(laneSteps)) return
				const note = Number(laneSteps[stepInPattern] || 0)
				if (note > 0) {
					this.playLaneStep(lane, note, now, noteDur, patternName)
				}
			})

			const drum = pattern?.drums?.[stepInPattern]
			if (drum === "k") this.playPercussion("kick", now)
			if (drum === "s") this.playPercussion("snare", now)
			if (drum === "h") this.playPercussion("hihat", now)

			this.musicIndex++
			this.musicTimer = window.setTimeout(
				() => this.queueNextNote(),
				noteDur * 1000,
			)
		}

		playPercussion(type, time) {
			if (!this.Tone || !this.toneInstruments) return
			const epsilon = 0.0001
			const now = Number(this.Tone.now ? this.Tone.now() : 0)
			const requested = Number(time)
			const baseTime = Number.isFinite(requested) ? Math.max(requested, now) : now
			const previous = Number(this.lastPercussionStartTimes?.[type] ?? -Infinity)
			const safeTime = baseTime <= previous ? previous + epsilon : baseTime
			if (!this.lastPercussionStartTimes) {
				this.lastPercussionStartTimes = {}
			}
			this.lastPercussionStartTimes[type] = safeTime

			if (type === "kick") {
				this.toneInstruments.kick?.triggerAttackRelease(
					"C1",
					"16n",
					safeTime,
					0.95,
				)
				return
			}

			if (type === "snare") {
				this.toneInstruments.snare?.triggerAttackRelease(
					"16n",
					safeTime,
					0.8,
				)
				return
			}

			if (type === "hihat") {
				this.toneInstruments.hat?.triggerAttackRelease(
					"32n",
					safeTime,
					0.35,
				)
			}
		}

		destroy() {
			this.stopMusic()
			this.stopFile()
			this.stopMidiPlayback(false)
			this.clearFileProgressTimer()
			this.clearMidiProgressTimer()
			this.clearMidiEndTimeout()
			this.subscribers.clear()

			if (typeof window !== "undefined" && window.removeEventListener) {
				window.removeEventListener(
					"systemdeck:audio-settings-changed",
					this.handleGlobalAudioSettingsChange,
				)
			}

			this.disposeToneResources()
			this.audioContext = null
			SystemDeckAudio._instance = null
		}
	}

	return SystemDeckAudio.getInstance()
})()
