import fs from 'fs';

const files = [
  'node_modules/next/dist/esm/shared/lib/html-context.shared-runtime.js',
  'node_modules/next/dist/shared/lib/html-context.shared-runtime.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/throw Object\.defineProperty\(new Error[\s\S]*?configurable:\s*true\s*}\);/g, 'console.warn("Patched");');
  fs.writeFileSync(file, content);
  console.log('Patched', file);
}
