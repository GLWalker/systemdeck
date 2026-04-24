import {
	WIDGET_GRID_DESKTOP_UNITS,
	coerceSpan,
	resolveWidgetSpanForMode,
} from "./runtime"

const intersects = (a, b) =>
	a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const getWidgetRuntimeShape = ({
	item,
	gridCols,
	measuredRows,
	collapseState,
	getCollapseKey,
	getCollapsedRowSpan,
	clampRowSpan,
	defaultRowSpan,
}) => {
	const desktopBaseSpan = coerceSpan(item?.w, WIDGET_GRID_DESKTOP_UNITS)
	const colSpan = Math.min(resolveWidgetSpanForMode(desktopBaseSpan, gridCols), gridCols)
	const collapseKey = typeof getCollapseKey === "function" ? getCollapseKey(item) : ""
	const isCollapsed = !!(collapseState && collapseState[collapseKey]?.collapsed)
	const measuredSpan = Number(measuredRows?.[item?.i] || 0)
	const rowSpan = isCollapsed
		? getCollapsedRowSpan()
		: clampRowSpan(measuredSpan || item?.h || defaultRowSpan)
	return { colSpan, rowSpan, desktopBaseSpan }
}

export const resolveWidgetDropPosition = ({
	movingItem,
	desiredX,
	desiredY,
	gridCols,
	runtimeLayoutItems,
	defaultRowSpan,
	resolveShape,
}) => {
	const movingShape = resolveShape(movingItem)
	const maxX = Math.max(0, gridCols - movingShape.colSpan)
	let x = Math.max(0, Math.min(maxX, desiredX))
	let y = Math.max(0, desiredY)

	const others = (Array.isArray(runtimeLayoutItems) ? runtimeLayoutItems : [])
		.filter((item) => item.i !== movingItem.i)
		.map((item) => {
			const ox = Math.max(0, Math.min(Math.max(0, gridCols - Number(item.w || 1)), Number(item.x) || 0))
			const oy = Math.max(0, Number(item.y) || 0)
			return { x: ox, y: oy, w: Number(item.w || 1), h: Number(item.h || defaultRowSpan) }
		})

	let safety = 0
	while (safety < 500) {
		const probe = { x, y, w: movingShape.colSpan, h: movingShape.rowSpan }
		const collision = others.find((other) => intersects(probe, other))
		if (!collision) break
		y = collision.y + collision.h
		safety += 1
	}

	return { x, y }
}

export const resolveDesiredGridPoint = ({ event, gridNode, gridCols, gridGap, rowUnit }) => {
	if (!gridNode) {
		return { x: 0, y: 0 }
	}
	const rect = gridNode.getBoundingClientRect()
	const pointerX = event.clientX - rect.left
	const pointerY = event.clientY - rect.top
	const colUnit = Math.max(1, (rect.width - (gridCols - 1) * gridGap) / Math.max(1, gridCols))
	const colStep = colUnit + gridGap
	const rowStep = rowUnit + gridGap
	const x = Math.max(0, Math.floor(pointerX / colStep))
	const y = Math.max(0, Math.floor(pointerY / rowStep))
	return { x, y }
}

export const handleWidgetDragStartRuntime = (
	event,
	item,
	{ dragItemRef, dragNodeRef, setDragging } = {},
) => {
	if (!item) return
	dragItemRef.current = item
	dragNodeRef.current = event?.target || null
	if (event?.dataTransfer) {
		event.dataTransfer.effectAllowed = "move"
		event.dataTransfer.setData("application/systemdeck-widget", item.i)
	}
	window.setTimeout(() => setDragging?.(true), 0)
}

export const handleWidgetDragEnterRuntime = (
	event,
	targetItem,
	{ dragItemRef, setDragTargetId, resolveDropPosition, setWidgetDropPreview } = {},
) => {
	event?.preventDefault?.()
	const currentItem = dragItemRef.current
	if (!currentItem || currentItem.i === targetItem?.i) return
	setDragTargetId?.(targetItem.i || "")
	const desiredX = Number.isFinite(Number(targetItem?.x)) ? Number(targetItem.x) : 0
	const desiredY = Number.isFinite(Number(targetItem?.y)) ? Number(targetItem.y) : 0
	const resolved = resolveDropPosition(currentItem, desiredX, desiredY)
	setWidgetDropPreview?.({
		id: currentItem.i,
		x: resolved.x,
		y: resolved.y,
	})
}

