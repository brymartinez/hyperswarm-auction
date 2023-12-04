const readline = require("readline");
const Logger = require("./logger");
const crypto = require("crypto");

/** @type {readline} */
let cli;

class CLI {
  constructor(client) {
    cli = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    this._client = client;
  }

  async prompt() {
    cli.prompt();

    cli.on("line", async (line) => {
      const args = line.trim().split(" ");
      let item, price;
      try {
        switch (args[0]) {
          case "open":
            // open item price
            item = args[1].trim().toLowerCase();
            // Ensure a bit of "uniqueness" to item names
            item += `#` + crypto.randomBytes(2).toString("hex");
            price = this.convertToNumber(args[2]);

            await this._client.onOpen(item, price);
            break;
          case "bid":
            // bid item price
            item = args[1].trim().toLowerCase();
            price = this.convertToNumber(args[2]);
            await this._client.onBid(item, price);
            break;
          case "close":
            // close item
            item = args[1].trim().toLowerCase();
            await this._client.onClose(item);
            break;
          default:
            Logger.error(`Unknown command. ${args[0]}`);
            break;
        }
      } catch (e) {
        Logger.error(e?.message ?? e);
      } finally {
        cli.prompt();
      }
    });
  }

  convertToNumber(val) {
    if (isNaN(val)) {
      throw new Error(`${val} is not a number.`);
    } else {
      return parseFloat(val);
    }
  }
}

module.exports = {
  CLI,
};
