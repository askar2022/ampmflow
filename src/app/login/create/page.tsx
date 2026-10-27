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
  if (kind === "new") {
    redirect("/schools");
  }

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
  const message =
    error === "exists"
      ? "That email already has an account. Sign in instead."
      : error === "pending"
        ? "That email already has a request waiting for approval."
        : error === "setup"
          ? firstAdmin
            ? "School name, your name, email, and a password of at least 8 characters are required."
            : "Your name, email, school name, and a password of at least 8 characters are required."
        : error === "no-school"
          ? "No school with that name. Check the spelling, or ask your administrator."
        : error === "db"
          ? "The account could not be saved. Check the database connection and try again."
          : undefined;

  return (
    <LoginFrame variant="signup">
      <div>
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          {firstAdmin ? "Create account" : "Join your school"}
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          {firstAdmin
            ? "Create your AMPM Flow administrator account."
            : "Type your school name exactly. Your school administrator must approve you before you can sign in. This does not open a new school."}
        </p>
        <div className="mt-3 short-h:mt-2.5">
          <SetupForm
            error={message}
            showSchoolName
            mode={firstAdmin ? "first-admin" : "request"}
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
