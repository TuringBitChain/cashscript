import fs from 'fs';
import { URL } from 'url';
import { compileString, parseCode } from '../../src/compiler.js';
import { buildLineToAsmMap, bytecodeToAsm, bytecodeToScript } from '@cashscript/utils';
import { hexToBin } from '@bitauth/libauth';

describe('Location', () => {
  it('should retrieve correct text from location', () => {
    const code = fs.readFileSync(new URL('../valid-contract-files/simple_functions.cash', import.meta.url), { encoding: 'utf-8' });
    const ast = parseCode(code);

    const f = ast.contract.functions[0];

    expect(f.location).toBeDefined();
    expect((f.location!).text(code)).toEqual('function hello(sig s, pubkey pk) {\n        require(checkSig(s, pk));\n    }');
  });

  const wrap = (code: string): string => {
    return `
contract test() {
  function test() {
    require(${code});
  }
}`;
  };

  describe('should produce same bytecode', () => {
    const blocks = [
      '1 < 1', '1 <= 1', '1 == 1', '1 != 1', '1 > 1', '1 >= 1',
      '(1 - 1) == 1', '(1 + 1) == 1', '(1 * 1) == 1', '(1 / 1) == 1',
      '(true && true) == true', '(true || true) == true',
      '(0x01 & 0x01) == 0x01', '(0x01 | 0x01) == 0x01', '(0x01 ^ 0x01) == 0x01',
      '"1" + "1" == "1"', '"1" + "1" != "1"', '"11".split(1)[0] == "1"', '"11".split(1)[1] == "1"',
      '"1".reverse() == "1"', '"1".length == 1', '0x01.length == 1', '-333 == 1',
      'tx.inputs[0].tokenAmount == 1',
      'this.activeInputIndex == 1', 'tx.version == 1',
      'abs(-1) == 1', 'within(1,1,1) == true', 'bytes(sha256(1)) == bytes(0x01)',
      'checkSig(sig(0x00), pubkey(0x00))', 'checkMultiSig([sig(0x00), sig(0x00)], [pubkey(0x00), pubkey(0x00)])',
      'checkDataSig(datasig(0x00), 0x00, pubkey(0x00))',
      'tx.time >= 1', 'tx.age >= 1',
      'bytes(1) == 0x01', 'int(0x01) == 1',
    ];

    blocks.forEach(block => {
      it(`should test ${block}`, () => {
        {
          const source = wrap(block);

          // Compile the source code using regular CashScript compilation
          const artifact = compileString(source);
          const expected = bytecodeToAsm(hexToBin(artifact.debug!.bytecode));

          // Generate the opCodeMap from the source code
          const opCodeMap = buildLineToAsmMap(
            bytecodeToScript(hexToBin(artifact.debug!.bytecode)), artifact.debug!.sourceMap,
          );

          // Convert the opCodeMap to CashScript bytecode to make sure that the generated opcode map matches the
          // bytecode generated by CashScript
          const received = Object.values(opCodeMap).join(' ')
            .replaceAll('<0x', '').replaceAll('>', '').replace(/\s+/g, ' ');
          expect(received).toBe(expected);
        }

        // Repeat the tests with the source code modified to test the position hint functionality
        {
          const source = wrap(block.replaceAll(' ', '\n').replaceAll(')', '\n)'))
            .replaceAll('(\n)', '()').replace(/\((?!\))/g, '(\n');
          const artifact = compileString(source);
          const expected = bytecodeToAsm(hexToBin(artifact.debug!.bytecode));
          const opCodeMap = buildLineToAsmMap(
            bytecodeToScript(hexToBin(artifact.debug!.bytecode)), artifact.debug!.sourceMap,
          );

          const received = Object.values(opCodeMap).join(' ')
            .replaceAll('<0x', '').replaceAll('>', '').replace(/\s+/g, ' ');
          expect(received).toBe(expected);
        }
      });
    });
  });
});
