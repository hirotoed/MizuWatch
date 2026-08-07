# MizuWatch Data

このディレクトリでは、MizuWatch（水上環境観測システム）で取得した観測データのサンプルや、データ形式に関する情報を管理します。

## データ項目

MizuWatchでは、主に以下のデータを取得します。

| 項目                | 説明       | 単位       |
| ----------------- | -------- | -------- |
| timestamp         | 観測日時     | ISO 8601 |
| device_id         | 観測機の識別ID | -        |
| latitude          | 緯度       | degree   |
| longitude         | 経度       | degree   |
| air_temperature   | 気温       | °C       |
| humidity          | 湿度       | %        |
| pressure          | 気圧       | hPa      |
| water_temperature | 水温       | °C       |
| battery_voltage   | バッテリー電圧  | V        |

## データ例

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

CSV形式の場合は以下のように保存します。

```csv
timestamp,device_id,latitude,longitude,air_temperature,humidity,pressure,water_temperature,battery_voltage
2026-08-07T12:00:00+09:00,MW-001,33.0000,130.0000,28.4,70.2,1012.4,24.8,3.9
```

## ディレクトリ構成

```text
data/
├─ README.md
└─ sample/
   └─ sample_data.csv
```

`sample/`には、プログラムやWeb管理画面の動作確認に使用できるサンプルデータを保存します。

## データの取り扱い

実証実験で取得した大量の生データは、原則としてGitHubリポジトリには直接保存しません。

GitHubには、以下のデータを保存します。

* データ形式を確認するためのサンプルデータ
* テスト用データ
* 機械学習の検証に必要な小規模データ

実際の観測データについては、データ量や位置情報、公開範囲を考慮して別途管理します。

## 今後の予定

* LTE-Mで受信したデータの保存形式を統一
* SDカードに保存するデータ形式を統一
* 欠損値・異常値の扱いを定義
* 機械学習用データセットの形式を定義

