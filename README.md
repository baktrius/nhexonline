# NHex

## Setup (development)

### Note about assets (before clone)

This repository stores some assets (notably: console font, service icon and test files) in git-lfs.
If you don't have git-lfs installed, those resources won't be downloaded
and some features may not work properly.
Therefore ensure to have [git-lfs](https://git-lfs.com/) installed before cloning this repository
or download those assets manually from github.

### After clone

1. Setup python virtual environment.
2. Install all dependencies (both node's and python's): `npm install` (in root directory).
3. Create `tables` directory inside root folder.
4. Setup main's database with `./manage.py migrate`.
5. Create main's admin account `./manage.py createsuperuser`.
6. Now development servers can be started with `npm run dev` and stopped with `Ctrl+C`.
7. Visit `http://localhost:8000/` to see the app (or whatever url django prints in console).
8. During first run, if styles aren't applied, restart development server.

After these steps, development server should be running,
but service isn't fully functional yet.
It lacks essential assets like boards, armies and emotes.
To add those log to admin and visit `http://localhost:8000/admin/`.
Then configure the default board (board with lowest defaultPriority will be considered default).
In addition to that, its recommended to add at least one emote
allowing players to toss a coin (emote with one alternative image)
and one for pointing things.
Armies can be added using dedicated armies page,
but currently they can be made public (available to everyone) ony using admin page.

### Licenses

- The `Inconsolata-Bold.ttf` and `Inconsolata-Regular.ttf` fonts are licensed under the SIL Open Font License, Version 1.1. See [Inconsolata_LICENSE](third_party_licenses/Inconsolata_LICENSE) for details.