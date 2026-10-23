import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useInsightsStore } from '../../store/useInsightsStore'
import { useInsightsReminderStore } from '../../store/useInsightsReminderStore'
import { useVoiceRecorderStore } from '../../store/useVoiceRecorderStore'
import { useTasksStore } from '../../store/useTasksStore'
import { useChatColorsStore } from '../../store/useChatColorsStore'
import { PRINCIPLES_PROMPT } from '../../store/usePrinciplesStore'
import { formatDateBadge, TASK_BULLET, messageHasTask, isTaskLine, isTaskLineDone, taskLineText, toggleTaskLineInText, insertTaskContinuation, todayISO } from './taskLogic'
import { syncRoutineTaskStatus } from './dailyRoutineTasks'
import { useAutoGrowTextarea } from './useAutoGrowTextarea'
import { useDragReorder } from './useDragReorder'
import { useLocalMediaUrl } from './useLocalMediaUrl'
import { getLocalMedia, saveLocalMedia } from '../../storage/localMedia'
import VoicePlayer from './VoicePlayer'
import VoiceRecorderPanel from './VoiceRecorderPanel'
import { IconPaperclip, IconMic, IconMoreVertical, IconCopy, IconPalette } from '../../icons/Icons'

// Preset swatches for the bubble color picker (see the popover in
// InsightsChat's own return) — all soft pastels (per user request, "плотные
// сообщения не нужны" — no more saturated/dark picks), matching Входящие's
// own mint/khaki bubbles. readableBubbleTextColor below still auto-picks
// dark text for these (and would fall back to white for any darker custom
// color entered another way).
// Spread across the hue wheel (per user report — the earlier set was too
// low-saturation to tell apart, lots of near-identical pastels) instead of
// several near-duplicate mints/tans — each one distinct at a glance.
const BUBBLE_COLOR_SWATCHES = [
  '#f2b8b5', '#f5cba0', '#f0da8c', '#d9e39a',
  '#aedca8', '#9fd9be', '#9bd8d3', '#9ecbe0',
  '#c5dcf8', '#d6d0f8', '#e3cef4', '#f2c9ef',
  '#dcdee1', '#f3d2bc', '#f3e4b4', '#cde2c6',
]

// Picks white or near-black bubble text depending on the background's own
// luminance — a custom color can be light (pastel, like Входящие's mint/
// khaki) or dark, and a fixed white text only works for the dark half.
function readableBubbleTextColor(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '')
  if (!m) return '#ffffff'
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16))
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#2a2110' : '#ffffff'
}

// Web version's neon skin (styles/neon.css): a bubble is drawn from one hue
// (--bh) as a dark tinted fill, bright text and a glowing rim. A custom color
// is pushed to a saturated, mid-light version of its own hue first, so soft
// pastels still read as neon. The stored color itself is left untouched — it
// is shared with the Mac app.
const isNeonSkin = () => typeof document !== 'undefined' && document.documentElement.dataset.skin === 'neon'
function neonHue(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '')
  if (!m) return hex
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = Math.round(h * 60 + 360) % 360
  const sat = d === 0 ? 0 : 90
  return `hsl(${h} ${sat}% 62%)`
}
function bubbleColorStyle(color) {
  if (!color) return null
  return isNeonSkin() ? { '--bh': neonHue(color) } : { background: color, color: readableBubbleTextColor(color) }
}
import EmptyStateCelebration from './EmptyStateCelebration'

// Full "14 August 2026"-style date for a sent voice message (per user
// request, shown under the player) — deliberately not formatDateBadge's
// relative "Today"/"Tomorrow" short form, which is for the day-divider
// pill above a whole group, not a specific recording's own date.
function formatVoiceDate(iso, language) {
  const d = new Date(`${iso}T00:00:00`)
  try {
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  }
}

// Bare-URL auto-linkify — the "links" half of "links, photos, voice". No
// open-graph preview cards (see the plan's scope note): fetching a URL's
// title/image is a real backend piece with nothing to reuse here.
function linkify(text) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => (
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>
      : <span key={i}>{part}</span>
  ))
}

// Renders message text line-by-line so a "○ "/"● " task line (see
// taskLogic.js) becomes a clickable circle instead of plain text — the rest
// of the message (any non-task lines) still runs through linkify() as before.
function renderMessageText(text, onToggleLine, selecting) {
  return text.split('\n').map((line, i) => {
    if (!isTaskLine(line)) {
      // An empty line is a deliberate paragraph gap — a bare empty <div>
      // has zero height, so it needs a <br> to actually show as space.
      return <div key={i}>{line === '' ? <br /> : linkify(line)}</div>
    }
    const done = isTaskLineDone(line)
    return (
      <div key={i} className="insights-chat__task-line">
        <button
          type="button"
          className={'insights-chat__task-toggle' + (done ? ' insights-chat__task-toggle--done' : '')}
          // While multi-select is active, let the click fall through to the
          // bubble's own onClick (toggles the message's selection) instead
          // of flipping the task line — same reasoning as the <a> guard
          // just above this in MessageBubble.
          onClick={selecting ? undefined : (e) => { e.stopPropagation(); onToggleLine(i) }}
        >
          {done ? '●' : '○'}
        </button>
        <span className={done ? 'insights-chat__task-text--done' : undefined}>{linkify(taskLineText(line))}</span>
      </div>
    )
  })
}

