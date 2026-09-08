/**
 * 禁止ワード・言い換え表（設計書 §6）の出力前フィルタ。ガードレール R6 の実体。
 *
 * 方針: 生成後チェックではなく「生成前制約 + 出力前フィルタ」の二段構え。
 *   1. プロンプトに禁止表現を明示（生成前制約）
 *   2. 生成された発話をここで機械的に検査（出力前フィルタ）
 *   3. 決定論的に直せるものは自動修正、直せないものは再生成
 * 相手には一度も禁止表現が届かない。
 */

export type ForbiddenId = "F1" | "F2" | "F3" | "F4" | "F5";

export interface ForbiddenRule {
  id: ForbiddenId;
  label: string;
  /** 違反とみなすパターン */
  pattern: RegExp;
  /** これにマッチしていれば違反ではない（言い換え済み） */
  guard?: RegExp;
  /** 検査単位。文単位か発話単位か。 */
  scope: "sentence" | "utterance";
  reason: string;
  /** 言い換え。null は「代替なし・使用禁止」 */
  alternative: string | null;
  /** 決定論的な自動修正。無い場合は再生成に回す。 */
  fix?: (text: string) => string;
}

export const FORBIDDEN_RULES: ForbiddenRule[] = [
  {
    id: "F1",
    label: "社会保険料の断定（下がります／削減になります）",
    pattern:
      /社会保険料[^。！？\n]{0,24}(削減|下がります|下がる(?!場合|ケース|可能性|ことが)|安くなります|減ります|減額|軽減されます)/,
    guard: /社会保険料[^。！？\n]{0,24}(場合があり|ことがあり|可能性があり)/,
    scope: "sentence",
    reason: "給与額・等級により下がらない場合があるため断定できない",
    alternative: "社会保険料が下がる場合があります",
    fix: (t) =>
      t
        .replace(/社会保険料の削減になります/g, "社会保険料が下がる場合があります")
        .replace(/社会保険料が削減されます/g, "社会保険料が下がる場合があります")
        .replace(/社会保険料が下がります/g, "社会保険料が下がる場合があります")
        .replace(/社会保険料が下がり、/g, "社会保険料が下がる場合があり、")
        .replace(/社会保険料が安くなります/g, "社会保険料が下がる場合があります")
        .replace(/社会保険料が減ります/g, "社会保険料が下がる場合があります"),
  },
  {
    id: "F2",
    label: "元本保証／必ず増える",
    pattern: /(元本保証|元本は保証|必ず増え|絶対に増え|減りません|損はしません|リスクはありません)/,
    scope: "sentence",
    reason: "運用商品によっては元本を下回る可能性がある",
    alternative: "運用商品によって結果は変動します",
  },
  {
    id: "F3",
    label: "利回り・収益の断定",
    pattern: /(絶対もうかり|絶対儲かり|必ずもうかり|必ず儲かり|必ず[0-9０-９]+[%％]|確実に[0-9０-９]+[%％])/,
    scope: "sentence",
    reason: "断定不可（代替表現なし・使用禁止）",
    alternative: null,
  },
  {
    id: "F4",
    label: "提携先の固有名",
    pattern: /(岡三証券|三井住友信託銀行|三井住友信託)/,
    scope: "utterance",
    reason: "提携条件上、固有名を出せない",
    alternative: "（固有名を出さず「提携先の金融機関」と表現する）",
    fix: (t) => t.replace(/(岡三証券|三井住友信託銀行|三井住友信託)/g, "提携先の金融機関"),
  },
  {
    id: "F5",
    label: "「厚労省管轄」単独（公的機関との誤認）",
    pattern: /(厚生労働省|厚労省)/,
    guard: /(民間|一般社団法人|導入を支援|導入支援)/,
    scope: "utterance",
    reason: "公的機関と誤認されると最後まで噛み合わない（NGデータに実例あり）",
    alternative: "制度は厚生労働省の管轄で、私どもは民間の導入支援事業者です",
  },
];

export interface Violation {
  ruleId: ForbiddenId;
  label: string;
  matched: string;
  reason: string;
  alternative: string | null;
  fixable: boolean;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 発話を検査して違反一覧を返す。空配列なら合格。 */
export function checkForbidden(utterance: string): Violation[] {
  const violations: Violation[] = [];
  for (const rule of FORBIDDEN_RULES) {
    const targets = rule.scope === "utterance" ? [utterance] : splitSentences(utterance);
    for (const target of targets) {
      const m = rule.pattern.exec(target);
      if (!m) continue;
      if (rule.guard?.test(target)) continue;
      violations.push({
        ruleId: rule.id,
        label: rule.label,
        matched: m[0],
        reason: rule.reason,
        alternative: rule.alternative,
        fixable: Boolean(rule.fix),
      });
      break; // 同一ルールは1発話につき1件だけ報告する
    }
  }
  return violations;
}

/**
 * 決定論的に直せる違反だけを自動修正する。
 * 残った違反は呼び出し側で再生成させる。
 */
export function autoFix(utterance: string): { text: string; applied: ForbiddenId[] } {
  let text = utterance;
  const applied: ForbiddenId[] = [];
  for (const rule of FORBIDDEN_RULES) {
    if (!rule.fix) continue;
    const before = text;
    text = rule.fix(text);
    if (text !== before) applied.push(rule.id);
  }
  return { text, applied };
}

/** プロンプトに埋め込む禁止事項テキスト（生成前制約）。 */
export function forbiddenRulesPrompt(): string {
  return FORBIDDEN_RULES.map((r) => {
    const alt = r.alternative ?? "（代替なし・絶対に使用しない）";
    return `- 【${r.id}】${r.label}\n    → 必ずこう言う: 「${alt}」\n    → 理由: ${r.reason}`;
  }).join("\n");
}
