import Link from "next/link";
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
  let needsSchool = true;
  if (db.ok) {
    try {
      needsSchool = (await prisma.school.count()) === 0;
    } catch {
      needsSchool = true;
    }
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
    <LoginFrame>
      <div>
        <h2 className="text-xl font-semibold text-navy">Create account</h2>
        <p className="mt-1 text-sm text-[#7b8490]">
          Create your staff account. You do not need to add users in Supabase.
        </p>
        <div className="mt-6">
          <SetupForm error={message} showSchoolName={needsSchool} />
        </div>
        <p className="mt-5 text-center text-sm text-navy">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal hover:text-teal-deep">
            Sign in
          </Link>
        </p>
      </div>
    </LoginFrame>
  );
}
