#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { esbuildDecorators } from 'esbuild-decorators';

const buildConfig = {
  entryPoints: ['src/**/*.ts'],
  bundle: false,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  outdir: 'lib',
  sourcemap: false,
  minify: true,
  treeShaking: false,
  plugins: [
    esbuildDecorators({
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      customDecoratorHandler: undefined,
    }),
  ],
  metafile: true,
  logLevel: 'info',

};


async function buildProject() {
  try {
    console.log('🔨 Building project with esbuild...');

    const libDir = 'lib';
    if (!existsSync(libDir)) {
      mkdirSync(libDir, { recursive: true });
    }

    const result = await build(buildConfig);

    // Delete .d.js files from the output directory
    console.log('🧹 Cleaning up .d.js files...');
    deleteDtsFiles(libDir);

    if (process.platform !== 'win32') {
      try {
        chmodSync('lib/index.js', '755');
        console.log('🔐 Made lib/index.js executable');
      } catch (error) {
        console.warn('⚠️  Could not make file executable:', error.message);
      }
    }

    console.log('🔨 Processing package.json...');
    await processPackageJson();

    console.log('✅ Build completed successfully!');

    // Print build stats if in development mode
    if (result.metafile) {
      console.log('\n📊 Build statistics:');
      const outputs = result.metafile.outputs;
      for (const [file, info] of Object.entries(outputs)) {
        console.log(`  ${file}: ${(info.bytes / 1024).toFixed(2)} KB`);
      }
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function processPackageJson() {
  let originalPackageJson = readFileSync('./package.json', {
    encoding: 'utf-8',
  });

  let packageJson = JSON.parse(originalPackageJson);
  const { dependencies } = packageJson;

  delete packageJson.dependencies;
  delete packageJson.devDependencies;
  delete packageJson.scripts;
  delete packageJson.module;
  delete packageJson.main;

  console.log('✅ Processed package.json', packageJson);

  packageJson = Object.assign(packageJson, {
    module: './index.js',
    bin: {
      runium: './index.js',
    },
    dependencies,
  });

  writeFileSync(
    resolve(import.meta.dirname, 'lib', 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

function deleteDtsFiles(dir) {
  const files = readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = resolve(dir, file.name);
    if (file.isDirectory()) {
      deleteDtsFiles(fullPath);
    } else if (file.name.endsWith('.d.js')) {
      unlinkSync(fullPath);
      console.log(`🗑️  Deleted ${fullPath}`);
    }
  }
}

buildProject();
