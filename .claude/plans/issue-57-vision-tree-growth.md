# 実装プラン：木の成長仕様を「密度・色・幹サイズの段階変化」に作り直し

---

## 対象Issue

- **Issue番号**：#57
- **タイトル**：[改善] 木の成長仕様を「密度・色・幹サイズの段階変化」に作り直し
- **URL**：https://github.com/hfujii-gif/declaration-tree/issues/57

---

## ステータス

- [x] プラン作成中
- [x] レビュー待ち
- [ ] 承認済み → 実装開始可能
- [ ] 実装完了
- [ ] PR作成済み

---

## 概要と方針

現状の成長は MILESTONES（2,500/5,000/7,500/10,000）で樹冠を段階的に **scale 拡大**する方式
（`CenterTree.module.scss` の `data-stage` ルール）。これを廃止し、累計件数による **3段階（小/中/大）** で
「**幹サイズ・葉の密度（モリモリ具合）・葉の色**」を変化させる方式に作り直す。段階が変わる瞬間は
**発光で木を一旦隠してから差し替える**。既存のマイルストーン達成演出（テキスト＋パルス＋満開）は残す。

### 成長段階（累計 isVisible=true 件数で判定）
- **小**：0〜500（`level 0`）
- **中**：501〜1,000（`level 1`）
- **大**：1,001〜9,999（`level 2`）
- **10,000以降**：`level 2`（大）のまま

### 段階ごとの見た目（提案値・実装時に ?growth= プレビューで微調整）
| | 幹＋木全体スケール | 樹冠のモリモリ（ぼこぼこ具合） | 葉の色（hue） |
|---|---|---|---|
| 小 | ×0.62 | 中核のみ（丸くシンプル・突起なし） | 緑のみ（start 110, span 25） |
| 中 | ×0.82 | 中核＋一部の膨らみ・突起 | 一部レインボー（start 80, span 160） |
| 大 | ×1.0（現状） | 全部（現状の不規則なぼこぼこモリモリ） | 全色相（start 0, span 300＝現状） |

- **葉の文字の密度（詰まり具合＝`layers`/`CORE_FILL`）は全段階で「大＝現状」のまま変えない。** #60 の管理値
  `layers` もそのまま活かす（成長で間引かない）。
- 「モリモリ具合」＝樹冠のシルエットを作る**膨らみ・突起（`CLUMPS` の円）の量**を段階化する。小は中核の円だけで
  丸くシンプルな樹冠、中で膨らみ・突起を足し、大で全 `CLUMPS`（現状の不規則なぼこぼこ）になる。
  各 `CLUMPS` 要素に「この段階から出現」を表す `minLevel`（0=常時 / 1=中〜 / 2=大のみ）を付け、段階で絞り込む。
- 「木全体スケール」は #56 の `--screen-scale` と base 係数 1.9 に **さらに掛ける**成長係数 `--growth-scale`。
  → `scale(calc(1.9 * var(--screen-scale,1) * var(--growth-scale,1)))`。小ほど木（幹＋樹冠）全体が小さい。
- 「葉の色」は `hueAt()` を `hueStart + span*(正規化x)` に一般化し、段階で `hueStart/span` を切替。

### 段階切替の演出（発光で隠して差し替え）
段階が変わったら、木の上に **白い発光オーバーレイをふわっと拡大（木を覆って隠す）→ ピークで見た目
（成長スケール＋樹冠の密度・色）を差し替え → 発光をフェードアウトして新しい木を出す**（GSAP、約0.9秒）。
初回マウント時は演出せず即適用する。

---

## 実装対象ファイル

### 新規作成するファイル
```
なし（定数は lib/constants.ts に追加、演出は CenterTree 内に閉じる）
```

### 編集するファイル
```
lib/constants.ts                       … 成長段階のしきい値・段階別パラメータ・レベル算出ヘルパー
app/vision/page.tsx                    … count から growthLevel を算出（?growth= プレビュー対応）し CenterTree に渡す
components/vision/CenterTree.tsx        … growthLevel prop 追加。密度(layers/fill)・色(hue)を段階化、
                                         data-growth 出力、切替時の発光トランジション。stage prop は撤去
components/vision/CenterTree.module.scss … data-stage の scale 成長を撤去し data-growth の --growth-scale に置換。
                                         発光オーバーレイ用スタイルを追加
CLAUDE.md                              … 成長仕様（MILESTONES 拡大 → 500/1000 の段階変化）を更新
```

