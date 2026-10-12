import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseSidebarState,
  SHELL_ID,
  SIDEBAR_COOKIE,
  SIDEBAR_STORAGE_KEY,
  setSidebarState,
  toggleSidebar,
  useRememberedSidebar,
  useSidebarCollapsed,
  useSidebarShortcut,
} from "./sidebar-state";

let shell: HTMLDivElement;
beforeEach(() => {
  shell = document.createElement("div");
  shell.id = SHELL_ID;
  shell.dataset.sidebar = "expanded";
  document.body.append(shell);
  window.localStorage.clear();
  document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
});
afterEach(() => shell.remove());

describe("sidebar state", () => {
  it("reads anything but 'collapsed' as expanded", () => {
    expect(parseSidebarState("collapsed")).toBe("collapsed");
    expect(parseSidebarState("expanded")).toBe("expanded");
    expect(parseSidebarState("nonsense")).toBe("expanded");
    expect(parseSidebarState(undefined)).toBe("expanded");
  });

  it("sets the page attribute and remembers it in storage and the cookie", () => {
    setSidebarState("collapsed");
    expect(shell.dataset.sidebar).toBe("collapsed");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=collapsed`);
  });

  it("tells components when it changes, and toggles", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current).toBe(false);
    act(() => toggleSidebar());
    expect(result.current).toBe(true);
    act(() => toggleSidebar());
    expect(result.current).toBe(false);
  });

  it("follows what the device remembers when the cookie says otherwise", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderHook(() => useRememberedSidebar());
    expect(shell.dataset.sidebar).toBe("collapsed");
  });

  it("leaves the page alone when nothing is remembered", () => {
    renderHook(() => useRememberedSidebar());
    expect(shell.dataset.sidebar).toBe("expanded");
  });

  it("toggles with Ctrl+B and ⌘B, and with nothing else", () => {
    renderHook(() => useSidebarShortcut());
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(shell.dataset.sidebar).toBe("collapsed");
    fireEvent.keyDown(window, { key: "B", metaKey: true });
    expect(shell.dataset.sidebar).toBe("expanded");
    fireEvent.keyDown(window, { key: "b" });
    fireEvent.keyDown(window, { key: "b", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    expect(shell.dataset.sidebar).toBe("expanded");
  });
});
