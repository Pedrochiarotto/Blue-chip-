import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException, Response
import app


class TournamentTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = patch.object(app, "DB_PATH", Path(self.directory.name) / "test.db")
        self.database.start()
        app.init_db()
        self.auth = patch.object(app, "require_auth")
        self.auth.start()

    def tearDown(self):
        self.auth.stop()
        self.database.stop()
        self.directory.cleanup()

    def publish(self, revision, status="running", seconds=None):
        return app.update_tournament(app.TournamentInput(
            name="Torneio de teste", revision=revision, status=status,
            remaining_seconds=seconds, players=10, entries=20))

    def test_empty_is_not_a_live_tournament(self):
        self.assertEqual(app.get_tournament(Response())["status"], "idle")

    def test_pause_resume_and_metadata_preserve_clock(self):
        with patch.object(app.time, "time", return_value=1000):
            self.publish(0, seconds=120)
        with patch.object(app.time, "time", return_value=1030):
            data = self.publish(1)
            self.assertEqual(data["remaining_seconds"], 90)
        with patch.object(app.time, "time", return_value=1040):
            self.assertEqual(self.publish(2, "paused")["remaining_seconds"], 80)
        with patch.object(app.time, "time", return_value=2000):
            resumed = self.publish(3)
            self.assertEqual(resumed["ends_at"], 2080)
        with patch.object(app.time, "time", return_value=3000):
            self.assertEqual(app.get_tournament(Response())["remaining_seconds"], 0)

    def test_concurrent_update_does_not_overwrite(self):
        self.publish(0, seconds=60)
        with self.assertRaises(HTTPException) as caught:
            self.publish(0, seconds=600)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(app.get_tournament(Response())["revision"], 1)

    def test_invalid_player_count_is_rejected(self):
        with self.assertRaises(HTTPException):
            app.update_tournament(app.TournamentInput(name="Teste", players=20, entries=10))

    def test_update_requires_auth(self):
        self.auth.stop()
        with self.assertRaises(HTTPException) as caught:
            self.publish(0)
        self.assertEqual(caught.exception.status_code, 401)
        self.auth.start()

    def start_automatic(self, revision=0):
        return app.start_automatic_tournament(app.TournamentAutomationInput(
            revision=revision, name="Estrutura automática", level_duration_minutes=20,
            small_blind=100, big_blind=200, blind_growth_mode="multiplier", blind_growth_value=2,
            ante_percent=10, break_every_levels=2, break_duration_minutes=10,
            players=12, entries=12
        ))

    def test_automatic_structure_advances_blinds_and_interval(self):
        with patch.object(app.time, "time", return_value=1000):
            started = self.start_automatic()
            self.assertEqual((started["level"], started["small_blind"], started["big_blind"], started["ante"]), (1, 100, 200, 20))
        with patch.object(app.time, "time", return_value=2200):
            level_two = app.get_tournament(Response())
            self.assertEqual((level_two["status"], level_two["level"], level_two["small_blind"], level_two["big_blind"]), ("running", 2, 200, 400))
        with patch.object(app.time, "time", return_value=3400):
            on_break = app.get_tournament(Response())
            self.assertEqual((on_break["status"], on_break["level"], on_break["remaining_seconds"]), ("break", 2, 600))
        with patch.object(app.time, "time", return_value=4000):
            level_three = app.get_tournament(Response())
            self.assertEqual((level_three["status"], level_three["level"], level_three["big_blind"]), ("running", 3, 800))

    def test_automatic_pause_preserves_progress(self):
        with patch.object(app.time, "time", return_value=1000):
            self.start_automatic()
        with patch.object(app.time, "time", return_value=1300):
            paused = app.automatic_tournament_action(app.TournamentAutomationAction(revision=1, action="pause"))
            self.assertEqual((paused["status"], paused["remaining_seconds"]), ("paused", 900))
        with patch.object(app.time, "time", return_value=4000):
            still_paused = app.get_tournament(Response())
            self.assertEqual(still_paused["remaining_seconds"], 900)
            app.automatic_tournament_action(app.TournamentAutomationAction(revision=2, action="resume"))
        with patch.object(app.time, "time", return_value=4300):
            resumed = app.get_tournament(Response())
            self.assertEqual((resumed["status"], resumed["remaining_seconds"]), ("running", 600))
