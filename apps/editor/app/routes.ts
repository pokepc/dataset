import { collectRoutes } from 'file-router-collector/react-router'

const fileBasedRoutes = collectRoutes({
  projectRoot: process.cwd() + '/app',
  routesDir: 'routes',
  fileExtensions: ['.tsx', '.ts'],
  ignoredPaths: [],
  ignoredPathPrefix: '_',
})

export default [...fileBasedRoutes]
