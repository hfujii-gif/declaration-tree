// /vision のマイルストーン達成演出（GSAP）。
// #43/#44 でサイバー化（発光する木・デジタルレイン樹冠・宣言テキストのパーティクル吸収）した世界観に合わせ、
// #45 でマイルストーン／満開もサイバー風に作り直す。
// 演出DOMは呼び出し側から渡す Celebration レイヤー要素に生成し、完走後に必ず remove する（メモリリーク対策）。
//
// 確定方針（Issue #45）:
//   1. 段階的に派手さUP（2,500 → 5,000 → 7,500 → 10,000 が頂点）
//   2. 暖色（金/ピンク・紙吹雪・花びら）→ シアン/青/白のデジタル発光・データの粒・グリッチ・光のリング
//   3. 10,000＝満開は「光が画面全体に広がる」演出。発光は一時的（フィナーレ演出中のみ）で、
//      到達後に発光し続ける定着（旧 data-bloomed）は廃止した（#57）。中間マイルストーン演出も廃止（達成演出は満開のみ）。
//
// 演出の質感メモ:
//   - 光（グロー・光線）：ブラーでソフトにし、光線群はゆっくり回してきらめかせる。
//   - 衝撃波リング：中央から一度広がって“効いてる”感を出す。
//   - グリッチ：一瞬のスキャンライン掃引＋RGBずれフラッシュでデジタル感を出す。

import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'
import {
  DECLARATION_START_DELAY_MS,
  DECLARATION_TEXT_HOLD_MS,
  DECLARATION_ABSORB_MS,
  MATRIX_GLYPHS,
  MATRIX_FONT_STACK,
} from '@/lib/constants'

// ---- 見た目の定数（しきい値は lib/constants.ts の MILESTONES を使う。ここは演出パラメータ） ----
// データの粒（旧・紙吹雪）の色。シアン/白/青/淡緑のデジタル配色。
const BIT_COLORS = ['#38E1FF', '#FFFFFF', '#6EA8FF', '#78F5A0', '#BFEBFF']
// 達成テキストの強調色（サイバーのアクセント＝シアン）。
const TEXT_CYAN = '#7DE9FF'
// 発光・光輪・光線に使うシアン系のRGB（rgba 文字列を組み立てる素）。
const GLOW_CYAN = '120, 240, 255'
const GLOW_BLUE = '110, 168, 255'
// 演出の起点（画面に対する%）。中央の木のキャノピー付近。
const ORIGIN_TOP = 42

// ---- 宣言吸収演出（#44）の見た目パラメータ ----
// マトリックス分解時に差し替えるグリフはエコ語の文字（#49）。共有定数 MATRIX_GLYPHS を使う。
// 木へ吸い込まれるときに文字がシフトする色。虹色の樹冠に緑かぶりしないよう中立の白〜淡色にする。
const ABSORB_COLOR = 'rgba(235, 245, 255, 1)'
// 中央テキストの登場にかける時間（秒）。
const DECLARATION_ENTRANCE_SEC = 0.7
// 吸収の文字ごとのずらし（秒）。1文字ずつ吸い込まれる連続感を出す（大きいほどゆっくり順番に）。
const ABSORB_STAGGER = 0.05

const pickGlyph = (): string => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0]

// GSAP プラグインは初回利用時に一度だけ登録する（クライアントでのみ呼ばれる）。
let pluginsRegistered = false
const ensurePlugins = (): void => {
  if (pluginsRegistered) return
  gsap.registerPlugin(SplitText, Physics2DPlugin)
  pluginsRegistered = true
}

const random = (min: number, max: number): number => min + Math.random() * (max - min)

// レイヤー直下に絶対配置の div を1枚作る。
const makeEl = (layer: HTMLElement, cssText: string): HTMLDivElement => {
  const el = document.createElement('div')
  el.style.cssText = cssText
  layer.appendChild(el)
  return el
}

