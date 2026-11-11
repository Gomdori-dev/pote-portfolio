"use client";

import { useState } from "react";
import { T } from "@/lib/i18n";

export function EmailFallback({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the address is still visible/selectable as plain text.
    }
  };

  return (
    <span className="email-fallback">
      <code>{address}</code>
      <button type="button" onClick={copy}>{copied ? <T k="copyEmailButtonCopied" /> : <T k="copyEmailButton" />}</button>
    </span>
  );
}
