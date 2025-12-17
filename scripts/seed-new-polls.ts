import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colores para las opciones
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF7F50', '#6B5B95', '#88B04B', '#F7CAC9',
  '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124', '#D65076', '#45B8AC', '#EFC050',
  '#5B5EA6', '#9B2335', '#DFCFBE', '#55B4B0', '#E15D44', '#7FCDCD', '#BC243C', '#C3447A'
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

interface PollData {
  title: string;
  category: string;
  options: { label: string; imageUrl?: string }[];
  type?: string;
}

const polls: PollData[] = [
  // 🏆 Fandoms, Cultura Pop y Tecnología
  {
    title: "¿Qué fandom es el más poderoso y leal del mundo ahora mismo?",
    category: "cultura_pop",
    options: [
      { label: "Swifties (Taylor Swift)" },
      { label: "ARMY (BTS)" },
      { label: "BeyHive (Beyoncé)" },
      { label: "Blinks (BLACKPINK)" }
    ]
  },
  {
    title: "Si solo pudieras usar un sistema operativo el resto de tu vida, ¿cuál elegirías?",
    category: "tecnologia",
    options: [
      { label: "Android" },
      { label: "iOS" }
    ]
  },
  {
    title: "Solo puede quedar uno en la historia. ¿Quién es el verdadero GOAT?",
    category: "deportes",
    options: [
      { label: "Messi" },
      { label: "Cristiano Ronaldo" },
      { label: "Pelé" }
    ]
  },
  {
    title: "¿Qué tipo de persona eres? La batalla definitiva de mascotas",
    category: "lifestyle",
    options: [
      { label: "🐕 Perros" },
      { label: "🐈 Gatos" }
    ]
  },
  {
    title: "Console Wars: Tienes presupuesto ilimitado pero solo puedes elegir UNA plataforma",
    category: "gaming",
    options: [
      { label: "PC Gaming" },
      { label: "PlayStation 5" },
      { label: "Xbox Series X" },
      { label: "Nintendo Switch" }
    ]
  },
  {
    title: "¿Marvel o DC?",
    category: "cultura_pop",
    options: [
      { label: "Marvel" },
      { label: "DC" }
    ]
  },
  {
    title: "¿Harry Potter está sobrevalorado?",
    category: "cultura_pop",
    options: [
      { label: "Sí, está sobrevalorado" },
      { label: "No, es una obra maestra" }
    ]
  },
  {
    title: "FIFA vs. Call of Duty: Si solo pudieras jugar una franquicia el resto de tu vida",
    category: "gaming",
    options: [
      { label: "FIFA / EA Sports FC" },
      { label: "Call of Duty" }
    ]
  },

  // 🍔 Comida y Debates Triviales
  {
    title: "La pizza con piña (Hawaiana): ¿Delicia incomprendida o crimen culinario?",
    category: "comida",
    options: [
      { label: "🍕🍍 Delicia incomprendida" },
      { label: "🚫 Crimen culinario" }
    ]
  },
  {
    title: "¿El cereal va antes o después de la leche?",
    category: "comida",
    options: [
      { label: "🥣 Cereal primero" },
      { label: "🥛 Leche primero" }
    ]
  },
  {
    title: "¿Te lavas 'activamente' las piernas en la ducha o dejas que el agua caiga sola?",
    category: "lifestyle",
    options: [
      { label: "Las lavo activamente" },
      { label: "El agua y el jabón caen solos" }
    ]
  },
  {
    title: "¿Duermes con la puerta de la habitación abierta o cerrada?",
    category: "lifestyle",
    options: [
      { label: "🚪 Abierta" },
      { label: "🔒 Cerrada" }
    ]
  },
  {
    title: "La tortilla de patata: ¿Con cebolla o sin cebolla?",
    category: "comida",
    options: [
      { label: "🧅 CON cebolla" },
      { label: "❌ SIN cebolla" }
    ]
  },
  {
    title: "¿Es un Hot Dog un sándwich?",
    category: "comida",
    options: [
      { label: "Sí, es un sándwich" },
      { label: "No, es otra cosa" }
    ]
  },
  {
    title: "¿El papel higiénico se coloca con la hoja hacia afuera o pegada a la pared?",
    category: "lifestyle",
    options: [
      { label: "➡️ Hacia afuera" },
      { label: "⬅️ Pegada a la pared" }
    ]
  },
  {
    title: "¿La pizza se come con la mano o con cubiertos?",
    category: "comida",
    options: [
      { label: "🤚 Con la mano" },
      { label: "🍴 Con cubiertos" }
    ]
  },

  // 🧠 Dilemas Psicológicos y "Tú qué harías"
  {
    title: "¿Preferirías recibir 1 millón ahora o tener un 50% de posibilidades de recibir 100 millones?",
    category: "dilemas",
    options: [
      { label: "💰 1 millón seguro" },
      { label: "🎰 50% de 100 millones" }
    ]
  },
  {
    title: "Tienes un botón rojo (10M €) y uno azul (Volver a los 10 años sabiendo todo). ¿Cuál pulsas?",
    category: "dilemas",
    options: [
      { label: "🔴 10 millones de euros" },
      { label: "🔵 Volver a los 10 años" }
    ]
  },
  {
    title: "Si pudieras saber la fecha exacta y la causa de tu muerte, ¿querrías saberlo?",
    category: "dilemas",
    options: [
      { label: "Sí, quiero saberlo" },
      { label: "No, prefiero no saberlo" }
    ]
  },
  {
    title: "¿Preferirías ser la persona más inteligente del mundo pero muy fea, o la más atractiva pero muy tonta?",
    category: "dilemas",
    options: [
      { label: "🧠 Inteligente pero feo/a" },
      { label: "✨ Atractivo/a pero tonto/a" }
    ]
  },
  {
    title: "Tienes que eliminar uno para siempre: ¿Música o Películas/Series?",
    category: "dilemas",
    options: [
      { label: "🎵 Eliminar música" },
      { label: "🎬 Eliminar películas/series" }
    ]
  },
  {
    title: "¿Vivirías un año sin Internet ni móvil a cambio de 500.000 €?",
    category: "dilemas",
    options: [
      { label: "💰 Sí, acepto" },
      { label: "📱 No, imposible" }
    ]
  },
  {
    title: "¿Hablar todos los idiomas del mundo o hablar con los animales?",
    category: "dilemas",
    options: [
      { label: "🌍 Todos los idiomas" },
      { label: "🐾 Hablar con animales" }
    ]
  },
  {
    title: "¿Viajar al pasado para corregir un error o al futuro para ver tu vida?",
    category: "dilemas",
    options: [
      { label: "⏪ Al pasado" },
      { label: "⏩ Al futuro" }
    ]
  },
  {
    title: "¿Preferirías ser la persona más rica del cementerio o vivir 100 años siendo pobre?",
    category: "dilemas",
    options: [
      { label: "💀💰 Rico en el cementerio" },
      { label: "👴 100 años pobre" }
    ]
  },
  {
    title: "¿Equipo 'Madrugar' o Equipo 'Nocturno'?",
    category: "lifestyle",
    options: [
      { label: "🌅 Equipo Madrugar" },
      { label: "🌙 Equipo Nocturno" }
    ]
  },
  {
    title: "¿Preferirías calor extremo (sudar) o frío extremo (temblar)?",
    category: "dilemas",
    options: [
      { label: "🔥 Calor extremo" },
      { label: "❄️ Frío extremo" }
    ]
  },
  {
    title: "Si pudieras ser invisible por 24 horas, ¿harías algo ilegal?",
    category: "dilemas",
    options: [
      { label: "😈 Probablemente sí" },
      { label: "😇 No, sería legal" }
    ]
  },
  {
    title: "¿Saberlo todo o ser feliz?",
    category: "dilemas",
    options: [
      { label: "🧠 Saberlo todo" },
      { label: "😊 Ser feliz" }
    ]
  },
  {
    title: "¿Amor eterno o ganar la Lotería?",
    category: "dilemas",
    options: [
      { label: "❤️ Amor eterno" },
      { label: "💰 Ganar la Lotería" }
    ]
  },
  {
    title: "¿Seguirías trabajando si fueras asquerosamente rico?",
    category: "dilemas",
    options: [
      { label: "Sí, seguiría trabajando" },
      { label: "No, dejaría de trabajar" }
    ]
  },

  // ❤️ Amor, Sexo y Relaciones (Picantes)
  {
    title: "Sé sincero: ¿Revisarías el móvil de tu pareja si supieras 100% que no se va a enterar?",
    category: "relaciones",
    options: [
      { label: "👀 Sí, lo revisaría" },
      { label: "🙅 No, respeto su privacidad" }
    ]
  },
  {
    title: "En una primera cita, ¿quién debe pagar la cuenta hoy en día?",
    category: "relaciones",
    options: [
      { label: "👨 El hombre" },
      { label: "👩 La mujer" },
      { label: "💑 A medias" },
      { label: "🎲 Quien invitó" }
    ]
  },
  {
    title: "¿Perdonarías una infidelidad si te aseguran que fue solo una vez?",
    category: "relaciones",
    options: [
      { label: "Sí, perdonaría" },
      { label: "No, nunca" },
      { label: "Depende de las circunstancias" }
    ]
  },
  {
    title: "¿Existe la amistad verdadera entre hombre y mujer heterosexuales sin tensión sexual?",
    category: "relaciones",
    options: [
      { label: "Sí, totalmente posible" },
      { label: "No, siempre hay tensión" },
      { label: "Depende de las personas" }
    ]
  },
  {
    title: "El 'Ghosting': ¿Crueldad o forma válida de terminar?",
    category: "relaciones",
    options: [
      { label: "👻 Crueldad total" },
      { label: "✅ A veces es válido" }
    ]
  },
  {
    title: "¿Le darías tu contraseña del móvil a tu pareja ahora mismo sin miedo?",
    category: "relaciones",
    options: [
      { label: "🔓 Sí, sin problema" },
      { label: "🔒 No, es mi privacidad" }
    ]
  },
  {
    title: "¿Consideras que ver pornografía estando en pareja es infidelidad?",
    category: "relaciones",
    options: [
      { label: "Sí, es infidelidad" },
      { label: "No, es normal" },
      { label: "Depende del acuerdo" }
    ]
  },
  {
    title: "¿Volverías con tu ex si te garantizan que esta vez funcionará?",
    category: "relaciones",
    options: [
      { label: "Sí, volvería" },
      { label: "No, nunca" },
      { label: "Depende de cuál ex" }
    ]
  },
  {
    title: "¿Es aceptable 'stalkear' las redes sociales de alguien antes de la primera cita?",
    category: "relaciones",
    options: [
      { label: "🔍 Totalmente aceptable" },
      { label: "❌ Es raro/invasivo" }
    ]
  },
  {
    title: "¿Te has enamorado alguna vez de alguien 'prohibido'?",
    category: "relaciones",
    options: [
      { label: "💔 Sí, me ha pasado" },
      { label: "😇 No, nunca" }
    ]
  },
  {
    title: "¿El 'Micro-cheating' (likes en redes, tonteo) cuenta como cuernos?",
    category: "relaciones",
    options: [
      { label: "Sí, es una forma de infidelidad" },
      { label: "No, es inofensivo" }
    ]
  },
  {
    title: "Sé brutalmente honesto: ¿El tamaño importa?",
    category: "relaciones",
    options: [
      { label: "Sí, importa" },
      { label: "No, no importa" },
      { label: "Importa pero no es lo principal" }
    ]
  },
  {
    title: "¿Tendrías una relación abierta si tu pareja te lo pide?",
    category: "relaciones",
    options: [
      { label: "Sí, lo consideraría" },
      { label: "No, nunca" }
    ]
  },
  {
    title: "Sexo en la primera cita: ¿Sí o No?",
    category: "relaciones",
    options: [
      { label: "✅ Sí, si hay conexión" },
      { label: "❌ No, es muy pronto" }
    ]
  },
  {
    title: "¿Alguna vez has fingido un orgasmo?",
    category: "relaciones",
    options: [
      { label: "🎭 Sí, alguna vez" },
      { label: "😤 No, nunca" }
    ]
  },
  {
    title: "¿Te has imaginado a otra persona mientras tenías relaciones con tu pareja?",
    category: "relaciones",
    options: [
      { label: "🤫 Sí, ha pasado" },
      { label: "❌ No, nunca" }
    ]
  },
  {
    title: "El 'Body Count' (número de parejas pasadas): ¿Te importa o da igual?",
    category: "relaciones",
    options: [
      { label: "📊 Me importa saberlo" },
      { label: "🤷 Me da igual" }
    ]
  },
  {
    title: "¿Te liarías con el ex de tu mejor amigo si nadie se entera?",
    category: "relaciones",
    options: [
      { label: "🤫 Siendo honesto, sí" },
      { label: "🙅 Nunca, hay códigos" }
    ]
  },
  {
    title: "¿Aceptarías una proposición indecente (sexo por 100.000€)?",
    category: "relaciones",
    options: [
      { label: "💰 Sí, aceptaría" },
      { label: "❌ No, tengo principios" },
      { label: "🤔 Depende de quién" }
    ]
  },
  {
    title: "¿Qué miras primero instintivamente: Cara o Cuerpo?",
    category: "relaciones",
    options: [
      { label: "😊 La cara" },
      { label: "💪 El cuerpo" }
    ]
  },
  {
    title: "¿Mañanero o Nocturno? (en la intimidad)",
    category: "relaciones",
    options: [
      { label: "🌅 Mañanero" },
      { label: "🌙 Nocturno" }
    ]
  },
  {
    title: "¿Te atrae más la actitud de 'chico/a malo' o 'buena persona'?",
    category: "relaciones",
    options: [
      { label: "😈 Chico/a malo" },
      { label: "😇 Buena persona" }
    ]
  },
  {
    title: "¿Crees que el ser humano es monógamo por naturaleza?",
    category: "relaciones",
    options: [
      { label: "Sí, somos monógamos" },
      { label: "No, es cultural" }
    ]
  },

  // 💀 Dilemas Extremos (Vida o Muerte)
  {
    title: "Incendio: ¿Salvas a tu Madre/Padre o a tu Pareja?",
    category: "dilemas_extremos",
    options: [
      { label: "👨‍👩‍👧 Madre/Padre" },
      { label: "💑 Pareja" }
    ]
  },
  {
    title: "Barco hundiéndose: ¿Salvas a tu perro o a un desconocido humano?",
    category: "dilemas_extremos",
    options: [
      { label: "🐕 Mi perro" },
      { label: "👤 El desconocido" }
    ]
  },
  {
    title: "¿A quién salvas? ¿A un niño de 5 años o a un científico que curará el cáncer?",
    category: "dilemas_extremos",
    options: [
      { label: "👶 Al niño" },
      { label: "🔬 Al científico" }
    ]
  },
  {
    title: "¿Preferirías ser asesinado o ser el asesino (por accidente) y vivir con la culpa?",
    category: "dilemas_extremos",
    options: [
      { label: "💀 Ser asesinado" },
      { label: "😰 Vivir con la culpa" }
    ]
  },
  {
    title: "¿Matarías a un dictador genocida cuando era un bebé inocente?",
    category: "dilemas_extremos",
    options: [
      { label: "Sí, salvaría millones" },
      { label: "No, es un bebé inocente" }
    ]
  },
  {
    title: "Accidente: ¿Salvas a 1 bebé o a 5 ancianos?",
    category: "dilemas_extremos",
    options: [
      { label: "👶 1 bebé" },
      { label: "👴👴👴👴👴 5 ancianos" }
    ]
  },
  {
    title: "¿Preferirías morir quemado o ahogado?",
    category: "dilemas_extremos",
    options: [
      { label: "🔥 Quemado" },
      { label: "🌊 Ahogado" }
    ]
  },
  {
    title: "¿Perder las dos manos o perder la vista?",
    category: "dilemas_extremos",
    options: [
      { label: "✋✋ Perder las manos" },
      { label: "👁️ Perder la vista" }
    ]
  },
  {
    title: "¿Preferirías morir tú ahora o que muera el 50% de la población mundial al azar?",
    category: "dilemas_extremos",
    options: [
      { label: "😵 Morir yo" },
      { label: "🌍 50% de la población" }
    ]
  },
  {
    title: "¿10 años en la cárcel o 10 años en coma?",
    category: "dilemas_extremos",
    options: [
      { label: "🔒 10 años en cárcel" },
      { label: "🛏️ 10 años en coma" }
    ]
  },
  {
    title: "¿Ser enterrado vivo o lanzado al espacio exterior?",
    category: "dilemas_extremos",
    options: [
      { label: "⚰️ Enterrado vivo" },
      { label: "🚀 Lanzado al espacio" }
    ]
  },
  {
    title: "¿No poder hablar nunca más o no poder escuchar nunca más?",
    category: "dilemas_extremos",
    options: [
      { label: "🤐 No hablar" },
      { label: "🔇 No escuchar" }
    ]
  },
  {
    title: "Te dan 10 Millones pero muere alguien al azar en el mundo. ¿Pulsas el botón?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, lo pulso" },
      { label: "❌ No, nunca" }
    ]
  },
  {
    title: "¿Comer carne humana o morir de hambre?",
    category: "dilemas_extremos",
    options: [
      { label: "🍖 Comer carne humana" },
      { label: "💀 Morir de hambre" }
    ]
  },
  {
    title: "¿Venderías 10 años de tu vida a cambio de ser multimillonario ahora?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, los vendo" },
      { label: "⏰ No, prefiero vivir más" }
    ]
  },
  {
    title: "¿Preferirías ser inmortal viendo morir a todos o morir mañana sin dolor?",
    category: "dilemas_extremos",
    options: [
      { label: "♾️ Ser inmortal" },
      { label: "😴 Morir mañana sin dolor" }
    ]
  },
  {
    title: "Tienes que elegir AHORA: ¿Tu historial de internet PÚBLICO o perder un dedo?",
    category: "dilemas_extremos",
    options: [
      { label: "🌐 Historial público" },
      { label: "✋ Perder un dedo" }
    ]
  },
  {
    title: "¿Preferirías encontrar el cadáver de tu pareja o que tu pareja encuentre el tuyo?",
    category: "dilemas_extremos",
    options: [
      { label: "😰 Encontrar el de mi pareja" },
      { label: "💀 Que encuentre el mío" }
    ]
  },
  {
    title: "¿Venderías a tu mascota por 1 Millón de euros?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, la vendería" },
      { label: "🐾 Jamás" }
    ]
  },

  // 👽 Existencialismo, Futuro y Creencias
  {
    title: "Sé honesto. En 5 años, ¿crees que una IA hará tu trabajo mejor que tú?",
    category: "tecnologia",
    options: [
      { label: "🤖 Sí, probablemente" },
      { label: "👤 No, mi trabajo es seguro" },
      { label: "🤔 Parcialmente" }
    ]
  },
  {
    title: "¿Estamos solos en el universo o el gobierno oculta a los aliens?",
    category: "creencias",
    options: [
      { label: "👽 Hay aliens y lo ocultan" },
      { label: "🌌 Estamos solos" },
      { label: "❓ Hay vida pero no nos visitan" }
    ]
  },
  {
    title: "¿Crees que vivimos en una simulación (Matrix)?",
    category: "creencias",
    options: [
      { label: "🔴 Sí, es posible" },
      { label: "🔵 No, esto es real" }
    ]
  },
  {
    title: "¿Aceptarías implantarte un chip en el cerebro para aprender habilidades?",
    category: "tecnologia",
    options: [
      { label: "🧠 Sí, sin dudarlo" },
      { label: "❌ No, es peligroso" },
      { label: "🤔 Depende de los riesgos" }
    ]
  },
  {
    title: "¿Existe Dios?",
    category: "creencias",
    options: [
      { label: "✝️ Sí, existe" },
      { label: "❌ No existe" },
      { label: "🤷 No lo sé / Agnóstico" }
    ]
  },
  {
    title: "¿Crees en la vida después de la muerte?",
    category: "creencias",
    options: [
      { label: "👼 Sí, hay algo más" },
      { label: "💀 No, todo termina" },
      { label: "🤔 No estoy seguro" }
    ]
  },
  {
    title: "¿Crees en el Karma?",
    category: "creencias",
    options: [
      { label: "☯️ Sí, lo que das vuelve" },
      { label: "❌ No, es coincidencia" }
    ]
  },
  {
    title: "¿Existe el destino o lo creamos nosotros?",
    category: "creencias",
    options: [
      { label: "🔮 Existe el destino" },
      { label: "✊ Lo creamos nosotros" },
      { label: "🤝 Un poco de ambos" }
    ]
  },
  {
    title: "¿Crees que el hombre llegó a la Luna o fue un montaje?",
    category: "creencias",
    options: [
      { label: "🌙 Sí llegamos" },
      { label: "🎬 Fue un montaje" }
    ]
  },
  {
    title: "¿Crees en el horóscopo y la astrología?",
    category: "creencias",
    options: [
      { label: "⭐ Sí, influyen" },
      { label: "❌ No, es pseudociencia" },
      { label: "🤷 Por entretenimiento" }
    ]
  },
  {
    title: "¿Tu teléfono te escucha para ponerte publicidad?",
    category: "tecnologia",
    options: [
      { label: "📱👂 Sí, 100% seguro" },
      { label: "❌ No, son coincidencias" },
      { label: "🤔 Probablemente" }
    ]
  },
  {
    title: "¿La Inteligencia Artificial nos destruirá?",
    category: "tecnologia",
    options: [
      { label: "🤖💀 Sí, eventualmente" },
      { label: "🤝 No, nos ayudará" },
      { label: "⚠️ Depende de cómo la usemos" }
    ]
  },
  {
    title: "¿Te irías a vivir a Marte sin billete de vuelta?",
    category: "tecnologia",
    options: [
      { label: "🚀 Sí, sería histórico" },
      { label: "🌍 No, amo la Tierra" }
    ]
  },

  // ⚖️ Sociedad y Ética
  {
    title: "¿Si encuentras una cartera con 500€ y DNI, la devuelves con el dinero o te lo quedas?",
    category: "etica",
    options: [
      { label: "🙏 La devuelvo completa" },
      { label: "💰 Me quedo el dinero" },
      { label: "🤝 Devuelvo parte" }
    ]
  },
  {
    title: "¿Aceptarías un trabajo que odias por mucho dinero o uno que amas por poco?",
    category: "etica",
    options: [
      { label: "💰 Trabajo que odio, más dinero" },
      { label: "❤️ Trabajo que amo, menos dinero" }
    ]
  },
  {
    title: "¿Desconectarías el soporte vital de un familiar si fuera su voluntad?",
    category: "etica",
    options: [
      { label: "Sí, respetaría su voluntad" },
      { label: "No, no podría hacerlo" }
    ]
  },
  {
    title: "¿Pena de muerte: Sí o No?",
    category: "etica",
    options: [
      { label: "⚖️ Sí, para casos extremos" },
      { label: "❌ No, nunca" }
    ]
  },
  {
    title: "¿Legalizarías todas las drogas?",
    category: "etica",
    options: [
      { label: "✅ Sí, todas" },
      { label: "❌ No, ninguna más" },
      { label: "🤔 Solo algunas" }
    ]
  },
  {
    title: "¿El servicio militar debería ser obligatorio?",
    category: "etica",
    options: [
      { label: "🪖 Sí, debería serlo" },
      { label: "❌ No, debe ser voluntario" }
    ]
  },
  {
    title: "¿Tener hijos hoy en día es irresponsable?",
    category: "etica",
    options: [
      { label: "Sí, el mundo está muy mal" },
      { label: "No, es una decisión personal" }
    ]
  },
  {
    title: "¿El dinero compra la felicidad?",
    category: "etica",
    options: [
      { label: "💰😊 Sí, la compra" },
      { label: "❌ No, no la compra" },
      { label: "🤝 Ayuda pero no es todo" }
    ]
  },
  {
    title: "¿El ser humano es bueno o malo por naturaleza?",
    category: "etica",
    options: [
      { label: "😇 Bueno por naturaleza" },
      { label: "😈 Malo por naturaleza" },
      { label: "🤷 Neutral, depende" }
    ]
  },
  {
    title: "¿Prefieres ser respetado o ser amado?",
    category: "etica",
    options: [
      { label: "🤝 Respetado" },
      { label: "❤️ Amado" }
    ]
  },
  {
    title: "¿El fin justifica los medios?",
    category: "etica",
    options: [
      { label: "Sí, lo justifica" },
      { label: "No, nunca" },
      { label: "Depende del contexto" }
    ]
  },
  {
    title: "¿La cárcel rehabilita o solo castiga?",
    category: "etica",
    options: [
      { label: "🔄 Rehabilita" },
      { label: "⚖️ Solo castiga" },
      { label: "🤔 Depende del país/sistema" }
    ]
  },
  {
    title: "¿Prohibirías el tabaco totalmente?",
    category: "etica",
    options: [
      { label: "🚭 Sí, prohibirlo" },
      { label: "🚬 No, es decisión personal" }
    ]
  },
  {
    title: "¿El voto debería ser obligatorio?",
    category: "etica",
    options: [
      { label: "🗳️ Sí, obligatorio" },
      { label: "❌ No, debe ser voluntario" }
    ]
  },
  {
    title: "¿La sanidad debe ser 100% gratuita?",
    category: "etica",
    options: [
      { label: "🏥 Sí, 100% gratuita" },
      { label: "💰 No, mixta es mejor" }
    ]
  },
  {
    title: "¿Cerrarías todos los zoológicos?",
    category: "etica",
    options: [
      { label: "🦁 Sí, cerrarlos todos" },
      { label: "🐘 No, tienen valor educativo" },
      { label: "🤔 Solo los que maltratan" }
    ]
  },
  {
    title: "¿El matrimonio está pasado de moda?",
    category: "etica",
    options: [
      { label: "📜 Sí, está obsoleto" },
      { label: "💍 No, sigue siendo importante" }
    ]
  },
  {
    title: "¿Mentiras piadosas: Sí o No?",
    category: "etica",
    options: [
      { label: "✅ Sí, a veces son necesarias" },
      { label: "❌ No, siempre la verdad" }
    ]
  },

  // 📝 Preguntas para Encuestas Colaborativas (Rankings)
  {
    title: "¿Cuál es la mejor serie de TV de la historia?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Breaking Bad", imageUrl: "https://media.giphy.com/media/3oFzm0o2jMKftsaBoc/giphy.gif" },
      { label: "Game of Thrones", imageUrl: "https://media.giphy.com/media/l41YkFIiBxQdRlMnC/giphy.gif" },
      { label: "The Sopranos", imageUrl: "https://media.giphy.com/media/3o72FfM5HJydzafgUE/giphy.gif" },
      { label: "Friends", imageUrl: "https://media.giphy.com/media/TlK63ERYSGQsdqG04ew/giphy.gif" },
      { label: "The Wire", imageUrl: "https://media.giphy.com/media/iAYupOdWXQy5a4nVGk/giphy.gif" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Qué película te hizo llorar de verdad?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Titanic", imageUrl: "https://media.giphy.com/media/FoH28ucxZFJZu/giphy.gif" },
      { label: "Hachiko", imageUrl: "https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif" },
      { label: "Coco", imageUrl: "https://media.giphy.com/media/l0Iy4M0jO48PXSGOQ/giphy.gif" },
      { label: "El Rey León", imageUrl: "https://media.giphy.com/media/2WxWfiavndgcM/giphy.gif" },
      { label: "Forrest Gump", imageUrl: "https://media.giphy.com/media/11gC4odpiRKuha/giphy.gif" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿El mejor villano del cine de todos los tiempos?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Joker (Heath Ledger)", imageUrl: "https://media.giphy.com/media/ZCU3YxmmD8lh6savbB/giphy.gif" },
      { label: "Darth Vader", imageUrl: "https://media.giphy.com/media/l0IycQmt79g9XzOWQ/giphy.gif" },
      { label: "Hannibal Lecter", imageUrl: "https://media.giphy.com/media/MZ9nZGQn1nqBG/giphy.gif" },
      { label: "Thanos", imageUrl: "https://media.giphy.com/media/ie76dJeem4xBDcf83e/giphy.gif" },
      { label: "Voldemort", imageUrl: "https://media.giphy.com/media/720g7C1jz13wI/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El videojuego más adictivo que has jugado?",
    category: "gaming",
    type: "ranking",
    options: [
      { label: "Minecraft", imageUrl: "https://media.giphy.com/media/QNnKbtl03OGsM/giphy.gif" },
      { label: "Fortnite", imageUrl: "https://media.giphy.com/media/26n6ziTEeDDbRTNCU/giphy.gif" },
      { label: "GTA V", imageUrl: "https://media.giphy.com/media/xTiTnDAP0RiCo9k85W/giphy.gif" },
      { label: "League of Legends", imageUrl: "https://media.giphy.com/media/RLWwOuPbqObupogOLB/giphy.gif" },
      { label: "FIFA", imageUrl: "https://media.giphy.com/media/WnIu6vAWt5ul94URrQ/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿La mejor canción para cantar a gritos en el coche?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Bohemian Rhapsody - Queen", imageUrl: "https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J" },
      { label: "Don't Stop Believin' - Journey", imageUrl: "https://open.spotify.com/track/4bHsxqR3GMrXTxEPLuK5ue" },
      { label: "Sweet Caroline - Neil Diamond", imageUrl: "https://open.spotify.com/track/62AuGbAkt8Ox2IrFFb8GKV" },
      { label: "Livin' on a Prayer - Bon Jovi", imageUrl: "https://open.spotify.com/track/37ZJ0p5Jm13JPevGcx4SkF" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿El libro que te cambió la vida?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "El Principito" },
      { label: "1984" },
      { label: "Cien años de soledad" },
      { label: "Harry Potter" },
      { label: "El Alquimista" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Cuál es el plato más rico del mundo?",
    category: "comida",
    type: "ranking",
    options: [
      { label: "🍕 Pizza", imageUrl: "https://media.giphy.com/media/4ayiIWaq2VULC/giphy.gif" },
      { label: "🍔 Hamburguesa", imageUrl: "https://media.giphy.com/media/o5BzNDDFQnepi/giphy.gif" },
      { label: "🍣 Sushi", imageUrl: "https://media.giphy.com/media/uWzDsAsRm2X9qULHLs/giphy.gif" },
      { label: "🌮 Tacos", imageUrl: "https://media.giphy.com/media/dbd6jN0Atb9i8/giphy.gif" },
      { label: "🥘 Paella", imageUrl: "https://media.giphy.com/media/GdYxGcrWz1V9m/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El ingrediente que arruina cualquier comida?",
    category: "comida",
    type: "ranking",
    options: [
      { label: "Cilantro/Culantro" },
      { label: "Aceitunas" },
      { label: "Mayonesa" },
      { label: "Cebolla cruda" },
      { label: "Anchoas" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿La mejor marca de chocolate/dulces?",
    category: "comida",
    type: "ranking",
    options: [
      { label: "Lindt", imageUrl: "https://media.giphy.com/media/TFb5RADRaMiFq/giphy.gif" },
      { label: "Ferrero", imageUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExamlzdW4xbm9ubGk0OW9xaTZvd3VhN3Q4aHVrZ3hzbHpidGY5dDFzNiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gqUwHgXnTVVhS/giphy.gif" },
      { label: "Nestlé" },
      { label: "Cadbury" },
      { label: "Milka" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Tu sabor de helado favorito?",
    category: "comida",
    type: "ranking",
    options: [
      { label: "🍫 Chocolate", imageUrl: "https://media.giphy.com/media/HGe4zsOVo7Jvy/giphy.gif" },
      { label: "🍓 Fresa", imageUrl: "https://media.giphy.com/media/dWG4lOb6NyGKQ/giphy.gif" },
      { label: "🍦 Vainilla", imageUrl: "https://media.giphy.com/media/KZdaJU4SPaNzA3VPMF/giphy.gif" },
      { label: "🍋 Limón" },
      { label: "🥜 Turrón/Dulce de leche" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El país más bonito que has visitado?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "🇮🇹 Italia" },
      { label: "🇯🇵 Japón" },
      { label: "🇪🇸 España" },
      { label: "🇫🇷 Francia" },
      { label: "🇬🇷 Grecia" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿La ciudad ideal para vivir?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Barcelona" },
      { label: "Nueva York" },
      { label: "Tokio" },
      { label: "Londres" },
      { label: "Ámsterdam" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Lo primero que comprarías si ganaras la lotería?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "🏠 Una casa" },
      { label: "🚗 Un coche de lujo" },
      { label: "✈️ Un viaje" },
      { label: "💼 Invertir" },
      { label: "🎁 Regalos a familia" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿La palabra que más odias escuchar?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Moist (húmedo)" },
      { label: "Cringe" },
      { label: "Literalmente" },
      { label: "Osea" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿La tarea del hogar más insoportable?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "🧹 Fregar el suelo" },
      { label: "🍽️ Lavar platos" },
      { label: "👕 Planchar" },
      { label: "🛁 Limpiar el baño" },
      { label: "🛏️ Hacer la cama" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿La marca más sobrevalorada del mercado?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Apple" },
      { label: "Supreme" },
      { label: "Gucci" },
      { label: "Starbucks" },
      { label: "Tesla" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Lo que más te molesta que haga la gente en público?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "📱 Hablar alto por teléfono" },
      { label: "🎵 Poner música sin auriculares" },
      { label: "🍴 Comer ruidosamente" },
      { label: "🚶 Caminar lento en grupo" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El mejor deportista de todos los tiempos (GOAT)?",
    category: "deportes",
    type: "ranking",
    options: [
      { label: "Michael Jordan" },
      { label: "Messi" },
      { label: "Muhammad Ali" },
      { label: "Usain Bolt" },
      { label: "Serena Williams" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El famoso/a con el que te irías de fiesta?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Bad Bunny" },
      { label: "Rihanna" },
      { label: "The Rock" },
      { label: "Shakira" },
      { label: "Leonardo DiCaprio" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿El personaje histórico más influyente?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Jesús de Nazaret" },
      { label: "Albert Einstein" },
      { label: "Napoleón" },
      { label: "Julio César" },
      { label: "Isaac Newton" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Cuál es la mejor banda de Rock de la historia?",
    category: "musica",
    type: "ranking",
    options: [
      { label: "Queen", imageUrl: "https://media.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy.gif" },
      { label: "Led Zeppelin", imageUrl: "https://media.giphy.com/media/7FgYDPM6oMZBe/giphy.gif" },
      { label: "The Beatles", imageUrl: "https://media.giphy.com/media/ZBoVzR5k102XK/giphy.gif" },
      { label: "Pink Floyd", imageUrl: "https://media.giphy.com/media/l0HlFZ3c4NENSLQRi/giphy.gif" },
      { label: "AC/DC", imageUrl: "https://media.giphy.com/media/kHZC0lHGShttiTiOrL/giphy.gif" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Quién es el verdadero 'Rey' o 'Reina' del Pop?",
    category: "musica",
    type: "ranking",
    options: [
      { label: "Michael Jackson", imageUrl: "https://media.giphy.com/media/5xaOcLGm5vLdNZMrJi0/giphy.gif" },
      { label: "Madonna", imageUrl: "https://media.giphy.com/media/l3vRi0EtWE9RrFpDy/giphy.gif" },
      { label: "Beyoncé", imageUrl: "https://media.giphy.com/media/io4xAljOqFVAc/giphy.gif" },
      { label: "Taylor Swift", imageUrl: "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif" },
      { label: "Prince", imageUrl: "https://media.giphy.com/media/CiYImHHBivpAs/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Qué canción es un himno mundial que todos conocen?",
    category: "musica",
    type: "ranking",
    options: [
      { label: "Bohemian Rhapsody - Queen", imageUrl: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ" },
      { label: "Billie Jean - Michael Jackson", imageUrl: "https://www.youtube.com/watch?v=Zi_XLOBDo_Y" },
      { label: "Imagine - John Lennon", imageUrl: "https://www.youtube.com/watch?v=YkgkThdzX-8" },
      { label: "Despacito - Luis Fonsi", imageUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
      { label: "Happy Birthday" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Cuál es el mejor DJ de música electrónica?",
    category: "musica",
    type: "ranking",
    options: [
      { label: "David Guetta", imageUrl: "https://media.giphy.com/media/9JgeevTemXsy4/giphy.gif" },
      { label: "Calvin Harris", imageUrl: "https://media.giphy.com/media/MVDPX3gaKFPuo/giphy.gif" },
      { label: "Tiësto", imageUrl: "https://media.giphy.com/media/l0HlNcbVIbPVBSEYo/giphy.gif" },
      { label: "Martin Garrix", imageUrl: "https://media.giphy.com/media/l378rZAL9pV30cEcE/giphy.gif" },
      { label: "Avicii", imageUrl: "https://media.giphy.com/media/VBvvwbK0U42Yw/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Quién es el mejor rapero de todos los tiempos?",
    category: "musica",
    type: "ranking",
    options: [
      { label: "Eminem", imageUrl: "https://media.giphy.com/media/3o6Zt3PBAGPUvmvUdO/giphy.gif" },
      { label: "Tupac", imageUrl: "https://media.giphy.com/media/V6vNqIGP1RiME/giphy.gif" },
      { label: "Notorious B.I.G.", imageUrl: "https://media.giphy.com/media/tT52rUxClKfss/giphy.gif" },
      { label: "Jay-Z", imageUrl: "https://media.giphy.com/media/d7pyVYLKqMTPy/giphy.gif" },
      { label: "Kendrick Lamar", imageUrl: "https://media.giphy.com/media/l41lSR9xZubfd2Qve/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Cuál es el mejor Anime de la historia?",
    category: "cultura_pop",
    type: "ranking",
    options: [
      { label: "Dragon Ball", imageUrl: "https://media.giphy.com/media/tODXzxQaUMV2w/giphy.gif" },
      { label: "Naruto", imageUrl: "https://media.giphy.com/media/ohT1vVoz6S0JO/giphy.gif" },
      { label: "One Piece", imageUrl: "https://media.giphy.com/media/LUIvcbR6uj4dy/giphy.gif" },
      { label: "Death Note", imageUrl: "https://media.giphy.com/media/nZymwrrw9PjDa/giphy.gif" },
      { label: "Attack on Titan", imageUrl: "https://media.giphy.com/media/japdEFNPKRO9bPQfQa/giphy.gif" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Qué película está terriblemente sobrevalorada?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Avatar" },
      { label: "Titanic" },
      { label: "The Dark Knight" },
      { label: "Inception" },
      { label: "Endgame" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Cuál es la mejor serie original de Netflix/HBO?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Stranger Things" },
      { label: "The Crown" },
      { label: "Squid Game" },
      { label: "La Casa de Papel" },
      { label: "Chernobyl" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Quién es el mejor superhéroe de todos los tiempos?",
    category: "cultura_pop",
    type: "ranking",
    options: [
      { label: "Spider-Man" },
      { label: "Batman" },
      { label: "Superman" },
      { label: "Iron Man" },
      { label: "Wolverine" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Quién es el mejor Youtuber o Streamer del mundo?",
    category: "cultura_pop",
    type: "ranking",
    options: [
      { label: "MrBeast" },
      { label: "PewDiePie" },
      { label: "Ibai" },
      { label: "AuronPlay" },
      { label: "xQc" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Quién es la mujer más hermosa del mundo actualmente?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Margot Robbie" },
      { label: "Zendaya" },
      { label: "Ana de Armas" },
      { label: "Taylor Swift" },
      { label: "Scarlett Johansson" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Quién es el hombre más atractivo del mundo actualmente?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Chris Hemsworth" },
      { label: "Henry Cavill" },
      { label: "Timothée Chalamet" },
      { label: "Ryan Gosling" },
      { label: "Bad Bunny" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Qué famoso/a te cae peor?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Kim Kardashian" },
      { label: "Kanye West" },
      { label: "Logan Paul" },
      { label: "Elon Musk" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Cuál es el mejor meme de todos los tiempos?",
    category: "cultura_pop",
    type: "ranking",
    options: [
      { label: "Doge" },
      { label: "Rickroll" },
      { label: "Distracted Boyfriend" },
      { label: "Woman Yelling at Cat" },
      { label: "Drake Hotline Bling" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Cuál es la mejor marca de coches del mundo?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Mercedes-Benz" },
      { label: "BMW" },
      { label: "Ferrari" },
      { label: "Porsche" },
      { label: "Tesla" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Nike o Adidas?",
    category: "rankings",
    options: [
      { label: "Nike" },
      { label: "Adidas" }
    ]
  },
  {
    title: "¿Cuál es la raza de perro más bonita?",
    category: "rankings",
    type: "ranking",
    options: [
      { label: "Golden Retriever" },
      { label: "Husky Siberiano" },
      { label: "Labrador" },
      { label: "Pastor Alemán" },
      { label: "Bulldog Francés" },
      { label: "Otra (comentar)" }
    ]
  },
  {
    title: "¿Qué país tiene la mejor gastronomía del planeta?",
    category: "comida",
    type: "ranking",
    options: [
      { label: "🇮🇹 Italia" },
      { label: "🇲🇽 México" },
      { label: "🇯🇵 Japón" },
      { label: "🇪🇸 España" },
      { label: "🇫🇷 Francia" },
      { label: "Otro (comentar)" }
    ]
  },
  {
    title: "¿Qué aplicación no puede faltar en tu móvil?",
    category: "tecnologia",
    type: "ranking",
    options: [
      { label: "WhatsApp" },
      { label: "Instagram" },
      { label: "TikTok" },
      { label: "YouTube" },
      { label: "Spotify" },
      { label: "Otra (comentar)" }
    ]
  }
];

async function main() {
  console.log('🗑️ Eliminando todas las encuestas existentes...');
  
  // Eliminar en orden correcto por dependencias
  await prisma.voteHistory.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.pollInteraction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.pollHashtag.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  
  console.log('✅ Todas las encuestas eliminadas');
  
  // Buscar un usuario para asignar las encuestas (el primero que exista)
  let user = await prisma.user.findFirst();
  
  if (!user) {
    console.log('⚠️ No hay usuarios, creando usuario admin...');
    user = await prisma.user.create({
      data: {
        username: 'voutop_admin',
        email: 'admin@voutop.com',
        displayName: 'VouTop',
        role: 'admin',
        verified: true
      }
    });
  }
  
  console.log(`👤 Usando usuario: ${user.displayName} (ID: ${user.id})`);
  console.log(`📝 Creando ${polls.length} encuestas nuevas...`);
  
  let created = 0;
  
  for (const pollData of polls) {
    try {
      const poll = await prisma.poll.create({
        data: {
          userId: user.id,
          title: pollData.title,
          category: pollData.category,
          type: pollData.type || 'poll',
          status: 'active',
          options: {
            create: pollData.options.map((opt, index) => ({
              optionKey: `option_${index + 1}`,
              optionLabel: opt.label,
              color: getColor(index),
              displayOrder: index,
              imageUrl: opt.imageUrl || null
            }))
          }
        }
      });
      
      created++;
      if (created % 20 === 0) {
        console.log(`  ✓ ${created}/${polls.length} encuestas creadas...`);
      }
    } catch (error) {
      console.error(`❌ Error creando encuesta "${pollData.title}":`, error);
    }
  }
  
  console.log(`\n✅ ¡Listo! Se crearon ${created} encuestas nuevas.`);
  
  // Mostrar resumen por categoría
  const categories = await prisma.poll.groupBy({
    by: ['category'],
    _count: true
  });
  
  console.log('\n📊 Resumen por categoría:');
  for (const cat of categories) {
    console.log(`  - ${cat.category}: ${cat._count} encuestas`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
