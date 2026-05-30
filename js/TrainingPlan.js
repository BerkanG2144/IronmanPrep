class TrainingPlan {
  #store;
  #stravaSvc;
  #healthSvc;
  #plan = null;
  #loading = false;
  #errorMsg = null;
  static #CACHE_KEY = 'ai_training_plan';
  static #API_KEY_KEY = 'anthropic_api_key';

  constructor(store, stravaSvc, healthSvc) {
    this.#store     = store;
    this.#stravaSvc = stravaSvc;
    this.#healthSvc = healthSvc;
    const cached = localStorage.getItem(TrainingPlan.#CACHE_KEY);
    if (cached) {
      try { this.#plan = JSON.parse(cached); } catch (_) {}
    }
  }

  getApiKey() { return localStorage.getItem(TrainingPlan.#API_KEY_KEY); }
  saveApiKey(k) { localStorage.setItem(TrainingPlan.#API_KEY_KEY, k.trim()); }
  isConfigured() { return !!this.getApiKey(); }

  render() {
    const container = document.getElementById('aiPlanContainer');
    if (!container) return;

    if (!this.isConfigured()) {
      container.innerHTML = this.#setupHTML();
      return;
    }
    if (this.#loading) {
      container.innerHTML = `<div class="ai-plan-loading"><div class="strava-spinner"></div><p>KI erstellt deinen Plan…</p></div>`;
      return;
    }
    if (this.#errorMsg) {
      container.innerHTML = this.#emptyHTML() + `<div class="strava-error" style="margin-top:10px">Fehler: ${this.#errorMsg}</div>`;
      this.#errorMsg = null;
      return;
    }
    if (!this.#plan) {
      container.innerHTML = this.#emptyHTML();
      return;
    }
    container.innerHTML = this.#planHTML();
  }

  async generate(stravaActivities, healthData) {
    if (this.#loading) return;
    this.#loading = true;
    this.render();

    const apiKey = this.getApiKey();
    const now    = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const dayNames = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const todayName = dayNames[now.getDay()];

    // Recent 14 days of Strava
    const recentActs = (stravaActivities || []).slice(0, 20).map(a => {
      const dist = a.distance ? ` ${(a.distance/1000).toFixed(1)}km` : '';
      const dur  = a.moving_time ? ` ${Math.round(a.moving_time/60)}min` : '';
      const hr   = a.average_heartrate ? ` ØHR ${Math.round(a.average_heartrate)}bpm` : '';
      const watt = a.average_watts ? ` ${Math.round(a.average_watts)}W` : '';
      return `- ${a.start_date_local?.split('T')[0]} ${a.type}: ${a.name}${dist}${dur}${hr}${watt}`;
    }).join('\n');

    const health = healthData ? `
HRV: ${healthData.hrv || '?'} ms
Ruhepuls: ${healthData.restingHR || '?'} bpm
VO2max: ${healthData.vo2max || '?'}
Schlaf gesamt: ${healthData.sleep || '?'} h
REM: ${healthData.rem || '?'} h
Tiefschlaf: ${healthData.deep || '?'} h
Befinden: ${healthData.wellbeing || '?'}/5` : 'Keine Health-Daten';

    const prompt = `Du bist ein Triathlon-Coach. Erstelle einen Trainingsplan für die nächsten 7 Tage für Berkan.

ATHLET: Berkan, Ironman 70.3 Antalya (1. Nov 2026), Ziel: Sub 5:30
HEUTE: ${todayStr} (${todayName})

GESUNDHEIT HEUTE MORGEN:
${health}

LETZTE AKTIVITÄTEN (Strava):
${recentActs}

AUFGABE: Erstelle einen 7-Tage-Plan ab morgen. Berücksichtige:
- Erholungszustand (HRV, Schlaf, Befinden)
- Bisherige Belastung dieser Woche
- Polarisiertes Training (Zone 2 Basis + gezielte Intensität)
- Ironman 70.3 Vorbereitung

Antworte NUR mit einem JSON-Array, kein Text davor/danach:
[
  {
    "day": "Montag",
    "date": "2026-05-31",
    "type": "run|bike|swim|rest|brick",
    "title": "Zone 2 Lauf",
    "duration": "60 min",
    "details": "HR 130-145 bpm, lockeres Tempo, Bauchatmung",
    "intensity": "z2|z3|intervals|race|rest"
  }
]`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('Leere Antwort von Groq.');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Kein JSON gefunden');
      this.#plan = JSON.parse(jsonMatch[0]);
      this.#plan._generated = new Date().toISOString();
      localStorage.setItem(TrainingPlan.#CACHE_KEY, JSON.stringify(this.#plan));
    } catch (e) {
      this.#errorMsg = e.message || 'Unbekannter Fehler';
    }

    this.#loading = false;
    this.render();
  }

  #setupHTML() {
    return `<div class="ai-plan-setup">
      <div class="ai-plan-setup-icon">🤖</div>
      <p>Anthropic API Key eingeben für KI-Trainingsplan</p>
      <div class="health-token-row">
        <input id="aiApiKeyInput" type="password" placeholder="AIza…" />
        <button onclick="aiPlanSaveKey()">Speichern</button>
      </div>
    </div>`;
  }

  #emptyHTML() {
    return `<div class="ai-plan-empty">
      <div class="ai-plan-setup-icon">🤖</div>
      <p>KI analysiert dein Training und erstellt einen personalisierten Plan</p>
      <div class="health-token-row" style="width:100%;max-width:420px">
        <input id="aiApiKeyInput" type="password" placeholder="OpenRouter API Key (sk-or-…)" value="${this.getApiKey() || ''}" />
        <button onclick="aiPlanSaveKey()">Speichern</button>
      </div>
      <button class="ai-plan-btn" onclick="aiPlanGenerate()">Plan generieren →</button>
    </div>`;
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
        <button class="btn-strava-refresh" onclick="aiPlanGenerate()">↻ Neu</button>
        <button class="btn-strava-refresh" onclick="aiPlanShowKeyInput()">🔑 Key</button>
      </div>
      <div id="aiKeyInputRow" style="display:none; margin-bottom:12px;" class="health-token-row">
        <input id="aiApiKeyInput" type="password" placeholder="AIza…" />
        <button onclick="aiPlanSaveKey()">Speichern</button>
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
