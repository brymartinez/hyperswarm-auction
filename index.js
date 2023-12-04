const { Client } = require("./client");
const { Server } = require("./server");

async function main() {
  switch (process.argv[2].toLowerCase()) {
    case "server":
      const server = new Server();
      await server.init();
      break;
    case "client":
      const client = new Client();
      await client.init();
      break;
  }
}

main();
