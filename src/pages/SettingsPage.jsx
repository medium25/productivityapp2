import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { SECTIONS, getSectionTitle } from '../constants/sections'
import { useSettingsStore } from '../store/useSettingsStore'
import { useAuthStore } from '../store/useAuthStore'
import { accountLabel } from '../features/auth/phoneAccount'
import LoginSettings from '../features/auth/LoginSettings'
import SegmentedControl from '../layout/SegmentedControl'
import { IconSun, IconMoon, IconMonitor, IconChevronDown, IconFocus, IconCheckCircle, IconTrash, IconArrowRight } from '../icons/Icons'
import { collectSectionData } from '../export/collectSectionData'
import { exportToPdf } from '../export/exportToPdf'
import { exportToWord } from '../export/exportToWord'
import { exportToExcel } from '../export/exportToExcel'
import FriendsPanel from '../features/social/FriendsPanel'
import RingtonePicker from '../features/focus/RingtonePicker'
import TelegramLinkSetting from '../features/telegram/TelegramLinkSetting'
import { WORK_START_RINGTONES, REST_START_RINGTONES } from '../audio/longRingtones'

// Section id -> the Firestore storageName its createChatStore(...) uses
// (see useReferenceInfoStore.js / useInsightsStore.js / usePrinciplesStore.js)
// — only these three sections are chat feeds that can mirror to Telegram.
const TELEGRAM_LINKABLE_SECTIONS = {
  referenceInfo: 'productivity-hub-reference-info',
  insights: 'productivity-hub-insights',
  principles: 'productivity-hub-principles',
}

