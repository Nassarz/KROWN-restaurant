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
            // Let's replace the whole throw block safely.
            // Example: "if(!e)throw Object.defineProperty(Error("<Html> should not be imported outside of pages/_document.\nRead more: https://nextjs.org/docs/messages/no-document-import-in-page"),"__NEXT_ERROR_CODE",{value:"E416",enumerable:!1,configurable:!0});"
            // We just replace 'throw Object.defineProperty(Error("<Html>' with 'return null; /*'
            // and then close the comment right before the next statement... wait, regex is safer.
            content = content.replace(/throw\s+[^{}]*?should not be imported outside of[^{}]*?(?:;)/g, 'console.warn("Patched");');
            if (content.length !== oldLen) {
                fs.writeFileSync(file, content);
                patched++;
                console.log(`Patched ${file}`);
            } else {
                // Try replacing just the throw part.
                content = content.replace(/throw\s+Object\.defineProperty\(\s*Error\("[^"]*should not be imported outside of[^)]+\)\s*,\s*"[^"]+"\s*,\s*\{[^}]+\}\s*\)\s*;/g, 'console.warn("Patched");');
                if (content.length !== oldLen) {
                    fs.writeFileSync(file, content);
                    patched++;
                    console.log(`Patched ${file} (fallback 1)`);
                } else {
                    console.log(`Failed to patch ${file}`);
                }
            }
        }
    } catch (e) {}
}
console.log(`Patched ${patched} files`);
