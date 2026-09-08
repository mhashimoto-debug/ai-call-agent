/**
 * 対話判定エンジン（自由発話用・API 不要）。
 *
 * 台本再生（mockEngine）と違い、相手が何を言うか分からない前提で
 * 「ガードレール判定 → フェーズ別の意図判定 → 応答文とフェーズ遷移」を決める。
 * マイク入力（音声認識）の結果をそのままここに渡す。
 *
 * 重要: フェーズ遷移の可否とスロット充足の判定は domain/ の同じコードを通す。
 * したがって「7項目が揃うまで P9 へ進めない」「R1 発火中は終話しない」等の
 * 担保は、自由発話でもそのまま効く。
 */
import { PHASES } from "../domain/phases.js";
import { GUARDRAILS, detectGuardrails } from "../domain/guardrails.js";
import { HEARING_SLOT_MAP } from "../domain/hearing.js";
import {
  applyExtracted,
  missingContact,
  missingHearing,
  resolveTransition,
  type CallState,
  type ExtractedFacts,
} from "../domain/state.js";
import { autoFix, checkForbidden, type Violation } from "../domain/forbidden.js";
import type { GuardrailId, HearingId, PhaseId } from "../domain/types.js";
import { DEMO_SCENARIO } from "./scenario.js";

export interface DialogReply {
  utterance: string;
  phase: PhaseId;
  guardrails: GuardrailId[];
  /** どのルールで分岐したか（画面に出して「なぜこう返したか」を見せる） */
  matched: string;
  overrideReason?: string;
  /** 出力前フィルタで遮断した違反 */
  blocked: Violation[];
}

/** 相手の発話に含まれる肯定・否定の判定。 */
const YES = /(はい|ええ|うん|そうです|大丈夫|かまいません|構いません|お願い|了解|わかりました|分かりました|いいです|結構ですよ|それで)/;
const NO = /(いいえ|いや|結構です|いりません|要りません|やめ|やらない|興味ない|不要)/;
const ASK_PURPOSE = /(ご用件|用件|どういった|どちら様|なんの|何の|どんな)/;
const TRANSFER = /(お待ち|代わり|かわり|繋ぎ|つなぎ|少々|担当に)/;
const REFUSE_SALES = /(営業|セールス|お断り|断るよう|取り次げ|取次ぎでき)/;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/;
const COUNT_RE = /(\d+)\s*(名|人)/;
const AGE_RE = /(\d{1,3})\s*(歳|才)|(?:今年で|年齢は)\s*(\d{1,3})/;
const MONTH_RE = /(\d{1,2})\s*月/;

/** P8 で今どのスロットを聞いているか。 */
type PendingSlot = HearingId | "email" | "emailConfirm" | "callbackPhone" | "callbackWindow";

export class DialogEngine {
  private pending: PendingSlot | null = null;

  constructor(private state: CallState) {}

  /** 架電開始の第一声。 */
  greeting(): DialogReply {
    return this.reply(PHASES.P0.mustSay[0] ?? "", "P0", [], "架電開始");
  }

  /** 相手の発話を受けて応答を1つ返す。state は破壊的に更新される。 */
  respond(customerText: string): DialogReply {
    const text = customerText.trim();
    const fired = detectGuardrails(text);
    for (const g of fired) {
      if (!this.state.firedGuardrails.includes(g)) this.state.firedGuardrails.push(g);
    }

    const g = this.byGuardrail(text, fired);
    if (g) return g;

    switch (this.state.phase) {
      case "P0":
        return this.p0(text, fired);
      case "P1":
        return this.p1(text, fired);
      case "P2":
        return this.p2(text, fired);
      case "P3":
        return this.p3(text, fired);
      case "P4":
        return this.reply(PHASES.P5.mustSay.join(" "), "P5", fired, "法改正フック後 → 低ハードル打診");
      case "P5":
        return this.p5(text, fired);
      case "P6":
        return this.p6(text, fired);
      case "P7":
        return this.p7(text, fired);
      case "P8":
        return this.p8(text, fired);
      case "P9":
        return this.reply("本日はお時間をいただきありがとうございました。失礼いたします。", "END", fired, "締め完了");
      default:
        return this.reply("ありがとうございました。失礼いたします。", "END", fired, "終話");
    }
  }

  // ---------- ガードレール優先の分岐（設計書 §5） ----------

