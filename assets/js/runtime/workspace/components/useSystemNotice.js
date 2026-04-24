export default function useSystemNotice() {
	const pushNotice = (status, message) => {
		const notices = window.wp?.data?.dispatch("core/notices")
		if (notices?.createNotice) {
			notices.createNotice(status, message, {
				type: "snackbar",
				isDismissible: true,
			})
			return
		}
		console.log(`[${status}] ${message}`)
	}

	return { pushNotice }
}
