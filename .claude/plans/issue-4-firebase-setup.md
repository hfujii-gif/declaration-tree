# Issue #4 実装プラン：Firebase セットアップ・lib/firebase.ts の作成

## Context（なぜこの作業を行うか）

宣言ツリーシステムの中核はFirebaseのRealtime Databaseである。
`/api/declare`（書き込み）・`/vision`（`onValue()`でのリアルタイム監視）・`/admin`（`isVisible`更新）はすべて
Firebase接続に依存しており、これが整備されないと後続のどのIssueも着手できない。
CLAUDE.md・implementation.md は「Firebase操作は `lib/firebase.ts` に集約する」「各ファイルでinitializeしない」
ことを必須ルールとしているため、本Issueでその単一の入口を用意する。

本Issueには**人間がFirebaseコンソールから手動で行う事前作業**（プロジェクト作成・Blazeプラン切替・
セキュリティルール設定）と、**エージェントが行う実装**（パッケージ導入・`lib/firebase.ts`作成・
`.env.local`雛形作成）が混在する。両者を明確に分離して進める。

---

## 対象Issue

- **Issue番号**：#4
- **タイトル**：[Phase2] Firebase セットアップ・lib/firebase.ts の作成
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/4

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了（build/tsc/lint通過。書き込み接続確認は実認証情報での手動検証が残）
- [ ] PR作成済み

---

## 作業ブランチ

```
feature/issue-4-firebase-setup
```

承認後に `git checkout develop && git checkout -b feature/issue-4-firebase-setup` で作成する。

---

## 実装対象ファイル

### 新規作成するファイル
```
lib/firebase.ts                          # Firebase初期化と操作関数の集約（再エクスポート）
.env.local                               # 環境変数（雛形のみ作成・gitignore済みでコミットされない）
.claude/plans/issue-4-firebase-setup.md  # 本ファイル
```

### 編集するファイル
```
package.json / package-lock.json         # firebase 依存を追加（npm install firebase）
```

### 編集しないファイル（確認のみ）
```
.gitignore                               # 既に「.env*」(34行目) で .env.local を除外済み → 追記不要
```

---

## 手動作業（人間がFirebaseコンソールから事前に実施）

エージェントでは実施できないため、**実装着手前に人間が完了させ、設定値を共有する**こと。

1. https://console.firebase.google.com でプロジェクトを作成
2. Realtime Database を有効化（ロケーション：**asia-southeast1**）
3. **Blazeプラン（従量課金）へ切替**（必須・無料枠の同時接続100超過対策／iPad25台＋ビジョン＋管理画面）
4. Webアプリを追加し、以下4つの設定値を取得して共有する
   - `apiKey` / `authDomain` / `databaseURL` / `projectId`
5. Realtime Database のセキュリティルールを以下に設定
   ```json
   {
     "rules": {
       "declarations": { ".read": true, ".write": true },
       "settings": { ".read": true, ".write": false }
     }
   }
   ```
   > 注：`settings`（NGワード）の書き込みは `.write: false`。/admin からのNGワード更新は
   > このルールだと直接書き込めない。Issue #4 のスコープでは指定どおり設定し、
   > /admin 実装時（後続Issue）にサーバー経由更新やルール調整を別途検討する旨をPRに明記する。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts | ✅ 完了（#3でマージ済み） |
| types/index.ts | ✅ 完了（#3でマージ済み） |
| lib/firebase.ts | これから作成（本Issue） |
| lib/ngWords.ts | スコープ外（後続Issue） |
| Firebaseコンソールの事前作業 | ⬜ 人間が実施（上記「手動作業」） |

> 現状確認：`firebase` パッケージは未インストール（node_modules に存在せず）。
> `.env.local` は未作成。`.gitignore` は `.env*` を含むため `.env.local` はコミットされない。

---

## 実装ステップ

承認後にこの順番で実装する。

1. **ブランチ作成**
   - `git checkout develop && git checkout -b feature/issue-4-firebase-setup`

2. **firebase パッケージの導入**
   - `npm install firebase`
   - `package.json` / `package-lock.json` に追加されることを確認

