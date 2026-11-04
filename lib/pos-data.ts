export type TableStatus = "available" | "occupied" | "reserved" | "cleaning" | "merged";
export type OrderStatus = "new" | "preparing" | "ready" | "served" | "paid" | "cancelled";
export type Category = "All" | "Starters" | "Mains" | "Pizza" | "Drinks" | "Desserts";

export type MenuItem = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  description: string;
  price: number;
  emoji: string;
  color: string;
  popular?: boolean;
};

export type Table = { id: string; name: string; seats: number; status: TableStatus; guests?: number; mergedInto?: string; mergedOrderIds?: string[]; mergedOriginalStatus?: Exclude<TableStatus, "merged">; mergedOriginalGuests?: number; mergedBaseStatus?: Exclude<TableStatus, "merged">; mergedBaseGuests?: number };
export type MenuModifier = { id: string; label: string; price: number };
export type OrderLine = { id?: string; menuItemId: string; quantity: number; note?: string; modifiers?: MenuModifier[] };
export type Order = { id: string; tableId: string | null; type: "Dine in" | "Takeaway"; status: OrderStatus; items: OrderLine[]; createdAt: string; cancellationReason?: string };
export type PaymentMethod = "Cash" | "Card" | "UPI";
export type PaymentTransaction = { id: string; orderId: string; amount: number; method: PaymentMethod; createdAt: string; splitLabel?: string };
export type PosData = { tables: Table[]; orders: Order[]; unavailableMenuIds: string[]; transactions: PaymentTransaction[] };

export const menu: MenuItem[] = [
  { id: "burrata", name: "Burrata & tomatoes", category: "Starters", description: "Heirloom tomato, basil oil, sourdough", price: 14, emoji: "🍅", color: "peach", popular: true },
  { id: "truffle-fries", name: "Truffle parmesan fries", category: "Starters", description: "Rosemary, aged parmesan, aioli", price: 9, emoji: "🍟", color: "yellow", popular: true },
  { id: "salmon", name: "Seared salmon", category: "Mains", description: "Market greens, lemon beurre blanc", price: 26, emoji: "🐟", color: "blue", popular: true },
  { id: "steak", name: "Ribeye steak frites", category: "Mains", description: "Grass-fed ribeye, peppercorn jus", price: 34, emoji: "🥩", color: "rose" },
  { id: "gnocchi", name: "Wild mushroom gnocchi", category: "Mains", description: "Pillowy potato, sage, pecorino", price: 22, emoji: "🍝", color: "green", popular: true },
  { id: "margherita", name: "Margherita", category: "Pizza", description: "San Marzano, fior di latte, basil", price: 18, emoji: "🍕", color: "peach" },
  { id: "spritz", name: "Citrus garden spritz", category: "Drinks", description: "Blood orange, rosemary, bubbles", price: 12, emoji: "🍹", color: "yellow", popular: true },
  { id: "lemonade", name: "House lemonade", category: "Drinks", description: "Fresh lemon, mint, a little sparkle", price: 6, emoji: "🍋", color: "green" },
  { id: "tiramisu", name: "Classic tiramisu", category: "Desserts", description: "Espresso-soaked, cocoa-dusted", price: 11, emoji: "🍰", color: "rose" },
];

export const initialData: PosData = {
  unavailableMenuIds: [],
  transactions: [],
  tables: [
    { id: "t1", name: "01", seats: 2, status: "occupied", guests: 2 }, { id: "t2", name: "02", seats: 2, status: "available" },
    { id: "t3", name: "03", seats: 4, status: "occupied", guests: 3 }, { id: "t4", name: "04", seats: 4, status: "available" },
    { id: "t5", name: "05", seats: 4, status: "reserved" }, { id: "t6", name: "06", seats: 6, status: "available" },
    { id: "t7", name: "07", seats: 2, status: "cleaning" }, { id: "t8", name: "08", seats: 4, status: "occupied", guests: 4 },
    { id: "t9", name: "09", seats: 6, status: "available" }, { id: "t10", name: "10", seats: 2, status: "available" },
  ],
  orders: [
    { id: "#1048", tableId: "t1", type: "Dine in", status: "preparing", items: [{ menuItemId: "burrata", quantity: 1 }, { menuItemId: "salmon", quantity: 2 }], createdAt: new Date(Date.now() - 18 * 60000).toISOString() },
    { id: "#1049", tableId: "t3", type: "Dine in", status: "ready", items: [{ menuItemId: "gnocchi", quantity: 2 }], createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: "#1050", tableId: "t8", type: "Dine in", status: "preparing", items: [{ menuItemId: "steak", quantity: 2 }, { menuItemId: "spritz", quantity: 2 }], createdAt: new Date(Date.now() - 9 * 60000).toISOString() },
  ],
};

const DB_NAME = "dinein-pos";
const STORE = "workspace";
export function loadPosData(): Promise<PosData | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction(STORE, "readonly").objectStore(STORE).get("pos");
      get.onsuccess = () => { resolve(get.result ?? null); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  });
}

export function savePosData(data: PosData): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(data, "pos");
      transaction.oncomplete = () => { resolve(); db.close(); };
      transaction.onerror = () => { reject(transaction.error); db.close(); };
    };
  });
}

