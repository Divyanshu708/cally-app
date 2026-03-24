const mediasoup = require("mediasoup");
const config = require("../config/mediasoupConfig");

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.router = null;
    this.peers = new Map(); // socketId -> { sendTransport, recvTransport, producers: { audio, video }, consumers }
  }

  async init() {
    const worker = await mediasoup.createWorker(config.workerSettings);
    const router = await worker.createRouter(config.routerOptions);
    this.router = router;

    worker.on("died", () => {
      console.error("Mediasoup worker died");
    });

    return this.router;
  }

  getRouterRtpCapabilities() {
    if (!this.router) return null;
    return this.router.rtpCapabilities;
  }

  async createWebRtcTransport(socketId, direction) {
    const transport = await this.router.createWebRtcTransport(
      config.webRtcTransportOptions
    );

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    transport.on("close", () => {
      const peer = this.peers.get(socketId);
      if (peer) {
        if (direction === "send" && peer.sendTransport === transport) {
          peer.sendTransport = null;
        } else if (direction === "recv" && peer.recvTransport === transport) {
          peer.recvTransport = null;
        }
      }
    });

    if (!this.peers.has(socketId)) {
      this.peers.set(socketId, {
        sendTransport: null,
        recvTransport: null,
        producers: {},
        consumers: {},
      });
    }

    const peer = this.peers.get(socketId);
    if (direction === "send") {
      peer.sendTransport = transport;
    } else {
      peer.recvTransport = transport;
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectWebRtcTransport(socketId, transportId, dtlsParameters) {
    const peer = this.peers.get(socketId);
    if (!peer) throw new Error("Peer not found");

    const transport =
      peer.sendTransport?.id === transportId
        ? peer.sendTransport
        : peer.recvTransport?.id === transportId
          ? peer.recvTransport
          : null;

    if (!transport) throw new Error("Transport not found");
    await transport.connect({ dtlsParameters });
  }

  async produce(socketId, transportId, kind, rtpParameters) {
    const peer = this.peers.get(socketId);
    if (!peer?.sendTransport || peer.sendTransport.id !== transportId) {
      throw new Error("Send transport not found");
    }

    const producer = await peer.sendTransport.produce({
      kind,
      rtpParameters,
      appData: { socketId },
    });

    producer.on("transportclose", () => {
      producer.close();
    });

    peer.producers[kind] = producer;
    return { id: producer.id };
  }

  async consume(socketId, producerId, rtpCapabilities) {
    const peer = this.peers.get(socketId);
    if (!peer?.recvTransport) {
      throw new Error("Recv transport not found");
    }

    const producer = this.getProducerById(producerId);
    if (!producer) {
      throw new Error("Producer not found");
    }

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Cannot consume");
    }

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    consumer.on("transportclose", () => {
      consumer.close();
    });

    consumer.on("producerclose", () => {
      consumer.close();
    });

    const producerSocketId = producer?.appData?.socketId;

    if (!peer.consumers[producerSocketId]) {
      peer.consumers[producerSocketId] = {};
    }
    peer.consumers[producerSocketId][consumer.kind] = consumer;

    await consumer.resume();

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerSocketId,
    };
  }

  getProducerById(producerId) {
    for (const peer of this.peers.values()) {
      for (const kind of ["audio", "video"]) {
        const p = peer.producers[kind];
        if (p?.id === producerId) return p;
      }
    }
    return null;
  }

  getProducersForPeer(excludeSocketId, getDisplayName) {
    const producers = [];
    for (const [socketId, peer] of this.peers) {
      if (socketId === excludeSocketId) continue;
      const displayName = typeof getDisplayName === "function" ? getDisplayName(socketId) : "User";
      for (const kind of ["audio", "video"]) {
        const p = peer.producers[kind];
        if (p) producers.push({ producerId: p.id, kind, socketId, displayName });
      }
    }
    return producers;
  }

  async closeProducer(socketId, producerId) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    for (const kind of ["audio", "video"]) {
      if (peer.producers[kind]?.id === producerId) {
        peer.producers[kind].close();
        delete peer.producers[kind];
        return;
      }
    }
  }

  async pauseProducer(socketId, producerId) {
    const producer = this.getProducerById(producerId);
    if (producer) await producer.pause();
  }

  async resumeProducer(socketId, producerId) {
    const producer = this.getProducerById(producerId);
    if (producer) await producer.resume();
  }

  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (peer) {
      if (peer.sendTransport) peer.sendTransport.close();
      if (peer.recvTransport) peer.recvTransport.close();
      for (const p of Object.values(peer.producers)) p?.close();
      for (const socketConsumers of Object.values(peer.consumers)) {
        for (const c of Object.values(socketConsumers)) c?.close();
      }
      this.peers.delete(socketId);
    }
  }

  /**
   * Drop mediasoup state for sockets that are no longer in the Socket.io room.
   * Fixes zombie peers after refresh/navigation when disconnect runs too late.
   */
  pruneStalePeers(liveSocketIds) {
    const live =
      liveSocketIds instanceof Set ? liveSocketIds : new Set(liveSocketIds);
    for (const socketId of [...this.peers.keys()]) {
      if (!live.has(socketId)) {
        this.removePeer(socketId);
      }
    }
  }

  isEmpty() {
    return this.peers.size === 0;
  }

  close() {
    if (this.router) {
      this.router.close();
      this.router = null;
    }
    this.peers.clear();
  }
}

module.exports = Room;
