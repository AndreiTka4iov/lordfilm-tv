'use client'

import {
  Badge,
  Button,
  Checkbox,
  Container,
  Input,
  Select,
  MultiSelect,
  Menu,
  Modal,
  createTheme,
  type MantineColorScheme,
  type CSSVariablesResolver,
  type MantineThemeComponent,
  Paper,
  rem,
  TextInput,
} from '@mantine/core'

const CONTAINER_SIZES: Record<string, string> = {
  xs: rem(400),
  sm: rem(500),
  md: rem(600),
  lg: rem(900),
  xl: rem(1700),
}

const PAPER_RADIUS_CLASSES: Record<string, string> = {
  xs: 'rounded-[4px]!',
  sm: 'rounded-[8px]!',
  md: 'rounded-[12px]!',
  lg: 'rounded-[16px]!',
  xl: 'rounded-[24px]!',
}

// defaults for all the inputs
const inputs = [
  'Input',
  'InputBase',
  'TextInput',
  'PasswordInput',
  'NumberInput',
  'Select',
  'MultiSelect',
  'DatePickerInput',
]
const defaultInputs: Record<string, MantineThemeComponent> = {}

inputs.forEach((x) => {
  defaultInputs[x] = TextInput.extend({
    defaultProps: {
      size: 'md',
    },
  })
})

export const defaultColorScheme: MantineColorScheme = 'dark'

// Scope neutral overrides to light mode so dark surfaces and accents stay intact.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--lordfilm-color-background': 'var(--mantine-color-gray-1)',
    '--mantine-color-gray-0': '#F8FAFC',
    '--mantine-color-gray-1': '#F4F6FA',
    '--mantine-color-gray-2': '#EEF1F6',
    '--mantine-color-gray-3': '#E6EBF2',
    '--mantine-color-gray-4': '#DEE4ED',
    '--mantine-color-gray-5': '#8490A3',
    '--mantine-color-gray-6': '#626D80',
    '--mantine-color-gray-7': '#465267',
    '--mantine-color-gray-8': '#303B4D',
    '--mantine-color-gray-9': '#202735',
    '--mantine-color-text': 'var(--mantine-color-gray-9)',
    '--mantine-color-bright': 'var(--mantine-color-gray-9)',
    '--mantine-color-body': 'var(--mantine-color-white)',
    '--mantine-color-default': 'var(--mantine-color-gray-2)',
    '--mantine-color-default-hover': 'var(--mantine-color-gray-3)',
    '--mantine-color-default-color': 'var(--mantine-color-gray-9)',
    '--mantine-color-default-border': 'var(--mantine-color-gray-4)',
    '--mantine-color-dimmed': 'var(--mantine-color-gray-6)',
    '--mantine-color-placeholder': 'var(--mantine-color-gray-6)',
  },
  dark: {
    '--lordfilm-color-background': 'var(--mantine-color-dark-9)',
    '--mantine-color-placeholder': 'var(--mantine-color-dark-2)',
  },
})

export const theme = createTheme({
  fontFamily: "'Onest Variable', system-ui, -apple-system, sans-serif",
  fontSizes: {
    xsm: rem(14),
  },
  breakpoints: {
    xs: '30em',
    sm: '48em',
    md: '64em',
    lg: '74em',
    xl: '90em',
    xxl: '100em',
  },

  defaultRadius: 'lg',
  black: '#2C2F3A',
  colors: {
    blue: [
      '#E6F0FF',
      '#C2D9FF',
      '#9EC2FF',
      '#7AABFF',
      '#5694FF',
      '#327DFF',
      '#1875FF',
      '#005FEB',
      '#004DB8',
      '#003B85',
    ],
  },
  primaryColor: 'lime',
  primaryShade: 5,
  focusRing: 'always',
  components: {
    Modal: Modal.extend({
      classNames: {
        content: 'max-sm:rounded-none! data-[full-screen]:rounded-none!',
      },
    }),
    Menu: Menu.extend({
      classNames: { item: 'rounded-[var(--mantine-radius-lg)]!' },
    }),
    Badge: Badge.extend({
      classNames: {
        root: '[cursor:inherit]!',
      },
    }),
    // Share the same inset for field content and its surrounding text.
    // Keep Mantine's section offsets and unstyled fields intact.
    InputWrapper: Input.Wrapper.extend({
      classNames: (_, { variant }) =>
        variant === 'unstyled'
          ? {}
          : {
              label: 'px-[var(--mantine-spacing-md)]!',
              description: 'px-[var(--mantine-spacing-md)]!',
              error: 'px-[var(--mantine-spacing-md)]!',
            },
    }),
    Paper: Paper.extend({
      classNames: (_, { radius }) => ({
        root:
          typeof radius === 'string' ? PAPER_RADIUS_CLASSES[radius] : undefined,
      }),
      defaultProps: {
        radius: 'lg',
      },
    }),
    Button: Button.extend({
      classNames: {
        root: 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent data-[variant=default]:border-0! [[data-mantine-color-scheme=light]_&]:data-[variant=default]:[&:not(:disabled):not([data-disabled])]:bg-[var(--mantine-color-gray-2)]! [[data-mantine-color-scheme=light]_&]:data-[variant=default]:[&:not(:disabled):not([data-disabled])]:hover:bg-[var(--mantine-color-gray-3)]! [[data-mantine-color-scheme=dark]_&]:data-[variant=default]:[&:not(:disabled):not([data-disabled])]:bg-[var(--mantine-color-dark-6)]! [[data-mantine-color-scheme=dark]_&]:data-[variant=default]:[&:not(:disabled):not([data-disabled])]:hover:bg-[var(--mantine-color-dark-5)]!',
      },
    }),
    Checkbox: Checkbox.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Container: Container.extend({
      vars: (_, { size, fluid }) => ({
        root: {
          '--container-size': fluid
            ? '100%'
            : size !== undefined && size in CONTAINER_SIZES
              ? CONTAINER_SIZES[size]
              : rem(size),
        },
      }),
      defaultProps: {
        size: 'xl',
      },
    }),
    ...defaultInputs,
    Select: Select.extend({
      defaultProps: { size: 'md' },
      classNames: {
        dropdown: PAPER_RADIUS_CLASSES.lg,
        option: 'rounded-[var(--mantine-radius-lg)]!',
      },
    }),
    MultiSelect: MultiSelect.extend({
      defaultProps: { size: 'md' },
      classNames: {
        dropdown: PAPER_RADIUS_CLASSES.lg,
        option: 'rounded-[var(--mantine-radius-lg)]!',
      },
    }),
    Input: Input.extend({
      defaultProps: { size: 'md' },
      classNames: {
        wrapper:
          '[&:not([data-variant=unstyled])]:[--input-padding:var(--mantine-spacing-md)]! [[data-mantine-color-scheme=light]_&]:data-[variant=filled]:[--input-bg:var(--mantine-color-gray-3)]! [[data-mantine-color-scheme=light]_&]:data-[variant=filled]:[&:not([data-error])]:[--input-bd:var(--mantine-color-gray-4)]!',
      },
    }),
  },
})
