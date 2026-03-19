-- Initial tile layout: Mother Tree at centre, ring-1 tiles, ring-2 story tiles
-- Fixed UUIDs so tile_unlocks can reference them explicitly

insert into public.tiles (id, type, name, position_q, position_r, terrain_type, alex_tip, sensory_moment_text)
values
  -- Ring 0
  ('00000000-0000-0000-0000-000000000001',
   'mother_tree', 'Mother Tree', 0, 0, null,
   'The Mother Tree is so tall it touches the clouds! I found a secret door in the trunk that led to a tiny library with glowing books. Each one told a story from a different dreamer.',
   null),

  -- Ring 1: story tiles
  ('00000000-0000-0000-0000-000000000002',
   'story', 'The Tinkle Trunk', 1, 0, null, null, null),

  ('00000000-0000-0000-0000-000000000004',
   'story', 'The Upside-down Waterfall', -1, 1, null, null, null),

  ('00000000-0000-0000-0000-000000000006',
   'story', 'Raindrop Castle', 0, -1, null, null, null),

  -- Ring 1: terrain tiles
  ('00000000-0000-0000-0000-000000000003',
   'terrain', 'Forest Path', 0, 1, 'forest', null,
   'You feel the soft earth beneath your feet. The smell of pine fills the air. Somewhere nearby, a bird calls twice and then goes quiet.'),

  ('00000000-0000-0000-0000-000000000005',
   'terrain', 'Sunny Meadow', -1, 0, 'land', null,
   'Warm sun on your face. The grass is soft and springy. You can hear bees humming somewhere close, lazy and happy.'),

  ('00000000-0000-0000-0000-000000000007',
   'terrain', 'Old Oak Trail', 1, -1, 'forest', null,
   'Ancient roots arch over the path like a doorway. The air is still here — not cold, just waiting. Old leaves crunch softly under each step.'),

  -- Ring 2: story tiles (locked initially)
  ('00000000-0000-0000-0000-000000000008',
   'story', 'The Syrup Tree', 2, 0, null, null, null),

  ('00000000-0000-0000-0000-000000000009',
   'story', 'Dragon Mountains', 0, 2, null, null, null),

  ('00000000-0000-0000-0000-000000000010',
   'story', 'Elven Forest', -2, 1, null, null, null),

  ('00000000-0000-0000-0000-000000000011',
   'story', 'Sun Cave', -1, -1, null, null, null),

  ('00000000-0000-0000-0000-000000000012',
   'story', 'The Lighthouse', 2, -1, null, null, null);

-- Unlock graph
insert into public.tile_unlocks (from_tile_id, to_tile_id)
values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008'), -- Tinkle Trunk → Syrup Tree
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012'), -- Tinkle Trunk → Lighthouse
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000009'), -- Upside-down Waterfall → Dragon Mountains
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010'), -- Upside-down Waterfall → Elven Forest
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000011'); -- Raindrop Castle → Sun Cave
