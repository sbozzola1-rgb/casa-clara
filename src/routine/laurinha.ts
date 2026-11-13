import {
  dateKey,
  formatLong,
  formatShort,
  homeworkKey,
  schoolOccurs,
  todayTasks,
  type RoutineState,
} from './model.ts'

const KEY_STORE = 'casa-clara.rotina.laurinha-key'
const CHAT_STORE = 'casa-clara.rotina.laurinha-chat'
const MODELS: { name: string; generationConfig: Record<string, unknown> }[] = [
  { name: 'gemini-flash-lite-latest', generationConfig: { temperature: 0.6, maxOutputTokens: 500 } },
  {
    name: 'gemini-3.5-flash',
    generationConfig: { temperature: 0.6, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
  },
]

export type ChatTurn = { role: 'user' | 'model'; text: string }

export function readAgentKey() {
  try {
    const saved = localStorage.getItem(KEY_STORE)?.trim()
    if (saved) return saved
  } catch {
    // aba privada pode bloquear o armazenamento
  }
  const fromEnv = import.meta.env.VITE_LAURINHA_KEY
  return typeof fromEnv === 'string' ? fromEnv.trim() : ''
}

export function saveAgentKey(value: string) {
  const next = value.trim()
  try {
    if (next) localStorage.setItem(KEY_STORE, next)
    else localStorage.removeItem(KEY_STORE)
  } catch {
    // a chave continua só na memória desta abertura
  }
}

export function loadChat(): ChatTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_STORE) || '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((item): item is ChatTurn => {
        if (!item || typeof item !== 'object') return false
        const turn = item as { role?: unknown; text?: unknown }
        return (turn.role === 'user' || turn.role === 'model') && typeof turn.text === 'string' && turn.text.trim().length > 0
      })
      .slice(-24)
  } catch {
    return []
  }
}

export function saveChat(turns: ChatTurn[]) {
  try {
    localStorage.setItem(CHAT_STORE, JSON.stringify(turns.slice(-24)))
  } catch {
    // a conversa segue só nesta tela
  }
}

function clock(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return ''
  const [hour, minute] = time.split(':')
  return minute === '00' ? `${Number(hour)}h` : `${Number(hour)}h${minute}`
}

export function dayFacts(state: RoutineState, date: Date) {
  const name = state.profile?.name.trim() || 'Laura'
  const lines: string[] = [`Nome: ${name}`, `Hoje: ${formatLong(date)} (${dateKey(date)})`]

  const school = state.school
    .filter((item) => schoolOccurs(item, date))
    .sort((a, b) => a.start.localeCompare(b.start))
  lines.push(school.length ? 'Aulas e momentos da escola hoje:' : 'Nenhuma aula escrita para hoje.')
  for (const item of school) {
    const when = [clock(item.start), clock(item.end)].filter(Boolean).join(' até ')
    const extra = item.materials.trim() ? ` Lembrete: ${item.materials.trim()}.` : ''
    lines.push(`- ${item.title}${when ? `, ${when}` : ''}.${extra}`)
  }

  const tasks = todayTasks(state, date)
  const activities = tasks.filter((item) => item.kind === 'activity')
  const meals = tasks.filter((item) => item.kind === 'meal')
  lines.push(activities.length ? 'Atividades de hoje:' : 'Nenhuma atividade escrita para hoje.')
  for (const item of activities) {
    const when = clock(item.time)
    lines.push(`- ${item.title}${when ? ` às ${when}` : ''}${item.done ? ' (já fez)' : ''}.`)
  }
  lines.push(meals.length ? 'Refeições de hoje:' : 'Nenhuma refeição escrita para hoje.')
  for (const item of meals) {
    const when = clock(item.time)
    lines.push(`- ${item.title}${when ? ` às ${when}` : ''}${item.done ? ' (já fez)' : ''}.`)
  }

  const homework = state.homework.filter((item) => !state.done[homeworkKey(item.id)])
  lines.push(homework.length ? 'Lição que ainda não foi marcada como feita:' : 'Nenhuma lição aberta.')
  for (const item of homework) {
    const due = item.due ? ` Para ${formatShort(item.due)}.` : ''
    const note = item.note.trim() ? ` ${item.note.trim()}.` : ''
    lines.push(`- ${item.subject}: ${item.title}.${due}${note}`)
  }

  return { name, text: lines.join('\n') }
}

