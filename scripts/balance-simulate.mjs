import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { simulateBatch } from "../src/balance/simulator.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = resolve(root, "reports");
const matches = Math.max(1, Math.min(100000, Number.parseInt(process.argv[2] || "1000", 10) || 1000));
const seed = Number.parseInt(process.argv[3] || "1", 10) || 1;
const batch = simulateBatch(matches, seed);
const csvPath = resolve(reportDir, "card-balance-simulation.csv");
const markdownPath = resolve(reportDir, "card-balance-simulation.md");
const pct = (value) => (value * 100).toFixed(1) + "%";
const num = (value) => Number(value).toFixed(2);

const csv = [
  "seed,winner,turns,player_time,opponent_time,player_cards_played,opponent_cards_played,player_discarded,opponent_discarded",
  ...batch.results.map((row) => [
    row.seed, row.winner, row.turns, num(row.playerTime), num(row.opponentTime),
    row.playerCardsPlayed, row.opponentCardsPlayed, row.playerDiscarded, row.opponentDiscarded,
  ].join(",")),
].join("\n") + "\n";

const markdown = [
  "# Card balance simulation",
  "",
  "> AI-vs-AI screening simulation using the current card effect resolver, current AI scoring, current time costs, six board slots, up to three plays per turn, draw-on-play, delayed effects, traps, and accumulate upkeep. This is not human win rate and does not prove that a card is balanced.",
  "",
  "## Run parameters",
  "",
  "- Matches: **" + batch.matches + "**",
  "- First seed: **" + seed + "**",
  "- Strategy: both sides use the current greedy AI scorer with its existing random tie-breaking noise.",
  "",
  "## Results",
  "",
  "| Metric | Result |",
  "|---|---:|",
  "| Player (first turn) wins | " + batch.playerWins + " (" + pct(batch.playerWinRate) + ") |",
  "| Opponent wins | " + batch.opponentWins + " (" + pct(batch.opponentWinRate) + ") |",
  "| Draws | " + batch.draws + " (" + pct(batch.drawRate) + ") |",
  "| Matches reaching turn limit | " + batch.turnLimitMatches + " (" + pct(batch.turnLimitMatches / batch.matches) + ") |",
  "| Mean turns | " + num(batch.meanTurns) + " |",
  "| Mean player time remaining | " + num(batch.meanPlayerTime) + " |",
  "| Mean opponent time remaining | " + num(batch.meanOpponentTime) + " |",
  "| Mean cards played by player | " + num(batch.meanPlayerCardsPlayed) + " |",
  "| Mean cards played by opponent | " + num(batch.meanOpponentCardsPlayed) + " |",
  "",
  "## Limitations",
  "",
  "- Both sides use the same heuristic AI, not distinct strategic archetypes or human players.",
  "- A match reaching the 100-turn cap is reported separately; it is not counted as a win or draw.",
  "- The browser's manual board actions are not simulated. Random effects still use seeded pseudorandomness.",
  "- Use the result to detect first-player bias, long matches, and economic runaway; do not tune individual card costs from one batch alone.",
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(csvPath, csv, "utf8");
writeFileSync(markdownPath, markdown, "utf8");
console.log("Simulated " + batch.matches + " matches.");
console.log("Wins: first player " + batch.playerWins + ", second player " + batch.opponentWins +
  "; draws " + batch.draws + "; turn-limit " + batch.turnLimitMatches + ".");
console.log("CSV: " + csvPath);
console.log("Report: " + markdownPath);
