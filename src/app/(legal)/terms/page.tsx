import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalList, LegalSection } from "@/components/legal/legal-document";
import { brand } from "@/config/brand";
import { LEGAL, LEGAL_PATHS, legalDetail } from "@/config/legal";

export const metadata: Metadata = { title: "Terms of Service" };

// Terms of Service, including the data processing terms that make Tavi a
// personal information processor for each business (RA 10173 Sec. 14; IRR
// Sec. 44). Bump LEGAL.version when this changes materially. To be reviewed
// by a lawyer before launch.

export default function TermsPage() {
  const { operator, jurisdiction } = LEGAL;
  const privacyEmail = legalDetail(operator.privacyEmail);
  const name = brand.name;

  return (
    <LegalDocument
      title="Terms of Service"
      intro={
        <p>
          These terms are the agreement between you and {legalDetail(operator.name)} (&ldquo;we&rdquo;), who run{" "}
          {name}. By creating an account you agree to them. Please also read the{" "}
          <Link href={LEGAL_PATHS.privacy} className="font-medium underline underline-offset-4">
            Privacy Notice
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="Using Tavi">
        <LegalList>
          <li>You must be at least 18, and able to agree to these terms for yourself and for your business.</li>
          <li>
            Give accurate details, keep your password to yourself, and tell us at{" "}
            <span className="font-medium">{privacyEmail}</span> if you think someone else has used your account. You
            are responsible for what happens in your account.
          </li>
          <li>
            {name} is in an early, free version. Features may change, and we don&apos;t promise it will always be
            available. We won&apos;t charge you anything without telling you first and asking you to agree.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your business's information">
        <p>
          What you put in {name} stays yours. You allow us to store, process and show it only as needed to run {name}{" "}
          for you: for example, to build your documents, send the emails you ask for and show your customers the
          documents you share with them.
        </p>
        <p>
          Keep your own copies of important documents (you can download PDFs of each one). We keep backups, but{" "}
          {name} shouldn&apos;t be your only record.
        </p>
      </LegalSection>

      <LegalSection title="Documents, tax and payments">
        <LegalList>
          <li>
            You are responsible for what your documents say, for the taxes on them, and for meeting the tax and
            invoicing rules that apply to your business. {name} gives no tax, accounting or legal advice.
          </li>
          <li>
            Unless you have registered {name} with your tax authority and entered that registration in Settings, the
            bills {name} makes are not official invoices or receipts. Quotes, those bills and payment acknowledgements
            are supplementary documents.
          </li>
          <li>
            {name} doesn&apos;t handle money. When you record a payment, you&apos;re recording one you received
            yourself.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Customer links">
        <p>
          Anyone who has a document&apos;s link can open it, so share links only with the people they&apos;re meant
          for. Revising or cancelling a quote closes its old links, and links stop working some time after a quote
          expires or a bill is paid.
        </p>
      </LegalSection>

      <LegalSection title="What you can't do">
        <p>Don&apos;t use {name} to:</p>
        <LegalList>
          <li>break the law, or help anyone else to;</li>
          <li>deceive people, for example with fake documents or by pretending to be another business;</li>
          <li>send spam or emails people didn&apos;t expect from you;</li>
          <li>upload anything harmful, or anything you don&apos;t have the right to use;</li>
          <li>get around limits or security, access other businesses&apos; information, or overload the service.</li>
        </LegalList>
        <p>
          We may limit, suspend or close an account that breaks these rules or puts other people at risk. Where we
          can, we&apos;ll tell you first and give you a chance to fix it.
        </p>
      </LegalSection>

      <LegalSection title="Processing your customers' personal information">
        <p>
          When your business keeps information about its customers in {name}, your business is the personal
          information controller and we are its personal information processor under the {jurisdiction.privacyLaw}.
          For that information:
        </p>
        <LegalList>
          <li>
            We process it only to provide {name} to you and on your instructions, which are what you do in the app.
          </li>
          <li>
            Everyone who works on {name} keeps it confidential, and we protect it as described in the Privacy Notice.
          </li>
          <li>
            We use the service providers listed in the Privacy Notice, under obligations that protect the information
            at least as well as these terms. We&apos;ll update that list before adding or changing one, and if you
            object you may close your account.
          </li>
          <li>
            We&apos;ll help you answer requests from your customers about their information, and help you meet your
            other obligations under the law.
          </li>
          <li>
            If we learn of a breach affecting it, we&apos;ll tell you without undue delay, with what you need to notify
            the {jurisdiction.regulator} and the people affected within {jurisdiction.breachNotificationHours} hours.
          </li>
          <li>
            You can download a copy of it at any time. When you close your account, we keep it, out of use, only for
            as long as the law requires you to keep your records, then delete it.
          </li>
          <li>
            We&apos;ll give you the information you reasonably need to show that this processing complies with the
            law.
          </li>
        </LegalList>
        <p>
          On your side, you&apos;re responsible for having a lawful reason to collect your customers&apos; information,
          for telling them how you use it, and for entering only what you need.
        </p>
      </LegalSection>

      <LegalSection title="Closing your account">
        <p>
          You can close your account at any time in Settings, under Account and data; download your data there first
          if you want a copy. If other people still use a business you own, make one of them the owner first; you can
          also write to <span className="font-medium">{privacyEmail}</span>. We may close {name} or your account with
          reasonable notice, and we&apos;ll give you time to download your data first.
        </p>
      </LegalSection>

      <LegalSection title="Responsibility">
        <p>
          {name} is provided as it is. We work hard to keep it correct and available, but we can&apos;t promise it
          will be free of errors or interruptions. As far as the law allows, we aren&apos;t liable for indirect losses,
          such as lost profits or lost business, and nothing in these terms limits rights you have that the law
          doesn&apos;t allow to be limited.
        </p>
      </LegalSection>

      <LegalSection title="Changes and the law">
        <p>
          When these terms change, the date at the top changes too. If a change is significant, we&apos;ll tell you by
          email or in the app before it applies, and ask you to agree again where needed. These terms are governed by
          the laws of {jurisdiction.country}.
        </p>
        <p>
          Questions? Write to <span className="font-medium">{privacyEmail}</span>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
