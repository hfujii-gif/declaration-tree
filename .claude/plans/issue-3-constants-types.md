# Issue #3 実装プラン：lib/constants.ts・types/index.ts・globals.scssの作成

## Context（なぜこの作業を行うか）

宣言ツリーシステムの後続Issue（/input, /vision, /admin, /api/declare の実装）はすべて、
共通の定数（`MAX_CHARS`・`RESET_DELAY_MS`・`MILESTONES`）と型（`Declaration`・`DeclareRequestBody`・`DeclareResponse`）、
そして共通のCSS変数（`--color-bg`等）に依存している。
これらが存在しないと後続実装でマジックナンバーやanyが混入したり、各ファイルでFirebaseを再初期化したりする可能性が高い。
本Issueは Phase2 セットアップの土台として、これらの共通基盤を最初に整備する。

加えて create-next-app テンプレート由来の Tailwind CSS が残っており、CLAUDE.md の方針
（「スタイリング | SCSS Modules」「グローバルスタイルは最小限」）と矛盾するため、
Tailwind を完全に撤去して SCSS Modules ベースに移行する（ユーザー承認済）。

---

## 対象Issue

- **Issue番号**：#3
- **タイトル**：[Phase2] lib/constants.ts・types/index.ts・globals.scssの作成
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/3

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [ ] 実装完了
- [ ] PR作成済み

---

## 実装対象ファイル

### 新規作成するファイル
```
lib/constants.ts
types/index.ts
app/globals.scss                          # 既存 globals.css をリネームし内容を置換
.claude/plans/issue-3-constants-types.md  # 本ファイル
```

### 編集するファイル
```
app/layout.tsx        # globals.css → globals.scss にimport変更、Tailwindクラスを除去
package.json          # tailwindcss・@tailwindcss/postcss を削除、sass を追加
```

### 削除するファイル
```
app/globals.css       # globals.scss にリネーム
postcss.config.mjs    # Tailwind 用 PostCSS 設定（Tailwind 撤去に伴い不要）
```

### スコープ外（今回は触らない）
```
app/page.tsx          # Tailwindクラスが多数残るが、後続Issueで /input へのリダイレクトに
                      # 差し替える前提のためビルドが通る状態に留め、本Issueでは未変更とする
```

---

## 依存関係の確認

本Issueは Phase2 の最初のIssueであり、他のファイルには依存しない。

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts | これから作成（本Issue） |
| types/index.ts | これから作成（本Issue） |
| lib/firebase.ts | スコープ外（後続Issueで作成） |
| lib/ngWords.ts | スコープ外（後続Issueで作成） |

---

## 実装ステップ

承認後にこの順番で実装する。

1. **ブランチ作成**
   - `git checkout develop && git checkout -b feature/issue-3-constants-types`

2. **lib/constants.ts を新規作成**
   - 内容は Issue #3 の指定どおり：
     ```ts
     export const MAX_CHARS = 50
     export const RESET_DELAY_MS = 3000
     export const MILESTONES = [2500, 5000, 7500, 10000]
     export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'
     ```
   - `MILESTONES` は読み取り専用にするため `as const` を付与する（型推論で `readonly [2500, 5000, 7500, 10000]` となり、後続Issueでの誤改変を防げる）

3. **types/index.ts を新規作成**
   - 内容は Issue #3 の指定どおり（`Declaration`・`DeclareRequestBody`・`DeclareResponse`）
   - `tsconfig.json` の `paths` 設定（`@/*` → `./*`）が既に効いている前提（実装時に確認）

4. **Tailwind 関連パッケージの削除と sass の追加**
   - `npm uninstall tailwindcss @tailwindcss/postcss`
   - `npm install -D sass`
   - `postcss.config.mjs` を削除（中身を読んで確実にTailwindのみの設定だと確認した上で削除）

5. **app/globals.scss への移行**
   - `app/globals.css` を削除（git mv で履歴を残す）
   - `app/globals.scss` を新規作成し、Issue #3 指定の内容を書き込む：
     ```scss
     * { box-sizing: border-box; margin: 0; padding: 0; }

     :root {
       --color-bg: #1B3A2D;
       --color-accent: #4CAF82;
       --color-text: #FFFFFF;
       --color-error: #EF4444;
       --color-gray: #9CA3AF;
     }

     body {
       font-family: 'Arial', sans-serif;
       background-color: var(--color-bg);
       color: var(--color-text);
       overflow: hidden;
     }
     ```

6. **app/layout.tsx の更新**
   - `import "./globals.css"` → `import "./globals.scss"`
   - `<html className="... h-full antialiased">` のTailwindクラス（`h-full antialiased` および `geistSans.variable` / `geistMono.variable`）を除去
   - `<body className="min-h-full flex flex-col">` のTailwindクラスも除去
   - Geistフォント読み込み（`Geist`・`Geist_Mono`）は CLAUDE.md の「font-family: 'Arial'」方針と矛盾するため削除
   - `metadata.title` を `"宣言ツリー"` に、`description` を適切な日本語に更新

