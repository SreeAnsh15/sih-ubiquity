/** Civic Signal: service functions abstract browser persistence so they can later call a real REST API. */
import { initialData } from "./mockData";
import type { AppData, Booking, BookingStatus, Payment } from "./types";

const STORAGE_KEY = "ubiquity-demo-data-v1";

export const cloneInitialData = (): AppData => JSON.parse(JSON.stringify(initialData));

export const mockStore = {
  load(): AppData {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : cloneInitialData();
    } catch { return cloneInitialData(); }
  },
  save(data: AppData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  reset() { localStorage.removeItem(STORAGE_KEY); return cloneInitialData(); },
};

export const bookingService = {
  create(data: AppData, draft: Omit<Booking, "id">): AppData { return { ...data, bookings: [{ ...draft, id: `UBQ-${Math.floor(10000 + Math.random() * 89999)}` }, ...data.bookings] }; },
  updateStatus(data: AppData, id: string, status: BookingStatus): AppData { return { ...data, bookings: data.bookings.map((booking) => booking.id === id ? { ...booking, status } : booking) }; },
};

export const paymentService = {
  pay(data: AppData, booking: Booking): AppData {
    const payment: Payment = { id: `pay-${Date.now()}`, bookingId: booking.id, transactionId: `UPI${Math.floor(1000000 + Math.random() * 8999999)}UBQ`, amount: booking.price + 29, status: "Successful", date: "Today" };
    return { ...data, bookings: data.bookings.map((item) => item.id === booking.id ? { ...item, paymentStatus: "Paid" } : item), payments: [payment, ...data.payments] };
  },
};

export const workerService = {
  setAvailability(data: AppData, workerId: string, availability: boolean): AppData { return { ...data, workers: data.workers.map((worker) => worker.id === workerId ? { ...worker, availability } : worker) }; },
  addRating(data: AppData, workerId: string, rating: number): AppData { return { ...data, workers: data.workers.map((worker) => worker.id === workerId ? { ...worker, rating: Number(((worker.rating * 127 + rating) / 128).toFixed(1)) } : worker) }; },
};

