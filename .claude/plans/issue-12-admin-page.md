# 実装プラン：Issue #12 /admin 管理画面の実装

## 対象Issue

- **Issue番号**：#12
- **タイトル**：[Phase3] /admin 管理画面の実装
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/12

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了
- [x] PR作成済み（PR #36）

---

## 作業ブランチ

```
feature/issue-12-admin-page
```

> 本ブランチは `develop`（#35 マージ済み）から作成済み（プランファイル配置のため）。
> **実装本体は承認後に着手する。**

---

## 概要

スタッフ用の管理画面 `/admin` を実装する。機能は3つ。

1. **パスワード認証**：ログインしないと管理機能を表示しない。リロードしても認証を維持する。
2. **宣言の確認・非表示化**：宣言一覧（投稿日時・テキスト・表示状態）を表示し、**物理削除せず `isVisible` を切り替える**。/vision に即反映される。
3. **NGワード管理**：Firebase `settings/ngWords` を追加・削除する。/input のバリデーションに即反映される。

---

## ⚠️ 要確認1：認証方式（Issue本文のコード例から変更が必要）

Issue本文の認証コードは `process.env.NEXT_PUBLIC_ADMIN_PASSWORD` をクライアントで直接比較しているが、**この方式は本プロジェクトの方針と矛盾し、採用できない**。

| Issue本文の例 | 本プロジェクトの方針 |
|---|---|
| `NEXT_PUBLIC_ADMIN_PASSWORD` をクライアントで比較 | パスワードは **`ADMIN_PASSWORD`（接頭辞なし＝サーバー専用）**。`lib/constants.ts` の `ADMIN_PASSWORD_ENV='ADMIN_PASSWORD'`、`.env.local` も「クライアントに露出させないため接頭辞なし」と明記 |
| → パスワードがクライアントバンドルに**露出** | `review.md` セキュリティ要件「`NEXT_PUBLIC_*` 以外の環境変数がフロントに露出していないか」に**反する** |

→ **本Issueでは「サーバー側でパスワード照合する APIルート」に変更する**（下記・決定1）。
これに伴い Issue のファイル一覧に無い `app/api/admin/login/route.ts` を**新規追加**する。

> **✅ 確定（2026-05-29 ユーザー確認）：採用（サーバー照合）。**

---

## ⚠️ 要確認2：/api/declare のサーバー側 NGワードマージを本Issに含めるか（任意）

- 現状 `/api/declare` は `DEFAULT_NG_WORDS` のみで判定（コード上「Firebase settings/ngWords のマージは別Issue」と明記）。
- 一方 **`/input`（`DeclarationForm.tsx`）は既に `settings/ngWords` を購読し `DEFAULT_NG_WORDS` とマージ済み**。→ 管理画面が `settings/ngWords` を更新すれば**UI（入力画面）のバリデーションは即反映され、完了条件は満たせる**。
- ただしサーバー（`/api/declare`）は追加語を見ないため、**API直叩き（curl等）では追加NGワードがすり抜ける**。防御の一貫性を取るなら本Issueで `/api/declare` にもマージを入れられる（`lib/firebase.ts` に `get` を追加 export し、POST時に `settings/ngWords` を読んでマージ）。
> **✅ 確定（2026-05-29 ユーザー確認）：本Issueに含める。**
> UIだけのNG判定は実質的に弱く（API直叩き等で抜ける）、`/api/declare` がNG機能の本当のゲートになるため、サーバー側でも追加NGワードを判定して機能を完結させる。
> **読み取り失敗時のフォールバック**：`get(settings/ngWords)` が失敗しても全送信をブロックしないよう、失敗時は `DEFAULT_NG_WORDS` のみで判定する（ログは出す・握りつぶさない）。
> **コスト**：宣言1件ごとに小ノードを1回読む（追加レイテンシ数十ms・帯域僅少）。イベント規模では無視できる。

---

## 前提（現状の関連実装）

- **`/input`（`components/input/DeclarationForm.tsx`）**：`settings/ngWords` を `onValue` で購読し `DEFAULT_NG_WORDS` とマージして判定済み。非配列は `[]` にフォールバック。→ **NGワード即反映の受け皿は既にある**。
- **`/vision`（`app/vision/page.tsx`）**：`declarations` を `onValue` 監視。`isVisible=true` のみカウント・葉表示。→ **非表示化の即反映の受け皿は既にある**。
- **`lib/firebase.ts`**：`db, ref, push, onValue, onChildAdded, update, set, off, serverTimestamp` を export 済み。→ **管理画面に必要な `update/set/onValue/off` は追加不要**（要確認2を採用する場合のみ `get` を追加）。
- **`lib/constants.ts`**：`ADMIN_PASSWORD_ENV='ADMIN_PASSWORD'` 済み。
- **`types/index.ts`**：`Declaration { id, text, timestamp, isVisible }` 済み。

