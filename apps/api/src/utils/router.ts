// Simple router utility for handling routes
import { IncomingMessage, ServerResponse } from 'http';

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export interface Route {
  method: string;
  path: string | RegExp;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string | RegExp, handler: RouteHandler) {
    this.routes.push({ method, path, handler });
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = req.method || 'GET';
    const url = req.url || '/';
    
    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      if (typeof route.path === 'string') {
        if (url === route.path || url.startsWith(route.path + '/')) {
          await route.handler(req, res);
          return true;
        }
      } else if (route.path instanceof RegExp) {
        if (route.path.test(url)) {
          await route.handler(req, res);
          return true;
        }
      }
    }
    
    return false;
  }
}

