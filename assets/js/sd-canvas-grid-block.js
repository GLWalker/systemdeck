(function (wp) {
	if (!wp || !wp.blocks || !wp.element || !wp.blockEditor || !wp.i18n) {
		return;
	}

	var registerBlockType = wp.blocks.registerBlockType;
	var createElement = wp.element.createElement;
	var __ = wp.i18n.__;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var useInnerBlocksProps = wp.blockEditor.useInnerBlocksProps;
	var InnerBlocks = wp.blockEditor.InnerBlocks;
	var getBlockTypes = wp.blocks.getBlockTypes;

	function getCanvasAllowedBlocks() {
		var blocked = {
			"core/group": true,
			"core/row": true,
			"core/columns": true,
			"core/column": true,
		};
		if (!getBlockTypes) return undefined;
		return getBlockTypes()
			.map(function (blockType) {
				return blockType && blockType.name ? blockType.name : "";
			})
			.filter(function (name) {
				return !!name && !blocked[name];
			});
	}

	registerBlockType("systemdeck/canvas-grid", {
		apiVersion: 3,
		title: __("SystemDeck Canvas Grid", "systemdeck"),
		description: __("Hidden SystemDeck canvas grid host.", "systemdeck"),
		icon: "screenoptions",
		category: "design",
		supports: {
			html: false,
			inserter: false,
			reusable: false,
			multiple: false,
		},
		edit: function () {
			var blockProps = useBlockProps({
				className: "sd-canvas-grid-block",
				"data-sd-grid-host": "1",
				style: { width: "100%", maxWidth: "none" },
			});
			var innerBlocksProps = useInnerBlocksProps(
				{
					className: "sd-canvas-grid-host__inner",
				},
				{
					renderAppender: InnerBlocks.ButtonBlockAppender,
					allowedBlocks: getCanvasAllowedBlocks(),
				}
			);

			return createElement("div", blockProps, createElement("div", innerBlocksProps));
		},
		save: function () {
			var blockProps = wp.blockEditor.useBlockProps.save({
				className: "sd-canvas-grid-host",
				"data-sd-grid-host": "1",
			});
			return createElement("div", blockProps, createElement(InnerBlocks.Content));
		},
	});
})(window.wp);
