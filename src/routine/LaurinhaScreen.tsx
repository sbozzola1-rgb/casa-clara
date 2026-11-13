import { useEffect, useRef, useState, type FormEvent } from 'react'
import { askLaurinha, loadChat, saveChat, type ChatTurn } from './laurinha.ts'
import { useRoutine } from './store.tsx'

const IDEAS = ['O que eu tenho hoje?', 'Por que o céu é azul?', 'Me explica o que é uma fração']

export function LaurinhaScreen() {
  const { state, today } = useRoutine()
  const name = state.profile?.name.trim() || 'Laura'
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadChat())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveChat(turns)
  }, [turns])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [turns, busy])

  const send = (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    const history = turns
    setTurns((current) => [...current, { role: 'user', text: question }])
    setDraft('')
    setBusy(true)
    void askLaurinha(question, history, state, today)
      .then((answer) => {
        setTurns((current) => [...current, { role: 'model', text: answer }])
      })
      .finally(() => setBusy(false))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Laurinha</h1>
          <p className="mt-1 max-w-xl text-[var(--soft)]">Pergunta o que você quiser. Eu explico com palavras fáceis, {name}.</p>
        </div>
        {turns.length > 0 ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setTurns([])
              saveChat([])
            }}
          >
            Apagar a conversa
          </button>
        ) : null}
      </div>

      <div className="card grid gap-3 px-6 py-6">
        {turns.length === 0 ? (
          <div className="grid gap-3">
            <p className="font-extrabold">Oi, {name}. Eu sou a Laurinha. Pode perguntar da sua rotina ou de qualquer coisa que você queira entender.</p>
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" className="choice" onClick={() => send(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <p
              key={`${turn.role}-${index}`}
              className={
                turn.role === 'user'
                  ? 'ml-8 justify-self-end rounded-[1.4rem] bg-gradient-to-br from-pink-300 to-violet-300 px-4 py-3 font-extrabold text-white'
                  : 'mr-8 whitespace-pre-wrap rounded-[1.4rem] bg-white px-4 py-3 font-bold'
              }
            >
              {turn.text}
            </p>
          ))
        )}
        {busy ? <p className="text-sm font-extrabold text-[var(--soft)]">Estou pensando…</p> : null}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="card mt-4 flex gap-2 px-4 py-3">
        <label className="sr-only" htmlFor="laurinha-pergunta">
          Sua pergunta
        </label>
        <input
          id="laurinha-pergunta"
          className="field-input"
          value={draft}
          maxLength={400}
          placeholder="Escreve aqui a sua pergunta"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy || draft.trim().length === 0}>
          Perguntar
        </button>
      </form>

    </div>
  )
}
