import { forwardRef } from 'react'
import styles from './Celebration.module.scss'

// マイルストーン達成演出（光ベール・フラッシュ・光線・紙吹雪・花びら・達成テキスト）の描画ホスト。
// 演出DOMは lib/animations.ts がこのレイヤー要素の直下に生成・破棄する。
// このコンポーネント自身は空の最前面レイヤー（pointer-events:none）で、ref で要素を親へ公開する。
const Celebration = forwardRef<HTMLDivElement>(function Celebration(_props, ref) {
  return <div ref={ref} className={styles.layer} aria-hidden="true" />
})

export default Celebration
