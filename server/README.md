# MizuWatch Server

このディレクトリでは、MizuWatch観測機から送信されたデータを受信・保存し、Web管理画面へ提供するサーバー側の処理を管理します。

## 主な役割

* 観測機からのデータ受信
* データ形式の検証
* 観測データの保存
* Web管理画面へのデータ提供
* 将来的な異常検知・機械学習処理との連携

## 基本的なデータの流れ

```text
MizuWatch観測機
    ↓
LTE-M通信
    ↓
APIサーバー
    ↓
データ検証
    ↓
データベース
    ↓
Web管理画面
```

## 正式バックエンド

正式APIはSupabase Edge Functions（TypeScript）、データベースはSupabase
PostgreSQL、Web利用者認証はSupabase Authを使用します。観測機は機体ごとの
tokenで認証します。API、schema、RLS、重複防止の正本は
[`../docs/API_DATABASE_AUTH.md`](../docs/API_DATABASE_AUTH.md) です。

`google-apps-script` は過去の検証用資産であり、本番バックエンドには使用しません。

## API

観測機は正式なバッチ受信APIへ送信します。以下は過去の単一行形式の参考例で、
正式なwire形式ではありません。

```json
{
  "device_id": "MW-001",
  "timestamp": "2026-08-07T12:00:00+09:00",
  "latitude": 33.0000,
  "longitude": 130.0000,
  "air_temperature": 28.4,
  "humidity": 70.2,
  "pressure": 1012.4,
  "water_temperature": 24.8,
  "battery_voltage": 3.9
}
```

## 実装済みの正式経路

* `../supabase/migrations`: SQL schema、制約、index、RLS policy
* `../supabase/functions/device-telemetry-v1`: 観測機tokenを検証する受信Edge Function
* `../supabase/functions/tracks-v1`: Web利用者JWTとRLSを使う取得Edge Function
* `(device_id, message_id)` 一意制約とトランザクションRPCによる再送の重複防止
* `../web/vehicle-tracker/src/data/supabaseVehicleDataSource.ts`: 正式 `VehicleDataSource`

導入、secret、テスト、deploy手順は [`../supabase/README.md`](../supabase/README.md) を参照してください。

## セキュリティ

APIキー、データベースのパスワード、認証情報などはGitHubに直接保存しません。

`.env`などの環境変数ファイルを使用し、`.gitignore`で除外します。
