"use client";

import { useId, useRef, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { T, type DictKey, useT } from "@/lib/i18n";

const ALLOWED_EXTENSIONS = ["pdf", "zip", "png", "jpg", "jpeg"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];
const MAX_BYTES = 50 * 1024 * 1024;

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "zip": return "application/zip";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    default: return "application/octet-stream";
  }
}

// Blob's presign step rejects non-ASCII pathnames (a Korean file name like
// "운우 작품.jpg" fails with "Failed to retrieve the presigned URL"), so only
// ASCII letters/digits survive; the random suffix keeps names unique.
function safeUploadName(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 80);
  return `${base || "file"}.${ext}`;
}

// The same dropzone also takes the artist's profile photo on /apply — pass
// imageOnly plus that field's own label/note/hint keys.
export function PortfolioUpload({
  onUrlChange,
  onBusyChange,
  labelKey = "fieldPortfolio",
  noteKey = "fieldPortfolioNote",
  hintKey = "fieldPortfolioDropHint",
  imageOnly = false,
  required = false,
  missing = false,
  id,
}: {
  onUrlChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  labelKey?: DictKey;
  noteKey?: DictKey;
  hintKey?: DictKey;
  imageOnly?: boolean;
  required?: boolean;
  missing?: boolean;
  id?: string;
}) {
  const t = useT();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFileName("");
    setStatus("idle");
    setError("");
    onUrlChange("");
    onBusyChange(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    if (status === "uploading") return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !(imageOnly ? IMAGE_EXTENSIONS : ALLOWED_EXTENSIONS).includes(ext)) {
      setError(t(imageOnly ? "fieldProfilePhotoErrorType" : "fieldPortfolioErrorType"));
      setStatus("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("fieldPortfolioErrorSize"));
      setStatus("error");
      return;
    }
    setFileName(file.name);
    setError("");
    setStatus("uploading");
    onUrlChange("");
    onBusyChange(true);
    try {
      const blob = await uploadPresigned(`applications/${safeUploadName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/apply-portfolio-upload",
        contentType: contentTypeFor(file.name),
      });
      onUrlChange(blob.url);
      setStatus("done");
    } catch {
      setError(t("fieldPortfolioErrorUpload"));
      setStatus("error");
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div id={id}>
      <label id={`${fieldId}-label`} htmlFor={`${fieldId}-file`}><T k={labelKey} /> <T k={required ? "applyRequired" : "applyOptional"} /></label>
      <small id={`${fieldId}-note`} className="field-note"><T k={noteKey} /></small>
      <div
        className={`portfolio-dropzone${dragOver ? " drag-over" : ""}${status === "error" || missing ? " has-error" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files?.[0];
          if (file && status !== "uploading") void handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          id={`${fieldId}-file`}
          type="file"
          accept={imageOnly ? ".png,.jpg,.jpeg" : ".pdf,.zip,.png,.jpg,.jpeg"}
          hidden
          aria-invalid={missing || status === "error"}
          disabled={status === "uploading"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          className="portfolio-file-button"
          aria-labelledby={`${fieldId}-label`}
          aria-describedby={`${fieldId}-note${error || missing ? ` ${fieldId}-error` : ""}`}
          aria-busy={status === "uploading"}
          disabled={status === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
        {status === "uploading" ? (
          <p className="portfolio-dropzone-status">{t("fieldPortfolioUploading")}</p>
        ) : status === "done" ? (
          <>
            <p className="portfolio-dropzone-status">{fileName}</p>
          </>
        ) : (
          <>
            <span className="portfolio-dropzone-icon" aria-hidden="true">↑</span>
            <p className="portfolio-dropzone-status"><T k="fieldPortfolioDropDefault" /></p>
            <p className="portfolio-dropzone-hint"><T k={hintKey} /></p>
          </>
        )}
        </button>
        {status === "done" ? <button type="button" className="text-button" onClick={reset}><T k="fieldPortfolioRemove" /></button> : null}
      </div>
      {error || missing ? <small id={`${fieldId}-error`} className="field-note portfolio-error" role="alert">{error || t("applyMissingFiles")}</small> : null}
    </div>
  );
}
