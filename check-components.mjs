import fs from 'fs';
import path from 'path';

function findFiles(dir, files = []) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findFiles(filePath, files);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            files.push(filePath);
        }
    });
    return files;
}

const files = findFiles('components');
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('next/document')) {
        console.log(`FOUND IN ${file}`);
    }
}
console.log('Done checking components');
