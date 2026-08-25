-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 018 · Site settings: customer-facing payment instructions
-- ───────────────────────────────────────────────────────────────────────────
-- Free-text box shown to the customer on invoices explaining how to pay /
-- confirm their booking (bank details, InstaPay number, WhatsApp confirm
-- steps, etc). Editable from the admin Site Settings screen.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS payment_instructions_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_instructions_en TEXT NOT NULL DEFAULT '';
