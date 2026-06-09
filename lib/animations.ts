// /vision のマイルストーン達成演出（GSAP）。
// #31 でマージ済みの3レイヤー（背景・木・テキスト葉）の上に「別レイヤー」として被せる演出を提供する。
// 演出DOMは呼び出し側から渡す Celebration レイヤー要素に生成し、完走後に必ず remove する（メモリリーク対策）。
//
// 確定方針（Issue #11）:
//   1. 段階的に派手さUP（2,500 → 5,000 → 7,500 → 10,000 が頂点）
//   2. 10,000達成後は満開のまま定着（葉色・金縁発光は CenterTree の data-bloomed が担当）
//   3. 紙吹雪・花びらは Physics2DPlugin の放物線でリアルに動かす
//
// 演出の質感メモ:
//   - 光（グロー・光線）：ブラーでソフトにし、光線群はゆっくり回してきらめかせる。
//   - 衝撃波リング：中央から一度広がって“効いてる”感を出す。

import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'

// ---- 見た目の定数（しきい値は lib/constants.ts の MILESTONES を使う。ここは演出パラメータ） ----
const CONFETTI_COLORS = ['#FFD700', '#FF8FB1', '#7BE0AD', '#6EC1E4', '#FFFFFF']
const PETAL_COLOR = '#FFB7C5'
const TEXT_GOLD = '#FFD700'
// 演出の起点（画面に対する%）。中央の木のキャノピー付近。
const ORIGIN_TOP = 42

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

