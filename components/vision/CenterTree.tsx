import { forwardRef } from 'react'
import styles from './CenterTree.module.scss'

type CenterTreeProps = {
  // 成長段階（0〜4）。累計がマイルストーンを超えるごとに上がる。
  stage: number
  // 10,000人達成後の満開状態。true で粒子の発光が最大化する（#11/#45）。
  // 満開は count>=10000 由来の静的状態。フィナーレ演出は lib/animations.ts の playFullBloom が担当する。
  bloomed?: boolean
}

// キャノピー（光の粒子の塊）の中心と広がり（viewBox 0 0 200 260 基準）。
const CANOPY_CX = 100
const CANOPY_CY = 92
const CANOPY_RX = 70
const CANOPY_RY = 52
// 粒子の数。大画面でも軽い範囲に抑える（CSSの明滅のみ・JSタイマーなし）。
const PARTICLE_COUNT = 90
// 黄金角。これで均等な“ひまわり配置”になり、乱数なしでも自然に密集する。
const GOLDEN_ANGLE = 2.399963229728653

// キャノピー領域に光の粒子を均等散布する（決定的な計算＝SSRとクライアントで一致しハイドレーション不整合が出ない）。
// 乱数を使わないため毎回同じ配置になり、JSタイマーも持たない（長時間稼働でも安全）。
type Particle = { cx: number; cy: number; r: number; delay: number; dur: number }

const buildParticles = (): Particle[] => {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // ひまわり配置：中心から外側へ均等に広がる。
    const t = (i + 0.5) / PARTICLE_COUNT
    const radius = Math.sqrt(t)
    const angle = i * GOLDEN_ANGLE
    const cx = CANOPY_CX + Math.cos(angle) * radius * CANOPY_RX
    // キャノピーは上に膨らむ卵形にしたいので、上方向に少し持ち上げる。
    const cy = CANOPY_CY + Math.sin(angle) * radius * CANOPY_RY - (1 - radius) * 6
    // 外周ほど小さく、中心ほど大きい粒子にして塊感を出す。
    const r = 1.4 + (1 - radius) * 2.2
    // 明滅のばらつき（決定的）。
    const delay = (i % 12) * 0.28
    const dur = 2.4 + (i % 5) * 0.5
    particles.push({ cx, cy, r, delay, dur })
  }
  return particles
}

// モジュール読み込み時に一度だけ算出（決定的なので使い回せる）。
const PARTICLES = buildParticles()

// 中央に常設するサイバー風の木（#43）。
// 幹・枝は白〜薄い水色の発光ライン、葉エリアは光の粒子が密集したキャノピーで表現する。
// stage が上がるほどキャノピーが大きく・明るくなる。満開（data-bloomed）で発光が最大化する。
// すべて SVG＋CSSアニメーションで描き、JSタイマー・rAFを持たない（メモリリーク対策）。
// 祝祭的なパルスや満開フィナーレ演出は #45（lib/animations.ts）が担当する。
// ref は演出（パルス・満開ポップ）と #44 の吸収先座標算出のため親へ公開する。
const CenterTree = forwardRef<HTMLDivElement, CenterTreeProps>(function CenterTree(
  { stage, bloomed = false },
  ref
) {
  return (
    <div
      ref={ref}
      className={styles.treeWrap}
      data-stage={stage}
      data-bloomed={bloomed}
      aria-hidden="true"
    >
      <svg className={styles.tree} viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
        {/* 幹（発光ライン）。根元が広がるテーパー形のシルエットを細い発光線で描く。 */}
        <g className={styles.trunkGroup}>
          <path
            className={styles.trunk}
            d="M84 254 C82 226 80 206 90 178 C94 166 96 154 98 140 L102 140 C104 154 106 166 110 178 C120 206 118 226 116 254"
          />
        </g>

        {/* 枝（発光ライン）。左右で本数・角度を変えて非対称にする。 */}
        <g className={styles.branches}>
          <path className={styles.branchMain} d="M97 176 C82 170 70 160 58 146" />
          <path className={styles.branchMain} d="M103 174 C118 167 128 156 141 138" />
          <path className={styles.branchMain} d="M99 150 C95 134 97 120 101 102" />
          <path className={styles.branchTwig} d="M104 152 C112 142 120 137 131 130" />
          <path className={styles.branchTwig} d="M97 160 C88 153 80 150 70 145" />
          <path className={styles.branchTwig} d="M132 146 C138 140 142 134 145 126" />
        </g>

        {/* キャノピー＝光の粒子の塊（#44 のパーティクル吸収先）。
            stage が上がるとこの塊そのものが大きく育つ（CSSの data-stage で scale）。
            data-canopy は #44 が吸収先の中心座標を算出するためのフック。 */}
        <g className={styles.canopy} data-canopy="true">
          {PARTICLES.map((p, i) => (
            <circle
              key={i}
              className={styles.particle}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
})

export default CenterTree
