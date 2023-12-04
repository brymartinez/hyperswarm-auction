const readline = require("readline");

let cli, client;
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
          break;
        case "bid":
          break;
        case "close":
          break;
      }

      cli.prompt();
    });
  }
}

module.exports = {
  CLI,
};
