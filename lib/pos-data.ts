export type TableStatus =
  "available" | "occupied" | "reserved" | "cleaning" | "merged";
export type OrderStatus =
  "new" | "preparing" | "ready" | "served" | "paid" | "cancelled";
export type Category = string;
export const defaultCategories: string[] = [
  "Starters",
  "Soups",
  "Mains",
  "Breads & Sides",
  "Street Food",
  "Drinks",
  "Desserts",
];

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  emoji: string;
  color: string;
  popular?: boolean;
  variants?: MenuVariant[];
  modifiers?: MenuModifier[];
  stockCount?: number;
  lowStockThreshold?: number;
};

export type MenuVariant = { id: string; label: string; price: number };
export type MenuModifier = { id: string; label: string; price: number };

export type ReservationDetails = {
  guestName: string;
  guests: number;
  time: string;
};
export type DeliveryDetails = {
  recipientName: string;
  phone: string;
  address: string;
};
export type FloorPosition = { column: number; row: number };
export type Table = {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  floorPosition?: FloorPosition;
  guests?: number;
  reservation?: ReservationDetails;
  mergedInto?: string;
  mergedOrderIds?: string[];
  mergedOriginalStatus?: Exclude<TableStatus, "merged">;
  mergedOriginalGuests?: number;
  mergedBaseStatus?: Exclude<TableStatus, "merged">;
  mergedBaseGuests?: number;
};
export type OrderLine = {
  id?: string;
  menuItemId: string;
  quantity: number;
  note?: string;
  variant?: MenuVariant;
  modifiers?: MenuModifier[];
};
export type Order = {
  id: string;
  tableId: string | null;
  type: "Dine in" | "Takeaway" | "Delivery";
  deliveryDetails?: DeliveryDetails;
  status: OrderStatus;
  items: OrderLine[];
  rounds?: OrderLine[][];
  stockConsumedItems?: OrderLine[];
  lastFiredAt?: string;
  createdAt: string;
  cancellationReason?: string;
};
export type PaymentMethod = "Cash" | "Card" | "UPI";
export type PaymentTransaction = {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  splitLabel?: string;
};
export type InventoryMovement = {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  reason: "restock" | "sale" | "cancellation";
  orderId?: string;
  createdAt: string;
};
export type PosData = {
  tables: Table[];
  orders: Order[];
  unavailableMenuIds: string[];
  transactions: PaymentTransaction[];
  menuItems: MenuItem[];
  categories?: string[];
  inventoryMovements?: InventoryMovement[];
};

