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
  cli/main.ts      デモ実行
```

## 実行

```bash
npm install

# 認証（どちらか）
export ANTHROPIC_API_KEY=sk-ant-...
# もしくは  ant auth login

npm run demo      # 台本モード。Enter で1ターンずつ進む（本番のデモはこれ）
npm run demo -- --auto   # Enter 待ちなしで通しで流す
npm run manual    # 客役の返答を自分で打つ（アドリブ耐性の確認用）
npm run dryrun -- --auto # API を呼ばず定型文だけで通す（オフライン練習・回線不安時の保険）

npm test          # 27 件。禁止ワード・遷移ブロック・DoD の回帰テスト
npm run typecheck
```

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

- [ ] **法改正の数値を一次情報で確認**（2026年12月・月55,000円→62,000円）。
      現在の値は `src/domain/phases.ts` の P4 に1箇所だけ書いてあります。設計書 §10 の最大リスク。
- [ ] `npm run demo` を通しで1回実行し、レポートの DoD が全項目○になることを確認
- [ ] 回線・API 障害時の保険として `npm run dryrun -- --auto` の動作も確認

## v1.0 のスコープ外（設計書 §9）

受付の強固なブロック突破、再架電・既存接点先の日程再設定、複数制度併用者への詳細比較、
資料送付のみからのナーチャリングは実装していません。
音声（TTS/STT）・電話回線（Twilio 等）も次フェーズです。本実装はテキスト会話シミュレータで、
`src/llm/agent.ts` の `CallAgent.respond()` が音声層との接続点になります。
