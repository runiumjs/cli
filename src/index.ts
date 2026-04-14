#!/usr/bin/env node

import 'reflect-metadata';
import { Container } from 'typedi';
import { RuniumCliApp } from './app.js';
import { OutputService, ShutdownService } from '@services';

async function main() {
  const app = new RuniumCliApp();
  await app.start();
}

main().catch(error => {
  const outputService = Container.get(OutputService);
  outputService.error('Error: %s', error.message);
  outputService.debug('Error details:', {
    code: error.code,
    payload: error.payload,
  });
  const shutdownService = Container.get(ShutdownService);
  shutdownService.shutdown('error').catch(() => {
    process.exit(1);
  });
});
