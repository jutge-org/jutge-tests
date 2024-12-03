#!/usr/bin/env python3

import subprocess
import sys
import os
import yaml
from colorama import Fore, Style


def ensure_env_var(name, default=None):
    if name not in os.environ and default is None:
        print(f"Environment variable {name} not set")
        sys.exit(1)
    value = os.environ[name]
    print(name, "=", value)
    return value


JUTGE_TESTS_FOLDER = ensure_env_var("JUTGE_TESTS_FOLDER", "../tests")
print()


def exec(cmd):
    return subprocess.check_output(cmd, shell=True)


def check(title: str, task_id: str):
    file = f"/home/queue/tst/dat/tasks/{task_id}.output.tar.gz"
    correction_yml = exec(f"tar xf {file} correction.yml --to-stdout")
    result = yaml.load(correction_yml, Loader=yaml.FullLoader)
    expected = title.split("_")[-1].split("-")[0]
    if result["veredict"] == expected:
        sign = Fore.GREEN + "." + Style.RESET_ALL
    else:
        sign = Fore.RED + "X" + Style.RESET_ALL
    print(sign, result["veredict"], title, task_id)
    sys.stdout.flush()


for line in sys.stdin:
    [title, task_id] = line.strip().split(" ")
    check(title, task_id)
