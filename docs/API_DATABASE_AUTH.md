# MizuWatch 正式API・DB・認証要件

決定日: 2026-08-15

## 1. この文書の位置づけ

この文書は、観測機からWeb観測アプリまでの正式なデータ経路について、
実装の基準となるAPI、データベース、認証要件を定める。

基準にするWeb側の境界は
`web/vehicle-tracker/src/data/types.ts` の `VehicleDataSource` である。
同契約が返す `VehicleTracks` と、その要素である `TelemetryDataPoint` を
取得APIのクライアント向けデータ契約とする。

今回の範囲は正式バックエンドの方式と要件の決定までとし、API・DB・認証の
実装、Reactアプリの接続切り替え、LTE-M実機送信は次の作業とする。

## 2. 採用構成

| 項目 | 採用する方式 |
| --- | --- |
| API実装・ホスティング | Supabase Edge Functions（TypeScript） |
| データベース | Supabase PostgreSQL |
| Web利用者認証 | Supabase Authのメールアドレス + パスワード |
| デバイス認証 | 機体ごとの256 bitランダムBearer tokenをEdge Functionで検証 |
| リージョン | Northeast Asia (Tokyo)、`ap-northeast-1` |
| Webホスティング | 当面は既存のGitHub Pagesを継続 |

Supabaseを選ぶ理由は、PostgreSQL、ユーザー認証、TypeScriptのAPI実行環境を
一つの管理対象にまとめられ、少数機体から始めるMizuWatchで運用対象を最小化
できるためである。時系列データの期間検索、一意制約による重複防止、将来の
集計や分析にはリレーショナルDBが適する。

Cloudflare Workers + D1は別の認証基盤が必要になり、Firebaseは現在の
期間検索・重複制約・将来のSQL分析に合わせるためのデータ構造が複雑になるため、
初期の本番構成には採用しない。