const LANGUAGES = [
  { value: 'ru', content: 'Русский' },
  { value: 'en', content: 'English' },
  { value: 'uz', content: "O'zbekcha" },
]

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const enabledSections = useSettingsStore((s) => s.enabledSections)
  const toggleSection = useSettingsStore((s) => s.toggleSection)
  const sectionNameOverrides = useSettingsStore((s) => s.sectionNameOverrides)
  const workStartRingtoneId = useSettingsStore((s) => s.workStartRingtoneId)
  const setWorkStartRingtoneId = useSettingsStore((s) => s.setWorkStartRingtoneId)
  const restStartRingtoneId = useSettingsStore((s) => s.restStartRingtoneId)
  const setRestStartRingtoneId = useSettingsStore((s) => s.setRestStartRingtoneId)
  const user = useAuthStore((s) => s.user)
  const signOutUser = useAuthStore((s) => s.signOutUser)
  const [exportMessage, setExportMessage] = useState('')
  const [expandedSection, setExpandedSection] = useState(null)

  const changeLanguage = (lng) => {
    setLanguage(lng)
    i18n.changeLanguage(lng)
  }

  const themeItems = [
    { value: 'light', content: <IconSun size={16} />, ariaLabel: t('settings.themeLight') },
    { value: 'system', content: <IconMonitor size={16} />, ariaLabel: t('settings.themeSystem') },
    { value: 'dark', content: <IconMoon size={16} />, ariaLabel: t('settings.themeDark') },
  ]

  const runExport = async (section, fn) => {
    const data = collectSectionData(section, t)
    await fn(data, t)
    setExportMessage(t('export.success'))
    setTimeout(() => setExportMessage(''), 3000)
  }

  return (
    <div className="section-card">
      <h1>{t('settings.title')}</h1>

      {/* Result & Statistics/Completed/Trash moved in here (per user
          request — each still a full, unchanged page at its own route,
          just reached from inside Settings now instead of its own sidebar
          row). */}
      <div className="settings-block">
        <Link to="/focus" className="settings-row settings-row--link">
          <span className="settings-row__label"><IconFocus size={17} /> {t('sections.focus.title')}</span>
          <IconArrowRight size={16} />
        </Link>
        <Link to="/completed" className="settings-row settings-row--link">
          <span className="settings-row__label"><IconCheckCircle size={17} /> {t('nav.completedGroup')}</span>
          <IconArrowRight size={16} />
        </Link>
        <Link to="/trash" className="settings-row settings-row--link">
          <span className="settings-row__label"><IconTrash size={17} /> {t('nav.trashGroup')}</span>
          <IconArrowRight size={16} />
        </Link>
      </div>

      <div className="settings-block">
        <h2>{t('settings.account')}</h2>
        <div className="settings-row">
          <span>{accountLabel(user?.email) || user?.phoneNumber}</span>
          <button type="button" onClick={signOutUser}>{t('auth.signOut')}</button>
        </div>
        {user?.email && <LoginSettings user={user} />}
      </div>

      <div className="settings-block">
        <h2>{t('settings.language')}</h2>
        <div className="settings-row">
          <span>{t('settings.language')}</span>
          <SegmentedControl items={LANGUAGES} value={language} onChange={changeLanguage} ariaLabel={t('settings.language')} />
        </div>
      </div>

      {/* The web version always uses the neon skin — theme only matters in the Mac app. */}
      {window.__TAURI_INTERNALS__ && <div className="settings-block">
        <h2>{t('settings.theme')}</h2>
        <div className="settings-row">
          <span>{t('settings.theme')}</span>
          <SegmentedControl items={themeItems} value={theme} onChange={setTheme} ariaLabel={t('settings.theme')} />
        </div>
      </div>}

      <div className="settings-block">
        <h2>{t('settings.visibleSections')}</h2>
        <p className="settings-hint">{t('settings.visibleSectionsHint')}</p>
        {SECTIONS.map((s) => (
          <div className="settings-row" key={s.id}>
            <span className="settings-row__label"><s.Icon size={17} /> {getSectionTitle(s, sectionNameOverrides, t)}</span>
            <button
              type="button"
              className="toggle"
              data-on={enabledSections[s.id] !== false}
              onClick={() => toggleSection(s.id)}
              aria-pressed={enabledSections[s.id] !== false}
              aria-label={getSectionTitle(s, sectionNameOverrides, t)}
            />
          </div>
        ))}
      </div>

      <div className="settings-block">
        <h2>{t('settings.sectionSettings')}</h2>
        <p className="settings-hint">{t('settings.sectionSettingsHint')}</p>
        {SECTIONS.map((s) => {
          const isOpen = expandedSection === s.id
          return (
            <div className="section-settings-item" key={s.id}>
              <button
                type="button"
                className="settings-row section-settings-item__header"
                onClick={() => setExpandedSection(isOpen ? null : s.id)}
                aria-expanded={isOpen}
              >
                <span className="settings-row__label"><s.Icon size={17} /> {getSectionTitle(s, sectionNameOverrides, t)}</span>
                <IconChevronDown size={16} className={'section-settings-item__chevron' + (isOpen ? ' open' : '')} />
              </button>
              {isOpen && (
                <div className="section-settings-item__body">
                  {s.id === 'focus' && (
                    <>
                      <FriendsPanel />
                      <RingtonePicker
                        titleKey="focus.restStartRingtoneTitle"
                        pool={REST_START_RINGTONES}
                        selectedId={restStartRingtoneId}
                        onSelect={setRestStartRingtoneId}
                      />
                      <RingtonePicker
                        titleKey="focus.workStartRingtoneTitle"
                        pool={WORK_START_RINGTONES}
                        selectedId={workStartRingtoneId}
                        onSelect={setWorkStartRingtoneId}
                      />
                    </>
                  )}
                  {TELEGRAM_LINKABLE_SECTIONS[s.id] && (
                    <TelegramLinkSetting storageName={TELEGRAM_LINKABLE_SECTIONS[s.id]} />
                  )}
                  <div className="settings-row">
                    <span>{t('settings.exportThisSection')}</span>
                    <div className="export-row__actions">
                      <button type="button" onClick={() => runExport(s, exportToPdf)}>PDF</button>
                      <button type="button" onClick={() => runExport(s, exportToWord)}>Word</button>
                      <button type="button" onClick={() => runExport(s, exportToExcel)}>Excel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {exportMessage && <div className="export-toast">{exportMessage}</div>}
      </div>
    </div>
  )
}
