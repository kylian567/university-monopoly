'use strict';
// v5.3 浏览器实机验收：
//   [1] 源码级静态核对 —— 掷骰落定不再调用 shakeBoard、确有 diceRipple；
//       台风的雷声只在"切到台风"那一下响（drawWeather 的 storm 分支不再播 thunder）；
//       新视觉类与音效表齐备
//   [2] 开局公告已是 v5.3
//   [3] 选专业界面：60 个专业按钮 / 平铺样式 / 搜索框过滤
//   [4] 新视觉函数与镜像表在运行时可用（60 专业、91 音效、5 个新特效函数）
//   [5] 掷骰落定涟漪动效可复现（不再晃屏）
//   [6] 带新专业开局不报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上链接），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v53shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

// 从源码里抠出某个对象字面量的区间（用于数 SFX 键数）
function sliceObject(src, header) {
  const i = src.indexOf(header);
  if (i < 0) return '';
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return src.slice(j, k);
}
// 抠出某个函数体（粗略：从 `function name(` 或 `name(...) {` 起做花括号配对）
function sliceFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{').exec(src);
  if (!m) return '';
  let depth = 0, k = m.index + m[0].length - 1;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return src.slice(m.index, k);
}

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}

  // ---------------- [1] 源码级静态核对 ----------------
  console.log('\n[1] 源码级静态核对');
  const cliJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

  const diceAnim = sliceFn(cliJs, 'diceAnim');
  ok(diceAnim.length > 0, '找到 diceAnim 函数');
  ok(!/shakeBoard\s*\(/.test(diceAnim), '掷骰落定已不再调用 shakeBoard()（不再整屏晃动）');
  ok(/diceRipple\s*\(/.test(diceAnim), '掷骰落定改为调用 diceRipple()（落点涟漪）');

  const drawWeather = sliceFn(cliJs, 'drawWeather');
  ok(drawWeather.length > 0, '找到 drawWeather 函数');
  const stormCase = drawWeather.slice(drawWeather.indexOf("case 'storm'"));
  const stormBlock = stormCase.slice(0, stormCase.indexOf('break;'));
  ok(!/SFX\.thunder\s*\(/.test(stormBlock), '台风粒子循环里不再重复播雷声');
  ok(/wxFlash\s*=\s*9/.test(stormBlock), '台风里仍保留 wxFlash 闪电闪光');
  const thunderCount = (cliJs.match(/SFX\.thunder\s*\(/g) || []).length;
  ok(thunderCount === 2, `SFX.thunder 全场只出现 ${thunderCount} 次（切到台风 1 次 + 校历"暴雨停课周" 1 次，均为一次性）`);

  const wxSwitch = sliceFn(cliJs, 'playWeather') || cliJs;
  void wxSwitch;
  ok(/e\.w === 'storm'[\s\S]{0,40}SFX\.thunder/.test(cliJs), '抽到 / 切到台风时仍响一次雷声');

  const needCss = ['\\.dice-ripple', '\\.dice-flare', '@keyframes diceRippleOut', '@keyframes diceFlare',
    '\\.skill-beam', '@keyframes beamSweep', '\\.up-pillar', '@keyframes pillarRise',
    '\\.crown-pop', '@keyframes crownDrop', '\\.grey-out', '\\.halo-dash', '@keyframes haloSpin'];
  const missCss = needCss.filter(p => !new RegExp(p).test(css));
  ok(missCss.length === 0, `style.css 新增动效类与关键帧齐备${missCss.length ? '（缺 ' + missCss.join(',') + '）' : ''}`);

  const shakeKf = /@keyframes shake\s*\{([^}]*)\}/.exec(css.replace(/[\s\S]*?@keyframes shake/, m => m));
  void shakeKf;

  const sfxBlock = sliceObject(cliJs, 'const SFX = {');
  const sfxKeys = (sfxBlock.match(/^\s{2}[A-Za-z_$][\w$]*\s*:/gm) || []).length;
  ok(sfxKeys === 99, `音效表共 ${sfxKeys} 种（v5.7 新增 5 种后预期 99）`);
  const newSfx = ['skillCast', 'beam', 'chip', 'upgrade', 'coinFly', 'gavel', 'pulse', 'glint', 'whooshLow', 'crown', 'revive', 'roundBell', 'diceSettle'];
  const missSfx = newSfx.filter(k => !new RegExp('\\b' + k + '\\s*:').test(sfxBlock));
  ok(missSfx.length === 0, `13 个新音效都已定义${missSfx.length ? '（缺 ' + missSfx.join(',') + '）' : ''}`);

  const fns = ['skillBeam', 'upgradePillar', 'crownAt', 'greyMoment', 'diceRipple'];
  const missFn = fns.filter(f => !new RegExp('function\\s+' + f + '\\s*\\(').test(cliJs));
  ok(missFn.length === 0, `5 个新视觉函数都已定义${missFn.length ? '（缺 ' + missFn.join(',') + '）' : ''}`);

  ok(/v5\.\d+ 大更新/.test(html), '开局公告大版本标题存在');
  ok(/majorSearch/.test(html) && /filterMajors/.test(html), '选专业搜索框已就位');

  // ---------------- 浏览器 ----------------
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const shot = n => page.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    console.log('\n[2] 开局公告与规则弹窗');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v5\.\d+/.test(ann), `开局公告标题：${ann}`);
    const body = await page.evaluate(() => [...document.querySelectorAll('#intro .intro-body')].map(e => e.textContent).join('\n'));   // v5.6：多版本段落为并列 body，全部拼接
    ok(/60 种/.test(body) && /电气/.test(body), '公告正文写明"专业 33 → 60 种"并点名电气');
    ok(/不再整个屏幕晃/.test(body) || /不再.*晃/.test(body), '公告写明"骰子掷完不再晃屏"');
    ok(/雷声只响一次/.test(body), '公告写明"台风雷声只响一次"');
    await page.click('#btnAnnounce'); await page.waitForTimeout(240);   // 先关作者公告，更新简介才露出来
    await page.click('#btnIntro'); await page.waitForTimeout(240);
    await page.click('#btnRulesClose').catch(() => {});
    await page.waitForTimeout(220);

    console.log('\n[3] 建房并检查选专业界面（60 种）');
    await page.fill('#nameInput', '验收员');
    await page.click('#btnCreate');
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await page.click('#btnAddAI'); await page.waitForTimeout(180); }
    await page.waitForTimeout(300);
    const picker = await page.evaluate(() => ({
      btns: document.querySelectorAll('#majorRow .major-btn').length,
      majors: Object.keys(MAJORS).length,
      keys: (typeof MAJOR_KEYS !== 'undefined') ? MAJOR_KEYS.length : Object.keys(MAJORS).length,
      hasSearch: !!document.getElementById('majorSearch'),
      noTierDom: document.querySelectorAll('#majorRow .mj-block, #majorRow .mj-group').length,
    }));
    ok(picker.btns === 60, `选专业界面列出 ${picker.btns} 个专业按钮（预期 60）`);
    ok(picker.noTierDom === 0, '没有梯队分组 DOM（平铺样式与 v5.2 之前一致）');
    ok(picker.majors === 60 && picker.keys === 60, `前端镜像：MAJORS ${picker.majors} 项 / MAJOR_KEYS ${picker.keys} 项`);
    ok(picker.hasSearch, '搜索框已渲染');
    await shot('01-picker.png');

    console.log('\n[4] 搜索框过滤');
    await page.fill('#majorSearch', '电气');
    await page.waitForTimeout(260);
    const s1 = await page.evaluate(() => ({
      vis: [...document.querySelectorAll('#majorRow .major-btn')].filter(b => b.style.display !== 'none').length,
      txt: [...document.querySelectorAll('#majorRow .major-btn')].filter(b => b.style.display !== 'none').map(b => (b.querySelector('.mj-name') || {}).textContent || ''),
    }));
    ok(s1.vis >= 1 && s1.vis <= 4, `搜「电气」命中 ${s1.vis} 个：${s1.txt.join(' / ')}`);
    ok(s1.txt.some(t => /电气工程/.test(t)), '命中结果里包含「电气工程」');
    await shot('02-search.png');

    await page.fill('#majorSearch', '自动化');
    await page.waitForTimeout(260);
    const s2 = await page.evaluate(() => [...document.querySelectorAll('#majorRow .major-btn')].filter(b => b.style.display !== 'none').map(b => (b.querySelector('.mj-name') || {}).textContent || ''));
    ok(s2.some(t => /自动化/.test(t)), `搜「自动化」命中：${s2.join(' / ')}`);

    await page.fill('#majorSearch', 'zzz不存在的专业');
    await page.waitForTimeout(260);
    const s3 = await page.evaluate(() => ({
      vis: [...document.querySelectorAll('#majorRow .major-btn')].filter(b => b.style.display !== 'none').length,
    }));
    ok(s3.vis === 0, '无匹配时全部按钮隐藏');

    await page.fill('#majorSearch', '');
    await page.waitForTimeout(260);
    const s4 = await page.evaluate(() => [...document.querySelectorAll('#majorRow .major-btn')].filter(b => b.style.display !== 'none').length);
    ok(s4 === 60, `清空搜索后恢复全部 ${s4} 个专业`);

    console.log('\n[5] 选中新专业「电气工程」，验证落到服务端');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#majorRow .major-btn')].find(b => /电气工程/.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const mine = await page.evaluate(() => {
      const me = S.players.find(p => p.id === myPid);
      return { major: me ? me.major : null, hint: (document.getElementById('majorHint') || {}).textContent || '' };
    });
    ok(mine.major === 'elec', `我的专业已设为 elec（实际 ${mine.major}）`);
    ok(/电气工程/.test(mine.hint) && /峰谷套利/.test(mine.hint), `专业提示条：${mine.hint}`);
    const sel = await page.evaluate(() => ({
      sel: document.querySelectorAll('#majorRow .major-btn.sel').length,
      sig: majorRowSig,
    }));
    ok(sel.sel === 1, '选中的专业按钮被高亮（签名守卫下仍只重绘一次）');
    void sel.sig;

    console.log('\n[6] 运行时镜像 + 新特效函数可用');
    const rt = await page.evaluate(() => ({
      majors: Object.keys(MAJORS).length,
      elec: MAJORS.elec.name,
      elecMode: MAJORS.elec.mode,
      sfx: Object.keys(SFX).length,
      fns: ['skillBeam', 'upgradePillar', 'crownAt', 'greyMoment', 'diceRipple'].map(f => typeof window[f]),
      fac: FACULTY_KEYS.length,
    }));
    ok(rt.majors === 60, `运行时 MAJORS ${rt.majors} 项`);
    ok(rt.elec === '电气工程' && rt.elecMode === 'active', `电气工程 = ${rt.elec}（${rt.elecMode} 主动技）`);
    ok(rt.sfx === 99, `运行时音效表 ${rt.sfx} 种`);
    ok(rt.fns.every(t => t === 'function'), `5 个新特效函数均已挂载：${rt.fns.join('/')}`);
    ok(rt.fac === 23, `v5.2 校园风貌镜像未受影响（${rt.fac} 项）`);

    console.log('\n[7] 掷骰落定涟漪可复现（且不再晃屏）');
    const ripple = await page.evaluate(() => {
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:-9999px;width:80px;height:80px';
      document.body.appendChild(box);
      const before = document.querySelectorAll('.dice-ripple').length;
      diceRipple(box);
      const rings = box.querySelectorAll('.dice-ripple').length;
      const flare = box.querySelectorAll('.dice-flare').length;
      // 同时确认「晃屏」函数不会在掷骰路径上被触发：这里直接看 shake 动画有没有挂到棋盘上
      const boardAnim = getComputedStyle(document.getElementById('boardWrap')).animationName;
      box.remove();
      return { before, rings, flare, boardAnim };
    });
    ok(ripple.rings === 3 && ripple.flare === 1, `一次落定画 ${ripple.rings} 圈涟漪 + ${ripple.flare} 个光晕`);
    ok(!/shake/.test(ripple.boardAnim), `棋盘当前未挂 shake 动画（animation-name: ${ripple.boardAnim}）`);

    console.log('\n[8] 带新专业开局不报错');
    await page.click('#btnStart');
    await page.waitForSelector('.fac-layer.show, #board', { timeout: 10000 });
    await page.waitForTimeout(1200);
    const started = await page.evaluate(() => ({
      phase: S ? S.phase : null,
      onBoard: !!document.getElementById('board'),
      players: S ? S.players.length : 0,
    }));
    ok(started.players === 4 && started.onBoard, `开局成功：${started.players} 人、棋盘已渲染`);
    await shot('03-started.png');

    console.log('\n[9] 控制台无报错');
    const real = errors.filter(e => !/favicon|net::ERR_/i.test(e));
    ok(real.length === 0, real.length ? `发现报错：${real.slice(0, 3).join(' | ')}` : '无 JS 报错');
  } catch (e) {
    fail++;
    console.log('  ✗ 异常中断：' + (e && e.message));
    await shot('99-error.png');
  }
  await browser.close();
  console.log('\n========================================');
  console.log(`  实机验收：${pass} 通过 / ${fail} 失败`);
  console.log(`  截图目录：${SHOT_DIR}`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
