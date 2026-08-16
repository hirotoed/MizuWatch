# MizuWatch Supabase backend

このディレクトリは正式データ経路のSQL migration、RLS、Edge Functions、DBテストを管理します。

## 構成

- `migrations/`: schema、制約、index、RLS、service-role専用RPC
- `functions/device-telemetry-v1/`: device tokenで認証するバッチ受信API
- `functions/tracks-v1/`: Supabase Auth JWTとRLSを使うWeb取得API
- `tests/database/`: pgTAPによるmigration・権限テスト
- `tests/integration/`: hosted projectの受信、冪等再送、Auth/RLS、取得APIを通す統合テスト

受信Functionだけ `verify_jwt = false` です。これはplatform JWTではなく機体tokenをFunction内で検証するためです。取得Functionはplatform JWT検証を有効にしたまま、Function内でも `auth.getUser()` を実行します。

## ローカル確認

Supabase CLIとDockerを用意してリポジトリ直下で実行します。

```powershell
supabase start
supabase db reset
supabase test db
deno test --allow-env supabase/functions/_shared/validation_test.ts
deno check supabase/functions/device-telemetry-v1/index.ts supabase/functions/tracks-v1/index.ts
```

Functionsには次のsecretを設定します。

```text
ALLOWED_ORIGINS=https://hirotoed.github.io,http://localhost:4000
MIZUWATCH_PUBLISHABLE_KEY=sb_publishable_...
```

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はhosted Edge Functionsで標準提供されます。service role key、device token、ユーザーJWTはGitへ保存しません。

## 初期データと機体token

1. `devices` に機体を登録します。
2. 暗号学的乱数で32 byteのtokenを管理端末上で生成します。
3. tokenのSHA-256（32 byte）だけを `private.device_credentials.token_hash` に登録します。
4. 平文tokenは登録時に一度だけ機体へ移し、DB・ログ・環境例には残しません。
5. 招待済みAuthユーザーと機体の対応を `user_device_access` に登録します。

受信APIは `Authorization: Bearer <device-token>` を使います。本文に機体IDを含めると拒否され、機体は一致したcredentialから確定します。

## デプロイ

対象projectをlinkした後、migrationを適用し、2つのFunctionを個別にdeployします。

```powershell
supabase db push
supabase secrets set ALLOWED_ORIGINS=https://hirotoed.github.io MIZUWATCH_PUBLISHABLE_KEY=sb_publishable_...
supabase functions deploy device-telemetry-v1
supabase functions deploy tracks-v1
```

公開サインアップはSupabase Dashboardで無効にし、ユーザーは管理者が招待します。本番projectはTokyo (`ap-northeast-1`) で作成します。

## Hosted project統合試験

service role keyを一時的なprocess環境変数にだけ設定して実行します。テストは
一時ユーザー、機体、credential、観測値を作成し、終了時に削除します。

```powershell
$env:MIZUWATCH_TEST_SERVICE_ROLE_KEY = '<service-role-key>'
./supabase/tests/integration/hosted_backend_test.ps1 `
  -ProjectRef '<project-ref>' `
  -PublishableKey '<publishable-key>'
Remove-Item Env:MIZUWATCH_TEST_SERVICE_ROLE_KEY
```

service role key、device token、テストユーザーのpasswordはファイルへ保存しません。
