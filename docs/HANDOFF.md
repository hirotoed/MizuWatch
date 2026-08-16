# MizuWatch 引き継ぎ書

最終更新: 2026-08-15

## 最初に読むもの

1. `docs/PROJECT_DIRECTION.md`
2. `docs/API_DATABASE_AUTH.md`
3. この文書
4. 直近のGitHub Actions結果

開発対象は `hirotoed/MizuWatch` です。`Triton-Project/Visualize_Data_webAPP`
は参照専用であり、変更しません。

## 現在の到達点

- 本番バックエンドはTokyoリージョンのSupabase project
  `wkpcfgqraemcmdcrejle` に構築済み。
- 初期DB migration、`device-telemetry-v1`、`tracks-v1` はdeploy済み。
- hosted統合試験で機体token認証、冪等再送、Supabase Auth、RLS、取得APIを確認済み。
- ReactアプリはGAS非依存で、`VehicleDataSource` によりmock/Supabaseを切り替え可能。
- GitHub Actions Repository Variablesは正式Supabase接続向けに設定済み。
- `.github/workflows/web.yml` は `main` push時に正式設定でbuildし、GitHub Pagesへdeployする。
- `.github/workflows/backend.yml` はDB、RLS、Edge FunctionsをCI検証する。

## 2026-08-15 公開作業

公開前のローカル確認はすべて成功しています。

```text
npm run typecheck  成功
npm run lint       成功
npm test           成功（1 file / 3 tests）
npm run build      成功
```

buildには約1.1 MiBのbundle容量警告がありますが、失敗ではありません。
コード分割による改善は公開の必須条件ではないため、別タスクとします。

公開後は、次の項目をこの節に追記してから作業を終了します。

- 正式反映commit SHA
- mainへの反映方法
- GitHub Actions run URLと結果
- GitHub Pages URLと画面確認結果

## GitHub Pagesの正式設定

Repository Variables:

```text
VITE_VEHICLE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=<Tokyo project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Repository Secret:

```text
VITE_GMAPS_API_KEY=<Google Maps JavaScript API key>
```

値そのものは文書やcommitへ保存しません。Pagesは`main`へのpushを契機に
`.github/workflows/web.yml`からdeployされます。

## 次に行う作業

### 人が行うこと

1. 実運用するWeb利用者のメールアドレスを確定し、Supabase Authへ招待する。
2. 実機の機体IDと管理者を確定する。
3. Pages上で招待ユーザーを使い、ログイン、地図、グラフ、CSV/JSON exportを確認する。
4. Google MapsのAPIキー制限にPagesの正式originが含まれることを確認する。

### AIと一緒に行うこと

1. 機体、`viewer` / `admin` 権限、機体credentialを安全な手順で初期登録する。
2. Pico Wファームウェアの送信先を正式受信APIへ変更する。
3. UUID v7、SDカード保存、通信復旧後の再送を実機で検証する。
4. LTE-Mモジュール候補、通信事業者、通信間隔、再送回数、timeoutを比較して決定する。
5. 正式経路への実機切り替え後、GAS資産を`legacy`として隔離する。

## 再開時の確認コマンド

```powershell
git status --short --branch
gh auth status
gh run list --repo hirotoed/MizuWatch --limit 10
cd web/vehicle-tracker
npm run typecheck
npm run lint
npm test
npm run build
```

## 注意事項

- GAS開発は2026-08-15に終了済み。明示的な方針変更なしに再開しない。
- Supabaseのservice-role key、機体token、ユーザーパスワードをcommitしない。
- 機体tokenは機体ごとに256 bitで発行し、DBにはhashだけを保存する。
- `(device_id, message_id)`の一意制約とUUID v7を壊さない。
- Git操作前にremoteが`hirotoed/MizuWatch`であることを確認する。
- Triton側ではbuild、format、commit、push、deployを含む変更操作を行わない。
