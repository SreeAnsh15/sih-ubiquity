/** Civic Signal: shared mock domain contracts keep Ubiquity's frontend API-ready. */
export type Role = "customer" | "worker";
export type BookingStatus = "Confirmed" | "Worker Assigned" | "On the Way" | "Arrived" | "In Progress" | "Completed" | "Cancelled";

export interface Worker {
  id: string;
  name: string;
  phone: string;
  profileImage: string;
  location: string;
  latitude: number;
  longitude: number;
  primarySkill: string;
  secondarySkills: string[];
  experience: number;
  rating: number;
  completedJobs: number;
  verificationStatus: "Verified" | "Pending";
  certificationStatus: "Verified" | "Pending";
  availability: boolean;
  workingHours: string;
  serviceAreas: string[];
  earnings: number;
  insuranceStatus: "Active" | "Inactive";
  welfareStatus: "Eligible" | "Pending";
  distance: number;
  estimatedPrice: number;
  languages: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  savedLocations: { label: string; address: string }[];
  preferredLanguage: "en" | "ta";
}

export interface Booking {
  id: string;
  customerId: string;
  workerId: string;
  serviceId: string;
  service: string;
  subService: string;
  customerName: string;
  workerName: string;
  location: string;
  date: string;
  time: string;
  status: BookingStatus;
  price: number;
  paymentStatus: "Pending" | "Paid";
  emergency: boolean;
  problem: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  transactionId: string;
  amount: number;
  status: "Successful" | "Pending";
  date: string;
}

export interface NotificationItem {
  id: string;
  role: Role;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  tone: "blue" | "green" | "orange";
}

export interface AppData {
  workers: Worker[];
  customers: Customer[];
  bookings: Booking[];
  payments: Payment[];
  notifications: NotificationItem[];
}
