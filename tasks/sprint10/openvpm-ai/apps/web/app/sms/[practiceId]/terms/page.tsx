import { notFound } from "next/navigation";
import { getPublicMessagingProgram } from "@/lib/messaging/public-program";
import { getServerI18n } from "@/lib/i18n";

export default async function SmsTermsPage({
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
      <h1>{t("sms.terms.title", "SMS terms and conditions")}</h1>
      <p>{t("sms.terms.lastUpdated", "Last updated: August 8, 2026")}</p>

      <h2>{t("sms.terms.program", "Program")}</h2>
      <p>
        {t("sms.terms.programDetails", "By opting in, you authorize {clinicName} to send veterinary service text messages to the mobile number you provide. Messages may include appointment reminders, vaccination and care updates, prescription or follow-up notices, and two-way client support. OpenVPM supplies the clinic's messaging technology.", { clinicName: program.displayName })}
      </p>

      <h2>{t("sms.terms.consent", "Consent and frequency")}</h2>
      <p>
        {t("sms.terms.consentDetails", "Your consent is optional and is not a condition of purchasing goods or services. Message frequency varies based on your pets' care and your interactions with the clinic. Message and data rates may apply.")}
      </p>

      <h2>{t("sms.terms.optOut", "Opt out and help")}</h2>
      <ul>
        {t("sms.terms.optOutItems", "Reply STOP to cancel text messages.\nReply HELP for help.\nAfter opting out, you may receive one confirmation message. You can later reply START or give the clinic new consent to resume messages.").split("\n").map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h2>{t("sms.terms.delivery", "Delivery")}</h2>
      <p>
        {t("sms.terms.deliveryDetails", "Carriers are not liable for delayed or undelivered messages. Texting is not appropriate for emergencies. Contact an emergency veterinary provider directly when urgent care is needed.")}
      </p>

      <h2>{t("sms.terms.privacyContact", "Privacy and contact")}</h2>
      <p>
        {t("sms.terms.privacyContactDetails", "The clinic's SMS privacy policy explains how messaging information is handled. For program help, {contactMethod}", {
          contactMethod: program.businessPhone
            ? t("sms.terms.call", "call {phone}", { phone: program.businessPhone })
            : program.website
              ? t("sms.terms.visitWebsite", "visit the clinic's website at {url}", { url: program.website })
              : t("sms.terms.contactDirectly", "contact {clinicName} directly", { clinicName: program.displayName })
        })}
      </p>
    </>
  );
}
