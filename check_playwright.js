// Check for playwright packages
const paths = [
  'playwright',
  '@playwright/test',
  'playwright-core',
  'playwright-chromium'
];
for (const p of paths) {
  try {
    const resolved = require.resolve(p);
    console.log('FOUND:', p, '->', resolved);
  } catch(e) {
    console.log('NOT FOUND:', p);
  }
}
