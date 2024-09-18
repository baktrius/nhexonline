# NHex

## Standard setup (development)

### Note about assets (before clone)

This repository stores some assets (notably: console font, service icon and test files) in git-lfs.
If you don't have git-lfs installed, those resources won't be downloaded
and some features may not work properly.
Therefore ensure to have [git-lfs](https://git-lfs.com/) installed before cloning this repository
or download those assets manually from github.

### After clone

1. Setup python virtual environment.
2. Install all dependencies (both node's and python's): `npm install` (in repository root directory - top one containing `package.json` and `vite.config.js`).
3. Create `tables` directory inside root folder.
4. Setup main's database with `./manage.py migrate`.
5. Create main's admin account `./manage.py createsuperuser`.
6. Now development servers can be started with `npm run dev` and stopped with `Ctrl+C`.
7. Visit `http://localhost:8000/` to see the app (or whatever url django prints in console).
8. During first run, if styles aren't applied, restart development server.

After these steps, development server should be running,
but service isn't fully functional yet.
It lacks essential assets like boards, armies and emotes.
To add those log in as admin (created before) and visit `http://localhost:8000/admin/`.
Then configure the default board (board with lowest defaultPriority will be considered default).
In addition to that, its recommended to add at least one emote
allowing players to toss a coin (emote with one alternative image)
and one for pointing things.
Armies can be added using dedicated armies page,
but currently they can be made public (available to everyone) ony using admin page.
One can also use `import_army` django's management command to import army from exported zip file or folder containing `info.json` file.

## Simplified static setup

Standard setup with server allowing users to create their own boards and armies might be too complex for some use cases.
To simplify things, there is an alternative version of main server called `nhex_static`.
It restricts users' options to:

- creating tables which are identified by links
- joining tables and playing on them with boards and armies predefined by site administrator.

To start `nhex_static` in development version one need to call `npm run dev`
inside `nhex_static` directory.
During development / configuration phase `nhex_static`'s assets are held under
`nhex_static/public/` directory.
One could try to manage those assets directly but it's not advised since they
have to follow strictly fix structure.
Recommended approach is to manage those assets with locally hosted main service (see [standard setup](#standard-setup-development)).
In such scenario one can use all its helper futures like management commands
to configure assets and export them to `nhex_static` using
`./manage.py export_all nhex_static/public/` command.

To export `nhex_static` for production one need to call `npm run build`
inside `nhex_static` directory.
It will prepare completely functional static main service inside `nhex_static/dist` folder.
In order to start static nhex service afterward one need to serve files from inside `nhex_static/dist` using standalone web server and run tss. tss alone can be configured to serve those static files using environmental variable like this: `SERVE_STATIC='../nhex_static/dist/' node table_server.js` (invoked inside `tss` directory), but for performance and security reason it's advised to setup some reverse proxy.

Server info specifies network address of tss server, so it probably has to be adjusted in production setup to match actual tss server address (when it isn't accessible to users at localhost:3001).

## Management commands

Main server comes with several management commands which can help with assets management.
They can be listed using `./manage.py --help` (look for [main] section).
Their respective help can be displayed using `./manage.py <command> --help`.

Currently there is one command regarding importing assets - `import_army` which allows to import armies from exported zip file or folder containing `info.json` file.
In contrary one can export most type of assets main server manages:
server info, armies, boards and emotes.

## Repository structure

This repository consists of four subrepositories (following are directories and short descriptions):

- `.` (root folder) - main server referred later as `main`.
- `tss` - table synchronization server.
- `table-client` - javascript library implementing mountable web component for displaying tables synchronized with `tss`.
- `nhex_static` - alternative "static" version of `main`.

## Licenses

- The `Inconsolata-Bold.ttf` and `Inconsolata-Regular.ttf` fonts are licensed under the SIL Open Font License, Version 1.1. See [Inconsolata_LICENSE](third_party_licenses/Inconsolata_LICENSE) for details.