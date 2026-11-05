export type TableStatus = "available" | "occupied" | "reserved" | "cleaning" | "merged";
export type OrderStatus = "new" | "preparing" | "ready" | "served" | "paid" | "cancelled";
export type Category = "All" | "Starters" | "Mains" | "Pizza" | "Soups" | "Breads & Sides" | "Drinks" | "Desserts";

export type MenuItem = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  description: string;
  price: number;
  emoji: string;
  color: string;
  popular?: boolean;
  variants?: MenuVariant[];
  stockCount?: number;
  lowStockThreshold?: number;
};

export type MenuVariant = { id: string; label: string; price: number };

export type ReservationDetails = { guestName: string; guests: number; time: string };
export type DeliveryDetails = { recipientName: string; phone: string; address: string };
export type FloorPosition = { column: number; row: number };
export type Table = { id: string; name: string; seats: number; status: TableStatus; floorPosition?: FloorPosition; guests?: number; reservation?: ReservationDetails; mergedInto?: string; mergedOrderIds?: string[]; mergedOriginalStatus?: Exclude<TableStatus, "merged">; mergedOriginalGuests?: number; mergedBaseStatus?: Exclude<TableStatus, "merged">; mergedBaseGuests?: number };
export type MenuModifier = { id: string; label: string; price: number };
export type OrderLine = { id?: string; menuItemId: string; quantity: number; note?: string; variant?: MenuVariant; modifiers?: MenuModifier[] };
export type Order = { id: string; tableId: string | null; type: "Dine in" | "Takeaway" | "Delivery"; deliveryDetails?: DeliveryDetails; status: OrderStatus; items: OrderLine[]; rounds?: OrderLine[][]; stockConsumedItems?: OrderLine[]; lastFiredAt?: string; createdAt: string; cancellationReason?: string };
export type PaymentMethod = "Cash" | "Card" | "UPI";
export type PaymentTransaction = { id: string; orderId: string; amount: number; method: PaymentMethod; createdAt: string; splitLabel?: string };
export type PosData = { tables: Table[]; orders: Order[]; unavailableMenuIds: string[]; transactions: PaymentTransaction[]; menuItems: MenuItem[] };