7. **ビルド・型・lintチェック**
   - `npm run build`
   - `npx tsc --noEmit`
   - `npm run lint`

8. **コミット & PR作成**
   - `git add lib/constants.ts types/index.ts app/globals.scss app/layout.tsx package.json package-lock.json .claude/plans/issue-3-constants-types.md`
   - `git rm app/globals.css postcss.config.mjs`
   - `git commit -m "feat: 定数・型定義・グローバルスタイルを追加 (#3)"`
   - `git push -u origin feature/issue-3-constants-types`
   - `gh pr create --base develop --title '[Phase2] 定数・型定義・グローバルスタイルを追加' --body 'Closes #3'`

---

## 考慮が必要な点

### エラーハンドリング
- 本Issueは純粋な定数・型・スタイルの追加のため、ランタイムのエラーハンドリングは不要
- ただし `npm uninstall` / `npm install` 失敗時はステップを止めてユーザーに報告する

### メモリリーク対策
- 該当なし（Firebaseリスナーなどは扱わない）

### 型の定義
- `MILESTONES` には `as const` を付与し `readonly` 配列にする
  - 理由：後続 /vision 実装でマイルストーン到達判定 (`prevCount < m && newCount >= m`) を行う際、誤って配列を書き換えるバグを型レベルで防ぐ
- `Declaration` の `id` は Firebase Realtime Database の push キー（文字列）。`types/index.ts` の定義どおり `string` にする
- `DeclareResponse` は `success: true` 時に `message` を省略可能なため optional のままにする

### Tailwind 撤去に伴う影響
- `app/page.tsx` には Tailwind クラスが多数残るが、Tailwind の PostCSS プラグインを削除しても **未知のクラス名として無視されるだけでビルドは通る**（CSS が当たらず崩れて見えるのみ）
- ルートページ `/` は最終的に `/input` 等へのリダイレクトに差し替えられる想定のため、本Issueでは未変更とする
- もしビルドエラーになる場合は、`app/page.tsx` を最小のプレースホルダー（`<div>declaration-tree</div>` 等）に置き換える対応を追加する

### globals.scss の `overflow: hidden`
- iPad 入力画面で意図しないスクロールを防ぐ目的。/input・/vision で必要だが、後続Issueで個別画面のスクロール挙動を見て調整する可能性あり

### Next.js + SCSS の動作確認
- Next.js 16 系は SCSS をサポート（`sass` をインストールすれば自動で有効化）
- `app/globals.scss` を直接 `import` する形は Next.js 公式の作法に合致するため別途設定は不要

---

## 実装方針

Issue #3 の指定内容を忠実に実装しつつ、付随する Tailwind 撤去作業は **「ビルドが通る最小範囲」** に留める。
具体的には:
- `package.json` から Tailwind 関連を削除
- `postcss.config.mjs` を削除
- `app/layout.tsx` の import 先と className を更新
- `app/page.tsx` は触らない（残ったクラス名は無視されるだけでビルド通過）

これにより本Issueのスコープを膨らませず、後続Issueで `/` のルーティングを実装する際に `app/page.tsx` を書き換える形にする。

---

## 完了条件

Issue #3 のチェックリストを転記：

- [ ] `lib/constants.ts` が存在し定数（`MAX_CHARS`・`RESET_DELAY_MS`・`MILESTONES`・`ADMIN_PASSWORD_ENV`）がすべて定義されていること
- [ ] `types/index.ts` が存在し型（`Declaration`・`DeclareRequestBody`・`DeclareResponse`）がすべて定義されていること
- [ ] `app/globals.scss` に CSS変数 (`--color-bg`・`--color-accent`・`--color-text`・`--color-error`・`--color-gray`) が定義されていること
- [ ] `npm run build` が通ること

加えて実装エージェントルール（implementation.md）の完了前チェック：

- [ ] `npx tsc --noEmit` でエラーなし
- [ ] `npm run lint` でエラーなし
- [ ] `console.log` の残骸なし
- [ ] `.env.local` 等のシークレットがコミットに含まれていないこと

---

## 検証手順（実装後）

1. `npm run build` でビルド成功を確認
2. `npm run dev` でローカルサーバ起動し、`http://localhost:3000` を開いて、
   - body の背景色が `#1B3A2D`（深緑）になっていること
   - フォントが Arial になっていること
   - コンソールに SCSS / Tailwind 関連のエラーが出ていないこと
3. `npx tsc --noEmit` で型エラーが無いことを確認
4. `lib/constants.ts` と `types/index.ts` を後続Issueから import できる状態（パスエイリアス `@/lib/constants` 等）であることを軽く確認

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：（プランモードで承認済み）
**承認日**：2026-05-28
**コメント**：Tailwind完全撤去・globals.cssをglobals.scssにリネームする方針で承認。
