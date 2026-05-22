class Dashboard {
  #store;

  constructor(store) {
    this.#store = store;
  }

  update() {
    this.#updateStats();
    this.#updateWeekRow();
    this.#updateActivityLists();
    this.#updateRings();
  }

  #updateStats() {
    const activities = this.#store.getAll();
    const now = new Date();

    const days = Math.max(0, Math.ceil((new Date('2025-11-01') - now) / 86400000));
    document.getElementById('statDays').textContent = days;

    const totalMins = activities.reduce((s, a) => s + a.dur, 0);
    document.getElementById('statVolume').innerHTML   = (totalMins / 60).toFixed(1) + '<span class="stat-unit">h</span>';
    document.getElementById('statSessions').innerHTML = activities.length + '<span class="stat-unit">/6</span>';

    const withHR = activities.filter(a => a.hr > 0);
    const avgHR  = withHR.length ? Math.round(withHR.reduce((s, a) => s + a.hr, 0) / withHR.length) : null;
    document.getElementById('statHR').innerHTML = (avgHR || '—') + '<span class="stat-unit">bpm</span>';

    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    document.getElementById('weekDateRange').textContent = `${fmt(monday)} – ${fmt(sunday)} · Base 1 Block`;
    document.getElementById('weekNum').textContent = this.#isoWeekNumber(now);
  }

  #isoWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  #updateWeekRow() {
    const activities = this.#store.getAll();
    const dayMap = [6, 0, 1, 2, 3, 4, 5];
    const today  = dayMap[new Date().getDay()];

    document.getElementById('weekRow').innerHTML = WEEK_PLAN.map((p, i) => {
      const isToday = today === i;
      const done    = activities.some(a => dayMap[new Date(a.date).getDay()] === i);
      return `<div class="day-cell ${p.type === 'rest' ? 'rest' : ''} ${isToday ? 'today' : ''} ${done ? 'completed' : ''}">
        <div class="d-label">${p.day}</div>
        <div class="d-icon">${done ? '✅' : p.icon}</div>
        <div class="d-type">${p.label}</div>
        <div class="d-dur">${p.dur}</div>
      </div>`;
    }).join('');
  }

  #updateActivityLists() {
    const activities = this.#store.getAll();
    const html = activities.length
      ? activities.slice().reverse().map(Dashboard.#activityHTML).join('')
      : '<div class="empty"><div class="empty-icon">🏁</div><p>Noch keine Einheiten geloggt.</p></div>';
    document.getElementById('activityListMain').innerHTML     = html;
    document.getElementById('activityListProgress').innerHTML = html;
  }

  static #activityHTML(a) {
    return `<div class="activity-row">
      <div class="activity-sport-badge ${BADGE_CLASS[a.sport]}">${SPORT_ICONS[a.sport]}</div>
      <div class="activity-info">
        <div class="a-name">${SPORT_NAMES[a.sport]} — ${a.type}</div>
        <div class="a-meta">${a.date}${a.notes ? ' · ' + a.notes.substring(0, 50) + (a.notes.length > 50 ? '…' : '') : ''}</div>
      </div>
      <div class="activity-metrics">
        ${a.dur  ? `<div class="a-metric"><div class="val">${a.dur}</div><div class="lbl">min</div></div>` : ''}
        ${a.dist ? `<div class="a-metric"><div class="val">${a.dist}</div><div class="lbl">km</div></div>` : ''}
        ${a.hr   ? `<div class="a-metric"><div class="val">${a.hr}</div><div class="lbl">bpm</div></div>` : ''}
      </div>
      <div class="feel-badge">${FEEL_EMOJI[a.feelAfter] || '😐'}</div>
    </div>`;
  }

  #updateRings() {
    const activities = this.#store.getAll();
    const swimKm = activities.filter(a => a.sport === 'swim').reduce((s, a) => s + a.dist, 0);
    const bikeKm = activities.filter(a => a.sport === 'bike').reduce((s, a) => s + a.dist, 0);
    const runKm  = activities.filter(a => a.sport === 'run').reduce((s, a) => s + a.dist, 0);
    const circ   = 2 * Math.PI * 32;

    const setRing = (id, valId, km, target) => {
      document.getElementById(id).setAttribute('stroke-dasharray', `${Math.min(km / target, 1) * circ} ${circ}`);
      document.getElementById(valId).textContent = km.toFixed(1);
    };

    setTimeout(() => {
      setRing('ringSwim', 'ringSwimVal', swimKm, 4);
      setRing('ringBike', 'ringBikeVal', bikeKm, 60);
      setRing('ringRun',  'ringRunVal',  runKm,  25);
    }, 200);
  }
}
