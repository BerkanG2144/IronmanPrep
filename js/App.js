class App {
  #store;
  #coach;
  #dashboard;
  #logger;
  static #PAGES = ['overview', 'log', 'coach', 'progress'];

  constructor() {
    this.#store     = new Store();
    this.#dashboard = new Dashboard(this.#store);
    this.#coach     = new Coach(this.#store);
    this.#logger    = new ActivityLogger(this.#store, this.#coach, this.#dashboard, this);
    this.#bindGlobals();
    this.#init();
  }

  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id)?.classList.add('active');
    document.querySelectorAll('.nav-item')[App.#PAGES.indexOf(id)]?.classList.add('active');
  }

  showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  #bindGlobals() {
    window.showPage    = id     => this.showPage(id);
    window.sendMsg     = ()     => this.#coach.send(document.getElementById('coachInput'));
    window.askCoach    = msg    => { this.showPage('coach'); this.#coach.ask(msg); };
    window.selectSport = s      => this.#logger.selectSport(s);
    window.setFeel     = (t, v) => this.#logger.setFeel(t, v);
    window.submitLog   = ()     => this.#logger.submit();
  }

  #init() {
    document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
    setTimeout(() => { document.getElementById('progressBar').style.width = '4%'; }, 300);
    this.#dashboard.update();
  }
}

new App();
