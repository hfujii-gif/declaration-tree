# 実装プラン：Issue #49 /vision 演出の調整（演出間の協調・マトリックス文字をエコな言葉に）

## 対象Issue

- **Issue番号**：#49
- **タイトル**：[改善] /vision 演出の調整（演出間の協調・マトリックス文字をエコな言葉に）
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/49
- **ラベル**：phase-3-frontend
- **進め方**：タスクA・Bを **1つのブランチ／PR** で実装し #49 をクローズ。

---

## Context（なぜこの変更を行うか）

#43〜#45 で /vision はサイバー化された。その上で2点を仕上げる：

- **タスクA（演出間の協調）**：マイルストーン演出が、累計カウント到達の瞬間に**即発火**し、宣言の吸収演出と
  無関係に重なる。これを「**達成を起こした宣言の吸収演出が終わってからマイルストーンを流す**」因果のある流れにする。
- **タスクB（文字をエコ語に）**：マトリックスの流れる文字が英数字（＋半角カタカナ）。これを
  **環境・自然・エコにまつわる言葉のひらがな・漢字**に変える。

---

## 現状把握（重要）

- グリフ集合が **2箇所に分散**している：
  - `components/vision/CenterTree.tsx:15` `GLYPHS = 'A-Z0-9'`（樹冠レインの `pick()`）
  - `lib/animations.ts:38` `MATRIX_GLYPHS`（半角カタカナ＋英数字。宣言の分解 `pickGlyph()` と
    マイルストーンの `burstGlyphs` で使用）
  → **1つの共有定数に統一**して両方から参照する。
- 樹冠レインは **半角前提**でレイアウト：`FONT_SIZE=11`・`LINE_HEIGHT=11`・列の横ステップ `x += FONT_SIZE`(11)。
  全角（ひらがな・漢字）は字幅≈フォントサイズなので、このままだと列が詰まって重なる → **全角向けに再調整**が必要。
- マイルストーン／吸収の協調：
  - 吸収＝`onChildAdded` → `useDeclarationStream`（直列キュー）。
  - マイルストーン＝`page.tsx` の `useEffect([count])`（`onValue` 由来）で **即** `playMilestone`/`playFullBloom`。
  - `firedIndexRef` で二重発火を防止（単調増加・複数しきい値跨ぎでも最大1つ）。
  - `?celebrate=` プレビューは別 effect で `playMilestone`/`playFullBloom` を直接呼ぶ（リハーサル用）。

---

## 実装対象ファイル

```
lib/constants.ts                        … 共有グリフ定数（エコ語）＋全角向けのフォント/レイアウト定数を追加（B）
lib/animations.ts                       … MATRIX_GLYPHS を constants から import、burstGlyphs のフォントをJP対応に（B）
components/vision/CenterTree.tsx         … 共有グリフを参照、レインのフォント/列幅/行高を全角向けに再調整（B）
components/vision/useDeclarationStream.ts… 宣言＋マイルストーンの「ジョブキュー」に拡張（A）
app/vision/page.tsx                      … count→マイルストーンを即発火ではなくキューへ積む（A）
```

---

## 実装方針

### タスクB：マトリックス文字をエコ語に

1. **共有グリフ定数（エコ語）** を `lib/constants.ts` に新設。
   - エコにまつわる語からユニークな文字集合を作る（最終選定はクライアント確認・後で調整可）。
   - 既定の語（案）：環境・地球・自然・緑・木・森・林・水・風・光・太陽・海・空・川・山・土・花・葉・芽・種・実・
     命・未来・育・守・愛・恵・循環・再生・共生・節電・節水・みどり・いのち・めぐる・つなぐ・ささえる・エコ 等。
   - 例：`export const MATRIX_GLYPHS = Array.from(new Set(ECO_WORDS.join(''))).join('')`（語の重複文字を除去した集合）。
   - レインはこの集合からランダムに1文字ずつ流す（語をそのまま綴るのではなく、マトリックス風に文字を流す方針を踏襲）。
2. `lib/animations.ts`：ローカルの `MATRIX_GLYPHS` を削除し constants から import。`pickGlyph` はそのまま。
3. `components/vision/CenterTree.tsx`：ローカル `GLYPHS` を削除し共有定数を参照。`pick()` はそのまま。
4. **全角向けレイアウト再調整**（CenterTree canvas）：
   - フォントサイズと列の横ステップ・行高を分離する（現在は `x += FONT_SIZE` で同一）。
   - 目安：`FONT_SIZE≈13` / 列ステップ `COL_STEP≈15` / `LINE_HEIGHT≈15`（重ならない範囲で密度を調整。実機で微調整）。
   - 大画面の負荷を見て `TRAIL` を調整（大きい字で埋まりが早いので必要なら減らす）。
   - **CJK対応フォント**：canvas／`burstGlyphs` のフォントに日本語等幅を含めるフォントスタックにする
     （例：`'Courier New', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', monospace`）。
     ※ ビジョン実機（会場PCのブラウザ）で日本語が表示されるフォントが必要。フォントスタックは共有定数化を検討。

### タスクA：マイルストーンを「吸収完了後」に流す（ジョブキュー化）

