const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

// Reusable scrape function
async function scrapePage(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // wait for JS / cookies / protection
    await new Promise(resolve => setTimeout(resolve, 5000));

    const html = await page.content();

    // Example: extract visible text
    //const text = await page.evaluate(() => document.body.innerText);

    await browser.close();

    return {
      success: true,
      html: html,
      //text: text.substring(0, 1000) // limit response
    };

  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error.message
    };
  }
}

// API Route
app.get('/scrape', async (req, res) => {
  //const url = req.query.url; 
  const url = 'https://simplycodes.com/store/sungoldpower.com';

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a URL'
    });
  }

  console.log("Scraping:", url);

  const data = await scrapePage(url);

  res.json(data);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});