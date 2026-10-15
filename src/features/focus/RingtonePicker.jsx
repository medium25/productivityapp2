import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAudioContext } from '../../audio/audioContext'
import { playLongRingtone } from '../../audio/longRingtones'

export default function RingtonePicker({ titleKey, pool, selectedId, onSelect }) {
  const { t } = useTranslation()
  const [previewingId, setPreviewingId] = useState(null)
  const stopRef = useRef(null)

  const stopPreview = () => {
    if (stopRef.current) {
      stopRef.current()
      stopRef.current = null
    }
    setPreviewingId(null)
  }

  const preview = (tone) => {
    stopPreview()
    stopRef.current = playLongRingtone(getAudioContext(), tone, 0.4)
    setPreviewingId(tone.id)
  }

  return (
    <div className="ringtone-picker">
      <p className="ringtone-picker__title">{t(titleKey)}</p>
      <div className="ringtone-picker__list">
        <button
          type="button"
          className={'ringtone-picker__option' + (selectedId === null ? ' active' : '')}
          onClick={() => { stopPreview(); onSelect(null) }}
        >
          {t('focus.ringtoneRandom')}
        </button>
        {pool.map((tone) => (
          <div key={tone.id} className={'ringtone-picker__row' + (selectedId === tone.id ? ' active' : '')}>
            <button type="button" className="ringtone-picker__option" onClick={() => { stopPreview(); onSelect(tone.id) }}>
              {t(tone.labelKey)}
            </button>
            <button
              type="button"
              className="ringtone-picker__preview"
              onClick={() => (previewingId === tone.id ? stopPreview() : preview(tone))}
            >
              {previewingId === tone.id ? t('focus.ringtoneStop') : t('focus.ringtonePreview')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
