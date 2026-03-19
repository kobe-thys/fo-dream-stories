import SignupForm from '@/components/auth/SignupForm'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">FO's Dream Stories</h1>
        <p className="text-slate-400 mt-2">Create your family account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-slate-400 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:underline">Log in</Link>
      </p>
    </main>
  )
}
