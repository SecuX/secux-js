const path = require("path");
const { EsbuildPlugin } = require("esbuild-loader");

module.exports = {
    entry: "./src/app-ada.ts",
    output: {
        path: `${__dirname}/dist`,
        filename: 'index.js',
        library: {
            type: 'umd'
        }
    },
    mode: 'production',
    cache: {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '../../tmp/webpack/app-ada'),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                    },
                },
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            fs: false,
            path: false,
            stream: false,
            os: false,
            http: false,
            https: false,
            zlib: false
        }
    },
    externals: {
        "@secux/protocol-transaction": "@secux/protocol-transaction",
        "@secux/transport": "@secux/transport",
        "@secux/utility": "@secux/utility",
        "ow": "ow"
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
        minimizer: [
            new EsbuildPlugin({
                target: 'es2017',
                // Preserve Webpack's top-level UMD environment detection.
                // esbuild-loader otherwise defaults to "iife" for web targets,
                // which wraps the UMD factory in a synthetic CommonJS module and
                // makes QuickJS take the require() branch.
                format: undefined,
                legalComments: 'none',
            }),
        ],
        removeAvailableModules: false,
    }
}
