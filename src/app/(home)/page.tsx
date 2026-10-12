import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArchiveRestoreIcon,
  BanknoteIcon,
  BookUserIcon,
  CheckIcon,
  CoinsIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HandCoinsIcon,
  LinkIcon,
  ListChecksIcon,
  MailIcon,
  PencilLineIcon,
  QrCodeIcon,
  SmartphoneIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeMenu } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { LEGAL_PATHS } from "@/config/legal";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import { BackToTop } from "./back-to-top";
import { HoverStage } from "./hover-stage";
import { GUTTER, H2 } from "./sizes";
import { ActivityFeed } from "./activity-feed";
import { CtaScene } from "./cta-scene";
import { CtaStage } from "./cta-stage";
import { RestStage } from "./rest-stage";
import { CustomerPicture, PartPaymentPicture, RecycleBinPicture, ReportPicture, RevisionPicture, ScanToPayPicture } from "./rest-pictures";
import { SampleQuotation } from "./sample-quotation";
import { SectionStamp } from "./section-stamp";
import { SendStage } from "./send-stage";
import { StepsStage } from "./steps-stage";
import { HistoryPicture, LetterheadPicture, LinkTravelPicture, PesoPicture, PhoneTapPicture, RolesPicture } from "./strength-pictures";
import "./home.css";

// The public home: one page that says what Tavi does, shows its paper, and
// points to sign-up. Everything on it is true of the product today; there is
// no pricing, no customer count and no testimonial, because none exist yet
// (PRODUCT.md, "Evidence on Hand"). Names of documents and channels come from
// the market profile, so it reads the way the app does. It is the same page for
// everyone: nothing here reads the session.

/** Where a piece stands in a staggered entrance or reveal (home.css reads --d and --i). */
const place = (name: "--d" | "--i", n: number) => ({ [name]: n }) as CSSProperties;

