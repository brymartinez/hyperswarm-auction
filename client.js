const RPC = require("@hyperswarm/rpc");
const DHT = require("hyperdht");
const crypto = require("crypto");
const DataStore = require("./datastore");

/**
 * This acts as both RPC client and server.
 *
 * @class Client
 */
class Client {
  constructor() {}

  async init() {
    // resolved distributed hash table seed for key pair

    const datastore = new DataStore(
      `./db/rpc-client-${crypto.randomBytes(4).toString("hex")}`
    );

    await datastore.ready();

    let dhtSeed = (await hbee.get("dht-seed"))?.value;
    if (!dhtSeed) {
      // not found, generate and store in db
      dhtSeed = crypto.randomBytes(32);
      await datastore.set("dht-seed", dhtSeed);
    }

    // start distributed hash table, it is used for rpc service discovery
    const dht = new DHT({
      keyPair: DHT.keyPair(dhtSeed),
      bootstrap: [{ host: "127.0.0.1", port: 30001 }], // note boostrap points to dht that is started via cli
    });
    await dht.ready();

    // resolve rpc server seed for key pair
    let rpcSeed = (await hbee.get("rpc-seed"))?.value;
    if (!rpcSeed) {
      rpcSeed = crypto.randomBytes(32);
      await datastore.set("rpc-seed", rpcSeed);
    }
  }

  async startServer(rpcSeed, dht) {
    const rpc = new RPC({ seed: rpcSeed, dht });
    const rpcServer = rpc.createServer();
    await rpcServer.listen();
  }

  async startClient() {
    // TODO - Where to get serverPubKey
    // const respRaw = await rpc.request(serverPubKey, "ping", payloadRaw);
  }
}

module.exports = {
  Client,
};
