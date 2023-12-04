const RPC = require("@hyperswarm/rpc");
const Hyperswarm = require("hyperswarm");
const DHT = require("hyperdht");
const crypto = require("crypto");
const { DataStore } = require("./datastore");
const { CLI } = require("./cli");

/**
 * This acts as both RPC client and server.
 *
 * @class Client
 */
class Client {
  constructor() {
    /** @type {string} */
    this.rpcServerPublicKey = null;
    /** @type {RPC.Client[]} */
    this._clients = [];
  }

  async init() {
    // resolved distributed hash table seed for key pair

    const datastore = new DataStore(
      `./db/rpc-client-${crypto.randomBytes(4).toString("hex")}`
    );

    await datastore.ready();

    let dhtSeed = await datastore.get("dht-seed");
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
    let rpcSeed = await datastore.get("rpc-seed");
    if (!rpcSeed) {
      rpcSeed = crypto.randomBytes(32);
      await datastore.set("rpc-seed", rpcSeed);
    }

    await this.startServer(rpcSeed, dht);

    console.log("##DEBUG Starting Swarm Client...");
    const swarm = new Hyperswarm({ dht });
    swarm.join(Buffer.alloc(32).fill("auction"), {
      client: true,
      server: false,
    });

    this.handleConnection = this.handleConnection.bind(this);
    swarm.on("connection", this.handleConnection);
  }

  async handleConnection(conn, info) {
    this.serverConnection = conn;
    this.handleData = this.handleData.bind(this);
    this.serverConnection.on("data", this.handleData);
    // Client already connected to swarm, announce new peer
    console.log("##DEBUG Writing new-peer...");
    this.serverConnection.write(
      JSON.stringify({
        mode: "new-peer",
        publicKey: this.rpcServerPublicKey,
      })
    );
  }

  async handleData(data) {
    const jsonData = JSON.parse(data);
    console.log("##DEBUG JSON Data received", jsonData);
    switch (jsonData.mode) {
      case "public-keys":
        // NOTE - Will be received more than once. One on handshake, and every succeeding connection
        // publicKeysArray: string[]
        await this.onPublicKeys(jsonData.publicKeys);
        break;
      default:
        console.error("Mode not found");
        break;
    }
  }

  async onPublicKeys(publicKeysArray) {
    await this.registerPublicKeys(publicKeysArray);
  }

  async registerPublicKeys(publicKeysArray) {
    for (const publicKey of publicKeysArray) {
      if (publicKey !== this.rpcServerPublicKey) {
        const client = this.RPC.connect(Buffer.from(publicKey, "hex"));
        console.debug("##DEBUG Connected to client.");
        this._clients.push(client);
      }
    }
  }

  async broadcast(event, message) {
    for (const client of this._clients) {
      await client.request(event, Buffer.from(JSON.stringify(message)));
    }
  }

  async startServer(rpcSeed, dht) {
    console.log("##DEBUG Starting RPC Server...");
    this.RPC = new RPC({ seed: rpcSeed, dht });
    const rpcServer = this.RPC.createServer();
    await rpcServer.listen();
    this.rpcServerPublicKey = rpcServer.publicKey.toString("hex");
    this.handleOpen = this.handleOpen.bind(this);
    rpcServer.respond("open", this.handleOpen);
    this.handleBid = this.handleBid.bind(this);
    rpcServer.respond("bid", this.handleBid);
    this.handleClose = this.handleClose.bind(this);
    rpcServer.respond("close", this.handleClose);
    const cli = new CLI(this);
    await cli.prompt();
  }

  async startClient() {
    console.log("##DEBUG Starting RPC Client...");
    // TODO - Where to get serverPubKey - from Hyperswarm handshake?
    // const respRaw = await rpc.request(serverPubKey, "ping", payloadRaw);
  }

  /*
   *
   * RPC Methods
   *
   */
  async handleOpen() {}

  async handleBid() {}

  async handleClose() {}

  /*
   *
   * CLI Methods
   *
   */
  async onOpen(itemName, price) {}

  async onBid(itemName, price) {}

  async onClose(itemName) {}
}

module.exports = {
  Client,
};
