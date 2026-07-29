import fs from 'fs';
const content = fs.readFileSync('.next/server/chunks/611.js', 'utf8');
const index = content.indexOf('outside of');
if (index !== -1) {
  console.log(content.substring(Math.max(0, index - 100), index + 100));
} else {
  console.log('Not found');
}
