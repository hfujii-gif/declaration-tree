import { useCallback, useEffect, useRef, useState } from 'react'
import { LEAF_DISPLAY_MS, LEAF_EVICT_FADE_MS, MAX_VISIBLE_LEAVES } from '@/lib/constants'

// 葉の見た目バリエーション。
export type LeafVariant = {
  colorVar: string // 葉の色（CSS変数名 --color-leaf-*）
  shape: number // 形のバリエーション（0〜2）
  scale: number // サイズ倍率
  rotate: number // 回転角（度）
}

// 画面に配置中のテキスト葉。描画に必要な情報を持つ。
export type PlacedLeaf = {
  key: string // React の key（毎回ユニーク）
  text: string // 宣言の全文
  slot: number // 占有スロット番号（重なり回避に使用）。退避中は -1（スロットを手放す）。
  xPercent: number // 配置座標（コンテナ幅に対する%）
  yPercent: number // 配置座標（コンテナ高さに対する%）
  variant: LeafVariant
  exiting?: boolean // 上限超過で退避中。短いフェードアウト後に除去される。
}

// 配置スロットの格子。COLS * ROWS が MAX_VISIBLE_LEAVES 以上になるようにする。
const COLS = 3
const ROWS = Math.ceil(MAX_VISIBLE_LEAVES / COLS)
// 葉を配置する領域（中心座標の範囲）。葉は中心点に配置されるため、
// 葉の幅・高さの半分ぶん内側に余白をとり、画面端ではみ出さないようにする。
// （葉幅 24vw → 左右に各12%、最小高さ128px → 上下に約6%を確保）
const X_START = 15
const X_END = 85
const Y_START = 12
const Y_END = 50
// スロット内のゆらぎ。大きい葉でも隣と重ならず画面端にもはみ出さないよう、ステップ幅の12%以内に抑える。
const JITTER_RATIO = 0.12
const LEAF_COLOR_VARS = ['--color-leaf-1', '--color-leaf-2', '--color-leaf-3', '--color-leaf-4']
const LEAF_SHAPES = 3

const random = (min: number, max: number): number => min + Math.random() * (max - min)

// スロット番号から配置座標と見た目を決めて PlacedLeaf を組み立てる。
const createPlacedLeaf = (key: string, text: string, slot: number): PlacedLeaf => {
  const col = slot % COLS
  const row = Math.floor(slot / COLS)
  const stepX = COLS > 1 ? (X_END - X_START) / (COLS - 1) : 0
  const stepY = ROWS > 1 ? (Y_END - Y_START) / (ROWS - 1) : 0
  const jitterX = (Math.random() - 0.5) * stepX * JITTER_RATIO
  const jitterY = (Math.random() - 0.5) * stepY * JITTER_RATIO
  return {
    key,
    text,
    slot,
    xPercent: X_START + col * stepX + jitterX,
    yPercent: Y_START + row * stepY + jitterY,
    variant: {
      colorVar: LEAF_COLOR_VARS[Math.floor(Math.random() * LEAF_COLOR_VARS.length)],
      shape: Math.floor(Math.random() * LEAF_SHAPES),
      scale: random(0.9, 1.15),
      rotate: random(-8, 8),
    },
  }
}

// テキスト葉のライフサイクル（生成・ランダム配置・重なり回避・30秒で自動消去）を管理するフック。
// 真実源を ref に持ち、連続生成（バースト）でもスロットが衝突しないようにする。
export function useTransientLeaves(): {
  leaves: PlacedLeaf[]
  spawn: (text: string) => void
} {
  const [leaves, setLeaves] = useState<PlacedLeaf[]>([])
  const leavesRef = useRef<PlacedLeaf[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const keyCounterRef = useRef(0)

  const clearTimer = useCallback((key: string): void => {
    const timer = timersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(key)
    }
  }, [])

  const removeLeaf = useCallback(
    (key: string): void => {
      leavesRef.current = leavesRef.current.filter((leaf) => leaf.key !== key)
      clearTimer(key)
      setLeaves(leavesRef.current)
    },
    [clearTimer]
  )

  const spawn = useCallback(
    (text: string): void => {
      const key = `leaf-${keyCounterRef.current++}`
      const current = leavesRef.current

      // 空きスロットを集めてランダムに1つ選ぶ（退避中の葉 slot=-1 は数えない）。
      const occupied = new Set(current.filter((leaf) => leaf.slot >= 0).map((leaf) => leaf.slot))
      const freeSlots: number[] = []
      for (let s = 0; s < MAX_VISIBLE_LEAVES; s++) {
        if (!occupied.has(s)) freeSlots.push(s)
      }

      let working = current
      let slot = 0
      if (freeSlots.length > 0) {
        slot = freeSlots[Math.floor(Math.random() * freeSlots.length)]
      } else {
        // 満杯：最古の「表示中」葉を即時消去せず、短いフェードアウトで退避させる
        // （即時消去だと25台同時投稿のバースト時に葉がパッと消えるため）。
        const oldest = current.find((leaf) => leaf.slot >= 0)
        if (oldest) {
          clearTimer(oldest.key)
          slot = oldest.slot
          // 退避中フラグを立て、スロットを手放す（新着がこのスロットをすぐ使える）。
          working = current.map((leaf) =>
            leaf.key === oldest.key ? { ...leaf, exiting: true, slot: -1 } : leaf
          )
          const evictTimer = setTimeout(() => removeLeaf(oldest.key), LEAF_EVICT_FADE_MS)
          timersRef.current.set(oldest.key, evictTimer)
        }
      }

      const placed = createPlacedLeaf(key, text, slot)
      leavesRef.current = [...working, placed]
      setLeaves(leavesRef.current)

      // 表示時間経過で自動消去する。
      const timer = setTimeout(() => removeLeaf(key), LEAF_DISPLAY_MS)
      timersRef.current.set(key, timer)
    },
    [clearTimer, removeLeaf]
  )

  // アンマウント時に全タイマーを破棄する（長時間稼働のメモリリーク対策）。
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  return { leaves, spawn }
}