function formatTime(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Groups the flat, already-chronological message list into per-day chunks
// so a date-divider pill (see .insights-chat__day-divider) can sit above
// each one, same idea as Telegram's own day dividers in the screenshot.
function groupByDay(messages) {
  const groups = []
  let current = null
  messages.forEach((m) => {
    const dateKey = m.createdAt.slice(0, 10)
    if (!current || current.dateKey !== dateKey) {
      current = { dateKey, items: [] }
      groups.push(current)
    }
    current.items.push(m)
  })
  return groups
}

// Shown where a photo/voice/file blob isn't on this device (recorded
// elsewhere — media never goes through Firestore). Lets the user pick the
// file they downloaded on the other device; it's stored under the same
// message id, so the bubble then plays/shows it.
function MediaUnavailable({ localKey }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !localKey) return
    try {
      await saveLocalMedia(localKey, file)
      setFailed(false)
    } catch (err) {
      console.error('Failed to save uploaded media', err)
      setFailed(true)
    }
  }
  return (
    <div className="insights-chat__media-unavailable">
      {t('insights.mediaUnavailable')}
      {localKey && (
        <>
          {' · '}
          <button type="button" className="insights-chat__media-upload" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
            {t('insights.uploadMedia')}
          </button>
          <input ref={inputRef} type="file" hidden onChange={onPick} />
        </>
      )}
      {failed && <span> {t('insights.uploadMediaFailed')}</span>}
    </div>
  )
}

