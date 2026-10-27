import Link from "next/link";
import { redirect } from "next/navigation";
import { checkDatabase, prisma } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";
import { SetupForm } from "@/components/login/SetupForm";

export default async function NewSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

  if (userCount === 0) {
    redirect("/login");
  }

  const message =
    error === "exists"
      ? "That email already has an account. Sign in instead."
      : error === "pending"
        ? "That email already has a request waiting for approval."
        : error === "setup"
          ? "School name, your name, email, and a password of at least 8 characters are required."
        : error === "school-exists"
          ? "That school is already on AMPM Flow. Sign in or join your school."
        : error === "db"
          ? "The request could not be saved. Try again."
          : undefined;

  return (
    <LoginFrame variant="signup">
      <div>
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Request a new school
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          This is only for a school that is not on AMPM Flow yet. Staff at an
          existing school should sign in or join their school.
        </p>
        <div className="mt-3 short-h:mt-2.5">
          <SetupForm error={message} showSchoolName mode="new-school" />
        </div>
        <p className="mt-3 text-center text-sm text-navy">
          Already on AMPM Flow?{" "}
          <Link href="/login" className="font-medium text-teal hover:text-teal-deep">
            Sign in
          </Link>
          {" · "}
          <Link href="/login/create" className="font-medium text-teal hover:text-teal-deep">
            Join your school
          </Link>
        </p>
      </div>
    </LoginFrame>
  );
}