// 全画面の白フラッシュ。peak は最大不透明度。
const addFlash = (tl: gsap.core.Timeline, layer: HTMLElement, peak: number, at: number): void => {
  const flash = makeEl(layer, 'position:absolute;inset:0;background:#ffffff;opacity:0;will-change:opacity;')
  tl.to(flash, { opacity: peak, duration: 0.12, ease: 'power1.out' }, at).to(
    flash,
    { opacity: 0, duration: 0.5, ease: 'power1.in', onComplete: () => flash.remove() },
    at + 0.12
  )
}

// 中央から一度だけ広がる衝撃波リング（“効いてる”感の核）。シアンの光輪。
const addShockwave = (tl: gsap.core.Timeline, layer: HTMLElement, at: number): void => {
  const ring = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:18vmin;height:18vmin;` +
      'transform:translate(-50%,-50%) scale(0);border-radius:50%;' +
      `border:3px solid rgba(${GLOW_CYAN},0.9);box-shadow:0 0 26px rgba(${GLOW_CYAN},0.75), inset 0 0 18px rgba(${GLOW_CYAN},0.5);will-change:transform,opacity;`
  )
  tl.fromTo(
    ring,
    { scale: 0, opacity: 0.9 },
    { scale: 3.4, opacity: 0, duration: 0.9, ease: 'expo.out', onComplete: () => ring.remove() },
    at
  )
}

// 中央から広がる光のベール。木を一瞬包み込む（ブラーでソフトに）。シアン〜白。
const addGlow = (tl: gsap.core.Timeline, layer: HTMLElement, maxScale: number, at: number): void => {
  const glow = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:46vmin;height:46vmin;` +
      'transform:translate(-50%,-50%) scale(0);border-radius:50%;filter:blur(6px);will-change:transform,opacity;' +
      `background:radial-gradient(circle, rgba(235,252,255,0.95) 0%, rgba(${GLOW_CYAN},0.5) 40%, rgba(${GLOW_CYAN},0) 72%);`
  )
  tl.fromTo(
    glow,
    { scale: 0, opacity: 0 },
    { scale: maxScale, opacity: 1, duration: 0.55, ease: 'expo.out' },
    at
  ).to(glow, { opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: () => glow.remove() }, at + 0.7)
}

