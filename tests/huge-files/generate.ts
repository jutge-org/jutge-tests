#!/usr/bin/env bun
/*

Run this generator on the 'huge-files' folder to generate the test cases.

*/

const rndInt = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min + 1)) + min

let input = ``
let correct = ``
for (let j = 0; j < 5_000_000; j++) {
	const a = rndInt(1, 100_000_000)
	const b = rndInt(1, 100_000_000)
	input += `${a} ${b}\n`
	correct += `${a + b}\n`
}
await Bun.write("./problem/sample-1.inp", input)
await Bun.write("./problem/sample-1.cor", correct)
