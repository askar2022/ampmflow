import Link from "next/link";
import { redirect } from "next/navigation";
import { checkDatabase, prisma } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";
import { SetupForm } from "@/components/login/SetupForm";

export default async function CreateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; kind?: string }>;
}) {
  const { error, kind } = await searchParams;
  const db = await checkDatabase();
  if (!db.ok) {
    redirect("/login");
  }

  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    redirect("/login");
  }

  const firstAdmin = userCount === 0;
  const startNew = !firstAdmin && kind === "new";
  const message =
    error === "exists"
      ? "That email already has an account. Sign in instead."
      : error === "pending"
        ? "That email already has a request waiting for approval."
        : error === "setup"
          ? "School name, your name, email, and a password of at least 8 characters are required."
        : error === "no-school"
          ? "No school with that name. Check the spelling, or start a new school."
        : error === "school-exists"
          ? "That school is already on AMPM Flow. Request to join it instead."
        : error === "db"
          ? "The account could not be saved. Check the database connection and try again."
          : undefined;

  return (
    <LoginFrame variant="signup">
      <div>
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          {firstAdmin
            ? "Create account"
            : startNew
              ? "Start a new school"
              : "Join a school"}
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          {firstAdmin
            ? "Create your AMPM Flow administrator account."
            : startNew
              ? "This creates a separate school. You will not see Sankofa students, and they will not see yours."
              : "Ask to join a school that is already on AMPM Flow. That school’s administrator must approve you."}
        </p>
        {!firstAdmin ? (
          <div className="mt-3 flex gap-2 text-sm font-semibold">
            <Link
              href="/login/create"
              className={`rounded-full px-3 py-1.5 ${
                startNew ? "border border-line text-navy" : "bg-navy text-white"
              }`}
            >
              Join a school
            </Link>
            <Link
              href="/login/create?kind=new"
              className={`rounded-full px-3 py-1.5 ${
                startNew ? "bg-navy text-white" : "border border-line text-navy"
              }`}
            >
              Start a new school
            </Link>
          </div>
        ) : null}
        <div className="mt-3 short-h:mt-2.5">
          <SetupForm
            error={message}
            showSchoolName
            mode={
              firstAdmin ? "first-admin" : startNew ? "new-school" : "request"
            }
          />
        </div>
        <p className="mt-3 text-center text-sm text-navy">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal hover:text-teal-deep">
            Sign in
          </Link>
        </p>
      </div>
    </LoginFrame>
  );
}
