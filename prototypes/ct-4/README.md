# CT-4 disposable prototype

This prototype tests the architecture and interaction assumptions assigned to Control Tower issue `CT-4`. It is deliberately dependency-free at the Node/browser layer and is not production scaffolding.

```bash
npm test
npm run dev
docker compose up -d db
npm run verify:postgres
```

The interface uses 2,000 deterministic synthetic issues. Keyboard controls are `J`/`K` or arrows to navigate, `Enter` to open details, `Escape` to close the deepest layer, `C` to open issue creation, and `Cmd/Ctrl+K` for the command palette.

PostgreSQL verification creates disposable roles and tables inside the prototype database, proves row-policy isolation for two workspaces, proves unauthorized direct reads return no row, and checks stale-revision updates affect zero rows. `docker compose down -v` removes the disposable database.
