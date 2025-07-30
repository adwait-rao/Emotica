import { Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

// Design System Constants
const COLORS = {
  // Primary Colors
  primary: {
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50',
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
    main: '#4CAF50',
    dark: '#388E3C',
    light: '#81C784',
  },
  
  // Secondary Colors
  secondary: {
    50: '#F1F8E9',
    100: '#DCEDC8',
    200: '#C5E1A5',
    300: '#AED581',
    400: '#9CCC65',
    500: '#8BC34A',
    600: '#7CB342',
    700: '#689F38',
    800: '#558B2F',
    900: '#33691E',
    main: '#8BC34A',
    dark: '#689F38',
    light: '#AED581',
  },
  
  // Neutral Colors
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    white: '#FFFFFF',
    black: '#000000',
  },
  
  // Semantic Colors
  semantic: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },
  
  // Mood Colors
  mood: {
    happy: '#4CAF50',
    neutral: '#9E9E9E',
    sad: '#607D8B',
    anxious: '#FF9800',
    calm: '#81C784',
  },
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

const BORDER_RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  xxxxl: 36,
  xxxxxl: 48,
};

const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 15,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 25,
  },
};

const styles = StyleSheet.create({
  // Typography Styles
  heading: {
    fontFamily: 'Inter-Bold',
    fontSize: FONT_SIZES.xxxxl,
    lineHeight: FONT_SIZES.xxxxl * 1.2,
    color: COLORS.primary.dark,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  
  heading2: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FONT_SIZES.xxxl,
    lineHeight: FONT_SIZES.xxxl * 1.3,
    color: COLORS.primary.dark,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  
  mood: {
    fontFamily: 'DancingScript-Regular',
    fontSize: FONT_SIZES.xxl,
    lineHeight: FONT_SIZES.xxl * 1.4,
    color: COLORS.primary.main,
    fontStyle: 'italic',
  },
  
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZES.base,
    lineHeight: FONT_SIZES.base * 1.6,
    color: COLORS.neutral[800],
    fontWeight: '400',
  },
  
  caption: {
    fontFamily: 'Inter-Medium',
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * 1.4,
    color: COLORS.neutral[600],
    fontWeight: '500',
  },
  
  // Button Styles
  primaryButton: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  
  primaryButtonText: {
    color: COLORS.neutral.white,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary.main,
  },
  
  secondaryButtonText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  
  rowButton: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: COLORS.primary.main,
    minWidth: 200,
  },
  
  rowButtonText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  
  iconButton: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.full,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  fabButton: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.full,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    ...SHADOWS.lg,
  },
  
  // Input Styles
  dropdown: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 200,
  },
  
  dropdownText: {
    color: COLORS.neutral.white,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  
  textArea: {
    backgroundColor: COLORS.neutral.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-Regular',
    color: COLORS.neutral[800],
    borderWidth: 2,
    borderColor: COLORS.neutral[300],
    minHeight: 120,
    textAlignVertical: 'top',
  },
  
  // Toggle Styles
  switchContainer: {
    width: 64,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.neutral[300],
    justifyContent: 'center',
    position: 'relative',
  },
  
  switchActive: {
    backgroundColor: COLORS.primary.main,
  },
  
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.neutral.white,
    position: 'absolute',
    left: 4,
    ...SHADOWS.sm,
  },
  
  switchThumbActive: {
    left: 36,
  },
  
  // Card Styles
  mainCard: {
    backgroundColor: COLORS.neutral.white,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
  },
  
  moodCard: {
    backgroundColor: COLORS.primary[50],
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: COLORS.primary[100],
  },
  
  // Avatar Styles
  avatarUser: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  
  avatarMood: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  
  avatarAssistant: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary.dark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  
  // Chat Bubble Styles
  chatBubbleUser: {
    backgroundColor: COLORS.primary[50],
    borderRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    maxWidth: '75%',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  
  chatBubbleUserText: {
    color: COLORS.primary[800],
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-Regular',
  },
  
  chatBubbleAssistant: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.xl,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    maxWidth: '75%',
    alignSelf: 'flex-start',
    marginRight: 'auto',
  },
  
  chatBubbleAssistantText: {
    color: COLORS.neutral.white,
    fontSize: FONT_SIZES.base,
    fontFamily: 'Inter-Regular',
  },
  
  // Chart Styles
  chartContainer: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  progressContainer: {
    backgroundColor: COLORS.primary.light,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  progressBar: {
    height: 16,
    backgroundColor: COLORS.primary[800],
    borderRadius: BORDER_RADIUS.sm,
  },
  
  // Navigation Styles
  slider: {
    backgroundColor: COLORS.primary.main,
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 300,
  },
  
  sliderControl: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.full,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Indicator Styles
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary.main,
  },
  
  notificationIndicator: {
    width: 12,
    height: 12,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.semantic.error,
    position: 'absolute',
    top: -4,
    right: -4,
  },
  
  // Layout Styles
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  
  screenPadding: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  
  section: {
    marginBottom: SPACING.xl,
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  column: {
    flexDirection: 'column',
  },
  
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  spaceBetween: {
    justifyContent: 'space-between',
  },
  
  spaceAround: {
    justifyContent: 'space-around',
  },
  
  // Utility Styles
  marginXs: { margin: SPACING.xs },
  marginSm: { margin: SPACING.sm },
  marginMd: { margin: SPACING.md },
  marginLg: { margin: SPACING.lg },
  marginXl: { margin: SPACING.xl },
  
  paddingXs: { padding: SPACING.xs },
  paddingSm: { padding: SPACING.sm },
  paddingMd: { padding: SPACING.md },
  paddingLg: { padding: SPACING.lg },
  paddingXl: { padding: SPACING.xl },
  
  // Responsive breakpoints
  mobile: {
    width: width < 768 ? '100%' : '50%',
  },
  
  tablet: {
    width: width >= 768 && width < 1024 ? '100%' : '75%',
  },
  
  desktop: {
    width: width >= 1024 ? '100%' : '85%',
  },
});

// Export individual constants for use in components
export const Colors = COLORS;
export const Spacing = SPACING;
export const BorderRadius = BORDER_RADIUS;
export const FontSizes = FONT_SIZES;
export const Shadows = SHADOWS;

export default styles;