import { submitSchoolInquiry } from "@/app/actions/inquiries";
import { fieldClass, SubmitButton } from "@/components/login/SignInForm";

export function ContactForm({ error }: { error?: string }) {
  return (
    <form action={submitSchoolInquiry} className="space-y-3">
      <label className="block text-left text-sm font-medium text-navy">
        School you are asking about
        <input name="schoolName" required className={fieldClass} />
      </label>
      <label className="block text-left text-sm font-medium text-navy">
        Your name
        <input name="name" required className={fieldClass} />
      </label>
      <label className="block text-left text-sm font-medium text-navy">
        Email
        <input name="email" type="email" required className={fieldClass} />
      </label>
      <label className="block text-left text-sm font-medium text-navy">
        Note (optional)
        <textarea name="note" rows={3} className={fieldClass} />
      </label>
      <p role="alert" className="min-h-5 text-sm text-red">
        {error || "\u00a0"}
      </p>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
