import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_TYPES } from "../src/cards/card-data.ts";
import { auditLibrary, summarizeAudit } from "../src/balance/card-value.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = resolve(root, "reports");
const csvPath = resolve(reportDir, "card-balance-audit.csv");
const markdownPath = resolve(reportDir, "card-balance-audit.md");
const rows = auditLibrary(CARD_TYPES);
const summary = summarizeAudit(rows);

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(";") : String(value ?? "");
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

const columns = [
  ["id", "key"], ["name", "name"], ["effect", "type"], ["amount", "amount"],
  ["current_cost", "currentCost"], ["reference_value", "referenceValue"],
  ["candidate_cost_not_applied", "candidateCost"], ["candidate_delta", "costDelta"],
  ["estimate_kind", "estimateKind"], ["flags", "flags"],
];
const csv = [
  columns.map(([heading]) => heading).join(","),
  ...rows.map((row) => columns.map(([, key]) => csvCell(row[key])).join(",")),
].join("\n") + "\n";

const byType = Object.entries(summary.byType)
  .sort((a, b) => b[1].flagged - a[1].flagged || a[0].localeCompare(b[0]));
const largestGaps = rows
  .slice()
  .sort((a, b) => Math.abs(b.referenceValue - b.currentCost) - Math.abs(a.referenceValue - a.currentCost))
  .slice(0, 25);
const highRisk = rows.filter((row) => row.flags.includes("combo-loop-risk"));
const money = (value) => Number(value).toFixed(2);

const markdown = [
  "# Card balance audit",
  "",
  "> Screening report only. No live card costs were changed. The reference value is a transparent heuristic evaluated in one fixed game state; utility proxies are not seconds and are not validated balance values. Use this report to prioritize review, not to auto-apply prices.",
  "",
  "## Summary",
  "",
  "- Cards audited: **" + summary.total + "**",
  "- Cards with at least one review flag: **" + summary.flagged + "**",
  "- Large current-cost/reference-value gaps (absolute gap ≥ 3): **" + summary.costMismatches + "**",
  "- Cards marked as possible combo/loop risks: **" + summary.comboLoopRisks + "**",
  "- Candidate prices differing from current price: **" + summary.candidateCostChanges + "**",
  "- Mean current cost: **" + money(summary.meanCurrentCost) + "**",
  "- Mean reference value: **" + money(summary.meanReferenceValue) + "**",
  "",
  "Candidate price is round(reference value) clamped to 1–8. It is deliberately not applied to card-data.ts: context-dependent effects, utility proxies, caps, and combo interactions need playtesting first.",
  "",
  "## By effect type",
  "",
  "| Effect | Cards | Mean current cost | Mean reference value | Flagged |",
  "|---|---:|---:|---:|---:|",
  ...byType.map(([type, value]) => "| " + type + " | " + value.count + " | " + money(value.meanCost) + " | " + money(value.meanValue) + " | " + value.flagged + " |"),
  "",
  "## Largest reference-value gaps",
  "",
  "| Card | Effect | Amount | Cost now | Reference value | Candidate (not applied) | Flags |",
  "|---|---|---:|---:|---:|---:|---:|",
  ...largestGaps.map((row) => "| " + row.key + " — " + row.name.replaceAll("|", "\\|") + " | " + row.type + " | " + row.amount + " | " + row.currentCost + " | " + money(row.referenceValue) + " | " + row.candidateCost + " | " + (row.flags.join(", ") || "—") + " |"),
  "",
  "## Combo/loop-risk cards",
  "",
  highRisk.length ? highRisk.map((row) => "- **" + row.key + " " + row.type + "** — amount " + row.amount + ", cost " + row.currentCost + ", reference value " + money(row.referenceValue) + "; " + row.flags.join(", ")).join("\n") : "No cards received the loop-risk flag.",
  "",
  "## Interpretation limits",
  "",
  "- The reference state is own time 30, opponent time 40, three cards on each board, two own charges, four cards in each hand, and a 20-card enemy deck.",
  "- Effects that manipulate cards, turns, charges, or future effects use utility proxies. Their numeric values are not directly comparable to seconds.",
  "- This audit does not simulate full matches, turn order, random target selection, win rates, or interaction chains.",
  "- The next validation step is a deterministic game simulator that reuses the actual effect rules, followed by strategy-based match batches. Do not bulk-reprice the library from this report alone.",
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(csvPath, csv, "utf8");
writeFileSync(markdownPath, markdown, "utf8");
console.log("Audited " + rows.length + " cards.");
console.log("Flagged: " + summary.flagged + "; cost gaps: " + summary.costMismatches + "; loop-risk candidates: " + summary.comboLoopRisks + ".");
console.log("CSV: " + csvPath);
console.log("Report: " + markdownPath);
