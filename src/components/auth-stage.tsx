"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandMascot, type MascotExpression } from "@/components/brand/brand-mascot";
import type { MascotSize } from "@/components/brand/brand-mascot";

/**
 * What the sign-in form is doing, so the Stamp beside it can keep company.
 * Purely a personality layer: the form, its errors and its navigation never
 * wait on it, and everything it shows is also said in text.
 */
export type AuthStage = "idle" | "working" | "success" | "error";

/** How long the concerned look stays before settling back. */
const ERROR_LOOK_MS = 2800;

const MOOD: Record<AuthStage, MascotExpression> = {
  idle: "neutral",
  working: "waiting",
  success: "happy",
  error: "concerned",
};

type Value = { stage: AuthStage; setStage: (stage: AuthStage) => void };
const StageContext = createContext<Value>({ stage: "idle", setStage: () => undefined });

export function AuthStageProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<AuthStage>("idle");
  const timer = useRef<number | undefined>(undefined);

  const setStage = useCallback((next: AuthStage) => {
    window.clearTimeout(timer.current);
    setStageState(next);
    if (next === "error") timer.current = window.setTimeout(() => setStageState("idle"), ERROR_LOOK_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ stage, setStage }), [stage, setStage]);
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export const useAuthStage = () => useContext(StageContext);

/** The Stamp on the auth pages: calm, doesn't chase the pointer, and mirrors the form's stage. */
export function AuthMascot({ size }: { size: MascotSize }) {
  const { stage } = useAuthStage();
  return (
    <span data-stage={stage} className="auth-mascot inline-block">
      <BrandMascot expression={MOOD[stage]} size={size} follow={false} calm animated={stage === "success"} />
    </span>
  );
}
