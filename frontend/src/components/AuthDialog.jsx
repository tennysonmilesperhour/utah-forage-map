import { useEffect, useRef, useState } from 'react'
import { Check, LockKeyhole, X } from 'lucide-react'
import { getApiError, useForgotPassword, useLogin, useRegister, useResetPassword } from '../hooks/useAuth'

const EMPTY_FORM = { username: '', email: '', password: '' }

export default function AuthDialog({ mode: initialMode, resetToken, onClose, onAuthenticated }) {
  const dialogRef = useRef(null)
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const register = useRegister()
  const login = useLogin()
  const forgot = useForgotPassword()
  const reset = useResetPassword()
  const pending = register.isPending || login.isPending || forgot.isPending || reset.isPending

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
  }, [])

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')

    try {
      if (mode === 'forgot') {
        await forgot.mutateAsync(form.email)
        setMessage('If that account exists, a reset link is on its way.')
        return
      }
      if (mode === 'reset') {
        await reset.mutateAsync({ token: resetToken, password: form.password })
        setMessage('Password updated. You can sign in now.')
        setMode('login')
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      const mutation = mode === 'register' ? register : login
      const payload = mode === 'register'
        ? form
        : { email: form.email, password: form.password }
      const user = await mutation.mutateAsync(payload)
      onAuthenticated(user)
    } catch (requestError) {
      setError(getApiError(requestError, 'We could not complete that request.'))
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
    >
      <button className="icon-button auth-close" type="button" onClick={onClose} aria-label="Close account dialog">
        <X size={20} aria-hidden="true" />
      </button>

      <div className="auth-context">
        <div className="auth-mark" aria-hidden="true">
          <LockKeyhole size={22} />
        </div>
        <p className="auth-context-label">Your field record</p>
        <h2>Keep the map public. Keep your finds yours.</h2>
        <p>An account adds a private home for your field activity without changing how anyone explores the public map.</p>
        <ul>
          <li><Check size={17} aria-hidden="true" /> Save places to revisit</li>
          <li><Check size={17} aria-hidden="true" /> Build a personal logbook</li>
          <li><Check size={17} aria-hidden="true" /> Submit finds for review</li>
        </ul>
      </div>

      <div className="auth-form-panel">
        <div className="auth-tabs" aria-label="Account access">
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === 'login' || mode === 'forgot' || mode === 'reset' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
        </div>

        <div className="auth-heading">
          <h3>{mode === 'register' ? 'Create your field account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'}</h3>
          <p>
            {mode === 'register'
              ? 'Three details, then you are back on the map.'
              : mode === 'forgot' ? 'We will send a secure, one-hour recovery link.'
                : mode === 'reset' ? 'Use at least eight characters for your new password.'
                  : 'Open your logbook and continue where you left off.'}
          </p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>
              Display name
              <input
                autoFocus
                autoComplete="name"
                value={form.username}
                onChange={event => setForm({ ...form, username: event.target.value })}
                minLength={2}
                maxLength={40}
                placeholder="How others will know you"
                required
              />
            </label>
          )}
          {mode !== 'reset' && <label>
            Email
            <input autoFocus={mode !== 'register'} type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required />
          </label>}
          {mode !== 'forgot' && <label>
            Password
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={128} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} required />
          </label>}

          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}

          <button className="button button-primary auth-submit" disabled={pending}>
            {pending
              ? 'Working...'
              : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Sign in'}
          </button>
        </form>

        {mode === 'login' && <button className="guest-link" type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>}
        {mode === 'forgot' && <button className="guest-link" type="button" onClick={() => switchMode('login')}>Back to sign in</button>}

        <button className="guest-link" type="button" onClick={onClose}>
          Continue exploring without an account
        </button>
        <p className="auth-privacy">We use your email only for account access. Public finds never display it.</p>
      </div>
    </dialog>
  )
}
