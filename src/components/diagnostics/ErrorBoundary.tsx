import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { diagLog } from './DiagnosticsOverlay';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Catches render-time crashes anywhere in the subtree and paints the error on
 * a solid, opaque background so it is visible on-device.
 *
 * Why this exists: development happens on Windows, so native crash logs are not
 * reachable. When a provider deep in the tree throws during the very first
 * render, the whole app paints nothing (just the purple window background) and
 * even the DiagnosticsOverlay — which used to live *inside* the providers — is
 * unmounted with it. This boundary sits *around* the providers and renders the
 * caught error text, turning a silent blank screen into a readable report.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    diagLog(`render crash: ${error.message}`.slice(0, 300));
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>起動エラー</Text>
        <Text style={styles.message}>{error.message}</Text>
        <ScrollView style={styles.stackBox}>
          <Text style={styles.stack}>{error.stack ?? ''}</Text>
          {info ? <Text style={styles.stack}>{info}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1b1330',
    padding: 24,
    paddingTop: 56,
    gap: 12,
  },
  title: {
    color: '#ffd2d2',
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stackBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    padding: 10,
  },
  stack: {
    color: '#d8d8e8',
    fontSize: 11,
    fontFamily: 'Courier',
  },
});
