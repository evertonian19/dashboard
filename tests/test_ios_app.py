"""ESPN 파싱과 iOS 앱 계산 규칙 테스트. 실제 응답을 줄여 저장한 tests/fixtures/espn_*.json 을 사용한다.
실행: python3 -m unittest tests.test_ios_app"""
import json
import os
import unittest

from backend import espn, plphotos, wikidata
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


def ent(label, teams, dob, height, citizen=("Q142",), place=("Q456",), aliases=()):
    return {"label": label, "aliases": list(aliases), "teams": teams, "dob": dob, "height": height,
            "citizen": list(citizen), "birthplace": list(place), "iso": None}


EVERTON = "Q5794"
LABELS = {"Q142": {"label": "France", "iso": "FRA"}, "Q456": {"label": "Lyon", "iso": None}, "Q29": {"label": "Guinea", "iso": "GUI"}}
BARRY_ESPN = {"id": 301166, "name": "Thierno Barry", "number": 11, "position": "attacker", "age": 26, "nationality": "Guinea",
              "birthDate": "2000-01-12", "heightCM": 173, "weightKG": 82, "birthPlace": None,
              "flagURL": "https://a.espncdn.com/i/teamlogos/countries/500/gui.png"}
GUINEAN = ent("Thierno Barry", [["Q235411", False]], "+2000-01-12T00:00:00Z", ["+1.73", "Q11573"], citizen=("Q29",), place=())
FRENCH = ent("Thierno Barry", [["Q12297", True], [EVERTON, False]], "+2002-10-21T00:00:00Z", ["+1.95", "Q11573"])


class WikidataTests(unittest.TestCase):
    def test_same_name_other_club_is_excluded(self):
        hit = wikidata.match_player(BARRY_ESPN, EVERTON, [GUINEAN, FRENCH])
        self.assertIs(hit, FRENCH)

    def test_no_or_ambiguous_candidates_are_not_applied(self):
        self.assertIsNone(wikidata.match_player(BARRY_ESPN, EVERTON, [GUINEAN]))
        twin = dict(FRENCH)
        self.assertIsNone(wikidata.match_player(BARRY_ESPN, EVERTON, [FRENCH, twin]))
        # 성만 같은 다른 선수는 이름 불일치
        other = ent("Thierno Bah", [[EVERTON, False]], "+2000-01-01T00:00:00Z", ["+1.80", "Q11573"])
        self.assertIsNone(wikidata.match_player(BARRY_ESPN, EVERTON, [other]))

    def test_ended_membership_does_not_count(self):
        gone = ent("Thierno Barry", [[EVERTON, True]], "+2002-10-21T00:00:00Z", ["+1.95", "Q11573"])
        self.assertIsNone(wikidata.match_player(BARRY_ESPN, EVERTON, [gone]))

    def test_facts_units_and_apply(self):
        f = wikidata.facts(FRENCH, LABELS)
        self.assertEqual((f["birthDate"], f["heightCM"], f["nationality"], f["birthPlace"]), ("2002-10-21", 195, "France", "Lyon"))
        out = wikidata.apply_facts(BARRY_ESPN, f, "wikidata", today=__import__("datetime").date(2026, 11, 19))
        self.assertEqual(out["age"], 24)
        self.assertIsNone(out["weightKG"])                       # 다른 사람 프로필이 섞였던 값은 버린다
        self.assertEqual(set(out["bioDisputed"]), {"birthDate", "heightCM", "nationality"})
        self.assertEqual(out["bioDisputed"]["nationality"], "Guinea")
        self.assertTrue(out["flagURL"].endswith("/gui.png") is False)

    def test_uk_vs_home_nation_is_not_a_dispute(self):
        eng = dict(BARRY_ESPN, nationality="England", birthDate="2002-10-21", heightCM=195, flagURL="x/eng.png")
        found = {"birthDate": "2002-10-21", "heightCM": 196, "nationality": "United Kingdom", "birthPlace": None, "iso": "GBR"}
        out = wikidata.apply_facts(eng, found, "wikidata")
        self.assertEqual(out["nationality"], "England")
        self.assertEqual(out["bioDisputed"], {})
        self.assertEqual(out["weightKG"], 82)

    def test_insane_values_are_rejected(self):
        bad = ent("X", [[EVERTON, False]], "+2002-10-21T00:00:00Z", ["+3.20", "Q11573"])
        self.assertIsNone(wikidata.facts(bad, LABELS))
        old = ent("Y", [[EVERTON, False]], "+1950-01-01T00:00:00Z", ["+1.80", "Q11573"])
        self.assertIsNone(wikidata.facts(old, LABELS))

    def test_override_beats_wikidata_and_works_offline(self):
        orig = wikidata.load_overrides
        wikidata.load_overrides = lambda: {"301166": {"nationality": "France", "iso": "fra", "birthDate": "2002-10-21", "heightCM": 195, "weightKG": None}}
        try:
            wikidata._local.offline = True
            wikidata._jobs[999999] = True                  # 백그라운드 조회(네트워크)가 시작되지 않게 막는다
            out = wikidata.enrich([BARRY_ESPN], 999999, "Nowhere FC", today=__import__("datetime").date(2026, 11, 19), block=False)[0]
        finally:
            wikidata._local.offline = False
            wikidata._jobs.pop(999999, None)
            wikidata.load_overrides = orig
        self.assertEqual((out["nationality"], out["birthDate"], out["heightCM"], out["age"]), ("France", "2002-10-21", 195, 24))
        self.assertEqual(out["bioSource"], "override")
        self.assertTrue(out["flagURL"].endswith("/fra.png"))

    def test_override_file_is_valid_json_with_barry(self):
        ov = wikidata.load_overrides()
        self.assertEqual(ov["301166"]["nationality"], "France")
        self.assertEqual(ov["301166"]["birthDate"], "2002-10-21")


