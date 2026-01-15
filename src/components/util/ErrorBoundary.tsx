"use client";

import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-border bg-card/30 p-4">
          <div className="text-sm font-semibold">{this.props.title ?? "Component crashed"}</div>
          <pre className="mt-2 text-xs whitespace-pre-wrap text-red-300">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack ?? ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
