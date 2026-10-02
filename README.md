<div align="center">

# 没事就玩大富翁

**2~5 人联机网页大富翁 · 打开链接就能开一局**

没有客户端，不用注册 —— 发一个 6 位房间号，朋友输进去就能进来。

[🎮 在线试玩](https://fudan-monopoly.app.workbuddy.host/)

![整屏](docs/screenshots/screen.jpg)

</div>

---

## 这是什么

一款**纯网页的联机大富翁**：把 30 所中国名校买下来，靠收租把朋友逼到破产。房主建房拿到一个 6 位房间号，朋友在大厅输入即入局；人不够可以补 AI 到 5 人。

支持麦克风语音房、24 个表情、32 句快捷语音（聊天气泡会自动朗读），以及一整套粒子特效与音效。

## 玩法要点

| 机制 | 说明 |
|---|---|
| **棋盘** | 48 格环形主路线（16 × 10 排布），棋盘正中还有两条各 7 格的岔路 |
| **回合** | 每个回合只做三件事：掷骰 → 落格 → 结算 |
| **买地** | 落到无主的地可以买下；自己不买时进入全场拍卖 |
| **造访升级制** | 不靠「盖房」堆，靠反复造访升级：裸地 ¥1100 → 1 房 ¥3500 → 2 房 ¥8100 → 3 房 ¥16800 → 旅馆 ¥31500 |
| **租金四重系数** | 最终租金 = 基准租金 × 季节系数 × 天气系数 × 校历系数 × 连击系数，是「乘」出来的 |
| **抵押** | 随时可按 50% 抵押换现金，但抵押中的地被别人买走就没了 |
| **机会 / 命运** | 各 61 张卡，一股力量扶弱、一股力量劫富 |
| **道具三件套** | 免罚符（分段涨价、当轮过期）/ 免租金卡 / 免租券，消耗顺序固定 |
| **两条岔路** | 学术长廊（低风险奖励线，需持 ≥2 块地）vs 创业大道（无门槛，赌一把） |
| **市场周期** | 淡季 / 平季 / 旺季价格双向浮动，每 3 轮一次校历事件（共 14 种） |
| **成长与对抗** | 23 个专业身份、7 个成就、连击加成，还能在竞技场直接向首富发起对决 |
| **结束** | 第 15 轮起银行停发工资，全场转入存量博弈；一局约 40 ~ 60 分钟 |

<div align="center">

![棋盘](docs/screenshots/board.jpg)

</div>

## 快速开始

需要 **Node.js ≥ 18**，没有任何 npm 依赖。

```bash
git clone https://github.com/kylian567/university-monopoly.git
cd university-monopoly/app
node server.js
```

然后打开 <http://localhost:3000> 即可。想和朋友联机，把 `localhost` 换成你机器的局域网 IP。

## 项目结构

```
university-monopoly/
├── app/                     # 游戏本体（零依赖 Node.js）
│   ├── server.js            # HTTP 静态服务 + 房间路由 + WebSocket / SSE
│   ├── game.js              # 游戏引擎：棋盘、规则、结算、AI（纯逻辑，可离线跑）
│   ├── simulate.js          # AI 自动对局
│   ├── test_v50.js          # 引擎单测（v5.0 数值）
│   ├── test_v40.js          # 引擎单测（v4.x 回归）
│   ├── smoke_v50.js         # Playwright 端到端冒烟
│   └── public/              # 前端
│       ├── index.html
│       ├── client.js        # 渲染 + 粒子特效 + 音效 + 语音
│       └── style.css
├── docs/screenshots/        # README 配图
├── 游戏设计文档.md           # 完整设计文档（棋盘表 / 数值表 / 机制说明 / 版本历史）
└── LICENSE
```

## 实现要点

- **服务端权威**：`game.js` 是独立的纯逻辑引擎，服务端算完再广播状态，客户端只负责渲染。开源改成单机版只需换掉传输层。
- **零依赖**：只用 Node 内置的 `http` / `crypto` / `fs` / `path`，没有 `node_modules`，clone 下来直接跑。
- **双通道同步**：优先 WebSocket，环境不支持时自动回退 SSE，连接层对上层透明。
- **断线重连**：6 位房间号 + 玩家 token，刷新页面不会掉局。
- **可部署**：端口读 `process.env.PORT`，可直接部署到 Render / Railway / Fly.io 等支持长连接的平台。注意 **GitHub Pages 只能托管静态页面，跑不了这个游戏**（联机需要服务端）。

<div align="center">

![粒子特效](docs/screenshots/fx.jpg)

</div>

## 测试

```bash
cd app
node test_v50.js    # 45 通过 / 0 失败
node test_v40.js    # 41 通过 / 0 失败
node simulate.js    # 跑一局完整 AI 自动对局，直到出赢家
node smoke_v50.js   # Playwright 端到端（需另行安装 playwright）
```

## 说明

- 游戏内高校**名称与学费定价**参考 **2026 QS 世界大学排名**（中国内地 + 中国香港）的公开数据，仅用于娱乐性玩法设计，**与任何高校官方无关，属非官方同人作品**。
- 未使用任何高校校徽或 logo 图片，棋盘图标全部为 emoji。

## License

[MIT](LICENSE)