export const menu: MenuItem[] = [
  {
    id: "burrata",
    name: "Dahi puri chaat",
    category: "Starters",
    description: "Crisp puris, whipped yogurt, chutneys, sev",
    price: 480,
    emoji: "\u{1F957}",
    color: "peach",
    popular: true,
  },
  {
    id: "truffle-fries",
    name: "Aloo tikki chaat",
    category: "Starters",
    description: "Crisp potato patties, chole, chutneys",
    price: 260,
    emoji: "\u{1F954}",
    color: "yellow",
    popular: true,
  },
  {
    id: "paneer-tikka",
    name: "Tandoori paneer tikka",
    category: "Starters",
    description: "Charred cottage cheese, mint chutney",
    price: 320,
    emoji: "\u{1F9C0}",
    color: "peach",
    popular: true,
  },
  {
    id: "veg-samosa",
    name: "Punjabi vegetable samosa",
    category: "Starters",
    description: "Spiced potato, peas, tamarind chutney",
    price: 180,
    emoji: "\u{1F956}",
    color: "yellow",
  },
  {
    id: "chicken-tikka",
    name: "Chicken tikka",
    category: "Starters",
    description: "Yogurt-marinated, tandoor roasted",
    price: 360,
    emoji: "\u{1F357}",
    color: "rose",
    popular: true,
  },
  {
    id: "crispy-corn",
    name: "Crispy masala corn",
    category: "Starters",
    description: "Sweet corn, curry leaf, house spice",
    price: 240,
    emoji: "\u{1F33D}",
    color: "yellow",
  },
  {
    id: "dahi-kebab",
    name: "Dahi ke kebab",
    category: "Starters",
    description: "Crisp hung-curd patties, coriander chutney",
    price: 290,
    emoji: "\u{1F958}",
    color: "green",
  },
  {
    id: "fish-amritsari",
    name: "Amritsari fish bites",
    category: "Starters",
    description: "Crispy spiced fish, lemon, mint dip",
    price: 390,
    emoji: "\u{1F41F}",
    color: "blue",
  },
  {
    id: "spring-rolls",
    name: "Hara bhara kebab",
    category: "Starters",
    description: "Spinach and green pea kebabs, mint chutney",
    price: 260,
    emoji: "\u{1F96C}",
    color: "yellow",
  },
  {
    id: "veg-seekh-kebab",
    name: "Vegetable seekh kebab",
    category: "Starters",
    description: "Smoky minced vegetables, green chutney",
    price: 310,
    emoji: "\u{1F957}",
    color: "green",
  },
  {
    id: "chicken-malai-tikka",
    name: "Chicken malai tikka",
    category: "Starters",
    description: "Creamy yogurt marinade, charred in the tandoor",
    price: 390,
    emoji: "\u{1F357}",
    color: "peach",
    popular: true,
  },
  {
    id: "tandoori-mushroom",
    name: "Tandoori mushroom tikka",
    category: "Starters",
    description: "Spiced mushrooms, onion, mint chutney",
    price: 320,
    emoji: "\u{1F344}",
    color: "rose",
  },
  {
    id: "salmon",
    name: "Amritsari fish curry",
    category: "Mains",
    description: "Punjabi spices, tangy gravy, steamed basmati",
    price: 780,
    emoji: "\u{1F35B}",
    color: "blue",
    popular: true,
  },
  {
    id: "steak",
    name: "Mutton keema matar",
    category: "Mains",
    description: "Slow-cooked minced mutton, peas, pav",
    price: 1250,
    emoji: "\u{1F35B}",
    color: "rose",
  },
  {
    id: "gnocchi",
    name: "Malai kofta",
    category: "Mains",
    description: "Paneer and potato dumplings, creamy makhani gravy",
    price: 560,
    emoji: "\u{1F372}",
    color: "green",
    popular: true,
  },
  {
    id: "butter-chicken",
    name: "Butter chicken",
    category: "Mains",
    description: "Tandoor chicken, tomato makhani gravy",
    price: 520,
    emoji: "\u{1F958}",
    color: "rose",
    popular: true,
  },
  {
    id: "paneer-makhani",
    name: "Paneer makhani",
    category: "Mains",
    description: "Cottage cheese, slow-cooked tomato cream",
    price: 420,
    emoji: "\u{1F372}",
    color: "peach",
  },
  {
    id: "chicken-biryani",
    name: "Hyderabadi chicken biryani",
    category: "Mains",
    description: "Dum-cooked basmati, raita, salan",
    price: 460,
    emoji: "\u{1F35A}",
    color: "yellow",
    popular: true,
  },
  {
    id: "veg-biryani",
    name: "Vegetable dum biryani",
    category: "Mains",
    description: "Saffron basmati, seasonal vegetables",
    price: 360,
    emoji: "\u{1F35B}",
    color: "green",
  },
  {
    id: "dal-makhani",
    name: "Dal makhani",
    category: "Mains",
    description: "Black lentils simmered overnight",
    price: 340,
    emoji: "\u{1FAD8}",
    color: "rose",
  },
  {
    id: "palak-paneer",
    name: "Palak paneer",
    category: "Mains",
    description: "Spinach, cottage cheese, garlic tadka",
    price: 390,
    emoji: "\u{1F957}",
    color: "green",
  },
  {
    id: "rogan-josh",
    name: "Kashmiri rogan josh",
    category: "Mains",
    description: "Slow-braised lamb, aromatic Kashmiri spices",
    price: 620,
    emoji: "\u{1F958}",
    color: "rose",
  },
  {
    id: "chole-bhature",
    name: "Chole bhature",
    category: "Mains",
    description: "Punjabi chickpeas, two fluffy bhature",
    price: 320,
    emoji: "\u{1F35B}",
    color: "yellow",
  },
  {
    id: "shahi-paneer",
    name: "Shahi paneer",
    category: "Mains",
    description: "Paneer in a mild cashew and saffron gravy",
    price: 430,
    emoji: "\u{1F372}",
    color: "peach",
  },
  {
    id: "goan-fish-curry",
    name: "Goan coconut fish curry",
    category: "Mains",
    description: "Coastal coconut curry, steamed basmati",
    price: 560,
    emoji: "\u{1F963}",
    color: "blue",
  },
  {
    id: "chicken-chettinad",
    name: "Chicken Chettinad",
    category: "Mains",
    description: "Tamil Nadu pepper masala, curry leaves, basmati",
    price: 520,
    emoji: "\u{1F35B}",
    color: "rose",
    popular: true,
  },
  {
    id: "paneer-lababdar",
    name: "Paneer lababdar",
    category: "Mains",
    description: "Paneer, tomato gravy, kasuri methi",
    price: 440,
    emoji: "\u{1F372}",
    color: "peach",
  },
  {
    id: "gatte-ki-sabzi",
    name: "Rajasthani gatte ki sabzi",
    category: "Mains",
    description: "Gram flour dumplings in spiced yogurt curry",
    price: 360,
    emoji: "\u{1F372}",
    color: "yellow",
  },
  {
    id: "kerala-veg-stew",
    name: "Kerala vegetable stew",
    category: "Mains",
    description: "Seasonal vegetables, coconut milk, whole spices",
    price: 390,
    emoji: "\u{1F963}",
    color: "green",
  },
  {
    id: "margherita",
    name: "Mumbai pav bhaji",
    category: "Street Food",
    description: "Spiced mashed vegetables, buttered pav, onion",
    price: 420,
    emoji: "\u{1F35B}",
    color: "peach",
  },
  {
    id: "tandoori-pizza",
    name: "Vada pav",
    category: "Street Food",
    description: "Spiced potato fritter, pav, dry garlic chutney",
    price: 480,
    emoji: "\u{1F354}",
    color: "rose",
    popular: true,
  },
  {
    id: "farmhouse-pizza",
    name: "Dahi papdi chaat",
    category: "Street Food",
    description: "Papdi, potatoes, yogurt, sweet and green chutney",
    price: 450,
    emoji: "\u{1F957}",
    color: "green",
  },
  {
    id: "chicken-pizza",
    name: "Chicken kathi roll",
    category: "Street Food",
    description: "Tandoori chicken, flaky paratha, onion, mint chutney",
    price: 540,
    emoji: "\u{1F959}",
    color: "yellow",
  },
  {
    id: "pepperoni-pizza",
    name: "Misal pav",
    category: "Street Food",
    description: "Maharashtrian sprouted curry, farsan, pav",
    price: 590,
    emoji: "\u{1F35B}",
    color: "rose",
  },
  {
    id: "four-cheese-pizza",
    name: "Pani puri platter",
    category: "Street Food",
    description: "Crisp puris, spiced potato, mint pani, tamarind",
    price: 560,
    emoji: "\u{1F95F}",
    color: "yellow",
  },
  {
    id: "raj-kachori",
    name: "Raj kachori",
    category: "Street Food",
    description: "Crisp kachori, sprouts, yogurt, chutneys, sev",
    price: 240,
    emoji: "\u{1F95F}",
    color: "peach",
    popular: true,
  },
  {
    id: "paneer-kathi-roll",
    name: "Paneer kathi roll",
    category: "Street Food",
    description: "Tawa paneer, flaky paratha, pickled onion",
    price: 290,
    emoji: "\u{1F959}",
    color: "green",
  },
  {
    id: "kutchi-dabeli",
    name: "Kutchi dabeli",
    category: "Street Food",
    description: "Sweet-spicy potato, masala peanuts, pomegranate",
    price: 180,
    emoji: "\u{1F354}",
    color: "yellow",
  },
  {
    id: "tomato-soup",
    name: "Tamatar dhaniya shorba",
    category: "Soups",
    description: "Tomato, fresh coriander, toasted cumin",
    price: 220,
    emoji: "\u{1F35C}",
    color: "rose",
    popular: true,
  },
  {
    id: "sweet-corn-soup",
    name: "Desi sweet corn shorba",
    category: "Soups",
    description: "Sweet corn, ginger, coriander, black pepper",
    price: 210,
    emoji: "\u{1F35C}",
    color: "yellow",
  },
  {
    id: "hot-sour-soup",
    name: "Lemon coriander shorba",
    category: "Soups",
    description: "Seasonal vegetables, lemon, fresh coriander",
    price: 230,
    emoji: "\u{1F35C}",
    color: "green",
  },
  {
    id: "chicken-manchow",
    name: "Chicken manchow soup",
    category: "Soups",
    description: "Indo-Chinese broth, crisp noodle garnish",
    price: 260,
    emoji: "\u{1F35C}",
    color: "peach",
  },
  {
    id: "butter-naan",
    name: "Butter naan",
    category: "Breads & Sides",
    description: "Tandoor-baked leavened bread, brushed with butter",
    price: 80,
    emoji: "\u{1FAD3}",
    color: "yellow",
  },
  {
    id: "garlic-naan",
    name: "Garlic naan",
    category: "Breads & Sides",
    description: "Fresh garlic, coriander, melted butter",
    price: 110,
    emoji: "\u{1FAD3}",
    color: "peach",
    popular: true,
  },
  {
    id: "tandoori-roti",
    name: "Tandoori roti",
    category: "Breads & Sides",
    description: "Whole-wheat bread baked in the clay oven",
    price: 55,
    emoji: "\u{1FAD3}",
    color: "green",
  },
  {
    id: "laccha-paratha",
    name: "Laccha paratha",
    category: "Breads & Sides",
    description: "Flaky layered flatbread, griddled to order",
    price: 95,
    emoji: "\u{1F95E}",
    color: "rose",
  },
  {
    id: "jeera-rice",
    name: "Jeera rice",
    category: "Breads & Sides",
    description: "Basmati rice tempered with cumin",
    price: 190,
    emoji: "\u{1F35A}",
    color: "yellow",
  },
  {
    id: "boondi-raita",
    name: "Boondi raita",
    category: "Breads & Sides",
    description: "Chilled yogurt, crisp boondi, roasted cumin",
    price: 150,
    emoji: "\u{1F963}",
    color: "blue",
  },
  {
    id: "masala-papad",
    name: "Masala papad",
    category: "Breads & Sides",
    description: "Crisp papad topped with tomato and onion",
    price: 110,
    emoji: "\u{1FAD3}",
    color: "peach",
  },
  {
    id: "missi-roti",
    name: "Missi roti",
    category: "Breads & Sides",
    description: "Spiced gram flour and wheat flatbread",
    price: 75,
    emoji: "\u{1FAD3}",
    color: "yellow",
  },
  {
    id: "appam",
    name: "Kerala appam",
    category: "Breads & Sides",
    description: "Soft-centered fermented rice pancake",
    price: 65,
    emoji: "\u{1F95E}",
    color: "peach",
  },
  {
    id: "spritz",
    name: "Aam panna",
    category: "Drinks",
    description: "Green mango, roasted cumin, mint, black salt",
    price: 280,
    emoji: "\u{1F964}",
    color: "yellow",
    popular: true,
  },
  {
    id: "lemonade",
    name: "House lemonade",
    category: "Drinks",
    description: "Fresh lemon, mint, a little sparkle",
    price: 150,
    emoji: "\u{1F34B}",
    color: "green",
  },
  {
    id: "mango-lassi",
    name: "Mango lassi",
    category: "Drinks",
    description: "Alphonso mango, chilled yogurt",
    price: 180,
    emoji: "\u{1F959}",
    color: "yellow",
    popular: true,
  },
  {
    id: "masala-chai",
    name: "Masala chai",
    category: "Drinks",
    description: "Assam tea, ginger, cardamom",
    price: 100,
    emoji: "\u{1FAD6}",
    color: "peach",
  },
  {
    id: "cold-coffee",
    name: "Classic cold coffee",
    category: "Drinks",
    description: "Slow-brew coffee, milk, vanilla",
    price: 190,
    emoji: "\u{1F9CB}",
    color: "rose",
  },
  {
    id: "jaljeera",
    name: "Jaljeera cooler",
    category: "Drinks",
    description: "Chilled cumin, mint, lime, black salt",
    price: 120,
    emoji: "\u{1F379}",
    color: "green",
  },
  {
    id: "fresh-lime-soda",
    name: "Fresh lime soda",
    category: "Drinks",
    description: "Fresh lime, soda, sweet or salted",
    price: 140,
    emoji: "\u{1F34B}",
    color: "yellow",
  },
  {
    id: "rose-milk",
    name: "Rose almond milk",
    category: "Drinks",
    description: "Chilled milk, rose, crushed almonds",
    price: 170,
    emoji: "\u{1F964}",
    color: "rose",
  },
  {
    id: "filter-coffee",
    name: "South Indian filter coffee",
    category: "Drinks",
    description: "Strong kaapi, chicory, hot milk",
    price: 120,
    emoji: "\u{2615}",
    color: "rose",
    popular: true,
  },
  {
    id: "kokum-sharbat",
    name: "Konkan kokum sharbat",
    category: "Drinks",
    description: "Chilled kokum, lime, roasted cumin",
    price: 150,
    emoji: "\u{1F964}",
    color: "rose",
  },
  {
    id: "tiramisu",
    name: "Shahi tukda",
    category: "Desserts",
    description: "Saffron rabri, crisp bread, pistachio",
    price: 340,
    emoji: "\u{1F36E}",
    color: "rose",
  },
  {
    id: "gulab-jamun",
    name: "Gulab jamun",
    category: "Desserts",
    description: "Warm khoya dumplings, rose syrup",
    price: 160,
    emoji: "\u{1F36E}",
    color: "peach",
    popular: true,
  },
  {
    id: "rasmalai",
    name: "Rasmalai",
    category: "Desserts",
    description: "Soft chenna, saffron milk, pistachio",
    price: 190,
    emoji: "\u{1F36E}",
    color: "yellow",
  },
  {
    id: "kulfi",
    name: "Malai kulfi",
    category: "Desserts",
    description: "Traditional slow-set cardamom kulfi",
    price: 150,
    emoji: "\u{1F366}",
    color: "green",
  },
  {
    id: "brownie",
    name: "Gajar ka halwa",
    category: "Desserts",
    description: "Slow-cooked carrots, khoya, nuts",
    price: 280,
    emoji: "\u{1F957}",
    color: "blue",
  },
  {
    id: "caramel-custard",
    name: "Kesar phirni",
    category: "Desserts",
    description: "Ground rice pudding, saffron, pistachio",
    price: 220,
    emoji: "\u{1F36E}",
    color: "yellow",
  },
  {
    id: "mango-cheesecake",
    name: "Mango shrikhand",
    category: "Desserts",
    description: "Strained yogurt, Alphonso mango, cardamom",
    price: 320,
    emoji: "\u{1F95E}",
    color: "peach",
  },
  {
    id: "jalebi-rabri",
    name: "Jalebi with rabri",
    category: "Desserts",
    description: "Warm saffron jalebi, chilled rabri",
    price: 220,
    emoji: "\u{1F36E}",
    color: "yellow",
    popular: true,
  },
  {
    id: "coconut-payasam",
    name: "Coconut payasam",
    category: "Desserts",
    description: "South Indian coconut milk pudding, cashews",
    price: 190,
    emoji: "\u{1F963}",
    color: "peach",
  },
];

