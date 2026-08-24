# Configuration reference

OpenLinear has safe defaults and does not require an environment file. Copy
`.env.example` to `.env` only when a local override is needed, then export its
values in your shell or process manager before starting. The runtime does not
implicitly load `.env`.

## Variables

| Variable | Default | Accepted values and effect |
| --- | --- | --- |
| `OPENLINEAR_DATA_DIR` | Platform default | Absolute or relative local directory. It must be a regular writable directory, not a symlink or file. |
| `OPENLINEAR_PORT` | `4174` | Integer from 1 through 65535. |
| `OPENLINEAR_HOST` | `127.0.0.1` | Only `127.0.0.1` and `::1` are accepted. |
| `OPENLINEAR_SESSION_TTL_SECONDS` | `43200` | Integer from 300 through 86400. The session is process-memory only. |
| `OPENLINEAR_BUILD_ID` | `development` | Optional immutable label in canonical transfer metadata. |
| `XDG_DATA_HOME` | `~/.local/share` on Linux | Parent used for the default data directory. |
| `LOCALAPPDATA` | `~/AppData/Local` on Windows | Parent used for the default data directory. |

The application rejects invalid values before it starts listening. A remote
host bind is never a supported configuration.

## Default paths

| Platform | Data directory | Database | Backups |
| --- | --- | --- | --- |
| macOS | `~/Library/Application Support/OpenLinear` | `openlinear.sqlite3` | `backups/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/openlinear` | `openlinear.sqlite3` | `backups/` |
| Windows | `%LOCALAPPDATA%\\OpenLinear` | `openlinear.sqlite3` | `backups/` |

Use `OPENLINEAR_DATA_DIR=/path/to/directory` when a disposable or isolated
workspace is needed. Do not place populated data inside the Git checkout.

## Environment examples

POSIX shell:

```sh
cp .env.example .env
set -a
. ./.env
set +a
export OPENLINEAR_DATA_DIR=/tmp/openlinear-data
export OPENLINEAR_PORT=4304
npm start
```

PowerShell:

```powershell
$env:OPENLINEAR_DATA_DIR = "$HOME\\OpenLinear-data"
$env:OPENLINEAR_PORT = "4304"
npm start
```

The `.env.example` file contains only non-secret local defaults. Keep `.env`,
SQLite files, backups, and exports out of source control.