// 放射状の光のシャフト。幅広・低不透明・ブラーで“光の筋”にし、群全体をゆっくり回してきらめかせる。シアン/白。
const addRays = (tl: gsap.core.Timeline, layer: HTMLElement, count: number, at: number): void => {
  const wrap = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:0;height:0;filter:blur(2px);will-change:transform,opacity;`
  )
  const rays: HTMLDivElement[] = []
  for (let i = 0; i < count; i++) {
    const ray = document.createElement('div')
    const angle = (360 / count) * i
    ray.style.cssText =
      'position:absolute;top:0;left:0;width:12px;height:54vmin;transform-origin:top center;' +
      `transform:translate(-50%,0) rotate(${angle}deg);opacity:0.5;` +
      `background:linear-gradient(to bottom, rgba(${GLOW_CYAN},0.85), rgba(${GLOW_CYAN},0));`
    wrap.appendChild(ray)
    rays.push(ray)
  }
  tl.fromTo(
    rays,
    { scaleY: 0 },
    { scaleY: 1, duration: 0.6, ease: 'expo.out', stagger: { each: 0.015, from: 'center' } },
    at
  )
  // 群全体をゆっくり回してきらめかせる。
  tl.to(wrap, { rotation: 16, duration: 2.2, ease: 'sine.inOut' }, at)
  tl.to(wrap, { opacity: 0, duration: 0.8, ease: 'power1.in', onComplete: () => wrap.remove() }, at + 1.5)
}

// マトリックスの文字を紙吹雪のように噴き上げる（旧・紙吹雪）。
// 樹冠レインと同じグリフ（英数字・カタカナ）を発光する文字片として Physics2D の放物線で飛ばし、世界観を統一する。
// wide=true：中央の噴水ではなく画面全体（横位置・角度を広く）にばらまく。満開フィナーレで画面を埋めるのに使う。
const burstGlyphs = (
  layer: HTMLElement,
  count: number,
  colors: string[],
  wide = false
): void => {
  for (let i = 0; i < count; i++) {
    const size = random(14, 30)
    const color = colors[i % colors.length]
    const left = wide ? random(2, 98) : 50
    const top = wide ? random(6, 58) : ORIGIN_TOP
    const piece = makeEl(
      layer,
      `position:absolute;top:${top}%;left:${left}%;` +
        `font:700 ${size}px ${MATRIX_FONT_STACK};color:${color};` +
        `text-shadow:0 0 8px ${color};will-change:transform,opacity;`
    )
    piece.textContent = pickGlyph()
    gsap.to(piece, {
      duration: random(1.8, 3.4),
      physics2D: {
        velocity: random(300, wide ? 860 : 720),
        angle: wide ? random(0, 360) : random(200, 340),
        gravity: wide ? 480 : 700,
      },
      rotation: random(-360, 360),
      opacity: 0,
      ease: 'none',
      onComplete: () => piece.remove(),
    })
  }
}

// 一瞬のグリッチ：スキャンライン掃引＋RGBずれフラッシュでデジタル感を出す。短時間で生成DOMを破棄する。
const addGlitch = (tl: gsap.core.Timeline, layer: HTMLElement, at: number): void => {
  // RGBずれ：シアン／マゼンタの全画面レイヤーを少しずらして重ね、すぐ消す。
  const split = makeEl(
    layer,
    'position:absolute;inset:0;mix-blend-mode:screen;opacity:0;will-change:transform,opacity;' +
      `background:linear-gradient(90deg, rgba(${GLOW_CYAN},0.22), rgba(255,60,160,0.18));`
  )
  tl.fromTo(
    split,
    { opacity: 0, x: -10 },
    { opacity: 1, x: 10, duration: 0.08, ease: 'steps(2)' },
    at
  ).to(split, { opacity: 0, x: 0, duration: 0.18, ease: 'steps(3)', onComplete: () => split.remove() }, at + 0.08)

  // スキャンライン：細い明るい帯を上→下へ素早く掃引する。
  const scan = makeEl(
    layer,
    'position:absolute;left:0;right:0;top:0;height:8vmin;opacity:0;will-change:transform,opacity;' +
      `background:linear-gradient(to bottom, rgba(${GLOW_CYAN},0), rgba(235,252,255,0.5), rgba(${GLOW_CYAN},0));`
  )
  tl.fromTo(
    scan,
    { yPercent: -100, opacity: 0.9 },
    {
      yPercent: 1200,
      opacity: 0.3,
      duration: 0.5,
      ease: 'power1.in',
      onComplete: () => scan.remove(),
    },
    at
  )
}

// 満開フィナーレの主役：木のキャノピー起点からシアン〜白の光が画面全体を覆うまで広がって満ちる。
const addScreenBloom = (tl: gsap.core.Timeline, layer: HTMLElement, at: number): void => {
  const bloom = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:60vmax;height:60vmax;` +
      'transform:translate(-50%,-50%) scale(0);border-radius:50%;filter:blur(10px);will-change:transform,opacity;' +
      `background:radial-gradient(circle, rgba(245,253,255,0.98) 0%, rgba(${GLOW_CYAN},0.7) 35%, rgba(${GLOW_BLUE},0.35) 60%, rgba(${GLOW_BLUE},0) 80%);`
  )
  // 画面全体を満たすまで広がる → ゆっくり減衰して余韻を残す。
  tl.fromTo(
    bloom,
    { scale: 0, opacity: 0 },
    { scale: 1.6, opacity: 1, duration: 0.9, ease: 'expo.out' },
    at
  ).to(
    bloom,
    { opacity: 0, duration: 1.6, ease: 'power2.in', onComplete: () => bloom.remove() },
    at + 1.1
  )
}

