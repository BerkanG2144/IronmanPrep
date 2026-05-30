class Dashboard {
  #store;
  #stravaActivities = [];
  #weekOffset = 0;

  constructor(store) {
    this.#store = store;
  }

  setStravaActivities(activities) {
    this.#stravaActivities = activities || [];
    this.update();
  }

  setWeekOffset(offset) {
    this.#weekOffset = offset;
    this.update();
  }

  // Merge local + Strava activities into unified format for this week
  #allActivities() {
    const local = this.#store.getAll();

    // Convert Strava activities to local format
    const stravaConverted = this.#stravaActivities.map(a => {
      const typeMap = { Run: 'run', Ride: 'bike', VirtualRide: 'bike', Swim: 'swim' };
      return {
        date: a.start_date_local?.split('T')[0] || '',
        sport: typeMap[a.type] || 'run',
        dur:   Math.round((a.moving_time || 0) / 60),
        dist:  parseFloat(((a.distance || 0) / 1000).toFixed(2)),
        hr:    a.average_heartrate ? Math.round(a.average_heartrate) : 0,
        type:  'Strava',
        notes: a.name || '',
        _strava: true,
      };
    });

    // Deduplicate: skip Strava entries that match a local entry on same date+sport
    const localKeys = new Set(local.map(a => `${a.date}_${a.sport}`));
    const filtered  = stravaConverted.filter(a => !localKeys.has(`${a.date}_${a.sport}`));

    return [...local, ...filtered];
  }

  update() {
    this.#updateStats();
    this.#updateWeekRow();
    this.#updateActivityLists();
    this.#updateRings();
  }

  #localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  #weekMonday() {
    const now    = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() || 7) + 1 + this.#weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  #updateStats() {
    const now       = new Date();
    const monday    = this.#weekMonday();
    const sunday    = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const mondayStr = this.#localDateStr(monday);
    // For past weeks show full week; for current week only up to today
    const isCurrentWeek = this.#weekOffset === 0;
    const todayStr  = isCurrentWeek ? this.#localDateStr(now) : this.#localDateStr(sunday);

    const days = Math.max(0, Math.ceil((new Date('2026-11-01') - now) / 86400000));
    document.getElementById('statDays').textContent = days;

    // Use Strava activities this week for stats
    const ENDURANCE = new Set(['Run','Ride','VirtualRide','Swim','Walk','Hike']);
    const weekActs  = this.#stravaActivities.filter(a => {
      const d = a.start_date_local?.split('T')[0] || '';
      return d >= mondayStr && d <= todayStr;
    });

    const totalMins = weekActs.reduce((s, a) => s + Math.round((a.moving_time || 0) / 60), 0);
    document.getElementById('statVolume').innerHTML   = (totalMins / 60).toFixed(1) + '<span class="stat-unit">h</span>';
    document.getElementById('statSessions').innerHTML = weekActs.length + '<span class="stat-unit"> Einh.</span>';

    const withHR = weekActs.filter(a => a.average_heartrate > 0);
    const avgHR  = withHR.length ? Math.round(withHR.reduce((s, a) => s + a.average_heartrate, 0) / withHR.length) : null;
    document.getElementById('statHR').innerHTML = (avgHR || '—') + '<span class="stat-unit">bpm</span>';

    const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    document.getElementById('weekDateRange').textContent = `${fmt(monday)} – ${fmt(sunday)}${isCurrentWeek ? ' · Aktuelle Woche' : ''}`;
    document.getElementById('weekNum').textContent = this.#isoWeekNumber(monday);
  }

  #isoWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  #updateWeekRow() {
    const now      = new Date();
    const todayStr = this.#localDateStr(now);
    const monday   = this.#weekMonday();

    // Build date strings for Mon–Sun using local time (no UTC shift)
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return this.#localDateStr(d);
    });

    const DAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
    const SPORT_ICONS_S = { Run: '🏃', Ride: '🚴', VirtualRide: '🚴', Swim: '🏊', Walk: '🚶', WeightTraining: '🏋️', Workout: '💪' };
    const BADGE_S = { Run: 'badge-run', Ride: 'badge-bike', VirtualRide: 'badge-bike', Swim: 'badge-swim' };

    // Group Strava activities by date
    const byDate = {};
    this.#stravaActivities.forEach(a => {
      const d = a.start_date_local?.split('T')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(a);
    });

    document.getElementById('weekRow').innerHTML = weekDates.map((dateStr, i) => {
      const isToday  = dateStr === todayStr;
      const isPast   = dateStr <= todayStr;
      const acts     = byDate[dateStr] || [];
      const fmt      = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

      const actsHTML = acts.map(a => {
        const icon  = SPORT_ICONS_S[a.type] || '🏅';
        const badge = BADGE_S[a.type] || 'badge-run';
        const dist  = a.distance > 0 ? (a.distance / 1000).toFixed(1) + ' km' : '';
        const dur   = a.moving_time ? Math.round(a.moving_time / 60) + ' min' : '';
        const hr    = a.average_heartrate ? Math.round(a.average_heartrate) + ' bpm' : '';
        const line2 = [dist, dur, hr].filter(Boolean).join(' · ');
        return `<div class="wb-act">
          <div class="wb-act-icon ${badge}">${icon}</div>
          <div class="wb-act-info">
            <div class="wb-act-name">${a.name}</div>
            ${line2 ? `<div class="wb-act-meta">${line2}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      return `<div class="wb-day ${isToday ? 'wb-today' : ''} ${!isPast ? 'wb-future' : ''} ${isPast && acts.length === 0 ? 'wb-empty-past' : ''}">
        <div class="wb-day-header">
          <span class="wb-day-label">${DAY_LABELS[i]}</span>
          <span class="wb-day-date">${fmt}</span>
        </div>
        <div class="wb-acts">
          ${actsHTML || (isPast ? '<div class="wb-rest">—</div>' : '')}
        </div>
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
    const now       = new Date();
    const monday    = this.#weekMonday();
    const sunday    = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const mondayStr = this.#localDateStr(monday);
    const todayStr  = this.#weekOffset === 0 ? this.#localDateStr(now) : this.#localDateStr(sunday);

    const weekActs = this.#stravaActivities.filter(a => {
      const d = a.start_date_local?.split('T')[0] || '';
      return d >= mondayStr && d <= todayStr;
    });

    const swimKm = weekActs.filter(a => a.type === 'Swim').reduce((s, a) => s + (a.distance || 0) / 1000, 0);
    const bikeKm = weekActs.filter(a => a.type === 'Ride' || a.type === 'VirtualRide').reduce((s, a) => s + (a.distance || 0) / 1000, 0);
    const runKm  = weekActs.filter(a => a.type === 'Run').reduce((s, a) => s + (a.distance || 0) / 1000, 0);
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
