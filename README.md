## Pending
 - Client code
 - OnOpen, OnBid, OnClose

## Flow
 - start DHT bootstrapper and swarm `server` -> start clients -> emit `new-peer` -> server acknowledges `new-peer` with `public-keys` -> client registers all `public-keys` except his own

## Issues
 - `node.lookup`/`node.announce` from [HyperDHT Docs](https://docs.holepunch.to/building-blocks/hyperdht#additional-peer-discovery) does not return the object specified.
 - 