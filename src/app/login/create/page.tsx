import Link from "next/link";
import { redirect } from "next/navigation";
import { checkDatabase, prisma } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";
import { SetupForm } from "@/components/login/SetupForm";

export default async function CreateAccountPage({
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
  let needsSchool = true;
  try {
    userCount = await prisma.user.count();
    needsSchool = (await prisma.school.count()) === 0;
  } catch {
    redirect("/login");
  }

  if (userCount > 0) {
    redirect("/login");
  }

  const message =
    error === "exists"
      ? "That email already has an account. Sign in instead."
      : error === "setup"
        ? "Name, email, and a password of at least 8 characters are required."
        : error === "db"
          ? "The account could not be saved. Check the database connection and try again."
          : undefined;

  return (
    <LoginFrame variant="signup">
      <div>
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Create account
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          Create your AMPM Flow administrator account.
        </p>
        <div className="mt-3 short-h:mt-2.5">
          <SetupForm error={message} showSchoolName={needsSchool} />
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
