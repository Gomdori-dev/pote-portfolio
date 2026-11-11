"use client";

import { FRAME_KEYS, FRAME_LABEL_KEY, type ArtworkExtras } from "@/lib/artwork-extras";
import { FACT_LABELS } from "@/lib/artwork-registration";
import { useLanguage, useT, type DictKey } from "@/lib/i18n";

export function ArtworkRegistrationFields({ value, onChange, showFrame = false }: {
  value: ArtworkExtras;
  onChange: (value: ArtworkExtras) => void;
  showFrame?: boolean;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const select = (key: keyof typeof FACT_LABELS, label: DictKey) => (
    <label className="pt-field" key={key}>
      <span>{t(label)}</span>
      <select value={value[key] ?? ""} onChange={(event) => onChange({ ...value, [key]: event.target.value })}>
        <option value="">{t("registrationChoose")}</option>
        {Object.entries(FACT_LABELS[key]).map(([option, text]) => <option key={option} value={option}>{t(text)}</option>)}
      </select>
    </label>
  );
  return <>
    <p className="pt-note">{t("registrationIntro")}</p>
    {select("medium", "registrationMedium")}
    {value.medium === "photo" ? <p className="pt-note">{t("applyPhotoCriteria")}</p> : null}
    {value.medium === "photo" ? <div className="pt-row3">{select("photoProcess", "registrationPhotoProcess")}{select("photoPaper", "registrationPhotoPaper")}<p className="pt-note">{t("registrationPhotoMaterialNote")}</p></div> : null}
    {value.medium === "craft" ? <p className="pt-note">{t("applyCraftCriteria")}</p> : null}
    <div className="pt-row3">
      {select("workKind", "registrationKind")}
      {select("condition", "registrationCondition")}
      {select("signature", "registrationSignature")}
    </div>
    {value.signature === "signed" ? <label className="pt-field"><span>{t("registrationSignatureLocation")}</span><select value={value.signatureLocation ?? ""} onChange={(event) => onChange({ ...value, signatureLocation: event.target.value as ArtworkExtras["signatureLocation"] })}><option value="">{t("registrationChoose")}</option>{(["front", "back", "other"] as const).map((key) => <option key={key} value={key}>{t(({ front: "signatureFront", back: "signatureBack", other: "signatureOther" } as const)[key])}</option>)}</select></label> : null}
    {value.condition === "issues" ? <label className="pt-field"><span>{t("registrationConditionNote")}</span><textarea rows={3} maxLength={1000} value={(lang === "ko" ? value.conditionNoteKo : value.conditionNoteEn) ?? ""} onChange={(event) => onChange({ ...value, [lang === "ko" ? "conditionNoteKo" : "conditionNoteEn"]: event.target.value })} /></label> : null}
    <div className="pt-row3">
      {select("pricing", "registrationPricing")}
      {select("installation", "registrationInstallation")}
      {select("certificateAvailability", "registrationCertificate")}
    </div>
    {showFrame ? <div className="pt-row3">
      <label className="pt-field"><span>{t("portalFrameLabel")}</span><select value={value.frame ?? ""} onChange={(event) => onChange({ ...value, frame: event.target.value as ArtworkExtras["frame"] })}><option value="">{t("registrationChoose")}</option>{FRAME_KEYS.map((key) => <option key={key} value={key}>{t(FRAME_LABEL_KEY[key])}</option>)}</select></label>
      <label className="pt-field"><span>{t("portalDepthLabel")}</span><input type="number" min="0.1" max="9999" step="0.1" value={value.depthCm ?? ""} onChange={(event) => onChange({ ...value, depthCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
      {value.workKind === "limited" ? <label className="pt-field"><span>{t("portalEditionLabel")}</span><input maxLength={20} placeholder="3/20" value={value.edition ?? ""} onChange={(event) => onChange({ ...value, edition: event.target.value })} /></label> : null}
    </div> : null}
    {showFrame && value.medium === "photo" && value.frame === "framed" ? <div className="pt-row3">{(["framedWidthCm", "framedHeightCm"] as const).map(key => <label className="pt-field" key={key}><span>{t(key === "framedWidthCm" ? "registrationPhotoFrameWidth" : "registrationPhotoFrameHeight")}</span><input type="number" min="0.1" max="9999" step="0.1" value={value[key] ?? ""} onChange={event => onChange({ ...value, [key]: event.target.value ? Number(event.target.value) : undefined })} /></label>)}</div> : null}
    <label className="pt-check"><input type="checkbox" checked={value.authorized === true} onChange={(event) => onChange({ ...value, authorized: event.target.checked })} />{t("registrationAuthorized")}</label>
  </>;
}
