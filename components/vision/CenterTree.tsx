import { forwardRef } from 'react'
import styles from './CenterTree.module.scss'

type CenterTreeProps = {
  // 成長段階（0〜4）。累計がマイルストーンを超えるごとに上がる。
  stage: number
  // 10,000人達成後の満開状態。true で粒子の発光が最大化する（#11/#45）。
  // 満開は count>=10000 由来の静的状態。フィナーレ演出は lib/animations.ts の playFullBloom が担当する。
  bloomed?: boolean
}

// 黄金角。クラスター内に粒子を均等な“ひまわり配置”で散らすのに使う（乱数なし＝決定的）。
const GOLDEN_ANGLE = 2.399963229728653

// 葉の粒子クラスターの中心（viewBox 0 0 200 260 基準）。枝先・枝沿いに配置し、
// 「幹→枝→葉（粒子）」の構造が読めるようにする。spread は広がり、count は粒子数。
type Cluster = { cx: number; cy: number; spread: number; count: number }

const CLUSTERS: Cluster[] = [
  { cx: 100, cy: 50, spread: 20, count: 14 }, // 頂点
  { cx: 78, cy: 70, spread: 18, count: 12 }, // 上・左
  { cx: 122, cy: 70, spread: 18, count: 12 }, // 上・右
  { cx: 60, cy: 96, spread: 18, count: 12 }, // 中・左
  { cx: 140, cy: 96, spread: 18, count: 12 }, // 中・右
  { cx: 96, cy: 86, spread: 16, count: 11 }, // 内・左
  { cx: 116, cy: 86, spread: 16, count: 11 }, // 内・右
  { cx: 44, cy: 124, spread: 16, count: 10 }, // 下・左外
  { cx: 156, cy: 124, spread: 16, count: 10 }, // 下・右外
  { cx: 78, cy: 118, spread: 16, count: 11 }, // 下・左
  { cx: 122, cy: 118, spread: 16, count: 11 }, // 下・右
  { cx: 100, cy: 110, spread: 16, count: 11 }, // 中央下
]

type Particle = { cx: number; cy: number; r: number; delay: number; dur: number }

// 各クラスター内に粒子を決定的に散布する（SSRとクライアントで一致＝ハイドレーション不整合なし）。
// 乱数・JSタイマーを使わないため毎回同じ配置になり、長時間稼働でも安全。
const buildParticles = (): Particle[] => {
  const particles: Particle[] = []
  let index = 0
  for (const cluster of CLUSTERS) {
    for (let j = 0; j < cluster.count; j++) {
      const t = (j + 0.5) / cluster.count
      const radius = Math.sqrt(t) * cluster.spread
      const angle = j * GOLDEN_ANGLE
      const cx = cluster.cx + Math.cos(angle) * radius
      const cy = cluster.cy + Math.sin(angle) * radius
      // 中心ほど大きい粒子で塊感を出す。
      const r = 1.3 + (1 - t) * 1.7
      // 明滅のばらつき（決定的）。
      const delay = (index % 12) * 0.26
      const dur = 2.4 + (index % 5) * 0.5
      particles.push({ cx, cy, r, delay, dur })
      index++
    }
  }
  return particles
}

// モジュール読み込み時に一度だけ算出（決定的なので使い回せる）。
const PARTICLES = buildParticles()

// 中央に常設するサイバー風の木（#43）。「写実寄りの発光樹」。
// 太めの発光する幹＋枝分かれした枝に、光の粒子を葉として密に載せる。
// stage が上がるほどキャノピー（葉の粒子群）が大きく・明るくなる。満開（data-bloomed）で発光が最大化。
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
        <defs>
          {/* 発光する幹の縦グラデーション（上が明るく、根元がシアン寄り） */}
          <linearGradient id="cyberTrunk" x1="0" y1="0" x2="0" y2="1">
            <stop className={styles.trunkStopTop} offset="0%" />
            <stop className={styles.trunkStopBottom} offset="100%" />
          </linearGradient>
        </defs>

        {/* 幹（太めの発光する塊）。根元が広がるテーパー形。 */}
        <path
          className={styles.trunk}
          d="M84 254 C82 226 80 206 90 178 C94 166 96 154 98 140 L102 140 C104 154 106 166 110 178 C120 206 118 226 116 254 Z"
        />

        {/* 枝（発光ライン）。幹から何回も枝分かれして上・外へ広がる。 */}
        <g className={styles.branches}>
          {/* 主枝：中央の背骨と左右の大枝 */}
          <path className={styles.branchMain} d="M100 150 C100 122 100 96 100 58" />
          <path className={styles.branchMain} d="M99 160 C86 144 74 128 62 104" />
          <path className={styles.branchMain} d="M101 160 C114 144 126 128 138 104" />
          {/* 二次枝 */}
          <path className={styles.branchSub} d="M98 172 C82 162 68 156 50 142" />
          <path className={styles.branchSub} d="M102 172 C118 162 132 156 150 142" />
          <path className={styles.branchSub} d="M100 134 C94 118 88 104 80 90" />
          <path className={styles.branchSub} d="M100 134 C106 118 112 104 120 90" />
          {/* 小枝（樹冠の端へ伸ばす） */}
          <path className={styles.branchTwig} d="M82 122 C76 112 70 106 60 98" />
          <path className={styles.branchTwig} d="M118 122 C124 112 130 106 140 98" />
          <path className={styles.branchTwig} d="M90 100 C86 90 84 82 84 72" />
          <path className={styles.branchTwig} d="M110 100 C114 90 116 82 116 72" />
        </g>

        {/* キャノピー＝葉の粒子（#44 のパーティクル吸収先）。
            枝先・枝沿いのクラスターに散らし、幹→枝→葉の構造を保つ。
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
