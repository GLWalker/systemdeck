import {
	getWidgetRuntimeShape,
	resolveWidgetDropPosition,
} from "./interactions"
import {
	WIDGET_GRID_DESKTOP_UNITS,
	coerceSpan,
	computeRuntimeLayout,
	mergeCanonicalWithRuntimeCoords,
} from "./runtime"

const sortCanonicalForPacking = (items) =>
	(Array.isArray(items) ? [...items] : []).sort((a, b) => {
		const ay = Number(a?.y) || 0
		const by = Number(b?.y) || 0
		if (ay !== by) return ay - by
		const ax = Number(a?.x) || 0
		const bx = Number(b?.x) || 0
		if (ax !== bx) return ax - bx
		return String(a?.i || "").localeCompare(String(b?.i || ""))
	})

export const createResolveDropPosition = ({
	gridCols,
	runtimeLayoutRef,
	measuredRows,
	workspaceCollapseState,
	getWidgetUiKeyForItem,
	getCollapsedRowSpan,
	clampRowSpan,
	defaultRowSpan,
}) => {
	return (movingItem, desiredX, desiredY) => {
		return resolveWidgetDropPosition({
			movingItem,
			desiredX,
			desiredY,
			gridCols,
			runtimeLayoutItems: runtimeLayoutRef.current,
			defaultRowSpan,
			resolveShape: (item) =>
				getWidgetRuntimeShape({
					item,
					gridCols,
					measuredRows,
					collapseState: workspaceCollapseState,
					getCollapseKey: getWidgetUiKeyForItem,
					getCollapsedRowSpan,
					clampRowSpan,
					defaultRowSpan,
				}),
		})
	}
}

export const commitWidgetDrop = ({
	sourceItem,
	targetX,
	targetY,
	widgetDropPreview,
	resolveDropPosition,
	canonicalLayoutRef,
	gridCols,
	measuredRows,
	workspaceCollapseState,
	setCanonicalLayout,
	persistWidgetPositionState,
	persistCanonicalLayout,
}) => {
	if (!sourceItem?.i) return
	const movingId = sourceItem.i
	const fallbackResolved = resolveDropPosition(sourceItem, targetX, targetY)
	const finalX =
		widgetDropPreview?.id === movingId ? widgetDropPreview.x : fallbackResolved.x
	const finalY =
		widgetDropPreview?.id === movingId ? widgetDropPreview.y : fallbackResolved.y

	const movedCanonicalLayout = canonicalLayoutRef.current.map((item) =>
		item.i === movingId
			? {
					...item,
					x: finalX,
					y: finalY,
			  }
			: item,
	)
	const sortedCanonicalLayout = sortCanonicalForPacking(movedCanonicalLayout)
	const recalculatedRuntime = computeRuntimeLayout({
		items: sortedCanonicalLayout,
		gridCols,
		measuredRows,
		collapsedMap: workspaceCollapseState,
	})
	const nextCanonicalLayout = mergeCanonicalWithRuntimeCoords(
		sortedCanonicalLayout,
		recalculatedRuntime,
	)
	setCanonicalLayout(nextCanonicalLayout)
	canonicalLayoutRef.current = nextCanonicalLayout
	persistWidgetPositionState(nextCanonicalLayout)
	persistCanonicalLayout(nextCanonicalLayout)
}

export const applyWidgetSpanChange = ({
	widgetId,
	newSpan,
	canonicalLayoutRef,
	gridCols,
	measuredRows,
	workspaceCollapseState,
	setCanonicalLayout,
	persistWidgetPositionState,
	persistCanonicalLayout,
}) => {
	const normalizedBaseSpan = coerceSpan(newSpan, WIDGET_GRID_DESKTOP_UNITS)
	const resizedCanonicalLayout = canonicalLayoutRef.current.map((item) =>
		item.i === widgetId ? { ...item, w: normalizedBaseSpan } : item,
	)
	const sortedCanonicalLayout = sortCanonicalForPacking(resizedCanonicalLayout)
	const recalculatedRuntime = computeRuntimeLayout({
		items: sortedCanonicalLayout,
		gridCols,
		measuredRows,
		collapsedMap: workspaceCollapseState,
	})
	const nextCanonicalLayout = mergeCanonicalWithRuntimeCoords(
		sortedCanonicalLayout,
		recalculatedRuntime,
	)
	setCanonicalLayout(nextCanonicalLayout)
	canonicalLayoutRef.current = nextCanonicalLayout
	persistWidgetPositionState(nextCanonicalLayout)
	persistCanonicalLayout(nextCanonicalLayout)
	return { normalizedBaseSpan, nextCanonicalLayout }
}
