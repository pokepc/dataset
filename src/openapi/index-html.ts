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
        const currentBaseUrl = new URL('.', window.location.href).href.replace(/\\/$/, '');
        spec.servers = [
          {
            url: currentBaseUrl || window.location.origin,
            description: 'Current static host',
          },
        ];

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
