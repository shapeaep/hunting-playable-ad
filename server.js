const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Build first, then serve
console.log('🔨 Building project...\n');

exec('npm run build', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Build failed:', error.message);
        console.error(stderr);
        process.exit(1);
    }
    
    console.log(stdout);
    console.log('✅ Build complete!\n');
    
    // Start server
    const server = http.createServer((req, res) => {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = path.join(DIST_DIR, filePath);
        
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // Try serving index.html for SPA routing
                    fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexContent) => {
                        if (err2) {
                            res.writeHead(404);
                            res.end('404 Not Found');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(indexContent);
                        }
                    });
                } else {
                    res.writeHead(500);
                    res.end('Server Error');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });
    
    server.listen(PORT, () => {
        console.log(`🎮 Game server running at:`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`\n📁 Serving from: ${DIST_DIR}`);
        console.log('\nPress Ctrl+C to stop\n');
    });
});

