import type { Metadata } from "next";
import { LaptopIcon, SmartphoneIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { listMyDevices, requireOrgContext, SESSION_POLICY } from "@/modules/identity";
import { describeDuration } from "@/shared/format/duration";
import { SignOutDeviceButton, SignOutOthersButton } from "./device-actions";

export const metadata: Metadata = { title: "Security" };

function DeviceIcon({ device }: { device: string }) {
  const Icon = /iPhone|Android|iPad/.test(device) ? SmartphoneIcon : LaptopIcon;
  return <Icon aria-hidden="true" className="size-4 text-muted-foreground" />;
}

export default async function SecurityPage() {
  const ctx = await requireOrgContext();
  const devices = await listMyDevices();
  // In the business's own locale and time zone.
  const dateTime = new Intl.DateTimeFormat(ctx.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.timezone,
  });
  const others = devices.filter((d) => !d.current).length;

  return (
    <>
      <PageHeader
        title="Security"
        description="Devices signed in to your account. Sign out any you don't recognise."
        actions={others > 0 && <SignOutOthersButton count={others} />}
      />

      <section aria-labelledby="devices-heading" className="mt-8">
        <h2 id="devices-heading" className="sr-only">
          Signed-in devices
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-3">
                <span className="mt-0.5">
                  <DeviceIcon device={d.device} />
                </span>
                <div className="grid gap-0.5">
                  <span className="font-medium">
                    {d.device}
                    {d.current && (
                      <span className="ml-2 rounded-full border border-stamp/30 bg-stamp-subtle px-2 py-0.5 text-xs font-medium text-stamp">
                        This device
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Last active {dateTime.format(d.lastActiveAt)} · Signed in {dateTime.format(d.signedInAt)}
                  </span>
                </div>
              </div>
              {!d.current && <SignOutDeviceButton sessionId={d.id} device={d.device} />}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Sessions end after {describeDuration(SESSION_POLICY.idleTimeoutSeconds)} without activity, and{" "}
          {describeDuration(SESSION_POLICY.absoluteLifetimeSeconds)} after signing in.
        </p>
      </section>
    </>
  );
}
