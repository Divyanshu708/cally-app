// mediasoup-client uses WebRTC ICE servers to reach the router/peers.
// STUN helps with NAT discovery; TURN is required for many production networks.
//
// Configure TURN via Netlify/Vite env var:
//   VITE_ICE_SERVERS=[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function getClientIceServers() {
  const raw = import.meta.env?.VITE_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed) && parsed.length > 0)
      return [...DEFAULT_ICE_SERVERS, ...parsed];

    if (parsed && typeof parsed === "object") {
      // Support { servers: [...] } shape if you ever want it.
      const servers = Array.isArray(parsed.servers) ? parsed.servers : null;
      if (servers && servers.length > 0)
        return [...DEFAULT_ICE_SERVERS, ...servers];
    }
  } catch (e) {
    console.warn(
      "[ICE] VITE_ICE_SERVERS is not valid JSON. Using STUN only.",
      e,
    );
  }

  return DEFAULT_ICE_SERVERS;
}
