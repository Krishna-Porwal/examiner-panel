'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type LoginProps = {
  onLoginSuccess: (token: string, user: { user_name: string; role: string; institute?: string }) => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'CE' | 'CA' | 'FAC'>('CE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: username,
          password,
          role,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Login failed')
      }

      const data = await res.json()
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLoginSuccess(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-foreground">
          Academic Management System
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Examination Management Portal
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'CE' | 'CA' | 'FAC')}
              className="w-full rounded border border-input bg-background px-3 py-2 text-foreground text-sm"
            >
              <option value="CE">Central Examiner (CE)</option>
              <option value="CA">College Admin (CA)</option>
              <option value="FAC">Faculty (FAC)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {role === 'CE' && 'Create and manage all system data'}
              {role === 'CA' && 'Manage institute data and faculty'}
              {role === 'FAC' && 'Manage your own profile and assignments'}
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                role === 'CE'
                  ? 'Enter CE username'
                  : role === 'CA'
                    ? 'Enter institute short name'
                    : 'Enter faculty PAN'
              }
              className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground text-sm"
              disabled={loading}
              maxLength={10}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground text-sm"
              disabled={loading}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Login Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            size="lg"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            <strong>Demo Credentials:</strong> Ask your administrator for login details
          </p>
        </div>
      </div>
    </div>
  )
}
