import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { useFriendsStore } from '../../store/useFriendsStore'
import { useCompetitionsStore } from '../../store/useCompetitionsStore'
import { IconUserPlus } from '../../icons/Icons'
import { accountLabel, toAccountEmail } from '../auth/phoneAccount'

export default function FriendsPanel() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  // Both stores keep a permanent onSnapshot listener open for as long as
  // they're running (see useFriendsStore.js/useCompetitionsStore.js) — that
  // used to run for every signed-in user's whole session (see
  // useAuthStore.js). Scoping it to this panel's lifetime means the read
  // cost only exists while someone is actually looking at it.
  useEffect(() => {
    useFriendsStore.getState().start()
    useCompetitionsStore.getState().start()
    return () => {
      useFriendsStore.getState().stop()
      useCompetitionsStore.getState().stop()
    }
  }, [])
  const friends = useFriendsStore((s) => s.friends)
  const incoming = useFriendsStore((s) => s.incoming)
  const outgoing = useFriendsStore((s) => s.outgoing)
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest)
  const acceptFriendRequest = useFriendsStore((s) => s.acceptFriendRequest)
  const declineFriendRequest = useFriendsStore((s) => s.declineFriendRequest)
  const activeCompetition = useCompetitionsStore((s) => s.active)
  const myHours = useCompetitionsStore((s) => s.myHours)
  const opponentHours = useCompetitionsStore((s) => s.opponentHours)
  const startCompetition = useCompetitionsStore((s) => s.startCompetition)

  const opponentEmail = activeCompetition && user
    ? activeCompetition.participantEmails[activeCompetition.participants.find((p) => p !== user.uid)]
    : null

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const result = await sendFriendRequest(user.uid, user.email, toAccountEmail(email))
      if (result.ok) {
        setMessage(t('social.requestSent'))
        setEmail('')
      } else {
        setMessage(t(`social.error.${result.error}`))
      }
    } catch {
      setMessage(t('social.error.generic'))
    }
  }

  return (
    <div>
      <form className="friends-add" onSubmit={submit}>
        <input
          type="text"
          inputMode="email"
          autoCapitalize="none"
          className="focus-create__input"
          placeholder={t('social.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="friends-add__btn" aria-label={t('social.addFriend')} title={t('social.addFriend')}>
          <IconUserPlus size={18} />
        </button>
      </form>
      {message && <p className="settings-hint">{message}</p>}

      {activeCompetition && (
        <div className="competition-active">
          <p className="competition-active__title">{t('social.competitionActive', { email: accountLabel(opponentEmail) })}</p>
          <div className="competition-active__row">
            <span>{t('social.myHours')}: {myHours.toFixed(1)}</span>
            <span>{t('social.opponentHours')}: {opponentHours.toFixed(1)}</span>
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="friends-section">
          <p className="friends-section__label">{t('social.incomingRequests')}</p>
          {incoming.map((r) => (
            <div className="settings-row" key={r.id}>
              <span>{accountLabel(r.fromEmail)}</span>
              <div className="export-row__actions">
                <button type="button" onClick={() => acceptFriendRequest(r.id)}>{t('social.accept')}</button>
                <button type="button" onClick={() => declineFriendRequest(r.id)}>{t('social.decline')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="friends-section">
          <p className="friends-section__label">{t('social.outgoingRequests')}</p>
          {outgoing.map((r) => (
            <div className="settings-row" key={r.id}>
              <span>{accountLabel(r.toEmail)}</span>
              <button type="button" onClick={() => declineFriendRequest(r.id)}>{t('social.cancel')}</button>
            </div>
          ))}
        </div>
      )}

      <div className="friends-section">
        <p className="friends-section__label">{t('social.friendsList')}</p>
        {friends.length === 0 ? (
          <p className="settings-hint">{t('social.noFriends')}</p>
        ) : (
          friends.map((f) => (
            <div className="settings-row" key={f.uid}>
              <span>{accountLabel(f.email)}</span>
              <button
                type="button"
                disabled={!!activeCompetition}
                onClick={() => startCompetition(user.uid, user.email, f)}
              >
                {t('social.startCompetition')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
