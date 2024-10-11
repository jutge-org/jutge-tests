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
jutge-org/server        latest    99a17e5e2128   7 minutes ago   7.38GB
jutge-org/server-base   latest    3eaad3d2f086   7 minutes ago   7.38GB
jutge-org/base          latest    bc89f18243e1   9 minutes ago   1.32GB
```

To launch the tests (you should have [Bun](https://bun.sh) installed):

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

