This test is organized in a special way.

The 3 pieces of the problem are in folders `problem`, `driver` and `languages` (which contains tests for each language).

The `driver` points to the `std` folder in the original source code of the `jutge-driver-std`, which is a submodule to be able to freeze a particular version in the tests.

The `languages` folder contains the submissions, and contains all languages.
Each language is a folder with many files which are named like the verdict that they should produce (so a file called `AC.cc` is for an accepted problem in C++). Also, for each language folder, active tests have a `_.test.ts` that will be picked up by Jest (which by default looks for files ending in `.test.ts`). 

The reason to use these `_.test.ts` files is that each language will become a separated test (otherwise all of them are grouped together and they can't be called individually).  However, these files are very simple, and they can be copied around, since they have the same code, which picks up its location to produce a different test in each case, depending on the folder in which the file is located. When running tests, one can do `bun run test go` or `bun run test lua` or `bun run test "g\\+\\+"` (yeah, it is that cumbersome 🤢) to filter out which tests to run.

Right now, to be able to select the image run by `jutge-run-outside`, there is an `image.yml` file which contains a field `imageName` with the name of the chosen image, one for each folder. Eventually, we could devise a better scheme for this (like using the folder name itself and using as image the name between brackets, like in: `Java [java]` or `Go [extra]` or `G++11 [cpp]`).

A folder named `__disabled__` in the `languages` folder contains tests which are not being used right now (they might be deleted or fixed eventually).
