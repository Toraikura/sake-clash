# GitHub公開・引き継ぎ

- リポジトリ：https://github.com/Toraikura/sake-clash
- ゲーム：https://toraikura.github.io/sake-clash/
- 自動検証：https://github.com/Toraikura/sake-clash/actions
- 初回プレイ可能ソースの保存タグ：v1.0.0
- 今後の相談事項：NEXT_STEPS.md

mainの変更はlint/typecheck/単体テスト/ビルド/18件のブラウザ操作テスト成功後、Pagesへ自動公開。PRでは同じ検証だけを行います。実機iPhone Safariの操作確認は別途必要です。

公開するのはこのゲームのソース、設定、テスト、説明とスクショのみ。node_modules、ローカルテストログ、他案件のファイル一覧、認証情報は含めていません。個人環境用の既存ファイル比較は公開npmスクリプトから除外しました。

前回VALIDATION.mdとverification.jsonはローカル完成時点の履歴です。公開時の最新実行結果は上記Actionsを参照してください。

既存サイトのソースとSHUBO RUNは変更していません。公開準備中、親サイトで誤ってビルド検証を実行したため、ローカルの生成物（dist、ビルドメタデータ）は再生成されました。元のサブパス設定でビルドを正常完了させており、既存サイトの再公開はしていません。前回の全1,048ファイルの完全一致を今回の状態に流用しません。
