// 简单的 HTTP 静态文件服务器
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // 处理 hash 路由：#admin 等
    // 对于 file:// 协议的 hash 路由，我们始终返回 index.html
    let filePath = path.join(ROOT, req.url.split('?')[0].split('#')[0]);
    
    // 如果是根路径或不存在，返回 index.html
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(ROOT, 'index.html');
    }
    
    // 安全检查：防止路径穿越
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            // 如果文件不存在，返回 index.html（SPA 模式）
            filePath = path.join(ROOT, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  LMK 实验室宣传网站已启动`);
    console.log(`========================================`);
    console.log(`  前台: http://localhost:${PORT}`);
    console.log(`  后台: http://localhost:${PORT}/#admin`);
    console.log(`========================================\n`);
    console.log(`按 Ctrl+C 停止服务器\n`);
});