---

## 依存関係の確認

| 依存 | 状態 |
|---|---|
| #56（--screen-scale・base係数1.9） | ✅ develop にマージ済み。成長係数はこれに掛ける |
| #60（layers prop・管理画面の葉密度） | ✅ develop にマージ済み。大の密度基準として合成 |
| 既存のマイルストーン演出（animations.ts / bloomed） | ✅ 変更しない（併存） |

---

## 実装ステップ

1. `lib/constants.ts` に追加する。
   - `GROWTH_THRESHOLDS = [500, 1000]`（小/中の上限。超えると次段階）
   - `computeGrowthLevel(count: number): 0 | 1 | 2`
   - 段階別パラメータ（配列 index=level）：`GROWTH_TREE_SCALE=[0.62,0.82,1]`、
     `GROWTH_HUE=[{start:110,span:25},{start:80,span:160},{start:0,span:300}]`
   - ※ 葉の文字密度（layers/CORE_FILL）は段階化しない（大＝現状で一定）。
2. `components/vision/CenterTree.tsx` を改修する。
   - props：`stage` を撤去し `growthLevel: 0|1|2` を追加（`bloomed`・`layers` は維持）。
   - `hueAt()` を `GROWTH_HUE[growthLevel]` の `start/span` を使う形に一般化。
   - **樹冠のモリモリを段階化**：`CLUMPS` の各要素に `minLevel`（0/1/2）を付与し、効果内で
     `activeClumps = CLUMPS.filter(c => growthLevel >= (c.minLevel ?? 0))` を作る。`crownDepth()` と
     葉セル生成の走査範囲・シルエット判定を `activeClumps` ベースにする。
     - 分類の目安：中核の大きな円＝`minLevel 0`（小でも出る丸い基本形）、膨らみ・横張り出し＝`minLevel 1`、
       頭の細かい突起・外周の小円（ぼこぼこの素）＝`minLevel 2`。
   - 葉の文字密度（`layers`/`CORE_FILL`）は**据え置き**（段階で変えない）。
   - 描画 useEffect の依存に `growthLevel` を追加（値変更で葉セルを作り直す。既存 cleanup で後始末）。
   - `data-growth={growthLevel}` を出力（`data-stage` は撤去）。
   - **切替トランジション**：`growthLevel` を監視する useEffect（初回スキップ）で、木上の発光オーバーレイを
     GSAP で拡大→フェードさせ、切替を隠す。GSAP インスタンスはクリーンアップで kill。
3. `components/vision/CenterTree.module.scss` を改修する。
   - `.treeWrap[data-stage='n'] .canopy { scale }` の成長ルールを撤去。
   - `.treeWrap` の transform に `* var(--growth-scale,1)` を追加し、`data-growth` 別に `--growth-scale` を定義。
   - 成長スケール変更を「発光で隠して瞬時に差し替え」るため、`.treeWrap` の `transition: transform` は外す
     （resize・成長ともに瞬時。見た目は発光オーバーレイでマスク）。
   - 発光オーバーレイ要素のスタイル（中央発光・pointer-events:none・初期 opacity:0）を追加。
   - `data-bloomed`（満開グロー）は維持。
4. `app/vision/page.tsx` を改修する。
   - `computeGrowthLevel(count)` で段階算出。`?growth=0|1|2` プレビュー（`?stage=` と同じ useSyncExternalStore 方式）で上書き可能に。
   - `<CenterTree growthLevel={growthLevel} bloomed={bloomed} layers={canopyLayers} />`。
   - 既存の `stage`（マイルストーン・bloomed 判定用）は page 内に残す（CenterTree へは渡さない）。
5. `CLAUDE.md` の /vision 成長仕様を新方式（500/1,000 の小/中/大・拡大しない・密度/色/幹サイズ変化）に更新する。
6. `npm run build` / `npx tsc --noEmit` / `npm run lint` を通す。

---

## 考慮が必要な点

