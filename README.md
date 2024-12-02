# Jutge tests

## Tests

This repository contains a non exhaustive list of submissions that test
Jutge.org's correction process.

Both basic functionality as well as some limits are tested.

## Cloning

```sh
git clone --recurse-submodules https://github.com/jutge-org/jutge-tests
```

To launch the tests (you should have [Bun](https://bun.sh) installed, and also [NodeJS](https://nodejs.org), since it seems Jest still depends on behavior from Node to run properly):

## Images

You will also **need** `Docker` and the [Jutge.org](https://github.com/jutge-org/jutge-dockerfiles) images locally. You may build them yourself or get them from [Docker Hub](https://hub.docker.com/u/jutgeorg).

## Testing

```sh
bun install
bun run test
```

which will execute all tests.

