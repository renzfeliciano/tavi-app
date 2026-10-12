import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaStage } from "./cta-stage";

// The closing card. Its scene plays by itself; when someone comes to the button
// (or reaches it with a keyboard, or presses it) the Stamp comes down on the
// statement at once, as if answering them, and the scene then carries on.

const mount = () =>
  render(
    <CtaStage className="card" scene={<div className="home-cta-stamp" data-testid="scene" />}>
      <p>Send your first quotation today</p>
      <a href="/sign-up">
        <span>Create an account</span>
      </a>
    </CtaStage>,
  );
const hit = () => document.querySelector(".home-cta-hit");

describe("CtaStage", () => {
  it("shows its words and its scene, and the scene is not answering anything yet", () => {
    mount();

    expect(screen.getByText("Send your first quotation today")).toBeInTheDocument();
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    expect(hit()).toBeNull();
  });

  it("answers a pointer coming to the button, even onto something inside it", () => {
    mount();

    fireEvent.pointerOver(screen.getByText("Create an account"));

    expect(hit()).not.toBeNull();
    expect(hit()).toContainElement(screen.getByTestId("scene"));
  });

  it("does not start again while the pointer only moves about inside the button", () => {
    mount();
    fireEvent.pointerOver(screen.getByRole("link"));
    hit()!.classList.add("marker");

    fireEvent.pointerOver(screen.getByText("Create an account"), { relatedTarget: screen.getByRole("link") });

    expect(hit()).toHaveClass("marker");
  });

  it("answers the keyboard reaching the button, and a press on it", () => {
    mount();
    fireEvent.focus(screen.getByRole("link"));
    expect(hit()).not.toBeNull();

    hit()!.classList.remove("home-cta-hit");
    fireEvent.pointerDown(screen.getByRole("link"));
    expect(hit()).not.toBeNull();
  });

  it("does not answer a pointer anywhere else on the card", () => {
    mount();

    fireEvent.pointerOver(screen.getByText("Send your first quotation today"));

    expect(hit()).toBeNull();
  });

  it("lets the scene carry on by itself once the Stamp has come down", () => {
    mount();
    fireEvent.pointerOver(screen.getByRole("link"));
    const answer = new Event("animationend", { bubbles: true });
    Object.assign(answer, { animationName: "home-cta-stamp-hit" });

    screen.getByTestId("scene").dispatchEvent(answer);

    expect(hit()).toBeNull();
  });
});
