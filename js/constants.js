const SPORT_NAMES = { swim: 'Schwimmen', bike: 'Radfahren', run: 'Laufen', brick: 'Brick' };
const SPORT_ICONS = { swim: '🏊', bike: '🚴', run: '🏃', brick: '🔥' };
const BADGE_CLASS = { swim: 'badge-swim', bike: 'badge-bike', run: 'badge-run', brick: 'badge-brick' };
const FEEL_EMOJI  = {
  top: '🔥', gut: '😊', mittel: '😐', schlecht: '😓',
  frisch: '💪', ok: '😊', müde: '😴', kaputt: '💀',
  'sehr gut': '🌙', wenig: '⏰',
};

const WEEK_PLAN = [
  { day: 'Mo', type: 'swim', label: 'Schwimmen', icon: '🏊', dur: '45 min' },
  { day: 'Di', type: 'bike', label: 'Rad',        icon: '🚴', dur: '60 min' },
  { day: 'Mi', type: 'run',  label: 'Laufen',     icon: '🏃', dur: '45 min' },
  { day: 'Do', type: 'swim', label: 'Schwimmen', icon: '🏊', dur: '45 min' },
  { day: 'Fr', type: 'rest', label: 'Ruhetag',    icon: '😴', dur: '—'      },
  { day: 'Sa', type: 'bike', label: 'Rad',        icon: '🚴', dur: '90 min' },
  { day: 'So', type: 'run',  label: 'Laufen',     icon: '🏃', dur: '50 min' },
];
