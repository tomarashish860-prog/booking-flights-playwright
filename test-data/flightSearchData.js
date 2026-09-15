function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const today = new Date();
const tomorrow = addDays(today, 1);

module.exports = {
  searches: [
    {
      name: 'DEL to BOM - today',
      origin: 'DEL',
      originName: 'New Delhi',
      destination: 'BOM',
      destinationName: 'Mumbai',
      dateISO: toISODate(today)
    },
    {
      name: 'DEL to BOM - tomorrow',
      origin: 'DEL',
      originName: 'New Delhi',
      destination: 'BOM',
      destinationName: 'Mumbai',
      dateISO: toISODate(tomorrow)
    }
  ]
};
