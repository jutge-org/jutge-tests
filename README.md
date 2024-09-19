# Jutge tests

First, prepare submodules:
```sh
git submodule init
git submodule update
```

Create the Jutge docker images:
```sh
cd src/dockerfiles
make
```

Then:
```bash
bun install
bun run test
```

# Dependencies

`docker`, `tar`                                                         
