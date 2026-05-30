class StravaService {
  static #AUTH_URL    = 'https://www.strava.com/oauth/authorize';
  static #TOKEN_URL   = 'https://www.strava.com/oauth/token';
  static #API_BASE    = 'https://www.strava.com/api/v3';
  static #SCOPE       = 'activity:read_all';
  static #STORE_KEY   = 'strava_token';
  static #CONFIG_KEY  = 'strava_config';

  #token = null;
  #config = null;

  constructor() {
    this.#token  = JSON.parse(localStorage.getItem(StravaService.#STORE_KEY)  || 'null');
    this.#config = JSON.parse(localStorage.getItem(StravaService.#CONFIG_KEY) || 'null');
  }

  isConnected() {
    return !!this.#token?.access_token;
  }

  isConfigured() {
    return !!(this.#config?.clientId && this.#config?.clientSecret);
  }

  saveConfig(clientId, clientSecret) {
    this.#config = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
    localStorage.setItem(StravaService.#CONFIG_KEY, JSON.stringify(this.#config));
  }

  connect() {
    if (!this.isConfigured()) throw new Error('Strava nicht konfiguriert');
    const redirect = this.#redirectUri();
    const url = `${StravaService.#AUTH_URL}?client_id=${this.#config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${StravaService.#SCOPE}&approval_prompt=auto`;
    window.location.href = url;
  }

  async handleCallback(code) {
    const res = await fetch(StravaService.#TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     this.#config.clientId,
        client_secret: this.#config.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error('Token-Austausch fehlgeschlagen');
    this.#token = await res.json();
    localStorage.setItem(StravaService.#STORE_KEY, JSON.stringify(this.#token));
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  async #refreshIfNeeded() {
    if (!this.#token) return;
    const expired = this.#token.expires_at < Math.floor(Date.now() / 1000) + 60;
    if (!expired) return;
    const res = await fetch(StravaService.#TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     this.#config.clientId,
        client_secret: this.#config.clientSecret,
        grant_type:    'refresh_token',
        refresh_token: this.#token.refresh_token,
      }),
    });
    if (!res.ok) { this.disconnect(); throw new Error('Token-Refresh fehlgeschlagen'); }
    this.#token = { ...this.#token, ...await res.json() };
    localStorage.setItem(StravaService.#STORE_KEY, JSON.stringify(this.#token));
  }

  async #get(path, params = {}) {
    await this.#refreshIfNeeded();
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${StravaService.#API_BASE}${path}${qs ? '?' + qs : ''}`, {
      headers: { Authorization: `Bearer ${this.#token.access_token}` },
    });
    if (!res.ok) throw new Error(`Strava API Fehler: ${res.status}`);
    return res.json();
  }

  async getAthlete() {
    return this.#get('/athlete');
  }

  async getActivities({ page = 1, perPage = 30, after = null } = {}) {
    const params = { page, per_page: perPage };
    if (after) params.after = Math.floor(new Date(after).getTime() / 1000);
    return this.#get('/athlete/activities', params);
  }

  async getStats(athleteId) {
    return this.#get(`/athletes/${athleteId}/stats`);
  }

  disconnect() {
    this.#token = null;
    localStorage.removeItem(StravaService.#STORE_KEY);
  }

  getAthleteInfo() {
    return this.#token?.athlete || null;
  }

  #redirectUri() {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}${loc.pathname}`;
  }
}
