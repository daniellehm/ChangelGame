import { TEST_CLOCK_HEADER } from "@/lib/api/clock";
export { seededRounds } from "../helpers/seed";

export function get(path: string, now?: string): Request {
  return new Request(`http://localhost${path}`, { headers: now ? { [TEST_CLOCK_HEADER]: now } : {} });
}

export function post(path: string, body: unknown, now?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(now ? { [TEST_CLOCK_HEADER]: now } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
