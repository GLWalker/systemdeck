import { normalizePin } from "./runtime"

export const persistPins = ({
	nextPins,
	activeId,
	getAjaxUrl,
	getNonce,
}) => {
	const normalizedPins = (Array.isArray(nextPins) ? nextPins : []).map((pin, index) =>
		normalizePin(pin, index),
	)

	document.dispatchEvent(
		new CustomEvent("systemdeck:pins-updated", {
			detail: {
				workspaceId: activeId || "default",
				pins: normalizedPins,
			},
		}),
	)

	const formData = new FormData()
	formData.append("action", "sd_save_workspace_pins")
	formData.append("workspace_id", activeId || "")
	formData.append("pins", JSON.stringify(normalizedPins))
	formData.append("nonce", getNonce())
	fetch(getAjaxUrl(), { method: "POST", body: formData }).catch(() => {})
}

export const removePinWithAnimation = ({
	pinId,
	removingPinIds,
	setRemovingPinIds,
	setPinsState,
	persistPins,
	animationMs = 140,
}) => {
	if (!pinId || removingPinIds[pinId]) return
	setRemovingPinIds((prev) => ({ ...prev, [pinId]: true }))

	window.setTimeout(() => {
		setPinsState((currentPins) => {
			const nextPins = currentPins.filter((pin) => pin?.id !== pinId)
			queueMicrotask(() => persistPins(nextPins))
			return nextPins
		})
		setRemovingPinIds((prev) => {
			const next = { ...prev }
			delete next[pinId]
			return next
		})
	}, animationMs)
}
