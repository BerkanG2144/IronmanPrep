class StravaUI {
  #svc;
  #container;

  static #SPORT_MAP = {
    Run:         { icon: '🏃', label: 'Laufen',    badge: 'badge-run'  },
    Ride:        { icon: '🚴', label: 'Radfahren', badge: 'badge-bike' },
    Swim:        { icon: '🏊', label: 'Schwimmen', badge: 'badge-swim' },
    VirtualRide: { icon: '🚴', label: 'Zwift',     badge: 'badge-bike' },
    Walk:        { icon: '🚶', label: 'Gehen',     badge: 'badge-run'  },
    Hike:        { icon: '🥾', label: 'Wandern',   badge: 'badge-run'  },
  };

  constructor(stravaService) {
    this.#svc = stravaService;
    this.#container = document.getElementById('page-strava');
  }

  async render() {
    if (!this.#container) return;

    // Check for OAuth callback code in URL
    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const error = params.get('error');

    if (error) {
      window.history.replaceState({}, '', window.location.pathname);
      this.#renderSetup('Zugriff verweigert. Bitte erneut versuchen.');
      return;
    }

    if (code && this.#svc.isConfigured()) {
      this.#renderLoading('Verbinde mit Strava…');
      try {
        await this.#svc.handleCallback(code);
      } catch (e) {
        this.#renderSetup('Verbindung fehlgeschlagen: ' + e.message);
        return;
      }
    }

    if (!this.#svc.isConfigured()) {
      this.#renderSetup();
      return;
    }

    if (!this.#svc.isConnected()) {
      this.#renderConnect();
      return;
    }

    await this.#renderActivities();
  }

  #renderLoading(msg = 'Lade…') {
    this.#container.innerHTML = `<div class="strava-loading"><div class="strava-spinner"></div><p>${msg}</p></div>`;
  }

  #renderSetup(errorMsg = '') {
    const saved = JSON.parse(localStorage.getItem('strava_config') || 'null');
    this.#container.innerHTML = `
      <div class="strava-setup">
        <div class="strava-logo-wrap">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M32 4C16.536 4 4 16.536 4 32s12.536 28 28 28 28-12.536 28-28S47.464 4 32 4z" fill="#FC4C02"/><path d="M26 44l6-12 6 12-6-4-6 4zM20 32l6-12 6 12-6-4-6 4z" fill="white"/></svg>
          <span class="strava-brand">Strava</span>
        </div>
        <h2>Strava verbinden</h2>
        <p class="strava-hint">Erstelle eine App unter <strong>strava.com/settings/api</strong> und trage die Zugangsdaten ein.</p>
        ${errorMsg ? `<div class="strava-error">${errorMsg}</div>` : ''}
        <div class="strava-form">
          <label>Client ID
            <input id="stravaClientId" type="text" placeholder="12345" value="${saved?.clientId || ''}" />
          </label>
          <label>Client Secret
            <input id="stravaClientSecret" type="password" placeholder="abc123…" value="${saved?.clientSecret || ''}" />
          </label>
          <button class="btn-strava-connect" onclick="stravaConnect()">
            Mit Strava verbinden
          </button>
        </div>
        <details class="strava-help">
          <summary>Wie erstelle ich eine Strava-App?</summary>
          <ol>
            <li>Gehe zu strava.com/settings/api</li>
            <li>Erstelle eine neue Applikation</li>
            <li>Bei "Authorization Callback Domain" trage ein: <code>${window.location.hostname || 'localhost'}</code></li>
            <li>Kopiere <strong>Client ID</strong> und <strong>Client Secret</strong> hier rein</li>
          </ol>
        </details>
      </div>`;
  }

  #renderConnect() {
    this.#container.innerHTML = `
      <div class="strava-setup">
        <div class="strava-logo-wrap">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M32 4C16.536 4 4 16.536 4 32s12.536 28 28 28 28-12.536 28-28S47.464 4 32 4z" fill="#FC4C02"/><path d="M26 44l6-12 6 12-6-4-6 4zM20 32l6-12 6 12-6-4-6 4z" fill="white"/></svg>
          <span class="strava-brand">Strava</span>
        </div>
        <h2>Strava autorisieren</h2>
        <p class="strava-hint">Klicke unten um dich bei Strava einzuloggen und den Zugriff zu erlauben.</p>
        <button class="btn-strava-connect" onclick="stravaAuthorize()">
          Bei Strava einloggen
        </button>
        <button class="btn-strava-reset" onclick="stravaReset()">Andere App-Daten verwenden</button>
      </div>`;
  }

  async #renderActivities() {
    this.#renderLoading('Lade Strava-Aktivitäten…');
    try {
      const [activities, athlete] = await Promise.all([
        this.#svc.getActivities({ perPage: 20 }),
        Promise.resolve(this.#svc.getAthleteInfo()),
      ]);
      this.#container.innerHTML = this.#buildActivitiesHTML(activities, athlete);
    } catch (e) {
      this.#container.innerHTML = `<div class="strava-error-page">
        <p>Fehler beim Laden: ${e.message}</p>
        <button class="btn-strava-connect" onclick="stravaRefresh()">Erneut versuchen</button>
        <button class="btn-strava-reset" onclick="stravaDisconnect()">Verbindung trennen</button>
      </div>`;
    }
  }

  #buildActivitiesHTML(activities, athlete) {
    const name = athlete ? `${athlete.firstname} ${athlete.lastname}` : 'Athlet';

    const recentSwim = activities.filter(a => a.type === 'Swim').slice(0, 3);
    const recentBike = activities.filter(a => a.type === 'Ride' || a.type === 'VirtualRide').slice(0, 3);
    const recentRun  = activities.filter(a => a.type === 'Run').slice(0, 3);

    const weekMs   = Date.now() - 7  * 86400000;
    const monthMs  = Date.now() - 30 * 86400000;
    const thisWeek = activities.filter(a => new Date(a.start_date) > weekMs);
    const month    = activities.filter(a => new Date(a.start_date) > monthMs);

    const sumDist = arr => (arr.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1);
    const sumTime = arr => Math.round(arr.reduce((s, a) => s + a.moving_time, 0) / 3600 * 10) / 10;

    return `
      <div class="strava-page">
        <div class="strava-header">
          <div class="strava-avatar">
            ${athlete?.profile_medium ? `<img src="${athlete.profile_medium}" alt="${name}">` : '👤'}
          </div>
          <div>
            <div class="strava-name">${name}</div>
            <div class="strava-sub">Strava verbunden ✓</div>
          </div>
          <button class="btn-strava-reset" onclick="stravaDisconnect()">Trennen</button>
        </div>

        <div class="strava-stats-grid">
          <div class="strava-stat-card">
            <div class="strava-stat-label">Diese Woche</div>
            <div class="strava-stat-value">${thisWeek.length}<span class="strava-stat-unit"> Einh.</span></div>
            <div class="strava-stat-sub">${sumTime(thisWeek)} h · ${sumDist(thisWeek)} km</div>
          </div>
          <div class="strava-stat-card">
            <div class="strava-stat-label">Letzten 30 Tage</div>
            <div class="strava-stat-value">${month.length}<span class="strava-stat-unit"> Einh.</span></div>
            <div class="strava-stat-sub">${sumTime(month)} h · ${sumDist(month)} km</div>
          </div>
        </div>

        <div class="strava-activities-header">
          <h3>Letzte Aktivitäten</h3>
          <button class="btn-strava-refresh" onclick="stravaRefresh()">↻ Aktualisieren</button>
        </div>
        <div class="strava-activity-list">
          ${activities.length ? activities.map(a => this.#activityCard(a)).join('') : '<p class="strava-empty">Keine Aktivitäten gefunden.</p>'}
        </div>
      </div>`;
  }

  #activityCard(a) {
    const sport = StravaUI.#SPORT_MAP[a.type] || { icon: '🏅', label: a.type, badge: 'badge-run' };
    const dist  = a.distance ? (a.distance / 1000).toFixed(2) + ' km' : '';
    const dur   = a.moving_time ? this.#fmtTime(a.moving_time) : '';
    const pace  = a.type === 'Run' && a.distance && a.moving_time
      ? this.#fmtPace(a.moving_time, a.distance) + ' /km'
      : a.type === 'Ride' || a.type === 'VirtualRide'
        ? (a.average_speed * 3.6).toFixed(1) + ' km/h'
        : '';
    const hr    = a.average_heartrate ? Math.round(a.average_heartrate) + ' bpm' : '';
    const date  = new Date(a.start_date_local).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' });
    const elev  = a.total_elevation_gain ? '+' + Math.round(a.total_elevation_gain) + 'm' : '';

    return `<div class="strava-act-row">
      <div class="activity-sport-badge ${sport.badge}">${sport.icon}</div>
      <div class="activity-info">
        <div class="a-name">${a.name}</div>
        <div class="a-meta">${date}${elev ? ' · ' + elev : ''}</div>
      </div>
      <div class="activity-metrics">
        ${dist ? `<div class="a-metric"><div class="val">${dist.split(' ')[0]}</div><div class="lbl">km</div></div>` : ''}
        ${dur  ? `<div class="a-metric"><div class="val">${dur}</div><div class="lbl">Zeit</div></div>` : ''}
        ${hr   ? `<div class="a-metric"><div class="val">${a.average_heartrate ? Math.round(a.average_heartrate) : '—'}</div><div class="lbl">bpm</div></div>` : ''}
        ${pace ? `<div class="a-metric"><div class="val">${pace.split(' ')[0]}</div><div class="lbl">${a.type === 'Run' ? '/km' : 'km/h'}</div></div>` : ''}
      </div>
    </div>`;
  }

  #fmtTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  #fmtPace(secs, dist) {
    const secPerKm = secs / (dist / 1000);
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
