const path = require("path");
const webpack = require("webpack");

const debug = process.env.FLUTTER_DEBUG === "1";
const outputPath = debug
    ? path.resolve(__dirname, "dist-debug")
    : path.resolve(__dirname, "dist");

function transformObjectHasOwn({ types }) {
    return {
        name: "transform-object-has-own-for-quickjs-2021",
        visitor: {
            CallExpression(path) {
                const callee = path.node.callee;
                if (
                    !types.isMemberExpression(callee) ||
                    callee.computed ||
                    !types.isIdentifier(callee.object, { name: "Object" }) ||
                    !types.isIdentifier(callee.property, { name: "hasOwn" })
                ) {
                    return;
                }

                path.replaceWith(
                    types.callExpression(
                        types.memberExpression(
                            types.memberExpression(
                                types.memberExpression(
                                    types.identifier("Object"),
                                    types.identifier("prototype")
                                ),
                                types.identifier("hasOwnProperty")
                            ),
                            types.identifier("call")
                        ),
                        path.node.arguments
                    )
                );
            },
        },
    };
}

const babelOptions = {
    babelrc: false,
    configFile: false,
    sourceMaps: debug,
    plugins: [transformObjectHasOwn],
    presets: [
        [
            "@babel/preset-env",
            {
                // QuickJS 2021 supports BigInt, but not every ES2022 class feature.
                // Chrome 67 is used as a conservative ES2020-era syntax proxy.
                targets: { chrome: "67" },
                bugfixes: true,
                modules: false,
                useBuiltIns: false,
            },
        ],
    ],
};

module.exports = {
    entry: "./src/app-sui.ts",
    output: {
        path: outputPath,
        filename: "index.flutter.js",
        globalObject: "this",
        library: {
            type: "umd",
        },
        environment: {
            arrowFunction: false,
            const: false,
            destructuring: false,
            optionalChaining: false,
            templateLiteral: false,
        },
    },
    mode: "production",
    devtool: debug ? "source-map" : false,
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "babel-loader",
                        options: babelOptions,
                    },
                    {
                        loader: "ts-loader",
                        options: {
                            transpileOnly: true,
                        },
                    },
                ],
            },
            {
                test: /\.m?js$/,
                exclude: [
                    /node_modules[\\/]core-js[\\/]/,
                    /node_modules[\\/]webpack[\\/]/,
                ],
                resolve: {
                    fullySpecified: false,
                },
                use: {
                    loader: "babel-loader",
                    options: babelOptions,
                },
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js", ".tsx", ".mjs"],
        conditionNames: ["import", "require", "default"],
        fallback: {
            buffer: require.resolve("buffer/"),
            process: require.resolve("process/browser"),
        },
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: 'globalThis.__SECUX_SUI_BUNDLE__ = "flutter-sui-2.22.1";',
            raw: true,
            entryOnly: true,
        }),
        new webpack.DefinePlugin({
            "process.env.SECUX_PLATFROM": JSON.stringify("service"),
        }),
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
            process: "process/browser",
        }),
    ],
    externals: {
        "@secux/protocol-transaction": "@secux/protocol-transaction",
        "@secux/transport": "@secux/transport",
        "@secux/utility": "@secux/utility",
        ow: "ow",
    },
    experiments: {
        asyncWebAssembly: true,
    },
    optimization: {
        minimize: !debug,
        moduleIds: debug ? "named" : "deterministic",
        removeAvailableModules: true,
    },
    performance: {
        hints: false,
    },
};
