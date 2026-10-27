import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '../../firebase'
import SegmentedControl from '../../layout/SegmentedControl'
import PhoneInput from './PhoneInput'
import { defaultPassword, formatPhone, isCompletePhone, isPhoneEmail } from './phoneAccount'
import { getLinkedPhone, linkPhone, unlinkPhone } from './phoneLogin'

// Settings → Account → "Sign in with a phone number".
//  - Email account: attach a number (so "number + password" signs in to it) and
//    optionally set the password — by default to the number itself.
//  - Phone account (created by number): the number is fixed, only the password
//    can change.
// Changing a password needs a recent sign-in; when Firebase asks for one, a
// "current password" field appears and the same Save button is pressed again.
export default function LoginSettings({ user }) {
  const { t } = useTranslation()
  const phoneAccount = isPhoneEmail(user.email)

  const [linked, setLinked] = useState(phoneAccount ? '' : undefined) // undefined = loading
  const [phone, setPhone] = useState(phoneAccount ? `+${user.email.split('@')[0]}` : '+998')
  const [mode, setMode] = useState(phoneAccount ? 'keep' : 'number') // keep | number | custom
  const [custom, setCustom] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [current, setCurrent] = useState('')
  const [needCurrent, setNeedCurrent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState({ kind: '', text: '' })

  useEffect(() => {
    if (phoneAccount) return undefined
    let alive = true
    getLinkedPhone(user.uid)
      .then((p) => {
        if (!alive) return
        setLinked(p || '')
        if (p) { setPhone(p); setMode('keep') }
      })
      .catch(() => alive && setLinked(''))
    return () => { alive = false }
  }, [user.uid, phoneAccount])

  if (linked === undefined) return null

  const say = (kind, text) => setNote({ kind, text })

  const save = async (e) => {
    e.preventDefault()
    say('', '')
    if (!phoneAccount && !isCompletePhone(phone)) return say('err', t('auth.invalidPhone'))
    if (mode === 'custom' && custom.length < 6) return say('err', t('auth.shortPassword'))
    setBusy(true)
    try {
      if (!phoneAccount) {
        const err = await linkPhone(user, phone)
        if (err) return say('err', t(`auth.link_${err}`))
        setLinked(phone)
      }
      if (mode !== 'keep') {
        const password = mode === 'number' ? defaultPassword(phone) : custom
        const me = auth.currentUser
        try {
          if (needCurrent && current) await reauthenticateWithCredential(me, EmailAuthProvider.credential(user.email, current))
          await updatePassword(me, password)
        } catch (err) {
          if (err?.code === 'auth/requires-recent-login') { setNeedCurrent(true); return say('err', t('auth.needCurrent')) }
          if (['auth/wrong-password', 'auth/invalid-credential'].includes(err?.code)) return say('err', t('auth.wrongCurrent'))
          throw err
        }
        setNeedCurrent(false)
        setCurrent('')
        setCustom('')
        if (mode === 'custom') setMode('keep')
      }
      say('ok', mode === 'number' ? t('auth.savedNumberPassword') : t('auth.saved'))
    } catch {
      say('err', t('auth.linkError'))
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    setBusy(true)
    try { await unlinkPhone(user); setLinked(''); setPhone('+998'); setMode('number'); say('ok', t('auth.unlinked')) } catch { say('err', t('auth.linkError')) }
    setBusy(false)
  }

  const modes = [
    { value: 'keep', content: t('auth.pwKeep') },
    { value: 'number', content: t('auth.pwNumber') },
    { value: 'custom', content: t('auth.pwCustom') },
  ]

  return (
    <form className="login-settings" onSubmit={save}>
      <h3 className="login-settings__title">{t('auth.loginTitle')}</h3>

      <label className="login-settings__label">{t('auth.loginPhone')}</label>
      <PhoneInput value={phone} onChange={setPhone} disabled={phoneAccount} ariaLabel={t('auth.loginPhone')} />
      {linked && !phoneAccount && (
        <p className="settings-hint login-settings__linked">
          {t('auth.linkedPhone')}: <b>{formatPhone(linked)}</b>{' · '}
          <button type="button" className="auth-card__link" disabled={busy} onClick={unlink}>{t('auth.unlinkPhone')}</button>
        </p>
      )}

      <label className="login-settings__label">{t('auth.loginPassword')}</label>
      <SegmentedControl items={modes} value={mode} onChange={setMode} ariaLabel={t('auth.loginPassword')} />
      {mode === 'custom' && (
        <div className="login-settings__pw">
          <input
            type={showPw ? 'text' : 'password'}
            className="focus-create__input"
            placeholder={t('auth.pwCustomPlaceholder')}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            autoComplete="new-password"
            minLength={6}
          />
          <button type="button" className="login-settings__eye" onClick={() => setShowPw(!showPw)} aria-label={t('auth.showPassword')}>
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
      )}
      <p className="settings-hint">{t(`auth.pwHint_${mode}`)}</p>

      {needCurrent && mode !== 'keep' && (
        <input
          type="password"
          className="focus-create__input"
          placeholder={t('auth.currentPassword')}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      )}

      <button type="submit" className="login-settings__save" disabled={busy}>{t('auth.save')}</button>
      {note.text && <p className={'login-settings__note login-settings__note--' + note.kind}>{note.text}</p>}
    </form>
  )
}
