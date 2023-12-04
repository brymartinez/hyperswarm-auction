const { Client } = require("./client");

async function main() {
  const client = new Client();

  await client.init();
}

main();
