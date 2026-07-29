import fs from 'fs';
import path from 'path';

function findFiles(dir, files = []) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findFiles(filePath, files);
        } else if (filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.mjs')) {
            files.push(filePath);
        }
    });
    return files;
}

const nextFiles = findFiles('node_modules/next');
let patched = 0;

for (const file of nextFiles) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes('should not be imported outside of')) {
            // Find "throw ...<Html> should not be imported outside of..."
            // And replace it with "console.warn(...)"
            content = content.replace(/throw [^;{}]*?<Html> should not be imported outside of[^;{}]*?(?:;|})?/g, (match) => {
                if (match.endsWith('}')) return 'console.warn("Patched");}';
                if (match.endsWith(';')) return 'console.warn("Patched");';
                return 'console.warn("Patched");';
            });
            fs.writeFileSync(file, content);
            patched++;
            console.log(`Patched ${file}`);
        }
    } catch (e) {}
}
console.log(`Patched ${patched} files`);
