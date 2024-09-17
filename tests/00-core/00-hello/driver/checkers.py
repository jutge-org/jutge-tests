#!/usr/bin/env python3

import os
import re
import time
import signal

from jutge import util

"""
Checker functions are used to check that a generated output file is correct with
regards to a given correct output file. In general, the checkers return 'AC',
'WA', 'PE', 'IC' or 'IE'. Maybe some special checker could return another value
(points, for instance).
"""


#############################################################################
# normalization
#############################################################################


def normalization(s):
    """Returns an string that is the normalitzation of the string s."""

    return re.sub(r'\s+', ' ', s).strip().upper()


#############################################################################
# invalid characters
#############################################################################


def invalid_characters(s):
    """Returns true if s contains some invalid character."""

    return re.search(r'[^ -~\n\r\t]', s)
    # ^ means not one of the following:
    #     ' -~' means one char in [32..126]
    #     ' -~\n\t\r' means one char in [32..126] or \n or \t or \r


#############################################################################
# standard checker
#############################################################################


def standard(file1, file2, pe=True):
    """
        The standard checker is used to check for standard outputs.
        It returns:

        - AC: if the two files are identical.
        - PE: if the two files are identical after normalitzation (only if pe).
        - WA: otherwise.
    """

    t1 = util.read_file(file1)
    t2 = util.read_file(file2)
    if t1 == t2:
        return 'AC'
    elif invalid_characters(t1):
        return 'IC'
    elif pe and normalization(t1) == normalization(t2):
        return 'PE'
    else:
        return 'WA'


#############################################################################
# loosy checker
#############################################################################


def loosy(file1, file2):
    """
        The loosy checker is used to check for loosy outputs.
        It is like the standard but returns AC rather than PE.
        It returns:

        - AC: if the two files are identical.
        - AC: if the two files are identical after normalitzation (not PE!).
        - WA: otherwise.
    """

    r = standard(file1, file2)
    if r == 'PE':
        return 'AC'
    else:
        return r


#############################################################################
# elastic checker (a better name is sought!)
#############################################################################


def elastic(file1, file2, sep, pe=True):
    """
        The elastic checker is used to check for outputs whose
        order is independent. This happens, for instance, for
        backtracking problems where output order is left without
        specification.

        file1 and file2 are the two files to be checked.
        sep is the separator or terminator string to use.
    """

    # Read the files
    t1 = util.read_file(file1)
    t2 = util.read_file(file2)

    # Quick check
    if t1 == t2:
        return 'AC'

    # Test for IC
    if invalid_characters(t1):
        return 'IC'

    # Split the files in lists
    list1 = t1.split(sep)
    list2 = t2.split(sep)

    # Test for 'WA' if lists have different sizes
    if len(list1) != len(list2):
        return 'WA'

    # Test for 'AC' if the lists are the same after sorting
    list1.sort()
    list2.sort()
    if list1 == list2:
        return 'AC'

    if pe:
        # Test for 'PE': normalize all the items in the two list
        list1 = [normalization(x) for x in list1]
        list2 = [normalization(x) for x in list2]
        list1.sort()
        list2.sort()
        if list1 == list2:
            return 'PE'

    # Sorry, pal
    return 'WA'


#############################################################################
# double elastic checker (a better name is sought!)
#############################################################################


def double_elastic(file1, file2, sep1, sep2, ini, fin, pe):
    """
        pregunteu-ho al salvador
    """

    x = double_elastic2(file1, file2, sep1, sep2, ini, fin)
    if x == 'PE' and not pe:
        return 'WA'
    return x


