import type { BuildingType, Good, Role } from '@vibe-rico/game-engine';
export const BUILDING_MODEL: Record<BuildingType, string> = {
  "small-market": "Small Market",
  "builders-yard": "Builder's Yard",
  "hacienda": "Hacienda",
  "small-warehouse": "Small Warehouse",
  "hospital": "Hospital",
  "large-market": "Large Market",
  "large-warehouse": "Large Warehouse",
  "factory": "Factory",
  "harbor": "Harbor",
  "office": "Office",
  "school": "School",
  "wharf": "Wharf",
  "small-fruit-depot": "Small Fruit Depot",
  "large-fruit-depot": "Large Fruit Depot",
  "large-tobacco-storage": "Large Tobacco Storage",
  "small-sugar-mill": "Small Sugar Mill",
  "large-sugar-mill": "Large Sugar Mill",
  "large-coffee-roaster": "Large Coffee Roaster",
  "city-hall": "City Hall",
  "customs-house": "Customs House",
  "fire-station": "Fire Station",
  "fortress": "Fortress",
  "residence": "Residence",
};
export const ESTATE_MODEL: Record<Good | 'quarry', string> = { corn: 'Corn Estate', fruit: 'Banana Estate', sugar: 'Sugar Estate', tobacco: 'Tobacco Estate', coffee: 'Coffee Estate', quarry: 'Quarry' };
export const GOODS_MODEL: Record<Good, string> = { corn: 'Corn Crate', fruit: 'Banana Crate', sugar: 'Sugar Crate', tobacco: 'Tobacco Crate', coffee: 'Coffee Crate' };
export const ROLE_MODEL: Record<Role, string> = {
  planter: 'Planter Command Tile',
  recruiter: 'Recruiter Command Tile',
  builder: 'Builder Command Tile',
  craftsman: 'Craftsman Command Tile',
  trader: 'Trader Command Tile',
  captain: 'Captain Command Tile',
  adventurer: 'Adventurer Command Tile',
};
