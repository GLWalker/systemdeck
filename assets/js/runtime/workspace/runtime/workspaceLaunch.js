import { dispatch } from "@wordpress/data"
import { STORE_NAME } from "../state/store"

export function openWorkspaceViaSystemDeck(workspaceId) {
	const targetWorkspaceId = String(workspaceId || "").trim()
	if (!targetWorkspaceId) {
		return false
	}

	dispatch(STORE_NAME).setUIMode("runtime")
	dispatch(STORE_NAME).setActiveWorkspace(targetWorkspaceId)
	return true
}
