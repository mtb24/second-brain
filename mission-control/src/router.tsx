import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  })
}
