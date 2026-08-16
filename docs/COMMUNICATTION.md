# Communication

## 基本通信

LTE-Mを使用して観測データをサーバーへ送信する。

## 通常時

センサー取得
↓
データ生成
↓
LTE-M送信
↓
サーバー保存

## 通信圏外

送信失敗
↓
SDカード保存
↓
一定時間後に再送
↓
通信復旧
↓
未送信データを送信

## データ形式

JSONを基本とする。

正式な送受信形式、検証、認証、重複防止は
[`API_DATABASE_AUTH.md`](API_DATABASE_AUTH.md) に従う。

SDカード上のNDJSON、outbox、delivery/rejected journal、電源断復旧、時刻未同期時の扱いは
[`STORAGE.md`](STORAGE.md) に従う。

## 決定済みの再送要件

- 絶対時刻が確定している観測はUUID v7 `messageId` を生成し、SD保存・再送で同じ値を維持する。
- 絶対時刻未同期の観測は `bootSequence` + `localSequence` で原本を先に保存し、時刻復元後、outbox登録前に `observedAt` とUUID v7 `messageId` を確定する。
- 未解決の `unsynced` 観測をそのまま正式APIへ送信しない。
- 最大200件を1バッチとして正式APIへ送信する。
- APIが返す `accepted` または `duplicate` を送信完了として扱う。
- 行単位の `rejected` は理由とともに記録し、自動で無限再送しない。
- timeout、LTE-M圏外、HTTP 429、HTTP 5xxではcheckpointを進めず、対象レコードを再送可能な状態に保つ。
- DBの `(device_id, message_id)` 一意制約を最終的な重複防止とする。
- 再起動時は最後の正常なdelivery checkpointの `lastOutboxSequence + 1` から再送を再開する。

## 今後決定する項目

- 通信間隔
- 再送回数
- タイムアウト
