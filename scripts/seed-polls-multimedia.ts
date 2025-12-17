import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF7F50', '#6B5B95', '#88B04B', '#F7CAC9'
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
  // 🏆 FANDOMS Y CULTURA POP
  {
    title: "¿Qué fandom es el más poderoso y leal del mundo ahora mismo?",
    category: "cultura_pop",
    options: [
      { label: "Swifties (Taylor Swift)", imageUrl: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02" },
      { label: "ARMY (BTS)", imageUrl: "https://open.spotify.com/artist/3Nrfpe0tUJi4K4DXYWgMUX" },
      { label: "BeyHive (Beyoncé)", imageUrl: "https://open.spotify.com/artist/6vWDO969PvNqNYHIOW5v0m" },
      { label: "Blinks (BLACKPINK)", imageUrl: "https://open.spotify.com/artist/41MozSoPIsD1dJM0CLPjZF" }
    ]
  },
  {
    title: "Si solo pudieras usar un sistema operativo el resto de tu vida, ¿cuál elegirías?",
    category: "tecnologia",
    options: [
      { label: "Android", imageUrl: "https://www.android.com/" },
      { label: "iOS", imageUrl: "https://www.apple.com/ios/" }
    ]
  },
  {
    title: "Solo puede quedar uno en la historia. ¿Quién es el verdadero GOAT del fútbol?",
    category: "deportes",
    options: [
      { label: "Messi", imageUrl: "https://www.instagram.com/leomessi/" },
      { label: "Cristiano Ronaldo", imageUrl: "https://www.instagram.com/cristiano/" },
      { label: "Pelé", imageUrl: "https://es.wikipedia.org/wiki/Pel%C3%A9" }
    ]
  },
  {
    title: "¿Qué tipo de persona eres? La batalla definitiva de mascotas",
    category: "lifestyle",
    options: [
      { label: "🐕 Perros", imageUrl: "https://es.wikipedia.org/wiki/Canis_familiaris" },
      { label: "🐈 Gatos", imageUrl: "https://es.wikipedia.org/wiki/Felis_silvestris_catus" }
    ]
  },
  {
    title: "Console Wars: Tienes presupuesto ilimitado pero solo puedes elegir UNA plataforma",
    category: "gaming",
    options: [
      { label: "PC Gaming", imageUrl: "https://store.steampowered.com/" },
      { label: "PlayStation 5", imageUrl: "https://www.playstation.com/es-es/ps5/" },
      { label: "Xbox Series X", imageUrl: "https://www.xbox.com/es-ES/consoles/xbox-series-x" },
      { label: "Nintendo Switch", imageUrl: "https://www.nintendo.es/Hardware/Familia-Nintendo-Switch/Nintendo-Switch/Nintendo-Switch-702021.html" }
    ]
  },
  {
    title: "¿Marvel o DC?",
    category: "cultura_pop",
    options: [
      { label: "Marvel", imageUrl: "https://www.marvel.com/" },
      { label: "DC", imageUrl: "https://www.dc.com/" }
    ]
  },
  {
    title: "¿Harry Potter está sobrevalorado?",
    category: "cultura_pop",
    options: [
      { label: "Sí, está sobrevalorado", imageUrl: "https://www.imdb.com/title/tt0241527/" },
      { label: "No, es una obra maestra", imageUrl: "https://www.wizardingworld.com/" }
    ]
  },
  {
    title: "FIFA vs. Call of Duty: Si solo pudieras jugar una franquicia el resto de tu vida",
    category: "gaming",
    options: [
      { label: "FIFA / EA Sports FC", imageUrl: "https://www.ea.com/games/ea-sports-fc" },
      { label: "Call of Duty", imageUrl: "https://www.callofduty.com/" }
    ]
  },

  // 🍔 COMIDA Y DEBATES TRIVIALES
  {
    title: "La pizza con piña (Hawaiana): ¿Delicia incomprendida o crimen culinario?",
    category: "comida",
    options: [
      { label: "🍕🍍 Delicia incomprendida", imageUrl: "https://es.wikipedia.org/wiki/Pizza_hawaiana" },
      { label: "🚫 Crimen culinario", imageUrl: "https://www.reddit.com/r/KnightsOfPineapple/" }
    ]
  },
  {
    title: "¿El cereal va antes o después de la leche?",
    category: "comida",
    options: [
      { label: "🥣 Cereal primero", imageUrl: "https://www.reddit.com/r/CerealFirst/" },
      { label: "🥛 Leche primero", imageUrl: "https://www.reddit.com/r/MilkFirst/" }
    ]
  },
  {
    title: "¿Te lavas 'activamente' las piernas en la ducha o dejas que el agua caiga sola?",
    category: "lifestyle",
    options: [
      { label: "Las lavo activamente", imageUrl: "https://www.reddit.com/r/DoesAnybodyElse/" },
      { label: "El agua y el jabón caen solos", imageUrl: "https://twitter.com/search?q=wash%20legs" }
    ]
  },
  {
    title: "¿Duermes con la puerta de la habitación abierta o cerrada?",
    category: "lifestyle",
    options: [
      { label: "🚪 Abierta", imageUrl: "https://www.sleepfoundation.org/" },
      { label: "🔒 Cerrada", imageUrl: "https://www.reddit.com/r/sleep/" }
    ]
  },
  {
    title: "La tortilla de patata: ¿Con cebolla o sin cebolla?",
    category: "comida",
    options: [
      { label: "🧅 CON cebolla", imageUrl: "https://www.youtube.com/watch?v=q-HXdkO5BgI" },
      { label: "❌ SIN cebolla", imageUrl: "https://es.wikipedia.org/wiki/Tortilla_de_patatas" }
    ]
  },
  {
    title: "¿Es un Hot Dog un sándwich?",
    category: "comida",
    options: [
      { label: "Sí, es un sándwich", imageUrl: "https://es.wikipedia.org/wiki/S%C3%A1ndwich" },
      { label: "No, es otra cosa", imageUrl: "https://es.wikipedia.org/wiki/Perrito_caliente" }
    ]
  },
  {
    title: "¿El papel higiénico se coloca con la hoja hacia afuera o pegada a la pared?",
    category: "lifestyle",
    options: [
      { label: "➡️ Hacia afuera", imageUrl: "https://es.wikipedia.org/wiki/Papel_higi%C3%A9nico#Orientaci%C3%B3n" },
      { label: "⬅️ Pegada a la pared", imageUrl: "https://www.reddit.com/r/mildlyinfuriating/" }
    ]
  },
  {
    title: "¿La pizza se come con la mano o con cubiertos?",
    category: "comida",
    options: [
      { label: "🤚 Con la mano", imageUrl: "https://es.wikipedia.org/wiki/Pizza" },
      { label: "🍴 Con cubiertos", imageUrl: "https://www.pizzahut.com/" }
    ]
  },

  // 🧠 DILEMAS PSICOLÓGICOS
  {
    title: "¿Preferirías recibir 1 millón ahora o tener un 50% de posibilidades de recibir 100 millones?",
    category: "dilemas",
    options: [
      { label: "💰 1 millón seguro", imageUrl: "https://es.wikipedia.org/wiki/Aversi%C3%B3n_al_riesgo" },
      { label: "🎰 50% de 100 millones", imageUrl: "https://es.wikipedia.org/wiki/Teor%C3%ADa_de_juegos" }
    ]
  },
  {
    title: "Tienes un botón rojo (10M €) y uno azul (Volver a los 10 años sabiendo todo). ¿Cuál pulsas?",
    category: "dilemas",
    options: [
      { label: "🔴 10 millones de euros", imageUrl: "https://es.wikipedia.org/wiki/Libertad_financiera" },
      { label: "🔵 Volver a los 10 años", imageUrl: "https://es.wikipedia.org/wiki/Viaje_en_el_tiempo" }
    ]
  },
  {
    title: "Si pudieras saber la fecha exacta y la causa de tu muerte, ¿querrías saberlo?",
    category: "dilemas",
    options: [
      { label: "Sí, quiero saberlo", imageUrl: "https://es.wikipedia.org/wiki/Destino" },
      { label: "No, prefiero no saberlo", imageUrl: "https://es.wikipedia.org/wiki/Incertidumbre" }
    ]
  },
  {
    title: "¿Preferirías ser la persona más inteligente del mundo pero muy fea, o la más atractiva pero muy tonta?",
    category: "dilemas",
    options: [
      { label: "🧠 Inteligente pero feo/a", imageUrl: "https://es.wikipedia.org/wiki/Inteligencia" },
      { label: "✨ Atractivo/a pero tonto/a", imageUrl: "https://es.wikipedia.org/wiki/Atractivo_f%C3%ADsico" }
    ]
  },
  {
    title: "Tienes que eliminar uno para siempre: ¿Música o Películas/Series?",
    category: "dilemas",
    options: [
      { label: "🎵 Eliminar música", imageUrl: "https://open.spotify.com/" },
      { label: "🎬 Eliminar películas/series", imageUrl: "https://www.netflix.com/" }
    ]
  },
  {
    title: "¿Vivirías un año sin Internet ni móvil a cambio de 500.000 €?",
    category: "dilemas",
    options: [
      { label: "💰 Sí, acepto", imageUrl: "https://es.wikipedia.org/wiki/Desintoxicaci%C3%B3n_digital" },
      { label: "📱 No, imposible", imageUrl: "https://es.wikipedia.org/wiki/Adicci%C3%B3n_a_Internet" }
    ]
  },
  {
    title: "¿Hablar todos los idiomas del mundo o hablar con los animales?",
    category: "dilemas",
    options: [
      { label: "🌍 Todos los idiomas", imageUrl: "https://es.wikipedia.org/wiki/Poliglot%C3%ADa" },
      { label: "🐾 Hablar con animales", imageUrl: "https://es.wikipedia.org/wiki/Comunicaci%C3%B3n_animal" }
    ]
  },
  {
    title: "¿Viajar al pasado para corregir un error o al futuro para ver tu vida?",
    category: "dilemas",
    options: [
      { label: "⏪ Al pasado", imageUrl: "https://es.wikipedia.org/wiki/Viaje_en_el_tiempo" },
      { label: "⏩ Al futuro", imageUrl: "https://es.wikipedia.org/wiki/Futurolog%C3%ADa" }
    ]
  },
  {
    title: "¿Equipo 'Madrugar' o Equipo 'Nocturno'?",
    category: "lifestyle",
    options: [
      { label: "🌅 Equipo Madrugar", imageUrl: "https://es.wikipedia.org/wiki/Cronotipo" },
      { label: "🌙 Equipo Nocturno", imageUrl: "https://es.wikipedia.org/wiki/Nocturnidad" }
    ]
  },
  {
    title: "¿Preferirías calor extremo o frío extremo?",
    category: "dilemas",
    options: [
      { label: "🔥 Calor extremo", imageUrl: "https://es.wikipedia.org/wiki/Golpe_de_calor" },
      { label: "❄️ Frío extremo", imageUrl: "https://es.wikipedia.org/wiki/Hipotermia" }
    ]
  },
  {
    title: "Si pudieras ser invisible por 24 horas, ¿harías algo ilegal?",
    category: "dilemas",
    options: [
      { label: "😈 Probablemente sí", imageUrl: "https://es.wikipedia.org/wiki/Invisibilidad" },
      { label: "😇 No, sería legal", imageUrl: "https://es.wikipedia.org/wiki/%C3%89tica" }
    ]
  },
  {
    title: "¿Saberlo todo o ser feliz?",
    category: "dilemas",
    options: [
      { label: "🧠 Saberlo todo", imageUrl: "https://es.wikipedia.org/wiki/Omnisciencia" },
      { label: "😊 Ser feliz", imageUrl: "https://es.wikipedia.org/wiki/Felicidad" }
    ]
  },
  {
    title: "¿Amor eterno o ganar la Lotería?",
    category: "dilemas",
    options: [
      { label: "❤️ Amor eterno", imageUrl: "https://es.wikipedia.org/wiki/Amor" },
      { label: "💰 Ganar la Lotería", imageUrl: "https://es.wikipedia.org/wiki/Loter%C3%ADa" }
    ]
  },
  {
    title: "¿Seguirías trabajando si fueras asquerosamente rico?",
    category: "dilemas",
    options: [
      { label: "Sí, seguiría trabajando", imageUrl: "https://es.wikipedia.org/wiki/Trabajo_(sociolog%C3%ADa)" },
      { label: "No, dejaría de trabajar", imageUrl: "https://es.wikipedia.org/wiki/Jubilaci%C3%B3n" }
    ]
  },
  {
    title: "¿Preferirías ser la persona más rica del cementerio o vivir 100 años siendo pobre?",
    category: "dilemas",
    options: [
      { label: "💰⚰️ Rico en el cementerio", imageUrl: "https://es.wikipedia.org/wiki/Riqueza" },
      { label: "👴💸 100 años siendo pobre", imageUrl: "https://es.wikipedia.org/wiki/Longevidad" }
    ]
  },

  // ❤️ AMOR Y RELACIONES
  {
    title: "Sé sincero: ¿Revisarías el móvil de tu pareja si supieras 100% que no se va a enterar?",
    category: "relaciones",
    options: [
      { label: "👀 Sí, lo revisaría", imageUrl: "https://es.wikipedia.org/wiki/Privacidad" },
      { label: "🙅 No, respeto su privacidad", imageUrl: "https://es.wikipedia.org/wiki/Confianza" }
    ]
  },
  {
    title: "En una primera cita, ¿quién debe pagar la cuenta hoy en día?",
    category: "relaciones",
    options: [
      { label: "👨 El hombre", imageUrl: "https://es.wikipedia.org/wiki/Caballerosidad" },
      { label: "👩 La mujer", imageUrl: "https://es.wikipedia.org/wiki/Feminismo" },
      { label: "💑 A medias", imageUrl: "https://es.wikipedia.org/wiki/Igualdad_de_g%C3%A9nero" },
      { label: "🎲 Quien invitó", imageUrl: "https://es.wikipedia.org/wiki/Etiqueta_(sociolog%C3%ADa)" }
    ]
  },
  {
    title: "¿Perdonarías una infidelidad si te aseguran que fue solo una vez?",
    category: "relaciones",
    options: [
      { label: "Sí, perdonaría", imageUrl: "https://es.wikipedia.org/wiki/Perd%C3%B3n" },
      { label: "No, nunca", imageUrl: "https://es.wikipedia.org/wiki/Infidelidad" },
      { label: "Depende de las circunstancias", imageUrl: "https://es.wikipedia.org/wiki/Relaci%C3%B3n_de_pareja" }
    ]
  },
  {
    title: "¿Existe la amistad verdadera entre hombre y mujer heterosexuales sin tensión sexual?",
    category: "relaciones",
    options: [
      { label: "Sí, totalmente posible", imageUrl: "https://es.wikipedia.org/wiki/Amistad" },
      { label: "No, siempre hay tensión", imageUrl: "https://es.wikipedia.org/wiki/Tensi%C3%B3n_sexual" },
      { label: "Depende de las personas", imageUrl: "https://es.wikipedia.org/wiki/Relaci%C3%B3n_interpersonal" }
    ]
  },
  {
    title: "El 'Ghosting': ¿Crueldad o forma válida de terminar?",
    category: "relaciones",
    options: [
      { label: "👻 Crueldad total", imageUrl: "https://es.wikipedia.org/wiki/Ghosting" },
      { label: "✅ A veces es válido", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Le darías tu contraseña del móvil a tu pareja ahora mismo sin miedo?",
    category: "relaciones",
    options: [
      { label: "🔓 Sí, sin problema", imageUrl: "https://es.wikipedia.org/wiki/Transparencia" },
      { label: "🔒 No, es mi privacidad", imageUrl: "https://es.wikipedia.org/wiki/Privacidad" }
    ]
  },
  {
    title: "¿Volverías con tu ex si te garantizan que esta vez funcionará?",
    category: "relaciones",
    options: [
      { label: "Sí, volvería", imageUrl: "https://es.wikipedia.org/wiki/Reconciliaci%C3%B3n" },
      { label: "No, nunca", imageUrl: "https://es.wikipedia.org/wiki/Ruptura_amorosa" },
      { label: "Depende de cuál ex", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Es aceptable 'stalkear' las redes sociales de alguien antes de la primera cita?",
    category: "relaciones",
    options: [
      { label: "🔍 Totalmente aceptable", imageUrl: "https://es.wikipedia.org/wiki/Ciberacoso" },
      { label: "❌ Es raro/invasivo", imageUrl: "https://es.wikipedia.org/wiki/Privacidad_en_Internet" }
    ]
  },
  {
    title: "Sé brutalmente honesto: ¿El tamaño importa?",
    category: "relaciones",
    options: [
      { label: "Sí, importa", imageUrl: "https://es.wikipedia.org/wiki/Sexualidad_humana" },
      { label: "No, no importa", imageUrl: "https://www.healthline.com/" },
      { label: "Importa pero no es lo principal", imageUrl: "https://www.webmd.com/" }
    ]
  },
  {
    title: "Sexo en la primera cita: ¿Sí o No?",
    category: "relaciones",
    options: [
      { label: "✅ Sí, si hay conexión", imageUrl: "https://es.wikipedia.org/wiki/Cita_(encuentro_rom%C3%A1ntico)" },
      { label: "❌ No, es muy pronto", imageUrl: "https://www.cosmopolitan.com/" }
    ]
  },
  {
    title: "¿Qué miras primero instintivamente: Cara o Cuerpo?",
    category: "relaciones",
    options: [
      { label: "😊 La cara", imageUrl: "https://es.wikipedia.org/wiki/Rostro_humano" },
      { label: "💪 El cuerpo", imageUrl: "https://es.wikipedia.org/wiki/Atractivo_f%C3%ADsico" }
    ]
  },
  {
    title: "¿Te atrae más la actitud de 'chico/a malo' o 'buena persona'?",
    category: "relaciones",
    options: [
      { label: "😈 Chico/a malo", imageUrl: "https://es.wikipedia.org/wiki/Chico_malo" },
      { label: "😇 Buena persona", imageUrl: "https://es.wikipedia.org/wiki/Bondad" }
    ]
  },
  {
    title: "¿Crees que el ser humano es monógamo por naturaleza?",
    category: "relaciones",
    options: [
      { label: "Sí, somos monógamos", imageUrl: "https://es.wikipedia.org/wiki/Monogamia" },
      { label: "No, es cultural", imageUrl: "https://es.wikipedia.org/wiki/Poligamia" }
    ]
  },
  {
    title: "¿Consideras que ver pornografía estando en pareja es infidelidad?",
    category: "relaciones",
    options: [
      { label: "Sí, es infidelidad", imageUrl: "https://es.wikipedia.org/wiki/Infidelidad" },
      { label: "No, es normal", imageUrl: "https://www.psychologytoday.com/" },
      { label: "Depende del contexto", imageUrl: "https://es.wikipedia.org/wiki/Relaci%C3%B3n_de_pareja" }
    ]
  },
  {
    title: "¿Te has enamorado alguna vez de alguien 'prohibido'?",
    category: "relaciones",
    options: [
      { label: "💔 Sí, me ha pasado", imageUrl: "https://es.wikipedia.org/wiki/Amor_prohibido" },
      { label: "😇 No, nunca", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿El 'Micro-cheating' (likes en redes, tonteo) cuenta como cuernos?",
    category: "relaciones",
    options: [
      { label: "Sí, es infidelidad", imageUrl: "https://es.wikipedia.org/wiki/Infidelidad" },
      { label: "No, es inofensivo", imageUrl: "https://www.cosmopolitan.com/" },
      { label: "Depende del grado", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Tendrías una relación abierta si tu pareja te lo pide?",
    category: "relaciones",
    options: [
      { label: "✅ Sí, lo intentaría", imageUrl: "https://es.wikipedia.org/wiki/Relaci%C3%B3n_abierta" },
      { label: "❌ No, nunca", imageUrl: "https://es.wikipedia.org/wiki/Monogamia" },
      { label: "🤔 Lo pensaría", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Alguna vez has fingido un orgasmo?",
    category: "relaciones",
    options: [
      { label: "🎭 Sí, alguna vez", imageUrl: "https://www.healthline.com/" },
      { label: "😏 No, nunca", imageUrl: "https://www.webmd.com/" }
    ]
  },
  {
    title: "¿Te has imaginado a otra persona mientras tenías relaciones con tu pareja?",
    category: "relaciones",
    options: [
      { label: "🙈 Sí, me ha pasado", imageUrl: "https://www.psychologytoday.com/" },
      { label: "❌ No, nunca", imageUrl: "https://www.cosmopolitan.com/" }
    ]
  },
  {
    title: "El 'Body Count' (número de parejas pasadas): ¿Te importa o da igual?",
    category: "relaciones",
    options: [
      { label: "📊 Sí, me importa", imageUrl: "https://www.reddit.com/r/relationship_advice/" },
      { label: "🤷 Me da igual", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Te liarías con el ex de tu mejor amigo/a si nadie se entera?",
    category: "relaciones",
    options: [
      { label: "😈 Probablemente sí", imageUrl: "https://www.reddit.com/r/AmItheAsshole/" },
      { label: "🙅 Jamás", imageUrl: "https://es.wikipedia.org/wiki/Lealtad" }
    ]
  },
  {
    title: "¿Aceptarías una proposición indecente (sexo por 100.000€)?",
    category: "relaciones",
    options: [
      { label: "💰 Sí, lo haría", imageUrl: "https://www.imdb.com/title/tt0107211/" },
      { label: "❌ No, nunca", imageUrl: "https://es.wikipedia.org/wiki/%C3%89tica" },
      { label: "🤔 Dependería de quién", imageUrl: "https://www.psychologytoday.com/" }
    ]
  },
  {
    title: "¿Mañanero o Nocturno? (para el sexo)",
    category: "relaciones",
    options: [
      { label: "🌅 Mañanero", imageUrl: "https://www.healthline.com/" },
      { label: "🌙 Nocturno", imageUrl: "https://www.webmd.com/" },
      { label: "🤷 Cualquier hora", imageUrl: "https://www.cosmopolitan.com/" }
    ]
  },

  // 💀 DILEMAS EXTREMOS
  {
    title: "Incendio: ¿Salvas a tu Madre/Padre o a tu Pareja?",
    category: "dilemas_extremos",
    options: [
      { label: "👨‍👩‍👧 Madre/Padre", imageUrl: "https://es.wikipedia.org/wiki/Familia" },
      { label: "💑 Pareja", imageUrl: "https://es.wikipedia.org/wiki/Amor" }
    ]
  },
  {
    title: "Barco hundiéndose: ¿Salvas a tu perro o a un desconocido humano?",
    category: "dilemas_extremos",
    options: [
      { label: "🐕 Mi perro", imageUrl: "https://es.wikipedia.org/wiki/Mascota" },
      { label: "👤 El desconocido", imageUrl: "https://es.wikipedia.org/wiki/%C3%89tica" }
    ]
  },
  {
    title: "¿A quién salvas? ¿A un niño de 5 años o a un científico que curará el cáncer?",
    category: "dilemas_extremos",
    options: [
      { label: "👶 Al niño", imageUrl: "https://es.wikipedia.org/wiki/Infancia" },
      { label: "🔬 Al científico", imageUrl: "https://es.wikipedia.org/wiki/Utilitarismo" }
    ]
  },
  {
    title: "¿Matarías a un dictador genocida cuando era un bebé inocente?",
    category: "dilemas_extremos",
    options: [
      { label: "Sí, salvaría millones", imageUrl: "https://es.wikipedia.org/wiki/Paradoja_de_Hitler" },
      { label: "No, es un bebé inocente", imageUrl: "https://es.wikipedia.org/wiki/Deontolog%C3%ADa" }
    ]
  },
  {
    title: "Accidente: ¿Salvas a 1 bebé o a 5 ancianos?",
    category: "dilemas_extremos",
    options: [
      { label: "👶 1 bebé",  },
      { label: "👴 5 ancianos"}
    ]
  },
  {
    title: "¿Preferirías morir quemado o ahogado?",
    category: "dilemas_extremos",
    options: [
      { label: "🔥 Quemado", imageUrl: "https://es.wikipedia.org/wiki/Quemadura" },
      { label: "🌊 Ahogado", imageUrl: "https://es.wikipedia.org/wiki/Ahogamiento" }
    ]
  },
  {
    title: "¿Perder las dos manos o perder la vista?",
    category: "dilemas_extremos",
    options: [
      { label: "✋ Perder las manos", imageUrl: "https://es.wikipedia.org/wiki/Amputaci%C3%B3n" },
      { label: "👁️ Perder la vista", imageUrl: "https://es.wikipedia.org/wiki/Ceguera" }
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
      { label: "⚰️ Enterrado vivo", imageUrl: "https://es.wikipedia.org/wiki/Tafofobia" },
      { label: "🚀 Lanzado al espacio", imageUrl: "https://es.wikipedia.org/wiki/Exposici%C3%B3n_al_vac%C3%ADo" }
    ]
  },
  {
    title: "Te dan 10 Millones pero muere alguien al azar en el mundo. ¿Pulsas el botón?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, lo pulso", imageUrl: "https://es.wikipedia.org/wiki/Dilema_%C3%A9tico" },
      { label: "❌ No, nunca", imageUrl: "https://es.wikipedia.org/wiki/Imperativo_categ%C3%B3rico" }
    ]
  },
  {
    title: "¿Venderías 10 años de tu vida a cambio de ser multimillonario ahora?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, los vendo", imageUrl: "https://es.wikipedia.org/wiki/Materialismo" },
      { label: "⏰ No, prefiero vivir más", imageUrl: "https://es.wikipedia.org/wiki/Esperanza_de_vida" }
    ]
  },
  {
    title: "¿Preferirías ser inmortal viendo morir a todos o morir mañana sin dolor?",
    category: "dilemas_extremos",
    options: [
      { label: "♾️ Ser inmortal", imageUrl: "https://es.wikipedia.org/wiki/Inmortalidad" },
      { label: "😴 Morir mañana sin dolor", imageUrl: "https://es.wikipedia.org/wiki/Eutanasia" }
    ]
  },
  {
    title: "Tienes que elegir AHORA: ¿Tu historial de internet PÚBLICO o perder un dedo?",
    category: "dilemas_extremos",
    options: [
      { label: "🌐 Historial público", imageUrl: "https://es.wikipedia.org/wiki/Privacidad_en_Internet" },
      { label: "✋ Perder un dedo", imageUrl: "https://es.wikipedia.org/wiki/Amputaci%C3%B3n" }
    ]
  },
  {
    title: "¿Venderías a tu mascota por 1 Millón de euros?",
    category: "dilemas_extremos",
    options: [
      { label: "💰 Sí, la vendería", imageUrl: "https://es.wikipedia.org/wiki/Materialismo" },
      { label: "🐾 Jamás", imageUrl: "https://es.wikipedia.org/wiki/V%C3%ADnculo_humano-animal" }
    ]
  },
  {
    title: "¿Preferirías ser asesinado o ser el asesino (por accidente) y vivir con la culpa?",
    category: "dilemas_extremos",
    options: [
      { label: "💀 Ser asesinado", imageUrl: "https://es.wikipedia.org/wiki/Muerte" },
      { label: "😰 Ser el asesino accidental", imageUrl: "https://es.wikipedia.org/wiki/Culpa_(emoci%C3%B3n)" }
    ]
  },
  {
    title: "¿Preferirías morir tú ahora o que muera el 50% de la población mundial al azar?",
    category: "dilemas_extremos",
    options: [
      { label: "🙋 Morir yo ahora", imageUrl: "https://es.wikipedia.org/wiki/Altruismo" },
      { label: "🌍 El 50% de la población", imageUrl: "https://es.wikipedia.org/wiki/Thanos" }
    ]
  },
  {
    title: "¿No poder hablar nunca más o no poder escuchar nunca más?",
    category: "dilemas_extremos",
    options: [
      { label: "🤐 No poder hablar", imageUrl: "https://es.wikipedia.org/wiki/Mutismo" },
      { label: "🔇 No poder escuchar", imageUrl: "https://es.wikipedia.org/wiki/Sordera" }
    ]
  },
  {
    title: "¿Comer carne humana o morir de hambre?",
    category: "dilemas_extremos",
    options: [
      { label: "🍖 Comer carne humana", imageUrl: "https://es.wikipedia.org/wiki/Canibalismo" },
      { label: "💀 Morir de hambre", imageUrl: "https://es.wikipedia.org/wiki/Inanici%C3%B3n" }
    ]
  },
  {
    title: "¿Preferirías encontrar el cadáver de tu pareja o que tu pareja encuentre el tuyo?",
    category: "dilemas_extremos",
    options: [
      { label: "😢 Encontrar el suyo", imageUrl: "https://es.wikipedia.org/wiki/Duelo_(psicolog%C3%ADa)" },
      { label: "⚰️ Que encuentre el mío", imageUrl: "https://es.wikipedia.org/wiki/Muerte" }
    ]
  },

  // 👽 EXISTENCIALISMO Y CREENCIAS
  {
    title: "En 5 años, ¿crees que una IA hará tu trabajo mejor que tú?",
    category: "tecnologia",
    options: [
      { label: "🤖 Sí, probablemente", imageUrl: "https://www.youtube.com/watch?v=aircAruvnKk" },
      { label: "👤 No, mi trabajo es seguro", imageUrl: "https://es.wikipedia.org/wiki/Empleo" },
      { label: "🤔 Parcialmente", imageUrl: "https://es.wikipedia.org/wiki/Automatizaci%C3%B3n" }
    ]
  },
  {
    title: "¿Estamos solos en el universo o el gobierno oculta a los aliens?",
    category: "creencias",
    options: [
      { label: "👽 Hay aliens y lo ocultan", imageUrl: "https://www.youtube.com/watch?v=b6WPoPHkCYk" },
      { label: "🌌 Estamos solos", imageUrl: "https://es.wikipedia.org/wiki/Paradoja_de_Fermi" },
      { label: "❓ Hay vida pero no nos visitan", imageUrl: "https://es.wikipedia.org/wiki/Vida_extraterrestre" }
    ]
  },
  {
    title: "¿Crees que vivimos en una simulación (Matrix)?",
    category: "creencias",
    options: [
      { label: "🔴 Sí, es posible", imageUrl: "https://www.youtube.com/watch?v=m8e-FF8MsqU" },
      { label: "🔵 No, esto es real", imageUrl: "https://es.wikipedia.org/wiki/Realidad" }
    ]
  },
  {
    title: "¿Aceptarías implantarte un chip en el cerebro para aprender habilidades?",
    category: "tecnologia",
    options: [
      { label: "🧠 Sí, sin dudarlo", imageUrl: "https://www.youtube.com/watch?v=Gqdo57uky4o" },
      { label: "❌ No, es peligroso", imageUrl: "https://es.wikipedia.org/wiki/Bio%C3%A9tica" },
      { label: "🤔 Depende de los riesgos", imageUrl: "https://neuralink.com/" }
    ]
  },
  {
    title: "¿Existe Dios?",
    category: "creencias",
    options: [
      { label: "✝️ Sí, existe", imageUrl: "https://es.wikipedia.org/wiki/Te%C3%ADsmo" },
      { label: "❌ No existe", imageUrl: "https://es.wikipedia.org/wiki/Ate%C3%ADsmo" },
      { label: "🤷 No lo sé / Agnóstico", imageUrl: "https://es.wikipedia.org/wiki/Agnosticismo" }
    ]
  },
  {
    title: "¿Crees en la vida después de la muerte?",
    category: "creencias",
    options: [
      { label: "👼 Sí, hay algo más", imageUrl: "https://es.wikipedia.org/wiki/Vida_despu%C3%A9s_de_la_muerte" },
      { label: "💀 No, todo termina", imageUrl: "https://es.wikipedia.org/wiki/Materialismo" },
      { label: "🤔 No estoy seguro", imageUrl: "https://es.wikipedia.org/wiki/Agnosticismo" }
    ]
  },
  {
    title: "¿Crees en el Karma?",
    category: "creencias",
    options: [
      { label: "☯️ Sí, lo que das vuelve", imageUrl: "https://es.wikipedia.org/wiki/Karma" },
      { label: "❌ No, es coincidencia", imageUrl: "https://es.wikipedia.org/wiki/Sesgo_de_confirmaci%C3%B3n" }
    ]
  },
  {
    title: "¿Existe el destino o lo creamos nosotros?",
    category: "creencias",
    options: [
      { label: "🔮 Existe el destino", imageUrl: "https://es.wikipedia.org/wiki/Determinismo" },
      { label: "✊ Lo creamos nosotros", imageUrl: "https://es.wikipedia.org/wiki/Libre_albedr%C3%ADo" },
      { label: "🤝 Un poco de ambos", imageUrl: "https://es.wikipedia.org/wiki/Compatibilismo" }
    ]
  },
  {
    title: "¿Crees que el hombre llegó a la Luna o fue un montaje?",
    category: "creencias",
    options: [
      { label: "🌙 Sí llegamos", imageUrl: "https://www.youtube.com/watch?v=S9HdPi9Ikhk" },
      { label: "🎬 Fue un montaje", imageUrl: "https://es.wikipedia.org/wiki/Teor%C3%ADa_de_conspiraci%C3%B3n_del_alunizaje" }
    ]
  },
  {
    title: "¿Crees en el horóscopo y la astrología?",
    category: "creencias",
    options: [
      { label: "♈ Sí, totalmente", imageUrl: "https://es.wikipedia.org/wiki/Astrolog%C3%ADa" },
      { label: "❌ No, es falso", imageUrl: "https://es.wikipedia.org/wiki/Pseudociencia" },
      { label: "🤔 Algo de verdad hay", imageUrl: "https://es.wikipedia.org/wiki/Efecto_Barnum" }
    ]
  },
  {
    title: "¿Tu teléfono te escucha para ponerte publicidad?",
    category: "tecnologia",
    options: [
      { label: "📱👂 Sí, 100% seguro", imageUrl: "https://es.wikipedia.org/wiki/Publicidad_dirigida" },
      { label: "❌ No, son coincidencias", imageUrl: "https://es.wikipedia.org/wiki/Sesgo_de_confirmaci%C3%B3n" },
      { label: "🤔 Probablemente", imageUrl: "https://es.wikipedia.org/wiki/Privacidad" }
    ]
  },
  {
    title: "¿La Inteligencia Artificial nos destruirá?",
    category: "tecnologia",
    options: [
      { label: "🤖💀 Sí, eventualmente", imageUrl: "https://www.youtube.com/watch?v=5qap5aO4i9A" },
      { label: "🤝 No, nos ayudará", imageUrl: "https://tenor.com/search/ai-robot-gifs" },
      { label: "⚠️ Depende de cómo la usemos", imageUrl: "https://tenor.com/search/thinking-gifs" }
    ]
  },
  {
    title: "¿Te irías a vivir a Marte sin billete de vuelta?",
    category: "tecnologia",
    options: [
      { label: "🚀 Sí, sería histórico", imageUrl: "https://www.youtube.com/watch?v=tdUX3ypDVwI" },
      { label: "🌍 No, amo la Tierra", imageUrl: "https://tenor.com/search/earth-love-gifs" }
    ]
  },

  // ⚖️ SOCIEDAD Y ÉTICA
  {
    title: "¿Si encuentras una cartera con 500€ y DNI, la devuelves con el dinero?",
    category: "etica",
    options: [
      { label: "🙏 La devuelvo completa", imageUrl: "https://tenor.com/search/honest-gifs" },
      { label: "💰 Me quedo el dinero", imageUrl: "https://tenor.com/search/money-gifs" },
      { label: "🤝 Devuelvo parte", imageUrl: "https://tenor.com/search/sharing-gifs" }
    ]
  },
  {
    title: "¿Aceptarías un trabajo que odias por mucho dinero o uno que amas por poco?",
    category: "etica",
    options: [
      { label: "💰 Trabajo que odio, más dinero", imageUrl: "https://tenor.com/search/money-rain-gifs" },
      { label: "❤️ Trabajo que amo, menos dinero", imageUrl: "https://tenor.com/search/love-job-gifs" }
    ]
  },
  {
    title: "¿Pena de muerte: Sí o No?",
    category: "etica",
    options: [
      { label: "⚖️ Sí, para casos extremos", imageUrl: "https://tenor.com/search/justice-gifs" },
      { label: "❌ No, nunca", imageUrl: "https://tenor.com/search/no-way-gifs" }
    ]
  },
  {
    title: "¿Legalizarías todas las drogas?",
    category: "etica",
    options: [
      { label: "✅ Sí, todas", imageUrl: "https://tenor.com/search/freedom-gifs" },
      { label: "❌ No, ninguna más", imageUrl: "https://tenor.com/search/no-gifs" },
      { label: "🤔 Solo algunas", imageUrl: "https://tenor.com/search/thinking-gifs" }
    ]
  },
  {
    title: "¿Tener hijos hoy en día es irresponsable?",
    category: "etica",
    options: [
      { label: "Sí, el mundo está muy mal", imageUrl: "https://tenor.com/search/sad-world-gifs" },
      { label: "No, es una decisión personal", imageUrl: "https://tenor.com/search/baby-gifs" }
    ]
  },
  {
    title: "¿El dinero compra la felicidad?",
    category: "etica",
    options: [
      { label: "💰😊 Sí, la compra", imageUrl: "https://tenor.com/search/rich-happy-gifs" },
      { label: "❌ No, no la compra", imageUrl: "https://tenor.com/search/simple-life-gifs" },
      { label: "🤝 Ayuda pero no es todo", imageUrl: "https://tenor.com/search/balance-gifs" }
    ]
  },
  {
    title: "¿El ser humano es bueno o malo por naturaleza?",
    category: "etica",
    options: [
      { label: "😇 Bueno por naturaleza", imageUrl: "https://tenor.com/search/angel-gifs" },
      { label: "😈 Malo por naturaleza", imageUrl: "https://tenor.com/search/devil-gifs" },
      { label: "🤷 Neutral, depende", imageUrl: "https://tenor.com/search/shrug-gifs" }
    ]
  },
  {
    title: "¿Prefieres ser respetado o ser amado?",
    category: "etica",
    options: [
      { label: "🤝 Respetado", imageUrl: "https://tenor.com/search/respect-gifs" },
      { label: "❤️ Amado", imageUrl: "https://tenor.com/search/love-gifs" }
    ]
  },
  {
    title: "¿El fin justifica los medios?",
    category: "etica",
    options: [
      { label: "Sí, lo justifica", imageUrl: "https://tenor.com/search/goal-gifs" },
      { label: "No, nunca", imageUrl: "https://tenor.com/search/no-way-gifs" },
      { label: "Depende del contexto", imageUrl: "https://tenor.com/search/depends-gifs" }
    ]
  },
  {
    title: "¿La sanidad debe ser 100% gratuita?",
    category: "etica",
    options: [
      { label: "🏥 Sí, 100% gratuita", imageUrl: "https://tenor.com/search/hospital-gifs" },
      { label: "💰 No, mixta es mejor", imageUrl: "https://tenor.com/search/money-gifs" }
    ]
  },
  {
    title: "¿El matrimonio está pasado de moda?",
    category: "etica",
    options: [
      { label: "💔 Sí, está obsoleto", imageUrl: "https://tenor.com/search/single-gifs" },
      { label: "💍 No, sigue siendo importante", imageUrl: "https://tenor.com/search/wedding-gifs" }
    ]
  },
  {
    title: "¿Desconectarías el soporte vital de un familiar si fuera su voluntad?",
    category: "etica",
    options: [
      { label: "Sí, respetaría su voluntad", imageUrl: "https://tenor.com/search/sad-gifs" },
      { label: "No, no podría hacerlo", imageUrl: "https://tenor.com/search/crying-gifs" },
      { label: "Depende de las circunstancias", imageUrl: "https://tenor.com/search/thinking-gifs" }
    ]
  },
  {
    title: "¿El servicio militar debería ser obligatorio?",
    category: "etica",
    options: [
      { label: "🪖 Sí, debería ser obligatorio", imageUrl: "https://tenor.com/search/military-gifs" },
      { label: "✋ No, debe ser voluntario", imageUrl: "https://tenor.com/search/freedom-gifs" }
    ]
  },
  {
    title: "¿La cárcel rehabilita o solo castiga?",
    category: "etica",
    options: [
      { label: "🔄 Rehabilita", imageUrl: "https://tenor.com/search/rehabilitation-gifs" },
      { label: "⛓️ Solo castiga", imageUrl: "https://tenor.com/search/prison-gifs" },
      { label: "🤔 Depende del sistema", imageUrl: "https://tenor.com/search/thinking-gifs" }
    ]
  },
  {
    title: "¿Prohibirías el tabaco totalmente?",
    category: "etica",
    options: [
      { label: "🚫 Sí, prohibirlo", imageUrl: "https://tenor.com/search/no-smoking-gifs" },
      { label: "🚭 No, libertad personal", imageUrl: "https://tenor.com/search/smoking-gifs" }
    ]
  },
  {
    title: "¿El voto debería ser obligatorio?",
    category: "etica",
    options: [
      { label: "🗳️ Sí, obligatorio", imageUrl: "https://tenor.com/search/vote-gifs" },
      { label: "✋ No, es un derecho, no deber", imageUrl: "https://tenor.com/search/freedom-gifs" }
    ]
  },
  {
    title: "¿Cerrarías todos los zoológicos?",
    category: "etica",
    options: [
      { label: "🦁 Sí, cerrarlos", imageUrl: "https://tenor.com/search/free-animals-gifs" },
      { label: "🏫 No, tienen valor educativo", imageUrl: "https://tenor.com/search/zoo-gifs" },
      { label: "🔄 Reformarlos, no cerrarlos", imageUrl: "https://tenor.com/search/animals-gifs" }
    ]
  },
  {
    title: "¿Mentiras piadosas: Sí o No?",
    category: "etica",
    options: [
      { label: "🤥 Sí, a veces son necesarias", imageUrl: "https://tenor.com/search/white-lie-gifs" },
      { label: "✅ No, siempre la verdad", imageUrl: "https://tenor.com/search/truth-gifs" }
    ]
  },

  // EXTREMODURO - MEJORES CANCIONES
  {
    title: "¿Cuál es la mejor canción de Extremoduro?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "So Payaso", imageUrl: "https://open.spotify.com/track/3VqHYJhxmQN3b1xuqvQgmx" },
      { label: "Golfa", imageUrl: "https://open.spotify.com/track/74TFPvjH96YPmHgVLX8TVk" },
      { label: "La vereda de la puerta de atrás", imageUrl: "https://open.spotify.com/track/0x0cKbvl4lOMIjjPKPgSqA" },
      { label: "Standby", imageUrl: "https://open.spotify.com/track/6XgLvGjAdBLXHv3F6f0sLf" },
      { label: "Dulce introducción al caos", imageUrl: "https://open.spotify.com/track/5o2pFJpmW4mECWHO0zKJRe" },
      { label: "Ama, ama, ama y ensancha el alma", imageUrl: "https://open.spotify.com/track/4t0DwROO5FtN6yxFi8b0tE" }
    ]
  },
  {
    title: "¿Cuál es el mejor disco de Extremoduro?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Agila (1996)", imageUrl: "https://open.spotify.com/album/3RUg8kJBT8TdHLG4p1rG3u" },
      { label: "Yo, minoría absoluta (2002)", imageUrl: "https://open.spotify.com/album/4VnR7Z7pOOKHj9bQyVuCkM" },
      { label: "La ley innata (2008)", imageUrl: "https://open.spotify.com/album/6a4k5xRKQWGXbTd6iqKKAn" },
      { label: "Deltoya (1992)", imageUrl: "https://open.spotify.com/album/1YH1GXMZiF0N8KZpUxD1O3" },
      { label: "Canciones prohibidas (1998)", imageUrl: "https://open.spotify.com/album/7ecBJcWWEySxq5OMKGjm3V" },
      { label: "Material defectuoso (2011)", imageUrl: "https://open.spotify.com/album/5TIKRhALFM6JhTqUGJeqVN" }
    ]
  },

  // �� MÚSICA - RANKINGS CON SPOTIFY (COLABORATIVAS)
  {
    title: "¿Cuál es la mejor banda de Rock de la historia?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Queen", imageUrl: "https://open.spotify.com/artist/1dfeR4HaWDbWqFHLkxsg1d" },
      { label: "Led Zeppelin", imageUrl: "https://open.spotify.com/artist/36QJpDe2go2KgaRleHCDTp" },
      { label: "The Beatles", imageUrl: "https://open.spotify.com/artist/3WrFJ7ztbogyGnTHbHJFl2" },
      { label: "Pink Floyd", imageUrl: "https://open.spotify.com/artist/0k17h0D3J5VfsdmQ1iZtE9" },
      { label: "AC/DC", imageUrl: "https://open.spotify.com/artist/711MCceyCBcFnzjGY4Q7Un" }
    ]
  },
  {
    title: "¿Quién es el verdadero 'Rey' o 'Reina' del Pop?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Michael Jackson", imageUrl: "https://open.spotify.com/artist/3fMbdgg4jU18AjLCKBhRSm" },
      { label: "Madonna", imageUrl: "https://open.spotify.com/artist/6tbjWDEIzxTsHi1PYOhLtm" },
      { label: "Beyoncé", imageUrl: "https://open.spotify.com/artist/6vWDO969PvNqNYHIOW5v0m" },
      { label: "Taylor Swift", imageUrl: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02" },
      { label: "Prince", imageUrl: "https://open.spotify.com/artist/5a2EaR3hamoenG9rDuVn2a" }
    ]
  },
  {
    title: "¿Qué canción es un himno mundial que todos conocen?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Bohemian Rhapsody - Queen", imageUrl: "https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J" },
      { label: "Billie Jean - Michael Jackson", imageUrl: "https://open.spotify.com/track/5ChkMS8OtdzJeqyybCc9R5" },
      { label: "Imagine - John Lennon", imageUrl: "https://open.spotify.com/track/7pKfPomDEeI4TPT6EOYjn9" },
      { label: "Despacito - Luis Fonsi", imageUrl: "https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb" },
      { label: "Shape of You - Ed Sheeran", imageUrl: "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3" }
    ]
  },
  {
    title: "¿Cuál es el mejor DJ de música electrónica?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "David Guetta", imageUrl: "https://open.spotify.com/artist/1Cs0zKBU1kc0i8ypK3B9ai" },
      { label: "Calvin Harris", imageUrl: "https://open.spotify.com/artist/7CajNmpbOovFoOoasH2HaY" },
      { label: "Tiësto", imageUrl: "https://open.spotify.com/artist/2o5jDhtHVPhrJdv3cEQ99Z" },
      { label: "Martin Garrix", imageUrl: "https://open.spotify.com/artist/60d24wfXkVzDSfLS6hyCjZ" },
      { label: "Avicii", imageUrl: "https://open.spotify.com/artist/1vCWHaC5f2uS3yhpwWbIA6" }
    ]
  },
  {
    title: "¿Quién es el mejor rapero de todos los tiempos?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Eminem", imageUrl: "https://open.spotify.com/artist/7dGJo4pcD2V6oG8kP0tJRR" },
      { label: "Tupac", imageUrl: "https://open.spotify.com/artist/1ZwdS5xdxEREPySFridCfh" },
      { label: "Notorious B.I.G.", imageUrl: "https://open.spotify.com/artist/5me0Irg2ANcsgc93uaYrpb" },
      { label: "Kendrick Lamar", imageUrl: "https://open.spotify.com/artist/2YZyLoL8N0Wb9xBt1NhZWg" },
      { label: "Drake", imageUrl: "https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4" }
    ]
  },
  {
    title: "¿La mejor canción para cantar a gritos en el coche?",
    category: "musica",
    type: "collaborative",
    options: [
      { label: "Bohemian Rhapsody - Queen", imageUrl: "https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J" },
      { label: "Don't Stop Believin' - Journey", imageUrl: "https://open.spotify.com/track/4bHsxqR3GMrXTxEPLuK5ue" },
      { label: "Livin' on a Prayer - Bon Jovi", imageUrl: "https://open.spotify.com/track/37ZJ0p5Jm13JPevGcx4SkF" },
      { label: "Mr. Brightside - The Killers", imageUrl: "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B" }
    ]
  },

  // 📺 SERIES Y PELÍCULAS (COLABORATIVAS)
  {
    title: "¿Cuál es la mejor serie de TV de la historia?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Breaking Bad", imageUrl: "https://www.imdb.com/title/tt0903747/" },
      { label: "Game of Thrones", imageUrl: "https://www.imdb.com/title/tt0944947/" },
      { label: "The Sopranos", imageUrl: "https://www.imdb.com/title/tt0141842/" },
      { label: "Friends", imageUrl: "https://www.imdb.com/title/tt0108778/" },
      { label: "Stranger Things", imageUrl: "https://www.imdb.com/title/tt4574334/" }
    ]
  },
  {
    title: "¿Qué película te hizo llorar de verdad?",
    category: "rankings",
    type: "multiple",
    options: [
      { label: "Titanic", imageUrl: "https://www.imdb.com/title/tt0120338/" },
      { label: "Coco", imageUrl: "https://www.imdb.com/title/tt2380307/" },
      { label: "El Rey León", imageUrl: "https://www.imdb.com/title/tt0110357/" },
      { label: "Forrest Gump", imageUrl: "https://www.imdb.com/title/tt0109830/" },
      { label: "Up", imageUrl: "https://www.imdb.com/title/tt1049413/" },
      { label: "Ninguna me hizo llorar", imageUrl: "https://tenor.com/search/no-emotions-gifs" }
    ]
  },
  {
    title: "¿El mejor villano del cine de todos los tiempos?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Joker (Heath Ledger)", imageUrl: "https://www.imdb.com/title/tt0468569/" },
      { label: "Darth Vader", imageUrl: "https://www.imdb.com/title/tt0076759/" },
      { label: "Hannibal Lecter", imageUrl: "https://www.imdb.com/title/tt0102926/" },
      { label: "Thanos", imageUrl: "https://www.imdb.com/title/tt4154756/" },
      { label: "Voldemort", imageUrl: "https://www.imdb.com/title/tt0926084/" }
    ]
  },
  {
    title: "¿Cuál es el mejor Anime de la historia?",
    category: "cultura_pop",
    type: "collaborative",
    options: [
      { label: "Dragon Ball", imageUrl: "https://www.imdb.com/title/tt0121220/" },
      { label: "Naruto", imageUrl: "https://www.imdb.com/title/tt0409591/" },
      { label: "One Piece", imageUrl: "https://www.imdb.com/title/tt0388629/" },
      { label: "Death Note", imageUrl: "https://www.imdb.com/title/tt0877057/" },
      { label: "Attack on Titan", imageUrl: "https://www.imdb.com/title/tt2560140/" }
    ]
  },
  {
    title: "¿Quién es el mejor superhéroe de todos los tiempos?",
    category: "cultura_pop",
    type: "collaborative",
    options: [
      { label: "Spider-Man", imageUrl: "https://www.imdb.com/title/tt10872600/" },
      { label: "Batman", imageUrl: "https://www.imdb.com/title/tt1877830/" },
      { label: "Superman", imageUrl: "https://www.imdb.com/title/tt0078346/" },
      { label: "Iron Man", imageUrl: "https://www.imdb.com/title/tt0371746/" },
      { label: "Wonder Woman", imageUrl: "https://www.imdb.com/title/tt0451279/" }
    ]
  },

  // 🎮 GAMING (COLABORATIVAS Y MÚLTIPLES)
  {
    title: "¿El videojuego más adictivo que has jugado?",
    category: "gaming",
    type: "collaborative",
    options: [
      { label: "Minecraft", imageUrl: "https://www.minecraft.net/" },
      { label: "Fortnite", imageUrl: "https://www.fortnite.com/" },
      { label: "GTA V", imageUrl: "https://www.rockstargames.com/gta-v" },
      { label: "League of Legends", imageUrl: "https://www.leagueoflegends.com/" },
      { label: "Valorant", imageUrl: "https://playvalorant.com/" }
    ]
  },
  {
    title: "¿Qué plataformas de gaming usas regularmente?",
    category: "gaming",
    type: "multiple",
    options: [
      { label: "PC", imageUrl: "https://tenor.com/search/pc-gaming-gifs" },
      { label: "PlayStation", imageUrl: "https://www.playstation.com/" },
      { label: "Xbox", imageUrl: "https://www.xbox.com/" },
      { label: "Nintendo Switch", imageUrl: "https://www.nintendo.com/switch/" },
      { label: "Móvil", imageUrl: "https://tenor.com/search/mobile-gaming-gifs" }
    ]
  },

  // 🌐 STREAMERS Y YOUTUBERS
  {
    title: "¿Quién es el mejor Youtuber o Streamer del mundo?",
    category: "cultura_pop",
    type: "collaborative",
    options: [
      { label: "MrBeast", imageUrl: "https://www.youtube.com/@MrBeast" },
      { label: "PewDiePie", imageUrl: "https://www.youtube.com/@PewDiePie" },
      { label: "Ibai", imageUrl: "https://www.twitch.tv/ibai" },
      { label: "AuronPlay", imageUrl: "https://www.twitch.tv/auronplay" },
      { label: "xQc", imageUrl: "https://www.twitch.tv/xqc" }
    ]
  },
  {
    title: "¿Quién es el mejor streamer de habla hispana?",
    category: "cultura_pop",
    type: "collaborative",
    options: [
      { label: "Ibai Llanos", imageUrl: "https://www.twitch.tv/ibai" },
      { label: "AuronPlay", imageUrl: "https://www.twitch.tv/auronplay" },
      { label: "Rubius", imageUrl: "https://www.twitch.tv/rubius" },
      { label: "TheGrefg", imageUrl: "https://www.twitch.tv/thegrefg" },
      { label: "Illojuan", imageUrl: "https://www.twitch.tv/illojuan" }
    ]
  },

  // 🍕 COMIDA (COLABORATIVAS Y MÚLTIPLES)
  {
    title: "¿Cuál es el plato más rico del mundo?",
    category: "comida",
    type: "collaborative",
    options: [
      { label: "🍕 Pizza", imageUrl: "https://tenor.com/search/pizza-gifs" },
      { label: "🍔 Hamburguesa", imageUrl: "https://tenor.com/search/burger-gifs" },
      { label: "🍣 Sushi", imageUrl: "https://tenor.com/search/sushi-gifs" },
      { label: "🌮 Tacos", imageUrl: "https://tenor.com/search/tacos-gifs" },
      { label: "🥘 Paella", imageUrl: "https://tenor.com/search/paella-gifs" }
    ]
  },
  {
    title: "¿Qué comidas te gustan? (selecciona todas)",
    category: "comida",
    type: "multiple",
    options: [
      { label: "🍕 Pizza", imageUrl: "https://tenor.com/search/pizza-gifs" },
      { label: "🍔 Hamburguesa", imageUrl: "https://tenor.com/search/burger-gifs" },
      { label: "🍣 Sushi", imageUrl: "https://tenor.com/search/sushi-gifs" },
      { label: "🌮 Tacos", imageUrl: "https://tenor.com/search/tacos-gifs" },
      { label: "🍝 Pasta", imageUrl: "https://tenor.com/search/pasta-gifs" },
      { label: "🍜 Ramen", imageUrl: "https://tenor.com/search/ramen-gifs" }
    ]
  },
  {
    title: "¿Qué país tiene la mejor gastronomía del planeta?",
    category: "comida",
    type: "collaborative",
    options: [
      { label: "🇮🇹 Italia", imageUrl: "https://tenor.com/search/italian-food-gifs" },
      { label: "🇲🇽 México", imageUrl: "https://tenor.com/search/mexican-food-gifs" },
      { label: "🇯🇵 Japón", imageUrl: "https://tenor.com/search/japanese-food-gifs" },
      { label: "🇪🇸 España", imageUrl: "https://tenor.com/search/spanish-food-gifs" },
      { label: "🇫🇷 Francia", imageUrl: "https://tenor.com/search/french-food-gifs" }
    ]
  },
  {
    title: "¿Tu sabor de helado favorito?",
    category: "comida",
    type: "collaborative",
    options: [
      { label: "🍫 Chocolate", imageUrl: "https://tenor.com/search/chocolate-ice-cream-gifs" },
      { label: "🍓 Fresa", imageUrl: "https://tenor.com/search/strawberry-ice-cream-gifs" },
      { label: "🍦 Vainilla", imageUrl: "https://tenor.com/search/vanilla-ice-cream-gifs" },
      { label: "🍋 Limón", imageUrl: "https://tenor.com/search/lemon-ice-cream-gifs" },
      { label: "🥜 Turrón/Dulce de leche", imageUrl: "https://tenor.com/search/dulce-de-leche-gifs" }
    ]
  },

  // 🏆 DEPORTES
  {
    title: "¿El mejor deportista de todos los tiempos (GOAT)?",
    category: "deportes",
    type: "collaborative",
    options: [
      { label: "Michael Jordan", imageUrl: "https://www.instagram.com/jumpman23/" },
      { label: "Muhammad Ali", imageUrl: "https://tenor.com/search/muhammad-ali-gifs" },
      { label: "Usain Bolt", imageUrl: "https://www.instagram.com/usainbolt/" },
      { label: "Serena Williams", imageUrl: "https://www.instagram.com/serenawilliams/" },
      { label: "Tiger Woods", imageUrl: "https://www.instagram.com/tigerwoods/" }
    ]
  },
  {
    title: "¿Qué deportes practicas o sigues? (selecciona varios)",
    category: "deportes",
    type: "multiple",
    options: [
      { label: "⚽ Fútbol", imageUrl: "https://tenor.com/search/soccer-gifs" },
      { label: "🏀 Baloncesto", imageUrl: "https://tenor.com/search/basketball-gifs" },
      { label: "🎾 Tenis", imageUrl: "https://tenor.com/search/tennis-gifs" },
      { label: "🏋️ Gimnasio/Fitness", imageUrl: "https://tenor.com/search/gym-workout-gifs" },
      { label: "🏃 Running", imageUrl: "https://tenor.com/search/running-gifs" },
      { label: "🏊 Natación", imageUrl: "https://tenor.com/search/swimming-gifs" }
    ]
  },

  // 💼 MARCAS
  {
    title: "¿Nike o Adidas?",
    category: "rankings",
    options: [
      { label: "Nike", imageUrl: "https://www.nike.com/" },
      { label: "Adidas", imageUrl: "https://www.adidas.es/" }
    ]
  },
  {
    title: "¿La marca más sobrevalorada del mercado?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Apple", imageUrl: "https://www.apple.com/" },
      { label: "Supreme", imageUrl: "https://www.supremenewyork.com/" },
      { label: "Gucci", imageUrl: "https://www.gucci.com/" },
      { label: "Starbucks", imageUrl: "https://www.starbucks.com/" },
      { label: "Tesla", imageUrl: "https://www.tesla.com/" }
    ]
  },
  {
    title: "¿Cuál es la mejor marca de coches del mundo?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Mercedes-Benz", imageUrl: "https://www.mercedes-benz.es/" },
      { label: "BMW", imageUrl: "https://www.bmw.es/" },
      { label: "Ferrari", imageUrl: "https://www.ferrari.com/" },
      { label: "Porsche", imageUrl: "https://www.porsche.com/" },
      { label: "Tesla", imageUrl: "https://www.tesla.com/" }
    ]
  },

  // 📱 APPS (MÚLTIPLE)
  {
    title: "¿Qué redes sociales usas diariamente? (selecciona todas)",
    category: "tecnologia",
    type: "multiple",
    options: [
      { label: "WhatsApp", imageUrl: "https://www.whatsapp.com/" },
      { label: "Instagram", imageUrl: "https://www.instagram.com/" },
      { label: "TikTok", imageUrl: "https://www.tiktok.com/" },
      { label: "YouTube", imageUrl: "https://www.youtube.com/" },
      { label: "Twitter/X", imageUrl: "https://twitter.com/" },
      { label: "Snapchat", imageUrl: "https://www.snapchat.com/" }
    ]
  },
  {
    title: "¿Qué servicio de streaming usas? (selecciona todos)",
    category: "tecnologia",
    type: "multiple",
    options: [
      { label: "Netflix", imageUrl: "https://www.netflix.com/" },
      { label: "Disney+", imageUrl: "https://www.disneyplus.com/" },
      { label: "HBO Max", imageUrl: "https://www.max.com/" },
      { label: "Amazon Prime", imageUrl: "https://www.primevideo.com/" },
      { label: "Spotify", imageUrl: "https://open.spotify.com/" },
      { label: "YouTube Premium", imageUrl: "https://www.youtube.com/premium" }
    ]
  },

  // 🌍 VIAJES
  {
    title: "¿El país más bonito que has visitado?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "🇮🇹 Italia", imageUrl: "https://tenor.com/search/italy-gifs" },
      { label: "🇯🇵 Japón", imageUrl: "https://tenor.com/search/japan-gifs" },
      { label: "🇪🇸 España", imageUrl: "https://tenor.com/search/spain-gifs" },
      { label: "🇫🇷 Francia", imageUrl: "https://tenor.com/search/france-gifs" },
      { label: "🇬🇷 Grecia", imageUrl: "https://tenor.com/search/greece-gifs" }
    ]
  },
  {
    title: "¿La ciudad ideal para vivir?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Barcelona", imageUrl: "https://tenor.com/search/barcelona-gifs" },
      { label: "Nueva York", imageUrl: "https://tenor.com/search/new-york-gifs" },
      { label: "Tokio", imageUrl: "https://tenor.com/search/tokyo-gifs" },
      { label: "Londres", imageUrl: "https://tenor.com/search/london-gifs" },
      { label: "Ámsterdam", imageUrl: "https://tenor.com/search/amsterdam-gifs" }
    ]
  },
  {
    title: "¿Qué países te gustaría visitar? (selecciona varios)",
    category: "rankings",
    type: "multiple",
    options: [
      { label: "🇯🇵 Japón", imageUrl: "https://tenor.com/search/japan-gifs" },
      { label: "🇮🇹 Italia", imageUrl: "https://tenor.com/search/italy-gifs" },
      { label: "🇺🇸 Estados Unidos", imageUrl: "https://tenor.com/search/usa-gifs" },
      { label: "🇦🇺 Australia", imageUrl: "https://tenor.com/search/australia-gifs" },
      { label: "🇳🇿 Nueva Zelanda", imageUrl: "https://tenor.com/search/new-zealand-gifs" },
      { label: "🇮🇸 Islandia", imageUrl: "https://tenor.com/search/iceland-gifs" }
    ]
  },

  // 📝 ENCUESTAS COLABORATIVAS ADICIONALES
  {
    title: "¿El libro que te cambió la vida?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "El Principito", imageUrl: "https://www.goodreads.com/book/show/157993.The_Little_Prince" },
      { label: "1984 - George Orwell", imageUrl: "https://www.goodreads.com/book/show/40961427-1984" },
      { label: "Cien años de soledad", imageUrl: "https://www.goodreads.com/book/show/320.One_Hundred_Years_of_Solitude" },
      { label: "Harry Potter", imageUrl: "https://www.goodreads.com/book/show/3.Harry_Potter_and_the_Sorcerer_s_Stone" },
      { label: "El Alquimista", imageUrl: "https://www.goodreads.com/book/show/865.The_Alchemist" }
    ]
  },
  {
    title: "¿El ingrediente que arruina cualquier comida?",
    category: "comida",
    type: "collaborative",
    options: [
      { label: "🫒 Aceitunas", imageUrl: "https://tenor.com/search/olives-gifs" },
      { label: "🧅 Cebolla", imageUrl: "https://tenor.com/search/onion-gifs" },
      { label: "🥬 Cilantro", imageUrl: "https://tenor.com/search/cilantro-gifs" },
      { label: "🍄 Champiñones", imageUrl: "https://tenor.com/search/mushrooms-gifs" },
      { label: "🐟 Anchoas", imageUrl: "https://tenor.com/search/anchovies-gifs" }
    ]
  },
  {
    title: "¿La mejor marca de chocolate/dulces?",
    category: "comida",
    type: "collaborative",
    options: [
      { label: "Lindt", imageUrl: "https://www.lindt.es/" },
      { label: "Ferrero", imageUrl: "https://www.ferrero.com/" },
      { label: "Milka", imageUrl: "https://www.milka.es/" },
      { label: "Kinder", imageUrl: "https://www.kinder.com/" },
      { label: "Nestlé", imageUrl: "https://www.nestle.es/" }
    ]
  },
  {
    title: "¿Lo primero que comprarías si ganaras la lotería?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "🏠 Una casa", imageUrl: "https://tenor.com/search/mansion-gifs" },
      { label: "🚗 Un coche de lujo", imageUrl: "https://tenor.com/search/luxury-car-gifs" },
      { label: "✈️ Un viaje", imageUrl: "https://tenor.com/search/travel-gifs" },
      { label: "💰 Invertirlo", imageUrl: "https://tenor.com/search/investing-gifs" },
      { label: "🎁 Regalar a familia", imageUrl: "https://tenor.com/search/family-gift-gifs" }
    ]
  },
  {
    title: "¿La palabra que más odias escuchar?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Literalmente", imageUrl: "https://dle.rae.es/literalmente" },
      { label: "Random", imageUrl: "https://www.urbandictionary.com/define.php?term=random" },
      { label: "Cringe", imageUrl: "https://www.urbandictionary.com/define.php?term=cringe" },
      { label: "Básico", imageUrl: "https://www.urbandictionary.com/define.php?term=basic" },
      { label: "Tóxico", imageUrl: "https://dle.rae.es/t%C3%B3xico" }
    ]
  },
  {
    title: "¿La tarea del hogar más insoportable?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "🧹 Fregar los platos", imageUrl: "https://tenor.com/search/washing-dishes-gifs" },
      { label: "🛏️ Hacer la cama", imageUrl: "https://tenor.com/search/making-bed-gifs" },
      { label: "👕 Planchar", imageUrl: "https://tenor.com/search/ironing-gifs" },
      { label: "🚽 Limpiar el baño", imageUrl: "https://tenor.com/search/cleaning-bathroom-gifs" },
      { label: "🧺 Tender la ropa", imageUrl: "https://tenor.com/search/laundry-gifs" }
    ]
  },
  {
    title: "¿Lo que más te molesta que haga la gente en público?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "📱 Hablar alto por teléfono", imageUrl: "https://tenor.com/search/loud-phone-gifs" },
      { label: "🎵 Poner música sin auriculares", imageUrl: "https://tenor.com/search/annoying-music-gifs" },
      { label: "🚶 Caminar lento", imageUrl: "https://tenor.com/search/slow-walking-gifs" },
      { label: "🍽️ Masticar con la boca abierta", imageUrl: "https://tenor.com/search/chewing-gifs" },
      { label: "🚬 Fumar cerca", imageUrl: "https://tenor.com/search/smoking-annoying-gifs" }
    ]
  },
  {
    title: "¿El famoso/a con el que te irías de fiesta?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Bad Bunny", imageUrl: "https://open.spotify.com/artist/4q3ewBCX7sLwd24euuV69X" },
      { label: "Rihanna", imageUrl: "https://open.spotify.com/artist/5pKCCKE2ajJHZ9KAiaK11H" },
      { label: "Leonardo DiCaprio", imageUrl: "https://www.imdb.com/name/nm0000138/" },
      { label: "Rosalía", imageUrl: "https://open.spotify.com/artist/7ltDVBr6mKbRvohxheJ9h1" },
      { label: "The Weeknd", imageUrl: "https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ" }
    ]
  },
  {
    title: "¿El personaje histórico más influyente?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Jesús de Nazaret", imageUrl: "https://es.wikipedia.org/wiki/Jes%C3%BAs_de_Nazaret" },
      { label: "Albert Einstein", imageUrl: "https://es.wikipedia.org/wiki/Albert_Einstein" },
      { label: "Leonardo da Vinci", imageUrl: "https://es.wikipedia.org/wiki/Leonardo_da_Vinci" },
      { label: "Isaac Newton", imageUrl: "https://es.wikipedia.org/wiki/Isaac_Newton" },
      { label: "Napoleón Bonaparte", imageUrl: "https://es.wikipedia.org/wiki/Napole%C3%B3n_Bonaparte" }
    ]
  },
  {
    title: "¿Qué película está terriblemente sobrevalorada?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Avatar", imageUrl: "https://www.imdb.com/title/tt0499549/" },
      { label: "Titanic", imageUrl: "https://www.imdb.com/title/tt0120338/" },
      { label: "Star Wars", imageUrl: "https://www.imdb.com/title/tt0076759/" },
      { label: "El Señor de los Anillos", imageUrl: "https://www.imdb.com/title/tt0120737/" },
      { label: "Matrix", imageUrl: "https://www.imdb.com/title/tt0133093/" }
    ]
  },
  {
    title: "¿Cuál es la mejor serie original de Netflix/HBO?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Stranger Things", imageUrl: "https://www.imdb.com/title/tt4574334/" },
      { label: "The Witcher", imageUrl: "https://www.imdb.com/title/tt5180504/" },
      { label: "La Casa de Papel", imageUrl: "https://www.imdb.com/title/tt6468322/" },
      { label: "Game of Thrones", imageUrl: "https://www.imdb.com/title/tt0944947/" },
      { label: "Succession", imageUrl: "https://www.imdb.com/title/tt7660850/" }
    ]
  },
  {
    title: "¿Quién es la mujer más hermosa del mundo actualmente?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Margot Robbie", imageUrl: "https://www.instagram.com/margotrobbie/" },
      { label: "Zendaya", imageUrl: "https://www.instagram.com/zendaya/" },
      { label: "Ana de Armas", imageUrl: "https://www.instagram.com/ana_d_armas/" },
      { label: "Scarlett Johansson", imageUrl: "https://www.imdb.com/name/nm0424060/" },
      { label: "Gal Gadot", imageUrl: "https://www.instagram.com/gaboroo/" }
    ]
  },
  {
    title: "¿Quién es el hombre más atractivo del mundo actualmente?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Henry Cavill", imageUrl: "https://www.instagram.com/henrycavill/" },
      { label: "Chris Hemsworth", imageUrl: "https://www.instagram.com/chrishemsworth/" },
      { label: "Timothée Chalamet", imageUrl: "https://www.imdb.com/name/nm3154303/" },
      { label: "Ryan Gosling", imageUrl: "https://www.imdb.com/name/nm0331516/" },
      { label: "Bad Bunny", imageUrl: "https://open.spotify.com/artist/4q3ewBCX7sLwd24euuV69X" }
    ]
  },
  {
    title: "¿Qué famoso/a te cae peor?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Kanye West", imageUrl: "https://open.spotify.com/artist/5K4W6rqBFWDnAN6FQUkS6x" },
      { label: "Kim Kardashian", imageUrl: "https://www.instagram.com/kimkardashian/" },
      { label: "Elon Musk", imageUrl: "https://twitter.com/elonmusk" },
      { label: "Jake Paul", imageUrl: "https://www.instagram.com/jakepaul/" },
      { label: "Amber Heard", imageUrl: "https://www.imdb.com/name/nm1720028/" }
    ]
  },
  {
    title: "¿Cuál es el mejor meme de la historia?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "Doge", imageUrl: "https://knowyourmeme.com/memes/doge" },
      { label: "Rickroll", imageUrl: "https://knowyourmeme.com/memes/rickroll" },
      { label: "Surprised Pikachu", imageUrl: "https://knowyourmeme.com/memes/surprised-pikachu" },
      { label: "Distracted Boyfriend", imageUrl: "https://knowyourmeme.com/memes/distracted-boyfriend" },
      { label: "Woman Yelling at Cat", imageUrl: "https://knowyourmeme.com/memes/woman-yelling-at-a-cat" }
    ]
  },
  {
    title: "¿Cuál es la raza de perro más bonita?",
    category: "rankings",
    type: "collaborative",
    options: [
      { label: "🐕 Golden Retriever", imageUrl: "https://es.wikipedia.org/wiki/Golden_retriever" },
      { label: "🐕 Husky Siberiano", imageUrl: "https://es.wikipedia.org/wiki/Husky_siberiano" },
      { label: "🐕 Labrador", imageUrl: "https://es.wikipedia.org/wiki/Labrador_retriever" },
      { label: "🐕 Border Collie", imageUrl: "https://es.wikipedia.org/wiki/Border_collie" },
      { label: "🐕 Corgi", imageUrl: "https://es.wikipedia.org/wiki/Welsh_corgi_Pembroke" }
    ]
  },
  {
    title: "¿Qué aplicación no puede faltar en tu móvil?",
    category: "tecnologia",
    type: "collaborative",
    options: [
      { label: "WhatsApp", imageUrl: "https://www.whatsapp.com/" },
      { label: "Instagram", imageUrl: "https://www.instagram.com/" },
      { label: "TikTok", imageUrl: "https://www.tiktok.com/" },
      { label: "YouTube", imageUrl: "https://www.youtube.com/" },
      { label: "Spotify", imageUrl: "https://open.spotify.com/" }
    ]
  }
];

async function main() {
  console.log('🗑️ Eliminando todas las encuestas existentes...');
  
  await prisma.voteHistory.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.pollInteraction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.pollHashtag.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  
  console.log('✅ Todas las encuestas eliminadas');
  
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
  let withMedia = 0;
  
  for (const pollData of polls) {
    try {
      const hasMedia = pollData.options.some(opt => opt.imageUrl);
      if (hasMedia) withMedia++;
      
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
  console.log(`📸 ${withMedia} encuestas tienen opciones con multimedia (YouTube, Spotify, Tenor)`);
  
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
