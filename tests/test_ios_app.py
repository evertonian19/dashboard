"""ESPN 파싱과 iOS 앱 계산 규칙 테스트. 실제 응답을 줄여 저장한 tests/fixtures/espn_*.json 을 사용한다.
실행: python3 -m unittest tests.test_ios_app"""
import json
import os
import unittest

from backend import espn
from backend import ios_app as app
from backend.ios_status import ios_status

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, "espn_%s.json" % name), encoding="utf-8") as fh:
        return json.load(fh)


class ParseTests(unittest.TestCase):
    def test_schedule_merge_and_phases(self):
        ms = espn.merge_schedule(load("schedule_past"), load("schedule_future"))
        self.assertEqual([m["phase"] for m in ms].count("upcoming"), 3)
        self.assertEqual(ms, sorted(ms, key=lambda m: m["kickoff"]))
        nxt = app.next_match(ms, now=__import__("datetime").datetime(2026, 11, 19, tzinfo=__import__("datetime").timezone.utc))
        self.assertEqual((nxt["home"]["name"], nxt["away"]["name"]), ("Brentford", "Everton"))
        done = [m for m in ms if m["phase"] == "finished"]
        self.assertTrue(all(m["homeGoals"] is not None for m in done))
        self.assertTrue(all(m["homeGoals"] is None for m in ms if m["phase"] == "upcoming"))

    def test_roster_conversion(self):
        r = espn.parse_roster(load("roster"))
        self.assertEqual(len(r["players"]), 24)
        by_name = {p["name"]: p for p in r["players"]}
        pick = by_name["Jordan Pickford"]
        self.assertEqual((pick["number"], pick["position"], pick["heightCM"], pick["weightKG"]), (1, "goalkeeper", 185, 77))
        self.assertEqual(pick["birthDate"], "1994-03-07")
        self.assertIsNone(pick["photoURL"])
        self.assertEqual(by_name["Jack Grealish"]["number"], 10)
        order = [p["position"] for p in r["players"]]
        self.assertEqual(order, sorted(order, key=["goalkeeper", "defender", "midfielder", "attacker"].index))

    def test_standings(self):
        rows = espn.parse_standings(load("standings"))
        self.assertEqual(len(rows), 20)
        self.assertEqual([r["rank"] for r in rows], list(range(1, 21)))
        me = next(r for r in rows if r["club"]["id"] == 368)
        self.assertEqual(me["goalDifference"], me["goalsFor"] - me["goalsAgainst"])
        self.assertEqual(rows[0]["zone"], "champions")
        self.assertEqual(rows[-1]["zone"], "relegation")

    def test_teams(self):
        teams = espn.parse_teams(load("teams"))
        self.assertEqual(len(teams), 20)
        self.assertIn("Everton", [t["club"]["name"] for t in teams])

    def test_summary(self):
        s = load("summary")
        stats = espn.parse_team_stats(s, 368, 388)
        poss = next(x for x in stats if x["label"] == "점유율")
        self.assertAlmostEqual(poss["home"] + poss["away"], 100, delta=0.2)
        lu = espn.parse_lineups(s)
        home = next(x for x in lu if x["homeAway"] == "home")
        self.assertEqual(home["formation"], "4-2-3-1")
        self.assertEqual(len(home["starters"]), 11)
        grids = [p["grid"] for p in home["starters"]]
        self.assertEqual(len(set(grids)), 11)
        self.assertEqual(next(p for p in home["starters"] if p["name"] == "Jordan Pickford")["grid"], "1:1")
        self.assertEqual(sorted(int(g.split(":")[0]) for g in grids), [1, 2, 2, 2, 2, 3, 3, 4, 4, 4, 5])
        ev = espn.parse_events(s)
        self.assertEqual([e["kind"] for e in ev].count("goal"), 4)
        self.assertEqual(ev, sorted(ev, key=lambda e: (e["minute"], e["extra"] or 0)))


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.players = espn.parse_roster(load("roster"))["players"]

    def test_radar_bounded_and_empty_without_appearances(self):
        for p in self.players:
            m = app.radar(p, team_games=10)
            if not p["stats"] or p["stats"]["appearances"] == 0:
                self.assertEqual(m, [], p["name"])
            else:
                self.assertGreaterEqual(len(m), 5, p["name"])
                self.assertTrue(all(0 <= x["value"] <= 1 for x in m), p["name"])

    def test_strengths_rules(self):
        for p in self.players:
            s = app.strengths(p, team_games=10)
            self.assertLessEqual(len(s), 2)
            self.assertNotIn("규율", s)
            if (p["stats"] or {}).get("appearances", 0) < app.STRENGTH_MIN_APPEARANCES:
                self.assertEqual(s, [])

    def test_top_contributors_sorted(self):
        top = app.top_contributors(self.players)
        pts = [p["stats"]["goals"] + p["stats"]["assists"] for p in top]
        self.assertEqual(pts, sorted(pts, reverse=True))
        self.assertTrue(all(p["position"] != "goalkeeper" for p in top))

    def test_result_and_form(self):
        ms = espn.merge_schedule(load("schedule_past"), load("schedule_future"))
        form = [app.match_result(m) for m in app.recent_results(ms)]
        self.assertTrue(set(form) <= {"W", "D", "L"})
        self.assertIsNone(app.match_result(next(m for m in ms if m["phase"] == "upcoming")))

    def test_zone_and_rss(self):
        self.assertEqual(espn.standing_zone("Relegation"), "relegation")
        self.assertEqual(espn.standing_zone(None), "none")
        rss = b"""<rss><channel><item><title>A</title><description>d</description><link>http://x</link><guid>g1</guid>
        <pubDate>Fri, 13 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
        items = app.parse_rss(rss)
        self.assertEqual((items[0]["title"], items[0]["date"]), ("A", "2026-11-13T10:00:00Z"))

    def test_checks_flag_unavailable(self):
        report = {"expectedSeason": 2026, "seasonFound": True, "seasonName": "2026-27 English Premier League", "fixtureCount": 38,
                  "squadCount": 24, "missingNumbers": 0, "nextMatchDate": None, "errors": []}
        titles = [c["title"] for c in app.data_report_checks(report)]
        self.assertIn("제공되지 않는 항목", titles)


class StatusTests(unittest.TestCase):
    def test_status_has_core_numbers(self):
        s = ios_status()
        if not s["available"]:
            self.skipTest("iOS repo not present")
        self.assertGreater(s["source_lines"], 0)
        self.assertEqual(len(s["modules"]), 4)


if __name__ == "__main__":
    unittest.main()
