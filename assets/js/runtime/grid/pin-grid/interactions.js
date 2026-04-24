export const handlePinDragStart = (
	event,
	pinId,
	{ setDraggingPinId, setPinDropTargetId } = {},
) => {
	if (!pinId) return
	event?.stopPropagation?.()
	setDraggingPinId?.(pinId)
	setPinDropTargetId?.(pinId)
	if (event?.dataTransfer) {
		event.dataTransfer.effectAllowed = "move"
		event.dataTransfer.setData("text/plain", pinId)
		// Mark as internal to prevent global drop overlays.
		event.dataTransfer.setData("application/systemdeck-pin", pinId)
	}
}

export const handlePinDragEnter = (
	event,
	pinId,
	{ draggingPinId, setPinDropTargetId } = {},
) => {
	if (!draggingPinId || !pinId || pinId === draggingPinId) return
	event?.preventDefault?.()
	setPinDropTargetId?.(pinId)
}

export const handlePinDragOver = (event) => {
	event?.preventDefault?.()
	if (event?.dataTransfer) {
		event.dataTransfer.dropEffect = "move"
	}
}

export const handlePinDrop = (
	event,
	pinId,
	{ draggingPinId, reorderPins, setDraggingPinId, setPinDropTargetId } = {},
) => {
	event?.preventDefault?.()
	const sourcePinId = event?.dataTransfer?.getData("text/plain") || draggingPinId
	if (sourcePinId && pinId) {
		reorderPins?.(sourcePinId, pinId)
	}
	setDraggingPinId?.("")
	setPinDropTargetId?.("")
}

export const handlePinDragEnd = ({ setDraggingPinId, setPinDropTargetId } = {}) => {
	setDraggingPinId?.("")
	setPinDropTargetId?.("")
}

export const handlePinHandleKeyDown = (
	event,
	pinId,
	{ movePinByOffset } = {},
) => {
	if (event?.key === "ArrowLeft" || event?.key === "ArrowUp") {
		event.preventDefault()
		movePinByOffset?.(pinId, -1)
		return
	}
	if (event?.key === "ArrowRight" || event?.key === "ArrowDown") {
		event.preventDefault()
		movePinByOffset?.(pinId, 1)
	}
}