// 達成テキストを1文字ずつ登場させ、holdSeconds のあいだ表示し続けてからフェードアウト（SplitText）。
const showText = (
  tl: gsap.core.Timeline,
  layer: HTMLElement,
  label: string,
  fontSize: string,
  highlight: boolean,
  at: number,
  holdSeconds: number
): void => {
  const el = makeEl(
    layer,
    `position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);` +
      `font-size:${fontSize};font-weight:800;white-space:nowrap;letter-spacing:0.06em;` +
      `color:${highlight ? TEXT_CYAN : '#ffffff'};will-change:transform,opacity;` +
      `text-shadow:0 2px 12px rgba(0,20,40,0.6), 0 0 18px rgba(${GLOW_CYAN},0.9), 0 0 36px rgba(${GLOW_BLUE},0.6);`
  )
  el.textContent = label
  const split = new SplitText(el, { type: 'chars' })
  const entranceDur = 0.7
  tl.from(
    split.chars,
    { opacity: 0, y: -40, scale: 0.4, rotateX: -90, duration: entranceDur, ease: 'back.out(2)', stagger: 0.04 },
    at
  )
  // 全文が出そろう時刻から holdSeconds 表示を維持し、その後フェードアウトする（絶対時刻で指定）。
  const fadeStart = at + entranceDur + 0.04 * split.chars.length + holdSeconds
  tl.to(
    el,
    {
      opacity: 0,
      y: -24,
      duration: 1,
      ease: 'power1.in',
      onComplete: () => {
        split.revert()
        el.remove()
      },
    },
    fadeStart
  )
}

// 木全体を一瞬パルスさせる（内側ラッパーを拡大→戻す）。
// 幹・枝（SVG）と樹冠レイン（canvas）を束ねた [data-tree-inner] を対象にすることで一体でパルスする。
// 旧構造（svg 直下）でも壊れないよう svg をフォールバックにする。
const pulseTree = (tl: gsap.core.Timeline, tree: HTMLElement, scale: number, at: number): void => {
  const target = tree.querySelector<HTMLElement>('[data-tree-inner]') ?? tree.querySelector('svg')
  if (!target) return
  tl.to(
    target,
    { scale, transformOrigin: 'bottom center', duration: 0.45, ease: 'power2.out' },
    at
  ).to(target, { scale: 1, duration: 0.55, ease: 'power2.inOut' }, at + 0.45)
}

// フィナーレの余韻。キラキラを数秒間ちらつかせてから片付ける。
const addSparkles = (layer: HTMLElement): void => {
  const sparkles: HTMLDivElement[] = []
  for (let i = 0; i < 24; i++) {
    const s = makeEl(
      layer,
      `position:absolute;top:${random(18, 70)}%;left:${random(12, 88)}%;width:7px;height:7px;` +
        `border-radius:50%;background:#ffffff;box-shadow:0 0 8px 2px rgba(${GLOW_CYAN},0.95);opacity:0;`
    )
    sparkles.push(s)
  }
  sparkles.forEach((s) =>
    gsap.to(s, {
      opacity: 1,
      scale: 1.5,
      duration: random(0.5, 0.9),
      repeat: 7,
      yoyo: true,
      delay: random(0, 0.6),
      ease: 'sine.inOut',
    })
  )
  gsap.delayedCall(5.5, () =>
    sparkles.forEach((s) => {
      gsap.killTweensOf(s)
      s.remove()
    })
  )
}

// ---- 公開API ----

