import Link from "next/link";
import { LoginFrame } from "@/components/login/LoginFrame";
import { ContactForm } from "./ContactForm";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const message =
    error === "setup"
      ? "School name, your name, and a real email are required."
      : error === "db"
        ? "The message could not be saved. Try again."
        : undefined;

  return (
    <LoginFrame variant="signup">
      <div>
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Contact us to get started
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          Tell us about your school. This does not open an account. AMPM Flow
          reviews each request and sets the school up. You will get a private
          sign-in link when it is ready.
        </p>
        {sent === "1" ? (
          <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-navy">
            We received your message. Watch your email for a private sign-in
            link after the school is set up.
          </p>
        ) : (
          <div className="mt-3">
            <ContactForm error={message} />
          </div>
        )}
        <p className="mt-3 text-center text-sm text-navy">
          Already set up?{" "}
          <Link href="/login" className="font-medium text-teal hover:text-teal-deep">
            Sign in
          </Link>
        </p>
      </div>
    </LoginFrame>
  );
}
