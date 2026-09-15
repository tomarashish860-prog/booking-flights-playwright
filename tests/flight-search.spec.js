const { test } = require('@playwright/test');
const { FlightsPage } = require('../pages/FlightsPage');
const { searches } = require('../test-data/flightSearchData');

test.describe('Booking.com - Flight Search', () => {
  for (const data of searches) {
    test(`${data.name}`, async ({ page }) => {
      const flights = new FlightsPage(page);

      await flights.open();
      await flights.selectOneWay();
      await flights.selectLocation(flights.fromControl, data.origin, data.originName);
      await flights.selectLocation(flights.toControl, data.destination, data.destinationName);
      await flights.selectDate(data.dateISO);
      await flights.search();

      await flights.assertRoute(data.origin, data.destination);
      await flights.assertDate(data.dateISO);
    });
  }
});
