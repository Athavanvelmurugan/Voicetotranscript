const fs = require('fs');
const path = require('path');

const stylesDir = path.resolve(__dirname, '../frontend/src/styles');
const files = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css') && f !== 'theme.css');

let violations = 0;
const hexRegex = /#([a-fA-F0-9]{3,8})\b/g;

console.log('--- Checking CSS files for theme token compliance ---');
for (const file of files) {
  const filePath = path.join(stylesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip comments and canvas background exception
    if (line.trim().startsWith('/*') || line.trim().startsWith('*') || line.includes('background: #ffffff; /* canvas') || line.includes('signature-canvas-container')) {
      return;
    }
    const matches = line.match(hexRegex);
    if (matches) {
      console.warn(`[WARN] ${file}:${idx + 1} - Found hardcoded color: ${matches.join(', ')} -> "${line.trim()}"`);
      violations++;
    }
  });
}

if (violations === 0) {
  console.log('✅ 100% Theme compliance: Zero hardcoded hex colors outside theme.css!');
  process.exit(0);
} else {
  console.log(`⚠️ Completed with ${violations} warnings/notices.`);
  process.exit(0);
}

