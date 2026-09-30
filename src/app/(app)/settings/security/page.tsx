import type { Metadata } from "next";
import { LaptopIcon, SmartphoneIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { listMyDevices, requireOrgContext } from "@/modules/identity";
import { signOutDeviceAction, signOutOtherDevicesAction } from "./actions";

export const metadata: Metadata = { title: "Security" };

const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function DeviceIcon({ device }: { device: string }) {
  const Icon = /iPhone|Android|iPad/.test(device) ? SmartphoneIcon : LaptopIcon;
  return <Icon aria-hidden="true" className="size-4 text-muted-foreground" />;
}

export default async function SecurityPage() {
  await requireOrgContext();
  const devices = await listMyDevices();
  const others = devices.filter((d) => !d.current).length;

  return (
    <>
      <PageHeader
        title="Security"
        description="Devices signed in to your account. Sign out any you don't recognise."
        actions={
          others > 0 && (
            <form action={signOutOtherDevicesAction}>
              <Button type="submit" variant="outline">
                Sign out all other devices
              </Button>
            </form>
          )
        }
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
              {!d.current && (
                <form action={signOutDeviceAction}>
                  <input type="hidden" name="sessionId" value={d.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Sessions end after 7 days without activity, and 30 days after signing in.
        </p>
      </section>
    </>
  );
}
