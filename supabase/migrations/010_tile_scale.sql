-- Migration 010: per-tile XYZ scale
ALTER TABLE public.tiles
  ADD COLUMN scale_x float NOT NULL DEFAULT 1.0,
  ADD COLUMN scale_y float NOT NULL DEFAULT 1.0,
  ADD COLUMN scale_z float NOT NULL DEFAULT 1.0;
