/**
 * ui.js
 * ──────────────────────────────────────────────────────────────
 * Responsável por toda manipulação do DOM:
 *  - Alternância de telas (welcome / loading / error / weather)
 *  - Renderização do card principal, métricas, horária, semanal
 *  - Atualização do fundo dinâmico (gradiente + partículas)
 *  - Relógio e badges
 *
 * Depende de: AppData (data.json carregado em app.js)
 * ──────────────────────────────────────────────────────────────
 */

const UI = (() => {

  /* ── Referências DOM ───────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  const screens = {
    welcome : $('welcome-screen'),
    loading : $('loading-screen'),
    error   : $('error-screen'),
    weather : $('weather-main')
  };

  /* ── Telas ─────────────────────────────────────────────────── */
  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      if (!el) return;
      el.hidden = (k !== name);
    });
  }

  function showLoading() { showScreen('loading'); }
  function showWelcome() { showScreen('welcome'); }
  function showError(msg) {
    $('error-message').textContent = msg || AppData.messages.api_error;
    showScreen('error');
  }
  function showWeather() { showScreen('weather'); }

  /* ── Relógio ────────────────────────────────────────────────── */
  function startClock() {
    const el = $('live-clock');
    if (!el) return;
    function tick() {
      const d  = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      el.textContent = `${hh}:${mm}:${ss}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── Fundo dinâmico ────────────────────────────────────────── */
  function updateBackground(wmoType, isNight, currentHour) {
    const bg  = $('bg-gradient');
    if (!bg) return;

    let key;
    if (wmoType === 'clear' || wmoType === 'pclear') {
      if (isNight) key = 'clear-night';
      else if (currentHour < 7)  key = 'dawn';
      else if (currentHour > 19) key = 'dusk';
      else key = 'clear-day';
    } else {
      key = wmoType;
    }

    const gradient = AppData.backgrounds[key] || AppData.backgrounds['cloudy'];
    bg.style.background = gradient;

    // Partículas
    ParticleSystem.set(wmoType, isNight);
  }

  /* ── Utilitários de temperatura ────────────────────────────── */
  function fmtTemp(c, unit) {
    if (unit === 'F') return `${Math.round(c * 9/5 + 32)}°`;
    return `${Math.round(c)}°`;
  }

  /* ── Utilitários de lookup no JSON ─────────────────────────── */
  function getWMO(code) {
    return AppData.wmo_codes[String(code)]
      || { label: 'Desconhecido', icon: '🌡️', type: 'cloudy' };
  }

  function getUVInfo(uv) {
    return AppData.uv_levels.find(l => uv <= l.max)
      || AppData.uv_levels.at(-1);
  }

  function getVisLabel(km) {
    return (AppData.visibility_levels.find(l => km <= l.max) || {}).label || 'Excelente';
  }

  function getPressureLabel(hpa) {
    return (AppData.pressure_levels.find(l => hpa <= l.max) || {}).label || 'Normal';
  }

  function getWindDir(deg) {
    const idx = Math.round(deg / 22.5) % 16;
    return AppData.wind_directions[idx] || '—';
  }

  function fmtTime(isoStr) {
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function fmtDayName(isoDate, idx) {
    if (idx === 0) return 'Amanhã';
    const d = new Date(isoDate + 'T12:00:00');
    return AppData.days_pt[d.getDay()];
  }

  function countryFlag(code) {
    if (!code) return '🌍';
    return [...code.toUpperCase()].map(c =>
      String.fromCodePoint(c.charCodeAt(0) + 127397)
    ).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     renderMain(data, location, unit)
     Renderiza o card principal com temperatura e barra do dia.
  ══════════════════════════════════════════════════════════════ */
  function renderMain(data, location, unit) {
    const c   = data.current;
    const d0  = {
      max    : data.daily.temperature_2m_max[0],
      min    : data.daily.temperature_2m_min[0],
      sunrise: data.daily.sunrise[0],
      sunset : data.daily.sunset[0]
    };
    const wmo = getWMO(c.weather_code);

    // Localização
    $('location-name').textContent = location.city;
    $('location-meta').textContent =
      [location.state, location.country, data.timezone].filter(Boolean).join(' · ');

    // Temperatura
    $('temp-value').textContent    = fmtTemp(c.temperature_2m, unit);
    $('weather-icon').textContent  = wmo.icon;
    $('weather-label').textContent = wmo.label;
    $('feels-like').textContent    = `Sensação: ${fmtTemp(c.apparent_temperature, unit)}`;
    $('temp-range').textContent    =
      `↑ ${fmtTemp(d0.max, unit)}   ↓ ${fmtTemp(d0.min, unit)}`;

    // Barra dia/noite
    const now     = new Date(data.current.time);
    const sunrise = new Date(d0.sunrise);
    const sunset  = new Date(d0.sunset);
    const dayLen  = sunset - sunrise;
    const elapsed = Math.max(0, now - sunrise);
    const pct     = dayLen > 0 ? Math.min(100, (elapsed / dayLen) * 100) : 0;

    $('sunrise-marker').textContent = `🌅 ${fmtTime(d0.sunrise)}`;
    $('sunset-marker').textContent  = `🌇 ${fmtTime(d0.sunset)}`;
    $('day-progress').style.width   = `${pct}%`;
    $('sun-dot').style.left         = `${pct}%`;

    // Fundo
    const isNight = c.is_day === 0;
    const currentHour = now.getHours();
    updateBackground(wmo.type, isNight, currentHour);
  }

  /* ══════════════════════════════════════════════════════════════
     renderMetrics(data, unit)
     Preenche os 6 cards de métricas.
  ══════════════════════════════════════════════════════════════ */
  function renderMetrics(data, unit) {
    const c  = data.current;
    const d0 = {
      rain_prob: data.daily.precipitation_probability_max[0],
      rain_sum : data.daily.precipitation_sum[0]
    };

    // Umidade
    $('m-humidity').textContent  = `${c.relative_humidity_2m}%`;
    $('bar-humidity').style.width = `${c.relative_humidity_2m}%`;

    // Vento
    $('m-wind').textContent     = `${Math.round(c.wind_speed_10m)} km/h`;
    $('m-wind-dir').textContent = `Direção: ${getWindDir(c.wind_direction_10m)}`;

    // Pressão
    $('m-pressure').textContent        = `${Math.round(c.surface_pressure)} hPa`;
    $('m-pressure-status').textContent = getPressureLabel(c.surface_pressure);

    // UV
    const uvInfo = getUVInfo(c.uv_index);
    $('m-uv').textContent       = Math.round(c.uv_index);
    $('m-uv-label').textContent = uvInfo.label;
    // A faixa UV é uma barra de gradiente; mostramos o cursor como "right"
    const uvPct = Math.min(100, (c.uv_index / 12) * 100);
    $('uv-fill').style.right = `${100 - uvPct}%`;

    // Visibilidade
    const visKm = Math.round(c.visibility / 1000);
    $('m-visibility').textContent       = `${visKm} km`;
    $('m-visibility-label').textContent = getVisLabel(visKm);

    // Chuva
    $('m-rain').textContent      = `${(d0.rain_sum || 0).toFixed(1)} mm`;
    $('m-rain-prob').textContent = `Prob.: ${d0.rain_prob || 0}%`;
  }

  /* ══════════════════════════════════════════════════════════════
     renderHourly(data, unit)
     Renderiza os chips das próximas 24h.
  ══════════════════════════════════════════════════════════════ */
  function renderHourly(data, unit) {
    const track  = $('hourly-track');
    const nowISO = data.current.time.slice(0, 13); // "2024-01-01T14"
    const idx    = data.hourly.time.findIndex(t => t >= nowISO);
    const start  = idx < 0 ? 0 : idx;

    const hours = data.hourly.time.slice(start, start + 24);
    const temps = data.hourly.temperature_2m.slice(start, start + 24);
    const probs = data.hourly.precipitation_probability.slice(start, start + 24);
    const codes = data.hourly.weather_code.slice(start, start + 24);

    track.innerHTML = hours.map((t, i) => {
      const d    = new Date(t);
      const isNow = i === 0;
      const wmo  = getWMO(codes[i]);
      return `
        <div class="hour-chip${isNow ? ' now' : ''}">
          <div class="hour-time">${isNow ? 'Agora' : String(d.getHours()).padStart(2,'0') + 'h'}</div>
          <div class="hour-icon">${wmo.icon}</div>
          <div class="hour-temp">${fmtTemp(temps[i], unit)}</div>
          <div class="hour-rain">💧 ${probs[i] || 0}%</div>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     renderForecast(data, unit)
     Renderiza as linhas da previsão de 7 dias.
  ══════════════════════════════════════════════════════════════ */
  function renderForecast(data, unit) {
    const list = $('forecast-list');
    const days = data.daily;

    // Ignora o dia atual (índice 0), mostra os próximos 7
    const times    = days.time.slice(1, 8);
    const maxTemps = days.temperature_2m_max.slice(1, 8);
    const minTemps = days.temperature_2m_min.slice(1, 8);
    const codes    = days.weather_code.slice(1, 8);
    const probs    = days.precipitation_probability_max.slice(1, 8);

    const globalMin = Math.min(...minTemps);
    const globalMax = Math.max(...maxTemps);
    const range     = globalMax - globalMin || 1;

    list.innerHTML = times.map((date, i) => {
      const wmo     = getWMO(codes[i]);
      const mn      = minTemps[i];
      const mx      = maxTemps[i];
      const barLeft = ((mn - globalMin) / range * 100).toFixed(1);
      const barW    = ((mx - mn) / range * 100).toFixed(1);

      return `
        <div class="forecast-row">
          <div class="fc-day">${fmtDayName(date, i)}</div>
          <div class="fc-icon">${wmo.icon}</div>
          <div class="fc-bar-wrap">
            <div class="fc-min">${fmtTemp(mn, unit)}</div>
            <div class="fc-bar">
              <div class="fc-bar-inner" style="left:${barLeft}%;width:${barW}%"></div>
            </div>
            <div class="fc-max">${fmtTemp(mx, unit)}</div>
          </div>
          <div class="fc-rain">💧 ${probs[i] || 0}%</div>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     renderSuggestions(results)
     Monta a lista de autocomplete.
  ══════════════════════════════════════════════════════════════ */
  function renderSuggestions(results) {
    const list = $('suggestions-list');
    if (!results.length) {
      hideSuggestions();
      return;
    }
    list.innerHTML = results.map(r => `
      <li class="suggestion-item"
          role="option"
          data-lat="${r.latitude}"
          data-lon="${r.longitude}"
          data-city="${_esc(r.name)}"
          data-country="${_esc(r.country || '')}"
          data-state="${_esc(r.admin1 || '')}">
        <span class="sug-flag">${countryFlag(r.country_code)}</span>
        <div>
          <div class="sug-name">${r.name}${r.admin1 ? `, ${r.admin1}` : ''}</div>
          <div class="sug-meta">${r.country || ''}</div>
        </div>
      </li>
    `).join('');
    list.classList.add('open');
  }

  function hideSuggestions() {
    const list = $('suggestions-list');
    list.innerHTML = '';
    list.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════════════
     renderQuickCities()
     Popula os botões de cidades rápidas a partir do JSON.
  ══════════════════════════════════════════════════════════════ */
  function renderQuickCities(onSelect) {
    const wrap = document.querySelector('.quick-links');
    if (!wrap || !AppData.quick_cities) return;
    wrap.innerHTML = AppData.quick_cities.map(c => `
      <button class="quick-btn"
              data-lat="${c.lat}"
              data-lon="${c.lon}"
              data-city="${_esc(c.name)}"
              data-country="${_esc(c.country)}">
        ${c.flag} ${c.name}
      </button>
    `).join('');
    wrap.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        onSelect({
          lat    : btn.dataset.lat,
          lon    : btn.dataset.lon,
          city   : btn.dataset.city,
          country: btn.dataset.country,
          state  : ''
        });
      });
    });
  }

  /* ── Footer: última atualização + badge de cache ───────────── */
  function setLastUpdated(fromCache) {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2,'0');
    const mm  = String(now.getMinutes()).padStart(2,'0');
    const el  = $('last-updated');
    const badge = $('cache-badge');
    if (el) el.textContent = `Atualizado às ${hh}:${mm}`;
    if (badge) badge.hidden = !fromCache;
  }

  /* ── Escape básico para atributos data-* ───────────────────── */
  function _esc(str) {
    return (str || '').replace(/"/g, '&quot;');
  }

  /* ── Expõe API pública ─────────────────────────────────────── */
  return {
    showLoading, showWelcome, showError, showWeather,
    startClock,
    renderMain, renderMetrics, renderHourly, renderForecast,
    renderSuggestions, hideSuggestions,
    renderQuickCities,
    setLastUpdated,
    countryFlag,
    fmtTemp
  };

})();