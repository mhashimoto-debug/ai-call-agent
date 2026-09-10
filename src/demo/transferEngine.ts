/**
 * タイプB: 受付突破・人間引き継ぎモード。
 *
 * タイプA（アポ獲得）と違い、AI のゴールは商談化ではない。
 * 「担当者に代わってもらう」ところまでを AI が担当し、
 * 取次ぎの気配を検知したら即座に人間のオペレーターへ引き継ぐ。
 *
 * したがってこのモードでは、
 *   - 取次ぎを検知したら AI は一切喋らない（人間が話す前に AI の声が被らないようにする）
 *   - 不在・営業お断りは食い下がらず、記録を残して終話する
 * という2点を最優先にしている。
 */
import {
  ABSENT_NOW,
  ASK_PURPOSE,
  CONTACT_NAME_ASKED,
  CONTACT_UNKNOWN,
  REFUSE_SALES,
  RETURN_TIME,
  VOICE_LINES,
  audioUrl,
  type VoiceLineId,
} from "./dialogEngine.js";
import { detectGuardrails } from "../domain/guardrails.js";
import { autoFix, checkForbidden, type Violation } from "../domain/forbidden.js";
import type { GuardrailId } from "../domain/types.js";

/** 架電エージェントの動作モード。 */
export type AgentMode = "appointment" | "transfer";

export const AGENT_MODE_LABEL: Record<AgentMode, string> = {
  appointment: "タイプA: アポ獲得",
  transfer: "タイプB: 受付突破",
};

/** 受付突破の到達状態。 */
export type TransferOutcome = "calling" | "handover" | "absent" | "rejected";

export interface TransferReply {
  /** AI の発話。引き継ぎ時は空（人間に渡すため AI は喋らない）。 */
  utterance: string;
  audioFile?: string;
  /** どのルールで分岐したか（画面に出して「なぜこう返したか」を見せる） */
  matched: string;
  outcome: TransferOutcome;
  /** 担当者接続を検知したか。true なら画面で人間に引き継ぐ。 */
  handover: boolean;
  guardrails: GuardrailId[];
  blocked: Violation[];
}

/** 不在だったときの記録。次回架電のために残す。 */
export interface AbsenceRecord {
  /** 相手の発話そのまま */
  said: string;
  /** 聞き取れた戻り時間（「夕方」など）。取れなければ null。 */
  returnTime: string | null;
}

/**
 * 取次ぎ成功のサイン。
 *
 * 「少々お待ちください」のような保留の合図と、
 * 「私ですが」「担当の田中です」のような本人が出た合図の両方を拾う。
 * このモードでは取りこぼしのほうが損失が大きいので広めに取る。
 */
export const HANDOVER_PATTERNS: RegExp[] = [
  // 保留・取次ぎの合図
  /(少々|少し|しばらく|ちょっと)[^。]{0,4}お待ち/,
  /お待ちください/,
  /(お|御)?(繋ぎ|つなぎ)(し|いた|ます|します)/,
  /(繋|つな)ぎます/,
  /(代わ|かわ|替わ)(り|ります|りました|ります)/,
  /(呼んで|お呼びして)(まいり|参り|きます|まいります)/,
  /確認して(まいり|参り|きます|みます)/,
  /(ただいま|只今)[^。]{0,6}(代わ|お繋ぎ|つなぎ)/,
  // 本人・担当者が出た合図
  /(私|わたくし|わたし|僕|自分|当方)(です|ですが|ですけど|ですよ)/,
  /(私|わたくし|わたし|僕|自分|当方)が(担当|窓口|責任者|やって|見て)/,
  /(担当|窓口)(です|ですが|ですけど)/,
  /(私|わたくし|僕|自分|当方)で(お伺い|伺い|承り|お受け|大丈夫|結構)/,
  /(担当|責任者|窓口|代表|社長)の[^\s、。]{1,8}?(です|でございます)/,
  /(担当|責任者|代表|社長)(の者)?(です|でございます)/,
  /お電話代わりました/,
];

/**
 * 「担当者の名前は？」「誰に繋げばいいか分からない」という応答。
 *
 * ここで取次ぎ依頼や用件説明をそのまま繰り返しても相手は動けない。
 * 具体的な部署・役職を挙げて、取次ぎ先を決められる形にして返す必要がある。
 * 判定は タイプA と同じものを使う（受付の反応はモードによらないため）。
 */
export const UNKNOWN_CONTACT = CONTACT_UNKNOWN;

/**
 * 用件を重ねて確認された、と読む言い回し。
 * ASK_PURPOSE（「ご用件は？」）では拾えない「具体的な内容は？」のような聞き方を補う。
 */
const PURPOSE_FOLLOWUP = /(具体的|内容|詳し|中身|どんな話|なんの話|何の話|要する|どういうこと)/;

/** 取次ぎ成功のサインを検知する。 */
export function detectHandover(text: string): boolean {
  return HANDOVER_PATTERNS.some((p) => p.test(text));
}

/** 不在の申し出かどうか（R7 のうち「本人が今いない」だけを見る）。 */
export function detectAbsence(text: string): boolean {
  return detectGuardrails(text).includes("R7") && ABSENT_NOW.test(text);
}

