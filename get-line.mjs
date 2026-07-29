import fs from 'fs';
const lines = fs.readFileSync('.next/server/chunks/611.js', 'utf8').split('\n');
if (lines.length >= 6) {
  const line = lines[5];
  console.log(line.substring(1300, 1400));
}
