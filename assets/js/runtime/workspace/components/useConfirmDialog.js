import { useState } from "@wordpress/element"
import { Modal } from "@wordpress/components"
import { __ } from "@wordpress/i18n"

export default function useConfirmDialog() {
	const [dialog, setDialog] = useState(null)

	const closeDialog = () => setDialog(null)

	const requestConfirm = ({
		title,
		message,
		confirmLabel,
		cancelLabel,
		onConfirm,
	}) => {
		const canRenderModal =
			typeof window !== "undefined" && !!window.wp?.components?.Modal

		if (!canRenderModal) {
			const ok = window.confirm(message)
			if (ok && typeof onConfirm === "function") {
				onConfirm()
			}
			return
		}

		setDialog({
			title: title || __("Confirm Action", "systemdeck"),
			message: message || "",
			confirmLabel: confirmLabel || __("Confirm", "systemdeck"),
			cancelLabel: cancelLabel || __("Cancel", "systemdeck"),
			onConfirm,
		})
	}

	const handleConfirm = () => {
		const callback = dialog?.onConfirm
		closeDialog()
		if (typeof callback === "function") {
			callback()
		}
	}

	const confirmNode = dialog ? (
		<Modal
			title={dialog.title}
			onRequestClose={closeDialog}
			className='sd-confirm-modal'>
			<p>{dialog.message}</p>
			<div className='sd-confirm-modal__footer'>
				<button
					type='button'
					className='button button-secondary'
					onClick={closeDialog}>
					{dialog.cancelLabel}
				</button>
				<button
					type='button'
					className='button button-primary'
					onClick={handleConfirm}>
					{dialog.confirmLabel}
				</button>
			</div>
		</Modal>
	) : null

	return {
		requestConfirm,
		confirmNode,
	}
}
