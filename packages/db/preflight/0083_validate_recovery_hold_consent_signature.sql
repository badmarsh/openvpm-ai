-- Count-only, owner-visible gate after 0082 and before 0083. Every count must
-- be zero. Run with the database owner/migrator, never the RLS app role.
select 'invalid_recovery_holds' issue, count(*)::int violations
from practices
where recovery_hold
  and (
    recovery_hold_set_at is null
    or recovery_hold_reason is null
    or recovery_hold_reason !~ '[^[:space:]]'
  )
union all
select 'unpaired_signature_evidence', count(*)::int
from consent_requests
where (signature_png_bytes is null) <> (signature_sha256 is null)
union all
select 'invalid_signature_sizes', count(*)::int
from consent_requests
where signature_png_bytes is not null
  and octet_length(signature_png_bytes) not between 1 and 500000
union all
select 'invalid_signature_hashes', count(*)::int
from consent_requests
where signature_sha256 is not null
  and (
    signature_sha256 !~ '^[0-9a-f]{64}$'
    or signature_sha256 is distinct from
      pg_catalog.encode(pg_catalog.sha256(signature_png_bytes), 'hex')
  )
union all
select 'invalid_signature_states', count(*)::int
from consent_requests
where not (
  (
    status = 'pending'
    and signer_name is null
    and signed_at is null
    and file_id is null
    and signature_png_bytes is null
    and signature_sha256 is null
  )
  or (
    status = 'signing'
    and signer_name is not null
    and signed_at is not null
    and signature_png_bytes is not null
    and signature_sha256 is not null
  )
  or (
    status = 'signed'
    and signer_name is not null
    and signed_at is not null
    and file_id is not null
  )
)
union all
select 'missing_or_unvalidated_live_signing_constraint', count(*)::int
from (values (1)) marker(value)
where not exists (
  select 1
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'consent_requests'
    and c.conname = 'consent_requests_signing_evidence_check'
    and c.contype = 'c'
    and c.convalidated
)
union all
select 'missing_staged_constraints', count(*)::int
from (values
  ('practices', 'practices_recovery_hold_evidence_check'),
  ('consent_requests', 'consent_requests_signature_evidence_pair_check'),
  ('consent_requests', 'consent_requests_signature_evidence_size_check'),
  ('consent_requests', 'consent_requests_signature_evidence_hash_check'),
  ('consent_requests', 'consent_requests_signing_signature_evidence_check')
) expected(table_name, constraint_name)
where not exists (
  select 1
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = expected.table_name
    and c.conname = expected.constraint_name
);
