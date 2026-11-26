import React, { type ReactNode } from 'react';
import { Button } from './Button';
import { PageContainer } from './PageContainer';
import { StateView } from './StateView';

export class RouteErrorBoundary extends React.Component<
  { children: ReactNode; onHome: () => void; hasTopbar: boolean },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('Não foi possível abrir esta página:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <PageContainer hasTopbar={this.props.hasTopbar}>
        <StateView
          status="error"
          title="Não foi possível abrir esta página"
          description="Verifique sua conexão e tente novamente. Se o problema continuar, volte ao início."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
              <Button variant="secondary" onClick={this.props.onHome}>Voltar ao início</Button>
            </div>
          }
        />
      </PageContainer>
    );
  }
}
