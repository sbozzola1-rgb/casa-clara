import { useState, type ReactNode } from 'react'
import { ConfirmDialog, Modal } from '../components/Modal.tsx'
import { Button, EmptyState, Field, PageIntro, Panel, fieldClass } from '../components/ui.tsx'
import { addDays, formatFriendly, formatISO, startOfDay, todayISO } from '../lib/dates.ts'
import { uid } from '../lib/money.ts'
import { TASK_ASSIGNEES, type HouseTask, type TaskAssignee, type TaskTag } from '../lib/types.ts'
import { useStore } from '../state.tsx'

type WhoFilter = 'todos' | TaskAssignee
type DateFilter = 'todas' | 'atrasadas' | 'semana' | 'sem-data'

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'sem-data', label: 'Sem data' },
]

export function TodoPage() {
  const { state, upsertTask, removeTask, setTaskDone, addTaskTag, removeTaskTag } = useStore()
  const [editing, setEditing] = useState<HouseTask | null | 'new'>(null)
  const [removing, setRemoving] = useState<HouseTask | null>(null)
  const [who, setWho] = useState<WhoFilter>('todos')
  const [when, setWhen] = useState<DateFilter>('todas')
  const [tagId, setTagId] = useState<string | null>(null)
  const [tagName, setTagName] = useState('')
  const tags = [...(state.taskTags ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const today = todayISO()
  const week = weekBounds(new Date())
  const visible = state.tasks
    .filter((task) => matchesWho(task, who) && matchesWhen(task, when, today, week) && matchesTag(task, tagId))
    .sort(compareTasks)
  const open = visible.filter((task) => !task.done)
  const done = visible.filter((task) => task.done)
  const filteredEmpty = state.tasks.length > 0 && visible.length === 0

  const createTag = () => {
    if (!addTaskTag(tagName)) return
    setTagName('')
  }

  return (
    <div>
      <PageIntro
        eyebrow="Lista da casa"
        title="To do"
        description="Tarefas de vocês dois, com data limite, responsável e tags. Marcar como feita tira da lista de cima."
        action={<Button onClick={() => setEditing('new')}>Nova tarefa</Button>}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-card px-4 py-4 sm:px-5">
        <FilterRow label="Quem">
          <FilterChip active={who === 'todos'} onClick={() => setWho('todos')}>Todos</FilterChip>
          {TASK_ASSIGNEES.map((person) => (
            <FilterChip key={person.id} active={who === person.id} onClick={() => setWho(person.id)}>
              {person.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Data limite">
          {DATE_FILTERS.map((item) => (
            <FilterChip key={item.id} active={when === item.id} onClick={() => setWhen(item.id)}>
              {item.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Tag">
          <FilterChip active={tagId === null} onClick={() => setTagId(null)}>Todas</FilterChip>
          {tags.map((tag) => (
            <FilterChip key={tag.id} active={tagId === tag.id} onClick={() => setTagId(tagId === tag.id ? null : tag.id)}>
              {tag.name}
            </FilterChip>
          ))}
        </FilterRow>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            createTag()
          }}
        >
          <input
            className={`${fieldClass} max-w-xs`}
            value={tagName}
            placeholder="Nova tag"
            aria-label="Nova tag"
            onChange={(event) => setTagName(event.target.value)}
          />
          <Button variant="secondary" type="submit" disabled={!tagName.trim()}>
            Criar tag
          </Button>
        </form>
      </div>

      {state.tasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa" text="Crie a primeira tarefa da casa." action={<Button onClick={() => setEditing('new')}>Nova tarefa</Button>} />
      ) : filteredEmpty ? (
        <EmptyState title="Nada com esses filtros" text="Troque o responsável, a data ou a tag para ver outras tarefas." />
      ) : (
        <div className="grid gap-4">
          <TaskList title="Para fazer" tasks={open} tags={tags} today={today} empty="Nada pendente." onEdit={setEditing} onDone={setTaskDone} />
          {done.length > 0 ? <TaskList title="Feitas" tasks={done} tags={tags} today={today} onEdit={setEditing} onDone={setTaskDone} /> : null}
        </div>
      )}

      {editing !== null ? (
        <TaskDialog
          task={editing === 'new' ? null : editing}
          tags={tags}
          onClose={() => setEditing(null)}
          onSave={upsertTask}
          onCreateTag={addTaskTag}
          onRemoveTag={removeTaskTag}
          onRemove={(task) => {
            setEditing(null)
            setRemoving(task)
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir tarefa"
          text={`Excluir ${removing.title}?`}
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeTask(removing.id)
            setRemoving(null)
          }}
        />
      ) : null}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition ${active ? 'bg-moss text-white dark:text-night' : 'bg-paper text-ink hover:bg-hover'}`}
    >
      {children}
    </button>
  )
}

function TaskList({
  title,
  tasks,
  tags,
  today,
  empty,
  onEdit,
  onDone,
}: {
  title: string
  tasks: HouseTask[]
  tags: TaskTag[]
  today: string
  empty?: string
  onEdit: (task: HouseTask) => void
  onDone: (id: string, done: boolean) => void
}) {
  return (
    <Panel title={title} action={<span className="text-sm text-ink-soft">{tasks.length}</span>}>
      {tasks.length === 0 && empty ? <p className="text-sm text-ink-soft">{empty}</p> : null}
      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const assignee = TASK_ASSIGNEES.find((item) => item.id === task.assignee)?.label
          const late = Boolean(task.dueDate && task.dueDate < today && !task.done)
          const names = (task.tagIds ?? []).map((id) => tags.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name))
          return (
            <li key={task.id} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-moss"
                checked={task.done}
                aria-label={task.done ? `Reabrir ${task.title}` : `Marcar ${task.title} como feita`}
                onChange={() => onDone(task.id, !task.done)}
              />
              <button type="button" onClick={() => onEdit(task)} className="min-w-0 flex-1 text-left">
                <span className={`block ${task.done ? 'text-ink-soft line-through' : 'font-medium'}`}>{task.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                  {assignee ? <span>{assignee}</span> : null}
                  {task.dueDate ? <span className={late ? 'font-medium text-clay' : ''}>{late ? 'Atrasada · ' : ''}{formatFriendly(task.dueDate)}</span> : null}
                  {names.map((name) => (
                    <span key={name} className="rounded-full bg-paper px-2 py-0.5">{name}</span>
                  ))}
                </span>
                {task.note ? <span className="mt-0.5 block text-xs text-ink-soft">{task.note}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function TaskDialog({
  task,
  tags,
  onClose,
  onSave,
  onCreateTag,
  onRemoveTag,
  onRemove,
}: {
  task: HouseTask | null
  tags: TaskTag[]
  onClose: () => void
  onSave: (task: HouseTask) => void
  onCreateTag: (name: string) => string
  onRemoveTag: (id: string) => void
  onRemove: (task: HouseTask) => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [assignee, setAssignee] = useState<TaskAssignee | null>(task?.assignee ?? null)
  const [tagIds, setTagIds] = useState<string[]>(task?.tagIds ?? [])
  const [tagName, setTagName] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    const name = title.trim()
    if (!name) {
      setError('Escreva a tarefa.')
      return
    }
    onSave({
      id: task?.id ?? uid(),
      title: name,
      note: note.trim(),
      done: task?.done ?? false,
      dueDate: dueDate || null,
      assignee,
      tagIds: tagIds.filter((id) => tags.some((tag) => tag.id === id)),
    })
    onClose()
  }

  const createTag = () => {
    const id = onCreateTag(tagName)
    if (!id) return
    setTagName('')
    setTagIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  return (
    <Modal
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      description="Título, data limite, quem faz e as tags da casa."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {task ? (
            <Button variant="danger" onClick={() => onRemove(task)}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Tarefa">
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </Field>
        <Field label="Data limite">
          <input className={fieldClass} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Quem vai fazer</span>
          <div className="flex flex-wrap gap-2">
            {TASK_ASSIGNEES.map((person) => (
              <FilterChip key={person.id} active={assignee === person.id} onClick={() => setAssignee(assignee === person.id ? null : person.id)}>
                {person.label}
              </FilterChip>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Tags</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center">
                <FilterChip active={tagIds.includes(tag.id)} onClick={() => setTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>
                  {tag.name}
                </FilterChip>
                <button type="button" className="px-1 text-xs text-ink-soft hover:text-clay" aria-label={`Apagar tag ${tag.name}`} onClick={() => {
                  onRemoveTag(tag.id)
                  setTagIds((current) => current.filter((id) => id !== tag.id))
                }}>
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 ? <span className="text-sm text-ink-soft">Nenhuma tag ainda.</span> : null}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              createTag()
            }}
          >
            <input className={fieldClass} value={tagName} placeholder="Nova tag" aria-label="Nome da nova tag" onChange={(event) => setTagName(event.target.value)} />
            <Button variant="secondary" type="submit" disabled={!tagName.trim()}>Criar</Button>
          </form>
        </div>
        <Field label="Nota">
          <textarea className={`${fieldClass} min-h-24 resize-y`} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </Modal>
  )
}

function matchesWho(task: HouseTask, who: WhoFilter): boolean {
  if (who === 'todos') return true
  if (who === 'ambos') return task.assignee === 'ambos'
  return task.assignee === who || task.assignee === 'ambos'
}

function matchesWhen(task: HouseTask, when: DateFilter, today: string, week: { start: string; end: string }): boolean {
  if (when === 'todas') return true
  if (when === 'sem-data') return !task.dueDate
  if (!task.dueDate) return false
  if (when === 'atrasadas') return task.dueDate < today
  return task.dueDate >= week.start && task.dueDate <= week.end
}

function matchesTag(task: HouseTask, tagId: string | null): boolean {
  if (!tagId) return true
  return (task.tagIds ?? []).includes(tagId)
}

function compareTasks(a: HouseTask, b: HouseTask): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, 'pt-BR')
  if (a.dueDate) return -1
  if (b.dueDate) return 1
  return a.title.localeCompare(b.title, 'pt-BR')
}

function weekBounds(today: Date): { start: string; end: string } {
  const day = startOfDay(today).getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = addDays(startOfDay(today), mondayOffset)
  return { start: formatISO(start), end: formatISO(addDays(start, 6)) }
}
