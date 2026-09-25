import json
from pathlib import Path

# Generated from the same atlas catalogue; parity is checked in CI.
PLANTS = json.loads((Path(__file__).parent / "data" / "companion-plants.json").read_text())
RECORD_PLANTS = {plant["slug"]: plant for plant in PLANTS if plant["status"] != "toxic"}
