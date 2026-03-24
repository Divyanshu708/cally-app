const os = require("os");

function getLocalNetworkIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return undefined;
}

const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;
console.log("Using announced IP:", announcedIp);
if (!announcedIp && process.env.NODE_ENV !== "production") {
  console.warn("MEDIASOUP_ANNOUNCED_IP not set. For mobile/PC video, set it to your machine's local IP (e.g. 192.168.1.x) in .env");
}

module.exports = {
  announcedIp,
  // Number of workers
  numWorkers: Object.keys(os.cpus()).length,
  // Worker settings
  workerSettings: {
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  },
  // Router settings
  routerOptions: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
      },
    ],
  },
  // WebRTC transport options (announcedIp for clients behind NAT)
  webRtcTransportOptions: {
    listenIps: [
      { ip: "0.0.0.0", announcedIp: announcedIp },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
  },
};
