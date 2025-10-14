import { describe, test, expect } from '@jest/globals';
import { generateShapes } from '../utils/grid';

describe('Grid Generation', () => {
  test('generates correct number of shapes', () => {
    const config = {
      columns: 3,
      rows: 3,
      gap: 10,
      size: 5,
      displacement: 1,
      smoothness: 1,
      seed: 1
    };
    const shapes = generateShapes(config);
    expect(shapes.length).toBe(9);
  });
}); 