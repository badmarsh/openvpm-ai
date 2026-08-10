-- Count-only, read-only gate for migration 0081.
-- Run after 0077-0080 and RLS are applied. Every count must be zero before
-- validating the staged attachment/capture/consent constraints.
select 'cross_tenant_uploaders' issue, count(*) violations
from files f
where not exists (
  select 1 from users u
  where u.id = f.uploaded_by and u.practice_id = f.practice_id
)
union all
select 'bad_file_checksums', count(*)
from files
where checksum_sha256 is not null
  and checksum_sha256 !~ '^[0-9a-f]{64}$'
union all
select 'negative_file_sizes', count(*)
from files where file_size_bytes < 0
union all
select 'appointments_without_patients', count(*)
from files where appointment_id is not null and patient_id is null
union all
select 'available_files_without_evidence', count(*)
from files
where storage_status = 'available'
  and (checksum_sha256 is null or file_size_bytes is null or storage_verified_at is null)
union all
select 'invalid_primary_namespaces', count(*)
from files
where category is null
   or category not in ('patient-photos','documents','lab-results','branding','consents')
   or file_key !~ ('^' || practice_id::text || '/' || category || '/[^/]+$')
   or file_url is distinct from '/api/files/' || file_key
union all
select 'invalid_patient_entities', count(*)
from files
where entity_type = 'patient'
  and (patient_id is null or entity_id is null or entity_id <> patient_id)
union all
select 'negative_replica_attempt_counts', count(*)
from file_object_replicas where attempt_count < 0
union all
select 'bad_replica_checksums', count(*)
from file_object_replicas
where checksum_sha256 is not null
  and checksum_sha256 !~ '^[0-9a-f]{64}$'
union all
select 'negative_replica_sizes', count(*)
from file_object_replicas where file_size_bytes < 0
union all
select 'available_replicas_without_evidence', count(*)
from file_object_replicas
where status = 'available'
  and (
    checksum_sha256 is null
    or file_size_bytes is null
    or replicated_at is null
    or verified_at is null
  )
union all
select 'incoherent_replica_leases', count(*)
from file_object_replicas
where (lease_token is null) <> (lease_expires_at is null)
union all
select 'invalid_independent_replica_keys', count(*)
from file_object_replicas
where replica_target = 'independent-v1'
  and (
    object_key !~ (
      '^attachments/v1/' || practice_id::text || '/' ||
      file_id::text || '/(pending|[0-9a-f]{64})$'
    )
    or (
      status = 'available'
      and (
        object_key is distinct from (
          'attachments/v1/' || practice_id::text || '/' ||
          file_id::text || '/' || checksum_sha256
        )
        or object_version_id is null
      )
    )
  )
union all
select 'negative_storage_event_sizes', count(*)
from file_storage_events
where expected_file_size_bytes < 0 or observed_file_size_bytes < 0
union all
select 'cross_tenant_capture_patients', count(*)
from capture_sessions s
where not exists (
  select 1 from patients p
  where p.id = s.patient_id and p.practice_id = s.practice_id
)
union all
select 'cross_tenant_capture_creators', count(*)
from capture_sessions s
where s.created_by is not null
  and not exists (
    select 1 from users u
    where u.id = s.created_by and u.practice_id = s.practice_id
  )
union all
select 'invalid_capture_appointments', count(*)
from capture_sessions s
where s.appointment_id is not null
  and not exists (
    select 1 from appointments a
    where a.id = s.appointment_id
      and a.practice_id = s.practice_id
      and a.patient_id = s.patient_id
  )
union all
select 'cross_tenant_consent_patients', count(*)
from consent_requests r
where not exists (
  select 1 from patients p
  where p.id = r.patient_id and p.practice_id = r.practice_id
)
union all
select 'cross_tenant_consent_creators', count(*)
from consent_requests r
where r.created_by is not null
  and not exists (
    select 1 from users u
    where u.id = r.created_by and u.practice_id = r.practice_id
  )
union all
select 'invalid_consent_appointments', count(*)
from consent_requests r
where r.appointment_id is not null
  and not exists (
    select 1 from appointments a
    where a.id = r.appointment_id
      and a.practice_id = r.practice_id
      and a.patient_id = r.patient_id
  )
union all
select 'cross_tenant_consent_forms', count(*)
from consent_requests r
where r.form_id is not null
  and not exists (
    select 1 from consent_forms f
    where f.id = r.form_id and f.practice_id = r.practice_id
  )
union all
select 'cross_tenant_consent_files', count(*)
from consent_requests r
where r.file_id is not null
  and not exists (
    select 1 from files f
    where f.id = r.file_id and f.practice_id = r.practice_id
  )
union all
select 'invalid_consent_signing_state', count(*)
from consent_requests
where status not in ('pending', 'signing', 'signed')
   or not (
     (status = 'pending' and signer_name is null and signed_at is null and file_id is null)
     or (status = 'signing' and signer_name is not null and signed_at is not null)
     or (status = 'signed' and signer_name is not null and signed_at is not null and file_id is not null)
   )
union all
select 'missing_staged_constraints', count(*)
from (values
  ('files', 'files_uploader_tenant_fk'),
  ('files', 'files_checksum_sha256_format_check'),
  ('files', 'files_file_size_bytes_check'),
  ('files', 'files_appointment_requires_patient_check'),
  ('files', 'files_available_evidence_check'),
  ('files', 'files_primary_namespace_check'),
  ('files', 'files_patient_entity_consistency_check'),
  ('file_object_replicas', 'file_object_replicas_attempt_count_check'),
  ('file_object_replicas', 'file_object_replicas_checksum_sha256_format_check'),
  ('file_object_replicas', 'file_object_replicas_file_size_bytes_check'),
  ('file_object_replicas', 'file_object_replicas_available_evidence_check'),
  ('file_object_replicas', 'file_object_replicas_lease_coherence_check'),
  ('file_object_replicas', 'file_object_replicas_independent_object_key_check'),
  ('file_storage_events', 'file_storage_events_expected_file_size_bytes_check'),
  ('file_storage_events', 'file_storage_events_observed_file_size_bytes_check'),
  ('capture_sessions', 'capture_sessions_patient_tenant_fk'),
  ('capture_sessions', 'capture_sessions_creator_tenant_fk'),
  ('capture_sessions', 'capture_sessions_appointment_patient_tenant_fk'),
  ('consent_requests', 'consent_requests_patient_tenant_fk'),
  ('consent_requests', 'consent_requests_creator_tenant_fk'),
  ('consent_requests', 'consent_requests_appointment_patient_tenant_fk'),
  ('consent_requests', 'consent_requests_form_tenant_fk'),
  ('consent_requests', 'consent_requests_file_tenant_fk'),
  ('consent_requests', 'consent_requests_status_check'),
  ('consent_requests', 'consent_requests_signing_evidence_check')
) expected(table_name, constraint_name)
where not exists (
  select 1
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = expected.table_name
    and c.conname = expected.constraint_name
)
union all
select 'invalid_required_indexes', count(*)
from (values
  ('files_practice_file_key_uq'),
  ('files_practice_idempotency_key_uq'),
  ('file_object_replicas_due_idx'),
  ('file_storage_events_event_key_uq'),
  ('consent_forms_practice_id_uq')
) expected(index_name)
where not exists (
  select 1
  from pg_catalog.pg_index i
  join pg_catalog.pg_class idx on idx.oid = i.indexrelid
  join pg_catalog.pg_namespace n on n.oid = idx.relnamespace
  where n.nspname = 'public'
    and idx.relname = expected.index_name
    and i.indisvalid
    and i.indisready
);
