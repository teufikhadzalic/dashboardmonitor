import { useState } from 'react'
import { authApi } from '../../services/api/index.js'

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [canReapply, setCanReapply] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setCanReapply(false)
    setIsSubmitting(true)

    try {
      const payload = await authApi.authenticate(mode, form)
      if (payload.pending) {
        setError(payload.message)
        setMode('login')
        return
      }
      onAuthenticated(payload)
    } catch (requestError) {
      setCanReapply(requestError.code === 'ACCOUNT_REJECTED')
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reapply = async () => {
    setError('')
    setCanReapply(false)
    setIsSubmitting(true)

    try {
      const payload = await authApi.reapply({ email: form.email, password: form.password })
      setError(payload.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">CS-ASOP / platform dashboard</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-copy">Access live security platform assurance.</p>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Register</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required />
              </label>
            </>
          )}
          <label>
            {mode === 'login' ? 'Email or username' : 'Email'}
            <input type={mode === 'login' ? 'text' : 'email'} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete={mode === 'login' ? 'username' : 'email'} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {canReapply && (
            <button className="reapply-btn" type="button" onClick={reapply} disabled={isSubmitting}>
              Appeal was rejected, re-apply?
            </button>
          )}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AuthScreen
