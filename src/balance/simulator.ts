import { CARD_POOL, CARD_TYPES } from "../cards/card-data.ts";
import type { CardInstance, PlayerKey, PlayerState } from "../cards/types.ts";
import { createPlayer } from "../game/player.ts";
import { applyEffect } from "../effects/apply-effect.ts";
import { scoreCard } from "../ai/scoring.ts";

const START_TIME = 60;
const MAX_TIME = 60;
const HAND_SIZE = 5;
const MAX_HAND = 7;
const MAX_TURNS = 100;
const MAX_PLAYS_PER_TURN = 3;

export interface MatchResult {
  seed: number;
  winner: PlayerKey | "draw" | "turn-limit";
  turns: number;
  playerTime: number;
  opponentTime: number;
  playerCardsPlayed: number;
  opponentCardsPlayed: number;
  playerDiscarded: number;
  opponentDiscarded: number;
}

export interface BatchResult {
  matches: number;
  playerWins: number;
  opponentWins: number;
  draws: number;
  turnLimitMatches: number;
  playerWinRate: number;
  opponentWinRate: number;
  drawRate: number;
  meanTurns: number;
  meanPlayerTime: number;
  meanOpponentTime: number;
  meanPlayerCardsPlayed: number;
  meanOpponentCardsPlayed: number;
  results: MatchResult[];
}

