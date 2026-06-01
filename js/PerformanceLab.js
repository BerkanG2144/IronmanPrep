class PerformanceLab {
  #weekOffset = 0;
  static #SESSIONS_KEY = 'perf_lab_sessions';
  static #COUNTERS_KEY = 'perf_lab_counters';

  static #DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  static #DAY_FULL = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  static #TYPE_ICON = { swim:'🏊', bike:'🚴', run:'🏃', brick:'🔥', other:'💪' };
  static #TYPE_BADGE = { swim:'badge-swim', bike:'badge-bike', run:'badge-run', brick:'badge-run', other:'' };
  static #SLOT_LABEL = { am:'AM', pm:'PM' };

  #sessions() { return JSON.parse(localStorage.getItem(PerformanceLab.#SESSIONS_KEY) || '{}'); }
  #saveSessions(d) { localStorage.setItem(PerformanceLab.#SESSIONS_KEY, JSON.stringify(d)); }
  #counters() { return JSON.parse(localStorage.getItem(PerformanceLab.#COUNTERS_KEY) || '{}'); }
  #saveCounters(d) { localStorage.setItem(PerformanceLab.#COUNTERS_KEY, JSON.stringify(d)); }

  #weekKey(offset = this.#weekOffset) {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() || 7) + 1 + offset * 7);
    const y = d.getFullYear();
    const w = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7);
    return `${y}-W${String(w).padStart(2,'0')}`;
  }

  #weekDates(offset = this.#weekOffset) {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() || 7) + 1 + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  render() {
    this.#renderWeek();
    this.#renderRings();
    this.#renderCounters();
    // Week nav label
    const wk = document.getElementById('perfLabWeekNum');
    if (wk) {
      const key = this.#weekKey();
      wk.textContent = key.split('-W')[1];
    }
    const next = document.getElementById('perfLabWeekNavNext');
    if (next) next.toggleAttribute('disabled', this.#weekOffset >= 0);
  }

  #renderWeek() {
    const grid = document.getElementById('perfWeekGrid');
    if (!grid) return;
    const dates = this.#weekDates();
    const sessions = this.#sessions();
    const today = new Date().toISOString().slice(0, 10);

    grid.innerHTML = dates.map((date, i) => {
      const daySessions = sessions[date] || {};
      const isToday = date === today;
      const dateLabel = new Date(date + 'T12:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

      const slotHTML = (slot) => {
        const s = daySessions[slot];
        if (s) {
          return `<div class="plsession" onclick="perfEditSession('${date}','${slot}')">
            <span class="plsession-tag">${PerformanceLab.#SLOT_LABEL[slot]}</span>
            <span class="plsession-icon ${PerformanceLab.#TYPE_BADGE[s.type]||''}">${PerformanceLab.#TYPE_ICON[s.type]||'💪'}</span>
            <span class="plsession-dur">${s.duration ? s.duration+'min' : ''}${s.km ? ' · '+s.km+'km' : ''}</span>
            ${s.note ? `<span class="plsession-note">${s.note}</span>` : ''}
            <button class="plsession-del" onclick="event.stopPropagation();perfDeleteSession('${date}','${slot}')">✕</button>
          </div>`;
        }
        return `<div class="pladd" onclick="perfOpenDialog('${date}','${slot}')">+ ${PerformanceLab.#SLOT_LABEL[slot]}</div>`;
      };

      return `<div class="plday ${isToday ? 'plday-today' : ''}">
        <div class="plday-header">
          <span class="plday-name">${PerformanceLab.#DAYS[i]}</span>
          <span class="plday-date">${dateLabel}</span>
        </div>
        ${slotHTML('am')}
        ${slotHTML('pm')}
      </div>`;
    }).join('');
  }

  #renderRings() {
    const dates = this.#weekDates();
    const sessions = this.#sessions();
    let swimKm = 0, bikeKm = 0, runKm = 0, totalMin = 0;

    dates.forEach(date => {
      const daySessions = sessions[date] || {};
      ['am', 'pm'].forEach(slot => {
        const s = daySessions[slot];
        if (!s) return;
        totalMin += s.duration || 0;
        if (s.type === 'swim') swimKm += s.km || 0;
        if (s.type === 'bike' || s.type === 'brick') bikeKm += s.km || 0;
        if (s.type === 'run') runKm += s.km || 0;
      });
    });

    const circ = 2 * Math.PI * 32;
    const setRing = (id, val, max) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('stroke-dasharray', `${Math.min(1, val / max) * circ} ${circ}`);
    };
    setRing('perfRingSwim', swimKm, 20);
    setRing('perfRingBike', bikeKm, 200);
    setRing('perfRingRun', runKm, 50);
    setRing('perfRingVol', totalMin, 600);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('perfSwimVal', swimKm.toFixed(1));
    setText('perfBikeVal', bikeKm.toFixed(0));
    setText('perfRunVal', runKm.toFixed(1));
    setText('perfVolVal', (totalMin / 60).toFixed(1) + 'h');
  }

  #renderCounters() {
    const wk = this.#weekKey(0); // always current week for counters
    const counters = this.#counters();
    const wkData = counters[wk] || { pullups: 0, pushups: 0 };

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('perfPullups', wkData.pullups);
    set('perfPushups', wkData.pushups);
    set('perfPullupsTotal', wkData.pullups);
    set('perfPushupsTotal', wkData.pushups);
  }

  weekNav(delta) {
    this.#weekOffset += delta;
    if (this.#weekOffset > 0) this.#weekOffset = 0;
    this.render();
  }

  clearWeek() {
    const dates = this.#weekDates();
    const sessions = this.#sessions();
    dates.forEach(d => delete sessions[d]);
    this.#saveSessions(sessions);
    this.render();
  }

  openDialog(date, slot) {
    const dlg = document.getElementById('perfSessionDialog');
    if (!dlg) return;
    document.getElementById('pdDate').value = date;
    document.getElementById('pdSlot').value = slot;
    document.getElementById('pdType').value = 'run';
    document.getElementById('pdDuration').value = '';
    document.getElementById('pdKm').value = '';
    document.getElementById('pdNote').value = '';
    document.getElementById('perfDialogTitle').textContent =
      `Einheit — ${new Date(date+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'short'})} (${slot.toUpperCase()})`;
    dlg.showModal();
  }

  editSession(date, slot) {
    const sessions = this.#sessions();
    const s = sessions[date]?.[slot];
    if (!s) return;
    const dlg = document.getElementById('perfSessionDialog');
    document.getElementById('pdDate').value = date;
    document.getElementById('pdSlot').value = slot;
    document.getElementById('pdType').value = s.type || 'run';
    document.getElementById('pdDuration').value = s.duration || '';
    document.getElementById('pdKm').value = s.km || '';
    document.getElementById('pdNote').value = s.note || '';
    document.getElementById('perfDialogTitle').textContent =
      `Einheit bearbeiten — ${slot.toUpperCase()}`;
    dlg.showModal();
  }

  saveSession() {
    const date = document.getElementById('pdDate').value;
    const slot = document.getElementById('pdSlot').value;
    const type = document.getElementById('pdType').value;
    const duration = parseFloat(document.getElementById('pdDuration').value) || null;
    const km = parseFloat(document.getElementById('pdKm').value) || null;
    const note = document.getElementById('pdNote').value.trim();

    const sessions = this.#sessions();
    if (!sessions[date]) sessions[date] = {};
    sessions[date][slot] = { type, duration, km, note };
    this.#saveSessions(sessions);
    this.render();
  }

  deleteSession(date, slot) {
    const sessions = this.#sessions();
    if (sessions[date]) {
      delete sessions[date][slot];
      if (!sessions[date].am && !sessions[date].pm) delete sessions[date];
    }
    this.#saveSessions(sessions);
    this.render();
  }

  counter(type, delta) {
    const wk = this.#weekKey(0);
    const counters = this.#counters();
    if (!counters[wk]) counters[wk] = { pullups: 0, pushups: 0 };
    counters[wk][type] = Math.max(0, (counters[wk][type] || 0) + delta);
    this.#saveCounters(counters);
    this.#renderCounters();
  }
}
