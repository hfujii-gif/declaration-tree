# Issue #8 実装プラン：/input タブレット入力画面の実装

## Context（なぜこの作業を行うか）

イベント会場のiPad（25台）で**常時表示**する参加者向けの入力画面。
参加者が「明日から取り組む行動」を50文字以内で宣言し、`/api/declare` に送信する。
送信後は画面遷移せず、オーバーレイで完了メッセージを表示し、3秒後に自動でフォームに戻る。

このシステムは**当日8時間以上止まれない**ため、本Issueでは特に以下を重視する。

- **キーボードを閉じない**（画面遷移せず、textarea をアンマウントしないオーバーレイ方式）
- **送信失敗時にユーザーへ通知し、入力テキストを失わない**（再送信できる状態を維持）
- **NGワード・文字数・空文字のリアルタイムバリデーション**で不適切な宣言をブロック

本Issueのスコープは「`/input` 画面と入力フォームコンポーネントの実装」に限定する。
送信先である `/api/declare`（Issue #9）の実装は**スコープ外**（後述「依存関係」参照）。

---

## 対象Issue

- **Issue番号**：#8
- **タイトル**：[Phase3] /input タブレット入力画面の実装
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/8

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [x] 承認済み → 実装開始可能
- [x] 実装完了（build / tsc / lint 通過・/input スモークテスト 200）
- [ ] PR作成済み

---

## 作業ブランチ

```
feature/issue-8-input-page
```

> 本ブランチは `develop` から作成済み（プランファイル配置のため）。
> **画面・コンポーネントの実装本体は承認後に着手する。**

---

## 実装対象ファイル

### 新規作成するファイル
```
app/input/page.tsx                          # /input ルート（DeclarationForm を描画するだけの薄いラッパ）
components/input/DeclarationForm.tsx         # 入力・バリデーション・送信・完了オーバーレイ（'use client'）
components/input/DeclarationForm.module.scss # フォームのスタイル（CSS変数を使用）
.claude/plans/issue-8-input-page.md          # 本ファイル
```

### 編集するファイル
```
なし
```

> `app/page.tsx`（Next.js のボイラープレート）には触れない。本Issueのスコープ外。

---

## 依存関係の確認

| 依存するファイル/Issue | 状態 |
|---|---|
| lib/constants.ts（MAX_CHARS / RESET_DELAY_MS） | ✅ 完了（#3でマージ済み） |
| types/index.ts（DeclareRequestBody） | ✅ 完了（#3でマージ済み） |
| lib/firebase.ts（db / ref / onValue / off） | ✅ 完了（#4でマージ済み） |
| lib/ngWords.ts（DEFAULT_NG_WORDS / containsNgWord） | ✅ 完了（#7でマージ済み） |
| **app/api/declare/route.ts（送信先）** | ⬜ **未作成（Issue #9）— 後述の通り本Issueのビルド・完了条件には影響しない** |

> **重要な申し送り：`/api/declare` はまだ存在しない。**
> 入力画面は `fetch('/api/declare', ...)` を呼ぶが、ビルド（`npm run build`）と型チェックは
> ルートの有無に依存しないため**通る**。一方、実機での「送信→成功オーバーレイ」までの
> E2E動作確認は #9 完了後でないと行えない。本Issueの完了条件はビルド通過とフロント挙動
> （文字数・NGワード・空文字・オーバーレイ・リセット）に限定し、E2E送信確認は #9 とあわせて
> テストエージェント（testing.md）で実施する想定とする。

確認済み：パスエイリアス `@/*` は tsconfig.json に設定済みのため `@/lib/...`・`@/types`・`@/components/...` で import 可能。
CSS変数は **`app/globals.scss`** に定義済み（`--color-bg` `--color-accent` `--color-text` `--color-error` `--color-gray`）。
※ CLAUDE.md の構成図では `styles/globals.scss` と記載されているが、実体は `app/globals.scss`。本Issueでは `app/globals.scss` の変数を参照する（構成図の修正は本Issueのスコープ外）。

---

## 実装ステップ

承認後にこの順番で実装する。

1. **（ブランチは作成済み）**
   - `feature/issue-8-input-page` は `develop` から作成済み。