---

## 実装対象ファイル

### 新規作成
```
app/admin/page.tsx                         # 認証state＋ログインフォーム＋認証後に各マネージャを表示
app/admin/page.module.scss                 # 管理画面のスタイル
components/admin/DeclarationList.tsx        # 宣言一覧＋非表示/再表示トグル
components/admin/DeclarationList.module.scss
components/admin/NgWordManager.tsx          # NGワード一覧＋追加/削除
components/admin/NgWordManager.module.scss
app/api/admin/login/route.ts               # ★パスワードをサーバー側で照合（要確認1）
```

### 編集
```
app/api/declare/route.ts                   # settings/ngWords をマージして判定（サーバー側NG enforcement・要確認2＝採用）
lib/firebase.ts                            # get を追加 export
```

> ログインフォームは独立コンポーネントにせず `app/admin/page.tsx` 内に置く（Issueのファイル構成に沿う）。

---

## 依存関係の確認

| 依存 | 状態 | 備考 |
|---|---|---|
| lib/firebase.ts | ✅ 完了（`get` を追加） | `update/set/onValue/off/ref/db` export済み。要確認2＝採用のため `get` を追加 export する |
| lib/constants.ts（ADMIN_PASSWORD_ENV） | ✅ 完了 | ログインAPIで `process.env[ADMIN_PASSWORD_ENV]` を参照 |
| types/index.ts（Declaration） | ✅ 完了 | 一覧表示に使用 |
| /input（settings/ngWords 購読） | ✅ 完了 | NGワード即反映の前提 |
| /vision（declarations 監視） | ✅ 完了 | 非表示即反映の前提 |
| 環境変数 `ADMIN_PASSWORD` | ⚠️ 要設定 | `.env.local` と Vercel に設定。未設定だとログイン不可 |

---

## 設計上の決定事項

### 決定1：認証はサーバー側照合（APIルート）＋ localStorage フラグ
- **`app/api/admin/login/route.ts`**：POST で `{ password }` を受け取り、`process.env[ADMIN_PASSWORD_ENV]`（=`ADMIN_PASSWORD`・サーバー専用）と照合して `{ success: boolean }` を返す。GET 等は 405。**パスワードはレスポンスにもクライアントにも出さない。** 環境変数未設定時は `success:false`（誤って素通りさせない）。
- **`app/admin/page.tsx`**：ログインフォーム → `/api/admin/login` に POST → `success` で `setIsAuthenticated(true)` ＋ `localStorage.setItem('adminAuth','true')`、失敗で `alert('パスワードが違います')`。マウント時に `localStorage.getItem('adminAuth')==='true'` なら認証済みに復元（リロード維持）。
- **正直な注記**：localStorage フラグはクライアントで書き換え可能なため、これは「本格的なアクセス制御」ではない。本Issueの重要要件は**パスワードをクライアントに露出させないこと**で、それは満たす。スタッフ用簡易ゲートとしては十分。より堅牢にするなら httpOnly Cookie のセッションだが本Issueのスコープ外（必要なら別Issue）。

### 決定2：宣言一覧は onValue 購読＋ isVisible トグル（物理削除しない）
- `components/admin/DeclarationList.tsx`：`declarations` を `onValue` 購読 → `Declaration[]`（`{id, text, timestamp, isVisible}`）に整形し**投稿日時の降順**で表示。各行に テキスト・投稿日時（`timestamp` を整形）・表示状態・「非表示／再表示」ボタン。
- 切替：`update(ref(db, \`declarations/${id}\`), { isVisible })`。/vision は監視済みのため即反映。
- メモリリーク対策：`onValue` の戻り値（unsubscribe）を cleanup で解除。
- 型：`Declaration` を使用。`any` 不使用。Firebase の戻り値はオブジェクト→配列に変換。

### 決定3：NGワード管理は settings/ngWords（配列）の set。/input は購読済みで即反映
- `components/admin/NgWordManager.tsx`：`settings/ngWords` を `onValue` 購読 → `string[]`（非配列は `[]` にフォールバック＝DeclarationFormと同じ堅牢化）。
- 追加：`set(ref(db,'settings/ngWords'), [...current, word])`、削除：`set(ref(db,'settings/ngWords'), current.filter(w => w !== word))`。
- 入力は `trim` し、空文字・既存重複は追加しない。
- **管理対象は Firebase の追加リストのみ**。`DEFAULT_NG_WORDS`（コード固定）は常時有効で、管理画面では編集しない（混乱回避のため、必要なら参考として読み取り専用表示も可）。
- 即反映：`/input` が `settings/ngWords` を購読済みのため、追加・削除がそのまま反映される（完了条件を満たす）。

