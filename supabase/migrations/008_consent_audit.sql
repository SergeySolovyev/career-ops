-- 2026-05-29: 152-ФЗ audit trail for user consent (offer + privacy + refund).
-- Required by Роскомнадзор practice: when a user files a complaint, the
-- operator must produce timestamp proof of explicit consent acceptance.
--
-- Migration is additive — safe to apply with active users; existing rows get
-- NULL which means "consent timestamp unknown" (we backfill nothing; the
-- audit obligation only applies prospectively from the date this column lands).

alter table public.user_profiles
  add column if not exists consent_accepted_at timestamptz;

comment on column public.user_profiles.consent_accepted_at is
  '152-ФЗ + СloudPayments compliance: ISO timestamp when user accepted
   the combined Offer + Privacy + Refund consent at signup. NULL for
   pre-2026-05-29 accounts (no checkbox existed at their signup time).';
