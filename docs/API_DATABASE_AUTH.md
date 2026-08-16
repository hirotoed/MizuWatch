# MizuWatch 正式API・DB・認証要件

初回決定: 2026-08-15  
最終更新: 2026-08-16

## 1. この文書の位置づけ

この文書は、観測機からWeb観測アプリまでの正式なデータ経路について、
実装の基準となるAPI、データベース、認証、テレメトリー項目を定める。

MizuWatch v1 の測定・GNSS要求は [`SPEC.md`](SPEC.md) を参照し、
API wire形式、DB列、検証範囲、取得レスポンスとの対応は本書を正本とする。

Web側の取得契約は `web/vehicle-tracker/src/types/index.ts` の
`TelemetryDataPoint` / `VehicleTracks` と、
`web/vehicle-tracker/src/data/types.ts` の `VehicleDataSource` を境界とする。

正式バックエンドの初期実装は `supabase/` 以下に存在する。2026-08-16の更新では、
淡水v1で追加された pH、EC、L76K Multi-GNSSの品質情報、測定品質メタデータを
API/DB契約へ同期する。

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
- Supabaseのsecret key、service role key、DBパスワードをブラウザまたは観測機へ配置しない。
- Supabaseのpublishable keyはプロジェクト識別用であり、デバイス認証には使用しない。
- GASは正式経路に含めない。

## 4. API共通要件

- クライアントから見た論理パスを `/v1` でバージョン管理する。
- `schemaVersion` は初期v1契約として `1` を使用する。
- JSONのwire形式はcamelCase、PostgreSQL列はsnake_caseとする。
- 通信はTLS 1.2以上のHTTPSだけを許可し、観測機でも証明書を検証する。
- JSONはUTF-8、日時はRFC 3339とし、DBではUTCの `timestamptz` に正規化する。
- 成功レスポンスには `requestId` を含める。

| 論理パス | Supabase上の配置 | platform JWT検証 |
| --- | --- | --- |
| `POST /v1/device/telemetry/batches` | `$SUPABASE_URL/functions/v1/device-telemetry-v1` | 無効。Function内でdevice tokenを検証 |
| `GET /v1/tracks` | `$SUPABASE_URL/functions/v1/tracks-v1` | 有効。Supabase Auth JWTを検証 |

エラー形式:

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

- `401`: 認証失敗
- `403`: 権限不足
- `409`: 状態競合
- `422`: 読み取り可能だが不正な観測値
- `429`: レート超過
- `500`: 予期しないサーバーエラー

本番CORSはGitHub Pagesの正式originだけを許可する。ローカル開発originは
開発環境だけに追加し、`*` とcredentialの組み合わせを使用しない。

## 5. 観測データ受信API

### `POST /v1/device/telemetry/batches`

認証済みの1機体から、通常送信またはSDカードからの再送を一括受信する。
機体IDはBearer tokenから確定し、リクエスト本文で別機体を指定させない。

### v1送信例

```json
{
  "schemaVersion": 1,
  "batchId": "0198d24c-ef42-7b9b-a9ce-9ca004ae95f1",
  "readings": [
    {
      "messageId": "0198d24c-ef42-7b9b-a9ce-9ca004ae9602",
      "observedAt": "2026-08-16T01:00:00Z",
      "latitude": 33.000000,
      "longitude": 130.000000,
      "altitude": 1.8,
      "satellites": 10,
      "gnssTimestamp": "2026-08-16T01:00:00Z",
      "fixStatus": "valid",
      "hdop": 0.9,
      "waterTemperature": 24.8,
      "ph": 7.12,
      "ec": 326.4,
      "airPressure": 1012.4,
      "airTemperature": 28.4,
      "humidity": 70.2,
      "batteryVoltage": 3.9,
      "communicationStatus": "online",
      "waterTemperatureSensorId": "ds18b20-01",
      "phSensorId": "sen0169v2-01",
      "ecSensorId": "sen0706-01",
      "phCalibrationId": "ph-cal-20260816-01",
      "ecCalibrationId": "ec-cal-20260816-01",
      "measurementStatus": "ok"
    }
  ]
}
```

### バッチ・重複防止要件

- 1バッチは1機体、最大200件、非圧縮本文256 KiB以下とする。
- `messageId` は観測時にUUID v7として一度だけ生成し、SD保存・再送でも同じ値を使う。
- `(device_id, message_id)` のDB一意制約を最終的な重複防止とする。
- 同じ `messageId` の再送はエラーにせず `duplicate` として成功応答する。
- `batchId` は送信試行単位の追跡用であり、観測値の一意性には使わない。
- 個別観測値が不正な場合、有効行を保存し、行ごとの `accepted` / `duplicate` / `rejected` を返す。
- 1機体あたり60リクエスト/分を初期上限とする。

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

