import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative } from "node:path";
import { createServer } from "node:http";

const root = process.cwd();
const port = Number(process.env.PORT ?? 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const requestedPath = join(root, pathname === "/" ? "index.html" : `.${pathname}`);
    const relativePath = relative(root, requestedPath);

    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const file = await stat(requestedPath);
    if (!file.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(requestedPath)] ?? "application/octet-stream",
    });
    createReadStream(requestedPath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Beeline is available at http://127.0.0.1:${port}/`);
});
