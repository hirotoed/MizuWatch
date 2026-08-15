# MizuWatch プロジェクト方針

この文書は、MizuWatchで「何を作るか」「今どこまで進んでいるか」
「次に何を優先するか」を判断するための正本です。
実装や個別のREADMEと内容が矛盾する場合は、推測で進めず、この文書と
ユーザーの最新の明示指示を基準に確認します。

最終更新: 2026-08-15

## 1. プロジェクトの目的

MizuWatchは、河川・湖・ため池などの水域を低コストかつ継続的に観測し、
複数の観測機から集めた位置情報と環境データを、Web上で確認・管理できる
水上環境観測システムを構築するプロジェクトです。

最終的に実現する一連の流れは次のとおりです。

1. 観測機がGPS、水温、気温、湿度、気圧などを取得する。
2. 通信可能な場合はLTE-M経由で正式APIへ送信する。
3. 通信できない場合はSDカードへ保存し、復旧後に未送信分を再送する。
4. APIサーバーがデータを検証し、データベースへ保存する。
5. Web観測アプリが正式APIから複数機体の現在位置、軌跡、センサー履歴を取得して表示する。
6. 基本的な観測基盤の完成後、蓄積データを異常検知などへ活用する。

## 2. 本番システムの基本構成

```text
観測機
  ├─ センサー / GPS
  ├─ LTE-M通信
  └─ SDカード（通信圏外時の一時保存）
          ↓
正式なデータ受信API
          ↓
データ検証・重複防止
          ↓
データベース
          ↓
Web観測アプリ
```

正式API、データベース、認証には東京リージョンのSupabaseを採用します。
APIはEdge Functions、DBはPostgreSQL、Web利用者認証はSupabase Authを使用し、
観測機は機体ごとのtokenで受信APIへ接続します。詳細は
[`API_DATABASE_AUTH.md`](API_DATABASE_AUTH.md) を基準とします。

## 3. 決定済み事項

- 編集・開発対象は `hirotoed/MizuWatch` とする。
- Tritonの `Visualize_Data_webAPP` は参考資料であり、開発対象ではない。
- 本番の通信経路は、観測機から正式APIを経由してデータベースへ保存する構成とする。
- Web観測アプリはデータ取得先を交換可能にし、特定の一時バックエンドへ直接依存させない。
- Google Apps Script（GAS）は過去の検証・移行用資産として扱い、今後の本番構成には採用しない。
- GASに関する作業は2026-08-15時点で終了済みとし、明示的な方針変更がない限り再開しない。
- GASの新機能追加、GAS移行の完成、旧GAS互換機能の拡張は行わない。
- 既存GASコードは、正式APIまたはモックへの切り替えが完了するまで壊さず保持し、切り替え後に削除または `legacy` として隔離する。
- 通信圏外のデータはSDカードへ保持し、通信復旧後に再送できるようにする。
- 正式APIはSupabase Edge Functions（TypeScript）、データベースはSupabase
  PostgreSQL、Web利用者認証はSupabase Authを採用する。
- Supabase projectは東京リージョン（`ap-northeast-1`）に配置し、Webアプリは
  当面GitHub Pagesで公開する。
- Web利用者は招待制のメールアドレス + パスワード認証とし、機体単位の
  `viewer` / `admin` 権限をRLSで適用する。
- 観測機は機体ごとに発行する256 bit tokenで認証し、平文をDBへ保存しない。
- 観測値のUUID v7 `messageId` と `(device_id, message_id)` 一意制約によって、
  SDカードからの再送を冪等にする。

## 4. 現在地

### できているもの

- Raspberry Pi Pico Wを使った試作・センサー取得コード
- GPS、温湿度、気圧、水温データを扱う過去の実験資産
- 複数機体の地図、軌跡、センサーグラフを表示するReactアプリ
- GASに接続せず3機体の時系列モックデータで動作するReactアプリ
- 画面から独立した `VehicleDataSource` 契約とモックデータソース
- Supabase PostgreSQLのschema、制約、index、RLSを再現するSQL migration
- 機体token認証、行単位検証、レート制限、冪等保存を行う受信Edge Function
- Supabase Auth JWTとRLSで許可機体だけを返す取得Edge Function
- Supabase Authログインと取得APIへ接続する正式 `VehicleDataSource`
- DB、Edge Function、Web adapterを検証する自動テストとCI
- Tokyo (`ap-northeast-1`) のSupabase project `wkpcfgqraemcmdcrejle`
- hosted projectへ適用済みの初期migrationと2つのEdge Function
- 受信、冪等再送、Supabase Auth、RLS、取得APIを通すhosted統合試験
- GitHub Actions Repository Variablesの正式Supabase接続設定
- SDカード読み書きなどの要素試験コード
- GASを利用した過去のデータ送受信の検証

