/**
 * プロンプト構成。
 *
 *   system（安定・prompt cache 対象）: 役割 / 絶対禁止事項 / 全フェーズ設計 / ガードレール / 勝ちフレーズ
 *   mid-conversation system（毎ターン変化）: 現在フェーズ / 状態 / 未取得スロット / 差し戻し理由
 *
 * 可変部を top-level system に混ぜるとキャッシュのプレフィックスが毎ターン壊れるため、
 * 変化する状態はすべて messages 末尾の system メッセージ側に置く。
 */
import { PHASES, PHASE_ORDER, WINNING_PHRASES } from "../domain/phases.js";
import { GUARDRAILS } from "../domain/guardrails.js";
import { forbiddenRulesPrompt } from "../domain/forbidden.js";
import { HEARING_SLOT_MAP, HEARING_SLOTS } from "../domain/hearing.js";
import { missingContact, missingHearing, type CallState } from "../domain/state.js";
import type { GuardrailId, PhaseId } from "../domain/types.js";
import { DEMO_SCENARIO, type Scenario } from "../demo/scenario.js";

function phaseBlock(id: PhaseId): string {
  const p = PHASES[id];
  const must = p.mustSay.map((s) => `    - 【必】${s}`).join("\n");
  const cond = p.conditional.map((c) => `    - 【条】${c.when} → ${c.say}`).join("\n");
  const pri = p.principles.map((s) => `    - ${s}`).join("\n");
  return [
    `### ${p.id} ${p.label}`,
    `  目標: ${p.goal}`,
    must ? `  必須発話:\n${must}` : "",
    cond ? `  条件発話:\n${cond}` : "",
    pri ? `  設計原則:\n${pri}` : "",
    `  遷移: ${p.transition}`,
    `  遷移可能な次フェーズ: ${p.allowedNext.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 毎ターン同一（= prompt cache が効く）システムプロンプト。 */
export function buildSystemPrompt(sc: Scenario = DEMO_SCENARIO): string {
  return `あなたは ${sc.agentOrg} の架電担当「${sc.agentName}」です。企業へ電話をかけ、企業型確定拠出年金（企業型DC）の説明のためのオンライン商談アポイントを獲得します。

# あなたの立場（誤認防止のため最重要）
- 企業型確定拠出年金という「制度」は厚生労働省が管轄しています。
- ただし、あなた自身は公的機関の人間ではありません。制度の導入を支援する民間の事業者です。
- この2つは必ずセットで、同じ一息で言い切ってください。片方だけ名乗ることは禁止です。

# 通話の前提
- 架電先: ${sc.companyName}（従業員${sc.employeeCount}名・役員${sc.officerCount}名）
- 相手: ${sc.contactTitle}の${sc.contactName}様
- 状況: ${sc.situation}
- ゴール: ${sc.proposedDate} ${sc.proposedTime} からの Zoom 商談（${sc.meetingMinutes}分）を確定させ、ヒアリング7項目をすべて取得すること
- 当日の担当: ${sc.partnerOrg}の有資格プランナー

# 絶対禁止事項（1つでも破ると失敗とみなす）
${forbiddenRulesPrompt()}

さらに:
- 「いつがよろしいですか？」のような開いた日程質問は禁止。必ず2択で聞いてから1点に絞る。
- 相手が忙しいと言っているときに、新しい制度説明を被せることは禁止。
- 税理士・社労士など他の専門家を下げる発言は禁止。
- 「◯◯」「××」のようなプレースホルダを発話に残すことは禁止。名乗りは必ず「${sc.agentName}」。

# 発話のルール
- 電話での話し言葉として自然な日本語で書く。読み上げてそのまま使える形にする。
- 1回の発話は原則3文以内・150字以内。相手に喋らせることを優先する。
- 箇条書き・記号・絵文字・見出しは使わない。
- 説明を積み増すより、質問で終えて相手に話させる方を常に選ぶ。
- 相手の発言はまず受け止めてから返す。否定や反論から入らない。

# 会話フロー全体像
${PHASE_ORDER.join(" → ")} → END
（P0 で受付が強固に拒否した場合のみ P0X で痕跡を残して終話）

# フェーズ別設計
${Object.values(PHASES)
  .filter((p) => p.id !== "END")
  .map((p) => phaseBlock(p.id))
  .join("\n\n")}

# ガードレール（該当したら必ずこの通りに振る舞う）
${Object.values(GUARDRAILS)
  .map((g) => `- 【${g.id}】トリガー: ${g.trigger}\n    挙動: ${g.behavior}`)
  .join("\n")}

# ヒアリング7項目（P8。1つも落とさない）
${HEARING_SLOTS.map(
  (s) =>
    `- ${s.id} ${s.label}${s.critical ? "【最重要・欠落厳禁】" : ""}: 「${s.question}」`,
).join("\n")}
加えて、メールアドレス（必ず復唱確認）、前日確認の連絡先、前日連絡の希望時間帯を取得します。

# 実データで実際に効いた言い回し（積極的に使う）
${WINNING_PHRASES.map((w) => `- 「${w.phrase}」… ${w.effect}`).join("\n")}

# 出力
指定された JSON スキーマに従って出力してください。utterance には、いま電話口で話す1回分の発話だけを入れます。相手のセリフを含めてはいけません。`;
}

export interface BriefingInput {
  state: CallState;
  detectedGuardrails: GuardrailId[];
  /** 前回の遷移却下理由や、フィルタ差し戻しの指示 */
  corrections: string[];
}

/** 毎ターン変化する状態ブリーフィング（mid-conversation system message として渡す）。 */
export function buildStateBriefing({
  state,
  detectedGuardrails,
  corrections,
}: BriefingInput): string {
  const p = PHASES[state.phase];
  const lines: string[] = [];

  lines.push(`# 現在のフェーズ: ${p.id} ${p.label}`);
  lines.push(`目標: ${p.goal}`);
  lines.push(`遷移条件: ${p.transition}`);
  lines.push(`next_phase に指定できる値: ${[p.id, ...p.allowedNext].join(", ")}`);

  if (p.mustSay.length > 0) {
    lines.push("");
    lines.push("このフェーズで必ず言うこと:");
    lines.push(...p.mustSay.map((s) => `- ${s}`));
  }

  lines.push("");
  lines.push("# 通話状態");
  lines.push(`- 法改正フック（P4）: ${state.lawChangeHookUsed ? "使用済み。二度と使わない。" : "未使用"}`);
  lines.push(
    `- 商談日時: ${state.appointmentDate && state.appointmentTime ? `${state.appointmentDate} ${state.appointmentTime}` : "未確定"}`,
  );
  lines.push(
    `- Zoom 同意: ${state.zoomAgreed ? "済" : "未"} / ${DEMO_SCENARIO.meetingMinutes}分の同意: ${state.durationAgreed ? "済" : "未"}`,
  );
  lines.push(`- 決裁権: ${state.isDecisionMaker}`);
  lines.push(`- 発火済みガードレール: ${state.firedGuardrails.join(", ") || "なし"}`);

  const missH = missingHearing(state);
  const missC = missingContact(state);
  lines.push("");
  lines.push("# ヒアリング取得状況");
  for (const s of HEARING_SLOTS) {
    const v = state.hearing[s.id];
    lines.push(`- ${s.id} ${s.label}: ${v ? `取得済み（${v}）` : "未取得"}`);
  }
  lines.push(`- メールアドレス: ${state.email ? `${state.email}（復唱${state.emailConfirmed ? "済" : "未"}）` : "未取得"}`);
  lines.push(`- 前日連絡先: ${state.callbackPhone ?? "未取得"}`);
  lines.push(`- 前日連絡の希望時間帯: ${state.callbackWindow ?? "未取得"}`);

  if (state.phase === "P8") {
    if (missH.length > 0 || missC.length > 0) {
      const next = missH[0];
      lines.push("");
      lines.push("【P8 の指示】未取得の項目が残っています。P9 へは進めません。");
      if (next) {
        const def = HEARING_SLOT_MAP.get(next);
        lines.push(`次に聞くべき項目: ${next} ${def?.label} → 「${def?.question}」`);
      } else if (missC.length > 0) {
        lines.push(`次に取るべき情報: ${missC[0]}`);
      }
      lines.push(`残りの未取得: ${[...missH, ...missC].join(" / ")}`);
      lines.push("1回の発話で質問するのは最大2つまでにしてください。");
    } else {
      lines.push("");
      lines.push("【P8 の指示】全項目が揃いました。next_phase を P9 にして締めに入ってください。");
    }
  }

  if (detectedGuardrails.length > 0) {
    lines.push("");
    lines.push("# 直前の相手発話で検知したガードレール（必ず従う）");
    for (const id of detectedGuardrails) {
      lines.push(`- 【${id}】${GUARDRAILS[id].behavior}`);
    }
  }

  if (corrections.length > 0) {
    lines.push("");
    lines.push("# 差し戻し（前回の出力は相手に届いていません。必ず修正して出し直してください）");
    lines.push(...corrections.map((c) => `- ${c}`));
  }

  return lines.join("\n");
}
