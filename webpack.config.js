const webpack = require('webpack');


const definePluginConfig = new webpack.DefinePlugin({
    'process.env.DISTRIBUTION': JSON.stringify('development'),
    'process.env.LOGGER': JSON.stringify('winston'),
    // 'process.env.SECUX_CONFIRM': JSON.stringify('off')
});

const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: 'process/browser',
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
            process: require.resolve('process'),
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
    }
}
