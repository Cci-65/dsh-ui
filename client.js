/*!
 * @local/dsh-ui client bundle —— 构建产物，请勿直接编辑本文件。
 * 源文件：client-app.js（主模块逻辑）+ client-model-strength.js（模型强度选择器）
 * + styles.css（皮肤样式）。
 * 修改后运行 `node build.mjs` 重新生成；宿主按文件 mtime/size 计算组合路由 rev。
 */
/**
 * @local/dsh-ui Client Module
 *
 * DeepSeek Harness 视觉皮肤与输入栏交互增强
 * + 模型思考强度选择器（原 @local/model-strength-picker，2026-10-20 并入）
 *
 * 本包是两个原插件的合并体：宿主 client-modules 组合路由要求「每个包一个
 * bundle 文件」，因此 client.js 产物只注册 @local/dsh-ui 一个模块 id，
 * 其 factory 同时物化两套模块逻辑（dsh-ui 皮肤套件 + 强度选择器），
 * inject 声明取并集，apply 依序执行。model-strength-picker 的完整源码
 * 在 client-model-strength.js，由 build.mjs 内联到下方标记处。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-ui',
  factory(require) {
    const React = require('react');

    // 诊断：统计本页 client 模块被评估的次数（>1 意味着有重复注入），
    // 随 /api/debug 一并落盘。
    try { window.__dshUiBootCount = (window.__dshUiBootCount || 0) + 1; } catch (e) {}

    // NOTE: 旧版本曾 monkey-patch window.matchMedia，让 prefers-reduced-motion
    // 恒为 true 以压制 AgentPresetSeat 入场动画。该写法会泄漏到整个宿主应用
    // （所有插件与原生组件都丢失真实的动效偏好），且插件 dispose 后无法还原。
    // 现在改由下方 `._oGoKq_intro*` 精准 CSS 规则压制同一动画，不碰全局状态。

    const STYLE_TAG_ID = 'dsh-ui-css';

    // ------------------------------------------------------------------
    // 共享常量（原魔法数集中管理，附取值依据）
    // ------------------------------------------------------------------
    const BRIDGE_API = 'http://127.0.0.1:19389'; // dsh-ui 本地桥接（bridge.mjs）
    const ACCOUNT_MENU_ANCHOR_LEFT_PX = 68;      // 账号菜单锚点：固定栏右侧（视频位置）
    const ACCOUNT_MENU_ANCHOR_BOTTOM_PX = 10;    // 账号菜单锚点：贴窗口底部
    const ACCOUNT_MENU_ARM_WINDOW_MS = 1200;     // 点击账号触发器后监听菜单浮层的窗口
    const ACCOUNT_MENU_WATCH_INTERVAL_MS = 120;  // 菜单回跳盯防间隔
    const ACCOUNT_MENU_WATCH_WINDOW_MS = 1500;   // 盯防总时长
    const HISTORY_SUPPRESS_STEP_MS = 80;   // 历史抑制解除的探测步长
    const HISTORY_SUPPRESS_MIN_MS = 240;   // 抑制最短窗口（防快导航被吞）
    const HISTORY_SUPPRESS_CAP_MS = 600;   // 抑制上限（防慢导航早泄漏）
    const HISTORY_MAX_ENTRIES = 60;              // 视图历史栈上限
    // 执行环境（本地/云端）选择目前只是视觉组件：选择仅写 localStorage、
    // 没有真实行为对接。默认隐藏避免误导；宿主提供真实执行目标 API 后
    // 置 true 即可恢复整套交互。
    const SHOW_EXEC_TARGET = false;

    // HTML-escape any string before it is concatenated into innerHTML.
    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // 调试开关：localStorage.dsh_ui_debug = '1' 后，关键 catch 不再静默
    // （默认保持静默：宿主 DOM 变动导致的良性失败不应刷屏）。
    const DEBUG = (() => { try { return localStorage.getItem('dsh_ui_debug') === '1'; } catch (e) { return false; } })();
    function dbg(...args) {
      if (!DEBUG) return;
      try { console.debug('[dsh-ui]', ...args); } catch (e) {}
    }

    const CSS = `
/* ==========================================================================
   Antigravity 1:1 Visual Skin & Hero Layout for DeepSeek Harness
   ========================================================================== */

/* 共享弹层高度：D1 技能弹窗（.dsh-ag-skills-menu）与 D2 插件弹窗
   （.dsh-ag-plugins-menu）固定为同一总高，保证两窗打开时视觉等高。
   210px = 技能行 34px × 6 行 + 容器上下内边距 3px × 2；
   调整时两处高度跟随此变量，无需分别改。 */
:root {
  --dsh-ag-popover-menu-h: 210px;
}

/* 1. Hero Container & Flex Stacking */
.Dc7zOa_composerHero,
[class*="composerHero"],
[data-conversation-region="composer"] [class*="composerStack"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  width: 100% !important;
  max-width: var(--dsh-composer-card-max-width, 1140px) !important;
  min-width: min(680px, 100%) !important;
  margin: 0 auto !important;
  padding: 0 !important;
  gap: 0 !important;
}

[class*="composerHero"] > *,
[class*="composerHero"] [data-composer-card],
[class*="InputBar_root"],
[class*="_root"]:has([data-composer-card]) {
  width: 100% !important;
  box-sizing: border-box !important;
}

/* 侧栏开关（E2）收起时锁定欢迎区宽度：卡片/工作区行/底部灰条保持"展开态"
   的宽度，不随中栏变宽而拉宽，只整体重新居中（对齐 ChatGPT 桌面版行为）。
   --dsh-hero-lock-w 由 client.js 在展开态持续记录欢迎区实际宽度；
   冷启动即处于收起态且无记录时回退 1140px，展开一次后即校准。 */
.BynINW_frame[data-sidebar-collapsed] .Dc7zOa_composerHero,
.BynINW_frame[data-sidebar-collapsed] [class*="composerHero"],
[class*="_frame"][data-sidebar-collapsed] .Dc7zOa_composerHero,
[class*="_frame"][data-sidebar-collapsed] [class*="composerHero"],
html.dsh-native-host-mode .Dc7zOa_composerHero,
html.dsh-native-host-mode [class*="composerHero"] {
  max-width: min(var(--dsh-hero-lock-w, var(--dsh-composer-card-max-width, 1140px)), 100%) !important;
  min-width: min(680px, 100%) !important;
}

/* 会话模式同机制：锁定目标 = 消息线程 + 输入卡片的最低公共祖先列
   （client.js 运行时发现并打标记类 dsh-conv-lock-target），展开态记录
   --dsh-conv-lock-w，收起态封顶并 margin:auto 居中；再展开恢复原宽。
   CSS 随 data-sidebar-collapsed 属性即时收放，不依赖扫描触发。 */
.BynINW_frame[data-sidebar-collapsed] .dsh-conv-lock-target,
[class*="_frame"][data-sidebar-collapsed] .dsh-conv-lock-target,
html.dsh-native-host-mode .dsh-conv-lock-target {
  max-width: min(var(--dsh-conv-lock-w, var(--dsh-composer-card-max-width, 1140px)), 100%) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

/* 2. Top Hero Headline (DeepSeek Logo + 探索未至之境 + 预览版) */
.Hqq-bq_root {
  order: 1 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  margin-bottom: 22px !important;
  padding: 0 !important;
}

.Hqq-bq_headline {
  font-size: 26px !important;
  font-weight: 500 !important;
  color: #0E1014 !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

.Hqq-bq_fish {
  color: #0E1014 !important;
  width: 38px !important;
  height: 28px !important;
}

.Hqq-bq_previewBadge {
  background: #EEF2FB !important;
  color: #2F54EB !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 2px 8px !important;
  border-radius: 999px !important;
  border: 0.5px solid rgba(47, 84, 235, 0.18) !important;
  margin-top: 2px !important;
  font-family: inherit !important;
  line-height: 18px !important;
}

/* 3. Composer Input Card (White Box) */
.RlGAzG_root,
[class*="InputBar_root"] {
  order: 3 !important;
  width: 100% !important;
  max-width: var(--dsh-composer-card-max-width, 1140px) !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  position: relative !important;
  z-index: 20 !important;
}

.RlGAzG_root:focus-within,
.RlGAzG_root:has([class*="MenuView_menu"]),
.RlGAzG_root:has([class*="overlayAnchor"] > *),
[class*="InputBar_root"]:has([class*="overlayAnchor"] > *) {
  z-index: 1000 !important;
}

.RlGAzG_card,
[data-composer-card] {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: var(--dsh-composer-card-max-width, 1140px) !important;
  background: #FFFFFF !important;
  border: 1px solid #E5E7EB !important;
  border-radius: 24px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
  padding: 16px 18px 12px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  position: relative !important;
  z-index: 20 !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}


/* Focus or non-hero standalone card */
:not(.Dc7zOa_composerHero):not([class*="composerHero"]) .RlGAzG_card,
:not(.Dc7zOa_composerHero):not([class*="composerHero"]) [data-composer-card] {
  border-radius: 24px !important;
}

.RlGAzG_card:focus-within,
[data-composer-card]:focus-within {
  border-color: #D1D5DB !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
}

/* 4. Textarea & Placeholder */
.RlGAzG_input {
  min-height: 48px !important;
  font-size: 15px !important;
  line-height: 24px !important;
  color: #111827 !important;
  caret-color: #2F6FED !important;
  padding: 2px 4px !important;
  outline: none !important;
}

.RlGAzG_placeholder {
  font-size: 15px !important;
  line-height: 24px !important;
  color: #9CA3AF !important;
  padding: 2px 4px !important;
}

/* 5. Tool Row Inside Card */
.RlGAzG_row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 4px 0 0 !important;
  margin: 0 !important;
}

.RlGAzG_tools {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* '+' Command button */
.RlGAzG_add {
  width: 28px !important;
  height: 28px !important;
  border-radius: 50% !important;
  background: #F4F5F6 !important;
  color: #374151 !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: background-color 0.15s ease !important;
  padding: 0 !important;
}
.RlGAzG_add:hover {
  background: #EAEBED !important;
}
.RlGAzG_add svg {
  width: 14px !important;
  height: 14px !important;
  color: #4B5563 !important;
}

/* Permission selector chip (工作区内修改) */
[class*="triggerLabel"],
    [class*="permission"] button {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  font-size: 13px !important;
  color: #4B5563 !important;
  font-weight: 400 !important;
  border-radius: 6px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  padding: 3px 6px !important;
  line-height: 20px !important;
}
[class*="permission"] button:hover {
  background: rgba(0, 0, 0, 0.04) !important;
}

/* 6. Trailing Controls (Model selector + Send button) */
.RlGAzG_trailing {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  margin-left: auto !important;
}

.RlGAzG_standardControls {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* Model selector trigger */
.msp-trigger,
    button[aria-label*="模型"],
    button[aria-label*="Model"] {
  font-size: 13px !important;
  color: #4B5563 !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  background: transparent !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 0 6px !important;
  cursor: pointer !important;
}
.msp-trigger:hover {
  background: rgba(0, 0, 0, 0.04) !important;
}

/* Send / Primary Button (Circle with blue background and white arrow up) */
.RlGAzG_primary,
    button[aria-label="发送"],
    button[aria-label="Send"],
    button[aria-label="停止"],
    button[aria-label="Stop"] {
  width: 34px !important;
  height: 34px !important;
  min-width: 34px !important;
  min-height: 34px !important;
  border-radius: 999px !important;
  color: #FFFFFF !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transform: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease !important;
}

/* 1) Enabled / Active State (when text is entered in input, matches Screenshot 2) */
.RlGAzG_primary:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    .RlGAzG_primary[data-has-content="true"],
    button[aria-label="发送"]:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="发送"][data-has-content="true"],
    button[aria-label="Send"]:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="Send"][data-has-content="true"],
    button[aria-label="停止"]:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="Stop"]:not(:disabled):not([disabled]):not([aria-disabled="true"]) {
  background: var(--dsw-alias-button-info-fill, #4176E6) !important;
  opacity: 1 !important;
  cursor: pointer !important;
  pointer-events: auto !important;
}

/* 2) Hover State when Enabled */
.RlGAzG_primary:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    .RlGAzG_primary[data-has-content="true"]:hover,
    button[aria-label="发送"]:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="发送"][data-has-content="true"]:hover,
    button[aria-label="Send"]:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="Send"][data-has-content="true"]:hover,
    button[aria-label="停止"]:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]),
    button[aria-label="Stop"]:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]) {
  background: var(--dsw-alias-button-info-hover, #3464CB) !important;
  opacity: 1 !important;
}

/* 3) Click / Press State when Enabled */
.RlGAzG_primary:active:not(:disabled):not([disabled]):not([aria-disabled="true"]) {
  background: #2F5ECD !important;
  transform: scale(0.96) !important;
}

/* 4) Disabled State (when input is empty, matches Screenshot 1: #B2C7F4) */
.RlGAzG_primary:disabled,
    .RlGAzG_primary[disabled]:not([data-has-content="true"]),
    .RlGAzG_primary[aria-disabled="true"]:not([data-has-content="true"]),
    button[aria-label="发送"]:disabled,
    button[aria-label="发送"][disabled]:not([data-has-content="true"]),
    button[aria-label="发送"][aria-disabled="true"]:not([data-has-content="true"]),
    button[aria-label="Send"]:disabled,
    button[aria-label="Send"][disabled]:not([data-has-content="true"]),
    button[aria-label="Send"][aria-disabled="true"]:not([data-has-content="true"]) {
  background: #B2C7F4 !important;
  opacity: 1 !important;
  cursor: default !important;
  pointer-events: none !important;
}

/* 5) Send Arrow & Stop Icons */
.RlGAzG_primary svg {
  width: 16px !important;
  height: 16px !important;
  fill: currentColor !important;
  stroke: none !important;
  display: block !important;
}

.RlGAzG_primary svg path,
    .RlGAzG_primary svg rect {
  fill: #FFFFFF !important;
  stroke: none !important;
}

/* 7. Top-Left Workspace & Preset Row (工作区选择 + 标准模式 — 位于输入框左上方默认位置，图层置底固定) */
.Dc7zOa_heroWorkspaceRow,
[class*="heroWorkspaceRow"] {
  order: 2 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  width: 100% !important;
  max-width: var(--dsh-composer-card-max-width, 1140px) !important;
  margin: 0 auto 10px auto !important;
  padding: 0 4px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  height: auto !important;
  min-height: 28px !important;
  box-sizing: border-box !important;
  position: relative !important;
  z-index: 1 !important;
  transition: none !important;
  animation: none !important;
}

/* Elevate z-index only when workspace or preset dropdown menu is actively opened */
.Dc7zOa_heroWorkspaceRow:focus-within,
[class*="heroWorkspaceRow"]:focus-within,
.Dc7zOa_heroWorkspaceRow:has([aria-expanded="true"]),
[class*="heroWorkspaceRow"]:has([aria-expanded="true"]),
.Dc7zOa_heroWorkspaceRow:has([role="menu"]),
[class*="heroWorkspaceRow"]:has([role="menu"]) {
  z-index: 50 !important;
}

/* Neutralize phantom workspace slot spacing while preserving menu anchor */
.Dc7zOa_heroWorkspaceRow > [data-slot="conversation.hero.workspace"],
[class*="heroWorkspaceRow"] > [data-slot="conversation.hero.workspace"] {
  display: inline-flex !important;
  align-items: center !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
}

/* Agent preset slot and menu anchor: inline-flex, natural width */
.Dc7zOa_heroWorkspaceRow > [data-slot="conversation.hero.agentPreset"],
[class*="heroWorkspaceRow"] > [data-slot="conversation.hero.agentPreset"],
.Dc7zOa_heroWorkspaceRow [class*="menuAnchor"],
[class*="heroWorkspaceRow"] [class*="menuAnchor"] {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  min-width: 0 !important;
  width: auto !important;
  height: auto !important;
  flex: none !important;
}

/* Chips in top-left row: adaptive text width, no jitter, clear spacing */
.Hqq-bq_workspace,
    ._oGoKq_seat,
    .Dc7zOa_heroWorkspaceRow button,
    [class*="heroWorkspaceRow"] button {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: #374151 !important;
  background: transparent !important;
  border: none !important;
  padding: 4px 8px !important;
  margin: 0 !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  line-height: 20px !important;
  font-family: inherit !important;
  height: 28px !important;
  min-height: 28px !important;
  width: auto !important;
  min-width: unset !important;
  max-width: 320px !important;
  box-sizing: border-box !important;
  flex: none !important;
  transition: background-color 0.12s ease !important;
}

.Hqq-bq_workspace:hover,
    ._oGoKq_seat:hover,
    .Dc7zOa_heroWorkspaceRow button:hover,
    [class*="heroWorkspaceRow"] button:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.Hqq-bq_workspaceLabel,
    ._oGoKq_seatLabel {
  display: inline-block !important;
  width: auto !important;
  min-width: unset !important;
  max-width: 220px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  line-height: 20px !important;
  height: 20px !important;
  vertical-align: middle !important;
  text-align: left !important;
}

/* Chevrons in top-left row: visible, clean, responsive */
.Dc7zOa_heroWorkspaceRow [class*="chevron"],
[class*="heroWorkspaceRow"] [class*="chevron"],
.Dc7zOa_heroWorkspaceRow .Hqq-bq_chevron,
[class*="heroWorkspaceRow"] .Hqq-bq_chevron,
.Dc7zOa_heroWorkspaceRow ._oGoKq_chevron,
[class*="heroWorkspaceRow"] ._oGoKq_chevron,
.Dc7zOa_heroWorkspaceRow button > svg:last-child:not(:first-child),
[class*="heroWorkspaceRow"] button > svg:last-child:not(:first-child) {
  display: inline-block !important;
  width: 12px !important;
  height: 12px !important;
  color: #6B7280 !important;
  flex: none !important;
  margin-left: 2px !important;
  opacity: 0.7 !important;
  transition: opacity 0.12s ease !important;
}

.Dc7zOa_heroWorkspaceRow button:hover [class*="chevron"],
[class*="heroWorkspaceRow"] button:hover [class*="chevron"] {
  opacity: 1 !important;
}

/* Fine-tuned custom icons */
.dsh-ag-workspace-icon,
    .dsh-ag-mode-icon,
    .dsh-ag-skill-icon,
    .dsh-ag-plugin-icon,
    .Dc7zOa_heroWorkspaceRow button svg:first-child,
    [class*="heroWorkspaceRow"] button svg:first-child,
    .Hqq-bq_folder,
    ._oGoKq_seatIcon {
  width: 15px !important;
  height: 13px !important;
  min-width: 15px !important;
  min-height: 13px !important;
  max-width: 15px !important;
  max-height: 13px !important;
  color: #4B5563 !important;
  flex: none !important;
  display: inline-block !important;
  vertical-align: middle !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}

/* Disable AgentPresetSeat intro character stagger and icon scaling animations */
._oGoKq_introIcon,
    [class*="introIcon"] {
  animation: none !important;
  transition: none !important;
  transform: none !important;
  opacity: 1 !important;
}

._oGoKq_introText,
    [class*="introText"] {
  animation: none !important;
  transition: none !important;
  transform: none !important;
  opacity: 1 !important;
  display: inline-flex !important;
  align-items: center !important;
}

._oGoKq_introChar,
    [class*="introChar"] {
  animation: none !important;
  transition: none !important;
  transform: none !important;
  opacity: 1 !important;
  display: inline-block !important;
  animation-delay: 0s !important;
}

@keyframes _oGoKq_seat-icon-in {
  0%, 100% { opacity: 1 !important; transform: none !important; }
}

@keyframes _oGoKq_seat-char-in {
  0%, 100% { opacity: 1 !important; transform: none !important; }
}

/* 8. Attached Bottom Bar on Grey Block (插件 | 技能 靠左从左到右排列，创建新对话时展示) */
.dsh-ag-bottom-bar {
  order: 4 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  width: calc(100% - 36px) !important;
  max-width: calc(var(--dsh-composer-card-max-width, 1140px) - 36px) !important;
  background: #F3F3F3 !important;
  border-radius: 0 0 16px 16px !important;
  padding: 14px 16px 0 16px !important;
  height: 62px !important;
  min-height: 62px !important;
  box-sizing: border-box !important;
  margin: -14px auto 0 auto !important;
  border-top: none !important;
  border-left: 1px solid #E5E7EB !important;
  border-right: 1px solid #E5E7EB !important;
  border-bottom: 1px solid #E5E7EB !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02) !important;
  z-index: 1 !important;
  position: relative !important;
  transition: none !important;
  animation: none !important;
}

.dsh-ag-bottom-bar .dsh-ag-skill-chip,
.dsh-ag-bottom-bar .dsh-ag-plugin-chip {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: #374151 !important;
  background: transparent !important;
  border: none !important;
  padding: 4px 10px !important;
  margin: 0 !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  line-height: 20px !important;
  font-family: inherit !important;
  height: 28px !important;
  min-height: 28px !important;
  box-sizing: border-box !important;
  flex: none !important;
  transition: background-color 0.12s ease !important;
}

.dsh-ag-bottom-bar .dsh-ag-skill-chip:hover,
.dsh-ag-bottom-bar .dsh-ag-plugin-chip:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

/* 8. Unify Menus (Preset & Skills to match Workspace Menu) */
/* Preset Menu (AgentPresetSeat) refinement to single-line row */
._oGoKq_itemDesc {
  display: none !important;
}

._oGoKq_item {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: auto !important;
  max-width: 100% !important;
}

._oGoKq_itemName {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--dsw-alias-label-primary, #111827) !important;
  line-height: 20px !important;
  white-space: nowrap !important;
}

.dsh-ag-mode-menu-icon {
  width: 14px !important;
  height: 14px !important;
  min-width: 14px !important;
  min-height: 14px !important;
  color: var(--dsw-alias-label-tertiary, #4B5563) !important;
  flex: none !important;
  justify-content: center !important;
  align-items: center !important;
  display: inline-flex !important;
  margin-right: 6px !important;
}

.dsh-ag-mode-menu-icon svg {
  width: 14px !important;
  height: 14px !important;
}

/* Skills Menu (Matching native Harness _3tUStW Menu) */
.dsh-ag-skills-menu {
  box-sizing: border-box !important;
  background: var(--dsw-specific-menu, rgba(248, 249, 250, 0.94)) !important;
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(20px)) !important;
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(20px)) !important;
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08)) !important;
  box-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(0,0,0,0.08), 0 3px 8px 0 rgba(0,0,0,0.04), 0 0 20px 0 rgba(0,0,0,0.05)) !important;
  z-index: 1100 !important;
  border: 0 !important;
  border-radius: 16px !important;
  flex-direction: column !important;
  gap: 0 !important;
  min-width: 170px !important;
  max-width: 320px !important;
  padding: 3px !important;
  display: flex !important;
  position: fixed !important;
  user-select: none !important;
  animation: dsh-ag-menu-pop-in 0.12s cubic-bezier(0.16, 1, 0.3, 1) !important;
  height: var(--dsh-ag-popover-menu-h, 210px) !important;
  max-height: calc(100vh - 24px) !important;
  overflow: hidden !important;
}

@keyframes dsh-ag-menu-pop-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.dsh-ag-skills-menu ._3tUStW_viewport {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  gap: 0 !important;
  max-height: none !important;
  overflow-y: auto !important;
  overscroll-behavior: contain !important;
}

.dsh-ag-skills-menu ._3tUStW_itemWrap {
  position: relative !important;
  margin: 0 !important;
  padding: 0 !important;
}

.dsh-ag-skills-menu ._3tUStW_item {
  cursor: pointer !important;
  width: 100% !important;
  min-height: 34px !important;
  color: var(--dsw-alias-label-primary, #111827) !important;
  text-align: left !important;
  background: transparent !important;
  border: none !important;
  border-radius: 8px !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 6px 8px !important;
  font-size: 13px !important;
  line-height: 20px !important;
  display: flex !important;
  box-sizing: border-box !important;
  transition: background-color 0.1s ease !important;
  font-family: inherit !important;
}

.dsh-ag-skills-menu ._3tUStW_item:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)) !important;
}

.dsh-ag-skills-menu ._3tUStW_itemIcon {
  width: 14px !important;
  height: 14px !important;
  color: var(--dsw-alias-label-tertiary, #4B5563) !important;
  flex: none !important;
  justify-content: center !important;
  align-items: center !important;
  display: inline-flex !important;
}

.dsh-ag-skills-menu ._3tUStW_itemLabel {
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  flex: 1 !important;
  min-width: 0 !important;
  overflow: hidden !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--dsw-alias-label-primary, #111827) !important;
}

.dsh-ag-skills-menu ._3tUStW_check {
  display: none !important;
}

/* 9. Plugins Menu (matching native Harness menu style) */
/* 9. Plugins Popover (matching skills & exec target card size and style) */
.dsh-ag-plugins-menu {
  box-sizing: border-box !important;
  background: #FFFFFF !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid #E5E7EB !important;
  border-radius: 16px !important;
  width: 220px !important;
  min-width: 200px !important;
  max-width: 240px !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  position: fixed !important;
  user-select: none !important;
  z-index: 1200 !important;
  animation: dsh-ag-menu-pop-in 0.14s cubic-bezier(0.16, 1, 0.3, 1) !important;
  height: var(--dsh-ag-popover-menu-h, 210px) !important;
  max-height: calc(100vh - 24px) !important;
  overflow: hidden !important;
}

/* Scrollable Plugin List（弹性填充容器剩余高度，超出滚动；总高由容器统一变量控制） */
.dsh-ag-plugins-list {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 4px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain !important;
}

.dsh-ag-plugins-list::-webkit-scrollbar {
  width: 4px !important;
}
.dsh-ag-plugins-list::-webkit-scrollbar-track {
  background: transparent !important;
}
.dsh-ag-plugins-list::-webkit-scrollbar-thumb {
  background: #E5E7EB !important;
  border-radius: 999px !important;
}
.dsh-ag-plugins-list::-webkit-scrollbar-thumb:hover {
  background: #D1D5DB !important;
}

/* Plugin row item */
.dsh-ag-plugin-item {
  width: 100% !important;
  height: 32px !important;
  min-height: 32px !important;
  color: #1F2937 !important;
  text-align: left !important;
  background: transparent !important;
  border: none !important;
  border-radius: 6px !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 8px !important;
  display: flex !important;
  box-sizing: border-box !important;
  transition: background-color 0.12s ease !important;
  font-family: inherit !important;
  cursor: pointer !important;
  margin-bottom: 1px !important;
}

.dsh-ag-plugin-item:hover {
  background: #F4F5F7 !important;
}

.dsh-ag-plugin-item-left {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex: 1 !important;
  min-width: 0 !important;
}

.dsh-ag-plugin-item-icon {
  width: 16px !important;
  height: 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: none !important;
}

.dsh-ag-plugin-item-icon svg {
  width: 15px !important;
  height: 15px !important;
  display: block !important;
}

.dsh-ag-plugin-item-name {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: #1F2937 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

/* Empty state */
.dsh-ag-plugins-empty {
  font-size: 12px !important;
  color: #9CA3AF !important;
  text-align: center !important;
  padding: 16px 10px !important;
  display: none;
}

/* 10. Toggle Switch (滑块拨动开关 - 1:1匹配截图) */
.dsh-ag-toggle-switch {
  position: relative !important;
  display: inline-flex !important;
  align-items: center !important;
  width: 30px !important;
  height: 17px !important;
  min-width: 30px !important;
  max-width: 30px !important;
  background-color: #D1D5DB !important;
  border-radius: 999px !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
  flex: none !important;
  user-select: none !important;
  outline: none !important;
  transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.dsh-ag-toggle-switch:hover {
  background-color: #9CA3AF !important;
}

.dsh-ag-toggle-switch.dsh-ag-toggle-on {
  background-color: #2F6FED !important;
}

.dsh-ag-toggle-switch.dsh-ag-toggle-on:hover {
  background-color: #2558CA !important;
}

.dsh-ag-toggle-thumb {
  position: absolute !important;
  top: 1.5px !important;
  left: 2px !important;
  width: 14px !important;
  height: 14px !important;
  border-radius: 50% !important;
  background-color: #FFFFFF !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
  transform: translateX(0) !important;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  pointer-events: none !important;
}

.dsh-ag-toggle-switch.dsh-ag-toggle-on .dsh-ag-toggle-thumb {
  transform: translateX(12px) !important;
}

/* Bottom Fixed Action Bar: 插件市场 > */
.dsh-ag-plugins-footer {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 8px 10px !important;
  border-top: 1px solid #F3F4F6 !important;
  background: #FFFFFF !important;
  cursor: pointer !important;
  transition: background-color 0.12s ease !important;
  box-sizing: border-box !important;
}

.dsh-ag-plugins-footer:hover {
  background: #F9FAFB !important;
}

.dsh-ag-plugins-footer-left {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 13px !important;
  color: #1F2937 !important;
  font-weight: 400 !important;
}

.dsh-ag-plugins-footer-left svg {
  width: 14px !important;
  height: 12px !important;
  min-width: 14px !important;
  min-height: 12px !important;
  color: #4B5563 !important;
  flex: none !important;
  display: inline-block !important;
  vertical-align: middle !important;
  margin: 0 !important;
}

.dsh-ag-footer-chevron {
  width: 13px !important;
  height: 13px !important;
  color: #9CA3AF !important;
  flex: none !important;
}

/* 11. Execution Target (此聊天要在哪里运行？ - 底部灰色块右边纯图标按钮与弹窗) */
.dsh-ag-exec-target-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 32px !important;
  height: 28px !important;
  min-height: 28px !important;
  background: transparent !important;
  border: none !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  margin: 0 0 0 auto !important;
  padding: 0 !important;
  color: #4B5563 !important;
  line-height: 1 !important;
  flex: none !important;
  box-sizing: border-box !important;
  transition: background-color 0.12s ease, transform 0.1s ease !important;
  outline: none !important;
}

.dsh-ag-exec-target-btn:hover {
  background: rgba(0, 0, 0, 0.05) !important;
  color: #111827 !important;
}

.dsh-ag-exec-target-btn.active,
.dsh-ag-exec-target-btn:active {
  background: #E5E7EB !important;
  color: #111827 !important;
}

.dsh-ag-exec-popover {
  position: fixed !important;
  width: 324px !important;
  background: #FFFFFF !important;
  border: 1px solid #E5E7EB !important;
  border-radius: 16px !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  padding: 16px 14px 12px 14px !important;
  z-index: 10002 !important;
  box-sizing: border-box !important;
  user-select: none !important;
  font-family: inherit !important;
  --dsh-ag-exec-scale: 1;
  transform: scale(var(--dsh-ag-exec-scale, 1)) !important;
  transform-origin: top right !important;
  animation: dsh-ag-exec-pop-in 0.14s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

@keyframes dsh-ag-exec-pop-in {
  from {
    opacity: 0;
    transform: scale(calc(var(--dsh-ag-exec-scale, 1) * 0.96)) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(var(--dsh-ag-exec-scale, 1)) translateY(0);
  }
}

.dsh-ag-exec-title {
  font-size: 14px !important;
  font-weight: 400 !important;
  color: #6B7280 !important;
  padding: 0 6px 12px 6px !important;
  line-height: 20px !important;
}

.dsh-ag-exec-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.dsh-ag-exec-item {
  display: flex !important;
  align-items: flex-start !important;
  gap: 12px !important;
  padding: 10px 8px !important;
  border-radius: 10px !important;
  cursor: pointer !important;
  transition: background-color 0.12s ease !important;
}

.dsh-ag-exec-item:hover {
  background: #F3F4F6 !important;
}

.dsh-ag-exec-icon {
  width: 24px !important;
  height: 24px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #374151 !important;
  flex: none !important;
  margin-top: 1px !important;
}

.dsh-ag-exec-icon svg {
  width: 20px !important;
  height: 17px !important;
}

.dsh-ag-exec-text {
  flex: 1 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}

.dsh-ag-exec-name {
  font-size: 14px !important;
  font-weight: 500 !important;
  color: #111827 !important;
  line-height: 20px !important;
}

.dsh-ag-exec-desc {
  font-size: 12px !important;
  font-weight: 400 !important;
  color: #9CA3AF !important;
  line-height: 18px !important;
}

.dsh-ag-exec-check {
  width: 20px !important;
  height: 20px !important;
  display: none !important;
  align-items: center !important;
  justify-content: center !important;
  flex: none !important;
  color: #374151 !important;
  margin-top: 2px !important;
}

.dsh-ag-exec-item.dsh-ag-exec-selected .dsh-ag-exec-check {
  display: flex !important;
}

/* 12. Toggle failure feedback (inline red flash + switch shake, auto-clears) */
.dsh-ag-plugin-item.dsh-ag-toggle-failed .dsh-ag-plugin-item-name {
  color: #DC2626 !important;
}

.dsh-ag-toggle-error {
  flex: none !important;
  font-size: 11px !important;
  color: #DC2626 !important;
  margin-left: 2px !important;
  animation: dsh-ag-error-fade 1.6s ease forwards !important;
}

@keyframes dsh-ag-error-fade {
  0%, 55% { opacity: 1; }
  100% { opacity: 0; }
}

.dsh-ag-toggle-switch.dsh-ag-toggle-shake {
  animation: dsh-ag-toggle-shake 0.36s cubic-bezier(0.36, 0.07, 0.19, 0.97) !important;
}

@keyframes dsh-ag-toggle-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
}

/* Deferred success (write landed, page needs a reload to show it):
   amber actionable hint, no shake, 8s dwell so there is time to click. */
.dsh-ag-plugin-item.dsh-ag-toggle-deferred .dsh-ag-plugin-item-name {
  color: #B45309 !important;
}

.dsh-ag-plugin-item.dsh-ag-toggle-deferred .dsh-ag-toggle-error {
  color: #B45309 !important;
  animation-duration: 8s !important;
}

.dsh-ag-toggle-error.dsh-ag-toggle-action {
  cursor: pointer !important;
  text-decoration: underline !important;
  text-decoration-style: dotted !important;
  text-underline-offset: 2px !important;
}

.dsh-ag-toggle-error.dsh-ag-toggle-action:hover {
  text-decoration-style: solid !important;
}

/* 13. Dark theme. The app theme preference is "system", so the webview's
       prefers-color-scheme tracks the OS; these rules sit last and win over
       the light values above at equal specificity. */
@media (prefers-color-scheme: dark) {
  /* Hero */
  .Hqq-bq_headline { color: #ECEDEE !important; }
  .Hqq-bq_fish { color: #ECEDEE !important; }
  .Hqq-bq_previewBadge {
    background: rgba(78, 110, 240, 0.16) !important;
    color: #93ADF9 !important;
    border-color: rgba(147, 173, 249, 0.28) !important;
  }

  /* Composer card */
  .RlGAzG_card, [data-composer-card] {
    background: #1C1E21 !important;
    border-color: #2E3134 !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
  }
  .RlGAzG_card:focus-within, [data-composer-card]:focus-within {
    border-color: #3A3E44 !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  }
  .RlGAzG_input { color: #ECEDEE !important; }
  .RlGAzG_placeholder { color: #6C6F73 !important; }
  .RlGAzG_add { background: #26282C !important; color: #B4B7BB !important; }
  .RlGAzG_add:hover { background: #2E3136 !important; }
  .RlGAzG_add svg { color: #B4B7BB !important; }
  [class*="triggerLabel"], [class*="permission"] button { color: #B4B7BB !important; }
  [class*="permission"] button:hover { background: rgba(255, 255, 255, 0.06) !important; }
  .msp-trigger, button[aria-label*="模型"], button[aria-label*="Model"] { color: #B4B7BB !important; }
  .msp-trigger:hover { background: rgba(255, 255, 255, 0.06) !important; }
  .RlGAzG_primary:disabled,
    .RlGAzG_primary[disabled]:not([data-has-content="true"]),
    .RlGAzG_primary[aria-disabled="true"]:not([data-has-content="true"]),
    button[aria-label="发送"]:disabled,
    button[aria-label="Send"]:disabled,
    button[aria-label="停止"]:disabled,
    button[aria-label="Stop"]:disabled {
    background: rgba(65, 118, 230, 0.32) !important;
  }

  /* Workspace row */
  .Hqq-bq_workspace, ._oGoKq_seat,
    .Dc7zOa_heroWorkspaceRow button, [class*="heroWorkspaceRow"] button {
    color: #B4B7BB !important;
  }
  .Hqq-bq_workspace:hover, ._oGoKq_seat:hover,
    .Dc7zOa_heroWorkspaceRow button:hover, [class*="heroWorkspaceRow"] button:hover {
    background: rgba(255, 255, 255, 0.06) !important;
  }
  .Dc7zOa_heroWorkspaceRow [class*="chevron"], [class*="heroWorkspaceRow"] [class*="chevron"],
    .Dc7zOa_heroWorkspaceRow .Hqq-bq_chevron, [class*="heroWorkspaceRow"] .Hqq-bq_chevron,
    .Dc7zOa_heroWorkspaceRow ._oGoKq_chevron, [class*="heroWorkspaceRow"] ._oGoKq_chevron,
    .Dc7zOa_heroWorkspaceRow button > svg:last-child:not(:first-child),
    [class*="heroWorkspaceRow"] button > svg:last-child:not(:first-child) {
    color: #8A8D91 !important;
  }
  .dsh-ag-workspace-icon, .dsh-ag-mode-icon, .dsh-ag-skill-icon, .dsh-ag-plugin-icon,
    .Dc7zOa_heroWorkspaceRow button svg:first-child, [class*="heroWorkspaceRow"] button svg:first-child,
    .Hqq-bq_folder, ._oGoKq_seatIcon {
    color: #B4B7BB !important;
  }

  /* Bottom bar */
  .dsh-ag-bottom-bar {
    background: #17181B !important;
    border-left: 1px solid #2E3134 !important;
    border-right: 1px solid #2E3134 !important;
    border-bottom: 1px solid #2E3134 !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
  }
  .dsh-ag-bottom-bar .dsh-ag-skill-chip, .dsh-ag-bottom-bar .dsh-ag-plugin-chip {
    color: #B4B7BB !important;
  }
  .dsh-ag-bottom-bar .dsh-ag-skill-chip:hover, .dsh-ag-bottom-bar .dsh-ag-plugin-chip:hover {
    background: rgba(255, 255, 255, 0.06) !important;
  }

  /* Skills menu (fallbacks for the host --dsw variables) */
  .dsh-ag-skills-menu { background: rgba(28, 30, 33, 0.94) !important; }
  .dsh-ag-skills-menu ._3tUStW_item { color: #ECEDEE !important; }
  .dsh-ag-skills-menu ._3tUStW_itemIcon { color: #B4B7BB !important; }
  .dsh-ag-skills-menu ._3tUStW_itemLabel { color: #ECEDEE !important; }
  .dsh-ag-skills-menu ._3tUStW_item:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06) !important; }

  /* Plugins menu */
  .dsh-ag-plugins-menu {
    background: #1C1E21 !important;
    border-color: #2E3134 !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.55), 0 8px 10px -6px rgba(0, 0, 0, 0.45) !important;
  }
  .dsh-ag-plugins-list::-webkit-scrollbar-thumb { background: #3A3D42 !important; }
  .dsh-ag-plugins-list::-webkit-scrollbar-thumb:hover { background: #4A4E54 !important; }
  .dsh-ag-plugin-item { color: #ECEDEE !important; }
  .dsh-ag-plugin-item:hover { background: rgba(255, 255, 255, 0.06) !important; }
  .dsh-ag-plugin-item-name { color: #ECEDEE !important; }
  .dsh-ag-plugins-empty { color: #8A8D91 !important; }
  .dsh-ag-plugins-footer {
    border-top: 1px solid #26282C !important;
    background: #1C1E21 !important;
  }
  .dsh-ag-plugins-footer:hover { background: #222428 !important; }
  .dsh-ag-plugins-footer-left { color: #ECEDEE !important; }
  .dsh-ag-plugins-footer-left svg { color: #B4B7BB !important; }
  .dsh-ag-footer-chevron { stroke: #8A8D91 !important; }

  /* Toggle switch (off state) */
  .dsh-ag-toggle-switch { background-color: #3A3E44 !important; }
  .dsh-ag-toggle-switch:hover { background-color: #4A4E54 !important; }

  /* Toggle failure / deferred hints */
  .dsh-ag-plugin-item.dsh-ag-toggle-failed .dsh-ag-plugin-item-name { color: #F87171 !important; }
  .dsh-ag-toggle-error { color: #F87171 !important; }
  .dsh-ag-plugin-item.dsh-ag-toggle-deferred .dsh-ag-plugin-item-name { color: #F5B04D !important; }
  .dsh-ag-plugin-item.dsh-ag-toggle-deferred .dsh-ag-toggle-error { color: #F5B04D !important; }

  /* Execution target */
  .dsh-ag-exec-target-btn { color: #B4B7BB !important; }
  .dsh-ag-exec-target-btn:hover { background: rgba(255, 255, 255, 0.06) !important; color: #ECEDEE !important; }
  .dsh-ag-exec-target-btn.active, .dsh-ag-exec-target-btn:active {
    background: #2E3136 !important;
    color: #ECEDEE !important;
  }
  .dsh-ag-exec-popover {
    background: #1C1E21 !important;
    border-color: #2E3134 !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.55), 0 8px 10px -6px rgba(0, 0, 0, 0.45) !important;
  }
  .dsh-ag-exec-title { color: #8A8D91 !important; }
  .dsh-ag-exec-item:hover { background: rgba(255, 255, 255, 0.05) !important; }
  .dsh-ag-exec-icon { color: #B4B7BB !important; }
  .dsh-ag-exec-name { color: #ECEDEE !important; }
  .dsh-ag-exec-desc { color: #8A8D91 !important; }
  .dsh-ag-exec-check { color: #B4B7BB !important; }
  .dsh-ag-exec-check svg { stroke: #B4B7BB !important; }
}

/* ==========================================================================
   14. Fixed Icon Rail（ChatGPT 桌面版同款最左固定图标栏）
   ========================================================================== */

/* 把整个应用框架右移，让出左侧 64px 固定栏 */
.BynINW_frame {
  margin-left: 64px !important;
}

/* 明确锁死 3 列网格归属，防止绝对定位或托管态导致 centerCol 串入第 1 列（0px 列）发生横向位移与挤压 */
[class*="_sidebarCol"] {
  grid-column: 1 !important;
}
[class*="_centerCol"] {
  grid-column: 2 !important;
}
[class*="_rightbarCol"] {
  grid-column: 3 !important;
}

/* S 区与 C 区交界分隔线（浅色主题 #f5f5f5 实线，深色跟随宿主边框色）；收起态中栏贴边，不画线 */
html[data-windows-titlebar] .BynINW_frame:not([data-sidebar-collapsed]) .BynINW_sidebarCol {
  border-right: 2px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08)) !important;
}
html[data-windows-titlebar] body:not([data-ds-dark-theme]) .BynINW_frame:not([data-sidebar-collapsed]) .BynINW_sidebarCol {
  border-right-color: #f5f5f5 !important;
}

/* S 区（侧栏列）底色统一为 C 区（中央内容区）同款纯白 #FFFFFF：
   在列上改写 --dsw-specific-sidebar-fill，列内整棵子树（含原生拖拽条
   .BynINW_handle 等引用该变量的元素）一并跟随，避免列体变白后顶部
   残留 48px 灰条；仅浅色主题，深色主题维持宿主原生配色 */
body:not([data-ds-dark-theme]) .BynINW_sidebarCol {
  --dsw-specific-sidebar-fill: #FFFFFF !important;
  background: #FFFFFF !important;
}

/* 展开态下 C 区左上角为直角（配合分隔线，与参考图一致）；收起态保留原生 16px 圆角 */
html[data-windows-titlebar] .BynINW_frame:not([data-sidebar-collapsed]) .BynINW_centerCol {
  border-radius: 0 !important;
}

/* S 区（侧栏列）与中栏同款左上圆角：展开态下「标题栏×固定栏」夹角的圆角
   与收起态（中栏圆角）一致，缺口处统一露出 #f5f5f5 底色 */
html[data-windows-titlebar] .BynINW_sidebarCol {
  border-top-left-radius: var(--dsh-windows-content-radius, 16px);
}

/* 标题栏底色同步为 #f5f5f5（原生标题条 = frame 的 :before 伪元素 + frame 自身背景；
   仅浅色主题生效，深色主题继续使用宿主 --dsw-specific-sidebar-fill） */
body:not([data-ds-dark-theme]) .BynINW_frame:before {
  background: #f5f5f5 !important;
}
html[data-windows-titlebar] body:not([data-ds-dark-theme]) .BynINW_frame {
  background: #f5f5f5 !important;
}

/* 左上角历史导航：贴窗口最左上角，位于固定栏顶部拖拽区之内（视频同款位置） */
#dsh-ui-navbtns {
  position: fixed;
  top: 0;
  left: 10px;
  height: var(--dsh-windows-titlebar-height, 48px);
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 1105;
  pointer-events: none;
}

.dsh-navbtn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, #5d5d5d);
  padding: 0;
  position: relative;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  box-sizing: border-box;
  transition: background-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.dsh-navbtn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--dsw-alias-label-primary, #0d0d0d);
}

.dsh-navbtn:disabled {
  opacity: 0.35;
  cursor: default;
}

.dsh-navbtn:disabled:hover {
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5d5d5d);
}

.dsh-navbtn svg {
  display: block;
  pointer-events: none;
}

/* 标题栏内的 tooltip 显示在按钮下方；左对齐避免靠近左边界时被窗口裁切 */
.dsh-navbtn::after {
  content: attr(data-tip);
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  transform: none;
  background: #0d0d0d;
  color: #ffffff;
  font-size: 12px;
  line-height: 1;
  padding: 7px 10px;
  border-radius: 8px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease 0.45s;
  z-index: 1105;
}

.dsh-navbtn:hover::after {
  opacity: 1;
}

.dsh-navbtn-toggle {
  margin-left: 6px;
}

/* 原生与全局 Tooltip 提示层层级提升，彻底防止被最左侧 64px 固定栏（z-index: 1001）遮挡截断 */
[role="tooltip"],
[class*="bubble"][role="tooltip"] {
  z-index: 1105 !important;
}

/* 标题栏元素避让与对齐：
   [← → 10-68] [侧栏开关 70-98] [常驻 ⊕ 100-128] [菜单 144+]；
   v1.1.33：⊕ 新建会话为自绘常驻按钮（第 4 个导航按钮，两态常驻）——宿主的
   newSession 是同一节点随侧栏状态在「标题栏浮动圆钮」与「侧栏胶囊」间切换，
   无法常驻；常驻职责改由自绘 ⊕ 接管（动作走 railGoHome → 原生 startSession），
   宿主收起态浮动圆钮防重复隐藏，侧栏展开态原生胶囊照常显示（v1.1.30 需求）。
   菜单常驻 144px 靠左对齐（两态同值），彻底消除抽屉开合或侧栏收放时的
   菜单左右位移跳动；
   原生侧栏开关按钮隐藏（由 #dsh-ui-navbtns 常驻开关按钮接管，避免托管抽屉
   动画包含块位移闪跳） */
[data-windows-titlebar] ._2H3hWW_toggle,
[data-windows-titlebar] [class*="_logoRow"] [class*="_toggle"],
[data-windows-titlebar] [class*="_sidebarCol"] [class*="_toggle"] {
  display: none !important;
}
html[data-windows-titlebar] {
  --dsh-windows-menu-start: 144px !important;
}
/* 常驻 ⊕ 与宿主浮动钮同形：28px 圆钮 */
.dsh-navbtn-plus {
  border-radius: 50%;
}
/* v1.1.33：隐藏宿主 newSession 的「收起态标题栏浮动圆钮」变体（防与常驻 ⊕
   重复）。仅此变体——侧栏展开态的原生胶囊不在收起根内，不受影响。
   选择器带哈希精确与哈希无关双形态。 */
[data-windows-titlebar] ._2H3hWW_collapsed ._2H3hWW_newSession,
[data-windows-titlebar] [class*="_root"][class*="_collapsed"] [class*="_newSession"] {
  display: none !important;
}
/* v1.1.31：隐藏规则作用域收窄到「侧栏列之外」。
   v1.1.0 的本意只是移除顶部栏 ⊕ 新建会话图标（由固定栏首页接管），但
   [class*="_newSession"] 连侧栏里的新会话胶囊一起命中。v1.1.28-30 曾用
   「全局隐藏 + display:flex !important 豁免」恢复胶囊——强制 flex 覆盖了
   胶囊的原生布局（按钮默认 inline-block + text-align:center 居中），flex
   容器默认 justify-content:flex-start，图标与文字全部左挤、居中失效。
   现直接把隐藏作用域排除侧栏列：胶囊（原生展开与托管抽屉）全程不被触碰，
   display/居中/间距保持宿主原样；顶部栏 ⊕ 不在侧栏列内，照旧隐藏。
   :not() 复合选择器需 Chromium 88+（宿主 Electron 远高于此）。 */
[data-windows-titlebar] ._2H3hWW_newSession:not([class*="_sidebarCol"] *),
[data-windows-titlebar] [class*="_newSession"]:not([class*="_sidebarCol"] *) {
  display: none !important;
}

/* 侧栏第二列里的原生全局面板行（插件/定时任务）由固定栏接管，隐藏避免重复 */
._2H3hWW_panelList,
[class*="_panelList"] {
  display: none !important;
}

#dsh-ui-rail {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 64px;
  /* 1001：高于设置等模态遮罩（原生 Modal z=1000，视频里设置视图固定栏常亮），
     低于原生菜单/气泡（z=1100）与自家弹层，不遮挡任何下拉。 */
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 浅色主题固定底色（用户指定 #f5f5f5）；深色仍跟随宿主侧栏填充 */
  background: #f5f5f5;
  user-select: none;
  font-family: inherit;
}

body[data-ds-dark-theme] #dsh-ui-rail {
  background: var(--dsw-specific-sidebar-fill, #1c1c1e);
}

.dsh-rail-dragzone {
  width: 100%;
  height: var(--dsh-windows-titlebar-height, 48px);
  flex: none;
  -webkit-app-region: drag;
}

.dsh-rail-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 10px;
  flex: none;
}

.dsh-rail-spacer {
  flex: 1 1 auto;
  min-height: 12px;
}

.dsh-rail-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border: none;
  background: transparent;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, #5d5d5d);
  padding: 0;
  position: relative;
  flex: none;
  box-sizing: border-box;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.dsh-rail-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--dsw-alias-label-primary, #0d0d0d);
}

.dsh-rail-btn.active {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--dsw-alias-label-primary, #0d0d0d);
}

/* 用户双态图标（首页/自动化任务/插件）：未点击 #C5C5C5，悬停只加底不变色，选中切换实心并变主色 */
.dsh-rail-btn.dsh-rail-btn-custom {
  color: #C5C5C5;
}

.dsh-rail-btn.dsh-rail-btn-custom:hover {
  color: #C5C5C5;
}

.dsh-rail-btn.dsh-rail-btn-custom.active {
  color: var(--dsw-alias-label-primary, #0d0d0d);
}

.dsh-rail-btn svg {
  display: block;
  pointer-events: none;
}

/* 悬停黑色胶囊 tooltip（视频同款，出现在图标右侧） */
.dsh-rail-btn::after {
  content: attr(data-tip);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) scale(0.96);
  background: #0d0d0d;
  color: #ffffff;
  font-size: 12px;
  line-height: 1;
  padding: 7px 10px;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease 0.45s, transform 0.12s ease 0.45s;
  z-index: 40;
}

.dsh-rail-btn:hover::after {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

/* 无 data-tip 的按钮（如头像）完全不渲染提示框 */
.dsh-rail-btn:not([data-tip])::after {
  content: none;
}

/* 首页按钮在「侧栏收起（悬浮卡片展开）」、托管模式期间、或抽屉开启时，彻底隐藏黑色悬浮提示框，避免遮挡卡片 */
html:has([data-sidebar-collapsed]) .dsh-rail-btn[data-rail-action="home"]::after,
body:has([data-sidebar-collapsed]) .dsh-rail-btn[data-rail-action="home"]::after,
html.dsh-native-host-mode .dsh-rail-btn[data-rail-action="home"]::after,
body:has(.dsh-native-host) .dsh-rail-btn[data-rail-action="home"]::after,
.dsh-rail-btn[data-rail-action="home"].dsh-suppress-tip::after {
  content: none !important;
  display: none !important;
  opacity: 0 !important;
}

/* 底部头像：锁死正圆（50% 圆角 + 固定 1:1 尺寸），防止原生/其他规则
   把按钮或图片改写为圆角方块。
   注意：#dsh-ui-rail 是 position:fixed，其子元素可能被 Chromium 提升为
   合成层——合成层位图上 border-radius 计算值虽在、绘制却不裁剪（表现即
   "照片是圆角方块"）。因此按钮与图片统一叠加 clip-path: circle()，它在
   合成器层面做蒙版，不受该问题影响。 */
.dsh-rail-avatar-btn {
  border-radius: 50% !important;
  clip-path: circle(50% at 50% 50%) !important;
  overflow: hidden !important;
  margin-bottom: 12px;
}

.dsh-rail-avatar-btn.dsh-rail-avatar-btn:hover {
  border-radius: 50% !important;
}

.dsh-rail-avatar-img {
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  min-height: 30px !important;
  max-width: 30px !important;
  max-height: 30px !important;
  border-radius: 50% !important;
  clip-path: circle(50% at 50% 50%) !important;
  object-fit: cover !important;
  aspect-ratio: 1 / 1 !important;
  display: block;
}

.dsh-rail-avatar-fallback {
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  min-height: 30px !important;
  border-radius: 50% !important;
  clip-path: circle(50% at 50% 50%) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: var(--dsw-alias-label-secondary, #5d5d5d);
}

.dsh-rail-avatar-fallback svg {
  width: 26px;
  height: 26px;
}

/* 固定栏弹出菜单（更多 / 账号，视频同款卡片） */
.dsh-rail-menu {
  position: fixed;
  z-index: 1200;
  width: 264px;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.08));
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 6px;
  animation: dsh-ag-menu-pop-in 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  font-family: inherit;
}

.dsh-rail-menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 12px;
}

.dsh-rail-menu-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--dsw-alias-label-secondary, #5d5d5d);
}

.dsh-rail-menu-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dsh-rail-menu-avatar svg {
  width: 28px;
  height: 28px;
}

.dsh-rail-menu-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dsh-rail-menu-name {
  font-size: 14px;
  color: var(--dsw-alias-label-primary, #111827);
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsh-rail-menu-sub {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  line-height: 16px;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsh-rail-menu-sep {
  height: 1px;
  background: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.07));
  margin: 2px 8px 4px;
  flex: none;
}

.dsh-rail-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, #111827);
  text-align: left;
  box-sizing: border-box;
  transition: background-color 0.12s ease;
}

.dsh-rail-menu-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
}

.dsh-rail-menu-item svg {
  flex: none;
  display: block;
  color: var(--dsw-alias-label-tertiary, #4b5563);
}

.dsh-rail-menu-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  flex: none;
}

.dsh-rail-menu-hint.dsh-rail-menu-chevron {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
  padding-left: 6px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
}

.dsh-rail-menu-hint.dsh-rail-menu-chevron svg {
  width: 12px;
  height: 12px;
}

.dsh-rail-menu-item + .dsh-rail-menu-item .dsh-rail-menu-chevron {
  margin-left: auto;
}

.dsh-rail-menu-item .dsh-rail-menu-hint + .dsh-rail-menu-chevron {
  margin-left: 2px;
}

/* ==========================================================================
   14. 固定栏首页「悬浮卡片抽屉」——原生侧栏托管模式 (Native Hosting, v1.1.25)

   hover 首页按钮时不再渲染自绘抽屉，而是把宿主「宽态侧栏」整体套进悬浮卡片
   壳：品牌行 / 新会话胶囊 / 工作区三入口 / 工作区文件夹 / 会话列表 / 底部设置
   全部原生渲染（数据、交互、快捷键零复刻，宿主升级自动跟随）。
   本插件只负责四件事：
   ① 生命周期：hover/键盘唤起 → layout.toggleSidebar 展开；移出热区收回；
   ② 卡片壳几何（.dsh-native-host，JS 打在 [class*="_sidebarCol"] 上）：
      left 6px（离左侧固定栏 6px，与顶部离标题栏 6px 间距完全对齐） / top 标题栏+6 / bottom 14 / width 268 / radius 14 / 边框 / 投影；
   ③ 防推挤：托管期间把 frame 的 grid-template-columns 用 !important 钉在
      唤起前记住的「收起态值」，聊天区纹丝不动；
   ④ 开合 180ms 缓出动画（开=入场；收=先淡出壳再瞬时收回，不闪跳）。
   ========================================================================== */

/* --- 卡片壳：由 JS 加在宿主侧栏列上 --- */
.dsh-native-host {
  position: absolute !important;
  left: 6px !important;
  top: calc(var(--dsh-windows-titlebar-height, 48px) + 6px) !important;
  bottom: 14px !important;
  width: 268px !important;
  z-index: 1000 !important;
  box-sizing: border-box !important;
  border-radius: 14px !important;
  border: 1px solid #E5E7EB !important;
  background: #FFFFFF !important;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04) !important;
  overflow: hidden !important;
  animation: dsh-native-host-in 180ms cubic-bezier(0.22, 0.61, 0.36, 1) !important;
}
@keyframes dsh-native-host-in {
  from { opacity: 0; transform: translateX(-8px) scale(0.985); }
}

.dsh-native-host > div,
.dsh-native-host [class*="_root"] {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* 收起跑法：先给壳加淡出类（180ms，与入场同曲线），动画结束 JS 才真正
   toggleSidebar 收回——避免「壳先落回停靠位、聊天区被推一下」的闪跳 */
.dsh-native-host-closing {
  opacity: 0 !important;
  transform: translateX(-8px) scale(0.985) !important;
  transition: opacity 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1) !important;
  pointer-events: none !important;
}

/* 全局托管模式（JS 打在 <html> 上）期间的辅助压制与防推挤钉扎：
   核心契约：主框架的 grid-template-columns 必须强行钉死在收起态宽度（第一列 0px），
   严禁推挤右侧聊天主体！即便 React 重新渲染并把行内样式改写为 240px，
   CSS !important 规则具有最高特异性，确保聊天区纹丝不动（Overlay 悬浮）。 */
html.dsh-native-host-mode [class*="_frame"] {
  grid-template-columns: var(--dsh-pinned-grid-template-columns, 0px minmax(0px, 1fr) 0px) !important;
  transition: none !important; /* 宿主 grid 模板动画会让聊天区滑动，直接压制 */
}
html.dsh-native-host-mode .BynINW_frame,
body:has(.dsh-native-host) [class*="_frame"],
body:has(.dsh-native-host) .BynINW_frame {
  grid-template-columns: var(--dsh-pinned-grid-template-columns, 0px minmax(0px, 1fr) 0px) !important;
  transition: none !important;
}
html.dsh-native-host-mode [class*="_handle"] {
  display: none !important;    /* 隐藏侧栏拖拽手柄，避免卡片上出现 col-resize 残影 */
}

/* 托管模式下，中栏圆角保持收起态（左上圆角保留，不被展开态切为直角） */
html.dsh-native-host-mode .BynINW_centerCol,
html.dsh-native-host-mode [class*="_centerCol"],
body:has(.dsh-native-host) .BynINW_centerCol,
body:has(.dsh-native-host) [class*="_centerCol"] {
  border-top-left-radius: var(--dsh-windows-content-radius, 16px) !important;
}

/* 卡片壳内不响应窗口拖拽（宿主侧栏区原生是 drag 区域） */
.dsh-native-host,
.dsh-native-host * {
  -webkit-app-region: no-drag;
}

/* 深色主题：壳的边框 / 底色 / 投影跟随宿主深色调色板 */
[data-ds-dark-theme] .dsh-native-host {
  border-color: #2E3134 !important;
  background: #1C1E21 !important;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3) !important;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-native-host {
    animation: none !important;
  }
  .dsh-native-host-closing {
    transition: opacity 120ms linear !important;
    transform: none !important;
  }
}

/* T4 窗口控制区底色：原生 WCO 按钮颜色由 preload 探针读取
   var(--dsw-specific-sidebar-fill) 后经 windowsAppearance IPC 发给主进程。
   仅将探针元素上的该变量覆写为 #f5f5f5（浅色主题，S 区不受影响），
   使整条标题栏（含最小化/最大化/关闭按钮）统一底色 */
body:not([data-ds-dark-theme]) > span[style*="dsw-specific-sidebar-fill"] {
  --dsw-specific-sidebar-fill: #f5f5f5;
}

/* S5 账号菜单统一：收起态下原生 footArea 被 display:none 隐藏（触发器 rect=0），
   恢复 footArea 渲染，让固定定位的原生触发器在收起态也保持有效几何位置
   （触发器锚点已由上方规则统一固定，两种状态弹出同一位置的原生账号菜单） */
html[data-windows-titlebar] .BynINW_frame[data-sidebar-collapsed] [class*="_footArea"],
html[data-windows-titlebar] [class*="_frame"][data-sidebar-collapsed] [class*="_footArea"] {
  display: flex !important;
}

/* S4 用量按钮已并入 R4：原生触发器视觉隐藏但保留几何位置
   （R4 通过它打开原生用量仪表盘弹窗） */
[data-windows-titlebar] [class*="_footerActions"] button[aria-label="打开用量统计面板"],
[data-windows-titlebar] [class*="_footerActions"] [class*="UcfOsa_root"] {
  opacity: 0 !important;
  pointer-events: none !important;
}

/* S5 账号按钮已并入 R6：原生触发器视觉隐藏但保留几何位置
   （R6 通过它触发原生账号菜单；收起态 footArea 整体 display:none 时走自制菜单回退） */
/* S5 账号按钮已并入 R6：原生触发器视觉隐藏（opacity 0 + 禁点击），
   并在两种状态下都固定定位到同一锚点（固定栏右侧 68px、贴窗口底 10px——视频弹窗位置），
   使原生账号菜单在展开/收起态弹出在同一位置 */
[data-windows-titlebar] [class*="_settingsArea"] button[aria-haspopup="menu"] {
  position: fixed !important;
  left: 68px !important;
  bottom: 10px !important;
  width: 28px !important;
  height: 28px !important;
  margin: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 用量统计独立页面：iframe 填满中央面板 */
.dsh-usage-page-frame {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: var(--dsw-alias-bg-base, #ffffff);
}

/* 用量统计兜底弹窗（原生按钮缺失时） */
.dsh-ui-usage-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: dsh-ag-menu-pop-in 0.12s ease;
}

.dsh-ui-usage-card {
  width: min(960px, 92vw);
  height: min(70vh, 640px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.dsh-ui-usage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--dsw-alias-label-primary, #111827);
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.07));
  flex: none;
}

.dsh-ui-usage-close {
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, #6b7280);
  padding: 4px 6px;
  border-radius: 6px;
}

.dsh-ui-usage-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
}

.dsh-ui-usage-frame {
  flex: 1;
  border: 0;
  width: 100%;
}

/* v1.1.36：工作区行搜索入口（注入补位，与宿主 searchButton 同形同尺寸，
   原生搜索渲染时自动让位） */
.dsh-ag-search-btn {
  border-radius: var(--dsw-radius-sm, 6px);
  cursor: pointer;
  width: 28px;
  height: 28px;
  color: inherit;
  background: 0 0;
  border: none;
  flex: none;
  justify-content: center;
  align-items: center;
  padding: 0;
  display: inline-flex;
}

.dsh-ag-search-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
}

/* v1.1.41：托管卡片工作区区头 —— 三个图标（🔍 搜索 / ⇄ 视图选项 / 📁+ 新建工作区）
   位于区头「右端」，与原生侧边栏一致（用户截图锁定：蓝框 = 图标当时所在位置，
   红框 = 要求移到的右端空位）。

   宿主源码（\`@deepseek-ai/dsh-client-ui-workspace/lib/client.js\`）里的真实结构：
     .sectionHeader = [span.sectionLabel「工作区」] [div.searchSlot（含 🔍）]
                      [div.headerActions（含 ⇄ / 📁+）]
   把图标组顶到右端的并不是 justify-content，而是 .searchSlot 的
   \`flex: 1\` + \`margin-left: auto\`（占位被 max-width: 28px 封顶）：
   自动外边距吸走全部剩余空间，于是 searchSlot 与紧随其后的 headerActions 一并
   贴到区头右端；此时已无剩余空间，justify-content 不再参与分配。

   v1.1.40 曾把这条规则翻转为 flex-start + margin-left: 0，等于亲手取消了这枚
   「右顶」自动外边距——三个图标于是紧贴「工作区」标签排到左侧，正是用户截图里
   蓝框所示（也是「改了却没变化」的原因）。本版撤销该翻转，并显式补回
   margin-left: auto，不依赖宿主日后是否仍保留该声明。

   同时保留 v1.1.39 的搜索槽可见性修复：原生在卡片上下文里会把整个 searchSlot
   收起/隐藏（表现为 🔍 缺失、图标组少一枚宽度），故强制可见并锁 28px 占位。 */
.dsh-native-host [class*="_sectionHeader"] {
  justify-content: flex-end !important;
}

.dsh-native-host [class*="_sectionHeader"] [class*="searchSlot"] {
  display: flex !important;
  opacity: 1 !important;
  visibility: visible !important;
  flex: none !important;
  margin-left: auto !important; /* 吸走剩余空间 → 图标组贴区头右端（关键规则） */
}

.dsh-native-host [class*="_sectionHeader"] [class*="searchSlot"]:not([class*="searchSlotExpanded"]) {
  width: 28px !important;
  min-width: 28px !important;
  max-width: 28px !important;
}

/* 搜索展开态：搜索框吃掉剩余宽度（宿主自适应放宽），标签与图标组让位 */
.dsh-native-host [class*="_sectionHeader"] [class*="searchSlot"][class*="searchSlotExpanded"] {
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  flex: 1 1 auto !important;
}

.dsh-native-host [class*="_sectionHeader"] [class*="headerActions"] {
  flex: none !important;
}
`;

    // Cached handle for the injected <style>. The "restore if something overwrote it"
    // check below still runs on every call — we only skip the repeated getElementById
    // lookup while the element we installed is still the one carrying the tag id.
    let styleElRef = null;
    function ensureStyles() {
      if (typeof document === 'undefined') return;
      let el = (styleElRef && styleElRef.isConnected && styleElRef.id === STYLE_TAG_ID)
        ? styleElRef
        : document.getElementById(STYLE_TAG_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_TAG_ID;
        el.textContent = CSS;
        document.head.appendChild(el);
      } else if (el.textContent !== CSS) {
        el.textContent = CSS;
      }
      styleElRef = el;
    }

    // Known metadata for installed DeepSeek Harness skills.
    // 与 sync_skills.py 的安装清单一一对应（6 项）；新增/下架技能时两边必须同步。
    const KNOWN_SKILL_META = {
      'ai-video-prompt': { name: 'AI视频提示词生成专家', command: 'ai-video-prompt' },
      'storyboard-director': { name: '分镜导演·SD2.0', command: 'storyboard-director' },
      'storyboard-director-sd25': { name: '分镜导演·SD2.5', command: 'storyboard-director-sd25' },
      'screenplay-adaptation': { name: '影视剧本改编大师', command: 'screenplay-adaptation' },
      'art-direction': { name: '艺术指导', command: 'art-direction' },
      'c-drive-cleanup': { name: 'C盘清理', command: 'c-drive-cleanup' },
    };

    // Installed and verified skills in DeepSeek Harness (~/.dsh/skills).
    // Derived from KNOWN_SKILL_META above so the two lists can never drift apart.
    const INSTALLED_SKILLS = Object.entries(KNOWN_SKILL_META)
      .map(([id, meta]) => ({ id, name: meta.name, command: meta.command }));

    let popoverNode = null;
    let popoverCleanup = null;
    let dshCtx = null;
    let liveSkills = [...INSTALLED_SKILLS];
    // 会话宽度锁定的当前目标（消息线程+输入卡片的最低公共祖先），视图切换时迁移标记
    let convLockTarget = null;


    async function fetchLiveSkills() {
      if (!dshCtx) return;
      try {
        const sessions = dshCtx.get?.('sessions') || dshCtx.sessions;
        const remoteSkills = dshCtx.get?.('remote.skills') || dshCtx.remote?.skills;
        if (!sessions || !remoteSkills) return;

        const snapshot = sessions.list?.getSnapshot?.();
        // 优先取主视图会话（retainedBy.mainView），与历史导航的会话判定一致；
        // 取不到再回退列表首位（旧行为，可能不是活动会话）。
        let sessionId = null;
        if (snapshot?.byId) {
          const main = Object.values(snapshot.byId).find(s => ((s.retainedBy || {}).mainView || 0) > 0);
          if (main) sessionId = main.id;
        }
        if (!sessionId) sessionId = (snapshot?.order || [])[0];
        if (!sessionId) return;

        const res = await remoteSkills.list({ sessionId });
        if (res?.ok && Array.isArray(res.value?.skills)) {
          const list = res.value.skills.map(s => {
            const meta = KNOWN_SKILL_META[s.name];
            return {
              id: s.name,
              name: meta?.name || s.name,
              command: s.name,
              description: s.description || ''
            };
          });
          if (list.length > 0) {
            liveSkills = list;
          }
        }
      } catch (e) {
        // Silently preserve verified installed list
        dbg('fetchLiveSkills failed', e);
      }
    }

    // ------------------------------------------------------------------
    // 弹层共用基座：外部点击 / Escape / 窗口 resize / 外部滚动 统一关闭；
    // 面板内部滚动不关闭。监听延迟 10ms 挂载，避免触发打开的那次点击立刻
    // 又命中 outside。返回的 cleanup 幂等，关闭路径必须调用（防监听泄漏）。
    // ------------------------------------------------------------------
    function attachPopoverDismiss({ node, anchorEl, onClose, isInsideExtra }) {
      const isInside = (target) => {
        if (!target || target.nodeType !== 1) return false;
        if (node && node.contains(target)) return true;
        if (anchorEl && anchorEl.contains && anchorEl.contains(target)) return true;
        return isInsideExtra ? !!isInsideExtra(target) : false;
      };
      const onOutside = (e) => {
        if (node && !isInside(e.target)) onClose();
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      const onResizeOrScroll = (e) => {
        const t = e && e.target;
        if (t && t.nodeType === 1 && isInside(t)) return;
        onClose();
      };
      let attached = false;
      const attach = () => {
        if (attached) return;
        attached = true;
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('resize', onResizeOrScroll);
        window.addEventListener('scroll', onResizeOrScroll, true);
      };
      const timer = setTimeout(() => {
        // 面板可能已关闭（节点脱离 DOM），仍打开才挂监听
        if (!node || node.isConnected === false) return;
        attach();
      }, 10);
      let cleaned = false;
      return () => {
        if (cleaned) return;
        cleaned = true;
        clearTimeout(timer);
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('resize', onResizeOrScroll);
        window.removeEventListener('scroll', onResizeOrScroll, true);
      };
    }

    // 光标处插入文本，不回溯清空已有内容。
    // 优先 execCommand('insertText')（与 React 受控编辑器兼容性最好）；
    // 回退路径：textarea/input 走原生 value setter 触发宿主监听，
    // contenteditable 走 Selection/Range，最后统一派发 input 事件。
    function insertTextAtCursor(editor, text) {
      try {
        if (document.execCommand && document.execCommand('insertText', false, text)) {
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
      } catch (e) {}
      if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
        const proto = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const start = editor.selectionStart != null ? editor.selectionStart : editor.value.length;
        const end = editor.selectionEnd != null ? editor.selectionEnd : editor.value.length;
        const next = editor.value.slice(0, start) + text + editor.value.slice(end);
        if (setter) setter.call(editor, next); else editor.value = next;
        const caret = start + text.length;
        try { editor.setSelectionRange(caret, caret); } catch (e) {}
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (editor.isContentEditable) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(text);
          range.insertNode(node);
          range.setStartAfter(node);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editor.appendChild(document.createTextNode(text));
        }
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    function closePopover() {
      if (popoverCleanup) {
        popoverCleanup();
        popoverCleanup = null;
      }
      if (popoverNode && popoverNode.parentNode) {
        popoverNode.parentNode.removeChild(popoverNode);
        popoverNode = null;
      }
      // closeExecPopover is a hoisted function declaration, so the typeof guard that
      // used to wrap this call always passed. The three call sites are plain calls now.
      closeExecPopover();
    }

    function toggleSkillsPopover(anchorEl) {
      closeExecPopover();
      if (popoverNode) {
        closePopover();
        return;
      }

      fetchLiveSkills().catch(() => {});

      const rect = anchorEl.getBoundingClientRect();
      const fromRail = !!(anchorEl.closest && anchorEl.closest('#dsh-ui-rail'));
      const popover = document.createElement('div');
      popover.className = '_3tUStW_list _3tUStW_portal dsh-ag-skills-menu';
      popover.setAttribute('role', 'menu');
      popover.style.position = 'fixed';

      const MARGIN = 12;
      if (fromRail) {
        // 从固定栏弹出：贴图标右侧展开，垂直与图标对齐
        popover.style.top = Math.max(MARGIN, rect.top - 4) + 'px';
        popover.style.left = (rect.right + 10) + 'px';
      } else {
        popover.style.top = (rect.bottom + 4) + 'px';

        // Clamp horizontally inside viewport
        const initialLeft = rect.left;
        popover.style.left = Math.max(MARGIN, initialLeft) + 'px';
      }

      const skillsToRender = (liveSkills && liveSkills.length > 0) ? liveSkills : INSTALLED_SKILLS;

      popover.innerHTML = `
        <div class="_3tUStW_viewport" role="presentation">
          ${skillsToRender.map(s => {
            return `
              <div class="_3tUStW_itemWrap">
                <button type="button" role="menuitem" class="_3tUStW_item" data-skill-id="${escapeHtml(s.id)}" data-skill-command="${escapeHtml(s.command || s.id)}" data-skill-name="${escapeHtml(s.name)}">
                  <span class="_3tUStW_itemIcon">
                    <svg width="14" height="14" viewBox="0 0 176 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="color:var(--dsw-alias-label-tertiary,#4B5563);flex:none;" aria-hidden="true">
                      <path d="M108 4L30 40V126L72 147L150 111V25L108 4Z" stroke="currentColor" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
                      <path d="M72 61V147" stroke="currentColor" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
                      <path d="M30 40L72 61L150 25" stroke="currentColor" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
                      <path d="M30 83L72 104L150 68" stroke="currentColor" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
                    </svg>
                  </span>
                  <span class="_3tUStW_itemLabel">${escapeHtml(s.name)}</span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      popover.querySelectorAll('button[data-skill-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const skillId = btn.dataset.skillId;
          const command = btn.dataset.skillCommand || skillId;
          closePopover();
          // Find composer input and focus/insert native Harness skill trigger
          // (insert at caret — never overwrite what the user already typed)
          const editor = document.querySelector('.RlGAzG_input, [data-composer-input], textarea, div[contenteditable="true"]');
          if (editor) {
            editor.focus();
            insertTextAtCursor(editor, `/${command} `);
          }
        });
      });

      document.body.appendChild(popover);
      popoverNode = popover;

      // Adjust position if overflow
      const actualWidth = popover.offsetWidth || 200;
      if (fromRail) {
        const actualHeight = popover.offsetHeight || 200;
        if (rect.top - 4 + actualHeight > window.innerHeight - MARGIN) {
          popover.style.top = Math.max(MARGIN, window.innerHeight - MARGIN - actualHeight) + 'px';
        }
      } else if (rect.left + actualWidth > window.innerWidth - MARGIN) {
        popover.style.left = Math.max(MARGIN, window.innerWidth - MARGIN - actualWidth) + 'px';
      }

      popoverCleanup = attachPopoverDismiss({
        node: popover,
        anchorEl,
        onClose: closePopover,
      });
    }

    // Custom plugin chip icon: user-supplied artwork (端-01-01.svg). Trimmed to
    // the visible path — the export also carried an ellipse outside the
    // viewBox and a .st0 class referencing a clipPath that does not exist.
    const PLUGIN_SVG_HTML = `
      <svg width="15" height="13" viewBox="0 0 998.8 852.6" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="dsh-ag-plugin-icon" style="flex:none;margin:0;display:inline-block;vertical-align:middle;color:currentColor;" aria-hidden="true" data-plugin-icon="custom">
        <path d="M794.8,264.5C764.7,250,731,238,694.6,228.7c-9.3-36.4-21.3-70.1-35.8-100.1C617.8,43.3,561.1-3.6,499.1-3.6 S380.5,43.3,339.4,128.5c-14.5,30.1-26.5,63.8-35.8,100.1c-36.4,9.3-70.1,21.3-100.1,35.8c-85.2,41-132.1,97.7-132.1,159.7 c0,61.9,46.9,118.6,132.1,159.7c30.1,14.5,63.8,26.5,100.1,35.8c9.3,36.4,21.3,70.1,35.8,100.1c41,85.2,97.7,132.1,159.7,132.1 S617.8,805,658.8,719.8c14.5-30.1,26.5-63.8,35.8-100.1c36.4-9.3,70.1-21.3,100.1-35.8c85.2-41,132.1-97.7,132.1-159.7 C926.9,362.2,879.9,305.5,794.8,264.5z M773.1,538.8c-20.4,9.8-42.8,18.4-66.7,25.7c7.7-44.5,11.7-91.8,11.7-140.3h-0.3 c-0.2-13.5-11.2-24.5-24.8-24.5s-24.6,10.9-24.8,24.5h0c0,53.9-5.2,106-15.1,153.9c-3.8,18.5-8.3,36.3-13.5,53.4 c-7.3,23.9-15.9,46.2-25.7,66.7c-31.8,66-73.5,103.8-114.6,103.8s-82.9-37.8-114.6-103.8c-9.8-20.4-18.4-42.8-25.7-66.7 c44.5,7.7,91.8,11.7,140.3,11.7v0c13.7-0.1,24.7-11.2,24.7-24.9v0c0-13.7-11.1-24.8-24.7-24.9v-0.3c-53.9,0-106-5.2-153.9-15.1 c-18.5-3.8-36.3-8.3-53.4-13.5c-23.9-7.3-46.2-15.9-66.7-25.7c-66-31.8-103.8-73.5-103.8-114.6s37.8-82.9,103.8-114.6 c20.4-9.8,42.8-18.4,66.7-25.7c-7.7,44.5-11.7,91.8-11.7,140.3v0h0c0.1,13.6,11.2,24.6,24.8,24.6h0c13.7,0,24.7-11,24.8-24.6h0.3v0 c0-53.9,5.2-106,15.1-153.9c3.8-18.5,8.3-36.3,13.5-53.4c7.3-23.9,15.9-46.2,25.7-66.7c31.8-66,73.5-103.8,114.6-103.8 c41.1,0,82.9,37.8,114.6,103.8c9.8,20.4,18.4,42.8,25.7,66.7c-44.5-7.7-91.8-11.7-140.3-11.7h0v0c-13.6,0.2-24.6,11.2-24.6,24.8v0 c0,13.6,11,24.7,24.6,24.8v0.3h0c53.9,0,106,5.2,153.9,15.1c18.5,3.8,36.3,8.3,53.4,13.5c23.9,7.3,46.2,15.9,66.7,25.7 c66,31.8,103.8,73.5,103.8,114.6S839,507,773.1,538.8z"/>
      </svg>
    `;

    // Custom skill icon geometry (cube/ice crystal)
    const SKILL_SVG_HTML = `
      <svg width="15" height="13" viewBox="0 0 176 150" fill="none" xmlns="http://www.w3.org/2000/svg" class="dsh-ag-skill-icon" style="flex:none;margin:0;display:inline-block;vertical-align:middle;color:currentColor;" aria-hidden="true">
        <path d="M108 4L30 40V126L72 147L150 111V25L108 4Z" stroke="currentColor" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
        <path d="M72 61V147" stroke="currentColor" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M30 40L72 61L150 25" stroke="currentColor" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
        <path d="M30 83L72 104L150 68" stroke="currentColor" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
      </svg>
    `;
    // Laptop icon（v1.1.26 矢量重绘：原为媒体位图的逐像素行转写 path，数千字符
    // 仅在描述位图；现改为与固定栏图标同风格的 24×24 描边矢量，视觉等价、体积 <1%）
    const LAPTOP_SVG_HTML = `
      <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" class="dsh-ag-laptop-icon" style="flex:none;margin:0;display:inline-block;vertical-align:middle;color:currentColor;" aria-hidden="true">
        <rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/>
        <path d="M2.5 18.5h19"/>
      </svg>
    `;

    // Cloud icon（v1.1.26 矢量重绘，同 LAPTOP）
    const CLOUD_SVG_HTML = `
      <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" class="dsh-ag-cloud-icon" style="flex:none;margin:0;display:inline-block;vertical-align:middle;color:currentColor;" aria-hidden="true">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      </svg>
    `;


    // Checkmark icon geometry
    const CHECKMARK_SVG_HTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="dsh-ag-check-icon">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    let execPopoverNode = null;
    let execPopoverCleanup = null;

    function getExecTarget() {
      try {
        return localStorage.getItem('dsh_ag_exec_target') || 'local';
      } catch (e) {
        return 'local';
      }
    }

    function setExecTarget(target) {
      try {
        localStorage.setItem('dsh_ag_exec_target', target);
      } catch (e) {}
    }

    function updateExecBtnIcon(btn) {
      if (!btn) return;
      const target = getExecTarget();
      // Guarded: this runs on every scan, and an unconditional innerHTML write
      // here recreates the icon node each pass (wasted layout/paint churn and
      // avoidable MutationObserver noise for other plugins).
      if (btn.dataset.dshAgExecTarget === target) return;
      btn.dataset.dshAgExecTarget = target;
      btn.innerHTML = target === 'cloud' ? CLOUD_SVG_HTML : LAPTOP_SVG_HTML;
      btn.title = target === 'cloud' ? '在云端' : '在你的计算机上';
    }

    function closeExecPopover() {
      // 先摘监听再摘节点：所有关闭路径（点选/点外部/Esc/被 closePopover
      // 间接调用）都必须释放 dismiss 监听，否则每次使用都会泄漏一组。
      if (execPopoverCleanup) {
        execPopoverCleanup();
        execPopoverCleanup = null;
      }
      if (execPopoverNode) {
        if (execPopoverNode.parentNode) {
          execPopoverNode.parentNode.removeChild(execPopoverNode);
        }
        execPopoverNode = null;
        document.querySelectorAll('.dsh-ag-exec-target-btn').forEach(b => b.classList.remove('active'));
      }
    }

    function toggleExecPopover(anchorEl) {
      if (execPopoverNode) {
        closeExecPopover();
        return;
      }

      closePopover();

      anchorEl.classList.add('active');

      const rect = anchorEl.getBoundingClientRect();
      const bottomBar = anchorEl.closest('.dsh-ag-bottom-bar') || anchorEl;
      const barRect = bottomBar.getBoundingClientRect();

      // 动态获取 DeepSeek Harness 对话框高度，使卡片高度与对话框高度完全一致，且宽度等比例缩放
      const composerCard = document.querySelector('.RlGAzG_card, [data-composer-card], .RlGAzG_root');
      const composerHeight = (composerCard && composerCard.offsetHeight > 50) ? composerCard.offsetHeight : 106;

      const BASE_HEIGHT = 182;
      const scale = composerHeight / BASE_HEIGHT;

      const popover = document.createElement('div');
      popover.className = 'dsh-ag-exec-popover';
      popover.setAttribute('role', 'dialog');
      popover.setAttribute('aria-modal', 'false');
      popover.style.position = 'fixed';
      popover.style.setProperty('--dsh-ag-exec-scale', scale.toFixed(4));

      // 与点击“技能”后出现的卡片顶部位置严格对齐
      const skillChip = document.querySelector('.dsh-ag-skill-chip');
      const alignedTop = skillChip ? (skillChip.getBoundingClientRect().bottom + 4) : (rect.bottom + 4);
      popover.style.top = alignedTop + 'px';
      popover.style.bottom = 'auto';

      // 右边缘对齐按钮右边缘（或视口安全边界）
      const MARGIN = 12;
      let right = window.innerWidth - rect.right;
      if (right < MARGIN) right = MARGIN;
      popover.style.right = right + 'px';
      popover.style.left = 'auto';

      const currentTarget = getExecTarget();

      popover.innerHTML = `
        <div class="dsh-ag-exec-title">此聊天要在哪里运行？</div>
        <div class="dsh-ag-exec-list" role="menu">
          <div class="dsh-ag-exec-item ${currentTarget === 'local' ? 'dsh-ag-exec-selected' : ''}" data-target="local" role="menuitem" tabindex="0">
            <div class="dsh-ag-exec-icon">
              ${LAPTOP_SVG_HTML}
            </div>
            <div class="dsh-ag-exec-text">
              <div class="dsh-ag-exec-name">在你的计算机上</div>
              <div class="dsh-ag-exec-desc">经许可读取和编辑本地文件</div>
            </div>
            <div class="dsh-ag-exec-check">
              ${CHECKMARK_SVG_HTML}
            </div>
          </div>
          <div class="dsh-ag-exec-item ${currentTarget === 'cloud' ? 'dsh-ag-exec-selected' : ''}" data-target="cloud" role="menuitem" tabindex="0">
            <div class="dsh-ag-exec-icon">
              ${CLOUD_SVG_HTML}
            </div>
            <div class="dsh-ag-exec-text">
              <div class="dsh-ag-exec-name">在云端</div>
              <div class="dsh-ag-exec-desc">除非已附加，否则无法访问本地文件</div>
            </div>
            <div class="dsh-ag-exec-check">
              ${CHECKMARK_SVG_HTML}
            </div>
          </div>
        </div>
      `;

      popover.querySelectorAll('.dsh-ag-exec-item').forEach(item => {
        const target = item.dataset.target;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          setExecTarget(target);

          popover.querySelectorAll('.dsh-ag-exec-item').forEach(el => {
            el.classList.toggle('dsh-ag-exec-selected', el.dataset.target === target);
          });

          document.querySelectorAll('.dsh-ag-exec-target-btn').forEach(btn => {
            updateExecBtnIcon(btn);
          });

          setTimeout(() => {
            closeExecPopover();
          }, 120);
        });

        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
          }
        });
      });

      document.body.appendChild(popover);
      execPopoverNode = popover;

      execPopoverCleanup = attachPopoverDismiss({
        node: popover,
        anchorEl,
        onClose: closeExecPopover,
      });
    }

    // DSH 本地实际安装的可用插件与服务列表 (真实反映本地配置与加载状态)
    const UNINSTALLED_PLUGIN_IDS = new Set([
      'dsh-media-gen',
      '@local/dsh-media-gen',
      'chatgpt-skin',
      'dsh-ivory',
      'yingqiwu-hero',
      '@local/yingqiwu-hero',
      'dsh-catppuccin',
      '@nonamelego/dsh-catppuccin',
      'auto-review',
      '@deepseek-ai/dsh-experimental-auto-review',
      'github-mcp',
    ]);

    // 默认真实基础插件（在桥接服务扫描返回前作为初始占位）
    const LOCAL_INSTALLED_PLUGINS = [
      {
        id: '@local/model-strength-picker',
        rowId: 'model-strength-picker',
        name: '模型思考强度选择器',
        desc: '配置模型思考强度档位。',
        searchText: 'moxing sikao qiangdu strength brain think picker',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
        defaultOn: true,
      },
      {
        id: 'dshmarket',
        aliasId: 'dsh-market',
        rowId: 'dsh-market',
        name: '插件市场',
        desc: '逛一逛，点一下，装好。',
        searchText: 'chajian shichang market dshmarket goumai shangcheng',
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
        defaultOn: true,
      }
    ];

    let livePluginsList = null;

    // 获取当前 DSH 本地实际安装及运行时加载的插件列表 (严格过滤卸载项)
    function getInstalledPlugins() {
      if (livePluginsList && livePluginsList.length > 0) {
        return livePluginsList.filter(p => !UNINSTALLED_PLUGIN_IDS.has(p.id) && !UNINSTALLED_PLUGIN_IDS.has(p.rowId));
      }
      return [...LOCAL_INSTALLED_PLUGINS];
    }

    const PLUGIN_STORAGE_KEY = 'dsh_plugins_state';
    function loadPluginState() {
      try {
        const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            UNINSTALLED_PLUGIN_IDS.forEach(id => { delete parsed[id]; });
            delete parsed['adobe'];
            delete parsed['remotion'];
            delete parsed['figma'];
            delete parsed['hyperframes'];
            delete parsed['documents'];
            delete parsed['github'];
            return parsed;
          }
        }
      } catch (e) {}
      return {};
    }

    // Only touch localStorage when the serialised state actually changed. The stored
    // value is byte-identical either way, so this is behaviour-preserving.
    let lastPluginStateJson = null;
    function savePluginState(state) {
      try {
        const json = JSON.stringify(state);
        if (json === lastPluginStateJson) return;
        localStorage.setItem(PLUGIN_STORAGE_KEY, json);
        lastPluginStateJson = json;
      } catch (e) {}
    }

    let pluginState = loadPluginState();

    // `plugins` can be supplied by callers that already computed the list, which keeps
    // the hot loops below O(N) instead of O(N^2). The default preserves the result for
    // any caller that passes nothing.
    function isPluginEnabled(pluginId, plugins = getInstalledPlugins()) {
      if (pluginState[pluginId] !== undefined) {
        return Boolean(pluginState[pluginId]);
      }
      const found = plugins.find(p => p.id === pluginId || p.aliasId === pluginId || p.rowId === pluginId);
      return found ? (found.enabled !== undefined ? found.enabled : found.defaultOn) : true;
    }

    function renderToggleSwitch(isOn, extraClass = '', extraAttrs = '') {
      return `
        <span class="dsh-ag-toggle-switch ${isOn ? 'dsh-ag-toggle-on' : ''} ${extraClass}" role="switch" aria-checked="${isOn ? 'true' : 'false'}" ${extraAttrs} tabindex="0">
          <span class="dsh-ag-toggle-thumb"></span>
        </span>
      `;
    }

    function syncSwitchVisual(switchEl, isOn) {
      if (!switchEl) return;
      if (isOn) {
        switchEl.classList.add('dsh-ag-toggle-on');
        switchEl.setAttribute('aria-checked', 'true');
      } else {
        switchEl.classList.remove('dsh-ag-toggle-on');
        switchEl.setAttribute('aria-checked', 'false');
      }
    }

    function renderPluginItemsInPopover(popover) {
      if (!popover) return;
      const listContainer = popover.querySelector('.dsh-ag-plugins-list');
      if (!listContainer) return;

      const currentPlugins = getInstalledPlugins();

      const itemsHtml = currentPlugins.map(p => {
        const isEnabled = isPluginEnabled(p.id, currentPlugins);
        const pName = p.name || p.id;
        const pDesc = p.desc || '';
        const pSearchText = p.searchText || p.pinyin || (pName + ' ' + pDesc); // pinyin 为 ≤1.1.3 的旧字段名，兜底兼容
        return `
          <div class="dsh-ag-plugin-item" role="menuitem" data-plugin-id="${escapeHtml(p.id)}" data-plugin-name="${escapeHtml(pName)}" data-plugin-desc="${escapeHtml(pDesc)}" data-plugin-pinyin="${escapeHtml(pSearchText)}" style="display: flex;">
            <div class="dsh-ag-plugin-item-left">
              <span class="dsh-ag-plugin-item-icon">
                ${p.icon || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'}
              </span>
              <span class="dsh-ag-plugin-item-name">${escapeHtml(pName)}</span>
            </div>
            ${renderToggleSwitch(isEnabled, 'dsh-ag-item-switch', `data-plugin-id="${p.id}" title="${isEnabled ? '已启用（点击禁用）' : '已禁用（点击启用）'}"`)}
          </div>
        `;
      }).join('');

      listContainer.innerHTML = itemsHtml + `<div class="dsh-ag-plugins-empty" style="display: ${currentPlugins.length === 0 ? 'block' : 'none'};">暂无插件</div>`;

      // 绑定每个插件项的点击与开关事件
      listContainer.querySelectorAll('.dsh-ag-plugin-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const pId = item.dataset.pluginId;
          if (pId) togglePluginItem(pId);
        });
        const sw = item.querySelector('.dsh-ag-item-switch');
        if (sw) {
          sw.addEventListener('click', (e) => {
            e.stopPropagation();
            const pId = sw.dataset.pluginId;
            if (pId) togglePluginItem(pId);
          });
        }
      });
    }

    async function fetchLivePlugins() {
      // 1. 尝试从 DSH-UI 本地桥接服务获取真实扫描的插件列表
      try {
        const res = await fetch(`${BRIDGE_API}/api/plugins`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.plugins)) {
            livePluginsList = data.plugins.filter(p => !UNINSTALLED_PLUGIN_IDS.has(p.id) && !UNINSTALLED_PLUGIN_IDS.has(p.rowId));
            livePluginsList.forEach(p => {
              pluginState[p.id] = p.enabled;
              if (p.aliasId) pluginState[p.aliasId] = p.enabled;
              if (p.rowId) pluginState[p.rowId] = p.enabled;
            });
            savePluginState(pluginState);
            if (popoverNode) {
              renderPluginItemsInPopover(popoverNode);
            }
            updateAllSwitches();
            return;
          }
        }
      } catch (e) { dbg('bridge /api/plugins failed', e); }

      // 2. 备用方式：从 DSH 官方宿主 /dsh-market/installed 获取
      try {
        const res = await fetch('/dsh-market/installed', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.installed) {
            const patchDisables = new Set(data.patch?.disables || []);
            const patchDisabledSet = new Set(data.patchDisabled || []);
            const installedKeys = Object.keys(data.installed).filter(k => 
              k !== '@deepseek-ai/dsh-base' && 
              k !== '@deepseek-ai/dsh-web-app' && 
              k !== '@deepseek-ai/dsh-headless' && 
              k !== '@local/dsh-ui' && 
              k !== 'dsh-ui' && 
              !UNINSTALLED_PLUGIN_IDS.has(k)
            );

            livePluginsList = installedKeys.map(k => {
              const row = k.replace(/^@[^/]+\//, '');
              const isOff = patchDisables.has(row) || patchDisabledSet.has(k) || (Array.isArray(data.disabled) && data.disabled.includes(k));
              return {
                id: k,
                rowId: row,
                name: k === 'dshmarket' ? '插件市场' : (k === '@local/model-strength-picker' ? '模型思考强度选择器' : row),
                desc: '',
                enabled: !isOff,
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`
              };
            });

            livePluginsList.forEach(p => {
              pluginState[p.id] = p.enabled;
              if (p.rowId) pluginState[p.rowId] = p.enabled;
            });
            savePluginState(pluginState);
            if (popoverNode) {
              renderPluginItemsInPopover(popoverNode);
            }
            updateAllSwitches();
          }
        }
      } catch (e) { dbg('/dsh-market/installed fallback failed', e); }
    }

    async function togglePluginItem(pluginId) {
      const current = isPluginEnabled(pluginId);
      const next = !current;

      // 1. Optimistic instant visual switch
      pluginState[pluginId] = next;
      savePluginState(pluginState);
      updateAllSwitches();

      // 2. Market endpoint first: it performs the full multi-layer toggle
      //    (live mount/unmount, state.json, bundles stack, patch rows) and
      //    its reply carries the restart/refresh verdict needed to explain
      //    plugins that cannot hot-unload — without it a working toggle
      //    reads as a dead one.
      let result = null;
      try {
        const res = await fetch('/dsh-market/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: pluginId, enabled: next })
        });
        if (res.status !== 404) {
          const data = await res.json().catch(() => null);
          if (data && data.ok) {
            result = { ok: true, restart: !!data.restart, refresh: !!data.refresh, patchOnly: false };
          } else if (data && (data.error || data.reason)) {
            result = { ok: false, reason: String(data.error || data.reason) };
          }
        }
      } catch (e) { dbg('/dsh-market/toggle failed', e); }

      // 3. Bridge fallback (writes the patch row and notifies the market itself)
      if (!result) {
        try {
          const res = await fetch(`${BRIDGE_API}/api/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pluginId, enabled: next })
          });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && data.ok) {
              pluginState[pluginId] = data.enabled;
              if (data.rowId) pluginState[data.rowId] = data.enabled;
              savePluginState(pluginState);
              updateAllSwitches();
              result = { ok: true, restart: !!data.restart, refresh: !!data.refresh, patchOnly: data.via !== 'market' };
            }
          }
        } catch (e) { dbg('bridge /api/toggle failed', e); }
      }

      // 4. Both channels failed: roll the switch back so the visual never lies,
      //    then flag the row inline (red flash + shake) instead of a toast.
      if (!result || !result.ok) {
        pluginState[pluginId] = current;
        savePluginState(pluginState);
        updateAllSwitches();
        flagToggleRow(pluginId, 'error', '切换失败', result && result.reason);
        return;
      }

      // 5. Durable but not live: the page keeps running its already-loaded
      //    client code, and Desktop cannot self-restart the host (the market
      //    hardcodes allowRestart:false there — the shell owns the process).
      //    The strongest step we can offer is a page reload, one click away
      //    on the hint itself.
      if (result.restart || result.refresh || result.patchOnly) {
        flagToggleRow(pluginId, 'deferred', '已保存，点击刷新生效',
          '已写入配置。点击提示刷新页面查看效果；若刷新后仍未生效，重启应用即可。', 'reload');
      }
    }

    // Marks the affected row for a short window: failures shake the switch
    // and flash a red "切换失败" hint; deferred successes show an amber
    // actionable hint ("已保存，点击刷新生效") — clicking it reloads the
    // page, which is the strongest immediate step Desktop allows (self-
    // restart is hardcoded off there; the shell owns the process lifecycle).
    // Guard prevents stacking animations when the same row is clicked
    // repeatedly. `detail` rides on the row title for hover.
    function flagToggleRow(pluginId, kind, text, detail, action) {
      if (!popoverNode) return;
      let item = null;
      popoverNode.querySelectorAll('.dsh-ag-plugin-item[data-plugin-id]').forEach(el => {
        if (el.dataset.pluginId === pluginId) item = el;
      });
      if (!item || item.dataset.dshAgFlagging === 'true') return;
      item.dataset.dshAgFlagging = 'true';

      const isError = kind === 'error';
      const sw = item.querySelector('.dsh-ag-item-switch');
      // Append the hint to the flex row container, not inside the name span:
      // the name has ellipsis overflow, so a long plugin name would clip a
      // nested hint. As a flex:none sibling it always stays fully visible.
      const left = item.querySelector('.dsh-ag-plugin-item-left');
      item.classList.add(isError ? 'dsh-ag-toggle-failed' : 'dsh-ag-toggle-deferred');
      if (detail) item.title = detail;
      let hint = left && left.querySelector('.dsh-ag-toggle-error');
      if (!hint && left) {
        hint = document.createElement('span');
        hint.className = 'dsh-ag-toggle-error';
        hint.textContent = text;
        left.appendChild(hint);
      }
      // Actionable hint: one click applies the change. stopPropagation keeps
      // the row's own click (toggle the switch) from firing underneath.
      if (!isError && action === 'reload' && hint) {
        hint.classList.add('dsh-ag-toggle-action');
        hint.addEventListener('click', (e) => {
          e.stopPropagation();
          location.reload();
        });
      }
      if (isError && sw) sw.classList.add('dsh-ag-toggle-shake');

      const TTL = isError ? 1600 : 8000;
      setTimeout(() => {
        item.classList.remove('dsh-ag-toggle-failed', 'dsh-ag-toggle-deferred');
        item.removeAttribute('title');
        const oldHint = left && left.querySelector('.dsh-ag-toggle-error');
        if (oldHint) oldHint.remove();
        if (sw) sw.classList.remove('dsh-ag-toggle-shake');
        delete item.dataset.dshAgFlagging;
      }, TTL);
    }

    function updateAllSwitches() {
      if (popoverNode) {
        const plugins = getInstalledPlugins();
        popoverNode.querySelectorAll('.dsh-ag-plugin-item[data-plugin-id]').forEach(item => {
          const pId = item.dataset.pluginId;
          const isOn = isPluginEnabled(pId, plugins);
          const sw = item.querySelector('.dsh-ag-item-switch');
          if (sw) {
            syncSwitchVisual(sw, isOn);
            sw.title = isOn ? '已启用（点击禁用）' : '已禁用（点击启用）';
          }
        });
      }
    }

    function openSystemPluginSettings() {
      closePopover();

      // 寻找设置弹窗左侧导航中的「插件」项。精确匹配优先，避免命中「插件市场」。
      function findPluginNavButton() {
        const navBtns = document.querySelectorAll(
          '[data-shortcut-modal="settings"] nav button, ' +
          '[role="dialog"] nav button, ' +
          '[class*="_panel"] nav button, ' +
          '[class*="_navCell"], ' +
          '[class*="wCInkW_navCell"], ' +
          'nav button'
        );
        for (const btn of navBtns) {
          const txt = (btn.textContent || '').trim();
          if (txt === '插件' || txt === 'Plugins' || txt === 'Plugin') {
            return btn;
          }
        }
        for (const btn of navBtns) {
          const txt = (btn.textContent || '').trim();
          const lower = txt.toLowerCase();
          if ((txt.includes('插件') && !txt.includes('市场')) || lower === 'plugins' || lower.includes('plugin')) {
            return btn;
          }
        }
        return null;
      }

      function safeClick(el) {
        if (!el) return;
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        } catch (e) {}
        try {
          el.click();
        } catch (e) {}
      }

      // 如果设置弹窗已经处于打开状态，直接跳转到插件面板
      const existingBtn = findPluginNavButton();
      if (existingBtn) {
        safeClick(existingBtn);
        return;
      }

      // 2. 精准定位设置入口按钮（位于侧边栏底部 footArea / settingsArea 中）
      function findSettingsButton() {
        // 优先级 1: 侧边栏底部 settingsArea / footArea 内的按钮
        const inSettingsArea = document.querySelector(
          '[class*="settingsArea"] button, ' +
          '[class*="footArea"] [class*="triggerRow"] button, ' +
          '[class*="triggerRow"] button[aria-haspopup="dialog"], ' +
          '[class*="triggerRow"] button'
        );
        if (inSettingsArea) return inSettingsArea;

        // 优先级 2: 明确带有“设置”或“Settings”标签的按钮
        const byLabel = document.querySelector(
          'button[aria-label="设置"], button[aria-label="Settings"], ' +
          'button[title="设置"], button[title="Settings"]'
        );
        if (byLabel) return byLabel;

        // 优先级 3: 包含设置特征类名的 trigger 按钮
        const byClass = document.querySelector(
          'button[class*="wCInkW_trigger"], ' +
          'button[class*="_trigger"][class*="rail"]'
        );
        if (byClass) return byClass;

        // 优先级 4: 全局遍历带有“设置”文本/图标且具有 dialog popup 的按钮
        for (const b of document.querySelectorAll('button')) {
          const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim();
          if ((aria === '设置' || aria === 'Settings') && b.getAttribute('aria-haspopup') === 'dialog') {
            return b;
          }
        }
        return null;
      }

      const settingsBtn = findSettingsButton();
      let clickedSettings = false;
      if (settingsBtn) {
        safeClick(settingsBtn);
        clickedSettings = true;
      }

      // 3. 原生全局快捷键保障（桌面端 Ctrl+, / Web 端 Ctrl+Alt+, 以及 macOS Cmd+,）
      const isMac = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      function dispatchShortcut() {
        const events = [
          new KeyboardEvent('keydown', {
            key: ',',
            code: 'Comma',
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          }),
          new KeyboardEvent('keydown', {
            key: ',',
            code: 'Comma',
            ctrlKey: true,
            altKey: true,
            bubbles: true,
            cancelable: true
          })
        ];
        for (const evt of events) {
          window.dispatchEvent(evt);
          document.dispatchEvent(evt);
        }
      }

      // 如果未找到按钮，或作为双保险派发快捷键
      if (!clickedSettings) {
        dispatchShortcut();
      }

      // 4. 使用 MutationObserver + 高频快速轮询，第一时间激活「插件」面板
      let settled = false;
      function trySelectPluginNav() {
        if (settled) return true;
        const pluginBtn = findPluginNavButton();
        if (pluginBtn) {
          settled = true;
          safeClick(pluginBtn);
          return true;
        }
        return false;
      }

      if (trySelectPluginNav()) return;

      const observer = new MutationObserver(() => {
        if (trySelectPluginNav()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (attempts === 8 && !settled) {
          // 200ms 后若未弹出，补发一次快捷键兜底
          dispatchShortcut();
        }
        if (trySelectPluginNav() || attempts >= 80) {
          clearInterval(interval);
          observer.disconnect();
        }
      }, 25);
    }

    function togglePluginsPopover(anchorEl) {
      closeExecPopover();
      if (popoverNode) {
        closePopover();
        return;
      }

      fetchLivePlugins();

      const rect = anchorEl.getBoundingClientRect();
      const fromRail = !!(anchorEl.closest && anchorEl.closest('#dsh-ui-rail'));
      const popover = document.createElement('div');
      popover.className = 'dsh-ag-plugins-menu';
      popover.setAttribute('role', 'menu');
      popover.style.position = 'fixed';

      const MARGIN = 12;
      if (fromRail) {
        // 从固定栏弹出：贴图标右侧展开，垂直与图标对齐
        popover.style.top = Math.max(MARGIN, rect.top - 4) + 'px';
        popover.style.left = (rect.right + 10) + 'px';
        popover.style.bottom = 'auto';
        popover.style.right = 'auto';
      } else {
        // 与”技能”和执行环境卡片顶部位置严格对齐（在按钮下方 4px 展开）
        const skillChip = document.querySelector('.dsh-ag-skill-chip');
        const alignedTop = skillChip ? (skillChip.getBoundingClientRect().bottom + 4) : (rect.bottom + 4);
        popover.style.top = alignedTop + 'px';
        popover.style.bottom = 'auto';

        const initialLeft = rect.left;
        popover.style.left = Math.max(MARGIN, initialLeft) + 'px';
        popover.style.right = 'auto';
      }

      popover.innerHTML = `
        <div class="dsh-ag-plugins-list" role="presentation">
          <div class="dsh-ag-plugins-empty">暂无插件</div>
        </div>
        <div class="dsh-ag-plugins-footer" role="button" tabindex="0" title="浏览所有插件">
          <div class="dsh-ag-plugins-footer-left">
            ${PLUGIN_SVG_HTML}
            <span>浏览所有插件</span>
          </div>
          <svg class="dsh-ag-footer-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>
      `;

      // 实时渲染当前已发现插件列表
      renderPluginItemsInPopover(popover);

      // Footer click: open the system plugin settings page
      const footer = popover.querySelector('.dsh-ag-plugins-footer');
      if (footer) {
        footer.addEventListener('click', (e) => {
          e.stopPropagation();
          openSystemPluginSettings();
        });
        footer.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openSystemPluginSettings();
          }
        });
      }

      document.body.appendChild(popover);
      popoverNode = popover;

      const actualWidth = popover.offsetWidth || 280;
      if (fromRail) {
        const actualHeight = popover.offsetHeight || 200;
        if (rect.top - 4 + actualHeight > window.innerHeight - MARGIN) {
          popover.style.top = Math.max(MARGIN, window.innerHeight - MARGIN - actualHeight) + 'px';
        }
      } else if (rect.left + actualWidth > window.innerWidth - MARGIN) {
        popover.style.left = Math.max(MARGIN, window.innerWidth - MARGIN - actualWidth) + 'px';
      }

      popoverCleanup = attachPopoverDismiss({
        node: popover,
        anchorEl,
        onClose: closePopover,
      });
    }

    // Attach bottom bar on grey block holding "插件" (前) and "技能" (后) (从左到右排列)
    function attachBottomBar(heroContainer) {
      if (!heroContainer) return;
      let bar = heroContainer.querySelector('.dsh-ag-bottom-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'dsh-ag-bottom-bar';
        heroContainer.appendChild(bar);
      }

      // 1. "插件" (排在前面，采用用户专属的 @ 插头图标)
      let pluginChip = bar.querySelector('.dsh-ag-plugin-chip');
      if (!pluginChip) {
        pluginChip = document.createElement('button');
        pluginChip.className = 'dsh-ag-plugin-chip';
        pluginChip.type = 'button';
        pluginChip.setAttribute('aria-label', '插件');
        pluginChip.innerHTML = `${PLUGIN_SVG_HTML}<span>插件</span>`;
        pluginChip.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePluginsPopover(pluginChip);
        });
        bar.appendChild(pluginChip);
      } else {
        const existingSvg = pluginChip.querySelector('svg');
        if (existingSvg && (!existingSvg.classList.contains('dsh-ag-plugin-icon') || existingSvg.getAttribute('viewBox') !== '0 0 998.8 852.6')) {
          existingSvg.outerHTML = PLUGIN_SVG_HTML;
        }
        const oldSwitch = pluginChip.querySelector('.dsh-ag-chip-switch, .dsh-ag-toggle-switch');
        if (oldSwitch) oldSwitch.remove();
        pluginChip.classList.remove('dsh-ag-plugin-off');
      }

      // 2. "技能" (排在后面)
      let skillChip = bar.querySelector('.dsh-ag-skill-chip');
      if (!skillChip) {
        skillChip = document.createElement('button');
        skillChip.className = 'dsh-ag-skill-chip';
        skillChip.type = 'button';
        skillChip.setAttribute('aria-label', '技能');
        skillChip.innerHTML = `${SKILL_SVG_HTML}<span>技能</span>`;
        skillChip.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSkillsPopover(skillChip);
        });
        bar.appendChild(skillChip);
      } else {
        const existingSvg = skillChip.querySelector('svg');
        if (existingSvg && existingSvg.getAttribute('viewBox') !== '0 0 176 150') {
          existingSvg.outerHTML = SKILL_SVG_HTML;
        }
      }

      // 严格保证顺序：插件在前，技能在后
      if (pluginChip && skillChip && pluginChip.nextElementSibling !== skillChip) {
        bar.insertBefore(pluginChip, skillChip);
      }

      // 3. 执行目标环境按钮 —— 目前是纯视觉组件（选择仅写 localStorage，
      //    无行为对接），SHOW_EXEC_TARGET 默认 false 不挂载以免误导；
      //    宿主提供真实执行目标 API 后置 true 即恢复完整交互。
      if (SHOW_EXEC_TARGET) {
        let execBtn = bar.querySelector('.dsh-ag-exec-target-btn');
        if (!execBtn) {
          execBtn = document.createElement('button');
          execBtn.className = 'dsh-ag-exec-target-btn';
          execBtn.type = 'button';
          execBtn.setAttribute('aria-label', '此聊天要在哪里运行？');
          updateExecBtnIcon(execBtn);
          execBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExecPopover(execBtn);
          });
          bar.appendChild(execBtn);
        } else {
          updateExecBtnIcon(execBtn);
        }

        if (execBtn && bar.lastElementChild !== execBtn) {
          bar.appendChild(execBtn);
        }
      } else {
        bar.querySelectorAll('.dsh-ag-exec-target-btn').forEach(b => b.remove());
      }
    }

    // Custom workspace icon geometry extracted 1:1 from media_1790822141172.png
    const WORKSPACE_SVG_PATHS = `
      <path d="M4 24C4 13 13 4 24 4H64C76 4 86 16 94 27C98 32 103 35 110 35H152C163 35 172 44 172 55V126C172 137 163 146 152 146H24C13 146 4 137 4 126V24Z" stroke="currentColor" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4 70H172" stroke="currentColor" stroke-width="8.5" fill="none"/>
    `;

    function updateWorkspaceSvgNode(svgNode) {
      if (!svgNode) return;
      if (svgNode.dataset.dshAgReplaced === 'true' && svgNode.getAttribute('viewBox') === '0 0 176 150') return;
      svgNode.dataset.dshAgReplaced = 'true';
      svgNode.setAttribute('viewBox', '0 0 176 150');
      svgNode.setAttribute('width', '15');
      svgNode.setAttribute('height', '13');
      svgNode.classList.add('dsh-ag-workspace-icon');
      svgNode.style.cssText = 'flex:none;width:15px;height:13px;min-width:15px;min-height:13px;max-width:15px;max-height:13px;margin:0;display:inline-block;vertical-align:middle;color:currentColor;box-sizing:border-box;';
      svgNode.innerHTML = WORKSPACE_SVG_PATHS;
    }

    function createWorkspaceSvgNode() {
      const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      newSvg.setAttribute('viewBox', '0 0 176 150');
      newSvg.setAttribute('width', '15');
      newSvg.setAttribute('height', '13');
      newSvg.classList.add('Hqq-bq_folder', 'dsh-ag-workspace-icon');
      newSvg.style.cssText = 'flex:none;width:15px;height:13px;min-width:15px;min-height:13px;margin:0;display:inline-block;vertical-align:middle;color:currentColor;';
      newSvg.innerHTML = WORKSPACE_SVG_PATHS;
      return newSvg;
    }

    function sanitizeWorkspaceLabel(row) {
      if (!row) return;
      const wsBtn = row.querySelector('.Hqq-bq_workspace, button[class*="workspace"]');
      if (!wsBtn) return;
      const label = wsBtn.querySelector('.Hqq-bq_workspaceLabel, [class*="workspaceLabel"]');
      if (label) {
        const text = label.textContent?.trim();
        if (!text || text === '选择工作区' || text === '默认' || text === 'Default') {
          if (label.textContent !== '选择项目') {
            label.textContent = '选择项目';
          }
        }
      }
    }

    function replaceWorkspaceFolderIcon(row) {
      if (!row) return;
      let wsBtn = row.querySelector('.Hqq-bq_workspace, [class*="workspace"]');
      if (!wsBtn) {
        const firstBtn = row.querySelector('button:not(.dsh-ag-skill-chip)');
        if (firstBtn && !firstBtn.classList.contains('dsh-ag-skill-chip')) {
          wsBtn = firstBtn;
        }
      }
      if (!wsBtn) return;

      const folderSvg = wsBtn.querySelector('.Hqq-bq_folder, [class*="folder"], svg:not([class*="chevron"]):not(.dsh-ag-workspace-icon)');
      if (folderSvg) {
        updateWorkspaceSvgNode(folderSvg);
      } else if (!wsBtn.querySelector('.dsh-ag-workspace-icon')) {
        const newSvg = createWorkspaceSvgNode();
        const label = wsBtn.querySelector('.Hqq-bq_workspaceLabel, [class*="workspaceLabel"]');
        if (label) {
          wsBtn.insertBefore(newSvg, label);
        } else {
          wsBtn.prepend(newSvg);
        }
      }
    }

    function replaceAllWorkspaceIcons(root = document) {
      const wsButtons = root.querySelectorAll('.Hqq-bq_workspace, button[class*="workspace"]');
      wsButtons.forEach(wsBtn => {
        const label = wsBtn.querySelector('.Hqq-bq_workspaceLabel, [class*="workspaceLabel"]');
        if (label) {
          const text = label.textContent?.trim();
          if (!text || text === '选择工作区' || text === '默认' || text === 'Default') {
            if (label.textContent !== '选择项目') {
              label.textContent = '选择项目';
            }
          }
        }
        const folderSvg = wsBtn.querySelector('.Hqq-bq_folder, [class*="folder"], svg:not([class*="chevron"]):not(.dsh-ag-workspace-icon)');
        if (folderSvg) {
          updateWorkspaceSvgNode(folderSvg);
        } else if (!wsBtn.querySelector('.dsh-ag-workspace-icon')) {
          const newSvg = createWorkspaceSvgNode();
          if (label) {
            wsBtn.insertBefore(newSvg, label);
          } else {
            wsBtn.prepend(newSvg);
          }
        }
      });
    }

    /* v1.1.36 工作区行搜索图标：与宿主 IconSearchOutlineRegular 1:1（16x16、
       stroke-width 1，两条 path 原样取自 dsh-client-ui-primitives）。 */
    const SEARCH_SVG_HTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke-width="1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z" stroke="currentColor"/>
        <path d="M10.2991 10.3933L14.7783 14.8725" stroke="currentColor"/>
      </svg>
    `;

    /* v1.1.38：工作区行搜索入口恢复（图标组右端、🔍 居组图标最左，与原生一致）。
       事实（用户截图核实）：原生侧边栏 searchSlot 正常可见；托管卡片里它整体
       不可见（卡片的 🔍 因此缺失）。v1.1.37 把注入按钮插进原生按钮原位——若
       searchSlot 整体不可见，注入件会被关进同一不可见容器。现改为插进区头
       「搜索槽之前」（图标组最左，槽外独立可见）：
       - 先插入成功、再隐藏原生按钮（失败也不会只剩隐藏）；
       - 每次扫描幂等对位，React 重挂载后自动重新隐藏/归位；
       - 点击时再定位原生按钮转发（隐藏态仍可触发其 React onClick → 原生
         搜索展开），找不到则派发 Ctrl+K（session.search 原生快捷键）。

       v1.1.41：图标组回到区头右端（见 styles.css 的托管区头规则），并放宽原生按钮
       的定位范围（区头内优先 → 区头父级兜底）——宿主布局变动时注入件不会因为
       一次性查不到原生按钮而退化。 */
    function buildWorkspaceSearchBtn() {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dsh-ag-search-btn';
      btn.setAttribute('aria-label', '搜索会话');
      btn.title = '搜索会话（Ctrl+K）';
      btn.innerHTML = SEARCH_SVG_HTML;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 点击时再定位原生按钮（React 重挂载后旧引用会失效）；隐藏态仍可触发其 onClick
        let native = null;
        try {
          const host = btn.closest('[class*="_sectionHeader"]') || btn.parentElement;
          native = host && (host.querySelector('[class*="searchButton"]:not(.dsh-ag-search-btn)')
            || (host.parentElement && host.parentElement.querySelector('[class*="searchButton"]:not(.dsh-ag-search-btn)')));
        } catch (err) {}
        if (native) {
          try { native.click(); return; } catch (err) {}
        }
        railDispatchKey('KeyK', 'k', { ctrl: true });
        setTimeout(() => railDispatchKey('KeyK', 'k', { ctrl: true, alt: true }), 60);
      });
      return btn;
    }

    // v1.1.41：把托管卡片工作区区头的图标组钉在「右端」。
    //
    // 宿主原生布局（dsh-client-ui-workspace）里，把图标组顶到右端的不是
    // justify-content，而是 .searchSlot 的 `margin-left: auto`——这枚自动外边距
    // 吸走区头全部剩余空间，紧随其后的 headerActions（⇄ / 📁+）便贴到右端。
    // 一旦这条声明在托管上下文里被覆盖，图标组就会塌回「工作区」标签旁
    // （即用户截图蓝框所示的位置）。
    //
    // styles.css 已用 !important 声明过同一件事；这里再用「内联 !important」
    // 钉一次：内联声明的优先级高于任何样式表，可免疫其它插件样式表的后置覆盖。
    // 仅作用于托管卡片（.dsh-native-host）内部，原生侧边栏不受影响。
    function enforceWorkspaceHeaderLayout(header) {
      if (!header || header.nodeType !== 1) return;
      try {
        if (!header.closest('.dsh-native-host')) return;
        header.style.setProperty('justify-content', 'flex-end', 'important');
        const slot = header.querySelector('[class*="searchSlot"]');
        if (!slot) return;
        if (/searchSlotExpanded/.test(String(slot.className))) {
          // 搜索展开态：搜索框自身吃掉剩余宽度，交还原生自适应
          slot.style.removeProperty('margin-left');
        } else {
          slot.style.setProperty('margin-left', 'auto', 'important');
        }
      } catch (e) { dbg('enforceWorkspaceHeaderLayout failed', e); }
    }

    function ensureWorkspaceSearch(root = document) {
      try {
        const headers = root.querySelectorAll('[class*="_sectionHeader"]');
        headers.forEach(header => {
          enforceWorkspaceHeaderLayout(header);
          const scope = header.parentElement || header;
          // 区头内优先，父级兜底：宿主不同布局下 searchButton 的落点会变
          const findNative = () => header.querySelector('[class*="searchButton"]:not(.dsh-ag-search-btn)')
            || scope.querySelector('[class*="searchButton"]:not(.dsh-ag-search-btn)');
          const findMine = () => header.querySelector('.dsh-ag-search-btn')
            || scope.querySelector('.dsh-ag-search-btn');
          const nativeBtn = findNative();
          let mine = findMine();
          if (nativeBtn) {
            // 原位注入（原生按钮正前方）：与原生布局零间隙、顺序天然一致
            // [🔍][⇄][📁+]（用户截图锁定的契约）
            if (!mine) mine = buildWorkspaceSearchBtn();
            try { nativeBtn.parentNode.insertBefore(mine, nativeBtn); } catch (e) {
              if (!mine.parentNode) header.appendChild(mine);
            }
            // 注入成功后再隐藏原生按钮（顺序保证：插入失败也不会只剩隐藏）
            try { nativeBtn.style.setProperty('display', 'none', 'important'); } catch (e) {}
            return;
          }
          // 无原生按钮的布局：搜索槽之前（图标组最左）→ 图标组之前 → 区头末尾
          const anchor = header.querySelector('[class*="searchSlot"]')
            || header.querySelector('[class*="_headerActions"]')
            || null;
          if (mine) {
            if (anchor && mine.parentNode === header && mine.nextElementSibling !== anchor) {
              try { header.insertBefore(mine, anchor); } catch (e) {}
            }
            return;
          }
          mine = buildWorkspaceSearchBtn();
          if (anchor) header.insertBefore(mine, anchor);
          else header.appendChild(mine);
        });
      } catch (e) { dbg('ensureWorkspaceSearch failed', e); }
    }

    // Custom standard mode icon geometry extracted 1:1 from media_1790823474988.png
    const MODE_SVG_PATHS = `
      <circle cx="85" cy="28.5" r="25.5" stroke="currentColor" stroke-width="8.5" fill="none"/>
      <circle cx="43.5" cy="120" r="25.5" stroke="currentColor" stroke-width="8.5" fill="none"/>
      <circle cx="126.5" cy="120" r="25.5" stroke="currentColor" stroke-width="8.5" fill="none"/>
      <path d="M118 39A57.5 57.5 0 0 1 142.5 86.5" stroke="currentColor" stroke-width="8.5" stroke-linecap="round"/>
      <path d="M109 138.5A57.5 57.5 0 0 1 71 142.5" stroke="currentColor" stroke-width="8.5" stroke-linecap="round"/>
      <path d="M28 91.5A57.5 57.5 0 0 1 47 43.7" stroke="currentColor" stroke-width="8.5" stroke-linecap="round"/>
    `;

    function updateModeSvgNode(svgNode) {
      if (!svgNode) return;
      if (svgNode.dataset.dshAgReplaced === 'true' && svgNode.getAttribute('viewBox') === '0 0 176 150') return;
      svgNode.dataset.dshAgReplaced = 'true';
      svgNode.setAttribute('viewBox', '0 0 176 150');
      svgNode.setAttribute('width', '15');
      svgNode.setAttribute('height', '13');
      svgNode.classList.add('dsh-ag-mode-icon');
      svgNode.style.cssText = 'flex:none;width:15px;height:13px;min-width:15px;min-height:13px;max-width:15px;max-height:13px;margin:0;display:inline-block;vertical-align:middle;color:currentColor;box-sizing:border-box;';
      svgNode.innerHTML = MODE_SVG_PATHS;
    }

    function createModeSvgNode() {
      const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      newSvg.setAttribute('viewBox', '0 0 176 150');
      newSvg.setAttribute('width', '15');
      newSvg.setAttribute('height', '13');
      newSvg.classList.add('_oGoKq_seatIcon', 'dsh-ag-mode-icon');
      newSvg.style.cssText = 'flex:none;width:15px;height:13px;min-width:15px;min-height:13px;margin:0;display:inline-block;vertical-align:middle;color:currentColor;';
      newSvg.innerHTML = MODE_SVG_PATHS;
      return newSvg;
    }

    function replaceModeIcon(row) {
      if (!row) return;
      let modeBtn = row.querySelector('._oGoKq_seat, [class*="seat"]');
      if (!modeBtn) {
        const buttons = Array.from(row.querySelectorAll('button:not(.dsh-ag-skill-chip)'));
        if (buttons.length >= 2) {
          modeBtn = buttons[1];
        }
      }
      if (!modeBtn) return;

      if (!modeBtn.dataset.dshAgHooked) {
        modeBtn.dataset.dshAgHooked = 'true';
        modeBtn.addEventListener('click', () => {
          requestAnimationFrame(() => enhancePresetMenuItems());
          setTimeout(enhancePresetMenuItems, 10);
          setTimeout(enhancePresetMenuItems, 50);
        });
      }

      const modeSvg = modeBtn.querySelector('._oGoKq_seatIcon, [class*="seatIcon"], svg:not([class*="chevron"]):not(.dsh-ag-mode-icon)');
      if (modeSvg) {
        updateModeSvgNode(modeSvg);
      } else if (!modeBtn.querySelector('.dsh-ag-mode-icon')) {
        const newSvg = createModeSvgNode();
        const label = modeBtn.querySelector('._oGoKq_seatLabel, [class*="seatLabel"], span');
        if (label) {
          modeBtn.insertBefore(newSvg, label);
        } else {
          modeBtn.prepend(newSvg);
        }
      }
    }

    // Debounced preset menu enhancement
    let enhancePresetRafId = null;
    function scheduleEnhancePreset() {
      if (enhancePresetRafId) return;
      enhancePresetRafId = requestAnimationFrame(() => {
        enhancePresetRafId = null;
        enhancePresetMenuItems();
      });
    }

    function replaceAllModeIcons(root = document) {
      const modeButtons = root.querySelectorAll('._oGoKq_seat, button[class*="seat"]');
      modeButtons.forEach(modeBtn => {
        if (!modeBtn.dataset.dshAgHooked) {
          modeBtn.dataset.dshAgHooked = 'true';
          modeBtn.addEventListener('click', () => {
            scheduleEnhancePreset();
          });
        }

        const modeSvg = modeBtn.querySelector('._oGoKq_seatIcon, [class*="seatIcon"], svg:not([class*="chevron"]):not(.dsh-ag-mode-icon)');
        if (modeSvg) {
          updateModeSvgNode(modeSvg);
        } else if (!modeBtn.querySelector('.dsh-ag-mode-icon')) {
          const newSvg = createModeSvgNode();
          const label = modeBtn.querySelector('._oGoKq_seatLabel, [class*="seatLabel"], span');
          if (label) {
            modeBtn.insertBefore(newSvg, label);
          } else {
            modeBtn.prepend(newSvg);
          }
        }
      });
    }

    function enhancePresetMenuItems() {
      const presetLabels = document.querySelectorAll('._oGoKq_item');
      presetLabels.forEach(presetSpan => {
        const btn = presetSpan.closest('button._3tUStW_item, button[role="menuitem"]');
        if (btn && !btn.querySelector('.dsh-ag-mode-menu-icon')) {
          const iconSpan = document.createElement('span');
          iconSpan.className = '_3tUStW_itemIcon dsh-ag-mode-menu-icon';
          iconSpan.setAttribute('aria-hidden', 'true');
          iconSpan.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 176 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="color:var(--dsw-alias-label-tertiary,#4B5563);flex:none;">
              <circle cx="85" cy="28.5" r="25.5" stroke="currentColor" stroke-width="9" fill="none"/>
              <circle cx="43.5" cy="120" r="25.5" stroke="currentColor" stroke-width="9" fill="none"/>
              <circle cx="126.5" cy="120" r="25.5" stroke="currentColor" stroke-width="9" fill="none"/>
              <path d="M118 39A57.5 57.5 0 0 1 142.5 86.5" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
              <path d="M109 138.5A57.5 57.5 0 0 1 71 142.5" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
              <path d="M28 91.5A57.5 57.5 0 0 1 47 43.7" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
            </svg>
          `;
          btn.insertBefore(iconSpan, btn.firstChild);
        }
      });
    }

    /* ======================================================================
       14. Fixed Icon Rail（最左固定图标栏）
       槽位：首页 / 自动化任务 / 插件 / 技能 / 更多 + 底部头像。
       行为全部优先走宿主原生服务（uiWorkspace / layout / 快捷键），
       原生 API 不可用时逐级回退到 DOM 点击与合成快捷键。
       ====================================================================== */
    const RAIL_ID = 'dsh-ui-rail';

    /* R1/R2/R3 双态图标（用户 supplied SVG：左=未点击 #C5C5C5，右=点击选中 实心黑） */
    const RAIL_ICON_HOME_NORMAL = `
      <svg width="22" height="22" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M165.9,186.8h-48.7v-51.1c0-4.8-5.9-13.6-17.2-13.6c-11.3,0-17.2,8.9-17.2,13.6v51.1H34.2c-11,0-20-9-20-20V89.7c-4.2,1.7-9,0.5-12-3.2c-1.7-2.2-2.5-4.9-2.2-7.7c0.3-2.8,1.7-5.3,4-7L85,8.7c8.4-6.6,21.6-6.5,30,0l81,63.1c2.2,1.7,3.6,4.2,3.9,7c0.3,2.8-0.5,5.5-2.2,7.7c-2,2.5-5,3.9-8.3,3.9c-1.2,0-2.4-0.2-3.5-0.6v77.1C185.9,177.9,177,186.8,165.9,186.8z M125.5,178.6h40.4c6.5,0,11.7-5.3,11.7-11.7v-80c0-2.4,1.3-4.6,3.4-5.7c2.1-1.1,4.6-1,6.6,0.3l0.3,0.2c0.9,0.7,2.6,0.6,3.3-0.3c0.4-0.5,0.5-1,0.5-1.6c-0.1-0.6-0.4-1.1-0.8-1.4l-81-63.1c-5.5-4.3-14.3-4.3-19.8,0l-81,63.1c-0.5,0.4-0.8,0.9-0.8,1.4c-0.1,0.6,0.1,1.1,0.5,1.6c0.8,1,2.2,1.1,3.1,0.4l0.4-0.3l0.5-0.3c2-1.2,4.5-1.2,6.5-0.1c2,1.1,3.3,3.3,3.3,5.6v80.2c0,6.5,5.3,11.7,11.7,11.7h40.4v-42.8c0-9.1,9.7-21.9,25.4-21.9c15.8,0,25.4,12.7,25.4,21.9V178.6z"/>
      </svg>
    `;
    const RAIL_ICON_HOME_ACTIVE = `
      <svg width="22" height="22" viewBox="203.4 0 203.4 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M217.5,84.5l0.5-0.3c1.6-1,3.7,0.2,3.7,2.1l0.5,83.7c0,9.1,7.4,16.5,16.5,16.5h46.5l-0.5-48.9c0-7.6,8.5-18.5,22.2-18.5c13.7,0,22.2,10.9,22.2,18.5l0.5,48.9h46.5c9.1,0,16.5-7.4,16.5-16.5l-0.5-83.4c0-2,2.2-3.1,3.8-2.1l0,0c1.2,1,2.7,1.4,4.2,1.4c2,0,3.9-0.9,5.3-2.5c2.3-2.8,1.8-7-1.1-9.2L319.8,8.4c-7.3-5.7-18.7-5.7-26,0l-84.5,65.8c-2.9,2.2-3.4,6.4-1.1,9.2C210.5,86.2,214.6,86.7,217.5,84.5z"/>
      </svg>
    `;
    const RAIL_ICON_SCHEDULE_NORMAL = `
      <svg width="22" height="22" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M100,4.1c-52.9,0-95.9,43-95.9,95.9c0,52.9,43,95.9,95.9,95.9c52.9,0,95.9-43,95.9-95.9C195.9,47.1,152.9,4.1,100,4.1z M100,185.8c-47.3,0-85.8-38.5-85.8-85.8S52.7,14.2,100,14.2s85.8,38.5,85.8,85.8S147.3,185.8,100,185.8z"/>
        <path d="M93.1,46.1c-2.8,0-5,2.3-5,5.1V107c0,2.8,2.3,5,5,5H135c2.8,0,5.1-2.3,5.1-5c0-2.8-2.3-5.1-5.1-5.1H98.1V51.1C98.1,48.3,95.8,46.1,93.1,46.1z"/>
      </svg>
    `;
    const RAIL_ICON_SCHEDULE_ACTIVE = `
      <svg width="22" height="22" viewBox="203.4 0 203.4 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M306.8,4.1c-52.9,0-95.9,43-95.9,95.9c0,52.9,43,95.9,95.9,95.9c52.9,0,95.9-43,95.9-95.9C402.7,47.1,359.7,4.1,306.8,4.1z M341.8,112.1h-41.9c-2.8,0-5-2.3-5-5V51.1c0-2.8,2.3-5.1,5-5.1c2.8,0,5,2.3,5,5.1V102h36.9c2.8,0,5,2.3,5.1,5.1C346.9,109.8,344.6,112.1,341.8,112.1z"/>
      </svg>
    `;
    const RAIL_ICON_PLUGIN_NORMAL = `
      <svg width="22" height="22" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M166.3,64.2a116.58,116.58,0,0,0-22.5-8,122.58,122.58,0,0,0-8-22.4C126.6,14.6,113.9,4.1,100,4.1S73.4,14.6,64.2,33.7a118,118,0,0,0-8,22.4,122.58,122.58,0,0,0-22.4,8C14.6,73.4,4.1,86.1,4.1,100s10.5,26.6,29.6,35.8a118,118,0,0,0,22.4,8,122.58,122.58,0,0,0,8,22.4c9.2,19.1,21.9,29.6,35.8,29.6s26.6-10.5,35.8-29.6a118,118,0,0,0,8-22.4,122.58,122.58,0,0,0,22.4-8c19.1-9.2,29.6-21.9,29.6-35.8C195.9,86.1,185.4,73.4,166.3,64.2Zm-4.9,61.5a114.27,114.27,0,0,1-15,5.8,188.28,188.28,0,0,0,2.6-31.4h0a5.6,5.6,0,0,0-11.2,0h0a172.5,172.5,0,0,1-3.4,34.5q-1.35,6.15-3,12a101.75,101.75,0,0,1-5.8,15c-7.1,14.8-16.5,23.3-25.7,23.3s-18.6-8.5-25.7-23.3a114.27,114.27,0,0,1-5.8-15,188.28,188.28,0,0,0,31.4,2.6h0a5.51,5.51,0,0,0,5.5-5.6h0a5.57,5.57,0,0,0-5.5-5.6v-.1a172.5,172.5,0,0,1-34.5-3.4q-6.15-1.35-12-3a101.75,101.75,0,0,1-15-5.8C23.5,118.6,15,109.2,15,100s8.5-18.6,23.3-25.7a114.27,114.27,0,0,1,15-5.8A228.81,228.81,0,0,0,51,100h0a5.57,5.57,0,0,0,5.6,5.5h0a5.64,5.64,0,0,0,5.6-5.5h.1a172.5,172.5,0,0,1,3.4-34.5q1.35-6.15,3-12a101.75,101.75,0,0,1,5.8-15C81.6,23.7,91,15.2,100.2,15.2s18.6,8.5,25.7,23.3a114.27,114.27,0,0,1,5.8,15,188.28,188.28,0,0,0-31.4-2.6h0a5.57,5.57,0,0,0-5.5,5.6h0a5.7,5.7,0,0,0,5.5,5.6v.1h0a172.5,172.5,0,0,1,34.5,3.4q6.15,1.35,12,3a101.75,101.75,0,0,1,15,5.8c14.8,7.1,23.3,16.5,23.3,25.7S176.2,118.6,161.4,125.7Z"/>
      </svg>
    `;
    const RAIL_ICON_PLUGIN_ACTIVE = `
      <svg width="22" height="22" viewBox="203.4 0 203.4 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M396.74,82.66c-8.07-11.92-24.49-21.77-45.59-27.59C342.77,24.71,326.06,4,306.8,4s-36,20.71-44.35,51.07c-23.69,6.54-41.5,18.15-48.19,32.09v0l0,.06a28.13,28.13,0,0,0-3,12.51c0,12.77,8.9,24.53,25.19,33.48a112.78,112.78,0,0,0,26,10.53c3.32,12,8,22.56,13.55,30.88,8.56,13.41,19.26,20.67,30.8,20.67s22.23-7.25,30.78-20.64c5.6-8.32,10.25-18.85,13.57-30.91a112.87,112.87,0,0,0,26-10.54c16.29-8.95,25.18-20.7,25.18-33.47A29.3,29.3,0,0,0,396.74,82.66Zm-31.41,48.65a107.78,107.78,0,0,1-19.81,7.07,103.46,103.46,0,0,1-7.07,19.81c-8.13,16.89-19.36,26.17-31.65,26.17s-23.52-9.28-31.65-26.17a107.78,107.78,0,0,1-7.07-19.81,103.46,103.46,0,0,1-19.81-7.07C231.38,123.18,222.1,112,222.1,99.66S231.38,76.14,248.27,68a108.53,108.53,0,0,1,19.81-7.08,103.6,103.6,0,0,1,7.07-19.8C283.28,24.24,294.51,15,306.8,15s23.52,9.28,31.65,26.17a107.68,107.68,0,0,1,7.07,19.8A103.36,103.36,0,0,1,365.42,68c16.88,8.13,26.17,19.36,26.08,31.65S382.22,123.18,365.33,131.31Z"/>
        <path d="M361.09,76.94a88.9,88.9,0,0,0-13.27-5.13q-5.16-1.45-10.61-2.65a152.11,152.11,0,0,0-30.5-3v-.09a5,5,0,0,1-4.86-5,4.92,4.92,0,0,1,4.86-5,166.74,166.74,0,0,1,27.76,2.3,100.6,100.6,0,0,0-5.12-13.26c-6.28-13.09-14.59-20.6-22.73-20.6s-16.44,7.51-22.72,20.6a90.56,90.56,0,0,0-5.13,13.26q-1.45,5.17-2.65,10.61a152.84,152.84,0,0,0-3,30.5H273a5,5,0,0,1-4.95,4.86,4.93,4.93,0,0,1-5-4.86,166.74,166.74,0,0,1,2.3-27.76,100.29,100.29,0,0,0-13.26,5.13c-13.08,6.27-20.6,14.59-20.6,22.72s7.52,16.44,20.6,22.72a90.31,90.31,0,0,0,13.26,5.13Q270.6,129,276,130.16a152.18,152.18,0,0,0,30.5,3v.09a4.93,4.93,0,0,1,4.87,5,4.87,4.87,0,0,1-4.87,4.95,166.83,166.83,0,0,1-27.76-2.3,103.14,103.14,0,0,0,5.13,13.26c6.28,13.09,14.59,20.6,22.72,20.6s16.45-7.51,22.73-20.6a90.3,90.3,0,0,0,5.12-13.26q1.47-5.18,2.66-10.61a152.86,152.86,0,0,0,3-30.5,5,5,0,0,1,9.9,0h.09a165.68,165.68,0,0,1-2.3,27.76,99.9,99.9,0,0,0,13.27-5.13c13.08-6.28,20.6-14.59,20.6-22.72S374.17,83.21,361.09,76.94Z"/>
      </svg>
    `;

    const RAIL_ICON_USAGE_NORMAL = `
      <svg width="22" height="22" viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="35.82" y="98.47" width="24.4" height="56.88"/>
        <rect x="82.15" y="61.53" width="24.4" height="93.82"/>
        <rect x="128.49" y="35.86" width="24.4" height="119.49"/>
      </svg>
    `;
    const RAIL_ICON_USAGE_ACTIVE = `
      <svg width="22" height="22" viewBox="170.7 -4.4 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M292.64,22.87V48.54H246.57V85.61l-47.37-.26v83h143V22.87ZM236.56,155.32h-24.4V98.44h24.4Zm46.33,0h-24.4V61.5h24.4Zm46.34,0h-24.4V35.83h24.4Z"/>
      </svg>
    `;

    /* 双态图标映射：选中时切换为实心变体 */
    const RAIL_TWO_STATE_ICONS = {
      home: { normal: RAIL_ICON_HOME_NORMAL, active: RAIL_ICON_HOME_ACTIVE },
      schedules: { normal: RAIL_ICON_SCHEDULE_NORMAL, active: RAIL_ICON_SCHEDULE_ACTIVE },
      plugins: { normal: RAIL_ICON_PLUGIN_NORMAL, active: RAIL_ICON_PLUGIN_ACTIVE },
      usage: { normal: RAIL_ICON_USAGE_NORMAL, active: RAIL_ICON_USAGE_ACTIVE }
    };

    const RAIL_MORE_SVG_HTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>
      </svg>
    `;

    const RAIL_SETTINGS_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    `;

    const RAIL_DIAL_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="8.7"/>
        <path d="M12 12l3.6-3.6"/>
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
      </svg>
    `;

    const RAIL_KEYBOARD_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2.8" y="6" width="18.4" height="12" rx="2.5"/>
        <path d="M6.4 9.8h.01M9.9 9.8h.01M13.4 9.8h.01M16.9 9.8h.01M6.4 12.9h.01M9.9 12.9h.01M13.4 12.9h.01M16.9 12.9h.01M7.2 15.6h9.6"/>
      </svg>
    `;

    const RAIL_RELOAD_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polyline points="21.5 3.8 21.5 9.4 15.9 9.4"/>
        <path d="M20.3 14.6a8.7 8.7 0 1 1-2-8.9l3.2 3.7"/>
      </svg>
    `;

    const RAIL_USER_SVG_HTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="12" cy="10" r="3" fill="currentColor"/>
        <path d="M6.4 18.3c1.1-2.5 3.1-3.9 5.6-3.9s4.5 1.4 5.6 3.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    `;

    const RAIL_HELP_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2"/>
        <path d="M9.2 9.1a2.9 2.9 0 0 1 5.6.9c0 1.9-2.8 2.4-2.8 4"/>
        <circle cx="12" cy="17.3" r="0.7" fill="currentColor" stroke="none"/>
      </svg>
    `;

    const RAIL_CHEVRON_SVG_HTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polyline points="9 6 15 12 9 18"/>
      </svg>
    `;

    function railResizeSvg(svgHtml, w, h) {
      return svgHtml.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
    }

    let railNode = null;
    let railMenuNode = null;
    let railMenuAnchor = null;
    let railMenuCleanup = null;
    let railSubMenuNode = null;
    let railUsageNode = null;
    let railPanelUnsubscribe = null;
    let railAttrObserver = null;

    function getRailLayoutFace() {
      try {
        if (!dshCtx) return null;
        if (dshCtx.layout) return dshCtx.layout;
        if (typeof dshCtx.get === 'function') return dshCtx.get('layout') || null;
      } catch (e) {}
      return null;
    }

    function getRailWorkspaceFace() {
      try {
        if (!dshCtx) return null;
        if (dshCtx.uiWorkspace) return dshCtx.uiWorkspace;
        if (typeof dshCtx.get === 'function') return dshCtx.get('uiWorkspace') || null;
      } catch (e) {}
      return null;
    }

    function railDispatchKey(code, key, opts = {}) {
      const base = {
        bubbles: true,
        cancelable: true,
        code,
        key,
        ctrlKey: !!opts.ctrl,
        metaKey: !!opts.meta,
        altKey: !!opts.alt,
        shiftKey: !!opts.shift
      };
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', base));
        document.dispatchEvent(new KeyboardEvent('keydown', base));
      } catch (e) {}
      setTimeout(() => {
        try {
          window.dispatchEvent(new KeyboardEvent('keyup', base));
          document.dispatchEvent(new KeyboardEvent('keyup', base));
        } catch (e) {}
      }, 40);
    }

    function railGoHome() {
      const ws = getRailWorkspaceFace();
      if (ws && typeof ws.startSession === 'function') {
        try {
          // 与原生行为一致：只调 startSession（内部自会导航到新会话/回会话视图）。
          // 切勿在其后追加 layout.selectPanel(null) —— 那会 abort 掉 startSession
          // 进行中的导航，导致停留在旧会话而不是新建会话界面。
          ws.startSession();
        } catch (e) {}
      } else {
        const newBtn = document.querySelector('[class*="_newSession"]');
        if (newBtn) newBtn.click();
        else railDispatchKey('KeyN', 'n', { ctrl: true });
      }
    }

    function railSelectPanel(panelId, rowKeywords) {
      const layout = getRailLayoutFace();
      if (layout && typeof layout.selectPanel === 'function') {
        try {
          layout.selectPanel(panelId);
          return;
        } catch (e) {}
      }
      const rows = Array.from(document.querySelectorAll('[class*="_panelRow"]'));
      let target = rows.find(r => rowKeywords.some(k => (r.getAttribute('aria-label') || r.textContent || '').includes(k)));
      if (!target && rows.length > 1) {
        target = panelId === 'plugins' ? rows[0] : rows[rows.length - 1];
      }
      if (target) {
        target.click();
        // 兜底即时同步一次激活态（正常由 aria-current 观察器驱动）
        setTimeout(() => syncRailActive(), 60);
      }
    }

    function railOpenSettings() {
      railDispatchKey('Comma', ',', { ctrl: true });
    }

    function railOpenShortcuts() {
      railDispatchKey('Slash', '/', { ctrl: true });
    }

    /* 用量统计独立页面（中央主面板，与插件/定时任务面板同机制） */
    function RailUsagePanelPage() {
      return React.createElement('iframe', {
        src: '/token-usage-stats',
        title: '用量统计',
        className: 'dsh-usage-page-frame',
        'aria-label': '用量统计'
      });
    }

    function railOpenUsage() {
      // 首选：作为独立页面在中央打开（与插件/定时任务面板一致）
      const layout = getRailLayoutFace();
      if (layout && typeof layout.selectPanel === 'function') {
        try {
          layout.selectPanel('usage');
          return;
        } catch (e) {}
      }
      // 回退1：原生用量按钮（弹原生 Modal）
      const nativeBtn = document.querySelector('[aria-label="打开用量统计面板"], [class*="UcfOsa_root"]');
      if (nativeBtn) {
        nativeBtn.click();
        return;
      }
      // 回退2：iframe 兜底弹窗
      if (railUsageNode) {
        railUsageNode.remove();
        railUsageNode = null;
        return;
      }
      const overlay = document.createElement('div');
      overlay.className = 'dsh-ui-usage-overlay';
      overlay.innerHTML = `
        <div class="dsh-ui-usage-card" role="dialog" aria-label="用量统计">
          <div class="dsh-ui-usage-head">
            <span>用量统计</span>
            <button type="button" class="dsh-ui-usage-close" aria-label="关闭">×</button>
          </div>
          <iframe class="dsh-ui-usage-frame" src="/token-usage-stats" title="用量统计"></iframe>
        </div>
      `;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('.dsh-ui-usage-close')) {
          overlay.remove();
          railUsageNode = null;
        }
      });
      document.body.appendChild(overlay);
      railUsageNode = overlay;
    }

    function closeRailSubMenu() {
      if (railSubMenuNode && railSubMenuNode.parentNode) {
        railSubMenuNode.parentNode.removeChild(railSubMenuNode);
      }
      railSubMenuNode = null;
    }

    function closeRailMenu() {
      if (railMenuCleanup) {
        railMenuCleanup();
        railMenuCleanup = null;
      }
      if (railMenuNode && railMenuNode.parentNode) {
        railMenuNode.parentNode.removeChild(railMenuNode);
      }
      railMenuNode = null;
      railMenuAnchor = null;
      closeRailSubMenu();
    }

    function railMenuRowsHtml(items) {
      return items.map((item, index) => `
        <button type="button" role="menuitem" class="dsh-rail-menu-item" data-rail-menu-index="${index}">
          ${item.icon}
          <span>${item.label}</span>
          ${item.hint ? `<span class="dsh-rail-menu-hint">${item.hint}</span>` : ''}
          ${(item.children || item.chevron) ? `<span class="dsh-rail-menu-hint dsh-rail-menu-chevron">${RAIL_CHEVRON_SVG_HTML}</span>` : ''}
        </button>
      `).join('');
    }

    function bindRailMenuItems(menuEl, items, parentMenu) {
      menuEl.querySelectorAll('.dsh-rail-menu-item').forEach(btn => {
        const item = items[Number(btn.dataset.railMenuIndex)];
        if (!item) return;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.children) {
            openRailSubmenu(btn, item.children, parentMenu);
            return;
          }
          closeRailMenu();
          if (typeof item.onClick === 'function') item.onClick();
        });
        if (item.children) {
          btn.addEventListener('mouseenter', () => {
            openRailSubmenu(btn, item.children, parentMenu);
          });
        }
      });
    }

    function openRailSubmenu(anchorItemEl, children, parentMenu) {
      closeRailSubMenu();
      if (!parentMenu || !parentMenu.isConnected) return;
      const sub = document.createElement('div');
      sub.className = 'dsh-rail-menu dsh-rail-submenu';
      sub.setAttribute('role', 'menu');
      sub.innerHTML = railMenuRowsHtml(children);
      bindRailMenuItems(sub, children, parentMenu);
      document.body.appendChild(sub);
      railSubMenuNode = sub;

      const rect = anchorItemEl.getBoundingClientRect();
      const width = sub.offsetWidth || 200;
      const height = sub.offsetHeight || 100;
      let left = rect.right + 8;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, rect.left - width - 8);
      }
      let top = rect.top - 6;
      if (top + height > window.innerHeight - 12) top = window.innerHeight - height - 12;
      if (top < 12) top = 12;
      sub.style.left = `${Math.round(left)}px`;
      sub.style.top = `${Math.round(top)}px`;
    }

    function openRailMenu(anchorEl, { place, head, sub, items }) {
      const wasSameAnchor = railMenuAnchor === anchorEl;
      closeRailMenu();
      closePopover();
      closeExecPopover();
      if (wasSameAnchor) return null;

      const menu = document.createElement('div');
      menu.className = 'dsh-rail-menu';
      menu.setAttribute('role', 'menu');

      let html = '';
      if (head) {
        html += `
          <div class="dsh-rail-menu-head">
            <span class="dsh-rail-menu-avatar">${railAvatarHtml()}</span>
            <span class="dsh-rail-menu-id">
              <span class="dsh-rail-menu-name">DeepSeek Harness</span>
              <span class="dsh-rail-menu-sub">${sub || '本地工作台'}</span>
            </span>
          </div>
          <div class="dsh-rail-menu-sep"></div>
        `;
      }
      html += railMenuRowsHtml(items);
      menu.innerHTML = html;

      bindRailMenuItems(menu, items, menu);

      document.body.appendChild(menu);
      railMenuNode = menu;
      railMenuAnchor = anchorEl;

      const rect = anchorEl.getBoundingClientRect();
      const width = menu.offsetWidth || 264;
      const height = menu.offsetHeight || 200;
      let left = rect.right + 12;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, rect.left - width - 12);
      }
      let top;
      if (place === 'bottom') {
        top = window.innerHeight - height - 14;
        if (top < 12) top = 12;
        if (rect.bottom < top + height * 0.5) top = Math.max(12, rect.bottom - height + 10);
      } else {
        top = Math.min(rect.top - 4, window.innerHeight - height - 12);
        if (top < 12) top = 12;
      }
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;

      railMenuCleanup = attachPopoverDismiss({
        node: menu,
        anchorEl,
        onClose: closeRailMenu,
        isInsideExtra: (t) => !!(railSubMenuNode && railSubMenuNode.contains(t)),
      });

      return menu;
    }

    function railAvatarHtml() {
      // 镜像原生账号头像：<img> 优先，回退 background-image 内联样式。
      // 内联 border-radius !important 为最高优先级，杜绝任何原生规则把头像改回方圆角。
      const img = document.querySelector('[class*="_settingsArea"] img, [class*="_footArea"] img');
      const src = img ? img.getAttribute('src') : null;
      if (src) {
        return `<img class="dsh-rail-avatar-img" style="border-radius:50% !important;clip-path:circle(50% at 50% 50%) !important" src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer"/>`;
      }
      const styled = document.querySelector(
        '[class*="_settingsArea"] [style*="background-image"], [class*="_footArea"] [style*="background-image"]'
      );
      if (styled) {
        const m = /background-image:\s*url\(["']?([^"')]+)["']?\)/.exec(styled.getAttribute('style') || '');
        if (m) {
          return `<img class="dsh-rail-avatar-img" style="border-radius:50% !important;clip-path:circle(50% at 50% 50%) !important" src="${escapeHtml(m[1])}" alt="" referrerpolicy="no-referrer"/>`;
        }
      }
      return `<span class="dsh-rail-avatar-fallback">${RAIL_USER_SVG_HTML}</span>`;
    }

    // ------------------------------------------------------------------
    // 头像诊断：把按钮/图片的真实 DOM、计算样式、"按钮中心点上实际命中的
    // 元素"通过 bridge 落盘（.dsh-ui-debug.json）。启动后 90 秒内每 5 秒
    // 采集一次，之后停止——只为离线排查形状异常，不影响运行。
    // ------------------------------------------------------------------
    const AVATAR_DUMP_WINDOW_MS = 90000;
    const AVATAR_DUMP_INTERVAL_MS = 5000;
    let avatarDumpDeadline = 0;
    let avatarDumpLast = 0;

    function dumpAvatarDiagnostics() {
      try {
        const rail = document.getElementById(RAIL_ID);
        const btn = rail ? rail.querySelector('.dsh-rail-avatar-btn') : null;
        const img = btn ? btn.querySelector('img.dsh-rail-avatar-img') : null;
        const pick = (el) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            cls: String(el.className).slice(0, 160),
            rect: { w: Math.round(r.width), h: Math.round(r.height) },
            width: cs.width, height: cs.height,
            borderRadius: cs.borderRadius,
            clipPath: cs.clipPath,
            overflow: cs.overflow,
            transform: cs.transform,
            objectFit: cs.objectFit,
            aspectRatio: cs.aspectRatio,
            backgroundImage: cs.backgroundImage.slice(0, 140),
            inlineStyle: (el.getAttribute('style') || '').slice(0, 200),
          };
        };
        let topElement = null;
        if (btn) {
          const r = btn.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          topElement = hit ? {
            tag: hit.tagName,
            cls: String(hit.className).slice(0, 160),
            isBtnChild: btn.contains(hit),
          } : null;
        }
        const payload = {
          at: new Date().toISOString(),
          bootCount: (typeof window !== 'undefined' && window.__dshUiBootCount) || 0,
          railCount: document.querySelectorAll('#dsh-ui-rail').length,
          avatarBtnCount: document.querySelectorAll('.dsh-rail-avatar-btn').length,
          avatarImgCount: document.querySelectorAll('img.dsh-rail-avatar-img').length,
          styleTagCount: document.querySelectorAll(`style[id="${STYLE_TAG_ID}"]`).length,
          btn: pick(btn),
          img: pick(img),
          imgState: img ? {
            complete: img.complete,
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
            src: String(img.currentSrc || img.getAttribute('src') || '').slice(0, 200),
          } : null,
          topElement,
          // v1.1.37：工作区搜索入口快照（排查注入是否落位）
          // v1.1.40：补区头几何（标签 / 搜索槽 / 图标组 / 注入件的左右偏移），
          // v1.1.41：用于离线核实「三个图标是否真的位于区头右端」（即 searchSlot
          // 的 margin-left:auto 是否仍生效）；v1.1.40 曾据此误判为应靠左。
          workspaceSearch: (() => {
            try {
              const hs = document.querySelectorAll('[class*="_sectionHeader"]');
              const box = (el) => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {
                  cls: String(el.className).slice(0, 80),
                  left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
                };
              };
              const h0 = hs[0];
              return {
                headerCount: hs.length,
                nativeBtnCount: document.querySelectorAll('[class*="searchButton"]:not(.dsh-ag-search-btn)').length,
                injectedCount: document.querySelectorAll('.dsh-ag-search-btn').length,
                firstHeaderHtml: h0 ? String(h0.outerHTML).slice(0, 500) : null,
                geometry: h0 ? (() => {
                  const slot = h0.querySelector('[class*="searchSlot"]');
                  const prop = (el, k) => { try { return el ? getComputedStyle(el)[k] : null; } catch (e) { return null; } };
                  return {
                    header: box(h0),
                    label: box(h0.querySelector('[class*="sectionLabel"]')),
                    searchSlot: box(slot),
                    injected: box(h0.querySelector('.dsh-ag-search-btn')),
                    actions: box(h0.querySelector('[class*="headerActions"]')),
                    justify: prop(h0, 'justifyContent'),
                    // v1.1.41：margin-left 是把图标组顶到右端的关键机制量——
                    // auto = 已右顶（红框位置）；0px = 被拽到标签旁（蓝框位置）。
                    slotMarginLeft: prop(slot, 'marginLeft'),
                    slotFlex: prop(slot, 'flex'),
                  };
                })() : null,
              };
            } catch (e) { return null; }
          })(),
        };
        fetch(`${BRIDGE_API}/api/debug`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (e) {
        dbg('dumpAvatarDiagnostics failed', e);
      }
    }

    function maybeDumpAvatarDiagnostics() {
      const now = Date.now();
      if (now > avatarDumpDeadline) return;
      if (now - avatarDumpLast < AVATAR_DUMP_INTERVAL_MS) return;
      avatarDumpLast = now;
      dumpAvatarDiagnostics();
    }

    function railFetchUsageSummary() {
      try {
        return fetch(`${BRIDGE_API}/api/usage`, { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null);
      } catch (e) {
        return Promise.resolve(null);
      }
    }

    /* 原生账号菜单弹出后重定位：原生 Menu 对高弹窗会顶到界面左上，
       监听新出现的菜单浮层并校正到固定栏右侧、贴窗口底（视频位置） */
    function railRepositionAccountMenuSurface(surface) {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      surface.style.left = ACCOUNT_MENU_ANCHOR_LEFT_PX + 'px';
      surface.style.top = Math.max(12, window.innerHeight - ACCOUNT_MENU_ANCHOR_BOTTOM_PX - rect.height) + 'px';
      surface.style.right = 'auto';
      surface.style.bottom = 'auto';
      return true;
    }

    function railArmAccountMenuReposition() {
      if (typeof MutationObserver === 'undefined') return;
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!n || n.nodeType !== 1) continue;
            if (n.id && String(n.id).indexOf('dsh') === 0) continue;
            const candidates = [n].concat(Array.prototype.slice.call(n.querySelectorAll('*')));
            for (const el of candidates) {
              let cs;
              try { cs = getComputedStyle(el); } catch (e) { continue; }
              if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
              const r = el.getBoundingClientRect();
              if (r.width < 80 || r.width > 640 || r.height < 40) continue;
              // 指纹门槛：只有"长得像菜单"的浮层才可被重定位。
              // 武装窗口期内出现的无关弹层（toast、对话框、其他插件气泡）
              // 绝不能被拽到左下角。
              const role = (el.getAttribute && el.getAttribute('role')) || '';
              if (role === 'status' || role === 'alert' || role === 'tooltip') continue;
              if (el.classList && Array.prototype.some.call(el.classList, c => String(c).startsWith('dsh-'))) continue;
              const menuLike = role === 'menu' || role === 'listbox' || role === 'dialog'
                || /menu|popover|dropdown|surface|floating|account/i.test(String(el.className || ''))
                || !!(el.querySelector && el.querySelector('[role="menuitem"], [role="menu"], [role="listbox"], [class*="menu"], [class*="Menu"]'));
              if (!menuLike) continue;
              if (el.querySelector && el.querySelector('.dsh-rail-menu')) continue;
              if (railRepositionAccountMenuSurface(el)) {
                // 短暂盯防：原生定位若在滚动/重排时回跳，立即校正回来
                const reapply = setInterval(() => {
                  if (!el.isConnected) { clearInterval(reapply); return; }
                  const rr = el.getBoundingClientRect();
                  if (Math.abs(rr.left - ACCOUNT_MENU_ANCHOR_LEFT_PX) > 2 || Math.abs((window.innerHeight - ACCOUNT_MENU_ANCHOR_BOTTOM_PX - rr.height) - rr.top) > 2) {
                    railRepositionAccountMenuSurface(el);
                  }
                }, ACCOUNT_MENU_WATCH_INTERVAL_MS);
                setTimeout(() => clearInterval(reapply), ACCOUNT_MENU_WATCH_WINDOW_MS);
                mo.disconnect();
                return;
              }
            }
          }
        }
      });
      mo.observe(document.body, { childList: true });
      setTimeout(() => mo.disconnect(), ACCOUNT_MENU_ARM_WINDOW_MS);
    }

    function railOpenNativeAccountMenu() {
      // 优先触发原生 S5 账号按钮（原生菜单：设置/联系我们/退出登录，头像由原生渲染）
      const trigger = document.querySelector('[class*="_settingsArea"] button[aria-haspopup="menu"]')
        || document.querySelector('[class*="_footArea"] button[aria-haspopup="menu"]');
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          try {
            trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          } catch (e) {}
          try {
            trigger.click();
          } catch (e) {}
          // 原生菜单可能弹到左上（高弹窗定位特性），弹出后校正到视频位置
          railArmAccountMenuReposition();
          return true;
        }
      }
      return false;
    }

    function railHandleAction(btn) {
      const action = btn.dataset.railAction;
      if (action === 'home') {
        closeRailMenu();
        closePopover();
        railGoHome();
        return;
      }
      if (action === 'schedules') {
        closeRailMenu();
        closePopover();
        railSelectPanel('schedules', ['任务', 'schedule', '定时']);
        return;
      }
      if (action === 'plugins') {
        closeRailMenu();
        closePopover();
        railSelectPanel('plugins', ['插件']);
        return;
      }
      if (action === 'usage') {
        closeRailMenu();
        closePopover();
        closeExecPopover();
        railOpenUsage();
        return;
      }
      if (action === 'more') {
        openRailMenu(btn, {
          place: 'beside',
          items: [
            { icon: RAIL_SETTINGS_SVG_HTML, label: '设置', hint: 'Ctrl+,', onClick: railOpenSettings },
            { icon: RAIL_DIAL_SVG_HTML, label: '用量统计', onClick: railOpenUsage },
            { icon: RAIL_KEYBOARD_SVG_HTML, label: '快捷键速查', hint: 'Ctrl+/', onClick: railOpenShortcuts },
            { icon: RAIL_RELOAD_SVG_HTML, label: '重新加载界面', onClick: () => location.reload() }
          ]
        });
        return;
      }
      if (action === 'account') {
        closeRailMenu();
        closePopover();
        closeExecPopover();
        // 首选：触发原生 S5 账号按钮（原生菜单弹出在侧栏底部上方）
        if (railOpenNativeAccountMenu()) return;
        // 回退：原生按钮不可见（如侧栏收起）时用自制账号菜单
        const versionEl = document.querySelector('[class*="_buildVersion"]');
        const version = versionEl ? (versionEl.textContent || '').trim() : '';
        const menu = openRailMenu(btn, {
          place: 'bottom',
          head: true,
          sub: version || '本地工作台',
          items: [
            { icon: RAIL_DIAL_SVG_HTML, label: '剩余用量', hint: '', chevron: true, onClick: railOpenUsage },
            { icon: RAIL_SETTINGS_SVG_HTML, label: '设置', hint: 'Ctrl+,', onClick: railOpenSettings },
            {
              icon: RAIL_HELP_SVG_HTML,
              label: '帮助',
              children: [
                { icon: RAIL_KEYBOARD_SVG_HTML, label: '快捷键速查', hint: 'Ctrl+/', onClick: railOpenShortcuts },
                { icon: RAIL_DIAL_SVG_HTML, label: '用量统计', onClick: railOpenUsage }
              ]
            }
          ]
        });
        if (menu) {
          // 异步填充真实用量：头部副标题与剩余用量行右侧显示余额
          railFetchUsageSummary().then(usage => {
            if (!usage || !usage.available || !menu.isConnected) return;
            const money = (v) => `¥${Number(v).toFixed(2)}`;
            if (typeof usage.balance === 'number') {
              const subEl = menu.querySelector('.dsh-rail-menu-sub');
              if (subEl) subEl.textContent = `余额 ${money(usage.balance)}`;
              const rowItem = menu.querySelector('.dsh-rail-menu-item[data-rail-menu-index="0"]');
              if (rowItem) {
                let hint = rowItem.querySelector('.dsh-rail-menu-hint:not(.dsh-rail-menu-chevron)');
                if (!hint) {
                  hint = document.createElement('span');
                  hint.className = 'dsh-rail-menu-hint';
                  rowItem.insertBefore(hint, rowItem.querySelector('.dsh-rail-menu-chevron'));
                }
                hint.textContent = money(usage.balance);
              }
            }
          });
        }
      }
    }

    function syncRailActive() {
      if (!railNode) return;
      let activePanel = null;
      let layoutResolved = false;
      const layout = getRailLayoutFace();
      try {
        const snap = layout && layout.panelInfo && typeof layout.panelInfo.getSnapshot === 'function'
          ? layout.panelInfo.getSnapshot()
          : null;
        if (layout && snap) {
          layoutResolved = true;
          activePanel = snap.activePanelId;
        }
      } catch (e) {}
      if (!layoutResolved) {
        // DOM 兜底：原生侧栏面板行以 aria-current="page" 标记当前激活面板
        try {
          const currentRow = document.querySelector('[class*="_panelRow"][aria-current="page"]');
          if (currentRow) {
            const label = (currentRow.getAttribute('aria-label') || '') + ' ' + (currentRow.textContent || '');
            if (/任务|schedule/i.test(label)) activePanel = 'schedules';
            else if (/插件|plugin/i.test(label)) activePanel = 'plugins';
            else {
              const allRows = Array.from(document.querySelectorAll('[class*="_panelRow"]'));
              const idx = allRows.indexOf(currentRow);
              activePanel = idx === 0 ? 'plugins' : idx === 1 ? 'schedules' : null;
            }
          }
        } catch (e) {}
      }
      railNode.querySelectorAll('[data-rail-action]').forEach(btn => {
        const id = btn.dataset.railAction;
        // 用量统计：仪表盘弹窗（原生 iframe 或兜底弹层）打开期间视为选中
        let usageOpen = false;
        try {
          usageOpen = !!document.querySelector('.dsh-ui-usage-overlay, iframe[src*="token-usage-stats"]');
        } catch (e) {}
        const isActive = (id === 'home' && activePanel === null)
          || (id === 'plugins' && activePanel === 'plugins')
          || (id === 'schedules' && activePanel === 'schedules')
          || (id === 'usage' && (activePanel === 'usage' || usageOpen));
        btn.classList.toggle('active', isActive);
        // 双态图标：选中切换为实心变体（仅在状态变化时替换，避免每帧重排）
        const pair = RAIL_TWO_STATE_ICONS[id];
        if (pair) {
          const want = isActive ? 'active' : 'normal';
          if (btn.dataset.iconState !== want) {
            btn.dataset.iconState = want;
            btn.innerHTML = isActive ? pair.active : pair.normal;
          }
        }
      });
    }

    function ensureRail() {
      if (typeof document === 'undefined' || !document.body) return;
      let rail = document.getElementById(RAIL_ID);
      if (!rail) {
        rail = document.createElement('div');
        rail.id = RAIL_ID;        rail.innerHTML = `
          <div class="dsh-rail-dragzone" aria-hidden="true"></div>
          <nav class="dsh-rail-nav" aria-label="固定导航">
            <button type="button" class="dsh-rail-btn dsh-rail-btn-custom" data-rail-action="home" data-tip="首页" aria-label="首页"></button>
            <button type="button" class="dsh-rail-btn dsh-rail-btn-custom" data-rail-action="schedules" data-tip="自动化任务" aria-label="自动化任务"></button>
            <button type="button" class="dsh-rail-btn dsh-rail-btn-custom" data-rail-action="plugins" data-tip="插件" aria-label="插件"></button>
            <button type="button" class="dsh-rail-btn dsh-rail-btn-custom" data-rail-action="usage" data-tip="用量统计" aria-label="用量统计"></button>
            <button type="button" class="dsh-rail-btn" data-rail-action="more" data-tip="更多" aria-label="更多">${RAIL_MORE_SVG_HTML}</button>
          </nav>
          <div class="dsh-rail-spacer"></div>
          <button type="button" class="dsh-rail-btn dsh-rail-avatar-btn" data-rail-action="account" aria-label="账号"></button>
        `;
        // 双态图标先渲染未选中态
        Object.entries(RAIL_TWO_STATE_ICONS).forEach(([id, pair]) => {
          const btn = rail.querySelector(`[data-rail-action="${id}"]`);
          if (btn) {
            btn.dataset.iconState = 'normal';
            btn.innerHTML = pair.normal;
          }
        });
        rail.addEventListener('click', (e) => {
          const btn = e.target && e.target.closest ? e.target.closest('[data-rail-action]') : null;
          if (!btn || !rail.contains(btn)) return;
          e.stopPropagation();
          railHandleAction(btn);
        });
        document.body.appendChild(rail);
      }
      railNode = rail;
      // aria-current 属性观察器：layout 服务不可用时，激活态靠原生面板行的
      // aria-current 变化即时同步（不依赖 rAF 扫描，避免后台帧节流延迟）
      if (!railAttrObserver && typeof MutationObserver !== 'undefined') {
        railAttrObserver = new MutationObserver(() => {
          syncRailActive();
        });
        railAttrObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['aria-current'],
          subtree: true
        });
      }
      const avatarBtn = rail.querySelector('.dsh-rail-avatar-btn');
      if (avatarBtn) {
        const nextAvatar = railAvatarHtml();
        if (avatarBtn.dataset.railAvatar !== nextAvatar) {
          avatarBtn.dataset.railAvatar = nextAvatar;
          avatarBtn.innerHTML = nextAvatar;
          // 镜像的原生头像 URL 偶发加载失败（会话级 blob/鉴权地址），失败后
          // img 渲染为透明块、头像"消失"——立即换成圆形人像兜底图标。
          // dataset 已记录本次 HTML，扫描对比不会再触发重渲染，无循环风险。
          const imgEl = avatarBtn.querySelector('img.dsh-rail-avatar-img');
          if (imgEl) {
            imgEl.addEventListener('error', () => {
              avatarBtn.innerHTML = `<span class="dsh-rail-avatar-fallback">${RAIL_USER_SVG_HTML}</span>`;
            }, { once: true });
          }
        }
        maybeDumpAvatarDiagnostics();
      }
      syncRailActive();
      // 首页悬浮抽屉：先挂载（隐藏态），hover 进入首页按钮时按需展开
      ensureHomeDrawer();
    }

    function teardownRail() {
      closeRailMenu();
      if (railPanelUnsubscribe) {
        try { railPanelUnsubscribe(); } catch (e) {}
        railPanelUnsubscribe = null;
      }
      if (railAttrObserver) {
        try { railAttrObserver.disconnect(); } catch (e) {}
        railAttrObserver = null;
      }
      if (railUsageNode) {
        railUsageNode.remove();
        railUsageNode = null;
      }
      teardownHomeDrawer();
      const rail = document.getElementById(RAIL_ID);
      if (rail) rail.remove();
      railNode = null;
    }

    /* ======================================================================
       14b. 固定栏首页「悬浮卡片抽屉」——原生侧栏托管模式 (Native Hosting, v1.1.25)

       不再自绘抽屉：hover 首页按钮时把「宿主宽态侧栏」整体套进悬浮卡片壳。
       品牌行 / 新会话胶囊 / 工作区三入口 / 工作区文件夹 / 会话列表 / 底部设置
       全部原生渲染（数据、交互、快捷键零复刻，宿主升级自动跟随）。
       本插件只负责四件事：
       ① 生命周期：hover/键盘唤起 → layout.toggleSidebar 展开；移出热区收回；
       ② 卡片壳几何（CSS .dsh-native-host）：left 6 / top 标题栏+6 /
          bottom 14 / width 268 / radius 14 / 边框 / 投影；
       ③ 防推挤：托管期间把 frame 的 grid-template-columns 用 !important 钉在
          唤起前记住的「收起态值」，聊天区纹丝不动；
       ④ 开合 180ms 缓出动画（开=入场；收=先淡出壳再瞬时收回，不闪跳）。
       ====================================================================== */
    const HOME_DRAWER_TRIGGER_SEL = '#dsh-ui-rail [data-rail-action="home"]';
    /* 开合动画时长（ms）：开=入场动画；收=淡出壳 → 到时再 toggleSidebar 瞬时收回 */
    const NATIVE_HOST_ANIM_MS = 180;
    /* 托管类：由 JS 打在宿主侧栏列（[class*="_sidebarCol"]）上，CSS 见第 14 节 */
    const NATIVE_HOST_CLASS = 'dsh-native-host';
    const NATIVE_HOST_CLOSING_CLASS = 'dsh-native-host-closing';
    /* 全局托管模式类：打在 <html> 上，用于压制 grid 模板动画 / 隐藏拖拽手柄 */
    const NATIVE_HOST_MODE_CLASS = 'dsh-native-host-mode';
    const NATIVE_SIDEBAR_COL_SEL = '[class*="_sidebarCol"]';
    const NATIVE_FRAME_SEL = '[class*="_frame"]';
    /* 指针位移门禁阈值：小于该位移视为抖动/虚假事件，不当作「触摸」 */
    const HOME_DRAWER_MOVE_TOLERANCE_PX = 3;

    /* v1.1.25 起抽屉改为原生托管模式：品牌行 / 图标 / 会话列表全部原生渲染，
       自绘 SVG 常量（含用户提供的一体化 logo；源文件仍在 D:/桌面/logo.svg）
       随之退役，此处不再保留副本。 */

    /* 抽屉运行时状态：定时器 / 事件句柄 / 托管元素引用 */
    let homeDrawerOpen = false;
    let homeDrawerHideTimer = null;
    let homeDrawerEnterHandler = null;
    let homeDrawerLeaveHandler = null;
    let homeDrawerFocusHandler = null;
    let homeDrawerMoveHandler = null;
    let homeDrawerPointerOutHandler = null;
    let homeDrawerFocusOutHandler = null;
    let nativeHostCol = null;            // 托管中的宿主侧栏列元素（null = 未托管）
    let nativeHostPinnedTemplate = null; // 唤起前 frame 的 grid-template-columns（收起态值）
    let nativeHostCommitting = false;    // 收尾中（防重入）
    /* 指针「真实移动」门禁：页面重载/宿主重挂载按钮时，指针恰好停在按钮上会触发
       一次虚假 mouseenter（React 重挂载同理），导致「还没触摸就展开」。只有
       观察到指针真的动过（超过 HOME_DRAWER_MOVE_TOLERANCE_PX）才允许展开。 */
    let homePointerMoved = false;
    let homePointerPos = null;

    function isSidebarCollapsed() {
      try {
        const frame = document.querySelector(NATIVE_FRAME_SEL);
        if (frame && frame.hasAttribute('data-sidebar-collapsed')) return true;
        return document.documentElement.hasAttribute('data-sidebar-collapsed');
      } catch (e) {
        return false;
      }
    }

    /* --- 原生托管辅助 --- */

    function getLayoutFace() {
      try {
        if (!dshCtx) return null;
        if (typeof dshCtx.get === 'function') {
          const svc = dshCtx.get('layout');
          if (svc) return svc;
        }
        return dshCtx.layout || null;
      } catch (e) { return null; }
    }

    /* 展开/收起原生侧栏。优先 layout.toggleSidebar；兜底点宿主侧栏开关按钮。 */
    function toggleSidebarSafe() {
      try {
        const layout = getLayoutFace();
        if (layout && typeof layout.toggleSidebar === 'function') { layout.toggleSidebar(); return true; }
      } catch (e) {}
      try {
        const btn = document.querySelector('[class*="_toggle"]');
        if (btn) { btn.click(); return true; }
      } catch (e) {}
      return false;
    }

    function findNativeFrame() {
      try { return document.querySelector(NATIVE_FRAME_SEL); } catch (e) { return null; }
    }

    /* 宿主侧栏列 = 卡片壳的挂载点。class 哈希随构建变化，用稳定后缀选择器。 */
    function findNativeSidebarCol() {
      try { return document.querySelector(NATIVE_SIDEBAR_COL_SEL); } catch (e) { return null; }
    }

    /* 防推挤核心：把 frame 的 grid-template-columns 钉在「唤起前记住的收起态值」。
       宿主展开侧栏时会把模板改成宽态（侧栏列变宽、聊天区右移）——托管期间钉住，
       聊天区纹丝不动；卡片壳用 absolute 悬浮在上方。
       同时同步 CSS 变量 --dsh-pinned-grid-template-columns，通过样式表 !important 规则
       彻底压制 React 重新渲染带来的行内样式覆盖。 */
    function pinFrameTemplate(frame) {
      try {
        if (!frame) return;
        if (nativeHostPinnedTemplate == null) {
          nativeHostPinnedTemplate = (frame.style && frame.style.gridTemplateColumns)
            || (typeof window !== 'undefined' && window.getComputedStyle
              ? window.getComputedStyle(frame).gridTemplateColumns : '') || '';
        }
        if (nativeHostPinnedTemplate) {
          try {
            document.documentElement.style.setProperty('--dsh-pinned-grid-template-columns', nativeHostPinnedTemplate);
          } catch (e) {}
          if (frame.style && frame.style.setProperty) {
            frame.style.setProperty('grid-template-columns', nativeHostPinnedTemplate, 'important');
          }
        }
      } catch (e) {}
    }

    function unpinFrameTemplate(frame) {
      try {
        document.documentElement.style.removeProperty('--dsh-pinned-grid-template-columns');
        if (frame && frame.style && frame.style.removeProperty) {
          frame.style.removeProperty('grid-template-columns');
        }
      } catch (e) {}
      nativeHostPinnedTemplate = null;
    }

    /* 展开完成后给侧栏列挂上卡片壳（幂等；属性观察器与即时尝试双路触发） */
    function attachNativeHost() {
      try {
        const col = findNativeSidebarCol();
        if (!col) return false;
        if (nativeHostCol !== col) {
          col.classList.add(NATIVE_HOST_CLASS);
          nativeHostCol = col;
        }
        return true;
      } catch (e) { return false; }
    }

    function detachNativeHostClasses() {
      try {
        if (nativeHostCol) {
          nativeHostCol.classList.remove(NATIVE_HOST_CLASS);
          nativeHostCol.classList.remove(NATIVE_HOST_CLOSING_CLASS);
          nativeHostCol = null;
        }
      } catch (e) {}
      try { document.documentElement.classList.remove(NATIVE_HOST_MODE_CLASS); } catch (e) {}
    }

    /* 侧栏收起与否直接决定抽屉能否显示：宿主仅切换 data-sidebar-collapsed 属性、
       不产生 childList 变动，因此额外挂属性观察器：
       - 属性移除（展开完成）且在唤起中 → 挂卡片壳并补钉网格模板；
       - 属性出现（被收起）且在唤起中 → 外力（用户点了原生开关）收尾，不再 toggle。 */
    let homeDrawerAttrObserver = null;
    const homeDrawerAttrTargets = new Set();
    function ensureHomeDrawerAttrObserver() {
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
      try {
        if (!homeDrawerAttrObserver) {
          homeDrawerAttrObserver = new MutationObserver(() => {
            const collapsed = isSidebarCollapsed();
            if (!collapsed && homeDrawerOpen) {
              attachNativeHost();
              pinFrameTemplate(findNativeFrame());
            } else if (collapsed && homeDrawerOpen) {
              homeDrawerCommitHide();
            }
            railUpdateNavButtons();
          });
        }
        const candidates = [document.documentElement, findNativeFrame()];
        candidates.forEach((target) => {
          if (!target || homeDrawerAttrTargets.has(target)) return;
          homeDrawerAttrTargets.add(target);
          homeDrawerAttrObserver.observe(target, {
            attributes: true,
            attributeFilter: ['data-sidebar-collapsed']
          });
        });
      } catch (e) {
        dbg('home drawer attr observer failed', e);
      }
    }

    /* 唤起：仅侧栏收起态可行。先取消在途收起 → 打全局托管模式类 → 钉住 frame
       模板（防推挤，须在 toggleSidebar 之前）→ 即刻挂载卡片壳并展开原生侧栏。
       0ms 后及属性观察器双重补位，确保跨帧重渲染下壳样式不脱落、网格防推挤不失效。 */
    function homeDrawerShow() {
      if (!isSidebarCollapsed()) {
        // 侧栏已展开分两种情形：
        // ① 托管淡出进行中（我们自己展开的、模板仍钉着）——视为回移复活，
        //    取消收起即可，不得误判为「用户手动展开」而执行收尾；
        // ② 用户自己手动展开——彻底拒绝托管，顺手清掉可能残留的托管态。
        if (homeDrawerOpen && nativeHostPinnedTemplate != null) {
          homeDrawerCancelHide();
          return;
        }
        if (homeDrawerOpen || nativeHostCol) homeDrawerCommitHide();
        return;
      }
      homeDrawerCancelHide();
      homeDrawerOpen = true;
      nativeHostCommitting = false;
      try {
        const homeBtn = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
        if (homeBtn) homeBtn.classList.add('dsh-suppress-tip');
      } catch (e) {}
      try { document.documentElement.classList.add(NATIVE_HOST_MODE_CLASS); } catch (e) {}
      pinFrameTemplate(findNativeFrame());
      attachNativeHost();
      toggleSidebarSafe();
      setTimeout(() => {
        try {
          if (homeDrawerOpen) {
            attachNativeHost();
            pinFrameTemplate(findNativeFrame());
          }
        } catch (e) {}
        // v1.1.37 诊断：抽屉打开时落盘工作区搜索入口快照（.dsh-ui-debug.json）
        try { ensureWorkspaceSearch(); dumpAvatarDiagnostics(); } catch (e) {}
      }, 0);
      // v1.1.40：展开动画结束后再落一次快照——0ms 那次往往赶在宿主侧栏完成布局
      // 之前，几何全是 0，无法用来核实图标组的实际左右偏移（v1.1.41 核实右端）。
      setTimeout(() => {
        try {
          if (homeDrawerOpen) { ensureWorkspaceSearch(); dumpAvatarDiagnostics(); }
        } catch (e) {}
      }, NATIVE_HOST_ANIM_MS + 80);
    }

    /* 收尾（真正收起）：摘壳 → 侧栏仍展开则收回 → 解除模板钉扎。
       只在「我们唤起过」（钉过模板）时才 toggle，绝不碰用户自己展开的侧栏。 */
    function homeDrawerCommitHide() {
      if (nativeHostCommitting) return;
      nativeHostCommitting = true;
      try {
        homeDrawerOpen = false;
        if (homeDrawerHideTimer) {
          clearTimeout(homeDrawerHideTimer);
          homeDrawerHideTimer = null;
        }
        try {
          const homeBtn = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
          if (homeBtn) homeBtn.classList.remove('dsh-suppress-tip');
        } catch (e) {}
        detachNativeHostClasses();
        if (nativeHostPinnedTemplate != null && !isSidebarCollapsed()) toggleSidebarSafe();
        unpinFrameTemplate(findNativeFrame());
      } finally {
        nativeHostCommitting = false;
      }
    }

    /* 收起分两拍：先给壳加淡出类（180ms，与入场同曲线），动画结束再 commit——
       避免「壳先落回停靠位、聊天区被推一下」的闪跳。无壳（尚未挂载成功）时直接收尾。 */
    function homeDrawerHide() {
      if (!homeDrawerOpen || nativeHostCommitting) return;
      // v1.1.35：淡出进行中不重启定时器——连续移出不得无限拉长淡出窗，
      // 收尾固定在「首次移出后 180ms」完成，之后只能靠触碰图标再唤起。
      if (homeDrawerHideTimer) return;
      const col = nativeHostCol || findNativeSidebarCol();
      if (!col) { homeDrawerCommitHide(); return; }
      col.classList.add(NATIVE_HOST_CLOSING_CLASS);
      homeDrawerHideTimer = setTimeout(() => {
        homeDrawerHideTimer = null;
        homeDrawerCommitHide();
      }, NATIVE_HOST_ANIM_MS);
    }

    function homeDrawerCancelHide() {
      if (homeDrawerHideTimer) {
        clearTimeout(homeDrawerHideTimer);
        homeDrawerHideTimer = null;
      }
      if (nativeHostCol) nativeHostCol.classList.remove(NATIVE_HOST_CLOSING_CLASS);
      try {
        const homeBtn = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
        if (homeBtn) homeBtn.classList.add('dsh-suppress-tip');
      } catch (e) {}
    }

    function homeDrawerScheduleHide() {
      homeDrawerHide();
    }

    /* v1.1.35 复活门禁：收起一旦开始（淡出定时器在跑），仅房屋图标本体可复活；
       卡片体 / 过渡走廊回移不再把正在收起的卡片拉回来（用户实测：没碰图标
       卡片就滑出）。未在收起时命中热区本就维持开启，cancel 是无害空操作。 */
    function homeDrawerReviveIfAllowed(ev) {
      if (!homeDrawerHideTimer || homeDrawerPointerOverTrigger(ev)) homeDrawerCancelHide();
    }

    /* mouseleave 的收起判定（去抖）：
       「离开某个元素」≠「离开悬停热区」——只有当离开的目标明确在托管卡片内、
       且当前坐标脱离合法热区时才触发收起；真正的离开由 pointermove 逐帧复核兜底。 */
    function homeDrawerLeaveMaybeHide(ev) {
      if (homeDrawerHotzoneHit(ev)) { homeDrawerReviveIfAllowed(ev); return; }
      const related = ev && ev.relatedTarget;
      if (related && related.closest) {
        try {
          if (related.closest('.' + NATIVE_HOST_CLASS)) {
            homeDrawerReviveIfAllowed(ev);
            return;
          }
        } catch (e) {}
      }
      homeDrawerHide();
    }

    /* 「精准悬停热区」（v1.1.27 修正卡片压栏几何）：
       ① 房屋图标本体：光标真实落在房屋几何轮廓之内；
       ② 托管卡片「可见」本体（仅抽屉展开时有效）：光标在卡片可见矩形之内；
       ③ 图标 → 卡片 过渡通道（仅抽屉展开时有效）：图标右缘 → 卡片可见左缘的走廊。
       严禁将房屋图标周围留白、固定栏其他功能按钮或页面其他区域纳入热区！
       关键修正：卡片壳 left:6px，其左段（6px .. 固定栏右缘 64px）压在固定栏下方，
       旧逻辑直接用 colR.left 起算热区，会把整条固定栏右半与图标周围留白全部吞进
       热区——表现为「光标只是靠近图标右侧白色区域、还没碰到图标，卡片就滑出」。
       现以固定栏右缘为卡片可见左缘锚点，走廊几何也随之前移，两个方向都成立。 */
    function homeDrawerHotzoneHit(ev) {
      if (!ev || typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return false;
      // 门禁：光标若明确落在固定栏其他功能按钮上（自动化任务、插件、用量、更多、账号等），绝非首页抽屉热区
      if (ev.target && ev.target.closest) {
        const railBtn = ev.target.closest('#dsh-ui-rail [data-rail-action]');
        if (railBtn && railBtn.getAttribute && railBtn.getAttribute('data-rail-action') !== 'home') {
          return false;
        }
      }
      const x = ev.clientX, y = ev.clientY;
      try {
        const overTrigger = homeDrawerPointerOverTrigger(ev);
        // ① 房屋图标本体：光标真实落在房屋几何轮廓之内（精准图形轮廓，绝非 40x40 留白）
        if (overTrigger) return true;

        // ② 仅在抽屉处于打开状态时，托管卡片体与过渡走廊才参与热区
        if (homeDrawerOpen) {
          const col = nativeHostCol || findNativeSidebarCol();
          const colR = col && col.getBoundingClientRect && col.getBoundingClientRect();
          if (colR && colR.width > 0 && colR.height > 0) {
            // 卡片「可见左缘」：max(卡片壳几何左缘, 固定栏右缘)。固定栏不可测
            // （width 0，如测试桩）时退回卡片壳几何左缘保持旧行为。
            let visibleLeft = colR.left;
            try {
              const rail = document.getElementById('dsh-ui-rail');
              const railR = rail && rail.getBoundingClientRect && rail.getBoundingClientRect();
              if (railR && railR.width > 0) visibleLeft = Math.max(visibleLeft, railR.right);
            } catch (e) {}

            // 2a. 托管卡片可见本体（用户浏览/操作会话列表）：右侧与底部提供 8px
            // 手势容差；左缘严密贴可见左缘（2px 容差吸收跨界事件的坐标取整），
            // 压在固定栏下方的不可见卡片段绝不参与热区。
            if (x >= visibleLeft - 2 && x <= colR.right + 8 && y >= colR.top && y <= colR.bottom + 8) {
              return true;
            }

            // 2b. 图标 → 卡片 过渡通道（仅限从图标右侧向右进入卡片）：
            // 水平 = min/max(图标右缘, 卡片可见左缘) ± 边界容差——以可见左缘为锚，
            // 无论卡片在图标右侧（旧 left:72）还是压栏（left:6）都不会反转；
            // 垂直 = 图标垂直范围为主，向上让 8px、向下覆盖到卡片顶缘（+8px），
            // 保证斜向进入卡片左上角不断链。图标左侧/下方留白不在通道内。
            const trigger = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
            const svg = trigger && trigger.querySelector('svg');
            const svgR = svg && svg.getBoundingClientRect && svg.getBoundingClientRect();
            if (svgR && svgR.width > 0 && svgR.height > 0) {
              const corridorLeft = Math.min(svgR.right, visibleLeft) - 2;
              const corridorRight = Math.max(svgR.right, visibleLeft) + 8;
              const corridorTop = Math.min(svgR.top, colR.top) - 8;
              const corridorBottom = Math.max(svgR.bottom, colR.top) + 8;
              if (x >= corridorLeft && x <= corridorRight && y >= corridorTop && y <= corridorBottom) {
                return true;
              }
            }
          }
        }
      } catch (e) {}
      return false;
    }

    /* 精准几何：判定坐标 (x, y) 是否真实落在首页房屋图标物理轮廓（屋顶三角斜坡与主体墙面）之内。
       房屋真实视觉尺寸：22x22；屋顶尖 (Cx, yTop)，屋檐两端 (Lx, Ey) ~ (Rx, Ey)，墙体 (WxL ~ WxR, Ey ~ By)。
       在按钮留白处、屋顶上方透明三角拐角处、墙体外侧完全返回 false，绝不提前抢跑。 */
    function isPointInHouseIcon(x, y, svgR) {
      if (!svgR || svgR.width <= 0 || svgR.height <= 0) return false;
      const l = svgR.left, t = svgR.top, w = svgR.width, h = svgR.height;
      const cx = l + w * 0.5;
      const yTop = t + h * 0.04;
      const ey = t + h * 0.38;
      const by = t + h * 0.93;
      const wxl = l + w * 0.17;
      const wxr = l + w * 0.83;
      const rx = l + w * 0.95;

      // 1. 垂直范围核验：屋顶尖端上方 或 房屋地基下方：不在图标内
      if (y < yTop || y > by) return false;

      // 2. 屋顶三角区域判定 (yTop <= y <= ey)：两侧屋檐斜坡内才算命中
      if (y <= ey) {
        const prog = (y - yTop) / (ey - yTop);
        const halfW = prog * (rx - cx);
        return Math.abs(x - cx) <= halfW;
      }

      // 3. 墙壁主体区域判定 (ey < y <= by)：墙壁左右两侧留白处不唤起
      return x >= wxl && x <= wxr;
    }

    function homeDrawerPointerOverTrigger(ev) {
      if (!ev) return false;
      try {
        const btn = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
        if (!btn) return false;

        const target = ev.target;
        // 严格目标源门禁：事件目标必须真实在首页按钮之内（严格排除页面其他元素、其他固定栏图标、以及 document/body）
        const targetInBtn = !!(target && (target === btn || (btn.contains && btn.contains(target)) || (target.closest && target.closest(HOME_DRAWER_TRIGGER_SEL))));
        if (!targetInBtn) return false;

        const svg = btn.querySelector('svg');

        // ① 鼠标坐标精准图形轮廓判定：光标必须物理落入房屋几何轮廓之内
        if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
          const svgR = svg && svg.getBoundingClientRect && svg.getBoundingClientRect();
          if (svgR && svgR.width > 0 && svgR.height > 0) {
            return isPointInHouseIcon(ev.clientX, ev.clientY, svgR);
          }
          return false;
        }

        // ② 键盘可达性兜底（focusin 事件无 clientX 坐标）
        if (typeof ev.clientX !== 'number') {
          return true;
        }
      } catch (e) {}
      return false;
    }

    function homeDrawerPointerOverHost(ev) {
      if (!ev) return false;
      try {
        const target = ev.target;
        if (target && target.closest && target.closest('.' + NATIVE_HOST_CLASS)) return true;
        if (target && target.matches && target.matches('.' + NATIVE_HOST_CLASS)) return true;
      } catch (e) {}
      return false;
    }

    /* 指针是否落在「唤起区」上：
       ① 优先命中首页图标核心区域（通过 homeDrawerPointerOverTrigger 精准几何判定）；
       ② 抽屉已打开时，光标落在托管卡片内也视为合法有效；
       ③ 严禁使用外层 40x40 透明按钮矩形在留白处提前开合。 */
    function homeDrawerCheckOpen(ev) {
      if (homeDrawerPointerOverTrigger(ev)) return true;
      if (homeDrawerOpen && homeDrawerPointerOverHost(ev)) return true;
      return false;
    }

    /* 宿主侧栏是懒渲染/重挂载的：固定栏与 #dsh-ui-rail 可能晚于插件加载才出现，
       且切换侧栏只改 data-sidebar-collapsed 属性（不产生 childList 变动）。这里用
       一个有界自愈定时器在启动后 20 秒内每次 1 秒重试补挂观察器与抽屉节点，
       覆盖「宿主渲染晚于插件」的窗口，超时后自动停止（零常驻开销）。 */
    let homeDrawerSelfHealTimer = null;
    let homeDrawerSelfHealDeadline = 0;
    function ensureHomeDrawerSelfHeal() {
      if (homeDrawerSelfHealTimer) return;
      if (!homeDrawerSelfHealDeadline) homeDrawerSelfHealDeadline = Date.now() + 20000;
      if (Date.now() > homeDrawerSelfHealDeadline) return;
      homeDrawerSelfHealTimer = setInterval(() => {
        try {
          ensureHomeDrawerAttrObserver();
          ensureHomeDrawerDocObserver();
          ensureHomeDrawer();
        } catch (e) {}
        if (Date.now() > homeDrawerSelfHealDeadline) {
          clearInterval(homeDrawerSelfHealTimer);
          homeDrawerSelfHealTimer = null;
        }
      }, 1000);
    }

    /* 托管模式不再自绘任何抽屉 DOM：这里只负责绑定 hover/键盘生命周期监听、
       挂属性/文档观察器与有界自愈。卡片壳与内容全部由宿主宽态侧栏提供。 */
    function ensureHomeDrawer() {
      if (typeof document === 'undefined' || !document.body) return;
      if (!homeDrawerEnterHandler) {
        /* 行为契约：
           ① 展开——指针「真实移动」到首页按钮上（mouseenter 命中按钮，或 pointermove
              期间按钮矩形被命中）立即展开；重载/重挂载带来的虚假 mouseenter 不展开。
           ② 收起——移出「按钮 ∪ 抽屉」热区即刻收起（零缓冲）：pointermove 逐帧复核
              位置作为主判定，mouseleave 只做去抖补位（边界坐标不算离开），即使
              mouseleave 丢失也能收尾；指针离开窗口（pointerleave/mouseleave 且
              relatedTarget 为空）同样立即收起。 */
        homeDrawerMoveHandler = (e) => {
          const x = typeof e.clientX === 'number' ? e.clientX : null;
          const y = typeof e.clientY === 'number' ? e.clientY : null;
          if (x !== null && y !== null) {
            const prev = homePointerPos;
            if (!prev || Math.abs(x - prev.x) + Math.abs(y - prev.y) > HOME_DRAWER_MOVE_TOLERANCE_PX) {
              homePointerMoved = true;
            }
            homePointerPos = { x, y };
          }
          if (!homePointerMoved) return;
          if (!homeDrawerOpen) {
            // 抽屉未打开态：严格只在光标真实物理触碰到房屋图标时才唤起，周围留白与其他区域完全不唤起
            if (homeDrawerCheckOpen(e)) homeDrawerShow();
          } else {
            const hit = homeDrawerHotzoneHit(e);
            if (hit) {
              // v1.1.35：收起进行中仅房屋图标本体可复活（卡片体/走廊回移不拉回）
              homeDrawerReviveIfAllowed(e);
            } else {
              // 离开热区（移入周围留白、其他功能按钮或外部区域）：立刻排期收起
              homeDrawerScheduleHide();
            }
          }
        };
        homeDrawerEnterHandler = (e) => {
          if (!homePointerMoved) return;
          const btn = document.querySelector(HOME_DRAWER_TRIGGER_SEL);
          if (!btn) return;
          const target = e && e.target;
          if (target && target !== btn && (!btn.contains || !btn.contains(target)) && (!target.closest || !target.closest(HOME_DRAWER_TRIGGER_SEL))) {
            return;
          }
          if (homeDrawerPointerOverTrigger(e)) homeDrawerShow();
        };
        homeDrawerLeaveHandler = (e) => {
          const related = e && e.relatedTarget;
          const leftWindow = !related || related === document.documentElement
            || (related.nodeType === 9) /* Document */;
          if (leftWindow) { homeDrawerHide(); return; }
          homeDrawerLeaveMaybeHide(e);
        };
        homeDrawerPointerOutHandler = (e) => {
          const related = e && e.relatedTarget;
          if (!related || related === document.documentElement) homeDrawerHide();
        };
        homeDrawerFocusHandler = (e) => {
          const t = e.target;
          if (t && t.matches && t.matches(HOME_DRAWER_TRIGGER_SEL) && isSidebarCollapsed()) homeDrawerShow();
        };
        homeDrawerFocusOutHandler = (e) => {
          // 键盘可达性：焦点离开「首页按钮 ∪ 抽屉」时收起（悬停路径不依赖它）
          const next = e && e.relatedTarget;
          if (!next) { homeDrawerHide(); return; }
          try {
            if (next.closest && (next.closest(HOME_DRAWER_TRIGGER_SEL) || next.closest('.' + NATIVE_HOST_CLASS))) return;
          } catch (err) {}
          homeDrawerHide();
        };
        document.addEventListener('mouseenter', homeDrawerEnterHandler, true);
        document.addEventListener('mouseover', homeDrawerEnterHandler, true);
        document.addEventListener('pointermove', homeDrawerMoveHandler, true);
        document.addEventListener('mousemove', homeDrawerMoveHandler, true);
        document.addEventListener('mouseleave', homeDrawerLeaveHandler, true);
        document.addEventListener('pointerleave', homeDrawerPointerOutHandler, true);
        document.addEventListener('focusin', homeDrawerFocusHandler, true);
        document.addEventListener('focusout', homeDrawerFocusOutHandler, true);
      }
      // 终止条件兜底：抽屉已关闭但残留钉扎模板 → 立即清理收尾。
      // 托管激活中（homeDrawerOpen 为 true）绝不触碰。
      if (!homeDrawerOpen && nativeHostPinnedTemplate != null) homeDrawerCommitHide();
      ensureHomeDrawerAttrObserver();
      ensureHomeDrawerDocObserver();
      ensureHomeDrawerSelfHeal();
    }

    /* 抽屉只在「侧栏收起」时挂载，但宿主侧栏是懒渲染的（收起态此前根本没有侧栏
       DOM）——面板行、固定栏按钮都可能晚于插件加载才出现，而属性观察器只能监听
       已存在的元素。因此用 document 级观察器补挂：任何插入到文档中的节点都会触发
       一次检查，命中即挂上观察器并自解绑；期间若被 disconnect 会在下次调用时重挂。 */
    let homeDrawerDocObserver = null;
    let homeDrawerDocObserverTarget = null;
    function inDocumentTree(node) {
      let p = node;
      while (p) {
        if (p === document.documentElement) return true;
        if (p.tagName === 'HTML') return true;
        p = p.parentNode;
      }
      return false;
    }
    function ensureHomeDrawerDocObserver() {
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
      try {
        const target = inDocumentTree(document.body) ? document.body
          : (inDocumentTree(document.documentElement) ? document.documentElement : null);
        if (!target) return;
        const observingTarget = homeDrawerDocObserver && homeDrawerDocObserverTarget === target;
        if (observingTarget) return;
        if (homeDrawerDocObserver) {
          try { homeDrawerDocObserver.disconnect(); } catch (e) {}
          homeDrawerDocObserver = null;
          homeDrawerDocObserverTarget = null;
        }
        const mo = new MutationObserver(() => {
          try {
            if (!isSidebarCollapsed()) return;
            if (!inDocumentTree(document.body)) return;
            ensureHomeDrawer();
            try { mo.disconnect(); } catch (e) {}
            homeDrawerDocObserver = null;
            homeDrawerDocObserverTarget = null;
          } catch (e) {}
        });
        mo.observe(target, { childList: true, subtree: true });
        homeDrawerDocObserver = mo;
        homeDrawerDocObserverTarget = target;
      } catch (e) {
        homeDrawerDocObserver = null;
        homeDrawerDocObserverTarget = null;
        dbg('home drawer doc observer failed', e);
      }
    }

    function teardownHomeDrawer() {
      homeDrawerCancelHide();
      if (homeDrawerSelfHealTimer) {
        clearInterval(homeDrawerSelfHealTimer);
        homeDrawerSelfHealTimer = null;
      }
      homeDrawerSelfHealDeadline = 0;
      if (homeDrawerAttrObserver) {
        try { homeDrawerAttrObserver.disconnect(); } catch (e) {}
        homeDrawerAttrObserver = null;
      }
      homeDrawerAttrTargets.clear();
      if (homeDrawerDocObserver) {
        try { homeDrawerDocObserver.disconnect(); } catch (e) {}
        homeDrawerDocObserver = null;
        homeDrawerDocObserverTarget = null;
      }
      if (homeDrawerEnterHandler) {
        document.removeEventListener('mouseenter', homeDrawerEnterHandler, true);
        document.removeEventListener('mouseover', homeDrawerEnterHandler, true);
        homeDrawerEnterHandler = null;
      }
      if (homeDrawerLeaveHandler) {
        document.removeEventListener('mouseleave', homeDrawerLeaveHandler, true);
        homeDrawerLeaveHandler = null;
      }
      if (homeDrawerMoveHandler) {
        document.removeEventListener('pointermove', homeDrawerMoveHandler, true);
        document.removeEventListener('mousemove', homeDrawerMoveHandler, true);
        homeDrawerMoveHandler = null;
      }
      if (homeDrawerPointerOutHandler) {
        document.removeEventListener('pointerleave', homeDrawerPointerOutHandler, true);
        homeDrawerPointerOutHandler = null;
      }
      if (homeDrawerFocusHandler) {
        document.removeEventListener('focusin', homeDrawerFocusHandler, true);
        homeDrawerFocusHandler = null;
      }
      if (homeDrawerFocusOutHandler) {
        document.removeEventListener('focusout', homeDrawerFocusOutHandler, true);
        homeDrawerFocusOutHandler = null;
      }
      // 插件卸载/热重载：若正处于托管中，先恢复宿主侧栏原状（摘壳 + 收回 +
      // 解除模板钉扎），避免留下「展开着的漂浮侧栏」。
      homeDrawerOpen = false;
      nativeHostCommitting = false;
      detachNativeHostClasses();
      try {
        if (nativeHostPinnedTemplate != null && !isSidebarCollapsed()) toggleSidebarSafe();
      } catch (e) {}
      unpinFrameTemplate(findNativeFrame());
      homePointerMoved = false;
      homePointerPos = null;
    }


    /* ======================================================================
       15. 右上角 ← → 历史导航（返回 Ctrl+[ / 前进 Ctrl+]）
       记录 面板(activePanelId) + 会话(mainView 会话) 两级视图历史，
       与原生 uiWorkspace.openSession / layout.selectPanel 对接。
       ====================================================================== */
    const NAVBTNS_ID = 'dsh-ui-navbtns';

    const RAIL_ARROW_BACK_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19 12H5"/>
        <path d="M11 18l-6-6 6-6"/>
      </svg>
    `;

    const RAIL_ARROW_FORWARD_SVG_HTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M5 12h14"/>
        <path d="M13 6l6 6-6 6"/>
      </svg>
    `;

    const RAIL_PANEL_LEFT_SVG_HTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13.5 1.5H2.5C1.94772 1.5 1.5 1.94772 1.5 2.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V2.5C14.5 1.94772 14.0523 1.5 13.5 1.5Z"/>
        <path d="M5.5 1.5V14.5"/>
      </svg>
    `;

    /* v1.1.34 常驻 ⊕ 新建会话图标：与宿主 IconNewChatOutlineRegular 1:1（16x16
       viewBox、stroke-width 1，三条 path 原样取自 dsh-client-ui-primitives 的
       NewChatOutlineArtwork，形状与宿主浮动钮完全一致） */
    const RAIL_PLUS_SVG_HTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M2.37091 11.2501C1.58745 9.89288 1.32067 8.29835 1.61969 6.76006C1.91872 5.22177 2.76342 3.8433 3.99826 2.87846C5.2331 1.91362 6.77494 1.42737 8.33988 1.50925C9.90482 1.59113 11.3875 2.23562 12.5149 3.32406C13.6425 4.41269 14.3387 5.87206 14.4754 7.4334C14.612 8.99474 14.18 10.5529 13.2587 11.8209C12.3375 13.0888 10.9891 13.9813 9.46194 14.3337C8.18691 14.628 6.85895 14.5294 5.64989 14.0605C5.1712 13.8748 4.76962 13.4932 4.26534 13.3967C3.67413 13.2835 2.95257 13.5598 2.03794 14.3337" stroke="currentColor"/>
        <path d="M8 5V11" stroke="currentColor"/>
        <path d="M5 8H11" stroke="currentColor"/>
      </svg>
    `;

    const railHistory = { stack: [], index: -1, suppress: false };
    let navBtnsNode = null;
    let navKeydownHandler = null;

    function railCurrentViewState() {
      let panelId = null;
      let sessionId = null;
      try {
        const layout = getRailLayoutFace();
        const snap = layout && layout.panelInfo && typeof layout.panelInfo.getSnapshot === 'function'
          ? layout.panelInfo.getSnapshot()
          : null;
        if (snap) panelId = snap.activePanelId;
      } catch (e) {}
      try {
        const sessions = dshCtx && typeof dshCtx.get === 'function' ? dshCtx.get('sessions') : null;
        const snap = sessions && sessions.list && typeof sessions.list.getSnapshot === 'function'
          ? sessions.list.getSnapshot()
          : null;
        if (snap && snap.byId) {
          const main = Object.values(snap.byId).find(s => ((s.retainedBy || {}).mainView || 0) > 0);
          if (main) sessionId = main.id;
        }
      } catch (e) {}
      return { panelId, sessionId };
    }

    function railSyncHistory() {
      if (railHistory.suppress) return;
      const state = railCurrentViewState();
      const key = JSON.stringify(state);
      const current = railHistory.stack[railHistory.index];
      if (current && JSON.stringify(current) === key) return;
      railHistory.stack = railHistory.stack.slice(0, railHistory.index + 1);
      railHistory.stack.push(state);
      if (railHistory.stack.length > HISTORY_MAX_ENTRIES) {
        railHistory.stack.shift();
      } else {
        railHistory.index++;
      }
      railUpdateNavButtons();
    }

    function railUpdateNavButtons() {
      if (!navBtnsNode) return;
      const back = navBtnsNode.querySelector('[data-nav-action="back"]');
      const forward = navBtnsNode.querySelector('[data-nav-action="forward"]');
      if (back) back.disabled = railHistory.index <= 0;
      if (forward) forward.disabled = railHistory.index >= railHistory.stack.length - 1;
      const toggle = navBtnsNode.querySelector('[data-nav-action="toggle"]');
      if (toggle) {
        const collapsed = isSidebarCollapsed();
        const tip = collapsed ? '打开侧边栏 Ctrl+B' : '收起侧边栏 Ctrl+B';
        toggle.setAttribute('data-tip', tip);
        toggle.setAttribute('aria-label', tip);
      }
    }

    function railApplyHistoryState(entry) {
      railHistory.suppress = true;
      try {
        const layout = getRailLayoutFace();
        if (layout && typeof layout.selectPanel === 'function') {
          layout.selectPanel(entry.panelId || null);
        }
      } catch (e) {}
      try {
        const ws = getRailWorkspaceFace();
        if (ws && typeof ws.openSession === 'function' && entry.sessionId) {
          if (entry.sessionId !== railCurrentViewState().sessionId) {
            ws.openSession(entry.sessionId);
          }
        }
      } catch (e) {}
      railUpdateNavButtons();
      // 稳定检测替代旧固定 400ms 抑制窗：快照连续两次一致（且不早于最短
      // 窗口）即解除抑制；到达上限强制解除。快速导航不被吞、慢速导航不早泄漏。
      let lastKey = null;
      let elapsed = 0;
      const tick = () => {
        if (!railHistory.suppress) return; // 已被新操作/dispose 接管
        elapsed += HISTORY_SUPPRESS_STEP_MS;
        let key = '';
        try { key = JSON.stringify(railCurrentViewState()); } catch (e) {}
        const settled = lastKey !== null && key === lastKey && elapsed >= HISTORY_SUPPRESS_MIN_MS;
        if (settled || elapsed >= HISTORY_SUPPRESS_CAP_MS) {
          railHistory.suppress = false;
          railSyncHistory();
          return;
        }
        lastKey = key;
        setTimeout(tick, HISTORY_SUPPRESS_STEP_MS);
      };
      setTimeout(tick, HISTORY_SUPPRESS_STEP_MS);
    }

    function railGoBack() {
      if (railHistory.index <= 0) return;
      railHistory.index--;
      railApplyHistoryState(railHistory.stack[railHistory.index]);
    }

    function railGoForward() {
      if (railHistory.index >= railHistory.stack.length - 1) return;
      railHistory.index++;
      railApplyHistoryState(railHistory.stack[railHistory.index]);
    }

    function ensureNavButtons() {
      if (typeof document === 'undefined' || !document.body) return;
      if (!navBtnsNode || !navBtnsNode.isConnected) {
        const existing = document.getElementById(NAVBTNS_ID);
        navBtnsNode = existing || null;
        if (!navBtnsNode) {
          navBtnsNode = document.createElement('div');
          navBtnsNode.id = NAVBTNS_ID;
          navBtnsNode.innerHTML = `
            <button type="button" class="dsh-navbtn" data-nav-action="back" data-tip="返回 Ctrl+[" aria-label="返回">${RAIL_ARROW_BACK_SVG_HTML}</button>
            <button type="button" class="dsh-navbtn" data-nav-action="forward" data-tip="前进 Ctrl+]" aria-label="前进">${RAIL_ARROW_FORWARD_SVG_HTML}</button>
            <button type="button" class="dsh-navbtn dsh-navbtn-toggle" data-nav-action="toggle" data-tip="打开侧边栏 Ctrl+B" aria-label="打开侧边栏">${RAIL_PANEL_LEFT_SVG_HTML}</button>
            <button type="button" class="dsh-navbtn dsh-navbtn-plus" data-nav-action="new" data-tip="新建会话" aria-label="新建会话">${RAIL_PLUS_SVG_HTML}</button>
          `;
          navBtnsNode.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('[data-nav-action]') : null;
            if (!btn || btn.disabled) return;
            e.stopPropagation();
            if (btn.dataset.navAction === 'back') railGoBack();
            else if (btn.dataset.navAction === 'forward') railGoForward();
            else if (btn.dataset.navAction === 'new') {
              // 常驻 ⊕ 新建会话：与固定栏首页同路径（uiWorkspace.startSession 原生优先回退）
              railGoHome();
            }
            else if (btn.dataset.navAction === 'toggle') {
              if (homeDrawerOpen) {
                // 托管悬浮卡片展示期间点击侧栏开关：转为常驻展开态
                homeDrawerOpen = false;
                if (homeDrawerHideTimer) { clearTimeout(homeDrawerHideTimer); homeDrawerHideTimer = null; }
                detachNativeHostClasses();
                unpinFrameTemplate(findNativeFrame());
              } else {
                toggleSidebarSafe();
              }
              railUpdateNavButtons();
            }
          });
          document.body.appendChild(navBtnsNode);
        }
      }
      if (!navKeydownHandler) {
        navKeydownHandler = (e) => {
          if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
          // 输入焦点内不接管：把 Ctrl+[ / Ctrl+] 留给编辑器/宿主自身的快捷键
          const t = e.target;
          if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
          if (e.code === 'BracketLeft') {
            e.preventDefault();
            e.stopPropagation();
            railGoBack();
          } else if (e.code === 'BracketRight') {
            e.preventDefault();
            e.stopPropagation();
            railGoForward();
          }
        };
        document.addEventListener('keydown', navKeydownHandler, true);
      }
      railSyncHistory();
      railUpdateNavButtons();
    }

    function teardownNavButtons() {
      if (navKeydownHandler) {
        document.removeEventListener('keydown', navKeydownHandler, true);
        navKeydownHandler = null;
      }
      const node = document.getElementById(NAVBTNS_ID);
      if (node) node.remove();
      navBtnsNode = null;
      railHistory.stack = [];
      railHistory.index = -1;
      railHistory.suppress = false;
    }

    let syncRafId = null;
    function throttledSyncSendButton() {
      if (syncRafId) return;
      syncRafId = requestAnimationFrame(() => {
        syncRafId = null;
        syncSendButtonState();
      });
    }

    function syncSendButtonState() {
      const cards = document.querySelectorAll('.RlGAzG_card');
      cards.forEach(card => {
        const editor = card.querySelector('.RlGAzG_input, [data-composer-input], textarea, [contenteditable="true"]');
        const sendBtn = card.querySelector('.RlGAzG_primary, button[aria-label="发送"], button[aria-label="Send"]');
        if (!sendBtn) return;
        if (editor) {
          // textContent 优先：不触发强制布局（innerText 每次都 reflow）。
          // 占位符是独立节点（.RlGAzG_placeholder），不污染 textContent。
          const text = (editor.textContent || '').trim();
          const hasContent = text.length > 0;
          const current = sendBtn.getAttribute('data-has-content') === 'true';
          if (hasContent !== current) {
            if (hasContent) {
              sendBtn.setAttribute('data-has-content', 'true');
            } else {
              sendBtn.removeAttribute('data-has-content');
            }
          }
        }
      });
    }

    // ------------------------------------------------------------------
    // 宿主锚点注册表（v1.1.26）：皮肤依赖的全部宿主 DOM 锚点集中在一处。
    //  - sel  : 该锚点在运行代码中实际使用的（或更稳健的等价）选择器。
    //           修改代码内选择器时必须同步本表——保证自检探测的就是运行所用。
    //  - tier : required  = 任何视图都应命中，缺失即皮肤大概率整体失效（warn）；
    //           expected  = Hero（新建会话）态应命中，缺失即对应增强不生效（info）；
    //           context   = 仅特定交互路径使用，缺失只记录不告警。
    // 自检入口：启动后 3s 自动跑一次（见 apply 内 healthCheckTimerId）；
    // 控制台可随时 window.__dshUiHealth.check() 重跑，anchors 字段可查全表。
    // ------------------------------------------------------------------
    const HOST_ANCHORS = {
      appFrame:            { sel: '.BynINW_frame, [class*="_frame"]', tier: 'required', note: '应用框架：侧栏状态属性与网格钉扎挂载点' },
      sidebarPanelList:    { sel: '._2H3hWW_panelList, [class*="_panelList"]', tier: 'required', note: '侧栏面板列表：固定栏激活态同步' },
      composerRoot:        { sel: '.RlGAzG_root, [class*="_composer"]', tier: 'required', note: '输入卡根节点：欢迎区发现与底部状态栏' },
      composerCard:        { sel: '.RlGAzG_card, [data-composer-card]', tier: 'expected', note: '输入卡容器：宽度锁定 / 发送按钮三态' },
      composerInput:       { sel: '.RlGAzG_input, [data-composer-input]', tier: 'context', note: '输入编辑器：技能指令插入' },
      composerSend:        { sel: '.RlGAzG_primary, button[aria-label="发送"], button[aria-label="Send"]', tier: 'expected', note: '发送按钮：空态/有内容态同步' },
      composerPlaceholder: { sel: '.RlGAzG_placeholder', tier: 'context', note: '输入卡占位符节点' },
      composerHero:        { sel: '.Dc7zOa_composerHero, [class*="composerHero"]', tier: 'expected', note: '欢迎区容器：E2 宽度锁定' },
      heroWorkspaceRow:    { sel: '.Dc7zOa_heroWorkspaceRow, [class*="heroWorkspaceRow"]', tier: 'expected', note: '工作区行：底部状态栏挂载点' },
      heroHeadline:        { sel: '.Hqq-bq_root, [data-phase="hero"], [data-content-phase="hero"]', tier: 'expected', note: '欢迎区标题：Hero 态判定' },
      workspaceBtn:        { sel: '.Hqq-bq_workspace, button[class*="workspace"]', tier: 'expected', note: '工作区芯片：图标替换与文案' },
      workspaceLabel:      { sel: '.Hqq-bq_workspaceLabel, [class*="workspaceLabel"]', tier: 'context', note: '工作区文案（选择项目）' },
      workspaceFolderIcon: { sel: '.Hqq-bq_folder, [class*="folder"]', tier: 'context', note: '工作区文件夹图标替换' },
      presetSeat:          { sel: '._oGoKq_seat, [class*="seat"]', tier: 'expected', note: '模式芯片：图标替换' },
      presetItem:          { sel: '._oGoKq_item', tier: 'context', note: '模式菜单项：菜单图标增强' },
      menuList:            { sel: '._3tUStW_list, [role="menu"]', tier: 'context', note: '原生菜单样式基座' },
      panelRow:            { sel: '[class*="_panelRow"]', tier: 'expected', note: '侧栏面板行：激活态 DOM 兜底' },
      sidebarCol:          { sel: '[class*="_sidebarCol"]', tier: 'context', note: '宿主侧栏列：抽屉卡片壳挂载点' },
      centerCol:           { sel: '.BynINW_centerCol, [class*="_centerCol"]', tier: 'context', note: '中栏：托管模式圆角压制' },
      sidebarHandle:       { sel: '[class*="_handle"]', tier: 'context', note: '侧栏拖拽手柄：托管期隐藏' },
      settingsArea:        { sel: '[class*="_settingsArea"]', tier: 'expected', note: '侧栏底部设置区：头像镜像 / 账号菜单' },
      footArea:            { sel: '[class*="_footArea"]', tier: 'context', note: '收起态账号触发器容器' },
      sidebarToggle:       { sel: '[class*="_toggle"]', tier: 'context', note: '侧栏开关按钮：toggleSidebar 回退' },
      newSessionBtn:       { sel: '[class*="_newSession"]', tier: 'context', note: '原生新会话按钮：回退点击' },
      usageRoot:           { sel: '[aria-label="打开用量统计面板"], [class*="UcfOsa_root"]', tier: 'context', note: '原生用量按钮：回退点击' },
      buildVersion:        { sel: '[class*="_buildVersion"]', tier: 'context', note: '构建版本号：账号菜单副标题' },
      navCell:             { sel: '[class*="_navCell"], [class*="wCInkW_navCell"]', tier: 'context', note: '设置弹窗导航（插件面板跳转）' },
    };

    // 选择器健康自检（B7 → v1.1.26 全量化）：皮肤深度绑定宿主构建哈希类名，
    // 宿主升级可能导致锚点漂移。自检由上方 HOST_ANCHORS 注册表驱动，覆盖全部
    // 锚点并按 tier 分级报告；结果写入 window.__dshUiHealth（保留旧
    // missingRequired/missingOptional 字段名以兼容既有排查脚本），check() 供
    // 控制台随时重跑。不再使用一次性 selectorHealthDone 门禁——定时调用方
    // 只在启动时触发一次，手动 check() 需要可重复执行。
    function runSelectorHealthCheck() {
      if (typeof document === 'undefined') return null;
      const missing = { required: [], expected: [], context: [] };
      for (const [key, anchor] of Object.entries(HOST_ANCHORS)) {
        let hit = false;
        try { hit = !!document.querySelector(anchor.sel); } catch (e) {}
        if (!hit) missing[anchor.tier].push(key);
      }
      const report = {
        missingRequired: missing.required,
        missingExpected: missing.expected,
        missingContext: missing.context,
        missingOptional: missing.expected, // 兼容 v1.1.25 及之前的字段名
        at: new Date().toISOString(),
      };
      try {
        window.__dshUiHealth = { ...report, check: runSelectorHealthCheck, anchors: HOST_ANCHORS };
      } catch (e) {}
      if (missing.required.length) {
        console.warn('[dsh-ui] 选择器自检：关键锚点未命中（宿主升级可能导致皮肤失效）:', missing.required.join(', '), report);
      } else if (missing.expected.length || missing.context.length) {
        console.info('[dsh-ui] 选择器自检通过（未命中的 expected/context 锚点与当前视图相关，属预期）:', {
          missingExpected: missing.expected,
          missingContext: missing.context,
        });
      } else {
        console.log('[dsh-ui] 选择器自检全部命中');
      }
      return report;
    }

    function scanAndEnhance() {
      ensureStyles();
      ensureRail();
      ensureNavButtons();
      syncSendButtonState();
      // v1.1.37：工作区行搜索入口补位（放最前，免疫后续语句异常）
      ensureWorkspaceSearch();

      // —— 侧栏收起宽度锁定（E2）：与 ChatGPT 桌面版行为对齐——收起侧栏时
      //    内容保持展开态宽度、只重新居中；再展开恢复原宽。
      //    (a) 欢迎区：锁定 .Dc7zOa_composerHero 容器（--dsh-hero-lock-w）；
      //    (b) 会话模式：锁定"消息线程 + 输入卡片"的最低公共祖先列
      //        （运行时发现并打标记类 dsh-conv-lock-target，--dsh-conv-lock-w）。
      //    CSS 按 data-sidebar-collapsed 属性即时收放，不依赖扫描触发。
      //    只在宽度变化时写 localStorage，避免每次扫描产生存储抖动。
      try {
        const frameEl = document.querySelector(NATIVE_FRAME_SEL) || document.querySelector('.BynINW_frame');
        const sidebarCollapsed = !!(frameEl && frameEl.hasAttribute('data-sidebar-collapsed'));
        const inConversation = !!document.querySelector('[data-message-id]');
        const lockRoot = document.documentElement;

        // 清理此前可能被异常压缩/动画过渡期间记录的过窄宽度缓存（健康卡片通常在 600px 以上）
        try {
          const storedHero = parseInt(localStorage.getItem('dsh_hero_lock_w') || '', 10);
          if (storedHero > 0 && storedHero < 600) localStorage.removeItem('dsh_hero_lock_w');
          const currentHeroVal = parseInt(lockRoot.style.getPropertyValue('--dsh-hero-lock-w') || '', 10);
          if (currentHeroVal > 0 && currentHeroVal < 600) lockRoot.style.removeProperty('--dsh-hero-lock-w');

          const storedConv = parseInt(localStorage.getItem('dsh_conv_lock_w') || '', 10);
          if (storedConv > 0 && storedConv < 600) localStorage.removeItem('dsh_conv_lock_w');
          const currentConvVal = parseInt(lockRoot.style.getPropertyValue('--dsh-conv-lock-w') || '', 10);
          if (currentConvVal > 0 && currentConvVal < 600) lockRoot.style.removeProperty('--dsh-conv-lock-w');
        } catch (e) {}

        const isMeasuringAllowed = !sidebarCollapsed && !homeDrawerOpen && !isHostModeActive();

        // (a) 欢迎区（仅在非会话态记录，避免会话里复用同类容器时污染变量）
        if (!inConversation) {
          const heroLockEl = document.querySelector('.Dc7zOa_composerHero, [class*="composerHero"]')
            || document.querySelector('.RlGAzG_card, [data-composer-card]');
          if (heroLockEl && heroLockEl.isConnected) {
            if (isMeasuringAllowed) {
              const w = Math.round(heroLockEl.getBoundingClientRect().width);
              if (w >= 600 && lockRoot.style.getPropertyValue('--dsh-hero-lock-w') !== w + 'px') {
                lockRoot.style.setProperty('--dsh-hero-lock-w', w + 'px');
                try { localStorage.setItem('dsh_hero_lock_w', String(w)); } catch (e) {}
              }
            } else if (!lockRoot.style.getPropertyValue('--dsh-hero-lock-w')) {
              // 冷启动即收起态：先用上次会话记录的宽度校准（仅接受健康有效值）
              const stored = parseInt(localStorage.getItem('dsh_hero_lock_w') || '', 10);
              if (stored >= 600) lockRoot.style.setProperty('--dsh-hero-lock-w', stored + 'px');
            }
          }
        }

        // (b) 会话模式：输入卡片与消息的最低公共祖先（LCA），打标记类交由 CSS 收放
        let convLca = null;
        if (inConversation) {
          const convCard = document.querySelector('.RlGAzG_card, [data-composer-card]');
          const convMsg = document.querySelector('[data-message-id]');
          if (convCard && convMsg) {
            const chain = new Set();
            let a = convCard.parentElement;
            while (a && a !== document.body) { chain.add(a); a = a.parentElement; }
            let b = convMsg.parentElement;
            while (b && b !== document.body) {
              if (chain.has(b)) { convLca = b; break; }
              b = b.parentElement;
            }
          }
        }
        // 标记迁移：发现新目标时迁移标记；瞬时未发现（流式渲染中段等）保留旧标记
        if (convLca && convLockTarget !== convLca) {
          if (convLockTarget) convLockTarget.classList.remove('dsh-conv-lock-target');
          convLca.classList.add('dsh-conv-lock-target');
          convLockTarget = convLca;
        }
        if (convLockTarget && convLockTarget.isConnected) {
          if (isMeasuringAllowed) {
            const w = Math.round(convLockTarget.getBoundingClientRect().width);
            if (w >= 600 && lockRoot.style.getPropertyValue('--dsh-conv-lock-w') !== w + 'px') {
              lockRoot.style.setProperty('--dsh-conv-lock-w', w + 'px');
              try { localStorage.setItem('dsh_conv_lock_w', String(w)); } catch (e) {}
            }
          } else if (!lockRoot.style.getPropertyValue('--dsh-conv-lock-w')) {
            const stored = parseInt(localStorage.getItem('dsh_conv_lock_w') || '', 10);
            if (stored >= 600) lockRoot.style.setProperty('--dsh-conv-lock-w', stored + 'px');
          }
        }
      } catch (e) { dbg('sidebar width lock failed', e); }

      // 0. Check whether we are in Hero mode (创建新对话) or Conversation mode (正在对话)
      const wsRow = document.querySelector('.Dc7zOa_heroWorkspaceRow, [class*="heroWorkspaceRow"]');
      const composerHero = document.querySelector('.Dc7zOa_composerHero, [class*="composerHero"]');
      // Existence-only probes, one query each. hasHeroMarker covers both the headline and
      // the phase marker; its truthiness equals the previous three separate queries OR'd.
      // hasChatMessages intentionally keys on the host's own message marker ONLY: a
      // [class*="bubble"] heuristic here made the hero state flip whenever ANY third-party
      // widget (whale mascot bubbles, skins, tooltips) showed a bubble-classed element,
      // removing and re-adding the bottom bar — visible as page-wide jitter on new chats.
      const hasHeroMarker = !!document.querySelector('.Hqq-bq_root, [data-phase="hero"], [data-content-phase="hero"]');
      const hasChatMessages = !!document.querySelector('[data-message-id]');

      const isHeroState = !hasChatMessages && !!(wsRow || composerHero || hasHeroMarker);

      if (!isHeroState) {
        // Active conversation mode: remove lingering bottom bar and close popovers
        document.querySelectorAll('.dsh-ag-bottom-bar').forEach(b => b.remove());
        closePopover();
      } else {
        // Hero mode (创建新对话): attach bottom bar to hero container
        let heroContainer = wsRow ? wsRow.parentElement : composerHero;
        if (!heroContainer) {
          const inputCard = document.querySelector('.RlGAzG_root');
          if (inputCard && inputCard.parentElement) {
            heroContainer = inputCard.parentElement;
          }
        }
        if (heroContainer) {
          attachBottomBar(heroContainer);
        }
      }

      // Ensure NO orphan skill or plugin chip ever exists outside the bottom bar
      document.querySelectorAll('.dsh-ag-skill-chip, .dsh-ag-plugin-chip').forEach(chip => {
        if (!chip.closest('.dsh-ag-bottom-bar')) {
          chip.remove();
        }
      });

      // 2. Enhance top-left workspace row (工作区选择 + 标准模式 仅这两个按钮)
      const rows = document.querySelectorAll('.Dc7zOa_heroWorkspaceRow, [class*="heroWorkspaceRow"]');
      rows.forEach(row => {
        // Strip any accidental stray chips from workspace row
        row.querySelectorAll('.dsh-ag-skill-chip, .dsh-ag-plugin-chip').forEach(c => c.remove());

        sanitizeWorkspaceLabel(row);
        replaceWorkspaceFolderIcon(row);
        replaceModeIcon(row);
      });

      // 图标替换限定在会话区域内（旧版每次扫描都对 document 全量跑
      // [class*=] 子串选择器，长会话大 DOM 下成本高）；区域缺失时回退
      // document 保持原行为。
      const iconScanScope = (wsRow && wsRow.closest('[data-conversation-region]'))
        || (composerHero && composerHero.closest('[data-conversation-region]'))
        || document;
      replaceAllWorkspaceIcons(iconScanScope);
      replaceAllModeIcons(iconScanScope);

      if (document.querySelector('._3tUStW_list, [role="menu"]')) {
        enhancePresetMenuItems();
      }
    }

    // --- Leading-edge rAF scan scheduler ---
    // Fires on the NEXT animation frame after a DOM mutation (~16ms response time)
    // Observer disconnect/reconnect during scan prevents self-triggered mutation loops.
    // Trailing safety timer (80ms) catches late mutations during the disconnect window.
    let scanRafId = null;
    let trailingScanTimer = null;
    let mutationObserver = null;
    let healthCheckTimerId = null;
    const TRAILING_SCAN_MS = 80;

    function scheduleScan() {
      // 后台标签页不扫描（后台 rAF 本来就被节流，显式跳过省一次定时器
      // 噪音与无效 DOM 遍历）；回到前台时由 visibilitychange 补扫。
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!scanRafId) {
        scanRafId = requestAnimationFrame(() => {
          scanRafId = null;
          executeScan();
        });
      }
      if (trailingScanTimer) clearTimeout(trailingScanTimer);
      trailingScanTimer = setTimeout(() => {
        trailingScanTimer = null;
        if (!scanRafId) {
          scanRafId = requestAnimationFrame(() => {
            scanRafId = null;
            executeScan();
          });
        }
      }, TRAILING_SCAN_MS);
    }

    function executeScan() {
      if (mutationObserver) mutationObserver.disconnect();
      try {
        scanAndEnhance();
      } catch (e) {}
      if (mutationObserver) {
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    function scheduleImmediateScan() {
      if (scanRafId) return;
      scanRafId = requestAnimationFrame(() => {
        scanRafId = null;
        executeScan();
      });
    }

    /* ---- 合并模块定义：把多个 {inject, apply} 客户端定义合并为一个 ----
     * inject 取并集（fiber 的服务门按声明放行）；apply 按声明顺序执行。
     * 两套逻辑共享同一个 fiber：任一 apply 抛错都会让本次加载失败（与单
     * 插件崩溃语义一致），但已注册的 effect 仍随 fiber dispose 正确回收。 */
    function mergeClientDefs(defs) {
      const inject = [...new Set(
        defs.flatMap((def) => (Array.isArray(def && def.inject) ? def.inject : [])),
      )];
      return {
        inject,
        apply(ctx) {
          for (const def of defs) {
            if (def && typeof def.apply === 'function') def.apply(ctx);
          }
        },
      };
    }

    const dshUiDef = {
      inject: ['slots', 'layout', 'uiWorkspace'],
      apply(ctx) {
        dshCtx = ctx;
        ensureStyles();

        // 订阅全局面板切换，实时同步固定栏激活态
        try {
          const layout = dshCtx && (dshCtx.layout || (typeof dshCtx.get === 'function' ? dshCtx.get('layout') : null));
          if (layout && layout.panelInfo && typeof layout.panelInfo.subscribe === 'function') {
            const unsubRailPanel = layout.panelInfo.subscribe(() => syncRailActive());
            if (typeof unsubRailPanel === 'function') railPanelUnsubscribe = unsubRailPanel;
          }
        } catch (e) { dbg('panelInfo.subscribe failed', e); }

        // 注册「用量统计」独立主面板（中央整页，与插件/定时任务面板同机制）
        try {
          if (ctx.slots && typeof ctx.slots.inject === 'function') {
            ctx.slots.inject('main', () => ctx.slots.register({
              name: 'main',
              key: 'usage',
              inject: () => ({})
            }, RailUsagePanelPage));
          }
        } catch (e) { dbg('slots.inject(usage) failed', e); }

        // Warm live skills and plugins catalog
        fetchLiveSkills().catch(() => {});
        fetchLivePlugins().catch(() => {});

        // Attach dynamic reactive input listeners for send button (throttled)
        const inputHandler = throttledSyncSendButton;
        const onVisibilityChange = () => {
          if (typeof document !== 'undefined' && !document.hidden) scheduleImmediateScan();
        };
        if (typeof document !== 'undefined') {
          document.addEventListener('input', inputHandler, true);
          document.addEventListener('compositionend', inputHandler, true);
          document.addEventListener('keyup', inputHandler, true);
          document.addEventListener('paste', inputHandler, true);
          document.addEventListener('visibilitychange', onVisibilityChange);
        }

        // Run initial scan immediately
        scheduleImmediateScan();
        // 选择器健康自检：启动 3s 后执行一次（等首帧渲染完成）
        healthCheckTimerId = setTimeout(runSelectorHealthCheck, 3000);
        // 头像诊断窗口：启动后 90 秒内随扫描每 5 秒落盘一次真实 DOM/样式
        avatarDumpDeadline = Date.now() + AVATAR_DUMP_WINDOW_MS;
        setTimeout(dumpAvatarDiagnostics, 4000);
        // 后台帧节流时 rAF 可能延迟，先直接挂载固定栏与导航按钮（body 未就绪时内部会跳过）
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            ensureStyles();
            ensureRail();
            ensureNavButtons();
          }, { once: true });
        } else {
          ensureRail();
          ensureNavButtons();
        }

        // Observe DOM for workspace row updates (e.g. navigation, new sessions)
        if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
          mutationObserver = new MutationObserver(() => {
            scheduleScan();
          });
          mutationObserver.observe(document.body, { childList: true, subtree: true });

          ctx.on?.('dispose', () => {
            if (trailingScanTimer) { clearTimeout(trailingScanTimer); trailingScanTimer = null; }
            if (healthCheckTimerId) { clearTimeout(healthCheckTimerId); healthCheckTimerId = null; }
            if (scanRafId) { cancelAnimationFrame(scanRafId); scanRafId = null; }
            if (syncRafId) { cancelAnimationFrame(syncRafId); syncRafId = null; }
            if (enhancePresetRafId) { cancelAnimationFrame(enhancePresetRafId); enhancePresetRafId = null; }
            if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
            closePopover();
            closeExecPopover();
            teardownRail();
            teardownNavButtons();
            document.removeEventListener('input', inputHandler, true);
            document.removeEventListener('compositionend', inputHandler, true);
            document.removeEventListener('keyup', inputHandler, true);
            document.removeEventListener('paste', inputHandler, true);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            const el = document.getElementById(STYLE_TAG_ID);
            if (el) el.remove();
          });
        }
      }
    };

    // ===== 合并内联标记：build.mjs 在此插入 client-model-strength.js 的
    // buildModelStrengthDef 定义（原 @local/model-strength-picker 客户端体）=====
/*!
 * Model Strength Picker —— 原 @local/model-strength-picker 客户端模块源文件。
 *
 * 2026-10-20 起 @local/model-strength-picker 与 @local/dsh-ui 合并为单一插件：
 * 本文件是原插件 client.js 的 factory 体（内容未改动，仅去掉
 * window.__ModuleLoader__.load 包装、改为导出定义构造器），由 build.mjs 在
 * client-app.js 的 __DSH_MERGE:model-strength-picker__ 标记处内联进单一
 * client.js 产物。PKG_ID 等标识保留原值，样式与插槽 id 不变。
 *
 * 修改后运行 `node build.mjs` 重新生成 client.js。
 */
const buildModelStrengthDef = (require) => {
    const React = require('react');
    const h = React.createElement;
    const { createPortal } = require('react-dom');

    const PKG_ID = '@local/model-strength-picker';
    const PLUGIN_VERSION = '0.10.1';
    const LLM_NS = 'llm-pi-ai';
    const SEAT = 'conversation.input.model';
    const FOOTER = 'settings.models.footer';
    /* Every reasoning level the llm-pi-ai schema accepts, in escalation order.
       This is the VALIDATION and PRESERVATION set: a level named here is never
       dropped from a model entry. */
    const CANONICAL = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    /* Levels that stay schema-valid but are no longer OFFERED by the editor:
       they cannot be ticked, auto-declared, or chosen as a route default. An
       existing declaration keeps them (see writeLlmLevels), so retiring a chip
       never deletes somebody's working configuration. */
    const RETIRED_LEVELS = ['xhigh'];
    /* What the level editor actually renders, and what auto-declare may write. */
    const OFFERED_LEVELS = CANONICAL.filter((id) => !RETIRED_LEVELS.includes(id));
    /* Every reasoning-dispatch wire format `llm-pi-ai` accepts for a model's
       `compat.thinkingFormat`. Kept in full so a value this editor did not
       choose is offered back verbatim instead of being flattened to a default
       the save would then write over the file. */
    const THINKING_FORMATS = [
      'openai', 'deepseek', 'openrouter', 'together', 'baseten', 'zai',
      'qwen', 'chat-template', 'qwen-chat-template', 'string-thinking', 'ant-ling',
    ];
    const THINKING_FORMAT_LABELS = {
      openai: 'OpenAI（reasoning_effort）',
      deepseek: 'DeepSeek 兼容（thinking 开关）',
      openrouter: 'OpenRouter',
      together: 'Together',
      baseten: 'Baseten',
      zai: 'Z.ai（GLM）',
      qwen: 'Qwen',
      'chat-template': 'Chat template',
      'qwen-chat-template': 'Qwen chat template',
      'string-thinking': 'string thinking',
      'ant-ling': 'Ant Ling',
    };
    const CARD_W = 290;
    /* Slider geometry, shared by the component, its maths and the stylesheet:
       a 23px track with a 30px knob (1.3x the track, so it oversails it by
       3.5px top and bottom, per the reference design). */
    const TRACK_H = 23;
    const THUMB = 30;
    /* How long the knob takes to slide between two tick points. The LEVEL
       applies immediately — only the paint lags by this much. */
    const TWEEN_MS = 120;

    /* ---- Hover 反馈（仅鼠标）的规格常数。触屏不触发：所有悬停处理器检查
       `pointerType === 'mouse'`，touch / pen 一律忽略。几何变化一律由 JS 数值
       补间写 SVG 属性（r / opacity，见 EffortSlider 里的 tweenSvgAttr），不用
       CSS transform 缩放几何，也不给几何属性挂 CSS transition —— cx / width
       由位置补间的 rAF 驱动，误加 transition 会变成双重动画（README 有记）。 */
    const DOT_R = 3;
    const DOT_R_HOVER = 4.5;
    const DOT_HIT_R = 8;                    // 命中区比 3px 的可见点大得多，悬停才够得着
    const DOT_COVERED_OP = 0.4;             // 填充下半透明白点的常态 opacity
    const DOT_COVERED_OP_HOVER = 0.75;      // 同上，悬停时
    const HOVER_TWEEN_MS = 100;             // 刻度点 r / opacity 补间时长
    const KNOB_R = THUMB / 2;               // 15
    const KNOB_R_HOVER = 16.5;
    /* 命中区半径 ≥ 悬停视觉半径：指针停在视觉边缘时不会陷入「放大→出界→缩回」
       的抖动循环。 */
    const KNOB_HIT_R = KNOB_R_HOVER + 0.5;  // 17
    const KNOB_HOVER_MS = 120;              // 旋钮 r 补间；投影走 CSS filter 过渡，同为 120ms
    const DOT_GREY_FILL = 'var(--dsw-alias-border-l3)';
    /* 悬停深灰：比点基色 l3 高一档（旋钮描边同款），随主题自适应。 */
    const DOT_HOVER_FILL = 'var(--dsw-alias-border-l2)';

    const labelOf = (id) => id === 'xhigh' ? 'X-High'
      : id ? id.charAt(0).toUpperCase() + id.slice(1) : '';
    const isMaxEffort = (id) => typeof id === 'string' && id.toLowerCase() === 'max';
    /* Group ranking mirrors the built-in picker: the account route first,
       the official route second, everything else after, in catalog order. */
    const groupRank = (id) => (id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2);
    function sortedGroups(groups) {
      return groups
        .map((g, i) => ({ g, i }))
        .sort((a, b) => (groupRank(a.g.id) - groupRank(b.g.id)) || (a.i - b.i))
        .map((row) => row.g);
    }
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const clamp01 = (v) => clamp(v, 0, 1);
    const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const errorText = (error) => error && error.message ? error.message : String(error);

    /* Unwrap a client RemoteResult ({ok, value, error}) into a value or a throw.
       The thrown Error carries the remote failure's machine `code` on a
       property, so callers classify by code instead of by message text: the
       Host's conflict message is "settings namespace ... changed since it was
       read" and never contains the word "conflict" — only the code does. */
    async function callRemote(make) {
      const result = await make();
      if (!result || typeof result !== 'object' || !('ok' in result)) {
        throw new Error('远程调用返回了意外的结果');
      }
      if (!result.ok) {
        const e = result.error || {};
        const error = new Error(`${e.code || 'remote'}: ${e.message || '调用失败'}`);
        if (e.code) error.code = e.code;
        throw error;
      }
      return result.value;
    }

    /* A stale settings revision. The Host reports it as `settings/conflict`;
       message matching stays as a fallback for a Host that reports the code
       only inside the text. */
    const isConflict = (error) => {
      const code = error && error.code;
      if (code === 'settings/conflict' || code === 'SETTINGS_CONFLICT') return true;
      return /conflict/i.test(errorText(error));
    };

    /* Colors are host theme tokens (the blue slider is the mockup's one
       exception); surfaces, radii, sizes and motion follow the mockup card. */
    const STYLE_CSS = `
.msp-root { min-width: 0; --msp-level-max-color: #924ff7; }

/* ----- trigger: the built-in 28px chip in the composer tool row ----- */
.msp-trigger {
  box-sizing: border-box;
  display: flex; align-items: center; gap: 4px;
  min-width: 0;
  max-width: 220px;
  max-width: min(360px, 45cqw);
  height: 28px;
  padding: 0 4px 0 8px;
  border: none; outline: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 400;
  cursor: pointer;
}
.msp-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.msp-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
.msp-trigger:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.msp-trigger-icon { display: var(--dsh-composer-model-icon-display, none); flex: 0 0 auto; }
.msp-trigger-label {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.msp-trigger-effort {
  display: var(--dsh-composer-model-text-display, block);
  flex-shrink: 1000;
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-caption);
  transition: color 150ms;
}
.msp-trigger-effort.max { color: var(--msp-level-max-color, #924ff7); }
.msp-trigger-chevron { flex: 0 0 auto; color: var(--dsw-alias-label-caption); transition: transform 120ms ease; }
.msp-trigger.open .msp-trigger-chevron { transform: rotate(180deg); }

/* ----- popover: fixed anchor sized to the docked composer (92px tall,
   290px wide — the mockup card's ~3.14:1 ratio). All inner dimensions are
   FINAL visual values (no CSS zoom: the desktop shell does not apply it,
   which made every card render oversized there). ----- */
.msp-pop {
  position: fixed; z-index: 1100;
  width: 290px; max-width: calc(100vw - 24px);
}
.msp-card {
  position: relative;
  box-sizing: border-box;
  width: 290px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  border-radius: 18px;
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  padding: 11px 18px;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  /* The mockup's slider blue — the one deliberate non-token color. */
  --msp-slider-fill: #2f6fed;
  --msp-slider-fill-deep: #1d4ed8;
  /* ---- Max 档星空动效：颜色全部走变量，便于主题化 ---- */
  --max-fx-fade: 250ms;
  /* 1 渐变底：左→右 0% / 34% / 62% / 100%，右端是亮堇紫，不是深紫 */
  --max-grad-stop-1: var(--msp-slider-fill, #2f6fed);
  --max-grad-stop-2: #5a4bf0;
  --max-grad-stop-3: #7c3ff0;
  --max-grad-stop-4: #8b5cf6;
  /* 2 星云光斑：白核 → 淡紫 → 透明 */
  --max-nebula-core: rgba(255, 255, 255, 0.75);
  --max-nebula-mid: rgba(200, 180, 255, 0.45);
  /* 3 星点 */
  --max-star-fill: #ffffff;
  --max-star-glow: rgba(255, 255, 255, 0.7);
  /* 4 旋钮光晕 */
  --max-knob-halo: rgba(255, 255, 255, 0.9);
  /* 渐变呼吸的扫光带峰值不透明度 */
  --max-sweep-opacity: 0.22;
  /* 到达迸发的小点 */
  --max-burst-a: #a78bfa;
  --max-burst-b: #c4b5fd;
  --msp-level-max-color: #924ff7;
}
@media (prefers-color-scheme: dark) {
  .msp-card {
    --max-grad-stop-4: #6d3df0;
    --max-sweep-opacity: 0.11;
  }
}

/* ----- top pill (level + model + ›); the dropdown anchors to the card ----- */
.msp-top { position: static; }
.msp-pill-btn {
  display: block; width: 100%;
  border: 0; background: none; padding: 0;
  font: inherit; cursor: pointer; touch-action: none;
}
.msp-pill {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 5px 22px; border-radius: 14px;
  background: transparent;
  transition: background 150ms;
}
.msp-pill-btn:active .msp-pill, .msp-pill-btn.pressed .msp-pill {
  background: var(--dsw-alias-interactive-bg-hover);
  transition: none;
}
.msp-pill-level {
  font-size: 13.5px; font-weight: 700;
  /* Level names share the slider fill blue; Off keeps the muted grey; Max gets purple. */
  color: var(--msp-slider-fill, var(--dsw-alias-brand-primary));
  transition: opacity 150ms, color 150ms;
}
.msp-pill-level.fading { opacity: 0; }
.msp-pill-level.off { color: var(--dsw-alias-label-tertiary); }
.msp-pill-level.max { color: var(--msp-level-max-color, #924ff7); }
.msp-pill-model { font-size: 13.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.msp-pill-arrow { color: var(--dsw-alias-label-tertiary); }

/* ----- dropdown: its BOTTOM edge is flush with the strength panel's bottom
   edge (the card's), so it grows upward from there and covers the card while
   open. Height is FIXED at twice the strength card's height (200% of it); the
   screen cap is the only thing that ever shrinks it, so the placer can always
   keep the whole thing visible. Rows that do not fit scroll.
   The .down modifier is the new-session hero only: there the card hangs below
   the composer, so growing upward would cover the composer.
   NOTE: this is a template literal - never use a backtick in here. ----- */
.msp-dd {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 30;
  display: flex; flex-direction: column;
  height: 200%;
  max-height: calc(100vh - 24px);
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  border-radius: 18px;
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  padding: 9px 0 7px;
  opacity: 0; visibility: hidden;
  transition: opacity 150ms, visibility 150ms;
}
.msp-dd.down { top: 0; bottom: auto; }
.msp-dd.open { opacity: 1; visibility: visible; }
/* Headings carry the same half-spacing as the rows, or with a few provider
   groups they would eat most of the fixed height before any model shows. */
.msp-dd-title { flex: 0 0 auto; font-size: 11px; color: var(--dsw-alias-label-tertiary); padding: 1px 18px 3px; }
/* The list is the only scrollable part: it fills whatever the dropdown's fixed
   height leaves it, and only shows a bar once the rows exceed that. */
.msp-dd-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.msp-option {
  position: relative;
  display: flex; align-items: center;
  width: 100%; height: 30px; padding: 0 18px;
  border: 0; background: none; outline: none;
  font: inherit; font-size: 13.5px; color: var(--dsw-alias-label-primary);
  text-align: left; cursor: pointer; touch-action: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msp-option:active, .msp-option.pressed { background: var(--dsw-alias-interactive-bg-hover); }
.msp-option .msp-check {
  position: absolute; right: 18px;
  color: var(--dsw-alias-label-primary); font-size: 13px;
}
.msp-failure {
  padding: 6px 18px; font-size: 11px;
  color: var(--dsw-alias-state-error-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ----- strength slider: all geometry lives in SVG (see EffortSlider) -----
   Nothing here shapes a box: no border-radius, clip-path, transform or
   percentage width takes part in the track, the fill, the level dots or the
   knob. The desktop shell painted those CSS constructs as square dots and a
   squircle knob while an isolated page rendered them correctly, so the
   geometry was moved into SVG where every renderer must agree. */
.msp-pop-slider { margin-top: 7px; }
.msp-slider {
  position: relative; height: 30px; cursor: pointer;
  touch-action: none; outline: none;
}
.msp-slider.disabled { cursor: default; opacity: 0.6; }
.msp-svg { display: block; overflow: visible; }
.msp-svg-track { fill: var(--dsw-alias-interactive-bg-hover); }
.msp-svg-fill { fill: var(--msp-slider-fill, var(--dsw-alias-brand-primary)); }
.msp-svg-thumb { fill: var(--dsw-alias-bg-layer-1, #ffffff); }
.msp-svg-thumb-ring {
  fill: none;
  stroke: var(--dsw-alias-border-l2);
  stroke-width: 1;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.22));
  /* 投影只过渡 filter（非几何属性）。绝不给 cx / width / r 挂 transition：
     位置 cx 由 rAF 补间驱动，r / opacity 由 hover 的 JS 补间驱动。 */
  transition: filter 120ms ease;
}
.msp-slider:focus-visible .msp-svg-thumb-ring {
  stroke: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  stroke-width: 2;
}
/* 悬停投影：必须放在 dragging 规则之前——按住旋钮拖动时两态叠加，同为
   (0,3,0) 特异性靠源顺序让 dragging 的最深投影胜出。 */
.msp-slider.knob-hover .msp-svg-thumb-ring {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.28));
}
.msp-slider.dragging .msp-svg-thumb-ring {
  filter: drop-shadow(0 2px 7px rgba(0, 0, 0, 0.32));
}

/* ----- hover 反馈（仅鼠标；JS 侧按 pointerType 过滤，触屏不会触发） -----
   旋钮 r 15→16.5 由 JS 补间（120ms），这里只管光标与投影深浅（投影规则见上，
   悬停态在 dragging 之前）。 */
.msp-slider.knob-hover:not(.disabled) { cursor: grab; }
.msp-slider.dragging:not(.disabled) { cursor: grabbing; }

/* 悬停刻度点浮出的档位名小标签：纯 HTML，不属于滑块几何（translateX 只做
   水平居中），pointer-events: none，不拦任何指针事件。 */
.msp-dot-tip {
  position: absolute; top: -27px; z-index: 5;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--dsw-alias-label-primary, #1f2329);
  color: var(--dsw-alias-bg-layer-1, #ffffff);
  font-size: 11px; line-height: 16px; white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  opacity: 0;
  transition: opacity 100ms ease;
  pointer-events: none;
}
.msp-dot-tip.on { opacity: 1; }

/* ----- Max 档专属星空动效 -----
   静态分层自下而上：渐变底 → 星云 ×2 → 星点 ×28 → 高光 ×2；旋钮光晕在旋钮上。
   四层都在最高档才出现，250ms 一起淡入（视觉上即「整组淡入」）。每层各自带
   opacity 而不是整组一个，是为了让将来某层想单独提前或延后时不必再拆结构。 */
.msp-max-fx {
  pointer-events: none;
}
.msp-max-base,
.msp-nebula-layer,
.msp-max-stars,
.msp-max-sweep-layer {
  opacity: 0;
  transition: opacity var(--max-fx-fade, 250ms) ease;
}
/* 四层一起在 Max 档到齐：渐变底、星云 ×2、星点 ×28、高光 ×2。 */
.msp-slider.level-max .msp-max-base,
.msp-slider.level-max .msp-nebula-layer,
.msp-slider.level-max .msp-max-stars,
.msp-slider.level-max .msp-max-sweep-layer {
  opacity: 1;
}
/* The starfield is rendered at every level above Off but only VISIBLE at Max,
   and a child's animation keeps running no matter what the parent's opacity
   is — so leaving it alone burned ~34 infinite animations on an invisible
   layer. Freezing them costs nothing visually and the phase is preserved,
   which is why the sweep carries a negative delay (see .msp-max-sweep). */
.msp-slider:not(.level-max) .msp-max-fx * {
  animation-play-state: paused;
}
/* Max 档星空接管轨道：灰轨道刻度点与填充下的白点一起淡出（250ms 与整组
   特效同步进退）；离开 Max 时同步淡入回来。悬停提示与点击跳档不受影响。 */
.msp-slider.level-max .msp-svg-dots,
.msp-slider.level-max .msp-svg-dots-on {
  opacity: 0;
  transition: opacity var(--max-fx-fade, 250ms);
}
.msp-svg-dots,
.msp-svg-dots-on {
  transition: opacity var(--max-fx-fade, 250ms);
}
.msp-nebula-1 {
  animation: mspNebula1 9s ease-in-out infinite alternate;
}
.msp-nebula-2 {
  animation: mspNebula2 12s ease-in-out infinite alternate;
}
@keyframes mspNebula1 {
  0% { transform: translateX(-18px); }
  100% { transform: translateX(22px); }
}
@keyframes mspNebula2 {
  0% { transform: translateX(16px); }
  100% { transform: translateX(-20px); }
}
.msp-max-stars {
  animation: mspStarsDrift 16s ease-in-out infinite alternate;
}
@keyframes mspStarsDrift {
  0% { transform: translateX(-5px); }
  100% { transform: translateX(5px); }
}
.msp-star {
  animation-name: mspStarTwinkle;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
@keyframes mspStarTwinkle {
  0% { opacity: var(--star-min-op, 0.3); }
  100% { opacity: var(--star-max-op, 0.85); }
}
/* 3–4 颗稍大的星点带一圈柔光（规格指定 drop-shadow 0 0 2px）。走 CSS 而非
   SVG filter 属性，变量才好主题化，也和旋钮光晕的写法一致。 */
.msp-star.glow {
  filter: drop-shadow(0 0 2px var(--max-star-glow, rgba(255, 255, 255, 0.7)));
}
.msp-max-sweep {
  animation: mspSweep 7s linear infinite;
  /* Its keyframes hold the band off-screen for the first 55%, so a frozen
     animation resumed from 0 would show nothing for ~3.9s. Parking it just
     past that mark makes the band enter about a second after Max is reached —
     the same thing the always-running version produced. */
  animation-delay: -3.9s;
}
/* 两条高光相位错开半个周期，交替进场；各自的渐变两端都是透明的，平移时不会
   露出硬边。 */
.msp-max-sweep.second {
  animation-delay: -0.4s;
}
@keyframes mspSweep {
  0%, 55% {
    transform: translateX(-160%) skewX(-12deg);
    opacity: 0;
  }
  56% {
    opacity: 1;
  }
  100% {
    transform: translateX(360%) skewX(-12deg);
    opacity: 1;
  }
}
/* 4 旋钮光晕：最高档时白旋钮外一圈柔光 */
.msp-svg-thumb.halo {
  filter: drop-shadow(0 0 6px var(--max-knob-halo, rgba(255, 255, 255, 0.9)));
  transition: filter var(--max-fx-fade, 250ms) ease;
}
/* 到达迸发：旋钮落到最高档的一瞬，一次性从旋钮边缘迸出淡紫色小点，向外
   （偏上、偏右）飞散后减速、淡出并缩小。整组不参与命中：小点从旋钮上起飞，
   若可命中会在起飞瞬间盖住旋钮命中区，把悬停态抖掉。 */
.msp-burst { pointer-events: none; }
.msp-burst-dot {
  animation-name: mspBurst;
  animation-timing-function: cubic-bezier(0.15, 0.75, 0.3, 1);
  animation-fill-mode: forwards;
}
@keyframes mspBurst {
  0% { transform: translate(0, 0) scale(1); opacity: var(--burst-op, 1); }
  55% { opacity: var(--burst-op, 1); }
  100% { transform: translate(var(--burst-x, 0), var(--burst-y, 0)) scale(0.2); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .msp-nebula-1, .msp-nebula-2, .msp-max-stars, .msp-star, .msp-max-sweep, .msp-burst-dot {
    animation: none !important;
  }
  /* The sweep's position AND opacity live only in its keyframes, so with the
     animation switched off it fell back to x=0 at full opacity: a solid band
     parked over the left third of the track. A sweep that cannot sweep has
     nothing to show, so it is dropped instead of frozen. */
  .msp-max-sweep,
  .msp-burst {
    display: none;
  }
  /* 规格：减弱动效下只保留静态渐变 —— 星云与星点一并隐去，只留渐变底与
     旋钮光晕这两层完全静止的图形。 */
  .msp-nebula-layer,
  .msp-max-stars {
    display: none;
  }
}
.msp-hint { margin-top: 9px; font-size: 11px; color: var(--dsw-alias-label-tertiary); line-height: 1.5; }
.msp-error {
  margin-top: 8px; padding: 6px 7px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-state-error-primary);
  font-size: 10px; line-height: 15px;
}

/* ----- settings card (Settings → 模型, page footer): theme tokens only ----- */
.msp-settings {
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2));
  border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l4));
  border-radius: 12px;
  padding: 14px 16px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
.msp-settings-title { font-size: 14px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.msp-default { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dsw-alias-border-l4); }
/* 路由默认：每路由一行（名称 + 默认下拉），一键统一为底部的次级行 */
.msp-route-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 6px 0; }
.msp-route-row + .msp-route-row { border-top: 1px solid var(--dsw-alias-border-l4); }
.msp-route-row .msp-confirm { flex: 1 1 100%; }
.msp-route-name {
  flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px; color: var(--dsw-alias-label-primary);
}
.msp-route-default { display: flex; align-items: center; flex: 0 0 auto; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.msp-route-default select, .msp-unify-row select {
  font: inherit; font-size: 12px; color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; background: transparent; padding: 2px 6px;
}
.msp-unify-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--dsw-alias-border-l4);
  font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.msp-settings-hint { margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.msp-rows { margin-top: 10px; }
/* The read-only models get one line, not one row each: they cannot be edited
   here, so a row per model would be pure noise. The full list is on the
   element's title. */
.msp-readonly {
  margin-top: 10px; padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l4);
  font-size: 11px; line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msp-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--dsw-alias-border-l4); }
/* 批量统一编辑：行首勾选框 + 列表顶部的选择工具条 */
.msp-row-check { flex: 0 0 auto; width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.msp-batch-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 6px 0 2px;
  font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.msp-batch-hint { color: var(--dsw-alias-label-tertiary); }
.msp-batch-title { font-size: 12.5px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.msp-row-head { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.msp-row-name {
  font-weight: 600; font-size: 13px; color: var(--dsw-alias-label-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msp-row-group { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.msp-levels { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-start; flex: 1 1 auto; min-width: 0; }
.msp-row-notice { flex: 0 0 auto; font-size: 11px; color: var(--dsw-alias-state-business-primary); }
.msp-level-tag {
  font-size: 11px; padding: 1px 8px; border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.msp-level-tag.none {
  color: var(--dsw-alias-label-tertiary);
  background: transparent; border: 1px dashed var(--dsw-alias-border-l3);
}
/* 目录未宣告的档位：琥珀色虚线框，与「未声明」的灰虚线区分开 */
.msp-level-tag.warn {
  color: var(--dsw-alias-state-warning-primary, #d97706);
  background: transparent; border: 1px dashed var(--dsw-alias-state-warning-primary, #d97706);
}
.msp-row-editor { padding: 4px 0 8px; border-top: 1px solid var(--dsw-alias-border-l4); }
.msp-row-editor .msp-editor { margin-top: 0; padding-top: 4px; }
.msp-editor { margin-top: 10px; }
.msp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
/* The level editor lays each level out with its wire-value input directly
   under the chip, so the chip row never fights the inputs for one line. */
.msp-chip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px 8px; }
.msp-chip-cell { display: flex; flex-direction: column; align-items: stretch; gap: 4px; min-width: 0; }
.msp-chip-cell .msp-chip { width: 100%; }
.msp-wire-input {
  box-sizing: border-box; width: 100%; min-width: 0;
  font: inherit; font-size: 11px; font-family: inherit;
  color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l3); border-radius: 6px;
  background: transparent; padding: 2px 6px;
}
.msp-wire-input:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); }
/* A wire value that differs from the level id is the one thing a save can
   silently lose, so it is called out in the row's own purple. */
.msp-wire-input.custom { border-color: var(--msp-level-max-color, #924ff7); color: var(--msp-level-max-color, #924ff7); }
/* 线级值重复：错误红（保存会被拦），盖过 custom 的紫 */
.msp-wire-input.dup { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.msp-confirm {
  margin-top: 10px; padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l3); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.msp-confirm-title { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.msp-confirm-body { margin-top: 6px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.msp-confirm-list { margin: 4px 0 6px; padding-left: 18px; }
.msp-confirm-list li { margin: 2px 0; }
.msp-chip {
  border: 1px solid var(--dsw-alias-border-l3); background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 999px; padding: 3px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.msp-chip.on {
  background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-layer-1);
}
.msp-editor-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 10px; font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.msp-editor-row select {
  font: inherit; font-size: 12px; color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; background: transparent; padding: 2px 6px;
}
.msp-editor-hint { margin-top: 8px; font-size: 11px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
/* 需要用户注意的提示（目录未宣告 / 线级值重复）：琥珀色，错误仍走 .msp-error */
.msp-editor-hint.warn { color: var(--dsw-alias-state-warning-primary, #d97706); }
.msp-editor-actions { display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end; }
.msp-mini-btn {
  border: 1px solid var(--dsw-alias-border-l3); background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 999px; padding: 3px 12px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.msp-mini-btn.primary {
  background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-layer-1);
}
.msp-mini-btn:disabled { opacity: 0.5; cursor: default; }
/* 破坏性动作的确认按钮（确认清除） */
.msp-mini-btn.danger {
  border-color: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}
`;

    /* ------------------------- shared slider ------------------------- */

    const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now() : Date.now());

    /* SVG 属性数值补间（ease-out，rAF）：只服务 hover 反馈的 r / opacity。按
       (元素, 属性) 记账，同一属性再次补间会先取消上一段，来回移入移出、或悬停
       中途反向触发都不会打架；ms<=0 表示取消进行中的补间并直接落值。与
       EffortSlider 自己的位置补间（写 cx / width）作用在不相交的属性上。 */
    const hoverTweens = new WeakMap();
    function tweenSvgAttr(el, attr, to, ms) {
      if (!el) return;
      let perEl = hoverTweens.get(el);
      if (!perEl) { perEl = new Map(); hoverTweens.set(el, perEl); }
      const prev = perEl.get(attr);
      if (prev) cancelAnimationFrame(prev.raf);
      const from = parseFloat(el.getAttribute(attr));
      if (!isFinite(from)) return;
      if (ms <= 0 || Math.abs(to - from) < 1e-3) {
        el.setAttribute(attr, String(to));
        perEl.delete(attr);
        return;
      }
      const t0 = nowMs();
      const handle = { raf: 0 };
      const step = (ts) => {
        const t = Math.min(1, (ts - t0) / ms);
        const eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic，与位置补间同族
        el.setAttribute(attr, (from + (to - from) * eased).toFixed(3));
        if (t < 1) handle.raf = requestAnimationFrame(step);
        else perEl.delete(attr);
      };
      handle.raf = requestAnimationFrame(step);
      perEl.set(attr, handle);
    }

    function EffortSlider(props) {
      const { levels, index, onCommit, onPreview, disabled, label } = props;
      const n = levels.length;
      const ref = React.useRef(null);
      const drag = React.useRef(null);
      const [dragFraction, setDragFraction] = React.useState(null);
      // Track width in CSS pixels, measured for the SVG viewBox. The slider is
      // re-laid out whenever the popover is placed, so this stays accurate.
      const [trackW, setTrackW] = React.useState(0);

      /* Hover 反馈（仅鼠标）的登记处：旋钮/外环与刻度点的 DOM 元素（属性补间
         直接写在这些节点上，React 对这几个 r / opacity 属性的 vdom 值是常量，
         不会覆写），以及悬停态。 */
      const thumbElRef = React.useRef(null);
      const ringElRef = React.useRef(null);
      const greyDotEls = React.useRef([]);
      const coveredDotEls = React.useRef([]);
      const hoveredDot = React.useRef(-1);
      const [knobHover, setKnobHover] = React.useState(false);
      // 档位名小标签：常驻一枚、靠 on 切换淡入淡出，移开后在原位淡出而不是闪没。
      const [tip, setTip] = React.useState({ on: false, x: 0, name: '' });

      const baseFraction = n > 1 ? clamp01(index / (n - 1)) : 0;
      const fraction = dragFraction !== null ? dragFraction : baseFraction;
      const shownIndex = dragFraction !== null
        ? clamp(Math.round(dragFraction * (n - 1)), 0, Math.max(0, n - 1))
        : clamp(index, 0, Math.max(0, n - 1));

      /* Visual position: the knob and fill ease toward the snapped target over
         TWEEN_MS via requestAnimationFrame. The LEVEL itself — shownIndex, the
         preview callback, the commit and the Max effect — switches immediately;
         only the paint lags. The value is written into SVG attributes (cx /
         width); a CSS transform would violate the geometry rule this slider is
         built on, and would animate the wrong box anyway. */
      const visualRef = React.useRef(fraction);
      const [visual, setVisual] = React.useState(fraction);
      React.useEffect(() => {
        const from = visualRef.current;
        const to = fraction;
        if (Math.abs(to - from) < 1e-4) {
          visualRef.current = to;
          setVisual(to);
          return undefined;
        }
        const t0 = typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now() : Date.now();
        let raf = 0;
        const step = (now) => {
          const t = Math.min(1, (now - t0) / TWEEN_MS);
          const eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic
          visualRef.current = from + (to - from) * eased;
          setVisual(visualRef.current);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
      }, [fraction]);

      React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => {
          const w = el.clientWidth;
          if (w > 0) setTrackW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
        };
        measure();
        if (typeof ResizeObserver === 'function') {
          const ro = new ResizeObserver(measure);
          ro.observe(el);
          return () => ro.disconnect();
        }
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
      }, []);

      const fractionOf = (e, offset = 0) => {
        const el = ref.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const r = THUMB / 2;
        const denom = rect.width - 2 * r;
        return denom > 0 ? clamp01((e.clientX - offset - rect.left - r) / denom) : 0;
      };
      const commitIndex = (i) => {
        if (disabled || n === 0) return;
        const ii = clamp(i, 0, n - 1);
        if (levels[ii] && onCommit) onCommit(ii);
      };
      const DRAG_THRESHOLD = 10;
      const onPointerDown = (e) => {
        if (disabled || n === 0) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        const el = ref.current;
        if (!el) return;
        try { el.focus({ preventScroll: true }); } catch (error) { /* noop */ }

        // pointer capture 会吞掉后续的 over/out，先把刻度点的悬停态清干净
        // （立即落值，不做补间），否则点亮的点会一直挂着。
        clearDotHover();

        const rect = el.getBoundingClientRect();
        const D = THUMB;
        const cy = D / 2;
        const W = Math.max(1, Math.round(trackW || el.clientWidth || 0));
        const inner = Math.max(0, W - D);
        const thumbCenterClientX = rect.left + cy + inner * baseFraction;
        const distFromThumb = Math.abs(e.clientX - thumbCenterClientX);
        const onThumb = distFromThumb <= THUMB / 2;
        let grabOffset = onThumb ? (e.clientX - thumbCenterClientX) : 0;

        // 点击轨道空白处（非拇指）：直接吸附到目标档位，并记录相对于新档位拇指中心的触点偏移
        if (!onThumb) {
          const idx = clamp(Math.round(fractionOf(e, 0) * (n - 1)), 0, Math.max(0, n - 1));
          const targetFrac = n > 1 ? idx / (n - 1) : 0;
          const newThumbCenterClientX = rect.left + cy + inner * targetFrac;
          grabOffset = e.clientX - newThumbCenterClientX;
          commitIndex(idx);
        }

        drag.current = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          grabOffset,
          onThumb,
        };
        try { el.setPointerCapture(e.pointerId); } catch (error) { /* noop */ }
      };
      const onPointerMove = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        if (!d.moved) {
          if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
          d.moved = true;
        }
        // 拖动吸附：不写连续 frac，改写 idx/(n-1)。旋钮直接停在刻度点上，指针
        // 跨过相邻两档的正中（round 语义）才跳到另一档；越界时钳在首/末档。
        // knobX / fillW / clipPath 全都由 fraction 推导，所以只需在此处改写。
        const frac = fractionOf(e, d.grabOffset);
        const idx = clamp(Math.round(frac * (n - 1)), 0, Math.max(0, n - 1));
        setDragFraction(n > 1 ? idx / (n - 1) : 0);
        if (onPreview && levels[idx]) onPreview(levels[idx].id);
      };
      const endDrag = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        try { ref.current.releasePointerCapture(e.pointerId); } catch (error) { /* noop */ }
        if (d.moved) {
          const finalFrac = fractionOf(e, d.grabOffset);
          commitIndex(Math.round(finalFrac * (n - 1)));
          setDragFraction(null);
          if (onPreview) onPreview(null);
        } else {
          setDragFraction(null);
        }
        // 按住/拖动期间 capture 吞掉了 over/out，松手后按旋钮的最终落点重算一次
        // 旋钮悬停态：指针停在旋钮上就保持 grab 与放大，否则还原。fractionOf 带
        // 上 grabOffset 后，无论哪种按下方式算出的都是「已提交档位」的分数。
        // r 的补间也在这里直接驱动——不能只切类等下一次 pointerover 来补，
        // 否则松手停在旋钮上会出现「grab 光标 + 悬停投影但旋钮还是小号」的错位。
        if (e.pointerType === 'mouse' && !disabled && n > 1) {
          const elNow = ref.current;
          if (elNow) {
            const idx = clamp(Math.round(fractionOf(e, d.grabOffset) * (n - 1)), 0, n - 1);
            const rectNow = elNow.getBoundingClientRect();
            const innerNow = Math.max(0, (trackW || elNow.clientWidth || 0) - THUMB);
            const knobCentreX = rectNow.left + THUMB / 2 + innerNow * (idx / (n - 1));
            const hover = Math.abs(e.clientX - knobCentreX) <= KNOB_R_HOVER;
            setKnobHover(hover);
            const t = thumbElRef.current; const r = ringElRef.current;
            const targetR = hover ? KNOB_R_HOVER : KNOB_R;
            if (t) tweenSvgAttr(t, 'r', targetR, KNOB_HOVER_MS);
            if (r) tweenSvgAttr(r, 'r', targetR - 0.5, KNOB_HOVER_MS);
          }
        }
        drag.current = null;
      };
      const onKeyDown = (e) => {
        if (disabled || n === 0) return;
        let next = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); next = index - 1; }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); next = index + 1; }
        else if (e.key === 'Home') { e.preventDefault(); next = 0; }
        else if (e.key === 'End') { e.preventDefault(); next = n - 1; }
        if (next !== null) {
          const ii = clamp(next, 0, n - 1);
          if (onPreview && levels[ii]) onPreview(levels[ii].id);
          commitIndex(ii);
        }
      };

      // Every rounded shape is real SVG geometry (rect rx / circle): no
      // border-radius, clip-path, transform or percentage width is involved,
      // so the knobs and the track caps rasterise identically on every
      // renderer. The previous CSS version was painted with square dots and a
      // squircle thumb inside the desktop shell while rendering correctly on
      // an isolated page, so the styling route was abandoned entirely.
      //
      // Geometry (all in SVG user units == CSS px, viewBox matches the box):
      //   track height 23, knob diameter 30 (1.3x the track, per the design),
      //   both vertically centred in a box D tall, so the knob oversails the
      //   track by (D - 23) / 2 on each side. The knob's centre travels from
      //   D/2 to W - D/2.
      //
      //   The fill starts at the knob's CENTRE, not at the track's left end.
      //   The track's left cap is itself a half-disc of radius 11.5 and stays
      //   blue at every setting, so the knob always has blue on both sides;
      //   filling only up to the knob (the first attempt) let the 30px knob
      //   swallow the whole fill at Off, leaving no blue visible at all.
      const W = Math.max(1, Math.round(trackW));
      const D = THUMB;
      const cy = D / 2;
      const trackY = cy - TRACK_H / 2;
      const inner = Math.max(0, W - D);
      const knobX = cy + inner * visual;
      // Fill a touch past the knob's centre so the two stay visually tangent
      // whatever the renderer does with subpixel edges; the knob paints over
      // the overlap, so the extra pixel is never visible on its own.
      const fillW = knobX + 2;
      // At the minimum the knob sits over the whole fill. Drawing it anyway
      // left a blue crescent on the knob's rim: the fill's cap radius is
      // clamped to half its (small) width, making that edge flatter than the
      // knob's circular rim, so ~0.5px of blue escaped along an arc. Off means
      // no progress, so draw no fill at all -- the track reads as empty grey.
      // Judged against the ANIMATED position, so the fill shrinks together
      // with the knob instead of popping off the instant Off is selected.
      const showFill = visual > 0;
      const dotSpan = Math.max(0, inner - (TRACK_H / 2 - D / 2) * 2);
      const dotX0 = cy + (TRACK_H / 2 - D / 2);
      const dotXAt = (i) => dotX0 + dotSpan * (n > 1 ? i / (n - 1) : 0);

      /* ---- 悬停处理（仅鼠标）。r / opacity 走 tweenSvgAttr 数值补间；颜色
         直接换 fill 属性（var() 无法数值插值，snap 即可）。 ---- */
      const enterDot = (i, e) => {
        if (disabled || drag.current || e.pointerType !== 'mouse') return;
        hoveredDot.current = i;
        setTip({ on: true, x: dotXAt(i), name: (levels[i] && levels[i].name) || '' });
        const g = greyDotEls.current[i];
        if (!g) return;
        tweenSvgAttr(g, 'r', DOT_R_HOVER, HOVER_TWEEN_MS);
        const c = coveredDotEls.current[i];
        // 判据与 dotsCovered 的 clipPath 同源：fillW 由同一帧的 visual 推出。
        // 被填充盖住的点提亮半透明白点（补间 opacity 属性本身——渲染时已把
        // rgba 白改成纯白 fill + opacity 0.4，两者完全同效）；露在灰轨道上的
        // 点加深一档灰（border-l2），仍保持「灰轨道上的灰点」。
        if (c) tweenSvgAttr(c, 'r', DOT_R_HOVER, HOVER_TWEEN_MS);
        if (c && dotXAt(i) <= fillW) {
          tweenSvgAttr(c, 'opacity', DOT_COVERED_OP_HOVER, HOVER_TWEEN_MS);
        } else {
          g.setAttribute('fill', DOT_HOVER_FILL);
        }
      };
      const leaveDot = (i, e) => {
        if (e.pointerType !== 'mouse') return;
        if (hoveredDot.current === i) hoveredDot.current = -1;
        setTip((t) => (t.on ? { ...t, on: false } : t));
        const g = greyDotEls.current[i];
        const c = coveredDotEls.current[i];
        // 还原一律回到基准态（fill 也复原），即便悬停期间填充扫过了这个点。
        if (g) { tweenSvgAttr(g, 'r', DOT_R, HOVER_TWEEN_MS); g.setAttribute('fill', DOT_GREY_FILL); }
        if (c) { tweenSvgAttr(c, 'r', DOT_R, HOVER_TWEEN_MS); tweenSvgAttr(c, 'opacity', DOT_COVERED_OP, HOVER_TWEEN_MS); }
      };
      /* 按下即捕获（capture 吞掉 over/out）：把刻度点悬停态立即清掉。 */
      const clearDotHover = () => {
        const i = hoveredDot.current;
        if (i < 0) return;
        hoveredDot.current = -1;
        setTip((t) => (t.on ? { ...t, on: false } : t));
        const g = greyDotEls.current[i];
        const c = coveredDotEls.current[i];
        if (g) { tweenSvgAttr(g, 'r', DOT_R, 0); g.setAttribute('fill', DOT_GREY_FILL); }
        if (c) { tweenSvgAttr(c, 'r', DOT_R, 0); tweenSvgAttr(c, 'opacity', DOT_COVERED_OP, 0); }
      };
      const enterKnob = (e) => {
        if (disabled || drag.current || e.pointerType !== 'mouse') return;
        setKnobHover(true);
        const t = thumbElRef.current; const r = ringElRef.current;
        if (t) tweenSvgAttr(t, 'r', KNOB_R_HOVER, KNOB_HOVER_MS);
        if (r) tweenSvgAttr(r, 'r', KNOB_R_HOVER - 0.5, KNOB_HOVER_MS);
      };
      const leaveKnob = (e) => {
        // 拖动中不响应：capture 下不会有真事件，防的是 capture 释放瞬间的串扰，
        // 松手时 endDrag 会按最终落点统一重算。
        if (e.pointerType !== 'mouse' || drag.current) return;
        setKnobHover(false);
        const t = thumbElRef.current; const r = ringElRef.current;
        if (t) tweenSvgAttr(t, 'r', KNOB_R, KNOB_HOVER_MS);
        if (r) tweenSvgAttr(r, 'r', KNOB_R - 0.5, KNOB_HOVER_MS);
      };

      const dots = [];
      for (let i = 0; i < n; i++) {
        dots.push(h('circle', {
          key: 'd' + i, cx: dotXAt(i), cy, r: DOT_R, fill: DOT_GREY_FILL,
          ref: (el) => { greyDotEls.current[i] = el; },
        }));
      }
      /* 盖在填充上的半透明白点：fill 用纯白 + opacity 属性承载 0.4，与原来的
         rgba(255,255,255,0.4) 同效，但悬停时补间的就是 opacity 属性本身。 */
      const dotsCovered = [];
      for (let i = 0; i < n; i++) {
        dotsCovered.push(h('circle', {
          key: 'o' + i, cx: dotXAt(i), cy, r: DOT_R, fill: '#ffffff', opacity: DOT_COVERED_OP,
          ref: (el) => { coveredDotEls.current[i] = el; },
        }));
      }
      /* 刻度点命中区：透明圆，画在可见点之上、旋钮之下——悬停目标不再要求
         精确瞄中 3px 的小点，而旋钮压住的点也不会被误报悬停。 */
      const dotHits = [];
      for (let i = 0; i < n; i++) {
        dotHits.push(h('circle', {
          key: 'h' + i, cx: dotXAt(i), cy, r: DOT_HIT_R,
          fill: 'transparent', pointerEvents: 'all',
          onPointerOver: (e) => enterDot(i, e), onPointerOut: (e) => leaveDot(i, e),
        }));
      }

      const currentLevel = levels[shownIndex];
      const isMax = !!(currentLevel && (currentLevel.id === 'max' || currentLevel.name === 'Max'));

      /* Lazy state rather than useMemo: React is free to drop a memo cache, and
         a recomputed starfield would visibly jump. This runs once per mount. */
      const [stars] = React.useState(() => {
        const list = [];
        const glowIndices = new Set([4, 11, 19, 25]);
        for (let i = 0; i < 28; i++) {
          const isGlow = glowIndices.has(i);
          const dur = +(2.2 + Math.random() * 3.3).toFixed(2);
          const baseOp = +(0.65 + Math.random() * 0.35).toFixed(2);
          list.push({
            id: i,
            // x 均匀随机铺满整个填充宽度（由 clipPath 裁到填充区）
            xPct: 0.02 + Math.random() * 0.96,
            // y 分布在轨道高度的 15%–85%
            yPct: 0.15 + Math.random() * 0.70,
            // 规格：星点半径 0.5–1.6px，其中 3–4 颗稍大并带光晕
            r: isGlow ? 1.2 + Math.random() * 0.4 : 0.5 + Math.random() * 0.6,
            isGlow,
            dur,
            delay: +(-(Math.random() * dur)).toFixed(2),
            baseOp,
            minOp: +(baseOp * 0.35).toFixed(2),
          });
        }
        return list;
      });

      /* 到达迸发：旋钮落到最高档的一瞬，一次性从旋钮边缘迸出 10–14 颗淡紫色
         小点。方向偏上偏右、距离 30–80px 随机，减速后淡出并缩小。 */
      const [burst] = React.useState(() => {
        const out = [];
        for (let i = 0; i < 12; i++) {
          // 均值 -45°（右上），散布 ±81°，整体偏上偏右
          const angle = -Math.PI / 4 + (Math.random() - 0.5) * Math.PI * 0.9;
          const dist = 30 + Math.random() * 50;
          const dur = 0.8 + Math.random() * 0.4;
          out.push({
            id: i,
            r: 1.5 + Math.random() * 2.5,
            dx: +(Math.cos(angle) * dist).toFixed(1),
            dy: +(Math.sin(angle) * dist).toFixed(1),
            op: +(0.6 + Math.random() * 0.4).toFixed(2),
            dur: +dur.toFixed(2),
            delay: +(Math.random() * 0.12).toFixed(3),
            color: Math.random() < 0.5
              ? 'var(--max-burst-a, #a78bfa)' : 'var(--max-burst-b, #c4b5fd)',
          });
        }
        return out;
      });
      /* Rising edge of "landed on the top level" — including the drag preview
         before release. The key forces a remount so the one-shot restarts. */
      const burstKeyRef = React.useRef(null);
      const [burstKey, setBurstKey] = React.useState(0);
      React.useEffect(() => {
        if (burstKeyRef.current === null) { burstKeyRef.current = isMax; return; }
        if (isMax && !burstKeyRef.current) setBurstKey((k) => k + 1);
        burstKeyRef.current = isMax;
      }, [isMax]);

      return h('div', {
        ref,
        className: 'msp-slider' + (dragFraction !== null ? ' dragging' : '') + (disabled ? ' disabled' : '') + (isMax ? ' level-max' : '') + (knobHover ? ' knob-hover' : ''),
        role: 'slider', tabIndex: disabled ? -1 : 0,
        'aria-label': label || '思考强度',
        'aria-valuemin': 0, 'aria-valuemax': Math.max(0, n - 1), 'aria-valuenow': shownIndex,
        'aria-valuetext': (levels[shownIndex] && levels[shownIndex].name) || '',
        onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown,
      },
        h('svg', {
          className: 'msp-svg',
          width: '100%', height: D, viewBox: '0 0 ' + W + ' ' + D,
          preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false',
        },
          h('defs', null,
            h('clipPath', { id: 'mspFilled' },
              h('rect', { x: 0, y: 0, width: fillW, height: D }),
            ),
            /* 1 渐变底：左→右 0% / 34% / 62% / 100%。右端是亮堇紫，不是深紫。 */
            h('linearGradient', { id: 'mspMaxGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
              h('stop', { offset: '0%', stopColor: 'var(--max-grad-stop-1, #2f6fed)' }),
              h('stop', { offset: '34%', stopColor: 'var(--max-grad-stop-2, #5a4bf0)' }),
              h('stop', { offset: '62%', stopColor: 'var(--max-grad-stop-3, #7c3ff0)' }),
              h('stop', { offset: '100%', stopColor: 'var(--max-grad-stop-4, #8b5cf6)' }),
            ),
            /* 2 星云光斑：白核 → 淡紫 → 透明。两团共用一条渐变，靠半径拉开差别。 */
            h('radialGradient', { id: 'mspNebulaGrad' },
              h('stop', { offset: '0%', stopColor: 'var(--max-nebula-core, rgba(255, 255, 255, 0.75))' }),
              h('stop', { offset: '45%', stopColor: 'var(--max-nebula-mid, rgba(200, 180, 255, 0.45))' }),
              h('stop', { offset: '100%', stopColor: 'transparent' }),
            ),
            /* 规格指定的柔化：feGaussianBlur stdDeviation=3。区域放宽到 -50%
               ..+200%，否则默认滤镜区域会削掉高斯尾部。 */
            h('filter', { id: 'mspNebulaBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' },
              h('feGaussianBlur', { stdDeviation: '3' }),
            ),
            /* 渐变呼吸的扫光带：两端透明，平移时不会露出硬边。 */
            h('linearGradient', { id: 'mspSweepGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
              h('stop', { offset: '0%', stopColor: 'transparent' }),
              h('stop', { offset: '50%', stopColor: 'rgba(255,255,255,var(--max-sweep-opacity, 0.22))' }),
              h('stop', { offset: '100%', stopColor: 'transparent' }),
            ),
          ),
          h('rect', { className: 'msp-svg-track', x: 0, y: trackY, width: W, height: TRACK_H, rx: TRACK_H / 2, ry: TRACK_H / 2 }),
          showFill ? h('rect', { className: 'msp-svg-fill', x: 0, y: trackY, width: fillW, height: TRACK_H, rx: TRACK_H / 2, ry: TRACK_H / 2 }) : null,
          showFill ? h('g', { className: 'msp-max-fx', clipPath: 'url(#mspFilled)' },
            /* 1 渐变底 */
            h('rect', { className: 'msp-max-base', x: 0, y: trackY, width: W, height: TRACK_H, rx: TRACK_H / 2, ry: TRACK_H / 2, fill: 'url(#mspMaxGrad)' }),
            /* 2 星云光斑 ×2：一团悬在旋钮左侧附近，一团在轨道中部偏右。最高档时
               旋钮停在右端，所以两者是两个相对固定的柔斑。两团共用一条渐变，靠
               半径拉开差别。 */
            h('g', { className: 'msp-nebula-layer' },
              h('circle', {
                className: 'msp-nebula-1',
                cx: Math.min(Math.max(knobX - 52, 14), W - 14), cy, r: 14,
                fill: 'url(#mspNebulaGrad)', filter: 'url(#mspNebulaBlur)',
              }),
              h('circle', {
                className: 'msp-nebula-2',
                cx: W * 0.58, cy, r: 11,
                fill: 'url(#mspNebulaGrad)', filter: 'url(#mspNebulaBlur)',
              }),
            ),
            /* 3 星点 ×28 */
            h('g', { className: 'msp-max-stars' },
              stars.map((s) => h('circle', {
                key: s.id,
                cx: s.xPct * W,
                cy: trackY + s.yPct * TRACK_H,
                r: s.r,
                fill: 'var(--max-star-fill, #ffffff)',
                // 3–4 颗稍大的带一圈柔光（规格指定 drop-shadow，见 CSS）
                className: 'msp-star' + (s.isGlow ? ' glow' : ''),
                style: {
                  '--star-min-op': s.minOp,
                  '--star-max-op': s.baseOp,
                  animationDuration: s.dur + 's',
                  animationDelay: s.delay + 's',
                },
              })),
            ),
            /* 渐变呼吸：两条两端透明的白色高光带扫过轨道。整层只在最高档亮起
               （见 .msp-max-sweep-layer），相位错开半周期交替进场。 */
            h('g', { className: 'msp-max-sweep-layer' },
              h('rect', { className: 'msp-max-sweep', x: 0, y: trackY, width: W * 0.35, height: TRACK_H, fill: 'url(#mspSweepGrad)' }),
              h('rect', { className: 'msp-max-sweep second', x: 0, y: trackY, width: W * 0.35, height: TRACK_H, fill: 'url(#mspSweepGrad)' }),
            ),
          ) : null,
          /* 灰轨道刻度点：颜色仍是内联 SVG fill（样式表从不碰它的颜色）；
             类名只用于 Max 档的整体淡出（.msp-svg-dots 的 opacity 过渡）。 */
          h('g', { className: 'msp-svg-dots' }, dots),
          showFill ? h('g', { className: 'msp-svg-dots-on', clipPath: 'url(#mspFilled)' }, dotsCovered) : null,
          /* 刻度点命中区（透明），见 dotHits。 */
          h('g', null, dotHits),
          /* 4 旋钮光晕：最高档时白旋钮外一圈柔光 */
          h('circle', { ref: thumbElRef, className: 'msp-svg-thumb' + (isMax ? ' halo' : ''), cx: knobX, cy, r: D / 2 }),
          h('circle', { ref: ringElRef, className: 'msp-svg-thumb-ring', cx: knobX, cy, r: D / 2 - 0.5 }),
          /* 旋钮命中区：透明圆盖在外环之上，半径 ≥ 悬停视觉半径，指针停在视觉
             边缘也不会陷入放大/缩回抖动。r 的悬停变化只写 thumb / ring 两个
             可见圆的属性。 */
          h('circle', {
            className: 'msp-knob-hit', cx: knobX, cy, r: KNOB_HIT_R,
            fill: 'transparent', pointerEvents: 'all',
            onPointerOver: enterKnob, onPointerOut: leaveKnob,
          }),
          /* 到达迸发：旋钮落到最高档的一瞬，一次性从旋钮边缘迸出小点。必须画在
             clipPath 之外，否则飞散出去的点会被裁掉。 */
          burstKey > 0 && h('g', { key: burstKey, className: 'msp-burst' },
            burst.map((b) => h('circle', {
              key: b.id,
              className: 'msp-burst-dot',
              cx: knobX, cy, r: b.r,
              fill: b.color,
              style: {
                '--burst-x': b.dx + 'px',
                '--burst-y': b.dy + 'px',
                '--burst-op': b.op,
                animationDuration: b.dur + 's',
                animationDelay: b.delay + 's',
              },
            })),
          ),
        ),
        /* 悬停刻度点浮出的档位名小标签：常驻一枚、靠 .on 淡入淡出（纯 HTML，
           pointer-events: none，不拦任何指针事件；left 用 SVG 的用户单位，
           本滑块 viewBox == CSS 像素，可直接当 px 用）。 */
        tip.name ? h('div', {
          key: 'tip',
          className: 'msp-dot-tip' + (tip.on ? ' on' : ''),
          style: { left: clamp(tip.x, 34, Math.max(34, W - 34)) + 'px' },
          'aria-hidden': 'true',
        }, tip.name) : null,
      );
    }

    /* OFFERED_LEVELS minus 'off': the levels auto-declare and the default-
       strength picker may write. Derived rather than restated so the three
       level lists can never drift apart. */
    const NON_OFF_LEVELS = OFFERED_LEVELS.filter((id) => id !== 'off');

    /** Fingerprint of the default-strength feature: every standard level
        self-spelled plus a valueless off. The level editor cannot produce
        this shape (it offers free selection), so a user's hand config —
        including a deliberate single level — is never mistaken for one. */
    function isFingerprint(re) {
      if (!isPlainObject(re) || re.off !== null) return false;
      return NON_OFF_LEVELS.every((k) => re[k] === k);
    }

    /** Legacy v0.7.x auto shape: one self-spelled level (+ optional valueless
        off). Still recognized so existing installs migrate on next apply. */
    function isLegacyAuto(re) {
      if (!isPlainObject(re)) return false;
      const keys = Object.keys(re).filter((k) => k !== 'off');
      if (keys.length !== 1 || re[keys[0]] !== keys[0]) return false;
      return re.off === null || re.off === undefined;
    }

    /** Every route's own default strength, as the settings document states it.
        The card uses this to explain an inconsistent default instead of
        silently selecting nothing. */
    function routeDefaultsOf(providers) {
      const out = {};
      if (!isPlainObject(providers)) return out;
      for (const [id, route] of Object.entries(providers)) {
        if (!isPlainObject(route)) continue;
        if (typeof route.reasoning === 'string' && route.reasoning) out[id] = route.reasoning;
      }
      return out;
    }

    /** Derive the current default strength: the one route default shared by
        routes carrying fingerprint declarations (else a single legacy one). */
    function deriveDefaultLevel(providers) {
      if (!isPlainObject(providers)) return null;
      const fingerprintDefaults = new Set();
      const legacyDefaults = new Set();
      for (const route of Object.values(providers)) {
        if (!isPlainObject(route)) continue;
        let hasFingerprint = false;
        const models = Array.isArray(route.models) ? route.models : [];
        for (const m of models) {
          const re = m && m.reasoningEfforts;
          if (isFingerprint(re)) hasFingerprint = true;
          else if (isLegacyAuto(re)) {
            legacyDefaults.add(Object.keys(re).filter((k) => k !== 'off')[0]);
          }
        }
        if (hasFingerprint && typeof route.reasoning === 'string' && route.reasoning) {
          fingerprintDefaults.add(route.reasoning);
        }
      }
      if (fingerprintDefaults.size === 1) return fingerprintDefaults.values().next().value;
      if (fingerprintDefaults.size === 0 && legacyDefaults.size === 1) {
        return legacyDefaults.values().next().value;
      }
      return null;
    }

    /* Vertical placement of the popover, as pure geometry so the fit rule can be
       asserted without a DOM.

       `up` is the in-conversation case: the card sits above the trigger and the
       dropdown grows UPWARD from the card's bottom edge, so the dropdown's
       bottom edge stays flush with the strength panel's bottom edge. `down` is
       the new-session hero, where the card hangs below the composer and the
       dropdown grows downward.

       Either way the span that must fit the viewport is the dropdown while it
       is open (it covers the card), not the card. `bottomEdge` is where the
       card's bottom edge wants to sit (just above the trigger); `baseTop` is
       where the hero card's top edge wants to sit.
    */
    function popoverTop(mode, cardH, ddH, ddOpen, viewportH, margin, bottomEdge, baseTop) {
      // The dropdown is CSS-capped at 100vh - 24px (= 2 x margin), but clamp
      // again here so the fit rule holds even if a taller element ever reaches
      // this function — otherwise a tall dropdown would be squeezed past the
      // top margin by the card-in-view clamp below.
      const dd = ddOpen ? Math.min(Math.max(0, ddH), Math.max(0, viewportH - 2 * margin)) : 0;
      const span = dd > 0 ? dd : cardH;
      if (mode === 'down') {
        let top = baseTop;
        if (span > 0 && top + span > viewportH - margin) top = Math.max(margin, viewportH - margin - span);
        return top;
      }
      let y = bottomEdge - cardH;
      // Keep the dropdown's top edge on screen first; then keep the card whole.
      // `dd <= viewportH - 2*margin` makes the two bounds agree, so this is
      // always satisfiable.
      if (dd > 0 && cardH > 0) y = Math.max(y, margin + dd - cardH);
      if (cardH > 0) y = Math.min(Math.max(y, margin), viewportH - cardH - margin);
      return y;
    }

    /* --------------- store: settings card data (llm-pi-ai + catalog) --------------- */

    function createStore(ctx) {
      let state = {
        ready: false, groups: [], failures: [], llmView: null, defaultLevel: null,
        routeDefaults: {}, busy: false, error: '',
      };
      const subs = new Set();
      const set = (patch) => { state = { ...state, ...patch }; subs.forEach((fn) => fn()); };
      const get = () => state;

      async function fetchSettings() {
        const d = await callRemote(() => ctx.remote.settings.describe());
        const list = (d && d.namespaces) || [];
        const llm = list.find((ns) => ns && ns.ns === LLM_NS) || null;
        set({
          llmView: llm,
          defaultLevel: deriveDefaultLevel(llm && isPlainObject(llm.value) ? llm.value.providers : null),
          routeDefaults: routeDefaultsOf(llm && isPlainObject(llm.value) ? llm.value.providers : null),
        });
      }

      async function fetchCatalog() {
        const c = await callRemote(() => ctx.remote.session.modelCatalog());
        set({ groups: (c && c.groups) || [], failures: (c && c.failures) || [] });
      }

      async function refreshAll() {
        set({ error: '' });
        try {
          await Promise.all([fetchSettings(), fetchCatalog()]);
          set({ ready: true });
        } catch (error) {
          set({ ready: true, error: errorText(error) });
        }
      }

      /** Declare levels (and optional thinking format) for one model on its pi-ai route.
       *  `levels` carries {id, wire} pairs so a hand-edited wire spelling survives the
       *  round trip; `existingWire` distinguishes "not in the map" (same-name
       *  convention) from an explicit null (off with no value). */
      async function writeLlmLevels(provider, model, levels, thinkingFormat, attemptsLeft, existingWire, keepRetired) {
        let view = state.llmView;
        if (!view) await fetchSettings();
        view = state.llmView;
        const value = (view && view.value) || {};
        const providers = isPlainObject(value.providers) ? value.providers : {};
        const route = isPlainObject(providers[provider]) ? providers[provider] : {};
        const models = Array.isArray(route.models) ? route.models.map((m) => (isPlainObject(m) ? { ...m } : m)) : [];
        let entry = models.find((m) => m && m.id === model);
        if (!entry) { entry = { id: model }; models.push(entry); }

        // Seed with the retired levels the entry already carries. The whole map
        // is replaced on write, so without this a save would silently delete a
        // level the editor no longer offers — the file keeps working instead.
        const reasoningEfforts = {};
        const previous = isPlainObject(entry.reasoningEfforts) ? entry.reasoningEfforts : {};
        if (keepRetired !== false) {
          for (const id of RETIRED_LEVELS) {
            if (Object.hasOwn(previous, id)) reasoningEfforts[id] = previous[id];
          }
        }
        if (Array.isArray(levels)) {
          for (const item of levels) {
            const id = item && item.id;
            if (!OFFERED_LEVELS.includes(id)) continue;
            // An untouched level keeps whatever the file already said. Only a
            // level the editor actually shows a wire value for is rewritten,
            // and even then a value equal to the level id stays self-spelled.
            const parked = isPlainObject(existingWire) && Object.hasOwn(existingWire, id)
              ? existingWire[id] : undefined;
            if (id === 'off') { reasoningEfforts.off = null; continue; }
            const typed = typeof item.wire === 'string' ? item.wire.trim() : '';
            if (typed.length > 0) reasoningEfforts[id] = typed;
            else if (typeof parked === 'string' && parked.length > 0) reasoningEfforts[id] = parked;
            else reasoningEfforts[id] = id;
          }
        }
        if (Object.keys(reasoningEfforts).length > 0) entry.reasoningEfforts = reasoningEfforts;
        else delete entry.reasoningEfforts;
        // The entry is copied VERBATIM and only `reasoningEfforts` / one
        // `compat` key are touched. Restating the untouched fields is not
        // cosmetic: `settings.update` replaces the whole `models` array, so a
        // field omitted here would be deleted from the file.
        const thinkingFormatValid = typeof thinkingFormat === 'string'
          && (thinkingFormat === '' || THINKING_FORMATS.includes(thinkingFormat));
        if (thinkingFormatValid) {
          const compat = isPlainObject(entry.compat) ? { ...entry.compat } : {};
          if (thinkingFormat === '') delete compat.thinkingFormat;
          else compat.thinkingFormat = thinkingFormat;
          if (Object.keys(compat).length > 0) entry.compat = compat;
          else delete entry.compat;
        }
        const patch = { providers: { [provider]: { models } } };
        try {
          await callRemote(() => ctx.remote.settings.update(LLM_NS, patch, view ? view.revision : undefined));
        } catch (error) {
          if (attemptsLeft > 0 && isConflict(error)) {
            await fetchSettings();
            return writeLlmLevels(provider, model, levels, thinkingFormat, attemptsLeft - 1, existingWire, keepRetired);
          }
          throw error;
        }
      }

      /**
       * Drop this plugin's declaration for one model: its reasoningEfforts (and
       * the thinking format it owns) are removed from the model entry, leaving
       * every other field untouched so the model keeps working.
       *
       * Unlike a save, this wipes retired levels too (keepRetired: false): the
       * user asked for the declaration to go, so leaving an invisible level
       * behind would be the surprising outcome.
       */
      async function clearLevels(provider, model) {
        set({ busy: true, error: '' });
        try {
          await writeLlmLevels(provider, model, [], '', 1, null, false);
          await fetchSettings();
          await fetchCatalog();
          set({ busy: false });
          return { ok: true };
        } catch (error) {
          const message = errorText(error);
          set({ busy: false, error: message });
          return { ok: false, message };
        }
      }

      async function saveLevels(provider, model, levels, thinkingFormat, existingWire) {
        set({ busy: true, error: '' });
        try {
          await writeLlmLevels(provider, model, levels, thinkingFormat, 2, existingWire);
          await fetchSettings();
          await fetchCatalog();
          set({ busy: false });
          return { ok: true };
        } catch (error) {
          const message = errorText(error);
          set({ busy: false, error: message });
          return { ok: false, message };
        }
      }

      /** The loaded catalog group for one route id, or undefined. */
      function groupOf(routeId) {
        return (state.groups || []).find((g) => g && g.id === routeId);
      }

      /** Levels safe to auto-declare on every model of one route: the
       *  intersection of what the loaded catalog advertises, so the plugin
       *  never invents a level the gateway does not offer. */
      function intersectionFor(routeId) {
        const group = groupOf(routeId);
        const models = (group && group.models) || [];
        let shared = null;
        for (const m of models) {
          const ids = advertisedLevels(m);
          if (ids.length === 0) continue;
          shared = shared === null ? new Set(ids) : new Set(ids.filter((id) => shared.has(id)));
        }
        return shared === null ? [] : NON_OFF_LEVELS.filter((id) => shared.has(id));
      }

      /** Models an apply-default run on this route would touch: exactly those
       *  that carry NO declaration of their own. The catalog cannot answer that
       *  (it reports the RESOLVED efforts), so the settings value is consulted
       *  too — and anything it says is declared is left alone. */
      function routeDefaultImpact(routeId, level) {
        const group = groupOf(routeId);
        const models = (group && group.models) || [];
        const routeCfg = state.llmView && isPlainObject(state.llmView.value)
          && isPlainObject(state.llmView.value.providers)
          && isPlainObject(state.llmView.value.providers[routeId])
          ? state.llmView.value.providers[routeId] : {};
        const configModels = Array.isArray(routeCfg.models) ? routeCfg.models : [];
        const added = [];
        for (const m of models) {
          if (advertisedLevels(m).length === 0) continue;
          const configEntry = configModels.find((c) => c && c.id === m.id);
          if (configEntry && configEntry.reasoningEfforts !== undefined) continue;
          added.push(m.name || m.id);
        }
        return { added, current: routeCfg.reasoning, level };
      }

      /**
       * Apply the default strength to the models of ONE route that declare no
       * levels of their own: declare the levels the loaded catalog advertises
       * for them, and make the chosen level the route's default. Routes are
       * never touched by another route's run.
       */
      async function applyDefaultLevel(routeId, level) {
        set({ busy: true, error: '' });
        try {
          await writeRouteDefault(routeId, level, 2);
          await Promise.all([fetchSettings(), fetchCatalog()]);
          set({ busy: false });
          return { ok: true };
        } catch (error) {
          const message = errorText(error);
          set({ busy: false, error: `${routeId}: ${message}` });
          return { ok: false, message };
        }
      }

      /**
       * Build + write one route's default-level declaration, conflict-retried.
       *
       * The base is the RESOLVED route value, not the raw user layer: provider
       * `models` arrays live in the profile patch (a load-time layer) and the
       * schema replaces the whole array on write. Reading the user layer would
       * yield an empty or partial list and silently drop every model this call
       * does not restate — the failure mode that empties a route.
       */
      async function writeRouteDefault(route, level, attemptsLeft) {
        let view = state.llmView;
        if (!view) await fetchSettings();
        view = state.llmView;
        const value = (view && view.value) || {};
        const providers = isPlainObject(value.providers) ? value.providers : {};
        const routeCfg = isPlainObject(providers[route]) ? providers[route] : {};
        const models = Array.isArray(routeCfg.models)
          ? routeCfg.models.map((m) => (isPlainObject(m) ? { ...m } : m))
          : [];
        const configIds = new Set(models.map((m) => m.id));
        const addedIds = new Set();
        let changed = false;

        const declared = intersectionFor(route);
        const levels = declared.length > 0 ? declared : [];
        // The chosen level must itself be declared, or picking it is a no-op.
        const declaration = levels.includes(level) ? levels : [level, ...levels];

        for (const m of models) {
          // A model the user has already given a declaration to — of any
          // shape, single level or not — is never rewritten here. The card
          // promises "already configured models are unaffected" and that
          // promise is kept literally.
          if (m.reasoningEfforts !== undefined) continue;
          // Only models whose loaded catalog row advertises reasoning get a
          // declaration; a non-reasoning model stays untouched instead of
          // being told it supports levels the gateway never offers.
          const group = groupOf(route);
          const row = group && Array.isArray(group.models)
            ? group.models.find((candidate) => candidate && candidate.id === m.id) : undefined;
          if (advertisedLevels(row).length === 0) continue;
          const efforts = { off: null };
          for (const id of declaration) if (id !== 'off') efforts[id] = id;
          m.reasoningEfforts = efforts;
          addedIds.add(m.id);
          changed = true;
        }
        const resolved = groupOf(route);
        for (const rm of (resolved && resolved.models) || []) {
          if (configIds.has(rm.id) || addedIds.has(rm.id)) continue;
          if (advertisedLevels(rm).length === 0) continue;
          const efforts = { off: null };
          for (const id of declaration) if (id !== 'off') efforts[id] = id;
          models.push({ id: rm.id, reasoningEfforts: efforts });
          addedIds.add(rm.id);
          changed = true;
        }
        // Route default: only when every model on the route accepts the level.
        let reasoningWrite;
        if (resolved && Array.isArray(resolved.models) && resolved.models.length > 0) {
          const safe = resolved.models.every((rm) => {
            if (addedIds.has(rm.id)) return true;
            const ids = (rm.reasoning && Array.isArray(rm.reasoning.efforts)
              ? rm.reasoning.efforts.map((e) => e.id) : []);
            return ids.length === 0 || ids.includes(level);
          });
          if (safe && routeCfg.reasoning !== level) {
            reasoningWrite = level;
            changed = true;
          }
        }
        if (!changed) return;
        try {
          await callRemote(() => ctx.remote.settings.update(
            LLM_NS,
            { providers: { [route]: { models, ...(reasoningWrite ? { reasoning: reasoningWrite } : {}) } } },
            view ? view.revision : undefined,
          ));
        } catch (error) {
          if (attemptsLeft > 0 && isConflict(error)) {
            await fetchSettings();
            return writeRouteDefault(route, level, attemptsLeft - 1);
          }
          throw error;
        }
      }

      /** Remove one route's default strength (the `reasoning` key). The patch
       *  touches only this one key — the settings layer merges providers, so
       *  `models` and every other field stay untouched. Written as null: all
       *  readers treat a non-string `reasoning` as "no default", and the merge
       *  patch has no other way to express "delete this key". Conflict-retried
       *  like every other write; a schema rejection surfaces as a normal error. */
      async function clearRouteDefault(route, attemptsLeft) {
        let view = state.llmView;
        if (!view) await fetchSettings();
        view = state.llmView;
        try {
          await callRemote(() => ctx.remote.settings.update(
            LLM_NS,
            { providers: { [route]: { reasoning: null } } },
            view ? view.revision : undefined,
          ));
        } catch (error) {
          if (attemptsLeft > 0 && isConflict(error)) {
            await fetchSettings();
            return clearRouteDefault(route, attemptsLeft - 1);
          }
          throw error;
        }
      }

      async function clearRouteDefaultWrap(route) {
        set({ busy: true, error: '' });
        try {
          await clearRouteDefault(route, 2);
          await fetchSettings();
          set({ busy: false });
          return { ok: true };
        } catch (error) {
          const message = errorText(error);
          set({ busy: false, error: message });
          return { ok: false, message };
        }
      }

      return {
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
        get, refreshAll, saveLevels, clearLevels, applyDefaultLevel, clearRouteDefault: clearRouteDefaultWrap,
        intersectionFor, routeDefaultImpact,
      };
    }

    /* -------------- the composer model seat (trigger + mockup popover) -------------- */

    /** Mockup press highlight: :active is unreliable on touch, so pointer
        events toggle a .pressed class directly on the element. */
    function pressHandlers() {
      return {
        onPointerDown: (e) => { e.currentTarget.classList.add('pressed'); },
        onPointerUp: (e) => { e.currentTarget.classList.remove('pressed'); },
        onPointerLeave: (e) => { e.currentTarget.classList.remove('pressed'); },
        onPointerCancel: (e) => { e.currentTarget.classList.remove('pressed'); },
      };
    }

    function ModelSeat(props, store) {
      const { locked, available, directory, load, select } = props;
      const dirState = React.useSyncExternalStore(
        (fn) => directory.subscribe(fn),
        () => directory.getSnapshot(),
      );
      const storeState = React.useSyncExternalStore(store.subscribe, store.get);

      const [open, setOpen] = React.useState(false);
      const [ddOpen, setDdOpen] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      /* Which way the dropdown grows: 'up' in conversation (bottom edge flush
         with the strength panel's bottom edge), 'down' on the new-session hero
         where the card already hangs below the composer. */
      const [ddAlign, setDdAlign] = React.useState('up');
      const [selectError, setSelectError] = React.useState('');
      const rootRef = React.useRef(null);
      const triggerRef = React.useRef(null);
      const cardRef = React.useRef(null);
      const pillRef = React.useRef(null);
      const ddRef = React.useRef(null);
      /* Anchor geometry captured when the popover opens. The trigger is a
         content-sized chip whose effort label changes width with the level, so
         centring on its live rect made the card shift on every slider click. */
      const anchorRef = React.useRef(null);

      const groups = sortedGroups(dirState.groups || []);
      const current = dirState.current || null;
      const flat = [];
      for (const g of groups) for (const m of g.models || []) flat.push({ group: g, model: m });
      const currentModel = current
        ? flat.find((row) => row.group.id === current.provider && row.model.id === current.model)
        : undefined;
      const efforts = currentModel && currentModel.model.reasoning && Array.isArray(currentModel.model.reasoning.efforts)
        ? currentModel.model.reasoning.efforts : [];
      const shownEffort = current
        ? (current.reasoningEffort
          || (currentModel && currentModel.model.reasoning && currentModel.model.reasoning.defaultEffort)
          || '')
        : '';
      // Display fallback: an undeclared model with a configured default level
      // previews that level instead of an empty state.
      const displayEffort = shownEffort
        || ((storeState.defaultLevel && efforts.some((e) => e.id === storeState.defaultLevel))
          ? storeState.defaultLevel
          : '');
      const busy = dirState.pending !== undefined && dirState.pending !== null;

      const llmProviders = storeState.llmView && isPlainObject(storeState.llmView.value)
        ? storeState.llmView.value.providers : null;
      const routeEditable = !!(current && llmProviders && isPlainObject(llmProviders[current.provider]));

      React.useEffect(() => { store.refreshAll(); }, [store]);

      const close = (restoreFocus = false) => {
        setOpen(false);
        setDdOpen(false);
        if (restoreFocus) queueMicrotask(() => { if (triggerRef.current) triggerRef.current.focus(); });
      };

      // 点击外部区域或按 Escape 直接退出全部面板（同时关闭下拉与卡片，一次点击即可回退）
      React.useEffect(() => {
        if (!open) return;
        const onPointerDown = (event) => {
          const inCard = cardRef.current && cardRef.current.contains(event.target);
          const inPill = pillRef.current && pillRef.current.contains(event.target);
          // 触发按钮属于外部切换点：由自身的 click 事件处理开关，避免被 pointerdown 抢先关闭
          const inTrigger = rootRef.current && rootRef.current.contains(event.target);
          if (!inCard && !inPill && !inTrigger) {
            close();
          }
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            close(true);
          } else if (event.ctrlKey && event.shiftKey && (event.key === 'M' || event.key === 'm')) {
            event.preventDefault();
            setDdOpen((v) => !v);
          }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open, ddOpen]);

      // Portaled placement: on the new-session hero (room below the composer
      // card) the popover hangs off the card's bottom-right corner — right
      // edges aligned, top just under the card, like the reference; when the
      // composer is docked at the viewport bottom there is no room below, so
      // it falls back to centered above the trigger. Both modes clamp inside
      // the viewport.
      //
      // The anchor is measured ONCE when the popover opens and reused for every
      // later re-placement. Re-measuring on each render made the card jump on
      // every slider click: the trigger chip carries the effort label, so its
      // width tracks the level, and centring on the widened chip moved the
      // card. Scroll/resize do re-measure, because then the page really moved.
      React.useLayoutEffect(() => {
        if (!open) { setPos(null); anchorRef.current = null; return undefined; }

        const measureAnchor = () => {
          const el = triggerRef.current;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const composerEl = el.closest ? el.closest('[data-composer-card]') : null;
          const cRect = composerEl ? composerEl.getBoundingClientRect() : null;
          const centerX = r.left + r.width / 2;
          return {
            left: r.left, top: r.top, width: r.width,
            centerX,
            composerLeft: cRect ? cRect.left : null,
            composerRight: cRect ? cRect.right : null,
            composerBottom: cRect ? cRect.bottom : null,
            relCenterX: cRect ? (centerX - cRect.left) : null,
          };
        };

        const place = () => {
          const anchor = anchorRef.current;
          if (!anchor) return;
          const MARGIN = 12;
          const w = cardRef.current ? cardRef.current.offsetWidth : CARD_W;
          const hgt = cardRef.current ? cardRef.current.offsetHeight : 0;
          const clampX = (x) => (w > 0 ? Math.min(Math.max(x, MARGIN), window.innerWidth - w - MARGIN) : x);
          // While the dropdown is open it is what the reader sees (it covers the
          // card), so ITS height — not the card's — is the span that has to fit
          // the viewport. The dropdown is height-capped by CSS at 100vh - 24px,
          // which is exactly 2 x MARGIN, so this always resolves to a fit.
          const ddH = ddRef.current ? ddRef.current.offsetHeight : 0;
          const setAlign = (next) => setDdAlign((prev) => (prev === next ? prev : next));

          if (anchor.composerRight !== null && anchor.composerBottom !== null
            && hgt > 0 && window.innerHeight - anchor.composerBottom >= hgt + MARGIN) {
            // New-session hero: the whole panel is top-aligned to the composer
            // card's bottom edge — no gap. The dropdown carries .down (top: 0),
            // so its top edge lands on the same line as the card's, and both
            // hang directly under the input box. It grows DOWNWARD from there.
            const nextLeft = clampX(anchor.composerRight - w);
            const nextTop = popoverTop('down', hgt, ddH, ddOpen, window.innerHeight, MARGIN,
              0, anchor.composerBottom);
            setAlign('down');
            setPos((prev) => (prev && Math.abs(prev.left - nextLeft) < 0.5 && Math.abs(prev.top - nextTop) < 0.5 ? prev : { left: nextLeft, top: nextTop }));
            return;
          }

          // In conversation the card sits above the trigger, so the dropdown
          // grows UPWARD from the card's BOTTOM edge: its bottom edge stays
          // flush with the strength panel's bottom edge. The whole panel is
          // nudged only as far as it takes to keep the dropdown in one piece.
          //
          // 使用锁定中心点，保证触发按钮文字变宽/窄（档位切换）时卡片水平位置绝对纹丝不动
          const center = anchor.centerX !== undefined ? anchor.centerX : (anchor.left + anchor.width / 2);
          const x = clampX(center - w / 2);
          const y = popoverTop('up', hgt, ddH, ddOpen, window.innerHeight, MARGIN,
            anchor.top - 8, 0);
          setAlign('up');
          setPos((prev) => (prev && Math.abs(prev.left - x) < 0.5 && Math.abs(prev.top - y) < 0.5 ? prev : { left: x, top: y }));
        };

        if (!anchorRef.current) anchorRef.current = measureAnchor();
        place();
        const onViewportChange = (e) => {
          // 忽略卡片内部发出的微小滚动事件（如焦点滚动）
          if (e && e.target && cardRef.current && cardRef.current.contains(e.target)) return;
          const fresh = measureAnchor();
          if (!fresh) return;
          // 若存在相对输入框的稳定水平中心，则沿用该中心，避免被按钮宽度变化牵动
          if (anchorRef.current && anchorRef.current.relCenterX !== null && fresh.composerLeft !== null) {
            fresh.centerX = fresh.composerLeft + anchorRef.current.relCenterX;
          }
          anchorRef.current = fresh;
          place();
        };
        window.addEventListener('scroll', onViewportChange, true);
        window.addEventListener('resize', onViewportChange);
        return () => {
          // Must match the registrations above: removing `place` here left the
          // real listeners attached on every re-render.
          window.removeEventListener('scroll', onViewportChange, true);
          window.removeEventListener('resize', onViewportChange);
        };
      }, [open, dirState, storeState, ddOpen]);

      // The pill's level label fades out/in (150ms) when the level changes.
      // Hooks stay above every conditional return.
      const [previewEffort, setPreviewEffort] = React.useState(null);
      const [committedEffort, setCommittedEffort] = React.useState(null);
      const activeEffort = previewEffort !== null
        ? previewEffort
        : (committedEffort !== null ? committedEffort : displayEffort);
      const [levelShown, setLevelShown] = React.useState(activeEffort);
      const [levelFading, setLevelFading] = React.useState(false);

      React.useEffect(() => {
        if (displayEffort === committedEffort) {
          setCommittedEffort(null);
        }
      }, [displayEffort, committedEffort]);

      React.useEffect(() => {
        if (activeEffort === levelShown) return;
        setLevelFading(true);
        const t = setTimeout(() => { setLevelShown(activeEffort); setLevelFading(false); }, 150);
        return () => clearTimeout(t);
      }, [activeEffort, levelShown]);

      if (!available) return null;

      const modelLabel = dirState.status === 'loading' && !current
        ? '加载中…'
        : currentModel
          ? (currentModel.model.name || currentModel.model.id)
          : current
            ? `${current.provider}/${current.model}`
            : '选择模型';

      const applySelect = (selection, failText) => {
        if (busy) return;
        setSelectError('');
        // `directory.select` rejects when the session cannot select at all
        // (addressed subagent sessions throw synchronously) and when the
        // transport fails. An unguarded throw here would escape the render
        // phase, so the whole call — sync and async — is contained.
        let result;
        try {
          result = select(selection);
        } catch (error) {
          setSelectError(errorText(error) || failText);
          return;
        }
        if (result && typeof result.then === 'function') {
          result.then((r) => {
            if (r && !r.ok) {
              const e = r.error || {};
              setSelectError(`${e.code || 'remote'}: ${e.message || failText}`);
            }
          }).catch((error) => {
            // The directory also records the failure on its own store; this
            // only makes sure a rejection is never silently swallowed.
            setSelectError(errorText(error) || failText);
          });
        }
      };

      const chooseModel = (group, model) => {
        const effort = model.reasoning && model.reasoning.defaultEffort;
        applySelect({
          provider: group.id, model: model.id,
          ...(effort ? { reasoningEffort: effort } : {}),
        }, '选择失败');
        setDdOpen(false);
      };

      const commitEffort = (i) => {
        if (!current) return;
        const effort = efforts[i];
        if (effort) {
          setCommittedEffort(effort.id);
          applySelect({ provider: current.provider, model: current.model, reasoningEffort: effort.id }, '应用失败');
        }
      };

      const press = pressHandlers();
      const triggerEffort = committedEffort !== null ? committedEffort : shownEffort;

      return h('div', { ref: rootRef, className: 'msp-root' },
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'msp-trigger' + (open ? ' open' : ''),
          'aria-haspopup': 'dialog', 'aria-expanded': open ? 'true' : 'false',
          title: `${modelLabel}${shownEffort ? ' · ' + labelOf(shownEffort) : ''} · v${PLUGIN_VERSION}`,
          disabled: !!locked,
          onClick: () => {
            const next = !open;
            setOpen(next);
            setDdOpen(false);
            if (next) {
              setSelectError('');
              load();
            }
          },
        },
          h('span', { className: 'msp-trigger-icon', 'aria-hidden': true },
            h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
              h('circle', { cx: 8, cy: 8, r: 6.2, stroke: 'currentColor', 'stroke-width': 1.4 }),
              h('circle', { cx: 8, cy: 8, r: 2, fill: 'currentColor' }),
            ),
          ),
          h('span', { className: 'msp-trigger-label' }, modelLabel),
          triggerEffort && h('span', {
            className: 'msp-trigger-effort' + (isMaxEffort(triggerEffort) ? ' max' : ''),
          }, labelOf(triggerEffort)),
          h('svg', {
            className: 'msp-trigger-chevron', width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none',
            'aria-hidden': true,
          }, h('path', { d: 'M4 6l4 4 4-4', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })),
        ),
        open && createPortal(
          h('div', {
            ref: cardRef,
            className: 'msp-pop',
            style: pos || { visibility: 'hidden', left: 0, top: 0 },
            role: 'dialog', 'aria-label': '选择模型与思考强度',
          },
            h('div', { className: 'msp-card' },
            h('div', { className: 'msp-top' },
              h('button', {
                ref: pillRef,
                type: 'button',
                className: 'msp-pill-btn',
                'aria-haspopup': 'listbox', 'aria-expanded': ddOpen ? 'true' : 'false',
                onClick: () => setDdOpen((v) => !v),
                ...press,
              },
                h('span', { className: 'msp-pill' },
                  h('span', {
                    className: 'msp-pill-level'
                      + (levelFading ? ' fading' : '')
                      + (!levelShown || levelShown === 'off' ? ' off' : '')
                      + (isMaxEffort(levelShown) ? ' max' : ''),
                  }, levelShown
                    ? labelOf(levelShown)
                    : (efforts.length > 0 ? '默认' : '未声明')),
                  h('span', { className: 'msp-pill-model' },
                    modelLabel, h('span', { className: 'msp-pill-arrow' }, ' ›')),
                ),
              ),
              h('div', {
                ref: ddRef,
                className: 'msp-dd ' + ddAlign + (ddOpen ? ' open' : ''),
                role: 'listbox', 'aria-label': '选择模型',
              },
                h('div', { className: 'msp-dd-title' }, '选择模型'),
                h('div', { className: 'msp-dd-list' },
                  groups.flatMap((g) => {
                    const rows = (g.models || []).map((m) => {
                      const selected = current && current.provider === g.id && current.model === m.id;
                      return h('button', {
                        key: `${g.id}/${m.id}`,
                        type: 'button',
                        className: 'msp-option',
                        role: 'option', 'aria-selected': selected ? 'true' : 'false',
                        onClick: () => chooseModel(g, m),
                        ...press,
                      },
                        h('span', null, m.name || m.id),
                        selected ? h('span', { className: 'msp-check' }, '✓') : null,
                      );
                    });
                    return rows.length > 0
                      ? [h('div', { key: `g:${g.id}`, className: 'msp-dd-title' }, g.name || g.id), ...rows]
                      : rows;
                  }),
                  (dirState.failures || []).map((f) => h('div', { key: `f:${f.id}`, className: 'msp-failure' }, `${f.name || f.id}: ${f.message || ''}`)),
                  groups.length === 0 && h('div', { className: 'msp-failure' }, dirState.status === 'loading' ? '正在加载模型目录…' : '暂无可用模型'),
                ),
              ),
            ),
            h('div', { className: 'msp-pop-slider' },
              efforts.length > 0
                ? h(EffortSlider, {
                  levels: efforts.map((e) => ({ id: e.id, name: e.name || labelOf(e.id) })),
                  index: Math.max(0, efforts.findIndex((e) => e.id === activeEffort)),
                  disabled: !current,
                  label: '思考强度',
                  onCommit: commitEffort,
                  onPreview: setPreviewEffort,
                })
                : h('div', { className: 'msp-hint' },
                  routeEditable
                    ? '该模型未声明思考档位，可在 设置 → 模型 设置默认思考强度。'
                    : '该模型未声明思考档位（非 pi-ai 路由）。'),
              selectError && h('div', { className: 'msp-error', role: 'alert' }, selectError),
              !selectError && dirState.error && h('div', { className: 'msp-error', role: 'alert' }, dirState.error),
            ),
            ),
          ),
          document.body,
        ),
      );
    }

    /* ---------------- settings card (Settings → 模型, page footer) ---------------- */

    /** The wire spellings a model entry currently declares, keyed by level id.
        Kept as a MAP, not a list of ids: the value side is what the gateway
        actually receives, and dropping it on read is what let a save rewrite a
        hand-tuned spelling into the level's own name. */
    function declaredMapOf(entry) {
      return entry && isPlainObject(entry.reasoningEfforts) ? entry.reasoningEfforts : null;
    }
    /** The thinking format a model entry currently carries (any of the formats
        the schema accepts), or '' when it carries none. */
    function declaredFormatOf(entry) {
      return entry && isPlainObject(entry.compat) && typeof entry.compat.thinkingFormat === 'string'
        ? entry.compat.thinkingFormat : '';
    }
    /** The declared levels of a model, in CANONICAL order. Takes the wire map
        (see declaredMapOf) rather than the entry, so both readers agree. */
    function declaredIdsOf(map) {
      return map ? CANONICAL.filter((id) => Object.hasOwn(map, id)) : [];
    }
    /** The wire value a draft holds for one level, or undefined when the draft
        says nothing about it (the level then defaults to its own name). */
    function wireOf(draftWire, id) {
      return isPlainObject(draftWire) && Object.hasOwn(draftWire, id) ? draftWire[id] : undefined;
    }

    /** The level ids one already-loaded catalog row advertises (from
        `session.modelCatalog`). Module-level because two readers need it: the
        store (intersections, auto-declare) and the settings card (per-row
        catalog comparison for the editor). Empty means "no reasoning declared
        in the catalog" — readers treat that as "nothing to compare against",
        never as "supports nothing". */
    function advertisedLevels(catalogModel) {
      const efforts = catalogModel && catalogModel.reasoning && Array.isArray(catalogModel.reasoning.efforts)
        ? catalogModel.reasoning.efforts : [];
      return efforts.map((e) => e && e.id).filter((id) => typeof id === 'string' && id.length > 0);
    }

    function StrengthSettingsCard(props, store) {
      const state = React.useSyncExternalStore(store.subscribe, store.get);
      React.useEffect(() => { store.refreshAll(); }, [store]);

      const [editingKey, setEditingKey] = React.useState(null);
      const [draftLevels, setDraftLevels] = React.useState([]);
      const [draftFormat, setDraftFormat] = React.useState('');
      const [draftWire, setDraftWire] = React.useState({});
      const [editorError, setEditorError] = React.useState('');
      /* 路由默认：每路由一行就地改。routeEdit 是待确认的 {id, level}（level
         为 '' 表示清除该路由默认）；unify* 是「一键统一所有路由」。 */
      const [routeEdit, setRouteEdit] = React.useState(null);
      const [unifyLevel, setUnifyLevel] = React.useState('');
      const [unifyConfirm, setUnifyConfirm] = React.useState(false);
      const [unifyResult, setUnifyResult] = React.useState(null);
      const [confirmClear, setConfirmClear] = React.useState(false);
      const [rowNotice, setRowNotice] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      /* 批量统一编辑：selectedKeys 是勾选的 'group/model'，batchEditing 打开时
         编辑器一份草稿保存到所有所选模型。 */
      const [selectedKeys, setSelectedKeys] = React.useState([]);
      const [batchEditing, setBatchEditing] = React.useState(false);

      const providers = state.llmView && isPlainObject(state.llmView.value)
        ? state.llmView.value.providers : null;

      const rows = [];
      for (const g of sortedGroups(state.groups || [])) {
        // Models on an llm-pi-ai route are configurable here; models served by
        // other adapters (e.g. the DeepSeek account route) cannot be edited at
        // all, so they are kept apart and summarised instead of taking a row
        // each — see editableRows / readOnlyRows below.
        const editable = !!(providers && isPlainObject(providers[g.id]));
        for (const m of g.models || []) rows.push({ group: g, model: m, editable });
      }
      const editableRows = rows.filter((row) => row.editable);
      const readOnlyRows = rows.filter((row) => !row.editable);
      /* One glance-able line for the models this card cannot touch. The full
         list rides the tooltip so nothing is hidden outright. */
      const readOnlyNames = readOnlyRows.map((row) => row.model.name || row.model.id);
      const READ_ONLY_SHOWN = 4;
      const readOnlyList = readOnlyNames.length > 0
        ? h('div', {
          className: 'msp-readonly',
          title: `档位由各自适配器内置提供，不可在此配置：${readOnlyNames.join('、')}`,
        }, `另有 ${readOnlyNames.length} 个内置档位模型（只读）：`
          + readOnlyNames.slice(0, READ_ONLY_SHOWN).join('、')
          + (readOnlyNames.length > READ_ONLY_SHOWN ? ' …' : ''))
        : null;

      const entryOf = (row) => {
        if (!providers || !isPlainObject(providers[row.group.id])) return undefined;
        const routeModels = Array.isArray(providers[row.group.id].models)
          ? providers[row.group.id].models : [];
        return routeModels.find((m) => m && m.id === row.model.id);
      };

      const rowKey = (row) => row.group.id + '/' + row.model.id;
      /* 勾选中的行（按列表顺序；目录里已消失的 key 自动忽略）。 */
      const selectedRows = editableRows.filter((row) => selectedKeys.includes(rowKey(row)));

      /* 草稿初始化：单模型编辑与批量统一编辑共用。The draft carries only
         OFFERED levels: a retired one in the file is not editable here and
         survives the save on its own (writeLlmLevels). */
      const loadDraftFrom = (row) => {
        const entry = entryOf(row);
        const map = declaredMapOf(entry);
        const declared = declaredIdsOf(map).filter((id) => OFFERED_LEVELS.includes(id));
        const levels = declared.length > 0 ? declared : ['off', 'low', 'medium', 'high'];
        setDraftLevels(levels);
        setDraftWire(map ? { ...map } : null);
        setDraftFormat(declaredFormatOf(entry));
        setEditorError('');
        setRowNotice(null);
        setConfirmClear(false);
      };

      const openEditor = (row) => {
        loadDraftFrom(row);
        setBatchEditing(false);
        setEditingKey(row.group.id + '/' + row.model.id);
      };
      const toggleDraft = (id) => {
        // Rebuilt in OFFERED order, so toggling can never reintroduce a
        // retired level; the draft never carries one (see openEditor).
        setDraftLevels((currentList) => currentList.includes(id)
          ? currentList.filter((x) => x !== id)
          : OFFERED_LEVELS.filter((c) => currentList.includes(c) || c === id));
      };
      const setWire = (id, value) => {
        setDraftWire((current) => ({ ...(isPlainObject(current) ? current : {}), [id]: value }));
      };

      const closeEditor = () => {
        setEditingKey(null);
        setBatchEditing(false);
        setEditorError('');
        setConfirmClear(false);
      };

      /* 草稿里与目录无关的问题：线级值重复 / 首尾空白。拼写规则与真实的保
         存链路一致（saveDraft → writeLlmLevels，existingWire 为空）：线级值取
         trim 后的输入，空则回落到档位同名。
         - dupGroups：两个及以上勾选档位的有效线级值相同——网关无法区分，保存前拦截；
         - wsIds：输入值首尾带空白（保存会自动 trim，仅提醒）。 */
      const draftWireIssues = () => {
        const off = draftLevels.filter((id) => id !== 'off');
        const eff = {};
        const wsIds = [];
        for (const id of off) {
          const raw = wireOf(draftWire, id);
          const typed = typeof raw === 'string' ? raw.trim() : '';
          eff[id] = typed.length > 0 ? typed : id;
          // 只有 trim 后仍有实际内容才提示空白；纯空格输入等效「留空=同名」，
          // 保存时整个值会被丢弃，提示「只去空格」反而误导。
          if (typed.length > 0 && raw !== typed) wsIds.push(id);
        }
        // 无原型表：线级值是用户自由输入，填了 "constructor" 这类词也不能撞上
        // Object.prototype 的继承属性。
        const byWire = Object.create(null);
        const dupGroups = [];
        for (const id of off) {
          const first = byWire[eff[id]];
          if (first === undefined) { byWire[eff[id]] = id; continue; }
          let group = dupGroups.find((g) => g.wire === eff[id]);
          if (!group) { group = { wire: eff[id], ids: [first] }; dupGroups.push(group); }
          group.ids.push(id);
        }
        return { dupGroups, wsIds };
      };
      /* 单模型编辑的完整问题清单：上面的线级值问题 + 目录对照。目录行没有宣
         告 reasoning（含模型已不在目录）时视为「无从对照」，不产生提示，绝不
         误报。 */
      const draftIssues = (catalogModel) => {
        const catalogIds = advertisedLevels(catalogModel);
        const unknownIds = catalogIds.length > 0
          ? draftLevels.filter((id) => id !== 'off' && !catalogIds.includes(id))
          : [];
        return { ...draftWireIssues(), unknownIds, catalogKnown: catalogIds.length > 0, catalogIds };
      };
      /* 保存前的硬拦截（单模型与批量共用）：off-only 与线级值重复；返回 ''
         表示可以通过。目录未宣告的档位只提醒、不拦——用户可能清楚网关支持。 */
      const draftSaveProblem = () => {
        if (!draftLevels.some((id) => id !== 'off')) {
          return '至少保留一个 Off 以外的档位，否则无法保存。（要彻底取消配置请用「清除」）';
        }
        const { dupGroups } = draftWireIssues();
        if (dupGroups.length > 0) {
          const detail = dupGroups
            .map((g) => `「${g.ids.map(labelOf).join('、')}」都会发送 ${g.wire}`)
            .join('；');
          return `线级值重复：${detail}。同一个模型不能有两个档位发同一个词。`;
        }
        return '';
      };

      const saveDraft = async (row) => {
        const problem = draftSaveProblem();
        if (problem) { setEditorError(problem); return; }
        const levels = draftLevels.map((id) => ({
          id,
          // Only a level that was already in the file keeps a parked wire
          // value; a level added in this editor starts out self-spelled.
          wire: wireOf(draftWire, id),
        }));
        setEditorError('');
        setSaving(true);
        const result = await store.saveLevels(row.group.id, row.model.id, levels, draftFormat);
        setSaving(false);
        if (result && result.ok) {
          // No confirmation label: the write lands immediately (providers is
          // volatile) and the row's own level tags update on the refetch, so a
          // notice here only squeezed the tags and duplicated that feedback.
          setEditingKey(null);
        } else {
          setEditorError((result && result.message) || '保存失败');
        }
      };

      /* ---- 批量统一编辑：勾选多行后，一份草稿保存到所有所选模型 ---- */

      /* 批量模式的目录对照：按「档位 → 缺它的模型」聚合。只统计目录里有
         reasoning 宣告的行；全部所选行都无从对照时不出提示。 */
      const batchIssues = (targetRows) => {
        const known = targetRows.filter((r) => advertisedLevels(r.model).length > 0);
        const unknownDetail = [];
        if (known.length > 0) {
          for (const id of draftLevels) {
            if (id === 'off') continue;
            const missing = known
              .filter((r) => !advertisedLevels(r.model).includes(id))
              .map((r) => r.model.name || r.model.id);
            if (missing.length > 0) unknownDetail.push({ id, missing });
          }
        }
        return { ...draftWireIssues(), unknownDetail, catalogChecked: known.length > 0 };
      };
      const startBatchEdit = () => {
        if (selectedRows.length === 0) return;
        // 草稿取第一个所选模型的当前声明，保证从哪个模型开始都讲得清。
        loadDraftFrom(selectedRows[0]);
        setEditingKey(null);
        setBatchEditing(true);
      };
      const toggleSelect = (key) => {
        const next = selectedKeys.includes(key)
          ? selectedKeys.filter((k) => k !== key)
          : [...selectedKeys, key];
        setSelectedKeys(next);
        // 勾选清空时批量编辑器已无目标，直接收起。
        if (batchEditing && next.length === 0) setBatchEditing(false);
      };
      const saveBatch = async () => {
        const problem = draftSaveProblem();
        if (problem) { setEditorError(problem); return; }
        const levels = draftLevels.map((id) => ({ id, wire: wireOf(draftWire, id) }));
        setEditorError('');
        setSaving(true);
        const saved = [];
        let failure = null;
        // 逐个顺序写：每个模型自带冲突重试；停在第一个失败并报进度，
        // 已写入的保持不动，重试保存只是把同样的值再写一遍，无副作用。
        for (const row of selectedRows) {
          const result = await store.saveLevels(row.group.id, row.model.id, levels, draftFormat);
          if (result && result.ok) {
            saved.push(row.model.name || row.model.id);
          } else {
            failure = { name: row.model.name || row.model.id, message: (result && result.message) || '保存失败' };
            break;
          }
        }
        setSaving(false);
        if (!failure) {
          closeEditor();
        } else {
          setEditorError(`已保存 ${saved.length}/${selectedRows.length} 个（${saved.join('、')}）；「${failure.name}」失败：${failure.message}。其余未改动，可直接重试。`);
        }
      };

      /* 编辑器主体：单模型编辑与批量统一编辑共用。targetRows 是保存目标；
         batch=true 时保存走 saveBatch、不提供「清除」，目录对照按所选模型
         聚合成「档位 → 缺它的模型」。 */
      const editorBody = (targetRows, batch) => {
        const first = targetRows[0];
        const entry = entryOf(first);
        const declaredIds = declaredIdsOf(declaredMapOf(entry));
        const issues = batch ? batchIssues(targetRows) : draftIssues(first.model);
        const dupIds = new Set(issues.dupGroups.flatMap((g) => g.ids));
        const formatDeclared = declaredFormatOf(entry);
        return [
          !batch && declaredIds.length === 0 && h('div', { className: 'msp-editor-hint' },
            '该模型尚未声明档位；下面是建议值，勾选并保存后才会生效。'),
          h('div', { className: 'msp-chip-grid' }, OFFERED_LEVELS.map((id) => {
            const on = draftLevels.includes(id);
            const wire = wireOf(draftWire, id);
            const custom = typeof wire === 'string' && wire.length > 0 && wire !== id;
            const unsure = !batch && on && issues.unknownIds.includes(id);
            const chipTitle = !batch && id !== 'off' && issues.catalogKnown
              ? (issues.catalogIds.includes(id)
                ? `模型目录宣告支持「${labelOf(id)}」`
                : `模型目录未宣告「${labelOf(id)}」；若网关实际支持可忽略`)
              : undefined;
            return h('div', { key: id, className: 'msp-chip-cell' + (on ? ' on' : '') },
              h('button', {
                type: 'button',
                className: 'msp-chip' + (on ? ' on' : ''),
                'aria-pressed': on ? 'true' : 'false',
                title: chipTitle,
                onClick: () => toggleDraft(id),
              }, unsure ? `${labelOf(id)} ⚠` : labelOf(id)),
              on && id !== 'off' && h('input', {
                type: 'text',
                className: 'msp-wire-input' + (custom ? ' custom' : '') + (dupIds.has(id) ? ' dup' : ''),
                value: typeof wire === 'string' ? wire : '',
                placeholder: id,
                title: '发给网关的线级值（留空 = 与档位同名）',
                'aria-label': `${labelOf(id)} 的线级值`,
                onChange: (e) => setWire(id, e.target.value),
              }),
            );
          })),
          issues.dupGroups.map((g) => h('div', {
            key: 'dup:' + g.wire, className: 'msp-editor-hint warn', role: 'alert',
          }, `线级值重复：「${g.ids.map(labelOf).join('、')}」都会发送 ${g.wire}，网关无法区分，请改成不同的词（保存前会一直拦着）。`)),
          !batch && issues.unknownIds.length > 0 && h('div', { className: 'msp-editor-hint warn' },
            `模型目录未宣告这些档位：${issues.unknownIds.map(labelOf).join('、')}。网关实际支持的话可忽略；不确定就先去掉。`),
          batch && issues.unknownDetail.length > 0 && h('div', { className: 'msp-editor-hint warn' },
            `这些档位不在部分所选模型的目录宣告里：${issues.unknownDetail
              .map((u) => `${labelOf(u.id)}（缺：${u.missing.join('、')}）`).join('；')}。网关实际支持的话可忽略。`),
          issues.wsIds.map((id) => h('div', { key: 'ws:' + id, className: 'msp-editor-hint' },
            `${labelOf(id)} 的线级值首尾有空格，保存时会自动去掉。`)),
          h('div', { className: 'msp-editor-hint' },
            '「线级值」是实际发给网关的词（如 max → xhigh）；留空即与档位同名。紫色表示当前值与档位名不同。'),
          h('label', { className: 'msp-editor-row' },
            h('span', null, '思考开关格式'),
            h('select', {
              value: draftFormat,
              onChange: (e) => setDraftFormat(e.target.value),
            },
              h('option', { value: '' }, THINKING_FORMATS.includes(formatDeclared) || !formatDeclared
                ? '未设置 / 清除'
                : `未知值（${formatDeclared}）`),
              THINKING_FORMATS.map((id) => h('option', { key: id, value: id },
                THINKING_FORMAT_LABELS[id] || id)),
            ),
          ),
          h('div', { className: 'msp-editor-hint' },
            'DeepSeek 系模型经兼容网关接入、off 关不掉思考时，请选「DeepSeek 兼容（thinking 开关）」。选「未设置 / 清除」会移除本插件写的这项设置，回落到配置基线里的值。'),
          editorError && h('div', { className: 'msp-error', role: 'alert' }, editorError),
          !batch && confirmClear && h('div', { className: 'msp-confirm', role: 'alertdialog', 'aria-label': '确认清除' },
            h('div', { className: 'msp-confirm-title' }, `清除「${first.model.name || first.model.id}」的档位声明？`),
            h('div', { className: 'msp-confirm-body' },
              '将移除本插件为该模型写的档位与思考开关格式，模型条目的其他字段原样保留；档位回落到适配器内置值。不影响模型本身，之后随时可以重新声明。'),
            h('div', { className: 'msp-editor-actions' },
              h('button', {
                className: 'msp-mini-btn danger', type: 'button', disabled: saving || state.busy,
                onClick: () => { setConfirmClear(false); clearDraft(first); },
              }, '确认清除'),
              h('button', { className: 'msp-mini-btn', type: 'button', disabled: saving, onClick: () => setConfirmClear(false) }, '取消'),
            ),
          ),
          h('div', { className: 'msp-editor-actions' },
            !batch && h('button', {
              className: 'msp-mini-btn', type: 'button', disabled: saving || state.busy,
              title: '移除本插件为该模型写的档位与开关格式，其他字段不动',
              onClick: () => setConfirmClear(true),
            }, '清除'),
            h('button', { className: 'msp-mini-btn', type: 'button', disabled: saving, onClick: closeEditor }, '取消'),
            h('button', {
              className: 'msp-mini-btn primary', type: 'button', disabled: saving || state.busy,
              onClick: () => (batch ? saveBatch() : saveDraft(first)),
            }, batch
              ? (saving ? '保存中…' : `保存到 ${targetRows.length} 个模型`)
              : (saving ? '保存中…' : '保存')),
          ),
        ];
      };

      const clearDraft = async (row) => {
        setEditorError('');
        setSaving(true);
        const result = await store.clearLevels(row.group.id, row.model.id);
        setSaving(false);
        if (result && result.ok) {
          setEditingKey(null);
          setRowNotice({ key: row.group.id + '/' + row.model.id, text: '已清除本插件的声明' });
        } else {
          setEditorError((result && result.message) || '清除失败');
        }
      };

      // Routes with editable config = one row each in the 默认思考强度 block.
      const editableRoutes = Object.keys(providers || {}).filter((id) => isPlainObject(providers[id]));
      const routeRows = editableRoutes.map((id) => {
        const group = (state.groups || []).find((g) => g && g.id === id);
        const catalogModels = group && Array.isArray(group.models) ? group.models : [];
        const cfgModels = Array.isArray(providers[id].models) ? providers[id].models : [];
        // 该路由目录里「所有模型都宣告」的档位；目录没说（交集为空）就不标注。
        const inter = store.intersectionFor(id);
        return {
          id,
          name: (group && group.name) || id,
          count: catalogModels.length || cfgModels.length,
          current: state.routeDefaults && state.routeDefaults[id] ? state.routeDefaults[id] : null,
          unsetIds: inter.length > 0 ? NON_OFF_LEVELS.filter((lid) => !inter.includes(lid)) : [],
        };
      });
      /* 与 writeRouteDefault 的 safe 门同一判据：路由里每个目录已知模型都宣告
         此档位，默认才一定写得进去；否则确认框要提前说明，不再默默跳过。 */
      const routeAcceptsLevel = (routeId, level) => {
        const group = (state.groups || []).find((g) => g && g.id === routeId);
        const models = group && Array.isArray(group.models) ? group.models : [];
        return models.every((rm) => {
          const ids = advertisedLevels(rm);
          return ids.length === 0 || ids.includes(level);
        });
      };
      const confirmRouteEdit = async () => {
        const edit = routeEdit;
        setRouteEdit(null);
        if (!edit) return;
        if (edit.level === '') await store.clearRouteDefault(edit.id);
        else await store.applyDefaultLevel(edit.id, edit.level);
      };
      const onUnifyClick = () => {
        const plan = editableRoutes
          .map((id) => ({ id, ...store.routeDefaultImpact(id, unifyLevel) }))
          .filter((row) => row.added.length > 0 || row.current !== unifyLevel);
        if (plan.length === 0) {
          setUnifyResult({ ok: true, text: `所有可配置路由已经是「${labelOf(unifyLevel)}」，无需改动。` });
          return;
        }
        setUnifyResult(null);
        setUnifyConfirm(true);
      };
      const applyUnify = async (plan) => {
        setUnifyConfirm(false);
        setSaving(true);
        const done = [];
        let failure = null;
        // 逐个路由顺序写入，停在第一个失败并报进度；已改的保持不动，重试只是
        // 把同样的值再写一遍，无副作用。
        for (const p of plan) {
          const result = await store.applyDefaultLevel(p.id, unifyLevel);
          if (result && result.ok) done.push(p.id);
          else { failure = { id: p.id, message: (result && result.message) || '失败' }; break; }
        }
        setSaving(false);
        if (!failure) setUnifyResult({ ok: true, text: `已统一 ${done.length} 个路由的默认为「${labelOf(unifyLevel)}」。` });
        else setUnifyResult({ ok: false, text: `已统一 ${done.length}/${plan.length} 个（${done.join('、')}）；「${failure.id}」失败：${failure.message}。其余未改动，可直接重试。` });
      };
      const unifyPlan = !unifyConfirm ? [] : editableRoutes
        .map((id) => ({ id, ...store.routeDefaultImpact(id, unifyLevel) }))
        .filter((row) => row.added.length > 0 || row.current !== unifyLevel);

      return h('div', { className: 'msp-root' },
        h('div', { className: 'msp-settings' },
          h('div', { className: 'msp-settings-title' }, '思考强度档位'),
          /* Errors sit directly under the title: the model list can be far
             taller than the viewport, and a failure reported at its foot is a
             failure nobody sees. */
          state.error && h('div', { className: 'msp-error', role: 'alert' }, state.error),
          h('div', {
            className: 'msp-settings-hint',
            title: '可编辑的只有 Pi-AI 路由的模型；其他路由的档位由适配器内置提供，只读。保存后立即生效，模型选择器的强度滑块即出现这些档位。',
          }, '为 Pi-AI 路由的模型声明思考档位，保存后立即生效。勾选多个模型可「统一编辑」成同一份配置。'),
          h('div', { className: 'msp-default' },
            h('div', { className: 'msp-editor-row' }, h('span', null, '默认思考强度')),
            h('div', { className: 'msp-settings-hint' },
              '模型没有自己配档位时用它；自己配置过档位的模型永远不受影响。'),
            routeRows.length === 0 && h('div', { className: 'msp-settings-hint' }, '没有可配置的路由。'),
            routeRows.map((row) => h('div', { key: row.id, className: 'msp-route-row' },
              h('span', { className: 'msp-route-name', title: row.id }, `${row.name}（${row.count} 个模型）`),
              h('label', { className: 'msp-route-default' },
                h('span', null, '默认'),
                h('select', {
                  value: row.current || '',
                  disabled: state.busy || saving,
                  onChange: (e) => {
                    if (e.target.value === (row.current || '')) return;
                    setRouteEdit({ id: row.id, level: e.target.value });
                  },
                },
                  h('option', { value: '' }, '未设置'),
                  NON_OFF_LEVELS.map((lid) => h('option', { key: lid, value: lid },
                    labelOf(lid) + (row.unsetIds.includes(lid) ? '（目录未宣告）' : ''))),
                ),
              ),
              routeEdit && routeEdit.id === row.id && (() => {
                const clearing = routeEdit.level === '';
                const impact = clearing ? null : store.routeDefaultImpact(row.id, routeEdit.level);
                const safe = clearing ? true : routeAcceptsLevel(row.id, routeEdit.level);
                return h('div', { className: 'msp-confirm', role: 'alertdialog', 'aria-label': '确认路由默认改动' },
                  clearing ? [
                    h('div', { key: 't', className: 'msp-confirm-title' }, `清除「${row.name}」的路由默认？`),
                    h('div', { key: 'b', className: 'msp-confirm-body' },
                      '路由默认将从配置里移除，回落到网关自身行为；已声明的档位不受影响。'),
                  ] : [
                    h('div', { key: 't', className: 'msp-confirm-title' }, `把「${row.name}」的默认设为「${labelOf(routeEdit.level)}」？`),
                    h('div', { key: 'b', className: 'msp-confirm-body' },
                      impact.added.length > 0
                        ? `将给 ${impact.added.length} 个未配置的模型补上档位声明（${impact.added.slice(0, 3).join('、')}${impact.added.length > 3 ? ' 等' : ''}），并把路由默认设为 ${labelOf(routeEdit.level)}。`
                        : `所有模型都已配置过档位，只把路由默认设为 ${labelOf(routeEdit.level)}。`,
                      !safe && `注意：该路由有模型的目录未宣告「${labelOf(routeEdit.level)}」，路由默认可能不会写入，只会补档位声明。`,
                      '已自行配置过档位的模型不受影响。'),
                  ],
                  h('div', { key: 'a', className: 'msp-editor-actions' },
                    h('button', {
                      className: 'msp-mini-btn primary', type: 'button', disabled: state.busy || saving,
                      onClick: confirmRouteEdit,
                    }, '确认'),
                    h('button', { className: 'msp-mini-btn', type: 'button', disabled: state.busy || saving, onClick: () => setRouteEdit(null) }, '取消'),
                  ),
                );
              })(),
            )),
            routeRows.length > 1 && h('div', { className: 'msp-unify-row' },
              h('span', null, '统一所有路由为'),
              h('select', {
                value: unifyLevel,
                disabled: state.busy || saving,
                onChange: (e) => { setUnifyLevel(e.target.value); setUnifyConfirm(false); },
              },
                h('option', { value: '' }, '选择档位…'),
                NON_OFF_LEVELS.map((lid) => h('option', { key: lid, value: lid }, labelOf(lid))),
              ),
              h('button', {
                className: 'msp-mini-btn', type: 'button',
                disabled: state.busy || saving || !unifyLevel,
                onClick: onUnifyClick,
              }, '应用'),
              h('span', { className: 'msp-batch-hint' }, '逐个路由写入；已配置过档位的模型不受影响'),
            ),
            unifyConfirm && h('div', { className: 'msp-confirm', role: 'alertdialog', 'aria-label': '确认统一路由默认' },
              h('div', { className: 'msp-confirm-title' }, `把所有可配置路由的默认统一为「${labelOf(unifyLevel)}」？`),
              h('div', { className: 'msp-confirm-body' },
                h('ul', { className: 'msp-confirm-list' },
                  unifyPlan.map((p) => h('li', { key: p.id },
                    p.added.length > 0
                      ? `${p.id}：给 ${p.added.length} 个模型补全档位声明（${p.added.slice(0, 3).join('、')}${p.added.length > 3 ? ' 等' : ''}），默认 ${p.current ? labelOf(p.current) : '未设置'} → ${labelOf(unifyLevel)}`
                      : `${p.id}：默认 ${p.current ? labelOf(p.current) : '未设置'} → ${labelOf(unifyLevel)}`,
                  )),
                ),
                '已自行配置过档位的模型不受影响。',
              ),
              h('div', { className: 'msp-editor-actions' },
                h('button', {
                  className: 'msp-mini-btn primary', type: 'button', disabled: state.busy || saving,
                  onClick: () => applyUnify(unifyPlan),
                }, '确认'),
                h('button', { className: 'msp-mini-btn', type: 'button', disabled: state.busy || saving, onClick: () => setUnifyConfirm(false) }, '取消'),
              ),
            ),
            unifyResult && (unifyResult.ok
              ? h('div', { className: 'msp-settings-hint' }, unifyResult.text)
              : h('div', { className: 'msp-error', role: 'alert' }, unifyResult.text)),
          ),
          editableRows.length === 0
            ? h('div', { className: 'msp-settings-hint' },
              state.ready
                ? (state.groups || []).length === 0
                  ? '模型目录为空：可能加载失败，或尚未添加任何提供商与模型。'
                  : '目录里的模型都不可配置（档位由各自适配器内置提供）。'
                : '正在加载模型目录…')
            : h('div', { className: 'msp-rows' },
                selectedRows.length > 0 && h('div', { className: 'msp-batch-bar' },
                  h('span', null, `已选 ${selectedRows.length} 个模型`),
                  h('button', {
                    className: 'msp-mini-btn', type: 'button',
                    'aria-expanded': batchEditing ? 'true' : 'false',
                    onClick: () => (batchEditing ? closeEditor() : startBatchEdit()),
                  }, batchEditing ? '收起统一编辑' : '统一编辑'),
                  h('button', {
                    className: 'msp-mini-btn', type: 'button',
                    onClick: () => { setSelectedKeys([]); setBatchEditing(false); },
                  }, '取消选择'),
                  batchEditing && h('span', { className: 'msp-batch-hint' },
                    '勾选变化会实时改变保存目标'),
                ),
                batchEditing && selectedRows.length > 0 && h('div', { className: 'msp-row-editor', key: 'batch-editor' },
                  h('div', { className: 'msp-editor' },
                    h('div', { className: 'msp-batch-title' }, `统一编辑 ${selectedRows.length} 个模型`),
                    h('div', { className: 'msp-editor-hint' },
                      `这份草稿取自「${selectedRows[0].model.name || selectedRows[0].model.id}」的当前声明；保存后，所选每个模型的档位与思考开关格式都会被这份配置覆盖。`),
                    editorBody(selectedRows, true),
                  ),
                ),
                editableRows.flatMap((row) => {
              // Only editable rows reach here; the read-only ones are summarised
              // on one line below, so this render has a single shape.
              const key = row.group.id + '/' + row.model.id;
              const entry = entryOf(row);
              const map = declaredMapOf(entry);
              const declaredIds = declaredIdsOf(map);
              // 目录对照只在该模型确实宣告了 reasoning 时进行：目录没说就看不出
              // 「未宣告」，此时绝不给已声明的档位挂警示。
              const rowCatalogIds = advertisedLevels(row.model);
              const rowCatalogKnown = rowCatalogIds.length > 0;
              const tags = declaredIds.map((id) => {
                const wire = map[id];
                const shown = labelOf(id);
                const text = (typeof wire === 'string' && wire.length > 0 && wire !== id) ? `${shown} → ${wire}` : shown;
                const warn = rowCatalogKnown && id !== 'off' && !rowCatalogIds.includes(id);
                return { key: id, text: warn ? `⚠ ${text}` : text, warn };
              });
              const editing = editingKey === key;
              const notice = rowNotice && rowNotice.key === key ? rowNotice.text : null;
              const head = h('div', { className: 'msp-row', key },
                h('input', {
                  type: 'checkbox', className: 'msp-row-check',
                  checked: selectedKeys.includes(key),
                  'aria-label': `选择 ${row.model.name || row.model.id}`,
                  onChange: () => toggleSelect(key),
                }),
                h('div', { className: 'msp-row-head' },
                  h('span', { className: 'msp-row-name' }, row.model.name || row.model.id),
                  h('span', { className: 'msp-row-group' }, row.group.name || row.group.id),
                ),
                h('div', { className: 'msp-levels' },
                  tags.length > 0
                    ? tags.map((tag) => h('span', {
                      key: tag.key,
                      className: 'msp-level-tag' + (tag.warn ? ' warn' : ''),
                      title: tag.warn ? '模型目录未宣告此档位；若网关实际支持可忽略，否则建议去掉' : undefined,
                    }, tag.text))
                    : h('span', { className: 'msp-level-tag none' }, '未声明'),
                ),
                h('button', {
                  className: 'msp-mini-btn', type: 'button',
                  'aria-expanded': editing ? 'true' : 'false',
                  onClick: () => (editing ? closeEditor() : openEditor(row)),
                }, editing ? '收起' : '编辑'),
                notice && h('span', { className: 'msp-row-notice' }, notice),
              );
              if (!editing) return [head];
              return [head, h('div', { className: 'msp-row-editor', key: key + ':editor' },
                h('div', { className: 'msp-editor' }, editorBody([row], false)),
              )];
            })),
          readOnlyList,
        ),
      );
    }

    /* ------------------------------ module apply ------------------------------ */

    return {
      inject: ['slots', 'remote', 'remote.settings', 'remote.session', 'modelDirectories', 'sessions'],
      apply(ctx) {
        const store = createStore(ctx);

        ctx.effect(() => {
          const style = document.createElement('style');
          style.setAttribute('data-plugin', PKG_ID);
          style.textContent = STYLE_CSS;
          document.head.appendChild(style);
          return () => style.remove();
        });

        ctx.effect(() => {
          const disposers = [];
          const on = (event, listener) => {
            try {
              if (ctx.remote && typeof ctx.remote.$on === 'function') {
                const off = ctx.remote.$on(event, listener);
                if (typeof off === 'function') disposers.push(off);
              }
            } catch (error) { /* event stream unavailable */ }
          };
          on('llm/adapters-updated', () => { store.refreshAll(); });
          on('settings/document-updated', () => { store.refreshAll(); });
          return () => disposers.forEach((off) => { try { off(); } catch (error) { /* noop */ } });
        });

        // The composer model seat: lower priority shadows the built-in occupant
        // (ascending priority, lowest renders); an abdicating crash hands the
        // cell back to the built-in selector automatically.
        ctx.inject(['slots', 'modelDirectories', 'sessions'], (scope) => {
          const models = scope.modelDirectories;
          const sessions = scope.sessions;
          scope.slots.inject(SEAT, () => scope.slots.register({
            name: SEAT,
            id: 'model-strength-picker',
            priority: -10,
            inject: (sessionId) => {
              const directory = models.directoryFor(sessionId);
              const seatAvailable = sessions.subagentAddress(sessionId) === undefined;
              return {
                available: seatAvailable,
                directory: directory.store,
                load: () => {
                  if (seatAvailable) directory.load().catch(() => { /* surfaced on the store */ });
                },
                select: (selection) => (seatAvailable
                  ? directory.select(selection)
                  : Promise.resolve(undefined)),
              };
            },
          }, (props) => ModelSeat(props, store)));
        });

        ctx.slots.inject(FOOTER, () => ctx.slots.register({
          name: FOOTER,
          id: 'model-strength-picker',
          order: 5,
        }, (props) => StrengthSettingsCard(props, store)));
      },
    };
};


    return mergeClientDefs([dshUiDef, buildModelStrengthDef(require)]);
  }
});
