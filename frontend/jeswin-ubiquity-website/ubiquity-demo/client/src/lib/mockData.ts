/** Civic Signal: localized mock records make the service network feel operational, not static. */
import type { AppData, Booking, Customer, Worker } from "./types";

const arunPortrait = "/manus-storage/ubiquity-worker-arun_216c1dcf.jpg";

export const services = [
  { id: "plumbing", label: "Plumbing", icon: "Wrench", price: 450, subs: ["Pipe Repair", "Tap Repair", "Water Leakage", "Bathroom Repair", "Installation"] },
  { id: "electrical", label: "Electrical", icon: "Zap", price: 500, subs: ["Switch Repair", "Wiring", "Fan Installation", "Power Fault"] },
  { id: "cleaning", label: "Cleaning", icon: "Sparkles", price: 399, subs: ["Deep Clean", "Kitchen Clean", "Bathroom Clean", "Sofa Clean"] },
  { id: "carpentry", label: "Carpentry", icon: "Hammer", price: 550, subs: ["Furniture Repair", "Door Repair", "Shelf Installation"] },
  { id: "ac", label: "AC Repair", icon: "Fan", price: 650, subs: ["AC Service", "Cooling Issue", "Installation"] },
  { id: "appliance", label: "Appliance Repair", icon: "Microwave", price: 480, subs: ["Washing Machine", "Refrigerator", "Microwave"] },
  { id: "painting", label: "Painting", icon: "Paintbrush", price: 700, subs: ["Interior Paint", "Touch-up", "Wall Repair"] },
  { id: "pest", label: "Pest Control", icon: "ShieldCheck", price: 699, subs: ["Cockroach Control", "Termite Treatment", "Mosquito Control"] },
  { id: "beauty", label: "Beauty at Home", icon: "Flower2", price: 499, subs: ["Haircut", "Facial", "Grooming"] },
  { id: "other", label: "Other", icon: "MoreHorizontal", price: 350, subs: ["General Help", "Small Repair", "Consultation"] },
];

const workerSeeds = [
  ["Arun Kumar", "Plumbing", 4.8, 5, 247, 1.2, 450, "Anna Nagar"],
  ["Ravi Kumar", "Plumbing", 4.6, 7, 311, 2.1, 400, "Mogappair"],
  ["S. Lakshmi", "Electrical", 4.9, 8, 409, 1.7, 500, "Kilpauk"],
  ["Dinesh Raj", "AC Repair", 4.7, 6, 284, 2.8, 650, "T. Nagar"],
  ["Meena Devi", "Cleaning", 4.9, 4, 195, 1.9, 399, "Nungambakkam"],
  ["Vijay Kumar", "Carpentry", 4.7, 9, 521, 3.3, 550, "Aminjikarai"],
  ["Priya S", "Beauty at Home", 4.8, 5, 179, 2.5, 499, "Velachery"],
  ["Karthik M", "Appliance Repair", 4.6, 6, 256, 3.8, 480, "Kodambakkam"],
  ["Nandhini R", "Painting", 4.8, 7, 336, 2.9, 700, "Adyar"],
  ["Surya P", "Pest Control", 4.5, 4, 124, 4.1, 699, "Perambur"],
  ["Gokul S", "Electrical", 4.7, 5, 231, 3.4, 475, "Purasawalkam"],
  ["Vasanth K", "Plumbing", 4.5, 3, 92, 3.6, 380, "Vadapalani"],
  ["Divya N", "Cleaning", 4.8, 6, 271, 2.3, 420, "Guindy"],
  ["Ramesh B", "Carpentry", 4.6, 8, 388, 4.5, 575, "Mylapore"],
  ["Kavitha L", "Appliance Repair", 4.7, 5, 205, 3.7, 465, "Saidapet"],
  ["Manoj A", "AC Repair", 4.6, 6, 275, 3.0, 625, "Royapettah"],
  ["Sangeetha P", "Beauty at Home", 4.9, 7, 344, 4.6, 520, "Besant Nagar"],
  ["Muthu R", "Painting", 4.5, 4, 151, 4.9, 680, "Egmore"],
  ["Hari V", "Pest Control", 4.6, 5, 218, 3.5, 650, "Ambattur"],
  ["Anitha G", "Cleaning", 4.8, 8, 462, 5.0, 450, "Thiruvanmiyur"],
] as const;

