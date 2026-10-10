/**
 * Feature flags: a handful of switches read from the environment, so a
 * feature can be turned off (or a rollout paused) without a deploy of new
 * code. Deliberately not a flag service. Anything that grants access or
 * registration is enforced on the server; hiding a button is never the check.
 *
 *   FEATURE_REGISTRATION=off        close sign-up (existing accounts keep working)
 *   FEATURE_MASCOT=off              no greeting, companion or sign-in reactions
 *   FEATURE_MASCOT_INSIGHTS=off     greeting stays, the "needs attention" notes go
 *
 * Planned, not built: registrationLimit, onlinePayments, extra invoice templates.
 */
export type FeatureFlags = {
  registrationEnabled: boolean;
  mascotEnabled: boolean;
  mascotInsightsEnabled: boolean;
};

const OFF = new Set(["off", "false", "0", "no"]);
const isOn = (value: string | undefined) => !(value !== undefined && OFF.has(value.trim().toLowerCase()));

export function readFeatureFlags(env: Record<string, string | undefined>): FeatureFlags {
  const mascotEnabled = isOn(env.FEATURE_MASCOT);
  return {
    registrationEnabled: isOn(env.FEATURE_REGISTRATION),
    mascotEnabled,
    // The companion is part of the mascot: switching the mascot off switches it off too.
    mascotInsightsEnabled: mascotEnabled && isOn(env.FEATURE_MASCOT_INSIGHTS),
  };
}

/** The flags for this process. Read per call so tests and `next dev` pick up changes. */
export const featureFlags = (): FeatureFlags => readFeatureFlags(process.env);