function MessageBubble({ message, onEdit, onDelete, onToggleDone, onToggleTaskLine, showCheckbox, isReminder, selecting, selected, onToggleSelected, onStartSelect, bubbleColors }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(message.text)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)
  const bubbleRef = useRef(null)
  // Bubble's rendered size at the moment editing starts — keeps the editor
  // the same size as the message instead of collapsing to the textarea's
  // own min size.
  const [editSize, setEditSize] = useState(null)
  const copiedTimeoutRef = useRef(null)
  const menuRef = useRef(null)
  const localMediaUrl = useLocalMediaUrl(message.mediaLocalKey)
  const canSelect = !isReminder
  const downloadMedia = async () => {
    setMenuOpen(false)
    const blob = await getLocalMedia(message.mediaLocalKey)
    if (!blob) return
    const ext = (blob.type.split('/')[1] || 'bin').split(';')[0]
    const name = message.fileName || `${message.type}-${message.createdAt.slice(0, 16).replace(/[-:T]/g, '')}.${ext}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const isTask = message.type === 'text' && messageHasTask(message.text)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => () => clearTimeout(copiedTimeoutRef.current), [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const startEditing = () => {
    if (message.type !== 'text') return
    const rect = bubbleRef.current?.getBoundingClientRect()
    setEditSize(rect ? { width: rect.width, minHeight: rect.height } : null)
    setValue(message.text)
    setEditing(true)
    setMenuOpen(false)
  }

  const save = () => {
    onEdit(value)
    setEditing(false)
  }

  const copyText = () => {
    navigator.clipboard?.writeText(message.text || '')
    setCopied(true)
    clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="insights-chat__row">
      {selecting && canSelect && (
        <button
          type="button"
          className={'insights-chat__select-checkbox' + (selected ? ' insights-chat__select-checkbox--checked' : '')}
          onClick={onToggleSelected}
          aria-label={t(selected ? 'insights.deselectMessage' : 'insights.selectMessage')}
        >
          {selected ? '✓' : ''}
        </button>
      )}

      {!editing && !selecting && (
        <span className="insights-chat__actions">
          {message.type === 'text' && (
            <button
              type="button"
              className="insights-chat__edit"
              onClick={copyText}
              aria-label={t('insights.copyMessage')}
              title={copied ? t('insights.copied') : t('insights.copyMessage')}
            >
              <IconCopy size={13} />
            </button>
          )}
          {confirmingDelete ? (
            <span className="insights-chat__confirm">
              <button type="button" onClick={onDelete}>{t('tasks.yes')}</button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>{t('tasks.no')}</button>
            </span>
          ) : (
            <span className="project-row__menu" ref={menuRef}>
              <button
                type="button"
                className="insights-chat__edit"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t('tasks.openMenu')}
                title={t('tasks.openMenu')}
              >
                <IconMoreVertical size={13} />
              </button>
              {menuOpen && (
                <div className="project-row__menu-dropdown">
                  {message.type === 'text' && (
                    <button type="button" onClick={startEditing}>{t('insights.editMessage')}</button>
                  )}
                  {message.type !== 'text' && localMediaUrl && (
                    <button type="button" onClick={downloadMedia}>{t('insights.downloadMedia')}</button>
                  )}
                  {canSelect && (
                    <button type="button" onClick={() => { onStartSelect(); setMenuOpen(false) }}>
                      {t('insights.selectMessage')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="project-row__menu-danger"
                    onClick={() => { setConfirmingDelete(true); setMenuOpen(false) }}
                  >
                    {t('tasks.deleteTask')}
                  </button>
                </div>
              )}
            </span>
          )}
        </span>
      )}

      {/* No "processed" checkbox here for Reference Info (per user request
          — no room for it) — that section is a lookup list, not a
          processing queue like Insights. */}
      {showCheckbox && (
        <button
          type="button"
          className={'insights-chat__checkbox' + (message.done ? ' insights-chat__checkbox--checked' : '')}
          onClick={onToggleDone}
          aria-label={t('insights.markProcessed')}
          title={t('insights.markProcessed')}
        >
          {message.done ? '✓' : ''}
        </button>
      )}

      <div
        ref={bubbleRef}
        style={{
          ...(editing && editSize ? editSize : null),
          ...((() => {
            const custom = isReminder ? bubbleColors?.reminder : isTask ? bubbleColors?.task : bubbleColors?.normal
            return bubbleColorStyle(custom)
          })()),
        }}
        className={
          'insights-chat__bubble'
          + (message.type !== 'text' ? ' insights-chat__bubble--media' : '')
          + (message.done ? ' insights-chat__bubble--done' : '')
          + (editing ? ' insights-chat__bubble--editing' : '')
          + (isReminder ? ' insights-chat__bubble--reminder' : '')
          + (isTask ? ' insights-chat__bubble--task' : '')
          + (selected ? ' insights-chat__bubble--selected' : '')
        }
        onDoubleClick={selecting ? undefined : startEditing}
        onClick={selecting && canSelect ? (e) => { if (e.target.closest('a')) e.preventDefault(); onToggleSelected() } : undefined}
      >
        {editing ? (
          <textarea
            ref={(el) => {
              inputRef.current = el
              // Grow to fit the content (wrapped lines included).
              if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
            }}
            className="insights-chat__edit-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && e.shiftKey) {
                const result = insertTaskContinuation(value, e.target.selectionStart)
                if (result) {
                  e.preventDefault()
                  setValue(result.value)
                  requestAnimationFrame(() => e.target.setSelectionRange(result.cursor, result.cursor))
                }
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={save}
            rows={1}
          />
        ) : (
          <>
            {message.type === 'text' && (
              <div className="insights-chat__text">{renderMessageText(message.text, onToggleTaskLine, selecting)}</div>
            )}
            {message.type === 'photo' && (
              localMediaUrl ? (
                <a href={localMediaUrl} target="_blank" rel="noreferrer">
                  <img src={localMediaUrl} alt="" className="insights-chat__photo" />
                </a>
              ) : (
                <MediaUnavailable localKey={message.mediaLocalKey} />
              )
            )}
            {message.type === 'voice' && (
              localMediaUrl ? (
                <VoicePlayer src={localMediaUrl} durationHint={message.durationSec} />
              ) : (
                <MediaUnavailable localKey={message.mediaLocalKey} />
              )
            )}
            {message.type === 'file' && (
              localMediaUrl ? (
                <a href={localMediaUrl} target="_blank" rel="noreferrer" className="insights-chat__file">
                  <IconPaperclip size={16} />
                  <span className="insights-chat__file-name">{message.fileName || t('insights.typefile')}</span>
                </a>
              ) : (
                <MediaUnavailable localKey={message.mediaLocalKey} />
              )
            )}
            {message.type === 'file' && (
              <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="insights-chat__file">
                <IconPaperclip size={16} />
                <span className="insights-chat__file-name">{message.fileName || t('insights.typefile')}</span>
              </a>
            )}
            {/* Voice messages get one small merged "date · time" caption
                instead of the generic meta row below — per user report the
                separate big date block plus a second small time line felt
                like disconnected pieces bolted on ("не органично"), not one
                card. Stays attached to the message itself regardless of
                scroll position. Voice can't be edited, so there's no
                editedAt branch to keep here. */}
            {message.type === 'voice' ? (
              <div className="insights-chat__voice-date">
                {formatVoiceDate(message.createdAt.slice(0, 10), i18n.language)} · {formatTime(message.createdAt)}
              </div>
            ) : (
              <div className="insights-chat__meta">
                {message.editedAt && <span className="insights-chat__edited">{t('insights.edited')}</span>}
                <span>{formatTime(message.createdAt)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// `useStore` defaults to Insights' own store but accepts any store built
// with createChatStore.js (see ReferenceInfoPage.jsx) — per user request,
// "Справочная информация" needed to look and behave exactly like Insights,
// so this whole component is now shared instead of duplicated. `variant`
// switches the bubble color (see .insights-chat--reference in index.css,
// per user request that Reference Info's messages read as visually
// distinct from Insights') and which draft field persists the unsent text.
// `onCrossDropSection` / `onCrossDrop` — when either is passed, every
// message becomes grab-and-drop: dropping one on a task-bucket sidebar link
// (onCrossDropSection: Inbox / Vazifalar / Sometime) or on a project card /
// project row (onCrossDrop) turns it into a task (see chatMessageToTask.js),
// same drag mechanism useDragReorder.js already gives tasks. Reordering
// itself is a no-op here (the chat always stays in its own chronological
// order); only the cross-drop side matters.
// Scroll position per chat for THIS app session only (module memory, reset on
// every app launch): a fresh launch opens each chat at the newest messages;
// coming back to a chat after visiting another section returns to where the
// user was reading (per user request). Keyed by the chat's store name.
const chatScrollMemory = new Map()

export default function InsightsChat({ useStore = useInsightsStore, variant = 'insights', onCrossDropSection, onCrossDrop, onCrossDropNewProject }) {
  const { t, i18n } = useTranslation()
  const messages = useStore((s) => s.messages)
  const messageIds = messages.map((m) => m.id)

  // Per-section bubble color picker (per user request — Инсайты/Дневник/
  // Входящие all share this component, so one implementation covers all
  // three). `colorPickerType` is which kind of bubble the open popover is
  // currently editing; `draftColor` previews it live in the popover before
  // "Применить" commits it to the store.
  const chatBubbleColors = useChatColorsStore((s) => s.chatBubbleColors)
  const setChatBubbleColor = useChatColorsStore((s) => s.setChatBubbleColor)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [colorPickerType, setColorPickerType] = useState('normal')
  const defaultBubbleColor = colorPickerType === 'reminder' ? '#0f6e7a' : colorPickerType === 'task' ? '#f0dc9e' : '#4c5fd6'
  const [draftColor, setDraftColor] = useState(
    chatBubbleColors[`${variant}:normal`] || defaultBubbleColor
  )
  useEffect(() => {
    if (!colorPickerOpen) return
    setDraftColor(chatBubbleColors[`${variant}:${colorPickerType}`] || defaultBubbleColor)
  }, [colorPickerOpen, colorPickerType, variant, chatBubbleColors, defaultBubbleColor])
  // "Flashback" reminders — Insights only, per user request. See
  // useInsightsReminderStore.js for the rotation logic; this just reads
  // today's already-decided batch and injects it into today's render group
  // below (same message objects, same ids — deleting/editing a reminder
  // card is deleting/editing the one real message, no separate copy).
  const reminderCursor = useInsightsReminderStore((s) => s.cursorIndex)
  const advanceReminderIfNewDay = useInsightsReminderStore((s) => s.advanceIfNewDay)
  useEffect(() => {
    if (variant === 'insights') advanceReminderIfNewDay(messages.length)
  }, [variant, messages.length, advanceReminderIfNewDay])
  const reminderBatchCount = variant === 'insights' ? Math.max(1, Math.ceil(messages.length / 20)) : 1
  const reminderMessages = variant === 'insights'
    ? messages.slice((reminderCursor % reminderBatchCount) * 20, (reminderCursor % reminderBatchCount) * 20 + 20)
    : []
  const crossDropEnabled = !!(onCrossDropSection || onCrossDrop || onCrossDropNewProject)
  // Multi-select (per user request — "выделять и группами удалять
  // сообщения"): entered via a message's own "⋮" menu ("Select"), which
  // both flips this on and pre-selects that message. While active, drag
  // (cross-drop to a task) is switched off — the two gestures both start
  // from a press on the row and would fight each other — and the composer
  // is replaced by a Cancel / N selected / Delete bar.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const { draggingId, bindHandle: bindMessageHandle, dragGhost } =
    useDragReorder(
      messageIds,
      () => {},
      crossDropEnabled ? { onCrossDropSection, onCrossDrop, onCrossDropNewProject } : {}
    )
  const addTextMessage = useStore((s) => s.addTextMessage)
  const addPhotoMessage = useStore((s) => s.addPhotoMessage)
  const addVoiceMessage = useStore((s) => s.addVoiceMessage)
  const addFileMessage = useStore((s) => s.addFileMessage)
  const editMessage = useStore((s) => s.editMessage)
  const deleteMessage = useStore((s) => s.deleteMessage)
  const deleteMessages = useStore((s) => s.deleteMessages)
  const toggleMessageDone = useStore((s) => s.toggleMessageDone)

  // Daily "Сегодня" routine tasks (see dailyRoutineTasks.js) — "Освежить
  // инсайты"/"Добавить инсайты"/"Дневник" don't complete from their own
  // "Выполнить" button (unlike "Фокус"/"Привычки"/"Не забыть", which just
  // need a visit); they complete themselves the moment the actual activity
  // they describe happens here, per user request.
  const routineTasks = useTasksStore((s) => s.tasks)
  const routineUpdateTask = useTasksStore((s) => s.updateTask)
  const routineToggleTaskDone = useTasksStore((s) => s.toggleTaskDone)
  useEffect(() => {
    if (variant !== 'insights' && variant !== 'analysis') return
    const today = todayISO()
    // autoGenerated messages (see computeDailyPrinciplesReset) are the
    // daily prompt/checklist repost, not something the user actually wrote
    // today — don't let that alone complete "Дневник" (Insights has no
    // such repost, so this only narrows the 'analysis' variant). Also
    // matched by exact prompt text for messages reposted before the
    // autoGenerated field existed.
    const isAutoRepost = (m) => variant === 'analysis' && (m.autoGenerated || m.text === PRINCIPLES_PROMPT || messageHasTask(m.text))
    const addedToday = messages.some((m) => m.createdAt && m.createdAt.slice(0, 10) === today && !isAutoRepost(m))
    const title = variant === 'insights' ? 'Добавить инсайты' : 'Дневник'
    syncRoutineTaskStatus(routineTasks, title, addedToday, { updateTask: routineUpdateTask, toggleTaskDone: routineToggleTaskDone })
  }, [variant, messages, routineTasks, routineUpdateTask, routineToggleTaskDone])
  useEffect(() => {
    if (variant !== 'insights') return
    const allChecked = reminderMessages.length > 0 && reminderMessages.every((m) => m.done)
    syncRoutineTaskStatus(routineTasks, 'Освежить инсайты', allChecked, { updateTask: routineUpdateTask, toggleTaskDone: routineToggleTaskDone })
  }, [variant, reminderMessages, routineTasks, routineUpdateTask, routineToggleTaskDone])

  const startSelecting = (id) => {
    setSelecting(true)
    setSelectedIds(new Set([id]))
  }
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const cancelSelecting = () => {
    setSelecting(false)
    setSelectedIds(new Set())
    setConfirmingBulkDelete(false)
  }
  const confirmBulkDelete = () => {
    deleteMessages([...selectedIds])
    cancelSelecting()
  }
  // Lives on `useStore` itself (Firestore-backed), not local state — a
  // plain useState here used to lose the draft whenever this component
  // unmounted (navigating to another page), which happened a few times
  // mid-message per user report; later moved off useUiPreferencesStore
  // (per-device localStorage) onto the chat store per further user request,
  // so the draft survives a device switch too, same as any real message.
  // Insights and Reference Info each use their own `useStore`, so this
  // already keeps their drafts separate without any variant branching.
  const draft = useStore((s) => s.draft)
  const setDraft = useStore((s) => s.setDraft)

  const [uploading, setUploading] = useState(false)
  const [mediaError, setMediaError] = useState('')
  // Pasted photo/file stages here instead of sending immediately (per user
  // report — used to jump straight into the chat on paste, skipping the
  // composer entirely). Cleared/sent together with the typed draft on Enter.
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const draftRef = useAutoGrowTextarea(draft)

  const fileInputRef = useRef(null)
  const listRef = useRef(null)

  // The recording itself lives in useVoiceRecorderStore, outside this
  // component, so it survives navigating to another page or switching OS
  // windows/tabs mid-recording (per user request). `location.pathname`
  // decides whether THIS mounted chat is the one that started the active
  // recording — only that page renders the full VoiceRecorderPanel; every
  // other page just disables its own mic button (see VoiceRecorderWidget.jsx
  // for the cross-page "still recording" indicator).
  const location = useLocation()
  const recordingActive = useVoiceRecorderStore((s) => s.active)
  const recordingElapsedSec = useVoiceRecorderStore((s) => s.elapsedSec)
  const recordingSourceRoute = useVoiceRecorderStore((s) => s.sourceRoute)
  const recordingMicError = useVoiceRecorderStore((s) => s.micError)
  const recordingSaveError = useVoiceRecorderStore((s) => s.saveError)
  const startVoiceRecording = useVoiceRecorderStore((s) => s.start)
  const stopVoiceRecording = useVoiceRecorderStore((s) => s.stop)
  const discardVoiceRecording = useVoiceRecorderStore((s) => s.discard)
  const isRecordingOwner = recordingActive && recordingSourceRoute === location.pathname
  const recordingElsewhere = recordingActive && !isRecordingOwner

  // Only autoscroll when a message was *added* — a delete also changes
  // messages.length, and per user report deleting one near the top of a
  // long, scrolled-up chat was yanking the view back down to the bottom.
  // Starts at 0, not messages.length — the mount itself should count as a
  // "grew from nothing" and land on the newest messages (per user request,
  // "при открытии раздела должны открыться самые нижние записи"), not just
  // scroll on messages added after the chat is already open.
  const prevMessagesLengthRef = useRef(0)
  const scrollKey = useStore.storageName || variant
  const restoredRef = useRef(false)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (!restoredRef.current && messages.length > 0) {
      restoredRef.current = true
      const saved = chatScrollMemory.get(scrollKey)
      // Returning visit: back to the spot the user left (unless they were at
      // the bottom — then stay glued to the newest messages).
      if (saved && !saved.atBottom) {
        el.scrollTop = saved.top
        prevMessagesLengthRef.current = messages.length
        return
      }
      el.scrollTop = el.scrollHeight
      prevMessagesLengthRef.current = messages.length
      return
    }
    if (messages.length > prevMessagesLengthRef.current) el.scrollTop = el.scrollHeight
    prevMessagesLengthRef.current = messages.length
  }, [messages.length, scrollKey])

  const rememberScroll = (e) => {
    const el = e.currentTarget
    chatScrollMemory.set(scrollKey, {
      top: el.scrollTop,
      atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 40,
    })
  }

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl)
    setPendingAttachment(null)
  }

  const sendText = async () => {
    const value = draft.trim()
    if (!value && !pendingAttachment) return
    if (pendingAttachment) {
      setUploading(true)
      setMediaError('')
      try {
        if (pendingAttachment.kind === 'photo') await addPhotoMessage(pendingAttachment.file)
        else await addFileMessage(pendingAttachment.file)
      } catch {
        setMediaError(t('insights.mediaSaveFailed'))
      } finally {
        setUploading(false)
      }
      clearPendingAttachment()
    }
    if (value) addTextMessage(value)
    setDraft('')
  }

  // Notion-style autoformat, per user request — typing "--" anywhere in the
  // composer instantly becomes a task-line marker on its own line, right as
  // you type (not just on send). messageHasTask() below then picks up on
  // TASK_BULLET-prefixed lines to tint the whole entry (see .insights-chat__
  // bubble--task in index.css).
  //
  // macOS ships a system-wide Text Replacement (Keyboard settings) that
  // silently turns "--" into a single em dash "—" before this handler ever
  // sees two hyphens — confirmed from real user messages that ended up with
  // literal "—" lines instead of a circle. So both raw "--" AND an
  // already-substituted trailing "—" count as the trigger; only the
  // trigger's own length (2 chars vs. 1) differs in how much gets sliced off.
  const handleDraftChange = (e) => {
    const el = e.target
    const value = el.value
    const cursor = el.selectionStart
    const triggerLen = (cursor >= 2 && value.slice(cursor - 2, cursor) === '--') ? 2
      : (cursor >= 1 && value[cursor - 1] === '—') ? 1
      : 0
    if (triggerLen > 0) {
      const before = value.slice(0, cursor - triggerLen)
      const after = value.slice(cursor)
      const atLineStart = before.length === 0 || before.endsWith('\n')
      const insertion = (atLineStart ? '' : '\n') + TASK_BULLET
      setDraft(before + insertion + after)
      const pos = before.length + insertion.length
      requestAnimationFrame(() => el.setSelectionRange(pos, pos))
      return
    }
    setDraft(value)
  }

  // Cmd/Ctrl+V while the textarea is focused — a copied screenshot/image or
  // a file copied from Finder stages into the composer as a pending
  // attachment (per user report — it used to jump straight into the chat,
  // skipping the input line entirely). It's actually sent by sendText,
  // alongside whatever's typed. Plain text paste (the overwhelming majority
  // of pastes) falls through untouched: only a clipboard item of kind
  // 'file' triggers this at all.
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const fileItem = items.find((item) => item.kind === 'file')
    if (!fileItem) return
    e.preventDefault()
    const file = fileItem.getAsFile()
    if (!file) return
    clearPendingAttachment()
    const isImage = file.type.startsWith('image/')
    setPendingAttachment({ file, kind: isImage ? 'photo' : 'file', previewUrl: isImage ? URL.createObjectURL(file) : null })
  }

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setMediaError('')
    try {
      await addPhotoMessage(file)
    } catch {
      setMediaError(t('insights.mediaSaveFailed'))
    } finally {
      setUploading(false)
    }
  }

  const startRecording = () => {
    if (recordingActive) return
    startVoiceRecording(location.pathname, addVoiceMessage)
  }

  let groups = groupByDay(messages)
  // Today's reminder batch renders a second time, inline in today's own
  // group (so it reads as "sent" this morning) — same message objects,
  // flagged so MessageBubble can tint them, not separate stored copies.
  if (reminderMessages.length > 0) {
    const todayDateKey = new Date().toISOString().slice(0, 10)
    const reminderItems = reminderMessages.map((m) => ({ ...m, _reminderKey: `reminder-${m.id}` }))
    const todayIndex = groups.findIndex((g) => g.dateKey === todayDateKey)
    if (todayIndex >= 0) {
      groups = groups.map((g, i) => (i === todayIndex ? { ...g, items: [...reminderItems, ...g.items] } : g))
    } else {
      groups = [...groups, { dateKey: todayDateKey, items: reminderItems }]
    }
  }
  // Checkbox stayed removed everywhere per that earlier request ("галочки
  // убери во всех чатах где есть") except Insights, brought back here per a
  // later, narrower request — clicking it strikes the bubble through via
  // the same message.done + toggleMessageDone this always had.
  const showCheckbox = variant === 'insights'
  // Every message processed (per user request — same celebration as Tasks/
  // Wishes/Inbox, here as a banner above the still-visible history instead
  // of replacing it, since "done" doesn't remove a message from the chat).
  const allProcessed = showCheckbox && messages.length > 0 && messages.every((m) => m.done)

  return (
    <div className={'insights-chat' + (variant !== 'insights' ? ` insights-chat--${variant}` : '')}>
      <div className="insights-chat__color-bar">
        <button
          type="button"
          className="insights-chat__icon-btn"
          onClick={() => setColorPickerOpen((v) => !v)}
          aria-label={t('insights.bubbleColorAria')}
          title={t('insights.bubbleColorAria')}
        >
          <IconPalette size={16} />
        </button>
        {colorPickerOpen && (
          <div className="insights-chat__color-popover">
            <div className="insights-chat__color-types">
              <button
                type="button"
                className={'insights-chat__color-type-btn' + (colorPickerType === 'normal' ? ' insights-chat__color-type-btn--active' : '')}
                onClick={() => setColorPickerType('normal')}
              >
                {t('insights.bubbleColorNormal')}
              </button>
              <button
                type="button"
                className={'insights-chat__color-type-btn' + (colorPickerType === 'task' ? ' insights-chat__color-type-btn--active' : '')}
                onClick={() => setColorPickerType('task')}
              >
                {t('insights.bubbleColorTask')}
              </button>
              {variant === 'insights' && (
                <button
                  type="button"
                  className={'insights-chat__color-type-btn' + (colorPickerType === 'reminder' ? ' insights-chat__color-type-btn--active' : '')}
                  onClick={() => setColorPickerType('reminder')}
                >
                  {t('insights.bubbleColorReminder')}
                </button>
              )}
            </div>
            <div className="insights-chat__color-preview-row">
              <div className="insights-chat__bubble insights-chat__color-preview-bubble" style={bubbleColorStyle(draftColor)}>
                {t('insights.bubbleColorSample')}
              </div>
            </div>
            <div className="insights-chat__color-swatches">
              {BUBBLE_COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'insights-chat__color-swatch' + (draftColor === c ? ' insights-chat__color-swatch--active' : '')}
                  style={{ background: c }}
                  onClick={() => setDraftColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="insights-chat__color-actions">
              <button
                type="button"
                className="insights-chat__color-reset"
                onClick={() => setChatBubbleColor(variant, colorPickerType, null)}
              >
                {t('insights.bubbleColorReset')}
              </button>
              <button
                type="button"
                className="insights-chat__color-apply"
                onClick={() => { setChatBubbleColor(variant, colorPickerType, draftColor); setColorPickerOpen(false) }}
              >
                {t('insights.bubbleColorApply')}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="insights-chat__list" ref={listRef} onScroll={rememberScroll}>
        {groups.length === 0 ? (
          <EmptyStateCelebration message={t('insights.emptyGeneric')} />
        ) : (
          <>
            {allProcessed && <EmptyStateCelebration message={t('insights.allProcessed')} compact />}
            {groups.map((group) => (
            <div key={group.dateKey}>
              <div className="insights-chat__day-divider">
                <span>{formatDateBadge(group.dateKey, t, i18n.language)}</span>
              </div>
              {group.items.map((message) => {
                const isReminder = !!message._reminderKey
                const draggable = crossDropEnabled && !selecting && !isReminder
                return (
                  <div
                    key={message._reminderKey || message.id}
                    {...(draggable
                      ? bindMessageHandle(message.id, message.text?.slice(0, 40) || t(`insights.type${message.type}`))
                      : null)}
                    className={
                      (draggable ? 'insights-chat__draggable' : '')
                      + (draggingId === message.id ? ' task-card-reorder--dragging' : '')
                    }
                  >
                    <MessageBubble
                      message={message}
                      isReminder={isReminder}
                      onEdit={(text) => editMessage(message.id, text)}
                      onDelete={() => deleteMessage(message.id)}
                      onToggleDone={() => toggleMessageDone(message.id)}
                      onToggleTaskLine={(lineIndex) => editMessage(message.id, toggleTaskLineInText(message.text, lineIndex))}
                      showCheckbox={showCheckbox && isReminder}
                      bubbleColors={{
                        normal: chatBubbleColors[`${variant}:normal`],
                        task: chatBubbleColors[`${variant}:task`],
                        reminder: chatBubbleColors[`${variant}:reminder`],
                      }}
                      selecting={selecting}
                      selected={selectedIds.has(message.id)}
                      onToggleSelected={() => toggleSelected(message.id)}
                      onStartSelect={() => startSelecting(message.id)}
                    />
                  </div>
                )
              })}
            </div>
            ))}
          </>
        )}
      </div>
      {crossDropEnabled && dragGhost}

      {recordingMicError && <div className="insights-chat__error">{t('insights.micPermissionDenied')}</div>}
      {recordingSaveError && <div className="insights-chat__error">{t('insights.mediaSaveFailed')}</div>}
      {mediaError && <div className="insights-chat__error">{mediaError}</div>}

      {pendingAttachment && (
        <div className="insights-chat__pending-attachment">
          {pendingAttachment.kind === 'photo' ? (
            <div className="insights-chat__pending-attachment-thumb-wrap">
              <img src={pendingAttachment.previewUrl} alt="" className="insights-chat__pending-attachment-thumb" />
              <button
                type="button"
                className="insights-chat__pending-attachment-remove insights-chat__pending-attachment-remove--corner"
                onClick={clearPendingAttachment}
                aria-label={t('insights.removeAttachment')}
                title={t('insights.removeAttachment')}
              >
                ×
              </button>
            </div>
          ) : (
            <span className="insights-chat__pending-attachment-file">
              <IconPaperclip size={14} />
              {pendingAttachment.file.name}
              <button
                type="button"
                className="insights-chat__pending-attachment-remove"
                onClick={clearPendingAttachment}
                aria-label={t('insights.removeAttachment')}
                title={t('insights.removeAttachment')}
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {selecting ? (
        <div className="insights-chat__select-bar">
          <button type="button" className="insights-chat__select-cancel" onClick={cancelSelecting}>
            {t('insights.cancelSelect')}
          </button>
          <span className="insights-chat__select-count">
            {t('insights.selectedCount', { count: selectedIds.size })}
          </span>
          {confirmingBulkDelete ? (
            <span className="insights-chat__confirm">
              <button type="button" onClick={confirmBulkDelete}>{t('tasks.yes')}</button>
              <button type="button" onClick={() => setConfirmingBulkDelete(false)}>{t('tasks.no')}</button>
            </span>
          ) : (
            <button
              type="button"
              className="insights-chat__select-delete"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirmingBulkDelete(true)}
            >
              {t('insights.deleteSelected')}
            </button>
          )}
        </div>
      ) : (
      <div className="insights-chat__input-bar">
        {isRecordingOwner ? (
          <VoiceRecorderPanel elapsedSec={recordingElapsedSec} onStop={stopVoiceRecording} onDiscard={discardVoiceRecording} />
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="insights-chat__file-input"
              onChange={handleFilePick}
            />
            <button
              type="button"
              className="insights-chat__icon-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || recordingElsewhere}
              aria-label={t('insights.attachPhoto')}
              title={t('insights.attachPhoto')}
            >
              <IconPaperclip size={18} />
            </button>

            <textarea
              ref={draftRef}
              className="insights-chat__input"
              placeholder={t('insights.inputPlaceholder')}
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  const result = insertTaskContinuation(draft, e.target.selectionStart)
                  if (result) {
                    e.preventDefault()
                    setDraft(result.value)
                    requestAnimationFrame(() => e.target.setSelectionRange(result.cursor, result.cursor))
                  }
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() }
              }}
              onPaste={handlePaste}
              rows={1}
              disabled={uploading || recordingElsewhere}
            />

            <button
              type="button"
              className="insights-chat__icon-btn"
              onClick={startRecording}
              disabled={uploading || recordingElsewhere}
              aria-label={t('insights.recordVoice')}
              title={recordingElsewhere ? t('insights.recordingElsewhere') : t('insights.recordVoice')}
            >
              <IconMic size={18} />
            </button>
          </>
        )}
      </div>
      )}
    </div>
  )
}
