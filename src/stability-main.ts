import { createGame, selectCard, removeOwn, commit, aiCommit, resolveRound, type Game, type Settings, type Card } from "./game/stability";
import { CARDS } from "./game/cards";
import "./../style.css";

const root = document.querySelector<HTMLDivElement>("#ui")!;
const menu = document.querySelector<HTMLElement>("#main-menu")!;
const base = ((import.meta as any).env.BASE_URL || "/") as string;

let settings: Settings = { startStability: 15, maxPlays: 0, handLimit: 6, deckSize: 30 };
let game: Game;
let busy = false;
let notice = "Выбери карты и закрой выбор.";
let selectedCard: string | null = null;
let archiveTab: "deck" | "enemy" = "deck";
let previewCard: Card | null = null;
let dragCardId: string | null = null;
let dragOrigin: HTMLElement | null = null;
let dragMoved = false;
let dragSource: "hand" | "committed" | null = null;
let returnDragId: string | null = null;
let returnDragGhost: HTMLElement | null = null;

type Language="ru"|"en"; let language:Language=(localStorage.getItem("stability-language") as Language)||"ru";
let startStability:15|20=localStorage.getItem("stability-start")==="20"?20:15; let maxPlaysSetting:0|2=localStorage.getItem("stability-max-two")==="1"?2:0;
let currentPage="home"; let savedDeck:string[]=JSON.parse(localStorage.getItem("stability-deck")||"[]");
let soundEnabled=localStorage.getItem("stability-sound")!=="off"; let soundVolume=Number(localStorage.getItem("stability-sound-volume")||".55"),musicVolume=Number(localStorage.getItem("stability-music-volume")||".16");
let audioContext:AudioContext|null=null,musicTimer=0,musicStep=0;
const EN_CARDS:Record<string,[string,string]>={camp:["Camp Keeper","End of turn: restore 2 Stability."],dog:["Frost Hound","End of turn: enemy loses 2 Stability."],raid:["Raid","On play: enemy loses 3 Stability."],recall:["Recall","On play: return an old card from your field to your hand."],medic:["Field Medic","On play: restore 3 Stability."],sniper:["Sniper","On play: enemy loses 4 Stability."],scavenger:["Scavenger","On play: draw 1 card."],tower:["Watchtower","End of turn: enemy loses 1 Stability for each card on your field."],hunger:["Hunger","End of turn: enemy loses 1 Stability for each card on their field."],quiet:["Quiet Hour","End of turn: restore 1 Stability."],saboteur:["Saboteur","On play: remove an old enemy card."],recycler:["Recycler","On play: return an old card from your field to your hand."],signal:["Signalman","On play: empower your next card by +2."],charge:["Delayed Charge","On play: enemy loses 4 Stability next round."],battery:["Old Battery","End of turn: restore 2 Stability."],ambush:["Ambush","On play: enemy loses 2 Stability."],convoy:["Convoy","End of turn: enemy loses 3 Stability."],ration:["Dry Rations","On play: restore 2 Stability."],mediator:["Mediator","On play: transfer 2 Stability from enemy to you."],barrier:["Living Barrier","From next round: absorbs the next hit, then leaves."],map:["Old Map","On play: draw 1 card."],blackout:["Blackout","On play: enemy loses 5 Stability."],watch:["Long Watch","End of turn: enemy loses 2 Stability and you restore 2."],kitchen:["Field Kitchen","End of turn: restore 1 Stability for each of your cards."],toll:["Toll Gate","On play: enemy loses 1 Stability for each of their cards."],sleeper:["Sleeper Agent","End of turn: enemy loses 1 Stability."],reserves:["Reserves","On play: draw 2 cards."],cleaner:["Cleaner","On play: remove up to 2 old enemy cards."],hope:["Last Hope","On play: restore 5 Stability."],pulse:["Pulse Generator","End of turn: enemy loses 1 Stability for each of your cards."]};
const EN_UI:Record<string,string>={"СТАБИЛЬНОСТЬ":"STABILITY","ДУЭЛЬ В ПУСТОШИ":"WASTELAND DUEL","☰ МЕНЮ":"☰ MENU","↻ НОВАЯ ДУЭЛЬ":"↻ NEW DUEL","РАУНД":"ROUND","СВОДКА":"SUMMARY","Журнал боя":"Battle log","ЦЕЛЬ":"OBJECTIVE","Обнули Стабильность чужого лагеря. Цена каждой карты списывается сразу при выборе.":"Reduce the enemy camp's Stability to zero. Card costs are paid when selected.","ТВОЯ СТАБИЛЬНОСТЬ":"YOUR STABILITY","СТАБИЛЬНОСТЬ ПРОТИВНИКА":"ENEMY STABILITY","ТВОЙ РЕСУРС":"YOUR RESOURCES","Карты в руке":"Cards in hand","СВОБОДНО":"EMPTY SLOT","Арсенал":"Arsenal","Поле противника":"Enemy field","Твоё игровое поле":"Your field","Сюда нельзя сыграть эту карту.":"This card cannot be played here.","Перетащи карту обратно в руку, чтобы отменить выбор.":"Drag the card back to your hand to undo the selection.","АРСЕНАЛ":"ARSENAL","КАРТЫ":"CARDS","МОЯ КОЛОДА":"MY DECK","КАРТЫ ПРОТИВНИКА":"ENEMY CARDS","Наведи курсор на карту, чтобы посмотреть её.":"Hover over a card to inspect it.","Противник ещё не сыграл ни одной карты.":"The opponent has not played any cards yet.","КЛАПАН":"VALVE","ЗАВЕРШИТЬ ХОД":"END TURN","Дуэль завершена.":"Duel finished.","Раунд завершён. Выбери следующий ход.":"Round finished. Choose your next move.","Ход завершён. Карты вскрываются…":"Turn submitted. Revealing cards…","Выбери карты и закрой выбор.":"Choose cards, then end your turn.","Карта отправлена в сброс.":"Card sent to discard.","Клапан: карта взята за 2 Стабильности.":"Valve: drew a card for 2 Stability.","Колода и сброс пусты: оплата возвращена.":"Deck and discard are empty; cost refunded.","ДУЭЛЬ ЗАВЕРШЕНА":"DUEL OVER","НИЧЬЯ":"DRAW","ЛАГЕРЬ УСТОЯЛ":"CAMP SURVIVED","ЛАГЕРЬ ПАЛ":"CAMP FELL","Твой лагерь сохранил стабильность.":"Your camp held its ground.","Оба лагеря потеряли устойчивость.":"Both camps lost stability.","Карта убрана из выбора.":"Card returned to hand.","Карта выбрана закрыто; цена списана.":"Card committed; cost paid.","Лимит карт за раунд.":"Round card limit reached.","Сначала освободи слот.":"Free up a slot first.","Нельзя уйти ниже 1 Стабильности.":"Stability cannot fall below 1.","Карты нет в руке.":"Card is not in your hand.","Выбор закрыт.":"Your turn is locked.","Живая преграда поглотила удар.":"Living Barrier absorbed the hit.","Карта разыграна.":"Card played.","Клапан: карта взята за 2 Стабильности.":"Valve: drew a card for 2 Stability.","Колода и сброс пусты: оплата возвращена.":"Deck and discard are empty; cost refunded.","Раунд ":"Round "," завершён.":" finished.","Стабильность твоего лагеря обнулилась.":"Your camp's Stability reached zero."};
function cardName(card:Card):string{return language==="en"?(EN_CARDS[card.id]?.[0]||card.name):card.name}
function cardText(card:Card):string{return language==="en"?(EN_CARDS[card.id]?.[1]||card.text):card.text}
function localizeHTML(s:string):string{if(language!=="en")return s;for(const [a,b] of Object.entries(EN_UI).sort((x,y)=>y[0].length-x[0].length))s=s.split(a).join(b);return s}
function audio():AudioContext|null{try{if(!audioContext)audioContext=new AudioContext();if(audioContext.state==="suspended")void audioContext.resume();return audioContext}catch{return null}}
function tone(f:number,d:number,v:number,type:OscillatorType="sine",delay=0):void{const a=audio();if(!a||v<=0)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,a.currentTime+delay);g.gain.setValueAtTime(.0001,a.currentTime+delay);g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),a.currentTime+delay+.018);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+delay+d);o.connect(g);g.connect(a.destination);o.start(a.currentTime+delay);o.stop(a.currentTime+delay+d+.03)}
function playCardSound(i=0):void{if(!soundEnabled)return;const f=[392,494,587,440,523,659][i%6];tone(f,.19,soundVolume*.22,"triangle");tone(f*1.5,.28,soundVolume*.11,"sine",.055);tone(f*.5,.22,soundVolume*.12,"sine",.02)}
function startMusic():void{if(!musicTimer)musicTimer=window.setInterval(()=>{if(!musicVolume)return;const n=[196,247,294,370,330,247,220,294,165,247,330,392][musicStep++%12];tone(n,.42,musicVolume*.065,"triangle");if(musicStep%3===0)tone(n*2,.24,musicVolume*.022,"sine",.12)},430)}
function saveSettings():void{localStorage.setItem("stability-language",language);localStorage.setItem("stability-start",String(startStability));localStorage.setItem("stability-max-two",maxPlaysSetting?"1":"0");localStorage.setItem("stability-sound-volume",String(soundVolume));localStorage.setItem("stability-music-volume",String(musicVolume))}
function saveDeck():void{localStorage.setItem("stability-deck",JSON.stringify(savedDeck))}
function mini(id:string,drag=true):string{const d=CARDS.find(x=>x.id===id);if(!d)return"";const x={...d,uid:d.id,playedRound:0} as Card;return '<button class="deck-card" type="button" data-deck-card="'+id+'" '+(drag?'draggable="true"':'')+'><b class="deck-cost">'+d.cost+'</b><strong class="deck-title">'+esc(cardName(x))+'</strong><span class="deck-description">'+esc(cardText(x))+'</span></button>'}
function renderMenu(page=currentPage):void{
currentPage=page;const ru=language==="ru",title=ru?"СТАБИЛЬНОСТЬ":"STABILITY";let body="";
if(page==="home")body='<div class="menu-hero"><div class="menu-emblem">S</div><div class="menu-eyebrow">'+(ru?"КОЛЛЕКЦИОННАЯ КАРТОЧНАЯ ИГРА":"COLLECTIBLE CARD GAME")+'</div><h1>'+title+'</h1><p>'+(ru?"Постапокалиптическая карточная дуэль":"A post-apocalyptic card duel")+'</p></div><div class="menu-nav"><button data-page="pvp">PVP — '+(ru?"СЕТЕВАЯ ИГРА":"ONLINE")+'</button><button class="featured" data-page="single">'+(ru?"ОДИНОЧНАЯ ИГРА":"SINGLE PLAYER")+' →</button><button data-page="collection">'+(ru?"КОЛЛЕКЦИЯ":"COLLECTION")+'</button><button data-page="decks">'+(ru?"КОЛОДЫ":"DECKS")+'</button><button data-page="settings">'+(ru?"НАСТРОЙКИ":"SETTINGS")+'</button></div><div class="menu-foot">'+(ru?"Одна шкала. Шесть слотов. Ни шага назад.":"One meter. Six slots. No way back.")+'</div>';
if(page==="single")body='<button class="back-button" data-page="home">← '+(ru?"В ГЛАВНОЕ МЕНЮ":"MAIN MENU")+'</button><h2>'+(ru?"ОДИНОЧНАЯ ИГРА":"SINGLE PLAYER")+'</h2><div class="settings-panel"><label>'+(ru?"Начальная стабильность":"Starting Stability")+'<select id="start-stability"><option value="15" '+(startStability===15?"selected":"")+'>15 — '+(ru?"стандарт":"standard")+'</option><option value="20" '+(startStability===20?"selected":"")+'>20 — '+(ru?"длинная дуэль":"long duel")+'</option></select></label><label class="setting-check"><input id="max-two" type="checkbox" '+(maxPlaysSetting===2?"checked":"")+'> '+(ru?"Не больше двух карт за раунд":"Limit to two cards per round")+'</label><button id="start-game" class="menu-primary">'+(ru?"НАЧАТЬ ДУЭЛЬ":"START DUEL")+' →</button></div>';
if(page==="pvp")body='<button class="back-button" data-page="home">← '+(ru?"В ГЛАВНОЕ МЕНЮ":"MAIN MENU")+'</button><h2>PVP</h2><div class="feature-panel"><p>'+(ru?"Сетевой режим пока не подключён.":"Online matchmaking is not connected yet.")+'</p></div>';
if(page==="settings")body='<button class="back-button" data-page="home">← '+(ru?"В ГЛАВНОЕ МЕНЮ":"MAIN MENU")+'</button><h2>'+(ru?"НАСТРОЙКИ":"SETTINGS")+'</h2><div class="settings-panel"><label>'+(ru?"Язык":"Language")+'<select id="language-select"><option value="ru" '+(ru?"selected":"")+'>Русский</option><option value="en" '+(!ru?"selected":"")+'>English</option></select></label><label>'+(ru?"Громкость звуков":"Sound volume")+' <output id="sound-value">'+Math.round(soundVolume*100)+'%</output><input id="sound-volume" type="range" min="0" max="1" step=".01" value="'+soundVolume+'"></label><label>'+(ru?"Музыка":"Music")+' <output id="music-value">'+Math.round(musicVolume*100)+'%</output><input id="music-volume" type="range" min="0" max=".4" step=".01" value="'+musicVolume+'"></label><p class="settings-note">'+(ru?"Негромкая синтезаторная тема. Настройки сохраняются автоматически.":"A soft, playful synth theme. Settings are saved automatically.")+'</p></div>';
if(page==="collection")body='<button class="back-button" data-page="home">← '+(ru?"В ГЛАВНОЕ МЕНЮ":"MAIN MENU")+'</button><h2>'+(ru?"КОЛЛЕКЦИЯ":"COLLECTION")+'</h2><p>'+(ru?"Все карты игры":"All game cards")+' · '+CARDS.length+'</p><div class="collection-grid">'+CARDS.map(d=>mini(d.id,false)).join("")+'</div>';
if(page==="decks")body='<button class="back-button" data-page="home">← '+(ru?"В ГЛАВНОЕ МЕНЮ":"MAIN MENU")+'</button><div class="deck-page-heading"><div><h2>'+(ru?"КОЛЛЕКЦИЯ И КОЛОДЫ":"COLLECTION & DECKS")+'</h2><p>'+(ru?"Перетаскивай карты из коллекции в колоду или нажимай на них.":"Drag or click cards to add them to your deck.")+'</p></div><button id="clear-deck" class="back-button">'+(ru?"ОЧИСТИТЬ":"CLEAR")+'</button></div><div class="deck-builder"><section><h3>'+(ru?"КОЛЛЕКЦИЯ":"COLLECTION")+'</h3><div class="collection-grid">'+CARDS.map(d=>mini(d.id,true)).join("")+'</div></section><section><h3>'+(ru?"ТВОЯ КОЛОДА":"YOUR DECK")+' <span>'+savedDeck.length+'/30</span></h3><div class="deck-grid">'+Array.from({length:30},(_,n)=>savedDeck[n]?'<div class="deck-cell filled" data-deck-slot="'+n+'">'+mini(savedDeck[n],false)+'</div>':'<div class="deck-cell" data-deck-slot="'+n+'">＋</div>').join("")+'</div></section></div>';
menu.innerHTML='<div class="menu-shell"><header class="menu-top"><button class="menu-brand" data-page="home"><span>S</span>'+title+'</button><button class="language-shortcut" data-page="settings">'+(ru?"RU / EN":"EN / RU")+'</button></header><main class="menu-content">'+body+'</main></div>';document.documentElement.lang=language;document.title=ru?"Стабильность — карточная дуэль":"Stability — card duel";
menu.querySelectorAll<HTMLElement>("[data-page]").forEach(el=>el.addEventListener("click",()=>renderMenu(el.dataset.page!)));
menu.querySelector<HTMLButtonElement>("#start-game")?.addEventListener("click",()=>{startStability=menu.querySelector<HTMLSelectElement>("#start-stability")?.value==="20"?20:15;maxPlaysSetting=menu.querySelector<HTMLInputElement>("#max-two")?.checked?2:0;saveSettings();start()});
menu.querySelector<HTMLSelectElement>("#language-select")?.addEventListener("change",e=>{language=(e.target as HTMLSelectElement).value as Language;saveSettings();renderMenu("settings")});

menu.querySelector<HTMLInputElement>("#sound-volume")?.addEventListener("input",e=>{soundVolume=Number((e.target as HTMLInputElement).value);const o=menu.querySelector<HTMLOutputElement>("#sound-value");if(o)o.value=Math.round(soundVolume*100)+"%";saveSettings()});
menu.querySelector<HTMLInputElement>("#music-volume")?.addEventListener("input",e=>{musicVolume=Number((e.target as HTMLInputElement).value);const o=menu.querySelector<HTMLOutputElement>("#music-value");if(o)o.value=Math.round(musicVolume*100)+"%";saveSettings();if(musicVolume){audio();startMusic()}});
menu.querySelector<HTMLButtonElement>("#clear-deck")?.addEventListener("click",()=>{savedDeck=[];saveDeck();renderMenu("decks")});
if(page==="decks"){menu.querySelectorAll<HTMLElement>("[data-deck-card]").forEach(el=>{el.addEventListener("dragstart",e=>(e as DragEvent).dataTransfer?.setData("text/plain",el.dataset.deckCard||""));el.addEventListener("click",()=>{if(savedDeck.length<30){savedDeck.push(el.dataset.deckCard!);saveDeck();renderMenu("decks")}})});menu.querySelectorAll<HTMLElement>("[data-deck-slot]").forEach(el=>{el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("deck-drop-target")});el.addEventListener("drop",e=>{e.preventDefault();const id=(e as DragEvent).dataTransfer?.getData("text/plain");if(id&&savedDeck.length<30){savedDeck.push(id);saveDeck();renderMenu("decks")}});el.addEventListener("click",()=>{const n=Number(el.dataset.deckSlot);if(n<savedDeck.length){savedDeck.splice(n,1);saveDeck();renderMenu("decks")}})})}
}


