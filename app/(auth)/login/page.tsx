import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">FO's Dream Stories</h1>
        <p className="text-slate-400 mt-2">Welcome back, dreamer</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-slate-400 text-sm">
        No account?{' '}
        <Link href="/signup" className="text-violet-400 hover:underline">Sign up</Link>
      </p>
    </main>
  )
}
