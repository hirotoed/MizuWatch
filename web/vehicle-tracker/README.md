# MizuWatch Vehicle Tracker

複数の水上観測機について、現在位置、移動軌跡、GPS状態、環境センサー履歴を表示するReactアプリです。

ローカル開発ではブラウザ内のモックデータ、正式環境ではSupabase Authと取得Edge Functionを使えます。画面は同じ `VehicleDataSource` 境界を通してデータを受け取ります。

## 起動方法

必要なもの:

- Node.js 18以上
- npm
- 地図を表示する場合のみGoogle Maps JavaScript APIキー

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

ブラウザで `http://localhost:4000` を開きます。初期値はモックなので外部バックエンドなしで動作します。

Google Mapsを表示する場合は `.env` に次を設定します。

```dotenv
VITE_GMAPS_API_KEY=your_google_maps_api_key_here
```

APIキーがない場合もアプリとモックデータは起動できます。地図以外のデータ確認には上部のGraphs表示を使用できます。

正式APIへ接続する場合は次を設定します。画面に招待済みユーザーのログインフォームが表示され、取得リクエストにはSupabase Auth JWTとpublishable keyが送信されます。

```dotenv
VITE_VEHICLE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

service role key、device token、ユーザーJWTをWebの環境変数へ設定してはいけません。

## 現在のデータ経路

```text
MockVehicleDataSource または SupabaseVehicleDataSource
        ↓
useVehicleData
        ↓
Zustand store
        ↓
地図・グラフ・詳細・エクスポート
```

`src/data/types.ts` の `VehicleDataSource` が画面と取得実装の境界です。`VITE_VEHICLE_DATA_SOURCE` による選択は `src/data/index.ts`、正式実装は `src/data/supabaseVehicleDataSource.ts` にあります。

モックには3機体、各36件の時系列データが含まれ、次を確認できます。

- 緯度・経度による現在位置と軌跡
- 高度とGPS衛星数
- 水温、気温、湿度、気圧
- 車両切り替えと定期再取得
- CSV/JSONエクスポート

## データ契約

```typescript
interface TelemetryDataPoint {
  timestamp: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  satellites?: number;
  waterTemperature: number;
  airPressure: number;
  airTemperature: number;
  humidity?: number;
}

type VehicleTracks = Record<string, TelemetryDataPoint[]>;

interface VehicleDataSource {
  readonly id: string;
  readonly label: string;
  getAllVehicles(): Promise<VehicleTracks>;
}
```

正式実装はこの契約を満たし、取得APIの `data` を実行時検証して返します。正式バックエンドはSupabase Edge Functions、PostgreSQL、Authです。

## 主な機能

- Google Maps上の複数機体・軌跡・経過点表示
- 水温、気温、気圧、高度、GPS衛星数のグラフ
- センサー詳細パネル
- 5〜60秒間隔の再取得と一時停止
- 選択機体または全機体のCSV/JSON出力
- キーボード操作とレスポンシブ表示

## 品質確認

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

本番ビルド結果は `dist` に生成されます。

## ディレクトリ

```text
src/
├── components/  # 地図、グラフ、操作UI
├── data/        # データソース契約とモック実装
├── hooks/       # データ取得と画面ロジック
├── store/       # Zustand状態管理
├── types/       # アプリ共通データ型
└── utils/       # CSV/JSON出力
```
