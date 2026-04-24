(function (wp) {
	if (!wp || !wp.blocks || !wp.element || !wp.components || !wp.i18n || !wp.blockEditor) {
		return;
	}

	var registerBlockType = wp.blocks.registerBlockType;
	var createElement = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var __ = wp.i18n.__;
	var TextControl = wp.components.TextControl;
	var PanelBody = wp.components.PanelBody;
	var RangeControl = wp.components.RangeControl;
	var ToolbarDropdownMenu = wp.components.ToolbarDropdownMenu;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var BlockControls = wp.blockEditor.BlockControls;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var SelectControl = wp.components.SelectControl;
	var data = window.SYSTEMDECK_WIDGET_SLOT_DATA || { postType: "", options: [] };
	var reflowBridgeInstalled = false;

	function applySpanToWrapper(wrapper, columnSpan, rowSpan) {
		if (!wrapper) return;
		wrapper.classList.remove("sd-col-span-1", "sd-col-span-2", "sd-col-span-3", "sd-col-span-4");
		wrapper.classList.add("sd-col-span-" + columnSpan);
		wrapper.style.setProperty("grid-row", "span " + rowSpan, "important");
		wrapper.style.removeProperty("grid-column");
		wrapper.style.removeProperty("grid-area");
	}

	function installWidgetSpanReflowBridge() {
		if (reflowBridgeInstalled || !wp.data || !wp.data.subscribe || !wp.data.select) {
			return;
		}
		reflowBridgeInstalled = true;
		var pending = false;
		var run = function () {
			pending = false;
			var blockEditor = wp.data.select("core/block-editor");
			if (!blockEditor || !blockEditor.getBlock) {
				return;
			}
			var nodes = document.querySelectorAll('.block-editor-block-list__block[data-type="systemdeck/widgets"][data-block]');
			nodes.forEach(function (node) {
				var clientId = node.getAttribute("data-block") || "";
				if (!clientId) return;
				var block = blockEditor.getBlock(clientId);
				var attrs = (block && block.attributes) || {};
				var col = Math.max(1, Math.min(4, parseInt(attrs.columnSpan || 2, 10) || 2));
				var row = Math.max(1, parseInt(attrs.rowSpan || 1, 10) || 1);
				applySpanToWrapper(node, col, row);
			});
		};

		wp.data.subscribe(function () {
			if (pending) return;
			pending = true;
			window.requestAnimationFrame(run);
		});
	}

	function registerWidgetSlot(blockName) {
		installWidgetSpanReflowBridge();
		registerBlockType(blockName, {
		apiVersion: 3,
		title: __("SystemDeck Widgets", "systemdeck"),
		description: __("SystemDeck widget block that resolves to live runtime output.", "systemdeck"),
		icon: "screenoptions",
		category: "widgets",
		parent: ["systemdeck/canvas-grid"],
			attributes: {
				widgetId: { type: "string", default: "" },
				title: { type: "string", default: "" },
				columnSpan: { type: "number", default: 2 },
			},
			supports: {
				html: false,
				align: true,
				spacing: { margin: true, padding: true },
				typography: { fontSize: true, lineHeight: true },
				color: { text: true, background: true, link: true },
			},
				edit: function (props) {
			if (data.postType && wp.data && wp.data.select && wp.data.select("core/editor")) {
				var currentType = wp.data.select("core/editor").getCurrentPostType();
				if (currentType && currentType !== data.postType) {
					return null;
				}
			}
				var attrs = props.attributes || {};
				var widgetId = attrs.widgetId || "";
				var title = attrs.title || "";
				var columnSpan = Math.max(1, Math.min(4, attrs.columnSpan || 2));
				var rowSpan = Math.max(1, attrs.rowSpan || 1);
				var gridX = Math.max(0, attrs.gridX || 0);
				var gridY = Math.max(0, attrs.gridY || 0);
				var spatialSyncRef = useRef(false);
			var options = [{ label: __("Select widget", "systemdeck"), value: "" }].concat(
				(data.options || []).map(function (item) {
					return { label: item.label || item.id, value: item.id };
				})
			);
			var selected = (data.options || []).find(function (item) {
				return item.id === widgetId;
			});
				var displayTitle = title || (selected ? selected.label : (widgetId ? widgetId.replace(/[._-]/g, " ") : __("SystemDeck Widget", "systemdeck")));
				var sourceLabel = selected && selected.originLabel ? selected.originLabel : __("Unknown", "systemdeck");
				var typeLabel = selected && selected.renderLabel ? selected.renderLabel : __("Widget", "systemdeck");
				var widgetIdentifier = widgetId || __("No widget selected", "systemdeck");

				useEffect(function () {
					if (!wp.data || !wp.data.subscribe || !wp.data.select) {
						return;
					}
					var unsubscribe = wp.data.subscribe(function () {
						if (spatialSyncRef.current) {
							return;
						}
						var blockEditor = wp.data.select("core/block-editor");
						if (!blockEditor || !blockEditor.getBlockRootClientId || !blockEditor.getBlockOrder) {
							return;
						}
						var rootId = blockEditor.getBlockRootClientId(props.clientId);
						var order = blockEditor.getBlockOrder(rootId) || [];
						var index = order.indexOf(props.clientId);
						if (index < 0) {
							return;
						}

						var nextGridY = index;
						var nextGridX = 0;
						var el = document.querySelector('[data-block="' + props.clientId + '"]');
						if (el) {
							var style = window.getComputedStyle(el);
							var start = parseInt(style.gridColumnStart || "0", 10);
							if (!Number.isNaN(start) && start > 0) {
								nextGridX = start - 1;
							}
						}

						if (nextGridY !== gridY || nextGridX !== gridX) {
							spatialSyncRef.current = true;
							props.setAttributes({ gridY: nextGridY, gridX: nextGridX });
							window.requestAnimationFrame(function () {
								spatialSyncRef.current = false;
							});
						}
					});
					return function () {
						if (typeof unsubscribe === "function") {
							unsubscribe();
						}
					};
				}, [props.clientId, gridX, gridY]);

				// Gutenberg positions the outer block wrapper in the grid, not the inner edit node.
				// Apply span directly to the wrapper so editor width matches runtime width.
				useEffect(function () {
					// The same data-block id appears in list view and canvas; target only real canvas block wrappers.
					var wrappers = document.querySelectorAll('.block-editor-block-list__block[data-block="' + props.clientId + '"]');
					if (!wrappers || !wrappers.length) {
						return;
					}
					wrappers.forEach(function (wrapper) {
						applySpanToWrapper(wrapper, columnSpan, rowSpan);
					});
				}, [props.clientId, columnSpan, rowSpan]);

				var gridStyle = { gridRow: "span " + rowSpan };
				var blockProps = useBlockProps({
					className: "sd-widget-block-host sd-col-span-" + columnSpan,
					style: gridStyle,
				});

				return createElement(
				"div",
				blockProps,
				createElement(
					BlockControls,
					null,
					createElement(ToolbarDropdownMenu, {
						icon: "leftright",
						label: __("Widget Width", "systemdeck"),
						controls: [
							{ title: "1/4", icon: columnSpan === 1 ? "yes" : null, onClick: function () { props.setAttributes({ columnSpan: 1 }); } },
							{ title: "1/2", icon: columnSpan === 2 ? "yes" : null, onClick: function () { props.setAttributes({ columnSpan: 2 }); } },
							{ title: "3/4", icon: columnSpan === 3 ? "yes" : null, onClick: function () { props.setAttributes({ columnSpan: 3 }); } },
							{ title: "Full", icon: columnSpan === 4 ? "yes" : null, onClick: function () { props.setAttributes({ columnSpan: 4 }); } },
						],
					})
				),
				createElement(
					InspectorControls,
					null,
					createElement(
						PanelBody,
						{ title: __("Widget Settings", "systemdeck"), initialOpen: true },
						createElement(SelectControl, {
							label: __("Widget", "systemdeck"),
							value: widgetId,
							options: options,
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							onChange: function (next) {
								props.setAttributes({ widgetId: next || "" });
							},
						}),
						createElement(TextControl, {
							label: __("Custom widget ID (optional)", "systemdeck"),
							value: widgetId,
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							onChange: function (next) {
								props.setAttributes({ widgetId: next || "" });
							},
						}),
						createElement(TextControl, {
							label: __("Title", "systemdeck"),
							value: title,
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							onChange: function (next) {
								props.setAttributes({ title: next || "" });
								},
							})
							,
							createElement(SelectControl, {
								label: __("Column width", "systemdeck"),
								value: String(columnSpan),
								options: [
									{ label: "1/4", value: "1" },
									{ label: "1/2", value: "2" },
									{ label: "3/4", value: "3" },
									{ label: "Full", value: "4" },
								],
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
								onChange: function (next) {
									props.setAttributes({ columnSpan: parseInt(next || "2", 10) || 2 });
								},
							}),
							createElement(RangeControl, {
								label: __("Row span", "systemdeck"),
								value: rowSpan,
								min: 1,
								max: 6,
								__next40pxDefaultSize: true,
								onChange: function (next) {
									props.setAttributes({ rowSpan: parseInt(next || 1, 10) || 1 });
								},
								__nextHasNoMarginBottom: true,
							}),
							createElement(RangeControl, {
								label: __("Grid X", "systemdeck"),
								value: gridX,
								min: 0,
								max: 12,
								__next40pxDefaultSize: true,
								onChange: function (next) {
									props.setAttributes({ gridX: parseInt(next || 0, 10) || 0 });
								},
								__nextHasNoMarginBottom: true,
							}),
							createElement(RangeControl, {
								label: __("Grid Y", "systemdeck"),
								value: gridY,
								min: 0,
								max: 24,
								__next40pxDefaultSize: true,
								onChange: function (next) {
									props.setAttributes({ gridY: parseInt(next || 0, 10) || 0 });
								},
								__nextHasNoMarginBottom: true,
							})
						)
					),
						createElement(
							"div",
							{ className: "sd-widget-block-canvas sd-widget-slot-preview" },
							createElement(
								"div",
								{ className: "postbox" },
								createElement(
									"div",
									{ className: "postbox-header" },
									createElement("h2", { className: "hndle" }, displayTitle)
								),
								createElement(
									"div",
									{ className: "inside sd-widget-slot-preview__placeholder" },
									createElement(
										"div",
										{ className: "sd-widget-placeholder-block__meta" },
										createElement("strong", null, displayTitle),
										createElement(
											"div",
											{ className: "sd-widget-placeholder-block__facts" },
											createElement("span", { className: "sd-widget-placeholder-block__fact" }, "ID: ", widgetIdentifier),
											createElement("span", { className: "sd-widget-placeholder-block__fact" }, "Source: ", sourceLabel),
											createElement("span", { className: "sd-widget-placeholder-block__fact" }, "Type: ", typeLabel)
										),
										createElement(
											"p",
											{ className: "sd-widget-placeholder-block__note" },
											widgetId
												? __("Live widget content is disabled in the editor. This widget renders in the workspace runtime.", "systemdeck")
												: __("Select a widget in block settings to place it in this canvas.", "systemdeck")
										)
									)
								)
							)
						)
					);
				},
			save: function () {
				return null;
			},
		});
	}

	registerWidgetSlot("systemdeck/widgets");
})(window.wp);
