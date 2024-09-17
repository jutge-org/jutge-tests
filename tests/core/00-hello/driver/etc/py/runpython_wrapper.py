# Python wrapper used to run the submission

import os, sys, signal

try:
    sys.path = ['subdir'] + sys.path
    import work
except:
    os.kill(os.getpid(), signal.SIGUSR2)
