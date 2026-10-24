#!/usr/bin/env python3
"""Build a Russian Marvel SNAP card catalog from MarvelSnapZone's public card data."""
import csv
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE_URL = "https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true"
OUTPUT = Path("marvel_snap_cards.csv")
CACHE_PATH = Path("data/marvel_snap_translation_cache.json")
FIELDS = [
    "id", "Название (RU)", "Название (EN)", "Эффект (RU)", "Эффект (EN)",
    "Стоимость", "Сила", "Механика", "Серия", "Статус", "Источник", "URL источника",
]
HEADERS = {"User-Agent": "ccg_test-card-catalog/1.0"}

# Canonical Russian terms keep rules text consistent even when machine translation varies.
TERM_FIXES = {
    "При раскрытии": "При раскрытии",
    "На открытии": "При раскрытии",
    "В конце хода": "В конце хода",
    "В начале игры": "В начале игры",
    "В начале хода": "В начале хода",
    "Сила": "Сила",
    "Стоимость": "Стоимость",
    "карта": "карта",
    "карты": "карты",
}
TAG_RU = {
    "On Reveal": "При раскрытии", "Ongoing": "Постоянный эффект",
    "Activate": "Активация", "Move": "Перемещение", "Destroy": "Уничтожение",
    "Discard": "Сброс", "No Ability": "Без способности", "Start of Game": "В начале игры",
    "End of Turn": "В конце хода", "Start of Turn": "В начале хода",
}
SOURCE_RU = {
    "Starter Card": "Стартовая карта", "Recruit Season": "Сезон новичка",
    "No source": "Без серии", "Series 1": "Серия 1", "Series 2": "Серия 2",
    "Series 3": "Серия 3", "Series 4": "Серия 4", "Series 5": "Серия 5",
    "Collection Level 1-14": "Уровень коллекции 1–14",
}

def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()

def clean(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</?span[^>]*>", "", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"[ \t]+", " ", value).strip()

def translate(text, cache):
    text = clean(text)
    if not text:
        return ""
    if text in cache:
        return cache[text]
    # Google Translate's public web endpoint; retry transient throttling/errors.
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode({
        "client": "gtx", "sl": "en", "tl": "ru", "dt": "t", "q": text
    })
    for attempt in range(5):
        try:
            payload = json.loads(get(url).decode("utf-8"))
            result = "".join(part[0] for part in payload[0] if part and part[0])
            result = result.strip()
            for old, new in TERM_FIXES.items():
                result = result.replace(old, new)
            cache[text] = result or text
            time.sleep(0.12)
            return cache[text]
        except Exception:
            if attempt == 4:
                # Never omit a card because a translation endpoint temporarily failed.
                cache[text] = text
                return text
            time.sleep(1.5 * (attempt + 1))

def main():
    payload = json.loads(get(SOURCE_URL).decode("utf-8"))
    cards = payload.get("success", {}).get("cards", [])
    if not cards:
        raise RuntimeError("MarvelSnapZone returned no cards; refusing to overwrite catalog.")
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        cache = {}

    rows = []
    seen = set()
    for card in cards:
        # The endpoint may include repeated definitions; preserve one row per card definition.
        key = str(card.get("carddefid") or card.get("cid") or card.get("name") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        name_en = clean(card.get("name", ""))
        ability_en = clean(card.get("ability", "")) or clean(card.get("flavor", "")) or "No ability text"
        tags = card.get("tags") or []
        mechanics_en = "; ".join(t.get("tag", "") for t in tags if t.get("tag"))
        mechanics_ru = "; ".join(TAG_RU.get(t, translate(t, cache)) for t in mechanics_en.split("; ") if t)
        source_en = clean(card.get("source", ""))
        source_ru = SOURCE_RU.get(source_en, translate(source_en, cache) if source_en else "")
        status_en = clean(card.get("status", ""))
        status_ru = {"released": "Выпущена", "unreleased": "Не выпущена"}.get(status_en.lower(), translate(status_en, cache))
        rows.append({
            "id": card.get("carddefid") or card.get("cid", ""),
            "Название (RU)": translate(name_en, cache),
            "Название (EN)": name_en,
            "Эффект (RU)": translate(ability_en, cache),
            "Эффект (EN)": ability_en,
            "Стоимость": card.get("cost", ""),
            "Сила": card.get("power", ""),
            "Механика": mechanics_ru,
            "Серия": source_ru,
            "Статус": status_ru,
            "Источник": "MarvelSnapZone",
            "URL источника": clean(card.get("url", "")),
        })
        if len(rows) % 50 == 0:
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Processed {len(rows)} cards...")
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} cards to {OUTPUT}; source records={len(cards)}; translations cached={len(cache)}")

if __name__ == "__main__":
    main()
