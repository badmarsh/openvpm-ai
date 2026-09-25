-- Count-only, read-only preflight for the file recovery foundation.
-- Run against production and demo before applying migrations 0077-0079.
-- Every release-blocking count must be zero. The two *_backfills counts are
-- informational and are repaired deterministically by migration 0078 before
-- its constraints are staged. This query intentionally returns no row
-- contents.
select 'duplicate_file_key_groups' issue, count(*) violations
from (
  select 1 from files group by practice_id, file_key having count(*) > 1
) v
union all
select 'duplicate_idempotency_groups', count(*)
from (
  select 1 from files where idempotency_key is not null
  group by practice_id, idempotency_key having count(*) > 1
) v
union all
select 'cross_tenant_uploaders', count(*)
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
select 'available_files_without_evidence', count(*)
from files
where storage_status = 'available'
  and (checksum_sha256 is null or file_size_bytes is null or storage_verified_at is null)
union all
select 'patient_id_backfills', count(*)
from files f
where f.entity_type = 'patient'
  and f.patient_id is null
  and f.entity_id is not null
  and exists (
    select 1 from patients p
    where p.id = f.entity_id and p.practice_id = f.practice_id
  )
union all
select 'unrepairable_patient_entities', count(*)
from files f
where f.entity_type = 'patient'
  and (
    f.entity_id is null
    or (f.patient_id is not null and f.patient_id <> f.entity_id)
    or not exists (
      select 1 from patients p
      where p.id = f.entity_id and p.practice_id = f.practice_id
    )
  )
union all
select 'appointment_patient_id_backfills', count(*)
from files f
where f.appointment_id is not null
  and f.patient_id is null
  and exists (
    select 1 from appointments a
    where a.id = f.appointment_id
      and a.practice_id = f.practice_id
      and a.patient_id is not null
  )
union all
select 'unrepairable_appointment_links', count(*)
from files f
where f.appointment_id is not null
  and (
    not exists (
      select 1 from appointments a
      where a.id = f.appointment_id and a.practice_id = f.practice_id
    )
    or (
      f.patient_id is not null
      and not exists (
        select 1 from appointments a
        where a.id = f.appointment_id
          and a.practice_id = f.practice_id
          and a.patient_id = f.patient_id
      )
    )
  )
union all
select 'invalid_primary_namespaces', count(*)
from files
where category is null
   or category not in ('patient-photos','documents','lab-results','branding','consents')
   or file_key !~ ('^' || practice_id::text || '/' || category || '/[^/]+$')
   or file_url is distinct from '/api/files/' || file_key
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
    or verified_at is null
    or replicated_at is null
  )
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
   );
