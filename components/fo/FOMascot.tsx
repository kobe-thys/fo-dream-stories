import Image from 'next/image'

interface FOMascotProps {
  message: string
}

export default function FOMascot({ message }: FOMascotProps) {
  if (!message) return null

  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 z-20 pointer-events-none">
      {/* Speech bubble — intentionally white comic-bubble style */}
      <div className="relative bg-white text-slate-800 rounded-2xl px-4 py-3 max-w-[200px] text-sm shadow-lg leading-snug">
        {message}
        {/* Tail pointing down toward FO */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-8 translate-y-full w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid white',
          }}
        />
      </div>
      {/* FO image */}
      <Image
        src="/fo-reading.png"
        alt="Friendly Onion"
        width={96}
        height={96}
        className="object-contain drop-shadow-lg"
        priority
      />
    </div>
  )
}