export interface SimulationOptions {
  maxTurns?: number;
  maxPlaysPerTurn?: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function other(key: PlayerKey): PlayerKey {
  return key === "player" ? "opponent" : "player";
}

/**
 * Runs an AI-vs-AI match using the same card factory, card scoring, effect resolver,
 * time costs, six-slot boards, per-play draw, delayed effects and accumulate triggers
 * as the browser game. This is a balance probe, not a replacement for browser playtests.
 */
export function simulateMatch(seed: number, options: SimulationOptions = {}): MatchResult {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  try {
    const maxTurns = options.maxTurns ?? MAX_TURNS;
    const maxPlaysPerTurn = options.maxPlaysPerTurn ?? MAX_PLAYS_PER_TURN;
    let sequence = 0;
    let lastEffect: CardInstance | null = null;
    const players: Record<PlayerKey, PlayerState> = {
      player: createPlayer("Player", START_TIME, () => "p-" + (++sequence)),
      opponent: createPlayer("Opponent", START_TIME, () => "o-" + (++sequence)),
    };
    const played: Record<PlayerKey, number> = { player: 0, opponent: 0 };
    const discarded: Record<PlayerKey, number> = { player: 0, opponent: 0 };
    const logs: string[] = [];

    const addLog = (message: string) => { logs.push(message); };
    const drawCard = (key: PlayerKey) => {
      const player = players[key];
      if (player.hand.length < MAX_HAND && player.deck.length > 0) {
        player.hand.push(player.deck.pop()!);
      }
    };
    const transferTime = (receiverKey: PlayerKey, amount: number) => {
      const donorKey = other(receiverKey);
      const receiver = players[receiverKey];
      const donor = players[donorKey];
      const moved = Math.max(0, Math.min(amount, donor.time, MAX_TIME - receiver.time));
      donor.time -= moved;
      receiver.time += moved;
      return moved;
    };
    const context = {
      getPlayers: () => players,
      maxTime: MAX_TIME,
      maxHand: MAX_HAND,
      drawCard,
      addLog,
      transferTime,
      labelOf: (key: PlayerKey) => key === "player" ? "Player" : "Opponent",
      nextSequence: () => ++sequence,
    };
    const cardCost = (key: PlayerKey, card: CardInstance) =>
      Math.max(1, card.cost + players[key].penalty - players[key].discount);
    const isOver = () => players.player.time <= 0 || players.opponent.time <= 0;

    for (let i = 0; i < HAND_SIZE; i++) {
      drawCard("player");
      drawCard("opponent");
    }

    let turns = 0;
    let current: PlayerKey = "player";
    let winner: MatchResult["winner"] = "turn-limit";

    while (turns < maxTurns && !isOver()) {
      turns += 1;
      const actor = players[current];
      const enemyKey = other(current);
      actor.turnPlays = 0;

      // Same upkeep order as startTurn() in main.ts.
      actor.board.forEach((card) => {
        if (!card || card.type !== "accumulate") return;
        card.charges = (card.charges || 0) + card.amount;
        if (card.charges >= 3) {
          const bonus = Math.min(card.charges, 5);
          actor.time = Math.min(MAX_TIME, actor.time + bonus);
        }
      });
      const pending = actor.delayed.splice(0) as Array<{ from: PlayerKey; amount: number }>;
      pending.forEach((effect) => transferTime(effect.from, effect.amount));
      if (isOver()) break;

      let playsThisTurn = 0;
      while (playsThisTurn < maxPlaysPerTurn && !isOver()) {
        const affordable = actor.hand
          .filter((card) => cardCost(current, card) <= actor.time);
        if (affordable.length === 0) break;

        affordable.sort((a, b) =>
          scoreCard(b, current, players, cardCost, lastEffect, START_TIME, MAX_HAND)
          - scoreCard(a, current, players, cardCost, lastEffect, START_TIME, MAX_HAND));

        let slotIndex = actor.board.findIndex((card) => !card);
        if (slotIndex < 0) {
          slotIndex = actor.board.findIndex((card) => card && card.shield <= 0);
          if (slotIndex < 0) break;
          const removed = actor.board[slotIndex]!;
          actor.board[slotIndex] = null;
          actor.discard.push(removed);
          discarded[current] += 1;
          actor.time = Math.max(0, actor.time - 1);
          if (isOver()) break;
        }

        const card = affordable[0];
        const handIndex = actor.hand.findIndex((item) => item.id === card.id);
        if (handIndex < 0 || actor.board[slotIndex]) break;
        const cost = cardCost(current, card);
        if (actor.time < cost) break;

        actor.time -= cost;
        actor.discount = 0;
        actor.penalty = 0;
        actor.hand.splice(handIndex, 1);
        actor.played.push(card);
        card.playedAt = ++sequence;
        actor.board[slotIndex] = card;

        const trapOwner = players[enemyKey];
        let trapped = false;
        if (trapOwner.hiddenTrap) {
          trapOwner.hiddenTrap = 0;
          actor.board[slotIndex] = null;
          actor.discard.push(card);
          discarded[current] += 1;
          trapped = true;
        }

        if (!trapped) {
          if (card.type === "copy") {
            if (lastEffect) applyEffect(lastEffect, current, true, context);
          } else {
            const resolved = { ...card, amount: card.amount + (actor.ruleBonus || 0) };
            actor.ruleBonus = 0;
            applyEffect(resolved, current, false, context);
            if (card.type !== "cancel") lastEffect = { ...card };
          }
        }

        actor.turnPlays += 1;
        played[current] += 1;
        playsThisTurn += 1;
        if (isOver()) break;
        drawCard(current);
      }

      if (isOver()) break;
      if (playsThisTurn === 0) drawCard(current);
      current = enemyKey;
    }

    if (players.player.time <= 0 && players.opponent.time <= 0) winner = "draw";
    else if (players.player.time <= 0) winner = "opponent";
    else if (players.opponent.time <= 0) winner = "player";
    else if (turns < maxTurns) winner = "draw";
    else winner = "turn-limit";

    return {
      seed,
      winner,
      turns,
      playerTime: players.player.time,
      opponentTime: players.opponent.time,
      playerCardsPlayed: played.player,
      opponentCardsPlayed: played.opponent,
      playerDiscarded: discarded.player,
      opponentDiscarded: discarded.opponent,
    };
  } finally {
    Math.random = originalRandom;
  }
}

export function simulateBatch(
  matches = 1000,
  seed = 1,
  options: SimulationOptions = {},
): BatchResult {
  const count = Math.max(1, Math.floor(matches));
  const results: MatchResult[] = [];
  for (let index = 0; index < count; index++) {
    results.push(simulateMatch(seed + index, options));
  }

  const playerWins = results.filter((result) => result.winner === "player").length;
  const opponentWins = results.filter((result) => result.winner === "opponent").length;
  const draws = results.filter((result) => result.winner === "draw").length;
  const turnLimitMatches = results.filter((result) => result.winner === "turn-limit").length;
  const mean = (selector: (result: MatchResult) => number) =>
    results.reduce((sum, result) => sum + selector(result), 0) / results.length;

  return {
    matches: count,
    playerWins,
    opponentWins,
    draws,
    turnLimitMatches,
    playerWinRate: playerWins / count,
    opponentWinRate: opponentWins / count,
    drawRate: draws / count,
    meanTurns: mean((result) => result.turns),
    meanPlayerTime: mean((result) => result.playerTime),
    meanOpponentTime: mean((result) => result.opponentTime),
    meanPlayerCardsPlayed: mean((result) => result.playerCardsPlayed),
    meanOpponentCardsPlayed: mean((result) => result.opponentCardsPlayed),
    results,
  };
}

export function validateSimulationLibrary(): boolean {
  return CARD_POOL.length === 500 && CARD_POOL.every((key) => Boolean(CARD_TYPES[key]));
}
