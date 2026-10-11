import type { CardInstance, PlayerKey, PlayerState } from "../cards/types";

interface EffectContext {
  getPlayers: () => Record<PlayerKey, PlayerState>;
  maxTime: number;
  maxHand: number;
  drawCard: (key: PlayerKey) => void;
  addLog: (message: string) => void;
  transferTime: (actorKey: PlayerKey, amount: number) => number;
  labelOf: (key: PlayerKey) => string;
  nextSequence: () => number;
}

function removeLatestEnemyCard(actorKey: PlayerKey, context: EffectContext): boolean {
    const enemyKey = actorKey === "player" ? "opponent" : "player";
    const board = context.getPlayers()[enemyKey].board;
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
      context.context.addLog(context.context.labelOf(actorKey) + " убирает с поля карту «" + removed.name + "».");
      return true;
    }
    return false;
  }

function removeMostExpensiveEnemyCard(actorKey: PlayerKey, context: EffectContext): boolean {
    const board = context.getPlayers()[actorKey === "player" ? "opponent" : "player"].board;
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

export function applyEffect(effect: CardInstance, actorKey: PlayerKey, isCopy: boolean, context: EffectContext): void {
    const players = context.getPlayers();
    const targetKey = actorKey === "player" ? "opponent" : "player";
    const actor = players[actorKey];
    const target = players[targetKey];
    const prefix = isCopy ? "Эхо: " : "";

    switch (effect.type) {
      case "gain": {
        const before = actor.time;
        actor.time = Math.min(context.maxTime, actor.time + effect.amount);
        addLog(prefix + labelOf(actorKey) + " восстанавливает " + (actor.time - before) + " сек.");
        break;
      }
      case "steal": {
        const moved = context.transferTime(actorKey, effect.amount);
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
        const removed = removeMostExpensiveEnemyCard(actorKey, context);
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
        if (actor.hand.length >= context.maxHand) {
          addLog(prefix + "Перехват не удался: твоя рука заполнена.");
          break;
        }
        const index = Math.floor(Math.random() * target.hand.length);
        const stolen = target.hand.splice(index, 1)[0];
        actor.hand.push(stolen);
        addLog(prefix + labelOf(actorKey) + " крадёт у противника карту «" + stolen.name + "».");
        break;
      }
      case "cancel": {const removed=removeLatestEnemyCard(actorKey, context),before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount);addLog(prefix+(removed?"Срыв: ":"Нечего убирать: ")+"получено "+(actor.time-before)+" сек.");break;}
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
      case "massPlay":{for(let i=0;i<effect.amount;i++)context.drawCard(actorKey);actor.discount=Math.max(actor.discount,effect.amount);addLog(prefix+"Добор карт и скидка на следующую карту: "+effect.amount+".");break;}
      case "trap":{actor.hiddenTrap=effect.amount;addLog(prefix+"Скрытая ловушка установлена.");break;}
      case "ruleChange":{actor.ruleBonus=effect.amount;addLog(prefix+"Следующий эффект усилен на "+effect.amount+".");break;}
      case "random":{const r=Math.floor(Math.random()*4);if(r===0){const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount);addLog(prefix+"Аномалия: +"+(actor.time-before)+" сек.");}else if(r===1){const n=transferTime(actorKey,effect.amount);addLog(prefix+"Аномалия: перенесено "+n+" сек.");}else if(r===2){const n=Math.min(effect.amount,target.time);target.time-=n;addLog(prefix+"Аномалия: враг теряет "+n+" сек.");}else{const list=target.board.map((c,i)=>({c,i})).filter(x=>x.c&&x.c.shield<=0);if(list.length){const x=list[Math.floor(Math.random()*list.length)];target.board[x.i]=null;target.discard.push(x.c);addLog(prefix+"Аномалия уничтожает «"+x.c.name+"».");}else addLog(prefix+"Аномалия не находит цель.");}break;}
      case "duplicate":{const source=actor.board.find(c=>c&&c.id!==effect.id),slot=actor.board.findIndex(c=>!c);if(source&&slot>=0){actor.board[slot]={...source,id:"card-"+(context.nextSequence()),playedAt:++sequence,charges:source.charges||0,shield:0};addLog(prefix+"Создана копия «"+source.name+"».");}else addLog(prefix+"Нет цели или слота для копии.");break;}
      case "sacrifice":{const index=actor.board.findIndex(c=>c&&c.id!==effect.id);if(index>=0){const c=actor.board[index];actor.board[index]=null;actor.discard.push(c);const before=actor.time;actor.time=Math.min(MAX_TIME,actor.time+effect.amount+(c.charges||0));addLog(prefix+"Пожертвована «"+c.name+"», получено "+(actor.time-before)+" сек.");}else addLog(prefix+"Нет карты для жертвоприношения.");break;}
      default:break;
    }
  }
