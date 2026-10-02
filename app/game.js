// 没事就玩大富翁 · 游戏引擎（服务器权威判定）
'use strict';

// ---------- 棋盘数据（大学主题 · 主路线 48 格 + 两条岔路各 7 格） ----------
const GROUPS = {
  g1:  { label: '棕',   color: '#A1887F', build: 1000, refRent: 230,  rents: [700, 1600, 3300, 6200] },
  g2:  { label: '浅蓝', color: '#90CAF9', build: 1400, refRent: 320,  rents: [950, 2200, 4600, 8600] },
  g3:  { label: '粉',   color: '#F48FB1', build: 1800, refRent: 410,  rents: [1250, 2900, 6000, 11200] },
  g4:  { label: '橙',   color: '#FFB74D', build: 2200, refRent: 500,  rents: [1500, 3500, 7300, 13700] },
  g5:  { label: '红',   color: '#E57373', build: 2600, refRent: 590,  rents: [1800, 4200, 8700, 16300] },
  g6:  { label: '黄',   color: '#FFE082', build: 3000, refRent: 680,  rents: [2100, 4900, 10100, 19000] },
  g7:  { label: '绿',   color: '#A5D6A7', build: 3400, refRent: 770,  rents: [2400, 5600, 11600, 21700] },
  g8:  { label: '青',   color: '#4DB6AC', build: 3800, refRent: 860,  rents: [2700, 6300, 13100, 24500] },
  g9:  { label: '深蓝', color: '#9FA8DA', build: 4200, refRent: 980,  rents: [3100, 7200, 14900, 27900] },
  g10: { label: '紫',   color: '#B39DDB', build: 4800, refRent: 1100, rents: [3500, 8100, 16800, 31500] },
};
const PCOLOR = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#8E24AA']; // 玩家棋子色（最多 5 人）

// type: start/fate/chance/tax/transport/jail/parking/gojail/prop/util/duel/junction/junction2
function P(name, g, price, rent) { return { name, type: 'prop', g, price, rent }; }
// 30 所中国高校：2026 QS 世界排名「中国（内地 + 香港大学）」前 28 + 西北农林科技大学 + 长安大学
// 价格按 QS 档次从低到高沿棋盘排列，档内每所价格与租金都不同
// 名次（全球）：香港大学11 · 北大14 · 清华17 · 复旦30 · 上交47 · 浙大49 · 南大103 · 中科大132 · 同济177
//             武大186 · 北师大247 · 哈工大256 · 天大257 · 北理工259 · 中山276 · 西交305 · 华科319
//             川大324 · 山大339 · 厦大341 · 南科大343 · 南开355 · 国科大362 · 华南理工377 · 北航388
//             东南392 · 华东师大433 · 深圳大学452 ｜ 附加：西北农林科技(801-850) · 长安大学
const BOARD = [
  { name: '起点', type: 'start' },                         //0
  P('华中科大', 'g5', 2100, 560),                               //1
  P('山东大学', 'g4', 1900, 500),                               //2
  { name: '命运', type: 'fate' },                          //3
  { name: '缴学费', type: 'tax', amount: 900 },             //4
  { name: '浦东机场', type: 'transport', price: 2000 },  //5
  P('浙江大学', 'g9', 3450, 900),                               //6
  P('厦门大学', 'g4', 1800, 470),                               //7
  { name: '机会', type: 'chance' },                        //8
  P('北航', 'g2', 1300, 320),                                 //9
  P('北京理工', 'g6', 2400, 650),                               //10（与北理工互换）
  P('中山大学', 'g6', 2300, 620),                               //11
  { name: '文印店', type: 'util', price: 1500 },            //12
  P('香港大学', 'g10', 3900, 1020),                             //13
  P('四川大学', 'g5', 2000, 530),                               //14
  { name: '白云机场', type: 'transport', price: 2000 },  //15
  P('西北农林', 'g1', 900, 205),                                //16
  { name: '命运', type: 'fate' },                          //17
  P('南京大学', 'g8', 3300, 860),                               //18
  P('南开大学', 'g3', 1600, 410),                               //19
  { name: '长廊入口', type: 'junction' },                //20（岔路入口：持有 ≥2 块地皮可进·与教育基金会互换）
  P('东南大学', 'g2', 1200, 290),                               //21
  { name: '机会', type: 'chance' },                        //22
  P('北京大学', 'g10', 4050, 1060),                             //23
  P('中科大', 'g8', 3150, 830),                                //24
  { name: '宝安机场', type: 'transport', price: 2000 },  //25
  P('天津大学', 'g6', 2500, 680),                               //26
  P('华东师大', 'g2', 1100, 260),                               //27
  { name: '教育基金会', type: 'parking' },                   //28（走到领走基金池·与长廊入口互换）
  P('华南理工', 'g3', 1400, 350),                               //29
  { name: '挂科留级', type: 'gojail' },                     //30（原入狱）
  P('深圳大学', 'g1', 1000, 230),                               //31
  P('北师大', 'g7', 2700, 740),                                //32
  P('同济大学', 'g8', 3000, 800),                               //33
  P('武汉大学', 'g7', 2850, 770),                               //34
  { name: '大兴机场', type: 'transport', price: 2000 },  //35
  { name: '大道入口', type: 'junction2' },               //36（原大道入口）
  P('南科大', 'g4', 1700, 440),                                //37
  { name: '快递驿站', type: 'util', price: 1500 },           //38
  { name: '校园商城', type: 'jail' },                       //39（免费领「免租金卡」·与北理工互换）
  P('清华大学', 'g10', 4200, 1100),                             //40
  P('国科大', 'g3', 1500, 380),                                //41
  P('上海交大', 'g9', 3600, 940),                               //42
  P('长安大学', 'g1', 800, 180),                                //43
  { name: '辩论擂台', type: 'duel' },                        //44（原擂台）
  P('西安交大', 'g5', 2200, 590),                               //45
  P('复旦大学', 'g9', 3750, 980),                               //46
  P('哈工大', 'g7', 2600, 710),                                //47
];

// ---------- 学术长廊（48~54 号格，7 格） ----------
// 入口：20 号「长廊入口」（持有 ≥2 块地皮）；出口 54「校史馆」领 2 张免租金卡但停留 2 回合，之后沿主路线继续（54 → 28 教育基金会）。
const BRANCH = { START: 48, EXIT: 54, EXIT_TO: 28, JUNCTION: 20, NEED: 2 };
const BRANCH_CELLS = [
  { name: '科研基金处', type: 'invest', desc: '花 ¥2000 立项，2 轮后结题返还 ¥3600' },
  { name: '教授工作室', type: 'advisor', desc: '教授心情随机：请喝咖啡 +¥1500 / 抓去搬设备 -¥1000' },
  { name: '校庆礼品屋', type: 'shop', desc: '随机送一件道具' },
  { name: '奖学金长廊', type: 'ginkgo', desc: '下回合移动 +3' },
  { name: '杰出校友厅', type: 'hall', desc: '领取教育基金池 25% 分红（至少 ¥600）' },
  { name: '通宵自习室', type: 'study', desc: '闭关一回合，奖学金 +¥2500' },
  { name: '校史馆', type: 'exit', desc: '领 2 张免租金卡（可保留），但要在校史馆学习 2 回合' },
];
BOARD.push(...BRANCH_CELLS);

// ---------- 创业大道（55~61 号格，7 格） ----------
// 入口：36 号「大道入口」（无门槛）；出口 61「校企合作中心」领 ¥2500 但停留 2 回合，之后沿主路线继续（61 → 39 校园商城）。
const BRANCH2 = { START: 55, EXIT: 61, EXIT_TO: 39, JUNCTION: 36 };
const BRANCH2_CELLS = [
  { name: '创业孵化器', type: 'startup', desc: '投 ¥2000 路演：40% 成功返 ¥6000，失败打水漂' },
  { name: '毕业跳蚤市场', type: 'market', desc: '摆摊随机：好物 +¥3000 / 出清 +¥1000 / 假货 -¥600' },
  { name: '校园运动会', type: 'arena', desc: '挑战总资产首富：赢了拿 ¥2000，输了赔 ¥1500' },
  { name: '国际交流站', type: 'exchange', desc: '花 ¥1200 报名交换项目：70% 拿到 ¥4000 奖学金' },
  { name: '创业基金厅', type: 'hall', desc: '领取教育基金池 25% 分红（至少 ¥600）' },
  { name: '实习直通车', type: 'study', desc: '实习一回合，补贴 +¥2500' },
  { name: '校企合作中心', type: 'exit2', desc: '领取 ¥2500 现金，但要在里面学习 2 回合' },
];
BOARD.push(...BRANCH2_CELLS);

// ---------- v4.0 / v5.0 全局机制常量 ----------
const FUND_CAP = 30000;        // 教育基金池上限：超过部分直接均分给全体玩家
const ENDGAME_ROUND = 15;      // 终局「经济寒冬」：第 15 轮起银行停发工资
const REROLL_COST = 1200;      // 重掷骰：掷骰后花 ¥1200 重投一次
const FUND_SHARE = 1 / 3;      // v5.0：重掷/免罚符的花费有 1/3 进入教育基金池

// ---------- 市场周期（季节） / 天气 / 校历事件 ----------
// 季节由每轮开局的"市场骰"决定：1-2 淡季 / 3-4 平季 / 5-6 旺季，并带惯性（旺者更旺、淡者更淡）。
// 关键设计：季节双向影响价格——淡季收租低但扩张便宜，旺季收租高但扩张也贵，形成"低谷囤地、高峰收割"的循环。
const SEASON = {
  low:  { key: 'low',  name: '淡季', icon: '🍂', rentMul: 0.85, buildMul: 0.9, color: '#378ADD' },
  mid:  { key: 'mid',  name: '平季', icon: '🌤️', rentMul: 1.0, buildMul: 1.0, color: '#888780' },
  high: { key: 'high', name: '旺季', icon: '🔥', rentMul: 1.15, buildMul: 1.1, color: '#BA7517' },
};
const SEASON_ORDER = ['low', 'mid', 'high'];
const WEATHER = {
  sun:   { key: 'sun',   name: '晴天', icon: '☀️', diceMod: 1 },
  cloud: { key: 'cloud', name: '阴天', icon: '☁️', diceMod: 0 },
  rain:  { key: 'rain',  name: '雨天', icon: '🌧️', diceMod: -1 },
  storm: { key: 'storm', name: '台风', icon: '🌪️', diceMod: 0, rentMul: 0.7 },
};
const CALEVENTS = [
  { id: 'term',      name: '开学季',   icon: '🎒', desc: '全体领取助学金 ¥1500', kind: 'moneyAll', amount: 1500 },
  { id: 'exam',      name: '考试周',   icon: '📚', desc: '本回合所有玩家移动 -2', kind: 'slow', steps: -2 },
  { id: 'anniv',     name: '校庆周',   icon: '🎉', desc: '本回合全场租金 ×1.5', kind: 'rentUp', mul: 1.5 },
  { id: 'grad',      name: '毕业季',   icon: '🎓', desc: '本回合全场租金 -50%', kind: 'rentDown', mul: 0.5 },
  { id: 'midautumn', name: '中秋节',   icon: '🥮', desc: '学校发月饼礼盒：全体 +¥800', kind: 'moneyAll', amount: 800 },
  { id: 'double11',  name: '双十一',   icon: '🛒', desc: '忍不住剁手：全体各缴 ¥600 进教育基金池', kind: 'payAll', amount: 600 },
  { id: 'sports',    name: '校运会',   icon: '🏃', desc: '本回合全体移动 +2', kind: 'fast', steps: 2 },
  { id: 'national',  name: '国庆假期', icon: '🇨🇳', desc: '消费补贴：现金不足 ¥8000 的玩家各得 ¥2000', kind: 'bailout', low: 8000, amount: 2000 },
  { id: 'cherry',    name: '樱花季',   icon: '🌸', desc: '游客如织：本回合全场租金 ×1.25', kind: 'rentUp', mul: 1.25 },
  { id: 'thesis',    name: '毕业论文季', icon: '📄', desc: '查重、打印、答辩：全体各缴 ¥400', kind: 'payAll', amount: 400 },
  { id: 'alumni',    name: '校友返校日', icon: '🤝', desc: '最富的玩家向教育基金池捐赠 ¥2000', kind: 'richTax', amount: 2000 },
  { id: 'newbie',    name: '迎新季',   icon: '🌱', desc: '现金最少的玩家获助学金 ¥2500', kind: 'poorBonus', amount: 2500 },
  { id: 'rebuild',   name: '校园改造季', icon: '🚧', desc: '本回合盖房费用 ×0.7', kind: 'buildSale', mul: 0.7 },
  { id: 'rainy',     name: '梅雨季节', icon: '☔', desc: '阴雨绵绵：本回合全体移动 -1，租金 -25%', kind: 'rainy', steps: -1, mul: 0.75 },
];

// ---------- 专业身份（开局选择，人机同样可选；技能自动发动、有次数上限） ----------
const MAJORS = {
  cs:   { id: 'cs',   name: '计算机', icon: '💻', skill: '算法优化', desc: '掷骰不足 7 点时自动重掷取更优', uses: 3 },
  med:  { id: 'med',  name: '医学',   icon: '🩺', skill: '妙手回春', desc: '被收租 ≥¥1000 时自动减免 40%', uses: 3 },
  news: { id: 'news', name: '新闻',   icon: '📰', skill: '独家爆料', desc: '抽到负面卡时自动重抽一次', uses: 3 },
  econ: { id: 'econ', name: '经管',   icon: '📈', skill: '资本运作', desc: '单笔收租 ≥¥1500 时自动 +50%', uses: 3 },
  arch: { id: 'arch', name: '建筑',   icon: '🏗️', skill: '造价管理', desc: '升级房产时费用自动 -35%', uses: 3 },
  law:  { id: 'law',  name: '法学',   icon: '⚖️', skill: '法律援助', desc: '免疫 3 次不利判定（被拆地/拆房/损失地皮/入狱/陷害）', uses: 3 },
  ee:   { id: 'ee',   name: '微电子', icon: '🔌', skill: '信号增益', desc: '每次经过起点额外 +¥1000', uses: 3 },
  math: { id: 'math', name: '数学',   icon: '📐', skill: '精算砍价', desc: '买入地产时自动 8 折', uses: 3 },
  art:  { id: 'art',  name: '艺术',   icon: '🎨', skill: '灵感迸发', desc: '抽到正面机会卡时额外 +¥700', uses: 3 },
  bio:  { id: 'bio',  name: '生命科学', icon: '🧬', skill: '细胞增殖', desc: '回合开始时现金 +3%', uses: 3 },
  // ---- v5.0 新增 5 个专业 ----
  lang: { id: 'lang', name: '外国语', icon: '🌍', skill: '多语种优势', desc: '抽到正面机会卡时额外 +¥900', uses: 3 },
  pe:   { id: 'pe',   name: '体育',   icon: '🏀', skill: '体能优势', desc: '掷骰点数 ≤4 时自动多走 2 步', uses: 3 },
  phys: { id: 'phys', name: '物理',   icon: '⚛️', skill: '守恒定律', desc: '被收租 ≥¥1200 时自动减免 30%', uses: 3 },
  chem: { id: 'chem', name: '化学',   icon: '🧪', skill: '催化加成', desc: '单笔收租 ≥¥1000 时自动 +40%', uses: 3 },
  phil: { id: 'phil', name: '哲学',   icon: '🏛️', skill: '批判思维', desc: '免疫 2 次不利判定（被拆地/拆房/损失地皮/入狱/陷害）', uses: 2 },
  // ---- v5.0 第二批新增 8 个专业（共 23 种） ----
  agri:  { id: 'agri',  name: '农学',   icon: '🌾', skill: '春华秋实', desc: '每次经过起点额外 +¥1500', uses: 3 },
  drama: { id: 'drama', name: '戏剧',   icon: '🎭', skill: '全场入戏', desc: '抽到任意机会/命运卡时额外 +¥500', uses: 3 },
  mech:  { id: 'mech',  name: '机械',   icon: '⚙️', skill: '精益制造', desc: '升级房产时费用自动 -20%', uses: 3 },
  stat:  { id: 'stat',  name: '统计',   icon: '📊', skill: '数据洞察', desc: '掷骰点数 ≤5 时额外 +¥600', uses: 3 },
  aero:  { id: 'aero',  name: '航天',   icon: '🛰️', skill: '一飞冲天', desc: '进入岔路时额外 +¥1000', uses: 3 },
  fin:   { id: 'fin',   name: '金融',   icon: '💰', skill: '杠杆操作', desc: '抵押地产时多拿 30% 现金', uses: 3 },
  geol:  { id: 'geol',  name: '地质',   icon: '🗺️', skill: '勘探评估', desc: '买入无主地产时自动 9 折', uses: 3 },
  mil:   { id: 'mil',   name: '军事',   icon: '🎖️', skill: '战术压制', desc: '擂台对决时自己的点数 +1', uses: 3 },
};
const MAJOR_KEYS = ['cs', 'med', 'news', 'econ', 'arch', 'law', 'ee', 'math', 'art', 'bio', 'lang', 'pe', 'phys', 'chem', 'phil',
  'agri', 'drama', 'mech', 'stat', 'aero', 'fin', 'geol', 'mil'];

