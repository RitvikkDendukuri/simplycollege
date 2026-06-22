import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <h1>Something went wrong on this page</h1>
          <p className="page-sub">
            The rest of the app is still running — pick another page from the
            navigation, or try again.
          </p>
          <button className="run-btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          {import.meta.env.DEV && (
            <pre className="page-error" style={{ marginTop: 16, whiteSpace: "pre-wrap", textAlign: "left" }}>
              {String(this.state.error.stack || this.state.error)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
