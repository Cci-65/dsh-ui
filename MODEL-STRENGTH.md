# model-strength-picker（模型思考强度选择器）

> **并入说明（2026-10-20）**：原独立插件 `@local/model-strength-picker`（v0.10.1）已整体合并进 `@local/dsh-ui`（v1.2.0 起）。其客户端源码现为 `client-model-strength.js`，由 `build.mjs` 内联进本包单一 client bundle；本文档原样保留，描述的全部行为在合并后不变（模块内 `PKG_ID` 等标识仍为原值）。

为 DeepSeek Harness（DSH）的**第三方模型**补充可配置的思考强度档位。

UI 分两处：

- **模型选择器座位**（`conversation.input.model` 插槽，`priority: -10` 顶替内置选择器——该槽位升序取最小者渲染，内置为默认 `0`）：点击输入框工具行的「选择模型」按钮，弹出 **290px 宽的浮层**（按 `model-strength` 原型）：顶部胶囊（档位名 + 模型名 + ›）、底部推理强度滑块（轨道 **23px**、旋钮 **30px**，档位圆点与旋钮全部为 **SVG 几何**：`<rect rx>` / `<circle>`，不使用 `border-radius`、`clip-path`、`transform` 或百分比宽度，因此在桌面端与网页端渲染一致）；**点击胶囊**以 150ms 淡入展开模型下拉（**30px** 选项行、按压实色、选中 ✓，外部按下/Escape 收起，Ctrl+Shift+M 切换，档位名 150ms 淡入淡出）。下拉覆盖在卡片上、左右与卡片对齐，**底边与推理强度浮层的底边对齐**（对话中从该底边向上长，不是胶囊正下方；新会话 hero 布局下改为向下长）。下拉**高度固定为推理强度卡片高度的 2 倍**（`height: 200%`，自动跟随卡片实际高度；另有 `100vh - 24px` 的屏幕兜底），**模型放不下才出现滚动条**；打开时整块浮层会按其真实高度重新摆放，因此永远完整可见、不会被视口切掉。浮层定位两态：输入框上方空间足够时相对触发按钮水平居中、置于上方；**新会话 hero 布局下右对齐挂到输入框卡片下缘，卡片与模型下拉的顶边与输入框底边完全贴齐（不留缝）**；两种模式都夹在视口内，并随滚动/窗口变化重定位。面板崩溃时自动退位、内置选择器无缝接管。数据与 `/model` 命令共享同一份会话模型目录（`ctx.modelDirectories`），当前选中状态处处一致。
- **设置 → 模型 页底部**（`settings.models.footer` 插槽）：「思考强度档位」卡片，集中配置每个 Pi-AI 路由模型提供的档位与思考开关格式。只有 Pi-AI 路由的模型可编辑，其余路由（档位由适配器内置提供）**折叠成一行只读汇总**，不再各占一行。

## 它做什么

1. **档位声明（第三方模型的核心缺口）**
   手工录入 / 发现的 OpenAI 兼容模型默认不声明任何 reasoning level，组合器的 Effort 菜单不会出现。本插件把你在面板里勾选的档位写进 `llm-pi-ai` 配置中对应模型的 `reasoningEfforts`（档位 id → `reasoning_effort` 线级拼写；`off` 留空 = 不发送参数）。`providers` 是 volatile 配置，写入后立即生效，无需重启。
   - 可勾选档位：`off / minimal / low / medium / high / max`（**`xhigh` 已停用**，见「注意事项」）
   - **思考开关格式**：DeepSeek 系模型经 OpenAI 兼容网关接入时「默认一直思考」，off 不发送参数无法关闭 —— 选择 `DeepSeek 兼容` 会为该模型写 `compat.thinkingFormat: deepseek`（off 发送 `thinking: {type: disabled}`，其余档位发送 `thinking: {type: enabled}` + effort）。