const previousSeedMenuNames: Record<string, string> = {
  burrata: "Burrata & tomatoes",
  "truffle-fries": "Truffle parmesan fries",
  "spring-rolls": "Vegetable spring rolls",
  salmon: "Seared salmon",
  steak: "Ribeye steak frites",
  gnocchi: "Wild mushroom gnocchi",
  margherita: "Margherita",
  "tandoori-pizza": "Tandoori paneer pizza",
  "farmhouse-pizza": "Garden farmhouse pizza",
  "chicken-pizza": "Chicken tikka pizza",
  "pepperoni-pizza": "Pepperoni pizza",
  "four-cheese-pizza": "Four cheese pizza",
  "tomato-soup": "Roasted tomato soup",
  "sweet-corn-soup": "Sweet corn soup",
  "hot-sour-soup": "Hot & sour vegetable soup",
  spritz: "Citrus garden spritz",
  tiramisu: "Classic tiramisu",
  brownie: "Warm chocolate brownie",
  "caramel-custard": "Caramel custard",
  "mango-cheesecake": "Mango cheesecake",
};

const addedSeedMenuItemIds = new Set([
  "veg-seekh-kebab",
  "chicken-malai-tikka",
  "tandoori-mushroom",
  "chicken-chettinad",
  "paneer-lababdar",
  "gatte-ki-sabzi",
  "kerala-veg-stew",
  "raj-kachori",
  "paneer-kathi-roll",
  "kutchi-dabeli",
  "missi-roti",
  "appam",
  "filter-coffee",
  "kokum-sharbat",
  "jalebi-rabri",
  "coconut-payasam",
]);

