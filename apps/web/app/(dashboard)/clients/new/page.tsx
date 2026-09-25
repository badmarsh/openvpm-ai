"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/empty-state";
import {
  PageHeader,
  PageSectionHeader,
} from "@/components/layout/page-header";
import { pageShellClass } from "@/components/layout/page-kit";
import { toast } from "sonner";
import {
  CLIENT_ADDRESS_MAX_LENGTH,
  CLIENT_CITY_MAX_LENGTH,
  CLIENT_EMAIL_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_PHONE_MAX_LENGTH,
  CLIENT_STATE_MAX_LENGTH,
  CLIENT_ZIP_MAX_LENGTH,
  type ClientContactMethod,
  isOptionalClientTextValid,
  isRequiredClientTextValid,
} from "@/lib/clients/policy";
import { normalizeE164 } from "@/lib/messaging/phone";
import { SMS_CONSENT_DISCLOSURE } from "@/lib/messaging/consent";
import { useI18n } from "@/lib/i18n";

/** Native <select> styled like the Input primitive (h-10, text-sm, focus ring). */
const formSelectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Form section card, matching the other dashboard entry forms. */
const formSectionClass =
  "space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs";

/**
 * The same pattern zod 3 uses for `z.string().email()`, which the clients
 * router applies after trimming. Mirroring it keeps a malformed address from
 * reaching the server and coming back as an untranslated validation error.
 */
const CLIENT_EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

function isClientEmailFormatValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || CLIENT_EMAIL_PATTERN.test(trimmed);
}

/**
 * Group an E.164 number for display so staff can check how the number will be
 * texted. Slovak mobiles read +421 9xx xxx xxx; other numbers stay as E.164.
 */
function formatE164ForDisplay(e164: string): string {
  const slovakMobile = /^\+421(9\d{2})(\d{3})(\d{3})$/.exec(e164);
  if (slovakMobile) {
    return `+421 ${slovakMobile[1]} ${slovakMobile[2]} ${slovakMobile[3]}`;
  }
  const northAmerican = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (northAmerican) {
    return `+1 ${northAmerican[1]} ${northAmerican[2]} ${northAmerican[3]}`;
  }
  return e164;
}

const IMPLICIT_SUBMIT_SAFE_INPUT_TYPES = new Set([
  "submit",
  "button",
  "reset",
  "image",
]);

/**
 * Intake forms only submit from the submit button. Enter inside a text field
 * would otherwise create a half-filled record.
 */
function preventImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    !IMPLICIT_SUBMIT_SAFE_INPUT_TYPES.has(target.type)
  ) {
    event.preventDefault();
  }
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

function canManageClientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function NewClientPageFallback() {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl">
      <div
        role="status"
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("clients.form.checkingAccess", "Checking client access...")}
      </div>
    </div>
  );
}

export default function NewClientPage() {
  return (
    <Suspense fallback={<NewClientPageFallback />}>
      <NewClientPageContent />
    </Suspense>
  );
}

function NewClientPageContent() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const firstClinicDay = searchParams.get("setup") === "first-visit";

  if (status === "loading") {
    return <NewClientPageFallback />;
  }

  if (!canManageClientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <div className={pageShellClass}>
          <PageHeader
            icon={UserPlus}
            title={t("clients.form.titleNew", "New Client")}
          />
          <EmptyState
            icon={AlertCircle}
            title={t(
              "clients.form.readOnlyNotice",
              "Client actions are read-only",
            )}
            description={t(
              "clients.form.readOnlyDesc",
              "Only staff roles with client write access can manage clients.",
            )}
            action={{
              label: t("clients.actions.backToClients", "Back to Clients"),
              onClick: () => router.push("/clients"),
            }}
          />
        </div>
      </div>
    );
  }

  return <NewClientForm firstClinicDay={firstClinicDay} />;
}

type ClientTouchedField = "firstName" | "lastName" | "email" | "phone";

