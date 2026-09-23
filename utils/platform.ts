// Which desktop we run on. The window's user agent is enough: WebView2 on
// Windows says so, WKWebView on macOS does not.
export const IS_WINDOWS = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);
