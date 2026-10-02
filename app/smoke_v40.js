'use strict';
// v4.0 浏览器冒烟（精确 ID 版）
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // 公告先弹出
  const ann = await page.evaluate(() => ({
    shown: document.getElementById('announce').style.display !== 'none',
    hasAuthor: document.body.textContent.includes('fangzhongxing'),
    hasFree: document.body.textContent.includes('免费休闲小游戏'),
  }));
  console.log('ANNOUNCE:', JSON.stringify(ann));
  await page.click('#btnAnnounce');
  await page.waitForTimeout(300);
  const annClosed = await page.evaluate(() => document.getElementById('announce').style.display === 'none');
  console.log('ANNOUNCE_CLOSED:', annClosed);
  await page.fill('#nameInput', '冒烟员');
  await page.click('#btnCreate');
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await page.click('#btnAddAI'); await page.waitForTimeout(300); }
  await page.click('#btnStart');
  await page.waitForTimeout(3000);

  const state1 = await page.evaluate(() => ({
    lobbyHidden: document.getElementById('lobby').style.display === 'none',
    gameShown: document.getElementById('game').style.display !== 'none',
    boardLen: (document.getElementById('board') || {}).innerHTML?.length || 0,
    banner: (document.getElementById('turnBanner') || {}).textContent || '',
  }));
  console.log('STATE:', JSON.stringify(state1));

  const branchOk = await page.evaluate(() => {
    const t = document.getElementById('board').innerHTML;
    return {
      jiangwan: t.includes('江湾支线'), ginkgo: t.includes('银杏岔路'),
      startup: t.includes('创业孵化器'), pool: t.includes('教育基金池'),
      cells52: t.includes('二手集市'),
    };
  });
  console.log('BRANCH_MAP:', JSON.stringify(branchOk));

  // 观察若干秒（AI 推进 + AI 掷骰会触发 reroll 询问超时路径）
  await page.waitForTimeout(25000);
  const state2 = await page.evaluate(() => ({
    banner: document.getElementById('turnBanner').textContent,
    logTail: (document.getElementById('logBox') || {}).textContent?.slice(-150) || '',
    tokens: document.querySelectorAll('#tokenLayer g, #tokenLayer circle, #tokenLayer image, #tokenLayer *').length,
  }));
  console.log('AFTER25S:', JSON.stringify(state2));
  await page.screenshot({ path: '../外观预览/棋盘_v4.0_冒烟.png' });

  console.log('CONSOLE_ERRORS:', errors.length);
  errors.slice(0, 8).forEach(e => console.log('  -', e.slice(0, 220)));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SMOKE_FAIL:', e.message); process.exit(1); });
