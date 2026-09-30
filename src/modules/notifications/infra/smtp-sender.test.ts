import { describe, expect, it, vi } from "vitest";
import { createSmtpSender } from "./smtp-sender";

const message = { to: "maria@example.com", subject: "Verify your email", text: "Hello", html: "<p>Hello</p>" };
const options = {
  host: "smtp.gmail.com",
  port: 465,
  user: "tavi.notify@gmail.com",
  password: "abcd efgh ijkl mnop",
  from: "Tavi <tavi.notify@gmail.com>",
};

describe("createSmtpSender", () => {
  it("connects over TLS with the account and sends the message", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "1" }));
    const createTransport = vi.fn(() => ({ sendMail }));

    await createSmtpSender({ ...options, createTransport }).send(message);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "tavi.notify@gmail.com", pass: "abcd efgh ijkl mnop" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Tavi <tavi.notify@gmail.com>",
      to: "maria@example.com",
      subject: "Verify your email",
      text: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("uses STARTTLS on port 587", async () => {
    const createTransport = vi.fn(() => ({ sendMail: vi.fn(async () => ({})) }));
    await createSmtpSender({ ...options, port: 587, createTransport }).send(message);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }));
  });

  it("reports failures without the password", async () => {
    const createTransport = () => ({
      sendMail: async () => {
        throw Object.assign(new Error("Invalid login: 535 abcd efgh ijkl mnop rejected"), { responseCode: 535 });
      },
    });
    const sender = createSmtpSender({ ...options, createTransport });

    await expect(sender.send(message)).rejects.toThrow("SMTP send failed (535)");
    await expect(sender.send(message)).rejects.not.toThrow(/abcd efgh/);
  });

  it("sends as the business, with replies going to the business", async () => {
    const sendMail = vi.fn(async () => ({}));
    await createSmtpSender({ ...options, createTransport: () => ({ sendMail }) }).send({
      ...message,
      senderName: "Santos Aircon via Tavi",
      replyTo: "billing@santos.example",
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"Santos Aircon via Tavi" <tavi.notify@gmail.com>', replyTo: "billing@santos.example" }),
    );
  });
});
