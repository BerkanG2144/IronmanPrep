class Store {
  #activities;
  #healthSvc = null;

  constructor() {
    this.#activities = JSON.parse(localStorage.getItem('activities') || '[]');
  }

  setHealthService(svc) { this.#healthSvc = svc; }

  add(activity) {
    this.#activities.push(activity);
    localStorage.setItem('activities', JSON.stringify(this.#activities));
    this.#healthSvc?.syncActivities(this.#activities);
  }

  getAll()   { return this.#activities; }
  getLast(n) { return this.#activities.slice(-n); }
}
