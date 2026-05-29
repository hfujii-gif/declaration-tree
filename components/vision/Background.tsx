import styles from './Background.module.scss'

// /vision の背景レイヤー。空・大地・流れる雲を描画する。
// 雲の動きは CSS アニメーションのみで実現し、JS タイマーを使わない（メモリリークの心配がない）。
export default function Background() {
  return (
    <div className={styles.background} aria-hidden="true">
      <div className={styles.sun} />
      <div className={styles.clouds}>
        <span className={`${styles.cloud} ${styles.cloud1}`} />
        <span className={`${styles.cloud} ${styles.cloud2}`} />
        <span className={`${styles.cloud} ${styles.cloud3}`} />
      </div>
      <div className={styles.ground} />
    </div>
  )
}