const esc = (value: string) => value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!));
const artFor = (card: Card) => base + "cards/card-art-" + String(((Number(card.uid) || 1) - 1) % 3 + 1).padStart(2, "0") + ".avif";
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function art(card: Card, className = "card-art"): string {
  return '<img class="' + className + '" src="' + esc(artFor(card)) + '" data-art="' + esc(artFor(card)) + '" alt="" loading="eager" decoding="async">';
}
function handCard(card: Card): string {
  const chosen = selectedCard === card.uid ? " chosen" : "";
  return '<button type="button" draggable="true" class="hand-card' + chosen + '" data-id="' + esc(card.uid) + '" aria-label="' + esc(cardName(card)) + '">' +
    '<span class="hand-art-wrap">' + art(card) + '</span>' +
    '<span class="hand-copy"><header><b class="cost">' + card.cost + '</b><strong>' + esc(cardName(card)) + '</strong></header><span>' + esc(cardText(card)) + '</span></span></button>';
}
function boardSlot(card: Card | null, own: boolean, index: number, pending = false): string {
  if (!card) return '<div class="slot empty ' + (own ? 'own-empty' : '') + '" data-slot-index="' + index + '"><span class="slot-plus">＋</span><small>СВОБОДНО</small></div>';
  return '<button type="button" draggable="false" class="slot filled ' + (own ? "own" : "enemy") + (pending ? " pending-slot" : "") + '" data-card-id="' + esc(card.uid) + '" data-side="' + (own ? "player" : "enemy") + '" data-slot-index="' + index + '" ' +
    (own && !pending ? 'data-r="' + esc(card.uid) + '"' : own ? "" : "disabled") + '>' +
    art(card, "slot-art") + '<span class="slot-copy"><header><b class="slot-cost">' + card.cost + '</b><strong>' + esc(cardName(card)) + '</strong></header><small>' + esc(cardText(card)) + '</small></span></button>';
}
function statusPanel(label: string, value: number, own: boolean, tail: string): string {
  const width = Math.max(0, Math.min(100, value / 60 * 100));
  return '<section class="status-panel ' + (own ? "own-status" : "enemy-status") + '">' +
    '<div class="status-top"><span class="status-dot"></span><span class="status-label">' + label + '</span><strong>' + value + '</strong><small>СТАБИЛЬНОСТЬ</small></div>' +
    '<div class="stability-track"><span style="width:' + width + '%"></span></div><div class="status-tail">' + tail + '</div></section>';
}