2. **`components/input/DeclarationForm.tsx` の作成（`'use client'`）**
   - state：`text` / `isSubmitting` / `isComplete` / `errorMessage`（送信失敗時の通知用）/ `firebaseNgWords`（settings/ngWords を購読：決定点①(A)）
   - `textareaRef = useRef<HTMLTextAreaElement>(null)`、マウント時に `focus()`
   - import：
     ```typescript
     import { MAX_CHARS, RESET_DELAY_MS } from '@/lib/constants'
     import { containsNgWord, DEFAULT_NG_WORDS } from '@/lib/ngWords'
     import { db, ref, onValue, off } from '@/lib/firebase'  // settings/ngWords 購読（決定点①(A)）
     import type { DeclareRequestBody } from '@/types'
     ```
   - バリデーション（Issue記載どおり）：
     ```typescript
     const isOverLimit   = text.length > MAX_CHARS
     const isTooShort    = text.trim().length === 0
     const hasNgWord     = containsNgWord(text, [...DEFAULT_NG_WORDS, ...firebaseNgWords])
     const isSubmittable = !isTooShort && !isOverLimit && !hasNgWord && !isSubmitting
     ```
     - `firebaseNgWords` は `settings/ngWords` の購読値（決定点①(A)で確定）。初期値 `[]`。
   - textarea：`maxLength` は付けず**入力自体はブロックしない**。`isOverLimit`（>MAX_CHARS）のとき赤枠＋
     「50文字以内で入力してください」を表示し、`isSubmittable` により送信ボタンを無効化する（決定点③）。
   - 文字数カウンター：`{text.length} / {MAX_CHARS}文字` をリアルタイム表示。超過時はカウンターを赤字にする。
   - NGワード時：`hasNgWord` が true のとき赤枠（CSS）＋「使用できない言葉が含まれています」を表示。削除すると即消える（state派生なので自動）。
   - バリデーションメッセージは NGワード優先 → 文字数超過 の順で1行表示する。
   - 送信ボタン：`disabled={!isSubmittable}` でグレーアウト。

3. **送信処理 `handleSubmit` の実装**
   - Issueサンプルを基本にしつつ、**送信失敗時のユーザー通知**を追加（spec／review.md 必須・testing #14）：
     ```typescript
     const handleSubmit = async (): Promise<void> => {
       if (!isSubmittable) return
       setIsSubmitting(true)
       setErrorMessage('')
       try {
         const body: DeclareRequestBody = { text: text.trim() }
         const res = await fetch('/api/declare', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(body),
         })
         if (!res.ok) throw new Error('送信失敗')
         setIsComplete(true)
         setTimeout(() => {
           setText('')
           setIsComplete(false)
           setIsSubmitting(false)
           textareaRef.current?.focus()
         }, RESET_DELAY_MS)
       } catch (error) {
         console.error('宣言の送信に失敗しました:', error)
         setErrorMessage('送信に失敗しました。もう一度お試しください。')
         setIsSubmitting(false)
         // text は保持（リセットしない）→ 再送信できる状態を維持
       }
     }
     ```
   - `body` に `DeclareRequestBody` 型を明示。

4. **完了オーバーレイの実装（キーボードを閉じない方式）**
   - `isComplete` のときに**絶対配置のオーバーレイ**を最前面に重ねる。
   - **textarea は常にマウントしたまま**（オーバーレイで覆うだけ。条件分岐でアンマウントしない）
     → これによりフォーカスが外れず、画面遷移もないためキーボードが閉じない。
   - 3秒後（`RESET_DELAY_MS`）に `text` クリア＋オーバーレイ非表示＋`textareaRef.current?.focus()`。

5. **`components/input/DeclarationForm.module.scss` の作成**
   - CSS変数（`var(--color-bg)` 等）を使用。カラーコード直書きはしない。
   - クラス：コンテナ／textarea／NGワード時の赤枠（`--color-error`）／カウンター／送信ボタン（活性・グレーアウト）／完了オーバーレイ／エラーメッセージ。

6. **`app/input/page.tsx` の作成**
   - `DeclarationForm` を描画するだけの薄いラッパ。
     ```tsx
     import DeclarationForm from '@/components/input/DeclarationForm'
     export default function InputPage() {
       return <DeclarationForm />
     }
     ```

7. **ビルド・型・lint・ローカル確認**
   - `npm run build` / `npx tsc --noEmit` / `npm run lint`
   - `npm run dev` で `/input` を開き、文字数・NGワード・空文字・オーバーレイ・リセット挙動を確認。
   - 送信成功（200→オーバーレイ）の確認は #9 未実装のため**保留**（#9 完了後にテストで実施）。

8. **コミット & PR作成**
   - `git add app/input/page.tsx components/input/DeclarationForm.tsx components/input/DeclarationForm.module.scss .claude/plans/issue-8-input-page.md`
   - `git commit -m "feat: タブレット入力画面を実装 (#8)"`
   - `git push -u origin feature/issue-8-input-page`
   - `gh pr create --base develop --title '[Phase3] /input 入力画面を実装' --body 'Closes #8 ...'`

