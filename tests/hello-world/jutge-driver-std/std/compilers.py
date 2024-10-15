#!/usr/bin/env python3

import codecs
import glob
import logging
import os
import signal
import subprocess
import time
import shutil
import uuid

import monitor
import util
import yogi

# Maximum time to compile
max_compilation_time = 30

# List of available compilers (will be filled)
compilers = []


# Exceptions:

class CompilationTooLong(Exception):
    pass


class ExecutionError(Exception):
    pass


class CompilationError(Exception):
    pass


# Helper functions

class Compiler:
    """Compiler base class (abstract)."""

    def __init__(self, handler):
        self.handler = handler

    def name(self):
        """Returns the compiler name."""
        raise Exception('Abstract method')

    def id(self):
        """Returns the compiler id (automatically computed from its class name)."""
        return self.__class__.__name__.replace('Compiler_', '').replace('XX', '++')

    def type(self):
        """Returns the compiler type (compiler, interpreter, ...)."""
        raise Exception('Abstract method')

    def warning(self):
        """Returns some warning associated to the compiler."""
        return ""

    def executable(self):
        """Returns the file name of the resulting "executable"."""
        raise Exception('Abstract method')

    def prepare_execution(self, ori):
        """Copies the necessary files from ori to . to prepare the execution."""
        raise Exception('Abstract method')

    def language(self):
        """Returns the language name."""
        raise Exception('Abstract method')

    def version(self):
        """Returns the version of this compiler."""
        raise Exception('Abstract method')

    def flags1(self):
        """Returns flags for the first compilation."""
        raise Exception('Abstract method')

    def flags2(self):
        """Returns flags for the second compilation (if needed)."""
        raise Exception('Abstract method')

    def extension(self):
        """Returns extension of the source files (without dot)."""
        raise Exception('Abstract method')

    def compile(self):
        """Doc missing."""
        raise Exception('Abstract method')

    def execute(self, tst):
        """Doc missing."""
        raise Exception('Abstract method')

    def execute_compiler(self, cmd):
        """Executes the command cmd, but controlling the execution time."""
        pid = os.fork()
        if pid == 0:
            # Child
            logging.info(cmd)
            os.system(cmd)
            if util.file_exists('program.exe'):
                os.system('strip program.exe')
            os._exit(0)
        else:
            # Parent
            c = 0
            while c <= max_compilation_time:
                ret = os.waitpid(pid, os.WNOHANG)
                if ret[0] != 0:
                    # Ok!
                    return
                time.sleep(0.1)
                c += 0.1
            os.kill(pid, signal.SIGKILL)
            raise CompilationTooLong

    def execute_monitor(self, tst, pgm):
        """Executes the monitor to run a program. """

        # Get options for the monitor
        cpl = self.id()
        ops = ''
        if util.file_exists(tst + '.ops'):
            logging.info("using %s" % (tst + '.ops'))
            ops += ' ' + util.read_file(tst + '.ops').replace('\n', ' ')
        if util.file_exists(tst + '.' + cpl + '.ops'):
            logging.info("using %s" % (tst + '.' + cpl + '.ops'))
            ops += ' ' + util.read_file(tst + '.' + cpl + '.ops').replace('\n', ' ')

        if cpl in ["Python", "Python3", "MyPy"]:
            maxtime = 30
        elif cpl in ["JDK"]:
            maxtime = 10
        else:
            maxtime = 6

        # Prepare the command
        cmd = '%s --basename=%s --maxtime=%i %s %s' \
              % (monitor.path, tst, maxtime, ops, pgm)

        # Execute the command and get its result code
        logging.info(cmd)
        pro = subprocess.Popen(cmd, shell=True, close_fds=True)
        r = pro.wait()
        if r > 256:
            r /= 256

        if r != 0:
            raise ExecutionError

    def execute_monitor_in_tmp(self, tst, pgm):
        """Executes the monitor to run a program using /tmp because of vinga shit. """

        ori = os.getcwd()
        wrk = '/tmp/monitor.' + tst + '.' + str(uuid.uuid4())[:8]
        util.del_dir(wrk)
        os.mkdir(wrk)
        os.system('cp -r * ' + wrk)
        os.chdir(wrk)
        try:
            self.execute_monitor(tst, pgm)
        finally:
            os.system('cp -r * ' + ori)
            os.chdir(ori)

    def get_version(self, cmd, lin):
        """Private method to get a particular line from a command output."""
        try:
            return subprocess.getoutput(cmd).split('\n')[lin].strip()
        except:
            return None

    def info(self):
        return {
            'compiler_id': self.id(),
            'name': self.name(),
            'language': self.language(),
            'version': self.version(),
            'flags1': self.flags1(),
            'flags2': self.flags2(),
            'extension': self.extension(),
            'type': self.type(),
            'warning': self.warning(),
        }