2. **应用档位（当前会话）**
   滑块提交后调用共享模型目录的 `directory.select`（provider + model + reasoningEffort），也就是内置 Effort 菜单的同一通道；插件本身不做任何持久化——「作为新会话默认值保存」是 `session.selectModel` 自带的宿主行为。

## 安装

任选其一（把 `<路径>` 换成插件目录的绝对路径）：

- **DSH Web UI**：侧边栏「插件 / Plugins」→ 安装 → 本地路径 `<路径>`。
- **在 DSH 会话里让 agent 装**：「请用 plugin_manager 安装本地 bundle：<路径>」。
- **CLI**：`dsh plugin --profile <profile> add <路径>`

`<路径>` = 本目录（含 `package.json` 与 `cordis.patch.yml`）。本 bundle **零外部依赖**，可离线安装。

## 使用

1. 安装后（必要时刷新页面），点击输入框里的「选择模型」按钮即弹出模型 + 强度面板。
2. 列表选模型、拖动滑块选强度，即选即用（提交完整选择，并保存为新会话默认）。
3. 配置档位：打开 **设置 → 模型**，页面底部「思考强度档位」卡片列出 Pi-AI 路由的模型——点「编辑」勾选要提供的档位、按需填写线级值与思考开关格式 → 保存。保存后立即生效，选择器的强度滑块即出现这些档位。**勾选多个模型后点「统一编辑」**，一份草稿（取第一个所选模型的当前声明）保存到所有所选模型，适合同一网关下型号一批配置的场景；保存逐个模型写入，失败会报出进度、已写入的保持不动，可直接重试。不可编辑的模型（档位由适配器内置提供）收在卡片底部的一行只读汇总里，鼠标悬停可看完整名单。编辑器会对照模型目录标注档位支持情况（勾选目录未宣告的档位时给出琥珀色提醒，目录没说则不打扰）；两个档位的**线级值重复**会在保存时被拦下（网关无法区分）；「清除」需二次确认。
4. 设置路由默认：卡片顶部「默认思考强度」**按路由逐行**显示——下拉直接改该路由的默认（先确认；未配置过档位的模型会顺带补全声明），选「未设置」即清除该路由默认；下拉里目录未宣告的档位带「（目录未宣告）」标注，且该路由有模型不支持所选档位时确认框会提前说明「默认可能不会写入」。多个路由可用底部「统一所有路由为…」一键拉齐：一次确认、逐个路由写入、失败报进度可重试。

## 文件结构

```
model-strength-picker/
├── package.json          dsh.bundle.patch + dsh.client（web 客户端模块）
├── cordis.patch.yml      插入宿主插件行（id: model-strength-picker）
├── index.js              宿主半边：空实现（全部逻辑在客户端模块）
├── client.js             Web 面板（React，挂 conversation.input.model + settings.models.footer）
├── icon.svg / locale/    插件卡片图标与展示文案
├── model-strength.html   静态设计原型（对照用，不参与运行，也不在 package.json 的 files 白名单内）
└── README.md
```

## 注意事项与边界

- **适用范围**：档位声明只对 `llm-pi-ai` 路由的模型可编辑；DeepSeek 官方路由（`llm-deepseek` 适配器）自带 Off/Low/High/Max，无需也不可在此配置。
- **`xhigh` 已停用**：编辑器不再提供该档位，自动声明与「默认思考强度」也不会再写入它。但 `xhigh` 在 `llm-pi-ai` 的 schema 里依然合法，所以**如果某个模型的配置里已经写了 `xhigh`，它会被原样保留**——打开再保存不会丢（该模型行仍会显示 X-High 标签），只有点「清除」才会连同它一起清空。若确实需要重新启用这个档位，把 `client.js` 里的 `RETIRED_LEVELS` 改成 `[]` 即可。
- 档位的线级拼写默认与档位同名（如 `high` → `reasoning_effort: "high"`）；网关自有词汇（如 `max: xhigh`）可手动编辑 profile 的 `cordis.patch.yml` 微调。
- 面板写入 `llm-pi-ai` 时会把读取到的该路由 `models` 列表整体回写（数组整体替换语义），因此对同一模型条目上其它字段是保留式编辑；与 Models 页共用同一配置层。
- **从 v0.1.x 升级**：旧版的「子 Agent 默认」功能已删除。若你当时设置过，其值仍留在 profile 补丁 `tool-subagent` 行的 `agentOptions.reasoningEffort`，不需要时请在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中手动移除该键。
- DSH 处于开发者预览阶段，`settings` / `session` remote 的形态可能变化；若更新后失效，按新版本调整 `client.js`。

