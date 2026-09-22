import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

it('preserves Google Storage multipart requests with the patched UUID dependency', async () => {
  // Exercise the actual optional Storage -> Gaxios 6 -> UUID dependency path.
  // The adapter captures the request locally; no cloud credentials or network are used.
  const require = createRequire(import.meta.url);
  const adminRequire = createRequire(require.resolve('firebase-admin/storage'));
  const storageRequire = createRequire(adminRequire.resolve('@google-cloud/storage'));
  const gaxiosRequire = createRequire(storageRequire.resolve('gaxios'));
  expect(gaxiosRequire('uuid/package.json').version).toBe('11.1.1');
  const { Gaxios } = storageRequire('gaxios');
  const response = await new Gaxios().request({
    url: 'https://example.invalid/upload',
    method: 'POST',
    multipart: [{ headers: { 'Content-Type': 'text/plain' }, content: 'Synthetic upload body' }],
    adapter: async (options: { headers: Record<string, string>; body: AsyncIterable<string | Buffer> }) => {
      const contentType = options.headers['Content-Type'];
      expect(contentType).toMatch(/^multipart\/related; boundary=[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
      const boundary = contentType!.split('boundary=')[1];
      let body = '';
      for await (const chunk of options.body) body += chunk.toString();
      expect(body).toBe(`--${boundary}\r\nContent-Type: text/plain\r\n\r\nSynthetic upload body\r\n--${boundary}--`);
      return { config: options, status: 200, statusText: 'OK', headers: {}, data: 'captured locally' };
    },
  });
  expect(response.data).toBe('captured locally');
});
