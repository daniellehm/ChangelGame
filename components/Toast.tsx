interface Props {
  message: string;
  show: boolean;
}

/** Always in the DOM (as in the prototype), slid off-screen when hidden. */
export function Toast({ message, show }: Props) {
  return (
    <div className={show ? "toast show" : "toast"} id="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