function triggerResolutionEffects(beforePlayer: number, beforeEnemy: number, played: Array<{ side: "player" | "enemy"; card: Card }>): void {
  const arena = root.querySelector<HTMLElement>(".center-column");
  if (!arena) return;
  const overlay = document.createElement("div");
  overlay.className = "resolution-effects";
  overlay.setAttribute("aria-hidden", "true");
  arena.appendChild(overlay);

  played.forEach((item,index)=>playCardSound(index));
  played.forEach((item,index)=>playCardSound(index));
  const deltaPlayer = game.player.stability - beforePlayer;
  const deltaEnemy = game.enemy.stability - beforeEnemy;
  const showNumber = (side: "player" | "enemy", delta: number) => {
    if (!delta) return;
    const status = root.querySelector<HTMLElement>(side === "player" ? ".own-status" : ".enemy-status");
    if (!status) return;
    const number = document.createElement("span");
    number.className = "floating-number " + (delta < 0 ? "damage-number" : "heal-number");
    number.textContent = (delta > 0 ? "+" : "−") + Math.abs(delta);
    status.appendChild(number);
    window.setTimeout(() => number.remove(), 1500);
  };
  showNumber("player", deltaPlayer);
  showNumber("enemy", deltaEnemy);

  if (deltaPlayer < 0 || deltaEnemy < 0) overlay.classList.add("impact");
  if (deltaPlayer > 0 || deltaEnemy > 0) overlay.classList.add("restore");

  played.forEach(({ side, card }, index) => {
    const slot = root.querySelector<HTMLElement>('.slot[data-card-id="' + CSS.escape(card.uid) + '"]');
    if (slot) {
      const kind = card.effect?.kind || "default";
      slot.classList.add("card-reveal", "effect-" + String(kind).replace(/[^a-z-]/gi, ""));
      window.setTimeout(() => slot.classList.remove("card-reveal"), 1100);
      const rect = slot.getBoundingClientRect();
      const arenaRect = arena.getBoundingClientRect();
      const burst = document.createElement("span");
      burst.className = "effect-burst " + (side === "player" ? "burst-player" : "burst-enemy");
      burst.style.left = (rect.left - arenaRect.left + rect.width / 2) + "px";
      burst.style.top = (rect.top - arenaRect.top + rect.height / 2) + "px";
      overlay.appendChild(burst);
      for (let i = 0; i < 9; i++) {
        const particle = document.createElement("i");
        particle.className = "effect-particle " + (side === "player" ? "particle-player" : "particle-enemy");
        const angle = (Math.PI * 2 * i / 9) + index * .4;
        const distance = 24 + (i % 3) * 13;
        particle.style.setProperty("--dx", (Math.cos(angle) * distance) + "px");
        particle.style.setProperty("--dy", (Math.sin(angle) * distance) + "px");
        burst.appendChild(particle);
      }
    }
  });
  window.setTimeout(() => overlay.remove(), 1300);
}