def imageinfo(title, license_short, artist="<a href='x'>Jane &amp; Co</a>"):
    return {"title": "File:" + title, "imageinfo": [{"thumburl": "https://upload.wikimedia.org/t/" + title, "url": "u",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:" + title,
            "extmetadata": {"LicenseShortName": {"value": license_short}, "Artist": {"value": artist},
                            "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"}}}]}


class PhotoTests(unittest.TestCase):
    def test_free_license_filter(self):
        for ok in ("CC BY-SA 4.0", "CC BY 3.0", "CC0", "Public domain", "CC-BY-2.0", "Attribution"):
            self.assertTrue(wikidata.free_license(ok), ok)
        for bad in ("", None, "Fair use", "CC BY-NC 4.0", "CC BY-ND 2.0", "All rights reserved", "Copyrighted free use"):
            self.assertFalse(wikidata.free_license(bad), bad)

    def test_parse_imageinfo_keeps_free_only_and_cleans_author(self):
        data = {"query": {"pages": [imageinfo("A.jpg", "CC BY-SA 4.0"), imageinfo("B.jpg", "Fair use"),
                                    {"title": "File:C.jpg", "missing": True}]}}
        out = wikidata.parse_imageinfo(data)
        self.assertEqual(list(out), ["A.jpg"])
        self.assertEqual(out["A.jpg"]["author"], "Jane & Co")
        self.assertTrue(out["A.jpg"]["pageURL"].endswith("File:A.jpg"))

    def _finish(self, photos, overrides=None, known=None):
        orig = wikidata.commons_info
        wikidata.commons_info = lambda files: {f: known[f] for f in files if f in (known or {})}
        try:
            plain = [dict(BARRY_ESPN, bioSource="espn", bioDisputed={}, bioPending=False, bioVerified=False, bioSuspect=False,
                          photoURL=None, photoCredit=None)]
            return wikidata._finish(plain, {}, overrides or {}, None, (set(), set(), photos))[0]
        finally:
            wikidata.commons_info = orig

    META = {"X.jpg": {"url": "https://u/x.jpg", "author": "Jane", "license": "CC BY 4.0", "licenseURL": None, "pageURL": "p"}}

    def test_photo_attached_only_for_identified_entity(self):
        self.assertEqual(self._finish({301166: "X.jpg"}, known=self.META)["photoURL"], "https://u/x.jpg")
        self.assertIsNone(self._finish({}, known=self.META)["photoURL"])        # 확인되지 않은 선수에는 붙이지 않는다

    def test_override_can_block_or_set_photo(self):
        self.assertIsNone(self._finish({301166: "X.jpg"}, {"301166": {"photo": None}}, self.META)["photoURL"])
        self.assertEqual(self._finish({}, {"301166": {"photo": "X.jpg"}}, self.META)["photoCredit"]["author"], "Jane")


PL_HTML = """<a href="/en/players/111234/jordan-pickford/overview">x</a><a href="/en/players/128295/christian-n-rgaard/overview">x</a>
<a href="/en/players/513466/merlin-r-hl/overview">x</a><a href="/en/players/512462/jake-o-brien/overview">x</a>
<a href="/en/players/224967/vitalii-mykolenko/overview">x</a><a href="/en/players/1/james-smith/overview">x</a>
<a href="/en/players/2/john-smith/overview">x</a><a href="/en/players/111234/jordan-pickford/overview">dup</a>"""


class PLPhotoTests(unittest.TestCase):
    def setUp(self):
        self.entries = plphotos.parse_squad(PL_HTML)

    def test_parse_dedupes_in_order(self):
        self.assertEqual([e["id"] for e in self.entries], ["111234", "128295", "513466", "512462", "224967", "1", "2"])

    def test_special_characters_match(self):
        for name, pid in [("Christian Nørgaard", "128295"), ("Merlin Röhl", "513466"), ("Jake O'Brien", "512462"), ("Jordan Pickford", "111234")]:
            self.assertEqual(plphotos.match(name, self.entries)["id"], pid, name)

    def test_spelling_variant_needs_unique_surname_and_initial(self):
        self.assertEqual(plphotos.match("Vitaliy Mykolenko", self.entries)["id"], "224967")

    def test_ambiguous_or_unknown_is_not_matched(self):
        self.assertIsNone(plphotos.match("Sam Smith", self.entries))       # 성이 같은 선수가 둘
        self.assertIsNone(plphotos.match("Nobody Here", self.entries))

    def test_override_photo_is_kept_and_others_replaced(self):
        orig = plphotos.squad_entries, plphotos._image_ok
        plphotos.squad_entries, plphotos._image_ok = (lambda team: self.entries), (lambda pid: True)
        try:
            ps = [{"id": 1, "name": "Jordan Pickford", "photoURL": "commons.jpg"}, {"id": 2, "name": "Merlin Röhl", "photoURL": "keep.jpg"}]
            out = plphotos.attach(ps, 368, keep={2})
        finally:
            plphotos.squad_entries, plphotos._image_ok = orig
        self.assertTrue(out[0]["photoURL"].endswith("/111234.png"))       # Commons 보다 PL 공식이 우선
        self.assertEqual(out[0]["photoSource"], "premierleague")
        self.assertEqual(out[1]["photoURL"], "keep.jpg")                  # 수동 지정은 그대로


class StatusTests(unittest.TestCase):
    def test_status_has_core_numbers(self):
        s = ios_status()
        if not s["available"]:
            self.skipTest("iOS repo not present")
        self.assertGreater(s["source_lines"], 0)
        self.assertEqual(len(s["modules"]), 4)


if __name__ == "__main__":
    unittest.main()