function NewClientForm({ firstClinicDay }: { firstClinicDay: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<ClientContactMethod>("phone");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<
    Partial<Record<ClientTouchedField, boolean>>
  >({});
  // `isPending` only flips after React re-renders, so a fast double click
  // could otherwise send two create requests. This guard is synchronous.
  const submitLockRef = useRef(false);

  // Realtime debounce anti-duplicate check
  const [debouncedPhone, setDebouncedPhone] = useState(form.phone);
  const [debouncedEmail, setDebouncedEmail] = useState(form.email);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPhone(form.phone);
      setDebouncedEmail(form.email);
    }, 400);
    return () => clearTimeout(handler);
  }, [form.phone, form.email]);

  const { data: duplicateCheck } =
    trpc.extensions.duplicateShield.checkClient.useQuery(
      {
        phone: debouncedPhone?.trim() || undefined,
        email: debouncedEmail?.trim() || undefined,
      },
      {
        enabled: Boolean(debouncedPhone?.trim() || debouncedEmail?.trim()),
        refetchOnWindowFocus: false,
      }
    );

  const createClient = trpc.clients.create.useMutation({
    // The submit lock stays engaged on success: the page is navigating away.
    onSuccess: async (client) => {
      await utils.clients.list.invalidate();
      toast.success(t("clients.form.createdSuccess", "Client created"));
      if (firstClinicDay) {
        const ownerName = `${client.firstName} ${client.lastName}`;
        router.push(
          `/patients/new?clientId=${encodeURIComponent(client.id)}&clientName=${encodeURIComponent(ownerName)}&setup=first-visit`,
        );
        return;
      }
      router.push(`/clients/${client.id}`);
    },
    onError: (err) => {
      submitLockRef.current = false;
      // Input validation failures arrive as serialized zod issues; show a
      // translated message instead of raw JSON.
      const message = err.data?.zodError
        ? t(
            "clients.form.validation.checkRequiredFields",
            "Check required fields and field lengths.",
          )
        : err.message;
      toast.error(message);
      setError(message);
    },
  });

  const smsPhone = normalizeE164(form.phone);
  const smsPhoneValid = smsPhone !== null;
  const emailFormatValid = isClientEmailFormatValid(form.email);
  const canSubmit =
    isRequiredClientTextValid(form.firstName, CLIENT_NAME_MAX_LENGTH) &&
    isRequiredClientTextValid(form.lastName, CLIENT_NAME_MAX_LENGTH) &&
    isOptionalClientTextValid(form.email, CLIENT_EMAIL_MAX_LENGTH) &&
    emailFormatValid &&
    isOptionalClientTextValid(form.phone, CLIENT_PHONE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.address, CLIENT_ADDRESS_MAX_LENGTH) &&
    isOptionalClientTextValid(form.city, CLIENT_CITY_MAX_LENGTH) &&
    isOptionalClientTextValid(form.state, CLIENT_STATE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.zip, CLIENT_ZIP_MAX_LENGTH) &&
    (!smsConsent || smsPhoneValid) &&
    (preferredContactMethod !== "sms" || (smsConsent && smsPhoneValid));

  // Every control stays locked while the request runs and after it succeeds,
  // until the redirect lands, so the same client cannot be created twice.
  const formLocked = createClient.isPending || createClient.isSuccess;

  const fieldErrors = {
    firstName: isRequiredClientTextValid(form.firstName, CLIENT_NAME_MAX_LENGTH)
      ? null
      : t(
          "clients.form.validation.firstNameRequired",
          "Enter the client's first name.",
        ),
    lastName: isRequiredClientTextValid(form.lastName, CLIENT_NAME_MAX_LENGTH)
      ? null
      : t(
          "clients.form.validation.lastNameRequired",
          "Enter the client's last name.",
        ),
    email: emailFormatValid
      ? null
      : t(
          "clients.form.validation.emailInvalid",
          "Enter a valid email address, for example name@example.com.",
        ),
  };
  const visibleError = (field: keyof typeof fieldErrors) =>
    touched[field] ? fieldErrors[field] : null;

  const missingFields = [
    fieldErrors.firstName ? t("clients.form.firstName", "First Name") : null,
    fieldErrors.lastName ? t("clients.form.lastName", "Last Name") : null,
    fieldErrors.email ? t("clients.form.email", "Email") : null,
    preferredContactMethod === "sms" && !smsConsent
      ? t("clients.form.validation.smsConsentField", "SMS consent")
      : null,
  ].filter((field): field is string => Boolean(field));
  const requirementsHint = canSubmit
    ? null
    : missingFields.length > 0
      ? t(
          "clients.form.validation.missingFields",
          "To create the client, complete: {fields}.",
          { fields: missingFields.join(", ") },
        )
      : t(
          "clients.form.validation.checkRequiredFields",
          "Check required fields and field lengths.",
        );

  const phoneHint = smsPhone
    ? {
        warning: false,
        text: t(
          "clients.form.phoneHint.smsTarget",
          "SMS reminders will be sent to {number}.",
          { number: formatE164ForDisplay(smsPhone) },
        ),
      }
    : form.phone.trim() && touched.phone
      ? {
          warning: true,
          text: t(
            "clients.form.phoneHint.smsUnavailable",
            "This number can't be used for SMS. Enter a mobile number such as 0905 123 456 or +421 905 123 456.",
          ),
        }
      : {
          warning: false,
          text: t(
            "clients.form.phoneHint.format",
            "National numbers such as 0905 123 456 are texted as +421 905 123 456.",
          ),
        };

  const markTouched = (field: ClientTouchedField) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);
    setTouched({ firstName: true, lastName: true, email: true, phone: true });

    if (smsConsent && !smsPhoneValid) {
      setError(
        t(
          "clients.form.validation.smsPhoneInvalid",
          "Enter a valid mobile phone number before recording SMS consent.",
        ),
      );
      return;
    }
    if (preferredContactMethod === "sms" && !smsConsent) {
      setError(
        t(
          "clients.form.validation.smsConsentRequired",
          "Confirm the client's SMS consent before using text messages for reminders.",
        ),
      );
      return;
    }
    if (!canSubmit) {
      setError(
        t(
          "clients.form.validation.checkRequiredFields",
          "Check required fields and field lengths.",
        ),
      );
      return;
    }

    submitLockRef.current = true;
    createClient.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zip: form.zip.trim() || undefined,
      preferredContactMethod,
      smsConsent,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "phone" && !normalizeE164(value)) {
      setSmsConsent(false);
      setPreferredContactMethod((current) =>
        current === "sms" ? "phone" : current,
      );
    }
  };

  return (
    <div className="max-w-2xl">
      <div className={pageShellClass}>
        <PageHeader
          icon={UserPlus}
          title={t("clients.form.titleNew", "New Client")}
          subtitle={
            firstClinicDay
              ? t(
                  "clients.form.stepOneSubtitle",
                  "First clinic day, step 1 of 3: add one real owner. Their pet is next.",
                )
              : t(
                  "clients.form.addNewSubtitle",
                  "Add a new client to your practice",
                )
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/clients")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("clients.actions.backToClients", "Back to Clients")}
            </Button>
          }
        />

        {error ? (
          <Alert variant="destructive" className="bg-destructive/10">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form
          noValidate
          onSubmit={handleSubmit}
          onKeyDown={preventImplicitSubmit}
          aria-busy={formLocked}
        >
          <fieldset disabled={formLocked} className="min-w-0 space-y-6">
            <section className={formSectionClass}>
              <PageSectionHeader
                title={t("clients.form.sections.contact.title", "Owner & contact")}
                subtitle={t(
                  "clients.form.sections.contact.subtitle",
                  "Name, email, and phone used for reminders and invoices.",
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">
                    {t("clients.form.firstName", "First Name")}
                    <RequiredMark />
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    onBlur={() => markTouched("firstName")}
                    maxLength={CLIENT_NAME_MAX_LENGTH}
                    autoComplete="off"
                    required
                    aria-invalid={Boolean(visibleError("firstName"))}
                    aria-describedby={
                      visibleError("firstName") ? "firstName-error" : undefined
                    }
                  />
                  <FieldError
                    id="firstName-error"
                    message={visibleError("firstName")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">
                    {t("clients.form.lastName", "Last Name")}
                    <RequiredMark />
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    onBlur={() => markTouched("lastName")}
                    maxLength={CLIENT_NAME_MAX_LENGTH}
                    autoComplete="off"
                    required
                    aria-invalid={Boolean(visibleError("lastName"))}
                    aria-describedby={
                      visibleError("lastName") ? "lastName-error" : undefined
                    }
                  />
                  <FieldError
                    id="lastName-error"
                    message={visibleError("lastName")}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("clients.form.email", "Email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    onBlur={() => markTouched("email")}
                    placeholder={t(
                      "clients.form.emailPlaceholder",
                      "email@example.com",
                    )}
                    maxLength={CLIENT_EMAIL_MAX_LENGTH}
                    autoComplete="off"
                    aria-invalid={Boolean(visibleError("email"))}
                    aria-describedby={
                      visibleError("email") ? "email-error" : undefined
                    }
                  />
                  <FieldError id="email-error" message={visibleError("email")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t("clients.form.phone", "Phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    onBlur={() => markTouched("phone")}
                    placeholder={t(
                      "clients.form.phonePlaceholder",
                      "(555) 123-4567",
                    )}
                    maxLength={CLIENT_PHONE_MAX_LENGTH}
                    autoComplete="off"
                    aria-describedby="phone-hint"
                  />
                  <p
                    id="phone-hint"
                    className={cn(
                      "text-xs",
                      phoneHint.warning
                        ? "font-medium text-warning-muted-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {phoneHint.text}
                  </p>
                </div>
              </div>

              {duplicateCheck?.found && duplicateCheck.client ? (
                <div
                  role="alert"
                  className="rounded-lg border border-warning/40 bg-warning-muted/40 p-4 shadow-2xs"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-warning-muted-foreground">
                          {t(
                            "clients.duplicateWarningTitle",
                            "Warning: Existing record found",
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-warning-muted-foreground/80">
                          {t(
                            "clients.duplicateWarningDesc",
                            "A client already exists in the system: {name} ({contact}). Would you like to link the existing record?",
                            {
                              name: `${duplicateCheck.client.firstName} ${duplicateCheck.client.lastName}`,
                              contact:
                                duplicateCheck.client.phone ||
                                duplicateCheck.client.email ||
                                "",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(`/clients/${duplicateCheck.client!.id}`)
                      }
                      className="shrink-0 border-warning/40 text-xs font-semibold text-warning-muted-foreground hover:bg-warning-muted"
                    >
                      {t("clients.openExistingCard", "Open existing profile")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className={formSectionClass}>
              <PageSectionHeader
                title={t(
                  "clients.form.sections.reminders.title",
                  "Reminders & SMS consent",
                )}
                subtitle={t(
                  "clients.form.sections.reminders.subtitle",
                  "How the practice reaches this client. Text messages need recorded consent.",
                )}
              />
              <div className="space-y-1.5">
                <Label htmlFor="preferredContactMethod">
                  {t(
                    "clients.form.preferredContactReminders",
                    "Preferred contact for reminders",
                  )}
                </Label>
                <select
                  id="preferredContactMethod"
                  value={preferredContactMethod}
                  onChange={(event) =>
                    setPreferredContactMethod(
                      event.target.value as ClientContactMethod,
                    )
                  }
                  className={formSelectClass}
                  aria-describedby="preferredContactMethod-help"
                >
                  <option value="phone">
                    {t("clients.form.contactPhone", "Phone call")}
                  </option>
                  <option value="email">
                    {t("clients.form.contactEmail", "Email")}
                  </option>
                  <option value="sms">
                    {t("clients.form.contactSms", "Text message")}
                  </option>
                  <option value="portal">
                    {t("clients.form.contactPortal", "Client portal")}
                  </option>
                </select>
                <p
                  id="preferredContactMethod-help"
                  className="text-xs text-muted-foreground"
                >
                  {t(
                    "clients.form.smsRemindersHelp",
                    "Text message uses SMS for appointment and vaccination reminders when clinic texting is active. The client's permission below is still required.",
                  )}
                </p>
                {preferredContactMethod === "sms" && !smsConsent ? (
                  <p className="text-xs font-medium text-warning-muted-foreground">
                    {t(
                      "clients.form.smsConsentRequiredForPref",
                      "Read the disclosure below and confirm consent before saving text reminders as the preference.",
                    )}
                  </p>
                ) : null}
              </div>

              <label
                htmlFor="smsConsent"
                className="flex items-start gap-3 rounded-md border border-border p-3 text-sm"
              >
                <Checkbox
                  id="smsConsent"
                  checked={smsConsent}
                  onChange={(e) => {
                    setSmsConsent(e.target.checked);
                    if (!e.target.checked) {
                      setPreferredContactMethod((current) =>
                        current === "sms" ? "phone" : current,
                      );
                    }
                  }}
                  disabled={!smsPhoneValid}
                  className="mt-0.5"
                  aria-describedby="smsConsent-disclosure"
                />
                <span>
                  <span className="font-medium">
                    {t(
                      "clients.form.smsConfirmLabel",
                      "I confirm the client explicitly consented to SMS",
                    )}
                  </span>
                  <span
                    id="smsConsent-disclosure"
                    className="block text-xs text-muted-foreground"
                  >
                    {t(
                      "clients.form.smsConsentDisclosure",
                      SMS_CONSENT_DISCLOSURE.snapshot,
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(
                      "clients.form.smsConsentNotice",
                      "Only check this after the client has read this disclosure or you have read it to them.",
                    )}
                    {!smsPhoneValid
                      ? t(
                          "clients.form.smsValidNumberRequired",
                          " Enter a valid mobile phone number to record consent.",
                        )
                      : ""}
                  </span>
                </span>
              </label>
            </section>

            <section className={formSectionClass}>
              <PageSectionHeader
                title={t("clients.form.sections.address.title", "Address")}
                subtitle={t(
                  "clients.form.sections.address.subtitle",
                  "Optional postal address.",
                )}
              />
              <div className="space-y-1.5">
                <Label htmlFor="address">
                  {t("clients.form.address", "Address")}
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder={t(
                    "clients.form.addressPlaceholder",
                    "Street address",
                  )}
                  maxLength={CLIENT_ADDRESS_MAX_LENGTH}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">{t("clients.form.city", "City")}</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder={t("clients.form.cityPlaceholder", "City")}
                    maxLength={CLIENT_CITY_MAX_LENGTH}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">
                    {t("clients.form.state", "State / Province")}
                  </Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    placeholder={t(
                      "clients.form.statePlaceholder",
                      "State / Province",
                    )}
                    maxLength={CLIENT_STATE_MAX_LENGTH}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zip">
                    {t("clients.form.zip", "ZIP / Postal Code")}
                  </Label>
                  <Input
                    id="zip"
                    value={form.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder={t("clients.form.zipPlaceholder", "Zip code")}
                    maxLength={CLIENT_ZIP_MAX_LENGTH}
                    autoComplete="off"
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!canSubmit || createClient.isPending}
                  aria-describedby={
                    requirementsHint ? "client-form-requirements" : undefined
                  }
                >
                  {formLocked ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      {t("clients.actions.creating", "Creating...")}
                    </>
                  ) : (
                    t("clients.form.createClient", "Create Client")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/clients")}
                >
                  {t("clients.actions.cancel", "Cancel")}
                </Button>
              </div>
              {requirementsHint ? (
                <p
                  id="client-form-requirements"
                  className="text-xs text-muted-foreground"
                >
                  {requirementsHint}
                </p>
              ) : null}
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