  private byGuardrail(text: string, fired: GuardrailId[]): DialogReply | null {
    const has = (id: GuardrailId): boolean => fired.includes(id);

    // R5: 公的機関との誤認は最優先で解く
    if (has("R5")) {
      return this.reply(
        "紛らわしくて申し訳ございません。制度は厚生労働省の管轄ですが、私どもは民間の導入支援事業者でございます。",
        this.state.phase,
        fired,
        "R5: 公的機関との誤認を即座に訂正",
      );
    }
    // R7: 決裁者でない／不在なら、次回接触条件の確定に切り替える
    if (has("R7")) {
      return this.reply(
        "承知いたしました。それでは代表の方はいつ頃お戻りでしょうか。お繋ぎいただきやすい時間帯だけ教えていただけますと助かります。",
        this.state.phase,
        fired,
        "R7: ヒアリングを止めて次回接触条件の確定へ",
      );
    }
    // R1: 「制度がない」は断りではなく最も見込みが高いホットサイン
    if (has("R1")) {
      return this.reply(
        "そうなのですね、ありがとうございます。これから作られる前提で、役員様1名からでもご導入いただけます。" +
          PHASES.P3.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        "P3",
        fired,
        "R1: 断り判定を禁止し、差別化(P3)へ",
      );
    }
    // R3: 専門家を否定せず、判断材料を渡す立場に回る
    if (has("R3")) {
      return this.reply(
        "さすがですね。先生にご相談いただくための判断材料をお渡しするところまでが私どもの担当ですので、その材料だけお持ちできればと思っております。",
        this.state.phase,
        fired,
        "R3: 専門家を否定せず判断材料の提供に回る",
      );
    }
    // R4: 資料送付で終わらせず、手段の選択と再架電日をセットで取る
    if (has("R4")) {
      return this.reply(
        "承知いたしました。資料はメール・SMS・郵送のいずれがよろしいでしょうか。お送りしたうえで、改めてご感想だけ伺うお電話を差し上げたいのですが、来週でしたら前半と後半どちらがご都合よろしいですか？",
        this.state.phase,
        fired,
        "R4: 送付手段の選択＋再架電日の確定をセットで",
      );
    }
    // R2: 忙しい相手に制度説明を被せない。時間の約束だけに切り替える
    if (has("R2")) {
      const target: PhaseId = this.state.phase === "P8" || this.state.phase === "P9" ? this.state.phase : "P6";
      return this.reply(
        "お忙しいところ失礼いたしました。お時間は取らせません。" +
          PHASES.P6.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        target,
        fired,
        "R2: 説明を被せず仮押さえクローズへ",
      );
    }
    return null;
  }

  // ---------- フェーズ別の意図判定 ----------

  private p0(text: string, fired: GuardrailId[]): DialogReply {
    if (REFUSE_SALES.test(text)) {
      return this.reply(PHASES.P0X.mustSay.join(" "), "P0X", fired, "受付ブロック → 痕跡を残して撤退");
    }
    if (TRANSFER.test(text)) {
      // 代表が出る前に名乗りを始めないよう、ここでは短く受けるだけにする
      return this.reply(
        "ありがとうございます。よろしくお願いいたします。",
        "P1",
        fired,
        "取次ぎ発生 → 代表が出るのを待つ(P1)",
      );
    }
    if (ASK_PURPOSE.test(text)) {
      return this.reply(PHASES.P0.conditional[0]?.say ?? "", "P0", fired, "用件を問われた → 巻き込み質問で返す");
    }
    return this.reply(PHASES.P0.mustSay[0] ?? "", "P0", fired, "取次ぎ依頼を簡潔に繰り返す");
  }

  private p1(text: string, fired: GuardrailId[]): DialogReply {
    // 名乗り（立場の切り分け＋巻き込み質問）がまだなら、まずそれを行う
    const introduced = this.state.turns.some(
      (t) => t.speaker === "agent" && /突然のお電話/.test(t.text),
    );
    if (!introduced) {
      return this.reply(PHASES.P1.mustSay.join(" "), "P1", fired, "代表接続 → 名乗り＋立場の切り分け＋巻き込み質問");
    }
    // 相手が挙げた既存の備えを受け止めてから、充足度を問う（設計書 P2）
    const ack = /保険/.test(text)
      ? "保険でご準備されているんですね、ありがとうございます。"
      : /中退共/.test(text)
        ? "中退共にご加入なんですね、ありがとうございます。"
        : "ありがとうございます。";
    return this.reply(
      `${ack}ちなみにそちらは、${DEMO_SCENARIO.contactName}様ご自身の退職金のご準備としても十分に活用できていらっしゃいますか？`,
      "P2",
      fired,
      "受け止め → 充足度質問（「あるか」ではなく「足りているか」）",
    );
  }

  private p2(text: string, fired: GuardrailId[]): DialogReply {
    return this.reply(
      PHASES.P3.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
      "P3",
      fired,
      "現状の不足・不明を確認 → 差別化(P3)",
    );
  }

