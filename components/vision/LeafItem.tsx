import { LEAF_DISPLAY_MS } from '@/lib/constants'
import type { PlacedLeaf } from './useTransientLeaves'
import styles from './LeafLayer.module.scss'

type LeafItemProps = {
  leaf: PlacedLeaf
}

// 宣言の全文が書かれた横向きのテキスト葉1枚。配置・色・サイズ・回転は個体ごとに異なる。
// 主葉脈から左右に枝分かれする側脈を SVG で描く。
// フェードイン→フェードアウトは CSS アニメーション（duration は LEAF_DISPLAY_MS と一致させる）。
export default function LeafItem({ leaf }: LeafItemProps) {
  const { text, xPercent, yPercent, variant } = leaf
  return (
    <div
      className={`${styles.leaf} ${styles[`shape${variant.shape}`]}`}
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: `translate(-50%, -50%) scale(${variant.scale}) rotate(${variant.rotate}deg)`,
        backgroundColor: `var(${variant.colorVar})`,
        animationDuration: `${LEAF_DISPLAY_MS}ms`,
      }}
    >
      <svg
        className={styles.veins}
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g className={styles.veinLines}>
          {/* 主葉脈（左右に走る） */}
          <path d="M8 30 H94" />
          {/* 側脈（主脈から斜めに枝分かれ） */}
          <path d="M28 30 L16 14" />
          <path d="M28 30 L16 46" />
          <path d="M44 30 L31 11" />
          <path d="M44 30 L31 49" />
          <path d="M60 30 L48 13" />
          <path d="M60 30 L48 47" />
          <path d="M76 30 L66 17" />
          <path d="M76 30 L66 43" />
        </g>
      </svg>
      <span className={styles.leafText}>{text}</span>
    </div>
  )
}
