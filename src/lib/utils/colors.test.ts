import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  getAccessibleTextColor,
  meetsWCAGAA,
  getNodeCategoryColor,
  getTemplateCategoryColor,
  getCommunityCategoryColor,
  getFallbackColor,
  NODE_CATEGORY_COLORS,
  TEMPLATE_CATEGORY_COLORS,
  COMMUNITY_CATEGORY_COLORS,
  FALLBACK_COLORS,
} from './colors';

describe('hexToRgb', () => {
  it('converts hex to RGB values', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('handles hex without hash', () => {
    expect(hexToRgb('FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('getLuminance', () => {
  it('returns 1 for white', () => {
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('returns 0 for black', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 2);
  });

  it('returns intermediate values for colors', () => {
    const grayLuminance = getLuminance('#808080');
    expect(grayLuminance).toBeGreaterThan(0);
    expect(grayLuminance).toBeLessThan(1);
  });
});

describe('getContrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    expect(getContrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same colors', () => {
    expect(getContrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 2);
  });

  it('is symmetric', () => {
    const ratio1 = getContrastRatio('#0072B2', '#FFFFFF');
    const ratio2 = getContrastRatio('#FFFFFF', '#0072B2');
    expect(ratio1).toBeCloseTo(ratio2, 2);
  });
});

describe('getAccessibleTextColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(getAccessibleTextColor('#000000')).toBe('#FFFFFF');
    expect(getAccessibleTextColor('#333333')).toBe('#FFFFFF');
    expect(getAccessibleTextColor('#0072B2')).toBe('#FFFFFF');
  });

  it('returns black for very light backgrounds', () => {
    expect(getAccessibleTextColor('#FFFFFF')).toBe('#000000');
    expect(getAccessibleTextColor('#EEEEEE')).toBe('#000000');
  });
});

describe('meetsWCAGAA', () => {
  it('returns true for high contrast combinations', () => {
    expect(meetsWCAGAA('#FFFFFF', '#000000')).toBe(true);
    expect(meetsWCAGAA('#000000', '#FFFFFF')).toBe(true);
  });

  it('returns false for low contrast combinations', () => {
    expect(meetsWCAGAA('#FFFFFF', '#EEEEEE')).toBe(false);
    expect(meetsWCAGAA('#777777', '#888888')).toBe(false);
  });

  it('uses lower threshold for large text', () => {
    // A combination that fails normal but passes large text (3:1)
    const result = meetsWCAGAA('#767676', '#FFFFFF', true);
    expect(result).toBe(true);
  });
});

describe('getNodeCategoryColor', () => {
  it('returns correct color for known categories', () => {
    expect(getNodeCategoryColor('Triggers')).toBe('#009E73');
    expect(getNodeCategoryColor('AI')).toBe('#AA3377');
    expect(getNodeCategoryColor('HTTP & APIs')).toBe('#0072B2');
  });

  it('returns "Other" color for unknown categories', () => {
    expect(getNodeCategoryColor('Unknown Category')).toBe(NODE_CATEGORY_COLORS['Other']);
  });
});

describe('getTemplateCategoryColor', () => {
  it('returns correct color for known categories', () => {
    expect(getTemplateCategoryColor('AI')).toBe('#AA3377');
    expect(getTemplateCategoryColor('Marketing')).toBe('#CC3311');
  });

  it('returns fallback color for unknown categories', () => {
    const color = getTemplateCategoryColor('Unknown', 0);
    expect(FALLBACK_COLORS).toContain(color);
  });

  it('cycles through fallback colors by index', () => {
    const color1 = getTemplateCategoryColor('Unknown1', 0);
    const color2 = getTemplateCategoryColor('Unknown2', 1);
    expect(color1).toBe(FALLBACK_COLORS[0]);
    expect(color2).toBe(FALLBACK_COLORS[1]);
  });
});

describe('getCommunityCategoryColor', () => {
  it('matches partial category names', () => {
    expect(getCommunityCategoryColor('Questions & Help')).toBe('#0072B2');
    expect(getCommunityCategoryColor('Feature Requests & Ideas')).toBe('#AA3377');
  });

  it('returns fallback for non-matching categories', () => {
    const color = getCommunityCategoryColor('Random Category', 0);
    expect(FALLBACK_COLORS).toContain(color);
  });
});

describe('getFallbackColor', () => {
  it('returns colors by index', () => {
    expect(getFallbackColor(0)).toBe(FALLBACK_COLORS[0]);
    expect(getFallbackColor(1)).toBe(FALLBACK_COLORS[1]);
  });

  it('wraps around for large indices', () => {
    const index = FALLBACK_COLORS.length;
    expect(getFallbackColor(index)).toBe(FALLBACK_COLORS[0]);
  });
});

describe('WCAG compliance of palettes', () => {
  it('all NODE_CATEGORY_COLORS meet WCAG AA with white or black text', () => {
    for (const [category, color] of Object.entries(NODE_CATEGORY_COLORS)) {
      const textColor = getAccessibleTextColor(color);
      const passes = meetsWCAGAA(textColor, color);
      expect(passes, `${category} (${color}) should meet WCAG AA`).toBe(true);
    }
  });

  it('all TEMPLATE_CATEGORY_COLORS meet WCAG AA with white or black text', () => {
    for (const [category, color] of Object.entries(TEMPLATE_CATEGORY_COLORS)) {
      const textColor = getAccessibleTextColor(color);
      const passes = meetsWCAGAA(textColor, color);
      expect(passes, `${category} (${color}) should meet WCAG AA`).toBe(true);
    }
  });

  it('all COMMUNITY_CATEGORY_COLORS meet WCAG AA with white or black text', () => {
    for (const [category, color] of Object.entries(COMMUNITY_CATEGORY_COLORS)) {
      const textColor = getAccessibleTextColor(color);
      const passes = meetsWCAGAA(textColor, color);
      expect(passes, `${category} (${color}) should meet WCAG AA`).toBe(true);
    }
  });

  it('all FALLBACK_COLORS meet WCAG AA with white or black text', () => {
    for (const color of FALLBACK_COLORS) {
      const textColor = getAccessibleTextColor(color);
      const passes = meetsWCAGAA(textColor, color);
      expect(passes, `Fallback ${color} should meet WCAG AA`).toBe(true);
    }
  });
});
