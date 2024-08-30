# NHex Table Sync Server

Part of nhex service.
This server syncs data between clients during their games using websocket.

## Running

This package provides executable server.
To use it install the package.
After that server can be invoked with `npx nhex-tss`.
One can specify url of main server via `MAIN_SERVER_URL` environmental variable (default is http://127.0.0.1:3000)
