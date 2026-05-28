'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { db, ref, onValue, onChildAdded } from '@/lib/firebase'
import { MILESTONES } from '@/lib/constants'
import type { Declaration } from '@/types'
import Background from '@/components/vision/Background'
import CenterTree from '@/components/vision/CenterTree'
import LeafLayer from '@/components/vision/LeafLayer'
import { useTransientLeaves } from '@/components/vision/useTransientLeaves'
import styles from './page.module.scss'

// URL の ?stage= をクライアントでのみ読む（リハーサル用の成長段階プレビュー）。
// SSR とのハイドレーション不整合を避けるため useSyncExternalStore を使う
// （サーバーでは null、クライアントでは現在値を返し、React が安全に差し替える）。
const subscribeStageParam = (): (() => void) => () => {}
const getStageParam = (): string | null => new URLSearchParams(window.location.search).get('stage')
const getServerStageParam = (): string | null => null

export default function VisionPage() {
  const [count, setCount] = useState(0)
  // プレビュー用：URL の ?stage=0〜4 を読み、あれば木の成長段階をその値に上書きする（通常は累計件数から自動算出）。
  const stageParam = useSyncExternalStore(subscribeStageParam, getStageParam, getServerStageParam)
  const { leaves, spawn } = useTransientLeaves()
  const dbRef = useRef(ref(db, 'declarations'))
  // child_added の初期バーストが終わったか。onValue の初回発火で true にする。
  const initialLoadedRef = useRef(false)

  useEffect(() => {
    const declarationsRef = dbRef.current

    // 累計（isVisible=true の件数）→ カウンター・木の成長段階。
    // isVisible の切替（管理画面での非表示化）にも追従できるよう onValue を使う。
    const unsubscribeValue = onValue(
      declarationsRef,
      (snapshot) => {
        const data = snapshot.val()
        let visible = 0
        if (data) {
          for (const value of Object.values(data)) {
            const d = value as Omit<Declaration, 'id'>
            if (d.isVisible && typeof d.text === 'string') visible++
          }
        }
        setCount(visible)
        // child_added の初期発火がすべて終わった後に value が初回発火する Firebase の保証を利用する。
        initialLoadedRef.current = true
      },
      (error) => {
        console.error('宣言の購読に失敗しました:', error)
      }
    )

    // 新着の宣言だけテキスト葉を生成する（差分のみ受信）。
    // 初期ロード分（既存の全宣言）では葉を出さない。
    const unsubscribeChild = onChildAdded(
      declarationsRef,
      (snapshot) => {
        if (!initialLoadedRef.current) return
        const d = snapshot.val() as Omit<Declaration, 'id'> | null
        if (d && d.isVisible && typeof d.text === 'string') {
          spawn(d.text)
        }
      },
      (error) => {
        console.error('新着宣言の購読に失敗しました:', error)
      }
    )

    // メモリリーク対策：2つのリスナーをコールバック単位で個別解除する。
    return () => {
      unsubscribeValue()
      unsubscribeChild()
    }
  }, [spawn])

  // 通過したマイルストーン数を成長段階（0〜4）とする。プレビュー指定(?stage=)があればそれを優先。
  const computedStage = MILESTONES.filter((milestone) => count >= milestone).length
  const overrideStage = stageParam !== null ? Number(stageParam) : NaN
  const stage =
    Number.isInteger(overrideStage) && overrideStage >= 0 && overrideStage <= MILESTONES.length
      ? overrideStage
      : computedStage

  return (
    <div className={styles.container}>
      <Background />
      <CenterTree stage={stage} />
      <LeafLayer leaves={leaves} />
      <div className={styles.counter}>{count.toLocaleString()}人が宣言しました</div>
    </div>
  )
}
