# MizuWatch v1 SDストレージ仕様

最終更新: 2026-08-16  
対象: MizuWatch v1

## 1. 目的

本書は、MizuWatch v1 の microSD への観測データ保存、時刻未同期時の扱い、送信待ちキュー、再送状態、電源断復旧、容量管理を定める。

API wire形式・DB列・認証・重複防止は [`API_DATABASE_AUTH.md`](API_DATABASE_AUTH.md) を正本とし、通信再送の基本要件は [`COMMUNICATTION.md`](COMMUNICATTION.md) に従う。本書は、それらを満たすための**観測機側ストレージ仕様**を定める。

基本原則は以下とする。

- 観測原本は append-only とし、通常運用で書き戻さない。
- 通信断や電源断が測定そのものを止めないようにする。
- データ消失より重複送信を許容し、重複は `messageId` とDB一意制約で排除する。
- 研究データである `data/` を容量都合で自動削除しない。
- 正しい絶対時刻が得られない場合、偽の日時を生成しない。

## 2. SDカード

| 項目 | v1仕様 |
| --- | --- |
| メディア | microSD |
| 標準容量 | 32 GB |
| ファイルシステム | FAT32 |
| 推奨カード | High Endurance / Industrial 系 |
| 観測周期 | 1 Hz |
| 保存形式 | NDJSON（1観測 = 1行） |
| 基本書込方式 | append-only |

64 GB以上やexFATは将来必要になった場合に再評価する。v1では互換性と実装単純性を優先して32 GB FAT32を標準とする。

## 3. ディレクトリ構成

```text
/
├─ data/
│  ├─ YYYYMMDD.ndjson
│  └─ unsynced/
│     └─ boot-NNNNNN.ndjson
├─ outbox/
│  └─ YYYYMMDD.ndjson
├─ delivery/
│  └─ YYYYMMDD.ndjson
├─ rejected/
│  └─ YYYYMMDD.ndjson
└─ system/
   ├─ boots.ndjson
   ├─ time-sync.ndjson
   ├─ communication.ndjson
   └─ emergency.reserve
```

役割:

- `data/`: 観測原本。自動削除・書き換えをしない。
- `data/unsynced/`: 絶対時刻が未確定の観測原本。
- `outbox/`: APIへ送信可能な確定済みレコードのFIFOキュー。
- `delivery/`: API処理完了済み範囲のジャーナル / checkpoint。
- `rejected/`: 行単位でAPIに拒否されたデータと理由。
- `system/`: 起動、時刻同期、通信、ストレージ障害等のシステムイベント。

## 4. 観測レコード

### 4.1 保存形式

NDJSONを使用し、1行を独立したJSONオブジェクトとする。

```text
{観測1}\n
{観測2}\n
{観測3}\n
```

JSON配列としてファイル全体を構成しない。電源断で最終行が途中までしか書かれなかった場合、最後の不完全行だけを無効として扱える構造にする。

### 4.2 SD専用管理項目

| 項目 | 用途 |
| --- | --- |
| `bootSequence` | 機体の起動回を識別する単調増加番号 |
| `localSequence` | 観測原本の機体内連番 |
| `monotonicMs` | 当該起動からの経過時間 |
| `timeSource` | `gnss` / `internal` / `lte_m` / `unsynced` |
| `timeSyncAgeMs` | 最終絶対時刻同期からの経過時間。取得可能な場合に保存 |
| `outboxSequence` | API送信可能になったレコードのFIFO連番 |

`localSequence` は研究原本の追跡用、`outboxSequence` は再送位置を単純化するための送信キュー用番号として分離する。

### 4.3 APIと共通する主な項目

送信可能な観測は、`API_DATABASE_AUTH.md` のcamelCase契約に合わせ、少なくとも次の項目を必要に応じて保持する。

```text
schemaVersion
messageId
observedAt
latitude
longitude
altitude
satellites
gnssTimestamp
fixStatus
hdop
waterTemperature
ph
ec
airTemperature
humidity
airPressure
batteryVoltage
communicationStatus
measurementStatus
waterTemperatureSensorId
phSensorId
ecSensorId
waterTemperatureCalibrationId
phCalibrationId
ecCalibrationId
```

`qualityFlag` はサーバー側で管理するため、観測機が確定値として送信しない。

## 5. 時刻仕様

### 5.1 優先順位

v1では以下の順で絶対時刻を扱う。

1. L76K GNSSの有効な時刻を基準時刻として採用し、内部時計を同期する。
2. GNSSを一時的に取得できない場合、すでに同期済みの内部時計をholdoverとして使用する。
3. 内部時計が未同期で、LTE-M経由で信頼できるネットワーク時刻を取得できる場合は補助同期に使用する。
4. いずれも利用できない場合は `timeSource = "unsynced"` とし、偽の絶対日時を付与しない。