export function migrateMenuItems(items: MenuItem[]): MenuItem[] {
  const currentItems = new Map(menu.map((item) => [item.id, item]));
  const migratedItems = items.map((item) => {
    const currentItem = currentItems.get(item.id);
    if (!currentItem || item.name !== previousSeedMenuNames[item.id])
      return item;
    return {
      ...currentItem,
      stockCount: item.stockCount,
      lowStockThreshold: item.lowStockThreshold,
    };
  });
  const presentIds = new Set(migratedItems.map((item) => item.id));
  const newlyAddedItems = menu.filter(
    (item) => addedSeedMenuItemIds.has(item.id) && !presentIds.has(item.id),
  );
  return [...migratedItems, ...newlyAddedItems];
}

export const initialData: PosData = {
  categories: defaultCategories,
  unavailableMenuIds: [],
  transactions: [],
  menuItems: menu,
  tables: [
    { id: "t1", name: "01", seats: 2, status: "occupied", guests: 2 },
    { id: "t2", name: "02", seats: 2, status: "available" },
    { id: "t3", name: "03", seats: 4, status: "occupied", guests: 3 },
    { id: "t4", name: "04", seats: 4, status: "available" },
    { id: "t5", name: "05", seats: 4, status: "reserved" },
    { id: "t6", name: "06", seats: 6, status: "available" },
    { id: "t7", name: "07", seats: 2, status: "cleaning" },
    { id: "t8", name: "08", seats: 4, status: "occupied", guests: 4 },
    { id: "t9", name: "09", seats: 6, status: "available" },
    { id: "t10", name: "10", seats: 2, status: "available" },
  ],
  orders: [
    {
      id: "#1048",
      tableId: "t1",
      type: "Dine in",
      status: "preparing",
      items: [
        { menuItemId: "burrata", quantity: 1 },
        { menuItemId: "salmon", quantity: 2 },
      ],
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
    },
    {
      id: "#1049",
      tableId: "t3",
      type: "Dine in",
      status: "ready",
      items: [{ menuItemId: "gnocchi", quantity: 2 }],
      createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    },
    {
      id: "#1050",
      tableId: "t8",
      type: "Dine in",
      status: "preparing",
      items: [
        { menuItemId: "steak", quantity: 2 },
        { menuItemId: "spritz", quantity: 2 },
      ],
      createdAt: new Date(Date.now() - 9 * 60000).toISOString(),
    },
  ],
};

const DB_NAME = "dinein-pos";
const STORE = "workspace";
const DB_VERSION = 2;

function openPosDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local POS storage."));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error("Close other Dine In tabs to finish updating local storage."),
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
  });
}

export function loadPosData(): Promise<PosData | null> {
  return openPosDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const fail = (error: DOMException | null) => {
          db.close();
          reject(error ?? new Error("Could not read local POS data."));
        };
        const get = db
          .transaction(STORE, "readonly")
          .objectStore(STORE)
          .get("pos");
        get.onsuccess = () => {
          resolve(get.result ?? null);
          db.close();
        };
        get.onerror = () => fail(get.error);
      }),
  );
}

export function savePosData(data: PosData): Promise<void> {
  return openPosDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(data, "pos");
        transaction.oncomplete = () => {
          resolve();
          db.close();
        };
        transaction.onabort = () => {
          reject(
            transaction.error ?? new Error("Could not save local POS data."),
          );
          db.close();
        };
        transaction.onerror = () => {
          reject(
            transaction.error ?? new Error("Could not save local POS data."),
          );
          db.close();
        };
      }),
  );
}
