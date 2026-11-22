# TKSKbeat

触るだけで曲ができる、ブラウザ向け音楽トイです。

公開サイト: https://3keinu.github.io/TKSKbeat/

> **重要:** 上記のGitHub Pagesが本番です。`https://tkskbeat-prototype.nyep.chatgpt.site/` はテストサイトであり、本番更新先として使用しません。

このリポジトリには、GitHub Pagesで動作させるための本番ランタイムファイルのみを収録しています。

## 更新

GitHub Pagesは、このリポジトリの `main` ブランチのルートから配信します。

1. 開発リポジトリの `dist/` で変更内容を完成させる。
2. 単体テストとブラウザ確認を実行する。
3. `powershell -File scripts/verify-production-target.ps1` を実行し、本番remoteと `main` ブランチの一致を確認する。
4. 確認済みのランタイムファイルだけを、この本番リポジトリのルートへ反映する。
5. `main` へpushし、`https://3keinu.github.io/TKSKbeat/` の表示を確認する。

テストサイトへの公開は、本番反映の代わりにはなりません。
