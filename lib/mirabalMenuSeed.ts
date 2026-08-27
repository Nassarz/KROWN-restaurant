import { dataStore } from './dataStore';
import { Product } from './mockData';

export const MIRABAL_MENU_ITEMS: Array<{
  name: string;
  price: number;
  category: string;
  description?: string;
  image: string;
  requiresKitchen?: boolean;
}> = [
  // ── Sandwiches ─────────────────────────────────────────────────────────────
  {
    name: 'Classic Club Sandwichs',
    price: 30000,
    category: 'Sandwiches',
    description: 'Chicken breast, lettuce, tomato, fried egg, beef or bacon. Served with plain or toasted on whole meal bread or baguette with choice of one side dish.',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Beef Lily Sandwiches',
    price: 25000,
    category: 'Sandwiches',
    description: 'Grilled minute steak with rocket, mustard and fried onions. Served with plain or toasted on whole meal bread or baguette with choice of one side dish.',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Design Your Own Sandwiches',
    price: 20000,
    category: 'Sandwiches',
    description: 'With a choice of two fillings: roast beef, chicken, cured ham, cheddar cheese, avocado, tomato or grilled vegetable. Served with choice of one side dish.',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'The Vegetarian Sandwiches',
    price: 20000,
    category: 'Sandwiches',
    description: 'Filled with Provecole vegetable, avocado and mozzarella. Served with choice of one side dish.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },

  // ── Main Course ─────────────────────────────────────────────────────────────
  {
    name: 'Pan Fried Fillet of Tilapia',
    price: 30000,
    category: 'Main Course',
    description: 'Lemon butter sauce served with seasonal vegetable and a choice of chips, mashed potatoes, steamed or fried rice, or steamed potatoes.',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Whole Deep Fried Fish',
    price: 30000,
    category: 'Main Course',
    description: 'Steamed in tomato sauce, deep fried, or baked with French fries or vegetable fried rice and baked potatoes.',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Fish Finger and French Fries',
    price: 25000,
    category: 'Main Course',
    description: 'Crispy fried fish fingers served with golden French fries.',
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Chicken Wings and French Fries',
    price: 25000,
    category: 'Main Course',
    description: 'Crispy seasoned chicken wings served with hot French fries.',
    image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Grilled Double Chicken Breast',
    price: 35000,
    category: 'Main Course',
    description: 'Mushroom sauce served with turned seasonal vegetables and a choice of french-fries, baked potatoes, steamed or fried rice.',
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Grilled Tender Beef Fillet 200gms',
    price: 40000,
    category: 'Main Course',
    description: 'Finest aged Ugandan beef served with peppercorn sauce, grilled vegetables with herbs and choice of steamed/fried rice, French fries, or baked potatoes.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Roast Drumstick with BBQ Sauce',
    price: 30000,
    category: 'Main Course',
    description: 'Served with seasonal vegetables or French fries.',
    image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Grilled Pork Chops Served with BBQ Sauce',
    price: 40000,
    category: 'Main Course',
    description: 'Served with BBQ sauce and a choice of baked potatoes, steamed or vegetable fried rice.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Fried BBQ Pork Spareribs',
    price: 30000,
    category: 'Main Course',
    description: 'Served with French fries and fresh garden salads.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },

  // ── Pastas ──────────────────────────────────────────────────────────────────
  {
    name: 'Spageti Bolognise',
    price: 25000,
    category: 'Pastas',
    description: 'Pure minced beef cooked to perfection in rich herbed garlic and tomato sauce.',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Spageti Napolitana',
    price: 25000,
    category: 'Pastas',
    description: 'Cooked in tomato, herbed garlic sauce.',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Penne Arabiata',
    price: 25000,
    category: 'Pastas',
    description: 'Tossed in tomato herbed garlic sauce, basil and green chilies.',
    image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Lazagna Bolonaise (Beef)',
    price: 30000,
    category: 'Pastas',
    description: 'Cooked to perfection with minced meat and basil, mozzarella cheese.',
    image: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },

  // ── Pizzas ──────────────────────────────────────────────────────────────────
  {
    name: 'Margharita Classic',
    price: 30000,
    category: 'Pizzas',
    description: 'Plum tomatoes, shredded mozzarella cheese and fresh basil.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Napoli Pizza',
    price: 40000,
    category: 'Pizzas',
    description: 'Anchovy fillet, tomato sauce, mozzarella and capers.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Vegetarian Pizza',
    price: 30000,
    category: 'Pizzas',
    description: 'Seasoned grilled vegetables, tomato sauce, mozzarella cheese, pesto swirl.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'BBQ Chicken Pizza',
    price: 30000,
    category: 'Pizzas',
    description: 'Olives, bell peppers and onions with BBQ chicken.',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },
  {
    name: 'Mirabal Special Pizza',
    price: 35000,
    category: 'Pizzas',
    description: 'Beef, olives, basil, pimentos, mozzarella cheese.',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: true,
  },

  // ── Expresso Bar ────────────────────────────────────────────────────────────
  { name: 'Single Expresso single', price: 6000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Double Expresso double', price: 7000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Americano / black Coffee', price: 9000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Lungo', price: 9000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cortado', price: 9000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Picolo latte', price: 9000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Macchiato', price: 9000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cappuccino double', price: 12000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cappuccino single', price: 10000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Hot chocolate', price: 13000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Café mocha', price: 13000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Caffe latte / Café latte', price: 10000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'African coffee', price: 10000, category: 'Expresso Bar', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Booster & Iced Coffees ─────────────────────────────────────────────────
  { name: 'Red Eye', price: 9000, category: 'Booster & Iced Coffees', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Black Eye', price: 9000, category: 'Booster & Iced Coffees', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Dead Eye', price: 10000, category: 'Booster & Iced Coffees', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced latte', price: 12000, category: 'Booster & Iced Coffees', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced cappuccino', price: 12000, category: 'Booster & Iced Coffees', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Flavoured & Spiced Lattes ──────────────────────────────────────────────
  { name: 'Marshmallow latte', price: 13000, category: 'Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Lavendar latte', price: 13000, category: 'Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Caramel latte', price: 13000, category: 'Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Chocolate latte', price: 13000, category: 'Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla latte', price: 13000, category: 'Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Flavoured & Spiced Cappuccinos ────────────────────────────────────────
  { name: 'Lavendar cappuccino', price: 13000, category: 'Flavoured & Spiced Cappuccinos', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Marshmallow cappuccino', price: 13000, category: 'Flavoured & Spiced Cappuccinos', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Caramel cappuccino', price: 13000, category: 'Flavoured & Spiced Cappuccinos', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla cappuccino', price: 13000, category: 'Flavoured & Spiced Cappuccinos', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Iced Flavoured & Spiced Lattes ────────────────────────────────────────
  { name: 'Iced marshmallow latte', price: 14000, category: 'Iced Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced lavender latte', price: 14000, category: 'Iced Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced chocolate latte', price: 14000, category: 'Iced Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced caramel latte', price: 14000, category: 'Iced Flavoured & Spiced Lattes', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Teas ───────────────────────────────────────────────────────────────────
  { name: 'Black tea', price: 8000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Black tea spiced', price: 9000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'African tea', price: 9000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'African spiced tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Lemon tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mint tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Dawa tea', price: 12000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Hot water plain', price: 5000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Indian tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Green tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'English tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Iced tea', price: 10000, category: 'Teas', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cold milk', price: 5000, category: 'Teas', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Lemonades ───────────────────────────────────────────────────────────────
  { name: 'Purple lemonade', price: 12000, category: 'Lemonades', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Blue lemonade', price: 12000, category: 'Lemonades', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Kiwi lemonade', price: 12000, category: 'Lemonades', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Bubble gum lemonade', price: 12000, category: 'Lemonades', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Coladas ─────────────────────────────────────────────────────────────────
  { name: 'Virgin colada', price: 13000, category: 'Coladas', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Pina colada', price: 13000, category: 'Coladas', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Mojitos ─────────────────────────────────────────────────────────────────
  { name: 'Blue lagoon mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Strawberry mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Bubblegum mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Blue berry mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Passion mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Virgin mojito', price: 13000, category: 'Mojitos', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Milk Shakes ─────────────────────────────────────────────────────────────
  { name: 'Vanilla milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Straw berry milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Chocolate milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Caramel milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Blue Berry Milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Oreo Milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mango Milk shake', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Peanut butter milk shakes', price: 16000, category: 'Milk Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Fresh Smoothies & Special Blends ────────────────────────────────────────
  { name: 'Avocado smoothies', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Banana smoothies', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Straw berry smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Tropical smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Blue berry smoothies', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Peanut butter smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mango smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mango madness smoothie', price: 15000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cherry berries smoothies (Mirabal Signature)', price: 18000, category: 'Fresh Smoothies', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Fresh Juice ─────────────────────────────────────────────────────────────
  { name: 'Passion juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mango juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Water melon juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Carrot juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Pineapple juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Beetroot juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Lemon juice', price: 12000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Apple juice', price: 14000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Orange juice', price: 17000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Beetroot, carrot & mango juice', price: 14000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Pineapple & mint juice', price: 14000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cocktail juice', price: 14000, category: 'Fresh Juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Breads (Sour Dough Bread) ──────────────────────────────────────────────
  { name: 'Cereal Bread 500g', price: 10000, category: 'Sour Dough Bread', description: 'French and Italian selection of sour dough bread.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Cereal Bread, 1kg', price: 14000, category: 'Sour Dough Bread', description: 'French and Italian selection of sour dough bread.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Whole wheat bread 1kg', price: 12000, category: 'Sour Dough Bread', description: 'Healthy whole wheat sour dough bread.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Whole wheat bread 500g', price: 8000, category: 'Sour Dough Bread', description: 'Healthy whole wheat sour dough bread.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Baguettes & Bakery ─────────────────────────────────────────────────────
  { name: 'Cereal Baguette Big', price: 5000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Plain Baguettes Big', price: 4000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mini Baguettes', price: 3000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Mini Cereal Baguette', price: 5000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Farm Bread', price: 8000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Buns (burger)', price: 2000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Plain Donuts', price: 2000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Filled Donut', price: 3000, category: 'Baguettes & Bakery', image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Bread Loaves ────────────────────────────────────────────────────────────
  { name: 'Salty Brown Loaf 1kg', price: 8000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Brown sweet Bread 1kg', price: 7000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'White Sweet bread 1kg', price: 7000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'White Sweet bread 500g', price: 3000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Castan sweet bread 1kg', price: 10000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Sweet Hala bread', price: 8000, category: 'Bread Loaves', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Cakes (Slices) ──────────────────────────────────────────────────────────
  { name: 'Marble Cake slices', price: 5000, category: 'Cakes Slices', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Banana Cake slices', price: 5000, category: 'Cakes Slices', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Fruit Cake slices', price: 5000, category: 'Cakes Slices', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Muffin Cake', price: 3000, category: 'Cakes Slices', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Whole Cake ──────────────────────────────────────────────────────────────
  { name: 'Butter scotch layered 1kg', price: 80000, category: 'Whole Cakes', description: 'For occasions, birthdays etc.', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Red velvet Cake 1kg', price: 85000, category: 'Whole Cakes', description: 'For occasions, birthdays etc.', image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla Cake 1kg', price: 85000, category: 'Whole Cakes', description: 'For occasions, birthdays etc.', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Chocolate Fudge', price: 80000, category: 'Whole Cakes', description: 'For occasions, birthdays etc.', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Pastry & Danishes ───────────────────────────────────────────────────────
  { name: 'Plain Croissant', price: 6000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Chocolate Croissant', price: 8000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla Croissant', price: 8000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Almond Croissant', price: 10000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Blueberry Danishes', price: 6000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Vanilla Danishes', price: 6000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },
  { name: 'Strawberry Danishes', price: 6000, category: 'Pastry & Danishes', description: 'Selection of Italian pastries.', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', requiresKitchen: false },

  // ── Pies & Samosas ──────────────────────────────────────────────────────────
  { name: 'Chicken pie', price: 8000, category: 'Pies & Samosas', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', requiresKitchen: true },
  { name: 'Meat pie', price: 8000, category: 'Pies & Samosas', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', requiresKitchen: true },
  { name: 'Cheese pie', price: 8000, category: 'Pies & Samosas', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', requiresKitchen: true },
  { name: 'A Pair of Samosa (all kinds)', price: 5000, category: 'Pies & Samosas', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80', requiresKitchen: true },

  // ── Desserts, Cake & Pastry ─────────────────────────────────────────────────
  {
    name: 'Tiramisu',
    price: 16000,
    category: 'Desserts & Pastry',
    description: 'A twist on the classic tiramisu, infused with Ugandan coffee and a hint of cocoa powder.',
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Black Forest',
    price: 16000,
    category: 'Desserts & Pastry',
    description: 'Moist chocolate sponge layered with cherries and whipped cream.',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Red velvet cake',
    price: 15000,
    category: 'Desserts & Pastry',
    description: 'A classic, moist and vibrant red cake layered with a rich cream cheese frosting.',
    image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Chocolate Fudge cake',
    price: 18000,
    category: 'Desserts & Pastry',
    description: 'A delightfully moist chocolate cake layered with a chocolate frosting.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Strawberry cheese cake',
    price: 18000,
    category: 'Desserts & Pastry',
    description: 'A light, rich cheesecake.',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Crème Brule',
    price: 18000,
    category: 'Desserts & Pastry',
    description: 'A French style with caramelized sugar topping.',
    image: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Milifoni',
    price: 15000,
    category: 'Desserts & Pastry',
    description: 'A French dessert fully covered with a puff pastry with vanilla layers or pastry cream.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
  {
    name: 'Icecream Scoops',
    price: 7000,
    category: 'Desserts & Pastry',
    description: 'Delightful scoops of premium ice-cream.',
    image: 'https://images.unsplash.com/photo-1560008511-11c63416e52d?auto=format&fit=crop&w=600&q=80',
    requiresKitchen: false,
  },
];

export function ensureMirabalBranchAndMenu() {
  const branches = dataStore.getBranches();
  let mirabal = branches.find(b => b.name.toLowerCase() === 'mirabal' || b.id === 'branch-mirabal');
  
  if (!mirabal) {
    mirabal = dataStore.addBranch({
      name: 'Mirabal',
      location: 'Kampala',
      city: 'Kampala',
      manager: 'Mirabal Manager',
      phone: '+256700000000',
      tablesCount: 25,
    });
  }

  const existingProducts = dataStore.getProducts(mirabal.id);
  const existingNames = new Set(existingProducts.map(p => p.name.trim().toLowerCase()));

  for (const item of MIRABAL_MENU_ITEMS) {
    if (!existingNames.has(item.name.trim().toLowerCase())) {
      dataStore.addProduct({
        name: item.name,
        price: item.price,
        category: item.category,
        image: item.image,
        description: item.description,
        available: true,
        requiresKitchen: item.requiresKitchen ?? true,
        branchId: mirabal.id,
        branchName: mirabal.name,
      });

      dataStore.addCustomCategory(item.category);
    }
  }

  return mirabal;
}
