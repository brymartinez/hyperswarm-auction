const RPC = require("@hyperswarm/rpc");
const Hyperswarm = require("hyperswarm");
const DHT = require("hyperdht");
const crypto = require("crypto");
const { DataStore } = require("./datastore");
const { CLI } = require("./cli");
const Logger = require("./logger");

/** @type {DataStore} */
let datastore;
/**
 * This acts as both RPC client and server.
 *
 * @class Client
 */
class Client {
  constructor() {
    datastore = new DataStore(
      `./db/rpc-client-${crypto.randomBytes(4).toString("hex")}`
    );
    /** @type {string} */
    this.rpcServerPublicKey = null;
    /** @type {Map<string, RPC.Client>} */
    this._clients = new Map();
    /** @type {boolean} */
    this._hasOpenAuction = false;
  }

  async init() {
    // resolved distributed hash table seed for key pair
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

    Logger.debug("##DEBUG Starting Swarm Client...");
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
    Logger.debug("##DEBUG Writing new-peer...", this.rpcServerPublicKey);
    this.serverConnection.write(
      JSON.stringify({
        mode: "new-peer",
        publicKey: this.rpcServerPublicKey,
      })
    );
  }

  async handleData(data) {
    const jsonData = JSON.parse(data);
    Logger.debug("##DEBUG JSON Data received", jsonData);
    switch (jsonData.mode) {
      case "public-keys":
        // NOTE - Will be received more than once. One on handshake, and every succeeding connection
        // publicKeysArray: string[]
        await this.onPublicKeys(jsonData.publicKeys);
        break;
      default:
        Logger.error("Mode not found");
        break;
    }
  }

  async onPublicKeys(publicKeysArray) {
    for (const publicKey of publicKeysArray) {
      if (
        publicKey !== this.rpcServerPublicKey &&
        !Array.from(this._clients.keys()).includes(publicKey)
      ) {
        const client = this.RPC.connect(Buffer.from(publicKey, "hex"));
        Logger.debug("##DEBUG Connected to client.");

        Logger.debug("##DEBUG Registering client close event for", publicKey);

        client.on("close", this.handleClientClose.bind(this, publicKey));
        this._clients.set(publicKey, client);
      }
    }
  }

  handleClientClose(publicKey) {
    Logger.debug("##DEBUG Close triggered for ", publicKey);

    // Remove the client for the list and announce to swarm server that it has been removed
    this._clients.delete(publicKey);
    const publicKeys = Array.from(this._clients.keys());
    publicKeys.push(this.rpcServerPublicKey);
    Logger.debug("##DEBUG Sending updated key list", publicKeys);

    this.serverConnection.write(
      JSON.stringify({
        mode: "updated-peer-list",
        publicKeys,
      })
    );
  }

  /**
   *
   *
   * @param {string} event
   * @param {Record<string, unknown>} message
   * @memberof Client
   */
  async broadcast(event, message) {
    for (const [publicKey, client] of this._clients) {
      await client
        .request(event, Buffer.from(JSON.stringify(message)))
        .catch((e) => {
          Logger.error(e);
          Logger.error("Encountered on", publicKey);
        });
    }
  }

  async startServer(rpcSeed, dht) {
    Logger.debug("##DEBUG Starting RPC Server...");
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

  /*
   *
   * RPC Methods
   *
   */

  /**
   *
   * @param {string} data of format { itemName: string, price: number, auctionerId: string }
   * @memberof Client
   */
  async handleOpen(data) {
    const jsonData = JSON.parse(data);

    // Save this to local datastore
    await datastore.set(
      `${jsonData.itemName}_top_bid`,
      JSON.stringify({
        price: jsonData.price,
      })
    );

    Logger.log(
      `Client#${jsonData.auctionerId} has opened an auction for item "${jsonData.itemName}" for ${jsonData.price}USDT`
    );
    process.stdout.write("> ");
  }

  /**
   *
   *
   * @param {string} data of format { itemName: string, price: number, bidderId: string }
   * @memberof Client
   */
  async handleBid(data) {
    const jsonData = JSON.parse(data);

    await datastore.set(
      `${jsonData.itemName}_top_bid`,
      JSON.stringify({
        price: jsonData.price,
        bidderId: jsonData.bidderId,
      })
    );

    Logger.log(
      `Client#${jsonData.bidderId} has bid ${jsonData.price}USDT for item "${jsonData.itemName}"`
    );
    process.stdout.write("> ");
  }

  /**
   *
   *
   * @param {string} data of format { itemName: string, price: number, bidderId: string }
   * @memberof Client
   */
  async handleClose(data) {
    const jsonData = JSON.parse(data);
    const itemKey = `${jsonData.itemName}_top_bid`;

    const result = await datastore.get(itemKey);

    if (!result) {
      // Do nothing
      return;
    }

    await datastore.delete(itemKey);

    Logger.log(
      `Client#${jsonData.bidderId} has bid ${jsonData.price}USDT for item "${jsonData.itemName}"`
    );

    if (jsonData.bidderId === this.rpcServerPublicKey) {
      Logger.log("You are the WINNER!");
    }

    process.stdout.write("> ");
  }

  /*
   *
   * CLI Methods
   *
   */
  async onOpen(itemName, price) {
    // { price: number, auctionerId: string }
    if (!this._hasOpenAuction) {
      await datastore.set(`${itemName}_top_bid`, JSON.stringify({ price }));

      await this.broadcast("open", {
        itemName,
        price,
        auctionerId: this.rpcServerPublicKey,
      });

      this._hasOpenAuction = true;

      Logger.debug(
        `Auction for item ${itemName} has been opened for ${price}USDT.`
      );
      process.stdout.write("> ");
    }
  }

  async onBid(itemName, price) {
    const itemKey = `${itemName}_top_bid`;
    let result = await datastore.get(itemKey);

    if (!result) {
      // Impossible case, since we process all broadcasted bids on handleBid() and initialize on handleOpen()
      Logger.error(`Bid failed. Item does not exist.`);
      process.stdout.write("> ");
      return;
    }

    const jsonData = JSON.parse(result);

    if (jsonData.price >= price) {
      Logger.error(`Bid failed. Expected > ${jsonData.price}, got ${price}`);
      process.stdout.write("> ");
      return;
    }

    await datastore.set(
      itemKey,
      JSON.stringify({
        bidderId: this.rpcServerPublicKey,
        price,
      })
    );

    await this.broadcast("bid", {
      itemName,
      price,
      bidderId: this.rpcServerPublicKey,
    });

    Logger.log(`Bid for item ${itemName} for ${price}USDT has been posted.`);
    process.stdout.write("> ");
  }

  async onClose(itemName) {
    if (!this._hasOpenAuction) {
      Logger.error("You have no open auctions.");
      process.stdout.write("> ");
      return;
    }

    const itemKey = `${itemName}_top_bid`;
    let result = await datastore.get(itemKey);

    if (!result) {
      Logger.error(`You have no open auctions for ${itemName}.`);
      process.stdout.write("> ");
      return;
    }

    const jsonData = JSON.parse(result);

    await this.broadcast("close", {
      itemName,
      price: jsonData.price,
      bidderId: jsonData.bidderId,
    });

    this._hasOpenAuction = false;

    await datastore.delete(itemKey);

    Logger.log(
      `Auction for item ${itemName} has been closed for ${jsonData.price}USDT. Winner: Client #${jsonData.bidderId}`
    );
    process.stdout.write("> ");
  }
}

module.exports = {
  Client,
};
