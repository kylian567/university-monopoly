'use strict';
// v7.3 浏览器实机验收：
//   [1] 客户端 FACULTY 镜像：74 个城邦（新增 14）+ 关键文案（悬赏 ×1.2 / 连锁地皮与房子 / 不出现 N2·N11）
//   [2] 中期突变三风格抽卡大屏：.mut-card ×3，路径 0/1/2 分别落定 general / buff / nerf（三种风格类名互不相同）
//   [3] 新城邦演出：变异体基因突变 / 轮盘 8 格 / 黑天鹅分屏 / 大乐透三筒 / 幻影地块 / 手牌上限
//   [4] CSS 关键帧齐备
//   [5] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v73shots';

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
    await page.evaluate(() => { try { const i = document.querySelector('#intro'); if (i) i.style.display = 'none'; } catch (e) {} });
    // 加速动画（sp 会乘 speed）
    await page.evaluate(() => { try { speed = 0.14; } catch (e) {} });

    // ---------- [1] 客户端镜像 ----------
    console.log('\n[1] 客户端 FACULTY 镜像（74 个城邦）');
    const F = await page.evaluate(() => {
      if (typeof FACULTY === 'undefined') return null;
      const g = k => (FACULTY[k] || {});
      const NEW = ['roulette', 'jackpot', 'blackswan', 'phantom', 'inflation', 'deflation', 'league', 'bounty', 'chain', 'credit', 'shopping', 'mimic', 'weatherlab', 'mutant'];
      return {
        n: Object.keys(FACULTY).length,
        missing: NEW.filter(k => !FACULTY[k]),
        bounty: [g('bounty').lead, g('bounty').cost].join(' | '),
        chain: [g('chain').lead, g('chain').cost].join(' | '),
        all: Object.keys(FACULTY).join(','),
        rouletteLead: g('roulette').lead,
        mimicLead: g('mimic').lead,
      };
    });
    ok(!!F, '客户端 FACULTY 已加载');
    ok(F && F.n === 74, `城邦总数 ${F ? F.n : 0} 个（v7.3 期望 74）`);
    ok(F && F.missing.length === 0, `14 个新城邦全部到场${F && F.missing.length ? '（缺 ' + F.missing.join(',') + '）' : ''}`);
    ok(/×1\.2/.test(F.bounty) && !/×1\.6/.test(F.bounty), `悬赏降到 ×1.2：${F.bounty.slice(0, 40)}…`);
    ok(/总资产最高/.test(F.bounty), '悬赏：校霸 = 总资产最高者（文案）');
    ok(/地皮与房子/.test(F.chain), `连锁：地皮与房子一起变：${F.chain.slice(0, 40)}…`);
    ok(!/拍卖|时间静止/.test(F.all), '未出现 N2 强制拍卖 / N11 时间静止');

    // 关键函数与样式
    const has = await page.evaluate(() => ({
      anims: ['mutationDrawAnim', 'facultyMutateAnim', 'rouletteAnim', 'blackswanAnim', 'jackpotAnim', 'phantomAnim', 'handFullAnim', 'loanAnim']
        .filter(n => typeof window[n] !== 'function'),
      mutStyle: typeof MUT_STYLE === 'object' && MUT_STYLE.general && MUT_STYLE.buff && MUT_STYLE.nerf,
      css: (() => {
        const t = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
        return ['v73Quake', 'v73CardWin', 'v73Up', 'v73Down', 'v73Swirl', 'v73Helix', 'v73ReelWin', 'v73MutBg']
          .filter(k => !t.includes(k));
      })(),
    }));
    ok(has.anims.length === 0, `8 个新动画函数均已定义${has.anims.length ? '（缺 ' + has.anims.join(',') + '）' : ''}`);
    ok(has.mutStyle, 'MUT_STYLE 三风格表就位（general / buff / nerf）');
    ok(has.css.length === 0, `CSS 关键帧齐备${has.css.length ? '（缺 ' + has.css.join(',') + '）' : ''}`);
    await shot(page, '10-lobby.png');

    // ---------- [2] 突变三风格抽卡 ----------
    console.log('\n[2] 中期突变：三风格抽卡大屏（0 通用 / 1 强化 / 2 反转）');
    const OPTS = [
      { kind: 'general', label: '通用池', sub: '世界级随机事件', icon: '🌀' },
      { kind: 'buff', label: '专属强化', sub: '都市校区 · 强化', icon: '⬆️' },
      { kind: 'nerf', label: '专属反转', sub: '都市校区 · 反转', icon: '⬇️' },
    ];
    for (const [p, kind] of [[0, 'general'], [1, 'buff'], [2, 'nerf']]) {
      await page.evaluate(([pp, oo]) => {
        window.__mutDone = false;
        mutationDrawAnim({ path: pp, name: '测试突变·' + pp, desc: '这是本次突变的效果描述', facName: '都市校区', options: oo }).then(() => { window.__mutDone = true; });
      }, [p, OPTS]);
      await sleep(500);
      const mid = await page.evaluate(() => {
        const d = document.querySelector('.mut-layer');
        if (!d) return null;
        return {
          cards: d.querySelectorAll('.mut-card').length,
          kinds: [...d.querySelectorAll('.mut-card')].map(c => c.dataset.kind).join(','),
          classes: [...d.querySelectorAll('.mut-card')].map(c => c.className).join('|'),
          scan: !!d.querySelector('.mut-scanner'),
          panel: !!d.querySelector('.mut-panel'),
        };
      });
      ok(mid && mid.cards === 3, `路径 ${p}：三张路径卡（实际 ${mid ? mid.cards : 0}）`);
      ok(mid && mid.kinds === 'general,buff,nerf', `路径 ${p}：三路顺序 ${mid ? mid.kinds : '-'}`);
      ok(mid && /c-general/.test(mid.classes) && /c-buff/.test(mid.classes) && /c-nerf/.test(mid.classes), `路径 ${p}：三种风格类名互不相同`);
      ok(mid && mid.scan && mid.panel, `路径 ${p}：扫描指针 + 面板就位`);
      await shot(page, `2${p}-mut-mid-${kind}.png`);

      await page.waitForFunction(() => window.__mutDone === true, { timeout: 20000 }).catch(() => {});
      const end = await page.evaluate(() => {
        const d = document.querySelector('.mut-layer');
        if (!d) return { gone: true };
        const w = d.querySelector('.mut-card.win');
        const r = d.querySelector('.mut-result');
        return {
          gone: false,
          win: w ? w.dataset.kind : null,
          landed: d.classList.contains('landed'),
          shown: r ? r.classList.contains('show') : false,
          name: r ? (r.querySelector('.mr-name') || {}).textContent : '',
          kind: r ? (r.querySelector('.mr-kind') || {}).textContent : '',
          hot: d.querySelectorAll('.mut-card.hot').length,
        };
      });
      ok(!end.gone && end.win === kind, `路径 ${p}：落定到 ${end.win}（期望 ${kind}）`);
      ok(!end.gone && end.landed && end.shown, `路径 ${p}：面板落定 + 结果区展开`);
      ok(!end.gone && /测试突变/.test(end.name || ''), `路径 ${p}：结果区显示突变名（${end.name}）`);
      await shot(page, `2${p}-mut-end-${kind}.png`);
      await sleep(1400);
      const cleared = await page.evaluate(() => !document.querySelector('.mut-layer'));
      ok(cleared, `路径 ${p}：演出结束后浮层已移除`);
    }

    // ---------- [3] 新城邦演出 ----------
    console.log('\n[3] 新城邦大屏演出');
    // 造一个最小对局状态桩：让 ownerName / playerCell 走真实解析路径
    await page.evaluate(() => {
      S = { players: [{ id: 'a', name: '甲', pos: 5, cash: 10000 }, { id: 'b', name: '乙', pos: 9, cash: 8000 }], phase: 'play', round: 4 };
    });
    const cases = [
      ['facultyMutateAnim', `facultyMutateAnim({ key:'cafe', name:'咖啡校区', icon:'☕', color:'#8B5A3C', round:4 })`, '.fmut-layer', '.fm-name', '咖啡校区'],
      ['rouletteAnim', `rouletteAnim({ round:1, idx:2, total:8, slots:[{icon:'🧧',name:'大红包',desc:'全场每人 +¥800'},{icon:'🧾',name:'罚单',desc:'全场每人 −¥500'},{icon:'🏠',name:'房东市场',desc:'本轮全场租金 ×1.5'},{icon:'🧊',name:'租金冻结',desc:'本轮全场租金 ×0.5'},{icon:'🌦️',name:'雨露均沾',desc:'全场每人 +¥400'},{icon:'📉',name:'尖子生',desc:'总资产最高者 −¥1200'},{icon:'🎓',name:'助学金',desc:'总资产最低者 +¥2000'},{icon:'💤',name:'空转',desc:'风平浪静'}] })`, '.rl-layer', '.rl-slot', null],
      ['blackswanAnim', `blackswanAnim({ round:6, losers:[{pid:'a',name:'甲'}], winners:[{pid:'b',name:'乙'}] })`, '.bs-layer', '.bs-row', null],
      ['jackpotAnim', `jackpotAnim({ pid:'a', round:10, amount:3600 })`, '.jp-layer', '.jp-reel', null],
    ];
    for (const [fn, call, sel, sub, needle] of cases) {
      await page.evaluate(c => { window.__d2 = false; eval(c).then(() => { window.__d2 = true; }); }, call);
      await sleep(500);
      const st2 = await page.evaluate(([s, sub2]) => {
        const d = document.querySelector(s);
        if (!d) return null;
        return { show: d.classList.contains('show'), rows: d.querySelectorAll(sub2).length };
      }, [sel, sub]);
      ok(st2 && st2.show && st2.rows > 0, `${fn}：浮层显示 + 元素 ${st2 ? st2.rows : 0} 个（${sel} / ${sub}）`);
      await shot(page, `3-${fn}.png`);
      await page.waitForFunction(() => window.__d2 === true, { timeout: 20000 }).catch(() => {});
      await sleep(1200);
      ok(await page.evaluate(s => !document.querySelector(s), sel), `${fn}：演出结束后已移除`);
    }

    // 幻影 / 手牌 / 借贷（轻量，不阻塞）
    const light = await page.evaluate(() => {
      const before = document.querySelectorAll('#fxLayer > *').length;
      try { phantomAnim({ round: 1, cells: [], names: ['测试地块'] }); } catch (e) { return { err: 'phantom: ' + e.message }; }
      try { handFullAnim({ pid: 'a', card: 'seize', name: '夺取卡', cap: 6 }); } catch (e) { return { err: 'handFull: ' + e.message }; }
      try { loanAnim({ pid: 'a', borrow: 2000, total: 2000 }); } catch (e) { return { err: 'loan: ' + e.message }; }
      return { ok: true, before, after: document.querySelectorAll('#fxLayer > *').length };
    });
    ok(!light.err, `幻影 / 手牌上限 / 借贷 三个轻量演出均可执行${light.err ? '（' + light.err + '）' : ''}`);
    await sleep(900);

    // ---------- [4] 服务端事件名对照 ----------
    console.log('\n[4] 客户端事件分发登记');
    const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    const need = ['mutation', 'faculty_mutate', 'roulette', 'blackswan', 'jackpot', 'phantom', 'hand_full', 'loan'];
    const miss = need.filter(t => !new RegExp(`case '${t}'`).test(cli));
    ok(miss.length === 0, `handleAnim 已登记全部新事件${miss.length ? '（缺 ' + miss.join(',') + '）' : ''}`);

    // ---------- [5] 真实对局无报错 ----------
    console.log('\n[5] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p3.click('#btnAnnounce').catch(() => {}); await sleep(200);
    await p3.click('#btnIntro').catch(() => {}); await sleep(200);
    await p3.click('#btnRulesClose').catch(() => {});
    await sleep(200);
    await p3.fill('#nameInput', 'v73验收').catch(() => {});
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
    await sleep(2500);
    const alive = await p3.evaluate(() => (typeof S !== 'undefined' && S) ? { phase: S.phase, round: S.round } : null);
    ok(!!alive, `真实对局已推进（phase=${alive ? alive.phase : '-'} round=${alive ? alive.round : '-'}）`);
    await shot(p3, '50-real-game.png');
    await p3.close();

    // ---------- [6] 报错汇总 ----------
    console.log('\n[6] JS 报错检查');
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
  console.log(`  v7.3 冒烟：${pass} 通过 / ${fail} 失败`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
