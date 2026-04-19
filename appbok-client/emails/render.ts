import { render } from '@react-email/render';

/**
 * Renders a React Email component to plain HTML string.
 * Used by email.js on the server side.
 */
export function renderEmail<T>(Component: (props: T) => JSX.Element, props: T) {
  return render(Component({ ...props }), { pretty: true });
}
