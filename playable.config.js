const path = require('path');

/**
 * Playable Scripts Configuration
 * @see https://github.com/smoudjs/playable-sdk
 */
module.exports = {
    // Entry point
    entry: path.resolve(__dirname, 'src/index.js'),
    
    // HTML template
    template: path.resolve(__dirname, 'src/index.html'),
    
    // Output directory
    outDir: path.resolve(__dirname, 'dist/playable'),
    
    // Store URLs
    googlePlayUrl: 'https://play.google.com/store/apps/details?id=com.example.huntinggame',
    appStoreUrl: 'https://apps.apple.com/app/id123456789',
    
    // Webpack customization
    webpack: (config) => {
        // Add CSS loader
        config.module.rules.push({
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        });
        
        // Add path alias
        config.resolve = config.resolve || {};
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, 'src')
        };
        
        return config;
    }
};
