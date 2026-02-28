
```
Shrunk 3 time(s)

Hint: Enable verbose mode in order to have the list of all failing values encountered during the run
 ❯ buildError ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/runner/utils/RunDetailsFormatter.js:156:19
 ❯ throwIfFailed ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/runner/utils/RunDetailsFormatter.js:165:11
 ❯ reportRunDetails ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/runner/utils/RunDetailsFormatter.js:178:16
 ❯ Proxy.assert ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/runner/Runner.js:61:9
 ❯ test/model-based.test.tsx:227:8
    225|     const backspaceArb = fc.constant(new BackspaceCommand());
    226| 
    227|     fc.assert(
       |        ^
    228|       fc.property(
    229|         simpleDoc.chain((doc) =>

Caused by: AssertionError: expected '0\n2. A\n1. dN oRx\n2. s J  FZ\n3. Zv…' to be '0\n2. A1. dN oRx\n2. s J  FZ\n3. Zv B…' // Object.is equality

- Expected
+ Received

  0
- 2. A1. dN oRx
+ 2. A
+ 1. dN oRx
  2. s J  FZ
  3. Zv BRfCT
  4. e  UTmDMZllO

 ❯ TypeCharCommand.run test/model-based.test.tsx:107:21
 ❯ CommandWrapper.run ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/commands/CommandWrapper.js:26:25
 ❯ runSync ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:24:17
 ❯ ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:8:24
 ❯ then ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:15:29
 ❯ ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:7:21
 ❯ Object.then ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:18:13
 ❯ genericModelRun ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:3:14
 ❯ internalModelRun ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:27:12
 ❯ Proxy.modelRun ../../node_modules/.pnpm/fast-check@4.5.3/node_modules/fast-check/lib/check/model/ModelRunner.js:50:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  21:35:03
   Duration  1.93s (transform 90ms, setup 0ms, collect 219ms, tests 1.28s, environment 188ms, prepare 41ms)
```