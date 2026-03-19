import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Welcome back, dreamer</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-muted-foreground text-sm">
        No account?{' '}
        <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
      </p>
    </main>
  )
}