class Compiler_GenericC(Compiler):

    def cmd(self):
        raise Exception('Abstract method')

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'C'

    def version(self):
        return self.get_version(f'{self.cmd()} --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'c'

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')

    def compile(self):
        if 'source_modifier' in self.handler and (
                self.handler['source_modifier'] == 'no_main' or
                self.handler['source_modifier'] == 'structs'):
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler(
                f'{self.cmd()} {self.flags1()} program.c -o program.exe -lm 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def compile_no_main(self):

        # Compile (-c) original program
        util.del_file('program.exe')
        util.del_file('program.o')
        try:
            self.execute_compiler(
                f'{self.cmd()} -c {self.flags1()} program.c 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.o')
            return False
        if not util.file_exists('program.o'):
            return False

        # Modify the program
        util.copy_file('program.c', 'original.c')
        original = util.read_file('original.c')
        main = util.read_file('../problem/main.c')

        util.copy_file("../driver/etc/c/program.c", ".")
        with open("program.c", "r+") as f:
            program = f.read()
            f.seek(0)
            program = program.replace('{original}', original)
            program = program.replace('{main}', main)
            f.write(program)
            f.truncate()

        # Compile modified program
        util.del_file('program.exe')
        try:
            self.execute_compiler(
                f'{self.cmd()} {self.flags2()} program.c -o program.exe -lm 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False

        # We are almost there
        if util.file_exists('program.exe'):
            return True
        else:
            util.write_file('compilation1.txt', "Unreported error. ")
            util.del_file('program.exe')
            return False


class Compiler_GCC(Compiler_GenericC):
    compilers.append('GCC')

    def cmd(self):
        return 'gcc'

    def name(self):
        return 'GNU C Compiler'


class Compiler_Clang(Compiler_GenericC):
    compilers.append('Clang')

    def cmd(self):
        return 'clang'

    def name(self):
        return 'Clang C Compiler'


class Compiler_GenericCXX(Compiler):

    def cmd(self):
        raise Exception('Abstract method')

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'C++'

    def version(self):
        return self.get_version(f'{self.cmd()} --version', 0)

    def extension(self):
        return 'cc'

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')

    def compile(self):
        if 'source_modifier' in self.handler and (
                self.handler['source_modifier'] == 'no_main' or
                self.handler['source_modifier'] == 'structs'):
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):

        # Compile original program
        util.del_file('program.exe')
        try:
            self.execute_compiler(
                f'{self.cmd()} {self.flags1()} program.cc -o program.exe 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        if not util.file_exists('program.exe'):
            return False

        # Modify the program
        util.copy_file('program.cc', 'original.cc')
        original = util.read_file('original.cc')
        stub = util.read_file('../driver/etc/cc/stub.cc')
        util.copy_file("../driver/etc/cc/normal.cc", "./program.cc")
        with open("program.cc", "r+") as f:
            program = f.read()
            f.seek(0)
            program = program.replace('{original}', original)
            program = program.replace('{stub}', stub)
            f.write(program)
            f.truncate()

        # Compile modified program
        util.del_file('program.exe')
        try:
            self.execute_compiler(
                f'{self.cmd()} {self.flags2()} program.cc -o program.exe 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False

        # We are almost there
        if util.file_exists('program.exe'):
            return True
        else:
            util.write_file('compilation1.txt', 'Unreported error. ')
            util.del_file('program.exe')
            return False

    def compile_no_main(self):

        # Compile (-c) original program
        util.del_file('program.exe')
        util.del_file('program.o')
        try:
            self.execute_compiler(
                f'{self.cmd()} -c {self.flags1()} program.cc 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.o')
            return False
        if not util.file_exists('program.o'):
            return False

        # Modify the program
        util.copy_file('program.cc', 'original.cc')
        original = util.read_file('original.cc')
        main = util.read_file('../problem/main.cc')
        stub = util.read_file('../driver/etc/cc/stub.cc')
        util.copy_file("../driver/etc/cc/nomain.cc", "./program.cc")
        with open("program.cc", "r+") as f:
            program = f.read()
            f.seek(0)
            program = program.replace('{original}', original)
            program = program.replace('{main}', main)
            program = program.replace('{stub}', stub)
            f.write(program)
            f.truncate()

        # Compile modified program
        util.del_file('program.exe')
        try:
            self.execute_compiler(
                f'{self.cmd()} {self.flags2()} program.cc -o program.exe 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False

        # We are almost there
        if util.file_exists('program.exe'):
            return True
        else:
            util.write_file('compilation1.txt', "Unreported error. ")
            util.del_file('program.exe')
            return False


class Compiler_GXX(Compiler_GenericCXX):
    compilers.append('GXX')

    def cmd(self):
        return 'g++'

    def name(self):
        return 'GNU C++ Compiler'

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return '-D_JUDGE_ -DNDEBUG -O2'


class Compiler_P1XX(Compiler_GXX):
    compilers.append('P1XX')

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -Wall -Wextra -Werror -Wno-sign-compare -Wshadow'

    def name(self):
        return 'GNU C++ Compiler with extra flags for beginners'


class Compiler_GXX11(Compiler_GXX):
    compilers.append('GXX11')

    def name(self):
        return 'GNU C++11 Compiler'

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++11'

    def flags2(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++11'


class Compiler_GXX17(Compiler_GXX):
    compilers.append('GXX17')

    def name(self):
        return 'GNU C++17 Compiler'

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++17'

    def flags2(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++17'


class Compiler_ClangXX17(Compiler_GenericCXX):
    compilers.append('ClangXX17')

    def cmd(self):
        return 'clang++'

    def name(self):
        return 'Clang C++17 Compiler'

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++17'

    def flags2(self):
        return '-D_JUDGE_ -DNDEBUG -O2 -std=c++17'


class Compiler_GPC(Compiler):
    compilers.append('GPC')

    def name(self):
        return 'GNU Pascal Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Pascal'

    def version(self):
        return self.get_version('gpc --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'pas'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gpc -c ' + self.flags1() + ' program.pas 2> compilation1.txt')
            if not util.file_exists('program.o'):
                return False
            self.execute_compiler(
                'g++ program.o -L/usr/lib/gcc/i486-linux-gnu/4.1 -lgpc -o program.exe > linkage.txt 2>&1')
            if not util.file_exists('program.exe'):
                util.write_file('compilation1.txt', 'Linkage error')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_GFortran(Compiler):
    compilers.append('GFortran')

    def name(self):
        return 'GNU Fortran Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Fortran'

    def version(self):
        return self.get_version('gfortran --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'f'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gfortran ' + self.flags1() +
                                  ' program.f -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_GObjC(Compiler):
    compilers.append('GObjC')

    def name(self):
        return 'GNU Objective-C Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Objective-C'

    def version(self):
        return self.get_version('gcc --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'm'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gcc ' + self.flags1() +
                                  ' program.m -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_GHC(Compiler):
    compilers.append('GHC')

    def name(self):
        return 'Glasgow Haskell Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Haskell'

    def version(self):
        return self.get_version('ghc --version', 0)

    def flags1(self):
        return ' -O3 '

    def flags2(self):
        return ' -O3 '

    def extension(self):
        return 'hs'

    def compile(self):
        if 'source_modifier' in self.handler and self.handler['source_modifier'] == 'no_main':
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('ghc ' + self.flags1() +
                                  ' program.hs -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def compile_no_main(self):

        # aixo esta fet a sac, cal fer-ho be

        util.copy_file('program.hs', 'original.hs')
        ori = util.read_file('program.hs')
        main = util.read_file('../problem/main.hs')
        util.write_file('program.hs', '%s\n\n\n%s\n' % (ori, main))

        util.del_file('program.exe')
        try:
            self.execute_compiler('ghc ' + self.flags1() +
                                  ' program.hs -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_RunHaskell(Compiler):
    compilers.append('RunHaskell')

    def name(self):
        return 'Glasgow Haskell Compiler (with tweaks for testing in the judge)'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.hs'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')
        if util.file_exists(ori + '/' + "judge.hs"):
            util.copy_file(ori + '/' + "judge.hs", '.')

    def language(self):
        return 'Haskell'

    def version(self):
        return self.get_version('ghc --version', 0)

    def flags1(self):
        return '-O3'

    def flags2(self):
        return '-O3'

    def extension(self):
        return 'hs'

    def compile(self):
        f = open("extra.hs", "w")
        print('"testing"', file=f)
        f.close()
        return self.compile_with("extra.hs")

    def compile_with(self, extra):
        try:
            util.copy_file("program.hs", "work.hs")
            if util.file_exists("judge.hs"):
                os.system("cat judge.hs >> work.hs")
            data = open("work.hs", "r").read()
            f = open("work.hs", "w")
            print("module Main (mainjutgeorg) where", file=f)
            print("", file=f)
            print(data, file=f)
            print("", file=f)
            print("mainjutgeorg = do", file=f)
            for line in open(extra).readlines():
                line = line.rstrip()
                if line.startswith("let "):
                    print("    %s" % line, file=f)
                else:
                    print("    print (%s)" % line, file=f)
            f.close()
            self.execute_compiler('ghc  -main-is mainjutgeorg ' + self.flags1() +
                                  ' work.hs -o work.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_exists('work.exe')

    def execute(self, tst):
        if self.compile_with(tst + ".inp"):
            self.execute_monitor(tst, './work.exe')
        else:
            # hack to get required files
            self.execute_monitor(tst, '/bin/cat')
            # let's fake the verdict
            f = open(tst + ".res", "w")
            print("execution: EE", file=f)
            print("execution_error: Cannot test", file=f)
            f.close()


class Compiler_RunPython(Compiler):
    compilers.append('RunPython')

    def name(self):
        return 'Python3 Interpreter (with tweaks for testing in the judge)'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.py'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')
        if util.file_exists(ori + '/' + "judge.py"):
            util.copy_file(ori + '/' + "judge.py", '.')

    def language(self):
        return 'Python'

    def version(self):
        return self.get_version('python3 --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'py'

    def compile(self):
        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation1.txt') == 0

    def compile_with(self, extra):
        try:
            util.copy_file("program.py", "work.py")
            os.system("echo '' >> work.py")
            os.system("echo '' >> work.py")
            if util.file_exists("judge.py"):
                os.system("cat judge.py >> work.py")
            os.system("cat %s >> work.py" % extra)
            self.execute_compiler('python3 -m py_compile work.py 1> /dev/null 2> compilation2.txt')
            return True
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
        return False

    def execute(self, tst):
        if self.compile_with(tst + ".inp"):
            # Under vinga, python cannot locate the modules in the current dir, so we move them to a subdir.
            util.copy_file("../../driver/etc/py/runpython_wrapper.py", "./wrapper.py")
            os.mkdir('subdir')
            util.copy_file('work.py', 'subdir')

            self.execute_monitor_in_tmp(tst, '/usr/bin/python3 wrapper.py')

        else:
            # hack to get required files
            self.execute_monitor(tst, '/bin/cat')
            # let's fake the verdict
            f = open(tst + ".res", "w")
            print("execution: EE", file=f)
            print("execution_error: Cannot test", file=f)
            f.close()


class Compiler_GDC(Compiler):
    compilers.append('GDC')

    def name(self):
        return 'GNU D Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'D'

    def version(self):
        return self.get_version('gdc --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -DNDEBUG -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'd'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gdc ' + self.flags1() +
                                  ' program.d -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_F2C(Compiler):
    compilers.append('F2C')

    def name(self):
        return 'Fortran 77 Compiler'

    def type(self):
        return 'compiler (2C)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Fortran'

    def version(self):
        return self.get_version('f2c -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'f'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('f2c program.f 1> /dev/null 2> compilation1.txt')
            if not util.file_exists('program.c'):
                return False
            self.execute_compiler('cc -O2 program.c -lf2c -lm -o program.exe 1> linkage.txt 2>&1')
            if not util.file_exists('program.exe'):
                util.write_file('compilation1.txt', 'C compilation failed')
            util.del_file('program.c')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_P2C(Compiler):
    compilers.append('P2C')

    def name(self):
        return 'Pascal to C translator'

    def type(self):
        return 'compiler (2C)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Pascal'

    def version(self):
        return 'Pascal to C translator, version 1.21alpha-07.Dec.93'

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'pas'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('p2c -a program.pas  1> compilation1.txt 2> /dev/null')
            if not util.file_exists('program.c'):
                return False
            self.execute_compiler('cc -O2 program.c -lp2c -lm -o program.exe 1> linkage.txt 2>&1')
            if not util.file_exists('program.exe'):
                util.write_file('compilation1.txt', 'C compilation failed')
            util.del_file('program.c')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Stalin(Compiler):
    compilers.append('Stalin')

    def name(self):
        return 'Stalin'

    def type(self):
        return 'compiler (2C)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Scheme'

    def version(self):
        return 'Stalin ' + str(self.get_version('stalin -version', 0))

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'scm'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('stalin -c -On program.scm 2> /dev/null 1> compilation1.txt')
            if not util.file_exists('program.c'):
                return False
            self.execute_compiler('gcc -O2 program.c -lm -o program.exe 1> linkage.txt 2>&1')
            if not util.file_exists('program.exe'):
                util.write_file('compilation1.txt', 'C compilation failed')
            util.del_file('program.c')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Chicken(Compiler):
    compilers.append('Chicken')

    def name(self):
        return 'Chicken'

    def type(self):
        return 'compiler (2C)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Scheme'

    def version(self):
        return self.get_version('chicken -version', 2)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'scm'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('csc program.scm -o program.exe 1> /dev/null 2> compilation1.txt')
            if not util.file_exists('program.exe'):
                return False
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_GCJ(Compiler):
    compilers.append('GCJ')

    def name(self):
        return 'GNU Java Compiler'

    def type(self):
        return 'compiler (shared libs)'

    def language(self):
        return 'Java'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def flags1(self):
        return '--main=Main -O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'java'

    def version(self):
        return self.get_version('gcj --version', 0)

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gcj ' + self.flags1() +
                                  ' program.java -o program.exe 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_GNAT(Compiler):
    compilers.append('GNAT')

    def name(self):
        return 'GNU Ada Compiler'

    def type(self):
        return 'compiler (shared libs)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Ada'

    def flags1(self):
        return '-O2'

    def flags2(self):
        return ''

    def extension(self):
        return 'ada'

    def version(self):
        return self.get_version('gnat --version', 0)

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('gnat make ' + self.flags1() +
                                  ' program.ada -o program.exe 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_FPC(Compiler):
    compilers.append('FPC')

    def name(self):
        return 'Free Pascal Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Pascal'

    def version(self):
        return self.get_version('fpc -v', 0)

    def flags1(self):
        return '-Sd -Co -Cr -Ct -Ci -v0'

    def flags2(self):
        return ''

    def extension(self):
        return 'pas'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('fpc ' + self.flags1() +
                                  ' program.pas -oprogram.exe > compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_FBC(Compiler):
    compilers.append('FBC')

    def name(self):
        return 'FreeBASIC Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'BASIC'

    def version(self):
        return self.get_version('fbc -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'bas'

    def compile(self):

        util.del_file('program.exe')
        util.del_file('program')
        try:
            self.execute_compiler('fbc ' + self.flags1() +
                                  ' program.bas 1> compilation1.txt 2> /dev/null')
            if not util.file_exists('program'):
                return False
            else:
                util.move_file('program', 'program.exe')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            util.del_file('program')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_JDK(Compiler):
    compilers.append('JDK')

    def name(self):
        return 'OpenJDK Runtime Environment'

    def type(self):
        return 'compiler (vm)'

    def executable(self):
        return 'Main.class'

    def language(self):
        return 'Java'

    def version(self):
        return self.get_version('java -version', 0).replace('"', "'")

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'java'

    def compile(self):
        if 'source_modifier' in self.handler and self.handler['source_modifier'] == 'no_main':
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        for f in glob.glob('*.class'):
            util.del_file(f)
        try:
            util.copy_file('../driver/etc/jdk/JudgeMain.java', '.')
            util.copy_file('program.java', 'Main.java')
            self.execute_compiler('javac ' + self.flags1() + ' JudgeMain.java 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_exists('Main.class')

    def compile_no_main(self):
        # esta fet a sac!!! cal fer-ho be

        for f in glob.glob('*.class'):
            util.del_file(f)
        try:
            # create Solution.class
            self.execute_compiler('javac ' + self.flags1() + ' program.java 2> compilation1.txt')
            # create Main.class
            util.copy_file('../problem/main.java', '.')
            self.execute_compiler('javac ' + self.flags1() + ' main.java 2> compilation2.txt')
            # create JudgeMain.class
            util.copy_file('../driver/etc/jdk/JudgeMain.java', 'JudgeMain.java')
            self.execute_compiler('javac ' + self.flags1() + ' JudgeMain.java 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_exists('Main.class')

    def prepare_execution(self, ori):
        os.system('cp ' + ori + '/*.class .')

    def execute(self, tst):

        ops = ''
        if util.file_exists(tst + '.ops'):
            ops += ' ' + util.read_file(tst + '.ops').replace('\n', ' ')
        if util.file_exists(tst + '.JDK.ops'):
            ops += ' ' + util.read_file(tst + '.JDK.ops').replace('\n', ' ')

        # Extra options to run the JVM under the monitor
        opsX = '--maxfiles=4096 --maxprocs=100 --maxmem=2048:2048 '

        # Options for the JVM to set its maximal heap size and stack size
        opsJ = '-Xmx1024M -Xss1024M'

        # Prepare the command
        cls = "JudgeMain"
        cmd = '%s --basename=%s --maxtime=10 %s %s -- /usr/bin/java %s %s' \
              % (monitor.path, tst, ops, opsX, opsJ, cls)

        # Execute the command and get its result code
        # Because JDK does not like to have its path blocked, the directory cannot be in
        # its current location. So we temporarilly move it to /tmp.

        # move to tmp
        old = os.getcwd()
        tmp = util.tmp_dir()
        os.system("mv * " + tmp)
        os.chdir(tmp)

        # do work
        logging.info(cmd)
        pro = subprocess.Popen(cmd, shell=True, close_fds=True)
        r = pro.wait()
        if r > 256:
            r = r / 256

        # move back from /tmp
        os.system("mv * " + old)
        os.chdir(old)

        # exit
        if r != 0:
            raise ExecutionError


class Compiler_MonoCS(Compiler):
    compilers.append('MonoCS')

    def name(self):
        return 'Mono C# Compiler'

    def type(self):
        return 'compiler (vm)'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'C#'

    def version(self):
        return self.get_version('mcs --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'cs'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('mcs ' + self.flags1() +
                                  ' program.cs 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, 'mono ./program.exe')


class Compiler_Python(Compiler):
    """Obslote. It is here because of old submissions."""

    compilers.append('Python')

    def name(self):
        return 'Python'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.py'

    def language(self):
        return 'Python'

    def version(self):
        return 'Obsolete'

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'py'


class Compiler_Python3(Compiler):
    compilers.append('Python3')

    def name(self):
        return 'Python3'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.py'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Python'

    def version(self):
        return self.get_version('python3 -V', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'py'

    def compile(self):
        if 'source_modifier' in self.handler and (
                self.handler['source_modifier'] == 'no_main' or self.handler['source_modifier'] == 'structs'):
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation1.txt') == 0

    def compile_no_main(self):
        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation1.txt') != 0:
            return False

        # Modify the program
        util.copy_file('program.py', 'original.py')
        ori = util.read_file('program.py')
        main = util.read_file('../problem/main.py')
        name = '__name__ = "__jutge__"'
        util.write_file('program.py', '%s\n\n\n%s\n\n\n%s\n' % (name, ori, main))

        # Compile modified program
        util.del_file('compilation2.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation2.txt') == 0

    def execute(self, tst):
        # under jutge-vinga, for some strange reason, python cannot locate the modules in the current dir, so we move them to a subdir under /tmp.

        ori = os.getcwd()
        wrk = '/tmp/' + tst + '.workdir.' + str(uuid.uuid4())[:8]
        util.del_dir(wrk)
        os.mkdir(wrk)
        os.system('cp -r * ' + wrk)
        os.chdir(wrk)
        try:
            self.execute_monitor(tst, '/usr/bin/python3 program.py')
        except ExecutionError:
            logging.info('ExecutionError at execute_monitor')
        os.system('cp -r * ' + ori)
        os.chdir(ori)


class Compiler_MyPy(Compiler):
    compilers.append('MyPy')

    def name(self):
        return 'Python3 Interpreter (with MyPy type checking)'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.py'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Python'

    def version(self):
        return self.get_version('python3 -V', 0) + ' ' + self.get_version('mypy -V', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'py'

    def compile(self):
        if 'source_modifier' in self.handler and (
                self.handler['source_modifier'] == 'no_main' or self.handler['source_modifier'] == 'structs'):
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        # py_compile
        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation1.txt') != 0:
            return False

        # mypy
        try:
            self.execute_compiler(
                'mypy --no-error-summary --ignore-missing-imports --pretty --show-error-codes --show-column-numbers --show-error-context program.py > compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation1.txt') == 0

    def compile_no_main(self):
        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation1.txt') != 0:
            return False

        # Modify the program
        util.copy_file('program.py', 'original.py')
        ori = util.read_file('program.py')
        main = util.read_file('../problem/main.py')
        name = '__name__ = "__jutge__"'
        util.write_file('program.py', '%s\n\n\n%s\n\n\n%s\n' % (name, ori, main))

        # Compile modified program
        util.del_file('compilation2.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.py 1> /dev/null 2> compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation2.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation2.txt') != 0:
            return False

        # check modified program
        try:
            self.execute_compiler(
                'mypy --no-error-summary --ignore-missing-imports --pretty --show-error-codes --show-column-numbers --show-error-context program.py > compilation2.txt')
        except CompilationTooLong:
            util.write_file('compilation2.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation2.txt') == 0

    def execute(self, tst):
        self.execute_monitor_in_tmp(tst, '/usr/bin/python3 program.py')


class Compiler_Codon(Compiler):
    compilers.append('Codon')

    def name(self):
        return 'Codon'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Python'

    def version(self):
        return self.get_version('codon --version', 0)

    def flags1(self):
        return '-release'

    def flags2(self):
        return '-release'

    def extension(self):
        return 'codon'

    def compile(self):
        if 'source_modifier' in self.handler and (
                self.handler['source_modifier'] == 'no_main' or self.handler['source_modifier'] == 'structs'):
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        util.del_file('compilation1.txt')

        # hack to use yogi
        shutil.copy(os.path.dirname(yogi.__file__) + '/yogi.codon', '.')
#???        shutil.copy(os.path.dirname(yogi.__file__) + '/jutge.codon', '.')

        try:
            self.execute_compiler('codon build -exe ' + self.flags1() + ' ' + 'program.codon > compilation1.txt 2>&1')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation1.txt') != 0:
            return False
        if not util.file_exists(self.executable()):
            return False
        return True

    def compile_no_main(self):

        # hack to use yogi
        shutil.copy(os.path.dirname(yogi.__file__) + '/yogi.codon', '.')
        #??? shutil.copy(os.path.dirname(yogi.__file__) + '/yogi.codon', './jutge.codon')

        util.del_file('compilation1.txt')
        try:
            self.execute_compiler(
                'python3 -m py_compile program.codon 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation1.txt') != 0:
            return False

        # Modify the program
        util.copy_file('program.codon', 'original.codon')
        ori = util.read_file('program.codon')
        main = util.read_file('../problem/main.py')
        name = '__name__ = "__jutge__"'
        util.write_file('program.codon', '%s\n\n\n%s\n\n\n%s\n' % (name, ori, main))

        # Compile modified program
        util.del_file('compilation2.txt')
        try:
            self.execute_compiler('codon build -exe ' + self.flags1() + ' ' + 'program.codon > compilation2.txt 2>&1')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        if util.file_size('compilation2.txt') != 0:
            return False
        if not util.file_exists(self.executable()):
            return False
        return True

    def execute(self, tst):
        self.execute_monitor_in_tmp(tst, './program')


class Compiler_Perl(Compiler):
    compilers.append('Perl')

    def name(self):
        return 'Perl'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.pl'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Perl'

    def version(self):
        return self.get_version('perl -v', 1)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'pl'

    def compile(self):
        self.execute_compiler('perl -c ' + self.flags1() +
                              ' program.pl 1> /dev/null 2> compilation1.txt')
        if util.read_file('compilation1.txt').strip() != 'program.pl syntax OK':
            return False
        util.del_file('compilation1.txt')
        return True

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/perl program.pl')


class Compiler_Lua(Compiler):
    compilers.append('Lua')

    def name(self):
        return 'Lua'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.luac'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Lua'

    def version(self):
        return self.get_version('luac -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'lua'

    def compile(self):
        util.del_file('program.luac')
        self.execute_compiler('luac ' + self.flags1() +
                              ' -o program.luac program.lua 1> /dev/null 2> compilation1.txt')
        return util.file_exists('program.luac')

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/lua program.luac')


class Compiler_R(Compiler):
    compilers.append('R')

    def name(self):
        return 'R'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.R'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'R'

    def version(self):
        return self.get_version('R --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'R'

    def compile(self):
        if 'source_modifier' in self.handler and self.handler['source_modifier'] == 'no_main':
            return self.compile_no_main()
        else:
            return self.compile_normal()

    def compile_normal(self):
        util.del_file('compilation1.txt')
        try:
            s = open("program.R").read()
            util.copy_file("../driver/etc/R/wrapper.R", ".")
            with open("wrapper.R", "r+") as f:
                program = f.read()
                f.seek(0)
                program = program.replace('{s}', s)
                f.write(program)
                f.truncate()

            util.copy_file("../driver/etc/R/compiler.R", ".")
            self.execute_compiler('Rscript compiler.R 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            return False
        return util.file_size('compilation1.txt') == 0

    def compile_no_main(self):
        # Modify the program
        util.copy_file('program.R', 'original.R')
        ori = util.read_file('program.R')
        main = util.read_file('../problem/main.R')
        util.write_file('program.R', '%s\n\n\n%s\n' % (ori, main))
        return True

    def execute(self, tst):
        util.copy_file("../../driver/etc/R/executer.R", ".")
        self.execute_monitor(tst, ' --maxprocs=100 --maxfiles=500 /usr/bin/Rscript executer.R')


class Compiler_Ruby(Compiler):
    compilers.append('Ruby')

    def name(self):
        return 'Ruby'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.rb'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Ruby'

    def version(self):
        return self.get_version('ruby -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'rb'

    def compile(self):
        self.execute_compiler('ruby -c ' + self.flags1() + ' program.rb > compilation1.txt')
        if util.read_file('compilation1.txt').strip() != 'Syntax OK':
            return False
        util.del_file('compilation1.txt')
        return True

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/ruby program.rb')


class Compiler_Guile(Compiler):
    compilers.append('Guile')

    def name(self):
        return 'Guile'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.scm'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Scheme'

    def version(self):
        return self.get_version('guile -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'scm'

    def compile(self):
        # I don't know how to compile only using Guile
        return True

    def execute(self, tst):
        # !!! I had to add --maxfiles
        self.execute_monitor(tst, ' --maxfiles=7 /usr/bin/guile program.scm')


class Compiler_Erlang(Compiler):
    compilers.append('Erlang')

    def name(self):
        return 'Erlang'

    def type(self):
        return 'vm'

    def executable(self):
        return 'program.beam'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Erlang'

    def version(self):
        return self.get_version('erl +V', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'erl'

    def compile(self):
        util.del_file('program.beam')
        self.execute_compiler('erlc ' + self.flags1() +
                              ' program.erl 2> /dev/null 1> compilation1.txt')
        return util.file_exists('program.beam')

    def execute(self, tst):
        # !!! I had to add --maxfiles
        self.execute_monitor(
            tst, ' --maxfiles=30 -- /usr/bin/erl -noshell -s program start -s init stop')


class Compiler_BEEF(Compiler):
    # Hack: copy program.bf to /tmp because otherwise we have permission

    compilers.append('BEEF')

    def name(self):
        return 'Flexible Brainfuck interpreter'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.bf'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '/tmp/program.bf')

    def language(self):
        return 'Brainfuck'

    def version(self):
        return ''

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'bf'

    def compile(self):
        # I don't know how to compile only using Beef
        return True

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/beef /tmp/program.bf')


class Compiler_WS(Compiler):
    compilers.append('WS')

    def name(self):
        return 'Whitespace interpreter'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.ws'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Whitespace'

    def version(self):
        return "unknown version"

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'ws'

    def compile(self):
        # I don't know how to compile only using WS
        return True

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/wspace program.ws')


class Compiler_PHP(Compiler):
    compilers.append('PHP')

    def name(self):
        return 'PHP'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.php'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'PHP'

    def version(self):
        return self.get_version('php --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'php'

    def compile(self):
        self.execute_compiler('php --syntax-check ' + self.flags1() +
                              ' program.php > compilation1.txt')
        if util.read_file('compilation1.txt').strip() != 'No syntax errors detected in program.php':
            return False
        util.del_file('compilation1.txt')
        return True

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/bin/php program.php')


class Compiler_nodejs(Compiler):
    compilers.append('nodejs')

    def name(self):
        return 'nodejs'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.js'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'JavaScript'

    def version(self):
        return self.get_version('node --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'js'

    def compile(self):
        return True

    def execute(self, tst):
        #        self.execute_monitor(tst, ' --maxprocs=100 --maxmem=1024:1024 /usr/bin/node program.js')

        cmd = '%s --basename=%s --maxprocs=100 --maxmem=1024:1024 -- /usr/bin/node program.js' \
              % (monitor.path, tst)

        # Execute the command and get its result code
        # Because JDK does not like to have its path blocked, the directory cannot be in
        # its current location. So we temporarilly move it to /tmp.

        # move to tmp
        old = os.getcwd()
        tmp = util.tmp_dir()
        os.system("mv * " + tmp)
        os.chdir(tmp)
        logging.info(tmp)

        # do work
        logging.info(cmd)
        pro = subprocess.Popen(cmd, shell=True, close_fds=True)
        r = pro.wait()
        if r > 256:
            r = r / 256

        # move back from /tmp
        os.system("mv * " + old)
        os.chdir(old)

        # exit
        if r != 0:
            raise ExecutionError

class Compiler_Typescript(Compiler):
    compilers.append('Typescript')

    def name(self):
        return 'Typescript (Bun)'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Typescript'

    def version(self):
        return self.get_version('/opt/bun/bin/bun --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'ts'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('/opt/bun/bin/bun build --compile program.ts 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program')

    def execute(self, tst):
        self.execute_monitor_in_tmp(tst, ' --maxprocs=100 --maxmem=2048:2048 ./program')

class Compiler_Go(Compiler):
    compilers.append('Go')

    def name(self):
        return 'Go'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Go'

    def version(self):
        return self.get_version('go version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'go'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('go build -o program.exe ' +
                                  self.flags1() + ' program.go 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, ' --maxmem=1024:1024 --maxprocs=8 ./program.exe')


class Compiler_CLISP(Compiler):
    compilers.append('CLISP')

    def name(self):
        return 'GNU CLISP'

    def type(self):
        return 'compiler (vm)?'

    def executable(self):
        return 'program.fas'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Lisp'

    def version(self):
        return self.get_version('clisp --version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'lisp'

    def compile(self):
        util.del_file('program.fas')
        try:
            self.execute_compiler('clisp -c ' + self.flags1() +
                                  ' program.lisp >/dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.fas')
            return False
        util.del_file('program.lib')
        return util.file_exists('program.fas')

    def execute(self, tst):
        # clisp opens some auxiliar files???
        self.execute_monitor(tst, ' --maxfiles=8 /usr/bin/clisp program.fas')


class Compiler_Verilog(Compiler):
    compilers.append('Verilog')

    def name(self):
        return 'Icarus Verilog'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.vvp'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Verilog'

    def version(self):
        return self.get_version('/usr/local/bin/iverilog-0.8 -V', 0)

    def flags1(self):
        return '-t vvp'

    def flags2(self):
        return ''

    def extension(self):
        return 'v'

    def compile(self):
        util.del_file('program.vvp')
        self.execute_compiler('/usr/local/bin/iverilog-0.8 -o program.vvp ' +
                              self.flags1() + ' program.v 2> compilation1.txt')
        return util.file_exists('program.vvp')

    def execute(self, tst):
        self.execute_monitor(tst, ' /usr/local/bin/vvp-0.8 program.vvp')


class Compiler_PRO2(Compiler):
    compilers.append('PRO2')

    def name(self):
        return 'PRO2 - GNU C++ Compiler'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'C++'

    def version(self):
        return self.get_version('g++ --version', 0)

    def flags1(self):
        return '-D_JUDGE_ -D_GLIBCXX_DEBUG -O2 -Wall -Wextra -Werror -Wno-sign-compare -std=c++11 -fno-extended-identifiers'

    def flags2(self):
        return '-D_JUDGE_ -D_GLIBCXX_DEBUG -O2 -std=c++11'

    def extension(self):
        return 'cc'

    def compile(self):
        # first compilation
        util.del_file('program.exe')
        util.del_dir("program.dir")
        os.mkdir("program.dir")
        os.chdir("program.dir")
        try:
            if util.file_exists('../../problem/public.tar'):
                os.system('tar xf ../../problem/public.tar')
            if util.file_exists('../../problem/private.tar'):
                os.system('tar xf ../../problem/private.tar')

            if util.file_exists('../../problem/solution.cc'):
                util.copy_file('../program.cc', 'program.cc')
            elif util.file_exists('../../problem/solution.hh'):
                util.copy_file('../program.cc', 'program.hh')

            self.execute_compiler(
                # compte que abaix esta repetit!!!
                'g++ ' + self.flags1() + ' *.cc -o ../program.exe 2> ../compilation1.txt'
            )
        except CompilationTooLong:
            os.chdir('..')
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        os.chdir('..')
        if not util.file_exists('program.exe'):
            return False

        # second compilation
        util.del_file('program.exe')
        util.del_dir("program.dir")
        os.mkdir("program.dir")
        os.chdir("program.dir")

        try:
            if util.file_exists('../../problem/public.tar'):
                os.system('tar xf ../../problem/public.tar')
            if util.file_exists('../../problem/private.tar'):
                os.system('tar xf ../../problem/private.tar')

            headers = ''
            if util.file_exists('../../problem/solution.cc'):
                util.copy_file('../program.cc', 'program.cc')
            elif util.file_exists('../../problem/solution.hh'):
                util.copy_file('../program.cc', 'program.hh')

            # Modify the program
            try:
                original = util.read_file('program.cc')
            except Exception:
                original = ''
            stub = util.read_file('../../driver/etc/cc/stub.cc')
            util.copy_file("../../driver/etc/cc/normal.cc", "./program.cc")
            with open("program.cc", "r+") as f:
                program = f.read()
                f.seek(0)
                program = program.replace('{original}', original)
                program = program.replace('{stub}', stub)
                f.write(program)
                f.truncate()

            self.execute_compiler(
                'g++ ' + self.flags2() + ' *.cc -o ../program.exe 2> ../compilation2.txt'
            )
        except CompilationTooLong:
            os.chdir('..')
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        os.chdir('..')
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_MakePRO2(Compiler):
    compilers.append('MakePRO2')

    def name(self):
        return 'Make for PRO2'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Make'

    def version(self):
        return self.get_version('make -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'tar'

    def compile(self):
        logging.info('compiling with MakePRO2')
        logging.info('changing max_compilation_time')
        global max_compilation_time
        max_compilation_time = 30

        util.del_file('program.exe')
        util.del_dir("program.dir")
        os.mkdir("program.dir")
        os.chdir("program.dir")

        if not util.file_exists('../program.tar'):
            util.write_file("../compilation1.txt",
                            "Could not find submission. Please report this error.")
            os.chdir('..')
            return False

        typ = subprocess.getoutput('file -b ../program.tar')
        if typ != "POSIX tar archive (GNU)" and typ != "POSIX tar archive":
            util.write_file("../compilation1.txt",
                            "Submission is not a tar archive (identification: '%s')" % typ)
            os.chdir('..')
            return False

        try:
            os.system('tar xf ../program.tar')
            if util.file_exists('../../problem/public.tar'):
                os.system('tar xf ../../problem/public.tar')
            if util.file_exists('../../problem/private.tar'):
                os.system('tar xf ../../problem/private.tar')

            logging.info('MakePRO2 cleaning')
            os.system('rm -rf *.exe *.o')
            self.execute_compiler(
                'make program.exe 1> make.log 2> compilation1.txt'
            )
        except CompilationTooLong:
            util.write_file('../compilation1.txt', 'Compilation time exceeded')
            os.chdir('..')
            return False

        os.chdir('..')

        if util.file_exists('program.dir/compilation1.txt'):
            util.copy_file('program.dir/compilation1.txt', '.')

        if util.file_exists('program.dir/program.exe'):
            util.copy_file('program.dir/program.exe', '.')

        util.del_dir("program.dir")

        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Rust(Compiler):
    compilers.append('Rust')

    def name(self):
        return 'Rust'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Rust'

    def version(self):
        return self.get_version('rustc --version', 0)

    def flags1(self):
        return '-O'

    def flags2(self):
        return '-O'

    def extension(self):
        return 'rs'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('rustc -o program.exe ' +
                                  self.flags1() + ' program.rs 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Crystal(Compiler):
    compilers.append('Crystal')

    def name(self):
        return 'Crystal'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Crystal'

    def version(self):
        return self.get_version('crystal -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'cr'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('crystal build -o program.exe ' +
                                  self.flags1() + ' program.cr 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Nim(Compiler):
    compilers.append('Nim')

    def name(self):
        return 'Nim'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'program.exe'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Nim'

    def version(self):
        return self.get_version('nim -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'nim'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('nim c -o:program.exe ' +
                                  self.flags1() + ' program.nim 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            shutil.rmtree('nimcache')
            return False

        shutil.rmtree('nimcache')
        return util.file_exists('program.exe')

    def execute(self, tst):
        self.execute_monitor(tst, './program.exe')


class Compiler_Julia(Compiler):
    compilers.append('Julia')

    def name(self):
        return 'Julia'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.jl'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Julia'

    def version(self):
        return self.get_version('julia -v', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'jl'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('julia ' +
                                  self.flags1() + ' program.jl 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False

        return util.file_size('compilation1.txt') == 0

    def execute(self, tst):
        self.execute_monitor(tst, 'julia program.jl')


class Compiler_Kotlin(Compiler):
    compilers.append('Kotlin')

    def name(self):
        return 'Kotlin'

    def type(self):
        return 'interpreter'

    def executable(self):
        return 'program.kt'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Kotlin'

    def version(self):
        return self.get_version('kotlinc -version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'kt'

    def compile(self):
        util.del_file('program.exe')
        try:
            self.execute_compiler('kotlinc ' +
                                  self.flags1() + ' program.kt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program.exe')
            return False

        return util.file_size('compilation1.txt') == 0

    def execute(self, tst):
        os.system('ln -s /opt/.konan ./.konan')
        self.execute_monitor(tst, 'kotlinc program.kt')


class Compiler_Zig(Compiler):
    compilers.append('Zig')

    def name(self):
        return 'Zig'

    def type(self):
        return 'compiler'

    def executable(self):
        return 'z'

    def prepare_execution(self, ori):
        util.copy_file(ori + '/' + self.executable(), '.')

    def language(self):
        return 'Zig'

    def version(self):
        return self.get_version('zig version', 0)

    def flags1(self):
        return ''

    def flags2(self):
        return ''

    def extension(self):
        return 'zig'

    def compile(self):
        util.del_file('program')
        try:
            self.execute_compiler('zig build-exe -femit-bin=./z' +
                                  self.flags1() + ' program.zig 1> /dev/null 2> compilation1.txt')
        except CompilationTooLong:
            util.write_file('compilation1.txt', 'Compilation time exceeded')
            util.del_file('program')
            return False

        return util.file_size('compilation1.txt') == 0

    def execute(self, tst):
        self.execute_monitor(tst, './z')


def compiler(cpl, handler=None):
    """Returns a compiler for cpl."""

    cpl = cpl.replace('++', 'XX')
    return eval('Compiler_%s(handler)' % cpl)


def info():
    """Returns the info on all the compilers."""

    r = {}
    for x in compilers:
        r[x] = compiler(x).info()
    return r


if __name__ == '__main__':
    util.print_yml(info())
