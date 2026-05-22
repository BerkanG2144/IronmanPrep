class Store {
  #activities;

  constructor() {
    this.#activities = JSON.parse(localStorage.getItem('activities') || '[]');
  }

  add(activity) {
    this.#activities.push(activity);
    localStorage.setItem('activities', JSON.stringify(this.#activities));
  }

  getAll()   { return this.#activities; }
  getLast(n) { return this.#activities.slice(-n); }
}
