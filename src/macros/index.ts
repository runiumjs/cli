import { base64decodeMacro, base64encodeMacro } from './base64.js';
import { eqMacro, neMacro } from './conditional.js';
import { dateMacro, timestampMacro } from './date.js';
import { emptyMacro } from './empty.js';
import { envMacro } from './env.js';
import { fileContentMacro } from './file.js';
import { jsonMacro } from './json.js';
import { maxMacro, minMacro, randomMacro } from './math.js';
import { platformMacro, usernameMacro } from './os.js';
import { homeDirMacro, pathMacro, tmpDirMacro } from './path.js';
import { uuidMacro } from './unique.js';

export const macros = {
  base64decode: base64decodeMacro,
  base64encode: base64encodeMacro,
  date: dateMacro,
  homedir: homeDirMacro,
  env: envMacro,
  empty: emptyMacro,
  eq: eqMacro,
  ne: neMacro,
  content: fileContentMacro,
  json: jsonMacro,
  path: pathMacro,
  platform: platformMacro,
  random: randomMacro,
  min: minMacro,
  max: maxMacro,
  tmpdir: tmpDirMacro,
  timestamp: timestampMacro,
  uuid: uuidMacro,
  username: usernameMacro,
};
