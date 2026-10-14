import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SaveBar, useFormDirty } from "./save-bar";

describe("SaveBar", () => {
  it("says when there are changes waiting to be saved", () => {
    render(<SaveBar dirty saved={false} pending={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("says when everything has been saved", () => {
    render(<SaveBar dirty={false} saved pending={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved");
  });

  it("stays plain before anything has been changed", () => {
    render(<SaveBar dirty={false} saved={false} pending={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes yet");
  });

  it("has a save button that is never disabled, so a first save works without an edit", () => {
    render(<SaveBar dirty={false} saved={false} pending={false} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("takes the form's own wording for the button and while saving", () => {
    render(<SaveBar dirty saved={false} pending label="Save and turn on invoice mode" pendingLabel="Turning on…" />);
    const button = screen.getByRole("button", { name: /Turning on…/ });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("can belong to a form elsewhere on the page, so it can sit as high in the page as the form's fields reach", () => {
    render(<SaveBar dirty saved={false} pending={false} form="profile-form" />);
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute("form", "profile-form");
  });

  it("holds other actions beside the save button", () => {
    render(
      <SaveBar dirty={false} saved={false} pending={false}>
        <button type="button">Turn off</button>
      </SaveBar>,
    );
    expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument();
  });

  it("sticks to the bottom of the screen above the phone's tab bar, in ink colours only", () => {
    const { container } = render(<SaveBar dirty saved={false} pending={false} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("bottom-[calc(4.5rem+env(safe-area-inset-bottom))]");
    expect(bar.className).not.toMatch(/gradient|animate-|#[0-9a-f]{3,6}/);
  });
});

describe("useFormDirty", () => {
  it("is clean until the form is edited, and clean again after the next save", () => {
    const { result, rerender } = renderHook(({ key }) => useFormDirty(key), { initialProps: { key: 0 } });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.formProps.onChange());
    expect(result.current.dirty).toBe(true);
    rerender({ key: 1 });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.formProps.onInput());
    expect(result.current.dirty).toBe(true);
  });

  it("notices typing in a field inside a form it is spread on", () => {
    const { result } = renderHook(() => useFormDirty(0));
    render(
      <form {...result.current.formProps}>
        <input aria-label="Name" />
      </form>,
    );
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "x" } });
    expect(result.current.dirty).toBe(true);
  });
});
