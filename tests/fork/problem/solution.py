import os

pid = os.fork()
if pid == 0:
    print("Hello World")