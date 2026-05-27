# 実装エージェント ルール

このファイルは実装を担当するClaude Codeエージェントが従うルールを定義します。
実装を始める前に必ずこのファイルとプロジェクトルートの `CLAUDE.md` を読んでください。

---

## 実装の流れ（必ず守ること）

```
① プランモードでプランを作成・保存
        ↓
② プランを人間がレビュー・承認
        ↓
③ 承認されたプランに従って実装
        ↓
④ 実装完了チェックリストを確認
        ↓
⑤ PRを作成してレビュー依頼
```

**プランの承認なしに実装を始めてはいけません。**

---

## プランモードのルール

### プランモードの起動方法
```bash
# Claude Codeでプランモードを使う場合
# Shift+Tab でプランモードに切り替えてから指示する
# または以下のように明示的に指示する
"プランモードで Issue #8 の実装プランを作成して"
```

### プランの保存先
```
.claude/plans/issue-{番号}-{内容を英語で簡潔に}.md

# 例
.claude/plans/issue-8-input-page.md
.claude/plans/issue-9-api-declare.md
.claude/plans/issue-10-vision-page.md
```

### プランに含める内容
プランファイルには以下を必ず含めること。
テンプレートは `.claude/plans/_template.md` を参照すること。

1. **対象Issue** - Issue番号・タイトル・URL
2. **実装対象ファイル** - 新規作成・編集するファイルの一覧
3. **依存関係の確認** - 先に実装が必要なファイルが存在するか
4. **実装ステップ** - 何をどの順番で実装するか（番号付きリスト）
5. **考慮が必要な点** - エラーハンドリング・メモリリーク・型など
6. **完了条件** - Issueの完了条件チェックリストをそのまま転記

### プランのレビューポイント
プランを人間がレビューするときに確認すること：
- 実装ステップに抜け漏れがないか
- CLAUDE.mdの仕様と矛盾していないか
- 考慮が必要な点に重大な見落としがないか



## 基本的な動き方

### 1. Issueを受け取ったら最初にやること
```
1. CLAUDE.mdを読む（プロジェクト全体の仕様を把握）
2. 対象Issueの「実装対象ファイル」を確認する
3. 依存するファイル（lib/constants.ts・types/index.tsなど）が存在するか確認する
4. プランモードでプランを作成し .claude/plans/ に保存する
5. 人間の承認を得てから作業ブランチを作成して実装を開始する
```

### 2. ブランチの命名ルール
```bash
# Issue番号とタイトルを含める
git checkout develop
git checkout -b feature/issue-{番号}-{内容を英語で簡潔に}

# 例
git checkout -b feature/issue-8-input-page
git checkout -b feature/issue-9-api-declare
git checkout -b feature/issue-10-vision-page
```

### 3. コミットメッセージのルール
```bash
# Conventional Commitsに従う
feat: 新機能の追加
fix: バグ修正
docs: ドキュメントのみの変更
refactor: リファクタリング
test: テストの追加・修正
chore: ビルド・設定ファイルの変更

# 例
git commit -m "feat: タブレット入力画面を実装 (#8)"
git commit -m "fix: NGワードバリデーションが空文字で誤検知する問題を修正 (#8)"
```

### 4. PRの作成
```bash
# developブランチへのPRを作成する（mainへは直接PRしない）
gh pr create \
  --base develop \
  --title "[Phase3] /input 入力画面を実装" \
  --body "## 概要
Closes #8

## 変更内容
- app/input/page.tsxを新規作成
- components/input/DeclarationForm.tsxを新規作成

## 動作確認
- [ ] npm run buildが通ること
- [ ] 50文字制限が動作すること
- [ ] NGワードバリデーションが動作すること
- [ ] キーボードが常時表示されること"
```

---

## コーディングルール

### TypeScript
```typescript
// ✅ 良い例：型を明示する
const handleSubmit = async (text: string): Promise<void> => { ... }

// ❌ 悪い例：anyを使う
const handleSubmit = async (text: any) => { ... }
```

### 定数・型の使い方
```typescript
// ✅ 良い例：lib/constants.tsからimportする
import { MAX_CHARS, RESET_DELAY_MS, MILESTONES } from '@/lib/constants'

// ❌ 悪い例：マジックナンバーを直接書く
if (text.length > 50) { ... }  // 50という数字を直接書かない
```

### Firebase操作
```typescript
// ✅ 良い例：lib/firebase.tsからimportする
import { db, ref, push, onValue } from '@/lib/firebase'

// ❌ 悪い例：直接firebaseをimportする
import { initializeApp } from 'firebase/app'  // 各ファイルでinitializeしない
```

### エラーハンドリング
```typescript
// ✅ 良い例：try-catchで必ずエラーを処理する
try {
  await push(ref(db, 'declarations'), data)
} catch (error) {
  console.error('Firebase書き込みエラー:', error)
  // ユーザーにエラーを通知する処理
}

// ❌ 悪い例：エラーを無視する
await push(ref(db, 'declarations'), data)  // エラー処理なし
```

### コンポーネントの構造
```typescript
// ✅ 良い例：関数コンポーネント + hooksを使う
'use client'
import { useState, useEffect, useRef } from 'react'

export default function DeclarationForm() {
  const [text, setText] = useState('')
  // ...
}

// ❌ 悪い例：クラスコンポーネントを使う
class DeclarationForm extends React.Component { ... }
```

### SCSS Modules
```scss
// ✅ 良い例：CSS変数を使う
.container {
  background-color: var(--color-bg);
  color: var(--color-text);
}

// ❌ 悪い例：カラーコードを直書きする
.container {
  background-color: #1B3A2D;  // 直書きしない
}
```

---

## 実装完了前のチェックリスト

実装が完了したら以下を必ず確認してからPRを作成すること。

```bash
# 1. ビルドエラーがないか確認
npm run build

# 2. TypeScriptのエラーがないか確認
npx tsc --noEmit

# 3. ESLintのエラーがないか確認
npm run lint

# 4. ローカルで動作確認
npm run dev
```

- [ ] `npm run build` が通ること
- [ ] `npx tsc --noEmit` でTypeScriptエラーがないこと
- [ ] `npm run lint` でESLintエラーがないこと
- [ ] Issueの「完了条件」チェックリストがすべてクリアされていること
- [ ] コンソールに不要なconsole.logが残っていないこと
- [ ] .env.localなどの秘密情報がコミットに含まれていないこと

---

## やってはいけないこと

- `main` ブランチに直接コミットしない
- `develop` ブランチに直接コミットしない（必ずfeatureブランチを作る）
- `.env.local` をgitにコミットしない
- `any` 型を使わない
- マジックナンバーを直接コードに書かない（lib/constants.tsを使う）
- Firebase操作をlib/firebase.ts以外のファイルで初期化しない
- エラーハンドリングを省略しない