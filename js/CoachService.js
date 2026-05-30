class CoachService {
  #store;
  #chatHistory = [];
  #SYSTEM = `Du bist ein erfahrener Triathlon-Coach. Dein Athlet ist Berkan, ambitionierter Amateur-Triathlet, dritter Ironman 70.3 (Antalya, 1. November 2025).

ZIELE: A-Ziel Sub 5:30, B-Ziel Sub 6:00.

KONTEXT:
- Woche 1 von 25, Block: Base 1 (Wochen 1-5)
- Bisher trainiert er im Graubereich ~160 bpm statt echter Zone 2 — das wird jetzt korrigiert
- Smart Trainer Van Rysel D100 (ERG-fähig) für strukturiertes Radtraining
- FTP-Test + HRmax-Test stehen in Woche 2 an
- Schwimmen ist relative Stärke
- Kein Powermeter am Straßenrad

TRAININGS-PHILOSOPHIE:
- Polarisiertes Training: echte Zone 2 (Basis), keine Grauzone
- 4 Blöcke: Base1 → Base2/Volumen (W6-13) → Build (W14-21) → Taper (W22-23)
- Zone 2 auf dem Trainer: wattbasiert. Laufen/Schwimmen: HR-basiert

DEIN JOB:
- Sprich Berkan direkt an, locker und motivierend
- Analysiere geloggte Einheiten (HR-Daten, Gefühl, Erholung)
- Passe Empfehlungen an Müdigkeit und Erholung an
- Erkläre kurz das "Warum" hinter Entscheidungen
- Plane die nächsten 1-3 Tage konkret
- Antworte auf Deutsch, max 150 Wörter, direkt und coachend`;

  constructor(store) {
    this.#store = store;
  }

  #buildContext() {
    const last5 = this.#store.getLast(5);
    if (!last5.length) return '';
    let ctx = '\n\nLETZTE EINHEITEN:\n';
    last5.forEach(a => {
      ctx += `- ${a.date}: ${SPORT_NAMES[a.sport]}, ${a.dur}min`;
      if (a.dist)  ctx += `, ${a.dist}km`;
      if (a.hr)    ctx += `, ØHR ${a.hr}bpm`;
      ctx += `, Gefühl: ${a.feelDuring}/${a.feelAfter}, Schlaf: ${a.sleep || 'n/a'}`;
      if (a.notes) ctx += `, Notiz: ${a.notes}`;
      ctx += '\n';
    });
    return ctx;
  }

  #getApiKey() {
    return localStorage.getItem('openrouter_api_key') || '';
  }

  async call(userMsg) {
    const apiKey = this.#getApiKey();
    if (!apiKey) {
      return 'Kein API-Key gesetzt. Bitte trag deinen OpenRouter-Key in der Sidebar ein.';
    }

    this.#chatHistory.push({ role: 'user', content: userMsg });
    const msgs = this.#chatHistory.slice(-12);

    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Ironman Coach',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: this.#SYSTEM + this.#buildContext() },
            ...msgs,
          ],
        }),
      });
      const d = await r.json();
      if (d.error) {
        return `Fehler: ${d.error.message}`;
      }
      const reply = d.choices?.[0]?.message?.content || 'Verbindungsfehler.';
      this.#chatHistory.push({ role: 'assistant', content: reply });
      return reply;
    } catch {
      return 'Verbindungsfehler. Bitte nochmal versuchen.';
    }
  }
}
