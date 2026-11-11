// IndexNow: tells Bing, Naver, Yandex, Seznam and Yep that pages are new or
// changed, so they crawl them without waiting for the sitemap to be re-read.
// One submission to api.indexnow.org is shared with every participating engine.
// Google does not take part — its pages are requested in Search Console.
//
// Run after a deploy is live (the key file must be served first):
//   node scripts/indexnow.mjs                 # every URL in the live sitemap
//   node scripts/indexnow.mjs /artists/pita   # only these paths
//   node scripts/indexnow.mjs --dry-run       # list what would be sent
//
// The key is not a secret: the protocol has it served publicly at
// https://potegallery.com/<key>.txt to prove the site owns the submission.

const SITE = "https://potegallery.com";
const KEY = "93bb4d068ad91ee1606c36c9679588e9";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter((arg) => arg.startsWith("/"));

const keyFile = await fetch(`${SITE}/${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  console.error(`키 파일이 아직 운영에 없습니다: ${SITE}/${KEY}.txt (${keyFile.status}). 배포 후 다시 실행하세요.`);
  process.exit(1);
}

const urlList = paths.length
  ? paths.map((path) => `${SITE}${path}`)
  : [...(await (await fetch(`${SITE}/sitemap.xml`)).text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

console.log(`보낼 주소 ${urlList.length}개`);
if (dryRun) {
  console.log(urlList.join("\n"));
  process.exit(0);
}

// 202 = accepted, key check pending; 200 = accepted. Anything else is printed.
const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow 응답 ${response.status} ${response.statusText}`, await response.text());
if (!response.ok) process.exit(1);
