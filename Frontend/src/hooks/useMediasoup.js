import { useState, useEffect, useRef, useCallback } from "react";
import { Device } from "mediasoup-client";
import { socket } from "../services/socket";
import { getClientIceServers } from "../utils/iceServers";

export function useMediasoup(roomId, displayName) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState({}); // { socketId: { audio, video, displayName } }
  const [mediaError, setMediaError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [micOn, setMicOnState] = useState(true);
  const [cameraOn, setCameraOnState] = useState(true);

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef({});
  const streamRef = useRef(null);
  const pendingProducersRef = useRef([]);
  const failedConsumeRef = useRef(new Set());
  /** Bumps on each effect cleanup so stale async consume() cannot merge old remote peers. */
  const mediaSessionRef = useRef(0);

  const getLocalMediaStream = useCallback(async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const attempts = [
      {
        label: "preferred",
        constraints: {
          video: isMobile
            ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            : true,
          audio: true,
        },
      },
      {
        label: "generic",
        constraints: { video: true, audio: true },
      },
      {
        label: "audio-only",
        constraints: { video: false, audio: true },
      },
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
        console.log("[Media] getUserMedia success:", attempt.label);
        return stream;
      } catch (err) {
        lastError = err;
        console.warn("[Media] getUserMedia failed:", attempt.label, err?.name || err?.message);
      }
    }
    throw lastError || new Error("Failed to access camera/microphone");
  }, []);

  const consume = useCallback(
    async (transport, producerId, kind, producerSocketId, remoteDisplayName, sessionId) => {
      const dev = deviceRef.current;
      if (!dev) return;
      const rtpCapabilities = dev.rtpCapabilities;
      return new Promise((resolve, reject) => {
        socket.emit("consume", { roomId, producerId, rtpCapabilities }, async (res) => {
          try {
            if (mediaSessionRef.current !== sessionId) {
              resolve(null);
              return;
            }
            if (res?.error) {
              reject(new Error(res.error));
              return;
            }
            const params = res?.consumerParams;
            if (!params?.id || !params?.rtpParameters) {
              reject(new Error("Invalid consume response"));
              return;
            }
            const { id, rtpParameters } = params;
            const consumer = await transport.consume({
              id,
              producerId,
              kind,
              rtpParameters,
            });
            console.log("[Media] consumer created:", {
              producerId,
              consumerId: consumer?.id,
              kind,
              paused: consumer?.paused,
            });

            // Some environments keep the consumer paused unless explicitly resumed.
            try {
              await consumer.resume();
              console.log("[Media] consumer resumed:", {
                producerId,
                consumerId: consumer?.id,
                kind,
                paused: consumer?.paused,
              });
            } catch (e) {
              console.warn("[Media] consumer resume failed:", e?.message || e);
            }
            if (mediaSessionRef.current !== sessionId) {
              consumer.close();
              resolve(null);
              return;
            }
            if (!consumersRef.current[producerId]) consumersRef.current[producerId] = {};
            consumersRef.current[producerId][kind] = consumer;

            setRemoteTracks((prev) => {
              if (mediaSessionRef.current !== sessionId) return prev;
              const next = { ...prev };
              if (!next[producerSocketId]) next[producerSocketId] = { audio: null, video: null, displayName: remoteDisplayName };
              next[producerSocketId] = { ...next[producerSocketId], [kind]: consumer.track, displayName: remoteDisplayName };
              return next;
            });

            console.log("[Media] track attached to state:", {
              producerSocketId,
              producerId,
              kind,
              trackId: consumer?.track?.id,
              trackReadyState: consumer?.track?.readyState,
            });

            consumer.on("transportclose", () => {
              consumer.close();
              if (consumersRef.current[producerId]) delete consumersRef.current[producerId][kind];
            });
            consumer.on("producerclose", () => {
              consumer.close();
              if (consumersRef.current[producerId]) delete consumersRef.current[producerId][kind];
              setRemoteTracks((prev) => {
                if (mediaSessionRef.current !== sessionId) return prev;
                const next = { ...prev };
                if (next[producerSocketId]) {
                  next[producerSocketId] = { ...next[producerSocketId], [kind]: null };
                  if (!next[producerSocketId].audio && !next[producerSocketId].video) delete next[producerSocketId];
                }
                return next;
              });
            });
            resolve(consumer);
          } catch (err) {
            reject(err);
          }
        });
      });
    },
    [roomId]
  );

  useEffect(() => {
    if (!roomId) return;

    mediaSessionRef.current += 1;
    const sessionId = mediaSessionRef.current;
    setRemoteTracks({});
    const iceServers = getClientIceServers();

    let cancelled = false;
    let pollInterval;

    const run = async () => {
      try {
        if (!socket.connected) {
          await new Promise((resolve) => {
            if (socket.connected) return resolve();
            socket.once("connect", resolve);
          });
        }
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        await new Promise((r) => setTimeout(r, 250));

        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const stream = await getLocalMediaStream();
        if (cancelled || mediaSessionRef.current !== sessionId) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
        setMediaError(null);

        const dev = await new Promise((resolve, reject) => {
          socket.emit("getRouterRtpCapabilities", { roomId }, (res) => {
            if (res.error) {
              reject(new Error(res.error));
              return;
            }
            const d = new Device();
            d.load({ routerRtpCapabilities: res.rtpCapabilities })
              .then(() => {
                deviceRef.current = d;
                resolve(d);
              })
              .catch(reject);
          });
        });
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const sendTrans = await new Promise((resolve, reject) => {
          socket.emit("createWebRtcTransport", { roomId, direction: "send" }, async (res) => {
            if (res.error) {
              reject(new Error(res.error));
              return;
            }
            const transport = dev.createSendTransport({
              ...res.transportOptions,
              iceServers,
            });
            transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
              socket.emit("connectWebRtcTransport", { roomId, transportId: transport.id, dtlsParameters }, (cbRes) => {
                if (cbRes.error) errback(new Error(cbRes.error));
                else callback();
              });
            });
            transport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
              socket.emit("produce", { roomId, transportId: transport.id, kind, rtpParameters }, (res) => {
                if (res.error) errback(new Error(res.error));
                else callback({ id: res.producerId });
              });
            });
            sendTransportRef.current = transport;
            resolve(transport);
          });
        });
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        const preferredVideoCodec =
          dev?.rtpCapabilities?.codecs?.find(
            (c) => c.kind === "video" && c.mimeType?.toLowerCase() === "video/h264"
          ) ||
          dev?.rtpCapabilities?.codecs?.find(
            (c) => c.kind === "video" && c.mimeType?.toLowerCase() === "video/vp8"
          );

        const produceTrack = async (track, kind) => {
          if (!track || track.readyState === "ended" || cancelled) return;
          const produceOptions = { track, appData: { kind } };
          if (kind === "video" && preferredVideoCodec) {
            produceOptions.codec = preferredVideoCodec;
          }
          const prod = await sendTrans.produce(produceOptions);
          console.log("[Media] produced track:", kind, prod?.id);
          if (cancelled) {
            prod.close();
            return;
          }
          producersRef.current[kind] = prod;
          prod.on("transportclose", () => {
            prod.close();
            delete producersRef.current[kind];
          });
        };

        if (audioTrack) await produceTrack(audioTrack, "audio");
        if (cancelled || mediaSessionRef.current !== sessionId) return;
        if (videoTrack) await produceTrack(videoTrack, "video");
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const recvTrans = await new Promise((resolve, reject) => {
          socket.emit("createWebRtcTransport", { roomId, direction: "recv" }, async (res) => {
            if (res.error) {
              reject(new Error(res.error));
              return;
            }
            const transport = dev.createRecvTransport({
              ...res.transportOptions,
              iceServers,
            });
            transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
              socket.emit("connectWebRtcTransport", { roomId, transportId: transport.id, dtlsParameters }, (cbRes) => {
                if (cbRes.error) errback(new Error(cbRes.error));
                else callback();
              });
            });
            recvTransportRef.current = transport;
            resolve(transport);
          });
        });
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const fetchAndConsume = async (retries = 6) => {
          for (let attempt = 0; attempt < retries && !cancelled && mediaSessionRef.current === sessionId; attempt++) {
            const producers = await new Promise((resolve) => {
              socket.emit("getProducers", { roomId }, (res) => {
                resolve(res?.producers || []);
              });
            });
            if (mediaSessionRef.current !== sessionId) return;
            if (producers.length > 0) {
              for (const { producerId, kind, socketId: producerSocketId, displayName: remoteDisplayName } of producers) {
                if (cancelled || mediaSessionRef.current !== sessionId) break;
                try {
                  await consume(recvTrans, producerId, kind, producerSocketId, remoteDisplayName || "User", sessionId);
                } catch (e) {
                  console.error("Failed to consume", producerId, kind, e);
                }
              }
              return;
            }
            if (attempt < retries - 1) {
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        };
        await fetchAndConsume();
        if (cancelled || mediaSessionRef.current !== sessionId) return;

        const processPending = async () => {
          const transport = recvTransportRef.current;
          if (!transport || transport.closed) return;
          while (pendingProducersRef.current.length > 0) {
            const pending = pendingProducersRef.current.splice(0);
            for (const { producerId, kind, producerSocketId, remoteDisplayName } of pending) {
              if (failedConsumeRef.current.has(producerId)) continue;
              if (mediaSessionRef.current !== sessionId) return;
              try {
                await consume(transport, producerId, kind, producerSocketId, remoteDisplayName || "User", sessionId);
              } catch (e) {
                const msg = e?.message || "";
                if (msg === "Cannot consume" || msg === "Producer not found") failedConsumeRef.current.add(producerId);
              }
            }
          }
        };
        await processPending();

        let lastFailedClear = Date.now();
        pollInterval = setInterval(() => {
          if (cancelled || mediaSessionRef.current !== sessionId) return;
          const transport = recvTransportRef.current;
          if (!transport || transport.closed) return;
          if (Date.now() - lastFailedClear > 30000) {
            failedConsumeRef.current.clear();
            lastFailedClear = Date.now();
          }
          socket.emit("getProducers", { roomId }, async (res) => {
            if (mediaSessionRef.current !== sessionId) return;
            const producers = res?.producers || [];
            for (const { producerId, kind, socketId: producerSocketId, displayName: remoteDisplayName } of producers) {
              if (consumersRef.current[producerId]?.[kind]) continue;
              if (failedConsumeRef.current.has(producerId)) continue;
              try {
                await consume(transport, producerId, kind, producerSocketId, remoteDisplayName || "User", sessionId);
              } catch (e) {
                const msg = e?.message || "";
                if (msg === "Cannot consume" || msg === "Producer not found") {
                  failedConsumeRef.current.add(producerId);
                }
              }
            }
          });
        }, 2000);

        if (!cancelled && mediaSessionRef.current === sessionId) setIsReady(true);
      } catch (err) {
        if (!cancelled && mediaSessionRef.current === sessionId) {
          console.error("Mediasoup init error", err);
          const msg =
            err?.name === "NotAllowedError"
              ? "Camera/mic access denied. Allow permissions in browser settings."
              : err?.name === "NotReadableError"
                ? "Camera in use. Close other apps using the camera and try again."
                : err?.name === "InvalidStateError" || err?.message?.toLowerCase?.().includes("track ended")
                  ? "Media was interrupted. Please refresh and try again."
                  : err?.message?.toLowerCase?.().includes("secure")
                    ? "Camera requires secure HTTPS and trusted certificate on this device."
                  : window.location.protocol === "http:" && !window.location.hostname.includes("localhost")
                    ? "Camera requires HTTPS"
                    : err?.message || "Media error";
          setMediaError(msg);
        }
      }
    };

    run();

    const onNewProducer = async ({ producerId, kind, socketId: producerSocketId, displayName: remoteDisplayName }) => {
      if (mediaSessionRef.current !== sessionId) return;
      const transport = recvTransportRef.current;
      if (!transport || transport.closed) {
        pendingProducersRef.current.push({ producerId, kind, producerSocketId, remoteDisplayName });
        return;
      }
      if (failedConsumeRef.current.has(producerId)) return;
      try {
        await consume(transport, producerId, kind, producerSocketId, remoteDisplayName || "User", sessionId);
      } catch (e) {
        const msg = e?.message || "";
        if (msg === "Cannot consume" || msg === "Producer not found") failedConsumeRef.current.add(producerId);
        else console.error("Failed to consume new producer", e);
      }
    };

    const onProducerPaused = ({ producerId }) => {
      const cons = consumersRef.current[producerId];
      if (cons) {
        for (const c of Object.values(cons)) if (c && !c.closed) c.pause();
      }
    };

    const onProducerResumed = ({ producerId }) => {
      const cons = consumersRef.current[producerId];
      if (cons) {
        for (const c of Object.values(cons)) if (c && !c.closed) c.resume();
      }
    };

    const onUserLeft = ({ userId }) => {
      if (mediaSessionRef.current !== sessionId) return;
      setRemoteTracks((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on("newProducer", onNewProducer);
    socket.on("producerPaused", onProducerPaused);
    socket.on("producerResumed", onProducerResumed);
    socket.on("user-left", onUserLeft);

    return () => {
      cancelled = true;
      mediaSessionRef.current += 1;
      if (pollInterval) clearInterval(pollInterval);
      failedConsumeRef.current.clear();
      socket.off("newProducer", onNewProducer);
      socket.off("producerPaused", onProducerPaused);
      socket.off("producerResumed", onProducerResumed);
      socket.off("user-left", onUserLeft);
      const st = sendTransportRef.current;
      const rt = recvTransportRef.current;
      if (st) st.close();
      if (rt) rt.close();
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      for (const p of Object.values(producersRef.current)) p?.close();
      producersRef.current = {};
      for (const socketConsumers of Object.values(consumersRef.current)) {
        for (const c of Object.values(socketConsumers)) c?.close();
      }
      consumersRef.current = {};
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      deviceRef.current = null;
      setLocalStream(null);
      setRemoteTracks({});
      setIsReady(false);
    };
  }, [roomId, consume, getLocalMediaStream]);

  const setMicEnabled = useCallback(
    (enabled) => {
      setMicOnState(enabled);
      const p = producersRef.current.audio;
      if (!p || p.closed) return;
      if (enabled && p.paused) {
        p.resume();
        socket.emit("producerResume", { roomId, producerId: p.id });
      } else if (!enabled && !p.paused) {
        p.pause();
        socket.emit("producerPause", { roomId, producerId: p.id });
      }
    },
    [roomId]
  );

  const setCameraEnabled = useCallback(
    (enabled) => {
      setCameraOnState(enabled);
      const p = producersRef.current.video;
      if (!p || p.closed) return;
      if (enabled && p.paused) {
        p.resume();
        socket.emit("producerResume", { roomId, producerId: p.id });
      } else if (!enabled && !p.paused) {
        p.pause();
        socket.emit("producerPause", { roomId, producerId: p.id });
      }
    },
    [roomId]
  );

  const toggleMic = useCallback(() => {
    const p = producersRef.current.audio;
    if (!p || p.closed) return;
    const next = p.paused;
    setMicOnState(next);
    if (next) {
      p.resume();
      socket.emit("producerResume", { roomId, producerId: p.id });
    } else {
      p.pause();
      socket.emit("producerPause", { roomId, producerId: p.id });
    }
  }, [roomId]);

  const toggleCamera = useCallback(() => {
    const p = producersRef.current.video;
    if (!p || p.closed) return;
    const next = p.paused;
    setCameraOnState(next);
    if (next) {
      p.resume();
      socket.emit("producerResume", { roomId, producerId: p.id });
    } else {
      p.pause();
      socket.emit("producerPause", { roomId, producerId: p.id });
    }
  }, [roomId]);

  return {
    localStream,
    remoteTracks,
    mediaError,
    isReady,
    setMicEnabled,
    setCameraEnabled,
    toggleMic,
    toggleCamera,
    micOn: micOn,
    cameraOn: cameraOn,
  };
}
