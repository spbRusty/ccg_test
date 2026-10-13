import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiCommit, createGame, resolveRound } from "../src/game/stability.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = resolve(root, "reports");
const matches = Math.max(1, Math.min(100000, Number.parseInt(process.argv[2] || "1000", 10) || 1000));
const firstSeed = Number.parseInt(process.argv[3] || "1", 10) || 1;
const maxRounds = 100;

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function chooseForSide(game, side, random) {
  if (side === "enemy") {
    aiCommit(game, random);
    return;
  }
  const player = game.player;
  const enemy = game.enemy;
  game.player = enemy;
  game.enemy = player;
  aiCommit(game, random);
  game.player = player;
  game.enemy = enemy;
}

const results = [];
for (let i = 0; i < matches; i++) {
  const seed = firstSeed + i;
  const random = makeRandom(seed);
  const game = createGame({}, random);
  while (!game.winner && game.round <= maxRounds) {
    const otherResolver = game.firstResolver === "player" ? "enemy" : "player";
    const order = game.round % 2 === 1 ? [game.firstResolver, otherResolver] : [otherResolver, game.firstResolver];
    for (const side of order) chooseForSide(game, side, random);
    resolveRound(game, random);
  }
  results.push({
    seed,
    winner: game.winner ?? "turn-limit",
    rounds: Math.min(game.round, maxRounds),
    playerStability: game.player.stability,
    enemyStability: game.enemy.stability,
    playerCardsPlayed: game.player.discard.length + game.player.board.filter(Boolean).length,
    enemyCardsPlayed: game.enemy.discard.length + game.enemy.board.filter(Boolean).length,
  });
}
const count = (winner) => results.filter((row) => row.winner === winner).length;
const mean = (key) => results.reduce((sum, row) => sum + row[key], 0) / results.length;
const pct = (value) => (value * 100 / matches).toFixed(1) + "%";
const csv = [
  "seed,winner,rounds,player_stability,enemy_stability,player_cards_on_field_or_discard,enemy_cards_on_field_or_discard",
  ...results.map((row) => [row.seed, row.winner, row.rounds, row.playerStability, row.enemyStability, row.playerCardsPlayed, row.enemyCardsPlayed].join(",")),
].join("\n") + "\n";
const markdown = [
  "# Симуляция «Стабильности»",
  "",
  "> Скрининговый прогон двух одинаковых эвристических ИИ. Это не оценка шанса победы человека и не доказательство сбалансированности отдельных карт.",
  "",
  "- Матчей: **" + matches + "**",
  "- Начальный seed: **" + firstSeed + "**",
  "- Лимит матча: **" + maxRounds + " раундов**",
  "- При Стабильности выше 8 ИИ сохраняет резерв 35% (от 3 до 6); при 8 и ниже оставляет минимум 1.",
  "- Победы первого игрока: **" + count("player") + " (" + pct(count("player")) + ")**",
  "- Победы второго игрока: **" + count("enemy") + " (" + pct(count("enemy")) + ")**",
  "- Ничьи: **" + count("draw") + " (" + pct(count("draw")) + ")**",
  "- Достигли лимита раундов: **" + count("turn-limit") + " (" + pct(count("turn-limit")) + ")**",
  "- Средняя длительность: **" + mean("rounds").toFixed(2) + " раунда**",
  "- Средняя оставшаяся Стабильность первого игрока: **" + mean("playerStability").toFixed(2) + "**",
  "- Средняя оставшаяся Стабильность второго игрока: **" + mean("enemyStability").toFixed(2) + "**",
  "",
  "## Ограничения",
  "",
  "- Оба игрока используют одну и ту же простую эвристику, а не разные стратегии.",
  "- Оба ИИ используют одинаковую эвристику; стартовая сторона выбирается случайно, а порядок выбора, эффектов и добора чередуется по раундам.",
  "- Карты не получили балансировку автоматически. Используйте результаты для поиска перекоса первого хода и затяжных матчей.",
  "",
].join("\n");
mkdirSync(reportDir, { recursive: true });
writeFileSync(resolve(reportDir, "stability-simulation.csv"), csv, "utf8");
writeFileSync(resolve(reportDir, "stability-simulation.md"), markdown, "utf8");
console.log(markdown);
console.log("CSV: " + resolve(reportDir, "stability-simulation.csv"));
console.log("Report: " + resolve(reportDir, "stability-simulation.md"));