---

## 考慮が必要な点

### 決定点①：Firebase の NGワード（`settings/ngWords`）を本Issueで購読する → **【確定：購読する (A)】**
Issue本文のバリデーション例は `containsNgWord(text, [...DEFAULT_NG_WORDS, ...firebaseNgWords])` と
**Firebase上のNGワードとのマージ**を前提にしている。管理画面（#11／NGワード追加）は未実装で
`settings/ngWords` は現状ほぼ空だが、**当日に管理画面から追加したNGワードを入力画面へ即反映させる**ため、
本Issueで購読する方針に決定（ユーザー確認済み・2026-05-28）。

- **採用 (A)**：`onValue(ref(db, 'settings/ngWords'))` で購読し、
  snapshot が null のときは `[]` にフォールバック。`useEffect` の返り値で**必ず `off`／unsubscribe**して
  メモリリーク対策（review.md 必須）。`DEFAULT_NG_WORDS` とマージして判定。
  → Issueの設計意図どおり。#11 完成後に管理画面で追加した語が25台のiPadに即反映される。
- ~~(B) `DEFAULT_NG_WORDS` のみ~~：不採用（後で購読処理を足す二度手間になるため）。

**注意：Firebase リスナーの解除（cleanup での `off`）が必須要件**となる（下記「メモリリーク対策」参照）。

### 決定点②：送信失敗時のユーザー通知（Issueサンプルからの必要な追加）
Issueの `handleSubmit` サンプルの `catch` は `setIsSubmitting(false)` のみで**ユーザーに通知しない**。
しかし review.md（「フロントエンドがAPIエラー時にユーザーへ通知しているか」）と
testing.md #14（「エラーメッセージが表示される（テキストは残る）」）は通知を必須としている。
→ `errorMessage` state を追加し、失敗時にメッセージ表示＋`text` 保持とする（上記ステップ3）。これは仕様適合のための必須追加と判断。

### エラーハンドリング
- `fetch` の失敗（ネットワーク断・非2xx）を try-catch で捕捉し、`errorMessage` で通知。`text` はリセットしない。
- 成功時のみ `isComplete` を立て、3秒後にリセット。

### メモリリーク対策（当日8時間以上稼働）
- 決定点①(A) 採用により**必須**：`settings/ngWords` の `onValue` リスナーを `useEffect` の cleanup で必ず解除。
  ```typescript
  useEffect(() => {
    const r = ref(db, 'settings/ngWords')
    const unsub = onValue(r, (snap) => setFirebaseNgWords((snap.val() as string[] | null) ?? []))
    return () => off(r)   // または unsub()
  }, [])
  ```
- `setTimeout`（リセット用）は送信成功時のみ起動する短命タイマー。コンポーネントが長時間マウントされ続ける前提のため、
  アンマウントは基本起きないが、安全のため**タイマーIDを保持し cleanup でクリア**することを検討（多重起動防止）。

### 型の定義
- 新規の型追加は不要。`DeclareRequestBody`（`{ text: string }`）を送信ボディに使用。
- すべての関数（`handleSubmit` 等）の引数・返り値に型を明示。`any` 不使用。
- Firebase の `snapshot.val()` は `unknown` 相当のため `as string[] | null` で受け、null は `[]` にフォールバック（決定点①(A)）。

### iPad Safari でのキーボード／フォーカス（CLAUDE.md 注意事項）
- iOS Safari はプログラム `focus()` だけではキーボードを自動表示できない（初回はスタッフがタップ）。
  本実装は**画面遷移せずオーバーレイ方式で textarea を保持**するため、一度開いたキーボードは閉じない設計。
  マウント時／リセット後の `focus()` は「フォーカスを維持する」ためのもの（デスクトップ確認用も兼ねる）。
- 完了表示中も textarea をアンマウントしないことが**最重要**（条件分岐で消すとキーボードが閉じる）。

### 決定点③：50文字制限はバリデーション表示方式にする → **【確定：採用（仕様変更）2026-05-28】**
当初のIssue #8 完了条件は「50文字を超えて入力できないこと」（＝`maxLength` で物理ブロック）だったが、
以下の理由でユーザー判断により**入力はブロックせず、超過時にバリデーションエラー表示＋送信不可**に変更する。
- 物理ブロックは入力が無言で止まり理由が伝わりにくい（長文貼り付け時も黙って切り捨て）。
- 日本語IME変換中に `maxLength` が不自然な挙動になることがある。
- API（#9）も超過時に「50文字以内で入力してください」を返す想定で、フロントのメッセージと一貫する。
> 本変更に伴い、Issue #8 完了条件（本ファイル）と testing.md テスト#10 を更新済み。
> PR説明にも「仕様変更：入力ブロック→バリデーション表示」と明記する。

