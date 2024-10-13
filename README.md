# Jutge tests

To clone this repository, it is very convenient to use `--recurse-submodules` and `-b` to choose a branch. This branch (`new`) should be clone like this:

```sh
git clone --recurse-submodules -b new https://github.com/jutge-org/jutge-tests
```

(If you don't do it like this, read the section "Updating submodules by hand" below)

Now, create the Docker images (you should have [docker](https://docker.io) installed.)

```sh
make -C dockerfiles
```

You can also specify which image to generate with `make -C dockerfiles test` or `make -C dockerfiles server`.

Once the build is finished, check that `docker image list` returns something similar to:

```
REPOSITORY              TAG       IMAGE ID       CREATED         SIZE
jutge-org/full          latest    ed5cf1c3bd05   2 minutes ago   8.24GB
jutge-org/server        latest    374bddb38608   3 minutes ago   7.38GB
jutge-org/server-base   latest    3ff87846aa85   4 minutes ago   7.38GB
jutge-org/lite          latest    f5442d799b7a   5 minutes ago   2.62GB
jutge-org/test          latest    a1a73d2b9293   6 minutes ago   1.32GB
jutge-org/base          latest    dc09f9f1433e   6 minutes ago   1.32GB
```

To launch the tests (you should have [Bun](https://bun.sh) installed, and also [NodeJS](https://nodejs.org), since it seems Jest still depends on behavior from Node to run properly):

```sh
bun install
bun run test
```

which will execute all tests.

## Updating submodules by hand

Since submodules are recursive (2-level), you will have to issue all these commants to set them up:

```sh
git submodule init
git submodule update
cd dockerfiles
git submodule init
git submodule update
```

So, the dependencies between submodules are:

```
jutge-tests:
    jutge-dockerfiles:
        jutge-vinga
        jutge-toolkit
        jutge-server-toolkit
    jutge-driver-std
```

That is why you need to do the `git submodules init` and `update` twice.

