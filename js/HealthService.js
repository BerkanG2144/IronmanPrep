class HealthService {
  static #GIST_ID  = '136cd353a241c3ef98ced71a54ea8b28';
  static #FILENAME = 'health.json';
  static #TOKEN_KEY = 'gh_health_token';

  saveToken(token) {
    localStorage.setItem(HealthService.#TOKEN_KEY, token.trim());
  }

  getToken() {
    return localStorage.getItem(HealthService.#TOKEN_KEY);
  }

  isConfigured() {
    return !!this.getToken();
  }

  async fetchMetrics() {
    // Use raw gist URL — no token needed for private gist via API with token
    const token = this.getToken();
    const headers = token ? { Authorization: `token ${token}` } : {};
    const res = await fetch(
      `https://api.github.com/gists/${HealthService.#GIST_ID}`,
      { headers }
    );
    if (!res.ok) throw new Error('Gist nicht erreichbar');
    const gist = await res.json();
    const content = gist.files[HealthService.#FILENAME]?.content;
    if (!content) throw new Error('health.json nicht gefunden');
    return JSON.parse(content);
  }

  async updateMetrics(data) {
    const token = this.getToken();
    if (!token) throw new Error('Kein Token gespeichert');
    const res = await fetch(`https://api.github.com/gists/${HealthService.#GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [HealthService.#FILENAME]: {
            content: JSON.stringify({ ...data, updated: new Date().toISOString() }),
          },
        },
      }),
    });
    if (!res.ok) throw new Error('Update fehlgeschlagen');
    return res.json();
  }

  static get GIST_ID() { return HealthService.#GIST_ID; }
}
