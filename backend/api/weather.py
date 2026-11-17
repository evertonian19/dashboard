"""Weather card: current city and forecast."""
from backend.db import db, get_setting, one_line, set_setting
from backend.weather import DEFAULT_CITY, geocode, weather


class WeatherMixin:
    """Weather card: current city and forecast."""

    # -- weather ----------------------------------------------------------
    def get_weather(self):
        with db() as conn:
            city = get_setting(conn, "weather_city", DEFAULT_CITY)
        try:
            self.send_json(weather(city))
        except Exception as exc:
            self.send_json({"city": city["name"], "error": f"날씨를 가져오지 못했어요 ({exc})"})

    def save_weather(self):
        data = self.read_json()
        if data is None:
            return
        name = one_line(data.get("city"), 40)
        if not name:
            return self.fail(400, "도시 이름을 입력해 주세요")
        try:
            city = geocode(name)
        except Exception as exc:
            return self.fail(502, f"도시를 찾는 중 오류가 났어요 ({exc})")
        if not city:
            return self.fail(404, f"'{name}' 도시를 찾지 못했어요")
        with db() as conn:
            set_setting(conn, "weather_city", city)
        self.get_weather()