// 中間マイルストーン（stage 1=2,500 / 2=5,000 / 3=7,500）。stage が上がるほど部品を足して派手にする。
// 現在は MILESTONES=[10000] のため呼び出し経路は到達不能（達成演出は満開のみ #57）。
// 中間の派手演出を将来復活させる場合の受け口として温存する。
export const playMilestone = (
  stage: number,
  count: number,
  layer: HTMLElement,
  tree: HTMLElement
): gsap.core.Timeline => {
  ensurePlugins()
  const tl = gsap.timeline()
  const label = `${count.toLocaleString()}人達成！！`

  if (stage <= 1) {
    addGlow(tl, layer, 1.6, 0)
    addShockwave(tl, layer, 0.08)
    pulseTree(tl, tree, 1.06, 0.4)
    burstGlyphs(layer, 130, BIT_COLORS)
    // 上限は大画面ビジョン（#56）で頭打ちにならないよう引き上げる（vmin が実スケーラ）。
    showText(tl, layer, label, 'clamp(2rem, 6vmin, 8rem)', false, 0.6, 3)
  } else if (stage === 2) {
    addFlash(tl, layer, 0.35, 0)
    addGlitch(tl, layer, 0.02)
    addGlow(tl, layer, 2.4, 0.05)
    addShockwave(tl, layer, 0.1)
    addRays(tl, layer, 16, 0.4)
    pulseTree(tl, tree, 1.08, 0.4)
    burstGlyphs(layer, 240, BIT_COLORS)
    showText(tl, layer, label, 'clamp(2.4rem, 7vmin, 9rem)', false, 0.6, 3.2)
  } else {
    addFlash(tl, layer, 0.5, 0)
    addGlitch(tl, layer, 0.02)
    addGlow(tl, layer, 2.8, 0.05)
    addShockwave(tl, layer, 0.1)
    addRays(tl, layer, 24, 0.4)
    pulseTree(tl, tree, 1.1, 0.4)
    burstGlyphs(layer, 380, BIT_COLORS)
    showText(tl, layer, label, 'clamp(2.8rem, 8vmin, 10rem)', true, 0.6, 3.5)
  }
  return tl
}

// 10,000人達成のフィナーレ（最も豪華）＝「光が画面全体に広がる」。
// 発光は一時的（このフィナーレ演出中のみ）。到達後に発光し続ける定着（旧 data-bloomed）は廃止した（#57）。
export const playFullBloom = (layer: HTMLElement, tree: HTMLElement): gsap.core.Timeline => {
  ensurePlugins()
  const tl = gsap.timeline()

  addGlitch(tl, layer, 0)
  addFlash(tl, layer, 0.85, 0.05)
  addShockwave(tl, layer, 0.12)
  pulseTree(tl, tree, 1.14, 0.3)
  addScreenBloom(tl, layer, 0.18) // 光が画面全体に広がる主役
  addRays(tl, layer, 32, 0.5)
  // 画面を埋めるほどの量を、中央噴水＋全画面ばらまきの二段で出す。
  burstGlyphs(layer, 360, BIT_COLORS)
  burstGlyphs(layer, 520, BIT_COLORS, true)
  showText(tl, layer, '10,000人達成！', 'clamp(3.2rem, 10vmin, 14rem)', true, 0.8, 4.5)
  addSparkles(layer)
  return tl
}

