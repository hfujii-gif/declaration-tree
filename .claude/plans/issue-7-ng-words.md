# Issue #7 実装プラン：lib/ngWords.ts の作成（NGワードリスト）

## Context（なぜこの作業を行うか）

NGワードのチェックは**2か所**で使われる共通ロジックである。

1. `components/input/DeclarationForm.tsx`（後続 Issue #8）— 入力中のリアルタイムバリデーション
2. `app/api/declare/route.ts`（後続 Issue #9）— 送信時のサーバーサイドバリデーション

フロントだけでチェックしてもAPIを直接叩けば回避できてしまうため、
**同じ判定関数をクライアント／サーバー双方で共有する**のが本Issueの狙い。
そのため判定ロジックを `lib/ngWords.ts` に切り出し、両者から `@/lib/ngWords` でimportする。

本Issueのスコープは「NGワードリスト定数 `DEFAULT_NG_WORDS` と判定関数 `containsNgWord` を
`lib/ngWords.ts` に実装し、ビルドが通ることを確認する」ことに限定する。
実際にこの関数を呼び出す入力画面（#8）・API Route（#9）の実装はスコープ外。

---

## 対象Issue

- **Issue番号**：#7
- **タイトル**：[Phase3] lib/ngWords.ts の作成（NGワードリスト）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/7

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み（PR #26 → develop）

---

## 作業ブランチ

```
feature/issue-7-ng-words
```

> 本ブランチは `develop` から作成済み（プランファイル配置のため）。
> **lib/ngWords.ts の実装本体は承認後に着手する。**

---

## 実装対象ファイル

### 新規作成するファイル
```
lib/ngWords.ts                          # NGワードリスト定数 + 判定関数
.claude/plans/issue-7-ng-words.md       # 本ファイル
```

### 編集するファイル
```
なし
```

> Issue の「実装対象ファイル」は `lib/ngWords.ts` のみ。
> types/index.ts への型追加は不要（後述「型の定義」参照）。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts | ✅ 完了（#3でマージ済み）※本Issueでは未使用 |
| types/index.ts | ✅ 完了（#3でマージ済み）※本Issueでは未使用 |
| lib/firebase.ts | ✅ 完了（#4でマージ済み）※本Issueでは未使用 |
| lib/ngWords.ts | ⬜ 本Issueで新規作成 |

> `lib/ngWords.ts` 自体が**後続の依存元**になる。
> このファイルは #8（/input）・#9（/api/declare）が依存するため、それらより先に実装する。
> 現状確認：`lib/ngWords.ts` は未作成。パスエイリアス `@/*` → `./*` は tsconfig.json に設定済みのため `@/lib/ngWords` でimport可能。

---

## 実装ステップ

承認後にこの順番で実装する。

1. **（ブランチは作成済み）**
   - `feature/issue-7-ng-words` は `develop` から作成済み。

2. **`lib/ngWords.ts` の作成**
   - Issue #7 記載の実装内容を基本とする：
     ```typescript
     // 既定のNGワードリスト。
     // 実際の語句はクライアントとの確認後に追加する（本番投入前に確定させる）。
     export const DEFAULT_NG_WORDS: string[] = [
       // クライアントと確認後に追加する
     ]

     // text に ngWords のいずれかが含まれるかを判定する。
     // 大文字小文字を無視して部分一致でチェックする。
     export const containsNgWord = (text: string, ngWords: string[]): boolean => {
       const normalizedText = text.toLowerCase()
       return ngWords.some((word) => normalizedText.includes(word.toLowerCase()))
     }
     ```
   - 引数・返り値に型を明示（`any` 不使用）。純粋関数（副作用・I/Oなし）。

3. **ビルド・型・lintチェック**
   - `npm run build`
   - `npx tsc --noEmit`
   - `npm run lint`

4. **コミット & PR作成**
   - `git add lib/ngWords.ts .claude/plans/issue-7-ng-words.md`
   - `git commit -m "feat: NGワードリストと判定関数を実装 (#7)"`
   - `git push -u origin feature/issue-7-ng-words`
   - `gh pr create --base develop --title '[Phase3] lib/ngWords.ts の作成（NGワードリスト）' --body 'Closes #7'`

---

## 考慮が必要な点

### エラーハンドリング
- 本Issueは純粋関数のみでFirebase等のI/Oを伴わないため、try-catch の対象処理は無い。
- 引数は TypeScript の型（`text: string` / `ngWords: string[]`）で保証する。
  null/undefined のガードは入れない（型で担保し、システム境界＝API側の入力検証は #9 で別途行う方針）。

