import { reorderPinsById, movePinByOffsetInList } from "./runtime"

export const reorderPins = ({ fromPinId, toPinId, setPinsState, persistPins }) => {
	if (!fromPinId || !toPinId || fromPinId === toPinId) return
	setPinsState((currentPins) => {
		const nextPins = reorderPinsById(currentPins, fromPinId, toPinId)
		if (nextPins === currentPins) return currentPins
		queueMicrotask(() => persistPins(nextPins))
		return nextPins
	})
}

export const movePinByOffset = ({ pinId, offset, setPinsState, persistPins }) => {
	if (!pinId || !offset) return
	setPinsState((currentPins) => {
		const nextPins = movePinByOffsetInList(currentPins, pinId, offset)
		if (nextPins === currentPins) return currentPins
		queueMicrotask(() => persistPins(nextPins))
		return nextPins
	})
}
