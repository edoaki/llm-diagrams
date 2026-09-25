# KVキャッシュを含めたデコーダーの動作

未実装。次の図を独立したコンポーネントとして追加するための作業メモ。

プロンプトの処理（prefill）と1トークンずつの生成（decode）、層ごとのK・Vの保存と再利用、新しいトークンのQ・K・V、出力と次の入力への循環を示す予定。

実装時は components/<id>/ に template.html・style.css・behavior.js を作り、components.json に登録する。