## 实现备注：滑块为什么用 SVG

桌面端（Electron 壳）曾经把滑块画错：档位圆点渲染成**方块**（`border-radius: 50%` 被丢弃）、旋钮渲染成**方圆角**（`border-radius: 9999px` 解析异常），而同样的写法在浏览器里完全正常。逐步排查后确认：

- 不是版本或缓存问题（已核对三份副本与符号链接）；
- 不是圆角写法问题（隔离页面上 `3px` / `50%` / `9999px` / SVG 四种写法在桌面端**全部正常**）；
- 因此把几何整体移入 SVG 后，桌面端与网页端渲染一致。

滑块**几何**相关的 `border-radius`、`clip-path`、`transform`、百分比宽度已**全部移除**——请勿用它们画轨道、填充、刻度点或旋钮。唯一例外是 Max 档的星空动效（`.msp-nebula-*` / `.msp-max-stars` / `.msp-max-sweep` / `.msp-burst-*` 的 `@keyframes`），它用 `transform` 做位移与缩放、`skewX` 做扫光倾斜，且已被 `prefers-reduced-motion` 关闭；这些动画不参与任何几何布局。

### 拖动吸附 + 位移动画

拖动旋钮时**不跟手连续移动**，只在刻度点上停驻；换档时旋钮**从旧刻度点滑到新刻度点**，不瞬移。

**逻辑层 —— 立即生效**

- 每帧取最近档 `idx = clamp(round(frac × (n-1)), 0, n-1)`，写进 `dragFraction` 的是 `idx/(n-1)` 而非连续的 `frac`；
- 指针跨过相邻两档的正中（`round` 的 .5 上取语义）才换档；越过端点钳在首/末档，不越界；
- `shownIndex`、预览回调、松手提交、Max 特效的触发都用这一层，所以档位一换就生效，不等动画跑完。

**视觉层 —— `requestAnimationFrame` 补间**

- `knobX = cy + inner * visual`、`fillW`、`showFill` 全部由 `visual` 推导；`visual` 由 rAF 以 **ease-out**（`1 - (1-t)³`）补向 `fraction`，时长约 `TWEEN_MS = 120ms`；
- 旋钮与填充一起滑动——`showFill` 判的是 `visual`，所以滑到 Off 时填充是**随旋钮一起缩没**，不是瞬间消失；
- **位置只写进 SVG 属性（`cx` / `width`）**：不要改用 CSS `transform` 或 `transition` 实现动画。那既破坏本滑块「几何一律 SVG 原语」的约定，`transform` 还会动错盒子（transform 的参照框与 `cx` 不同）。注意 SVG 的 `cx` / `width` **本身是可 `transition` 的 CSS 属性**，误加一行 transition 就会变成双重动画。
- 补间 effect 的依赖是 `fraction`：换档会取消上一段 rAF 并从当前位置续滑，不会闪回。

**保持原样**：点击轨道吸附、拖动阈值（10px）、键盘方向键 / Home / End、松手提交的档位算法。**不要**把连续 `frac` 写进 `dragFraction`，否则旋钮会重新跟手滑动。

### 悬停反馈（仅鼠标）

