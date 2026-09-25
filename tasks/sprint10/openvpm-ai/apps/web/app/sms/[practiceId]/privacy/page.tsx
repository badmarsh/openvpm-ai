import { notFound } from "next/navigation";
import { getPublicMessagingProgram } from "@/lib/messaging/public-program";
import { getServerI18n } from "@/lib/i18n";

export default async function SmsPrivacyPage({
  params,
}: {
  params: Promise<{ practiceId: string }>;
}) {
  const { practiceId } = await params;
  const program = await getPublicMessagingProgram(practiceId);
  if (!program) notFound();
  const { t } = getServerI18n();

  return (
    <>
      <p className="font-medium text-primary">{program.displayName}</p>
      <h1>{t("sms.privacy.title", "SMS privacy policy")}</h1>
      <p>{t("sms.privacy.lastUpdated", "Last updated: August 8, 2026")}</p>

      <p>
        {t("sms.privacy.intro", "This policy applies to text messages sent by {clinicName} through OpenVPM. The clinic controls its client information; OpenVPM processes that information to provide the messaging service.", { clinicName: program.displayName })}
      </p>

      <h2>{t("sms.privacy.usedFor", "Information used for texting")}</h2>
      <p>
        {t("sms.privacy.usedForDetails", "The clinic may use your name, mobile number, pet and appointment details, message content, consent record, and opt-out status to send requested veterinary service messages and respond to you.")}
      </p>

      <h2>{t("sms.privacy.howUsed", "How information is used")}</h2>
      <ul>
        {t("sms.privacy.howUsedItems", "Send appointment reminders and schedule updates.\nSend vaccination, care, prescription, and follow-up notices.\nAnswer client questions and record messaging preferences.\nSecure, troubleshoot, and document the messaging service.").split("\n").map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h2>{t("sms.privacy.noSale", "No sale or promotional sharing")}</h2>
      <p>
        {t("sms.privacy.noSaleDetails", "The clinic and OpenVPM do not sell your personal information. SMS opt-in data and consent are not shared with third parties for their own marketing or promotional purposes.")}
      </p>
      <p>
        {t("sms.privacy.noSaleDetailsAdditional", "Information may be processed by OpenVPM's infrastructure providers, telecommunications carriers, and other service providers only as needed to deliver, secure, and support the clinic's messages or meet legal obligations.")}
      </p>

      <h2>{t("sms.privacy.retention", "Retention and security")}</h2>
      <p>
        {t("sms.privacy.retentionDetails", "Consent, message, and opt-out records are retained as part of the clinic's business and medical-record systems for as long as needed to provide the service and meet legal or operational requirements. OpenVPM uses encryption in transit, role-based access, and tenant isolation to protect hosted records.")}
      </p>

      <h2>{t("sms.privacy.yourChoices", "Your choices")}</h2>
      <p>
        {t("sms.privacy.yourChoicesDetails", "Reply STOP to stop text messages or HELP for help. You may also contact the clinic to ask about its records or update your communication preferences. An opt-out applies to text messages; the clinic may still contact you through other channels when appropriate.")}
      </p>

      <h2>{t("sms.privacy.contact", "Contact")}</h2>
      <p>
        {program.businessPhone ? (
          <>{t("sms.terms.call", "call {phone}", { phone: program.businessPhone })} with privacy or messaging questions.</>
        ) : program.website ? (
          <>
            {t("sms.terms.visitWebsite", "visit the clinic's website at {url}", { url: program.website })} for contact information.
          </>
        ) : (
          <>{t("sms.terms.contactDirectly", "contact {clinicName} directly", { clinicName: program.displayName })} with questions.</>
        )}
      </p>
    </>
  );
}
