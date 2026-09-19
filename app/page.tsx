'use client'

import { useEffect, useState } from 'react'
import ExaminerPanel from '@/components/examiner-panel'
import Login from '@/components/login'

type User = { user_name: string; role: string; institute?: string }

export default function Page() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [token, setToken] = useState<string>('')
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already logged in on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
        setIsAuthenticated(true)
      } catch (err) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  function handleLoginSuccess(token: string, user: User) {
    setToken(token)
    setUser(user)
    setIsAuthenticated(true)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken('')
    setUser(null)
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <ExaminerPanel
      token={token}
      user={user}
      onLogout={handleLogout}
    />
  )
}

