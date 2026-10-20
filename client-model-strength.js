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
