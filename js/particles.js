/**
 * particles.js
 * ──────────────────────────────────────────────────────────────
 * Sistema de partículas em canvas para o fundo dinâmico.
 * Cada condição climática gera partículas distintas:
 *   clear/pclear → estrelas piscando (noite) ou bolhas (dia)
 *   rain/drizzle → gotas de chuva inclinadas
 *   snow         → flocos de neve girando
 *   storm        → chuva densa + relâmpagos ocasionais
 *   fog/cloudy   → névoa flutuante
 * ──────────────────────────────────────────────────────────────
 */

const ParticleSystem = (() => {

  let canvas, ctx, W, H;
  let particles = [];
  let animId    = null;
  let currentType = null;
  let lightningTimer = 0;

  /* ── Inicializa o canvas ───────────────────────────────────── */
  function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
  }

  function _resize() {
    if (!canvas) return;
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  /* ── Fábricas de partículas ─────────────────────────────────── */

  function _makeStar() {
    return {
      kind: 'star',
      x   : Math.random() * W,
      y   : Math.random() * H * 0.75,
      r   : Math.random() * 1.5 + 0.4,
      base: Math.random(),
      speed: Math.random() * 0.4 + 0.2,
      phase: Math.random() * Math.PI * 2
    };
  }

  function _makeOrb() {
    return {
      kind : 'orb',
      x    : Math.random() * W,
      y    : Math.random() * H,
      r    : Math.random() * 5 + 2,
      vx   : (Math.random() - 0.5) * 0.3,
      vy   : -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.12 + 0.04
    };
  }

  function _makeRain(heavy = false) {
    return {
      kind: 'rain',
      x   : Math.random() * W * 1.4 - W * 0.2,
      y   : -30,
      len : Math.random() * (heavy ? 28 : 18) + 10,
      vx  : heavy ? 2.5 : 1.2,
      vy  : Math.random() * (heavy ? 22 : 14) + (heavy ? 14 : 8),
      w   : Math.random() * (heavy ? 1.6 : 1.0) + 0.5,
      alpha: Math.random() * 0.4 + (heavy ? 0.3 : 0.15)
    };
  }

  function _makeSnow() {
    return {
      kind : 'snow',
      x    : Math.random() * W,
      y    : -10,
      r    : Math.random() * 4 + 2,
      vx   : (Math.random() - 0.5) * 0.8,
      vy   : Math.random() * 1.5 + 0.5,
      rot  : Math.random() * Math.PI * 2,
      rspd : (Math.random() - 0.5) * 0.02,
      alpha: Math.random() * 0.5 + 0.4,
      drift: Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2
    };
  }

  function _makeFog() {
    return {
      kind : 'fog',
      x    : Math.random() * W,
      y    : Math.random() * H,
      r    : Math.random() * 160 + 60,
      vx   : (Math.random() - 0.5) * 0.15,
      vy   : (Math.random() - 0.5) * 0.08,
      alpha: Math.random() * 0.04 + 0.01
    };
  }

  /* ── Geração por tipo climático ─────────────────────────────── */
  const GENERATORS = {
    clear   : (n) => Array.from({ length: n }, _makeStar),
    pclear  : (n) => Array.from({ length: Math.floor(n*0.5) }, _makeStar)
                   .concat(Array.from({ length: Math.floor(n*0.5) }, _makeOrb)),
    cloudy  : (n) => Array.from({ length: n }, _makeOrb),
    overcast: (n) => Array.from({ length: n }, _makeOrb),
    fog     : (n) => Array.from({ length: n }, _makeFog),
    drizzle : (n) => Array.from({ length: n }, () => _makeRain(false)),
    rain    : (n) => Array.from({ length: n }, () => _makeRain(false)),
    shower  : (n) => Array.from({ length: n }, () => _makeRain(true)),
    storm   : (n) => Array.from({ length: n }, () => _makeRain(true)),
    snow    : (n) => Array.from({ length: n }, _makeSnow)
  };

  const COUNTS = {
    clear: 80, pclear: 60, cloudy: 25, overcast: 20,
    fog: 14, drizzle: 55, rain: 70, shower: 90, storm: 110, snow: 60
  };

  /* ── Actualização das partículas ────────────────────────────── */
  function _update(type, t) {
    particles.forEach(p => {

      if (p.kind === 'star') {
        // piscar suave
        p.alpha = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));
        return;
      }

      if (p.kind === 'orb') {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -20) { Object.assign(p, _makeOrb()); p.y = H + 10; }
        return;
      }

      if (p.kind === 'rain') {
        p.x += p.vx; p.y += p.vy;
        if (p.y > H + 30) { Object.assign(p, _makeRain(type === 'storm' || type === 'shower')); }
        return;
      }

      if (p.kind === 'snow') {
        p.x += p.vx + p.drift * Math.sin(t * 0.8 + p.phase);
        p.y += p.vy;
        p.rot += p.rspd;
        if (p.y > H + 10) Object.assign(p, _makeSnow());
        return;
      }

      if (p.kind === 'fog') {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.r*2)  p.x = W + p.r;
        if (p.x > W + p.r) p.x = -p.r;
        if (p.y < -p.r*2)  p.y = H + p.r;
        if (p.y > H + p.r) p.y = -p.r;
        return;
      }
    });
  }

  /* ── Desenho ────────────────────────────────────────────────── */
  function _draw(type, t) {
    ctx.clearRect(0, 0, W, H);

    // relâmpago ocasional na tempestade
    if (type === 'storm') {
      lightningTimer--;
      if (lightningTimer <= 0) {
        lightningTimer = Math.floor(Math.random() * 180 + 90);
        const lx = Math.random() * W;
        ctx.save();
        ctx.strokeStyle = 'rgba(220,220,255,0.9)';
        ctx.lineWidth = Math.random() * 2 + 0.5;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(180,180,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(lx + (Math.random()-0.5)*60, (i+1) * (H * 0.4 / 5));
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    particles.forEach(p => {

      if (p.kind === 'star') {
        ctx.save();
        ctx.globalAlpha = p.alpha ?? 0.7;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (p.kind === 'orb') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (p.kind === 'rain') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = 'rgba(160,210,255,0.9)';
        ctx.lineWidth   = p.w;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * (p.len / p.vy), p.y - p.len);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (p.kind === 'snow') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(220,240,255,0.9)';
        // hexágono simples
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          i === 0
            ? ctx.moveTo(Math.cos(a)*p.r, Math.sin(a)*p.r)
            : ctx.lineTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      if (p.kind === 'fog') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(200,210,230,0.5)');
        g.addColorStop(1, 'rgba(200,210,230,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
    });
  }

  /* ── Loop de animação ───────────────────────────────────────── */
  function _loop(t = 0) {
    _update(currentType, t * 0.001);
    _draw(currentType, t * 0.001);
    animId = requestAnimationFrame(_loop);
  }

  /* ── API pública ────────────────────────────────────────────── */

  /**
   * set(type, isNight)
   * Troca o tipo de partículas conforme o clima.
   */
  function set(type, isNight = false) {
    const t = (isNight && (type === 'clear' || type === 'pclear'))
              ? 'clear'
              : type;
    if (t === currentType) return;
    currentType = t;

    if (animId) cancelAnimationFrame(animId);
    particles = [];

    const gen   = GENERATORS[t] || GENERATORS.cloudy;
    const count = COUNTS[t]     || 40;
    particles   = gen(count);
    lightningTimer = 60;

    animId = requestAnimationFrame(_loop);
  }

  /**
   * stop()
   * Para o loop e limpa o canvas.
   */
  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (ctx)    ctx.clearRect(0, 0, W, H);
    particles = [];
    currentType = null;
  }

  return { init, set, stop };

})();