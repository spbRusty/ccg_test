import * as ex from "excalibur";
import {createGame,selectCard,removeOwn,commit,aiCommit,resolveRound,type Game,type Settings,type Card,type Side} from "./game/stability";
import "../style.css";
const root=document.querySelector<HTMLDivElement>("#ui")!;
let settings:Settings={startStability:15,maxPlays:0,handLimit:6,deckSize:30},game:Game,note="Выбирай карты вслепую. Цена списывается сразу.",busy=false;
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
function card(c:Card,chosen:boolean){return `<button class="card ${chosen?"chosen":""}" data-card="${c.uid}"><b class="cost">${c.cost}</b><strong>${esc(c.name)}</strong><span>${esc(c.text)}</span></button>`}
function slot(c:Card|null,own:boolean){return c?own?`<button class="slot own" data-remove="${c.uid}"><b>${esc(c.name)}</b><small>${esc(c.text)}</small><i>СНЯТЬ</i></button>`:`<div class="slot enemy"><b>${esc(c.name)}</b><small>${esc(c.text)}</small></div>`:'<div class="slot empty">СВОБОДНО</div>'}
function render(){const p=game.player,e=game.enemy;root.innerHTML=`<header><div class="logo">СТАБИЛЬНОСТЬ<small>ДУЭЛЬ В ПУСТОШИ</small></div><span>РАУНД <b>${game.round}</b></span><button id="settings">⚙</button></header>
<section class="status red"><div><small>ЧУЖОЙ ЛАГЕРЬ</small><strong>${e.stability}</strong><small>СТАБИЛЬНОСТЬ</small></div><div>${e.locked?"ХОД ЗАКРЫТ":"ПРОТИВНИК ВЫБИРАЕТ"}<p>${"▰ ".repeat(e.committed.length)}</p></div></section>
<section class="board">${e.board.map(c=>slot(c,false)).join("")}</section><div class="divider">ЛИНИЯ РАЗЛОМА</div><section class="board">${p.board.map(c=>slot(c,true)).join("")}</section>
<section class="status green"><div><small>ТВОЙ ЛАГЕРЬ</small><strong>${p.stability}</strong><small>СТАБИЛЬНОСТЬ</small></div><div>${p.locked?"ВЫБОР ЗАКРЫТ":"ВЫБОР ОТКРЫТ"}<p>Рука ${p.hand.length}/6 · Колода ${p.deck.length}</p></div></section>
<h3>РУКА <small>ВЫБРАНО ${p.committed.length}${settings.maxPlays?"/"+settings.maxPlays:""} · ОПЛАЧЕНО ${p.committed.reduce((a,c)=>a+c.cost,0)}</small></h3>
<div class="committed">${p.committed.map(c=>`<button class="face-down" data-card="${c.uid}">ЗАКРЫТА · ${c.cost} (нажми, чтобы отменить)</button>`).join("")}</div>
<section class="hand">${p.hand.map(c=>card(c,false)).join("")||"Карт в руке нет"}</section>
<footer><div class="note">${esc(note)}</div><button id="valve" ${p.locked||p.stability<3||p.hand.length>=6?"disabled":""}>КЛАПАН −2</button><button id="commit" ${p.locked||game.winner||busy?"disabled":""}>${p.locked?"ХОД ЗАКРЫТ":"ЗАКРЫТЬ ВЫБОР"} →</button></footer>
${game.winner?'<div class="overlay"><div class="dialog"><h1>'+(game.winner==="draw"?"НИЧЬЯ":game.winner==="player"?"ТЫ УСТОЯЛ":"ЛАГЕРЬ ПАЛ")+'</h1><button id="restart">НОВАЯ ДУЭЛЬ</button></div></div>':""}`;
root.querySelectorAll<HTMLButtonElement>("[data-card]").forEach(b=>b.onclick=()=>{if(!busy&&!p.locked){note=selectCard(game,"player",b.dataset.card!).message;render()}});
root.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=()=>{removeOwn(game,"player",b.dataset.remove!);note="Карта снята.";render()});
document.getElementById("commit")!.onclick=()=>{if(busy||p.locked)return;commit(game,"player");aiCommit(game);busy=true;note="Карты раскрыты. Эффекты разрешаются.";render();setTimeout(()=>{resolveRound(game);busy=false;note="Раунд разрешён.";render()},500)};
document.getElementById("valve")!.onclick=()=>{if(p.stability<3||p.hand.length>=6||p.locked)return;p.stability-=2;let c=p.deck.pop();if(!c&&p.discard.length){p.deck=p.discard.splice(0);c=p.deck.pop()}if(c)p.hand.push(c);else p.stability+=2;note=c?"Клапан открыт.":"Нет карт.";render()};
document.getElementById("settings")!.onclick=()=>{const a=prompt("Стартовая Стабильность: 15 или 20",String(settings.startStability));if(a!=="15"&&a!=="20")return;settings={...settings,startStability:Number(a) as 15|20,maxPlays:confirm("Лимит две карты за раунд?")?2:0};startGame()};
document.getElementById("restart")?.addEventListener("click",startGame)}
function startGame(){game=createGame(settings);busy=false;note="Выбирай карты вслепую. Нельзя потратить Стабильность ниже 1.";render()}
const engine=new ex.Engine({canvasElementId:"game",width:1200,height:800,displayMode:ex.DisplayMode.FitScreen,backgroundColor:ex.Color.fromHex("#080d13")});const scene=new ex.Scene();scene.on("postdraw",ctx=>{for(let i=0;i<32;i++)ctx.drawCircle(ex.vec((i*89)%1200,(i*47)%800),1,ex.Color.fromHex("#243743"))});engine.add("arena",scene);engine.goToScene("arena");engine.start().then(()=>{startGame();document.body.classList.add("ready")});
