import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AMBIENT_SOUNDS } from '../../audio/ambientSounds'
import { IconChevronDown } from '../../icons/Icons'
import { playAmbient, stopAmbient, setAmbientVolume } from '../../audio/ambientPlayer'
import { useSettingsStore } from '../../store/useSettingsStore'

// Standalone background-sound picker — the same pill grid TimerPanel shows,
// but not tied to a running Pomodoro. Lives on MyFocusPage next to the
// Quran player so a listening session can have rain / sea / a quiet library
// quietly under the recitation. Plays the moment a pill is picked; stops on
// unmount (leaving the page) since there's no floating control to turn an
// orphaned track off otherwise. The choice isn't persisted on purpose — a
// sound that silently resumes on next open, with nothing audible until you
// re-pick it, is more confusing than starting from "No sound". Its volume
// sits below the recitation and is set in Settings > Focus.
export default function AmbientSoundPicker() {
  const { t } = useTranslation()
  const [soundId, setSoundId] = useState('none')
  const [open, setOpen] = useState(false)
  const volume = useSettingsStore((s) => s.backgroundSoundVolume ?? 0.4)
  const setVolume = useSettingsStore((s) => s.setBackgroundSoundVolume)

  useEffect(() => () => stopAmbient(), [])

  // Live-follow the Settings slider while a sound is playing.
  useEffect(() => { setAmbientVolume(volume) }, [volume])

  const pick = (id) => {
    setSoundId(id)
    setOpen(false)
    if (id === 'none') stopAmbient()
    else playAmbient(id, volume)
  }

  const currentLabel =
    soundId === 'none'
      ? t('focus.sound.none')
      : t(AMBIENT_SOUNDS.find((s) => s.id === soundId)?.labelKey || 'focus.sound.none')

  return (
    <div className="sound-picker">
      <button
        type="button"
        className="sound-picker__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{t('focus.backgroundSound')}: {currentLabel}</span>
        <IconChevronDown size={16} className={'sound-picker__chevron' + (open ? ' open' : '')} />
      </button>
      {open && (
        <div className="sound-picker__grid">
          <div className="sound-picker__vol">
            <span>{t('focus.backgroundSoundVolumeTitle')}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              aria-label={t('focus.backgroundSoundVolumeTitle')}
            />
            <span className="sound-picker__vol-val">{Math.round(volume * 100)}%</span>
          </div>
          <button
            type="button"
            className={'sound-pill' + (soundId === 'none' ? ' active' : '')}
            onClick={() => pick('none')}
          >
            {t('focus.sound.none')}
          </button>
          {AMBIENT_SOUNDS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'sound-pill' + (soundId === s.id ? ' active' : '')}
              onClick={() => pick(s.id)}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
