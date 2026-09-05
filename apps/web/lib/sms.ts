import { sendSms, type SmsDispatchResult } from "@/lib/sms-dispatch";

export {
  prepareCampaignSmsBody,
  reconcileSmsSendAttempt,
  resendSmsAttempt,
  sendSms,
  SMS_COMPLIANCE_FOOTER,
  SMS_MAX_BODY_LENGTH,
} from "@/lib/sms-dispatch";
export type {
  SmsDispatchOutcome,
  SmsDispatchResult,
  SmsSendOptions,
} from "@/lib/sms-dispatch";

// ---------------------------------------------------------------------------
// Core send function
//
// Transport is provider-agnostic (lib/messaging): explicit locations bind the
// persisted provider and sender from one active location_messaging row. Calls
// without a location retain the env-selected provider/sender fallback for dev.
// This module keeps the hosted entitlement gate and usage metering.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Appointment reminder SMS
// ---------------------------------------------------------------------------

export async function sendAppointmentReminderSms(data: {
  to: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  source?: string;
  sourceId?: string;
  idempotencyKey?: string;
}): Promise<SmsDispatchResult> {
  const isSlovak = data.to.startsWith("+421");
  const phoneInfo = isSlovak
    ? data.practicePhone
      ? `Pre zmenu terminu volajte ${data.practicePhone}.`
      : "V pripade otazok nas kontaktujte."
    : data.practicePhone
      ? `Call ${data.practicePhone} to reschedule.`
      : "Contact us to reschedule.";

  const body = isSlovak
    ? `Pripomienka: ${data.patientName} ma termin vysetrenia ${data.appointmentDate} o ${data.appointmentTime}. ${phoneInfo}`
    : `Reminder: ${data.patientName} has an appointment on ${data.appointmentDate} at ${data.appointmentTime}. ${phoneInfo}`;

  const result = await sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: data.source ?? "appointment_reminder",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Vaccination reminder SMS
// ---------------------------------------------------------------------------

export async function sendVaccinationReminderSms(data: {
  to: string;
  patientName: string;
  vaccineName: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  sourceId?: string;
  idempotencyKey?: string;
}): Promise<SmsDispatchResult> {
  const isSlovak = data.to.startsWith("+421");
  const phoneInfo = isSlovak
    ? data.practicePhone
      ? `Pre termin volajte ${data.practicePhone}.`
      : "Pre dohodnutie terminu nas kontaktujte."
    : data.practicePhone
      ? `Call ${data.practicePhone} to schedule.`
      : "Contact us to schedule.";

  const body = isSlovak
    ? `Pripomienka ockovania: Blizi sa termin ockovania (${data.vaccineName}) pre pacienta ${data.patientName}. ${phoneInfo}`
    : `${data.patientName} is due for their ${data.vaccineName} vaccination. ${phoneInfo}`;

  const result = await sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "vaccination_recall",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Care reminder SMS
// ---------------------------------------------------------------------------

export async function sendCareReminderSms(data: {
  to: string;
  patientName: string;
  reminderTitle: string;
  dueDate: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId: string;
  clientId: string;
  communicationId: string;
  sourceId: string;
  idempotencyKey: string;
}): Promise<SmsDispatchResult> {
  const isSlovak = data.to.startsWith("+421");
  const contact = isSlovak
    ? data.practicePhone
      ? `V pripade otazok volajte ${data.practicePhone}.`
      : "V pripade otazok nas kontaktujte."
    : data.practicePhone
      ? `Call ${data.practicePhone} with questions.`
      : "Contact us with questions.";

  const body = isSlovak
    ? `Zdravotna pripomienka pre ${data.patientName}: ${data.reminderTitle}. Datum: ${data.dueDate}. ${contact}`
    : `Reminder for ${data.patientName}: ${data.reminderTitle}. Reminder date: ${data.dueDate}. ${contact}`;

  return sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "care_reminder",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Patient Ready for Pickup SMS (Pooperačné prebudenie)
// ---------------------------------------------------------------------------

export async function sendReadyForPickupSms(data: {
  to: string;
  patientName: string;
  pickupTime?: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  idempotencyKey?: string;
}): Promise<SmsDispatchResult> {
  const isSlovak = data.to.startsWith("+421");
  const timeInfo = data.pickupTime
    ? isSlovak
      ? `Mozete si po neho prist v case: ${data.pickupTime}.`
      : `You may pick them up at: ${data.pickupTime}.`
    : isSlovak
      ? "Mozete si po neho prist."
      : "You may pick them up.";

  const phoneInfo = data.practicePhone
    ? isSlovak
      ? `Otazky na ${data.practicePhone}.`
      : `Questions: ${data.practicePhone}.`
    : "";

  const body = isSlovak
    ? `Dobry den, pacient ${data.patientName} je po zakroku prebudeny a pripraveny na vyzdvihnutie. ${timeInfo} ${phoneInfo}`.trim()
    : `Hello, ${data.patientName} is awake from their procedure and ready for pickup. ${timeInfo} ${phoneInfo}`.trim();

  return sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "ready_for_pickup",
    idempotencyKey: data.idempotencyKey,
  });
}

// ---------------------------------------------------------------------------
// Post-op Follow-up / Check-in SMS
// ---------------------------------------------------------------------------

export async function sendPostOpFollowupSms(data: {
  to: string;
  patientName: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  idempotencyKey?: string;
}): Promise<SmsDispatchResult> {
  const isSlovak = data.to.startsWith("+421");
  const phoneInfo = data.practicePhone
    ? isSlovak
      ? `V pripade otazok ci zmien volajte ${data.practicePhone}.`
      : `Call ${data.practicePhone} if you have questions.`
    : "";

  const body = isSlovak
    ? `Dobry den, kontrolujeme stav pacienta ${data.patientName} po zakroku. Verime, ze rekonvalescencia prebieha v poriadku. ${phoneInfo}`.trim()
    : `Hello, checking in on ${data.patientName} following their procedure. We hope their recovery is going well. ${phoneInfo}`.trim();

  return sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "post_op_followup",
    idempotencyKey: data.idempotencyKey,
  });
}

