'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { MappedTile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface ImageAcceptanceProps {
  text: string
  inputType: 'text' | 'voice' | 'drawing'
  rawInputUrl: string | null
  tile: MappedTile
  childProfileId: string
  onComplete: (result: { tokenImageUrl: string }) => void
  onError: () => void
}

const MAX_ATTEMPTS = 3

export default function ImageAcceptance({
  text,
  inputType,
  rawInputUrl,
  tile,
  childProfileId,
  onComplete,
  onError,
}: ImageAcceptanceProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [genError, setGenError] = useState(false)
  const [attempts, setAttempts] = useState(1)
  const [isShared, setIsShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAlexCard, setShowAlexCard] = useState(false)
  const [savedTokenUrl, setSavedTokenUrl] = useState<string>('')

  useEffect(() => {
    generateImage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts])

  async function generateImage() {
    setLoading(true)
    setGenError(false)
    setImageUrl(null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, childProfileId, tileId: tile.id }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setImageUrl(data.imageUrl)
    } catch {
      setGenError(true)
    } finally {
      setLoading(false)
    }
  }

  async function saveDream(tokenImageUrl: string) {
    setSaving(true)
    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('dream_submissions')
      .insert({
        child_profile_id: childProfileId,
        tile_id: tile.id,
        input_type: inputType,
        raw_input_url: rawInputUrl,
        transcribed_text: text,
        generated_image_url: imageUrl,
        token_image_url: tokenImageUrl,
        is_shared: isShared,
      })

    if (insertError) {
      setSaving(false)
      onError()
      return
    }

    const { error: updateError } = await supabase
      .from('child_tile_states')
      .update({ state: 'completed', completed_at: new Date().toISOString() })
      .eq('child_profile_id', childProfileId)
      .eq('tile_id', tile.id)

    if (updateError) {
      setSaving(false)
      onError()
      return
    }

    setSavedTokenUrl(tokenImageUrl)
    setSaving(false)
    setShowAlexCard(true)
  }

  function handleAccept() {
    if (imageUrl) saveDream(imageUrl)
  }

  function handleTryAgain() {
    setAttempts(prev => prev + 1)
  }

  function handleSkip() {
    saveDream(tile.default_token_image_url ?? '')
  }

  // Alex reveal card
  if (showAlexCard) {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <h2 className="text-xl font-bold text-foreground">Your dream is saved! ✨</h2>
        {savedTokenUrl && (
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden">
            <Image
              src={savedTokenUrl}
              alt="Your dream"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        {tile.alex_tip && (
          <div className="bg-muted rounded-2xl p-4 max-w-sm">
            <p className="text-sm text-foreground font-medium">Alex says:</p>
            <p className="text-sm text-muted-foreground mt-1">{tile.alex_tip}</p>
          </div>
        )}
        <button
          onClick={() => onComplete({ tokenImageUrl: savedTokenUrl })}
          className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-2xl"
        >
          Back to the map ✨
        </button>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground font-medium">Creating your dream picture...</p>
      </div>
    )
  }

  // Generation error state
  if (genError) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-destructive font-medium">Something went wrong generating your dream picture.</p>
        <button
          onClick={() => {
            setAttempts(prev => prev + 1)
          }}
          className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-2xl"
        >
          Try a different description
        </button>
        <button
          onClick={handleSkip}
          className="w-full py-3 bg-muted text-foreground font-semibold rounded-2xl"
          disabled={saving}
        >
          Skip — use default image
        </button>
      </div>
    )
  }

  // Image shown — accept / try again / skip
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {imageUrl && (
        <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden">
          <Image
            src={imageUrl}
            alt="Your dream"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Attempt {attempts} of {MAX_ATTEMPTS}
      </p>

      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={isShared}
          onChange={e => setIsShared(e.target.checked)}
          className="rounded"
        />
        Share this dream with others
      </label>

      <button
        onClick={handleAccept}
        disabled={saving}
        className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-2xl disabled:opacity-50"
      >
        Accept ✨
      </button>

      {attempts < MAX_ATTEMPTS && (
        <button
          onClick={handleTryAgain}
          disabled={saving}
          className="w-full py-3 bg-muted text-foreground font-semibold rounded-2xl disabled:opacity-50"
        >
          Try again
        </button>
      )}

      <button
        onClick={handleSkip}
        disabled={saving}
        className="w-full py-3 text-muted-foreground font-medium disabled:opacity-50"
      >
        Skip — use default image
      </button>
    </div>
  )
}
