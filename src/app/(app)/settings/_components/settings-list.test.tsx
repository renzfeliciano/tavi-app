import { render, screen, within } from "@testing-library/react";
import { BuildingIcon, UsersIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { SettingsList, type SettingsSection } from "./settings-list";

const sections: [SettingsSection, SettingsSection, SettingsSection] = [
  { href: "/settings/business" as const, title: "Business profile", description: "Logo, address and TIN.", icon: BuildingIcon, state: { text: "Add your TIN", tone: "todo" as const } },
  { href: "/settings/team" as const, title: "Team", description: "Invite the people who work with you.", icon: UsersIcon, state: { text: "3 people", tone: "info" as const } },
  { href: "/settings/account" as const, title: "Account and data", description: "Download a copy of your data.", icon: UsersIcon },
];

describe("SettingsList", () => {
  it("makes each row one link to its page, named by its title and purpose", () => {
    render(<SettingsList sections={sections} />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/settings/business", "/settings/team", "/settings/account"]);
    expect(links[0]).toHaveTextContent("Business profile");
    expect(links[0]).toHaveTextContent("Logo, address and TIN.");
  });

  it("shows a row's state beside its title, in words", () => {
    render(<SettingsList sections={sections} />);
    const [business, team, account] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(business).getByText("Add your TIN")).toBeInTheDocument();
    expect(within(team).getByText("3 people")).toBeInTheDocument();
    expect(within(account).queryByTestId("row-state")).not.toBeInTheDocument();
  });

  it("marks what needs doing and what is done with an icon as well as the words", () => {
    const { container } = render(
      <SettingsList
        sections={[
          { ...sections[0], state: { text: "Add your TIN", tone: "todo" } },
          { ...sections[1], state: { text: "Complete", tone: "done" } },
          { ...sections[2], state: { text: "3 rates", tone: "info" } },
        ]}
      />,
    );
    const states = Array.from(container.querySelectorAll("[data-testid=row-state]"));
    expect(states.map((s) => s.querySelector("svg") !== null)).toEqual([true, true, false]);
  });
});
