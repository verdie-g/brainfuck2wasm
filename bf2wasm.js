const bfToWasm = (function() {
  'use strict';

  const Section = {
    type: 0x01,
    import: 0x02,
    func: 0x03,
    table: 0x04,
    memory: 0x05,
    global: 0x06,
    export: 0x07,
    start: 0x08,
    elem: 0x09,
    code: 0x0a,
    elem: 0x0b
  };

  const InstrToWasm = {
    '>': (buffer, loopStack) => [],
    '<': (buffer, loopStack) => [],
    '+': (buffer, loopStack) => [],
    '-': (buffer, loopStack) => [],
    ',': (buffer, loopStack) => [],
    '.': (buffer, loopStack) => [],
    '[': (buffer, loopStack) => [],
    ']': (buffer, loopStack) => []
  };

  function BfInstr(instrSymbol, toWasm, extraParams) {
    this.instrSymbol = instrSymbol;
    this.toWasm = toWasm;
    this.extraParams = extraParams || [];
  }

  function stripComments(bfStr) {
    const notInstrExp = /[^<>\+\-,\.\[\]]/g;
    return bfStr.replace(notInstrExp, '');
  }

  function parseBf(bfStr) {
    const instrs = [];
    for (const symbol of bfStr) {
      const toWasm = InstrToWasm[symbol];
      instrs.push(new BfInstr(symbol, toWasm));
    }
    return instrs;
  }

  function optimizeBf(instrs) {
    return instrs;
  }

  function createSection(sectionType, ...data) {
    const flatData = [].concat.apply([], data);
    return [Section[sectionType], flatData.length, ...flatData];
  }

  function compileToWasm(instrs) {
    const magicNumber = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    const functionsCount = 0x01;
    const startFuncIndex = 0x00;
    
    const startFunctionSignature = [0x60, 0x00, 0x00];
    const typeSection = createSection('type', functionsCount, startFunctionSignature);

    const funcSection = createSection('func', functionsCount, startFuncIndex);

    const startSection = createSection('start', startFuncIndex);

    const functionBody = instrs.reduce((res, instr) => res.concat(instr.toWasm(...instr.extraParams)), []);
    const localVarCount = 0x02;
    const codeSection = createSection('code', functionBody.length + 2, functionsCount, localVarCount);

    const buffer = [...magicNumber, ...version, ...typeSection, ...funcSection, ...startSection, ...codeSection];
    return Uint8Array.from(buffer);
  }

  return function(bfStr, optimize = false) {
    if (bfStr == null)
      throw new Error('Brainfuck string cannot be null.');

    if (typeof (bfStr) !== 'string')
      throw new Error('String expected for brainfuck.');

    if (typeof (optimize) !== 'boolean')
      throw new Error('Boolean expected for optimize.');

    const bfNoComment = stripComments(bfStr); 
    let instrs = parseBf(bfNoComment);
    if (optimize) {
      instrs = optimizeBf(instrs);
    }
    return compileToWasm(instrs);
  }
})();

const wasm = bfToWasm('+++');
console.log(wasm);