// A phone number attached to an existing (email) account, so it can sign in
// with "number + the same password". Firebase can't hang a second
// email/password login on one account, so the link is a Firestore lookup:
// phoneLogins/{digits} = { uid, email } — readable before sign-in (rules allow
// a single get, never a list), written only by the account it points to. The
// account's own profile (users/{uid}.loginPhone) remembers which number it
// linked, so Settings can show and remove it.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { normalizePhone, passwordCandidates, phoneToEmail } from './phoneAccount'

const digitsOf = (raw) => normalizePhone(raw).slice(1)
const linkRef = (digits) => doc(db, 'phoneLogins', digits)

export async function findLinkedEmail(raw) {
  const snap = await getDoc(linkRef(digitsOf(raw)))
  return snap.exists() ? snap.data().email : null
}

const BAD_CREDENTIALS = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']

// Phone sign-in: the number's own phone account first, then — if there is
// none — an email account that linked this number. `typed` is what the user
// entered as the password (empty = the number itself, see passwordCandidates).
export async function signInWithPhone(raw, typed, signInEmail) {
  const passwords = passwordCandidates(raw, typed)
  const attempt = async (email) => {
    let last
    for (const password of passwords) {
      try {
        await signInEmail(email, password)
        return
      } catch (e) {
        if (!BAD_CREDENTIALS.includes(e?.code)) throw e
        last = e
      }
    }
    throw last
  }
  try {
    await attempt(phoneToEmail(raw))
  } catch (e) {
    if (!BAD_CREDENTIALS.includes(e?.code)) throw e
    const linked = await findLinkedEmail(raw).catch(() => null)
    if (!linked) throw e
    await attempt(linked)
  }
}

export async function getLinkedPhone(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data().loginPhone || null : null
}

// Returns null on success, or an error key: 'taken' when the number already
// belongs to another account.
export async function linkPhone(user, raw) {
  const digits = digitsOf(raw)
  const existing = await getDoc(linkRef(digits))
  if (existing.exists() && existing.data().uid !== user.uid) return 'taken'
  const previous = await getLinkedPhone(user.uid)
  if (!existing.exists()) await setDoc(linkRef(digits), { uid: user.uid, email: user.email })
  await setDoc(doc(db, 'users', user.uid), { loginPhone: `+${digits}` }, { merge: true })
  if (previous && previous !== `+${digits}`) await deleteDoc(linkRef(previous.slice(1))).catch(() => {})
  return null
}

export async function unlinkPhone(user) {
  const previous = await getLinkedPhone(user.uid)
  if (previous) await deleteDoc(linkRef(previous.slice(1))).catch(() => {})
  await setDoc(doc(db, 'users', user.uid), { loginPhone: null }, { merge: true })
}
