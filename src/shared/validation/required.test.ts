import { describe, expect, it } from "vitest";
import { firstInvalid, validateFields } from "./required";

const rules = [
  { name: "email", required: "Enter your email.", email: "Enter a valid email, like name@example.com." },
  { name: "password", required: "Enter your password." },
];

describe("validateFields", () => {
  it("asks for every empty required field, treating spaces as empty", () => {
    expect(validateFields({ email: "  ", password: "" }, rules)).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  it("flags an email that is not an address, once it has something in it", () => {
    expect(validateFields({ email: "juan@", password: "x" }, rules)).toEqual({
      email: "Enter a valid email, like name@example.com.",
    });
  });

  it("flags text that is shorter than the minimum, but not an empty field twice", () => {
    const withMin = [{ name: "password", required: "Enter a password.", tooShort: { min: 8, message: "Use at least 8 characters." } }];
    expect(validateFields({ password: "abc" }, withMin)).toEqual({ password: "Use at least 8 characters." });
    expect(validateFields({ password: "" }, withMin)).toEqual({ password: "Enter a password." });
    expect(validateFields({ password: "abcdefgh" }, withMin)).toEqual({});
  });

  it("flags a field that differs from the one it should repeat", () => {
    const again = [{ name: "confirm", required: "Type it again.", matches: { field: "password", message: "Those don't match." } }];
    expect(validateFields({ password: "abc", confirm: "abd" }, again)).toEqual({ confirm: "Those don't match." });
    expect(validateFields({ password: "abc", confirm: "abc" }, again)).toEqual({});
  });

  it("returns nothing when every field is fine", () => {
    expect(validateFields({ email: " juan@example.com ", password: "x" }, rules)).toEqual({});
  });

  it("leaves out fields it has no rule for", () => {
    expect(validateFields({ email: "a@b.co", password: "x", other: "" }, rules)).toEqual({});
  });
});

describe("firstInvalid", () => {
  it("names the first field with an error, in the order the rules list them", () => {
    expect(firstInvalid({ password: "Enter your password.", email: "Enter your email." }, rules)).toBe("email");
  });

  it("is undefined when there are no errors", () => {
    expect(firstInvalid({}, rules)).toBeUndefined();
  });
});
