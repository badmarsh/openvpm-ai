--
-- PostgreSQL database dump
--

\restrict 5YR5uoBJamzPjSZab4MebquUw1dBgQLE4gUcYZqiitXWMan6Cr1qAvlXxQ7Kt8G

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: ai_audit_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_audit_entity_type AS ENUM (
    'soap_note',
    'discharge_report',
    'imaging_analysis',
    'treatment_plan',
    'prescription',
    'marketing_content',
    'marketing_media'
);


--
-- Name: ai_imaging_image_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_imaging_image_type AS ENUM (
    'xray',
    'ct',
    'mri',
    'ultrasound',
    'photo'
);


--
-- Name: ai_imaging_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_imaging_status AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: allergy_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.allergy_severity AS ENUM (
    'mild',
    'moderate',
    'severe'
);


--
-- Name: analyzer_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.analyzer_type AS ENUM (
    'IDEXX',
    'FUJI_DRI_CHEM',
    'MINDRAY',
    'LABTECHNIK',
    'INLAB',
    'QUICKSEAL',
    'GENERIC_CSV',
    'MANUAL'
);


--
-- Name: appointment_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_origin AS ENUM (
    'scheduled',
    'field'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'confirmed',
    'checked_in',
    'in_exam',
    'checked_out',
    'no_show',
    'cancelled'
);


--
-- Name: auth_email_attempt_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.auth_email_attempt_outcome AS ENUM (
    'reserved',
    'accepted',
    'definite_failure',
    'outcome_unknown'
);


--
-- Name: auth_email_delivery_attribution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.auth_email_delivery_attribution AS ENUM (
    'attempt_tag',
    'provider_message_id',
    'unmatched',
    'identity_conflict'
);


--
-- Name: auth_email_delivery_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.auth_email_delivery_classification AS ENUM (
    'sent',
    'delivered',
    'delayed',
    'failed',
    'complained',
    'opened',
    'clicked',
    'unknown'
);


--
-- Name: auth_email_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.auth_email_source AS ENUM (
    'registration',
    'authenticated_resend'
);


--
-- Name: backup_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.backup_run_status AS ENUM (
    'ok',
    'degraded',
    'failed'
);


--
-- Name: billing_interval; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_interval AS ENUM (
    'monthly',
    'annual'
);


--
-- Name: care_reminder_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.care_reminder_status AS ENUM (
    'open',
    'completed',
    'dismissed'
);


--
-- Name: case_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_status AS ENUM (
    'open',
    'closed'
);


--
-- Name: claim_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.claim_status AS ENUM (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'denied',
    'paid'
);


--
-- Name: client_contact_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_contact_kind AS ENUM (
    'co_owner',
    'authorized_contact',
    'billing_contact',
    'emergency_contact',
    'other'
);


--
-- Name: clinic_pilot_communication_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_communication_mode AS ENUM (
    'email_only',
    'email_and_sms'
);


--
-- Name: clinic_pilot_contact_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_contact_outcome AS ENUM (
    'replied',
    'no_reply',
    'scheduled',
    'completed',
    'declined'
);


--
-- Name: clinic_pilot_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_decision AS ENUM (
    'pending',
    'eligible',
    'approved',
    'paused',
    'not_a_fit',
    'graduated'
);


--
-- Name: clinic_pilot_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_event_type AS ENUM (
    'enrolled',
    'updated'
);


--
-- Name: clinic_pilot_next_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_next_action AS ENUM (
    'confirm_fit',
    'schedule_setup',
    'validate_import',
    'complete_first_visit',
    'review_communications',
    'configure_payment',
    'review_clinic_week',
    'resolve_blockers',
    'decide_graduation',
    'support_retention',
    'revisit_fit'
);


--
-- Name: clinic_pilot_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_reason AS ENUM (
    'initial_review',
    'clinic_feedback',
    'product_evidence',
    'support_review',
    'blocker_review',
    'graduation_decision'
);


--
-- Name: clinic_pilot_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_stage AS ENUM (
    'candidate',
    'parallel_setup',
    'visit_validation',
    'pilot_week',
    'graduation_review',
    'completed',
    'closed'
);


--
-- Name: clinic_pilot_support_cadence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_support_cadence AS ENUM (
    'daily',
    'twice_weekly',
    'weekly'
);


--
-- Name: clinic_pilot_workflow; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinic_pilot_workflow AS ENUM (
    'general_practice',
    'house_call'
);


--
-- Name: clinical_correction_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinical_correction_action AS ENUM (
    'entered_in_error'
);


--
-- Name: clinical_correction_record_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinical_correction_record_type AS ENUM (
    'soap_note',
    'vital_sign',
    'vaccination_record',
    'lab_result',
    'patient_allergy'
);


--
-- Name: clinician_confirmation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinician_confirmation_status AS ENUM (
    'PENDING',
    'CONSUMED',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: comm_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_channel AS ENUM (
    'phone',
    'sms',
    'email',
    'portal'
);


--
-- Name: comm_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: comm_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed'
);


--
-- Name: contact_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_method AS ENUM (
    'phone',
    'email',
    'sms',
    'portal'
);


--
-- Name: controlled_substance_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.controlled_substance_action AS ENUM (
    'received',
    'administered',
    'wasted',
    'returned'
);


--
-- Name: conversion_evidence_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversion_evidence_source AS ENUM (
    'practice_created',
    'product_records',
    'stripe_webhook'
);


--
-- Name: crsz_registration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crsz_registration_status AS ENUM (
    'NOT_REGISTERED',
    'PENDING_SUBMISSION',
    'REGISTERED',
    'REJECTED'
);


--
-- Name: dental_condition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dental_condition AS ENUM (
    'HEALTHY',
    'MISSING',
    'FRACTURED',
    'DECAYED',
    'MOBILE',
    'ABRADED',
    'CROWNED',
    'OTHER'
);


--
-- Name: discharge_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_report_status AS ENUM (
    'draft',
    'finalized'
);


--
-- Name: dispense_charge_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispense_charge_status AS ENUM (
    'pending',
    'invoiced',
    'waived'
);


--
-- Name: ekasa_payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ekasa_payment_method AS ENUM (
    'CASH',
    'CARD',
    'TRANSFER'
);


--
-- Name: ekasa_pokladnica_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ekasa_pokladnica_type AS ENUM (
    'ORP',
    'VRP',
    'CLOUD'
);


--
-- Name: ekasa_receipt_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ekasa_receipt_status AS ENUM (
    'PENDING',
    'SENT',
    'CONFIRMED',
    'FAILED',
    'OFFLINE_STORED'
);


--
-- Name: ekasa_receipt_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ekasa_receipt_type AS ENUM (
    'STANDARD',
    'STORNO',
    'RETURN',
    'DEPOSIT',
    'WITHDRAWAL'
);


--
-- Name: ekasa_vat_rate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ekasa_vat_rate AS ENUM (
    'ZERO',
    'REDUCED',
    'STANDARD',
    'REDUCED_5',
    'REDUCED_19',
    'STANDARD_23'
);


--
-- Name: email_suppression_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_suppression_reason AS ENUM (
    'manual',
    'bounce',
    'complaint',
    'suppressed'
);


--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enrollment_status AS ENUM (
    'active',
    'cancelled'
);


--
-- Name: ext_automation_enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_enrollment_status AS ENUM (
    'active',
    'completed',
    'exited',
    'paused',
    'failed'
);


--
-- Name: ext_automation_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_event_status AS ENUM (
    'pending',
    'processing',
    'processed',
    'failed',
    'skipped'
);


--
-- Name: ext_automation_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_event_type AS ENUM (
    'appointment_booked',
    'appointment_reminder',
    'appointment_no_show',
    'appointment_completed',
    'visit_completed',
    'visit_closeout',
    'vaccine_due',
    'inactive_recall',
    'annual_checkup_due',
    'senior_milestone',
    'senior_screening',
    'surgery_completed',
    'wellness_enrolled',
    'dental_detected',
    'payment_failed',
    'patient_deceased',
    'lab_result_received',
    'treatment_plan_created',
    'prescription_issued',
    'review_received',
    'review_reply_published',
    'content_brief_approved',
    'content_published',
    'consent_revoked',
    'client_created',
    'patient_created',
    'patient_reactivated',
    'inventory_delivery_received'
);


--
-- Name: ext_automation_rule_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_rule_action AS ENUM (
    'create_journey',
    'send_communication',
    'create_task',
    'create_content_brief'
);


--
-- Name: ext_automation_step_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_step_status AS ENUM (
    'scheduled',
    'executing',
    'done',
    'skipped',
    'failed'
);


--
-- Name: ext_automation_suppression_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_automation_suppression_reason AS ENUM (
    'deceased_patient',
    'opt_out',
    'no_consent',
    'frequency_cap',
    'quiet_hours',
    'recovery_hold',
    'manual_block',
    'cooldown',
    'sensitivity_period',
    'sms_rate_limit',
    'unknown_contact'
);


--
-- Name: ext_channel_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_channel_account_status AS ENUM (
    'connected',
    'expired',
    'revoked',
    'error'
);


--
-- Name: ext_channel_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_channel_provider AS ENUM (
    'google_business',
    'facebook',
    'instagram',
    'youtube'
);


--
-- Name: ext_content_brief_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_content_brief_status AS ENUM (
    'pending',
    'generating',
    'review',
    'approved',
    'rejected',
    'archived'
);


--
-- Name: ext_crm_refresh_strategy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_crm_refresh_strategy AS ENUM (
    'event_driven',
    'scheduled',
    'manual'
);


--
-- Name: ext_marketing_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_channel AS ENUM (
    'instagram',
    'facebook',
    'google_business',
    'sms',
    'email'
);


--
-- Name: ext_marketing_consent_evidence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_consent_evidence AS ENUM (
    'signature',
    'sms_confirm',
    'pdf'
);


--
-- Name: ext_marketing_consent_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_consent_scope AS ENUM (
    'photo_social',
    'photo_web',
    'photo_tv',
    'story',
    'testimonial',
    'marketing_messages'
);


--
-- Name: ext_marketing_content_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_content_status AS ENUM (
    'proposed',
    'approved',
    'published',
    'blocked',
    'archived'
);


--
-- Name: ext_marketing_media_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_media_kind AS ENUM (
    'photo',
    'brand_graphic',
    'video',
    'illustration'
);


--
-- Name: ext_marketing_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_message_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'suppressed_quiet',
    'suppressed_rate',
    'suppressed_no_consent',
    'blocked_sympathy'
);


--
-- Name: ext_marketing_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_marketing_task_status AS ENUM (
    'open',
    'done'
);


--
-- Name: ext_reputation_escalation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_reputation_escalation AS ENUM (
    'none',
    'pending',
    'escalated',
    'resolved',
    'wont_fix'
);


--
-- Name: ext_reputation_sentiment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_reputation_sentiment AS ENUM (
    'positive',
    'neutral',
    'negative',
    'mixed'
);


--
-- Name: ext_reputation_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ext_reputation_severity AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'none'
);


--
-- Name: external_lab_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.external_lab_report_status AS ENUM (
    'ordered',
    'partial',
    'final',
    'corrected',
    'cancelled',
    'unknown'
);


--
-- Name: external_prescription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.external_prescription_status AS ENUM (
    'active',
    'completed',
    'cancelled',
    'expired',
    'unknown'
);


--
-- Name: file_replica_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.file_replica_status AS ENUM (
    'pending',
    'available',
    'missing',
    'corrupt',
    'failed'
);


--
-- Name: file_storage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.file_storage_status AS ENUM (
    'unverified',
    'pending_upload',
    'available',
    'missing',
    'corrupt',
    'cleanup_pending'
);


--
-- Name: historical_appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.historical_appointment_status AS ENUM (
    'completed',
    'cancelled',
    'no_show',
    'unknown'
);


--
-- Name: historical_document_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.historical_document_kind AS ENUM (
    'patient_record',
    'lab_report',
    'prescription',
    'appointment',
    'financial',
    'other'
);


--
-- Name: historical_document_link_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.historical_document_link_status AS ENUM (
    'linked',
    'needs_review'
);


--
-- Name: imported_clinical_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.imported_clinical_review_status AS ENUM (
    'unreviewed',
    'confirmed',
    'superseded'
);


--
-- Name: interaction_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_severity AS ENUM (
    'minor',
    'moderate',
    'major'
);


--
-- Name: invoice_adjustment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_adjustment_type AS ENUM (
    'credit',
    'write_off'
);


--
-- Name: invoice_item_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_item_type AS ENUM (
    'service',
    'product'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'void'
);


--
-- Name: kvepis_signature_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kvepis_signature_method AS ENUM (
    'NONE',
    'DSIGNER',
    'CLOUD_SEAL',
    'HSM'
);


--
-- Name: kvepis_submission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kvepis_submission_status AS ENUM (
    'DRAFT',
    'VALIDATED',
    'SIGNED',
    'SUBMITTED',
    'ACKNOWLEDGED',
    'REJECTED'
);


--
-- Name: kvepis_submission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kvepis_submission_type AS ENUM (
    'rabies_notification',
    'treatment_diary_batch',
    'animal_movement',
    'infectious_disease_alert'
);


--
-- Name: lab_follow_up_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_follow_up_status AS ENUM (
    'not_required',
    'open',
    'completed'
);


--
-- Name: lab_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_report_status AS ENUM (
    'UNASSIGNED',
    'ATTACHED',
    'REVIEWED'
);


--
-- Name: lab_result_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_result_event_type AS ENUM (
    'created',
    'completed',
    'reviewed',
    'follow_up_assigned',
    'follow_up_reassigned',
    'follow_up_completed'
);


--
-- Name: lab_result_flag; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_result_flag AS ENUM (
    'unknown',
    'normal',
    'abnormal',
    'critical'
);


--
-- Name: lab_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_status AS ENUM (
    'pending',
    'completed',
    'reviewed'
);


--
-- Name: legacy_financial_document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.legacy_financial_document_status AS ENUM (
    'open',
    'partial',
    'paid',
    'void',
    'unknown'
);


--
-- Name: legacy_financial_document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.legacy_financial_document_type AS ENUM (
    'invoice',
    'credit_note',
    'estimate'
);


--
-- Name: legacy_financial_payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.legacy_financial_payment_type AS ENUM (
    'payment',
    'refund',
    'adjustment'
);


--
-- Name: messaging_business_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_business_entity_type AS ENUM (
    'PRIVATE_PROFIT',
    'NON_PROFIT'
);


--
-- Name: messaging_number_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_number_source AS ENUM (
    'hosted',
    'purchased',
    'toll_free'
);


--
-- Name: messaging_registration_actor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_registration_actor_type AS ENUM (
    'clinic_user',
    'platform_operator',
    'system'
);


--
-- Name: messaging_registration_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_registration_event_type AS ENUM (
    'details_saved',
    'provider_operation_started',
    'provider_operation_succeeded',
    'provider_operation_failed',
    'provider_state_observed',
    'provider_ids_attached',
    'stale_lock_cleared',
    'provider_profile_enabled',
    'provider_profile_disabled',
    'provider_profile_verified'
);


--
-- Name: messaging_registration_operation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_registration_operation AS ENUM (
    'registration_details',
    'brand_submission',
    'campaign_submission',
    'number_assignment',
    'registration_reconciliation',
    'provider_id_recovery',
    'submission_lock_recovery',
    'profile_activation',
    'profile_deactivation',
    'profile_verification'
);


--
-- Name: messaging_registration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.messaging_registration_status AS ENUM (
    'not_started',
    'pending',
    'active',
    'action_required',
    'failed',
    'suspended'
);


--
-- Name: microchip_location; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.microchip_location AS ENUM (
    'LEFT_NECK',
    'INTERSCAPULAR',
    'RIGHT_NECK',
    'OTHER'
);


--
-- Name: migration_attribution_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.migration_attribution_status AS ENUM (
    'matched',
    'needs_review'
);


--
-- Name: migration_run_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.migration_run_mode AS ENUM (
    'clients',
    'patients',
    'vaccinations',
    'soap_notes',
    'care_reminders',
    'services',
    'products',
    'client_contacts',
    'historical_appointments',
    'external_prescriptions',
    'external_prescription_fills',
    'external_lab_reports',
    'external_lab_observations',
    'legacy_financial_documents',
    'legacy_financial_line_items',
    'legacy_financial_payments',
    'legacy_financial_allocations',
    'historical_documents'
);


--
-- Name: migration_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.migration_run_status AS ENUM (
    'previewed',
    'superseded',
    'committing',
    'committed'
);


--
-- Name: note_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.note_type AS ENUM (
    'general',
    'follow_up',
    'phone_call'
);


--
-- Name: patient_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_status AS ENUM (
    'active',
    'inactive',
    'deceased'
);


--
-- Name: payment_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_account_status AS ENUM (
    'pending',
    'active',
    'action_required',
    'disabled'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'credit_card',
    'debit_card',
    'check',
    'online',
    'other'
);


--
-- Name: practice_conversion_milestone; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.practice_conversion_milestone AS ENUM (
    'registered',
    'activated',
    'payment_method_collected',
    'first_positive_payment'
);


--
-- Name: prescription_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prescription_event_type AS ENUM (
    'created',
    'refill_dispensed',
    'refill_authorized',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: prescription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prescription_status AS ENUM (
    'active',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: problem_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.problem_status AS ENUM (
    'active',
    'resolved',
    'chronic'
);


--
-- Name: purchase_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_order_status AS ENUM (
    'draft',
    'ordered',
    'received'
);


--
-- Name: recurring_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_frequency AS ENUM (
    'weekly',
    'monthly',
    'annual'
);


--
-- Name: room_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.room_type AS ENUM (
    'exam',
    'surgery',
    'treatment',
    'boarding'
);


--
-- Name: sex; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sex AS ENUM (
    'male',
    'female',
    'male_neutered',
    'female_spayed'
);


--
-- Name: sms_consent_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_consent_action AS ENUM (
    'granted',
    'revoked'
);


--
-- Name: sms_consent_actor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_consent_actor_type AS ENUM (
    'staff',
    'client',
    'system'
);


--
-- Name: sms_delivery_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_delivery_classification AS ENUM (
    'unknown',
    'sent',
    'failed',
    'delivered'
);


--
-- Name: sms_delivery_history_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_delivery_history_kind AS ENUM (
    'automatic',
    'operator_reconciliation'
);


--
-- Name: sms_delivery_history_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_delivery_history_result AS ENUM (
    'unmatched',
    'ambiguous',
    'attributed',
    'projected',
    'projection_miss',
    'reconciled',
    'operator_reviewed'
);


--
-- Name: sms_delivery_reconciliation_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_delivery_reconciliation_reason AS ENUM (
    'exact_attribution_retry',
    'provider_portal_status_review',
    'projection_repair',
    'identity_conflict_review',
    'unmatched_evidence_review'
);


--
-- Name: sms_provider_event_conflict_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_provider_event_conflict_resolution AS ENUM (
    'semantic_duplicate_confirmed',
    'provider_identity_rotated',
    'incident_closed_no_projection'
);


--
-- Name: sms_provider_event_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_provider_event_kind AS ENUM (
    'inbound',
    'delivery',
    'a2p'
);


--
-- Name: sms_provider_event_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_provider_event_resolution AS ENUM (
    'authoritative_projection',
    'conservative_opt_out',
    'carrier_state_reconciled',
    'provider_attested_no_projection'
);


--
-- Name: sms_provider_event_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_provider_event_state AS ENUM (
    'pending',
    'retry',
    'blocked_recovery',
    'projected',
    'ignored',
    'quarantined'
);


--
-- Name: sms_provider_inbound_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_provider_inbound_classification AS ENUM (
    'stop',
    'start',
    'help',
    'other'
);


--
-- Name: sms_send_actor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_send_actor_type AS ENUM (
    'clinic_user',
    'platform_operator'
);


--
-- Name: sms_send_attempt_event_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_send_attempt_event_kind AS ENUM (
    'provider_result',
    'reconciliation'
);


--
-- Name: sms_send_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_send_outcome AS ENUM (
    'accepted',
    'definite_failure',
    'outcome_unknown'
);


--
-- Name: sms_suppression_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_suppression_reason AS ENUM (
    'stop',
    'manual',
    'bounce',
    'complaint'
);


--
-- Name: soap_note_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.soap_note_status AS ENUM (
    'draft',
    'finalized'
);


--
-- Name: species; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.species AS ENUM (
    'canine',
    'feline',
    'avian',
    'rabbit',
    'reptile',
    'equine',
    'bovine',
    'ovine',
    'caprine',
    'porcine',
    'poultry',
    'camelid',
    'other'
);


--
-- Name: stripe_conversion_evidence_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stripe_conversion_evidence_kind AS ENUM (
    'subscription_checkout_completed',
    'positive_subscription_invoice_paid'
);


--
-- Name: treatment_plan_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.treatment_plan_item_status AS ENUM (
    'pending',
    'in_progress',
    'done',
    'skipped'
);


--
-- Name: treatment_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.treatment_plan_status AS ENUM (
    'active',
    'completed',
    'discontinued'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'veterinarian',
    'technician',
    'front_desk',
    'viewer'
);


--
-- Name: vaccination_dose_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vaccination_dose_type AS ENUM (
    'initial',
    'booster'
);


--
-- Name: visit_charge_disposition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_charge_disposition AS ENUM (
    'paid',
    'accounts_receivable',
    'no_charge'
);


--
-- Name: visit_closeout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_closeout_status AS ENUM (
    'draft',
    'clinical_finalized',
    'completed'
);


--
-- Name: visit_follow_up_disposition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_follow_up_disposition AS ENUM (
    'none',
    'needed',
    'scheduled'
);


--
-- Name: visit_follow_up_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_follow_up_resolution AS ENUM (
    'scheduled',
    'completed',
    'not_needed'
);


--
-- Name: visit_handoff_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_handoff_method AS ENUM (
    'print',
    'verbal',
    'declined'
);


--
-- Name: visit_prescription_disposition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_prescription_disposition AS ENUM (
    'prescribed',
    'not_needed'
);


--
-- Name: visit_treatment_plan_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_treatment_plan_decision AS ENUM (
    'accepted',
    'declined'
);


--
-- Name: visit_treatment_plan_item_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_treatment_plan_item_type AS ENUM (
    'service',
    'product'
);


--
-- Name: visit_treatment_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_treatment_plan_status AS ENUM (
    'open',
    'completed',
    'cancelled'
);


--
-- Name: visit_work_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visit_work_status AS ENUM (
    'unresolved',
    'charged',
    'no_charge',
    'voided'
);


--
-- Name: voice_dictation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.voice_dictation_status AS ENUM (
    'RECORDING',
    'TRANSCRIBING',
    'FORMATTING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: waitlist_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.waitlist_status AS ENUM (
    'waiting',
    'scheduled',
    'cancelled'
);


--
-- Name: app_current_practice_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_practice_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$ SELECT nullif(current_setting('app.current_practice_id', true), '')::uuid $$;


--
-- Name: app_rls_bypass(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_rls_bypass() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$ SELECT coalesce(current_setting('app.rls_bypass', true), '') = 'on' $$;


--
-- Name: assign_appointment_scheduling_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_appointment_scheduling_location() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.location_id IS NULL AND NEW.room_id IS NOT NULL THEN
    SELECT r.location_id
    INTO NEW.location_id
    FROM public.rooms r
    JOIN public.locations l
      ON l.id = r.location_id
     AND l.practice_id = NEW.practice_id
     AND l.deleted_at IS NULL
    WHERE r.id = NEW.room_id
      AND r.practice_id = NEW.practice_id
      AND r.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NULL AND NEW.doctor_id IS NOT NULL THEN
    SELECT u.location_id
    INTO NEW.location_id
    FROM public.users u
    JOIN public.locations l
      ON l.id = u.location_id
     AND l.practice_id = NEW.practice_id
     AND l.deleted_at IS NULL
    WHERE u.id = NEW.doctor_id
      AND u.practice_id = NEW.practice_id
      AND u.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NULL THEN
    SELECT l.id
    INTO NEW.location_id
    FROM public.locations l
    WHERE l.practice_id = NEW.practice_id
      AND l.deleted_at IS NULL
      AND (
        l.is_primary = true
        OR (
          SELECT count(*)
          FROM public.locations sole
          WHERE sole.practice_id = NEW.practice_id
            AND sole.deleted_at IS NULL
        ) = 1
      )
    ORDER BY l.is_primary DESC, l.id
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'Choose a clinic location before scheduling this appointment.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: assign_room_scheduling_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_room_scheduling_location() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    SELECT l.id
    INTO NEW.location_id
    FROM public.locations l
    WHERE l.practice_id = NEW.practice_id
      AND l.deleted_at IS NULL
      AND (
        l.is_primary = true
        OR (
          SELECT count(*)
          FROM public.locations sole
          WHERE sole.practice_id = NEW.practice_id
            AND sole.deleted_at IS NULL
        ) = 1
      )
    ORDER BY l.is_primary DESC, l.id
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'A clinic location is required before creating this room.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: compute_visit_treatment_plan_response_sha256(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_visit_treatment_plan_response_sha256(p_practice_id uuid, p_plan_id uuid, p_revision_id uuid, p_response_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'version', 1, 'practiceId', p_practice_id::text,
      'planId', p_plan_id::text, 'revisionId', p_revision_id::text,
      'revisionSha256', revision.content_sha256,
      'responseId', p_response_id::text,
      'decisions', coalesce((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'revisionLineId', decision.revision_line_id::text,
          'decision', decision.decision::text,
          'acceptedQuantity', decision.accepted_quantity,
          'declineReason', decision.decline_reason
        ) ORDER BY offered.sort_order, offered.id)
        FROM public.visit_treatment_plan_response_lines decision
        JOIN public.visit_treatment_plan_revision_lines offered
          ON offered.practice_id = decision.practice_id
         AND offered.id = decision.revision_line_id
         AND offered.revision_id = decision.revision_id
        WHERE decision.practice_id = p_practice_id
          AND decision.revision_id = p_revision_id
          AND decision.response_id = p_response_id
      ), '[]'::jsonb)
    )::text, 'UTF8')), 'hex')
  FROM public.visit_treatment_plan_revisions revision
  WHERE revision.practice_id = p_practice_id
    AND revision.plan_id = p_plan_id AND revision.id = p_revision_id
$$;


--
-- Name: compute_visit_treatment_plan_response_sha256_from_decisions(uuid, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_visit_treatment_plan_response_sha256_from_decisions(p_practice_id uuid, p_plan_id uuid, p_revision_id uuid, p_response_id uuid, p_decisions jsonb) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'version', 1, 'practiceId', p_practice_id::text,
      'planId', p_plan_id::text, 'revisionId', p_revision_id::text,
      'revisionSha256', revision.content_sha256,
      'responseId', p_response_id::text,
      'decisions', coalesce((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'revisionLineId', offered.id::text,
          'decision', decision.value->>'decision',
          'acceptedQuantity', (decision.value->>'acceptedQuantity')::numeric(12,3),
          'declineReason', decision.value->'declineReason'
        ) ORDER BY offered.sort_order, offered.id)
        FROM pg_catalog.jsonb_array_elements(p_decisions) AS decision(value)
        JOIN public.visit_treatment_plan_revision_lines AS offered
          ON offered.practice_id = p_practice_id
         AND offered.revision_id = p_revision_id
         AND offered.id = (decision.value->>'revisionLineId')::uuid
      ), '[]'::jsonb)
    )::text, 'UTF8')), 'hex')
  FROM public.visit_treatment_plan_revisions AS revision
  WHERE revision.practice_id = p_practice_id
    AND revision.plan_id = p_plan_id AND revision.id = p_revision_id
$$;


--
-- Name: compute_visit_treatment_plan_revision_sha256(uuid, uuid, uuid, integer, text, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_visit_treatment_plan_revision_sha256(p_practice_id uuid, p_plan_id uuid, p_revision_id uuid, p_revision_number integer, p_currency text, p_subtotal numeric, p_tax numeric, p_total numeric) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'version', 1, 'practiceId', p_practice_id::text,
      'planId', p_plan_id::text, 'revisionId', p_revision_id::text,
      'revisionNumber', p_revision_number, 'currency', p_currency,
      'subtotal', pg_catalog.round(p_subtotal, 2),
      'tax', pg_catalog.round(p_tax, 2),
      'total', pg_catalog.round(p_total, 2),
      'lines', coalesce((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', line.id::text, 'sortOrder', line.sort_order,
          'description', line.description,
          'offeredQuantity', line.offered_quantity,
          'unitPrice', line.unit_price, 'lineSubtotal', line.line_subtotal,
          'taxAmount', line.tax_amount, 'lineTotal', line.line_total,
          'taxable', line.taxable, 'itemType', line.item_type::text,
          'serviceId', line.service_id::text, 'productId', line.product_id::text
        ) ORDER BY line.sort_order, line.id)
        FROM public.visit_treatment_plan_revision_lines line
        WHERE line.practice_id = p_practice_id
          AND line.plan_id = p_plan_id AND line.revision_id = p_revision_id
      ), '[]'::jsonb)
    )::text, 'UTF8')), 'hex')
$$;


--
-- Name: delete_expired_consent_receipt_capabilities(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_expired_consent_receipt_capabilities(p_before timestamp with time zone, p_limit integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT public.app_rls_bypass()
     OR p_before IS NULL
     OR p_before > pg_catalog.clock_timestamp()
     OR p_limit NOT BETWEEN 1 AND 1000
  THEN RETURN 0; END IF;
  WITH doomed AS (
    SELECT capability.id
    FROM public.consent_receipt_capabilities AS capability
    WHERE capability.expires_at <= p_before
    ORDER BY capability.expires_at, capability.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.consent_receipt_capabilities AS capability
  USING doomed
  WHERE capability.id = doomed.id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END
$$;


--
-- Name: enforce_clinic_pilot_projection_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_clinic_pilot_projection_audit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clinic_pilot_events e
    WHERE e.clinic_pilot_id = NEW.id
      AND e.practice_id = NEW.practice_id
      AND e.projection_version = NEW.version
      AND e.cohort_key = NEW.cohort_key
      AND e.workflow = NEW.workflow
      AND e.stage = NEW.stage
      AND e.decision = NEW.decision
      AND e.qualification_checklist = NEW.qualification_checklist
      AND e.readiness_checklist = NEW.readiness_checklist
      AND e.blocker_codes = NEW.blocker_codes
      AND e.next_action = NEW.next_action
      AND e.support_cadence = NEW.support_cadence
      AND e.owner_identity = NEW.owner_identity
      AND e.communication_mode = NEW.communication_mode
      AND e.communication_tested_at IS NOT DISTINCT FROM NEW.communication_tested_at
      AND e.first_visit_validated_at IS NOT DISTINCT FROM NEW.first_visit_validated_at
      AND e.first_visit_validated_closeout_id IS NOT DISTINCT FROM NEW.first_visit_validated_closeout_id
      AND e.clinic_use_validated_at IS NOT DISTINCT FROM NEW.clinic_use_validated_at
      AND e.clinic_use_validated_hash IS NOT DISTINCT FROM NEW.clinic_use_validated_hash
      AND e.clinic_acceptance_at IS NOT DISTINCT FROM NEW.clinic_acceptance_at
      AND e.clinic_acceptance_by_user_id IS NOT DISTINCT FROM NEW.clinic_acceptance_by_user_id
      AND e.last_contact_at IS NOT DISTINCT FROM NEW.last_contact_at
      AND e.last_contact_outcome IS NOT DISTINCT FROM NEW.last_contact_outcome
      AND e.target_start_on IS NOT DISTINCT FROM NEW.target_start_on
      AND e.next_review_at IS NOT DISTINCT FROM NEW.next_review_at
  ) THEN
    RAISE EXCEPTION 'clinic pilot projection version % requires a matching immutable event', NEW.version;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_soap_appointment_invariant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_soap_appointment_invariant() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	target_practice_id uuid;
	target_appointment_id uuid;
	draft_count integer;
	effective_final_count integer;
BEGIN
	IF TG_OP = 'DELETE' THEN
		target_practice_id := OLD.practice_id;
		target_appointment_id := OLD.appointment_id;
	ELSE
		target_practice_id := NEW.practice_id;
		target_appointment_id := NEW.appointment_id;
	END IF;
	IF target_appointment_id IS NULL THEN RETURN NULL; END IF;

	SELECT
		count(*) FILTER (WHERE note.status = 'draft'),
		count(*) FILTER (
			WHERE note.status = 'finalized'
				AND NOT EXISTS (
					SELECT 1
					FROM public.clinical_record_corrections AS correction
					WHERE correction.practice_id = note.practice_id
						AND correction.soap_note_id = note.id
				)
		)
	INTO draft_count, effective_final_count
	FROM public.soap_notes AS note
	WHERE note.practice_id = target_practice_id
		AND note.appointment_id = target_appointment_id
		AND note.deleted_at IS NULL;

	IF draft_count > 1
		OR effective_final_count > 1
		OR (draft_count > 0 AND effective_final_count > 0)
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			CONSTRAINT = 'soap_notes_appointment_invariant',
			MESSAGE = 'An encounter may have one active SOAP draft or one effective finalized SOAP note, but not both.';
	END IF;
	RETURN NULL;
END;
$$;


--
-- Name: finalize_consent_request(uuid, uuid, uuid, uuid, text, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_consent_request(p_practice_id uuid, p_consent_request_id uuid, p_file_id uuid, p_expected_lease_token uuid, p_file_key text, p_checksum text, p_file_size integer, p_object_etag text, p_object_version_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  IF public.app_current_practice_id() IS DISTINCT FROM p_practice_id
     OR p_expected_lease_token IS NULL
     OR p_file_key IS NULL
     OR p_checksum !~ '^[0-9a-f]{64}$'
     OR p_file_size <= 0
  THEN RETURN false; END IF;

  UPDATE public.consent_requests AS consent
  SET status = 'signed',
      storage_lease_token = NULL,
      storage_lease_expires_at = NULL,
      signed_file_key = p_file_key,
      signed_file_checksum_sha256 = p_checksum,
      signed_file_size_bytes = p_file_size,
      signed_file_object_etag = p_object_etag,
      signed_file_object_version_id = p_object_version_id,
      updated_at = pg_catalog.clock_timestamp()
  WHERE consent.id = p_consent_request_id
    AND consent.practice_id = p_practice_id
    AND consent.status = 'signing'
    AND consent.file_id = p_file_id
    AND consent.storage_lease_token = p_expected_lease_token
    AND consent.signed_at > pg_catalog.clock_timestamp() - interval '15 minutes'
    AND consent.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.files AS file
      WHERE file.id = p_file_id
        AND file.practice_id = p_practice_id
        AND file.idempotency_key = p_consent_request_id
        AND file.category = 'consents'
        AND file.source = 'consent_signature'
        AND file.mime_type = 'application/pdf'
        AND file.patient_id = consent.patient_id
        AND file.file_key = p_file_key
        AND file.checksum_sha256 = p_checksum
        AND file.file_size_bytes = p_file_size
        AND file.storage_status IN ('pending_upload', 'available')
        AND file.deleted_at IS NULL
    );
  RETURN FOUND;
END
$_$;


--
-- Name: guard_auth_email_attempt_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_auth_email_attempt_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	is_owner boolean;
BEGIN
	is_owner := current_user = (
		SELECT pg_catalog.pg_get_userbyid(class.relowner)
		FROM pg_catalog.pg_class class
		JOIN pg_catalog.pg_namespace namespace
			ON namespace.oid = class.relnamespace
		WHERE namespace.nspname = TG_TABLE_SCHEMA
			AND class.relname = TG_TABLE_NAME
	);

	IF TG_OP = 'DELETE' THEN
		IF is_owner
			AND coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		THEN
			RETURN OLD;
		END IF;
		RAISE EXCEPTION USING
			ERRCODE = '55000',
			MESSAGE = 'Auth email attempts may only be deleted during owner maintenance.';
	END IF;

	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
		OR NEW.practice_id IS DISTINCT FROM OLD.practice_id
		OR NEW.user_id IS DISTINCT FROM OLD.user_id
		OR NEW.source IS DISTINCT FROM OLD.source
		OR NEW.provider IS DISTINCT FROM OLD.provider
		OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '55000',
			MESSAGE = 'Auth email attempt identity is immutable.';
	END IF;

	IF NOT (
		(OLD.outcome = 'reserved' AND NEW.outcome <> 'reserved')
		OR (
			OLD.outcome = 'outcome_unknown'
			AND NEW.outcome = 'accepted'
			AND OLD.provider = 'resend'
			AND OLD.provider_message_id IS NULL
		)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '55000',
			MESSAGE = 'Auth email attempt state transition is not permitted.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: guard_sms_provider_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_sms_provider_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider events cannot be deleted.';
	END IF;
	IF TG_OP = 'INSERT' THEN
		IF NEW.state <> 'pending' THEN
			RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'New SMS provider events must enter the pending state.';
		END IF;
		RETURN NEW;
	END IF;
	IF OLD.state IN ('projected', 'ignored', 'quarantined') THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Terminal SMS provider events are immutable.';
	END IF;

	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.received_at IS DISTINCT FROM OLD.received_at
		OR NEW.provider IS DISTINCT FROM OLD.provider
		OR NEW.kind IS DISTINCT FROM OLD.kind
		OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
		OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
		OR NEW.provider_event_type IS DISTINCT FROM OLD.provider_event_type
		OR NEW.event_key IS DISTINCT FROM OLD.event_key
		OR NEW.raw_body_fingerprint_sha256 IS DISTINCT FROM OLD.raw_body_fingerprint_sha256
		OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
		OR NEW.from_e164 IS DISTINCT FROM OLD.from_e164
		OR NEW.to_e164 IS DISTINCT FROM OLD.to_e164
		OR NEW.messaging_profile_id IS DISTINCT FROM OLD.messaging_profile_id
		OR NEW.message_body IS DISTINCT FROM OLD.message_body
		OR NEW.inbound_classification IS DISTINCT FROM OLD.inbound_classification
		OR NEW.delivery_classification IS DISTINCT FROM OLD.delivery_classification
		OR NEW.provider_status IS DISTINCT FROM OLD.provider_status
		OR NEW.provider_error_code IS DISTINCT FROM OLD.provider_error_code
		OR NEW.a2p_brand_id IS DISTINCT FROM OLD.a2p_brand_id
		OR NEW.a2p_campaign_id IS DISTINCT FROM OLD.a2p_campaign_id
		OR NEW.a2p_phone_e164 IS DISTINCT FROM OLD.a2p_phone_e164
		OR NEW.a2p_status IS DISTINCT FROM OLD.a2p_status
		OR NEW.a2p_type IS DISTINCT FROM OLD.a2p_type
		OR NEW.a2p_event_type IS DISTINCT FROM OLD.a2p_event_type
		OR NEW.a2p_observed_status IS DISTINCT FROM OLD.a2p_observed_status
		OR NEW.provider_detail IS DISTINCT FROM OLD.provider_detail
	THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event facts are immutable.';
	END IF;

	IF (OLD.practice_id IS NOT NULL AND NEW.practice_id IS DISTINCT FROM OLD.practice_id)
		OR (OLD.location_id IS NOT NULL AND NEW.location_id IS DISTINCT FROM OLD.location_id)
	THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event attribution is set-once.';
	END IF;
	IF OLD.processed_at IS NOT NULL AND NEW.processed_at IS DISTINCT FROM OLD.processed_at THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event processing time is set-once.';
	END IF;
	IF NEW.attempt_count < OLD.attempt_count THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event attempts cannot decrease.';
	END IF;
	IF NEW.last_attempt_at IS DISTINCT FROM OLD.last_attempt_at AND (
		NEW.attempt_count <= OLD.attempt_count
		OR NEW.last_attempt_at IS NULL
		OR (OLD.last_attempt_at IS NOT NULL AND NEW.last_attempt_at <= OLD.last_attempt_at)
	) THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event attempt time must advance with its attempt count.';
	END IF;
	IF NEW.attempt_count > OLD.attempt_count
		AND NEW.last_attempt_at IS NOT DISTINCT FROM OLD.last_attempt_at
	THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event attempt increments require a new attempt time.';
	END IF;

	IF NOT (
		(OLD.state = 'pending' AND NEW.state IN ('pending', 'retry', 'blocked_recovery', 'projected', 'ignored', 'quarantined'))
		OR (OLD.state = 'retry' AND NEW.state IN ('retry', 'blocked_recovery', 'projected', 'ignored', 'quarantined'))
		OR (OLD.state = 'blocked_recovery' AND NEW.state IN ('retry', 'blocked_recovery', 'projected', 'ignored', 'quarantined'))
	) THEN
		RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event state transition is not permitted.';
	END IF;
	RETURN NEW;
END;
$$;


--
-- Name: guard_soap_note_addendum(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_soap_note_addendum() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	is_owner boolean;
	expected_hash text;
	source_finalized_at timestamptz;
BEGIN
	is_owner := current_user = (
		SELECT pg_catalog.pg_get_userbyid(class.relowner)
		FROM pg_catalog.pg_class class
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
		WHERE namespace.nspname = TG_TABLE_SCHEMA
			AND class.relname = TG_TABLE_NAME
	);

	IF TG_OP = 'INSERT' THEN
		SELECT note.finalized_at
		INTO source_finalized_at
		FROM public.soap_notes AS note
		WHERE note.id = NEW.soap_note_id
			AND note.practice_id = NEW.practice_id
			AND note.status = 'finalized';
		IF source_finalized_at IS NULL
			OR NEW.created_at < source_finalized_at
			OR NEW.created_at > pg_catalog.now()
		THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'SOAP addendum chronology is invalid.';
		END IF;
		expected_hash := pg_catalog.encode(
			pg_catalog.sha256(
				pg_catalog.convert_to(
					'{"noteId":' || pg_catalog.to_json(NEW.soap_note_id::text)::text ||
					',"authorId":' || pg_catalog.to_json(NEW.author_id::text)::text ||
					',"content":' || pg_catalog.to_json(NEW.content)::text || '}',
					'UTF8'
				)
			),
			'hex'
		);
		IF NEW.operation_payload_hash IS DISTINCT FROM expected_hash THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'SOAP addendum payload hash is invalid.';
		END IF;
	END IF;

	IF is_owner
		AND coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'INSERT' THEN
		IF NOT EXISTS (
			SELECT 1
			FROM public.soap_notes AS note
			WHERE note.id = NEW.soap_note_id
				AND note.practice_id = NEW.practice_id
				AND note.status = 'finalized'
				AND note.deleted_at IS NULL
				AND NOT EXISTS (
					SELECT 1
					FROM public.clinical_record_corrections AS correction
					WHERE correction.practice_id = NEW.practice_id
						AND correction.soap_note_id = note.id
				)
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '55000',
				MESSAGE = 'Addenda require an active finalized SOAP note.';
		END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'SOAP addenda are immutable.';
END;
$$;


--
-- Name: guard_soap_note_lifecycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_soap_note_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	is_owner boolean;
	actor_name text;
	is_seeded_demo_note boolean;
BEGIN
	is_owner := current_user = (
		SELECT pg_catalog.pg_get_userbyid(class.relowner)
		FROM pg_catalog.pg_class class
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
		WHERE namespace.nspname = TG_TABLE_SCHEMA
			AND class.relname = TG_TABLE_NAME
	);

	IF is_owner
		AND coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'INSERT' THEN
		SELECT NULLIF(btrim(actor."name"), '')
		INTO actor_name
		FROM public.users AS actor
		WHERE actor.id = NEW.author_id
			AND actor.practice_id = NEW.practice_id;
		IF NEW.appointment_id IS NOT NULL THEN
			PERFORM 1
			FROM public.appointments AS appointment
			WHERE appointment.id = NEW.appointment_id
				AND appointment.practice_id = NEW.practice_id
			FOR UPDATE;
		END IF;

		NEW.author_name := COALESCE(NULLIF(btrim(NEW.author_name), ''), actor_name,
			CASE WHEN NEW.imported THEN 'Imported record' ELSE 'Unknown clinician' END);
		NEW.revision := COALESCE(NEW.revision, 1);

		IF NEW.status = 'finalized' THEN
			NEW.finalized_at := COALESCE(
				NEW.finalized_at,
				CASE WHEN NEW.imported THEN NEW.created_at ELSE pg_catalog.now() END
			);
			NEW.finalized_by := COALESCE(NEW.finalized_by, NEW.author_id);
			NEW.finalizer_name := COALESCE(NULLIF(btrim(NEW.finalizer_name), ''), NEW.author_name);
		END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		IF OLD.status = 'draft' THEN
			IF OLD.appointment_id IS NULL THEN
				RAISE EXCEPTION USING
					ERRCODE = '55000',
					MESSAGE = 'Only an open encounter SOAP draft may be discarded.';
			END IF;
			PERFORM 1
			FROM public.appointments AS appointment
			WHERE appointment.id = OLD.appointment_id
				AND appointment.practice_id = OLD.practice_id
				AND appointment.status = 'in_exam'
				AND appointment.deleted_at IS NULL
			FOR UPDATE;
			IF NOT FOUND OR EXISTS (
				SELECT 1
				FROM public.visit_closeouts AS closeout
				WHERE closeout.practice_id = OLD.practice_id
					AND closeout.appointment_id = OLD.appointment_id
					AND closeout.status IN ('clinical_finalized', 'completed')
					AND closeout.deleted_at IS NULL
			) THEN
				RAISE EXCEPTION USING
					ERRCODE = '55000',
					MESSAGE = 'Only a draft from an open, unsigned encounter may be discarded.';
			END IF;
			RETURN OLD;
		END IF;
		RAISE EXCEPTION USING
			ERRCODE = '55000',
			MESSAGE = 'SOAP notes may only be deleted during owner maintenance.';
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.practices AS practice
		CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
			CASE
				WHEN pg_catalog.jsonb_typeof(practice.settings #> '{demoData,soapNoteIds}') = 'array'
					THEN practice.settings #> '{demoData,soapNoteIds}'
				ELSE '[]'::jsonb
			END
		) AS demo_note(id)
		WHERE practice.id = OLD.practice_id
			AND demo_note.id = OLD.id::text
	) INTO is_seeded_demo_note;

	IF is_seeded_demo_note
		AND OLD.deleted_at IS NULL
		AND NEW.deleted_at IS NOT NULL
		AND NEW.id IS NOT DISTINCT FROM OLD.id
		AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
		AND NEW.practice_id IS NOT DISTINCT FROM OLD.practice_id
		AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
		AND NEW.appointment_id IS NOT DISTINCT FROM OLD.appointment_id
		AND NEW.author_id IS NOT DISTINCT FROM OLD.author_id
		AND NEW.author_name IS NOT DISTINCT FROM OLD.author_name
		AND NEW.status IS NOT DISTINCT FROM OLD.status
		AND NEW.revision IS NOT DISTINCT FROM OLD.revision
		AND NEW.finalized_at IS NOT DISTINCT FROM OLD.finalized_at
		AND NEW.finalized_by IS NOT DISTINCT FROM OLD.finalized_by
		AND NEW.finalizer_name IS NOT DISTINCT FROM OLD.finalizer_name
		AND NEW.subjective IS NOT DISTINCT FROM OLD.subjective
		AND NEW.objective IS NOT DISTINCT FROM OLD.objective
		AND NEW.assessment IS NOT DISTINCT FROM OLD.assessment
		AND NEW.plan IS NOT DISTINCT FROM OLD.plan
		AND NEW.imported IS NOT DISTINCT FROM OLD.imported
		AND NEW.import_fingerprint IS NOT DISTINCT FROM OLD.import_fingerprint
	THEN
		RETURN NEW;
	END IF;

	IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
		IF NEW.id IS DISTINCT FROM OLD.id
			OR NEW.created_at IS DISTINCT FROM OLD.created_at
			OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
			OR NEW.practice_id IS DISTINCT FROM OLD.practice_id
			OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
			OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
			OR NEW.author_id IS DISTINCT FROM OLD.author_id
			OR NEW.author_name IS DISTINCT FROM OLD.author_name
			OR NEW.imported IS DISTINCT FROM OLD.imported
			OR NEW.import_fingerprint IS DISTINCT FROM OLD.import_fingerprint
			OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
			OR NEW.finalized_by IS DISTINCT FROM OLD.finalized_by
			OR NEW.finalizer_name IS DISTINCT FROM OLD.finalizer_name
			OR NEW.revision <> OLD.revision + 1
		THEN
			RAISE EXCEPTION USING
				ERRCODE = '40001',
				MESSAGE = 'SOAP draft update must preserve identity and advance exactly one revision.';
		END IF;
		RETURN NEW;
	END IF;

	IF OLD.status = 'draft' AND NEW.status = 'finalized' THEN
		IF OLD.appointment_id IS NOT NULL THEN
			PERFORM 1
			FROM public.appointments AS appointment
			WHERE appointment.id = OLD.appointment_id
				AND appointment.practice_id = OLD.practice_id
			FOR UPDATE;
		END IF;
		IF NEW.id IS DISTINCT FROM OLD.id
			OR NEW.created_at IS DISTINCT FROM OLD.created_at
			OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
			OR NEW.practice_id IS DISTINCT FROM OLD.practice_id
			OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
			OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
			OR NEW.author_id IS DISTINCT FROM OLD.author_id
			OR NEW.author_name IS DISTINCT FROM OLD.author_name
			OR NEW.subjective IS DISTINCT FROM OLD.subjective
			OR NEW.objective IS DISTINCT FROM OLD.objective
			OR NEW.assessment IS DISTINCT FROM OLD.assessment
			OR NEW.plan IS DISTINCT FROM OLD.plan
			OR NEW.imported IS DISTINCT FROM OLD.imported
			OR NEW.import_fingerprint IS DISTINCT FROM OLD.import_fingerprint
			OR NEW.revision IS DISTINCT FROM OLD.revision
			OR NEW.finalized_at IS NULL
			OR NEW.finalized_by IS NULL
			OR NULLIF(btrim(NEW.finalizer_name), '') IS NULL
		THEN
			RAISE EXCEPTION USING
				ERRCODE = '55000',
				MESSAGE = 'SOAP finalization must preserve the saved draft and add attribution.';
		END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Finalized SOAP notes and SOAP identity are immutable.';
END;
$$;


--
-- Name: prevent_clinical_record_correction_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_clinical_record_correction_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Clinical correction events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: prevent_dispense_charge_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_dispense_charge_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
    AND current_user = (
      SELECT pg_catalog.pg_get_userbyid(class.relowner)
      FROM pg_catalog.pg_class class
      JOIN pg_catalog.pg_namespace namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relname = 'dispense_charge_queue'
    )
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'medication dispense charge history cannot be deleted';
END
$$;


--
-- Name: prevent_patient_allergy_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_patient_allergy_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Patient allergy source records are immutable; append a clinical correction instead.';
END;
$$;


--
-- Name: protect_ai_audit_ledger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_ai_audit_ledger() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
    AND current_user = (
      SELECT pg_catalog.pg_get_userbyid(class.relowner)
      FROM pg_catalog.pg_class class
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
    )
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'AI audit ledger rows are immutable. Use the documented owner maintenance procedure for retention or repair.';
END;
$$;


--
-- Name: protect_consent_receipt_capability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_consent_receipt_capability() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := pg_catalog.transaction_timestamp();
    NEW.updated_at := pg_catalog.transaction_timestamp();
    IF NEW.expires_at <= pg_catalog.transaction_timestamp()
       OR NEW.expires_at > pg_catalog.transaction_timestamp() + interval '15 minutes'
       OR NEW.deleted_at IS NOT NULL
       OR NEW.claim_count <> 0
       OR NEW.last_claimed_at IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.consent_requests AS consent
         JOIN public.files AS file
           ON file.id = consent.file_id
          AND file.practice_id = consent.practice_id
         WHERE consent.id = NEW.consent_request_id
           AND consent.practice_id = NEW.practice_id
           AND consent.status = 'signed'
           AND consent.file_id = NEW.file_id
           AND consent.deleted_at IS NULL
           AND file.id = NEW.file_id
           AND file.checksum_sha256 = NEW.file_checksum_sha256
           AND file.file_size_bytes = NEW.file_size_bytes
           AND file.storage_status = 'available'
           AND file.mime_type = 'application/pdf'
           AND file.category = 'consents'
           AND file.source = 'consent_signature'
           AND file.deleted_at IS NULL
       )
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Consent receipt capability requires an exact signed file';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.practice_id IS DISTINCT FROM OLD.practice_id
     OR NEW.consent_request_id IS DISTINCT FROM OLD.consent_request_id
     OR NEW.file_id IS DISTINCT FROM OLD.file_id
     OR NEW.file_checksum_sha256 IS DISTINCT FROM OLD.file_checksum_sha256
     OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
     OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.max_claims IS DISTINCT FROM OLD.max_claims
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Consent receipt capability identity is immutable';
  END IF;
  IF NEW.claim_count <> OLD.claim_count + 1
     OR NEW.claim_count > NEW.max_claims
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Consent receipt claims must advance atomically';
  END IF;
  NEW.last_claimed_at := pg_catalog.clock_timestamp();
  NEW.updated_at := NEW.last_claimed_at;
  RETURN NEW;
END
$$;


--
-- Name: protect_consent_request_evidence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_consent_request_evidence() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE
  changed_steps integer := 0;
  owner_name text;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(class.relowner)
  INTO owner_name
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.consent_requests'::pg_catalog.regclass;

  -- A database owner can already disable triggers. Keep owner-only migrations
  -- and deterministic fixtures possible without creating an application-role
  -- escape hatch. app.rls_bypass is deliberately ignored here.
  IF current_user = owner_name THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending'
       OR NEW.deleted_at IS NOT NULL
       OR NEW.signer_name IS NOT NULL
       OR NEW.signed_at IS NOT NULL
       OR NEW.signature_png_bytes IS NOT NULL
       OR NEW.signature_sha256 IS NOT NULL
       OR NEW.signature_method IS NOT NULL
       OR NEW.signer_attestation_version IS NOT NULL
       OR NEW.document_render_version IS NOT NULL
       OR NEW.file_id IS NOT NULL
       OR NEW.storage_lease_token IS NOT NULL
       OR NEW.storage_lease_expires_at IS NOT NULL
       OR NEW.signed_file_key IS NOT NULL
       OR NEW.signed_file_checksum_sha256 IS NOT NULL
       OR NEW.signed_file_size_bytes IS NOT NULL
       OR NEW.signed_file_object_etag IS NOT NULL
       OR NEW.signed_file_object_version_id IS NOT NULL
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Consent requests must begin pending without signer evidence';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Consent requests cannot be deleted';
  END IF;

  IF ROW(NEW.id, NEW.created_at, NEW.practice_id, NEW.patient_id,
         NEW.created_by, NEW.appointment_id, NEW.form_id, NEW.token,
         NEW.token_hash, NEW.expires_at, NEW.title, NEW.body_text)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.created_at, OLD.practice_id, OLD.patient_id,
         OLD.created_by, OLD.appointment_id, OLD.form_id, OLD.token,
         OLD.token_hash, OLD.expires_at, OLD.title, OLD.body_text)
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Consent request identity and content are immutable';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Consent requests cannot be soft-deleted';
  END IF;

  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Signed consent evidence is terminal';
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'pending' THEN
    IF ROW(NEW.signer_name, NEW.signed_at, NEW.signature_png_bytes,
           NEW.signature_sha256, NEW.signature_method,
           NEW.signer_attestation_version, NEW.document_render_version,
           NEW.file_id, NEW.storage_lease_token,
           NEW.storage_lease_expires_at, NEW.signed_file_key,
           NEW.signed_file_checksum_sha256, NEW.signed_file_size_bytes,
           NEW.signed_file_object_etag, NEW.signed_file_object_version_id)
       IS DISTINCT FROM
       ROW(OLD.signer_name, OLD.signed_at, OLD.signature_png_bytes,
           OLD.signature_sha256, OLD.signature_method,
           OLD.signer_attestation_version, OLD.document_render_version,
           OLD.file_id, OLD.storage_lease_token,
           OLD.storage_lease_expires_at, OLD.signed_file_key,
           OLD.signed_file_checksum_sha256, OLD.signed_file_size_bytes,
           OLD.signed_file_object_etag, OLD.signed_file_object_version_id)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Pending consent evidence cannot be edited';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'signing' THEN
    IF NEW.signer_name IS NULL
       OR pg_catalog.length(pg_catalog.btrim(NEW.signer_name)) NOT BETWEEN 1 AND 120
       OR NEW.signed_at IS NULL
       OR NEW.signature_png_bytes IS NULL
       OR NEW.signature_sha256 IS NULL
       OR NEW.signature_method NOT IN ('drawn', 'typed')
       OR NEW.signer_attestation_version <> 'owner-authority-v1'
       OR NEW.document_render_version <> 'consent-pdf-v2'
       OR NEW.file_id IS NOT NULL
       OR NEW.storage_lease_token IS NOT NULL
       OR NEW.storage_lease_expires_at IS NOT NULL
       OR NEW.signed_file_key IS NOT NULL
       OR NEW.signed_file_checksum_sha256 IS NOT NULL
       OR NEW.signed_file_size_bytes IS NOT NULL
       OR NEW.signed_file_object_etag IS NOT NULL
       OR NEW.signed_file_object_version_id IS NOT NULL
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Signing claim requires complete immutable evidence';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'signing' AND NEW.status = 'signing' THEN
    IF ROW(NEW.signer_name, NEW.signed_at, NEW.signature_png_bytes,
           NEW.signature_sha256, NEW.signature_method)
       IS DISTINCT FROM
       ROW(OLD.signer_name, OLD.signed_at, OLD.signature_png_bytes,
           OLD.signature_sha256, OLD.signature_method)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Signer evidence is immutable after signing begins';
    END IF;
    IF ROW(NEW.signed_file_key, NEW.signed_file_checksum_sha256,
           NEW.signed_file_size_bytes, NEW.signed_file_object_etag,
           NEW.signed_file_object_version_id)
       IS DISTINCT FROM
       ROW(OLD.signed_file_key, OLD.signed_file_checksum_sha256,
           OLD.signed_file_size_bytes, OLD.signed_file_object_etag,
           OLD.signed_file_object_version_id)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Final signed-file evidence is set only at finalization';
    END IF;

    IF NEW.signer_attestation_version IS DISTINCT FROM OLD.signer_attestation_version THEN
      changed_steps := changed_steps + 1;
      IF OLD.signer_attestation_version IS NOT NULL
         OR NEW.signer_attestation_version <> 'owner-authority-v1'
         OR OLD.expires_at <= pg_catalog.clock_timestamp()
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
          MESSAGE = 'Legacy signer authority may be acknowledged only once on a live link';
      END IF;
    END IF;

    IF NEW.document_render_version IS DISTINCT FROM OLD.document_render_version THEN
      changed_steps := changed_steps + 1;
      -- Direct application-role renderer recovery is forbidden. The narrowly
      -- scoped resolver below compares both frozen generations to the durable
      -- reservation and performs the one-time CAS as its owner.
      IF OLD.document_render_version IS NOT NULL
         OR NEW.document_render_version NOT IN ('consent-pdf-v1', 'consent-pdf-v2')
         OR current_user = session_user
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
          MESSAGE = 'Legacy consent renderer requires deterministic recovery';
      END IF;
    END IF;

    IF NEW.file_id IS DISTINCT FROM OLD.file_id THEN
      changed_steps := changed_steps + 1;
      IF OLD.file_id IS NOT NULL OR NEW.file_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.files AS file
        WHERE file.id = NEW.file_id
          AND file.practice_id = OLD.practice_id
          AND file.idempotency_key = OLD.id
          AND file.category = 'consents'
          AND file.source = 'consent_signature'
          AND file.mime_type = 'application/pdf'
          AND file.patient_id = OLD.patient_id
          AND file.storage_status = 'pending_upload'
          AND file.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
          MESSAGE = 'Consent file binding must target its exact reservation';
      END IF;
    END IF;

    IF ROW(NEW.storage_lease_token, NEW.storage_lease_expires_at)
       IS DISTINCT FROM
       ROW(OLD.storage_lease_token, OLD.storage_lease_expires_at)
    THEN
      changed_steps := changed_steps + 1;
      IF NEW.storage_lease_token IS NULL THEN
        IF OLD.storage_lease_token IS NULL
           OR NEW.storage_lease_expires_at IS NOT NULL
           OR current_user = session_user
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Consent render lease release requires its exact fenced function';
        END IF;
      ELSE
        IF NEW.storage_lease_expires_at IS NULL
           OR NEW.storage_lease_expires_at <= pg_catalog.clock_timestamp()
           OR NEW.storage_lease_expires_at > pg_catalog.clock_timestamp() + interval '5 minutes'
           OR (OLD.storage_lease_token IS NOT NULL
               AND OLD.storage_lease_expires_at > pg_catalog.clock_timestamp())
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Consent render lease acquisition requires an absent or stale fence';
        END IF;
      END IF;
    END IF;

    IF changed_steps > 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Consent signing recovery transitions must be isolated';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'signing' AND NEW.status = 'signed' THEN
    IF ROW(NEW.signer_name, NEW.signed_at, NEW.signature_png_bytes,
           NEW.signature_sha256, NEW.signature_method,
           NEW.signer_attestation_version, NEW.document_render_version,
           NEW.file_id)
       IS DISTINCT FROM
       ROW(OLD.signer_name, OLD.signed_at, OLD.signature_png_bytes,
           OLD.signature_sha256, OLD.signature_method,
           OLD.signer_attestation_version, OLD.document_render_version,
           OLD.file_id)
       OR OLD.file_id IS NULL
       OR OLD.storage_lease_token IS NULL
       OR NEW.storage_lease_token IS NOT NULL
       OR NEW.storage_lease_expires_at IS NOT NULL
       OR NEW.signature_method NOT IN ('drawn', 'typed')
       OR NEW.signer_attestation_version <> 'owner-authority-v1'
       OR NEW.document_render_version NOT IN ('consent-pdf-v1', 'consent-pdf-v2')
       OR current_user = session_user
       OR NEW.signed_file_key IS NULL
       OR NEW.signed_file_checksum_sha256 !~ '^[0-9a-f]{64}$'
       OR NEW.signed_file_size_bytes IS NULL
       OR NEW.signed_file_size_bytes <= 0
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Consent finalization requires unchanged signer and exact file evidence';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING ERRCODE = '23514',
    MESSAGE = 'Invalid consent request state transition';
END
$_$;


--
-- Name: protect_consent_signature_file(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_consent_signature_file() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE
  owner_name text;
  linked_status text;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(class.relowner)
  INTO owner_name
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.files'::pg_catalog.regclass;
  IF current_user = owner_name THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.category <> 'consents' OR NEW.source <> 'consent_signature' THEN
      RETURN NEW;
    END IF;
    IF NEW.storage_status <> 'pending_upload'
       OR NEW.mime_type <> 'application/pdf'
       OR NEW.file_size_bytes IS NULL
       OR NEW.file_size_bytes <= 0
       OR NEW.checksum_sha256 !~ '^[0-9a-f]{64}$'
       OR NEW.idempotency_key IS NULL
       OR NEW.patient_id IS NULL
       OR NEW.entity_type <> 'patient'
       OR NEW.entity_id IS DISTINCT FROM NEW.patient_id
       OR NEW.deleted_at IS NOT NULL
       OR NEW.storage_verified_at IS NOT NULL
       OR NEW.object_etag IS NOT NULL
       OR NEW.object_version_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.consent_requests AS consent
         WHERE consent.id = NEW.idempotency_key
           AND consent.practice_id = NEW.practice_id
           AND consent.patient_id = NEW.patient_id
           AND consent.created_by = NEW.uploaded_by
           AND consent.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
           AND consent.status = 'signing'
           AND consent.deleted_at IS NULL
           AND (
             consent.file_id IS NULL
             OR EXISTS (
               -- reserveManagedUpload begins an idempotent retry with an
               -- INSERT .. ON CONFLICT before selecting the durable row. Its
               -- random candidate ID may reach this BEFORE trigger, so admit
               -- it only when the already-bound reservation proves that the
               -- attempted manifest is byte-for-byte and identity-equivalent;
               -- the unique idempotency index then prevents the candidate row.
               SELECT 1
               FROM public.files AS reserved
               WHERE reserved.id = consent.file_id
                 AND reserved.practice_id = consent.practice_id
                 AND reserved.idempotency_key = consent.id
                 AND reserved.uploaded_by = NEW.uploaded_by
                 AND reserved.file_name = NEW.file_name
                 AND reserved.mime_type = NEW.mime_type
                 AND reserved.file_size_bytes = NEW.file_size_bytes
                 AND reserved.checksum_sha256 = NEW.checksum_sha256
                 AND reserved.category = NEW.category
                 AND reserved.source = NEW.source
                 AND reserved.entity_type IS NOT DISTINCT FROM NEW.entity_type
                 AND reserved.entity_id IS NOT DISTINCT FROM NEW.entity_id
                 AND reserved.patient_id IS NOT DISTINCT FROM NEW.patient_id
                 AND reserved.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
                 AND reserved.deleted_at IS NULL
             )
           )
       )
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Consent signature reservation must match an active signing request';
    END IF;
    RETURN NEW;
  END IF;

  IF (OLD.category <> 'consents' OR OLD.source <> 'consent_signature')
     AND (NEW.category = 'consents' AND NEW.source = 'consent_signature')
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Existing files cannot become consent signature evidence';
  END IF;
  IF OLD.category <> 'consents' OR OLD.source <> 'consent_signature' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Consent signature files cannot be deleted';
  END IF;

  SELECT consent.status
  INTO linked_status
  FROM public.consent_requests AS consent
  WHERE consent.practice_id = OLD.practice_id
    AND consent.file_id = OLD.id
  LIMIT 1;

  IF ROW(NEW.id, NEW.created_at, NEW.practice_id, NEW.uploaded_by,
         NEW.file_name, NEW.mime_type, NEW.file_size_bytes,
         NEW.checksum_sha256, NEW.category, NEW.source, NEW.idempotency_key,
         NEW.entity_type, NEW.entity_id, NEW.patient_id, NEW.appointment_id)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.created_at, OLD.practice_id, OLD.uploaded_by,
         OLD.file_name, OLD.mime_type, OLD.file_size_bytes,
         OLD.checksum_sha256, OLD.category, OLD.source, OLD.idempotency_key,
         OLD.entity_type, OLD.entity_id, OLD.patient_id, OLD.appointment_id)
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Consent signature file identity and bytes are immutable';
  END IF;

  -- The normal completion transaction marks the request signed before this
  -- pending manifest becomes available. The deferred constraint below checks
  -- their exact final state at commit.
  IF OLD.storage_status = 'pending_upload' AND NEW.storage_status IN ('available', 'corrupt') THEN
    IF NEW.file_key IS DISTINCT FROM OLD.file_key
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR (NEW.storage_status = 'available' AND NEW.storage_verified_at IS NULL)
       OR (NEW.storage_status = 'corrupt' AND NEW.storage_verified_at IS NOT NULL)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Invalid consent upload finalization';
    END IF;
    RETURN NEW;
  END IF;

  IF linked_status = 'signed' THEN
    IF current_user = session_user THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Signed consent file changes require the recovery transition function';
    END IF;
    IF NEW.file_key IS DISTINCT FROM OLD.file_key
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.storage_status = 'cleanup_pending'
       OR NOT (
         (OLD.storage_status = 'available' AND NEW.storage_status IN ('missing', 'corrupt', 'unverified'))
         OR (OLD.storage_status IN ('missing', 'corrupt', 'unverified') AND NEW.storage_status = 'available')
       )
       OR (NEW.storage_status = 'available' AND NEW.storage_verified_at IS NULL)
       OR (NEW.storage_status <> 'available' AND NEW.storage_verified_at IS NOT NULL)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Invalid signed consent storage recovery transition';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.storage_status = 'corrupt' AND NEW.storage_status = 'pending_upload' THEN
    IF linked_status IS DISTINCT FROM 'signing'
       OR NEW.file_key IS NOT DISTINCT FROM OLD.file_key
       OR NEW.file_url IS NOT DISTINCT FROM OLD.file_url
       OR NEW.storage_verified_at IS NOT NULL
       OR NEW.object_etag IS NOT NULL
       OR NEW.object_version_id IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM public.consent_requests AS consent
         WHERE consent.practice_id = OLD.practice_id
           AND consent.file_id = OLD.id
           AND consent.storage_lease_token IS NOT NULL
           AND consent.storage_lease_expires_at > pg_catalog.clock_timestamp()
       )
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Corrupt consent reservation requires fenced key rotation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.storage_status IN ('missing', 'unverified')
     AND NEW.storage_status = 'pending_upload'
  THEN
    IF linked_status IS DISTINCT FROM 'signing'
       OR NEW.file_key IS DISTINCT FROM OLD.file_key
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.storage_verified_at IS NOT NULL
       OR NEW.object_etag IS NOT NULL
       OR NEW.object_version_id IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM public.consent_requests AS consent
         WHERE consent.practice_id = OLD.practice_id
           AND consent.file_id = OLD.id
           AND consent.storage_lease_token IS NOT NULL
           AND consent.storage_lease_expires_at > pg_catalog.clock_timestamp()
       )
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Legacy consent reservation recovery requires an unfenced signing row';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING ERRCODE = '23514',
    MESSAGE = 'Invalid consent signature file transition';
END
$_$;


--
-- Name: protect_dispense_charge_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_dispense_charge_queue() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  active_line_count integer;
BEGIN
  IF ROW(
    NEW.practice_id,
    NEW.prescription_event_id,
    NEW.prescription_id,
    NEW.patient_id,
    NEW.client_id,
    NEW.appointment_id,
    NEW.product_id,
    NEW.quantity,
    NEW.description_snapshot,
    NEW.unit_price_snapshot,
    NEW.legacy_review,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.practice_id,
    OLD.prescription_event_id,
    OLD.prescription_id,
    OLD.patient_id,
    OLD.client_id,
    OLD.appointment_id,
    OLD.product_id,
    OLD.quantity,
    OLD.description_snapshot,
    OLD.unit_price_snapshot,
    OLD.legacy_review,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'medication dispense charge snapshots are immutable';
  END IF;

  IF NEW.resolved_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = NEW.resolved_by
      AND actor.practice_id = NEW.practice_id
  ) THEN
    RAISE EXCEPTION 'invalid medication dispense charge resolver';
  END IF;

  SELECT count(*) INTO active_line_count
  FROM public.invoice_items item
  JOIN public.invoices invoice ON invoice.id = item.invoice_id
  WHERE item.source_dispense_charge_id = NEW.id
    AND item.deleted_at IS NULL
    AND invoice.deleted_at IS NULL
    AND invoice.status <> 'void'
    AND invoice.is_estimate = false;
  IF NEW.status = 'invoiced' THEN
    IF active_line_count <> 1 OR NOT EXISTS (
      SELECT 1
      FROM public.invoice_items item
      JOIN public.invoices invoice ON invoice.id = item.invoice_id
      WHERE item.id = NEW.invoice_item_id
        AND item.invoice_id = NEW.invoice_id
        AND item.source_dispense_charge_id = NEW.id
        AND item.deleted_at IS NULL
        AND invoice.deleted_at IS NULL
        AND invoice.status <> 'void'
        AND invoice.is_estimate = false
    ) THEN
      RAISE EXCEPTION 'invoiced medication dispense must identify its active invoice line';
    END IF;
  ELSIF active_line_count <> 0 THEN
    RAISE EXCEPTION 'pending or waived medication dispense cannot have an active invoice line';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: protect_visit_treatment_plan_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_identity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan identities cannot be deleted'; END IF;
  IF OLD.status <> 'open' AND NEW.status <> OLD.status THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Completed or cancelled treatment plans cannot be reopened'; END IF;
  IF EXISTS (SELECT 1 FROM public.visit_treatment_plan_revisions WHERE practice_id = OLD.practice_id AND plan_id = OLD.id)
     AND ROW(NEW.practice_id, NEW.client_id, NEW.patient_id, NEW.appointment_id,
             NEW.created_by, NEW.title, NEW.operation_id, NEW.operation_payload_hash)
         IS DISTINCT FROM
         ROW(OLD.practice_id, OLD.client_id, OLD.patient_id, OLD.appointment_id,
             OLD.created_by, OLD.title, OLD.operation_id, OLD.operation_payload_hash)
  THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan identity cannot change after its first revision'; END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_visit_treatment_plan_presentation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_presentation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan presentations cannot be deleted';
  END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('awaiting_signature', 'superseded') THEN
    IF ROW(NEW.practice_id, NEW.plan_id, NEW.revision_id, NEW.response_id,
           NEW.created_by, NEW.token_hash, NEW.expires_at)
       IS DISTINCT FROM
       ROW(OLD.practice_id, OLD.plan_id, OLD.revision_id, OLD.response_id,
           OLD.created_by, OLD.token_hash, OLD.expires_at)
    THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan presentation identity is immutable'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'awaiting_signature' AND NEW.status = 'completed' THEN
    IF ROW(NEW.practice_id, NEW.plan_id, NEW.revision_id, NEW.response_id,
           NEW.created_by, NEW.token_hash, NEW.expires_at, NEW.decisions,
           NEW.response_sha256, NEW.consent_request_id)
       IS DISTINCT FROM
       ROW(OLD.practice_id, OLD.plan_id, OLD.revision_id, OLD.response_id,
           OLD.created_by, OLD.token_hash, OLD.expires_at, OLD.decisions,
           OLD.response_sha256, OLD.consent_request_id)
    THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan presentation evidence is immutable'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid treatment plan presentation transition';
END $$;


--
-- Name: protect_visit_treatment_plan_response(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_response() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Sealed treatment plan responses are immutable';
END $$;


--
-- Name: protect_visit_treatment_plan_response_line(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_response_line() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE old_sealed boolean := false; new_sealed boolean := false;
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM public.visit_treatment_plan_responses response
      WHERE response.practice_id = OLD.practice_id AND response.id = OLD.response_id
        AND response.revision_id = OLD.revision_id) INTO old_sealed;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM public.visit_treatment_plan_responses response
      WHERE response.practice_id = NEW.practice_id AND response.id = NEW.response_id
        AND response.revision_id = NEW.revision_id) INTO new_sealed;
  END IF;
  IF old_sealed OR new_sealed THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Sealed treatment plan response lines are immutable'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: protect_visit_treatment_plan_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_revision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Sealed treatment plan revisions are immutable';
END $$;


--
-- Name: protect_visit_treatment_plan_revision_line(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_visit_treatment_plan_revision_line() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE old_sealed boolean := false; new_sealed boolean := false;
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM public.visit_treatment_plan_revisions revision
      WHERE revision.practice_id = OLD.practice_id AND revision.id = OLD.revision_id
        AND revision.plan_id = OLD.plan_id) INTO old_sealed;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM public.visit_treatment_plan_revisions revision
      WHERE revision.practice_id = NEW.practice_id AND revision.id = NEW.revision_id
        AND revision.plan_id = NEW.plan_id) INTO new_sealed;
  END IF;
  IF old_sealed OR new_sealed THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Sealed treatment plan revision lines are immutable'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: reject_auth_email_delivery_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_auth_email_delivery_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Auth email delivery evidence is immutable.';
END;
$$;


--
-- Name: reject_clinic_pilot_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_clinic_pilot_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
    AND current_user = (
      SELECT pg_catalog.pg_get_userbyid(class.relowner)
      FROM pg_catalog.pg_class class
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
    )
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Clinic pilot events are immutable.';
END;
$$;


--
-- Name: reject_lab_result_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_lab_result_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Lab result events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_lab_result_replacement_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_lab_result_replacement_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Lab result replacement evidence is append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_messaging_registration_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_messaging_registration_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class AS class
			JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Messaging registration events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_patient_merge_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_patient_merge_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public'
				AND class.relname = 'patient_merge_events'
		)
	THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Patient merge events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_prescription_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_prescription_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public'
				AND class.relname = 'prescription_events'
		) THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'Prescription events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_revision_while_treatment_plan_signing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_revision_while_treatment_plan_signing() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.visit_treatment_plan_presentations AS presentation
    LEFT JOIN public.consent_requests AS consent
      ON consent.practice_id = presentation.practice_id
     AND consent.id = presentation.consent_request_id
    WHERE presentation.practice_id = NEW.practice_id
      AND presentation.plan_id = NEW.plan_id
      AND presentation.status = 'awaiting_signature'
      AND (presentation.expires_at > pg_catalog.clock_timestamp()
           OR consent.status IN ('signing', 'signed'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan is awaiting a client signature';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: reject_sms_consent_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_sms_consent_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public'
				AND class.relname = 'sms_consent_events'
		)
	THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'SMS consent events are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_sms_provider_conflict_evidence_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_sms_provider_conflict_evidence_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider conflict evidence is immutable.';
END;
$$;


--
-- Name: reject_sms_provider_event_resolution_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_sms_provider_event_resolution_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'SMS provider event resolution evidence is immutable.';
END;
$$;


--
-- Name: reject_sms_send_ledger_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_sms_send_ledger_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class class
			JOIN pg_catalog.pg_namespace namespace
				ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'SMS send ledger rows are append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_soap_note_replacement_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_soap_note_replacement_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
	IF coalesce(current_setting('app.ledger_maintenance', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class AS class
			JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	RAISE EXCEPTION USING
		ERRCODE = '55000',
		MESSAGE = 'SOAP note replacement evidence is append-only and cannot be updated or deleted.';
END;
$$;


--
-- Name: reject_treatment_plan_close_while_signing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_treatment_plan_close_while_signing() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status <> 'open' AND EXISTS (
    SELECT 1 FROM public.visit_treatment_plan_presentations AS presentation
    LEFT JOIN public.consent_requests AS consent
      ON consent.practice_id = presentation.practice_id
     AND consent.id = presentation.consent_request_id
    WHERE presentation.practice_id = OLD.practice_id
      AND presentation.plan_id = OLD.id
      AND presentation.status = 'awaiting_signature'
      AND (presentation.expires_at > pg_catalog.clock_timestamp()
           OR consent.status IN ('signing', 'signed'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan is awaiting a client signature';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: release_consent_storage_lease(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_consent_storage_lease(p_practice_id uuid, p_consent_request_id uuid, p_file_id uuid, p_expected_lease_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF public.app_current_practice_id() IS DISTINCT FROM p_practice_id
     OR p_expected_lease_token IS NULL
  THEN RETURN false; END IF;
  UPDATE public.consent_requests
  SET storage_lease_token = NULL,
      storage_lease_expires_at = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE id = p_consent_request_id
    AND practice_id = p_practice_id
    AND status = 'signing'
    AND file_id = p_file_id
    AND storage_lease_token = p_expected_lease_token
    AND deleted_at IS NULL;
  RETURN FOUND;
END
$$;


--
-- Name: reopen_dispense_charge_from_line(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reopen_dispense_charge_from_line() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.source_dispense_charge_id IS NOT NULL
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL
  THEN
    UPDATE public.dispense_charge_queue
    SET status = 'pending',
        invoice_id = NULL,
        invoice_item_id = NULL,
        resolved_by = NULL,
        resolved_by_name = NULL,
        resolved_at = NULL,
        resolution_reason = NULL,
        updated_at = now()
    WHERE id = OLD.source_dispense_charge_id
      AND status = 'invoiced'
      AND invoice_id = OLD.invoice_id
      AND invoice_item_id = OLD.id;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: reopen_dispense_charges_from_void_invoice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reopen_dispense_charges_from_void_invoice() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.status <> 'void' AND NEW.status = 'void' THEN
    UPDATE public.dispense_charge_queue
    SET status = 'pending',
        invoice_id = NULL,
        invoice_item_id = NULL,
        resolved_by = NULL,
        resolved_by_name = NULL,
        resolved_at = NULL,
        resolution_reason = NULL,
        updated_at = now()
    WHERE practice_id = NEW.practice_id
      AND invoice_id = NEW.id
      AND status = 'invoiced';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: resolve_consent_document_render_version(uuid, uuid, uuid, text, text, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_consent_document_render_version(p_practice_id uuid, p_consent_request_id uuid, p_original_file_id uuid, p_original_attestation_version text, p_v1_checksum text, p_v1_size integer, p_v2_checksum text, p_v2_size integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  consent_record record;
  owner_name text;
  selected_version text;
  file_checksum text;
  file_size integer;
  v1_matches boolean;
  v2_matches boolean;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(class.relowner)
  INTO owner_name
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.consent_requests'::pg_catalog.regclass;
  IF session_user <> owner_name OR p_original_file_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT consent.*
  INTO consent_record
  FROM public.consent_requests AS consent
  WHERE consent.id = p_consent_request_id
    AND consent.practice_id = p_practice_id
    AND consent.status = 'signing'
    AND consent.document_render_version IS NULL
    AND consent.signer_attestation_version IS NOT DISTINCT FROM p_original_attestation_version
    AND consent.file_id = p_original_file_id
    AND consent.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT file.checksum_sha256, file.file_size_bytes
  INTO file_checksum, file_size
  FROM public.files AS file
  WHERE file.id = p_original_file_id
    AND file.practice_id = p_practice_id
    AND file.idempotency_key = p_consent_request_id
    AND file.category = 'consents'
    AND file.source = 'consent_signature'
    AND file.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND OR file_checksum IS NULL OR file_size IS NULL THEN RETURN NULL; END IF;

  v1_matches := file_checksum = p_v1_checksum AND file_size = p_v1_size;
  v2_matches := file_checksum = p_v2_checksum AND file_size = p_v2_size;
  IF v1_matches = v2_matches THEN RETURN NULL; END IF;
  selected_version := CASE
    WHEN v1_matches THEN 'consent-pdf-v1'
    ELSE 'consent-pdf-v2'
  END;

  UPDATE public.consent_requests
  SET document_render_version = selected_version,
      updated_at = pg_catalog.clock_timestamp()
  WHERE id = p_consent_request_id
    AND practice_id = p_practice_id
    AND status = 'signing'
    AND document_render_version IS NULL
    AND signer_attestation_version IS NOT DISTINCT FROM p_original_attestation_version
    AND file_id = p_original_file_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN selected_version;
END
$$;


--
-- Name: FUNCTION resolve_consent_document_render_version(p_practice_id uuid, p_consent_request_id uuid, p_original_file_id uuid, p_original_attestation_version text, p_v1_checksum text, p_v1_size integer, p_v2_checksum text, p_v2_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.resolve_consent_document_render_version(p_practice_id uuid, p_consent_request_id uuid, p_original_file_id uuid, p_original_attestation_version text, p_v1_checksum text, p_v1_size integer, p_v2_checksum text, p_v2_size integer) IS 'OWNER ONLY: offline repair of a reserved legacy consent after independently rendering frozen v1 and v2 bytes and supplying both unique checksum/size pairs.';


--
-- Name: resolve_unreserved_consent_document_render_version(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_unreserved_consent_document_render_version(p_practice_id uuid, p_consent_request_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  selected_version text;
BEGIN
  IF public.app_current_practice_id() IS DISTINCT FROM p_practice_id THEN
    RETURN NULL;
  END IF;

  UPDATE public.consent_requests AS consent
  SET document_render_version = CASE
        WHEN consent.signer_attestation_version = 'owner-authority-v1'
          THEN 'consent-pdf-v2'
        WHEN consent.signer_attestation_version IS NULL
          THEN 'consent-pdf-v1'
        ELSE NULL
      END,
      updated_at = pg_catalog.clock_timestamp()
  WHERE consent.id = p_consent_request_id
    AND consent.practice_id = p_practice_id
    AND consent.status = 'signing'
    AND consent.document_render_version IS NULL
    AND consent.file_id IS NULL
    AND consent.signed_at > pg_catalog.clock_timestamp() - interval '15 minutes'
    AND consent.expires_at > pg_catalog.clock_timestamp()
    AND consent.deleted_at IS NULL
    AND (
      consent.signer_attestation_version = 'owner-authority-v1'
      OR consent.signer_attestation_version IS NULL
    )
  RETURNING consent.document_render_version INTO selected_version;

  RETURN selected_version;
END
$$;


--
-- Name: restore_signed_consent_evidence(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_signed_consent_evidence(p_practice_id uuid, p_evidence jsonb) RETURNS TABLE(result_id uuid, was_inserted boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
  owner_name text;
  restored_signature_bytes bytea;
  restored_evidence_id uuid;
  restored_patient_id uuid;
  restored_created_by uuid;
  restored_appointment_id uuid;
  restored_form_id uuid;
  restored_file_id uuid;
  restored_created_at timestamptz;
  restored_updated_at timestamptz;
  restored_expires_at timestamptz;
  restored_signed_at timestamptz;
  restored_file_size integer;
  restored_evidence_profile text;
  png_width bigint;
  png_height bigint;
  existing_record public.consent_requests%ROWTYPE;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(class.relowner)
  INTO owner_name
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.consent_requests'::pg_catalog.regclass;
  IF session_user <> owner_name THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Signed consent evidence restore requires the database owner';
  END IF;
  IF pg_catalog.jsonb_typeof(p_evidence) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Signed consent evidence must be a JSON object';
  END IF;
  IF p_evidence ?| ARRAY[
    'token', 'tokenHash', 'storageLeaseToken', 'storageLeaseExpiresAt',
    'deletedAt', 'receiptCapability', 'signedFileObjectEtag',
    'signedFileObjectVersionId'
  ] THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Signed consent backup contains forbidden capability or provider state';
  END IF;

  BEGIN
    restored_evidence_id := (p_evidence->>'id')::uuid;
    restored_patient_id := (p_evidence->>'patientId')::uuid;
    restored_created_by := NULLIF(p_evidence->>'createdBy', '')::uuid;
    restored_appointment_id := NULLIF(p_evidence->>'appointmentId', '')::uuid;
    restored_form_id := NULLIF(p_evidence->>'formId', '')::uuid;
    restored_file_id := (p_evidence->>'fileId')::uuid;
    restored_created_at := (p_evidence->>'createdAt')::timestamptz;
    restored_updated_at := (p_evidence->>'updatedAt')::timestamptz;
    restored_expires_at := (p_evidence->>'expiresAt')::timestamptz;
    restored_signed_at := (p_evidence->>'signedAt')::timestamptz;
    restored_file_size := (p_evidence->>'signedFileSizeBytes')::integer;
    restored_evidence_profile := p_evidence->>'evidenceProfile';
    IF p_evidence->>'signaturePngBase64' IS NOT NULL THEN
      restored_signature_bytes := pg_catalog.decode(
        p_evidence->>'signaturePngBase64',
        'base64'
      );
    ELSE
      restored_signature_bytes := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Signed consent backup has invalid encoded fields';
  END;

  IF p_evidence->>'practiceId' IS DISTINCT FROM p_practice_id::text
     OR p_evidence->>'title' IS NULL
     OR pg_catalog.length(p_evidence->>'title') NOT BETWEEN 1 AND 200
     OR p_evidence->>'bodyText' IS NULL
     OR p_evidence->>'signerName' IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_evidence->>'signerName')) NOT BETWEEN 1 AND 120
     OR p_evidence->>'signedFileKey' IS NULL
     OR p_evidence->>'signedFileKey' NOT LIKE p_practice_id::text || '/%'
     OR p_evidence->>'signedFileChecksumSha256' !~ '^[0-9a-f]{64}$'
     OR restored_file_size <= 0
     OR restored_created_at IS NULL OR restored_updated_at IS NULL
     OR restored_expires_at IS NULL OR restored_signed_at IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Signed consent backup failed terminal evidence validation';
  END IF;

  IF restored_evidence_profile = 'attested-signature-v1' THEN
    IF restored_signature_bytes IS NULL
       OR p_evidence->>'signatureSha256' IS NULL
       OR p_evidence->>'signatureSha256' !~ '^[0-9a-f]{64}$'
       OR p_evidence->>'signatureSha256' <> pg_catalog.encode(pg_catalog.sha256(restored_signature_bytes), 'hex')
       OR p_evidence->>'signatureMethod' IS NULL
       OR p_evidence->>'signatureMethod' NOT IN ('drawn', 'typed')
       OR p_evidence->>'signerAttestationVersion' IS DISTINCT FROM 'owner-authority-v1'
       OR p_evidence->>'documentRenderVersion' IS NULL
       OR p_evidence->>'documentRenderVersion' NOT IN ('consent-pdf-v1', 'consent-pdf-v2')
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Attested signed consent backup has invalid provenance';
    END IF;
  ELSIF restored_evidence_profile = 'legacy-pre-attestation-v1' THEN
    IF p_evidence->'signatureMethod' IS DISTINCT FROM 'null'::jsonb
       OR p_evidence->'signerAttestationVersion' IS DISTINCT FROM 'null'::jsonb
       OR p_evidence->'documentRenderVersion' IS DISTINCT FROM 'null'::jsonb
       OR (
         restored_signature_bytes IS NULL
         AND (
           p_evidence->'signaturePngBase64' IS DISTINCT FROM 'null'::jsonb
           OR p_evidence->'signatureSha256' IS DISTINCT FROM 'null'::jsonb
         )
       )
       OR (
         restored_signature_bytes IS NOT NULL
         AND (
           p_evidence->>'signatureSha256' IS NULL
           OR p_evidence->>'signatureSha256' !~ '^[0-9a-f]{64}$'
           OR p_evidence->>'signatureSha256' <> pg_catalog.encode(pg_catalog.sha256(restored_signature_bytes), 'hex')
         )
       )
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Legacy signed consent backup has invalid evidence provenance';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Signed consent backup evidence profile is unsupported';
  END IF;

  IF restored_signature_bytes IS NOT NULL THEN
    IF pg_catalog.octet_length(restored_signature_bytes) NOT BETWEEN 24 AND 500000
       OR pg_catalog.substring(restored_signature_bytes, 1, 8) <> pg_catalog.decode('89504e470d0a1a0a', 'hex')
       OR pg_catalog.substring(restored_signature_bytes, 13, 4) <> pg_catalog.convert_to('IHDR', 'UTF8')
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Signed consent backup PNG bytes are invalid';
    END IF;

    png_width :=
      pg_catalog.get_byte(restored_signature_bytes, 16) * 16777216::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 17) * 65536::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 18) * 256::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 19);
    png_height :=
      pg_catalog.get_byte(restored_signature_bytes, 20) * 16777216::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 21) * 65536::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 22) * 256::bigint +
      pg_catalog.get_byte(restored_signature_bytes, 23);
    IF png_width NOT BETWEEN 1 AND 2048
       OR png_height NOT BETWEEN 1 AND 2048
       OR png_width * png_height > 2000000
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Signed consent backup PNG dimensions are invalid';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.practices AS practice
    WHERE practice.id = p_practice_id
      AND practice.recovery_hold = true
      AND practice.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.patients AS patient
    WHERE patient.id = restored_patient_id AND patient.practice_id = p_practice_id
  ) OR (restored_created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users AS staff
    WHERE staff.id = restored_created_by AND staff.practice_id = p_practice_id
  )) OR (restored_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments AS appointment
    WHERE appointment.id = restored_appointment_id
      AND appointment.practice_id = p_practice_id
      AND appointment.patient_id = restored_patient_id
  )) OR (restored_form_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.consent_forms AS form
    WHERE form.id = restored_form_id AND form.practice_id = p_practice_id
  )) OR NOT EXISTS (
    SELECT 1 FROM public.files AS file
    WHERE file.id = restored_file_id
      AND file.practice_id = p_practice_id
      AND file.uploaded_by IN (
        SELECT staff.id FROM public.users AS staff
        WHERE staff.practice_id = p_practice_id
      )
      AND file.file_key = p_evidence->>'signedFileKey'
      AND file.checksum_sha256 = p_evidence->>'signedFileChecksumSha256'
      AND file.file_size_bytes = restored_file_size
      AND file.mime_type = 'application/pdf'
      AND file.category = 'consents'
      AND file.source = 'consent_signature'
      AND file.idempotency_key = restored_evidence_id
      AND file.entity_type = 'patient'
      AND file.entity_id = restored_patient_id
      AND file.patient_id = restored_patient_id
      AND file.appointment_id IS NOT DISTINCT FROM restored_appointment_id
      AND file.storage_status IN ('unverified', 'available')
      AND file.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Signed consent backup parents or exact PDF manifest are unavailable';
  END IF;

  SELECT consent.*
  INTO existing_record
  FROM public.consent_requests AS consent
  WHERE consent.id = restored_evidence_id;
  IF FOUND THEN
    IF ROW(existing_record.created_at, existing_record.updated_at,
           existing_record.practice_id, existing_record.patient_id,
           existing_record.created_by, existing_record.appointment_id,
           existing_record.form_id, existing_record.expires_at,
           existing_record.title, existing_record.body_text,
           existing_record.status, existing_record.signer_name,
           existing_record.signed_at, existing_record.signature_png_bytes,
           existing_record.signature_sha256, existing_record.signature_method,
           existing_record.signer_attestation_version,
           existing_record.document_render_version, existing_record.file_id,
           existing_record.signed_file_key,
           existing_record.signed_file_checksum_sha256,
           existing_record.signed_file_size_bytes,
           existing_record.signed_file_object_etag,
           existing_record.signed_file_object_version_id,
           existing_record.token, existing_record.token_hash,
           existing_record.storage_lease_token,
           existing_record.storage_lease_expires_at,
           existing_record.deleted_at)
       IS DISTINCT FROM
       ROW(restored_created_at, restored_updated_at, p_practice_id,
           restored_patient_id, restored_created_by, restored_appointment_id,
           restored_form_id, restored_expires_at, p_evidence->>'title',
           p_evidence->>'bodyText', 'signed', p_evidence->>'signerName',
           restored_signed_at, restored_signature_bytes,
           p_evidence->>'signatureSha256',
           p_evidence->>'signatureMethod',
           p_evidence->>'signerAttestationVersion',
           p_evidence->>'documentRenderVersion', restored_file_id,
           p_evidence->>'signedFileKey',
           p_evidence->>'signedFileChecksumSha256', restored_file_size,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL)
    THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'Signed consent evidence conflicts with an existing record';
    END IF;
    result_id := restored_evidence_id;
    was_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.consent_requests (
    id, created_at, updated_at, practice_id, patient_id, created_by,
    appointment_id, form_id, token, token_hash, expires_at, title, body_text,
    status, signer_name, signed_at, signature_png_bytes, signature_sha256,
    signature_method, signer_attestation_version, document_render_version,
    storage_lease_token, storage_lease_expires_at, file_id, signed_file_key,
    signed_file_checksum_sha256, signed_file_size_bytes,
    signed_file_object_etag, signed_file_object_version_id, deleted_at
  ) VALUES (
    restored_evidence_id, restored_created_at, restored_updated_at,
    p_practice_id, restored_patient_id, restored_created_by,
    restored_appointment_id, restored_form_id, NULL, NULL,
    restored_expires_at, p_evidence->>'title', p_evidence->>'bodyText',
    'signed', p_evidence->>'signerName', restored_signed_at,
    restored_signature_bytes, p_evidence->>'signatureSha256',
    p_evidence->>'signatureMethod', p_evidence->>'signerAttestationVersion',
    p_evidence->>'documentRenderVersion', NULL, NULL, restored_file_id,
    p_evidence->>'signedFileKey', p_evidence->>'signedFileChecksumSha256',
    restored_file_size, NULL, NULL, NULL
  );

  result_id := restored_evidence_id;
  was_inserted := true;
  RETURN NEXT;
END
$_$;


--
-- Name: restore_soap_note_addendum(uuid, timestamp with time zone, uuid, uuid, uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_soap_note_addendum(p_id uuid, p_created_at timestamp with time zone, p_practice_id uuid, p_soap_note_id uuid, p_author_id uuid, p_author_name text, p_content text, p_operation_id uuid, p_operation_payload_hash text) RETURNS TABLE(result_id uuid, was_inserted boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
	restored_id uuid;
	existing_addendum public.soap_note_addenda%ROWTYPE;
	expected_hash text;
	source_finalized_at timestamptz;
	source_deleted_at timestamptz;
	correction_created_at timestamptz;
BEGIN
	IF p_practice_id IS DISTINCT FROM nullif(current_setting('app.current_practice_id', true), '')::uuid THEN
		RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SOAP addendum restore tenant mismatch.';
	END IF;

	SELECT note.finalized_at, note.deleted_at
	INTO source_finalized_at, source_deleted_at
		FROM public.soap_notes AS note
		WHERE note.id = p_soap_note_id
			AND note.practice_id = p_practice_id
			AND note.status = 'finalized';

	SELECT correction.created_at
	INTO correction_created_at
	FROM public.clinical_record_corrections AS correction
	WHERE correction.practice_id = p_practice_id
		AND correction.soap_note_id = p_soap_note_id
	LIMIT 1;

	IF source_finalized_at IS NULL OR NOT EXISTS (
		SELECT 1 FROM public.users AS actor
		WHERE actor.id = p_author_id AND actor.practice_id = p_practice_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '55000',
			MESSAGE = 'SOAP addendum restore source or attribution is invalid.';
	END IF;

	IF p_created_at IS NULL
		OR p_created_at < source_finalized_at
		OR p_created_at > pg_catalog.now()
		OR (source_deleted_at IS NOT NULL AND p_created_at > source_deleted_at)
		OR (correction_created_at IS NOT NULL AND p_created_at > correction_created_at)
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'SOAP addendum restore chronology is invalid.';
	END IF;

	expected_hash := pg_catalog.encode(
		pg_catalog.sha256(
			pg_catalog.convert_to(
				'{"noteId":' || pg_catalog.to_json(p_soap_note_id::text)::text ||
				',"authorId":' || pg_catalog.to_json(p_author_id::text)::text ||
				',"content":' || pg_catalog.to_json(p_content)::text || '}',
				'UTF8'
			)
		),
		'hex'
	);
	IF p_operation_payload_hash IS DISTINCT FROM expected_hash THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'SOAP addendum restore payload hash is invalid.';
	END IF;

	PERFORM pg_catalog.set_config('app.ledger_maintenance', 'on', true);
	INSERT INTO public.soap_note_addenda (
		id, created_at, practice_id, soap_note_id, author_id, author_name,
		content, operation_id, operation_payload_hash
	) VALUES (
		p_id, p_created_at, p_practice_id, p_soap_note_id, p_author_id,
		p_author_name, p_content, p_operation_id, p_operation_payload_hash
	)
	ON CONFLICT (practice_id, operation_id) DO NOTHING
	RETURNING id INTO restored_id;

	IF restored_id IS NOT NULL THEN
		RETURN QUERY SELECT restored_id, true;
		RETURN;
	END IF;
	SELECT * INTO existing_addendum
	FROM public.soap_note_addenda
	WHERE practice_id = p_practice_id AND operation_id = p_operation_id;
	IF existing_addendum.id IS NULL
		OR existing_addendum.id IS DISTINCT FROM p_id
		OR existing_addendum.created_at IS DISTINCT FROM p_created_at
		OR existing_addendum.soap_note_id IS DISTINCT FROM p_soap_note_id
		OR existing_addendum.author_id IS DISTINCT FROM p_author_id
		OR existing_addendum.author_name IS DISTINCT FROM p_author_name
		OR existing_addendum.content IS DISTINCT FROM p_content
		OR existing_addendum.operation_payload_hash IS DISTINCT FROM p_operation_payload_hash
	THEN
		RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'SOAP addendum restore operation conflicts with existing evidence.';
	END IF;
	RETURN QUERY SELECT existing_addendum.id, false;
END;
$$;


--
-- Name: restore_soap_note_replacement(uuid, timestamp with time zone, uuid, uuid, uuid, uuid, uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_soap_note_replacement(p_id uuid, p_created_at timestamp with time zone, p_practice_id uuid, p_correction_id uuid, p_source_soap_note_id uuid, p_replacement_soap_note_id uuid, p_actor_id uuid, p_actor_name text, p_operation_id uuid, p_operation_payload_hash text) RETURNS TABLE(result_id uuid, was_inserted boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
	restored_id uuid;
	existing_replacement public.soap_note_replacements%ROWTYPE;
BEGIN
	IF p_practice_id IS DISTINCT FROM nullif(current_setting('app.current_practice_id', true), '')::uuid THEN
		RAISE EXCEPTION USING
			ERRCODE = '42501',
			MESSAGE = 'SOAP replacement restore tenant mismatch.';
	END IF;

	-- Only this definer-owned call can ask the validation trigger to accept
	-- historically deleted endpoints. The trigger still validates exact evidence,
	-- chronology, payload hash, and graph acyclicity.
	PERFORM pg_catalog.set_config('app.soap_replacement_restore', 'on', true);
	INSERT INTO public.soap_note_replacements (
		id, created_at, practice_id, correction_id, source_soap_note_id,
		replacement_soap_note_id, actor_id, actor_name, operation_id,
		operation_payload_hash
	) VALUES (
		p_id, p_created_at, p_practice_id, p_correction_id,
		p_source_soap_note_id, p_replacement_soap_note_id, p_actor_id,
		p_actor_name, p_operation_id, p_operation_payload_hash
	)
	ON CONFLICT (practice_id, operation_id) DO NOTHING
	RETURNING id INTO restored_id;

	IF restored_id IS NOT NULL THEN
		RETURN QUERY SELECT restored_id, true;
		RETURN;
	END IF;

	SELECT * INTO existing_replacement
	FROM public.soap_note_replacements
	WHERE practice_id = p_practice_id
		AND operation_id = p_operation_id;

	IF existing_replacement.id IS NULL
		OR existing_replacement.id IS DISTINCT FROM p_id
		OR existing_replacement.created_at IS DISTINCT FROM p_created_at
		OR existing_replacement.correction_id IS DISTINCT FROM p_correction_id
		OR existing_replacement.source_soap_note_id IS DISTINCT FROM p_source_soap_note_id
		OR existing_replacement.replacement_soap_note_id IS DISTINCT FROM p_replacement_soap_note_id
		OR existing_replacement.actor_id IS DISTINCT FROM p_actor_id
		OR existing_replacement.actor_name IS DISTINCT FROM p_actor_name
		OR existing_replacement.operation_payload_hash IS DISTINCT FROM p_operation_payload_hash
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '23505',
			MESSAGE = 'SOAP replacement restore operation conflicts with existing evidence.';
	END IF;

	RETURN QUERY SELECT existing_replacement.id, false;
END;
$$;


--
-- Name: transition_signed_consent_file_storage(uuid, uuid, text, text, integer, public.file_storage_status, public.file_storage_status, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_signed_consent_file_storage(p_practice_id uuid, p_file_id uuid, p_expected_file_key text, p_expected_checksum text, p_expected_size integer, p_expected_status public.file_storage_status, p_next_status public.file_storage_status, p_storage_verified_at timestamp with time zone, p_object_etag text, p_object_version_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT public.app_rls_bypass() THEN RETURN false; END IF;
  IF NOT (
    (p_expected_status = 'available' AND p_next_status IN ('missing', 'corrupt', 'unverified'))
    OR (p_expected_status IN ('missing', 'corrupt', 'unverified') AND p_next_status = 'available')
  ) THEN RETURN false; END IF;
  IF (p_next_status = 'available' AND p_storage_verified_at IS NULL)
     OR (p_next_status <> 'available' AND p_storage_verified_at IS NOT NULL)
  THEN RETURN false; END IF;

  UPDATE public.files AS file
  SET storage_status = p_next_status,
      storage_verified_at = p_storage_verified_at,
      object_etag = CASE WHEN p_next_status = 'available' THEN p_object_etag ELSE file.object_etag END,
      object_version_id = CASE WHEN p_next_status = 'available' THEN p_object_version_id ELSE file.object_version_id END,
      updated_at = pg_catalog.clock_timestamp()
  WHERE file.id = p_file_id
    AND file.practice_id = p_practice_id
    AND file.file_key = p_expected_file_key
    AND file.checksum_sha256 = p_expected_checksum
    AND file.file_size_bytes = p_expected_size
    AND file.storage_status = p_expected_status
    AND file.category = 'consents'
    AND file.source = 'consent_signature'
    AND file.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.consent_requests AS consent
      WHERE consent.practice_id = p_practice_id
        AND consent.file_id = p_file_id
        AND consent.status = 'signed'
        AND consent.signed_file_key = p_expected_file_key
        AND consent.signed_file_checksum_sha256 = p_expected_checksum
        AND consent.signed_file_size_bytes = p_expected_size
    );
  RETURN FOUND;
END
$$;


--
-- Name: validate_clinical_record_correction_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_clinical_record_correction_source() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	source_matches boolean := false;
BEGIN
	IF NEW.record_type = 'soap_note' THEN
		SELECT EXISTS (
			SELECT 1 FROM public.soap_notes source
			WHERE source.practice_id = NEW.practice_id
				AND source.id = NEW.soap_note_id
				AND source.patient_id = NEW.patient_id
				AND source.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
				AND source.status = 'finalized'
		) INTO source_matches;
	ELSIF NEW.record_type = 'vital_sign' THEN
		SELECT EXISTS (SELECT 1 FROM public.vital_signs source WHERE source.practice_id = NEW.practice_id AND source.id = NEW.vital_sign_id AND source.patient_id = NEW.patient_id AND source.appointment_id IS NOT DISTINCT FROM NEW.appointment_id) INTO source_matches;
	ELSIF NEW.record_type = 'vaccination_record' THEN
		SELECT EXISTS (SELECT 1 FROM public.vaccination_records source WHERE source.practice_id = NEW.practice_id AND source.id = NEW.vaccination_record_id AND source.patient_id = NEW.patient_id AND source.appointment_id IS NOT DISTINCT FROM NEW.appointment_id) INTO source_matches;
	ELSIF NEW.record_type = 'lab_result' THEN
		SELECT EXISTS (SELECT 1 FROM public.lab_results source WHERE source.practice_id = NEW.practice_id AND source.id = NEW.lab_result_id AND source.patient_id = NEW.patient_id AND source.appointment_id IS NOT DISTINCT FROM NEW.appointment_id) INTO source_matches;
	ELSIF NEW.record_type = 'patient_allergy' THEN
		SELECT EXISTS (
			SELECT 1
			FROM public.patient_allergies source
			JOIN public.patients patient ON patient.id = source.patient_id
			WHERE source.id = NEW.patient_allergy_id
				AND source.patient_id = NEW.patient_id
				AND patient.practice_id = NEW.practice_id
				AND NEW.appointment_id IS NULL
		) INTO source_matches;
	END IF;
	IF NOT source_matches THEN
		RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Clinical correction source does not match its patient and appointment, or is not final.';
	END IF;
	RETURN NEW;
END;
$$;


--
-- Name: validate_dispense_charge_invoice_line(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_dispense_charge_invoice_line() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  source_queue public.dispense_charge_queue%ROWTYPE;
  target_invoice public.invoices%ROWTYPE;
BEGIN
  IF NEW.source_dispense_charge_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO source_queue
  FROM public.dispense_charge_queue
  WHERE id = NEW.source_dispense_charge_id
  FOR UPDATE;
  SELECT * INTO target_invoice
  FROM public.invoices
  WHERE id = NEW.invoice_id;
  IF source_queue.id IS NULL
    OR target_invoice.id IS NULL
    OR source_queue.practice_id <> target_invoice.practice_id
    OR source_queue.client_id <> target_invoice.client_id
    OR source_queue.patient_id IS DISTINCT FROM target_invoice.patient_id
    OR source_queue.appointment_id IS DISTINCT FROM target_invoice.appointment_id
    OR target_invoice.deleted_at IS NOT NULL
    OR target_invoice.is_estimate
    OR target_invoice.status = 'void'
    OR NEW.item_type <> 'product'
    OR NEW.item_id IS DISTINCT FROM source_queue.product_id
    OR NEW.quantity <> source_queue.quantity
    OR NEW.unit_price <> source_queue.unit_price_snapshot
    OR NEW.description <> source_queue.description_snapshot
    OR source_queue.status = 'waived'
    OR (
      source_queue.status = 'invoiced'
      AND (
        source_queue.invoice_id <> NEW.invoice_id
        OR source_queue.invoice_item_id <> NEW.id
      )
    )
  THEN
    RAISE EXCEPTION 'invalid medication dispense invoice line';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: validate_dispense_charge_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_dispense_charge_source() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  source_event public.prescription_events%ROWTYPE;
  source_patient public.patients%ROWTYPE;
  source_appointment public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO source_event
  FROM public.prescription_events
  WHERE id = NEW.prescription_event_id
    AND practice_id = NEW.practice_id;
  IF NOT FOUND
    OR source_event.event_type NOT IN ('created', 'refill_dispensed')
    OR source_event.prescription_id <> NEW.prescription_id
    OR source_event.patient_id <> NEW.patient_id
    OR source_event.product_id IS DISTINCT FROM NEW.product_id
    OR source_event.quantity IS DISTINCT FROM NEW.quantity
  THEN
    RAISE EXCEPTION 'invalid medication dispense charge source';
  END IF;

  SELECT * INTO source_patient
  FROM public.patients
  WHERE id = NEW.patient_id
    AND practice_id = NEW.practice_id;
  IF NOT FOUND OR source_patient.client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'invalid medication dispense charge patient';
  END IF;

  IF NEW.appointment_id IS NOT NULL THEN
    SELECT * INTO source_appointment
    FROM public.appointments
    WHERE id = NEW.appointment_id
      AND practice_id = NEW.practice_id;
    IF NOT FOUND OR source_appointment.patient_id IS DISTINCT FROM NEW.patient_id THEN
      RAISE EXCEPTION 'invalid medication dispense charge appointment';
    END IF;
  END IF;
  IF NEW.resolved_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = NEW.resolved_by
      AND actor.practice_id = NEW.practice_id
  ) THEN
    RAISE EXCEPTION 'invalid medication dispense charge resolver';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: validate_lab_result_event_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_lab_result_event_source() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE source_matches boolean;
BEGIN
	SELECT EXISTS (
		SELECT 1
		FROM public.lab_results source
		WHERE source.practice_id = NEW.practice_id
			AND source.id = NEW.lab_result_id
			AND source.patient_id = NEW.patient_id
			AND source.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
	) INTO source_matches;

	IF NOT source_matches THEN
		RAISE EXCEPTION USING
			ERRCODE = '23503',
			MESSAGE = 'Lab result event source does not match its practice, patient, or appointment.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_lab_result_replacement_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_lab_result_replacement_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	correction_matches boolean := false;
	cycle_exists boolean := false;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended('lab-result-replacement-graph:' || NEW.practice_id::text, 0)
	);
	SELECT EXISTS (
		SELECT 1 FROM public.clinical_record_corrections correction
		WHERE correction.practice_id = NEW.practice_id
			AND correction.id = NEW.correction_id
			AND correction.record_type = 'lab_result'
			AND correction.lab_result_id = NEW.source_lab_result_id
	) INTO correction_matches;
	IF NOT correction_matches THEN
		RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Replacement must identify the exact entered-in-error lab correction for its source.';
	END IF;
	WITH RECURSIVE descendants(id) AS (
		SELECT link.replacement_lab_result_id
		FROM public.lab_result_replacements link
		WHERE link.practice_id = NEW.practice_id AND link.source_lab_result_id = NEW.replacement_lab_result_id
		UNION
		SELECT link.replacement_lab_result_id
		FROM public.lab_result_replacements link
		JOIN descendants prior ON prior.id = link.source_lab_result_id
		WHERE link.practice_id = NEW.practice_id
	)
	SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.source_lab_result_id) INTO cycle_exists;
	IF cycle_exists THEN
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Lab result replacement lineage cannot contain a cycle.';
	END IF;
	RETURN NEW;
END;
$$;


--
-- Name: validate_messaging_registration_event_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_messaging_registration_event_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	registration public.messaging_registrations%ROWTYPE;
	latest_status public.messaging_registration_status;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended(
			'messaging-registration-event:' || NEW.practice_id::text || ':' || NEW.registration_id::text,
			0
		)
	);

	SELECT * INTO registration
	FROM public.messaging_registrations
	WHERE id = NEW.registration_id
		AND practice_id = NEW.practice_id
		AND deleted_at IS NULL
	FOR KEY SHARE;

	IF registration.id IS NULL
		OR NEW.created_at > pg_catalog.now()
		OR NEW.provider IS DISTINCT FROM registration.provider
		OR NEW.status_after IS DISTINCT FROM registration.status
		OR NEW.provider_brand_id IS DISTINCT FROM registration.provider_brand_id
		OR NEW.provider_campaign_id IS DISTINCT FROM registration.provider_campaign_id
		OR NEW.provider_brand_status IS DISTINCT FROM registration.provider_brand_status
		OR NEW.provider_campaign_status IS DISTINCT FROM registration.provider_campaign_status
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Messaging registration event must match the exact active carrier projection.';
	END IF;

	IF NEW.location_id IS NOT NULL AND NOT EXISTS (
		SELECT 1
		FROM public.location_messaging AS sender
		WHERE sender.practice_id = NEW.practice_id
			AND sender.location_id = NEW.location_id
			AND sender.provider = NEW.provider
			AND sender.deleted_at IS NULL
			AND (
				NEW.messaging_profile_id IS NULL
				OR sender.messaging_profile_id = NEW.messaging_profile_id
			)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Messaging registration event location must match the exact active sender projection.';
	END IF;

	SELECT event.status_after INTO latest_status
	FROM public.messaging_registration_events AS event
	WHERE event.practice_id = NEW.practice_id
		AND event.registration_id = NEW.registration_id
	ORDER BY event.created_at DESC, event.id DESC
	LIMIT 1;

	IF FOUND AND NEW.status_before IS DISTINCT FROM latest_status THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Messaging registration event must continue the durable carrier status chain.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_patient_merge_event_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_patient_merge_event_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	source_client_id uuid;
	target_client_id uuid;
BEGIN
	-- Serialize identity corrections within a practice so two concurrent merges
	-- cannot both observe an empty lineage and create a chain or cycle.
	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended(NEW.practice_id::text, 0)
	);

	IF EXISTS (
		SELECT 1
		FROM public.patient_merge_events event
		WHERE event.practice_id = NEW.practice_id
			AND event.target_patient_id = NEW.source_patient_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'A canonical patient with incoming merge history cannot be retired.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.patient_merge_events event
		WHERE event.practice_id = NEW.practice_id
			AND event.source_patient_id = NEW.target_patient_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'A patient already recorded as a merge alias cannot be a merge target.';
	END IF;

	SELECT patient.client_id INTO source_client_id
	FROM public.patients patient
	WHERE patient.practice_id = NEW.practice_id
		AND patient.id = NEW.source_patient_id;

	SELECT patient.client_id INTO target_client_id
	FROM public.patients patient
	WHERE patient.practice_id = NEW.practice_id
		AND patient.id = NEW.target_patient_id;

	IF source_client_id IS DISTINCT FROM NEW.client_id
		OR target_client_id IS DISTINCT FROM NEW.client_id
	THEN
		RAISE EXCEPTION USING
			ERRCODE = '23503',
			MESSAGE = 'Patient merge source and target must belong to the recorded client.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_payment_processor_refund_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_payment_processor_refund_tenant() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  original_practice_id uuid;
  refund_practice_id uuid;
BEGIN
  SELECT invoice.practice_id
    INTO original_practice_id
    FROM public.payments payment
    JOIN public.invoices invoice ON invoice.id = payment.invoice_id
   WHERE payment.id = NEW.original_payment_id;

  IF original_practice_id IS DISTINCT FROM NEW.practice_id THEN
    RAISE EXCEPTION 'original payment does not belong to refund practice'
      USING ERRCODE = '23514';
  END IF;

  SELECT invoice.practice_id
    INTO refund_practice_id
    FROM public.payments payment
    JOIN public.invoices invoice ON invoice.id = payment.invoice_id
   WHERE payment.id = NEW.refund_payment_id;

  IF refund_practice_id IS DISTINCT FROM NEW.practice_id THEN
    RAISE EXCEPTION 'refund payment does not belong to refund practice'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: validate_prescription_event_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_prescription_event_source() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	source_matches boolean := false;
BEGIN
	SELECT EXISTS (
		SELECT 1
		FROM public.prescriptions source
		WHERE source.practice_id = NEW.practice_id
			AND source.id = NEW.prescription_id
			AND source.patient_id = NEW.patient_id
			AND source.product_id IS NOT DISTINCT FROM NEW.product_id
			AND source.quantity IS NOT DISTINCT FROM NEW.quantity
	) INTO source_matches;

	IF NOT source_matches THEN
		RAISE EXCEPTION USING
			ERRCODE = '23503',
			MESSAGE = 'Prescription event source does not match its practice, patient, product, or quantity.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_signed_consent_file_binding(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_signed_consent_file_binding() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  consent_record record;
  owner_name text;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(class.relowner)
  INTO owner_name
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.consent_requests'::pg_catalog.regclass;

  IF TG_TABLE_NAME = 'consent_requests' THEN
    IF NEW.status <> 'signed' THEN RETURN NULL; END IF;
    consent_record := NEW;
  ELSE
    IF TG_OP = 'UPDATE' AND NEW.storage_status <> 'available' THEN
      RETURN NULL;
    END IF;
    SELECT consent.*
    INTO consent_record
    FROM public.consent_requests AS consent
    WHERE consent.practice_id = COALESCE(NEW.practice_id, OLD.practice_id)
      AND consent.file_id = COALESCE(NEW.id, OLD.id)
      AND consent.status = 'signed'
    LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.files AS file
    WHERE file.id = consent_record.file_id
      AND file.practice_id = consent_record.practice_id
      AND file.idempotency_key = consent_record.id
      AND file.category = 'consents'
      AND file.source = 'consent_signature'
      AND file.mime_type = 'application/pdf'
      AND file.patient_id = consent_record.patient_id
      AND file.appointment_id IS NOT DISTINCT FROM consent_record.appointment_id
      AND file.deleted_at IS NULL
      AND file.file_key = consent_record.signed_file_key
      AND file.checksum_sha256 = consent_record.signed_file_checksum_sha256
      AND file.file_size_bytes = consent_record.signed_file_size_bytes
      AND (
        file.storage_status = 'available'
        OR (
          file.storage_status = 'unverified'
          AND session_user = owner_name
          AND EXISTS (
            SELECT 1
            FROM public.practices AS practice
            WHERE practice.id = consent_record.practice_id
              AND practice.recovery_hold = true
              AND practice.deleted_at IS NULL
          )
        )
      )
      AND (
        TG_TABLE_NAME <> 'consent_requests'
        OR (
          file.object_etag IS NOT DISTINCT FROM consent_record.signed_file_object_etag
          AND file.object_version_id IS NOT DISTINCT FROM consent_record.signed_file_object_version_id
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Signed consent must reference its exact recoverable PDF generation';
  END IF;
  RETURN NULL;
END
$$;


--
-- Name: validate_sms_provider_event_resolution_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_sms_provider_event_resolution_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
	provider_event public.sms_provider_events%ROWTYPE;
	provider_conflict public.sms_provider_event_conflicts%ROWTYPE;
	communication_evidence public.communications%ROWTYPE;
	consent_evidence public.sms_consent_events%ROWTYPE;
	delivery_evidence public.sms_delivery_events%ROWTYPE;
	registration_evidence public.messaging_registration_events%ROWTYPE;
	accepted_send_practice_id uuid;
	accepted_send_practice_count integer;
BEGIN
	SELECT * INTO provider_event
	FROM public.sms_provider_events
	WHERE id = NEW.event_id;
	IF NOT FOUND THEN
		RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'SMS provider resolution event does not exist.';
	END IF;
	IF NEW.resolution = 'provider_attested_no_projection'
		AND NEW.practice_id IS NULL
		AND provider_event.kind = 'delivery'
		AND provider_event.practice_id IS NULL
	THEN
		-- Send transactions lock their practice row FOR SHARE before calling the
		-- provider and retain it through accepted-result persistence. Take every
		-- active practice with a current sender or historical attempt for this
		-- provider FOR UPDATE, matching the service lock set and deterministic
		-- ordering. This drains those calls before proving that this delivery
		-- identity has no accepted-send owner. Practice-before-event ordering also
		-- avoids inversion with attributed provider-event ingest.
		PERFORM practice.id
		FROM public.practices practice
		WHERE practice.deleted_at IS NULL
			AND (
				EXISTS (
					SELECT 1
					FROM public.location_messaging sender
					WHERE sender.practice_id = practice.id
						AND sender.provider = provider_event.provider
						AND sender.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM public.sms_send_attempts attempt
					WHERE attempt.practice_id = practice.id
						AND attempt.provider = provider_event.provider
				)
			)
		ORDER BY practice.id
		FOR UPDATE;
	END IF;
	SELECT * INTO provider_event
	FROM public.sms_provider_events
	WHERE id = NEW.event_id
	FOR SHARE;
	IF NOT FOUND THEN
		RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'SMS provider resolution event disappeared during serialization.';
	END IF;
	IF provider_event.state NOT IN ('projected', 'ignored', 'quarantined') THEN
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Only terminal SMS provider events can be resolved.';
	END IF;
	IF provider_event.practice_id IS NOT NULL
		AND provider_event.practice_id IS DISTINCT FROM NEW.practice_id
	THEN
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SMS provider resolution practice does not match its event.';
	END IF;

	IF NEW.conflict_id IS NULL THEN
		IF provider_event.state <> 'quarantined' THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A base resolution requires a quarantined event.';
		END IF;
		IF provider_event.last_error_code = 'provider_identity_conflict' THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A conflict-caused quarantine requires conflict-scoped resolution evidence.';
		END IF;
	ELSE
		SELECT * INTO provider_conflict
		FROM public.sms_provider_event_conflicts
		WHERE id = NEW.conflict_id
		FOR SHARE;
		IF NOT FOUND OR provider_conflict.original_event_id IS DISTINCT FROM NEW.event_id THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SMS provider conflict does not belong to its resolution event.';
		END IF;
	END IF;

	IF provider_event.kind = 'inbound' THEN
		IF NEW.conflict_id IS NOT NULL AND NEW.resolution <> 'conservative_opt_out' THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Conflicting inbound evidence can only be resolved by conservative opt-out.';
		END IF;
		IF NEW.resolution NOT IN ('authoritative_projection', 'conservative_opt_out') THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Inbound SMS resolution kind is invalid.';
		END IF;
	ELSIF provider_event.kind = 'delivery' THEN
		IF NEW.resolution NOT IN ('authoritative_projection', 'provider_attested_no_projection') THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Delivery SMS resolution kind is invalid.';
		END IF;
	ELSIF provider_event.kind = 'a2p' THEN
		IF NEW.resolution <> 'carrier_state_reconciled' THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A2P resolution requires carrier reconciliation evidence.';
		END IF;
	ELSE
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SMS provider resolution event kind is invalid.';
	END IF;
	IF (NEW.resolution = 'authoritative_projection' AND (
		(provider_event.kind = 'inbound' AND NEW.reason_code <> 'projection_repaired')
		OR (provider_event.kind = 'delivery' AND NEW.reason_code <> 'delivery_reconciled')
	))
		OR (NEW.resolution = 'conservative_opt_out' AND (
			(NEW.conflict_id IS NULL AND NEW.reason_code <> 'sender_identity_drift_opt_out')
			OR (NEW.conflict_id IS NOT NULL AND NEW.reason_code <> 'provider_identity_conflict_opt_out')
		))
	THEN
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SMS provider resolution reason does not match its incident.';
	END IF;

	IF NEW.resolution = 'authoritative_projection' AND provider_event.kind = 'inbound' THEN
		IF NEW.inbound_communication_id IS NULL
			OR NEW.sms_delivery_event_id IS NOT NULL
			OR NEW.messaging_registration_event_id IS NOT NULL
			OR NEW.external_evidence_reference IS NOT NULL
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Inbound projection evidence shape is invalid.';
		END IF;

		SELECT * INTO communication_evidence
		FROM public.communications
		WHERE id = NEW.inbound_communication_id
		FOR SHARE;
		IF NOT FOUND
			OR communication_evidence.practice_id IS DISTINCT FROM NEW.practice_id
			OR communication_evidence.deleted_at IS NOT NULL
			OR communication_evidence.channel <> 'sms'
			OR communication_evidence.direction <> 'inbound'
			OR communication_evidence.status <> 'delivered'
			OR communication_evidence.provider_message_id IS DISTINCT FROM provider_event.provider_message_id
			OR btrim(communication_evidence.content) IS DISTINCT FROM btrim(provider_event.message_body)
			OR communication_evidence.created_at IS DISTINCT FROM coalesce(provider_event.occurred_at, provider_event.received_at)
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Inbound communication does not prove exact provider-event projection.';
		END IF;

		IF provider_event.inbound_classification IN ('stop', 'start') THEN
			IF NEW.sms_consent_event_id IS NULL THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'STOP and START projection require consent evidence.';
			END IF;
			SELECT * INTO consent_evidence
			FROM public.sms_consent_events
			WHERE id = NEW.sms_consent_event_id
			FOR SHARE;
			IF NOT FOUND
				OR consent_evidence.practice_id IS DISTINCT FROM NEW.practice_id
				OR consent_evidence.destination_e164 IS DISTINCT FROM provider_event.from_e164
				OR consent_evidence.provider IS DISTINCT FROM provider_event.provider
				OR consent_evidence.provider_message_id IS DISTINCT FROM provider_event.provider_message_id
				OR consent_evidence.actor_type <> 'client'
				OR consent_evidence.occurred_at IS DISTINCT FROM coalesce(provider_event.occurred_at, provider_event.received_at)
				OR (provider_event.location_id IS NOT NULL AND consent_evidence.location_id IS DISTINCT FROM provider_event.location_id)
				OR (provider_event.inbound_classification = 'stop' AND consent_evidence.action <> 'revoked')
				OR (provider_event.inbound_classification = 'start' AND consent_evidence.action <> 'granted')
			THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Consent evidence does not prove exact provider-event projection.';
			END IF;
			IF provider_event.inbound_classification = 'stop'
				AND NOT EXISTS (
					SELECT 1
					FROM public.sms_suppressions suppression
					WHERE suppression.practice_id = NEW.practice_id
						AND suppression.phone = provider_event.from_e164
						AND suppression.deleted_at IS NULL
				)
				AND NOT EXISTS (
					SELECT 1
					FROM public.sms_consent_events newer_consent
					WHERE newer_consent.practice_id = NEW.practice_id
						AND newer_consent.destination_e164 = provider_event.from_e164
						AND newer_consent.action = 'granted'
						AND newer_consent.occurred_at > coalesce(provider_event.occurred_at, provider_event.received_at)
				)
			THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'STOP resolution requires an active suppression or a strictly newer durable grant.';
			END IF;
		ELSIF provider_event.inbound_classification IN ('help', 'other') THEN
			IF NEW.sms_consent_event_id IS NOT NULL THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'HELP and other inbound projection use communication evidence only.';
			END IF;
		ELSE
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Inbound classification is invalid.';
		END IF;

	ELSIF NEW.resolution = 'conservative_opt_out' THEN
		IF provider_event.kind <> 'inbound'
			OR NEW.inbound_communication_id IS NOT NULL
			OR NEW.sms_consent_event_id IS NULL
			OR NEW.sms_delivery_event_id IS NOT NULL
			OR NEW.messaging_registration_event_id IS NOT NULL
			OR NEW.external_evidence_reference IS NOT NULL
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Conservative opt-out evidence shape is invalid.';
		END IF;
		IF NEW.conflict_id IS NULL AND (
			provider_event.last_error_code IS NULL
			OR provider_event.last_error_code NOT IN ('sender_identity_drift', 'immutable_attribution_drift')
			OR provider_event.practice_id IS NULL
			OR provider_event.location_id IS NULL
			OR provider_event.from_e164 IS NULL
		) THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Base conservative opt-out requires immutable, fully attributed sender-drift evidence.';
		END IF;
		SELECT * INTO consent_evidence
		FROM public.sms_consent_events
		WHERE id = NEW.sms_consent_event_id
		FOR SHARE;
		IF NOT FOUND
			OR consent_evidence.practice_id IS DISTINCT FROM NEW.practice_id
			OR consent_evidence.destination_e164 IS DISTINCT FROM provider_event.from_e164
			OR consent_evidence.action <> 'revoked'
			OR consent_evidence.actor_type <> 'system'
			OR consent_evidence.provider IS NOT NULL
			OR consent_evidence.provider_message_id IS NOT NULL
			OR consent_evidence.source <> 'provider_event_resolution:v1'
			OR consent_evidence.event_key IS DISTINCT FROM format(
				'provider_event_resolution:%s:%s:revoked',
				NEW.operation_id,
				coalesce(NEW.conflict_id, NEW.event_id)
			)
			OR (provider_event.location_id IS NOT NULL AND consent_evidence.location_id IS DISTINCT FROM provider_event.location_id)
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Conservative opt-out requires matching revoked consent evidence.';
		END IF;
		IF NOT EXISTS (
			SELECT 1
			FROM public.sms_suppressions suppression
			WHERE suppression.practice_id = NEW.practice_id
				AND suppression.phone = consent_evidence.destination_e164
				AND suppression.deleted_at IS NULL
		) THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Conservative opt-out requires an active durable SMS suppression.';
		END IF;

	ELSIF NEW.resolution = 'authoritative_projection' AND provider_event.kind = 'delivery' THEN
		IF NEW.inbound_communication_id IS NOT NULL
			OR NEW.sms_consent_event_id IS NOT NULL
			OR NEW.sms_delivery_event_id IS NULL
			OR NEW.messaging_registration_event_id IS NOT NULL
			OR NEW.external_evidence_reference IS NOT NULL
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Delivery projection evidence shape is invalid.';
		END IF;
		SELECT * INTO delivery_evidence
		FROM public.sms_delivery_events
		WHERE id = NEW.sms_delivery_event_id
		FOR SHARE;
		IF NOT FOUND
			OR delivery_evidence.provider IS DISTINCT FROM provider_event.provider
			OR delivery_evidence.provider_event_type IS DISTINCT FROM coalesce(provider_conflict.incoming_provider_event_type, provider_event.provider_event_type)
			OR delivery_evidence.provider_message_id IS DISTINCT FROM coalesce(provider_conflict.incoming_provider_message_id, provider_event.provider_message_id)
			OR (coalesce(provider_conflict.incoming_provider_event_id, provider_event.provider_event_id) IS NOT NULL
				AND delivery_evidence.provider_event_id IS DISTINCT FROM coalesce(provider_conflict.incoming_provider_event_id, provider_event.provider_event_id))
			OR (NEW.conflict_id IS NULL AND (
				delivery_evidence.classification IS DISTINCT FROM provider_event.delivery_classification
				OR delivery_evidence.provider_status IS DISTINCT FROM provider_event.provider_status
				OR delivery_evidence.provider_error_code IS DISTINCT FROM provider_event.provider_error_code
			))
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Delivery evidence does not match the provider incident.';
		END IF;
		IF NOT EXISTS (
			SELECT 1
			FROM public.sms_delivery_event_history history
			WHERE history.delivery_event_id = NEW.sms_delivery_event_id
				AND history.practice_id = NEW.practice_id
				AND history.result IN ('projected', 'reconciled')
		) THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Delivery resolution requires durable projected or reconciled history.';
		END IF;

	ELSIF NEW.resolution = 'carrier_state_reconciled' THEN
		IF provider_event.kind <> 'a2p'
			OR NEW.inbound_communication_id IS NOT NULL
			OR NEW.sms_consent_event_id IS NOT NULL
			OR NEW.sms_delivery_event_id IS NOT NULL
			OR NEW.messaging_registration_event_id IS NULL
			OR NEW.external_evidence_reference IS NOT NULL
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Carrier reconciliation evidence shape is invalid.';
		END IF;
		SELECT * INTO registration_evidence
		FROM public.messaging_registration_events
		WHERE id = NEW.messaging_registration_event_id
		FOR SHARE;
		IF NOT FOUND
			OR registration_evidence.practice_id IS DISTINCT FROM NEW.practice_id
			OR registration_evidence.provider IS DISTINCT FROM provider_event.provider
			OR registration_evidence.event_type <> 'provider_state_observed'
			OR registration_evidence.operation <> 'registration_reconciliation'
			OR registration_evidence.status_after NOT IN ('pending', 'active', 'action_required', 'failed', 'suspended')
			OR registration_evidence.operation_id IS DISTINCT FROM NEW.operation_id
			OR registration_evidence.reason_code <> 'carrier_registration_reconciled'
			OR (provider_event.a2p_brand_id IS NOT NULL AND registration_evidence.provider_brand_id IS DISTINCT FROM provider_event.a2p_brand_id)
			OR (provider_event.a2p_campaign_id IS NOT NULL AND registration_evidence.provider_campaign_id IS DISTINCT FROM provider_event.a2p_campaign_id)
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Carrier evidence does not prove the exact provider incident reconciliation.';
		END IF;
		IF provider_event.a2p_phone_e164 IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM public.location_messaging sender
			WHERE sender.practice_id = NEW.practice_id
				AND sender.location_id = registration_evidence.location_id
				AND sender.provider = provider_event.provider
				AND sender.sender_e164 = provider_event.a2p_phone_e164
				AND sender.deleted_at IS NULL
				AND sender.enabled = false
				AND sender.provider_profile_ready = false
				AND (
					SELECT count(*)
					FROM public.location_messaging exact_sender
					WHERE exact_sender.practice_id = NEW.practice_id
						AND exact_sender.provider = provider_event.provider
						AND exact_sender.sender_e164 = provider_event.a2p_phone_e164
						AND exact_sender.deleted_at IS NULL
				) = 1
		) THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Carrier phone evidence requires one exact disabled, unready sender identity.';
		END IF;

	ELSIF NEW.resolution = 'provider_attested_no_projection' THEN
		IF provider_event.kind <> 'delivery'
			OR NEW.inbound_communication_id IS NOT NULL
			OR NEW.sms_consent_event_id IS NOT NULL
			OR NEW.sms_delivery_event_id IS NOT NULL
			OR NEW.messaging_registration_event_id IS NOT NULL
			OR NEW.external_evidence_reference IS NULL
		THEN
			RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Provider-attested no-projection evidence shape is invalid.';
		END IF;
		IF provider_event.practice_id IS NULL THEN
			SELECT count(DISTINCT attempt.practice_id), min(attempt.practice_id::text)::uuid
			INTO accepted_send_practice_count, accepted_send_practice_id
			FROM public.sms_send_attempt_events attempt_event
			JOIN public.sms_send_attempts attempt
				ON attempt.practice_id = attempt_event.practice_id
				AND attempt.id = attempt_event.attempt_id
			WHERE attempt_event.outcome = 'accepted'
				AND attempt_event.provider_message_id = coalesce(
					provider_conflict.incoming_provider_message_id,
					provider_event.provider_message_id
				)
				AND attempt.provider = provider_event.provider;
			IF accepted_send_practice_count = 1
				AND NEW.practice_id IS DISTINCT FROM accepted_send_practice_id
			THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Provider-attested resolution practice must match the exact accepted send.';
			END IF;
			IF accepted_send_practice_count <> 1 AND NEW.practice_id IS NOT NULL THEN
				RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Unattributed provider-attested resolution cannot claim an arbitrary practice.';
			END IF;
		END IF;
	ELSE
		RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SMS provider resolution evidence is invalid.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_soap_note_replacement_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_soap_note_replacement_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
	lineage_matches boolean := false;
	cycle_exists boolean := false;
	historical_restore boolean := false;
	expected_payload_hash text;
BEGIN
	historical_restore :=
		coalesce(current_setting('app.soap_replacement_restore', true), '') = 'on'
		AND current_user = (
			SELECT pg_catalog.pg_get_userbyid(class.relowner)
			FROM pg_catalog.pg_class AS class
			JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = TG_TABLE_SCHEMA
				AND class.relname = TG_TABLE_NAME
		);

	-- Serialize graph mutations per tenant so concurrent inserts cannot create a
	-- cycle that neither transaction can observe.
	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended('soap-note-replacement-graph:' || NEW.practice_id::text, 0)
	);

	SELECT pg_catalog.encode(
		pg_catalog.sha256(
			pg_catalog.convert_to(
				'{"patientId":' || pg_catalog.to_json(source.patient_id::text)::text ||
				',"sourceNoteId":' || pg_catalog.to_json(NEW.source_soap_note_id::text)::text ||
				',"actorId":' || pg_catalog.to_json(NEW.actor_id::text)::text ||
				',"reason":' || pg_catalog.to_json(correction.reason)::text ||
				',"subjective":' || coalesce(pg_catalog.to_json(replacement.subjective)::text, 'null') ||
				',"objective":' || coalesce(pg_catalog.to_json(replacement.objective)::text, 'null') ||
				',"assessment":' || coalesce(pg_catalog.to_json(replacement.assessment)::text, 'null') ||
				',"plan":' || coalesce(pg_catalog.to_json(replacement.plan)::text, 'null') || '}',
				'UTF8'
			)
		),
		'hex'
	)
	INTO expected_payload_hash
	FROM public.clinical_record_corrections AS correction
	JOIN public.soap_notes AS source
		ON source.practice_id = correction.practice_id
		AND source.id = correction.soap_note_id
	JOIN public.soap_notes AS replacement
		ON replacement.practice_id = source.practice_id
		AND replacement.id = NEW.replacement_soap_note_id
	WHERE correction.practice_id = NEW.practice_id
		AND correction.id = NEW.correction_id
		AND correction.soap_note_id = NEW.source_soap_note_id;

	IF NEW.operation_payload_hash IS DISTINCT FROM expected_payload_hash THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'SOAP replacement payload hash is invalid.';
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.clinical_record_corrections AS correction
		JOIN public.soap_notes AS source
			ON source.practice_id = correction.practice_id
			AND source.id = correction.soap_note_id
		JOIN public.soap_notes AS replacement
			ON replacement.practice_id = source.practice_id
			AND replacement.id = NEW.replacement_soap_note_id
		WHERE correction.practice_id = NEW.practice_id
			AND correction.id = NEW.correction_id
			AND correction.record_type = 'soap_note'
			AND correction.action = 'entered_in_error'
			AND correction.soap_note_id = NEW.source_soap_note_id
			AND source.status = 'finalized'
			AND replacement.status = 'finalized'
			AND (
				(source.deleted_at IS NULL AND replacement.deleted_at IS NULL)
				OR (
					historical_restore
					AND (source.deleted_at IS NULL OR NEW.created_at <= source.deleted_at)
					AND (replacement.deleted_at IS NULL OR NEW.created_at <= replacement.deleted_at)
				)
			)
			AND replacement.patient_id = source.patient_id
			AND replacement.appointment_id IS NOT DISTINCT FROM source.appointment_id
			AND replacement.finalized_by = NEW.actor_id
			AND replacement.finalizer_name = NEW.actor_name
			AND source.finalized_at <= correction.created_at
			AND correction.created_at <= replacement.finalized_at
			AND replacement.finalized_at <= NEW.created_at
			AND NEW.created_at <= pg_catalog.now()
			-- A replacement may itself be corrected later and become the source of
			-- another link. Historical restore therefore permits that correction
			-- only when its evidence is not earlier than this link.
			AND NOT EXISTS (
				SELECT 1
				FROM public.clinical_record_corrections AS replacement_correction
				WHERE replacement_correction.practice_id = NEW.practice_id
					AND replacement_correction.soap_note_id = NEW.replacement_soap_note_id
					AND replacement_correction.created_at < NEW.created_at
			)
	) INTO lineage_matches;

	IF NOT lineage_matches THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'SOAP replacement must preserve the exact correction, encounter, patient, finalizer, and chronology.';
	END IF;

	WITH RECURSIVE descendants(id) AS (
		SELECT link.replacement_soap_note_id
		FROM public.soap_note_replacements AS link
		WHERE link.practice_id = NEW.practice_id
			AND link.source_soap_note_id = NEW.replacement_soap_note_id
		UNION
		SELECT link.replacement_soap_note_id
		FROM public.soap_note_replacements AS link
		JOIN descendants AS prior ON prior.id = link.source_soap_note_id
		WHERE link.practice_id = NEW.practice_id
	)
	SELECT EXISTS (
		SELECT 1 FROM descendants WHERE id = NEW.source_soap_note_id
	) INTO cycle_exists;

	IF cycle_exists THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'SOAP note replacement lineage cannot contain a cycle.';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: validate_visit_treatment_plan_response_seal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_visit_treatment_plan_response_seal() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  revision_row record;
  offered_count integer;
  decision_count integer;
  invalid_quantity_count integer;
  evidence_matches boolean;
  expected_hash text;
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN NEW; END IF;
  SELECT revision.content_sha256, plan.patient_id, plan.appointment_id
    INTO revision_row
    FROM public.visit_treatment_plan_revisions revision
    JOIN public.visit_treatment_plans plan
      ON plan.practice_id = revision.practice_id AND plan.id = revision.plan_id
    WHERE revision.practice_id = NEW.practice_id
      AND revision.plan_id = NEW.plan_id AND revision.id = NEW.revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Treatment plan revision is missing or outside the active practice'; END IF;
  SELECT count(*)::integer INTO offered_count
    FROM public.visit_treatment_plan_revision_lines
    WHERE practice_id = NEW.practice_id AND revision_id = NEW.revision_id;
  SELECT count(*)::integer,
         count(*) FILTER (WHERE decision.accepted_quantity > offered.offered_quantity)::integer
    INTO decision_count, invalid_quantity_count
    FROM public.visit_treatment_plan_response_lines decision
    JOIN public.visit_treatment_plan_revision_lines offered
      ON offered.practice_id = decision.practice_id
     AND offered.id = decision.revision_line_id
     AND offered.revision_id = decision.revision_id
    WHERE decision.practice_id = NEW.practice_id
      AND decision.revision_id = NEW.revision_id AND decision.response_id = NEW.id;
  IF offered_count = 0 OR decision_count <> offered_count THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan response must decide every offered line exactly once'; END IF;
  IF invalid_quantity_count > 0 THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan response cannot accept more than the offered quantity'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.consent_requests request_row
    JOIN public.files signed_file
      ON signed_file.practice_id = request_row.practice_id AND signed_file.id = request_row.file_id
    WHERE request_row.practice_id = NEW.practice_id AND request_row.id = NEW.consent_request_id
      AND request_row.patient_id = revision_row.patient_id
      AND (revision_row.appointment_id IS NULL OR request_row.appointment_id = revision_row.appointment_id)
      AND request_row.status = 'signed' AND request_row.signer_name = NEW.signer_name
      AND request_row.signed_at = NEW.decided_at AND request_row.file_id = NEW.signed_file_id
      AND request_row.signature_sha256 = NEW.signature_sha256
      AND signed_file.checksum_sha256 = NEW.signed_document_sha256
      AND signed_file.storage_status = 'available' AND signed_file.deleted_at IS NULL
      AND pg_catalog.strpos(request_row.body_text, 'Treatment plan response SHA-256: ' || NEW.response_sha256) > 0
      AND request_row.deleted_at IS NULL
  ) INTO evidence_matches;
  IF NOT evidence_matches THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Signed consent does not bind this exact treatment plan response'; END IF;
  expected_hash := public.compute_visit_treatment_plan_response_sha256(NEW.practice_id, NEW.plan_id, NEW.revision_id, NEW.id);
  IF NEW.response_sha256 <> expected_hash THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan response hash does not match its stored decisions'; END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_visit_treatment_plan_revision_seal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_visit_treatment_plan_revision_seal() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  expected_revision integer;
  line_count integer;
  stored_subtotal numeric;
  stored_tax numeric;
  stored_total numeric;
  expected_hash text;
BEGIN
  IF coalesce(pg_catalog.current_setting('app.rls_bypass', true), '') = 'on' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.visit_treatment_plans plan
    WHERE plan.practice_id = NEW.practice_id AND plan.id = NEW.plan_id
      AND plan.status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Treatment plan is missing, closed, or outside the active practice'; END IF;
  SELECT coalesce(max(revision_number), 0) + 1 INTO expected_revision
    FROM public.visit_treatment_plan_revisions
    WHERE practice_id = NEW.practice_id AND plan_id = NEW.plan_id;
  IF NEW.revision_number <> expected_revision THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan revision number is stale or non-sequential'; END IF;
  SELECT count(*)::integer, coalesce(sum(line_subtotal), 0),
         coalesce(sum(tax_amount), 0), coalesce(sum(line_total), 0)
    INTO line_count, stored_subtotal, stored_tax, stored_total
    FROM public.visit_treatment_plan_revision_lines
    WHERE practice_id = NEW.practice_id AND plan_id = NEW.plan_id
      AND revision_id = NEW.id;
  IF line_count = 0 THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan revision must contain at least one offered line'; END IF;
  IF stored_subtotal <> NEW.subtotal OR stored_tax <> NEW.tax OR stored_total <> NEW.total THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan revision totals do not match its offered lines'; END IF;
  expected_hash := public.compute_visit_treatment_plan_revision_sha256(
    NEW.practice_id, NEW.plan_id, NEW.id, NEW.revision_number,
    NEW.currency, NEW.subtotal, NEW.tax, NEW.total);
  IF NEW.content_sha256 <> expected_hash THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Treatment plan revision content hash does not match its stored snapshot'; END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: ai_imaging_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_imaging_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    file_id uuid NOT NULL,
    appointment_id uuid,
    requested_by uuid NOT NULL,
    model_id text NOT NULL,
    image_type public.ai_imaging_image_type NOT NULL,
    analysis_type text DEFAULT 'diagnosis'::text,
    user_prompt text,
    result text,
    raw_response jsonb,
    status public.ai_imaging_status DEFAULT 'PENDING'::public.ai_imaging_status NOT NULL,
    error_message text,
    completed_at timestamp with time zone,
    revision integer DEFAULT 0 NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    key_prefix character varying(16),
    key_hash character varying(255) NOT NULL,
    name character varying(128) NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: appointment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    color character varying(7) DEFAULT '#0d9488'::character varying,
    requires_doctor integer DEFAULT 1 NOT NULL,
    default_room_type public.room_type DEFAULT 'exam'::public.room_type
);


--
-- Name: appointment_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    type_id uuid,
    status public.waitlist_status DEFAULT 'waiting'::public.waitlist_status NOT NULL,
    preferred_from date,
    preferred_to date,
    notes text,
    created_by uuid
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    type_id uuid,
    patient_id uuid,
    client_id uuid,
    doctor_id uuid,
    room_id uuid,
    status public.appointment_status DEFAULT 'scheduled'::public.appointment_status NOT NULL,
    notes text,
    recurring_series_id uuid,
    location_id uuid,
    origin public.appointment_origin DEFAULT 'scheduled'::public.appointment_origin NOT NULL,
    CONSTRAINT appointments_time_range_check CHECK ((start_time < end_time))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid,
    user_id uuid,
    action character varying(64) NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id uuid,
    changes jsonb,
    ip_address character varying(45)
);


--
-- Name: auth_email_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_email_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    practice_id uuid NOT NULL,
    user_id uuid NOT NULL,
    source public.auth_email_source NOT NULL,
    provider character varying(16) DEFAULT 'resend'::character varying NOT NULL,
    idempotency_key character varying(200) NOT NULL,
    provider_message_id character varying(128),
    outcome public.auth_email_attempt_outcome DEFAULT 'reserved'::public.auth_email_attempt_outcome NOT NULL,
    failure_code character varying(64),
    CONSTRAINT auth_email_attempts_outcome_shape_check CHECK ((((outcome = 'reserved'::public.auth_email_attempt_outcome) AND (resolved_at IS NULL) AND (provider_message_id IS NULL) AND (failure_code IS NULL)) OR ((outcome = 'accepted'::public.auth_email_attempt_outcome) AND (resolved_at IS NOT NULL) AND (length(btrim((COALESCE(provider_message_id, ''::character varying))::text)) > 0) AND (failure_code IS NULL)) OR ((outcome = ANY (ARRAY['definite_failure'::public.auth_email_attempt_outcome, 'outcome_unknown'::public.auth_email_attempt_outcome])) AND (resolved_at IS NOT NULL) AND (provider_message_id IS NULL) AND (length(btrim((COALESCE(failure_code, ''::character varying))::text)) > 0)))),
    CONSTRAINT auth_email_attempts_provider_check CHECK (((provider)::text = ANY ((ARRAY['resend'::character varying, 'console'::character varying])::text[])))
);


--
-- Name: auth_email_delivery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_email_delivery_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    webhook_id character varying(128) NOT NULL,
    raw_body_fingerprint character varying(64) NOT NULL,
    provider character varying(16) DEFAULT 'resend'::character varying NOT NULL,
    provider_message_id character varying(128) NOT NULL,
    attempt_id uuid,
    event_type character varying(64) NOT NULL,
    classification public.auth_email_delivery_classification NOT NULL,
    attribution public.auth_email_delivery_attribution NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    CONSTRAINT auth_email_delivery_events_attribution_shape_check CHECK ((((attribution = ANY (ARRAY['attempt_tag'::public.auth_email_delivery_attribution, 'provider_message_id'::public.auth_email_delivery_attribution])) AND (attempt_id IS NOT NULL)) OR ((attribution = ANY (ARRAY['unmatched'::public.auth_email_delivery_attribution, 'identity_conflict'::public.auth_email_delivery_attribution])) AND (attempt_id IS NULL)))),
    CONSTRAINT auth_email_delivery_events_event_type_check CHECK (((event_type)::text ~ '^email\.'::text)),
    CONSTRAINT auth_email_delivery_events_provider_check CHECK (((provider)::text = 'resend'::text)),
    CONSTRAINT auth_email_delivery_events_raw_body_fingerprint_check CHECK (((raw_body_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: auth_email_provider_identity_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_email_provider_identity_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    attempt_id uuid NOT NULL,
    provider character varying(16) DEFAULT 'resend'::character varying NOT NULL,
    source public.auth_email_source NOT NULL,
    durable_provider_message_id character varying(128) NOT NULL,
    conflicting_provider_message_id character varying(128) NOT NULL,
    CONSTRAINT auth_email_provider_identity_conflicts_distinct_id_check CHECK (((durable_provider_message_id)::text <> (conflicting_provider_message_id)::text)),
    CONSTRAINT auth_email_provider_identity_conflicts_id_shape_check CHECK (((length(btrim((durable_provider_message_id)::text)) > 0) AND (length(btrim((conflicting_provider_message_id)::text)) > 0))),
    CONSTRAINT auth_email_provider_identity_conflicts_provider_check CHECK (((provider)::text = 'resend'::text))
);


--
-- Name: auth_email_webhook_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_email_webhook_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    original_webhook_id character varying(128) NOT NULL,
    incoming_raw_body_fingerprint character varying(64) NOT NULL,
    provider character varying(16) DEFAULT 'resend'::character varying NOT NULL,
    incoming_provider_message_id character varying(128) NOT NULL,
    incoming_event_type character varying(64) NOT NULL,
    CONSTRAINT auth_email_webhook_conflicts_event_type_check CHECK (((incoming_event_type)::text ~ '^email\.'::text)),
    CONSTRAINT auth_email_webhook_conflicts_provider_check CHECK (((provider)::text = 'resend'::text)),
    CONSTRAINT auth_email_webhook_conflicts_raw_body_fingerprint_check CHECK (((incoming_raw_body_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    token_hash character varying(64) NOT NULL,
    type character varying(24) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: backup_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone NOT NULL,
    run_date_utc date NOT NULL,
    status public.backup_run_status NOT NULL,
    practices integer NOT NULL,
    primary_verified integer NOT NULL,
    primary_failed integer NOT NULL,
    oversized integer NOT NULL,
    near_limit integer NOT NULL,
    max_export_bytes integer NOT NULL,
    replica_enabled boolean NOT NULL,
    replica_required boolean NOT NULL,
    replica_verified integer NOT NULL,
    replica_failed integer NOT NULL,
    CONSTRAINT backup_runs_completed_after_started_check CHECK ((completed_at >= started_at)),
    CONSTRAINT backup_runs_nonnegative_counts_check CHECK (((practices >= 0) AND (primary_verified >= 0) AND (primary_failed >= 0) AND (oversized >= 0) AND (near_limit >= 0) AND (max_export_bytes >= 0) AND (replica_verified >= 0) AND (replica_failed >= 0))),
    CONSTRAINT backup_runs_primary_failure_shape_check CHECK ((((status = 'ok'::public.backup_run_status) AND (primary_failed = 0) AND (replica_failed = 0)) OR ((status = 'degraded'::public.backup_run_status) AND ((primary_failed > 0) OR (replica_failed > 0))) OR ((status = 'failed'::public.backup_run_status) AND (practices = 0) AND (primary_verified = 0)))),
    CONSTRAINT backup_runs_primary_totals_check CHECK (((primary_verified + primary_failed) = practices)),
    CONSTRAINT backup_runs_replica_execution_check CHECK ((replica_enabled OR ((replica_verified = 0) AND (replica_failed = 0))))
);


--
-- Name: TABLE backup_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.backup_runs IS 'Dormant aggregate-only backup evidence; no scheduler or backup job is activated by this schema.';


--
-- Name: booking_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    slug character varying(64) NOT NULL,
    published boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: capture_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    created_by uuid,
    token character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    appointment_id uuid
);


--
-- Name: care_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.care_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    notes text,
    due_date date NOT NULL,
    status public.care_reminder_status DEFAULT 'open'::public.care_reminder_status NOT NULL,
    created_by uuid,
    completed_at timestamp with time zone,
    completed_by uuid,
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    dismissed_at timestamp with time zone,
    dismissed_by uuid,
    dismissal_reason character varying(500),
    CONSTRAINT care_reminders_dismissal_reason_check CHECK (((dismissal_reason IS NULL) OR ((char_length(btrim((dismissal_reason)::text)) >= 3) AND (char_length(btrim((dismissal_reason)::text)) <= 500)))),
    CONSTRAINT care_reminders_external_identity_pair_check CHECK (((external_source IS NULL) = (external_id IS NULL))),
    CONSTRAINT care_reminders_external_source_check CHECK (((external_source IS NULL) OR ((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))),
    CONSTRAINT care_reminders_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT care_reminders_import_identity_check CHECK ((((external_source IS NULL) AND (external_id IS NULL) AND (import_fingerprint IS NULL) AND (created_by IS NOT NULL)) OR ((external_source IS NOT NULL) AND (external_id IS NOT NULL) AND (import_fingerprint IS NOT NULL)))),
    CONSTRAINT care_reminders_notes_length_check CHECK (((notes IS NULL) OR (char_length(notes) <= 4000))),
    CONSTRAINT care_reminders_state_check CHECK ((((status = 'open'::public.care_reminder_status) AND (completed_at IS NULL) AND (completed_by IS NULL) AND (dismissed_at IS NULL) AND (dismissed_by IS NULL) AND (dismissal_reason IS NULL)) OR ((status = 'completed'::public.care_reminder_status) AND (completed_at IS NOT NULL) AND (completed_by IS NOT NULL) AND (dismissed_at IS NULL) AND (dismissed_by IS NULL) AND (dismissal_reason IS NULL)) OR ((status = 'dismissed'::public.care_reminder_status) AND (completed_at IS NULL) AND (completed_by IS NULL) AND (dismissed_at IS NOT NULL) AND (dismissed_by IS NOT NULL) AND ((char_length(btrim((dismissal_reason)::text)) >= 3) AND (char_length(btrim((dismissal_reason)::text)) <= 500)))))
);


--
-- Name: case_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    case_id uuid NOT NULL,
    appointment_id uuid,
    medical_record_type character varying(64),
    medical_record_id uuid,
    notes text
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status public.case_status DEFAULT 'open'::public.case_status NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    primary_vet_id uuid
);


--
-- Name: client_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid,
    attribution_status public.migration_attribution_status DEFAULT 'matched'::public.migration_attribution_status NOT NULL,
    kind public.client_contact_kind DEFAULT 'co_owner'::public.client_contact_kind NOT NULL,
    first_name character varying(128),
    last_name character varying(128),
    email character varying(255),
    phone character varying(32),
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    CONSTRAINT client_contacts_attribution_check CHECK ((((attribution_status = 'matched'::public.migration_attribution_status) AND (client_id IS NOT NULL)) OR ((attribution_status = 'needs_review'::public.migration_attribution_status) AND (client_id IS NULL)))),
    CONSTRAINT client_contacts_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT client_contacts_import_identity_check CHECK ((((external_source IS NULL) AND (external_id IS NULL) AND (import_fingerprint IS NULL)) OR ((external_source IS NOT NULL) AND (external_id IS NOT NULL) AND (import_fingerprint IS NOT NULL)))),
    CONSTRAINT client_contacts_import_source_check CHECK (((external_source IS NULL) OR ((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))),
    CONSTRAINT client_contacts_name_check CHECK ((((first_name IS NULL) OR (length(btrim((first_name)::text)) > 0)) AND ((last_name IS NULL) OR (length(btrim((last_name)::text)) > 0)) AND ((first_name IS NOT NULL) OR (last_name IS NOT NULL) OR (email IS NOT NULL) OR (phone IS NOT NULL))))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    first_name character varying(128) NOT NULL,
    last_name character varying(128) NOT NULL,
    email character varying(255),
    phone character varying(32),
    address text,
    city character varying(128),
    state character varying(64),
    zip character varying(16),
    emergency_contact character varying(255),
    emergency_phone character varying(32),
    preferred_contact_method public.contact_method DEFAULT 'phone'::public.contact_method,
    sms_consent boolean DEFAULT false NOT NULL,
    sms_consent_at timestamp with time zone,
    sms_consent_source character varying(32),
    sms_consent_disclosure text,
    notes text,
    access_token character varying(64),
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    portal_access_token_expires_at timestamp with time zone,
    portal_access_token_used_at timestamp with time zone,
    CONSTRAINT clients_external_identity_pair_check CHECK (((external_source IS NULL) = (external_id IS NULL))),
    CONSTRAINT clients_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT clients_portal_access_token_state_check CHECK ((((access_token IS NULL) AND (portal_access_token_expires_at IS NULL) AND (portal_access_token_used_at IS NULL)) OR (((access_token)::text ~ '^[0-9a-f]{64}$'::text) AND (portal_access_token_expires_at IS NOT NULL))))
);


--
-- Name: clinic_pilot_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_pilot_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_pilot_id uuid NOT NULL,
    practice_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    payload_hash character varying(64) NOT NULL,
    event_type public.clinic_pilot_event_type NOT NULL,
    reason public.clinic_pilot_reason NOT NULL,
    cohort_key character varying(32) NOT NULL,
    workflow public.clinic_pilot_workflow NOT NULL,
    stage public.clinic_pilot_stage NOT NULL,
    decision public.clinic_pilot_decision NOT NULL,
    qualification_checklist jsonb NOT NULL,
    readiness_checklist jsonb NOT NULL,
    blocker_codes text[] NOT NULL,
    next_action public.clinic_pilot_next_action NOT NULL,
    support_cadence public.clinic_pilot_support_cadence NOT NULL,
    owner_identity character varying(255) NOT NULL,
    communication_mode public.clinic_pilot_communication_mode NOT NULL,
    communication_tested_at timestamp with time zone,
    first_visit_validated_at timestamp with time zone,
    clinic_use_validated_at timestamp with time zone,
    clinic_acceptance_at timestamp with time zone,
    clinic_acceptance_by_user_id uuid,
    last_contact_at timestamp with time zone,
    last_contact_outcome public.clinic_pilot_contact_outcome,
    target_start_on date,
    next_review_at timestamp with time zone,
    projection_version integer NOT NULL,
    actor_identity character varying(255) NOT NULL,
    evidence_snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_visit_validated_closeout_id uuid,
    clinic_use_validated_hash character varying(64),
    CONSTRAINT clinic_pilot_events_snapshot_check CHECK (((projection_version > 0) AND ((payload_hash)::text ~ '^[a-f0-9]{64}$'::text) AND ((actor_identity)::text = btrim((actor_identity)::text)) AND ((length((actor_identity)::text) >= 3) AND (length((actor_identity)::text) <= 255)) AND ((owner_identity)::text = btrim((owner_identity)::text)) AND ((length((owner_identity)::text) >= 3) AND (length((owner_identity)::text) <= 255)) AND ((cohort_key)::text ~ '^pilot-[0-9]{4}-[0-9]{2}$'::text) AND (jsonb_typeof(qualification_checklist) = 'object'::text) AND (jsonb_typeof(readiness_checklist) = 'object'::text) AND (jsonb_typeof(evidence_snapshot) = 'object'::text) AND ((last_contact_at IS NULL) = (last_contact_outcome IS NULL)) AND ((clinic_acceptance_at IS NULL) = (clinic_acceptance_by_user_id IS NULL)) AND ((first_visit_validated_at IS NULL) = (first_visit_validated_closeout_id IS NULL)) AND ((clinic_use_validated_at IS NULL) = (clinic_use_validated_hash IS NULL)) AND ((clinic_use_validated_hash IS NULL) OR ((clinic_use_validated_hash)::text ~ '^[a-f0-9]{64}$'::text)) AND (blocker_codes <@ ARRAY['workflow_fit'::text, 'data_import'::text, 'staff_training'::text, 'record_accuracy'::text, 'billing'::text, 'payments'::text, 'email'::text, 'sms'::text, 'permissions'::text, 'device_connectivity'::text, 'backup_export'::text, 'support_coverage'::text]) AND (cardinality(blocker_codes) <= 12) AND (array_position(blocker_codes, NULL::text) IS NULL)))
);


--
-- Name: clinic_pilots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_pilots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    cohort_key character varying(32) NOT NULL,
    workflow public.clinic_pilot_workflow NOT NULL,
    stage public.clinic_pilot_stage DEFAULT 'candidate'::public.clinic_pilot_stage NOT NULL,
    decision public.clinic_pilot_decision DEFAULT 'pending'::public.clinic_pilot_decision NOT NULL,
    qualification_checklist jsonb DEFAULT '{"singleLocation": false, "championConfirmed": false, "parallelRunAccepted": false, "supportedClinicType": false, "connectedModeAccepted": false, "noUnsupportedMustHave": false, "supportedWorkflowConfirmed": false, "supportedJurisdictionConfirmed": false}'::jsonb NOT NULL,
    readiness_checklist jsonb DEFAULT '{"firstVisitScheduled": false, "migrationPlanAccepted": false, "supportCadenceConfirmed": false, "rolesAndDevicesValidated": false, "sampleValidationAccepted": false, "exportAndRollbackConfirmed": false}'::jsonb NOT NULL,
    blocker_codes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    next_action public.clinic_pilot_next_action DEFAULT 'confirm_fit'::public.clinic_pilot_next_action NOT NULL,
    support_cadence public.clinic_pilot_support_cadence DEFAULT 'daily'::public.clinic_pilot_support_cadence NOT NULL,
    owner_identity character varying(255) NOT NULL,
    communication_mode public.clinic_pilot_communication_mode DEFAULT 'email_only'::public.clinic_pilot_communication_mode NOT NULL,
    communication_tested_at timestamp with time zone,
    first_visit_validated_at timestamp with time zone,
    clinic_use_validated_at timestamp with time zone,
    clinic_acceptance_at timestamp with time zone,
    clinic_acceptance_by_user_id uuid,
    last_contact_at timestamp with time zone,
    last_contact_outcome public.clinic_pilot_contact_outcome,
    target_start_on date,
    next_review_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_visit_validated_closeout_id uuid,
    clinic_use_validated_hash character varying(64),
    CONSTRAINT clinic_pilots_blocker_codes_check CHECK (((blocker_codes <@ ARRAY['workflow_fit'::text, 'data_import'::text, 'staff_training'::text, 'record_accuracy'::text, 'billing'::text, 'payments'::text, 'email'::text, 'sms'::text, 'permissions'::text, 'device_connectivity'::text, 'backup_export'::text, 'support_coverage'::text]) AND (cardinality(blocker_codes) <= 12) AND (array_position(blocker_codes, NULL::text) IS NULL))),
    CONSTRAINT clinic_pilots_lifecycle_check CHECK ((((stage = 'completed'::public.clinic_pilot_stage) AND (decision = 'graduated'::public.clinic_pilot_decision) AND (cardinality(blocker_codes) = 0) AND (next_action = 'support_retention'::public.clinic_pilot_next_action) AND (next_review_at IS NULL)) OR ((stage = 'closed'::public.clinic_pilot_stage) AND (decision = 'not_a_fit'::public.clinic_pilot_decision) AND (next_action = 'revisit_fit'::public.clinic_pilot_next_action) AND (next_review_at IS NULL)) OR ((stage <> ALL (ARRAY['completed'::public.clinic_pilot_stage, 'closed'::public.clinic_pilot_stage])) AND (decision <> ALL (ARRAY['graduated'::public.clinic_pilot_decision, 'not_a_fit'::public.clinic_pilot_decision])) AND (next_review_at IS NOT NULL)))),
    CONSTRAINT clinic_pilots_operating_shape_check CHECK ((((cohort_key)::text ~ '^pilot-[0-9]{4}-[0-9]{2}$'::text) AND (jsonb_typeof(qualification_checklist) = 'object'::text) AND (jsonb_typeof(readiness_checklist) = 'object'::text) AND ((owner_identity)::text = btrim((owner_identity)::text)) AND ((length((owner_identity)::text) >= 3) AND (length((owner_identity)::text) <= 255)) AND ((last_contact_at IS NULL) = (last_contact_outcome IS NULL)) AND ((clinic_acceptance_at IS NULL) = (clinic_acceptance_by_user_id IS NULL)) AND ((first_visit_validated_at IS NULL) = (first_visit_validated_closeout_id IS NULL)) AND ((clinic_use_validated_at IS NULL) = (clinic_use_validated_hash IS NULL)) AND ((clinic_use_validated_hash IS NULL) OR ((clinic_use_validated_hash)::text ~ '^[a-f0-9]{64}$'::text)))),
    CONSTRAINT clinic_pilots_version_check CHECK ((version > 0))
);


--
-- Name: clinical_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    author_id uuid NOT NULL,
    note_type public.note_type DEFAULT 'general'::public.note_type NOT NULL,
    content text NOT NULL
);


--
-- Name: clinical_record_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_record_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    record_type public.clinical_correction_record_type NOT NULL,
    action public.clinical_correction_action DEFAULT 'entered_in_error'::public.clinical_correction_action NOT NULL,
    soap_note_id uuid,
    vital_sign_id uuid,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    reason character varying(1000) NOT NULL,
    corrected_by uuid NOT NULL,
    corrected_by_name character varying(255) NOT NULL,
    vaccination_record_id uuid,
    lab_result_id uuid,
    operation_id uuid,
    operation_payload_hash character varying(64),
    patient_allergy_id uuid,
    CONSTRAINT clinical_record_corrections_actor_name_check CHECK (((length(btrim((corrected_by_name)::text)) >= 1) AND (length(btrim((corrected_by_name)::text)) <= 255))),
    CONSTRAINT clinical_record_corrections_operation_shape_check CHECK ((((record_type = 'lab_result'::public.clinical_correction_record_type) AND (operation_id IS NOT NULL) AND ((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)) OR ((record_type <> 'lab_result'::public.clinical_correction_record_type) AND (operation_id IS NULL) AND (operation_payload_hash IS NULL)))),
    CONSTRAINT clinical_record_corrections_reason_length_check CHECK (((length(btrim((reason)::text)) >= 5) AND (length(btrim((reason)::text)) <= 1000))),
    CONSTRAINT clinical_record_corrections_source_type_check CHECK ((((record_type = 'soap_note'::public.clinical_correction_record_type) AND (soap_note_id IS NOT NULL) AND (vital_sign_id IS NULL) AND (vaccination_record_id IS NULL) AND (lab_result_id IS NULL) AND (patient_allergy_id IS NULL)) OR ((record_type = 'vital_sign'::public.clinical_correction_record_type) AND (vital_sign_id IS NOT NULL) AND (soap_note_id IS NULL) AND (vaccination_record_id IS NULL) AND (lab_result_id IS NULL) AND (patient_allergy_id IS NULL)) OR ((record_type = 'vaccination_record'::public.clinical_correction_record_type) AND (vaccination_record_id IS NOT NULL) AND (soap_note_id IS NULL) AND (vital_sign_id IS NULL) AND (lab_result_id IS NULL) AND (patient_allergy_id IS NULL)) OR ((record_type = 'lab_result'::public.clinical_correction_record_type) AND (lab_result_id IS NOT NULL) AND (soap_note_id IS NULL) AND (vital_sign_id IS NULL) AND (vaccination_record_id IS NULL) AND (patient_allergy_id IS NULL)) OR ((record_type = 'patient_allergy'::public.clinical_correction_record_type) AND (patient_allergy_id IS NOT NULL) AND (soap_note_id IS NULL) AND (vital_sign_id IS NULL) AND (vaccination_record_id IS NULL) AND (lab_result_id IS NULL) AND (appointment_id IS NULL))))
);


--
-- Name: communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid,
    channel public.comm_channel NOT NULL,
    direction public.comm_direction NOT NULL,
    subject character varying(255),
    content text,
    status public.comm_status DEFAULT 'pending'::public.comm_status NOT NULL,
    assigned_to uuid,
    read_at timestamp with time zone,
    provider_message_id character varying(255),
    dedupe_key character varying(160)
);


--
-- Name: consent_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    slug character varying(64) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: consent_receipt_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_receipt_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    consent_request_id uuid NOT NULL,
    file_id uuid NOT NULL,
    file_checksum_sha256 character varying(64) NOT NULL,
    file_size_bytes integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    claim_count integer DEFAULT 0 NOT NULL,
    max_claims integer DEFAULT 3 NOT NULL,
    last_claimed_at timestamp with time zone,
    CONSTRAINT consent_receipt_capabilities_checksum_check CHECK (((file_checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT consent_receipt_capabilities_claim_evidence_check CHECK ((((claim_count = 0) AND (last_claimed_at IS NULL)) OR ((claim_count > 0) AND (last_claimed_at IS NOT NULL)))),
    CONSTRAINT consent_receipt_capabilities_claims_check CHECK ((((max_claims >= 1) AND (max_claims <= 3)) AND ((claim_count >= 0) AND (claim_count <= max_claims)))),
    CONSTRAINT consent_receipt_capabilities_expiry_check CHECK (((expires_at > created_at) AND (expires_at <= (created_at + '00:15:00'::interval)))),
    CONSTRAINT consent_receipt_capabilities_file_size_check CHECK ((file_size_bytes > 0)),
    CONSTRAINT consent_receipt_capabilities_token_hash_check CHECK (((token_hash)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: consent_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    created_by uuid,
    token character varying(64),
    expires_at timestamp with time zone NOT NULL,
    title character varying(200) NOT NULL,
    body_text text NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    signer_name character varying(120),
    signed_at timestamp with time zone,
    file_id uuid,
    appointment_id uuid,
    form_id uuid,
    signature_png_bytes bytea,
    signature_sha256 character varying(64),
    token_hash character varying(64),
    signature_method character varying(16),
    signer_attestation_version character varying(64),
    document_render_version character varying(32),
    storage_lease_token uuid,
    storage_lease_expires_at timestamp with time zone,
    signed_file_key character varying(512),
    signed_file_checksum_sha256 character varying(64),
    signed_file_size_bytes integer,
    signed_file_object_etag character varying(255),
    signed_file_object_version_id character varying(255),
    CONSTRAINT consent_requests_credential_storage_check CHECK ((((token IS NOT NULL) AND (token_hash IS NULL)) OR ((token IS NULL) AND (token_hash IS NOT NULL)) OR (((status)::text = 'signed'::text) AND (token IS NULL) AND (token_hash IS NULL)))),
    CONSTRAINT consent_requests_document_render_version_check CHECK (((document_render_version IS NULL) OR ((document_render_version)::text = ANY ((ARRAY['consent-pdf-v1'::character varying, 'consent-pdf-v2'::character varying])::text[])))),
    CONSTRAINT consent_requests_signature_evidence_hash_check CHECK (((signature_sha256 IS NULL) OR (((signature_sha256)::text ~ '^[0-9a-f]{64}$'::text) AND ((signature_sha256)::text = encode(sha256(signature_png_bytes), 'hex'::text))))),
    CONSTRAINT consent_requests_signature_evidence_pair_check CHECK ((((signature_png_bytes IS NULL) AND (signature_sha256 IS NULL)) OR ((signature_png_bytes IS NOT NULL) AND (signature_sha256 IS NOT NULL)))),
    CONSTRAINT consent_requests_signature_evidence_size_check CHECK (((signature_png_bytes IS NULL) OR ((octet_length(signature_png_bytes) >= 1) AND (octet_length(signature_png_bytes) <= 500000)))),
    CONSTRAINT consent_requests_signature_method_check CHECK (((signature_method IS NULL) OR ((signature_method)::text = ANY ((ARRAY['drawn'::character varying, 'typed'::character varying])::text[])))),
    CONSTRAINT consent_requests_signed_file_binding_check CHECK ((((signed_file_key IS NULL) AND (signed_file_checksum_sha256 IS NULL) AND (signed_file_size_bytes IS NULL) AND (signed_file_object_etag IS NULL) AND (signed_file_object_version_id IS NULL)) OR ((file_id IS NOT NULL) AND (signed_file_key IS NOT NULL) AND ((signed_file_checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text) AND (signed_file_size_bytes > 0)))),
    CONSTRAINT consent_requests_signing_evidence_check CHECK (((((status)::text = 'pending'::text) AND (signer_name IS NULL) AND (signed_at IS NULL) AND (file_id IS NULL) AND (signature_png_bytes IS NULL) AND (signature_sha256 IS NULL)) OR (((status)::text = 'signing'::text) AND (signer_name IS NOT NULL) AND (signed_at IS NOT NULL) AND (signature_png_bytes IS NOT NULL) AND (signature_sha256 IS NOT NULL)) OR (((status)::text = 'signed'::text) AND (signer_name IS NOT NULL) AND (signed_at IS NOT NULL) AND (file_id IS NOT NULL)))),
    CONSTRAINT consent_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'signing'::character varying, 'signed'::character varying])::text[]))),
    CONSTRAINT consent_requests_storage_lease_pair_check CHECK ((((storage_lease_token IS NULL) AND (storage_lease_expires_at IS NULL)) OR ((storage_lease_token IS NOT NULL) AND (storage_lease_expires_at IS NOT NULL)))),
    CONSTRAINT consent_requests_storage_lease_state_check CHECK (((storage_lease_token IS NULL) OR ((status)::text = 'signing'::text))),
    CONSTRAINT consent_requests_token_hash_format_check CHECK (((token_hash IS NULL) OR ((token_hash)::text ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: controlled_substance_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controlled_substance_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    drug_name character varying(255) NOT NULL,
    dea_schedule character varying(10) NOT NULL,
    action public.controlled_substance_action NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit character varying(32) NOT NULL,
    patient_id uuid,
    performed_by uuid NOT NULL,
    witnessed_by uuid,
    lot_number character varying(64),
    notes text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: demo_accesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_accesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    email character varying(255) NOT NULL,
    email_hash character varying(64) NOT NULL,
    first_accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    last_accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    access_count integer DEFAULT 1 NOT NULL,
    feedback_opt_out_at timestamp with time zone
);


--
-- Name: dental_charts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_charts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    veterinarian_id uuid NOT NULL,
    tooth_code character varying(16) NOT NULL,
    charted_at date NOT NULL,
    condition public.dental_condition DEFAULT 'HEALTHY'::public.dental_condition NOT NULL,
    treatment text,
    notes text
);


--
-- Name: discharge_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discharge_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid,
    appointment_id uuid,
    created_by uuid NOT NULL,
    pet_name text NOT NULL,
    species text,
    diagnosis text NOT NULL,
    treatment text,
    follow_up text,
    report_text text NOT NULL,
    language text DEFAULT 'sk'::text,
    model_id text,
    status public.discharge_report_status DEFAULT 'draft'::public.discharge_report_status NOT NULL,
    revision integer DEFAULT 0 NOT NULL
);


--
-- Name: dispense_charge_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispense_charge_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    prescription_event_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    appointment_id uuid,
    product_id uuid NOT NULL,
    quantity numeric(13,3) NOT NULL,
    description_snapshot character varying(500) NOT NULL,
    unit_price_snapshot numeric(10,2) NOT NULL,
    status public.dispense_charge_status DEFAULT 'pending'::public.dispense_charge_status NOT NULL,
    invoice_id uuid,
    invoice_item_id uuid,
    resolved_by uuid,
    resolved_by_name character varying(255),
    resolved_at timestamp with time zone,
    resolution_reason text,
    legacy_review boolean DEFAULT false NOT NULL,
    CONSTRAINT dispense_charge_queue_shape_check CHECK (((quantity > (0)::numeric) AND (unit_price_snapshot >= (0)::numeric) AND (length(btrim((description_snapshot)::text)) > 0) AND (((status = 'pending'::public.dispense_charge_status) AND (invoice_id IS NULL) AND (invoice_item_id IS NULL) AND (resolved_by IS NULL) AND (resolved_by_name IS NULL) AND (resolved_at IS NULL) AND (resolution_reason IS NULL)) OR ((status = 'invoiced'::public.dispense_charge_status) AND (invoice_id IS NOT NULL) AND (invoice_item_id IS NOT NULL) AND (resolved_by IS NOT NULL) AND (length(btrim((COALESCE(resolved_by_name, ''::character varying))::text)) > 0) AND (resolved_at IS NOT NULL) AND (resolution_reason IS NULL)) OR ((status = 'waived'::public.dispense_charge_status) AND (invoice_id IS NULL) AND (invoice_item_id IS NULL) AND (resolved_by IS NOT NULL) AND (length(btrim((COALESCE(resolved_by_name, ''::character varying))::text)) > 0) AND (resolved_at IS NOT NULL) AND (length(btrim(COALESCE(resolution_reason, ''::text))) >= 5) AND (length(resolution_reason) <= 1000)))))
);


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    drug_a character varying(255) NOT NULL,
    drug_b character varying(255) NOT NULL,
    severity public.interaction_severity NOT NULL,
    description text
);


--
-- Name: ekasa_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ekasa_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    dic text NOT NULL,
    ic_dph text,
    pokladnica_id text NOT NULL,
    pokladnica_type public.ekasa_pokladnica_type DEFAULT 'CLOUD'::public.ekasa_pokladnica_type NOT NULL,
    ekasa_api_url text DEFAULT 'https://ekasa.financnasprava.sk/oto/api'::text NOT NULL,
    cert_base64 text,
    cert_password text,
    offline_mode_enabled boolean DEFAULT false NOT NULL,
    cashless_enabled boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ekasa_daily_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ekasa_daily_closures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    closure_number text NOT NULL,
    date text NOT NULL,
    closed_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_by uuid,
    receipts_count numeric(8,0) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    cash_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    card_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    transfer_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    vat_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    okp text,
    status text DEFAULT 'CLOSED'::text NOT NULL,
    raw_response jsonb
);


--
-- Name: ekasa_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ekasa_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    invoice_id uuid,
    receipt_number text NOT NULL,
    uid text,
    okp text,
    pkp text,
    amount_base numeric(12,2) DEFAULT 0.00 NOT NULL,
    amount_vat numeric(12,2) DEFAULT 0.00 NOT NULL,
    amount_total numeric(12,2) NOT NULL,
    vat_rate public.ekasa_vat_rate DEFAULT 'STANDARD_23'::public.ekasa_vat_rate NOT NULL,
    payment_method public.ekasa_payment_method DEFAULT 'CARD'::public.ekasa_payment_method NOT NULL,
    status public.ekasa_receipt_status DEFAULT 'PENDING'::public.ekasa_receipt_status NOT NULL,
    raw_response jsonb,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    retry_count numeric(4,0) DEFAULT 0 NOT NULL,
    last_retry_at timestamp with time zone,
    payment_id uuid,
    receipt_type public.ekasa_receipt_type DEFAULT 'STANDARD'::public.ekasa_receipt_type NOT NULL,
    original_receipt_id uuid,
    original_uid text,
    storno_reason text,
    tax_breakdown jsonb,
    items jsonb
);


--
-- Name: email_suppressions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_suppressions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    reason public.email_suppression_reason DEFAULT 'bounce'::public.email_suppression_reason NOT NULL,
    detail text
);


--
-- Name: ext_ai_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_ai_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_name text NOT NULL,
    entity_type public.ai_audit_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    original_draft_hash text NOT NULL,
    confirmed_content_hash text NOT NULL,
    was_edited_by_clinician boolean DEFAULT false NOT NULL,
    ip_address text,
    confirmed_at timestamp with time zone NOT NULL,
    sequence_number integer,
    actor_role text,
    action_type text,
    previous_event_hash text,
    event_hash text,
    canonicalization_version integer DEFAULT 1
);


--
-- Name: ext_ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_ai_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    openai_base_url text,
    openai_api_key_encrypted text,
    openai_is_active boolean DEFAULT false NOT NULL,
    openai_cached_models jsonb DEFAULT '[]'::jsonb,
    openai_last_tested_at timestamp with time zone,
    openai_last_status text,
    openai_last_status_message text,
    gemini_base_url text,
    gemini_api_key_encrypted text,
    gemini_is_active boolean DEFAULT false NOT NULL,
    gemini_cached_models jsonb DEFAULT '[]'::jsonb,
    gemini_last_tested_at timestamp with time zone,
    gemini_last_status text,
    gemini_last_status_message text,
    alibaba_mode text DEFAULT 'aliproxy_local'::text,
    alibaba_base_url text DEFAULT 'http://127.0.0.1:8080/v1'::text,
    alibaba_api_key_encrypted text,
    alibaba_is_active boolean DEFAULT false NOT NULL,
    alibaba_cached_models jsonb DEFAULT '[]'::jsonb,
    alibaba_last_tested_at timestamp with time zone,
    alibaba_last_status text,
    alibaba_last_status_message text,
    feature_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ext_automation_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    journey_id uuid NOT NULL,
    journey_version integer DEFAULT 1 NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    trigger_event_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    exited_at timestamp with time zone,
    exit_reason text,
    current_step_index integer DEFAULT 0 NOT NULL,
    status public.ext_automation_enrollment_status DEFAULT 'active'::public.ext_automation_enrollment_status NOT NULL,
    paused_at timestamp with time zone,
    pause_reason text,
    last_step_executed_at timestamp with time zone,
    CONSTRAINT ext_auto_enroll_pause_check CHECK (((status = 'paused'::public.ext_automation_enrollment_status) = (paused_at IS NOT NULL))),
    CONSTRAINT ext_auto_enroll_state_check CHECK ((((status = ANY (ARRAY['active'::public.ext_automation_enrollment_status, 'paused'::public.ext_automation_enrollment_status])) AND (exited_at IS NULL)) OR ((status = ANY (ARRAY['completed'::public.ext_automation_enrollment_status, 'exited'::public.ext_automation_enrollment_status, 'failed'::public.ext_automation_enrollment_status])) AND (exited_at IS NOT NULL)))),
    CONSTRAINT ext_auto_enroll_step_index_check CHECK ((current_step_index >= 0))
);


--
-- Name: ext_automation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    event_type public.ext_automation_event_type NOT NULL,
    event_subtype text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id uuid,
    patient_id uuid,
    appointment_id uuid,
    visit_closeout_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_router text,
    dedupe_key text,
    emitted_by uuid,
    status public.ext_automation_event_status DEFAULT 'pending'::public.ext_automation_event_status NOT NULL,
    processed_reason text,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    retry_count integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    schema_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT ext_auto_events_reason_required_check CHECK (((status <> ALL (ARRAY['skipped'::public.ext_automation_event_status, 'failed'::public.ext_automation_event_status])) OR (char_length(btrim(COALESCE(processed_reason, ''::text))) >= 3))),
    CONSTRAINT ext_auto_events_retry_count_check CHECK ((retry_count >= 0)),
    CONSTRAINT ext_auto_events_status_timestamp_check CHECK ((((status = 'processed'::public.ext_automation_event_status) = (processed_at IS NOT NULL)) AND ((status = 'failed'::public.ext_automation_event_status) = (failed_at IS NOT NULL)))),
    CONSTRAINT ext_auto_events_terminal_state_check CHECK (((processed_at IS NULL) OR (failed_at IS NULL)))
);


--
-- Name: ext_automation_journeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_journeys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    journey_key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    trigger_event_type public.ext_automation_event_type NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    frequency_cap_window_days integer DEFAULT 30 NOT NULL,
    frequency_cap_max_steps integer DEFAULT 4 NOT NULL,
    allow_reentry boolean DEFAULT false NOT NULL,
    created_by uuid,
    target_segment_keys jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT ext_auto_journeys_frequency_cap_check CHECK (((frequency_cap_window_days >= 1) AND (frequency_cap_max_steps >= 0))),
    CONSTRAINT ext_auto_journeys_version_check CHECK ((version >= 1))
);


--
-- Name: ext_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    rule_key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    trigger_event_type public.ext_automation_event_type NOT NULL,
    condition_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    delay_hours integer DEFAULT 0 NOT NULL,
    action_type public.ext_automation_rule_action NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    legal_basis text DEFAULT 'contract'::text NOT NULL,
    requires_consent_scope text,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    migrated_from_key text,
    created_by uuid,
    CONSTRAINT ext_auto_rules_delay_check CHECK ((delay_hours >= 0)),
    CONSTRAINT ext_auto_rules_priority_check CHECK ((priority >= 0)),
    CONSTRAINT ext_auto_rules_validity_check CHECK (((valid_from IS NULL) OR (valid_to IS NULL) OR (valid_from <= valid_to)))
);


--
-- Name: ext_automation_step_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_step_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    step_index integer NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    executed_at timestamp with time zone,
    skipped_at timestamp with time zone,
    skip_reason text,
    channel_used public.ext_marketing_channel,
    message_log_id uuid,
    communication_id uuid,
    content_item_id uuid,
    staff_task_id uuid,
    care_reminder_id uuid,
    status public.ext_automation_step_status DEFAULT 'scheduled'::public.ext_automation_step_status NOT NULL,
    failure_reason text,
    CONSTRAINT ext_auto_steps_step_index_check CHECK ((step_index >= 0)),
    CONSTRAINT ext_auto_steps_terminal_check CHECK ((((status = 'done'::public.ext_automation_step_status) = (executed_at IS NOT NULL)) AND ((status = 'skipped'::public.ext_automation_step_status) = (skipped_at IS NOT NULL))))
);


--
-- Name: ext_automation_suppression_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_automation_suppression_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    suppression_reason public.ext_automation_suppression_reason NOT NULL,
    blocked_action text NOT NULL,
    channel_attempted public.ext_marketing_channel,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    cleared_at timestamp with time zone,
    enrollment_id uuid,
    rule_id uuid,
    journey_id uuid,
    event_id uuid,
    dedupe_key text,
    detail text,
    CONSTRAINT ext_auto_suppression_blocked_action_check CHECK (((char_length(btrim(blocked_action)) >= 3) AND (char_length(btrim(blocked_action)) <= 200)))
);


--
-- Name: ext_carcass_disposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_carcass_disposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid,
    euthanasia_date timestamp with time zone DEFAULT now() NOT NULL,
    reason text NOT NULL,
    weight_kg numeric(6,2) NOT NULL,
    medication_used text DEFAULT 'T61 / Pentobarbital'::text NOT NULL,
    dose_administered text,
    veterinarian_name text NOT NULL,
    rendering_plant text DEFAULT 'VAS s.r.o. Mojšova Lúčka'::text NOT NULL,
    disposal_document_number text,
    picked_up_at timestamp with time zone,
    storage_location text,
    client_consent_signed boolean DEFAULT true NOT NULL,
    notes text
);


--
-- Name: ext_channel_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_channel_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    provider public.ext_channel_provider NOT NULL,
    external_account_id text NOT NULL,
    display_name text,
    scopes_granted text[] DEFAULT '{}'::text[] NOT NULL,
    encrypted_access_token text,
    encrypted_refresh_token text,
    token_expires_at timestamp with time zone,
    token_refreshed_at timestamp with time zone,
    connected_by uuid,
    connected_at timestamp with time zone,
    disconnected_at timestamp with time zone,
    status public.ext_channel_account_status DEFAULT 'connected'::public.ext_channel_account_status NOT NULL,
    last_error text,
    publishing_quota_remaining integer,
    publishing_quota_fetched_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ext_channel_accounts_disconnect_state_check CHECK (((status = 'revoked'::public.ext_channel_account_status) = (disconnected_at IS NOT NULL))),
    CONSTRAINT ext_channel_accounts_quota_check CHECK (((publishing_quota_remaining IS NULL) OR (publishing_quota_remaining >= 0)))
);


--
-- Name: ext_clinical_guardian_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_clinical_guardian_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid,
    encounter_id uuid,
    category text NOT NULL,
    severity text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    suggested_action text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone
);


--
-- Name: ext_clinician_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_clinician_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_role text NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    expected_revision integer DEFAULT 0 NOT NULL,
    original_draft_hash text NOT NULL,
    confirmed_content_hash text NOT NULL,
    status public.clinician_confirmation_status DEFAULT 'PENDING'::public.clinician_confirmation_status NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    consumed_by uuid,
    correlation_id text
);


--
-- Name: ext_content_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_content_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    pillar_id uuid,
    trigger_event_id uuid,
    brief_text text NOT NULL,
    target_channels text[] DEFAULT '{}'::text[] NOT NULL,
    target_audience text DEFAULT ''::text NOT NULL,
    clinical_claims jsonb DEFAULT '[]'::jsonb NOT NULL,
    brand_voice_override text,
    status public.ext_content_brief_status DEFAULT 'pending'::public.ext_content_brief_status NOT NULL,
    generated_by text,
    generated_at timestamp with time zone,
    confidence integer,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    content_item_id uuid,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ext_content_briefs_clinical_approval_check CHECK (((status <> 'approved'::public.ext_content_brief_status) OR (jsonb_array_length(clinical_claims) = 0) OR ((reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL)))),
    CONSTRAINT ext_content_briefs_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= 0) AND (confidence <= 100)))),
    CONSTRAINT ext_content_briefs_review_state_check CHECK (((status = ANY (ARRAY['pending'::public.ext_content_brief_status, 'generating'::public.ext_content_brief_status, 'review'::public.ext_content_brief_status])) OR ((reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL))))
);


--
-- Name: ext_content_pillars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_content_pillars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    pillar_key text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    species text[] DEFAULT '{}'::text[] NOT NULL,
    season_months integer[] DEFAULT '{}'::integer[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    voice_guidance text DEFAULT ''::text NOT NULL,
    CONSTRAINT ext_content_pillars_key_format_check CHECK ((pillar_key ~ '^[a-z][a-z0-9_]{1,62}$'::text)),
    CONSTRAINT ext_content_pillars_season_months_check CHECK ((season_months <@ ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])),
    CONSTRAINT ext_content_pillars_sort_check CHECK ((sort_order >= 0))
);


--
-- Name: ext_crm_segment_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_crm_segment_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    client_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    enrollment_reason text,
    trigger_event_id uuid,
    is_manually_excluded boolean DEFAULT false NOT NULL,
    excluded_by uuid,
    excluded_at timestamp with time zone,
    segment_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT ext_crm_membership_exclusion_check CHECK (((is_manually_excluded = false) OR ((excluded_by IS NOT NULL) AND (excluded_at IS NOT NULL)))),
    CONSTRAINT ext_crm_membership_expiry_window_check CHECK (((expires_at IS NULL) OR (expires_at > enrolled_at)))
);


--
-- Name: ext_crm_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_crm_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name text NOT NULL,
    segment_key text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    condition_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    condition_sql text,
    refresh_strategy public.ext_crm_refresh_strategy DEFAULT 'event_driven'::public.ext_crm_refresh_strategy NOT NULL,
    last_refreshed_at timestamp with time zone,
    member_count_cache integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    CONSTRAINT ext_crm_segments_key_format_check CHECK ((segment_key ~ '^[a-z][a-z0-9_]{1,62}$'::text)),
    CONSTRAINT ext_crm_segments_member_count_check CHECK ((member_count_cache >= 0)),
    CONSTRAINT ext_crm_segments_version_check CHECK ((version >= 1))
);


--
-- Name: ext_kvepis_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_kvepis_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    ico text NOT NULL,
    kvl_id text,
    upvs_schranka text,
    integration_mode text DEFAULT 'GUIDED'::text NOT NULL,
    signing_preference public.kvepis_signature_method DEFAULT 'DSIGNER'::public.kvepis_signature_method NOT NULL,
    certificate_base64 text,
    certificate_serial text,
    certificate_valid_until timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ext_kvepis_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_kvepis_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    submission_type public.kvepis_submission_type NOT NULL,
    status public.kvepis_submission_status DEFAULT 'DRAFT'::public.kvepis_submission_status NOT NULL,
    reference_number text NOT NULL,
    source_entity_type text,
    source_entity_id uuid,
    patient_id uuid,
    farm_ico text,
    cehz_code text,
    ear_tag_number text,
    transponder_number text,
    kvl_number text,
    payload_xml text,
    payload_json jsonb,
    payload_hash text,
    signature_method public.kvepis_signature_method DEFAULT 'NONE'::public.kvepis_signature_method NOT NULL,
    signature_payload jsonb,
    signed_by uuid,
    signed_at timestamp with time zone,
    submitted_at timestamp with time zone,
    upvs_message_id text,
    receipt_received_at timestamp with time zone,
    receipt_payload jsonb,
    receipt_hash text,
    error_code text,
    error_message text,
    notes text
);


--
-- Name: ext_marketing_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    trigger_key text NOT NULL,
    timing text DEFAULT ''::text NOT NULL,
    channel text DEFAULT 'sms'::text NOT NULL,
    legal_basis text DEFAULT 'contract'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: ext_marketing_competitor_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_competitor_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    query text NOT NULL,
    region text NOT NULL,
    clinics jsonb DEFAULT '[]'::jsonb NOT NULL,
    recommendations jsonb DEFAULT '[]'::jsonb NOT NULL,
    articles jsonb DEFAULT '[]'::jsonb NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    model text DEFAULT 'gemini-3.6-flash'::text NOT NULL,
    is_sample boolean DEFAULT false NOT NULL
);


--
-- Name: ext_marketing_content_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_content_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    week_start text NOT NULL,
    status text DEFAULT 'in_review'::text NOT NULL
);


--
-- Name: ext_marketing_content_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_content_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    batch_id uuid,
    created_by uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    channel public.ext_marketing_channel NOT NULL,
    status public.ext_marketing_content_status DEFAULT 'proposed'::public.ext_marketing_content_status NOT NULL,
    scheduled_for timestamp with time zone,
    published_at timestamp with time zone,
    media_asset_id uuid,
    validator_verdict text,
    validator_findings jsonb,
    approved_by uuid,
    approved_at timestamp with time zone
);


--
-- Name: ext_marketing_handouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_handouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    created_by uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    species text[],
    tags text[],
    is_public boolean DEFAULT true NOT NULL
);


--
-- Name: ext_marketing_media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_id uuid,
    kind public.ext_marketing_media_kind NOT NULL,
    caption text,
    tags text[],
    consent_id uuid,
    url text,
    patient_name text,
    subjects_present boolean DEFAULT false NOT NULL,
    alt_text text DEFAULT ''::text,
    meta jsonb,
    CONSTRAINT ext_mkt_media_consent_required CHECK (((subjects_present = false) OR (consent_id IS NOT NULL)))
);


--
-- Name: ext_marketing_media_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_media_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    consent_request_id uuid,
    scope public.ext_marketing_consent_scope NOT NULL,
    evidence_type public.ext_marketing_consent_evidence NOT NULL,
    granted_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    notes text
);


--
-- Name: ext_marketing_message_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_message_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    template_id uuid,
    template_key text NOT NULL,
    template_version integer NOT NULL,
    legal_basis text NOT NULL,
    channel text NOT NULL,
    language text DEFAULT 'sk'::text NOT NULL,
    body_rendered text NOT NULL,
    trigger_key text NOT NULL,
    status public.ext_marketing_message_status DEFAULT 'queued'::public.ext_marketing_message_status NOT NULL,
    idempotency_key text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone
);


--
-- Name: ext_marketing_message_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    key text NOT NULL,
    language text DEFAULT 'sk'::text NOT NULL,
    channel text NOT NULL,
    body text NOT NULL,
    legal_basis text DEFAULT 'contract'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ext_marketing_operative_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_operative_scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: ext_marketing_postop_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_postop_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    message_log_id uuid,
    client_id uuid NOT NULL,
    patient_id uuid,
    outcome text NOT NULL,
    note text DEFAULT ''::text NOT NULL
);


--
-- Name: ext_marketing_recall_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_recall_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    vaccination_recall_enabled boolean DEFAULT false NOT NULL,
    vaccination_recall_lead_days integer DEFAULT 14 NOT NULL,
    post_visit_review_enabled boolean DEFAULT false NOT NULL,
    post_visit_review_delay_hours integer DEFAULT 24 NOT NULL,
    post_visit_handout_enabled boolean DEFAULT false NOT NULL,
    inactive_recall_enabled boolean DEFAULT false NOT NULL,
    inactive_recall_months integer DEFAULT 18 NOT NULL
);


--
-- Name: ext_marketing_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid,
    client_id uuid,
    appointment_id uuid,
    external_review_id text,
    rating integer,
    review_text text,
    reviewer_name text,
    received_at timestamp with time zone,
    reply_text text,
    replied_at timestamp with time zone,
    replied_by uuid,
    request_sent_at timestamp with time zone,
    request_blocked_reason text,
    platform text DEFAULT 'google'::text NOT NULL,
    sentiment_score integer,
    sentiment_label public.ext_reputation_sentiment,
    sentiment_model text,
    topic text,
    severity public.ext_reputation_severity DEFAULT 'none'::public.ext_reputation_severity NOT NULL,
    classifier_confidence integer,
    escalation_status public.ext_reputation_escalation DEFAULT 'none'::public.ext_reputation_escalation NOT NULL,
    escalated_to uuid,
    escalated_at timestamp with time zone,
    escalation_reason text,
    internal_ticket_id uuid,
    ai_reply_draft text,
    response_approved_by uuid,
    response_approved_at timestamp with time zone,
    response_published_at timestamp with time zone,
    response_channel public.ext_marketing_channel,
    response_external_id text,
    is_auto_pilot_eligible boolean,
    platform_account_id text,
    review_url text,
    reviewer_language text DEFAULT 'sk'::text NOT NULL,
    external_updated_at timestamp with time zone,
    ingest_source text
);


--
-- Name: ext_marketing_staff_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_staff_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    kind text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    client_id uuid,
    due_at timestamp with time zone
);


--
-- Name: ext_marketing_tv_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_tv_slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    body text,
    media_asset_id uuid,
    duration_seconds integer DEFAULT 12 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ext_marketing_website_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_website_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    sections_draft jsonb DEFAULT '[]'::jsonb NOT NULL,
    sections_published jsonb,
    published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone
);


--
-- Name: ext_marketing_website_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_website_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    source text DEFAULT 'website_contact'::text NOT NULL,
    metadata jsonb
);


--
-- Name: ext_marketing_wellness_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_marketing_wellness_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    benefit_key text NOT NULL,
    redeemed_at timestamp with time zone NOT NULL,
    appointment_id uuid,
    notes text
);


--
-- Name: ext_pilot_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_pilot_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    reported_by_id uuid,
    reported_by_name text,
    incident_date timestamp with time zone DEFAULT now() NOT NULL,
    module_workflow text NOT NULL,
    vet_software_reference text,
    description text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolution_notes text
);


--
-- Name: ext_rabies_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_rabies_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    vaccination_record_id uuid NOT NULL,
    rvps_notified_at timestamp without time zone,
    rvps_office_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    submission_reference text
);


--
-- Name: ext_rabies_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_rabies_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid,
    bite_date timestamp with time zone NOT NULL,
    injured_person_name text NOT NULL,
    injured_person_contact text,
    incident_location text,
    incident_description text,
    day1_examined_at timestamp with time zone,
    day1_examined_by text,
    day1_findings text,
    day1_passed boolean,
    day5_examined_at timestamp with time zone,
    day5_examined_by text,
    day5_findings text,
    day5_passed boolean,
    day14_examined_at timestamp with time zone,
    day14_examined_by text,
    day14_findings text,
    day14_passed boolean,
    status text DEFAULT 'IN_PROGRESS'::text NOT NULL,
    certificate_issued_at timestamp with time zone,
    certificate_number text,
    rvps_notified boolean DEFAULT false,
    notes text
);


--
-- Name: ext_sms_delivery_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_sms_delivery_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    source text NOT NULL,
    source_record_id text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ext_support_session_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_support_session_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    action character varying(30) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ext_support_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_support_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id character varying(255) NOT NULL,
    client_id character varying(255),
    created_by character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    session_code text NOT NULL,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ext_withdrawal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ext_withdrawal_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    visit_id uuid,
    medication_name text NOT NULL,
    batch_number text,
    target_animal_type text DEFAULT 'companion'::text NOT NULL,
    meat_withdrawal_days integer DEFAULT 0,
    milk_withdrawal_days integer DEFAULT 0,
    administered_at timestamp without time zone DEFAULT now() NOT NULL,
    safe_until timestamp without time zone NOT NULL,
    notes text,
    egg_withdrawal_days integer DEFAULT 0,
    meat_safe_until timestamp without time zone,
    milk_safe_until timestamp without time zone,
    eggs_safe_until timestamp without time zone,
    is_cascade_applied boolean DEFAULT false
);


--
-- Name: external_lab_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_lab_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    report_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    name character varying(255) NOT NULL,
    value text,
    unit character varying(64),
    reference_range character varying(255),
    flag character varying(64),
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT external_lab_observations_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT external_lab_observations_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT external_lab_observations_value_check CHECK (((sort_order >= 0) AND (length(btrim((name)::text)) > 0) AND ((value IS NULL) OR (char_length(value) <= 4000))))
);


--
-- Name: external_lab_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_lab_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid,
    attribution_status public.migration_attribution_status DEFAULT 'matched'::public.migration_attribution_status NOT NULL,
    ordered_at timestamp with time zone,
    resulted_at timestamp with time zone,
    status public.external_lab_report_status DEFAULT 'unknown'::public.external_lab_report_status NOT NULL,
    lab_name character varying(255),
    order_name character varying(255),
    accession_number character varying(160),
    summary text,
    interpretation text,
    review_status public.imported_clinical_review_status DEFAULT 'unreviewed'::public.imported_clinical_review_status NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT external_lab_reports_attribution_check CHECK ((((attribution_status = 'matched'::public.migration_attribution_status) AND (patient_id IS NOT NULL)) OR ((attribution_status = 'needs_review'::public.migration_attribution_status) AND (patient_id IS NULL)))),
    CONSTRAINT external_lab_reports_date_check CHECK (((resulted_at IS NULL) OR (ordered_at IS NULL) OR (resulted_at >= ordered_at))),
    CONSTRAINT external_lab_reports_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT external_lab_reports_review_shape_check CHECK ((((review_status = 'unreviewed'::public.imported_clinical_review_status) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)) OR ((review_status = ANY (ARRAY['confirmed'::public.imported_clinical_review_status, 'superseded'::public.imported_clinical_review_status])) AND (reviewed_at IS NOT NULL) AND (reviewed_by IS NOT NULL)))),
    CONSTRAINT external_lab_reports_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT external_lab_reports_text_length_check CHECK ((((summary IS NULL) OR (char_length(summary) <= 12000)) AND ((interpretation IS NULL) OR (char_length(interpretation) <= 12000))))
);


--
-- Name: external_prescription_fills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_prescription_fills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    filled_at timestamp with time zone,
    quantity_dispensed numeric(14,3),
    directions text,
    source_status character varying(128),
    prescriber_display_name character varying(255),
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT external_prescription_fills_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT external_prescription_fills_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT external_prescription_fills_value_check CHECK ((((quantity_dispensed IS NULL) OR (quantity_dispensed >= (0)::numeric)) AND ((directions IS NULL) OR (char_length(directions) <= 12000))))
);


--
-- Name: external_prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    medication_name character varying(255) NOT NULL,
    directions text,
    quantity numeric(14,3),
    refill_count integer,
    prescribed_at timestamp with time zone,
    expires_at timestamp with time zone,
    status public.external_prescription_status DEFAULT 'unknown'::public.external_prescription_status NOT NULL,
    is_chronic boolean DEFAULT false NOT NULL,
    prescriber_display_name character varying(255),
    review_status public.imported_clinical_review_status DEFAULT 'unreviewed'::public.imported_clinical_review_status NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT external_prescriptions_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT external_prescriptions_review_shape_check CHECK ((((review_status = 'unreviewed'::public.imported_clinical_review_status) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)) OR ((review_status = ANY (ARRAY['confirmed'::public.imported_clinical_review_status, 'superseded'::public.imported_clinical_review_status])) AND (reviewed_at IS NOT NULL) AND (reviewed_by IS NOT NULL)))),
    CONSTRAINT external_prescriptions_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT external_prescriptions_value_check CHECK (((length(btrim((medication_name)::text)) > 0) AND ((quantity IS NULL) OR (quantity >= (0)::numeric)) AND ((refill_count IS NULL) OR (refill_count >= 0)) AND ((directions IS NULL) OR (char_length(directions) <= 12000)) AND ((expires_at IS NULL) OR (prescribed_at IS NULL) OR (expires_at >= prescribed_at))))
);


--
-- Name: file_object_replicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_object_replicas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    file_id uuid NOT NULL,
    replica_target character varying(64) NOT NULL,
    object_key character varying(512) NOT NULL,
    object_etag character varying(255),
    object_version_id character varying(255),
    checksum_sha256 character varying(64),
    file_size_bytes integer,
    status public.file_replica_status DEFAULT 'pending'::public.file_replica_status NOT NULL,
    replicated_at timestamp with time zone,
    verified_at timestamp with time zone,
    failure_code character varying(64),
    attempt_count integer DEFAULT 0 NOT NULL,
    last_attempted_at timestamp with time zone,
    next_attempt_at timestamp with time zone,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    last_error_class character varying(64),
    CONSTRAINT file_object_replicas_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT file_object_replicas_available_evidence_check CHECK (((status <> 'available'::public.file_replica_status) OR ((checksum_sha256 IS NOT NULL) AND (file_size_bytes IS NOT NULL) AND (replicated_at IS NOT NULL) AND (verified_at IS NOT NULL)))),
    CONSTRAINT file_object_replicas_checksum_sha256_format_check CHECK (((checksum_sha256 IS NULL) OR ((checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT file_object_replicas_file_size_bytes_check CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT file_object_replicas_independent_object_key_check CHECK ((((replica_target)::text <> 'independent-v1'::text) OR (((object_key)::text ~ (((('^attachments/v1/'::text || (practice_id)::text) || '/'::text) || (file_id)::text) || '/(pending|[0-9a-f]{64})$'::text)) AND ((status <> 'available'::public.file_replica_status) OR ((checksum_sha256 IS NOT NULL) AND ((object_key)::text = ((((('attachments/v1/'::text || (practice_id)::text) || '/'::text) || (file_id)::text) || '/'::text) || (checksum_sha256)::text)) AND (object_version_id IS NOT NULL)))))),
    CONSTRAINT file_object_replicas_lease_coherence_check CHECK ((((lease_token IS NULL) AND (lease_expires_at IS NULL)) OR ((lease_token IS NOT NULL) AND (lease_expires_at IS NOT NULL))))
);


--
-- Name: file_storage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_storage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    file_id uuid NOT NULL,
    storage_target character varying(64) NOT NULL,
    event_key character varying(255) NOT NULL,
    operation_id uuid NOT NULL,
    event_kind character varying(64) NOT NULL,
    previous_status character varying(32),
    next_status character varying(32) NOT NULL,
    expected_checksum_sha256 character varying(64),
    observed_checksum_sha256 character varying(64),
    expected_file_size_bytes integer,
    observed_file_size_bytes integer,
    object_etag character varying(255),
    object_version_id character varying(255),
    failure_code character varying(64),
    worker_run_id uuid,
    CONSTRAINT file_storage_events_expected_checksum_format_check CHECK (((expected_checksum_sha256 IS NULL) OR ((expected_checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT file_storage_events_expected_file_size_bytes_check CHECK (((expected_file_size_bytes IS NULL) OR (expected_file_size_bytes >= 0))),
    CONSTRAINT file_storage_events_observed_checksum_format_check CHECK (((observed_checksum_sha256 IS NULL) OR ((observed_checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT file_storage_events_observed_file_size_bytes_check CHECK (((observed_file_size_bytes IS NULL) OR (observed_file_size_bytes >= 0)))
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_key character varying(512) NOT NULL,
    file_url character varying(512) NOT NULL,
    mime_type character varying(128),
    file_size_bytes integer,
    category character varying(64),
    entity_type character varying(64),
    entity_id uuid,
    appointment_id uuid,
    checksum_sha256 character varying(64),
    object_etag character varying(255),
    object_version_id character varying(255),
    storage_status public.file_storage_status DEFAULT 'unverified'::public.file_storage_status NOT NULL,
    storage_verified_at timestamp with time zone,
    title character varying(255),
    document_type character varying(64),
    document_date date,
    source character varying(64),
    idempotency_key uuid,
    patient_id uuid,
    CONSTRAINT files_appointment_requires_patient_check CHECK (((appointment_id IS NULL) OR (patient_id IS NOT NULL))),
    CONSTRAINT files_available_evidence_check CHECK (((storage_status <> 'available'::public.file_storage_status) OR ((checksum_sha256 IS NOT NULL) AND (file_size_bytes IS NOT NULL) AND (storage_verified_at IS NOT NULL)))),
    CONSTRAINT files_category_required_check CHECK ((category IS NOT NULL)),
    CONSTRAINT files_checksum_sha256_format_check CHECK (((checksum_sha256 IS NULL) OR ((checksum_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT files_file_size_bytes_check CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
    CONSTRAINT files_patient_entity_consistency_check CHECK ((((entity_type)::text IS DISTINCT FROM 'patient'::text) OR ((patient_id IS NOT NULL) AND (entity_id IS NOT NULL) AND (entity_id = patient_id)))),
    CONSTRAINT files_primary_namespace_check CHECK ((((category)::text = ANY ((ARRAY['patient-photos'::character varying, 'documents'::character varying, 'lab-results'::character varying, 'branding'::character varying, 'consents'::character varying, 'imaging'::character varying])::text[])) AND ((file_key)::text ~ (((('^'::text || (practice_id)::text) || '/'::text) || (category)::text) || '/[^/]+$'::text)) AND ((file_url)::text = ('/api/files/'::text || (file_key)::text))))
);


--
-- Name: financial_closes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_closes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    business_date date NOT NULL,
    timezone character varying(64) NOT NULL,
    cutoff_at timestamp with time zone NOT NULL,
    closed_by uuid NOT NULL,
    payment_count integer NOT NULL,
    gross_receipts_cents integer NOT NULL,
    refunds_cents integer NOT NULL,
    net_receipts_cents integer NOT NULL,
    cash_cents integer NOT NULL,
    check_cents integer NOT NULL,
    card_and_online_cents integer NOT NULL,
    other_cents integer NOT NULL,
    processor_gross_cents integer NOT NULL,
    processor_fee_cents integer NOT NULL,
    application_fee_cents integer NOT NULL,
    clinic_net_cents integer NOT NULL,
    paid_out_cents integer NOT NULL,
    open_dispute_cents integer NOT NULL,
    unreconciled_count integer NOT NULL,
    CONSTRAINT financial_closes_counts_check CHECK (((payment_count >= 0) AND (unreconciled_count >= 0))),
    CONSTRAINT financial_closes_nonnegative_check CHECK (((gross_receipts_cents >= 0) AND (refunds_cents >= 0) AND (processor_gross_cents >= 0) AND (processor_fee_cents >= 0) AND (application_fee_cents >= 0) AND (clinic_net_cents >= 0) AND (paid_out_cents >= 0) AND (open_dispute_cents >= 0))),
    CONSTRAINT financial_closes_processor_identity_check CHECK ((processor_gross_cents = ((processor_fee_cents + application_fee_cents) + clinic_net_cents))),
    CONSTRAINT financial_closes_receipt_identity_check CHECK ((net_receipts_cents = (gross_receipts_cents - refunds_cents)))
);


--
-- Name: funnel_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    event_name character varying(64) NOT NULL,
    anonymous_id character varying(64),
    practice_id uuid,
    source character varying(80),
    path character varying(500),
    origin character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: historical_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historical_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone NOT NULL,
    status public.historical_appointment_status DEFAULT 'unknown'::public.historical_appointment_status NOT NULL,
    appointment_type character varying(255),
    provider_display_name character varying(255),
    reason text,
    notes text,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT historical_appointments_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT historical_appointments_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT historical_appointments_text_length_check CHECK ((((reason IS NULL) OR (char_length(reason) <= 4000)) AND ((notes IS NULL) OR (char_length(notes) <= 12000)))),
    CONSTRAINT historical_appointments_time_check CHECK ((started_at < ended_at))
);


--
-- Name: historical_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historical_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    file_id uuid NOT NULL,
    patient_id uuid,
    kind public.historical_document_kind DEFAULT 'other'::public.historical_document_kind NOT NULL,
    link_status public.historical_document_link_status DEFAULT 'needs_review'::public.historical_document_link_status NOT NULL,
    title character varying(255) NOT NULL,
    document_date date,
    lab_report_id uuid,
    prescription_id uuid,
    historical_appointment_id uuid,
    financial_document_id uuid,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT historical_documents_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT historical_documents_kind_shape_check CHECK ((((kind <> 'lab_report'::public.historical_document_kind) OR (lab_report_id IS NOT NULL)) AND ((kind <> 'prescription'::public.historical_document_kind) OR (prescription_id IS NOT NULL)) AND ((kind <> 'appointment'::public.historical_document_kind) OR (historical_appointment_id IS NOT NULL)) AND ((kind <> 'financial'::public.historical_document_kind) OR (financial_document_id IS NOT NULL)))),
    CONSTRAINT historical_documents_link_shape_check CHECK ((((link_status = 'needs_review'::public.historical_document_link_status) AND (patient_id IS NULL) AND (lab_report_id IS NULL) AND (prescription_id IS NULL) AND (historical_appointment_id IS NULL) AND (financial_document_id IS NULL)) OR ((link_status = 'linked'::public.historical_document_link_status) AND (patient_id IS NOT NULL)))),
    CONSTRAINT historical_documents_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))
);


--
-- Name: insurance_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    invoice_id uuid,
    claim_number character varying(128),
    status public.claim_status DEFAULT 'draft'::public.claim_status NOT NULL,
    claim_amount numeric(10,2) NOT NULL,
    approved_amount numeric(10,2),
    denied_reason text,
    submitted_at timestamp with time zone,
    resolved_at timestamp with time zone,
    notes text
);


--
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    provider_name character varying(255) NOT NULL,
    policy_number character varying(128),
    group_number character varying(128),
    phone_number character varying(32),
    coverage_type character varying(128),
    deductible numeric(10,2),
    coverage_percent integer,
    max_annual_benefit numeric(10,2),
    effective_date date,
    expiration_date date,
    notes text
);


--
-- Name: invoice_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    invoice_id uuid NOT NULL,
    type public.invoice_adjustment_type NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text,
    created_by uuid,
    operation_key character varying(160),
    balance_after numeric(10,2),
    CONSTRAINT invoice_adjustments_operation_result_check CHECK ((((operation_key IS NULL) AND (balance_after IS NULL)) OR ((operation_key IS NOT NULL) AND (balance_after IS NOT NULL) AND (balance_after >= (0)::numeric))))
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    invoice_id uuid NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(13,3) DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    item_type public.invoice_item_type NOT NULL,
    item_id uuid,
    source_prescription_id uuid,
    source_dispense_charge_id uuid,
    taxable boolean DEFAULT true NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    appointment_id uuid,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    subtotal numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    paid_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    due_date date,
    is_estimate boolean DEFAULT false NOT NULL
);


--
-- Name: kvl_cr_passports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kvl_cr_passports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    issued_by uuid NOT NULL,
    passport_number character varying(32) NOT NULL,
    issued_at date NOT NULL,
    issuing_clinic_name text,
    issuing_vet_name text,
    issuing_vet_kvl_cr character varying(64),
    microchip_number character varying(32),
    rabies_vaccine_name character varying(128),
    rabies_batch_number character varying(64),
    rabies_administered_at date,
    rabies_valid_until date,
    travel_eligible_from date,
    notes text
);


--
-- Name: lab_analyzer_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_analyzer_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    patient_id uuid,
    client_id uuid,
    reviewed_by_id uuid,
    analyzer_type public.analyzer_type DEFAULT 'GENERIC_CSV'::public.analyzer_type NOT NULL,
    device_model character varying(128),
    sample_id character varying(128),
    sample_date timestamp with time zone,
    species character varying(32),
    file_name character varying(255),
    raw_content text,
    parsed_results jsonb NOT NULL,
    abnormal_count integer DEFAULT 0 NOT NULL,
    critical_count integer DEFAULT 0 NOT NULL,
    status public.lab_report_status DEFAULT 'UNASSIGNED'::public.lab_report_status NOT NULL,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lab_result_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_result_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    lab_result_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    event_type public.lab_result_event_type NOT NULL,
    status_before public.lab_status,
    status_after public.lab_status NOT NULL,
    result_value character varying(128),
    unit character varying(32),
    reference_range_low numeric(10,3),
    reference_range_high numeric(10,3),
    result_flag public.lab_result_flag NOT NULL,
    follow_up_status public.lab_follow_up_status DEFAULT 'not_required'::public.lab_follow_up_status NOT NULL,
    follow_up_assigned_to uuid,
    follow_up_due_at timestamp with time zone,
    actor_id uuid NOT NULL,
    actor_name character varying(255) NOT NULL,
    note text,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    CONSTRAINT lab_result_events_shape_check CHECK ((((length(btrim((actor_name)::text)) >= 1) AND (length(btrim((actor_name)::text)) <= 255)) AND ((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text) AND ((note IS NULL) OR (length(note) <= 1000)) AND ((status_after <> 'pending'::public.lab_status) OR (follow_up_status = 'not_required'::public.lab_follow_up_status)) AND (NOT ((status_after = 'reviewed'::public.lab_status) AND (result_flag = 'critical'::public.lab_result_flag) AND (follow_up_status = 'not_required'::public.lab_follow_up_status))) AND (NOT ((result_flag = 'critical'::public.lab_result_flag) AND (follow_up_status = ANY (ARRAY['open'::public.lab_follow_up_status, 'completed'::public.lab_follow_up_status])) AND (follow_up_due_at IS NULL))) AND (((status_after = 'pending'::public.lab_status) AND (result_value IS NULL) AND (unit IS NULL) AND (reference_range_low IS NULL) AND (reference_range_high IS NULL) AND (result_flag = 'unknown'::public.lab_result_flag)) OR ((status_after = ANY (ARRAY['completed'::public.lab_status, 'reviewed'::public.lab_status])) AND ((length(btrim((COALESCE(result_value, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(result_value, ''::character varying))::text)) <= 128)))) AND (((follow_up_status = 'not_required'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NULL) AND (follow_up_due_at IS NULL)) OR ((follow_up_status = ANY (ARRAY['open'::public.lab_follow_up_status, 'completed'::public.lab_follow_up_status])) AND (follow_up_assigned_to IS NOT NULL))) AND (((event_type = 'created'::public.lab_result_event_type) AND (status_before IS NULL) AND (status_after = ANY (ARRAY['pending'::public.lab_status, 'completed'::public.lab_status])) AND ((status_after <> 'pending'::public.lab_status) OR (result_flag = 'unknown'::public.lab_result_flag))) OR ((event_type = 'completed'::public.lab_result_event_type) AND (status_before = 'pending'::public.lab_status) AND (status_after = 'completed'::public.lab_status)) OR ((event_type = 'reviewed'::public.lab_result_event_type) AND (status_before = 'completed'::public.lab_status) AND (status_after = 'reviewed'::public.lab_status)) OR ((event_type = ANY (ARRAY['follow_up_assigned'::public.lab_result_event_type, 'follow_up_reassigned'::public.lab_result_event_type])) AND (status_before = status_after) AND (follow_up_status = 'open'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NOT NULL)) OR ((event_type = 'follow_up_completed'::public.lab_result_event_type) AND (status_before = status_after) AND (follow_up_status = 'completed'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NOT NULL) AND ((length(btrim(COALESCE(note, ''::text))) >= 3) AND (length(btrim(COALESCE(note, ''::text))) <= 1000))))))
);


--
-- Name: lab_result_replacements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_result_replacements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    correction_id uuid NOT NULL,
    source_lab_result_id uuid NOT NULL,
    replacement_lab_result_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_name character varying(255) NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    CONSTRAINT lab_result_replacements_shape_check CHECK (((source_lab_result_id <> replacement_lab_result_id) AND ((length(btrim((actor_name)::text)) >= 1) AND (length(btrim((actor_name)::text)) <= 255)) AND ((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    test_name character varying(255) NOT NULL,
    result_value character varying(128),
    unit character varying(32),
    reference_range_low numeric(10,3),
    reference_range_high numeric(10,3),
    status public.lab_status DEFAULT 'pending'::public.lab_status NOT NULL,
    ordered_by uuid,
    reviewed_by uuid,
    creation_operation_id uuid,
    creation_payload_hash character varying(64),
    result_flag public.lab_result_flag DEFAULT 'unknown'::public.lab_result_flag NOT NULL,
    completed_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    follow_up_status public.lab_follow_up_status DEFAULT 'not_required'::public.lab_follow_up_status NOT NULL,
    follow_up_assigned_to uuid,
    follow_up_due_at timestamp with time zone,
    follow_up_note character varying(1000),
    follow_up_completed_by uuid,
    follow_up_completed_at timestamp with time zone,
    follow_up_outcome character varying(1000),
    CONSTRAINT lab_results_creation_operation_shape_check CHECK ((((creation_operation_id IS NULL) AND (creation_payload_hash IS NULL)) OR ((creation_operation_id IS NOT NULL) AND ((creation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)))),
    CONSTRAINT lab_results_follow_up_shape_check CHECK ((((status <> 'pending'::public.lab_status) OR (follow_up_status = 'not_required'::public.lab_follow_up_status)) AND (NOT ((status = 'reviewed'::public.lab_status) AND (result_flag = 'critical'::public.lab_result_flag) AND (follow_up_status = 'not_required'::public.lab_follow_up_status))) AND (NOT ((result_flag = 'critical'::public.lab_result_flag) AND (follow_up_status = ANY (ARRAY['open'::public.lab_follow_up_status, 'completed'::public.lab_follow_up_status])) AND (follow_up_due_at IS NULL))) AND (((follow_up_status = 'not_required'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NULL) AND (follow_up_due_at IS NULL) AND (follow_up_note IS NULL) AND (follow_up_completed_by IS NULL) AND (follow_up_completed_at IS NULL) AND (follow_up_outcome IS NULL)) OR ((follow_up_status = 'open'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NOT NULL) AND (follow_up_completed_by IS NULL) AND (follow_up_completed_at IS NULL) AND (follow_up_outcome IS NULL)) OR ((follow_up_status = 'completed'::public.lab_follow_up_status) AND (follow_up_assigned_to IS NOT NULL) AND (follow_up_completed_by IS NOT NULL) AND (follow_up_completed_at IS NOT NULL) AND ((length(btrim((COALESCE(follow_up_outcome, ''::character varying))::text)) >= 3) AND (length(btrim((COALESCE(follow_up_outcome, ''::character varying))::text)) <= 1000)))))),
    CONSTRAINT lab_results_lifecycle_shape_check CHECK ((((status = 'pending'::public.lab_status) AND (completed_at IS NULL) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)) OR ((status = 'completed'::public.lab_status) AND (completed_at IS NOT NULL) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)) OR ((status = 'reviewed'::public.lab_status) AND (completed_at IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (reviewed_by IS NOT NULL)))),
    CONSTRAINT lab_results_result_shape_check CHECK ((((status = 'pending'::public.lab_status) AND (result_value IS NULL) AND (unit IS NULL) AND (reference_range_low IS NULL) AND (reference_range_high IS NULL) AND (result_flag = 'unknown'::public.lab_result_flag)) OR ((status = ANY (ARRAY['completed'::public.lab_status, 'reviewed'::public.lab_status])) AND (length(btrim((COALESCE(result_value, ''::character varying))::text)) > 0))))
);


--
-- Name: legacy_financial_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_financial_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    document_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    allocated_at timestamp with time zone,
    description character varying(500),
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT legacy_financial_allocations_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT legacy_financial_allocations_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT legacy_financial_allocations_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))
);


--
-- Name: legacy_financial_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_financial_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    document_type public.legacy_financial_document_type DEFAULT 'invoice'::public.legacy_financial_document_type NOT NULL,
    document_number character varying(160),
    issued_at timestamp with time zone NOT NULL,
    due_date date,
    status public.legacy_financial_document_status DEFAULT 'unknown'::public.legacy_financial_document_status NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    subtotal numeric(14,2) NOT NULL,
    tax numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    balance numeric(14,2) NOT NULL,
    source_status character varying(128),
    note text,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT legacy_financial_documents_amount_check CHECK (((subtotal >= (0)::numeric) AND (tax >= (0)::numeric) AND (discount >= (0)::numeric) AND (total >= (0)::numeric) AND (paid_amount >= (0)::numeric) AND (balance >= (0)::numeric))),
    CONSTRAINT legacy_financial_documents_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT legacy_financial_documents_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT legacy_financial_documents_note_check CHECK (((note IS NULL) OR (char_length(note) <= 12000))),
    CONSTRAINT legacy_financial_documents_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))
);


--
-- Name: legacy_financial_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_financial_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    document_id uuid NOT NULL,
    patient_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    subtotal numeric(14,2) NOT NULL,
    tax numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(14,2) NOT NULL,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT legacy_financial_line_items_amount_check CHECK (((sort_order >= 0) AND (quantity >= (0)::numeric) AND (unit_price >= (0)::numeric) AND (subtotal >= (0)::numeric) AND (tax >= (0)::numeric) AND (discount >= (0)::numeric) AND (total >= (0)::numeric))),
    CONSTRAINT legacy_financial_line_items_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT legacy_financial_line_items_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))
);


--
-- Name: legacy_financial_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_financial_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid,
    attribution_status public.migration_attribution_status DEFAULT 'matched'::public.migration_attribution_status NOT NULL,
    entry_type public.legacy_financial_payment_type DEFAULT 'payment'::public.legacy_financial_payment_type NOT NULL,
    amount numeric(14,2) NOT NULL,
    received_at timestamp with time zone NOT NULL,
    method character varying(128),
    source_status character varying(128),
    reference character varying(255),
    note text,
    external_source character varying(64) NOT NULL,
    external_id character varying(160) NOT NULL,
    import_fingerprint character varying(64) NOT NULL,
    CONSTRAINT legacy_financial_payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT legacy_financial_payments_attribution_check CHECK ((((attribution_status = 'matched'::public.migration_attribution_status) AND (client_id IS NOT NULL)) OR ((attribution_status = 'needs_review'::public.migration_attribution_status) AND (client_id IS NULL)))),
    CONSTRAINT legacy_financial_payments_fingerprint_check CHECK (((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT legacy_financial_payments_note_check CHECK (((note IS NULL) OR (char_length(note) <= 4000))),
    CONSTRAINT legacy_financial_payments_source_check CHECK (((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))
);


--
-- Name: location_messaging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_messaging (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    location_id uuid NOT NULL,
    provider character varying(16) DEFAULT 'telnyx'::character varying NOT NULL,
    messaging_profile_id character varying(128),
    sender_e164 character varying(16),
    number_source public.messaging_number_source,
    a2p_brand_id character varying(128),
    a2p_campaign_id character varying(128),
    registration_status public.messaging_registration_status DEFAULT 'not_started'::public.messaging_registration_status NOT NULL,
    registration_detail text,
    enabled boolean DEFAULT false NOT NULL,
    provider_profile_ready boolean DEFAULT false NOT NULL,
    provider_profile_synced_at timestamp with time zone
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    phone character varying(32),
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: messaging_registration_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_registration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    location_id uuid,
    event_type public.messaging_registration_event_type NOT NULL,
    operation public.messaging_registration_operation NOT NULL,
    status_before public.messaging_registration_status,
    status_after public.messaging_registration_status NOT NULL,
    provider character varying(16) NOT NULL,
    provider_brand_id character varying(128),
    provider_campaign_id character varying(128),
    messaging_profile_id character varying(128),
    provider_brand_status character varying(64),
    provider_campaign_status character varying(64),
    actor_type public.messaging_registration_actor_type NOT NULL,
    actor_user_id uuid,
    actor_identity character varying(255),
    actor_name character varying(255) NOT NULL,
    operation_id uuid NOT NULL,
    reason_code character varying(64) NOT NULL,
    CONSTRAINT messaging_registration_events_shape_check CHECK ((((provider)::text = ANY ((ARRAY['telnyx'::character varying, 'twilio'::character varying])::text[])) AND ((reason_code)::text ~ '^[a-z0-9_]{3,64}$'::text) AND ((actor_name)::text = btrim((actor_name)::text)) AND ((length((actor_name)::text) >= 1) AND (length((actor_name)::text) <= 255)) AND (((actor_type = 'clinic_user'::public.messaging_registration_actor_type) AND (actor_user_id IS NOT NULL) AND (actor_identity IS NULL)) OR ((actor_type = 'platform_operator'::public.messaging_registration_actor_type) AND (actor_user_id IS NULL) AND ((length(btrim((COALESCE(actor_identity, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(actor_identity, ''::character varying))::text)) <= 255))) OR ((actor_type = 'system'::public.messaging_registration_actor_type) AND (actor_user_id IS NULL) AND (actor_identity IS NULL))) AND ((provider_brand_id IS NULL) OR (((provider_brand_id)::text = btrim((provider_brand_id)::text)) AND ((length((provider_brand_id)::text) >= 3) AND (length((provider_brand_id)::text) <= 128)))) AND ((provider_campaign_id IS NULL) OR (((provider_campaign_id)::text = btrim((provider_campaign_id)::text)) AND ((length((provider_campaign_id)::text) >= 3) AND (length((provider_campaign_id)::text) <= 128)))) AND ((messaging_profile_id IS NULL) OR (((messaging_profile_id)::text = btrim((messaging_profile_id)::text)) AND ((length((messaging_profile_id)::text) >= 3) AND (length((messaging_profile_id)::text) <= 128)))) AND ((provider_brand_status IS NULL) OR ((length((provider_brand_status)::text) >= 1) AND (length((provider_brand_status)::text) <= 64))) AND ((provider_campaign_status IS NULL) OR ((length((provider_campaign_status)::text) >= 1) AND (length((provider_campaign_status)::text) <= 64))) AND (((event_type = 'details_saved'::public.messaging_registration_event_type) AND (operation = 'registration_details'::public.messaging_registration_operation)) OR ((event_type = ANY (ARRAY['provider_operation_started'::public.messaging_registration_event_type, 'provider_operation_succeeded'::public.messaging_registration_event_type, 'provider_operation_failed'::public.messaging_registration_event_type])) AND (operation = ANY (ARRAY['brand_submission'::public.messaging_registration_operation, 'campaign_submission'::public.messaging_registration_operation, 'number_assignment'::public.messaging_registration_operation]))) OR ((event_type = 'provider_state_observed'::public.messaging_registration_event_type) AND (operation = ANY (ARRAY['brand_submission'::public.messaging_registration_operation, 'campaign_submission'::public.messaging_registration_operation, 'registration_reconciliation'::public.messaging_registration_operation]))) OR ((event_type = 'provider_ids_attached'::public.messaging_registration_event_type) AND (operation = 'provider_id_recovery'::public.messaging_registration_operation)) OR ((event_type = 'stale_lock_cleared'::public.messaging_registration_event_type) AND (operation = 'submission_lock_recovery'::public.messaging_registration_operation)) OR ((event_type = 'provider_profile_enabled'::public.messaging_registration_event_type) AND (operation = 'profile_activation'::public.messaging_registration_operation) AND (location_id IS NOT NULL) AND (messaging_profile_id IS NOT NULL)) OR ((event_type = 'provider_profile_disabled'::public.messaging_registration_event_type) AND (operation = 'profile_deactivation'::public.messaging_registration_operation) AND (location_id IS NOT NULL) AND (messaging_profile_id IS NOT NULL)) OR ((event_type = 'provider_profile_verified'::public.messaging_registration_event_type) AND (operation = 'profile_verification'::public.messaging_registration_operation) AND (location_id IS NOT NULL) AND (messaging_profile_id IS NOT NULL)))))
);


--
-- Name: messaging_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    provider character varying(16) DEFAULT 'telnyx'::character varying NOT NULL,
    entity_type public.messaging_business_entity_type NOT NULL,
    display_name character varying(100) NOT NULL,
    legal_name character varying(100) NOT NULL,
    tax_id_encrypted text NOT NULL,
    tax_id_last4 character varying(4) NOT NULL,
    contact_first_name character varying(100) NOT NULL,
    contact_last_name character varying(100) NOT NULL,
    contact_email character varying(100) NOT NULL,
    business_phone character varying(20) NOT NULL,
    street character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(2) NOT NULL,
    postal_code character varying(10) NOT NULL,
    country character varying(2) DEFAULT 'US'::character varying NOT NULL,
    website character varying(100) NOT NULL,
    privacy_policy_url character varying(500) NOT NULL,
    terms_url character varying(500) NOT NULL,
    campaign_usecase character varying(50) DEFAULT 'MIXED'::character varying NOT NULL,
    status public.messaging_registration_status DEFAULT 'not_started'::public.messaging_registration_status NOT NULL,
    status_detail text,
    provider_brand_id character varying(128),
    provider_brand_status character varying(64),
    provider_campaign_id character varying(128),
    provider_campaign_status character varying(64),
    submission_lock_id uuid,
    submission_lock_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_submitted_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    last_error text,
    compliance_attested_at timestamp with time zone NOT NULL,
    compliance_attested_by uuid NOT NULL,
    CONSTRAINT messaging_registrations_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT messaging_registrations_tax_id_last4_check CHECK (((tax_id_last4)::text ~ '^[0-9]{4}$'::text)),
    CONSTRAINT messaging_registrations_us_country_check CHECK (((country)::text = 'US'::text)),
    CONSTRAINT messaging_registrations_us_state_check CHECK (((state)::text ~ '^[A-Z]{2}$'::text))
);


--
-- Name: microchip_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.microchip_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    veterinarian_id uuid NOT NULL,
    microchip_number character varying(32) NOT NULL,
    location public.microchip_location DEFAULT 'LEFT_NECK'::public.microchip_location NOT NULL,
    custom_location text,
    implanted_at date NOT NULL,
    verified_before_implant character varying(8) DEFAULT 'YES'::character varying,
    verified_after_implant character varying(8) DEFAULT 'YES'::character varying,
    vet_kvl_number character varying(64),
    crsz_status public.crsz_registration_status DEFAULT 'NOT_REGISTERED'::public.crsz_registration_status NOT NULL,
    crsz_registered_at timestamp with time zone,
    crsz_record_id character varying(128),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: migration_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    created_by uuid NOT NULL,
    mode public.migration_run_mode NOT NULL,
    source character varying(64) NOT NULL,
    file_hash character varying(64) NOT NULL,
    file_size_bytes integer NOT NULL,
    status public.migration_run_status DEFAULT 'previewed'::public.migration_run_status NOT NULL,
    source_row_count integer DEFAULT 0 NOT NULL,
    planned_insert_count integer DEFAULT 0 NOT NULL,
    planned_reconcile_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    unmatched_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    imported_count integer DEFAULT 0 NOT NULL,
    reconciled_count integer DEFAULT 0 NOT NULL,
    preview_expires_at timestamp with time zone NOT NULL,
    superseded_at timestamp with time zone,
    committed_at timestamp with time zone,
    committed_by uuid,
    reviewed_plan_hash character varying(64) NOT NULL,
    CONSTRAINT migration_runs_committed_state_check CHECK (((status <> 'committed'::public.migration_run_status) OR ((committed_at IS NOT NULL) AND (committed_by IS NOT NULL)))),
    CONSTRAINT migration_runs_counts_check CHECK (((source_row_count >= 0) AND (planned_insert_count >= 0) AND (planned_reconcile_count >= 0) AND (duplicate_count >= 0) AND (unmatched_count >= 0) AND (error_count >= 0) AND (imported_count >= 0) AND (reconciled_count >= 0))),
    CONSTRAINT migration_runs_file_hash_check CHECK (((file_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT migration_runs_file_size_check CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 5000000))),
    CONSTRAINT migration_runs_preview_expiry_check CHECK ((preview_expires_at > created_at)),
    CONSTRAINT migration_runs_reviewed_plan_hash_check CHECK (((reviewed_plan_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT migration_runs_source_check CHECK (((source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT migration_runs_superseded_state_check CHECK (((status <> 'superseded'::public.migration_run_status) OR ((superseded_at IS NOT NULL) AND (committed_at IS NULL) AND (committed_by IS NULL))))
);


--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    patient_id uuid NOT NULL,
    allergen character varying(255) NOT NULL,
    reaction text,
    severity public.allergy_severity DEFAULT 'moderate'::public.allergy_severity NOT NULL,
    noted_by uuid,
    noted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_merge_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_merge_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    source_patient_id uuid NOT NULL,
    target_patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    performed_by uuid NOT NULL,
    performed_by_name character varying(255) NOT NULL,
    reason character varying(500) NOT NULL,
    operation_id uuid NOT NULL,
    source_snapshot jsonb NOT NULL,
    target_snapshot jsonb NOT NULL,
    CONSTRAINT patient_merge_events_attribution_check CHECK (((length(btrim((performed_by_name)::text)) >= 1) AND (length(btrim((performed_by_name)::text)) <= 255))),
    CONSTRAINT patient_merge_events_different_patients_check CHECK ((source_patient_id <> target_patient_id)),
    CONSTRAINT patient_merge_events_reason_check CHECK (((length(btrim((reason)::text)) >= 5) AND (length(btrim((reason)::text)) <= 500))),
    CONSTRAINT patient_merge_events_snapshots_check CHECK (((jsonb_typeof(source_snapshot) = 'object'::text) AND (jsonb_typeof(target_snapshot) = 'object'::text)))
);


--
-- Name: patient_weights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_weights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    patient_id uuid NOT NULL,
    weight_kg numeric(8,3) NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    species public.species NOT NULL,
    breed character varying(128),
    sex public.sex,
    dob date,
    color character varying(64),
    microchip_number character varying(64),
    photo_url character varying(512),
    status public.patient_status DEFAULT 'active'::public.patient_status NOT NULL,
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    CONSTRAINT patients_external_identity_pair_check CHECK (((external_source IS NULL) = (external_id IS NULL))),
    CONSTRAINT patients_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: payment_disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    settlement_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'stripe_connect'::character varying NOT NULL,
    external_dispute_id character varying(128) NOT NULL,
    charge_id character varying(128) NOT NULL,
    status character varying(48) NOT NULL,
    amount_cents integer NOT NULL,
    currency character varying(3) NOT NULL,
    reason character varying(64),
    evidence_due_by timestamp with time zone,
    provider_created_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    last_synced_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_disputes_amount_check CHECK (((amount_cents > 0) AND ((currency)::text ~ '^[a-z]{3}$'::text)))
);


--
-- Name: payment_processor_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_processor_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'stripe_connect'::character varying NOT NULL,
    connected_account_id character varying(128) NOT NULL,
    external_payout_id character varying(128) NOT NULL,
    currency character varying(3) NOT NULL,
    amount_cents integer NOT NULL,
    status character varying(24) NOT NULL,
    automatic boolean NOT NULL,
    reconciliation_complete boolean DEFAULT false NOT NULL,
    arrival_at timestamp with time zone NOT NULL,
    provider_created_at timestamp with time zone NOT NULL,
    failure_code character varying(64),
    failure_message character varying(500),
    last_synced_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_processor_payouts_amount_check CHECK (((amount_cents > 0) AND ((currency)::text ~ '^[a-z]{3}$'::text))),
    CONSTRAINT payment_processor_payouts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_transit'::character varying, 'paid'::character varying, 'failed'::character varying, 'canceled'::character varying])::text[])))
);


--
-- Name: payment_processor_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_processor_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    settlement_id uuid,
    original_payment_id uuid NOT NULL,
    refund_payment_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'stripe_connect'::character varying NOT NULL,
    connected_account_id character varying(128),
    external_refund_id character varying(128) NOT NULL,
    balance_transaction_id character varying(128),
    currency character varying(3) NOT NULL,
    amount_cents integer NOT NULL,
    balance_amount_cents integer,
    balance_fee_cents integer,
    balance_net_cents integer,
    status character varying(24) NOT NULL,
    provider_created_at timestamp with time zone NOT NULL,
    last_synced_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_processor_refunds_amount_check CHECK (((amount_cents > 0) AND ((currency)::text ~ '^[a-z]{3}$'::text) AND ((balance_amount_cents IS NULL) OR (balance_amount_cents <= 0)) AND ((balance_fee_cents IS NULL) OR (balance_fee_cents >= 0)) AND ((balance_net_cents IS NULL) OR (balance_net_cents <= 0)))),
    CONSTRAINT payment_processor_refunds_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'requires_action'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'canceled'::character varying])::text[])))
);


--
-- Name: payment_processor_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_processor_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'stripe_connect'::character varying NOT NULL,
    connected_account_id character varying(128) NOT NULL,
    checkout_session_id character varying(128) NOT NULL,
    payment_intent_id character varying(128) NOT NULL,
    charge_id character varying(128) NOT NULL,
    balance_transaction_id character varying(128) NOT NULL,
    currency character varying(3) NOT NULL,
    gross_amount_cents integer NOT NULL,
    processor_fee_cents integer NOT NULL,
    application_fee_cents integer NOT NULL,
    clinic_net_cents integer NOT NULL,
    balance_status character varying(24) NOT NULL,
    available_on timestamp with time zone,
    payout_id character varying(128),
    payout_status character varying(24) DEFAULT 'unassigned'::character varying NOT NULL,
    reconciled_at timestamp with time zone NOT NULL,
    last_synced_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_processor_settlements_amounts_check CHECK (((gross_amount_cents > 0) AND (processor_fee_cents >= 0) AND (application_fee_cents >= 0) AND (clinic_net_cents >= 0) AND (gross_amount_cents = ((processor_fee_cents + application_fee_cents) + clinic_net_cents)))),
    CONSTRAINT payment_processor_settlements_currency_check CHECK (((currency)::text ~ '^[a-z]{3}$'::text)),
    CONSTRAINT payment_processor_settlements_status_check CHECK ((((balance_status)::text = ANY ((ARRAY['pending'::character varying, 'available'::character varying])::text[])) AND ((payout_status)::text = ANY ((ARRAY['unassigned'::character varying, 'pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'canceled'::character varying])::text[]))))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    invoice_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    method public.payment_method NOT NULL,
    received_by uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    external_id character varying(160),
    notes text
);


--
-- Name: pet_passports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_passports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    client_id uuid NOT NULL,
    issued_by uuid NOT NULL,
    passport_number character varying(32) NOT NULL,
    issued_at date NOT NULL,
    issuing_clinic_name text,
    issuing_vet_name text,
    issuing_vet_kvl character varying(64),
    rabies_vaccine_name character varying(128),
    rabies_batch_number character varying(64),
    rabies_administered_at date,
    rabies_valid_until date,
    travel_eligible_from date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    vaccination_record_id uuid
);


--
-- Name: platform_email_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_email_identity (
    key_slot integer DEFAULT 1 NOT NULL,
    identity_key_fingerprint character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_identity_key_fingerprint character varying(64),
    rotation_started_at timestamp with time zone,
    CONSTRAINT platform_email_identity_distinct_fingerprints_check CHECK (((previous_identity_key_fingerprint IS NULL) OR ((previous_identity_key_fingerprint)::text <> (identity_key_fingerprint)::text))),
    CONSTRAINT platform_email_identity_fingerprint_check CHECK (((identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_identity_previous_fingerprint_check CHECK (((previous_identity_key_fingerprint IS NULL) OR ((previous_identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT platform_email_identity_rotation_state_check CHECK (((previous_identity_key_fingerprint IS NULL) = (rotation_started_at IS NULL))),
    CONSTRAINT platform_email_identity_singleton_check CHECK ((key_slot = 1))
);


--
-- Name: platform_email_identity_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_email_identity_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    current_identity_key_fingerprint character varying(64) NOT NULL,
    current_email_hash character varying(64) NOT NULL,
    previous_identity_key_fingerprint character varying(64) NOT NULL,
    previous_email_hash character varying(64) NOT NULL,
    CONSTRAINT platform_email_identity_aliases_current_fingerprint_check CHECK (((current_identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_identity_aliases_current_hash_check CHECK (((current_email_hash)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_identity_aliases_distinct_fingerprints_check CHECK (((current_identity_key_fingerprint)::text <> (previous_identity_key_fingerprint)::text)),
    CONSTRAINT platform_email_identity_aliases_distinct_hashes_check CHECK (((current_email_hash)::text <> (previous_email_hash)::text)),
    CONSTRAINT platform_email_identity_aliases_previous_fingerprint_check CHECK (((previous_identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_identity_aliases_previous_hash_check CHECK (((previous_email_hash)::text ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: platform_email_preference_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_email_preference_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email_hash character varying(64) NOT NULL,
    identity_key_fingerprint character varying(64) NOT NULL,
    requested_marketing_enabled boolean NOT NULL,
    applied boolean NOT NULL,
    source character varying(32) NOT NULL,
    reason character varying(32) NOT NULL,
    updated_by_user_id uuid,
    provider_event_key_hash character varying(64),
    CONSTRAINT platform_email_preference_events_email_hash_check CHECK (((email_hash)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_preference_events_identity_fingerprint_check CHECK (((identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_preference_events_provider_event_key_hash_check CHECK (((provider_event_key_hash IS NULL) OR ((provider_event_key_hash)::text ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT platform_email_preference_events_reason_check CHECK (((reason)::text = ANY ((ARRAY['settings_enabled'::character varying, 'settings_disabled'::character varying, 'unsubscribe'::character varying, 'complaint'::character varying, 'bounce'::character varying, 'provider_suppressed'::character varying])::text[]))),
    CONSTRAINT platform_email_preference_events_request_state_check CHECK (((requested_marketing_enabled AND ((reason)::text = 'settings_enabled'::text)) OR ((NOT requested_marketing_enabled) AND ((reason)::text <> 'settings_enabled'::text)))),
    CONSTRAINT platform_email_preference_events_source_check CHECK (((source)::text = ANY ((ARRAY['settings'::character varying, 'unsubscribe_link'::character varying, 'resend_webhook'::character varying])::text[])))
);


--
-- Name: platform_email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_email_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    email_hash character varying(64) NOT NULL,
    identity_key_fingerprint character varying(64) NOT NULL,
    marketing_enabled boolean NOT NULL,
    source character varying(32) NOT NULL,
    reason character varying(32) NOT NULL,
    updated_by_user_id uuid,
    CONSTRAINT platform_email_preferences_email_hash_check CHECK (((email_hash)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_preferences_identity_fingerprint_check CHECK (((identity_key_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT platform_email_preferences_reason_check CHECK (((reason)::text = ANY ((ARRAY['settings_enabled'::character varying, 'settings_disabled'::character varying, 'unsubscribe'::character varying, 'complaint'::character varying, 'bounce'::character varying, 'provider_suppressed'::character varying])::text[]))),
    CONSTRAINT platform_email_preferences_source_check CHECK (((source)::text = ANY ((ARRAY['settings'::character varying, 'unsubscribe_link'::character varying, 'resend_webhook'::character varying])::text[]))),
    CONSTRAINT platform_email_preferences_state_check CHECK (((marketing_enabled AND ((reason)::text = 'settings_enabled'::text)) OR ((NOT marketing_enabled) AND ((reason)::text <> 'settings_enabled'::text))))
);


--
-- Name: portal_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason character varying(48),
    created_ip_hash character varying(64),
    user_agent_hash character varying(64)
);


--
-- Name: practice_conversion_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_conversion_milestones (
    practice_id uuid NOT NULL,
    milestone public.practice_conversion_milestone NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    evidence_source public.conversion_evidence_source NOT NULL,
    evidence_key character varying(255) NOT NULL,
    amount_cents integer,
    currency character varying(3),
    CONSTRAINT practice_conversion_milestones_evidence_source_check CHECK ((((milestone = 'registered'::public.practice_conversion_milestone) AND (evidence_source = 'practice_created'::public.conversion_evidence_source) AND ((evidence_key)::text ~~ 'practice:%'::text)) OR ((milestone = 'activated'::public.practice_conversion_milestone) AND (evidence_source = 'product_records'::public.conversion_evidence_source) AND ((evidence_key)::text ~~ 'client:%|appointment:%'::text)) OR ((milestone = ANY (ARRAY['payment_method_collected'::public.practice_conversion_milestone, 'first_positive_payment'::public.practice_conversion_milestone])) AND (evidence_source = 'stripe_webhook'::public.conversion_evidence_source) AND ((evidence_key)::text ~~ 'stripe:%'::text)))),
    CONSTRAINT practice_conversion_milestones_payment_shape_check CHECK ((((milestone = 'first_positive_payment'::public.practice_conversion_milestone) AND (amount_cents IS NOT NULL) AND (amount_cents > 0) AND (currency IS NOT NULL) AND ((currency)::text ~ '^[a-z]{3}$'::text)) OR ((milestone <> 'first_positive_payment'::public.practice_conversion_milestone) AND (amount_cents IS NULL) AND (currency IS NULL))))
);


--
-- Name: practice_payment_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_payment_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'stripe_connect'::character varying NOT NULL,
    stripe_account_id character varying(128) NOT NULL,
    onboarding_status public.payment_account_status DEFAULT 'pending'::public.payment_account_status NOT NULL,
    charges_enabled boolean DEFAULT false NOT NULL,
    payouts_enabled boolean DEFAULT false NOT NULL,
    details_submitted boolean DEFAULT false NOT NULL,
    requirements_currently_due jsonb,
    requirements_disabled_reason character varying(255),
    last_synced_at timestamp with time zone
);


--
-- Name: practices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    name character varying(255) NOT NULL,
    address text,
    phone character varying(32),
    email character varying(255),
    website character varying(255),
    timezone character varying(64) DEFAULT 'America/New_York'::character varying NOT NULL,
    logo_url character varying(512),
    settings jsonb DEFAULT '{}'::jsonb,
    subscription_tier character varying(32) DEFAULT 'free'::character varying NOT NULL,
    stripe_customer_id character varying(64),
    stripe_subscription_id character varying(64),
    billing_status character varying(24) DEFAULT 'none'::character varying NOT NULL,
    trial_ends_at timestamp with time zone,
    country character varying(2) DEFAULT 'US'::character varying NOT NULL,
    currency character varying(3) DEFAULT 'usd'::character varying NOT NULL,
    tax_rate_percent numeric(5,2) DEFAULT 8.00 NOT NULL,
    vat_number character varying(32),
    calendar_feed_token character varying(64),
    appointment_reminders_enabled boolean DEFAULT false NOT NULL,
    appointment_reminder_lead_hours integer DEFAULT 24 NOT NULL,
    recovery_hold boolean DEFAULT false NOT NULL,
    recovery_hold_reason character varying(255),
    recovery_hold_set_at timestamp with time zone,
    recovery_hold_released_at timestamp with time zone,
    CONSTRAINT practices_appointment_reminder_lead_hours_check CHECK ((appointment_reminder_lead_hours = ANY (ARRAY[24, 48, 72]))),
    CONSTRAINT practices_recovery_hold_evidence_check CHECK (((NOT recovery_hold) OR ((recovery_hold_set_at IS NOT NULL) AND (recovery_hold_reason IS NOT NULL) AND ((recovery_hold_reason)::text ~ '[^[:space:]]'::text))))
);


--
-- Name: prescription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    product_id uuid,
    event_type public.prescription_event_type NOT NULL,
    quantity numeric(13,3),
    status_before public.prescription_status,
    status_after public.prescription_status NOT NULL,
    refills_before integer,
    refills_after integer NOT NULL,
    reason text,
    actor_id uuid,
    actor_name character varying(255) NOT NULL,
    operation_id uuid,
    CONSTRAINT prescription_events_shape_check CHECK (((length(btrim((actor_name)::text)) > 0) AND (refills_after >= 0) AND ((refills_before IS NULL) OR (refills_before >= 0)) AND ((reason IS NULL) OR (length(reason) <= 500)) AND (((event_type = 'created'::public.prescription_event_type) AND (status_before IS NULL) AND (status_after = 'active'::public.prescription_status) AND (refills_before IS NULL) AND (actor_id IS NOT NULL)) OR ((event_type = 'refill_dispensed'::public.prescription_event_type) AND (status_before = 'active'::public.prescription_status) AND (status_after = 'active'::public.prescription_status) AND (product_id IS NOT NULL) AND (quantity > (0)::numeric) AND (refills_before > 0) AND (refills_after = (refills_before - 1)) AND (actor_id IS NOT NULL) AND (operation_id IS NOT NULL)) OR ((event_type = 'refill_authorized'::public.prescription_event_type) AND (status_before = 'active'::public.prescription_status) AND (status_after = 'active'::public.prescription_status) AND (product_id IS NULL) AND (refills_before > 0) AND (refills_after = (refills_before - 1)) AND (actor_id IS NOT NULL) AND (operation_id IS NOT NULL)) OR ((event_type = ANY (ARRAY['completed'::public.prescription_event_type, 'cancelled'::public.prescription_event_type])) AND (status_before = 'active'::public.prescription_status) AND ((status_after)::text = (event_type)::text) AND (length(btrim(COALESCE(reason, ''::text))) >= 5) AND (refills_before = refills_after) AND (actor_id IS NOT NULL) AND (operation_id IS NOT NULL)) OR ((event_type = 'expired'::public.prescription_event_type) AND (status_before = 'active'::public.prescription_status) AND (status_after = 'expired'::public.prescription_status) AND (length(btrim(COALESCE(reason, ''::text))) >= 5) AND (refills_before = refills_after)))))
);


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    medication_name character varying(255) NOT NULL,
    dosage character varying(128) NOT NULL,
    frequency character varying(128) NOT NULL,
    quantity numeric(13,3),
    product_id uuid,
    refills_remaining integer DEFAULT 0 NOT NULL,
    prescribed_by uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status public.prescription_status DEFAULT 'active'::public.prescription_status NOT NULL,
    instructions text,
    appointment_id uuid,
    operation_id uuid
);


--
-- Name: problem_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problem_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    description character varying(500) NOT NULL,
    status public.problem_status DEFAULT 'active'::public.problem_status NOT NULL,
    onset_date date,
    resolved_date date
);


--
-- Name: procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    name character varying(255) NOT NULL,
    description text,
    performed_by uuid,
    anesthesia_used text,
    duration_minutes integer,
    notes text
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    location_id uuid,
    name character varying(255) NOT NULL,
    sku character varying(64),
    category character varying(128),
    unit_price numeric(10,2) NOT NULL,
    cost_price numeric(10,2),
    stock_quantity numeric(13,3) DEFAULT 0 NOT NULL,
    reorder_point integer DEFAULT 10,
    lot_number character varying(64),
    expiration_date date,
    taxable boolean DEFAULT true NOT NULL,
    inventory_tracked boolean DEFAULT true NOT NULL,
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    CONSTRAINT products_external_source_check CHECK (((external_source IS NULL) OR ((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))),
    CONSTRAINT products_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT products_import_identity_check CHECK ((((external_source IS NULL) AND (external_id IS NULL) AND (import_fingerprint IS NULL)) OR ((external_source IS NOT NULL) AND (external_id IS NOT NULL) AND (import_fingerprint IS NOT NULL)))),
    CONSTRAINT products_inventory_tracking_check CHECK ((inventory_tracked OR ((stock_quantity = (0)::numeric) AND (reorder_point IS NULL) AND (lot_number IS NULL) AND (expiration_date IS NULL))))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    status public.purchase_order_status DEFAULT 'draft'::public.purchase_order_status NOT NULL,
    total numeric(10,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_buckets (
    key character varying(255) NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recent_clinical_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recent_clinical_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    user_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    frequency public.recurring_frequency NOT NULL,
    "interval" integer DEFAULT 1 NOT NULL,
    end_date date
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    location_id uuid,
    name character varying(128) NOT NULL,
    type public.room_type DEFAULT 'exam'::public.room_type NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(32),
    category character varying(128),
    default_price numeric(10,2) NOT NULL,
    taxable boolean DEFAULT true NOT NULL,
    external_source character varying(64),
    external_id character varying(160),
    import_fingerprint character varying(64),
    CONSTRAINT services_default_price_nonnegative CHECK ((default_price >= (0)::numeric)),
    CONSTRAINT services_external_source_check CHECK (((external_source IS NULL) OR ((external_source)::text ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::text))),
    CONSTRAINT services_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT services_import_identity_check CHECK ((((external_source IS NULL) AND (external_id IS NULL) AND (import_fingerprint IS NULL)) OR ((external_source IS NOT NULL) AND (external_id IS NOT NULL) AND (import_fingerprint IS NOT NULL))))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_token character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    expires timestamp with time zone NOT NULL
);


--
-- Name: sms_consent_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_consent_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    client_id uuid,
    location_id uuid,
    destination_e164 character varying(16) NOT NULL,
    action public.sms_consent_action NOT NULL,
    source character varying(64) NOT NULL,
    disclosure_version character varying(32),
    disclosure text,
    detail text,
    actor_type public.sms_consent_actor_type NOT NULL,
    actor_user_id uuid,
    actor_name character varying(255),
    provider character varying(16),
    provider_message_id character varying(255),
    event_key character varying(200) NOT NULL,
    CONSTRAINT sms_consent_events_actor_shape_check CHECK ((((actor_type = 'staff'::public.sms_consent_actor_type) AND (actor_user_id IS NOT NULL) AND (length(btrim((COALESCE(actor_name, ''::character varying))::text)) > 0) AND (provider IS NULL) AND (provider_message_id IS NULL)) OR ((actor_type = 'client'::public.sms_consent_actor_type) AND (actor_user_id IS NULL) AND (actor_name IS NULL) AND ((provider)::text = ANY ((ARRAY['telnyx'::character varying, 'twilio'::character varying])::text[])) AND (length(btrim((COALESCE(provider_message_id, ''::character varying))::text)) > 0)) OR ((actor_type = 'system'::public.sms_consent_actor_type) AND (actor_user_id IS NULL) AND (actor_name IS NULL) AND (provider IS NULL) AND (provider_message_id IS NULL)))),
    CONSTRAINT sms_consent_events_destination_check CHECK (((destination_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text)),
    CONSTRAINT sms_consent_events_detail_check CHECK (((detail IS NULL) OR (length(detail) <= 2000))),
    CONSTRAINT sms_consent_events_event_key_check CHECK (((length(btrim((event_key)::text)) >= 1) AND (length(btrim((event_key)::text)) <= 200))),
    CONSTRAINT sms_consent_events_evidence_shape_check CHECK ((((action = 'granted'::public.sms_consent_action) AND (length(btrim((COALESCE(disclosure_version, ''::character varying))::text)) > 0) AND (length(btrim(COALESCE(disclosure, ''::text))) > 0)) OR ((action = 'revoked'::public.sms_consent_action) AND (disclosure_version IS NULL) AND (disclosure IS NULL)))),
    CONSTRAINT sms_consent_events_source_check CHECK (((length(btrim((source)::text)) >= 1) AND (length(btrim((source)::text)) <= 64)))
);


--
-- Name: sms_delivery_event_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_delivery_event_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_event_id uuid NOT NULL,
    reviewed_history_id uuid,
    practice_id uuid,
    attempt_id uuid,
    communication_id uuid,
    kind public.sms_delivery_history_kind NOT NULL,
    result public.sms_delivery_history_result NOT NULL,
    classification public.sms_delivery_classification NOT NULL,
    detail text,
    operator_reason_code public.sms_delivery_reconciliation_reason,
    actor_type public.sms_send_actor_type,
    actor_user_id uuid,
    actor_identity character varying(255),
    actor_name character varying(255),
    event_key character varying(255) NOT NULL,
    CONSTRAINT sms_delivery_event_history_actor_shape_check CHECK ((((kind = 'automatic'::public.sms_delivery_history_kind) AND (result = ANY (ARRAY['unmatched'::public.sms_delivery_history_result, 'ambiguous'::public.sms_delivery_history_result, 'attributed'::public.sms_delivery_history_result, 'projected'::public.sms_delivery_history_result, 'projection_miss'::public.sms_delivery_history_result])) AND (actor_type IS NULL) AND (actor_user_id IS NULL) AND (actor_identity IS NULL) AND (actor_name IS NULL) AND (operator_reason_code IS NULL)) OR ((kind = 'operator_reconciliation'::public.sms_delivery_history_kind) AND (((result = 'reconciled'::public.sms_delivery_history_result) AND (operator_reason_code = ANY (ARRAY['exact_attribution_retry'::public.sms_delivery_reconciliation_reason, 'provider_portal_status_review'::public.sms_delivery_reconciliation_reason, 'projection_repair'::public.sms_delivery_reconciliation_reason]))) OR ((result = 'operator_reviewed'::public.sms_delivery_history_result) AND (operator_reason_code = ANY (ARRAY['identity_conflict_review'::public.sms_delivery_reconciliation_reason, 'unmatched_evidence_review'::public.sms_delivery_reconciliation_reason])))) AND (actor_type = 'platform_operator'::public.sms_send_actor_type) AND (actor_user_id IS NULL) AND ((length(btrim((COALESCE(actor_identity, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(actor_identity, ''::character varying))::text)) <= 255)) AND ((length(btrim((COALESCE(actor_name, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(actor_name, ''::character varying))::text)) <= 255))))),
    CONSTRAINT sms_delivery_event_history_detail_check CHECK (((detail IS NULL) OR (length(detail) <= 2000))),
    CONSTRAINT sms_delivery_event_history_event_key_check CHECK (((length(btrim((event_key)::text)) >= 1) AND (length(btrim((event_key)::text)) <= 255))),
    CONSTRAINT sms_delivery_event_history_target_shape_check CHECK ((((result = ANY (ARRAY['unmatched'::public.sms_delivery_history_result, 'ambiguous'::public.sms_delivery_history_result, 'operator_reviewed'::public.sms_delivery_history_result])) AND (practice_id IS NULL) AND (attempt_id IS NULL) AND (communication_id IS NULL) AND (((result = 'operator_reviewed'::public.sms_delivery_history_result) AND (reviewed_history_id IS NOT NULL)) OR ((result = ANY (ARRAY['unmatched'::public.sms_delivery_history_result, 'ambiguous'::public.sms_delivery_history_result])) AND (reviewed_history_id IS NULL)))) OR ((result = ANY (ARRAY['attributed'::public.sms_delivery_history_result, 'projection_miss'::public.sms_delivery_history_result, 'reconciled'::public.sms_delivery_history_result])) AND (practice_id IS NOT NULL) AND (attempt_id IS NOT NULL) AND (reviewed_history_id IS NULL)) OR ((result = 'projected'::public.sms_delivery_history_result) AND (practice_id IS NOT NULL) AND (attempt_id IS NOT NULL) AND (communication_id IS NOT NULL) AND (reviewed_history_id IS NULL))))
);


--
-- Name: sms_delivery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_delivery_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    provider character varying(16) NOT NULL,
    provider_event_id character varying(255),
    provider_message_id character varying(255),
    provider_event_type character varying(80) NOT NULL,
    provider_status character varying(80),
    provider_error_code character varying(80),
    classification public.sms_delivery_classification NOT NULL,
    occurred_at timestamp with time zone,
    event_key character varying(255) NOT NULL,
    payload_fingerprint_sha256 character varying(64) NOT NULL,
    CONSTRAINT sms_delivery_events_event_key_check CHECK (((length(btrim((event_key)::text)) >= 1) AND (length(btrim((event_key)::text)) <= 255))),
    CONSTRAINT sms_delivery_events_event_type_check CHECK (((length(btrim((provider_event_type)::text)) >= 1) AND (length(btrim((provider_event_type)::text)) <= 80))),
    CONSTRAINT sms_delivery_events_fingerprint_check CHECK (((payload_fingerprint_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT sms_delivery_events_provider_check CHECK (((provider)::text = ANY ((ARRAY['telnyx'::character varying, 'twilio'::character varying])::text[]))),
    CONSTRAINT sms_delivery_events_provider_error_code_check CHECK (((provider_error_code IS NULL) OR ((length(btrim((provider_error_code)::text)) >= 1) AND (length(btrim((provider_error_code)::text)) <= 80)))),
    CONSTRAINT sms_delivery_events_provider_event_id_check CHECK (((provider_event_id IS NULL) OR ((length(btrim((provider_event_id)::text)) >= 1) AND (length(btrim((provider_event_id)::text)) <= 255)))),
    CONSTRAINT sms_delivery_events_provider_message_id_check CHECK (((provider_message_id IS NULL) OR ((length(btrim((provider_message_id)::text)) >= 1) AND (length(btrim((provider_message_id)::text)) <= 255)))),
    CONSTRAINT sms_delivery_events_provider_status_check CHECK (((provider_status IS NULL) OR ((length(btrim((provider_status)::text)) >= 1) AND (length(btrim((provider_status)::text)) <= 80))))
);


--
-- Name: sms_provider_event_conflict_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_provider_event_conflict_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reviewed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    conflict_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    resolution public.sms_provider_event_conflict_resolution NOT NULL,
    reason_code character varying(64) NOT NULL,
    detail character varying(2000),
    reviewed_by_identity character varying(255) NOT NULL,
    reviewed_by_name character varying(255) NOT NULL,
    CONSTRAINT sms_provider_event_conflict_reviews_shape_check CHECK (((((resolution = 'semantic_duplicate_confirmed'::public.sms_provider_event_conflict_resolution) AND ((reason_code)::text = ANY ((ARRAY['provider_replay_verified'::character varying, 'signature_evidence_verified'::character varying])::text[]))) OR ((resolution = 'provider_identity_rotated'::public.sms_provider_event_conflict_resolution) AND ((reason_code)::text = ANY ((ARRAY['sender_identity_rotated'::character varying, 'provider_identity_reprovisioned'::character varying])::text[]))) OR ((resolution = 'incident_closed_no_projection'::public.sms_provider_event_conflict_resolution) AND ((reason_code)::text = ANY ((ARRAY['provider_support_incident_closed'::character varying, 'security_review_closed'::character varying])::text[])))) AND ((reviewed_by_identity)::text = btrim((reviewed_by_identity)::text)) AND ((length((reviewed_by_identity)::text) >= 1) AND (length((reviewed_by_identity)::text) <= 255)) AND ((reviewed_by_name)::text = btrim((reviewed_by_name)::text)) AND ((length((reviewed_by_name)::text) >= 1) AND (length((reviewed_by_name)::text) <= 255)) AND ((detail IS NULL) OR ((length(btrim((detail)::text)) >= 1) AND (length(btrim((detail)::text)) <= 2000)))))
);


--
-- Name: sms_provider_event_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_provider_event_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    original_event_id uuid NOT NULL,
    incoming_raw_body_fingerprint_sha256 character varying(64) NOT NULL,
    incoming_provider_event_type character varying(80) NOT NULL,
    incoming_provider_event_id character varying(255),
    incoming_provider_message_id character varying(255),
    CONSTRAINT sms_provider_event_conflicts_shape_check CHECK ((((incoming_raw_body_fingerprint_sha256)::text ~ '^[0-9a-f]{64}$'::text) AND ((length(btrim((incoming_provider_event_type)::text)) >= 1) AND (length(btrim((incoming_provider_event_type)::text)) <= 80)) AND ((incoming_provider_event_type)::text ~ '^[A-Za-z0-9_.:-]+$'::text) AND ((incoming_provider_event_id IS NULL) OR (((incoming_provider_event_id)::text = btrim((incoming_provider_event_id)::text)) AND ((length((incoming_provider_event_id)::text) >= 1) AND (length((incoming_provider_event_id)::text) <= 255)))) AND ((incoming_provider_message_id IS NULL) OR (((incoming_provider_message_id)::text = btrim((incoming_provider_message_id)::text)) AND ((length((incoming_provider_message_id)::text) >= 1) AND (length((incoming_provider_message_id)::text) <= 255))))))
);


--
-- Name: sms_provider_event_resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_provider_event_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resolved_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    event_id uuid NOT NULL,
    conflict_id uuid,
    operation_id uuid NOT NULL,
    practice_id uuid,
    resolution public.sms_provider_event_resolution NOT NULL,
    inbound_communication_id uuid,
    sms_consent_event_id uuid,
    sms_delivery_event_id uuid,
    messaging_registration_event_id uuid,
    external_evidence_reference character varying(255),
    reason_code character varying(64) NOT NULL,
    detail character varying(2000),
    resolved_by_identity character varying(255) NOT NULL,
    resolved_by_name character varying(255) NOT NULL,
    CONSTRAINT sms_provider_event_resolutions_shape_check CHECK ((((reason_code)::text ~ '^[a-z0-9_]{3,64}$'::text) AND ((resolution = 'provider_attested_no_projection'::public.sms_provider_event_resolution) OR (practice_id IS NOT NULL)) AND (((resolution = 'authoritative_projection'::public.sms_provider_event_resolution) AND ((reason_code)::text = ANY ((ARRAY['projection_repaired'::character varying, 'delivery_reconciled'::character varying])::text[]))) OR ((resolution = 'conservative_opt_out'::public.sms_provider_event_resolution) AND ((reason_code)::text = ANY ((ARRAY['provider_identity_conflict_opt_out'::character varying, 'sender_identity_drift_opt_out'::character varying])::text[]))) OR ((resolution = 'carrier_state_reconciled'::public.sms_provider_event_resolution) AND ((reason_code)::text = 'carrier_state_readback_confirmed'::text)) OR ((resolution = 'provider_attested_no_projection'::public.sms_provider_event_resolution) AND ((reason_code)::text = ANY ((ARRAY['provider_support_invalid_callback'::character varying, 'provider_support_duplicate_callback'::character varying])::text[])))) AND ((resolved_by_identity)::text = btrim((resolved_by_identity)::text)) AND ((length((resolved_by_identity)::text) >= 1) AND (length((resolved_by_identity)::text) <= 255)) AND ((resolved_by_name)::text = btrim((resolved_by_name)::text)) AND ((length((resolved_by_name)::text) >= 1) AND (length((resolved_by_name)::text) <= 255)) AND ((detail IS NULL) OR ((length(btrim((detail)::text)) >= 1) AND (length(btrim((detail)::text)) <= 2000))) AND ((external_evidence_reference IS NULL) OR (((external_evidence_reference)::text = btrim((external_evidence_reference)::text)) AND ((length((external_evidence_reference)::text) >= 3) AND (length((external_evidence_reference)::text) <= 255)) AND ((external_evidence_reference)::text ~ '^[A-Za-z0-9][A-Za-z0-9_.:/#-]{2,254}$'::text))) AND (((resolution = 'authoritative_projection'::public.sms_provider_event_resolution) AND (external_evidence_reference IS NULL) AND ((num_nonnulls(inbound_communication_id, sms_consent_event_id, sms_delivery_event_id, messaging_registration_event_id) >= 1) AND (num_nonnulls(inbound_communication_id, sms_consent_event_id, sms_delivery_event_id, messaging_registration_event_id) <= 2))) OR ((resolution = 'conservative_opt_out'::public.sms_provider_event_resolution) AND (inbound_communication_id IS NULL) AND (sms_consent_event_id IS NOT NULL) AND (sms_delivery_event_id IS NULL) AND (messaging_registration_event_id IS NULL) AND (external_evidence_reference IS NULL)) OR ((resolution = 'carrier_state_reconciled'::public.sms_provider_event_resolution) AND (inbound_communication_id IS NULL) AND (sms_consent_event_id IS NULL) AND (sms_delivery_event_id IS NULL) AND (messaging_registration_event_id IS NOT NULL) AND (external_evidence_reference IS NULL)) OR ((resolution = 'provider_attested_no_projection'::public.sms_provider_event_resolution) AND (inbound_communication_id IS NULL) AND (sms_consent_event_id IS NULL) AND (sms_delivery_event_id IS NULL) AND (messaging_registration_event_id IS NULL) AND (external_evidence_reference IS NOT NULL)))))
);


--
-- Name: sms_provider_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_provider_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    provider character varying(16) NOT NULL,
    kind public.sms_provider_event_kind NOT NULL,
    provider_event_id character varying(255),
    provider_message_id character varying(255),
    provider_event_type character varying(80) NOT NULL,
    event_key character varying(255) NOT NULL,
    raw_body_fingerprint_sha256 character varying(64) NOT NULL,
    occurred_at timestamp with time zone,
    from_e164 character varying(16),
    to_e164 character varying(16),
    messaging_profile_id character varying(128),
    message_body text,
    inbound_classification public.sms_provider_inbound_classification,
    delivery_classification public.sms_delivery_classification,
    provider_status character varying(80),
    provider_error_code character varying(80),
    a2p_brand_id character varying(128),
    a2p_campaign_id character varying(128),
    a2p_phone_e164 character varying(16),
    a2p_status character varying(80),
    a2p_type character varying(80),
    a2p_event_type character varying(80),
    a2p_observed_status public.messaging_registration_status,
    provider_detail character varying(1000),
    practice_id uuid,
    location_id uuid,
    state public.sms_provider_event_state DEFAULT 'pending'::public.sms_provider_event_state NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT clock_timestamp(),
    last_attempt_at timestamp with time zone,
    processed_at timestamp with time zone,
    last_error_code character varying(64),
    last_error_detail character varying(2000),
    CONSTRAINT sms_provider_events_attribution_check CHECK (((location_id IS NULL) OR (practice_id IS NOT NULL))),
    CONSTRAINT sms_provider_events_bounded_facts_check CHECK ((((messaging_profile_id IS NULL) OR (((messaging_profile_id)::text = btrim((messaging_profile_id)::text)) AND ((length((messaging_profile_id)::text) >= 1) AND (length((messaging_profile_id)::text) <= 128)))) AND ((provider_status IS NULL) OR (((length(btrim((provider_status)::text)) >= 1) AND (length(btrim((provider_status)::text)) <= 80)) AND ((provider_status)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((provider_error_code IS NULL) OR (((length(btrim((provider_error_code)::text)) >= 1) AND (length(btrim((provider_error_code)::text)) <= 80)) AND ((provider_error_code)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((a2p_brand_id IS NULL) OR (((a2p_brand_id)::text = btrim((a2p_brand_id)::text)) AND ((length((a2p_brand_id)::text) >= 1) AND (length((a2p_brand_id)::text) <= 128)))) AND ((a2p_campaign_id IS NULL) OR (((a2p_campaign_id)::text = btrim((a2p_campaign_id)::text)) AND ((length((a2p_campaign_id)::text) >= 1) AND (length((a2p_campaign_id)::text) <= 128)))) AND ((a2p_status IS NULL) OR (((length(btrim((a2p_status)::text)) >= 1) AND (length(btrim((a2p_status)::text)) <= 80)) AND ((a2p_status)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((a2p_type IS NULL) OR (((length(btrim((a2p_type)::text)) >= 1) AND (length(btrim((a2p_type)::text)) <= 80)) AND ((a2p_type)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((a2p_event_type IS NULL) OR (((length(btrim((a2p_event_type)::text)) >= 1) AND (length(btrim((a2p_event_type)::text)) <= 80)) AND ((a2p_event_type)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((provider_detail IS NULL) OR ((length(btrim((provider_detail)::text)) >= 1) AND (length(btrim((provider_detail)::text)) <= 1000))) AND ((last_error_code IS NULL) OR (((length(btrim((last_error_code)::text)) >= 1) AND (length(btrim((last_error_code)::text)) <= 64)) AND ((last_error_code)::text ~ '^[A-Za-z0-9_.:-]+$'::text))) AND ((last_error_detail IS NULL) OR ((length(btrim((last_error_detail)::text)) >= 1) AND (length(btrim((last_error_detail)::text)) <= 2000))))),
    CONSTRAINT sms_provider_events_e164_check CHECK ((((from_e164 IS NULL) OR ((from_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text)) AND ((to_e164 IS NULL) OR ((to_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text)) AND ((a2p_phone_e164 IS NULL) OR ((a2p_phone_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text)))),
    CONSTRAINT sms_provider_events_identifiers_check CHECK ((((provider_event_id IS NULL) OR (((provider_event_id)::text = btrim((provider_event_id)::text)) AND ((length((provider_event_id)::text) >= 1) AND (length((provider_event_id)::text) <= 255)))) AND ((provider_message_id IS NULL) OR (((provider_message_id)::text = btrim((provider_message_id)::text)) AND ((length((provider_message_id)::text) >= 1) AND (length((provider_message_id)::text) <= 255)))) AND ((length(btrim((provider_event_type)::text)) >= 1) AND (length(btrim((provider_event_type)::text)) <= 80)) AND ((provider_event_type)::text ~ '^[A-Za-z0-9_.:-]+$'::text) AND ((length((event_key)::text) >= 1) AND (length((event_key)::text) <= 255)) AND ((event_key)::text ~ '^[A-Za-z0-9_.:-]+$'::text) AND ((raw_body_fingerprint_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT sms_provider_events_kind_shape_check CHECK ((((kind = 'inbound'::public.sms_provider_event_kind) AND ((provider_event_type)::text = 'message.received'::text) AND (provider_message_id IS NOT NULL) AND (from_e164 IS NOT NULL) AND ((to_e164 IS NOT NULL) OR (messaging_profile_id IS NOT NULL)) AND (message_body IS NOT NULL) AND (length(btrim(message_body)) >= 1) AND (length(message_body) <= 1600) AND (inbound_classification IS NOT NULL) AND (delivery_classification IS NULL) AND (provider_status IS NULL) AND (provider_error_code IS NULL) AND (a2p_brand_id IS NULL) AND (a2p_campaign_id IS NULL) AND (a2p_phone_e164 IS NULL) AND (a2p_status IS NULL) AND (a2p_type IS NULL) AND (a2p_event_type IS NULL) AND (a2p_observed_status IS NULL) AND (provider_detail IS NULL)) OR ((kind = 'delivery'::public.sms_provider_event_kind) AND ((provider_event_type)::text ~~ 'message.%'::text) AND ((provider_event_type)::text <> 'message.received'::text) AND (provider_message_id IS NOT NULL) AND (from_e164 IS NULL) AND (to_e164 IS NULL) AND (messaging_profile_id IS NULL) AND (message_body IS NULL) AND (inbound_classification IS NULL) AND (delivery_classification IS NOT NULL) AND (a2p_brand_id IS NULL) AND (a2p_campaign_id IS NULL) AND (a2p_phone_e164 IS NULL) AND (a2p_status IS NULL) AND (a2p_type IS NULL) AND (a2p_event_type IS NULL) AND (a2p_observed_status IS NULL) AND (provider_detail IS NULL)) OR ((kind = 'a2p'::public.sms_provider_event_kind) AND ((provider)::text = 'telnyx'::text) AND ((provider_event_type)::text = ANY ((ARRAY['10dlc.brand.update'::character varying, '10dlc.campaign.update'::character varying, '10dlc.phone_number.update'::character varying])::text[])) AND ((a2p_brand_id IS NOT NULL) OR (a2p_campaign_id IS NOT NULL) OR (a2p_phone_e164 IS NOT NULL)) AND (a2p_observed_status IS NOT NULL) AND (a2p_observed_status = ANY (ARRAY['pending'::public.messaging_registration_status, 'action_required'::public.messaging_registration_status, 'failed'::public.messaging_registration_status, 'suspended'::public.messaging_registration_status])) AND (provider_message_id IS NULL) AND (from_e164 IS NULL) AND (to_e164 IS NULL) AND (messaging_profile_id IS NULL) AND (message_body IS NULL) AND (inbound_classification IS NULL) AND (delivery_classification IS NULL) AND (provider_error_code IS NULL)))),
    CONSTRAINT sms_provider_events_provider_check CHECK (((provider)::text = ANY ((ARRAY['telnyx'::character varying, 'twilio'::character varying])::text[]))),
    CONSTRAINT sms_provider_events_state_shape_check CHECK (((attempt_count >= 0) AND (((state = 'pending'::public.sms_provider_event_state) AND (attempt_count = 0) AND (next_attempt_at IS NOT NULL) AND (next_attempt_at >= received_at) AND (last_attempt_at IS NULL) AND (processed_at IS NULL) AND (last_error_code IS NULL) AND (last_error_detail IS NULL)) OR ((state = 'retry'::public.sms_provider_event_state) AND (attempt_count >= 1) AND (next_attempt_at IS NOT NULL) AND (last_attempt_at IS NOT NULL) AND (last_attempt_at >= received_at) AND (next_attempt_at > last_attempt_at) AND (processed_at IS NULL) AND (last_error_code IS NOT NULL)) OR ((state = 'blocked_recovery'::public.sms_provider_event_state) AND (practice_id IS NOT NULL) AND (attempt_count >= 1) AND (next_attempt_at IS NULL) AND (last_attempt_at IS NOT NULL) AND (last_attempt_at >= received_at) AND (processed_at IS NULL)) OR ((state = 'projected'::public.sms_provider_event_state) AND ((practice_id IS NOT NULL) OR (kind = 'delivery'::public.sms_provider_event_kind)) AND (attempt_count >= 1) AND (next_attempt_at IS NULL) AND (last_attempt_at IS NOT NULL) AND (last_attempt_at >= received_at) AND (processed_at IS NOT NULL) AND (processed_at >= last_attempt_at) AND (last_error_code IS NULL) AND (last_error_detail IS NULL)) OR ((state = 'ignored'::public.sms_provider_event_state) AND (attempt_count >= 1) AND (next_attempt_at IS NULL) AND (last_attempt_at IS NOT NULL) AND (last_attempt_at >= received_at) AND (processed_at IS NOT NULL) AND (processed_at >= last_attempt_at) AND (last_error_code IS NULL) AND (last_error_detail IS NULL)) OR ((state = 'quarantined'::public.sms_provider_event_state) AND (attempt_count >= 1) AND (next_attempt_at IS NULL) AND (last_attempt_at IS NOT NULL) AND (last_attempt_at >= received_at) AND (processed_at IS NOT NULL) AND (processed_at >= last_attempt_at) AND (last_error_code IS NOT NULL)))))
);


--
-- Name: sms_send_attempt_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_send_attempt_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    kind public.sms_send_attempt_event_kind NOT NULL,
    outcome public.sms_send_outcome NOT NULL,
    provider_message_id character varying(255),
    detail text,
    actor_type public.sms_send_actor_type,
    actor_user_id uuid,
    actor_identity character varying(255),
    actor_name character varying(255),
    event_key character varying(200) NOT NULL,
    CONSTRAINT sms_send_attempt_events_actor_shape_check CHECK ((((kind = 'provider_result'::public.sms_send_attempt_event_kind) AND (actor_type IS NULL) AND (actor_user_id IS NULL) AND (actor_identity IS NULL) AND (actor_name IS NULL)) OR ((kind = 'reconciliation'::public.sms_send_attempt_event_kind) AND (outcome = ANY (ARRAY['accepted'::public.sms_send_outcome, 'definite_failure'::public.sms_send_outcome])) AND (actor_type IS NOT NULL) AND ((length(btrim((COALESCE(actor_identity, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(actor_identity, ''::character varying))::text)) <= 255)) AND ((length(btrim((COALESCE(actor_name, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(actor_name, ''::character varying))::text)) <= 255)) AND (((actor_type = 'clinic_user'::public.sms_send_actor_type) AND (actor_user_id IS NOT NULL)) OR ((actor_type = 'platform_operator'::public.sms_send_actor_type) AND (actor_user_id IS NULL)))))),
    CONSTRAINT sms_send_attempt_events_detail_check CHECK (((detail IS NULL) OR (length(detail) <= 2000))),
    CONSTRAINT sms_send_attempt_events_event_key_check CHECK (((length(btrim((event_key)::text)) >= 1) AND (length(btrim((event_key)::text)) <= 200))),
    CONSTRAINT sms_send_attempt_events_outcome_shape_check CHECK ((((outcome = 'accepted'::public.sms_send_outcome) AND (length(btrim((COALESCE(provider_message_id, ''::character varying))::text)) > 0)) OR ((outcome = ANY (ARRAY['definite_failure'::public.sms_send_outcome, 'outcome_unknown'::public.sms_send_outcome])) AND (provider_message_id IS NULL))))
);


--
-- Name: sms_send_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_send_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    client_id uuid,
    location_id uuid,
    communication_id uuid,
    requested_by_actor_type public.sms_send_actor_type,
    requested_by_user_id uuid,
    requested_by_identity character varying(255),
    requested_by_name character varying(255),
    resend_of_attempt_id uuid,
    source character varying(64) NOT NULL,
    source_id character varying(200) NOT NULL,
    idempotency_key character varying(200) NOT NULL,
    destination_e164 character varying(16) NOT NULL,
    registered_display_name character varying(100) NOT NULL,
    body text NOT NULL,
    body_sha256 character varying(64) NOT NULL,
    provider character varying(16) NOT NULL,
    sender_messaging_service_id character varying(128),
    sender_e164 character varying(16),
    CONSTRAINT sms_send_attempts_body_check CHECK (((length(body) >= 1) AND (length(body) <= 1600))),
    CONSTRAINT sms_send_attempts_body_hash_check CHECK (((body_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT sms_send_attempts_destination_check CHECK (((destination_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text)),
    CONSTRAINT sms_send_attempts_display_name_check CHECK (((length(btrim((registered_display_name)::text)) >= 1) AND (length(btrim((registered_display_name)::text)) <= 100))),
    CONSTRAINT sms_send_attempts_idempotency_key_check CHECK (((length(btrim((idempotency_key)::text)) >= 1) AND (length(btrim((idempotency_key)::text)) <= 200))),
    CONSTRAINT sms_send_attempts_provider_check CHECK (((provider)::text = ANY ((ARRAY['telnyx'::character varying, 'twilio'::character varying, 'console'::character varying])::text[]))),
    CONSTRAINT sms_send_attempts_requester_check CHECK (((((source)::text = 'operator_resend'::text) AND (requested_by_actor_type IS NOT NULL) AND ((length(btrim((COALESCE(requested_by_identity, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(requested_by_identity, ''::character varying))::text)) <= 255)) AND ((length(btrim((COALESCE(requested_by_name, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(requested_by_name, ''::character varying))::text)) <= 255)) AND (((requested_by_actor_type = 'clinic_user'::public.sms_send_actor_type) AND (requested_by_user_id IS NOT NULL)) OR ((requested_by_actor_type = 'platform_operator'::public.sms_send_actor_type) AND (requested_by_user_id IS NULL)))) OR (((source)::text <> 'operator_resend'::text) AND (((requested_by_actor_type IS NULL) AND (requested_by_user_id IS NULL) AND (requested_by_identity IS NULL) AND (requested_by_name IS NULL)) OR ((requested_by_actor_type IS NOT NULL) AND ((length(btrim((COALESCE(requested_by_identity, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(requested_by_identity, ''::character varying))::text)) <= 255)) AND ((length(btrim((COALESCE(requested_by_name, ''::character varying))::text)) >= 1) AND (length(btrim((COALESCE(requested_by_name, ''::character varying))::text)) <= 255)) AND (((requested_by_actor_type = 'clinic_user'::public.sms_send_actor_type) AND (requested_by_user_id IS NOT NULL)) OR ((requested_by_actor_type = 'platform_operator'::public.sms_send_actor_type) AND (requested_by_user_id IS NULL)))))))),
    CONSTRAINT sms_send_attempts_sender_check CHECK ((((provider)::text = 'console'::text) OR (length(btrim((COALESCE(sender_messaging_service_id, ''::character varying))::text)) > 0) OR ((sender_e164)::text ~ '^\+[1-9][0-9]{7,14}$'::text))),
    CONSTRAINT sms_send_attempts_source_check CHECK (((length(btrim((source)::text)) >= 1) AND (length(btrim((source)::text)) <= 64))),
    CONSTRAINT sms_send_attempts_source_id_check CHECK (((length(btrim((source_id)::text)) >= 1) AND (length(btrim((source_id)::text)) <= 200)))
);


--
-- Name: sms_suppressions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_suppressions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    location_id uuid,
    phone character varying(32) NOT NULL,
    reason public.sms_suppression_reason DEFAULT 'stop'::public.sms_suppression_reason NOT NULL,
    detail text
);


--
-- Name: soap_note_addenda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soap_note_addenda (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    soap_note_id uuid NOT NULL,
    author_id uuid NOT NULL,
    author_name character varying(255) NOT NULL,
    content text NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    CONSTRAINT soap_note_addenda_author_name_check CHECK (((length(btrim((author_name)::text)) >= 1) AND (length(btrim((author_name)::text)) <= 255))),
    CONSTRAINT soap_note_addenda_content_check CHECK (((length(btrim(content)) >= 1) AND (length(btrim(content)) <= 10000))),
    CONSTRAINT soap_note_addenda_payload_hash_check CHECK (((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: soap_note_replacements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soap_note_replacements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    correction_id uuid NOT NULL,
    source_soap_note_id uuid NOT NULL,
    replacement_soap_note_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_name character varying(255) NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    CONSTRAINT soap_note_replacements_shape_check CHECK (((source_soap_note_id <> replacement_soap_note_id) AND ((actor_name)::text = btrim((actor_name)::text)) AND ((length(btrim((actor_name)::text)) >= 1) AND (length(btrim((actor_name)::text)) <= 255)) AND ((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: soap_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soap_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    author_id uuid NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    imported boolean DEFAULT false NOT NULL,
    import_fingerprint character varying(64),
    author_name character varying(255) NOT NULL,
    status public.soap_note_status DEFAULT 'finalized'::public.soap_note_status NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    finalized_at timestamp with time zone,
    finalized_by uuid,
    finalizer_name character varying(255),
    CONSTRAINT soap_notes_author_name_check CHECK (((length(btrim((author_name)::text)) >= 1) AND (length(btrim((author_name)::text)) <= 255))),
    CONSTRAINT soap_notes_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT soap_notes_lifecycle_check CHECK ((((status = 'draft'::public.soap_note_status) AND (finalized_at IS NULL) AND (finalized_by IS NULL) AND (finalizer_name IS NULL) AND (imported = false)) OR ((status = 'finalized'::public.soap_note_status) AND (finalized_at IS NOT NULL) AND (finalized_by IS NOT NULL) AND ((length(btrim((finalizer_name)::text)) >= 1) AND (length(btrim((finalizer_name)::text)) <= 255))))),
    CONSTRAINT soap_notes_revision_check CHECK ((revision >= 1))
);


--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    location_id uuid,
    CONSTRAINT staff_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT staff_schedules_time_range_check CHECK ((start_time < end_time))
);


--
-- Name: stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_events (
    event_id character varying(128) NOT NULL,
    endpoint character varying(64) NOT NULL,
    event_type character varying(128) NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    event_created_at timestamp with time zone,
    practice_id uuid,
    object_id character varying(128),
    evidence_kind public.stripe_conversion_evidence_kind,
    amount_cents integer,
    currency character varying(3),
    CONSTRAINT stripe_events_conversion_evidence_shape_check CHECK ((((evidence_kind IS NULL) AND (event_created_at IS NULL) AND (object_id IS NULL) AND (amount_cents IS NULL) AND (currency IS NULL)) OR ((evidence_kind IS NOT NULL) AND (event_created_at IS NOT NULL) AND (object_id IS NOT NULL) AND (length(btrim((object_id)::text)) > 0) AND (((evidence_kind = 'subscription_checkout_completed'::public.stripe_conversion_evidence_kind) AND (amount_cents IS NULL) AND (currency IS NULL)) OR ((evidence_kind = 'positive_subscription_invoice_paid'::public.stripe_conversion_evidence_kind) AND (amount_cents IS NOT NULL) AND (amount_cents > 0) AND (currency IS NOT NULL) AND ((currency)::text ~ '^[a-z]{3}$'::text))))))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    contact_email character varying(255),
    phone character varying(32),
    address text,
    notes text
);


--
-- Name: treatment_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    plan_id uuid NOT NULL,
    description character varying(500) NOT NULL,
    instructions text,
    status public.treatment_plan_item_status DEFAULT 'pending'::public.treatment_plan_item_status NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: treatment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    problem_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status public.treatment_plan_status DEFAULT 'active'::public.treatment_plan_status NOT NULL,
    start_date date,
    end_date date,
    created_by uuid
);


--
-- Name: treatment_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    template_id uuid NOT NULL,
    item_type public.invoice_item_type NOT NULL,
    item_id uuid,
    description character varying(500) NOT NULL,
    default_quantity integer DEFAULT 1 NOT NULL,
    default_unit_price numeric(10,2) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: treatment_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(128),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: usage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    period_month character varying(7) NOT NULL,
    stripe_meter_identifier character varying(128),
    stripe_metered_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role public.user_role DEFAULT 'front_desk'::public.user_role NOT NULL,
    practice_id uuid NOT NULL,
    location_id uuid,
    avatar_url character varying(512),
    license_number character varying(64),
    phone character varying(32),
    email_verified_at timestamp with time zone,
    is_veterinarian boolean DEFAULT false NOT NULL,
    session_version integer DEFAULT 1 NOT NULL,
    mfa_secret_encrypted text,
    mfa_enabled_at timestamp with time zone,
    mfa_last_used_totp_counter integer,
    mfa_recovery_code_hashes jsonb,
    mfa_pending_secret_encrypted text,
    mfa_pending_expires_at timestamp with time zone,
    CONSTRAINT users_mfa_active_shape_check CHECK ((((mfa_enabled_at IS NULL) AND (mfa_secret_encrypted IS NULL) AND (mfa_last_used_totp_counter IS NULL) AND (mfa_recovery_code_hashes IS NULL)) OR ((mfa_enabled_at IS NOT NULL) AND ((length(mfa_secret_encrypted) >= 40) AND (length(mfa_secret_encrypted) <= 1024)) AND (jsonb_typeof(mfa_recovery_code_hashes) = 'array'::text) AND (jsonb_array_length(mfa_recovery_code_hashes) <= 20)))),
    CONSTRAINT users_mfa_pending_shape_check CHECK ((((mfa_pending_secret_encrypted IS NULL) AND (mfa_pending_expires_at IS NULL)) OR ((mfa_enabled_at IS NULL) AND ((length(mfa_pending_secret_encrypted) >= 40) AND (length(mfa_pending_secret_encrypted) <= 1024)) AND (mfa_pending_expires_at IS NOT NULL)))),
    CONSTRAINT users_mfa_totp_counter_check CHECK (((mfa_last_used_totp_counter IS NULL) OR (mfa_last_used_totp_counter >= 0)))
);


--
-- Name: COLUMN users.mfa_secret_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.mfa_secret_encrypted IS 'Dormant compatibility storage; MFA authentication is not activated by this migration.';


--
-- Name: vaccination_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vaccination_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    vaccine_name character varying(255) NOT NULL,
    lot_number character varying(64),
    manufacturer character varying(128),
    administered_by uuid,
    administered_at timestamp with time zone DEFAULT now() NOT NULL,
    next_due_date date,
    certificate_url character varying(512),
    appointment_id uuid,
    import_fingerprint character varying(64),
    product_name character varying(255),
    product_expiration_date date,
    dose_type public.vaccination_dose_type,
    licensed_duration_months integer,
    rabies_tag_number character varying(64),
    supervising_veterinarian_id uuid,
    CONSTRAINT vaccination_records_import_fingerprint_check CHECK (((import_fingerprint IS NULL) OR ((import_fingerprint)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT vaccination_records_licensed_duration_check CHECK (((licensed_duration_months IS NULL) OR ((licensed_duration_months >= 1) AND (licensed_duration_months <= 120))))
);


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    identifier character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires timestamp with time zone NOT NULL
);


--
-- Name: visit_closeouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_closeouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    status public.visit_closeout_status DEFAULT 'draft'::public.visit_closeout_status NOT NULL,
    diagnosis_summary text,
    discharge_instructions text,
    warning_signs text,
    no_instructions_reason text,
    prescription_disposition public.visit_prescription_disposition,
    follow_up_disposition public.visit_follow_up_disposition,
    follow_up_notes text,
    follow_up_appointment_id uuid,
    follow_up_scheduled_at timestamp with time zone,
    medication_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    amendment_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    documentation_exception_reason text,
    clinical_finalized_at timestamp with time zone,
    clinical_finalized_by uuid,
    clinical_finalizer_name text,
    charge_disposition public.visit_charge_disposition,
    invoice_id uuid,
    no_charge_reason text,
    handoff_method public.visit_handoff_method,
    completed_at timestamp with time zone,
    completed_by uuid,
    revision integer DEFAULT 1 NOT NULL,
    follow_up_due_date date,
    follow_up_assigned_to uuid,
    follow_up_assignee_name text,
    follow_up_resolution public.visit_follow_up_resolution,
    follow_up_resolution_appointment_id uuid,
    follow_up_resolution_scheduled_at timestamp with time zone,
    follow_up_resolution_notes text,
    follow_up_resolved_at timestamp with time zone,
    follow_up_resolved_by uuid,
    follow_up_resolver_name text,
    amendment_draft jsonb,
    CONSTRAINT visit_closeouts_amendment_draft_check CHECK ((((status = 'draft'::public.visit_closeout_status) AND (amendment_draft IS NULL)) OR ((status = ANY (ARRAY['clinical_finalized'::public.visit_closeout_status, 'completed'::public.visit_closeout_status])) AND ((amendment_draft IS NULL) OR (jsonb_typeof(amendment_draft) = 'object'::text))))),
    CONSTRAINT visit_closeouts_clinical_state_check CHECK (((status = 'draft'::public.visit_closeout_status) OR ((clinical_finalized_at IS NOT NULL) AND (clinical_finalized_by IS NOT NULL) AND (length(btrim(COALESCE(clinical_finalizer_name, ''::text))) > 0) AND (prescription_disposition IS NOT NULL) AND (((prescription_disposition = 'prescribed'::public.visit_prescription_disposition) AND (jsonb_array_length(medication_snapshot) > 0)) OR ((prescription_disposition = 'not_needed'::public.visit_prescription_disposition) AND (jsonb_array_length(medication_snapshot) = 0))) AND ((length(btrim(COALESCE(discharge_instructions, ''::text))) > 0) OR (length(btrim(COALESCE(no_instructions_reason, ''::text))) > 0)) AND (follow_up_disposition IS NOT NULL) AND (((follow_up_disposition = 'none'::public.visit_follow_up_disposition) AND (follow_up_appointment_id IS NULL) AND (follow_up_scheduled_at IS NULL) AND (follow_up_due_date IS NULL) AND (follow_up_assigned_to IS NULL) AND (follow_up_assignee_name IS NULL)) OR ((follow_up_disposition = 'scheduled'::public.visit_follow_up_disposition) AND (follow_up_appointment_id IS NOT NULL) AND (follow_up_scheduled_at IS NOT NULL) AND (follow_up_due_date IS NULL) AND (follow_up_assigned_to IS NULL) AND (follow_up_assignee_name IS NULL)) OR ((follow_up_disposition = 'needed'::public.visit_follow_up_disposition) AND (follow_up_appointment_id IS NULL) AND (follow_up_scheduled_at IS NULL) AND (follow_up_due_date IS NOT NULL) AND (follow_up_assigned_to IS NOT NULL) AND (length(btrim(COALESCE(follow_up_assignee_name, ''::text))) > 0)))))),
    CONSTRAINT visit_closeouts_completed_state_check CHECK (((status <> 'completed'::public.visit_closeout_status) OR ((completed_at IS NOT NULL) AND (completed_by IS NOT NULL) AND (charge_disposition IS NOT NULL) AND (handoff_method IS NOT NULL) AND (((charge_disposition = 'no_charge'::public.visit_charge_disposition) AND (length(btrim(COALESCE(no_charge_reason, ''::text))) > 0)) OR ((charge_disposition = ANY (ARRAY['paid'::public.visit_charge_disposition, 'accounts_receivable'::public.visit_charge_disposition])) AND (invoice_id IS NOT NULL)))))),
    CONSTRAINT visit_closeouts_follow_up_resolution_check CHECK ((((follow_up_resolved_at IS NULL) AND (follow_up_resolution IS NULL) AND (follow_up_resolution_appointment_id IS NULL) AND (follow_up_resolution_scheduled_at IS NULL) AND (follow_up_resolution_notes IS NULL) AND (follow_up_resolved_by IS NULL) AND (follow_up_resolver_name IS NULL)) OR ((follow_up_disposition = 'needed'::public.visit_follow_up_disposition) AND (follow_up_resolved_at IS NOT NULL) AND (follow_up_resolution IS NOT NULL) AND (follow_up_resolved_by IS NOT NULL) AND (length(btrim(COALESCE(follow_up_resolver_name, ''::text))) > 0) AND (((follow_up_resolution = 'scheduled'::public.visit_follow_up_resolution) AND (follow_up_resolution_appointment_id IS NOT NULL) AND (follow_up_resolution_scheduled_at IS NOT NULL)) OR ((follow_up_resolution = ANY (ARRAY['completed'::public.visit_follow_up_resolution, 'not_needed'::public.visit_follow_up_resolution])) AND (follow_up_resolution_appointment_id IS NULL) AND (follow_up_resolution_scheduled_at IS NULL) AND (length(btrim(COALESCE(follow_up_resolution_notes, ''::text))) > 0)))))),
    CONSTRAINT visit_closeouts_revision_check CHECK ((revision >= 1))
);


--
-- Name: visit_treatment_plan_presentations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plan_presentations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    response_id uuid NOT NULL,
    created_by uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
    decisions jsonb,
    response_sha256 character varying(64),
    consent_request_id uuid,
    CONSTRAINT visit_treatment_plan_presentations_response_hash_check CHECK (((response_sha256 IS NULL) OR ((response_sha256)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT visit_treatment_plan_presentations_state_check CHECK (((((status)::text = ANY ((ARRAY['pending'::character varying, 'superseded'::character varying])::text[])) AND (decisions IS NULL) AND (response_sha256 IS NULL) AND (consent_request_id IS NULL)) OR (((status)::text = ANY ((ARRAY['awaiting_signature'::character varying, 'completed'::character varying])::text[])) AND (decisions IS NOT NULL) AND (response_sha256 IS NOT NULL) AND (consent_request_id IS NOT NULL)))),
    CONSTRAINT visit_treatment_plan_presentations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_signature'::character varying, 'completed'::character varying, 'superseded'::character varying])::text[]))),
    CONSTRAINT visit_treatment_plan_presentations_token_hash_check CHECK (((token_hash)::text ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: visit_treatment_plan_response_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plan_response_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    response_id uuid NOT NULL,
    revision_line_id uuid NOT NULL,
    decision public.visit_treatment_plan_decision NOT NULL,
    accepted_quantity numeric(12,3) NOT NULL,
    decline_reason text,
    CONSTRAINT visit_treatment_plan_response_lines_decision_quantity_check CHECK ((((decision = 'accepted'::public.visit_treatment_plan_decision) AND (accepted_quantity > (0)::numeric)) OR ((decision = 'declined'::public.visit_treatment_plan_decision) AND (accepted_quantity = (0)::numeric)))),
    CONSTRAINT visit_treatment_plan_response_lines_decline_reason_check CHECK (((decline_reason IS NULL) OR ((length(btrim(decline_reason)) >= 1) AND (length(btrim(decline_reason)) <= 2000))))
);


--
-- Name: visit_treatment_plan_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plan_responses (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    consent_request_id uuid NOT NULL,
    signed_file_id uuid NOT NULL,
    signature_sha256 character varying(64) NOT NULL,
    signed_document_sha256 character varying(64) NOT NULL,
    signer_name character varying(120) NOT NULL,
    decided_at timestamp with time zone NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    response_sha256 character varying(64) NOT NULL,
    CONSTRAINT visit_treatment_plan_responses_document_hash_check CHECK (((signed_document_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_responses_operation_payload_hash_check CHECK (((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_responses_response_hash_check CHECK (((response_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_responses_signature_hash_check CHECK (((signature_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_responses_signer_name_check CHECK (((length(btrim((signer_name)::text)) >= 1) AND (length(btrim((signer_name)::text)) <= 120)))
);


--
-- Name: visit_treatment_plan_revision_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plan_revision_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    sort_order integer NOT NULL,
    description character varying(500) NOT NULL,
    offered_quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_subtotal numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    taxable boolean NOT NULL,
    item_type public.visit_treatment_plan_item_type NOT NULL,
    service_id uuid,
    product_id uuid,
    CONSTRAINT visit_treatment_plan_revision_lines_catalog_target_check CHECK ((((item_type = 'service'::public.visit_treatment_plan_item_type) AND (service_id IS NOT NULL) AND (product_id IS NULL)) OR ((item_type = 'product'::public.visit_treatment_plan_item_type) AND (product_id IS NOT NULL) AND (service_id IS NULL)))),
    CONSTRAINT visit_treatment_plan_revision_lines_description_check CHECK (((length(btrim((description)::text)) >= 1) AND (length(btrim((description)::text)) <= 500))),
    CONSTRAINT visit_treatment_plan_revision_lines_money_check CHECK (((offered_quantity > (0)::numeric) AND (unit_price >= (0)::numeric) AND (line_subtotal = round((offered_quantity * unit_price), 2)) AND (tax_amount >= (0)::numeric) AND (line_total = (line_subtotal + tax_amount)))),
    CONSTRAINT visit_treatment_plan_revision_lines_sort_order_check CHECK ((sort_order >= 0))
);


--
-- Name: visit_treatment_plan_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plan_revisions (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    revision_number integer NOT NULL,
    currency character varying(3) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    authored_by uuid NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    content_sha256 character varying(64) NOT NULL,
    CONSTRAINT visit_treatment_plan_revisions_content_hash_check CHECK (((content_sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_revisions_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT visit_treatment_plan_revisions_number_check CHECK ((revision_number >= 1)),
    CONSTRAINT visit_treatment_plan_revisions_operation_payload_hash_check CHECK (((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plan_revisions_totals_check CHECK (((subtotal >= (0)::numeric) AND (tax >= (0)::numeric) AND (total = (subtotal + tax))))
);


--
-- Name: visit_treatment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_treatment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    practice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    status public.visit_treatment_plan_status DEFAULT 'open'::public.visit_treatment_plan_status NOT NULL,
    operation_id uuid NOT NULL,
    operation_payload_hash character varying(64) NOT NULL,
    CONSTRAINT visit_treatment_plans_operation_payload_hash_check CHECK (((operation_payload_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT visit_treatment_plans_title_check CHECK (((length(btrim((title)::text)) >= 1) AND (length(btrim((title)::text)) <= 255)))
);


--
-- Name: visit_work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_work_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    vaccination_record_id uuid,
    lab_result_id uuid,
    procedure_id uuid,
    prescription_id uuid,
    status public.visit_work_status DEFAULT 'unresolved'::public.visit_work_status NOT NULL,
    invoice_id uuid,
    invoice_item_id uuid,
    no_charge_reason text,
    void_reason text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    CONSTRAINT visit_work_items_exactly_one_source_check CHECK ((num_nonnulls(vaccination_record_id, lab_result_id, procedure_id, prescription_id) = 1)),
    CONSTRAINT visit_work_items_resolution_check CHECK ((((status = 'unresolved'::public.visit_work_status) AND (invoice_id IS NULL) AND (invoice_item_id IS NULL) AND (no_charge_reason IS NULL) AND (void_reason IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL)) OR ((status = 'charged'::public.visit_work_status) AND (invoice_id IS NOT NULL) AND (invoice_item_id IS NOT NULL) AND (no_charge_reason IS NULL) AND (void_reason IS NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL)) OR ((status = 'no_charge'::public.visit_work_status) AND (invoice_id IS NULL) AND (invoice_item_id IS NULL) AND (length(btrim(COALESCE(no_charge_reason, ''::text))) > 0) AND (void_reason IS NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL)) OR ((status = 'voided'::public.visit_work_status) AND (invoice_id IS NULL) AND (invoice_item_id IS NULL) AND (no_charge_reason IS NULL) AND (length(btrim(COALESCE(void_reason, ''::text))) > 0) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL))))
);


--
-- Name: vital_signs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vital_signs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    recorded_by uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    temperature_c numeric(4,1),
    heart_rate_bpm integer,
    respiratory_rate_bpm integer,
    weight_kg numeric(8,3),
    body_condition_score integer,
    pain_score integer,
    mucous_membrane character varying(64),
    capillary_refill_sec numeric(3,1),
    notes text,
    body_condition_scale integer DEFAULT 9 NOT NULL,
    CONSTRAINT vital_signs_body_condition_scale_check CHECK ((body_condition_scale = ANY (ARRAY[5, 9]))),
    CONSTRAINT vital_signs_body_condition_score_check CHECK (((body_condition_score IS NULL) OR ((body_condition_score >= 1) AND (body_condition_score <= body_condition_scale))))
);


--
-- Name: voice_dictations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_dictations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    dictated_by uuid NOT NULL,
    audio_file_key text,
    audio_mime_type text,
    audio_duration_seconds text,
    status public.voice_dictation_status DEFAULT 'RECORDING'::public.voice_dictation_status NOT NULL,
    language text DEFAULT 'sk'::text,
    raw_transcript text,
    formatted_soap jsonb,
    soap_note_id uuid,
    error_message text,
    transcribed_at timestamp with time zone,
    formatted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    model_id text NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    raw_ai_response jsonb,
    completed_at timestamp with time zone,
    audio_deleted_at timestamp with time zone,
    scheduled_delete_at timestamp with time zone,
    revision integer DEFAULT 0 NOT NULL
);


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    url character varying(512) NOT NULL,
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    secret character varying(255) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: wellness_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wellness_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    client_id uuid NOT NULL,
    patient_id uuid,
    status public.enrollment_status DEFAULT 'active'::public.enrollment_status NOT NULL,
    start_date date NOT NULL,
    next_billing_date date NOT NULL,
    cancelled_at timestamp with time zone
);


--
-- Name: wellness_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wellness_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    practice_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    billing_interval public.billing_interval DEFAULT 'monthly'::public.billing_interval NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_imaging_analyses ai_imaging_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: appointment_types appointment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_types
    ADD CONSTRAINT appointment_types_pkey PRIMARY KEY (id);


--
-- Name: appointment_waitlist appointment_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_email_attempts auth_email_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_attempts
    ADD CONSTRAINT auth_email_attempts_pkey PRIMARY KEY (id);


--
-- Name: auth_email_delivery_events auth_email_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_delivery_events
    ADD CONSTRAINT auth_email_delivery_events_pkey PRIMARY KEY (id);


--
-- Name: auth_email_provider_identity_conflicts auth_email_provider_identity_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_provider_identity_conflicts
    ADD CONSTRAINT auth_email_provider_identity_conflicts_pkey PRIMARY KEY (id);


--
-- Name: auth_email_webhook_conflicts auth_email_webhook_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_webhook_conflicts
    ADD CONSTRAINT auth_email_webhook_conflicts_pkey PRIMARY KEY (id);


--
-- Name: auth_tokens auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_pkey PRIMARY KEY (id);


--
-- Name: backup_runs backup_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_runs
    ADD CONSTRAINT backup_runs_pkey PRIMARY KEY (id);


--
-- Name: booking_pages booking_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_pages
    ADD CONSTRAINT booking_pages_pkey PRIMARY KEY (id);


--
-- Name: booking_pages booking_pages_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_pages
    ADD CONSTRAINT booking_pages_slug_unique UNIQUE (slug);


--
-- Name: capture_sessions capture_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_pkey PRIMARY KEY (id);


--
-- Name: care_reminders care_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_pkey PRIMARY KEY (id);


--
-- Name: case_entries case_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_entries
    ADD CONSTRAINT case_entries_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: client_contacts client_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);


--
-- Name: clients clients_access_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_access_token_unique UNIQUE (access_token);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clinic_pilot_events clinic_pilot_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_pkey PRIMARY KEY (id);


--
-- Name: clinic_pilots clinic_pilots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilots
    ADD CONSTRAINT clinic_pilots_pkey PRIMARY KEY (id);


--
-- Name: clinical_notes clinical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_pkey PRIMARY KEY (id);


--
-- Name: clinical_record_corrections clinical_record_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_pkey PRIMARY KEY (id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: consent_forms consent_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_forms
    ADD CONSTRAINT consent_forms_pkey PRIMARY KEY (id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_pkey PRIMARY KEY (id);


--
-- Name: consent_requests consent_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_pkey PRIMARY KEY (id);


--
-- Name: controlled_substance_log controlled_substance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_log
    ADD CONSTRAINT controlled_substance_log_pkey PRIMARY KEY (id);


--
-- Name: demo_accesses demo_accesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_accesses
    ADD CONSTRAINT demo_accesses_pkey PRIMARY KEY (id);


--
-- Name: dental_charts dental_charts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_charts
    ADD CONSTRAINT dental_charts_pkey PRIMARY KEY (id);


--
-- Name: discharge_reports discharge_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_reports
    ADD CONSTRAINT discharge_reports_pkey PRIMARY KEY (id);


--
-- Name: dispense_charge_queue dispense_charge_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_pkey PRIMARY KEY (id);


--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);


--
-- Name: ekasa_config ekasa_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_config
    ADD CONSTRAINT ekasa_config_pkey PRIMARY KEY (id);


--
-- Name: ekasa_daily_closures ekasa_daily_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_daily_closures
    ADD CONSTRAINT ekasa_daily_closures_pkey PRIMARY KEY (id);


--
-- Name: ekasa_receipts ekasa_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_receipts
    ADD CONSTRAINT ekasa_receipts_pkey PRIMARY KEY (id);


--
-- Name: email_suppressions email_suppressions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT email_suppressions_pkey PRIMARY KEY (id);


--
-- Name: ext_ai_audit_log ext_ai_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_ai_audit_log
    ADD CONSTRAINT ext_ai_audit_log_pkey PRIMARY KEY (id);


--
-- Name: ext_ai_settings ext_ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_ai_settings
    ADD CONSTRAINT ext_ai_settings_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_enrollments ext_automation_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_automation_enrollments_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_events ext_automation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_automation_events_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_journeys ext_automation_journeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_journeys
    ADD CONSTRAINT ext_automation_journeys_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_rules ext_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_rules
    ADD CONSTRAINT ext_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_pkey PRIMARY KEY (id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_pkey PRIMARY KEY (id);


--
-- Name: ext_carcass_disposals ext_carcass_disposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_carcass_disposals
    ADD CONSTRAINT ext_carcass_disposals_pkey PRIMARY KEY (id);


--
-- Name: ext_channel_accounts ext_channel_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_channel_accounts
    ADD CONSTRAINT ext_channel_accounts_pkey PRIMARY KEY (id);


--
-- Name: ext_clinical_guardian_alerts ext_clinical_guardian_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinical_guardian_alerts
    ADD CONSTRAINT ext_clinical_guardian_alerts_pkey PRIMARY KEY (id);


--
-- Name: ext_clinician_confirmations ext_clinician_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinician_confirmations
    ADD CONSTRAINT ext_clinician_confirmations_pkey PRIMARY KEY (id);


--
-- Name: ext_content_briefs ext_content_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_pkey PRIMARY KEY (id);


--
-- Name: ext_content_pillars ext_content_pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_pillars
    ADD CONSTRAINT ext_content_pillars_pkey PRIMARY KEY (id);


--
-- Name: ext_crm_segment_memberships ext_crm_segment_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_segment_memberships_pkey PRIMARY KEY (id);


--
-- Name: ext_crm_segments ext_crm_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segments
    ADD CONSTRAINT ext_crm_segments_pkey PRIMARY KEY (id);


--
-- Name: ext_kvepis_credentials ext_kvepis_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_credentials
    ADD CONSTRAINT ext_kvepis_credentials_pkey PRIMARY KEY (id);


--
-- Name: ext_kvepis_submissions ext_kvepis_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_submissions
    ADD CONSTRAINT ext_kvepis_submissions_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_automation_rules ext_marketing_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_automation_rules
    ADD CONSTRAINT ext_marketing_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_competitor_snapshots ext_marketing_competitor_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_competitor_snapshots
    ADD CONSTRAINT ext_marketing_competitor_snapshots_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_content_batches ext_marketing_content_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_batches
    ADD CONSTRAINT ext_marketing_content_batches_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_handouts ext_marketing_handouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_handouts
    ADD CONSTRAINT ext_marketing_handouts_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_media_assets ext_marketing_media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_assets
    ADD CONSTRAINT ext_marketing_media_assets_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_media_consents ext_marketing_media_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_consents
    ADD CONSTRAINT ext_marketing_media_consents_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_message_templates ext_marketing_message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_templates
    ADD CONSTRAINT ext_marketing_message_templates_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_operative_scripts ext_marketing_operative_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_operative_scripts
    ADD CONSTRAINT ext_marketing_operative_scripts_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_postop_responses ext_marketing_postop_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_postop_responses
    ADD CONSTRAINT ext_marketing_postop_responses_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_recall_schedules ext_marketing_recall_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_recall_schedules
    ADD CONSTRAINT ext_marketing_recall_schedules_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_staff_tasks ext_marketing_staff_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_staff_tasks
    ADD CONSTRAINT ext_marketing_staff_tasks_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_tv_slides ext_marketing_tv_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_tv_slides
    ADD CONSTRAINT ext_marketing_tv_slides_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_website_config ext_marketing_website_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_website_config
    ADD CONSTRAINT ext_marketing_website_config_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_website_inquiries ext_marketing_website_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_website_inquiries
    ADD CONSTRAINT ext_marketing_website_inquiries_pkey PRIMARY KEY (id);


--
-- Name: ext_marketing_wellness_redemptions ext_marketing_wellness_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_wellness_redemptions
    ADD CONSTRAINT ext_marketing_wellness_redemptions_pkey PRIMARY KEY (id);


--
-- Name: ext_pilot_feedback ext_pilot_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_pilot_feedback
    ADD CONSTRAINT ext_pilot_feedback_pkey PRIMARY KEY (id);


--
-- Name: ext_rabies_notifications ext_rabies_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_notifications
    ADD CONSTRAINT ext_rabies_notifications_pkey PRIMARY KEY (id);


--
-- Name: ext_rabies_observations ext_rabies_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_observations
    ADD CONSTRAINT ext_rabies_observations_pkey PRIMARY KEY (id);


--
-- Name: ext_sms_delivery_log ext_sms_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_sms_delivery_log
    ADD CONSTRAINT ext_sms_delivery_log_pkey PRIMARY KEY (id);


--
-- Name: ext_support_session_audit ext_support_session_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_support_session_audit
    ADD CONSTRAINT ext_support_session_audit_pkey PRIMARY KEY (id);


--
-- Name: ext_support_sessions ext_support_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_support_sessions
    ADD CONSTRAINT ext_support_sessions_pkey PRIMARY KEY (id);


--
-- Name: ext_support_sessions ext_support_sessions_session_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_support_sessions
    ADD CONSTRAINT ext_support_sessions_session_code_unique UNIQUE (session_code);


--
-- Name: ext_withdrawal_periods ext_withdrawal_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_withdrawal_periods
    ADD CONSTRAINT ext_withdrawal_periods_pkey PRIMARY KEY (id);


--
-- Name: external_lab_observations external_lab_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_observations
    ADD CONSTRAINT external_lab_observations_pkey PRIMARY KEY (id);


--
-- Name: external_lab_reports external_lab_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_reports
    ADD CONSTRAINT external_lab_reports_pkey PRIMARY KEY (id);


--
-- Name: external_prescription_fills external_prescription_fills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescription_fills
    ADD CONSTRAINT external_prescription_fills_pkey PRIMARY KEY (id);


--
-- Name: external_prescriptions external_prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescriptions
    ADD CONSTRAINT external_prescriptions_pkey PRIMARY KEY (id);


--
-- Name: file_object_replicas file_object_replicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_object_replicas
    ADD CONSTRAINT file_object_replicas_pkey PRIMARY KEY (id);


--
-- Name: file_storage_events file_storage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_storage_events
    ADD CONSTRAINT file_storage_events_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: financial_closes financial_closes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_closes
    ADD CONSTRAINT financial_closes_pkey PRIMARY KEY (id);


--
-- Name: funnel_events funnel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_events
    ADD CONSTRAINT funnel_events_pkey PRIMARY KEY (id);


--
-- Name: historical_appointments historical_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_appointments
    ADD CONSTRAINT historical_appointments_pkey PRIMARY KEY (id);


--
-- Name: historical_documents historical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_pkey PRIMARY KEY (id);


--
-- Name: insurance_claims insurance_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_pkey PRIMARY KEY (id);


--
-- Name: insurance_policies insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: invoice_adjustments invoice_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_adjustments
    ADD CONSTRAINT invoice_adjustments_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: kvl_cr_passports kvl_cr_passports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kvl_cr_passports
    ADD CONSTRAINT kvl_cr_passports_pkey PRIMARY KEY (id);


--
-- Name: lab_analyzer_reports lab_analyzer_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_analyzer_reports
    ADD CONSTRAINT lab_analyzer_reports_pkey PRIMARY KEY (id);


--
-- Name: lab_result_events lab_result_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_pkey PRIMARY KEY (id);


--
-- Name: lab_result_replacements lab_result_replacements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: legacy_financial_allocations legacy_financial_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_allocations
    ADD CONSTRAINT legacy_financial_allocations_pkey PRIMARY KEY (id);


--
-- Name: legacy_financial_documents legacy_financial_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_documents
    ADD CONSTRAINT legacy_financial_documents_pkey PRIMARY KEY (id);


--
-- Name: legacy_financial_line_items legacy_financial_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_line_items
    ADD CONSTRAINT legacy_financial_line_items_pkey PRIMARY KEY (id);


--
-- Name: legacy_financial_payments legacy_financial_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_payments
    ADD CONSTRAINT legacy_financial_payments_pkey PRIMARY KEY (id);


--
-- Name: location_messaging location_messaging_location_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_messaging
    ADD CONSTRAINT location_messaging_location_id_unique UNIQUE (location_id);


--
-- Name: location_messaging location_messaging_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_messaging
    ADD CONSTRAINT location_messaging_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: messaging_registration_events messaging_registration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_pkey PRIMARY KEY (id);


--
-- Name: messaging_registrations messaging_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registrations
    ADD CONSTRAINT messaging_registrations_pkey PRIMARY KEY (id);


--
-- Name: microchip_registrations microchip_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microchip_registrations
    ADD CONSTRAINT microchip_registrations_pkey PRIMARY KEY (id);


--
-- Name: migration_runs migration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_pkey PRIMARY KEY (id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_merge_events patient_merge_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_pkey PRIMARY KEY (id);


--
-- Name: patient_weights patient_weights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_weights
    ADD CONSTRAINT patient_weights_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_disputes payment_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_pkey PRIMARY KEY (id);


--
-- Name: payment_processor_payouts payment_processor_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_payouts
    ADD CONSTRAINT payment_processor_payouts_pkey PRIMARY KEY (id);


--
-- Name: payment_processor_refunds payment_processor_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_pkey PRIMARY KEY (id);


--
-- Name: payment_processor_settlements payment_processor_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pet_passports pet_passports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_pkey PRIMARY KEY (id);


--
-- Name: platform_email_identity_aliases platform_email_identity_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_email_identity_aliases
    ADD CONSTRAINT platform_email_identity_aliases_pkey PRIMARY KEY (id);


--
-- Name: platform_email_identity platform_email_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_email_identity
    ADD CONSTRAINT platform_email_identity_pkey PRIMARY KEY (key_slot);


--
-- Name: platform_email_preference_events platform_email_preference_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_email_preference_events
    ADD CONSTRAINT platform_email_preference_events_pkey PRIMARY KEY (id);


--
-- Name: platform_email_preferences platform_email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_email_preferences
    ADD CONSTRAINT platform_email_preferences_pkey PRIMARY KEY (id);


--
-- Name: portal_sessions portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: practice_conversion_milestones practice_conversion_milestones_practice_id_milestone_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_conversion_milestones
    ADD CONSTRAINT practice_conversion_milestones_practice_id_milestone_pk PRIMARY KEY (practice_id, milestone);


--
-- Name: practice_payment_accounts practice_payment_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_payment_accounts
    ADD CONSTRAINT practice_payment_accounts_pkey PRIMARY KEY (id);


--
-- Name: practices practices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practices
    ADD CONSTRAINT practices_pkey PRIMARY KEY (id);


--
-- Name: prescription_events prescription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: problem_list problem_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_list
    ADD CONSTRAINT problem_list_pkey PRIMARY KEY (id);


--
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key);


--
-- Name: recent_clinical_items recent_clinical_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_pkey PRIMARY KEY (id);


--
-- Name: recurring_series recurring_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_series
    ADD CONSTRAINT recurring_series_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_token_unique UNIQUE (session_token);


--
-- Name: sms_consent_events sms_consent_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_pkey PRIMARY KEY (id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_pkey PRIMARY KEY (id);


--
-- Name: sms_delivery_events sms_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_events
    ADD CONSTRAINT sms_delivery_events_pkey PRIMARY KEY (id);


--
-- Name: sms_provider_event_conflict_reviews sms_provider_event_conflict_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_conflict_reviews
    ADD CONSTRAINT sms_provider_event_conflict_reviews_pkey PRIMARY KEY (id);


--
-- Name: sms_provider_event_conflicts sms_provider_event_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_conflicts
    ADD CONSTRAINT sms_provider_event_conflicts_pkey PRIMARY KEY (id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_pkey PRIMARY KEY (id);


--
-- Name: sms_provider_events sms_provider_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_events
    ADD CONSTRAINT sms_provider_events_pkey PRIMARY KEY (id);


--
-- Name: sms_send_attempt_events sms_send_attempt_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempt_events
    ADD CONSTRAINT sms_send_attempt_events_pkey PRIMARY KEY (id);


--
-- Name: sms_send_attempts sms_send_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_pkey PRIMARY KEY (id);


--
-- Name: sms_suppressions sms_suppressions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_suppressions
    ADD CONSTRAINT sms_suppressions_pkey PRIMARY KEY (id);


--
-- Name: soap_note_addenda soap_note_addenda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_addenda
    ADD CONSTRAINT soap_note_addenda_pkey PRIMARY KEY (id);


--
-- Name: soap_note_replacements soap_note_replacements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_pkey PRIMARY KEY (id);


--
-- Name: soap_notes soap_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_pkey PRIMARY KEY (id);


--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);


--
-- Name: stripe_events stripe_events_event_id_endpoint_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_event_id_endpoint_pk PRIMARY KEY (event_id, endpoint);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: treatment_plan_items treatment_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plan_items
    ADD CONSTRAINT treatment_plan_items_pkey PRIMARY KEY (id);


--
-- Name: treatment_plans treatment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_pkey PRIMARY KEY (id);


--
-- Name: treatment_template_items treatment_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_template_items
    ADD CONSTRAINT treatment_template_items_pkey PRIMARY KEY (id);


--
-- Name: treatment_templates treatment_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_templates
    ADD CONSTRAINT treatment_templates_pkey PRIMARY KEY (id);


--
-- Name: usage_records usage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vaccination_records vaccination_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_identifier_token_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_identifier_token_pk PRIMARY KEY (identifier, token);


--
-- Name: verification_tokens verification_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_token_unique UNIQUE (token);


--
-- Name: visit_closeouts visit_closeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_presentations
    ADD CONSTRAINT visit_treatment_plan_presentations_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plan_response_lines visit_treatment_plan_response_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_response_lines
    ADD CONSTRAINT visit_treatment_plan_response_lines_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plan_responses visit_treatment_plan_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_responses
    ADD CONSTRAINT visit_treatment_plan_responses_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revision_lines
    ADD CONSTRAINT visit_treatment_plan_revision_lines_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revisions
    ADD CONSTRAINT visit_treatment_plan_revisions_pkey PRIMARY KEY (id);


--
-- Name: visit_treatment_plans visit_treatment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plans
    ADD CONSTRAINT visit_treatment_plans_pkey PRIMARY KEY (id);


--
-- Name: visit_work_items visit_work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_pkey PRIMARY KEY (id);


--
-- Name: vital_signs vital_signs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_pkey PRIMARY KEY (id);


--
-- Name: voice_dictations voice_dictations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_dictations
    ADD CONSTRAINT voice_dictations_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: wellness_enrollments wellness_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_enrollments
    ADD CONSTRAINT wellness_enrollments_pkey PRIMARY KEY (id);


--
-- Name: wellness_plans wellness_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_plans
    ADD CONSTRAINT wellness_plans_pkey PRIMARY KEY (id);


--
-- Name: ai_imaging_analyses_file_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_imaging_analyses_file_idx ON public.ai_imaging_analyses USING btree (file_id);


--
-- Name: ai_imaging_analyses_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_imaging_analyses_patient_idx ON public.ai_imaging_analyses USING btree (practice_id, patient_id, deleted_at);


--
-- Name: ai_imaging_analyses_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_imaging_analyses_practice_idx ON public.ai_imaging_analyses USING btree (practice_id, deleted_at);


--
-- Name: ai_imaging_analyses_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_imaging_analyses_status_idx ON public.ai_imaging_analyses USING btree (practice_id, status, deleted_at);


--
-- Name: api_keys_practice_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_practice_created_idx ON public.api_keys USING btree (practice_id, deleted_at, created_at);


--
-- Name: api_keys_prefix_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_prefix_idx ON public.api_keys USING btree (key_prefix);


--
-- Name: appointment_types_practice_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointment_types_practice_name_idx ON public.appointment_types USING btree (practice_id, deleted_at, name);


--
-- Name: appointments_client_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_client_status_idx ON public.appointments USING btree (practice_id, client_id, status, deleted_at);


--
-- Name: appointments_conversion_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_conversion_created_idx ON public.appointments USING btree (practice_id, created_at, id);


--
-- Name: appointments_doctor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_doctor_idx ON public.appointments USING btree (doctor_id, start_time);


--
-- Name: appointments_doctor_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_doctor_status_idx ON public.appointments USING btree (practice_id, doctor_id, status, deleted_at);


--
-- Name: appointments_location_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_location_time_idx ON public.appointments USING btree (practice_id, location_id, start_time, deleted_at);


--
-- Name: appointments_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_patient_idx ON public.appointments USING btree (patient_id);


--
-- Name: appointments_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_patient_status_idx ON public.appointments USING btree (practice_id, patient_id, status, deleted_at);


--
-- Name: appointments_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointments_practice_id_uq ON public.appointments USING btree (practice_id, id);


--
-- Name: appointments_practice_patient_client_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointments_practice_patient_client_id_uq ON public.appointments USING btree (practice_id, id, patient_id, client_id);


--
-- Name: appointments_practice_patient_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointments_practice_patient_id_uq ON public.appointments USING btree (practice_id, id, patient_id);


--
-- Name: appointments_practice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_practice_time_idx ON public.appointments USING btree (practice_id, start_time, doctor_id);


--
-- Name: appointments_room_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_room_status_idx ON public.appointments USING btree (practice_id, room_id, status, deleted_at);


--
-- Name: appointments_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_type_status_idx ON public.appointments USING btree (practice_id, type_id, status, deleted_at);


--
-- Name: audit_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_entity_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_log_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_practice_idx ON public.audit_log USING btree (practice_id, created_at);


--
-- Name: auth_email_attempts_idempotency_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_email_attempts_idempotency_uq ON public.auth_email_attempts USING btree (idempotency_key);


--
-- Name: auth_email_attempts_practice_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_attempts_practice_created_idx ON public.auth_email_attempts USING btree (practice_id, created_at, id);


--
-- Name: auth_email_attempts_provider_message_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_email_attempts_provider_message_uq ON public.auth_email_attempts USING btree (provider, provider_message_id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: auth_email_attempts_recovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_attempts_recovery_idx ON public.auth_email_attempts USING btree (outcome, created_at, id);


--
-- Name: auth_email_delivery_events_attempt_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_delivery_events_attempt_timeline_idx ON public.auth_email_delivery_events USING btree (attempt_id, occurred_at, id);


--
-- Name: auth_email_delivery_events_attribution_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_delivery_events_attribution_queue_idx ON public.auth_email_delivery_events USING btree (attribution, received_at, id);


--
-- Name: auth_email_delivery_events_provider_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_delivery_events_provider_timeline_idx ON public.auth_email_delivery_events USING btree (provider, provider_message_id, occurred_at, id);


--
-- Name: auth_email_delivery_events_webhook_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_email_delivery_events_webhook_uq ON public.auth_email_delivery_events USING btree (webhook_id);


--
-- Name: auth_email_provider_identity_conflicts_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_email_provider_identity_conflicts_identity_uq ON public.auth_email_provider_identity_conflicts USING btree (attempt_id, provider, durable_provider_message_id, conflicting_provider_message_id);


--
-- Name: auth_email_provider_identity_conflicts_recovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_provider_identity_conflicts_recovery_idx ON public.auth_email_provider_identity_conflicts USING btree (occurred_at, id);


--
-- Name: auth_email_webhook_conflicts_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_email_webhook_conflicts_identity_uq ON public.auth_email_webhook_conflicts USING btree (original_webhook_id, incoming_raw_body_fingerprint);


--
-- Name: auth_email_webhook_conflicts_recovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_email_webhook_conflicts_recovery_idx ON public.auth_email_webhook_conflicts USING btree (received_at, id);


--
-- Name: auth_tokens_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_tokens_expires_idx ON public.auth_tokens USING btree (expires_at);


--
-- Name: auth_tokens_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_tokens_hash_idx ON public.auth_tokens USING btree (token_hash);


--
-- Name: backup_runs_completed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX backup_runs_completed_idx ON public.backup_runs USING btree (completed_at, id);


--
-- Name: booking_pages_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_pages_practice_idx ON public.booking_pages USING btree (practice_id, deleted_at);


--
-- Name: booking_pages_slug_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_pages_slug_published_idx ON public.booking_pages USING btree (slug, published, deleted_at);


--
-- Name: capture_sessions_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capture_sessions_patient_idx ON public.capture_sessions USING btree (patient_id);


--
-- Name: capture_sessions_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capture_sessions_practice_idx ON public.capture_sessions USING btree (practice_id, deleted_at);


--
-- Name: capture_sessions_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX capture_sessions_token_uq ON public.capture_sessions USING btree (token);


--
-- Name: care_reminders_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX care_reminders_external_id_uq ON public.care_reminders USING btree (practice_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: care_reminders_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX care_reminders_import_fingerprint_uq ON public.care_reminders USING btree (practice_id, import_fingerprint) WHERE (import_fingerprint IS NOT NULL);


--
-- Name: care_reminders_open_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX care_reminders_open_due_idx ON public.care_reminders USING btree (practice_id, due_date, id) WHERE ((status = 'open'::public.care_reminder_status) AND (deleted_at IS NULL));


--
-- Name: care_reminders_patient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX care_reminders_patient_timeline_idx ON public.care_reminders USING btree (practice_id, patient_id, due_date, id);


--
-- Name: case_entries_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_entries_case_idx ON public.case_entries USING btree (case_id, deleted_at);


--
-- Name: cases_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_patient_status_idx ON public.cases USING btree (patient_id, status);


--
-- Name: cases_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_practice_status_idx ON public.cases USING btree (practice_id, status, deleted_at);


--
-- Name: client_contacts_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_contacts_client_idx ON public.client_contacts USING btree (practice_id, client_id, deleted_at, last_name, first_name);


--
-- Name: client_contacts_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_contacts_external_id_uq ON public.client_contacts USING btree (practice_id, external_source, external_id) WHERE (external_source IS NOT NULL);


--
-- Name: client_contacts_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_contacts_import_fingerprint_uq ON public.client_contacts USING btree (practice_id, import_fingerprint) WHERE (import_fingerprint IS NOT NULL);


--
-- Name: client_contacts_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_contacts_practice_id_uq ON public.client_contacts USING btree (practice_id, id);


--
-- Name: clients_conversion_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clients_conversion_created_idx ON public.clients USING btree (practice_id, created_at, id);


--
-- Name: clients_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clients_email_idx ON public.clients USING btree (email);


--
-- Name: clients_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_external_id_uq ON public.clients USING btree (practice_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: clients_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_import_fingerprint_uq ON public.clients USING btree (practice_id, import_fingerprint) WHERE ((import_fingerprint IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: clients_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clients_name_trgm_idx ON public.clients USING btree (first_name, last_name);


--
-- Name: clients_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_practice_id_uq ON public.clients USING btree (practice_id, id);


--
-- Name: clients_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clients_practice_idx ON public.clients USING btree (practice_id, deleted_at);


--
-- Name: clinic_pilot_events_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinic_pilot_events_history_idx ON public.clinic_pilot_events USING btree (practice_id, created_at, id);


--
-- Name: clinic_pilot_events_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinic_pilot_events_operation_uq ON public.clinic_pilot_events USING btree (operation_id);


--
-- Name: clinic_pilots_id_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinic_pilots_id_practice_uq ON public.clinic_pilots USING btree (id, practice_id);


--
-- Name: clinic_pilots_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinic_pilots_practice_uq ON public.clinic_pilots USING btree (practice_id);


--
-- Name: clinic_pilots_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinic_pilots_review_idx ON public.clinic_pilots USING btree (stage, next_review_at, practice_id);


--
-- Name: clinical_notes_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_notes_patient_idx ON public.clinical_notes USING btree (patient_id, note_type);


--
-- Name: clinical_notes_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_notes_practice_idx ON public.clinical_notes USING btree (practice_id, deleted_at);


--
-- Name: clinical_record_corrections_lab_result_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_lab_result_uq ON public.clinical_record_corrections USING btree (practice_id, lab_result_id) WHERE (lab_result_id IS NOT NULL);


--
-- Name: clinical_record_corrections_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_operation_uq ON public.clinical_record_corrections USING btree (practice_id, operation_id) WHERE (operation_id IS NOT NULL);


--
-- Name: clinical_record_corrections_patient_allergy_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_patient_allergy_uq ON public.clinical_record_corrections USING btree (practice_id, patient_allergy_id) WHERE (patient_allergy_id IS NOT NULL);


--
-- Name: clinical_record_corrections_practice_appointment_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_record_corrections_practice_appointment_history_idx ON public.clinical_record_corrections USING btree (practice_id, appointment_id, created_at, id);


--
-- Name: clinical_record_corrections_practice_patient_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_record_corrections_practice_patient_history_idx ON public.clinical_record_corrections USING btree (practice_id, patient_id, created_at, id);


--
-- Name: clinical_record_corrections_practice_record_lab_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_practice_record_lab_source_uq ON public.clinical_record_corrections USING btree (practice_id, id, lab_result_id);


--
-- Name: clinical_record_corrections_practice_record_soap_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_practice_record_soap_source_uq ON public.clinical_record_corrections USING btree (practice_id, id, soap_note_id);


--
-- Name: clinical_record_corrections_practice_type_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clinical_record_corrections_practice_type_history_idx ON public.clinical_record_corrections USING btree (practice_id, record_type, created_at, id);


--
-- Name: clinical_record_corrections_soap_note_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_soap_note_uq ON public.clinical_record_corrections USING btree (practice_id, soap_note_id) WHERE (soap_note_id IS NOT NULL);


--
-- Name: clinical_record_corrections_vaccination_record_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_vaccination_record_uq ON public.clinical_record_corrections USING btree (practice_id, vaccination_record_id) WHERE (vaccination_record_id IS NOT NULL);


--
-- Name: clinical_record_corrections_vital_sign_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clinical_record_corrections_vital_sign_uq ON public.clinical_record_corrections USING btree (practice_id, vital_sign_id) WHERE (vital_sign_id IS NOT NULL);


--
-- Name: communications_assigned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_assigned_idx ON public.communications USING btree (practice_id, assigned_to, deleted_at);


--
-- Name: communications_client_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_client_timeline_idx ON public.communications USING btree (practice_id, client_id, deleted_at, created_at);


--
-- Name: communications_dedupe_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communications_dedupe_key_idx ON public.communications USING btree (dedupe_key);


--
-- Name: communications_inbox_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_inbox_status_idx ON public.communications USING btree (practice_id, direction, status, deleted_at);


--
-- Name: communications_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communications_practice_id_uq ON public.communications USING btree (practice_id, id);


--
-- Name: communications_practice_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_practice_list_idx ON public.communications USING btree (practice_id, deleted_at, created_at);


--
-- Name: communications_provider_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_provider_message_idx ON public.communications USING btree (practice_id, provider_message_id, channel, direction);


--
-- Name: consent_forms_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_forms_practice_id_uq ON public.consent_forms USING btree (practice_id, id);


--
-- Name: consent_forms_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_forms_practice_idx ON public.consent_forms USING btree (practice_id, deleted_at);


--
-- Name: consent_forms_practice_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_forms_practice_slug_uq ON public.consent_forms USING btree (practice_id, slug);


--
-- Name: consent_receipt_capabilities_consent_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_receipt_capabilities_consent_uq ON public.consent_receipt_capabilities USING btree (practice_id, consent_request_id);


--
-- Name: consent_receipt_capabilities_practice_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_receipt_capabilities_practice_expiry_idx ON public.consent_receipt_capabilities USING btree (practice_id, expires_at) WHERE (deleted_at IS NULL);


--
-- Name: consent_receipt_capabilities_token_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_receipt_capabilities_token_hash_uq ON public.consent_receipt_capabilities USING btree (token_hash);


--
-- Name: consent_requests_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_requests_patient_idx ON public.consent_requests USING btree (patient_id);


--
-- Name: consent_requests_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_requests_practice_id_uq ON public.consent_requests USING btree (practice_id, id);


--
-- Name: consent_requests_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_requests_practice_idx ON public.consent_requests USING btree (practice_id, deleted_at);


--
-- Name: consent_requests_token_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_requests_token_hash_uq ON public.consent_requests USING btree (token_hash);


--
-- Name: consent_requests_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX consent_requests_token_uq ON public.consent_requests USING btree (token);


--
-- Name: cs_log_practice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cs_log_practice_date_idx ON public.controlled_substance_log USING btree (practice_id, deleted_at, performed_at);


--
-- Name: cs_log_practice_drug_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cs_log_practice_drug_date_idx ON public.controlled_substance_log USING btree (practice_id, drug_name, performed_at);


--
-- Name: demo_accesses_email_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX demo_accesses_email_hash_uq ON public.demo_accesses USING btree (email_hash);


--
-- Name: demo_accesses_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX demo_accesses_email_uq ON public.demo_accesses USING btree (email);


--
-- Name: demo_accesses_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demo_accesses_recent_idx ON public.demo_accesses USING btree (last_accessed_at);


--
-- Name: dental_charts_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dental_charts_patient_idx ON public.dental_charts USING btree (practice_id, patient_id, deleted_at);


--
-- Name: dental_charts_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dental_charts_practice_idx ON public.dental_charts USING btree (practice_id, deleted_at);


--
-- Name: dental_charts_tooth_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dental_charts_tooth_idx ON public.dental_charts USING btree (practice_id, patient_id, tooth_code);


--
-- Name: discharge_reports_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discharge_reports_patient_idx ON public.discharge_reports USING btree (practice_id, patient_id, deleted_at);


--
-- Name: discharge_reports_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discharge_reports_practice_idx ON public.discharge_reports USING btree (practice_id, deleted_at);


--
-- Name: dispense_charge_queue_invoice_item_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dispense_charge_queue_invoice_item_uq ON public.dispense_charge_queue USING btree (invoice_item_id) WHERE (invoice_item_id IS NOT NULL);


--
-- Name: dispense_charge_queue_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispense_charge_queue_patient_idx ON public.dispense_charge_queue USING btree (practice_id, patient_id, created_at, id);


--
-- Name: dispense_charge_queue_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispense_charge_queue_pending_idx ON public.dispense_charge_queue USING btree (practice_id, created_at, id) WHERE (status = 'pending'::public.dispense_charge_status);


--
-- Name: dispense_charge_queue_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dispense_charge_queue_source_uq ON public.dispense_charge_queue USING btree (practice_id, prescription_event_id);


--
-- Name: ekasa_config_practice_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ekasa_config_practice_active_uq ON public.ekasa_config USING btree (practice_id, is_active);


--
-- Name: ekasa_config_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_config_practice_idx ON public.ekasa_config USING btree (practice_id, deleted_at);


--
-- Name: ekasa_daily_closures_closed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_daily_closures_closed_by_idx ON public.ekasa_daily_closures USING btree (closed_by);


--
-- Name: ekasa_daily_closures_date_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ekasa_daily_closures_date_practice_uq ON public.ekasa_daily_closures USING btree (practice_id, date);


--
-- Name: ekasa_daily_closures_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_daily_closures_practice_idx ON public.ekasa_daily_closures USING btree (practice_id, deleted_at);


--
-- Name: ekasa_receipts_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_receipts_invoice_idx ON public.ekasa_receipts USING btree (invoice_id);


--
-- Name: ekasa_receipts_issued_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_receipts_issued_at_idx ON public.ekasa_receipts USING btree (practice_id, issued_at, deleted_at);


--
-- Name: ekasa_receipts_number_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ekasa_receipts_number_practice_uq ON public.ekasa_receipts USING btree (practice_id, receipt_number);


--
-- Name: ekasa_receipts_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_receipts_payment_idx ON public.ekasa_receipts USING btree (payment_id);


--
-- Name: ekasa_receipts_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_receipts_practice_idx ON public.ekasa_receipts USING btree (practice_id, deleted_at);


--
-- Name: ekasa_receipts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ekasa_receipts_status_idx ON public.ekasa_receipts USING btree (practice_id, status, deleted_at);


--
-- Name: ekasa_receipts_uid_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ekasa_receipts_uid_uq ON public.ekasa_receipts USING btree (uid);


--
-- Name: email_suppressions_practice_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_suppressions_practice_email_uq ON public.email_suppressions USING btree (practice_id, email);


--
-- Name: email_suppressions_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_suppressions_practice_idx ON public.email_suppressions USING btree (practice_id, deleted_at);


--
-- Name: ext_ai_audit_log_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_ai_audit_log_actor_idx ON public.ext_ai_audit_log USING btree (actor_id, confirmed_at);


--
-- Name: ext_ai_audit_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_ai_audit_log_entity_idx ON public.ext_ai_audit_log USING btree (entity_type, entity_id);


--
-- Name: ext_ai_audit_log_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_ai_audit_log_practice_idx ON public.ext_ai_audit_log USING btree (practice_id, deleted_at);


--
-- Name: ext_ai_audit_log_practice_seq_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_ai_audit_log_practice_seq_uniq ON public.ext_ai_audit_log USING btree (practice_id, sequence_number);


--
-- Name: ext_ai_settings_practice_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_ai_settings_practice_active_uq ON public.ext_ai_settings USING btree (practice_id, is_active);


--
-- Name: ext_ai_settings_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_ai_settings_practice_idx ON public.ext_ai_settings USING btree (practice_id, deleted_at);


--
-- Name: ext_auto_enroll_client_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_enroll_client_status_idx ON public.ext_automation_enrollments USING btree (practice_id, client_id, status);


--
-- Name: ext_auto_enroll_dedupe_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_enroll_dedupe_uq ON public.ext_automation_enrollments USING btree (practice_id, journey_id, client_id, trigger_event_id);


--
-- Name: ext_auto_enroll_journey_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_enroll_journey_status_idx ON public.ext_automation_enrollments USING btree (practice_id, journey_id, status);


--
-- Name: ext_auto_events_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_events_appointment_idx ON public.ext_automation_events USING btree (practice_id, appointment_id);


--
-- Name: ext_auto_events_emission_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_events_emission_uq ON public.ext_automation_events USING btree (practice_id, event_type, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: ext_auto_events_practice_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_events_practice_client_idx ON public.ext_automation_events USING btree (practice_id, client_id, occurred_at);


--
-- Name: ext_auto_events_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_events_queue_idx ON public.ext_automation_events USING btree (status, available_at, id) WHERE ((status = 'pending'::public.ext_automation_event_status) AND (deleted_at IS NULL));


--
-- Name: ext_auto_events_stuck_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_events_stuck_idx ON public.ext_automation_events USING btree (locked_at) WHERE (status = 'processing'::public.ext_automation_event_status);


--
-- Name: ext_auto_events_type_processed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_events_type_processed_idx ON public.ext_automation_events USING btree (practice_id, event_type, processed_at);


--
-- Name: ext_auto_journeys_practice_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_journeys_practice_key_uq ON public.ext_automation_journeys USING btree (practice_id, journey_key) WHERE (deleted_at IS NULL);


--
-- Name: ext_auto_journeys_trigger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_journeys_trigger_idx ON public.ext_automation_journeys USING btree (practice_id, trigger_event_type, id) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: ext_auto_rules_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_rules_practice_idx ON public.ext_automation_rules USING btree (practice_id, deleted_at);


--
-- Name: ext_auto_rules_practice_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_rules_practice_key_uq ON public.ext_automation_rules USING btree (practice_id, rule_key) WHERE (deleted_at IS NULL);


--
-- Name: ext_auto_rules_trigger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_rules_trigger_idx ON public.ext_automation_rules USING btree (practice_id, trigger_event_type, priority, id) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: ext_auto_steps_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_steps_due_idx ON public.ext_automation_step_executions USING btree (scheduled_at, id) WHERE ((status = 'scheduled'::public.ext_automation_step_status) AND (deleted_at IS NULL));


--
-- Name: ext_auto_steps_enrollment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_steps_enrollment_idx ON public.ext_automation_step_executions USING btree (practice_id, enrollment_id, step_index);


--
-- Name: ext_auto_steps_enrollment_step_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_steps_enrollment_step_uq ON public.ext_automation_step_executions USING btree (enrollment_id, step_index);


--
-- Name: ext_auto_steps_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_steps_status_idx ON public.ext_automation_step_executions USING btree (practice_id, status, executed_at);


--
-- Name: ext_auto_suppression_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_suppression_client_idx ON public.ext_automation_suppression_log USING btree (practice_id, client_id, blocked_at);


--
-- Name: ext_auto_suppression_dedupe_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_auto_suppression_dedupe_uq ON public.ext_automation_suppression_log USING btree (practice_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: ext_auto_suppression_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_suppression_patient_idx ON public.ext_automation_suppression_log USING btree (practice_id, patient_id, blocked_at);


--
-- Name: ext_auto_suppression_reason_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_auto_suppression_reason_idx ON public.ext_automation_suppression_log USING btree (practice_id, suppression_reason, blocked_at);


--
-- Name: ext_carcass_disp_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_carcass_disp_patient_idx ON public.ext_carcass_disposals USING btree (patient_id, deleted_at);


--
-- Name: ext_carcass_disp_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_carcass_disp_practice_idx ON public.ext_carcass_disposals USING btree (practice_id, deleted_at);


--
-- Name: ext_cg_alerts_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_cg_alerts_category_idx ON public.ext_clinical_guardian_alerts USING btree (practice_id, category, deleted_at);


--
-- Name: ext_cg_alerts_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_cg_alerts_patient_idx ON public.ext_clinical_guardian_alerts USING btree (patient_id, deleted_at);


--
-- Name: ext_cg_alerts_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_cg_alerts_practice_idx ON public.ext_clinical_guardian_alerts USING btree (practice_id, deleted_at);


--
-- Name: ext_cg_alerts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_cg_alerts_status_idx ON public.ext_clinical_guardian_alerts USING btree (practice_id, status, deleted_at);


--
-- Name: ext_channel_accounts_practice_provider_account_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_channel_accounts_practice_provider_account_uq ON public.ext_channel_accounts USING btree (practice_id, provider, external_account_id) WHERE (deleted_at IS NULL);


--
-- Name: ext_channel_accounts_provider_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_channel_accounts_provider_status_idx ON public.ext_channel_accounts USING btree (practice_id, provider, status) WHERE ((disconnected_at IS NULL) AND (deleted_at IS NULL));


--
-- Name: ext_channel_accounts_token_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_channel_accounts_token_expiry_idx ON public.ext_channel_accounts USING btree (token_expires_at) WHERE ((token_expires_at IS NOT NULL) AND (disconnected_at IS NULL));


--
-- Name: ext_clinician_confirmations_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_clinician_confirmations_actor_idx ON public.ext_clinician_confirmations USING btree (actor_id, status);


--
-- Name: ext_clinician_confirmations_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_clinician_confirmations_entity_idx ON public.ext_clinician_confirmations USING btree (entity_type, entity_id, status);


--
-- Name: ext_clinician_confirmations_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_clinician_confirmations_practice_idx ON public.ext_clinician_confirmations USING btree (practice_id, status, deleted_at);


--
-- Name: ext_content_briefs_content_item_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_content_briefs_content_item_uq ON public.ext_content_briefs USING btree (practice_id, content_item_id) WHERE (content_item_id IS NOT NULL);


--
-- Name: ext_content_briefs_pillar_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_content_briefs_pillar_idx ON public.ext_content_briefs USING btree (practice_id, pillar_id, status);


--
-- Name: ext_content_briefs_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_content_briefs_practice_idx ON public.ext_content_briefs USING btree (practice_id, deleted_at);


--
-- Name: ext_content_briefs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_content_briefs_status_idx ON public.ext_content_briefs USING btree (practice_id, status, created_at);


--
-- Name: ext_content_pillars_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_content_pillars_practice_idx ON public.ext_content_pillars USING btree (practice_id, deleted_at, is_active, sort_order);


--
-- Name: ext_content_pillars_practice_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_content_pillars_practice_key_uq ON public.ext_content_pillars USING btree (practice_id, pillar_key) WHERE (deleted_at IS NULL);


--
-- Name: ext_crm_membership_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_crm_membership_client_idx ON public.ext_crm_segment_memberships USING btree (practice_id, client_id, is_manually_excluded);


--
-- Name: ext_crm_membership_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_crm_membership_expiry_idx ON public.ext_crm_segment_memberships USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: ext_crm_membership_segment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_crm_membership_segment_idx ON public.ext_crm_segment_memberships USING btree (practice_id, segment_id, is_manually_excluded, expires_at);


--
-- Name: ext_crm_membership_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_crm_membership_uq ON public.ext_crm_segment_memberships USING btree (practice_id, segment_id, client_id) WHERE (deleted_at IS NULL);


--
-- Name: ext_crm_segments_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_crm_segments_practice_idx ON public.ext_crm_segments USING btree (practice_id, deleted_at, is_active);


--
-- Name: ext_crm_segments_practice_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_crm_segments_practice_key_uq ON public.ext_crm_segments USING btree (practice_id, segment_key) WHERE (deleted_at IS NULL);


--
-- Name: ext_crm_segments_refresh_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_crm_segments_refresh_due_idx ON public.ext_crm_segments USING btree (practice_id, last_refreshed_at) WHERE ((refresh_strategy = 'scheduled'::public.ext_crm_refresh_strategy) AND (deleted_at IS NULL));


--
-- Name: ext_kvepis_credentials_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_kvepis_credentials_practice_uq ON public.ext_kvepis_credentials USING btree (practice_id);


--
-- Name: ext_kvepis_submissions_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_kvepis_submissions_patient_idx ON public.ext_kvepis_submissions USING btree (patient_id, deleted_at);


--
-- Name: ext_kvepis_submissions_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_kvepis_submissions_practice_idx ON public.ext_kvepis_submissions USING btree (practice_id, deleted_at);


--
-- Name: ext_kvepis_submissions_ref_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_kvepis_submissions_ref_uq ON public.ext_kvepis_submissions USING btree (practice_id, reference_number);


--
-- Name: ext_kvepis_submissions_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_kvepis_submissions_source_idx ON public.ext_kvepis_submissions USING btree (source_entity_type, source_entity_id);


--
-- Name: ext_kvepis_submissions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_kvepis_submissions_status_idx ON public.ext_kvepis_submissions USING btree (practice_id, status, deleted_at);


--
-- Name: ext_kvepis_submissions_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_kvepis_submissions_type_idx ON public.ext_kvepis_submissions USING btree (practice_id, submission_type, deleted_at);


--
-- Name: ext_marketing_website_config_practice_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_marketing_website_config_practice_id_unique ON public.ext_marketing_website_config USING btree (practice_id);


--
-- Name: ext_mkt_auto_rule_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_auto_rule_practice_idx ON public.ext_marketing_automation_rules USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_auto_rule_practice_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_mkt_auto_rule_practice_key_uq ON public.ext_marketing_automation_rules USING btree (practice_id, key);


--
-- Name: ext_mkt_batches_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_batches_practice_idx ON public.ext_marketing_content_batches USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_batches_practice_week_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_mkt_batches_practice_week_uq ON public.ext_marketing_content_batches USING btree (practice_id, week_start);


--
-- Name: ext_mkt_competitor_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_competitor_practice_idx ON public.ext_marketing_competitor_snapshots USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_consents_practice_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_consents_practice_client_idx ON public.ext_marketing_media_consents USING btree (practice_id, client_id);


--
-- Name: ext_mkt_consents_practice_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_consents_practice_patient_idx ON public.ext_marketing_media_consents USING btree (practice_id, patient_id);


--
-- Name: ext_mkt_consents_req_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_consents_req_idx ON public.ext_marketing_media_consents USING btree (consent_request_id);


--
-- Name: ext_mkt_content_approved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_approved_by_idx ON public.ext_marketing_content_items USING btree (approved_by);


--
-- Name: ext_mkt_content_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_batch_idx ON public.ext_marketing_content_items USING btree (batch_id);


--
-- Name: ext_mkt_content_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_created_by_idx ON public.ext_marketing_content_items USING btree (created_by);


--
-- Name: ext_mkt_content_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_media_idx ON public.ext_marketing_content_items USING btree (media_asset_id);


--
-- Name: ext_mkt_content_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_practice_idx ON public.ext_marketing_content_items USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_content_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_content_schedule_idx ON public.ext_marketing_content_items USING btree (practice_id, status, scheduled_for);


--
-- Name: ext_mkt_handouts_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_handouts_created_by_idx ON public.ext_marketing_handouts USING btree (created_by);


--
-- Name: ext_mkt_handouts_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_handouts_practice_idx ON public.ext_marketing_handouts USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_handouts_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_mkt_handouts_slug_uq ON public.ext_marketing_handouts USING btree (practice_id, slug);


--
-- Name: ext_mkt_media_consent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_media_consent_idx ON public.ext_marketing_media_assets USING btree (consent_id);


--
-- Name: ext_mkt_media_file_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_media_file_idx ON public.ext_marketing_media_assets USING btree (file_id);


--
-- Name: ext_mkt_media_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_media_practice_idx ON public.ext_marketing_media_assets USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_media_uploaded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_media_uploaded_idx ON public.ext_marketing_media_assets USING btree (uploaded_by);


--
-- Name: ext_mkt_msg_log_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_msg_log_client_idx ON public.ext_marketing_message_logs USING btree (client_id, created_at);


--
-- Name: ext_mkt_msg_log_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_msg_log_patient_idx ON public.ext_marketing_message_logs USING btree (patient_id);


--
-- Name: ext_mkt_msg_log_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_msg_log_practice_idx ON public.ext_marketing_message_logs USING btree (practice_id);


--
-- Name: ext_mkt_msg_log_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_msg_log_template_idx ON public.ext_marketing_message_logs USING btree (template_id);


--
-- Name: ext_mkt_postop_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_postop_client_idx ON public.ext_marketing_postop_responses USING btree (client_id);


--
-- Name: ext_mkt_postop_msg_log_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_postop_msg_log_idx ON public.ext_marketing_postop_responses USING btree (message_log_id);


--
-- Name: ext_mkt_postop_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_postop_patient_idx ON public.ext_marketing_postop_responses USING btree (patient_id);


--
-- Name: ext_mkt_postop_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_postop_practice_idx ON public.ext_marketing_postop_responses USING btree (practice_id);


--
-- Name: ext_mkt_recall_practice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_mkt_recall_practice_uq ON public.ext_marketing_recall_schedules USING btree (practice_id);


--
-- Name: ext_mkt_redemptions_appt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_redemptions_appt_idx ON public.ext_marketing_wellness_redemptions USING btree (appointment_id);


--
-- Name: ext_mkt_redemptions_enrollment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_redemptions_enrollment_idx ON public.ext_marketing_wellness_redemptions USING btree (practice_id, enrollment_id);


--
-- Name: ext_mkt_reviews_appt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_appt_idx ON public.ext_marketing_reviews USING btree (appointment_id);


--
-- Name: ext_mkt_reviews_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_client_idx ON public.ext_marketing_reviews USING btree (client_id);


--
-- Name: ext_mkt_reviews_escalated_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_escalated_to_idx ON public.ext_marketing_reviews USING btree (escalated_to);


--
-- Name: ext_mkt_reviews_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_inbox_idx ON public.ext_marketing_reviews USING btree (practice_id, escalation_status, received_at) WHERE (deleted_at IS NULL);


--
-- Name: ext_mkt_reviews_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_patient_idx ON public.ext_marketing_reviews USING btree (patient_id);


--
-- Name: ext_mkt_reviews_platform_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_platform_idx ON public.ext_marketing_reviews USING btree (practice_id, platform);


--
-- Name: ext_mkt_reviews_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_practice_idx ON public.ext_marketing_reviews USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_reviews_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_received_idx ON public.ext_marketing_reviews USING btree (practice_id, received_at);


--
-- Name: ext_mkt_reviews_replied_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_replied_by_idx ON public.ext_marketing_reviews USING btree (replied_by);


--
-- Name: ext_mkt_reviews_resp_approved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_resp_approved_by_idx ON public.ext_marketing_reviews USING btree (response_approved_by);


--
-- Name: ext_mkt_reviews_sentiment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_reviews_sentiment_idx ON public.ext_marketing_reviews USING btree (practice_id, sentiment_label, severity);


--
-- Name: ext_mkt_scripts_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_scripts_practice_idx ON public.ext_marketing_operative_scripts USING btree (practice_id);


--
-- Name: ext_mkt_staff_tasks_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_staff_tasks_client_idx ON public.ext_marketing_staff_tasks USING btree (client_id);


--
-- Name: ext_mkt_staff_tasks_due_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_staff_tasks_due_at_idx ON public.ext_marketing_staff_tasks USING btree (due_at);


--
-- Name: ext_mkt_staff_tasks_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_staff_tasks_practice_idx ON public.ext_marketing_staff_tasks USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_tpl_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_tpl_practice_idx ON public.ext_marketing_message_templates USING btree (practice_id, deleted_at);


--
-- Name: ext_mkt_tpl_practice_key_lang_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ext_mkt_tpl_practice_key_lang_uq ON public.ext_marketing_message_templates USING btree (practice_id, key, language);


--
-- Name: ext_mkt_tv_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_tv_active_idx ON public.ext_marketing_tv_slides USING btree (practice_id, is_active, sort_order);


--
-- Name: ext_mkt_tv_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_tv_created_by_idx ON public.ext_marketing_tv_slides USING btree (created_by);


--
-- Name: ext_mkt_tv_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_tv_media_idx ON public.ext_marketing_tv_slides USING btree (media_asset_id);


--
-- Name: ext_mkt_web_inquiries_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_web_inquiries_created_idx ON public.ext_marketing_website_inquiries USING btree (practice_id, created_at);


--
-- Name: ext_mkt_web_inquiries_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_mkt_web_inquiries_practice_idx ON public.ext_marketing_website_inquiries USING btree (practice_id, deleted_at);


--
-- Name: ext_pilot_feedback_incident_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_pilot_feedback_incident_date_idx ON public.ext_pilot_feedback USING btree (practice_id, incident_date);


--
-- Name: ext_pilot_feedback_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_pilot_feedback_practice_idx ON public.ext_pilot_feedback USING btree (practice_id, deleted_at);


--
-- Name: ext_rabies_notifications_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_rabies_notifications_practice_idx ON public.ext_rabies_notifications USING btree (practice_id, deleted_at);


--
-- Name: ext_rabies_obs_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_rabies_obs_patient_idx ON public.ext_rabies_observations USING btree (patient_id, deleted_at);


--
-- Name: ext_rabies_obs_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_rabies_obs_practice_idx ON public.ext_rabies_observations USING btree (practice_id, deleted_at);


--
-- Name: ext_rabies_obs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_rabies_obs_status_idx ON public.ext_rabies_observations USING btree (practice_id, status, deleted_at);


--
-- Name: ext_sms_delivery_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_sms_delivery_client_idx ON public.ext_sms_delivery_log USING btree (client_id, sent_at);


--
-- Name: ext_sms_delivery_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_sms_delivery_practice_idx ON public.ext_sms_delivery_log USING btree (practice_id);


--
-- Name: ext_support_audit_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_support_audit_session_idx ON public.ext_support_session_audit USING btree (session_id);


--
-- Name: ext_support_audit_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_support_audit_user_idx ON public.ext_support_session_audit USING btree (user_id);


--
-- Name: ext_support_sessions_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_support_sessions_client_idx ON public.ext_support_sessions USING btree (client_id);


--
-- Name: ext_support_sessions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_support_sessions_created_by_idx ON public.ext_support_sessions USING btree (created_by);


--
-- Name: ext_support_sessions_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_support_sessions_practice_idx ON public.ext_support_sessions USING btree (practice_id);


--
-- Name: ext_withdrawal_periods_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_withdrawal_periods_patient_idx ON public.ext_withdrawal_periods USING btree (patient_id, deleted_at);


--
-- Name: ext_withdrawal_periods_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ext_withdrawal_periods_practice_idx ON public.ext_withdrawal_periods USING btree (practice_id, deleted_at);


--
-- Name: external_lab_observations_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_lab_observations_external_id_uq ON public.external_lab_observations USING btree (practice_id, external_source, external_id);


--
-- Name: external_lab_observations_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_lab_observations_import_fingerprint_uq ON public.external_lab_observations USING btree (practice_id, import_fingerprint);


--
-- Name: external_lab_observations_report_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_lab_observations_report_order_idx ON public.external_lab_observations USING btree (practice_id, report_id, sort_order, id);


--
-- Name: external_lab_reports_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_lab_reports_external_id_uq ON public.external_lab_reports USING btree (practice_id, external_source, external_id);


--
-- Name: external_lab_reports_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_lab_reports_import_fingerprint_uq ON public.external_lab_reports USING btree (practice_id, import_fingerprint);


--
-- Name: external_lab_reports_patient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_lab_reports_patient_timeline_idx ON public.external_lab_reports USING btree (practice_id, patient_id, resulted_at, ordered_at, id);


--
-- Name: external_lab_reports_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_lab_reports_practice_id_uq ON public.external_lab_reports USING btree (practice_id, id);


--
-- Name: external_lab_reports_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_lab_reports_review_idx ON public.external_lab_reports USING btree (practice_id, review_status, status, id);


--
-- Name: external_prescription_fills_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_prescription_fills_external_id_uq ON public.external_prescription_fills USING btree (practice_id, external_source, external_id);


--
-- Name: external_prescription_fills_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_prescription_fills_history_idx ON public.external_prescription_fills USING btree (practice_id, prescription_id, filled_at, id);


--
-- Name: external_prescription_fills_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_prescription_fills_import_fingerprint_uq ON public.external_prescription_fills USING btree (practice_id, import_fingerprint);


--
-- Name: external_prescriptions_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_prescriptions_external_id_uq ON public.external_prescriptions USING btree (practice_id, external_source, external_id);


--
-- Name: external_prescriptions_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_prescriptions_import_fingerprint_uq ON public.external_prescriptions USING btree (practice_id, import_fingerprint);


--
-- Name: external_prescriptions_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_prescriptions_patient_status_idx ON public.external_prescriptions USING btree (practice_id, patient_id, status, prescribed_at, id);


--
-- Name: external_prescriptions_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_prescriptions_practice_id_uq ON public.external_prescriptions USING btree (practice_id, id);


--
-- Name: external_prescriptions_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_prescriptions_review_idx ON public.external_prescriptions USING btree (practice_id, review_status, status, id);


--
-- Name: file_object_replicas_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX file_object_replicas_due_idx ON public.file_object_replicas USING btree (status, next_attempt_at, lease_expires_at);


--
-- Name: file_object_replicas_file_target_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX file_object_replicas_file_target_uq ON public.file_object_replicas USING btree (file_id, replica_target);


--
-- Name: file_object_replicas_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX file_object_replicas_practice_status_idx ON public.file_object_replicas USING btree (practice_id, status, updated_at);


--
-- Name: file_storage_events_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX file_storage_events_event_key_uq ON public.file_storage_events USING btree (event_key);


--
-- Name: file_storage_events_file_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX file_storage_events_file_created_idx ON public.file_storage_events USING btree (practice_id, file_id, created_at);


--
-- Name: file_storage_events_operation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX file_storage_events_operation_idx ON public.file_storage_events USING btree (operation_id);


--
-- Name: files_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_appointment_idx ON public.files USING btree (appointment_id);


--
-- Name: files_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_category_idx ON public.files USING btree (practice_id, category);


--
-- Name: files_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_entity_idx ON public.files USING btree (entity_type, entity_id);


--
-- Name: files_patient_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_patient_created_idx ON public.files USING btree (practice_id, patient_id, deleted_at, created_at);


--
-- Name: files_practice_file_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX files_practice_file_key_uq ON public.files USING btree (practice_id, file_key);


--
-- Name: files_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX files_practice_id_uq ON public.files USING btree (practice_id, id);


--
-- Name: files_practice_idempotency_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX files_practice_idempotency_key_uq ON public.files USING btree (practice_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: files_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_practice_idx ON public.files USING btree (practice_id, deleted_at);


--
-- Name: files_uploaded_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_uploaded_by_idx ON public.files USING btree (uploaded_by);


--
-- Name: financial_closes_practice_cutoff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX financial_closes_practice_cutoff_idx ON public.financial_closes USING btree (practice_id, cutoff_at);


--
-- Name: financial_closes_practice_day_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX financial_closes_practice_day_uq ON public.financial_closes USING btree (practice_id, business_date);


--
-- Name: funnel_events_anonymous_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funnel_events_anonymous_time_idx ON public.funnel_events USING btree (anonymous_id, created_at);


--
-- Name: funnel_events_event_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funnel_events_event_time_idx ON public.funnel_events USING btree (event_name, created_at);


--
-- Name: funnel_events_practice_stage_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX funnel_events_practice_stage_uq ON public.funnel_events USING btree (practice_id, event_name) WHERE ((practice_id IS NOT NULL) AND ((event_name)::text = ANY ((ARRAY['registration'::character varying, 'activation'::character varying, 'card_added'::character varying, 'paid'::character varying])::text[])));


--
-- Name: funnel_events_practice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funnel_events_practice_time_idx ON public.funnel_events USING btree (practice_id, created_at);


--
-- Name: historical_appointments_client_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historical_appointments_client_timeline_idx ON public.historical_appointments USING btree (practice_id, client_id, started_at, id);


--
-- Name: historical_appointments_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_appointments_external_id_uq ON public.historical_appointments USING btree (practice_id, external_source, external_id);


--
-- Name: historical_appointments_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_appointments_import_fingerprint_uq ON public.historical_appointments USING btree (practice_id, import_fingerprint);


--
-- Name: historical_appointments_patient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historical_appointments_patient_timeline_idx ON public.historical_appointments USING btree (practice_id, patient_id, started_at, id);


--
-- Name: historical_appointments_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_appointments_practice_id_uq ON public.historical_appointments USING btree (practice_id, id);


--
-- Name: historical_documents_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_documents_external_id_uq ON public.historical_documents USING btree (practice_id, external_source, external_id);


--
-- Name: historical_documents_file_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_documents_file_uq ON public.historical_documents USING btree (practice_id, file_id);


--
-- Name: historical_documents_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX historical_documents_import_fingerprint_uq ON public.historical_documents USING btree (practice_id, import_fingerprint);


--
-- Name: historical_documents_patient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historical_documents_patient_timeline_idx ON public.historical_documents USING btree (practice_id, patient_id, document_date, id);


--
-- Name: historical_documents_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historical_documents_review_idx ON public.historical_documents USING btree (practice_id, link_status, kind, id);


--
-- Name: insurance_claims_policy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_claims_policy_idx ON public.insurance_claims USING btree (policy_id);


--
-- Name: insurance_claims_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_claims_practice_idx ON public.insurance_claims USING btree (practice_id, deleted_at);


--
-- Name: insurance_claims_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_claims_status_idx ON public.insurance_claims USING btree (status);


--
-- Name: insurance_policies_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_policies_client_idx ON public.insurance_policies USING btree (client_id);


--
-- Name: insurance_policies_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_policies_patient_idx ON public.insurance_policies USING btree (patient_id);


--
-- Name: insurance_policies_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insurance_policies_practice_idx ON public.insurance_policies USING btree (practice_id, deleted_at);


--
-- Name: invoice_adjustments_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_adjustments_invoice_idx ON public.invoice_adjustments USING btree (invoice_id, deleted_at);


--
-- Name: invoice_adjustments_operation_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_adjustments_operation_key_uq ON public.invoice_adjustments USING btree (operation_key);


--
-- Name: invoice_items_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_invoice_idx ON public.invoice_items USING btree (invoice_id, deleted_at);


--
-- Name: invoice_items_invoice_item_target_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_items_invoice_item_target_uq ON public.invoice_items USING btree (invoice_id, id);


--
-- Name: invoice_items_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_item_idx ON public.invoice_items USING btree (item_type, deleted_at, item_id);


--
-- Name: invoice_items_source_dispense_charge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_source_dispense_charge_idx ON public.invoice_items USING btree (source_dispense_charge_id, deleted_at);


--
-- Name: invoice_items_source_dispense_charge_invoice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_items_source_dispense_charge_invoice_uq ON public.invoice_items USING btree (invoice_id, source_dispense_charge_id) WHERE ((source_dispense_charge_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: invoice_items_source_prescription_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_source_prescription_idx ON public.invoice_items USING btree (source_prescription_id, deleted_at);


--
-- Name: invoice_items_source_prescription_invoice_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_items_source_prescription_invoice_uq ON public.invoice_items USING btree (invoice_id, source_prescription_id) WHERE ((source_prescription_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: invoices_active_appointment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_active_appointment_uq ON public.invoices USING btree (practice_id, appointment_id) WHERE ((appointment_id IS NOT NULL) AND (is_estimate = false) AND (status <> 'void'::public.invoice_status) AND (deleted_at IS NULL));


--
-- Name: invoices_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_appointment_idx ON public.invoices USING btree (practice_id, appointment_id, deleted_at, is_estimate, status);


--
-- Name: invoices_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_client_idx ON public.invoices USING btree (practice_id, client_id, deleted_at, created_at);


--
-- Name: invoices_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_patient_idx ON public.invoices USING btree (practice_id, patient_id, client_id, deleted_at);


--
-- Name: invoices_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_practice_id_uq ON public.invoices USING btree (practice_id, id);


--
-- Name: invoices_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_practice_idx ON public.invoices USING btree (practice_id, deleted_at, created_at);


--
-- Name: invoices_visit_target_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_visit_target_uq ON public.invoices USING btree (practice_id, appointment_id, id);


--
-- Name: kvl_cr_passports_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kvl_cr_passports_client_idx ON public.kvl_cr_passports USING btree (client_id);


--
-- Name: kvl_cr_passports_issued_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kvl_cr_passports_issued_by_idx ON public.kvl_cr_passports USING btree (issued_by);


--
-- Name: kvl_cr_passports_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kvl_cr_passports_number_uq ON public.kvl_cr_passports USING btree (passport_number);


--
-- Name: kvl_cr_passports_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kvl_cr_passports_patient_idx ON public.kvl_cr_passports USING btree (practice_id, patient_id, deleted_at);


--
-- Name: kvl_cr_passports_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kvl_cr_passports_practice_idx ON public.kvl_cr_passports USING btree (practice_id, deleted_at);


--
-- Name: lab_analyzer_reports_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_analyzer_reports_created_at_idx ON public.lab_analyzer_reports USING btree (created_at);


--
-- Name: lab_analyzer_reports_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_analyzer_reports_patient_idx ON public.lab_analyzer_reports USING btree (patient_id);


--
-- Name: lab_analyzer_reports_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_analyzer_reports_practice_idx ON public.lab_analyzer_reports USING btree (practice_id);


--
-- Name: lab_analyzer_reports_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_analyzer_reports_status_idx ON public.lab_analyzer_reports USING btree (status);


--
-- Name: lab_result_events_created_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_result_events_created_uq ON public.lab_result_events USING btree (practice_id, lab_result_id) WHERE (event_type = 'created'::public.lab_result_event_type);


--
-- Name: lab_result_events_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_result_events_practice_operation_uq ON public.lab_result_events USING btree (practice_id, operation_id);


--
-- Name: lab_result_events_practice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_result_events_practice_time_idx ON public.lab_result_events USING btree (practice_id, created_at, id);


--
-- Name: lab_result_events_result_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_result_events_result_history_idx ON public.lab_result_events USING btree (practice_id, lab_result_id, created_at, id);


--
-- Name: lab_result_replacements_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_result_replacements_operation_uq ON public.lab_result_replacements USING btree (practice_id, operation_id);


--
-- Name: lab_result_replacements_replacement_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_result_replacements_replacement_uq ON public.lab_result_replacements USING btree (practice_id, replacement_lab_result_id);


--
-- Name: lab_result_replacements_source_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_result_replacements_source_history_idx ON public.lab_result_replacements USING btree (practice_id, source_lab_result_id, created_at, id);


--
-- Name: lab_result_replacements_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_result_replacements_source_uq ON public.lab_result_replacements USING btree (practice_id, source_lab_result_id);


--
-- Name: lab_results_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_results_appointment_idx ON public.lab_results USING btree (practice_id, appointment_id, deleted_at);


--
-- Name: lab_results_creation_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_results_creation_operation_uq ON public.lab_results USING btree (practice_id, creation_operation_id);


--
-- Name: lab_results_follow_up_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_results_follow_up_inbox_idx ON public.lab_results USING btree (practice_id, follow_up_status, follow_up_assigned_to, follow_up_due_at, id);


--
-- Name: lab_results_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_results_patient_idx ON public.lab_results USING btree (patient_id, status);


--
-- Name: lab_results_practice_record_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_results_practice_record_uq ON public.lab_results USING btree (practice_id, id);


--
-- Name: lab_results_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_results_practice_status_idx ON public.lab_results USING btree (practice_id, status, deleted_at);


--
-- Name: lab_results_review_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_results_review_inbox_idx ON public.lab_results USING btree (practice_id, status, result_flag, completed_at, id);


--
-- Name: lab_results_visit_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lab_results_visit_source_uq ON public.lab_results USING btree (practice_id, appointment_id, id);


--
-- Name: legacy_financial_allocations_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_allocations_document_idx ON public.legacy_financial_allocations USING btree (practice_id, document_id, allocated_at, id);


--
-- Name: legacy_financial_allocations_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_allocations_external_id_uq ON public.legacy_financial_allocations USING btree (practice_id, external_source, external_id);


--
-- Name: legacy_financial_allocations_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_allocations_import_fingerprint_uq ON public.legacy_financial_allocations USING btree (practice_id, import_fingerprint);


--
-- Name: legacy_financial_allocations_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_allocations_payment_idx ON public.legacy_financial_allocations USING btree (practice_id, payment_id, allocated_at, id);


--
-- Name: legacy_financial_documents_client_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_documents_client_timeline_idx ON public.legacy_financial_documents USING btree (practice_id, client_id, issued_at, id);


--
-- Name: legacy_financial_documents_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_documents_external_id_uq ON public.legacy_financial_documents USING btree (practice_id, external_source, external_id);


--
-- Name: legacy_financial_documents_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_documents_import_fingerprint_uq ON public.legacy_financial_documents USING btree (practice_id, import_fingerprint);


--
-- Name: legacy_financial_documents_open_balance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_documents_open_balance_idx ON public.legacy_financial_documents USING btree (practice_id, status, issued_at, id) WHERE ((status = ANY (ARRAY['open'::public.legacy_financial_document_status, 'partial'::public.legacy_financial_document_status])) AND (deleted_at IS NULL));


--
-- Name: legacy_financial_documents_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_documents_practice_id_uq ON public.legacy_financial_documents USING btree (practice_id, id);


--
-- Name: legacy_financial_line_items_document_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_line_items_document_order_idx ON public.legacy_financial_line_items USING btree (practice_id, document_id, sort_order, id);


--
-- Name: legacy_financial_line_items_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_line_items_external_id_uq ON public.legacy_financial_line_items USING btree (practice_id, external_source, external_id);


--
-- Name: legacy_financial_line_items_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_line_items_import_fingerprint_uq ON public.legacy_financial_line_items USING btree (practice_id, import_fingerprint);


--
-- Name: legacy_financial_payments_client_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX legacy_financial_payments_client_timeline_idx ON public.legacy_financial_payments USING btree (practice_id, client_id, received_at, id);


--
-- Name: legacy_financial_payments_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_payments_external_id_uq ON public.legacy_financial_payments USING btree (practice_id, external_source, external_id);


--
-- Name: legacy_financial_payments_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_payments_import_fingerprint_uq ON public.legacy_financial_payments USING btree (practice_id, import_fingerprint);


--
-- Name: legacy_financial_payments_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX legacy_financial_payments_practice_id_uq ON public.legacy_financial_payments USING btree (practice_id, id);


--
-- Name: location_messaging_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_messaging_practice_idx ON public.location_messaging USING btree (practice_id);


--
-- Name: location_messaging_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_messaging_sender_idx ON public.location_messaging USING btree (sender_e164);


--
-- Name: locations_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX locations_practice_id_uq ON public.locations USING btree (practice_id, id);


--
-- Name: locations_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locations_practice_idx ON public.locations USING btree (practice_id, deleted_at);


--
-- Name: locations_primary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locations_primary_idx ON public.locations USING btree (practice_id, is_primary);


--
-- Name: messaging_registration_events_operation_event_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX messaging_registration_events_operation_event_uq ON public.messaging_registration_events USING btree (practice_id, operation_id, event_type);


--
-- Name: messaging_registration_events_practice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messaging_registration_events_practice_time_idx ON public.messaging_registration_events USING btree (practice_id, created_at, id);


--
-- Name: messaging_registration_events_registration_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messaging_registration_events_registration_history_idx ON public.messaging_registration_events USING btree (practice_id, registration_id, created_at, id);


--
-- Name: messaging_registrations_attested_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messaging_registrations_attested_by_idx ON public.messaging_registrations USING btree (compliance_attested_by);


--
-- Name: messaging_registrations_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX messaging_registrations_practice_id_uq ON public.messaging_registrations USING btree (practice_id, id);


--
-- Name: messaging_registrations_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX messaging_registrations_practice_idx ON public.messaging_registrations USING btree (practice_id);


--
-- Name: messaging_registrations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messaging_registrations_status_idx ON public.messaging_registrations USING btree (status, updated_at);


--
-- Name: microchip_registrations_chip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microchip_registrations_chip_idx ON public.microchip_registrations USING btree (microchip_number);


--
-- Name: microchip_registrations_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microchip_registrations_client_idx ON public.microchip_registrations USING btree (client_id);


--
-- Name: microchip_registrations_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microchip_registrations_patient_idx ON public.microchip_registrations USING btree (practice_id, patient_id, deleted_at);


--
-- Name: microchip_registrations_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microchip_registrations_practice_idx ON public.microchip_registrations USING btree (practice_id, deleted_at);


--
-- Name: microchip_registrations_vet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microchip_registrations_vet_idx ON public.microchip_registrations USING btree (veterinarian_id);


--
-- Name: migration_runs_active_preview_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX migration_runs_active_preview_uq ON public.migration_runs USING btree (practice_id, mode) WHERE ((status = 'previewed'::public.migration_run_status) AND (deleted_at IS NULL));


--
-- Name: migration_runs_committed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_runs_committed_by_idx ON public.migration_runs USING btree (committed_by);


--
-- Name: migration_runs_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_runs_created_by_idx ON public.migration_runs USING btree (created_by);


--
-- Name: migration_runs_pending_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_runs_pending_expiry_idx ON public.migration_runs USING btree (preview_expires_at) WHERE (status = 'previewed'::public.migration_run_status);


--
-- Name: migration_runs_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_runs_practice_status_idx ON public.migration_runs USING btree (practice_id, status, updated_at);


--
-- Name: patient_allergies_id_patient_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patient_allergies_id_patient_uq ON public.patient_allergies USING btree (id, patient_id);


--
-- Name: patient_allergies_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_allergies_patient_idx ON public.patient_allergies USING btree (patient_id, deleted_at);


--
-- Name: patient_merge_events_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patient_merge_events_operation_uq ON public.patient_merge_events USING btree (practice_id, operation_id);


--
-- Name: patient_merge_events_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patient_merge_events_source_uq ON public.patient_merge_events USING btree (practice_id, source_patient_id);


--
-- Name: patient_merge_events_target_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_merge_events_target_history_idx ON public.patient_merge_events USING btree (practice_id, target_patient_id, created_at, id);


--
-- Name: patient_weights_patient_recorded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patient_weights_patient_recorded_idx ON public.patient_weights USING btree (patient_id, deleted_at, recorded_at);


--
-- Name: patients_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patients_client_idx ON public.patients USING btree (client_id);


--
-- Name: patients_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_external_id_uq ON public.patients USING btree (practice_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: patients_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_import_fingerprint_uq ON public.patients USING btree (practice_id, import_fingerprint) WHERE ((import_fingerprint IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: patients_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patients_name_idx ON public.patients USING btree (name);


--
-- Name: patients_practice_client_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_practice_client_id_uq ON public.patients USING btree (practice_id, id, client_id);


--
-- Name: patients_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_practice_id_uq ON public.patients USING btree (practice_id, id);


--
-- Name: patients_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patients_practice_idx ON public.patients USING btree (practice_id, deleted_at);


--
-- Name: payment_disputes_external_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_disputes_external_uq ON public.payment_disputes USING btree (provider, external_dispute_id);


--
-- Name: payment_disputes_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_disputes_practice_status_idx ON public.payment_disputes USING btree (practice_id, status, provider_created_at);


--
-- Name: payment_processor_payouts_external_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_payouts_external_uq ON public.payment_processor_payouts USING btree (provider, connected_account_id, external_payout_id);


--
-- Name: payment_processor_payouts_practice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_processor_payouts_practice_date_idx ON public.payment_processor_payouts USING btree (practice_id, provider_created_at, status);


--
-- Name: payment_processor_refunds_external_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_refunds_external_uq ON public.payment_processor_refunds USING btree (provider, external_refund_id);


--
-- Name: payment_processor_refunds_payment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_refunds_payment_uq ON public.payment_processor_refunds USING btree (refund_payment_id);


--
-- Name: payment_processor_refunds_practice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_processor_refunds_practice_date_idx ON public.payment_processor_refunds USING btree (practice_id, provider_created_at);


--
-- Name: payment_processor_settlements_balance_transaction_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_balance_transaction_uq ON public.payment_processor_settlements USING btree (provider, connected_account_id, balance_transaction_id);


--
-- Name: payment_processor_settlements_charge_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_charge_uq ON public.payment_processor_settlements USING btree (provider, connected_account_id, charge_id);


--
-- Name: payment_processor_settlements_checkout_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_checkout_uq ON public.payment_processor_settlements USING btree (provider, connected_account_id, checkout_session_id);


--
-- Name: payment_processor_settlements_payment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_payment_uq ON public.payment_processor_settlements USING btree (payment_id);


--
-- Name: payment_processor_settlements_payout_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_processor_settlements_payout_idx ON public.payment_processor_settlements USING btree (practice_id, payout_id, payout_status);


--
-- Name: payment_processor_settlements_practice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_processor_settlements_practice_date_idx ON public.payment_processor_settlements USING btree (practice_id, reconciled_at);


--
-- Name: payment_processor_settlements_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_practice_id_uq ON public.payment_processor_settlements USING btree (practice_id, id);


--
-- Name: payment_processor_settlements_tenant_payment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_processor_settlements_tenant_payment_uq ON public.payment_processor_settlements USING btree (practice_id, id, payment_id);


--
-- Name: payments_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_external_id_uq ON public.payments USING btree (external_id);


--
-- Name: payments_invoice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_invoice_id_uq ON public.payments USING btree (invoice_id, id);


--
-- Name: payments_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_invoice_idx ON public.payments USING btree (invoice_id, deleted_at, received_at);


--
-- Name: pet_passports_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_passports_client_idx ON public.pet_passports USING btree (client_id);


--
-- Name: pet_passports_issued_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_passports_issued_by_idx ON public.pet_passports USING btree (issued_by);


--
-- Name: pet_passports_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pet_passports_number_uq ON public.pet_passports USING btree (passport_number);


--
-- Name: pet_passports_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_passports_patient_idx ON public.pet_passports USING btree (practice_id, patient_id, deleted_at);


--
-- Name: pet_passports_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_passports_practice_idx ON public.pet_passports USING btree (practice_id, deleted_at);


--
-- Name: pet_passports_vaccination_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pet_passports_vaccination_record_idx ON public.pet_passports USING btree (vaccination_record_id);


--
-- Name: platform_email_identity_aliases_current_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_email_identity_aliases_current_uq ON public.platform_email_identity_aliases USING btree (current_identity_key_fingerprint, current_email_hash);


--
-- Name: platform_email_identity_aliases_previous_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_email_identity_aliases_previous_uq ON public.platform_email_identity_aliases USING btree (previous_identity_key_fingerprint, previous_email_hash);


--
-- Name: platform_email_preference_events_provider_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_email_preference_events_provider_event_key_uq ON public.platform_email_preference_events USING btree (provider_event_key_hash);


--
-- Name: platform_email_preference_events_recipient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_email_preference_events_recipient_timeline_idx ON public.platform_email_preference_events USING btree (email_hash, created_at);


--
-- Name: platform_email_preferences_email_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_email_preferences_email_hash_uq ON public.platform_email_preferences USING btree (email_hash);


--
-- Name: platform_email_preferences_identity_fingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_email_preferences_identity_fingerprint_idx ON public.platform_email_preferences USING btree (identity_key_fingerprint);


--
-- Name: portal_sessions_client_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_sessions_client_active_idx ON public.portal_sessions USING btree (practice_id, client_id, revoked_at, expires_at);


--
-- Name: portal_sessions_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_sessions_expiry_idx ON public.portal_sessions USING btree (expires_at);


--
-- Name: portal_sessions_token_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX portal_sessions_token_hash_uq ON public.portal_sessions USING btree (token_hash);


--
-- Name: practice_conversion_milestones_evidence_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX practice_conversion_milestones_evidence_uq ON public.practice_conversion_milestones USING btree (evidence_source, evidence_key, milestone);


--
-- Name: practice_conversion_milestones_stage_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX practice_conversion_milestones_stage_time_idx ON public.practice_conversion_milestones USING btree (milestone, occurred_at, practice_id);


--
-- Name: practice_payment_accounts_practice_provider_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX practice_payment_accounts_practice_provider_uq ON public.practice_payment_accounts USING btree (practice_id, provider);


--
-- Name: practice_payment_accounts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX practice_payment_accounts_status_idx ON public.practice_payment_accounts USING btree (practice_id, deleted_at, onboarding_status);


--
-- Name: practice_payment_accounts_stripe_account_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX practice_payment_accounts_stripe_account_uq ON public.practice_payment_accounts USING btree (stripe_account_id);


--
-- Name: practice_payment_accounts_tenant_provider_account_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX practice_payment_accounts_tenant_provider_account_uq ON public.practice_payment_accounts USING btree (practice_id, provider, stripe_account_id);


--
-- Name: practices_billing_trial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX practices_billing_trial_idx ON public.practices USING btree (billing_status, trial_ends_at, deleted_at);


--
-- Name: practices_calendar_feed_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX practices_calendar_feed_token_uq ON public.practices USING btree (calendar_feed_token);


--
-- Name: practices_stripe_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX practices_stripe_customer_idx ON public.practices USING btree (stripe_customer_id, deleted_at);


--
-- Name: practices_stripe_subscription_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX practices_stripe_subscription_idx ON public.practices USING btree (stripe_subscription_id, deleted_at);


--
-- Name: prescription_events_created_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescription_events_created_uq ON public.prescription_events USING btree (practice_id, prescription_id) WHERE (event_type = 'created'::public.prescription_event_type);


--
-- Name: prescription_events_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescription_events_practice_id_uq ON public.prescription_events USING btree (practice_id, id);


--
-- Name: prescription_events_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescription_events_practice_operation_uq ON public.prescription_events USING btree (practice_id, operation_id) WHERE (operation_id IS NOT NULL);


--
-- Name: prescription_events_practice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescription_events_practice_time_idx ON public.prescription_events USING btree (practice_id, created_at, id);


--
-- Name: prescription_events_prescription_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescription_events_prescription_history_idx ON public.prescription_events USING btree (practice_id, prescription_id, created_at, id);


--
-- Name: prescription_events_terminal_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescription_events_terminal_uq ON public.prescription_events USING btree (practice_id, prescription_id) WHERE (event_type = ANY (ARRAY['completed'::public.prescription_event_type, 'cancelled'::public.prescription_event_type, 'expired'::public.prescription_event_type]));


--
-- Name: prescriptions_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_appointment_idx ON public.prescriptions USING btree (practice_id, appointment_id, deleted_at);


--
-- Name: prescriptions_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_patient_status_idx ON public.prescriptions USING btree (patient_id, status);


--
-- Name: prescriptions_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescriptions_practice_id_uq ON public.prescriptions USING btree (practice_id, id);


--
-- Name: prescriptions_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescriptions_practice_operation_uq ON public.prescriptions USING btree (practice_id, operation_id);


--
-- Name: prescriptions_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_practice_status_idx ON public.prescriptions USING btree (practice_id, status, deleted_at);


--
-- Name: prescriptions_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_product_idx ON public.prescriptions USING btree (product_id);


--
-- Name: prescriptions_visit_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prescriptions_visit_source_uq ON public.prescriptions USING btree (practice_id, appointment_id, id);


--
-- Name: problem_list_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_list_patient_status_idx ON public.problem_list USING btree (patient_id, status);


--
-- Name: problem_list_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_list_practice_status_idx ON public.problem_list USING btree (practice_id, status, deleted_at);


--
-- Name: procedures_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procedures_appointment_idx ON public.procedures USING btree (practice_id, appointment_id, deleted_at);


--
-- Name: procedures_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procedures_patient_idx ON public.procedures USING btree (patient_id);


--
-- Name: procedures_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procedures_practice_idx ON public.procedures USING btree (practice_id, deleted_at);


--
-- Name: procedures_visit_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX procedures_visit_source_uq ON public.procedures USING btree (practice_id, appointment_id, id);


--
-- Name: products_expiration_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_expiration_idx ON public.products USING btree (practice_id, expiration_date, deleted_at);


--
-- Name: products_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_external_id_uq ON public.products USING btree (practice_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: products_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_import_fingerprint_uq ON public.products USING btree (practice_id, import_fingerprint) WHERE (import_fingerprint IS NOT NULL);


--
-- Name: products_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_location_idx ON public.products USING btree (practice_id, location_id, deleted_at);


--
-- Name: products_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_practice_id_uq ON public.products USING btree (practice_id, id);


--
-- Name: products_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_practice_idx ON public.products USING btree (practice_id, deleted_at);


--
-- Name: products_practice_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_practice_name_idx ON public.products USING btree (practice_id, deleted_at, name);


--
-- Name: products_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_sku_idx ON public.products USING btree (practice_id, sku);


--
-- Name: products_stock_alert_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_stock_alert_idx ON public.products USING btree (practice_id, deleted_at, stock_quantity);


--
-- Name: rate_limit_buckets_reset_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limit_buckets_reset_at_idx ON public.rate_limit_buckets USING btree (reset_at);


--
-- Name: recent_clinical_items_user_patient_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recent_clinical_items_user_patient_uq ON public.recent_clinical_items USING btree (practice_id, user_id, patient_id);


--
-- Name: recent_clinical_items_user_viewed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recent_clinical_items_user_viewed_idx ON public.recent_clinical_items USING btree (practice_id, user_id, viewed_at);


--
-- Name: rooms_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rooms_location_idx ON public.rooms USING btree (practice_id, location_id, deleted_at);


--
-- Name: rooms_practice_location_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rooms_practice_location_id_uq ON public.rooms USING btree (practice_id, location_id, id);


--
-- Name: rooms_practice_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rooms_practice_name_idx ON public.rooms USING btree (practice_id, deleted_at, name);


--
-- Name: services_external_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_external_id_uq ON public.services USING btree (practice_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: services_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_import_fingerprint_uq ON public.services USING btree (practice_id, import_fingerprint) WHERE (import_fingerprint IS NOT NULL);


--
-- Name: services_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_practice_id_uq ON public.services USING btree (practice_id, id);


--
-- Name: services_practice_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_practice_name_idx ON public.services USING btree (practice_id, deleted_at, name);


--
-- Name: sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_idx ON public.sessions USING btree (expires);


--
-- Name: sms_consent_events_client_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_consent_events_client_history_idx ON public.sms_consent_events USING btree (practice_id, client_id, occurred_at, id);


--
-- Name: sms_consent_events_destination_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_consent_events_destination_history_idx ON public.sms_consent_events USING btree (practice_id, destination_e164, occurred_at, id);


--
-- Name: sms_consent_events_practice_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_consent_events_practice_event_key_uq ON public.sms_consent_events USING btree (practice_id, event_key);


--
-- Name: sms_consent_events_provider_message_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_consent_events_provider_message_uq ON public.sms_consent_events USING btree (practice_id, provider, provider_message_id) WHERE ((provider IS NOT NULL) AND (provider_message_id IS NOT NULL));


--
-- Name: sms_delivery_event_history_attempt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_delivery_event_history_attempt_idx ON public.sms_delivery_event_history USING btree (practice_id, attempt_id, created_at, id);


--
-- Name: sms_delivery_event_history_attribution_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_delivery_event_history_attribution_uq ON public.sms_delivery_event_history USING btree (delivery_event_id) WHERE (result = 'attributed'::public.sms_delivery_history_result);


--
-- Name: sms_delivery_event_history_event_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_delivery_event_history_event_id_uq ON public.sms_delivery_event_history USING btree (delivery_event_id, id);


--
-- Name: sms_delivery_event_history_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_delivery_event_history_event_idx ON public.sms_delivery_event_history USING btree (delivery_event_id, created_at, id);


--
-- Name: sms_delivery_event_history_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_delivery_event_history_event_key_uq ON public.sms_delivery_event_history USING btree (event_key);


--
-- Name: sms_delivery_event_history_practice_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_delivery_event_history_practice_queue_idx ON public.sms_delivery_event_history USING btree (practice_id, result, created_at, id);


--
-- Name: sms_delivery_event_history_reviewed_history_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_delivery_event_history_reviewed_history_uq ON public.sms_delivery_event_history USING btree (reviewed_history_id) WHERE (reviewed_history_id IS NOT NULL);


--
-- Name: sms_delivery_events_classification_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_delivery_events_classification_queue_idx ON public.sms_delivery_events USING btree (classification, received_at, id);


--
-- Name: sms_delivery_events_provider_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_delivery_events_provider_event_key_uq ON public.sms_delivery_events USING btree (provider, event_key);


--
-- Name: sms_delivery_events_provider_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_delivery_events_provider_message_idx ON public.sms_delivery_events USING btree (provider, provider_message_id, received_at, id);


--
-- Name: sms_provider_event_conflict_reviews_conflict_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_conflict_reviews_conflict_uq ON public.sms_provider_event_conflict_reviews USING btree (conflict_id);


--
-- Name: sms_provider_event_conflict_reviews_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_conflict_reviews_history_idx ON public.sms_provider_event_conflict_reviews USING btree (reviewed_at, id);


--
-- Name: sms_provider_event_conflict_reviews_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_conflict_reviews_operation_uq ON public.sms_provider_event_conflict_reviews USING btree (operation_id);


--
-- Name: sms_provider_event_conflicts_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_conflicts_identity_uq ON public.sms_provider_event_conflicts USING btree (original_event_id, incoming_raw_body_fingerprint_sha256);


--
-- Name: sms_provider_event_conflicts_recovery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_conflicts_recovery_idx ON public.sms_provider_event_conflicts USING btree (received_at, id);


--
-- Name: sms_provider_event_resolutions_base_event_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_resolutions_base_event_uq ON public.sms_provider_event_resolutions USING btree (event_id) WHERE (conflict_id IS NULL);


--
-- Name: sms_provider_event_resolutions_communication_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_communication_evidence_idx ON public.sms_provider_event_resolutions USING btree (inbound_communication_id) WHERE (inbound_communication_id IS NOT NULL);


--
-- Name: sms_provider_event_resolutions_conflict_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_resolutions_conflict_uq ON public.sms_provider_event_resolutions USING btree (conflict_id);


--
-- Name: sms_provider_event_resolutions_consent_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_consent_evidence_idx ON public.sms_provider_event_resolutions USING btree (sms_consent_event_id) WHERE (sms_consent_event_id IS NOT NULL);


--
-- Name: sms_provider_event_resolutions_delivery_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_delivery_evidence_idx ON public.sms_provider_event_resolutions USING btree (sms_delivery_event_id) WHERE (sms_delivery_event_id IS NOT NULL);


--
-- Name: sms_provider_event_resolutions_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_event_idx ON public.sms_provider_event_resolutions USING btree (event_id, resolved_at, id);


--
-- Name: sms_provider_event_resolutions_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_event_resolutions_operation_uq ON public.sms_provider_event_resolutions USING btree (operation_id);


--
-- Name: sms_provider_event_resolutions_practice_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_practice_history_idx ON public.sms_provider_event_resolutions USING btree (practice_id, resolved_at, id);


--
-- Name: sms_provider_event_resolutions_registration_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_event_resolutions_registration_evidence_idx ON public.sms_provider_event_resolutions USING btree (messaging_registration_event_id) WHERE (messaging_registration_event_id IS NOT NULL);


--
-- Name: sms_provider_events_blocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_blocked_idx ON public.sms_provider_events USING btree (practice_id, received_at, id) WHERE (state = 'blocked_recovery'::public.sms_provider_event_state);


--
-- Name: sms_provider_events_consent_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_consent_order_idx ON public.sms_provider_events USING btree (practice_id, from_e164, COALESCE(occurred_at, received_at), received_at, id) WHERE ((kind = 'inbound'::public.sms_provider_event_kind) AND (inbound_classification = ANY (ARRAY['stop'::public.sms_provider_inbound_classification, 'start'::public.sms_provider_inbound_classification])) AND (practice_id IS NOT NULL) AND (from_e164 IS NOT NULL));


--
-- Name: sms_provider_events_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_due_idx ON public.sms_provider_events USING btree (next_attempt_at, received_at, id) WHERE (state = ANY (ARRAY['pending'::public.sms_provider_event_state, 'retry'::public.sms_provider_event_state]));


--
-- Name: sms_provider_events_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_location_idx ON public.sms_provider_events USING btree (practice_id, location_id, received_at, id) WHERE (location_id IS NOT NULL);


--
-- Name: sms_provider_events_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_practice_idx ON public.sms_provider_events USING btree (practice_id, state, received_at, id) WHERE (practice_id IS NOT NULL);


--
-- Name: sms_provider_events_provider_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_provider_events_provider_event_key_uq ON public.sms_provider_events USING btree (provider, event_key);


--
-- Name: sms_provider_events_provider_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_provider_events_provider_message_idx ON public.sms_provider_events USING btree (provider, provider_message_id, received_at, id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: sms_send_attempt_events_attempt_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_attempt_events_attempt_history_idx ON public.sms_send_attempt_events USING btree (practice_id, attempt_id, created_at, id);


--
-- Name: sms_send_attempt_events_practice_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempt_events_practice_event_key_uq ON public.sms_send_attempt_events USING btree (practice_id, event_key);


--
-- Name: sms_send_attempt_events_provider_message_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempt_events_provider_message_uq ON public.sms_send_attempt_events USING btree (practice_id, provider_message_id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: sms_send_attempt_events_provider_result_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempt_events_provider_result_uq ON public.sms_send_attempt_events USING btree (practice_id, attempt_id) WHERE (kind = 'provider_result'::public.sms_send_attempt_event_kind);


--
-- Name: sms_send_attempts_client_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_attempts_client_history_idx ON public.sms_send_attempts USING btree (practice_id, client_id, created_at, id);


--
-- Name: sms_send_attempts_communication_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_attempts_communication_idx ON public.sms_send_attempts USING btree (practice_id, communication_id);


--
-- Name: sms_send_attempts_destination_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_attempts_destination_history_idx ON public.sms_send_attempts USING btree (practice_id, destination_e164, created_at, id);


--
-- Name: sms_send_attempts_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempts_practice_id_uq ON public.sms_send_attempts USING btree (practice_id, id);


--
-- Name: sms_send_attempts_practice_idempotency_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempts_practice_idempotency_uq ON public.sms_send_attempts USING btree (practice_id, idempotency_key);


--
-- Name: sms_send_attempts_resend_of_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_send_attempts_resend_of_uq ON public.sms_send_attempts USING btree (practice_id, resend_of_attempt_id) WHERE (resend_of_attempt_id IS NOT NULL);


--
-- Name: sms_send_attempts_source_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_attempts_source_history_idx ON public.sms_send_attempts USING btree (practice_id, source, source_id, created_at);


--
-- Name: sms_suppressions_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_suppressions_practice_idx ON public.sms_suppressions USING btree (practice_id, deleted_at);


--
-- Name: sms_suppressions_practice_phone_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_suppressions_practice_phone_uq ON public.sms_suppressions USING btree (practice_id, phone);


--
-- Name: soap_note_addenda_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soap_note_addenda_history_idx ON public.soap_note_addenda USING btree (practice_id, soap_note_id, created_at, id);


--
-- Name: soap_note_addenda_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_note_addenda_operation_uq ON public.soap_note_addenda USING btree (practice_id, operation_id);


--
-- Name: soap_note_replacements_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_note_replacements_operation_uq ON public.soap_note_replacements USING btree (practice_id, operation_id);


--
-- Name: soap_note_replacements_replacement_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_note_replacements_replacement_uq ON public.soap_note_replacements USING btree (practice_id, replacement_soap_note_id);


--
-- Name: soap_note_replacements_source_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soap_note_replacements_source_history_idx ON public.soap_note_replacements USING btree (practice_id, source_soap_note_id, created_at, id);


--
-- Name: soap_note_replacements_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_note_replacements_source_uq ON public.soap_note_replacements USING btree (practice_id, source_soap_note_id);


--
-- Name: soap_notes_active_appointment_draft_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_notes_active_appointment_draft_uq ON public.soap_notes USING btree (practice_id, appointment_id) WHERE ((status = 'draft'::public.soap_note_status) AND (appointment_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: soap_notes_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soap_notes_appointment_idx ON public.soap_notes USING btree (practice_id, appointment_id, deleted_at);


--
-- Name: soap_notes_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_notes_import_fingerprint_uq ON public.soap_notes USING btree (practice_id, import_fingerprint) WHERE ((import_fingerprint IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: soap_notes_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soap_notes_patient_idx ON public.soap_notes USING btree (patient_id);


--
-- Name: soap_notes_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soap_notes_practice_idx ON public.soap_notes USING btree (practice_id, deleted_at);


--
-- Name: soap_notes_practice_record_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX soap_notes_practice_record_uq ON public.soap_notes USING btree (practice_id, id);


--
-- Name: staff_schedules_active_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_schedules_active_day_idx ON public.staff_schedules USING btree (practice_id, location_id, day_of_week, user_id) WHERE (deleted_at IS NULL);


--
-- Name: staff_schedules_active_null_location_window_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX staff_schedules_active_null_location_window_uq ON public.staff_schedules USING btree (practice_id, user_id, day_of_week, start_time, end_time) WHERE ((deleted_at IS NULL) AND (location_id IS NULL));


--
-- Name: staff_schedules_active_window_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX staff_schedules_active_window_uq ON public.staff_schedules USING btree (practice_id, user_id, location_id, day_of_week, start_time, end_time) WHERE ((deleted_at IS NULL) AND (location_id IS NOT NULL));


--
-- Name: staff_schedules_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_schedules_location_idx ON public.staff_schedules USING btree (practice_id, location_id, deleted_at);


--
-- Name: staff_schedules_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_schedules_user_idx ON public.staff_schedules USING btree (practice_id, user_id, deleted_at);


--
-- Name: stripe_events_conversion_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stripe_events_conversion_evidence_idx ON public.stripe_events USING btree (evidence_kind, practice_id, event_created_at, event_id) WHERE (evidence_kind IS NOT NULL);


--
-- Name: suppliers_practice_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_practice_name_idx ON public.suppliers USING btree (practice_id, deleted_at, name);


--
-- Name: treatment_plan_items_plan_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treatment_plan_items_plan_order_idx ON public.treatment_plan_items USING btree (plan_id, deleted_at, sort_order);


--
-- Name: treatment_plans_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treatment_plans_patient_idx ON public.treatment_plans USING btree (patient_id);


--
-- Name: treatment_plans_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treatment_plans_practice_idx ON public.treatment_plans USING btree (practice_id, deleted_at);


--
-- Name: treatment_template_items_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treatment_template_items_template_idx ON public.treatment_template_items USING btree (template_id, deleted_at);


--
-- Name: treatment_templates_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treatment_templates_practice_idx ON public.treatment_templates USING btree (practice_id, deleted_at);


--
-- Name: usage_meter_retry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usage_meter_retry_idx ON public.usage_records USING btree (stripe_metered_at);


--
-- Name: usage_practice_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usage_practice_period_idx ON public.usage_records USING btree (practice_id, period_month);


--
-- Name: users_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_location_idx ON public.users USING btree (practice_id, location_id, deleted_at);


--
-- Name: users_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_practice_id_uq ON public.users USING btree (practice_id, id);


--
-- Name: users_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_practice_idx ON public.users USING btree (practice_id, deleted_at);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (practice_id, role);


--
-- Name: users_veterinarian_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_veterinarian_idx ON public.users USING btree (practice_id, is_veterinarian, deleted_at);


--
-- Name: vaccination_records_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vaccination_records_appointment_idx ON public.vaccination_records USING btree (practice_id, appointment_id, deleted_at);


--
-- Name: vaccination_records_import_fingerprint_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vaccination_records_import_fingerprint_uq ON public.vaccination_records USING btree (practice_id, import_fingerprint) WHERE ((import_fingerprint IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: vaccination_records_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vaccination_records_patient_idx ON public.vaccination_records USING btree (patient_id, next_due_date);


--
-- Name: vaccination_records_practice_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vaccination_records_practice_due_idx ON public.vaccination_records USING btree (practice_id, next_due_date, deleted_at);


--
-- Name: vaccination_records_practice_record_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vaccination_records_practice_record_uq ON public.vaccination_records USING btree (practice_id, id);


--
-- Name: vaccination_records_visit_source_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vaccination_records_visit_source_uq ON public.vaccination_records USING btree (practice_id, appointment_id, id);


--
-- Name: verification_tokens_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_tokens_expires_idx ON public.verification_tokens USING btree (expires);


--
-- Name: visit_closeouts_appointment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_closeouts_appointment_uq ON public.visit_closeouts USING btree (appointment_id);


--
-- Name: visit_closeouts_pending_follow_up_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_closeouts_pending_follow_up_idx ON public.visit_closeouts USING btree (practice_id, follow_up_disposition, follow_up_resolved_at, follow_up_due_date);


--
-- Name: visit_closeouts_practice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_closeouts_practice_status_idx ON public.visit_closeouts USING btree (practice_id, status, updated_at);


--
-- Name: visit_treatment_plan_presentations_consent_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_presentations_consent_uq ON public.visit_treatment_plan_presentations USING btree (consent_request_id);


--
-- Name: visit_treatment_plan_presentations_response_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_presentations_response_uq ON public.visit_treatment_plan_presentations USING btree (response_id);


--
-- Name: visit_treatment_plan_presentations_revision_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plan_presentations_revision_status_idx ON public.visit_treatment_plan_presentations USING btree (practice_id, revision_id, status, expires_at);


--
-- Name: visit_treatment_plan_presentations_token_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_presentations_token_hash_uq ON public.visit_treatment_plan_presentations USING btree (token_hash);


--
-- Name: visit_treatment_plan_response_lines_response_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plan_response_lines_response_idx ON public.visit_treatment_plan_response_lines USING btree (practice_id, response_id, id);


--
-- Name: visit_treatment_plan_response_lines_response_line_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_response_lines_response_line_uq ON public.visit_treatment_plan_response_lines USING btree (response_id, revision_line_id);


--
-- Name: visit_treatment_plan_responses_consent_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_responses_consent_uq ON public.visit_treatment_plan_responses USING btree (consent_request_id);


--
-- Name: visit_treatment_plan_responses_plan_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plan_responses_plan_history_idx ON public.visit_treatment_plan_responses USING btree (practice_id, plan_id, created_at, id);


--
-- Name: visit_treatment_plan_responses_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_responses_practice_operation_uq ON public.visit_treatment_plan_responses USING btree (practice_id, operation_id);


--
-- Name: visit_treatment_plan_responses_practice_revision_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_responses_practice_revision_id_uq ON public.visit_treatment_plan_responses USING btree (practice_id, id, revision_id);


--
-- Name: visit_treatment_plan_responses_revision_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_responses_revision_uq ON public.visit_treatment_plan_responses USING btree (revision_id);


--
-- Name: visit_treatment_plan_revision_lines_practice_revision_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_revision_lines_practice_revision_id_uq ON public.visit_treatment_plan_revision_lines USING btree (practice_id, id, revision_id);


--
-- Name: visit_treatment_plan_revision_lines_revision_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plan_revision_lines_revision_order_idx ON public.visit_treatment_plan_revision_lines USING btree (practice_id, revision_id, sort_order);


--
-- Name: visit_treatment_plan_revision_lines_revision_order_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_revision_lines_revision_order_uq ON public.visit_treatment_plan_revision_lines USING btree (revision_id, sort_order);


--
-- Name: visit_treatment_plan_revisions_plan_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plan_revisions_plan_history_idx ON public.visit_treatment_plan_revisions USING btree (practice_id, plan_id, revision_number);


--
-- Name: visit_treatment_plan_revisions_plan_revision_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_revisions_plan_revision_uq ON public.visit_treatment_plan_revisions USING btree (plan_id, revision_number);


--
-- Name: visit_treatment_plan_revisions_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_revisions_practice_operation_uq ON public.visit_treatment_plan_revisions USING btree (practice_id, operation_id);


--
-- Name: visit_treatment_plan_revisions_practice_plan_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plan_revisions_practice_plan_id_uq ON public.visit_treatment_plan_revisions USING btree (practice_id, id, plan_id);


--
-- Name: visit_treatment_plans_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plans_appointment_idx ON public.visit_treatment_plans USING btree (practice_id, appointment_id, created_at);


--
-- Name: visit_treatment_plans_patient_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_treatment_plans_patient_history_idx ON public.visit_treatment_plans USING btree (practice_id, patient_id, created_at, id);


--
-- Name: visit_treatment_plans_practice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plans_practice_id_uq ON public.visit_treatment_plans USING btree (practice_id, id);


--
-- Name: visit_treatment_plans_practice_operation_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_treatment_plans_practice_operation_uq ON public.visit_treatment_plans USING btree (practice_id, operation_id);


--
-- Name: visit_work_items_invoice_item_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_work_items_invoice_item_uq ON public.visit_work_items USING btree (invoice_item_id) WHERE ((invoice_item_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_lab_result_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_work_items_lab_result_uq ON public.visit_work_items USING btree (practice_id, lab_result_id) WHERE ((lab_result_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_prescription_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_work_items_prescription_uq ON public.visit_work_items USING btree (practice_id, prescription_id) WHERE ((prescription_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_procedure_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_work_items_procedure_uq ON public.visit_work_items USING btree (practice_id, procedure_id) WHERE ((procedure_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_work_items_unresolved_idx ON public.visit_work_items USING btree (practice_id, appointment_id, created_at, id) WHERE ((status = 'unresolved'::public.visit_work_status) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_vaccination_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visit_work_items_vaccination_uq ON public.visit_work_items USING btree (practice_id, vaccination_record_id) WHERE ((vaccination_record_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: visit_work_items_visit_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_work_items_visit_status_idx ON public.visit_work_items USING btree (practice_id, appointment_id, status, created_at, id);


--
-- Name: vital_signs_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vital_signs_appointment_idx ON public.vital_signs USING btree (practice_id, appointment_id, deleted_at, recorded_at);


--
-- Name: vital_signs_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vital_signs_patient_idx ON public.vital_signs USING btree (patient_id, recorded_at);


--
-- Name: vital_signs_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vital_signs_practice_idx ON public.vital_signs USING btree (practice_id, deleted_at);


--
-- Name: vital_signs_practice_record_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vital_signs_practice_record_uq ON public.vital_signs USING btree (practice_id, id);


--
-- Name: voice_dictations_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voice_dictations_patient_idx ON public.voice_dictations USING btree (practice_id, patient_id, deleted_at);


--
-- Name: voice_dictations_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voice_dictations_practice_idx ON public.voice_dictations USING btree (practice_id, deleted_at);


--
-- Name: voice_dictations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX voice_dictations_status_idx ON public.voice_dictations USING btree (practice_id, status, deleted_at);


--
-- Name: waitlist_client_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waitlist_client_status_idx ON public.appointment_waitlist USING btree (practice_id, client_id, status, deleted_at);


--
-- Name: waitlist_patient_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waitlist_patient_status_idx ON public.appointment_waitlist USING btree (practice_id, patient_id, status, deleted_at);


--
-- Name: waitlist_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waitlist_practice_idx ON public.appointment_waitlist USING btree (practice_id, status);


--
-- Name: webhooks_practice_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhooks_practice_active_idx ON public.webhooks USING btree (practice_id, deleted_at, active);


--
-- Name: wellness_enrollments_billing_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wellness_enrollments_billing_due_idx ON public.wellness_enrollments USING btree (practice_id, status, next_billing_date, deleted_at);


--
-- Name: wellness_enrollments_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wellness_enrollments_due_idx ON public.wellness_enrollments USING btree (next_billing_date);


--
-- Name: wellness_enrollments_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wellness_enrollments_practice_idx ON public.wellness_enrollments USING btree (practice_id, status);


--
-- Name: wellness_enrollments_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wellness_enrollments_target_idx ON public.wellness_enrollments USING btree (practice_id, plan_id, client_id, patient_id, status, deleted_at);


--
-- Name: wellness_plans_practice_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wellness_plans_practice_created_idx ON public.wellness_plans USING btree (practice_id, deleted_at, created_at);


--
-- Name: appointments appointments_assign_scheduling_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER appointments_assign_scheduling_location BEFORE INSERT OR UPDATE OF practice_id, location_id, room_id, doctor_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.assign_appointment_scheduling_location();


--
-- Name: auth_email_attempts auth_email_attempts_state_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auth_email_attempts_state_guard BEFORE DELETE OR UPDATE ON public.auth_email_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_auth_email_attempt_mutation();


--
-- Name: auth_email_delivery_events auth_email_delivery_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auth_email_delivery_events_immutable BEFORE DELETE OR UPDATE ON public.auth_email_delivery_events FOR EACH ROW EXECUTE FUNCTION public.reject_auth_email_delivery_event_mutation();


--
-- Name: auth_email_provider_identity_conflicts auth_email_provider_identity_conflicts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auth_email_provider_identity_conflicts_immutable BEFORE DELETE OR UPDATE ON public.auth_email_provider_identity_conflicts FOR EACH ROW EXECUTE FUNCTION public.reject_auth_email_delivery_event_mutation();


--
-- Name: auth_email_webhook_conflicts auth_email_webhook_conflicts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auth_email_webhook_conflicts_immutable BEFORE DELETE OR UPDATE ON public.auth_email_webhook_conflicts FOR EACH ROW EXECUTE FUNCTION public.reject_auth_email_delivery_event_mutation();


--
-- Name: clinic_pilot_events clinic_pilot_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clinic_pilot_events_immutable BEFORE DELETE OR UPDATE ON public.clinic_pilot_events FOR EACH ROW EXECUTE FUNCTION public.reject_clinic_pilot_event_mutation();


--
-- Name: clinic_pilots clinic_pilots_require_event; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER clinic_pilots_require_event AFTER INSERT OR UPDATE ON public.clinic_pilots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_clinic_pilot_projection_audit();


--
-- Name: clinical_record_corrections clinical_record_corrections_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clinical_record_corrections_immutable BEFORE DELETE OR UPDATE ON public.clinical_record_corrections FOR EACH ROW EXECUTE FUNCTION public.prevent_clinical_record_correction_mutation();


--
-- Name: clinical_record_corrections clinical_record_corrections_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clinical_record_corrections_validate_source BEFORE INSERT ON public.clinical_record_corrections FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_record_correction_source();


--
-- Name: files consent_files_signed_binding_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER consent_files_signed_binding_guard AFTER INSERT OR DELETE OR UPDATE ON public.files DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_signed_consent_file_binding();


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER consent_receipt_capabilities_guard BEFORE INSERT OR DELETE OR UPDATE ON public.consent_receipt_capabilities FOR EACH ROW EXECUTE FUNCTION public.protect_consent_receipt_capability();


--
-- Name: consent_requests consent_requests_evidence_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER consent_requests_evidence_guard BEFORE INSERT OR DELETE OR UPDATE ON public.consent_requests FOR EACH ROW EXECUTE FUNCTION public.protect_consent_request_evidence();


--
-- Name: consent_requests consent_requests_signed_file_binding_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER consent_requests_signed_file_binding_guard AFTER INSERT OR UPDATE ON public.consent_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_signed_consent_file_binding();


--
-- Name: files consent_signature_files_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER consent_signature_files_guard BEFORE INSERT OR DELETE OR UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.protect_consent_signature_file();


--
-- Name: dispense_charge_queue dispense_charge_queue_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dispense_charge_queue_no_delete BEFORE DELETE ON public.dispense_charge_queue FOR EACH ROW EXECUTE FUNCTION public.prevent_dispense_charge_delete();


--
-- Name: dispense_charge_queue dispense_charge_queue_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dispense_charge_queue_protect BEFORE UPDATE ON public.dispense_charge_queue FOR EACH ROW EXECUTE FUNCTION public.protect_dispense_charge_queue();


--
-- Name: dispense_charge_queue dispense_charge_queue_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dispense_charge_queue_validate_source BEFORE INSERT ON public.dispense_charge_queue FOR EACH ROW EXECUTE FUNCTION public.validate_dispense_charge_source();


--
-- Name: ext_ai_audit_log ext_ai_audit_log_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ext_ai_audit_log_immutable BEFORE DELETE OR UPDATE ON public.ext_ai_audit_log FOR EACH ROW EXECUTE FUNCTION public.protect_ai_audit_ledger();


--
-- Name: invoice_items invoice_items_reopen_dispense_charge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_items_reopen_dispense_charge AFTER UPDATE OF deleted_at ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.reopen_dispense_charge_from_line();


--
-- Name: invoice_items invoice_items_validate_dispense_charge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_items_validate_dispense_charge BEFORE INSERT OR UPDATE OF source_dispense_charge_id, invoice_id, item_type, item_id, quantity, unit_price, description, deleted_at ON public.invoice_items FOR EACH ROW WHEN (((new.source_dispense_charge_id IS NOT NULL) AND (new.deleted_at IS NULL))) EXECUTE FUNCTION public.validate_dispense_charge_invoice_line();


--
-- Name: invoices invoices_reopen_dispense_charges; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoices_reopen_dispense_charges AFTER UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.reopen_dispense_charges_from_void_invoice();


--
-- Name: lab_result_events lab_result_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lab_result_events_immutable BEFORE DELETE OR UPDATE ON public.lab_result_events FOR EACH ROW EXECUTE FUNCTION public.reject_lab_result_event_mutation();


--
-- Name: lab_result_events lab_result_events_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lab_result_events_validate_source BEFORE INSERT ON public.lab_result_events FOR EACH ROW EXECUTE FUNCTION public.validate_lab_result_event_source();


--
-- Name: lab_result_replacements lab_result_replacements_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lab_result_replacements_immutable BEFORE DELETE OR UPDATE ON public.lab_result_replacements FOR EACH ROW EXECUTE FUNCTION public.reject_lab_result_replacement_mutation();


--
-- Name: lab_result_replacements lab_result_replacements_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lab_result_replacements_validate BEFORE INSERT ON public.lab_result_replacements FOR EACH ROW EXECUTE FUNCTION public.validate_lab_result_replacement_insert();


--
-- Name: messaging_registration_events messaging_registration_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messaging_registration_events_immutable BEFORE DELETE OR UPDATE ON public.messaging_registration_events FOR EACH ROW EXECUTE FUNCTION public.reject_messaging_registration_event_mutation();


--
-- Name: messaging_registration_events messaging_registration_events_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messaging_registration_events_validate BEFORE INSERT ON public.messaging_registration_events FOR EACH ROW EXECUTE FUNCTION public.validate_messaging_registration_event_insert();


--
-- Name: patient_allergies patient_allergies_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER patient_allergies_immutable BEFORE DELETE OR UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.prevent_patient_allergy_mutation();


--
-- Name: patient_merge_events patient_merge_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER patient_merge_events_immutable BEFORE DELETE OR UPDATE ON public.patient_merge_events FOR EACH ROW EXECUTE FUNCTION public.reject_patient_merge_event_mutation();


--
-- Name: patient_merge_events patient_merge_events_validate_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER patient_merge_events_validate_insert BEFORE INSERT ON public.patient_merge_events FOR EACH ROW EXECUTE FUNCTION public.validate_patient_merge_event_insert();


--
-- Name: payment_processor_refunds payment_processor_refunds_tenant_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_processor_refunds_tenant_guard BEFORE INSERT OR UPDATE OF practice_id, original_payment_id, refund_payment_id ON public.payment_processor_refunds FOR EACH ROW EXECUTE FUNCTION public.validate_payment_processor_refund_tenant();


--
-- Name: prescription_events prescription_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prescription_events_immutable BEFORE DELETE OR UPDATE ON public.prescription_events FOR EACH ROW EXECUTE FUNCTION public.reject_prescription_event_mutation();


--
-- Name: prescription_events prescription_events_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prescription_events_validate_source BEFORE INSERT ON public.prescription_events FOR EACH ROW EXECUTE FUNCTION public.validate_prescription_event_source();


--
-- Name: rooms rooms_assign_scheduling_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rooms_assign_scheduling_location BEFORE INSERT OR UPDATE OF practice_id, location_id ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.assign_room_scheduling_location();


--
-- Name: sms_consent_events sms_consent_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_consent_events_immutable BEFORE DELETE OR UPDATE ON public.sms_consent_events FOR EACH ROW EXECUTE FUNCTION public.reject_sms_consent_event_mutation();


--
-- Name: sms_delivery_event_history sms_delivery_event_history_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_delivery_event_history_immutable BEFORE DELETE OR UPDATE ON public.sms_delivery_event_history FOR EACH ROW EXECUTE FUNCTION public.reject_sms_send_ledger_mutation();


--
-- Name: sms_delivery_events sms_delivery_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_delivery_events_immutable BEFORE DELETE OR UPDATE ON public.sms_delivery_events FOR EACH ROW EXECUTE FUNCTION public.reject_sms_send_ledger_mutation();


--
-- Name: sms_provider_event_conflict_reviews sms_provider_event_conflict_reviews_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_provider_event_conflict_reviews_immutable BEFORE DELETE OR UPDATE ON public.sms_provider_event_conflict_reviews FOR EACH ROW EXECUTE FUNCTION public.reject_sms_provider_conflict_evidence_mutation();


--
-- Name: sms_provider_event_conflicts sms_provider_event_conflicts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_provider_event_conflicts_immutable BEFORE DELETE OR UPDATE ON public.sms_provider_event_conflicts FOR EACH ROW EXECUTE FUNCTION public.reject_sms_provider_conflict_evidence_mutation();


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_provider_event_resolutions_immutable BEFORE DELETE OR UPDATE ON public.sms_provider_event_resolutions FOR EACH ROW EXECUTE FUNCTION public.reject_sms_provider_event_resolution_mutation();


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_validate_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_provider_event_resolutions_validate_insert BEFORE INSERT ON public.sms_provider_event_resolutions FOR EACH ROW EXECUTE FUNCTION public.validate_sms_provider_event_resolution_insert();


--
-- Name: sms_provider_events sms_provider_events_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_provider_events_mutation_guard BEFORE INSERT OR DELETE OR UPDATE ON public.sms_provider_events FOR EACH ROW EXECUTE FUNCTION public.guard_sms_provider_event_mutation();


--
-- Name: sms_send_attempt_events sms_send_attempt_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_send_attempt_events_immutable BEFORE DELETE OR UPDATE ON public.sms_send_attempt_events FOR EACH ROW EXECUTE FUNCTION public.reject_sms_send_ledger_mutation();


--
-- Name: sms_send_attempts sms_send_attempts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_send_attempts_immutable BEFORE DELETE OR UPDATE ON public.sms_send_attempts FOR EACH ROW EXECUTE FUNCTION public.reject_sms_send_ledger_mutation();


--
-- Name: soap_note_addenda soap_note_addenda_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER soap_note_addenda_guard BEFORE INSERT OR DELETE OR UPDATE ON public.soap_note_addenda FOR EACH ROW EXECUTE FUNCTION public.guard_soap_note_addendum();


--
-- Name: soap_note_replacements soap_note_replacements_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER soap_note_replacements_immutable BEFORE DELETE OR UPDATE ON public.soap_note_replacements FOR EACH ROW EXECUTE FUNCTION public.reject_soap_note_replacement_mutation();


--
-- Name: soap_note_replacements soap_note_replacements_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER soap_note_replacements_validate BEFORE INSERT ON public.soap_note_replacements FOR EACH ROW EXECUTE FUNCTION public.validate_soap_note_replacement_insert();


--
-- Name: soap_notes soap_notes_appointment_invariant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER soap_notes_appointment_invariant AFTER INSERT OR DELETE OR UPDATE ON public.soap_notes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_soap_appointment_invariant();


--
-- Name: soap_notes soap_notes_lifecycle_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER soap_notes_lifecycle_guard BEFORE INSERT OR DELETE OR UPDATE ON public.soap_notes FOR EACH ROW EXECUTE FUNCTION public.guard_soap_note_lifecycle();


--
-- Name: visit_treatment_plans visit_treatment_plan_close_signing_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_close_signing_guard BEFORE UPDATE ON public.visit_treatment_plans FOR EACH ROW EXECUTE FUNCTION public.reject_treatment_plan_close_while_signing();


--
-- Name: visit_treatment_plans visit_treatment_plan_identity_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_identity_guard BEFORE DELETE OR UPDATE ON public.visit_treatment_plans FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_identity();


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_presentation_guard BEFORE DELETE OR UPDATE ON public.visit_treatment_plan_presentations FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_presentation();


--
-- Name: visit_treatment_plan_responses visit_treatment_plan_response_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_response_immutable BEFORE DELETE OR UPDATE ON public.visit_treatment_plan_responses FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_response();


--
-- Name: visit_treatment_plan_response_lines visit_treatment_plan_response_line_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_response_line_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.visit_treatment_plan_response_lines FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_response_line();


--
-- Name: visit_treatment_plan_responses visit_treatment_plan_response_seal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_response_seal BEFORE INSERT ON public.visit_treatment_plan_responses FOR EACH ROW EXECUTE FUNCTION public.validate_visit_treatment_plan_response_seal();


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revision_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_revision_immutable BEFORE DELETE OR UPDATE ON public.visit_treatment_plan_revisions FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_revision();


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_line_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_revision_line_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.visit_treatment_plan_revision_lines FOR EACH ROW EXECUTE FUNCTION public.protect_visit_treatment_plan_revision_line();


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revision_seal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_revision_seal BEFORE INSERT ON public.visit_treatment_plan_revisions FOR EACH ROW EXECUTE FUNCTION public.validate_visit_treatment_plan_revision_seal();


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revision_signing_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER visit_treatment_plan_revision_signing_guard BEFORE INSERT ON public.visit_treatment_plan_revisions FOR EACH ROW EXECUTE FUNCTION public.reject_revision_while_treatment_plan_signing();


--
-- Name: ai_imaging_analyses ai_imaging_analyses_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: ai_imaging_analyses ai_imaging_analyses_file_id_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_file_id_files_id_fk FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: ai_imaging_analyses ai_imaging_analyses_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ai_imaging_analyses ai_imaging_analyses_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ai_imaging_analyses ai_imaging_analyses_requested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_imaging_analyses
    ADD CONSTRAINT ai_imaging_analyses_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: api_keys api_keys_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: appointment_types appointment_types_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_types
    ADD CONSTRAINT appointment_types_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: appointment_waitlist appointment_waitlist_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: appointment_waitlist appointment_waitlist_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: appointment_waitlist appointment_waitlist_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: appointment_waitlist appointment_waitlist_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: appointment_waitlist appointment_waitlist_type_id_appointment_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_type_id_appointment_types_id_fk FOREIGN KEY (type_id) REFERENCES public.appointment_types(id);


--
-- Name: appointments appointments_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: appointments appointments_doctor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_users_id_fk FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: appointments appointments_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: appointments appointments_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: appointments appointments_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: appointments appointments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: appointments appointments_recurring_series_id_recurring_series_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_recurring_series_id_recurring_series_id_fk FOREIGN KEY (recurring_series_id) REFERENCES public.recurring_series(id);


--
-- Name: appointments appointments_room_id_rooms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_room_id_rooms_id_fk FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: appointments appointments_room_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_room_location_tenant_fk FOREIGN KEY (practice_id, location_id, room_id) REFERENCES public.rooms(practice_id, location_id, id);


--
-- Name: appointments appointments_type_id_appointment_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_type_id_appointment_types_id_fk FOREIGN KEY (type_id) REFERENCES public.appointment_types(id);


--
-- Name: audit_log audit_log_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: audit_log audit_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: auth_email_attempts auth_email_attempts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_attempts
    ADD CONSTRAINT auth_email_attempts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: auth_email_attempts auth_email_attempts_user_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_attempts
    ADD CONSTRAINT auth_email_attempts_user_tenant_fk FOREIGN KEY (practice_id, user_id) REFERENCES public.users(practice_id, id);


--
-- Name: auth_email_delivery_events auth_email_delivery_events_attempt_id_auth_email_attempts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_delivery_events
    ADD CONSTRAINT auth_email_delivery_events_attempt_id_auth_email_attempts_id_fk FOREIGN KEY (attempt_id) REFERENCES public.auth_email_attempts(id);


--
-- Name: auth_email_provider_identity_conflicts auth_email_provider_identity_conflicts_attempt_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_provider_identity_conflicts
    ADD CONSTRAINT auth_email_provider_identity_conflicts_attempt_fk FOREIGN KEY (attempt_id) REFERENCES public.auth_email_attempts(id);


--
-- Name: auth_email_webhook_conflicts auth_email_webhook_conflicts_webhook_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_email_webhook_conflicts
    ADD CONSTRAINT auth_email_webhook_conflicts_webhook_fk FOREIGN KEY (original_webhook_id) REFERENCES public.auth_email_delivery_events(webhook_id);


--
-- Name: auth_tokens auth_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: booking_pages booking_pages_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_pages
    ADD CONSTRAINT booking_pages_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: capture_sessions capture_sessions_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: capture_sessions capture_sessions_appointment_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_appointment_patient_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: capture_sessions capture_sessions_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: capture_sessions capture_sessions_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: capture_sessions capture_sessions_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: capture_sessions capture_sessions_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: capture_sessions capture_sessions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_sessions
    ADD CONSTRAINT capture_sessions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: care_reminders care_reminders_completer_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_completer_tenant_fk FOREIGN KEY (practice_id, completed_by) REFERENCES public.users(practice_id, id);


--
-- Name: care_reminders care_reminders_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: care_reminders care_reminders_dismisser_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_dismisser_tenant_fk FOREIGN KEY (practice_id, dismissed_by) REFERENCES public.users(practice_id, id);


--
-- Name: care_reminders care_reminders_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: care_reminders care_reminders_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.care_reminders
    ADD CONSTRAINT care_reminders_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: case_entries case_entries_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_entries
    ADD CONSTRAINT case_entries_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: case_entries case_entries_case_id_cases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_entries
    ADD CONSTRAINT case_entries_case_id_cases_id_fk FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: cases cases_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: cases cases_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: cases cases_primary_vet_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_primary_vet_id_users_id_fk FOREIGN KEY (primary_vet_id) REFERENCES public.users(id);


--
-- Name: client_contacts client_contacts_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: client_contacts client_contacts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clients clients_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clinic_pilot_events clinic_pilot_events_acceptance_user_practice_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_acceptance_user_practice_fk FOREIGN KEY (practice_id, clinic_acceptance_by_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: clinic_pilot_events clinic_pilot_events_clinic_pilot_id_clinic_pilots_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_clinic_pilot_id_clinic_pilots_id_fk FOREIGN KEY (clinic_pilot_id) REFERENCES public.clinic_pilots(id);


--
-- Name: clinic_pilot_events clinic_pilot_events_first_visit_validated_closeout_id_visit_clo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_first_visit_validated_closeout_id_visit_clo FOREIGN KEY (first_visit_validated_closeout_id) REFERENCES public.visit_closeouts(id);


--
-- Name: clinic_pilot_events clinic_pilot_events_pilot_practice_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_pilot_practice_fk FOREIGN KEY (clinic_pilot_id, practice_id) REFERENCES public.clinic_pilots(id, practice_id);


--
-- Name: clinic_pilot_events clinic_pilot_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilot_events
    ADD CONSTRAINT clinic_pilot_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clinic_pilots clinic_pilots_acceptance_user_practice_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilots
    ADD CONSTRAINT clinic_pilots_acceptance_user_practice_fk FOREIGN KEY (practice_id, clinic_acceptance_by_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: clinic_pilots clinic_pilots_first_visit_validated_closeout_id_visit_closeouts; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilots
    ADD CONSTRAINT clinic_pilots_first_visit_validated_closeout_id_visit_closeouts FOREIGN KEY (first_visit_validated_closeout_id) REFERENCES public.visit_closeouts(id);


--
-- Name: clinic_pilots clinic_pilots_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_pilots
    ADD CONSTRAINT clinic_pilots_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clinical_notes clinical_notes_author_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: clinical_notes clinical_notes_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: clinical_notes clinical_notes_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_corrected_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_corrected_by_users_id_fk FOREIGN KEY (corrected_by) REFERENCES public.users(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_lab_result_id_lab_results_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_lab_result_id_lab_results_id_fk FOREIGN KEY (lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_lab_result_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_lab_result_source_fk FOREIGN KEY (practice_id, lab_result_id) REFERENCES public.lab_results(practice_id, id);


--
-- Name: clinical_record_corrections clinical_record_corrections_patient_allergy_id_patient_allergie; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_patient_allergy_id_patient_allergie FOREIGN KEY (patient_allergy_id) REFERENCES public.patient_allergies(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_patient_allergy_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_patient_allergy_source_fk FOREIGN KEY (patient_allergy_id, patient_id) REFERENCES public.patient_allergies(id, patient_id);


--
-- Name: clinical_record_corrections clinical_record_corrections_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_practice_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_practice_actor_fk FOREIGN KEY (practice_id, corrected_by) REFERENCES public.users(practice_id, id);


--
-- Name: clinical_record_corrections clinical_record_corrections_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: clinical_record_corrections clinical_record_corrections_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: clinical_record_corrections clinical_record_corrections_soap_note_id_soap_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_soap_note_id_soap_notes_id_fk FOREIGN KEY (soap_note_id) REFERENCES public.soap_notes(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_soap_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_soap_source_fk FOREIGN KEY (practice_id, soap_note_id) REFERENCES public.soap_notes(practice_id, id);


--
-- Name: clinical_record_corrections clinical_record_corrections_vaccination_record_id_vaccination_r; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_vaccination_record_id_vaccination_r FOREIGN KEY (vaccination_record_id) REFERENCES public.vaccination_records(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_vaccination_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_vaccination_source_fk FOREIGN KEY (practice_id, vaccination_record_id) REFERENCES public.vaccination_records(practice_id, id);


--
-- Name: clinical_record_corrections clinical_record_corrections_vital_sign_id_vital_signs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_vital_sign_id_vital_signs_id_fk FOREIGN KEY (vital_sign_id) REFERENCES public.vital_signs(id);


--
-- Name: clinical_record_corrections clinical_record_corrections_vital_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_record_corrections
    ADD CONSTRAINT clinical_record_corrections_vital_source_fk FOREIGN KEY (practice_id, vital_sign_id) REFERENCES public.vital_signs(practice_id, id);


--
-- Name: communications communications_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: communications communications_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: communications communications_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: consent_forms consent_forms_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_forms
    ADD CONSTRAINT consent_forms_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_consent_request_id_consent_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_consent_request_id_consent_request FOREIGN KEY (consent_request_id) REFERENCES public.consent_requests(id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_consent_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_consent_tenant_fk FOREIGN KEY (practice_id, consent_request_id) REFERENCES public.consent_requests(practice_id, id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_file_id_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_file_id_files_id_fk FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_file_tenant_fk FOREIGN KEY (practice_id, file_id) REFERENCES public.files(practice_id, id);


--
-- Name: consent_receipt_capabilities consent_receipt_capabilities_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_receipt_capabilities
    ADD CONSTRAINT consent_receipt_capabilities_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: consent_requests consent_requests_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: consent_requests consent_requests_appointment_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_appointment_patient_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: consent_requests consent_requests_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consent_requests consent_requests_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: consent_requests consent_requests_file_id_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_file_id_files_id_fk FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: consent_requests consent_requests_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_file_tenant_fk FOREIGN KEY (practice_id, file_id) REFERENCES public.files(practice_id, id);


--
-- Name: consent_requests consent_requests_form_id_consent_forms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_form_id_consent_forms_id_fk FOREIGN KEY (form_id) REFERENCES public.consent_forms(id);


--
-- Name: consent_requests consent_requests_form_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_form_tenant_fk FOREIGN KEY (practice_id, form_id) REFERENCES public.consent_forms(practice_id, id);


--
-- Name: consent_requests consent_requests_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: consent_requests consent_requests_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: consent_requests consent_requests_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_requests
    ADD CONSTRAINT consent_requests_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: controlled_substance_log controlled_substance_log_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_log
    ADD CONSTRAINT controlled_substance_log_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: controlled_substance_log controlled_substance_log_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_log
    ADD CONSTRAINT controlled_substance_log_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: controlled_substance_log controlled_substance_log_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_log
    ADD CONSTRAINT controlled_substance_log_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: controlled_substance_log controlled_substance_log_witnessed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_log
    ADD CONSTRAINT controlled_substance_log_witnessed_by_users_id_fk FOREIGN KEY (witnessed_by) REFERENCES public.users(id);


--
-- Name: dental_charts dental_charts_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_charts
    ADD CONSTRAINT dental_charts_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: dental_charts dental_charts_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_charts
    ADD CONSTRAINT dental_charts_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: dental_charts dental_charts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_charts
    ADD CONSTRAINT dental_charts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: dental_charts dental_charts_veterinarian_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_charts
    ADD CONSTRAINT dental_charts_veterinarian_id_users_id_fk FOREIGN KEY (veterinarian_id) REFERENCES public.users(id);


--
-- Name: discharge_reports discharge_reports_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_reports
    ADD CONSTRAINT discharge_reports_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: discharge_reports discharge_reports_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_reports
    ADD CONSTRAINT discharge_reports_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: discharge_reports discharge_reports_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_reports
    ADD CONSTRAINT discharge_reports_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: discharge_reports discharge_reports_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_reports
    ADD CONSTRAINT discharge_reports_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_invoice_item_id_invoice_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_invoice_item_id_invoice_items_id_fk FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_invoice_item_target_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_invoice_item_target_fk FOREIGN KEY (invoice_id, invoice_item_id) REFERENCES public.invoice_items(invoice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_event_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_event_fk FOREIGN KEY (practice_id, prescription_event_id) REFERENCES public.prescription_events(practice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_prescription_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_prescription_fk FOREIGN KEY (practice_id, prescription_id) REFERENCES public.prescriptions(practice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_practice_product_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_practice_product_fk FOREIGN KEY (practice_id, product_id) REFERENCES public.products(practice_id, id);


--
-- Name: dispense_charge_queue dispense_charge_queue_prescription_event_id_prescription_events; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_prescription_event_id_prescription_events FOREIGN KEY (prescription_event_id) REFERENCES public.prescription_events(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_prescription_id_prescriptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_prescription_id_prescriptions_id_fk FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: dispense_charge_queue dispense_charge_queue_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispense_charge_queue
    ADD CONSTRAINT dispense_charge_queue_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: ekasa_config ekasa_config_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_config
    ADD CONSTRAINT ekasa_config_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ekasa_daily_closures ekasa_daily_closures_closed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_daily_closures
    ADD CONSTRAINT ekasa_daily_closures_closed_by_users_id_fk FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: ekasa_daily_closures ekasa_daily_closures_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_daily_closures
    ADD CONSTRAINT ekasa_daily_closures_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ekasa_receipts ekasa_receipts_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_receipts
    ADD CONSTRAINT ekasa_receipts_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: ekasa_receipts ekasa_receipts_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_receipts
    ADD CONSTRAINT ekasa_receipts_payment_id_payments_id_fk FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: ekasa_receipts ekasa_receipts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ekasa_receipts
    ADD CONSTRAINT ekasa_receipts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: email_suppressions email_suppressions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT email_suppressions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_ai_audit_log ext_ai_audit_log_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_ai_audit_log
    ADD CONSTRAINT ext_ai_audit_log_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: ext_ai_audit_log ext_ai_audit_log_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_ai_audit_log
    ADD CONSTRAINT ext_ai_audit_log_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_ai_settings ext_ai_settings_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_ai_settings
    ADD CONSTRAINT ext_ai_settings_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_enrollments ext_auto_enrollments_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_auto_enrollments_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: ext_automation_enrollments ext_auto_enrollments_journey_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_auto_enrollments_journey_fk FOREIGN KEY (journey_id) REFERENCES public.ext_automation_journeys(id);


--
-- Name: ext_automation_enrollments ext_auto_enrollments_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_auto_enrollments_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: ext_automation_events ext_auto_events_appointment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_auto_events_appointment_tenant_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: ext_automation_events ext_auto_events_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_auto_events_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: ext_automation_events ext_auto_events_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_auto_events_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: ext_automation_journeys ext_auto_journeys_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_journeys
    ADD CONSTRAINT ext_auto_journeys_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_automation_rules ext_auto_rules_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_rules
    ADD CONSTRAINT ext_auto_rules_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_automation_step_executions ext_auto_steps_communication_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_auto_steps_communication_tenant_fk FOREIGN KEY (practice_id, communication_id) REFERENCES public.communications(practice_id, id);


--
-- Name: ext_automation_suppression_log ext_auto_suppression_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_auto_suppression_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: ext_automation_suppression_log ext_auto_suppression_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_auto_suppression_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: ext_automation_enrollments ext_automation_enrollments_journey_id_ext_automation_journeys_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_automation_enrollments_journey_id_ext_automation_journeys_i FOREIGN KEY (journey_id) REFERENCES public.ext_automation_journeys(id);


--
-- Name: ext_automation_enrollments ext_automation_enrollments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_automation_enrollments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_enrollments ext_automation_enrollments_trigger_event_id_ext_automation_even; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_enrollments
    ADD CONSTRAINT ext_automation_enrollments_trigger_event_id_ext_automation_even FOREIGN KEY (trigger_event_id) REFERENCES public.ext_automation_events(id);


--
-- Name: ext_automation_events ext_automation_events_emitted_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_automation_events_emitted_by_users_id_fk FOREIGN KEY (emitted_by) REFERENCES public.users(id);


--
-- Name: ext_automation_events ext_automation_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_automation_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_events ext_automation_events_visit_closeout_id_visit_closeouts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_events
    ADD CONSTRAINT ext_automation_events_visit_closeout_id_visit_closeouts_id_fk FOREIGN KEY (visit_closeout_id) REFERENCES public.visit_closeouts(id);


--
-- Name: ext_automation_journeys ext_automation_journeys_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_journeys
    ADD CONSTRAINT ext_automation_journeys_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_automation_journeys ext_automation_journeys_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_journeys
    ADD CONSTRAINT ext_automation_journeys_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_rules ext_automation_rules_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_rules
    ADD CONSTRAINT ext_automation_rules_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_automation_rules ext_automation_rules_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_rules
    ADD CONSTRAINT ext_automation_rules_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_care_reminder_id_care_reminders_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_care_reminder_id_care_reminders_ FOREIGN KEY (care_reminder_id) REFERENCES public.care_reminders(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_content_item_id_ext_marketing_co; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_content_item_id_ext_marketing_co FOREIGN KEY (content_item_id) REFERENCES public.ext_marketing_content_items(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_enrollment_id_ext_automation_enr; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_enrollment_id_ext_automation_enr FOREIGN KEY (enrollment_id) REFERENCES public.ext_automation_enrollments(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_message_log_id_ext_marketing_mes; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_message_log_id_ext_marketing_mes FOREIGN KEY (message_log_id) REFERENCES public.ext_marketing_message_logs(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_step_executions ext_automation_step_executions_staff_task_id_ext_marketing_staf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_step_executions
    ADD CONSTRAINT ext_automation_step_executions_staff_task_id_ext_marketing_staf FOREIGN KEY (staff_task_id) REFERENCES public.ext_marketing_staff_tasks(id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_enrollment_id_ext_automation_enr; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_enrollment_id_ext_automation_enr FOREIGN KEY (enrollment_id) REFERENCES public.ext_automation_enrollments(id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_event_id_ext_automation_events_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_event_id_ext_automation_events_i FOREIGN KEY (event_id) REFERENCES public.ext_automation_events(id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_journey_id_ext_automation_journe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_journey_id_ext_automation_journe FOREIGN KEY (journey_id) REFERENCES public.ext_automation_journeys(id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_automation_suppression_log ext_automation_suppression_log_rule_id_ext_automation_rules_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_automation_suppression_log
    ADD CONSTRAINT ext_automation_suppression_log_rule_id_ext_automation_rules_id_ FOREIGN KEY (rule_id) REFERENCES public.ext_automation_rules(id);


--
-- Name: ext_carcass_disposals ext_carcass_disposals_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_carcass_disposals
    ADD CONSTRAINT ext_carcass_disposals_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_carcass_disposals ext_carcass_disposals_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_carcass_disposals
    ADD CONSTRAINT ext_carcass_disposals_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_carcass_disposals ext_carcass_disposals_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_carcass_disposals
    ADD CONSTRAINT ext_carcass_disposals_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_channel_accounts ext_channel_accounts_connected_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_channel_accounts
    ADD CONSTRAINT ext_channel_accounts_connected_by_users_id_fk FOREIGN KEY (connected_by) REFERENCES public.users(id);


--
-- Name: ext_channel_accounts ext_channel_accounts_connector_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_channel_accounts
    ADD CONSTRAINT ext_channel_accounts_connector_tenant_fk FOREIGN KEY (practice_id, connected_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_channel_accounts ext_channel_accounts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_channel_accounts
    ADD CONSTRAINT ext_channel_accounts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_clinical_guardian_alerts ext_clinical_guardian_alerts_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinical_guardian_alerts
    ADD CONSTRAINT ext_clinical_guardian_alerts_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_clinical_guardian_alerts ext_clinical_guardian_alerts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinical_guardian_alerts
    ADD CONSTRAINT ext_clinical_guardian_alerts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_clinical_guardian_alerts ext_clinical_guardian_alerts_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinical_guardian_alerts
    ADD CONSTRAINT ext_clinical_guardian_alerts_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: ext_clinician_confirmations ext_clinician_confirmations_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinician_confirmations
    ADD CONSTRAINT ext_clinician_confirmations_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: ext_clinician_confirmations ext_clinician_confirmations_consumed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinician_confirmations
    ADD CONSTRAINT ext_clinician_confirmations_consumed_by_users_id_fk FOREIGN KEY (consumed_by) REFERENCES public.users(id);


--
-- Name: ext_clinician_confirmations ext_clinician_confirmations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_clinician_confirmations
    ADD CONSTRAINT ext_clinician_confirmations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_content_briefs ext_content_briefs_content_item_id_ext_marketing_content_items_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_content_item_id_ext_marketing_content_items_ FOREIGN KEY (content_item_id) REFERENCES public.ext_marketing_content_items(id);


--
-- Name: ext_content_briefs ext_content_briefs_pillar_id_ext_content_pillars_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_pillar_id_ext_content_pillars_id_fk FOREIGN KEY (pillar_id) REFERENCES public.ext_content_pillars(id);


--
-- Name: ext_content_briefs ext_content_briefs_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_content_briefs ext_content_briefs_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: ext_content_briefs ext_content_briefs_reviewer_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_reviewer_tenant_fk FOREIGN KEY (practice_id, reviewed_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_content_briefs ext_content_briefs_trigger_event_id_ext_automation_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_briefs
    ADD CONSTRAINT ext_content_briefs_trigger_event_id_ext_automation_events_id_fk FOREIGN KEY (trigger_event_id) REFERENCES public.ext_automation_events(id);


--
-- Name: ext_content_pillars ext_content_pillars_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_content_pillars
    ADD CONSTRAINT ext_content_pillars_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_crm_segment_memberships ext_crm_memberships_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_memberships_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: ext_crm_segment_memberships ext_crm_memberships_excluder_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_memberships_excluder_tenant_fk FOREIGN KEY (practice_id, excluded_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_crm_segment_memberships ext_crm_segment_memberships_excluded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_segment_memberships_excluded_by_users_id_fk FOREIGN KEY (excluded_by) REFERENCES public.users(id);


--
-- Name: ext_crm_segment_memberships ext_crm_segment_memberships_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_segment_memberships_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_crm_segment_memberships ext_crm_segment_memberships_segment_id_ext_crm_segments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_segment_memberships_segment_id_ext_crm_segments_id_fk FOREIGN KEY (segment_id) REFERENCES public.ext_crm_segments(id);


--
-- Name: ext_crm_segment_memberships ext_crm_segment_memberships_trigger_event_id_ext_automation_eve; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segment_memberships
    ADD CONSTRAINT ext_crm_segment_memberships_trigger_event_id_ext_automation_eve FOREIGN KEY (trigger_event_id) REFERENCES public.ext_automation_events(id);


--
-- Name: ext_crm_segments ext_crm_segments_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segments
    ADD CONSTRAINT ext_crm_segments_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_crm_segments ext_crm_segments_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segments
    ADD CONSTRAINT ext_crm_segments_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: ext_crm_segments ext_crm_segments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_crm_segments
    ADD CONSTRAINT ext_crm_segments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_kvepis_credentials ext_kvepis_credentials_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_credentials
    ADD CONSTRAINT ext_kvepis_credentials_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_kvepis_submissions ext_kvepis_submissions_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_submissions
    ADD CONSTRAINT ext_kvepis_submissions_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_kvepis_submissions ext_kvepis_submissions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_submissions
    ADD CONSTRAINT ext_kvepis_submissions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_kvepis_submissions ext_kvepis_submissions_signed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_kvepis_submissions
    ADD CONSTRAINT ext_kvepis_submissions_signed_by_users_id_fk FOREIGN KEY (signed_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_automation_rules ext_marketing_automation_rules_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_automation_rules
    ADD CONSTRAINT ext_marketing_automation_rules_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_competitor_snapshots ext_marketing_competitor_snapshots_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_competitor_snapshots
    ADD CONSTRAINT ext_marketing_competitor_snapshots_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_content_batches ext_marketing_content_batches_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_batches
    ADD CONSTRAINT ext_marketing_content_batches_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_batch_id_ext_marketing_content_batc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_batch_id_ext_marketing_content_batc FOREIGN KEY (batch_id) REFERENCES public.ext_marketing_content_batches(id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_media_asset_id_ext_marketing_media_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_media_asset_id_ext_marketing_media_ FOREIGN KEY (media_asset_id) REFERENCES public.ext_marketing_media_assets(id);


--
-- Name: ext_marketing_content_items ext_marketing_content_items_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_content_items
    ADD CONSTRAINT ext_marketing_content_items_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_handouts ext_marketing_handouts_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_handouts
    ADD CONSTRAINT ext_marketing_handouts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_handouts ext_marketing_handouts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_handouts
    ADD CONSTRAINT ext_marketing_handouts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_media_assets ext_marketing_media_assets_consent_id_ext_marketing_media_conse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_assets
    ADD CONSTRAINT ext_marketing_media_assets_consent_id_ext_marketing_media_conse FOREIGN KEY (consent_id) REFERENCES public.ext_marketing_media_consents(id);


--
-- Name: ext_marketing_media_assets ext_marketing_media_assets_file_id_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_assets
    ADD CONSTRAINT ext_marketing_media_assets_file_id_files_id_fk FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: ext_marketing_media_assets ext_marketing_media_assets_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_assets
    ADD CONSTRAINT ext_marketing_media_assets_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_media_assets ext_marketing_media_assets_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_assets
    ADD CONSTRAINT ext_marketing_media_assets_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_media_consents ext_marketing_media_consents_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_consents
    ADD CONSTRAINT ext_marketing_media_consents_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_marketing_media_consents ext_marketing_media_consents_consent_request_id_consent_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_consents
    ADD CONSTRAINT ext_marketing_media_consents_consent_request_id_consent_request FOREIGN KEY (consent_request_id) REFERENCES public.consent_requests(id);


--
-- Name: ext_marketing_media_consents ext_marketing_media_consents_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_consents
    ADD CONSTRAINT ext_marketing_media_consents_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_marketing_media_consents ext_marketing_media_consents_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_media_consents
    ADD CONSTRAINT ext_marketing_media_consents_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_message_logs ext_marketing_message_logs_template_id_ext_marketing_message_te; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_logs
    ADD CONSTRAINT ext_marketing_message_logs_template_id_ext_marketing_message_te FOREIGN KEY (template_id) REFERENCES public.ext_marketing_message_templates(id);


--
-- Name: ext_marketing_message_templates ext_marketing_message_templates_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_message_templates
    ADD CONSTRAINT ext_marketing_message_templates_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_operative_scripts ext_marketing_operative_scripts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_operative_scripts
    ADD CONSTRAINT ext_marketing_operative_scripts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_postop_responses ext_marketing_postop_responses_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_postop_responses
    ADD CONSTRAINT ext_marketing_postop_responses_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_marketing_postop_responses ext_marketing_postop_responses_message_log_id_ext_marketing_mes; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_postop_responses
    ADD CONSTRAINT ext_marketing_postop_responses_message_log_id_ext_marketing_mes FOREIGN KEY (message_log_id) REFERENCES public.ext_marketing_message_logs(id);


--
-- Name: ext_marketing_postop_responses ext_marketing_postop_responses_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_postop_responses
    ADD CONSTRAINT ext_marketing_postop_responses_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_marketing_postop_responses ext_marketing_postop_responses_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_postop_responses
    ADD CONSTRAINT ext_marketing_postop_responses_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_recall_schedules ext_marketing_recall_schedules_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_recall_schedules
    ADD CONSTRAINT ext_marketing_recall_schedules_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_escalated_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_escalated_to_users_id_fk FOREIGN KEY (escalated_to) REFERENCES public.users(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_replied_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_replied_by_users_id_fk FOREIGN KEY (replied_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_reviews ext_marketing_reviews_response_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_reviews
    ADD CONSTRAINT ext_marketing_reviews_response_approved_by_users_id_fk FOREIGN KEY (response_approved_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_staff_tasks ext_marketing_staff_tasks_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_staff_tasks
    ADD CONSTRAINT ext_marketing_staff_tasks_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_marketing_staff_tasks ext_marketing_staff_tasks_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_staff_tasks
    ADD CONSTRAINT ext_marketing_staff_tasks_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_tv_slides ext_marketing_tv_slides_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_tv_slides
    ADD CONSTRAINT ext_marketing_tv_slides_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ext_marketing_tv_slides ext_marketing_tv_slides_media_asset_id_ext_marketing_media_asse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_tv_slides
    ADD CONSTRAINT ext_marketing_tv_slides_media_asset_id_ext_marketing_media_asse FOREIGN KEY (media_asset_id) REFERENCES public.ext_marketing_media_assets(id);


--
-- Name: ext_marketing_tv_slides ext_marketing_tv_slides_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_tv_slides
    ADD CONSTRAINT ext_marketing_tv_slides_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_marketing_website_config ext_marketing_website_config_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_website_config
    ADD CONSTRAINT ext_marketing_website_config_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: ext_marketing_website_inquiries ext_marketing_website_inquiries_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_website_inquiries
    ADD CONSTRAINT ext_marketing_website_inquiries_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: ext_marketing_website_inquiries ext_marketing_website_inquiries_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_website_inquiries
    ADD CONSTRAINT ext_marketing_website_inquiries_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: ext_marketing_wellness_redemptions ext_marketing_wellness_redemptions_appointment_id_appointments_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_wellness_redemptions
    ADD CONSTRAINT ext_marketing_wellness_redemptions_appointment_id_appointments_ FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: ext_marketing_wellness_redemptions ext_marketing_wellness_redemptions_enrollment_id_wellness_enrol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_wellness_redemptions
    ADD CONSTRAINT ext_marketing_wellness_redemptions_enrollment_id_wellness_enrol FOREIGN KEY (enrollment_id) REFERENCES public.wellness_enrollments(id);


--
-- Name: ext_marketing_wellness_redemptions ext_marketing_wellness_redemptions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_marketing_wellness_redemptions
    ADD CONSTRAINT ext_marketing_wellness_redemptions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_pilot_feedback ext_pilot_feedback_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_pilot_feedback
    ADD CONSTRAINT ext_pilot_feedback_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_pilot_feedback ext_pilot_feedback_reported_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_pilot_feedback
    ADD CONSTRAINT ext_pilot_feedback_reported_by_id_users_id_fk FOREIGN KEY (reported_by_id) REFERENCES public.users(id);


--
-- Name: ext_rabies_notifications ext_rabies_notifications_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_notifications
    ADD CONSTRAINT ext_rabies_notifications_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_rabies_observations ext_rabies_observations_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_observations
    ADD CONSTRAINT ext_rabies_observations_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_rabies_observations ext_rabies_observations_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_observations
    ADD CONSTRAINT ext_rabies_observations_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_rabies_observations ext_rabies_observations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_rabies_observations
    ADD CONSTRAINT ext_rabies_observations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_sms_delivery_log ext_sms_delivery_log_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_sms_delivery_log
    ADD CONSTRAINT ext_sms_delivery_log_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: ext_sms_delivery_log ext_sms_delivery_log_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_sms_delivery_log
    ADD CONSTRAINT ext_sms_delivery_log_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ext_support_session_audit ext_support_session_audit_session_id_ext_support_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_support_session_audit
    ADD CONSTRAINT ext_support_session_audit_session_id_ext_support_sessions_id_fk FOREIGN KEY (session_id) REFERENCES public.ext_support_sessions(id);


--
-- Name: ext_withdrawal_periods ext_withdrawal_periods_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_withdrawal_periods
    ADD CONSTRAINT ext_withdrawal_periods_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ext_withdrawal_periods ext_withdrawal_periods_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ext_withdrawal_periods
    ADD CONSTRAINT ext_withdrawal_periods_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: external_lab_observations external_lab_observations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_observations
    ADD CONSTRAINT external_lab_observations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: external_lab_observations external_lab_observations_report_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_observations
    ADD CONSTRAINT external_lab_observations_report_tenant_fk FOREIGN KEY (practice_id, report_id) REFERENCES public.external_lab_reports(practice_id, id);


--
-- Name: external_lab_reports external_lab_reports_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_reports
    ADD CONSTRAINT external_lab_reports_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: external_lab_reports external_lab_reports_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_reports
    ADD CONSTRAINT external_lab_reports_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: external_lab_reports external_lab_reports_reviewer_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_lab_reports
    ADD CONSTRAINT external_lab_reports_reviewer_tenant_fk FOREIGN KEY (practice_id, reviewed_by) REFERENCES public.users(practice_id, id);


--
-- Name: external_prescription_fills external_prescription_fills_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescription_fills
    ADD CONSTRAINT external_prescription_fills_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: external_prescription_fills external_prescription_fills_prescription_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescription_fills
    ADD CONSTRAINT external_prescription_fills_prescription_tenant_fk FOREIGN KEY (practice_id, prescription_id) REFERENCES public.external_prescriptions(practice_id, id);


--
-- Name: external_prescriptions external_prescriptions_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescriptions
    ADD CONSTRAINT external_prescriptions_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: external_prescriptions external_prescriptions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescriptions
    ADD CONSTRAINT external_prescriptions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: external_prescriptions external_prescriptions_reviewer_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_prescriptions
    ADD CONSTRAINT external_prescriptions_reviewer_tenant_fk FOREIGN KEY (practice_id, reviewed_by) REFERENCES public.users(practice_id, id);


--
-- Name: file_object_replicas file_object_replicas_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_object_replicas
    ADD CONSTRAINT file_object_replicas_file_tenant_fk FOREIGN KEY (practice_id, file_id) REFERENCES public.files(practice_id, id);


--
-- Name: file_object_replicas file_object_replicas_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_object_replicas
    ADD CONSTRAINT file_object_replicas_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: file_storage_events file_storage_events_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_storage_events
    ADD CONSTRAINT file_storage_events_file_tenant_fk FOREIGN KEY (practice_id, file_id) REFERENCES public.files(practice_id, id);


--
-- Name: file_storage_events file_storage_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_storage_events
    ADD CONSTRAINT file_storage_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: files files_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: files files_appointment_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_appointment_patient_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: files files_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: files files_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: files files_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: files files_uploader_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploader_tenant_fk FOREIGN KEY (practice_id, uploaded_by) REFERENCES public.users(practice_id, id);


--
-- Name: financial_closes financial_closes_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_closes
    ADD CONSTRAINT financial_closes_actor_tenant_fk FOREIGN KEY (practice_id, closed_by) REFERENCES public.users(practice_id, id);


--
-- Name: financial_closes financial_closes_closed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_closes
    ADD CONSTRAINT financial_closes_closed_by_users_id_fk FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: financial_closes financial_closes_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_closes
    ADD CONSTRAINT financial_closes_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: funnel_events funnel_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_events
    ADD CONSTRAINT funnel_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: historical_appointments historical_appointments_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_appointments
    ADD CONSTRAINT historical_appointments_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: historical_appointments historical_appointments_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_appointments
    ADD CONSTRAINT historical_appointments_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: historical_appointments historical_appointments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_appointments
    ADD CONSTRAINT historical_appointments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: historical_documents historical_documents_appointment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_appointment_tenant_fk FOREIGN KEY (practice_id, historical_appointment_id) REFERENCES public.historical_appointments(practice_id, id);


--
-- Name: historical_documents historical_documents_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_file_tenant_fk FOREIGN KEY (practice_id, file_id) REFERENCES public.files(practice_id, id);


--
-- Name: historical_documents historical_documents_financial_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_financial_tenant_fk FOREIGN KEY (practice_id, financial_document_id) REFERENCES public.legacy_financial_documents(practice_id, id);


--
-- Name: historical_documents historical_documents_lab_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_lab_tenant_fk FOREIGN KEY (practice_id, lab_report_id) REFERENCES public.external_lab_reports(practice_id, id);


--
-- Name: historical_documents historical_documents_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: historical_documents historical_documents_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: historical_documents historical_documents_prescription_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_documents
    ADD CONSTRAINT historical_documents_prescription_tenant_fk FOREIGN KEY (practice_id, prescription_id) REFERENCES public.external_prescriptions(practice_id, id);


--
-- Name: insurance_claims insurance_claims_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: insurance_claims insurance_claims_policy_id_insurance_policies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_policy_id_insurance_policies_id_fk FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id);


--
-- Name: insurance_claims insurance_claims_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: insurance_policies insurance_policies_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: insurance_policies insurance_policies_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: insurance_policies insurance_policies_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: invoice_adjustments invoice_adjustments_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_adjustments
    ADD CONSTRAINT invoice_adjustments_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoice_adjustments invoice_adjustments_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_adjustments
    ADD CONSTRAINT invoice_adjustments_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoice_items invoice_items_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoice_items invoice_items_source_prescription_id_prescriptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_source_prescription_id_prescriptions_id_fk FOREIGN KEY (source_prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: invoices invoices_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: invoices invoices_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: invoices invoices_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: invoices invoices_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: kvl_cr_passports kvl_cr_passports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kvl_cr_passports
    ADD CONSTRAINT kvl_cr_passports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: kvl_cr_passports kvl_cr_passports_issued_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kvl_cr_passports
    ADD CONSTRAINT kvl_cr_passports_issued_by_users_id_fk FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: kvl_cr_passports kvl_cr_passports_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kvl_cr_passports
    ADD CONSTRAINT kvl_cr_passports_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: kvl_cr_passports kvl_cr_passports_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kvl_cr_passports
    ADD CONSTRAINT kvl_cr_passports_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: lab_analyzer_reports lab_analyzer_reports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_analyzer_reports
    ADD CONSTRAINT lab_analyzer_reports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: lab_analyzer_reports lab_analyzer_reports_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_analyzer_reports
    ADD CONSTRAINT lab_analyzer_reports_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_analyzer_reports lab_analyzer_reports_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_analyzer_reports
    ADD CONSTRAINT lab_analyzer_reports_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: lab_analyzer_reports lab_analyzer_reports_reviewed_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_analyzer_reports
    ADD CONSTRAINT lab_analyzer_reports_reviewed_by_id_users_id_fk FOREIGN KEY (reviewed_by_id) REFERENCES public.users(id);


--
-- Name: lab_result_events lab_result_events_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: lab_result_events lab_result_events_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_actor_tenant_fk FOREIGN KEY (practice_id, actor_id) REFERENCES public.users(practice_id, id);


--
-- Name: lab_result_events lab_result_events_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: lab_result_events lab_result_events_appointment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_appointment_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: lab_result_events lab_result_events_assignee_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_assignee_tenant_fk FOREIGN KEY (practice_id, follow_up_assigned_to) REFERENCES public.users(practice_id, id);


--
-- Name: lab_result_events lab_result_events_follow_up_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_follow_up_assigned_to_users_id_fk FOREIGN KEY (follow_up_assigned_to) REFERENCES public.users(id);


--
-- Name: lab_result_events lab_result_events_lab_result_id_lab_results_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_lab_result_id_lab_results_id_fk FOREIGN KEY (lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: lab_result_events lab_result_events_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_result_events lab_result_events_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: lab_result_events lab_result_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: lab_result_events lab_result_events_result_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_events
    ADD CONSTRAINT lab_result_events_result_tenant_fk FOREIGN KEY (practice_id, lab_result_id) REFERENCES public.lab_results(practice_id, id);


--
-- Name: lab_result_replacements lab_result_replacements_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: lab_result_replacements lab_result_replacements_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_actor_tenant_fk FOREIGN KEY (practice_id, actor_id) REFERENCES public.users(practice_id, id);


--
-- Name: lab_result_replacements lab_result_replacements_correction_id_clinical_record_correctio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_correction_id_clinical_record_correctio FOREIGN KEY (correction_id) REFERENCES public.clinical_record_corrections(id);


--
-- Name: lab_result_replacements lab_result_replacements_correction_source_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_correction_source_tenant_fk FOREIGN KEY (practice_id, correction_id, source_lab_result_id) REFERENCES public.clinical_record_corrections(practice_id, id, lab_result_id);


--
-- Name: lab_result_replacements lab_result_replacements_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: lab_result_replacements lab_result_replacements_replacement_lab_result_id_lab_results_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_replacement_lab_result_id_lab_results_i FOREIGN KEY (replacement_lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: lab_result_replacements lab_result_replacements_replacement_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_replacement_tenant_fk FOREIGN KEY (practice_id, replacement_lab_result_id) REFERENCES public.lab_results(practice_id, id);


--
-- Name: lab_result_replacements lab_result_replacements_source_lab_result_id_lab_results_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_source_lab_result_id_lab_results_id_fk FOREIGN KEY (source_lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: lab_result_replacements lab_result_replacements_source_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_replacements
    ADD CONSTRAINT lab_result_replacements_source_tenant_fk FOREIGN KEY (practice_id, source_lab_result_id) REFERENCES public.lab_results(practice_id, id);


--
-- Name: lab_results lab_results_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: lab_results lab_results_follow_up_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_follow_up_assigned_to_users_id_fk FOREIGN KEY (follow_up_assigned_to) REFERENCES public.users(id);


--
-- Name: lab_results lab_results_follow_up_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_follow_up_completed_by_users_id_fk FOREIGN KEY (follow_up_completed_by) REFERENCES public.users(id);


--
-- Name: lab_results lab_results_ordered_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_ordered_by_users_id_fk FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: lab_results lab_results_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_results lab_results_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: lab_results lab_results_practice_follow_up_assigned_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_follow_up_assigned_fk FOREIGN KEY (practice_id, follow_up_assigned_to) REFERENCES public.users(practice_id, id);


--
-- Name: lab_results lab_results_practice_follow_up_completed_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_follow_up_completed_fk FOREIGN KEY (practice_id, follow_up_completed_by) REFERENCES public.users(practice_id, id);


--
-- Name: lab_results lab_results_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: lab_results lab_results_practice_ordered_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_ordered_by_fk FOREIGN KEY (practice_id, ordered_by) REFERENCES public.users(practice_id, id);


--
-- Name: lab_results lab_results_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: lab_results lab_results_practice_reviewed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practice_reviewed_by_fk FOREIGN KEY (practice_id, reviewed_by) REFERENCES public.users(practice_id, id);


--
-- Name: lab_results lab_results_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: legacy_financial_allocations legacy_financial_allocations_document_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_allocations
    ADD CONSTRAINT legacy_financial_allocations_document_tenant_fk FOREIGN KEY (practice_id, document_id) REFERENCES public.legacy_financial_documents(practice_id, id);


--
-- Name: legacy_financial_allocations legacy_financial_allocations_payment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_allocations
    ADD CONSTRAINT legacy_financial_allocations_payment_tenant_fk FOREIGN KEY (practice_id, payment_id) REFERENCES public.legacy_financial_payments(practice_id, id);


--
-- Name: legacy_financial_allocations legacy_financial_allocations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_allocations
    ADD CONSTRAINT legacy_financial_allocations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: legacy_financial_documents legacy_financial_documents_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_documents
    ADD CONSTRAINT legacy_financial_documents_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: legacy_financial_documents legacy_financial_documents_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_documents
    ADD CONSTRAINT legacy_financial_documents_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: legacy_financial_documents legacy_financial_documents_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_documents
    ADD CONSTRAINT legacy_financial_documents_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: legacy_financial_line_items legacy_financial_line_items_document_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_line_items
    ADD CONSTRAINT legacy_financial_line_items_document_tenant_fk FOREIGN KEY (practice_id, document_id) REFERENCES public.legacy_financial_documents(practice_id, id);


--
-- Name: legacy_financial_line_items legacy_financial_line_items_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_line_items
    ADD CONSTRAINT legacy_financial_line_items_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: legacy_financial_line_items legacy_financial_line_items_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_line_items
    ADD CONSTRAINT legacy_financial_line_items_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: legacy_financial_payments legacy_financial_payments_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_payments
    ADD CONSTRAINT legacy_financial_payments_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: legacy_financial_payments legacy_financial_payments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_financial_payments
    ADD CONSTRAINT legacy_financial_payments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: location_messaging location_messaging_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_messaging
    ADD CONSTRAINT location_messaging_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: location_messaging location_messaging_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_messaging
    ADD CONSTRAINT location_messaging_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: locations locations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: messaging_registration_events messaging_registration_events_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_actor_tenant_fk FOREIGN KEY (practice_id, actor_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: messaging_registration_events messaging_registration_events_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: messaging_registration_events messaging_registration_events_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: messaging_registration_events messaging_registration_events_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: messaging_registration_events messaging_registration_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: messaging_registration_events messaging_registration_events_registration_id_messaging_registr; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_registration_id_messaging_registr FOREIGN KEY (registration_id) REFERENCES public.messaging_registrations(id);


--
-- Name: messaging_registration_events messaging_registration_events_registration_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registration_events
    ADD CONSTRAINT messaging_registration_events_registration_tenant_fk FOREIGN KEY (practice_id, registration_id) REFERENCES public.messaging_registrations(practice_id, id);


--
-- Name: messaging_registrations messaging_registrations_compliance_attested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registrations
    ADD CONSTRAINT messaging_registrations_compliance_attested_by_users_id_fk FOREIGN KEY (compliance_attested_by) REFERENCES public.users(id);


--
-- Name: messaging_registrations messaging_registrations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_registrations
    ADD CONSTRAINT messaging_registrations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: microchip_registrations microchip_registrations_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microchip_registrations
    ADD CONSTRAINT microchip_registrations_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: microchip_registrations microchip_registrations_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microchip_registrations
    ADD CONSTRAINT microchip_registrations_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: microchip_registrations microchip_registrations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microchip_registrations
    ADD CONSTRAINT microchip_registrations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: microchip_registrations microchip_registrations_veterinarian_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microchip_registrations
    ADD CONSTRAINT microchip_registrations_veterinarian_id_users_id_fk FOREIGN KEY (veterinarian_id) REFERENCES public.users(id);


--
-- Name: migration_runs migration_runs_committed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_committed_by_users_id_fk FOREIGN KEY (committed_by) REFERENCES public.users(id);


--
-- Name: migration_runs migration_runs_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: migration_runs migration_runs_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: patient_allergies patient_allergies_noted_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_noted_by_users_id_fk FOREIGN KEY (noted_by) REFERENCES public.users(id);


--
-- Name: patient_allergies patient_allergies_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_merge_events patient_merge_events_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_actor_tenant_fk FOREIGN KEY (practice_id, performed_by) REFERENCES public.users(practice_id, id);


--
-- Name: patient_merge_events patient_merge_events_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: patient_merge_events patient_merge_events_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: patient_merge_events patient_merge_events_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: patient_merge_events patient_merge_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: patient_merge_events patient_merge_events_source_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_source_patient_id_patients_id_fk FOREIGN KEY (source_patient_id) REFERENCES public.patients(id);


--
-- Name: patient_merge_events patient_merge_events_source_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_source_tenant_fk FOREIGN KEY (practice_id, source_patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: patient_merge_events patient_merge_events_target_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_target_patient_id_patients_id_fk FOREIGN KEY (target_patient_id) REFERENCES public.patients(id);


--
-- Name: patient_merge_events patient_merge_events_target_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_events
    ADD CONSTRAINT patient_merge_events_target_tenant_fk FOREIGN KEY (practice_id, target_patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: patient_weights patient_weights_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_weights
    ADD CONSTRAINT patient_weights_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_weights patient_weights_recorded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_weights
    ADD CONSTRAINT patient_weights_recorded_by_users_id_fk FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: patients patients_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: patients patients_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: payment_disputes payment_disputes_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: payment_disputes payment_disputes_settlement_id_payment_processor_settlements_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_settlement_id_payment_processor_settlements_id FOREIGN KEY (settlement_id) REFERENCES public.payment_processor_settlements(id);


--
-- Name: payment_disputes payment_disputes_settlement_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_settlement_tenant_fk FOREIGN KEY (practice_id, settlement_id) REFERENCES public.payment_processor_settlements(practice_id, id);


--
-- Name: payment_processor_payouts payment_processor_payouts_account_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_payouts
    ADD CONSTRAINT payment_processor_payouts_account_tenant_fk FOREIGN KEY (practice_id, provider, connected_account_id) REFERENCES public.practice_payment_accounts(practice_id, provider, stripe_account_id);


--
-- Name: payment_processor_payouts payment_processor_payouts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_payouts
    ADD CONSTRAINT payment_processor_payouts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: payment_processor_refunds payment_processor_refunds_account_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_account_tenant_fk FOREIGN KEY (practice_id, provider, connected_account_id) REFERENCES public.practice_payment_accounts(practice_id, provider, stripe_account_id);


--
-- Name: payment_processor_refunds payment_processor_refunds_original_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_original_payment_id_payments_id_fk FOREIGN KEY (original_payment_id) REFERENCES public.payments(id);


--
-- Name: payment_processor_refunds payment_processor_refunds_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: payment_processor_refunds payment_processor_refunds_refund_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_refund_payment_id_payments_id_fk FOREIGN KEY (refund_payment_id) REFERENCES public.payments(id);


--
-- Name: payment_processor_refunds payment_processor_refunds_settlement_id_payment_processor_settl; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_settlement_id_payment_processor_settl FOREIGN KEY (settlement_id) REFERENCES public.payment_processor_settlements(id);


--
-- Name: payment_processor_refunds payment_processor_refunds_settlement_payment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_refunds
    ADD CONSTRAINT payment_processor_refunds_settlement_payment_tenant_fk FOREIGN KEY (practice_id, settlement_id, original_payment_id) REFERENCES public.payment_processor_settlements(practice_id, id, payment_id);


--
-- Name: payment_processor_settlements payment_processor_settlements_account_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_account_tenant_fk FOREIGN KEY (practice_id, provider, connected_account_id) REFERENCES public.practice_payment_accounts(practice_id, provider, stripe_account_id);


--
-- Name: payment_processor_settlements payment_processor_settlements_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payment_processor_settlements payment_processor_settlements_invoice_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_invoice_tenant_fk FOREIGN KEY (practice_id, invoice_id) REFERENCES public.invoices(practice_id, id);


--
-- Name: payment_processor_settlements payment_processor_settlements_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_payment_id_payments_id_fk FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: payment_processor_settlements payment_processor_settlements_payment_invoice_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_payment_invoice_fk FOREIGN KEY (invoice_id, payment_id) REFERENCES public.payments(invoice_id, id);


--
-- Name: payment_processor_settlements payment_processor_settlements_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_processor_settlements
    ADD CONSTRAINT payment_processor_settlements_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: payments payments_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_received_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_users_id_fk FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: pet_passports pet_passports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: pet_passports pet_passports_issued_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_issued_by_users_id_fk FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: pet_passports pet_passports_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pet_passports pet_passports_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: pet_passports pet_passports_vaccination_record_id_vaccination_records_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_passports
    ADD CONSTRAINT pet_passports_vaccination_record_id_vaccination_records_id_fk FOREIGN KEY (vaccination_record_id) REFERENCES public.vaccination_records(id);


--
-- Name: portal_sessions portal_sessions_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: portal_sessions portal_sessions_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: portal_sessions portal_sessions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: practice_conversion_milestones practice_conversion_milestones_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_conversion_milestones
    ADD CONSTRAINT practice_conversion_milestones_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: practice_payment_accounts practice_payment_accounts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_payment_accounts
    ADD CONSTRAINT practice_payment_accounts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: prescription_events prescription_events_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: prescription_events prescription_events_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: prescription_events prescription_events_practice_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_practice_actor_fk FOREIGN KEY (practice_id, actor_id) REFERENCES public.users(practice_id, id);


--
-- Name: prescription_events prescription_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: prescription_events prescription_events_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: prescription_events prescription_events_practice_prescription_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_practice_prescription_fk FOREIGN KEY (practice_id, prescription_id) REFERENCES public.prescriptions(practice_id, id);


--
-- Name: prescription_events prescription_events_practice_product_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_practice_product_fk FOREIGN KEY (practice_id, product_id) REFERENCES public.products(practice_id, id);


--
-- Name: prescription_events prescription_events_prescription_id_prescriptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_prescription_id_prescriptions_id_fk FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: prescription_events prescription_events_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: prescriptions prescriptions_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: prescriptions prescriptions_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: prescriptions prescriptions_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: prescriptions prescriptions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: prescriptions prescriptions_prescribed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_prescribed_by_users_id_fk FOREIGN KEY (prescribed_by) REFERENCES public.users(id);


--
-- Name: prescriptions prescriptions_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: problem_list problem_list_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_list
    ADD CONSTRAINT problem_list_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: problem_list problem_list_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_list
    ADD CONSTRAINT problem_list_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: procedures procedures_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: procedures procedures_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: procedures procedures_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: procedures procedures_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: procedures procedures_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: products products_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: products products_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: purchase_orders purchase_orders_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: recent_clinical_items recent_clinical_items_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: recent_clinical_items recent_clinical_items_appointment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_appointment_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: recent_clinical_items recent_clinical_items_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: recent_clinical_items recent_clinical_items_patient_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_patient_tenant_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: recent_clinical_items recent_clinical_items_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: recent_clinical_items recent_clinical_items_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recent_clinical_items recent_clinical_items_user_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_clinical_items
    ADD CONSTRAINT recent_clinical_items_user_tenant_fk FOREIGN KEY (practice_id, user_id) REFERENCES public.users(practice_id, id);


--
-- Name: recurring_series recurring_series_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_series
    ADD CONSTRAINT recurring_series_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: rooms rooms_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: rooms rooms_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: rooms rooms_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: services services_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sms_consent_events sms_consent_events_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_actor_tenant_fk FOREIGN KEY (practice_id, actor_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: sms_consent_events sms_consent_events_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: sms_consent_events sms_consent_events_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: sms_consent_events sms_consent_events_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: sms_consent_events sms_consent_events_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: sms_consent_events sms_consent_events_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: sms_consent_events sms_consent_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_consent_events
    ADD CONSTRAINT sms_consent_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_actor_tenant_fk FOREIGN KEY (practice_id, actor_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_attempt_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_attempt_tenant_fk FOREIGN KEY (practice_id, attempt_id) REFERENCES public.sms_send_attempts(practice_id, id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_communication_id_communications_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_communication_id_communications_id_f FOREIGN KEY (communication_id) REFERENCES public.communications(id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_communication_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_communication_tenant_fk FOREIGN KEY (practice_id, communication_id) REFERENCES public.communications(practice_id, id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_delivery_event_id_sms_delivery_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_delivery_event_id_sms_delivery_event FOREIGN KEY (delivery_event_id) REFERENCES public.sms_delivery_events(id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_delivery_event_history sms_delivery_event_history_reviewed_history_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_delivery_event_history
    ADD CONSTRAINT sms_delivery_event_history_reviewed_history_fk FOREIGN KEY (delivery_event_id, reviewed_history_id) REFERENCES public.sms_delivery_event_history(delivery_event_id, id);


--
-- Name: sms_provider_event_conflict_reviews sms_provider_event_conflict_reviews_conflict_id_sms_provider_ev; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_conflict_reviews
    ADD CONSTRAINT sms_provider_event_conflict_reviews_conflict_id_sms_provider_ev FOREIGN KEY (conflict_id) REFERENCES public.sms_provider_event_conflicts(id);


--
-- Name: sms_provider_event_conflicts sms_provider_event_conflicts_original_event_id_sms_provider_eve; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_conflicts
    ADD CONSTRAINT sms_provider_event_conflicts_original_event_id_sms_provider_eve FOREIGN KEY (original_event_id) REFERENCES public.sms_provider_events(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_conflict_id_sms_provider_event_c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_conflict_id_sms_provider_event_c FOREIGN KEY (conflict_id) REFERENCES public.sms_provider_event_conflicts(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_event_id_sms_provider_events_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_event_id_sms_provider_events_id_ FOREIGN KEY (event_id) REFERENCES public.sms_provider_events(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_inbound_communication_id_communi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_inbound_communication_id_communi FOREIGN KEY (inbound_communication_id) REFERENCES public.communications(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_messaging_registration_event_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_messaging_registration_event_id_ FOREIGN KEY (messaging_registration_event_id) REFERENCES public.messaging_registration_events(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_sms_consent_event_id_sms_consent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_sms_consent_event_id_sms_consent FOREIGN KEY (sms_consent_event_id) REFERENCES public.sms_consent_events(id);


--
-- Name: sms_provider_event_resolutions sms_provider_event_resolutions_sms_delivery_event_id_sms_delive; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_event_resolutions
    ADD CONSTRAINT sms_provider_event_resolutions_sms_delivery_event_id_sms_delive FOREIGN KEY (sms_delivery_event_id) REFERENCES public.sms_delivery_events(id);


--
-- Name: sms_provider_events sms_provider_events_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_events
    ADD CONSTRAINT sms_provider_events_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: sms_provider_events sms_provider_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_events
    ADD CONSTRAINT sms_provider_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_send_attempt_events sms_send_attempt_events_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempt_events
    ADD CONSTRAINT sms_send_attempt_events_actor_tenant_fk FOREIGN KEY (practice_id, actor_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: sms_send_attempt_events sms_send_attempt_events_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempt_events
    ADD CONSTRAINT sms_send_attempt_events_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: sms_send_attempt_events sms_send_attempt_events_attempt_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempt_events
    ADD CONSTRAINT sms_send_attempt_events_attempt_tenant_fk FOREIGN KEY (practice_id, attempt_id) REFERENCES public.sms_send_attempts(practice_id, id);


--
-- Name: sms_send_attempt_events sms_send_attempt_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempt_events
    ADD CONSTRAINT sms_send_attempt_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_send_attempts sms_send_attempts_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: sms_send_attempts sms_send_attempts_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_client_tenant_fk FOREIGN KEY (practice_id, client_id) REFERENCES public.clients(practice_id, id);


--
-- Name: sms_send_attempts sms_send_attempts_communication_id_communications_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_communication_id_communications_id_fk FOREIGN KEY (communication_id) REFERENCES public.communications(id);


--
-- Name: sms_send_attempts sms_send_attempts_communication_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_communication_tenant_fk FOREIGN KEY (practice_id, communication_id) REFERENCES public.communications(practice_id, id);


--
-- Name: sms_send_attempts sms_send_attempts_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: sms_send_attempts sms_send_attempts_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: sms_send_attempts sms_send_attempts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: sms_send_attempts sms_send_attempts_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: sms_send_attempts sms_send_attempts_requester_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_requester_tenant_fk FOREIGN KEY (practice_id, requested_by_user_id) REFERENCES public.users(practice_id, id);


--
-- Name: sms_send_attempts sms_send_attempts_resend_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_attempts
    ADD CONSTRAINT sms_send_attempts_resend_tenant_fk FOREIGN KEY (practice_id, resend_of_attempt_id) REFERENCES public.sms_send_attempts(practice_id, id);


--
-- Name: sms_suppressions sms_suppressions_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_suppressions
    ADD CONSTRAINT sms_suppressions_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: sms_suppressions sms_suppressions_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_suppressions
    ADD CONSTRAINT sms_suppressions_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: soap_note_addenda soap_note_addenda_practice_author_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_addenda
    ADD CONSTRAINT soap_note_addenda_practice_author_fk FOREIGN KEY (practice_id, author_id) REFERENCES public.users(practice_id, id);


--
-- Name: soap_note_addenda soap_note_addenda_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_addenda
    ADD CONSTRAINT soap_note_addenda_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: soap_note_addenda soap_note_addenda_practice_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_addenda
    ADD CONSTRAINT soap_note_addenda_practice_source_fk FOREIGN KEY (practice_id, soap_note_id) REFERENCES public.soap_notes(practice_id, id);


--
-- Name: soap_note_replacements soap_note_replacements_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: soap_note_replacements soap_note_replacements_actor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_actor_tenant_fk FOREIGN KEY (practice_id, actor_id) REFERENCES public.users(practice_id, id);


--
-- Name: soap_note_replacements soap_note_replacements_correction_id_clinical_record_correction; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_correction_id_clinical_record_correction FOREIGN KEY (correction_id) REFERENCES public.clinical_record_corrections(id);


--
-- Name: soap_note_replacements soap_note_replacements_correction_source_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_correction_source_tenant_fk FOREIGN KEY (practice_id, correction_id, source_soap_note_id) REFERENCES public.clinical_record_corrections(practice_id, id, soap_note_id);


--
-- Name: soap_note_replacements soap_note_replacements_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: soap_note_replacements soap_note_replacements_replacement_soap_note_id_soap_notes_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_replacement_soap_note_id_soap_notes_id_f FOREIGN KEY (replacement_soap_note_id) REFERENCES public.soap_notes(id);


--
-- Name: soap_note_replacements soap_note_replacements_replacement_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_replacement_tenant_fk FOREIGN KEY (practice_id, replacement_soap_note_id) REFERENCES public.soap_notes(practice_id, id);


--
-- Name: soap_note_replacements soap_note_replacements_source_soap_note_id_soap_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_source_soap_note_id_soap_notes_id_fk FOREIGN KEY (source_soap_note_id) REFERENCES public.soap_notes(id);


--
-- Name: soap_note_replacements soap_note_replacements_source_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_note_replacements
    ADD CONSTRAINT soap_note_replacements_source_tenant_fk FOREIGN KEY (practice_id, source_soap_note_id) REFERENCES public.soap_notes(practice_id, id);


--
-- Name: soap_notes soap_notes_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: soap_notes soap_notes_author_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: soap_notes soap_notes_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: soap_notes soap_notes_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: soap_notes soap_notes_practice_author_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_practice_author_fk FOREIGN KEY (practice_id, author_id) REFERENCES public.users(practice_id, id);


--
-- Name: soap_notes soap_notes_practice_finalizer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_practice_finalizer_fk FOREIGN KEY (practice_id, finalized_by) REFERENCES public.users(practice_id, id);


--
-- Name: soap_notes soap_notes_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: soap_notes soap_notes_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: staff_schedules staff_schedules_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: staff_schedules staff_schedules_location_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_location_tenant_fk FOREIGN KEY (practice_id, location_id) REFERENCES public.locations(practice_id, id);


--
-- Name: staff_schedules staff_schedules_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: staff_schedules staff_schedules_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: staff_schedules staff_schedules_user_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_user_tenant_fk FOREIGN KEY (practice_id, user_id) REFERENCES public.users(practice_id, id);


--
-- Name: stripe_events stripe_events_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: suppliers suppliers_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: treatment_plan_items treatment_plan_items_plan_id_treatment_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plan_items
    ADD CONSTRAINT treatment_plan_items_plan_id_treatment_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.treatment_plans(id);


--
-- Name: treatment_plans treatment_plans_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: treatment_plans treatment_plans_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: treatment_plans treatment_plans_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: treatment_plans treatment_plans_problem_id_problem_list_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_problem_id_problem_list_id_fk FOREIGN KEY (problem_id) REFERENCES public.problem_list(id);


--
-- Name: treatment_template_items treatment_template_items_template_id_treatment_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_template_items
    ADD CONSTRAINT treatment_template_items_template_id_treatment_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.treatment_templates(id);


--
-- Name: treatment_templates treatment_templates_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_templates
    ADD CONSTRAINT treatment_templates_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: usage_records usage_records_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: users users_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: users users_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: vaccination_records vaccination_records_administered_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_administered_by_users_id_fk FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: vaccination_records vaccination_records_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: vaccination_records vaccination_records_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: vaccination_records vaccination_records_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: vaccination_records vaccination_records_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: vaccination_records vaccination_records_supervising_veterinarian_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_supervising_veterinarian_id_users_id_fk FOREIGN KEY (supervising_veterinarian_id) REFERENCES public.users(id);


--
-- Name: vaccination_records vaccination_records_supervisor_practice_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccination_records
    ADD CONSTRAINT vaccination_records_supervisor_practice_fk FOREIGN KEY (practice_id, supervising_veterinarian_id) REFERENCES public.users(practice_id, id);


--
-- Name: visit_closeouts visit_closeouts_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: visit_closeouts visit_closeouts_clinical_finalized_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_clinical_finalized_by_users_id_fk FOREIGN KEY (clinical_finalized_by) REFERENCES public.users(id);


--
-- Name: visit_closeouts visit_closeouts_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: visit_closeouts visit_closeouts_follow_up_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_follow_up_appointment_id_appointments_id_fk FOREIGN KEY (follow_up_appointment_id) REFERENCES public.appointments(id);


--
-- Name: visit_closeouts visit_closeouts_follow_up_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_follow_up_assigned_to_users_id_fk FOREIGN KEY (follow_up_assigned_to) REFERENCES public.users(id);


--
-- Name: visit_closeouts visit_closeouts_follow_up_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_follow_up_resolved_by_users_id_fk FOREIGN KEY (follow_up_resolved_by) REFERENCES public.users(id);


--
-- Name: visit_closeouts visit_closeouts_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: visit_closeouts visit_closeouts_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: visit_closeouts visit_closeouts_resolution_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_closeouts
    ADD CONSTRAINT visit_closeouts_resolution_appointment_fk FOREIGN KEY (follow_up_resolution_appointment_id) REFERENCES public.appointments(id);


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentations_consent_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_presentations
    ADD CONSTRAINT visit_treatment_plan_presentations_consent_tenant_fk FOREIGN KEY (practice_id, consent_request_id) REFERENCES public.consent_requests(practice_id, id);


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentations_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_presentations
    ADD CONSTRAINT visit_treatment_plan_presentations_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentations_plan_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_presentations
    ADD CONSTRAINT visit_treatment_plan_presentations_plan_tenant_fk FOREIGN KEY (practice_id, plan_id) REFERENCES public.visit_treatment_plans(practice_id, id);


--
-- Name: visit_treatment_plan_presentations visit_treatment_plan_presentations_revision_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_presentations
    ADD CONSTRAINT visit_treatment_plan_presentations_revision_tenant_fk FOREIGN KEY (practice_id, revision_id, plan_id) REFERENCES public.visit_treatment_plan_revisions(practice_id, id, plan_id);


--
-- Name: visit_treatment_plan_response_lines visit_treatment_plan_response_lines_response_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_response_lines
    ADD CONSTRAINT visit_treatment_plan_response_lines_response_tenant_fk FOREIGN KEY (practice_id, response_id, revision_id) REFERENCES public.visit_treatment_plan_responses(practice_id, id, revision_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: visit_treatment_plan_response_lines visit_treatment_plan_response_lines_revision_line_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_response_lines
    ADD CONSTRAINT visit_treatment_plan_response_lines_revision_line_tenant_fk FOREIGN KEY (practice_id, revision_line_id, revision_id) REFERENCES public.visit_treatment_plan_revision_lines(practice_id, id, revision_id);


--
-- Name: visit_treatment_plan_responses visit_treatment_plan_responses_revision_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_responses
    ADD CONSTRAINT visit_treatment_plan_responses_revision_tenant_fk FOREIGN KEY (practice_id, revision_id, plan_id) REFERENCES public.visit_treatment_plan_revisions(practice_id, id, plan_id);


--
-- Name: visit_treatment_plan_responses visit_treatment_plan_responses_signed_file_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_responses
    ADD CONSTRAINT visit_treatment_plan_responses_signed_file_tenant_fk FOREIGN KEY (practice_id, signed_file_id) REFERENCES public.files(practice_id, id);


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_lines_plan_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revision_lines
    ADD CONSTRAINT visit_treatment_plan_revision_lines_plan_tenant_fk FOREIGN KEY (practice_id, plan_id) REFERENCES public.visit_treatment_plans(practice_id, id);


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_lines_product_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revision_lines
    ADD CONSTRAINT visit_treatment_plan_revision_lines_product_tenant_fk FOREIGN KEY (practice_id, product_id) REFERENCES public.products(practice_id, id);


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_lines_revision_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revision_lines
    ADD CONSTRAINT visit_treatment_plan_revision_lines_revision_tenant_fk FOREIGN KEY (practice_id, revision_id, plan_id) REFERENCES public.visit_treatment_plan_revisions(practice_id, id, plan_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: visit_treatment_plan_revision_lines visit_treatment_plan_revision_lines_service_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revision_lines
    ADD CONSTRAINT visit_treatment_plan_revision_lines_service_tenant_fk FOREIGN KEY (practice_id, service_id) REFERENCES public.services(practice_id, id);


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revisions_author_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revisions
    ADD CONSTRAINT visit_treatment_plan_revisions_author_tenant_fk FOREIGN KEY (practice_id, authored_by) REFERENCES public.users(practice_id, id);


--
-- Name: visit_treatment_plan_revisions visit_treatment_plan_revisions_plan_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plan_revisions
    ADD CONSTRAINT visit_treatment_plan_revisions_plan_tenant_fk FOREIGN KEY (practice_id, plan_id) REFERENCES public.visit_treatment_plans(practice_id, id);


--
-- Name: visit_treatment_plans visit_treatment_plans_appointment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plans
    ADD CONSTRAINT visit_treatment_plans_appointment_tenant_fk FOREIGN KEY (practice_id, appointment_id, patient_id, client_id) REFERENCES public.appointments(practice_id, id, patient_id, client_id);


--
-- Name: visit_treatment_plans visit_treatment_plans_creator_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plans
    ADD CONSTRAINT visit_treatment_plans_creator_tenant_fk FOREIGN KEY (practice_id, created_by) REFERENCES public.users(practice_id, id);


--
-- Name: visit_treatment_plans visit_treatment_plans_patient_client_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plans
    ADD CONSTRAINT visit_treatment_plans_patient_client_tenant_fk FOREIGN KEY (practice_id, patient_id, client_id) REFERENCES public.patients(practice_id, id, client_id);


--
-- Name: visit_treatment_plans visit_treatment_plans_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_treatment_plans
    ADD CONSTRAINT visit_treatment_plans_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: visit_work_items visit_work_items_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: visit_work_items visit_work_items_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: visit_work_items visit_work_items_invoice_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_invoice_item_fk FOREIGN KEY (invoice_id, invoice_item_id) REFERENCES public.invoice_items(invoice_id, id);


--
-- Name: visit_work_items visit_work_items_invoice_item_id_invoice_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_invoice_item_id_invoice_items_id_fk FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id);


--
-- Name: visit_work_items visit_work_items_invoice_visit_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_invoice_visit_fk FOREIGN KEY (practice_id, appointment_id, invoice_id) REFERENCES public.invoices(practice_id, appointment_id, id);


--
-- Name: visit_work_items visit_work_items_lab_result_id_lab_results_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_lab_result_id_lab_results_id_fk FOREIGN KEY (lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: visit_work_items visit_work_items_lab_result_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_lab_result_source_fk FOREIGN KEY (practice_id, appointment_id, lab_result_id) REFERENCES public.lab_results(practice_id, appointment_id, id);


--
-- Name: visit_work_items visit_work_items_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id) REFERENCES public.appointments(practice_id, id);


--
-- Name: visit_work_items visit_work_items_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: visit_work_items visit_work_items_prescription_id_prescriptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_prescription_id_prescriptions_id_fk FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: visit_work_items visit_work_items_prescription_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_prescription_source_fk FOREIGN KEY (practice_id, appointment_id, prescription_id) REFERENCES public.prescriptions(practice_id, appointment_id, id);


--
-- Name: visit_work_items visit_work_items_procedure_id_procedures_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_procedure_id_procedures_id_fk FOREIGN KEY (procedure_id) REFERENCES public.procedures(id);


--
-- Name: visit_work_items visit_work_items_procedure_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_procedure_source_fk FOREIGN KEY (practice_id, appointment_id, procedure_id) REFERENCES public.procedures(practice_id, appointment_id, id);


--
-- Name: visit_work_items visit_work_items_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: visit_work_items visit_work_items_vaccination_record_id_vaccination_records_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_vaccination_record_id_vaccination_records_id_f FOREIGN KEY (vaccination_record_id) REFERENCES public.vaccination_records(id);


--
-- Name: visit_work_items visit_work_items_vaccination_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_work_items
    ADD CONSTRAINT visit_work_items_vaccination_source_fk FOREIGN KEY (practice_id, appointment_id, vaccination_record_id) REFERENCES public.vaccination_records(practice_id, appointment_id, id);


--
-- Name: vital_signs vital_signs_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: vital_signs vital_signs_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: vital_signs vital_signs_practice_appointment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_practice_appointment_fk FOREIGN KEY (practice_id, appointment_id, patient_id) REFERENCES public.appointments(practice_id, id, patient_id);


--
-- Name: vital_signs vital_signs_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: vital_signs vital_signs_practice_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_practice_patient_fk FOREIGN KEY (practice_id, patient_id) REFERENCES public.patients(practice_id, id);


--
-- Name: vital_signs vital_signs_recorded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_recorded_by_users_id_fk FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: voice_dictations voice_dictations_appointment_id_appointments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_dictations
    ADD CONSTRAINT voice_dictations_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: voice_dictations voice_dictations_dictated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_dictations
    ADD CONSTRAINT voice_dictations_dictated_by_users_id_fk FOREIGN KEY (dictated_by) REFERENCES public.users(id);


--
-- Name: voice_dictations voice_dictations_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_dictations
    ADD CONSTRAINT voice_dictations_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: voice_dictations voice_dictations_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_dictations
    ADD CONSTRAINT voice_dictations_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: webhooks webhooks_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: wellness_enrollments wellness_enrollments_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_enrollments
    ADD CONSTRAINT wellness_enrollments_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: wellness_enrollments wellness_enrollments_patient_id_patients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_enrollments
    ADD CONSTRAINT wellness_enrollments_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: wellness_enrollments wellness_enrollments_plan_id_wellness_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_enrollments
    ADD CONSTRAINT wellness_enrollments_plan_id_wellness_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.wellness_plans(id);


--
-- Name: wellness_enrollments wellness_enrollments_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_enrollments
    ADD CONSTRAINT wellness_enrollments_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: wellness_plans wellness_plans_practice_id_practices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wellness_plans
    ADD CONSTRAINT wellness_plans_practice_id_practices_id_fk FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: ai_imaging_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_imaging_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_email_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_email_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_email_delivery_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_email_delivery_events ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_email_provider_identity_conflicts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_email_provider_identity_conflicts ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_email_webhook_conflicts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auth_email_webhook_conflicts ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: capture_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: care_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.care_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: case_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: client_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_pilot_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_pilot_events ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_pilots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_pilots ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_record_corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_record_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_receipt_capabilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_receipt_capabilities ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: controlled_substance_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.controlled_substance_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_delivery_events delivery_evidence_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_evidence_insert ON public.sms_delivery_events FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_delivery_events delivery_evidence_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_evidence_select ON public.sms_delivery_events FOR SELECT USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.sms_delivery_event_history attributed
  WHERE ((attributed.delivery_event_id = sms_delivery_events.id) AND (attributed.result = 'attributed'::public.sms_delivery_history_result) AND (attributed.practice_id IS NOT NULL) AND (attributed.practice_id = public.app_current_practice_id()))))));


--
-- Name: sms_delivery_event_history delivery_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_history_insert ON public.sms_delivery_event_history FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_delivery_event_history delivery_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_history_select ON public.sms_delivery_event_history FOR SELECT USING ((public.app_rls_bypass() OR ((practice_id IS NOT NULL) AND (practice_id = public.app_current_practice_id()))));


--
-- Name: demo_accesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demo_accesses ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_charts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dental_charts ENABLE ROW LEVEL SECURITY;

--
-- Name: discharge_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discharge_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: dispense_charge_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispense_charge_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: ekasa_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ekasa_config ENABLE ROW LEVEL SECURITY;

--
-- Name: ekasa_daily_closures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ekasa_daily_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: ekasa_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ekasa_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_suppressions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_ai_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_ai_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_ai_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_ai_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_journeys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_journeys ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_step_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_step_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_automation_suppression_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_automation_suppression_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_carcass_disposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_carcass_disposals ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_channel_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_channel_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_clinical_guardian_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_clinical_guardian_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_clinician_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_clinician_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_content_briefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_content_briefs ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_content_pillars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_content_pillars ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_crm_segment_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_crm_segment_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_crm_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_crm_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_kvepis_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_kvepis_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_kvepis_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_kvepis_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_competitor_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_competitor_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_content_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_content_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_content_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_content_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_handouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_handouts ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_media_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_media_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_message_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_message_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_message_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_operative_scripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_operative_scripts ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_postop_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_postop_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_recall_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_recall_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_staff_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_staff_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_tv_slides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_tv_slides ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_website_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_website_config ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_website_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_website_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_marketing_wellness_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_marketing_wellness_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_pilot_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_pilot_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_rabies_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_rabies_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_rabies_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_rabies_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_sms_delivery_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_sms_delivery_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_support_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_support_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ext_withdrawal_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ext_withdrawal_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: external_lab_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_lab_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: external_lab_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_lab_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: external_prescription_fills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_prescription_fills ENABLE ROW LEVEL SECURITY;

--
-- Name: external_prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: file_object_replicas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_object_replicas ENABLE ROW LEVEL SECURITY;

--
-- Name: file_storage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_storage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_closes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_closes ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

--
-- Name: historical_appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historical_appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: historical_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historical_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: kvl_cr_passports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kvl_cr_passports ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_analyzer_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_analyzer_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_result_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_result_events ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_result_replacements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_result_replacements ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

--
-- Name: legacy_financial_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legacy_financial_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: legacy_financial_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legacy_financial_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: legacy_financial_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legacy_financial_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: legacy_financial_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legacy_financial_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: location_messaging; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_messaging ENABLE ROW LEVEL SECURITY;

--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_registration_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_registration_events ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: microchip_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.microchip_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: migration_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migration_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_allergies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_merge_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_merge_events ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_weights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_weights ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_disputes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_processor_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_processor_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_processor_refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_processor_refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_processor_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_processor_settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: pet_passports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_passports ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_email_identity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_email_identity ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_email_identity_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_email_identity_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_email_preference_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_email_preference_events ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_email_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_email_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_conversion_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practice_conversion_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: soap_note_addenda practice_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY practice_isolation ON public.soap_note_addenda USING (((COALESCE(current_setting('app.rls_bypass'::text, true), ''::text) = 'on'::text) OR (practice_id = (NULLIF(current_setting('app.current_practice_id'::text, true), ''::text))::uuid))) WITH CHECK (((COALESCE(current_setting('app.rls_bypass'::text, true), ''::text) = 'on'::text) OR (practice_id = (NULLIF(current_setting('app.current_practice_id'::text, true), ''::text))::uuid)));


--
-- Name: practice_payment_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practice_payment_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: practices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_events ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: problem_list; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.problem_list ENABLE ROW LEVEL SECURITY;

--
-- Name: procedures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_buckets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: recent_clinical_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recent_clinical_items ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_series ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_interactions reference_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reference_delete ON public.drug_interactions FOR DELETE USING (public.app_rls_bypass());


--
-- Name: drug_interactions reference_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reference_insert ON public.drug_interactions FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: drug_interactions reference_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reference_read ON public.drug_interactions FOR SELECT USING (true);


--
-- Name: drug_interactions reference_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reference_update ON public.drug_interactions FOR UPDATE USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_consent_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_consent_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_delivery_event_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_delivery_event_history ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_delivery_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_delivery_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_provider_event_conflict_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_provider_event_conflict_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_provider_event_conflicts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_provider_event_conflicts ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_provider_event_resolutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_provider_event_resolutions ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_provider_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_provider_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_send_attempt_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_send_attempt_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_send_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_send_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_suppressions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_suppressions ENABLE ROW LEVEL SECURITY;

--
-- Name: soap_note_addenda; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soap_note_addenda ENABLE ROW LEVEL SECURITY;

--
-- Name: soap_note_replacements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soap_note_replacements ENABLE ROW LEVEL SECURITY;

--
-- Name: soap_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_conversion_milestones system_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_delete ON public.practice_conversion_milestones FOR DELETE USING (public.app_rls_bypass());


--
-- Name: clinic_pilot_events system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.clinic_pilot_events FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: file_storage_events system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.file_storage_events FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: platform_email_identity system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.platform_email_identity FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: platform_email_identity_aliases system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.platform_email_identity_aliases FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: platform_email_preference_events system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.platform_email_preference_events FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: practice_conversion_milestones system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_insert ON public.practice_conversion_milestones FOR INSERT WITH CHECK (public.app_rls_bypass());


--
-- Name: auth_email_attempts system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.auth_email_attempts USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: auth_email_delivery_events system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.auth_email_delivery_events USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: auth_email_provider_identity_conflicts system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.auth_email_provider_identity_conflicts USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: auth_email_webhook_conflicts system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.auth_email_webhook_conflicts USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: backup_runs system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.backup_runs USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: clinic_pilots system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.clinic_pilots USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: demo_accesses system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.demo_accesses USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: file_object_replicas system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.file_object_replicas USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: funnel_events system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.funnel_events USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: platform_email_preferences system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.platform_email_preferences USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: rate_limit_buckets system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.rate_limit_buckets USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_provider_event_conflict_reviews system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.sms_provider_event_conflict_reviews USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_provider_event_conflicts system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.sms_provider_event_conflicts USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_provider_event_resolutions system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.sms_provider_event_resolutions USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: sms_provider_events system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.sms_provider_events USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: stripe_events system_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_only ON public.stripe_events USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: clinic_pilot_events system_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_read ON public.clinic_pilot_events FOR SELECT USING (public.app_rls_bypass());


--
-- Name: file_storage_events system_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_read ON public.file_storage_events FOR SELECT USING (public.app_rls_bypass());


--
-- Name: platform_email_identity system_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_read ON public.platform_email_identity FOR SELECT USING (public.app_rls_bypass());


--
-- Name: platform_email_identity_aliases system_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_read ON public.platform_email_identity_aliases FOR SELECT USING (public.app_rls_bypass());


--
-- Name: platform_email_preference_events system_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_read ON public.platform_email_preference_events FOR SELECT USING (public.app_rls_bypass());


--
-- Name: practice_conversion_milestones system_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_update ON public.practice_conversion_milestones FOR UPDATE USING (public.app_rls_bypass()) WITH CHECK (public.app_rls_bypass());


--
-- Name: ai_imaging_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ai_imaging_analyses USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: api_keys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_keys USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: appointment_types tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.appointment_types USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: appointment_waitlist tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.appointment_waitlist USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: appointments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.appointments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: audit_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.audit_log USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: booking_pages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_pages USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: capture_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.capture_sessions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: care_reminders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.care_reminders USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: case_entries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_entries USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.cases p
  WHERE ((p.id = case_entries.case_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.cases p
  WHERE ((p.id = case_entries.case_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: cases tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cases USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: client_contacts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.client_contacts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: clients tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clients USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: clinical_notes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_notes USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: clinical_record_corrections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_record_corrections USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: communications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.communications USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: consent_forms tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.consent_forms USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: consent_receipt_capabilities tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.consent_receipt_capabilities USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: consent_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.consent_requests USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: controlled_substance_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.controlled_substance_log USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: dental_charts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dental_charts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: discharge_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discharge_reports USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: dispense_charge_queue tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dispense_charge_queue USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ekasa_config tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ekasa_config USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ekasa_daily_closures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ekasa_daily_closures USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ekasa_receipts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ekasa_receipts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: email_suppressions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.email_suppressions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_ai_audit_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_ai_audit_log USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_ai_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_ai_settings USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_enrollments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_enrollments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_journeys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_journeys USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_rules USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_step_executions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_step_executions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_automation_suppression_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_automation_suppression_log USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_carcass_disposals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_carcass_disposals USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_channel_accounts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_channel_accounts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_clinical_guardian_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_clinical_guardian_alerts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_clinician_confirmations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_clinician_confirmations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_content_briefs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_content_briefs USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_content_pillars tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_content_pillars USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_crm_segment_memberships tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_crm_segment_memberships USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_crm_segments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_crm_segments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_kvepis_credentials tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_kvepis_credentials USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_kvepis_submissions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_kvepis_submissions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_automation_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_automation_rules USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_competitor_snapshots tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_competitor_snapshots USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_content_batches tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_content_batches USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_content_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_content_items USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_handouts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_handouts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_media_assets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_media_assets USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_media_consents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_media_consents USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_message_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_message_logs USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_message_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_message_templates USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_operative_scripts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_operative_scripts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_postop_responses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_postop_responses USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_recall_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_recall_schedules USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_reviews tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_reviews USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_staff_tasks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_staff_tasks USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_tv_slides tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_tv_slides USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_website_config tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_website_config USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_website_inquiries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_website_inquiries USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_marketing_wellness_redemptions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_marketing_wellness_redemptions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_pilot_feedback tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_pilot_feedback USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_rabies_notifications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_rabies_notifications USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_rabies_observations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_rabies_observations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_sms_delivery_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_sms_delivery_log USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_support_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_support_sessions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: ext_withdrawal_periods tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ext_withdrawal_periods USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: external_lab_observations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.external_lab_observations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: external_lab_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.external_lab_reports USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: external_prescription_fills tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.external_prescription_fills USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: external_prescriptions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.external_prescriptions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: files tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.files USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: financial_closes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.financial_closes USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: historical_appointments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.historical_appointments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: historical_documents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.historical_documents USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: insurance_claims tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.insurance_claims USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: insurance_policies tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.insurance_policies USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: invoice_adjustments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.invoice_adjustments USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = invoice_adjustments.invoice_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = invoice_adjustments.invoice_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: invoice_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.invoice_items USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = invoice_items.invoice_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = invoice_items.invoice_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: invoices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.invoices USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: kvl_cr_passports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.kvl_cr_passports USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: lab_analyzer_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.lab_analyzer_reports USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: lab_result_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.lab_result_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: lab_result_replacements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.lab_result_replacements USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: lab_results tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.lab_results USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: legacy_financial_allocations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.legacy_financial_allocations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: legacy_financial_documents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.legacy_financial_documents USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: legacy_financial_line_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.legacy_financial_line_items USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: legacy_financial_payments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.legacy_financial_payments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: location_messaging tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.location_messaging USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: locations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.locations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: messaging_registration_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.messaging_registration_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: messaging_registrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.messaging_registrations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: microchip_registrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.microchip_registrations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: migration_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.migration_runs USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: patient_allergies tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_allergies USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_allergies.patient_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_allergies.patient_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: patient_merge_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_merge_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: patient_weights tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_weights USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_weights.patient_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_weights.patient_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: patients tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patients USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: payment_disputes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_disputes USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: payment_processor_payouts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_processor_payouts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: payment_processor_refunds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_processor_refunds USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: payment_processor_settlements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_processor_settlements USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: payments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payments USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = payments.invoice_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.invoices p
  WHERE ((p.id = payments.invoice_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: pet_passports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pet_passports USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: portal_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.portal_sessions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: practice_payment_accounts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.practice_payment_accounts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: practices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.practices USING ((public.app_rls_bypass() OR (id = public.app_current_practice_id()))) WITH CHECK ((public.app_rls_bypass() OR (id = public.app_current_practice_id())));


--
-- Name: prescription_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.prescription_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: prescriptions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.prescriptions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: problem_list tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.problem_list USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: procedures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.procedures USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: products tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.products USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: purchase_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.purchase_orders USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: recent_clinical_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.recent_clinical_items USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: recurring_series tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.recurring_series USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: rooms tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rooms USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: services tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.services USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: sms_consent_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sms_consent_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: sms_send_attempt_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sms_send_attempt_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: sms_send_attempts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sms_send_attempts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: sms_suppressions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sms_suppressions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: soap_note_addenda tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.soap_note_addenda USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: soap_note_replacements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.soap_note_replacements USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: soap_notes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.soap_notes USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: staff_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.staff_schedules USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: stripe_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.stripe_events USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: suppliers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.suppliers USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: treatment_plan_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.treatment_plan_items USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.treatment_plans p
  WHERE ((p.id = treatment_plan_items.plan_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.treatment_plans p
  WHERE ((p.id = treatment_plan_items.plan_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: treatment_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.treatment_plans USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: treatment_template_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.treatment_template_items USING ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.treatment_templates p
  WHERE ((p.id = treatment_template_items.template_id) AND (p.practice_id = public.app_current_practice_id())))))) WITH CHECK ((public.app_rls_bypass() OR (EXISTS ( SELECT 1
   FROM public.treatment_templates p
  WHERE ((p.id = treatment_template_items.template_id) AND (p.practice_id = public.app_current_practice_id()))))));


--
-- Name: treatment_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.treatment_templates USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: usage_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.usage_records USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: users tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.users USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: vaccination_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.vaccination_records USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_closeouts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_closeouts USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plan_presentations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plan_presentations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plan_response_lines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plan_response_lines USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plan_responses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plan_responses USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plan_revision_lines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plan_revision_lines USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plan_revisions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plan_revisions USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_treatment_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_treatment_plans USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: visit_work_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.visit_work_items USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: vital_signs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.vital_signs USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: voice_dictations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.voice_dictations USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: webhooks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.webhooks USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: wellness_enrollments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.wellness_enrollments USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: wellness_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.wellness_plans USING ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text))) WITH CHECK ((public.app_rls_bypass() OR ((practice_id)::text = (public.app_current_practice_id())::text)));


--
-- Name: practice_conversion_milestones tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.practice_conversion_milestones FOR SELECT USING ((public.app_rls_bypass() OR (practice_id = public.app_current_practice_id())));


--
-- Name: treatment_plan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_template_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_template_items ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: vaccination_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_closeouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_closeouts ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plan_presentations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plan_presentations ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plan_response_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plan_response_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plan_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plan_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plan_revision_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plan_revision_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plan_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plan_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_treatment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_treatment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: visit_work_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visit_work_items ENABLE ROW LEVEL SECURITY;

--
-- Name: vital_signs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vital_signs ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_dictations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voice_dictations ENABLE ROW LEVEL SECURITY;

--
-- Name: webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: wellness_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wellness_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: wellness_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wellness_plans ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 5YR5uoBJamzPjSZab4MebquUw1dBgQLE4gUcYZqiitXWMan6Cr1qAvlXxQ7Kt8G

