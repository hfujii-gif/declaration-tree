# Issue #6 実装プラン：GSAPのインストールと動作確認

## Context（なぜこの作業を行うか）

`/vision`（ビジョン表示画面）の中核演出はすべてGSAPで実装する。
CLAUDE.mdの仕様では、新しい宣言が届くたびに葉を
`gsap.from(leaf, { opacity: 0, scale: 0, duration: 0.8, ease: 'back.out' })`
で出現させ、マイルストーン（2,500 / 5,000 / 7,500人）で木の拡大縮小、
10,000人達成で満開演出（花びら・光）を行う。これらは後続のIssue（/vision実装）が
GSAPに依存するため、本Issueで**アニメーションライブラリの導入と動作担保**を先に済ませる。

本Issueのスコープは「GSAPを導入し、Next.js 16 / React 19環境でクライアントコンポーネントから
実際にアニメーションが動くことを確認する」ことに限定する。確認用のテストページは
**動作確認後に必ず削除**し、本番ビルドに残さない。

---

## 対象Issue

- **Issue番号**：#6
- **タイトル**：[Phase2] GSAPのインストールと動作確認
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/6

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了（gsap 3.15.0導入・build/tsc/lint通過・/gsap-testで動作確認後にテストページ削除済み）
- [ ] PR作成済み

---

## 作業ブランチ

```
feature/issue-6-gsap-setup
```

> 本ブランチは `develop` から作成済み（プランファイル配置のため）。
> **GSAP導入・テストページ作成（実装本体）は承認後に着手する。**

---

## 実装対象ファイル

### 新規作成するファイル
```
app/gsap-test/page.tsx                  # 動作確認用テストページ（確認後に削除する）
.claude/plans/issue-6-gsap-setup.md     # 本ファイル
```

> テストページのルートは `/gsap-test`。`app/`配下の既存ルート（`/`）と衝突せず、
> 確認後にディレクトリごと削除しやすいよう専用ルートとする。

### 編集するファイル
```
package.json / package-lock.json        # gsap 依存を追加（npm install gsap）
```

### 最終的にコミットに残るファイル（重要）
```
package.json / package-lock.json        # gsap 依存（恒久）
.claude/plans/issue-6-gsap-setup.md     # 本プラン（恒久）
```

> `app/gsap-test/page.tsx` は**動作確認専用で、削除後にコミットする**。
> Issueの「確認後にテストコードは削除する」「完了条件：npm run buildが通ること」に従う。

---

## 依存関係の確認

このIssueは他ファイルへの依存が無い（GSAP導入は独立タスク）。

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts | ✅ 完了（#3でマージ済み）※本Issueでは未使用 |
| types/index.ts | ✅ 完了（#3でマージ済み）※本Issueでは未使用 |
| lib/firebase.ts | ✅ 完了（#4でマージ済み）※本Issueでは未使用 |
| lib/ngWords.ts | スコープ外（後続Issue）※本Issueでは未使用 |

> 現状確認：`gsap` パッケージは未インストール（`package.json` に無し・`node_modules/gsap` も無し）。
> 環境は Next.js 16.2.6 / React 19.2.4 / TypeScript 5。GSAPはフレームワーク非依存のため互換性問題は想定されない。

---

## 実装ステップ

承認後にこの順番で実装する。

1. **（ブランチは作成済み）**
   - `feature/issue-6-gsap-setup` は `develop` から作成済み。

2. **gsap パッケージの導入**
   - `npm install gsap`
   - `package.json` / `package-lock.json` に `gsap`（3.x系）が追加されることを確認

3. **動作確認用テストページの作成**
   - `app/gsap-test/page.tsx` を作成。Issue #6 記載のサンプルを基本とする：
     ```typescript
     'use client'
     import { useEffect, useRef } from 'react'
     import { gsap } from 'gsap'

     export default function GsapTestPage() {
       const boxRef = useRef<HTMLDivElement>(null)
       useEffect(() => {
         if (!boxRef.current) return
         gsap.from(boxRef.current, {
           opacity: 0, scale: 0, duration: 0.8, ease: 'back.out(1.7)',
         })
       }, [])
       return (
         <div style={{ background: '#1B3A2D', width: '100vw', height: '100vh' }}>
           <div ref={boxRef} style={{ width: 50, height: 50, background: '#4CAF82', borderRadius: '50%' }} />
         </div>
       )
     }
     ```
   - `'use client'` 必須（GSAPはクライアント側でDOMを操作するため）
   - これは**一時的な確認用コード**であり、確認後に削除する（恒久コードではない）

4. **ビルド・型・lintチェック（テストページがある状態で一度確認）**
   - `npm run build` / `npx tsc --noEmit` / `npm run lint`
   - GSAPのimportと型解決が通ることをこの段階で確認

