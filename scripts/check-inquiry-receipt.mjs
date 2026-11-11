import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/inquiry-receipt.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
const scope = { exports: {}, window: { sessionStorage: storage } };
vm.runInNewContext(compiled, scope);
const api = scope.exports;
const receipt = { ref: "P1015-TEST", type: "buy", email: "review@example.com", rows: [["inquiryReceiptArtwork", "검수 작품"], ["fieldInquiryType", "구매 신청"], ["fieldMessage", "상태 확인\n배송 문의"]], hasArtworks: true, createdAt: Date.now() };
let checks = 0;
const check = (fn) => { fn(); checks++; };
const key = api.inquiryReceiptKey(new URLSearchParams("artwork=record-02&intent=buy"));
check(() => assert.equal(key, api.inquiryReceiptKey(new URLSearchParams("intent=buy&artwork=record-02&draft=temporary&lang=en&utm_source=test"))));
check(() => assert.notEqual(key, api.inquiryReceiptKey(new URLSearchParams("artwork=record-03&intent=buy"))));
check(() => assert.notEqual(key, api.inquiryReceiptKey(new URLSearchParams("artwork=record-02&intent=offer"))));
check(() => assert.equal(api.inquiryReceiptKey(new URLSearchParams("artworks=b,a,a")), api.inquiryReceiptKey(new URLSearchParams("artworks=a,b"))));
check(() => assert.equal(api.saveInquiryReceipt(key, receipt), true));
check(() => assert.deepEqual(JSON.parse(JSON.stringify(api.readInquiryReceipt(key))), receipt));
for (const invalid of ["{broken", "null", "[]", JSON.stringify({ ...receipt, ref: "not-a-reference" }), JSON.stringify({ ...receipt, type: "sending" }), JSON.stringify({ ...receipt, email: "invalid" }), JSON.stringify({ ...receipt, createdAt: Date.now() + 100000 }), JSON.stringify({ ...receipt, rows: [["not-a-dictionary-key", "x"]] }), JSON.stringify({ ...receipt, rows: [["fieldMessage", "x"]] }), JSON.stringify({ ...receipt, rows: [...receipt.rows, receipt.rows[0]] }), JSON.stringify({ ...receipt, rows: [["fieldMessage", "x".repeat(6001)]] }), "x".repeat(24001)]) {
  check(() => assert.equal(api.parseInquiryReceipt(invalid), null));
}
check(() => { values.set(key, "{broken"); assert.equal(api.readInquiryReceipt(key), null); assert.equal(values.has(key), false); });
check(() => { api.saveInquiryReceipt(key, receipt); api.clearInquiryReceipt(key); assert.equal(api.readInquiryReceipt(key), null); });
Object.defineProperty(scope.window, "sessionStorage", { get() { throw new Error("blocked"); } });
check(() => assert.equal(api.readInquiryReceipt(key), null));
check(() => assert.equal(api.saveInquiryReceipt(key, receipt), false));
check(() => assert.doesNotThrow(() => api.clearInquiryReceipt(key)));
console.log(`접수 내역 회귀검사 ${checks}개 통과`);