  private p3(text: string, fired: GuardrailId[]): DialogReply {
    if (/中退共/.test(text)) {
      return this.reply(
        PHASES.P3.conditional[0]?.say ?? "",
        "P3",
        fired,
        "条件分岐: 中退共は従業員のみが対象",
      );
    }
    if (/(iDeCo|イデコ|小規模企業共済)/i.test(text)) {
      return this.reply(
        PHASES.P3.conditional[1]?.say ?? "",
        "P3",
        fired,
        "条件分岐: iDeCo・小規模企業共済とは併用可能",
      );
    }
    if (this.state.lawChangeHookUsed) {
      return this.reply(PHASES.P5.mustSay.join(" "), "P5", fired, "法改正フックは使用済み → P5 へ");
    }
    return this.reply(PHASES.P4.mustSay.join(" "), "P4", fired, "差別化を理解 → 法改正フック(1回のみ)");
  }

  private p5(text: string, fired: GuardrailId[]): DialogReply {
    if (YES.test(text) && !NO.test(text)) {
      return this.reply("ありがとうございます。来週でしたら、午前と午後どちらがよろしいですか？", "P7", fired, "即OK → 日程2択クローズ");
    }
    return this.reply(
      PHASES.P6.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
      "P6",
      fired,
      "保留・要相談 → 仮押さえクローズ",
    );
  }

  private p6(text: string, fired: GuardrailId[]): DialogReply {
    if (YES.test(text) && !NO.test(text)) {
      return this.reply("ありがとうございます。来週でしたら、午前と午後どちらがよろしいですか？", "P7", fired, "仮押さえ同意 → 日程2択");
    }
    return this.reply(
      "承知いたしました。それでは本日中でお時間いただける頃はございませんか？",
      "P6",
      fired,
      "再架電の約束に切り替え",
    );
  }

  private p7(text: string, fired: GuardrailId[]): DialogReply {
    if (/(ズーム|zoom)/i.test(text) && /(何|なに|わからない|分からない|使えない|詳しくない)/.test(text)) {
      return this.reply(
        "スマートフォンでも参加できます。メールでお送りするURLをタップいただくだけです。",
        "P7",
        fired,
        "条件分岐: Zoom の説明",
      );
    }
    if (/(遠い|距離|来られ|お越し)/.test(text)) {
      return this.reply("オンラインですので移動は不要です。", "P7", fired, "条件分岐: オンラインなので移動不要");
    }
    const sc = DEMO_SCENARIO;
    if (/(午前|午後|朝|夕方)/.test(text)) {
      return this.reply(
        `ありがとうございます。では${sc.proposedDate}${sc.proposedTime}から${sc.meetingMinutes}分でいかがでしょうか？`,
        "P7",
        fired,
        "2択の回答 → 1点に確定させる",
      );
    }
    if (YES.test(text) && !NO.test(text)) {
      applyExtracted(this.state, {
        appointment_date: sc.proposedDate,
        appointment_time: sc.proposedTime,
        zoom_agreed: true,
        duration_agreed: true,
      });
      this.pending = null;
      return this.reply(
        PHASES.P8.mustSay[0]?.replace(/^（[^）]*）/, "") ?? "",
        "P8",
        fired,
        "日時確定 → ヒアリングの許可取得(P8)",
      );
    }
    return this.reply("来週でしたら、午前と午後どちらがよろしいですか？", "P7", fired, "開いた質問は使わず2択で聞き直す");
  }

  // ---------- P8: ヒアリング7項目 ----------

  private p8(text: string, fired: GuardrailId[]): DialogReply {
    let note = "";
    if (this.pending) {
      const { facts, ok } = this.extract(this.pending, text);
      if (ok) {
        applyExtracted(this.state, facts);
        note = `${this.pending} を取得`;
      } else {
        // 取れなかった項目は次へ進めず聞き直す（G2 の担保）
        return this.reply(this.askText(this.pending), "P8", fired, `${this.pending} が聞き取れず再質問`);
      }
    }

    const nextSlot = this.nextSlot();
    if (!nextSlot) {
      this.pending = null;
      return this.reply(
        PHASES.P9.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        "P9",
        fired,
        `${note || "取得完了"} → 7項目＋連絡先が揃ったので締め(P9)`,
      );
    }
    this.pending = nextSlot;
    return this.reply(this.askText(nextSlot), "P8", fired, `${note ? note + " → " : ""}次は ${nextSlot}`);
  }

