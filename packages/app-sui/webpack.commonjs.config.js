const path = require("path");
const baseConfig = require("./webpack.config");

module.exports = {
    ...baseConfig,
    entry: {
        "app-sui": "./src/app-sui.ts",
        interface: "./src/interface.ts",
        polyfill: "./src/polyfill.ts",
        utils: "./src/utils.ts",
    },
    output: {
        path: path.resolve(__dirname, "lib"),
        filename: "[name].js",
        library: {
            type: "commonjs2",
        },
    },
    externalsType: "commonjs",
    optimization: {
        ...baseConfig.optimization,
        minimize: true,
    },
};