3. **`.env.local` の雛形作成**（値は人間が手動作業で取得したものを記入）
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   ADMIN_PASSWORD=
   ```
   - Firebase接続値は `NEXT_PUBLIC_` 接頭辞付き（クライアント側 `/input`・`/vision` から接続するため）
   - `ADMIN_PASSWORD` は接頭辞なし（サーバー側のみで参照・クライアントに露出させない）
   - `.gitignore` の `.env*` により本ファイルはコミット対象外であることを再確認する

4. **`lib/firebase.ts` の作成**
   - Issue #4 指定の内容を基本とする：
     ```typescript
     import { initializeApp, getApps } from 'firebase/app'
     import { getDatabase, ref, push, onValue, update, set, off } from 'firebase/database'

     const firebaseConfig = {
       apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
       authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
       databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
       projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
     }

     const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
     const db = getDatabase(app)

     export { db, ref, push, onValue, update, set, off }
     ```
   - `getApps().length === 0 ? ... : getApps()[0]` パターンにより、Next.jsのHMR/SSRでの多重初期化を防ぐ
   - 後続Issueが使う操作（`ref`/`push`/`onValue`/`update`/`set`/`off`）をここから再エクスポートし、
     「各ファイルで firebase を直接 import しない」ルールの単一入口とする

5. **ビルド・型・lintチェック**
   - `npm run build`
   - `npx tsc --noEmit`
   - `npm run lint`

6. **動作確認（接続テスト）** ※「Firebaseへの書き込みが確認できること」の検証
   - 実値入りの `.env.local` がある前提で、`npm run dev` 起動後に簡易書き込みテストを行う
   - 後続の `/api/declare` がまだ無いため、本Issueでは**一時的な確認用スクリプト**で
     `push(ref(db, 'declarations'), {...})` が成功することを確認 → 確認後にスクリプトは削除する
     （恒久的なテストコードはコミットしない）
   - Firebaseコンソールの Realtime Database に書き込みが反映されることを目視確認

7. **コミット & PR作成**
   - `git add lib/firebase.ts package.json package-lock.json .claude/plans/issue-4-firebase-setup.md`
   - **`.env.local` はコミットしない**（add しない・gitignore済み）
   - `git commit -m "feat: Firebaseセットアップとlib/firebase.tsを追加 (#4)"`
   - `git push -u origin feature/issue-4-firebase-setup`
   - `gh pr create --base develop --title '[Phase2] Firebaseセットアップ・lib/firebase.tsの作成' --body 'Closes #4'`

---

## 考慮が必要な点

### エラーハンドリング
- `lib/firebase.ts` の初期化自体には try-catch を入れない方針
  - 理由：初期化失敗（設定値の欠落等）は**起動時に明示的に落として気付ける**べきで、握りつぶすと
    無音で動かなくなる。実際のFirebase書き込み（`push`等）の try-catch は**呼び出し側**
    （`/api/declare`・各画面）で実装するのがCLAUDE.md/implementation.mdの分担
- 環境変数が未設定でも `getDatabase` は import 時点では即時には例外を投げないが、
  `databaseURL` 欠落時は接続時にエラーになる。本Issueでは「実値を入れて接続確認する」ことで担保する

### ビルドが通る理由（環境変数が空でもbuildは成功する）
- 本Issueでは `lib/firebase.ts` を作るだけで、まだどのページ/ルートも import しない
- モジュールトップレベルの `getDatabase(app)` は**実際にバンドル・実行される箇所が無いため
  ビルド時には評価されない** → `npm run build` は環境変数が空でも通る
- 型チェック（tsc）は全ファイル対象だが、後述のとおり型エラーは出ない

### 型の定義
- `firebaseConfig` の各値は `process.env.*` 由来で `string | undefined` 型。
  `initializeApp` が受け取る `FirebaseOptions` は各フィールドが optional string のため**型エラーにならない**（`any`不要）
- `tsconfig.json` は `strict: true` だが `noUncheckedIndexedAccess` は未設定（=false）。
  そのため `getApps()[0]` は `FirebaseApp`（`| undefined` ではない）と推論され、
  Issue記載のサンプルコードはそのまま型チェックを通過する → 余計なキャストや `!` は付けない
- `types/index.ts` への型追加は本Issueでは不要（Firebase SDKの型をそのまま使う）

### メモリリーク対策
- 本Issueでは `onValue` を**再エクスポートするのみ**でリスナー登録は行わないため、該当処理なし
- リスナー解除（`off` / `unsubscribe`）は `/vision` 実装（後続Issue）で `useEffect` の返り値として必須。
  本Issueでは `off` をエクスポートに含めることで後続が解除を実装できるようにしておく

### セキュリティ
- Firebase接続値（apiKey等）はクライアント露出前提のため `NEXT_PUBLIC_` で問題ない
  （Firebaseのクライアント設定値は秘密情報ではなく、保護はセキュリティルールで行う）
- `ADMIN_PASSWORD` は `NEXT_PUBLIC_` を**付けない**（サーバー側のみ・クライアントに露出させない）
- `.env.local` は絶対にコミットしない（`.gitignore` の `.env*` で除外済みを再確認）

### セキュリティルールの注意（後続への申し送り）
- 指定ルールでは `settings.write: false` のため、/admin からのNGワード更新が
  クライアント直書きでは行えない。/admin 実装時にサーバー経由更新かルール変更を検討する旨をPRに明記する

---

## 実装方針

Issue #4 の指定内容を忠実に実装する。エージェントが行うのは
「`npm install firebase`」「`lib/firebase.ts` 作成」「`.env.local` 雛形作成」「ビルド/型/lint確認」
「接続確認（一時スクリプトで書き込み確認し削除）」「PR作成」。
Firebaseコンソール側の作業（プロジェクト作成・Blazeプラン・セキュリティルール）は人間が事前に行い、
取得した設定値を `.env.local` に反映してもらう。スコープを広げず、単一の接続入口を用意することに徹する。

---

## 完了条件

Issue #4 のチェックリストを転記：

- [ ] `npm install firebase` が完了していること
- [ ] `lib/firebase.ts` が存在すること
- [ ] `.env.local` が存在し環境変数が設定されていること（`.gitignore` に含まれていること）
- [ ] Firebaseへの書き込みが確認できること
- [ ] Blazeプランに切り替わっていること（人間の手動作業）
- [ ] `npm run build` が通ること

加えて implementation.md の完了前チェック：

- [ ] `npx tsc --noEmit` でエラーなし
- [ ] `npm run lint` でエラーなし
- [ ] 不要な `console.log` / 接続確認用の一時スクリプトが残っていないこと
- [ ] `.env.local` 等のシークレットがコミットに含まれていないこと

---

## 検証手順（実装後）

1. `npm run build` でビルド成功を確認
2. `npx tsc --noEmit` で型エラーが無いことを確認
3. `npm run lint` でlintエラーが無いことを確認
4. 実値入り `.env.local` で `npm run dev` 起動 → 一時スクリプトで
   `push(ref(db, 'declarations'), { text: 'test', timestamp: Date.now(), isVisible: true })` を実行し、
   Firebaseコンソールの Realtime Database に反映されることを確認 → スクリプト削除
5. `git status` で `.env.local` がコミット対象に含まれていないことを確認

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：ユーザー  
**承認日**：2026-05-28  
**コメント**：承認済み。本プランどおり実装を進める。
