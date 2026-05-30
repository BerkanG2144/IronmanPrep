class App {
  #store;
  #coach;
  #dashboard;
  #stravaSvc;
  #stravaUI;
  #healthSvc;
  #trainingPlan;
  #stravaActivities = [];
  #weekOffset = 0;
  static #PAGES = ['overview', 'coach', 'health', 'strava'];

  constructor() {
    this.#store     = new Store();
    this.#dashboard = new Dashboard(this.#store);
    this.#coach     = new Coach(this.#store);
    this.#healthSvc   = new HealthService();
    this.#stravaSvc   = new StravaService();
    this.#trainingPlan = new TrainingPlan(this.#store, this.#stravaSvc, this.#healthSvc);
    this.#stravaUI    = new StravaUI(this.#stravaSvc, acts => {
      this.#stravaActivities = acts;
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
    window.aiPlanSaveModel  = () => {
      const m = document.getElementById('aiModelInput')?.value;
      if (!m) return;
      this.#trainingPlan.saveModel(m);
      this.showToast('Modell gespeichert: ' + m);
    };
    window.aiPlanShowKeyInput = () => {
      const row = document.getElementById('aiKeyInputRow');
      if (row) row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    };
    window.aiPlanSaveKey    = () => {
      const k = document.getElementById('aiApiKeyInput')?.value?.trim();
      if (!k) return;
      this.#trainingPlan.saveApiKey(k);
      const row = document.getElementById('aiKeyInputRow');
      if (row) row.style.display = 'none';
      this.showToast('API Key gespeichert ✓');
    };
    window.setWellbeing = v => {
      document.getElementById('hf-wellbeing').value = v;
      document.querySelectorAll('.wb-btn').forEach((b, i) => {
        b.classList.toggle('wb-btn-active', i + 1 === v);
      });
    };
    window.aiPlanGenerate   = async () => {
      // Auto-save key/model from visible inputs before generating
      const keyInput   = document.getElementById('aiApiKeyInput');
      const modelInput = document.getElementById('aiModelInput');
      if (keyInput?.value?.trim())   this.#trainingPlan.saveApiKey(keyInput.value);
      if (modelInput?.value?.trim()) this.#trainingPlan.saveModel(modelInput.value);
      if (!this.#trainingPlan.isConfigured()) {
        this.showToast('Bitte zuerst einen OpenRouter API Key eingeben.');
        return;
      }
      const health = await this.#healthSvc.fetchMetrics().catch(() => null);
      await this.#trainingPlan.generate(this.#stravaActivities, health);
    };
    window.healthSaveToken  = () => {
      const t = document.getElementById('healthTokenInput')?.value;
      if (!t) return;
      this.#healthSvc.saveToken(t);
      document.getElementById('healthSetupBanner').style.display = 'none';
      this.#loadHealth();
    };
    window.healthSave = async () => {
      const get = id => {
        const v = parseFloat(document.getElementById(id)?.value);
        return isNaN(v) ? null : v;
      };
      const wb = parseInt(document.getElementById('hf-wellbeing')?.value);
      const data = {
        sleep:     get('hf-sleep'),
        rem:       get('hf-rem'),
        core:      get('hf-core'),
        deep:      get('hf-deep'),
        awake:     get('hf-awake'),
        hrv:       get('hf-hrv'),
        restingHR: get('hf-rhr'),
        vo2max:    get('hf-vo2'),
        wellbeing: isNaN(wb) ? null : wb,
      };
      try {
        await this.#healthSvc.updateMetrics(data);
        this.#renderHealth(data);
        this.#coach.setHealthData(data);
        this.showToast('Gesundheitsdaten gespeichert ✓');
      } catch (e) {
        this.showToast('Fehler beim Speichern');
      }
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
    this.#trainingPlan.render();

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
      const b = document.getElementById('healthSetupBanner');
      if (b) b.style.display = 'block';
      return;
    }
    try {
      const d = await this.#healthSvc.fetchMetrics();
      this.#renderHealth(d);
      this.#coach.setHealthData(d);
      // Pre-fill form with last values
      const fields = { sleep:'hf-sleep', rem:'hf-rem', core:'hf-core', deep:'hf-deep', awake:'hf-awake', hrv:'hf-hrv', restingHR:'hf-rhr', vo2max:'hf-vo2' };
      Object.entries(fields).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el && d[k] != null) el.value = d[k];
      });
    } catch (_) {}
  }

  #renderHealth(d) {
    const set = (id, val, dec = 0) => {
      const el = document.getElementById(id);
      if (!el) return;
      const num = el.querySelector('.health-card-value') || el;
      const unit = el.querySelector('.health-unit');
      const unitText = unit ? unit.outerHTML : '';
      if (val != null) num.innerHTML = (dec ? val.toFixed(dec) : val) + unitText;
    };
    const setEl = (id, val, dec = 0) => {
      const el = document.getElementById(id);
      if (!el) return;
      const unitEl = el.querySelector('.health-unit');
      const unitHTML = unitEl ? unitEl.outerHTML : '';
      el.innerHTML = val != null ? (dec ? Number(val).toFixed(dec) : val) + unitHTML : '—' + unitHTML;
    };
    setEl('hvHRV',   d.hrv,       0);
    setEl('hvRHR',   d.restingHR, 0);
    setEl('hvVO2',   d.vo2max,    1);
    setEl('hvSleep', d.sleep,     1);
    setEl('hvREM',   d.rem,       1);
    setEl('hvCore',  d.core,      1);
    setEl('hvDeep',  d.deep,      1);
    setEl('hvAwake', d.awake,     0);
    if (d.updated && d.updated !== 'nie') {
      const dt = new Date(d.updated).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const sub = document.getElementById('healthUpdated');
      if (sub) sub.textContent = `Zuletzt aktualisiert: ${dt}`;
    }
  }
}

new App();
