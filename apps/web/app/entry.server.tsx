import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shell = false;
    const nonce = context.staticHandlerContext.loaderData.root?.nonce;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={context} url={request.url} nonce={nonce} />,
      {
        nonce,
        onAllReady() {
          shell = true;
          const body = new PassThrough();
          headers.set('Content-Type', 'text/html');
          resolve(new Response(createReadableStreamFromReadable(body), { status, headers }));
          pipe(body);
        },
        onShellError: reject,
        onError(error) {
          status = 500;
          if (shell) console.error(error instanceof Error ? error.message : 'Rendering failed');
        },
      },
    );
    setTimeout(abort, 10000).unref();
  });
}
