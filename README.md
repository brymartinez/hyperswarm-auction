## Introduction
A P2P auction example using Hyperswarm RPC, HyperDHT, Hypercores, and Hyperbee.

## Initialization Flow
 - start DHT bootstrapper and swarm `server` -> start clients -> emit `new-peer` -> server acknowledges `new-peer` with `public-keys` -> client registers all `public-keys` except his own

## How to run
 - `npm run server` on a terminal
 - `npm run client` on N# of terminals
 - Switch debug mode (1) for debug logs on `package.json`

## Notes
 - The Hyperswarm server is only used for saving public keys and broadcasting it once a new client connects. It does not communicate otherwise with different peers.
 - Registered remote public keys are deleted once the server is deleted.
 - The DHT is bootstrapped under `server.js`, not via CLI.
 - There's no "What auction did I just miss?" feature. Once you connect, you can only receive bid msgs and new open auction msgs.
 - Each client manages its own Hyperbee (hence the `crypto.randomBytes(4)` call on the Hypercore on `client.js`), and it's volatile. Data will be lost on disconnection.
 - There are quite a bit of JSDocs comments in here so I can work a bit safer.
 - On client disconnect, we write to the Swarm server so it can remove the disconnected public key from the list.
 - Item uniqueness follows a form of "tag", i.e. <itemName>#<random 4 characters>. Example: pic#65ab

## What's Missing?
 - There's a need for a Hyperswarm server to manage RPC Remote public keys. Theoretically, it can be managed via peer discovery (See Issues below) on a specific topic and iterating over the public keys returned by that stream on `node.annouce()`. Still figuring out an alternative solution to this.

## Issues
 - `node.lookup`/`node.announce` from [HyperDHT Docs](https://docs.holepunch.to/building-blocks/hyperdht#additional-peer-discovery) does not return the object specified.
