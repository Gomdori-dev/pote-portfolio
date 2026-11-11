"use client";

import { useState } from "react";
import { ArtworkRegistrationFields } from "./ArtworkRegistrationFields";
import { parseArtworkExtras, type ArtworkExtras } from "@/lib/artwork-extras";
import { registrationError } from "@/lib/artwork-registration";
import { resizeImage } from "@/lib/portal-image";
import { useLanguage, useT, type DictKey } from "@/lib/i18n";

export function ArtworkRegistrationEditor({ slug, extras, price, onSaved }: { slug: string; extras?: ArtworkExtras; price: string; onSaved: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [value, setValue] = useState<ArtworkExtras>(extras ?? {});
  const [amount, setAmount] = useState(price);
  const [photo, setPhoto] = useState<File>();
  const [hasPhoto, setHasPhoto] = useState(Boolean(extras?.proof?.edge));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const issue = registrationError(parseArtworkExtras(value), amount, hasPhoto || Boolean(photo));
    if (issue) { setError(t(issue)); return; }
    setBusy(true);
    setError("");
    try {
      if (value.condition === "issues" && photo) {
        const form = new FormData();
        form.set("slug", slug); form.set("key", "edge"); form.set("image", await resizeImage(photo).catch(() => photo));
        const response = await fetch("/api/artist-works/proof", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error("registrationConditionError");
        setHasPhoto(true);
      }
      const response = await fetch("/api/artist-works/registration", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, extras: value, price: amount, inputLang: lang }), signal: AbortSignal.timeout(60_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" && result.error.startsWith("registration") ? result.error : "portalWorksError");
      onSaved();
    } catch (error) { setError(t((error instanceof Error && error.message.startsWith("registration") ? error.message : "portalWorksError") as DictKey)); }
    finally { setBusy(false); }
  }
  return <form className="pt-copy-editor pt-registration-editor" onSubmit={save}>
    <h3>{t("registrationHeading")}</h3>
    <fieldset disabled={busy}>
      <ArtworkRegistrationFields value={value} onChange={setValue} showFrame />
      {value.pricing === "fixed" ? <label className="pt-field"><span>{t("portalPriceLabel")}</span><input value={amount} inputMode="numeric" onChange={(event) => setAmount(event.target.value)} /><small>{t("registrationPriceHint")}</small></label> : null}
      {value.condition === "issues" ? <label className="pt-field"><span>{t("registrationConditionPhoto")}</span><input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} /><small>{photo?.name ?? (hasPhoto ? t("registrationPhotoExists") : t("registrationConditionError"))}</small></label> : null}
    </fieldset>
    {error ? <p className="pt-error" role="alert">{error}</p> : null}
    <button type="submit" className="pt-btn" disabled={busy}>{busy ? t("portalProofUploading") : t("registrationSave")}</button>
  </form>;
}
