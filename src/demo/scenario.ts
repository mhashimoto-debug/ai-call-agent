/**
 * デモシナリオの前提（設計書 §2）。
 * 登場する企業名・氏名・連絡先はすべて架空のプレースホルダ。実データの個人情報は含まない。
 */
export interface Scenario {
  agentOrg: string;
  agentName: string;
  partnerOrg: string;
  companyName: string;
  employeeCount: number;
  officerCount: number;
  contactName: string;
  contactTitle: string;
  proposedDate: string;
  proposedTime: string;
  meetingMinutes: number;
  situation: string;
}

export const DEMO_SCENARIO: Scenario = {
  agentOrg: "一般社団法人企業型確定拠出年金相談センター",
  agentName: "佐藤",
  partnerOrg: "社会保険労務士法人ビジネスパートナー",
  companyName: "株式会社サンプル工業",
  employeeCount: 12,
  officerCount: 2,
  contactName: "中村",
  contactTitle: "代表",
  proposedDate: "9月17日（水）",
  proposedTime: "14時",
  meetingMinutes: 30,
  situation:
    "ハローワーク求人リストからの新規架電（過去の接点なし）。代表は50代、退職金は保険で対応済み、企業型DCは未認知。",
};
