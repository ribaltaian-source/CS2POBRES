const weapons = [
  { type: 'FUSIL DE ASALTO', name: 'AR-77 <em>VÍBORA</em>', desc: 'Control estable y daño fiable para dominar cualquier distancia.', stats: [74, 68, 82], color: '#c8ff31' },
  { type: 'SUBFUSIL', name: 'NEXUS-9 <em>RÁFAGA</em>', desc: 'Movilidad extrema y una cadencia implacable para los flancos.', stats: [54, 95, 70], color: '#66e0ff' },
  { type: 'FUSIL DE PRECISIÓN', name: 'HMR <em>SABLE</em>', desc: 'Una herramienta de largo alcance para operadores pacientes.', stats: [96, 34, 91], color: '#ff6b48' }
];
const toast = document.querySelector('#toast');
let toastTimer;
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }

document.querySelectorAll('.map-card').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll('.map-card').forEach(item => item.classList.remove('active'));
  card.classList.add('active'); notify(`MAPA SELECCIONADO // ${card.dataset.map.toUpperCase()}`);
}));
document.querySelectorAll('.weapon-tabs button').forEach(tab => tab.addEventListener('click', () => {
  const weapon = weapons[tab.dataset.weapon];
  document.querySelectorAll('.weapon-tabs button').forEach(item => item.classList.remove('selected'));
  tab.classList.add('selected');
  document.querySelector('#weaponType').textContent = weapon.type;
  document.querySelector('#weaponName').innerHTML = weapon.name;
  document.querySelector('#weaponDesc').textContent = weapon.desc;
  ['damage','rate','control'].forEach((id, index) => document.querySelector(`#${id}`).textContent = weapon.stats[index]);
  document.documentElement.style.setProperty('--lime', weapon.color);
}));
document.querySelector('#playButton').addEventListener('click', () => notify('BUSCANDO PARTIDA // REGIÓN: AUTO'));
document.querySelector('#briefingButton').addEventListener('click', () => document.querySelector('#briefing').scrollIntoView({ behavior: 'smooth' }));
