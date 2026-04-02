import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import Link from 'next/link'

const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/map',        label: 'Map' },
  { href: '/admin/stories',    label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings',   label: 'Settings' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin()
  if (!admin) redirect('/map')

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 shrink-0">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 px-2">Admin</p>
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {label}
          </Link>
        ))}
        <div className="mt-auto">
          <Link href="/map" className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 block">
            Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
