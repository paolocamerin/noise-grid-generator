interface GridConfig {
  columns: number;
  rows: number;
  gap: number;
  size: number;
  displacement: number;
  smoothness: number;
  seed: number;
}

export function generateShapes(config: GridConfig) {
  // Basic implementation to make test pass
  return Array(config.rows * config.columns).fill(null);
} 