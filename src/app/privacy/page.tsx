import { LegalDoc } from "@/components/LegalDoc";

export default function PrivacyPage() {
  return (
    <LegalDoc title="Data Privacy" updated="November 6, 2026">
      <p>
        AMPM Flow (“we,” “us”) is operated by Powered by Automation, LLC
        (Dr. Askar). This page explains how we handle information when schools,
        staff, parents/guardians, and bus companies use AMPM Flow for student
        transportation and dismissal.
      </p>

      <h2 className="text-base font-semibold text-navy">Who this covers</h2>
      <p>
        School staff accounts, bus company accounts, and the student and family
        contact details schools enter so transportation changes can be
        processed and communicated.
      </p>

      <h2 className="text-base font-semibold text-navy">Information we process</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Staff and bus company account details (name, email, role, school).
        </li>
        <li>
          Student transportation records schools provide (name, grade,
          classroom/teacher, pickup and drop-off plans, bus/van assignment,
          daycare or alternate address when needed).
        </li>
        <li>
          Parent/guardian contact information used for email and text notices
          about transportation changes or late rides.
        </li>
        <li>
          Operational logs needed to run the service (for example, change
          history and late-alert send records).
        </li>
      </ul>

      <h2 className="text-base font-semibold text-navy">How we use it</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>To operate the school’s transportation and dismissal desk.</li>
        <li>
          To notify parents/guardians, teachers, coordinators, and the bus
          company about transportation changes or late buses/vans, as directed
          by the school’s workflow.
        </li>
        <li>To support school login, security, and service reliability.</li>
        <li>To answer support requests from authorized school contacts.</li>
      </ul>

      <h2 className="text-base font-semibold text-navy">Who can see school data</h2>
      <p>
        Each school’s student and family data is kept for that school’s use.
        School staff see what their role allows. Bus company users see the
        change and assignment information needed for the schools they serve.
        We do not sell student or family data.
      </p>

      <h2 className="text-base font-semibold text-navy">Service providers</h2>
      <p>
        We use trusted vendors to host the application, send email, and send
        text messages when a school or bus company triggers a notice. Those
        vendors process information only to provide their service to us.
      </p>

      <h2 className="text-base font-semibold text-navy">Retention</h2>
      <p>
        We keep account and transportation records while the school uses AMPM
        Flow and as needed for operations, dispute resolution, and legal
        requirements. Schools may ask us to archive or remove accounts and
        records they no longer need.
      </p>

      <h2 className="text-base font-semibold text-navy">Security</h2>
      <p>
        Access requires a school or bus company account. We use industry
        standard hosting and access controls. No system is perfectly secure; if
        you suspect unauthorized access, contact us right away.
      </p>

      <h2 className="text-base font-semibold text-navy">Children’s information</h2>
      <p>
        AMPM Flow is used by schools and authorized adults. Student information
        is entered by the school for transportation purposes, not collected
        directly from children for marketing.
      </p>

      <h2 className="text-base font-semibold text-navy">Your requests</h2>
      <p>
        Schools and authorized contacts may request access, correction, or
        removal of account information by emailing{" "}
        <a
          href="mailto:askar@automationllc.org"
          className="font-semibold text-teal hover:text-teal-deep"
        >
          askar@automationllc.org
        </a>
        . Parent questions about a child’s transportation record should go to
        the school first.
      </p>

      <h2 className="text-base font-semibold text-navy">Changes</h2>
      <p>
        We may update this page. The “Last updated” date will change when we
        do. Continued use of AMPM Flow after an update means the revised notice
        applies.
      </p>
    </LegalDoc>
  );
}
