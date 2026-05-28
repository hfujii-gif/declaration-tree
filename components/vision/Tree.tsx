import type { Declaration } from '@/types'
import LeafItem from './LeafItem'
import styles from './Tree.module.scss'

type TreeProps = {
  declarations: Declaration[]
}

// 宣言の集合を「木（葉の集まり）」として描画する presentational コンポーネント。
// key には Firebase の push キー（id）を使い、再レンダリング時に既存の葉DOMを再利用させる。
export default function Tree({ declarations }: TreeProps) {
  return (
    <div className={styles.tree}>
      {declarations.map((declaration) => (
        <LeafItem key={declaration.id} declaration={declaration} />
      ))}
    </div>
  )
}
