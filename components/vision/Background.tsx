import styles from './Background.module.scss'

// /vision の背景レイヤー（#43 サイバー化）。
// デジタル/ホログラム調の背景を描画する。旧・空/太陽/雲/大地は廃止。
// 動きはすべて CSS アニメーションで実現し、JS タイマー・rAF を使わない（長時間稼働でもメモリリークしない）。
export default function Background() {
  return (
    <div className={styles.background} aria-hidden="true">
      {/* 中央付近からにじむアンビエント発光 */}
      <div className={styles.ambient} />
      {/* 遠近感のある床グリッド（奥から手前へ広がる） */}
      <div className={styles.grid} />
      {/* 全面に薄くかかるスキャンライン */}
      <div className={styles.scanlines} />
      {/* ゆっくり明滅するホログラムの揺らぎ */}
      <div className={styles.flicker} />
    </div>
  )
}
