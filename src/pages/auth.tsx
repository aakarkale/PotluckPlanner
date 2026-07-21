import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth, useSignIn, useSignUp } from '@/hooks/use-auth'
import { useTitle } from '@/hooks/use-title'
import { Link, navigate } from '@/lib/router'

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { user, isPending } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useSignIn(() => navigate('/dashboard'))
  const signUp = useSignUp(() => navigate('/dashboard'))
  const pending = signIn.isPending || signUp.isPending

  useTitle(mode === 'signin' ? 'Sign in — Potluck' : 'Create an account — Potluck')

  // Already signed in — go straight to the dashboard.
  useEffect(() => {
    if (!isPending && user) navigate('/dashboard', { replace: true })
  }, [isPending, user])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (mode === 'signin') signIn.mutate({ email, password })
    else signUp.mutate({ email, password, name })
  }

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto w-full max-w-md px-4 pt-10 pb-12 sm:pt-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === 'signin' ? 'Welcome back' : 'Host your first potluck'}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {mode === 'signin'
                ? 'Sign in to manage your potlucks.'
                : 'Accounts are for hosts only — your guests will never need one.'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              {mode === 'signup' && (
                <div className="grid gap-2">
                  <Label htmlFor="auth-name">Your name</Label>
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                    maxLength={80}
                    autoFocus
                    required
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus={mode === 'signin'}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" size="lg" disabled={pending}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
            <p className="text-muted-foreground mt-4 text-center text-sm">
              {mode === 'signin' ? (
                <>
                  New here?{' '}
                  <Link to="/signup" className="text-primary font-medium hover:underline">
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already hosting?{' '}
                  <Link to="/signin" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