// 中央から一度だけ広がる衝撃波リング（“効いてる”感の核）。
const addShockwave = (tl: gsap.core.Timeline, layer: HTMLElement, at: number): void => {
  const ring = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:18vmin;height:18vmin;` +
      'transform:translate(-50%,-50%) scale(0);border-radius:50%;' +
      'border:3px solid rgba(255,240,205,0.85);box-shadow:0 0 26px rgba(255,225,150,0.7);will-change:transform,opacity;'
  )
  tl.fromTo(
    ring,
    { scale: 0, opacity: 0.9 },
    { scale: 3.4, opacity: 0, duration: 0.9, ease: 'expo.out', onComplete: () => ring.remove() },
    at
  )
}

// 中央から広がる光のベール。木を一瞬包み込む（ブラーでソフトに）。
const addGlow = (tl: gsap.core.Timeline, layer: HTMLElement, maxScale: number, at: number): void => {
  const glow = makeEl(
    layer,
    `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:46vmin;height:46vmin;` +
      'transform:translate(-50%,-50%) scale(0);border-radius:50%;filter:blur(6px);will-change:transform,opacity;' +
      'background:radial-gradient(circle, rgba(255,247,224,0.95) 0%, rgba(243,210,122,0.5) 40%, rgba(243,210,122,0) 72%);'
  )
  tl.fromTo(
    glow,
    { scale: 0, opacity: 0 },
    { scale: maxScale, opacity: 1, duration: 0.55, ease: 'expo.out' },
    at
  ).to(glow, { opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: () => glow.remove() }, at + 0.7)
}

// 放射状の光のシャフト。幅広・低不透明・ブラーで“光の筋”にし、群全体をゆっくり回してきらめかせる。
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
      'position:absolute;top:0;left:0;width:14px;height:54vmin;transform-origin:top center;' +
      `transform:translate(-50%,0) rotate(${angle}deg);opacity:0.5;` +
      'background:linear-gradient(to bottom, rgba(255,244,210,0.85), rgba(255,244,210,0));'
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

// 紙吹雪を中央から噴き上げる（Physics2D の放物線＋回転）。
const burstConfetti = (layer: HTMLElement, count: number, colors: string[]): void => {
  for (let i = 0; i < count; i++) {
    const size = random(8, 16)
    const color = colors[i % colors.length]
    const piece = makeEl(
      layer,
      `position:absolute;top:${ORIGIN_TOP}%;left:50%;width:${size}px;height:${size * 0.6}px;` +
        `background:${color};border-radius:2px;will-change:transform,opacity;`
    )
    gsap.to(piece, {
      duration: random(1.6, 3),
      physics2D: { velocity: random(320, 720), angle: random(200, 340), gravity: 700 },
      rotation: random(-720, 720),
      opacity: 0,
      ease: 'none',
      onComplete: () => piece.remove(),
    })
  }
}

// 花びらを舞い散らす（紙吹雪より軽く、重力ゆるめでゆっくり落ちる）。
const burstPetals = (layer: HTMLElement, count: number): void => {
  for (let i = 0; i < count; i++) {
    const size = random(10, 20)
    const petal = makeEl(
      layer,
      `position:absolute;top:${random(28, 40)}%;left:50%;width:${size}px;height:${size}px;` +
        `background:${PETAL_COLOR};border-radius:50% 0 50% 0;will-change:transform,opacity;`
    )
    gsap.to(petal, {
      duration: random(3, 5),
      physics2D: { velocity: random(200, 560), angle: random(180, 360), gravity: 300 },
      rotation: random(-720, 720),
      opacity: 0,
      ease: 'none',
      onComplete: () => petal.remove(),
    })
  }
}

// 達成テキストを1文字ずつ登場させ、holdSeconds のあいだ表示し続けてからフェードアウト（SplitText）。
const showText = (
  tl: gsap.core.Timeline,
  layer: HTMLElement,
  label: string,
  fontSize: string,
  gold: boolean,
  at: number,
  holdSeconds: number
): void => {
  const el = makeEl(
    layer,
    `position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);` +
      `font-size:${fontSize};font-weight:800;white-space:nowrap;letter-spacing:0.04em;` +
      `color:${gold ? TEXT_GOLD : '#ffffff'};will-change:transform,opacity;` +
      'text-shadow:0 2px 12px rgba(0,0,0,0.5), 0 0 24px rgba(255,215,0,0.7);'
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
      `position:absolute;top:${random(18, 70)}%;left:${random(12, 88)}%;width:8px;height:8px;` +
        'border-radius:50%;background:#ffffff;box-shadow:0 0 8px 2px rgba(255,240,180,0.9);opacity:0;'
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
    burstConfetti(layer, 40, CONFETTI_COLORS.slice(0, 2))
    showText(tl, layer, label, 'clamp(2rem, 6vmin, 4rem)', false, 0.6, 3)
  } else if (stage === 2) {
    addFlash(tl, layer, 0.4, 0)
    addGlow(tl, layer, 2.4, 0.05)
    addShockwave(tl, layer, 0.1)
    addRays(tl, layer, 16, 0.4)
    pulseTree(tl, tree, 1.08, 0.4)
    burstConfetti(layer, 80, CONFETTI_COLORS)
    showText(tl, layer, label, 'clamp(2.4rem, 7vmin, 4.6rem)', false, 0.6, 3.2)
  } else {
    addFlash(tl, layer, 0.6, 0)
    addGlow(tl, layer, 2.8, 0.05)
    addShockwave(tl, layer, 0.1)
    addRays(tl, layer, 24, 0.4)
    pulseTree(tl, tree, 1.1, 0.4)
    burstConfetti(layer, 120, CONFETTI_COLORS)
    showText(tl, layer, label, 'clamp(2.8rem, 8vmin, 5.2rem)', true, 0.6, 3.5)
  }
  return tl
}

// 10,000人達成のフィナーレ（最も豪華）。満開の定着（葉色・金縁発光）は data-bloomed（CenterTree）が担当する。
export const playFullBloom = (layer: HTMLElement, tree: HTMLElement): gsap.core.Timeline => {
  ensurePlugins()
  const tl = gsap.timeline()

  addFlash(tl, layer, 0.9, 0)
  addShockwave(tl, layer, 0.12)
  pulseTree(tl, tree, 1.14, 0.3)
  addRays(tl, layer, 32, 0.5)
  burstConfetti(layer, 90, CONFETTI_COLORS)
  burstPetals(layer, 150)
  showText(tl, layer, '10,000人達成！', 'clamp(3.2rem, 10vmin, 7rem)', true, 0.8, 4.5)
  addSparkles(layer)
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
