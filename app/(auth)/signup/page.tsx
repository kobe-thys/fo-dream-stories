import SignupForm from '@/components/auth/SignupForm'
import FOMascot from '@/components/fo/FOMascot'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Create your family account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">Log in</Link>
      </p>
      <FOMascot message="I can't wait to read with you!" />
    </main>
  )
}
