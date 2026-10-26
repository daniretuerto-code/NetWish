// Restaurant questionnaire. Every answer changes something: which panel sections
// exist, how the hall and booking rules are set up, or what customers see.
// Answers live in restaurant_settings.profile.

const yes = (v) => v === true;
const DAYS = [
  { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' }, { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' }, { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' }, { value: 0, label: 'Domingo' },
];

export const RESTAURANT_SECTIONS = [
  {
    key: 'basico',
    title: 'Lo básico',
    intro: 'Tu horario y tus mesas. Con esto tu panel queda montado en 2 minutos.',
    onboarding: true,
    questions: [
      { id: 'servicios', type: 'multi', label: '¿Qué servicios das?', help: 'Las reservas solo se ofrecerán en estos turnos.', options: [
        { value: 'comidas', label: 'Comidas' }, { value: 'cenas', label: 'Cenas' },
      ] },
      { id: 'horario_comidas', type: 'range', label: '¿En qué horario das comidas?', keys: ['lunch_start', 'lunch_end'], defaults: ['13:00', '16:00'], when: (a) => (a.servicios || []).includes('comidas') },
      { id: 'horario_cenas', type: 'range', label: '¿Y las cenas?', keys: ['dinner_start', 'dinner_end'], defaults: ['20:30', '23:30'], when: (a) => (a.servicios || []).includes('cenas') },
      { id: 'cierre', type: 'days', label: '¿Qué días cierras?', help: 'Ese día no se podrá reservar.', options: DAYS },
      { id: 'reservas', type: 'yesno', label: '¿Quieres recibir reservas por NetWish?', help: 'Tus clientes eligen día, hora y personas, y tú confirmas.' },
      { id: 'mesas', type: 'number', label: '¿Cuántas mesas tienes dentro?', min: 0, max: 80, def: 8 },
      { id: 'terraza', type: 'yesno', label: '¿Tienes terraza?' },
      { id: 'mesas_terraza', type: 'number', label: '¿Cuántas mesas en la terraza?', min: 1, max: 60, def: 4, when: (a) => yes(a.terraza) },
      { id: 'plazas', type: 'choice', label: '¿Para cuántas personas es una mesa normal?', help: 'Luego puedes ajustar cada mesa.', options: [
        { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 6, label: '6' },
      ] },
      { id: 'turno', type: 'choice', label: '¿Cuánto suele durar una comida en tu local?', help: 'Así sabemos cuándo vuelve a quedar libre una mesa.', when: (a) => yes(a.reservas), options: [
        { value: 45, label: '45 min' }, { value: 60, label: '1 hora' }, { value: 90, label: '1 h 30 min' }, { value: 120, label: '2 horas' },
      ] },
    ],
  },
  {
    key: 'reservas',
    title: 'Reglas de reserva',
    intro: 'Decide cómo y cuándo te pueden reservar.',
    when: (a) => a.reservas !== false,
    questions: [
      { id: 'auto_confirm', type: 'yesno', label: '¿Confirmamos las reservas al momento cuando hay mesa libre?', help: 'El cliente recibe "confirmada" al instante. Si dices que no, tendrás que confirmar tú cada una.' },
      { id: 'max_personas', type: 'choice', label: '¿Hasta cuántas personas se puede reservar online?', help: 'Para grupos más grandes les pediremos que te llamen.', options: [
        { value: 4, label: '4' }, { value: 6, label: '6' }, { value: 8, label: '8' }, { value: 12, label: '12' }, { value: 20, label: '20' },
      ] },
      { id: 'dias_vista', type: 'choice', label: '¿Con cuánta antelación se puede reservar como mucho?', options: [
        { value: 7, label: '1 semana' }, { value: 14, label: '2 semanas' }, { value: 30, label: '1 mes' }, { value: 60, label: '2 meses' },
      ] },
      { id: 'aviso_min', type: 'choice', label: '¿Y como mínimo, cuánto antes?', options: [
        { value: 30, label: '30 min' }, { value: 60, label: '1 hora' }, { value: 120, label: '2 horas' }, { value: 1440, label: 'El día antes' },
      ] },
      { id: 'grupo_desde', type: 'choice', label: '¿A partir de cuántas personas quieres decidir tú si aceptas la reserva?', help: 'Esas reservas te llegarán como solicitud de grupo para que juntes mesas.', options: [
        { value: 6, label: '6' }, { value: 8, label: '8' }, { value: 10, label: '10' }, { value: 0, label: 'Nunca' },
      ] },
      { id: 'aforo_franja', type: 'choice', label: '¿Cuántas personas puede atender tu cocina cada media hora?', help: 'Así no te entran 40 personas a la vez. Si no te importa, elige "Sin límite".', options: [
        { value: 10, label: '10' }, { value: 20, label: '20' }, { value: 30, label: '30' }, { value: 50, label: '50' }, { value: 0, label: 'Sin límite' },
      ] },
      { id: 'caduca_horas', type: 'choice', label: 'Si no confirmas una reserva, ¿cuándo la damos por rechazada?', help: 'Así el cliente no se queda esperando para siempre.', when: (a) => a.auto_confirm === false || Number(a.grupo_desde) > 0, options: [
        { value: 2, label: 'A las 2 horas' }, { value: 6, label: 'A las 6 horas' }, { value: 12, label: 'A las 12 horas' }, { value: 24, label: 'Al día siguiente' },
      ] },
      { id: 'google_resenas', type: 'text', label: '¿Cuál es el enlace para dejarte una reseña en Google?', help: 'Al día siguiente de venir, pediremos una reseña a tus clientes. Lo encuentras en tu Perfil de Empresa de Google → "Pedir reseñas".', placeholder: 'https://g.page/r/…' },
      { id: 'cancelacion', type: 'text', label: '¿Tienes alguna norma de cancelación o retraso?', help: 'La verá el cliente antes de reservar.', placeholder: 'Ej.: Guardamos la mesa 15 minutos. Avísanos si no puedes venir.' },
    ],
  },
  {
    key: 'cocina',
    title: 'Tu cocina',
    intro: 'Ayuda a tus clientes a decidir antes de venir.',
    questions: [
      { id: 'tipo_cocina', type: 'multi', label: '¿Qué tipo de cocina haces?', options: [
        { value: 'castellana', label: 'Castellana' }, { value: 'tradicional', label: 'Tradicional' }, { value: 'tapas', label: 'Tapas y raciones' },
        { value: 'asados', label: 'Asados' }, { value: 'mediterranea', label: 'Mediterránea' }, { value: 'italiana', label: 'Italiana' },
        { value: 'asiatica', label: 'Asiática' }, { value: 'hamburguesas', label: 'Hamburguesas' }, { value: 'desayunos', label: 'Desayunos y meriendas' },
      ] },
      { id: 'precio', type: 'choice', label: '¿Cuánto gasta de media una persona?', options: [
        { value: '€', label: 'Menos de 15 €' }, { value: '€€', label: '15–30 €' }, { value: '€€€', label: '30–50 €' }, { value: '€€€€', label: 'Más de 50 €' },
      ] },
      { id: 'dietas', type: 'multi', label: '¿Tienes opciones para…?', options: [
        { value: 'vegetariano', label: 'Vegetarianos' }, { value: 'vegano', label: 'Veganos' },
        { value: 'sin_gluten', label: 'Sin gluten' }, { value: 'ninos', label: 'Niños' },
      ] },
      { id: 'alergenos', type: 'yesno', label: '¿Informas de alérgenos si te preguntan?', help: 'Lo indicaremos en tu carta.' },
    ],
  },
  {
    key: 'extras',
    title: 'Menú del día y pedidos',
    intro: 'Secciones extra para tu panel, solo si las vas a usar.',
    questions: [
      { id: 'menu_dia', type: 'yesno', label: '¿Haces menú del día?', help: 'Te añadimos una sección para publicarlo cada día.' },
      { id: 'pedidos_qr', type: 'yesno', label: '¿Quieres que tus clientes pidan desde la mesa con un QR?', help: 'Escanean, ven la carta y la comanda te llega al momento.' },
      { id: 'cocina_pantalla', type: 'yesno', label: '¿Tendrás una pantalla o tablet en la cocina?', help: 'Las comandas aparecen ahí en directo.', when: (a) => yes(a.pedidos_qr) },
    ],
  },
  {
    key: 'local',
    title: 'Tu local',
    intro: 'Lo que hace que la gente elija tu sitio.',
    questions: [
      { id: 'tipo', type: 'choice', label: '¿Qué tipo de local tienes?', options: [
        { value: 'restaurante', label: 'Restaurante' }, { value: 'bar', label: 'Bar de tapas' },
        { value: 'cafeteria', label: 'Cafetería' }, { value: 'bar_restaurante', label: 'Bar restaurante' },
      ] },
      { id: 'comodidades', type: 'multi', label: '¿Qué ofreces en el local?', options: [
        { value: 'wifi', label: 'Wifi' }, { value: 'accesible', label: 'Acceso en silla de ruedas' }, { value: 'mascotas', label: 'Se admiten perros' },
        { value: 'parking', label: 'Aparcamiento cerca' }, { value: 'tarjeta', label: 'Pago con tarjeta' }, { value: 'tronas', label: 'Tronas para bebés' },
        { value: 'climatizada', label: 'Terraza climatizada' }, { value: 'reservado', label: 'Salón privado' },
      ] },
      { id: 'para_llevar', type: 'yesno', label: '¿Preparas comida para llevar?', help: 'Lo indicaremos en tu página para que te llamen.' },
      { id: 'ambiente', type: 'multi', label: '¿Cómo es el ambiente?', options: [
        { value: 'familiar', label: 'Familiar' }, { value: 'romantico', label: 'Para parejas' }, { value: 'grupos', label: 'Para grupos' },
        { value: 'futbol', label: 'Ponemos el fútbol' }, { value: 'musica', label: 'Música en directo' }, { value: 'tranquilo', label: 'Tranquilo' },
      ] },
    ],
  },
  {
    key: 'eventos',
    title: 'Grupos y celebraciones',
    intro: 'Bodas, cumpleaños, comidas de empresa…',
    questions: [
      { id: 'celebraciones', type: 'yesno', label: '¿Organizas celebraciones?' },
      { id: 'capacidad_evento', type: 'number', label: '¿Para cuántas personas como máximo?', min: 10, max: 500, def: 40, when: (a) => yes(a.celebraciones) },
      { id: 'menu_grupo', type: 'yesno', label: '¿Tienes menús cerrados para grupos?', when: (a) => yes(a.celebraciones) },
    ],
  },
];

const allQuestions = () => RESTAURANT_SECTIONS.flatMap((s) => s.questions);

export const visibleQuestions = (section, answers) =>
  section.questions.filter((q) => !q.when || q.when(answers));

export const isAnswered = (q, a) => {
  if (q.type === 'range') return !!(a[q.keys[0]] && a[q.keys[1]]);
  const v = a[q.id];
  if (q.type === 'text') return typeof v === 'string';
  return v !== undefined && v !== null && !(q.type === 'multi' && !Array.isArray(v));
};

export function sectionProgress(section, answers) {
  const qs = visibleQuestions(section, answers);
  const done = qs.filter((q) => isAnswered(q, answers)).length;
  return { done, total: qs.length };
}

export function profileProgress(answers) {
  const sections = RESTAURANT_SECTIONS.filter((s) => !s.when || s.when(answers));
  let done = 0;
  let total = 0;
  for (const s of sections) {
    const p = sectionProgress(s, answers);
    done += p.done;
    total += p.total;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

// What the panel and the public page switch on. Bookings and the daily menu are on until the
// owner says no; table ordering and the kitchen screen only when they ask for them.
export function modulesFor(profile = {}) {
  const on = (v) => v !== false;
  return {
    reservas: on(profile.reservas),
    menuDia: on(profile.menu_dia),
    pedidosQr: yes(profile.pedidos_qr),
    cocina: yes(profile.pedidos_qr) && yes(profile.cocina_pantalla),
  };
}

// Turns answers into the real hall and booking setup.
export function settingsFromProfile(profile, settings) {
  const patch = {};
  const services = profile.servicios || [];
  if (profile.servicios) {
    patch.lunch_start = services.includes('comidas') ? profile.lunch_start || '13:00' : '';
    patch.lunch_end = services.includes('comidas') ? profile.lunch_end || '16:00' : '';
    patch.dinner_start = services.includes('cenas') ? profile.dinner_start || '20:30' : '';
    patch.dinner_end = services.includes('cenas') ? profile.dinner_end || '23:30' : '';
  }
  if (Array.isArray(profile.cierre)) patch.closed_days = profile.cierre;
  if (profile.turno) patch.turn_duration_min = Number(profile.turno);

  if (profile.mesas !== undefined) {
    const old = new Map((settings.tables || []).map((t) => [Number(t.table_number), t]));
    const seats = Number(profile.plazas) || 4;
    const inside = Number(profile.mesas) || 0;
    const outside = yes(profile.terraza) ? Number(profile.mesas_terraza) || 0 : 0;
    const tables = [];
    for (let n = 1; n <= inside + outside; n += 1) {
      const zone = n <= inside ? 'Sala Principal' : 'Terraza';
      const prev = old.get(n);
      // Keep what the owner already set on that table (size, place on the plan, joins) when it stays in its zone.
      tables.push(prev && (prev.zone || 'Sala Principal') === zone ? { ...prev, id: n, table_number: n } : { id: n, table_number: n, zone, capacity: seats });
    }
    patch.tables = tables;
  }
  return patch;
}

const DIET_BADGES = { vegetariano: 'Opciones vegetarianas', vegano: 'Opciones veganas', sin_gluten: 'Sin gluten', ninos: 'Menú infantil' };

const label = (qid, value) => allQuestions().find((q) => q.id === qid)?.options?.find((o) => o.value === value)?.label;

// Short facts for the public page: "Castellana · €€", plus badges.
export function publicFacts(profile = {}) {
  const cuisine = (profile.tipo_cocina || []).map((v) => label('tipo_cocina', v)).filter(Boolean);
  const badges = [
    ...(profile.dietas || []).map((v) => DIET_BADGES[v]),
    ...(profile.comodidades || []).map((v) => label('comodidades', v)),
    ...(profile.ambiente || []).map((v) => label('ambiente', v)),
    yes(profile.para_llevar) && 'Comida para llevar',
    yes(profile.celebraciones) && `Celebraciones${profile.capacidad_evento ? ` hasta ${profile.capacidad_evento} personas` : ''}`,
    yes(profile.menu_grupo) && 'Menús para grupos',
    yes(profile.alergenos) && 'Información de alérgenos',
  ].filter(Boolean);
  return { headline: [...cuisine.slice(0, 3), profile.precio].filter(Boolean).join(' · '), badges };
}
