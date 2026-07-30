import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Fångar fel i en enskild vy så att användaren aldrig möts av en tom sida.
 * Tekniska detaljer loggas – de visas aldrig för användaren.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[travhub] vyfel", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-lg font-semibold">Den här delen kunde inte visas</p>
        <p className="mt-1 text-base text-muted-foreground">
          Något gick fel. Prova att ladda om sidan – dina uppgifter är kvar.
        </p>
        <Button className="mt-4" size="lg" onClick={() => window.location.reload()}>
          Ladda om sidan
        </Button>
      </div>
    );
  }
}
