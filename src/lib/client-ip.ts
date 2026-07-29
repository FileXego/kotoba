import { isIP } from "node:net";

function isLoopback(address: string) {
  return address === "::1"
    || address === "::ffff:127.0.0.1"
    || address.startsWith("127.");
}

export function resolveClientIp(request: Request, peerAddress: string | null | undefined) {
  if (!peerAddress) return "unknown";
  if (!isLoopback(peerAddress)) return peerAddress;

  const proxiedAddress = request.headers.get("x-real-ip")?.trim();
  if (proxiedAddress && isIP(proxiedAddress) !== 0) return proxiedAddress;
  return peerAddress;
}
