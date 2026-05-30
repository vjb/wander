const paths = [
  'playwright',
  '@playwright/test',
  'playwright-core', 
  'ws',
  'puppeteer'
];
for (const p of paths) {
  try { require.resolve(p); console.log('FOUND:', p); } catch { console.log('NOT FOUND:', p); }
}
