module.exports = {
    entry: "./src/index.ts",
    output: {
        path: `${__dirname}/dist`,
        filename: 'index.js',
        library: {
            type: 'umd'
        }
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
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
        removeAvailableModules: true,
    }
}
