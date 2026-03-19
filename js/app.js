/**
 * app.js
 * ──────────────────────────────────────────────────────────────
 * Controlador principal da aplicação.
 *
 * Responsabilidades:
 *  1. Carregar data/data.json e expor como AppData global
 *  2. Inicializar partículas, relógio e cidades rápidas
 *  3. Gerenciar estado: unidade (°C/°F), localização atual
 *  4. Orquestrar busca → renderização
 *  5. Vincular todos os eventos de UI
 * ──────────────────────────────────────────────────────────────
 */

/* ── Estado global ─────────────────────────────────────────── */
window.AppData  = null;   // preenchido ao carregar data.json
let currentUnit = 'C';
let lastLocation = null;  // { lat, lon, city, country, state }
let lastWeatherData = null;
let searchDebounce = null;

/* ══════════════════════════════════════════════════════════════
   Inicialização
   Ponto de entrada único: carrega JSON, depois sobe tudo.
══════════════════════════════════════════════════════════════ */
async function init() {
  try {
    const res = await fetch('data/data.json');
    if (!res.ok) throw new Error('Falha ao carregar data.json');
    window.AppData = await res.json();
    console.log('[App] data.json carregado ✓', AppData.config);
  } catch (err) {
    console.error('[App] Erro ao carregar data.json:', err);
    // Fallback mínimo para não travar a UI
    window.AppData = {
      config           : { cache_minutes: 10 },
      quick_cities     : [],
      wmo_codes        : {},
      wind_directions  : [],
      uv_levels        : [],
      visibility_levels: [],
      pressure_levels  : [],
      backgrounds      : {},
      days_pt          : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
      messages: {
        loading      : 'Carregando...',
        not_found    : 'Cidade não encontrada.',
        geo_error    : 'Localização indisponível.',
        api_error    : 'Erro ao carregar dados.',
        geo_unsupport: 'Geolocalização não suportada.',
        search_short : 'Digite ao menos 2 caracteres.'
      }
    };
  }

  // Unidade padrão do JSON
  currentUnit = AppData.config?.default_unit || 'C';
  _updateUnitToggle();

  // Subsistemas
  ParticleSystem.init();
  UI.startClock();
  UI.showWelcome();
  UI.renderQuickCities(_loadByCoords);

  // Eventos
  _bindEvents();
}

/* ══════════════════════════════════════════════════════════════
   Eventos de UI
══════════════════════════════════════════════════════════════ */
function _bindEvents() {

  /* ── Busca por texto ──────────────────────────────────────── */
  const input = document.getElementById('search-input');

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const val = input.value.trim();
    if (val.length < 2) { UI.hideSuggestions(); return; }
    searchDebounce = setTimeout(() => _fetchSuggestions(val), 300);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      UI.hideSuggestions();
      _searchByName(input.value.trim());
    }
    if (e.key === 'Escape') UI.hideSuggestions();
  });

  // Fecha sugestões ao clicar fora
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) UI.hideSuggestions();
  });

  // Clique em sugestão (delegação)
  document.getElementById('suggestions-list').addEventListener('click', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    UI.hideSuggestions();
    input.value = item.querySelector('.sug-name').textContent;
    _loadByCoords({
      lat    : parseFloat(item.dataset.lat),
      lon    : parseFloat(item.dataset.lon),
      city   : item.dataset.city,
      country: item.dataset.country,
      state  : item.dataset.state
    });
  });

  /* ── Geolocalização ───────────────────────────────────────── */
  document.getElementById('geo-btn').addEventListener('click', _geolocate);

  /* ── Toggle °C / °F ───────────────────────────────────────── */
  document.getElementById('unit-toggle').addEventListener('click', e => {
    const opt = e.target.closest('.unit-opt');
    if (!opt) return;
    const unit = opt.dataset.unit;
    if (unit && unit !== currentUnit) {
      currentUnit = unit;
      _updateUnitToggle();
      // Re-renderiza sem nova requisição
      if (lastWeatherData && lastLocation) {
        _renderAll(lastWeatherData, lastLocation, false);
      }
    }
  });

  /* ── Botão retry da tela de erro ──────────────────────────── */
  document.getElementById('retry-btn').addEventListener('click', () => {
    if (lastLocation) {
      _loadByCoords(lastLocation);
    } else {
      UI.showWelcome();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   Busca de sugestões (autocomplete)
══════════════════════════════════════════════════════════════ */
async function _fetchSuggestions(query) {
  try {
    const results = await WeatherAPI.searchCity(query, 6);
    UI.renderSuggestions(results);
  } catch {
    UI.hideSuggestions();
  }
}

/* ══════════════════════════════════════════════════════════════
   Busca por nome (tecla Enter)
══════════════════════════════════════════════════════════════ */
async function _searchByName(query) {
  if (!query || query.length < 2) return;
  UI.showLoading();
  try {
    const results = await WeatherAPI.searchCity(query, 1);
    if (!results.length) {
      UI.showError(AppData.messages.not_found);
      return;
    }
    const r = results[0];
    _loadByCoords({
      lat    : r.latitude,
      lon    : r.longitude,
      city   : r.name,
      country: r.country  || '',
      state  : r.admin1   || ''
    });
  } catch {
    UI.showError(AppData.messages.api_error);
  }
}

/* ══════════════════════════════════════════════════════════════
   Carrega clima por coordenadas
   Chamado tanto por sugestões, cidades rápidas e geolocalização.
══════════════════════════════════════════════════════════════ */
async function _loadByCoords(location) {
  UI.showLoading();
  lastLocation = location;

  try {
    const ttl  = AppData.config?.cache_minutes || 10;
    const data = await WeatherAPI.fetchWeather(location.lat, location.lon, ttl);
    lastWeatherData = data;
    _renderAll(data, location, data._fromCache === false ? false : true);
  } catch (err) {
    console.error('[App] erro ao buscar clima:', err);
    UI.showError(AppData.messages.api_error);
  }
}

/* ══════════════════════════════════════════════════════════════
   Geolocalização do dispositivo
══════════════════════════════════════════════════════════════ */
async function _geolocate() {
  UI.showLoading();
  try {
    const { lat, lon } = await WeatherAPI.getUserLocation();
    const place = await WeatherAPI.reverseGeocode(lat, lon);
    _loadByCoords({ lat, lon, ...place });
  } catch (err) {
    if (err.message === 'geolocation_unsupported') {
      UI.showError(AppData.messages.geo_unsupport);
    } else {
      UI.showError(AppData.messages.geo_error);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   Renderização completa
══════════════════════════════════════════════════════════════ */
function _renderAll(data, location, fromCache) {
  UI.showWeather();
  UI.renderMain(data, location, currentUnit);
  UI.renderMetrics(data, currentUnit);
  UI.renderHourly(data, currentUnit);
  UI.renderForecast(data, currentUnit);
  UI.setLastUpdated(fromCache);
}

/* ── Toggle visual da unidade ──────────────────────────────── */
function _updateUnitToggle() {
  document.querySelectorAll('.unit-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.unit === currentUnit);
  });
}

/* ── Dispara quando o DOM está pronto ─────────────────────── */
document.addEventListener('DOMContentLoaded', init);