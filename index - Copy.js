const express = require('express');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

async function launchBrowser() {
  if (process.env.VERCEL) {
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    return puppeteer.launch({
      args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      defaultViewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true,
      },
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  }

  const puppeteer = require('puppeteer');
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Reusable scrape function
async function scrapePage(url) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const html = await page.content();

    return {
      success: true,
      html: html,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {
        /* ignore */
      }
    }
  }
}

// API Route
app.get('/', (req, res) => {
  res.json({
    success: true
  });
});

app.get('/scrape', async (req, res) => {
  console.log("BODY:", req.query.url);
  if (!req.query.url) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a URL',
    });
  }

  console.log('Scraping:', req.query.url);

  const data = await scrapePage(req.query.url);

  res.json(data);
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
