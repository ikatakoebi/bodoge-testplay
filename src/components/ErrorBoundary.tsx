import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1a1a2e',
          color: '#e0e0e0',
          fontFamily: 'sans-serif',
          gap: 16,
        }}>
          <h2 style={{ color: '#ff6b6b', margin: 0 }}>エラーが発生しました</h2>
          <p style={{ color: '#aaa', maxWidth: 500, textAlign: 'center', margin: 0 }}>
            {this.state.error?.message || '不明なエラー'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 24px',
              background: '#2a4a6a',
              border: '1px solid #468',
              borderRadius: 6,
              color: '#acf',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
