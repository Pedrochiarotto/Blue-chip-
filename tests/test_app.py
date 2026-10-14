import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "bluechip123")
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi.testclient import TestClient

import app


class BlueChipApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_db = app.DB_PATH
        cls.temp_dir = tempfile.TemporaryDirectory()
        app.DB_PATH = Path(cls.temp_dir.name) / "test.db"
        app.init_db()
        cls.client = TestClient(app.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        app.DB_PATH = cls.original_db
        cls.temp_dir.cleanup()

    def login(self):
        response = self.client.post("/api/login", data={"username": "admin", "password": "bluechip123"})
        self.assertEqual(response.status_code, 200)

    def test_public_endpoint_does_not_require_login(self):
        response = self.client.get("/api/public")
        self.assertEqual(response.status_code, 200)
        self.assertIn("hero_title", response.json()["content"])

    def test_admin_requires_login(self):
        client = TestClient(app.app)
        self.assertEqual(client.get("/api/admin/data").status_code, 401)
        client.close()

    def test_login_content_and_card_crud(self):
        self.login()
        response = self.client.put("/api/admin/content", json={"content": {"today_title": "Evento de hoje"}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/public").json()["content"]["today_title"], "Evento de hoje")
        payload = {"carousel": "schedule", "tag": "SEXTA", "title": "Deep Stack", "description": "Início às 20h", "image_url": "", "position": 10, "active": True}
        created = self.client.post("/api/admin/cards", json=payload)
        self.assertEqual(created.status_code, 201)
        card_id = created.json()["id"]
        payload["title"] = "Deep Stack Especial"
        self.assertEqual(self.client.put(f"/api/admin/cards/{card_id}", json=payload).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/admin/cards/{card_id}").status_code, 204)


if __name__ == "__main__":
    unittest.main()
