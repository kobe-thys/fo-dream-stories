'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const AVATAR_COLORS = ['#7c3aed', '#1d4ed8', '#166534', '#b45309', '#be185d', '#0e7490']

export default function CreateProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!dob) { setError('Date of birth is required'); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { count } = await supabase
      .from('child_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', user.id)
    if ((count ?? 0) >= 4) {
      setLoading(false)
      setError("You've reached the maximum of 4 child profiles.")
      return
    }
    const { error } = await supabase.from('child_profiles').insert({
      family_id: user.id, name: name.trim(), date_of_birth: dob, avatar_color: color
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/select-profile')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Add a dreamer</h1>
      <p className="text-muted-foreground mb-8">Tell us about your child</p>
      <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Emma" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Avatar colour</Label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-ring' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Add dreamer'}
        </Button>
      </form>
    </main>
  )
}
