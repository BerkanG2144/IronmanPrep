class HealthService {
  static #GIST_ID   = '136cd353a241c3ef98ced71a54ea8b28';
  static #FILENAME  = 'health.json';
  static #HISTORY   = 'health_history.json';
  static #ACTS_FILE = 'activities.json';
  static #STRAVA    = 'strava_snapshot.json';
  static #TOKEN_KEY = 'gh_health_token';

  saveToken(token) { localStorage.setItem(HealthService.#TOKEN_KEY, token.trim()); }
  getToken()       { return localStorage.getItem(HealthService.#TOKEN_KEY); }
  isConfigured()   { return !!this.getToken(); }

  async #fetchGist() {
    const token = this.getToken();
    const res = await fetch(`https://api.github.com/gists/${HealthService.#GIST_ID}`, {
      headers: token ? { Authorization: `token ${token}` } : {},
    });
    if (!res.ok) throw new Error('Gist nicht erreichbar');
    return res.json();
  }

  async #patchGist(files) {
    const token = this.getToken();
    if (!token) throw new Error('Kein Token gespeichert');
    const res = await fetch(`https://api.github.com/gists/${HealthService.#GIST_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (!res.ok) throw new Error('Update fehlgeschlagen');
    return res.json();
  }

  async fetchMetrics() {
    const gist = await this.#fetchGist();
    const content = gist.files[HealthService.#FILENAME]?.content;
    if (!content) throw new Error('health.json nicht gefunden');
    return JSON.parse(content);
  }

  async updateMetrics(data) {
    const entry = { ...data, updated: new Date().toISOString() };

    // Load existing history to append
    let history = [];
    try {
      const gist = await this.#fetchGist();
      const raw = gist.files[HealthService.#HISTORY]?.content;
      if (raw) history = JSON.parse(raw);
    } catch (_) {}

    // Upsert today's entry (replace if same date exists)
    const today = entry.updated.slice(0, 10);
    history = history.filter(e => (e.updated || '').slice(0, 10) !== today);
    history.push(entry);

    await this.#patchGist({
      [HealthService.#FILENAME]: { content: JSON.stringify(entry) },
      [HealthService.#HISTORY]:  { content: JSON.stringify(history, null, 2) },
    });
  }

  // Save all locally logged activities to Gist
  async syncActivities(activities) {
    if (!this.isConfigured() || !activities?.length) return;
    try {
      await this.#patchGist({
        [HealthService.#ACTS_FILE]: { content: JSON.stringify(activities, null, 2) },
      });
    } catch (_) {}
  }

  // Save latest Strava activities snapshot to Gist
  async syncStrava(activities) {
    if (!this.isConfigured() || !activities?.length) return;
    try {
      const snapshot = {
        synced: new Date().toISOString(),
        count: activities.length,
        activities: activities.map(a => ({
          id: a.id,
          date: a.start_date_local?.slice(0, 10),
          type: a.type,
          name: a.name,
          distance_km: a.distance ? +(a.distance / 1000).toFixed(2) : null,
          duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
          avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          avg_watts: a.average_watts ? Math.round(a.average_watts) : null,
          avg_speed_kmh: a.average_speed ? +(a.average_speed * 3.6).toFixed(1) : null,
          suffer_score: a.suffer_score || null,
        })),
      };
      await this.#patchGist({
        [HealthService.#STRAVA]: { content: JSON.stringify(snapshot, null, 2) },
      });
    } catch (_) {}
  }

  static get GIST_ID() { return HealthService.#GIST_ID; }
}
