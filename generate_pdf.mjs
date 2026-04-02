import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generatePdf() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const htmlPath = path.resolve(__dirname, 'BUKU_PANDUAN_PREMIUM.html');
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const outputPath = path.resolve(__dirname, 'BUKU_PANDUAN_SISTEM_LMS.pdf');

    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="width:100%;text-align:center;font-size:9px;color:#94a3b8;font-family:Inter,sans-serif;padding:0 1.5cm;">
                <span>Buku Panduan & Guideline — Sistem E-Learning LMS</span>
                <span style="float:right;">Halaman <span class="pageNumber"></span> / <span class="totalPages"></span></span>
            </div>
        `,
    });

    console.log(`✅ PDF berhasil di-generate: ${outputPath}`);
    await browser.close();
}

generatePdf().catch((err) => {
    console.error('❌ Gagal generate PDF:', err.message);
    process.exit(1);
});
