#!/usr/bin/env python3
"""Download the complete Hearthstone card database and export it as CSV."""
import csv
import json
import urllib.request
from pathlib import Path

URL = "https://api.hearthstonejson.com/v1/latest/ruRU/cards.json"
OUTPUT = Path("cards.csv")
FIELDS = [
    "id", "dbfId", "name", "text", "cost", "attack", "health",
    "type", "cardClass", "rarity", "set", "race", "collectible", "mechanics",
]

request = urllib.request.Request(URL, headers={"User-Agent": "ccg_test-card-catalog/1.0"})
with urllib.request.urlopen(request, timeout=90) as response:
    cards = json.load(response)

with OUTPUT.open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=FIELDS, extrasaction="ignore")
    writer.writeheader()
    for card in cards:
        row = {field: card.get(field, "") for field in FIELDS}
        mechanics = row.get("mechanics", "")
        if isinstance(mechanics, list):
            row["mechanics"] = "; ".join(mechanics)
        writer.writerow(row)

print(f"Wrote {len(cards)} cards to {OUTPUT}")
