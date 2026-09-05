'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F4F6] dark:bg-[#0A0A0C] text-slate-900 dark:text-slate-100 p-4">
          <div className="w-full max-w-md bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              An unexpected error occurred. Please try again or contact support if the issue persists.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <p className="text-red-500/80 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] text-center flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