5. **ブラウザでの動作確認**
   - `npm run dev` 起動後、`http://localhost:3000/gsap-test` を開く
   - 緑の円が scale 0→1・opacity 0→1 で `back.out` のイージングでふわっと出現することを目視確認
   - DevTools Console にエラーが出ていないことを確認

6. **テストページの削除**
   - 動作確認後、`app/gsap-test/` ディレクトリごと削除する
   - Issueの「確認後にテストコードは削除する」に従う

7. **削除後の最終ビルド確認**
   - テストページ削除後に再度 `npm run build` / `npx tsc --noEmit` / `npm run lint`
   - テストコードが無い状態で正常にビルドが通ることを確認（完了条件）

8. **コミット & PR作成**
   - `git add package.json package-lock.json .claude/plans/issue-6-gsap-setup.md`
   - `git commit -m "feat: GSAPを導入し動作確認を実施 (#6)"`
   - `git push -u origin feature/issue-6-gsap-setup`
   - `gh pr create --base develop --title '[Phase2] GSAPのインストールと動作確認' --body 'Closes #6'`

---

## 考慮が必要な点

### テストコードの確実な削除
- 本Issue最大の注意点は「確認用テストページを本番に残さないこと」。
  手順6で `app/gsap-test/` を削除し、手順7で削除後ビルドが通ることを確認する。
- 最終コミットに `app/gsap-test/page.tsx` が含まれていないことを `git status` / `git diff` で確認する。

### 型の定義
- GSAP（3.x）は型定義を同梱しているため `@types/gsap` は**不要**（旧パッケージで非推奨）。
- `gsap.from` の引数は型推論で通り、`any` は使わない。`useRef<HTMLDivElement>(null)` で要素型を明示する。
- `types/index.ts` への追加は不要。

### Next.js 16 / React 19 互換性
- GSAPはフレームワーク非依存のバニラJSライブラリのため、Next 16 / React 19 でも問題なく動作する。
- `'use client'` を付けないと `useEffect`/`useRef`/DOM操作がサーバーコンポーネントで失敗するため必須。

### メモリリーク対策
- 本Issueのテストは単発の `gsap.from` のみで、リスナーや繰り返しTweenは登録しないため該当処理は無い。
- ただし後続の `/vision` 実装では、長時間稼働（8時間以上）でTween/Timelineが蓄積しないよう
  `gsap.killTweensOf()` や Timeline の適切な破棄が必要になる旨を**後続への申し送り**として記録する
  （本Issueのスコープ外）。

### エラーハンドリング
- 本Issueは導入・動作確認のみでFirebase等のI/Oを伴わないため、try-catchの対象処理は無い。
- `boxRef.current` が null の場合は早期 return でガードする（サンプルどおり）。

### ビルドへの影響
- テストページがある状態でも、削除後でも `npm run build` が通ることを両方確認する。
- 最終的に本番ビルドに含まれるのは `gsap` 依存のみ（テストページは削除済み）。

---

## 実装方針

Issue #6 の指定内容を忠実に実装する。エージェントが行うのは
「`npm install gsap`」「確認用テストページ `app/gsap-test/page.tsx` 作成」
「ビルド/型/lint確認」「ブラウザでアニメーション目視確認」
「テストページ削除」「削除後の再ビルド確認」「PR作成」。
スコープを広げず、GSAP導入とアニメーション動作の担保のみに徹する。
テストコードは本番に残さず、最終的に残すのは `gsap` 依存とプランファイルのみとする。

---

## 完了条件

Issue #6 のチェックリストを転記：

- [ ] `npm install gsap` が完了していること
- [ ] gsapをimportしてアニメーションが動作することを確認済みであること
- [ ] `npm run build` が通ること

加えて implementation.md の完了前チェック：

- [ ] `npx tsc --noEmit` でTypeScriptエラーがないこと
- [ ] `npm run lint` でESLintエラーがないこと
- [ ] 確認用テストページ（`app/gsap-test/`）が削除され、コミットに含まれていないこと
- [ ] 不要な `console.log` が残っていないこと
- [ ] `.env.local` 等のシークレットがコミットに含まれていないこと

---

## 検証手順（実装後）

1. `npm install gsap` 後、`package.json` に `gsap` が追加されていることを確認
2. `app/gsap-test/page.tsx` 作成後、`npm run dev` → `http://localhost:3000/gsap-test` で
   円が scale/opacity アニメーションでふわっと出現することを目視確認（Consoleエラー無し）
3. テストページ削除後に `npm run build` / `npx tsc --noEmit` / `npm run lint` が通ることを確認
4. `git status` / `git diff develop --name-only` で、コミット対象が
   `package.json` / `package-lock.json` / `.claude/plans/issue-6-gsap-setup.md` のみで
   テストページが含まれていないことを確認

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：ユーザー  
**承認日**：2026-05-28  
**コメント**：承認済み。本プランどおり実装を進める。
