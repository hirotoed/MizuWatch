# MizuWatch

MizuWatchは、河川・湖・ため池などの水域を低コストで観測する
水上環境観測システムです。

プロジェクト全体の目的、本番構成、現在地、優先順位は
[`docs/PROJECT_DIRECTION.md`](docs/PROJECT_DIRECTION.md) を正本とします。

## 目的

- 水温や気象データの取得
- GPSによる観測地点の記録
- LTE-Mによるリアルタイム送信
- 通信圏外ではSDカードへ保存
- 観測データをWeb地図上で確認
- 機械学習による異常地点の検出

## 現在の開発状況

- Raspberry Pi Pico Wによる試作機を作成済み
- GPS、温湿度、気圧、水温センサーを使用
- Google Apps Scriptへのデータ送信を過去の方式として検証済み
- 次期基板をKiCadで設計予定

## 主な実証場所

河川・ため池

## ディレクトリ

- `firmware`：マイコン用プログラム
- `hardware`：回路図、PCB、部品表
- `web`：観測データ表示システム
- `docs`：仕様書、試験計画、開発記録

## Web観測アプリ

複数機体の位置・軌跡・センサーデータを表示するReactアプリは
`web/vehicle-tracker` にあります。

```powershell
cd web/vehicle-tracker
npm install
Copy-Item .env.example .env
npm run dev
```

現行アプリはGASに接続せず、ローカルではブラウザ内のモックデータで動作します。
Supabase設定を与えると、招待制ログインと正式 `VehicleDataSource` に切り替わります。
過去のGAS資産は `server/google-apps-script` に残していますが、Webアプリの
実行経路からは外れています。

正式バックエンドのmigration、RLS、Edge Functions、テスト、導入手順は
[`supabase/README.md`](supabase/README.md) にあります。

### DRONE_003

現在の計測用Pico Wファームウェアは `firmware/pico_w/drone_003` にあります。
このファームウェアのGAS送信は正式API完成前の移行用です。Wi-Fiと接続先URLは
Git管理外の `arduino_secrets.h` に設定します。

### CI・公開

Pull Requestでは型チェック・Lint・本番ビルドを実行します。`main`へ
マージされた変更は、GitHub ActionsからGitHub Pagesへデプロイされます。
地図を表示する公開環境では、Actions Secretsに `VITE_GMAPS_API_KEY` が必要です。
モック構成ではデータ取得設定は不要です。正式構成ではActions Variablesに
`VITE_VEHICLE_DATA_SOURCE=supabase`、`VITE_SUPABASE_URL`、
`VITE_SUPABASE_PUBLISHABLE_KEY` を設定します。publishable key以外の認証情報を
ブラウザbuildへ渡してはいけません。
