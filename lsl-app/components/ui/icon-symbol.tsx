// lsl-app/components/ui/icon-symbol.tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Map SF Symbol-style names to MaterialIcons names.
 * See https://icons.expo.fyi for available Material icons.
 */
const MAPPING = {
  'house.fill': 'home',

  // Tabs
  'person.3.fill': 'groups',              // Teams
  'chart.bar.fill': 'bar-chart',          // Analytics
  'building.columns.fill': 'account-balance', // Conferences
  'trophy.fill': 'emoji-events',          // LCAA / Bracket
  'list.number': 'format-list-numbered',  // Rankings
  'person.crop.circle': 'person',         // Profile

  // Existing mappings
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const materialName = MAPPING[name] ?? 'help-outline';
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={materialName}
      style={style}
    />
  );
}
