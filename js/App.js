class App {
  #store;
  #coach;
  #dashboard;
  #stravaSvc;
  #stravaUI;
  #healthSvc;
  #weekOffset = 0;
  static #PAGES = ['overview', 'coach', 'health', 'strava'];

  constructor() {
    this.#store     = new Store();
    this.#dashboard = new Dashboard(this.#store);
    this.#coach     = new Coach(this.#store);
    this.#healthSvc = new HealthService();
    this.#stravaSvc = new StravaService();
    this.#stravaUI  = new StravaUI(this.#stravaSvc, acts => {
      this.#dashboard.setStravaActivities(acts);
      this.#coach.setStravaActivities(acts);
    });
    this.#bindGlobals();
    this.#init();
  }

  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id)?.classList.add('active');
    document.querySelectorAll('.nav-item')[App.#PAGES.indexOf(id)]?.classList.add('active');
    if (id === 'strava') this.#stravaUI.render();
    if (id === 'health') this.#loadHealth();
  }

  showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  #bindGlobals() {
    window.showPage        = id  => this.showPage(id);
    window.sendMsg         = ()  => this.#coach.send(document.getElementById('coachInput'));
    window.askCoach        = msg => { this.showPage('coach'); this.#coach.ask(msg); };
    window.stravaConnect   = ()  => {
      const id     = document.getElementById('stravaClientId')?.value;
      const secret = document.getElementById('stravaClientSecret')?.value;
      if (!id || !secret) { alert('Bitte Client ID und Secret eingeben.'); return; }
      this.#stravaSvc.saveConfig(id, secret);
      this.#stravaSvc.connect();
    };
    window.stravaAuthorize  = () => this.#stravaSvc.connect();
    window.stravaDisconnect = () => { this.#stravaSvc.disconnect(); this.#stravaUI.render(); };
    window.stravaReset      = () => { localStorage.removeItem('strava_config'); location.reload(); };
    window.stravaRefresh    = () => this.#stravaUI.render();
    window.healthSaveToken  = () => {
      const t = document.getElementById('healthTokenInput')?.value;
      if (!t) return;
      this.#healthSvc.saveToken(t);
      document.getElementById('healthSetupBanner').style.display = 'none';
      this.#loadHealth();
    };
    window.weekNav          = delta => {
      this.#weekOffset += delta;
      if (this.#weekOffset > 0) this.#weekOffset = 0;
      this.#dashboard.setWeekOffset(this.#weekOffset);
      const nextBtn = document.getElementById('weekNavNext');
      if (this.#weekOffset < 0) nextBtn.removeAttribute('disabled');
      else nextBtn.setAttribute('disabled', '');
    };
  }

  async #init() {
    setTimeout(() => { document.getElementById('progressBar').style.width = '4%'; }, 300);
    this.#dashboard.update();

    this.#loadHealth();

    if (new URLSearchParams(window.location.search).has('code')) {
      this.showPage('strava');
      return;
    }

    if (this.#stravaSvc.isConnected()) {
      try {
        // Fetch enough activities to cover several weeks back
        const acts = await this.#stravaSvc.getActivities({ perPage: 100 });
        this.#dashboard.setStravaActivities(acts);
        this.#coach.setStravaActivities(acts);
      } catch (_) {}
    }
  }

  async #loadHealth() {
    if (!this.#healthSvc.isConfigured()) {
      document.getElementById('healthSetupBanner')?.style && (document.getElementById('healthSetupBanner').style.display = 'block');
      return;
    }
    try {
      const d = await this.#healthSvc.fetchMetrics();
      const set = (id, val, unit = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = val != null ? val + unit : '—';
      };
      set('hvHRV',    d.hrv,       '');
      set('hvVO2',    d.vo2max,    '');
      set('hvRHR',    d.restingHR, '');
      if (d.sleep != null) {
        const h = Math.floor(d.sleep), m = Math.round((d.sleep - h) * 60);
        document.getElementById('hvSleep').textContent = `${h}:${String(m).padStart(2,'0')}`;
      }
      if (d.updated && d.updated !== 'nie') {
        const dt = new Date(d.updated).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const sub = document.getElementById('healthUpdated');
        if (sub) sub.textContent = `Zuletzt aktualisiert: ${dt}`;
      }
    } catch (_) {}
  }
}

new App();
