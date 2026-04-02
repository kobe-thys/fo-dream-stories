-- ============================================================
-- Migration 008: published flag on tiles
-- Existing tiles → published = true (continuity for live users)
-- New tiles will default to false (draft until published)
-- ============================================================

-- Add column with default true so existing tiles stay visible
ALTER TABLE public.tiles ADD COLUMN published boolean NOT NULL DEFAULT true;

-- Change default to false so new tiles created via admin are drafts
ALTER TABLE public.tiles ALTER COLUMN published SET DEFAULT false;