export class TransferEngine {
  /** 用件説明をすでに1回行ったか。 */
  private purposeExplained = false;
  /** 取次ぎ依頼を言い直した回数。 */
  private retries = 0;
  /** 用件を問われた回数。 */
  private purposeAsks = 0;
  /** 具体的な部署・役職を提示済みか。 */
  private departmentSuggested = false;
  private outcome: TransferOutcome = "calling";
  private absence: AbsenceRecord | null = null;

  /** 通話が終わっている（引き継ぎ済み・終話済み）か。 */
  get finished(): boolean {
    return this.outcome !== "calling";
  }

  get result(): TransferOutcome {
    return this.outcome;
  }

  /** 不在だった場合の記録。 */
  get absenceRecord(): AbsenceRecord | null {
    return this.absence;
  }

  /** 架電開始の第一声（取次ぎ依頼）。 */
  greeting(): TransferReply {
    return this.say("greeting", "架電開始 → 担当者への取次ぎ依頼");
  }

  respond(customerText: string): TransferReply {
    const text = customerText.trim();
    const fired = detectGuardrails(text);

    // 1. 営業お断りは食い下がらない
    if (REFUSE_SALES.test(text)) {
      this.outcome = "rejected";
      return this.say("reject", "営業お断り → 引き延ばさず終話", fired);
    }

    // 2. 不在は記録だけ残して終話する（このモードでは粘らない）
    if (detectAbsence(text)) {
      this.outcome = "absent";
      this.absence = { said: text, returnTime: RETURN_TIME.exec(text)?.[0] ?? null };
      return this.say("reject", "不在 → 不在記録を残して終話", fired);
    }

    // 3. 取次ぎの気配を検知したら、AI は喋らずに人間へ渡す
    if (detectHandover(text)) {
      this.outcome = "handover";
      return {
        utterance: "",
        matched: "担当者接続を検知 → オペレーターへ引き継ぎ（AI の発話を停止）",
        outcome: "handover",
        handover: true,
        guardrails: fired,
        blocked: [],
      };
    }

    // 4. 「誰に繋げばいいか分からない」には、挨拶を繰り返さず具体的な取次ぎ先を挙げる
    if (UNKNOWN_CONTACT.test(text)) {
      if (!this.departmentSuggested) {
        this.departmentSuggested = true;
        // 名前を尋ねられている場合は「名前では答えられない」ことを先に伝える
        return CONTACT_NAME_ASKED.test(text)
          ? this.speak(
              "失礼いたしました！特定のお名前ではなく、人事・総務のご担当者様か代表者様にお繋ぎいただけますでしょうか？",
              "担当者名の確認 → 部署・役職を指定して取次ぎを再依頼",
              fired,
            )
          : this.speak(
              "失礼いたしました！総務や人事のご担当者様、あるいは代表者様（社長様）にお繋ぎいただけますでしょうか？",
              "担当不明 → 総務・人事・代表者を挙げて取次ぎを再依頼",
              fired,
            );
      }
      this.outcome = "rejected";
      return this.say("reject", "取次ぎ先が決まらず → 粘らず終話", fired);
    }

    // 5. 用件を問われたら説明する。重ねて聞かれても勝手に終話せず、取次ぎを促し直す
    if (ASK_PURPOSE.test(text) || PURPOSE_FOLLOWUP.test(text)) {
      this.purposeAsks++;
      if (this.purposeAsks === 1) {
        this.purposeExplained = true;
        return this.say("overview", "用件を問われた → 法改正の件として1回だけ説明", fired);
      }
      if (this.purposeAsks === 2) {
        return this.speak(
          "はい、御社の現在の制度導入状況についての簡単な確認でございます。恐れ入りますが、ご担当者様にお繋ぎいただけますでしょうか？",
          "用件を重ねて問われた → 内容を一言で示して取次ぎを再依頼",
          fired,
        );
      }
      this.outcome = "rejected";
      return this.say("reject", "用件説明を重ねても取次ぎに至らず → 粘らず終話", fired);
    }

    // 6. それ以外は取次ぎ依頼をもう一度だけ。粘らずに終話する
    this.retries++;
    if (this.retries >= 2) {
      this.outcome = "rejected";
      return this.say("reject", "取次ぎに至らず → 粘らず終話", fired);
    }
    return this.say("greeting", "取次ぎに至らず → 依頼を言い直す", fired);
  }

  /** 収録の無い応答（具体的な部署の提示など）。音声合成で読み上げる。 */
  private speak(raw: string, matched: string, fired: GuardrailId[] = []): TransferReply {
    return {
      utterance: autoFix(raw).text,
      matched,
      outcome: this.outcome,
      handover: false,
      guardrails: fired,
      blocked: checkForbidden(raw).filter((v) => v.fixable),
    };
  }

  private say(id: VoiceLineId, matched: string, fired: GuardrailId[] = []): TransferReply {
    const line = VOICE_LINES[id];
    // 出力前フィルタ（設計書 §6）はこのモードでも必ず通す
    const utterance = autoFix(line.text).text;
    const blocked = checkForbidden(line.text).filter((v) => v.fixable);
    return {
      utterance,
      audioFile: audioUrl(line.file),
      matched,
      outcome: this.outcome,
      handover: false,
      guardrails: fired,
      blocked,
    };
  }
}
