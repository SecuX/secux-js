const webpack = require('webpack');


const definePluginConfig = new webpack.DefinePlugin({
    'process.env.DISTRIBUTION': JSON.stringify('development'),
    'process.env.LOGGER': JSON.stringify('winston'),
    // 'process.env.SECUX_CONFIRM': JSON.stringify('off')
});

const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: require.resolve('process/browser.js'),
    Buffer: ['buffer', 'Buffer'],
});


module.exports = {
    output: {
        path: `${__dirname}/__tests__`,
        filename: 'index.js',
        libraryTarget: 'umd'
    },
    devServer: {
        compress: true,
        port: 8080,
        static: './__tests__'
    },
    devtool: 'inline-source-map',
    plugins: [definePluginConfig, nodepolyfillPlugin],
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false
                }
            }
        ]
    },
    externals: {
        "react-native-logs": "react-native-logs"
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            buffer: require.resolve('buffer/'),
            process: require.resolve('process/browser.js'),
            crypto: require.resolve('crypto-browserify'),
            stream: require.resolve('stream-browserify'),
            vm: require.resolve('vm-browserify'),
            fs: false,
            tls: false,
            net: false,
            path: false,
            os: false,
            http: false,
            https: require.resolve('agent-base'),
            zlib: false,
            querystring: require.resolve("querystring-es3"),
        }
    },
    experiments: {
        asyncWebAssembly: true
    },
    stats: {
        warningsFilter: /cardano_serialization_lib_bg/, // 這是備用過濾法，雙重保險
        children: false // 減少子編譯過程的雜訊
    },
    ignoreWarnings: [
        (warning) =>
            warning.message.includes("Critical dependency: the request of a dependency is an expression") &&
            warning.module.resource.includes("cardano-serialization-lib-asmjs")
    ],
}
