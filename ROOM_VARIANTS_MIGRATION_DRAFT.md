# Room Variants Schema Design

## Purpose
Allow hotels to offer multiple variants within a room type (e.g., Standard Double, Deluxe Double, Sea View Double) with different prices.

## Key Principles
1. **Optional**: Simple hotels use base pricing, complex hotels add variants
2. **Backward Compatible**: Existing bookings and base pricing unaffected
3. **Admin-Friendly**: Easy to add/edit/remove variants
4. **Pricing Engine Compatible**: Uses existing pricing engine, no duplication

## Schema Design

### New Table: `accommodation_room_variants`
```sql
CREATE TABLE accommodation_room_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  
  -- The base room type this variant belongs to ('single', 'double', 'triple')
  base_room_type   TEXT NOT NULL CHECK (base_room_type IN ('single', 'double', 'triple')),
  
  -- Variant names and details
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  
  -- Occupancy (default matches base type, but can be customized)
  occupancy        INTEGER NOT NULL,
  
  -- Pricing per night
  price_per_night  NUMERIC(10,2) NOT NULL,
  
  -- Admin control
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX accommodation_room_variants_accommodation_idx
  ON accommodation_room_variants(accommodation_id, is_active);
```

### Enhanced Bookings Table
Add optional `room_variant_id` column:
```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_variant_id UUID REFERENCES accommodation_room_variants(id);
```

## Usage Flow

### Admin Perspective
1. **Simple Hotel**: Leave variants empty, use existing `price_double_room`, `price_single_room`, `price_triple_room`
2. **Complex Hotel**: Add variants like:
   - Standard Double (2000 EGP/night)
   - Deluxe Double (2500 EGP/night)
   - Sea View Double (3000 EGP/night)

### Booking Form Perspective
1. **No Variants Configured**: Show base room type selector (single/double/triple)
2. **Variants Configured**: Show variant selector instead of base type
3. Submit with either `room_type` (backward compat) or `room_variant_id` (new)

### Pricing Engine Perspective
1. Check if `room_variant_id` is set
2. If yes: use variant's `price_per_night`
3. If no: use base type pricing from `accommodations.price_*_room`
4. Apply seasonal overrides if available (future: variants might have seasonal overrides too)

## Migration File
**011_room_variants_schema.sql**

```sql
-- Add room variants table
CREATE TABLE accommodation_room_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  base_room_type   TEXT NOT NULL CHECK (base_room_type IN ('single', 'double', 'triple')),
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  occupancy        INTEGER NOT NULL DEFAULT 2,
  price_per_night  NUMERIC(10,2) NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX accommodation_room_variants_accommodation_idx
  ON accommodation_room_variants(accommodation_id, is_active);

-- Add optional variant reference to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_variant_id UUID REFERENCES accommodation_room_variants(id);
```

## Safety Notes
- Both tables are additive (no schema breaking changes)
- Existing bookings continue to work with `room_type` alone
- RLS policies: Room variants should have same RLS as accommodations
- No data migration needed (variants start empty)

## Next Steps (In Implementation Tasks)
1. **Admin UI**: Add variant management to AccommodationManager
2. **Booking Form**: Update to show and select variants
3. **Pricing Engine**: Update to use variant pricing when available
4. **Tests**: Verify pricing with/without variants
