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
        background: #172125;
        border-bottom: 1px solid #263338;
        padding: 12px 0;
      }

      .swagger-ui .topbar .wrapper {
        padding: 0 24px;
      }

      .swagger-ui .topbar .topbar-wrapper {
        align-items: center;
        display: flex;
        max-width: none;
      }

      .swagger-ui .topbar .download-url-wrapper {
        display: none;
      }

      .swagger-ui .topbar .topbar-wrapper .link {
        align-items: center;
        display: inline-flex;
        gap: 12px;
        max-width: none;
      }

      .swagger-ui .topbar .topbar-wrapper .link svg,
      .swagger-ui .topbar .topbar-wrapper .link span {
        display: none;
      }

      .swagger-ui .topbar .topbar-wrapper .link::before {
        background-image: url("https://avatars.githubusercontent.com/u/186428333?s=200&v=4");
        background-position: center;
        background-repeat: no-repeat;
        background-size: contain;
        content: "";
        display: block;
        flex: 0 0 auto;
        height: 42px;
        width: 42px;
      }

      .swagger-ui .topbar .topbar-wrapper .link::after {
        color: #f6fbf8;
        content: "${brandName}";
        display: block;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.1;
        white-space: pre;
      }

      .swagger-ui .topbar .topbar-wrapper .link::first-line {
        font-size: 20px;
      }

      .swagger-ui .topbar .topbar-wrapper .link::after {
        text-transform: none;
      }
    </style>
  </head>
  <body>
    <nav id="version-docs" aria-label="Dataset version documentation" hidden></nav>
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
