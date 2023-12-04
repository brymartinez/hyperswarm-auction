const readline = require("readline");
const { Client } = require("./client");

/** @type {readline} */
let cli;

/** @type {Client} */
let client;

class CLI {
  constructor(client) {
    cli = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    client = client;
  }

  async prompt() {
    cli.prompt();

    cli.on("line", async (line) => {
      const args = line.trim().split(" ");

      switch (args[0]) {
        case "open":
          // open item price
          await client.onOpen(args[1], parseFloat(args[2]));
          break;
        case "bid":
          // bid item price
          await client.onBid(args[1], parseFloat(args[2]));
          break;
        case "close":
          // close item
          await client.onClose(args[1]);
          break;
      }

      cli.prompt();
    });
  }
}

module.exports = {
  CLI,
};
