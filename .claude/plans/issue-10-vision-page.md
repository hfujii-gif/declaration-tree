# 実装プラン：Issue #10 /vision ビジョン表示画面

## 対象Issue

- **Issue番号**：#10
- **タイトル**：[Phase3] /vision ビジョン表示画面の実装
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/10

---

## ステータス

- [ ] プラン作成中
- [ ] レビュー待ち
- [ ] 承認済み → 実装開始可能
- [ ] 実装完了
- [x] PR作成済み（PR #32）

---

## 概要

大型モニター（ビジョン）に常時表示する画面を実装する。
Firebase Realtime Database の `declarations/` を `onValue()` でリアルタイム監視し、
表示対象（`isVisible: true`）の宣言を「葉」として描画、画面下部に累計件数を表示する。

このシステムはイベント当日に **8時間以上** 連続稼働するため、
本Issueでは特に **Firebaseリスナーの確実な解除（メモリリーク対策）** を最重要事項とする。

---

## スコープと関連Issueの整理（重要・要レビュー）

CLAUDE.md の `/vision` 仕様には「GSAPアニメーション」「マイルストーン演出」「満開演出」も記載があるが、
これらは **別Issue #11「GSAPアニメーションの実装（葉の出現・マイルストーン・満開演出）」** に切り出されている。

したがって本Issue #10 のスコープは、Issue #10 の完了条件に厳密に合わせて以下に限定する。

- ✅ **本Issue #10 で実装する**：onValueでのリアルタイム受信／`isVisible`フィルタ／葉の **静的描画**／カウンター表示／リスナー解除
- ⏭️ **Issue #11 へ送る**：葉出現のGSAPアニメーション（`gsap.from(...)`）／2,500・5,000・7,500人のマイルストーン演出／10,000人の満開演出

→ #10 では `Tree.tsx` / `LeafItem.tsx` を **アニメーションなしの素の描画コンポーネント** として作る。
   #11 で `LeafItem.tsx` を client 化して GSAP の入場アニメーションを付ける前提で、構造だけ先に用意する。

> このスコープ分割が意図と異なる場合（#10 で葉のアニメーションまで含めたい等）は、承認前にご指摘ください。

---

## 実装対象ファイル

### 新規作成するファイル
```
app/vision/page.tsx                      # ビジョン画面本体（'use client'・Firebase購読）
components/vision/Tree.tsx               # 葉の集合（木）を描画する presentational コンポーネント
components/vision/LeafItem.tsx           # 葉1枚を描画する presentational コンポーネント
components/vision/Tree.module.scss       # Tree / LeafItem 共通のスタイル
app/vision/page.module.scss              # ★Issueのファイル一覧に無いが追加（下記・決定事項4）
```

### 編集するファイル
```
なし
```

> **★ `app/vision/page.module.scss` を追加する理由**：
> Issue本文のファイル一覧には載っていないが、page.tsx 側に「画面全体のコンテナ」と「下部カウンター」の
> レイアウトが必要になる。プロジェクト規約（SCSS Modules必須・グローバルスタイルは最小限・インライン直書きやカラーコード直書き禁止）に
> 従うため、page専用のモジュールを1つ追加する。LeafItem専用のSCSSはIssue一覧通り作らず、`Tree.module.scss` を共有する。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 | 確認結果 |
|---|---|---|
| lib/firebase.ts | ✅ 完了 | `db, ref, onValue, off` を export 済み（本Issueで使う関数は揃っている） |
| types/index.ts | ✅ 完了 | `Declaration`（`id, text, timestamp, isVisible`）を定義済み。新規型は不要 |
| lib/constants.ts | ✅ 完了 | 本Issueでは未使用（MILESTONESは #11 で使用） |
| app/globals.scss | ✅ 完了 | CSS変数 `--color-bg / --color-accent / --color-text / --color-error / --color-gray` 定義済み |
| /api/declare（#9） | ✅ 完了（PR #28 マージ済み） | `declarations/` に `{ text, timestamp, isVisible:true }` を書き込み済み。読み取り側を本Issueで実装 |

依存はすべて満たされている。

---

## 設計上の決定事項（プラン作成時に確認済み）

### 決定1：リスナー解除は `off(declarationsRef)`（既存 /input と統一）
- Issue本文サンプル・既存の `components/input/DeclarationForm.tsx` のどちらも、cleanup で `off(ref)` を呼ぶ書き方を採用している。
- `onValue` が返す `unsubscribe()` を呼ぶ方法も等価（より対象を絞れる）だが、本ページは当該 ref への購読が1つだけなので `off()` で問題ない。
- **既存コードとの一貫性**を優先し `off(declarationsRef)` を採用する。`ref` はIssueサンプルどおり`useRef`で安定参照を保持し、登録時と解除時で同一参照を使う。

