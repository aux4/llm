import fs from 'fs';
import path from 'path';

export default function rawPlugin() {
  return {
    name: 'raw',
    resolveId(id, importer) {
      if (id.endsWith('?raw')) {
        const filePath = id.replace('?raw', '');
        if (importer) {
          const resolvedPath = path.resolve(path.dirname(importer), filePath);
          return resolvedPath + '?raw';
        }
        return id;
      }
      return null;
    },
    load(id) {
      if (id.endsWith('?raw')) {
        const filePath = id.replace('?raw', '');
        const content = fs.readFileSync(filePath, 'utf-8');
        return `export default ${JSON.stringify(content)};`;
      }
      return null;
    }
  };
}