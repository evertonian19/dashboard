"""Weather (Open-Meteo, no API key)."""
import json
import threading
import time
import urllib.request
from urllib.parse import urlencode

from backend.db import now_iso


# ---------------------------------------------------------------------------
# Weather (Open-Meteo, no API key). Only the city name / coordinates are sent.
WEATHER_TTL = 600
DEFAULT_CITY = {"name": "서울", "lat": 37.5665, "lon": 126.978}
WEATHER_TEXT = {
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개",
    51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비", 56: "어는 이슬비", 57: "어는 이슬비",
    61: "약한 비", 63: "비", 65: "강한 비", 66: "어는 비", 67: "어는 비",
    71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈", 80: "약한 소나기", 81: "소나기",
    82: "강한 소나기", 85: "약한 눈 소나기", 86: "눈 소나기", 95: "뇌우", 96: "우박 뇌우", 99: "우박 뇌우",
}
_weather_cache = {}
_weather_lock = threading.Lock()


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dashboard"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res)


def geocode(name):
    data = http_json("https://geocoding-api.open-meteo.com/v1/search?"
                     + urlencode({"name": name, "count": 1, "language": "ko"}))
    hit = (data.get("results") or [None])[0]
    if not hit:
        return None
    label = hit.get("name") or name
    return {"name": label, "lat": round(hit["latitude"], 4), "lon": round(hit["longitude"], 4)}


def weather(city):
    key = (city["lat"], city["lon"])
    with _weather_lock:
        cached = _weather_cache.get(key)
    if cached and time.time() - cached[0] < WEATHER_TTL:
        return cached[1]
    data = http_json("https://api.open-meteo.com/v1/forecast?" + urlencode({
        "latitude": city["lat"], "longitude": city["lon"], "timezone": "auto", "forecast_days": 3,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "wind_speed_unit": "ms",
    }))
    cur, daily = data["current"], data["daily"]
    result = {
        "city": city["name"], "fetched_at": now_iso(),
        "current": {"temp": cur["temperature_2m"], "feels": cur["apparent_temperature"],
                    "humidity": cur["relative_humidity_2m"], "wind": cur["wind_speed_10m"],
                    "text": WEATHER_TEXT.get(cur["weather_code"], "")},
        "days": [{"date": d, "max": daily["temperature_2m_max"][i], "min": daily["temperature_2m_min"][i],
                  "rain": daily["precipitation_probability_max"][i],
                  "text": WEATHER_TEXT.get(daily["weather_code"][i], "")}
                 for i, d in enumerate(daily["time"])],
    }
    with _weather_lock:
        _weather_cache[key] = (time.time(), result)
    return result
