const AGENDA_URL = "https://trilheirosderondonopolis.my.canva.site/agenda-trilhas";
const INSTAGRAM_USERNAME = "trilheiros.roomt";

function env(name) {
  return Netlify.env.get(name) || "";
}

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pick(list, seed = "") {
  if (!list.length) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function firstUsefulLine(caption = "") {
  const lines = caption
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !x.startsWith("#"));
  return lines[0] || "esse passeio";
}

function detectTrip(caption = "") {
  const text = normalize(caption);
  const known = [
    ["morro da mesa", "Morro da Mesa"],
    ["salto das nuvens", "Salto das Nuvens"],
    ["outubro rosa", "Trilha Outubro Rosa"],
    ["morro do carneiro", "Morro do Carneiro"],
    ["trilha kids", "Trilha Kids"],
    ["nobres", "Nobres / Bom Jardim"],
    ["aquario encantado", "Nobres / Aquário Encantado"],
    ["rafting", "Rafting"],
    ["rio cristalino", "Rio Cristalino"],
    ["canion das indias", "Cânion das Índias"],
    ["barra do garcas", "Barra do Garças"],
    ["chapada dos guimaraes", "Chapada dos Guimarães"],
    ["mirante da janela", "Mirante da Janela"],
  ];
  for (const [key, label] of known) {
    if (text.includes(key)) return label;
  }

  const line = firstUsefulLine(caption)
    .replace(/[🌿🥾🔥🌄💦🚣‍♂️😍❤️✨💚📅📍⏰💰📲]+/gu, "")
    .trim();
  return line.length > 80 ? "esse passeio" : line || "esse passeio";
}

function extractMoney(caption = "") {
  const matches = caption.match(/R\$\s?[\d\.]+(?:,\d{2})?/gi) || [];
  return [...new Set(matches.map((x) => x.replace(/\s+/g, " ")))].slice(0, 5);
}

function extractDate(caption = "") {
  const patterns = [
    /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/iu,
    /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/u,
  ];
  for (const p of patterns) {
    const m = caption.match(p);
    if (m) return m[0];
  }
  return "";
}

function extractTimes(caption = "") {
  const matches = caption.match(/\b\d{1,2}(?::\d{2})?\s?h(?:oras?)?\b/gi) || [];
  return [...new Set(matches.map((x) => x.trim()))].slice(0, 3);
}

function extractLevel(caption = "") {
  const text = normalize(caption);
  const m = text.match(/nivel\s*:?\s*(facil(?:\s*(?:a|\/|e)\s*moderado)?|moderado(?:\s*(?:a|\/|e)\s*dificil)?|dificil)/i);
  return m ? m[1] : "";
}

function extractChildInfo(caption = "") {
  const lines = caption.split("\n").map((x) => x.trim()).filter(Boolean);
  const child = lines.find((x) => /crian|idade|minim|anos/i.test(x));
  return child || "";
}

function extractIncluded(caption = "") {
  const lines = caption.split("\n").map((x) => x.trim()).filter(Boolean);
  const start = lines.findIndex((x) => /inclu[ií]do|incluso|inclui/i.test(x));
  if (start < 0) return "";
  return lines.slice(start, Math.min(start + 4, lines.length)).join(" ");
}

function isSoldOut(caption = "") {
  const t = normalize(caption);
  return /esgotad|lotad|sem vagas|vagas encerradas/.test(t);
}

function cta(seed = "") {
  return pick([
    "Quer mais detalhes? Chama a gente no Direct 😊",
    "Para ver todas as informações, acesse a Agenda dos Trilheiros no link da bio 🥾🌿",
    "Se quiser reservar ou tirar mais dúvidas, chama a gente no Direct 😊",
    "Confira a Agenda dos Trilheiros no link da bio e venha viver essa experiência com a gente! 🌿🥾",
    "Ficou com alguma dúvida? Chama no Direct ou confira a agenda completa no link da bio 😉",
  ], seed);
}

