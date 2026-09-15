"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/common/report-client-error";
import { useI18n } from "@/lib/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

interface ErrorTexts {
  title: string;
  retry: string;
}

class ErrorBoundaryClass extends Component<
  Props & { errorTexts?: ErrorTexts },
  State
> {
  constructor(props: Props & { errorTexts?: ErrorTexts }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reportClientError("react-error-boundary", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { title, retry } = this.props.errorTexts ?? {
        title: "Something went wrong",
        retry: "Try Again",
      };
      const desc = this.state.error?.message ?? "An unexpected error occurred.";

      return (
        <div role="alert" className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-heading text-lg font-semibold">{title}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {retry}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** i18n-aware wrapper: calls useI18n() and passes translated strings to the class. */
export function ErrorBoundary(props: Props) {
  const { t } = useI18n();
  return (
    <ErrorBoundaryClass
      {...props}
      errorTexts={{
        title: t("common.error.title", "Something went wrong"),
        retry: t("common.error.retry", "Try Again"),
      }}
    />
  );
}
