import { describe, expect, it, vi } from "vitest";
import { createResendSender } from "./resend-sender";

const message = { to: "maria@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

describe("createResendSender", () => {
  it("posts the email to Resend with the API key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const sender = createResendSender({ apiKey: "re_test_key", from: "Tavi <notify@tavi.example>", fetch: fetchMock });

    await sender.send(message);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Tavi <notify@tavi.example>",
      to: ["maria@example.com"],
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("fails with the status code, never the API key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 422 }));
    const sender = createResendSender({ apiKey: "re_secret_key", from: "Tavi <n@t.example>", fetch: fetchMock });

    await expect(sender.send(message)).rejects.toThrow(/Resend rejected the email \(HTTP 422\)/);
    await expect(sender.send(message)).rejects.not.toThrow(/re_secret_key/);
  });

  it("sends as the business, with replies going to the business", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    await createResendSender({ apiKey: "re_k", from: "Tavi <notify@tavi.example>", fetch: fetchMock }).send({
      ...message,
      senderName: "Santos Aircon via Tavi",
      replyTo: "billing@santos.example",
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: '"Santos Aircon via Tavi" <notify@tavi.example>',
      reply_to: "billing@santos.example",
    });
  });
});
