'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const distDir = path.join(projectRoot, 'dist');

const sourceFiles = {
    html: path.join(projectRoot, 'index.html'),
    css: path.join(projectRoot, 'styles.css'),
    i18n: path.join(projectRoot, 'i18n.js'),
    app: path.join(projectRoot, 'app.js')
};

const logoCandidates = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg', 'logo.webp', 'logo.gif'];
const logoMimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
};

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error(`读取文件失败: ${filePath}`);
        throw err;
    }
}

function readBinary(filePath) {
    try {
        return fs.readFileSync(filePath);
    } catch (err) {
        console.error(`读取文件失败: ${filePath}`);
        throw err;
    }
}

function escapeForScript(content) {
    return content.replace(/<\/(script)/gi, '<\\/$1');
}

function escapeForStyle(content) {
    return content.replace(/<\/(style)/gi, '<\\/$1');
}

function getVersion() {
    // 1. 优先从环境变量获取（GitHub Actions 会设置）
    if (process.env.VERSION) {
        return process.env.VERSION;
    }
    
    // 2. 尝试从 git tag 获取
    try {
        const { execSync } = require('child_process');
        const gitTag = execSync('git describe --tags --exact-match 2>/dev/null || git describe --tags 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
        if (gitTag) {
            return gitTag;
        }
    } catch (err) {
        console.warn('无法从 git 获取版本号');
    }
    
    // 3. 回退到 package.json
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        return 'v' + packageJson.version;
    } catch (err) {
        console.warn('无法从 package.json 读取版本号');
    }
    
    // 4. 最后使用默认值
    return 'v0.0.0-dev';
}

function ensureDistDir() {
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir);
}

function loadLogoDataUrl() {
    for (const candidate of logoCandidates) {
        const filePath = path.join(projectRoot, candidate);
        if (!fs.existsSync(filePath)) continue;

        const ext = path.extname(candidate).toLowerCase();
        const mime = logoMimeMap[ext];
        if (!mime) {
            console.warn(`未知 Logo 文件类型，跳过内联: ${candidate}`);
            continue;
        }

        const buffer = readBinary(filePath);
        const base64 = buffer.toString('base64');
        return `data:${mime};base64,${base64}`;
    }
    return null;
}

function build() {
    ensureDistDir();

    let html = readFile(sourceFiles.html);
    const css = escapeForStyle(readFile(sourceFiles.css));
    const i18n = escapeForScript(readFile(sourceFiles.i18n));
    const app = escapeForScript(readFile(sourceFiles.app));
    
    // 获取版本号并替换
    const version = getVersion();
    console.log(`使用版本号: ${version}`);
    html = html.replace(/__VERSION__/g, version);

    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        `<style>
${css}
</style>`
    );

    html = html.replace(
        '<script src="i18n.js"></script>',
        `<script>
${i18n}
</script>`
    );

    html = html.replace(
        '<script src="app.js"></script>',
        `<script>
${app}
</script>`
    );

    const logoDataUrl = loadLogoDataUrl();
    if (logoDataUrl) {
        const logoScript = `<script>window.__INLINE_LOGO__ = "${logoDataUrl}";</script>`;
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${logoScript}\n</body>`);
        } else {
            html += `\n${logoScript}`;
        }
    } else {
        console.warn('未找到可内联的 Logo 文件，将保持运行时加载。');
    }

    const outputPath = path.join(distDir, 'index.html');
    fs.writeFileSync(outputPath, html, 'utf8');

    console.log('构建完成: dist/index.html');
}

try {
    build();
} catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
}


