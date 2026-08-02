import { GET as CronGet } from "@/app/api/cron/daily-news/route";
import { POST as WebhookPost } from "@/app/api/whatsapp/webhook/route";

const originalCronSecret = process.env.CRON_SECRET;
const originalMetaAppSecret = process.env.META_APP_SECRET;

function restoreEnvironmentVariable(
  name: string,
  originalValue: string | undefined,
): void {
  if (originalValue === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = originalValue;
}

afterEach(() => {
  restoreEnvironmentVariable("CRON_SECRET", originalCronSecret);
  restoreEnvironmentVariable("META_APP_SECRET", originalMetaAppSecret);
});

describe("API route security boundaries", () => {
  test("webhook returns 503 when Meta signature configuration is missing", async () => {
    delete process.env.META_APP_SECRET;

    const request = new Request(
      "http://localhost/api/whatsapp/webhook",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await WebhookPost(request);
    const payload = (await response.json()) as {
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("META_APP_SECRET_MISSING");
  });

  test("webhook rejects a request without a signature when configured", async () => {
    process.env.META_APP_SECRET = "integration-test-secret";

    const request = new Request(
      "http://localhost/api/whatsapp/webhook",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await WebhookPost(request);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Invalid signature");
  });

  test("cron returns 503 when cron configuration is missing", async () => {
    delete process.env.CRON_SECRET;

    const request = new Request(
      "http://localhost/api/cron/daily-news",
    );

    const response = await CronGet(request);
    const payload = (await response.json()) as {
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("CRON_NOT_CONFIGURED");
  });

  test("cron rejects a request without authorization when configured", async () => {
    process.env.CRON_SECRET = "integration-test-cron-secret";

    const request = new Request(
      "http://localhost/api/cron/daily-news",
    );

    const response = await CronGet(request);
    const payload = (await response.json()) as {
      code?: string;
    };

    expect(response.status).toBe(401);
    expect(payload.code).toBe("INVALID_CRON_CREDENTIAL");
  });
});