"""
Common utilities for Jutge.org's scripts
"""

import logging
import os
import shutil
import socket
import sys
import tarfile
import tempfile
import time
import chardet

import yaml


# ----------------------------------------------------------------------------
# Logging
# ----------------------------------------------------------------------------

def init_logging():
    """Configures custom logging options."""

    logging.basicConfig(
        format='%s@%s ' % (get_username(), get_hostname()) +
        '%(asctime)s %(levelname)s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )
    logging.getLogger('').setLevel(logging.NOTSET)


# ----------------------------------------------------------------------------
# Environment
# ----------------------------------------------------------------------------


def get_username():
    return os.getenv("USER")


def get_hostname():
    return socket.gethostname()


# ----------------------------------------------------------------------------
# Utilities for lists
# ----------------------------------------------------------------------------

def intersection(a, b):
    return filter(lambda x: x in a, b)


# ----------------------------------------------------------------------------
# Utilities for general directories
# ----------------------------------------------------------------------------


def read_file(name):
    """Returns a string with the contents of the file name."""
    try:
        fd = open(name, 'r')
        r = fd.read()
        fd.close()
    except Exception:
        fd = open(name, 'rb')
        char_detection = chardet.detect(fd.read())
        fd.close()

        f = open(name, encoding=char_detection['encoding'], errors='ignore')
        r = f.read()
        f.close()
    return r


def write_file(name, txt=""):
    """Writes the file name with contents txt."""
    f = open(name, "w")
    f.write(txt)
    f.close()


def del_file(name):
    """Deletes the file name. Does not complain on error."""
    try:
        os.remove(name)
    except OSError:
        pass


def file_size(name):
    """Returns the size of file name in bytes."""
    return os.stat(name)[6]


def tmp_dir():
    """Creates a temporal directory and returns its name."""
    return tempfile.mkdtemp('.dir', get_username() + '-')


def tmp_file():
    """Creates a temporal file and returns its name."""
    return tempfile.mkstemp()[1]


def file_exists(name):
    """Tells whether file name exists."""
    return os.path.exists(name)


def copy_file(src, dst):
    """Copies a file from src to dst."""
    shutil.copy(src, dst)


def move_file(src, dst):
    """Recursively move a file or directory to another location."""
    shutil.move(src, dst)


# ----------------------------------------------------------------------------
# Utilities for yml files
# ----------------------------------------------------------------------------


def print_yml(inf):
    print(yaml.dump(inf, indent=4, width=1000, default_flow_style=False))


def write_yml(path, inf):
    yaml.dump(inf, open(path, "w"), indent=4,
              width=1000, default_flow_style=False)


def read_yml(path):
    return yaml.load(open(path, 'r'), Loader=yaml.FullLoader)


# ----------------------------------------------------------------------------
# Utilities for tgz files
# ----------------------------------------------------------------------------


def create_tgz(name, filenames, path=None):
    """Creates a tgz file name with the contents given in the list of filenames.
    Uses path if given."""
    if name == "-":
        tar = tarfile.open(mode="w|gz", fileobj=sys.stdout)
    else:
        tar = tarfile.open(name, "w:gz")
    cwd = os.getcwd()
    if path:
        os.chdir(path)
    for x in filenames:
        tar.add(x)
    if path:
        os.chdir(cwd)
    tar.close()


def extract_tgz(name, path):
    """Extracts a tgz file in the given path."""
    if name == "-":
        tar = tarfile.open(mode="r|gz", fileobj=sys.stdin)
    else:
        tar = tarfile.open(name, "r:gz")
    for x in tar:
        tar.extract(x, path)
    tar.close()


# ----------------------------------------------------------------------------
# Utilities for directories
# ----------------------------------------------------------------------------


def del_dir(path):
    """Deletes the directory path. Does not complain on error."""
    try:
        shutil.rmtree(path)
    except OSError:
        pass


def mkdir(path):
    """Makes the directory path. Does not complain on error."""
    try:
        os.makedirs(path)
    except OSError:
        pass


# ----------------------------------------------------------------------------
# Utilities for time
# ----------------------------------------------------------------------------


def current_time():
    """Returns a string with out format for times."""
    return time.strftime("%Y-%m-%d %H:%M:%S")


# ----------------------------------------------------------------------------
# Misc
# ----------------------------------------------------------------------------


def convert_bytes(num):
    """Converts bytes to Mb, Gb, etc"""
    step_unit = 1000.0  # 1024 bad the size

    for x in ['bytes', 'Kb', 'Mb', 'Gb', 'Tb']:
        if num < step_unit:
            if x == 'bytes':
                return "%i %s" % (num, x)
            else:
                return "%3.1f %s" % (num, x)
        num /= step_unit


def system(cmd):
    """As os.system(cmd) but writes cmd."""
    print(cmd)
    return os.system(cmd)