// 木の成長段階（#57）の切替演出。白い発光で木を覆い（隠し）、発光ピークで見た目を差し替え（onSwap）、
// フェードアウトして新しい段階の木を現す。到達を起こした宣言の吸収が終わってからキュー経由で再生される。
// onSwap：ピークで呼ぶ「表示中の成長段階を進める」コールバック（page 側で state を更新→CenterTree が樹冠を作り直す）。
export const playGrowth = (layer: HTMLElement, onSwap: () => void): gsap.core.Timeline => {
  ensurePlugins()
  const tl = gsap.timeline()
  // 画面全体を覆う白い発光フラッシュ。ピークで画面を白く覆い切り、その裏で木を差し替える。
  // 透明部分を残さない（木の位置は真っ白、周辺も薄水色の白）ため、切替の瞬間は一切見えない。
  const flash = makeEl(
    layer,
    'position:absolute;inset:0;will-change:opacity;opacity:0;' +
      'background:radial-gradient(circle at 50% 42%, #ffffff 0%, #ffffff 42%, #eafaff 100%);'
  )
  // 木の位置から広がる光源のにじみ（光が木から膨らむ演出）。フラッシュより一足先に立ち上げる。
  const glow = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:60vmin;height:60vmin;` +
      'border-radius:50%;filter:blur(24px);will-change:transform,opacity;' +
      'background:radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(224,248,255,0.85) 50%, rgba(255,255,255,0) 74%);'
  )
  gsap.set(glow, { xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 })
  tl.to(glow, { opacity: 1, scale: 1.7, duration: 0.3, ease: 'power2.out' }, 0)
    // 画面全体を白で覆い切る（ここで木が完全に隠れる）。
    .to(flash, { opacity: 1, duration: 0.34, ease: 'power2.in' }, 0.06)
    // 完全に覆われた状態（真っ白）で木を差し替える。
    .add(onSwap)
    // 白い光が引くときには、すでに次段階の木になっている。
    .to(
      flash,
      { opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => flash.remove() },
      '+=0.08'
    )
    .to(glow, { opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: () => glow.remove() }, '<')
  return tl
}

// 宣言吸収演出（#44）。新着宣言1件を「中央に大きく表示→マトリックス分解→木へ吸収→木が一瞬発光」で再生する。
// layer は Celebration レイヤー（全画面・最前面）、tree は CenterTree（内に [data-canopy] を持つ）。
// 完走時に生成DOM・SplitText・Tween をすべて破棄する（長時間稼働のメモリリーク対策）。
// holdMs/absorbMs を渡すとバックログ時に短縮できる（未指定なら constants の既定値）。
export const playDeclaration = (
  text: string,
  layer: HTMLElement,
  tree: HTMLElement,
  opts?: { holdMs?: number; absorbMs?: number; leadMs?: number }
): gsap.core.Timeline => {
  ensurePlugins()
  const tl = gsap.timeline()
  // リードイン：新着検出から中央テキストを出すまでの“間”（目線をビジョンへ上げる時間）。
  const leadSec = (opts?.leadMs ?? DECLARATION_START_DELAY_MS) / 1000
  const holdSec = (opts?.holdMs ?? DECLARATION_TEXT_HOLD_MS) / 1000
  const absorbSec = (opts?.absorbMs ?? DECLARATION_ABSORB_MS) / 1000
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 中央に約1/3サイズで宣言テキストを表示する要素。50文字でも折り返して収まるようにする。
  const el = makeEl(
    layer,
    'position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);' +
      'max-width:62vw;text-align:center;line-height:1.3;' +
      "font-size:clamp(2rem, 5.2vmin, 9rem);font-weight:800;font-family:'Arial',sans-serif;" +
      'color:#ffffff;letter-spacing:0.02em;opacity:0;will-change:transform,opacity;' +
      'text-shadow:0 0 10px rgba(120,245,150,0.7), 0 2px 14px rgba(0,30,20,0.6);'
  )
  el.textContent = text

  // reduced-motion：飛行・分解を省き、フェードイン→保持→フェードアウトのみ。
  if (reduced) {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, leadSec)
      .to(el, { opacity: 0, duration: 0.5, ease: 'power1.in', onComplete: () => el.remove() }, `+=${holdSec}`)
    return tl
  }

  // 1文字ずつに分割（吸収先へ個別に飛ばすため）。
  const split = new SplitText(el, { type: 'chars' })

  // 吸収先＝木のキャノピー中心（ビューポート座標）。文字の rect も同座標系なので差分でデルタを得る。
  const canopy = tree.querySelector<HTMLElement>('[data-canopy]') ?? tree
  const canopyRect = canopy.getBoundingClientRect()
  const targetX = canopyRect.left + canopyRect.width / 2
  const targetY = canopyRect.top + canopyRect.height * 0.45

  // 登場：leadSec の“間”をおいてから、すっと出して holdSec 読ませる。
  // スケールは戻すので、文字の自然位置は分割時の計測値と一致する。
  tl.fromTo(
    el,
    { opacity: 0, scale: 0.82 },
    { opacity: 1, scale: 1, duration: DECLARATION_ENTRANCE_SEC, ease: 'back.out(1.6)' },
    leadSec
  )

  const absorbStart = leadSec + DECLARATION_ENTRANCE_SEC + holdSec

  // 文字ごとに：分割時点の中心を計測し、木へ向かうデルタを算出して飛ばす。
  // 飛びながらグリフをちらつかせ（マトリックス分解）、縮小・緑へ色シフト・フェードして木に消える。
  split.chars.forEach((char, i) => {
    const charEl = char as HTMLElement
    const rect = charEl.getBoundingClientRect()
    const dx = targetX - (rect.left + rect.width / 2)
    const dy = targetY - (rect.top + rect.height / 2)
    const original = charEl.textContent ?? ''
    let frame = 0
    tl.to(
      charEl,
      {
        x: dx,
        y: dy,
        scale: 0.18,
        opacity: 0,
        color: ABSORB_COLOR,
        duration: absorbSec,
        ease: 'power2.in',
        onUpdate: () => {
          // 数フレームに一度グリフを差し替えて“分解”の質感を出す（毎フレームは重いので間引く）。
          frame++
          if (frame % 4 === 0) charEl.textContent = pickGlyph()
        },
        onComplete: () => {
          charEl.textContent = original // revert で消えるが念のため戻す
        },
      },
      absorbStart + i * ABSORB_STAGGER
    )
  })

  // 全文字が吸収しきる時刻＝最後の文字の tween 終了時刻。文字数が多くてもこの後に木が反応する。
  const charCount = split.chars.length
  const absorbEnd = absorbStart + Math.max(0, charCount - 1) * ABSORB_STAGGER + absorbSec

  // 吸収完了に合わせ、キャノピー位置に短い発光を出して「木が明るくなる」感を作る。
  const layerRect = layer.getBoundingClientRect()
  const glow = makeEl(
    layer,
    `position:absolute;left:${targetX - layerRect.left}px;top:${targetY - layerRect.top}px;` +
      'width:34vmin;height:34vmin;transform:translate(-50%,-50%) scale(0);border-radius:50%;' +
      'filter:blur(8px);will-change:transform,opacity;' +
      'background:radial-gradient(circle, rgba(150,255,180,0.85) 0%, rgba(120,245,150,0.4) 40%, rgba(120,245,150,0) 70%);'
  )
  // 分解＋吸収がすべて終わってから波紋・発光を出す。
  const glowAt = absorbEnd
  tl.fromTo(
    glow,
    { scale: 0, opacity: 0 },
    { scale: 1.1, opacity: 1, duration: 0.4, ease: 'power2.out' },
    glowAt
  ).to(
    glow,
    { opacity: 0, duration: 0.7, ease: 'power2.in', onComplete: () => glow.remove() },
    glowAt + 0.4
  )

  // 吸収到達に合わせ、樹冠（canvas）へ波紋トリガーを送る。
  // CenterTree がこれを受けて、レイン（上→下）とは別に中央から波紋を1つ広げる。
  tl.call(
    () => {
      canopy.dispatchEvent(new CustomEvent('vision:absorb'))
    },
    undefined,
    glowAt
  )

  // 完走時に SplitText を戻し、テキスト要素を破棄する。
  tl.call(() => {
    split.revert()
    el.remove()
  })

  return tl
}

// アンマウント時などに、進行中の演出 Tween と生成済みDOMをすべて片付ける（長時間稼働のメモリリーク対策）。
export const clearCelebrations = (layer: HTMLElement | null, tree: HTMLElement | null): void => {
  if (layer) {
    gsap.killTweensOf(layer.querySelectorAll('*'))
    layer.replaceChildren()
  }
  if (tree) {
    // パルス対象（内側ラッパー。旧構造では svg）の進行中 Tween を止めて transform を戻す。
    const target = tree.querySelector<HTMLElement>('[data-tree-inner]') ?? tree.querySelector('svg')
    if (target) {
      gsap.killTweensOf(target)
      gsap.set(target, { clearProps: 'all' })
    }
  }
}
