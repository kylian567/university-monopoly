'use strict';
// v7.6 浏览器实机验收：
//   [1] 版本号 v7.6（index.html）＋ 客户端 EFFECT_CARDS 镜像 42 张 + mode/rare 分布 + 42 个专属 cg- 动画类
//   [2] 「时机询问」浮层真实可点（.tq-layer pointer-events:auto → 点「发动」真的发出 answerTiming）
//   [3] 卡牌专属发动特效（cardActFx：专属 glyph + cg- 运动类，播完自动收场）
//   [4] 对决平局重投横幅（duel_tie → duelTieAnim → ⚔️ 平局！公告）
//   [5] 免费轮 / 免租轮上墙（client 源码级：frRounds / roundNote / fac-badge-round / 详情面板数组渲染）
//   [6] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）
//   [7] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v76shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    // 让对局容器可见（#fxLayer 在 #game 之内，大厅阶段它是 display:none，浮层会 0×0 点不到）
    await page.evaluate(() => {
      try {
        const hide = id => { const e = document.querySelector(id); if (e) e.style.display = 'none'; };
        hide('#announce'); hide('#intro'); hide('#rules');
        const lo = document.querySelector('#lobby'); if (lo) lo.style.display = 'none';
        const g = document.querySelector('#game'); if (g) g.style.display = 'flex';
      } catch (e) {}
    });
    await page.evaluate(() => { try { speed = 0.14; } catch (e) {} });

    // ---------- [1] 版本号 + 客户端卡池镜像 + 专属动画类 ----------
    console.log('\n[1] 版本号 v7.6 + 客户端 EFFECT_CARDS 镜像 42 张 + 42 个 cg- 动画类');
    const htmlTxt = await page.evaluate(() => document.documentElement.outerHTML);
    ok(/v7\.6/.test(htmlTxt), 'index.html 含 v7.6 版本号');
    const C = await page.evaluate(() => {
      if (typeof EFFECT_CARDS === 'undefined') return null;
      const mode = {}, rare = {};
      for (const c of EFFECT_CARDS) { mode[c.mode] = (mode[c.mode] || 0) + 1; rare[c.rare] = (rare[c.rare] || 0) + 1; }
      const byId = id => (EFFECT_CARDS.find(x => x.id === id) || {});
      return {
        n: EFFECT_CARDS.length, mode, rare,
        jokerSSR: byId('joker').rare === 'SSR' && byId('joker').mode === 'ask',
        new8: ['nanman', 'arrowrain', 'leroi', 'graincut', 'fireattack', 'alliance', 'swapReaction', 'swapSplit'].every(id => !!byId(id).name),
        duel: byId('challenge').name === '决斗',
      };
    });
    ok(!!C, '客户端 EFFECT_CARDS 已加载');
    ok(C && C.n === 42, `客户端卡池 ${C ? C.n : 0} 张（v7.6 期望 42）`);
    ok(C && C.mode.auto === 13 && C.mode.ask === 7 && C.mode.instant === 2 && C.mode.manual === 18 && C.mode.reactive === 2,
      `mode 分布 13/7/2/18/2（实际 ${C ? [C.mode.auto, C.mode.ask, C.mode.instant, C.mode.manual, C.mode.reactive].join('/') : '-'}）`);
    ok(C && C.rare.SSR === 12 && C.rare.SR === 13 && C.rare.R === 14 && C.rare.N === 3,
      `rare 分布 12/13/14/3（实际 ${C ? [C.rare.SSR, C.rare.SR, C.rare.R, C.rare.N].join('/') : '-'}）`);
    ok(C && C.jokerSSR, '万能卡 = SSR + ask（主动询问）');
    ok(C && C.new8, '8 张新卡全部入池');
    ok(C && C.duel, '强制挑战令已改名「决斗」');
    // 42 个专属动画类（CSS 侧）
    const cssTxt = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
    const cgRules = new Set((cssTxt.match(/\.cg-([A-Za-z]+)\s*\{/g) || []).map(s => s.replace(/[^a-z]/gi, '')));
    const cliSrc = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
    const fxCodes = (cliSrc.match(/pre:\s*'([^']+)'/g) || []).map(s => s.replace(/[^a-z]/gi, ''));
    ok(new Set(fxCodes).size === 42, `CARD_FX 专属 pre 共 ${new Set(fxCodes).size} 个（期望 42）`);
    ok(cgRules.size >= 42, `style.css 的 .cg- 动画类共 ${cgRules.size} 个（期望 ≥42）`);
    ok(/\.tq-layer \{[^}]*pointer-events:\s*auto/.test(cssTxt), 'CSS 上 .tq-layer 已声明 pointer-events:auto');
    await shot(page, '10-lobby.png');

    // ---------- [2] 时机询问浮层真实可点 ----------
    console.log('\n[2] 「时机询问」浮层：真实可点（v7.6 新增交互）');
    await page.evaluate(() => {
      window.__sent = [];
      try {   // 拦截 ws 出站帧（act 是 const 箭头函数，闭包绑定改不了，只能拦 socket）
        if (typeof ws !== 'undefined' && ws && ws.send) {
          const _s = ws.send.bind(ws);
          ws.send = m => { try { window.__sent.push(typeof m === 'string' ? m : String(m)); } catch (e) {} return _s(m); };
        }
      } catch (e) {}
      S = {
        players: [{ id: 'a', name: '甲', color: '#f00', pos: 5, cash: 10000, joker: 0, hand: [{ uid: 's1', id: 'step' }] }],
        phase: 'ask', round: 12, hostId: 'a',
        pendingAsk: { pid: 'a', card: 'step', payload: { atype: 'roll', detail: '本回合点数 9' }, ms: 15000 },
      };
      myPid = 'a';
      try { askSync(); } catch (e) { window.__tqErr = e.message; }
    });
    await sleep(700);
    const tq = await page.evaluate(() => {
      const d = document.querySelector('.tq-layer');
      if (!d) return null;
      return {
        pe: getComputedStyle(d).pointerEvents,
        txt: (d.querySelector('.tq-q') || {}).textContent || '',
        sub: (d.querySelector('.tq-sub') || {}).textContent || '',
        hasYes: !!d.querySelector('#tqYes'), hasNo: !!d.querySelector('#tqNo'),
        rareCls: (d.className.match(/rar-\w+/) || [''])[0],
      };
    });
    ok(tq && !page.evaluateErr, '时机询问浮层已渲染');
    ok(tq && tq.pe === 'auto', `.tq-layer 计算样式 pointer-events = ${tq ? tq.pe : '-'}（挂在 #fxLayer 下必须显式 auto）`);
    ok(tq && /加速卡/.test(tq.txt), `文案按卡定制：「${tq ? tq.txt : '-'}」`);
    ok(tq && /点数 9/.test(tq.sub), '带上下文副文案（本回合点数 9）');
    ok(tq && tq.rareCls === 'rar-R', '品级配色类 rar-R（加速卡 = R）');
    let tqClicked = false;
    try { await page.click('#tqYes', { timeout: 5000 }); tqClicked = true; } catch (e) { tqClicked = false; }
    await sleep(300);
    const sent = await page.evaluate(() => (window.__sent || []).map(m => { try { return JSON.parse(m); } catch (e) { return null; } }).filter(Boolean));
    const ansMsg = sent.find(m => m.action && m.action.type === 'answerTiming');
    ok(tqClicked, 'Playwright 命中测试通过：「发动」按钮可以被真实点击');
    ok(!!ansMsg, `点击后经 ws 真的发出 answerTiming（实际 ${sent.map(m => m.action && m.action.type).filter(Boolean).join(',') || '-'}）`);
    ok(ansMsg && ansMsg.action.yes === true, '应答为 yes = true（发动并消耗这张卡）');
    ok(await page.evaluate(() => !document.querySelector('.tq-layer')), '点击后浮层收起');
    await shot(page, '2-ask-clickable.png');

    // ---------- [3] 卡牌专属发动特效 ----------
    console.log('\n[3] 卡牌专属发动特效（火攻 = 火焰 glyph + cg-flame）');
    const fx = await page.evaluate(async () => {
      try {
        const p = cardActFx({ pid: 'a', card: 'fireattack', rare: 'SSR', detail: '测试：烧地' });
        await new Promise(r => setTimeout(r, 700));
        const d = document.querySelector('.cfx-layer');
        const info = d ? {
          glyph: !!d.querySelector('.cfx-glyph'),
          cls: (d.querySelector('.cfx-glyph') || {}).className || '',
          glyphTxt: (d.querySelector('.cfx-glyph') || {}).textContent || '',
          faceTxt: (d.textContent || ''),
        } : null;
        await p;          // 等动画自然播完
        await new Promise(r => setTimeout(r, 600));
        return { info, gone: !document.querySelector('.cfx-layer') };
      } catch (e) { return { err: e.message }; }
    });
    if (fx && fx.err) {
      ok(false, 'cardActFx 抛错：' + fx.err);
    } else {
      ok(fx && fx.info && fx.info.glyph, '发动特效含专属 glyph 徽记');
      ok(fx && fx.info && /cg-flame/.test(fx.info.cls), `glyph 挂专属运动类（${fx && fx.info ? fx.info.cls : '-'}）`);
      ok(fx && fx.info && /火攻/.test(fx.info.faceTxt), '卡面（含卡名「火攻」）随特效上屏');
      ok(fx && fx.gone, '动画播完后浮层自动收场');
    }
    await shot(page, '3-card-fx.png');

    // ---------- [4] 对决平局重投横幅 ----------
    console.log('\n[4] 对决平局重投：duel_tie 演出 + 公告');
    const tie = await page.evaluate(async () => {
      try {
        ANIMATED.add('duel_tie');
        await duelTieAnim({ pid: 'a', opp: 'b', a: 3, b: 3, label: '辩论擂台', round: 1 });
        const ann = document.querySelector('#announceBox') || document.querySelector('.announce-tip');
        return { ok: true, annTxt: ann ? ann.textContent : (document.body.textContent.match(/平局[^」』]*/g) || []).join('|') };
      } catch (e) { return { err: e.message }; }
    });
    if (tie && tie.err) {
      ok(false, 'duelTieAnim 抛错：' + tie.err);
    } else {
      ok(tie && tie.ok, 'duelTieAnim 正常执行');
      ok(/平局/.test((tie && tie.annTxt) || ''), '公告/横幅含「平局」文案');
    }

    // ---------- [5] 免费轮 / 免租轮上墙（源码级） ----------
    console.log('\n[5] 免费轮 / 免租轮：中央徽章轮次行 + 详情面板数组渲染');
    ok(/frRounds/.test(cliSrc) && /frRentRounds/.test(cliSrc), 'renderFacultyBadge 读取快照 freeRounds / freeRentRounds');
    ok(/fac-badge-round/.test(cliSrc) && /fac-badge-round/.test(cssTxt), '徽章轮次行 .fac-badge-round（DOM 类 + CSS 样式齐备）');
    ok(/🎟️ 免费轮/.test(cliSrc) && /🕊️ 免租轮/.test(cliSrc), '轮次行文案「🎟️ 免费轮 第 X · Y 轮 / 🕊️ 免租轮 第 …轮」');
    ok(/S\.freeRounds && S\.freeRounds\.length/.test(cliSrc), '详情面板以数组渲染完整轮次');
    ok(/roundNote/.test(cliSrc) && /bhDraw/.test(cliSrc), '有轮次行时徽章自动加高（bhDraw）');

    // ---------- [6] 真实对局无报错 ----------
    console.log('\n[6] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p3.click('#btnAnnounce').catch(() => {}); await sleep(200);
    await p3.click('#btnIntro').catch(() => {}); await sleep(200);
    await p3.click('#btnRulesClose').catch(() => {});
    await sleep(200);
    await p3.fill('#nameInput', 'v76验收').catch(() => {});
    await p3.click('#btnCreate').catch(() => {}); await sleep(400);
    await p3.click('#btnAddAI').catch(() => {}); await sleep(300);
    await p3.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); });
    await sleep(600);
    await p3.click('#btnStart').catch(() => {});
    await p3.waitForSelector('.fac-layer.show', { timeout: 25000 }).catch(() => {});
    await sleep(1200);
    await p3.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    await sleep(6000);
    await p3.evaluate(() => { const b = document.querySelector('#btnTrust'); if (b) b.click(); });
    await sleep(12000);
    const alive = await p3.evaluate(() => (typeof S !== 'undefined' && S) ? { phase: S.phase, round: S.round } : null);
    ok(!!alive, `真实对局已推进（phase=${alive ? alive.phase : '-'} round=${alive ? alive.round : '-'}）`);
    await shot(p3, '50-real-game.png');
    await p3.close();

    // ---------- [7] 报错汇总 ----------
    console.log('\n[7] JS 报错检查');
    const real = errors.filter(e => !/favicon|ERR_|net::|Failed to load resource/i.test(e));
    ok(real.length === 0, `无 JS 报错${real.length ? '：' + real.slice(0, 4).join(' || ') : ''}`);
  } catch (err) {
    fail++;
    console.error('  ✗ 冒烟脚本异常：', err && err.message);
    console.error(err && err.stack);
  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log(`  v7.6 冒烟：${pass} 通过 / ${fail} 失败`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