### メモリリーク対策
- リスナーや Tween を持たないため該当処理は無い。

### 型の定義
- 追加の型は不要。`DEFAULT_NG_WORDS: string[]`、`containsNgWord(text: string, ngWords: string[]): boolean`。
- types/index.ts への追加は不要（NGワードは単なる `string[]` で、ドメイン型を新設するほどではない）。

### NGワードリストの実体（要・申し送り）
- `DEFAULT_NG_WORDS` は本Issueでは**空配列のまま**とする。語句リストはクライアント確認後に確定させる。
- 空配列のとき `containsNgWord` は `Array.some` の仕様により常に `false` を返す（誤検知ゼロ）＝安全側。
- 管理画面（#11想定）で追加されるNGワードは Firebase `settings/ngWords` に保存される設計。
  実運用では「`DEFAULT_NG_WORDS` ＋ Firebase上のNGワード」をマージして `containsNgWord` の第2引数に渡す
  （マージ処理は呼び出し側＝#8/#9 の責務。本Issueのスコープ外）。

### 判定ロジックの仕様確認ポイント（レビュー時に方針確定したい）
本Issueの判定はIssue記載どおり「`toLowerCase()` での大文字小文字無視＋部分一致」とする。
ただし以下は**現時点ではスコープ外**とし、必要なら別Issueで対応する想定。承認時に方針を確認したい：

1. **空文字・空白のみのNGワードの扱い**
   - リストに空文字 `""` が混入すると `includes("")` が常に `true` となり、**全宣言がブロックされる**。
     本番当日に管理画面から誤って空のNGワードを登録すると全入力が止まるリスクがある。
   - 対策案（任意・推奨）：`containsNgWord` 内で空・空白のみの word を除外する一行ガードを足す。
     ```typescript
     return ngWords.some((word) => {
       const w = word.trim().toLowerCase()
       return w.length > 0 && normalizedText.includes(w)
     })
     ```
   - Issue記載のサンプルからの最小限の逸脱だが、「当日止まれない」方針に沿った防御。**入れるか否かを承認時に判断**。
2. **全角／半角・ひらがな／カタカナの正規化**
   - 日本語NGワードでは全角・半角の差で検知漏れが起きうるが、リストが未確定の現段階では過剰実装。
     必要になった時点で別途検討する（本Issueでは行わない）。

### その他
- 不要な `console.log` は残さない。
- `.env.local` 等のシークレットを含めない（本Issueは秘密情報を扱わない）。

---

## 実装方針

Issue #7 の指定内容を忠実に実装する。エージェントが行うのは
「`lib/ngWords.ts` 作成（`DEFAULT_NG_WORDS` ＋ `containsNgWord`）」
「ビルド/型/lint確認」「コミット & PR作成」。
スコープを広げず、共通の判定ロジックを切り出すことに徹する。
上記「判定ロジックの仕様確認ポイント」の空文字ガードのみ、本番リスクを踏まえ
**承認時に採否を確認**する（採用する場合も変更は `containsNgWord` 内の数行に限定）。

---

## 完了条件

Issue #7 のチェックリストを転記：

- [ ] `lib/ngWords.ts` が存在すること
- [ ] `containsNgWord` 関数が実装されていること
- [ ] `npm run build` が通ること

加えて implementation.md の完了前チェック：

- [ ] `npx tsc --noEmit` でTypeScriptエラーがないこと
- [ ] `npm run lint` でESLintエラーがないこと
- [ ] `any` 型を使っていないこと
- [ ] 不要な `console.log` が残っていないこと
- [ ] `.env.local` 等のシークレットがコミットに含まれていないこと

---

## 検証手順（実装後）

1. `lib/ngWords.ts` 作成後、`npm run build` / `npx tsc --noEmit` / `npm run lint` が通ることを確認
2. `containsNgWord('毎日運動する', [])` が `false`、`containsNgWord('テストNG入り', ['NG'])` が `true`、
   大文字小文字無視（`containsNgWord('abc', ['ABC'])` が `true`）を確認（手元での簡易確認でよい）
3. `git diff develop --name-only` で、コミット対象が
   `lib/ngWords.ts` / `.claude/plans/issue-7-ng-words.md` のみであることを確認

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii  
**承認日**：2026-05-28  
**コメント**：「判定ロジックの仕様確認ポイント」の空文字・空白ガードは**採用**する
（本番当日に空NGワード誤登録で全宣言がブロックされる事故を防ぐため）。全角/半角・かな正規化はスコープ外のまま。