function inspectorMarkup(card: Card): string {
  return '<div class="inspector-card">' + art(card, "inspector-art") + '<div class="inspector-copy"><header><b class="cost">' + card.cost + '</b><strong>' + esc(cardName(card)) + '</strong></header><p>' + esc(cardText(card)) + '</p></div></div>';
}
function updateInspector(card: Card): void {
  const panel = root.querySelector<HTMLElement>("#card-inspector");
  if (!panel) return;
  panel.innerHTML = inspectorMarkup(card);
}
function paint(): void {
  if (!game) return;
  const p = game.player, q = game.enemy;
  const logItems = [...game.log].reverse().slice(-8);
  if (notice) logItems.push(notice);
  root.innerHTML =
    '<header class="topbar"><div class="brand-mark">S</div><div class="brand-copy"><strong>СТАБИЛЬНОСТЬ</strong><small>ДУЭЛЬ В ПУСТОШИ</small></div><div class="round-pill">РАУНД <b>' + game.round + '</b></div><div class="top-actions"><button id="menu-button" class="quiet-button">☰ МЕНЮ</button><button id="new-game" class="quiet-button">↻ НОВАЯ ДУЭЛЬ</button></div></header>' +
    '<div class="game-layout">' +
      '<aside class="side-panel left-panel"><div class="panel-heading"><span class="panel-kicker">СВОДКА</span><h2>Журнал боя</h2></div>' +
        '<div class="side-score"><span>РАУНД</span><strong>' + game.round + '</strong></div>' +
        '<div class="log-list">' + logItems.map((line, i) => '<p class="' + (i === logItems.length - 1 ? "log-current" : "") + '">' + esc(line) + '</p>').join("") + '</div>' +
        '<div class="side-rule"><span class="panel-kicker">ЦЕЛЬ</span><p>Обнули Стабильность чужого лагеря. Цена каждой карты списывается сразу при выборе.</p></div>' +
      '</aside>' +
      '<main class="center-column">' +
        '<section class="board enemy-board" aria-label="Поле противника">' + q.board.map((c, i) => boardSlot(c, false, i)).join("") + '</section>' +
        '<div class="stability-duelbar"><div class="duelbar-side duelbar-player"><div class="duelbar-label"><span>ТВОЯ СТАБИЛЬНОСТЬ</span><strong>' + p.stability + '</strong></div><div class="duelbar-track"><span style="width:' + Math.max(0, Math.min(100, p.stability / 60 * 100)) + '%"></span></div></div><div class="duelbar-divider"></div><div class="duelbar-side duelbar-enemy"><div class="duelbar-label"><span>СТАБИЛЬНОСТЬ ПРОТИВНИКА</span><strong>' + q.stability + '</strong></div><div class="duelbar-track"><span style="width:' + Math.max(0, Math.min(100, q.stability / 60 * 100)) + '%"></span></div></div></div>' +
        '<section class="board player-board" aria-label="Твоё игровое поле">' + p.board.map((c, i) => { const pending = !c ? p.committed.find(item => item.targetSlot === i) : undefined; return boardSlot(c || pending || null, true, i, !!pending); }).join("") + '</section>' +
        '<section class="hand-section"><div class="hand-heading"><div><span class="panel-kicker">ТВОЙ РЕСУРС</span><h2>Карты в руке</h2></div><span class="hand-count">' + p.hand.length + ' / 6</span></div>' +
          '<div class="hand-grid">' + p.hand.map(handCard).join("") + '</div>' +
          
        '</section>' +
        '<footer class="game-actions"><p class="notice" role="status">' + esc(notice) + '</p><button id="valve" class="quiet-button" ' + (p.locked || p.stability < 3 || p.hand.length >= 6 || game.winner ? "disabled" : "") + '>КЛАПАН <b>−2</b></button><button id="lock" class="primary-button" ' + (p.locked || game.winner || busy ? "disabled" : "") + '>ЗАВЕРШИТЬ ХОД <span>→</span></button></footer>' +
      '</main>' +
      '<aside class="side-panel right-panel"><div class="panel-heading"><span class="panel-kicker">КАРТЫ</span><h2>Арсенал</h2></div>' +
        '<div class="archive-tabs"><button type="button" class="' + (archiveTab === "deck" ? "active" : "") + '" data-archive-tab="deck">МОЯ КОЛОДА</button><button type="button" class="' + (archiveTab === "enemy" ? "active" : "") + '" data-archive-tab="enemy">КАРТЫ ПРОТИВНИКА</button></div>' +
        '<div class="archive-list">' + (archiveTab === "deck" ? [...p.hand, ...p.deck, ...p.committed].filter((card, index, all) => all.findIndex(item => item.uid === card.uid) === index).map(card => '<button type="button" class="archive-card" data-preview-id="' + esc(card.uid) + '">' + art(card, "archive-thumb") + '<span><strong>' + esc(card.name) + '</strong><small>' + esc(card.text) + '</small></span><b>' + card.cost + '</b></button>').join("") : game.playedByEnemy.map(card => '<button type="button" class="archive-card" data-preview-id="' + esc(card.uid) + '">' + art(card, "archive-thumb") + '<span><strong>' + esc(card.name) + '</strong><small>' + esc(card.text) + '</small></span><b>' + card.cost + '</b></button>').join("") || '<p class="archive-empty">Противник ещё не сыграл ни одной карты.</p>') + '</div>' +
        '<div class="card-inspector" id="card-inspector">' + (previewCard ? inspectorMarkup(previewCard) : '<div class="inspector-placeholder">Наведи курсор на карту, чтобы посмотреть её.</div>') + '</div>' +
      '</aside>' +
    '</div>' +
    (game.winner ? '<div class="result-overlay"><div class="result-card"><span class="panel-kicker">ДУЭЛЬ ЗАВЕРШЕНА</span><h2>' + (game.winner === "draw" ? "НИЧЬЯ" : game.winner === "player" ? "ЛАГЕРЬ УСТОЯЛ" : "ЛАГЕРЬ ПАЛ") + '</h2><p>' + (game.winner === "player" ? "Твой лагерь сохранил стабильность." : game.winner === "draw" ? "Оба лагеря потеряли устойчивость." : "Стабильность твоего лагеря обнулилась.") + '</p><button id="restart" class="primary-button">НОВАЯ ДУЭЛЬ →</button></div></div>' : "");
  root.innerHTML = localizeHTML(root.innerHTML);
  root.innerHTML = localizeHTML(root.innerHTML);
  root.querySelectorAll<HTMLImageElement>("img[data-art]").forEach(image => {
    image.addEventListener("error", () => {
      const source = image.dataset.art || "";
      if (!image.dataset.fallback && source.endsWith(".avif")) {
        image.dataset.fallback = "1";
        image.src = source.replace(/\.avif$/i, ".jpg");
      } else {
        image.classList.add("art-missing");
      }
    }, { once: true });
  });
  root.querySelectorAll<HTMLButtonElement>(".hand-card[data-id]").forEach(button => {
    button.addEventListener("click", () => {
      if (dragMoved) { dragMoved = false; return; }
      if (busy || p.locked || game.winner) return;
      const used = new Set(p.committed.map(card => card.targetSlot).filter((slot): slot is number => slot !== undefined));
      const slotIndex = p.board.findIndex((card, index) => !card && !used.has(index));
      if (slotIndex < 0) { notice = "Сначала освободи слот."; paint(); return; }
      const result = selectCard(game, "player", button.dataset.id!);
      if (result.ok) { const committed = p.committed.find(card => card.uid === button.dataset.id); if (committed) committed.targetSlot = slotIndex; }
      notice = result.message;
      selectedCard = null;
      paint();
    });
  });
  root.querySelectorAll<HTMLElement>(".hand-card[data-id]").forEach(cardEl => {
    cardEl.addEventListener("dragstart", event => {
      if (busy || p.locked || game.winner) { event.preventDefault(); return; }
      dragCardId = cardEl.dataset.id || null;
      dragOrigin = cardEl;
      dragSource = "hand";
      dragMoved = true;
      if (event.dataTransfer && dragCardId) {
        event.dataTransfer.setData("text/plain", dragCardId);
        event.dataTransfer.effectAllowed = "move";
      }
      cardEl.classList.add("is-dragging");
    });
    cardEl.addEventListener("dragend", () => {
      cardEl.classList.remove("is-dragging");
      root.querySelectorAll(".drop-target").forEach(slot => slot.classList.remove("drop-target"));
      if (dragCardId && dragOrigin === cardEl && cardEl.isConnected) {
        cardEl.animate([{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-7px) scale(1.03)" }, { transform: "translateY(0) scale(1)" }], { duration: 280, easing: "cubic-bezier(.15,.8,.2,1)" });
      }
      dragCardId = null; dragOrigin = null;
      window.setTimeout(() => { dragMoved = false; }, 120);
    });
  });
  root.querySelectorAll<HTMLElement>(".slot.pending-slot[data-card-id]").forEach(cardEl => {
    cardEl.addEventListener("pointerdown", event => {
      const pointer = event as PointerEvent;
      if (pointer.button !== 0 || busy || p.locked || game.winner) return;
      const id = cardEl.dataset.cardId; if (!id) return;
      pointer.preventDefault(); pointer.stopPropagation();
      returnDragId = id; dragMoved = true;
      returnDragGhost = cardEl.cloneNode(true) as HTMLElement;
      returnDragGhost.classList.add("return-drag-ghost");
      returnDragGhost.style.left = (pointer.clientX + 12) + "px";
      returnDragGhost.style.top = (pointer.clientY + 12) + "px";
      document.body.appendChild(returnDragGhost);
    });
    cardEl.addEventListener("dragstart", event => {
      if (busy || p.locked || game.winner) { event.preventDefault(); return; }
      dragCardId = cardEl.dataset.cardId || null;
      dragOrigin = cardEl;
      dragSource = "committed";
      dragMoved = true;
      if (event.dataTransfer && dragCardId) {
        event.dataTransfer.setData("text/plain", dragCardId);
        event.dataTransfer.effectAllowed = "move";
      }
      cardEl.classList.add("is-dragging");
    });
    cardEl.addEventListener("dragend", () => {
      cardEl.classList.remove("is-dragging");
      dragCardId = null; dragOrigin = null; dragSource = null;
      window.setTimeout(() => { dragMoved = false; }, 120);
    });
  });
  root.querySelectorAll<HTMLElement>(".hand-grid").forEach(hand => {
    hand.addEventListener("dragenter", event => {
      if (dragSource !== "committed" || !dragCardId || busy || p.locked || game.winner) return;
      event.preventDefault(); hand.classList.add("hand-drop-target");
    });
    hand.addEventListener("dragover", event => {
      if (dragSource !== "committed" || !dragCardId || busy || p.locked || game.winner) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      hand.classList.add("hand-drop-target");
    });
    hand.addEventListener("dragleave", event => {
      if (!hand.contains(event.relatedTarget as Node | null)) hand.classList.remove("hand-drop-target");
    });
    hand.addEventListener("drop", event => {
      if (dragSource !== "committed" || !dragCardId) return;
      event.preventDefault(); hand.classList.remove("hand-drop-target");
      const id = event.dataTransfer?.getData("text/plain") || dragCardId;
      const result = selectCard(game, "player", id);
      if (result.ok) { const returned = p.hand.find(item => item.uid === id); if (returned) delete returned.targetSlot; }
      notice = result.message;
      selectedCard = null; dragCardId = null; dragOrigin = null; dragSource = null;
      paint();
      window.setTimeout(() => { dragMoved = false; }, 150);
    });
  });
  root.querySelectorAll<HTMLElement>(".own-empty[data-slot-index]").forEach(slot => {
    slot.addEventListener("dragenter", event => {
      if (!dragCardId || busy || p.locked || game.winner) return;
      event.preventDefault(); slot.classList.add("drop-target");
    });
    slot.addEventListener("dragover", event => {
      if (!dragCardId || busy || p.locked || game.winner) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      slot.classList.add("drop-target");
    });
    slot.addEventListener("dragleave", event => {
      if (!slot.contains(event.relatedTarget as Node | null)) slot.classList.remove("drop-target");
    });
    slot.addEventListener("drop", event => {
      event.preventDefault(); slot.classList.remove("drop-target");
      const id = event.dataTransfer?.getData("text/plain") || dragCardId;
      if (dragSource !== "hand") { notice = "Перетащи карту обратно в руку, чтобы отменить выбор."; paint(); return; }
      const card = p.hand.find(item => item.uid === id);
      if (!card || busy || p.locked || game.winner) { notice = "Сюда нельзя сыграть эту карту."; paint(); return; }
      const slotIndex = Number(slot.dataset.slotIndex);
      const result = selectCard(game, "player", id);
      if (!result.ok) { notice = result.message; paint(); return; }
      const committed = p.committed.find(item => item.uid === id);
      if (committed) committed.targetSlot = slotIndex;
      notice = result.message; selectedCard = null;
      dragCardId = null; dragOrigin = null; dragSource = null;
      paint();
      const landed = root.querySelector<HTMLElement>('.slot[data-card-id="' + CSS.escape(id) + '"]');
      landed?.animate([{ transform: "translateY(-16px) scale(.76) rotate(-2deg)", filter: "brightness(2.2)" }, { transform: "translateY(2px) scale(1.08)", filter: "brightness(1.45)" }, { transform: "translateY(0) scale(1)", filter: "brightness(1)" }], { duration: 360, easing: "cubic-bezier(.15,.8,.2,1)" });
      window.setTimeout(() => { dragMoved = false; }, 150);
    });
  });
  root.querySelectorAll<HTMLElement>(".slot[data-card-id]").forEach(slot => {
    const update = () => {
      const id = slot.dataset.cardId;
      const card = id ? [...p.board, ...q.board, ...p.committed].find(item => item?.uid === id) : null;
      if (card) { previewCard = card; updateInspector(card); }
    };
    slot.addEventListener("mouseenter", update); slot.addEventListener("focus", update);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-archive-tab]").forEach(button => button.addEventListener("click", () => {
    archiveTab = button.dataset.archiveTab === "enemy" ? "enemy" : "deck"; paint();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-preview-id]").forEach(button => {
    const update = () => {
      const id = button.dataset.previewId!;
      previewCard = [...p.hand, ...p.deck, ...p.committed, ...p.board.filter((x): x is Card => !!x), ...q.board.filter((x): x is Card => !!x), ...game.playedByEnemy].find(card => card.uid === id) || null;
      if (previewCard) updateInspector(previewCard);
    };
    button.addEventListener("mouseenter", update); button.addEventListener("focus", update);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-r]").forEach(button => button.addEventListener("click", () => {
    if (busy || p.locked || game.winner) return;
    removeOwn(game, "player", button.dataset.r!);
    notice = "Карта отправлена в сброс.";
    paint();
  }));
  root.querySelector<HTMLButtonElement>("#menu-button")!.onclick = () => menu.classList.remove("hidden");
  root.querySelector<HTMLButtonElement>("#new-game")!.onclick = start;
  root.querySelector<HTMLButtonElement>("#restart")?.addEventListener("click", start);
  root.querySelector<HTMLButtonElement>("#lock")!.onclick = () => {
    commit(game, "player");
    aiCommit(game);
    busy = true;
    notice = "Ход завершён. Карты вскрываются…";
    paint();
    const beforePlayer = game.player.stability;
    const beforeEnemy = game.enemy.stability;
    const played = [
      ...game.player.committed.map(card => ({ side: "player" as const, card })),
      ...game.enemy.committed.map(card => ({ side: "enemy" as const, card }))
    ];
    window.setTimeout(() => {
      resolveRound(game);
      busy = false;
      notice = game.winner ? "Дуэль завершена." : "Раунд завершён. Выбери следующий ход.";
      selectedCard = null;
      paint();
      triggerResolutionEffects(beforePlayer, beforeEnemy, played);
    }, 420);
  };
  root.querySelector<HTMLButtonElement>("#valve")!.onclick = () => {
    if (p.locked || p.stability < 3 || p.hand.length >= settings.handLimit || game.winner) return;
    p.stability -= 2;
    let card = p.deck.pop();
    if (!card && p.discard.length) { p.deck = shuffle(p.discard.splice(0)); card = p.deck.pop(); }
    if (card) { p.hand.push(card); notice = "Клапан: карта взята за 2 Стабильности."; }
    else { p.stability += 2; notice = "Колода и сброс пусты: оплата возвращена."; }
    paint();
  };
}
function start(): void {
  const stability = startStability;
  const maxPlays = maxPlaysSetting;
  settings = { startStability: stability, maxPlays, handLimit: 6, deckSize: 30 };
  game = createGame(settings);
  busy = false;
  selectedCard = null;
  notice = "Выбери карты и закрой выбор.";
  menu.classList.add("hidden");
  root.classList.remove("menu-empty");
  if (savedDeck.length) { const cards = savedDeck.slice(0,30).map((id,n) => { const d = CARDS.find(x=>x.id===id) || CARDS[n%CARDS.length]; return {...d,effect:{...d.effect},uid:"custom-"+n+"-"+d.id,playedRound:0} as Card; }); while(cards.length<30) { const d=CARDS[cards.length%CARDS.length]; cards.push({...d,effect:{...d.effect},uid:"custom-"+cards.length+"-"+d.id,playedRound:0} as Card); } game.player.hand=cards.splice(0,5); game.player.deck=cards; }
  if (musicVolume>0) { audio(); startMusic(); }
  paint();
}
root.classList.add("menu-empty");
document.addEventListener("pointermove", event => {
  if (!returnDragId || !returnDragGhost) return;
  returnDragGhost.style.left = (event.clientX + 12) + "px";
  returnDragGhost.style.top = (event.clientY + 12) + "px";
});
document.addEventListener("pointerup", event => {
  if (!returnDragId) return;
  const id = returnDragId;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const hand = target?.closest(".hand-grid");
  returnDragGhost?.remove(); returnDragGhost = null; returnDragId = null;
  if (!hand || !game || busy || game.player.locked || game.winner) { window.setTimeout(() => { dragMoved = false; }, 100); return; }
  const result = selectCard(game, "player", id);
  if (result.ok) { const returned = game.player.hand.find(item => item.uid === id); if (returned) delete returned.targetSlot; }
  notice = result.message; selectedCard = null; dragCardId = null; dragOrigin = null; dragSource = null;
  paint(); window.setTimeout(() => { dragMoved = false; }, 150);
});
menu.addEventListener("pointerdown",()=>{if(musicVolume>0){audio();startMusic()}},{once:true});
renderMenu("home");
