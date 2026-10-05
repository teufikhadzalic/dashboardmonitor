import { useCallback, useState } from 'react'
import AuthPage from './pages/Auth/AuthPage.jsx'
import DashboardPage from './pages/Dashboard/DashboardPage.jsx'
import './App.css'

function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('cs-asop-auth') || 'null'))

  const handleAuthenticated = useCallback((payload) => {
    localStorage.setItem('cs-asop-auth', JSON.stringify(payload))
    setAuth(payload)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cs-asop-auth')
    setAuth(null)
  }, [])

  return (
    <>
      {!auth?.token && <AuthPage onAuthenticated={handleAuthenticated} />}
      <div hidden={!auth?.token}>
        <DashboardPage auth={auth} onLogout={logout} />
      </div>
    </>
  )
}

export default App
