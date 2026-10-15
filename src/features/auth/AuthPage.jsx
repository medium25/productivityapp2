import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import SegmentedControl from '../../layout/SegmentedControl'

const RECAPTCHA_CONTAINER_ID = 'auth-recaptcha-container'

export default function AuthPage() {
  const { t } = useTranslation()
  const error = useAuthStore((s) => s.error)
  const signUpEmail = useAuthStore((s) => s.signUpEmail)
  const signInEmail = useAuthStore((s) => s.signInEmail)
  const sendPhoneOtp = useAuthStore((s) => s.sendPhoneOtp)
  const confirmPhoneOtp = useAuthStore((s) => s.confirmPhoneOtp)

  const [method, setMethod] = useState('email')
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const methodItems = [
    { value: 'email', content: t('auth.methodEmail') },
    { value: 'phone', content: t('auth.methodPhone') },
  ]

  const submitEmail = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') await signUpEmail(email, password)
      else await signInEmail(email, password)
    } catch {
      // useAuthStore already recorded the error for display below
    } finally {
      setSubmitting(false)
    }
  }

  const submitPhoneStep = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (otpSent) {
        await confirmPhoneOtp(otpCode)
      } else {
        await sendPhoneOtp(phoneNumber, RECAPTCHA_CONTAINER_ID)
        setOtpSent(true)
      }
    } catch {
      // useAuthStore already recorded the error for display below
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.title')}</h1>
        <p className="auth-card__subtitle">{t('auth.subtitle')}</p>

        <SegmentedControl items={methodItems} value={method} onChange={setMethod} ariaLabel={t('auth.method')} />

        {method === 'email' ? (
          <>
            <div className="auth-card__mode-switch">
              <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
                {t('auth.signIn')}
              </button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
                {t('auth.signUp')}
              </button>
            </div>
            <form className="auth-form" onSubmit={submitEmail}>
              <input
                type="email"
                className="focus-create__input"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                className="focus-create__input"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <button type="submit" className="timer-controls__primary" disabled={submitting}>
                {mode === 'signup' ? t('auth.signUp') : t('auth.signIn')}
              </button>
            </form>
          </>
        ) : (
          <form className="auth-form" onSubmit={submitPhoneStep}>
            <input
              type="tel"
              className="focus-create__input"
              placeholder={t('auth.phonePlaceholder')}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={otpSent}
              required
              autoComplete="tel"
            />
            {otpSent && (
              <input
                type="text"
                inputMode="numeric"
                className="focus-create__input"
                placeholder={t('auth.otpPlaceholder')}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                autoFocus
              />
            )}
            <button type="submit" className="timer-controls__primary" disabled={submitting}>
              {otpSent ? t('auth.confirmCode') : t('auth.sendCode')}
            </button>
          </form>
        )}

        {error && <p className="auth-card__error">{error}</p>}

        <div id={RECAPTCHA_CONTAINER_ID} />
      </div>
    </div>
  )
}
