# GPTのアニメーション

文章、ベクトル、各層の表現、次トークンの予測を操作して確認する教材です。各図はCSS・JavaScript・データを内蔵したHTMLで、**HTMLを1つ渡すだけで、オフラインで動きます**。

## 公開・配布

[GitHub Pagesの一覧](https://edoaki.github.io/llm-diagrams/) ／ [GitHubリポジトリ](https://github.com/edoaki/llm-diagrams)

| 図 | 単独配布ファイル |
| --- | --- |
| 文章 → 埋め込み → 各層 → 次トークンの確率 | [dist/gpt-representations.html](dist/gpt-representations.html) |
| notの有無を比較する空間図 | [dist/gpt-representations-not.html](dist/gpt-representations-not.html) |
| 続きを一つずつ生成 | [dist/autoregressive.html](dist/autoregressive.html) |
| 過去の表現を保ちながら次のトークンを計算 | [dist/decoder-kv-cache.html](dist/decoder-kv-cache.html) |
| トークン化と位置情報 | [dist/token-embeddings.html](dist/token-embeddings.html) |
| 生成の一巡 | [dist/generation-loop.html](dist/generation-loop.html) |
| N-gram → 並べ替え → 傾向 → Transformer | [dist/ngram-to-llm.html](dist/ngram-to-llm.html) |

`index.html` は一覧です。各HTMLを単独で配布できます。`examples/slides.html` はiframeで埋め込む例です。公開はmainブランチのルートをGitHub Pagesのソースとし、`.nojekyll`で生成済みファイルをそのまま配信します。

## 数値を編集する

全図のデータの原本は **[components/gpt-representations-not/template.html](components/gpt-representations-not/template.html) の先頭の `id="diagram-data"`** です。文章・token・埋め込み・位置情報・各層の値・描画用座標・候補確率・N-gramの表をここにまとめています。描画処理に数値を重複して書く必要はありません。

- 共通入力は `The capital of France is` と `The capital of France is not`。生成の図もこの続きを使います。
- 現在のベクトル・確率・座標は説明用です。sin/cos位置ベクトルは0始まりの位置から計算した先頭2成分を保持しています。モデル全体の実測結果ではありません。
- 生の精度を保持し、画面だけ小数3桁で切り捨てます。末尾のゼロは省略し、負数は0方向へ切り捨てます。％は変換後に切り捨てます。
- 総層数から第1・第2・最終層を表示します。現在の32層は仮の設定です。中間層は「…」で省略します。
- 加算型の位置情報では埋め込みへ加算する動きを表示します。RoPEなどでは加算の動きを表示しません。
- N-gramの頻度表、並べ替えの説明用スコア、Transformerの出力を区別しています。LLM確率をN-gramの実測頻度として扱いません。
- 配布HTMLも同じデータ欄だけで編集できます。ただしリポジトリ側は原本を編集して再ビルドします。

## 実測値を依頼する

1. [先輩のローカルモデル環境へ貼る指示](docs/prompt-extract.md)と配布HTMLを渡す。
2. 返ってきたJSON・取得レポートを添えて、[このリポジトリ側へ貼る指示](docs/prompt-import.md)を使う。
3. 詳細は[データ仕様と差し替え手順](docs/real-values.md)を参照する。

```sh
node scripts/import-measurements.mjs /path/to/measurements.json
npm run build
npm test
```

## 開発・検証

Node.js 22.17以上とnpmを使用します。

```sh
npm ci
npm run browser:install
npm run build
npm test
```

`components/<id>/` に各図のHTML・CSS・挙動、`shared/` に共通CSSとデータ読み込み・表示処理があります。ビルドが原本のデータを検証し、全HTMLへ埋め込みます。`dist/` と `index.html` は生成物として管理します。

テストは単独HTMLのオフライン動作、960/390/320px、各場面、not比較、加算のタイミング、キャンセル、生成の再生・停止、データのみの置換（トークン数・層数・RoPE・精度・説明文・候補強調）を確認します。スクリーンショットはGit管理外の`test-results/`に保存します。JavaScript無効時は概念説明を表示します。

## 元ページとの関係

2026-09-26に `ml-landscape` のGPTページからHTML・JavaScript・CSSを切り出し、その後、共通データ化・位置ベクトルの動き・not比較・N-gram・デコーダーの図を加えました。ビルド時・閲覧時とも元リポジトリへ依存しません。`planned/`は当初の構想メモです。利用許諾は分離元の権利者の方針に従い、新しいライセンスは付与していません。
