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
REPOSITORY         TAG       IMAGE ID       CREATED         SIZE
jutgeorg/java      latest    3e72e7022a2f   3 minutes ago   914MB
jutgeorg/latex     latest    f0bbdeb01437   3 minutes ago   1.88GB
jutgeorg/extra     latest    e286c9bbd515   4 minutes ago   2.68GB
jutgeorg/python    latest    611ee13d07f3   4 minutes ago   1.18GB
jutgeorg/cpp       latest    8a484dcfd23d   4 minutes ago   1.32GB
jutgeorg/haskell   latest    9588a3a6267b   4 minutes ago   1.37GB
jutgeorg/base      latest    953425fdc677   4 minutes ago   566MB
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

