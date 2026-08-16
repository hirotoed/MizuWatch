# Development Log

## 2026-08

### 実施内容

- GitHubリポジトリ作成
- プロジェクト構成整理
- MizuWatch仕様整理開始

### 次にやること

- LTE-Mモジュール選定
- 電源回路設計
- KiCad回路図作成
- SDカード保存処理の設計

## 2026-08-15 WebアプリのGAS非依存化

### 実施内容

- Reactアプリの画面とデータ取得処理の間に `VehicleDataSource` 契約を追加
- GAS取得実装とGAS用の環境変数・型・エラー表示を削除
- 3機体、各36件のGPS・環境センサーデータを生成するモックデータソースを追加
- CI、環境設定例、WebアプリREADMEからGAS設定を削除
- 正式API未実装でも地図、グラフ、詳細、エクスポートを開発・確認できる構成へ変更

### 次にやること

- Supabase SQL migrationでschema、制約、index、RLS policyを実装する
- 受信・取得Edge Functionと正式 `VehicleDataSource` を実装する
- 自動テスト後、モックから正式APIへ切り替える

## 2026-08-15 正式API・DB・認証要件の決定

### 実施内容

- `VehicleDataSource` と `VehicleTracks` を基準にWeb取得APIを定義
- 正式APIにSupabase Edge Functions、DBにSupabase PostgreSQLを採用
- Web利用者は招待制のSupabase Auth、観測機は機体ごとの256 bit tokenと決定
- UUID v7 `messageId` とDB一意制約による冪等な再送方式を決定
- テーブル、RLS、入力検証、API上限、監視、バックアップ、受け入れ条件を文書化

### 次にやること

- Supabase projectとローカル開発環境を準備する
- SQL migrationとRLSの自動テストを実装する
- 観測データ受信Edge Functionを実装する
- Web取得Edge Functionと正式 `VehicleDataSource` を実装する

## 2026-08-15 Supabase正式データ経路の実装

### 実施内容

- `supabase/migrations` にdevices、telemetry、ユーザー機体権限、private credentialを含むschemaを追加
- APIと同じ観測値範囲、UUID v7、`(device_id, message_id)` 一意制約、取得indexをDBにも適用
- viewer/adminの機体単位RLSとservice-role専用のcredential・レート制限・冪等保存RPCを追加
- 機体tokenをSHA-256と定時間比較で認証し、最大200件を部分受理する受信Edge Functionを追加
- Supabase Auth JWTを再検証し、RLS適用下で最大7日・10,000件を返す取得Edge Functionを追加
- Supabase Authログイン画面、正式 `VehicleDataSource`、環境変数によるmock/formal切り替えを追加
- pgTAP、Deno、VitestのテストとGitHub Actionsのbackend CIを追加

### 確認内容

- WebのTypeScript型チェック、ESLint、Vitest、本番webpack build
- Edge FunctionのDeno型チェックと入力検証単体テスト
- SQL migration・RLS用pgTAPテストをCIへ追加（ローカル環境にはDocker未導入のためCIで実行）

### 次にやること

- TokyoリージョンのSupabase projectを作成してmigrationとFunctionsをdeployする
- 招待ユーザー、機体、viewer/admin割当、device credentialを初期登録する
- 新規・重複・一部不正・無効token・RLS分離を本番相当環境で統合試験する
- GitHub PagesのActions Variablesを正式データソースへ切り替える

## 2026-08-15 Tokyo Supabase deploy・hosted統合試験

### 実施内容

- Tokyo (`ap-northeast-1`) project `wkpcfgqraemcmdcrejle` を正式対象としてlink
- 初期migration、`device-telemetry-v1`、`tracks-v1` をdeploy
- CORS originとpublishable keyをEdge Functionsのsecretへ設定
- Supabase予約prefixを避けるため、publishable key secret名を `MIZUWATCH_PUBLISHABLE_KEY` へ修正
- ローカル `.env` とGitHub Actions Repository Variablesを `VITE_VEHICLE_DATA_SOURCE=supabase` へ切り替え
- 一時的なAuthユーザー・機体credentialを使うhosted統合試験を追加

### 確認内容

- 新規観測値を1件受理し、同一UUID v7の再送を重複1件として処理
- Supabase Authのaccess tokenと機体単位RLSで許可機体のtrackを1件取得
- 統合試験終了後に一時ユーザー、機体、credential、観測値を削除
- WebのVitest 3件、TypeScript、ESLint、正式Supabase設定でのproduction build
- `http://localhost:4000` がモック画面ではなくSupabase Authログイン画面を表示

### 次にやること

- 実運用する招待ユーザー、機体、viewer/admin権限、credentialを登録する
- 現在のローカル変更をレビューしてMizuWatchへcommit・pushする
- GitHub Pagesでログイン、地図、グラフ、exportを確認する
