import styles from './CenterTree.module.scss'

type CenterTreeProps = {
  // 成長段階（0〜4）。累計がマイルストーンを超えるごとに上がる。
  stage: number
}

// 中央に常設する枝分かれの木。stage が上がるほど大きく・葉が増える。
// 葉のかたまりは単色（濃緑）のデコボコした有機的なシルエットの塊として描く。
// 単色にすることで重なりの継ぎ目が出ず、一枚の塊として見える。
// サイズ/葉の量の変化は CSS の transition で滑らかに行う。
// 祝祭的なパルスや達成テキストなどの演出は #11 のスコープ。
export default function CenterTree({ stage }: CenterTreeProps) {
  return (
    <div className={styles.treeWrap} data-stage={stage} aria-hidden="true">
      <svg className={styles.tree} viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* 幹・枝の木目グラデーション（円柱状の陰影） */}
          <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop className={styles.trunkStopLight} offset="0%" />
            <stop className={styles.trunkStopMid} offset="45%" />
            <stop className={styles.trunkStopDark} offset="100%" />
          </linearGradient>
          {/* 葉のかたまりに落とすやわらかい影 */}
          <filter id="leafShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 地面の落ち影 */}
        <ellipse className={styles.groundShadow} cx="100" cy="252" rx="58" ry="9" />

        {/* 幹（根元が広がるテーパー形）＋木目線 */}
        <path
          className={styles.trunk}
          d="M84 254 C82 226 80 206 90 178 C94 166 96 154 98 140 L102 140 C104 154 106 166 110 178 C120 206 118 226 116 254 Z"
        />
        <path className={styles.bark} d="M96 246 C95 216 93 186 98 156" />
        <path className={styles.bark} d="M104 242 C105 214 107 188 102 160" />

        {/* 枝（太→細でテーパー）。左右で本数・角度を変えて非対称にする。 */}
        <g className={styles.branches}>
          <path className={styles.branchMain} d="M97 176 C82 170 70 160 58 146" />
          <path className={styles.branchMain} d="M103 174 C118 167 128 156 141 138" />
          <path className={styles.branchMain} d="M99 150 C95 134 97 120 101 102" />
          <path className={styles.branchTwig} d="M104 152 C112 142 120 137 131 130" />
          <path className={styles.branchTwig} d="M97 160 C88 153 80 150 70 145" />
          <path className={styles.branchTwig} d="M132 146 C138 140 142 134 145 126" />
        </g>

        {/* 葉のかたまり（一枚の塊）。stage が上がると、この中央の塊そのものが大きく育つ。
            単色のデコボコしたシルエットを重ねて継ぎ目のない塊にし、左右下のふくらみで枝先を覆う。 */}
        <g className={styles.canopy} filter="url(#leafShadow)">
          {/* 中央の塊 */}
          <path
            className={styles.clump}
            d="M46 110 C40 88 52 64 76 58 C84 44 106 42 118 52 C136 42 162 56 158 84 C172 96 164 120 148 130 C150 148 126 158 110 150 C98 160 80 158 72 146 C54 152 40 136 46 118 C36 112 38 102 46 110 Z"
          />
          {/* 左下の大きめクラスター */}
          <path
            className={styles.clump}
            d="M34 132 C26 112 40 92 62 90 C72 80 92 82 98 96 C110 104 108 124 94 132 C98 150 76 160 60 152 C44 156 30 146 34 132 Z"
          />
          {/* 右下の大きめクラスター */}
          <path
            className={styles.clump}
            d="M108 128 C104 108 118 92 138 92 C150 84 168 92 168 108 C178 116 172 136 156 138 C156 156 132 162 120 150 C106 148 102 136 108 128 Z"
          />
        </g>
      </svg>
    </div>
  )
}
