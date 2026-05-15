type RoezanSendMessageInput = {
  phone: string;
  message: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  media?: string[];
};

export type RoezanSendMessageResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

function getRoezanConfig() {
  const apiKey = process.env.ROEZAN_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ROEZAN_API_KEY.");
  }

  return {
    apiKey,
    baseUrl:
      process.env.ROEZAN_API_BASE_URL?.replace(/\/$/, "") ??
      "https://app.roezan.com/api",
  };
}

export async function sendRoezanMessage(
  input: RoezanSendMessageInput,
): Promise<RoezanSendMessageResult> {
  const { apiKey, baseUrl } = getRoezanConfig();
  const response = await fetch(`${baseUrl}/integrations/message/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      phone: input.phone,
      message: input.message,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      email: input.email ?? "",
      media: input.media ?? [],
    }),
  });

  const text = await response.text();
  let data: unknown = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
