import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import preserveShebang from 'rollup-plugin-preserve-shebang';
import { builtinModules} from 'module';

export default {
  input: 'src/bin/executable.js',
  external: [...builtinModules, 'faiss-node', 'word-extractor'],
  plugins: [
    preserveShebang(),
    nodeResolve({
      preferBuiltins: true,
      resolveOnly: (module) => {
        return !module.includes('faiss-node') &&
          !module.includes('.node');
      }
    }),
    json(),
    commonjs({
      requireReturnsDefault: 'auto',
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
      ignoreDynamicRequires: true
    })
  ],
  output: {
    file: 'package/lib/aux4-ai-worker.cjs',
    format: 'cjs',
    inlineDynamicImports: true
  }
};
