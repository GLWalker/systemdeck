# SystemDeck Current State

This document contains fast-changing facts about the SystemDeck architecture. Refer to this file for the most up-to-date information regarding assets, event contracts, and ownership models.

## 1. Asset Handle Mapping

*   `sd-player-app` → `assets/js/sd-player-app.js`
*   `sd-player-style` → `assets/css/systemdeck-player.css`
*   `sd-audio-engine` depends on Tone (vendor)

## 2. Modal Player User Preferences

The SystemDeck player mounts in modals strictly based on two user preference toggles. 

*   **UI Location:** System Configuration → Tools tab → Master Volume
*   **Keys:**
    *   `sd_advanced_audio_media_modal`
    *   `sd_advanced_audio_vault_modal`

**Rule:** These toggles are the **sole controller** of whether the SD player mounts in modals.

## 3. Event Contracts

*   `systemdeck:player-modal-mount`
*   `systemdeck:player-modal-unmount`

## 4. Known Stabilization Patch

*   Media Library modal URL sanitizer for doubled-origin (`origin/origin/...`) uses `history.replaceState`.

## 5. Vault Artwork Ownership Model

*   Vault-owned artwork is stored as a Vault-managed file (not a WP attachment) for direct Vault uploads.
*   Streams via `?sd_vault_stream={id}&artwork=1`
*   Vault→Media does not inject artwork; WP derives its own.

## 6. Deprecated/Removed

*   `widgets/player/app.js` removed
*   `widgets/player/style.css` removed
*   `openNativeMediaModal(file)` removed (dead path)
