import { $ } from "bun";

const makeTaskTar = async (folder: string) => {
  for (const part of ["driver", "problem", "submission"]) {
    await $`tar -czf ${part}.tgz -C ${folder}/${part} .`;
  }
  await $`tar -cf ${folder}.tar driver.tgz problem.tgz submission.tgz`;
  await $`rm -f driver.tgz problem.tgz submission.tgz`;
};

const pythonEnvCreate = async () => {
  await $`python3 -m venv venv`;
};

const pythonEnvRun = async (cmds: string[]) => {
  const script = new Response(["source venv/bin/activate", ...cmds].join("\n"));
  const { stderr } = await $`cat < ${script} | bash`.quiet();
  return stderr.toString();
};

// await $`make -C src/dockerfiles server`;
console.log(`Make tar...`);
await makeTaskTar("tests/00-hello");
console.log(`Create python environment`);
await pythonEnvCreate();
console.log(`Install toolkits`);
await pythonEnvRun(["pip3 install src/toolkit", "pip3 install src/server-toolkit"]);

console.log(`Judge submission`)
const output = await pythonEnvRun([
  `jutge-run jutge-submit this_is_a_test < tests/00-hello.tar > correction.tgz`,
]);

console.log(output.split("\n").filter(line => line.includes("end with veredict")));
