import { Component } from '@wordpress/element';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("SystemDeck: Widget Crashed", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
             // Fallback UI
            return this.props.fallback ? this.props.fallback(this.state.error) : (
                <div className="sd-widget-crash">
                    <span className="dashicons dashicons-warning"></span>
                    <strong>Widget Crashed</strong>
                    <span className="sd-widget-crash__detail">{this.state.error?.message}</span>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
