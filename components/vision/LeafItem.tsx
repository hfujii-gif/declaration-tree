import type { Declaration } from '@/types'
import styles from './Tree.module.scss'

type LeafItemProps = {
  declaration: Declaration
}

// 葉1枚を描画する presentational コンポーネント。
// #10 では静的に描画するのみ。出現アニメーション（GSAP）は #11 で付与する。
export default function LeafItem({ declaration }: LeafItemProps) {
  return <span className={styles.leaf} title={declaration.text} aria-hidden="true" />
}
