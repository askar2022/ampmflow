import { LegalDoc } from "@/components/LegalDoc";

export default function TermsPage() {
  return (
    <LegalDoc title="Terms and Conditions" updated="November 6, 2026">
      <p>
        These Terms and Conditions govern use of AMPM Flow, operated by
        Powered by Automation, LLC (Dr. Askar). By signing in or using the
        service, your school, staff, or bus company agrees to these terms.
      </p>

      <h2 className="text-base font-semibold text-navy">The service</h2>
      <p>
        AMPM Flow helps schools manage student transportation and dismissal
        changes, notify families and staff, and share assignment updates with
        bus companies. Features may change as we improve the product.
      </p>

      <h2 className="text-base font-semibold text-navy">Accounts and access</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Accounts are for authorized school staff and bus company users only.
        </li>
        <li>
          Keep passwords private. You are responsible for activity under your
          account.
        </li>
        <li>
          Schools decide who may have access and what roles they receive.
        </li>
      </ul>

      <h2 className="text-base font-semibold text-navy">School responsibilities</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Enter and maintain accurate student, family, and transportation
          information.
        </li>
        <li>
          Use AMPM Flow in line with school policy and applicable student
          privacy rules.
        </li>
        <li>
          Confirm that parents/guardians may be contacted by email or text for
          transportation notices.
        </li>
      </ul>

      <h2 className="text-base font-semibold text-navy">Bus company use</h2>
      <p>
        Bus company users may view and update assignment information for
        schools they serve, and may send late-ride parent texts when that
        feature is enabled. SMS usage may be shown in the product for cost
        transparency.
      </p>

      <h2 className="text-base font-semibold text-navy">Acceptable use</h2>
      <p>
        Do not misuse the service, attempt unauthorized access, scrape or
        export data beyond your school’s needs, or use AMPM Flow for anything
        other than authorized transportation operations.
      </p>

      <h2 className="text-base font-semibold text-navy">Availability</h2>
      <p>
        We work to keep AMPM Flow available, but we do not guarantee
        uninterrupted service. Maintenance, outages, or third-party provider
        issues may occur.
      </p>

      <h2 className="text-base font-semibold text-navy">Disclaimer</h2>
      <p>
        AMPM Flow is a coordination tool. Schools and bus companies remain
        responsible for safe transportation decisions, routing, and compliance
        with their own policies and the law. The service is provided “as is”
        to the extent permitted by law.
      </p>

      <h2 className="text-base font-semibold text-navy">Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, Powered by Automation, LLC and
        Dr. Askar are not liable for indirect, incidental, or consequential
        damages arising from use of AMPM Flow. Our total liability for a claim
        related to the service is limited to fees paid for the service in the
        three months before the claim, if any.
      </p>

      <h2 className="text-base font-semibold text-navy">Privacy</h2>
      <p>
        How we handle information is described in our{" "}
        <a href="/privacy" className="font-semibold text-teal hover:text-teal-deep">
          Data Privacy
        </a>{" "}
        page.
      </p>

      <h2 className="text-base font-semibold text-navy">Changes</h2>
      <p>
        We may update these terms. The “Last updated” date will change when we
        do. Continued use after an update means you accept the revised terms.
      </p>

      <h2 className="text-base font-semibold text-navy">Contact</h2>
      <p>
        <a
          href="mailto:askar@automationllc.org"
          className="font-semibold text-teal hover:text-teal-deep"
        >
          askar@automationllc.org
        </a>
      </p>
    </LegalDoc>
  );
}
