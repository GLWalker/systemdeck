/**
 * SystemDeck Audio Identity Stub
 *
 * Runtime-only normalization helpers for future persistence/track_hash work.
 * No storage, REST, or DB behavior in this phase.
 *
 * @package SystemDeck
 */

;(function () {
	"use strict"

	/**
	 * Track identity must not depend only on WordPress attachment IDs.
	 * Future sources include Vault assets, imports, and external media.
	 */
	const KNOWN_EXTENSIONS = new Set([
		"mp3",
		"wav",
		"flac",
		"mid",
		"midi",
		"ogg",
		"m4a",
		"aac",
		"opus",
	])

	const normalizeFilename = (value) => {
		return String(value || "")
			.trim()
			.replace(/\\/g, "/")
			.split("/")
			.pop()
			.trim()
	}

	const normalizeExtension = (value) => {
		const raw = String(value || "").trim().toLowerCase().replace(/^\./, "")
		if (!raw) return ""
		if (raw === "midi") return "mid"
		return raw
	}

	const normalizeSource = (input) => {
		const raw = String(input || "").trim()
		if (!raw) return ""
		const withoutHash = raw.split("#")[0]
		const [path, query = ""] = withoutHash.split("?")
		if (!query) return path
		const params = new URLSearchParams(query)
		params.sort()
		const normalizedQuery = params.toString()
		return normalizedQuery ? `${path}?${normalizedQuery}` : path
	}

	const deriveFilename = (track = {}, normalizedSource = "") => {
		const explicit =
			track.filename ||
			track.fileName ||
			track.name ||
			track.basename ||
			""
		const fromExplicit = normalizeFilename(explicit)
		if (fromExplicit) return fromExplicit
		return normalizeFilename(normalizedSource)
	}

	const deriveExtension = (track = {}, filename = "", normalizedSource = "") => {
		const explicit =
			normalizeExtension(track.extension) ||
			normalizeExtension(track.ext) ||
			normalizeExtension(track.file_type)
		if (explicit && KNOWN_EXTENSIONS.has(explicit)) return explicit
		const sourceForExt = filename || normalizeFilename(normalizedSource)
		const dot = sourceForExt.lastIndexOf(".")
		if (dot <= 0 || dot === sourceForExt.length - 1) return ""
		const parsed = normalizeExtension(sourceForExt.slice(dot + 1))
		return KNOWN_EXTENSIONS.has(parsed) ? parsed : parsed
	}

	const getExplicitTrackHash = (track = {}) => {
		const candidates = [track.track_hash, track.trackHash, track.hash]
		for (const value of candidates) {
			const v = String(value || "").trim().toLowerCase()
			if (/^[a-f0-9]{64}$/.test(v)) return v
		}
		return ""
	}

	const getStableId = (track = {}) => {
		const candidates = [
			track.vault_id,
			track.vaultId,
			track.attachmentId,
			track.attachment_id,
			track.attachment?.id,
			track.id,
		]
		for (const value of candidates) {
			const v = String(value ?? "").trim()
			if (/^\d+$/.test(v)) return v
		}
		return ""
	}

	const getVaultStreamIdFromSource = (value) => {
		const raw = String(value || "").trim()
		if (!raw) return ""
		try {
			const url = raw.includes("://")
				? new URL(raw)
				: new URL(raw, window.location?.origin || "http://localhost")
			const v = String(url.searchParams.get("sd_vault_stream") || "").trim()
			if (/^\d+$/.test(v)) return v
		} catch (_e) {
			const match = raw.match(/[?&]sd_vault_stream=(\d+)/i)
			if (match && match[1]) return String(match[1])
		}
		return ""
	}

	const getIdentityInput = (track = {}) => {
		const source = normalizeSource(
			track.source || track.url || track.src || track.stream_url || "",
		)
		const filename = deriveFilename(track, source)
		const extension = deriveExtension(track, filename, source)
		const attachmentId =
			track.attachmentId ??
			track.attachment_id ??
			track.attachment?.id ??
			null
		return {
			id: track.id ?? null,
			attachmentId,
			url: normalizeSource(track.url || ""),
			filename,
			extension,
			title: String(track.title || track.name || "").trim(),
			source,
			origin: String(track.origin || "").toLowerCase(),
			type: String(track.type || "").toLowerCase(),
		}
	}

	const getTrackHashInput = (track = {}) => {
		const identity = getIdentityInput(track)
		const explicitHash = getExplicitTrackHash(track)
		if (explicitHash) {
			return { identity: "explicit-track-hash", track_hash: explicitHash }
		}

		const stableId = getStableId(track)
		if (stableId) {
			return { identity: "stable-id", id: stableId }
		}

		const vaultStreamId =
			getVaultStreamIdFromSource(identity.source) ||
			getVaultStreamIdFromSource(identity.url) ||
			getVaultStreamIdFromSource(track.source) ||
			getVaultStreamIdFromSource(track.url)
		if (vaultStreamId) {
			return { identity: "vault-stream", value: `vault-stream:${vaultStreamId}` }
		}

		// Stable fallback only when no explicit/stable source identity exists.
		return {
			identity: "source-fallback",
			source: identity.source,
			filename: identity.filename,
			extension: identity.extension,
			origin: identity.origin,
			type: identity.type,
		}
	}

	window.SystemDeckAudioIdentity = window.SystemDeckAudioIdentity || {
		normalizeSource,
		normalizeFilename,
		normalizeExtension,
		getIdentityInput,
		getTrackHashInput,
	}
})()
