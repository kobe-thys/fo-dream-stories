import UnlockMatrix from '@/components/admin/UnlockMatrix'

export default function UnlocksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Unlock graph</h1>
        <p className="text-sm text-gray-400 mt-1">Define which tile completions reveal new tiles on the map.</p>
      </div>
      <UnlockMatrix />
    </div>
  )
}