### 5.2 未同期観測

絶対時刻がない観測は次のように保存する。

```json
{"bootSequence":123,"localSequence":38291,"monotonicMs":1520,"timeSource":"unsynced","waterTemperature":24.8,"ph":7.12,"ec":326.4}
```

保存先は次とする。

```text
data/unsynced/boot-000123.ndjson
```

同じ起動中に絶対時刻を取得できた場合、`monotonicMs` の差から同期前観測の `observedAt` を復元できる。

時刻同期イベントは `system/time-sync.ndjson` へ即時記録する。

```json
{"bootSequence":123,"monotonicMs":20000,"syncedAt":"2026-08-16T01:40:20Z","source":"gnss"}
```

同期前に完全な電源断が発生し、後から絶対時刻を確定できない観測は原本として保持するが、自動でAPIへ送信しない。

### 5.3 `messageId` の未同期時例外

通常は観測時にUUID v7 `messageId` を生成する。

ただし絶対時刻未同期時は、`bootSequence` + `localSequence` をローカル識別子として先に保存し、絶対時刻を復元した後、**outboxへ登録する前に** `observedAt` とUUID v7 `messageId` を確定する。

したがってAPIへ送信されるレコードは常に有効な `observedAt` とUUID v7 `messageId` を持つ。未解決の `unsynced` レコードをそのままAPIへ送らない。

## 6. ファイルローテーション

- 日付基準はUTCとする。
- 通常データは `YYYYMMDD.ndjson` とする。
- UTC 00:00で次の日付ファイルへ切り替える。
- 日付切替前に現在のファイルをflushして閉じる。
- Web表示時に必要に応じてJSTへ変換する。

例:

```text
2026-08-16T23:59:59Z → data/20260816.ndjson
2026-08-17T00:00:00Z → data/20260817.ndjson
```

## 7. バッファ・flush・電源断

### 7.1 通常観測

- センサー取得: 1 Hz
- SD保存対象生成: 1 Hz
- RAMバッファ: 最大5観測
- `data/` / `outbox/` flush: 5秒または5件の早い方
- 突然の電源断による未flush観測データ損失: **最大5秒以内を設計目標**とする。

### 7.2 即時flushするイベント

次は通常の5秒周期を待たず即時flushする。

- `delivery/` へのAPI処理完了記録
- `rejected/` への拒否理由記録
- `system/time-sync.ndjson` の時刻同期イベント
- `system/boots.ndjson` の起動イベント
- UTC日付切替前
- 正常シャットダウン / 再起動前
- ファイルを閉じる前

### 7.3 起動時のファイル復旧

各append-onlyファイルの末尾を検査し、最後の行が完全なJSONとして解析できない場合、その不完全行を無効として扱う。

それ以前の正常行は維持する。破損を理由にファイル全体を削除しない。

## 8. Outboxと再送状態

### 8.1 状態

送信対象は論理的に3状態だけを持つ。

| 状態 | 意味 | 自動再送 |
| --- | --- | --- |
| `PENDING` | サーバー処理完了をまだ確認していない | する |
| `DELIVERED` | APIが `accepted` または `duplicate` と処理した | しない |
| `REJECTED` | APIが行単位で明確に拒否した | しない |

「HTTPリクエストを送った」だけでは `DELIVERED` にしない。

### 8.2 FIFO送信

- `outboxSequence` の小さい順に送る。
- 1バッチ最大200件とする。
- 同時に複数バッチを確定処理せず、前バッチの結果が確定してから次へ進む。
- batch内の `accepted + duplicate + rejected` が送信件数と一致した場合だけ、そのbatchをterminalとして扱う。

### 8.3 Delivery journal

APIが200件をすべてterminalにしたら、`delivery/` へcheckpointをappendして即flushする。

例:

```json
{"batchId":"0198...","firstOutboxSequence":1001,"lastOutboxSequence":1200,"accepted":198,"duplicate":1,"rejected":1,"finalizedAt":"2026-08-16T01:50:20Z"}
```

`accepted` と `duplicate` はどちらも再送不要とする。

### 8.4 Rejected journal

行単位で拒否された観測は `rejected/` に理由を保存する。

```json
{"outboxSequence":1087,"messageId":"0198...","reason":"ph out of range","rejectedAt":"2026-08-16T01:50:20Z"}
```

`REJECTED` を自動で無限再送しない。観測原本は `data/` に残し、必要であれば人間が原因確認後に再処理する。

## 9. 再起動後の再送開始位置

再起動時は `delivery/` の最後の**正常なcheckpoint行**を読む。

```text
lastOutboxSequence = N
再送開始 = N + 1
```

例:

