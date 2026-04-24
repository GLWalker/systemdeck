import { resolveWidgetSpanForMode } from "./runtime"

export const persistCanonicalLayout = ({
	nextCanonicalLayout,
	setLayoutItems,
	persistLayout,
	activeId,
	useCanonicalLayoutEngine,
}) => {
	if (!setLayoutItems || !activeId || !useCanonicalLayoutEngine) return
	setLayoutItems(activeId, nextCanonicalLayout)
	if (persistLayout) {
		persistLayout(activeId, nextCanonicalLayout)
	}
}

export const persistBlockWidgetWidth = ({
	target,
	normalizedBaseSpan,
	gridCols,
	activeId,
	ajaxUrl,
	nonce,
}) => {
	if (target?.type !== "block_widget_placeholder") return
	if (!ajaxUrl || !nonce) return

	const formData = new FormData()
	formData.append("action", "sd_set_widget_block_width")
	formData.append("workspace_id", activeId || "")
	formData.append("item_id", target.i)
	formData.append(
		"column_span",
		String(resolveWidgetSpanForMode(normalizedBaseSpan, gridCols)),
	)
	formData.append("nonce", nonce)
	fetch(ajaxUrl, { method: "POST", body: formData }).catch(() => {})
}
