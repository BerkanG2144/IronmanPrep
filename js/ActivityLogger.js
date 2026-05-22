class ActivityLogger {
  #store;
  #coach;
  #dashboard;
  #app;
  #feelings      = { during: '', after: '', sleep: '' };
  #selectedSport = '';

  constructor(store, coach, dashboard, app) {
    this.#store     = store;
    this.#coach     = coach;
    this.#dashboard = dashboard;
    this.#app       = app;
  }

  selectSport(s) {
    this.#selectedSport = s;
    document.querySelectorAll('.sport-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('sport-' + s)?.classList.add('selected');
  }

  setFeel(type, val) {
    this.#feelings[type] = val;
    const key  = 'feel' + type.charAt(0).toUpperCase() + type.slice(1);
    const grid = document.getElementById(key);
    grid?.querySelectorAll('.feel-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('onclick')?.includes(`'${val}'`));
    });
  }

  async submit() {
    if (!this.#selectedSport) { this.#app.showToast('Bitte Sportart wählen'); return; }
    const dur = parseInt(document.getElementById('fDur').value);
    if (!dur) { this.#app.showToast('Bitte Dauer eingeben'); return; }

    const a = {
      id:    Date.now(),
      sport: this.#selectedSport,
      date:  document.getElementById('fDate').value || new Date().toISOString().split('T')[0],
      type:  document.getElementById('fType').value,
      dur,
      dist:  parseFloat(document.getElementById('fDist').value)  || 0,
      hr:    parseInt(document.getElementById('fHR').value)       || 0,
      maxHR: parseInt(document.getElementById('fMaxHR').value)    || 0,
      watt:  parseInt(document.getElementById('fWatt').value)     || 0,
      feelDuring: this.#feelings.during || 'nicht angegeben',
      feelAfter:  this.#feelings.after  || 'nicht angegeben',
      sleep:      this.#feelings.sleep  || 'nicht angegeben',
      notes: document.getElementById('fNotes').value,
    };

    this.#store.add(a);
    this.#dashboard.update();
    this.#app.showToast('Einheit gespeichert ✓');

    const coachMsg =
      `Ich habe gerade geloggt: ${SPORT_NAMES[a.sport]}, ${a.dur} Minuten` +
      `${a.dist  ? ', ' + a.dist  + ' km'         : ''}` +
      `${a.hr    ? ', ØHR '   + a.hr    + ' bpm'  : ''}` +
      `${a.maxHR ? ', MaxHR ' + a.maxHR + ' bpm'  : ''}` +
      `${a.watt  ? ', Ø '     + a.watt  + ' Watt' : ''}` +
      `. Typ: ${a.type}. Gefühl während: ${a.feelDuring}, danach: ${a.feelAfter}, Schlaf: ${a.sleep}` +
      `${a.notes ? '. Notiz: ' + a.notes : ''}` +
      `. Was sagst du und was empfiehlst du für die nächsten Tage?`;

    this.#app.showPage('coach');
    setTimeout(() => this.#coach.ask(coachMsg), 300);
    this.#reset();
  }

  #reset() {
    this.#feelings      = { during: '', after: '', sleep: '' };
    this.#selectedSport = '';
    document.querySelectorAll('.sport-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.feel-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('fNotes').value = '';
  }
}
