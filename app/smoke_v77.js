'use strict';
// v7.7 浏览器实机验收：
//   [1] 版本号 v7.7（index.html）＋ 客户端卡池 42 张 + 万箭齐发 / 火攻新描述
//   [2] 「万箭齐发」抉择浮层真实可点（.ch-layer pointer-events:auto → 点击真的发出 answerChoice）
//   [3] 抉择浮层内容：缴 ¥2200 / 自己挑地皮（含 Lv 提示）
//   [4] 引擎源码级：火攻最低层数 / 效果卡 6 张总量上限 / askChoice 原语
//   [5] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）
//   [6] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v77shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

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
    // 让对局容器可见（#fxLayer 在 #game 之内，大厅阶段 display:none，浮层会 0×0 点不到）
    await page.evaluate(() => {
      try {
        const hide = id => { const e = document.querySelector(id); if (e) e.style.display = 'none'; };
        hide('#announce'); hide('#intro'); hide('#rules');
        const lo = document.querySelector('#lobby'); if (lo) lo.style.display = 'none';
        const g = document.querySelector('#game'); if (g) g.style.display = 'flex';
      } catch (e) {}
    });
    await page.evaluate(() => { try { speed = 0.14; } catch (e) {} });

    // ---------- [1] 版本号 + 客户端卡池 + 新描述 ----------
    console.log('\n[1] 版本号 v7.7 + 客户端卡池 42 张 + 万箭齐发 / 火攻新描述');
    const htmlTxt = await page.evaluate(() => document.documentElement.outerHTML);
    ok(/v7\.7/.test(htmlTxt), 'index.html 含 v7.7 版本号');
    ok(/万箭齐发由受击方自己挑地皮拆/.test(htmlTxt), '开局公告含 v7.7 条目（万箭齐发受击方自选地皮）');
    ok(/只烧「房子最少」的地皮/.test(htmlTxt), '开局公告含 v7.7 条目（火攻只烧房子最少的地皮）');
    ok(/重复也算/.test(htmlTxt), '开局公告含 v7.7 条目（效果卡上限 6 张 · 重复也算）');
    const C = await page.evaluate(() => {
      if (typeof EFFECT_CARDS === 'undefined') return null;
      const byId = id => (EFFECT_CARDS.find(x => x.id === id) || {});
      return { n: EFFECT_CARDS.length, arrow: byId('arrowrain').desc || '', fire: byId('fireattack').desc || '' };
    });
    ok(C && C.n === 42, `客户端卡池 ${C ? C.n : 0} 张（期望 42）`);
    ok(C && /由受击方本人抉择/.test(C.arrow), '客户端万箭齐发描述已更新（受击方本人抉择）');
    ok(C && /房子最少的地皮/.test(C.fire) && /无房空地/.test(C.fire), '客户端火攻描述已更新（优先无房 → 最低层数）');
    await shot(page, '10-lobby.png');

    // ---------- [2] 抉择浮层真实可点 ----------
    console.log('\n[2] 万箭齐发抉择浮层：渲染 + 真实可点（v7.7 新增交互）');
    await page.evaluate(() => {
      window.__sent = [];
      try {   // 拦截 ws 出站帧（act 是 const 箭头函数，闭包绑定改不了，只能拦 socket）
        if (typeof ws !== 'undefined' && ws && ws.send) {
          const _s = ws.send.bind(ws);
          ws.send = m => { try { window.__sent.push(typeof m === 'string' ? m : String(m)); } catch (e) {} return _s(m); };
        }
      } catch (e) {}
      S = {
        players: [{ id: 'a', name: '甲', color: '#f00', pos: 5, cash: 5000, hand: [] }],
        cells: [],
        phase: 'choice', round: 12, hostId: 'a',
        pendingChoice: {
          pid: 'a', kind: 'arrowrain', ms: 15000,
          title: '🏹 乙 发动了「万箭齐发」',
          desc: '你可以缴 ¥2200 了事，也可以自己挑一块地皮拆掉',
          options: [
            { key: 'pay', label: '缴 ¥2200', hint: '现有现金 ¥5000' },
            { key: 'land:1', label: '拆「华中科大」', hint: '无房' },
            { key: 'land:6', label: '拆「浙江大学」', hint: 'Lv1' },
          ],
        },
      };
      myPid = 'a';
      try { choiceSync(); } catch (e) { window.__chErr = e.message; }
    });
    await sleep(700);
    const ch = await page.evaluate(() => {
      const d = document.querySelector('.ch-layer');
      if (!d) return null;
      const btns = Array.from(d.querySelectorAll('.ch-btn')).map(b => b.dataset.key);
      return {
        pe: getComputedStyle(d).pointerEvents,
        title: (d.querySelector('.ch-title') || {}).textContent || '',
        desc: (d.querySelector('.ch-desc') || {}).textContent || '',
        btns, txt: d.textContent || '',
        err: window.__chErr || '',
      };
    });
    ok(ch && !ch.err, `抉择浮层已渲染${ch && ch.err ? '（err=' + ch.err + '）' : ''}`);
    ok(ch && ch.pe === 'auto', `.ch-layer 计算样式 pointer-events = ${ch ? ch.pe : '-'}（#fxLayer 下必须显式 auto）`);
    ok(ch && /万箭齐发/.test(ch.title), `标题含「万箭齐发」：「${ch ? ch.title : '-'}」`);
    ok(ch && /自己挑一块地皮拆掉/.test(ch.desc), '说明文案：可缴钱也可自己挑地皮');
    ok(ch && ch.btns.join(',') === 'pay,land:1,land:6', `选项按序渲染（${ch ? ch.btns.join(',') : '-'}）`);
    ok(ch && /无房/.test(ch.txt) && /Lv1/.test(ch.txt), '地皮带层数提示（无房 / Lv1）');
    let clicked = false;
    try { await page.click('.ch-btn[data-key="land:6"]', { timeout: 5000 }); clicked = true; } catch (e) { clicked = false; }
    await sleep(300);
    const sent = await page.evaluate(() => (window.__sent || []).map(m => { try { return JSON.parse(m); } catch (e) { return null; } }).filter(Boolean));
    const ansMsg = sent.find(m => m.action && m.action.type === 'answerChoice');
    ok(clicked, 'Playwright 命中测试通过：地皮选项可以被真实点击');
    ok(!!ansMsg, `点击后经 ws 真的发出 answerChoice（实际 ${sent.map(m => m.action && m.action.type).filter(Boolean).join(',') || '-'}）`);
    ok(ansMsg && ansMsg.action.key === 'land:6', '应答带上被点中的地皮 key（land:6）');
    ok(await page.evaluate(() => !document.querySelector('.ch-layer')), '点击后浮层收起');
    await shot(page, '2-choice-clickable.png');

    // ---------- [3] 现金不足时的纯拆地形态 ----------
    console.log('\n[3] 现金不足 ¥2200：只给拆地选项（无 pay）');
    await page.evaluate(() => {
      S.phase = 'choice';
      S.pendingChoice = {
        pid: 'a', kind: 'arrowrain', ms: 15000,
        title: '🏹 乙 发动了「万箭齐发」',
        desc: '你的现金不足 ¥2200，必须自己挑一块地皮拆掉',
        options: [{ key: 'land:1', label: '拆「华中科大」', hint: '无房' }, { key: 'land:6', label: '拆「浙江大学」', hint: '无房' }],
      };
      try { choiceSync(); } catch (e) { window.__chErr2 = e.message; }
    });
    await sleep(500);
    const ch2 = await page.evaluate(() => {
      const d = document.querySelector('.ch-layer');
      if (!d) return null;
      return { btns: Array.from(d.querySelectorAll('.ch-btn')).map(b => b.dataset.key), desc: (d.querySelector('.ch-desc') || {}).textContent || '' };
    });
    ok(ch2 && ch2.btns.length === 2 && !ch2.btns.includes('pay'), `只有地皮选项（${ch2 ? ch2.btns.join(',') : '-'}）`);
    ok(ch2 && /必须自己挑一块地皮拆掉/.test(ch2.desc), '文案说明「必须拆地」');
    await page.evaluate(() => { const d = document.querySelector('.ch-layer'); if (d) d.remove(); });

    // ---------- [4] 引擎源码级 ----------
    console.log('\n[4] 引擎源码：火攻最低层数 / 效果卡 6 张总量上限 / askChoice 原语');
    const gj = src('game.js');
    ok(/const minLv = Math\.min\.apply\(null, cells\.map\(i => this\.cells\[i\]\.level \|\| 0\)\);/.test(gj), '火攻：先取目标名下最小层数 minLv');
    ok(/const pool = cells\.filter\(i => \(this\.cells\[i\]\.level \|\| 0\) === minLv\);/.test(gj), '火攻：只在最低层数的地皮里选（无房优先）');
    ok(/if \(SLOT_CARDS\.has\(card\.id\) && this\.heldCardCount\(p\) >= HAND_CAP\)/.test(gj), '效果卡闸门：占位卡 + 总量 ≥ 6 → 退回');
    ok(/heldCardCount\(p\) \{ return this\.heldCardList\(p\)\.length; \}/.test(gj), 'heldCardCount = 手牌 + 计数器（同名多张按张数计）');
    ok(/const SLOT_CARDS = new Set\(EFFECT_CARDS\.map/.test(gj) && /const INSTANT_CARDS = new Set\(\['cash', 'charity'/.test(gj), 'SLOT_CARDS / INSTANT_CARDS 已定义（即时型不占位）');
    ok(/askChoice\(p, payload, onPick\) \{/.test(gj) && /answerChoiceBy\(p, key\) \{/.test(gj) && /aiChoice\(p\) \{/.test(gj), 'askChoice / answerChoiceBy / aiChoice 原语齐备');
    ok(/arrowRainFlow\(attacker, victims, done\)/.test(gj) && /this\.askChoice\(q, this\.arrowChoicePayload\(attacker, q, lands, canPay\)/.test(gj),
      '万箭齐发改为逐人 askChoice（受击方本人抉择）');
    const sv = src('server.js');
    ok(/case 'answerChoice': room\.answerChoiceBy\(p, a\.key\); break;/.test(sv), 'server.js 路由 answerChoice');
    ok(/pendingChoice: room\.pendingChoice \?/.test(sv), 'server.js 快照下发 pendingChoice');
    const css = src('public/style.css');
    ok(/\.ch-layer \{[^}]*pointer-events:\s*auto/.test(css), '.ch-layer CSS 显式 pointer-events:auto');
    const cj = src('public/client.js');
    ok(/function choiceSync\(\)/.test(cj) && /choiceSync\(\);/.test(cj), 'client.js choiceSync 已挂进渲染循环');

    // ---------- [5] 真实对局 ----------
    console.log('\n[5] 真实对局：开局 → 推选 → 若干轮');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p3.click('#btnAnnounce').catch(() => {}); await sleep(200);
    await p3.click('#btnIntro').catch(() => {}); await sleep(200);
    await p3.click('#btnRulesClose').catch(() => {}); await sleep(200);
    await p3.fill('#nameInput', 'v77验收').catch(() => {});
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
    await shot(p3, '3-real-game.png');
    await p3.close();

    // ---------- [6] JS 报错 ----------
    console.log('\n[6] JS 报错检查');
    ok(errors.length === 0, `无 JS 报错${errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    fail++; console.log('  ✗ 冒烟异常：' + e.message);
  } finally {
    await browser.close();
  }

  console.log(`\n========================================\n  v7.7 冒烟：${pass} 通过 / ${fail} 失败\n========================================\n`);
  process.exit(fail ? 1 : 0);
})();
