#!/usr/bin/env python3

import os
import stat

path = '/usr/local/bin/jutge-vinga'


def exists():
    """Tells whether the monitor exists."""
    return os.path.exists(path)


def is_suid_root():
    """Tells whether the monitor is installed correctly (suid root)."""
    info = os.stat(path)
    pro, uid, gid = info[0], info[4], info[5]
    return gid == uid == 0 and pro & stat.S_ISUID
