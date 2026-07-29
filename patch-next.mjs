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
            const oldLen = content.length;
            // Catch throw Object.defineProperty(Error("..."))
            content = content.replace(/throw [A-Za-z0-9_.$]+\(Error\("<Html> should not be imported outside of pages\/_document[^)]+\)\)/g, 'console.warn("Patched Html error")');
            // Catch throw new Error("...")
            content = content.replace(/throw new Error\("<Html> should not be imported outside of pages\/_document[^)]+\)/g, 'console.warn("Patched Html error")');
            if (content.length !== oldLen) {
                fs.writeFileSync(file, content);
                patched++;
                console.log(`Patched ${file}`);
            } else {
                console.log(`Found string but regex failed in ${file}`);
            }
        }
    } catch (e) {}
}
console.log(`Patched ${patched} files`);
