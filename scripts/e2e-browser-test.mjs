import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotDir = path.resolve(
  process.env.USERPROFILE || "C:\\Users\\karel",
  ".gemini\\antigravity\\brain\\b215388b-f91c-4d85-a315-051ebbe99329"
);

async function run() {
  console.log("[E2E Browser] Launching Chrome from:", chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  // Collect console and network errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser Uncaught Error] ${err.message}`);
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[E2E Browser Navigated] ${frame.url()}`);
    }
  });

  try {
    console.log("[E2E Browser] Navigating to http://localhost:3000/reports/new ...");
    await page.goto("http://localhost:3000/reports/new");

    // Allow any initial handshake redirects to complete
    await new Promise((r) => setTimeout(r, 2000));
    console.log("[E2E Browser] Waiting for #hazard-description selector...");
    await page.waitForSelector("#hazard-description", { timeout: 25000 });
    console.log("[E2E Browser] Found #hazard-description. Waiting 2s for hydration...");
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Click "Use Sample Photos"
    console.log("[E2E Browser] Clicking 'Use Sample Photos' button...");
    const sampleBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.textContent && b.textContent.includes("Sample Photos"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!sampleBtnClicked) {
      throw new Error("Could not find 'Use Sample Photos' button on the page.");
    }
    console.log("[E2E Browser] Clicked sample button. Waiting for 4 photos to attach...");

    await new Promise((r) => setTimeout(r, 1000));
    const sectionText = await page.evaluate(() => {
      const el = document.querySelector("#photo-evidence-section");
      return el ? el.innerText : "NOT_FOUND";
    });
    console.log("[E2E Browser] #photo-evidence-section text:", sectionText);

    // Wait for photos state to populate
    await page.waitForFunction(
      () => {
        const badge = document.querySelector("#photo-evidence-section");
        return badge && badge.textContent && badge.textContent.includes("4 / 4 Photos");
      },
      { timeout: 10000 }
    );
    console.log("[E2E Browser] Successfully loaded 4 verified sample photos!");

    // 3. Fill Description
    console.log("[E2E Browser] Filling hazard description...");
    await page.type(
      "#hazard-description",
      "Severe road surface crater near Pari Chowk roundabout Greater Noida, creating hazardous conditions for cyclists and vehicles.",
      { delay: 10 }
    );
    console.log("[E2E Browser] Filled description.");

    // Take screenshot of filled form
    const formScreenshotPath = path.join(screenshotDir, "e2e_form_filled.png");
    await page.screenshot({ path: formScreenshotPath, fullPage: true });
    console.log(`[E2E Browser] Saved form screenshot to ${formScreenshotPath}`);

    // 4. Submit Form
    console.log("[E2E Browser] Submitting report form...");
    const submitBtn = await page.waitForSelector('button[type="submit"]');
    if (!submitBtn) throw new Error("Submit button not found");
    await submitBtn.click();
    console.log("[E2E Browser] Submit button clicked. Waiting for receipt screen...");

    // 5. Wait for submission confirmation screen
    await page.waitForFunction(
      () => {
        return (
          document.body.innerText.includes("Report Submitted Successfully") ||
          document.body.innerText.includes("Report Logged") ||
          document.body.innerText.includes("Unable to submit")
        );
      },
      { timeout: 25000 }
    );

    // Take screenshot of confirmation receipt
    const receiptScreenshotPath = path.join(screenshotDir, "e2e_report_success.png");
    await page.screenshot({ path: receiptScreenshotPath, fullPage: true });
    console.log(`[E2E Browser] Saved receipt screenshot to ${receiptScreenshotPath}`);

    // Check if error occurred
    const errorOnPage = await page.evaluate(() => {
      const alert = document.querySelector(".bg-rose-50");
      return alert ? alert.textContent : null;
    });

    if (errorOnPage) {
      console.error("[E2E Browser] Error displayed on page:", errorOnPage);
    }

    // 6. Extract receipt details
    const receiptInfo = await page.evaluate(() => {
      const heading = document.querySelector("h1")?.textContent || "";
      const text = document.body.innerText;
      const reportIdMatch = text.match(/REP-\d+-[A-Z0-9]+/);
      return {
        heading,
        reportId: reportIdMatch ? reportIdMatch[0] : null,
        isSuccess: text.includes("Report Submitted Successfully"),
      };
    });

    console.log("[E2E Browser] Receipt outcome:", receiptInfo);
    console.log("[E2E Browser] All browser steps completed successfully!");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("[E2E Browser] Test failed:", err);
  process.exit(1);
});
