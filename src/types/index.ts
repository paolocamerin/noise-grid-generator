export interface PluginMessage {
  type: 'create-grid' | 'close' | 'selection-updated' | 'selection-status-check' | 'selection-status';
  data?: any;
  image?: Uint8Array;
  hasSelection?: boolean;
  variantImages?: Uint8Array[];
  errorMessage?: string;
}

export interface ShapeConfig {
  name: string;
  x: number;
  y: number;
  dimension: number;
  rotation: number;
  // Additional properties used in the grid
  xIndex?: number;
  yIndex?: number;
  xCount?: number;
  yCount?: number;
  w?: number;
  h?: number;
  xGap?: number;
  yGap?: number;
  factor?: number;
  variantIndex?: number;
  randomizeVariants?: boolean;
}

export interface GridConfig {
  columns: number;
  rows: number;
  gap: number;
  size: number;
  displacement: number;
  smoothness: number;
  seed: number;
} 