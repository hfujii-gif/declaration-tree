'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { db, ref, onValue, onChildAdded } from '@/lib/firebase'
import { MILESTONES } from '@/lib/constants'
import type { Declaration } from '@/types'
import Background from '@/components/vision/Background'
import CenterTree from '@/components/vision/CenterTree'
import LeafLayer from '@/components/vision/LeafLayer'
import Celebration from '@/components/vision/Celebration'
import { useTransientLeaves } from '@/components/vision/useTransientLeaves'
import { playMilestone, playFullBloom, clearCelebrations } from '@/lib/animations'
import styles from './page.module.scss'

// URL の ?stage= をクライアントでのみ読む（リハーサル用の成長段階プレビュー）。
// SSR とのハイドレーション不整合を避けるため useSyncExternalStore を使う
// （サーバーでは null、クライアントでは現在値を返し、React が安全に差し替える）。
const subscribeStageParam = (): (() => void) => () => {}
const getStageParam = (): string | null => new URLSearchParams(window.location.search).get('stage')
const getServerStageParam = (): string | null => null

// リハーサル用：?celebrate=2500|5000|7500|10000 で各段階の達成演出を1回だけ再生する。
// Firebase に書き込まずクライアントのみで発火するため、本番でも無害（?stage= と同じ方針）。
const getCelebrateParam = (): string | null =>
  new URLSearchParams(window.location.search).get('celebrate')

export default function VisionPage() {
  const [count, setCount] = useState(0)
  // プレビュー用：URL の ?stage=0〜4 を読み、あれば木の成長段階をその値に上書きする（通常は累計件数から自動算出）。
  const stageParam = useSyncExternalStore(subscribeStageParam, getStageParam, getServerStageParam)
  // プレビュー用：URL の ?celebrate= を読み、あれば該当段階の達成演出を1回だけ再生する。
  const celebrateParam = useSyncExternalStore(subscribeStageParam, getCelebrateParam, getServerStageParam)
  const { leaves, spawn } = useTransientLeaves()
  const dbRef = useRef(ref(db, 'declarations'))
  // child_added の初期バーストが終わったか。onValue の初回発火で true にする。
  const initialLoadedRef = useRef(false)
  // マイルストーン演出用。前回の累計（上向き通過の判定に使う）と、満開フィナーレの二度焚き防止。
  const prevCountRef = useRef(0)
  const fullBloomPlayedRef = useRef(false)
  // 演出DOMのホスト（Celebration レイヤー）と、パルス・満開ポップの対象（CenterTree）。
  const celebrationRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  // ?celebrate= プレビューの二度焚き防止。
  const celebratedRef = useRef(false)

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
        // 初回は前回値を初期件数で埋め、起動時に過去のマイルストーン演出を一斉発火させない。
        if (!initialLoadedRef.current) {
          prevCountRef.current = visible
          initialLoadedRef.current = true
        }
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

  // 累計が上向きにマイルストーンを通過した瞬間だけ達成演出を発火する。
  // 初期ロード（prevCountRef を初期件数で初期化済み）・減少時・二度焚きは発火しない。
  useEffect(() => {
    if (!initialLoadedRef.current) return
    const prev = prevCountRef.current
    if (count <= prev) {
      prevCountRef.current = count
      return
    }
    const layer = celebrationRef.current
    const tree = treeRef.current
    MILESTONES.forEach((milestone, index) => {
      if (prev < milestone && count >= milestone && layer && tree) {
        if (index === MILESTONES.length - 1) {
          // 10,000人＝満開フィナーレ。一度だけ。
          if (!fullBloomPlayedRef.current) {
            fullBloomPlayedRef.current = true
            playFullBloom(layer, tree)
          }
        } else {
          // 2,500/5,000/7,500＝段階が上がるほど派手に。
          playMilestone(index + 1, milestone, layer, tree)
        }
      }
    })
    prevCountRef.current = count
  }, [count])

  // ?celebrate= プレビュー：指定されたマイルストーンの達成演出を1回だけ再生する（リハーサル用）。
  useEffect(() => {
    if (celebratedRef.current || celebrateParam === null) return
    const value = Number(celebrateParam)
    const index = MILESTONES.findIndex((milestone) => milestone === value)
    const layer = celebrationRef.current
    const tree = treeRef.current
    if (index === -1 || !layer || !tree) return
    celebratedRef.current = true
    if (index === MILESTONES.length - 1) {
      playFullBloom(layer, tree)
    } else {
      playMilestone(index + 1, MILESTONES[index], layer, tree)
    }
  }, [celebrateParam])

  // アンマウント時に進行中の演出 Tween・生成済みDOMを片付ける（長時間稼働のメモリリーク対策）。
  // レイヤー/木のDOMはマウント中ずっと同一なので、マウント時に掴んでクリーンアップで使う。
  useEffect(() => {
    const layer = celebrationRef.current
    const tree = treeRef.current
    return () => clearCelebrations(layer, tree)
  }, [])

  // 通過したマイルストーン数を成長段階（0〜4）とする。プレビュー指定(?stage=)があればそれを優先。
  const computedStage = MILESTONES.filter((milestone) => count >= milestone).length
  const overrideStage = stageParam !== null ? Number(stageParam) : NaN
  const stage =
    Number.isInteger(overrideStage) && overrideStage >= 0 && overrideStage <= MILESTONES.length
      ? overrideStage
      : computedStage
  // 最終段階＝満開。?stage= プレビュー、および ?celebrate=10000 プレビューでも満開を確認できるようにする。
  const lastMilestone = MILESTONES[MILESTONES.length - 1]
  const bloomed =
    stage === MILESTONES.length || (celebrateParam !== null && Number(celebrateParam) === lastMilestone)

  return (
    <div className={styles.container}>
      <Background />
      <CenterTree ref={treeRef} stage={stage} bloomed={bloomed} />
      <LeafLayer leaves={leaves} />
      <div className={styles.counter}>{count.toLocaleString()}人が宣言しました</div>
      <Celebration ref={celebrationRef} />
    </div>
  )
}
