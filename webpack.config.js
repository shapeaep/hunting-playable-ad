const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    return {
        entry: './src/main.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bundle.[contenthash:8].js',
            clean: true
        },
        devServer: {
            static: './dist',
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
                }
            ]
        },
        plugins: [
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