def double_elastic2(file1, file2, sep1, sep2, ini, fin):
    ini = re.escape(ini)
    fin = re.escape(fin)

    pe = False

    t1 = util.read_file(file1)  # estudiant
    t2 = util.read_file(file2)  # correcte

    # Quick check
    if t1 == t2:
        return 'AC'

    # Test for IC
    if invalid_characters(t1):
        return 'IC'

    if re.match(r'^\s*$', t1):
        if re.match(r'^\s*$', t2):
            return 'PE'
        else:
            return 'WA'
    if re.match(r'^\s*$', t2):
        return 'WA'

    m1 = re.match(r'^(\s*)(.*\S)(\s*)$', t1, re.DOTALL)
    m2 = re.match(r'^(\s*)(.*\S)(\s*)$', t2, re.DOTALL)

    if m1.group(1) != m2.group(1) or m1.group(3) != m2.group(3):
        pe = True
    t1 = m1.group(2)
    t2 = m2.group(2)

    list0 = []
    for x in t1.split('\n'):
        if x == '':
            list0.append('')
        else:
            m = re.match(r'^(\s*)(.*\S)(\s*)$', x, re.DOTALL)
            if m:
                if m.group(1) != '' or m.group(3) != '':
                    pe = True
                list0.append(m.group(2))
            else:
                list0.append('')
                pe = True
    t1 = '\n'.join(list0)

    if sep1 == '\n':
        t1p = re.sub('\n+', '\n', t1)
    elif sep1 == '\n\n':
        t1p = re.sub('\n\n+', '\n\n', t1)
    elif re.match(r'.*\s', sep1, re.DOTALL):
        t1p = re.sub('\n\n+', '\n', t1)
    else:
        return 'IE'
    if t1 != t1p:
        pe = True
        t1 = t1p

    list1 = t1.split(sep1)
    list2 = t2.split(sep1)
    if len(list1) != len(list2):
        return 'WA'
    list1.sort()
    list2.sort()
    if list1 == list2:
        return 'PE' if pe else 'AC'

    list1p = []
    for x in list1:
        m = re.match(r'^%s(.*)%s$' % (ini, fin), x, re.DOTALL)
        if not m:
            return 'WA'
        list1p.append(sorted(m.group(1).split(sep2)))

    list2p = []
    for x in list2:
        m = re.match(r'^%s(.*)%s$' % (ini, fin), x, re.DOTALL)
        if not m:
            return 'IE'
        list2p.append(sorted(m.group(1).split(sep2)))

    list1p.sort()
    list2p.sort()
    if list1p == list2p:
        return 'PE' if pe else 'AC'

    list1s = [sorted([normalization(y) for y in x]) for x in list1p]
    list2s = [sorted([normalization(y) for y in x]) for x in list2p]
    list1s.sort()
    list2s.sort()
    if list1s == list2s:
        return 'PE' if pe else 'AC'
    return 'WA'


#############################################################################
# epsilon checker
#############################################################################


def epsilon(out, cor, eps, relative=False):
    lines1 = open(cor).readlines()
    lines2 = open(out).readlines()
    if len(lines1) != len(lines2):
        return 'WA'
    for i in range(len(lines1)):
        x1 = lines1[i]
        x2 = lines2[i]
        f1 = float(x1)
        try:
            f2 = float(x2)
        except ValueError:
            return 'WA'
        if relative:
            if abs(f1 - f2) > abs(f1) * 2 * eps / (1.0 - eps):
                return 'WA'
        else:
            if abs(f1 - f2) > eps:
                return 'WA'
    return 'AC'


#############################################################################
# external checker
#############################################################################


def external(pgm, inp, out, cor, tim=5):
    """
        The external checker is used to check for outputs using an external
        program that reads the input and the generated output and writes
        to stdout the veredict. If the program runs for more than tim seconds,
        'IE' is returned. 'IE' also returned for non-existing pgm.
    """

    if not util.file_exists(pgm):
        return 'IE'

    tmp = util.tmp_file()
    pid = os.fork()
    if pid == 0:
        # Child
        os.system('./%s %s %s %s > %s' % (pgm, inp, out, cor, tmp))
        os._exit(0)
    else:
        # Parent
        c = 0
        while c <= tim:
            ret = os.waitpid(pid, os.WNOHANG)
            if ret[0] != 0:
                # Ok!
                ver = util.read_file(tmp).strip()
                util.del_file(tmp)
                return ver
            time.sleep(0.1)
            c += 0.1
        os.kill(pid, signal.SIGKILL)
        return 'IE'
