const { expect } = require('@playwright/test');

class FlightsPage {
  constructor(page) {
    this.page = page;

    this.oneWay = page.getByText(/One way/i).first();
    this.fromControl = page.getByText(/Leaving from/i).first();
    this.toControl = page.getByText(/Going to/i).first();
    this.exploreButton = page.getByRole('button', { name: /Explore/i }).first();
  }

  async open() {
    await this.page.goto('/flights/index.en-gb.html?keep_landing=1', {
      waitUntil: 'domcontentloaded'
    });
    // Booking.com continuously loads content, so networkidle is intentionally not required.
    await this.page.waitForTimeout(1200);
    await this.dismissConsentIfPresent();
  }

  async dismissConsentIfPresent() {
    const candidates = [
      this.page.getByRole('button', { name: /Accept|Agree/i }).first(),
      this.page.getByRole('button', { name: /Reject|Decline/i }).first()
    ];

    for (const button of candidates) {
      try {
        if (await button.isVisible({ timeout: 1200 })) {
          await button.click();
          return;
        }
      } catch (_) {}
    }
  }

  async selectOneWay() {
    try {
      if (await this.oneWay.isVisible({ timeout: 3000 })) {
        await this.oneWay.click();
      }
    } catch (_) {}
  }

  async findLocationInput() {
    const candidates = [
      this.page.getByRole('dialog').getByRole('textbox').last(),
      this.page.getByPlaceholder(/Airport, city or country|Where are you flying from|Where are you flying to|Search/i).last(),
      this.page.locator('input[type="text"]').last()
    ];

    for (const candidate of candidates) {
      try {
        if (await candidate.isVisible({ timeout: 1200 })) return candidate;
      } catch (_) {}
    }
    return null;
  }

  async locationServiceHasError() {
    return await this.page.getByText(/Oops, something's not right/i).isVisible().catch(() => false);
  }

  async selectLocation(control, airportCode, cityName) {
    // Booking.com flight-location autocomplete is backed by a dynamic service.
    // Retry the complete interaction because the service can temporarily return
    // "Oops, something's not right" even though the page itself is available.
    const attempts = [airportCode, cityName, `${airportCode} ${cityName}`];

    for (let attempt = 0; attempt < attempts.length; attempt++) {
      if (attempt > 0) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(1200);
        await this.dismissConsentIfPresent();
        await this.selectOneWay();
      }

      await control.click().catch(() => {});
      const input = await this.findLocationInput();
      if (!input) continue;

      await input.fill('');
      await input.fill(attempts[attempt]);
      await this.page.waitForTimeout(1800);

      // Prefer semantic options/list items, then text fallbacks.
      const optionCandidates = [
        this.page.getByRole('option', { name: new RegExp(`${airportCode}|${cityName}`, 'i') }).first(),
        this.page.locator('[role="option"]').filter({ hasText: new RegExp(`${airportCode}|${cityName}`, 'i') }).first(),
        this.page.getByText(new RegExp(`${cityName}.*${airportCode}|${airportCode}.*${cityName}`, 'i')).first(),
        this.page.getByText(new RegExp(`\\b${airportCode}\\b`, 'i')).last()
      ];

      for (const option of optionCandidates) {
        try {
          if (await option.isVisible({ timeout: 1800 })) {
            await option.click();
            return;
          }
        } catch (_) {}
      }

      // Keyboard fallback: autocomplete components commonly select the first
      // result with ArrowDown + Enter after text has been entered.
      try {
        if (await input.isVisible()) {
          await input.press('ArrowDown');
          await input.press('Enter');
          await this.page.waitForTimeout(700);

          const pageText = await this.page.locator('body').innerText();
          if (new RegExp(`\\b${airportCode}\\b`, 'i').test(pageText) &&
              !await this.locationServiceHasError()) {
            return;
          }
        }
      } catch (_) {}
    }

    if (await this.locationServiceHasError()) {
      throw new Error(
        `Booking.com airport autocomplete service did not return a suggestion for ${airportCode} (${cityName}). ` +
        'The page displayed "Oops, something\'s not right" after the location was entered. ' +
        'This is a live third-party service/UI dependency, not a missing test assertion.'
      );
    }

    throw new Error(`Could not select airport ${airportCode} (${cityName}) after multiple locator and input strategies.`);
  }

  async selectDate(dateISO) {
    const target = new Date(`${dateISO}T12:00:00`);
    const day = target.getDate();
    const monthName = target.toLocaleString('en-GB', { month: 'long' });

    const dateControls = [
      this.page.getByText(/Travel date|Travel dates/i).first(),
      this.page.getByRole('button', { name: /Travel date|Travel dates/i }).first(),
      this.page.getByText(/Select dates/i).first()
    ];

    for (const control of dateControls) {
      try {
        if (await control.isVisible({ timeout: 1500 })) {
          await control.click();
          break;
        }
      } catch (_) {}
    }

    for (let i = 0; i < 13; i++) {
      const monthVisible = await this.page.getByText(new RegExp(monthName, 'i')).first().isVisible().catch(() => false);
      if (monthVisible) break;

      const nextButtons = [
        this.page.getByRole('button', { name: /next month|next/i }).last(),
        this.page.locator('button[aria-label*="Next"]').last()
      ];

      let clicked = false;
      for (const next of nextButtons) {
        try {
          if (await next.isVisible({ timeout: 700 })) {
            await next.click();
            clicked = true;
            break;
          }
        } catch (_) {}
      }
      if (!clicked) break;
    }

    const dayLocators = [
      this.page.locator(`[data-date="${dateISO}"]`).first(),
      this.page.locator(`button[aria-label*="${dateISO}"]`).first(),
      this.page.getByRole('button', { name: new RegExp(`^${day}$`) }).last()
    ];

    for (const locator of dayLocators) {
      try {
        if (await locator.isVisible({ timeout: 1200 })) {
          await locator.click();
          return;
        }
      } catch (_) {}
    }

    throw new Error(`Could not select travel date ${dateISO}. Booking.com calendar selectors may have changed.`);
  }

  async search() {
    await this.exploreButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForTimeout(1500);
  }

  async assertRoute(originCode, destinationCode) {
    const body = this.page.locator('body');
    await expect(body).toContainText(new RegExp(`${originCode}.*${destinationCode}|${destinationCode}.*${originCode}`, 'i'));
  }

  async assertDate(dateISO) {
    const d = new Date(`${dateISO}T12:00:00`);
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const body = this.page.locator('body');
    await expect(body).toContainText(new RegExp(`${day}\\s*${month}|${month}\\s*${day}`, 'i'));
  }
}

module.exports = { FlightsPage };
