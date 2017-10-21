# brainfuck2wasm

Compile brainfuck to webassembly.

Two pages of the linear memory are used. Each page is 64 KiB. The first one is
for the output and the second one is for the brainfuck's array which is an
array of 16384 4 byte wide cells.

Brainfuck's result is output in two format : string and array of int32.

## TODO
- Compile in a web worker
- Optimize brainfuck
- Input instruction
- Grow brainfuck's memory dynamically
- Error handling
