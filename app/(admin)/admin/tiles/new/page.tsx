import TileForm from '@/components/admin/TileForm'

export default function NewTilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New tile</h1>
      <TileForm />
    </div>
  )
}
