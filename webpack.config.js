const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const SPAWN_POINTS_PATH = path.join(__dirname, 'src', 'spawn-points.js');

// Load spawn points from JS module
function getSpawnPoints() {
    try {
        const content = fs.readFileSync(SPAWN_POINTS_PATH, 'utf-8');
        // Parse the array from "export default [...]"
        const match = content.match(/export default\s*(\[[\s\S]*\]);?/);
        if (match) {
            // Use Function to safely parse the array
            return new Function('return ' + match[1])();
        }
        return [];
    } catch (e) {
        return [];
    }
}

// Save spawn points to JS module
function saveSpawnPoints(points) {
    const jsContent = `// Spawn points data - редактируется через debug editor (E в игре)
// В dev режиме обновляется автоматически, в production - при сборке
export default ${JSON.stringify(points, null, 4).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'")};
`;
    fs.writeFileSync(SPAWN_POINTS_PATH, jsContent);
    console.log(`💾 Saved ${points.length} spawn points to spawn-points.js`);
}

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
            port: 8080,
            // API для spawn points редактора
            setupMiddlewares: (middlewares, devServer) => {
                // GET /api/spawn-points
                devServer.app.get('/api/spawn-points', (req, res) => {
                    try {
                        const points = getSpawnPoints();
                        res.json({ success: true, points });
                    } catch (error) {
                        res.status(500).json({ success: false, error: error.message });
                    }
                });
                
                // POST /api/spawn-points
                devServer.app.post('/api/spawn-points', (req, res) => {
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', () => {
                        try {
                            const { points } = JSON.parse(body);
                            saveSpawnPoints(points);
                            res.json({ success: true, points });
                        } catch (error) {
                            res.status(500).json({ success: false, error: error.message });
                        }
                    });
                });
                
                return middlewares;
            }
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
                BUILD_HASH: JSON.stringify(Date.now().toString(36)),
                // Spawn points встраиваются в бандл при сборке
                SPAWN_POINTS: JSON.stringify(getSpawnPoints()),
                IS_PRODUCTION: JSON.stringify(isProduction)
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