export default function Home() {
  const market = MARKETS[DEFAULT_MARKET];
  const quote = market.documents.quote.singular;
  const invoice = market.documents.invoice.singular;

  const steps = [
    {
      title: `Make the ${quote.toLowerCase()}`,
      body: `Pick a customer, add your services or products, and the totals and taxes work themselves out.`,
    },
    {
      title: "Send it as a link",
      body: `Share it over ${market.shareChannels}, or by email. Your customer opens it on their phone, reads it, and approves it. No account, no app.`,
    },
    {
      title: "Get paid",
      body: `Turn the approved ${quote.toLowerCase()} into a ${invoice.toLowerCase()}, then record each payment as it comes in: cash, bank transfer, GCash or Maya.`,
    },
  ];

  const receipt = market.documents.receipt.singular;
  const channels = [
    {
      icon: <MailIcon aria-hidden="true" className="size-4.5" />,
      title: "Email it",
      body: "We email the link from you, with your own message and your payment QR codes. Replies go straight to your inbox.",
    },
    {
      icon: <FileDownIcon aria-hidden="true" className="size-4.5" />,
      title: "A PDF for your files",
      body: `Download a PDF of any ${quote.toLowerCase()}, ${invoice.toLowerCase()} or ${receipt.toLowerCase()}, with your letterhead, your totals and how to pay. Print it, or send it yourself.`,
    },
    {
      icon: <LinkIcon aria-hidden="true" className="size-4.5" />,
      title: "Or share the link",
      body: `Copy the link into ${market.shareChannels}. Your customer reads it on their phone and can approve or decline from there. You are told either way.`,
    },
  ];

  const more = [
    {
      icon: <HandCoinsIcon aria-hidden="true" className="size-5" />,
      picture: <PartPaymentPicture />,
      title: "Downpayments and part-payments",
      body: `Record each payment against the ${invoice.toLowerCase()}. The balance updates, and your customer can get an acknowledgement by email.`,
    },
    {
      icon: <QrCodeIcon aria-hidden="true" className="size-5" />,
      picture: <ScanToPayPicture />,
      title: "Scan to pay",
      body: "Add your payment QR codes once, like GCash, Maya or your bank's. They show on your documents, in the email and on the PDF.",
    },
    {
      icon: <FileSpreadsheetIcon aria-hidden="true" className="size-5" />,
      picture: <ReportPicture />,
      title: "Reports for your accountant",
      body: `Sales, payments and unpaid ${market.documents.invoice.plural.toLowerCase()}, downloaded as CSV.`,
    },
    {
      icon: <BookUserIcon aria-hidden="true" className="size-5" />,
      picture: <CustomerPicture />,
      title: "Customers and a price list",
      body: "Save the people you bill and the things you sell, so the next one is quicker to make.",
    },
    {
      icon: <PencilLineIcon aria-hidden="true" className="size-5" />,
      picture: <RevisionPicture />,
      title: "Revise without starting over",
      body: `Customer asks for a change? Reopen the ${quote.toLowerCase()}, update it and send it again. It keeps its number and shows its revision.`,
    },
    {
      icon: <ArchiveRestoreIcon aria-hidden="true" className="size-5" />,
      picture: <RecycleBinPicture />,
      title: "A recycle bin",
      body: "Deleted something by mistake? It waits in the recycle bin, so you can bring it back.",
    },
  ];

  const strengths = [
    { icon: SmartphoneIcon, title: "Made for your phone", picture: <PhoneTapPicture />, body: "Quote from the job site. Every screen is built for a phone first, then stretches to a desktop." },
    { icon: LinkIcon, title: "Nothing for customers to sign up to", picture: <LinkTravelPicture />, body: "They get a secure link to review, approve and see how to pay. That is all they need." },
    { icon: StoreIcon, title: "Your business comes first", picture: <LetterheadPicture />, body: "Your name and details lead on every document. Tavi is only a small line at the foot." },
    { icon: ListChecksIcon, title: "Records you can follow", picture: <HistoryPicture />, body: "Numbered documents, plain statuses, and a history of what changed and when, so nothing gets lost." },
    { icon: BanknoteIcon, title: "Built for the Philippines", picture: <PesoPicture />, body: "Pesos, VAT or non-VAT, your TIN on your documents, and the ways people really pay here." },
    { icon: UsersIcon, title: "Your team, with limits", picture: <RolesPicture />, body: "Invite people as owners, admins or members, and each sees and does only what their role allows." },
  ];

  // Where the footer sends people: the sections of this page, how to start, and the legal pages. Only real places.
  const footerLinks = [
    {
      label: "Product",
      links: [
        { name: "How it works", anchor: "#how-it-works" },
        { name: "Send it your way", anchor: "#send" },
        { name: "The rest of the job", anchor: "#rest" },
      ],
    },
    {
      label: "Get started",
      links: [
        { name: "Sign up", to: "/sign-up" },
        { name: "Sign in", to: "/sign-in" },
      ],
    },
    {
      label: "Legal",
      links: [
        { name: "Terms of Service", to: LEGAL_PATHS.terms },
        { name: "Privacy Notice", to: LEGAL_PATHS.privacy },
      ],
    },
  ] as const;
  const footerLink = "inline-flex items-center rounded-sm py-1 text-foreground underline-offset-4 transition-colors hover:text-primary-text hover:underline pointer-coarse:min-h-11";

  // Small pieces of the job that drift around the sample card: the paper, the money, the check. Decoration for a wide screen,
  // kept on the card's outer edges and clear of its caption, so they never sit on text.
  const chips = [
    { icon: FileTextIcon, where: "top-8 -left-12", depth: -16, tone: "text-info" },
    { icon: CoinsIcon, where: "top-[38%] -right-9", depth: 22, tone: "text-warning" },
    { icon: CheckIcon, where: "bottom-36 -left-11", depth: -26, tone: "text-stamp" },
  ];

  return (
    <HoverStage className="home-stage flex flex-1 flex-col overflow-x-clip">
      <div aria-hidden="true" className="home-aurora">
        <div className="home-grid" />
        <div className="home-blob" data-tone="violet">
          <span />
        </div>
        <div className="home-blob" data-tone="blue">
          <span />
        </div>
        <div className="home-blob" data-tone="warm">
          <span />
        </div>
      </div>
      {/* Stays in view as the page scrolls; its glass and edge fade in once the page moves (home.css). */}
      <header className="home-header sticky top-0 z-40">
        <div className={`${GUTTER} flex items-center justify-between gap-3 py-3 sm:py-4`}>
          <Link href="/" aria-label={`${brand.name} home`} className="inline-flex items-center gap-2.5 rounded-sm pointer-coarse:min-h-11">
            {/* The wordmark stands alone here; the Stamp signs the footer. */}
            <Wordmark size={28} />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeMenu />
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            {/* Below about 480px the header has no room for the Stamp, the name and both buttons; the hero's own button is right underneath. */}
            <Link href="/sign-up" className={buttonVariants({ className: "max-[479px]:hidden" })}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Close under the header, so on a desktop the first screen reaches the sample's Approved stamp. */}
        <section className={`${GUTTER} grid items-center gap-12 pt-6 pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-20`}>
          <div className="grid gap-6">
            <h1 className="home-rise font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl" style={place("--d", 0)}>
              Create. Send. <span className="home-underline text-primary-text">Get paid.</span>
            </h1>
            <p className="home-rise max-w-xl text-lg text-pretty text-muted-foreground" style={place("--d", 1)}>
              Make a {quote.toLowerCase()}, send it as a link over {market.shareChannels}, and get your customer&apos;s yes without
              them making an account. Then turn it into a {invoice.toLowerCase()} and record the payment.
            </p>
            <div className="home-rise flex flex-wrap gap-3" style={place("--d", 2)}>
              <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "home-gloss" })}>
                Create an account
              </Link>
              <a href="#how-it-works" className={buttonVariants({ size: "lg", variant: "outline" })}>
                See how it works
              </a>
            </div>
          </div>
          <div className="home-rise relative" style={place("--d", 3)}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
              {chips.map(({ icon: Icon, where, depth, tone }, index) => (
                <span key={where} className={`home-depth absolute ${where}`} style={{ "--depth": depth } as CSSProperties}>
                  <span className="home-chip grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-lg" style={place("--i", index)}>
                    <Icon className={`size-5 ${tone}`} />
                  </span>
                </span>
              ))}
            </div>
            <div className="home-tilt">
              <div className="home-float">
                <SampleQuotation documentName={quote} />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-t border-border">
          <div className={`${GUTTER} py-12 lg:py-16`}>
            <h2 className={`${H2} home-reveal pr-16 md:pr-0`}>From job to paid in three steps</h2>
            {/* The pictures play as little scenes while the Stamp hops from card to card (steps-stage.tsx). */}
            <StepsStage steps={steps} />
          </div>
        </section>

        <section id="send" className="border-t border-border bg-surface-sunken">
          <div className={`${GUTTER} py-12 lg:py-16`}>
            <h2 className={`${H2} home-reveal`}>Send it the way your customers read it</h2>
            <p className="home-reveal mt-3 max-w-2xl text-pretty text-muted-foreground">
              Every {quote.toLowerCase()}, {invoice.toLowerCase()} and {receipt.toLowerCase()} can go out three ways. Use whichever suits
              the customer.
            </p>
            {/* The three pictures play as little scenes while the Stamp walks from card to card (send-stage.tsx). */}
            <SendStage channels={channels} documentName={quote} />
          </div>
        </section>

        <section id="rest" className="scroll-mt-24 border-t border-border">
          {/* A Stamp that sleeps until someone looks, beside six rows that each play a small picture of their own (rest-stage.tsx). */}
          <RestStage
            title="And the rest of the job"
            intro={`What happens after the ${quote.toLowerCase()} goes out: getting paid, keeping your records straight, and fixing mistakes.`}
            rows={more}
            feed={<ActivityFeed quote={quote} invoice={invoice} />}
            className={`${GUTTER} grid gap-8 py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-16 lg:py-16`}
          />
        </section>

        <section className="home-band bg-primary text-primary-foreground">
          <div className={`${GUTTER} py-12 lg:py-16`}>
            <div className="flex items-end justify-between gap-4">
              <h2 className={`${H2} home-reveal`}>Simple software for the way small businesses work</h2>
              <SectionStamp expression="neutral" chip className="h-auto w-10 sm:w-12" />
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {strengths.map(({ icon: Icon, title, picture, body }, index) => (
                <li key={title} className="home-reveal-zoom home-lift grid content-start gap-4 rounded-xl border border-primary-foreground/25 p-4" style={place("--i", index % 3)}>
                  {picture}
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-1 pb-1">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary-foreground/15">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <h3 className="font-heading text-base font-semibold">{title}</h3>
                    <p className="col-span-2 text-sm text-pretty">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${GUTTER} py-12 lg:py-20`}>
          {/* The card is a document that is still owing: the Stamp lowers onto the statement beside the button, presses it Paid, and lifts (cta-scene.tsx); coming to the button sends it down at once (cta-stage.tsx). */}
          <CtaStage
            scene={<CtaScene invoice={invoice} />}
            className="home-cta home-reveal-pop grid items-center gap-10 rounded-2xl border border-stamp/25 bg-stamp-subtle px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14 lg:px-14 lg:py-14"
          >
            <div className="grid justify-items-center gap-5 text-center lg:justify-items-start lg:text-left">
              <h2 className={H2}>Send your first {quote.toLowerCase()} today</h2>
              <p className="max-w-lg text-pretty text-foreground">Create an account, add a customer, and send them a link.</p>
              {/* The same three moments as the sign-in screens: the last one is the point of it all, so it carries the check. */}
              <ol aria-label="What happens next" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-mono text-xs sm:text-sm lg:justify-start">
                {[`${quote} approved`, `${invoice} sent`, "Payment recorded"].map((moment, index, all) => {
                  const last = index === all.length - 1;
                  return (
                    <li key={moment} className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1.5 text-foreground">
                      <span
                        aria-hidden="true"
                        className={
                          last
                            ? "grid size-5 place-items-center rounded-full bg-stamp text-white"
                            : "grid size-5 place-items-center rounded-full border border-foreground/40 text-[0.65rem] tabular-nums"
                        }
                      >
                        {last ? <CheckIcon className="size-3" strokeWidth={3} /> : index + 1}
                      </span>
                      {moment}
                    </li>
                  );
                })}
              </ol>
              <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "home-gloss" })}>
                Create an account
              </Link>
            </div>
          </CtaStage>
        </section>
      </main>

      <footer id="page-end" className="border-t border-border bg-surface-sunken">
        <div className={`${GUTTER} grid gap-12 py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16 lg:py-16`}>
          <div className="grid content-start justify-items-start gap-5">
            {/* The Stamp signs the page: it presses its check once the footer is in view, and the line it carries is the hero's. The wordmark is the header's, so it is not repeated. */}
            <div className="flex items-end gap-4">
              <SectionStamp expression="happy" className="h-auto w-14 sm:w-16" />
              <p className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
                Create. Send. <span className="text-primary-text">Get paid.</span>
              </p>
            </div>
            <p className="max-w-sm text-sm text-pretty text-foreground">
              {market.documents.quote.plural}, {market.documents.invoice.plural.toLowerCase()} and payment records for small businesses.
            </p>
            <p className="max-w-sm text-xs text-pretty text-muted-foreground">
              {brand.name} helps you make and keep track of your documents. It does not give tax or accounting advice: check with
              your accountant what your business needs to issue.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {footerLinks.map(({ label, links }, index) => (
              <nav key={label} aria-label={label} className="home-reveal grid content-start gap-3" style={place("--i", index)}>
                <p aria-hidden="true" className="border-b border-border-strong pb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  {label}
                </p>
                <ul className="grid gap-1 text-sm">
                  {links.map((link) => (
                    <li key={link.name}>
                      {"anchor" in link ? (
                        <a href={link.anchor} className={footerLink}>
                          {link.name}
                        </a>
                      ) : (
                        <Link href={link.to} className={footerLink}>
                          {link.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="border-t border-border">
          {/* Both lines sit on the left: the Back to top button floats at the bottom right and would cover anything there. */}
          <p className={`${GUTTER} flex flex-wrap items-center gap-x-4 gap-y-1 py-4 text-xs text-muted-foreground md:pr-52`}>
            <span>
              © {new Date().getFullYear()} {brand.name}
            </span>
            <span>Built for small businesses in the Philippines</span>
          </p>
        </div>
      </footer>

      {/* On a phone the way in stays under the thumb once the first screen has gone by. */}
      <div className="home-dock sticky bottom-0 z-30 border-t border-border bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "home-gloss w-full" })}>
          Create an account
        </Link>
      </div>

      {/* Offered when the footer comes into view: back to the top, in the phone bar's free end or floating from the tablet up. */}
      <BackToTop watch="page-end" />
    </HoverStage>
  );
}