桌面鼠标专属，触屏自动跳过：所有悬停处理器都检查 `pointerType === 'mouse'`，`touch` / `pen` 一律忽略，按下/拖动行为不受影响。

- **悬停旋钮**：光标 `grab`，旋钮 `r` 15→16.5（外环同步 14.5→16，始终紧贴旋钮边缘），投影增强到 `drop-shadow(0 2px 6px rgba(0,0,0,0.28))`，约 120ms；**按下拖动中**光标 `grabbing`、投影保持既有 dragging 规则的最深一档（0.32），**松开还原**。拖动期间 pointer capture 会吞掉 over/out，所以 `endDrag` 松手时按旋钮最终落点重算一次悬停态，并**直接驱动 r 补间**——不能只切类等下一次 pointerover 来补，否则松手停在旋钮上会出现「grab 光标 + 悬停投影但旋钮还是小号」的错位。
- **悬停刻度点**：该点 `r` 3→4.5 并提亮（100ms 数值补间）——露在灰轨道上的点把 `fill` 换成深灰（`--dsw-alias-border-l2`，比点基色 `l3` 高一档、明暗主题自适应；想换别的深浅改 `DOT_HOVER_FILL` 一处即可），被填充盖住的点把半透明白点的 `opacity` 0.4→0.75（渲染时白点写的是纯白 fill + `opacity` 属性，与原 `rgba(255,255,255,0.4)` 同效，补间的就是 opacity 本身）；移开还原（`fill` 也复原）。点上方浮出该档档位名小标签（常驻一枚、靠 `.on` 淡入淡出，`pointer-events: none`，纯 HTML 不属于滑块几何）。Max 档刻度点整体淡出后，悬停提示与点击跳档仍然可用。
- **实现约束**：几何变化一律由 `tweenSvgAttr` 数值补间直接写 SVG 属性（ease-out rAF，按「元素+属性」记账、重复触发先取消上一段），不用 CSS transform 缩放几何，也**不给几何属性挂 CSS transition**；投影走 `filter` 的 CSS 过渡（120ms），filter 不是几何属性。旋钮与刻度点各有一层**透明命中圆**（旋钮 r=17 盖在外环之上、半径 ≥ 悬停视觉半径以免放大/缩回抖动；刻度点 r=8 盖在可见点之上而旋钮之下）——悬停不再要求精确瞄中 3px 的小点，旋钮压住的点也不会被误报悬停。`.msp-burst` 补了 `pointer-events: none`，迸发小点从旋钮上起飞时不会盖住旋钮命中区。**悬停投影规则必须放在 dragging 投影规则之前**（同为 (0,3,0) 特异性靠源顺序让拖动的最深投影胜出）。焦点环、点击吸附、拖动阈值、位移动画一概未动。

### Max 档星空轨道

**静态分层**（自下而上，全部 SVG 原语，由 `clipPath` 裁在填充区的圆角矩形内）：

| 层 | 内容 | 出现时机 |
|---|---|---|
| 1 渐变底 `msp-max-base` | 左→右 `#2f6fed → #5a4bf0 → #7c3ff0 → #8b5cf6`（右端**亮堇紫**，不是深紫） | Max 档 |
| 2 星云 ×2 `msp-nebula-layer` | 径向渐变圆 r=14 / r=11，白核 → `rgba(200,180,255,0.45)` → 透明，`feGaussianBlur stdDeviation=3` | **只在 Max 档**（与其余层一起）；一团悬在旋钮左侧附近，一团在轨道中部偏右 |
| 3 星点 ×28 `msp-max-stars` | 白色 `<circle>`，半径 0.5–1.6px，其中 4 颗稍大并带 `drop-shadow(0 0 2px)` 光晕 | Max 档 |
| 4 高光 ×2 `msp-max-sweep-layer` | 两条 35% 宽的白色高光带，**两端透明**，`skewX(-12deg)`，峰值不透明度 0.22 | **只在 Max 档**（整层由 `.level-max` 门控），两条相位错开半周期交替扫过 |
| 5 旋钮光晕 `.msp-svg-thumb.halo` | 白旋钮外一圈 `drop-shadow(0 0 6px)` 柔光 | Max 档 |
| 迸发 `.msp-burst` | 12 颗淡紫小点（r 1.5–4px，`#a78bfa` / `#c4b5fd`）从旋钮边缘偏上偏右飞散 30–80px | **一次性**：旋钮落到最高档的那一瞬 |

