import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, ThemeColors } from '../theme';

interface Props {
  children: ReactNode;
  onGoHome?: () => void;
  theme: ThemeColors;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in descendant components and shows a
 * user-friendly fallback instead of a white screen / crash.
 */
class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO: Send to Crashlytics / Sentry
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { theme } = this.props;
    const styles = createStyles(theme);

    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Icon name="alert-circle-outline" size={64} color={theme.danger} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            accessibilityHint="Attempts to reload the screen"
          >
            <Icon name="refresh" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>

          {this.props.onGoHome && (
            <TouchableOpacity
              style={styles.homeButton}
              onPress={this.props.onGoHome}
              accessibilityRole="button"
              accessibilityLabel="Go Home"
              accessibilityHint="Returns to the home screen"
            >
              <Text style={styles.homeText}>Go Home</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary(props: Omit<Props, 'theme'>) {
  const theme = useTheme();
  return <ErrorBoundaryInner {...props} theme={theme} />;
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.danger + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 12,
    },
    message: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 30,
      paddingHorizontal: 20,
    },
    retryButton: {
      flexDirection: 'row',
      backgroundColor: theme.accent,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      marginBottom: 16,
    },
    retryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    homeButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    homeText: {
      color: theme.accent,
      fontSize: 16,
      fontWeight: '600',
    },
  });
