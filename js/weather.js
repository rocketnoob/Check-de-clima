/**
 * weather.js
 * ──────────────────────────────────────────────────────────────
 * Responsável por toda comunicação com APIs externas:
 *  - Open-Meteo  → dados meteorológicos (gratuito, sem chave)
 *  - Open-Meteo Geocoding → busca de cidades
 *  - Nominatim (OSM)     → geocodificação reversa
 *
 * Também implementa um cache leve em memória para evitar
 * requisições repetidas dentro da janela de tempo configurada.
 * ──────────────────────────────────────────────────────────────
 */

const WeatherAPI = (() => {

  /* ── Cache em memória ──────────────────────────────────────── */
  const _cache = new Map();

  function _cacheKey(type, ...args) {
    return `${type}::${args.join(',')}`;
  }

  function _cacheGet(key, ttlMinutes) {
    if (!_cache.has(key)) return null;
    const { data, timestamp } = _cache.get(key);
    const age = (Date.now() - timestamp) / 1000 / 60;
    if (age > ttlMinutes) { _cache.delete(key); return null; }
    return data;
  }

  function _cacheSet(key, data) {
    _cache.set(key, { data, timestamp: Date.now() });
  }

  /* ── Fetch com timeout ─────────────────────────────────────── */
  async function _fetch(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     fetchWeather(lat, lon, ttlMinutes)
     Busca previsão completa na Open-Meteo.
     Retorna objeto com current, hourly, daily + metadados.
  ══════════════════════════════════════════════════════════════ */
  async function fetchWeather(lat, lon, ttlMinutes = 10) {
    const latR = parseFloat(lat).toFixed(3);
    const lonR = parseFloat(lon).toFixed(3);
    const key  = _cacheKey('weather', latR, lonR);

    const cached = _cacheGet(key, ttlMinutes);
    if (cached) {
      console.log(`[WeatherAPI] cache hit → clima (${latR}, ${lonR})`);
      return { ...cached, _fromCache: true };
    }

    const params = new URLSearchParams({
      latitude : latR,
      longitude: lonR,
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation',
        'weather_code',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'uv_index',
        'visibility',
        'is_day'
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'weather_code',
        'wind_speed_10m'
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'precipitation_sum',
        'precipitation_probability_max',
        'uv_index_max',
        'wind_speed_10m_max'
      ].join(','),
      wind_speed_unit: 'kmh',
      timezone       : 'auto',
      forecast_days  : 8
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    console.log(`[WeatherAPI] requisição → clima (${latR}, ${lonR})`);

    const data = await _fetch(url);
    _cacheSet(key, data);
    return { ...data, _fromCache: false };
  }

  /* ══════════════════════════════════════════════════════════════
     searchCity(query, count)
     Geocodificação por nome via Open-Meteo Geocoding API.
     Retorna array de resultados.
  ══════════════════════════════════════════════════════════════ */
  async function searchCity(query, count = 6) {
    const q   = query.trim();
    if (q.length < 2) return [];

    const key = _cacheKey('search', q.toLowerCase());
    const cached = _cacheGet(key, 60); // cache de 1h para geocoding
    if (cached) {
      console.log(`[WeatherAPI] cache hit → busca "${q}"`);
      return cached;
    }

    const params = new URLSearchParams({
      name    : q,
      count   : count,
      language: 'pt',
      format  : 'json'
    });

    const url = `https://geocoding-api.open-meteo.com/v1/search?${params}`;
    console.log(`[WeatherAPI] requisição → busca "${q}"`);

    const data = await _fetch(url);
    const results = data.results || [];
    _cacheSet(key, results);
    return results;
  }

  /* ══════════════════════════════════════════════════════════════
     reverseGeocode(lat, lon)
     Converte coordenadas em nome de cidade via Nominatim (OSM).
     Retorna { city, country, state }.
  ══════════════════════════════════════════════════════════════ */
  async function reverseGeocode(lat, lon) {
    const latR = parseFloat(lat).toFixed(4);
    const lonR = parseFloat(lon).toFixed(4);
    const key  = _cacheKey('reverse', latR, lonR);

    const cached = _cacheGet(key, 120);
    if (cached) return cached;

    const params = new URLSearchParams({
      lat           : latR,
      lon           : lonR,
      format        : 'json',
      'accept-language': 'pt'
    });

    const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
    console.log(`[WeatherAPI] requisição → reverse (${latR}, ${lonR})`);

    try {
      const data = await _fetch(url, 6000);
      const result = {
        city   : data.address?.city
               || data.address?.town
               || data.address?.village
               || data.address?.county
               || 'Minha Localização',
        country: data.address?.country || '',
        state  : data.address?.state   || ''
      };
      _cacheSet(key, result);
      return result;
    } catch {
      return { city: 'Minha Localização', country: '', state: '' };
    }
  }

  /* ══════════════════════════════════════════════════════════════
     getUserLocation()
     Wrapper para navigator.geolocation com Promise.
     Retorna { lat, lon }.
  ══════════════════════════════════════════════════════════════ */
  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation_unsupported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => reject(new Error('geolocation_denied')),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /* ── Expõe apenas o necessário ─────────────────────────────── */
  return { fetchWeather, searchCity, reverseGeocode, getUserLocation };

})();