### 未完成または未実装のもの

- 実運用する招待ユーザー、機体、権限、credentialの初期登録
- 現在のWeb/Backend変更をGitHubへ反映した後のPages deployと画面確認
- LTE-Mモジュールの選定と実機通信
- 本番用の電源・PCB・防水構成
- システム全体を通した実証試験

### 現在の問題

ReactアプリはGAS非依存化を完了し、外部バックエンドなしで複数機体の表示、
グラフ、エクスポートを確認できるようになりました。Google Maps表示のみ、
従来どおりMaps JavaScript APIキーを必要とします。

正式APIのmigration、受信・取得Edge FunctionはTokyoリージョンのprojectへ
deploy済みです。一時Authユーザーと機体credentialを使ったhosted統合試験で、
受信、重複再送、RLS、取得APIまで確認しました。ローカルWebとGitHub Actionsの
Repository Variablesは `VITE_VEHICLE_DATA_SOURCE=supabase` へ切り替え済みです。
次の課題は実運用する招待ユーザーと機体を登録し、現在のローカル変更をGitHubへ
反映した後、Pages上でログイン、地図、グラフ、exportを確認することです。
旧GAS資産はWebアプリの実行経路外にあり、過去の検証資産としてのみ保持します。

## 5. 現在の優先順位

### Now: 実運用の初期登録とWeb公開確認を行う

1. 実運用するWeb利用者を招待し、機体、権限、credentialを初期登録する。
2. 現在のWeb/Backend変更をレビューしてMizuWatchへcommit・pushする。
3. GitHub Pagesの正式データソースbuildをdeployする。
4. 招待ユーザーでログインし、地図・グラフ・exportを確認する。

### Next: 実機から正式経路を検証する

1. ファームウェアを正式受信APIへ接続する。
2. SDカードからの再送とUUID v7による重複防止を実機確認する。
3. LTE-Mでの送信成功率、受信遅延、電力消費を測定する。
4. 正式APIへの切り替え確認後、GAS資産を `legacy` として隔離する。

### Later: 実機運用を成立させる

1. LTE-M実機送信を実装・検証する。
2. SDカードへの未送信保存と再送・重複防止を完成させる。
3. 電源、PCB、防水を含めた実証機を完成させる。
4. 長期計測と異常検知へ進む。

## 6. 今は行わないこと

- GASバックエンドの完成度を上げる作業
- 旧GASデータ移行への追加投資
- 正式な保存・取得経路がない段階での機械学習機能開発
- 決定済みの正式仕様を外れた別バックエンドの並行実装
- Triton側への変更
- 現在の優先課題と関係しない見た目や機能の追加

## 7. 未決定事項

以下は候補調査と比較後、ユーザーの確認を得て決定します。

- 通信間隔、再送回数、タイムアウト
- LTE-Mモジュールと通信事業者
- 1年を超えたテレメトリーのアーカイブ先と最終保存年限
- GitHub Pagesから独自ドメインへ移す時期

決定した内容は、この文書の「決定済み事項」へ移し、関連実装と
ドキュメントを同じ作業内で更新します。

## 8. 作業の進め方

各作業を始める前に、最低限、次を明確にします。

- 今回達成すること
- プロジェクト目的とのつながり
- 変更する範囲と変更しない範囲
- 完了と判断できる条件

作業中に別の問題を見つけても、現在の目的に必須でなければ勝手に作業範囲を
広げません。優先順位や本番構成と衝突する場合は、実装を止めてユーザーへ
衝突点を具体的に伝えます。

作業完了時には、次を確認します。

- 何が変わったか
- どの確認・テストを行ったか
- 未完了事項と次に行うべきこと
- この文書の「現在地」または優先順位を更新する必要があるか
- 次にやることのリストアップ（AIと人間が行うことの区別も）

## 9. 他の文書との役割分担

- この文書: プロジェクト全体の目的、決定、現在地、優先順位
- `SPEC.md`: 決定済みのシステム仕様
- `COMMUNICATTION.md`: 通信・再送仕様
- `HARDWARE.md`: ハードウェア構成
- `TEST_PLAN.md`: 実証・受け入れ試験
- `DEVELOPMENT_LOG.md`: 実施済み作業の時系列記録
- 各ディレクトリのREADME: その部分の導入・実行方法

個別文書は、この文書の本番方針を上書きしません。
