import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { playDeclaration, playMilestone, playFullBloom, playGrowth } from '@/lib/animations'
import {
  DECLARATION_GAP_MS,
  DECLARATION_MAX_QUEUE,
  DECLARATION_BACKLOG_THRESHOLD,
  DECLARATION_BACKLOG_LEAD_MS,
  DECLARATION_BACKLOG_HOLD_MS,
  DECLARATION_BACKLOG_ABSORB_MS,
  DECLARATION_BACKLOG_GAP_MS,
  MILESTONE_FOLLOW_GAP_MS,
} from '@/lib/constants'

// /vision の演出ジョブ。宣言の吸収・マイルストーン・満開を1本のキューで直列に流す（#44 / #49 タスクA）。
type VisionJob =
  | { type: 'declaration'; text: string }
  | { type: 'milestone'; stage: number; count: number }
  | { type: 'bloom' }
  // 成長段階の切替（#57）。apply はピークで表示段階を進めるコールバック（page 側の state 更新）。
  | { type: 'growth'; apply: () => void }

// 戻り値：演出ジョブをキューに積む関数群。
type DeclarationStream = {
  enqueueDeclaration: (text: string) => void
  enqueueMilestone: (stage: number, count: number) => void
  enqueueBloom: () => void
  enqueueGrowth: (apply: () => void) => void
}

// /vision の演出キュー管理フック（旧 useTransientLeaves の置き換え）。
// 中央スポットライト（宣言吸収）・マイルストーン・満開を **同時に1つだけ** 直列再生する。
// これにより「達成を起こした宣言が木に吸い込まれてから、続けてマイルストーン演出が流れる」因果のある見え方になる
// （#49 タスクA。マイルストーンは page 側で count 到達時にキューへ積む）。
//
// layerRef … Celebration レイヤー（演出DOMのホスト）
// treeRef  … CenterTree（吸収先 [data-canopy] を内包）
export function useDeclarationStream(
  layerRef: RefObject<HTMLElement | null>,
  treeRef: RefObject<HTMLElement | null>
): DeclarationStream {
  // 真実源は ref に持つ（再レンダリングを起こさず、コールバックを安定させる）。
  const queueRef = useRef<VisionJob[]>([])
  const playingRef = useRef(false)
  const currentTlRef = useRef<gsap.core.Timeline | null>(null)
  // 連続時に次の演出を表示するまでの“間”のタイマー。待機中は drain しない。
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)
  // 演出完了時の再帰呼び出しを ref 経由にして、drain の自己参照を避ける。
  const drainRef = useRef<() => void>(() => {})

  const drain = useCallback((): void => {
    // 再生中／“間”の待機中／アンマウント後は何もしない。
    if (playingRef.current || gapTimerRef.current !== null || unmountedRef.current) return
    const layer = layerRef.current
    const tree = treeRef.current
    if (!layer || !tree) return // DOM 未準備（通常は起こらない）。次の enqueue で再試行される。
    const job = queueRef.current.shift()
    if (job === undefined) return

    playingRef.current = true
    let tl: gsap.core.Timeline
    if (job.type === 'declaration') {
      // バックログが溜まっているときは“間”と表示を短縮してドレインを早める（宣言のみ・極端には速くしない）。
      const backlog = queueRef.current.length
      const opts =
        backlog > DECLARATION_BACKLOG_THRESHOLD
          ? {
              leadMs: DECLARATION_BACKLOG_LEAD_MS,
              holdMs: DECLARATION_BACKLOG_HOLD_MS,
              absorbMs: DECLARATION_BACKLOG_ABSORB_MS,
            }
          : undefined
      tl = playDeclaration(job.text, layer, tree, opts)
    } else if (job.type === 'milestone') {
      tl = playMilestone(job.stage, job.count, layer, tree)
    } else if (job.type === 'growth') {
      tl = playGrowth(layer, job.apply)
    } else {
      tl = playFullBloom(layer, tree)
    }
    currentTlRef.current = tl

    tl.eventCallback('onComplete', () => {
      currentTlRef.current = null
      playingRef.current = false
      if (unmountedRef.current) return
      const next = queueRef.current[0]
      if (next === undefined) return // 次が無ければ待機（新着が来たら即時再生）。
      // 宣言→宣言は通常の“間”。マイルストーン/満開が絡む境目は短い間で詰めて因果を密に見せる。
      let gapMs: number
      if (job.type !== 'declaration' || next.type !== 'declaration') {
        gapMs = MILESTONE_FOLLOW_GAP_MS
      } else {
        gapMs =
          queueRef.current.length > DECLARATION_BACKLOG_THRESHOLD
            ? DECLARATION_BACKLOG_GAP_MS
            : DECLARATION_GAP_MS
      }
      gapTimerRef.current = setTimeout(() => {
        gapTimerRef.current = null
        drainRef.current()
      }, gapMs)
    })
  }, [layerRef, treeRef])

  // 最新の drain を ref に保持する（onComplete からの再帰呼び出し用）。
  useEffect(() => {
    drainRef.current = drain
  }, [drain])

  const enqueueDeclaration = useCallback((text: string): void => {
    if (unmountedRef.current) return
    // 上限超過は捨てる（無音で打ち切らず可視化する）。マイルストーン/満開はこの上限の対象外（取りこぼさない）。
    if (queueRef.current.length >= DECLARATION_MAX_QUEUE) {
      console.warn(
        `[vision] 宣言演出キューが上限(${DECLARATION_MAX_QUEUE})に達したため1件スキップしました`
      )
      return
    }
    queueRef.current.push({ type: 'declaration', text })
    drainRef.current()
  }, [])

  const enqueueMilestone = useCallback((stage: number, count: number): void => {
    if (unmountedRef.current) return
    queueRef.current.push({ type: 'milestone', stage, count })
    drainRef.current()
  }, [])

  const enqueueBloom = useCallback((): void => {
    if (unmountedRef.current) return
    queueRef.current.push({ type: 'bloom' })
    drainRef.current()
  }, [])

  // 成長段階の切替（#57）。宣言・マイルストーンと同じ上限対象外で取りこぼさない。
  const enqueueGrowth = useCallback((apply: () => void): void => {
    if (unmountedRef.current) return
    queueRef.current.push({ type: 'growth', apply })
    drainRef.current()
  }, [])

  // アンマウント時：進行中タイムラインを kill し、キューを空にする（長時間稼働のメモリリーク対策）。
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      queueRef.current = []
      playingRef.current = false
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current)
        gapTimerRef.current = null
      }
      if (currentTlRef.current) {
        currentTlRef.current.kill()
        currentTlRef.current = null
      }
    }
  }, [])

  return { enqueueDeclaration, enqueueMilestone, enqueueBloom, enqueueGrowth }
}
