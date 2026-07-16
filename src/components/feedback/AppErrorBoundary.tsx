import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/design/tokens';
import { logError } from '@/src/lib/logging/logger';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('app_render_failed', { componentStack: info.componentStack ?? undefined, message: error.message });
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  public render(): ReactNode {
    if (this.state.error) {
      return <View style={styles.container}><AppText variant="title2">화면을 다시 불러올게요</AppText><AppText color="secondary">잠시 문제가 생겼어요. 사진과 기록은 안전하게 보관돼요.</AppText><Button label="다시 시도" onPress={this.handleRetry} /></View>;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', gap: spacing[4], padding: spacing[5], backgroundColor: colors.canvas } });
