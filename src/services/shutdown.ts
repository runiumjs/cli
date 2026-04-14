import { Inject, Service } from 'typedi';
import { OutputService, PluginService } from '@services';

type ShutdownBlocker = (reason?: string) => Promise<void> | void;

const TIMEOUT = 30000;
const EXIT_DELAY = 250;
const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGQUIT'];

@Service()
export class ShutdownService {
  private blockers: Set<ShutdownBlocker> = new Set();
  private isShuttingDown = false;

  constructor(
    @Inject() private outputService: OutputService,
    @Inject() private pluginService: PluginService
  ) {}
  /**
   * Initialize shutdown handlers
   */
  async init(): Promise<void> {
    SIGNALS.forEach(signal => {
      process.on(signal, () => {
        this.shutdown(signal).catch(error => {
          this.outputService.error('Error during shutdown: %s', error.message);
          this.outputService.debug('Error details:', error);
          process.exit(1);
        });
      });
    });

    process.on('uncaughtException', error => {
      this.outputService.error('Uncaught exception: %s', error.message);
      this.outputService.debug('Error details:', error);
      this.shutdown('uncaughtException').catch(() => {
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.outputService.error(
        'Unhandled rejection at:',
        promise,
        'reason:',
        reason
      );
      this.outputService.debug('Error details:', { reason, promise });
      this.shutdown('unhandledRejection').catch(() => {
        process.exit(1);
      });
    });

    process.on('beforeExit', () => {
      if (!this.isShuttingDown) {
        this.shutdown('exit').catch(() => {
          process.exit(1);
        });
      }
    });
  }

  /**
   * Add a shutdown blocker function
   * @param blocker
   */
  addBlocker(blocker: ShutdownBlocker): void {
    this.blockers.add(blocker);
  }

  /**
   * Remove a shutdown blocker
   * @param blocker
   */
  removeBlocker(blocker: ShutdownBlocker): boolean {
    return this.blockers.delete(blocker);
  }

  /**
   * Execute graceful shutdown
   * @param reason
   */
  async shutdown(reason?: string): Promise<void> {
    if (this.isShuttingDown || !reason) {
      return;
    }

    // add plugin beforeExit hooks as shutdown blockers
    const plugins = this.pluginService.getAllPlugins();
    for (const plugin of plugins) {
      const hook = plugin.hooks?.app?.beforeExit;
      if (hook) {
        this.addBlocker(hook.bind(plugin, reason));
      }
    }

    this.isShuttingDown = true;

    const exitProcess = (code: number): void => {
      setTimeout(() => {
        process.exit(code);
      }, EXIT_DELAY);
    };

    if (this.blockers.size === 0) {
      exitProcess(0);
      return;
    }

    try {
      await this.executeBlockersWithTimeout(reason);
      exitProcess(0);
    } catch (error) {
      exitProcess(1);
    }
  }

  /**
   * Execute all blockers with timeout
   * @param reason
   */
  private async executeBlockersWithTimeout(reason: string): Promise<void> {
    const blockerPromises = Array.from(this.blockers).map(blocker =>
      this.executeBlocker(blocker, reason)
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${TIMEOUT}ms`));
      }, TIMEOUT);
    });

    await Promise.race([Promise.allSettled(blockerPromises), timeoutPromise]);
  }

  /**
   * Execute a single blocker with error handling
   * @param blocker
   * @param reason
   */
  private async executeBlocker(
    blocker: ShutdownBlocker,
    reason: string
  ): Promise<void> {
    await blocker(reason);
  }
}
