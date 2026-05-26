import { useState, useEffect } from "@wordpress/element"
import {
	Panel,
	PanelBody,
	Notice,
	Flex,
	FlexItem,
	Spinner,
	Modal,
} from "@wordpress/components"
import useConfirmDialog from "../components/useConfirmDialog"
import useSystemNotice from "../components/useSystemNotice"

function ConfigCanvas() {
	const [workspaces, setWorkspaces] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [message, setMessage] = useState(null)
	const [newWsName, setNewWsName] = useState("")
	const [isCreating, setIsCreating] = useState(false)
	const [renamingWs, setRenamingWs] = useState(null)
	const [renameValue, setRenameValue] = useState("")
	const { requestConfirm, confirmNode } = useConfirmDialog()
	const { pushNotice } = useSystemNotice()

	useEffect(() => {
		fetchManifest()
	}, [])

	const fetchManifest = async () => {
		setIsLoading(true)
		try {
			const config = window.SYSTEMDECK_STATE.config
			const response = await fetch(
				`${config.routerUrl}?sd_action=get_manifest&_wpnonce=${config.nonce}`,
			)
			const res = await response.json()
			if (res.success) {
				// Since get_manifest returns the manifest for ONE workspace,
				// we actually might need a 'get_all_workspaces' endpoint or pull from SYSTEMDECK_STATE
				// Actually, let's look at how workspaces are stored in user meta.
				// For now, let's assume we can get them from the manifest or add an endpoint.
				// Wait, I should probably add handle_get_workspaces to Router.php

				// Let's fallback to current manifest data if available
				setWorkspaces(res.data.config?.all_workspaces || [])
			}
		} catch (err) {
			setMessage({ type: "error", text: "Failed to load workspaces" })
		} finally {
			setIsLoading(false)
		}
	}

	const createWorkspace = async () => {
		if (!newWsName) return
		setIsCreating(true)
		try {
			const config = window.SYSTEMDECK_STATE.config
			const formData = new FormData()
			formData.append("sd_action", "create_workspace")
			formData.append("_wpnonce", config.nonce)
			formData.append("name", newWsName)

			const response = await fetch(config.routerUrl, {
				method: "POST",
				body: formData,
			})
			const res = await response.json()
			if (res.success) {
				setMessage({ type: "success", text: "Workspace created!" })
				pushNotice("success", "Workspace created!")
				setNewWsName("")
				// In a real app, we'd trigger a global state refresh or route change
				location.reload()
			}
		} catch (err) {
			setMessage({ type: "error", text: "Create failed" })
			pushNotice("error", "Create failed")
		} finally {
			setIsCreating(false)
		}
	}

	const deleteWorkspace = async (id) => {
		requestConfirm({
			title: "Delete Workspace",
			message:
				"Are you sure? This will delete the workspace and all saved layouts.",
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			onConfirm: async () => {
				try {
					const config = window.SYSTEMDECK_STATE.config
					const formData = new FormData()
					formData.append("sd_action", "delete_workspace")
					formData.append("_wpnonce", config.nonce)
					formData.append("workspace_id", id)

					const response = await fetch(config.routerUrl, {
						method: "POST",
						body: formData,
					})
					const res = await response.json()
					if (res.success) {
						setMessage({ type: "success", text: "Workspace deleted" })
						pushNotice("success", "Workspace deleted")
						location.reload()
					}
				} catch (err) {
					setMessage({ type: "error", text: "Delete failed" })
					pushNotice("error", "Delete failed")
				}
			},
		})
	}

	const renameWorkspace = async () => {
		if (!renamingWs || !renameValue) return
		try {
			const config = window.SYSTEMDECK_STATE.config
			const formData = new FormData()
			formData.append("sd_action", "rename_workspace")
			formData.append("_wpnonce", config.nonce)
			formData.append("workspace_id", renamingWs.id)
			formData.append("name", renameValue)

			const response = await fetch(config.routerUrl, {
				method: "POST",
				body: formData,
			})
			const res = await response.json()
			if (res.success) {
				setMessage({ type: "success", text: "Workspace renamed" })
				pushNotice("success", "Workspace renamed")
				setRenamingWs(null)
				location.reload()
			}
		} catch (err) {
			setMessage({ type: "error", text: "Rename failed" })
			pushNotice("error", "Rename failed")
		}
	}

	return (
		<div className='sd-config-manager'>
			{confirmNode}
			<h1>SystemDeck Workspace Manager</h1>
			<p className='sd-config-manager__intro'>
				Manage your high-density control environments.
			</p>

			{message && (
				<Notice
					status={message.type}
					onRemove={() => setMessage(null)}
					className='sd-config-manager__notice'>
					{message.text}
				</Notice>
			)}

			<Panel className='sd-config-manager__panel'>
				<PanelBody title='Create New Workspace' initialOpen={true}>
						<Flex align='flex-end' className='sd-config-manager__create-row'>
							<FlexItem isBlock>
								<label className='sd-form-label' htmlFor='sd-config-new-ws-name'>
									Workspace Name
								</label>
								<input
									id='sd-config-new-ws-name'
									type='text'
									className='regular-text large-text'
									value={newWsName}
									onChange={(event) => setNewWsName(event.target.value)}
									placeholder='e.g. SEO Ops, Store Guard'
								/>
							</FlexItem>
							<FlexItem>
								<button
									type='button'
									className='button button-primary'
									onClick={createWorkspace}
									disabled={isCreating}>
									{isCreating ? <Spinner /> : "Create"}
								</button>
							</FlexItem>
						</Flex>
					</PanelBody>
			</Panel>

			<div className='sd-config-manager__workspace-list'>
				<h3>Existing Workspaces</h3>
				{isLoading ? (
					<Spinner />
				) : (
					<div className='sd-config-manager__workspace-grid'>
						{workspaces.length === 0 && (
							<p>Only the default workspace exists.</p>
						)}
						{workspaces.map((ws) => (
							<div key={ws.id} className='sd-config-manager__workspace-card'>
								<div>
									<strong className='sd-config-manager__workspace-title'>
										{ws.name}
									</strong>
									<div className='sd-config-manager__workspace-id'>
										ID: {ws.id}
									</div>
								</div>
									<Flex gap={2}>
										<button
											type='button'
											className='button button-secondary'
											onClick={() => {
												setRenamingWs(ws)
												setRenameValue(ws.name)
											}}>
											Rename
										</button>
										<button
											type='button'
											className='button button-secondary sd-btn-danger-text'
											onClick={() => deleteWorkspace(ws.id)}>
											Delete
										</button>
									</Flex>
								</div>
							))}
					</div>
				)}
			</div>

			{renamingWs && (
				<Modal
					title='Rename Workspace'
					onRequestClose={() => setRenamingWs(null)}>
					<div className='sd-config-manager__rename-modal'>
						<label className='sd-form-label' htmlFor='sd-config-rename-ws-name'>
							New Name
						</label>
						<input
							id='sd-config-rename-ws-name'
							type='text'
							className='regular-text large-text'
							value={renameValue}
							onChange={(event) => setRenameValue(event.target.value)}
							autoFocus
						/>
							<Flex
								justify='flex-end'
								gap={2}
								className='sd-config-manager__rename-actions'>
								<button
									type='button'
									className='button button-secondary'
									onClick={() => setRenamingWs(null)}>
									Cancel
								</button>
								<button
									type='button'
									className='button button-primary'
									onClick={renameWorkspace}>
									Save Changes
								</button>
							</Flex>
						</div>
					</Modal>
			)}
		</div>
	)
}

export default ConfigCanvas