参考にした公式文書:

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Edge Functionsの認証](https://supabase.com/docs/guides/functions/auth)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [利用可能リージョン](https://supabase.com/docs/guides/platform/regions)
- [データベースバックアップ](https://supabase.com/docs/guides/platform/backups)

## 3. システム境界

```text
観測機
  └─ HTTPS + device token
       └─ POST /v1/device/telemetry/batches
            └─ Edge Function（認証・検証・重複判定）
                 └─ PostgreSQL

Web観測アプリ
  └─ Supabase Authでログイン
       └─ HTTPS + user JWT
            └─ GET /v1/tracks
                 └─ RLSで許可された機体のデータだけを取得
                      └─ VehicleDataSourceがVehicleTracksとして返す
```

- ブラウザと観測機からPostgreSQLへ直接接続しない。
- Supabaseのsecret key、service role key、DBパスワードをブラウザまたは
  観測機へ配置しない。
- Supabaseのpublishable keyはプロジェクト識別用であり、デバイス認証には
  使用しない。
- GASはこの経路に含めない。

## 4. API共通要件

- この文書ではクライアントから見た論理パスを `/v1` でバージョン管理する。
  初期のSupabase配置では次のURLへ対応させ、URL全体を環境変数で注入する。

| 論理パス | Supabase上の配置 | platform JWT検証 |
| --- | --- | --- |
| `POST /v1/device/telemetry/batches` | `$SUPABASE_URL/functions/v1/device-telemetry-v1` | 無効。Function内でdevice tokenを検証 |
| `GET /v1/tracks` | `$SUPABASE_URL/functions/v1/tracks-v1` | 有効。Supabase Auth JWTを検証 |

- 2種類の認証方式を混在させないため、受信と取得は別Edge Functionにする。
- 通信はTLS 1.2以上のHTTPSだけを許可し、観測機でも証明書を検証する。
- JSONの文字コードはUTF-8、日時はRFC 3339とし、DBではUTCの
  `timestamptz` に正規化する。
- 成功レスポンスには `requestId` を含め、ログとの照合を可能にする。
- エラーは次の共通形式にする。内部例外、SQL、秘密情報は返さない。

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "requestId": "01K..."
}
```

- `401` は認証失敗、`403` は権限不足、`409` は状態競合、`422` は
  読み取り可能だが不正な観測値、`429` はレート超過、`500` は予期しない
  サーバーエラーに使用する。
- 本番CORSはGitHub Pagesの正式originだけを許可する。ローカル開発originは
  開発環境だけに追加し、`*` とcredentialの組み合わせを使用しない。

## 5. 観測データ受信API

### `POST /v1/device/telemetry/batches`

認証済みの1機体から、通常送信またはSDカードからの再送を一括受信する。
機体IDは認証情報から確定し、リクエスト本文で別機体を指定させない。

```json
{
  "schemaVersion": 1,
  "batchId": "0198d24c-ef42-7b9b-a9ce-9ca004ae95f1",
  "readings": [
    {
      "messageId": "0198d24c-ef42-7b9b-a9ce-9ca004ae9602",
      "observedAt": "2026-08-15T01:00:00Z",
      "latitude": 33.000000,
      "longitude": 130.000000,
      "altitude": 1.8,
      "satellites": 10,
      "waterTemperature": 24.8,
      "airPressure": 1012.4,
      "airTemperature": 28.4,
      "humidity": 70.2,
      "batteryVoltage": 3.9
    }
  ]
}
```

要件:

- 1バッチは1機体、最大200件、非圧縮本文256 KiB以下とする。
- `messageId` は観測時にUUID v7として一度だけ生成し、SDカード保存と再送でも
  同じ値を使う。
- `(device_id, message_id)` のDB一意制約を最終的な重複防止とする。同じ
  `messageId` の再送はエラーにせず `duplicate` として成功応答する。
- `batchId` は送信試行単位の追跡用であり、観測値の一意性には使わない。
- 外側のJSONが不正な場合はバッチ全体を `400` で拒否する。個別の観測値が
  不正な場合は有効な行を保存し、行ごとの `accepted`、`duplicate`、
  `rejected` と理由を `200` で返す。
- DBへの保存と件数結果の確定は一つのトランザクションで行う。
- 1機体あたり60リクエスト/分を初期上限とし、超過時は `Retry-After` 付き
  `429` を返す。

成功例:

```json
{
  "requestId": "01K...",
  "batchId": "0198d24c-ef42-7b9b-a9ce-9ca004ae95f1",
  "accepted": 1,
  "duplicate": 0,
  "rejected": 0,
  "errors": []
}
```

### 入力検証

| 項目 | 必須 | 条件 |
| --- | --- | --- |
| `messageId` | 必須 | UUID v7 |
| `observedAt` | 必須 | RFC 3339、機体登録日時以降、サーバー時刻の5分後を超えない |
| `latitude` | 必須 | -90〜90 |
| `longitude` | 必須 | -180〜180 |
| `altitude` | 任意 | -500〜10,000 m |
| `satellites` | 任意 | 0〜100の整数 |
| `waterTemperature` | 必須 | -10〜80 ℃ |
| `airPressure` | 必須 | 300〜1,200 hPa |
| `airTemperature` | 必須 | -60〜80 ℃ |
| `humidity` | 任意 | 0〜100 % |
| `batteryVoltage` | 任意 | 0〜20 V |

`null`、`NaN`、`Infinity`、範囲外の値は保存しない。任意項目は値が得られない
場合に省略できる。単位はAPI名の追加で表さず上表に固定し、単位変更は新しい
APIバージョンで行う。

## 6. Web取得APIとデータソース契約

### `GET /v1/tracks`

ログインユーザーが閲覧できる全機体について、指定期間の軌跡を取得する。

クエリ:

- `from`: 任意。省略時は現在から24時間前。
- `to`: 任意。省略時は現在。
- `vehicleId`: 任意。複数指定可能。省略時は閲覧可能な全機体。
- 1回の期間は最大7日、返却件数は全機体合計10,000件までとする。
- 上限を超える場合は黙って切り捨てず `422 RANGE_TOO_LARGE` を返し、
  期間または機体を絞るよう要求する。

レスポンスの `data` は `VehicleTracks` と同形で、各配列を `timestamp` の
昇順にする。データがない許可済み機体は空配列、閲覧権限がない機体IDを明示
した場合は存在を漏らさず `404` とする。

```json
{
  "data": {
    "MIZU_001": [
      {
        "timestamp": "2026-08-15T01:00:00.000Z",
        "vehicleId": "MIZU_001",
        "latitude": 33.0,
        "longitude": 130.0,
        "altitude": 1.8,
        "satellites": 10,
        "waterTemperature": 24.8,
        "airPressure": 1012.4,
        "airTemperature": 28.4,
        "humidity": 70.2
      }
    ]
  },
  "requestId": "01K..."
}
```

正式な `VehicleDataSource.getAllVehicles()` 実装はこのAPIを呼び、`data` を
返す。`batteryVoltage`、`messageId`、`receivedAt` などWeb型にない保存項目は
レスポンスへ混在させない。必要になった時点でWeb型とAPI契約を同時に拡張する。

長期間の履歴や完全エクスポートは、次段階でカーソルページング付きの
`GET /v1/vehicles/{vehicleId}/telemetry` を追加する。初回の正式接続では、
現在の画面が必要とする24時間分を確実に返すことを優先する。

## 7. PostgreSQLスキーマ要件

### `devices`

- `id uuid primary key`
- `vehicle_code text not null unique` — Web上の `vehicleId`（例: `MIZU_001`）
- `display_name text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

### `telemetry_readings`

- `id bigint generated always as identity primary key`
- `device_id uuid not null references devices(id)`
- `message_id uuid not null`
- `observed_at timestamptz not null`
- `received_at timestamptz not null default now()`
- `latitude double precision not null`
- `longitude double precision not null`
- `altitude real null`
- `satellites smallint null`
- `water_temperature real not null`
- `air_pressure real not null`
- `air_temperature real not null`
- `humidity real null`
- `battery_voltage real null`
- `schema_version smallint not null`
- `unique (device_id, message_id)`
- 取得用B-tree index `(device_id, observed_at desc, id desc)`

APIと同じ範囲制約をDBの `check` 制約にも設定する。`observed_at` は観測時刻、
`received_at` は再送遅延や通信品質を分析するための受信時刻として両方保持する。

### `user_device_access`

- `user_id uuid not null references auth.users(id)`
- `device_id uuid not null references devices(id)`
- `role text not null check (role in ('viewer', 'admin'))`
- `primary key (user_id, device_id)`

### `device_credentials`（非公開schema）

- `id uuid primary key`
- `device_id uuid not null references devices(id)`
- `token_hash bytea not null unique`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz null`
- `revoked_at timestamptz null`
- `last_used_at timestamptz null`

平文tokenは発行時に一度だけ表示し、DB、ログ、GitHub、環境ファイルには保存しない。

## 8. 認証・認可要件

### Web利用者

- サインアップは公開せず、管理者からの招待だけを許可する。
- メールアドレス確認済みのメール + パスワード認証を使用する。
- パスワード再設定はSupabase Authの標準フローを使用する。
- ブラウザはSupabase AuthのJWTを `Authorization: Bearer` で送信する。
- ブラウザはJWTに加えて、公開可能なproject publishable keyを `apikey` headerで
  送信する。publishable keyだけではログイン済みとして扱わない。
- APIはJWTを検証し、`user_device_access` とRLSの両方で機体単位の閲覧権限を
  適用する。
- `viewer` は閲覧だけ、`admin` は機体名・ユーザー割当・credentialローテーション
  を管理できる。テレメトリーの上書き・削除は通常操作として提供しない。

### 観測機

- 初期登録時に暗号学的乱数から32 byteのtokenを機体ごとに発行する。
- Edge Functionは受け取ったtokenのSHA-256 hashを定時間比較し、有効かつ
  未失効で、その機体がactiveの場合だけ受信する。
- tokenは機体のsecret領域に保存し、ソースコード、SDカードの観測CSV、ログに
  出力しない。
- 漏えいまたは機体紛失時は即時失効できるようにする。定期ローテーションでは
  新旧tokenの重複期間を最大24時間だけ許容する。
- 共通token、WebユーザーJWT、Supabase secret/service role keyを観測機へ
  配布しない。

## 9. RLS・運用・監視要件

- APIから参照する全公開schemaテーブルでRLSを有効にする。
- 未認証の `anon` roleにはテレメトリー、機体、割当の権限を付与しない。
- 認証ユーザーは `user_device_access` に存在する機体だけをSELECTできる。
- 観測機からのINSERTは受信Edge Functionだけがservice roleで行う。
- secret/service role keyはSupabase Secretsに保存し、ブラウザ用ビルド変数へ
  入れない。
- リクエストログには `requestId`、機体内部ID、件数、結果、処理時間を記録し、
  token、JWT、完全な観測本文は記録しない。
- `401`、`422`、`429`、`5xx`、重複率、受信遅延、最後の受信時刻を監視対象とする。
- 開発環境と本番環境は別Supabase projectにし、本番データを開発へ複製しない。
- 本番は日次バックアップがある有料プランを使用し、月1回リストア手順を確認する。
- テレメトリーは最低1年間オンライン保持する。削除を実装する前にエクスポート先と
  保存年限を別途決定するため、初期実装では自動削除しない。

初期性能目標:

- 200件の受信バッチ: p95 2秒以内。
- 3機体・直近24時間の取得: p95 3秒以内、10,000件以下。
- 同じ観測値を3回送ってもDBに保存される行は1件。

## 10. 実装完了の受け入れ条件

1. SQL migrationだけで4テーブル、制約、index、RLS policyを再現できる。
2. 正しいdevice tokenの新規・重複・一部不正バッチを仕様どおり処理できる。
3. 無効・失効済みtoken、別機体の偽装、過大バッチを拒否できる。
4. 招待済みユーザーだけがログインでき、自分に割り当てられた機体だけ取得できる。
5. `GET /v1/tracks` の応答を正式 `VehicleDataSource` が `VehicleTracks` として返し、
   現行の地図、軌跡、グラフ、JSON/CSVエクスポートが動作する。
6. SDカード上の同じ `messageId` を再送しても観測値が増殖しない。
7. secretがGit管理、ブラウザbundle、APIレスポンス、ログへ含まれないことを確認する。
8. migration、Edge Function、Web adapterについて自動テストが通る。

## 11. 今回決めない項目

以下は正式API実装の前提を変えないため、別タスクで決定する。

- LTE-Mモジュールと通信事業者
- 観測間隔と通常送信間隔
- SDカードのファイル形式と最大保持期間
- GitHub Pagesから独自ドメインへ移す時期
- 1年を超えたデータのアーカイブ製品と最終保存年限
- 異常検知、集計テーブル、Realtime配信