  private nextSlot(): PendingSlot | null {
    const h = missingHearing(this.state)[0];
    if (h) return h;
    if (!this.state.email) return "email";
    if (!this.state.emailConfirmed) return "emailConfirm";
    if (!this.state.callbackPhone) return "callbackPhone";
    if (!this.state.callbackWindow) return "callbackWindow";
    return null;
  }

  private askText(slot: PendingSlot): string {
    switch (slot) {
      case "email":
        return "会社概要とZoomのURLをお送りしたいのですが、メールアドレスを伺えますでしょうか？";
      case "emailConfirm":
        return `復唱させていただきます。${this.state.email} でお間違いないでしょうか？`;
      case "callbackPhone":
        return "前日に確認のご連絡を差し上げたいのですが、お電話番号を伺えますでしょうか？";
      case "callbackWindow":
        return "前日のご連絡は、何時頃が繋がりやすいでしょうか？";
      default:
        return (HEARING_SLOT_MAP.get(slot)?.question ?? "").replace(/（[^）]*）\s*$/, "");
    }
  }

  /** 「今どの項目を聞いているか」が分かっているので、その文脈で回答を解釈する。 */
  private extract(slot: PendingSlot, text: string): { facts: ExtractedFacts; ok: boolean } {
    const num = COUNT_RE.exec(text)?.[1];
    switch (slot) {
      case "H1":
        return { facts: { H1: /(ない|いない|してません|していません|特に)/.test(text) ? "iDeCo・投資ともになし" : text }, ok: true };
      case "H2":
        return { facts: { H2: text }, ok: true };
      case "H3": {
        const m = AGE_RE.exec(text);
        const age = m?.[1] ?? m?.[3];
        return { facts: { H3: age ? `${age}歳` : text }, ok: Boolean(age) };
      }
      case "H4":
        return { facts: { H4: num ? `${num}名（${text}）` : text }, ok: Boolean(num) };
      case "H5":
        return { facts: { H5: num ? `${num}名` : text }, ok: Boolean(num) };
      case "H6":
        return {
          facts: { H6: /(私|自分|はい|そうです|決められ)/.test(text) ? "代表の判断で決裁可能" : text },
          ok: true,
        };
      case "H7": {
        const m = MONTH_RE.exec(text);
        return { facts: { H7: m ? `${m[1]}月` : text }, ok: Boolean(m) };
      }
      case "email": {
        const m = EMAIL_RE.exec(text.replace(/\s/g, ""));
        return { facts: { email: m?.[0] ?? null }, ok: Boolean(m) };
      }
      case "emailConfirm":
        return { facts: { email_confirmed: true }, ok: YES.test(text) && !NO.test(text) };
      case "callbackPhone": {
        const m = PHONE_RE.exec(text.replace(/\s/g, ""));
        return { facts: { callback_phone: m?.[0] ?? null }, ok: Boolean(m) };
      }
      case "callbackWindow":
        return { facts: { callback_window: text }, ok: /(午前|午後|朝|昼|夕方|夜|時|いつでも)/.test(text) };
    }
  }

  // ---------- 応答の確定（フィルタ・遷移検証・履歴） ----------

  private reply(raw: string, proposed: PhaseId, fired: GuardrailId[], matched: string): DialogReply {
    // 出力前フィルタ（設計書 §6）。定型文ベースでも必ず通す。
    const fixed = autoFix(raw);
    const blocked = checkForbidden(raw).filter((v) => v.fixable);
    const utterance = fixed.text;

    applyExtracted(this.state, {
      calendar_requested: /カレンダー/.test(utterance),
      law_change_hook_used: /(法改正|62,?000円)/.test(utterance),
    });

    const forbidEnd = (Object.keys(GUARDRAILS) as GuardrailId[]).filter((id) => GUARDRAILS[id].forbidEnd);
    const t = resolveTransition(this.state, proposed, fired, forbidEnd);

    this.state.turns.push({
      index: this.state.turns.length,
      speaker: "agent",
      text: utterance,
      phase: this.state.phase,
      blockedViolations: blocked.length > 0 ? blocked : undefined,
      note: matched,
    });
    this.state.blockedViolationCount += blocked.length;
    this.state.phase = t.phase;
    if (t.phase === "END" || t.phase === "P0X") this.state.ended = t.phase === "END";

    return {
      utterance,
      phase: t.phase,
      guardrails: fired,
      matched,
      overrideReason: t.overrideReason,
      blocked,
    };
  }

  /** 相手の発話を履歴に積む（画面側から呼ぶ）。 */
  pushCustomer(text: string, guardrails: GuardrailId[]): void {
    this.state.turns.push({
      index: this.state.turns.length,
      speaker: "customer",
      text,
      phase: this.state.phase,
      guardrails,
    });
  }
}
