importScripts('bf2wasm.js');

onmessage = e => {
    const bf = e.data;
    const wasm = bfToWasm(bf);
    const memory = new WebAssembly.Memory({ initial: 2 });
    const imports = { imports: { memory: memory } };
    WebAssembly.instantiate(wasm, imports).then(instance => postMessage(memory.buffer));
};