| wire項目 | 必須 | DB列 | 条件 / 意味 |
| --- | --- | --- | --- |
| `messageId` | 必須 | `message_id` | UUID v7 |
| `observedAt` | 必須 | `observed_at` | RFC 3339、機体登録日時以降、サーバー時刻+5分以内 |
| `latitude` | 条件付き | `latitude` | -90〜90。通常fixでは必須 |
| `longitude` | 条件付き | `longitude` | -180〜180。通常fixでは必須 |
| `altitude` | 任意 | `altitude` | -500〜10,000 m |
| `satellites` | 任意 | `satellites` | 0〜100の整数。SPECの `satellite_count` に対応 |
| `gnssTimestamp` | 任意 | `gnss_timestamp` | L76K/NMEA由来のRFC 3339時刻 |
| `fixStatus` | 任意 | `fix_status` | `valid` / `no_fix` |
| `hdop` | 任意 | `hdop` | 0〜99.99 |
| `waterTemperature` | 必須 | `water_temperature` | API安全範囲 -10〜80 ℃。研究運用範囲はSPECに従う |
| `ph` | 任意* | `ph` | 0〜14。v1研究運用範囲はpH 4〜10 |
| `ec` | 任意* | `ec` | 1〜2000 µS/cm |
| `airPressure` | 必須 | `air_pressure` | 300〜1,200 hPa |
| `airTemperature` | 必須 | `air_temperature` | -60〜80 ℃ |
| `humidity` | 任意 | `humidity` | 0〜100 % |
| `batteryVoltage` | 任意 | `battery_voltage` | 0〜20 V |
| `communicationStatus` | 任意 | `communication_status` | `online` / `buffered` / `unknown` |
| `waterTemperatureSensorId` | 任意 | `water_temperature_sensor_id` | 1〜64文字 |
| `phSensorId` | 任意 | `ph_sensor_id` | 1〜64文字 |
| `ecSensorId` | 任意 | `ec_sensor_id` | 1〜64文字 |
| `waterTemperatureCalibrationId` | 任意 | `water_temperature_calibration_id` | 1〜64文字 |
| `phCalibrationId` | 任意 | `ph_calibration_id` | 1〜64文字 |
| `ecCalibrationId` | 任意 | `ec_calibration_id` | 1〜64文字 |
| `measurementStatus` | 任意 | `measurement_status` | `ok` / `stabilizing` / `partial` / `sensor_error` |

\* pH/ECはv1の主測定項目だが、センサー単体検証・段階的bring-up中の旧データも同一APIで扱うため、transport層ではnullableとする。**v1の正式な水質比較実験ではpH/ECを記録必須**とする。

### GNSS fixの扱い

- `fixStatus` を省略する旧形式では `latitude` と `longitude` を必須とする。
- `fixStatus = "valid"` の場合は緯度・経度を必須とする。
- `fixStatus = "no_fix"` の場合は緯度・経度を送らない。
- GNSS fixが取れない間のセンサーデータもDBには保存できる。
- `/v1/tracks` は地図・軌跡用APIのため、緯度・経度がない行はレスポンスから除外する。

### 品質情報の責任分界

`measurementStatus` は観測機が測定時の状態を記録する。一方、`qualityFlag` は
基準機比較・校正状態・応答安定性等を評価した後にサーバー/解析側で付与する。
観測機から `qualityFlag` を送信することは禁止する。

`qualityFlag` の意味はSPECの暫定案に従う。

- `A`: Research quantitative
- `B`: Screening / trend
- `C`: Invalid / caution

具体的な判定ロジックは比較検証結果確定後に実装する。

## 6. Web取得APIとデータソース契約

### `GET /v1/tracks`

ログインユーザーが閲覧できる全機体について、指定期間の**位置fix付き観測値**を取得する。

クエリ:

- `from`: 任意。省略時は現在から24時間前。
- `to`: 任意。省略時は現在。
- `vehicleId`: 任意。複数指定可能。
- 1回の期間は最大7日、返却件数は全機体合計10,000件まで。
- 上限を超える場合は `422 RANGE_TOO_LARGE` を返す。

レスポンスの `data` は `VehicleTracks` と同形で、各配列を `timestamp` 昇順にする。

```json
{
  "data": {
    "MIZU_001": [
      {
        "timestamp": "2026-08-16T01:00:00.000Z",
        "vehicleId": "MIZU_001",
        "latitude": 33.0,
        "longitude": 130.0,
        "altitude": 1.8,
        "satellites": 10,
        "gnssTimestamp": "2026-08-16T01:00:00.000Z",
        "fixStatus": "valid",
        "hdop": 0.9,
        "waterTemperature": 24.8,
        "ph": 7.12,
        "ec": 326.4,
        "airPressure": 1012.4,
        "airTemperature": 28.4,
        "humidity": 70.2,
        "batteryVoltage": 3.9,
        "communicationStatus": "online",
        "measurementStatus": "ok",
        "qualityFlag": "A"
      }
    ]
  },
  "requestId": "01K..."
}
```

