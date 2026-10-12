import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/cards", { recursive: true });
for (const file of ["card-art-01.avif", "card-art-02.avif", "card-art-03.avif"]) {
  copyFileSync(`cards/${file}`, `dist/cards/${file}`);
}
