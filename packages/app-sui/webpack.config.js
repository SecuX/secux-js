module.exports = {
    entry: "./src/app-sui.ts",
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
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          },
          exclude: /node_modules/
        },
        // 👈 處理 Pure ESM 套件無副檔名引用的問題
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false
          }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.mjs'],
      // 👈 讓 Webpack 優先讀取 package.json 中的 "import" (ESM) 欄位
      conditionNames: ['import', 'require', 'node', 'default']
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
