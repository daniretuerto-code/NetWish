import { STATUS } from './data.js';
import { bookingsOf, customerKey, parseTableBooking } from './agenda.js';

// Average spend per person from the questionnaire (profile.precio), for the money estimate.
const TICKET = { '€': 12, '€€': 22, '€€€': 40, '€€€€': 60 };
export const ticketOf = (profile = {}) => Number(profile.ticket_medio) || TICKET[profile.precio] || 20;

const CAME = [STATUS.DONE, STATUS.SEATED];
const online = (o) => !o.source || o.source === 'app';
const madeHour = (o) => (o.created_at ? new Date(o.created_at).getHours() : 12);

// What NetWish did for the restaurant between two dates (from included, to excluded).
// The same figures as the monthly e-mail (private.month_numbers).
export function netwishNumbers(orders, from, to, profile) {
  const all = bookingsOf(orders);
  const list = all.filter((o) => o.date >= from && o.date < to);
  const came = list.filter((o) => CAME.includes(o.status));
  const viaNetwish = came.filter(online);
  const diners = viaNetwish.reduce((n, o) => n + parseTableBooking(o).guests, 0);
  const before = new Set(all.filter((o) => o.date < from && CAME.includes(o.status)).map(customerKey));
  const rated = list.filter((o) => o.rating);
  return {
    online: viaNetwish.length,
    diners,
    money: diners * ticketOf(profile),
    ticket: ticketOf(profile),
    night: list.filter((o) => online(o) && (madeHour(o) >= 23 || madeHour(o) < 9)).length,
    confirmed: list.filter((o) => o.customer_confirmed_at).length,
    noShows: list.filter((o) => o.status === STATUS.NOSHOW).length,
    newCustomers: new Set(came.map(customerKey).filter((k) => !before.has(k))).size,
    rating: rated.length ? (rated.reduce((n, o) => n + o.rating, 0) / rated.length).toFixed(1) : null,
    ratings: rated.length,
  };
}
