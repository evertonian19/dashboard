"""iOS 앱(~/ios_everton) 개발 현황: git 기록, 모듈별 규모, 기능 체크리스트. 읽기 전용."""
import os
import re
import subprocess

IOS_DIR = os.environ.get("IOS_DIR", os.path.expanduser("~/ios_everton"))
SRC = "Packages/EvertonKit/Sources"
TESTS = "Packages/EvertonKit/Tests"
MODULES = [("EvCore", "모델·서비스·계산"), ("EvNetworking", "API·RSS·캐시"), ("EvDesign", "디자인 시스템"),
           ("EvFeatures", "화면·상태")]

# (이름, 설명, 근거 파일들(소스 기준), 테스트가 다루는지)
FEATURES = [
    ("홈", "클럽 개요 · 다음 경기 카운트다운 · 순위 요약 · 공격 포인트 TOP", ["EvFeatures/HomeView.swift", "EvCore/Metrics.swift"], True),
    ("일정", "월별 일정 표 · 예정/결과 탭", ["EvFeatures/FixturesView.swift"], False),
    ("경기 상세", "통계 비교 · 포메이션 라인업 · 주요 장면", ["EvFeatures/MatchDetailView.swift", "EvFeatures/PitchLineupView.swift",
                                                  "EvFeatures/EventTimeline.swift"], True),
    ("스쿼드", "선수 표(정렬 헤더)", ["EvFeatures/SquadView.swift", "EvFeatures/Shared.swift"], False),
    ("선수 상세", "개요·기록·정보 탭 · 실스탯 기반 강점/레이더", ["EvFeatures/PlayerDetailView.swift", "EvDesign/RadarChart.swift"], True),
    ("리그", "순위표 · 20개 구단 · 구단 로스터", ["EvFeatures/LeagueView.swift", "EvFeatures/StandingsView.swift",
                                       "EvFeatures/ClubDetailView.swift"], False),
    ("뉴스", "RSS 기사 + 온디바이스 한글 번역", ["EvFeatures/NewsView.swift", "EvNetworking/RSSNewsService.swift"], False),
    ("데이터 점검", "시즌·일정·스쿼드 정확성 리포트", ["EvFeatures/DataCheckView.swift"], True),
    ("ESPN 연동(기본)", "키 없이 일정·스쿼드·순위·경기 요약", ["EvNetworking/ESPNService.swift", "EvNetworking/ESPNMapping.swift",
                                                 "EvNetworking/ESPNDTO.swift"], True),
    ("신상 교차 검증", "ESPN 신상 오류를 Wikidata·수동 보정으로 바로잡음", ["EvNetworking/PlayerBio.swift"], True),
    ("API-Football 연동(선택)", "키가 있으면 사진·평점 포함 데이터로 전환", ["EvNetworking/APIFootballService.swift",
                                                         "EvNetworking/Mapping.swift", "EvNetworking/DTO.swift"], True),
    ("에버턴 브랜드 디자인 시스템", "로열 블루 상단 바·흰 카드·아이콘 탭·속성 색 막대·포지션 배지", ["EvDesign/Theme.swift", "EvDesign/Components.swift"], False),
    ("캐시·이미지", "디스크 캐시(오프라인 대비) · 이미지 캐시", ["EvNetworking/DiskCache.swift", "EvNetworking/ImageCache.swift"], False),
]

OPEN_ITEMS = [
    "Swift 코드는 이 서버에서 컴파일하지 못했습니다 (Swift 툴체인 없음). Mac 에서 `swift test` 가 첫 컴파일 검증입니다.",
    "실기기(iPhone 11) 실행·화면 확인은 아직 하지 않았습니다.",
    "데이터 출처는 ESPN 비공식 공개 API 입니다. 형식이 바뀌면 파싱이 깨질 수 있어 캐시·stale 폴백을 둡니다.",
    "ESPN 은 선수 평점·사진·패스/태클 지표·창단연도·수용 인원을 주지 않아 표시하지 않습니다 (임의 값 없음).",
    "온디바이스 번역(Translation 프레임워크)은 실기기에서만 동작을 확인할 수 있습니다.",
]


def _git(*args):
    res = subprocess.run(["git", "-C", IOS_DIR, *args], capture_output=True, text=True, timeout=15)
    return res.stdout.strip() if res.returncode == 0 else ""


def _count_lines(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def _swift_files(root):
    for base, _, files in os.walk(root):
        for name in files:
            if name.endswith(".swift"):
                yield os.path.join(base, name)


def module_stats():
    out = []
    for name, role in MODULES:
        files = list(_swift_files(os.path.join(IOS_DIR, SRC, name)))
        out.append({"name": name, "role": role, "files": len(files), "lines": sum(_count_lines(f) for f in files)})
    return out


def test_stats():
    files = list(_swift_files(os.path.join(IOS_DIR, TESTS)))
    count = 0
    for f in files:
        with open(f, encoding="utf-8", errors="replace") as fh:
            count += len(re.findall(r"\bfunc test\w*\(", fh.read()))
    return {"files": len(files), "functions": count}


def feature_list():
    out = []
    for name, desc, needs, tested in FEATURES:
        present = [os.path.isfile(os.path.join(IOS_DIR, SRC, n)) for n in needs]
        out.append({"name": name, "desc": desc, "implemented": all(present), "files": len(needs), "present": sum(present),
                    "tests": tested, "verified": False})
    return out


def commits(limit=12):
    raw = _git("log", "-n", str(limit), "--date=format:%Y-%m-%dT%H:%M:%S", "--pretty=format:%h\t%ad\t%an\t%s")
    rows = []
    for line in raw.splitlines():
        parts = line.split("\t", 3)
        if len(parts) == 4:
            rows.append({"hash": parts[0], "at": parts[1], "author": parts[2], "subject": parts[3]})
    return rows


def ios_status():
    if not os.path.isdir(IOS_DIR):
        return {"available": False}
    modules = module_stats()
    tests = test_stats()
    features = feature_list()
    total = _git("rev-list", "--count", "HEAD")
    return {
        "available": True,
        "commits_total": int(total) if total.isdigit() else None,
        "commits": commits(),
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(_git("status", "--porcelain")),
        "modules": modules,
        "source_lines": sum(m["lines"] for m in modules),
        "source_files": sum(m["files"] for m in modules),
        "tests": tests,
        "features": features,
        "implemented": sum(1 for f in features if f["implemented"]),
        "open_items": OPEN_ITEMS,
        "target": {"device": "iPhone 11", "min_ios": "18", "season": "2026-27", "team": "Everton"},
    }
