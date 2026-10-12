import { makeCardFace } from "./ui/card-face";
import { createPlayer } from "./game/player";
import { scoreCard } from "./ai/scoring";
import { applyEffect } from "./effects/apply-effect";
import { createCollectionUI } from "./ui/collection";
import type { PlayerKey, PlayerState } from "./cards/types";
import { getSavedDeckKeys, initAppShell } from "./ui/app-shell";

(() => {
  "use strict";

  const START_TIME = 60;
  const HAND_SIZE = 5;
  const MAX_HAND = 7;
  const MAX_TIME = 60;
  const selectedCardIds = new Set<string>();
  const selectedBoardSlots = new Set<number>();
  let players: Record<PlayerKey, PlayerState>;
  let turn: PlayerKey | null = null;
  let selectedCardId: string | null = null;
  let lastEffect = null;
  let sequence = 0;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let animatedCardId = null;
  let audioContext: AudioContext | null = null;
  let musicOscillators: OscillatorNode[] = [];
  let musicGain: GainNode | null = null;
  let gameFinished = false;
  let logs: string[] = [];
  let boardMoveSlot: number | null = null;

  const $ = (id) => document.getElementById(id);
  const enemyOf = (key) => key === "player" ? "opponent" : "player";
  const labelOf = (key) => key === "player" ? "Ты" : "Противник";

  const effectContext = {
    getPlayers: () => players,
    maxTime: MAX_TIME,
    maxHand: MAX_HAND,
    drawCard,
    addLog,
    transferTime,
    labelOf,
    nextSequence: () => ++sequence,
  };


  function drawCard(key) {
    const player = players[key];
    if (player.hand.length >= MAX_HAND || player.deck.length === 0) return;
    player.hand.push(player.deck.pop());
  }

  function addLog(message) {
    logs.unshift(message);
    $("event-log").replaceChildren();
    logs.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      $("event-log").appendChild(p);
    });
    $("event-log").scrollTop = 0;
  }

  function setMessage(message) {
    $("game-message").textContent = message;
  }

  function cardCost(key, card) {
    const player = players[key];
    return Math.max(1, card.cost + player.penalty - player.discount);
  }

  function setupSlots() {
    const rows = [
      ["opponent-row-1", "opponent"],
      ["player-row-1", "player"]
    ];
    // Все шесть слотов находятся в одном контейнере: на десктопе это один ряд,
    // на мобильном CSS переносит их в два ряда по три.
    rows.forEach(([rowId, owner]) => {
      const row = $(rowId);
      row.replaceChildren();
      for (let i = 0; i < 6; i++) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "slot " + (owner === "player" ? "player-slot" : "enemy-slot");
        slot.dataset.owner = owner;
        slot.dataset.slot = String(i);
        slot.setAttribute("aria-label", (owner === "player" ? "Твой слот " : "Слот противника ") + (i + 1));
        const placeholder = document.createElement("span");
        placeholder.className = "slot-placeholder";
        placeholder.textContent = "+";
        slot.appendChild(placeholder);
        row.appendChild(slot);
      }
    });
    $("opponent-row-2").replaceChildren();
    $("player-row-2").replaceChildren();
  }

  function renderBoard() {
    document.querySelectorAll<HTMLElement>(".slot").forEach((slot) => {
      const owner = slot.dataset.owner;
      const index = Number(slot.dataset.slot);
      const card = players[owner].board[index];
      slot.replaceChildren();
      slot.classList.remove("card-entering");
      slot.classList.toggle("filled", Boolean(card));
      slot.classList.toggle("board-selected",owner==="player"&&selectedBoardSlots.has(index));
      if (card) {
        slot.appendChild(makeCardFace(card, true));
        if (card.id === animatedCardId) slot.classList.add("card-entering");
        slot.title=card.name+" · стоимость "+card.cost+" сек. · зарядов: "+(card.charges||0)+" · "+card.description;
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "slot-placeholder";
        placeholder.textContent = "+";
        slot.appendChild(placeholder);
        slot.title = owner === "player" ? "Перетащи сюда карту" : "Пустой слот";
      }
    });
    animatedCardId = null;
  }

  function renderHand() {
    const hand = $("player-hand");
    hand.replaceChildren();
    players.player.hand.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hand-card" + (selectedCardIds.has(card.id) ? " selected" : "");
      button.draggable = turn === "player" && !gameFinished;
      button.dataset.cardId = card.id;
      button.setAttribute("aria-label", card.name + ", стоимость " + card.cost + " секунд. " + card.description);
      button.title = card.description + " Стоимость: " + cardCost("player", card) + " сек.";
      button.appendChild(makeCardFace(card, true));
      button.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch" || button.classList.contains("dragging")) return;
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        button.style.setProperty("--tilt-x", ((0.5 - y) * 12).toFixed(2) + "deg");
        button.style.setProperty("--tilt-y", ((x - 0.5) * 12).toFixed(2) + "deg");
        button.style.setProperty("--shine-x", (x * 100).toFixed(1) + "%");
        button.style.setProperty("--shine-y", (y * 100).toFixed(1) + "%");
      });
      button.addEventListener("pointerleave", () => {
        button.style.setProperty("--tilt-x", "0deg");
        button.style.setProperty("--tilt-y", "0deg");
      });
      button.addEventListener("click", () => {
        if (turn !== "player" || gameFinished) return;
        if(selectedCardIds.has(card.id))selectedCardIds.delete(card.id);else selectedCardIds.add(card.id);
        selectedCardId=selectedCardIds.size?Array.from(selectedCardIds).at(-1):null;renderHand();
        const total=players.player.hand.filter(c=>selectedCardIds.has(c.id)).reduce((sum,c)=>sum+cardCost("player",c),0);
        setMessage("Выбрано карт: "+selectedCardIds.size+". Общая стоимость: "+total+" сек.");
      });
      button.addEventListener("dragstart", (event) => {
        if (turn !== "player" || gameFinished) {
          event.preventDefault();
          return;
        }
        selectedCardId = card.id;
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        button.classList.add("selected", "dragging");
      });
      button.addEventListener("dragend", () => {
        button.classList.remove("dragging");
        document.querySelectorAll(".slot.drop-target").forEach((slot) => slot.classList.remove("drop-target"));
      });
      hand.appendChild(button);
    });
    $("opponent-hand-count").textContent = String(players.opponent.hand.length);
    const countLabel=$("selected-cards-count");if(countLabel)countLabel.textContent=selectedCardIds.size?"Выбрано: "+selectedCardIds.size:"";
    const playButton=$("play-selected") as HTMLButtonElement | null;if(playButton)playButton.disabled=turn!=="player"||gameFinished||!selectedCardIds.size;

  }

  function renderStats() {
    $("player-time").textContent = String(players.player.time);
    $("opponent-time").textContent = String(players.opponent.time);
    $("player-time-bar").style.width = Math.max(0, players.player.time / START_TIME * 100) + "%";
    $("opponent-time-bar").style.width = Math.max(0, players.opponent.time / START_TIME * 100) + "%";
    const mobileOpponentTime = $("mobile-opponent-time");
    const mobilePlayerTime = $("mobile-player-time");
    const mobileOpponentFill = $("mobile-opponent-fill");
    const mobilePlayerFill = $("mobile-player-fill");
    if (mobileOpponentTime) mobileOpponentTime.textContent = String(players.opponent.time);
    if (mobilePlayerTime) mobilePlayerTime.textContent = String(players.player.time);
    if (mobileOpponentFill) mobileOpponentFill.style.width = Math.max(0, players.opponent.time / START_TIME * 100) + "%";
    if (mobilePlayerFill) mobilePlayerFill.style.width = Math.max(0, players.player.time / START_TIME * 100) + "%";
    $("player-status").textContent = gameFinished ? "Игра завершена" : turn === "player" ? "Твой ход" : "Ход противника";
    $("opponent-status").textContent = gameFinished ? "Игра завершена" : turn === "opponent" ? "Ходит…" : "Ожидает ход";
    ($("pass-turn") as HTMLButtonElement).disabled=turn!=="player"||gameFinished;
    ["move-selected","return-selected","remove-selected","sacrifice-selected"].forEach(id=>{const b=$(id) as HTMLButtonElement | null;if(b)b.disabled=turn!=="player"||gameFinished||!selectedBoardSlots.size;});
    const clearButton=$("clear-board-selection") as HTMLButtonElement | null;if(clearButton)clearButton.disabled=!selectedBoardSlots.size;
    ($("new-game") as HTMLButtonElement).disabled = false;
  }

  let collectionMode: "player" | "opponent" = "player";
  const collectionUI = createCollectionUI({
    getPlayers: () => players,
    getMode: () => collectionMode,
    $,
  });
  const { renderCollection, showCardDetails } = collectionUI;

  function render() {
    renderStats();
    renderBoard();
    renderHand();
    renderCollection();
    $("battlefield").classList.toggle("game-over", gameFinished);
  }

  function transferTime(receiverKey, amount) {
    const donorKey = enemyOf(receiverKey);
    const receiver = players[receiverKey];
    const donor = players[donorKey];
    const transferable = Math.max(0, Math.min(amount, donor.time, MAX_TIME - receiver.time));
    donor.time -= transferable;
    receiver.time += transferable;
    return transferable;
  }

  function playSound(kind) {
    if (localStorage.getItem("rift.sound") === "off") return;
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume();

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === "card" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(kind === "card" ? 520 : 330, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "card" ? 240 : 440, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    } catch (_) {
      // Sound is optional; never interrupt gameplay.
    }
  }

  function setMusicEnabled(enabled: boolean): void {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") void audioContext.resume();
      const now = audioContext.currentTime;
      if (enabled) {
        if (musicOscillators.length) return;
        musicGain = audioContext.createGain();
        musicGain.gain.setValueAtTime(0.0001, now);
        musicGain.gain.exponentialRampToValueAtTime(0.012, now + 1.2);
        musicGain.connect(audioContext.destination);
        [110, 164.81, 220].forEach((frequency, index) => {
          const oscillator = audioContext!.createOscillator();
          oscillator.type = index === 1 ? "triangle" : "sine";
          oscillator.frequency.value = frequency;
          const voice = audioContext!.createGain();
          voice.gain.value = index === 0 ? 0.42 : 0.18;
          oscillator.connect(voice);
          voice.connect(musicGain!);
          oscillator.start();
          musicOscillators.push(oscillator);
        });
      } else if (musicGain) {
        const gain = musicGain;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        window.setTimeout(() => {
          musicOscillators.forEach(oscillator => { try { oscillator.stop(); } catch (_) {} });
          musicOscillators = [];
          gain.disconnect();
          if (musicGain === gain) musicGain = null;
        }, 220);
      }
    } catch (_) {
      // Audio is optional; never interrupt gameplay.
    }
  }

  function checkGameOver() {
    const playerOut = players.player.time <= 0;
    const opponentOut = players.opponent.time <= 0;
    if (!playerOut && !opponentOut) return false;

    gameFinished = true;
    turn = null;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    const battlefield = $("battlefield");
    battlefield.classList.add("game-over");

    if (playerOut && opponentOut) {
      setMessage("Ничья: время закончилось у обоих игроков.");
      addLog("Игра завершилась вничью.");
    } else if (playerOut) {
      setMessage("Время закончилось. Победил противник.");
      addLog("Победа противника.");
    } else {
      setMessage("У противника закончилось время. Ты победил.");
      addLog("Твоя победа.");
    }
    render();
    return true;
  }

  function resolveDelayed(key) {
    const pending = players[key].delayed.splice(0);
    pending.forEach((effect) => {
      if (gameFinished) return;
      const moved = transferTime(effect.from, effect.amount);
      addLog("Отложенный эффект: " + labelOf(key) + " теряет " + moved + " сек.");
    });
  }

  function startTurn(key) {
    if (gameFinished) return;
    turn = key;
    selectedCardId=null;selectedCardIds.clear();selectedBoardSlots.clear();players[key].turnPlays=0;
    players[key].board.forEach(card=>{if(card&&card.type==="accumulate"){card.charges=(card.charges||0)+card.amount;if(card.charges>=3){const bonus=Math.min(card.charges,5);players[key].time=Math.min(MAX_TIME,players[key].time+bonus);addLog("«"+card.name+"» накапливает заряды и возвращает "+bonus+" сек.");}}});
    resolveDelayed(key);
    if (checkGameOver()) return;
    render();
    if (key === "player") {
      setMessage("Твой ход. Разыгрывай несколько карт, взаимодействуй с полем или заверши ход.");
    } else {
      setMessage("Противник выбирает карту…");
      aiTimer = setTimeout(runAI, 1400 + Math.floor(Math.random() * 1001));
    }
  }

  function playCard(cardId, slotIndex, actorKey) {
    if (gameFinished || turn !== actorKey) return false;
    const actor = players[actorKey];
    const handIndex = actor.hand.findIndex((card) => card.id === cardId);
    if (handIndex < 0) return false;
    const card = actor.hand[handIndex];
    const cost = cardCost(actorKey, card);
    if (slotIndex < 0 || slotIndex > 5) slotIndex = actor.board.findIndex((item) => !item);
    if (slotIndex < 0) {
      if (actorKey === "player") setMessage("Твоё поле заполнено. Нажми на свою карту, чтобы снять её за 1 секунду.");
      return false;
    }
    if (actor.board[slotIndex]) {
      if (actorKey === "player") setMessage("Этот слот занят. Выбери пустой слот: карты не перекрывают друг друга.");
      return false;
    }
    if (actor.time < cost) {
      if (actorKey === "player") setMessage("Не хватает времени: нужно " + cost + " сек., у тебя " + actor.time + ".");
      return false;
    }

    actor.time -= cost;
    actor.discount = 0;
    actor.penalty = 0;
    actor.hand.splice(handIndex,1);selectedCardIds.delete(card.id);
    actor.played.push(card);

    card.playedAt = ++sequence;
    actor.board[slotIndex] = card;

    addLog(labelOf(actorKey) + " разыгрывает «" + card.name + "» за " + cost + " сек.");

    const trapOwner=enemyOf(actorKey);let trapped=false;
    if(players[trapOwner].hiddenTrap){players[trapOwner].hiddenTrap=0;const slot=actor.board.findIndex(c=>c&&c.id===card.id);if(slot>=0)actor.board[slot]=null;actor.discard.push(card);trapped=true;addLog("Скрытая ловушка останавливает карту «"+card.name+"»!");}
    if(!trapped){if(card.type==="copy"){if(lastEffect)applyEffect(lastEffect,actorKey,true,effectContext);else addLog("Эхо не нашло предыдущего эффекта.");}
    else{const resolved={...card,amount:card.amount+(actor.ruleBonus||0)};actor.ruleBonus=0;applyEffect(resolved,actorKey,false,effectContext);if(card.type!=="cancel")lastEffect={type:card.type,amount:card.amount,id:card.id};}}
    actor.turnPlays++;if(checkGameOver())return true;drawCard(actorKey);animatedCardId=card.id;playSound("card");render();
    if(actorKey==="player")setMessage("Карта разыграна. Можешь разыграть ещё или завершить ход.");return true;
  }

  function passTurn() {
    if (turn !== "player" || gameFinished) return;
    selectedCardIds.clear();drawCard("player");
    addLog("Ты завершаешь ход.");
    playSound("pass");
    render();
    startTurn("opponent");
  }

  function runAI() {
    aiTimer = null;
    if (turn !== "opponent" || gameFinished) return;
    const actor = players.opponent;
    const affordable = actor.hand.filter((card) => cardCost("opponent", card) <= actor.time);
    if (affordable.length === 0) {
      drawCard("opponent");
      addLog("Противник пропускает ход: не хватает времени на карты.");
      render();
      startTurn("player");
      return;
    }

    affordable.sort((a, b) => scoreCard(b, "opponent", players, cardCost, lastEffect, START_TIME, MAX_HAND) - scoreCard(a, "opponent", players, cardCost, lastEffect, START_TIME, MAX_HAND));
    let plays=0;
    while(plays<3&&turn==="opponent"&&!gameFinished){
      const choices=actor.hand.filter(c=>cardCost("opponent",c)<=actor.time).sort((a,b)=>scoreCard(b, "opponent", players, cardCost, lastEffect, START_TIME, MAX_HAND)-scoreCard(a, "opponent", players, cardCost, lastEffect, START_TIME, MAX_HAND));if(!choices.length)break;
      let slotIndex=actor.board.findIndex(c=>!c);
      if(slotIndex<0){const r=actor.board.findIndex(c=>c&&c.shield<=0);if(r<0)break;const removed=actor.board[r];actor.board[r]=null;actor.discard.push(removed);actor.time=Math.max(0,actor.time-1);addLog("Противник сбрасывает «"+removed.name+"» за 1 сек.");if(checkGameOver())return;slotIndex=r;}
      if(!playCard(choices[0].id,slotIndex,"opponent"))break;plays++;
    }
    render();startTurn("player");
  }

  function resetGame() {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    sequence = 0;
    logs = [];
    selectedCardId=null;selectedCardIds.clear();selectedBoardSlots.clear();
    lastEffect = null;
    gameFinished = false;
    players = {
      player: createPlayer("Ты", START_TIME, () => "card-" + (++sequence), getSavedDeckKeys()),
      opponent: createPlayer("Противник", START_TIME, () => "card-" + (++sequence))
    };
    for (let i = 0; i < HAND_SIZE; i++) {
      drawCard("player");
      drawCard("opponent");
    }
    setupSlots();
    $("event-log").replaceChildren();
    addLog("Новая партия. У каждого игрока по " + START_TIME + " секунд.");
    startTurn("player");
  }

  function initEvents() {
    $("tab-player-deck").addEventListener("click", () => { collectionMode = "player"; renderCollection(); });
    $("tab-opponent-deck").addEventListener("click", () => { collectionMode = "opponent"; renderCollection(); });
    document.addEventListener("mouseover", (event) => {
      const face = (event.target as Element | null)?.closest<HTMLElement>(".card-face[data-card-key]");
      if (face) showCardDetails(face.dataset.cardKey);
    });
    document.addEventListener("focusin", (event) => {
      const face = (event.target as Element | null)?.closest<HTMLElement>(".card-face[data-card-key]");
      if (face) showCardDetails(face.dataset.cardKey);
    });
    $("new-game").addEventListener("click", resetGame);
    const fullscreenButton = $("fullscreen-toggle");
    if (fullscreenButton) {
      const updateFullscreenLabel = () => {
        const active = Boolean(document.fullscreenElement);
        fullscreenButton.textContent = active ? "⛶ Свернуть" : "⛶ На весь экран";
        fullscreenButton.setAttribute("aria-label", active ? "Выйти из полноэкранного режима" : "Развернуть на весь экран");
      };
      fullscreenButton.addEventListener("click", async () => {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else {
            setMessage("Полноэкранный режим не поддерживается этим браузером. На iPhone можно выбрать «На экран Домой» в меню браузера.");
          }
        } catch (_) {
          setMessage("Браузер не разрешил полноэкранный режим. Попробуй открыть страницу в обычной вкладке браузера.");
        }
        updateFullscreenLabel();
      });
      document.addEventListener("fullscreenchange", updateFullscreenLabel);
    }
    $("pass-turn").addEventListener("click",passTurn);
    $("play-selected").addEventListener("click",()=>{if(turn!=="player"||gameFinished||!selectedCardIds.size)return;let n=0;for(const id of Array.from(selectedCardIds)){const free=players.player.board.findIndex(c=>!c);if(free<0){setMessage("Поле заполнено. Сними карты.");break;}if(!playCard(id,free,"player"))break;selectedCardIds.delete(id);n++;}selectedCardId=null;render();setMessage("Разыграно карт: "+n+". Ход продолжается.");});
    $("remove-selected").addEventListener("click",()=>{if(turn!=="player"||gameFinished||!selectedBoardSlots.size)return;let n=0;Array.from(selectedBoardSlots).forEach(i=>{const c=players.player.board[i];if(c){players.player.board[i]=null;players.player.discard.push(c);players.player.time=Math.max(0,players.player.time-1);n++;}});selectedBoardSlots.clear();addLog("Ты снимаешь "+n+" карт с поля (по 1 секунде за карту).");checkGameOver();render();});
    $("sacrifice-selected").addEventListener("click",()=>{if(turn!=="player"||gameFinished||!selectedBoardSlots.size)return;let n=0,gain=0;Array.from(selectedBoardSlots).forEach(i=>{const c=players.player.board[i];if(c){gain+=(c.charges||0)+1;players.player.board[i]=null;players.player.discard.push(c);n++;}});players.player.time=Math.min(MAX_TIME,players.player.time+gain);selectedBoardSlots.clear();addLog("Ты жертвуешь "+n+" картами и получаешь "+gain+" сек.");render();});
    $("clear-board-selection").addEventListener("click",()=>{selectedBoardSlots.clear();render();});
    $("move-selected").addEventListener("click",()=>{if(turn!=="player"||gameFinished||selectedBoardSlots.size!==1){setMessage("Для перемещения выбери ровно одну карту.");return;}boardMoveSlot=Array.from(selectedBoardSlots)[0];setMessage("Нажми на пустой слот, куда переместить карту.");});
    $("return-selected").addEventListener("click",()=>{if(turn!=="player"||gameFinished||!selectedBoardSlots.size)return;let n=0;Array.from(selectedBoardSlots).sort((a,b)=>a-b).forEach(i=>{const c=players.player.board[i];if(c&&players.player.hand.length<MAX_HAND){players.player.board[i]=null;players.player.hand.push(c);n++;}});selectedBoardSlots.clear();addLog("Ты возвращаешь в руку "+n+" карт.");render();setMessage("Возвращено в руку: "+n+".");});
    $("card-search").addEventListener("input",renderCollection);

    $("battlefield").addEventListener("click", (event) => {
      const slot = (event.target as Element | null)?.closest<HTMLElement>(".slot");
      if (!slot || slot.dataset.owner !== "player" || turn !== "player" || gameFinished) return;
      const slotIndex = Number(slot.dataset.slot);
      const boardCard=players.player.board[slotIndex];
      if(selectedCardIds.size){if(boardCard){setMessage("Слот занят. Выбери пустой слот.");return;}let placed=0;for(const id of Array.from(selectedCardIds)){const free=players.player.board.findIndex(c=>!c);if(free<0||!playCard(id,free,"player"))break;selectedCardIds.delete(id);placed++;}selectedCardId=null;render();setMessage("Разыграно карт: "+placed+". Ход продолжается.");return;}
      if(boardCard){if(selectedBoardSlots.has(slotIndex))selectedBoardSlots.delete(slotIndex);else selectedBoardSlots.add(slotIndex);render();setMessage("Выбрано карт на поле: "+selectedBoardSlots.size+".");return;}
      if(boardMoveSlot!==null){const moving=players.player.board[boardMoveSlot];if(moving){players.player.board[slotIndex]=moving;players.player.board[boardMoveSlot]=null;selectedBoardSlots.clear();boardMoveSlot=null;render();setMessage("Карта перемещена.");return;}boardMoveSlot=null;}
      if(selectedCardId)playCard(selectedCardId,slotIndex,"player");else setMessage("Выбери карты в руке или выдели карты на поле.");
    });

    $("battlefield").addEventListener("dragover", (event) => {
      const slot = (event.target as Element | null)?.closest(".slot.player-slot");
      if (!slot || turn !== "player" || gameFinished) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("drop-target");
    });

    $("battlefield").addEventListener("dragleave", (event) => {
      const slot = (event.target as Element | null)?.closest<HTMLElement>(".slot");
      if (slot && !slot.contains(event.relatedTarget as Node | null)) slot.classList.remove("drop-target");
    });

    $("battlefield").addEventListener("drop", (event) => {
      const slot = (event.target as Element | null)?.closest<HTMLElement>(".slot.player-slot");
      if (!slot || turn !== "player" || gameFinished) return;
      event.preventDefault();
      slot.classList.remove("drop-target");
      const id = event.dataTransfer.getData("text/plain") || selectedCardId;
      if (id) playCard(id, Number(slot.dataset.slot), "player");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initEvents();
    resetGame();
    initAppShell(resetGame);
    document.addEventListener("rift-music-change", (event) => setMusicEnabled(Boolean((event as CustomEvent<{enabled:boolean}>).detail?.enabled)));
  });
})();