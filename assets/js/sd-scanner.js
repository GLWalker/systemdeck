/**
 * SystemDeck Widget Scanner
 *
 * Handles "Deep Scanning" of the WordPress Dashboard via an invisible iframe.
 * Scrapes .postbox elements to discover available dashboard widgets.
 */
jQuery(document).ready(function ($) {
	var $startBtn = $("#sd-start-scan")
	var $frameWrap = $("#sd-scanner-frame-wrap")
	var $results = $("#sd-scan-results")
	var $list = $("#sd-scan-list")
	var $spinner = $(".sd-scanner-controls .spinner")

	/**
	 * Get the canonical nonce from the Authority Contract.
	 * Falls back to sdScannerVars (wp_localize_script) if SystemDeckSecurity is not available.
	 */
	function getNonce() {
		return (
			window.SystemDeckSecurity?.nonce ||
			window.sd_vars?.nonce ||
			window.sdScannerVars?.nonce ||
			""
		)
	}

	/**
	 * Get the AJAX URL.
	 */
	function getAjaxUrl() {
		return (
			window.SystemDeckSecurity?.ajaxurl ||
			window.sd_vars?.ajaxurl ||
			window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl ||
			window.ajaxurl ||
			"/wp-admin/admin-ajax.php"
		)
	}

	/**
	 * Clean and format widget titles (ported from v21 sd-scanner.js).
	 */
	function cleanWidgetTitle(title, widgetId) {
		if (!title) return widgetId

		// Remove common noise words
		title = title
			.replace(
				/Actions|Move up|Move down|Toggle panel|Configure|Settings/gi,
				"",
			)
			.trim()

		// Remove duplicate words
		var words = title.split(/\s+/)
		var uniqueWords = []
		words.forEach(function (word) {
			if (uniqueWords.indexOf(word) === -1) {
				uniqueWords.push(word)
			}
		})
		title = uniqueWords.join(" ")

		// Handle common plugin prefixes
		title = title.replace(
			/^(AIOSEO|Yoast|WooCommerce|Jetpack)\s+/i,
			"$1 - ",
		)

		// If title is still just the ID, format it nicely
		if (title === widgetId || title.length < 3) {
			title = widgetId
				.replace(/wpseo-|aioseo-|dashboard_|wc-/gi, "")
				.replace(/[-_]/g, " ")
				.replace(/\b\w/g, function (l) {
					return l.toUpperCase()
				})
				.trim()
		}

		title = title.replace(/\s+/g, " ").trim()
		return title || widgetId
	}

	// =============================================
	//  DEEP SCAN TRIGGER (Headless RC Implementation)
	// =============================================
	$startBtn.on("click", function () {
		$spinner.addClass("is-active")
		$startBtn.prop("disabled", true)
		$results.hide()
		$list.empty()

		console.log("[SD Scanner] Initiating headless server-side discovery...")

		// Directly trigger the server-side snapshot rebuild
		$.post(
			getAjaxUrl(),
			{
				action: "sd_rebuild_registry_snapshot",
				nonce: getNonce(),
			},
			function (res) {
				if (res.success) {
					// Fetch discovered widgets from the new snapshot
					$.post(
						getAjaxUrl(),
						{
							action: "sd_get_discovered_widgets",
							nonce: getNonce(),
						},
						function (dRes) {
							if (dRes.success) {
								renderResults(dRes.data.widgets || [])
							} else {
								$list.html(
									'<p style="color:#d63638;">Failed to fetch discovered widgets.</p>',
								)
							}
						},
					).always(function () {
						$spinner.removeClass("is-active")
						$startBtn.prop("disabled", false)
					})
				} else {
					$spinner.removeClass("is-active")
					$startBtn.prop("disabled", false)
					$list.html(
						'<p style="color:#d63638;">Server-side scan failed: ' +
							(res.data?.message || "Unknown error") +
							"</p>",
					)
					$results.show()
				}
			},
		).fail(function () {
			$spinner.removeClass("is-active")
			$startBtn.prop("disabled", false)
			alert("Request failed. Check your connection or permissions.")
		})
	})

	// =============================================
	//  RENDER SCAN RESULTS
	// =============================================
	function renderResults(widgets) {
		$list.empty()
		$results.show()

		if (widgets.length === 0) {
			$list.html("<p>No widgets found. The dashboard may be empty.</p>")
			return
		}

		widgets.forEach(function (w) {
			var html =
				'<label class="sd-widget-option">' +
				'<input type="checkbox" name="widgets[]" value="' +
				w.id +
				'" checked> ' +
				'<span class="widget-name" style="font-weight:bold;">' +
				w.title +
				"</span> " +
				'<span class="widget-id" style="color:#888; font-size:11px;">(' +
				w.id +
				")</span>" +
				"</label>"
			$list.append(html)
		})

		console.log(
			"SystemDeck Scanner: Found " + widgets.length + " widget(s).",
		)
	}

	// =============================================
	//  SAVE SELECTION
	// =============================================
	$("#sd-scan-form").on("submit", function (e) {
		e.preventDefault()

		var selected = []
		$list.find('input[name="widgets[]"]:checked').each(function () {
			var $label = $(this).closest("label")
			var id = $(this).val()
			var title = $label.find(".widget-name").text().trim()
			selected.push({ id: id, title: title })
		})

		$.post(
			getAjaxUrl(),
			{
				action: "sd_save_widget_selection",
				nonce: getNonce(),
				widgets: selected,
			},
			function (res) {
				if (res.success) {
					alert(
						"Saved " +
							(res.data.count || selected.length) +
							" widget(s) successfully!",
					)
					// Trigger Snapshot Rebuild (Ironclad RC Pipeline)
					$.post(getAjaxUrl(), {
						action: "sd_rebuild_registry_snapshot",
						nonce: getNonce(),
					})
				} else {
					alert(
						"Error: " +
							(res.data && res.data.message
								? res.data.message
								: "Unknown error"),
					)
				}
			},
		).fail(function () {
			alert("Request failed. Check your connection.")
		})
	})
})
