class Trends {
  #healthSvc;
  #stravaActivities = [];
  #charts = {};

  constructor(healthSvc) {
    this.#healthSvc = healthSvc;
  }

  setStravaActivities(acts) { this.#stravaActivities = acts || []; }

  async render() {
    let history = [];
    try {
      const gist = await fetch(
        `https://api.github.com/gists/${HealthService.GIST_ID}`,
        { headers: { Authorization: `token ${this.#healthSvc.getToken()}` } }
      ).then(r => r.json());
      const raw = gist.files?.['health_history.json']?.content;
      if (raw) history = JSON.parse(raw);
    } catch (_) {}

    // Also include any local perf_lab data for volume
    document.getElementById('trendsNoData').style.display = history.length < 2 ? '' : 'none';
    document.getElementById('trendsCharts').style.display = history.length < 2 ? 'none' : '';

    if (history.length < 2) return;

    // Sort by date
    history.sort((a, b) => (a.updated || '').localeCompare(b.updated || ''));

    const labels = history.map(e => {
      const d = new Date(e.updated);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    });

    this.#draw('chartHRV',       labels, history.map(e => e.hrv),       '#4A9EFF', false);
    this.#draw('chartRHR',       labels, history.map(e => e.restingHR), '#E8354A', true);
    this.#draw('chartSleep',     labels, history.map(e => e.sleep),     '#3DBA7A', false);
    this.#draw('chartDeep',      labels, history.map(e => e.deep),      '#9B59B6', false);
    this.#draw('chartWellbeing', labels, history.map(e => e.wellbeing), '#F5A623', false);
    this.#drawVolume();
  }

  #draw(canvasId, labels, data, color, invertGood) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.#charts[canvasId]) { this.#charts[canvasId].destroy(); }

    const filtered = data.map(v => v != null ? +v : null);

    this.#charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: filtered,
          borderColor: color,
          backgroundColor: color + '18',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          tension: 0.3,
          fill: true,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }

  #drawVolume() {
    const canvas = document.getElementById('chartVolume');
    if (!canvas) return;
    if (this.#charts['chartVolume']) this.#charts['chartVolume'].destroy();

    // Build weekly volume from Strava
    const weekMap = {};
    this.#stravaActivities.forEach(a => {
      if (!a.start_date_local || !a.moving_time) return;
      const d = new Date(a.start_date_local);
      const monday = new Date(d);
      monday.setDate(d.getDate() - (d.getDay() || 7) + 1);
      const key = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
      weekMap[key] = (weekMap[key] || 0) + a.moving_time / 3600;
    });

    const sorted = Object.entries(weekMap).sort(([a],[b]) => a.localeCompare(b)).slice(-12);
    const labels = sorted.map(([k]) => {
      const d = new Date(k + 'T12:00');
      return `KW ${d.toLocaleDateString('de-DE', { day:'2-digit', month:'short' })}`;
    });
    const data = sorted.map(([,v]) => +v.toFixed(1));

    this.#charts['chartVolume'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: '#3DBA7A88',
          borderColor: '#3DBA7A',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }
}
