import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTelegramLinksStore } from '../../store/useTelegramLinksStore'

// Lets a chat (Data/Insights/Analysis, see createChatStore.js) be linked to
// a Telegram channel from the Settings page instead of editing any config
// file — see docs/telegram-mirror.md for the Apps Script side.
export default function TelegramLinkSetting({ storageName }) {
  const { t } = useTranslation()
  const chatId = useTelegramLinksStore((s) => s.links[storageName] || '')
  const setLink = useTelegramLinksStore((s) => s.setLink)
  const [value, setValue] = useState(chatId)
  const [saved, setSaved] = useState(false)

  // Keep the input in sync if the link changes elsewhere (e.g. another
  // device synced a new value through Firestore).
  useEffect(() => setValue(chatId), [chatId])

  const save = () => {
    setLink(storageName, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const unlink = () => {
    setLink(storageName, '')
    setValue('')
  }

  return (
    <div className="telegram-link">
      <div className="settings-row">
        <span>{t('settings.telegramLink')}</span>
        <div className="telegram-link__controls">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('settings.telegramLinkPlaceholder')}
          />
          <button type="button" onClick={save} disabled={value.trim() === chatId}>
            {t('settings.telegramLinkSave')}
          </button>
          {chatId && (
            <button type="button" onClick={unlink}>
              {t('settings.telegramLinkUnlink')}
            </button>
          )}
        </div>
      </div>
      <p className="settings-hint">
        {saved
          ? t('settings.telegramLinkSaved')
          : chatId
            ? t('settings.telegramLinkStatus', { chatId })
            : t('settings.telegramLinkHint')}
      </p>
    </div>
  )
}
