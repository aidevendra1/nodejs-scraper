const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ✅ Puppeteer + stealth evasions (do not use StealthPlugin() — its dynamic deps list
// can still resolve chrome.app on Vercel; register each evasion plugin directly instead).
const puppeteer = require('puppeteer-extra');

puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/defaultArgs')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/media.codecs')());
puppeteer.use(
  require('puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency')()
);
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/navigator.languages')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/navigator.permissions')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/sourceurl')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')());
puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor')());
puppeteer.use(
  require('puppeteer-extra-plugin-stealth/evasions/window.outerdimensions')()
);

let browserInstance;

// ✅ Launch browser (Vercel or local)
async function launchBrowser() {
  if (browserInstance) return browserInstance;

  if (process.env.VERCEL) {
    const chromium = require('@sparticuz/chromium');
    browserInstance = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless ?? true,
      defaultViewport: chromium.defaultViewport,
    });
  } else {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  return browserInstance;
}

// ✅ Validate URL
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ✅ Detect blocked pages
function isBlocked(title, html) {
  const text = (title + html).toLowerCase();
  return (
    text.includes('just a moment') ||
    text.includes('security check') ||
    text.includes('verify you are human') ||
    text.includes('performing security verification') ||
    text.includes('captcha')
  );
}

// ✅ Human-like interactions
async function behaveLikeHuman(page) {
  await page.mouse.move(100, 200);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.move(300, 400);
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
  await new Promise(r => setTimeout(r, 1000));
}

// ✅ Main scraping function with retry
async function scrapePage(url, retries = 2) {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    // ✅ Headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // ✅ Simulate human
    await behaveLikeHuman(page);

    // ✅ Wait for content
    await page.waitForSelector('body', { timeout: 15000 });

    const title = await page.title();
    const html = await page.content();

    if (isBlocked(title, html)) throw new Error('Blocked by security page');

    return { success: true, title, html };

  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${retries})`);
      return scrapePage(url, retries - 1);
    }
    return { success: false, error: error.message };
  }
}

// ✅ Routes
app.get('/', (req, res) => res.json({ success: true }));

app.get('/scrape', async (req, res) => {
  const url = req.query.url;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, message: 'Invalid URL' });
  }

  console.log('Scraping:', url);
  const data = await scrapePage(url);
  res.json(data);
});

// ✅ Start server locally
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;
