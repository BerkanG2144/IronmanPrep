class App {
  #store;
  #coach;
  #dashboard;
  #stravaSvc;
  #stravaUI;
  #weekOffset = 0;
  static #PAGES = ['overview', 'coach', 'health', 'strava'];

  constructor() {
    this.#store     = new Store();
    this.#dashboard = new Dashboard(this.#store);
    this.#coach     = new Coach(this.#store);
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
    window.weekNav          = delta => {
      this.#weekOffset += delta;
      if (this.#weekOffset > 0) this.#weekOffset = 0;
      this.#dashboard.setWeekOffset(this.#weekOffset);
      document.getElementById('weekNavNext').disabled = this.#weekOffset >= 0;
    };
  }

  async #init() {
    setTimeout(() => { document.getElementById('progressBar').style.width = '4%'; }, 300);
    this.#dashboard.update();

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
}

new App();