### 決定2：`snapshot.val()` が null のときは空配列にする（Issueサンプルからの改善）
- Issueサンプルは `if (!data) return` で、データが無いとき **stateを更新しない**。
- これだと「全宣言が非表示/削除されて null になった」ケースで古い一覧が残り続ける。
- 本実装では `if (!data) { setDeclarations([]); return }` とし、空状態を正しく反映する（カウンターも0に戻る）。

### 決定3：カウンターは `isVisible: true` の件数（= フィルタ後の `declarations.length`）
- `isVisible` で `filter` した後の配列長を表示するため、非表示の宣言は自動的にカウント対象外になる。
- レビュー観点「カウンターがisVisible=trueの宣言のみをカウントしているか」を満たす。

### 決定4：page専用SCSS（`app/vision/page.module.scss`）を追加（前述）
- 画面コンテナ＋下部カウンターのスタイルを置く。色は必ずCSS変数（`var(--color-*)`）を使う。

### 決定5：葉の描画は #10 では静的（アニメーションは #11）
- `LeafItem` は hooks を持たない純粋な presentational コンポーネントとして作る（`'use client'` ディレクティブは付けない。client コンポーネントである page.tsx 配下に置かれるためバンドル上は問題ない）。
- 葉の配置は index ベースの単純な並べ方（flex の折返し等）にとどめ、木の成長段階・座標計算などのリッチな見た目は #11 のスコープとする。

---

## 実装ステップ

承認後、以下の順で実装する。

1. **`components/vision/LeafItem.tsx` を作成**
   - props：`{ declaration: Declaration }`
   - 葉1枚（`<span>`/`<div>`）を描画。`title={declaration.text}` を付け、内容を保持（画面には大きく出さない）。
   - `Tree.module.scss` から `leaf` クラスを当てる。

2. **`components/vision/Tree.tsx` を作成**
   - props：`{ declarations: Declaration[] }`
   - 木の土台（trunk等のラッパー）＋ `declarations.map((d) => <LeafItem key={d.id} declaration={d} />)`。
   - `key` は必ず `d.id`（Firebaseのpushキー）を使う（再レンダリング時の不要な再生成を防ぐ。#11のアニメーション安定化にも効く）。
   - `Tree.module.scss` をimport。

3. **`components/vision/Tree.module.scss` を作成**
   - `.tree`（葉を並べるコンテナ）／`.leaf`（葉の見た目：サイズ・`background-color: var(--color-accent)`・葉形のborder-radius等）。
   - 色・背景はすべてCSS変数を使用。

4. **`app/vision/page.module.scss` を作成**
   - `.container`（全画面・`position: relative`・`overflow: hidden`）／`.counter`（画面下部固定・中央寄せ・大きめフォント・`var(--color-text)`）。

5. **`app/vision/page.tsx` を作成**（`'use client'`）
   - `useState<Declaration[]>([])` と `useRef(ref(db, 'declarations'))`。
   - `useEffect` 内で `onValue` を購読：
     - `snapshot.val()` を取得、null は `setDeclarations([])`（決定2）。
     - `Object.entries(data)` → `{ id, ...(val as Omit<Declaration,'id'>) }` に変換 → `filter(d => d.isVisible)` → `sort((a,b) => a.timestamp - b.timestamp)`。
     - `setDeclarations(list)`。
   - cleanup で `off(declarationsRef)`（決定1）。
   - 描画：`<div className={styles.container}>` 内に `<Tree declarations={declarations} />` と
     `<div className={styles.counter}>{declarations.length.toLocaleString()}人が宣言しました</div>`。

6. **ビルド・型・lint・動作確認**
   - `npm run build` / `npx tsc --noEmit` / `npm run lint`
   - `npm run dev` で `/vision` を開き、`/input`（または `/api/declare` への curl）から宣言を送って
     1秒以内に葉が増えること・カウンターが増えること・リロードで重複しないことを確認。

---

## 考慮が必要な点

### メモリリーク対策（本Issュー最重要）
- `onValue` のリスナーを `useEffect` の cleanup（`return () => off(declarationsRef)`）で**必ず**解除する。
- 登録・解除で**同一の ref インスタンス**を使うため、`ref(db, 'declarations')` は `useRef` で保持する。
- 8時間以上の連続稼働を想定。`setTimeout`/`setInterval` 等の追加タイマーは本Issueでは使わない（張った場合は同様に cleanup する）。

