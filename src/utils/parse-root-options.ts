/**
 * Parse root options from command line arguments
 * @param args
 */
export function parseRootOptions(args: string[] = process.argv.slice(2)): {
  profile: string;
  debug: boolean;
} {
  const result = {
    profile: '',
    debug: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-D' || arg === '--debug') {
      result.debug = true;
    } else if (arg === '-P' || arg === '--profile') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.profile = args[i + 1];
        i++;
      }
    } else if (arg.startsWith('--profile=')) {
      result.profile = arg.substring('--profile='.length);
    }
  }

  return result;
}
