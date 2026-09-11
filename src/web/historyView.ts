/**
 * 架電履歴ダッシュボードと、案件詳細（モーダル）の描画。
 * 記録の組み立て・保存は history.ts。ここは表示だけを持つ。
 *
 * 保存データには相手の発話（音声認識の結果）が入るため、差し込みは必ず textContent で行い、
 * innerHTML には入れない。
 */
import { AGENT_MODE_LABEL } from "../demo/transferEngine.js";
import {
  STATUS_LABEL,
  formatClock,
  formatDateTime,
  formatDuration,
  formatOffset,
  summarize,
  type CallRecord,
} from "./history.js";

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} が見つかりません`);
  return node;
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// クラス名は st- 付きにする（"handover" は通話画面の引き継ぎアラートと同名で、そちらのスタイルが当たるため）
const badge = (r: CallRecord): HTMLElement => el("span", `badge st-${r.status}`, STATUS_LABEL[r.status]);

/** 一覧（上段の集計タイルと、架電ごとの行）を描画する。行を押すと onOpen が呼ばれる。 */
export function renderHistory(records: readonly CallRecord[], onOpen: (r: CallRecord) => void): void {
  $("historyCount").textContent = String(records.length);

  const s = summarize(records);
  const tiles: [string, string, string][] = [
    ["総架電数", `${s.total}件`, "このブラウザに保存された通話"],
    ["アポ獲得", `${s.appointments}件`, `タイプA ${s.appointmentCalls}件中`],
    [
      "アポ獲得率",
      s.appointmentCalls > 0 ? `${Math.round((s.appointments / s.appointmentCalls) * 100)}%` : "—",
      "タイプAの通話に占める割合",
    ],
    ["担当者へ引き継ぎ", `${s.handovers}件`, `タイプB ${s.transferCalls}件中`],
  ];
  const stats = $("historyStats");
  stats.innerHTML = "";
  for (const [label, value, sub] of tiles) {
    const tile = el("div", "stat");
    tile.append(el("div", "slabel", label), el("div", "svalue", value), el("div", "ssub", sub));
    stats.append(tile);
  }

  const tbody = $("historyRows");
  tbody.innerHTML = "";
  $("historyEmpty").hidden = records.length > 0;
  $("historyTable").hidden = records.length === 0;
  for (const r of records) {
    const tr = el("tr");
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-label", `${formatDateTime(r.startedAt)} ${r.company} ${STATUS_LABEL[r.status]}：詳細を開く`);
    const status = el("td");
    status.append(badge(r));
    tr.append(
      el("td", "", formatDateTime(r.startedAt)),
      el("td", "", r.company),
      el("td", "", AGENT_MODE_LABEL[r.mode]),
      status,
      el("td", "n", formatDuration(r.endedAt - r.startedAt)),
      el("td", "go", "詳細 ›"),
    );
    tr.addEventListener("click", () => onOpen(r));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(r);
      }
    });
    tbody.append(tr);
  }
}

/** 案件詳細を開く。1. アポ成立チェック ／ 2. 取得データ ／ 3. 通話全文ログ */
export function openDetail(r: CallRecord): void {
  const title = $("detailTitle");
  title.textContent = r.company;
  title.append(badge(r));
  $("detailMeta").textContent =
    `${formatDateTime(r.startedAt)} ／ ${AGENT_MODE_LABEL[r.mode]} ／ 通話時間 ${formatDuration(r.endedAt - r.startedAt)}`;

  // 1. 判定
  const checks = $("detailChecks");
  checks.innerHTML = "";
  const verdict = $("detailVerdict");
  const items = r.dod
    ? r.dod.items
    : [{ label: "担当者への取次ぎ", ok: r.status === "handover", detail: STATUS_LABEL[r.status] }];
  for (const i of items) {
    const li = el("li", i.ok ? "ok" : "ng");
    li.append(el("span", "mark", i.ok ? "○" : "×"));
    const body = el("span");
    body.append(document.createTextNode(i.label), el("span", "detail", i.detail));
    li.append(body);
    checks.append(li);
  }
  const passed = r.dod ? r.dod.passed : r.status === "handover";
  $("detailCheckTitle").textContent = r.dod ? "1. アポ成立チェック" : "1. 受付突破の結果";
  verdict.className = `verdict ${passed ? "pass" : "fail"}`;
  verdict.textContent = r.dod
    ? passed
      ? "✅ アポ成立（全項目○）"
      : "未成立（未充足あり）"
    : passed
      ? "✅ 担当者へ引き継ぎ"
      : `取次ぎに至らず（${STATUS_LABEL[r.status]}）`;

  // 2. 取得データ
  $("detailDataTitle").textContent = r.dod ? "2. ヒアリング7項目・連絡先" : "2. 取得データ";
  const data = $("detailData");
  data.innerHTML = "";
  for (const d of r.data) {
    const tr = el("tr");
    tr.append(el("th", "", d.label), el("td", d.value ? "" : "missing", d.value ?? "未取得"));
    data.append(tr);
  }

  // 3. 通話全文ログ
  const log = $("detailLog");
  log.innerHTML = "";
  for (const l of r.log) {
    const li = el("li");
    const t = el("span", "t", formatClock(l.at));
    t.append(el("small", "", formatOffset(l.at - r.startedAt)));
    const cls = l.who === "AI" ? "ai" : l.who === "相手" ? "cust" : "sys";
    li.append(t, el("span", `dwho ${cls}`, l.who), el("span", "dtext", l.text));
    log.append(li);
  }
  if (r.log.length === 0) log.append(el("li", "none", "ログはありません"));

  const dlg = $("detail") as HTMLDialogElement;
  if (typeof dlg.showModal === "function") {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute("open", "");
  }
  dlg.querySelector(".dbody")?.scrollTo(0, 0);
}

/** 閉じる操作（✕ボタン・背景クリック・Esc は dialog 標準）をつなぐ。起動時に1回呼ぶ。 */
export function initDetail(): void {
  const dlg = $("detail") as HTMLDialogElement;
  const close = (): void => {
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  };
  $("detailClose").addEventListener("click", close);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close();
  });
}
