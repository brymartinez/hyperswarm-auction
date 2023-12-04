const Hyperbee = require("hyperbee");

let hbee;
/**
 * Instance of a datastore.
 *
 * @class DataStore
 */
class DataStore {
  constructor(defaultPath = "db/rpc-server") {
    hbee = new Hyperbee(new Hypercore(defaultPath), {
      keyEncoding: "utf-8",
      valueEncoding: "binary",
    });
  }

  async ready() {
    return hbee.ready();
  }

  async get(key) {
    const entry = await hbee.get(key);

    return entry?.value;
  }

  async set(key, value) {
    return hbee.put(key, value);
  }

  async delete(key) {
    return hbee.del(key);
  }
}

module.exports = {
  DataStore,
};
