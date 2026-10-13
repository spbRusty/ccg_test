import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/cards", { recursive: true });
for (const file of ["card-art-01.avif", "card-art-02.avif", "card-art-03.avif"]) {
  copyFileSync(`cards/${file}`, `dist/cards/${file}`);

  // AVIF support varies in older mobile browsers and embedded WebViews.
  // Generate a broadly supported JPEG fallback during the build.
  const fallback = `dist/cards/${file.replace(/\.avif$/i, ".jpg")}`;
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", `cards/${file}`,
    "-frames:v", "1", "-q:v", "3",
    fallback,
  ]);
}
