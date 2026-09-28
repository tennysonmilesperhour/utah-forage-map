"""Photo ID: request validation, rate limits, the Claude call shape and result cleaning.

Only the Claude API client is replaced. No photo reaches a real service.
"""
import base64
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

RUNTIME = tempfile.TemporaryDirectory()
os.environ.update(
    DATABASE_URL=f"sqlite:///{Path(RUNTIME.name) / 'identify.db'}",
    SECRET_KEY="identify-tests",
    ENVIRONMENT="development",
)

import anthropic
import httpx2
from fastapi.testclient import TestClient
from app import identify, main
from app.database import Base, engine

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200


def photo(collection="fungi", data=JPEG, media_type="image/jpeg"):
    return {"collection": collection, "media_type": media_type, "image": base64.b64encode(data).decode()}


def reply(payload, stop_reason="end_turn", fallback=False):
    content = [SimpleNamespace(type="fallback")] if fallback else []
    content.append(SimpleNamespace(type="text", text=json.dumps(payload)))
    return SimpleNamespace(stop_reason=stop_reason, content=content)


class IdentifyPhotoTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.env = patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-test", "IDENTIFY_PHOTO_HOURLY_LIMIT": "3"})
        self.env.start()
        self.remote = MagicMock()
        self.patcher = patch.object(identify, "client", return_value=self.remote)
        self.patcher.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.patcher.stop()
        self.env.stop()
        self.client.close()

    def test_status_reports_whether_photo_id_is_configured(self):
        self.assertEqual(self.client.get("/api/identify/status").json(), {"photo": True})
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            self.assertEqual(self.client.get("/api/identify/status").json(), {"photo": False})
            self.assertEqual(self.client.post("/api/identify/photo", json=photo()).status_code, 503)
        self.remote.beta.messages.create.assert_not_called()

    def test_rejects_non_images_and_unknown_collections(self):
        self.assertEqual(self.client.post("/api/identify/photo", json=photo(data=b"GIF89a" + b"\x00" * 200)).status_code, 422)
        self.assertEqual(self.client.post("/api/identify/photo", json=photo(media_type="image/webp", data=b"RIFF0000WAVE" + b"\x00" * 200)).status_code, 422)
        self.assertEqual(self.client.post("/api/identify/photo", json={**photo(), "image": "not base64!" * 20}).status_code, 422)
        self.assertEqual(self.client.post("/api/identify/photo", json=photo(collection="birds")).status_code, 422)
        self.remote.beta.messages.create.assert_not_called()

    def test_sends_one_image_with_the_fixed_catalogue_and_cleans_the_answer(self):
        self.remote.beta.messages.create.return_value = reply({
            "subject": "fungus",
            "seen": "A golden, funnel-shaped mushroom with blunt ridges.",
            "suggestions": [
                {"slug": "golden-chanterelle", "likeness": "strong", "features": "Blunt forked ridges run down the stem."},
                {"slug": "not-in-catalogue", "likeness": "possible", "features": "Invented."},
                {"slug": "golden-chanterelle", "likeness": "weak", "features": "Duplicate."},
                {"slug": "jack-o-lantern", "likeness": "possible", "features": "Orange colour fits; true gills would conflict."},
            ],
            "outside_catalogue": "",
            "check_next": "Look at the underside for true gills.",
        }, fallback=True)
        response = self.client.post("/api/identify/photo", json=photo())
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual([item["slug"] for item in body["suggestions"]], ["golden-chanterelle", "jack-o-lantern"])
        self.assertEqual(response.headers["cache-control"], "no-store")

        kwargs = self.remote.beta.messages.create.call_args.kwargs
        self.assertEqual(kwargs["fallbacks"], "default")
        self.assertEqual(kwargs["betas"], ["server-side-fallback-2026-07-01"])
        self.assertEqual(kwargs["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertIn("golden-chanterelle | Golden Chanterelle", kwargs["system"][0]["text"])
        image, text = kwargs["messages"][0]["content"]
        self.assertEqual(image["source"], {"type": "base64", "media_type": "image/jpeg", "data": photo()["image"]})
        self.assertEqual(text["text"], identify.USER_TEXT)
        schema = kwargs["output_config"]["format"]["schema"]
        slugs = schema["properties"]["suggestions"]["items"]["properties"]["slug"]["enum"]
        self.assertEqual(len(slugs), len(identify.CANDIDATES["fungi"]))

    def test_herb_photos_use_the_plant_catalogue(self):
        self.remote.beta.messages.create.return_value = reply({"subject": "plant", "seen": "Nettle leaves.", "suggestions": [{"slug": "stinging-nettle", "likeness": "strong", "features": "Toothed opposite leaves."}], "outside_catalogue": "", "check_next": ""})
        body = self.client.post("/api/identify/photo", json=photo(collection="herbs")).json()
        self.assertEqual(body["suggestions"][0]["slug"], "stinging-nettle")
        system = self.remote.beta.messages.create.call_args.kwargs["system"][0]["text"]
        self.assertIn("stinging-nettle | Stinging nettle | Urtica dioica", system)
        self.assertNotIn("golden-chanterelle", system)

    def test_refusals_and_unfinished_answers_are_handled(self):
        self.remote.beta.messages.create.return_value = SimpleNamespace(stop_reason="refusal", content=[])
        body = self.client.post("/api/identify/photo", json=photo()).json()
        self.assertEqual(body["suggestions"], [])
        self.remote.beta.messages.create.return_value = SimpleNamespace(stop_reason="max_tokens", content=[SimpleNamespace(type="text", text='{"subj')])
        self.assertEqual(self.client.post("/api/identify/photo", json=photo()).status_code, 502)

    def test_api_errors_become_plain_messages(self):
        request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
        self.remote.beta.messages.create.side_effect = anthropic.RateLimitError("slow down", response=httpx2.Response(429, request=request), body=None)
        response = self.client.post("/api/identify/photo", json=photo())
        self.assertEqual(response.status_code, 503)
        self.assertIn("busy", response.json()["detail"])
        self.remote.beta.messages.create.side_effect = anthropic.APIConnectionError(request=request)
        self.assertEqual(self.client.post("/api/identify/photo", json=photo()).status_code, 504)

    def test_each_address_is_rate_limited(self):
        self.remote.beta.messages.create.return_value = reply({"subject": "unclear", "seen": "Too dark.", "suggestions": [], "outside_catalogue": "", "check_next": ""})
        codes = [self.client.post("/api/identify/photo", json=photo()).status_code for _ in range(4)]
        self.assertEqual(codes, [200, 200, 200, 429])
        self.assertEqual(self.remote.beta.messages.create.call_count, 3)


if __name__ == "__main__":
    unittest.main()