进入 Max 时，轨道上原有的刻度点（灰轨道灰点与填充下的白点，即 `.msp-svg-dots` / `.msp-svg-dots-on` 两组）随 250ms 一起淡出，星空接管轨道；离开 Max 时同步淡入。悬停提示与点击跳档不受影响。

**动画**（只动 `transform` / `opacity`）：星星闪烁 2.2–5.5s 随机负延迟错峰、星群漂移 ±5px/16s、星云漂移 9s 与 12s、两条白色高光带每 7s 扫过（相位错开半周期）；进出各 250ms 淡入淡出。

**颜色全部走 CSS 变量**（`--max-grad-stop-*` / `--max-nebula-*` / `--max-star-*` / `--max-knob-halo` / `--max-sweep-opacity` / `--max-burst-*`），便于主题化。

#### 维护约定

1. **`.msp-max-fx` 只在最高档可见，但它在 Off 以上的所有档位都会渲染** —— 父级 `opacity: 0` **不会**停掉子元素的动画。因此有**一道冻结门**：`.msp-slider:not(.level-max) .msp-max-fx *` 统一 `animation-play-state: paused`。**新增动画元素时务必落在 `.msp-max-fx` 之内**，否则这条规则盖不到它。
2. **每层自己带 `opacity`，`.msp-max-fx` 自身不能带**。四层现在都是「最高档才出现」，阈值一致；分开写只是为了将来某层想单独提前或延后时不必再拆结构。新增图层要同时做两件事：类名加进那条共享的 `opacity: 0` 规则，并接进 `.level-max` 的 `opacity: 1` 列表——漏掉后者它会在所有档位都可见。
3. **两条高光都必须带负 `animation-delay`**。`mspSweep` 的前 55% 是「屏幕外 + `opacity: 0`」；动画被冻结后从 0 恢复的话，到达 Max 会有约 3.9 秒完全看不到高光。第一条 `-3.9s` 让它停在即将入场的相位上；第二条 `.second` 用 `-0.4s`，与第一条错开半个周期，否则两条会锁在一起只显得一条。**高光层的 opacity 由 `.level-max` 门控，这是「只在最高档出现」的唯一保证**——把 `opacity` 加回 `.msp-max-fx` 或给高光层单独放开都会破坏它。
4. **迸发画在 `clipPath` 之外**（在旋钮之后）。小点要飞出轨道，裁在填充区里就没了。它是**一次性**的：靠 `key: burstKey` 重挂来重播，改结构时别丢掉这个 key。
5. **`prefers-reduced-motion` 下只留静态渐变**：动画全关，扫光与迸发 `display: none`，星云与星点一并隐去——留下的只有渐变底和旋钮光晕这两层完全静止的图形。注意扫光的位移与透明度**只写在 keyframes 里**，动画一停会回落成轨道左侧一块白斑，所以必须 `display: none` 而不是只停动画。
6. **SVG `filter` 是有意保留的**：星云的 `feGaussianBlur`、光晕星的 `drop-shadow(0 0 2px)`、旋钮光晕的 `drop-shadow(0 0 6px)` 都是规格指定的视觉。这类滤镜作用在被 `transform` 动画驱动的元素上时会每帧重新栅格化，是已知的性能代价。若日后要换回零滤镜近似，可用多段 `radialGradient` 顶替（历史实现见 `client.js.bak-before-maxspec-*`）。