// ---------- 成就 ----------
const ACHS = {
  monopoly: { name: '包场王',   desc: '凑齐一个色组',        reward: 1500 },
  hotel:    { name: '五星酒店', desc: '建成第一座旅馆',      reward: 2000 },
  rent10k:  { name: '收租之王', desc: '单次收租破万',        reward: 1000 },
  tycoon:   { name: '地产大亨', desc: '同时拥有 8 块地产',   reward: 2000 },
  combo3:   { name: '三连收租', desc: '连续 3 次收租',       reward: 1200 },
  assassin: { name: '终结者',   desc: '送走一名对手',        reward: 2500 },
  richest:  { name: '校园首富', desc: '现金突破 ¥100000',    reward: 3000 },
};

// ---------- 掷骰前可购买的一次性道具（v4.0：幸运骰改为掷后付费重投，见 doReroll） ----------
const ITEMS = {
  shield: { id: 'shield', name: '免罚符', icon: '🛡️', desc: '本回合踩到他人地产免租，价格随轮数上涨' },
};

// ---------- 卡牌（30 机会 + 30 命运） ----------
// kind: money(+收/-付) / moveTo / move / each(每位玩家±) / skip / discount
const CHANCE = [
  { name: '神仙座位', desc: '抢到图书馆四楼靠窗座位，前进 3 格', kind: 'move', steps: 3 },
  { name: '教授的召唤', desc: '教授半夜发消息"明天来办公室一趟"——立即移动到「天津大学」', kind: 'moveTo', cell: 26, salary: false },
  { name: '科研经费到账', desc: '收 ¥2000', kind: 'money', amount: 2000 },
  { name: '国奖到账', desc: '国家奖学金发放，收 ¥5000', kind: 'money', amount: 5000 },
  { name: '抢课手速王', desc: '可立即以 8 折购入任意一块无主地产；放弃则收 ¥500 安慰奖', kind: 'discount' },
  { name: '抢到车票', desc: '直接移动到起点，领工资', kind: 'moveTo', cell: 0, salary: true },
  { name: '新窗口试吃', desc: '食堂新窗口开业请你试吃，每位玩家给你 ¥400', kind: 'each', amount: 400, dir: 'in' },
  { name: '拼单奶茶', desc: '拼单拼成"单王"，每位玩家给你 ¥300', kind: 'each', amount: 300, dir: 'in' },
  { name: '勤工俭学', desc: '助管工资到账，收 ¥1500', kind: 'money', amount: 1500 },
  { name: '体育满分', desc: '体测满分，收 ¥1400', kind: 'money', amount: 1400 },
  { name: '校友基金', desc: '校友捐赠抽奖抽中你，收 ¥3000', kind: 'money', amount: 3000 },
  { name: '书院下午茶', desc: '书院咖啡券到账，收 ¥850', kind: 'money', amount: 850 },
  { name: '单车爆胎', desc: '共享单车爆胎，后退 3 格', kind: 'move', steps: -3 },
  { name: '空调罢工', desc: '宿舍空调坏了，支付 ¥700 维修费', kind: 'money', amount: -700 },
  { name: '步数霸榜', desc: '微信运动全校第一，收 ¥1100', kind: 'money', amount: 1100 },
  { name: '赶飞机', desc: '立即移动到任意一个机场（不领工资）', kind: 'moveAnyTrans' },
  { name: '室友带饭', desc: '室友承包一个月饭卡——免租券：下次应付租金全免', kind: 'voucher' },
  { name: '论文接收', desc: '论文被顶刊接收，收 ¥4000', kind: 'money', amount: 4000 },
  { name: '阿姨手抖', desc: '食堂阿姨手不抖了，多打一勺红烧肉，心情大好，收 ¥400', kind: 'money', amount: 400 },
  { name: '二手书出清', desc: '期末摆摊卖教材，收 ¥1200', kind: 'money', amount: 1200 },
  { name: '顺风拼车', desc: '顺风车捎同学回本部，每位玩家付你 ¥550', kind: 'each', amount: 550, dir: 'in' },
  { name: '电竞校队', desc: '试训通过，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '问卷羊毛', desc: '填一下市场调研问卷，收 ¥700', kind: 'money', amount: 700 },
  { name: '坐过站了', desc: '机场摆渡车睡过头，后退 4 格', kind: 'move', steps: -4 },
  { name: '社团招新', desc: '摆摊招新，每位玩家付你 ¥400 摊位赞助费', kind: 'each', amount: 400, dir: 'in' },
  { name: '岁月静好', desc: '今天的校园：什么都没发生，岁月静好', kind: 'money', amount: 0 },
  { name: '助教加急', desc: '帮老师批改作业加急费，收 ¥1800', kind: 'money', amount: 1800 },
  { name: '拾金不昧', desc: '捡到钱包上交失物招领，失主酬谢 ¥2000', kind: 'money', amount: 2000 },
  { name: '毕业旅行考察', desc: '提前考察毕业旅行路线，前进 5 格', kind: 'move', steps: 5 },
  { name: '毕业典礼彩排', desc: '被抽中去毕业典礼彩排，立即移动到「武汉大学」', kind: 'moveTo', cell: 34, salary: false },
  { name: '悬赏令', desc: '发布悬赏：向当前最富有的玩家收取 ¥1500 赏金', kind: 'bounty', amount: 1500 },
  { name: '校友饭卡', desc: '校友回校请你吃饭，收 ¥1600', kind: 'money', amount: 1600 },
  { name: '抢到自习室', desc: '欧气爆棚抢到唯一位子，立即前进 4 格', kind: 'move', steps: 4 },
  // ---- 新增：负面为主 ----
  { name: '室友借笔记不还', desc: '借出去的笔记再也没回来，后退 2 格', kind: 'move', steps: -2 },
  { name: '组会连开三天', desc: '被导师连开三天组会，支付 ¥1250 精神损失费', kind: 'money', amount: -1250 },
  { name: '选课全被踢', desc: '三轮选课全被踢出，支付 ¥850 抢课脚本费', kind: 'money', amount: -850 },
  { name: '请全实验室喝奶茶', desc: '嘴欠答应了请客，每位玩家付 ¥350', kind: 'each', amount: 350, dir: 'out' },
  { name: '社团活动超支', desc: '活动经费超支要你垫，支付 ¥1200', kind: 'money', amount: -1200 },
  { name: '校园改造拆地', desc: '规划改造：地皮最多的人被拆掉一块地皮（归还银行）', kind: 'demolishLand' },
  { name: '违建被举报', desc: '有人举报违建：房子最多的人被拆掉一栋房', kind: 'demolishHouse' },
  { name: 'DIY 盖房', desc: '动手能力爆棚，免费给自己一块地盖一栋房', kind: 'selfBuild' },
  { name: '学弟学妹来帮忙', desc: '房子最少的人获得帮忙，免费盖一栋房', kind: 'poorestBuild' },
  { name: '工地噪音', desc: '隔壁工地通宵施工，支付 ¥700 耳塞与民宿钱', kind: 'money', amount: -700 },
  { name: '末班车坐反', desc: '末班摆渡车坐反方向，后退 3 格', kind: 'move', steps: -3 },
  { name: '代课被记', desc: '帮人代课被抓，支付 ¥1000', kind: 'money', amount: -1000 },
  // ---- 新增：翻盘与首富税 ----
  { name: '励志奖学金', desc: '总资产最低的同学喜提励志奖学金 ¥3000（学校资助）', kind: 'poorestMoney', amount: 3000 },
  { name: '校友结对帮扶', desc: '校友会结对帮扶：总资产最低的同学向其他每位玩家收 ¥500', kind: 'poorestEach', amount: 500 },
  { name: '财务突击查账', desc: '财务处突击查账：总资产最高的玩家向教育基金池支付 ¥2500', kind: 'richPayPool', amount: 2500 },
  { name: '资产评估征税', desc: '年度资产评估：总资产最高的玩家缴纳总资产的 10%（进教育基金池，现金不够会被迫抵押！）', kind: 'richPayPct', pct: 10, base: 'net' },
  // ---- v5.0 新增：更多有趣的机会 ----
  { name: '一等奖学金', desc: '拿下校级一等奖学金，收 ¥3500', kind: 'money', amount: 3500 },
  { name: '论文被引破百', desc: '论文被引破百，学校额外奖励 ¥2800', kind: 'money', amount: 2800 },
  { name: '实习转正', desc: '实习单位当场发转正 offer 并预付安家费，收 ¥3200', kind: 'money', amount: 3200 },
  { name: '宿舍团建 AA', desc: '宿舍团建 AA，每位玩家给你 ¥300', kind: 'each', amount: 300, dir: 'in' },
  { name: '校园马拉松冠军', desc: '校园马拉松夺冠，收 ¥2200', kind: 'money', amount: 2200 },
  { name: '直播带货翻车', desc: '帮学院直播带货翻了车，赔付 ¥1800', kind: 'money', amount: -1800 },
  { name: '低买高卖赚差价', desc: '二手显示器低买高卖，赚 ¥1600', kind: 'money', amount: 1600 },
  { name: '学霸笔记畅销', desc: '整理的学霸笔记被疯抢，收 ¥2400', kind: 'money', amount: 2400 },
  { name: '导师发红包', desc: '导师在群里发了红包，收 ¥999', kind: 'money', amount: 999 },
  { name: '设备招标中签', desc: '科研设备招标中签，省下的经费归你，收 ¥2600', kind: 'money', amount: 2600 },
  { name: '早八睡过头', desc: '早八没爬起来被点名，支付 ¥900', kind: 'money', amount: -900 },
  { name: '公交卡五折月', desc: '公交卡五折活动退款，收 ¥1200', kind: 'money', amount: 1200 },
];
const FATE = [
  { name: '挂科预警', desc: '支付 ¥1400 重修费', kind: 'money', amount: -1400 },
  { name: '电脑蓝屏', desc: '论文没保存，支付 ¥1100', kind: 'money', amount: -1100 },
  { name: '校园卡丢了', desc: '支付 ¥400 补办', kind: 'money', amount: -400 },
  { name: '食堂涨价', desc: '全体玩家各支付 ¥700', kind: 'each', amount: 700, dir: 'out' },
  { name: '宿舍养猫', desc: '被楼管阿姨发现，社死名场面——停留一回合', kind: 'skip' },
  { name: '查重通过', desc: '查重率仅 2%，导师大喜，收 ¥1500', kind: 'money', amount: 1500 },
  { name: '生日快乐', desc: '宿友凑份子，每位玩家送你 ¥400', kind: 'each', amount: 400, dir: 'in' },
  { name: '试剂打翻', desc: '实验室试剂打翻，支付 ¥1500', kind: 'money', amount: -1500 },
  { name: '快递丢件', desc: '驿站丢件，支付 ¥550', kind: 'money', amount: -550 },
  { name: '忘带伞', desc: '大雨被困教学楼，停留一回合', kind: 'skip' },
  { name: '校医院排队', desc: '排队三小时，支付 ¥850 挂号费', kind: 'money', amount: -850 },
  { name: '实习工资', desc: '实习工资到账，收 ¥3000', kind: 'money', amount: 3000 },
  { name: '断电断网', desc: '宿舍跳闸，跳过下一回合', kind: 'skip' },
  { name: '帮取快递', desc: '帮教授跑腿，收 ¥700', kind: 'money', amount: 700 },
  { name: '歌赛夺冠', desc: '十大歌手夺冠，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '退货成功', desc: '七天无理由退货，收 ¥550', kind: 'money', amount: 550 },
  { name: '奖学金公示', desc: '每位玩家支付你 ¥300（恭喜）', kind: 'each', amount: 300, dir: 'in' },
  { name: '赶 due', desc: '半夜赶 due，支付 ¥700 咖啡钱', kind: 'money', amount: -700 },
  { name: '违规电器', desc: '宿舍被查收热得快，支付 ¥400 罚款', kind: 'money', amount: -400 },
  { name: '洗衣机排队', desc: '排队两小时还没轮到，停留一回合', kind: 'skip' },
  { name: '六级报名', desc: '又到了四六级报名的日子，支付 ¥400', kind: 'money', amount: -400 },
  { name: '外卖洒了', desc: '骑手小哥道歉再赔一份，支付 ¥350', kind: 'money', amount: -350 },
  { name: '演唱会学生票', desc: '抢到学生票转手出了，赚 ¥1500', kind: 'money', amount: 1500 },
  { name: '导师画饼成真', desc: '说好的科研补贴真的到账了，收 ¥2500', kind: 'money', amount: 2500 },
  { name: '体测 1000 米', desc: '跑完瘫在操场，支付 ¥550 运动饮料钱', kind: 'money', amount: -550 },
  { name: '室友中奖', desc: '室友抽奖中了请全宿舍吃饭，每位玩家给你 ¥550', kind: 'each', amount: 550, dir: 'in' },
  { name: '占座被抓', desc: '图书馆占座被巡查抓到，支付 ¥300 并后退 2 格', kind: 'money', amount: -300, thenMove: -2 },
  { name: '天降门票', desc: '在自习室捡到没人认领的演出票，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '水卡充值', desc: '水卡充值满赠活动，收 ¥1100', kind: 'money', amount: 1100 },
  { name: '期末通宵', desc: '期末周连肝三夜，考完补觉，跳过下一回合', kind: 'skip' },
  { name: '被人打小报告', desc: '被人匿名举报，下回合移动 -3 格', kind: 'sabotage', steps: -3 },
  { name: '校园卡消费记录', desc: '导员查账发现你点太多外卖，支付 ¥1000', kind: 'money', amount: -1000 },
  { name: '食堂新菜踩雷', desc: '点了新品黑暗料理，支付 ¥500 医药费', kind: 'money', amount: -500 },
  // ---- 新增：负面为主 ----
  { name: '论文被拒三次', desc: '投稿连续被拒，支付 ¥1500 版面费与重做费', kind: 'money', amount: -1500 },
  { name: '宿舍调整', desc: '被通知搬宿舍，支付 ¥1100 搬运费', kind: 'money', amount: -1100 },
  { name: '手机碎屏', desc: '手滑摔碎屏幕，支付 ¥1250 维修费', kind: 'money', amount: -1250 },
  { name: '考勤不合格', desc: '旷课太多，支付 ¥1400 补考与重修费', kind: 'money', amount: -1400 },
  { name: '资金链断裂', desc: '被迫变卖资产：自己失去一块地皮（归还银行）', kind: 'selfLoseLand' },
  { name: '老房子失修', desc: '年久失修必须拆除：自己拆掉一栋房子', kind: 'selfLoseHouse' },
  { name: '宿舍大检查', desc: '全体被查违规电器，各支付 ¥500 进教育基金池', kind: 'taxAll', amount: 500 },
  { name: '诸事不顺', desc: '霉运缠身，挂科留级一回合', kind: 'jailSelf' },
  { name: 'idea 被抢发', desc: '课题被人抢先发表，支付 ¥1300 重做实验', kind: 'money', amount: -1300 },
  { name: '食堂吃出问题', desc: '食物中毒去医院，支付 ¥1000', kind: 'money', amount: -1000 },
  { name: '被扣奖学金', desc: '因违纪被扣发奖学金，支付 ¥1500', kind: 'money', amount: -1500 },
  { name: '室友半夜开派对', desc: '吵得整夜没睡，停留一回合', kind: 'skip' },
  { name: '实验设备损坏', desc: '操作失误弄坏仪器，支付 ¥1800 赔偿', kind: 'money', amount: -1800 },
  // ---- 新增：翻盘与首富税 ----
  { name: '助学贷款豁免', desc: '政策利好：总资产最低的同学的助学贷款被豁免，收 ¥2500', kind: 'poorestMoney', amount: 2500 },
  { name: '慈善晚宴募捐', desc: '慈善晚宴：总资产最高的玩家向教育基金池捐款 ¥3000', kind: 'richPayPool', amount: 3000 },
  { name: '高消费预警', desc: '被大数据盯上高额消费：总资产最高的玩家缴纳手头现金的 20% 进教育基金池', kind: 'richPayPct', pct: 20, base: 'cash' },
  // ---- v5.0 新增：更多有趣的命运 ----
  { name: '盲审一次性通过', desc: '毕业论文盲审一次通过，收 ¥3500', kind: 'money', amount: 3500 },
  { name: '保研上岸', desc: '保研成功，亲友红包累计 ¥4000', kind: 'money', amount: 4000 },
  { name: '创业大赛金奖', desc: '创业大赛夺金，奖金 ¥3800', kind: 'money', amount: 3800 },
  { name: '室友失恋请客', desc: '室友失恋请你吃饭，每位玩家付你 ¥350', kind: 'each', amount: 350, dir: 'in' },
  { name: '实验室搬家', desc: '实验室整体搬家，出钱请搬运 ¥1600', kind: 'money', amount: -1600 },
  { name: '硬盘损坏', desc: '硬盘损坏数据全丢，重做花费 ¥2200', kind: 'money', amount: -2200 },
  { name: '被导师留堂', desc: '讨论卡了半天没结果，挂科留级一回合', kind: 'jailSelf' },
  { name: '换季感冒', desc: '换季感冒跑医院，支付 ¥1100', kind: 'money', amount: -1100 },
  { name: '校招笔试迟到', desc: '校招笔试睡过头，错失机会，损失 ¥1700', kind: 'money', amount: -1700 },
  { name: '校园网断线', desc: '校园网断了一整周，流量费 ¥800', kind: 'money', amount: -800 },
  { name: '抢到演唱会票', desc: '抢到热门演唱会门票转手，赚 ¥2400', kind: 'money', amount: 2400 },
  { name: '同学借钱不还', desc: '借出去的钱打了水漂，损失 ¥1300', kind: 'money', amount: -1300 },
];

const SALARY = 2000, START_CASH = 30000, TURN_MS = 30000, AUCTION_MS = 15000;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

class Room {
  constructor(code) {
    this.code = code;
    this.phase = 'lobby'; // lobby / roll / auction / raise / over
    this.players = [];
    this.cells = BOARD.map(() => ({ own: null, level: 0, mortgaged: false }));
    this.cur = 0;
    this.fundPool = 0;
    this.log = [];
    this.events = [];          // 本轮待广播事件
    this.pendingBuy = null;    // {pid, cell}
    this.pendingBuild = null;  // {pid, cell}
    this.pendingBranch = null; // {pid, cell, line} 岔路入口询问（line: 'A'学术长廊 / 'B'创业大道）
    this.pendingInvest = null; // {pid, cost, back, rounds} 科研投资询问
    this.pendingReroll = null; // {pid, cost} 掷骰后重投询问（v4.0）
    this.auction = null;       // {cell, highest, bidder, endsAt, maxBid:{}}
    this.raise = null;         // {pid, need, creditor}
    this.vote = null;          // {asker, votes:{}}
    this.timer = null;
    this.aiTimers = [];
    this.dice = null;
    this.round = 1;
    this.startedAt = null;
    this.season = 'mid';       // low / mid / high（市场周期）
    this.weather = 'cloud';    // sun / cloud / rain / storm
    this.calEvent = null;      // 本轮生效的校历全局事件
    this.duel = null;          // 进行中的擂台对决
  }
  ev(e) { this.events.push(e); }
  addLog(msg) { const ts = Date.now(); this.log.push({ t: ts, msg }); if (this.log.length > 200) this.log.shift(); this.ev({ t: 'log', msg, ts }); }
  // v4.0：教育基金池统一入口 —— 上限 ¥30000，超出部分直接均分给全体在场玩家
  addToFund(amount) {
    if (!(amount > 0)) return;
    const overflow = this.fundPool + amount - FUND_CAP;
    this.fundPool = Math.min(FUND_CAP, this.fundPool + amount);
    if (overflow > 0) {
      const alive = this.alive();
      if (alive.length) {
        const share = Math.floor(overflow / alive.length);
        if (share > 0) {
          for (const q of alive) { q.cash += share; this.ev({ t: 'money', pid: q.id, amount: share, reason: '基金溢出均分' }); }
          this.addLog(`💰 教育基金突破上限 ¥${FUND_CAP}，溢出部分均分：每人 +¥${share}`);
        }
      }
    }
  }

  // ---------- 大厅 ----------
  join(name, isAI = false) {
    if (this.phase !== 'lobby' && !isAI) return null;
    if (this.players.length >= 5) return null;
    const p = {
      id: 'p' + (this.players.length + 1), name, isAI,
      token: Math.random().toString(36).slice(2, 12),
      cash: START_CASH, pos: 0, alive: true,
      voucher: 0, discount: false, skipNext: false, skipTurns: 0, color: PCOLOR[this.players.length],
      invest: null,             // 科研投资 {due, back}（学术长廊）
      buffSteps: 0,             // 奖学金长廊浪漫加成（下回合移动 +N）
      medal: 0,                 // 免租金卡（校园商城免费领取，保留到付租金时自动消耗）
      wins: 0,
      voice: false,              // 是否开着麦（语音房状态，不参与游戏逻辑）
      major: pick(MAJOR_KEYS),   // 专业身份（大厅可改）
      skillLeft: 0,              // 专业技能剩余次数（开局按专业重置）
      ach: {},                   // 已获得成就（按局重置）
      combo: 0,                  // 连续收租次数（连击）
      lucky: false, shield: false, sabotage: 0,  // 当回合临时状态
      rerollUsed: false,        // 重掷骰每回合限用一次
    };
    this.players.push(p);
    this.addLog(`${name} 加入了房间`);
    return p;
  }
  start() {
    if (this.phase !== 'lobby' || this.players.length < 2) return false;
    this.startedAt = Date.now();
    for (const p of this.players) p.skillLeft = MAJORS[p.major].uses;
    this.addLog('游戏开始！初始资金 ¥30000，祝大家武运昌隆');
    this.addLog('专业：' + this.players.map(p => `${p.name}·${MAJORS[p.major].name}`).join('，'));
    this.beginRound();
    this.startTurn();
    return true;
  }
  // ---------- 每轮开局：季节 / 天气 / 校历事件 / 物业税 ----------
  beginRound() {
    const prev = this.season;
    this.season = this.rollSeason(prev);
    const S = SEASON[this.season];
    this.ev({ t: 'season', season: this.season, prev, round: this.round });
    this.addLog(`📅 第 ${this.round} 轮 · 市场进入「${S.name}」：收租 ×${S.rentMul}，买地盖房 ×${S.buildMul}`);

    this.weather = pick(['sun', 'sun', 'cloud', 'cloud', 'rain', 'storm']);
    const W = WEATHER[this.weather];
    this.ev({ t: 'weather', w: this.weather });
    if (W.diceMod || W.rentMul) this.addLog(`${W.icon} 今日${W.name}${W.diceMod ? `（掷骰 ${W.diceMod > 0 ? '+' : ''}${W.diceMod} 步）` : ''}${W.rentMul ? `（全场租金 ×${W.rentMul}）` : ''}`);

    this.calEvent = null;
    // v4.0 终局：进入「经济寒冬」，银行停发工资
    if (this.round === ENDGAME_ROUND) {
      this.addLog(`❄️ 第 ${ENDGAME_ROUND} 轮起进入「经济寒冬」：银行停发工资，全靠地租和生意过日子！`);
      this.ev({ t: 'endgame', round: ENDGAME_ROUND });
    }
    if (this.round > 1 && this.round % 3 === 0) {
      const e = pick(CALEVENTS);
      this.calEvent = e;
      this.ev({ t: 'calevent', id: e.id, name: e.name, icon: e.icon, desc: e.desc, kind: e.kind });
      this.addLog(`${e.icon} 校历事件【${e.name}】：${e.desc}`);
      this.applyCalEvent(e);
    }
    // 科研投资到期返还（学术长廊）
    for (const q of this.players) {
      if (!q.alive || !q.invest || this.round < q.invest.due) continue;
      q.cash += q.invest.back;
      this.addLog(`🔬 ${q.name} 的科研投资结项，返还 ¥${q.invest.back}`);
      this.ev({ t: 'money', pid: q.id, amount: q.invest.back, reason: '科研投资结项' });
      q.invest = null;
    }
    this.collectTax();
  }
  // 校历事件的具体结算
  applyCalEvent(e) {
    const alive = this.alive();
    switch (e.kind) {
      case 'moneyAll': {
        // 全员类结算合并成一条播报：避免轮次开场连播 N 条大字横幅造成积压
        const items = [];
        for (const q of alive) { q.cash += e.amount; items.push({ pid: q.id, amount: e.amount }); }
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: e.amount * items.length });
        break;
      }
      case 'payAll': {
        const items = []; let sum = 0;
        for (const q of alive) {
          const pay = Math.min(q.cash, e.amount); q.cash -= pay; sum += pay;
          items.push({ pid: q.id, amount: pay });
        }
        this.addToFund(sum);
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: false, items, total: sum });
        break;
      }
      case 'richTax': {
        if (!alive.length) break;
        const rich = alive.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        const pay = Math.max(0, Math.min(e.amount, rich.cash));
        rich.cash -= pay; this.addToFund(pay);
        this.addLog(`💝 ${rich.name} 向教育基金池捐赠 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: null, reason: e.name, cell: rich.pos, toPool: true });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: true });
        break;
      }
      case 'poorBonus': {
        if (!alive.length) break;
        const poor = alive.slice().sort((x, y) => x.cash - y.cash)[0];
        poor.cash += e.amount;
        this.addLog(`🌱 ${poor.name} 获得助学金 ¥${e.amount}`);
        this.ev({ t: 'money', pid: poor.id, amount: e.amount, reason: e.name });
        break;
      }
      case 'bailout': {
        const items = [];
        for (const q of alive) {
          if (q.cash < e.low) { q.cash += e.amount; this.addLog(`🇨🇳 ${q.name} 领取消费补贴 ¥${e.amount}`); items.push({ pid: q.id, amount: e.amount }); }
        }
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: e.amount * items.length });
        break;
      }
      default: break; // slow/fast/rainy/rentUp/rentDown/buildSale 在对应结算处生效
    }
  }
  // 市场骰：1-2 淡 / 3-4 平 / 5-6 旺，带惯性（旺季更旺、淡季更淡）
  rollSeason(prev) {
    const d = 1 + Math.floor(Math.random() * 6);
    let tier = d <= 2 ? 0 : (d <= 4 ? 1 : 2);
    if (prev === 'high') tier = Math.min(2, tier + 1);
    else if (prev === 'low') tier = Math.max(0, tier - 1);
    return SEASON_ORDER[tier];
  }
  // 物业税：只对"大户"征收（v3.5：地产 >6 块 或 建筑 >6 级才收，税额温和，全部进教育基金池）
  collectTax() {
    const items = [];
    for (const p of this.alive()) {
      let hold = 0, bld = 0;
      this.cells.forEach((cs, i) => { if (cs.own === p.id) { hold++; if (BOARD[i].type === 'prop') bld += cs.level; } });
      let tax = Math.max(0, bld - 6) * 130 + Math.max(0, hold - 6) * 90;
      tax = Math.min(tax, 1800);   // v5.0：税率与上限小幅下调
      if (tax <= 0) continue;
      if (p.cash < tax) continue;   // 现金不足则本年暂缓，避免与筹钱逻辑纠缠
      p.cash -= tax;
      this.addToFund(tax);
      this.addLog(`🏛️ ${p.name} 名下 ${hold} 块地产 / ${bld} 级建筑，缴纳物业税 ¥${tax}`);
      items.push({ pid: p.id, amount: tax });
    }
    // 合并成一条播报（多个大户同轮缴税时不再连播多条大字横幅）
    if (items.length) this.ev({ t: 'tax', items, total: items.reduce((s, x) => s + x.amount, 0) });
  }
  // 成就
  giveAch(p, id) {
    if (!p || !p.alive) return;
    const a = ACHS[id]; if (!a) return;
    if (!p.ach) p.ach = {};
    if (p.ach[id]) return;
    p.ach[id] = 1;
    p.cash += a.reward;
    this.addLog(`🏅 ${p.name} 达成成就【${a.name}】${a.desc}，奖励 ¥${a.reward}`);
    this.ev({ t: 'ach', pid: p.id, id, name: a.name, desc: a.desc, reward: a.reward });
  }
  // 聊天 / 表情（AI 也参与）：只发 chat 事件，客户端即时显示，不排进动画队列
  chat(p, text) {
    const t = String(text == null ? '' : text).replace(/[\r\n\t]/g, ' ').slice(0, 30).trim();
    if (!t) return;
    const msg = `💬 ${p.name}：${t}`;
    this.log.push({ t: Date.now(), msg });
    if (this.log.length > 200) this.log.shift();
    this.ev({ t: 'chat', pid: p.id, name: p.name, text: t, ai: !!p.isAI });
  }
  aiChat(p, text, force) { if (p && p.isAI && p.alive && (force || Math.random() < 0.4)) this.chat(p, text); }
  // 大厅改专业
  setMajor(p, major) {
    if (this.phase !== 'lobby') return;
    if (!MAJORS[major]) return;
    p.major = major;
  }
  // 掷骰前购买并使用一次性道具（免罚符价格随轮数上涨：¥(400 + 150×轮数)，仅当轮有效）
  useItem(p, item) {
    if (this.phase !== 'roll' || this.curp() !== p) return;
    const it = ITEMS[item]; if (!it) return;
    const cost = item === 'shield' ? this.shieldCost() : it.cost;
    if (p.cash < cost) return;
    p.cash -= cost;
    if (item === 'shield') p.shield = true;
    this.addToFund(Math.round(cost * FUND_SHARE));   // v5.0：道具花费的 1/3 进教育基金池
    this.addLog(`🎒 ${p.name} 花 ¥${cost} 使用道具「${it.name}」（其中 ¥${Math.round(cost * FUND_SHARE)} 进教育基金池）`);
    this.ev({ t: 'item', pid: p.id, item, cost, name: it.name });
  }
  // ---------- 重掷骰（v4.0：掷骰后可花 ¥1200 重投一次，替代旧"幸运骰自选点数"） ----------
  confirmRoll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    this.clearTimer(); this.pendingReroll = null;
    this.execRoll(p);
  }
  doReroll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    this.clearTimer(); this.pendingReroll = null;
    if (p.cash < REROLL_COST) { this.execRoll(p); return; }
    p.cash -= REROLL_COST;
    p.rerollUsed = true;
    this.addToFund(Math.round(REROLL_COST * FUND_SHARE));   // v5.0：重掷花费的 1/3 进教育基金池
    const [d1, d2] = this.rollDice(p);
    this.dice = [d1, d2];
    this.addLog(`🎲 ${p.name} 花 ¥${REROLL_COST} 重投一次：${d1} + ${d2} = ${d1 + d2}`);
    this.ev({ t: 'item', pid: p.id, item: 'reroll', cost: REROLL_COST, name: '重掷骰', detail: `重投 ${d1}+${d2}` });
    this.ev({ t: 'roll', pid: p.id, d1, d2 });
    this.execRoll(p);
  }
  aiReroll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    const sum = (this.dice ? this.dice[0] + this.dice[1] : 7);
    // 点数太差且现金宽裕才值得花钱重投
    if (sum <= 5 && p.cash >= REROLL_COST + this.safety(p) * 0.5) this.doReroll(p);
    else this.confirmRoll(p);
  }
  // 免罚符价格：随轮数上涨（前期便宜、后期租金高也水涨船高），仅当轮有效
  // 免罚符价格（v5.0 续·二 改为「分段涨价」）
  // 初衷：原来是 350+130×轮 的一条直线，开局第 1 轮就要 ¥480，新手根本买不起，中期又贵得离谱。
  // 现在分三段——前期便宜好上手，中期温和，后期才加速，整体比原来更便宜。
  //   第 1~8 轮 ：280 + 60 × 轮          → ¥340 … ¥760
  //   第 9~20 轮：760 + 120 × (轮 − 8)   → ¥880 … ¥2200
  //   第 21 轮起：2200 + 160 × (轮 − 20) → ¥2360 …
  shieldCost() {
    const r = Math.max(1, this.round);
    if (r <= 8) return 280 + 60 * r;
    if (r <= 20) return 760 + 120 * (r - 8);
    return 2200 + 160 * (r - 20);
  }

  // ---------- 岔路（v3.5 学术长廊 + v4.0 创业大道） ----------
  enterBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    const line = this.pendingBranch.line || 'A';
    this.pendingBranch = null;
    if (line === 'B') {
      this.addLog(`🚀 ${p.name} 转进「创业大道」，走上高风险高回报的路子`);
      p.pos = BRANCH2.START;
    } else {
      this.addLog(`🎓 ${p.name} 转进「学术长廊」，去看看外圈没有的风景`);
      p.pos = BRANCH.START;
    }
    this.ev({ t: 'teleport', pid: p.id, cell: p.pos });
    // 专业：航天 · 一飞冲天（进入岔路额外 +¥1000）
    if (p.major === 'aero' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 1000;
      this.addLog(`🛰️ ${p.name} 发动【一飞冲天】+¥1000`);
      this.ev({ t: 'skill', pid: p.id, major: 'aero', name: '一飞冲天', detail: '+¥1000' });
      this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '一飞冲天' });
    }
    this.resolveCell(p);
  }
  declineBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    this.pendingBranch = null;
    this.addLog(`${p.name} 在长廊入口想了想，还是走大路`);
    this.afterResolve(p, false);
  }
  aiBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    // AI：现金宽裕才进岔路（岔路是事件格，进去不亏，但留着现金更稳）
    if (p.cash >= this.safety(p)) this.enterBranch(p);
    else this.declineBranch(p);
  }
  buyInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    const { cost, back, rounds } = this.pendingInvest;
    this.pendingInvest = null;
    if (p.cash < cost) { this.declineInvest(p); return; }
    p.cash -= cost;
    p.invest = { due: this.round + rounds, back };
    this.addLog(`🔬 ${p.name} 投入 ¥${cost} 科研经费，第 ${p.invest.due} 轮返还 ¥${back}`);
    this.ev({ t: 'invest', pid: p.id, cost, back });
    this.afterResolve(p, true);
  }
  declineInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    this.pendingInvest = null;
    this.addLog(`${p.name} 观望了一下，没有投资`);
    this.afterResolve(p, false);
  }
  aiInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    if (p.cash >= 2000 + this.safety(p) * 1.2) this.buyInvest(p);
    else this.declineInvest(p);
  }

  // ---------- 回合 ----------
  alive() { return this.players.filter(p => p.alive); }
  curp() { return this.players[this.cur]; }
  startTurn() {
    if (this.checkWin()) return;
    const p = this.curp();
    if (p.discount) p.discount = false; // 折扣卡仅当轮有效
    p.shield = false;                   // 道具仅当轮有效
    p.rerollUsed = false;               // 重掷骰每回合重置
    this.phase = 'roll';
    this.dice = null;
    this.pendingBuy = null; this.pendingBuild = null; this.pendingReroll = null; this.pendingBranch = null; this.pendingInvest = null; this.raise = null; this.auction = null; this.vote = null;
    if (p.skipNext || (p.skipTurns || 0) > 0) {
      if (p.skipNext) p.skipNext = false; else p.skipTurns--;
      const left = p.skipTurns || 0;
      this.addLog(`${p.name} 停留一回合，原地休整${left > 0 ? `（还要停留 ${left} 回合）` : ''}`);
      this.ev({ t: 'stay', pid: p.id, left });
      this.endTurn();
      return;
    }
    this.ev({ t: 'turn', pid: p.id });
    // 专业：生命科学 · 细胞增殖（回合开始现金 +3%）
    if (p.major === 'bio' && p.skillLeft > 0 && p.cash > 0) {
      const gain = Math.round(p.cash * 0.03);
      p.skillLeft--; p.cash += gain;
      this.addLog(`🧬 ${p.name} 发动【细胞增殖】+¥${gain}`);
      this.ev({ t: 'skill', pid: p.id, major: 'bio', name: '细胞增殖', detail: `+¥${gain}` });
      this.ev({ t: 'money', pid: p.id, amount: gain, reason: '细胞增殖' });
    }
    this.schedule();
  }
  schedule() {
    const p = this.curp();
    if (p.isAI) {
      const delay = rnd(3600, 7600);
      this.aiTimers.push(setTimeout(() => this.aiAct(), delay));
    } else {
      this.setTimer(TURN_MS, () => this.autoAct());
    }
  }
  // 玩家主动退出（或掉线）：转为 AI 并立即接管当前需要他做的行动，无需投票
  handoverToAI(p) {
    if (!p || !p.alive || p.isAI) return;
    p.isAI = true;
    p.voice = false;   // 掉线/退出即闭麦，避免语音房残留幽灵麦
    this.addLog(`🤖 ${p.name} 退出对局，AI 已接管`);
    this.ev({ t: 'quit', pid: p.id });
    const busySelf = (this.phase === 'roll' && this.curp() === p)
      || (this.phase === 'buy' && this.pendingBuy && this.pendingBuy.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id)
      || (this.phase === 'reroll' && this.pendingReroll && this.pendingReroll.pid === p.id)
      || (this.phase === 'branch' && this.pendingBranch && this.pendingBranch.pid === p.id)
      || (this.phase === 'invest' && this.pendingInvest && this.pendingInvest.pid === p.id)
      || (this.phase === 'raise' && this.raise && this.raise.pid === p.id);
    if (busySelf) {
      this.clearTimer();   // 清掉人类超时兜底，AI 立刻接手
      if (this.phase === 'roll') this.aiTimers.push(setTimeout(() => this.aiAct(), rnd(2200, 4600)));
      else if (this.phase === 'buy') this.aiTimers.push(setTimeout(() => this.aiBuy(), rnd(2600, 5200)));
      else if (this.phase === 'build') this.aiTimers.push(setTimeout(() => this.aiBuild(), rnd(2200, 4600)));
      else if (this.phase === 'reroll') this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 3600)));
      else if (this.phase === 'branch') this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(2600, 5200)));
      else if (this.phase === 'invest') this.aiTimers.push(setTimeout(() => this.aiInvest(p), rnd(2600, 5200)));
      else this.aiTimers.push(setTimeout(() => this.aiRaise(), 2600));
    } else if (this.phase === 'auction' && this.auction && this.auction.bidder !== p.id) {
      this.aiTimers.push(setTimeout(() => this.aiBid(p), rnd(2800, 7000)));
    } else if (this.vote && this.vote.votes[p.id] === undefined) {
      this.aiTimers.push(setTimeout(() => this.aiVote(p), rnd(2200, 4800)));
    }
  }
  setTimer(ms, fn) { this.clearTimer(); this.timer = setTimeout(fn, ms); }
  clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
  clearAiTimers() { this.aiTimers.forEach(clearTimeout); this.aiTimers = []; }
  autoAct() {
    const p = this.curp();
    if (this.phase === 'roll') { this.doRoll(p); }
    else if (this.phase === 'reroll') this.confirmRoll(p);
    else if (this.phase === 'auction') this.endAuction();
    else if (this.phase === 'raise') this.forceSettleRaise();
    else if (this.phase === 'lobby') {}
  }
  endTurn() {
    this.clearTimer(); this.clearAiTimers();
    this.pendingBuy = null; this.pendingBuild = null; this.pendingPick = null; this.pendingBranch = null; this.pendingInvest = null; this.raise = null;
    let n = this.players.length;
    let idx = this.cur;
    for (let i = 0; i < n; i++) {
      idx = (idx + 1) % this.players.length;
      if (this.players[idx].alive) break;
    }
    this.cur = idx;
    if (idx === 0) { this.round++; this.beginRound(); }
    this.startTurn();
  }

  // ---------- 掷骰与移动 ----------
  // 掷一次骰（含计算机"算法优化"技能），返回 [d1, d2]
  rollDice(p) {
    let d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
    // 专业：计算机 · 算法优化（不足 7 点自动重掷取更优，每局限次）
    if (p.major === 'cs' && p.skillLeft > 0 && d1 + d2 < 7) {
      const n1 = 1 + Math.floor(Math.random() * 6), n2 = 1 + Math.floor(Math.random() * 6);
      p.skillLeft--;
      this.ev({ t: 'skill', pid: p.id, major: 'cs', name: '算法优化', detail: `重掷 ${n1} + ${n2}` });
      if (n1 + n2 > d1 + d2) { d1 = n1; d2 = n2; }
    }
    return [d1, d2];
  }
  doRoll(p) {
    if (this.phase !== 'roll' || this.curp() !== p) return;
    const [d1, d2] = this.rollDice(p);
    this.dice = [d1, d2];   // 双数判定与公用事业租金按最终点数计算
    this.ev({ t: 'roll', pid: p.id, d1, d2 });
    // v4.1：掷骰后可花 ¥1200 重投一次（每回合每人限一次，现金够且未用过才提供选项）
    if (!p.rerollUsed && p.cash >= REROLL_COST) {
      this.phase = 'reroll';
      this.pendingReroll = { pid: p.id, cost: REROLL_COST };
      this.addLog(`${p.name} 掷出 ${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? '（双数，可再掷一次）' : ''}`);
      this.ev({ t: 'ask_reroll', pid: p.id, d1, d2, cost: REROLL_COST });
      this.setTimer(TURN_MS, () => this.confirmRoll(this.curp()));
      if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 4200)));
      return;
    }
    this.addLog(`${p.name} 掷出 ${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? '（双数，可再掷一次）' : ''}`);
    this.execRoll(p);
  }
  // 按最终点数实际移动并结算（天气/校历/陷害/长廊加成都在这里叠加）
  execRoll(p) {
    const d1 = this.dice[0], d2 = this.dice[1];
    const raw = d1 + d2;
    let steps = raw;
    const wmod = (WEATHER[this.weather] || {}).diceMod || 0;
    if (wmod) { steps += wmod; this.addLog(`${WEATHER[this.weather].icon} ${WEATHER[this.weather].name}：移动 ${wmod > 0 ? '+' : ''}${wmod} 步`); }
    if (this.calEvent && this.calEvent.steps) { steps += this.calEvent.steps; this.addLog(`${this.calEvent.icon} 校历【${this.calEvent.name}】：移动 ${this.calEvent.steps > 0 ? '+' : ''}${this.calEvent.steps} 步`); }
    if (p.sabotage) { steps += p.sabotage; this.addLog(`😈 ${p.name} 被人陷害：移动 ${p.sabotage} 步`); p.sabotage = 0; }
    if (p.buffSteps) { steps += p.buffSteps; this.addLog(`🎓 ${p.name} 的奖学金长廊加成：移动 +${p.buffSteps} 步`); p.buffSteps = 0; }
    if (p.major === 'pe' && p.skillLeft > 0 && raw <= 4) {
      steps += 2; p.skillLeft--;
      this.addLog(`🏀 ${p.name} 发动【体能优势】多走 2 步`);
      this.ev({ t: 'skill', pid: p.id, major: 'pe', name: '体能优势', detail: '+2 步' });
    }
    // 专业：统计 · 数据洞察（点数 ≤5 时额外 +¥600）
    if (p.major === 'stat' && p.skillLeft > 0 && raw <= 5) {
      p.skillLeft--; p.cash += 600;
      this.addLog(`📊 ${p.name} 发动【数据洞察】+¥600`);
      this.ev({ t: 'skill', pid: p.id, major: 'stat', name: '数据洞察', detail: '+¥600' });
      this.ev({ t: 'money', pid: p.id, amount: 600, reason: '数据洞察' });
    }
    if (steps < 1) steps = 1;
    if (steps !== raw) this.addLog(`${p.name} 实际前进 ${steps} 步`);

    const path = [];
    let pos = p.pos;
    for (let i = 0; i < steps; i++) {
      pos = this.nextOf(pos);
      path.push(pos);
    }
    this.phase = 'resolving';
    let passedGo = false;
    for (const c of path) if (c === 0) passedGo = true;
    p.pos = pos;
    if (passedGo) {
      // v4.0「经济寒冬」：第 ENDGAME_ROUND 轮起银行停发工资
      if (this.salaryOn()) {
        p.cash += SALARY; this.ev({ t: 'money', pid: p.id, amount: SALARY, reason: '工资' });
        this.addLog(`${p.name} 经过起点，领工资 ¥${SALARY}`);
        if (p.major === 'ee' && p.skillLeft > 0) { p.skillLeft--; p.cash += 1000; this.addLog(`🔌 ${p.name} 发动【信号增益】+¥1000`); this.ev({ t: 'skill', pid: p.id, major: 'ee', name: '信号增益', detail: '+¥1000' }); this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '信号增益' }); }
        if (p.major === 'agri' && p.skillLeft > 0) { p.skillLeft--; p.cash += 1500; this.addLog(`🌾 ${p.name} 发动【春华秋实】+¥1500`); this.ev({ t: 'skill', pid: p.id, major: 'agri', name: '春华秋实', detail: '+¥1500' }); this.ev({ t: 'money', pid: p.id, amount: 1500, reason: '春华秋实' }); }
      } else {
        this.addLog(`❄️ ${p.name} 经过起点，经济寒冬银行停发工资`);
      }
      this.checkRichest(p);
    }
    this.ev({ t: 'move', pid: p.id, path, final: pos });
    setTimeout(() => this.resolveCell(p), 0); // 客户端先播移动动画；引擎立即结算事件随后广播
  }
  // 是否还发工资（v4.0 终局模式）
  salaryOn() { return this.round < ENDGAME_ROUND; }

  // 岔路感知的下一格：主路线 0~47 环形（47→0）；学术长廊 48~54 线性（54→20 教育基金会）；
  // 创业大道 55~61 线性（61→10 校园商城）
  nextOf(pos) {
    if (pos === 47) return 0;
    if (pos >= BRANCH.START && pos < BRANCH.EXIT) return pos + 1;
    if (pos === BRANCH.EXIT) return BRANCH.EXIT_TO;
    if (pos >= BRANCH2.START && pos < BRANCH2.EXIT) return pos + 1;
    if (pos === BRANCH2.EXIT) return BRANCH2.EXIT_TO;
    return pos + 1;
  }
  checkRichest(p) { if (p.cash >= 100000) this.giveAch(p, 'richest'); }

  seasonCost(base) {
    let m = SEASON[this.season].buildMul;
    if (this.calEvent && this.calEvent.kind === 'buildSale') m *= this.calEvent.mul;
    return Math.max(1, Math.round(base * m));
  }
  landCost(base) { return Math.max(1, Math.round(base * SEASON[this.season].buildMul)); }
  resolveCell(p) {
    const idx = p.pos, cell = BOARD[idx], cs = this.cells[idx];
    this.ev({ t: 'land', pid: p.id, cell: idx });
    switch (cell.type) {
      case 'prop': case 'transport': case 'util': {
        if (cs.own === null) {
          const base = this.landCost(cell.price);
          const price = p.discount ? Math.floor(base * 0.8) : base;
          this.phase = 'buy';
          this.pendingBuy = { pid: p.id, cell: idx, price, base };
          this.addLog(`${p.name} 踩到无主地产「${cell.name}」（¥${price}${this.season !== 'mid' ? ' · ' + SEASON[this.season].name + '价' : ''}）`);
          this.ev({ t: 'ask_buy', pid: p.id, cell: idx, price, base, discount: !!p.discount });
          this.scheduleBuy();
          return;
        }
        if (cs.own === p.id) {
          if (cell.type !== 'prop') { this.afterResolve(p, false); return; }
          if (cs.mortgaged) { this.addLog(`${p.name} 回到自己的抵押地「${cell.name}」，可随时在资产面板赎回`); this.afterResolve(p, false); return; }
          if (cs.level < 4) {
            const cost = this.seasonCost(GROUPS[cell.g].build);
            this.phase = 'build';
            this.pendingBuild = { pid: p.id, cell: idx, cost };
            this.addLog(`${p.name} 踩到自己的「${cell.name}」，可升级（Lv${cs.level}→Lv${cs.level + 1}，¥${cost}）`);
            this.ev({ t: 'ask_build', pid: p.id, cell: idx, cost });
            this.scheduleBuild();
            return;
          }
          this.addLog(`${p.name} 踩到自己的旅馆「${cell.name}」，已是顶级`);
          this.afterResolve(p, false); return;
        }
        const owner = this.players.find(q => q.id === cs.own);
        if (cs.mortgaged) {
          // 抵押地：可被踩到者以抵押价买走
          const mp = Math.floor(cell.price / 2);
          this.phase = 'buy';
          this.pendingBuy = { pid: p.id, cell: idx, mortgageBuy: mp, price: mp, base: mp };
          this.addLog(`${p.name} 踩到 ${owner.name} 的抵押地「${cell.name}」，可以 ¥${mp} 直接买走！`);
          this.ev({ t: 'ask_buy', pid: p.id, cell: idx, price: mp, mortgageBuy: true });
          this.scheduleBuy();
          return;
        }
        // 免租三件套：先消耗限时的（免罚符当轮过期），再消耗持久的（免租金卡/免租券）
        if (p.shield) {
          p.shield = false;
          this.addLog(`🛡️ ${p.name} 的免罚符生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'shield', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        if (p.medal > 0) {
          p.medal--;
          this.addLog(`🎫 ${p.name} 的免租金卡生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'medal', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        if (p.voucher > 0) {
          p.voucher--;
          this.addLog(`🎫 ${p.name} 的免租券生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'voucher', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        let rent = this.calcRent(idx, this.dice);
        // 专业：医学 · 妙手回春（被收租 ≥¥1000 时自动减免 40%）
        if (p.major === 'phys' && p.skillLeft > 0 && rent >= 1200) {
          const saved = Math.round(rent * 0.3); rent -= saved; p.skillLeft--;
          this.addLog(`⚛️ ${p.name} 发动【守恒定律】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'phys', name: '守恒定律', detail: `-${saved}` });
        }
        if (p.major === 'med' && p.skillLeft > 0 && rent >= 1000) {
          const saved = Math.round(rent * 0.4); rent -= saved; p.skillLeft--;
          this.ev({ t: 'skill', pid: p.id, major: 'med', name: '妙手回春', detail: `减免 ¥${saved}` });
        }
        // 专业：经管 · 资本运作（单笔收租 ≥¥1500 时自动 +50%）
        if (owner.major === 'chem' && owner.skillLeft > 0 && rent >= 1000) {
          const bonus = Math.round(rent * 0.4); rent += bonus; owner.skillLeft--;
          this.addLog(`🧪 ${owner.name} 发动【催化加成】+¥${bonus}`);
          this.ev({ t: 'skill', pid: owner.id, major: 'chem', name: '催化加成', detail: `+${bonus}` });
        }
        if (owner.major === 'econ' && owner.skillLeft > 0 && rent >= 1500) {
          const bonus = Math.round(rent * 0.5); rent += bonus; owner.skillLeft--;
          this.ev({ t: 'skill', pid: owner.id, major: 'econ', name: '资本运作', detail: `+¥${bonus}` });
        }
        if (rent >= 10000) this.giveAch(owner, 'rent10k');
        this.addLog(`${p.name} 踩到 ${owner.name} 的「${cell.name}」，应付租金 ¥${rent}`);
        this.charge(p, rent, owner, `租金·${cell.name}`, idx);
        return;
      }
      case 'jail': {
        // 校园商城（v4.1）：免费领取一张「免租金卡」，可保留到之后回合，付租金时自动消耗（身上最多一张）
        if (p.medal > 0) {
          this.addLog(`${p.name} 逛了逛校园商城，身上已有免租金卡，店员摆摆手`); 
          this.afterResolve(p, false); return;
        }
        p.medal = 1;
        this.addLog(`🎫 ${p.name} 在校园商城免费领到一张「免租金卡」，下次应付租金时自动使用`);
        this.ev({ t: 'medalBuy', pid: p.id, price: 0 });
        this.afterResolve(p, false); return;
      }
      case 'tax': {
        this.addLog(`${p.name} 缴${cell.name} ¥${cell.amount}（进教育基金池）`);
        this.charge(p, cell.amount, null, cell.name, idx, true);
        return;
      }
      case 'gojail': {
        if (this.immune(p, '入狱')) { this.afterResolve(p, false); return; }
        p.skipNext = true;
        this.addLog(`${p.name} 挂科留级，休整一回合`);
        this.ev({ t: 'gojail', pid: p.id, cell: idx });
        this.aiChat(p, pick(['😭', '😤']));
        this.afterResolve(p, false); return;
      }
      case 'parking': {
        const got = this.fundPool;
        if (got > 0) {
          this.fundPool = 0; p.cash += got;
          this.addLog(`${p.name} 走进教育基金会，领取教育基金 ¥${got}！`);
          this.ev({ t: 'jackpot', pid: p.id, amount: got, cell: idx });
          this.aiChat(p, pick(['🤩', '🎉']));
          this.checkRichest(p);
        } else this.addLog(`${p.name} 走进教育基金会，可惜基金空空`);
        this.afterResolve(p, false); return;
      }
      case 'duel': {
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) { this.afterResolve(p, false); return; }
        const opp = pick(others);
        let a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        // 专业：军事 · 战术压制（自己点数 +1）
        if (p.major === 'mil' && p.skillLeft > 0) {
          a += 1; p.skillLeft--;
          this.addLog(`🎖️ ${p.name} 发动【战术压制】，擂台点数 +1`);
          this.ev({ t: 'skill', pid: p.id, major: 'mil', name: '战术压制', detail: '点数 +1' });
        }
        if (a === b) {
          this.addLog(`⚔️ 擂台！${p.name}(${a}) 与 ${opp.name}(${b}) 战成平手，各回各家`);
          this.ev({ t: 'duel', pid: p.id, opp: opp.id, a, b, winner: null, amount: 0 });
          this.afterResolve(p, false); return;
        }
        const winner = a > b ? p : opp, loser = a > b ? opp : p;
        const amount = Math.min(1500, loser.cash);
        this.addLog(`⚔️ 擂台！${p.name}(${a}) vs ${opp.name}(${b}) → ${winner.name} 胜，${loser.name} 付 ¥${amount}`);
        this.ev({ t: 'duel', pid: p.id, opp: opp.id, a, b, winner: winner.id, amount });
        if (amount > 0) {
          loser.cash -= amount; winner.cash += amount; loser.combo = 0;
          this.ev({ t: 'charge', pid: loser.id, amount, creditor: winner.id, reason: '擂台赌注', cell: idx, toPool: false });
          this.ev({ t: 'paid', pid: loser.id, amount, creditor: winner.id, toPool: false });
        }
        this.aiChat(loser, pick(['😵', '😤']), true);
        this.aiChat(winner, pick(['😎', '🤣']), true);
        this.afterResolve(p, false);
        return;
      }
      case 'junction': {
        // 长廊入口：持有 ≥3 块地皮才能进
        if (this.propCells(p).length >= BRANCH.NEED) {
          this.phase = 'branch';
          this.pendingBranch = { pid: p.id, cell: idx, line: 'A' };
          this.addLog(`🎓 ${p.name} 来到长廊入口：条件满足（持有 ≥${BRANCH.NEED} 块地皮），可进入「学术长廊」`);
          this.ev({ t: 'ask_branch', pid: p.id, cell: idx, line: 'A' });
          this.setTimer(TURN_MS, () => this.declineBranch(this.curp()));
          if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(3000, 6200)));
        } else {
          this.addLog(`${p.name} 路过长廊入口（需持有 ≥${BRANCH.NEED} 块地皮才能进岔路，现在 ${this.propCells(p).length} 块）`);
          this.afterResolve(p, false);
        }
        return;
      }
      case 'junction2': {
        // 大道入口（v4.2）：无门槛，人人可进，高风险高回报
        this.phase = 'branch';
        this.pendingBranch = { pid: p.id, cell: idx, line: 'B' };
        this.addLog(`🚀 ${p.name} 来到大道入口：可进入「创业大道」闯一闯（无门槛，高风险高回报）`);
        this.ev({ t: 'ask_branch', pid: p.id, cell: idx, line: 'B' });
        this.setTimer(TURN_MS, () => this.declineBranch(this.curp()));
        if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(3000, 6200)));
        return;
      }
      case 'invest': {
        // 科研投资所：一笔 ¥2000，2 轮后返还 ¥3600
        if (p.invest) { this.addLog(`${p.name} 已有一笔投资在途（第 ${p.invest.due} 轮返还 ¥${p.invest.back}）`); this.afterResolve(p, false); return; }
        if (p.cash < 2000) { this.addLog(`${p.name} 现金不足，错过科研投资`); this.afterResolve(p, false); return; }
        this.phase = 'invest';
        this.pendingInvest = { pid: p.id, cost: 2000, back: 3600, rounds: 2 };
        this.addLog(`🔬 ${p.name} 来到科研投资所：花 ¥2000 投资科研，2 轮后返还 ¥3600`);
        this.ev({ t: 'ask_invest', pid: p.id, cell: idx });
        this.setTimer(TURN_MS, () => this.declineInvest(this.curp()));
        if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiInvest(p), rnd(3000, 6000)));
        return;
      }
      case 'advisor': {
        // 导师办公室：心情随机
        if (Math.random() < 0.5) {
          p.cash += 1500;
          this.addLog(`☕ 导师今天心情好，请 ${p.name} 喝咖啡还发了补贴 +¥1500`);
          this.ev({ t: 'money', pid: p.id, amount: 1500, reason: '导师请喝咖啡' });
        } else {
          this.addLog(`📉 ${p.name} 被导师抓去搬实验室设备，累到打车回家 -¥1000`);
          this.charge(p, 1000, null, '搬设备打车费', idx, false);
          return;
        }
        this.afterResolve(p, false); return;
      }
      case 'shop': {
        // 神秘商店：随机送一件道具
        const gift = pick(['shield', 'voucher']);
        if (gift === 'shield') { p.shield = true; this.addLog(`🎁 神秘商店老板娘送了 ${p.name} 一张「免罚符」`); }
        else { p.voucher++; this.addLog(`🎁 神秘商店老板娘送了 ${p.name} 一张「免租券」`); }
        this.ev({ t: 'gift', pid: p.id, item: gift });
        this.afterResolve(p, false); return;
      }
      case 'ginkgo': {
        p.buffSteps = 3;
        this.addLog(`🎓 ${p.name} 逛奖学金长廊，心气大涨：下回合移动 +3`);
        this.ev({ t: 'buff', pid: p.id, steps: 3 });
        this.afterResolve(p, false); return;
      }
      case 'hall': {
        // 校友会馆：领基金池 25% 分红（至少 ¥600，池子不够由银行垫付）
        const take = Math.max(600, Math.floor(this.fundPool * 0.25));
        const fromPool = Math.min(take, this.fundPool);
        this.fundPool -= fromPool;
        const sub = take - fromPool;
        p.cash += take;
        this.addLog(`🏛️ ${p.name} 在校友会馆领取基金分红 ¥${take}${sub > 0 ? `（基金池见底，校友会垫付 ¥${sub}）` : ''}`);
        this.ev({ t: 'money', pid: p.id, amount: take, reason: '校友会馆分红' });
        this.afterResolve(p, false); return;
      }
      case 'exit': {
        // 校史馆（v5.0）：领 2 张免租金卡（可保留），但要在校史馆学习 2 回合，之后沿主路线继续
        p.medal += 2;
        p.skipTurns = Math.max(p.skipTurns || 0, 2);
        this.addLog(`🏛️ ${p.name} 参观校史馆：领到 2 张「免租金卡」（可保留），接下来要留在校史馆学习 2 回合`);
        this.ev({ t: 'medalGain', pid: p.id, count: 2 });
        this.afterResolve(p, false);
        return;
      }
      case 'exit2': {
        // 校企合作中心（v5.0）：领 ¥2500 现金，但要在里面学习 2 回合，之后沿主路线继续
        p.cash += 2500;
        p.skipTurns = Math.max(p.skipTurns || 0, 2);
        this.addLog(`🤝 ${p.name} 进入校企合作中心：领到 ¥2500 现金，但要留下学习 2 回合`);
        this.ev({ t: 'money', pid: p.id, amount: 2500, reason: '校企合作中心' });
        this.afterResolve(p, false);
        return;
      }
      case 'startup': {
        // 创业孵化器：投 ¥2000 路演，40% 成功返 ¥6000
        if (p.cash < 2000) { this.addLog(`${p.name} 现金不足，只能在创业孵化器围观别人路演`); this.afterResolve(p, false); return; }
        p.cash -= 2000;
        if (Math.random() < 0.4) {
          p.cash += 6000;
          this.addLog(`🚀 ${p.name} 创业路演大成功！投资人追投，净赚 ¥4000`);
          this.ev({ t: 'money', pid: p.id, amount: 6000, reason: '创业路演成功' });
          this.aiChat(p, pick(['🤩', '🤑']));
          this.checkRichest(p);
        } else {
          this.addLog(`💸 ${p.name} 路演冷场，¥2000 启动资金打了水漂（进教育基金池）`);
          this.ev({ t: 'charge', pid: p.id, amount: 2000, creditor: null, reason: '创业失败', cell: idx, toPool: true });
          this.addToFund(2000);
          this.ev({ t: 'paid', pid: p.id, amount: 2000, creditor: null, toPool: true });
        }
        this.afterResolve(p, false); return;
      }
      case 'exchange': {
        // 国际交流站（v5.0）：花 ¥1200 报名交换项目，70% 拿到 ¥4000 奖学金
        if (p.cash < 1200) { this.addLog(`${p.name} 现金不足，只能看看交换项目宣传册`); this.afterResolve(p, false); return; }
        p.cash -= 1200;
        if (Math.random() < 0.7) {
          p.cash += 4000;
          this.addLog(`🌍 ${p.name} 交换项目申请通过，拿到 ¥4000 奖学金（净赚 ¥2800）`);
          this.ev({ t: 'money', pid: p.id, amount: 4000, reason: '交换生奖学金' });
          this.aiChat(p, pick(['🤩', '🎉']));
          this.checkRichest(p);
        } else {
          this.addLog(`🌍 ${p.name} 交换名额被抢，¥1200 报名费打水漂`);
        }
        this.afterResolve(p, false);
        return;
      }
      case 'study': {
        // 通宵自习室：闭关一回合换奖学金
        p.skipNext = true; p.cash += 2500;
        this.addLog(`📚 ${p.name} 在通宵自习室闭关一回合，奖学金 ¥2500 到账`);
        this.ev({ t: 'money', pid: p.id, amount: 2500, reason: '闭关奖学金' });
        this.ev({ t: 'stay', pid: p.id });
        this.afterResolve(p, false); return;
      }
      case 'arena': {
        // 校园运动会：向总资产首富发起比赛
        const foes = this.alive().filter(q => q.id !== p.id);
        if (!foes.length) { this.afterResolve(p, false); return; }
        const rich = foes.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        let a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        if (p.major === 'mil' && p.skillLeft > 0) {
          a += 1; p.skillLeft--;
          this.addLog(`🎖️ ${p.name} 发动【战术压制】，运动会点数 +1`);
          this.ev({ t: 'skill', pid: p.id, major: 'mil', name: '战术压制', detail: '点数 +1' });
        }
        if (a === b) {
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 与首富 ${rich.name}(${b}) 战成平手，握手致意`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, winner: null, amount: 0 });
          this.afterResolve(p, false); return;
        }
        if (a > b) {
          const take = Math.min(2000, rich.cash);
          rich.cash -= take; p.cash += take; rich.combo = 0;
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 力压首富 ${rich.name}(${b})，赢走 ¥${take}！`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, winner: p.id, amount: take });
          if (take > 0) { this.ev({ t: 'charge', pid: rich.id, amount: take, creditor: p.id, reason: '校园运动会', cell: idx, toPool: false }); this.ev({ t: 'paid', pid: rich.id, amount: take, creditor: p.id, toPool: false }); }
          this.aiChat(p, pick(['💪', '😎']), true);
        } else {
          const pay = Math.min(1500, p.cash);
          p.cash -= pay; rich.cash += pay; p.combo = 0;
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 不敌首富 ${rich.name}(${b})，赔了 ¥${pay}`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, winner: rich.id, amount: pay });
          if (pay > 0) { this.ev({ t: 'charge', pid: p.id, amount: pay, creditor: rich.id, reason: '校园运动会', cell: idx, toPool: false }); this.ev({ t: 'paid', pid: p.id, amount: pay, creditor: rich.id, toPool: false }); }
        }
        this.afterResolve(p, false); return;
      }
      case 'market': {
        // 二手集市：淘货随机
        const r = Math.random();
        if (r < 0.3) {
          p.cash += 3000;
          this.addLog(`🛍️ ${p.name} 在二手集市淘到限量好物，转手净赚 ¥3000`);
          this.ev({ t: 'money', pid: p.id, amount: 3000, reason: '二手集市捡漏' });
          this.checkRichest(p);
        } else if (r < 0.7) {
          p.cash += 1000;
          this.addLog(`🧺 ${p.name} 摆摊卖出闲置，回血 ¥1000`);
          this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '二手集市出清' });
        } else {
          this.addLog(`🎭 ${p.name} 花钱买教训：淘到假货，亏了 ¥600`);
          this.ev({ t: 'charge', pid: p.id, amount: 600, creditor: null, reason: '二手集市买假货', cell: idx, toPool: false });
          this.tryPay(p, 600, null, false);
          return;
        }
        this.afterResolve(p, false); return;
      }
      case 'chance': this.drawCard(p, CHANCE, 'chance'); return;
      case 'fate': this.drawCard(p, FATE, 'fate'); return;
      default: this.afterResolve(p, false);
    }
  }

  scheduleBuy() { const p = this.curp(); if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBuy(), rnd(4200, 8800))); else this.setTimer(TURN_MS, () => this.declineBuy(this.curp())); }
  scheduleBuild() { const p = this.curp(); if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBuild(), rnd(3600, 7600))); else this.setTimer(TURN_MS, () => this.skipBuild(this.curp())); }

  buy(p) {
    if (this.phase !== 'buy' || !this.pendingBuy || this.pendingBuy.pid !== p.id) return;
    const { cell, mortgageBuy } = this.pendingBuy;
    const basePrice = this.pendingBuy.price;
    const cs = this.cells[cell], c = BOARD[cell];
    const usedDiscount = !!p.discount && !mortgageBuy;
    let price = basePrice, mathCut = false, geolCut = false;
    // 专业：数学 · 精算砍价（买入自动 8 折，与折扣卡不叠加）
    if (!mortgageBuy && !usedDiscount && p.major === 'math' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.8))) {
      price = Math.max(1, Math.round(basePrice * 0.8)); mathCut = true;
    }
    // 专业：地质 · 勘探评估（买入自动 9 折，与折扣卡不叠加）
    if (!mortgageBuy && !usedDiscount && p.major === 'geol' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.9))) {
      price = Math.max(1, Math.round(basePrice * 0.9)); geolCut = true;
    }
    if (p.cash < price) { this.declineBuy(p); return; }
    if (mathCut || geolCut) {
      p.skillLeft--;
      this.addLog(`${mathCut ? '📐' : '🗺️'} ${p.name} 发动【${mathCut ? '精算砍价' : '勘探评估'}】，买价 ¥${basePrice} → ¥${price}`);
      this.ev({ t: 'skill', pid: p.id, major: mathCut ? 'math' : 'geol', name: mathCut ? '精算砍价' : '勘探评估', detail: `省 ¥${basePrice - price}` });
    }
    p.cash -= price;
    cs.own = p.id; cs.mortgaged = false;
    if (p.discount) p.discount = false;
    this.addLog(`${p.name} 以 ¥${price} 买下「${c.name}」${usedDiscount ? '（8折卡生效）' : ''}${mathCut ? '（精算砍价）' : ''}${geolCut ? '（勘探评估）' : ''}`);
    this.ev({ t: 'buy', pid: p.id, cell, price, mortgageBuy: !!mortgageBuy });
    this.pendingBuy = null;
    this.checkOwnership(p);
    // v5.0 续·二：刚好买齐同色组 3 所 → 播一次「垄断达成」庆祝（对局中最多触发一次/每组）
    if (c.type === 'prop') {
      const gc = this.groupCells(c.g);
      if (gc.length && gc.every(i => this.cells[i].own === p.id)) {
        this.addLog(`🏆 ${p.name} 集齐 ${c.g.toUpperCase()} 色组 3 所名校，裸地租金 ×3！`);
        this.ev({ t: 'mono', pid: p.id, g: c.g, cells: gc.slice(), names: gc.map(i => BOARD[i].name) });
      }
    }
    this.aiChat(p, pick(['😎', '🤑']));
    this.afterResolve(p, true);
  }
  // 拥有地数量 / 色组垄断 → 成就
  checkOwnership(p) {
    let hold = 0;
    this.cells.forEach(cs => { if (cs.own === p.id) hold++; });
    if (hold >= 8) this.giveAch(p, 'tycoon');
    for (const g of Object.keys(GROUPS)) {
      const gc = this.groupCells(g);
      if (gc.length && gc.every(i => this.cells[i].own === p.id)) { this.giveAch(p, 'monopoly'); break; }
    }
  }
  declineBuy(p) {
    if (this.phase !== 'buy' || !this.pendingBuy || this.pendingBuy.pid !== p.id) return;
    const { cell, mortgageBuy } = this.pendingBuy;
    this.pendingBuy = null;
    if (mortgageBuy) { this.addLog(`${p.name} 放弃买走抵押地`); this.afterResolve(p, true); return; }
    this.startAuction(cell, p);
  }
  startAuction(cell, from) {
    const c = BOARD[cell];
    this.phase = 'auction';
    this.auction = { cell, highest: 0, bidder: null, endsAt: Date.now() + AUCTION_MS, maxBid: {} };
    this.addLog(`${from.name} 放弃购买，「${c.name}」进入公开拍卖（15 秒）`);
    this.ev({ t: 'auction_start', cell, ms: AUCTION_MS });
    this.setTimer(AUCTION_MS, () => this.endAuction());
    // AI 评估首轮出价
    for (const q of this.alive()) if (q.isAI) this.aiTimers.push(setTimeout(() => this.aiBid(q), rnd(3400, 11500)));
  }
  bid(p, amount) {
    if (this.phase !== 'auction' || !p.alive) return;
    const a = this.auction;
    if (!Number.isInteger(amount) || amount <= a.highest) return;
    if (amount > p.cash) return;
    a.highest = amount; a.bidder = p.id;
    this.ev({ t: 'auction_bid', pid: p.id, amount });
    this.setTimer(Math.max(4000, AUCTION_MS - (Date.now() - (a.endsAt - AUCTION_MS))), () => this.endAuction());
    if (p.isAI) return;
    for (const q of this.alive()) if (q.isAI && q.id !== p.id) this.aiTimers.push(setTimeout(() => this.aiBid(q), rnd(3000, 8000)));
  }
  endAuction() {
    if (this.phase !== 'auction') return;
    const a = this.auction, cell = a.cell, c = BOARD[cell];
    if (a.bidder) {
      const w = this.players.find(p => p.id === a.bidder);
      w.cash -= a.highest;
      this.cells[cell].own = w.id;
      this.addLog(`${w.name} 以 ¥${a.highest} 拍得「${c.name}」`);
      this.ev({ t: 'buy', pid: w.id, cell, price: a.highest, auction: true });
      this.checkOwnership(w);
    } else {
      this.addLog(`「${c.name}」无人出价，保持无主`);
      this.ev({ t: 'auction_none', cell });
    }
    this.auction = null;
    const p = this.curp();
    this.afterResolve(p, true);
  }

  build(p) {
    if (this.phase !== 'build' || !this.pendingBuild || this.pendingBuild.pid !== p.id) return;
    const { cell, cost } = this.pendingBuild;
    const cs = this.cells[cell], c = BOARD[cell];
    this.pendingBuild = null;
    if (c.type !== 'prop') { this.afterResolve(p, true); return; }
    if (cs.mortgaged) { this.addLog(`「${c.name}」处于抵押状态，赎回后才能升级`); this.afterResolve(p, true); return; }
    const baseCost = (cost != null) ? cost : GROUPS[c.g].build;
    let price = baseCost, archCut = false, mechCut = false;
    // 专业：建筑 · 造价管理（升级费用 -35%）
    if (p.major === 'arch' && p.skillLeft > 0 && p.cash >= Math.round(baseCost * 0.65) && cs.level < 4) {
      price = Math.max(1, Math.round(baseCost * 0.65)); archCut = true;
    }
    // 专业：机械 · 精益制造（升级费用 -20%）
    if (p.major === 'mech' && p.skillLeft > 0 && p.cash >= Math.round(baseCost * 0.8) && cs.level < 4) {
      price = Math.max(1, Math.round(baseCost * 0.8)); mechCut = true;
    }
    if (cs.level < 4 && p.cash >= price) {
      if (archCut || mechCut) {
        p.skillLeft--;
        this.addLog(`${archCut ? '🏗️' : '⚙️'} ${p.name} 发动【${archCut ? '造价管理' : '精益制造'}】，费用 ¥${baseCost} → ¥${price}`);
        this.ev({ t: 'skill', pid: p.id, major: archCut ? 'arch' : 'mech', name: archCut ? '造价管理' : '精益制造', detail: `省 ¥${baseCost - price}` });
      }
      p.cash -= price; cs.level++;
      const isHotel = cs.level === 4;
      this.addLog(`${p.name} 花 ¥${price} 将「${c.name}」升到 Lv${cs.level}${isHotel ? ' —— 旅馆落成！！' : ''}`);
      this.ev({ t: 'build', pid: p.id, cell, level: cs.level, cost: price, hotel: isHotel });
      if (isHotel) { this.giveAch(p, 'hotel'); this.aiChat(p, pick(['😎', '🤩'])); }
    } else {
      this.addLog(`${p.name} 放弃升级「${c.name}」`);
    }
    this.afterResolve(p, true);
  }
  skipBuild(p) {
    if (this.phase !== 'build' || !this.pendingBuild || this.pendingBuild.pid !== p.id) return;
    this.pendingBuild = null;
    this.addLog(`${p.name} 放弃升级`);
    this.afterResolve(p, true);
  }

  afterResolve(p, resolvable) {
    // 双数：同玩家再掷一次
    if (this.dice && this.dice[0] === this.dice[1] && p.alive) {
      this.addLog(`${p.name} 掷出双数，再掷一次！`);
      this.phase = 'roll';
      this.schedule();
      return;
    }
    this.endTurn();
  }

  // ---------- 租金与扣款 ----------
  groupCells(g) { const r = []; BOARD.forEach((c, i) => { if (c.type === 'prop' && c.g === g) r.push(i); }); return r; }
  calcRent(idx, dice) {
    const c = BOARD[idx], cs = this.cells[idx];
    if (cs.mortgaged) return 0;
    const owner = this.players.find(p => p.id === cs.own);
    let base = 0;
    if (c.type === 'prop') {
      if (cs.level > 0) {
        // v5.0：同色组内每所大学按自身裸地租金等比缩放，保证 30 所租金两两不同
        const gp = GROUPS[c.g];
        base = Math.round(gp.rents[cs.level - 1] * (c.rent / gp.refRent));
      }
      else {
        const full = this.groupCells(c.g).every(i => this.cells[i].own === owner.id);
        // v3.5：裸地租金 ×1.5（早期踩地有痛感），垄断 ×3（集齐一组价值更高）
        base = c.rent * (full ? 3 : 1.5);
      }
    } else if (c.type === 'transport') {
      const n = BOARD.reduce((s, cc, i) => s + (cc.type === 'transport' && this.cells[i].own === owner.id ? 1 : 0), 0);
      base = 900 * Math.pow(2, n - 1);   // v5.0：机场过路费小幅削弱
    } else if (c.type === 'util') {
      const n = BOARD.reduce((s, cc, i) => s + (cc.type === 'util' && this.cells[i].own === owner.id ? 1 : 0), 0);
      // 文印店/快递驿站：一家 = 点数×100，两家垄断 = 点数×400
      base = (dice ? dice[0] + dice[1] : 7) * (n >= 2 ? 400 : 100);
    }
    // 季节 × 天气 × 校历事件 × 收租连击
    let mul = SEASON[this.season].rentMul;
    const W = WEATHER[this.weather];
    if (W && W.rentMul) mul *= W.rentMul;
    if (this.calEvent && this.calEvent.mul) mul *= this.calEvent.mul;
    if (owner && owner.combo >= 2) mul *= 1 + Math.min(0.15 * (owner.combo - 1), 0.45);
    return Math.max(0, Math.round(base * mul));
  }

  charge(p, amount, creditor, reason, cellIdx, toPool = false) {
    this.ev({ t: 'charge', pid: p.id, amount, creditor: creditor ? creditor.id : null, reason, cell: cellIdx, toPool });
    if (p.isAI && amount >= 1000) this.aiChat(p, pick(['😭', '😱', '💸']));
    if (creditor && creditor.isAI && amount >= 1500) this.aiChat(creditor, pick(['🤑', '😆']));
    this.tryPay(p, amount, creditor, toPool);
  }
  checkCombo(p) { if ((p.combo || 0) >= 3) this.giveAch(p, 'combo3'); }
  tryPay(p, amount, creditor, toPool = false) {
    if (p.cash >= amount) {
      p.cash -= amount;
      if (creditor) {
        creditor.cash += amount;
        if (creditor.combo >= 2) { this.addLog(`🔥 ${creditor.name} 连击 ×${creditor.combo + 1} 收租`); this.ev({ t: 'combo', pid: creditor.id, n: creditor.combo + 1 }); }
        creditor.combo = (creditor.combo || 0) + 1;
        this.checkCombo(creditor); p.combo = 0;
      }
      else if (toPool) this.addToFund(amount);
      this.ev({ t: 'paid', pid: p.id, amount, creditor: creditor ? creditor.id : null, toPool });
      this.finishPay(p);
      return true;
    }
    // 需要筹钱
    const need = amount - p.cash;
    this.phase = 'raise';
    this.raise = { pid: p.id, need: amount, creditor: creditor ? creditor.id : null, toPool };
    this.addLog(`${p.name} 现金不足（还差 ¥${need}），请抵押地产或卖房筹钱（30 秒）`);
    this.ev({ t: 'ask_raise', pid: p.id, need, amount });
    this.setTimer(TURN_MS, () => this.forceSettleRaise());
    if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
    return false;
  }
  finishPay(p) {
    const mv = this._afterMove; this._afterMove = null;
    if (mv) { this.doCardMove(p, mv); return; }
    this.afterResolve(p, true);
  }
  mortgage(p, cell) {
    const cs = this.cells[cell], c = BOARD[cell];
    // 三个时机可主动抵押：①筹钱阶段 ②踩自己地准备升级（钱不够可先抵押凑钱）③轮到自己掷骰前
    const acting = (this.phase === 'raise' && this.raise && this.raise.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id)
      || (this.phase === 'roll' && this.curp() === p);
    if (!acting) return;
    if (cs.own !== p.id || cs.mortgaged) return;
    if (cs.level > 0) { // 先逐级回售建筑
      const back = cs.level * Math.floor(GROUPS[c.g].build / 2);
      cs.level = 0;
      p.cash += back;
      this.addLog(`${p.name} 将「${c.name}」的建筑回售给银行，回收 ¥${back}`);
    }
    let mp = Math.floor(c.price / 2);
    // 专业：金融 · 杠杆操作（抵押多拿 30%）
    if (p.major === 'fin' && p.skillLeft > 0) {
      const bonus = Math.round(mp * 0.3);
      mp += bonus; p.skillLeft--;
      this.addLog(`💰 ${p.name} 发动【杠杆操作】，抵押多拿 ¥${bonus}`);
      this.ev({ t: 'skill', pid: p.id, major: 'fin', name: '杠杆操作', detail: `+¥${bonus}` });
    }
    cs.mortgaged = true;
    p.cash += mp;
    this.addLog(`${p.name} 抵押「${c.name}」，获得 ¥${mp}`);
    this.ev({ t: 'mortgage', pid: p.id, cell });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  redeem(p, cell) {
    const cs = this.cells[cell], c = BOARD[cell];
    if (cs.own !== p.id || !cs.mortgaged) return;
    const mp = Math.floor(c.price / 2);
    if (p.cash < mp) return;
    p.cash -= mp; cs.mortgaged = false;
    this.addLog(`${p.name} 花 ¥${mp} 赎回「${c.name}」`);
    this.ev({ t: 'redeem', pid: p.id, cell });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  sellBuilding(p, cell) {
    const cs = this.cells[cell], c = BOARD[cell];
    if (cs.own !== p.id || cs.level === 0) return;
    const back = Math.floor(GROUPS[c.g].build / 2);
    cs.level--; p.cash += back;
    this.addLog(`${p.name} 将「${c.name}」降回 Lv${cs.level}，回收 ¥${back}`);
    this.ev({ t: 'sellb', pid: p.id, cell, level: cs.level });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  settleRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    const { need, creditor, toPool } = this.raise;
    if (p.cash >= need) {
      p.cash -= need;
      const cr = (creditor != null) ? this.players.find(q => q.id === creditor) : null;
      if (cr) { cr.cash += need; cr.combo = (cr.combo || 0) + 1; this.checkCombo(cr); p.combo = 0; }
      else if (toPool) this.addToFund(need);
      this.addLog(`${p.name} 筹齐资金，支付 ¥${need}`);
      this.ev({ t: 'paid', pid: p.id, amount: need, creditor, toPool });
      this.raise = null;
      this.finishPay(p);
    }
  }
  forceSettleRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    const need = this.raise.need;
    // 自动抵押最贵的地（mortgage 内部筹够会自动结算并清空 raise）
    let guard = 0;
    while (this.raise && p.cash < need && guard++ < 60) {
      const cand = BOARD.map((c, i) => ({ c, i })).filter(({ c, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged)
        .sort((a, b) => (b.c.price + (this.cells[b.i].level ? GROUPS[b.c.g].build : 0)) - (a.c.price + (this.cells[a.i].level ? GROUPS[a.c.g].build : 0)))[0];
      if (!cand) break;
      const before = p.cash;
      this.mortgage(p, cand.i);
      if (p.cash <= before) break;   // 无进展 → 退出，防死循环
    }
    if (this.raise && p.cash < need) this.bankrupt(p, (this.raise.creditor != null) ? this.players.find(q => q.id === this.raise.creditor) : null);
    else if (this.raise) this.settleRaise();
  }

  bankrupt(p, creditor) {
    p.alive = false;
    this.clearTimer(); this.clearAiTimers();
    let total = 0;
    BOARD.forEach((c, i) => {
      const cs = this.cells[i];
      if (cs.own !== p.id) return;
      if (creditor) {
        cs.own = creditor.id; // 已抵押的保持抵押状态
        this.ev({ t: 'transfer', cell: i, to: creditor.id });
      } else {
        total += Math.floor(c.price / 2) + (cs.level > 0 ? cs.level * Math.floor(GROUPS[c.g].build / 2) : 0);
        cs.own = null; cs.level = 0; cs.mortgaged = false;
      }
    });
    if (creditor) { creditor.cash += p.cash; this.addLog(`${p.name} 破产出局！全部资产移交给 ${creditor.name}`); }
    else { total += p.cash; this.addLog(`${p.name} 破产出局！资产清算给银行`); }
    p.cash = 0; p.voucher = 0; p.invest = null; p.buffSteps = 0; p.medal = 0; p.skipTurns = 0;
    this.ev({ t: 'bankrupt', pid: p.id, creditor: creditor ? creditor.id : null });
    if (creditor) { this.giveAch(creditor, 'assassin'); this.aiChat(creditor, pick(['😈', '🤣']), true); }
    this.raise = null;
    if (this.checkWin()) return;
    this.endTurn();
  }

  checkWin() {
    const alive = this.alive();
    if (this.phase === 'over') return true;
    if (this.startedAt && alive.length === 1) {
      this.phase = 'over';
      alive[0].wins++;
      this.addLog(`🏆 ${alive[0].name} 是最后的赢家！`);
      this.ev({ t: 'gameover', winner: alive[0].id });
      return true;
    }
    return false;
  }

  // ---------- 抽卡 ----------
  drawCard(p, deck, type) {
    let card = pick(deck);
    // 专业：新闻 · 独家爆料（抽到负面卡时自动重抽一次）
    if (p.major === 'news' && p.skillLeft > 0 && this.isBadCard(card)) {
      const c2 = pick(deck);
      if (!this.isBadCard(c2)) {
        p.skillLeft--;
        this.ev({ t: 'skill', pid: p.id, major: 'news', name: '独家爆料', detail: '重抽卡牌' });
        card = c2;
      }
    }
    this.addLog(`${p.name} 抽到${type === 'chance' ? '机会' : '命运'}卡「${card.name}」：${card.desc}`);
    this.ev({ t: 'card', pid: p.id, type, card });
    // 专业：艺术 · 灵感迸发（抽到正面机会卡额外 +¥700）
    if (type === 'chance' && p.major === 'lang' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 900;
      this.addLog(`🌍 ${p.name} 发动【多语种优势】+¥900`);
      this.ev({ t: 'skill', pid: p.id, major: 'lang', name: '多语种优势', detail: '+¥900' });
      this.ev({ t: 'money', pid: p.id, amount: 900, reason: '多语种优势' });
    }
    if (type === 'chance' && p.major === 'art' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 700;
      this.addLog(`🎨 ${p.name} 发动【灵感迸发】+¥700`);
      this.ev({ t: 'skill', pid: p.id, major: 'art', name: '灵感迸发', detail: '+¥700' });
      this.ev({ t: 'money', pid: p.id, amount: 700, reason: '灵感迸发' });
    }
    // 专业：戏剧 · 全场入戏（抽到任意机会/命运卡时额外 +¥500）
    if (p.major === 'drama' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 500;
      this.addLog(`🎭 ${p.name} 发动【全场入戏】+¥500`);
      this.ev({ t: 'skill', pid: p.id, major: 'drama', name: '全场入戏', detail: '+¥500' });
      this.ev({ t: 'money', pid: p.id, amount: 500, reason: '全场入戏' });
    }
    this.applyCard(p, card);
  }
  isBadCard(c) {
    if (!c) return false;
    const badKinds = ['skip', 'sabotage', 'demolishLand', 'demolishHouse', 'selfLoseLand', 'selfLoseHouse', 'jailSelf', 'taxAll', 'richPayPool', 'richPayPct'];
    if (badKinds.includes(c.kind)) return true;
    if (c.kind === 'money' && c.amount < 0) return true;
    if (c.kind === 'move' && c.steps < 0) return true;
    if (c.kind === 'each' && c.dir === 'out') return true;
    return false;
  }
  // 某玩家持有的「地产类」地块（可盖房）数量 / 建筑总级数
  propCells(p) { return BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop' && this.cells[i].own === p.id); }
  buildSum(p) { return this.propCells(p).reduce((s, i) => s + this.cells[i].level, 0); }
  aliveList() { return this.players.filter(q => q.alive); }
  // 法学 · 法律援助：抵消一次不利判定
  immune(p, why) {
    if (!p || (p.major !== 'law' && p.major !== 'phil') || p.skillLeft <= 0) return false;
    p.skillLeft--;
    this.addLog(`⚖️ ${p.name} 发动【法律援助】，免除「${why}」`);
    this.ev({ t: 'skill', pid: p.id, major: 'law', name: '法律援助', detail: `免除「${why}」` });
    return true;
  }
  applyCard(p, card) {
    switch (card.kind) {
      case 'money': {
        if (card.amount >= 0) { p.cash += card.amount; this.ev({ t: 'money', pid: p.id, amount: card.amount, reason: card.name }); this.afterResolve(p, false); }
        else {
          this.ev({ t: 'charge', pid: p.id, amount: -card.amount, creditor: null, reason: card.name, cell: p.pos, toPool: false });
          this._afterMove = card.thenMove || null;
          const ok = this.tryPay(p, -card.amount, null, false);
          if (ok && this._afterMove) { const mv = this._afterMove; this._afterMove = null; this.doCardMove(p, mv); }
        }
        return;
      }
      case 'moveTo': {
        p.pos = card.cell;
        if (card.salary) {
          if (this.salaryOn()) { p.cash += SALARY; this.ev({ t: 'money', pid: p.id, amount: SALARY, reason: '工资' }); }
          else this.addLog(`❄️ 经济寒冬：银行停发工资，${p.name} 没领到钱`);
        }
        this.ev({ t: 'teleport', pid: p.id, cell: card.cell });
        this.resolveCell(p);
        return;
      }
      case 'move': { this.doCardMove(p, card.steps); return; }
      case 'each': {
        const others = this.players.filter(q => q.alive && q.id !== p.id);
        if (card.dir === 'in') {
          let total = 0;
          for (const q of others) { const pay = Math.min(q.cash, card.amount); q.cash -= pay; total += pay; }
          p.cash += total;
          this.addLog(`${p.name} 从每位玩家处收到共 ¥${total}`);
          this.ev({ t: 'each', pid: p.id, amount: total, dir: 'in' });
        } else {
          for (const q of others) {
            const pay = Math.min(q.cash, card.amount);
            q.cash -= pay; p.cash += pay;
            this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: p.id, reason: card.name, cell: p.pos, toPool: false });
            this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: p.id, toPool: false });
          }
        }
        this.afterResolve(p, false); return;
      }
      case 'skip': { p.skipNext = true; this.afterResolve(p, false); return; }
      case 'discount': {
        p.discount = true;
        this.addLog(`${p.name} 获得 8 折购地卡（本轮有效）`);
        // 立即询问是否就地使用？简化：仅标记，下次踩到无主地时生效；若本轮不踩则作废
        this.afterResolve(p, false); return;
      }
      case 'moveAnyTrans': {
        const trans = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'transport');
        const t = pick(trans);
        p.pos = t.i;
        this.ev({ t: 'teleport', pid: p.id, cell: t.i });
        this.resolveCell(p); return;
      }
      case 'voucher': { p.voucher++; this.afterResolve(p, false); return; }
      case 'bounty': {   // 悬赏令：向当前最富有的玩家索取赏金
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) { this.afterResolve(p, false); return; }
        const rich = others.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        const pay = Math.max(0, Math.min(card.amount, rich.cash));
        rich.cash -= pay; p.cash += pay; rich.combo = 0;
        this.addLog(`📢 ${p.name} 发布悬赏，向最富有的 ${rich.name} 收取 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: p.id, reason: '悬赏令', cell: p.pos, toPool: false });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: p.id, toPool: false });
        this.afterResolve(p, false); return;
      }
      case 'sabotage': { // 陷害：随机一名对手下回合移动受损
        const foes = this.alive().filter(q => q.id !== p.id);
        if (foes.length) {
          const t = pick(foes);
          if (this.immune(t, '被人陷害')) { this.afterResolve(p, false); return; }
          t.sabotage = (t.sabotage || 0) + card.steps;
          this.addLog(`😈 ${p.name} 暗中操作，${t.name} 下回合移动 ${card.steps} 格`);
        }
        this.afterResolve(p, false); return;
      }
      case 'demolishLand': {   // 地皮最多的人被拆掉一块地皮
        const cand = this.aliveList().filter(q => this.propCells(q).length > 0);
        if (!cand.length) { this.addLog('全场没有可拆的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const maxN = Math.max(...cand.map(q => this.propCells(q).length));
        const pool = cand.filter(q => this.propCells(q).length === maxN);
        const t = pick(pool);
        if (this.immune(t, '校园改造拆地')) { this.afterResolve(p, false); return; }
        const cells = this.propCells(t);
        const ci = cells.sort((a, b) => this.cells[b].level - this.cells[a].level)[0];
        const cn = BOARD[ci].name;
        this.cells[ci].own = null; this.cells[ci].level = 0; this.cells[ci].mortgaged = false;
        this.addLog(`🏗️ 【校园改造】${t.name} 的「${cn}」被拆除，地块归还银行`);
        this.ev({ t: 'demolish', pid: t.id, cell: ci, kind: 'land', name: cn });
        this.afterResolve(p, false); return;
      }
      case 'demolishHouse': {  // 房子最多的人被拆掉一栋房
        const cand = this.aliveList().filter(q => this.buildSum(q) > 0);
        if (!cand.length) { this.addLog('全场没有可拆的房子，卡牌作废'); this.afterResolve(p, false); return; }
        const maxN = Math.max(...cand.map(q => this.buildSum(q)));
        const pool = cand.filter(q => this.buildSum(q) === maxN);
        const t = pick(pool);
        if (this.immune(t, '违建拆除')) { this.afterResolve(p, false); return; }
        const cells = this.propCells(t).filter(i => this.cells[i].level > 0).sort((a, b) => this.cells[b].level - this.cells[a].level);
        const ci = cells[0];
        this.cells[ci].level--;
        this.addLog(`🚧 【违建举报】${t.name} 的「${BOARD[ci].name}」被拆掉一栋房（现 Lv${this.cells[ci].level}）`);
        this.ev({ t: 'demolish', pid: t.id, cell: ci, kind: 'house', level: this.cells[ci].level, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfLoseLand': {   // 自己失去一块地皮
        const cells = this.propCells(p);
        if (!cells.length) { this.addLog('你名下没有可卖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        if (this.immune(p, '变卖地皮')) { this.afterResolve(p, false); return; }
        const ci = cells.sort((a, b) => (BOARD[a].price - BOARD[b].price))[0];
        this.cells[ci].own = null; this.cells[ci].level = 0; this.cells[ci].mortgaged = false;
        this.addLog(`📉 ${p.name} 变卖资产，「${BOARD[ci].name}」归还银行`);
        this.ev({ t: 'demolish', pid: p.id, cell: ci, kind: 'land', self: true, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfLoseHouse': {
        const cells = this.propCells(p).filter(i => this.cells[i].level > 0);
        if (!cells.length) { this.addLog('你名下没有可拆的房子，卡牌作废'); this.afterResolve(p, false); return; }
        if (this.immune(p, '房子失修拆除')) { this.afterResolve(p, false); return; }
        const ci = cells.sort((a, b) => this.cells[b].level - this.cells[a].level)[0];
        this.cells[ci].level--;
        this.addLog(`💥 ${p.name} 的「${BOARD[ci].name}」年久失修被拆除（现 Lv${this.cells[ci].level}）`);
        this.ev({ t: 'demolish', pid: p.id, cell: ci, kind: 'house', self: true, level: this.cells[ci].level, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfBuild': {      // 免费给自己盖一栋房
        const cells = this.propCells(p).filter(i => this.cells[i].level < 4);
        if (!cells.length) { this.addLog('没有可加盖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const ci = cells.sort((a, b) => this.cells[a].level - this.cells[b].level)[0];
        this.cells[ci].level++;
        const hotel = this.cells[ci].level === 4;
        this.addLog(`🎁 ${p.name} 白得施工队，「${BOARD[ci].name}」升到 Lv${this.cells[ci].level}${hotel ? ' —— 旅馆落成！' : ''}`);
        this.ev({ t: 'cardBuild', pid: p.id, cell: ci, level: this.cells[ci].level, hotel });
        this.afterResolve(p, false); return;
      }
      case 'poorestBuild': {   // 房子最少的人免费盖一栋房
        const cand = this.aliveList().filter(q => this.propCells(q).some(i => this.cells[i].level < 4));
        if (!cand.length) { this.addLog('没有可加盖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const minN = Math.min(...cand.map(q => this.buildSum(q)));
        const pool = cand.filter(q => this.buildSum(q) === minN);
        const t = pick(pool);
        const cells = this.propCells(t).filter(i => this.cells[i].level < 4).sort((a, b) => this.cells[a].level - this.cells[b].level);
        const ci = cells[0];
        this.cells[ci].level++;
        const hotel = this.cells[ci].level === 4;
        this.addLog(`🤝 房子最少的 ${t.name} 获得学弟学妹帮忙，「${BOARD[ci].name}」升到 Lv${this.cells[ci].level}${hotel ? ' —— 旅馆落成！' : ''}`);
        this.ev({ t: 'cardBuild', pid: t.id, cell: ci, level: this.cells[ci].level, hotel, help: true });
        this.afterResolve(p, false); return;
      }
      case 'taxAll': {         // 全体各支付 X 进基金池
        let sum = 0;
        for (const q of this.aliveList()) {
          const pay = Math.min(q.cash, card.amount);
          q.cash -= pay; sum += pay;
          this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: null, reason: card.name, cell: q.pos, toPool: true });
          this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true });
        }
        this.addToFund(sum);
        this.addLog(`🧾 ${card.name}：全体共缴 ¥${sum} 进教育基金池`);
        this.afterResolve(p, false); return;
      }
      case 'jailSelf': {
        if (this.immune(p, '入狱')) { this.afterResolve(p, false); return; }
        p.skipNext = true;
        this.addLog(`🚔 ${p.name} ${card.name}，进监狱反省一回合`);
        this.ev({ t: 'gojail', pid: p.id, cell: p.pos });
        this.afterResolve(p, false); return;
      }
      case 'poorestMoney': {   // 翻盘：总资产最低的玩家获得资助
        const aliveP = this.aliveList();
        if (aliveP.length > 1) {
          const poor = aliveP.slice().sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
          poor.cash += card.amount;
          this.addLog(`🎁 ${card.name}：总资产垫底的 ${poor.name} 获得 ¥${card.amount}`);
          this.ev({ t: 'money', pid: poor.id, amount: card.amount, reason: card.name });
        }
        this.afterResolve(p, false); return;
      }
      case 'poorestEach': {    // 翻盘：总资产最低的玩家向其他每位玩家收帮扶金
        const aliveE = this.aliveList();
        if (aliveE.length > 1) {
          const poor = aliveE.slice().sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
          let sum = 0;
          for (const q of aliveE) {
            if (q.id === poor.id) continue;
            const pay = Math.min(q.cash, card.amount);
            if (pay <= 0) continue;
            q.cash -= pay; poor.cash += pay; sum += pay;
            this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: poor.id, reason: card.name, cell: q.pos });
            this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: poor.id });
          }
          if (sum > 0) {
            this.addLog(`🤝 ${card.name}：总资产垫底的 ${poor.name} 收到帮扶金 ¥${sum}`);
            this.ev({ t: 'money', pid: poor.id, amount: sum, reason: card.name });
          }
        }
        this.afterResolve(p, false); return;
      }
      case 'richPayPool': {    // 首富税：总资产最高的玩家向基金池付款（现金不够会进入筹钱流程，可能被逼破产）
        const aliveR = this.aliveList();
        if (aliveR.length > 1) {
          const rich = aliveR.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
          if (this.immune(rich, card.name)) { this.afterResolve(p, false); return; }
          this.addLog(`💣 ${card.name}：总资产最高的 ${rich.name} 需向教育基金池支付 ¥${card.amount}`);
          if (rich.cash >= card.amount) {
            rich.cash -= card.amount; this.addToFund(card.amount);
            this.ev({ t: 'charge', pid: rich.id, amount: card.amount, creditor: null, reason: card.name, cell: rich.pos, toPool: true });
            this.ev({ t: 'paid', pid: rich.id, amount: card.amount, creditor: null, toPool: true });
            this.afterResolve(p, false);
          } else {
            this.dice = null;   // 付款方≠抽卡者时，不能让"双数再掷"落到付款方头上
            this.phase = 'raise';
            this.raise = { pid: rich.id, need: card.amount, creditor: null, toPool: true };
            this.addLog(`${rich.name} 现金不足（还差 ¥${card.amount - rich.cash}），请抵押地产或卖房筹钱（30 秒）`);
            this.ev({ t: 'ask_raise', pid: rich.id, need: card.amount - rich.cash, amount: card.amount });
            this.setTimer(TURN_MS, () => this.forceSettleRaise());
            if (rich.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
          }
          return;
        }
        this.afterResolve(p, false); return;
      }
      case 'richPayPct': {     // 首富税：按总资产/现金比例缴纳
        const aliveC = this.aliveList();
        if (aliveC.length > 1) {
          const rich = aliveC.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
          if (this.immune(rich, card.name)) { this.afterResolve(p, false); return; }
          const baseVal = card.base === 'cash' ? rich.cash : this.netWorth(rich);
          const amount = Math.max(0, Math.round(baseVal * card.pct / 100));
          if (amount > 0) {
            this.addLog(`💣 ${card.name}：总资产最高的 ${rich.name} 需缴纳 ¥${amount} 进教育基金池`);
            if (rich.cash >= amount) {
              rich.cash -= amount; this.addToFund(amount);
              this.ev({ t: 'charge', pid: rich.id, amount, creditor: null, reason: card.name, cell: rich.pos, toPool: true });
              this.ev({ t: 'paid', pid: rich.id, amount, creditor: null, toPool: true });
              this.afterResolve(p, false);
            } else {
              this.dice = null;
              this.phase = 'raise';
              this.raise = { pid: rich.id, need: amount, creditor: null, toPool: true };
              this.addLog(`${rich.name} 现金不足（还差 ¥${amount - rich.cash}），请抵押地产或卖房筹钱（30 秒）`);
              this.ev({ t: 'ask_raise', pid: rich.id, need: amount - rich.cash, amount });
              this.setTimer(TURN_MS, () => this.forceSettleRaise());
              if (rich.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
            }
            return;
          }
        }
        this.afterResolve(p, false); return;
      }
      default: this.afterResolve(p, false);
    }
  }
  doCardMove(p, steps) {
    const path = [];
    let pos = p.pos, passedGo = false;
    for (let i = 0; i < Math.abs(steps); i++) {
      pos = (pos + (steps > 0 ? 1 : 47)) % 48;
      path.push(pos);
      if (steps > 0 && pos === 0) passedGo = true;
    }
    p.pos = pos;
    if (passedGo && this.salaryOn()) {
      p.cash += SALARY; this.ev({ t: 'money', pid: p.id, amount: SALARY, reason: '工资' });
      if (p.major === 'ee' && p.skillLeft > 0) { p.skillLeft--; p.cash += 1000; this.addLog(`🔌 ${p.name} 发动【信号增益】+¥1000`); this.ev({ t: 'skill', pid: p.id, major: 'ee', name: '信号增益', detail: '+¥1000' }); this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '信号增益' }); }
      if (p.major === 'agri' && p.skillLeft > 0) { p.skillLeft--; p.cash += 1500; this.addLog(`🌾 ${p.name} 发动【春华秋实】+¥1500`); this.ev({ t: 'skill', pid: p.id, major: 'agri', name: '春华秋实', detail: '+¥1500' }); this.ev({ t: 'money', pid: p.id, amount: 1500, reason: '春华秋实' }); }
    }
    this.ev({ t: 'move', pid: p.id, path, final: pos });
    this.resolveCell(p);
  }

  // ---------- 投票结束 ----------
  requestEnd(p) {
    if (this.phase !== 'roll' && this.phase !== 'build' && this.phase !== 'buy') return;
    this.vote = { asker: p.id, votes: { [p.id]: true } };
    this.addLog(`${p.name} 发起"结束游戏"投票，需全体同意`);
    this.ev({ t: 'vote_start', pid: p.id });
    for (const q of this.alive()) if (q.isAI) this.aiTimers.push(setTimeout(() => this.aiVote(q), rnd(3000, 6800)));
    this.checkVote();
  }
  voteEnd(p, yes) {
    if (!this.vote) return;
    this.vote.votes[p.id] = !!yes;
    this.checkVote();
  }
  checkVote() {
    if (!this.vote) return;
    const alive = this.alive();
    if (alive.every(q => this.vote.votes[q.id] === true)) this.settleEnd();
    else if (alive.every(q => this.vote.votes[q.id] !== undefined)) {
      this.addLog(`投票未通过，游戏继续`);
      this.ev({ t: 'vote_no' });
      this.vote = null;
    }
  }
  netWorth(p) {
    let v = p.cash;
    BOARD.forEach((c, i) => {
      const cs = this.cells[i];
      if (cs.own !== p.id) return;
      if (cs.mortgaged) v += Math.floor(c.price / 2);
      else { v += c.price + (cs.type === 'prop' ? cs.level * GROUPS[c.g].build : 0); }
    });
    return v;
  }
  settleEnd() {
    const ranked = this.alive().map(p => ({ p, v: this.netWorth(p) })).sort((a, b) => b.v - a.v);
    this.phase = 'over';
    ranked[0].p.wins++;
    this.addLog(`🤝 全体同意结束。${ranked[0].p.name} 以总资产 ¥${ranked[0].v} 获胜！`);
    this.ev({ t: 'gameover', winner: ranked[0].p.id, ranked: ranked.map(r => ({ pid: r.p.id, v: r.v })) });
  }

  // ---------- 拟人 AI ----------
  safety(p) {
    // 动态现金安全线：越到后期/威胁越大，越要留钱
    const threat = BOARD.reduce((s, c, i) => s + (this.cells[i].own && this.cells[i].own !== p.id && !this.cells[i].mortgaged && this.cells[i].level >= 2 ? 1 : 0), 0);
    return 6000 + threat * 900;
  }
  aiAct() {
    const p = this.curp();
    if (!p || !p.isAI || p.id !== this.curp().id) return;
    if (this.phase === 'roll') this.doRoll(p);
  }
  aiBuy() {
    const pb = this.pendingBuy; if (!pb) return;
    const p = this.players.find(q => q.id === pb.pid);
    if (!p || !p.isAI) return;
    const cell = pb.cell, c = BOARD[cell];
    const price = (pb.price != null) ? pb.price : c.price;
    const safety = this.safety(p);
    // 威胁评估：这地被别人买走对我最疼 → 更愿意买
    let maxPrice = price;
    if (c.type === 'prop') {
      const myInGroup = this.groupCells(c.g).filter(i => this.cells[i].own === p.id).length;
      if (myInGroup >= 1) maxPrice = price * 1.4; // 凑组关键地
    }
    const canPay = p.cash - price >= safety * (c.type === 'prop' ? 0.55 : 0.75);
    if ((p.cash >= price && canPay) || (pb.mortgageBuy && p.cash >= price)) this.buy(p);
    else this.declineBuy(p);
  }
  aiBuild() {
    const pb = this.pendingBuild; if (!pb) return;
    const p = this.players.find(q => q.id === pb.pid);
    if (!p || !p.isAI) return;
    const cs = this.cells[pb.cell], c = BOARD[pb.cell];
    if (c.type !== 'prop') { this.skipBuild(p); return; }
    const cost = (pb.cost != null) ? pb.cost : GROUPS[c.g].build;
    // 领先时更激进，落后时保守
    const others = this.alive().filter(q => q.id !== p.id);
    const myNW = this.netWorth(p);
    const avgNW = others.reduce((s, q) => s + this.netWorth(q), 0) / Math.max(1, others.length);
    const lead = myNW / Math.max(1, avgNW);
    const need = this.safety(p) * (lead > 1.2 ? 0.5 : 0.85);
    if (p.cash - cost >= need && cs.level < 4) this.build(p);
    else if (cs.level < 4) {
      // 钱不够但有闲置地：抵押最便宜的一块凑钱升级（保留安全垫，且不抵押当前要升级的这块）
      const cand = BOARD.map((c2, i2) => ({ c: c2, i: i2 }))
        .filter(({ c: c2, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged && i !== pb.cell)
        .sort((a, b) => a.c.price - b.c.price)
        .find(({ c: c2 }) => p.cash + Math.floor(c2.price / 2) - cost >= need);
      if (cand) {
        this.mortgage(p, cand.i);
        if (p.cash - cost >= need && !this.cells[pb.cell].mortgaged) this.build(p);
        else if (this.phase === 'build') this.skipBuild(p);
      } else this.skipBuild(p);
    }
    else this.skipBuild(p);
  }
  aiBid(p) {
    if (this.phase !== 'auction' || !this.auction || !p.alive) return;
    const a = this.auction, c = BOARD[a.cell];
    if (a.bidder === p.id) return;
    const already = a.maxBid[p.id];
    if (already === undefined) {
      let cap = c.price * rnd(1.2, 1.5);
      if (c.type === 'prop') {
        const myInGroup = this.groupCells(c.g).filter(i => this.cells[i].own === p.id).length;
        const oppInGroup = this.groupCells(c.g).filter(i => this.cells[i].own && this.cells[i].own !== p.id).length;
        if (myInGroup >= 2) cap *= 1.5;           // 就差这一块
        else if (oppInGroup >= 2) cap *= 1.35;     // 绝不能让对手凑齐
      }
      if (this.netWorth(p) < this.alive().reduce((s, q) => s + this.netWorth(q), 0) / this.alive().length) cap *= 0.85; // 落后略保守
      a.maxBid[p.id] = Math.min(Math.floor(cap), p.cash - this.safety(p) * 0.4);
    }
    const cap = a.maxBid[p.id];
    const next = Math.min(cap, (a.highest || Math.floor(c.price * 0.1)) + 100 * Math.ceil(rnd(100, 500) / 100));
    if (next > a.highest && next <= cap && next <= p.cash) this.bid(p, next);
  }
  aiRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    if (!p || !p.isAI) return;
    let guard = 0;
    while (this.raise && p.cash < this.raise.need && guard++ < 60) {
      const cand = BOARD.map((c, i) => ({ c, i })).filter(({ c, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged)
        .sort((a, b) => b.c.price - a.c.price)[0];
      if (!cand) break;
      const before = p.cash;
      this.mortgage(p, cand.i);                 // 内部筹够会自动结算并清空 raise
      if (p.cash <= before || this.phase !== 'raise') break;  // 无进展/已结算 → 立刻退出，防死循环
    }
    if (!this.raise) return;                    // 已在 mortgage 内结算完毕
    if (p.cash < this.raise.need) this.bankrupt(p, (this.raise.creditor != null) ? this.players.find(q => q.id === this.raise.creditor) : null);
    else this.settleRaise();
  }
  aiVote(p) {
    if (!this.vote || this.vote.votes[p.id] !== undefined) return;
    const asker = this.players.find(q => q.id === this.vote.asker);
    const myNW = this.netWorth(p);
    const best = Math.max(...this.alive().map(q => this.netWorth(q)));
    this.voteEnd(p, asker.id !== p.id ? myNW >= best : true);
  }
}

module.exports = { Room, BOARD, GROUPS, CHANCE, FATE, SALARY, START_CASH, SEASON, SEASON_ORDER, WEATHER, CALEVENTS, MAJORS, MAJOR_KEYS, ACHS, ITEMS, FUND_CAP, ENDGAME_ROUND, REROLL_COST, BRANCH, BRANCH2 };
