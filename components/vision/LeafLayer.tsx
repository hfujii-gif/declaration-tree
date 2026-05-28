import type { PlacedLeaf } from './useTransientLeaves'
import LeafItem from './LeafItem'
import styles from './LeafLayer.module.scss'

type LeafLayerProps = {
  leaves: PlacedLeaf[]
}

// テキスト葉を重ねて表示するレイヤー。配置やライフサイクルは useTransientLeaves が管理し、
// このコンポーネントは受け取った葉を描画するだけ（presentational）。
export default function LeafLayer({ leaves }: LeafLayerProps) {
  return (
    <div className={styles.layer} aria-hidden="true">
      {leaves.map((leaf) => (
        <LeafItem key={leaf.key} leaf={leaf} />
      ))}
    </div>
  )
}