const GROWN_UP =
  /\b(sexo|porn[oô]|pelad[oa]s?|nudez|transar|suicid|se matar|me matar|como matar|bomba caseira|coca[ií]na|maconha|cheirar cola)\b/i

export function grownUpReply(name: string) {
  return `${name}, essa pergunta é coisa de gente grande. Chama a mamãe e pergunta para ela. Se quiser, eu explico outra coisa.`
}

function wantsHerDay(question: string) {
  return /hoje|rotina|aula|escola|li[cç][aã]o|tarefa|almo[cç]o|jantar|lanche|refei[cç][aã]o|atividade|o que (eu )?tenho|hor[aá]rio|mat[eé]ria/i.test(question)
}

export function routineReply(name: string, facts: string) {
  const body = facts
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2))
  if (body.length === 0) {
    return `${name}, hoje não tem nada escrito na sua rotina. Se achar que esqueceu alguma coisa, pergunta para a mamãe.`
  }
  return `${name}, olha o que está escrito para você:\n${body.map((line) => `• ${line}`).join('\n')}`
}

function systemPrompt(name: string, facts: string) {
  return [
    `Você é a Laurinha, a amiga que explica as coisas para ${name}.`,
    'Fale português do Brasil, como quem conversa com uma criança de cerca de 8 anos.',
    'Frases curtas. Uma ideia de cada vez. Quando ajudar, dê um exemplo do dia a dia.',
    'Tom carinhoso, sem falar como bebê e sem usar palavra difícil. Se uma palavra difícil for necessária, explique na hora.',
    'Responda em no máximo 8 frases.',
    'Sobre a rotina dela, use somente os fatos abaixo. Se não estiver escrito, diga que não sabe e que ela pode perguntar para a mamãe. Não invente horário, nota, lição nem combinado.',
    'Você não guarda segredo da mamãe.',
    'Não peça senha, endereço, nome da escola nem foto.',
    'Se a pergunta for de gente grande, sobre sexo, violência, se machucar, drogas ou armas, diga com calma que isso é assunto da mamãe.',
    'Não dê passo a passo de nada perigoso.',
    'Se ela estiver triste ou com medo, seja gentil e diga para chamar a mamãe ou um adulto de confiança.',
    'Sua voz já está ligada. Nunca peça para ativar, ligar ou guardar voz, chave ou ajuste.',
    '',
    'Fatos:',
    facts,
  ].join('\n')
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export function voiceNag(text: string) {
  return /ligar a minha voz|ativar a voz|guard(ar|e) a chave|ajustes deste tablet/i.test(text)
}

async function askModel(question: string, history: ChatTurn[], name: string, facts: string, key: string) {
  const remembered = history.filter((turn) => !voiceNag(turn.text)).slice(-8)
  const contents = [...remembered, { role: 'user' as const, text: question }].map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }))
  let lastStatus = 0
  for (const model of MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(name, facts) }] },
          contents,
          generationConfig: model.generationConfig,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      },
    )
    const data = (await response.json()) as GeminiResponse
    if (data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason === 'SAFETY') return grownUpReply(name)
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
    if (text) return text
    lastStatus = response.status
    if (response.ok) return `${name}, eu travei nessa. Pergunta de outro jeito, ou chama a mamãe.`
    if (response.status !== 404 && response.status !== 429 && response.status !== 503) break
  }
  if (lastStatus === 404 || lastStatus === 429 || lastStatus === 503) {
    return `${name}, a minha voz de explicar o mundo está cheia agora. Tenta de novo daqui a pouquinho.`
  }
  throw new Error('sem resposta')
}

export async function askLaurinha(question: string, history: ChatTurn[], state: RoutineState, date: Date) {
  const clean = question.trim().slice(0, 400)
  const { name, text } = dayFacts(state, date)
  if (!clean) return `${name}, escreve a sua pergunta.`
  if (GROWN_UP.test(clean)) return grownUpReply(name)
  const key = readAgentKey()
  if (!key) {
    if (wantsHerDay(clean)) return routineReply(name, text)
    return `${name}, eu já sei te contar a sua rotina. Para explicar o resto do mundo, a mamãe precisa ligar a minha voz nos ajustes deste tablet.`
  }
  try {
    return await askModel(clean, history, name, text, key)
  } catch {
    if (wantsHerDay(clean)) return routineReply(name, text)
    return `${name}, a minha voz de explicar o mundo não respondeu agora. Tenta de novo daqui a pouquinho. A sua rotina eu continuo sabendo.`
  }
}
