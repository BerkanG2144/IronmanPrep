class App {
  #store;
  #coach;
  #dashboard;
  #logger;
  #stravaSvc;
  #stravaUI;
  static #PAGES = ['overview', 'log', 'coach', 'progress', 'strava'];

  constructor() {
    this.#store     = new Store();
    this.#dashboard = new Dashboard(this.#store);
    this.#coach     = new Coach(this.#store);
    this.#logger    = new ActivityLogger(this.#store, this.#coach, this.#dashboard, this);
    this.#stravaSvc = new StravaService();
    this.#stravaUI  = new StravaUI(this.#stravaSvc);
    this.#bindGlobals();
    this.#init();
  }

  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id)?.classList.add('active');
    document.querySelectorAll('.nav-item')[App.#PAGES.indexOf(id)]?.classList.add('active');
    if (id === 'strava') this.#stravaUI.render();
  }

  showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  #bindGlobals() {
    window.showPage        = id     => this.showPage(id);
    window.sendMsg         = ()     => this.#coach.send(document.getElementById('coachInput'));
    window.askCoach        = msg    => { this.showPage('coach'); this.#coach.ask(msg); };
    window.selectSport     = s      => this.#logger.selectSport(s);
    window.setFeel         = (t, v) => this.#logger.setFeel(t, v);
    window.submitLog       = ()     => this.#logger.submit();
    window.stravaConnect   = ()     => {
      const id     = document.getElementById('stravaClientId')?.value;
      const secret = document.getElementById('stravaClientSecret')?.value;
      if (!id || !secret) { alert('Bitte Client ID und Secret eingeben.'); return; }
      this.#stravaSvc.saveConfig(id, secret);
      this.#stravaSvc.connect();
    };
    window.stravaAuthorize  = () => this.#stravaSvc.connect();
    window.stravaDisconnect = () => { this.#stravaSvc.disconnect(); this.#stravaUI.render(); };
    window.stravaReset      = () => {
      localStorage.removeItem('strava_config');
      location.reload();
    };
    window.stravaRefresh    = () => this.#stravaUI.render();
  }

  async #init() {
    document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
    setTimeout(() => { document.getElementById('progressBar').style.width = '4%'; }, 300);
    this.#dashboard.update();

    // Auto-open Strava page if returning from OAuth callback
    if (new URLSearchParams(window.location.search).has('code')) {
      this.showPage('strava');
      return;
    }

    // Auto-load Strava activities into dashboard if connected
    if (this.#stravaSvc.isConnected()) {
      try {
        const acts = await this.#stravaSvc.getActivities({ perPage: 30 });
        this.#dashboard.setStravaActivities(acts);
      } catch (_) {}
    }
  }
}

new App();