### 決定4：宣言一覧の件数規模への配慮
- `declarations` は最大1万件規模になりうる。全件を一覧描画するとDOM負荷が大きい。
- 当日の管理用途は限定的（スポットでの非表示化）だが、件数増大時の負荷を考慮し、**表示件数の上限（例：新しい順に直近 N 件）または簡易ページング**を検討する。Issueは「シンプルな管理画面」のため、まずは上限表示で軽量に保つ方針（詳細は実装時に確定）。

---

## 実装ステップ

承認後、以下の順で実装する。

1. **`app/api/admin/login/route.ts`**：POST でパスワード照合（決定1）。`process.env[ADMIN_PASSWORD_ENV]` と比較し `{success}` を返す。未設定・空は `false`。GET は 405。
2. **`app/admin/page.tsx`（＋scss）**：認証 state、ログインフォーム（password 入力→ログインAPIに POST）、localStorage 連携（保存・復元）、認証後に `DeclarationList` と `NgWordManager` を表示。
3. **`components/admin/DeclarationList.tsx`（＋scss）**：`declarations` 購読→一覧＋非表示/再表示トグル（決定2）。cleanup で解除。
4. **`components/admin/NgWordManager.tsx`（＋scss）**：`settings/ngWords` 購読→一覧＋追加/削除（決定3）。cleanup で解除。
5. **`lib/firebase.ts` に `get` 追加 export ＋ `app/api/declare/route.ts` で `settings/ngWords` をマージして判定**（要確認2＝採用）。読み取り失敗時は `DEFAULT_NG_WORDS` のみで判定（フォールバック）。コード内の「マージは別Issue」コメントも更新する。
6. **検証**：`npm run build` / `npx tsc --noEmit` / `npm run lint` ＋ `npm run dev` で目視（ログイン成功/失敗/リロード維持、非表示化→/vision から消える／再表示→戻る、NG追加→/input でエラー／削除→消える）。

---

## 考慮が必要な点

### セキュリティ（最重要）
- パスワードをクライアントに出さない（`NEXT_PUBLIC_` を使わず、サーバー照合）。
- `ADMIN_PASSWORD` 未設定時はログインを通さない（`success:false`）。
- localStorage フラグの限界は決定1の注記のとおり（本Issueのスコープ内では許容）。

### エラーハンドリング
- Firebase 操作（`update`/`set`）は try-catch し、失敗時はユーザーへ通知（握りつぶさない）。
- ログイン `fetch` の失敗もハンドリング（ネットワークエラー時の通知）。
- API Route はエラー時に適切なステータス（400/405/500）を返す。

### メモリリーク対策
- `DeclarationList`／`NgWordManager` の `onValue` を cleanup で必ず解除（管理画面も長時間開かれうる）。

### 型
- `Declaration` を使用。`any` 不使用。NGワードは `string[]`。Firebase 戻り値の整形時に型を明示。

### データ整合
- `settings/ngWords` は**配列**で書き込む（`/input` が配列前提・非配列は `[]` フォールバック）。RTDB の疎配列挙動に注意。

### コード品質
- localStorage キー `'adminAuth'` は定数化を検討（任意）。
- SCSS Modules ＋ CSS変数を使用。マジックナンバー/文字列を避ける。

---

## 完了条件（Issue #12 から転記）

- [ ] 正しいパスワードでログインできること
- [ ] 間違ったパスワードでログインできないこと
- [ ] 宣言を非表示にするとビジョン画面から即座に消えること
- [ ] NGワードを追加するとバリデーションに即反映されること
- [ ] `npm run build` が通ること

### 追加（本プランの方針）
- [ ] パスワードがクライアントバンドルに露出しない（サーバー照合・決定1）
- [ ] 追加したNGワードが `/api/declare`（サーバー側）でもブロックされること（要確認2＝採用・フォールバックあり）
- [ ] 宣言の再表示で /vision に再表示されること（testing.md /admin test5）
- [ ] リロード後も認証が維持されること（testing.md /admin test3）
- [ ] `onValue` リスナーが cleanup で解除されること（メモリリーク対策）
- [ ] `npx tsc --noEmit` / `npm run lint` が通ること

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii
**承認日**：2026-05-29
**コメント**：承認。サーバー側パスワード照合（要確認1）＋ /api/declare のサーバー側NGワードマージ（要確認2＝含める）を含めて実装する。
