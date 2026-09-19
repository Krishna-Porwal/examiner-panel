'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type PasswordChangeProps = {
  token: string
  userName: string
  userRole: string
  onClose: () => void
}

export default function PasswordChange({
  token,
  userName,
  userRole,
  onClose,
}: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(
        `http://localhost:4000/api/users/${userName}/${userRole}/password`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Password change failed')
      }

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Close dialog after success
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-foreground">Change Password</h2>

        {success ? (
          <div className="rounded bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-green-700 font-medium">Password changed successfully!</p>
            <p className="text-sm text-green-600 mt-2">You will be logged out shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground text-sm"
                disabled={loading}
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground text-sm"
                disabled={loading}
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
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

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
