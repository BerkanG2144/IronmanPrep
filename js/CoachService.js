class CoachService {
  #store;
  #stravaActivities = [];
  #chatHistory = [];
  #SYSTEM = `Du bist ein erfahrener Triathlon-Coach. Dein Athlet ist Berkan, ambitionierter Amateur-Triathlet, Ironman 70.3 (Antalya, 1. November 2026).

ZIELE: A-Ziel Sub 5:30, B-Ziel Sub 6:00.

KONTEXT:
- Smart Trainer Van Rysel D100 (ERG-fähig) für strukturiertes Radtraining
- Schwimmen ist relative Stärke
- Kein Powermeter am Straßenrad
- Trainiert regelmäßig auf Zwift (VirtualRide)

TRAININGS-PHILOSOPHIE:
- Polarisiertes Training: echte Zone 2 (Basis), keine Grauzone
- 4 Blöcke: Base1 → Base2/Volumen → Build → Taper
- Zone 2 auf dem Trainer: wattbasiert. Laufen/Schwimmen: HR-basiert

DEIN JOB:
- Sprich Berkan direkt an, locker und motivierend
- Stütze dich auf seine echten Strava-Daten (Distanz, Zeit, HR, Watt)
- Erkenne Muster: Überbelastung, Fortschritt, Zonentreue
- Erkläre kurz das "Warum" hinter Entscheidungen
- Plane die nächsten 1-3 Tage konkret
- Antworte auf Deutsch, max 200 Wörter, direkt und coachend`;

  constructor(store) {
    this.#store = store;
  }

  #healthData = null;

  setStravaActivities(activities) {
    this.#stravaActivities = activities || [];
  }

  setHealthData(data) {
    this.#healthData = data;
  }

  #buildContext() {
    let ctx = '';

    // Recent Strava activities (last 10)
    const recent = this.#stravaActivities.slice(0, 10);
    if (recent.length) {
      ctx += '\n\nSTRAVA — LETZTE EINHEITEN:\n';
      recent.forEach(a => {
        const dist = a.distance ? ` ${(a.distance/1000).toFixed(1)}km` : '';
        const dur  = a.moving_time ? ` ${Math.round(a.moving_time/60)}min` : '';
        const hr   = a.average_heartrate ? ` ØHR ${Math.round(a.average_heartrate)}bpm` : '';
        const watt = a.average_watts ? ` ØWatt ${Math.round(a.average_watts)}W` : '';
        const pace = a.type === 'Run' && a.distance && a.moving_time
          ? ` Pace ${Math.floor(a.moving_time/a.distance*1000/60)}:${String(Math.round(a.moving_time/a.distance*1000%60)).padStart(2,'0')}/km` : '';
        const spd  = (a.type === 'Ride' || a.type === 'VirtualRide') && a.average_speed
          ? ` ${(a.average_speed*3.6).toFixed(1)}km/h` : '';
        ctx += `- ${a.start_date_local?.split('T')[0]} ${a.type}: ${a.name}${dist}${dur}${hr}${watt}${pace}${spd}\n`;
      });
    }

    // This week summary
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
    monday.setHours(0,0,0,0);
    const mondayStr = monday.toISOString().split('T')[0];
    const weekActs  = this.#stravaActivities.filter(a => (a.start_date_local || '') >= mondayStr);
    if (weekActs.length) {
      const totalH = (weekActs.reduce((s,a) => s + (a.moving_time||0), 0) / 3600).toFixed(1);
      const runKm  = weekActs.filter(a => a.type==='Run').reduce((s,a) => s+(a.distance||0)/1000, 0).toFixed(1);
      const bikeKm = weekActs.filter(a => a.type==='Ride'||a.type==='VirtualRide').reduce((s,a) => s+(a.distance||0)/1000, 0).toFixed(1);
      const swimKm = weekActs.filter(a => a.type==='Swim').reduce((s,a) => s+(a.distance||0)/1000, 0).toFixed(1);
      ctx += `\nDIESE WOCHE: ${weekActs.length} Einheiten, ${totalH}h — Laufen ${runKm}km, Rad ${bikeKm}km, Schwimmen ${swimKm}km\n`;
    }

    if (this.#healthData) {
      const h = this.#healthData;
      ctx += `\nGESUNDHEIT (heute morgen):`;
      if (h.hrv)        ctx += ` HRV ${h.hrv}ms`;
      if (h.restingHR)  ctx += ` · Ruhepuls ${h.restingHR}bpm`;
      if (h.vo2max)     ctx += ` · VO2max ${h.vo2max}`;
      if (h.sleep)      ctx += ` · Schlaf ${h.sleep}h`;
      if (h.rem)        ctx += ` (REM ${h.rem}h`;
      if (h.deep)       ctx += ` Tief ${h.deep}h)`;
      if (h.wellbeing)  ctx += ` · Befinden ${h.wellbeing}/5`;
      ctx += '\n';
    }
    return ctx;
  }

  async call(userMsg) {
    this.#chatHistory.push({ role: 'user', content: userMsg });
    const msgs = this.#chatHistory.slice(-12);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: this.#SYSTEM + this.#buildContext(),
          messages: msgs,
        }),
      });
      const d = await r.json();
      const reply = d.content?.find(b => b.type === 'text')?.text || 'Verbindungsfehler.';
      this.#chatHistory.push({ role: 'assistant', content: reply });
      return reply;
    } catch {
      return 'Verbindungsfehler. Bitte nochmal versuchen.';
    }
  }
}
