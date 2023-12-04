const readline = require("readline");

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

      switch (args[0]) {
        case "open":
          // open item price
          await this._client.onOpen(args[1], parseFloat(args[2]));
          break;
        case "bid":
          // bid item price
          await this._client.onBid(args[1], parseFloat(args[2]));
          break;
        case "close":
          // close item
          await this._client.onClose(args[1]);
          break;
      }

      cli.prompt();
    });
  }
}

module.exports = {
  CLI,
};
