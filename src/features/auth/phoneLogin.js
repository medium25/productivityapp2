// A phone number attached to an existing (email) account, so it can sign in
// with "number + the same password". Firebase can't hang a second
// email/password login on one account, so the link is a Firestore lookup:
// phoneLogins/{digits} = { uid, email } — readable before sign-in (rules allow
// a single get, never a list), written only by the account it points to. The
// account's own profile (users/{uid}.loginPhone) remembers which number it
// linked, so Settings can show and remove it.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { normalizePhone, phoneToEmail } from './phoneAccount'

const digitsOf = (raw) => normalizePhone(raw).slice(1)
const linkRef = (digits) => doc(db, 'phoneLogins', digits)

export async function findLinkedEmail(raw) {
  const snap = await getDoc(linkRef(digitsOf(raw)))
  return snap.exists() ? snap.data().email : null
}

// Phone sign-in: the number's own phone account first, then — if there is
// none — an email account that linked this number.
export async function signInWithPhone(raw, password, signInEmail) {
  try {
    await signInEmail(phoneToEmail(raw), password)
  } catch (e) {
    if (!['auth/invalid-credential', 'auth/user-not-found'].includes(e?.code)) throw e
    const linked = await findLinkedEmail(raw).catch(() => null)
    if (!linked) throw e
    await signInEmail(linked, password)
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
