import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DECK } from "../src/game/cards.ts";
import { aiCommit, createGame, resolveRound } from "../src/game/rapid-core.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = resolve(root, "reports");
const matches = Math.max(1, Math.min(100000, Number.parseInt(process.argv[2] || "1000", 10) || 1000));
const firstSeed = Number.parseInt(process.argv[3] || "1", 10) || 1;
const maxRounds = 7;

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function chooseForSide(game, side, random) {
  if (side === "enemy") {
    aiCommit(game, random);
    return;
  }
  const player = game.player;
  game.player = game.enemy;
  game.enemy = player;
  aiCommit(game, random);
  game.enemy = game.player;
  game.player = player;
}

const results = [];
for (let i = 0; i < matches; i++) {
  const seed = firstSeed + i;
  const random = makeRandom(seed);
  const aiRandom = { player: makeRandom(seed ^ 0x9e3779b9), enemy: makeRandom(seed ^ 0x85ebca6b) };
  const game = createGame(DEFAULT_DECK, random);
  while (!game.winner && game.round <= maxRounds) {
    const otherResolver = game.round % 2 === 1 ? "enemy" : "player";
    const order = game.round % 2 === 1 ? ["player", otherResolver] : [otherResolver, "player"];
    for (const side of order) chooseForSide(game, side, aiRandom[side]);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, random);
  }
  results.push({ seed, winner: game.winner, rounds: Math.min(game.round, maxRounds), playerStability: game.player.stability, enemyStability: game.enemy.stability });
}
const wins = results.filter(r => r.winner === "player").length;
const losses = results.filter(r => r.winner === "enemy").length;
const draws = results.filter(r => r.winner === "draw").length;
const report = {
  generatedAt: new Date().toISOString(), matches, firstSeed, rules: { deckSize: 12, startHand: 4, handLimit: 4, slots: 4, maxPlays: 2, roundLimit: 7, startStability: 30 },
  wins, losses, draws, unresolved: matches - wins - losses - draws,
  averageRounds: Number((results.reduce((sum, r) => sum + r.rounds, 0) / matches).toFixed(2)),
  results,
};
mkdirSync(reportDir, { recursive: true });
const out = resolve(reportDir, `simulation-${firstSeed}-${matches}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output: out, matches, wins, losses, draws, unresolved: report.unresolved, averageRounds: report.averageRounds }, null, 2));
