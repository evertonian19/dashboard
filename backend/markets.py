"""시장 지수 (Yahoo Finance 차트 엔드포인트, 키 불필요). 심볼 이름만 외부로 나갑니다."""
import json
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

MARKETS_TTL = 60
POINTS = 40
SYMBOLS = [("^KS11", "코스피"), ("^KQ11", "코스닥"), ("^IXIC", "나스닥"), ("NVDA", "엔비디아")]
# 우측 레일: 환율(원)과 금속 선물(USD). 엔은 단가가 작아 100엔 기준으로 환산한다.
RAIL_SYMBOLS = [("KRW=X", "달러 (원)"), ("JPYKRW=X", "100엔 (원)"),
                ("GC=F", "금 (oz)"), ("SI=F", "은 (oz)"), ("HG=F", "구리 (lb)")]
SCALES = {"JPYKRW=X": 100}
_cache = {}          # symbol -> (시각, 결과)
_lock = threading.Lock()


def _fetch(symbol):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%s?range=3mo&interval=1d" % quote(symbol)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res)


def parse_chart(symbol, name, payload, scale=1):
    """차트 응답에서 현재가·전일 대비·종가 배열을 뽑는다.
    chartPreviousClose 는 조회 범위 시작 전 종가라서 쓰지 않고, 마지막 두 거래일 종가로 계산한다."""
    result = payload["chart"]["result"][0]
    meta = result["meta"]
    stamps = result.get("timestamp") or []
    raw = result["indicators"]["quote"][0].get("close") or []
    pairs = [(t, c) for t, c in zip(stamps, raw) if c is not None]
    if not pairs:
        raise ValueError("no data")
    price = meta.get("regularMarketPrice")
    if price is None:
        price = pairs[-1][1]
    offset = meta.get("gmtoffset") or 0
    day = lambda t: (t + offset) // 86400
    closes = [c for _, c in pairs]
    market_time = meta.get("regularMarketTime") or pairs[-1][0]
    if day(pairs[-1][0]) == day(market_time) and len(closes) >= 2:
        prev = closes[-2]
        series = closes[:-1] + [price]
    else:
        prev = closes[-1]
        series = closes + [price]
    if scale != 1:
        price, prev = price * scale, prev * scale
        series = [v * scale for v in series]
    change = price - prev
    return {
        "symbol": symbol, "name": name, "currency": meta.get("currency") or "",
        "price": round(price, 2), "change": round(change, 2),
        "pct": round(change / prev * 100, 2) if prev else 0.0,
        "closes": [round(v, 2) for v in series[-POINTS:]],
        "as_of": market_time, "stale": False,
    }


def _one(symbol, name):
    now = time.time()
    with _lock:
        hit = _cache.get(symbol)
    if hit and now - hit[0] < MARKETS_TTL:
        return hit[1]
    try:
        data = parse_chart(symbol, name, _fetch(symbol), SCALES.get(symbol, 1))
    except Exception:
        if hit:
            return dict(hit[1], stale=True)
        return {"symbol": symbol, "name": name, "error": True}
    with _lock:
        _cache[symbol] = (now, data)
    return data


def market_overview(symbols=None):
    symbols = symbols or SYMBOLS
    with ThreadPoolExecutor(max_workers=len(symbols)) as pool:
        items = list(pool.map(lambda s: _one(*s), symbols))
    return {"items": items}


def rail_rates():
    return market_overview(RAIL_SYMBOLS)