`useDeclarationStream` を「宣言＋マイルストーン」を直列に流す**ジョブキュー**へ拡張する。

- ジョブ型：`{type:'declaration', text}` | `{type:'milestone', stage, count}` | `{type:'bloom'}`。
- 返り値：`{ enqueueDeclaration(text), enqueueMilestone(stage, count), enqueueBloom() }`。
- `drain` がジョブ種別で再生関数を選ぶ：
  - declaration → `playDeclaration(text, layer, tree, backlogOpts)`（バックログ短縮は宣言のみ）
  - milestone → `playMilestone(stage, count, layer, tree)`
  - bloom → `playFullBloom(layer, tree)`
  - いずれも返り値タイムラインの `onComplete` で次へ。
- **間（gap）**：宣言→宣言は従来どおり `DECLARATION_GAP_MS`。次がマイルストーン/満開のときは間を置かず（または極短で）
  続けて流し、吸収完了との因果を密にする。
- `page.tsx`：
  - `useEffect([count])` の `playMilestone/playFullBloom` 直接呼び出しを **`enqueueMilestone/enqueueBloom`** に置換。
    `firedIndexRef`・targetIndex・「最大1つだけ発火」のロジックは**維持**（積むのは最大1ジョブ）。
  - `?celebrate=` プレビューは**従来どおり直接呼び出し**のまま（リハーサルで即確認できるように）。
- **メモリリーク対策**：アンマウントで進行中タイムライン kill＋キュー破棄＋gapタイマー解除（既存方式を踏襲）。
  マイルストーン由来のタイムラインも `currentTlRef` で kill 対象に含める。

---

## 実装ステップ（承認後）

1. develop から `feature/issue-49-vision-effect-tuning` を作成。本プランを規約の保存先へ複製。
2. （B）`lib/constants.ts` にエコ語の共有グリフ定数（＋フォントスタック等）を追加。
3. （B）`lib/animations.ts`・`CenterTree.tsx` を共有定数参照に差し替え。
4. （B）`CenterTree.tsx` のレインを全角向けに再調整（フォント・列幅・行高・フォントスタック）。`burstGlyphs` もJPフォント対応。
5. （A）`useDeclarationStream` をジョブキュー化し、`enqueueMilestone/enqueueBloom` を追加。
6. （A）`page.tsx` の count→マイルストーンをキュー投入に変更（preview は直接のまま）。
7. `npx tsc --noEmit` / `npm run lint` / `npm run build` を通す。
8. `npm run dev` で検証（下記）。
9. コミット → develop へPR（Closes #49）。マージは人間。

---

## 考慮が必要な点

- **協調の順序**：到達を起こした宣言は、マイルストーン検出の直前に enqueue 済み（onChildAdded→onValue の順）。
  よってマイルストーンをその直後に積めば「その宣言の吸収完了後」に流れる。バックログがある場合は
  「キュー内の先行宣言＋当該宣言」の後に流れる（許容）。
- **二重発火**：`firedIndexRef` を維持し、積むのは最大1ジョブ。減少後の再通過・一括投入でも最大1つ。
- **プレビュー非干渉**：`?stage=`/`?celebrate=` は据え置き（celebrate は直接再生）。
- **全角フォント**：会場実機で日本語が描画されること（フォントスタックにJP等幅を含める）。レイン密度は実機で微調整。
- **型**：`any` 禁止。ジョブはユニオン型で明示。`enqueueMilestone(stage:number,count:number)` 等を型付け。
- **マジックナンバー**：エコ語・フォント・レイアウト寸法は constants/該当モジュールのローカル定数に集約。
- **メモリリーク**：演出は一過性。生成DOM/Tween/タイマーを破棄（既存パターン＋`clearCelebrations`）。

---

## 完了条件（Issueより転記）

- [ ] （A）マイルストーン達成演出が、達成を起こした宣言の吸収演出の完了後に再生される
- [ ] （A）二重発火しない・複数しきい値跨ぎで最大1つだけ発火する挙動を維持
- [ ] （A）メモリリーク対策（保留・タイマー・タイムライン破棄）を担保
- [ ] （B）マトリックスの文字が英数字でなくエコ語のひらがな・漢字になっている
- [ ] （B）全角化してもレイン・グリフ紙吹雪のレイアウトが崩れない
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通る

---

## 検証方法

- `npm run dev` → `http://localhost:3000/vision`：
  - （B）樹冠レイン・吸収の分解・`?celebrate=` のグリフ紙吹雪の文字が**エコ語のひらがな・漢字**になっていること。
    全角で列・行が重ならず、グリフ紙吹雪も読めること（会場想定の大画面で密度・可読性を確認）。
  - （A）`/input` から宣言を送り、累計がしきい値（テスト用に MILESTONES を一時的に小さくするか、
    一括投入で）到達した際、**当該宣言の吸収演出が終わってからマイルストーンが流れる**こと。重ならないこと。
  - （A）`?celebrate=2500|10000` プレビューが従来どおり**即**再生されること（preview は非キュー）。
- ビルド一式（tsc/lint/build）パス。長時間放置で演出DOMが残らないこと。

---

## 承認コメント欄

**承認者**：  
**承認日**：  
**コメント**：
