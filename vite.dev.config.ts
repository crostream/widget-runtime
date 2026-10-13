// vite.dev.config.ts: the dev page (dev/index.html). Serves the widget frame
// (built from src/frame on demand), the widgets of a folder of widget
// folders as packages (/pkg/<id>), and the host straight from src.
//
//   WIDGETS=/path/to/crostream-gallery/widgets npm run dev
//
// Open /?w=crostream.alert,crostream.goal to mount those widgets.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { bundleFrame, framePage } from './scripts/bundle.mjs'

const widgets = resolve(process.env.WIDGETS ?? join(process.env.HOME ?? '', 'code/crostream-gallery/widgets'))

// A folder name is a widget id or slug: no separators, no dots at the start.
const NAME = /^[a-z0-9][a-z0-9.-]*$/

function devWidgets(): Plugin {
  let frame: Promise<string> | null = null
  return {
    name: 'dev-widgets',
    configureServer(server) {
      server.watcher.on('change', (f) => {
        if (f.includes('/src/frame/') || f.includes('/src/render/') || f.includes('/src/api/')) frame = null
      })
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        try {
          if (url === '/widget-frame.html') {
            frame ??= bundleFrame()
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(framePage(await frame))
            return
          }
          const m = /^\/pkg\/([^/]+)$/.exec(url)
          if (!m) return next()
          const dir = join(widgets, m[1])
          if (!NAME.test(m[1]) || !existsSync(join(dir, 'manifest.json'))) {
            res.statusCode = 404
            res.end('no such widget')
            return
          }
          const text = (f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '')
          const man = JSON.parse(text('manifest.json'))
          const pkg = { ...man, id: man.id ?? m[1], code: { html: text('widget.html'), css: text('widget.css'), js: text('widget.js') } }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(pkg))
        } catch (e) {
          frame = null
          next(e)
        }
      })
    },
  }
}

export default defineConfig({
  root: 'dev',
  plugins: [devWidgets()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true, fs: { allow: ['..'] } },
})
