import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Connect, Plugin, ViteDevServer } from 'vite';

const API_DIRECTORY = 'api';
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function readBody(request: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload muito grande.'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function sendError(response: import('node:http').ServerResponse, status: number, message: string) {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({ message }));
}

function resolveHandlerFile(root: string, pathname: string) {
  const relative = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  if (!relative || relative.split('/').some((segment) => !segment || segment.startsWith('_') || segment === '..')) {
    return null;
  }
  const base = path.join(root, API_DIRECTORY, relative);
  const candidates = [`${base}.js`, path.join(base, 'index.js')];
  return candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    const apiRoot = path.resolve(root, API_DIRECTORY);
    return resolved.startsWith(apiRoot) && fs.existsSync(resolved);
  }) || null;
}

export function devApiPlugin(): Plugin {
  return {
    name: 'mind-nutrition-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url || '';
        if (!url.startsWith('/api/')) {
          next();
          return;
        }

        const pathname = url.split('?')[0];
        const file = resolveHandlerFile(server.config.root, pathname);
        if (!file) {
          sendError(response, 404, 'Endpoint não encontrado.');
          return;
        }

        try {
          if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
            (request as unknown as { body: unknown }).body = await readBody(request);
          }
          const stats = fs.statSync(file);
          const module = await import(`${pathToFileURL(file).href}?v=${stats.mtimeMs}`);
          const handler = module.default;
          if (typeof handler !== 'function') {
            sendError(response, 500, 'Handler de API inválido.');
            return;
          }
          await handler(request, response);
        } catch (error) {
          const status = Number((error as { statusCode?: number })?.statusCode) || 500;
          const message = error instanceof Error ? error.message : 'Erro interno na API de desenvolvimento.';
          console.error('[dev-api]', pathname, error);
          sendError(response, status, message);
        }
      });
    },
  };
}