```text
最後の確定: 1200
再送開始:   1201
```

サーバー保存後、delivery書込前に電源断した場合は同じデータを再送する。この場合、DBの `(device_id, message_id)` 一意制約により `duplicate` として処理されるため、データ増殖を許さない。

最後のdelivery行が電源断で不完全な場合、その行を無視して1つ前の正常checkpointから再送する。

## 10. 通信エラー時の処理

| 結果 | v1処理 |
| --- | --- |
| `accepted` | `DELIVERED` |
| `duplicate` | `DELIVERED` |
| 行単位 `rejected` | `REJECTED`、理由保存 |
| LTE-M圏外 | `PENDING` 維持 |
| timeout | `PENDING` 維持 |
| HTTP 429 | `Retry-After` を尊重して再試行 |
| HTTP 5xx | バックオフして再試行 |
| HTTP 401 / 403 | 通信送信を停止し認証異常として記録。測定・SD保存は継続 |
| HTTP 400 / 413 / batch-level 422 | 実装・設定異常として送信を停止し、checkpointを進めない |

ネットワーク系失敗時の初期バックオフは以下を基準とする。

```text
10秒 → 30秒 → 60秒 → 300秒 → 600秒
```

最大600秒を上限とし、通信障害中も1 Hzの測定・SD保存は継続する。

## 11. 容量管理・保持ポリシー

### 11.1 保持

| ディレクトリ | 保持方針 |
| --- | --- |
| `data/` | 観測原本。自動削除禁止 |
| `outbox/` | 全件terminal後7日保持し、その後削除可能 |
| `delivery/` | 保持 |
| `rejected/` | 保持 |
| `system/` | 保持 |

`outbox/` は通信キャッシュであり、同じ観測原本が `data/` に残り、かつ対象ファイルの全件がterminalであることを確認してから削除可能とする。

### 11.2 空き容量状態

| 状態 | 空き容量 |
| --- | --- |
| `NORMAL` | 20%以上 |
| `WARNING` | 10%以上20%未満 |
| `CRITICAL` | 5%以上10%未満 |
| `FULL` | 5%未満、または書込不能 |

起動時および定期的に容量を確認する。

### 11.3 容量不足時

- `data/` の古い観測原本を自動削除しない。
- `CRITICAL` では未送信outboxの送信を優先する。
- 全件terminalかつ7日保持済みのoutboxは削除可能とする。
- debug等の非必須ログは抑制可能とする。
- `FULL` でもセンサー取得処理そのものは可能な限り継続する。
- SDへ保存できずLTE-Mが利用可能な場合は、degraded modeとして現在観測のAPI送信を試みる。
- SD保存もAPI送信もできない観測は永続化できないため、復旧後に欠測として扱えるよう障害情報を可能な範囲で記録する。

## 12. 緊急予約領域

初期セットアップ時に次の予約ファイルを128 MB確保する。

```text
system/emergency.reserve
```

通常時は使用しない。容量逼迫時にこのファイルを削除して緊急用空き領域を確保し、ストレージ障害・最後に正常保存したsequence等の重要イベント記録に使用できるようにする。

予約領域の解放は `CRITICAL` / `FULL` 時の一度限りの緊急処置とする。

## 13. v1受け入れ条件

ストレージ実装は少なくとも以下を満たすこと。

1. 1 Hz観測をNDJSONとして保存できる。
2. 5秒または5件ごとにflushし、通常の突然電源断で失う未flush観測を最大5秒以内に抑える設計である。
3. 最終行が途中で切れたファイルから、それ以前の正常レコードを復旧できる。
4. GNSS/LTE-M時刻がない起動でも偽日時を作らず観測原本を保存できる。
5. 後から時刻を解決した観測を `outbox` へ登録し、API契約に適合する `observedAt` / UUID v7 `messageId` を持たせられる。
6. 通信断中も測定・保存を継続できる。
7. API応答を失った場合に同じ `messageId` を再送し、DB重複防止で1件だけ保存される。
8. `accepted` / `duplicate` / `rejected` が確定したbatchだけcheckpointを進める。
9. 再起動後に最後の正常 `lastOutboxSequence + 1` から再送できる。
10. `data/` を容量都合で自動削除しない。
11. SD満杯・書込失敗を観測機全体の停止とせず、degraded modeへ移行できる。

## 14. 実装順序

実装は次の順で進める。

1. NDJSON append writer
2. `bootSequence` / `localSequence` 管理
3. 5件バッファとflush
4. 起動時の末尾破損復旧
5. UTC日次ローテーション
6. unsynced保存と時刻同期ジャーナル
7. outbox生成
8. delivery / rejected journal
9. 再起動checkpoint復旧
10. 容量監視・緊急予約領域
11. LTE-M再送処理との統合
