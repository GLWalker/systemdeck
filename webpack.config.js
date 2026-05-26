const defaultConfig = require("@wordpress/scripts/config/webpack.config")
const path = require("path")

module.exports = {
	...defaultConfig,
	entry: {
		// Main SystemDeck Canvas Runtime (React app)
		"systemdeck-runtime": path.resolve(__dirname, "src/index.js"),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve(__dirname, "assets/runtime"),
	},
}
