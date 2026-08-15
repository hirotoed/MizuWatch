# DRONE_003 firmware

Raspberry Pi Pico WからGPS・BME280・水温センサーの値を読み取り、
MizuWatchのGoogle Apps Scriptへ1分ごとにJSON POSTします。

## ローカル設定

`arduino_secrets.example.h` を同じフォルダの
`arduino_secrets.h` にコピーし、Wi-FiとGASの値を設定します。

```powershell
Copy-Item arduino_secrets.example.h arduino_secrets.h
```

`arduino_secrets.h` はGit管理から除外されています。実際のSSID、
パスワード、GAS URLをコミットしないでください。

## Arduino IDE

1. `drone_003.ino` を開く
2. ボードに `Raspberry Pi Pico W` を選ぶ
3. 接続中のCOMポートを選ぶ
4. 書き込み後、シリアルモニターを `115200` baudで開く

送信成功時はHTTP 200と `Vehicle_DRONE_003` が表示されます。

## 必要なライブラリ

- TinyGPSPlus
- Adafruit BME280 Library
- DallasTemperature
- OneWire
