class TrainingPlan {
  #store;
  #stravaSvc;
  #healthSvc;
  #plan = null;
  #loading = false;
  #errorMsg = null;

  static #CACHE_KEY  = 'ai_training_plan';
  static #FINGER_KEY = 'ai_plan_fingerprint';
  static #MODEL      = 'llama-3.3-70b-versatile';
  static #API_URL    = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(store, stravaSvc, healthSvc) {
    this.#store     = store;
    this.#stravaSvc = stravaSvc;
    this.#healthSvc = healthSvc;
    const cached = localStorage.getItem(TrainingPlan.#CACHE_KEY);
    if (cached) {
      try { this.#plan = JSON.parse(cached); } catch (_) {}
    }
  }

  isConfigured() { return !!CoachService.getApiKey(); }

  // Returns true if data changed enough to warrant a new plan
  #fingerprintChanged(activities, healthData) {
    const actSig  = (activities || []).slice(0, 5).map(a => a.id || a.start_date_local).join(',');
    const hlthSig = healthData ? `${healthData.hrv}|${healthData.sleep}|${healthData.wellbeing}|${healthData.updated || ''}` : '';
    const today   = new Date().toISOString().slice(0, 10);
    const newFP   = `${today}::${actSig}::${hlthSig}`;
    const oldFP   = localStorage.getItem(TrainingPlan.#FINGER_KEY) || '';
    return newFP !== oldFP ? newFP : null;
  }

  #saveFingerprint(fp) {
    localStorage.setItem(TrainingPlan.#FINGER_KEY, fp);
  }

  render() {
    const container = document.getElementById('aiPlanContainer');
    if (!container) return;
    if (this.#loading) {
      container.innerHTML = `<div class="ai-plan-loading"><div class="strava-spinner"></div><p>KI analysiert dein Training…</p></div>`;
      return;
    }
    if (this.#errorMsg) {
      const err = this.#errorMsg;
      this.#errorMsg = null;
      container.innerHTML = `<div class="strava-error">Fehler: ${err} <button class="btn-strava-refresh" onclick="aiPlanGenerate()">↻ Retry</button></div>`;
      return;
    }
    if (!this.#plan) {
      container.innerHTML = `<div class="ai-plan-empty"><div class="ai-plan-setup-icon">🤖</div><p>Plan wird generiert…</p></div>`;
      return;
    }
    container.innerHTML = this.#planHTML();
  }

  // Called from outside — checks fingerprint, regenerates if needed
  async maybeGenerate(activities, healthData) {
    if (!this.isConfigured()) { this.render(); return; }
    const newFP = this.#fingerprintChanged(activities, healthData);
    if (!newFP && this.#plan) { this.render(); return; }
    await this.generate(activities, healthData);
    if (newFP) this.#saveFingerprint(newFP);
  }

  async generate(activities, healthData) {
    if (this.#loading) return;
    this.#loading = true;
    this.render();

    const apiKey   = CoachService.getApiKey();
    const now      = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayNames = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const todayName = dayNames[now.getDay()];
    const perf = JSON.parse(localStorage.getItem('perf_profile') || '{}');

    const recentActs = (activities || []).slice(0, 20).map(a => {
      const dist = a.distance    ? ` ${(a.distance/1000).toFixed(1)}km` : '';
      const dur  = a.moving_time ? ` ${Math.round(a.moving_time/60)}min` : '';
      const hr   = a.average_heartrate ? ` ØHR ${Math.round(a.average_heartrate)}bpm` : '';
      const watt = a.average_watts     ? ` ${Math.round(a.average_watts)}W` : '';
      return `- ${a.start_date_local?.split('T')[0]} ${a.type}: ${a.name}${dist}${dur}${hr}${watt}`;
    }).join('\n');

    const health = healthData
      ? `HRV: ${healthData.hrv||'?'}ms | Ruhepuls: ${healthData.restingHR||'?'}bpm | VO2max: ${healthData.vo2max||'?'} | Schlaf: ${healthData.sleep||'?'}h (REM ${healthData.rem||'?'}h, Tief ${healthData.deep||'?'}h) | Befinden: ${healthData.wellbeing||'?'}/5`
      : 'Keine Health-Daten';

    const perfStr = [
      perf.ftp   ? `FTP: ${perf.ftp}W (Zone 2: ${Math.round(perf.ftp*0.56)}-${Math.round(perf.ftp*0.75)}W, Zone 3: ${Math.round(perf.ftp*0.76)}-${Math.round(perf.ftp*0.90)}W)` : 'FTP: unbekannt',
      perf.hrmax ? `HRmax: ${perf.hrmax}bpm (Zone 2: ${Math.round(perf.hrmax*0.65)}-${Math.round(perf.hrmax*0.78)}bpm)` : '',
      perf.hm    ? `HM Bestzeit: ${Math.floor(perf.hm)}:${String(Math.round((perf.hm%1)*60)).padStart(2,'0')} h` : '',
      perf['10k']? `10km Pace: ${perf['10k']} min/km` : '',
      perf.swim  ? `Schwimm-Pace: ${Math.floor(perf.swim/60)}:${String(perf.swim%60).padStart(2,'0')}/100m` : '',
      perf.bike  ? `Rad-Durchschnitt: ${perf.bike} km/h` : '',
    ].filter(Boolean).join('\n');

    const prompt = `Du bist ein professioneller Triathlon-Coach, der Berkan für den Ironman 70.3 Antalya (1. November 2026) vorbereitet.

ATHLET: Berkan
RENNEN: Ironman 70.3 Antalya, 1. November 2026
ZIEL: Sub 5:30 (Schwimmen 1,9km + Rad 90km + Laufen 21,1km)
HEUTE: ${todayStr} (${todayName})
PHASE: Base 1 — aerobe Basis, polarisiertes Training

LEISTUNGSPROFIL:
${perfStr || 'Noch keine Leistungsdaten eingegeben'}

GESUNDHEIT HEUTE MORGEN:
${health}

STRAVA — LETZTE EINHEITEN (neueste zuerst):
${recentActs || 'Keine Strava-Daten'}

TRAININGSPHILOSOPHIE:
- 10-12 Einheiten/Woche, Doppeleinheiten erlaubt (AM + PM)
- 80% Zone 2 / 20% Intensität (polarisiertes Training)
- Wöchentliches Volumen: Schwimmen 15-20km, Rad 150-250km, Laufen 40-60km
- Doppeleinheiten typisch: morgens Schwimmen + abends Laufen/Rad
- Nur echte Ruhetage bei: Befinden ≤2 ODER HRV deutlich unter Baseline
- Jede Einheit mit konkreten km/Distanz und Zielwatt oder -HR angeben

AUFGABE: Erstelle einen 7-Tage-Plan ab morgen mit 10-12 Einheiten.
Bei Doppeleinheiten: zwei separate JSON-Objekte für denselben Tag (gleiches Datum, session "AM" und "PM").

Antworte NUR mit einem JSON-Array, kein Text davor oder danach:
[
  {
    "day": "Montag",
    "date": "YYYY-MM-DD",
    "session": "AM",
    "type": "swim",
    "title": "Schwimmen Technik + Z2",
    "duration": "60 min",
    "distance": "3.0 km",
    "details": "1km Einschwimmen, 8x200m Z2 Pace (2:00/100m), 500m ausschwimmen",
    "intensity": "z2"
  },
  {
    "day": "Montag",
    "date": "YYYY-MM-DD",
    "session": "PM",
    "type": "run",
    "title": "Z2 Lauf",
    "duration": "45 min",
    "distance": "8 km",
    "details": "HR 125-140 bpm, lockeres Tempo, Nasenatmung",
    "intensity": "z2"
  }
]`;

    try {
      const res = await fetch(TrainingPlan.#API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: TrainingPlan.#MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.5,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('Leere Antwort erhalten.');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Kein gültiges JSON erhalten.');
      this.#plan = JSON.parse(jsonMatch[0]);
      this.#plan._generated = new Date().toISOString();
      localStorage.setItem(TrainingPlan.#CACHE_KEY, JSON.stringify(this.#plan));
    } catch (e) {
      this.#errorMsg = e.message || 'Unbekannter Fehler';
    }

    this.#loading = false;
    this.render();
  }

  #planHTML() {
    const allSessions = Array.isArray(this.#plan) ? this.#plan : [];
    const TYPE_ICON  = { run: '🏃', bike: '🚴', swim: '🏊', rest: '😴', brick: '🔥' };
    const TYPE_BADGE = { run: 'badge-run', bike: 'badge-bike', swim: 'badge-swim', rest: '', brick: 'badge-run' };
    const INT_COLOR  = { z2: '#3DBA7A', z3: '#F5A623', intervals: '#E8354A', race: '#E8354A', rest: '#555' };

    // Group by date
    const byDate = {};
    allSessions.forEach(s => {
      const key = s.date || s.day;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(s);
    });

    const gen = this.#plan._generated
      ? new Date(this.#plan._generated).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';

    const daysHTML = Object.entries(byDate).map(([dateKey, sessions]) => {
      const first = sessions[0];
      const isRest = sessions.every(s => s.type === 'rest');
      const dateLabel = first.date
        ? new Date(first.date+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'short'})
        : '';

      const sessionsHTML = sessions.map(s => `
        <div class="wb-act" style="margin-bottom:8px">
          <div class="wb-act-icon ${TYPE_BADGE[s.type]||''}">${TYPE_ICON[s.type]||'🏅'}</div>
          <div class="wb-act-info">
            <div class="wb-act-name">${s.session ? `<span style="font-size:10px;color:var(--text-secondary)">${s.session} · </span>` : ''}${s.title}</div>
            <div class="wb-act-meta" style="color:${INT_COLOR[s.intensity]||'var(--text-secondary)'}">
              ${s.duration}${s.distance ? ` · ${s.distance}` : ''}
            </div>
            <div class="ai-day-details" style="margin-top:4px">${s.details}</div>
          </div>
        </div>`).join('');

      return `<div class="ai-day ${isRest ? 'ai-day-rest' : ''}${sessions.length > 1 ? ' ai-day-double' : ''}">
          <div class="ai-day-header">
            <span class="wb-day-label">${first.day?.slice(0,2).toUpperCase()}</span>
            <span class="wb-day-date">${dateLabel}</span>
            ${sessions.length > 1 ? '<span style="font-size:9px;color:#F5A623;font-weight:700">2x</span>' : ''}
          </div>
          <div class="ai-day-body">${sessionsHTML}</div>
        </div>`;
    }).join('');

    return `<div class="ai-plan-header">
        <span class="ai-plan-tag">🤖 KI Vorschlag</span>
        <span class="ai-plan-date">${gen}</span>
        <button class="btn-strava-refresh" onclick="aiPlanGenerate()">↻ Neu</button>
      </div>
      <div class="ai-plan-grid">${daysHTML}</div>`;
  }
}
