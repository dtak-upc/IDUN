const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, expect } = require('@playwright/test');

const buildDir = path.resolve(__dirname, '../.idun/showcase-build');

// Simple static server for .idun/showcase-build under /IDUN/
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (!reqPath.startsWith('/IDUN/')) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  let relative = reqPath.slice('/IDUN/'.length);
  if (!relative || relative === '/') relative = 'index.html';
  const filePath = path.join(buildDir, relative);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    return res.end(fs.readFileSync(filePath));
  }
  res.statusCode = 404;
  res.end('Not found');
});

server.listen(5176, '127.0.0.1', async () => {
  console.log('Static test server listening on http://127.0.0.1:5176/IDUN/');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGE_ERROR: ' + e.message));

    await page.goto('http://127.0.0.1:5176/IDUN/');
    await expect(page.locator('.studio-app')).toHaveCount(1);

    // 1. Check Settings button and Logout button are visible in the header
    const settingsBtn = page.locator('.studio-header-actions .settings-corner');
    await expect(settingsBtn).toBeVisible();
    console.log('✓ Settings button is visible in header');

    const logoutBtn = page.locator('.studio-header-actions .logout-corner');
    await expect(logoutBtn).toBeVisible();
    console.log('✓ Logout button is visible in header');

    // 2. Check Multi-lake dropdown and options
    const lakeSelect = page.locator('.lake-select-wrap select');
    await expect(lakeSelect).toBeVisible();
    const options = await lakeSelect.locator('option').allInnerTexts();
    console.log('Initial lake options:', options);
    if (!options.includes('Demo') || !options.includes('Secondary Demo Lake')) {
      throw new Error('Expected both Demo and Secondary Demo Lake options');
    }
    console.log('✓ Both Demo and Secondary Demo Lake are available in the dropdown');

    // 3. Switch to Secondary Demo Lake
    await lakeSelect.selectOption({ label: 'Secondary Demo Lake' });
    await page.waitForTimeout(400);
    // On secondary lake, saved files should be 0
    await expect(page.locator('.saved-files li')).toHaveCount(0);
    console.log('✓ Secondary Demo Lake successfully displays 0 saved files (clean empty state)');

    // 4. Switch back to Demo Lake
    await page.locator('.lake-select-wrap select').selectOption({ label: 'Demo' });
    await page.waitForTimeout(400);
    await expect(page.locator('.saved-files li')).toHaveCount(4);
    console.log('✓ Switched back to Demo lake with 4 saved files intact');

    // 5. Create a new lake
    const newLakeBtn = page.locator('.lake-btn-new');
    await expect(newLakeBtn).toBeVisible();
    await newLakeBtn.click();
    await expect(page.locator('.lake-modal-card')).toBeVisible();
    await page.locator('#lake-name-input').fill('Genomics Research');
    await page.locator('.lake-modal-btn-primary').click();
    await page.waitForTimeout(400);

    const updatedOptions = await page.locator('.lake-select-wrap select option').allInnerTexts();
    console.log('Lakes after creation:', updatedOptions);
    if (!updatedOptions.includes('Genomics Research')) {
      throw new Error('New lake was not added');
    }
    console.log('✓ Created new lake "Genomics Research" and verified it appears in dropdown');

    // 6. Rename lake
    const actionsMenuBtn = page.locator('.lake-btn-menu');
    await actionsMenuBtn.click();
    await expect(page.locator('.lake-dropdown-menu')).toBeVisible();
    await page.screenshot({ path: '.idun/static-lake-menu-opened.png' });
    await page.locator('.lake-dropdown-item', { hasText: 'Rename lake' }).click();
    await expect(page.locator('.lake-modal-card')).toBeVisible();
    await page.locator('#lake-name-input').fill('Renamed Genomics Lake');
    await page.locator('.lake-modal-btn-primary').click();
    await page.waitForTimeout(400);

    const renamedOptions = await page.locator('.lake-select-wrap select option').allInnerTexts();
    console.log('Lakes after rename:', renamedOptions);
    if (!renamedOptions.includes('Renamed Genomics Lake')) {
      throw new Error('Lake was not renamed');
    }
    console.log('✓ Renamed lake successfully to "Renamed Genomics Lake"');

    // 7. Remove the newly created lake
    await page.locator('.lake-btn-menu').click();
    await page.locator('.lake-dropdown-item', { hasText: 'Remove lake' }).click();
    await expect(page.locator('.lake-modal-card-danger')).toBeVisible();
    await page.locator('#confirm-lake-name').fill('Renamed Genomics Lake');
    await page.locator('.lake-modal-btn-danger').click();
    await page.waitForTimeout(400);

    const remainingOptions = await page.locator('.lake-select-wrap select option').allInnerTexts();
    console.log('Lakes after removal:', remainingOptions);
    if (remainingOptions.includes('Renamed Genomics Lake')) {
      throw new Error('Lake was not removed');
    }
    console.log('✓ Lake removal confirmed and verified');

    // 8. Open Settings
    await settingsBtn.click();
    await expect(page.locator('.backend-settings')).toBeVisible();
    await page.locator('.settings-card').first().waitFor();
    console.log('✓ Settings view rendered successfully');
    await page.screenshot({ path: '.idun/static-settings-loaded.png' });

    // 9. Open Logout modal and shut down
    await logoutBtn.click();
    await expect(page.locator('.logout-modal')).toBeVisible();
    console.log('✓ Logout modal rendered');
    await page.screenshot({ path: '.idun/static-logout-modal.png' });

    await page.locator('.btn-danger-logout').click();
    await expect(page.locator('.shutdown-screen')).toBeVisible();
    console.log('✓ Shutdown screen rendered');
    await page.screenshot({ path: '.idun/static-shutdown-screen.png' });

    // 10. Click "Return to Demo Workspace"
    const returnBtn = page.locator('button', { hasText: 'Return to Demo Workspace' });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();
    await expect(page.locator('.studio-app')).toBeVisible();
    console.log('✓ Returned to Demo Workspace successfully');

    // 11. Run original verification assertions (Discover, Evidence, Integration)
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    await expect(page.locator('.live-result')).toHaveCount(20);
    await page.getByRole('button', { name: 'Integration', exact: true }).click();
    await expect(page.locator('.relationship-table-group')).toHaveCount(3);
    console.log('✓ Discover and Integration tables all verified');

    // 12. Verify Multiple Integration Runs
    const runCards = page.locator('.integration-run-card');
    const runCount = await runCards.count();
    console.log(`Found ${runCount} integration run cards in sidebar`);
    if (runCount < 2) {
      throw new Error(`Expected at least 2 integration runs, found ${runCount}`);
    }
    await expect(runCards.first()).toContainText('Diagnosis–medication integration');
    await expect(runCards.nth(1)).toContainText('Baseline Schema Extraction');
    console.log('✓ Verified at least 2 integration runs in sidebar');

    // 13. Verify Run Card Edit Button and Dropdown Menu
    const firstMenuBtn = runCards.first().locator('.run-card-menu-btn');
    await expect(firstMenuBtn).toBeVisible();
    await firstMenuBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.run-dropdown-menu')).toBeVisible();
    console.log('✓ Run card edit menu opens with Rename run and Remove run');
    await page.screenshot({ path: '.idun/static-run-menu-opened.png' });

    // 14. Test Rename Run
    await page.locator('.lake-dropdown-item', { hasText: 'Rename run' }).click();
    await page.waitForTimeout(200);
    await expect(page.locator('.lake-modal-card')).toBeVisible();
    await page.locator('#integration-run-name-input').fill('Refined Diagnosis-Medication Synthesis');
    await page.screenshot({ path: '.idun/static-rename-run-modal.png' });
    await page.locator('.lake-modal-btn-primary').click();
    await page.waitForTimeout(400);
    await expect(runCards.first()).toContainText('Refined Diagnosis-Medication Synthesis');
    await expect(page.locator('.integration-plan-title h2')).toHaveText('Refined Diagnosis-Medication Synthesis');
    console.log('✓ Integration run renamed successfully');

    // 15. Verify Diff Comparison View (Compare with previous run)
    const diffToggleBtn = page.locator('.diff-toggle-btn');
    await expect(diffToggleBtn).toBeVisible();
    await expect(diffToggleBtn.locator('.diff-chip-count')).toHaveText('+2 · Δ1 · -0');
    console.log('✓ "Compare with previous run" button visible with count badge (+2 · Δ1 · -0)');

    await diffToggleBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.diff-banner')).toBeVisible();
    await expect(page.locator('.diff-banner-badge')).toHaveText('BEFORE / AFTER COMPARISON');
    await expect(page.locator('.diff-target-label')).toContainText('Refined Diagnosis-Medication Synthesis');
    await expect(page.locator('.diff-base-label')).toContainText('Baseline Schema Extraction');
    console.log('✓ Comparison diff banner displayed with Current vs Previous details');

    // Verify filter pills and badges
    await expect(page.locator('.diff-pill-added')).toContainText('Added (2)');
    await expect(page.locator('.diff-pill-changed')).toContainText('Changed (1)');
    await expect(page.locator('.diff-pill-unchanged')).toContainText('Unchanged (6)');
    await expect(page.locator('.diff-badge-added').first()).toBeVisible();
    await expect(page.locator('.diff-badge-changed').first()).toBeVisible();
    console.log('✓ Diff badges (+ Added, Δ Changed, = Unchanged) and filter pills confirmed');
    await page.screenshot({ path: '.idun/static-diff-comparison-view.png' });

    // Filter by added
    await page.locator('.diff-pill-added').click();
    await page.waitForTimeout(200);
    const addedCount = await page.locator('.diff-badge-added').count();
    console.log(`Filtered added rows count: ${addedCount}`);
    if (addedCount !== 2) throw new Error(`Expected 2 added rows, found ${addedCount}`);

    // Filter by changed
    await page.locator('.diff-pill-changed').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.diff-badge-changed')).toHaveCount(1);
    await expect(page.locator('.diff-row-notes')).toContainText('Refined prompt and threshold');
    console.log('✓ Filtered changed row displays notes and previous relation transition');

    // Exit comparison
    await page.locator('.diff-toggle-btn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.diff-banner')).toHaveCount(0);
    console.log('✓ Exited comparison mode cleanly');

    // 16. Test Propose with LLM (Creates a 3rd run)
    const proposeBtn = page.locator('button.integration-primary', { hasText: 'Propose with LLM' });
    await expect(proposeBtn).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await proposeBtn.click();
    await page.waitForTimeout(500);

    const postProposeCount = await page.locator('.integration-run-card').count();
    console.log(`Run count after Propose with LLM: ${postProposeCount}`);
    if (postProposeCount !== 3) {
      throw new Error(`Expected 3 runs after proposal, found ${postProposeCount}`);
    }
    console.log('✓ Propose with LLM successfully generated a 3rd integration run');

    // 17. Test Remove Run on the newly proposed run
    const thirdRunMenuBtn = page.locator('.integration-run-card').first().locator('.run-card-menu-btn');
    await thirdRunMenuBtn.click();
    await page.waitForTimeout(200);
    await page.locator('.lake-dropdown-item.lake-dropdown-danger', { hasText: 'Remove run' }).click();
    await page.waitForTimeout(200);
    await expect(page.locator('.lake-modal-card-danger')).toBeVisible();
    await expect(page.locator('.lake-modal-desc')).toContainText('Source files and discovery evidence are kept.');
    await page.screenshot({ path: '.idun/static-remove-run-modal.png' });
    await page.locator('.lake-modal-btn-danger', { hasText: 'Confirm removal' }).click();
    await page.waitForTimeout(400);

    const finalRunCount = await page.locator('.integration-run-card').count();
    console.log(`Run count after removal: ${finalRunCount}`);
    if (finalRunCount !== 2) {
      throw new Error(`Expected 2 runs after removal, found ${finalRunCount}`);
    }
    console.log('✓ Remove run confirmed and verified');

    // Check responsive viewport widths for horizontal scroll
    for (const width of [1100, 852, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 852) {
        const sidebarInfo = await page.evaluate(() => {
          const sidebar = document.querySelector('.studio-app .sidebar');
          if (!sidebar) return null;
          return Array.from(sidebar.children).map(c => ({
            tag: c.tagName,
            class: c.className,
            width: c.getBoundingClientRect().width,
            left: c.getBoundingClientRect().left,
            right: c.getBoundingClientRect().right,
          }));
        });
        const headerActionsInfo = await page.evaluate(() => {
          const ha = document.querySelector('.studio-header-actions');
          if (!ha) return null;
          return Array.from(ha.children).map(c => ({
            tag: c.tagName,
            class: c.className,
            text: c.innerText,
            width: c.getBoundingClientRect().width,
            display: window.getComputedStyle(c).display,
          }));
        });
        const lakeSwitcherInfo = await page.evaluate(() => {
          const ls = document.querySelector('.lake-switcher');
          if (!ls) return null;
          return Array.from(ls.children).map(c => ({
            tag: c.tagName,
            class: c.className,
            text: c.innerText,
            width: c.getBoundingClientRect().width,
          }));
        });
        console.log('Lake switcher children at 852px:', lakeSwitcherInfo);
      }
      const scrollCheck = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      console.log(`Viewport ${width}px: scrollWidth = ${scrollCheck.scrollWidth}, innerWidth = ${scrollCheck.innerWidth}`);
      if (scrollCheck.scrollWidth > scrollCheck.innerWidth) {
        throw new Error(`Horizontal page scrollbar detected at viewport width ${width}px: scrollWidth ${scrollCheck.scrollWidth} > innerWidth ${scrollCheck.innerWidth}`);
      }
      console.log(`✓ No horizontal overflow at ${width}px viewport`);
    }

    if (errors.length) {
      throw new Error('Errors encountered:\n' + errors.join('\n'));
    }

    console.log('\nALL STATIC TESTS PASSED PERFECTLY!');
  } finally {
    await browser.close();
    server.close();
  }
});