### IME（日本語入力）について
- 入力中（変換確定前）も `text.length` カウンターと NGワード判定はリアルタイムに走る。変換中の表示揺れは許容範囲。
  `maxLength` は付けないため変換に干渉しない。過剰な composition 制御（compositionstart/end）は本Issueでは入れない。

### その他
- 不要な `console.log` は残さない（`console.error` はエラーハンドリングとして可）。
- マジックナンバー（50・3000）は直書きせず `MAX_CHARS`／`RESET_DELAY_MS` を使用。
- カラーコード直書き禁止。`DeclarationForm.module.scss` では CSS変数を使用。
- `.env.local` 等のシークレットはコミットに含めない（本Issueは秘密情報を扱わない）。

---

## 実装方針

`app/input/page.tsx` は薄いラッパとし、ロジックは `components/input/DeclarationForm.tsx`（`'use client'`）に集約する。
バリデーションは Issue記載の派生値（`isOverLimit`／`isTooShort`／`hasNgWord`／`isSubmittable`）をそのまま採用し、
state から都度導出する（リアルタイム反映）。完了表示は**画面遷移ではなくオーバーレイ**で行い、
textarea を常時マウントしてキーボードを閉じさせない。Issueサンプルからの逸脱は最小限とし、
**送信失敗時の通知（決定点②）**のみ仕様適合のために追加する。**決定点①（Firebase NGワード購読の採否）**は承認時に確定する。

---

## 完了条件

Issue #8 のチェックリストを転記：

- [ ] 50文字を超えると赤枠＋「50文字以内で入力してください」が表示され送信できないこと（入力自体はブロックしない／決定点③で仕様変更）
- [ ] 空文字・空白のみで送信ボタンが押せないこと
- [ ] NGワードを入力すると赤枠とエラーメッセージが表示されること
- [ ] NGワードを削除するとエラーが消えること
- [ ] 送信後にオーバーレイが表示されキーボードが閉じないこと
- [ ] 3秒後にテキストがリセットされフォームに戻ること
- [ ] npm run buildが通ること

加えて implementation.md の完了前チェック：

- [ ] `npx tsc --noEmit` でTypeScriptエラーがないこと
- [ ] `npm run lint` でESLintエラーがないこと
- [ ] `any` 型を使っていないこと
- [ ] マジックナンバーを直書きしていないこと（MAX_CHARS／RESET_DELAY_MS 使用）
- [ ] Firebase リスナー（settings/ngWords の onValue）が cleanup で解除されていること（決定点①(A)）
- [ ] 不要な `console.log` が残っていないこと
- [ ] `.env.local` 等のシークレットがコミットに含まれていないこと

---

## 検証手順（実装後）

1. `npm run build` / `npx tsc --noEmit` / `npm run lint` が通ることを確認。
2. `npm run dev` で `/input` を開き、以下を手動確認：
   - 50文字ちょうどは送信可。51文字以上も入力はできるが赤枠＋「50文字以内で入力してください」＋カウンター赤字＋送信ボタン無効（決定点③）／カウンター更新
   - 空・空白のみで送信ボタンがグレーアウト
   - NGワード入力で赤枠＋エラー → 削除でエラーが消え送信可に戻る
   - 送信後オーバーレイ表示（画面遷移しない＝キーボード維持）→ 3秒でリセット＋フォーカス復帰
   - （#9 未実装のため）送信が失敗するケースでエラーメッセージが出てテキストが残ること（testing #14）
3. `git diff develop --name-only` で、コミット対象が
   `app/input/page.tsx` / `components/input/DeclarationForm.tsx` / `components/input/DeclarationForm.module.scss` /
   `.claude/plans/issue-8-input-page.md` のみであることを確認。
4. 送信成功（200→完了オーバーレイ）の E2E確認は #9 完了後にテストエージェントで実施。

---

## 承認コメント欄

> プランを確認したら以下に承認コメントを記入してください。

**承認者**：Haruto Fujii  
**承認日**：2026-05-28  
**コメント**：決定点①は「購読する(A)」を採用（当日に管理画面で追加したNGワードを入力画面へ即反映するため。リスナーは cleanup で必ず解除）。決定点②（送信失敗時のユーザー通知＋テキスト保持）も採用で承認。
