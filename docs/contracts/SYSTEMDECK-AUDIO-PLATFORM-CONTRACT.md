# SYSTEMDECK-AUDIO-PLATFORM-CONTRACT

Introduction

This document defines the architecture and data contract for the SystemDeck Audio Platform.

SystemDeck treats audio as a top-level system service, not a feature controlled by individual apps. This architecture allows multiple widgets, apps, and games (such as the **Vic’s Hideaway Plugin App**) to share a single high-performance audio engine, mixer, and song registry.

The platform is composed of three primary modules: the **Audio Runtime** (the engine), **Player System** (the playback widget), and **Player Deck** (the composition app). This contract ensures that all musical data, instrument routing, and playback controls remain consistent across the entire SystemDeck ecosystem.

⸻

1. Introduction

Audio in SystemDeck is a platform-level concern, providing high-performance synthesis and sequencing via a centralized runtime. This contract defines the canonical song format, the instrument routing logic, and the interaction between the system-level mixer and specialized clients like the Vic's Hideaway Plugin App. It ensures that any app meeting the contract can produce and control professional-grade audio without owning the engine.

2. File Tree

The audio platform is governed by these core files:

systemdeck/
├── assets/
│   ├── js/
│   │   ├── sd-audio-engine.js (Core Controller)
│   │   └── vendor/
│   │       └── tone.min.js (Synthesis Engine)

⸻

3. The Audio Runtime

3.1 Service Model
• The audio engine is a global service powered by Tone.js and `sd-audio-engine.js`.
• The shared wrapper is exposed globally via `window.SystemDeckAudio`.
• The underlying audio libraries are loaded lazily on first real audio use, not eagerly on every page load.
• It manages sequencing, synthesis, effects routing, and the master mixer bus.

3.2 Client Integration
• Apps (like the **Vic’s Hideaway Plugin App**) are clients of the runtime.
• They trigger FX and request track changes via `host.audio` but do not own the audio context or lifecycle.

⸻

4. Canonical Song Contract

4.1 Song Data Structure
Songs are registered as JSON objects with the following schema:
• `tempo`: BPM (default: 120).
• `arrangement`: Ordered list of pattern names.
• `patterns`: Map of 16-step rhythmic/melodic arrays.

4.2 Lane Definitions
• `bass`, `synth`, `drums`: The primary mixing lanes.
• `bell`, `twang`, `piano`, `surf`, `horn`: Specialized melodic lanes with unique timbres.
• Melodic steps are expressed as MIDI note numbers; `0` represents a rest.
• Drum steps use string tokens: `"k"` (kick), `"s"` (snare), `"h"` (hihat).

⸻

5. The Player Ecosystem

5.1 Player System (Widget)
• A standard workspace widget for music playback.
• Provides transport controls (Play/Pause/Skip), EQ, and playlist management.
• Can load tracks from the system registry or user-imported files.

5.2 Player Deck (App)
• A first-class SystemDeck App for music composition and editing.
• Provides pattern editors, lane mixing, and project management.
• Supports exporting to MIDI, FLAC, MP3, and the native SystemDeck JSON format.

⸻

6. Recording and Export

6.1 Hybrid Projects
• The platform supports hybrid projects containing both sequenced Note Tracks and recorded Audio Tracks (WAV/MP3).

6.2 Export Targets
• MIDI: Preserves note-lane composition only.
• FLAC/MP3/WAV: Renders the full mixed output from the runtime recorder.
• JSON: Direct export of the SystemDeck project manifest.

⸻

7. Enqueuing and Runtime Mounting

7.1 Platform Asset Registration
SystemDeck core registers the shared audio handles:
• `sd-audio-engine`: The SystemDeck audio wrapper.
• `tone` and `sd-tonejs-midi`: Internal vendor handles loaded by the audio engine only when needed.

7.2 Opting In (App/Widget Side)
A widget or app must explicitly declare the shared audio wrapper in its `assets()` method to use the audio stack.

```php
public static function assets(): array
{
    return [
        'js' => [
            'sd-audio-engine',
            'app.js', // your local app logic
        ],
    ];
}
```

7.3 Instantiation
The app must read the shared runtime object from the global scope:

```js
const audio = window.SystemDeckAudio;
if (audio) {
    const state = audio.getState?.();
}
```

7.4 Mandatory User Gesture
Browsers block Web Audio until a real user gesture occurs. Apps must call `resume()` from a click, tap, or play button before attempting to play music or effects. This gesture is also the correct point for the runtime to lazy-load Tone.js-backed audio libraries.

```js
button.addEventListener("click", async () => {
    await audio.resume?.();
    audio.playFx?.("confirm");
});
```

⸻

END OF CONTRACT
