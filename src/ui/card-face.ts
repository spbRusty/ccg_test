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
    const artFile = card.art || "card-art-01.avif";
    // Derive the deployment root from the module script: /ccg_test/assets/app.js
    // on Pages and /src/main.ts in dev. This avoids fragile document-relative URLs.
    const moduleScript = Array.from(document.scripts).find((script) => script.type === "module" && script.src);
    const deploymentBase = moduleScript ? new URL("../", moduleScript.src).pathname : "/";
    art.src = new URL(deploymentBase + "cards/" + artFile, window.location.origin).href;
    art.alt = "";
    // The same three small AVIF files are reused; eager loading avoids mobile WebViews
    // postponing images inside nested scrolling containers.
    art.loading = "eager";
    art.decoding = "async";

    const shine = document.createElement("span");
    shine.className = "card-shine";
    shine.setAttribute("aria-hidden", "true");

    face.append(art, shine, top, body);
    if(card.charges>0){const c=document.createElement("span");c.className="card-charge";c.textContent="⚡ "+card.charges;face.appendChild(c);}
    if(card.evolution>0){const c=document.createElement("span");c.className="card-evolution";c.textContent="✦"+card.evolution;face.appendChild(c);}
    return face;
  }
