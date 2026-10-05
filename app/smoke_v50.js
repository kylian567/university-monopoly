'use strict';
// v5.0 浏览器冒烟：开局流程（作者公告→5.0简介→创房）、规则弹窗、蛇形棋盘渲染
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // [1] 作者公告
  const ann = await page.evaluate(() => ({
    shown: getComputedStyle(document.getElementById('announce')).display !== 'none',
    hasAuthor: document.body.textContent.includes('fangzhongxing'),
    hasName: document.body.textContent.includes('没事就玩大富翁'),
  }));
  console.log('ANNOUNCE:', JSON.stringify(ann));
  await page.click('#btnAnnounce');
  await page.waitForTimeout(350);

  // [2] v5.0 更新简介
  const intro = await page.evaluate(() => {
    const el = document.getElementById('intro');
    return {
      annClosed: getComputedStyle(document.getElementById('announce')).display === 'none',
      introShown: el && getComputedStyle(el).display !== 'none',
      has50: el ? el.textContent.includes('5.0') : false,
      hasUni: el ? /大学|QS/.test(el.textContent) : false,
    };
  });
  console.log('INTRO:', JSON.stringify(intro));
  await page.click('#btnIntro');
  await page.waitForTimeout(250);

  // [3] 创房界面规则介绍
  await page.click('#btnRulesLobby');
  await page.waitForTimeout(250);
  const r1 = await page.evaluate(() => getComputedStyle(document.getElementById('rules')).display !== 'none');
  await page.click('#btnRulesClose');
  await page.waitForTimeout(200);
  const r2 = await page.evaluate(() => getComputedStyle(document.getElementById('rules')).display === 'none');
  console.log('RULES_LOBBY:', JSON.stringify({ open: r1, closed: r2 }));

  // [4] 建房 + AI + 开局
  await page.fill('#nameInput', '冒烟员');
  await page.click('#btnCreate');
  await page.waitForTimeout(800);
  for (let i = 0; i < 4; i++) { await page.click('#btnAddAI'); await page.waitForTimeout(250); }
  await page.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); });
  await page.waitForTimeout(400);
  const playerCount = await page.evaluate(() => document.querySelectorAll('#playerList .player-item').length);
  console.log('PLAYERS:', playerCount);
  await page.click('#btnStart');
  await page.waitForTimeout(3500);

  const state = await page.evaluate(() => {
    const t = document.getElementById('board').innerHTML;
    return {
      lobbyHidden: getComputedStyle(document.getElementById('lobby')).display === 'none',
      gameShown: getComputedStyle(document.getElementById('game')).display !== 'none',
      boardLen: t.length,
      hasHKU: t.includes('香港大学'),
      hasChangAn: t.includes('长安大学'),
      hasFudan: t.includes('复旦大学'),
      hasJiangwan: t.includes('江湾') || t.includes('银杏'),
      hasBranchA: t.includes('学术长廊'),
      hasBranchB: t.includes('创业大道'),
      hasAirport: t.includes('机场'),
      ctrlBar: !!document.getElementById('ctrlBar'),
      tokenCount: document.querySelectorAll('#tokenLayer *').length,
      banner: (document.getElementById('turnBanner') || {}).textContent || '',
    };
  });
  console.log('STATE:', JSON.stringify(state));

  // [5] 对局内规则介绍
  await page.click('#btnRules');
  await page.waitForTimeout(200);
  const g1 = await page.evaluate(() => getComputedStyle(document.getElementById('rules')).display !== 'none');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const g2 = await page.evaluate(() => getComputedStyle(document.getElementById('rules')).display === 'none');
  console.log('RULES_INGAME:', JSON.stringify({ open: g1, escClose: g2 }));

  await page.waitForTimeout(20000);
  const after = await page.evaluate(() => ({
    banner: document.getElementById('turnBanner').textContent,
    logTail: (document.getElementById('logBox') || {}).textContent?.slice(-140) || '',
  }));
  console.log('AFTER20S:', JSON.stringify(after));
  await page.screenshot({ path: '../外观预览/棋盘_v5.0_冒烟.png' });

  console.log('CONSOLE_ERRORS:', errors.length);
  errors.slice(0, 8).forEach(e => console.log('  -', e.slice(0, 220)));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SMOKE_FAIL:', e.message); process.exit(1); });
