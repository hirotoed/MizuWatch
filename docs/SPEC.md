# MizuWatch システム仕様書

## 使用マイコン

- Raspberry Pi Pico W
- 将来的にLTE-M対応マイコンも検討

## センサー

- 水温
- 気温
- 湿度
- 気圧
- GPS

## 通信

- LTE-Mを基本とする
- 通信圏外ではSDカードに保存
- 通信復旧後に自動送信

## 電源

- リチウムイオン電池
- 電池残量監視機能
- 将来的にソーラー充電を検討

## 想定利用場所

- 河川
- 湖
- ため池
- 沿岸部

## データ形式

```json
{
  "device_id": "MW-001",
  "timestamp": "2026-08-06T10:00:00+09:00",
  "latitude": 33.0000,
  "longitude": 130.0000,
  "air_temperature": 28.4,
  "humidity": 70.2,
  "pressure": 1012.4,
  "water_temperature": 24.8,
  "battery_voltage": 3.9
}
