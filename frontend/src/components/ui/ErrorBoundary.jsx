import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] p-6 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-red-200 shadow-sm m-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-xl mb-3">
            <i className="fas fa-triangle-exclamation" />
          </div>
          <h2 className="font-display font-bold text-base text-navy mb-1">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            {this.state.error?.message || 'An unexpected error occurred while rendering this component.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="btn btn-primary btn-sm text-xs"
          >
            <i className="fas fa-arrows-rotate mr-1.5" />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
