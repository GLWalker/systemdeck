const slugify = (value = "") =>
	String(value || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "widget"

const WidgetShell = ({
	widgetId,
	title,
	children,
	widthControl,
	isCollapsed,
	onToggle,
	onMoveUp,
	onMoveDown,
	onMoveLeft,
	onMoveRight,
	moveUpDisabled = false,
	moveDownDisabled = false,
	moveLeftDisabled = false,
	moveRightDisabled = false,
	className = "",
	headerDragProps = {},
}) => {
	const friendlyId = slugify(title)
	const idSeed = slugify(widgetId || title)
	const headingId = `sd-widget-title-${idSeed}`
	const upDescId = `${idSeed}-handle-order-higher-description`
	const downDescId = `${idSeed}-handle-order-lower-description`
	return (
		<section
			id={friendlyId}
			className={`postbox sd-widget ${className} ${isCollapsed ? "closed" : ""}`}
			role='region'
			aria-labelledby={headingId}>
			<div className='postbox-header' {...headerDragProps}>
				<h2
					id={headingId}
					className='hndle'
					{...headerDragProps}
					style={{ cursor: "grab" }}>
					<span>{title}</span>
				</h2>
				<div className='handle-actions hide-if-no-js'>
					<button
						type='button'
						className='handle-order-higher'
						aria-disabled={moveUpDisabled ? "true" : "false"}
						aria-describedby={upDescId}
						onClick={onMoveUp}>
						<span className='screen-reader-text'>Move up</span>
						<span className='order-higher-indicator' aria-hidden='true'></span>
					</button>
					<span className='hidden' id={upDescId}>
						Move {title} box up
					</span>
					<button
						type='button'
						className='handle-order-lower'
						aria-disabled={moveDownDisabled ? "true" : "false"}
						aria-describedby={downDescId}
						onClick={onMoveDown}>
						<span className='screen-reader-text'>Move down</span>
						<span className='order-lower-indicator' aria-hidden='true'></span>
					</button>
					<span className='hidden' id={downDescId}>
						Move {title} box down
					</span>
					<button
						type='button'
						className='handle-order-higher sd-handle-order-left'
						aria-disabled={moveLeftDisabled ? "true" : "false"}
						onClick={onMoveLeft}>
						<span className='screen-reader-text'>Move left</span>
						<span className='order-higher-indicator' aria-hidden='true'></span>
					</button>
					<button
						type='button'
						className='handle-order-lower sd-handle-order-right'
						aria-disabled={moveRightDisabled ? "true" : "false"}
						onClick={onMoveRight}>
						<span className='screen-reader-text'>Move right</span>
						<span className='order-lower-indicator' aria-hidden='true'></span>
					</button>
					{widthControl}
					<button
						type='button'
						className='handlediv'
						aria-expanded={!isCollapsed}
						onClick={onToggle}>
						<span className='screen-reader-text'>Toggle panel: {title}</span>
						<span className='toggle-indicator' aria-hidden='true'></span>
					</button>
				</div>
			</div>
			<div className='inside'>
				{children}
			</div>
		</section>
	)
}

export default WidgetShell
