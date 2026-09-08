/**
 * ガードレール（設計書 §5 R1〜R7）。
 * R6（断定表現ブロック）は生成前制約 + 出力前フィルタとして forbidden.ts に実装。
 */
import type { GuardrailDef, GuardrailId } from "./types.js";

export const GUARDRAILS: Record<GuardrailId, GuardrailDef> = {
  R1: {
    id: "R1",
    trigger: "「退職金制度はない」「これから」",
    patterns: [
      /(退職金|制度)[^。]{0,12}(ない|ありません|やってない|やっていない|入ってない|未導入)/,
      /これから(考え|検討|作)/,
      /(何も|特に)(やって|して)(ない|いない|おりません)/,
    ],
    behavior:
      "これは断りではなく最も見込みが高いホットサイン。断り判定を絶対に禁止する。『これから作られる前提で、役員様1名からでもご導入いただけます』と返して P3（差別化）へ進む。実データではこの層が全件終話しており、取りこぼし優先度が最高。",
    forbidEnd: true,
    forcePhase: "P3",
  },
  R2: {
    id: "R2",
    trigger: "「忙しい」「時間がない」",
    patterns: [
      /(忙し|バタバタ|立て込|時間がな|今ちょっと|手が離せ)/,
      /(また今度|後にして)/,
    ],
    behavior:
      "制度説明を絶対に被せない。新しい情報を足さず、『本日中でお時間いただける頃はございませんか？』または P6 の仮押さえクローズのみを行う。実データでは説明を被せた架電は10件以上すべて切られている。",
    forbidEnd: false,
    forcePhase: "P6",
  },
  R3: {
    id: "R3",
    trigger: "「税理士・社労士に任せている」",
    patterns: [/(税理士|会計士|社労士|社会保険労務士|顧問)[^。]{0,15}(任せ|お願い|相談|通じ)/],
    behavior:
      "否定しない。『先生にご相談いただくための判断材料をお渡しするところまでが私どもの担当です』と返す。『税理士は詳しくない』等の専門家を下げる表現は反発を招くため絶対に禁止。",
    forbidEnd: true,
  },
  R4: {
    id: "R4",
    trigger: "「資料だけ送って」",
    patterns: [/(資料|パンフ|案内)[^。]{0,10}(送っ|送付|メール|くださ|ください)/],
    behavior:
      "送付だけで終わらせない。送付手段の選択肢（SMS / メール / 封書）を提示し、必ず再架電日の確定をセットで取る。",
    forbidEnd: true,
  },
  R5: {
    id: "R5",
    trigger: "相手が公的機関と誤認している",
    patterns: [
      /(お国|国が|役所|公的|行政|厚労省の方|市役所|年金機構)/,
      /(手数料|費用)[^。]{0,10}(かからん|かからない|無料)/,
    ],
    behavior:
      "即座に『制度は厚生労働省の管轄ですが、私どもは民間の導入支援事業者です』を再提示する。誤認を放置したまま会話を進めない。",
    forbidEnd: true,
  },
  R7: {
    id: "R7",
    trigger: "応対者が代表でない／決裁権がない",
    patterns: [
      /(代表|社長)(は|が)(不在|おりません|席を外|外出|留守)/,
      /(私では|自分では)[^。]{0,10}(分から|わから|決められ|決裁)/,
    ],
    behavior:
      "ヒアリングを続けない。次回接触条件（代表の出社日・繋がりやすい時間帯）の確定だけに切り替える。",
    forbidEnd: false,
  },
};

/** 相手発話に対する正規表現の前検知。LLM 判定と併用してヒントとしてプロンプトに注入する。 */
export function detectGuardrails(customerUtterance: string): GuardrailId[] {
  const hits: GuardrailId[] = [];
  for (const g of Object.values(GUARDRAILS)) {
    if (g.patterns.some((p) => p.test(customerUtterance))) hits.push(g.id);
  }
  return hits;
}