export const handleWidgetDragEndRuntime = ({
	dragItemRef,
	widgetDropPreview,
	commitWidgetDrop,
	setDragging,
	setDragTargetId,
	setWidgetDropPreview,
	dragNodeRef,
} = {}) => {
	if (dragItemRef.current?.i && widgetDropPreview?.id === dragItemRef.current.i) {
		commitWidgetDrop?.(dragItemRef.current, widgetDropPreview.x, widgetDropPreview.y)
	}
	setDragging?.(false)
	setDragTargetId?.("")
	setWidgetDropPreview?.(null)
	dragItemRef.current = null
	dragNodeRef.current = null
}

export const handleWidgetGridDragOverRuntime = (
	event,
	{
		dragging,
		dragItemRef,
		widgetGridRef,
		gridCols,
		gridGap,
		rowUnit,
		resolveDropPosition,
		setWidgetDropPreview,
	} = {},
) => {
	if (!dragging || !dragItemRef.current) return
	event?.preventDefault?.()
	if (event?.dataTransfer) {
		event.dataTransfer.dropEffect = "move"
	}
	const gridNode = widgetGridRef.current
	if (!gridNode) return
	const desiredPoint = resolveDesiredGridPoint({
		event,
		gridNode,
		gridCols,
		gridGap,
		rowUnit,
	})
	const resolved = resolveDropPosition(dragItemRef.current, desiredPoint.x, desiredPoint.y)
	setWidgetDropPreview?.({
		id: dragItemRef.current.i,
		x: resolved.x,
		y: resolved.y,
	})
}

export const handleWidgetItemDragOverRuntime = (
	event,
	targetItem,
	{
		dragging,
		dragItemRef,
		setDragTargetId,
		resolveDropPosition,
		setWidgetDropPreview,
	} = {},
) => {
	if (!dragging || !dragItemRef.current || !targetItem) return
	event?.preventDefault?.()
	if (event?.dataTransfer) {
		event.dataTransfer.dropEffect = "move"
	}
	if (dragItemRef.current.i === targetItem.i) return
	setDragTargetId?.(targetItem.i || "")
	const desiredX = Number.isFinite(Number(targetItem?.x)) ? Number(targetItem.x) : 0
	const desiredY = Number.isFinite(Number(targetItem?.y)) ? Number(targetItem.y) : 0
	const resolved = resolveDropPosition(dragItemRef.current, desiredX, desiredY)
	setWidgetDropPreview?.({
		id: dragItemRef.current.i,
		x: resolved.x,
		y: resolved.y,
	})
}

export const handleWidgetGridDropRuntime = (event, { dragging, dragItemRef, widgetDropPreview, handleDragEnd } = {}) => {
	if (!dragging || !dragItemRef.current || !widgetDropPreview) return
	event?.preventDefault?.()
	handleDragEnd?.()
}

export const handleWidgetItemDropRuntime = (
	event,
	targetItem,
	{
		dragging,
		dragItemRef,
		widgetDropPreview,
		commitWidgetDrop,
		setDragging,
		setDragTargetId,
		setWidgetDropPreview,
		dragNodeRef,
	} = {},
) => {
	if (!dragging || !dragItemRef.current) return
	event?.preventDefault?.()
	const desiredX =
		widgetDropPreview?.id === dragItemRef.current.i
			? Number(widgetDropPreview.x) || 0
			: Number.isFinite(Number(targetItem?.x))
				? Number(targetItem.x)
				: 0
	const desiredY =
		widgetDropPreview?.id === dragItemRef.current.i
			? Number(widgetDropPreview.y) || 0
			: Number.isFinite(Number(targetItem?.y))
				? Number(targetItem.y)
				: 0
	commitWidgetDrop?.(dragItemRef.current, desiredX, desiredY)
	setDragging?.(false)
	setDragTargetId?.("")
	setWidgetDropPreview?.(null)
	dragItemRef.current = null
	dragNodeRef.current = null
}
