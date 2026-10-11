import type { CardViewData } from "../cards/types";

  export function makeCardFace(card: CardViewData, showDescription: boolean): HTMLDivElement {
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
