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

    const recentActs = (activities || []).slice(0, 20).map(a => {
      const dist = a.distance    ? ` ${(a.distance/1000).toFixed(1)}km` : '';
      const dur  = a.moving_time ? ` ${Math.round(a.moving_time/60)}min` : '';
      const hr   = a.average_heartrate ? ` ØHR ${Math.round(a.average_heartrate)}bpm` : '';
      const watt = a.average_watts     ? ` ${Math.round(a.average_watts)}W` : '';
      return `- ${a.start_date_local?.split('T')[0]} ${a.type}: ${a.name}${dist}${dur}${hr}${watt}`;
    }).join('\n');

    const health = healthData ? `HRV: ${healthData.hrv || '?'} ms | Ruhepuls: ${healthData.restingHR || '?'} bpm | VO2max: ${healthData.vo2max || '?'} | Schlaf: ${healthData.sleep || '?'} h (REM ${healthData.rem || '?'} h, Tief ${healthData.deep || '?'} h) | Befinden: ${healthData.wellbeing || '?'}/5`
      : 'Keine Health-Daten verfügbar';

    const prompt = `Du bist ein erfahrener Triathlon-Coach.

ATHLET: Berkan, Ironman 70.3 Antalya (1. November 2026), Ziel: Sub 5:30
HEUTE: ${todayStr} (${todayName})
PHASE: Base 1 — Fokus echte Zone 2, aerobe Basis aufbauen

GESUNDHEITSDATEN (heute morgen):
${health}

LETZTE EINHEITEN AUF STRAVA (chronologisch, neueste zuerst):
${recentActs || 'Keine Strava-Daten verfügbar'}

AUFGABE: Erstelle einen personalisierten 7-Tage-Trainingsplan ab morgen.
Berücksichtige dabei:
- Erholungszustand: HRV, Ruhepuls, Schlafqualität, Befinden
- Tatsächlich absolvierte Einheiten (ob Berkan die letzten Vorschläge umgesetzt hat oder nicht)
- Kumulierte Belastung der letzten 7 Tage
- Polarisiertes Training: echte Zone 2 (HR 125-140) als Basis, max 1-2 intensive Einheiten/Woche
- Ironman 70.3-spezifisch: Schwimmen, Radfahren, Laufen ausgewogen
- Bei niedrigem Befinden (<3) oder niedriger HRV (<50ms): mehr Erholung einplanen

Antworte NUR mit einem JSON-Array ohne Text davor oder danach:
[
  {
    "day": "Montag",
    "date": "YYYY-MM-DD",
    "type": "run|bike|swim|rest|brick",
    "title": "Zone 2 Lauf",
    "duration": "60 min",
    "details": "HR 125-140 bpm, lockeres Tempo, Nasenatmung",
    "intensity": "z2|z3|intervals|race|rest"
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
          max_tokens: 2000,
          temperature: 0.6,
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
    const days = Array.isArray(this.#plan) ? this.#plan : [];
    const TYPE_ICON  = { run: '🏃', bike: '🚴', swim: '🏊', rest: '😴', brick: '🔥' };
    const TYPE_BADGE = { run: 'badge-run', bike: 'badge-bike', swim: 'badge-swim', rest: '', brick: 'badge-run' };
    const INT_COLOR  = { z2: '#3DBA7A', z3: '#F5A623', intervals: '#E8354A', race: '#E8354A', rest: '#555' };

    const gen = this.#plan._generated
      ? new Date(this.#plan._generated).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';

    return `<div class="ai-plan-header">
        <span class="ai-plan-tag">🤖 KI Vorschlag</span>
        <span class="ai-plan-date">${gen}</span>
        <button class="btn-strava-refresh" onclick="aiPlanGenerate()">↻ Neu generieren</button>
      </div>
      <div class="ai-plan-grid">
        ${days.map(d => `
          <div class="ai-day ${d.type === 'rest' ? 'ai-day-rest' : ''}">
            <div class="ai-day-header">
              <span class="wb-day-label">${d.day?.slice(0,2).toUpperCase()}</span>
              <span class="wb-day-date">${d.date ? new Date(d.date+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'short'}) : ''}</span>
            </div>
            <div class="ai-day-body">
              <div class="wb-act">
                <div class="wb-act-icon ${TYPE_BADGE[d.type] || ''}">${TYPE_ICON[d.type] || '🏅'}</div>
                <div class="wb-act-info">
                  <div class="wb-act-name">${d.title}</div>
                  <div class="wb-act-meta" style="color:${INT_COLOR[d.intensity]||'var(--text-secondary)'}">
                    ${d.duration}
                  </div>
                </div>
              </div>
              <div class="ai-day-details">${d.details}</div>
            </div>
          </div>`).join('')}
      </div>`;
  }
}
