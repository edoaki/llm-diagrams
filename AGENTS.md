# 開発方針

- Node.js 22.17以上とnpmを使用する。
- 各図のHTML・CSS・挙動は components/<id>/ にまとめる。外部CDNや元リポジトリに依存させない。
- 変更後は npm run build と npm test。dist/ と index.html は生成物として管理する。
- 図の座標や確率が説明用の場合は、その旨を表示する。
- 外部へのpush・公開・送信は、ユーザーが明示的に指示したときだけ行う。
