'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Keeps one bad tile from taking down the whole map.
 *
 * useGLTF throws (and suspends forever) when a model 404s or fails to parse.
 * Without a boundary per tile that propagates to the Canvas' Suspense and the
 * entire dream world renders blank -- so a single mistyped filename in the admin
 * panel loses the map for every child. React offers no hook equivalent for
 * error boundaries, so this has to be a class component.
 */
export default class TileErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[TileErrorBoundary] tile failed to render:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