`qualityFlag` は未評価の場合はレスポンスから省略する。
`messageId`、`receivedAt`、各センサーID・校正IDはDBには保持するが、現行の
地図向け `/tracks` には含めない。完全な研究用エクスポートは、後段で
`GET /v1/vehicles/{vehicleId}/telemetry` を追加して提供する。

## 7. PostgreSQLスキーマ要件

### `devices`

- `id uuid primary key`
- `vehicle_code text not null unique`
- `display_name text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

### `telemetry_readings`

識別・時刻:

- `id bigint generated always as identity primary key`
- `device_id uuid not null references devices(id)`
- `message_id uuid not null`
- `observed_at timestamptz not null`
- `received_at timestamptz not null default now()`
- `schema_version smallint not null`

GNSS:

- `latitude double precision null`
- `longitude double precision null`
- `altitude real null`
- `satellites smallint null`
- `gnss_timestamp timestamptz null`
- `fix_status text null`
- `hdop real null`

センサー値:

- `water_temperature real not null`
- `ph real null`
- `ec real null`
- `air_pressure real not null`
- `air_temperature real not null`
- `humidity real null`

機体・品質情報:

- `battery_voltage real null`
- `communication_status text null`
- `measurement_status text null`
- `quality_flag text null` — **サーバー/解析側管理**

トレーサビリティ:

- `water_temperature_sensor_id text null`
- `ph_sensor_id text null`
- `ec_sensor_id text null`
- `water_temperature_calibration_id text null`
- `ph_calibration_id text null`
- `ec_calibration_id text null`

制約:

- `unique (device_id, message_id)`
- 取得用B-tree index `(device_id, observed_at desc, id desc)`
- APIと同等の範囲・enum制約をDBにも設定する。
- 緯度と経度は両方NULLまたは両方非NULLとする。
- `fix_status = 'valid'` なら緯度経度が必要、`no_fix` なら緯度経度をNULLとする。

`observed_at` は観測時刻、`received_at` は再送遅延・通信品質分析のための受信時刻として両方保持する。

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
- ブラウザはJWTに加えてpublishable keyを `apikey` headerで送信する。
- APIはJWTを検証し、`user_device_access` とRLSの両方で機体単位の閲覧権限を適用する。
- `viewer` は閲覧だけ、`admin` は機体名・ユーザー割当・credentialローテーションを管理できる。
- テレメトリーの上書き・削除は通常操作として提供しない。

### 観測機

- 初期登録時に暗号学的乱数から32 byteのtokenを機体ごとに発行する。
- Edge FunctionはtokenのSHA-256 hashを定時間比較し、有効な機体だけ受信する。
- tokenは機体のsecret領域に保存し、ソースコード、SD観測データ、ログに出力しない。
- 漏えい・紛失時は即時失効できるようにする。
- 共通token、WebユーザーJWT、Supabase secret/service role keyを観測機へ配布しない。

## 9. RLS・運用・監視要件

- APIから参照する全公開schemaテーブルでRLSを有効にする。
- 未認証 `anon` roleにはテレメトリー、機体、割当の権限を付与しない。
- 認証ユーザーは `user_device_access` に存在する機体だけSELECTできる。
- 観測機からのINSERTは受信Edge Functionだけがservice roleで行う。
- secret/service role keyはSupabase Secretsに保存し、ブラウザ用ビルド変数へ入れない。
- ログには `requestId`、機体内部ID、件数、結果、処理時間を記録し、token、JWT、完全な観測本文は記録しない。
- `401`、`422`、`429`、`5xx`、重複率、受信遅延、最後の受信時刻を監視対象とする。
- 開発環境と本番環境は別Supabase projectにする。
- テレメトリーは最低1年間オンライン保持する。初期実装では自動削除しない。

初期性能目標:

- 200件の受信バッチ: p95 2秒以内。
- 3機体・直近24時間の取得: p95 3秒以内、10,000件以下。
- 同じ観測値を3回送ってもDBに保存される行は1件。

## 10. 実装完了の受け入れ条件

1. SQL migrationだけでテーブル、v1追加列、制約、index、RLS policyを再現できる。
2. pH / EC / L76K GNSS品質情報を受信・保存できる。
3. `fixStatus = no_fix` の行をDBへ保存でき、`/v1/tracks` では位置なし行を返さない。
4. 正しいdevice tokenの新規・重複・一部不正バッチを仕様どおり処理できる。
5. `qualityFlag` を観測機が送った場合は拒否し、DBではサーバー管理項目として保持する。
6. 無効・失効済みtoken、別機体の偽装、過大バッチを拒否できる。
7. 招待済みユーザーだけが、自分に割り当てられた機体だけ取得できる。
8. `GET /v1/tracks` がpH / EC / GNSS品質 / 状態情報を `VehicleTracks` として返す。
9. 現行の地図、軌跡、グラフ、JSON/CSVエクスポートが既存項目について後方互換で動作する。
10. SDカード上の同じ `messageId` を再送しても観測値が増殖しない。
