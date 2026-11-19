"""iOS 앱 Metrics/Model 테스트(Swift)와 같은 케이스를 이식 로직에 대해 확인한다. 실행: python3 -m unittest tests.test_ios_app"""
import unittest

from backend import ios_app as app
from backend.ios_status import ios_status


class MetricsTests(unittest.TestCase):
    def test_radar_has_six_bounded_values(self):
        for p in app.PLAYERS:
            metrics = app.radar(p)
            self.assertEqual(len(metrics), 6, p["name"])
            for m in metrics:
                self.assertTrue(0 <= m["value"] <= 1, "%s %s" % (p["name"], m["label"]))

    def test_radar_empty_without_stats(self):
        self.assertEqual(app.radar({"position": "attacker", "stats": None}), [])

    def test_top_rated_sorted_descending(self):
        top = app.top_rated(app.PLAYERS, limit=3)
        self.assertEqual(len(top), 3)
        ratings = [p["stats"]["rating"] for p in top]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

    def test_strengths_at_most_two_and_known_labels(self):
        labels = {m["label"] for p in app.PLAYERS for m in app.radar(p)}
        for p in app.PLAYERS:
            s = app.strengths(p)
            self.assertLessEqual(len(s), 2)
            self.assertTrue(set(s) <= labels)

    def test_strengths_need_minutes(self):
        p = dict(app.PLAYERS[6], stats=dict(app.PLAYERS[6]["stats"], minutes=100))
        self.assertEqual(app.strengths(p), [])


class ModelTests(unittest.TestCase):
    def test_sample_matches_shape(self):
        ms = app.sample_matches()
        self.assertEqual(sum(m["phase"] == "finished" for m in ms), 5)
        self.assertEqual(sum(m["phase"] == "upcoming" for m in ms), 4)
        self.assertTrue(all(app.TEAM_ID in (m["home"]["id"], m["away"]["id"]) for m in ms))

    def test_result_and_form(self):
        ms = app.sample_matches()
        self.assertEqual([app.match_result(m) for m in app.recent_results(ms)], ["W", "D", "L", "W", "W"])
        self.assertIsNone(app.match_result(ms[-1]))

    def test_next_match_is_first_upcoming(self):
        ms = app.sample_matches()
        self.assertEqual(app.next_match(ms)["id"], 200)

    def test_zone(self):
        self.assertEqual(app.standing_zone("Promotion - Champions League (League phase)"), "champions")
        self.assertEqual(app.standing_zone("Relegation - Championship"), "relegation")
        self.assertEqual(app.standing_zone(None), "none")

    def test_events_match_score(self):
        m = app.sample_matches()[0]
        goals = [e for e in app.sample_events(m) if e["kind"] == "goal"]
        self.assertEqual(len(goals), m["homeGoals"] + m["awayGoals"])

    def test_diagnostics_report(self):
        report = app.diagnostics()
        titles = [c["title"] for c in report["checks"]]
        self.assertIn("2026-27 시즌", titles)
        self.assertEqual(report["squadCount"], 8)
        self.assertEqual(next(c for c in report["checks"] if c["title"] == "스쿼드")["level"], "warning")

    def test_detail_lookup(self):
        self.assertIsNone(app.match_detail(999))
        self.assertEqual(len(app.match_detail(100)["lineups"][0]["starters"]), 8)


class StatusTests(unittest.TestCase):
    def test_status_has_core_numbers(self):
        s = ios_status()
        if not s["available"]:
            self.skipTest("iOS repo not present")
        self.assertGreater(s["source_lines"], 0)
        self.assertEqual(len(s["modules"]), 4)
        self.assertGreaterEqual(s["tests"]["functions"], 1)


if __name__ == "__main__":
    unittest.main()
