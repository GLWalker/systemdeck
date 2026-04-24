/**
 * SystemDeck Redux Controls
 * Handles side effects (AJAX persistence) for the Redux store.
 */
import { __ } from "@wordpress/i18n"
import { select } from "@wordpress/data"
import { STORE_NAME } from "./store"

const getAjaxUrl = () =>
	window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
	window.sd_vars?.ajaxurl ||
	"/wp-admin/admin-ajax.php"

const getNonce = () =>
	window.SYSTEMDECK_BOOTSTRAP?.config?.nonce || window.sd_vars?.nonce || ""

const controls = {
	PERSIST_WORKSPACE_ADD(action) {
		const { title } = action.payload
		if (typeof title !== "string") {
			console.error("SystemDeck: Invalid title for addWorkspace", title)
			return Promise.reject("Invalid title")
		}
		const formData = new FormData()
		formData.append("action", "sd_create_workspace")
		formData.append("name", title)
		formData.append("nonce", getNonce())

		return fetch(getAjaxUrl(), { method: "POST", body: formData }).then(
			(res) => res.json(),
		)
	},

	PERSIST_WORKSPACE_REMOVE(action) {
		const workspaceId = action.payload
		const formData = new FormData()
		formData.append("action", "sd_delete_workspace")
		formData.append("workspace_id", workspaceId)
		formData.append("nonce", getNonce())

		return fetch(getAjaxUrl(), { method: "POST", body: formData }).then(
			(res) => res.json(),
		)
	},

	PERSIST_WORKSPACE_RENAME(action) {
		const { id, title } = action.payload
		const formData = new FormData()
		formData.append("action", "sd_rename_workspace")
		formData.append("workspace_id", id)
		formData.append("name", title)
		formData.append("nonce", getNonce())

		return fetch(getAjaxUrl(), { method: "POST", body: formData }).then(
			(res) => res.json(),
		)
	},

	PERSIST_WORKSPACE_REORDER(action) {
		const workspaces = action.payload // Array of IDs or objects
		const ids = workspaces.map((w) => (typeof w === "string" ? w : w.id))

		const formData = new FormData()
		formData.append("action", "sd_reorder_workspaces")
		formData.append("order", JSON.stringify(ids))
		formData.append("nonce", getNonce())

		return fetch(getAjaxUrl(), { method: "POST", body: formData }).then(
			(res) => res.json(),
		)
	},

	PERSIST_LAYOUT(action) {
		const { layoutId, items } = action.payload
		const store = select(STORE_NAME)
		const registryEnablement = store?.getRegistryEnablement
			? store.getRegistryEnablement()
			: []
		const formData = new FormData()
		formData.append("action", "sd_persist_workspace_state")
		formData.append("workspace_id", layoutId)
		formData.append("layout", JSON.stringify(items))
		formData.append(
			"registry_enablement",
			JSON.stringify(registryEnablement),
		)
		formData.append("nonce", getNonce())

		const url = getAjaxUrl()

		return fetch(url, { method: "POST", body: formData })
			.then((res) => res.json())
			.catch((err) => {
				console.error("SystemDeck: Layout persistence failed", err)
				throw err
			})
	},
}

export default controls
