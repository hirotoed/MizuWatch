# Vehicle Tracker Web App

リアルタイム車両追跡Webアプリケーション - Google Mapsを使って車両の位置とセンサーデータを可視化します。

## 🚀 初期環境設定（必須）

このリポジトリをクローンした後、以下の手順で環境を構築してください。

### 1. 必要なソフトウェア

- **Node.js 18以上** - [nodejs.org](https://nodejs.org/) からダウンロード
- **npm** (Node.jsに含まれています)
- **Google Maps API キー** - [Google Cloud Console](https://console.cloud.google.com/)で取得

### 2. プロジェクトのセットアップ

```bash
# 1. このリポジトリをクローン
git clone <repository-url>
cd vehicle-tracker

# 2. 必要なライブラリをインストール
npm install

# 3. 環境設定ファイルを作成（macOS/Linux）
cp .env.example .env

# Windows PowerShellの場合
Copy-Item .env.example .env
```

### 3. APIキーの設定

`.env`ファイルを編集して以下を設定：

```bash
# Google Maps APIキー（必須）
VITE_GMAPS_API_KEY=your_google_maps_api_key_here

# データ取得先のGoogle Apps Script URL（必須）
VITE_GAS_ENDPOINT=your_google_apps_script_web_app_url_here

# 旧GASを車両ごとに使う場合（任意）
VITE_LEGACY_GAS_ENDPOINTS=DRONE_001|first_gas_url,DRONE_002|second_gas_url
```

### 4. アプリケーションの起動

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで http://localhost:4000 にアクセス
```

### 5. 本番用ビルド（オプション）

```bash
# 本番用にビルド
npm run build

# ビルドした結果をプレビュー
npm run preview
```

---

## 📖 技術仕様書（エンジニア向け）

### システム概要

このWebアプリケーションは、車両のリアルタイム位置追跡とセンサーデータ監視を行います。車両に搭載されたGPSとセンサーからのデータをWebブラウザ上の地図に表示し、運行状況を可視化します。

### アーキテクチャ

```
[車両センサー] → [Google Sheets + GAS] → [React Webアプリ] → [ユーザー]
```

1. **データ収集層**: 車両のGPS・センサーデータをGoogle Sheetsに蓄積
2. **API層**: Google Apps Script (GAS) がREST APIとしてデータを提供
3. **表示層**: React Webアプリがリアルタイムでデータを取得・表示

### 主要技術スタック

- **フロントエンド**: React 19 + TypeScript
- **ビルドツール**: Webpack 5 
- **スタイリング**: Tailwind CSS（ダークテーマ）
- **地図表示**: Google Maps JavaScript API
- **状態管理**: Zustand（軽量Redux代替）
- **データ取得**: SWR（自動リフレッシュ付きHTTPクライアント）
- **アニメーション**: Framer Motion

### 機能仕様

#### 🗺️ 地図表示機能
- **リアルタイム位置表示**: 車両の現在位置をマーカーで表示
- **移動軌跡**: 過去の移動履歴をカラフルな線で描画
- **経過点表示**: 選択した車両の詳細な移動経路を点で表示
- **自動追従**: 車両選択時に地図が自動的に中心移動

#### 📊 センサーデータ表示
- **GPS情報**: 緯度経度、高度、衛星数
- **環境センサー**: 水温、気圧、気温
- **タイムスタンプ**: データ取得時刻
- **Raw JSONデータ**: 技術者向け詳細情報

#### ⚡ リアルタイム更新
- **自動更新**: 5秒〜60秒間隔で設定可能
- **接続状態監視**: データ取得の成功/失敗状況を表示
- **エラー処理**: 接続障害時の自動リトライ機能

#### 💾 データエクスポート
- **CSV形式**: Excel等で開ける形式でデータ出力
- **JSON形式**: プログラム処理用のデータ形式
- **選択エクスポート**: 特定車両または全車両データ

#### 🎮 操作性
- **キーボードショートカット**: 素早い車両切り替え（1-9キー、矢印キー等）
- **レスポンシブ対応**: PC・タブレット・スマートフォンで最適表示
- **タッチ操作**: モバイルデバイスでの直感的操作

### データフォーマット

#### 車両テレメトリーデータ
```typescript
interface TelemetryDataPoint {
  timestamp: string;        // ISO 8601形式の時刻
  vehicleId: string;       // 車両識別子
  latitude: number;        // 緯度（度）
  longitude: number;       // 経度（度）
  altitude: number;        // 高度（メートル）
  satellites: number;      // GPS衛星数
  waterTemperature: number; // 水温（摂氏）
  airPressure: number;     // 気圧（hPa）
  airTemperature: number;  // 気温（摂氏）
}
```

### APIエンドポイント仕様

Google Apps Scriptは以下のエンドポイントを提供する必要があります：

- `GET ?action=getAllVehicles` - 全車両の最新データ取得
- `GET ?action=getVehicle&vehicleId=XXX` - 特定車両の履歴データ取得
- `GET ?action=getVehicleList` - 車両一覧取得

### パフォーマンス最適化

- **マーカー制限**: 経過点表示を最大10個に制限してレンダリング負荷軽減
- **データ間引き**: 非選択車両は10番目ごとにポイント表示
- **メモリ管理**: 不要なイベントハンドラーのクリーンアップ
- **バンドルサイズ**: Webpackによるコード分割とminification

### セキュリティ

- **APIキー保護**: `.env`でソースコードから分離し、Google Cloud側でWebサイトとMaps JavaScript APIに利用制限を設定
- **CORS対応**: 適切なオリジン制限
- **XSS対策**: React標準のエスケープ処理

---

## 📱 ユーザー操作ガイド

### 基本操作

| 操作 | 方法 |
|------|------|
| 車両選択 | 上部タブクリックまたは1-9キー |
| 車両切り替え | `[` / `]` キーまたは矢印キー |
| データ更新間隔変更 | 右上の「Refresh」ドロップダウン |
| 更新一時停止 | `P`キーまたは「Pause」ボタン |
| データエクスポート | `E`キーまたは下部エクスポートボタン |
| センサー詳細表示 | マーカークリックまたは情報ボタン |
| 詳細パネル閉じる | `ESC`キーまたは×ボタン |

### レスポンシブデザイン

- **デスクトップ（1280px以上）**: 地図＋固定サイドパネル
- **タブレット（1024px-1279px）**: 地図メイン＋オーバーレイパネル  
- **モバイル（1023px以下）**: フルスクリーン地図＋オーバーレイパネル

---

## 🔧 Google Apps Script設定

旧GASから複数ドローン用GASへ切り替える場合は、[GAS移行手順](../../server/google-apps-script/MIGRATION.md)を参照してください。

データ提供用のGoogle Apps Scriptは以下のエンドポイントをサポートする必要があります：

### 必要なAPIエンドポイント

- `GET ?action=getAllVehicles` - 全車両の最新データを返す
- `GET ?action=getVehicle&vehicleId=車両ID` - 特定車両の履歴データを返す  
- `GET ?action=getVehicleList` - 利用可能な車両の一覧を返す

### データ形式仕様

Google Apps Scriptが返すJSONデータの形式：

```json
{
  "status": "success",
  "timestamp": "2025-06-16T12:00:00.000Z",
  "vehicles": [
    {
      "vehicleId": "DRONE_001",
      "data": [
        {
          "timestamp": "2025-06-16T12:00:00.000Z",
          "vehicleId": "DRONE_001",
          "latitude": 35.6762,
          "longitude": 139.6503,
          "altitude": 120.5,
          "satellites": 8,
          "waterTemperature": 22.3,
          "airPressure": 1013.25,
          "airTemperature": 25.1
        }
      ]
    }
  ]
}
```

---

## 🏗️ プロジェクト構造

```
src/
├── api/               # データ取得API層
├── components/        # React UIコンポーネント
│   ├── TopBar.tsx    # ヘッダー（更新間隔設定等）
│   ├── VehicleTabs.tsx # 車両選択タブ
│   ├── MapContainer.tsx # Google Maps表示
│   ├── VehicleMarker.tsx # 車両位置マーカー
│   ├── WaypointMarker.tsx # 経過点マーカー
│   ├── TrackPolyline.tsx # 移動軌跡線
│   ├── SidePanel.tsx # センサー詳細パネル
│   └── StatusBar.tsx # 接続状態・エクスポート
├── hooks/            # カスタムReactフック
├── store/            # グローバル状態管理
├── types/            # TypeScript型定義
├── utils/            # ユーティリティ関数
├── constants/        # 設定定数
└── assets/           # 静的ファイル
```

---

## ⚙️ カスタマイズ

### 地図スタイルの変更
`src/constants/map.ts`の`MONOCHROME_MAP_STYLE`を編集することで、地図の見た目をカスタマイズできます。

### 更新間隔の変更  
`src/components/TopBar.tsx`の`intervalOptions`配列を編集することで、データ更新間隔の選択肢を変更できます。

### 色テーマの変更
`tailwind.config.js`でダークテーマの色を設定しています：
- Background: `#0d1117` (GitHub風ダークグレー)
- Surface: `#161b22` (カード背景色)
- Accent: `#58a6ff` (アクセントブルー)
- Text: `#c9d1d9` (メインテキスト色)

---

## 🚀 デプロイ

### 本番ビルド
```bash
npm run build
```

### Vercel/Netlifyへのデプロイ
1. GitHubリポジトリをVercel/Netlifyに接続
2. 環境変数を設定：
   - `VITE_GMAPS_API_KEY`
   - `VITE_GAS_ENDPOINT`
3. 自動デプロイが開始されます

---

## 🧑‍💻 開発者向け情報

### コード品質
- TypeScript strict mode使用
- ESLint設定済み
- 統一的なコーディングスタイル

### ビルドコマンド
```bash
npm run build    # 本番用ビルド
npm run lint     # コード品質チェック  
npm run typecheck # TypeScript型チェック
npm run preview  # ビルド結果のプレビュー
```

---

## 📄 ライセンス

MIT License - 詳細はLICENSEファイルを参照

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成
3. 変更を実装  
4. テスト追加（該当する場合）
5. プルリクエストを送信
