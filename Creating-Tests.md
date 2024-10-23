# Creating Tests

Creating tests requires completing the following steps:

- Creating the problem
- Selecting your driver
- Creating a submission with expected veredicts

## Creating the problem

Create a folder under `tests` with a descriptive name for the test.
Then, create a `problem` folder containing the `handler.yml`, the test cases, as well as your `solution`s.

The `hello-world` example is a good problem on how this part should be made. For more details on all of the available options in the `handler.yml` files, check out the [Jutge Toolkit](https://github.com/jutge-org/jutge-toolkit/blob/main/documentation/problems.md#handler) page on problem handlers.

## Selecting your driver

Selecting your driver is done through creating a soft link called `driver` in the test's folder to the driver your problem is using. The link should be pointing directly to the directory that contains `judge.py`.

Drivers should be located in the `drivers` folder, at the root of the repository.

## Creating a submission with expected veredicts

First, copy the `.ts` file from any existing test, into your new `tests` folder. Rename the functions from the old test to have the name for your test.

Then, create a `languages` folder. For each language you'd like to test, create a folder using its [compiler id](https://jutge.org/documentation/compilers).


Within the directory, create a `_test.ts` file that calls your `doTestNameTest` function that you exported from your test file.

A working `_test.ts` looks like this:

```typescript
import { doForkTest } from "../../fork"
doForkTest(__dirname)
```

Then, add an `image.yml` containing a single key with the `jutgeorg` image you want your test to use. 

```
imageName: cpp
```

Finally, for each verdict you want to obtain, create a submission file with its name and the extension said compiler has.

The file tree of the `no-main` test looks like this:

```
no-main/
├── driver -> ../../drivers/std/std/
├── languages
│   ├── Clang
│   │   ├── AC.c
│   │   ├── WA.c
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── Clang++17
│   │   ├── AC.cc
│   │   ├── WA.cc
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── Codon
│   │   ├── AC.codon
│   │   ├── CE.codon
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── G++
│   │   ├── AC.cc
│   │   ├── WA.cc
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── G++11
│   │   ├── AC.cc
│   │   ├── WA.cc
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── GCC
│   │   ├── AC.c
│   │   ├── WA.c
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── GHC
│   │   ├── AC.hs
│   │   ├── CE.hs
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── JDK
│   │   ├── AC.java
│   │   ├── CE.java
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── MyPy
│   │   ├── AC.py
│   │   ├── CE.py
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── P1++
│   │   ├── AC.cc
│   │   ├── WA.cc
│   │   ├── _.test.ts
│   │   └── image.yml
│   ├── Python3
│   │   ├── AC.py
│   │   ├── CE.py
│   │   ├── _.test.ts
│   │   └── image.yml
│   └── R
│       ├── AC.R
│       ├── EE.R
│       ├── _.test.ts
│       └── image.yml
├── no-main.ts
└── problem
    ├── handler.yml
    ├── main.R
    ├── main.c
    ├── main.cc
    ├── main.codon
    ├── main.hs
    ├── main.java
    ├── main.py
    ├── problem.yml
    ├── sample-1.cor
    ├── sample-1.inp
    ├── sample-2.cor
    ├── sample-2.inp
    ├── sample-3.cor
    ├── sample-3.inp
    ├── solution.R
    ├── solution.c
    ├── solution.cc
    ├── solution.codon
    ├── solution.hs
    ├── solution.java
    └── solution.py
```