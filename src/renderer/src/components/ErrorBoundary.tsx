import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <AlertTriangle className="h-8 w-8" />
          <p className="text-sm font-medium">{this.props.fallbackLabel ?? 'Something went wrong'}</p>
          <p className="text-xs">{this.state.error?.message}</p>
          <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
