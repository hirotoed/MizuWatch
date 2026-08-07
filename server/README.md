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

## ディレクトリ構成

```text
server/
├── README.md
├── api/
│   └── receive_data.py
├── database/
│   └── schema.sql
└── config/
```

## API

観測機から以下のようなJSONデータを受信することを想定しています。

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

## 今後実装する機能

* データ受信API
* デバイス認証
* データベース保存
* データ取得API
* 未送信データの重複防止
* 異常値チェック
* Web管理画面との連携
* 機械学習処理との連携

## セキュリティ

APIキー、データベースのパスワード、認証情報などはGitHubに直接保存しません。

`.env`などの環境変数ファイルを使用し、`.gitignore`で除外します。
