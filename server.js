const DHT = require("hyperdht");
const { DataStore } = require("./datastore");
const Hyperswarm = require("hyperswarm");
const crypto = require("crypto");
const Logger = require("./logger");

/** @type {DataStore} */
let datastore;
/**
 * Acts as both the P2P server and holder of remote public keys.
 * Remote public keys are not accessible publicly, they are just transmitted via Hyperswarm.
 *
 * @class Server
 */
class Server {
  constructor() {
    datastore = new DataStore();
    this._connections = [];
  }

  async init() {
    await datastore.ready();

    let dhtSeed = await datastore.get("dht-seed");
    if (!dhtSeed) {
      // not found, generate and store in db
      dhtSeed = crypto.randomBytes(32);
      await datastore.set("dht-seed", dhtSeed);
    }

    DHT.bootstrapper(30001, "127.0.0.1");

    // start distributed hash table, it is used for rpc service discovery
    const dht = new DHT({
      keyPair: DHT.keyPair(dhtSeed),
      bootstrap: [{ host: "127.0.0.1", port: 30001 }], // note boostrap points to dht that is started via cli
    });
    await dht.ready();

    Logger.log("Starting swarm server...");
    const swarm = new Hyperswarm({ dht });
    const discovery = swarm.join(Buffer.alloc(32).fill("auction"), {
      server: true,
      client: false,
    });

    await discovery.flushed();

    this.handleConnection = this.handleConnection.bind(this);
    swarm.on("connection", this.handleConnection);

    // Reset public key state since the server already reset
    await datastore.delete("public-keys");

    Logger.log("Swarm server started.");
  }

  async handleConnection(conn, info) {
    Logger.log(
      "Connection received from",
      conn.remotePublicKey.toString("hex")
    );
    this.handleData = this.handleData.bind(this);
    conn.on("data", this.handleData);
    this._connections.push(conn);
  }

  async handleData(data) {
    const jsonData = JSON.parse(data);

    Logger.debug("##DEBUG JSON Data received", jsonData);

    switch (jsonData.mode) {
      case "new-peer":
        await this.onNewPeer(jsonData.publicKey);
        break;
      case "updated-peer-list":
        await this.onUpdatedPeerList(jsonData.publicKeys);
        break;
      default:
        break;
    }
  }

  async onNewPeer(publicKeyString) {
    /** @type {string[]} */
    let publicKeysArray = [];
    /** @type {string} */
    let publicKeys = await datastore.get("public-keys");

    if (publicKeys) {
      publicKeysArray = JSON.parse(publicKeys);
    }

    publicKeysArray.push(publicKeyString);

    await datastore.set("public-keys", JSON.stringify(publicKeysArray));
    Logger.debug("##DEBUG Broadcasting registered public keys...");

    await this.broadcast(
      JSON.stringify({ mode: "public-keys", publicKeys: publicKeysArray })
    );
  }

  async onUpdatedPeerList(publicKeys) {
    Logger.debug("##DEBUG Updating public keys...");
    await datastore.set("public-keys", JSON.stringify(publicKeys));
  }

  async broadcast(message) {
    for (const conn of this._connections) {
      conn.write(message);
    }
  }
}

module.exports = {
  Server,
};
