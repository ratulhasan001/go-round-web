// Icons for the store's featured category tiles. The shop can pick one per category on the Website page; a category
// without a pick gets the icon that fits its name.
import {
  Box,
  Droplets,
  Fan,
  Filter,
  Fish,
  FlaskConical,
  Gauge,
  Layers,
  Leaf,
  Lightbulb,
  Mountain,
  Package,
  Pipette,
  Scissors,
  Shell,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  TreePine,
  Waves,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { sameName } from "./site";

export const CATEGORY_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  soil: { label: "Soil & substrate", icon: Layers },
  fertilizer: { label: "Fertilizer", icon: FlaskConical },
  light: { label: "Light", icon: Lightbulb },
  sun: { label: "Sun", icon: Sun },
  co2: { label: "CO2", icon: Wind },
  filtration: { label: "Filtration", icon: Waves },
  filter: { label: "Filter", icon: Filter },
  accessories: { label: "Accessories", icon: Wrench },
  plants: { label: "Plants", icon: Sprout },
  leaf: { label: "Leaf", icon: Leaf },
  tree: { label: "Tree", icon: TreePine },
  fish: { label: "Fish", icon: Fish },
  shrimp: { label: "Shell", icon: Shell },
  stone: { label: "Stones & rocks", icon: Mountain },
  water: { label: "Water care", icon: Droplets },
  dosing: { label: "Dosing", icon: Pipette },
  heater: { label: "Heater", icon: Thermometer },
  pump: { label: "Pump & fan", icon: Fan },
  gauge: { label: "Gauge & regulator", icon: Gauge },
  power: { label: "Electrical", icon: Zap },
  tools: { label: "Tools", icon: Scissors },
  tank: { label: "Tank", icon: Box },
  package: { label: "Package", icon: Package },
  other: { label: "Sparkle", icon: Sparkles },
};

/** The icon that fits a category name. */
export function guessIcon(name: string): string {
  const n = name.toLowerCase();
  if (/soil|substrate|additive|sand|gravel/.test(n)) return "soil";
  if (/fert|nutri/.test(n)) return "fertilizer";
  if (/light|lamp|led/.test(n)) return "light";
  if (/co2|co₂/.test(n)) return "co2";
  if (/filtration/.test(n)) return "filtration";
  if (/filter/.test(n)) return "filter";
  if (/plant|moss/.test(n)) return "plants";
  if (/fish|food/.test(n)) return "fish";
  if (/shrimp|snail/.test(n)) return "shrimp";
  if (/stone|rock|wood|hardscape/.test(n)) return "stone";
  if (/water|condition|treat/.test(n)) return "water";
  if (/heat/.test(n)) return "heater";
  if (/pump|fan|cool/.test(n)) return "pump";
  if (/tool|scissor|tweez/.test(n)) return "tools";
  if (/tank|aquarium/.test(n)) return "tank";
  if (/access/.test(n)) return "accessories";
  return "other";
}

/** The key a category's icon pick is saved under. */
export const iconKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** The icon key for a category: the shop's pick, or the one that fits its name. */
export function categoryIconId(name: string, picks: Record<string, string>): string {
  const pick = picks[iconKey(name)] ?? Object.entries(picks).find(([k]) => sameName(k, name))?.[1];
  return pick && CATEGORY_ICONS[pick] ? pick : guessIcon(name);
}

export const categoryIcon = (name: string, picks: Record<string, string>) => CATEGORY_ICONS[categoryIconId(name, picks)]!.icon;