export const workers: Worker[] = workerSeeds.map((item, index) => ({
  id: `wrk-${index + 1}`,
  name: item[0],
  phone: `+91 98${String(42000000 + index * 1193).slice(0, 8)}`,
  profileImage: index === 0 ? arunPortrait : `https://i.pravatar.cc/240?img=${(index + 13) % 70}`,
  location: item[7],
  latitude: 13.0827 + index * 0.003,
  longitude: 80.2707 + index * 0.002,
  primarySkill: item[1],
  secondarySkills: item[1] === "Plumbing" ? ["Pipe Repair", "Tap Repair", "Bathroom Installation"] : ["Repair", "Installation", "Maintenance"],
  experience: item[3],
  rating: item[2],
  completedJobs: item[4],
  verificationStatus: "Verified",
  certificationStatus: index % 5 === 0 ? "Pending" : "Verified",
  availability: index !== 11 && index !== 17,
  workingHours: "09:00 AM – 06:00 PM",
  serviceAreas: ["North Zone", "Central Zone"],
  earnings: 34600 - index * 475,
  insuranceStatus: "Active",
  welfareStatus: "Eligible",
  distance: item[5],
  estimatedPrice: item[6],
  languages: index % 2 === 0 ? ["Tamil", "English"] : ["Tamil", "Hindi", "English"],
}));

export const customers: Customer[] = [
  ["Rahul Kumar", "98765 43210", "rahul.kumar@example.in"], ["Ananya Iyer", "98401 11223", "ananya.iyer@example.in"], ["Suresh Babu", "98844 33112", "suresh.babu@example.in"], ["Kavya Menon", "97910 22334", "kavya.menon@example.in"], ["Vikram Shah", "98945 66778", "vikram.shah@example.in"], ["Aarthi R", "94440 55667", "aarthi.r@example.in"], ["Imran Khan", "90031 66771", "imran.khan@example.in"], ["Nisha Kapoor", "98842 74339", "nisha.kapoor@example.in"], ["Prakash R", "98410 99887", "prakash.r@example.in"], ["Leela Thomas", "98405 77665", "leela.thomas@example.in"],
].map((row, index) => ({ id: `cus-${index + 1}`, name: row[0], phone: `+91 ${row[1]}`, email: row[2], preferredLanguage: "en", savedLocations: [{ label: "Home", address: index === 0 ? "18, 3rd Main Road, Anna Nagar, Chennai" : `${index + 8}, Lake View Road, Chennai` }, { label: "Work", address: "Olympia Tech Park, Guindy, Chennai" }] }));

const bookingStatuses = ["Confirmed", "Worker Assigned", "On the Way", "In Progress", "Completed", "Completed", "Cancelled"] as const;
export const bookings: Booking[] = Array.from({ length: 31 }, (_, index) => {
  const worker = workers[index % workers.length];
  const customer = customers[index % customers.length];
  const status = bookingStatuses[index % bookingStatuses.length];
  const service = worker.primarySkill;
  return {
    id: index === 0 ? "UBQ-10234" : `UBQ-${10235 + index}`,
    customerId: customer.id,
    workerId: worker.id,
    serviceId: service.toLowerCase().replaceAll(" ", "-"),
    service,
    subService: service === "Plumbing" ? "Pipe Repair" : "Service Visit",
    customerName: customer.name,
    workerName: worker.name,
    location: customer.savedLocations[0].address,
    date: index < 4 ? "Today" : `${18 + (index % 9)} Aug 2026`,
    time: index % 3 === 0 ? "10:00 AM" : index % 3 === 1 ? "02:30 PM" : "05:00 PM",
    status,
    price: worker.estimatedPrice,
    paymentStatus: status === "Completed" && index % 2 === 0 ? "Paid" : "Pending",
    emergency: index === 2,
    problem: index % 2 ? "A service visit is required at the home." : "Please check the issue and explain the repair needed.",
  };
});

export const initialData: AppData = {
  workers,
  customers,
  bookings,
  payments: bookings.filter((booking) => booking.paymentStatus === "Paid").map((booking, index) => ({ id: `pay-${index}`, bookingId: booking.id, transactionId: `UPI${7678200 + index}UBQ`, amount: booking.price + 29, status: "Successful" as const, date: booking.date })),
  notifications: [
    { id: "n1", role: "customer", title: "Arun is on the way", body: "Your verified plumber is expected in 12 minutes.", time: "8 min ago", unread: true, tone: "green" },
    { id: "n2", role: "customer", title: "Booking confirmed", body: "Your Pipe Repair visit is set for today, 10:00 AM.", time: "45 min ago", unread: true, tone: "blue" },
    { id: "n3", role: "worker", title: "New plumbing job available", body: "Rahul Kumar needs a pipe repair in Anna Nagar.", time: "Just now", unread: true, tone: "orange" },
    { id: "n4", role: "worker", title: "Certification verified", body: "Your Plumbing Training Certificate has been confirmed.", time: "2 hr ago", unread: false, tone: "green" },
  ],
};
