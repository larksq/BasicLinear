import { constants, accessSync, chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { homedir, platform as currentPlatform } from 'node:os';
import { join, resolve } from 'node:path';
import { AppError } from '@basiclinear/domain';

export interface LocalStoragePaths {
  dataDirectory: string;
  databasePath: string;
  backupDirectory: string;
}

export interface LocalPathRuntime {
  platform?: NodeJS.Platform;
  homeDirectory?: string;
}

export function resolveLocalStoragePaths(
  env: NodeJS.ProcessEnv = process.env,
  runtime: LocalPathRuntime = {},
): LocalStoragePaths {
  const home = runtime.homeDirectory ?? homedir();
  const platform = runtime.platform ?? currentPlatform();
  const override = env.BASICLINEAR_DATA_DIR?.trim();
  let dataDirectory: string;

  if (override) {
    dataDirectory = resolve(override);
  } else if (platform === 'darwin') {
    dataDirectory = join(home, 'Library', 'Application Support', 'BasicLinear');
  } else if (platform === 'win32') {
    dataDirectory = join(env.LOCALAPPDATA?.trim() || join(home, 'AppData', 'Local'), 'BasicLinear');
  } else {
    dataDirectory = join(env.XDG_DATA_HOME?.trim() || join(home, '.local', 'share'), 'basiclinear');
  }

  return {
    dataDirectory,
    databasePath: join(dataDirectory, 'basiclinear.sqlite3'),
    backupDirectory: join(dataDirectory, 'backups'),
  };
}

export function prepareLocalStorage(paths: LocalStoragePaths): void {
  for (const path of [paths.dataDirectory, paths.backupDirectory]) {
    try {
      let stat;
      try {
        stat = lstatSync(path);
      } catch (error) {
        if (!isErrno(error, 'ENOENT')) throw error;
        mkdirSync(path, { recursive: true, mode: 0o700 });
        stat = lstatSync(path);
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          'The BasicLinear data path must be a regular directory, not a link or file.',
          503,
          { field: 'dataDirectory' },
        );
      }
      accessSync(path, constants.R_OK | constants.W_OK);
      if (process.platform !== 'win32') chmodSync(path, 0o700);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        'The BasicLinear data directory is unavailable or not writable.',
        503,
        { field: 'dataDirectory', cause: error },
      );
    }
  }
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
