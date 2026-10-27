import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { phoneToEmail } from './phoneAccount'

// Firebase reports errors as "Firebase: Error (auth/some-code)." — show a
// plain sentence instead, falling back to the raw text for unknown codes.
// A few codes read differently for phone accounts ("number" vs "email").
const AUTH_ERRORS = [
  'invalid-credential', 'wrong-password', 'user-not-found', 'invalid-email',
  'email-already-in-use', 'weak-password', 'too-many-requests',
  'network-request-failed', 'operation-not-allowed',
]
const PHONE_VARIANTS = ['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-email', 'email-already-in-use']
function authErrorText(error, method, t) {
  const code = /auth\/([a-z-]+)/.exec(error || '')?.[1]
  if (!code || !AUTH_ERRORS.includes(code)) return error
  return t(`auth.errors.${code}${method === 'phone' && PHONE_VARIANTS.includes(code) ? '-phone' : ''}`)
}

// Sign-in / sign-up by phone number + password (no SMS — see phoneAccount.js).
// Email is kept only as a sign-in fallback for accounts created with it
// earlier; new accounts are always created by phone.
export default function AuthPage() {
  const { t } = useTranslation()
  const error = useAuthStore((s) => s.error)
  const signUpEmail = useAuthStore((s) => s.signUpEmail)
  const signInEmail = useAuthStore((s) => s.signInEmail)

  const [method, setMethod] = useState('phone')
  const [mode, setMode] = useState('signin')
  const [phone, setPhone] = useState('+998 ')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const switchMethod = () => {
    setMethod(method === 'phone' ? 'email' : 'phone')
    setMode('signin')
    useAuthStore.setState({ error: null })
  }

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (method === 'phone') {
        const login = phoneToEmail(phone)
        if (mode === 'signup') await signUpEmail(login, password)
        else await signInEmail(login, password)
      } else {
        await signInEmail(email.trim(), password)
      }
    } catch {
      // useAuthStore already recorded the error for display below
    } finally {
      setSubmitting(false)
    }
  }

  const signup = method === 'phone' && mode === 'signup'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.title')}</h1>
        <p className="auth-card__subtitle">{method === 'phone' ? t('auth.phoneSubtitle') : t('auth.emailSubtitle')}</p>

        {method === 'phone' && (
          <div className="auth-card__mode-switch">
            <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
              {t('auth.signIn')}
            </button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
              {t('auth.signUp')}
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          {method === 'phone' ? (
            <input
              type="tel"
              inputMode="tel"
              className="focus-create__input"
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="username"
            />
          ) : (
            <input
              type="email"
              className="focus-create__input"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          )}
          <input
            type="password"
            className="focus-create__input"
            placeholder={signup ? t('auth.newPasswordPlaceholder') : t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
          <button type="submit" className="timer-controls__primary" disabled={submitting}>
            {signup ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </form>

        {error && <p className="auth-card__error">{authErrorText(error, method, t)}</p>}

        <button type="button" className="auth-card__link" onClick={switchMethod}>
          {method === 'phone' ? t('auth.useEmail') : t('auth.usePhone')}
        </button>
      </div>
    </div>
  )
}
