# 旧GASデータ移行手順

この手順は、旧GASの `DRONE_001` / `DRONE_002` データを新しい複数車両用GASへ移行するためのものです。

## 1. 新GASのコードを更新

1. テスト用スプレッドシートから Apps Script を開く。
2. `SpreadSheets_GAS.gs` の最新内容をApps Scriptエディタへ貼り付ける。
3. 保存する。

## 2. 旧GAS URLをScript Propertiesへ登録

Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」で以下を追加する。

| プロパティ | 値 |
| --- | --- |
| `LEGACY_DRONE_001_URL` | 旧1台目GASの `/exec` URL |
| `LEGACY_DRONE_002_URL` | 旧2台目GASの `/exec` URL |

URLはローカルの `vehicle-tracker/.env` にある `VITE_LEGACY_GAS_ENDPOINTS` から確認できる。URLをGitへコミットしないこと。

`INGEST_TOKEN` は送信機側がトークン送信へ対応するまで設定しない。未設定の場合は従来どおりPOSTでき、設定すると一致する `ingest_token` が必須になる。

## 3. テスト行を整理

`Vehicle_DRONE_001` のテスト行が不要なら、ヘッダーを残して2行目以降を削除する。

## 4. 移行を実行

1. Apps Script上部の関数一覧から `migrateLegacyData` を選ぶ。
2. 「実行」を押す。
3. 外部サービスへの接続権限を求められたら許可する。
4. 実行ログの `Migration summary` を確認する。

現在の旧データでは次が目安になる。

- `DRONE_001`: fetched 66 / added 62 / skippedInvalid 4
- `DRONE_002`: fetched 1446 / added 1424 / skippedInvalid 22

移行処理は車両ごとのタイムスタンプで重複を除外するため、再実行しても同じデータは追加されない。

## 5. Webアプリのデプロイを更新

1. Apps Script右上の「デプロイ」→「デプロイを管理」を開く。
2. 対象デプロイの鉛筆アイコンを押す。
3. バージョンで「新バージョン」を選ぶ。
4. 「デプロイ」を押す。

既存デプロイを更新すれば `/exec` URLは変わらない。

## 6. APIを確認

ブラウザで次を開く。

```text
新GASのURL?action=getAllVehicles
```

`status: success`、2台分の `vehicles`、移行済みデータが返ることを確認する。

続いて次も確認する。

```text
新GASのURL?action=getVehicleList
```

## 7. Reactアプリを切り替え

API確認後、`vehicle-tracker/.env` の `VITE_GAS_ENDPOINT` を新GASの `/exec` URLへ変更し、開発サーバーを再起動する。

```powershell
npm run dev
```

2 vehicles と移行済みデータが表示されることを確認する。旧GASと旧URLは、切り替え確認が終わるまで削除しない。