### 既存演出との併存（重要）
- マイルストーン達成演出（2,500/5,000/7,500/10,000 のテキスト＋パルス）と満開（10,000）は**変更しない**。
  成長段階（500/1,000）はそれより手前で完結するため、演出タイミングは重ならない。
- `bloomed`（満開グロー）は `stage`（MILESTONES 由来）から page.tsx で算出し続ける。CenterTree へは `bloomed`
  として渡す。`data-stage` を CenterTree から撤去しても満開は `data-bloomed` で維持される。

### メモリリーク対策（8時間以上稼働）
- 葉セル再生成は `growthLevel`/`layers` 変更時のみ（頻度低）。既存 cleanup（rAF停止・リスナー解除）で後始末。
- 切替トランジションの GSAP タイムラインは、次の切替・アンマウント時に `kill()` する（多重再生防止）。

### 型
- `any` 禁止。`growthLevel` は `0 | 1 | 2` のリテラルユニオン。段階別パラメータ配列は `as const`＋型明示。

### その他
- 段階の数値（スケール/密度係数/hue）は `lib/constants.ts` に集約（マジックナンバー回避）。実装後に
  `?growth=0|1|2` で見比べて微調整する。
- 幹画像は `tree_ver04.png` の1枚を成長スケールで縮小表示（別画像は用意しない）。

---

## レビューで確認してほしい決定事項

1. **旧成長（MILESTONES での樹冠 scale 拡大）を撤去**してよいか。「サイズを拡大していくのではなくて」という
   指定に沿って `data-stage` の scale 成長ルールを削除し、成長は 500/1,000 の小/中/大へ一本化する想定。
2. **段階の提案値**（スケール 0.62/0.82/1.0、CLUMPS の minLevel 分類、hue レンジ）はプレビューで調整前提の
   初期値。方向性でOKか。葉の文字密度は据え置き（大＝現状で一定）。
3. **切替トランジション**は「白い発光で覆って差し替え」。この方向でよいか（所要 約0.9秒）。

---

## 完了条件（Issue より転記）

- [ ] 0〜500=小 / 501〜1,000=中 / 1,001〜=大 で木の見た目（幹サイズ・葉密度・葉色）が切り替わる
- [ ] 小=緑系、中=一部レインボー、大=全色相レインボー になる
- [ ] 段階切替時に発光で隠れてから変わる
- [ ] 10,000以降も「大」を維持
- [ ] 既存マイルストーン達成演出・満開演出が従来どおり発火する
- [ ] 長時間稼働のメモリリーク対策（rAF/リスナー/GSAP解除）が維持されている
- [ ] `any` を使っていない
- [ ] `npm run build` / `npx tsc --noEmit` / `npm run lint` が通る
- [ ] CLAUDE.md を更新済み

---

## 承認コメント欄

**承認者**：
**承認日**：
**コメント**：

---

## 追加スコープ（テスト中に確定・#57のPRに含める）

実装・テスト中のユーザー判断で、以下の演出まわりの挙動変更も本PRに含めることになった（別系統だが同PRで対応）。

1. **成長段階切替の演出強化**：`playGrowth`（lib/animations.ts）を「画面全体を白い光で覆い切り、その裏で木を差し替え、光が引くときには次段階になっている」形に変更。透明部分を残さず切替の瞬間を完全に隠す。
2. **達成演出は10,000（満開）のみ**：中間マイルストーン演出（2,500 / 5,000 / 7,500）を廃止。恒久版は `MILESTONES = [10000]`。
3. **満開の発光を一時的に**：到達後に木が発光し続ける定着（旧 `data-bloomed`）を廃止。フィナーレ演出中のみ発光し、演出後は通常の「大」の木に戻る。連動して不要になった `?stage=` プレビュー関連コードを撤去（成長プレビューは `?growth=` に一本化）。

CLAUDE.md の /vision 演出仕様（マイルストーン・満開）も上記に合わせて更新済み。

### コミット前に戻すTEMP値（動作確認用）
- `GROWTH_THRESHOLDS`：テスト中は現在件数近傍に設定 → **本番 `[500, 1000]` に戻す**。
- `MILESTONES`：テスト中は現在件数の直上（単一値）に設定 → **本番 `[10000]` に戻す**。
