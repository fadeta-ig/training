import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const possibleBrowserPaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\' + (process.env.USERNAME || 'IT WIG') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

let executablePath = undefined;
for (const p of possibleBrowserPaths) {
    if (fs.existsSync(p)) {
        executablePath = p;
        break;
    }
}

async function capture() {
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/auth/register', { waitUntil: 'networkidle2' });

    const screenshotDir = path.resolve('public', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Step 1 screenshot
    const step1Path = path.resolve(screenshotDir, 'register_step1.png');
    await page.screenshot({ path: step1Path, fullPage: false });
    console.log('Step 1 captured at:', step1Path);

    // Try filling step 1 and going to step 2
    await page.type('input[placeholder*="Ahmad Fauzi"]', 'Budi Santoso, S.T.');
    await page.type('input[placeholder*="nama@email.com"]', 'budi.santoso@example.com');
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs.length >= 2) {
        await pwdInputs[0].type('Password123!');
        await pwdInputs[1].type('Password123!');
    }

    // Click Lanjut
    const lanjutBtns = await page.$$('button');
    for (const btn of lanjutBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Lanjut')) {
            await btn.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 600));
    const step2Path = path.resolve(screenshotDir, 'register_step2.png');
    await page.screenshot({ path: step2Path, fullPage: false });
    console.log('Step 2 captured at:', step2Path);

    // Fill step 2
    await page.type('input[placeholder*="PT Telkom"]', 'PT Nusantara Solusi');
    await page.type('input[placeholder*="081234567890"]', '081298765432');
    
    // Click Lanjut to Step 3
    const lanjutBtns2 = await page.$$('button');
    for (const btn of lanjutBtns2) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Lanjut')) {
            await btn.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 600));
    const step3Path = path.resolve(screenshotDir, 'register_step3.png');
    await page.screenshot({ path: step3Path, fullPage: false });
    console.log('Step 3 captured at:', step3Path);

    // Click Laki-Laki
    const genderBtns = await page.$$('button');
    for (const btn of genderBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Laki-Laki')) {
            await btn.click();
            break;
        }
    }

    // Click Lanjut to Step 4
    const lanjutBtns3 = await page.$$('button');
    for (const btn of lanjutBtns3) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Lanjut')) {
            await btn.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 600));
    const step4Path = path.resolve(screenshotDir, 'register_step4.png');
    await page.screenshot({ path: step4Path, fullPage: false });
    console.log('Step 4 captured at:', step4Path);

    await browser.close();
}

capture().catch(err => {
    console.error('Capture error:', err);
    process.exit(1);
});
