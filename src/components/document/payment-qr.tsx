import { qrMatrix, qrPath } from "@/shared/qr/qr-matrix";

// A payment QR code drawn from its text as inline SVG: crisp at any size, in
// print, and nothing to host. Dark modules use currentColor on a white plate so
// scanners always get dark-on-light, whatever the theme.

/** Light margin around the code, in modules (the QR spec asks for 4; 2 scans fine and saves room). */
const QUIET = 2;

export function PaymentQrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { d, size } = qrPath(qrMatrix(value));
  const total = size + QUIET * 2;
  return (
    <svg
      role="img"
      aria-label={`${label} QR code`}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={d} transform={`translate(${QUIET} ${QUIET})`} fill="#111" />
    </svg>
  );
}
