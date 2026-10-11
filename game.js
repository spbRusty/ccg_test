(() => {
  "use strict";

  const START_TIME = 60;
  const HAND_SIZE = 5;
  const MAX_HAND = 7;
  const MAX_TIME = 60;
  const CARD_TYPES = (() => {
    const definitions = {}, effects=["gain","steal","swap","discount","slow","copy","cancel","delayed","conditional","percent","fieldGain","fieldDrain","fieldTax","mill","hijack","accumulate","discharge","transferCharge","massDestroy","return","move","evolve","combo","shield","overheat","massPlay","trap","ruleChange","random","duplicate","sacrifice"];
    const prefixes=["Аварийный","Квантовый","Паразитный","Реверсивный","Хрональный","Нестабильный","Зеркальный","Гравитационный","Пульсирующий","Забытый","Призрачный","Каскадный","Резонансный","Синтетический","Сломанный","Петлевой","Теневой","Искровой","Пограничный","Нулевой","Распадающийся","Сверхпроводящий","Искажённый","Последний","Невозможный","Скрытый","Переписанный","Непредсказуемый","Копирующий","Жертвенный","Запредельный"];
    const nouns=["Импульс","Контур","Реактор","Протокол","Модуль","Сдвиг","Узел","Фантом","Каскад","Сигнал","Парадокс","Резонатор","Разлом","Триггер","Механизм","Осколок","Преобразователь"];
    const colors=["#8ce0a0","#62d9e8","#ff8c78","#f0c875","#a9a0ff","#d59aff","#80b7ff","#ff727e","#68d9c1","#e6a0ff"];
    const symbols=["↗","⇢","⇄","»","…","⟲","×","◷","!","%","⌂","⌁","⚡","⌫","⇥","◉","↯","⤳","✣","⤺","⌘","⟳","⌁","◇","☄","⇶","♧","⤴","?","⧉","†"];
    function describe(t,n){const d={gain:"Восстанови "+n+" секунд времени.",steal:"Перенеси к себе "+n+" секунд от противника.",swap:"Поменяйся запасами времени с противником.",discount:"Следующая твоя карта дешевле на "+n+" секунд.",slow:"Следующая карта противника дороже на "+n+" секунд.",copy:"Повтори эффект последней разыгранной карты.",cancel:"Удали последнюю карту противника с поля и получи "+n+" секунд.",delayed:"В начале следующего хода противник потеряет "+n+" секунд, ты получишь их.",conditional:"Забери "+n+" секунд; если у врага меньше 20 секунд, эффект удвоится.",percent:"Забери "+n+"% оставшегося времени противника.",fieldGain:"Получи "+n+" секунду за каждую свою карту на поле, включая эту.",fieldDrain:"Уничтожь самую дорогую карту врага и получи "+n+" секунд.",fieldTax:"Противник теряет "+n+" секунд за каждую свою карту на поле.",mill:"Сожги "+n+" верхние карты колоды противника.",hijack:"Укради случайную карту из руки противника.",accumulate:"Каждый твой ход получает "+n+" заряда. При 3+ зарядах даёт бонус.",discharge:"Потрать накопленные заряды: каждый даёт "+n+" секунд.",transferCharge:"Передай "+n+" заряда другой своей карте.",massDestroy:"Уничтожь до "+n+" случайных карт противника.",return:"Верни до "+n+" своих карт с поля в руку.",move:"Перемести свою карту в другой слот и получи "+n+" секунд.",evolve:"Усиль выбранную свою карту: каждый уровень даёт дополнительный заряд.",combo:"Получи "+n+" секунд за каждую другую свою карту на поле.",shield:"Дай выбранной карте щит от одного уничтожения.",overheat:"Сними до "+n+" своих карт; за каждую получи заряд.",massPlay:"Добери "+n+" карт и снизь стоимость следующей карты на "+n+" секунд.",trap:"Установи скрытую ловушку: следующая карта противника будет остановлена.",ruleChange:"Усиль следующий эффект: добавь "+n+" к его числовому значению.",random:"Случайная аномалия: эффект выбирается при розыгрыше.",duplicate:"Создай копию другой своей карты на поле.",sacrifice:"Пожертвуй другой своей картой и получи "+n+" секунд плюс её заряды."};return d[t]||"Измени течение времени.";}
    effects.forEach((type,ei)=>{for(let v=0;v<(ei<4?17:16);v++){const key="card_"+String(Object.keys(definitions).length+1).padStart(3,"0"),amount=1+((ei*7+v*3)%(type==="percent"?24:["mill","massDestroy","return","overheat","massPlay"].includes(type)?4:9)),cost=1+((ei*3+v*5)%8);definitions[key]={key,name:prefixes[ei]+" "+nouns[v],cost,type,amount,symbol:symbols[ei],description:describe(type,amount),color:colors[(ei+v)%colors.length],variant:v+1};}});
    return definitions;
  })();
  const CARD_POOL = Object.keys(CARD_TYPES);
  const selectedCardIds = new Set();
  const selectedBoardSlots = new Set();
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
    return shuffle(CARD_POOL.slice()).slice(0,30).map(key=>({...CARD_TYPES[key],key,id:"card-"+(++sequence),charges:0,shield:0,evolution:0}));
  }

  function makePlayer(name) {
    return {
      name,
      time: START_TIME,
      hand: [],
      deck: makeDeck(),
      board: Array(6).fill(null),
      played: [],
      discard: [],
      discount: 0,
      penalty: 0,
      delayed: [],
      turnPlays: 0,
      hiddenTrap: 0,
      ruleBonus: 0
    };
  }

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

  function makeCardFace(card, showDescription) {
    const face = document.createElement("div");
    face.className = "card-face";
    face.dataset.cardKey = card.key;
    face.style.setProperty("--card-glow", card.color);

    const top = document.createElement("div");
    top.className = "card-top";
    const cost = document.createElement("span");
    cost.className = "card-cost";
    cost.textContent = card.cost + "с";
    cost.title = "Базовая стоимость";
    top.appendChild(cost);

    const body = document.createElement("div");
    body.className = "card-body";
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

    const art = document.createElement("img");
    art.className = "card-art";
    art.src = "image2.avif";
    art.alt = "";
    art.loading = "lazy";
    art.decoding = "async";

    const shine = document.createElement("span");
    shine.className = "card-shine";
    shine.setAttribute("aria-hidden", "true");

    face.append(art, shine, top, body);
    if(card.charges>0){const c=document.createElement("span");c.className="card-charge";c.textContent="⚡ "+card.charges;face.appendChild(c);}
    if(card.evolution>0){const c=document.createElement("span");c.className="card-evolution";c.textContent="✦"+card.evolution;face.appendChild(c);}
    return face;
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
    document.querySelectorAll(".slot").forEach((slot) => {
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
    $("opponent-hand-count").textContent = players.opponent.hand.length;
    const countLabel=$("selected-cards-count");if(countLabel)countLabel.textContent=selectedCardIds.size?"Выбрано: "+selectedCardIds.size:"";
    const playButton=$("play-selected");if(playButton)playButton.disabled=turn!=="player"||gameFinished||!selectedCardIds.size;

  }

  function renderStats() {
    $("player-time").textContent = players.player.time;
    $("opponent-time").textContent = players.opponent.time;
    $("player-time-bar").style.width = Math.max(0, players.player.time / START_TIME * 100) + "%";
    $("opponent-time-bar").style.width = Math.max(0, players.opponent.time / START_TIME * 100) + "%";
    const mobileOpponentTime = $("mobile-opponent-time");
    const mobilePlayerTime = $("mobile-player-time");
    const mobileOpponentFill = $("mobile-opponent-fill");
    const mobilePlayerFill = $("mobile-player-fill");
    if (mobileOpponentTime) mobileOpponentTime.textContent = players.opponent.time;
    if (mobilePlayerTime) mobilePlayerTime.textContent = players.player.time;
    if (mobileOpponentFill) mobileOpponentFill.style.width = Math.max(0, players.opponent.time / START_TIME * 100) + "%";
    if (mobilePlayerFill) mobilePlayerFill.style.width = Math.max(0, players.player.time / START_TIME * 100) + "%";
    $("player-status").textContent = gameFinished ? "Игра завершена" : turn === "player" ? "Твой ход" : "Ход противника";
    $("opponent-status").textContent = gameFinished ? "Игра завершена" : turn === "opponent" ? "Ходит…" : "Ожидает ход";
    $("pass-turn").disabled=turn!=="player"||gameFinished;
    ["move-selected","return-selected","remove-selected","sacrifice-selected"].forEach(id=>{const b=$(id);if(b)b.disabled=turn!=="player"||gameFinished||!selectedBoardSlots.size;});
    const clearButton=$("clear-board-selection");if(clearButton)clearButton.disabled=!selectedBoardSlots.size;
    $("new-game").disabled = false;
  }

  let collectionMode = "player";

  function groupedCards(cards) {
    const groups = new Map();
    cards.forEach((card) => {
      if (!groups.has(card.key)) groups.set(card.key, { card, count: 0 });
      groups.get(card.key).count += 1;
    });
    return Array.from(groups.values()).sort((a, b) => a.card.name.localeCompare(b.card.name, "ru"));
  }

  function renderCollection() {
    const list = $("collection-list");
    if (!list) return;
    $("tab-player-deck").classList.toggle("active", collectionMode === "player");
    $("tab-player-deck").setAttribute("aria-selected", String(collectionMode === "player"));
    $("tab-opponent-deck").classList.toggle("active", collectionMode === "opponent");
    $("tab-opponent-deck").setAttribute("aria-selected", String(collectionMode === "opponent"));
    list.replaceChildren();
    // Счётчики соответствуют количеству карт, отображаемых во вкладках.
    const playerCards=CARD_POOL.map(key=>({...CARD_TYPES[key],key}));
    $("player-collection-count").textContent=playerCards.length;$("opponent-collection-count").textContent=players.opponent.played.length;
    const allCards=collectionMode==="player"?playerCards:players.opponent.played;
    const query=($("card-search")?.value||"").trim().toLocaleLowerCase("ru");
    const cards=query?allCards.filter(c=>(c.name+" "+c.description+" "+c.type).toLocaleLowerCase("ru").includes(query)):allCards;
    const groups = groupedCards(cards);
    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "collection-empty";
      empty.textContent=collectionMode==="player"?"В библиотеке пока нет карт.":"Противник ещё не разыграл ни одной карты.";
      list.appendChild(empty);
      return;
    }
    groups.forEach(({ card, count }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "collection-card";
      item.dataset.cardKey = card.key;
      item.appendChild(makeCardFace(card, false));
      const badge = document.createElement("span");
      badge.className = "collection-count";
      badge.textContent = "×" + count;
      badge.setAttribute("aria-label", count + " шт.");
      item.appendChild(badge);
      item.addEventListener("mouseenter", () => showCardDetails(card.key));
      item.addEventListener("focus", () => showCardDetails(card.key));
      list.appendChild(item);
    });
  }

  function showCardDetails(key) {
    const card = CARD_TYPES[key];
    const content = $("card-details-content");
    if (!card || !content) return;
    content.replaceChildren();

    const preview = makeCardFace(card, true);
    preview.classList.add("details-card-preview");
    preview.setAttribute("aria-label", card.name + ". " + card.description + " Стоимость: " + card.cost + " секунд.");

    const category = document.createElement("p");
    category.className = "details-category";
    category.textContent="Тип "+card.variant+" · "+card.type;

    const effect = document.createElement("div");
    effect.className = "details-stats";
    const stat = document.createElement("span");
    stat.className = "details-stat";
    stat.textContent = "Сила эффекта: " + card.amount;
    effect.appendChild(stat);

    content.append(preview, category, effect);
  }

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
      case "mill": {
        const count = Math.min(effect.amount, target.deck.length);
        for (let i = 0; i < count; i++) target.discard.push(target.deck.pop());
        addLog(prefix + labelOf(actorKey) + " сжигает " + count + " карт из колоды противника.");
        break;
      }
      case "hijack": {
        if (target.hand.length === 0) {
          addLog(prefix + "Перехват: у противника нет карт в руке.");
          break;
        }
        if (actor.hand.length >= MAX_HAND) {
          addLog(prefix + "Перехват не удался: твоя рука заполнена.");
          break;
        }
        const index = Math.floor(Math.random() * target.hand.length);
        const stolen = target.hand.splice(index, 1)[0];
        actor.hand.push(stolen);
        addLog(prefix + labelOf(actorKey) + " крадёт у противника карту «" + stolen.name + "».");
        break;
      }
      case "cancel": {const removed=removeLatestEnemyCard(actorKey),before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount);addLog(prefix+(removed?"Срыв: ":"Нечего убирать: ")+"получено "+(actor.time-before)+" сек.");break;}
      case "accumulate":{const c=actor.board.find(x=>x&&x.id===effect.id);if(c)c.charges=(c.charges||0)+effect.amount;addLog(prefix+"Накопление: +"+effect.amount+" заряда.");break;}
      case "discharge":{let n=0;actor.board.forEach(c=>{if(c){n+=(c.charges||0);c.charges=0;}});const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+n*effect.amount);addLog(prefix+"Разряд: потрачено "+n+" зарядов, +"+(actor.time-before)+" сек.");break;}
      case "transferCharge":{const c=actor.board.find(x=>x&&x.id===effect.id),o=actor.board.find(x=>x&&x.id!==effect.id&&(x.charges||0)>0);if(c&&o){const n=Math.min(effect.amount,o.charges);o.charges-=n;c.charges=(c.charges||0)+n;addLog(prefix+"Передано "+n+" зарядов.");}else addLog(prefix+"Нет заряженной карты для передачи.");break;}
      case "massDestroy":{const list=target.board.map((c,i)=>({c,i})).filter(x=>x.c&&x.c.shield<=0).sort(()=>Math.random()-.5).slice(0,effect.amount);list.forEach(({c,i})=>{target.board[i]=null;target.discard.push(c);});addLog(prefix+"Уничтожено карт противника: "+list.length+".");break;}
      case "return":{let n=0;actor.board.forEach((c,i)=>{if(c&&n<effect.amount&&actor.hand.length<MAX_HAND){actor.board[i]=null;actor.hand.push(c);n++;}});addLog(prefix+"Возвращено в руку карт: "+n+".");break;}
      case "move":{const f=actor.board.findIndex(c=>c&&c.id!==effect.id),t=actor.board.findIndex(c=>!c);if(f>=0&&t>=0){actor.board[t]=actor.board[f];actor.board[f]=null;}const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount);addLog(prefix+"Сдвиг: "+(f>=0&&t>=0?"карта перемещена":"перемещение невозможно")+"; +"+(actor.time-before)+" сек.");break;}
      case "evolve":{const c=actor.board.find(x=>x&&x.id!==effect.id);if(c){c.evolution=(c.evolution||0)+1;c.charges=(c.charges||0)+effect.amount;}addLog(prefix+(c?"Эволюция «"+c.name+"».":"Нет карты для эволюции."));break;}
      case "combo":{const n=Math.max(0,actor.board.filter(c=>c&&c.id!==effect.id).length),before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+n*effect.amount);addLog(prefix+"Цепная реакция: "+n+" карт, +"+(actor.time-before)+" сек.");break;}
      case "shield":{const c=actor.board.find(x=>x&&x.id!==effect.id);if(c)c.shield=(c.shield||0)+1;addLog(prefix+(c?"Щит установлен на «"+c.name+"».":"Нет карты для защиты."));break;}
      case "overheat":{let n=0;actor.board.forEach((c,i)=>{if(c&&c.id!==effect.id&&n<effect.amount){actor.board[i]=null;actor.discard.push(c);n++;}});const c=actor.board.find(x=>x&&x.id===effect.id);if(c)c.charges=(c.charges||0)+n;addLog(prefix+"Перегрузка: снято карт "+n+", зарядов +"+n+".");break;}
      case "massPlay":{for(let i=0;i<effect.amount;i++)drawCard(actorKey);actor.discount=Math.max(actor.discount,effect.amount);addLog(prefix+"Добор карт и скидка на следующую карту: "+effect.amount+".");break;}
      case "trap":{actor.hiddenTrap=effect.amount;addLog(prefix+"Скрытая ловушка установлена.");break;}
      case "ruleChange":{actor.ruleBonus=effect.amount;addLog(prefix+"Следующий эффект усилен на "+effect.amount+".");break;}
      case "random":{const r=Math.floor(Math.random()*4);if(r===0){const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount);addLog(prefix+"Аномалия: +"+(actor.time-before)+" сек.");}else if(r===1){const n=transferTime(actorKey,effect.amount);addLog(prefix+"Аномалия: перенесено "+n+" сек.");}else if(r===2){const n=Math.min(effect.amount,target.time);target.time-=n;addLog(prefix+"Аномалия: враг теряет "+n+" сек.");}else{const list=target.board.map((c,i)=>({c,i})).filter(x=>x.c&&x.c.shield<=0);if(list.length){const x=list[Math.floor(Math.random()*list.length)];target.board[x.i]=null;target.discard.push(x.c);addLog(prefix+"Аномалия уничтожает «"+x.c.name+"».");}else addLog(prefix+"Аномалия не находит цель.");}break;}
      case "duplicate":{const source=actor.board.find(c=>c&&c.id!==effect.id),slot=actor.board.findIndex(c=>!c);if(source&&slot>=0){actor.board[slot]={...source,id:"card-"+(++sequence),playedAt:++sequence,charges:source.charges||0,shield:0};addLog(prefix+"Создана копия «"+source.name+"».");}else addLog(prefix+"Нет цели или слота для копии.");break;}
      case "sacrifice":{const index=actor.board.findIndex(c=>c&&c.id!==effect.id);if(index>=0){const c=actor.board[index];actor.board[index]=null;actor.discard.push(c);const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount+(c.charges||0));addLog(prefix+"Пожертвована «"+c.name+"», получено "+(actor.time-before)+" сек.");}else addLog(prefix+"Нет карты для жертвоприношения.");break;}
      default:break;
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
    if(!trapped){if(card.type==="copy"){if(lastEffect)applyEffect(lastEffect,actorKey,true);else addLog("Эхо не нашло предыдущего эффекта.");}
    else{const resolved={...card,amount:card.amount+(actor.ruleBonus||0)};actor.ruleBonus=0;applyEffect(resolved,actorKey,false);if(card.type!=="cancel")lastEffect={type:card.type,amount:card.amount,id:card.id};}}
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
      case "mill": score += Math.min(card.amount, target.deck.length) * 1.4; break;
      case "hijack": score += target.hand.length > 0 && actor.hand.length < MAX_HAND ? 3.6 : -1; break;
      case "accumulate": score+=3;break;case "discharge":score+=(card.charges||0)*card.amount;break;
      case "transferCharge":score+=actor.board.some(c=>c&&(c.charges||0)>0)?2:0;break;
      case "massDestroy":score+=target.board.filter(Boolean).length*1.2;break;case "return":score+=actor.board.filter(Boolean).length*.7;break;
      case "move":score+=1;break;case "evolve":score+=actor.board.filter(Boolean).length*.8;break;
      case "combo":score+=actor.board.filter(Boolean).length*card.amount*.4;break;case "shield":score+=2;break;
      case "overheat":score+=actor.board.filter(Boolean).length*.8;break;
      case "massPlay":score+=actor.hand.length<5?3:1;break;case "trap":score+=2.4;break;case "ruleChange":score+=2;break;case "random":score+=1.8;break;case "duplicate":score+=actor.board.filter(Boolean).length?2.5:-1;break;case "sacrifice":score+=actor.board.filter(Boolean).length?2:0;break;
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
    let plays=0;
    while(plays<3&&turn==="opponent"&&!gameFinished){
      const choices=actor.hand.filter(c=>cardCost("opponent",c)<=actor.time).sort((a,b)=>scoreCard(b,"opponent")-scoreCard(a,"opponent"));if(!choices.length)break;
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
    $("tab-player-deck").addEventListener("click", () => { collectionMode = "player"; renderCollection(); });
    $("tab-opponent-deck").addEventListener("click", () => { collectionMode = "opponent"; renderCollection(); });
    document.addEventListener("mouseover", (event) => {
      const face = event.target.closest(".card-face[data-card-key]");
      if (face) showCardDetails(face.dataset.cardKey);
    });
    document.addEventListener("focusin", (event) => {
      const face = event.target.closest(".card-face[data-card-key]");
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
      const slot = event.target.closest(".slot");
      if (!slot || slot.dataset.owner !== "player" || turn !== "player" || gameFinished) return;
      const slotIndex = Number(slot.dataset.slot);
      const boardCard=players.player.board[slotIndex];
      if(selectedCardIds.size){if(boardCard){setMessage("Слот занят. Выбери пустой слот.");return;}let placed=0;for(const id of Array.from(selectedCardIds)){const free=players.player.board.findIndex(c=>!c);if(free<0||!playCard(id,free,"player"))break;selectedCardIds.delete(id);placed++;}selectedCardId=null;render();setMessage("Разыграно карт: "+placed+". Ход продолжается.");return;}
      if(boardCard){if(selectedBoardSlots.has(slotIndex))selectedBoardSlots.delete(slotIndex);else selectedBoardSlots.add(slotIndex);render();setMessage("Выбрано карт на поле: "+selectedBoardSlots.size+".");return;}
      if(boardMoveSlot!==null){const moving=players.player.board[boardMoveSlot];if(moving){players.player.board[slotIndex]=moving;players.player.board[boardMoveSlot]=null;selectedBoardSlots.clear();boardMoveSlot=null;render();setMessage("Карта перемещена.");return;}boardMoveSlot=null;}
      if(selectedCardId)playCard(selectedCardId,slotIndex,"player");else setMessage("Выбери карты в руке или выдели карты на поле.");
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