const bfToWasm = (function() {
  'use strict';

  const CELL_SIZE = 4;
  const PAGE_SIZE = 65536;

  const section = {
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
  };

  const type = {
    block: 0x40,
    func: 0x60,
    anyfunc: 0x70,
    i32: 0x7f,
    i64: 0x7e,
    f32: 0x7d,
    f64: 0x7c,
  };

  const wasmInstr = {
    block: 0x02,
    loop: 0x03,
    end: 0x0b,
    br: 0x0c,
    br_if: 0x0d,
    getLocal: 0x20,
    setLocal: 0x21,
    i32load: 0x28,
    i32store: 0x36,
    i32const: 0x41,
    i32eqz: 0x45,
    i32add: 0x6a,
    i32sub: 0x6b,
  };

  // local 0 : brainfuck array index
  // local 1 : output array index
  const instrToWasm = {
    '>': () => [
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32const, CELL_SIZE,
      wasmInstr.i32add,
      wasmInstr.setLocal, 0x00,
    ],
    '<': () => [
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32const, CELL_SIZE,
      wasmInstr.i32sub,
      wasmInstr.setLocal, 0x00,
    ],
    '+': () => [
      wasmInstr.getLocal, 0x00,
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32load, 0x02, 0x00,
      wasmInstr.i32const, 0x01,
      wasmInstr.i32add,
      wasmInstr.i32store, 0x02, 0x00,
    ],
    '-': () => [
      wasmInstr.getLocal, 0x00,
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32load, 0x02, 0x00,
      wasmInstr.i32const, 0x01,
      wasmInstr.i32sub,
      wasmInstr.i32store, 0x02, 0x00,
    ],
    ',': () => [

    ],
    '.': () => [
      wasmInstr.getLocal, 0x01,
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32load, 0x02, 0x00,
      wasmInstr.i32store, 0x02, 0x00,

      wasmInstr.getLocal, 0x01,
      wasmInstr.i32const, CELL_SIZE,
      wasmInstr.i32add,
      wasmInstr.setLocal, 0x01,
    ],
    '[': () => [
      wasmInstr.block,
      type.block,
      wasmInstr.loop,
      type.block,
    ],
    ']': () => [
      wasmInstr.getLocal, 0x00,
      wasmInstr.i32load, 0x02, 0x00,
      wasmInstr.i32eqz,
      wasmInstr.br_if, 0x01,
      wasmInstr.br, 0x00,
      wasmInstr.end,
      wasmInstr.end,
    ],
  };

  function BfInstr(instrSymbol, toWasm, extraParams) {
    this.instrSymbol = instrSymbol;
    this.toWasm = toWasm;
    this.extraParams = extraParams || [];
  }

  function stripComments(bfStr) {
    const notInstrExp = /[^<>+\-,.[\]]/g;
    return bfStr.replace(notInstrExp, '');
  }

  function parseBf(bfStr) {
    const instrs = [];
    for (let i = 0; i < bfStr.length; i += 1) {
      const toWasm = instrToWasm[bfStr[i]];
      instrs.push(new BfInstr(bfStr[i], toWasm));
    }
    return instrs;
  }

  function optimizeInstrs(instrs) {
    return instrs;
  }

  function intToVarint(n) {
    const buffer = [];
    let more = true;
    while (more) {
      let byte = n & 0x7F;
      n >>>= 7;
      if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0)) {
        more = false;
      } else {
        byte |= 0x80;
      }
      buffer.push(byte);
    }
    return buffer;
  }

  function intToVaruint(n) {
    const buffer = [];
    do {
      let byte = n & 0x7F;
      n >>>= 7;
      if (n !== 0) {
        byte |= 0x80;
      }
      buffer.push(byte);
    } while (n !== 0);
    return buffer;
  }

  function createSection(sectionType, ...data) {
    const flatData = [].concat(...data);
    return [section[sectionType], ...intToVaruint(flatData.length), ...flatData];
  }

  function getStrBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i += 1) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  function compileToWasm(instrs) {
    const magicNumber = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    const functionsCount = 0x01;
    const startFuncIndex = 0x00;

    const startFunctionSignature = [type.func, 0x00, 0x00];
    const typeSection = createSection('type', functionsCount, startFunctionSignature);

    const importsCount = 0x01;
    const importModuleName = getStrBytes('imports');
    const importExportName = getStrBytes('memory');
    const importMemoryKind = 0x02;
    const memoryDesc = [0x00, 0x02];
    const importSection = createSection('import', importsCount, importModuleName.length, importModuleName, importExportName.length, importExportName, importMemoryKind, memoryDesc);

    const funcSection = createSection('func', functionsCount, startFuncIndex);

    const startSection = createSection('start', startFuncIndex);

    const localEntriesCount = 0x01;
    const i32VarCount = 0x02;
    const initOutputIndex = [wasmInstr.i32const, ...intToVarint(PAGE_SIZE), wasmInstr.setLocal, 0x00];
    const functionBody = instrs.reduce((res, instr) => res.concat(instr.toWasm(...instr.extraParams)), initOutputIndex);
    functionBody.push(wasmInstr.end);
    const functionLength = intToVaruint(functionBody.length + 3);
    const codeSection = createSection('code', functionsCount, ...functionLength, localEntriesCount, i32VarCount, type.i32, functionBody);

    const buffer = [...magicNumber, ...version, ...typeSection, ...importSection, ...funcSection, ...startSection, ...codeSection];
    return Uint8Array.from(buffer);
  }

  return function (bfStr, optimize = false) {
    if (bfStr == null) {
      throw new Error('Argument 0 cannot be null');
    }

    if (typeof (bfStr) !== 'string') {
      throw new Error('Expected string for argument 0');
    }

    if (typeof (optimize) !== 'boolean') {
      throw new Error('Expected boolean for argument 1');
    }

    const bfNoComment = stripComments(bfStr);
    let instrs = parseBf(bfNoComment);
    if (optimize) {
      instrs = optimizeInstrs(instrs);
    }
    return compileToWasm(instrs);
  };
})();