### パフォーマンス（長時間・大量データ）
- 宣言は最大10,000件まで増える想定。10,000枚の葉DOMを描画すると重くなる懸念があるが、
  仮想化等の最適化は本Issueのスコープ外（必要なら #11 / #15 で扱う）。本Issueは「全件を素直に描画」する。
- `key={d.id}` を徹底し、再レンダリング時に既存の葉DOMを再利用させる（差分のみ追加）。

### エラーハンドリング
- `onValue` の第3引数（エラーコールバック）でFirebase購読エラーを `console.error` し、握りつぶさない。
- 読み取りデータが想定外（`text` 欠落等）の可能性に備え、必要なら軽い防御（型ガード/フィルタ）を入れる。ただし過剰な検証はしない。

### 型の定義
- `types/index.ts` の `Declaration` をそのまま使用。新規型の追加は不要。
- `snapshot.val()` は `unknown` として受け、`Object.entries` 後に `val as Omit<Declaration, 'id'>` で扱う（Issueサンプル踏襲）。`any` は使わない。

### セキュリティ
- 環境変数のハードコードはしない（Firebase設定は `lib/firebase.ts` に集約済み）。
- `process.env.NEXT_PUBLIC_*` 以外の環境変数をこの画面から露出させない。

---

## 実装方針（page.tsx の最終形イメージ）

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { db, ref, onValue, off } from '@/lib/firebase'
import type { Declaration } from '@/types'
import Tree from '@/components/vision/Tree'
import styles from './page.module.scss'

export default function VisionPage() {
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  const dbRef = useRef(ref(db, 'declarations'))

  useEffect(() => {
    const declarationsRef = dbRef.current
    onValue(
      declarationsRef,
      (snapshot) => {
        const data = snapshot.val()
        if (!data) {
          setDeclarations([]) // 決定2：データが無ければ空状態を反映
          return
        }
        const list: Declaration[] = Object.entries(data)
          .map(([id, val]) => ({ id, ...(val as Omit<Declaration, 'id'>) }))
          .filter((d) => d.isVisible) // 決定3：表示対象のみ
          .sort((a, b) => a.timestamp - b.timestamp)
        setDeclarations(list)
      },
      (error) => {
        // 購読エラーを握りつぶさない（無音で止まるのを防ぐ）
        console.error('宣言の購読に失敗しました:', error)
      }
    )
    // メモリリーク対策：アンマウント時にリスナーを解除する
    return () => off(declarationsRef)
  }, [])

  return (
    <div className={styles.container}>
      <Tree declarations={declarations} />
      <div className={styles.counter}>
        {declarations.length.toLocaleString()}人が宣言しました
      </div>
    </div>
  )
}
```

> Issueサンプルとの差分：(1) null時に `setDeclarations([])`、(2) `onValue` にエラーコールバックを追加、(3) カウンター/コンテナをSCSS Modules化。いずれも仕様を変えず堅牢性を高める変更。

---

## 完了条件

Issue #10 の完了条件を転記。

- [ ] Firebase onValue()でリアルタイムに宣言を受信できること
- [ ] 新しい宣言が届いたら画面に反映されること
- [ ] isVisible=falseの宣言が表示されないこと
- [ ] 画面下部にカウンターが表示されること
- [ ] アンマウント時にFirebaseリスナーが解除されること（off()を呼ぶ）
- [ ] npm run buildが通ること

### 追加で確認するもの（rules準拠）
- [x] `npx tsc --noEmit` で型エラーがないこと（`any` 不使用）
- [x] `npm run lint` でエラーがないこと
- [x] SCSS ModulesでCSS変数（`var(--color-*)`）を使用していること
- [x] 不要な `console.log` が残っていないこと（エラー通知の `console.error` のみ）

---

## 動作確認メモ

- `npx tsc --noEmit` / `npm run lint` / `npm run build`：いずれも成功。`/vision` ルートが静的生成された。
- `npm run dev` で `/vision` をHTTP取得 → **200**、SSR出力にカウンター文言「○人が宣言しました」を確認。サーバーエラーなし。
- **未検証（ブラウザ必須・この環境では実施不可）**：Firebase `onValue` でのリアルタイム反映・葉の追加描画・`isVisible=false`の非表示・カウンター増加。
  実Firebaseへテストデータを書き込まないため（Issue #30 のクリーンアップ負荷を増やさない）、これらの目視確認は
  `.claude/rules/testing.md` の `/vision` テスト（テストエージェント／手動）に委ねる。

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii
**承認日**：2026-05-28
**コメント**：承認。プラン通り実装する。