export const menu: MenuItem[] = [
  { id: "burrata", name: "Burrata & tomatoes", category: "Starters", description: "Heirloom tomato, basil oil, sourdough", price: 480, emoji: "\u{1F345}", color: "peach", popular: true },
  { id: "truffle-fries", name: "Truffle parmesan fries", category: "Starters", description: "Rosemary, aged parmesan, aioli", price: 260, emoji: "\u{1F35F}", color: "yellow", popular: true },
  { id: "paneer-tikka", name: "Tandoori paneer tikka", category: "Starters", description: "Charred cottage cheese, mint chutney", price: 320, emoji: "\u{1F9C0}", color: "peach", popular: true },
  { id: "veg-samosa", name: "Punjabi vegetable samosa", category: "Starters", description: "Spiced potato, peas, tamarind chutney", price: 180, emoji: "\u{1F956}", color: "yellow" },
  { id: "chicken-tikka", name: "Chicken tikka", category: "Starters", description: "Yogurt-marinated, tandoor roasted", price: 360, emoji: "\u{1F357}", color: "rose", popular: true },
  { id: "crispy-corn", name: "Crispy masala corn", category: "Starters", description: "Sweet corn, curry leaf, house spice", price: 240, emoji: "\u{1F33D}", color: "yellow" },
  { id: "dahi-kebab", name: "Dahi ke kebab", category: "Starters", description: "Crisp hung-curd patties, coriander chutney", price: 290, emoji: "\u{1F958}", color: "green" },
  { id: "fish-amritsari", name: "Amritsari fish bites", category: "Starters", description: "Crispy spiced fish, lemon, mint dip", price: 390, emoji: "\u{1F41F}", color: "blue" },
  { id: "spring-rolls", name: "Vegetable spring rolls", category: "Starters", description: "Crunchy rolls, sweet chili sauce", price: 260, emoji: "\u{1F95F}", color: "yellow" },
  { id: "salmon", name: "Seared salmon", category: "Mains", description: "Market greens, lemon beurre blanc", price: 780, emoji: "\u{1F41F}", color: "blue", popular: true },
  { id: "steak", name: "Ribeye steak frites", category: "Mains", description: "Grass-fed ribeye, peppercorn jus", price: 1250, emoji: "\u{1F969}", color: "rose" },
  { id: "gnocchi", name: "Wild mushroom gnocchi", category: "Mains", description: "Pillowy potato, sage, pecorino", price: 560, emoji: "\u{1F35D}", color: "green", popular: true },
  { id: "butter-chicken", name: "Butter chicken", category: "Mains", description: "Tandoor chicken, tomato makhani gravy", price: 520, emoji: "\u{1F958}", color: "rose", popular: true },
  { id: "paneer-makhani", name: "Paneer makhani", category: "Mains", description: "Cottage cheese, slow-cooked tomato cream", price: 420, emoji: "\u{1F372}", color: "peach" },
  { id: "chicken-biryani", name: "Hyderabadi chicken biryani", category: "Mains", description: "Dum-cooked basmati, raita, salan", price: 460, emoji: "\u{1F35A}", color: "yellow", popular: true },
  { id: "veg-biryani", name: "Vegetable dum biryani", category: "Mains", description: "Saffron basmati, seasonal vegetables", price: 360, emoji: "\u{1F35B}", color: "green" },
  { id: "dal-makhani", name: "Dal makhani", category: "Mains", description: "Black lentils simmered overnight", price: 340, emoji: "\u{1FAD8}", color: "rose" },
  { id: "palak-paneer", name: "Palak paneer", category: "Mains", description: "Spinach, cottage cheese, garlic tadka", price: 390, emoji: "\u{1F957}", color: "green" },
  { id: "rogan-josh", name: "Kashmiri rogan josh", category: "Mains", description: "Slow-braised lamb, aromatic Kashmiri spices", price: 620, emoji: "\u{1F958}", color: "rose" },
  { id: "chole-bhature", name: "Chole bhature", category: "Mains", description: "Punjabi chickpeas, two fluffy bhature", price: 320, emoji: "\u{1F35B}", color: "yellow" },
  { id: "shahi-paneer", name: "Shahi paneer", category: "Mains", description: "Paneer in a mild cashew and saffron gravy", price: 430, emoji: "\u{1F372}", color: "peach" },
  { id: "goan-fish-curry", name: "Goan coconut fish curry", category: "Mains", description: "Coastal coconut curry, steamed basmati", price: 560, emoji: "\u{1F963}", color: "blue" },
  { id: "margherita", name: "Margherita", category: "Pizza", description: "San Marzano, fior di latte, basil", price: 420, emoji: "\u{1F355}", color: "peach" },
  { id: "tandoori-pizza", name: "Tandoori paneer pizza", category: "Pizza", description: "Smoky paneer, peppers, coriander", price: 480, emoji: "\u{1F355}", color: "rose", popular: true },
  { id: "farmhouse-pizza", name: "Garden farmhouse pizza", category: "Pizza", description: "Mushroom, capsicum, onion, mozzarella", price: 450, emoji: "\u{1F355}", color: "green" },
  { id: "chicken-pizza", name: "Chicken tikka pizza", category: "Pizza", description: "Tandoori chicken, onion, mint drizzle", price: 540, emoji: "\u{1F355}", color: "yellow" },
  { id: "pepperoni-pizza", name: "Pepperoni pizza", category: "Pizza", description: "Pepperoni, mozzarella, tomato sugo", price: 590, emoji: "\u{1F355}", color: "rose" },
  { id: "four-cheese-pizza", name: "Four cheese pizza", category: "Pizza", description: "Mozzarella, cheddar, parmesan, blue cheese", price: 560, emoji: "\u{1F9C0}", color: "yellow" },
  { id: "tomato-soup", name: "Roasted tomato soup", category: "Soups", description: "Slow-roasted tomato, basil, toasted croutons", price: 220, emoji: "\u{1F372}", color: "rose", popular: true },
  { id: "sweet-corn-soup", name: "Sweet corn soup", category: "Soups", description: "Sweet corn, spring onion, cracked pepper", price: 210, emoji: "\u{1F963}", color: "yellow" },
  { id: "hot-sour-soup", name: "Hot & sour vegetable soup", category: "Soups", description: "Mushroom, cabbage, chili, a tangy finish", price: 230, emoji: "\u{1F35C}", color: "green" },
  { id: "chicken-manchow", name: "Chicken manchow soup", category: "Soups", description: "Indo-Chinese broth, crisp noodle garnish", price: 260, emoji: "\u{1F35C}", color: "peach" },
  { id: "butter-naan", name: "Butter naan", category: "Breads & Sides", description: "Tandoor-baked leavened bread, brushed with butter", price: 80, emoji: "\u{1FAD3}", color: "yellow" },
  { id: "garlic-naan", name: "Garlic naan", category: "Breads & Sides", description: "Fresh garlic, coriander, melted butter", price: 110, emoji: "\u{1FAD3}", color: "peach", popular: true },
  { id: "tandoori-roti", name: "Tandoori roti", category: "Breads & Sides", description: "Whole-wheat bread baked in the clay oven", price: 55, emoji: "\u{1FAD3}", color: "green" },
  { id: "laccha-paratha", name: "Laccha paratha", category: "Breads & Sides", description: "Flaky layered flatbread, griddled to order", price: 95, emoji: "\u{1F95E}", color: "rose" },
  { id: "jeera-rice", name: "Jeera rice", category: "Breads & Sides", description: "Basmati rice tempered with cumin", price: 190, emoji: "\u{1F35A}", color: "yellow" },
  { id: "boondi-raita", name: "Boondi raita", category: "Breads & Sides", description: "Chilled yogurt, crisp boondi, roasted cumin", price: 150, emoji: "\u{1F963}", color: "blue" },
  { id: "masala-papad", name: "Masala papad", category: "Breads & Sides", description: "Crisp papad topped with tomato and onion", price: 110, emoji: "\u{1FAD3}", color: "peach" },
  { id: "spritz", name: "Citrus garden spritz", category: "Drinks", description: "Blood orange, rosemary, bubbles", price: 280, emoji: "\u{1F379}", color: "yellow", popular: true },
  { id: "lemonade", name: "House lemonade", category: "Drinks", description: "Fresh lemon, mint, a little sparkle", price: 150, emoji: "\u{1F34B}", color: "green" },
  { id: "mango-lassi", name: "Mango lassi", category: "Drinks", description: "Alphonso mango, chilled yogurt", price: 180, emoji: "\u{1F959}", color: "yellow", popular: true },
  { id: "masala-chai", name: "Masala chai", category: "Drinks", description: "Assam tea, ginger, cardamom", price: 100, emoji: "\u{1FAD6}", color: "peach" },
  { id: "cold-coffee", name: "Classic cold coffee", category: "Drinks", description: "Slow-brew coffee, milk, vanilla", price: 190, emoji: "\u{1F9CB}", color: "rose" },
  { id: "jaljeera", name: "Jaljeera cooler", category: "Drinks", description: "Chilled cumin, mint, lime, black salt", price: 120, emoji: "\u{1F379}", color: "green" },
  { id: "fresh-lime-soda", name: "Fresh lime soda", category: "Drinks", description: "Fresh lime, soda, sweet or salted", price: 140, emoji: "\u{1F34B}", color: "yellow" },
  { id: "rose-milk", name: "Rose almond milk", category: "Drinks", description: "Chilled milk, rose, crushed almonds", price: 170, emoji: "\u{1F964}", color: "rose" },
  { id: "tiramisu", name: "Classic tiramisu", category: "Desserts", description: "Espresso-soaked, cocoa-dusted", price: 340, emoji: "\u{1F370}", color: "rose" },
  { id: "gulab-jamun", name: "Gulab jamun", category: "Desserts", description: "Warm khoya dumplings, rose syrup", price: 160, emoji: "\u{1F36E}", color: "peach", popular: true },
  { id: "rasmalai", name: "Rasmalai", category: "Desserts", description: "Soft chenna, saffron milk, pistachio", price: 190, emoji: "\u{1F36E}", color: "yellow" },
  { id: "kulfi", name: "Malai kulfi", category: "Desserts", description: "Traditional slow-set cardamom kulfi", price: 150, emoji: "\u{1F366}", color: "green" },
  { id: "brownie", name: "Warm chocolate brownie", category: "Desserts", description: "Dark chocolate, vanilla ice cream", price: 280, emoji: "\u{1F36B}", color: "blue" },
  { id: "caramel-custard", name: "Caramel custard", category: "Desserts", description: "Silky baked custard, caramel sauce", price: 220, emoji: "\u{1F36E}", color: "yellow" },
  { id: "mango-cheesecake", name: "Mango cheesecake", category: "Desserts", description: "Cream cheese, mango glaze, biscuit base", price: 320, emoji: "\u{1F370}", color: "peach" },
];

export const initialData: PosData = {
  unavailableMenuIds: [],
  transactions: [],
  menuItems: menu,
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

