const swaggerUiVersion = '5.32.6'
const brandName = 'PokePC Dataset API'

export function renderOpenApiIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PokePC Dataset API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #ffffff;
      }

      #version-docs {
        background: #172125;
        border-bottom: 1px solid #354348;
        color: #c2cdd2;
        padding: 10px 24px;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 13px;
      }

      #version-docs:not([hidden]) {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .version-label {
        margin-right: 8px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #version-docs a {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        box-sizing: border-box;
        padding: 7px 12px;
        border: 1px solid transparent;
        border-radius: 8px;
        color: #dce5e9;
        font-weight: 500;
        text-decoration: none;
      }

      #version-docs a:hover {
        background: #28383f;
        color: #ffffff;
      }

      #version-docs a[aria-current="page"] {
        background: #24474e;
        border-color: #53858f;
        color: #ffffff;
      }

      #version-docs a:focus-visible {
        outline: 2px solid #92d5e4;
        outline-offset: 2px;
      }

      .version-number {
        color: #c2cdd2;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }

      @media (max-width: 600px) {
        #version-docs { padding: 12px 16px; gap: 6px; }
        .version-label { flex-basis: 100%; margin: 0 0 2px; }
      }

      .swagger-ui .topbar {
        display: none;
      }

      .docs-header {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 24px;
        background: #172125;
        border-bottom: 1px solid #263338;
        padding: 12px 24px;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .docs-brand {
        align-items: center;
        display: inline-flex;
        gap: 12px;
        color: #f6fbf8;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.1;
        text-decoration: none;
      }

      .docs-brand img {
        flex: 0 0 auto;
        height: 42px;
        width: 42px;
      }

      .project-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-left: auto;
      }

      .project-links a {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        box-sizing: border-box;
        padding: 7px 12px;
        border-radius: 8px;
        color: #dce5e9;
        font-size: 13px;
        font-weight: 500;
        text-decoration: none;
      }

      .project-links a:hover {
        background: #28383f;
        color: #ffffff;
      }

      .docs-header a:focus-visible {
        outline: 2px solid #92d5e4;
        outline-offset: 2px;
      }

      .project-links svg {
        flex: 0 0 auto;
        fill: currentColor;
      }

      @media (max-width: 600px) {
        .docs-header { padding: 12px 16px; }
        .project-links { margin-left: 0; }
      }
    </style>
  </head>
  <body>
    <nav id="version-docs" aria-label="Dataset version documentation" hidden></nav>
    <header class="docs-header">
      <a class="docs-brand" href="./">
        <img src="https://avatars.githubusercontent.com/u/186428333?s=200&v=4" alt="" width="42" height="42" />
        <span>${brandName}</span>
      </a>
      <nav class="project-links" aria-label="Project links">
        <a href="https://www.npmjs.com/package/@pokepc/dataset">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="14" viewBox="0 0 18 7" aria-hidden="true" focusable="false">
            <path d="M0 0h18v6H9v1H5V6H0V0zm1 1v4h2V2h1v3h1V1H1zm5 0v5h2V5h2V1H6zm2 1h1v2H8V2zm3-1v4h2V2h1v3h1V2h1v3h1V1h-6z" fill-rule="evenodd" />
          </svg>
          <span>@pokepc/dataset</span>
        </a>
        <a href="https://github.com/pokepc/dataset">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.334-5.467-5.931 0-1.31.467-2.381 1.235-3.221-.135-.303-.54-1.524.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.28-1.552 3.285-1.23 3.285-1.23.645 1.652.24 2.873.12 3.176.765.84 1.23 1.911 1.23 3.221 0 4.609-2.805 5.625-5.475 5.921.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          <span>GitHub</span>
        </a>
      </nav>
    </header>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.addEventListener('load', async () => {
        const response = await fetch('./openapi.json', { cache: 'no-cache' });
        if (!response.ok) {
          document.body.textContent = 'Unable to load ./openapi.json';
          return;
        }

        const spec = await response.json();
        // Resolve the single-checkout builder's relative server without replacing versioned servers.
        spec.servers = (spec.servers || [{ url: '.' }]).map((server) => ({
          ...server,
          url: new URL(server.url, window.location.href).href.replace(/\\/$/, ''),
        }));

        if (spec.servers.length > 1) {
          const navigation = document.getElementById('version-docs');
          navigation.hidden = false;
          const label = document.createElement('span');
          label.className = 'version-label';
          label.textContent = 'Dataset version';
          navigation.append(label);
          // The spec puts the current server first; navigation keeps a stable spatial order.
          const rank = (server) => {
            const segment = new URL(server.url).pathname.split('/').pop();
            return segment === 'latest' ? 1 : /^v\\d+$/.test(segment) ? Number(segment.slice(1)) + 2 : 0;
          };
          const currentUrl = new URL('.', window.location.href).href;
          for (const server of [...spec.servers].sort((a, b) => rank(a) - rank(b))) {
            const link = document.createElement('a');
            link.href = server.url + '/';
            link.title = server.description || server.url;
            link.textContent = rank(server) === 0 ? 'dev' : rank(server) === 1 ? 'latest' : new URL(server.url).pathname.split('/').pop();
            if (link.href === currentUrl) link.setAttribute('aria-current', 'page');
            const version = server.description?.match(/\\(([^)]+)\\)$/)?.[1];
            if (version && rank(server) > 0) {
              const badge = document.createElement('span');
              badge.className = 'version-number';
              badge.textContent = version;
              link.append(badge);
            }
            navigation.append(link);
          }
        }

        window.ui = SwaggerUIBundle({
          spec,
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
          validatorUrl: null,
        });
      });
    </script>
  </body>
</html>
`
}
