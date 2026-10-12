import QRCode from "qrcode";
import { QR_LEVEL } from "./qr-matrix";

// A PNG of a QR code for email, where inline SVG isn't supported. Node only
// (it uses the library's PNG encoder), so keep it out of browser code.

/** A PNG of the code with its quiet zone. */
export function qrPng(value: string, options: { scale?: number } = {}): Promise<Buffer> {
  return QRCode.toBuffer(value, { type: "png", errorCorrectionLevel: QR_LEVEL, margin: 2, scale: options.scale ?? 8 });
}
