#!/usr/bin/env python3

import subprocess
import sys
import os
import json
import glob
import yaml
from colorama import Fore, Style


def ensure_env_var(name):
    if name not in os.environ:
        print(f"Environment variable {name} not set")
        sys.exit(1)
    value = os.environ[name]
    print(name, "=", value, file=sys.stderr)
    return value


# http://jutge:h487kjlAQ$%@localhost:8001/v1/tasks
QUEUE_URL = ensure_env_var("QUEUE_URL")
JUTGE_TESTS_FOLDER = ensure_env_var("JUTGE_TESTS_FOLDER")
print(file=sys.stderr)


def exec(cmd):
    return subprocess.check_output(cmd, shell=True)


def prepare_submission(title: str, compiler: str, program: str, extension: str):
    exec("rm -rf submission")
    exec("mkdir submission")
    exec(f"cp {program} submission/program{extension}")

    submission_config = {
        "problem_id": "P68688_en",
        "compiler_id": compiler,
        "title": title,
        "description": title,
        "author": "U00000",
        "email": "info@jutge.org",
        "priority": 3,
        "public_only": False,
        "exam_id": "~",
        "competition": "~",
    }
    with open("submission/submission.yml", "w") as f:
        yaml.dump(submission_config, f)


def submit(driver: str, problem: str, program: str, image_id: str) -> tuple[str, str]:
    compiler = program.split("/")[-2]
    name, extension = os.path.splitext(program.split("/")[-1])
    title = compiler + "_" + name

    # Prepare
    prepare_submission(title, compiler, program, extension)
    exec(f"tar -czf submission.tgz --directory=submission .")
    exec(f"tar -czf driver.tgz     --directory={driver} .")
    exec(f"tar -czf problem.tgz    --directory={problem} .")
    exec(f"tar -cf data.tar driver.tgz problem.tgz submission.tgz")

    # Submit
    output = exec(
        f"http --form PUT {QUEUE_URL} file@data.tar name=mytest image_id={image_id}"
    )
    result = json.loads(output)

    # Clean up
    exec("rm -rf submission submission.tgz driver.tgz problem.tgz data.tar")
    return title, result["id"]


def check(title, task_id):
    file = f"/home/queue/tst/dat/tasks/{task_id}.output.tar.gz"
    result = exec(f"tar xf {file} correction.yml --to-stdout")
    result = yaml.load(result, Loader=yaml.FullLoader)
    expected = title.split("_")[-1].split("-")[0]
    if result["veredict"] == expected:
        sign = Fore.GREEN + "." + Style.RESET_ALL
    else:
        sign = Fore.RED + "X" + Style.RESET_ALL
    print(sign, result["veredict"], title, task_id)
    sys.stdout.flush()


def get_image_name(program: str) -> str:
    dirname = os.path.dirname(program)
    image_name = ""
    with open(dirname + "/image.yml", "r") as f:
        yml = yaml.safe_load(f)
        image_name = yml["imageName"]
    return image_name


def submit_test(test: str):
    test_folder = f"{JUTGE_TESTS_FOLDER}/tests/{test}"
    driver = f"{JUTGE_TESTS_FOLDER}/drivers/std/std"
    problem = f"{test_folder}/problem"

    for compiler in sorted(glob.glob(f"{test_folder}/languages/*")):
        if compiler.endswith("__disabled__"):
            continue
        if compiler.endswith("~"):
            continue

        for program in sorted(glob.glob(f"{compiler}/*")):
            if program.endswith(".test.ts") or program.endswith("yml"):
                continue

            image_name = get_image_name(program)
            if image_name == "esoteric":
                continue

            title, task_id = submit(driver, problem, program, image_name)
            print(title, task_id)
            sys.stdout.flush()


if len(sys.argv) < 2:
    print("Usage: submit.py <test-name>")
    sys.exit(1)

tests = sys.argv[1:]
for test in tests:
    submit_test(test)
