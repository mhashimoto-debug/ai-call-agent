# BPSR 企業型DC アポ獲得 AI架電エージェント（プレデモ v1.0）

`docs/2026-09-10_プレデモ_勝ちパターン会話フロー設計.md` の会話設計を、そのまま実行可能にした実装です。

## 設計思想

**LLM に会話設計を任せない。** LLM が担当するのは「その場の1発話をつくること」だけで、
デモで証明したい3点（G1〜G3）はすべて決定論的なコードで担保しています。

| 証明したいこと | 実装での担保 |
|---|---|
| G1 断りを終話ではなく質問に変換する | `src/domain/guardrails.ts` — R1/R3/R4/R5 発火中は終話への遷移をコードが却下する |
| G2 ヒアリング7項目を100%取り切る | `src/domain/state.ts` — H1〜H7・メール復唱・前日連絡先が揃うまで P8→P9 の遷移を機械的にブロック |
| G3 禁止ワードを踏まない | `src/domain/forbidden.ts` — 生成前制約＋出力前フィルタ。自動修正 → 再生成 → 定型文フォールバックの3段で、禁止表現は相手に届かない |

## 構成

```
src/
  domain/      設計書 §4〜§7 のデータ化と検証ロジック（LLM 非依存・全ユニットテスト対象）
    phases.ts      P0〜P9 のフェーズ定義（目標・必須発話・遷移可能先）＝ 設計書との単一の対応点
    guardrails.ts  R1〜R7
    forbidden.ts   §6 禁止ワード・言い換え表 → 出力前フィルタ
    hearing.ts     H1〜H7 のスロット定義
    state.ts       通話状態と遷移検証（P8→P9 のブロックはここ）
    dod.ts         §7 アポ成立判定
  llm/
    prompt.ts      system（キャッシュ対象・不変）と状態ブリーフィング（毎ターン可変）の分離
    schema.ts      1ターン分の構造化出力スキーマ
    agent.ts       生成 → フィルタ → 遷移検証 → 状態マージ
  demo/
    scenario.ts       架空企業・応対者の設定（すべてプレースホルダ）
    customerScript.ts 客役の固定台本（設計書 §8-1）。dry-run 用に各行が
                      advanceTo（遷移先）/ agentSays（条件発話）/ agentSilent（取次ぎ）を持つ
  report/          DoD チェックリストと人間の実施率との比較
  cli/main.ts      デモ実行（CLI）
  web/             Web フロントエンド（描画と再生制御のみ。会話ロジックは持たない）
web/index.html     Web プロトタイプの外枠（app.js は build:web が生成）
```

## 実行

```bash
npm install

# 認証（いずれか）
cp .env.example .env   # .env に ANTHROPIC_API_KEY を書く（.env は gitignore 済み・推奨）
export ANTHROPIC_API_KEY=sk-ant-...
ant auth login

npm run demo      # 台本モード。Enter で1ターンずつ進む（本番のデモはこれ）
npm run demo -- --auto   # Enter 待ちなしで通しで流す
npm run manual    # 客役の返答を自分で打つ（アドリブ耐性の確認用）
npm run dryrun -- --auto # API を呼ばず定型文だけで通す（オフライン練習・回線不安時の保険）

npm test          # 31 件。禁止ワード・遷移ブロック・DoD・モック再生の回帰テスト
npm run typecheck
```

### Web プロトタイプ（オフラインで動作）

```bash
npm run web       # ビルドして http://localhost:8080 で配信
```

会話ログの横に、フェーズ進行・ヒアリング7項目・DoD チェックリスト・人間の実施率との比較・
ガードレール発火が**同時にリアルタイムで埋まっていく**画面です。
設計書 §8 の提示順（①フロー ②通話デモ ③DoD 充足結果）を1画面で見せられます。

- 「▶ 次のターン」で1ターンずつ、「⏩ 自動再生」で通しで再生
- 「音声で読み上げる」を ON にすると AI 側の発話を Web Speech API で読み上げます
- ビルド済みの `web/app.js` をコミットしてあるため、サーバを立てずに
  `web/index.html` を直接ブラウザで開いても動きます（デモ当日の保険）

**ブラウザ音声デモへの拡張点**は `src/web/main.ts` の2箇所だけです。

| 拡張 | 差し替える場所 |
|---|---|
| 相手の音声入力 | `MockCallEngine.step()` → `SpeechRecognition` で拾った発話を渡す |
| AI 応答を実 LLM に | `MockCallEngine.step()` → `CallAgent.respond()`（API キーが必要） |

`domain/` のフロー・ガードレール・DoD 判定はどちらの拡張でもそのまま再利用されます。

実行するたび `reports/call-<日時>.md` に通話レポート（DoD チェックリスト・会話ログ・
遮断した禁止表現・人間の実施率との比較）を書き出します。デモの提示順 ③ にそのまま使えます。

## モデル設定

`claude-opus-5` / adaptive thinking / effort=medium。環境変数で変更できます。

```bash
CALL_AGENT_MODEL=claude-opus-5
CALL_AGENT_EFFORT=medium   # low | medium | high | xhigh | max
```

会話設計（system プロンプト）は毎ターン不変にして prompt cache に載せ、
変化する状態は messages 末尾の system メッセージで渡しています。

## 9/10 前に必ずやること

- [x] ~~法改正の数値を一次情報で確認~~ → **2026-09-08 確認済み**。
      2026年12月1日施行、企業型DC の月額拠出限度額 55,000円 → 62,000円。
      記載箇所は `src/domain/phases.ts` の P4 の1箇所のみ。
- [ ] `npm run demo` を通しで1回実行し、レポートの DoD が全項目○になることを確認
- [ ] 回線・API 障害時の保険として `npm run dryrun -- --auto` の動作も確認

## v1.0 のスコープ外（設計書 §9）

受付の強固なブロック突破、再架電・既存接点先の日程再設定、複数制度併用者への詳細比較、
資料送付のみからのナーチャリングは実装していません。
電話回線（Twilio 等）も次フェーズです。ブラウザ音声は AI 側の読み上げ（TTS）まで実装済みで、
相手側の音声入力（STT）が未実装です。

## 現在の動作モード

**API キーなしのオフライン・モック動作を v1.0 の確定形とします。**
発話は設計書の定型文・台本の指定台詞から生成し、Claude API は呼びません。
ただし**フェーズ遷移の検証・ヒアリング充足判定・DoD 判定・ガードレールは本番と同じコードを通る**ため、
デモで証明したい G1〜G3 はモックモードでもそのまま成立します。

実 LLM 応答（`npm run demo`）は実装済み・型検査済み・スタブでの単体テスト済みですが、
**実 API での応答品質は未検証**です。API キーを設定すれば同じ台本でそのまま動きます。
