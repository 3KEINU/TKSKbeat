# Production deployment rule

- このリポジトリはTKSKbeatの本番です。
- 本番URLは `https://3keinu.github.io/TKSKbeat/`。
- 本番リポジトリは `https://github.com/3KEINU/TKSKbeat.git`、公開ブランチは `main`。
- `https://tkskbeat-prototype.nyep.chatgpt.site/` はテストサイト。本番反映先として絶対に使用しない。
- 本番反映前に `scripts/verify-production-target.ps1` を実行する。
- GitHubの `main` へのpushと本番URLの確認が終わるまで、本番反映完了と報告しない。