function buildReply({ commentId = "", commentText = "", caption = "" }) {
  const q = normalize(commentText);
  const trip = detectTrip(caption);
  const money = extractMoney(caption);
  const date = extractDate(caption);
  const times = extractTimes(caption);
  const level = extractLevel(caption);
  const child = extractChildInfo(caption);
  const included = extractIncluded(caption);
  const soldOut = isSoldOut(caption);
  const end = cta(commentId + commentText);

  if (/\b(valor|preco|preço|quanto|custa|pix|cartao|cartão)\b/.test(q)) {
    if (money.length) {
      return `😊 Sobre ${trip}: os valores informados na publicação são ${money.join(" / ")}. ${end}`;
    }
    return `😊 Sobre ${trip}, os valores e formas de pagamento estão na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(vaga|vagas|tem vaga|ainda tem|disponivel|disponível)\b/.test(q)) {
    if (soldOut) {
      return `Esse passeio está com as vagas encerradas no momento. 🌿 Confira outros passeios na Agenda dos Trilheiros no link da bio.`;
    }
    return `Sim 😊 As reservas para ${trip} estão abertas. ${end}`;
  }

  if (/\b(data|dia|quando)\b/.test(q)) {
    if (date) return `📅 ${trip} está programado para ${date}. ${end}`;
    return `📅 As informações de data de ${trip} estão na publicação e na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(horario|horário|saida|saída|retorno|que horas)\b/.test(q)) {
    if (times.length) return `⏰ Os horários informados para ${trip} são: ${times.join(" / ")}. ${end}`;
    return `⏰ Os horários completos de ${trip} estão na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(crianca|criança|criancas|crianças|idade|anos|menor)\b/.test(q)) {
    if (child) return `👧👦 Sobre crianças/idade em ${trip}: ${child}. ${end}`;
    return `👧👦 As regras de idade para ${trip} estão na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(nivel|nível|dificuldade|dificil|difícil|facil|fácil|moderado)\b/.test(q)) {
    if (level) return `🥾 O nível informado para ${trip} é ${level}. ${end}`;
    return `🥾 A dificuldade de ${trip} está detalhada na publicação e na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(inclui|incluso|incluido|incluído|o que vem|o que esta incluso|o que está incluso)\b/.test(q)) {
    if (included) return `✅ Sobre o que está incluso em ${trip}: ${included}. ${end}`;
    return `✅ O que está incluso em ${trip} está detalhado na Agenda dos Trilheiros. ${end}`;
  }

  if (/\b(guia|quem e o guia|quem é o guia|responsavel|responsável)\b/.test(q)) {
    return `🥾 O responsável pelos Trilheiros de Rondonópolis é Jonatas Marruda, Guia/Condutor de Turismo, que acompanha e organiza as experiências do grupo. ${end}`;
  }

  if (/\b(quero ir|quero participar|como participar|como faco|como faço|reservar|reserva|inscricao|inscrição|eu quero|bora)\b/.test(q)) {
    return `Bora! 😍 As reservas para ${trip} estão abertas. ${end}`;
  }

  if (/\b(onde|local|localizacao|localização|ponto de encontro)\b/.test(q)) {
    return `📍 Os detalhes de localização e ponto de encontro de ${trip} ficam na publicação/agenda oficial. ${end}`;
  }

  if (/lindo|maravilh|top|show|amei|incrivel|incrível|sensacional|parabens|parabéns|👏|❤️|😍/.test(q)) {
    return `${pick(["Muito obrigado! 😍", "Que bom que gostou! 💚", "Valeu demais! 🥾🌿", "Ficamos felizes que tenha curtido! 😍"], commentId)} ${pick(["Vem viver uma experiência com a gente também.", "Acompanhe os próximos passeios.", "Esperamos você numa próxima aventura."], commentText)} Confira a Agenda dos Trilheiros no link da bio.`;
  }

  return `Oi! 😊 Sobre ${trip}, a gente te ajuda sim. ${end}`;
}

async function graph(path, init = {}) {
  const accessToken = env("META_ACCESS_TOKEN");
  const base = env("META_GRAPH_BASE") || "https://graph.facebook.com";
  const version = env("META_GRAPH_VERSION") || "v24.0";
  if (!accessToken) throw new Error("META_ACCESS_TOKEN não configurado");

  const url = new URL(`${base}/${version}/${path}`);
  url.searchParams.set("access_token", accessToken);
  return fetch(url, init);
}

async function getMediaCaption(mediaId) {
  if (!mediaId) return "";
  const response = await graph(`${mediaId}?fields=caption,permalink`);
  if (!response.ok) {
    console.error("Falha ao buscar mídia", response.status, await response.text());
    return "";
  }
  const data = await response.json();
  return data.caption || "";
}

async function replyToComment(commentId, message) {
  const response = await graph(`${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message }),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Falha ao responder comentário: ${response.status} ${body}`);
  return body;
}

function extractCommentEvents(payload) {
  const events = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "comments") continue;
      const value = change?.value || {};
      const commentId = value.id || value.comment_id;
      const text = value.text || "";
      const username = value.from?.username || value.username || "";
      const mediaId = value.media?.id || value.media_id || "";
      const parentId = value.parent_id || value.parent?.id || "";
      if (commentId) events.push({ commentId, text, username, mediaId, parentId });
    }
  }
  return events;
}

export default async (req, context) => {
  const verifyToken = env("META_VERIFY_TOKEN");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && verifyToken && token === verifyToken) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("Webhook verification failed", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const events = extractCommentEvents(payload);
  if (!events.length) return new Response("EVENT_RECEIVED", { status: 200 });

  context.waitUntil((async () => {
    for (const event of events.slice(0, 5)) {
      try {
        if (event.parentId) continue;
        if (normalize(event.username) === INSTAGRAM_USERNAME) continue;
        if (!event.text.trim()) continue;

        const caption = await getMediaCaption(event.mediaId);
        const reply = buildReply({
          commentId: event.commentId,
          commentText: event.text,
          caption,
        });
        await replyToComment(event.commentId, reply);
        console.log("Respondido", event.commentId, reply);
      } catch (error) {
        console.error("Erro no comentário", event.commentId, error);
      }
    }
  })());

  return new Response("EVENT_RECEIVED", { status: 200 });
};

export const config = {
  path: "/instagram/webhook",
};
