# .claude/plans/

実装前にClaude Codeが作成するプランファイルを保存するフォルダです。

---

## ファイルの命名規則

```
issue-{Issue番号}-{内容を英語で簡潔に}.md

例：
issue-8-input-page.md
issue-9-api-declare.md
issue-10-vision-page.md
issue-11-gsap-animations.md
issue-12-admin-page.md
```

## 運用フロー

```
1. Claude Codeをプランモードで起動（Shift+Tab）
2. 「Issue #○○のプランを作成して _template.md に従って .claude/plans/ に保存して」と指示
3. 作成されたプランを自分でレビューする
4. 問題なければプランの「ステータス」を「承認済み」に変更する
5. Claude Codeに「承認したので実装して」と指示する
```

## プランファイル一覧

| ファイル | 対象Issue | ステータス |
|---|---|---|
| _template.md | - | テンプレート |
| （作成されたら追記） | | |

## 注意事項

- `_template.md` は削除しないこと
- プランは承認前に実装を開始しないこと
- 完了したIssueのプランも削除せず残しておくこと（振り返りに使える）