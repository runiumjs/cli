import { PathLike } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  access,
  constants,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Service } from 'typedi';
import { JSONObject, RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';

type Resolve = () => void;
type Reject = (error: Error) => void;
type Data = Parameters<typeof writeFile>[1];

@Service()
export class FileService {
  /**
   * Reads a file as text
   * @param path
   * @param options
   */
  async read(
    path: string,
    options: { encoding?: BufferEncoding } = {}
  ): Promise<string> {
    try {
      return await readFile(path, { encoding: options.encoding || 'utf-8' });
    } catch (ex) {
      throw new RuniumError(
        `Can not read file ${path}`,
        ErrorCode.FILE_READ_ERROR,
        { path, options, original: ex }
      );
    }
  }

  /**
   * Writes data to a file
   * @param path
   * @param data
   * @param options
   */
  async write(
    path: string,
    data: string,
    options: { encoding?: BufferEncoding } = {}
  ): Promise<void> {
    try {
      await writeFile(path, data, { encoding: options.encoding || 'utf-8' });
    } catch (ex) {
      throw new RuniumError(
        `Can not write file ${path}`,
        ErrorCode.FILE_WRITE_ERROR,
        { path, data, options, original: ex }
      );
    }
  }

  /**
   * Reads a JSON file
   * @param path
   */
  async readJson<T = JSONObject>(path: string): Promise<T> {
    try {
      const data = await readFile(path, { encoding: 'utf-8' });
      return JSON.parse(data);
    } catch (ex) {
      throw new RuniumError(
        `Can not read JSON file ${path}`,
        ErrorCode.FILE_READ_JSON_ERROR,
        { path, original: ex }
      );
    }
  }

  /**
   * Writes a JSON file
   * @param path
   * @param data
   */
  async writeJson<T = JSONObject>(path: string, data: T): Promise<void> {
    try {
      await writeFile(path, JSON.stringify(data, null, 2), {
        encoding: 'utf-8',
      });
    } catch (ex) {
      throw new RuniumError(
        `Can not write JSON file ${path}`,
        ErrorCode.FILE_WRITE_JSON_ERROR,
        { path, data, original: ex }
      );
    }
  }

  /**
   * Checks if a file or directory exists
   * @param path
   */
  async isExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove a file or directory recursively
   * @param path
   */
  async remove(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (ex) {
      throw new RuniumError(
        `Can not remove ${path}`,
        ErrorCode.FILE_REMOVE_ERROR,
        { path, original: ex }
      );
    }
  }

  /**
   * Create directory recursively if it does not exist
   * @param path
   */
  async ensureDirExists(path: string): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (ex) {
      throw new RuniumError(
        `Can not create directory ${path}`,
        ErrorCode.FILE_CREATE_DIR_ERROR,
        { path, original: ex }
      );
    }
  }

  /**
   * Create an atomic file writer
   * @param path
   */
  createAtomicWriter(path: PathLike): AtomicWriter {
    return new AtomicWriter(path);
  }
}

/**
 * Creates a temporary file name for a given file
 * @param file
 */
function getTempFilename(file: PathLike): string {
  const f = file instanceof URL ? fileURLToPath(file) : file.toString();
  return join(dirname(f), `.${basename(f)}.tmp`);
}

/**
 * Retries an asynchronous operation with a delay between retries and a maximum retry count
 * @param fn
 * @param maxRetries
 * @param delayMs
 */
async function retryAsyncOperation(
  fn: () => Promise<void>,
  maxRetries: number,
  delayMs: number
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Atomic file writer
 *
 * Allows writing to a file atomically
 * based on https://github.com/typicode/steno
 */
export class AtomicWriter {
  private readonly filename: PathLike;
  private readonly tempFilename: PathLike;
  private locked = false;
  private prev: [Resolve, Reject] | null = null;
  private next: [Resolve, Reject] | null = null;
  private nextPromise: Promise<void> | null = null;
  private nextData: Data | null = null;

  constructor(filename: PathLike) {
    this.filename = filename;
    this.tempFilename = getTempFilename(filename);
  }

  /**
   * Add data for later write
   * @param data
   */
  private addData(data: Data): Promise<void> {
    // keep only most recent data
    this.nextData = data;

    // create a singleton promise to resolve all next promises once next data is written
    this.nextPromise ||= new Promise((resolve, reject) => {
      this.next = [resolve, reject];
    });

    // return a promise that will resolve at the same time as next promise
    return new Promise((resolve, reject) => {
      this.nextPromise?.then(resolve).catch(reject);
    });
  }

  /**
   * Write data to a file atomically
   * @param data
   */
  private async writeData(data: Data): Promise<void> {
    this.locked = true;
    try {
      await writeFile(this.tempFilename, data, 'utf-8');
      await retryAsyncOperation(
        async () => {
          await rename(this.tempFilename, this.filename);
        },
        10,
        100
      );

      // resolve
      this.prev?.[0]();
    } catch (err) {
      // reject
      if (err instanceof Error) {
        this.prev?.[1](err);
      }
      throw err;
    } finally {
      this.locked = false;

      this.prev = this.next;
      this.next = this.nextPromise = null;

      if (this.nextData !== null) {
        const nextData = this.nextData;
        this.nextData = null;
        await this.write(nextData);
      }
    }
  }

  /**
   * Write data to a file atomically
   * @param data
   */
  async write(data: Data): Promise<void> {
    try {
      await (this.locked ? this.addData(data) : this.writeData(data));
    } catch (ex) {
      throw new RuniumError(
        `Can not write file ${this.filename}`,
        ErrorCode.FILE_WRITE_ERROR,
        { path: this.filename, data, original: ex }
      );
    }
  }

  /**
   * Writes a JSON file
   * @param data
   */
  async writeJson<T = JSONObject>(data: T): Promise<void> {
    return this.write(JSON.stringify(data, null, 2));
  }
}
