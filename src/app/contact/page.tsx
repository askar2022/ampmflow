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
          Contact AMPM Flow
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          Leave a message for the AMPM Flow administrator at
          askar@automationllc.com. Schools cannot add themselves. Only the
          AMPM Flow administrator can add a school.
        </p>
        {sent === "1" ? (
          <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-navy">
            Your message was sent to AMPM Flow. The administrator will follow
            up if a school should be set up.
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
