import { useTranslation } from 'react-i18next'
import HubCards from '../features/tasks/HubCards'
import { useQaydlarStore, useKnowledgeStore } from '../store/useQaydlarStore'
import { SideIconNotes, SideIconBook } from '../layout/sidebarIcons'

// "Данные" — two card collections: Заметки and Знания (per user request).
export default function QaydlarHubPage() {
  const { t } = useTranslation()
  const noteCount = useQaydlarStore((s) => s.cards.length)
  const knowledgeCount = useKnowledgeStore((s) => s.cards.length)
  const items = [
    { key: 'notes', to: '/qaydlar/notes', name: t('qaydlar.hubNotes'), meta: t('qaydlar.cardCount', { count: noteCount }), Icon: SideIconNotes, color: '#ffcf70', colorLight: '#c9822b' },
    { key: 'knowledge', to: '/qaydlar/knowledge', name: t('qaydlar.hubKnowledge'), meta: t('qaydlar.cardCount', { count: knowledgeCount }), Icon: SideIconBook, color: '#6fd3c0', colorLight: '#2a9d8f' },
  ]
  return (
    <div className="projects-page">
      <HubCards items={items} />
    </div>
  )
}
