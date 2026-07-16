'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { db, ref, onValue, onChildAdded, set, serverTimestamp } from '@/lib/firebase'
import { MILESTONES, computeGrowthLevel, VISION_TELEMETRY_INTERVAL_MS, type GrowthLevel } from '@/lib/constants'
import type { Declaration, VisionStatus } from '@/types'
import Background from '@/components/vision/Background'
import ShootingStars from '@/components/vision/ShootingStars'
import Saturn from '@/components/vision/Saturn'
import Ufo from '@/components/vision/Ufo'
import Comet from '@/components/vision/Comet'
import Rocket from '@/components/vision/Rocket'
import Whale from '@/components/vision/Whale'
import Manta from '@/components/vision/Manta'
import Jellyfish from '@/components/vision/Jellyfish'
import SeaTurtle from '@/components/vision/SeaTurtle'
import Dolphin from '@/components/vision/Dolphin'
import Seahorse from '@/components/vision/Seahorse'
import CenterTree from '@/components/vision/CenterTree'
import Counter from '@/components/vision/Counter'
import Celebration from '@/components/vision/Celebration'
import { useDeclarationStream } from '@/components/vision/useDeclarationStream'
import { useDecorationSettings } from '@/components/vision/useDecorationSettings'
import { useCanopyLayers } from '@/components/vision/useCanopyLayers'
import { playMilestone, playFullBloom, clearCelebrations } from '@/lib/animations'
import styles from './page.module.scss'

// URL クエリをクライアントでのみ読むためのヘルパー（リハーサル用プレビュー ?celebrate= / ?growth=）。
// SSR とのハイドレーション不整合を避けるため useSyncExternalStore を使う
// （サーバーでは null、クライアントでは現在値を返し、React が安全に差し替える）。
const subscribeStageParam = (): (() => void) => () => {}
const getServerStageParam = (): string | null => null

// リハーサル用：?celebrate=2500|5000|7500|10000 で各段階の達成演出を1回だけ再生する。
// Firebase に書き込まずクライアントのみで発火するため、本番でも無害（?stage= と同じ方針）。
const getCelebrateParam = (): string | null =>
  new URLSearchParams(window.location.search).get('celebrate')

// リハーサル用：?growth=0|1|2 で木の成長段階（小/中/大）を上書きプレビューする（#57）。
const getGrowthParam = (): string | null =>
  new URLSearchParams(window.location.search).get('growth')

