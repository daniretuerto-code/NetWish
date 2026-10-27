// Questionnaires for every type that is not a restaurant (restaurants: questionnaire.js).
// Same shape: sections of questions whose answers live in restaurant_settings.profile.
// A yes/no question with `fact` puts that line on the public page when the answer is yes.
import { typeOf } from './businessTypes.js';
import { RESTAURANT_SECTIONS } from './questionnaire.js';

const yes = (v) => v === true;
const DAYS = [
  { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' }, { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' }, { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' }, { value: 0, label: 'Domingo' },
];
const PAY = { id: 'pagos', type: 'multi', label: '¿Cómo te pueden pagar?', help: 'Lo verán antes de reservar o comprar.', options: [
  { value: 'tarjeta', label: 'Tarjeta' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'bizum', label: 'Bizum' },
] };

// Opening hours: one range, or morning and afternoon when the business closes at midday.
const hours = (defaults, closedDefault) => [
  { id: 'partido', type: 'yesno', label: '¿Cierras a mediodía?', help: 'Si dices que sí, te preguntamos el horario de mañana y el de tarde.' },
  { id: 'horario', type: 'range', label: '¿Qué horario tienes?', keys: ['lunch_start', 'lunch_end'], defaults: [defaults[0], defaults[3]], when: (a) => a.partido === false },
  { id: 'horario_manana', type: 'range', label: '¿Y por la mañana?', keys: ['lunch_start', 'lunch_end'], defaults: [defaults[0], defaults[1]], when: (a) => a.partido !== false },
  { id: 'horario_tarde', type: 'range', label: '¿Y por la tarde?', keys: ['dinner_start', 'dinner_end'], defaults: [defaults[2], defaults[3]], when: (a) => a.partido !== false },
  { id: 'cierre', type: 'days', label: '¿Qué días cierras?', help: closedDefault, options: DAYS },
];

const stockLow = { id: 'stock_bajo', type: 'choice', label: '¿Con cuántas unidades te avisamos de que queda poco?', help: 'En tu panel saldrá en "Te queda poco" y el cliente verá "Quedan 2".', options: [
  { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 5, label: '5' }, { value: 10, label: '10' },
] };

const pickup = (prepOptions) => [
  { id: 'recogida', type: 'yesno', label: '¿Quieres que tus clientes compren online y lo recojan en tu tienda?', help: 'Eligen día y hora, lo apartamos del stock y te llega el pedido. Pagan al recogerlo. Los envíos a domicilio llegarán más adelante.' },
  { id: 'prep_min', type: 'choice', label: '¿Cuánto tardas en tener listo un pedido?', help: 'Las horas de recogida empezarán a partir de ahí.', when: (a) => yes(a.recogida), options: prepOptions },
  { ...PAY, when: (a) => yes(a.recogida) },
];

const SHOP_EXTRA = {
  moda: {
    key: 'tienda', title: 'Tu tienda', intro: 'Lo que hace que compren en tu tienda y no en internet.',
    questions: [
      { id: 'probador', type: 'yesno', label: '¿Tienes probador?', fact: 'Probador' },
      { id: 'arreglos', type: 'yesno', label: '¿Haces arreglos (bajos, ajustes)?', fact: 'Arreglos de ropa' },
      { id: 'guardar_dias', type: 'choice', label: '¿Cuántos días guardas un pedido sin recoger?', help: 'Después vuelve al stock.', options: [
        { value: 1, label: '1 día' }, { value: 2, label: '2 días' }, { value: 3, label: '3 días' }, { value: 7, label: '1 semana' },
      ] },
      { id: 'regalo', type: 'yesno', label: '¿Envuelves para regalo?', fact: 'Envoltorio de regalo' },
      { id: 'cambios', type: 'text', label: '¿Cuál es tu política de cambios?', help: 'La verá el cliente antes de comprar.', placeholder: 'Ej.: Cambios y devoluciones en 30 días con el ticket.' },
      stockLow,
    ],
  },
  panaderia: {
    key: 'obrador', title: 'Tu obrador', intro: 'Lo que hace especial tu pan.',
    questions: [
      { id: 'obrador_propio', type: 'yesno', label: '¿Hacéis el pan en vuestro obrador?', fact: 'Obrador propio' },
      { id: 'masa_madre', type: 'yesno', label: '¿Tenéis pan de masa madre?', fact: 'Masa madre' },
      { id: 'sin_gluten', type: 'yesno', label: '¿Tenéis opciones sin gluten?', fact: 'Opciones sin gluten' },
      { id: 'encargos', type: 'yesno', label: '¿Hacéis tartas y encargos?', help: 'Podrás marcar productos "por encargo" con los días de antelación que necesites.', fact: 'Tartas por encargo' },
      { id: 'cafe', type: 'yesno', label: '¿Tenéis cafetería o mesas para tomar algo?', fact: 'Cafetería' },
      stockLow,
    ],
  },
  alimentacion: {
    key: 'genero', title: 'Tu género', intro: 'Lo que buscan tus clientes en una tienda de barrio.',
    questions: [
      { id: 'elaboracion_propia', type: 'yesno', label: '¿Elaboráis vosotros embutidos, hamburguesas o preparados?', fact: 'Elaboración propia' },
      { id: 'producto_local', type: 'yesno', label: '¿Vendes producto de la zona o con IGP?', fact: 'Producto de Palencia' },
      { id: 'peso_aviso', type: 'yesno', label: 'En lo que va al peso, ¿avisamos de que se paga lo que pese?', help: 'El cliente verá un precio aproximado.', fact: 'Pagas lo que pese' },
      { id: 'envasado', type: 'yesno', label: '¿Envasas al vacío si te lo piden?', fact: 'Envasado al vacío' },
      stockLow,
    ],
  },
  floristeria: {
    key: 'flores', title: 'Tu floristería', intro: 'Ramos, plantas y encargos.',
    questions: [
      { id: 'tarjeta_dedicatoria', type: 'yesno', label: '¿Incluyes tarjeta con dedicatoria?', fact: 'Tarjeta con dedicatoria' },
      { id: 'bodas', type: 'yesno', label: '¿Haces flores para bodas y eventos?', fact: 'Bodas y eventos' },
      { id: 'funeraria', type: 'yesno', label: '¿Haces coronas y centros para funerales?', fact: 'Coronas y centros' },
      { id: 'plantas', type: 'yesno', label: '¿Vendes plantas de interior y exterior?', fact: 'Plantas' },
      stockLow,
    ],
  },
  tienda: {
    key: 'tienda', title: 'Tu tienda', intro: 'Lo que hace que compren en tu tienda.',
    questions: [
      { id: 'regalo', type: 'yesno', label: '¿Envuelves para regalo?', fact: 'Envoltorio de regalo' },
      { id: 'encargos', type: 'yesno', label: '¿Pides productos por encargo si no los tienes?', fact: 'Te lo pedimos si no lo tenemos' },
      { id: 'cambios', type: 'text', label: '¿Cuál es tu política de cambios?', placeholder: 'Ej.: Cambios en 15 días con el ticket.' },
      stockLow,
    ],
  },
};

const shipping = {
  key: 'envios', title: 'Envíos a domicilio', intro: 'Aún no están, pero queremos saber quién los necesita.',
  questions: [
    { id: 'envio_interes', type: 'yesno', label: '¿Te gustaría enviar pedidos a domicilio por NetWish?', help: 'Te avisaremos en cuanto esté listo.' },
    { id: 'envio_zona', type: 'choice', label: '¿Hasta dónde llevarías?', when: (a) => yes(a.envio_interes), options: [
      { value: 'barrio', label: 'Mi barrio' }, { value: 'ciudad', label: 'Toda Palencia' }, { value: 'provincia', label: 'La provincia' }, { value: 'espana', label: 'Toda España' },
    ] },
  ],
};

const BEAUTY_EXTRA = {
  belleza: [
    { id: 'sin_cita', type: 'yesno', label: '¿Atiendes también sin cita?', fact: 'También sin cita' },
    { id: 'ninos', type: 'yesno', label: '¿Cortas a niños?', fact: 'Cortes para niños' },
    { id: 'productos', type: 'yesno', label: '¿Vendes productos de peluquería?', fact: 'Venta de productos' },
  ],
  estetica: [
    { id: 'bonos', type: 'yesno', label: '¿Tienes bonos de sesiones?', fact: 'Bonos de sesiones' },
    { id: 'cabina_privada', type: 'yesno', label: '¿Tienes cabinas privadas?', fact: 'Cabinas privadas' },
    { id: 'regalo', type: 'yesno', label: '¿Vendes tarjetas regalo?', fact: 'Tarjetas regalo' },
  ],
  salud: [
    { id: 'mutuas', type: 'yesno', label: '¿Trabajas con mutuas o seguros?', fact: 'Mutuas y seguros' },
    { id: 'domicilio', type: 'yesno', label: '¿Atiendes a domicilio?', fact: 'A domicilio' },
    { id: 'factura', type: 'yesno', label: '¿Das factura para el seguro?', fact: 'Factura para el seguro' },
  ],
  taller: [
    { id: 'coche_sustitucion', type: 'yesno', label: '¿Tienes coche de sustitución?', fact: 'Coche de sustitución' },
    { id: 'recogida_coche', type: 'yesno', label: '¿Recoges el coche a domicilio?', fact: 'Recogemos tu coche' },
    { id: 'presupuesto', type: 'yesno', label: '¿Das presupuesto sin compromiso?', fact: 'Presupuesto sin compromiso' },
  ],
  mascotas: [
    { id: 'grandes', type: 'yesno', label: '¿Atiendes perros grandes?', fact: 'Perros grandes' },
    { id: 'gatos', type: 'yesno', label: '¿Atiendes gatos?', fact: 'También gatos' },
    { id: 'urgencias', type: 'yesno', label: '¿Tienes urgencias?', fact: 'Urgencias' },
  ],
  servicios: [
    { id: 'presupuesto', type: 'yesno', label: '¿Das presupuesto sin compromiso?', fact: 'Presupuesto sin compromiso' },
    { id: 'domicilio', type: 'yesno', label: '¿Vas a domicilio?', fact: 'A domicilio' },
  ],
};

export function sectionsFor(biz) {
  const t = typeOf(biz);
  if (t.engine === 'restaurant') return RESTAURANT_SECTIONS;
  if (t.engine === 'shop') {
    const bakery = t.key === 'panaderia';
    const def = bakery ? ['07:30', '14:30', '17:30', '20:30'] : t.key === 'alimentacion' ? ['09:00', '14:00', '17:30', '20:00'] : ['10:00', '14:00', '17:00', '20:30'];
    const prep = bakery
      ? [{ value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hora' }, { value: 1440, label: 'Para el día siguiente' }]
      : [{ value: 30, label: '30 min' }, { value: 60, label: '1 hora' }, { value: 120, label: '2 horas' }, { value: 1440, label: 'Para el día siguiente' }];
    return [
      { key: 'basico', title: 'Lo básico', intro: 'Tu horario y cómo te compran. Con esto tu tienda queda lista.', onboarding: true, questions: [...hours(def, 'Ese día no se podrá recoger.'), ...pickup(prep)] },
      ...(SHOP_EXTRA[t.key] ? [SHOP_EXTRA[t.key]] : [SHOP_EXTRA.tienda]),
      shipping,
    ];
  }
  if (t.engine === 'classes') {
    return [
      { key: 'basico', title: 'Lo básico', intro: 'Tu horario y tus normas. Luego montas el horario de clases.', onboarding: true, questions: [
        ...hours(['09:00', '13:00', '17:00', '21:30'], 'Ese día no habrá clases.'),
        { id: 'cancelar_horas', type: 'choice', label: '¿Hasta cuántas horas antes se puede cancelar una clase?', options: [
          { value: 1, label: '1 hora' }, { value: 2, label: '2 horas' }, { value: 4, label: '4 horas' }, { value: 12, label: '12 horas' }, { value: 24, label: '24 horas' },
        ] },
        PAY,
      ] },
      { key: 'centro', title: 'Tu centro', intro: 'Lo que la gente pregunta antes de apuntarse.', questions: [
        { id: 'primera_gratis', type: 'yesno', label: '¿La primera clase es gratis?', fact: 'Primera clase gratis' },
        { id: 'esterillas', type: 'yesno', label: '¿Dejáis el material (esterillas, pesas…)?', fact: 'Material incluido' },
        { id: 'duchas', type: 'yesno', label: '¿Hay vestuarios con ducha?', fact: 'Vestuarios con ducha' },
        { id: 'ninos_clases', type: 'yesno', label: '¿Tenéis clases para niños?', fact: 'Clases para niños' },
        { id: 'online', type: 'yesno', label: '¿Dais clases online?', fact: 'También online' },
      ] },
    ];
  }
  if (t.engine === 'taxi') {
    return [
      { key: 'basico', title: 'Lo básico', intro: 'Tu taxi y cuándo trabajas.', onboarding: true, questions: [
        { id: 'horario', type: 'range', label: '¿En qué horario aceptas reservas?', keys: ['lunch_start', 'lunch_end'], defaults: ['06:00', '23:59'] },
        { id: 'cierre', type: 'days', label: '¿Qué días descansas?', help: 'Ese día no te podrán reservar.', options: DAYS },
        { id: 'plazas', type: 'choice', label: '¿Cuántas plazas tiene tu taxi?', options: [
          { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 7, label: '7' }, { value: 8, label: '8' },
        ] },
        { id: 'aviso_min', type: 'choice', label: '¿Con cuánta antelación quieres las reservas?', options: [
          { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hora' }, { value: 1440, label: 'El día antes' },
        ] },
        PAY,
      ] },
      { key: 'vehiculo', title: 'Tu vehículo', intro: 'Lo que el cliente quiere saber antes de pedirte.', questions: [
        { id: 'adaptado', type: 'yesno', label: '¿Está adaptado para silla de ruedas?', fact: 'Adaptado para silla de ruedas' },
        { id: 'maletero', type: 'yesno', label: '¿Tiene maletero grande?', fact: 'Maletero grande' },
        { id: 'mascotas', type: 'yesno', label: '¿Aceptas mascotas?', fact: 'Se admiten mascotas' },
        { id: 'largas', type: 'yesno', label: '¿Haces viajes largos y aeropuertos?', fact: 'Viajes largos y aeropuertos' },
        { id: 'silla_bebe', type: 'yesno', label: '¿Llevas silla de bebé?', fact: 'Silla de bebé' },
      ] },
    ];
  }
  // Appointments: salons, beauty, health, garages, pets and services.
  return [
    { key: 'basico', title: 'Lo básico', intro: 'Tu horario. Las citas solo se ofrecen cuando cabe el servicio entero.', onboarding: true, questions: [
      ...hours(['10:00', '14:00', '16:30', '20:30'], 'Ese día no se podrán pedir citas.'),
      PAY,
    ] },
    { key: 'local', title: t.key === 'taller' ? 'Tu taller' : t.key === 'salud' ? 'Tu consulta' : 'Tu local', intro: 'Lo que hace que te elijan.', questions: BEAUTY_EXTRA[t.key] || BEAUTY_EXTRA.servicios },
  ];
}

// Answers → real opening hours and closed days.
export function settingsFromAnswers(biz, profile, settings) {
  if (typeOf(biz).engine === 'restaurant') return null;
  const patch = {};
  if (Array.isArray(profile.cierre)) patch.closed_days = profile.cierre;
  if (profile.lunch_start) patch.lunch_start = profile.lunch_start;
  if (profile.lunch_end) patch.lunch_end = profile.lunch_end;
  if (profile.partido === false || typeOf(biz).engine === 'taxi') {
    patch.dinner_start = '';
    patch.dinner_end = '';
  } else {
    if (profile.dinner_start) patch.dinner_start = profile.dinner_start;
    if (profile.dinner_end) patch.dinner_end = profile.dinner_end;
  }
  return { ...patch, tables: settings?.tables || [] };
}

// Lines for the public page from the yes/no answers that carry a `fact`.
export function typeFacts(biz, profile = {}) {
  return sectionsFor(biz).flatMap((s) => s.questions).filter((q) => q.fact && profile[q.id] === true).map((q) => q.fact);
}
