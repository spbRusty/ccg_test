(() => {
  "use strict";

  const START_TIME = 60;
  const HAND_SIZE = 5;
  const MAX_HAND = 7;
  const MAX_TIME = 60;
  const CARD_TYPES = {
    impulse: {
      name: "Импульс", cost: 1, type: "gain", amount: 2, symbol: "↗",
      description: "Верни себе 2 секунды.", color: "#8ce0a0", category: "Подзарядка"
    },
    reserve: {
      name: "Резерв времени", cost: 3, type: "gain", amount: 5, symbol: "+",
      description: "Получи 5 секунд.", color: "#62d9e8", category: "Подзарядка"
    },
    thief: {
      name: "Вор времени", cost: 5, type: "steal", amount: 4, symbol: "⇢",
      description: "Перенеси 4 секунды от врага себе.", color: "#ff8c78", category: "Перенос"
    },
    exchange: {
      name: "Перестановка", cost: 6, type: "swap", amount: 0, symbol: "⇄",
      description: "Поменяйся запасами времени.", color: "#f0c875", category: "Аномалия"
    },
    accelerator: {
      name: "Ускоритель", cost: 2, type: "discount", amount: 3, symbol: "»",
      description: "Следующая твоя карта дешевле на 3.", color: "#a9a0ff", category: "Ускорение"
    },
    slow: {
      name: "Замедлитель", cost: 4, type: "slow", amount: 3, symbol: "…",
      description: "Следующая карта врага дороже на 3.", color: "#d59aff", category: "Замедление"
    },
    echo: {
      name: "Эхо", cost: 4, type: "copy", amount: 0, symbol: "⟲",
      description: "Повтори эффект предыдущей карты.", color: "#80b7ff", category: "Копирование"
    },
    disruptor: {
      name: "Срыв", cost: 3, type: "cancel", amount: 3, symbol: "×",
      description: "Убери последнюю карту врага с поля и получи 3 секунды.", color: "#ff727e", category: "Отмена"
    },
    delayed: {
      name: "Отложенный импульс", cost: 3, type: "delayed", amount: 5, symbol: "◷",
      description: "В начале следующего хода враг потеряет 5 секунд, ты их получишь.", color: "#f0c875", category: "Задержка"
    },
    critical: {
      name: "Критический момент", cost: 3, type: "conditional", amount: 0, symbol: "!",
      description: "Забери 7 секунд, если у врага меньше 20; иначе 3.", color: "#ff9d6e", category: "Условие"
    },
    percentage: {
      name: "Доля секунды", cost: 4, type: "percent", amount: 10, symbol: "%",
      description: "Забери 10% оставшегося времени врага.", color: "#68d9c1", category: "Процент"
    },
    scavenger: {
      name: "Полевой сборщик", cost: 3, type: "fieldGain", amount: 1, symbol: "⌂",
      description: "Получи 1 секунду за каждую свою карту на поле, включая эту.", color: "#a8d879", category: "Синергия поля"
    },
    disrupt: {
      name: "Полевой саботаж", cost: 4, type: "fieldDrain", amount: 3, symbol: "⌁",
      description: "Уничтожь самую дорогую карту врага и забери 3 секунды.", color: "#ff727e", category: "Саботаж поля"
    },
    pressure: {
      name: "Давление разлома", cost: 3, type: "fieldTax", amount: 1, symbol: "⚡",
      description: "Враг теряет 1 секунду за каждую свою карту на поле.", color: "#e6a0ff", category: "Атака поля"
    }
  };

  const CARD_POOL = Object.keys(CARD_TYPES);
  let players;
  let turn;
  let selectedCardId = null;
  let lastEffect = null;
  let sequence = 0;
  let aiTimer = null;
  let animatedCardId = null;
  let audioContext = null;
  let gameFinished = false;
  let logs = [];

  const $ = (id) => document.getElementById(id);
  const enemyOf = (key) => key === "player" ? "opponent" : "player";
  const labelOf = (key) => key === "player" ? "Ты" : "Противник";

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function makeDeck() {
    const cards = [];
    CARD_POOL.forEach((key) => {
      for (let i = 0; i < 4; i++) {
        const definition = CARD_TYPES[key];
        cards.push({ ...definition, key, id: "card-" + (++sequence) });
      }
    });
    return shuffle(cards);
  }

  function makePlayer(name) {
    return {
      name,
      time: START_TIME,
      hand: [],
      deck: makeDeck(),
      board: Array(6).fill(null),
      discount: 0,
      penalty: 0,
      delayed: []
    };
  }

  function drawCard(key) {
    const player = players[key];
    if (player.hand.length >= MAX_HAND || player.deck.length === 0) return;
    player.hand.push(player.deck.pop());
  }

  function addLog(message) {
    logs.push(message);
    logs = logs.slice(-50);
    $("event-log").replaceChildren();
    logs.slice().reverse().forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      $("event-log").appendChild(p);
    });
    $("event-log").scrollTop = $("event-log").scrollHeight;
  }

  function setMessage(message) {
    $("game-message").textContent = message;
  }

  function cardCost(key, card) {
    const player = players[key];
    return Math.max(1, card.cost + player.penalty - player.discount);
  }

  function makeCardFace(card, showDescription) {
    const face = document.createElement("div");
    face.className = "card-face";
    face.style.setProperty("--card-glow", card.color);

    const top = document.createElement("div");
    top.className = "card-top";
    const cost = document.createElement("span");
    cost.className = "card-cost";
    cost.textContent = card.cost + "с";
    cost.title = "Базовая стоимость";
    top.appendChild(cost);

    const body = document.createElement("div");
    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = card.name;
    body.appendChild(name);

    if (showDescription) {
      const desc = document.createElement("div");
      desc.className = "card-description";
      desc.textContent = card.description;
      body.appendChild(desc);
    }

    face.append(top, body);
    return face;
  }

  function setupSlots() {
    const rows = [
      ["opponent-row-1", "opponent", 0],
      ["opponent-row-2", "opponent", 3],
      ["player-row-1", "player", 0],
      ["player-row-2", "player", 3]
    ];
    rows.forEach(([rowId, owner, offset]) => {
      const row = $(rowId);
      row.replaceChildren();
      for (let i = 0; i < 3; i++) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "slot " + (owner === "player" ? "player-slot" : "enemy-slot");
        slot.dataset.owner = owner;
        slot.dataset.slot = String(offset + i);
        slot.setAttribute("aria-label", (owner === "player" ? "Твой слот " : "Слот противника ") + (offset + i + 1));
        const placeholder = document.createElement("span");
        placeholder.className = "slot-placeholder";
        placeholder.textContent = "+";
        slot.appendChild(placeholder);
        row.appendChild(slot);
      }
    });
  }

  function renderBoard() {
    document.querySelectorAll(".slot").forEach((slot) => {
      const owner = slot.dataset.owner;
      const index = Number(slot.dataset.slot);
      const card = players[owner].board[index];
      slot.replaceChildren();
      slot.classList.remove("card-entering");
      slot.classList.toggle("filled", Boolean(card));
      if (card) {
        slot.appendChild(makeCardFace(card, true));
        if (card.id === animatedCardId) slot.classList.add("card-entering");
        slot.title = card.name + " · стоимость " + card.cost + " сек. · " + card.description;
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
      button.className = "hand-card" + (selectedCardId === card.id ? " selected" : "");
      button.draggable = turn === "player" && !gameFinished;
      button.dataset.cardId = card.id;
      button.setAttribute("aria-label", card.name + ", стоимость " + card.cost + " секунд. " + card.description);
      button.title = card.description + " Стоимость: " + cardCost("player", card) + " сек.";
      button.appendChild(makeCardFace(card, true));
      button.addEventListener("click", () => {
        if (turn !== "player" || gameFinished) return;
        selectedCardId = selectedCardId === card.id ? null : card.id;
        renderHand();
        const cost = cardCost("player", card);
        setMessage(selectedCardId ? card.name + " выбрана. Стоимость сейчас: " + cost + " сек. Перетащи её на слот или нажми на слот." : "Карта не выбрана.");
      });
      button.addEventListener("dragstart", (event) => {
        if (turn !== "player" || gameFinished) {
          event.preventDefault();
          return;
        }
        selectedCardId = card.id;
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        button.classList.add("selected");
      });
      button.addEventListener("dragend", () => {
        document.querySelectorAll(".slot.drop-target").forEach((slot) => slot.classList.remove("drop-target"));
      });
      hand.appendChild(button);
    });
    $("opponent-hand-count").textContent = players.opponent.hand.length;
    $("player-deck-count").textContent = players.player.deck.length;
  }

  function renderStats() {
    $("player-time").textContent = players.player.time;
    $("opponent-time").textContent = players.opponent.time;
    $("player-time-bar").style.width = Math.max(0, players.player.time / START_TIME * 100) + "%";
    $("opponent-time-bar").style.width = Math.max(0, players.opponent.time / START_TIME * 100) + "%";
    $("player-status").textContent = gameFinished ? "Игра завершена" : turn === "player" ? "Твой ход" : "Ход противника";
    $("opponent-status").textContent = gameFinished ? "Игра завершена" : turn === "opponent" ? "Ходит…" : "Ожидает ход";
    $("pass-turn").disabled = turn !== "player" || gameFinished;
    $("new-game").disabled = false;
  }

  function render() {
    renderStats();
    renderBoard();
    renderHand();
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

  function removeLatestEnemyCard(actorKey) {
    const enemyKey = enemyOf(actorKey);
    const board = players[enemyKey].board;
    let latestIndex = -1;
    let latestSequence = -1;
    board.forEach((card, index) => {
      if (card && card.playedAt > latestSequence) {
        latestSequence = card.playedAt;
        latestIndex = index;
      }
    });
    if (latestIndex >= 0) {
      const removed = board[latestIndex];
      board[latestIndex] = null;
      addLog(labelOf(actorKey) + " убирает с поля карту «" + removed.name + "».");
      return true;
    }
    return false;
  }

  function removeMostExpensiveEnemyCard(actorKey) {
    const board = players[enemyOf(actorKey)].board;
    let targetIndex = -1;
    board.forEach((card, index) => {
      if (card && (targetIndex < 0 || card.cost > board[targetIndex].cost)) targetIndex = index;
    });
    if (targetIndex < 0) return false;
    const removed = board[targetIndex];
    board[targetIndex] = null;
    addLog(labelOf(actorKey) + " уничтожает карту «" + removed.name + "» на поле противника.");
    return true;
  }

  function applyEffect(effect, actorKey, isCopy) {
    const targetKey = enemyOf(actorKey);
    const actor = players[actorKey];
    const target = players[targetKey];
    const prefix = isCopy ? "Эхо: " : "";

    switch (effect.type) {
      case "gain": {
        const before = actor.time;
        actor.time = Math.min(MAX_TIME, actor.time + effect.amount);
        addLog(prefix + labelOf(actorKey) + " восстанавливает " + (actor.time - before) + " сек.");
        break;
      }
      case "steal": {
        const moved = transferTime(actorKey, effect.amount);
        addLog(prefix + labelOf(actorKey) + " переносит к себе " + moved + " сек. времени.");
        break;
      }
      case "swap": {
        const ownTime = actor.time;
        actor.time = target.time;
        target.time = ownTime;
        addLog(prefix + labelOf(actorKey) + " меняется запасами времени с противником.");
        break;
      }
      case "discount":
        actor.discount = effect.amount;
        addLog(prefix + "Следующая карта " + labelOf(actorKey).toLowerCase() + " дешевле на " + effect.amount + " сек.");
        break;
      case "slow":
        target.penalty += effect.amount;
        addLog(prefix + "Следующая карта противника дороже на " + effect.amount + " сек.");
        break;
      case "delayed":
        target.delayed.push({ from: actorKey, amount: effect.amount });
        addLog(prefix + "Отложенный эффект сработает в начале следующего хода противника.");
        break;
      case "conditional": {
        const conditionMet = target.time < 20;
        const amount = conditionMet ? 7 : 3;
        const moved = transferTime(actorKey, amount);
        addLog(prefix + "Условие " + (conditionMet ? "выполнено" : "не выполнено") + ": перенесено " + moved + " сек.");
        break;
      }
      case "percent": {
        const amount = Math.ceil(target.time * effect.amount / 100);
        const moved = transferTime(actorKey, amount);
        addLog(prefix + "Перенесено " + moved + " сек. (" + effect.amount + "% времени противника).");
        break;
      }
      case "fieldGain": {
        const count = actor.board.filter(Boolean).length;
        const before = actor.time;
        actor.time = Math.min(MAX_TIME, actor.time + count * effect.amount);
        addLog(prefix + "Полевой сборщик: " + count + " карт на поле, получено " + (actor.time - before) + " сек.");
        break;
      }
      case "fieldDrain": {
        const removed = removeMostExpensiveEnemyCard(actorKey);
        const moved = transferTime(actorKey, effect.amount);
        addLog(prefix + (removed ? "Саботаж." : "Поле врага пусто.") + " Перенесено " + moved + " сек.");
        break;
      }
      case "fieldTax": {
        const count = target.board.filter(Boolean).length;
        const drained = Math.min(count * effect.amount, target.time);
        target.time -= drained;
        addLog(prefix + "Давление разлома: противник теряет " + drained + " сек. за " + count + " карт на поле.");
        break;
      }
      case "cancel": {
        const removed = removeLatestEnemyCard(actorKey);
        const before = actor.time;
        actor.time = Math.min(MAX_TIME, actor.time + effect.amount);
        addLog(prefix + (removed ? "Срыв: " : "Нечего убирать: ") + "получено " + (actor.time - before) + " сек.");
        break;
      }
      default:
        break;
    }
  }

  function playSound(kind) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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
    selectedCardId = null;
    resolveDelayed(key);
    if (checkGameOver()) return;
    render();
    if (key === "player") {
      setMessage("Твой ход. Разыграй одну карту или пропусти ход.");
    } else {
      setMessage("Противник выбирает карту…");
      aiTimer = setTimeout(runAI, 20 + Math.floor(Math.random() * 81));
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
    actor.hand.splice(handIndex, 1);

    card.playedAt = ++sequence;
    actor.board[slotIndex] = card;

    addLog(labelOf(actorKey) + " разыгрывает «" + card.name + "» за " + cost + " сек.");

    if (card.type === "copy") {
      if (lastEffect) applyEffect(lastEffect, actorKey, true);
      else addLog("Эхо не нашло предыдущего эффекта.");
    } else {
      applyEffect(card, actorKey, false);
      if (card.type !== "cancel") lastEffect = { type: card.type, amount: card.amount };
    }

    if (checkGameOver()) return true;
    drawCard(actorKey);
    animatedCardId = card.id;
    playSound("card");
    startTurn(enemyOf(actorKey));
    return true;
  }

  function passTurn() {
    if (turn !== "player" || gameFinished) return;
    drawCard("player");
    addLog("Ты пропускаешь ход.");
    playSound("pass");
    render();
    startTurn("opponent");
  }

  function scoreCard(card, key) {
    const actor = players[key];
    const target = players[enemyOf(key)];
    const cost = cardCost(key, card);
    let score = Math.random() * 0.8 - cost * 0.16;
    switch (card.type) {
      case "gain": score += (START_TIME - actor.time) * 0.09 + card.amount * 0.8; break;
      case "steal": score += Math.min(card.amount, target.time) * 1.1; break;
      case "swap": score += (target.time - actor.time) * 0.12; break;
      case "discount": score += actor.time < 20 ? 0.5 : 2.5; break;
      case "slow": score += target.time > 10 ? 2.5 : 0.5; break;
      case "copy": score += lastEffect ? 3.2 : -100; break;
      case "cancel": score += target.board.some(Boolean) ? 2.5 : 0.5; break;
      case "delayed": score += target.time > 5 ? 3.1 : 0.5; break;
      case "conditional": score += target.time < 20 ? 7 : 2.8; break;
      case "percent": score += target.time * 0.045; break;
      case "fieldGain": score += actor.board.filter(Boolean).length * 0.8; break;
      case "fieldDrain": score += target.board.filter(Boolean).length * 1.4; break;
      case "fieldTax": score += target.board.filter(Boolean).length * 1.1; break;
      default: break;
    }
    return score;
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

    affordable.sort((a, b) => scoreCard(b, "opponent") - scoreCard(a, "opponent"));
    const chosen = affordable[0];
    let slotIndex = actor.board.findIndex((item) => !item);
    if (slotIndex < 0) {
      slotIndex = actor.board.reduce((oldest, item, index, board) =>
        !item || (board[oldest] && item.playedAt < board[oldest].playedAt) ? index : oldest, 0);
      const removed = actor.board[slotIndex];
      actor.board[slotIndex] = null;
      actor.time = Math.max(0, actor.time - 1);
      addLog("Противник освобождает слот, сбрасывая «" + removed.name + "» за 1 сек.");
      if (checkGameOver()) return;
    }
    playCard(chosen.id, slotIndex, "opponent");
  }

  function resetGame() {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    sequence = 0;
    logs = [];
    selectedCardId = null;
    lastEffect = null;
    gameFinished = false;
    players = {
      player: makePlayer("Ты"),
      opponent: makePlayer("Противник")
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
    $("new-game").addEventListener("click", resetGame);
    $("pass-turn").addEventListener("click", passTurn);

    $("battlefield").addEventListener("click", (event) => {
      const slot = event.target.closest(".slot");
      if (!slot || slot.dataset.owner !== "player" || turn !== "player" || gameFinished) return;
      const slotIndex = Number(slot.dataset.slot);
      if (!selectedCardId) {
        if (players.player.board[slotIndex]) {
          const removed = players.player.board[slotIndex];
          players.player.board[slotIndex] = null;
          players.player.time = Math.max(0, players.player.time - 1);
          addLog("Ты освобождаешь слот, сбрасывая «" + removed.name + "» за 1 сек.");
          playSound("pass");
          checkGameOver();
          render();
          if (!gameFinished) setMessage("Слот освобождён. Теперь можно разыграть карту.");
        } else setMessage("Выбери карту в руке, затем нажми на пустой слот.");
        return;
      }
      playCard(selectedCardId, slotIndex, "player");
    });

    $("battlefield").addEventListener("dragover", (event) => {
      const slot = event.target.closest(".slot.player-slot");
      if (!slot || turn !== "player" || gameFinished) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("drop-target");
    });

    $("battlefield").addEventListener("dragleave", (event) => {
      const slot = event.target.closest(".slot");
      if (slot && !slot.contains(event.relatedTarget)) slot.classList.remove("drop-target");
    });

    $("battlefield").addEventListener("drop", (event) => {
      const slot = event.target.closest(".slot.player-slot");
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
  });
})();