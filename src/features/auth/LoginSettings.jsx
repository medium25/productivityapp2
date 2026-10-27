import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '../../firebase'
import PhoneInput from './PhoneInput'
import { defaultPassword, formatPhone, isCompletePhone, isPhoneEmail } from './phoneAccount'
import { getLinkedPhone, linkPhone, unlinkPhone } from './phoneLogin'

// Settings → Account → sign-in by phone number: two rows that open an editor
// when tapped (like iOS Settings).
//  - "Number": email account → attach / change / detach the number it signs in
//    with; phone account → the number is fixed, shown only.
//  - "Password": keep it, make it the number itself (default — the digits
//    after the country code, so the field can stay empty at sign-in), or set
//    a custom one.
// Changing a password needs a recent sign-in; when Firebase asks for one, a
// "current password" field appears and Save is pressed again.
export default function LoginSettings({ user }) {
  const { t } = useTranslation()
  const phoneAccount = isPhoneEmail(user.email)
  const ownNumber = phoneAccount ? `+${user.email.split('@')[0]}` : ''

  const [linked, setLinked] = useState(phoneAccount ? ownNumber : undefined) // undefined = loading
  const [open, setOpen] = useState(null) // null | 'phone' | 'password'
  const [phone, setPhone] = useState(ownNumber || '+998')
  const [mode, setMode] = useState('keep') // keep | number | custom
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
        if (p) setPhone(p)
      })
      .catch(() => alive && setLinked(''))
    return () => { alive = false }
  }, [user.uid, phoneAccount])

  const loading = linked === undefined
  const number = linked || '' // '' when no number is linked yet (or still loading)
  const say = (kind, text) => setNote({ kind, text })
  const toggle = (which) => { setOpen(open === which ? null : which); say('', '') }

  const saveNumber = async (e) => {
    e.preventDefault()
    say('', '')
    if (!isCompletePhone(phone)) return say('err', t('auth.invalidPhone'))
    setBusy(true)
    try {
      const err = await linkPhone(user, phone)
      if (err) return say('err', t(`auth.link_${err}`))
      setLinked(phone)
      setOpen(null)
      say('ok', t('auth.numberSaved'))
    } catch {
      say('err', t('auth.linkError'))
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    setBusy(true)
    try {
      await unlinkPhone(user)
      setLinked('')
      setPhone('+998')
      setMode('keep')
      setOpen(null)
      say('ok', t('auth.unlinked'))
    } catch {
      say('err', t('auth.linkError'))
    } finally {
      setBusy(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    say('', '')
    if (mode === 'keep') { setOpen(null); return }
    if (mode === 'number' && !number) return say('err', t('auth.pwNeedNumber'))
    if (mode === 'custom' && custom.length < 6) return say('err', t('auth.shortPassword'))
    setBusy(true)
    try {
      const password = mode === 'number' ? defaultPassword(number) : custom
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
      setOpen(null)
      say('ok', mode === 'number' ? t('auth.savedNumberPassword') : t('auth.saved'))
      setMode('keep')
    } catch {
      say('err', t('auth.linkError'))
    } finally {
      setBusy(false)
    }
  }

  const options = [
    { value: 'keep', title: t('auth.pwKeep'), caption: t('auth.pwKeepCaption') },
    {
      value: 'number',
      title: t('auth.pwNumber'),
      caption: number ? t('auth.pwNumberCaption', { pw: defaultPassword(number) }) : t('auth.pwNeedNumber'),
      disabled: !number,
    },
    { value: 'custom', title: t('auth.pwCustomTitle'), caption: t('auth.pwCustomCaption') },
  ]

  return (
    <div className="login-block">
      <div className="login-rows">
        {phoneAccount ? (
          <div className="login-row login-row--static">
            <span className="login-row__icon">📱</span>
            <span className="login-row__text"><small>{t('auth.loginNumberRow')}</small><b>{formatPhone(number)}</b></span>
          </div>
        ) : (
          <button type="button" className={'login-row' + (open === 'phone' ? ' login-row--open' : '')} onClick={() => toggle('phone')} aria-expanded={open === 'phone'} disabled={loading}>
            <span className="login-row__icon">📱</span>
            <span className="login-row__text">
              <small>{t('auth.loginNumberRow')}</small>
              {loading ? <b>…</b> : number ? <b>{formatPhone(number)}</b> : <b className="login-row__todo">{t('auth.linkNumber')}</b>}
            </span>
            <span className="login-row__chev" aria-hidden="true">›</span>
          </button>
        )}

        {open === 'phone' && !phoneAccount && (
          <form className="login-edit" onSubmit={saveNumber}>
            <PhoneInput value={phone} onChange={setPhone} ariaLabel={t('auth.loginPhone')} />
            <div className="login-edit__actions">
              <button type="submit" className="login-save" disabled={busy}>{t('auth.save')}</button>
              {number && <button type="button" className="login-unlink" disabled={busy} onClick={unlink}>{t('auth.unlinkPhone')}</button>}
            </div>
          </form>
        )}

        <button type="button" className={'login-row' + (open === 'password' ? ' login-row--open' : '')} onClick={() => toggle('password')} aria-expanded={open === 'password'}>
          <span className="login-row__icon">🔑</span>
          <span className="login-row__text"><small>{t('auth.loginPasswordRow')}</small><b>••••••••</b></span>
          <span className="login-row__chev" aria-hidden="true">›</span>
        </button>

        {open === 'password' && (
          <form className="login-edit" onSubmit={savePassword}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={'login-opt' + (mode === o.value ? ' login-opt--on' : '')}
                disabled={o.disabled}
                onClick={() => setMode(o.value)}
                aria-pressed={mode === o.value}
              >
                <span className="login-opt__radio" aria-hidden="true" />
                <span><b>{o.title}</b><small>{o.caption}</small></span>
              </button>
            ))}
            {mode === 'custom' && (
              <div className="auth-pw">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="focus-create__input"
                  placeholder={t('auth.pwCustomPlaceholder')}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="auth-pw__eye" onClick={() => setShowPw(!showPw)} aria-label={t('auth.showPassword')}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            )}
            {mode === 'number' && <p className="login-edit__hint">{t('auth.pwHint_number')}</p>}
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
            <button type="submit" className="login-save login-save--full" disabled={busy}>{t('auth.save')}</button>
          </form>
        )}
      </div>
      {note.text && <p className={'login-note login-note--' + note.kind}>{note.text}</p>}
    </div>
  )
}
