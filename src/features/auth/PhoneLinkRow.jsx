import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPhone } from './phoneAccount'
import { getLinkedPhone, linkPhone, unlinkPhone } from './phoneLogin'

// Settings → Account: attach a phone number to an email account so it can
// also sign in with "number + the same password" (see phoneLogin.js).
export default function PhoneLinkRow({ user }) {
  const { t } = useTranslation()
  const [linked, setLinked] = useState(undefined) // undefined = loading
  const [phone, setPhone] = useState('+998 ')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    getLinkedPhone(user.uid).then((p) => alive && setLinked(p)).catch(() => alive && setLinked(null))
    return () => { alive = false }
  }, [user.uid])

  const run = async (fn) => {
    setBusy(true)
    setMessage('')
    try { await fn() } catch { setMessage(t('auth.linkError')) }
    setBusy(false)
  }

  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      const err = await linkPhone(user, phone)
      if (err) { setMessage(t(`auth.link_${err}`)); return }
      setLinked(await getLinkedPhone(user.uid))
      setMessage(t('auth.linkDone'))
    })
  }

  if (linked === undefined) return null

  return (
    <div className="phone-link">
      {linked ? (
        <div className="settings-row">
          <span>{t('auth.linkedPhone')}: <b>{formatPhone(linked)}</b></span>
          <button type="button" disabled={busy} onClick={() => run(async () => { await unlinkPhone(user); setLinked(null) })}>
            {t('auth.unlinkPhone')}
          </button>
        </div>
      ) : (
        <form className="settings-row phone-link__form" onSubmit={submit}>
          <input
            type="tel"
            inputMode="tel"
            className="focus-create__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('auth.phonePlaceholder')}
            aria-label={t('auth.linkPhone')}
            required
          />
          <button type="submit" disabled={busy}>{t('auth.linkPhone')}</button>
        </form>
      )}
      <p className="settings-hint">{message || t('auth.linkHint')}</p>
    </div>
  )
}