// ペイント前に走る layout effect。SSR では警告になるためクライアントのみ useLayoutEffect を使う。
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function VisionPage() {
  const [count, setCount] = useState(0)
  // カウンターの表示値（#67）。目標値 count とは分け、宣言の吸収が終わるたびに1件ずつ進める。
  // これで「テキスト→木へ吸収→カウンターが増える」の因果が揃い、連続送信時の先走りを防ぐ。
  const [displayedCount, setDisplayedCount] = useState(0)
  // 最新の目標件数（onValue の isVisible 件数）。吸収完了コールバック内で上限クランプ・スナップに使う。
  const countTargetRef = useRef(0)
  // 吸収待ちの宣言数（キュー投入〜吸収完了）。0 のあいだは演出が進行していないので目標値へ即追従してよい（#67）。
  // これで child_added を伴わない増加（管理画面の「再表示」＝child_changed）にもカウンターが追従する。
  const pendingAbsorbRef = useRef(0)
  // 表示中の木の成長段階（#57）。件数から算出する目標段階とは分け、宣言の吸収が終わってから
  // キュー経由で1段階ずつ進める（発光トランジションで差し替え）。起動時は現在件数の段階を即適用する。
  const [displayedGrowth, setDisplayedGrowth] = useState<GrowthLevel>(0)
  // キューへ積み済みの最新の成長段階（単調増加）。二重積み・起動時の一斉発火を防ぐ。
  const enqueuedGrowthRef = useRef<GrowthLevel>(0)
  // プレビュー用：URL の ?celebrate= を読み、あれば該当段階の達成演出を1回だけ再生する。
  const celebrateParam = useSyncExternalStore(subscribeStageParam, getCelebrateParam, getServerStageParam)
  // プレビュー用：URL の ?growth=0|1|2 を読み、あれば木の成長段階（小/中/大）を上書きする（#57）。
  const growthParam = useSyncExternalStore(subscribeStageParam, getGrowthParam, getServerStageParam)
  const dbRef = useRef(ref(db, 'declarations'))
  // child_added の初期バーストが終わったか。onValue の初回発火で true にする。
  const initialLoadedRef = useRef(false)
  // 発火済みの最上位マイルストーンの index（-1=未発火）。単調増加で管理し、
  // 「複数を跨いだら最大の1つだけ発火」「減少後の再通過では再発火しない」を両立する。
  const firedIndexRef = useRef(-1)
  // 演出DOMのホスト（Celebration レイヤー）と、パルス・満開ポップの対象（CenterTree）。
  const celebrationRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  // 宣言の吸収・マイルストーン・満開を1本のキューで直列再生する（#49 タスクA）。
  const { enqueueDeclaration, enqueueMilestone, enqueueBloom, enqueueGrowth, getStats } =
    useDeclarationStream(celebrationRef, treeRef)
  // モニタリング（#70）：onChildAdded 受信累計と、interval から最新値を読むためのミラー ref。
  const receivedTotalRef = useRef(0)
  const displayedCountRef = useRef(0)
  const growthLevelRef = useRef<GrowthLevel>(0)
  // ?celebrate= プレビューの二度焚き防止。
  const celebratedRef = useRef(false)
  // 装飾演出（#55）の ON/OFF（管理画面 settings/decorations）。未設定は全 ON。
  const decorations = useDecorationSettings()
  // 樹冠の葉の重なり密度（#60）。管理画面（settings/canopyLayers）で 1〜5。未設定は既定 3。
  const canopyLayers = useCanopyLayers()

  // 大画面ビジョン（2m×4m・横長）対応（#56）。ビューポート高さ／基準高さ1080 の「単位なしの比率」を
  // CSS変数 --screen-scale に入れ、木・カウンター・テキストを比例拡大させる。
  // CSS だけでは長さから単位なしの数値を作れないため JS で算出する。
  // 初回はペイント前（layout effect）に適用し、フォールバック1→実値への切替が transition で
  // “ポップ”して見えるのを防ぐ（高解像度出力でのロード時拡大アニメを抑止）。
  useIsomorphicLayoutEffect(() => {
    const BASE_HEIGHT = 1080
    const applyScale = (): void => {
      const scale = window.innerHeight / BASE_HEIGHT
      document.documentElement.style.setProperty('--screen-scale', String(scale))
    }
    applyScale()
    window.addEventListener('resize', applyScale)
    return () => {
      window.removeEventListener('resize', applyScale)
      document.documentElement.style.removeProperty('--screen-scale')
    }
  }, [])

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
        countTargetRef.current = visible
        setCount(visible)
        // child_added の初期発火がすべて終わった後に value が初回発火する Firebase の保証を利用する。
        // 初回は到達済みのマイルストーンを発火済みとして記録し、起動時の一斉発火を抑止する。
        if (!initialLoadedRef.current) {
          firedIndexRef.current = MILESTONES.filter((milestone) => visible >= milestone).length - 1
          // 起動時：現在件数の成長段階を「発火済み」として即適用する（トランジションなしで正しい段階から始める）。
          const initialGrowth = computeGrowthLevel(visible)
          enqueuedGrowthRef.current = initialGrowth
          setDisplayedGrowth(initialGrowth)
          // カウンターも起動時は現在件数へ即スナップ（既存分を1件ずつ演出しない・#67）。
          setDisplayedCount(visible)
          initialLoadedRef.current = true
        } else {
          // 吸収待ちが無いときは目標値へ即追従する（#67）。
          // 非表示化＝減少・再表示（child_changed で child_added が来ない）＝増加のどちらも「吸収」の対象外のため即反映。
          // 吸収待ちがあるあいだは増加を吸収完了コールバック側に任せ、減少のみ即クランプする。
          setDisplayedCount((dc) => (pendingAbsorbRef.current === 0 ? visible : Math.min(dc, visible)))
        }
      },
      (error) => {
        console.error('宣言の購読に失敗しました:', error)
      }
    )

    // 新着の宣言だけ吸収演出をキューに積む（差分のみ受信）。
    // 初期ロード分（既存の全宣言）では演出を出さない。
    const unsubscribeChild = onChildAdded(
      declarationsRef,
      (snapshot) => {
        if (!initialLoadedRef.current) return
        const d = snapshot.val() as Omit<Declaration, 'id'> | null
        if (d && d.isVisible && typeof d.text === 'string') {
          receivedTotalRef.current++ // 受信累計（#70 モニタリング）
          // 吸収完了ごとにカウンターを1件進める（#67）。目標件数を超えないようクランプし、
          // drained（宣言バーストの末尾）ではドロップ分も含め実数へスナップして最終値を必ず一致させる。
          const enqueued = enqueueDeclaration(d.text, (drained) => {
            pendingAbsorbRef.current = drained ? 0 : Math.max(0, pendingAbsorbRef.current - 1)
            setDisplayedCount((dc) =>
              drained ? countTargetRef.current : Math.min(dc + 1, countTargetRef.current)
            )
          })
          // 実際に積めた分だけ吸収待ちを数える（上限超過ドロップは onAbsorbed が呼ばれないため加算しない）。
          if (enqueued) pendingAbsorbRef.current++
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
  }, [enqueueDeclaration])

  // 累計が新しいマイルストーンに到達したとき、その「最上位の1つだけ」を演出キューへ積む（#49 タスクA）。
  // 即発火せずキューに積むことで、到達を起こした宣言の吸収演出が終わってからマイルストーンが流れる。
  // firedIndexRef を単調増加で管理するため、初期ロード・減少後の再通過・二度焚きでは積まない。
  // 1回の更新で複数のしきい値を跨いでも（再接続のバッファ一括反映・一括投入時）最大の1つだけを積む。
  useEffect(() => {
    if (!initialLoadedRef.current) return
    const targetIndex = MILESTONES.filter((milestone) => count >= milestone).length - 1
    if (targetIndex <= firedIndexRef.current) return
    firedIndexRef.current = targetIndex
    if (targetIndex === MILESTONES.length - 1) {
      // 10,000人＝満開フィナーレ。
      enqueueBloom()
    } else {
      // 中間マイルストーン演出。現在は MILESTONES=[10000] のため到達不能（達成演出は満開のみ #57）。
      // 中間の派手演出（2,500/5,000/7,500 等）を将来復活させる場合の受け口として enqueueMilestone/playMilestone を残す。
      enqueueMilestone(targetIndex + 1, MILESTONES[targetIndex])
    }
  }, [count, enqueueMilestone, enqueueBloom])

  // 成長段階（#57）が上がったら、キューへ積んで宣言の吸収の後に発光トランジションで切り替える。
  // 即座に表示段階を変えず、キュー経由（enqueueGrowth）にすることで「宣言が吸い込まれた→木が成長」の因果順にする。
  // enqueuedGrowthRef を単調増加で管理し、初期ロード・二度積みを防ぐ。まとめて跨いだ場合は1段階ずつ積む。
  useEffect(() => {
    if (!initialLoadedRef.current) return
    const target = computeGrowthLevel(count)
    while (enqueuedGrowthRef.current < target) {
      const next = (enqueuedGrowthRef.current + 1) as GrowthLevel
      enqueuedGrowthRef.current = next
      enqueueGrowth(() => setDisplayedGrowth(next))
    }
  }, [count, enqueueGrowth])

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

  // モニタリング（#70）：state を interval 内で最新参照するためのミラー。
  useEffect(() => {
    displayedCountRef.current = displayedCount
  }, [displayedCount])

  // モニタリング（#70）：/vision の稼働状況を settings/visionStatus に定期書き込みする。
  // 管理画面がこれを購読してキュー滞留・スループット・接続状況を表示する。
  useEffect(() => {
    const statusRef = ref(db, 'settings/visionStatus')
    let prevAnimated = getStats().animatedTotal
    let prevAt = Date.now()
    const write = async (): Promise<void> => {
      const stats = getStats()
      const nowMs = Date.now()
      const elapsed = nowMs - prevAt
      // ローリングのスループット（件/分）：吸収完了差分を「実経過時間」で割る。
      // setInterval は負荷・非アクティブで遅延・間引きされるため、公称間隔で割ると過大に出る（#70 レビュー対応）。
      const throughputPerMin =
        elapsed > 0 ? Math.round((stats.animatedTotal - prevAnimated) / (elapsed / 60000)) : 0
      prevAnimated = stats.animatedTotal
      prevAt = nowMs
      const target = countTargetRef.current
      const displayed = displayedCountRef.current
      // updatedAt はサーバー時刻（serverTimestamp）で書く。管理画面が /.info/serverTimeOffset で
      // クロック差を補正し、値の実年齢で接続判定できるようにするため（残留ノードの誤「稼働中」を防ぐ・#70 レビュー対応）。
      const status: Omit<VisionStatus, 'updatedAt'> = {
        queueLength: stats.queueLength,
        receivedTotal: receivedTotalRef.current,
        animatedTotal: stats.animatedTotal,
        droppedTotal: stats.droppedTotal,
        displayedCount: displayed,
        targetCount: target,
        lag: Math.max(0, target - displayed),
        throughputPerMin,
        growthLevel: growthLevelRef.current,
      }
      try {
        await set(statusRef, { ...status, updatedAt: serverTimestamp() })
      } catch (e) {
        console.error('モニタリング状態の書き込みに失敗しました:', e)
      }
    }
    const id = setInterval(write, VISION_TELEMETRY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [getStats])

  // 木の成長段階（#57）。通常は表示段階（キュー経由で吸収後に進む displayedGrowth）を使う。
  // プレビュー指定(?growth=0|1|2)があれば、それを優先してトランジションなしで即表示する（デザイン確認用）。
  const overrideGrowth = growthParam !== null ? Number(growthParam) : NaN
  const growthLevel: GrowthLevel =
    Number.isInteger(overrideGrowth) && overrideGrowth >= 0 && overrideGrowth <= 2
      ? (overrideGrowth as GrowthLevel)
      : displayedGrowth

  // モニタリング（#70）：growthLevel を interval 内で最新参照するためのミラー。
  useEffect(() => {
    growthLevelRef.current = growthLevel
  }, [growthLevel])

  return (
    <div className={styles.container}>
      <Background />
      {/* 装飾演出（#55）は管理画面（settings/decorations）で個別 ON/OFF できる。未設定は ON。
          背景映像の前・木の後ろのレイヤー（z-index:1）。 */}
      {decorations.shootingStars && <ShootingStars />}
      {decorations.saturn && <Saturn />}
      {decorations.ufo && <Ufo />}
      {decorations.comet && <Comet />}
      {decorations.rocket && <Rocket />}
      {decorations.whale && <Whale />}
      {decorations.manta && <Manta />}
      {decorations.jellyfish && <Jellyfish />}
      {decorations.seaTurtle && <SeaTurtle />}
      {decorations.dolphin && <Dolphin />}
      {decorations.seahorse && <Seahorse />}
      {/* 満開の発光は playFullBloom（フィナーレ）中だけの一時的な演出にした。到達後に光り続ける
          定着（旧 data-bloomed）は廃止したため bloomed は渡さない（通常の大の木に戻る）。 */}
      <CenterTree ref={treeRef} growthLevel={growthLevel} layers={canopyLayers} />
      <Counter value={displayedCount} />
      <Celebration ref={celebrationRef} />
    </div>
  )
}
