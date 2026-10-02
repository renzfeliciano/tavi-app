import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal/legal-document";
import { brand } from "@/config/brand";
import { LEGAL, LEGAL_PATHS, legalDetail } from "@/config/legal";
import { SESSION_POLICY } from "@/modules/identity/client";
import { describeDuration } from "@/shared/format/duration";

export const metadata: Metadata = { title: "Privacy Notice" };

// The Privacy Notice for Tavi's own processing (RA 10173 Sec. 16(b), the
// right to be informed). What businesses do with their customers' data is
// covered by the data processing terms in the Terms of Service. Keep this in
// step with docs/compliance/processing-register.md, and bump LEGAL.version
// when it changes materially. To be reviewed by a lawyer before launch.

export default function PrivacyPage() {
  const { operator, jurisdiction } = LEGAL;
  const privacyEmail = legalDetail(operator.privacyEmail);
  const name = brand.name;

  return (
    <LegalDocument
      title="Privacy Notice"
      intro={
        <p>
          {name} is a quoting and invoicing app for small service businesses. This notice explains what personal
          information {name} collects, why, who it&apos;s shared with, how long it&apos;s kept, and the rights you have
          under the {jurisdiction.privacyLaw}.
        </p>
      }
    >
      <LegalSection title="Who we are">
        <p>
          {name} is run by {legalDetail(operator.name)}, {legalDetail(operator.address)} (&ldquo;we&rdquo;). We are the
          personal information controller for the information about people who use {name} and their accounts.
        </p>
        <p>
          Our data protection officer is {legalDetail(operator.dataProtectionOfficer)}. Write to{" "}
          <span className="font-medium">{privacyEmail}</span> with any question or request about your personal
          information.
        </p>
      </LegalSection>

      <LegalSection title="Two roles: your account, and your customers' information">
        <p>
          When you sign up, we decide how your account information is used, so this notice applies to it directly.
        </p>
        <p>
          When a business uses {name} to keep records about its own customers and send them quotes and bills, the
          business decides what to collect and why. For that information the business is the personal information
          controller and we process it only on its behalf, under the data processing terms in our{" "}
          <Link href={LEGAL_PATHS.terms}>Terms of Service</Link>. If you received a quote, bill or payment
          acknowledgement through {name}, the business that sent it is the one to ask first; we&apos;ll help it answer.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <LegalList>
          <li>
            <strong className="font-semibold">Your account:</strong> your name, email address, a hash of your password
            (never the password itself), whether you&apos;ve confirmed your email, and the version of these documents
            you agreed to and when.
          </li>
          <li>
            <strong className="font-semibold">Your sign-ins:</strong> for each signed-in device, its IP address,
            browser and sign-in times, so you can see and sign out your devices.
          </li>
          <li>
            <strong className="font-semibold">Your team:</strong> who belongs to which business and with what role,
            and the email address of anyone invited to join, which we use only to send the invitation.
          </li>
          <li>
            <strong className="font-semibold">Your business:</strong> what you enter in its profile, such as its name,
            registered name, tax identification number (TIN), address, contact details, logo, payment instructions and
            tax registration details.
          </li>
          <li>
            <strong className="font-semibold">Your business&apos;s records:</strong> customers, products and services,
            quotes, bills and payments. These usually contain your customers&apos; names, contact details, addresses and
            sometimes TINs (see the two roles above).
          </li>
          <li>
            <strong className="font-semibold">When a customer uses a link:</strong> when someone opens, approves or
            declines a quote, or views a bill, we record that it happened. An approval or decline also records the name
            typed, the IP address and the browser, as evidence of the decision.
          </li>
          <li>
            <strong className="font-semibold">Activity history:</strong> a record of important actions (for example
            &ldquo;quote sent&rdquo; or &ldquo;payment recorded&rdquo;), who did them and when, which can&apos;t be
            edited afterwards.
          </li>
          <li>
            <strong className="font-semibold">Emails:</strong> the emails {name} sends for you or to you, kept until
            they&apos;re delivered (see below).
          </li>
        </LegalList>
        <p>
          A TIN that belongs to an individual can be sensitive personal information under the law. It&apos;s
          processed because tax regulations require it on certain documents.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <LegalList>
          <li>
            To provide {name}: your account, your business&apos;s records, documents, links, PDFs and emails. This is
            needed to fulfil our agreement with you.
          </li>
          <li>
            To keep {name} secure: rate limits, checking new passwords against known data breaches, device lists, the
            activity history and error logs. This is our legitimate interest and yours.
          </li>
          <li>
            To understand whether {name} works for businesses, from counts of how far each business has got (for
            example, whether it has sent its first quote). We don&apos;t use advertising or tracking tools for this.
          </li>
          <li>To meet legal obligations, such as tax rules and lawful requests from authorities.</li>
        </LegalList>
        <p>
          We don&apos;t sell personal information, and we don&apos;t use it for advertising. {name} doesn&apos;t use
          artificial intelligence on your information.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          {name} uses one kind of cookie: the sign-in cookie that keeps you signed in. It&apos;s needed for the app to
          work. You&apos;re signed out after {describeDuration(SESSION_POLICY.idleTimeoutSeconds)} without activity,
          and asked to sign in again {describeDuration(SESSION_POLICY.absoluteLifetimeSeconds)} after signing in.
          There are no analytics, advertising or third-party cookies, and customer links set no cookies.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          We use these service providers to run {name}. Each one only handles information as needed to provide its
          service to us:
        </p>
        <LegalList>
          <li>
            <strong className="font-semibold">Vercel</strong> hosts the app. Its servers for {name} run in Singapore;
            Vercel, Inc. is based in the United States.
          </li>
          <li>
            <strong className="font-semibold">Neon</strong> hosts the database, on Amazon Web Services in Singapore.
          </li>
          <li>
            <strong className="font-semibold">Google (Gmail)</strong> delivers the emails {name} sends.
          </li>
          <li>
            <strong className="font-semibold">Have I Been Pwned</strong> checks new passwords against known breaches. It
            only receives the first five characters of a one-way hash of the password, never the password or your
            email.
          </li>
        </LegalList>
        <p>
          This means your information is stored and processed outside the Philippines. We remain responsible for it
          there. We&apos;ll update this list before adding or changing a provider.
        </p>
        <p>
          We also share information when the law requires it, and the documents you send are, of course, shared with
          the people you send them to.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalList>
          <li>Your account and your business&apos;s records: for as long as the account is open.</li>
          <li>
            After an account is closed: the person&apos;s name, email and sign-in are removed straight away. A closed
            business&apos;s records are kept, out of use, for as long as tax rules require it to keep its issued
            documents and payments, and then deleted; the activity history goes with them.
          </li>
          <li>
            Signed-in devices: until you sign out or the session ends. Rate-limit counters: up to a day. Emails:
            their content is deleted once they&apos;re delivered; the address and subject stay as a delivery record.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Connections are encrypted, passwords are stored only as strong one-way hashes, each business&apos;s records
          are kept separate and checked on every request, customer links are long random codes we store only in hashed
          form, and important actions are recorded in a history that can&apos;t be changed. If a personal data breach
          puts people at real risk, we&apos;ll notify the {jurisdiction.regulator} and the people affected within{" "}
          {jurisdiction.breachNotificationHours} hours of learning of it, as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under the {jurisdiction.privacyLaw}, you have the right to:</p>
        <LegalList>
          <li>be informed about how your personal information is used (this notice);</li>
          <li>access it and get a copy;</li>
          <li>correct it if it&apos;s wrong or incomplete;</li>
          <li>object to its processing, and have it erased or blocked where the law allows;</li>
          <li>receive it in a commonly used electronic format (data portability);</li>
          <li>be compensated for damages caused by inaccurate or unlawfully used information; and</li>
          <li>
            file a complaint with the {jurisdiction.regulator} (
            <a href={jurisdiction.regulatorUrl} rel="noopener noreferrer" target="_blank">
              privacy.gov.ph<span className="sr-only"> (opens in a new tab)</span>
            </a>
            ).
          </li>
        </LegalList>
        <p>
          You can correct your name and your business&apos;s details, download a copy of your business&apos;s data,
          and close your account yourself, in {name}&apos;s Settings under Account and data. For anything else, write
          to <span className="font-medium">{privacyEmail}</span>. We may need to confirm it&apos;s you before acting on
          a request.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>{name} is for businesses and isn&apos;t meant for anyone under 18.</p>
      </LegalSection>

      <LegalSection title="Changes to this notice">
        <p>
          When this notice changes, the date at the top changes too. If a change affects how your information is
          used in a meaningful way, we&apos;ll tell you by email or in the app before it applies, and ask you to agree
          again where needed.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
