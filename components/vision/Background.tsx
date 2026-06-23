import styles from './Background.module.scss'

// /vision の背景動画レイヤー（#52）。
// ffmpeg でシームレス化した星景の映像（末尾→先頭をクロスフェードで重ねて再エンコード）を、
// <video loop> で全画面ループ再生する。素材自体が継ぎ目なしのため、再生時の JS は不要。
// 旧・CSS描画の星空およびサイバー調要素は廃止。
// autoPlay + muted + loop + playsInline でユーザー操作なしに無限ループ再生する
//（muted でないと多くのブラウザが自動再生をブロックするため必須）。
// 木・宣言テキスト・カウンターより奥のレイヤー。
export default function Background() {
  return (
    <div className={styles.background} aria-hidden="true">
      <video
        className={styles.video}
        src="/videos/starfield-bg-seamless.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
    </div>
  )
}