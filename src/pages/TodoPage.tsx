import { useState } from 'react'
import { ConfirmDialog, Modal } from '../components/Modal.tsx'
import { Button, EmptyState, Field, PageIntro, Panel, fieldClass } from '../components/ui.tsx'
import { uid } from '../lib/money.ts'
import type { HouseTask } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function TodoPage() {
  const { state, upsertTask, removeTask, setTaskDone } = useStore()
  const [editing, setEditing] = useState<HouseTask | null | 'new'>(null)
  const [removing, setRemoving] = useState<HouseTask | null>(null)
  const open = state.tasks.filter((task) => !task.done)
  const done = state.tasks.filter((task) => task.done)

  return (
    <div>
      <PageIntro
        eyebrow="Lista da casa"
        title="To do"
        description="Tarefas de vocês dois. Marcar como feita tira da lista de cima. O que um criar, o outro vê."
        action={<Button onClick={() => setEditing('new')}>Nova tarefa</Button>}
      />

      {state.tasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa" text="Crie a primeira tarefa da casa." action={<Button onClick={() => setEditing('new')}>Nova tarefa</Button>} />
      ) : (
        <div className="grid gap-4">
          <TaskList title="Para fazer" tasks={open} empty="Nada pendente." onEdit={setEditing} onDone={setTaskDone} />
          {done.length > 0 ? <TaskList title="Feitas" tasks={done} onEdit={setEditing} onDone={setTaskDone} /> : null}
        </div>
      )}

      {editing !== null ? (
        <TaskDialog
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={upsertTask}
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

function TaskList({
  title,
  tasks,
  empty,
  onEdit,
  onDone,
}: {
  title: string
  tasks: HouseTask[]
  empty?: string
  onEdit: (task: HouseTask) => void
  onDone: (id: string, done: boolean) => void
}) {
  return (
    <Panel title={title} action={<span className="text-sm text-ink-soft">{tasks.length}</span>}>
      {tasks.length === 0 && empty ? <p className="text-sm text-ink-soft">{empty}</p> : null}
      <ul className="divide-y divide-line">
        {tasks.map((task) => (
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
              {task.note ? <span className="mt-0.5 block text-xs text-ink-soft">{task.note}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function TaskDialog({
  task,
  onClose,
  onSave,
  onRemove,
}: {
  task: HouseTask | null
  onClose: () => void
  onSave: (task: HouseTask) => void
  onRemove: (task: HouseTask) => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [error, setError] = useState('')

  const save = () => {
    const name = title.trim()
    if (!name) {
      setError('Escreva a tarefa.')
      return
    }
    onSave({ id: task?.id ?? uid(), title: name, note: note.trim(), done: task?.done ?? false })
    onClose()
  }

  return (
    <Modal
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      description="Um título basta. A nota é para o detalhe, se precisar."
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
        <Field label="Nota">
          <textarea className={`${fieldClass} min-h-24 resize-y`} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </Modal>
  )
}
