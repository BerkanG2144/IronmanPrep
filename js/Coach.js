class Coach {
  #service;
  #chatUI;
  #busy = false;

  constructor(store) {
    this.#service = new CoachService(store);
    this.#chatUI  = new ChatUI('coachMessages');
  }

  setStravaActivities(acts) {
    this.#service.setStravaActivities(acts);
  }

  setHealthData(data) {
    this.#service.setHealthData(data);
  }

  async send(inputEl) {
    if (this.#busy) return;
    const msg = inputEl.value.trim();
    if (!msg) return;
    inputEl.value = '';
    await this.#dispatch(msg);
  }

  async ask(msg) {
    if (this.#busy) return;
    await this.#dispatch(msg);
  }

  async #dispatch(msg) {
    this.#busy = true;
    this.#chatUI.addMsg(msg, false);
    this.#chatUI.addTyping();
    const reply = await this.#service.call(msg);
    this.#chatUI.removeTyping();
    this.#chatUI.addMsg(reply, true);
    this.#busy = false;
  }
}
