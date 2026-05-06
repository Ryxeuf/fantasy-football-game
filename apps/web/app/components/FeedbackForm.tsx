"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "../contexts/LanguageContext";
import { submitFeedback, type FeedbackType } from "../lib/feedback";

// Le widget Turnstile depend de `window` : on le charge cote client
// uniquement pour eviter les erreurs de SSR.
const TurnstileWidget = dynamic(() => import("./TurnstileWidget"), {
  ssr: false,
});

// Bornes alignees sur le schema Zod cote serveur. On les duplique ici
// pour un feedback immediat dans le navigateur, mais la validation cote
// serveur reste l'autorite.
const SUBJECT_MAX = 200;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 5000;
const NAME_MAX = 100;
const EMAIL_MAX = 255;

const FEEDBACK_TYPES: FeedbackType[] = ["bug", "remark", "comment"];

interface FeedbackFormProps {
  /**
   * Site key Turnstile. Si absente, le formulaire affiche un message
   * indiquant que le captcha n'est pas configure et desactive l'envoi.
   * Permet de developper localement sans cle (avec TURNSTILE_BYPASS=1
   * cote serveur).
   */
  turnstileSiteKey?: string;
  /** URL initiale a rapporter (pageUrl). Lue cote client si non fournie. */
  initialPageUrl?: string;
}

interface FieldErrors {
  type?: string;
  subject?: string;
  message?: string;
  email?: string;
  captcha?: string;
}

export default function FeedbackForm({
  turnstileSiteKey,
  initialPageUrl,
}: FeedbackFormProps) {
  const { t } = useLanguage();
  const f = t.feedback;

  const [type, setType] = useState<FeedbackType>("comment");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setErrors((e) => ({ ...e, captcha: undefined }));
  }, []);
  const handleExpire = useCallback(() => setCaptchaToken(null), []);
  const handleCaptchaError = useCallback(() => setCaptchaToken(null), []);

  const reset = () => {
    setType("comment");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setCaptchaToken(null);
    setServerError(null);
    setErrors({});
    setSuccess(false);
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!FEEDBACK_TYPES.includes(type)) errs.type = f.errorGeneric;
    if (subject.trim().length === 0) errs.subject = f.subjectLabel;
    if (message.trim().length < MESSAGE_MIN) errs.message = f.messageMinHint;
    if (message.length > MESSAGE_MAX) errs.message = f.errorGeneric;
    if (
      email.trim().length > 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      errs.email = f.emailLabel;
    }
    if (!turnstileSiteKey) {
      // Pas de cle configuree : on bloque l'envoi cote UI. La route
      // serveur refusera de toute facon sans token captcha.
      errs.captcha = f.configMissing;
    } else if (!captchaToken) {
      errs.captcha = f.errorCaptcha;
    }
    return errs;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await submitFeedback({
        type,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        pageUrl:
          initialPageUrl ??
          (typeof window !== "undefined"
            ? window.location.href
            : undefined),
        captchaToken: captchaToken!,
      });
      setSuccess(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : f.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center"
      >
        <h2 className="font-heading font-bold text-2xl text-green-800 mb-3">
          {f.successTitle}
        </h2>
        <p className="text-green-900/80 font-body mb-6">{f.successMessage}</p>
        <button
          type="button"
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-nuffle-gold text-nuffle-anthracite font-subtitle font-semibold hover:bg-nuffle-gold/90 transition-colors"
        >
          {f.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 bg-white rounded-xl border-2 border-nuffle-bronze/30 p-6 shadow-lg"
      aria-describedby="feedback-privacy"
    >
      {/* Type */}
      <fieldset className="space-y-2">
        <legend className="block font-subtitle font-semibold text-nuffle-anthracite mb-1">
          {f.typeLabel}
        </legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TYPES.map((t) => {
            const labels: Record<FeedbackType, string> = {
              bug: f.typeBug,
              remark: f.typeRemark,
              comment: f.typeComment,
            };
            const checked = type === t;
            return (
              <label
                key={t}
                className={`px-4 py-2 rounded-lg border-2 cursor-pointer text-sm font-subtitle transition-colors ${
                  checked
                    ? "bg-nuffle-gold border-nuffle-gold text-nuffle-anthracite"
                    : "bg-white border-nuffle-bronze/30 text-nuffle-anthracite/80 hover:border-nuffle-gold/60"
                }`}
              >
                <input
                  type="radio"
                  name="feedback-type"
                  value={t}
                  checked={checked}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {labels[t]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="feedback-name"
            className="block font-subtitle font-semibold text-nuffle-anthracite mb-1"
          >
            {f.nameLabel}
          </label>
          <input
            id="feedback-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder={f.namePlaceholder}
            className="w-full px-3 py-2 rounded-lg border border-nuffle-bronze/30 focus:border-nuffle-gold focus:ring-2 focus:ring-nuffle-gold/30 outline-none transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="feedback-email"
            className="block font-subtitle font-semibold text-nuffle-anthracite mb-1"
          >
            {f.emailLabel}
          </label>
          <input
            id="feedback-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={EMAIL_MAX}
            placeholder={f.emailPlaceholder}
            aria-invalid={!!errors.email}
            className="w-full px-3 py-2 rounded-lg border border-nuffle-bronze/30 focus:border-nuffle-gold focus:ring-2 focus:ring-nuffle-gold/30 outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="feedback-subject"
          className="block font-subtitle font-semibold text-nuffle-anthracite mb-1"
        >
          {f.subjectLabel}
        </label>
        <input
          id="feedback-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUBJECT_MAX}
          placeholder={f.subjectPlaceholder}
          aria-invalid={!!errors.subject}
          className="w-full px-3 py-2 rounded-lg border border-nuffle-bronze/30 focus:border-nuffle-gold focus:ring-2 focus:ring-nuffle-gold/30 outline-none transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="feedback-message"
          className="block font-subtitle font-semibold text-nuffle-anthracite mb-1"
        >
          {f.messageLabel}
        </label>
        <textarea
          id="feedback-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          placeholder={f.messagePlaceholder}
          aria-invalid={!!errors.message}
          aria-describedby="feedback-message-hint"
          className="w-full px-3 py-2 rounded-lg border border-nuffle-bronze/30 focus:border-nuffle-gold focus:ring-2 focus:ring-nuffle-gold/30 outline-none transition-colors"
        />
        <p
          id="feedback-message-hint"
          className="mt-1 text-xs text-nuffle-anthracite/60 font-body"
        >
          {f.messageMinHint} {message.length}/{MESSAGE_MAX}
        </p>
        {errors.message && (
          <p role="alert" className="mt-1 text-xs text-red-700 font-body">
            {errors.message}
          </p>
        )}
      </div>

      {/* Captcha */}
      <div>
        {turnstileSiteKey ? (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onVerify={handleVerify}
            onExpire={handleExpire}
            onError={handleCaptchaError}
          />
        ) : (
          <p
            role="alert"
            className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-3"
          >
            {f.configMissing}
          </p>
        )}
        {errors.captcha && (
          <p role="alert" className="mt-2 text-xs text-red-700 font-body">
            {errors.captcha}
          </p>
        )}
      </div>

      {serverError && (
        <p
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-lg p-3 font-body"
        >
          {serverError}
        </p>
      )}

      <p
        id="feedback-privacy"
        className="text-xs text-nuffle-anthracite/60 font-body italic"
      >
        {f.privacyNote}
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-6 py-3 rounded-lg bg-nuffle-gold text-nuffle-anthracite font-subtitle font-semibold hover:bg-nuffle-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? f.submitting : f.submit}
      </button>
    </form>
  );
}
