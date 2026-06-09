import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { playDeclaration } from '@/lib/animations'
import { DECLARATION_MAX_QUEUE } from '@/lib/constants'

// 宣言吸収演出（#44）のキュー管理フック。
// 中央スポットライトは同時に1つだけ再生し、新着宣言は直列に1件ずつ消化する
// （iPad 25台同時送信などのバーストでも破綻させない）。旧 useTransientLeaves の置き換え。
//
// layerRef … Celebration レイヤー（演出DOMのホスト）
// treeRef  … CenterTree（吸収先 [data-canopy] を内包）
// 戻り値の enqueue(text) を onChildAdded から呼ぶ。
export function useDeclarationStream(
  layerRef: RefObject<HTMLElement | null>,
  treeRef: RefObject<HTMLElement | null>
): (text: string) => void {
  // 真実源は ref に持つ（再レンダリングを起こさず、コールバックを安定させる）。
  const queueRef = useRef<string[]>([])
  const playingRef = useRef(false)
  const currentTlRef = useRef<gsap.core.Timeline | null>(null)
  const unmountedRef = useRef(false)
  // 演出完了時の再帰呼び出しを ref 経由にして、drain の自己参照を避ける。
  const drainRef = useRef<() => void>(() => {})

  const drain = useCallback((): void => {
    if (playingRef.current || unmountedRef.current) return
    const layer = layerRef.current
    const tree = treeRef.current
    if (!layer || !tree) return // DOM 未準備（通常は起こらない）。次の enqueue で再試行される。
    const text = queueRef.current.shift()
    if (text === undefined) return

    playingRef.current = true
    // バックログが溜まっているときは表示を短縮してドレインを早める。
    const backlog = queueRef.current.length
    const opts = backlog > 4 ? { holdMs: 450, absorbMs: 1100 } : undefined
    const tl = playDeclaration(text, layer, tree, opts)
    currentTlRef.current = tl
    tl.eventCallback('onComplete', () => {
      currentTlRef.current = null
      playingRef.current = false
      drainRef.current() // 次の1件へ
    })
  }, [layerRef, treeRef])

  // 最新の drain を ref に保持する（onComplete からの再帰呼び出し用）。
  useEffect(() => {
    drainRef.current = drain
  }, [drain])

  const enqueue = useCallback((text: string): void => {
    if (unmountedRef.current) return
    // 上限超過は捨てる（無音で打ち切らず可視化する）。
    if (queueRef.current.length >= DECLARATION_MAX_QUEUE) {
      console.warn(
        `[vision] 宣言演出キューが上限(${DECLARATION_MAX_QUEUE})に達したため1件スキップしました`
      )
      return
    }
    queueRef.current.push(text)
    drainRef.current()
  }, [])

  // アンマウント時：進行中タイムラインを kill し、キューを空にする（長時間稼働のメモリリーク対策）。
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      queueRef.current = []
      playingRef.current = false
      if (currentTlRef.current) {
        currentTlRef.current.kill()
        currentTlRef.current = null
      }
    }
  }, [])

  return enqueue
}
