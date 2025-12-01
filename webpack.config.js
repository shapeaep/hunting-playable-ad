const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    // Playable SDK required globals
    const adNetwork = env?.network || 'none';
    const adProtocol = env?.protocol || 'none';
    
    return {
        entry: './src/index.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bundle.[contenthash:8].js',
            clean: true
        },
        devServer: {
            static: [
                './dist',
                { directory: path.resolve(__dirname, 'node_modules/three/examples/jsm/libs'), publicPath: '/node_modules/three/examples/jsm/libs' }
            ],
            hot: true,
            port: 8080
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
                        'css-loader'
                    ]
                },
                {
                    test: /\.(jpg|jpeg|png|gif|webp)$/i,
                    type: 'asset/resource'
                },
                {
                    test: /\.(glb|gltf)$/i,
                    type: 'asset/resource'
                }
            ]
        },
        plugins: [
            // Define Playable SDK globals
            new webpack.DefinePlugin({
                AD_NETWORK: JSON.stringify(adNetwork),
                AD_PROTOCOL: JSON.stringify(adProtocol),
                GOOGLE_PLAY_URL: JSON.stringify('https://play.google.com/store/apps/details?id=com.example.huntinggame'),
                APP_STORE_URL: JSON.stringify('https://apps.apple.com/app/id123456789'),
                BUILD_HASH: JSON.stringify(Date.now().toString(36))
            }),
            new HtmlWebpackPlugin({
                template: './src/index.html',
                minify: isProduction ? {
                    collapseWhitespace: true,
                    removeComments: true
                } : false
            }),
            ...(isProduction ? [
                new MiniCssExtractPlugin({
                    filename: 'styles.[contenthash:8].css'
                })
            ] : [])
        ],
        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            drop_console: true,
                            passes: 2
                        },
                        mangle: true
                    }
                })
            ]
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        devtool: isProduction ? false : 'eval-source-map'
    };
};
