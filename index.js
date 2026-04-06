const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ✅ Stealth setup
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let browserInstance;

// ✅ Launch browser (Vercel + local)
async function launchBrowser() {
  if (browserInstance) return browserInstance;

  if (process.env.VERCEL) {
    const chromium = require('@sparticuz/chromium');

    browserInstance = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await chromium.executablePath(),
      headless: true,
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

// ✅ URL validation
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ✅ Detect block pages
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

// ✅ Human simulation
async function behaveLikeHuman(page) {
  await page.mouse.move(100, 200);
  await new Promise(r => setTimeout(r, 500));

  await page.mouse.move(300, 400);
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight / 2);
  });

  await new Promise(r => setTimeout(r, 1000));
}

// ✅ Main scrape function with retry
async function scrapePage(url, retries = 2) {
  let browser;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // ✅ Real headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // ✅ Act like human
    await behaveLikeHuman(page);

    // ✅ Wait for content
    await page.waitForSelector('body', { timeout: 15000 });

    const title = await page.title();
    const html = await page.content();

    // 🚨 Detect block
    if (isBlocked(title, html)) {
      throw new Error('Blocked by security page');
    }

    return {
      success: true,
      title,
      html,
    };

  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... (${retries})`);
      return await scrapePage(url, retries - 1);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

// ✅ Routes
app.get('/', (req, res) => {
  res.json({ success: true });
});

app.get('/scrape', async (req, res) => {
  const url = req.query.url;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL',
    });
  }

  console.log('Scraping:', url);

  const data = await scrapePage(url);

  res.json(data);
});

// ✅ Start server (local only)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;